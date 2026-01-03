/**
 * EO Hierarchy - Clean Implementation of SOURCE → SET → LENS → VIEW
 *
 * Based on CORE_ARCHITECTURE.md - The canonical reference for Lakṣaṇa.
 *
 * The Core Principle:
 * - GIVEN: What actually happened. Immutable. Cannot be edited, only appended.
 * - MEANT: What you think it means. Revisable. Can be superseded, refined, discarded.
 *
 * The Chain (always exists, even for blank tables):
 *   PROJECT → SOURCE → SET → LENS → VIEW
 *
 * | Component  | Epistemic Status | What It Is                              |
 * |------------|------------------|-----------------------------------------|
 * | Project    | MEANT            | Organizational container                |
 * | Source     | GIVEN            | Immutable import origin. Always exists. |
 * | Definition | MEANT            | Vocabulary for semantic grounding       |
 * | Set        | GIVEN + MEANT    | Flat data + typed schema               |
 * | Lens       | MEANT            | Data slice. Default or pivoted.         |
 * | View       | MEANT            | Visualization. Where you work.          |
 *
 * Key Behaviors:
 * - When a Set is created → auto-create default Lens
 * - When a Lens is created → auto-create default Grid View
 * - Every component has provenance tracking back to GIVEN events
 */

// ============================================================================
// ID Generation
// ============================================================================

function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

// ============================================================================
// View Types (per CORE_ARCHITECTURE.md)
// ============================================================================

/**
 * Available view types and their metadata
 */
const ViewTypes = Object.freeze({
  GRID: 'grid',
  CARDS: 'cards',
  KANBAN: 'kanban',
  CALENDAR: 'calendar',
  GRAPH: 'graph',
  TIMELINE: 'timeline'
});

const ViewTypeInfo = Object.freeze({
  [ViewTypes.GRID]: {
    icon: 'ph-table',
    label: 'Grid',
    description: 'Spreadsheet rows/columns for general editing'
  },
  [ViewTypes.CARDS]: {
    icon: 'ph-cards',
    label: 'Cards',
    description: 'Visual cards with field preview'
  },
  [ViewTypes.KANBAN]: {
    icon: 'ph-kanban',
    label: 'Kanban',
    description: 'Columns by status field'
  },
  [ViewTypes.CALENDAR]: {
    icon: 'ph-calendar-blank',
    label: 'Calendar',
    description: 'Events on date grid'
  },
  [ViewTypes.GRAPH]: {
    icon: 'ph-graph',
    label: 'Graph',
    description: 'Nodes and edges for relationships'
  },
  [ViewTypes.TIMELINE]: {
    icon: 'ph-timeline',
    label: 'Timeline',
    description: 'Chronological ordering'
  }
});

// ============================================================================
// Pivot Types (for Lenses per CORE_ARCHITECTURE.md)
// ============================================================================

/**
 * Pivot types determine how a Lens slices data
 * - null: Default lens, all records, all columns
 * - filter: Only rows matching predicate
 * - group: One row per unique value
 * - extract: Pull record type from JSON
 */
const PivotTypes = Object.freeze({
  NONE: null,
  FILTER: 'filter',
  GROUP: 'group',
  EXTRACT: 'extract'
});

// ============================================================================
// Source Types (per CORE_ARCHITECTURE.md)
// ============================================================================

/**
 * Source types distinguish origin of data
 */
const SourceTypes = Object.freeze({
  FILE: 'file',     // CSV, JSON, Excel uploaded
  API: 'api',       // External system connected
  RSS: 'rss',       // RSS/Atom feed subscription
  SCRAPE: 'scrape', // Web data captured
  NULL: 'null'      // Empty origin for user-created tables
});

// ============================================================================
// SOURCE - The Origin of Data (GIVEN)
// ============================================================================

