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
// Lens Types (View Types)
// ============================================================================

const LensType = Object.freeze({
  GRID: 'grid',           // Tabular data display
  CARDS: 'cards',         // Visual entity browsing
  KANBAN: 'kanban',       // Status-based columns
  TIMELINE: 'timeline',   // Chronological ordering
  CALENDAR: 'calendar',   // Date-positioned events
  GRAPH: 'graph'          // Relationship networks
});

const LensTypeInfo = {
  [LensType.GRID]: { icon: 'ph-table', label: 'Grid', description: 'Tabular data display' },
  [LensType.CARDS]: { icon: 'ph-cards', label: 'Cards', description: 'Visual entity browsing' },
  [LensType.KANBAN]: { icon: 'ph-kanban', label: 'Kanban', description: 'Status-based columns' },
  [LensType.TIMELINE]: { icon: 'ph-timeline', label: 'Timeline', description: 'Chronological ordering' },
  [LensType.CALENDAR]: { icon: 'ph-calendar-blank', label: 'Calendar', description: 'Date-positioned events' },
  [LensType.GRAPH]: { icon: 'ph-graph', label: 'Graph', description: 'Relationship networks' }
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
   * @param {Object} options
   * @param {string} options.id - Unique identifier
   * @param {string} options.name - Human-readable name
   * @param {string} options.workspaceId - Parent workspace ID
   * @param {Object} options.schema - Field definitions
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

    // Schema is an interpretation of entity structure
    this.schema = {
      fields: options.schema?.fields || []
    };

    // Rule 6: Coherence constraints
    this.coherenceRules = {
      includeTypes: options.coherenceRules?.includeTypes || [],
      excludeDeleted: options.coherenceRules?.excludeDeleted !== false
    };

    // Rule 7: Provenance chain
    this.provenance = {
      derivedFrom: options.provenance?.derivedFrom || [],
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

  toJSON() {
    return {
      type: this.type,
      viewType: this.viewType,
      id: this.id,
      name: this.name,
      workspaceId: this.workspaceId,
      icon: this.icon,
      schema: { fields: [...this.schema.fields] },
      coherenceRules: { ...this.coherenceRules },
      provenance: { ...this.provenance },
      epistemicStatus: this.epistemicStatus,
      supersedes: this.supersedes,
      supersededBy: this.supersededBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      records: this.records,
      lensIds: [...this.lensIds]
    };
  }
}

// ============================================================================
// Level 3: Lens (View Type Perspective)
// ============================================================================

class LensConfig {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique identifier
   * @param {string} options.name - Human-readable name
   * @param {string} options.setId - Parent set ID
   * @param {string} options.lensType - One of LensType
   * @param {Object} options.config - Lens-specific configuration
   * @param {Object} options.display - Visual settings
   * @param {Object} options.provenance - Provenance tracking
   */
  constructor(options) {
    // Rule 1: Explicitly typed as 'meant'
    this.type = 'meant';
    this.viewType = 'lens';

    this.id = options.id || generateViewId('lens');
    this.name = options.name || 'Untitled View';
    this.setId = options.setId || null;
    this.lensType = options.lensType || LensType.GRID;

    // Lens-specific configuration
    this.config = {
      // Common config
      filters: options.config?.filters || [],
      sorts: options.config?.sorts || [],
      hiddenFields: options.config?.hiddenFields || [],
      fieldOrder: options.config?.fieldOrder || [],

      // Type-specific config
      groupByField: options.config?.groupByField || null,
      cardTitleField: options.config?.cardTitleField || null,
      cardDescriptionField: options.config?.cardDescriptionField || null,
      columnOrder: options.config?.columnOrder || [],
      dateField: options.config?.dateField || null,
      showEmptyColumns: options.config?.showEmptyColumns !== false,

      // Additional settings
      ...options.config
    };

    // Visual settings
    this.display = {
      columnWidth: options.display?.columnWidth || 200,
      cardHeight: options.display?.cardHeight || 'auto',
      showFieldLabels: options.display?.showFieldLabels !== false
    };

    // Rule 7: Provenance
    this.provenance = {
      derivedFromSet: options.setId || options.provenance?.derivedFromSet || null,
      derivedFromLens: options.provenance?.derivedFromLens || null,
      purpose: options.provenance?.purpose || 'data_visualization'
    };

    // Rule 8: Determinacy at minimal horizon
    this.frame = {
      purpose: options.frame?.purpose || 'data_visualization',
      epistemicStatus: options.frame?.epistemicStatus || ViewEpistemicStatus.PRELIMINARY
    };

    // Rule 9: Defeasibility
    this.epistemicStatus = options.epistemicStatus || ViewEpistemicStatus.PRELIMINARY;
    this.supersedes = options.supersedes || null;
    this.supersededBy = options.supersededBy || null;

    // Timestamps
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || new Date().toISOString();

    // Child focuses
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
      lensType: this.lensType,
      config: { ...this.config },
      display: { ...this.display },
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
// Level 4: Focus (Filtered Perspective)
// ============================================================================

class FocusConfig {
  /**
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
    this.focuses = new Map();
    this.exports = new Map();

    // Active selections
    this.activeProjectId = null;   // Currently selected project
    this.activeWorkspaceId = null;
    this.activeSetId = null;
    this.activeLensId = null;
    this.activeFocusId = null;

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
   */
  createSet(config, workspaceId, provenance = []) {
    // Rule 7: Must have provenance
    if (!provenance || provenance.length === 0) {
      throw new ViewHierarchyError(7, 'Set requires provenance');
    }

    const set = new SetConfig({
      ...config,
      workspaceId,
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

    return set;
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
   */
  createLens(config, setId) {
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
  // Focus Operations
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
      version: '1.1',
      exportedAt: new Date().toISOString(),
      projects: Array.from(this.projects.values()).map(p => p.toJSON()),
      workspaces: Array.from(this.workspaces.values()).map(w => w.toJSON()),
      sets: Array.from(this.sets.values()).map(s => s.toJSON()),
      lenses: Array.from(this.lenses.values()).map(l => l.toJSON()),
      focuses: Array.from(this.focuses.values()).map(f => f.toJSON()),
      exports: Array.from(this.exports.values()).map(e => e.toJSON()),
      active: {
        projectId: this.activeProjectId,
        workspaceId: this.activeWorkspaceId,
        setId: this.activeSetId,
        lensId: this.activeLensId,
        focusId: this.activeFocusId
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

    // Import focuses
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
      this.activeFocusId = data.active.focusId;
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
      focuses: this.focuses.size,
      exports: this.exports.size,
      active: {
        projectId: this.activeProjectId,
        workspaceId: this.activeWorkspaceId,
        setId: this.activeSetId,
        lensId: this.activeLensId,
        focusId: this.activeFocusId
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
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ViewHierarchyError,
    ViewEpistemicStatus,
    LensType,
    LensTypeInfo,
    generateViewId,
    ProjectConfig,
    WorkspaceConfig,
    SetConfig,
    LensConfig,
    FocusConfig,
    ExportConfig,
    ViewRegistry,
    getViewRegistry,
    initViewRegistry
  };
}

if (typeof window !== 'undefined') {
  window.ViewHierarchyError = ViewHierarchyError;
  window.ViewEpistemicStatus = ViewEpistemicStatus;
  window.LensType = LensType;
  window.LensTypeInfo = LensTypeInfo;
  window.generateViewId = generateViewId;
  window.ProjectConfig = ProjectConfig;
  window.WorkspaceConfig = WorkspaceConfig;
  window.SetConfig = SetConfig;
  window.LensConfig = LensConfig;
  window.FocusConfig = FocusConfig;
  window.ExportConfig = ExportConfig;
  window.ViewRegistry = ViewRegistry;
  window.getViewRegistry = getViewRegistry;
  window.initViewRegistry = initViewRegistry;
}
