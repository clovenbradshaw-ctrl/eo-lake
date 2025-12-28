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

/**
 * EdgeConfig - First-class relationship definition
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
// NEW: Schema Split - Structural vs Semantic (EO-Strict)
// ============================================================================

/**
 * SchemaType - Classification of schema information
 *
 * EO DISTINCTION:
 * - STRUCTURAL: Forced by data shape (automatic, objective)
 * - SEMANTIC: Interpretive meaning (human-assigned, subjective)
 *
 * This split prevents category blur between what IS in the data
 * versus what we INTERPRET the data to mean.
 */
const SchemaType = Object.freeze({
  STRUCTURAL: 'structural',
  SEMANTIC: 'semantic'
});

/**
 * StructuralSchema - Schema forced by data shape
 *
 * This is MEANT but grounded structurally in Given data.
 * It represents what fields exist, not what they mean.
 *
 * Grounding: structural (forced by data)
 */
class StructuralSchema {
  /**
   * @param {Object} options
   * @param {string} options.sourceEventId - Given event this schema derives from
   * @param {string[]} options.fieldsPresent - Field names that exist
   * @param {Object} options.fieldTypes - Inferred types for each field
   */
  constructor(options) {
    this.id = options.id || generateOntologyId('schema_struct');
    this.schemaType = SchemaType.STRUCTURAL;
    this.sourceEventId = options.sourceEventId;

    // What fields exist (structural fact)
    this.fieldsPresent = options.fieldsPresent || [];

    // Inferred types (structural inference)
    this.fieldTypes = options.fieldTypes || {};

    // Sample values for type inference (not semantic)
    this.sampleValues = options.sampleValues || {};

    // Statistics (structural facts)
    this.rowCount = options.rowCount || 0;
    this.nullCounts = options.nullCounts || {};

    // Timestamp
    this.inferredAt = options.inferredAt || new Date().toISOString();

    Object.freeze(this.fieldsPresent);
    Object.freeze(this.fieldTypes);
  }

  /**
   * Generate grounding for this schema
   */
  getGrounding() {
    return {
      references: [
        { eventId: this.sourceEventId, kind: 'structural' }
      ],
      derivation: null
    };
  }

  /**
   * Create event payload for this schema
   */
  toEventPayload() {
    return {
      fieldsPresent: [...this.fieldsPresent],
      fieldTypes: { ...this.fieldTypes },
      rowCount: this.rowCount,
      nullCounts: { ...this.nullCounts }
    };
  }

  toJSON() {
    return {
      id: this.id,
      schemaType: this.schemaType,
      sourceEventId: this.sourceEventId,
      fieldsPresent: [...this.fieldsPresent],
      fieldTypes: { ...this.fieldTypes },
      sampleValues: { ...this.sampleValues },
      rowCount: this.rowCount,
      nullCounts: { ...this.nullCounts },
      inferredAt: this.inferredAt
    };
  }
}

/**
 * SemanticSchema - Interpretive meaning of fields
 *
 * This is MEANT and grounded semantically in structural schema.
 * It represents what we INTERPRET the data to mean.
 *
 * Grounding: structural (from StructuralSchema) + semantic (interpretation)
 */
class SemanticSchema {
  /**
   * @param {Object} options
   * @param {string} options.structuralSchemaId - The structural schema this interprets
   * @param {Object} options.meanings - Human-assigned meanings for fields
   * @param {Object} options.displayNames - Human-friendly display names
   * @param {Object} options.descriptions - Field descriptions
   * @param {string} options.interpreter - Who assigned these meanings
   */
  constructor(options) {
    this.id = options.id || generateOntologyId('schema_sem');
    this.schemaType = SchemaType.SEMANTIC;
    this.structuralSchemaId = options.structuralSchemaId;

    // Semantic meanings (interpretation)
    this.meanings = options.meanings || {};

    // Display names (presentation choice)
    this.displayNames = options.displayNames || {};

    // Descriptions (explanatory)
    this.descriptions = options.descriptions || {};

    // Field categories (semantic grouping)
    this.categories = options.categories || {};

    // Interpreter
    this.interpreter = options.interpreter || 'unknown';
    this.interpretedAt = options.interpretedAt || new Date().toISOString();

    // Epistemic status
    this.epistemicStatus = options.epistemicStatus || 'preliminary';

    Object.freeze(this.meanings);
    Object.freeze(this.displayNames);
    Object.freeze(this.descriptions);
    Object.freeze(this.categories);
  }

