/**
 * EO Inference Engine - Three-Layer Behavior Model
 *
 * ARCHITECTURAL PRINCIPLE:
 * EO roles may be stored as conditional assertions of intent, but never as
 * intrinsic properties; the system continuously evaluates whether observed
 * behavior supports those assertions.
 *
 * THE THREE LAYERS:
 * 1. OBSERVED BEHAVIOR (derived) - Computed from properties and edges
 * 2. INFERRED ROLE (ephemeral) - What the system thinks this acts like
 * 3. ASSERTED ROLE (stored) - Human/policy intent with conditions
 *
 * KEY INSIGHT:
 * EO roles (holon/protogon/emanon) don't CAUSE different effects.
 * They SENSITIZE entities differently to the same edges.
 * Same edge + different EO role = different system reaction.
 */

// ============================================================================
// EO ROLE DEFINITIONS
// ============================================================================

/**
 * EO Role names - these are named regions in behavior space, not types
 */
const EORole = Object.freeze({
  HOLON: 'holon',       // Stable anchor, load-bearing
  PROTOGON: 'protogon', // Bridge/mediator, phase-bound
  EMANON: 'emanon',     // Emergent/contextual, perspectival
  MIXED: 'mixed'        // No dominant pattern
});

/**
 * EO Role descriptions for UI
 */
const EORoleDescriptions = Object.freeze({
  [EORole.HOLON]: {
    name: 'Holon',
    shortDescription: 'Stable identity anchor',
    description: 'Acts as a meaning anchor - stable semantic foundation that others depend on.',
    characteristics: [
      'Stable meaning that resists change',
      'System or external authority',
      'High dependency tolerance (many things rely on it)',
      'Low temporal flux'
    ]
  },
  [EORole.PROTOGON]: {
    name: 'Protogon',
    shortDescription: 'Meaning bridge',
    description: 'Acts as a meaning bridge - mediates between stable and dynamic meanings within structured phases.',
    characteristics: [
      'Contextual stability (valid within scope)',
      'Process-bound authority',
      'Moderate dependencies',
      'Structured change is expected'
    ]
  },
  [EORole.EMANON]: {
    name: 'Emanon',
    shortDescription: 'Emergent meaning',
    description: 'Acts as emergent meaning - highly contextual and adaptive, shaped by perspective.',
    characteristics: [
      'Interpretive stability (meaning varies)',
      'Human/perspectival authority',
      'Low dependency tolerance',
      'High temporal flux'
    ]
  },
  [EORole.MIXED]: {
    name: 'Mixed',
    shortDescription: 'No dominant pattern',
    description: 'No single dominant behavior pattern - exhibits characteristics of multiple roles.',
    characteristics: []
  }
});

// ============================================================================
// LAYER 1: OBSERVED BEHAVIOR (Derived)
// ============================================================================

/**
 * Behavior profile - a vector of continuous values derived from observation
 *
 * This is NOT an EO role. It's what we OBSERVE about an entity.
 * EO roles are just named regions in this space.
 */
class BehaviorProfile {
  constructor(data = {}) {
    // Core behavior dimensions (0.0 to 1.0)
    this.interpretiveWeight = data.interpretiveWeight || 0.5;  // How interpretive is the meaning?
    this.temporalFlux = data.temporalFlux || 0.3;              // How much change expected?
    this.authorityRigidity = data.authorityRigidity || 0.5;    // How constrained by authority?
    this.dependencyTolerance = data.dependencyTolerance || 0.5; // Can it bear dependencies?

    // Metadata
    this.computedAt = new Date().toISOString();
    this.sources = data.sources || [];

    Object.freeze(this);
  }

  /**
   * Compute Euclidean distance to another profile
   */
  distanceTo(other) {
    return Math.sqrt(
      Math.pow(this.interpretiveWeight - other.interpretiveWeight, 2) +
      Math.pow(this.temporalFlux - other.temporalFlux, 2) +
      Math.pow(this.authorityRigidity - other.authorityRigidity, 2) +
      Math.pow(this.dependencyTolerance - other.dependencyTolerance, 2)
    );
  }

