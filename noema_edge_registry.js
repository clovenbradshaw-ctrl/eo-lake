/**
 * EO Edge Registry - Typed Edge Definitions and Constraints
 *
 * THE CORE PRINCIPLE:
 * Edges express relationships.
 * Entity types determine the rules of interpretation.
 * EO operators determine the consequences.
 *
 * This module defines:
 * - Canonical node types
 * - All valid edge types with constraints
 * - The rules for which entity pairs can be connected by which edges
 */

// ============================================================================
// NODE TYPES
// ============================================================================

/**
 * Canonical node types in the EO system.
 * These are minimal and map to existing components.
 */
const NodeType = Object.freeze({
  DEFINITION: 'Definition',           // Meaning commitment
  FIELD: 'Field',                     // Dataset column/property
  DATASET: 'Dataset',                 // Table/collection (Set)
  PROCESS: 'Process',                 // Lifecycle/workflow
  RULE: 'Rule',                       // Validation/automation
  EXTERNAL_STANDARD: 'ExternalStandard', // URI vocabulary term
  ACTOR: 'Actor',                     // Person/role/system
  LENS: 'Lens',                       // View/transformation
  TIME_RANGE: 'TimeRange',            // Temporal boundary
  REPORT: 'Report',                   // Output/surface
  API: 'API'                          // Integration endpoint
});

/**
 * Node type metadata for UI and validation
 */
const NodeTypeMetadata = Object.freeze({
  [NodeType.DEFINITION]: {
    name: 'Definition',
    description: 'A meaning commitment that defines what something means',
    icon: '📖',
    color: '#7856ff'
  },
  [NodeType.FIELD]: {
    name: 'Field',
    description: 'A dataset column or property',
    icon: '📊',
    color: '#1d9bf0'
  },
  [NodeType.DATASET]: {
    name: 'Dataset',
    description: 'A table or collection of records',
    icon: '📁',
    color: '#00ba7c'
  },
  [NodeType.PROCESS]: {
    name: 'Process',
    description: 'A lifecycle or workflow',
    icon: '⚙️',
    color: '#ffad1f'
  },
  [NodeType.RULE]: {
    name: 'Rule',
    description: 'A validation or automation rule',
    icon: '📏',
    color: '#f91880'
  },
  [NodeType.EXTERNAL_STANDARD]: {
    name: 'External Standard',
    description: 'A URI-identified vocabulary term',
    icon: '🔗',
    color: '#794bc4'
  },
  [NodeType.ACTOR]: {
    name: 'Actor',
    description: 'A person, role, or system',
    icon: '👤',
    color: '#00ba7c'
  },
  [NodeType.LENS]: {
    name: 'Lens',
    description: 'A view or transformation pipeline',
    icon: '🔍',
    color: '#1d9bf0'
  },
  [NodeType.TIME_RANGE]: {
    name: 'Time Range',
    description: 'A temporal boundary',
    icon: '📅',
    color: '#ffad1f'
  },
  [NodeType.REPORT]: {
    name: 'Report',
    description: 'An output or presentation surface',
    icon: '📄',
    color: '#00ba7c'
  },
  [NodeType.API]: {
    name: 'API',
    description: 'An integration endpoint',
    icon: '🔌',
    color: '#1d9bf0'
  }
});

// ============================================================================
// EDGE CATEGORIES
// ============================================================================

/**
 * Edge categories for grouping and styling
 */
const EdgeCategory = Object.freeze({
  SEMANTIC: 'semantic',       // Meaning lineage
  DEPENDENCY: 'dependency',   // Usage/impact
  AUTHORITY: 'authority',     // Epistemic
  TEMPORAL: 'temporal'        // Change
});

const EdgeCategoryMetadata = Object.freeze({
  [EdgeCategory.SEMANTIC]: {
    name: 'Semantic',
    description: 'Edges representing meaning relationships',
    color: '#7856ff'
  },
  [EdgeCategory.DEPENDENCY]: {
    name: 'Dependency',
    description: 'Edges representing usage and impact',
    color: '#1d9bf0'
  },
  [EdgeCategory.AUTHORITY]: {
    name: 'Authority',
    description: 'Edges representing epistemic relationships',
    color: '#ffad1f'
  },
  [EdgeCategory.TEMPORAL]: {
    name: 'Temporal',
    description: 'Edges representing change over time',
    color: '#00ba7c'
  }
});

// ============================================================================
// EDGE TYPES
// ============================================================================

/**
 * All valid edge types in the system
 */