/**
 * Create a Source from imported data
 *
 * Sources are GIVEN events - immutable import origins.
 * Even blank tables have a Source (null source).
 *
 * @param {Object} config
 * @param {string} config.name - Source name
 * @param {string} config.projectId - Parent project ID
 * @param {string} config.sourceType - One of SourceTypes
 * @param {Object} config.locator - File path, API URL, etc.
 * @param {Object[]} config.rawSchema - Inferred columns
 * @param {Object[]} config.records - Raw imported records
 * @param {string} config.actor - Who created this (auto-populated if not provided)
 * @returns {Object} Source object
 */
function createSource(config) {
  const {
    name,
    projectId,
    sourceType = SourceTypes.FILE,
    locator = null,
    rawSchema = { columns: [], rowCount: 0 },
    records = [],
    actor = 'current_user'
  } = config;

  const id = generateId('src');
  const timestamp = new Date().toISOString();

  const source = {
    id,
    type: 'given',
    category: 'source_created',
    projectId,
    timestamp,
    actor,
    payload: {
      name,
      sourceType,
      locator,
      rawSchema: {
        columns: rawSchema.columns || Object.keys(records[0] || {}),
        rowCount: rawSchema.rowCount || records.length
      }
    },
    // Immutable record storage
    records: Object.freeze([...records]),
    recordCount: records.length,
    // Derived sets
    derivedSetIds: [],
    status: 'active'
  };

  return Object.freeze(source);
}

/**
 * Create a null Source for blank tables
 *
 * Per CORE_ARCHITECTURE.md: Even a blank table has a Source - a null Source
 * that receives data as the user types.
 */
function createNullSource(config) {
  const { name, projectId, actor = 'current_user' } = config;

  return createSource({
    name: name || 'Untitled Table',
    projectId,
    sourceType: SourceTypes.NULL,
    locator: null,
    rawSchema: { columns: [], rowCount: 0 },
    records: [],
    actor
  });
}

// ============================================================================
// SET - Flat Data with Typed Schema (GIVEN + MEANT)
// ============================================================================

/**
 * Create a Set from a Source
 *
 * Per CORE_ARCHITECTURE.md:
 * - A Set always binds to at least one Source
 * - Fields can optionally bind to Definitions for semantic grounding
 * - When a Set is created, a default Lens is auto-created
 *
 * @param {Object} config
 * @param {string} config.name - Set name
 * @param {string} config.projectId - Parent project ID
 * @param {string} config.sourceId - Source this Set derives from
 * @param {Object[]} config.fields - Field definitions
 * @param {Object[]} config.records - Transformed records with field IDs
 * @param {string} config.actor - Who created this
 * @returns {Object} { set, defaultLens, defaultView }
 */
function createSet(config) {
  const {
    name,
    projectId,
    sourceId,
    fields = [],
    records = [],
    actor = 'current_user'
  } = config;

  const setId = generateId('set');
  const timestamp = new Date().toISOString();

  // Build field definitions with proper structure
  const schemaFields = fields.map((field, index) => ({
    id: field.id || generateId('fld'),
    name: field.name,
    type: field.type || 'text',
    isPrimary: field.isPrimary || index === 0,
    sourceColumn: field.sourceColumn || field.name,
    width: field.width || 200,
    options: field.options || {},
    // Semantic binding to Definition (optional)
    semanticBinding: field.semanticBinding || null
  }));

  // Transform records to use field IDs
  const transformedRecords = records.map((record, index) => ({
    id: record.id || generateId('rec'),
    setId,
    values: schemaFields.reduce((acc, field) => {
      acc[field.id] = record[field.sourceColumn] ?? record[field.name] ?? null;
      return acc;
    }, {}),
    createdAt: timestamp,
    updatedAt: timestamp,
    _sourceIndex: index
  }));

  // Create the Set
  const set = {
    id: setId,
    type: 'meant',
    category: 'set_created',
    projectId,
    timestamp,
    actor,
    payload: {
      name,
      sourceBindings: [{ sourceId, mapping: 'direct' }],
      schema: { fields: schemaFields }
    },
    provenance: [sourceId],

    // Data
    records: transformedRecords,
    recordCount: transformedRecords.length,

    // Child references (populated by createDefaultLens)
    lensIds: [],
    viewIds: []
  };

  // CORE_ARCHITECTURE.md: Auto-create default Lens when Set is created
  const { lens: defaultLens, view: defaultView } = createDefaultLens({
    name: `All ${name}`,
    setId,
    projectId,
    fields: schemaFields,
    actor
  });

  // Link the lens to the set
  set.lensIds.push(defaultLens.id);

  return { set, defaultLens, defaultView };
}

