/**
 * EO Query Builder - Operator-Centric Set Creation
 *
 * Every Set is a composition of operator invocations.
 * This module provides the operator primitives and chain builder.
 *
 * The 9 EO Operators:
 * - INS ⊕  Assert existence (source entry)
 * - DES ⊙  Designate identity (naming)
 * - SEG ⊘  Scope visibility (filter)
 * - CON ⊗  Connect entities (join)
 * - SYN ≡  Synthesize identity (entity resolution)
 * - ALT Δ  Temporal projection (world state reconstruction)
 * - SUP ∥  Superpose interpretations (preserve disagreement)
 * - REC ←  Record grounding (implicit in all operators)
 * - NUL ∅  Assert meaningful absence
 *
 * Additionally:
 * - AGG Σ  Aggregation (produces derived_value)
 */

// ============================================================================
// Constants
// ============================================================================

const OperatorType = Object.freeze({
  INS: 'INS',   // Assert existence
  DES: 'DES',   // Designate identity
  SEG: 'SEG',   // Scope visibility
  CON: 'CON',   // Connect entities
  SYN: 'SYN',   // Synthesize identity
  ALT: 'ALT',   // Temporal projection
  SUP: 'SUP',   // Superpose interpretations
  REC: 'REC',   // Record grounding (implicit)
  NUL: 'NUL',   // Assert meaningful absence
  AGG: 'AGG'    // Aggregation
});

const OperatorSymbols = Object.freeze({
  INS: '⊕',
  DES: '⊙',
  SEG: '⊘',
  CON: '⊗',
  SYN: '≡',
  ALT: 'Δ',
  SUP: '∥',
  REC: '←',
  NUL: '∅',
  AGG: 'Σ'
});

const EpistemicType = Object.freeze({
  GIVEN: 'given',
  MEANT: 'meant',
  DERIVED_VALUE: 'derived_value'
});

const VisibilityType = Object.freeze({
  VISIBLE: 'VISIBLE',   // Hidden records still exist
  EXISTS: 'EXISTS'      // Excluded records outside this world
});

const JoinType = Object.freeze({
  INNER: 'INNER',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  FULL: 'FULL'
});

const ConflictPolicy = Object.freeze({
  EXPOSE_ALL: 'EXPOSE_ALL',     // Keep all matches (creates multiple rows)
  PICK_FIRST: 'PICK_FIRST',     // Select first match
  PICK_LAST: 'PICK_LAST',       // Select last match
  AGGREGATE: 'AGGREGATE',       // Combine matches
  CLUSTER: 'CLUSTER'            // Group matches, flag ambiguity
});

const TemporalType = Object.freeze({
  AS_OF: 'AS_OF',       // Point-in-time snapshot
  BETWEEN: 'BETWEEN',   // Time window
  VERSION: 'VERSION'    // Specific data version
});

const TemporalSemantics = Object.freeze({
  WORLD_STATE: 'WORLD_STATE',   // Reconstruct knowledge as of time T
  EVENT_TIME: 'EVENT_TIME',     // Filter by when events occurred
  DATA_VERSION: 'DATA_VERSION'  // Pin to specific import
});

const TemporalEvaluation = Object.freeze({
  STATIC: 'STATIC',     // Compute once, freeze
  DYNAMIC: 'DYNAMIC'    // Recompute on each query
});

const SynthesisType = Object.freeze({
  SAME_ENTITY: 'SAME_ENTITY',
  DUPLICATE: 'DUPLICATE',
  ALIAS: 'ALIAS'
});

const SuperpositionResolution = Object.freeze({
  UNRESOLVED: 'UNRESOLVED',
  FRAME_DEPENDENT: 'FRAME_DEPENDENT',
  DEFERRED: 'DEFERRED'
});

// ============================================================================
// ID Generation
// ============================================================================

function generateId(prefix = 'id') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

// ============================================================================
// Predicate - Recursive Filter Structure for SEG
// ============================================================================

/**
 * Predicate - Build nested filter conditions
 *
 * Example:
 *   Predicate.and(
 *     Predicate.compare('plaintiff', 'contains', 'WALLACE'),
 *     Predicate.or(
 *       Predicate.compare('status', 'eq', 'JUDGMENT'),
 *       Predicate.compare('status', 'eq', 'DISMISSED')
 *     )
 *   )
 */
class Predicate {
  constructor(config) {
    this.type = config.type;
    this.conditions = config.conditions || null;
    this.operand = config.operand || null;
    this.field = config.field || null;
    this.operator = config.operator || null;
    this.value = config.value !== undefined ? config.value : null;
  }

  static and(...conditions) {
    return new Predicate({ type: 'AND', conditions });
  }

  static or(...conditions) {
    return new Predicate({ type: 'OR', conditions });
  }

  static not(condition) {
    return new Predicate({ type: 'NOT', operand: condition });
  }

  static compare(field, operator, value) {
    return new Predicate({ type: 'COMPARISON', field, operator, value });
  }

  // Convenience methods
  static eq(field, value) {
    return Predicate.compare(field, 'eq', value);
  }

  static neq(field, value) {
    return Predicate.compare(field, 'neq', value);
  }

  static gt(field, value) {
    return Predicate.compare(field, 'gt', value);
  }

  static gte(field, value) {
    return Predicate.compare(field, 'gte', value);
  }

  static lt(field, value) {
    return Predicate.compare(field, 'lt', value);
  }

  static lte(field, value) {
    return Predicate.compare(field, 'lte', value);
  }

  static contains(field, value) {
    return Predicate.compare(field, 'contains', value);
  }

