/**
 * EO Ontology - Operator Efficiency Architecture
 *
 * Implements the 10 ontological fixes for EO Lake:
 *
 * NON-NEGOTIABLE FIXES:
 *   1. Hard separation of Sources (GIVEN) vs Sets (MEANT)
 *   2. Sets must be born from constraint, not emptiness
 *   3. Status must be recursive or not exist
 *   4. Graph view must treat links as first-class operators
 *
 * STRUCTURAL IMPROVEMENTS:
 *   5. Make Frame explicit everywhere
 *   6. Views should never create or modify data
 *   7. Make derivation visible (provenance light)
 *
 * EFFICIENCY UPGRADES:
 *   8. Operator-first creation, not object-first
 *   9. Declare stability levels (Holon/Protogon/Emanon)
 *   10. Fail loudly when ontology is violated
 */

// ============================================================================
// Fix #1: Source/Set Separation - Sources are GIVEN, Sets are MEANT
// ============================================================================

/**
 * OntologicalType - The fundamental distinction (Rule 1)
 */
const OntologicalType = Object.freeze({
  GIVEN: 'given',   // External, immutable, observed
  MEANT: 'meant'    // Internal, interpretive, derived
});

/**
 * SourceConfig - Represents GIVEN data (Fix #1)
 *
 * Sources are IMMUTABLE by design:
 * - Cannot be created inside EO Lake (only imported)
 * - Cannot be modified after import
 * - Represent external observations
 */
class SourceConfig {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique identifier
   * @param {string} options.name - Original filename or source name
   * @param {string} options.fileHash - SHA-256 hash of original content
   * @param {string} options.importedAt - ISO timestamp of import
   * @param {string} options.importedBy - Actor who performed import
   * @param {Object} options.provenance - 9-element provenance record
   * @param {number} options.recordCount - Number of records imported
   * @param {Object} options.schemaSignature - Hash of inferred schema
   */
  constructor(options) {
    // RULE 1: Type is always GIVEN
    this.type = OntologicalType.GIVEN;
    this.entityType = 'source';

    // Identity
    this.id = options.id || generateOntologyId('src');
    this.name = options.name || 'Unknown Source';

    // Immutability proof
    this.fileHash = options.fileHash || null;
    this.schemaSignature = options.schemaSignature || null;

    // Import metadata
    this.importedAt = options.importedAt || new Date().toISOString();
    this.importedBy = options.importedBy || 'unknown';
    this.originalFilename = options.originalFilename || null;
    this.mimeType = options.mimeType || null;
    this.byteSize = options.byteSize || null;

    // Record tracking (not the records themselves)
    this.recordCount = options.recordCount || 0;
    this.recordIdRange = options.recordIdRange || { first: null, last: null };

    // 9-Element Provenance (required)
    this.provenance = {
      // Epistemic triad
      agent: options.provenance?.agent || 'unknown',
      method: options.provenance?.method || 'import',
      source: options.provenance?.source || options.originalFilename || 'unknown',

      // Semantic triad
      term: options.provenance?.term || null,
      definition: options.provenance?.definition || null,
      jurisdiction: options.provenance?.jurisdiction || null,

      // Situational triad
      scale: options.provenance?.scale || 'individual',
      timeframe: options.provenance?.timeframe || { observedAt: this.importedAt },
      background: options.provenance?.background || null
    };

    // Immutability lock
    Object.freeze(this.provenance);
    Object.freeze(this.recordIdRange);
  }

  /**
   * Sources are always read-only
   */
  get isReadOnly() {
    return true;
  }

  /**
   * Validate source configuration
   */
  validate() {
    const errors = [];

    if (this.type !== OntologicalType.GIVEN) {
      errors.push(new OntologyError('TYPE_MISMATCH',
        'Source must be of type GIVEN'));
    }

    if (!this.fileHash && !this.provenance.source) {
      errors.push(new OntologyError('MISSING_PROVENANCE',
        'Source must have either fileHash or provenance.source'));
    }

    return { valid: errors.length === 0, errors };
  }

  toJSON() {
    return {
      type: this.type,
      entityType: this.entityType,
      id: this.id,
      name: this.name,
      fileHash: this.fileHash,
      schemaSignature: this.schemaSignature,
      importedAt: this.importedAt,
      importedBy: this.importedBy,
      originalFilename: this.originalFilename,
      mimeType: this.mimeType,
      byteSize: this.byteSize,
      recordCount: this.recordCount,
      recordIdRange: { ...this.recordIdRange },
      provenance: { ...this.provenance }
    };
  }
}

// ============================================================================
// Fix #2: Sets Born From Constraint - Derivation Strategy
// ============================================================================

/**
 * DerivationStrategy - How a Set is derived (Fix #2)
 *
 * No empty Sets. A Set must be born from one of:
 * - SEG: Filter from Source or parent Set
 * - CON: Join/relate existing Sets
 * - ALT: Transform via temporal rule
 */
const DerivationStrategy = Object.freeze({
  SEG: 'seg',   // Filter/segment from parent
  CON: 'con',   // Join/connect multiple sources
  ALT: 'alt',   // Transform via rule
  DIRECT: 'direct' // Direct import (only for initial Source→Set)
});

/**
 * DerivationConfig - Specifies how a Set derives its data
 */
