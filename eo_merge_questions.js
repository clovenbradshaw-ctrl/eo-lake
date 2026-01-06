/**
 * EO Merge Questions - The 3 Questions Framework
 *
 * This module embodies the core principle:
 * "Users don't choose joins. They answer three questions about how
 * realities should relate - and the system derives everything else."
 *
 * THE THREE QUESTIONS:
 *
 * Q1. RECOGNITION: "Who is recognized as a row/entity?"
 *     How do the two sources grant existence to entities?
 *
 * Q2. BOUNDARY: "What happens to mismatches/absence?"
 *     When an expected relationship is missing, how should the gap be treated?
 *
 * Q3. RESOLUTION: "When do differences collapse?"
 *     How long should plurality be allowed to exist?
 *
 * These 3 questions with 3 answers each create 27 semantic merge modes.
 * SQL join types are DERIVED from answers, not chosen directly.
 */

// ============================================================================
// THE THREE QUESTIONS
// ============================================================================

/**
 * Question 1: Recognition
 * "Who is recognized as a row/entity?"
 */
const Recognition = {
  MUTUAL: {
    value: -1,
    id: 'mutual',
    answer: 'Both sides must agree',
    meaning: 'An entity exists only if both sources recognize it',
    implies: 'INNER JOIN family',
    icon: 'ph-handshake',
    tag: 'Consensus-only'
  },
  ONE_SIDED: {
    value: 1,
    id: 'one_sided',
    answer: 'One side decides',
    meaning: 'One source defines existence; the other enriches but cannot veto',
    implies: 'LEFT/RIGHT JOIN family',
    icon: 'ph-crown-simple',
    tag: 'Asymmetric ground',
    requiresDirection: true
  },
  INDEPENDENT: {
    value: 0,
    id: 'independent',
    answer: 'Each side decides independently',
    meaning: 'Both sources grant existence independently; no agreement required',
    implies: 'FULL JOIN family',
    icon: 'ph-users-three',
    tag: 'Independent existence'
  }
};

/**
 * Question 2: Boundary
 * "What happens to mismatches/absence?"
 */
const Boundary = {
  DROP: {
    value: -1,
    id: 'drop',
    answer: 'Discard them',
    meaning: 'Gaps are noise to be eliminated',
    implies: 'Hard filtering',
    icon: 'ph-prohibit',
    tag: 'Hard boundary',
    warning: 'Erased gaps cannot be recovered'
  },
  MARK: {
    value: 1,
    id: 'mark',
    answer: 'Mark them as NULL',
    meaning: 'Gaps are preserved but flagged as absent',
    implies: 'NULL placeholders',
    icon: 'ph-minus-circle',
    tag: 'Soft boundary'
  },
  EXPOSE: {
    value: '√2',
    id: 'expose',
    answer: 'Make them visible as structure',
    meaning: 'Gaps are data - create diagnostics, gap tables, audit trails',
    implies: 'Gap analysis + audit rows',
    icon: 'ph-chart-bar',
    tag: 'Permeable boundary'
  }
};

/**
 * Question 3: Resolution
 * "When do differences collapse?"
 */
const Resolution = {
  IMMEDIATE: {
    value: -1,
    id: 'immediate',
    answer: 'Now',
    meaning: 'The merge result is authoritative; differences are eliminated',
    implies: 'Final output',
    icon: 'ph-lightning',
    tag: 'Static resolution'
  },
  DEFERRED: {
    value: 1,
    id: 'deferred',
    answer: 'Later',
    meaning: 'Plurality preserved; downstream logic decides',
    implies: 'Staging for review',
    icon: 'ph-hourglass-medium',
    tag: 'Dynamic resolution'
  },
  NON_FINAL: {
    value: 0,
    id: 'non_final',
    answer: 'Never (inspection only)',
    meaning: 'Multiple perspectives remain active; for exploration',
    implies: 'No collapse',
    icon: 'ph-magnifying-glass',
    tag: 'Recursive resolution'
  }
};

// ============================================================================
// MERGE POSITION - Answers to All 3 Questions
// ============================================================================

/**
 * A MergePosition represents a complete answer to all 3 questions.
 * From this, we derive SQL operations, behaviors, and guardrails.
 */
class MergePosition {
  constructor(recognition, boundary, resolution, direction = null) {
    this.recognition = this._normalize(recognition, Recognition);
    this.boundary = this._normalize(boundary, Boundary);
    this.resolution = this._normalize(resolution, Resolution);
    this.direction = direction; // 'left' | 'right' for one-sided recognition
  }

