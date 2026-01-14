/**
 * EO Meaning Stabilization Schema
 *
 * Three Dimensions, Nine Options, 27 Possible States
 *
 * This schema answers: "How does meaning become stable enough to use?"
 *
 * The dimensions are:
 *   I. IDENTITY - How is this meaning stabilized in the world?
 *   II. SPACE - Where does this meaning apply?
 *   III. TIME - How does this meaning change?
 *
 * WHAT HAPPENED TO GOVERNANCE:
 * Governance is absorbed into Identity. The validation question becomes:
 *   "If this meaning were challenged tomorrow, would it collapse, bend, or hold?"
 *   - Collapse → Declared
 *   - Bend but persist → Stabilized
 *   - Already bending → Contested
 *
 * Authority source (human/process/system) becomes an optional annotation,
 * not a dimension.
 *
 * THE MATH:
 *   3 dimensions × 3 values = 9 selectable elements
 *   3 × 3 × 3 = 27 possible definition states
 */

// ============================================================================
// DIMENSION I: Identity
// ============================================================================

/**
 * Identity - How is this meaning stabilized in the world?
 *
 * This absorbs the former Governance dimension. The question is not
 * "who maintains this?" but "how does it hold together when challenged?"
 */
const MeaningIdentity = Object.freeze({
  /**
   * DECLARED - Meaning exists because an authority asserts it
   *
   * If challenged tomorrow, it would collapse without the authority.
   * Examples: Legal definitions, regulatory terms, internal policy definitions
   *
   * Key signal: Remove the authority, lose the meaning
   */
  DECLARED: 'Declared',

  /**
   * STABILIZED - Meaning persists because systems agree and reinforce it
   *
   * If challenged tomorrow, it would bend but persist due to network effects.
   * Examples: Industry standards, widely-used ontologies, community consensus
   *
   * Key signal: Multiple systems reference this, creating mutual reinforcement
   */
  STABILIZED: 'Stabilized',

  /**
   * CONTESTED - Meaning is disputed, provisional, or actively evolving
   *
   * If challenged tomorrow, it's already bending - no stable foundation yet.
   * Examples: Emerging concepts, conflicting definitions, deprecated terms
   *
   * Key signal: Active disagreement or uncertainty about what this means
   */
  CONTESTED: 'Contested'
});

// ============================================================================
// DIMENSION II: Space
// ============================================================================

/**
 * Space - Where does this meaning apply?
 *
 * Defines the boundary within which this meaning is valid.
 */
const MeaningSpace = Object.freeze({
  /**
   * LOCAL - Bounded to this workspace/project
   *
   * This meaning is specific to the current context.
   * It may not translate to other systems without explicit mapping.
   */
  LOCAL: 'Local',

  /**
   * FEDERATED - Travels with explicit translation rules
   *
   * This meaning can be shared across systems, but requires
   * explicit translation or mapping when crossing boundaries.
   */
  FEDERATED: 'Federated',

  /**
   * UNIVERSAL - Same meaning everywhere
   *
   * This meaning is anchored to a global standard (URI, ontology)
   * and should be interpreted identically across all contexts.
   */
  UNIVERSAL: 'Universal'
});

// ============================================================================
// DIMENSION III: Time
// ============================================================================

/**
 * Time - How does this meaning change?
 *
 * Defines the temporal behavior of this meaning.
 */
const MeaningTime = Object.freeze({
  /**
   * IMMUTABLE - Fixed once defined
   *
   * This meaning does not change. If the concept evolves,
   * a new definition should be created (with supersession chain).
   */
  IMMUTABLE: 'Immutable',

  /**
   * VERSIONED - Changes at defined epochs
   *
   * This meaning changes through explicit version transitions.
   * v1 → v2 with clear effective dates and migration paths.
   */
  VERSIONED: 'Versioned',

  /**
   * EVOLVING - Continuously updating
   *
   * This meaning is in flux. It may change at any time
   * without explicit version boundaries.
   */
  EVOLVING: 'Evolving'
});