class DerivationConfig {
  /**
   * @param {Object} options
   * @param {string} options.strategy - One of DerivationStrategy
   * @param {string} options.parentSourceId - Source this derives from (if DIRECT)
   * @param {string} options.parentSetId - Set this derives from (if SEG/ALT)
   * @param {string[]} options.joinSetIds - Sets to join (if CON)
   * @param {Object} options.constraint - The derivation constraint
   */
  constructor(options) {
    this.strategy = options.strategy || DerivationStrategy.DIRECT;

    // Parent tracking
    this.parentSourceId = options.parentSourceId || null;
    this.parentSetId = options.parentSetId || null;
    this.joinSetIds = options.joinSetIds || [];

    // The constraint that defines membership
    this.constraint = {
      filters: options.constraint?.filters || [],
      transform: options.constraint?.transform || null,
      joinCondition: options.constraint?.joinCondition || null
    };

    // Materialization
    this.materializes = options.materializes !== false; // Default: yes
    this.refreshPolicy = options.refreshPolicy || { automatic: true };

    // Audit
    this.derivedAt = options.derivedAt || new Date().toISOString();
    this.derivedBy = options.derivedBy || null;
  }

  /**
   * Validate derivation is well-formed
   */
  validate() {
    const errors = [];

    // Must have a parent unless DIRECT
    if (this.strategy === DerivationStrategy.DIRECT) {
      if (!this.parentSourceId) {
        errors.push(new OntologyError('MISSING_PARENT',
          'DIRECT derivation requires parentSourceId'));
      }
    } else if (this.strategy === DerivationStrategy.SEG) {
      if (!this.parentSetId && !this.parentSourceId) {
        errors.push(new OntologyError('MISSING_PARENT',
          'SEG derivation requires parentSetId or parentSourceId'));
      }
      if (!this.constraint.filters || this.constraint.filters.length === 0) {
        errors.push(new OntologyError('EMPTY_CONSTRAINT',
          'SEG derivation requires at least one filter'));
      }
    } else if (this.strategy === DerivationStrategy.CON) {
      if (!this.joinSetIds || this.joinSetIds.length < 2) {
        errors.push(new OntologyError('INVALID_JOIN',
          'CON derivation requires at least 2 sets to join'));
      }
    } else if (this.strategy === DerivationStrategy.ALT) {
      if (!this.constraint.transform) {
        errors.push(new OntologyError('MISSING_TRANSFORM',
          'ALT derivation requires a transform rule'));
      }
    }

    return { valid: errors.length === 0, errors };
  }

  toJSON() {
    return {
      strategy: this.strategy,
      parentSourceId: this.parentSourceId,
      parentSetId: this.parentSetId,
      joinSetIds: [...this.joinSetIds],
      constraint: {
        filters: [...this.constraint.filters],
        transform: this.constraint.transform,
        joinCondition: this.constraint.joinCondition
      },
      materializes: this.materializes,
      refreshPolicy: { ...this.refreshPolicy },
      derivedAt: this.derivedAt,
      derivedBy: this.derivedBy
    };
  }
}

// ============================================================================
// Fix #3: Recursive Status - Workflow System
// ============================================================================

/**
 * WorkflowTransition - Valid state transition
 */
class WorkflowTransition {
  constructor(options) {
    this.from = options.from;
    this.to = options.to;
    this.requiredRole = options.requiredRole || null;
    this.condition = options.condition || null;
    this.sla = options.sla || null; // { hours: number }
  }
}

/**
 * WorkflowConfig - Defines status recursion behavior (Fix #3)
 */
class WorkflowConfig {
  /**
   * @param {Object} options
   * @param {string} options.initialStatus - Default status for new records
   * @param {WorkflowTransition[]} options.transitions - Valid state changes
   * @param {boolean} options.hierarchicalCascade - Propagate to children
   * @param {Object} options.epistemicMapping - Map statuses to epistemic levels
   */
  constructor(options) {
    this.enabled = options.enabled !== false;
    this.initialStatus = options.initialStatus || null;

    // Valid transitions (empty = all transitions allowed)
    this.transitions = (options.transitions || []).map(t =>
      t instanceof WorkflowTransition ? t : new WorkflowTransition(t)
    );

    // Cascade behavior
    this.hierarchicalCascade = options.hierarchicalCascade || false;
    this.cascadeFields = options.cascadeFields || [];

    // Map status values to epistemic levels
    this.epistemicMapping = {
      preliminary: options.epistemicMapping?.preliminary || [],
      reviewed: options.epistemicMapping?.reviewed || [],
      contested: options.epistemicMapping?.contested || [],
      superseded: options.epistemicMapping?.superseded || []
    };
  }

  /**
   * Check if a transition is valid
   */
  isValidTransition(fromStatus, toStatus, actorRole = null) {
    // If no transitions defined, all are valid
    if (this.transitions.length === 0) return true;

    const transition = this.transitions.find(t =>
      t.from === fromStatus && t.to === toStatus
    );

    if (!transition) return false;

    // Check role if required
    if (transition.requiredRole && actorRole !== transition.requiredRole) {
      return false;
    }

    return true;
  }

  /**
   * Get valid next statuses from current status
   */
  getValidNextStatuses(currentStatus, actorRole = null) {
    if (this.transitions.length === 0) return null; // All valid

    return this.transitions
      .filter(t => t.from === currentStatus)
      .filter(t => !t.requiredRole || t.requiredRole === actorRole)
      .map(t => t.to);
  }