  static startsWith(field, value) {
    return Predicate.compare(field, 'starts', value);
  }

  static endsWith(field, value) {
    return Predicate.compare(field, 'ends', value);
  }

  static isNull(field) {
    return Predicate.compare(field, 'null', null);
  }

  static isNotNull(field) {
    return Predicate.compare(field, 'notnull', null);
  }

  static in(field, values) {
    return Predicate.compare(field, 'in', values);
  }

  static between(field, low, high) {
    return Predicate.compare(field, 'between', [low, high]);
  }

  /**
   * Evaluate predicate against a record
   */
  evaluate(record) {
    switch (this.type) {
      case 'AND':
        return this.conditions.every(c => c.evaluate(record));
      case 'OR':
        return this.conditions.some(c => c.evaluate(record));
      case 'NOT':
        return !this.operand.evaluate(record);
      case 'COMPARISON':
        return this._evaluateComparison(record);
      default:
        return true;
    }
  }

  _evaluateComparison(record) {
    const cellValue = record[this.field];
    const cellStr = String(cellValue ?? '').toLowerCase();
    const compareValue = this.value;
    const compareStr = String(compareValue ?? '').toLowerCase();

    switch (this.operator) {
      case 'eq':
        return cellStr === compareStr;
      case 'neq':
        return cellStr !== compareStr;
      case 'gt':
        return parseFloat(cellValue) > parseFloat(compareValue);
      case 'gte':
        return parseFloat(cellValue) >= parseFloat(compareValue);
      case 'lt':
        return parseFloat(cellValue) < parseFloat(compareValue);
      case 'lte':
        return parseFloat(cellValue) <= parseFloat(compareValue);
      case 'contains':
        return cellStr.includes(compareStr);
      case 'starts':
        return cellStr.startsWith(compareStr);
      case 'ends':
        return cellStr.endsWith(compareStr);
      case 'null':
        return cellValue === null || cellValue === undefined || cellValue === '';
      case 'notnull':
        return cellValue !== null && cellValue !== undefined && cellValue !== '';
      case 'in':
        return Array.isArray(compareValue) &&
               compareValue.map(v => String(v).toLowerCase()).includes(cellStr);
      case 'between':
        if (!Array.isArray(compareValue) || compareValue.length !== 2) return false;
        const num = parseFloat(cellValue);
        return num >= parseFloat(compareValue[0]) && num <= parseFloat(compareValue[1]);
      default:
        return true;
    }
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON() {
    const obj = { type: this.type };
    if (this.conditions) obj.conditions = this.conditions.map(c => c.toJSON());
    if (this.operand) obj.operand = this.operand.toJSON();
    if (this.field) obj.field = this.field;
    if (this.operator) obj.operator = this.operator;
    if (this.value !== null) obj.value = this.value;
    return obj;
  }

  /**
   * Create from plain object
   */
  static fromJSON(obj) {
    if (!obj) return null;
    return new Predicate({
      type: obj.type,
      conditions: obj.conditions ? obj.conditions.map(c => Predicate.fromJSON(c)) : null,
      operand: obj.operand ? Predicate.fromJSON(obj.operand) : null,
      field: obj.field,
      operator: obj.operator,
      value: obj.value
    });
  }

  /**
   * Convert to human-readable string
   */
  toString() {
    switch (this.type) {
      case 'AND':
        return `(${this.conditions.map(c => c.toString()).join(' AND ')})`;
      case 'OR':
        return `(${this.conditions.map(c => c.toString()).join(' OR ')})`;
      case 'NOT':
        return `NOT ${this.operand.toString()}`;
      case 'COMPARISON':
        return `${this.field} ${this.operator} ${JSON.stringify(this.value)}`;
      default:
        return '';
    }
  }
}

// ============================================================================
// Grounding - Provenance for every operator
// ============================================================================

class Grounding {
  constructor(config = {}) {
    this.actor = config.actor || null;
    this.timestamp = config.timestamp || new Date().toISOString();
    this.reason = config.reason || null;
    this.method = config.method || null;
    this.evidence = config.evidence || [];
    this.parentInvocations = config.parentInvocations || [];
  }

  toJSON() {
    return {
      actor: this.actor,
      timestamp: this.timestamp,
      reason: this.reason,
      method: this.method,
      evidence: this.evidence,
      parentInvocations: this.parentInvocations
    };
  }

  static fromJSON(obj) {
    if (!obj) return null;
    return new Grounding(obj);
  }
}

// ============================================================================
// Operator Invocation - Base class for all operators
// ============================================================================

class OperatorInvocation {
  constructor(config) {
    this.id = config.id || generateId('op');
    this.op = config.op;
    this.params = config.params || {};
    this.epistemicType = config.epistemicType || EpistemicType.DERIVED_VALUE;
    this.grounding = config.grounding ? new Grounding(config.grounding) : null;
    this.outputRef = config.outputRef || null;
    this.inputs = config.inputs || [];
  }

  get symbol() {
    return OperatorSymbols[this.op] || '?';
  }

  toJSON() {
    return {
      id: this.id,
      op: this.op,
      params: this.params,
      epistemicType: this.epistemicType,
      grounding: this.grounding ? this.grounding.toJSON() : null,
      outputRef: this.outputRef,
      inputs: this.inputs
    };
  }

  static fromJSON(obj) {
    return new OperatorInvocation({
      ...obj,
      grounding: obj.grounding ? Grounding.fromJSON(obj.grounding) : null
    });
  }

  toString() {
    return `${this.symbol} ${this.op}`;
  }
}

// ============================================================================
// OperatorChain - Fluent builder for operator pipelines
// ============================================================================

class OperatorChain {
  constructor() {
    this.operators = [];
    this._grounding = null;
    this._frame = null;
  }