// ============================================================================
// Authority Annotation (NOT a dimension)
// ============================================================================

/**
 * AuthoritySource - Optional annotation for who maintains the meaning
 *
 * This is NOT a dimension. It's metadata about Declared meanings.
 * Absorbed from the former Governance dimension as an optional field.
 */
const AuthoritySource = Object.freeze({
  HUMAN: 'Human',       // Individual decision-maker
  PROCESS: 'Process',   // Institutional/procedural authority
  SYSTEM: 'System'      // Automated/algorithmic authority
});

// ============================================================================
// Dimension Metadata
// ============================================================================

/**
 * Metadata for each dimension value
 */
const MeaningDimensionMeta = Object.freeze({
  // Identity dimension
  [MeaningIdentity.DECLARED]: {
    dimension: 'identity',
    value: 'Declared',
    icon: 'ph-stamp',
    color: '#6366f1',
    description: 'Meaning exists because an authority asserts it',
    question: 'Would collapse if authority withdrew',
    shortDesc: 'Authority-asserted'
  },
  [MeaningIdentity.STABILIZED]: {
    dimension: 'identity',
    value: 'Stabilized',
    icon: 'ph-check-circle',
    color: '#10b981',
    description: 'Meaning persists because systems agree and reinforce it',
    question: 'Would bend but persist if challenged',
    shortDesc: 'System-reinforced'
  },
  [MeaningIdentity.CONTESTED]: {
    dimension: 'identity',
    value: 'Contested',
    icon: 'ph-warning',
    color: '#f59e0b',
    description: 'Meaning is disputed, provisional, or actively evolving',
    question: 'Already bending under challenge',
    shortDesc: 'Under dispute'
  },

  // Space dimension
  [MeaningSpace.LOCAL]: {
    dimension: 'space',
    value: 'Local',
    icon: 'ph-house',
    color: '#64748b',
    description: 'Bounded to this workspace/project',
    question: 'Valid only within this context',
    shortDesc: 'Project-bound'
  },
  [MeaningSpace.FEDERATED]: {
    dimension: 'space',
    value: 'Federated',
    icon: 'ph-handshake',
    color: '#10b981',
    description: 'Travels with explicit translation rules',
    question: 'Requires mapping to cross boundaries',
    shortDesc: 'Translatable'
  },
  [MeaningSpace.UNIVERSAL]: {
    dimension: 'space',
    value: 'Universal',
    icon: 'ph-globe',
    color: '#6366f1',
    description: 'Same meaning everywhere',
    question: 'Anchored to global standard',
    shortDesc: 'Globally consistent'
  },

  // Time dimension
  [MeaningTime.IMMUTABLE]: {
    dimension: 'time',
    value: 'Immutable',
    icon: 'ph-lock-simple',
    color: '#6366f1',
    description: 'Fixed once defined',
    question: 'Never changes after creation',
    shortDesc: 'Frozen'
  },
  [MeaningTime.VERSIONED]: {
    dimension: 'time',
    value: 'Versioned',
    icon: 'ph-clock-counter-clockwise',
    color: '#8b5cf6',
    description: 'Changes at defined epochs',
    question: 'Explicit v1 → v2 transitions',
    shortDesc: 'Epoch-based'
  },
  [MeaningTime.EVOLVING]: {
    dimension: 'time',
    value: 'Evolving',
    icon: 'ph-arrows-clockwise',
    color: '#f59e0b',
    description: 'Continuously updating',
    question: 'May change at any time',
    shortDesc: 'In flux'
  }
});

/**
 * Get metadata for a dimension value
 */
function getMeaningMeta(value) {
  return MeaningDimensionMeta[value] || null;
}

// ============================================================================
// Meaning State (Combined Position)
// ============================================================================

/**
 * MeaningState - A complete position in the 27-state space
 */