  /**
   * Get epistemic status for a value
   */
  getEpistemicStatus(statusValue) {
    for (const [level, values] of Object.entries(this.epistemicMapping)) {
      if (values.includes(statusValue)) return level;
    }
    return 'preliminary'; // Default
  }

  toJSON() {
    return {
      enabled: this.enabled,
      initialStatus: this.initialStatus,
      transitions: this.transitions.map(t => ({
        from: t.from,
        to: t.to,
        requiredRole: t.requiredRole,
        condition: t.condition,
        sla: t.sla
      })),
      hierarchicalCascade: this.hierarchicalCascade,
      cascadeFields: [...this.cascadeFields],
      epistemicMapping: { ...this.epistemicMapping }
    };
  }
}

// ============================================================================
// Fix #4: Graph Links as First-Class Operators
// ============================================================================

/**
 * RelationshipOperator - Maps edge semantics to EO operators (Fix #4)
 */
const RelationshipOperator = Object.freeze({
  CON: 'con',     // Connection (standard link)
  SYN: 'syn',     // Synthesis (merge parent)
  REF: 'ref',     // Reference (lookup)
  SEG: 'seg',     // Separation (anti-link)
  PARENT: 'parent', // Hierarchical parent
  CHILD: 'child'    // Hierarchical child
});

// ============================================================================
// Edge System - Edges are Given, Projections are Meant
// ============================================================================

/**
 * EdgeRecord - First-class edge stored in set.spaces.edges
 *
 * Core principle: Edges are Given structure. Link columns are Meant projections.
 *
 * Edges are relational facts that exist in an attached record space,
 * subordinate to but distinct from the primary record space.
 */
class EdgeRecord {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique edge ID
   * @param {string} options.ownerSetId - Set whose edge space contains this
   * @param {string} options.from - Record ID (any set, globally resolved)
   * @param {string} options.to - Record ID (any set, globally resolved)
   * @param {string} options.type - Edge type: "reports_to", "works_at", etc.
   * @param {boolean} options.directed - true = from→to, false = bidirectional
   * @param {Object} options.properties - Edge-specific metadata
   * @param {Object} options.grounding - Origin and derivation info
   */
  constructor(options) {
    // Identity
    this.id = options.id || generateOntologyId('edge');

    // Ownership (organizational - where this edge is stored)
    this.ownerSetId = options.ownerSetId;

    // Endpoints (semantic - what this edge connects)
    this.from = options.from;
    this.to = options.to;

    // Typing
    this.type = options.type || 'related_to';
    this.directed = options.directed !== false; // Default true

    // Properties (edge-specific metadata)
    this.properties = options.properties || {};

    // Grounding
    this.grounding = {
      origin: {
        eventId: options.grounding?.origin?.eventId || null,
        sourceId: options.grounding?.origin?.sourceId || null,
        locator: options.grounding?.origin?.locator || null
      },
      derivation: options.grounding?.derivation || null
    };
  }

  /**
   * Get the "other" endpoint given one endpoint
   */
  getLinkedRecordId(fromRecordId) {
    return this.from === fromRecordId ? this.to : this.from;
  }

  /**
   * Check if this edge connects to a specific record
   */
  connectsTo(recordId) {
    return this.from === recordId || this.to === recordId;
  }

  /**
   * Check if this is a self-loop
   */
  isSelfLoop() {
    return this.from === this.to;
  }

  toJSON() {
    return {
      id: this.id,
      ownerSetId: this.ownerSetId,
      from: this.from,
      to: this.to,
      type: this.type,
      directed: this.directed,
      properties: { ...this.properties },
      grounding: {
        origin: { ...this.grounding.origin },
        derivation: this.grounding.derivation ? { ...this.grounding.derivation } : null
      }
    };
  }

  /**
   * Create EdgeRecord from plain object
   */
  static fromJSON(json) {
    return new EdgeRecord(json);
  }
}

/**
 * EdgeTypeDefinition - Defines semantics and display for an edge type
 */
class EdgeTypeDefinition {
  /**
   * @param {Object} options
   * @param {string} options.type - Internal key: "reports_to"
   * @param {string} options.name - Display name: "Reports To"
   * @param {boolean} options.directed - Default directionality
   * @param {boolean} options.symmetric - If true, A↔B (one edge, shows both sides)
   * @param {string} options.inverseName - For directed: "Direct Reports"
   * @param {Object} options.propertySchema - Expected properties
   * @param {Object} options.style - Styling for graph view
   */
  constructor(options) {
    // Identity
    this.type = options.type;
    this.name = options.name || this._formatTypeName(options.type);

    // Semantics
    this.directed = options.directed !== false; // Default true
    this.symmetric = options.symmetric || false;
    this.inverseName = options.inverseName || null;

    // Schema (optional - for validation)
    this.propertySchema = options.propertySchema || null;

    // Styling (for graph view)
    this.style = {
      color: options.style?.color || '#94a3b8',
      width: options.style?.width || 2,
      dashed: options.style?.dashed || false
    };
  }

