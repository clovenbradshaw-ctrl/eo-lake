/**
 * EO Relational Merge - Phase-Space Mode
 *
 * A principled approach to data merging based on EO's merge-local coordinate system.
 * Users don't choose joins — they choose recognition, boundary handling, and decision
 * timing, and the system derives the appropriate operation.
 *
 * IMPORTANT DISTINCTION:
 * - Phaseposts describe what kind of thing EXISTS (ontological states)
 * - Merges describe how two descriptions are RELATED (relational operators)
 *
 * This module operates at the MERGE level, not the ontological level.
 * A merge is a local phase transition operator, not a world-state.
 *
 * THE THREE MERGE-LOCAL AXES:
 *
 * 1. RECOGNITION (R): Who is recognized as a row/entity
 *    −1 = Mutual only (both sides must recognize → INNER-like)
 *    +1 = One-sided (ground side recognized regardless → LEFT/RIGHT-like)
 *     0 = Independent (each side recognized independently → FULL-like)
 *
 * 2. BOUNDARY HANDLING (B): What happens to mismatches/absence
 *    −1 = Drop (erase mismatches)
 *    +1 = Mark (NULLs, placeholders)
 *    √2 = Expose structure (counts, diagnostics, gap tables, audit rows)
 *
 * 3. DECISION TIMING (D): When the merge becomes final
 *    −1 = Immediate (merge result is authoritative)
 *    +1 = Deferred (merge feeds later logic)
 *     0 = Non-final (merge is exploratory/inspect-only)
 *
 * A merge mode is written: [R, B, D]
 * This gives 3 × 3 × 3 = 27 merge-local modes.
 *
 * KEY INSIGHT:
 * INNER / LEFT / FULL are not identities — they are commitment bundles.
 * By decomposing into recognition, boundary handling, and decision timing,
 * we get EO's value without pretending a merge defines ontology.
 */

// ============================================================================
// Merge-Local Phasepost Constants
// ============================================================================

const MERGE_AXES = {
  RECOGNITION: {
    MUTUAL: -1,      // Both sides must recognize (INNER family)
    ONE_SIDED: 1,    // Ground side recognized regardless (LEFT/RIGHT family)
    INDEPENDENT: 0   // Each side recognized independently (FULL family)
  },
  BOUNDARY: {
    DROP: -1,        // Erase mismatches
    MARK: 1,         // NULLs / placeholders
    EXPOSE: '√2'     // Counts, diagnostics, gap tables, audit rows
  },
  DECISION: {
    IMMEDIATE: -1,   // Merge result is authoritative
    DEFERRED: 1,     // Merge feeds later logic
    NON_FINAL: 0     // Merge is exploratory / inspect-only
  }
};

/**
 * The 27 merge-local modes with their coordinates and descriptions.
 * Grouped by Recognition axis.
 */
const MERGE_MODES = {
  // ========== I. MUTUAL RECOGNITION (R = −1) — INNER family ==========

  // Drop mismatches
  'M1':  { coord: [-1, -1, -1], name: 'Classic INNER JOIN', description: 'Drop mismatches, decide immediately' },
  'M2':  { coord: [-1, -1,  1], name: 'INNER for staging', description: 'Drop mismatches, decide later' },
  'M3':  { coord: [-1, -1,  0], name: 'INNER preview', description: 'Drop mismatches, inspect only' },

  // Mark mismatches
  'M4':  { coord: [-1,  1, -1], name: 'INNER with NULL marking', description: 'Rare but explicit' },
  'M5':  { coord: [-1,  1,  1], name: 'INNER + audit', description: 'Marked gaps reviewed before decision' },
  'M6':  { coord: [-1,  1,  0], name: 'INNER diagnostics', description: 'Consensus rows only, gaps visible' },

  // Expose structure
  'M7':  { coord: [-1, '√2', -1], name: 'Loss-aware INNER', description: 'Gap structure exposed, still collapsed' },
  'M8':  { coord: [-1, '√2',  1], name: 'Contested INNER', description: 'Gap structure informs later decision' },
  'M9':  { coord: [-1, '√2',  0], name: 'Consensus gap analysis', description: 'Pure inspection of overlap failure' },

  // ========== II. ONE-SIDED RECOGNITION (R = +1) — LEFT/RIGHT family ==========

  // Drop mismatches
  'M10': { coord: [ 1, -1, -1], name: 'Strict LEFT/RIGHT JOIN', description: 'Drop unmatched non-ground rows' },
  'M11': { coord: [ 1, -1,  1], name: 'LEFT/RIGHT with deferred cleanup', description: 'Decide later' },
  'M12': { coord: [ 1, -1,  0], name: 'Ground-only preview', description: 'See what survives before commitment' },

  // Mark mismatches
  'M13': { coord: [ 1,  1, -1], name: 'Standard LEFT/RIGHT JOIN', description: 'NULLs marked, decision immediate' },
  'M14': { coord: [ 1,  1,  1], name: 'Governed LEFT/RIGHT', description: 'NULLs reviewed before enforcement' },
  'M15': { coord: [ 1,  1,  0], name: 'Grounded inspection', description: 'NULL patterns without commitment' },

  // Expose structure
  'M16': { coord: [ 1, '√2', -1], name: 'Accountable dominance', description: 'Gap structure tracked, ground enforced' },
  'M17': { coord: [ 1, '√2',  1], name: 'Equity-aware LEFT/RIGHT', description: 'Gap structure informs later rules' },
  'M18': { coord: [ 1, '√2',  0], name: 'Power analysis', description: 'Inspect who is excluded and how' },

  // ========== III. INDEPENDENT RECOGNITION (R = 0) — FULL family ==========

  // Drop mismatches
  'M19': { coord: [ 0, -1, -1], name: 'FULL then force collapse', description: 'Everything seen, then immediately reduced' },
  'M20': { coord: [ 0, -1,  1], name: 'FULL → later filter', description: 'Common ETL pattern' },
  'M21': { coord: [ 0, -1,  0], name: 'Parallel preview', description: 'Side-by-side without commitment' },

  // Mark mismatches
  'M22': { coord: [ 0,  1, -1], name: 'FULL with NULLs, immediate use', description: 'Common but risky' },
  'M23': { coord: [ 0,  1,  1], name: 'Exploratory FULL (safe default)', description: 'Inspect first, decide later' },
  'M24': { coord: [ 0,  1,  0], name: 'Sensemaking merge', description: 'Pure exploration' },

  // Expose structure
  'M25': { coord: [ 0, '√2', -1], name: 'Loss-accounted synthesis', description: 'Decision made with explicit loss metrics' },
  'M26': { coord: [ 0, '√2',  1], name: 'Reflective merge (EO best practice)', description: 'Structure first, decision later' },
  'M27': { coord: [ 0, '√2',  0], name: 'Maximum insight merge', description: 'No collapse, full gap visibility' }
};

// ============================================================================
// User-Facing Options (mapped to merge-local coordinates)
// ============================================================================

/**
 * Recognition Options (R-axis)
 * How rows are recognized relative to each other
 */
const RECOGNITION_OPTIONS = {
  MUTUAL: {
    id: 'mutual',
    phaseValue: -1,
    title: 'Mutual recognition',
    description: 'Both sides must recognize the entity.',
    details: 'Only rows matched by both sources survive. Unmatched rows do not appear in the result. Use when enforcing shared definitions.',
    tag: 'Consensus-only',
    icon: 'ph-handshake',
    sqlFamily: 'INNER'
  },
  ONE_SIDED: {
    id: 'one_sided',
    phaseValue: 1,
    title: 'One-sided recognition',
    description: 'One side grants recognition unilaterally.',
    details: 'The ground side defines what "counts." The other side may enrich but cannot contradict existence. Direction must be chosen.',
    tag: 'Asymmetric ground',
    icon: 'ph-crown-simple',
    requiresDirection: true,
    sqlFamily: 'LEFT/RIGHT'
  },
  INDEPENDENT: {
    id: 'independent',
    phaseValue: 0,
    title: 'Independent recognition',
    description: 'Each side is recognized independently.',
    details: 'Both sides contribute rows regardless of matches. Conflicting or unmatched rows may coexist. Use for exploration and reconciliation.',
    tag: 'Full inclusion',
    icon: 'ph-users-three',
    sqlFamily: 'FULL'
  }
};

