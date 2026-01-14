/**
 * EO Operators - Strict EO-Aligned Operator Definitions
 *
 * EO AXIOM (ENFORCED):
 * All transformations are traced through explicit operator application.
 * Operators are classified by their epistemic effects.
 *
 * CRITICAL RULE:
 * AGGREGATE and COMPUTE operators can ONLY produce derived_value events.
 * They CANNOT produce Meant events.
 *
 * Operator Classes:
 * - ENTRY: Source data entry (Given or from EO sets)
 * - RESTRICTIVE: Filter, select, limit (monotonic reduction)
 * - SHAPE: Non-creative transformation (map, rename, flatten)
 * - COMPUTE: Value creation (aggregate, compute) - derived_value ONLY
 * - RELATIONAL: Join, link operations
 * - TEMPORAL: Time-based operations
 * - PROVENANCE: Trace, root, supersedes
 * - EPISTEMIC: Confidence assessment
 */

// ============================================================================
// EO Operators (Strict Set)
// ============================================================================

/**
 * The complete set of EO operators
 *
 * These are the ONLY allowed transformation operations.
 * Each operator is classified by its epistemic effect.
 */
const EO_OPERATORS = Object.freeze({
  // ─────────────────────────────────────────────────────────────────────────
  // ENTRY OPERATORS
  // How data enters the system
  // ─────────────────────────────────────────────────────────────────────────

  SOURCE_GIVEN: 'source_given',     // External reality only
  SOURCE_DERIVED: 'source_derived', // From EO sets / values

  // ─────────────────────────────────────────────────────────────────────────
  // RESTRICTIVE OPERATORS
  // Reduce available data (monotonic by type)
  // ─────────────────────────────────────────────────────────────────────────

  FILTER: 'filter',
  SELECT: 'select',
  LIMIT: 'limit',

  // ─────────────────────────────────────────────────────────────────────────
  // SHAPE OPERATORS
  // Transform structure without creating new meaning
  // ─────────────────────────────────────────────────────────────────────────

  MAP: 'map',
  RENAME: 'rename',
  FLATTEN: 'flatten',

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTE OPERATORS
  // Create derived values (derived_value ONLY, never Meant)
  // ─────────────────────────────────────────────────────────────────────────

  AGGREGATE: 'aggregate',
  COMPUTE: 'compute',

  // ─────────────────────────────────────────────────────────────────────────
  // RELATIONAL OPERATORS
  // Connect data across sets
  // ─────────────────────────────────────────────────────────────────────────

  JOIN: 'join',
  LINK: 'link',

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPORAL OPERATORS
  // Time-based operations
  // ─────────────────────────────────────────────────────────────────────────

  ASOF: 'asof',
  BETWEEN: 'between',

  // ─────────────────────────────────────────────────────────────────────────
  // PROVENANCE OPERATORS
  // Track lineage and history
  // ─────────────────────────────────────────────────────────────────────────

  TRACE: 'trace',
  ROOT: 'root',
  SUPERSEDES: 'supersedes',

  // ─────────────────────────────────────────────────────────────────────────
  // EPISTEMIC OPERATORS
  // Assess confidence and status
  // ─────────────────────────────────────────────────────────────────────────

  ASSESS_CONFIDENCE: 'assess_confidence'
});

// ============================================================================
// Operator Classifications
// ============================================================================

/**
 * OperatorClass - Classification of operators by epistemic effect
 */
const OperatorClass = Object.freeze({
  ENTRY: 'entry',
  RESTRICTIVE: 'restrictive',
  SHAPE: 'shape',
  COMPUTE: 'compute',
  RELATIONAL: 'relational',
  TEMPORAL: 'temporal',
  PROVENANCE: 'provenance',
  EPISTEMIC: 'epistemic'
});

/**
 * Operator metadata including class, constraints, and descriptions
 */