  _formatTypeName(type) {
    if (!type) return 'Related To';
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Get inverse name for incoming edges
   */
  getInverseName() {
    if (this.symmetric) return this.name;
    return this.inverseName || `${this.name} (incoming)`;
  }

  toJSON() {
    return {
      type: this.type,
      name: this.name,
      directed: this.directed,
      symmetric: this.symmetric,
      inverseName: this.inverseName,
      propertySchema: this.propertySchema,
      style: { ...this.style }
    };
  }

  static fromJSON(json) {
    return new EdgeTypeDefinition(json);
  }
}

/**
 * EdgeProjection - Configuration for displaying edges as a table column
 *
 * Projections are Meant - they're view-time interpretations of how to display edges.
 */
class EdgeProjection {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique projection ID
   * @param {string} options.edgeType - Edge type to project
   * @param {string} options.direction - 'outgoing' | 'incoming' | 'both'
   * @param {string} options.columnName - Display name for column
   * @param {number} options.position - Column order
   * @param {Object} options.display - Display configuration
   * @param {boolean} options.enabled - Whether projection is active
   */
  constructor(options) {
    this.id = options.id || generateOntologyId('proj');
    this.edgeType = options.edgeType;
    this.direction = options.direction || 'outgoing';
    this.columnName = options.columnName;
    this.position = options.position ?? 0;

    this.display = {
      showAs: options.display?.showAs || 'link_chips', // 'link_chips' | 'count' | 'list'
      maxVisible: options.display?.maxVisible ?? 3,
      showProperties: options.display?.showProperties || [],
      showSetBadge: options.display?.showSetBadge || false
    };

    this.enabled = options.enabled !== false;
  }

  toJSON() {
    return {
      id: this.id,
      edgeType: this.edgeType,
      direction: this.direction,
      columnName: this.columnName,
      position: this.position,
      display: { ...this.display },
      enabled: this.enabled
    };
  }

  static fromJSON(json) {
    return new EdgeProjection(json);
  }
}

/**
 * GlobalRecordRegistry - Central registry for record lookup across all sets
 *
 * Record IDs are globally unique. Edges reference records by ID only.
 * Resolution is a lookup, not stored redundancy.
 */
class GlobalRecordRegistry {
  constructor() {
    // Map: recordId -> { record, setId }
    this.index = new Map();
  }

  /**
   * Register a record
   */
  register(recordId, record, setId) {
    this.index.set(recordId, { record, setId });
  }

  /**
   * Unregister a record (soft delete - keep for orphan detection)
   */
  unregister(recordId) {
    const entry = this.index.get(recordId);
    if (entry) {
      entry.deleted = true;
      entry.deletedAt = new Date().toISOString();
    }
  }

  /**
   * Get a record by ID
   */
  get(recordId) {
    const entry = this.index.get(recordId);
    if (!entry || entry.deleted) return null;
    return entry.record;
  }

  /**
   * Check if a record exists
   */
  has(recordId) {
    const entry = this.index.get(recordId);
    return entry && !entry.deleted;
  }

  /**
   * Get the set ID for a record
   */
  getSetId(recordId) {
    const entry = this.index.get(recordId);
    if (!entry || entry.deleted) return null;
    return entry.setId;
  }

  /**
   * Get multiple records at once
   */
  getMany(recordIds) {
    const result = new Map();
    for (const id of recordIds) {
      result.set(id, this.get(id));
    }
    return result;
  }

  /**
   * Check if a record was deleted (for orphan detection)
   */
  wasDeleted(recordId) {
    const entry = this.index.get(recordId);
    return entry?.deleted === true;
  }

  /**
   * Get deletion info for orphan display
   */
  getDeletionInfo(recordId) {
    const entry = this.index.get(recordId);
    if (!entry?.deleted) return null;
    return {
      deletedAt: entry.deletedAt,
      originalRecord: entry.record
    };
  }

  /**
   * Rebuild registry from sets
   */
  rebuildFromSets(sets) {
    this.index.clear();
    for (const set of sets) {
      if (set.records) {
        for (const record of set.records) {
          this.register(record.id, record, set.id);
        }
      }
    }
  }

  /**
   * Get all record IDs in a set
   */
  getRecordIdsForSet(setId) {
    const ids = [];
    for (const [recordId, entry] of this.index) {
      if (entry.setId === setId && !entry.deleted) {
        ids.push(recordId);
      }
    }
    return ids;
  }

  /**
   * Clear the registry
   */
  clear() {
    this.index.clear();
  }
}

/**
 * ResolvedEdge - Edge with resolved endpoint information
 */
class ResolvedEdge {
  constructor(edge, registry) {
    this.edge = edge;

    const fromRecord = registry.get(edge.from);
    const toRecord = registry.get(edge.to);

    this.from = {
      record: fromRecord,
      setId: fromRecord ? registry.getSetId(edge.from) : null,
      orphaned: fromRecord === null,
      wasDeleted: registry.wasDeleted(edge.from),
      deletionInfo: registry.getDeletionInfo(edge.from)
    };

    this.to = {
      record: toRecord,
      setId: toRecord ? registry.getSetId(edge.to) : null,
      orphaned: toRecord === null,
      wasDeleted: registry.wasDeleted(edge.to),
      deletionInfo: registry.getDeletionInfo(edge.to)
    };
  }

  /**
   * Check if either endpoint is orphaned
   */
  hasOrphan() {
    return this.from.orphaned || this.to.orphaned;
  }

