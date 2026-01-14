/**
 * EO Interaction Physics - Edge × Entity Interpretation with EO Susceptibility
 *
 * THE CORE PRINCIPLE:
 * Entity types don't determine behavior.
 * Edge types determine behavior.
 * Entity types determine HOW edge semantics are interpreted.
 * EO roles determine how STRONGLY an entity reacts.
 *
 * Same edge + different entity pair = different consequences.
 * Same edge + different EO role = different system reaction.
 *
 * Think of edges as FORCE VECTORS.
 * EO roles as SUSCEPTIBILITY profiles.
 * The effect = force × susceptibility.
 */

// ============================================================================
// INTERACTION EFFECTS
// ============================================================================

/**
 * The types of effects an edge can produce
 */
const InteractionEffect = Object.freeze({
  // Semantic effects
  SEMANTIC_LINEAGE: 'semantic_lineage',
  SEMANTIC_COUPLING: 'semantic_coupling',
  SEMANTIC_SPECIALIZATION: 'semantic_specialization',
  SEMANTIC_CONFLICT: 'semantic_conflict',

  // Operational effects
  OPERATIONALIZATION: 'operationalization',
  INSTITUTIONALIZATION: 'institutionalization',
  CONTRACTUALIZATION: 'contractualization',

  // Authority effects
  LIFECYCLE_BINDING: 'lifecycle_binding',
  PERSPECTIVAL_AUTHORITY: 'perspectival_authority',
  EXTERNAL_CONSTRAINT: 'external_constraint',

  // Temporal effects
  IDENTITY_CONTINUITY: 'identity_continuity',
  PHASE_TRANSITION: 'phase_transition',

  // Risk effects
  RISK_ESCALATION: 'risk_escalation',
  BLAST_RADIUS_EXPANSION: 'blast_radius_expansion'
});

/**
 * Operator responses to edge interpretations
 */
const OperatorResponse = Object.freeze({
  // Risk responses
  ESCALATE_RISK: 'escalate_risk',
  BLOCK_AUTOMATION: 'block_automation',
  SURFACE_WHAT_BREAKS: 'surface_what_breaks',
  HARDEN_THRESHOLDS: 'harden_thresholds',

  // Governance responses
  REQUIRE_VERSIONING: 'require_versioning',
  REQUIRE_TEMPORAL_EDGE: 'require_temporal_edge',
  REQUIRE_JUSTIFICATION: 'require_justification',
  FLAG_FOR_REVIEW: 'flag_for_review',

  // Semantic responses
  TRACK_INHERITANCE: 'track_inheritance',
  CHECK_CIRCULAR: 'check_circular',
  SUGGEST_DISAMBIGUATION: 'suggest_disambiguation',

  // Authority responses
  ENFORCE_IMMUTABILITY: 'enforce_immutability',
  ISOLATE_BLAST_RADIUS: 'isolate_blast_radius',

  // Usage responses
  INCREASE_USAGE_ROLLUP: 'increase_usage_rollup',
  FLAG_GOVERNANCE_IMPORTANCE: 'flag_governance_importance'
});

// ============================================================================
// INTERACTION MATRIX
// ============================================================================

/**
 * The Interaction Matrix defines base behavior for each edge type + entity pair.
 * EO susceptibility is then applied on top of this.
 *
 * Format:
 * {
 *   [EdgeType]: {
 *     [SourceType]: {
 *       [TargetType]: {
 *         meaning: string,
 *         effects: InteractionEffect[],
 *         responses: OperatorResponse[],
 *         baseRisk: number (0-1)
 *       }
 *     }
 *   }
 * }
 */