/**
 * Create a Set from scratch (blank table)
 *
 * Per CORE_ARCHITECTURE.md Quick Start Flow:
 * 1. NULL SOURCE created
 * 2. SET created (bound to null source)
 * 3. DEFAULT LENS created
 * 4. GRID VIEW created
 */
function createSetFromScratch(config) {
  const {
    name = 'Untitled Table',
    projectId,
    fields = [{ name: 'Name', type: 'text' }],
    actor = 'current_user'
  } = config;

  // Step 1: Create null source
  const source = createNullSource({ name: `${name} (source)`, projectId, actor });

  // Step 2-4: Create set with default lens and view
  const { set, defaultLens, defaultView } = createSet({
    name,
    projectId,
    sourceId: source.id,
    fields,
    records: [],
    actor
  });

  return { source, set, defaultLens, defaultView };
}

// ============================================================================
// LENS - Data Slice (MEANT)
// ============================================================================

/**
 * Create a Lens from a Set
 *
 * Per CORE_ARCHITECTURE.md:
 * - Default: Pass-through of entire Set (most common)
 * - Pivoted: Filtered to record type, grouped by column, or extracted subset
 * - When a Lens is created, a default Grid View is auto-created
 *
 * @param {Object} config
 * @param {string} config.name - Lens name
 * @param {string} config.setId - Parent Set ID
 * @param {string} config.projectId - Parent project ID
 * @param {boolean} config.isDefault - Is this the default lens?
 * @param {Object} config.pivot - Pivot configuration (null for default)
 * @param {string[]|'all'} config.includedFields - Which fields to include
 * @param {Object} config.fieldOverrides - Per-field overrides for this lens
 * @param {Object} config.selector - Multi-lens membership selector
 * @param {string} config.actor - Who created this
 * @returns {Object} { lens, view }
 */
function createLens(config) {
  const {
    name,
    setId,
    projectId,
    isDefault = false,
    pivot = null,
    includedFields = 'all',
    fieldOverrides = {},
    selector = null,
    fields = [],
    actor = 'current_user'
  } = config;

  const lensId = generateId('lens');
  const timestamp = new Date().toISOString();

  const lens = {
    id: lensId,
    type: 'meant',
    category: 'lens_created',
    projectId,
    timestamp,
    actor,
    payload: {
      name,
      setId,
      isDefault,
      pivot,
      includedFields,
      // DESIGN_LENS_SYSTEM.md: Field overrides for type-scoped customization
      fieldOverrides,
      // DESIGN_LENS_SYSTEM.md: Selector for multi-lens membership
      selector
    },
    provenance: [setId],

    // Child view references
    viewIds: []
  };

  // CORE_ARCHITECTURE.md: Auto-create default Grid View when Lens is created
  const view = createView({
    name: `${name} Grid`,
    lensId,
    projectId,
    viewType: ViewTypes.GRID,
    config: {
      visibleFields: includedFields === 'all'
        ? fields.map(f => f.id)
        : includedFields
    },
    actor
  });

  lens.viewIds.push(view.id);

  return { lens, view };
}

/**
 * Create the default Lens for a Set (pass-through, all data)
 */
function createDefaultLens(config) {
  return createLens({
    ...config,
    isDefault: true,
    pivot: null,
    includedFields: 'all'
  });
}

