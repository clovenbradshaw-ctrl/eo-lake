/**
 * EO Merge Engine - Lazy evaluation merge computation
 *
 * This engine computes merge results on-demand instead of storing them inline.
 * Merged sets store only their derivation specification, and results are
 * computed when needed and cached in IndexedDB.
 *
 * Key concepts:
 * - Virtual Sets: Sets with a derivation spec but no inline records
 * - Lazy Evaluation: Results computed on first access
 * - Caching: Computed results stored in IndexedDB for reuse
 * - Invalidation: Cache invalidated when source data changes
 */

class MergeEngine {
  constructor(storage) {
    this.storage = storage || (typeof eoStorage !== 'undefined' ? eoStorage : null);
    this._computeCallbacks = new Map(); // For progress reporting
  }

  /**
   * Check if a set is a virtual merged set (needs computation)
   */
  isVirtualSet(set) {
    return set.derivation?.operator === 'relational_merge' && !set._materialized;
  }

  /**
   * Get records for a set, computing if necessary
   * @param {Object} set - The set object
   * @param {Function} getSourceRecords - Function to get source records by source ID
   * @param {Object} options - Options for computation
   * @returns {Promise<Array>} - Array of records
   */
  async getRecords(set, getSourceRecords, options = {}) {
    // If not a virtual set, return records directly
    if (!this.isVirtualSet(set)) {
      return set.records || [];
    }

    // Check cache first
    if (this.storage) {
      const cached = await this.storage.getMergeResult(set.id);
      if (cached && !options.forceRecompute) {
        return cached.records;
      }
    }

    // Compute the merge
    const result = await this.computeMerge(set, getSourceRecords, options);

    // Cache the result
    if (this.storage && result.success) {
      await this.storage.storeMergeResult(set.id, result);
    }

    return result.records || [];
  }

  /**
   * Compute a merge based on the set's derivation specification
   */
  async computeMerge(set, getSourceRecords, options = {}) {
    const derivation = set.derivation;
    if (!derivation || derivation.operator !== 'relational_merge') {
      return { success: false, error: 'Not a merge derivation' };
    }

    const sourceItems = derivation.sourceItems || [];
    if (sourceItems.length < 2) {
      return { success: false, error: 'Merge requires at least two sources' };
    }

    // Get source records
    const leftSourceId = sourceItems[0]?.id;
    const rightSourceId = sourceItems[1]?.id;

    if (!leftSourceId || !rightSourceId) {
      return { success: false, error: 'Missing source IDs in derivation' };
    }

    let leftRecords, rightRecords;
    try {
      leftRecords = await getSourceRecords(leftSourceId);
      rightRecords = await getSourceRecords(rightSourceId);
    } catch (e) {
      return { success: false, error: `Failed to load source records: ${e.message}` };
    }

    if (!leftRecords || !rightRecords) {
      return { success: false, error: 'Source records not found' };
    }

    // Extract join configuration
    const joinConfig = derivation.joinConfig || {};
    const conditions = joinConfig.conditions || [];
    const joinType = joinConfig.type || 'INNER';

    if (conditions.length === 0) {
      return { success: false, error: 'No join conditions defined' };
    }

    // Get output fields from set schema
    const outputFields = set.fields || [];

    // Execute the join
    return this._executeJoin({
      leftRecords,
      rightRecords,
      conditions,
      joinType,
      outputFields,
      onProgress: options.onProgress
    });
  }

  /**
   * Execute a join operation
   */
  _executeJoin({ leftRecords, rightRecords, conditions, joinType, outputFields, onProgress }) {
    const results = [];
    const leftMatched = new Set();
    const rightMatched = new Set();

    const totalOperations = leftRecords.length * rightRecords.length;
    let completedOperations = 0;
    const progressInterval = Math.max(1, Math.floor(totalOperations / 100));

    // Build field mapping for efficient lookup
    const fieldsBySource = {
      left: outputFields.filter(f => f.source === 'left'),
      right: outputFields.filter(f => f.source === 'right')
    };

    // Match records
    for (let li = 0; li < leftRecords.length; li++) {
      const leftRec = leftRecords[li];

      for (let ri = 0; ri < rightRecords.length; ri++) {
        const rightRec = rightRecords[ri];

        // Check all conditions
        const matches = conditions.every(cond => {
          const leftVal = this._getRecordValue(leftRec, cond.leftField);
          const rightVal = this._getRecordValue(rightRec, cond.rightField);
          return this._evaluateCondition(leftVal, rightVal, cond.operator);
        });

        if (matches) {
          leftMatched.add(li);
          rightMatched.add(ri);
          results.push(this._mergeRecords(leftRec, rightRec, outputFields));
        }

        // Progress reporting
        completedOperations++;
        if (onProgress && completedOperations % progressInterval === 0) {
          onProgress(completedOperations / totalOperations);
        }
      }
    }

    // Handle unmatched records based on join type
    if (joinType === 'LEFT' || joinType === 'FULL') {
      for (let li = 0; li < leftRecords.length; li++) {
        if (!leftMatched.has(li)) {
          results.push(this._mergeRecords(leftRecords[li], null, outputFields));
        }
      }
    }

    if (joinType === 'RIGHT' || joinType === 'FULL') {
      for (let ri = 0; ri < rightRecords.length; ri++) {
        if (!rightMatched.has(ri)) {
          results.push(this._mergeRecords(null, rightRecords[ri], outputFields));
        }
      }
    }

    if (onProgress) onProgress(1);

    return {
      success: true,
      records: results,
      fields: outputFields,
      totalCount: results.length,
      stats: {
        leftTotal: leftRecords.length,
        rightTotal: rightRecords.length,
        leftMatched: leftMatched.size,
        rightMatched: rightMatched.size,
        joinType
      }
    };
  }