class MeaningState {
  /**
   * @param {Object} options
   * @param {string} options.identity - One of MeaningIdentity values
   * @param {string} options.space - One of MeaningSpace values
   * @param {string} options.time - One of MeaningTime values
   * @param {string} [options.authoritySource] - Optional authority annotation
   */
  constructor(options = {}) {
    this.identity = options.identity || MeaningIdentity.CONTESTED;
    this.space = options.space || MeaningSpace.LOCAL;
    this.time = options.time || MeaningTime.EVOLVING;

    // Optional authority annotation (not a dimension)
    this.authoritySource = options.authoritySource || null;

    // Validate
    this._validate();
  }

  /**
   * Validate that values are from the allowed enums
   * @private
   */
  _validate() {
    if (!Object.values(MeaningIdentity).includes(this.identity)) {
      throw new Error(`Invalid identity: ${this.identity}`);
    }
    if (!Object.values(MeaningSpace).includes(this.space)) {
      throw new Error(`Invalid space: ${this.space}`);
    }
    if (!Object.values(MeaningTime).includes(this.time)) {
      throw new Error(`Invalid time: ${this.time}`);
    }
    if (this.authoritySource && !Object.values(AuthoritySource).includes(this.authoritySource)) {
      throw new Error(`Invalid authority source: ${this.authoritySource}`);
    }
  }

  /**
   * Get a unique key for this state (for indexing)
   */
  get stateKey() {
    return `${this.identity}:${this.space}:${this.time}`;
  }

  /**
   * Get numeric position in the 27-state space (0-26)
   */
  get stateIndex() {
    const identityIndex = Object.values(MeaningIdentity).indexOf(this.identity);
    const spaceIndex = Object.values(MeaningSpace).indexOf(this.space);
    const timeIndex = Object.values(MeaningTime).indexOf(this.time);
    return identityIndex * 9 + spaceIndex * 3 + timeIndex;
  }

  /**
   * Get metadata for each dimension of this state
   */
  getMeta() {
    return {
      identity: getMeaningMeta(this.identity),
      space: getMeaningMeta(this.space),
      time: getMeaningMeta(this.time)
    };
  }

  /**
   * Get a human-readable description of this state
   */
  describe() {
    const meta = this.getMeta();
    return `${meta.identity.shortDesc}, ${meta.space.shortDesc}, ${meta.time.shortDesc}`;
  }

  /**
   * Create from a definition object (infer state from definition properties)
   */
  static fromDefinition(definition) {
    // This would be implemented based on the inference logic in eo_data_workbench.js
    // For now, return a default state
    return new MeaningState({
      identity: definition?.overrides?.identity || MeaningIdentity.CONTESTED,
      space: definition?.overrides?.space || MeaningSpace.LOCAL,
      time: definition?.overrides?.time || MeaningTime.EVOLVING,
      authoritySource: definition?.overrides?.authoritySource || null
    });
  }

  toJSON() {
    return {
      identity: this.identity,
      space: this.space,
      time: this.time,
      authoritySource: this.authoritySource
    };
  }
}

// ============================================================================
// State Matrix (All 27 States)
// ============================================================================

/**
 * Generate all 27 possible meaning states
 */
function getAllMeaningStates() {
  const states = [];
  for (const identity of Object.values(MeaningIdentity)) {
    for (const space of Object.values(MeaningSpace)) {
      for (const time of Object.values(MeaningTime)) {
        states.push(new MeaningState({ identity, space, time }));
      }
    }
  }
  return states;
}

/**
 * Get state by index (0-26)
 */
function getMeaningStateByIndex(index) {
  const states = getAllMeaningStates();
  return states[index] || null;
}

/**
 * Get state by key (e.g., "Stabilized:Universal:Versioned")
 */
function getMeaningStateByKey(key) {
  const [identity, space, time] = key.split(':');
  return new MeaningState({ identity, space, time });
}

// ============================================================================
// Dimension Questions
// ============================================================================

/**
 * The core questions for each dimension
 */
const DimensionQuestions = Object.freeze({
  IDENTITY: 'How is this meaning stabilized in the world?',
  SPACE: 'Where does this meaning apply?',
  TIME: 'How does this meaning change?'
});