/**
 * Boundary Handling Options (B-axis)
 * What happens to mismatches/absence
 */
const BOUNDARY_OPTIONS = {
  DROP: {
    id: 'drop',
    phaseValue: -1,
    title: 'Drop mismatches',
    description: 'Absence is noise.',
    details: 'Missing relationships are discarded. Boundaries are hard. Clean but brittle.',
    tag: 'Hard boundary',
    icon: 'ph-prohibit',
    warning: 'Mismatches will not be inspectable downstream.'
  },
  MARK: {
    id: 'mark',
    phaseValue: 1,
    title: 'Mark mismatches',
    description: 'Absence is preserved.',
    details: 'Gaps are marked with NULLs or placeholders. Mismatches are visible but not emphasized.',
    tag: 'Soft boundary',
    icon: 'ph-minus-circle'
  },
  EXPOSE: {
    id: 'expose',
    phaseValue: '√2',
    title: 'Expose mismatch structure',
    description: 'Absence is information.',
    details: 'Gap structure is fully exposed: counts, diagnostics, gap tables, audit rows. Mismatch patterns are analytically relevant.',
    tag: 'Structural boundary',
    icon: 'ph-chart-bar'
  }
};

/**
 * Decision Timing Options (D-axis)
 * When the merge becomes final
 */
const DECISION_OPTIONS = {
  IMMEDIATE: {
    id: 'immediate',
    phaseValue: -1,
    title: 'Decide immediately',
    description: 'Merge result is authoritative.',
    details: 'Decision is made during merge. Produces a single, stable output. Suitable for reporting and enforcement.',
    tag: 'Final',
    icon: 'ph-lightning'
  },
  DEFERRED: {
    id: 'deferred',
    phaseValue: 1,
    title: 'Defer decision',
    description: 'Merge feeds later logic.',
    details: 'Result preserved through merge. Resolution happens downstream via filters, rules, or review. Supports staged workflows.',
    tag: 'Staged',
    icon: 'ph-hourglass-medium'
  },
  NON_FINAL: {
    id: 'non_final',
    phaseValue: 0,
    title: 'Non-final (exploratory)',
    description: 'Merge is for inspection only.',
    details: 'No authoritative decision made. Used for sensemaking, preview, and analysis. Results may not be persisted.',
    tag: 'Exploratory',
    icon: 'ph-magnifying-glass'
  }
};

// ============================================================================
// Configuration to Operation Mapping
// ============================================================================

/**
 * Helper to get merge mode from coordinates
 */
function getMergeModeFromCoords(recognition, boundary, decision) {
  const coordStr = `${recognition},${boundary},${decision}`;

  for (const [key, mode] of Object.entries(MERGE_MODES)) {
    const modeCoordStr = mode.coord.join(',');
    if (modeCoordStr === coordStr) {
      return { key, ...mode };
    }
  }
  return null;
}

/**
 * Maps merge-local coordinates to SQL implementation
 */
function deriveJoinBehavior(recognition, boundary, decision) {
  const mode = getMergeModeFromCoords(recognition, boundary, decision);
  if (!mode) return null;

  // Determine base join type from recognition
  let joinType;
  if (recognition === -1) {
    joinType = 'INNER';
  } else if (recognition === 1) {
    joinType = 'LEFT'; // Direction chosen by user
  } else {
    joinType = 'FULL';
  }

  // Determine null handling from boundary
  let nullHandling;
  if (boundary === -1) {
    nullHandling = 'DROP';
  } else if (boundary === 1) {
    nullHandling = 'MARK';
  } else {
    nullHandling = 'EXPOSE';
  }

  // Determine finality from decision
  let finality;
  if (decision === -1) {
    finality = 'IMMEDIATE';
  } else if (decision === 1) {
    finality = 'DEFERRED';
  } else {
    finality = 'NON_FINAL';
  }

  // Build SQL equivalent description
  let sqlEquivalent = joinType + ' JOIN';
  const modifiers = [];

  if (boundary === -1) {
    modifiers.push('filtered');
  } else if (boundary === '√2') {
    modifiers.push('+ gap diagnostics');
  }

  if (decision === 1) {
    modifiers.push('deferred');
  } else if (decision === 0) {
    modifiers.push('preview only');
  }

  if (modifiers.length > 0) {
    sqlEquivalent += ` (${modifiers.join(', ')})`;
  }

  // Check if this requires custom/staged logic
  const requiresCustomLogic =
    boundary === '√2' || // Expose structure needs gap tables
    (recognition === 0 && boundary === -1); // FULL + drop is unusual

  return {
    mode: mode.key,
    name: mode.name,
    description: mode.description,
    coord: mode.coord,
    joinType,
    nullHandling,
    finality,
    preserveNulls: boundary !== -1,
    exposeStructure: boundary === '√2',
    deferDecision: decision !== -1,
    isExploratory: decision === 0,
    sqlEquivalent,
    requiresCustomLogic
  };
}

/**
 * Legacy configuration map for compatibility
 * Key format: {recognition}_{boundary}_{decision}
 */