  /**
   * Check if this is a cross-set edge
   */
  isCrossSet() {
    return this.from.setId !== this.to.setId;
  }
}

/**
 * EdgeQueryHelper - Utility functions for querying edges
 */
class EdgeQueryHelper {
  /**
   * Query edges for a specific record
   */
  static queryEdgesForRecord(recordId, edgeType, direction, edges, edgeTypes) {
    const typeDef = edgeTypes?.[edgeType];

    return edges.filter(edge => {
      if (edge.type !== edgeType) return false;

      // Symmetric: match either endpoint regardless of direction param
      if (!edge.directed || typeDef?.symmetric) {
        return edge.from === recordId || edge.to === recordId;
      }

      // Directed: respect direction param
      switch (direction) {
        case 'outgoing': return edge.from === recordId;
        case 'incoming': return edge.to === recordId;
        case 'both': return edge.from === recordId || edge.to === recordId;
        default: return edge.from === recordId;
      }
    });
  }

  /**
   * Group edges by type and direction for a record
   */
  static groupEdgesByTypeAndDirection(edges, recordId, edgeTypes) {
    const groups = {};

    for (const edge of edges) {
      if (!edge.connectsTo(recordId)) continue;

      if (!groups[edge.type]) {
        groups[edge.type] = { outgoing: [], incoming: [] };
      }

      const typeDef = edgeTypes?.[edge.type];

      // Symmetric edges: always show as "outgoing" (no incoming section)
      if (!edge.directed || typeDef?.symmetric) {
        groups[edge.type].outgoing.push(edge);
      } else if (edge.from === recordId) {
        groups[edge.type].outgoing.push(edge);
      } else {
        groups[edge.type].incoming.push(edge);
      }
    }

    return groups;
  }

  /**
   * Detect symmetric edges during import
   */
  static detectSymmetricEdges(edges, edgeType) {
    const typeEdges = edges.filter(e =>
      (e.type || e.relationship || e.label || 'related_to') === edgeType
    );

    if (typeEdges.length === 0) return { isSymmetric: false, ratio: 0 };

    let reverseCount = 0;
    for (const edge of typeEdges) {
      const from = edge.source || edge.from;
      const to = edge.target || edge.to;
      const hasReverse = typeEdges.some(e =>
        (e.source || e.from) === to && (e.target || e.to) === from
      );
      if (hasReverse) reverseCount++;
    }

    const ratio = reverseCount / typeEdges.length;
    return {
      isSymmetric: ratio > 0.8,
      ratio,
      count: typeEdges.length,
      reverseCount
    };
  }
}

/**
 * EdgeConfig - Legacy class, kept for backward compatibility
 * @deprecated Use EdgeRecord instead
 */
class EdgeConfig {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique edge ID
   * @param {string} options.sourceRecordId - From record
   * @param {string} options.targetRecordId - To record
   * @param {string} options.operator - RelationshipOperator
   * @param {string} options.fieldId - Link field that defines this edge
   * @param {boolean} options.bidirectional - Two-way relationship
   */
  constructor(options) {
    this.id = options.id || generateOntologyId('edge');
    this.sourceRecordId = options.sourceRecordId;
    this.targetRecordId = options.targetRecordId;
    this.operator = options.operator || RelationshipOperator.CON;

    // Link field that created this edge
    this.fieldId = options.fieldId || null;
    this.sourceSetId = options.sourceSetId || null;
    this.targetSetId = options.targetSetId || null;

    // Directionality
    this.bidirectional = options.bidirectional || false;

    // Metadata
    this.createdAt = options.createdAt || new Date().toISOString();
    this.createdBy = options.createdBy || null;

    // Edge properties
    this.label = options.label || null;
    this.weight = options.weight || 1;
    this.properties = options.properties || {};
  }

  /**
   * Get CSS styling hints based on operator
   */
  getEdgeStyle() {
    switch (this.operator) {
      case RelationshipOperator.CON:
        return { lineStyle: 'solid', color: '#7c3aed' }; // Purple
      case RelationshipOperator.SYN:
        return { lineStyle: 'solid', width: 3, color: '#ea580c' }; // Orange thick
      case RelationshipOperator.REF:
        return { lineStyle: 'dashed', color: '#6b7280' }; // Gray dashed
      case RelationshipOperator.SEG:
        return { lineStyle: 'dotted', color: '#dc2626' }; // Red dotted
      case RelationshipOperator.PARENT:
      case RelationshipOperator.CHILD:
        return { lineStyle: 'solid', color: '#2563eb' }; // Blue
      default:
        return { lineStyle: 'solid', color: '#9ca3af' };
    }
  }

  /**
   * Convert to new EdgeRecord format
   */
  toEdgeRecord(ownerSetId) {
    return new EdgeRecord({
      id: this.id,
      ownerSetId: ownerSetId || this.sourceSetId,
      from: this.sourceRecordId,
      to: this.targetRecordId,
      type: this.operator,
      directed: !this.bidirectional,
      properties: {
        label: this.label,
        weight: this.weight,
        ...this.properties
      }
    });
  }

