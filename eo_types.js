/**
 * EO Types - Strict EO-Aligned Type Definitions
 *
 * EO AXIOM (ENFORCED):
 * Nothing Meant may exist, persist, or be queried without an explicit,
 * typed grounding chain terminating in Given reality.
 *
 * This module defines the foundational types for a fully EO-aligned system:
 * - Epistemic types (closed set: given, meant, derived_value)
 * - Grounding kinds (explicit typing for all grounding references)
 * - Event model with typed grounding chains
 *
 * All types are frozen and enforced at runtime.
 */

// ============================================================================
// SECTION I: Epistemic Types (Closed Set)
// ============================================================================

/**
 * EpistemicType - The three fundamental categories of events
 *
 * INVARIANT: These are mutually exclusive and exhaustive.
 * No event may exist without one of these types.
 *
 * - given: Enters from external reality (immutable, append-only)
 * - meant: Interpretation, structure, view, insight (requires grounding)
 * - derived_value: Computed value artifact (never embedded in Meant)
 */
const EpistemicType = Object.freeze({
  GIVEN: 'given',
  MEANT: 'meant',
  DERIVED_VALUE: 'derived_value'
});

/**
 * Validate that a type is a valid epistemic type
 */
function isValidEpistemicType(type) {
  return Object.values(EpistemicType).includes(type);
}

/**
 * Assert epistemic type is valid (throws on failure)
 */
function assertEpistemicType(type) {
  if (!isValidEpistemicType(type)) {
    throw new EOTypeError(
      'INVALID_EPISTEMIC_TYPE',
      `"${type}" is not a valid epistemic type. Must be one of: ${Object.values(EpistemicType).join(', ')}`
    );
  }
}

// ============================================================================
// SECTION II: Grounding Kinds (Explicit Typing)
// ============================================================================

/**
 * GroundingKind - The type of grounding relationship
 *
 * Every grounding reference must declare what kind of grounding it is.
 * This enables typed provenance queries.
 *
 * - external: Grounding in external reality (only for Given)
 * - structural: Forced by data shape (automatic schema inference)
 * - semantic: Interpretive meaning (human-assigned semantics)
 * - computational: Operator execution result
 * - epistemic: Confidence, status, claims
 */
const GroundingKind = Object.freeze({
  EXTERNAL: 'external',
  STRUCTURAL: 'structural',
  SEMANTIC: 'semantic',
  COMPUTATIONAL: 'computational',
  EPISTEMIC: 'epistemic'
});

/**
 * Validate that a kind is a valid grounding kind
 */
function isValidGroundingKind(kind) {
  return Object.values(GroundingKind).includes(kind);
}

/**
 * GroundingReference - A typed reference to another event
 */
class GroundingReference {
  /**
   * @param {string} eventId - The event being referenced
   * @param {string} kind - One of GroundingKind values
   */
  constructor(eventId, kind) {
    if (!eventId) {
      throw new EOTypeError('MISSING_EVENT_ID', 'Grounding reference requires eventId');
    }
    if (!isValidGroundingKind(kind)) {
      throw new EOTypeError(
        'INVALID_GROUNDING_KIND',
        `"${kind}" is not a valid grounding kind`
      );
    }

    this.eventId = eventId;
    this.kind = kind;
    Object.freeze(this);
  }

  toJSON() {
    return {
      eventId: this.eventId,
      kind: this.kind
    };
  }
}

// ============================================================================
// SECTION III: Derivation (Operator Chain)
// ============================================================================

/**
 * Derivation - Records how a value/event was computed
 *
 * This captures the operator chain and frozen parameters
 * that produced this event.
 */
class Derivation {
  /**
   * @param {Object} options
   * @param {Array} options.operators - Array of operator applications
   * @param {Object} options.inputs - Named inputs to the derivation
   * @param {Object} options.frozenParams - Immutable parameters at execution time
   */
  constructor(options = {}) {
    this.operators = options.operators || [];
    this.inputs = options.inputs || {};
    this.frozenParams = options.frozenParams || {};

    Object.freeze(this.operators);
    Object.freeze(this.inputs);
    Object.freeze(this.frozenParams);
    Object.freeze(this);
  }