  toJSON() {
    return {
      interpretiveWeight: this.interpretiveWeight,
      temporalFlux: this.temporalFlux,
      authorityRigidity: this.authorityRigidity,
      dependencyTolerance: this.dependencyTolerance,
      computedAt: this.computedAt,
      sources: this.sources
    };
  }
}

/**
 * Canonical profiles for each EO role
 * These define the "centers" of each role region in behavior space
 */
const CanonicalProfiles = Object.freeze({
  [EORole.HOLON]: new BehaviorProfile({
    interpretiveWeight: 0.1,    // Very stable meaning
    temporalFlux: 0.1,          // Rarely changes
    authorityRigidity: 0.9,     // Strong system/external authority
    dependencyTolerance: 0.9    // Can bear many dependencies
  }),
  [EORole.PROTOGON]: new BehaviorProfile({
    interpretiveWeight: 0.5,    // Contextual meaning
    temporalFlux: 0.5,          // Structured change
    authorityRigidity: 0.6,     // Process-bound authority
    dependencyTolerance: 0.5    // Moderate dependencies
  }),
  [EORole.EMANON]: new BehaviorProfile({
    interpretiveWeight: 0.9,    // Highly interpretive
    temporalFlux: 0.8,          // Frequent change
    authorityRigidity: 0.2,     // Perspectival authority
    dependencyTolerance: 0.2    // Cannot bear many dependencies
  })
});

/**
 * Compute observed behavior profile from definition properties and edges
 */
function computeBehaviorProfile(definition, edges = []) {
  const sources = [];

  // Extract properties
  const stability = definition.stability || definition.values?.fld_def_stability || 'contextual';
  const authority = definition.authority || definition.values?.fld_def_authority || 'human';
  const timeBehavior = definition.time || definition.values?.fld_def_time || 'mutable';

  // 1. Interpretive weight from stability
  let interpretiveWeight;
  switch (stability) {
    case 'stable':
      interpretiveWeight = 0.1;
      break;
    case 'contextual':
      interpretiveWeight = 0.5;
      break;
    case 'interpretive':
    case 'evolves':
      interpretiveWeight = 0.8;
      break;
    default:
      interpretiveWeight = 0.5;
  }
  sources.push({ dimension: 'interpretiveWeight', from: 'stability', value: stability });

  // 2. Authority rigidity from authority type
  let authorityRigidity;
  switch (authority) {
    case 'system':
      authorityRigidity = 0.9;
      break;
    case 'external':
      authorityRigidity = 0.8;
      break;
    case 'process':
      authorityRigidity = 0.6;
      break;
    case 'human':
      authorityRigidity = 0.2;
      break;
    default:
      authorityRigidity = 0.5;
  }
  sources.push({ dimension: 'authorityRigidity', from: 'authority', value: authority });

  // 3. Temporal flux from time behavior + edges
  let temporalFlux;
  switch (timeBehavior) {
    case 'immutable':
      temporalFlux = 0.0;
      break;
    case 'mutable':
      temporalFlux = 0.3;
      break;
    case 'evolves':
    case 'versioned':
      temporalFlux = 0.7;
      break;
    default:
      temporalFlux = 0.3;
  }

  // Adjust for supersession edges
  const supersessionEdges = edges.filter(
    e => e.type === 'SUPERSEDES' && (e.sourceId === definition.id || e.targetId === definition.id)
  );
  if (supersessionEdges.length > 0) {
    temporalFlux = Math.min(1.0, temporalFlux + 0.2 * supersessionEdges.length);
    sources.push({ dimension: 'temporalFlux', from: 'supersedes_edges', count: supersessionEdges.length });
  }
  sources.push({ dimension: 'temporalFlux', from: 'time', value: timeBehavior });

  // 4. Dependency tolerance from edge patterns
  const incomingDeps = edges.filter(
    e => e.targetId === definition.id && ['DEPENDS_ON', 'VALIDATES_AGAINST'].includes(e.type)
  ).length;
  const outgoingBindings = edges.filter(
    e => e.sourceId === definition.id && e.type === 'DEFINES_MEANING_OF'
  ).length;

  // More dependencies = higher tolerance required/demonstrated
  // But this is capped by stability - interpretive things shouldn't bear many deps
  const rawTolerance = Math.min(1.0, (incomingDeps + outgoingBindings) / 10);
  const dependencyTolerance = stability === 'stable'
    ? Math.max(0.5, rawTolerance)  // Stable things can bear deps
    : Math.min(0.5, rawTolerance); // Interpretive things shouldn't

  sources.push({
    dimension: 'dependencyTolerance',
    from: 'edges',
    incomingDeps,
    outgoingBindings
  });

  return new BehaviorProfile({
    interpretiveWeight,
    temporalFlux,
    authorityRigidity,
    dependencyTolerance,
    sources
  });
}

