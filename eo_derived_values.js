/**
 * EO Derived Values - First-Class Value Artifacts
 *
 * EO AXIOM (ENFORCED):
 * Aggregations, metrics, and computed results are NEVER embedded inside Meant events.
 * They exist ONLY as derived_value events.
 *
 * CRITICAL RULES:
 * - AGGREGATE and COMPUTE operators can ONLY produce derived_value events
 * - Insights reference derived values, never embed them
 * - Confidence is a derived_value, not an embedded number
 * - All derived values have computational grounding
 *
 * This module provides:
 * - Aggregation execution and result tracking
 * - First-class value artifacts
 * - Confidence assessment as derived values
 * - Insight creation that references (not embeds) values
 */

// ============================================================================
// Value Categories
// ============================================================================

/**
 * Categories of derived values
 */
const DerivedValueCategory = Object.freeze({
  AGGREGATION_RESULT: 'aggregation_result',
  COMPUTED_VALUE: 'computed_value',
  CONFIDENCE_SCORE: 'confidence_score',
  METRIC: 'metric',
  STATISTIC: 'statistic'
});

// ============================================================================
// Aggregation Execution
// ============================================================================

/**
 * AggregationExecution - Records the execution of an aggregation
 *
 * This is a MEANT event that documents the aggregation being performed.
 * The actual result is stored in a separate DERIVED_VALUE event.
 */
class AggregationExecution {
  /**
   * @param {Object} options
   * @param {string} options.setEventId - The set being aggregated
   * @param {Array} options.operators - The operator chain
   * @param {Object} options.filters - Any filters applied before aggregation
   * @param {string} options.aggregationFn - The aggregation function (COUNT, SUM, etc.)
   * @param {string} options.field - The field being aggregated (if applicable)
   */
  constructor(options) {
    this.id = options.id || generateId('agg_exec');
    this.setEventId = options.setEventId;

    // Operator chain
    this.operators = options.operators || [];

    // Filters applied
    this.filters = options.filters || [];

    // Aggregation function
    this.aggregationFn = options.aggregationFn;
    this.field = options.field || null;

    // Group by (if applicable)
    this.groupBy = options.groupBy || null;

    // Execution timestamp
    this.executedAt = options.executedAt || new Date().toISOString();
    this.executedBy = options.executedBy || 'system';

    Object.freeze(this.operators);
    Object.freeze(this.filters);
  }

  /**
   * Generate grounding for this execution
   */
  getGrounding() {
    return {
      references: [
        { eventId: this.setEventId, kind: 'computational' }
      ],
      derivation: {
        operators: this.operators,
        inputs: {
          setId: this.setEventId,
          field: this.field
        },
        frozenParams: {
          filters: this.filters,
          aggregationFn: this.aggregationFn,
          groupBy: this.groupBy
        }
      }
    };
  }

  /**
   * Create MEANT event for this execution
   */
  toMeantEvent(actor = 'system') {
    return {
      id: this.id,
      epistemicType: 'meant',
      category: 'aggregation_executed',
      timestamp: this.executedAt,
      actor,
      grounding: this.getGrounding(),
      frame: {
        claim: `Executed ${this.aggregationFn} aggregation on ${this.field || 'records'}`,
        epistemicStatus: 'confirmed',
        purpose: 'aggregation_execution'
      },
      payload: {
        setEventId: this.setEventId,
        aggregationFn: this.aggregationFn,
        field: this.field,
        filters: this.filters,
        groupBy: this.groupBy
      }
    };
  }

  toJSON() {
    return {
      id: this.id,
      setEventId: this.setEventId,
      operators: [...this.operators],
      filters: [...this.filters],
      aggregationFn: this.aggregationFn,
      field: this.field,
      groupBy: this.groupBy,
      executedAt: this.executedAt,
      executedBy: this.executedBy
    };
  }
}

// ============================================================================
// Aggregation Result (Derived Value)
// ============================================================================

/**
 * AggregationResult - First-class value artifact for aggregation results
 *
 * This is a DERIVED_VALUE event that stores the computed result.
 * It is separate from the execution event.
 */