/**
 * Create a type-scoped Lens (per DESIGN_LENS_SYSTEM.md)
 *
 * A Lens scoped to a specific record type with its own refined schema.
 *
 * @param {Object} config
 * @param {string} config.name - Lens name
 * @param {string} config.setId - Parent Set ID
 * @param {string} config.projectId - Parent project ID
 * @param {string} config.typeField - Field containing record type
 * @param {string} config.typeValue - Value to match for this type
 * @param {string[]} config.includedFields - Fields to include
 * @param {Object} config.fieldOverrides - Type-specific field customization
 */
function createTypeScopedLens(config) {
  const {
    name,
    setId,
    projectId,
    typeField,
    typeValue,
    includedFields,
    fieldOverrides = {},
    icon = null,
    actor = 'current_user'
  } = config;

  return createLens({
    name,
    setId,
    projectId,
    isDefault: false,
    pivot: {
      type: 'filter',
      predicate: { field: typeField, op: 'eq', value: typeValue }
    },
    includedFields,
    fieldOverrides,
    selector: {
      type: 'field_match',
      fieldId: typeField,
      operator: 'is',
      value: typeValue
    },
    metadata: { icon, recordType: typeValue },
    actor
  });
}

// ============================================================================
// VIEW - Visualization (MEANT)
// ============================================================================

/**
 * Create a View for a Lens
 *
 * Per CORE_ARCHITECTURE.md:
 * - Views are where you work (edit, filter, sort)
 * - View types: Grid, Cards, Kanban, Calendar, Graph
 * - A View answers: "How do I want to see this Lens?"
 *
 * @param {Object} config
 * @param {string} config.name - View name
 * @param {string} config.lensId - Parent Lens ID
 * @param {string} config.projectId - Parent project ID
 * @param {string} config.viewType - One of ViewTypes
 * @param {Object} config.config - View-specific configuration
 * @param {string} config.actor - Who created this
 * @returns {Object} View object
 */
function createView(config) {
  const {
    name,
    lensId,
    projectId,
    viewType = ViewTypes.GRID,
    config: viewConfig = {},
    actor = 'current_user'
  } = config;

  const viewId = generateId('view');
  const timestamp = new Date().toISOString();

  const view = {
    id: viewId,
    type: 'meant',
    category: 'view_created',
    projectId,
    timestamp,
    actor,
    payload: {
      name,
      lensId,
      viewType,
      config: buildViewConfig(viewType, viewConfig)
    },
    provenance: [lensId]
  };

  return view;
}

/**
 * Build view-specific configuration based on view type
 */
function buildViewConfig(viewType, userConfig) {
  const baseConfig = {
    visibleFields: userConfig.visibleFields || [],
    filters: userConfig.filters || [],
    sort: userConfig.sort || []
  };

  switch (viewType) {
    case ViewTypes.GRID:
      return {
        ...baseConfig,
        fieldWidths: userConfig.fieldWidths || {},
        rowHeight: userConfig.rowHeight || 'medium'
      };

    case ViewTypes.CARDS:
      return {
        ...baseConfig,
        cardTitleField: userConfig.cardTitleField || null,
        cardDescriptionField: userConfig.cardDescriptionField || null,
        cardImageField: userConfig.cardImageField || null,
        cardPreviewFields: userConfig.cardPreviewFields || []
      };

    case ViewTypes.KANBAN:
      return {
        ...baseConfig,
        statusField: userConfig.statusField || null,
        columnOrder: userConfig.columnOrder || [],
        cardTitleField: userConfig.cardTitleField || null
      };

    case ViewTypes.CALENDAR:
      return {
        ...baseConfig,
        dateField: userConfig.dateField || null,
        endDateField: userConfig.endDateField || null,
        eventTitleField: userConfig.eventTitleField || null
      };

    case ViewTypes.GRAPH:
      return {
        ...baseConfig,
        linkFields: userConfig.linkFields || [],
        nodeLabel: userConfig.nodeLabel || null,
        nodeColorField: userConfig.nodeColorField || null,
        layout: userConfig.layout || 'dagre'
      };

    case ViewTypes.TIMELINE:
      return {
        ...baseConfig,
        dateField: userConfig.dateField || null,
        titleField: userConfig.titleField || null
      };

    default:
      return baseConfig;
  }
}

