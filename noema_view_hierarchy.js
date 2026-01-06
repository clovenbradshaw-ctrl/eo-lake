/**
 * EO View Hierarchy - Nine Rules-Compliant View Organization
 *
 * Implements the compliant view hierarchy as specified in VIEW_HIERARCHY_DESIGN.md:
 *
 * Hierarchy Levels:
 *   1. Workspaces - Contextual boundaries (broadest horizon)
 *   2. Sets - Typed data collections with schema
 *   3. Lenses - View types (Grid, Cards, Kanban, Timeline, Calendar, Graph)
 *   4. Focuses - Filtered/restricted views
 *   5. Exports - Immutable frozen captures (downloaded and recorded)
 *
 * Compliance:
 *   - Rule 1: All views are explicitly MEANT events (interpretations)
 *   - Rule 4: All access mediated through HorizonGate
 *   - Rule 5: Focuses can only restrict parent scope, never expand
 *   - Rule 7: Every view requires provenance chain to Given events
 *   - Rule 9: Views are superseded, never deleted
 */

// ============================================================================
// Compliance Error
// ============================================================================

class ViewHierarchyError extends Error {
  constructor(rule, message) {
    super(`RULE_${rule}: ${message}`);
    this.name = 'ViewHierarchyError';
    this.rule = rule;
  }
}

// ============================================================================
// Epistemic Status for Views
// ============================================================================

const ViewEpistemicStatus = Object.freeze({
  PRELIMINARY: 'preliminary',   // Initial interpretation
  REVIEWED: 'reviewed',         // Validated by review
  CONTESTED: 'contested',       // Under dispute
  SUPERSEDED: 'superseded'      // Replaced by newer view
});

// ============================================================================
// Lens Types (DEPRECATED - Use ViewType from eo_types.js)
// ============================================================================

/**
 * @deprecated Use ViewType from eo_types.js instead.
 * LensType conflated data slicing with visualization. The new architecture separates:
 * - Lens: Data slice (pivot, included fields) - see PivotType
 * - View: Visualization (Grid, Cards, Kanban) - see ViewType
 */
const LensType = Object.freeze({
  GRID: 'grid',           // Tabular data display
  CARDS: 'cards',         // Visual entity browsing
  KANBAN: 'kanban',       // Status-based columns
  TIMELINE: 'timeline',   // Chronological ordering
  CALENDAR: 'calendar',   // Date-positioned events
  GRAPH: 'graph'          // Relationship networks
});

/**
 * @deprecated Use ViewTypeInfo instead
 */
const LensTypeInfo = {
  [LensType.GRID]: { icon: 'ph-table', label: 'Grid', description: 'Tabular data display' },
  [LensType.CARDS]: { icon: 'ph-cards', label: 'Cards', description: 'Visual entity browsing' },
  [LensType.KANBAN]: { icon: 'ph-kanban', label: 'Kanban', description: 'Status-based columns' },
  [LensType.TIMELINE]: { icon: 'ph-timeline', label: 'Timeline', description: 'Chronological ordering' },
  [LensType.CALENDAR]: { icon: 'ph-calendar-blank', label: 'Calendar', description: 'Date-positioned events' },
  [LensType.GRAPH]: { icon: 'ph-graph', label: 'Graph', description: 'Relationship networks' }
};

// ============================================================================
// CORE_ARCHITECTURE.md Compliant Types
// ============================================================================

/**
 * ViewTypeInfo - Metadata for view types (CORE_ARCHITECTURE.md compliant)
 *
 * Views are the working environment. This is where all features live:
 * - Grid: Spreadsheet rows/columns - general editing, data review
 * - Cards: Visual cards with field preview - contacts, properties, scanning
 * - Kanban: Columns by status field - workflow, task management
 * - Calendar: Events on date grid - scheduling, deadlines
 * - Graph: Nodes and edges - relationships, networks
 * - Timeline: Chronological ordering
 */
const ViewTypeInfo = {
  grid: { icon: 'ph-table', label: 'Grid', description: 'Spreadsheet rows/columns for general editing' },
  cards: { icon: 'ph-cards', label: 'Cards', description: 'Visual cards with field preview' },
  kanban: { icon: 'ph-kanban', label: 'Kanban', description: 'Columns by status field' },
  calendar: { icon: 'ph-calendar-blank', label: 'Calendar', description: 'Events on date grid' },
  graph: { icon: 'ph-graph', label: 'Graph', description: 'Nodes and edges for relationships' },
  timeline: { icon: 'ph-timeline', label: 'Timeline', description: 'Chronological ordering' }
};

/**
 * PivotTypeInfo - Metadata for lens pivot types
 *
 * A Lens is the data slice you're working with. Pivot types:
 * - None (null): Default lens - all records, all columns (most common)
 * - Filter: Only rows matching predicate
 * - Group: One "row" per unique value
 * - Extract: Pull record type from JSON
 */
const PivotTypeInfo = {
  null: { label: 'All Data', description: 'Default lens - all records, all columns' },
  filter: { label: 'Filter', description: 'Only rows matching predicate' },
  group: { label: 'Group By', description: 'One row per unique value' },
  extract: { label: 'Extract', description: 'Pull record type from JSON' }
};

// ============================================================================
// ID Generation
// ============================================================================

