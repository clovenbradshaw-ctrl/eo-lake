/**
 * EO Language - Centralized EO-Aligned Labels and Tooltips
 *
 * This module provides:
 * - User-facing labels that subtly teach EO concepts
 * - Tooltips that explain actions in terms of their epistemic effects
 * - Translation between technical operations and EO operators
 *
 * PRINCIPLE: EO should be the invisible grammar of every action,
 * and a visible explanation only when the user asks "why?"
 */

// ============================================================================
// Operator Display Names and Symbols
// ============================================================================

const EOOperatorDisplay = Object.freeze({
  INS: { symbol: '⊕', name: 'Insert', userLabel: 'Add' },
  DES: { symbol: '⊙', name: 'Designate', userLabel: 'Name' },
  SEG: { symbol: '⊘', name: 'Segment', userLabel: 'Focus' },
  CON: { symbol: '⊗', name: 'Connect', userLabel: 'Link' },
  SYN: { symbol: '≡', name: 'Synthesize', userLabel: 'Combine' },
  ALT: { symbol: 'Δ', name: 'Alternate', userLabel: 'Version' },
  SUP: { symbol: '∥', name: 'Superpose', userLabel: 'Compare' },
  REC: { symbol: '←', name: 'Record', userLabel: 'Track' },
  NUL: { symbol: '∅', name: 'Nullify', userLabel: 'Missing' }
});

// ============================================================================
// Action Labels - User-Facing Text
// ============================================================================

/**
 * Maps traditional data operations to EO-aligned language.
 * Use these labels in UI buttons, menus, and headers.
 */
const EOActionLabels = Object.freeze({
  // Filtering / Scoping (SEG)
  filter: {
    label: 'Focus',
    tooltip: 'Show only matching records without removing others',
    operator: 'SEG',
    traditional: 'Filter'
  },
  hideField: {
    label: 'Hide field',
    tooltip: 'Remove from this view without deleting',
    operator: 'SEG',
    traditional: 'Hide column'
  },
  showField: {
    label: 'Show field',
    tooltip: 'Make visible in this view',
    operator: 'SEG',
    traditional: 'Show column'
  },

  // Grouping / Reorganizing (SEG + REC)
  groupBy: {
    label: 'Organize around',
    tooltip: 'Reorganize the view around this field',
    operator: 'SEG',
    traditional: 'Group by'
  },
  pivot: {
    label: 'Re-center',
    tooltip: 'Change what the data is organized around without changing the data itself',
    operator: 'SEG',
    traditional: 'Pivot'
  },

  // Merging / Combining (SYN)
  merge: {
    label: 'Combine identities',
    tooltip: 'Treat these as the same entity',
    operator: 'SYN',
    traditional: 'Merge records'
  },
  deduplicate: {
    label: 'Resolve duplicates',
    tooltip: 'Find and combine records representing the same entity',
    operator: 'SYN',
    traditional: 'Deduplicate'
  },
  entityResolution: {
    label: 'Confirm identity',
    tooltip: 'Verify that these records represent the same thing',
    operator: 'SYN',
    traditional: 'Entity resolution'
  },

  // Connecting / Joining (CON)
  join: {
    label: 'Connect sources',
    tooltip: 'Link records from different sources based on a relationship',
    operator: 'CON',
    traditional: 'Join'
  },
  link: {
    label: 'Create relationship',
    tooltip: 'Establish a connection between these entities',
    operator: 'CON',
    traditional: 'Link records'
  },

  // Naming / Defining (DES)
  rename: {
    label: 'Rename',
    tooltip: 'Give this a new name (original name preserved in history)',
    operator: 'DES',
    traditional: 'Rename'
  },
  alias: {
    label: 'Add alias',
    tooltip: 'Create an alternative name for this entity',
    operator: 'DES',
    traditional: 'Alias'
  },
  define: {
    label: 'Define meaning',
    tooltip: 'Specify what this field represents',
    operator: 'DES',
    traditional: 'Add definition'
  },

  // Conflict Resolution (SUP)
  resolveConflict: {
    label: 'Choose interpretation',
    tooltip: 'Select which value to use when sources disagree',
    operator: 'SUP',
    traditional: 'Resolve conflict'
  },
  keepAll: {
    label: 'Preserve all values',
    tooltip: 'Keep all interpretations visible',
    operator: 'SUP',
    traditional: 'Keep all'
  },
  pickRecent: {
    label: 'Use most recent',
    tooltip: 'Choose the latest value as the active interpretation',
    operator: 'SUP',
    traditional: 'Pick most recent'
  },

  // Data Entry (INS)
  import: {
    label: 'Import',
    tooltip: 'Bring external data into the system',
    operator: 'INS',
    traditional: 'Import'
  },
  create: {
    label: 'Add record',
    tooltip: 'Assert that something exists',
    operator: 'INS',
    traditional: 'Create record'
  },

  // Versioning (ALT)
  asOf: {
    label: 'As of',
    tooltip: 'Show the world as it was known at a specific time',
    operator: 'ALT',
    traditional: 'As of date'
  },
  snapshot: {
    label: 'Snapshot',
    tooltip: 'Capture the current state for reproducibility',
    operator: 'ALT',
    traditional: 'Create snapshot'
  },

  // Absence (NUL)
  markMissing: {
    label: 'Flag as missing',
    tooltip: 'Assert that expected data is absent',
    operator: 'NUL',
    traditional: 'Mark as null'
  },
  softDelete: {
    label: 'Archive',
    tooltip: 'Mark as inactive without erasing history',
    operator: 'NUL',
    traditional: 'Soft delete'
  }
});