class AggregationResult {
  /**
   * @param {Object} options
   * @param {string} options.executionEventId - The execution event that produced this
   * @param {string} options.metric - Name of the metric
   * @param {*} options.value - The computed value
   * @param {string} options.unit - Unit of measurement (if applicable)
   * @param {string} options.valueType - Type of value (number, date, etc.)
   */
  constructor(options) {
    this.id = options.id || generateId('value');
    this.executionEventId = options.executionEventId;

    // The result
    this.metric = options.metric;
    this.value = options.value;
    this.unit = options.unit || null;
    this.valueType = options.valueType || typeof options.value;

    // For grouped aggregations
    this.groupKey = options.groupKey || null;
    this.groupValue = options.groupValue || null;

    // Timestamp
    this.computedAt = options.computedAt || new Date().toISOString();
  }

  /**
   * Generate grounding for this result
   */
  getGrounding() {
    return {
      references: [
        { eventId: this.executionEventId, kind: 'computational' }
      ],
      derivation: {
        operators: [{ op: 'aggregate', params: { fn: this.metric } }],
        inputs: { executionEventId: this.executionEventId },
        frozenParams: {}
      }
    };
  }

  /**
   * Create DERIVED_VALUE event for this result
   */
  toDerivedValueEvent(actor = 'system') {
    return {
      id: this.id,
      epistemicType: 'derived_value',
      category: DerivedValueCategory.AGGREGATION_RESULT,
      timestamp: this.computedAt,
      actor,
      grounding: this.getGrounding(),
      payload: {
        metric: this.metric,
        value: this.value,
        unit: this.unit,
        valueType: this.valueType,
        groupKey: this.groupKey,
        groupValue: this.groupValue
      }
    };
  }

  toJSON() {
    return {
      id: this.id,
      executionEventId: this.executionEventId,
      metric: this.metric,
      value: this.value,
      unit: this.unit,
      valueType: this.valueType,
      groupKey: this.groupKey,
      groupValue: this.groupValue,
      computedAt: this.computedAt
    };
  }
}

// ============================================================================
// Confidence Assessment (Derived Value)
// ============================================================================

/**
 * ConfidenceAssessment - Confidence score as a derived value
 *
 * CRITICAL: Confidence is NEVER embedded in other events.
 * It is always a separate DERIVED_VALUE event that can be referenced.
 */
class ConfidenceAssessment {
  /**
   * @param {Object} options
   * @param {string} options.assessedEventId - Event being assessed
   * @param {string} options.sourceEventId - Source data the assessment is based on
   * @param {Object} options.factors - Assessment factors
   * @param {number} options.confidence - Confidence score (0-1)
   * @param {string} options.label - Confidence label (low, medium, high)
   */
  constructor(options) {
    this.id = options.id || generateId('conf');
    this.assessedEventId = options.assessedEventId;
    this.sourceEventId = options.sourceEventId;

    // Assessment factors
    this.factors = {
      sourceAuthority: options.factors?.sourceAuthority || 'unknown',
      operatorPurity: options.factors?.operatorPurity || 'unknown',
      corroboration: options.factors?.corroboration || 'single_source',
      temporalDistance: options.factors?.temporalDistance || 'unknown',
      completeness: options.factors?.completeness || 'unknown'
    };

    // Computed score
    this.confidence = options.confidence;
    this.label = options.label || this._computeLabel(options.confidence);

    // Assessment metadata
    this.assessedAt = options.assessedAt || new Date().toISOString();
    this.assessedBy = options.assessedBy || 'system';
    this.methodology = options.methodology || 'default';

    Object.freeze(this.factors);
  }

  /**
   * Compute confidence label from score
   */
  _computeLabel(score) {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'very_low';
  }

  /**
   * Generate grounding for this assessment
   */
  getGrounding() {
    const references = [
      { eventId: this.assessedEventId, kind: 'computational' }
    ];

    if (this.sourceEventId) {
      references.push({ eventId: this.sourceEventId, kind: 'external' });
    }

    return {
      references,
      derivation: {
        operators: [{
          op: 'assess_confidence',
          params: this.factors
        }],
        inputs: {
          assessedEventId: this.assessedEventId,
          sourceEventId: this.sourceEventId
        },
        frozenParams: {
          methodology: this.methodology
        }
      }
    };
  }

  /**
   * Create DERIVED_VALUE event for this assessment
   */
  toDerivedValueEvent(actor = 'system') {
    return {
      id: this.id,
      epistemicType: 'derived_value',
      category: DerivedValueCategory.CONFIDENCE_SCORE,
      timestamp: this.assessedAt,
      actor,
      grounding: this.getGrounding(),
      payload: {
        confidence: this.confidence,
        label: this.label,
        factors: { ...this.factors },
        methodology: this.methodology
      }
    };
  }