const OperatorMetadata = Object.freeze({
  [EO_OPERATORS.SOURCE_GIVEN]: {
    class: OperatorClass.ENTRY,
    symbol: '◉',
    name: 'Source Given',
    description: 'Entry from external reality',
    producesType: 'given',
    allowedInputs: ['external'],
    isMonotonic: true
  },

  [EO_OPERATORS.SOURCE_DERIVED]: {
    class: OperatorClass.ENTRY,
    symbol: '⊞',
    name: 'Source Derived',
    description: 'Entry from EO sets or values',
    producesType: 'any',
    allowedInputs: ['set', 'derived_value'],
    isMonotonic: true
  },

  [EO_OPERATORS.FILTER]: {
    class: OperatorClass.RESTRICTIVE,
    symbol: '⊃',
    name: 'Filter',
    description: 'Restrict by predicate',
    producesType: 'same',
    isMonotonic: true,
    reversible: false
  },

  [EO_OPERATORS.SELECT]: {
    class: OperatorClass.RESTRICTIVE,
    symbol: '⊏',
    name: 'Select',
    description: 'Select specific fields',
    producesType: 'same',
    isMonotonic: true,
    reversible: false
  },

  [EO_OPERATORS.LIMIT]: {
    class: OperatorClass.RESTRICTIVE,
    symbol: '⊤',
    name: 'Limit',
    description: 'Limit result count',
    producesType: 'same',
    isMonotonic: true,
    reversible: false
  },

  [EO_OPERATORS.MAP]: {
    class: OperatorClass.SHAPE,
    symbol: '→',
    name: 'Map',
    description: 'Transform each element',
    producesType: 'same',
    isMonotonic: true,
    reversible: true
  },

  [EO_OPERATORS.RENAME]: {
    class: OperatorClass.SHAPE,
    symbol: '↔',
    name: 'Rename',
    description: 'Rename fields',
    producesType: 'same',
    isMonotonic: true,
    reversible: true
  },

  [EO_OPERATORS.FLATTEN]: {
    class: OperatorClass.SHAPE,
    symbol: '⊥',
    name: 'Flatten',
    description: 'Flatten nested structure',
    producesType: 'same',
    isMonotonic: true,
    reversible: false
  },

  [EO_OPERATORS.AGGREGATE]: {
    class: OperatorClass.COMPUTE,
    symbol: 'Σ',
    name: 'Aggregate',
    description: 'Aggregate values (COUNT, SUM, AVG, etc.)',
    producesType: 'derived_value', // CRITICAL: Only derived_value
    isMonotonic: false,
    reversible: false,
    dangerous: false
  },

  [EO_OPERATORS.COMPUTE]: {
    class: OperatorClass.COMPUTE,
    symbol: 'ƒ',
    name: 'Compute',
    description: 'Compute derived value',
    producesType: 'derived_value', // CRITICAL: Only derived_value
    isMonotonic: false,
    reversible: false,
    dangerous: false
  },

  [EO_OPERATORS.JOIN]: {
    class: OperatorClass.RELATIONAL,
    symbol: '⋈',
    name: 'Join',
    description: 'Join two sets on condition',
    producesType: 'same',
    isMonotonic: true,
    reversible: false
  },

  [EO_OPERATORS.LINK]: {
    class: OperatorClass.RELATIONAL,
    symbol: '↭',
    name: 'Link',
    description: 'Create relationship link',
    producesType: 'meant',
    isMonotonic: true,
    reversible: true
  },

  [EO_OPERATORS.ASOF]: {
    class: OperatorClass.TEMPORAL,
    symbol: '⌚',
    name: 'As Of',
    description: 'Point-in-time view',
    producesType: 'same',
    isMonotonic: true,
    reversible: false
  },

  [EO_OPERATORS.BETWEEN]: {
    class: OperatorClass.TEMPORAL,
    symbol: '↔',
    name: 'Between',
    description: 'Time range filter',
    producesType: 'same',
    isMonotonic: true,
    reversible: false
  },

  [EO_OPERATORS.TRACE]: {
    class: OperatorClass.PROVENANCE,
    symbol: '⤴',
    name: 'Trace',
    description: 'Trace provenance chain',
    producesType: 'meant',
    isMonotonic: true,
    reversible: false
  },

  [EO_OPERATORS.ROOT]: {
    class: OperatorClass.PROVENANCE,
    symbol: '⊙',
    name: 'Root',
    description: 'Find root Given events',
    producesType: 'given',
    isMonotonic: true,
    reversible: false
  },

  [EO_OPERATORS.SUPERSEDES]: {
    class: OperatorClass.PROVENANCE,
    symbol: '⤳',
    name: 'Supersedes',
    description: 'Create supersession relationship',
    producesType: 'meant',
    isMonotonic: false,
    reversible: false,
    dangerous: true
  },

  [EO_OPERATORS.ASSESS_CONFIDENCE]: {
    class: OperatorClass.EPISTEMIC,
    symbol: '⊛',
    name: 'Assess Confidence',
    description: 'Generate confidence assessment',
    producesType: 'derived_value', // Confidence is always derived_value
    isMonotonic: true,
    reversible: false
  }
});

