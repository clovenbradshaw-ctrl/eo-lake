/**
 * EO Operators - Layer 4 Transformation Operators
 *
 * The 9 fundamental operators that define ALL possible transformations in EO.
 * Every action in the system must map to one or more of these operators.
 *
 * Design principle: Actions are not things, they are transformations.
 * The question is not "what action happened?" but
 * "which EO operator was applied, to what, in which context?"
 */

// ============================================================================
// The 9 EO Operators
// ============================================================================

/**
 * EO Operator Definitions
 * These are the ONLY first-class action types EO recognizes.
 * Everything else is composition.
 */
const EOOperators = Object.freeze({
  // ─────────────────────────────────────────────────────────────────────────
  // RECOGNITION OPERATORS (detecting what is/isn't)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * NUL (∅) - Recognize Absence
   * Detects missing data, unmet conditions, gaps, deletions.
   * The operator of negation and void-detection.
   */
  NUL: {
    id: 'NUL',
    symbol: '∅',
    name: 'Recognize Absence',
    description: 'Detect missing data, unmet condition, deletion, or void',
    category: 'recognition',
    examples: ['tombstone record', 'detect anomaly', 'mark as deleted', 'flag missing field'],
    reversible: true,
    dangerous: false
  },

  // ─────────────────────────────────────────────────────────────────────────
  // IDENTITY OPERATORS (naming and instantiating)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * DES (⊡) - Designate
   * Names, labels, classifies, assigns identity.
   * The operator of semantic commitment.
   */
  DES: {
    id: 'DES',
    symbol: '⊡',
    name: 'Designate',
    description: 'Name, label, classify, assign identity or value',
    category: 'identity',
    examples: ['rename field', 'set value', 'assign tag', 'classify record', 'set status'],
    reversible: true,
    dangerous: false
  },

  /**
   * INS (△) - Instantiate
   * Creates a concrete instance from a type/template.
   * The operator of bringing-into-being.
   */
  INS: {
    id: 'INS',
    symbol: '△',
    name: 'Instantiate',
    description: 'Create a concrete instance, bring into being',
    category: 'identity',
    examples: ['create record', 'create set', 'create view', 'spawn entity'],
    reversible: false, // Can tombstone, but not truly reverse
    dangerous: false
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BOUNDARY OPERATORS (scoping and connecting)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * SEG (｜) - Segment
   * Draws boundaries, restricts scope, separates.
   * The operator of division and access control.
   */
  SEG: {
    id: 'SEG',
    symbol: '｜',
    name: 'Segment',
    description: 'Draw boundary, restrict scope, separate, remove access',
    category: 'boundary',
    examples: ['unlink record', 'remove from view', 'restrict access', 'filter out', 'hide field'],
    reversible: true,
    dangerous: false
  },

  /**
   * CON (⋈) - Connect
   * Links entities, establishes associations.
   * The operator of relation-making.
   */
  CON: {
    id: 'CON',
    symbol: '⋈',
    name: 'Connect',
    description: 'Link entities, establish association, create relationship',
    category: 'boundary',
    examples: ['link records', 'add to view', 'associate tag', 'add user to team', 'create edge'],
    reversible: true,
    dangerous: false
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPORAL OPERATORS (rhythm and change)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * ALT (∿) - Alternate
   * Sets rhythm, toggles state, schedules.
   * The operator of oscillation and temporal patterns.
   */
  ALT: {
    id: 'ALT',
    symbol: '∿',
    name: 'Alternate',
    description: 'Toggle state, set rhythm, schedule, switch between modes',
    category: 'temporal',
    examples: ['toggle visibility', 'switch view mode', 'enable/disable', 'schedule task', 'cycle status'],
    reversible: true,
    dangerous: false
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INTEGRATION OPERATORS (merging and overlaying)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * SYN (∨) - Synthesize
   * Merges, integrates, combines into unity.
   * The operator of unification.
   */
  SYN: {
    id: 'SYN',
    symbol: '∨',
    name: 'Synthesize',
    description: 'Merge, integrate, combine into unified whole',
    category: 'integration',
    examples: ['merge records', 'consolidate duplicates', 'supersede', 'integrate sources', 'combine fields'],
    reversible: false, // Synthesis loses original boundaries
    dangerous: true // Data loss potential
  },

  /**
   * SUP (⊕) - Superpose
   * Overlays contexts, enables multi-frame viewing.
   * The operator of perspectival composition.
   */
  SUP: {
    id: 'SUP',
    symbol: '⊕',
    name: 'Superpose',
    description: 'Overlay contexts, multi-frame view, compose perspectives',
    category: 'integration',
    examples: ['apply horizon', 'compare views', 'overlay filters', 'multi-select context', 'layer data'],
    reversible: true,
    dangerous: false
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REFLEXIVE OPERATORS (self-modification)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * REC (⟳) - Recurse
   * Feedback loops, self-modification, meta-operations.
   * The operator of self-reference.
   *
   * WARNING: REC is inherently dangerous - it can create infinite loops,
   * modify its own rules, or cause cascade effects.
   */
  REC: {
    id: 'REC',
    symbol: '⟳',
    name: 'Recurse',
    description: 'Feedback, self-modification, meta-operation, self-reference',
    category: 'reflexive',
    examples: ['compliance check', 'auto-correct', 'self-audit', 'policy update', 'schema migration'],
    reversible: false, // Self-modification changes the rules
    dangerous: true // Can cause cascades
  }
});

// ============================================================================
// Operator Categories
// ============================================================================

const OperatorCategories = Object.freeze({
  recognition: {
    name: 'Recognition',
    description: 'Detecting what is or is not present',
    operators: ['NUL']
  },
  identity: {
    name: 'Identity',
    description: 'Naming and bringing into being',
    operators: ['DES', 'INS']
  },
  boundary: {
    name: 'Boundary',
    description: 'Scoping, connecting, and separating',
    operators: ['SEG', 'CON']
  },
  temporal: {
    name: 'Temporal',
    description: 'Rhythm, oscillation, and scheduling',
    operators: ['ALT']
  },
  integration: {
    name: 'Integration',
    description: 'Merging, overlaying, and composing',
    operators: ['SYN', 'SUP']
  },
  reflexive: {
    name: 'Reflexive',
    description: 'Self-modification and meta-operations',
    operators: ['REC']
  }
});

// ============================================================================
// Operator Validation
// ============================================================================

/**
 * Check if a string is a valid operator ID
 */
function isValidOperator(operatorId) {
  return operatorId in EOOperators;
}

/**
 * Get operator definition by ID
 */
function getOperator(operatorId) {
  return EOOperators[operatorId] || null;
}

/**
 * Get all operators in a category
 */
function getOperatorsByCategory(category) {
  const cat = OperatorCategories[category];
  if (!cat) return [];
  return cat.operators.map(id => EOOperators[id]);
}

/**
 * Check if an operator is dangerous (requires extra caution)
 */
function isDangerousOperator(operatorId) {
  const op = EOOperators[operatorId];
  return op ? op.dangerous : false;
}

/**
 * Check if an operator is reversible
 */
function isReversibleOperator(operatorId) {
  const op = EOOperators[operatorId];
  return op ? op.reversible : false;
}

// ============================================================================
// Operator Sequences (Compound Actions)
// ============================================================================

/**
 * Common compound action patterns
 * These are frequently-used operator sequences with semantic names
 */
const CompoundPatterns = Object.freeze({
  // Create and name something
  CREATE_NAMED: {
    id: 'CREATE_NAMED',
    sequence: ['INS', 'DES'],
    description: 'Create and name an entity',
    examples: ['create set with name', 'create view with title']
  },

  // Tag something (designate + connect)
  TAG: {
    id: 'TAG',
    sequence: ['DES', 'CON'],
    description: 'Apply a tag or label with association',
    examples: ['tag record', 'apply category']
  },

  // Publish (lock + mark + connect to index)
  PUBLISH: {
    id: 'PUBLISH',
    sequence: ['SEG', 'DES', 'CON'],
    description: 'Finalize and make publicly available',
    examples: ['publish document', 'release version']
  },

  // Archive (segment out + mark as absent)
  ARCHIVE: {
    id: 'ARCHIVE',
    sequence: ['SEG', 'NUL'],
    description: 'Remove from active use without deletion',
    examples: ['archive project', 'soft-delete record']
  },

  // Replace (synthesize old into new + designate)
  REPLACE: {
    id: 'REPLACE',
    sequence: ['SYN', 'DES'],
    description: 'Replace one thing with another',
    examples: ['supersede record', 'update with replacement']
  },

  // Clone (instantiate from existing + connect lineage)
  CLONE: {
    id: 'CLONE',
    sequence: ['INS', 'CON'],
    description: 'Create copy with lineage tracking',
    examples: ['duplicate record', 'fork project']
  },

  // Migrate (recurse on schema + synthesize data)
  MIGRATE: {
    id: 'MIGRATE',
    sequence: ['REC', 'SYN'],
    description: 'Transform structure and merge data',
    examples: ['schema migration', 'data transformation']
  }
});

/**
 * Validate an operator sequence
 * @param {string[]} sequence - Array of operator IDs
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateOperatorSequence(sequence) {
  const result = { valid: true, errors: [], warnings: [] };

  if (!Array.isArray(sequence) || sequence.length === 0) {
    result.valid = false;
    result.errors.push('Sequence must be a non-empty array');
    return result;
  }

  // Check each operator is valid
  for (let i = 0; i < sequence.length; i++) {
    const op = sequence[i];
    if (!isValidOperator(op)) {
      result.valid = false;
      result.errors.push(`Invalid operator at position ${i}: ${op}`);
    }
  }

  if (!result.valid) return result;

  // Check for dangerous patterns

  // REC should generally be last (self-modification after other ops)
  const recIndex = sequence.indexOf('REC');
  if (recIndex !== -1 && recIndex < sequence.length - 1) {
    result.warnings.push('REC (recurse) is not at end of sequence - ensure this is intentional');
  }

  // SYN followed by more ops might lose data context
  const synIndex = sequence.indexOf('SYN');
  if (synIndex !== -1 && synIndex < sequence.length - 1) {
    result.warnings.push('SYN (synthesize) followed by more operators - original boundaries may be lost');
  }

  // Multiple REC is very dangerous
  const recCount = sequence.filter(op => op === 'REC').length;
  if (recCount > 1) {
    result.warnings.push('Multiple REC operators detected - high risk of cascade effects');
  }

  // NUL + INS in sequence is suspicious (delete then create = replace?)
  if (sequence.includes('NUL') && sequence.includes('INS')) {
    const nulIdx = sequence.indexOf('NUL');
    const insIdx = sequence.indexOf('INS');
    if (nulIdx < insIdx) {
      result.warnings.push('NUL followed by INS - consider using REPLACE compound pattern instead');
    }
  }

  return result;
}

/**
 * Get a compound pattern by ID
 */
function getCompoundPattern(patternId) {
  return CompoundPatterns[patternId] || null;
}

/**
 * Check if a sequence matches a known compound pattern
 */
function matchCompoundPattern(sequence) {
  for (const [id, pattern] of Object.entries(CompoundPatterns)) {
    if (arraysEqual(sequence, pattern.sequence)) {
      return pattern;
    }
  }
  return null;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ============================================================================
// Legacy Action Mapping
// ============================================================================

/**
 * Map legacy action strings to EO operators
 * This provides backwards compatibility with existing event payloads
 */
const LegacyActionMapping = Object.freeze({
  // Record operations
  'create_record': ['INS'],
  'update_record': ['DES'],
  'delete_record': ['NUL'],
  'tombstone_record': ['NUL'],
  'tombstone': ['NUL'],

  // Field operations
  'create_field': ['INS', 'DES'],
  'update_field': ['DES'],
  'rename_field': ['DES'],
  'delete_field': ['NUL'],
  'toggle_field_visibility': ['ALT'],
  'reorder_fields': ['DES'],

  // Set operations
  'create_set': ['INS', 'DES'],
  'rename_set': ['DES'],
  'delete_set': ['NUL'],
  'update_set_schema': ['DES'],

  // View operations
  'create_view': ['INS', 'DES'],
  'create_lens': ['INS', 'DES'],
  'update_view': ['DES'],
  'delete_view': ['NUL'],
  'apply_filter': ['SEG'],
  'remove_filter': ['SEG'],
  'sort_view': ['DES'],
  'group_view': ['SEG', 'DES'],

  // Link operations
  'link_record': ['CON'],
  'link_records': ['CON'],
  'unlink_record': ['SEG'],
  'unlink_records': ['SEG'],
  'create_edge': ['CON'],
  'delete_edge': ['SEG'],

  // Workspace operations
  'create_workspace': ['INS', 'DES'],
  'rename_workspace': ['DES'],
  'delete_workspace': ['NUL'],

  // Horizon operations
  'apply_horizon': ['SUP'],
  'refine_horizon': ['SEG', 'SUP'],
  'create_horizon': ['INS', 'DES'],

  // Merge/synthesis operations
  'merge_records': ['SYN'],
  'supersede': ['SYN'],
  'consolidate': ['SYN'],

  // Import operations
  'import_data': ['INS'],
  'import_csv': ['INS'],
  'import_json': ['INS'],

  // System operations
  'compliance_check': ['REC'],
  'self_audit': ['REC'],
  'schema_migration': ['REC', 'SYN'],
  'auto_correct': ['REC', 'DES']
});

/**
 * Convert a legacy action to EO operators
 * @param {string} legacyAction - The old action string
 * @returns {string[]} Array of EO operator IDs
 */
function mapLegacyAction(legacyAction) {
  const mapping = LegacyActionMapping[legacyAction];
  if (mapping) return [...mapping];

  // Try to infer from action name
  const lower = legacyAction.toLowerCase();

  if (lower.includes('create') || lower.includes('add') || lower.includes('new')) {
    return ['INS'];
  }
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('tombstone')) {
    return ['NUL'];
  }
  if (lower.includes('update') || lower.includes('rename') || lower.includes('set')) {
    return ['DES'];
  }
  if (lower.includes('link') || lower.includes('connect') || lower.includes('associate')) {
    return ['CON'];
  }
  if (lower.includes('unlink') || lower.includes('disconnect') || lower.includes('filter')) {
    return ['SEG'];
  }
  if (lower.includes('merge') || lower.includes('combine') || lower.includes('integrate')) {
    return ['SYN'];
  }
  if (lower.includes('toggle') || lower.includes('switch') || lower.includes('cycle')) {
    return ['ALT'];
  }
  if (lower.includes('overlay') || lower.includes('superpose') || lower.includes('horizon')) {
    return ['SUP'];
  }
  if (lower.includes('recurse') || lower.includes('self') || lower.includes('auto') || lower.includes('migrate')) {
    return ['REC'];
  }

  // Default: unknown action is a designation
  console.warn(`Unknown legacy action: ${legacyAction}, defaulting to DES`);
  return ['DES'];
}

// ============================================================================
// Operator Display Utilities
// ============================================================================

/**
 * Get display string for operator
 */
function formatOperator(operatorId) {
  const op = EOOperators[operatorId];
  if (!op) return operatorId;
  return `${op.symbol} ${op.name}`;
}

/**
 * Get display string for operator sequence
 */
function formatOperatorSequence(sequence) {
  return sequence.map(id => {
    const op = EOOperators[id];
    return op ? op.symbol : id;
  }).join(' → ');
}

/**
 * Get CSS class for operator category
 */
function getOperatorCategoryClass(operatorId) {
  const op = EOOperators[operatorId];
  if (!op) return '';
  return `op-${op.category}`;
}

/**
 * Render operator badge HTML
 */
function renderOperatorBadge(operatorId, options = {}) {
  const op = EOOperators[operatorId];
  if (!op) return `<span class="op-badge op-unknown">${operatorId}</span>`;

  const showName = options.showName !== false;
  const showSymbol = options.showSymbol !== false;

  const parts = [];
  if (showSymbol) parts.push(`<span class="op-symbol">${op.symbol}</span>`);
  if (showName) parts.push(`<span class="op-name">${op.name}</span>`);

  const dangerClass = op.dangerous ? ' op-dangerous' : '';

  return `<span class="op-badge op-${op.category}${dangerClass}" title="${op.description}">${parts.join('')}</span>`;
}

/**
 * Render operator sequence as HTML
 */
function renderOperatorSequence(sequence, options = {}) {
  const badges = sequence.map(id => renderOperatorBadge(id, { showName: false, ...options }));
  return `<span class="op-sequence">${badges.join('<span class="op-arrow">→</span>')}</span>`;
}

// ============================================================================
// Operator Styles
// ============================================================================

const operatorStyles = `
  /* Operator Badges */
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

  .op-symbol {
    font-size: 14px;
    font-weight: 600;
  }

  .op-name {
    font-size: 11px;
  }

  /* Category Colors */
  .op-recognition {
    background: rgba(156, 163, 175, 0.15);
    color: #6b7280;
    border: 1px solid rgba(156, 163, 175, 0.3);
  }

  .op-identity {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .op-boundary {
    background: rgba(168, 85, 247, 0.1);
    color: #7c3aed;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .op-temporal {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .op-integration {
    background: rgba(249, 115, 22, 0.1);
    color: #ea580c;
    border: 1px solid rgba(249, 115, 22, 0.3);
  }

  .op-reflexive {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .op-unknown {
    background: rgba(156, 163, 175, 0.1);
    color: #9ca3af;
    border: 1px solid rgba(156, 163, 175, 0.2);
  }

  .op-dangerous {
    box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.3);
  }

  /* Operator Sequence */
  .op-sequence {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .op-arrow {
    color: var(--text-muted, #9ca3af);
    font-size: 12px;
  }

  /* Operator Legend */
  .op-legend {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
    padding: 12px;
    background: var(--bg-secondary, #f9fafb);
    border-radius: 8px;
  }

  .op-legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  .op-legend-desc {
    color: var(--text-secondary, #6b7280);
    font-size: 11px;
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
    EOOperators,
    OperatorCategories,
    CompoundPatterns,
    LegacyActionMapping,
    isValidOperator,
    getOperator,
    getOperatorsByCategory,
    isDangerousOperator,
    isReversibleOperator,
    validateOperatorSequence,
    getCompoundPattern,
    matchCompoundPattern,
    mapLegacyAction,
    formatOperator,
    formatOperatorSequence,
    getOperatorCategoryClass,
    renderOperatorBadge,
    renderOperatorSequence
  };
}

if (typeof window !== 'undefined') {
  window.EOOperators = {
    operators: EOOperators,
    categories: OperatorCategories,
    compounds: CompoundPatterns,
    legacyMapping: LegacyActionMapping,
    isValid: isValidOperator,
    get: getOperator,
    getByCategory: getOperatorsByCategory,
    isDangerous: isDangerousOperator,
    isReversible: isReversibleOperator,
    validateSequence: validateOperatorSequence,
    getCompound: getCompoundPattern,
    matchCompound: matchCompoundPattern,
    mapLegacy: mapLegacyAction,
    format: formatOperator,
    formatSequence: formatOperatorSequence,
    getCategoryClass: getOperatorCategoryClass,
    renderBadge: renderOperatorBadge,
    renderSequence: renderOperatorSequence
  };
}