  toJSON() {
    return {
      id: this.id,
      assessedEventId: this.assessedEventId,
      sourceEventId: this.sourceEventId,
      factors: { ...this.factors },
      confidence: this.confidence,
      label: this.label,
      assessedAt: this.assessedAt,
      assessedBy: this.assessedBy,
      methodology: this.methodology
    };
  }
}

// ============================================================================
// Insight (References Values, Never Embeds)
// ============================================================================

/**
 * Insight - A claim that references derived values
 *
 * CRITICAL: Insights NEVER embed values. They reference derived_value events.
 */
class Insight {
  /**
   * @param {Object} options
   * @param {string} options.claim - The claim being made
   * @param {string[]} options.valueEventIds - Derived value events this references
   * @param {string} options.schemaEventId - Schema event for context
   * @param {string} options.confidenceEventId - Confidence assessment event
   */
  constructor(options) {
    this.id = options.id || generateId('insight');
    this.claim = options.claim;

    // References to value events (NEVER embedded values)
    this.valueEventIds = options.valueEventIds || [];

    // Schema context
    this.schemaEventId = options.schemaEventId || null;

    // Confidence reference (NEVER embedded score)
    this.confidenceEventId = options.confidenceEventId || null;

    // Epistemic status
    this.epistemicStatus = options.epistemicStatus || 'preliminary';

    // Caveats
    this.caveats = options.caveats || [];

    // Metadata
    this.createdAt = options.createdAt || new Date().toISOString();
    this.createdBy = options.createdBy || 'system';

    Object.freeze(this.valueEventIds);
    Object.freeze(this.caveats);
  }

  /**
   * Generate grounding for this insight
   */
  getGrounding() {
    const references = [];

    // Add computational grounding from value events
    for (const valueId of this.valueEventIds) {
      references.push({ eventId: valueId, kind: 'computational' });
    }

    // Add semantic grounding from schema
    if (this.schemaEventId) {
      references.push({ eventId: this.schemaEventId, kind: 'semantic' });
    }

    return {
      references,
      derivation: null // Insights don't have operator chains
    };
  }

  /**
   * Create MEANT event for this insight
   */
  toMeantEvent(actor = 'system') {
    return {
      id: this.id,
      epistemicType: 'meant',
      category: 'insight',
      timestamp: this.createdAt,
      actor,
      grounding: this.getGrounding(),
      frame: {
        claim: this.claim,
        epistemicStatus: this.epistemicStatus,
        confidenceEvent: this.confidenceEventId, // Reference, not embedded
        caveats: this.caveats,
        purpose: 'insight'
      },
      payload: {
        valueEventIds: [...this.valueEventIds],
        schemaEventId: this.schemaEventId
      }
    };
  }

  toJSON() {
    return {
      id: this.id,
      claim: this.claim,
      valueEventIds: [...this.valueEventIds],
      schemaEventId: this.schemaEventId,
      confidenceEventId: this.confidenceEventId,
      epistemicStatus: this.epistemicStatus,
      caveats: [...this.caveats],
      createdAt: this.createdAt,
      createdBy: this.createdBy
    };
  }
}

// ============================================================================
// Aggregation Pipeline
// ============================================================================

/**
 * Execute an aggregation and create all required events
 *
 * Returns: { executionEvent, resultEvent }
 */
function executeAggregation(options) {
  const {
    setEventId,
    data,
    aggregationFn,
    field,
    filters,
    groupBy,
    actor
  } = options;

  // Create execution
  const execution = new AggregationExecution({
    setEventId,
    operators: [
      { op: 'source_derived', params: { setId: setEventId } },
      ...(filters ? [{ op: 'filter', params: { filters } }] : []),
      { op: 'aggregate', params: { fn: aggregationFn, field } }
    ],
    filters: filters || [],
    aggregationFn,
    field,
    groupBy,
    executedBy: actor
  });

  // Compute result
  const computedValue = computeAggregation(data, aggregationFn, field, filters);

  // Create result
  const result = new AggregationResult({
    executionEventId: execution.id,
    metric: `${aggregationFn}_${field || 'records'}`,
    value: computedValue,
    unit: inferUnit(aggregationFn, field),
    computedAt: execution.executedAt
  });

  return {
    executionEvent: execution.toMeantEvent(actor),
    resultEvent: result.toDerivedValueEvent(actor),
    execution,
    result
  };
}

/**
 * Compute aggregation value from data
 */