  _normalize(value, questionEnum) {
    if (typeof value === 'string') {
      const key = value.toUpperCase();
      return questionEnum[key] || null;
    }
    return value;
  }

  /**
   * Get the coordinate vector [R, B, D]
   */
  getCoordinates() {
    if (!this.isComplete()) return null;
    return [
      this.recognition.value,
      this.boundary.value,
      this.resolution.value
    ];
  }

  /**
   * Check if all 3 questions are answered
   */
  isComplete() {
    return this.recognition && this.boundary && this.resolution;
  }

  /**
   * Get the mode key (e.g., 'mutual_mark_deferred')
   */
  getModeKey() {
    if (!this.isComplete()) return null;
    return `${this.recognition.id}_${this.boundary.id}_${this.resolution.id}`;
  }

  /**
   * DERIVE the SQL join type from answers
   * This is the key insight: SQL is derived, not chosen
   */
  deriveJoinType() {
    if (!this.recognition) return null;

    switch (this.recognition.id) {
      case 'mutual': return 'INNER';
      case 'one_sided': return this.direction === 'right' ? 'RIGHT' : 'LEFT';
      case 'independent': return 'FULL';
      default: return null;
    }
  }

  /**
   * DERIVE how to handle NULLs/gaps
   */
  deriveNullHandling() {
    if (!this.boundary) return null;

    switch (this.boundary.id) {
      case 'drop': return { preserve: false, expose: false };
      case 'mark': return { preserve: true, expose: false };
      case 'expose': return { preserve: true, expose: true };
      default: return null;
    }
  }

  /**
   * DERIVE finality/timing behavior
   */
  deriveFinality() {
    if (!this.resolution) return null;

    switch (this.resolution.id) {
      case 'immediate': return { deferred: false, exploratory: false };
      case 'deferred': return { deferred: true, exploratory: false };
      case 'non_final': return { deferred: true, exploratory: true };
      default: return null;
    }
  }

  /**
   * Get the complete derived behavior from all 3 answers
   */
  deriveBehavior() {
    if (!this.isComplete()) return null;

    const joinType = this.deriveJoinType();
    const nullHandling = this.deriveNullHandling();
    const finality = this.deriveFinality();

    // Build SQL equivalent description
    let sqlBase = `${joinType} JOIN`;
    const modifiers = [];

    if (!nullHandling.preserve) modifiers.push('filtered');
    if (nullHandling.expose) modifiers.push('+ gap analysis');
    if (finality.deferred) modifiers.push('staged');
    if (finality.exploratory) modifiers.push('preview only');

    const sqlEquivalent = modifiers.length > 0
      ? `${sqlBase} (${modifiers.join(', ')})`
      : sqlBase;

    return {
      joinType,
      preserveNulls: nullHandling.preserve,
      exposeStructure: nullHandling.expose,
      deferDecision: finality.deferred,
      isExploratory: finality.exploratory,
      sqlEquivalent,
      requiresCustomLogic: nullHandling.expose ||
        (this.recognition.id === 'independent' && !nullHandling.preserve),
      modeKey: this.getModeKey(),
      coordinates: this.getCoordinates()
    };
  }

  /**
   * Get plain-language description of what this position means
   */
  describe() {
    if (!this.isComplete()) return null;

    const parts = [];

    // Recognition
    if (this.recognition.id === 'mutual') {
      parts.push('requires mutual recognition');
    } else if (this.recognition.id === 'one_sided') {
      const ground = this.direction === 'right' ? 'Source B' : 'Source A';
      parts.push(`grants ${ground} authority`);
    } else {
      parts.push('preserves independent existence');
    }

    // Boundary
    if (this.boundary.id === 'drop') {
      parts.push('erases gaps');
    } else if (this.boundary.id === 'mark') {
      parts.push('marks gaps');
    } else {
      parts.push('exposes gap structure');
    }

    // Resolution
    if (this.resolution.id === 'immediate') {
      parts.push('collapses immediately');
    } else if (this.resolution.id === 'deferred') {
      parts.push('defers collapse');
    } else {
      parts.push('persists plurality');
    }

    return `This merge ${parts.join(', ')}.`;
  }

  /**
   * Get guardrail warnings for this position
   */
  getWarnings() {
    const warnings = [];

    if (this.boundary?.id === 'drop') {
      warnings.push({
        level: 'caution',
        message: 'Erased gaps cannot be recovered or inspected downstream.'
      });
    }

    if (this.recognition?.id === 'independent' && this.resolution?.id === 'non_final') {
      warnings.push({
        level: 'info',
        message: 'This preserves plurality indefinitely. Ensure downstream systems handle multiple truths.'
      });
    }

    if (this.recognition?.id === 'one_sided' && !this.direction) {
      warnings.push({
        level: 'required',
        message: 'One-sided recognition requires choosing which source has authority.'
      });
    }

    const behavior = this.deriveBehavior();
    if (behavior?.requiresCustomLogic) {
      warnings.push({
        level: 'info',
        message: 'This configuration requires staged or custom logic beyond standard SQL.'
      });
    }

    return warnings;
  }