// ============================================================================
// LAYER 2: INFERRED ROLE (Ephemeral)
// ============================================================================

/**
 * Infer EO role from behavior profile
 * This is what the system THINKS this entity is acting like RIGHT NOW
 */
function inferEORole(behaviorProfile) {
  // Compute distances to canonical profiles
  const distances = {
    [EORole.HOLON]: behaviorProfile.distanceTo(CanonicalProfiles[EORole.HOLON]),
    [EORole.PROTOGON]: behaviorProfile.distanceTo(CanonicalProfiles[EORole.PROTOGON]),
    [EORole.EMANON]: behaviorProfile.distanceTo(CanonicalProfiles[EORole.EMANON])
  };

  // Find closest
  let closest = EORole.MIXED;
  let minDistance = Infinity;
  const threshold = 0.5; // Must be reasonably close to be considered

  for (const [role, distance] of Object.entries(distances)) {
    if (distance < minDistance) {
      minDistance = distance;
      closest = role;
    }
  }

  // If not close enough to any, it's mixed
  if (minDistance > threshold) {
    closest = EORole.MIXED;
  }

  return {
    role: closest,
    confidence: Math.max(0, 1 - minDistance),
    distances,
    profile: behaviorProfile
  };
}

// ============================================================================
// LAYER 3: ASSERTED ROLE (Stored)
// ============================================================================

/**
 * EO Role Assertion - A claim about how something SHOULD be treated
 *
 * This is NOT saying "this IS a holon"
 * This is saying "Treat this AS IF it were a holon, so long as conditions hold"
 */
class EOAssertedRole {
  constructor(data = {}) {
    this.role = data.role || EORole.MIXED;
    this.assertedBy = data.assertedBy || 'system';  // 'system' | 'human' | 'policy'
    this.confidence = data.confidence || 0.5;
    this.conditions = data.conditions || [];
    this.scope = data.scope || 'global';  // 'global' | 'dataset' | 'process'
    this.timestamp = data.timestamp || new Date().toISOString();
    this.reason = data.reason || null;

    Object.freeze(this);
  }

  toJSON() {
    return {
      role: this.role,
      assertedBy: this.assertedBy,
      confidence: this.confidence,
      conditions: this.conditions,
      scope: this.scope,
      timestamp: this.timestamp,
      reason: this.reason
    };
  }
}

/**
 * Default conditions for each role
 */
const DefaultRoleConditions = Object.freeze({
  [EORole.HOLON]: [
    { property: 'stability', operator: '==', value: 'stable' },
    { property: 'authority', operator: 'in', value: ['system', 'external'] },
    { edge: 'SUPERSEDES', direction: 'outgoing', operator: '==', count: 0 }
  ],
  [EORole.PROTOGON]: [
    { property: 'stability', operator: 'in', value: ['stable', 'contextual'] },
    { property: 'authority', operator: '==', value: 'process' }
  ],
  [EORole.EMANON]: [
    { property: 'stability', operator: 'in', value: ['contextual', 'interpretive'] },
    { property: 'authority', operator: '==', value: 'human' }
  ]
});

/**
 * Evaluate whether conditions are met
 */