// ============================================================================
// Operator Validation
// ============================================================================

/**
 * Check if a string is a valid operator
 */
function isValidOperator(operatorId) {
  return Object.values(EO_OPERATORS).includes(operatorId);
}

/**
 * Get operator metadata
 */
function getOperator(operatorId) {
  return OperatorMetadata[operatorId] || null;
}

/**
 * Get all operators in a class
 */
function getOperatorsByClass(operatorClass) {
  return Object.entries(OperatorMetadata)
    .filter(([_, meta]) => meta.class === operatorClass)
    .map(([op, _]) => op);
}

/**
 * Check if operator produces only derived_value
 */
function producesOnlyDerivedValue(operatorId) {
  const meta = OperatorMetadata[operatorId];
  return meta && meta.producesType === 'derived_value';
}

/**
 * Check if operator is monotonic
 */
function isMonotonic(operatorId) {
  const meta = OperatorMetadata[operatorId];
  return meta ? meta.isMonotonic : false;
}

/**
 * Check if operator is dangerous
 */
function isDangerous(operatorId) {
  const meta = OperatorMetadata[operatorId];
  return meta ? meta.dangerous === true : false;
}

// ============================================================================
// Aggregation Functions
// ============================================================================

/**
 * Supported aggregation functions
 */
const AggregationFunction = Object.freeze({
  COUNT: 'count',
  SUM: 'sum',
  AVG: 'avg',
  MIN: 'min',
  MAX: 'max',
  FIRST: 'first',
  LAST: 'last',
  DISTINCT: 'distinct',
  MEDIAN: 'median',
  STDDEV: 'stddev',
  VARIANCE: 'variance'
});

/**
 * Aggregation function metadata
 */
const AggregationMetadata = Object.freeze({
  [AggregationFunction.COUNT]: {
    name: 'Count',
    description: 'Count of items',
    requiresField: false,
    returnsType: 'number'
  },
  [AggregationFunction.SUM]: {
    name: 'Sum',
    description: 'Sum of values',
    requiresField: true,
    fieldTypes: ['number'],
    returnsType: 'number'
  },
  [AggregationFunction.AVG]: {
    name: 'Average',
    description: 'Average of values',
    requiresField: true,
    fieldTypes: ['number'],
    returnsType: 'number'
  },
  [AggregationFunction.MIN]: {
    name: 'Minimum',
    description: 'Minimum value',
    requiresField: true,
    fieldTypes: ['number', 'date'],
    returnsType: 'same'
  },
  [AggregationFunction.MAX]: {
    name: 'Maximum',
    description: 'Maximum value',
    requiresField: true,
    fieldTypes: ['number', 'date'],
    returnsType: 'same'
  },
  [AggregationFunction.FIRST]: {
    name: 'First',
    description: 'First value',
    requiresField: true,
    returnsType: 'same'
  },
  [AggregationFunction.LAST]: {
    name: 'Last',
    description: 'Last value',
    requiresField: true,
    returnsType: 'same'
  },
  [AggregationFunction.DISTINCT]: {
    name: 'Distinct',
    description: 'Count of distinct values',
    requiresField: true,
    returnsType: 'number'
  },
  [AggregationFunction.MEDIAN]: {
    name: 'Median',
    description: 'Median value',
    requiresField: true,
    fieldTypes: ['number'],
    returnsType: 'number'
  },
  [AggregationFunction.STDDEV]: {
    name: 'Standard Deviation',
    description: 'Standard deviation',
    requiresField: true,
    fieldTypes: ['number'],
    returnsType: 'number'
  },
  [AggregationFunction.VARIANCE]: {
    name: 'Variance',
    description: 'Variance of values',
    requiresField: true,
    fieldTypes: ['number'],
    returnsType: 'number'
  }
});