const CONFIGURATION_MAP = {
  // ========== MUTUAL RECOGNITION (INNER family) ==========

  'mutual_drop_immediate': {
    coord: [-1, -1, -1],
    joinType: 'INNER',
    preserveNulls: false,
    exposeStructure: false,
    deferDecision: false,
    sqlEquivalent: 'INNER JOIN',
    modeName: 'Classic INNER JOIN'
  },
  'mutual_drop_deferred': {
    coord: [-1, -1, 1],
    joinType: 'INNER',
    preserveNulls: false,
    exposeStructure: false,
    deferDecision: true,
    sqlEquivalent: 'INNER JOIN (staged)',
    modeName: 'INNER for staging'
  },
  'mutual_drop_non_final': {
    coord: [-1, -1, 0],
    joinType: 'INNER',
    preserveNulls: false,
    exposeStructure: false,
    deferDecision: true,
    isExploratory: true,
    sqlEquivalent: 'INNER JOIN (preview)',
    modeName: 'INNER preview'
  },
  'mutual_mark_immediate': {
    coord: [-1, 1, -1],
    joinType: 'INNER',
    preserveNulls: true,
    exposeStructure: false,
    deferDecision: false,
    sqlEquivalent: 'INNER JOIN + NULL marking',
    modeName: 'INNER with NULL marking'
  },
  'mutual_mark_deferred': {
    coord: [-1, 1, 1],
    joinType: 'INNER',
    preserveNulls: true,
    exposeStructure: false,
    deferDecision: true,
    sqlEquivalent: 'INNER JOIN + audit (staged)',
    modeName: 'INNER + audit'
  },
  'mutual_mark_non_final': {
    coord: [-1, 1, 0],
    joinType: 'INNER',
    preserveNulls: true,
    exposeStructure: false,
    deferDecision: true,
    isExploratory: true,
    sqlEquivalent: 'INNER JOIN (diagnostics)',
    modeName: 'INNER diagnostics'
  },
  'mutual_expose_immediate': {
    coord: [-1, '√2', -1],
    joinType: 'INNER',
    preserveNulls: true,
    exposeStructure: true,
    deferDecision: false,
    sqlEquivalent: 'INNER JOIN + gap tables',
    modeName: 'Loss-aware INNER',
    requiresCustomLogic: true
  },
  'mutual_expose_deferred': {
    coord: [-1, '√2', 1],
    joinType: 'INNER',
    preserveNulls: true,
    exposeStructure: true,
    deferDecision: true,
    sqlEquivalent: 'INNER JOIN + gap tables (staged)',
    modeName: 'Contested INNER',
    requiresCustomLogic: true
  },
  'mutual_expose_non_final': {
    coord: [-1, '√2', 0],
    joinType: 'INNER',
    preserveNulls: true,
    exposeStructure: true,
    deferDecision: true,
    isExploratory: true,
    sqlEquivalent: 'Gap analysis only',
    modeName: 'Consensus gap analysis',
    requiresCustomLogic: true
  },

  // ========== ONE-SIDED RECOGNITION (LEFT/RIGHT family) ==========

  'one_sided_drop_immediate': {
    coord: [1, -1, -1],
    joinType: 'LEFT',
    preserveNulls: false,
    exposeStructure: false,
    deferDecision: false,
    sqlEquivalent: 'LEFT/RIGHT JOIN (filtered)',
    modeName: 'Strict LEFT/RIGHT JOIN'
  },
  'one_sided_drop_deferred': {
    coord: [1, -1, 1],
    joinType: 'LEFT',
    preserveNulls: false,
    exposeStructure: false,
    deferDecision: true,
    sqlEquivalent: 'LEFT/RIGHT JOIN (staged, filtered)',
    modeName: 'LEFT/RIGHT with deferred cleanup'
  },
  'one_sided_drop_non_final': {
    coord: [1, -1, 0],
    joinType: 'LEFT',
    preserveNulls: false,
    exposeStructure: false,
    deferDecision: true,
    isExploratory: true,
    sqlEquivalent: 'LEFT/RIGHT JOIN (preview)',
    modeName: 'Ground-only preview'
  },
  'one_sided_mark_immediate': {
    coord: [1, 1, -1],
    joinType: 'LEFT',
    preserveNulls: true,
    exposeStructure: false,
    deferDecision: false,
    sqlEquivalent: 'LEFT/RIGHT JOIN',
    modeName: 'Standard LEFT/RIGHT JOIN'
  },
  'one_sided_mark_deferred': {
    coord: [1, 1, 1],
    joinType: 'LEFT',
    preserveNulls: true,
    exposeStructure: false,
    deferDecision: true,
    sqlEquivalent: 'LEFT/RIGHT JOIN (staged)',
    modeName: 'Governed LEFT/RIGHT'
  },
  'one_sided_mark_non_final': {
    coord: [1, 1, 0],
    joinType: 'LEFT',
    preserveNulls: true,
    exposeStructure: false,
    deferDecision: true,
    isExploratory: true,
    sqlEquivalent: 'LEFT/RIGHT JOIN (inspection)',
    modeName: 'Grounded inspection'
  },
  'one_sided_expose_immediate': {
    coord: [1, '√2', -1],
    joinType: 'LEFT',
    preserveNulls: true,
    exposeStructure: true,
    deferDecision: false,
    sqlEquivalent: 'LEFT/RIGHT JOIN + gap tables',
    modeName: 'Accountable dominance',
    requiresCustomLogic: true
  },
  'one_sided_expose_deferred': {
    coord: [1, '√2', 1],
    joinType: 'LEFT',
    preserveNulls: true,
    exposeStructure: true,
    deferDecision: true,
    sqlEquivalent: 'LEFT/RIGHT JOIN + gap tables (staged)',
    modeName: 'Equity-aware LEFT/RIGHT',
    requiresCustomLogic: true
  },
  'one_sided_expose_non_final': {
    coord: [1, '√2', 0],
    joinType: 'LEFT',
    preserveNulls: true,
    exposeStructure: true,
    deferDecision: true,
    isExploratory: true,
    sqlEquivalent: 'Power analysis',
    modeName: 'Power analysis',
    requiresCustomLogic: true
  },

  // ========== INDEPENDENT RECOGNITION (FULL family) ==========

  'independent_drop_immediate': {
    coord: [0, -1, -1],
    joinType: 'FULL',
    preserveNulls: false,
    exposeStructure: false,
    deferDecision: false,
    sqlEquivalent: 'FULL OUTER JOIN (then collapse)',
    modeName: 'FULL then force collapse',
    requiresCustomLogic: true
  },
  'independent_drop_deferred': {
    coord: [0, -1, 1],
    joinType: 'FULL',
    preserveNulls: false,
    exposeStructure: false,
    deferDecision: true,
    sqlEquivalent: 'FULL OUTER JOIN → later filter',
    modeName: 'FULL → later filter'
  },
  'independent_drop_non_final': {
    coord: [0, -1, 0],
    joinType: 'FULL',
    preserveNulls: false,
    exposeStructure: false,
    deferDecision: true,
    isExploratory: true,
    sqlEquivalent: 'FULL OUTER JOIN (parallel preview)',
    modeName: 'Parallel preview'
  },
  'independent_mark_immediate': {
    coord: [0, 1, -1],
    joinType: 'FULL',
    preserveNulls: true,
    exposeStructure: false,
    deferDecision: false,
    sqlEquivalent: 'FULL OUTER JOIN',
    modeName: 'FULL with NULLs, immediate use'
  },
  'independent_mark_deferred': {
    coord: [0, 1, 1],
    joinType: 'FULL',
    preserveNulls: true,
    exposeStructure: false,
    deferDecision: true,
    sqlEquivalent: 'FULL OUTER JOIN (staged)',
    modeName: 'Exploratory FULL (safe default)',
    isRecommended: true
  },
  'independent_mark_non_final': {
    coord: [0, 1, 0],
    joinType: 'FULL',
    preserveNulls: true,
    exposeStructure: false,
    deferDecision: true,
    isExploratory: true,
    sqlEquivalent: 'FULL OUTER JOIN (sensemaking)',
    modeName: 'Sensemaking merge'
  },
  'independent_expose_immediate': {
    coord: [0, '√2', -1],
    joinType: 'FULL',
    preserveNulls: true,
    exposeStructure: true,
    deferDecision: false,
    sqlEquivalent: 'FULL OUTER JOIN + loss metrics',
    modeName: 'Loss-accounted synthesis',
    requiresCustomLogic: true
  },
  'independent_expose_deferred': {
    coord: [0, '√2', 1],
    joinType: 'FULL',
    preserveNulls: true,
    exposeStructure: true,
    deferDecision: true,
    sqlEquivalent: 'FULL OUTER JOIN + gap tables (staged)',
    modeName: 'Reflective merge (EO best practice)',
    isRecommended: true,
    requiresCustomLogic: true
  },
  'independent_expose_non_final': {
    coord: [0, '√2', 0],
    joinType: 'FULL',
    preserveNulls: true,
    exposeStructure: true,
    deferDecision: true,
    isExploratory: true,
    sqlEquivalent: 'Maximum insight (no collapse)',
    modeName: 'Maximum insight merge',
    requiresCustomLogic: true
  }
};


// ============================================================================
// RelationalMergeConfig - Configuration State Management
// ============================================================================

class RelationalMergeConfig {
  constructor() {
    this.reset();
  }

  reset() {
    // The three merge-local axes
    this.recognition = null;        // 'mutual' | 'one_sided' | 'independent'
    this.recognitionDirection = null; // 'left' | 'right' (only for one_sided)
    this.boundary = null;           // 'drop' | 'mark' | 'expose'
    this.decision = null;           // 'immediate' | 'deferred' | 'non_final'

    // Sources and join configuration
    this.leftSource = null;
    this.rightSource = null;
    this.joinConditions = [];
    this.outputFields = [];
    this.setName = '';
  }

  setRecognition(recognition, direction = null) {
    this.recognition = recognition;
    this.recognitionDirection = recognition === 'one_sided' ? (direction || 'left') : null;
  }

  setBoundary(boundary) {
    this.boundary = boundary;
  }

  setDecision(decision) {
    this.decision = decision;
  }

  setLeftSource(source) {
    this.leftSource = source;
  }

  setRightSource(source) {
    this.rightSource = source;
  }

  isComplete() {
    return this.recognition && this.boundary && this.decision;
  }