function computeAggregation(data, fn, field, filters) {
  let filtered = data;

  // Apply filters
  if (filters && filters.length > 0) {
    filtered = data.filter(row => {
      return filters.every(f => {
        const value = row[f.field];
        switch (f.operator) {
          case 'eq': return value === f.value;
          case 'neq': return value !== f.value;
          case 'gt': return value > f.value;
          case 'gte': return value >= f.value;
          case 'lt': return value < f.value;
          case 'lte': return value <= f.value;
          case 'contains': return String(value).includes(f.value);
          default: return true;
        }
      });
    });
  }

  // Compute aggregation
  switch (fn.toLowerCase()) {
    case 'count':
      return filtered.length;

    case 'sum':
      return filtered.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);

    case 'avg':
      const sum = filtered.reduce((s, row) => s + (Number(row[field]) || 0), 0);
      return filtered.length > 0 ? sum / filtered.length : 0;

    case 'min':
      const minVals = filtered.map(row => row[field]).filter(v => v != null);
      return minVals.length > 0 ? Math.min(...minVals) : null;

    case 'max':
      const maxVals = filtered.map(row => row[field]).filter(v => v != null);
      return maxVals.length > 0 ? Math.max(...maxVals) : null;

    case 'distinct':
      return new Set(filtered.map(row => row[field])).size;

    default:
      throw new Error(`Unknown aggregation function: ${fn}`);
  }
}

/**
 * Infer unit from aggregation type and field
 */
function inferUnit(fn, field) {
  const fnLower = fn.toLowerCase();
  if (fnLower === 'count' || fnLower === 'distinct') {
    return field ? `${field}_count` : 'count';
  }
  return null;
}

// ============================================================================
// Confidence Assessment Pipeline
// ============================================================================

/**
 * Assess confidence for an event
 */
function assessConfidence(options) {
  const {
    assessedEventId,
    sourceEventId,
    factors,
    methodology,
    actor
  } = options;

  // Compute confidence score from factors
  const score = computeConfidenceScore(factors);

  // Create assessment
  const assessment = new ConfidenceAssessment({
    assessedEventId,
    sourceEventId,
    factors,
    confidence: score,
    methodology,
    assessedBy: actor
  });

  return {
    assessmentEvent: assessment.toDerivedValueEvent(actor),
    assessment
  };
}

/**
 * Compute confidence score from factors
 */
function computeConfidenceScore(factors) {
  const weights = {
    sourceAuthority: 0.3,
    operatorPurity: 0.2,
    corroboration: 0.2,
    temporalDistance: 0.15,
    completeness: 0.15
  };

  const scores = {
    sourceAuthority: {
      'official': 1.0,
      'verified': 0.8,
      'unofficial': 0.5,
      'unknown': 0.3
    },
    operatorPurity: {
      'monotonic': 1.0,
      'pure': 0.9,
      'computed': 0.7,
      'unknown': 0.5
    },
    corroboration: {
      'multiple_sources': 1.0,
      'dual_source': 0.8,
      'single_source': 0.6,
      'unknown': 0.4
    },
    temporalDistance: {
      'current': 1.0,
      'recent': 0.8,
      'historical': 0.6,
      'unknown': 0.5
    },
    completeness: {
      'complete': 1.0,
      'partial': 0.7,
      'incomplete': 0.4,
      'unknown': 0.5
    }
  };

  let totalScore = 0;
  let totalWeight = 0;

  for (const [factor, weight] of Object.entries(weights)) {
    const value = factors[factor] || 'unknown';
    const scoreMap = scores[factor] || {};
    const factorScore = scoreMap[value] ?? 0.5;

    totalScore += factorScore * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0.5;
}

// ============================================================================
// ID Generation
// ============================================================================

function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Categories
    DerivedValueCategory,

    // Classes
    AggregationExecution,
    AggregationResult,
    ConfidenceAssessment,
    Insight,

    // Pipeline functions
    executeAggregation,
    assessConfidence,

    // Computation functions
    computeAggregation,
    computeConfidenceScore
  };
}

if (typeof window !== 'undefined') {
  window.EODerivedValues = {
    // Categories
    DerivedValueCategory,

    // Classes
    AggregationExecution,
    AggregationResult,
    ConfidenceAssessment,
    Insight,

    // Pipeline functions
    executeAggregation,
    assessConfidence,

    // Computation functions
    computeAggregation,
    computeConfidenceScore
  };
}