function evaluateConditions(conditions, definition, edges) {
  const results = [];

  for (const condition of conditions) {
    let met = false;
    let actual = null;

    if (condition.property) {
      actual = definition[condition.property] || definition.values?.[`fld_def_${condition.property}`];
      switch (condition.operator) {
        case '==':
          met = actual === condition.value;
          break;
        case '!=':
          met = actual !== condition.value;
          break;
        case 'in':
          met = Array.isArray(condition.value) && condition.value.includes(actual);
          break;
      }
    } else if (condition.edge) {
      const relevantEdges = edges.filter(e => {
        if (e.type !== condition.edge) return false;
        if (condition.direction === 'outgoing') return e.sourceId === definition.id;
        if (condition.direction === 'incoming') return e.targetId === definition.id;
        return true;
      });
      actual = relevantEdges.length;
      switch (condition.operator) {
        case '==':
          met = actual === condition.count;
          break;
        case '>':
          met = actual > condition.count;
          break;
        case '<':
          met = actual < condition.count;
          break;
      }
    }

    results.push({ condition, met, actual });
  }

  const allMet = results.every(r => r.met);
  return { allMet, results };
}

// ============================================================================
// EFFECTIVE ROLE RESOLUTION
// ============================================================================

/**
 * Resolve the effective EO role considering both inference and assertion
 *
 * Resolution logic:
 * 1. If no assertion exists, use inferred role
 * 2. If assertion exists and conditions hold, use asserted role
 * 3. If assertion exists but conditions fail, flag drift and use inferred
 */
function resolveEffectiveRole(definition, edges, assertedRole = null) {
  // Compute observed behavior
  const behaviorProfile = computeBehaviorProfile(definition, edges);

  // Infer role from behavior
  const inferred = inferEORole(behaviorProfile);

  // If no assertion, use inference
  if (!assertedRole) {
    return {
      effectiveRole: inferred.role,
      source: 'inferred',
      inferred,
      asserted: null,
      drift: null,
      behaviorProfile
    };
  }

  // Evaluate assertion conditions
  const conditionEval = evaluateConditions(assertedRole.conditions, definition, edges);

  // If conditions hold, use assertion
  if (conditionEval.allMet) {
    // Check for drift (assertion valid but inference disagrees)
    const drift = inferred.role !== assertedRole.role ? {
      type: 'soft',
      message: `Behaving like ${inferred.role} but asserted as ${assertedRole.role}`,
      inferredRole: inferred.role,
      assertedRole: assertedRole.role,
      confidence: inferred.confidence
    } : null;

    return {
      effectiveRole: assertedRole.role,
      source: 'asserted',
      inferred,
      asserted: assertedRole,
      drift,
      behaviorProfile,
      conditionEvaluation: conditionEval
    };
  }

  // Conditions failed - flag hard drift, use inference
  return {
    effectiveRole: inferred.role,
    source: 'inferred_due_to_drift',
    inferred,
    asserted: assertedRole,
    drift: {
      type: 'hard',
      message: `Asserted as ${assertedRole.role} but conditions no longer hold`,
      failedConditions: conditionEval.results.filter(r => !r.met),
      assertedRole: assertedRole.role,
      inferredRole: inferred.role
    },
    behaviorProfile,
    conditionEvaluation: conditionEval
  };
}

// ============================================================================
// SUSCEPTIBILITY CALCULATION
// ============================================================================

/**
 * Calculate how strongly an EO role reacts to a given edge type
 *
 * This is the key insight: EO roles don't CAUSE effects,
 * they SENSITIZE entities to edges differently.
 */