  /**
   * Get the coordinate values [R, B, D] for this configuration
   */
  getCoordinates() {
    if (!this.isComplete()) return null;

    const r = RECOGNITION_OPTIONS[this.recognition.toUpperCase()]?.phaseValue;
    const b = BOUNDARY_OPTIONS[this.boundary.toUpperCase()]?.phaseValue;
    const d = DECISION_OPTIONS[this.decision.toUpperCase()]?.phaseValue;

    return [r, b, d];
  }

  getConfigKey() {
    if (!this.isComplete()) return null;
    return `${this.recognition}_${this.boundary}_${this.decision}`;
  }

  getDerivedOperation() {
    const key = this.getConfigKey();
    if (!key) return null;
    return CONFIGURATION_MAP[key] || null;
  }

  getMergeMode() {
    const coords = this.getCoordinates();
    if (!coords) return null;
    return getMergeModeFromCoords(...coords);
  }

  getJoinType() {
    const op = this.getDerivedOperation();
    if (!op) return null;

    // Handle direction for one-sided recognition
    if (this.recognition === 'one_sided') {
      return this.recognitionDirection === 'right' ? 'RIGHT' : 'LEFT';
    }

    return op.joinType;
  }

  getSummary() {
    const recognitionLabel = this.recognition
      ? RECOGNITION_OPTIONS[this.recognition.toUpperCase()]?.title || this.recognition
      : 'Not set';
    const boundaryLabel = this.boundary
      ? BOUNDARY_OPTIONS[this.boundary.toUpperCase()]?.title || this.boundary
      : 'Not set';
    const decisionLabel = this.decision
      ? DECISION_OPTIONS[this.decision.toUpperCase()]?.title || this.decision
      : 'Not set';

    return {
      recognition: recognitionLabel,
      boundary: boundaryLabel,
      decision: decisionLabel
    };
  }

  getPlainLanguageDescription() {
    if (!this.isComplete()) return null;

    const parts = [];

    // Recognition description
    switch (this.recognition) {
      case 'mutual':
        parts.push('only rows matched by both sources survive');
        break;
      case 'one_sided':
        parts.push(`all rows from ${this.recognitionDirection === 'right' ? 'Source B' : 'Source A'} are preserved`);
        break;
      case 'independent':
        parts.push('rows from both sources are preserved independently');
        break;
    }

    // Boundary description
    switch (this.boundary) {
      case 'drop':
        parts.push('mismatches are discarded');
        break;
      case 'mark':
        parts.push('mismatches are marked with NULLs');
        break;
      case 'expose':
        parts.push('mismatch structure is fully exposed');
        break;
    }

    // Decision description
    switch (this.decision) {
      case 'immediate':
        parts.push('decision is final');
        break;
      case 'deferred':
        parts.push('decision is deferred to downstream logic');
        break;
      case 'non_final':
        parts.push('result is exploratory only');
        break;
    }

    return `This merge ${parts.join(', ')}.`;
  }

  getGuardrailWarnings() {
    const warnings = [];
    const op = this.getDerivedOperation();

    // Independent + non-final = exploration mode
    if (this.recognition === 'independent' && this.decision === 'non_final') {
      warnings.push('This is a pure exploration mode. Results should not be used for authoritative decisions.');
    }

    // Drop boundary warning
    if (this.boundary === 'drop') {
      warnings.push('Dropped mismatches cannot be recovered or inspected downstream.');
    }

    // One-sided without direction
    if (this.recognition === 'one_sided' && !this.recognitionDirection) {
      warnings.push('One-sided recognition requires choosing which source has priority.');
    }

    // Custom logic required
    if (op?.requiresCustomLogic) {
      warnings.push('This configuration requires staged or custom logic beyond standard SQL.');
    }

    // Recommended configuration
    if (op?.isRecommended) {
      warnings.push('This is an EO-recommended configuration for safe exploration.');
    }

    return warnings.filter(w => !w.includes('recommended')); // Don't show "recommended" as warning
  }

  getRecommendations() {
    const recommendations = [];
    const op = this.getDerivedOperation();

    if (op?.isRecommended) {
      recommendations.push('This is an EO-recommended configuration.');
    }

    // Suggest safer alternatives for risky configs
    if (this.boundary === 'drop' && this.decision === 'immediate') {
      recommendations.push('Consider using "Mark mismatches" or "Defer decision" for more visibility.');
    }

    return recommendations;
  }

  toJSON() {
    const mode = this.getMergeMode();
    return {
      recognition: this.recognition,
      recognitionDirection: this.recognitionDirection,
      boundary: this.boundary,
      decision: this.decision,
      coordinates: this.getCoordinates(),
      configKey: this.getConfigKey(),
      mergeMode: mode ? { key: mode.key, name: mode.name } : null,
      derivedOperation: this.getDerivedOperation(),
      joinType: this.getJoinType(),
      leftSource: this.leftSource?.id,
      rightSource: this.rightSource?.id,
      joinConditions: this.joinConditions,
      outputFields: this.outputFields,
      setName: this.setName
    };
  }
}


// ============================================================================
// RelationalMergeUI - User Interface
// ============================================================================

class RelationalMergeUI {
  constructor(sourceStore, container) {
    this.sourceStore = sourceStore;
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    this.config = new RelationalMergeConfig();
    this._onComplete = null;
    this._onCancel = null;
    this._currentStep = 'sources'; // 'sources' | 'relational' | 'conditions' | 'review'
    this._purposeShown = false;
  }

  show(options = {}) {
    this._onComplete = options.onComplete;
    this._onCancel = options.onCancel;
    this._purposeShown = false;
    this._currentStep = 'sources';
    this.config.reset();
    this._render();
  }