  /**
   * Check if this is an EO-recommended position
   */
  isRecommended() {
    const key = this.getModeKey();
    return RECOMMENDED_MODES.includes(key);
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      recognition: this.recognition?.id,
      boundary: this.boundary?.id,
      resolution: this.resolution?.id,
      direction: this.direction,
      coordinates: this.getCoordinates(),
      modeKey: this.getModeKey(),
      behavior: this.deriveBehavior()
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json) {
    return new MergePosition(
      json.recognition,
      json.boundary,
      json.resolution,
      json.direction
    );
  }
}

// ============================================================================
// THE 27 MODES - Named Positions
// ============================================================================

const MODES = {
  // === MUTUAL RECOGNITION (INNER family) ===
  'M1':  { coord: [-1, -1, -1], key: 'mutual_drop_immediate', name: 'Classic INNER JOIN' },
  'M2':  { coord: [-1, -1,  1], key: 'mutual_drop_deferred', name: 'INNER for staging' },
  'M3':  { coord: [-1, -1,  0], key: 'mutual_drop_non_final', name: 'INNER preview' },
  'M4':  { coord: [-1,  1, -1], key: 'mutual_mark_immediate', name: 'INNER with NULL marking' },
  'M5':  { coord: [-1,  1,  1], key: 'mutual_mark_deferred', name: 'INNER + audit' },
  'M6':  { coord: [-1,  1,  0], key: 'mutual_mark_non_final', name: 'INNER diagnostics' },
  'M7':  { coord: [-1, '√2', -1], key: 'mutual_expose_immediate', name: 'Loss-aware INNER' },
  'M8':  { coord: [-1, '√2',  1], key: 'mutual_expose_deferred', name: 'Contested INNER' },
  'M9':  { coord: [-1, '√2',  0], key: 'mutual_expose_non_final', name: 'Consensus gap analysis' },

  // === ONE-SIDED RECOGNITION (LEFT/RIGHT family) ===
  'M10': { coord: [ 1, -1, -1], key: 'one_sided_drop_immediate', name: 'Strict LEFT/RIGHT JOIN' },
  'M11': { coord: [ 1, -1,  1], key: 'one_sided_drop_deferred', name: 'LEFT/RIGHT with deferred cleanup' },
  'M12': { coord: [ 1, -1,  0], key: 'one_sided_drop_non_final', name: 'Ground-only preview' },
  'M13': { coord: [ 1,  1, -1], key: 'one_sided_mark_immediate', name: 'Standard LEFT/RIGHT JOIN' },
  'M14': { coord: [ 1,  1,  1], key: 'one_sided_mark_deferred', name: 'Governed LEFT/RIGHT' },
  'M15': { coord: [ 1,  1,  0], key: 'one_sided_mark_non_final', name: 'Grounded inspection' },
  'M16': { coord: [ 1, '√2', -1], key: 'one_sided_expose_immediate', name: 'Accountable dominance' },
  'M17': { coord: [ 1, '√2',  1], key: 'one_sided_expose_deferred', name: 'Equity-aware LEFT/RIGHT' },
  'M18': { coord: [ 1, '√2',  0], key: 'one_sided_expose_non_final', name: 'Power analysis' },

  // === INDEPENDENT RECOGNITION (FULL family) ===
  'M19': { coord: [ 0, -1, -1], key: 'independent_drop_immediate', name: 'FULL then force collapse' },
  'M20': { coord: [ 0, -1,  1], key: 'independent_drop_deferred', name: 'FULL then later filter' },
  'M21': { coord: [ 0, -1,  0], key: 'independent_drop_non_final', name: 'Parallel preview' },
  'M22': { coord: [ 0,  1, -1], key: 'independent_mark_immediate', name: 'FULL with NULLs (immediate)' },
  'M23': { coord: [ 0,  1,  1], key: 'independent_mark_deferred', name: 'Exploratory FULL (safe default)' },
  'M24': { coord: [ 0,  1,  0], key: 'independent_mark_non_final', name: 'Sensemaking merge' },
  'M25': { coord: [ 0, '√2', -1], key: 'independent_expose_immediate', name: 'Loss-accounted synthesis' },
  'M26': { coord: [ 0, '√2',  1], key: 'independent_expose_deferred', name: 'Reflective merge (EO best practice)' },
  'M27': { coord: [ 0, '√2',  0], key: 'independent_expose_non_final', name: 'Maximum insight merge' }
};