// ============================================================================
// HIERARCHY MANAGER - Coordinates All Creation
// ============================================================================

/**
 * HierarchyManager - Central coordinator for SOURCE → SET → LENS → VIEW chain
 *
 * Manages the complete hierarchy as specified in CORE_ARCHITECTURE.md.
 * Ensures the chain always exists and maintains proper provenance.
 */
class HierarchyManager {
  constructor(eventStore = null) {
    this.eventStore = eventStore;

    // Storage
    this.sources = new Map();
    this.sets = new Map();
    this.lenses = new Map();
    this.views = new Map();

    // Active selections
    this.activeProjectId = null;
    this.activeSetId = null;
    this.activeLensId = null;
    this.activeViewId = null;

    // Subscribers
    this._subscribers = new Set();
  }

  // --------------------------------------------------------------------------
  // SOURCE Operations
  // --------------------------------------------------------------------------

  /**
   * Create a Source from imported data
   */
  createSource(config) {
    const source = createSource(config);
    this.sources.set(source.id, source);
    this._recordEvent('source_created', source);
    this._notify('source_created', source);
    return source;
  }

  /**
   * Create a null Source for blank tables
   */
  createNullSource(config) {
    const source = createNullSource(config);
    this.sources.set(source.id, source);
    this._recordEvent('source_created', source);
    this._notify('source_created', source);
    return source;
  }

  getSource(sourceId) {
    return this.sources.get(sourceId);
  }

  getAllSources() {
    return Array.from(this.sources.values()).filter(s => s.status === 'active');
  }

  // --------------------------------------------------------------------------
  // SET Operations
  // --------------------------------------------------------------------------

  /**
   * Create a Set from a Source
   *
   * Per CORE_ARCHITECTURE.md, this automatically creates:
   * - Default Lens (pass-through)
   * - Default Grid View
   */
  createSet(config) {
    // Ensure source exists
    const source = this.sources.get(config.sourceId);
    if (!source) {
      throw new Error(`Source not found: ${config.sourceId}`);
    }

    const { set, defaultLens, defaultView } = createSet(config);

    // Store all entities
    this.sets.set(set.id, set);
    this.lenses.set(defaultLens.id, defaultLens);
    this.views.set(defaultView.id, defaultView);

    // Register derived set with source
    this._registerDerivedSet(config.sourceId, set.id);

    // Record events
    this._recordEvent('set_created', set);
    this._recordEvent('lens_created', defaultLens);
    this._recordEvent('view_created', defaultView);

    // Notify
    this._notify('set_created', { set, defaultLens, defaultView });

    return { set, defaultLens, defaultView };
  }

  /**
   * Create a Set from scratch (blank table)
   *
   * Creates the complete chain: NULL SOURCE → SET → LENS → VIEW
   */
  createSetFromScratch(config) {
    const { source, set, defaultLens, defaultView } = createSetFromScratch(config);

    // Store all entities
    this.sources.set(source.id, source);
    this.sets.set(set.id, set);
    this.lenses.set(defaultLens.id, defaultLens);
    this.views.set(defaultView.id, defaultView);

    // Record events
    this._recordEvent('source_created', source);
    this._recordEvent('set_created', set);
    this._recordEvent('lens_created', defaultLens);
    this._recordEvent('view_created', defaultView);

    // Notify
    this._notify('scratch_set_created', { source, set, defaultLens, defaultView });

    return { source, set, defaultLens, defaultView };
  }

  getSet(setId) {
    return this.sets.get(setId);
  }

  getAllSets() {
    return Array.from(this.sets.values());
  }

  getSetsForProject(projectId) {
    return this.getAllSets().filter(s => s.projectId === projectId);
  }

  // --------------------------------------------------------------------------
  // LENS Operations
  // --------------------------------------------------------------------------