const EdgeType = Object.freeze({
  // Semantic edges
  DEFINES_MEANING_OF: 'DEFINES_MEANING_OF',
  INHERITS_MEANING_FROM: 'INHERITS_MEANING_FROM',
  REFINES_MEANING_OF: 'REFINES_MEANING_OF',
  EQUIVALENT_TO: 'EQUIVALENT_TO',
  CONFLICTS_WITH: 'CONFLICTS_WITH',

  // Dependency edges
  DEPENDS_ON: 'DEPENDS_ON',
  DERIVES_FROM: 'DERIVES_FROM',
  VALIDATES_AGAINST: 'VALIDATES_AGAINST',
  USES_FIELD: 'USES_FIELD',
  REFERENCES: 'REFERENCES',

  // Authority edges
  GOVERNED_BY: 'GOVERNED_BY',
  ASSERTED_BY: 'ASSERTED_BY',
  IMPOSED_BY: 'IMPOSED_BY',
  OWNED_BY: 'OWNED_BY',

  // Temporal edges
  SUPERSEDES: 'SUPERSEDES',
  VALID_DURING: 'VALID_DURING',
  VERSION_OF: 'VERSION_OF'
});

/**
 * Edge type definitions with allowed entity pairs
 */
const EdgeTypeDefinitions = Object.freeze({
  // ─────────────────────────────────────────────────────────────────────────
  // SEMANTIC EDGES
  // ─────────────────────────────────────────────────────────────────────────

  [EdgeType.DEFINES_MEANING_OF]: {
    name: 'Defines Meaning Of',
    description: 'This definition provides the semantic meaning for a field',
    category: EdgeCategory.SEMANTIC,
    symbol: '→',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.FIELD]
    ],
    bidirectional: false,
    requiredProperties: [],
    optionalProperties: ['confidence', 'effectiveDate', 'notes']
  },

  [EdgeType.INHERITS_MEANING_FROM]: {
    name: 'Inherits Meaning From',
    description: 'This definition inherits meaning from a parent definition',
    category: EdgeCategory.SEMANTIC,
    symbol: '⊲',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.DEFINITION]
    ],
    bidirectional: false,
    requiredProperties: [],
    optionalProperties: ['refinements', 'restrictions']
  },

  [EdgeType.REFINES_MEANING_OF]: {
    name: 'Refines Meaning Of',
    description: 'This definition refines/specializes another meaning',
    category: EdgeCategory.SEMANTIC,
    symbol: '⊳',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.DEFINITION],
      [NodeType.DEFINITION, NodeType.EXTERNAL_STANDARD]
    ],
    bidirectional: false,
    requiredProperties: [],
    optionalProperties: ['refinements', 'localConstraints']
  },

  [EdgeType.EQUIVALENT_TO]: {
    name: 'Equivalent To',
    description: 'These entities are semantically equivalent',
    category: EdgeCategory.SEMANTIC,
    symbol: '≡',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.DEFINITION],
      [NodeType.DEFINITION, NodeType.EXTERNAL_STANDARD]
    ],
    bidirectional: true,
    requiredProperties: ['confidence'],
    optionalProperties: ['mappingNotes', 'conditions']
  },

  [EdgeType.CONFLICTS_WITH]: {
    name: 'Conflicts With',
    description: 'These entities have conflicting meanings',
    category: EdgeCategory.SEMANTIC,
    symbol: '⊗',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.DEFINITION],
      [NodeType.DEFINITION, NodeType.EXTERNAL_STANDARD]
    ],
    bidirectional: true,
    requiredProperties: ['conflictType'],
    optionalProperties: ['resolution', 'precedence']
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DEPENDENCY EDGES
  // ─────────────────────────────────────────────────────────────────────────

  [EdgeType.DEPENDS_ON]: {
    name: 'Depends On',
    description: 'This entity depends on the target',
    category: EdgeCategory.DEPENDENCY,
    symbol: '⟶',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.DEFINITION],
      [NodeType.RULE, NodeType.DEFINITION],
      [NodeType.REPORT, NodeType.DEFINITION],
      [NodeType.API, NodeType.DEFINITION],
      [NodeType.LENS, NodeType.DEFINITION],
      [NodeType.PROCESS, NodeType.DEFINITION],
      [NodeType.DATASET, NodeType.DEFINITION]
    ],
    bidirectional: false,
    requiredProperties: [],
    optionalProperties: ['dependencyType', 'required']
  },

  [EdgeType.DERIVES_FROM]: {
    name: 'Derives From',
    description: 'This definition is derived/computed from another',
    category: EdgeCategory.DEPENDENCY,
    symbol: '⤷',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.DEFINITION]
    ],
    bidirectional: false,
    requiredProperties: [],
    optionalProperties: ['derivationFormula']
  },

  [EdgeType.VALIDATES_AGAINST]: {
    name: 'Validates Against',
    description: 'This rule validates data against a definition',
    category: EdgeCategory.DEPENDENCY,
    symbol: '✓',
    allowedPairs: [
      [NodeType.RULE, NodeType.DEFINITION]
    ],
    bidirectional: false,
    requiredProperties: [],
    optionalProperties: ['validationType', 'severity']
  },

  [EdgeType.USES_FIELD]: {
    name: 'Uses Field',
    description: 'This entity uses the target field',
    category: EdgeCategory.DEPENDENCY,
    symbol: '⟿',
    allowedPairs: [
      [NodeType.LENS, NodeType.FIELD],
      [NodeType.RULE, NodeType.FIELD],
      [NodeType.REPORT, NodeType.FIELD],
      [NodeType.API, NodeType.FIELD]
    ],
    bidirectional: false,
    requiredProperties: [],
    optionalProperties: ['usageType']
  },

  [EdgeType.REFERENCES]: {
    name: 'References',
    description: 'A general reference relationship',
    category: EdgeCategory.DEPENDENCY,
    symbol: '↗',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.DEFINITION],
      [NodeType.DEFINITION, NodeType.EXTERNAL_STANDARD],
      [NodeType.RULE, NodeType.RULE]
    ],
    bidirectional: false,
    requiredProperties: [],
    optionalProperties: ['referenceType']
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AUTHORITY EDGES
  // ─────────────────────────────────────────────────────────────────────────

  [EdgeType.GOVERNED_BY]: {
    name: 'Governed By',
    description: 'This entity is governed by the target',
    category: EdgeCategory.AUTHORITY,
    symbol: '⊢',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.PROCESS],
      [NodeType.DEFINITION, NodeType.ACTOR],
      [NodeType.DEFINITION, NodeType.EXTERNAL_STANDARD]
    ],
    bidirectional: false,
    requiredProperties: [],
    optionalProperties: ['governanceType', 'approvalRequired']
  },

  [EdgeType.ASSERTED_BY]: {
    name: 'Asserted By',
    description: 'This definition was asserted by an actor',
    category: EdgeCategory.AUTHORITY,
    symbol: '⊨',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.ACTOR]
    ],
    bidirectional: false,
    requiredProperties: [],
    optionalProperties: ['assertionDate', 'justification']
  },

  [EdgeType.IMPOSED_BY]: {
    name: 'Imposed By',
    description: 'This definition is imposed by an external standard',
    category: EdgeCategory.AUTHORITY,
    symbol: '⊫',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.EXTERNAL_STANDARD]
    ],
    bidirectional: false,
    requiredProperties: [],
    optionalProperties: ['mandateType', 'complianceLevel']
  },

  [EdgeType.OWNED_BY]: {
    name: 'Owned By',
    description: 'This entity is owned/stewarded by an actor',
    category: EdgeCategory.AUTHORITY,
    symbol: '⊳',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.ACTOR],
      [NodeType.DATASET, NodeType.ACTOR],
      [NodeType.PROCESS, NodeType.ACTOR]
    ],
    bidirectional: false,
    requiredProperties: [],
    optionalProperties: ['ownershipType']
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPORAL EDGES
  // ─────────────────────────────────────────────────────────────────────────

  [EdgeType.SUPERSEDES]: {
    name: 'Supersedes',
    description: 'This definition supersedes/replaces another',
    category: EdgeCategory.TEMPORAL,
    symbol: '⤳',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.DEFINITION],
      [NodeType.PROCESS, NodeType.PROCESS]
    ],
    bidirectional: false,
    requiredProperties: ['effectiveDate'],
    optionalProperties: ['reason', 'migrationNotes']
  },

  [EdgeType.VALID_DURING]: {
    name: 'Valid During',
    description: 'This definition is valid during a time range',
    category: EdgeCategory.TEMPORAL,
    symbol: '⌛',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.TIME_RANGE]
    ],
    bidirectional: false,
    requiredProperties: ['startDate'],
    optionalProperties: ['endDate']
  },

  [EdgeType.VERSION_OF]: {
    name: 'Version Of',
    description: 'This is a version of another definition',
    category: EdgeCategory.TEMPORAL,
    symbol: '⟳',
    allowedPairs: [
      [NodeType.DEFINITION, NodeType.DEFINITION]
    ],
    bidirectional: false,
    requiredProperties: ['versionNumber'],
    optionalProperties: ['changelog', 'breaking']
  }
});