// ============================================================================
// View Type Labels
// ============================================================================

const EOViewLabels = Object.freeze({
  grid: {
    label: 'Table',
    tooltip: 'View records in rows and columns',
    icon: 'ph-table'
  },
  cards: {
    label: 'Cards',
    tooltip: 'View each record as a card',
    icon: 'ph-cards'
  },
  kanban: {
    label: 'Board',
    tooltip: 'Organize records into columns by status',
    icon: 'ph-kanban'
  },
  calendar: {
    label: 'Calendar',
    tooltip: 'View records by date',
    icon: 'ph-calendar'
  },
  timeline: {
    label: 'Timeline',
    tooltip: 'View records along a time axis',
    icon: 'ph-chart-line'
  },
  graph: {
    label: 'Graph',
    tooltip: 'View relationships between records',
    icon: 'ph-graph'
  }
});

// ============================================================================
// Epistemic Status Labels
// ============================================================================

const EOEpistemicLabels = Object.freeze({
  GIVEN: {
    label: 'Recorded fact',
    tooltip: 'Data from an external source, exactly as received',
    color: '#4CAF50',
    icon: 'ph-check-circle'
  },
  MEANT: {
    label: 'Interpretation',
    tooltip: 'A decision made about how to understand the data',
    color: '#2196F3',
    icon: 'ph-lightbulb'
  },
  DERIVED: {
    label: 'Calculated',
    tooltip: 'A value computed from other values',
    color: '#9C27B0',
    icon: 'ph-function'
  }
});

// ============================================================================
// Provenance Indicator Labels
// ============================================================================

const EOProvenanceLabels = Object.freeze({
  full: {
    symbol: '◉',
    label: 'Complete provenance',
    tooltip: 'Full lineage to original source available'
  },
  partial: {
    symbol: '◐',
    label: 'Partial provenance',
    tooltip: 'Some lineage information available'
  },
  none: {
    symbol: '○',
    label: 'No provenance',
    tooltip: 'Origin unknown or not tracked'
  }
});

// ============================================================================
// Explanation Templates
// ============================================================================

/**
 * Templates for generating human-readable explanations of operations.
 * Use these when showing "Why?" or "How?" information.
 */