const InteractionMatrix = Object.freeze({

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPENDS_ON - The most important edge
  // ═══════════════════════════════════════════════════════════════════════════

  DEPENDS_ON: {
    Definition: {
      Definition: {
        meaning: 'This meaning depends on another meaning',
        effects: [InteractionEffect.SEMANTIC_LINEAGE, InteractionEffect.SEMANTIC_COUPLING],
        responses: [OperatorResponse.TRACK_INHERITANCE],
        baseRisk: 0.3
      }
    },
    Rule: {
      Definition: {
        meaning: 'This logic depends on this meaning',
        effects: [InteractionEffect.OPERATIONALIZATION],
        responses: [OperatorResponse.SURFACE_WHAT_BREAKS],
        baseRisk: 0.5
      }
    },
    Report: {
      Definition: {
        meaning: 'This report depends on this meaning',
        effects: [InteractionEffect.INSTITUTIONALIZATION, InteractionEffect.BLAST_RADIUS_EXPANSION],
        responses: [OperatorResponse.INCREASE_USAGE_ROLLUP, OperatorResponse.FLAG_GOVERNANCE_IMPORTANCE],
        baseRisk: 0.4
      }
    },
    API: {
      Definition: {
        meaning: 'An external system depends on this meaning',
        effects: [InteractionEffect.CONTRACTUALIZATION, InteractionEffect.BLAST_RADIUS_EXPANSION],
        responses: [OperatorResponse.HARDEN_THRESHOLDS, OperatorResponse.REQUIRE_VERSIONING],
        baseRisk: 0.6
      }
    },
    Dataset: {
      Definition: {
        meaning: 'This dataset relies on this meaning',
        effects: [InteractionEffect.INSTITUTIONALIZATION],
        responses: [OperatorResponse.INCREASE_USAGE_ROLLUP],
        baseRisk: 0.4
      }
    },
    Lens: {
      Definition: {
        meaning: 'This view depends on this meaning',
        effects: [InteractionEffect.INSTITUTIONALIZATION],
        responses: [OperatorResponse.SURFACE_WHAT_BREAKS],
        baseRisk: 0.3
      }
    },
    Process: {
      Definition: {
        meaning: 'This workflow depends on this meaning',
        effects: [InteractionEffect.LIFECYCLE_BINDING],
        responses: [OperatorResponse.REQUIRE_TEMPORAL_EDGE],
        baseRisk: 0.4
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOVERNED_BY - Authority edges
  // ═══════════════════════════════════════════════════════════════════════════

  GOVERNED_BY: {
    Definition: {
      Process: {
        meaning: 'This meaning is governed by a workflow',
        effects: [InteractionEffect.LIFECYCLE_BINDING],
        responses: [OperatorResponse.REQUIRE_TEMPORAL_EDGE],
        baseRisk: 0.2  // Governance reduces risk
      },
      Actor: {
        meaning: 'This meaning is governed by human judgment',
        effects: [InteractionEffect.PERSPECTIVAL_AUTHORITY],
        responses: [OperatorResponse.ISOLATE_BLAST_RADIUS],
        baseRisk: 0.4
      },
      ExternalStandard: {
        meaning: 'This meaning is imposed by external standard',
        effects: [InteractionEffect.EXTERNAL_CONSTRAINT],
        responses: [OperatorResponse.ENFORCE_IMMUTABILITY],
        baseRisk: 0.1  // External authority is stable
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPERSEDES - Temporal edges
  // ═══════════════════════════════════════════════════════════════════════════

  SUPERSEDES: {
    Definition: {
      Definition: {
        meaning: 'This meaning replaces another',
        effects: [InteractionEffect.IDENTITY_CONTINUITY, InteractionEffect.PHASE_TRANSITION],
        responses: [OperatorResponse.FLAG_FOR_REVIEW, OperatorResponse.SURFACE_WHAT_BREAKS],
        baseRisk: 0.4
      }
    },
    Process: {
      Process: {
        meaning: 'This workflow replaces another',
        effects: [InteractionEffect.PHASE_TRANSITION],
        responses: [OperatorResponse.FLAG_FOR_REVIEW],
        baseRisk: 0.5
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REFINES_MEANING_OF - Semantic specialization
  // ═══════════════════════════════════════════════════════════════════════════

  REFINES_MEANING_OF: {
    Definition: {
      Definition: {
        meaning: 'This meaning refines another local meaning',
        effects: [InteractionEffect.SEMANTIC_SPECIALIZATION, InteractionEffect.SEMANTIC_COUPLING],
        responses: [OperatorResponse.CHECK_CIRCULAR, OperatorResponse.TRACK_INHERITANCE],
        baseRisk: 0.3
      },
      ExternalStandard: {
        meaning: 'This local meaning refines a standard',
        effects: [InteractionEffect.SEMANTIC_SPECIALIZATION],
        responses: [],
        baseRisk: 0.2  // Refinement of standard is good
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFLICTS_WITH - The most dangerous edge
  // ═══════════════════════════════════════════════════════════════════════════

  CONFLICTS_WITH: {
    Definition: {
      Definition: {
        meaning: 'These definitions have conflicting meanings',
        effects: [InteractionEffect.SEMANTIC_CONFLICT],
        responses: [OperatorResponse.ESCALATE_RISK, OperatorResponse.SUGGEST_DISAMBIGUATION],
        baseRisk: 0.7
      },
      ExternalStandard: {
        meaning: 'This definition conflicts with an external standard',
        effects: [InteractionEffect.SEMANTIC_CONFLICT, InteractionEffect.BLAST_RADIUS_EXPANSION],
        responses: [OperatorResponse.ESCALATE_RISK, OperatorResponse.REQUIRE_JUSTIFICATION],
        baseRisk: 0.9
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EQUIVALENT_TO - Semantic equivalence
  // ═══════════════════════════════════════════════════════════════════════════

  EQUIVALENT_TO: {
    Definition: {
      Definition: {
        meaning: 'These definitions are semantically equivalent',
        effects: [InteractionEffect.SEMANTIC_COUPLING],
        responses: [],
        baseRisk: 0.2
      },
      ExternalStandard: {
        meaning: 'This definition equals an external standard',
        effects: [InteractionEffect.SEMANTIC_COUPLING],
        responses: [],
        baseRisk: 0.1  // Strong interop
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFINES_MEANING_OF - Field binding
  // ═══════════════════════════════════════════════════════════════════════════

  DEFINES_MEANING_OF: {
    Definition: {
      Field: {
        meaning: 'This definition provides meaning for this field',
        effects: [InteractionEffect.SEMANTIC_COUPLING, InteractionEffect.INSTITUTIONALIZATION],
        responses: [OperatorResponse.INCREASE_USAGE_ROLLUP],
        baseRisk: 0.2
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATES_AGAINST - Rule dependencies
  // ═══════════════════════════════════════════════════════════════════════════

  VALIDATES_AGAINST: {
    Rule: {
      Definition: {
        meaning: 'This rule validates data against this definition',
        effects: [InteractionEffect.OPERATIONALIZATION],
        responses: [OperatorResponse.SURFACE_WHAT_BREAKS],
        baseRisk: 0.5
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DERIVES_FROM - Computation dependency
  // ═══════════════════════════════════════════════════════════════════════════

  DERIVES_FROM: {
    Definition: {
      Definition: {
        meaning: 'This definition is derived/computed from another',
        effects: [InteractionEffect.SEMANTIC_LINEAGE, InteractionEffect.SEMANTIC_COUPLING],
        responses: [OperatorResponse.TRACK_INHERITANCE],
        baseRisk: 0.4
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPOSED_BY - External mandate
  // ═══════════════════════════════════════════════════════════════════════════

  IMPOSED_BY: {
    Definition: {
      ExternalStandard: {
        meaning: 'This definition is mandated by external standard',
        effects: [InteractionEffect.EXTERNAL_CONSTRAINT],
        responses: [OperatorResponse.ENFORCE_IMMUTABILITY, OperatorResponse.REQUIRE_VERSIONING],
        baseRisk: 0.1  // External mandate = high certainty
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ASSERTED_BY - Attribution
  // ═══════════════════════════════════════════════════════════════════════════

  ASSERTED_BY: {
    Definition: {
      Actor: {
        meaning: 'This definition was asserted by this actor',
        effects: [InteractionEffect.PERSPECTIVAL_AUTHORITY],
        responses: [OperatorResponse.ISOLATE_BLAST_RADIUS],
        baseRisk: 0.3
      }
    }
  }
});

// ============================================================================
// INTERPRETER FUNCTIONS
// ============================================================================

/**
 * Get base interaction for an edge type + entity pair
 */
function getBaseInteraction(edgeType, sourceType, targetType) {
  const edgeMatrix = InteractionMatrix[edgeType];
  if (!edgeMatrix) return null;

  const sourceMatrix = edgeMatrix[sourceType];
  if (!sourceMatrix) return null;

  return sourceMatrix[targetType] || null;
}

/**
 * Interpret an edge with EO susceptibility applied
 *
 * @param {Object} edge - The edge to interpret
 * @param {string} targetEORole - The EO role of the target entity (holon/protogon/emanon)
 * @param {Object} susceptibilityTable - The RoleSusceptibility table from inference engine
 * @returns {Object} Full interpretation with adjusted risk
 */
function interpretEdge(edge, targetEORole = 'mixed', susceptibilityTable = null) {
  const { type, sourceType, targetType } = edge;

  // Get base interpretation
  const baseInteraction = getBaseInteraction(type, sourceType, targetType);
  if (!baseInteraction) {
    return {
      interpreted: false,
      meaning: `No interpretation for ${type}: ${sourceType} → ${targetType}`,
      effects: [],
      responses: [],
      baseRisk: 0.5,
      adjustedRisk: 0.5,
      explanation: 'Unknown edge configuration'
    };
  }

  // Get EO susceptibility
  let susceptibilityMultiplier = 1.0;
  let susceptibilityExplanation = 'Default susceptibility';

  if (susceptibilityTable && susceptibilityTable[type] && susceptibilityTable[type][targetEORole]) {
    const susceptibility = susceptibilityTable[type][targetEORole];
    susceptibilityMultiplier = susceptibility.riskMultiplier;
    susceptibilityExplanation = susceptibility.explanation;
  }

  // Calculate adjusted risk
  const adjustedRisk = Math.min(1.0, baseInteraction.baseRisk * susceptibilityMultiplier);

  return {
    interpreted: true,
    meaning: baseInteraction.meaning,
    effects: baseInteraction.effects,
    responses: baseInteraction.responses,
    baseRisk: baseInteraction.baseRisk,
    susceptibilityMultiplier,
    adjustedRisk,
    targetRole: targetEORole,
    susceptibilityExplanation,
    explanation: `${baseInteraction.meaning}. Target behaves like ${targetEORole}: ${susceptibilityExplanation}`
  };
}

/**
 * Interpret all edges for a node
 */
function interpretAllEdges(nodeId, nodeType, nodeEORole, edges, susceptibilityTable = null) {
  const results = [];
  let totalBaseRisk = 0;
  let totalAdjustedRisk = 0;
  const allEffects = new Set();
  const allResponses = new Set();

  for (const edge of edges) {
    // Determine if we're the source or target
    const isSource = edge.sourceId === nodeId;

    // For target interpretation, use our EO role
    const targetRole = isSource ? 'mixed' : nodeEORole; // When we're target, use our role

    const interpretation = interpretEdge(edge, targetRole, susceptibilityTable);

    if (interpretation.interpreted) {
      results.push({ edge, interpretation });
      totalBaseRisk += interpretation.baseRisk;
      totalAdjustedRisk += interpretation.adjustedRisk;
      interpretation.effects.forEach(e => allEffects.add(e));
      interpretation.responses.forEach(r => allResponses.add(r));
    }
  }

  return {
    nodeId,
    nodeType,
    nodeEORole,
    edgeInterpretations: results,
    summary: {
      totalEdges: edges.length,
      interpretedEdges: results.length,
      averageBaseRisk: results.length > 0 ? totalBaseRisk / results.length : 0,
      averageAdjustedRisk: results.length > 0 ? totalAdjustedRisk / results.length : 0,
      allEffects: Array.from(allEffects),
      allResponses: Array.from(allResponses)
    }
  };
}

/**
 * Get all responses that should be triggered for a node
 */
function getTriggeredResponses(nodeId, nodeType, nodeEORole, edges, susceptibilityTable = null) {
  const interpretation = interpretAllEdges(nodeId, nodeType, nodeEORole, edges, susceptibilityTable);
  return interpretation.summary.allResponses;
}

/**
 * Generate human-readable explanation of why risk is what it is
 */
function explainRisk(interpretationResult) {
  const { summary, edgeInterpretations } = interpretationResult;

  const lines = [];

  lines.push(`**Risk Assessment** (${interpretationResult.nodeEORole} behavior)`);
  lines.push(`Average Risk: ${(summary.averageAdjustedRisk * 100).toFixed(0)}%`);
  lines.push('');

  if (edgeInterpretations.length === 0) {
    lines.push('No edges to evaluate.');
    return lines.join('\n');
  }

  lines.push('**Key Risk Factors:**');
  const highRisk = edgeInterpretations
    .filter(e => e.interpretation.adjustedRisk > 0.5)
    .sort((a, b) => b.interpretation.adjustedRisk - a.interpretation.adjustedRisk);

  if (highRisk.length === 0) {
    lines.push('- No high-risk edges detected');
  } else {
    for (const { edge, interpretation } of highRisk.slice(0, 5)) {
      lines.push(`- ${edge.type}: ${interpretation.meaning}`);
      lines.push(`  Risk: ${(interpretation.adjustedRisk * 100).toFixed(0)}% (${interpretation.susceptibilityExplanation})`);
    }
  }

  if (summary.allResponses.length > 0) {
    lines.push('');
    lines.push('**Recommended Actions:**');
    for (const response of summary.allResponses) {
      lines.push(`- ${formatResponse(response)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format response for display
 */
function formatResponse(response) {
  const labels = {
    [OperatorResponse.ESCALATE_RISK]: 'Escalate risk assessment',
    [OperatorResponse.BLOCK_AUTOMATION]: 'Block automated operations',
    [OperatorResponse.SURFACE_WHAT_BREAKS]: 'Show impact analysis',
    [OperatorResponse.HARDEN_THRESHOLDS]: 'Apply stricter validation',
    [OperatorResponse.REQUIRE_VERSIONING]: 'Require version control',
    [OperatorResponse.REQUIRE_TEMPORAL_EDGE]: 'Require temporal validity',
    [OperatorResponse.REQUIRE_JUSTIFICATION]: 'Require explicit justification',
    [OperatorResponse.FLAG_FOR_REVIEW]: 'Flag for human review',
    [OperatorResponse.TRACK_INHERITANCE]: 'Track semantic inheritance',
    [OperatorResponse.CHECK_CIRCULAR]: 'Check for circular dependencies',
    [OperatorResponse.SUGGEST_DISAMBIGUATION]: 'Suggest disambiguation',
    [OperatorResponse.ENFORCE_IMMUTABILITY]: 'Enforce immutability',
    [OperatorResponse.ISOLATE_BLAST_RADIUS]: 'Isolate change impact',
    [OperatorResponse.INCREASE_USAGE_ROLLUP]: 'Update usage statistics',
    [OperatorResponse.FLAG_GOVERNANCE_IMPORTANCE]: 'Flag as governance-critical'
  };
  return labels[response] || response;
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    InteractionEffect,
    OperatorResponse,
    InteractionMatrix,
    getBaseInteraction,
    interpretEdge,
    interpretAllEdges,
    getTriggeredResponses,
    explainRisk,
    formatResponse
  };
}

if (typeof window !== 'undefined') {
  window.EOInteractionPhysics = {
    InteractionEffect,
    OperatorResponse,
    InteractionMatrix,
    getBaseInteraction,
    interpretEdge,
    interpretAllEdges,
    getTriggeredResponses,
    explainRisk,
    formatResponse
  };
}