  /**
   * INS ⊕ - Assert source existence
   */
  fromSource(sourceId, alias = null) {
    this.operators.push(new OperatorInvocation({
      op: OperatorType.INS,
      params: { sourceId, alias },
      epistemicType: EpistemicType.GIVEN,
      outputRef: alias || sourceId
    }));
    return this;
  }

  /**
   * SEG ⊘ - Scope visibility (filter)
   */
  filter(predicate, options = {}) {
    const pred = predicate instanceof Predicate ? predicate : Predicate.fromJSON(predicate);
    this.operators.push(new OperatorInvocation({
      op: OperatorType.SEG,
      params: {
        predicate: pred.toJSON(),
        visibilityType: options.visibilityType || VisibilityType.VISIBLE,
        trackHidden: options.trackHidden !== false
      },
      epistemicType: EpistemicType.DERIVED_VALUE
    }));
    return this;
  }

  /**
   * CON ⊗ - Connect entities (join)
   * @param {string} rightSourceId - Source to join with
   * @param {Object} spec - Join specification
   * @param {string} spec.alias - Alias for right source
   * @param {Object} spec.on - Join keys { left, right }
   * @param {string} spec.type - Join type (INNER, LEFT, RIGHT, FULL)
   * @param {string} spec.conflict - REQUIRED: Conflict policy
   * @param {Object} spec.conflictOptions - Options for conflict resolution
   */
  join(rightSourceId, spec) {
    if (!spec.conflict) {
      throw new Error('CON operator requires conflict policy. Use one of: EXPOSE_ALL, PICK_FIRST, PICK_LAST, AGGREGATE, CLUSTER');
    }

    const params = {
      rightSourceId,
      alias: spec.alias || null,
      on: spec.on,
      type: spec.type || JoinType.LEFT,
      conflict: spec.conflict,
      matchType: spec.matchType || 'EXACT'
    };

    // Additional options based on conflict policy
    if (spec.conflict === ConflictPolicy.PICK_FIRST || spec.conflict === ConflictPolicy.PICK_LAST) {
      params.orderBy = spec.orderBy || null;
    }
    if (spec.conflict === ConflictPolicy.AGGREGATE) {
      params.aggregations = spec.aggregations || [];
    }

    this.operators.push(new OperatorInvocation({
      op: OperatorType.CON,
      params,
      epistemicType: EpistemicType.DERIVED_VALUE
    }));
    return this;
  }

  /**
   * ALT Δ - Temporal projection: AS_OF (world state reconstruction)
   */
  asOf(timestamp, options = {}) {
    const isNow = timestamp === 'NOW' || timestamp === null;
    this.operators.push(new OperatorInvocation({
      op: OperatorType.ALT,
      params: {
        temporalType: TemporalType.AS_OF,
        timestamp: isNow ? 'NOW' : timestamp,
        semantics: options.semantics || TemporalSemantics.WORLD_STATE,
        evaluation: options.evaluation || (isNow ? TemporalEvaluation.DYNAMIC : TemporalEvaluation.STATIC)
      },
      epistemicType: EpistemicType.DERIVED_VALUE
    }));
    return this;
  }

  /**
   * ALT Δ - Temporal projection: BETWEEN (event time window)
   */
  eventsBetween(start, end, options = {}) {
    this.operators.push(new OperatorInvocation({
      op: OperatorType.ALT,
      params: {
        temporalType: TemporalType.BETWEEN,
        start,
        end,
        semantics: options.semantics || TemporalSemantics.EVENT_TIME,
        evaluation: options.evaluation || TemporalEvaluation.STATIC
      },
      epistemicType: EpistemicType.DERIVED_VALUE
    }));
    return this;
  }

  /**
   * ALT Δ - Temporal projection: VERSION (pin to specific import)
   */
  version(versionId) {
    this.operators.push(new OperatorInvocation({
      op: OperatorType.ALT,
      params: {
        temporalType: TemporalType.VERSION,
        versionId,
        semantics: TemporalSemantics.DATA_VERSION,
        evaluation: TemporalEvaluation.STATIC
      },
      epistemicType: EpistemicType.DERIVED_VALUE
    }));
    return this;
  }

  /**
   * DES ⊙ - Designate identity (name the result)
   */
  name(designation, scope = null) {
    this.operators.push(new OperatorInvocation({
      op: OperatorType.DES,
      params: { designation, scope },
      epistemicType: EpistemicType.MEANT
    }));
    return this;
  }

  /**
   * SYN ≡ - Synthesize identity (entity resolution)
   * @param {Object} left - Left entity reference { source, field, value }
   * @param {Object} right - Right entity reference { source, field, value }
   * @param {Object} spec - Synthesis specification
   * @param {string} spec.type - SAME_ENTITY, DUPLICATE, or ALIAS
   * @param {number} spec.confidence - Confidence score 0-1
   * @param {string} spec.evidence - REQUIRED: Evidence for this decision
   * @param {string} spec.method - Method used for matching
   */
  synthesize(left, right, spec) {
    if (!spec.evidence) {
      throw new Error('SYN operator requires evidence (why are these the same?)');
    }

    this.operators.push(new OperatorInvocation({
      op: OperatorType.SYN,
      params: {
        left,
        right,
        synthesisType: spec.type || SynthesisType.SAME_ENTITY,
        confidence: spec.confidence || null,
        method: spec.method || null,
        canonical: spec.canonical || null  // For DUPLICATE: which is the "real" one
      },
      epistemicType: EpistemicType.MEANT,  // SYN is ALWAYS MEANT
      grounding: new Grounding({
        actor: spec.actor || 'user',
        reason: spec.evidence,
        method: spec.method
      })
    }));
    return this;
  }

