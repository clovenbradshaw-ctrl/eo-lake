/**
 * EO Pipeline - Transformation Pipeline Engine for Sets
 *
 * Sets are live transformation pipelines. Each step can be:
 * - Added anytime (not just at creation)
 * - Fully tracked (what changed, when, by whom)
 * - Propagates downstream when modified
 * - Reordered, edited, removed
 *
 * Pipeline Steps:
 * - source: Pull records from a source
 * - merge: Layer in another source, matching by key
 * - filter: Remove records matching condition
 * - transform: Modify field values (formulas, mappings)
 * - dedupe: Collapse duplicates within the set
 * - rollup: Aggregate from linked records
 *
 * Merge Strategies (per-field):
 * - keepFirst: Use first non-null value by source priority
 * - keepLast: Use last non-null value by source priority
 * - preferNonEmpty: First non-empty value
 * - concat: Join all values
 * - sum/max/min: Numeric aggregation
 * - latest: Most recent by timestamp field
 * - collectArray: Gather all values as array
 */

// ============================================================================
// Pipeline Step Types
// ============================================================================

const PipelineStepTypes = Object.freeze({
  SOURCE: 'source',       // Pull records from a source
  MERGE: 'merge',         // Layer in another source by matching key
  FILTER: 'filter',       // Remove records matching condition
  TRANSFORM: 'transform', // Modify field values
  DEDUPE: 'dedupe',       // Collapse duplicates
  ROLLUP: 'rollup',       // Aggregate from linked records
  SORT: 'sort',           // Order records
  LINK: 'link',           // Establish relationships to another set
  // Phase 1: Data Reshaping Operators
  PIVOT: 'pivot',         // Reshape long to wide (rows to columns)
  UNPIVOT: 'unpivot',     // Reshape wide to long (columns to rows)
  INDEX: 'index',         // Add row index as field
  FILL: 'fill',           // Fill down/up missing values
  TRANSPOSE: 'transpose'  // Swap rows and columns
});

const PipelineStepIcons = {
  [PipelineStepTypes.SOURCE]: 'ph-database',
  [PipelineStepTypes.MERGE]: 'ph-git-merge',
  [PipelineStepTypes.FILTER]: 'ph-funnel',
  [PipelineStepTypes.TRANSFORM]: 'ph-magic-wand',
  [PipelineStepTypes.DEDUPE]: 'ph-users-three',
  [PipelineStepTypes.ROLLUP]: 'ph-sigma',
  [PipelineStepTypes.SORT]: 'ph-sort-ascending',
  [PipelineStepTypes.LINK]: 'ph-link',
  // Phase 1: Data Reshaping Icons
  [PipelineStepTypes.PIVOT]: 'ph-squares-four',
  [PipelineStepTypes.UNPIVOT]: 'ph-rows',
  [PipelineStepTypes.INDEX]: 'ph-hash',
  [PipelineStepTypes.FILL]: 'ph-arrow-line-down',
  [PipelineStepTypes.TRANSPOSE]: 'ph-swap'
};

// ============================================================================
// Merge Strategies
// ============================================================================

const MergeStrategies = Object.freeze({
  KEEP_FIRST: 'keepFirst',       // Use first value by source priority
  KEEP_LAST: 'keepLast',         // Use last value by source priority
  PREFER_NON_EMPTY: 'preferNonEmpty', // First non-empty value
  CONCAT: 'concat',              // Join all values with separator
  SUM: 'sum',                    // Sum numeric values
  MAX: 'max',                    // Maximum value
  MIN: 'min',                    // Minimum value
  LATEST: 'latest',              // Most recent by timestamp
  COLLECT_ARRAY: 'collectArray', // Gather all values as array
  CUSTOM: 'custom'               // Custom merge function
});

const MergeStrategyLabels = {
  [MergeStrategies.KEEP_FIRST]: 'Keep first',
  [MergeStrategies.KEEP_LAST]: 'Keep last',
  [MergeStrategies.PREFER_NON_EMPTY]: 'Prefer non-empty',
  [MergeStrategies.CONCAT]: 'Concatenate',
  [MergeStrategies.SUM]: 'Sum',
  [MergeStrategies.MAX]: 'Maximum',
  [MergeStrategies.MIN]: 'Minimum',
  [MergeStrategies.LATEST]: 'Latest by date',
  [MergeStrategies.COLLECT_ARRAY]: 'Collect as array',
  [MergeStrategies.CUSTOM]: 'Custom'
};

// ============================================================================
// Filter Operators
// ============================================================================

const FilterOperators = Object.freeze({
  EQUALS: 'equals',
  NOT_EQUALS: 'notEquals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'notContains',
  STARTS_WITH: 'startsWith',
  ENDS_WITH: 'endsWith',
  IS_EMPTY: 'isEmpty',
  IS_NOT_EMPTY: 'isNotEmpty',
  GREATER_THAN: 'greaterThan',
  LESS_THAN: 'lessThan',
  GREATER_OR_EQUAL: 'greaterOrEqual',
  LESS_OR_EQUAL: 'lessOrEqual',
  IN: 'in',
  NOT_IN: 'notIn',
  MATCHES_REGEX: 'matchesRegex'
});

// ============================================================================
// Normalization Functions
// ============================================================================

const NormalizationFunctions = {
  /**
   * Normalize a string for matching (lowercase, trim, collapse whitespace)
   */
  normalizeString(value) {
    if (value == null) return '';
    return String(value).toLowerCase().trim().replace(/\s+/g, ' ');
  },

  /**
   * Normalize a name (handle diacritics, punctuation)
   */
  normalizeName(value) {
    if (value == null) return '';
    return String(value)
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ');
  },

  /**
   * Normalize a phone number (digits only)
   */
  normalizePhone(value) {
    if (value == null) return '';
    return String(value).replace(/\D/g, '');
  },

  /**
   * Normalize an email (lowercase, trim)
   */
  normalizeEmail(value) {
    if (value == null) return '';
    return String(value).toLowerCase().trim();
  },

  /**
   * Normalize an ID/code (uppercase, remove spaces and punctuation)
   */
  normalizeId(value) {
    if (value == null) return '';
    return String(value).toUpperCase().replace(/[\s\-_.]/g, '');
  },

  /**
   * Normalize a date to ISO format
   */
  normalizeDate(value) {
    if (value == null) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }
};