  toJSON() {
    return {
      id: this.id,
      sourceRecordId: this.sourceRecordId,
      targetRecordId: this.targetRecordId,
      operator: this.operator,
      fieldId: this.fieldId,
      sourceSetId: this.sourceSetId,
      targetSetId: this.targetSetId,
      bidirectional: this.bidirectional,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      label: this.label,
      weight: this.weight,
      properties: { ...this.properties }
    };
  }
}

// ============================================================================
// Edge Event Categories
// ============================================================================

/**
 * EdgeEventCategory - Event types for edge operations
 */
const EdgeEventCategory = Object.freeze({
  // Given events (structural facts)
  EDGE_IMPORTED: 'edge_imported',
  EDGE_CREATED: 'edge_created',
  EDGE_UPDATED: 'edge_updated',
  EDGE_RELINKED: 'edge_relinked',
  EDGE_DELETED: 'edge_deleted',

  // Meant events (interpretive configurations)
  EDGE_TYPE_REGISTERED: 'edge_type_registered',
  EDGE_PROJECTION_CONFIGURED: 'edge_projection_configured',
  EDGE_PROJECTION_REMOVED: 'edge_projection_removed'
});

// ============================================================================
// Fix #5: Explicit Frame System
// ============================================================================

/**
 * FrameConfig - Explicit context/purpose (Fix #5)
 *
 * Every Set must belong to a Frame.
 * A Frame defines: time horizon, purpose, valid transformations.
 */
class FrameConfig {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique frame ID
   * @param {string} options.name - Human-readable name
   * @param {string} options.purpose - Why this frame exists
   * @param {Object} options.horizon - Time/actor/entity constraints
   * @param {string[]} options.validOperators - Operators allowed in this frame
   */
  constructor(options) {
    this.id = options.id || generateOntologyId('frame');
    this.name = options.name || 'Untitled Frame';
    this.purpose = options.purpose || 'general';
    this.description = options.description || '';

    // Horizon constraints
    this.horizon = {
      timeRange: options.horizon?.timeRange || null,
      actors: options.horizon?.actors || [],
      entityTypes: options.horizon?.entityTypes || [],
      sets: options.horizon?.sets || []
    };

    // Operator restrictions
    this.validOperators = options.validOperators ||
      ['NUL', 'DES', 'INS', 'SEG', 'CON', 'ALT', 'SYN', 'SUP', 'REC'];

    // Parent frame (for nesting)
    this.parentFrameId = options.parentFrameId || null;

    // Timestamps
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || new Date().toISOString();
  }

  /**
   * Check if an operator is valid in this frame
   */
  isOperatorAllowed(operatorId) {
    return this.validOperators.includes(operatorId);
  }