  /**
   * Get list of operator IDs in this derivation
   */
  getOperatorIds() {
    return this.operators.map(op => op.op);
  }

  toJSON() {
    return {
      operators: [...this.operators],
      inputs: { ...this.inputs },
      frozenParams: { ...this.frozenParams }
    };
  }
}

// ============================================================================
// SECTION IV: Grounding (Complete Grounding Information)
// ============================================================================

/**
 * Grounding - Complete grounding information for an event
 *
 * Contains:
 * - references: Array of typed GroundingReferences
 * - derivation: How this was computed (if applicable)
 */
class Grounding {
  /**
   * @param {Object} options
   * @param {Array<GroundingReference>} options.references - Typed grounding references
   * @param {Derivation} options.derivation - Derivation chain (if computed)
   */
  constructor(options = {}) {
    // Convert plain objects to GroundingReferences
    this.references = (options.references || []).map(ref => {
      if (ref instanceof GroundingReference) return ref;
      return new GroundingReference(ref.eventId, ref.kind);
    });

    // Convert to Derivation if needed
    this.derivation = options.derivation
      ? (options.derivation instanceof Derivation
          ? options.derivation
          : new Derivation(options.derivation))
      : null;

    Object.freeze(this.references);
    Object.freeze(this);
  }

  /**
   * Check if this grounding has any references of a specific kind
   */
  hasKind(kind) {
    return this.references.some(ref => ref.kind === kind);
  }

  /**
   * Get all references of a specific kind
   */
  getByKind(kind) {
    return this.references.filter(ref => ref.kind === kind);
  }

  /**
   * Check if grounding is empty
   */
  isEmpty() {
    return this.references.length === 0;
  }

  toJSON() {
    return {
      references: this.references.map(ref => ref.toJSON()),
      derivation: this.derivation ? this.derivation.toJSON() : null
    };
  }
}

// ============================================================================
// SECTION V: Epistemic Frame
// ============================================================================

/**
 * EpistemicStatus - Status of a claim
 */
const EpistemicStatus = Object.freeze({
  PRELIMINARY: 'preliminary',
  CONFIRMED: 'confirmed',
  DISPUTED: 'disputed'
});

/**
 * Frame - Epistemic framing for Meant events
 *
 * Contains:
 * - claim: The assertion being made
 * - epistemicStatus: Current status of the claim
 * - confidenceEvent: Reference to confidence assessment (never embedded)
 * - caveats: Known limitations
 */
class Frame {
  /**
   * @param {Object} options
   * @param {string} options.claim - The assertion being made
   * @param {string} options.epistemicStatus - Status from EpistemicStatus
   * @param {string} options.confidenceEvent - Event ID for confidence (not embedded value)
   * @param {string[]} options.caveats - Known limitations
   * @param {string} options.purpose - Purpose/intent of this interpretation
   */
  constructor(options = {}) {
    this.claim = options.claim || null;
    this.epistemicStatus = options.epistemicStatus || EpistemicStatus.PRELIMINARY;
    this.confidenceEvent = options.confidenceEvent || null;
    this.caveats = options.caveats || [];
    this.purpose = options.purpose || null;

    // Validate epistemic status
    if (!Object.values(EpistemicStatus).includes(this.epistemicStatus)) {
      throw new EOTypeError(
        'INVALID_EPISTEMIC_STATUS',
        `"${this.epistemicStatus}" is not a valid epistemic status`
      );
    }

    Object.freeze(this.caveats);
    Object.freeze(this);
  }

  toJSON() {
    return {
      claim: this.claim,
      epistemicStatus: this.epistemicStatus,
      confidenceEvent: this.confidenceEvent,
      caveats: [...this.caveats],
      purpose: this.purpose
    };
  }
}