// ============================================================================
// EDGE REGISTRY CLASS
// ============================================================================

/**
 * Edge Registry - Manages edge types and validates edge creation
 */
class EOEdgeRegistry {
  constructor() {
    this.edges = new Map();
    this._bySource = new Map();
    this._byTarget = new Map();
    this._byType = new Map();
  }

  /**
   * Check if an edge type is valid for the given entity pair
   */
  isValidPair(edgeType, sourceType, targetType) {
    const def = EdgeTypeDefinitions[edgeType];
    if (!def) return false;
    return def.allowedPairs.some(
      ([from, to]) => from === sourceType && to === targetType
    );
  }

  /**
   * Get all valid edge types for a source/target pair
   */
  getValidEdgeTypes(sourceType, targetType) {
    return Object.entries(EdgeTypeDefinitions)
      .filter(([_, def]) =>
        def.allowedPairs.some(
          ([from, to]) => from === sourceType && to === targetType
        )
      )
      .map(([type, _]) => type);
  }

  /**
   * Validate an edge before creation
   */
  validateEdge(edge) {
    const { type, sourceType, targetType, properties = {} } = edge;
    const errors = [];

    const def = EdgeTypeDefinitions[type];
    if (!def) {
      errors.push(`Unknown edge type: ${type}`);
      return { valid: false, errors };
    }

    if (!this.isValidPair(type, sourceType, targetType)) {
      errors.push(
        `${type} does not allow ${sourceType} → ${targetType}. ` +
        `Allowed: ${def.allowedPairs.map(([f, t]) => `${f}→${t}`).join(', ')}`
      );
    }

    for (const prop of def.requiredProperties) {
      if (properties[prop] === undefined) {
        errors.push(`Missing required property: ${prop}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Create an edge
   */
  createEdge(edgeData) {
    const validation = this.validateEdge(edgeData);
    if (!validation.valid) {
      throw new Error(`Invalid edge: ${validation.errors.join('; ')}`);
    }

    const { sourceId, sourceType, targetId, targetType, type, properties = {} } = edgeData;
    const edgeId = `edge_${type}_${sourceId}_${targetId}_${Date.now().toString(36)}`;

    const edge = {
      id: edgeId,
      type,
      sourceId,
      sourceType,
      targetId,
      targetType,
      properties: { ...properties },
      createdAt: new Date().toISOString()
    };

    this.edges.set(edgeId, edge);
    this._addToIndex(this._bySource, sourceId, edge);
    this._addToIndex(this._byTarget, targetId, edge);
    this._addToIndex(this._byType, type, edge);

    return edge;
  }

  /**
   * Get all edges for a node
   */
  getEdgesForNode(nodeId) {
    const from = this._bySource.get(nodeId) || [];
    const to = this._byTarget.get(nodeId) || [];
    return [...from, ...to];
  }

  /**
   * Get edges by type
   */
  getEdgesByType(type) {
    return this._byType.get(type) || [];
  }

  /**
   * Delete an edge
   */
  deleteEdge(edgeId) {
    const edge = this.edges.get(edgeId);
    if (!edge) return false;

    this._removeFromIndex(this._bySource, edge.sourceId, edge);
    this._removeFromIndex(this._byTarget, edge.targetId, edge);
    this._removeFromIndex(this._byType, edge.type, edge);
    this.edges.delete(edgeId);

    return true;
  }

  /**
   * Export all edges
   */
  export() {
    return Array.from(this.edges.values());
  }

  /**
   * Clear all edges
   */
  clear() {
    this.edges.clear();
    this._bySource.clear();
    this._byTarget.clear();
    this._byType.clear();
  }

  _addToIndex(index, key, value) {
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(value);
  }

  _removeFromIndex(index, key, value) {
    const arr = index.get(key);
    if (arr) {
      const idx = arr.indexOf(value);
      if (idx > -1) arr.splice(idx, 1);
      if (arr.length === 0) index.delete(key);
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let _registry = null;

function getEdgeRegistry() {
  if (!_registry) _registry = new EOEdgeRegistry();
  return _registry;
}

function initEdgeRegistry() {
  _registry = new EOEdgeRegistry();
  return _registry;
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NodeType,
    NodeTypeMetadata,
    EdgeCategory,
    EdgeCategoryMetadata,
    EdgeType,
    EdgeTypeDefinitions,
    EOEdgeRegistry,
    getEdgeRegistry,
    initEdgeRegistry
  };
}

if (typeof window !== 'undefined') {
  window.NodeType = NodeType;
  window.NodeTypeMetadata = NodeTypeMetadata;
  window.EdgeCategory = EdgeCategory;
  window.EdgeCategoryMetadata = EdgeCategoryMetadata;
  window.EdgeType = EdgeType;
  window.EdgeTypeDefinitions = EdgeTypeDefinitions;
  window.EOEdgeRegistry = EOEdgeRegistry;
  window.getEdgeRegistry = getEdgeRegistry;
  window.initEdgeRegistry = initEdgeRegistry;
}
