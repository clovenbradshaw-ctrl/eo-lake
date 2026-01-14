/**
 * EO Merge Engine - Lazy evaluation merge computation
 *
 * Refactored to use the 3 Questions model from eo_merge_questions.js.
 *
 * This engine computes merge results on-demand instead of storing them inline.
 * Merged sets store only their derivation specification (the 3 questions + conditions),
 * and results are computed when needed and cached in IndexedDB.
 *
 * Key concepts:
 * - Virtual Sets: Sets with a derivation spec but no inline records
 * - Lazy Evaluation: Results computed on first access via MergeExecutor
 * - Caching: Computed results stored in IndexedDB for reuse
 * - Invalidation: Cache invalidated when source data changes
 */

// Import or reference the Questions model
const QuestionsModel = (typeof require !== 'undefined')
  ? require('./eo_merge_questions.js')
  : {
      MergePosition: window.MergePosition,
      MergeExecutor: window.MergeExecutor,
      createMerge: window.createMerge,
      Presets: window.Presets
    };

/**
 * MergeEngine - Manages lazy computation and caching of merge results
 */
class MergeEngine {
  constructor(storage) {
    this.storage = storage || (typeof eoStorage !== 'undefined' ? eoStorage : null);
    this._executor = new QuestionsModel.MergeExecutor();
    this._computeCallbacks = new Map();
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

    // Compute the merge using the 3 Questions model
    const result = await this.computeMerge(set, getSourceRecords, options);

    // Cache the result
    if (this.storage && result.success) {
      await this.storage.storeMergeResult(set.id, result);
    }

    return result.records || [];
  }

  /**
   * Compute a merge based on the set's derivation specification
   * Uses the MergeExecutor from the 3 Questions model
   */
  async computeMerge(set, getSourceRecords, options = {}) {
    const derivation = set.derivation;
    if (!derivation || derivation.operator !== 'relational_merge') {
      return { success: false, error: 'Not a merge derivation' };
    }

    // Get source IDs
    const sourceItems = derivation.sourceItems || [];
    if (sourceItems.length < 2) {
      return { success: false, error: 'Merge requires at least two sources' };
    }

    const leftSourceId = sourceItems[0]?.id;
    const rightSourceId = sourceItems[1]?.id;

    if (!leftSourceId || !rightSourceId) {
      return { success: false, error: 'Missing source IDs in derivation' };
    }

    // Get source records
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

    // Reconstruct the MergePosition from the stored 3 questions
    const threeQuestions = derivation.threeQuestions || derivation.relationalPosition || {};
    const position = new QuestionsModel.MergePosition(
      threeQuestions.recognition,
      threeQuestions.boundary,
      threeQuestions.resolution || threeQuestions.decision,
      threeQuestions.direction || threeQuestions.recognitionDirection
    );

    if (!position.isComplete()) {
      return { success: false, error: 'Incomplete merge position - 3 questions not fully answered' };
    }

    // Get join configuration
    const joinConfig = derivation.joinConfig || {};
    const conditions = joinConfig.conditions || [];

    if (conditions.length === 0) {
      return { success: false, error: 'No join conditions defined' };
    }

    // Get output fields from set schema
    // CRITICAL: Include field.id so _buildRecord can key values correctly for grid rendering
    const outputFields = (set.fields || []).map(f => ({
      id: f.id,
      name: f.name,
      source: f.source,
      originalField: f.originalField || f.name,
      type: f.type
    }));

    // Execute using the MergeExecutor
    return this._executor.execute(
      position,
      leftRecords,
      rightRecords,
      conditions,
      outputFields,
      { onProgress: options.onProgress }
    );
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
   * Uses the 3 Questions model for configuration
   */
  createVirtualSet(config) {
    const {
      leftSource,
      rightSource,
      joinConditions,
      outputFields,
      position,  // MergePosition instance or raw questions
      name
    } = config;

    // Normalize position
    let mergePosition = position;
    if (!(position instanceof QuestionsModel.MergePosition)) {
      mergePosition = new QuestionsModel.MergePosition(
        position.recognition,
        position.boundary,
        position.resolution || position.decision,
        position.direction
      );
    }

    const behavior = mergePosition.deriveBehavior();
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
      recordCount: 0,
      isVirtual: true,
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
        // Store the 3 questions answers
        threeQuestions: mergePosition.toJSON(),
        // Derived join type for quick reference
        joinConfig: {
          type: behavior.joinType,
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
      materializedAt: new Date().toISOString(),
      materializationStats: result.stats
    };
  }

  /**
   * Preview a merge without creating a set
   * Useful for testing different 3 Questions combinations
   */
  preview(config, options = {}) {
    const {
      leftRecords,
      rightRecords,
      conditions,
      outputFields,
      position
    } = config;

    let mergePosition = position;
    if (!(position instanceof QuestionsModel.MergePosition)) {
      mergePosition = new QuestionsModel.MergePosition(
        position.recognition,
        position.boundary,
        position.resolution,
        position.direction
      );
    }

    return this._executor.execute(
      mergePosition,
      leftRecords,
      rightRecords,
      conditions,
      outputFields,
      options
    );
  }

  /**
   * Get a preset merge position
   */
  getPreset(presetName) {
    const presets = QuestionsModel.Presets;
    const preset = presets[presetName];
    return preset ? preset() : null;
  }

  /**
   * List available presets
   */
  listPresets() {
    return Object.keys(QuestionsModel.Presets);
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