// ============================================================================
// SECTION VI: Supersession
// ============================================================================

/**
 * SupersessionType - How one event supersedes another
 */
const SupersessionType = Object.freeze({
  CORRECTION: 'correction',
  REFINEMENT: 'refinement',
  RETRACTION: 'retraction'
});

/**
 * Supersession - Tracks event replacement
 *
 * Supersession replaces:
 * - Claims
 * - Value references
 * - Confidence artifacts
 *
 * NEVER: Evidence. NEVER: Given.
 */
class Supersession {
  /**
   * @param {Object} options
   * @param {string} options.supersedes - Event ID this supersedes
   * @param {string} options.supersededBy - Event ID that superseded this
   * @param {string} options.type - Type of supersession
   * @param {string} options.reason - Why supersession occurred
   */
  constructor(options = {}) {
    this.supersedes = options.supersedes || null;
    this.supersededBy = options.supersededBy || null;
    this.type = options.type || null;
    this.reason = options.reason || null;

    if (this.type && !Object.values(SupersessionType).includes(this.type)) {
      throw new EOTypeError(
        'INVALID_SUPERSESSION_TYPE',
        `"${this.type}" is not a valid supersession type`
      );
    }

    Object.freeze(this);
  }

  /**
   * Check if this event has been superseded
   */
  isSuperseded() {
    return this.supersededBy !== null;
  }

  /**
   * Check if this event supersedes another
   */
  doesSupersede() {
    return this.supersedes !== null;
  }

  toJSON() {
    return {
      supersedes: this.supersedes,
      supersededBy: this.supersededBy,
      type: this.type,
      reason: this.reason
    };
  }
}

// ============================================================================
// SECTION VII: Type Errors
// ============================================================================

/**
 * EOTypeError - Type system violation
 */
class EOTypeError extends Error {
  constructor(code, message, context = {}) {
    super(`[EO_TYPE:${code}] ${message}`);
    this.name = 'EOTypeError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    Object.freeze(this);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp
    };
  }
}

// ============================================================================
// SECTION VIII: Type Guards and Validation
// ============================================================================

/**
 * Check if an event is Given
 */
function isGiven(event) {
  return event && event.epistemicType === EpistemicType.GIVEN;
}

/**
 * Check if an event is Meant
 */
function isMeant(event) {
  return event && event.epistemicType === EpistemicType.MEANT;
}

/**
 * Check if an event is a Derived Value
 */
function isDerivedValue(event) {
  return event && event.epistemicType === EpistemicType.DERIVED_VALUE;
}

/**
 * Validate grounding rules based on epistemic type
 */