// EO-recommended modes
const RECOMMENDED_MODES = [
  'independent_mark_deferred',    // M23 - safe default for exploration
  'independent_expose_deferred'   // M26 - EO best practice
];

/**
 * Find a mode by coordinates
 */
function findModeByCoordinates(r, b, d) {
  const coordStr = `${r},${b},${d}`;
  for (const [id, mode] of Object.entries(MODES)) {
    if (mode.coord.join(',') === coordStr) {
      return { id, ...mode };
    }
  }
  return null;
}

/**
 * Find a mode by key
 */
function findModeByKey(key) {
  for (const [id, mode] of Object.entries(MODES)) {
    if (mode.key === key) {
      return { id, ...mode };
    }
  }
  return null;
}

// ============================================================================
// MERGE EXECUTOR - Compute results from a position
// ============================================================================

/**
 * Execute a merge based on a MergePosition.
 * This is the computation engine that implements the derived behavior.
 */
class MergeExecutor {
  /**
   * Execute a merge
   * @param {MergePosition} position - The merge position (3 questions answered)
   * @param {Array} leftRecords - Records from source A
   * @param {Array} rightRecords - Records from source B
   * @param {Array} conditions - Join conditions [{leftField, rightField, operator}]
   * @param {Array} outputFields - Fields to include [{name, source, originalField}]
   * @param {Object} options - Execution options
   */
  execute(position, leftRecords, rightRecords, conditions, outputFields, options = {}) {
    if (!position.isComplete()) {
      return { success: false, error: 'Position incomplete - answer all 3 questions' };
    }

    const behavior = position.deriveBehavior();
    const { onProgress } = options;

    // Initialize tracking
    const results = [];
    const leftMatched = new Set();
    const rightMatched = new Set();
    const gapInfo = behavior.exposeStructure ? { leftGaps: [], rightGaps: [] } : null;

    // Progress tracking
    const totalOps = leftRecords.length * rightRecords.length;
    let completed = 0;
    const progressInterval = Math.max(1, Math.floor(totalOps / 100));

    // Match records
    for (let li = 0; li < leftRecords.length; li++) {
      const leftRec = leftRecords[li];

      for (let ri = 0; ri < rightRecords.length; ri++) {
        const rightRec = rightRecords[ri];

        if (this._matchesConditions(leftRec, rightRec, conditions)) {
          leftMatched.add(li);
          rightMatched.add(ri);
          results.push(this._buildRecord(leftRec, rightRec, outputFields));
        }

        completed++;
        if (onProgress && completed % progressInterval === 0) {
          onProgress(completed / totalOps);
        }
      }
    }

    // Handle unmatched based on derived join type
    const joinType = behavior.joinType;

    if (joinType === 'LEFT' || joinType === 'FULL') {
      for (let li = 0; li < leftRecords.length; li++) {
        if (!leftMatched.has(li)) {
          if (behavior.preserveNulls) {
            results.push(this._buildRecord(leftRecords[li], null, outputFields));
          }
          if (gapInfo) {
            gapInfo.leftGaps.push({ index: li, record: leftRecords[li] });
          }
        }
      }
    }

    if (joinType === 'RIGHT' || joinType === 'FULL') {
      for (let ri = 0; ri < rightRecords.length; ri++) {
        if (!rightMatched.has(ri)) {
          if (behavior.preserveNulls) {
            results.push(this._buildRecord(null, rightRecords[ri], outputFields));
          }
          if (gapInfo) {
            gapInfo.rightGaps.push({ index: ri, record: rightRecords[ri] });
          }
        }
      }
    }

    if (onProgress) onProgress(1);

    return {
      success: true,
      records: results,
      totalCount: results.length,
      stats: {
        leftTotal: leftRecords.length,
        rightTotal: rightRecords.length,
        leftMatched: leftMatched.size,
        rightMatched: rightMatched.size,
        joinType: behavior.joinType
      },
      gaps: gapInfo,
      behavior
    };
  }

  _matchesConditions(leftRec, rightRec, conditions) {
    return conditions.every(cond => {
      const leftVal = this._getValue(leftRec, cond.leftField);
      const rightVal = this._getValue(rightRec, cond.rightField);
      return this._evaluate(leftVal, rightVal, cond.operator);
    });
  }

  _getValue(record, fieldName) {
    if (!record) return null;
    if (record.values && typeof record.values === 'object') {
      return record.values[fieldName];
    }
    return record[fieldName];
  }