  /**
   * Create a Lens for a Set
   *
   * Automatically creates a default Grid View
   */
  createLens(config) {
    const set = this.sets.get(config.setId);
    if (!set) {
      throw new Error(`Set not found: ${config.setId}`);
    }

    // Pass fields from set for view configuration
    const fields = set.payload.schema.fields;

    const { lens, view } = createLens({ ...config, fields });

    // Store
    this.lenses.set(lens.id, lens);
    this.views.set(view.id, view);

    // Update parent set
    set.lensIds = set.lensIds || [];
    set.lensIds.push(lens.id);

    // Record events
    this._recordEvent('lens_created', lens);
    this._recordEvent('view_created', view);

    // Notify
    this._notify('lens_created', { lens, view });

    return { lens, view };
  }

  /**
   * Create type-scoped Lenses from multi-record analysis
   *
   * Per DESIGN_LENS_SYSTEM.md: When importing data with multiple record types,
   * create a Lens per type with refined schema.
   */
  createTypeScopedLenses(config) {
    const {
      setId,
      projectId,
      typeField,
      types,
      actor = 'current_user'
    } = config;

    const results = [];

    for (const typeInfo of types) {
      const { lens, view } = createTypeScopedLens({
        name: this._formatTypeName(typeInfo.value),
        setId,
        projectId,
        typeField,
        typeValue: typeInfo.value,
        includedFields: [
          ...typeInfo.commonFields || [],
          ...typeInfo.specificFields || []
        ],
        icon: this._getIconForType(typeInfo.value),
        actor
      });

      this.lenses.set(lens.id, lens);
      this.views.set(view.id, view);

      // Update parent set
      const set = this.sets.get(setId);
      if (set) {
        set.lensIds = set.lensIds || [];
        set.lensIds.push(lens.id);
      }

      results.push({ lens, view, typeInfo });
    }

    this._notify('type_lenses_created', results);
    return results;
  }

  getLens(lensId) {
    return this.lenses.get(lensId);
  }

  getLensesForSet(setId) {
    return Array.from(this.lenses.values())
      .filter(l => l.payload.setId === setId);
  }

  getDefaultLensForSet(setId) {
    return this.getLensesForSet(setId).find(l => l.payload.isDefault);
  }

  // --------------------------------------------------------------------------
  // VIEW Operations
  // --------------------------------------------------------------------------

  /**
   * Create a View for a Lens
   */
  createView(config) {
    const lens = this.lenses.get(config.lensId);
    if (!lens) {
      throw new Error(`Lens not found: ${config.lensId}`);
    }

    const view = createView(config);

    // Store
    this.views.set(view.id, view);

    // Update parent lens
    lens.viewIds = lens.viewIds || [];
    lens.viewIds.push(view.id);

    // Record event
    this._recordEvent('view_created', view);

    // Notify
    this._notify('view_created', view);

    return view;
  }

  /**
   * Update a View's configuration
   */
  updateView(viewId, updates) {
    const view = this.views.get(viewId);
    if (!view) {
      throw new Error(`View not found: ${viewId}`);
    }

    // Apply updates
    if (updates.name !== undefined) {
      view.payload.name = updates.name;
    }
    if (updates.viewType !== undefined) {
      view.payload.viewType = updates.viewType;
    }
    if (updates.config !== undefined) {
      view.payload.config = {
        ...view.payload.config,
        ...updates.config
      };
    }

    view.updatedAt = new Date().toISOString();

    this._recordEvent('view_updated', view);
    this._notify('view_updated', view);

    return view;
  }

  getView(viewId) {
    return this.views.get(viewId);
  }

  getViewsForLens(lensId) {
    return Array.from(this.views.values())
      .filter(v => v.payload.lensId === lensId);
  }

  getAllViews() {
    return Array.from(this.views.values());
  }

  // --------------------------------------------------------------------------
  // Active Selection
  // --------------------------------------------------------------------------

  setActiveSet(setId) {
    if (setId && !this.sets.has(setId)) {
      throw new Error(`Set not found: ${setId}`);
    }
    this.activeSetId = setId;
    this._notify('set_activated', this.sets.get(setId));
  }