  hide() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
    }
  }

  _render() {
    const sources = this.sourceStore.getByStatus('active');

    this.container.style.display = 'block';
    this.container.innerHTML = `
      <div class="relational-merge-overlay">
        <div class="relational-merge-modal">
          ${this._renderHeader()}
          <div class="relational-merge-body">
            ${this._renderStepIndicator()}
            ${this._renderCurrentStep(sources)}
          </div>
          ${this._renderFooter()}
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  _renderHeader() {
    return `
      <div class="relational-merge-header">
        <h2><i class="ph ph-git-merge"></i> Relational Merge</h2>
        <p class="relational-merge-subtitle">Define how realities coexist before they are combined</p>
        <button class="relational-merge-close" id="rm-close-btn">
          <i class="ph ph-x"></i>
        </button>
      </div>
    `;
  }

  _renderStepIndicator() {
    const steps = [
      { id: 'sources', label: 'Sources', icon: 'ph-database' },
      { id: 'relational', label: 'Relational Position', icon: 'ph-compass' },
      { id: 'conditions', label: 'Conditions', icon: 'ph-link' },
      { id: 'review', label: 'Review', icon: 'ph-check-circle' }
    ];

    const currentIndex = steps.findIndex(s => s.id === this._currentStep);

    return `
      <div class="rm-step-indicator">
        ${steps.map((step, i) => `
          <div class="rm-step ${i === currentIndex ? 'active' : ''} ${i < currentIndex ? 'completed' : ''}">
            <div class="rm-step-icon">
              ${i < currentIndex ? '<i class="ph ph-check"></i>' : `<i class="ph ${step.icon}"></i>`}
            </div>
            <span class="rm-step-label">${step.label}</span>
          </div>
          ${i < steps.length - 1 ? '<div class="rm-step-line"></div>' : ''}
        `).join('')}
      </div>
    `;
  }

  _renderCurrentStep(sources) {
    switch (this._currentStep) {
      case 'sources':
        return this._renderSourcesStep(sources);
      case 'relational':
        return this._renderRelationalStep();
      case 'conditions':
        return this._renderConditionsStep();
      case 'review':
        return this._renderReviewStep();
      default:
        return '';
    }
  }

  _renderSourcesStep(sources) {
    return `
      <div class="rm-step-content">
        <div class="rm-sources-section">
          <div class="rm-source-picker">
            <label>First Source (A)</label>
            <select id="rm-left-source" class="rm-source-select">
              <option value="">Select source...</option>
              ${sources.map(s => `
                <option value="${s.id}" ${this.config.leftSource?.id === s.id ? 'selected' : ''}>
                  ${this._escapeHtml(s.name)} (${s.recordCount} records)
                </option>
              `).join('')}
            </select>
            ${this.config.leftSource ? this._renderSourcePreview(this.config.leftSource, 'left') : ''}
          </div>

          <div class="rm-source-connector">
            <div class="rm-connector-icon">
              <i class="ph ph-git-merge"></i>
            </div>
          </div>

          <div class="rm-source-picker">
            <label>Second Source (B)</label>
            <select id="rm-right-source" class="rm-source-select">
              <option value="">Select source...</option>
              ${sources.map(s => `
                <option value="${s.id}" ${this.config.rightSource?.id === s.id ? 'selected' : ''}>
                  ${this._escapeHtml(s.name)} (${s.recordCount} records)
                </option>
              `).join('')}
            </select>
            ${this.config.rightSource ? this._renderSourcePreview(this.config.rightSource, 'right') : ''}
          </div>
        </div>
      </div>
    `;
  }

  _renderSourcePreview(source, side) {
    const fields = source.schema?.fields || [];
    return `
      <div class="rm-source-preview">
        <div class="rm-source-stats">
          <span><i class="ph ph-rows"></i> ${source.recordCount} records</span>
          <span><i class="ph ph-columns"></i> ${fields.length} fields</span>
        </div>
        <div class="rm-field-list">
          ${fields.slice(0, 6).map(f => `
            <span class="rm-field-chip">
              <i class="ph ${this._getFieldTypeIcon(f.type)}"></i>
              ${this._escapeHtml(f.name)}
            </span>
          `).join('')}
          ${fields.length > 6 ? `<span class="rm-field-more">+${fields.length - 6} more</span>` : ''}
        </div>
      </div>
    `;
  }

  _renderRelationalStep() {
    return `
      <div class="rm-step-content rm-relational-content">
        ${!this._purposeShown ? `
          <div class="rm-purpose-banner" id="rm-purpose-banner">
            <p><em>A merge is a choice about recognition, boundaries, and when you're willing to decide.</em></p>
            <button class="rm-purpose-dismiss" id="rm-purpose-dismiss">
              <i class="ph ph-x"></i>
            </button>
          </div>
        ` : ''}

        <div class="rm-panels">
          ${this._renderRecognitionPanel()}
          ${this._renderBoundaryPanel()}
          ${this._renderDecisionPanel()}
        </div>

        ${this._renderPhaseSummary()}
      </div>
    `;
  }

  _renderRecognitionPanel() {
    return `
      <div class="rm-panel ${this.config.recognition ? 'rm-panel-set' : ''}">
        <div class="rm-panel-header">
          <h3><i class="ph ph-users"></i> Recognition</h3>
          <span class="rm-panel-question">Who is recognized as a row?</span>
        </div>
        <p class="rm-panel-prompt">How are rows recognized relative to each other?</p>

        <div class="rm-options">
          ${Object.values(RECOGNITION_OPTIONS).map(opt => `
            <button class="rm-option ${this.config.recognition === opt.id ? 'selected' : ''}"
                    data-panel="recognition" data-value="${opt.id}">
              <div class="rm-option-icon"><i class="ph ${opt.icon}"></i></div>
              <div class="rm-option-content">
                <span class="rm-option-title">${opt.title}</span>
                <span class="rm-option-desc">${opt.description}</span>
                <span class="rm-option-details">${opt.details}</span>
              </div>
              <span class="rm-option-tag">${opt.tag}</span>
            </button>
          `).join('')}
        </div>

        ${this.config.recognition === 'one_sided' ? `
          <div class="rm-direction-picker">
            <label>Which source has priority?</label>
            <div class="rm-direction-options">
              <button class="rm-direction-btn ${this.config.recognitionDirection === 'left' ? 'selected' : ''}"
                      data-direction="left">
                <i class="ph ph-arrow-left"></i>
                <span>Source A (${this._escapeHtml(this.config.leftSource?.name || 'Left')})</span>
              </button>
              <button class="rm-direction-btn ${this.config.recognitionDirection === 'right' ? 'selected' : ''}"
                      data-direction="right">
                <i class="ph ph-arrow-right"></i>
                <span>Source B (${this._escapeHtml(this.config.rightSource?.name || 'Right')})</span>
              </button>
            </div>
          </div>
        ` : ''}

        ${this.config.recognition ? '<div class="rm-panel-status"><i class="ph ph-check-circle"></i> Recognition set</div>' : ''}
      </div>
    `;
  }

  _renderBoundaryPanel() {
    return `
      <div class="rm-panel ${this.config.boundary ? 'rm-panel-set' : ''}">
        <div class="rm-panel-header">
          <h3><i class="ph ph-map-trifold"></i> Boundary Handling</h3>
          <span class="rm-panel-question">What happens to mismatches?</span>
        </div>
        <p class="rm-panel-prompt">When an expected relationship is missing, how should the system handle it?</p>

        <div class="rm-options">
          ${Object.values(BOUNDARY_OPTIONS).map(opt => `
            <button class="rm-option ${this.config.boundary === opt.id ? 'selected' : ''}"
                    data-panel="boundary" data-value="${opt.id}">
              <div class="rm-option-icon"><i class="ph ${opt.icon}"></i></div>
              <div class="rm-option-content">
                <span class="rm-option-title">${opt.title}</span>
                <span class="rm-option-desc">${opt.description}</span>
                <span class="rm-option-details">${opt.details}</span>
              </div>
              <span class="rm-option-tag">${opt.tag}</span>
            </button>
          `).join('')}
        </div>

        ${this.config.boundary === 'drop' ? `
          <div class="rm-panel-note">
            <i class="ph ph-warning"></i>
            <span>Mismatches will not be inspectable downstream.</span>
          </div>
        ` : ''}

        ${this.config.boundary ? '<div class="rm-panel-status"><i class="ph ph-check-circle"></i> Boundary handling set</div>' : ''}
      </div>
    `;
  }

  _renderDecisionPanel() {
    return `
      <div class="rm-panel ${this.config.decision ? 'rm-panel-set' : ''}">
        <div class="rm-panel-header">
          <h3><i class="ph ph-clock"></i> Decision Timing</h3>
          <span class="rm-panel-question">When does this become final?</span>
        </div>
        <p class="rm-panel-prompt">When does the merge result become authoritative?</p>

        <div class="rm-options">
          ${Object.values(DECISION_OPTIONS).map(opt => `
            <button class="rm-option ${this.config.decision === opt.id ? 'selected' : ''}"
                    data-panel="decision" data-value="${opt.id}">
              <div class="rm-option-icon"><i class="ph ${opt.icon}"></i></div>
              <div class="rm-option-content">
                <span class="rm-option-title">${opt.title}</span>
                <span class="rm-option-desc">${opt.description}</span>
                <span class="rm-option-details">${opt.details}</span>
              </div>
              <span class="rm-option-tag">${opt.tag}</span>
            </button>
          `).join('')}
        </div>

        ${this.config.decision ? '<div class="rm-panel-status"><i class="ph ph-check-circle"></i> Decision timing set</div>' : ''}
      </div>
    `;
  }

  _renderPhaseSummary() {
    if (!this.config.isComplete()) {
      return `
        <div class="rm-phase-summary rm-phase-incomplete">
          <div class="rm-phase-header">
            <i class="ph ph-compass"></i>
            <span>Merge Mode</span>
          </div>
          <p class="rm-phase-message">Select an option from each panel to define your merge mode.</p>
        </div>
      `;
    }

    const summary = this.config.getSummary();
    const description = this.config.getPlainLanguageDescription();
    const warnings = this.config.getGuardrailWarnings();
    const recommendations = this.config.getRecommendations();
    const operation = this.config.getDerivedOperation();
    const mode = this.config.getMergeMode();
    const coords = this.config.getCoordinates();

    return `
      <div class="rm-phase-summary rm-phase-complete">
        <div class="rm-phase-header">
          <i class="ph ph-check-circle"></i>
          <span>Merge Mode Defined</span>
          ${mode ? `<code class="rm-mode-code">[${coords.join(', ')}]</code>` : ''}
        </div>

        ${mode ? `<div class="rm-mode-name">${mode.name}</div>` : ''}

        <div class="rm-phase-values">
          <div class="rm-phase-value">
            <label>Recognition:</label>
            <span>${summary.recognition}</span>
          </div>
          <div class="rm-phase-value">
            <label>Boundaries:</label>
            <span>${summary.boundary}</span>
          </div>
          <div class="rm-phase-value">
            <label>Decision:</label>
            <span>${summary.decision}</span>
          </div>
        </div>

        <p class="rm-phase-description">${description}</p>

        ${recommendations.length > 0 ? `
          <div class="rm-phase-recommendations">
            ${recommendations.map(r => `
              <div class="rm-recommendation">
                <i class="ph ph-star"></i>
                <span>${r}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${warnings.length > 0 ? `
          <div class="rm-phase-warnings">
            ${warnings.map(w => `
              <div class="rm-warning">
                <i class="ph ph-info"></i>
                <span>${w}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <details class="rm-derived-operation">
          <summary><i class="ph ph-code"></i> Implementation view</summary>
          <div class="rm-derived-content">
            <div class="rm-derived-behavior">
              <strong>Derived behavior:</strong>
              <ul>
                <li>${this._getDerivedBehaviorText()}</li>
              </ul>
            </div>
            <div class="rm-derived-sql">
              <strong>SQL equivalent:</strong>
              <code>${operation?.sqlEquivalent || 'Custom logic required'}</code>
            </div>
            ${operation?.requiresCustomLogic ? `
              <p class="rm-derived-note">
                <em>This configuration requires staged or custom logic beyond standard SQL.</em>
              </p>
            ` : ''}
          </div>
        </details>
      </div>
    `;
  }

  _getDerivedBehaviorText() {
    const behaviors = [];
    const op = this.config.getDerivedOperation();

    // Recognition behavior
    if (this.config.recognition === 'mutual') {
      behaviors.push('Only rows matched by both sources survive');
    } else if (this.config.recognition === 'one_sided') {
      behaviors.push(`All rows from ${this.config.recognitionDirection === 'right' ? 'Source B' : 'Source A'} are preserved`);
    } else {
      behaviors.push('Rows from both sources are preserved independently');
    }

    // Boundary behavior
    if (this.config.boundary === 'drop') {
      behaviors.push('Discard mismatches');
    } else if (this.config.boundary === 'expose') {
      behaviors.push('Expose mismatch structure (gap tables, diagnostics)');
    } else {
      behaviors.push('Mark mismatches with NULLs');
    }

    // Decision behavior
    if (this.config.decision === 'immediate') {
      behaviors.push('Decision is final');
    } else if (this.config.decision === 'deferred') {
      behaviors.push('Decision deferred to downstream logic');
    } else {
      behaviors.push('Result is exploratory only');
    }

    return behaviors.join('</li><li>');
  }

  _renderConditionsStep() {
    const leftFields = this.config.leftSource?.schema?.fields || [];
    const rightFields = this.config.rightSource?.schema?.fields || [];

    return `
      <div class="rm-step-content">
        <div class="rm-conditions-section">
          <h3><i class="ph ph-link"></i> Join Conditions</h3>
          <p class="rm-section-desc">Map fields between sources to connect records</p>

          <div class="rm-conditions-list" id="rm-conditions-list">
            ${this.config.joinConditions.length === 0 ? `
              <div class="rm-condition-empty">
                <i class="ph ph-arrow-fat-lines-right"></i>
                <span>Add a condition to connect the sources</span>
              </div>
            ` : this.config.joinConditions.map((c, i) => this._renderCondition(c, i, leftFields, rightFields)).join('')}
          </div>

          <button class="rm-add-condition-btn" id="rm-add-condition-btn">
            <i class="ph ph-plus"></i> Add Condition
          </button>
        </div>

        <div class="rm-output-section">
          <h3><i class="ph ph-columns"></i> Output Fields</h3>
          <p class="rm-section-desc">Select which fields to include in the result</p>

          <div class="rm-output-controls">
            <button class="rm-output-btn" id="rm-add-all-left-btn">
              <i class="ph ph-check-square"></i> Add All from A
            </button>
            <button class="rm-output-btn" id="rm-add-all-right-btn">
              <i class="ph ph-check-square"></i> Add All from B
            </button>
          </div>

          <div class="rm-output-list" id="rm-output-list">
            ${this.config.outputFields.length === 0 ? `
              <div class="rm-output-empty">
                <span>No fields selected</span>
              </div>
            ` : this.config.outputFields.map((f, i) => this._renderOutputField(f, i)).join('')}
          </div>
        </div>

        <div class="rm-name-section">
          <label>Set Name</label>
          <input type="text" id="rm-set-name" class="rm-set-name-input"
                 placeholder="Enter name for the merged set..."
                 value="${this._escapeHtml(this.config.setName || '')}">
        </div>
      </div>
    `;
  }

  _renderCondition(condition, index, leftFields, rightFields) {
    return `
      <div class="rm-condition" data-index="${index}">
        <select class="rm-condition-left">
          <option value="">Select field from A...</option>
          ${leftFields.map(f => `
            <option value="${f.name}" ${condition.leftField === f.name ? 'selected' : ''}>
              ${this._escapeHtml(f.name)}
            </option>
          `).join('')}
        </select>

        <select class="rm-condition-operator">
          <option value="eq" ${condition.operator === 'eq' ? 'selected' : ''}>=</option>
          <option value="contains" ${condition.operator === 'contains' ? 'selected' : ''}>contains</option>
          <option value="starts" ${condition.operator === 'starts' ? 'selected' : ''}>starts with</option>
          <option value="ends" ${condition.operator === 'ends' ? 'selected' : ''}>ends with</option>
        </select>

        <select class="rm-condition-right">
          <option value="">Select field from B...</option>
          ${rightFields.map(f => `
            <option value="${f.name}" ${condition.rightField === f.name ? 'selected' : ''}>
              ${this._escapeHtml(f.name)}
            </option>
          `).join('')}
        </select>

        <button class="rm-condition-remove" title="Remove condition">
          <i class="ph ph-x"></i>
        </button>
      </div>
    `;
  }

  _renderOutputField(field, index) {
    return `
      <div class="rm-output-field" data-index="${index}">
        <span class="rm-output-source ${field.source}">
          ${field.source === 'left' ? 'A' : 'B'}
        </span>
        <span class="rm-output-name">${this._escapeHtml(field.field)}</span>
        <button class="rm-output-remove" title="Remove field">
          <i class="ph ph-x"></i>
        </button>
      </div>
    `;
  }

  _renderReviewStep() {
    const summary = this.config.getSummary();
    const operation = this.config.getDerivedOperation();

    return `
      <div class="rm-step-content rm-review-content">
        <div class="rm-review-section">
          <h3><i class="ph ph-info"></i> Merge Summary</h3>

          <div class="rm-review-grid">
            <div class="rm-review-item">
              <label>Sources</label>
              <div class="rm-review-sources">
                <span class="rm-review-source">${this._escapeHtml(this.config.leftSource?.name || 'Source A')}</span>
                <i class="ph ph-git-merge"></i>
                <span class="rm-review-source">${this._escapeHtml(this.config.rightSource?.name || 'Source B')}</span>
              </div>
            </div>

            <div class="rm-review-item">
              <label>Merge Mode</label>
              <div class="rm-review-position">
                <span><strong>Recognition:</strong> ${summary.recognition}</span>
                <span><strong>Boundaries:</strong> ${summary.boundary}</span>
                <span><strong>Decision:</strong> ${summary.decision}</span>
              </div>
            </div>

            <div class="rm-review-item">
              <label>Derived Operation</label>
              <code class="rm-review-operation">${operation?.sqlEquivalent || 'Custom'}</code>
            </div>

            <div class="rm-review-item">
              <label>Join Conditions</label>
              <div class="rm-review-conditions">
                ${this.config.joinConditions.length === 0
                  ? '<span class="rm-review-empty">No conditions defined</span>'
                  : this.config.joinConditions.map(c =>
                      `<span>${this._escapeHtml(c.leftField)} ${c.operator === 'eq' ? '=' : c.operator} ${this._escapeHtml(c.rightField)}</span>`
                    ).join('')
                }
              </div>
            </div>

            <div class="rm-review-item">
              <label>Output Fields</label>
              <span>${this.config.outputFields.length} fields selected</span>
            </div>

            <div class="rm-review-item">
              <label>Result Set Name</label>
              <span>${this._escapeHtml(this.config.setName) || 'Untitled'}</span>
            </div>
          </div>
        </div>

        <div class="rm-review-preview" id="rm-preview-section">
          <button class="rm-preview-btn" id="rm-preview-btn">
            <i class="ph ph-eye"></i> Preview Results
          </button>
          <div class="rm-preview-results" id="rm-preview-results"></div>
        </div>

        <div class="rm-review-warning">
          <i class="ph ph-warning"></i>
          <span>What you erase now cannot be recovered.</span>
        </div>
      </div>
    `;
  }

  _renderFooter() {
    const canProceed = this._canProceedFromCurrentStep();
    const isLastStep = this._currentStep === 'review';

    return `
      <div class="relational-merge-footer">
        <div class="rm-footer-left">
          ${this._currentStep !== 'sources' ? `
            <button class="rm-btn rm-btn-secondary" id="rm-back-btn">
              <i class="ph ph-arrow-left"></i> Back
            </button>
          ` : ''}
        </div>
        <div class="rm-footer-right">
          <button class="rm-btn rm-btn-secondary" id="rm-cancel-btn">Cancel</button>
          <button class="rm-btn rm-btn-primary" id="rm-next-btn" ${!canProceed ? 'disabled' : ''}>
            ${isLastStep ? '<i class="ph ph-check"></i> Apply relational assumptions' : 'Continue <i class="ph ph-arrow-right"></i>'}
          </button>
        </div>
      </div>
    `;
  }

  _canProceedFromCurrentStep() {
    switch (this._currentStep) {
      case 'sources':
        return this.config.leftSource && this.config.rightSource;
      case 'relational':
        return this.config.isComplete();
      case 'conditions':
        return this.config.joinConditions.length > 0 && this.config.outputFields.length > 0;
      case 'review':
        return true;
      default:
        return false;
    }
  }

  _attachEventListeners() {
    // Close button
    this.container.querySelector('#rm-close-btn')?.addEventListener('click', () => {
      this.hide();
      this._onCancel?.();
    });

    // Cancel button
    this.container.querySelector('#rm-cancel-btn')?.addEventListener('click', () => {
      this.hide();
      this._onCancel?.();
    });

    // Back button
    this.container.querySelector('#rm-back-btn')?.addEventListener('click', () => {
      this._goToPreviousStep();
    });

    // Next/Apply button
    this.container.querySelector('#rm-next-btn')?.addEventListener('click', () => {
      if (this._currentStep === 'review') {
        this._executeMerge();
      } else {
        this._goToNextStep();
      }
    });

    // Purpose banner dismiss
    this.container.querySelector('#rm-purpose-dismiss')?.addEventListener('click', () => {
      this._purposeShown = true;
      this.container.querySelector('#rm-purpose-banner')?.remove();
    });

    // Source selection
    this.container.querySelector('#rm-left-source')?.addEventListener('change', (e) => {
      const source = this.sourceStore.get(e.target.value);
      this.config.leftSource = source;
      this._render();
    });

    this.container.querySelector('#rm-right-source')?.addEventListener('change', (e) => {
      const source = this.sourceStore.get(e.target.value);
      this.config.rightSource = source;
      this._render();
    });

    // Panel option selection
    this.container.querySelectorAll('.rm-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;
        const value = btn.dataset.value;

        if (panel === 'recognition') {
          this.config.setRecognition(value);
        } else if (panel === 'boundary') {
          this.config.setBoundary(value);
        } else if (panel === 'decision') {
          this.config.setDecision(value);
        }

        this._render();
      });
    });

    // Direction selection (for one-sided recognition)
    this.container.querySelectorAll('.rm-direction-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.config.recognitionDirection = btn.dataset.direction;
        this._render();
      });
    });

    // Add condition button
    this.container.querySelector('#rm-add-condition-btn')?.addEventListener('click', () => {
      this.config.joinConditions.push({
        id: `cond_${Date.now()}`,
        leftField: '',
        rightField: '',
        operator: 'eq'
      });
      this._render();
    });

    // Condition changes
    this.container.querySelectorAll('.rm-condition').forEach(condEl => {
      const index = parseInt(condEl.dataset.index);
      const condition = this.config.joinConditions[index];

      condEl.querySelector('.rm-condition-left')?.addEventListener('change', (e) => {
        condition.leftField = e.target.value;
        this._updateNextButtonState();
      });

      condEl.querySelector('.rm-condition-operator')?.addEventListener('change', (e) => {
        condition.operator = e.target.value;
        this._updateNextButtonState();
      });

      condEl.querySelector('.rm-condition-right')?.addEventListener('change', (e) => {
        condition.rightField = e.target.value;
        this._updateNextButtonState();
      });

      condEl.querySelector('.rm-condition-remove')?.addEventListener('click', () => {
        this.config.joinConditions.splice(index, 1);
        this._render();
      });
    });

    // Add all fields buttons
    this.container.querySelector('#rm-add-all-left-btn')?.addEventListener('click', () => {
      this._addAllFieldsFromSource('left');
    });

    this.container.querySelector('#rm-add-all-right-btn')?.addEventListener('click', () => {
      this._addAllFieldsFromSource('right');
    });

    // Remove output field
    this.container.querySelectorAll('.rm-output-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.closest('.rm-output-field').dataset.index);
        this.config.outputFields.splice(index, 1);
        this._render();
      });
    });

    // Set name input
    this.container.querySelector('#rm-set-name')?.addEventListener('input', (e) => {
      this.config.setName = e.target.value;
    });

    // Preview button
    this.container.querySelector('#rm-preview-btn')?.addEventListener('click', () => {
      this._showPreview();
    });
  }

  _updateNextButtonState() {
    const nextBtn = this.container.querySelector('#rm-next-btn');
    if (nextBtn) {
      const canProceed = this._canProceedFromCurrentStep();
      nextBtn.disabled = !canProceed;
    }
  }

  _goToNextStep() {
    const steps = ['sources', 'relational', 'conditions', 'review'];
    const currentIndex = steps.indexOf(this._currentStep);
    if (currentIndex < steps.length - 1) {
      this._currentStep = steps[currentIndex + 1];
      this._render();
    }
  }

  _goToPreviousStep() {
    const steps = ['sources', 'relational', 'conditions', 'review'];
    const currentIndex = steps.indexOf(this._currentStep);
    if (currentIndex > 0) {
      this._currentStep = steps[currentIndex - 1];
      this._render();
    }
  }

  _addAllFieldsFromSource(side) {
    const source = side === 'left' ? this.config.leftSource : this.config.rightSource;
    if (!source) return;

    const fields = source.schema?.fields || [];
    for (const field of fields) {
      // Check if already added
      const exists = this.config.outputFields.some(f =>
        f.source === side && f.field === field.name
      );
      if (!exists) {
        this.config.outputFields.push({
          source: side,
          field: field.name,
          type: field.type
        });
      }
    }
    this._render();
  }

  _showPreview() {
    const previewEl = this.container.querySelector('#rm-preview-results');
    if (!previewEl) return;

    // Validate conditions
    const validConditions = this.config.joinConditions.filter(c =>
      c.leftField && c.rightField
    );

    if (validConditions.length === 0) {
      previewEl.innerHTML = `
        <div class="rm-preview-error">
          <i class="ph ph-warning"></i>
          <span>Add at least one complete join condition</span>
        </div>
      `;
      return;
    }

    // Execute preview
    try {
      const result = this._executeJoin(true);

      if (!result.success) {
        previewEl.innerHTML = `
          <div class="rm-preview-error">
            <i class="ph ph-warning"></i>
            <span>${result.error || 'Preview failed'}</span>
          </div>
        `;
        return;
      }

      const records = result.records.slice(0, 10);
      const fields = result.fields;

      previewEl.innerHTML = `
        <div class="rm-preview-table-wrapper">
          <table class="rm-preview-table">
            <thead>
              <tr>
                ${fields.map(f => `<th>${this._escapeHtml(f.name)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${records.map(rec => `
                <tr>
                  ${fields.map(f => `
                    <td>${this._escapeHtml(String(rec.values?.[f.name] ?? rec[f.name] ?? ''))}</td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="rm-preview-info">
          Showing ${records.length} of ${result.totalCount} records
        </div>
      `;
    } catch (error) {
      previewEl.innerHTML = `
        <div class="rm-preview-error">
          <i class="ph ph-warning"></i>
          <span>${error.message || 'Preview failed'}</span>
        </div>
      `;
    }
  }

  _executeJoin(previewOnly = false) {
    const leftSource = this.config.leftSource;
    const rightSource = this.config.rightSource;

    if (!leftSource || !rightSource) {
      return { success: false, error: 'Both sources must be selected' };
    }

    const joinType = this.config.getJoinType();
    const conditions = this.config.joinConditions.filter(c => c.leftField && c.rightField);

    if (conditions.length === 0) {
      return { success: false, error: 'At least one join condition is required' };
    }

    const leftRecords = leftSource.records || [];
    const rightRecords = rightSource.records || [];

    // Build field list
    const outputFields = this.config.outputFields.map(f => ({
      name: f.rename || f.field,
      originalField: f.field,
      source: f.source,
      type: f.type || 'text'
    }));

    // Execute join based on type
    const results = [];
    const leftMatched = new Set();
    const rightMatched = new Set();

    // Match records
    for (let li = 0; li < leftRecords.length; li++) {
      const leftRec = leftRecords[li];

      for (let ri = 0; ri < rightRecords.length; ri++) {
        const rightRec = rightRecords[ri];

        // Check all conditions
        const matches = conditions.every(cond => {
          const leftVal = leftRec[cond.leftField];
          const rightVal = rightRec[cond.rightField];

          switch (cond.operator) {
            case 'eq':
              return String(leftVal).toLowerCase() === String(rightVal).toLowerCase();
            case 'contains':
              return String(leftVal).toLowerCase().includes(String(rightVal).toLowerCase());
            case 'starts':
              return String(leftVal).toLowerCase().startsWith(String(rightVal).toLowerCase());
            case 'ends':
              return String(leftVal).toLowerCase().endsWith(String(rightVal).toLowerCase());
            default:
              return leftVal === rightVal;
          }
        });

        if (matches) {
          leftMatched.add(li);
          rightMatched.add(ri);

          const merged = {};
          for (const f of outputFields) {
            const sourceRec = f.source === 'left' ? leftRec : rightRec;
            merged[f.name] = sourceRec[f.originalField];
          }
          results.push({ values: merged });
        }
      }
    }

    // Handle unmatched records based on join type
    if (joinType === 'LEFT' || joinType === 'FULL') {
      for (let li = 0; li < leftRecords.length; li++) {
        if (!leftMatched.has(li)) {
          const leftRec = leftRecords[li];
          const merged = {};
          for (const f of outputFields) {
            if (f.source === 'left') {
              merged[f.name] = leftRec[f.originalField];
            } else {
              merged[f.name] = null;
            }
          }
          results.push({ values: merged });
        }
      }
    }

    if (joinType === 'RIGHT' || joinType === 'FULL') {
      for (let ri = 0; ri < rightRecords.length; ri++) {
        if (!rightMatched.has(ri)) {
          const rightRec = rightRecords[ri];
          const merged = {};
          for (const f of outputFields) {
            if (f.source === 'right') {
              merged[f.name] = rightRec[f.originalField];
            } else {
              merged[f.name] = null;
            }
          }
          results.push({ values: merged });
        }
      }
    }

    if (previewOnly) {
      return {
        success: true,
        records: results,
        fields: outputFields,
        totalCount: results.length
      };
    }

    return {
      success: true,
      records: results,
      fields: outputFields
    };
  }

  _executeMerge() {
    const result = this._executeJoin(false);

    if (!result.success) {
      // Show error
      alert(result.error || 'Merge failed');
      return;
    }

    // Create the new set
    const timestamp = new Date().toISOString();
    const setId = `set_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    const newSet = {
      id: setId,
      name: this.config.setName || 'Merged Set',
      icon: 'ph-git-merge',
      fields: result.fields.map((f, i) => ({
        id: `fld_${Date.now().toString(36)}_${i}`,
        name: f.name,
        type: f.type || 'text',
        width: 150
      })),
      records: result.records.map((rec, i) => ({
        id: `rec_${Date.now().toString(36)}_${i}`,
        setId: setId,
        values: rec.values,
        createdAt: timestamp,
        updatedAt: timestamp
      })),
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
          { type: 'source', id: this.config.leftSource?.id },
          { type: 'source', id: this.config.rightSource?.id }
        ],
        relationalPosition: this.config.toJSON(),
        joinConfig: {
          type: this.config.getJoinType(),
          conditions: this.config.joinConditions
        }
      }
    };

    // Call completion handler
    this.hide();
    this._onComplete?.({
      set: newSet,
      stats: {
        resultRecords: result.records.length,
        leftSource: this.config.leftSource?.name,
        rightSource: this.config.rightSource?.name,
        joinType: this.config.getJoinType(),
        relationalPosition: this.config.getConfigKey()
      }
    });
  }

  _getFieldTypeIcon(type) {
    const typeIcons = {
      'text': 'ph-text-t',
      'number': 'ph-hash',
      'date': 'ph-calendar',
      'datetime': 'ph-clock',
      'boolean': 'ph-toggle-left',
      'currency': 'ph-currency-dollar',
      'email': 'ph-envelope',
      'url': 'ph-link',
      'phone': 'ph-phone'
    };
    return typeIcons[type?.toLowerCase()] || 'ph-text-t';
  }

  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}


// ============================================================================
// Export
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Core classes
    RelationalMergeConfig,
    RelationalMergeUI,
    // Merge-local axis options
    RECOGNITION_OPTIONS,
    BOUNDARY_OPTIONS,
    DECISION_OPTIONS,
    // Merge modes and configuration
    MERGE_AXES,
    MERGE_MODES,
    CONFIGURATION_MAP,
    // Helper functions
    getMergeModeFromCoords,
    deriveJoinBehavior
  };
}

if (typeof window !== 'undefined') {
  // Core classes
  window.RelationalMergeConfig = RelationalMergeConfig;
  window.RelationalMergeUI = RelationalMergeUI;
  // Merge-local axis options
  window.RECOGNITION_OPTIONS = RECOGNITION_OPTIONS;
  window.BOUNDARY_OPTIONS = BOUNDARY_OPTIONS;
  window.DECISION_OPTIONS = DECISION_OPTIONS;
  // Merge modes and configuration
  window.MERGE_AXES = MERGE_AXES;
  window.MERGE_MODES = MERGE_MODES;
  window.CONFIGURATION_MAP = CONFIGURATION_MAP;
  // Helper functions
  window.getMergeModeFromCoords = getMergeModeFromCoords;
  window.deriveJoinBehavior = deriveJoinBehavior;
}