  /**
   * Get display label with purpose
   */
  getDisplayLabel() {
    return `${this.name} — ${this.purpose}`;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      purpose: this.purpose,
      description: this.description,
      horizon: { ...this.horizon },
      validOperators: [...this.validOperators],
      parentFrameId: this.parentFrameId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

// ============================================================================
// Fix #6: View Immutability - SUP Only
// ============================================================================

/**
 * ViewOperation - What Views are allowed to do (Fix #6)
 */
const ViewOperation = Object.freeze({
  // Allowed (SUP operations)
  SORT: 'sort',
  GROUP: 'group',
  HIGHLIGHT: 'highlight',
  OVERLAY: 'overlay',
  FILTER_DISPLAY: 'filter_display', // Visual only, not data

  // Forbidden (require promotion to Set)
  CREATE_RECORD: 'create_record',
  UPDATE_RECORD: 'update_record',
  DELETE_RECORD: 'delete_record',
  CREATE_FIELD: 'create_field',
  UPDATE_SCHEMA: 'update_schema'
});

const VIEW_ALLOWED_OPERATIONS = Object.freeze([
  ViewOperation.SORT,
  ViewOperation.GROUP,
  ViewOperation.HIGHLIGHT,
  ViewOperation.OVERLAY,
  ViewOperation.FILTER_DISPLAY
]);

const VIEW_FORBIDDEN_OPERATIONS = Object.freeze([
  ViewOperation.CREATE_RECORD,
  ViewOperation.UPDATE_RECORD,
  ViewOperation.DELETE_RECORD,
  ViewOperation.CREATE_FIELD,
  ViewOperation.UPDATE_SCHEMA
]);

/**
 * Check if an operation is allowed in a View
 */
function isViewOperationAllowed(operation) {
  return VIEW_ALLOWED_OPERATIONS.includes(operation);
}

// ============================================================================
// Fix #7: Derivation Visibility
// ============================================================================

/**
 * DerivationChain - Shows provenance lineage (Fix #7)
 */
class DerivationChain {
  constructor() {
    this.steps = [];
  }

  /**
   * Add a derivation step
   */
  addStep(entityId, entityType, derivation) {
    this.steps.push({
      entityId,
      entityType, // 'source', 'set', 'view'
      derivation: derivation ? derivation.toJSON() : null,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get the root source
   */
  getRootSource() {
    const sourceStep = this.steps.find(s => s.entityType === 'source');
    return sourceStep ? sourceStep.entityId : null;
  }

  /**
   * Render as display string
   */
  toDisplayString() {
    return this.steps.map(s => {
      const prefix = {
        'source': '◉',
        'set': '⊞',
        'view': '◇'
      }[s.entityType] || '○';
      return `${prefix} ${s.entityId}`;
    }).join(' → ');
  }

  toJSON() {
    return {
      steps: [...this.steps]
    };
  }
}

// ============================================================================
// Fix #8: Operator-First Creation
// ============================================================================

/**
 * CreationIntent - Operator-first creation flow (Fix #8)
 */
const CreationIntent = Object.freeze({
  FILTER: { operator: 'SEG', label: 'Filter existing data', icon: 'ph-funnel' },
  RELATE: { operator: 'CON', label: 'Relate things', icon: 'ph-link' },
  SLICE: { operator: 'ALT', label: 'Slice by time', icon: 'ph-clock' },
  COMBINE: { operator: 'SUP', label: 'Combine perspectives', icon: 'ph-stack' },
  IMPORT: { operator: 'INS', label: 'Import new data', icon: 'ph-upload' }
});

/**
 * Get creation flow based on operator intent
 */
function getCreationFlowForIntent(intent) {
  switch (intent) {
    case 'FILTER':
      return {
        operator: 'SEG',
        requiredInputs: ['parentSet', 'filters'],
        outputType: 'set',
        prompt: 'What data should be filtered?'
      };
    case 'RELATE':
      return {
        operator: 'CON',
        requiredInputs: ['sets', 'joinCondition'],
        outputType: 'set',
        prompt: 'What should be related?'
      };
    case 'SLICE':
      return {
        operator: 'ALT',
        requiredInputs: ['parentSet', 'timeField', 'sliceRule'],
        outputType: 'set',
        prompt: 'How should time slices work?'
      };
    case 'COMBINE':
      return {
        operator: 'SUP',
        requiredInputs: ['sets'],
        outputType: 'view',
        prompt: 'What perspectives should be combined?'
      };
    case 'IMPORT':
      return {
        operator: 'INS',
        requiredInputs: ['file', 'provenance'],
        outputType: 'source',
        prompt: 'Import external data'
      };
    default:
      return null;
  }
}

// ============================================================================
// Fix #9: Stability Levels
// ============================================================================

/**
 * StabilityLevel - Holon/Protogon/Emanon classification (Fix #9)
 */
const StabilityLevel = Object.freeze({
  HOLON: 'holon',       // Stable, self-maintaining
  PROTOGON: 'protogon', // Transitional, emerging
  EMANON: 'emanon'      // Observational, ephemeral
});

/**
 * Get capabilities for a stability level
 */
function getStabilityCapabilities(level) {
  switch (level) {
    case StabilityLevel.HOLON:
      return {
        statusAllowed: true,
        metricsAllowed: true,
        aggregationAllowed: true,
        persistenceRequired: true,
        description: 'Stable entity with full lifecycle support'
      };
    case StabilityLevel.PROTOGON:
      return {
        statusAllowed: true,
        metricsAllowed: false,
        aggregationAllowed: false,
        persistenceRequired: true,
        description: 'Transitional entity, status tracking only'
      };
    case StabilityLevel.EMANON:
      return {
        statusAllowed: false,
        metricsAllowed: false,
        aggregationAllowed: false,
        persistenceRequired: false,
        description: 'Observational snapshot, no state tracking'
      };
    default:
      return null;
  }
}

// ============================================================================
// Fix #10: Ontology Validation (Fail Loudly)
// ============================================================================

/**
 * OntologyError - Explicit ontological violation (Fix #10)
 */
class OntologyError extends Error {
  constructor(code, message, context = {}) {
    super(`[ONTOLOGY:${code}] ${message}`);
    this.name = 'OntologyError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Get user-friendly message
   */
  getUserMessage() {
    const messages = {
      'EMPTY_SET': 'A Set must be derived from data. Empty Sets are not allowed.',
      'MISSING_DERIVATION': 'This Set has no derivation strategy. Sets must be born from constraint.',
      'INVALID_SOURCE_MUTATION': 'Sources are immutable. You cannot modify imported data.',
      'VIEW_MUTATION_FORBIDDEN': 'Views cannot modify data. Promote to Set first.',
      'MISSING_FRAME': 'Every Set must belong to a Frame with explicit purpose.',
      'INVALID_TRANSITION': 'This status transition is not allowed by the workflow.',
      'ORPHAN_SET': 'This Set has no connection to any Source.',
      'GRAPH_NO_EDGES': 'Graph requires relationships. No edges are defined.',
      'REC_WITHOUT_LOOP': 'Recursive status requires active feedback loops.'
    };
    return messages[this.code] || this.message;
  }

  /**
   * Get icon for display
   */
  getIcon() {
    return 'ph-warning-circle';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.getUserMessage(),
      context: this.context,
      timestamp: this.timestamp
    };
  }
}

/**
 * OntologyValidator - Central validation (Fix #10)
 */
class OntologyValidator {
  constructor() {
    this.violations = [];
    this.warnings = [];
  }

  /**
   * Clear all violations
   */
  reset() {
    this.violations = [];
    this.warnings = [];
  }

  /**
   * Validate a Source
   */
  validateSource(source) {
    const errors = [];

    if (source.type !== OntologicalType.GIVEN) {
      errors.push(new OntologyError('TYPE_MISMATCH',
        'Source must be GIVEN type', { sourceId: source.id }));
    }

    if (!source.provenance?.source && !source.fileHash) {
      errors.push(new OntologyError('MISSING_PROVENANCE',
        'Source must have provenance', { sourceId: source.id }));
    }

    this.violations.push(...errors);
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate a Set
   */
  validateSet(set, options = {}) {
    const errors = [];

    // Fix #2: Sets must have derivation
    if (!set.derivation && !options.isDirectImport) {
      errors.push(new OntologyError('MISSING_DERIVATION',
        'Set must have derivation strategy', { setId: set.id }));
    }

    // Fix #2: Empty constraint check
    if (set.derivation?.strategy === DerivationStrategy.SEG) {
      if (!set.derivation.constraint?.filters?.length) {
        errors.push(new OntologyError('EMPTY_SET',
          'SEG derivation requires filters', { setId: set.id }));
      }
    }

    // Fix #5: Frame required
    if (!set.frameId && options.requireFrame !== false) {
      this.warnings.push(new OntologyError('MISSING_FRAME',
        'Set should belong to a Frame', { setId: set.id }));
    }

    // Fix #9: Stability level check
    if (set.stabilityLevel === StabilityLevel.EMANON) {
      if (set.workflow?.enabled) {
        errors.push(new OntologyError('INVALID_STABILITY',
          'EMANON sets cannot have workflow', { setId: set.id }));
      }
    }

    this.violations.push(...errors);
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate a View operation
   */
  validateViewOperation(view, operation) {
    const errors = [];

    // Fix #6: Views are SUP only
    if (VIEW_FORBIDDEN_OPERATIONS.includes(operation)) {
      errors.push(new OntologyError('VIEW_MUTATION_FORBIDDEN',
        `Views cannot perform ${operation}`,
        { viewId: view.id, operation }));
    }

    this.violations.push(...errors);
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate status transition
   */
  validateStatusTransition(set, record, fromStatus, toStatus, actorRole) {
    const errors = [];

    // Fix #3: Check workflow rules
    if (set.workflow?.enabled) {
      if (!set.workflow.isValidTransition(fromStatus, toStatus, actorRole)) {
        errors.push(new OntologyError('INVALID_TRANSITION',
          `Cannot transition from ${fromStatus} to ${toStatus}`,
          { setId: set.id, recordId: record.id }));
      }
    }

    this.violations.push(...errors);
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate graph has edges
   */
  validateGraphView(view, edges) {
    const errors = [];

    // Fix #4: Graph requires edges
    if (!edges || edges.length === 0) {
      errors.push(new OntologyError('GRAPH_NO_EDGES',
        'Graph view requires relationships', { viewId: view.id }));
    }

    this.violations.push(...errors);
    return { valid: errors.length === 0, errors };
  }

  /**
   * Get all violations as user messages
   */
  getViolationMessages() {
    return this.violations.map(v => ({
      code: v.code,
      message: v.getUserMessage(),
      icon: v.getIcon()
    }));
  }

  /**
   * Check if any violations occurred
   */
  hasViolations() {
    return this.violations.length > 0;
  }
}

// ============================================================================
// ID Generation
// ============================================================================

function generateOntologyId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}${random}`;
}

// ============================================================================
// Operator-Indexed Set Name Generator
// ============================================================================

/**
 * Generate EO-compliant Set name with operator prefix
 */
function generateSetName(operator, baseName, frameName = null) {
  const operatorPrefix = {
    'SEG': 'SEG:',
    'CON': 'CON:',
    'ALT': 'ALT:',
    'SYN': 'SYN:'
  }[operator] || '';

  const frameSuffix = frameName ? ` — Frame: ${frameName}` : '';

  return `${operatorPrefix} ${baseName}${frameSuffix}`;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Core types
    OntologicalType,
    SourceConfig,
    DerivationStrategy,
    DerivationConfig,
    WorkflowTransition,
    WorkflowConfig,
    RelationshipOperator,
    EdgeConfig,
    FrameConfig,
    ViewOperation,
    VIEW_ALLOWED_OPERATIONS,
    VIEW_FORBIDDEN_OPERATIONS,
    DerivationChain,
    CreationIntent,
    StabilityLevel,
    OntologyError,
    OntologyValidator,

    // Edge System (Edges are Given, Projections are Meant)
    EdgeRecord,
    EdgeTypeDefinition,
    EdgeProjection,
    GlobalRecordRegistry,
    ResolvedEdge,
    EdgeQueryHelper,
    EdgeEventCategory,

    // Functions
    isViewOperationAllowed,
    getCreationFlowForIntent,
    getStabilityCapabilities,
    generateOntologyId,
    generateSetName
  };
}

if (typeof window !== 'undefined') {
  window.EOOntology = {
    OntologicalType,
    SourceConfig,
    DerivationStrategy,
    DerivationConfig,
    WorkflowTransition,
    WorkflowConfig,
    RelationshipOperator,
    EdgeConfig,
    FrameConfig,
    ViewOperation,
    VIEW_ALLOWED_OPERATIONS,
    VIEW_FORBIDDEN_OPERATIONS,
    DerivationChain,
    CreationIntent,
    StabilityLevel,
    OntologyError,
    OntologyValidator,

    // Edge System (Edges are Given, Projections are Meant)
    EdgeRecord,
    EdgeTypeDefinition,
    EdgeProjection,
    GlobalRecordRegistry,
    ResolvedEdge,
    EdgeQueryHelper,
    EdgeEventCategory,

    isViewOperationAllowed,
    getCreationFlowForIntent,
    getStabilityCapabilities,
    generateOntologyId,
    generateSetName
  };
}