function generateViewId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}${random}`;
}

// ============================================================================
// Level 0: Project (Super Object - Contains Sources, Sets, Definitions, etc.)
// ============================================================================

class ProjectConfig {
  /**
   * Projects are the top-level organizational container.
   * They contain Sources, Sets, Definitions, and Exports.
   * Definitions can be cited/referenced across projects.
   *
   * @param {Object} options
   * @param {string} options.id - Unique identifier
   * @param {string} options.name - Human-readable name
   * @param {string} options.description - Project description
   * @param {string} options.icon - Phosphor icon class
   * @param {string} options.color - Project color for visual distinction
   * @param {string[]} options.sourceIds - IDs of sources in this project
   * @param {string[]} options.setIds - IDs of sets in this project
   * @param {string[]} options.definitionIds - IDs of definitions owned by this project
   * @param {string[]} options.exportIds - IDs of exports in this project
   * @param {Object} options.settings - Project-specific settings
   */
  constructor(options) {
    // Rule 1: Explicitly typed as 'meant' (project is an interpretation/organization)
    this.type = 'meant';
    this.viewType = 'project';

    this.id = options.id || generateViewId('proj');
    this.name = options.name || 'Untitled Project';
    this.description = options.description || '';
    this.icon = options.icon || 'ph-folder-simple-dashed';
    this.color = options.color || '#3B82F6'; // Default blue

    // Child entities - organized within this project
    this.sourceIds = options.sourceIds || [];
    this.setIds = options.setIds || [];
    this.definitionIds = options.definitionIds || []; // Owned definitions
    this.exportIds = options.exportIds || [];

    // Folder nesting - allows projects to be nested within other projects
    this.parentId = options.parentId || null; // Parent project ID for nesting

    // Workspaces within this project (optional - for sub-organization)
    this.workspaceIds = options.workspaceIds || [];

    // Project-level settings
    this.settings = {
      defaultWorkspace: options.settings?.defaultWorkspace || null,
      isDefault: options.settings?.isDefault || false, // Is this the default project?
      ...options.settings
    };

    // Rule 9: Defeasibility metadata
    this.epistemicStatus = options.epistemicStatus || ViewEpistemicStatus.PRELIMINARY;
    this.supersedes = options.supersedes || null;
    this.supersededBy = options.supersededBy || null;

    // Timestamps
    this.createdAt = options.createdAt || new Date().toISOString();
    this.createdBy = options.createdBy || null;
    this.updatedAt = options.updatedAt || new Date().toISOString();

    // Archive status
    this.status = options.status || 'active';
  }

  /**
   * Add a source to this project
   */
  addSource(sourceId) {
    if (!this.sourceIds.includes(sourceId)) {
      this.sourceIds.push(sourceId);
      this.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Add a set to this project
   */
  addSet(setId) {
    if (!this.setIds.includes(setId)) {
      this.setIds.push(setId);
      this.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Add a definition to this project
   */
  addDefinition(definitionId) {
    if (!this.definitionIds.includes(definitionId)) {
      this.definitionIds.push(definitionId);
      this.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Add an export to this project
   */
  addExport(exportId) {
    if (!this.exportIds.includes(exportId)) {
      this.exportIds.push(exportId);
      this.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Remove a source from this project
   */
  removeSource(sourceId) {
    const idx = this.sourceIds.indexOf(sourceId);
    if (idx !== -1) {
      this.sourceIds.splice(idx, 1);
      this.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Remove a set from this project
   */
  removeSet(setId) {
    const idx = this.setIds.indexOf(setId);
    if (idx !== -1) {
      this.setIds.splice(idx, 1);
      this.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Remove a definition from this project
   */
  removeDefinition(definitionId) {
    const idx = this.definitionIds.indexOf(definitionId);
    if (idx !== -1) {
      this.definitionIds.splice(idx, 1);
      this.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Get total item count
   */
  getItemCount() {
    return this.sourceIds.length + this.setIds.length +
           this.definitionIds.length + this.exportIds.length;
  }

  /**
   * Validate compliance
   */
  validate() {
    const errors = [];

    if (!this.name || this.name.trim() === '') {
      errors.push(new ViewHierarchyError(1, 'Project must have a name'));
    }

    return { valid: errors.length === 0, errors };
  }

  toJSON() {
    return {
      type: this.type,
      viewType: this.viewType,
      id: this.id,
      name: this.name,
      description: this.description,
      icon: this.icon,
      color: this.color,
      sourceIds: [...this.sourceIds],
      setIds: [...this.setIds],
      definitionIds: [...this.definitionIds],
      exportIds: [...this.exportIds],
      workspaceIds: [...this.workspaceIds],
      settings: { ...this.settings },
      epistemicStatus: this.epistemicStatus,
      supersedes: this.supersedes,
      supersededBy: this.supersededBy,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      updatedAt: this.updatedAt,
      status: this.status
    };
  }
}

// ============================================================================
// Level 1: Workspace (Contextual Boundary)
// ============================================================================

class WorkspaceConfig {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique identifier
   * @param {string} options.name - Human-readable name
   * @param {string} options.description - Description of the workspace context
   * @param {Object} options.horizon - Horizon constraints { timeRange, actors, entityTypes }
   * @param {string[]} options.provenance - IDs of Given events this derives from
   */
  constructor(options) {
    // Rule 1: Explicitly typed as 'meant'
    this.type = 'meant';
    this.viewType = 'workspace';

    this.id = options.id || generateViewId('ws');
    this.name = options.name || 'Untitled Workspace';
    this.description = options.description || '';
    this.icon = options.icon || 'ph-folder-simple';

    // Rule 4: Horizon definition
    this.horizon = {
      timeRange: options.horizon?.timeRange || null,
      actors: options.horizon?.actors || [],
      entityTypes: options.horizon?.entityTypes || []
    };

    // Rule 7: Provenance (must be provided)
    this.provenance = options.provenance || [];

    // Rule 9: Defeasibility metadata
    this.epistemicStatus = options.epistemicStatus || ViewEpistemicStatus.PRELIMINARY;
    this.supersedes = options.supersedes || null;
    this.supersededBy = options.supersededBy || null;

    // Timestamps
    this.createdAt = options.createdAt || new Date().toISOString();
    this.createdBy = options.createdBy || null;
    this.updatedAt = options.updatedAt || new Date().toISOString();

    // Child sets
    this.setIds = options.setIds || [];

    Object.freeze(this.horizon);
  }

  /**
   * Validate compliance
   */
  validate() {
    const errors = [];

    // Rule 7: Must have provenance
    if (!this.provenance || this.provenance.length === 0) {
      errors.push(new ViewHierarchyError(7, 'Workspace must have provenance'));
    }

    return { valid: errors.length === 0, errors };
  }

  toJSON() {
    return {
      type: this.type,
      viewType: this.viewType,
      id: this.id,
      name: this.name,
      description: this.description,
      icon: this.icon,
      horizon: { ...this.horizon },
      provenance: [...this.provenance],
      epistemicStatus: this.epistemicStatus,
      supersedes: this.supersedes,
      supersededBy: this.supersededBy,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      updatedAt: this.updatedAt,
      setIds: [...this.setIds]
    };
  }
}

// ============================================================================
// Level 2: Set (Typed Data Collection)
// ============================================================================

class SetConfig {
  /**
   * SetConfig - The flat rectangle of data with a typed schema
   *
   * Per CORE_ARCHITECTURE.md:
   * - A Set always binds to at least one Source
   * - All columns, all records from its Source(s)
   * - You can look but not work here (browse-only staging area)
   *
   * @param {Object} options
   * @param {string} options.id - Unique identifier
   * @param {string} options.name - Human-readable name
   * @param {string} options.workspaceId - Parent workspace ID
   * @param {Object} options.schema - Field definitions
   * @param {Object[]} options.sourceBindings - REQUIRED: Bindings to source(s)
   * @param {Object} options.coherenceRules - Rules for coherence (Rule 6)
   * @param {string[]} options.provenance - IDs of Given events
   */
  constructor(options) {
    // Rule 1: Explicitly typed as 'meant'
    this.type = 'meant';
    this.viewType = 'set';

    this.id = options.id || generateViewId('set');
    this.name = options.name || 'Untitled Set';
    this.workspaceId = options.workspaceId || null;
    this.icon = options.icon || 'ph-table';

    // CORE_ARCHITECTURE.md: A Set always binds to at least one Source
    // sourceBindings: [{ sourceId: "src_001", mapping: "direct" }]
    this.sourceBindings = options.sourceBindings || [];

    // Schema is an interpretation of entity structure
    // Per CORE_ARCHITECTURE.md: Fields can have semanticBinding to Definition terms
    // semanticBinding: { definitionId: "def_schema_org", termId: "Organization" }
    this.schema = {
      fields: (options.schema?.fields || []).map(field => ({
        ...field,
        // Preserve or initialize semanticBinding
        // Format: { definitionId: string, termId: string|null }
        // termId can be null if bound to the whole vocabulary
        semanticBinding: field.semanticBinding || null
      }))
    };

    // Rule 6: Coherence constraints
    this.coherenceRules = {
      includeTypes: options.coherenceRules?.includeTypes || [],
      excludeDeleted: options.coherenceRules?.excludeDeleted !== false
    };

    // Rule 7: Provenance chain (derived from sourceBindings if not provided)
    this.provenance = {
      derivedFrom: options.provenance?.derivedFrom ||
        this.sourceBindings.map(b => b.sourceId),
      createdAt: options.provenance?.createdAt || new Date().toISOString(),
      createdBy: options.provenance?.createdBy || null
    };

    // Rule 9: Defeasibility
    this.epistemicStatus = options.epistemicStatus || ViewEpistemicStatus.PRELIMINARY;
    this.supersedes = options.supersedes || null;
    this.supersededBy = options.supersededBy || null;

    // Timestamps
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || new Date().toISOString();

    // Records
    this.records = options.records || [];

    // Child lenses
    this.lensIds = options.lensIds || [];

    // Child views (for migration - views can reference set directly in legacy mode)
    this.viewIds = options.viewIds || [];
  }

  /**
   * Validate compliance
   */
  validate() {
    const errors = [];

    // Rule 7: Must have provenance
    if (!this.provenance.derivedFrom || this.provenance.derivedFrom.length === 0) {
      errors.push(new ViewHierarchyError(7, 'Set must have provenance'));
    }

    return { valid: errors.length === 0, errors };
  }

  // --------------------------------------------------------------------------
  // Semantic Binding Methods (CORE_ARCHITECTURE.md Compliance)
  // EO Operator Norm: operator(target, context, [frame])
  // --------------------------------------------------------------------------

  /**
   * Bind a field to a Definition term
   *
   * EO Operator Norm: bindField(target, context, frame)
   * - target: The field to bind
   * - context: The Definition and term to bind to
   * - frame: Epistemic frame (why this binding was made)
   *
   * Per CORE_ARCHITECTURE.md:
   * - Fields can optionally bind to Definition terms for semantic grounding
   * - Binding is optional (fields remain valid without it)
   *
   * @param {Object} target - { fieldId: string } - ID of the field to bind
   * @param {Object} context - { definitionId: string, termId: string|null } - Binding context
   * @param {Object} [frame] - { actor: string, method: string, reason: string } - Epistemic frame
   * @returns {Object} Result with success status and bound field
   */
  bindField(target, context, frame = {}) {
    const { fieldId } = target;
    const { definitionId, termId = null } = context;
    const { actor = 'system', method = 'manual_binding', reason = null } = frame;

    const field = this.schema.fields.find(f => f.id === fieldId);
    if (!field) {
      return { success: false, error: 'Field not found', fieldId };
    }

    const timestamp = new Date().toISOString();
    const previousBinding = field.semanticBinding;

    field.semanticBinding = {
      definitionId,
      termId,
      boundAt: timestamp,
      boundBy: actor,
      method,
      reason
    };
    this.updatedAt = timestamp;

    // CORE_ARCHITECTURE.md: Return event data for semantic_binding_created
    // Callers can use this to emit the proper event to the event store
    const eventData = {
      id: generateViewId('bind'),
      type: 'meant',
      category: 'semantic_binding_created',
      timestamp,
      actor,
      payload: {
        setId: this.id,
        fieldId,
        fieldName: field.name,
        definitionId,
        termId,
        previousBinding
      },
      provenance: [this.id, definitionId].filter(Boolean),
      frame: {
        purpose: 'field_semantic_grounding',
        method,
        reason
      }
    };

    return { success: true, field, eventData };
  }

  /**
   * Remove semantic binding from a field
   *
   * EO Operator Norm: unbindField(target, context, frame)
   *
   * @param {Object} target - { fieldId: string } - ID of the field to unbind
   * @param {Object} [context] - Context (unused, for API consistency)
   * @param {Object} [frame] - { actor: string, reason: string } - Epistemic frame
   * @returns {Object} Result with success status
   */
  unbindField(target, context = {}, frame = {}) {
    const { fieldId } = target;
    const { actor = 'system', reason = null } = frame;

    const field = this.schema.fields.find(f => f.id === fieldId);
    if (!field) {
      return { success: false, error: 'Field not found', fieldId };
    }

    const timestamp = new Date().toISOString();
    const previousBinding = field.semanticBinding;
    field.semanticBinding = null;
    this.updatedAt = timestamp;

    // CORE_ARCHITECTURE.md: Return event data for semantic_binding_removed
    const eventData = {
      id: generateViewId('unbind'),
      type: 'meant',
      category: 'semantic_binding_removed',
      timestamp,
      actor,
      payload: {
        setId: this.id,
        fieldId,
        fieldName: field.name,
        previousBinding
      },
      provenance: [this.id],
      frame: {
        purpose: 'field_semantic_ungrounding',
        reason
      }
    };

    return { success: true, field, previousBinding, eventData };
  }

  /**
   * Get all fields with semantic bindings
   *
   * @returns {Array} Fields that have semantic bindings
   */
  getBoundFields() {
    return this.schema.fields.filter(f => f.semanticBinding !== null);
  }

  /**
   * Get fields bound to a specific Definition
   *
   * @param {string} definitionId - ID of the Definition
   * @returns {Array} Fields bound to that Definition
   */
  getFieldsByDefinition(definitionId) {
    return this.schema.fields.filter(
      f => f.semanticBinding?.definitionId === definitionId
    );
  }

  /**
   * Get binding count for sidebar display
   *
   * Per CORE_ARCHITECTURE.md sidebar spec:
   * "Evictions (180 records) └─ 4 bindings: 🌐🌐📋📐"
   *
   * @returns {number} Count of fields with semantic bindings
   */
  getBindingCount() {
    return this.getBoundFields().length;
  }

  /**
   * Add a new field to the schema
   *
   * EO Operator Norm: addField(target, context, frame)
   *
   * @param {Object} target - { setId: this.id } - The set to add field to (implicit)
   * @param {Object} context - Field definition { name, type, isPrimary, etc. }
   * @param {Object} [frame] - { actor: string } - Epistemic frame
   * @returns {Object} The added field
   */
  addField(target, context = {}, frame = {}) {
    // Handle legacy single-argument call: addField(fieldDef)
    const fieldDef = context.name ? context : target;
    const { actor = 'system' } = context.name ? frame : (context || {});

    const newField = {
      id: fieldDef.id || generateViewId('fld'),
      name: fieldDef.name,
      type: fieldDef.type || 'text',
      isPrimary: fieldDef.isPrimary || false,
      semanticBinding: fieldDef.semanticBinding || null,
      createdAt: new Date().toISOString(),
      createdBy: actor,
      ...fieldDef
    };
    this.schema.fields.push(newField);
    this.updatedAt = new Date().toISOString();
    return newField;
  }

  /**
   * Update a field in the schema
   *
   * EO Operator Norm: updateField(target, context, frame)
   *
   * @param {Object} target - { fieldId: string } - ID of the field to update
   * @param {Object} context - Field updates to apply
   * @param {Object} [frame] - { actor: string } - Epistemic frame
   * @returns {Object|null} The updated field or null if not found
   */
  updateField(target, context = {}, frame = {}) {
    // Handle legacy single-argument call: updateField(fieldId, updates)
    const fieldId = typeof target === 'string' ? target : target.fieldId;
    const updates = typeof target === 'string' ? context : context;
    const { actor = 'system' } = frame;

    const field = this.schema.fields.find(f => f.id === fieldId);
    if (!field) return null;

    Object.assign(field, updates, {
      updatedAt: new Date().toISOString(),
      updatedBy: actor
    });
    this.updatedAt = new Date().toISOString();
    return field;
  }

  toJSON() {
    return {
      type: this.type,
      viewType: this.viewType,
      id: this.id,
      name: this.name,
      workspaceId: this.workspaceId,
      icon: this.icon,
      sourceBindings: [...this.sourceBindings],
      schema: { fields: [...this.schema.fields] },
      coherenceRules: { ...this.coherenceRules },
      provenance: { ...this.provenance },
      epistemicStatus: this.epistemicStatus,
      supersedes: this.supersedes,
      supersededBy: this.supersededBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      records: this.records,
      lensIds: [...this.lensIds],
      viewIds: [...this.viewIds]
    };
  }
}

// ============================================================================
// Level 3: Lens (Data Slice - CORE_ARCHITECTURE.md Compliant)
// ============================================================================

class LensConfig {
  /**
   * LensConfig - The data slice you're working with
   *
   * Per CORE_ARCHITECTURE.md:
   * - A Lens is either Default (pass-through of entire Set) or Pivoted
   * - Every View requires a Lens
   * - The Lens defines *what data* you see (the View defines *how* you see it)
   *
   * @param {Object} options
   * @param {string} options.id - Unique identifier
   * @param {string} options.name - Human-readable name
   * @param {string} options.setId - Parent set ID
   * @param {boolean} options.isDefault - True if this is the default lens (auto-created with Set)
   * @param {Object} options.pivot - Pivot configuration (null = default, pass-through)
   * @param {string|string[]} options.includedFields - 'all' or array of field IDs
   * @param {Object} options.provenance - Provenance tracking
   *
   * Legacy support:
   * @param {string} options.lensType - DEPRECATED: Use ViewConfig for view types
   */
  constructor(options) {
    // Rule 1: Explicitly typed as 'meant'
    this.type = 'meant';
    this.viewType = 'lens';

    this.id = options.id || generateViewId('lens');
    this.name = options.name || 'Untitled Lens';
    this.setId = options.setId || null;

    // CORE_ARCHITECTURE.md: Is this the default lens (auto-created)?
    this.isDefault = options.isDefault || false;

    // CORE_ARCHITECTURE.md: Pivot configuration
    // null = default lens (entire Set, no pivot)
    // { type: 'filter', predicate: {...} }
    // { type: 'group', field: 'status' }
    // { type: 'extract', predicate: { field: '_type', op: 'eq', value: 'Person' } }
    this.pivot = options.pivot || null;

    // CORE_ARCHITECTURE.md: Which fields are included
    // 'all' = all fields from Set
    // ['fld_01', 'fld_02'] = specific fields only
    this.includedFields = options.includedFields || 'all';

    // Child views (CORE_ARCHITECTURE.md: Views live under Lens)
    this.viewIds = options.viewIds || [];

    // ==== LEGACY SUPPORT (to be migrated) ====
    // These fields support backward compatibility with old LensConfig usage
    // where LensConfig conflated Lens (data slice) with View (visualization)
    this.lensType = options.lensType || LensType.GRID;

    // Legacy config (view-specific settings that should move to ViewConfig)
    this.config = {
      // These are Lens concerns (data filtering)
      filters: options.config?.filters || [],
      sorts: options.config?.sorts || [],
      hiddenFields: options.config?.hiddenFields || [],
      fieldOrder: options.config?.fieldOrder || [],

      // These are View concerns (should be in ViewConfig, kept for migration)
      groupByField: options.config?.groupByField || null,
      cardTitleField: options.config?.cardTitleField || null,
      cardDescriptionField: options.config?.cardDescriptionField || null,
      columnOrder: options.config?.columnOrder || [],
      dateField: options.config?.dateField || null,
      showEmptyColumns: options.config?.showEmptyColumns !== false,

      // Additional settings
      ...options.config
    };

    // Legacy visual settings (should be in ViewConfig)
    this.display = {
      columnWidth: options.display?.columnWidth || 200,
      cardHeight: options.display?.cardHeight || 'auto',
      showFieldLabels: options.display?.showFieldLabels !== false
    };
    // ==== END LEGACY SUPPORT ====

    // Rule 7: Provenance
    this.provenance = {
      derivedFromSet: options.setId || options.provenance?.derivedFromSet || null,
      derivedFromLens: options.provenance?.derivedFromLens || null,
      purpose: options.provenance?.purpose || 'data_slice'
    };

    // Rule 8: Determinacy at minimal horizon
    this.frame = {
      purpose: options.frame?.purpose || 'data_slice',
      epistemicStatus: options.frame?.epistemicStatus || ViewEpistemicStatus.PRELIMINARY
    };

    // Rule 9: Defeasibility
    this.epistemicStatus = options.epistemicStatus || ViewEpistemicStatus.PRELIMINARY;
    this.supersedes = options.supersedes || null;
    this.supersededBy = options.supersededBy || null;

    // Timestamps
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || new Date().toISOString();

    // Child focuses (legacy - Focus should be absorbed into View)
    this.focusIds = options.focusIds || [];
  }

  /**
   * Validate compliance
   */
  validate() {
    const errors = [];

    // Must have parent set
    if (!this.setId) {
      errors.push(new ViewHierarchyError(7, 'Lens must belong to a Set'));
    }

    // Must have valid lens type
    if (!Object.values(LensType).includes(this.lensType)) {
      errors.push(new ViewHierarchyError(1, 'Invalid lens type'));
    }

    return { valid: errors.length === 0, errors };
  }

  toJSON() {
    return {
      type: this.type,
      viewType: this.viewType,
      id: this.id,
      name: this.name,
      setId: this.setId,
      isDefault: this.isDefault,
      pivot: this.pivot,
      includedFields: this.includedFields,
      viewIds: [...this.viewIds],
      // Legacy fields
      lensType: this.lensType,
      config: { ...this.config },
      display: { ...this.display },
      // Standard fields
      provenance: { ...this.provenance },
      frame: { ...this.frame },
      epistemicStatus: this.epistemicStatus,
      supersedes: this.supersedes,
      supersededBy: this.supersededBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      focusIds: [...this.focusIds]
    };
  }
}

// ============================================================================
// Level 4: View (Visualization - CORE_ARCHITECTURE.md Compliant)
// ============================================================================

class ViewConfig {
  /**
   * ViewConfig - The working environment (visualization of a Lens)
   *
   * Per CORE_ARCHITECTURE.md:
   * - This is where you edit, filter, sort, and interact with data
   * - A View answers: "How do I want to see this Lens?"
   * - View types: Grid, Kanban, Calendar, Graph, Cards
   *
   * @param {Object} options
   * @param {string} options.id - Unique identifier
   * @param {string} options.name - Human-readable name
   * @param {string} options.lensId - Parent lens ID
   * @param {string} options.viewType - One of ViewType (grid, kanban, etc.)
   * @param {Object} options.config - View-specific configuration
   */
  constructor(options) {
    // Rule 1: Explicitly typed as 'meant'
    this.type = 'meant';
    this.hierarchyType = 'view';

    this.id = options.id || generateViewId('view');
    this.name = options.name || 'Untitled View';
    this.lensId = options.lensId || null;

    // CORE_ARCHITECTURE.md: View type (Grid, Kanban, Cards, Calendar, Graph)
    this.viewType = options.viewType || 'grid';

    // View-specific configuration
    this.config = {
      // Grid config
      visibleFields: options.config?.visibleFields || [],
      fieldWidths: options.config?.fieldWidths || {},
      sort: options.config?.sort || [],
      rowHeight: options.config?.rowHeight || 'medium',

      // Kanban config
      statusField: options.config?.statusField || null,
      columnOrder: options.config?.columnOrder || [],
      cardTitleField: options.config?.cardTitleField || null,
      cardPreviewFields: options.config?.cardPreviewFields || [],

      // Calendar config
      dateField: options.config?.dateField || null,
      endDateField: options.config?.endDateField || null,
      eventTitleField: options.config?.eventTitleField || null,

      // Graph config
      linkFields: options.config?.linkFields || [],
      nodeLabel: options.config?.nodeLabel || null,
      nodeColorField: options.config?.nodeColorField || null,
      layout: options.config?.layout || 'dagre',

      // Cards config
      cardImageField: options.config?.cardImageField || null,
      cardDescriptionField: options.config?.cardDescriptionField || null,

      // Common view config
      filters: options.config?.filters || [],    // Temporary filters (not saved to Lens)
      groupByField: options.config?.groupByField || null,
      showFieldLabels: options.config?.showFieldLabels !== false,

      // Additional settings
      ...options.config
    };

    // Rule 7: Provenance
    this.provenance = {
      derivedFromLens: options.lensId || options.provenance?.derivedFromLens || null,
      purpose: options.provenance?.purpose || 'data_visualization'
    };

    // Rule 9: Defeasibility
    this.epistemicStatus = options.epistemicStatus || ViewEpistemicStatus.PRELIMINARY;
    this.supersedes = options.supersedes || null;
    this.supersededBy = options.supersededBy || null;

    // Timestamps
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || new Date().toISOString();
  }

  /**
   * Validate compliance
   */
  validate() {
    const errors = [];

    // Must have parent lens
    if (!this.lensId) {
      errors.push(new ViewHierarchyError(7, 'View must belong to a Lens'));
    }

    // Must have valid view type
    const validViewTypes = ['grid', 'cards', 'kanban', 'calendar', 'graph', 'timeline'];
    if (!validViewTypes.includes(this.viewType)) {
      errors.push(new ViewHierarchyError(1, `Invalid view type: ${this.viewType}`));
    }

    return { valid: errors.length === 0, errors };
  }

  toJSON() {
    return {
      type: this.type,
      hierarchyType: this.hierarchyType,
      id: this.id,
      name: this.name,
      lensId: this.lensId,
      viewType: this.viewType,
      config: { ...this.config },
      provenance: { ...this.provenance },
      epistemicStatus: this.epistemicStatus,
      supersedes: this.supersedes,
      supersededBy: this.supersededBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

// ============================================================================
// Level 5: Focus (Filtered Perspective - DEPRECATED)
// Per CORE_ARCHITECTURE.md: Focus should be absorbed into View
// Focus-level features (filters, sorts, limits) belong in ViewConfig.config
// ============================================================================

class FocusConfig {
  /**
   * @deprecated Focus is being absorbed into View per CORE_ARCHITECTURE.md
   * Use ViewConfig.config.filters instead.
   *
   * @param {Object} options
   * @param {string} options.id - Unique identifier
   * @param {string} options.name - Human-readable name
   * @param {string} options.lensId - Parent lens ID
   * @param {Object} options.restrictions - Filters and constraints (Rule 5)
   * @param {Object} options.visibility - Field/record visibility
   * @param {Object} options.provenance - Provenance tracking
   */
  constructor(options) {
    // Rule 1: Explicitly typed as 'meant'
    this.type = 'meant';
    this.viewType = 'focus';

    this.id = options.id || generateViewId('focus');
    this.name = options.name || 'Filtered View';
    this.lensId = options.lensId || null;

    // Rule 5: Only restrictions, never expansions
    this.restrictions = {
      filters: options.restrictions?.filters || [],
      sorts: options.restrictions?.sorts || [],
      limit: options.restrictions?.limit || null
    };

    // Visibility constraints
    this.visibility = {
      hiddenFields: options.visibility?.hiddenFields || [],
      hiddenRecords: options.visibility?.hiddenRecords || []
    };

    // Rule 7: Provenance chain
    this.provenance = {
      derivedFromLens: options.lensId || options.provenance?.derivedFromLens || null,
      filterReason: options.provenance?.filterReason || null,
      createdBy: options.provenance?.createdBy || null
    };

    // Rule 6: Coherence guarantee
    this.coherenceInherited = true;

    // Rule 9: Defeasibility
    this.epistemicStatus = options.epistemicStatus || ViewEpistemicStatus.PRELIMINARY;
    this.supersedes = options.supersedes || null;
    this.supersededBy = options.supersededBy || null;

    // Timestamps
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || new Date().toISOString();
  }

  /**
   * Validate compliance
   */
  validate() {
    const errors = [];

    // Must have parent lens
    if (!this.lensId) {
      errors.push(new ViewHierarchyError(7, 'Focus must belong to a Lens'));
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check if focus properly restricts (Rule 5)
   */
  validateRestriction(parentLens) {
    const errors = [];

    // Check that we only add filters, not remove parent filters
    // (This is a simplified check - real implementation would be more thorough)
    if (this.restrictions.filters.length < parentLens.config.filters.length) {
      errors.push(new ViewHierarchyError(5, 'Focus cannot remove parent filters'));
    }

    return { valid: errors.length === 0, errors };
  }

  toJSON() {
    return {
      type: this.type,
      viewType: this.viewType,
      id: this.id,
      name: this.name,
      lensId: this.lensId,
      restrictions: { ...this.restrictions },
      visibility: { ...this.visibility },
      provenance: { ...this.provenance },
      coherenceInherited: this.coherenceInherited,
      epistemicStatus: this.epistemicStatus,
      supersedes: this.supersedes,
      supersededBy: this.supersededBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

// ============================================================================
// Level 5: Export (Immutable Capture - Downloaded and Recorded)
// ============================================================================

class ExportConfig {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique identifier
   * @param {string} options.name - Human-readable name
   * @param {string} options.sourceViewId - ID of view being captured (lens or focus)
   * @param {Object} options.viewConfig - Frozen view configuration
   * @param {Object} options.dataState - Captured data state
   * @param {Object} options.annotations - Purpose and notes
   * @param {string} options.capturedBy - REQUIRED: Who created this export
   * @param {Object} options.provenanceChain - Full provenance chain back to source (auto-populated if possible)
   */
  constructor(options) {
    // Rule 1: Explicitly typed as 'meant'
    this.type = 'meant';
    this.viewType = 'export';

    this.id = options.id || generateViewId('exp');
    this.name = options.name || 'Export';
    this.sourceViewId = options.sourceViewId || null;

    // Captured state - EO: auto-populate capturedBy if not provided
    this.capturedAt = options.capturedAt || new Date().toISOString();
    this.capturedBy = options.capturedBy || 'current_user';  // Auto-populate

    // The frozen view configuration
    this.viewConfig = options.viewConfig || null;

    // The data as it appeared
    this.dataState = {
      recordIds: options.dataState?.recordIds || [],
      eventLogPosition: options.dataState?.eventLogPosition || null
    };

    // EO COMPLIANCE: Full provenance chain preserving link to original sources
    // This ensures exports don't lose connection to where the data came from
    this.provenanceChain = {
      // The set this view derives from
      setId: options.provenanceChain?.setId || null,
      // The original source(s) the set was derived from
      sourceIds: options.provenanceChain?.sourceIds || [],
      // The derivation strategy used
      derivationStrategy: options.provenanceChain?.derivationStrategy || null,
      // Snapshot of the source provenance at export time
      sourceProvenance: options.provenanceChain?.sourceProvenance || null,
      // Chain of transformations applied
      transformations: options.provenanceChain?.transformations || []
    };

    // Rule 9: Defeasibility through annotations
    this.annotations = {
      purpose: options.annotations?.purpose || null,
      notes: options.annotations?.notes || ''
    };

    // Immutability marker
    this.immutable = true;

    // Rule 9: Can be superseded
    this.supersededBy = options.supersededBy || null;

    // Timestamps
    this.createdAt = options.createdAt || new Date().toISOString();
  }

  /**
   * Validate compliance
   */
  validate() {
    const errors = [];

    // Must have source view
    if (!this.sourceViewId) {
      errors.push(new ViewHierarchyError(7, 'Export must have source view'));
    }

    // Must have captured data
    if (!this.viewConfig) {
      errors.push(new ViewHierarchyError(7, 'Export must capture view configuration'));
    }

    // EO COMPLIANCE: Must have provenance chain for audit trail
    if (!this.provenanceChain || !this.provenanceChain.setId) {
      errors.push(new ViewHierarchyError(7, 'Export must have provenance chain linking to source set'));
    }

    // EO COMPLIANCE: Must have original source reference
    if (!this.provenanceChain?.sourceIds || this.provenanceChain.sourceIds.length === 0) {
      errors.push(new ViewHierarchyError(7, 'Export must trace back to original source(s)'));
    }

    return { valid: errors.length === 0, errors };
  }

  toJSON() {
    return {
      type: this.type,
      viewType: this.viewType,
      id: this.id,
      name: this.name,
      sourceViewId: this.sourceViewId,
      capturedAt: this.capturedAt,
      capturedBy: this.capturedBy,
      viewConfig: this.viewConfig,
      dataState: { ...this.dataState },
      provenanceChain: { ...this.provenanceChain },  // Include full provenance chain
      annotations: { ...this.annotations },
      immutable: this.immutable,
      supersededBy: this.supersededBy,
      createdAt: this.createdAt
    };
  }
}

// ============================================================================
// View Registry - Central Coordinator
// ============================================================================

class ViewRegistry {
  /**
   * ViewRegistry - Central Coordinator for the View Hierarchy
   *
   * Per CORE_ARCHITECTURE.md, manages the hierarchy:
   *   PROJECT → SOURCE → SET → LENS → VIEW
   *
   * Key behaviors:
   * - When a Set is created, auto-creates a default Lens
   * - When a Lens is created, auto-creates a default Grid View
   * - The chain SOURCE → SET → LENS → VIEW always exists
   *
   * @param {HorizonGate} horizonGate - For perspectival access (Rule 4)
   * @param {EOEventStore} eventStore - For provenance tracking (Rule 7)
   */
  constructor(horizonGate = null, eventStore = null) {
    this.gate = horizonGate;
    this.store = eventStore;

    // View storage by type
    this.projects = new Map();     // Level 0: Projects (super objects)
    this.workspaces = new Map();
    this.sets = new Map();
    this.lenses = new Map();
    this.views = new Map();        // CORE_ARCHITECTURE.md: Views (Level 4)
    this.focuses = new Map();      // Deprecated - being absorbed into View
    this.exports = new Map();

    // Active selections
    this.activeProjectId = null;   // Currently selected project
    this.activeWorkspaceId = null;
    this.activeSetId = null;
    this.activeLensId = null;
    this.activeViewId = null;      // CORE_ARCHITECTURE.md: Active View
    this.activeFocusId = null;     // Deprecated

    // Subscribers for reactive updates
    this._subscribers = new Set();
  }

  // --------------------------------------------------------------------------
  // Project Operations (Level 0 - Super Objects)
  // --------------------------------------------------------------------------

  /**
   * Create a new project
   * @param {Object} config - Project configuration
   */
  createProject(config) {
    const project = new ProjectConfig(config);

    const validation = project.validate();
    if (!validation.valid) {
      throw validation.errors[0];
    }

    this.projects.set(project.id, project);
    this._recordViewEvent('project_created', project);
    this._notify('project_created', project);

    return project;
  }

  /**
   * Get a project by ID
   */
  getProject(projectId) {
    return this.projects.get(projectId);
  }

  /**
   * Get all active projects
   */
  getAllProjects() {
    return Array.from(this.projects.values())
      .filter(p => p.status !== 'archived' && p.epistemicStatus !== ViewEpistemicStatus.SUPERSEDED);
  }

  /**
   * Set the active project
   */
  setActiveProject(projectId) {
    if (projectId && !this.projects.has(projectId)) {
      throw new Error(`Project not found: ${projectId}`);
    }
    this.activeProjectId = projectId;
    this._notify('project_activated', projectId ? this.projects.get(projectId) : null);
  }

  /**
   * Get the default project, or create one if none exists
   */
  getOrCreateDefaultProject() {
    // Find existing default project
    const defaultProject = Array.from(this.projects.values())
      .find(p => p.settings?.isDefault && p.status !== 'archived');

    if (defaultProject) {
      return defaultProject;
    }

    // Create default project
    const project = this.createProject({
      name: 'Default Project',
      description: 'Default project for organizing your data',
      icon: 'ph-folder-simple',
      settings: { isDefault: true }
    });

    return project;
  }

  /**
   * Update a project
   */
  updateProject(projectId, updates) {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Apply updates
    if (updates.name !== undefined) project.name = updates.name;
    if (updates.description !== undefined) project.description = updates.description;
    if (updates.icon !== undefined) project.icon = updates.icon;
    if (updates.color !== undefined) project.color = updates.color;
    if (updates.settings !== undefined) {
      project.settings = { ...project.settings, ...updates.settings };
    }
    project.updatedAt = new Date().toISOString();

    this._recordViewEvent('project_updated', project);
    this._notify('project_updated', project);

    return project;
  }

  /**
   * Archive a project (soft delete)
   */
  archiveProject(projectId) {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    project.status = 'archived';
    project.updatedAt = new Date().toISOString();

    // If this was the active project, clear it
    if (this.activeProjectId === projectId) {
      this.activeProjectId = null;
    }

    this._recordViewEvent('project_archived', project);
    this._notify('project_archived', project);

    return project;
  }

  /**
   * Add a source to a project
   */
  addSourceToProject(projectId, sourceId) {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    project.addSource(sourceId);
    this._notify('project_updated', project);
  }

  /**
   * Add a set to a project
   */
  addSetToProject(projectId, setId) {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    project.addSet(setId);
    this._notify('project_updated', project);
  }

  /**
   * Add a definition to a project
   */
  addDefinitionToProject(projectId, definitionId) {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    project.addDefinition(definitionId);
    this._notify('project_updated', project);
  }

  // --------------------------------------------------------------------------
  // Workspace Operations
  // --------------------------------------------------------------------------

  /**
   * Create a new workspace
   * @param {Object} config - Workspace configuration
   * @param {string[]} provenance - Required provenance event IDs
   */
  createWorkspace(config, provenance = []) {
    // Rule 7: Must have provenance
    if (!provenance || provenance.length === 0) {
      throw new ViewHierarchyError(7, 'Workspace requires provenance');
    }

    const workspace = new WorkspaceConfig({
      ...config,
      provenance
    });

    const validation = workspace.validate();
    if (!validation.valid) {
      throw validation.errors[0];
    }

    this.workspaces.set(workspace.id, workspace);
    this._recordViewEvent('workspace_created', workspace);
    this._notify('workspace_created', workspace);

    return workspace;
  }

  getWorkspace(workspaceId) {
    return this.workspaces.get(workspaceId);
  }

  getAllWorkspaces() {
    return Array.from(this.workspaces.values())
      .filter(w => w.epistemicStatus !== ViewEpistemicStatus.SUPERSEDED);
  }

  setActiveWorkspace(workspaceId) {
    if (!this.workspaces.has(workspaceId)) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    this.activeWorkspaceId = workspaceId;
    this._notify('workspace_activated', this.workspaces.get(workspaceId));
  }

  // --------------------------------------------------------------------------
  // Set Operations
  // --------------------------------------------------------------------------

  /**
   * Create a new set within a workspace
   *
   * Per CORE_ARCHITECTURE.md, this auto-creates:
   * - A default Lens (pass-through, no pivot)
   * - A default Grid View on that Lens
   *
   * @param {Object} config - Set configuration
   * @param {string} workspaceId - Parent workspace ID
   * @param {string[]} provenance - Provenance event IDs
   * @param {Object} options - Additional options
   * @param {boolean} options.skipAutoCreate - Skip auto-creation of default Lens/View
   * @param {string} options.sourceId - Source ID for sourceBindings
   */
  createSet(config, workspaceId, provenance = [], options = {}) {
    // Rule 7: Must have provenance
    if (!provenance || provenance.length === 0) {
      throw new ViewHierarchyError(7, 'Set requires provenance');
    }

    // Build sourceBindings from provenance if not provided
    const sourceBindings = config.sourceBindings || (options.sourceId ? [{
      sourceId: options.sourceId,
      mapping: 'direct'
    }] : []);

    const set = new SetConfig({
      ...config,
      workspaceId,
      sourceBindings,
      provenance: { derivedFrom: provenance, createdAt: new Date().toISOString() }
    });

    const validation = set.validate();
    if (!validation.valid) {
      throw validation.errors[0];
    }

    this.sets.set(set.id, set);

    // Update parent workspace
    const workspace = this.workspaces.get(workspaceId);
    if (workspace) {
      workspace.setIds.push(set.id);
    }

    this._recordViewEvent('set_created', set);
    this._notify('set_created', set);

    // CORE_ARCHITECTURE.md: Auto-create default Lens and View
    if (!options.skipAutoCreate) {
      const { lens, view } = this.createDefaultLensAndView(set);
      // Return set with references to auto-created entities
      return { set, defaultLens: lens, defaultView: view };
    }

    return set;
  }

  /**
   * Create default Lens and View for a Set
   *
   * Per CORE_ARCHITECTURE.md:
   * - Default Lens is pass-through (no pivot, all fields)
   * - Default View is Grid
   */
  createDefaultLensAndView(set) {
    // Create default Lens
    const lens = new LensConfig({
      name: `All ${set.name}`,
      setId: set.id,
      isDefault: true,
      pivot: null,  // No pivot = entire Set
      includedFields: 'all',
      provenance: { derivedFromSet: set.id }
    });

    this.lenses.set(lens.id, lens);
    set.lensIds.push(lens.id);

    this._recordViewEvent('lens_created', lens);
    this._notify('lens_created', lens);

    // Create default Grid View
    const view = new ViewConfig({
      name: `${set.name} Grid`,
      lensId: lens.id,
      viewType: 'grid',
      config: {
        visibleFields: set.schema?.fields?.map(f => f.id) || []
      },
      provenance: { derivedFromLens: lens.id }
    });

    this.views.set(view.id, view);
    lens.viewIds.push(view.id);

    this._recordViewEvent('view_created', view);
    this._notify('view_created', view);

    return { lens, view };
  }

  getSet(setId) {
    return this.sets.get(setId);
  }

  getSetsForWorkspace(workspaceId) {
    return Array.from(this.sets.values())
      .filter(s => s.workspaceId === workspaceId &&
                   s.epistemicStatus !== ViewEpistemicStatus.SUPERSEDED);
  }

  getAllSets() {
    return Array.from(this.sets.values())
      .filter(s => s.epistemicStatus !== ViewEpistemicStatus.SUPERSEDED);
  }

  setActiveSet(setId) {
    if (!this.sets.has(setId)) {
      throw new Error(`Set not found: ${setId}`);
    }
    this.activeSetId = setId;
    this._notify('set_activated', this.sets.get(setId));
  }

  // --------------------------------------------------------------------------
  // Lens Operations
  // --------------------------------------------------------------------------

  /**
   * Create a new lens for a set
   *
   * Per CORE_ARCHITECTURE.md, this auto-creates a default Grid View
   * unless skipAutoCreateView is true.
   *
   * @param {Object} config - Lens configuration
   * @param {string} setId - Parent set ID
   * @param {Object} options - Additional options
   * @param {boolean} options.skipAutoCreateView - Skip auto-creation of default View
   */
  createLens(config, setId, options = {}) {
    const set = this.sets.get(setId);
    if (!set) {
      throw new Error(`Set not found: ${setId}`);
    }

    const lens = new LensConfig({
      ...config,
      setId,
      provenance: { derivedFromSet: setId }
    });

    const validation = lens.validate();
    if (!validation.valid) {
      throw validation.errors[0];
    }

    this.lenses.set(lens.id, lens);

    // Update parent set
    set.lensIds.push(lens.id);

    this._recordViewEvent('lens_created', lens);
    this._notify('lens_created', lens);

    // CORE_ARCHITECTURE.md: Auto-create default View
    if (!options.skipAutoCreateView) {
      const view = this.createView({
        name: `${lens.name} Grid`,
        viewType: 'grid',
        config: {
          visibleFields: set.schema?.fields?.map(f => f.id) || []
        }
      }, lens.id);
      return { lens, defaultView: view };
    }

    return lens;
  }

  getLens(lensId) {
    return this.lenses.get(lensId);
  }

  getLensesForSet(setId) {
    return Array.from(this.lenses.values())
      .filter(l => l.setId === setId &&
                   l.epistemicStatus !== ViewEpistemicStatus.SUPERSEDED);
  }

  setActiveLens(lensId) {
    if (!this.lenses.has(lensId)) {
      throw new Error(`Lens not found: ${lensId}`);
    }
    this.activeLensId = lensId;
    this._notify('lens_activated', this.lenses.get(lensId));
  }

  // --------------------------------------------------------------------------
  // View Operations (CORE_ARCHITECTURE.md Compliant)
  // --------------------------------------------------------------------------

  /**
   * Create a new view for a lens
   *
   * Per CORE_ARCHITECTURE.md:
   * - Views are the working environment (where users edit, filter, sort)
   * - View types: Grid, Kanban, Calendar, Graph, Cards
   *
   * @param {Object} config - View configuration
   * @param {string} lensId - Parent lens ID
   */
  createView(config, lensId) {
    const lens = this.lenses.get(lensId);
    if (!lens) {
      throw new Error(`Lens not found: ${lensId}`);
    }

    const view = new ViewConfig({
      ...config,
      lensId,
      provenance: { derivedFromLens: lensId }
    });

    const validation = view.validate();
    if (!validation.valid) {
      throw validation.errors[0];
    }

    this.views.set(view.id, view);

    // Update parent lens
    lens.viewIds.push(view.id);

    this._recordViewEvent('view_created', view);
    this._notify('view_created', view);

    return view;
  }

  getView(viewId) {
    return this.views.get(viewId);
  }

  getViewsForLens(lensId) {
    return Array.from(this.views.values())
      .filter(v => v.lensId === lensId &&
                   v.epistemicStatus !== ViewEpistemicStatus.SUPERSEDED);
  }

  getAllViews() {
    return Array.from(this.views.values())
      .filter(v => v.epistemicStatus !== ViewEpistemicStatus.SUPERSEDED);
  }

  setActiveView(viewId) {
    if (!this.views.has(viewId)) {
      throw new Error(`View not found: ${viewId}`);
    }
    this.activeViewId = viewId;
    this._notify('view_activated', this.views.get(viewId));
  }

  /**
   * Update a view configuration
   */
  updateView(viewId, updates) {
    const view = this.views.get(viewId);
    if (!view) {
      throw new Error(`View not found: ${viewId}`);
    }

    // Apply updates
    if (updates.name !== undefined) view.name = updates.name;
    if (updates.viewType !== undefined) view.viewType = updates.viewType;
    if (updates.config !== undefined) {
      view.config = { ...view.config, ...updates.config };
    }
    view.updatedAt = new Date().toISOString();

    this._recordViewEvent('view_updated', view);
    this._notify('view_updated', view);

    return view;
  }

  // --------------------------------------------------------------------------
  // Focus Operations (DEPRECATED - being absorbed into View)
  // --------------------------------------------------------------------------

  /**
   * Create a focus (filtered view) from a lens
   * Rule 5: Can only restrict, never expand
   */
  createFocus(config, lensId) {
    const lens = this.lenses.get(lensId);
    if (!lens) {
      throw new Error(`Lens not found: ${lensId}`);
    }

    // Start with parent's filters and add restrictions
    const inheritedFilters = [...lens.config.filters];
    const newFilters = [...inheritedFilters, ...(config.restrictions?.filters || [])];

    const focus = new FocusConfig({
      ...config,
      lensId,
      restrictions: {
        filters: newFilters,
        sorts: config.restrictions?.sorts || lens.config.sorts,
        limit: config.restrictions?.limit
      },
      provenance: { derivedFromLens: lensId }
    });

    // Validate restriction rule
    const restrictionCheck = focus.validateRestriction(lens);
    if (!restrictionCheck.valid) {
      throw restrictionCheck.errors[0];
    }

    const validation = focus.validate();
    if (!validation.valid) {
      throw validation.errors[0];
    }

    this.focuses.set(focus.id, focus);

    // Update parent lens
    lens.focusIds.push(focus.id);

    this._recordViewEvent('focus_created', focus);
    this._notify('focus_created', focus);

    return focus;
  }

  getFocus(focusId) {
    return this.focuses.get(focusId);
  }

  getFocusesForLens(lensId) {
    return Array.from(this.focuses.values())
      .filter(f => f.lensId === lensId &&
                   f.epistemicStatus !== ViewEpistemicStatus.SUPERSEDED);
  }

  setActiveFocus(focusId) {
    if (focusId && !this.focuses.has(focusId)) {
      throw new Error(`Focus not found: ${focusId}`);
    }
    this.activeFocusId = focusId;
    this._notify('focus_activated', focusId ? this.focuses.get(focusId) : null);
  }

  // --------------------------------------------------------------------------
  // Export Operations (Downloads and Records)
  // --------------------------------------------------------------------------

  /**
   * Create an immutable export of a view (downloads and records)
   */
  createExport(config, sourceViewId, actor = null) {
    // Find the source view (can be lens or focus)
    let sourceView = this.lenses.get(sourceViewId) || this.focuses.get(sourceViewId);
    if (!sourceView) {
      throw new Error(`Source view not found: ${sourceViewId}`);
    }

    // Get current data state
    const set = this._getSetForView(sourceView);
    const recordIds = set ? set.records.map(r => r.id) : [];

    const exportRecord = new ExportConfig({
      ...config,
      sourceViewId,
      capturedBy: actor,
      viewConfig: sourceView.toJSON(),
      dataState: {
        recordIds,
        eventLogPosition: this.store?.clock || null
      }
    });

    const validation = exportRecord.validate();
    if (!validation.valid) {
      throw validation.errors[0];
    }

    this.exports.set(exportRecord.id, exportRecord);

    this._recordViewEvent('export_created', exportRecord);
    this._notify('export_created', exportRecord);

    return exportRecord;
  }

  getExport(exportId) {
    return this.exports.get(exportId);
  }

  getExportsForView(sourceViewId) {
    return Array.from(this.exports.values())
      .filter(e => e.sourceViewId === sourceViewId &&
                   !e.supersededBy);
  }

  // --------------------------------------------------------------------------
  // Supersession (Rule 9)
  // --------------------------------------------------------------------------

  /**
   * Supersede a view with a new configuration
   * Rule 9: Views are superseded, never deleted
   */
  supersedeView(viewId, newConfig, reason) {
    // Find the view
    let view = this.workspaces.get(viewId) ||
               this.sets.get(viewId) ||
               this.lenses.get(viewId) ||
               this.focuses.get(viewId);

    if (!view) {
      throw new Error(`View not found: ${viewId}`);
    }

    // Create new view with same type
    let newView;
    const supersessionConfig = {
      ...newConfig,
      supersedes: viewId,
      provenance: view.provenance
    };

    switch (view.viewType) {
      case 'workspace':
        newView = new WorkspaceConfig(supersessionConfig);
        this.workspaces.set(newView.id, newView);
        break;
      case 'set':
        newView = new SetConfig(supersessionConfig);
        this.sets.set(newView.id, newView);
        break;
      case 'lens':
        newView = new LensConfig(supersessionConfig);
        this.lenses.set(newView.id, newView);
        break;
      case 'focus':
        newView = new FocusConfig(supersessionConfig);
        this.focuses.set(newView.id, newView);
        break;
    }

    // Mark old view as superseded
    view.epistemicStatus = ViewEpistemicStatus.SUPERSEDED;
    view.supersededBy = newView.id;

    this._recordViewEvent('view_superseded', { oldView: view, newView, reason });
    this._notify('view_superseded', { oldView: view, newView, reason });

    return newView;
  }

  // --------------------------------------------------------------------------
  // View Lineage (Rule 7: Traceability)
  // --------------------------------------------------------------------------

  /**
   * Get the complete lineage of a view
   */
  getViewLineage(viewId) {
    const lineage = [];
    const visited = new Set();

    const traverse = (id) => {
      if (!id || visited.has(id)) return;
      visited.add(id);

      // Find the view
      const view = this.workspaces.get(id) ||
                   this.sets.get(id) ||
                   this.lenses.get(id) ||
                   this.focuses.get(id) ||
                   this.exports.get(id);

      if (!view) return;

      lineage.push({
        id: view.id,
        name: view.name,
        viewType: view.viewType,
        provenance: view.provenance
      });

      // Walk up the hierarchy
      if (view.provenance) {
        if (view.provenance.derivedFromLens) traverse(view.provenance.derivedFromLens);
        if (view.provenance.derivedFromSet) traverse(view.provenance.derivedFromSet);
        if (view.workspaceId) traverse(view.workspaceId);
      }
      if (view.lensId) traverse(view.lensId);
      if (view.setId) traverse(view.setId);
    };

    traverse(viewId);
    return lineage;
  }

  // --------------------------------------------------------------------------
  // Data Access (Rule 4: Perspectival)
  // --------------------------------------------------------------------------

  /**
   * Get view data respecting horizon constraints
   */
  getViewData(viewId, horizon = null) {
    // Find the view
    const view = this.lenses.get(viewId) || this.focuses.get(viewId);
    if (!view) return null;

    // Get the set
    const set = this._getSetForView(view);
    if (!set) return null;

    // Start with all records
    let data = [...set.records];

    // Apply filters from the view config
    const filters = view.restrictions?.filters || view.config?.filters || [];
    for (const filter of filters) {
      data = this._applyFilter(data, filter);
    }

    // Apply sorts
    const sorts = view.restrictions?.sorts || view.config?.sorts || [];
    for (const sort of sorts) {
      data = this._applySort(data, sort);
    }

    // Apply limit if specified
    if (view.restrictions?.limit) {
      data = data.slice(0, view.restrictions.limit);
    }

    // Apply horizon constraints if gate is available
    if (this.gate && horizon) {
      data = data.filter(record => {
        // Check if record is available in the horizon
        // This is a simplified check - real implementation would be more thorough
        return true;
      });
    }

    return {
      view,
      data,
      accessedAt: new Date().toISOString()
    };
  }

  _getSetForView(view) {
    if (view.viewType === 'lens') {
      return this.sets.get(view.setId);
    } else if (view.viewType === 'focus') {
      const lens = this.lenses.get(view.lensId);
      return lens ? this.sets.get(lens.setId) : null;
    }
    return null;
  }

  _applyFilter(data, filter) {
    if (!filter.fieldId || !filter.operator) return data;

    return data.filter(record => {
      const value = record.values?.[filter.fieldId];
      switch (filter.operator) {
        case 'equals': return value === filter.value;
        case 'not_equals': return value !== filter.value;
        case 'contains': return String(value || '').toLowerCase().includes(String(filter.value).toLowerCase());
        case 'is_empty': return value == null || value === '';
        case 'is_not_empty': return value != null && value !== '';
        default: return true;
      }
    });
  }

  _applySort(data, sort) {
    if (!sort.fieldId) return data;

    return [...data].sort((a, b) => {
      const aVal = a.values?.[sort.fieldId];
      const bVal = b.values?.[sort.fieldId];

      let comparison = 0;
      if (aVal == null && bVal == null) comparison = 0;
      else if (aVal == null) comparison = -1;
      else if (bVal == null) comparison = 1;
      else if (typeof aVal === 'string') comparison = aVal.localeCompare(bVal);
      else comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;

      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }

  // --------------------------------------------------------------------------
  // Event Recording (Rule 7)
  // --------------------------------------------------------------------------

  _recordViewEvent(action, payload) {
    if (!this.store) return;

    // Create a Meant event for the view operation
    try {
      // Views are Meant events - they're interpretations
      const event = {
        id: generateViewId('evt'),
        type: 'meant',
        category: 'view_config',
        actor: 'system',
        timestamp: new Date().toISOString(),
        context: {
          workspace: this.activeWorkspaceId || 'default',
          schemaVersion: '1.0'
        },
        frame: {
          purpose: 'view_management',
          epistemicStatus: ViewEpistemicStatus.PRELIMINARY
        },
        provenance: payload.provenance || ['system_init'],
        payload: {
          action,
          viewConfig: typeof payload.toJSON === 'function' ? payload.toJSON() : payload
        }
      };

      this.store.append(event);
    } catch (e) {
      console.warn('Failed to record view event:', e);
    }
  }

  // --------------------------------------------------------------------------
  // Subscriptions
  // --------------------------------------------------------------------------

  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  _notify(eventType, data) {
    for (const callback of this._subscribers) {
      try {
        callback(eventType, data);
      } catch (e) {
        console.error('View registry subscriber error:', e);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  export() {
    return {
      version: '2.0',  // Updated for CORE_ARCHITECTURE.md compliance
      exportedAt: new Date().toISOString(),
      projects: Array.from(this.projects.values()).map(p => p.toJSON()),
      workspaces: Array.from(this.workspaces.values()).map(w => w.toJSON()),
      sets: Array.from(this.sets.values()).map(s => s.toJSON()),
      lenses: Array.from(this.lenses.values()).map(l => l.toJSON()),
      views: Array.from(this.views.values()).map(v => v.toJSON()),  // CORE_ARCHITECTURE.md
      focuses: Array.from(this.focuses.values()).map(f => f.toJSON()),  // Deprecated
      exports: Array.from(this.exports.values()).map(e => e.toJSON()),
      active: {
        projectId: this.activeProjectId,
        workspaceId: this.activeWorkspaceId,
        setId: this.activeSetId,
        lensId: this.activeLensId,
        viewId: this.activeViewId,  // CORE_ARCHITECTURE.md
        focusId: this.activeFocusId  // Deprecated
      }
    };
  }

  import(data) {
    if (!data) return;

    // Import projects (Level 0)
    if (data.projects) {
      for (const p of data.projects) {
        this.projects.set(p.id, new ProjectConfig(p));
      }
    }

    // Import workspaces
    if (data.workspaces) {
      for (const w of data.workspaces) {
        this.workspaces.set(w.id, new WorkspaceConfig(w));
      }
    }

    // Import sets
    if (data.sets) {
      for (const s of data.sets) {
        this.sets.set(s.id, new SetConfig(s));
      }
    }

    // Import lenses
    if (data.lenses) {
      for (const l of data.lenses) {
        this.lenses.set(l.id, new LensConfig(l));
      }
    }

    // Import views (CORE_ARCHITECTURE.md)
    if (data.views) {
      for (const v of data.views) {
        this.views.set(v.id, new ViewConfig(v));
      }
    }

    // Import focuses (deprecated)
    if (data.focuses) {
      for (const f of data.focuses) {
        this.focuses.set(f.id, new FocusConfig(f));
      }
    }

    // Import exports
    if (data.exports) {
      for (const e of data.exports) {
        this.exports.set(e.id, new ExportConfig(e));
      }
    }

    // Restore active selections
    if (data.active) {
      this.activeProjectId = data.active.projectId;
      this.activeWorkspaceId = data.active.workspaceId;
      this.activeSetId = data.active.setId;
      this.activeLensId = data.active.lensId;
      this.activeViewId = data.active.viewId;  // CORE_ARCHITECTURE.md
      this.activeFocusId = data.active.focusId;  // Deprecated
    }
  }

  /**
   * Get statistics about the view hierarchy
   */
  getStats() {
    return {
      projects: this.projects.size,
      workspaces: this.workspaces.size,
      sets: this.sets.size,
      lenses: this.lenses.size,
      views: this.views.size,  // CORE_ARCHITECTURE.md
      focuses: this.focuses.size,  // Deprecated
      exports: this.exports.size,
      active: {
        projectId: this.activeProjectId,
        workspaceId: this.activeWorkspaceId,
        setId: this.activeSetId,
        lensId: this.activeLensId,
        viewId: this.activeViewId,  // CORE_ARCHITECTURE.md
        focusId: this.activeFocusId  // Deprecated
      }
    };
  }
}

// ============================================================================
// Singleton and Initialization
// ============================================================================

let _viewRegistry = null;

function getViewRegistry() {
  return _viewRegistry;
}

function initViewRegistry(horizonGate = null, eventStore = null) {
  _viewRegistry = new ViewRegistry(horizonGate, eventStore);
  return _viewRegistry;
}

// ============================================================================
// CORE_ARCHITECTURE.md Factory Methods
// ============================================================================

/**
 * Create a complete CORE_ARCHITECTURE.md compliant hierarchy from a null source.
 *
 * Per CORE_ARCHITECTURE.md "New Table" flow:
 * 1. NULL SOURCE created (sourceType: 'null')
 * 2. SET created (bound to null source via sourceBindings)
 * 3. DEFAULT LENS created (isDefault: true, pivot: null)
 * 4. GRID VIEW created (viewType: 'grid')
 *
 * @param {Object} options
 * @param {string} options.name - Name for the Set (Source will be "${name} Source")
 * @param {Object[]} options.fields - Initial field definitions (optional)
 * @param {string} options.actor - Who is creating this (default: 'system')
 * @param {string} options.projectId - Parent project ID (optional)
 * @returns {Object} { source, set, lens, view } - Complete hierarchy
 */
function createCompliantHierarchyFromScratch(options = {}) {
  const {
    name = 'Untitled Set',
    fields = [],
    actor = 'system',
    projectId = null
  } = options;

  const timestamp = new Date().toISOString();
  const sourceId = generateViewId('src');
  const setId = generateViewId('set');
  const lensId = generateViewId('lens');
  const viewId = generateViewId('view');

  // 1. Create null source (GIVEN - but sourceType: 'null' for manual entry)
  const source = {
    id: sourceId,
    type: 'given',
    category: 'source_created',
    timestamp,
    actor,
    payload: {
      name: `${name} Source`,
      sourceType: 'null',  // CORE_ARCHITECTURE.md compliant
      locator: null,
      rawSchema: {
        columns: fields.map(f => f.name),
        rowCount: 0
      }
    },
    provenance: []
  };

  // 2. Create Set with sourceBindings (MEANT - schema interpretation)
  const set = new SetConfig({
    id: setId,
    name,
    sourceBindings: [{ sourceId, mapping: 'direct' }],
    schema: {
      fields: fields.map(f => ({
        id: generateViewId('fld'),
        name: f.name,
        type: f.type || 'text',
        isPrimary: f.isPrimary || false,
        semanticBinding: null
      }))
    },
    provenance: { derivedFrom: [sourceId], createdAt: timestamp, createdBy: actor }
  });

  // 3. Create default Lens (MEANT - data slice)
  const lens = new LensConfig({
    id: lensId,
    name: `All ${name}`,
    setId,
    isDefault: true,
    pivot: null,  // Default = entire Set
    includedFields: 'all',
    provenance: { derivedFromSet: setId, purpose: 'default_data_slice' }
  });

  // 4. Create default Grid View (MEANT - visualization)
  const view = new ViewConfig({
    id: viewId,
    name: `${name} Grid`,
    lensId,
    viewType: 'grid',
    config: {
      visibleFields: set.schema.fields.map(f => f.id),
      rowHeight: 'medium'
    },
    provenance: { derivedFromLens: lensId, purpose: 'default_visualization' }
  });

  // Link the hierarchy
  set.lensIds.push(lensId);
  lens.viewIds.push(viewId);

  return {
    source,
    set,
    lens,
    view,
    // Event data for each creation (can be emitted to event store)
    events: [
      source,
      {
        id: generateViewId('evt'),
        type: 'meant',
        category: 'set_created',
        timestamp,
        actor,
        payload: set.toJSON(),
        provenance: [sourceId]
      },
      {
        id: generateViewId('evt'),
        type: 'meant',
        category: 'lens_created',
        timestamp,
        actor,
        payload: lens.toJSON(),
        provenance: [setId]
      },
      {
        id: generateViewId('evt'),
        type: 'meant',
        category: 'view_created',
        timestamp,
        actor,
        payload: view.toJSON(),
        provenance: [lensId]
      }
    ]
  };
}

/**
 * Create a CORE_ARCHITECTURE.md compliant Set with default Lens and View.
 *
 * Use this when you already have a Source and want to create a Set from it.
 *
 * @param {Object} options
 * @param {string} options.sourceId - ID of the Source to bind to
 * @param {string} options.name - Name for the Set
 * @param {Object[]} options.fields - Field definitions from the Source
 * @param {string} options.actor - Who is creating this
 * @returns {Object} { set, lens, view }
 */
function createSetWithDefaultLensAndView(options = {}) {
  const {
    sourceId,
    name = 'Untitled Set',
    fields = [],
    actor = 'system'
  } = options;

  if (!sourceId) {
    throw new ViewHierarchyError(7, 'Set requires sourceId for provenance');
  }

  const setId = generateViewId('set');
  const lensId = generateViewId('lens');
  const viewId = generateViewId('view');

  // Create Set with sourceBindings
  const set = new SetConfig({
    id: setId,
    name,
    sourceBindings: [{ sourceId, mapping: 'direct' }],
    schema: {
      fields: fields.map(f => ({
        id: f.id || generateViewId('fld'),
        name: f.name,
        type: f.type || 'text',
        isPrimary: f.isPrimary || false,
        semanticBinding: f.semanticBinding || null
      }))
    },
    provenance: { derivedFrom: [sourceId] }
  });

  // Create default Lens
  const lens = new LensConfig({
    id: lensId,
    name: `All ${name}`,
    setId,
    isDefault: true,
    pivot: null,
    includedFields: 'all',
    provenance: { derivedFromSet: setId }
  });

  // Create default Grid View
  const view = new ViewConfig({
    id: viewId,
    name: `${name} Grid`,
    lensId,
    viewType: 'grid',
    config: {
      visibleFields: set.schema.fields.map(f => f.id)
    },
    provenance: { derivedFromLens: lensId }
  });

  // Link the hierarchy
  set.lensIds.push(lensId);
  lens.viewIds.push(viewId);

  return { set, lens, view };
}

/**
 * Create a pivoted Lens with a default View.
 *
 * Per CORE_ARCHITECTURE.md, a Lens can be:
 * - Default (null pivot): Pass-through of entire Set
 * - Pivoted: Filtered, grouped, or extracted subset
 *
 * @param {Object} options
 * @param {string} options.setId - Parent Set ID
 * @param {string} options.name - Lens name
 * @param {Object} options.pivot - Pivot configuration { type: 'filter'|'group'|'extract', ... }
 * @param {string[]|'all'} options.includedFields - Which fields to include
 * @param {string} options.viewType - Default view type (default: 'grid')
 * @returns {Object} { lens, view }
 */
function createPivotedLensWithView(options = {}) {
  const {
    setId,
    name = 'Filtered View',
    pivot = null,
    includedFields = 'all',
    viewType = 'grid'
  } = options;

  if (!setId) {
    throw new ViewHierarchyError(7, 'Lens requires setId for provenance');
  }

  const lensId = generateViewId('lens');
  const viewId = generateViewId('view');

  // Create pivoted Lens
  const lens = new LensConfig({
    id: lensId,
    name,
    setId,
    isDefault: false,
    pivot,
    includedFields,
    provenance: { derivedFromSet: setId, purpose: pivot?.type || 'custom_slice' }
  });

  // Create View for this Lens
  const view = new ViewConfig({
    id: viewId,
    name: `${name} ${viewType.charAt(0).toUpperCase() + viewType.slice(1)}`,
    lensId,
    viewType,
    provenance: { derivedFromLens: lensId }
  });

  // Link
  lens.viewIds.push(viewId);

  return { lens, view };
}

/**
 * Validate that a view type is CORE_ARCHITECTURE.md compliant.
 *
 * Valid types: grid, cards, kanban, calendar, graph, timeline
 *
 * @param {string} viewType - The view type to validate
 * @returns {boolean} True if valid
 */
function isValidViewType(viewType) {
  const validTypes = ['grid', 'cards', 'kanban', 'calendar', 'graph', 'timeline'];
  return validTypes.includes(viewType);
}

/**
 * Validate that a source type is CORE_ARCHITECTURE.md compliant.
 *
 * Valid types: file, api, scrape, null
 *
 * @param {string} sourceType - The source type to validate
 * @returns {boolean} True if valid
 */
function isValidSourceType(sourceType) {
  const validTypes = ['file', 'api', 'scrape', 'null'];
  return validTypes.includes(sourceType);
}

/**
 * Validate that a pivot type is CORE_ARCHITECTURE.md compliant.
 *
 * Valid types: null (default), filter, group, extract
 *
 * @param {string|null} pivotType - The pivot type to validate
 * @returns {boolean} True if valid
 */
function isValidPivotType(pivotType) {
  const validTypes = [null, 'filter', 'group', 'extract'];
  return validTypes.includes(pivotType);
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Error handling
    ViewHierarchyError,
    ViewEpistemicStatus,

    // Legacy types (deprecated - use ViewType/PivotType from eo_types.js)
    LensType,
    LensTypeInfo,

    // CORE_ARCHITECTURE.md compliant types
    ViewTypeInfo,
    PivotTypeInfo,

    // Utilities
    generateViewId,

    // Config classes
    ProjectConfig,
    WorkspaceConfig,
    SetConfig,
    LensConfig,
    ViewConfig,      // CORE_ARCHITECTURE.md
    FocusConfig,     // Deprecated
    ExportConfig,

    // Registry
    ViewRegistry,
    getViewRegistry,
    initViewRegistry,

    // CORE_ARCHITECTURE.md Factory Methods
    createCompliantHierarchyFromScratch,
    createSetWithDefaultLensAndView,
    createPivotedLensWithView,

    // Validation helpers
    isValidViewType,
    isValidSourceType,
    isValidPivotType
  };
}

if (typeof window !== 'undefined') {
  // Error handling
  window.ViewHierarchyError = ViewHierarchyError;
  window.ViewEpistemicStatus = ViewEpistemicStatus;

  // Legacy types (deprecated)
  window.LensType = LensType;
  window.LensTypeInfo = LensTypeInfo;

  // CORE_ARCHITECTURE.md compliant types
  window.ViewTypeInfo = ViewTypeInfo;
  window.PivotTypeInfo = PivotTypeInfo;

  // Utilities
  window.generateViewId = generateViewId;

  // Config classes
  window.ProjectConfig = ProjectConfig;
  window.WorkspaceConfig = WorkspaceConfig;
  window.SetConfig = SetConfig;
  window.LensConfig = LensConfig;
  window.ViewConfig = ViewConfig;      // CORE_ARCHITECTURE.md
  window.FocusConfig = FocusConfig;     // Deprecated
  window.ExportConfig = ExportConfig;

  // Registry
  window.ViewRegistry = ViewRegistry;
  window.getViewRegistry = getViewRegistry;
  window.initViewRegistry = initViewRegistry;

  // CORE_ARCHITECTURE.md Factory Methods
  window.createCompliantHierarchyFromScratch = createCompliantHierarchyFromScratch;
  window.createSetWithDefaultLensAndView = createSetWithDefaultLensAndView;
  window.createPivotedLensWithView = createPivotedLensWithView;

  // Validation helpers
  window.isValidViewType = isValidViewType;
  window.isValidSourceType = isValidSourceType;
  window.isValidPivotType = isValidPivotType;
}