const RoleSusceptibility = Object.freeze({
  // How each role reacts to DEPENDS_ON edges
  DEPENDS_ON: {
    [EORole.HOLON]: {
      riskMultiplier: 0.5,    // Usage strengthens holons
      explanation: 'Dependency is safe and strengthening'
    },
    [EORole.PROTOGON]: {
      riskMultiplier: 1.0,    // Moderate effect
      explanation: 'Dependency is legitimate but phase-bound'
    },
    [EORole.EMANON]: {
      riskMultiplier: 2.0,    // Dangerous!
      explanation: 'Building structure on perspectival meaning is fragile'
    }
  },

  // How each role reacts to SUPERSEDES edges
  SUPERSEDES: {
    [EORole.HOLON]: {
      riskMultiplier: 3.0,    // Identity break!
      explanation: 'Supersession threatens referential identity'
    },
    [EORole.PROTOGON]: {
      riskMultiplier: 1.0,    // Clean phase transition
      explanation: 'Supersession is a normal phase transition'
    },
    [EORole.EMANON]: {
      riskMultiplier: 0.5,    // Expected behavior
      explanation: 'Supersession is natural for emergent meanings'
    }
  },

  // How each role reacts to GOVERNED_BY edges
  GOVERNED_BY: {
    [EORole.HOLON]: {
      riskMultiplier: 0.5,    // Governance is often redundant
      explanation: 'Governance may over-specify stable authority'
    },
    [EORole.PROTOGON]: {
      riskMultiplier: 0.8,    // Reinforces lifecycle
      explanation: 'Governance reinforces structured change'
    },
    [EORole.EMANON]: {
      riskMultiplier: 0.5,    // Constrains interpretation
      explanation: 'Governance helps crystallize meaning'
    }
  },

  // How each role reacts to CONFLICTS_WITH edges
  CONFLICTS_WITH: {
    [EORole.HOLON]: {
      riskMultiplier: 4.0,    // Catastrophic
      explanation: 'Conflict with anchor meaning is critical'
    },
    [EORole.PROTOGON]: {
      riskMultiplier: 2.0,    // Signals process mismatch
      explanation: 'Conflict signals phase/process mismatch'
    },
    [EORole.EMANON]: {
      riskMultiplier: 1.0,    // Expected
      explanation: 'Conflict is expected for perspectival meanings'
    }
  },

  // How each role reacts to REFINES_MEANING_OF edges
  REFINES_MEANING_OF: {
    [EORole.HOLON]: {
      riskMultiplier: 2.0,    // Threatens identity invariance
      explanation: 'Refinement may alter stable identity'
    },
    [EORole.PROTOGON]: {
      riskMultiplier: 0.8,    // Safe if scoped
      explanation: 'Specialization within bounds is safe'
    },
    [EORole.EMANON]: {
      riskMultiplier: 0.5,    // May actually change meaning
      explanation: 'Refinement may be reinterpretation'
    }
  }
});

/**
 * Get susceptibility for a role + edge combination
 */
function getSusceptibility(role, edgeType) {
  const edgeSusceptibility = RoleSusceptibility[edgeType];
  if (!edgeSusceptibility) {
    return { riskMultiplier: 1.0, explanation: 'No specific susceptibility defined' };
  }
  return edgeSusceptibility[role] || { riskMultiplier: 1.0, explanation: 'No role-specific susceptibility' };
}

// ============================================================================
// INFERENCE ENGINE CLASS
// ============================================================================

/**
 * EO Inference Engine - Orchestrates the three-layer model
 */
class EOInferenceEngine {
  constructor() {
    this.assertions = new Map();  // definitionId -> EOAssertedRole
  }

  /**
   * Set an assertion for a definition
   */
  setAssertion(definitionId, assertion) {
    if (!(assertion instanceof EOAssertedRole)) {
      assertion = new EOAssertedRole(assertion);
    }
    this.assertions.set(definitionId, assertion);
  }

  /**
   * Get assertion for a definition
   */
  getAssertion(definitionId) {
    return this.assertions.get(definitionId) || null;
  }

  /**
   * Remove assertion
   */
  clearAssertion(definitionId) {
    this.assertions.delete(definitionId);
  }

  /**
   * Compute the full profile for a definition
   */
  computeProfile(definition, edges = []) {
    const assertion = this.getAssertion(definition.id);
    const resolved = resolveEffectiveRole(definition, edges, assertion);

    return {
      definitionId: definition.id,
      effectiveRole: resolved.effectiveRole,
      source: resolved.source,
      behaviorProfile: resolved.behaviorProfile,
      inferred: resolved.inferred,
      asserted: resolved.asserted,
      drift: resolved.drift,
      conditionEvaluation: resolved.conditionEvaluation,
      computedAt: new Date().toISOString()
    };
  }