  _evaluate(left, right, operator) {
    if (left == null || right == null) return false;

    const l = String(left).toLowerCase();
    const r = String(right).toLowerCase();

    switch (operator) {
      case 'eq':
      case '=':
        return l === r;
      case 'contains':
        return l.includes(r) || r.includes(l);
      case 'starts':
        return l.startsWith(r);
      case 'ends':
        return l.endsWith(r);
      case 'neq':
      case '!=':
        return l !== r;
      default:
        return l === r;
    }
  }

  _buildRecord(leftRec, rightRec, outputFields) {
    const values = {};
    for (const field of outputFields) {
      const sourceRec = field.source === 'left' ? leftRec : rightRec;
      const fieldName = field.originalField || field.name;
      // Use field.id as key for grid compatibility, fall back to field.name for preview
      const valueKey = field.id || field.name;
      values[valueKey] = sourceRec ? this._getValue(sourceRec, fieldName) : null;
    }
    return { values };
  }
}

// ============================================================================
// BUILDER API - Fluent interface for creating merge positions
// ============================================================================

/**
 * Fluent builder for creating merge positions by answering questions
 */
class MergeBuilder {
  constructor() {
    this._recognition = null;
    this._boundary = null;
    this._resolution = null;
    this._direction = null;
  }

  // Question 1: Recognition
  mutualRecognition() {
    this._recognition = Recognition.MUTUAL;
    return this;
  }

  oneSidedRecognition(direction = 'left') {
    this._recognition = Recognition.ONE_SIDED;
    this._direction = direction;
    return this;
  }

  independentRecognition() {
    this._recognition = Recognition.INDEPENDENT;
    return this;
  }

  // Question 2: Boundary
  dropMismatches() {
    this._boundary = Boundary.DROP;
    return this;
  }

  markMismatches() {
    this._boundary = Boundary.MARK;
    return this;
  }

  exposeMismatches() {
    this._boundary = Boundary.EXPOSE;
    return this;
  }

  // Question 3: Resolution
  resolveImmediately() {
    this._resolution = Resolution.IMMEDIATE;
    return this;
  }

  resolveDeferred() {
    this._resolution = Resolution.DEFERRED;
    return this;
  }

  neverResolve() {
    this._resolution = Resolution.NON_FINAL;
    return this;
  }

  // Build the position
  build() {
    return new MergePosition(
      this._recognition,
      this._boundary,
      this._resolution,
      this._direction
    );
  }

  // Convenience: get derived behavior directly
  deriveBehavior() {
    return this.build().deriveBehavior();
  }
}

/**
 * Entry point for fluent API
 */
function createMerge() {
  return new MergeBuilder();
}

// ============================================================================
// PRESETS - Common merge positions
// ============================================================================

const Presets = {
  // Safe default - explore without commitment
  SAFE_EXPLORATION: () => createMerge()
    .independentRecognition()
    .markMismatches()
    .resolveDeferred()
    .build(),

  // EO best practice - full visibility
  EO_BEST_PRACTICE: () => createMerge()
    .independentRecognition()
    .exposeMismatches()
    .resolveDeferred()
    .build(),

  // Classic inner join
  CLASSIC_INNER: () => createMerge()
    .mutualRecognition()
    .dropMismatches()
    .resolveImmediately()
    .build(),

  // Standard left join
  STANDARD_LEFT: (direction = 'left') => createMerge()
    .oneSidedRecognition(direction)
    .markMismatches()
    .resolveImmediately()
    .build(),

  // Full exploration - maximum insight
  MAXIMUM_INSIGHT: () => createMerge()
    .independentRecognition()
    .exposeMismatches()
    .neverResolve()
    .build()
};

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // The 3 Questions
    Recognition,
    Boundary,
    Resolution,
    // Core classes
    MergePosition,
    MergeExecutor,
    MergeBuilder,
    // Builder API
    createMerge,
    // Presets
    Presets,
    // Mode lookup
    MODES,
    RECOMMENDED_MODES,
    findModeByCoordinates,
    findModeByKey
  };
}

if (typeof window !== 'undefined') {
  window.Recognition = Recognition;
  window.Boundary = Boundary;
  window.Resolution = Resolution;
  window.MergePosition = MergePosition;
  window.MergeExecutor = MergeExecutor;
  window.MergeBuilder = MergeBuilder;
  window.createMerge = createMerge;
  window.Presets = Presets;
  window.MERGE_MODES_27 = MODES;
  window.findModeByCoordinates = findModeByCoordinates;
  window.findModeByKey = findModeByKey;
}