  setActiveLens(lensId) {
    if (lensId && !this.lenses.has(lensId)) {
      throw new Error(`Lens not found: ${lensId}`);
    }
    this.activeLensId = lensId;
    this._notify('lens_activated', this.lenses.get(lensId));
  }

  setActiveView(viewId) {
    if (viewId && !this.views.has(viewId)) {
      throw new Error(`View not found: ${viewId}`);
    }
    this.activeViewId = viewId;
    this._notify('view_activated', this.views.get(viewId));
  }

  // --------------------------------------------------------------------------
  // Navigation Helpers
  // --------------------------------------------------------------------------

  /**
   * Get the full chain for a View: Source → Set → Lens → View
   */
  getChainForView(viewId) {
    const view = this.views.get(viewId);
    if (!view) return null;

    const lens = this.lenses.get(view.payload.lensId);
    if (!lens) return null;

    const set = this.sets.get(lens.payload.setId);
    if (!set) return null;

    const sourceId = set.payload.sourceBindings?.[0]?.sourceId;
    const source = this.sources.get(sourceId);

    return { source, set, lens, view };
  }

  /**
   * Navigate to a View and set all active selections
   */
  navigateToView(viewId) {
    const chain = this.getChainForView(viewId);
    if (!chain) return null;

    this.activeSetId = chain.set.id;
    this.activeLensId = chain.lens.id;
    this.activeViewId = chain.view.id;

    this._notify('navigation_changed', chain);
    return chain;
  }

  // --------------------------------------------------------------------------
  // Import Helpers
  // --------------------------------------------------------------------------