  /**
   * Get a value from a record (handles both flat and values-wrapped records)
   */
  _getRecordValue(record, fieldName) {
    if (!record) return null;
    // Check if record has a 'values' wrapper
    if (record.values && typeof record.values === 'object') {
      return record.values[fieldName];
    }
    return record[fieldName];
  }

  /**
   * Evaluate a join condition
   */
  _evaluateCondition(leftVal, rightVal, operator) {
    if (leftVal == null || rightVal == null) return false;

    const left = String(leftVal).toLowerCase();
    const right = String(rightVal).toLowerCase();

    switch (operator) {
      case 'eq':
      case '=':
      case '==':
        return left === right;
      case 'contains':
        return left.includes(right) || right.includes(left);
      case 'starts':
        return left.startsWith(right);
      case 'ends':
        return left.endsWith(right);
      case 'neq':
      case '!=':
        return left !== right;
      default:
        return left === right;
    }
  }

  /**
   * Merge two records based on output field mapping
   */
  _mergeRecords(leftRec, rightRec, outputFields) {
    const merged = {};

    for (const field of outputFields) {
      const sourceRec = field.source === 'left' ? leftRec : rightRec;
      const fieldName = field.originalField || field.name;
      const outputName = field.name;

      if (sourceRec) {
        merged[outputName] = this._getRecordValue(sourceRec, fieldName);
      } else {
        merged[outputName] = null;
      }
    }

    return { values: merged };
  }

  /**
   * Invalidate cached merge result for a set
   */
  async invalidateCache(setId) {
    if (this.storage) {
      await this.storage.deleteMergeResult(setId);
    }
  }

  /**
   * Create a virtual merged set (stores spec only, no records)
   */
  createVirtualSet(config) {
    const {
      leftSource,
      rightSource,
      joinConditions,
      outputFields,
      joinType,
      relationalPosition,
      name
    } = config;

    const timestamp = new Date().toISOString();
    const setId = `set_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    // Build field definitions from output fields
    const fields = outputFields.map((f, i) => ({
      id: `fld_${setId}_${i}`,
      name: f.rename || f.field,
      originalField: f.field,
      source: f.source,
      type: f.type || 'text',
      width: 150
    }));

    return {
      id: setId,
      name: name || 'Merged Set',
      icon: 'ph-git-merge',
      fields: fields,
      // NO records stored inline - this is a virtual set
      records: [],
      recordCount: 0, // Will be computed on first access
      isVirtual: true, // Flag indicating this is a virtual set
      views: [{
        id: `view_${Date.now().toString(36)}`,
        name: 'All Records',
        type: 'table',
        config: {}
      }],
      createdAt: timestamp,
      updatedAt: timestamp,
      derivation: {
        strategy: 'CON',
        operator: 'relational_merge',
        sourceItems: [
          { type: 'source', id: leftSource.id, name: leftSource.name },
          { type: 'source', id: rightSource.id, name: rightSource.name }
        ],
        relationalPosition: relationalPosition,
        joinConfig: {
          type: joinType,
          conditions: joinConditions.map(c => ({
            leftField: c.leftField,
            rightField: c.rightField,
            operator: c.operator || 'eq'
          }))
        },
        outputFields: outputFields
      }
    };
  }

  /**
   * Materialize a virtual set (compute and store records)
   * Use this when you need to modify records or convert to a regular set
   */
  async materializeSet(set, getSourceRecords) {
    if (!this.isVirtualSet(set)) {
      return set; // Already materialized
    }

    const result = await this.computeMerge(set, getSourceRecords);

    if (!result.success) {
      throw new Error(result.error || 'Failed to materialize set');
    }

    // Return a new set object with computed records
    return {
      ...set,
      records: result.records,
      recordCount: result.totalCount,
      isVirtual: false,
      _materialized: true,
      materializedAt: new Date().toISOString()
    };
  }
}

// Singleton instance
const mergeEngine = new MergeEngine();

// Export for both module and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MergeEngine, mergeEngine };
}

if (typeof window !== 'undefined') {
  window.MergeEngine = MergeEngine;
  window.mergeEngine = mergeEngine;
}