  /**
   * SUP ∥ - Superpose interpretations (preserve disagreement)
   */
  superpose(config) {
    this.operators.push(new OperatorInvocation({
      op: OperatorType.SUP,
      params: {
        superpositionType: config.type || 'CONFLICTING_VALUES',
        interpretations: config.interpretations,
        resolution: config.resolution || SuperpositionResolution.UNRESOLVED,
        field: config.field || null
      },
      epistemicType: EpistemicType.MEANT
    }));
    return this;
  }

  /**
   * NUL ∅ - Assert meaningful absence
   * @param {Object} expectation - What we expect to find
   * @param {string} expectation.ruleId - Identifier for this expectation rule
   * @param {string} expectation.description - Human-readable description
   * @param {Object} expectation.subject - What we're checking { source, filter }
   * @param {Object} expectation.expected - What should exist { targetSource, joinKey, cardinality }
   * @param {Object} expectation.timeConstraint - Temporal constraint { relativeTo, maxOffset, direction }
   * @param {string} expectation.basis - REQUIRED: Why do we expect this?
   */
  expectAbsence(expectation) {
    if (!expectation.basis) {
      throw new Error('NUL operator requires basis (why do we expect this to exist?)');
    }

    this.operators.push(new OperatorInvocation({
      op: OperatorType.NUL,
      params: {
        expectation: {
          ruleId: expectation.ruleId || generateId('exp'),
          description: expectation.description || '',
          subject: expectation.subject,
          expected: expectation.expected,
          timeConstraint: expectation.timeConstraint || null,
          basis: expectation.basis
        },
        evaluationTime: new Date().toISOString(),
        outputType: expectation.outputType || 'ABSENCE_RECORDS'
      },
      epistemicType: EpistemicType.DERIVED_VALUE
    }));
    return this;
  }

  /**
   * AGG Σ - Aggregation (produces derived_value)
   */
  aggregate(aggregations, groupBy = null) {
    this.operators.push(new OperatorInvocation({
      op: OperatorType.AGG,
      params: {
        aggregations: Array.isArray(aggregations) ? aggregations : [aggregations],
        groupBy: groupBy
      },
      epistemicType: EpistemicType.DERIVED_VALUE
    }));
    return this;
  }

  /**
   * Select specific fields (convenience - maps to SEG with field projection)
   */
  select(fields) {
    this.operators.push(new OperatorInvocation({
      op: OperatorType.SEG,
      params: {
        selectFields: Array.isArray(fields) ? fields : [fields],
        visibilityType: VisibilityType.VISIBLE
      },
      epistemicType: EpistemicType.DERIVED_VALUE
    }));
    return this;
  }

  /**
   * Set grounding for the entire chain
   */
  withGrounding(grounding) {
    this._grounding = grounding instanceof Grounding ? grounding : new Grounding(grounding);
    return this;
  }

  /**
   * Set frame context for the chain
   */
  withFrame(frame) {
    this._frame = frame;
    return this;
  }