  /**
   * Import data and create the complete hierarchy
   *
   * This is the main entry point for file imports.
   * Creates: SOURCE → SET → LENS → VIEW
   *
   * @param {Object} config
   * @param {string} config.name - Name for the set
   * @param {string} config.projectId - Parent project ID
   * @param {Object[]} config.records - Raw imported records
   * @param {Object[]} config.schema - Inferred schema (fields)
   * @param {Object} config.sourceMetadata - File info, locator, etc.
   * @param {Object} config.multiRecordAnalysis - If multiple record types detected
   * @param {string} config.actor - Who is importing
   */
  importData(config) {
    const {
      name,
      projectId,
      records,
      schema,
      sourceMetadata = {},
      multiRecordAnalysis = null,
      actor = 'current_user'
    } = config;

    // Step 1: Create Source
    const source = this.createSource({
      name: sourceMetadata.filename || name,
      projectId,
      sourceType: SourceTypes.FILE,
      locator: sourceMetadata.locator || null,
      rawSchema: {
        columns: schema.fields.map(f => f.name),
        rowCount: records.length
      },
      records,
      actor
    });

    // Step 2: Create Set with default Lens and View
    const { set, defaultLens, defaultView } = this.createSet({
      name,
      projectId,
      sourceId: source.id,
      fields: schema.fields,
      records,
      actor
    });

    // Step 3: If multi-record types, create type-scoped Lenses
    let typeLenses = [];
    if (multiRecordAnalysis && multiRecordAnalysis.types?.length > 1) {
      typeLenses = this.createTypeScopedLenses({
        setId: set.id,
        projectId,
        typeField: multiRecordAnalysis.typeField,
        types: multiRecordAnalysis.types,
        actor
      });
    }

    return {
      source,
      set,
      defaultLens,
      defaultView,
      typeLenses
    };
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  /**
   * Export all data for storage
   */
  export() {
    return {
      version: '3.0',
      exportedAt: new Date().toISOString(),
      sources: Array.from(this.sources.values()),
      sets: Array.from(this.sets.values()),
      lenses: Array.from(this.lenses.values()),
      views: Array.from(this.views.values()),
      active: {
        setId: this.activeSetId,
        lensId: this.activeLensId,
        viewId: this.activeViewId
      }
    };
  }

  /**
   * Import data from storage
   */
  import(data) {
    if (!data) return;

    // Import sources
    if (data.sources) {
      for (const source of data.sources) {
        this.sources.set(source.id, source);
      }
    }

    // Import sets
    if (data.sets) {
      for (const set of data.sets) {
        this.sets.set(set.id, set);
      }
    }

    // Import lenses
    if (data.lenses) {
      for (const lens of data.lenses) {
        this.lenses.set(lens.id, lens);
      }
    }

    // Import views
    if (data.views) {
      for (const view of data.views) {
        this.views.set(view.id, view);
      }
    }

    // Restore active selections
    if (data.active) {
      this.activeSetId = data.active.setId;
      this.activeLensId = data.active.lensId;
      this.activeViewId = data.active.viewId;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      sources: this.sources.size,
      sets: this.sets.size,
      lenses: this.lenses.size,
      views: this.views.size
    };
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  _registerDerivedSet(sourceId, setId) {
    const source = this.sources.get(sourceId);
    if (source && source.derivedSetIds) {
      // Sources are frozen, so we need to create a new object
      const updatedSource = {
        ...source,
        derivedSetIds: [...source.derivedSetIds, setId]
      };
      this.sources.set(sourceId, Object.freeze(updatedSource));
    }
  }

  _formatTypeName(value) {
    if (!value) return 'Unknown';
    return String(value)
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  _getIconForType(value) {
    const typeIcons = {
      person: 'ph-user',
      people: 'ph-users',
      user: 'ph-user',
      company: 'ph-building-office',
      organization: 'ph-building-office',
      product: 'ph-package',
      event: 'ph-calendar',
      task: 'ph-check-square',
      note: 'ph-note',
      document: 'ph-file-text'
    };
    const normalized = String(value || '').toLowerCase();
    return typeIcons[normalized] || 'ph-circle';
  }

  _recordEvent(category, payload) {
    if (!this.eventStore?.append) return;

    try {
      this.eventStore.append({
        id: generateId('evt'),
        type: payload.type || 'meant',
        category,
        timestamp: new Date().toISOString(),
        actor: payload.actor || 'system',
        payload: typeof payload.toJSON === 'function' ? payload.toJSON() : payload,
        provenance: payload.provenance || []
      });
    } catch (e) {
      console.warn('Failed to record event:', e);
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
        console.error('Hierarchy subscriber error:', e);
      }
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let _hierarchyManager = null;

function getHierarchyManager() {
  return _hierarchyManager;
}

function initHierarchyManager(eventStore = null) {
  _hierarchyManager = new HierarchyManager(eventStore);
  return _hierarchyManager;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Constants
    ViewTypes,
    ViewTypeInfo,
    PivotTypes,
    SourceTypes,

    // Factory functions
    createSource,
    createNullSource,
    createSet,
    createSetFromScratch,
    createLens,
    createDefaultLens,
    createTypeScopedLens,
    createView,

    // Utilities
    generateId,
    buildViewConfig,

    // Manager
    HierarchyManager,
    getHierarchyManager,
    initHierarchyManager
  };
}

if (typeof window !== 'undefined') {
  // Constants
  window.ViewTypes = ViewTypes;
  window.ViewTypeInfo = ViewTypeInfo;
  window.PivotTypes = PivotTypes;
  window.SourceTypes = SourceTypes;

  // Factory functions
  window.createSource = createSource;
  window.createNullSource = createNullSource;
  window.createSet = createSet;
  window.createSetFromScratch = createSetFromScratch;
  window.createLens = createLens;
  window.createDefaultLens = createDefaultLens;
  window.createTypeScopedLens = createTypeScopedLens;
  window.createView = createView;

  // Utilities
  window.generateHierarchyId = generateId;
  window.buildViewConfig = buildViewConfig;

  // Manager
  window.HierarchyManager = HierarchyManager;
  window.getHierarchyManager = getHierarchyManager;
  window.initHierarchyManager = initHierarchyManager;
}