// ============================================================================
// Pipeline Step Factory
// ============================================================================

/**
 * Create a pipeline step
 */
function createPipelineStep(type, config = {}, metadata = {}) {
  const id = `step_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = new Date().toISOString();

  return {
    id,
    type,
    config,
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    note: metadata.note || '',
    actor: metadata.actor || 'user',
    // Execution results (populated after run)
    lastExecution: null
  };
}

/**
 * Create a source step
 */
function createSourceStep(sourceId, options = {}) {
  return createPipelineStep(PipelineStepTypes.SOURCE, {
    sourceId,
    fieldMappings: options.fieldMappings || null, // null = auto-map
    includeSourceRef: options.includeSourceRef !== false // Track which source each record came from
  }, options);
}

/**
 * Create a merge step
 */
function createMergeStep(sourceId, options = {}) {
  return createPipelineStep(PipelineStepTypes.MERGE, {
    sourceId,
    // Match configuration
    matchFields: options.matchFields || [], // Array of { field, normalize? }
    matchMode: options.matchMode || 'all', // 'all' = all fields must match, 'any' = any field matches
    // Field mappings from source to set
    fieldMappings: options.fieldMappings || null,
    // Per-field merge strategies
    fieldStrategies: options.fieldStrategies || {}, // { fieldId: strategy }
    defaultStrategy: options.defaultStrategy || MergeStrategies.PREFER_NON_EMPTY,
    // Concatenation options
    concatSeparator: options.concatSeparator || ', ',
    // What to do with non-matching source records
    addUnmatched: options.addUnmatched !== false, // true = add as new records
    // Track source of each field value
    trackFieldProvenance: options.trackFieldProvenance || false
  }, options);
}

/**
 * Create a filter step
 */
function createFilterStep(conditions, options = {}) {
  return createPipelineStep(PipelineStepTypes.FILTER, {
    conditions, // Array of { field, operator, value }
    logic: options.logic || 'and', // 'and' or 'or'
    invert: options.invert || false // true = keep non-matching records
  }, options);
}

/**
 * Create a transform step
 */
function createTransformStep(transformations, options = {}) {
  return createPipelineStep(PipelineStepTypes.TRANSFORM, {
    transformations // Array of { field, operation, params }
  }, options);
}

/**
 * Create a dedupe step
 */
function createDedupeStep(matchFields, options = {}) {
  return createPipelineStep(PipelineStepTypes.DEDUPE, {
    matchFields, // Array of field IDs to match on
    normalize: options.normalize || 'string', // Normalization function name
    mergeStrategy: options.mergeStrategy || MergeStrategies.KEEP_FIRST,
    fieldStrategies: options.fieldStrategies || {}
  }, options);
}

// ============================================================================
// Phase 1: Data Reshaping Step Factories
// ============================================================================

/**
 * Create a pivot step - reshape from long to wide format
 * @param {Object} config - Pivot configuration
 * @param {string[]} config.groupBy - Fields to group by (row identifiers)
 * @param {string} config.attributeColumn - Column containing attribute names
 * @param {string} config.valueColumn - Column containing values
 * @param {string} config.aggregateFunction - Aggregation for multiple values (FIRST, LAST, SUM, AVG, COUNT, MIN, MAX)
 * @param {Object} options - Additional options (note, actor)
 */
function createPivotStep(config, options = {}) {
  return createPipelineStep(PipelineStepTypes.PIVOT, {
    groupBy: config.groupBy || [],
    attributeColumn: config.attributeColumn,
    valueColumn: config.valueColumn,
    aggregateFunction: config.aggregateFunction || 'FIRST'
  }, options);
}

/**
 * Create an unpivot step - reshape from wide to long format
 * @param {Object} config - Unpivot configuration
 * @param {string[]} config.columnsToUnpivot - Columns to convert to rows
 * @param {string} config.attributeColumnName - Name for the attribute column (default: 'Attribute')
 * @param {string} config.valueColumnName - Name for the value column (default: 'Value')
 * @param {boolean} config.excludeNulls - Whether to exclude null/empty values (default: true)
 * @param {Object} options - Additional options (note, actor)
 */
function createUnpivotStep(config, options = {}) {
  return createPipelineStep(PipelineStepTypes.UNPIVOT, {
    columnsToUnpivot: config.columnsToUnpivot || [],
    attributeColumnName: config.attributeColumnName || 'Attribute',
    valueColumnName: config.valueColumnName || 'Value',
    excludeNulls: config.excludeNulls !== false
  }, options);
}

/**
 * Create an index step - add row index as field
 * @param {Object} config - Index configuration
 * @param {string} config.fieldName - Name for index field (default: '__row_index')
 * @param {number} config.startFrom - Starting index value (default: 0)
 * @param {number} config.step - Increment step (default: 1)
 * @param {Object} options - Additional options (note, actor)
 */
function createIndexStep(config = {}, options = {}) {
  return createPipelineStep(PipelineStepTypes.INDEX, {
    fieldName: config.fieldName || '__row_index',
    startFrom: config.startFrom ?? 0,
    step: config.step ?? 1
  }, options);
}

/**
 * Create a fill step - fill down/up missing values
 * @param {Object} config - Fill configuration
 * @param {string[]} config.fields - Fields to fill
 * @param {string} config.direction - Fill direction ('down' or 'up', default: 'down')
 * @param {any[]} config.treatAsEmpty - Values to treat as empty (default: [null, '', undefined])
 * @param {Object} options - Additional options (note, actor)
 */
function createFillStep(config, options = {}) {
  return createPipelineStep(PipelineStepTypes.FILL, {
    fields: config.fields || [],
    direction: config.direction || 'down',
    treatAsEmpty: config.treatAsEmpty || [null, '', undefined]
  }, options);
}

/**
 * Create a transpose step - swap rows and columns
 * @param {Object} config - Transpose configuration
 * @param {string} config.headerField - Field to use as new column headers (optional)
 * @param {Object} options - Additional options (note, actor)
 */
function createTransposeStep(config = {}, options = {}) {
  return createPipelineStep(PipelineStepTypes.TRANSPOSE, {
    headerField: config.headerField || null
  }, options);
}

// ============================================================================
// Pipeline Executor
// ============================================================================

class PipelineExecutor {
  constructor(options = {}) {
    this.sources = options.sources || [];
    this.sets = options.sets || [];
    this.onProgress = options.onProgress || null;
  }

  /**
   * Execute a full pipeline
   * @param {Object[]} steps - Array of pipeline steps
   * @param {Object[]} initialRecords - Starting records (optional)
   * @param {Object} context - Execution context
   * @returns {Object} { records, history, errors }
   */
  execute(steps, initialRecords = [], context = {}) {
    const history = [];
    let records = [...initialRecords];
    const errors = [];
    const enabledSteps = steps.filter(s => s.enabled);

    for (let i = 0; i < enabledSteps.length; i++) {
      const step = enabledSteps[i];
      const stepStart = Date.now();

      try {
        if (this.onProgress) {
          this.onProgress({
            step: i + 1,
            total: enabledSteps.length,
            stepType: step.type,
            stepId: step.id
          });
        }

        const result = this._executeStep(step, records, context);

        // Build history entry
        const historyEntry = {
          stepId: step.id,
          stepType: step.type,
          executedAt: new Date().toISOString(),
          duration: Date.now() - stepStart,
          inputCount: records.length,
          outputCount: result.records.length,
          changes: result.changes || [],
          stats: result.stats || {}
        };

        history.push(historyEntry);
        records = result.records;

        // Update step's last execution
        step.lastExecution = historyEntry;

      } catch (err) {
        errors.push({
          stepId: step.id,
          stepType: step.type,
          error: err.message,
          stack: err.stack
        });
        // Continue with other steps or stop?
        if (context.stopOnError) {
          break;
        }
      }
    }

    return { records, history, errors };
  }

  /**
   * Execute a single step
   */
  _executeStep(step, records, context) {
    switch (step.type) {
      case PipelineStepTypes.SOURCE:
        return this._executeSourceStep(step, records, context);
      case PipelineStepTypes.MERGE:
        return this._executeMergeStep(step, records, context);
      case PipelineStepTypes.FILTER:
        return this._executeFilterStep(step, records, context);
      case PipelineStepTypes.TRANSFORM:
        return this._executeTransformStep(step, records, context);
      case PipelineStepTypes.DEDUPE:
        return this._executeDedupeStep(step, records, context);
      case PipelineStepTypes.SORT:
        return this._executeSortStep(step, records, context);
      // Phase 1: Data Reshaping Operators
      case PipelineStepTypes.PIVOT:
        return this._executePivotStep(step, records, context);
      case PipelineStepTypes.UNPIVOT:
        return this._executeUnpivotStep(step, records, context);
      case PipelineStepTypes.INDEX:
        return this._executeIndexStep(step, records, context);
      case PipelineStepTypes.FILL:
        return this._executeFillStep(step, records, context);
      case PipelineStepTypes.TRANSPOSE:
        return this._executeTransposeStep(step, records, context);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Execute a source step - pull records from a source
   */
  _executeSourceStep(step, existingRecords, context) {
    const source = this.sources.find(s => s.id === step.config.sourceId);
    if (!source) {
      throw new Error(`Source not found: ${step.config.sourceId}`);
    }

    const sourceRecords = source.records || [];
    const newRecords = sourceRecords.map((rec, idx) => {
      const newRec = {
        id: `rec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
        values: { ...rec },
        _pipeline: {
          sourceId: source.id,
          sourceIndex: idx,
          addedByStep: step.id
        }
      };

      // Add source reference field if configured
      if (step.config.includeSourceRef) {
        newRec.values._sourceId = source.id;
        newRec.values._sourceName = source.name || source.payload?.name;
      }

      return newRec;
    });

    return {
      records: [...existingRecords, ...newRecords],
      stats: {
        added: newRecords.length,
        fromSource: source.id
      }
    };
  }

  /**
   * Execute a merge step - layer in source data by matching key
   */
  _executeMergeStep(step, records, context) {
    const source = this.sources.find(s => s.id === step.config.sourceId);
    if (!source) {
      throw new Error(`Merge source not found: ${step.config.sourceId}`);
    }

    const sourceRecords = source.records || [];
    const config = step.config;
    const changes = [];
    let matchCount = 0;
    let addCount = 0;

    // Build lookup map for existing records
    const recordsByKey = new Map();
    records.forEach(rec => {
      const key = this._buildMatchKey(rec.values, config.matchFields);
      if (key) {
        if (!recordsByKey.has(key)) {
          recordsByKey.set(key, []);
        }
        recordsByKey.get(key).push(rec);
      }
    });

    // Process source records
    const unmatchedSourceRecords = [];

    sourceRecords.forEach((srcRec, srcIdx) => {
      const srcKey = this._buildMatchKey(srcRec, config.matchFields);

      if (srcKey && recordsByKey.has(srcKey)) {
        // Found matching records - merge values
        const matchingRecords = recordsByKey.get(srcKey);
        matchingRecords.forEach(existingRec => {
          const mergeResult = this._mergeRecordValues(
            existingRec.values,
            srcRec,
            config
          );

          if (mergeResult.changed) {
            changes.push({
              recordId: existingRec.id,
              matchKey: srcKey,
              fieldsChanged: mergeResult.fieldsChanged
            });
          }

          existingRec.values = mergeResult.values;
          existingRec._pipeline = existingRec._pipeline || {};
          existingRec._pipeline.mergedFrom = existingRec._pipeline.mergedFrom || [];
          existingRec._pipeline.mergedFrom.push({
            sourceId: source.id,
            sourceIndex: srcIdx,
            stepId: step.id
          });
        });
        matchCount++;
      } else if (config.addUnmatched) {
        // No match - add as new record
        unmatchedSourceRecords.push({
          id: `rec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
          values: { ...srcRec },
          _pipeline: {
            sourceId: source.id,
            sourceIndex: srcIdx,
            addedByStep: step.id,
            matchKey: srcKey,
            wasUnmatched: true
          }
        });
        addCount++;
      }
    });

    return {
      records: [...records, ...unmatchedSourceRecords],
      changes,
      stats: {
        matched: matchCount,
        added: addCount,
        sourceRecords: sourceRecords.length
      }
    };
  }

  /**
   * Build a match key from record values
   */
  _buildMatchKey(values, matchFields) {
    if (!matchFields || matchFields.length === 0) return null;

    const parts = matchFields.map(mf => {
      const fieldName = typeof mf === 'string' ? mf : mf.field;
      const normalize = typeof mf === 'string' ? 'string' : (mf.normalize || 'string');

      let value = values[fieldName];

      // Apply normalization
      if (NormalizationFunctions[`normalize${normalize.charAt(0).toUpperCase() + normalize.slice(1)}`]) {
        value = NormalizationFunctions[`normalize${normalize.charAt(0).toUpperCase() + normalize.slice(1)}`](value);
      } else {
        value = NormalizationFunctions.normalizeString(value);
      }

      return value;
    });

    return parts.join('|');
  }

  /**
   * Merge values from source into existing record
   */
  _mergeRecordValues(existingValues, sourceValues, config) {
    const result = { ...existingValues };
    const fieldsChanged = [];
    let changed = false;

    Object.keys(sourceValues).forEach(field => {
      const sourceValue = sourceValues[field];
      const existingValue = existingValues[field];
      const strategy = config.fieldStrategies[field] || config.defaultStrategy;

      let newValue = existingValue;

      switch (strategy) {
        case MergeStrategies.KEEP_FIRST:
          // Keep existing if not empty
          if (existingValue == null || existingValue === '') {
            newValue = sourceValue;
          }
          break;

        case MergeStrategies.KEEP_LAST:
          // Always use source value if not empty
          if (sourceValue != null && sourceValue !== '') {
            newValue = sourceValue;
          }
          break;

        case MergeStrategies.PREFER_NON_EMPTY:
          // Use whichever is non-empty, preferring existing
          if (existingValue == null || existingValue === '') {
            newValue = sourceValue;
          }
          break;

        case MergeStrategies.CONCAT:
          // Concatenate values
          if (sourceValue != null && sourceValue !== '') {
            if (existingValue != null && existingValue !== '') {
              newValue = `${existingValue}${config.concatSeparator}${sourceValue}`;
            } else {
              newValue = sourceValue;
            }
          }
          break;

        case MergeStrategies.SUM:
          newValue = (Number(existingValue) || 0) + (Number(sourceValue) || 0);
          break;

        case MergeStrategies.MAX:
          newValue = Math.max(Number(existingValue) || -Infinity, Number(sourceValue) || -Infinity);
          if (!isFinite(newValue)) newValue = null;
          break;

        case MergeStrategies.MIN:
          newValue = Math.min(Number(existingValue) || Infinity, Number(sourceValue) || Infinity);
          if (!isFinite(newValue)) newValue = null;
          break;

        case MergeStrategies.COLLECT_ARRAY:
          const existing = Array.isArray(existingValue) ? existingValue :
                          (existingValue != null ? [existingValue] : []);
          if (sourceValue != null && sourceValue !== '') {
            newValue = [...existing, sourceValue];
          } else {
            newValue = existing;
          }
          break;

        default:
          // Default to preferNonEmpty
          if (existingValue == null || existingValue === '') {
            newValue = sourceValue;
          }
      }

      if (newValue !== existingValue) {
        result[field] = newValue;
        fieldsChanged.push({
          field,
          oldValue: existingValue,
          newValue,
          strategy
        });
        changed = true;
      }
    });

    return { values: result, changed, fieldsChanged };
  }

  /**
   * Execute a filter step
   */
  _executeFilterStep(step, records, context) {
    const config = step.config;
    const removedCount = records.length;

    const filtered = records.filter(rec => {
      const matches = this._evaluateConditions(rec.values, config.conditions, config.logic);
      return config.invert ? !matches : matches;
    });

    return {
      records: filtered,
      stats: {
        before: removedCount,
        after: filtered.length,
        removed: removedCount - filtered.length
      }
    };
  }

  /**
   * Evaluate filter conditions against record values
   */
  _evaluateConditions(values, conditions, logic = 'and') {
    if (!conditions || conditions.length === 0) return true;

    const results = conditions.map(cond => {
      const value = values[cond.field];
      return this._evaluateCondition(value, cond.operator, cond.value);
    });

    if (logic === 'or') {
      return results.some(r => r);
    }
    return results.every(r => r);
  }

  /**
   * Evaluate a single condition
   */
  _evaluateCondition(value, operator, compareValue) {
    const strValue = String(value ?? '').toLowerCase();
    const strCompare = String(compareValue ?? '').toLowerCase();

    switch (operator) {
      case FilterOperators.EQUALS:
        return strValue === strCompare;
      case FilterOperators.NOT_EQUALS:
        return strValue !== strCompare;
      case FilterOperators.CONTAINS:
        return strValue.includes(strCompare);
      case FilterOperators.NOT_CONTAINS:
        return !strValue.includes(strCompare);
      case FilterOperators.STARTS_WITH:
        return strValue.startsWith(strCompare);
      case FilterOperators.ENDS_WITH:
        return strValue.endsWith(strCompare);
      case FilterOperators.IS_EMPTY:
        return value == null || value === '';
      case FilterOperators.IS_NOT_EMPTY:
        return value != null && value !== '';
      case FilterOperators.GREATER_THAN:
        return Number(value) > Number(compareValue);
      case FilterOperators.LESS_THAN:
        return Number(value) < Number(compareValue);
      case FilterOperators.GREATER_OR_EQUAL:
        return Number(value) >= Number(compareValue);
      case FilterOperators.LESS_OR_EQUAL:
        return Number(value) <= Number(compareValue);
      case FilterOperators.IN:
        const inList = Array.isArray(compareValue) ? compareValue : String(compareValue).split(',').map(s => s.trim().toLowerCase());
        return inList.includes(strValue);
      case FilterOperators.NOT_IN:
        const notInList = Array.isArray(compareValue) ? compareValue : String(compareValue).split(',').map(s => s.trim().toLowerCase());
        return !notInList.includes(strValue);
      case FilterOperators.MATCHES_REGEX:
        try {
          return new RegExp(compareValue, 'i').test(String(value));
        } catch {
          return false;
        }
      default:
        return true;
    }
  }

  /**
   * Execute a transform step
   */
  _executeTransformStep(step, records, context) {
    const config = step.config;
    let transformCount = 0;

    const transformed = records.map(rec => {
      const newValues = { ...rec.values };
      let changed = false;

      (config.transformations || []).forEach(transform => {
        const result = this._applyTransformation(newValues, transform);
        if (result.changed) {
          changed = true;
          Object.assign(newValues, result.values);
        }
      });

      if (changed) {
        transformCount++;
        return { ...rec, values: newValues };
      }
      return rec;
    });

    return {
      records: transformed,
      stats: {
        transformed: transformCount
      }
    };
  }

  /**
   * Apply a single transformation
   */
  _applyTransformation(values, transform) {
    const { field, operation, params } = transform;
    let newValue = values[field];
    let changed = false;

    switch (operation) {
      case 'uppercase':
        newValue = String(newValue ?? '').toUpperCase();
        changed = true;
        break;
      case 'lowercase':
        newValue = String(newValue ?? '').toLowerCase();
        changed = true;
        break;
      case 'trim':
        newValue = String(newValue ?? '').trim();
        changed = true;
        break;
      case 'replace':
        newValue = String(newValue ?? '').replace(
          new RegExp(params.find, params.flags || 'g'),
          params.replace || ''
        );
        changed = true;
        break;
      case 'prefix':
        newValue = params.prefix + String(newValue ?? '');
        changed = true;
        break;
      case 'suffix':
        newValue = String(newValue ?? '') + params.suffix;
        changed = true;
        break;
      case 'setField':
        newValue = params.value;
        changed = true;
        break;
      case 'copyField':
        newValue = values[params.sourceField];
        changed = true;
        break;
      case 'extractJson':
        try {
          const json = typeof values[params.sourceField] === 'string'
            ? JSON.parse(values[params.sourceField])
            : values[params.sourceField];
          newValue = this._getNestedValue(json, params.path);
          changed = true;
        } catch {
          newValue = null;
        }
        break;
    }

    return {
      values: { [field]: newValue },
      changed
    };
  }

  /**
   * Get nested value from object by path
   */
  _getNestedValue(obj, path) {
    if (!obj || !path) return null;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current == null) return null;
      current = current[part];
    }
    return current;
  }

  /**
   * Execute a dedupe step
   */
  _executeDedupeStep(step, records, context) {
    const config = step.config;
    const recordsByKey = new Map();
    const duplicateGroups = [];

    // Group records by match key
    records.forEach(rec => {
      const key = this._buildMatchKey(rec.values, config.matchFields.map(f => ({
        field: f,
        normalize: config.normalize
      })));

      if (!recordsByKey.has(key)) {
        recordsByKey.set(key, []);
      }
      recordsByKey.get(key).push(rec);
    });

    // Merge each group into single record
    const dedupedRecords = [];

    recordsByKey.forEach((group, key) => {
      if (group.length === 1) {
        dedupedRecords.push(group[0]);
      } else {
        // Multiple records - merge them
        duplicateGroups.push({ key, count: group.length });

        const merged = this._mergeRecordGroup(group, config);
        dedupedRecords.push(merged);
      }
    });

    return {
      records: dedupedRecords,
      stats: {
        before: records.length,
        after: dedupedRecords.length,
        duplicateGroups: duplicateGroups.length,
        merged: records.length - dedupedRecords.length
      }
    };
  }

  /**
   * Merge a group of duplicate records
   */
  _mergeRecordGroup(group, config) {
    if (group.length === 0) return null;
    if (group.length === 1) return group[0];

    // Start with first record
    const base = { ...group[0], values: { ...group[0].values } };

    // Merge in remaining records
    for (let i = 1; i < group.length; i++) {
      const mergeResult = this._mergeRecordValues(
        base.values,
        group[i].values,
        {
          fieldStrategies: config.fieldStrategies,
          defaultStrategy: config.mergeStrategy,
          concatSeparator: ', '
        }
      );
      base.values = mergeResult.values;
    }

    base._pipeline = base._pipeline || {};
    base._pipeline.deduped = {
      originalCount: group.length,
      mergedRecordIds: group.map(r => r.id)
    };

    return base;
  }

  /**
   * Execute a sort step
   */
  _executeSortStep(step, records, context) {
    const config = step.config;

    const sorted = [...records].sort((a, b) => {
      for (const sortDef of config.sorts || []) {
        const aVal = a.values[sortDef.field];
        const bVal = b.values[sortDef.field];

        let comparison = 0;
        if (aVal == null && bVal == null) comparison = 0;
        else if (aVal == null) comparison = 1;
        else if (bVal == null) comparison = -1;
        else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }

        if (comparison !== 0) {
          return sortDef.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });

    return {
      records: sorted,
      stats: {
        sorted: sorted.length
      }
    };
  }

  // ==========================================================================
  // Phase 1: Data Reshaping Operators
  // ==========================================================================

  /**
   * Execute a pivot step - reshape from long to wide format
   * Converts rows to columns based on attribute values
   *
   * Example: Sales data with columns [Region, Product, Amount]
   * After PIVOT on Product: [Region, ProductA, ProductB, ProductC]
   */
  _executePivotStep(step, records, context) {
    const config = step.config;
    const {
      groupBy = [],
      attributeColumn,
      valueColumn,
      aggregateFunction = 'FIRST'
    } = config;

    if (!attributeColumn || !valueColumn) {
      throw new Error('PIVOT requires attributeColumn and valueColumn');
    }

    // Discover all unique attribute values (these become column headers)
    const attributeValues = new Set();
    records.forEach(rec => {
      const attrVal = rec.values[attributeColumn];
      if (attrVal != null && attrVal !== '') {
        attributeValues.add(String(attrVal));
      }
    });

    // Group records by groupBy fields
    const groups = new Map();
    records.forEach(rec => {
      const groupKey = groupBy.length > 0
        ? this._buildMatchKey(rec.values, groupBy.map(f => ({ field: f, normalize: 'string' })))
        : '__all__';

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupValues: {},
          attributeMap: new Map()
        });
        // Copy groupBy field values
        groupBy.forEach(f => {
          groups.get(groupKey).groupValues[f] = rec.values[f];
        });
      }

      const attrVal = String(rec.values[attributeColumn] ?? '');
      const value = rec.values[valueColumn];

      if (!groups.get(groupKey).attributeMap.has(attrVal)) {
        groups.get(groupKey).attributeMap.set(attrVal, []);
      }
      if (value != null) {
        groups.get(groupKey).attributeMap.get(attrVal).push(value);
      }
    });

    // Build pivoted records
    const pivotedRecords = [];
    groups.forEach((group, groupKey) => {
      const newRec = {
        id: `rec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
        values: { ...group.groupValues },
        _pipeline: {
          pivotedByStep: step.id,
          groupKey
        }
      };

      // Add a column for each attribute value
      attributeValues.forEach(attrVal => {
        const values = group.attributeMap.get(attrVal) || [];
        newRec.values[attrVal] = this._aggregateValues(values, aggregateFunction);
      });

      pivotedRecords.push(newRec);
    });

    return {
      records: pivotedRecords,
      stats: {
        before: records.length,
        after: pivotedRecords.length,
        columnsCreated: attributeValues.size,
        groupCount: groups.size
      }
    };
  }

  /**
   * Execute an unpivot step - reshape from wide to long format
   * Converts columns to rows
   *
   * Example: Data with columns [Name, Jan, Feb, Mar]
   * After UNPIVOT on [Jan, Feb, Mar]: [Name, Month, Value]
   */
  _executeUnpivotStep(step, records, context) {
    const config = step.config;
    const {
      columnsToUnpivot = [],
      attributeColumnName = 'Attribute',
      valueColumnName = 'Value',
      excludeNulls = true
    } = config;

    if (!columnsToUnpivot || columnsToUnpivot.length === 0) {
      throw new Error('UNPIVOT requires columnsToUnpivot');
    }

    const unpivotedRecords = [];

    // Identify columns to keep (not in columnsToUnpivot)
    const allColumns = new Set();
    records.forEach(rec => {
      Object.keys(rec.values || {}).forEach(k => allColumns.add(k));
    });
    const keepColumns = [...allColumns].filter(c => !columnsToUnpivot.includes(c));

    records.forEach((rec, recIdx) => {
      columnsToUnpivot.forEach(col => {
        const value = rec.values[col];

        // Skip null/empty if configured
        if (excludeNulls && (value == null || value === '')) {
          return;
        }

        const newRec = {
          id: `rec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
          values: {},
          _pipeline: {
            unpivotedByStep: step.id,
            sourceRecordIndex: recIdx,
            sourceColumn: col
          }
        };

        // Copy kept columns
        keepColumns.forEach(k => {
          newRec.values[k] = rec.values[k];
        });

        // Add attribute and value columns
        newRec.values[attributeColumnName] = col;
        newRec.values[valueColumnName] = value;

        unpivotedRecords.push(newRec);
      });
    });

    return {
      records: unpivotedRecords,
      stats: {
        before: records.length,
        after: unpivotedRecords.length,
        columnsUnpivoted: columnsToUnpivot.length
      }
    };
  }

  /**
   * Execute an index step - add row index as field
   */
  _executeIndexStep(step, records, context) {
    const config = step.config;
    const {
      fieldName = '__row_index',
      startFrom = 0,
      step: stepIncrement = 1
    } = config;

    const indexedRecords = records.map((rec, idx) => {
      return {
        ...rec,
        values: {
          ...rec.values,
          [fieldName]: startFrom + (idx * stepIncrement)
        },
        _pipeline: {
          ...rec._pipeline,
          indexedByStep: step.id
        }
      };
    });

    return {
      records: indexedRecords,
      stats: {
        indexed: indexedRecords.length,
        fieldName,
        startFrom,
        step: stepIncrement
      }
    };
  }

  /**
   * Execute a fill step - fill down/up missing values
   */
  _executeFillStep(step, records, context) {
    const config = step.config;
    const {
      fields = [],
      direction = 'down',
      treatAsEmpty = [null, '', undefined]
    } = config;

    if (!fields || fields.length === 0) {
      throw new Error('FILL requires fields to fill');
    }

    // Helper to check if value is empty
    const isEmpty = (val) => treatAsEmpty.includes(val);

    // Clone records for modification
    const filledRecords = records.map(rec => ({
      ...rec,
      values: { ...rec.values }
    }));

    let fillCount = 0;

    fields.forEach(field => {
      if (direction === 'down') {
        // Fill down - carry value forward
        let lastValue = null;
        filledRecords.forEach((rec, idx) => {
          const currentValue = rec.values[field];
          if (isEmpty(currentValue)) {
            if (lastValue !== null) {
              rec.values[field] = lastValue;
              fillCount++;
              rec._pipeline = rec._pipeline || {};
              rec._pipeline.filledFields = rec._pipeline.filledFields || [];
              rec._pipeline.filledFields.push({ field, direction, fromIndex: idx - 1 });
            }
          } else {
            lastValue = currentValue;
          }
        });
      } else if (direction === 'up') {
        // Fill up - carry value backward
        let lastValue = null;
        for (let i = filledRecords.length - 1; i >= 0; i--) {
          const rec = filledRecords[i];
          const currentValue = rec.values[field];
          if (isEmpty(currentValue)) {
            if (lastValue !== null) {
              rec.values[field] = lastValue;
              fillCount++;
              rec._pipeline = rec._pipeline || {};
              rec._pipeline.filledFields = rec._pipeline.filledFields || [];
              rec._pipeline.filledFields.push({ field, direction, fromIndex: i + 1 });
            }
          } else {
            lastValue = currentValue;
          }
        }
      }
    });

    return {
      records: filledRecords,
      stats: {
        fillCount,
        fields: fields.length,
        direction
      }
    };
  }

  /**
   * Execute a transpose step - swap rows and columns
   */
  _executeTransposeStep(step, records, context) {
    const config = step.config;
    const { headerField } = config;

    if (records.length === 0) {
      return { records: [], stats: { transposed: false, reason: 'empty input' } };
    }

    // Get all field names from all records
    const allFields = new Set();
    records.forEach(rec => {
      Object.keys(rec.values || {}).forEach(k => allFields.add(k));
    });
    const fieldList = [...allFields];

    // If headerField specified, use it for column names; otherwise use row indices
    const columnHeaders = headerField
      ? records.map(rec => String(rec.values[headerField] ?? `col_${records.indexOf(rec)}`))
      : records.map((_, idx) => `col_${idx}`);

    // Filter out headerField from transposition if specified
    const fieldsToTranspose = headerField
      ? fieldList.filter(f => f !== headerField)
      : fieldList;

    // Create transposed records - one for each original field
    const transposedRecords = fieldsToTranspose.map((field, idx) => {
      const newRec = {
        id: `rec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
        values: {
          __field_name: field  // First column contains original field names
        },
        _pipeline: {
          transposedByStep: step.id,
          originalField: field
        }
      };

      // Add value from each original record as a new column
      records.forEach((rec, recIdx) => {
        newRec.values[columnHeaders[recIdx]] = rec.values[field];
      });

      return newRec;
    });

    return {
      records: transposedRecords,
      stats: {
        beforeRows: records.length,
        beforeCols: fieldsToTranspose.length,
        afterRows: transposedRecords.length,
        afterCols: columnHeaders.length + 1  // +1 for __field_name
      }
    };
  }

  /**
   * Helper: Aggregate values using specified function
   */
  _aggregateValues(values, func) {
    if (!values || values.length === 0) return null;

    switch (func.toUpperCase()) {
      case 'FIRST':
        return values[0];
      case 'LAST':
        return values[values.length - 1];
      case 'SUM':
        return values.reduce((acc, v) => acc + (Number(v) || 0), 0);
      case 'AVG':
        const nums = values.map(v => Number(v)).filter(n => !isNaN(n));
        return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
      case 'COUNT':
        return values.length;
      case 'MIN':
        const mins = values.map(v => Number(v)).filter(n => !isNaN(n));
        return mins.length > 0 ? Math.min(...mins) : null;
      case 'MAX':
        const maxs = values.map(v => Number(v)).filter(n => !isNaN(n));
        return maxs.length > 0 ? Math.max(...maxs) : null;
      default:
        return values[0];
    }
  }
}

// ============================================================================
// Pipeline Manager - Integration with Sets
// ============================================================================

class PipelineManager {
  constructor(workbench) {
    this.workbench = workbench;
  }

  /**
   * Get the pipeline for a set
   */
  getPipeline(setId) {
    const set = this.workbench.sets?.find(s => s.id === setId);
    if (!set) return null;

    // Initialize pipeline if not exists
    if (!set.pipeline) {
      set.pipeline = {
        steps: [],
        history: [],
        lastExecutedAt: null
      };
    }

    return set.pipeline;
  }

  /**
   * Add a step to a set's pipeline
   */
  addStep(setId, step, position = -1) {
    const pipeline = this.getPipeline(setId);
    if (!pipeline) return false;

    if (position < 0 || position >= pipeline.steps.length) {
      pipeline.steps.push(step);
    } else {
      pipeline.steps.splice(position, 0, step);
    }

    this._logActivity(setId, 'step_added', { stepId: step.id, stepType: step.type });
    return true;
  }

  /**
   * Remove a step from a set's pipeline
   */
  removeStep(setId, stepId) {
    const pipeline = this.getPipeline(setId);
    if (!pipeline) return false;

    const idx = pipeline.steps.findIndex(s => s.id === stepId);
    if (idx === -1) return false;

    const removed = pipeline.steps.splice(idx, 1)[0];
    this._logActivity(setId, 'step_removed', { stepId, stepType: removed.type });
    return true;
  }

  /**
   * Update a step's configuration
   */
  updateStep(setId, stepId, updates) {
    const pipeline = this.getPipeline(setId);
    if (!pipeline) return false;

    const step = pipeline.steps.find(s => s.id === stepId);
    if (!step) return false;

    Object.assign(step.config, updates.config || {});
    if (updates.enabled !== undefined) step.enabled = updates.enabled;
    if (updates.note !== undefined) step.note = updates.note;
    step.updatedAt = new Date().toISOString();

    this._logActivity(setId, 'step_updated', { stepId, stepType: step.type });
    return true;
  }

  /**
   * Reorder steps in the pipeline
   */
  reorderSteps(setId, stepIds) {
    const pipeline = this.getPipeline(setId);
    if (!pipeline) return false;

    const stepMap = new Map(pipeline.steps.map(s => [s.id, s]));
    pipeline.steps = stepIds.map(id => stepMap.get(id)).filter(Boolean);

    this._logActivity(setId, 'steps_reordered', { order: stepIds });
    return true;
  }

  /**
   * Toggle a step's enabled state
   */
  toggleStep(setId, stepId) {
    const pipeline = this.getPipeline(setId);
    if (!pipeline) return false;

    const step = pipeline.steps.find(s => s.id === stepId);
    if (!step) return false;

    step.enabled = !step.enabled;
    step.updatedAt = new Date().toISOString();

    this._logActivity(setId, 'step_toggled', { stepId, enabled: step.enabled });
    return true;
  }

  /**
   * Execute the pipeline for a set
   */
  execute(setId, options = {}) {
    const set = this.workbench.sets?.find(s => s.id === setId);
    if (!set) return { success: false, error: 'Set not found' };

    const pipeline = this.getPipeline(setId);
    if (!pipeline || pipeline.steps.length === 0) {
      return { success: true, records: set.records || [], message: 'No pipeline steps' };
    }

    const executor = new PipelineExecutor({
      sources: this.workbench.sources || [],
      sets: this.workbench.sets || [],
      onProgress: options.onProgress
    });

    // Start with empty records (source steps will populate)
    const result = executor.execute(pipeline.steps, [], {
      setId,
      stopOnError: options.stopOnError
    });

    // Update set records with pipeline output
    if (result.errors.length === 0 || !options.stopOnError) {
      // Remap values to field IDs if needed
      const remappedRecords = this._remapRecordsToFieldIds(result.records, set);
      set.records = remappedRecords;
      set.updatedAt = new Date().toISOString();
    }

    // Store execution history
    pipeline.history.push({
      executedAt: new Date().toISOString(),
      stepResults: result.history,
      errors: result.errors,
      inputCount: 0,
      outputCount: result.records.length
    });

    // Keep only last 50 executions
    if (pipeline.history.length > 50) {
      pipeline.history = pipeline.history.slice(-50);
    }

    pipeline.lastExecutedAt = new Date().toISOString();

    this._logActivity(setId, 'pipeline_executed', {
      stepCount: pipeline.steps.length,
      recordCount: result.records.length,
      errors: result.errors.length
    });

    return {
      success: result.errors.length === 0,
      records: result.records,
      history: result.history,
      errors: result.errors
    };
  }

  /**
   * Remap record values to use field IDs instead of field names
   */
  _remapRecordsToFieldIds(records, set) {
    if (!set.fields || set.fields.length === 0) return records;

    // Build name-to-id mapping
    const fieldNameToId = new Map();
    set.fields.forEach(field => {
      fieldNameToId.set(field.name.toLowerCase(), field.id);
      if (field.sourceColumn) {
        fieldNameToId.set(field.sourceColumn.toLowerCase(), field.id);
      }
    });

    return records.map(rec => {
      const newValues = {};

      Object.entries(rec.values || {}).forEach(([key, value]) => {
        // Check if key is already a field ID
        const isFieldId = set.fields.some(f => f.id === key);
        if (isFieldId) {
          newValues[key] = value;
        } else {
          // Try to map by name
          const fieldId = fieldNameToId.get(key.toLowerCase());
          if (fieldId) {
            newValues[fieldId] = value;
          } else {
            // Keep as-is (might be a new field)
            newValues[key] = value;
          }
        }
      });

      return {
        ...rec,
        setId: set.id,
        values: newValues
      };
    });
  }

  /**
   * Preview what a step would do without executing
   */
  previewStep(setId, step, afterStepId = null) {
    const pipeline = this.getPipeline(setId);
    if (!pipeline) return null;

    // Build list of steps to execute up to the preview point
    const stepsToRun = [];
    for (const s of pipeline.steps) {
      if (afterStepId && s.id === afterStepId) {
        stepsToRun.push(s);
        break;
      }
      stepsToRun.push(s);
    }

    // Add the preview step
    stepsToRun.push(step);

    const executor = new PipelineExecutor({
      sources: this.workbench.sources || [],
      sets: this.workbench.sets || []
    });

    const result = executor.execute(stepsToRun, [], { setId });

    return {
      records: result.records,
      stats: result.history[result.history.length - 1]?.stats || {},
      changes: result.history[result.history.length - 1]?.changes || []
    };
  }

  /**
   * Quick merge: Add a merge step and execute
   */
  quickMerge(setId, sourceId, matchFields, options = {}) {
    const step = createMergeStep(sourceId, {
      matchFields,
      ...options
    });

    this.addStep(setId, step);
    return this.execute(setId);
  }

  /**
   * Log activity for audit trail
   */
  _logActivity(setId, action, details) {
    if (this.workbench._logActivity) {
      this.workbench._logActivity(action, {
        setId,
        ...details
      });
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

// Make available globally
if (typeof window !== 'undefined') {
  window.PipelineStepTypes = PipelineStepTypes;
  window.PipelineStepIcons = PipelineStepIcons;
  window.MergeStrategies = MergeStrategies;
  window.MergeStrategyLabels = MergeStrategyLabels;
  window.FilterOperators = FilterOperators;
  window.NormalizationFunctions = NormalizationFunctions;
  window.createPipelineStep = createPipelineStep;
  window.createSourceStep = createSourceStep;
  window.createMergeStep = createMergeStep;
  window.createFilterStep = createFilterStep;
  window.createTransformStep = createTransformStep;
  window.createDedupeStep = createDedupeStep;
  // Phase 1: Data Reshaping Step Factories
  window.createPivotStep = createPivotStep;
  window.createUnpivotStep = createUnpivotStep;
  window.createIndexStep = createIndexStep;
  window.createFillStep = createFillStep;
  window.createTransposeStep = createTransposeStep;
  window.PipelineExecutor = PipelineExecutor;
  window.PipelineManager = PipelineManager;
}