  /**
   * Validate the operator chain
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Rule 1: Must start with INS
    if (this.operators.length === 0 || this.operators[0].op !== OperatorType.INS) {
      errors.push('Chain must start with INS (source)');
    }

    // Rule 2: Must end with DES
    if (this.operators.length === 0 || this.operators[this.operators.length - 1].op !== OperatorType.DES) {
      errors.push('Chain must end with DES (name the result)');
    }

    // Rule 3: Must have ALT (temporal context)
    const hasAlt = this.operators.some(op => op.op === OperatorType.ALT);
    if (!hasAlt) {
      errors.push('Chain must include ALT (temporal context is required)');
    }

    // Rule 4: Check each operator
    for (let i = 0; i < this.operators.length; i++) {
      const op = this.operators[i];

      // CON must have conflict policy
      if (op.op === OperatorType.CON && !op.params.conflict) {
        errors.push(`CON operator at position ${i} requires conflict policy`);
      }

      // SYN must be MEANT and have grounding
      if (op.op === OperatorType.SYN) {
        if (op.epistemicType !== EpistemicType.MEANT) {
          errors.push(`SYN operator at position ${i} must be MEANT (it's an interpretation)`);
        }
        if (!op.grounding || !op.grounding.reason) {
          errors.push(`SYN operator at position ${i} requires evidence in grounding`);
        }
      }

      // NUL must have expectation with basis
      if (op.op === OperatorType.NUL) {
        if (!op.params.expectation?.basis) {
          errors.push(`NUL operator at position ${i} requires expectation with basis`);
        }
      }
    }

    // Warning: No grounding on chain
    if (!this._grounding) {
      warnings.push('Chain has no grounding (recommended to set actor and reason)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Build the SetDefinition
   */
  build(options = {}) {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Invalid operator chain:\n${validation.errors.join('\n')}`);
    }

    // Log warnings
    if (validation.warnings.length > 0) {
      console.warn('Operator chain warnings:', validation.warnings);
    }

    return new SetDefinition({
      operators: this.operators,
      frame: this._frame || options.frame || { id: 'default', version: '1.0' },
      grounding: this._grounding || (options.grounding ? new Grounding(options.grounding) : null)
    });
  }

  /**
   * Convert chain to JSON
   */
  toJSON() {
    return {
      operators: this.operators.map(op => op.toJSON()),
      grounding: this._grounding ? this._grounding.toJSON() : null,
      frame: this._frame
    };
  }

  /**
   * Create chain from JSON
   */
  static fromJSON(obj) {
    const chain = new OperatorChain();
    chain.operators = (obj.operators || []).map(op => OperatorInvocation.fromJSON(op));
    chain._grounding = obj.grounding ? Grounding.fromJSON(obj.grounding) : null;
    chain._frame = obj.frame || null;
    return chain;
  }

  /**
   * Get operator chain as string
   */
  toString() {
    return this.operators.map(op => op.toString()).join(' → ');
  }

  /**
   * Clone the chain
   */
  clone() {
    return OperatorChain.fromJSON(this.toJSON());
  }
}

// ============================================================================
// SetDefinition - The output of a built chain
// ============================================================================

class SetDefinition {
  constructor(config) {
    this.setId = config.setId || generateId('set');
    this.version = config.version || 1;
    this.operators = config.operators || [];
    this.frame = config.frame || { id: 'default', version: '1.0' };
    this.grounding = config.grounding;
    this.createdAt = config.createdAt || new Date().toISOString();

    // Extract key info
    this._extractMetadata();
  }

  _extractMetadata() {
    // Find DES operator for name
    const desOp = this.operators.find(op => op.op === OperatorType.DES);
    this.name = desOp ? desOp.params.designation : 'Unnamed Set';

    // Find all source references
    this.sourceRefs = this.operators
      .filter(op => op.op === OperatorType.INS)
      .map(op => op.params.sourceId);

    // Find ALT for temporal context
    const altOp = this.operators.find(op => op.op === OperatorType.ALT);
    this.temporalContext = altOp ? altOp.params : null;

    // Determine derivation strategy
    const hasCon = this.operators.some(op => op.op === OperatorType.CON);
    const hasAgg = this.operators.some(op => op.op === OperatorType.AGG);
    const hasSyn = this.operators.some(op => op.op === OperatorType.SYN);

    if (hasCon) {
      this.strategy = 'CON';  // Connect/join
    } else if (hasAgg) {
      this.strategy = 'DES';  // Derivation via aggregation
    } else if (hasSyn) {
      this.strategy = 'SYN';  // Entity synthesis
    } else {
      this.strategy = 'SEG';  // Segmentation
    }
  }

  /**
   * Generate EO events for this Set definition
   */
  toEvents() {
    const events = [];
    const timestamp = new Date().toISOString();

    // Main set definition event
    events.push({
      id: `evt_${this.setId}`,
      epistemicType: EpistemicType.MEANT,
      category: 'set_defined',
      timestamp,
      actor: this.grounding?.actor || 'system',
      payload: {
        setId: this.setId,
        name: this.name,
        version: this.version,
        operatorChain: this.operators.map(op => op.toJSON()),
        strategy: this.strategy,
        sourceRefs: this.sourceRefs
      },
      grounding: {
        references: this.sourceRefs.map(srcId => ({
          eventId: `evt_${srcId}`,
          kind: 'structural'
        })),
        derivation: {
          strategy: this.strategy.toLowerCase(),
          operators: this.operators.map(op => ({ op: op.op, params: op.params })),
          frozenParams: {
            setId: this.setId,
            definedAt: timestamp
          }
        },
        kind: 'computational'
      },
      frame: {
        claim: `Defined set "${this.name}" using ${this.strategy} strategy`,
        epistemicStatus: 'confirmed',
        purpose: this.grounding?.reason || 'set_creation'
      }
    });

    return events;
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      setId: this.setId,
      version: this.version,
      name: this.name,
      operators: this.operators.map(op => op.toJSON()),
      frame: this.frame,
      grounding: this.grounding ? this.grounding.toJSON() : null,
      createdAt: this.createdAt,
      strategy: this.strategy,
      sourceRefs: this.sourceRefs,
      temporalContext: this.temporalContext
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(obj) {
    return new SetDefinition({
      setId: obj.setId,
      version: obj.version,
      operators: (obj.operators || []).map(op => OperatorInvocation.fromJSON(op)),
      frame: obj.frame,
      grounding: obj.grounding ? Grounding.fromJSON(obj.grounding) : null,
      createdAt: obj.createdAt
    });
  }
}

// ============================================================================
// ChainExecutor - Execute operator chains against data
// ============================================================================

class ChainExecutor {
  constructor(sourceStore, eventStore = null, options = {}) {
    this.sourceStore = sourceStore;
    this.eventStore = eventStore;
    this.activityStore = options.activityStore || null;
    this.actor = options.actor || 'system';
  }

  /**
   * Record an activity if activity store is available
   * @param {string} op - Operator type
   * @param {Object} params - Operator parameters
   * @param {Object} stats - Execution stats (inputRows, outputRows)
   * @param {Object} setDef - Set definition being executed
   */
  async _recordActivity(op, params, stats, setDef) {
    if (!this.activityStore) return;

    try {
      const Activity = typeof window !== 'undefined' && window.EOActivity?.Activity;
      if (!Activity) return;

      const target = setDef?.setId || setDef?.name || 'query_execution';
      const actor = setDef?.grounding?.actor || this.actor;

      let activity;
      switch (op) {
        case OperatorType.INS:
          activity = Activity.insert(target, actor, {
            method: 'query_source',
            data: { sourceId: params.sourceId, alias: params.alias, rows: stats.outputRows }
          });
          break;
        case OperatorType.SEG:
          activity = Activity.segment(target, actor, {
            method: 'query_filter',
            data: {
              predicate: params.predicate,
              selectFields: params.selectFields,
              inputRows: stats.inputRows,
              outputRows: stats.outputRows
            }
          });
          break;
        case OperatorType.CON:
          activity = Activity.connect(target, actor, params.rightSourceId, {
            method: 'query_join',
            data: {
              joinType: params.type,
              on: params.on,
              conflict: params.conflict,
              inputRows: stats.inputRows,
              outputRows: stats.outputRows
            }
          });
          break;
        case OperatorType.ALT:
          activity = Activity.update(target, actor, [stats.inputRows, stats.outputRows], {
            method: 'query_temporal',
            data: { temporalType: params.temporalType, timestamp: params.timestamp }
          });
          break;
        case OperatorType.AGG:
          activity = Activity.synthesize(target, actor, params.groupBy, {
            method: 'query_aggregate',
            data: { aggregations: params.aggregations, inputRows: stats.inputRows, outputRows: stats.outputRows }
          });
          break;
        case OperatorType.DES:
          activity = Activity.designate(target, actor, params.designation, {
            method: 'query_name'
          });
          break;
        case OperatorType.SYN:
          activity = Activity.synthesize(target, actor, [params.left, params.right], {
            method: 'query_synthesis',
            data: { synthesisType: params.synthesisType, confidence: params.confidence }
          });
          break;
        case OperatorType.SUP:
          activity = Activity.superpose(target, actor, params.interpretations, {
            method: 'query_superposition',
            data: { field: params.field, resolution: params.resolution }
          });
          break;
        case OperatorType.NUL:
          activity = Activity.nullify(target, actor, params.expectation?.basis || 'absence_check', {
            method: 'query_absence',
            data: { expectation: params.expectation, outputRows: stats.outputRows }
          });
          break;
        default:
          return;
      }

      if (activity && this.activityStore.record) {
        await this.activityStore.record(activity);
      }
    } catch (e) {
      // Don't let activity recording errors break query execution
      console.warn('Failed to record query activity:', e);
    }
  }

  /**
   * Execute a SetDefinition and return results
   */
  execute(setDef, options = {}) {
    const operators = setDef.operators;
    let data = [];
    let columns = [];
    const stats = {
      inputRows: 0,
      outputRows: 0,
      operations: [],
      startTime: Date.now()
    };

    // Execution context
    const context = {
      sources: new Map(),
      aliases: new Map()
    };

    for (const op of operators) {
      const beforeCount = data.length;
      const result = this._executeOperator(op, data, columns, context);

      data = result.data;
      columns = result.columns || columns;

      const opStats = {
        op: op.op,
        symbol: op.symbol,
        inputRows: beforeCount,
        outputRows: data.length,
        params: op.params
      };
      stats.operations.push(opStats);

      // Record activity for this operator execution
      this._recordActivity(op.op, op.params, { inputRows: beforeCount, outputRows: data.length }, setDef);
    }

    stats.outputRows = data.length;
    stats.executionTime = Date.now() - stats.startTime;

    return {
      success: true,
      rows: data,
      columns,
      stats,
      setDefinition: setDef
    };
  }

  /**
   * Preview execution with limited rows
   */
  preview(setDef, limit = 100) {
    const result = this.execute(setDef);
    if (!result.success) return result;

    return {
      ...result,
      rows: result.rows.slice(0, limit),
      totalRows: result.rows.length,
      isPreview: true,
      previewLimit: limit
    };
  }

  _executeOperator(op, data, columns, context) {
    switch (op.op) {
      case OperatorType.INS:
        return this._executeINS(op.params, context);

      case OperatorType.SEG:
        return this._executeSEG(data, columns, op.params);

      case OperatorType.CON:
        return this._executeCON(data, columns, op.params, context);

      case OperatorType.ALT:
        return this._executeALT(data, columns, op.params);

      case OperatorType.AGG:
        return this._executeAGG(data, columns, op.params);

      case OperatorType.DES:
        // DES just names, doesn't transform data
        return { data, columns };

      case OperatorType.SYN:
        return this._executeSYN(data, columns, op.params);

      case OperatorType.SUP:
        return this._executeSUP(data, columns, op.params);

      case OperatorType.NUL:
        return this._executeNUL(data, columns, op.params, context);

      default:
        console.warn(`Unknown operator: ${op.op}`);
        return { data, columns };
    }
  }

  _executeINS(params, context) {
    const { sourceId, alias } = params;

    const source = this.sourceStore.get(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    const data = [...source.records];
    const columns = source.schema?.fields?.map(f => f.name) ||
                    (data.length > 0 ? Object.keys(data[0]) : []);

    // Store in context for joins
    context.sources.set(sourceId, { data, columns });
    if (alias) {
      context.aliases.set(alias, sourceId);
    }

    return { data, columns };
  }

  _executeSEG(data, columns, params) {
    // Handle field selection
    if (params.selectFields) {
      const selectedCols = params.selectFields;
      const projected = data.map(row => {
        const newRow = {};
        for (const col of selectedCols) {
          newRow[col] = row[col];
        }
        return newRow;
      });
      return { data: projected, columns: selectedCols };
    }

    // Handle predicate filtering
    if (params.predicate) {
      const predicate = Predicate.fromJSON(params.predicate);
      const filtered = data.filter(row => predicate.evaluate(row));
      return { data: filtered, columns };
    }

    return { data, columns };
  }

  _executeCON(leftData, leftColumns, params, context) {
    const { rightSourceId, on, type, conflict } = params;

    // Get right source data
    let rightData, rightColumns;
    const rightSource = this.sourceStore.get(rightSourceId);
    if (rightSource) {
      rightData = [...rightSource.records];
      rightColumns = rightSource.schema?.fields?.map(f => f.name) ||
                     (rightData.length > 0 ? Object.keys(rightData[0]) : []);
    } else {
      throw new Error(`Right source not found: ${rightSourceId}`);
    }

    // Build index on right table
    const rightIndex = new Map();
    for (const row of rightData) {
      const key = String(row[on.right] ?? '').toLowerCase();
      if (!rightIndex.has(key)) rightIndex.set(key, []);
      rightIndex.get(key).push(row);
    }

    const result = [];
    const allColumns = [...new Set([...leftColumns, ...rightColumns])];

    for (const leftRow of leftData) {
      const key = String(leftRow[on.left] ?? '').toLowerCase();
      const matches = rightIndex.get(key) || [];

      if (matches.length === 0) {
        // No match
        if (type === JoinType.LEFT || type === JoinType.FULL) {
          const nullRight = {};
          for (const col of rightColumns) nullRight[col] = null;
          result.push({ ...leftRow, ...nullRight });
        }
      } else {
        // Handle matches based on conflict policy
        switch (conflict) {
          case ConflictPolicy.EXPOSE_ALL:
            for (const rightRow of matches) {
              result.push({ ...leftRow, ...rightRow });
            }
            break;

          case ConflictPolicy.PICK_FIRST:
            result.push({ ...leftRow, ...matches[0] });
            break;

          case ConflictPolicy.PICK_LAST:
            result.push({ ...leftRow, ...matches[matches.length - 1] });
            break;

          case ConflictPolicy.CLUSTER:
            result.push({
              ...leftRow,
              _matches: matches,
              _matchCount: matches.length,
              _isMultiMatch: matches.length > 1
            });
            break;

          default:
            // Default to EXPOSE_ALL
            for (const rightRow of matches) {
              result.push({ ...leftRow, ...rightRow });
            }
        }
      }
    }

    return { data: result, columns: allColumns };
  }

  _executeALT(data, columns, params) {
    // ALT (Δ) - Temporal projection operator
    // Reconstructs data as it existed at a specific point in time

    const { mode, timestamp, version, eventId } = params;
    const targetTime = timestamp ? new Date(timestamp).getTime() : null;

    switch (mode) {
      case 'WORLD_STATE':
        // Replay events up to timestamp to reconstruct world state
        return this._reconstructWorldState(data, columns, targetTime);

      case 'EVENT_TIME':
        // Filter records by when the event occurred
        return this._filterByEventTime(data, columns, targetTime);

      case 'DATA_VERSION':
        // Pin to specific import/data version
        return this._filterByDataVersion(data, columns, version, eventId);

      default:
        // Default: annotate data with temporal context
        const annotatedData = data.map(row => ({
          ...row,
          _temporalContext: params
        }));
        return { data: annotatedData, columns };
    }
  }

  /**
   * Reconstruct world state at a specific timestamp
   * Replays events up to the given time to get the state as it was
   */
  _reconstructWorldState(data, columns, targetTime) {
    if (!targetTime || !this.eventStore) {
      return { data, columns };
    }

    // Get all events up to the target time
    const allEvents = this.eventStore.getAll ? this.eventStore.getAll() : [];
    const eventsUpToTime = allEvents.filter(e => {
      const eventTime = new Date(e.timestamp || e.createdAt).getTime();
      return eventTime <= targetTime;
    });

    // Build a map of entity states at that time
    const entityStates = new Map();

    for (const event of eventsUpToTime) {
      const entityId = event.payload?.recordId || event.payload?.entityId || event.payload?.targetId;
      if (!entityId) continue;

      const currentState = entityStates.get(entityId) || {};

      // Apply the event based on its operator
      switch (event.operator) {
        case 'INS':
          // Insert: set initial state
          entityStates.set(entityId, {
            ...event.payload,
            _created: event.timestamp,
            _lastModified: event.timestamp,
            _eventId: event.id
          });
          break;

        case 'ALT':
          // Alter: merge changes
          entityStates.set(entityId, {
            ...currentState,
            ...event.payload,
            _lastModified: event.timestamp,
            _eventId: event.id
          });
          break;

        case 'NUL':
          // Null/Delete: mark as deleted (ghost)
          entityStates.set(entityId, {
            ...currentState,
            _deleted: true,
            _deletedAt: event.timestamp,
            _eventId: event.id
          });
          break;
      }
    }

    // Filter data to only include records that existed at that time
    const reconstructedData = data.filter(row => {
      const rowId = row.id || row._id;
      const state = entityStates.get(rowId);

      // Include if the record existed and wasn't deleted
      if (state && !state._deleted) {
        // Merge historical state with row
        Object.assign(row, {
          _temporalState: 'historical',
          _asOfTime: new Date(targetTime).toISOString()
        });
        return true;
      }
      return false;
    });

    // Add temporal metadata columns
    const newColumns = [...columns];
    if (!newColumns.includes('_temporalState')) newColumns.push('_temporalState');
    if (!newColumns.includes('_asOfTime')) newColumns.push('_asOfTime');

    return { data: reconstructedData, columns: newColumns };
  }

  /**
   * Filter records by event occurrence time
   */
  _filterByEventTime(data, columns, targetTime) {
    if (!targetTime) {
      return { data, columns };
    }

    const filteredData = data.filter(row => {
      // Check various timestamp fields
      const rowTime = row._eventTime || row.createdAt || row.timestamp || row._created;
      if (!rowTime) return true; // Include records without timestamp info

      const recordTime = new Date(rowTime).getTime();
      return recordTime <= targetTime;
    });

    // Annotate with temporal context
    const annotatedData = filteredData.map(row => ({
      ...row,
      _temporalFilter: 'event_time',
      _filterTimestamp: new Date(targetTime).toISOString()
    }));

    return { data: annotatedData, columns };
  }

  /**
   * Filter/pin data to a specific version
   */
  _filterByDataVersion(data, columns, version, eventId) {
    if (!version && !eventId) {
      return { data, columns };
    }

    // If eventId is provided, find all records associated with that import event
    if (eventId && this.eventStore) {
      const importEvent = this.eventStore.get ? this.eventStore.get(eventId) : null;
      if (importEvent) {
        // Filter to records from this import
        const filteredData = data.filter(row => {
          return row._importEventId === eventId ||
                 row._originEventId === eventId ||
                 row._version === version;
        });

        const annotatedData = filteredData.map(row => ({
          ...row,
          _pinnedToVersion: version || eventId,
          _temporalFilter: 'data_version'
        }));

        return { data: annotatedData, columns };
      }
    }

    // If version string provided, filter by _version field
    if (version) {
      const filteredData = data.filter(row => {
        return row._version === version || row._dataVersion === version;
      });

      const annotatedData = filteredData.map(row => ({
        ...row,
        _pinnedToVersion: version,
        _temporalFilter: 'data_version'
      }));

      return { data: annotatedData, columns };
    }

    return { data, columns };
  }

  _executeAGG(data, columns, params) {
    const { aggregations, groupBy } = params;

    if (!groupBy) {
      // Aggregate entire dataset
      const result = {};
      for (const agg of aggregations) {
        result[agg.as] = this._computeAggregate(data, agg);
      }
      return { data: [result], columns: aggregations.map(a => a.as) };
    }

    // Group by specified fields
    const groupKeys = Array.isArray(groupBy) ? groupBy : [groupBy];
    const groups = new Map();

    for (const row of data) {
      const keyParts = groupKeys.map(k => row[k] ?? '(null)');
      const key = keyParts.join('|||');
      if (!groups.has(key)) {
        groups.set(key, { keyValues: keyParts, rows: [] });
      }
      groups.get(key).rows.push(row);
    }

    const result = [];
    for (const [key, group] of groups) {
      const row = {};
      groupKeys.forEach((k, i) => row[k] = group.keyValues[i]);

      for (const agg of aggregations) {
        row[agg.as] = this._computeAggregate(group.rows, agg);
      }
      result.push(row);
    }

    return {
      data: result,
      columns: [...groupKeys, ...aggregations.map(a => a.as)]
    };
  }

  _computeAggregate(rows, agg) {
    const { fn, field } = agg;
    const values = field === '*' ? rows : rows.map(r => r[field]).filter(v => v != null);

    switch (fn.toUpperCase()) {
      case 'COUNT':
        return field === '*' ? rows.length : values.length;
      case 'SUM':
        return values.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
      case 'AVG':
        const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
        return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
      case 'MIN':
        return values.length > 0 ? Math.min(...values.map(v => parseFloat(v) || 0)) : null;
      case 'MAX':
        return values.length > 0 ? Math.max(...values.map(v => parseFloat(v) || 0)) : null;
      case 'FIRST':
        return values[0] ?? null;
      case 'LAST':
        return values[values.length - 1] ?? null;
      default:
        return null;
    }
  }

  _executeSYN(data, columns, params) {
    // Entity synthesis - mark records as matched
    // Full implementation would update entity registry
    return { data, columns };
  }

  _executeSUP(data, columns, params) {
    // Superposition - preserve multiple interpretations
    const { field, interpretations } = params;

    if (field) {
      // Add superposition metadata to field
      const annotated = data.map(row => ({
        ...row,
        [`${field}_superposition`]: true,
        [`${field}_interpretations`]: interpretations
      }));
      return { data: annotated, columns: [...columns, `${field}_superposition`, `${field}_interpretations`] };
    }

    return { data, columns };
  }

  _executeNUL(data, columns, params, context) {
    const { expectation, outputType } = params;

    // Find expected records that are missing
    // This is a simplified implementation
    // Full implementation would check against target source

    const targetSource = this.sourceStore.get(expectation.expected?.targetSource);
    if (!targetSource) {
      return { data: [], columns: ['subject', 'expected', 'absence_type'] };
    }

    const targetData = targetSource.records;
    const targetKeys = new Set(targetData.map(r => String(r[expectation.expected.joinKey] ?? '')));

    const absences = data.filter(row => {
      const key = String(row[expectation.expected.joinKey] ?? '');
      return !targetKeys.has(key);
    }).map(row => ({
      ...row,
      _absence: true,
      _expectation: expectation.ruleId,
      _basis: expectation.basis
    }));

    return {
      data: absences,
      columns: [...columns, '_absence', '_expectation', '_basis']
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Constants
    OperatorType,
    OperatorSymbols,
    EpistemicType,
    VisibilityType,
    JoinType,
    ConflictPolicy,
    TemporalType,
    TemporalSemantics,
    TemporalEvaluation,
    SynthesisType,
    SuperpositionResolution,

    // Classes
    Predicate,
    Grounding,
    OperatorInvocation,
    OperatorChain,
    SetDefinition,
    ChainExecutor,

    // Utilities
    generateId
  };
}

if (typeof window !== 'undefined') {
  window.EOQueryBuilder = {
    // Constants
    OperatorType,
    OperatorSymbols,
    EpistemicType,
    VisibilityType,
    JoinType,
    ConflictPolicy,
    TemporalType,
    TemporalSemantics,
    TemporalEvaluation,
    SynthesisType,
    SuperpositionResolution,

    // Classes
    Predicate,
    Grounding,
    OperatorInvocation,
    OperatorChain,
    SetDefinition,
    ChainExecutor,

    // Utilities
    generateId
  };
}