function validateGroundingRules(event) {
  const errors = [];

  // Rule 2: Only Given may have external grounding
  if (event.epistemicType !== EpistemicType.GIVEN) {
    if (event.grounding?.hasKind?.(GroundingKind.EXTERNAL)) {
      errors.push({
        rule: 2,
        code: 'EXTERNAL_GROUNDING_VIOLATION',
        message: 'Only Given events may have external grounding'
      });
    }
  }

  // Rule 7: Meant events must have grounding
  if (event.epistemicType === EpistemicType.MEANT) {
    if (!event.grounding || event.grounding.isEmpty?.()) {
      errors.push({
        rule: 7,
        code: 'MISSING_GROUNDING',
        message: 'Meant events must have typed grounds'
      });
    }
  }

  // Derived values must have computational grounding
  if (event.epistemicType === EpistemicType.DERIVED_VALUE) {
    if (!event.grounding?.hasKind?.(GroundingKind.COMPUTATIONAL)) {
      errors.push({
        rule: 8,
        code: 'MISSING_COMPUTATIONAL_GROUNDING',
        message: 'Derived values must have computational grounding'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate complete event structure
 */
function validateEventStructure(event) {
  const errors = [];

  // Required fields
  if (!event.id) {
    errors.push({ code: 'MISSING_ID', message: 'Event must have id' });
  }

  if (!event.epistemicType) {
    errors.push({ code: 'MISSING_TYPE', message: 'Event must have epistemicType' });
  } else if (!isValidEpistemicType(event.epistemicType)) {
    errors.push({ code: 'INVALID_TYPE', message: `Invalid epistemic type: ${event.epistemicType}` });
  }

  if (!event.timestamp) {
    errors.push({ code: 'MISSING_TIMESTAMP', message: 'Event must have timestamp' });
  }

  if (!event.actor) {
    errors.push({ code: 'MISSING_ACTOR', message: 'Event must have actor' });
  }

  // Type-specific validation
  if (event.epistemicType === EpistemicType.MEANT && !event.frame) {
    errors.push({ code: 'MISSING_FRAME', message: 'Meant events must have frame' });
  }

  // Grounding rules
  const groundingValidation = validateGroundingRules(event);
  errors.push(...groundingValidation.errors);

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// SECTION IX: Event Categories
// ============================================================================

/**
 * Standard event categories for typed events
 */
const EventCategory = Object.freeze({
  // Given categories
  RAW_DATA: 'raw_data',
  IMPORT: 'import',
  EXTERNAL_REFERENCE: 'external_reference',

  // Meant categories
  SCHEMA_STRUCTURAL: 'schema_structural',
  SCHEMA_SEMANTIC: 'schema_semantic',
  INSIGHT: 'insight',
  INTERPRETATION: 'interpretation',
  AGGREGATION_EXECUTED: 'aggregation_executed',

  // Derived value categories
  AGGREGATION_RESULT: 'aggregation_result',
  COMPUTED_VALUE: 'computed_value',
  CONFIDENCE_SCORE: 'confidence_score',
  METRIC: 'metric'
});

// ============================================================================
// SECTION X: Given Mode (for Given events)
// ============================================================================

/**
 * GivenMode - How Given data entered the system
 */
const GivenMode = Object.freeze({
  PERCEIVED: 'perceived',
  REPORTED: 'reported',
  MEASURED: 'measured',
  RECEIVED: 'received'
});

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Core types
    EpistemicType,
    GroundingKind,
    EpistemicStatus,
    SupersessionType,
    EventCategory,
    GivenMode,

    // Classes
    GroundingReference,
    Derivation,
    Grounding,
    Frame,
    Supersession,
    EOTypeError,

    // Validation functions
    isValidEpistemicType,
    assertEpistemicType,
    isValidGroundingKind,
    isGiven,
    isMeant,
    isDerivedValue,
    validateGroundingRules,
    validateEventStructure
  };
}

if (typeof window !== 'undefined') {
  // Export as namespace (for backwards compatibility)
  window.EOTypes = {
    // Core types
    EpistemicType,
    GroundingKind,
    EpistemicStatus,
    SupersessionType,
    EventCategory,
    GivenMode,

    // Classes
    GroundingReference,
    Derivation,
    Grounding,
    Frame,
    Supersession,
    EOTypeError,

    // Validation functions
    isValidEpistemicType,
    assertEpistemicType,
    isValidGroundingKind,
    isGiven,
    isMeant,
    isDerivedValue,
    validateGroundingRules,
    validateEventStructure
  };

  // Also export core types directly to window for global access
  // Required by eo_event_store.js, eo_compliance.js, and other modules
  window.EpistemicType = EpistemicType;
  window.GroundingKind = GroundingKind;
  window.EpistemicStatus = EpistemicStatus;
  window.SupersessionType = SupersessionType;
  window.EventCategory = EventCategory;
  window.GivenMode = GivenMode;
  window.GroundingReference = GroundingReference;
  window.Derivation = Derivation;
  window.Grounding = Grounding;
  window.Frame = Frame;
  window.Supersession = Supersession;
  window.EOTypeError = EOTypeError;
}