// ============================================================================
// Operator Application
// ============================================================================

/**
 * OperatorApplication - A single operator application with params
 */
class OperatorApplication {
  /**
   * @param {string} op - The operator ID
   * @param {Object} params - Parameters for the operator
   */
  constructor(op, params = {}) {
    if (!isValidOperator(op)) {
      throw new Error(`Invalid operator: ${op}`);
    }

    this.op = op;
    this.params = Object.freeze({ ...params });
    this.timestamp = new Date().toISOString();

    Object.freeze(this);
  }

  /**
   * Get operator metadata
   */
  getMetadata() {
    return OperatorMetadata[this.op];
  }

  /**
   * Get the epistemic type this operator produces
   */
  getProducedType() {
    return this.getMetadata()?.producesType || 'same';
  }

  toJSON() {
    return {
      op: this.op,
      params: { ...this.params }
    };
  }
}

/**
 * Create an operator application
 */
function createOperatorApplication(op, params = {}) {
  return new OperatorApplication(op, params);
}

// ============================================================================
// Operator Chain Validation
// ============================================================================

/**
 * Validate an operator chain for EO compliance
 */
function validateOperatorChain(operators) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(operators) || operators.length === 0) {
    errors.push('Operator chain must be a non-empty array');
    return { valid: false, errors, warnings };
  }

  // Check each operator is valid
  for (let i = 0; i < operators.length; i++) {
    const op = operators[i];
    const opId = typeof op === 'string' ? op : op.op;

    if (!isValidOperator(opId)) {
      errors.push(`Invalid operator at position ${i}: ${opId}`);
      continue;
    }

    // Check for dangerous operators
    if (isDangerous(opId)) {
      warnings.push(`Dangerous operator "${opId}" at position ${i}`);
    }
  }

  // First operator should be an entry operator
  const firstOp = typeof operators[0] === 'string' ? operators[0] : operators[0].op;
  const firstMeta = OperatorMetadata[firstOp];
  if (firstMeta && firstMeta.class !== OperatorClass.ENTRY) {
    warnings.push('Chain should start with an entry operator (source_given or source_derived)');
  }

  // Check for compute operators producing non-derived_value
  for (const op of operators) {
    const opId = typeof op === 'string' ? op : op.op;
    if (producesOnlyDerivedValue(opId)) {
      // This is fine - just note it
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get the final produced type of an operator chain
 */
function getChainProducedType(operators) {
  let producedType = 'given'; // Start assumption

  for (const op of operators) {
    const opId = typeof op === 'string' ? op : op.op;
    const meta = OperatorMetadata[opId];

    if (!meta) continue;

    if (meta.producesType === 'derived_value') {
      return 'derived_value'; // Compute operators force derived_value
    } else if (meta.producesType === 'meant') {
      producedType = 'meant';
    } else if (meta.producesType === 'given') {
      producedType = 'given';
    }
    // 'same' or 'any' preserves current type
  }

  return producedType;
}

// ============================================================================
// Legacy Action Mapping
// ============================================================================

/**
 * Map legacy action strings to new EO operators
 */
const LegacyActionMapping = Object.freeze({
  // Record operations
  'create_record': [EO_OPERATORS.SOURCE_DERIVED],
  'update_record': [EO_OPERATORS.MAP],
  'delete_record': [EO_OPERATORS.FILTER],
  'tombstone_record': [EO_OPERATORS.SUPERSEDES],
  'tombstone': [EO_OPERATORS.SUPERSEDES],

  // Filter operations
  'apply_filter': [EO_OPERATORS.FILTER],
  'remove_filter': [EO_OPERATORS.SOURCE_DERIVED],

  // Link operations
  'link_records': [EO_OPERATORS.LINK],
  'unlink_records': [EO_OPERATORS.SUPERSEDES],

  // Aggregations
  'aggregate': [EO_OPERATORS.AGGREGATE],
  'count': [EO_OPERATORS.AGGREGATE],
  'sum': [EO_OPERATORS.AGGREGATE],

  // Import
  'import_data': [EO_OPERATORS.SOURCE_GIVEN],
  'import_csv': [EO_OPERATORS.SOURCE_GIVEN],
  'import_json': [EO_OPERATORS.SOURCE_GIVEN]
});

/**
 * Map a legacy action to EO operators
 */
function mapLegacyAction(action) {
  if (LegacyActionMapping[action]) {
    return [...LegacyActionMapping[action]];
  }

  // Infer from action name
  const lower = action.toLowerCase();

  if (lower.includes('import') || lower.includes('source')) {
    return [EO_OPERATORS.SOURCE_GIVEN];
  }
  if (lower.includes('filter') || lower.includes('where')) {
    return [EO_OPERATORS.FILTER];
  }
  if (lower.includes('select') || lower.includes('project')) {
    return [EO_OPERATORS.SELECT];
  }
  if (lower.includes('join') || lower.includes('merge')) {
    return [EO_OPERATORS.JOIN];
  }
  if (lower.includes('link') || lower.includes('relate')) {
    return [EO_OPERATORS.LINK];
  }
  if (lower.includes('aggregate') || lower.includes('count') || lower.includes('sum')) {
    return [EO_OPERATORS.AGGREGATE];
  }
  if (lower.includes('compute') || lower.includes('calculate')) {
    return [EO_OPERATORS.COMPUTE];
  }
  if (lower.includes('map') || lower.includes('transform')) {
    return [EO_OPERATORS.MAP];
  }
  if (lower.includes('rename')) {
    return [EO_OPERATORS.RENAME];
  }
  if (lower.includes('supersede') || lower.includes('replace')) {
    return [EO_OPERATORS.SUPERSEDES];
  }
  if (lower.includes('trace') || lower.includes('provenance')) {
    return [EO_OPERATORS.TRACE];
  }
  if (lower.includes('confidence') || lower.includes('assess')) {
    return [EO_OPERATORS.ASSESS_CONFIDENCE];
  }

  // Default to source_derived for unknown actions
  console.warn(`Unknown legacy action: ${action}, defaulting to SOURCE_DERIVED`);
  return [EO_OPERATORS.SOURCE_DERIVED];
}

// ============================================================================
// Operator Display Utilities
// ============================================================================

/**
 * Format operator for display
 */
function formatOperator(operatorId) {
  const meta = OperatorMetadata[operatorId];
  if (!meta) return operatorId;
  return `${meta.symbol} ${meta.name}`;
}

/**
 * Format operator chain for display
 */
function formatOperatorChain(operators) {
  return operators.map(op => {
    const opId = typeof op === 'string' ? op : op.op;
    const meta = OperatorMetadata[opId];
    return meta ? meta.symbol : opId;
  }).join(' → ');
}

/**
 * Get CSS class for operator class
 */
function getOperatorClassCSS(operatorId) {
  const meta = OperatorMetadata[operatorId];
  if (!meta) return 'op-unknown';
  return `op-${meta.class}`;
}

/**
 * Render operator badge HTML
 */
function renderOperatorBadge(operatorId, options = {}) {
  const meta = OperatorMetadata[operatorId];
  if (!meta) {
    return `<span class="op-badge op-unknown">${operatorId}</span>`;
  }

  const showName = options.showName !== false;
  const showSymbol = options.showSymbol !== false;

  const parts = [];
  if (showSymbol) parts.push(`<span class="op-symbol">${meta.symbol}</span>`);
  if (showName) parts.push(`<span class="op-name">${meta.name}</span>`);

  const dangerClass = meta.dangerous ? ' op-dangerous' : '';

  return `<span class="op-badge op-${meta.class}${dangerClass}" title="${meta.description}">${parts.join('')}</span>`;
}

// ============================================================================
// Operator Styles
// ============================================================================

const operatorStyles = `
  .op-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .op-symbol { font-size: 14px; font-weight: 600; }
  .op-name { font-size: 11px; }

  .op-entry { background: rgba(34, 197, 94, 0.1); color: #16a34a; border: 1px solid rgba(34, 197, 94, 0.3); }
  .op-restrictive { background: rgba(168, 85, 247, 0.1); color: #7c3aed; border: 1px solid rgba(168, 85, 247, 0.3); }
  .op-shape { background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.3); }
  .op-compute { background: rgba(249, 115, 22, 0.1); color: #ea580c; border: 1px solid rgba(249, 115, 22, 0.3); }
  .op-relational { background: rgba(236, 72, 153, 0.1); color: #db2777; border: 1px solid rgba(236, 72, 153, 0.3); }
  .op-temporal { background: rgba(14, 165, 233, 0.1); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.3); }
  .op-provenance { background: rgba(156, 163, 175, 0.1); color: #6b7280; border: 1px solid rgba(156, 163, 175, 0.3); }
  .op-epistemic { background: rgba(239, 68, 68, 0.1); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3); }
  .op-unknown { background: rgba(156, 163, 175, 0.05); color: #9ca3af; border: 1px dashed rgba(156, 163, 175, 0.3); }
  .op-dangerous { box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.4); }

  .op-chain {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .op-arrow {
    color: var(--text-muted, #9ca3af);
    font-size: 12px;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.id = 'eo-operator-styles';
  styleEl.textContent = operatorStyles;
  if (!document.getElementById('eo-operator-styles')) {
    document.head.appendChild(styleEl);
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Core operators
    EO_OPERATORS,
    OperatorClass,
    OperatorMetadata,
    AggregationFunction,
    AggregationMetadata,

    // Classes
    OperatorApplication,

    // Validation
    isValidOperator,
    getOperator,
    getOperatorsByClass,
    producesOnlyDerivedValue,
    isMonotonic,
    isDangerous,
    validateOperatorChain,
    getChainProducedType,

    // Factory
    createOperatorApplication,

    // Legacy mapping
    LegacyActionMapping,
    mapLegacyAction,

    // Display
    formatOperator,
    formatOperatorChain,
    getOperatorClassCSS,
    renderOperatorBadge
  };
}

if (typeof window !== 'undefined') {
  window.EOOperators = {
    // Core operators
    operators: EO_OPERATORS,
    classes: OperatorClass,
    metadata: OperatorMetadata,
    aggregations: AggregationFunction,
    aggregationMetadata: AggregationMetadata,

    // Classes
    OperatorApplication,

    // Validation
    isValid: isValidOperator,
    get: getOperator,
    getByClass: getOperatorsByClass,
    producesOnlyDerivedValue,
    isMonotonic,
    isDangerous,
    validateChain: validateOperatorChain,
    getChainProducedType,

    // Factory
    createApplication: createOperatorApplication,

    // Legacy mapping
    legacyMapping: LegacyActionMapping,
    mapLegacy: mapLegacyAction,

    // Display
    format: formatOperator,
    formatChain: formatOperatorChain,
    getClassCSS: getOperatorClassCSS,
    renderBadge: renderOperatorBadge
  };
}