  /**
   * Generate grounding for this schema
   */
  getGrounding() {
    return {
      references: [
        { eventId: this.structuralSchemaId, kind: 'structural' }
      ],
      derivation: null
    };
  }

  /**
   * Get meaning for a field
   */
  getMeaning(fieldName) {
    return this.meanings[fieldName] || null;
  }

  /**
   * Get display name for a field
   */
  getDisplayName(fieldName) {
    return this.displayNames[fieldName] || fieldName;
  }

  /**
   * Create event payload for this schema
   */
  toEventPayload() {
    return {
      meanings: { ...this.meanings },
      displayNames: { ...this.displayNames },
      descriptions: { ...this.descriptions },
      categories: { ...this.categories }
    };
  }

  toJSON() {
    return {
      id: this.id,
      schemaType: this.schemaType,
      structuralSchemaId: this.structuralSchemaId,
      meanings: { ...this.meanings },
      displayNames: { ...this.displayNames },
      descriptions: { ...this.descriptions },
      categories: { ...this.categories },
      interpreter: this.interpreter,
      interpretedAt: this.interpretedAt,
      epistemicStatus: this.epistemicStatus
    };
  }
}

/**
 * Create structural schema from raw data
 */
function inferStructuralSchema(sourceEventId, data, options = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const firstRow = data[0];
  const fieldsPresent = Object.keys(firstRow);
  const fieldTypes = {};
  const nullCounts = {};
  const sampleValues = {};

  // Infer types from data
  for (const field of fieldsPresent) {
    nullCounts[field] = 0;
    const values = data.map(row => row[field]).filter(v => v != null);
    sampleValues[field] = values.slice(0, 3);

    if (values.length === 0) {
      fieldTypes[field] = 'unknown';
      nullCounts[field] = data.length;
      continue;
    }

    // Type inference
    const sample = values[0];
    if (typeof sample === 'number') {
      fieldTypes[field] = Number.isInteger(sample) ? 'integer' : 'number';
    } else if (typeof sample === 'boolean') {
      fieldTypes[field] = 'boolean';
    } else if (sample instanceof Date) {
      fieldTypes[field] = 'date';
    } else if (typeof sample === 'string') {
      // Check for date patterns
      if (/^\d{4}-\d{2}-\d{2}/.test(sample)) {
        fieldTypes[field] = 'date';
      } else if (/^\d+$/.test(sample)) {
        fieldTypes[field] = 'number_string';
      } else {
        fieldTypes[field] = 'text';
      }
    } else {
      fieldTypes[field] = 'unknown';
    }

    // Count nulls
    nullCounts[field] = data.filter(row => row[field] == null).length;
  }

  return new StructuralSchema({
    sourceEventId,
    fieldsPresent,
    fieldTypes,
    sampleValues,
    rowCount: data.length,
    nullCounts,
    ...options
  });
}

/**
 * Create semantic schema from structural schema
 */
function createSemanticSchema(structuralSchemaId, interpretations, options = {}) {
  return new SemanticSchema({
    structuralSchemaId,
    meanings: interpretations.meanings || {},
    displayNames: interpretations.displayNames || {},
    descriptions: interpretations.descriptions || {},
    categories: interpretations.categories || {},
    interpreter: options.interpreter || 'user',
    epistemicStatus: options.epistemicStatus || 'preliminary',
    ...options
  });
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

    // Schema Split (EO-Strict)
    SchemaType,
    StructuralSchema,
    SemanticSchema,

    // Functions
    isViewOperationAllowed,
    getCreationFlowForIntent,
    getStabilityCapabilities,
    generateOntologyId,
    generateSetName,
    inferStructuralSchema,
    createSemanticSchema
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

    // Schema Split (EO-Strict)
    SchemaType,
    StructuralSchema,
    SemanticSchema,

    // Functions
    isViewOperationAllowed,
    getCreationFlowForIntent,
    getStabilityCapabilities,
    generateOntologyId,
    generateSetName,
    inferStructuralSchema,
    createSemanticSchema
  };
}