  /**
   * Compute risk for an edge considering EO susceptibility
   */
  computeEdgeRisk(edge, targetDefinition, edges = []) {
    const profile = this.computeProfile(targetDefinition, edges);
    const susceptibility = getSusceptibility(profile.effectiveRole, edge.type);

    const baseRisk = 1.0;  // Could be enhanced with other factors
    const adjustedRisk = baseRisk * susceptibility.riskMultiplier;

    return {
      edge,
      targetRole: profile.effectiveRole,
      baseRisk,
      susceptibilityMultiplier: susceptibility.riskMultiplier,
      adjustedRisk,
      explanation: susceptibility.explanation,
      roleExplanation: `Target is acting as ${profile.effectiveRole} (${profile.source})`
    };
  }

  /**
   * Check for drift across all assertions
   */
  detectDrift(definitions, getEdgesForDefinition) {
    const driftReports = [];

    for (const [defId, assertion] of this.assertions) {
      const definition = definitions.find(d => d.id === defId);
      if (!definition) continue;

      const edges = getEdgesForDefinition(defId);
      const resolved = resolveEffectiveRole(definition, edges, assertion);

      if (resolved.drift) {
        driftReports.push({
          definitionId: defId,
          definitionName: definition.name || definition.values?.fld_def_term,
          ...resolved.drift
        });
      }
    }

    return driftReports;
  }

  /**
   * Suggest an assertion based on observed behavior
   */
  suggestAssertion(definition, edges = []) {
    const profile = computeBehaviorProfile(definition, edges);
    const inferred = inferEORole(profile);

    if (inferred.role === EORole.MIXED || inferred.confidence < 0.5) {
      return null;  // Not confident enough to suggest
    }

    return new EOAssertedRole({
      role: inferred.role,
      assertedBy: 'system',
      confidence: inferred.confidence,
      conditions: DefaultRoleConditions[inferred.role] || [],
      scope: 'global',
      reason: `System inferred from behavior profile with ${(inferred.confidence * 100).toFixed(0)}% confidence`
    });
  }

  /**
   * Export all assertions
   */
  exportAssertions() {
    const result = {};
    for (const [id, assertion] of this.assertions) {
      result[id] = assertion.toJSON();
    }
    return result;
  }

  /**
   * Import assertions
   */
  importAssertions(data) {
    for (const [id, assertionData] of Object.entries(data)) {
      this.setAssertion(id, new EOAssertedRole(assertionData));
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let _engine = null;

function getInferenceEngine() {
  if (!_engine) _engine = new EOInferenceEngine();
  return _engine;
}

function initInferenceEngine() {
  _engine = new EOInferenceEngine();
  return _engine;
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Types
    EORole,
    EORoleDescriptions,

    // Classes
    BehaviorProfile,
    EOAssertedRole,
    EOInferenceEngine,

    // Constants
    CanonicalProfiles,
    DefaultRoleConditions,
    RoleSusceptibility,

    // Functions
    computeBehaviorProfile,
    inferEORole,
    evaluateConditions,
    resolveEffectiveRole,
    getSusceptibility,

    // Singleton
    getInferenceEngine,
    initInferenceEngine
  };
}

if (typeof window !== 'undefined') {
  window.EORole = EORole;
  window.EORoleDescriptions = EORoleDescriptions;
  window.BehaviorProfile = BehaviorProfile;
  window.EOAssertedRole = EOAssertedRole;
  window.EOInferenceEngine = EOInferenceEngine;
  window.CanonicalProfiles = CanonicalProfiles;
  window.RoleSusceptibility = RoleSusceptibility;
  window.computeBehaviorProfile = computeBehaviorProfile;
  window.inferEORole = inferEORole;
  window.resolveEffectiveRole = resolveEffectiveRole;
  window.getSusceptibility = getSusceptibility;
  window.getInferenceEngine = getInferenceEngine;
  window.initInferenceEngine = initInferenceEngine;
}