/**
 * The collapsed governance question (now answered by Identity)
 */
const GovernanceQuestion = 'If this meaning were challenged tomorrow, would it collapse, bend, or hold?';

// ============================================================================
// Migration Helpers
// ============================================================================

/**
 * Migrate from old 4-dimension schema to new 3-dimension schema
 *
 * Old schema had: Identity (Kind), Space, Time, Governance
 * New schema has: Identity (absorbs Governance), Space, Time
 */
function migrateFromLegacySchema(legacyDimensions) {
  const {
    identity: legacyIdentity,
    kind: legacyKind,
    space,
    time,
    governance
  } = legacyDimensions || {};

  // Map legacy kind/identity values to new Identity
  const identityMap = {
    // Legacy kind values
    'Identifier': MeaningIdentity.STABILIZED,
    'Descriptor': MeaningIdentity.STABILIZED,
    'Relationship': MeaningIdentity.STABILIZED,
    // Legacy governance confidence values
    'Established': MeaningIdentity.STABILIZED,
    'Provisional': MeaningIdentity.CONTESTED,
    'Contested': MeaningIdentity.CONTESTED,
    // New identity values (pass through)
    'Declared': MeaningIdentity.DECLARED,
    'Stabilized': MeaningIdentity.STABILIZED
  };

  // Map legacy space values
  const spaceMap = {
    'Local': MeaningSpace.LOCAL,
    'Federated': MeaningSpace.FEDERATED,
    'Universal': MeaningSpace.UNIVERSAL,
    'Cross-Framework': MeaningSpace.FEDERATED
  };

  // Map legacy time values
  const timeMap = {
    'Immutable': MeaningTime.IMMUTABLE,
    'Versioned': MeaningTime.VERSIONED,
    'Evolving': MeaningTime.EVOLVING,
    'Evolves': MeaningTime.EVOLVING,
    'Mutable': MeaningTime.EVOLVING
  };

  // Extract authority source from legacy governance
  let authoritySource = null;
  if (governance?.authority) {
    const authMap = {
      'Human': AuthoritySource.HUMAN,
      'Process': AuthoritySource.PROCESS,
      'System': AuthoritySource.SYSTEM
    };
    authoritySource = authMap[governance.authority] || null;
  }

  // Determine new identity from legacy values
  let newIdentity = MeaningIdentity.CONTESTED;
  if (legacyIdentity && identityMap[legacyIdentity]) {
    newIdentity = identityMap[legacyIdentity];
  } else if (legacyKind && identityMap[legacyKind]) {
    newIdentity = identityMap[legacyKind];
  } else if (governance?.confidence && identityMap[governance.confidence]) {
    newIdentity = identityMap[governance.confidence];
  }

  return new MeaningState({
    identity: newIdentity,
    space: spaceMap[space] || MeaningSpace.LOCAL,
    time: timeMap[time] || MeaningTime.EVOLVING,
    authoritySource
  });
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Core enums
    MeaningIdentity,
    MeaningSpace,
    MeaningTime,
    AuthoritySource,

    // Metadata
    MeaningDimensionMeta,
    DimensionQuestions,
    GovernanceQuestion,
    getMeaningMeta,

    // State class
    MeaningState,

    // State matrix
    getAllMeaningStates,
    getMeaningStateByIndex,
    getMeaningStateByKey,

    // Migration
    migrateFromLegacySchema
  };
}

if (typeof window !== 'undefined') {
  window.EOMeaningStabilization = {
    // Core enums
    MeaningIdentity,
    MeaningSpace,
    MeaningTime,
    AuthoritySource,

    // Metadata
    MeaningDimensionMeta,
    DimensionQuestions,
    GovernanceQuestion,
    getMeaningMeta,

    // State class
    MeaningState,

    // State matrix
    getAllMeaningStates,
    getMeaningStateByIndex,
    getMeaningStateByKey,

    // Migration
    migrateFromLegacySchema
  };
}