const EOExplanationTemplates = Object.freeze({
  // Filter explanation
  SEG: {
    simple: (params) => `Showing only ${params.field} ${params.operator} "${params.value}"`,
    detailed: (params) => `SEG → Focus visibility where ${params.field} ${params.operator} "${params.value}"`,
    chain: (steps) => steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
  },

  // Designation explanation
  DES: {
    simple: (params) => `Named as "${params.name}"`,
    detailed: (params) => `DES → Designated identity: ${params.name} (bound to ${params.uri || 'local'})`,
    binding: (params) => `This field is interpreted as ${params.meaning}`
  },

  // Connection explanation
  CON: {
    simple: (params) => `Connected to ${params.target}`,
    detailed: (params) => `CON → Linked to ${params.target} via ${params.field}`,
    join: (params) => `Joined with ${params.source} on ${params.leftField} = ${params.rightField}`
  },

  // Synthesis explanation
  SYN: {
    simple: (params) => `Combined from ${params.count} records`,
    detailed: (params) => `SYN → Synthesized identity from ${params.sources.join(', ')}`,
    aggregation: (params) => `${params.function}(${params.field}) grouped by ${params.groupBy}`
  },

  // Superposition explanation
  SUP: {
    simple: (params) => `${params.count} values from different sources`,
    detailed: (params) => `SUP → ${params.count} interpretations preserved`,
    conflict: (params) => `Sources disagree: ${params.sources.map(s => `${s.name}: ${s.value}`).join(' vs ')}`
  },

  // Alternate explanation
  ALT: {
    simple: (params) => `As known on ${params.date}`,
    detailed: (params) => `ALT → World state projected to ${params.date}`,
    version: (params) => `Using definition version: ${params.version}`
  },

  // Record explanation
  REC: {
    simple: (params) => `From ${params.source}`,
    detailed: (params) => `REC → Grounded in ${params.source} at ${params.timestamp}`,
    lineage: (steps) => steps.map((s, i) => `${i + 1}. ${s.action} → ${s.result}`).join('\n')
  },

  // Nullify explanation
  NUL: {
    simple: (params) => `Expected but not found`,
    detailed: (params) => `NUL → Meaningful absence: ${params.reason}`,
    expectation: (params) => `Expected ${params.field} based on ${params.rule}`
  },

  // Insert explanation
  INS: {
    simple: (params) => `Added on ${params.date}`,
    detailed: (params) => `INS → Asserted existence at ${params.timestamp} by ${params.agent}`,
    import: (params) => `Imported from ${params.source} (${params.count} records)`
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the user-facing label for an action
 */
function getActionLabel(actionKey) {
  const action = EOActionLabels[actionKey];
  return action ? action.label : actionKey;
}

/**
 * Get the tooltip for an action
 */
function getActionTooltip(actionKey) {
  const action = EOActionLabels[actionKey];
  return action ? action.tooltip : '';
}

/**
 * Get the EO operator for an action
 */
function getActionOperator(actionKey) {
  const action = EOActionLabels[actionKey];
  return action ? action.operator : null;
}

/**
 * Get operator display info
 */
function getOperatorDisplay(operatorKey) {
  return EOOperatorDisplay[operatorKey] || { symbol: '?', name: operatorKey, userLabel: operatorKey };
}

/**
 * Generate a human-readable explanation for an operator chain
 */
function explainOperatorChain(operators, detailed = false) {
  if (!operators || operators.length === 0) {
    return 'No transformations applied';
  }

  const explanations = operators.map(op => {
    const template = EOExplanationTemplates[op.type];
    if (!template) return `${op.type}: ${JSON.stringify(op.params)}`;

    if (detailed) {
      return template.detailed(op.params);
    }
    return template.simple(op.params);
  });

  if (detailed) {
    return explanations.map((exp, i) => `${i + 1}. ${exp}`).join('\n');
  }
  return explanations.join(' → ');
}

/**
 * Format an operator for display
 */
function formatOperator(operatorKey, params = {}) {
  const display = getOperatorDisplay(operatorKey);
  const template = EOExplanationTemplates[operatorKey];

  return {
    symbol: display.symbol,
    name: display.name,
    userLabel: display.userLabel,
    explanation: template ? template.simple(params) : display.name
  };
}

/**
 * Get epistemic status display
 */
function getEpistemicDisplay(status) {
  return EOEpistemicLabels[status] || EOEpistemicLabels.GIVEN;
}

/**
 * Get provenance indicator
 */
function getProvenanceIndicator(level) {
  return EOProvenanceLabels[level] || EOProvenanceLabels.none;
}

// ============================================================================
// Export
// ============================================================================

window.EOLanguage = {
  // Data
  EOOperatorDisplay,
  EOActionLabels,
  EOViewLabels,
  EOEpistemicLabels,
  EOProvenanceLabels,
  EOExplanationTemplates,

  // Functions
  getActionLabel,
  getActionTooltip,
  getActionOperator,
  getOperatorDisplay,
  explainOperatorChain,
  formatOperator,
  getEpistemicDisplay,
  getProvenanceIndicator
};

// Also export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.EOLanguage;
}
