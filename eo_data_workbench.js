/**
 * EO Lake - Data Workbench
 * Airtable-style data management with EO sync principles
 *
 * Core Concepts (Nine Rules-Compliant Hierarchy):
 * - Workspaces: Contextual boundaries (broadest horizon)
 * - Sets: Typed data collections with schema
 * - Lenses: View types (Grid, Cards, Kanban, Timeline, Calendar, Graph)
 * - Focuses: Filtered/restricted views
 * - Snapshots: Immutable frozen captures
 *
 * EO Integration:
 * - All views are MEANT events (Rule 1: interpretations)
 * - All access mediated through horizons (Rule 4)
 * - Focuses can only restrict, never expand (Rule 5)
 * - Full provenance tracking for all changes (Rule 7)
 * - Views are superseded, never deleted (Rule 9)
 */

// ============================================================================
// Field Types
// ============================================================================

const FieldTypes = Object.freeze({
  TEXT: 'text',
  LONG_TEXT: 'longText',
  NUMBER: 'number',
  SELECT: 'select',
  MULTI_SELECT: 'multiSelect',
  DATE: 'date',
  CHECKBOX: 'checkbox',
  LINK: 'link',
  ATTACHMENT: 'attachment',
  URL: 'url',
  EMAIL: 'email',
  PHONE: 'phone',
  FORMULA: 'formula',
  ROLLUP: 'rollup',
  COUNT: 'count',
  AUTONUMBER: 'autonumber',
  JSON: 'json'
});

const FieldTypeIcons = {
  [FieldTypes.TEXT]: 'ph-text-aa',
  [FieldTypes.LONG_TEXT]: 'ph-text-align-left',
  [FieldTypes.NUMBER]: 'ph-hash',
  [FieldTypes.SELECT]: 'ph-list-bullets',
  [FieldTypes.MULTI_SELECT]: 'ph-list-checks',
  [FieldTypes.DATE]: 'ph-calendar',
  [FieldTypes.CHECKBOX]: 'ph-check-square',
  [FieldTypes.LINK]: 'ph-link',
  [FieldTypes.ATTACHMENT]: 'ph-paperclip',
  [FieldTypes.URL]: 'ph-globe',
  [FieldTypes.EMAIL]: 'ph-envelope',
  [FieldTypes.PHONE]: 'ph-phone',
  [FieldTypes.FORMULA]: 'ph-function',
  [FieldTypes.ROLLUP]: 'ph-sigma',
  [FieldTypes.COUNT]: 'ph-number-circle-one',
  [FieldTypes.AUTONUMBER]: 'ph-number-square-one',
  [FieldTypes.JSON]: 'ph-brackets-curly'
};

const SelectColors = ['blue', 'green', 'yellow', 'red', 'purple', 'pink', 'orange', 'gray'];

// ============================================================================
// Data Model
// ============================================================================

/**
 * Generate a unique ID
 */
function generateId() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Create a new Set (table/collection)
 */
function createSet(name, icon = 'ph-table') {
  return {
    id: generateId(),
    name,
    icon,
    fields: [
      createField('Name', FieldTypes.TEXT, { isPrimary: true })
    ],
    records: [],
    views: [
      createView('All Records', 'table')
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Create a new Field
 */
function createField(name, type, options = {}) {
  const field = {
    id: generateId(),
    name,
    type,
    width: options.width || 200,
    isPrimary: options.isPrimary || false,
    options: {}
  };

  // Type-specific options
  switch (type) {
    case FieldTypes.SELECT:
    case FieldTypes.MULTI_SELECT:
      field.options.choices = options.choices || [];
      break;
    case FieldTypes.NUMBER:
      field.options.precision = options.precision ?? 0;
      field.options.format = options.format || 'number'; // number, currency, percent
      break;
    case FieldTypes.DATE:
      field.options.includeTime = options.includeTime || false;
      field.options.dateFormat = options.dateFormat || 'local'; // local, friendly, us, european, iso
      field.options.timeFormat = options.timeFormat || '12h'; // 12h, 24h
      break;
    case FieldTypes.LINK:
      field.options.linkedSetId = options.linkedSetId || null;
      field.options.allowMultiple = options.allowMultiple || false;
      break;
    case FieldTypes.ATTACHMENT:
      field.options.maxFiles = options.maxFiles || null; // null = unlimited
      break;
    case FieldTypes.PHONE:
      field.options.defaultCountry = options.defaultCountry || 'US';
      break;
    case FieldTypes.FORMULA:
      field.options.formula = options.formula || '';
      field.options.resultType = options.resultType || 'text'; // text, number, date, checkbox
      break;
    case FieldTypes.ROLLUP:
      field.options.linkedFieldId = options.linkedFieldId || null;
      field.options.rollupFieldId = options.rollupFieldId || null;
      field.options.aggregation = options.aggregation || 'SUM'; // SUM, AVG, MIN, MAX, COUNT, COUNTA, etc.
      break;
    case FieldTypes.COUNT:
      field.options.linkedFieldId = options.linkedFieldId || null;
      break;
    case FieldTypes.AUTONUMBER:
      field.options.prefix = options.prefix || '';
      field.options.startValue = options.startValue ?? 1;
      break;
    case FieldTypes.JSON:
      // displayMode: 'keyValue' (default) shows elegant key-value pairs
      // displayMode: 'raw' shows the raw JSON string
      field.options.displayMode = options.displayMode || 'keyValue';
      break;
  }

  // Subfields configuration (available for any field type)
  // Allows adding structured key-value parameters to cell values
  if (options.subfields) {
    field.options.subfields = {
      // 'standard' = same subfields for all rows (schema-defined)
      // 'custom' = each cell can have its own subfields
      mode: options.subfields.mode || 'custom',
      // Schema definition for standard mode
      schema: options.subfields.schema || [],
      // Display mode: 'compact' (indicator), 'inline' (sub-columns), 'expanded' (full)
      display: options.subfields.display || 'compact'
    };
  }

  return field;
}

/**
 * Create a new View
 */
function createView(name, type, config = {}) {
  return {
    id: generateId(),
    name,
    type, // table, cards, kanban, calendar, graph
    config: {
      filters: config.filters || [],
      sorts: config.sorts || [],
      groups: config.groups || [],
      hiddenFields: config.hiddenFields || [],
      fieldOrder: config.fieldOrder || [],
      // View-specific config
      ...config
    },
    createdAt: new Date().toISOString()
  };
}

/**
 * Create a new Record
 */
function createRecord(setId, values = {}) {
  return {
    id: generateId(),
    setId,
    values,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// ============================================================================
// Data Workbench Class
// ============================================================================

class EODataWorkbench {
  constructor(container) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    // View Hierarchy (Nine Rules-Compliant)
    this.viewRegistry = null;

    // Legacy State (for backward compatibility)
    this.sets = [];
    this.currentSetId = null;
    this.currentViewId = null;
    this.lastViewPerSet = {}; // Remember last active view for each set
    this.selectedRecords = new Set();
    this.editingCell = null;
    this.clipboard = null;

    // Undo/Redo Stack
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoStackSize = 50;

    // Hierarchy State
    this.currentWorkspaceId = null;
    this.currentLensId = null;
    this.currentFocusId = null;

    // UI References
    this.elements = {};

    // EO Integration
    this.eventBus = null;
    this.eoApp = null;

    // Event handlers
    this._handlers = {};

    // Chunked loading state - Performance optimized
    this.displayedRecordCount = 0;
    this.initialBatchSize = 25; // Smaller initial batch for fast first paint
    this.recordBatchSize = 50; // Number of records to load per subsequent batch
    this.loadingThreshold = 20; // Show loading indicator when records exceed this

    // Lazy loading - defer loading records for non-current sets
    this._useLazyLoading = true;
    this._fullSetData = null;
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  init(eoApp = null) {
    this.eoApp = eoApp;

    // Initialize View Hierarchy Registry
    this._initViewHierarchy();

    // Load persisted data
    this._loadData();

    // If no workspaces exist, create a default one
    if (this.viewRegistry.getAllWorkspaces().length === 0) {
      this._createDefaultWorkspace();
    }

    // If no sets exist, create a default one
    if (this.sets.length === 0) {
      this._createDefaultSet();
    }

    // Set current set and view
    if (!this.currentSetId && this.sets.length > 0) {
      this.currentSetId = this.sets[0].id;
      this.currentViewId = this.sets[0].views[0]?.id;
    }

    // Sync legacy sets with view registry
    this._syncSetsToRegistry();

    // Bind elements
    this._bindElements();

    // Attach event listeners
    this._attachEventListeners();

    // Render initial UI
    this._renderSidebar();
    this._renderView();

    // Update status
    this._updateStatus();

    console.log('EO Data Workbench initialized with compliant view hierarchy');
    return this;
  }

  /**
   * Initialize the View Hierarchy Registry
   */
  _initViewHierarchy() {
    // Get or create the view registry
    if (typeof initViewRegistry === 'function') {
      this.viewRegistry = initViewRegistry(
        this.eoApp?.getGate?.() || null,
        this.eoApp?.eventStore || null
      );
    } else {
      // Fallback: create a simple registry
      this.viewRegistry = {
        workspaces: new Map(),
        sets: new Map(),
        lenses: new Map(),
        focuses: new Map(),
        snapshots: new Map(),
        activeWorkspaceId: null,
        getAllWorkspaces: () => [],
        getAllSets: () => [],
        createWorkspace: () => null,
        subscribe: () => () => {}
      };
    }

    // Subscribe to registry events
    this.viewRegistry.subscribe?.((eventType, data) => {
      this._handleRegistryEvent(eventType, data);
    });
  }

  /**
   * Create the default workspace
   */
  _createDefaultWorkspace() {
    if (!this.viewRegistry.createWorkspace) return;

    try {
      const workspace = this.viewRegistry.createWorkspace({
        name: 'My Workspace',
        description: 'Default workspace for organizing data',
        icon: 'ph-folder-simple',
        horizon: {
          timeRange: null,
          actors: [],
          entityTypes: []
        }
      }, ['system_init']);

      this.currentWorkspaceId = workspace.id;
      this.viewRegistry.activeWorkspaceId = workspace.id;
    } catch (e) {
      console.warn('Failed to create default workspace:', e);
    }
  }

  /**
   * Sync legacy sets with the view registry
   */
  _syncSetsToRegistry() {
    if (!this.viewRegistry.createSet) return;

    for (const set of this.sets) {
      // Check if set already exists in registry
      if (!this.viewRegistry.sets.has(set.id)) {
        try {
          // Create set in registry with schema
          const registrySet = this.viewRegistry.createSet({
            id: set.id,
            name: set.name,
            icon: set.icon,
            schema: { fields: set.fields },
            records: set.records
          }, this.currentWorkspaceId, ['system_init']);

          // Create lenses for each view
          for (const view of set.views || []) {
            const lens = this.viewRegistry.createLens({
              id: view.id,
              name: view.name,
              lensType: this._mapViewTypeToLensType(view.type),
              config: view.config || {}
            }, set.id);
          }
        } catch (e) {
          console.warn('Failed to sync set to registry:', e);
        }
      }
    }
  }

  /**
   * Map legacy view type to lens type
   */
  _mapViewTypeToLensType(viewType) {
    const mapping = {
      'table': 'grid',
      'cards': 'cards',
      'kanban': 'kanban',
      'calendar': 'calendar',
      'graph': 'graph',
      'timeline': 'timeline'
    };
    return mapping[viewType] || 'grid';
  }

  /**
   * Handle events from the view registry
   */
  _handleRegistryEvent(eventType, data) {
    switch (eventType) {
      case 'workspace_activated':
        this.currentWorkspaceId = data?.id;
        this._renderSidebar();
        break;
      case 'set_activated':
        this.currentSetId = data?.id;
        this._renderView();
        break;
      case 'lens_activated':
        this.currentLensId = data?.id;
        this._renderView();
        break;
      case 'focus_activated':
        this.currentFocusId = data?.id;
        this._renderView();
        break;
      case 'snapshot_created':
        this._showNotification('Snapshot created: ' + data.name);
        break;
    }
  }

  _createDefaultSet() {
    const set = createSet('My Data');

    // Add some default fields
    set.fields.push(
      createField('Status', FieldTypes.SELECT, {
        choices: [
          { id: generateId(), name: 'To Do', color: 'gray' },
          { id: generateId(), name: 'In Progress', color: 'blue' },
          { id: generateId(), name: 'Done', color: 'green' }
        ]
      }),
      createField('Due Date', FieldTypes.DATE),
      createField('Notes', FieldTypes.LONG_TEXT)
    );

    // Add some sample records
    for (let i = 1; i <= 5; i++) {
      set.records.push(createRecord(set.id, {
        [set.fields[0].id]: `Record ${i}`,
        [set.fields[1].id]: set.fields[1].options.choices[i % 3].id,
        [set.fields[2].id]: new Date(Date.now() + i * 86400000).toISOString().split('T')[0]
      }));
    }

    this.sets.push(set);
    this._saveData();
  }

  _bindElements() {
    this.elements = {
      sidebar: document.getElementById('app-sidebar'),
      setsNav: document.getElementById('sets-nav'),
      viewsNav: document.getElementById('views-nav'),
      contentArea: document.getElementById('content-area'),
      detailPanel: document.getElementById('detail-panel'),
      modal: document.getElementById('modal-overlay'),
      contextMenu: document.getElementById('context-menu'),
      fieldTypePicker: document.getElementById('field-type-picker'),
      recordCount: document.getElementById('record-count'),
      selectedCount: document.getElementById('selected-count'),
      currentSetName: document.getElementById('current-set-name'),
      currentViewName: document.getElementById('current-view-name'),
      // Tab bar elements
      tabBar: document.getElementById('tab-bar'),
      tabBarTabs: document.getElementById('tab-bar-tabs'),
      newTabBtn: document.getElementById('new-tab-btn'),
      tabListBtn: document.getElementById('tab-list-btn'),
      tabScrollLeft: document.getElementById('tab-scroll-left'),
      tabScrollRight: document.getElementById('tab-scroll-right')
    };

    // Tab management state
    this.tossedItems = []; // Items that have been tossed (not deleted, just out of view)
    this.maxTossedItems = 10;
    this.tabListDropdownOpen = false;
    this.tabContextMenuOpen = false;

    // Pick Up state - for grabbing data from various sources
    this.pickedUp = null; // Currently picked up item { type, data, source }
  }

  _attachEventListeners() {
    // View switcher
    document.querySelectorAll('.view-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const viewType = btn.dataset.view;
        this._switchViewType(viewType);
      });
    });

    // Add record button
    document.getElementById('btn-add-record')?.addEventListener('click', () => {
      this.addRecord();
    });

    // New set button
    document.getElementById('btn-new-set')?.addEventListener('click', () => {
      this._showNewSetModal();
    });

    // Import data button
    document.getElementById('btn-import-data')?.addEventListener('click', () => {
      this._showImportModal();
    });

    // New view button
    document.getElementById('btn-new-view')?.addEventListener('click', () => {
      this._showNewViewModal();
    });

    // Sidebar collapse
    document.getElementById('sidebar-collapse')?.addEventListener('click', () => {
      this.elements.sidebar.classList.toggle('collapsed');
    });

    // Detail panel close
    document.getElementById('detail-panel-close')?.addEventListener('click', () => {
      this.elements.detailPanel.classList.remove('open');
    });

    // Modal close handlers
    document.getElementById('modal-close')?.addEventListener('click', () => this._closeModal());
    document.getElementById('modal-cancel')?.addEventListener('click', () => this._closeModal());
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this._closeModal();
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => this._handleKeyDown(e));

    // Global click to close menus
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) {
        this.elements.contextMenu?.classList.remove('active');
      }
      if (!e.target.closest('.field-type-picker') && !e.target.closest('.col-add') && !e.target.closest('.context-menu')) {
        this.elements.fieldTypePicker?.classList.remove('active');
      }
    });

    // Mobile menu
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
      this.elements.sidebar.classList.toggle('mobile-open');
    });

    // Import button
    document.getElementById('btn-import')?.addEventListener('click', () => {
      if (typeof showImportModal === 'function') {
        showImportModal();
      }
    });

    // Filter/Sort buttons - Now opens Focus modal (Rule 5)
    document.getElementById('btn-filter')?.addEventListener('click', () => this._showNewFocusModal());
    document.getElementById('btn-sort')?.addEventListener('click', () => this._showSortPanel());

    // Snapshot button (Rule 9)
    document.getElementById('btn-snapshot')?.addEventListener('click', () => this._showNewSnapshotModal());

    // New workspace button
    document.getElementById('btn-new-workspace')?.addEventListener('click', () => this._showNewWorkspaceModal());

    // Keyboard shortcuts modal
    document.getElementById('nav-keyboard-shortcuts')?.addEventListener('click', () => this._showKeyboardShortcuts());
    document.getElementById('shortcuts-modal-close')?.addEventListener('click', () => this._hideKeyboardShortcuts());
    document.getElementById('shortcuts-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'shortcuts-modal') this._hideKeyboardShortcuts();
    });

    // Bulk actions toolbar
    document.getElementById('bulk-duplicate')?.addEventListener('click', () => this._bulkDuplicate());
    document.getElementById('bulk-export')?.addEventListener('click', () => this._bulkExport());
    document.getElementById('bulk-delete')?.addEventListener('click', () => this._bulkDelete());
    document.getElementById('bulk-actions-close')?.addEventListener('click', () => this._clearSelection());

    // Filter panel
    document.getElementById('btn-filter')?.removeEventListener('click', () => {});
    document.getElementById('btn-filter')?.addEventListener('click', () => this._toggleFilterPanel());
    document.getElementById('filter-panel-close')?.addEventListener('click', () => this._hideFilterPanel());
    document.getElementById('add-filter-btn')?.addEventListener('click', () => this._addFilterRow());
    document.getElementById('filter-apply')?.addEventListener('click', () => this._applyFilters());
    document.getElementById('filter-clear')?.addEventListener('click', () => this._clearFilters());

    // Sort panel
    document.getElementById('btn-sort')?.addEventListener('click', () => this._toggleSortPanel());
    document.getElementById('sort-panel-close')?.addEventListener('click', () => this._hideSortPanel());
    document.getElementById('add-sort-btn')?.addEventListener('click', () => this._addSortRow());
    document.getElementById('sort-apply')?.addEventListener('click', () => this._applySorts());
    document.getElementById('sort-clear')?.addEventListener('click', () => this._clearSorts());

    // Global search
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this._handleSearch(e.target.value));
      searchInput.addEventListener('focus', () => this._showSearchResults());
      searchInput.addEventListener('blur', () => setTimeout(() => this._hideSearchResults(), 200));
    }

    // Tab bar event listeners
    this._attachTabBarListeners();
  }

  /**
   * Attach tab bar event listeners
   */
  _attachTabBarListeners() {
    // New tab button
    this.elements.newTabBtn?.addEventListener('click', () => this._createNewTab());

    // Tab list dropdown button
    this.elements.tabListBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleTabListDropdown();
    });

    // Tab scroll buttons
    this.elements.tabScrollLeft?.addEventListener('click', () => this._scrollTabs('left'));
    this.elements.tabScrollRight?.addEventListener('click', () => this._scrollTabs('right'));

    // Check for tab overflow on resize
    window.addEventListener('resize', () => this._checkTabOverflow());

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.tab-list-dropdown') && !e.target.closest('#tab-list-btn')) {
        this._closeTabListDropdown();
      }
      if (!e.target.closest('.tab-context-menu')) {
        this._closeTabContextMenu();
      }
    });
  }

  // --------------------------------------------------------------------------
  // Data Persistence
  // --------------------------------------------------------------------------

  _loadData() {
    try {
      const data = localStorage.getItem('eo_lake_data');
      if (data) {
        const parsed = JSON.parse(data);

        // Performance: Use lazy loading for set records
        // Only load metadata initially, defer record loading
        if (this._useLazyLoading && parsed.sets?.length > 1) {
          this.sets = parsed.sets.map(set => ({
            ...set,
            records: [], // Defer loading records
            _recordsLoaded: false,
            _recordCount: set.records?.length || 0
          }));
          this._fullSetData = parsed.sets; // Store full data for lazy loading
        } else {
          this.sets = parsed.sets || [];
        }

        this.currentSetId = parsed.currentSetId;
        this.currentViewId = parsed.currentViewId;
        this.lastViewPerSet = parsed.lastViewPerSet || {};

        // Load records for current set immediately if using lazy loading
        if (this._useLazyLoading && this.currentSetId) {
          this._loadSetRecords(this.currentSetId);
        }
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }

  /**
   * Lazy load records for a specific set
   * Performance: Defers record loading until set is accessed
   */
  _loadSetRecords(setId) {
    if (!this._fullSetData) return;

    const set = this.sets.find(s => s.id === setId);
    const fullSet = this._fullSetData.find(s => s.id === setId);

    if (set && fullSet && !set._recordsLoaded) {
      set.records = fullSet.records || [];
      set._recordsLoaded = true;
    }
  }

  _saveData() {
    try {
      // When using lazy loading, merge loaded records back into full set data
      let setsToSave = this.sets;
      if (this._useLazyLoading && this._fullSetData) {
        setsToSave = this._fullSetData.map(fullSet => {
          const loadedSet = this.sets.find(s => s.id === fullSet.id);
          if (loadedSet && loadedSet._recordsLoaded) {
            // Use loaded set data (may have been modified)
            const { _recordsLoaded, _recordCount, ...cleanSet } = loadedSet;
            return cleanSet;
          }
          return fullSet;
        });
        // Also update the full set data cache
        this._fullSetData = setsToSave;
      }

      localStorage.setItem('eo_lake_data', JSON.stringify({
        sets: setsToSave,
        currentSetId: this.currentSetId,
        currentViewId: this.currentViewId,
        lastViewPerSet: this.lastViewPerSet
      }));

      // Also create EO events if connected
      if (this.eoApp) {
        this._createEOEvent('data_saved', { timestamp: new Date().toISOString() });
      }

      // Update last saved time
      const lastSaved = document.querySelector('#last-saved span:last-child');
      if (lastSaved) {
        lastSaved.textContent = 'Just now';
      }
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  }

  // --------------------------------------------------------------------------
  // Getters
  // --------------------------------------------------------------------------

  getCurrentSet() {
    return this.sets.find(s => s.id === this.currentSetId);
  }

  getCurrentView() {
    const set = this.getCurrentSet();
    return set?.views.find(v => v.id === this.currentViewId);
  }

  getFilteredRecords() {
    const set = this.getCurrentSet();
    const view = this.getCurrentView();
    if (!set) return [];

    let records = [...set.records];

    // Apply filters
    if (view?.config.filters?.length > 0) {
      records = records.filter(record => {
        return view.config.filters.every(filter => {
          const value = record.values[filter.fieldId];
          return this._matchesFilter(value, filter);
        });
      });
    }

    // Apply sorts
    if (view?.config.sorts?.length > 0) {
      records.sort((a, b) => {
        for (const sort of view.config.sorts) {
          const aVal = a.values[sort.fieldId];
          const bVal = b.values[sort.fieldId];
          const cmp = this._compareValues(aVal, bVal);
          if (cmp !== 0) return sort.direction === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }

    return records;
  }

  _matchesFilter(value, filter) {
    const { operator, filterValue } = filter;
    switch (operator) {
      case 'is': return value === filterValue;
      case 'isNot': return value !== filterValue;
      case 'contains': return String(value || '').toLowerCase().includes(String(filterValue).toLowerCase());
      case 'doesNotContain': return !String(value || '').toLowerCase().includes(String(filterValue).toLowerCase());
      case 'isEmpty': return value == null || value === '';
      case 'isNotEmpty': return value != null && value !== '';
      case 'greaterThan': return Number(value) > Number(filterValue);
      case 'lessThan': return Number(value) < Number(filterValue);
      default: return true;
    }
  }

  _compareValues(a, b) {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    if (typeof a === 'string') return a.localeCompare(b);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  // --------------------------------------------------------------------------
  // Sidebar Rendering
  // --------------------------------------------------------------------------

  _renderSidebar() {
    // Three-panel navigation: Sources (GIVEN) / Sets (Schema) / Views (MEANT)
    this._renderSourcesNav();
    this._renderSetsNavFlat();
    this._renderViewsHierarchy();
  }

  /**
   * Render Sets as a flat list (Panel 2: Schema)
   * FIX #2: Sets show derivation strategy and operator badges
   * Sets are MEANT events - interpretive schema definitions
   */
  _renderSetsNavFlat() {
    const container = document.getElementById('sets-nav');
    if (!container) return;

    if (this.sets.length === 0) {
      container.innerHTML = `
        <div class="nav-empty-state">
          <i class="ph ph-funnel"></i>
          <span>No sets yet</span>
          <div class="empty-actions">
            <button class="btn-link" id="btn-create-from-import">Import & Create Set</button>
            <span class="empty-divider">or</span>
            <button class="btn-link btn-secondary" id="btn-create-empty-set">Create Empty</button>
          </div>
        </div>
      `;
      container.querySelector('#btn-create-from-import')?.addEventListener('click', () => {
        this._showImportModal();
      });
      container.querySelector('#btn-create-empty-set')?.addEventListener('click', () => {
        this._showOperatorFirstCreationModal();
      });
      return;
    }

    container.innerHTML = this.sets.map(set => {
      const recordCount = set.records?.length || 0;
      const fieldCount = set.fields?.length || 0;

      // Determine derivation strategy for operator badge
      const derivation = this._getSetDerivationInfo(set);
      const operatorBadge = this._getOperatorBadgeHTML(derivation.operator);

      // Check stability level
      const stability = set.stabilityLevel || 'holon';
      const stabilityClass = `stability-${stability}`;

      // Check for ontology warnings
      const warnings = this._validateSetOntology(set);
      const hasWarning = warnings.length > 0;

      return `
        <div class="nav-item set-item ${set.id === this.currentSetId ? 'active' : ''} ${stabilityClass} ${hasWarning ? 'has-warning' : ''}"
             data-set-id="${set.id}"
             title="${derivation.description}\n${fieldCount} fields · ${recordCount} records${hasWarning ? '\n⚠️ ' + warnings[0] : ''}">
          ${operatorBadge}
          <i class="${set.icon || 'ph ph-table'}"></i>
          <span class="set-name">${this._escapeHtml(set.name)}</span>
          ${hasWarning ? '<i class="ph ph-warning-circle set-warning-icon" title="' + this._escapeHtml(warnings[0]) + '"></i>' : ''}
          <span class="nav-item-count">${recordCount}</span>
        </div>
      `;
    }).join('');

    // Attach click handlers
    container.querySelectorAll('.nav-item[data-set-id]').forEach(item => {
      item.addEventListener('click', () => {
        this._selectSet(item.dataset.setId);
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showSetContextMenu(e, item.dataset.setId);
      });
    });
  }

  /**
   * Get derivation info for a set
   */
  _getSetDerivationInfo(set) {
    // Check for explicit derivation config
    if (set.derivation) {
      const strategy = set.derivation.strategy;
      const descriptions = {
        'seg': 'Filtered from parent (SEG operator)',
        'con': 'Joined from multiple sets (CON operator)',
        'alt': 'Transformed via rule (ALT operator)',
        'direct': 'Direct import from source'
      };
      return {
        operator: strategy.toUpperCase(),
        strategy: strategy,
        description: descriptions[strategy] || 'Derived set'
      };
    }

    // Infer from provenance
    const prov = set.datasetProvenance;
    if (prov && (prov.originalFilename || prov.provenance?.source)) {
      return {
        operator: 'INS',
        strategy: 'direct',
        description: `Imported from ${prov.originalFilename || prov.provenance?.source}`
      };
    }

    // Manual/empty set
    return {
      operator: 'INS',
      strategy: 'manual',
      description: 'Manually created set'
    };
  }

  /**
   * Get HTML for operator badge
   */
  _getOperatorBadgeHTML(operator) {
    const operators = {
      'SEG': { symbol: '｜', color: 'purple', title: 'Segmented (filtered)' },
      'CON': { symbol: '⋈', color: 'blue', title: 'Connected (joined)' },
      'ALT': { symbol: '∿', color: 'green', title: 'Alternated (transformed)' },
      'SYN': { symbol: '∨', color: 'orange', title: 'Synthesized (merged)' },
      'INS': { symbol: '△', color: 'gray', title: 'Instantiated (created)' }
    };

    const op = operators[operator] || operators['INS'];
    return `<span class="op-badge-mini op-${op.color}" title="${op.title}">${op.symbol}</span>`;
  }

  /**
   * Validate set against ontology rules
   * Returns array of warning messages
   */
  _validateSetOntology(set) {
    const warnings = [];

    // Use ontology validator if available
    if (typeof window.EOOntology !== 'undefined') {
      const validator = new window.EOOntology.OntologyValidator();
      const result = validator.validateSet(set, { requireFrame: false });
      if (!result.valid) {
        result.errors.forEach(err => warnings.push(err.getUserMessage()));
      }
    }

    // Basic checks if validator not available
    if (!set.derivation && !set.datasetProvenance) {
      // Only warn for sets with no records (truly empty)
      if (!set.records || set.records.length === 0) {
        warnings.push('Empty set with no derivation strategy');
      }
    }

    return warnings;
  }

  /**
   * Show operator-first creation modal
   * FIX #8: Ask HOW to transform, not WHAT to create
   */
  _showOperatorFirstCreationModal() {
    const intents = [
      { id: 'FILTER', icon: 'ph-funnel', label: 'Filter existing data', operator: 'SEG', description: 'Create a subset by filtering records' },
      { id: 'RELATE', icon: 'ph-link', label: 'Relate things', operator: 'CON', description: 'Join records from multiple sets' },
      { id: 'SLICE', icon: 'ph-clock', label: 'Slice by time', operator: 'ALT', description: 'Create time-based partitions' },
      { id: 'COMBINE', icon: 'ph-stack', label: 'Combine perspectives', operator: 'SUP', description: 'Overlay multiple views' },
      { id: 'IMPORT', icon: 'ph-upload', label: 'Import new data', operator: 'INS', description: 'Import external data as source' },
      { id: 'EMPTY', icon: 'ph-plus-circle', label: 'Start empty', operator: 'INS', description: 'Create an empty set (manual entry)', warning: 'Not recommended - prefer deriving from data' }
    ];

    const html = `
      <div class="operator-creation-modal">
        <p class="creation-prompt">How do you want to create this set?</p>
        <div class="creation-intents">
          ${intents.map(intent => `
            <button class="creation-intent-btn ${intent.warning ? 'has-warning' : ''}" data-intent="${intent.id}">
              <i class="ph ${intent.icon}"></i>
              <div class="intent-content">
                <span class="intent-label">${intent.label}</span>
                <span class="intent-description">${intent.description}</span>
                ${intent.warning ? `<span class="intent-warning"><i class="ph ph-warning"></i> ${intent.warning}</span>` : ''}
              </div>
              <span class="intent-operator" title="EO Operator">${intent.operator}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    this._showModal('Create New Set', html, null, { hideFooter: true });

    // Attach handlers
    document.querySelectorAll('.creation-intent-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const intent = btn.dataset.intent;
        this._closeModal();
        this._handleCreationIntent(intent);
      });
    });
  }

  /**
   * Handle creation intent selection
   */
  _handleCreationIntent(intent) {
    switch (intent) {
      case 'FILTER':
        this._showFilterSetCreationFlow();
        break;
      case 'RELATE':
        this._showJoinSetCreationFlow();
        break;
      case 'SLICE':
        this._showTimeSliceCreationFlow();
        break;
      case 'COMBINE':
        this._showCombineViewFlow();
        break;
      case 'IMPORT':
        this._showImportModal();
        break;
      case 'EMPTY':
        this._createEmptySetWithWarning();
        break;
    }
  }

  /**
   * Create empty set with ontology warning
   */
  _createEmptySetWithWarning() {
    this._showModal('Create Empty Set', `
      <div class="ontology-warning">
        <i class="ph ph-warning-circle"></i>
        <div>
          <strong>Ontology Notice</strong>
          <p>Empty sets violate EO's derivation principle. Sets should be born from constraint, not emptiness.</p>
          <p>Consider importing data or filtering from an existing set instead.</p>
        </div>
      </div>
      <div class="form-group" style="margin-top: 16px;">
        <label>Set Name</label>
        <input type="text" id="empty-set-name" class="form-input" placeholder="My Set" value="">
      </div>
    `, () => {
      const name = document.getElementById('empty-set-name')?.value?.trim() || 'New Set';
      const set = createSet(name);
      // Mark as manually created with warning
      set.derivation = {
        strategy: 'manual',
        constraint: { filters: [] },
        warning: 'Created empty - no derivation constraint'
      };
      this.sets.push(set);
      this._saveData();
      this._renderSidebar();
      this._selectSet(set.id);
      this._showToast('Set created (empty)', 'warning');
    });
  }

  /**
   * Show filter-based set creation flow
   */
  _showFilterSetCreationFlow() {
    if (this.sets.length === 0) {
      this._showToast('No sets to filter from. Import data first.', 'warning');
      return;
    }

    const html = `
      <div class="filter-creation-flow">
        <div class="form-group">
          <label>Filter from Set</label>
          <select id="filter-parent-set" class="form-select">
            ${this.sets.map(set => `
              <option value="${set.id}">${this._escapeHtml(set.name)} (${set.records?.length || 0} records)</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>New Set Name</label>
          <input type="text" id="filter-set-name" class="form-input" placeholder="SEG: Filtered Records">
        </div>
        <p class="form-hint">You can define filter criteria after creating the set.</p>
      </div>
    `;

    this._showModal('Create Filtered Set (SEG)', html, () => {
      const parentId = document.getElementById('filter-parent-set')?.value;
      const name = document.getElementById('filter-set-name')?.value?.trim() || 'SEG: Filtered Set';
      const parentSet = this.sets.find(s => s.id === parentId);

      if (!parentSet) return;

      // Create derived set with SEG operator
      const set = createSet(name);
      set.fields = JSON.parse(JSON.stringify(parentSet.fields)); // Copy schema
      set.records = [...parentSet.records]; // Copy records (filter applied later)
      set.derivation = {
        strategy: 'seg',
        parentSetId: parentId,
        constraint: { filters: [] },
        derivedAt: new Date().toISOString()
      };

      this.sets.push(set);
      this._saveData();
      this._renderSidebar();
      this._selectSet(set.id);
      this._showToast('Filtered set created', 'success');
    });
  }

  /**
   * Show join-based set creation flow
   */
  _showJoinSetCreationFlow() {
    if (this.sets.length < 2) {
      this._showToast('Need at least 2 sets to join.', 'warning');
      return;
    }

    const html = `
      <div class="join-creation-flow">
        <div class="form-group">
          <label>Select Sets to Join</label>
          <div class="checkbox-list">
            ${this.sets.map(set => `
              <label class="checkbox-item">
                <input type="checkbox" name="join-sets" value="${set.id}">
                <span>${this._escapeHtml(set.name)} (${set.records?.length || 0} records)</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>New Set Name</label>
          <input type="text" id="join-set-name" class="form-input" placeholder="CON: Combined Records">
        </div>
      </div>
    `;

    this._showModal('Create Joined Set (CON)', html, () => {
      const checkboxes = document.querySelectorAll('input[name="join-sets"]:checked');
      const setIds = Array.from(checkboxes).map(cb => cb.value);
      const name = document.getElementById('join-set-name')?.value?.trim() || 'CON: Joined Set';

      if (setIds.length < 2) {
        this._showToast('Select at least 2 sets to join', 'warning');
        return;
      }

      // Create derived set with CON operator
      const set = createSet(name);
      set.derivation = {
        strategy: 'con',
        joinSetIds: setIds,
        constraint: { joinCondition: null },
        derivedAt: new Date().toISOString()
      };

      // Merge schemas and records
      const sourceSets = setIds.map(id => this.sets.find(s => s.id === id)).filter(Boolean);
      set.fields = this._mergeSchemas(sourceSets);
      set.records = sourceSets.flatMap(s => s.records || []);

      this.sets.push(set);
      this._saveData();
      this._renderSidebar();
      this._selectSet(set.id);
      this._showToast('Joined set created', 'success');
    });
  }

  /**
   * Merge schemas from multiple sets
   */
  _mergeSchemas(sets) {
    const fieldMap = new Map();
    for (const set of sets) {
      for (const field of set.fields || []) {
        if (!fieldMap.has(field.name)) {
          fieldMap.set(field.name, { ...field, id: generateId() });
        }
      }
    }
    return Array.from(fieldMap.values());
  }

  /**
   * Show time slice creation flow (placeholder)
   */
  _showTimeSliceCreationFlow() {
    this._showToast('Time slice creation coming soon', 'info');
  }

  /**
   * Show combine view flow (placeholder)
   */
  _showCombineViewFlow() {
    this._showToast('Perspective combination coming soon', 'info');
  }

  /**
   * Render Views hierarchy (Panel 3: MEANT)
   * Shows Workspaces > Lenses > Focuses nested structure
   */
  _renderViewsHierarchy() {
    const container = document.getElementById('views-nav');
    if (!container) return;

    const workspaces = this.viewRegistry?.getAllWorkspaces?.() || [];
    const set = this.getCurrentSet();

    // Build view hierarchy HTML
    let html = '';

    // If we have workspaces from the registry, use them
    if (workspaces.length > 0) {
      html = workspaces.map(workspace => {
        const isExpanded = this.expandedWorkspaces?.has(workspace.id) ??
                          (workspace.id === this.currentWorkspaceId);
        const isActive = workspace.id === this.currentWorkspaceId;

        // Get lenses for this workspace's sets
        const workspaceLenses = this._getLensesForWorkspace(workspace.id);

        return `
          <div class="workspace-group ${isExpanded ? 'expanded' : ''}" data-workspace-id="${workspace.id}">
            <div class="workspace-header ${isActive ? 'active' : ''}" title="${workspace.description || ''}">
              <i class="ph ph-caret-right workspace-toggle"></i>
              <i class="ph ${workspace.icon || 'ph-folder-simple'} workspace-icon"></i>
              <span class="workspace-name">${this._escapeHtml(workspace.name)}</span>
            </div>
            <div class="workspace-children">
              ${workspaceLenses.map(lens => this._renderLensItem(lens)).join('')}
            </div>
          </div>
        `;
      }).join('');
    } else if (set && set.views && set.views.length > 0) {
      // Fallback: show current set's views directly
      html = `
        <div class="workspace-group expanded" data-workspace-id="default">
          <div class="workspace-header active">
            <i class="ph ph-caret-right workspace-toggle"></i>
            <i class="ph ph-folder-simple workspace-icon"></i>
            <span class="workspace-name">${this._escapeHtml(set.name)} Views</span>
          </div>
          <div class="workspace-children">
            ${set.views.map(view => this._renderLensItemFromView(view, set)).join('')}
          </div>
        </div>
      `;
    } else {
      html = `
        <div class="nav-item empty-hint" id="create-first-view">
          <i class="ph ph-plus-circle"></i>
          <span>Add a view</span>
        </div>
      `;
    }

    container.innerHTML = html;

    // Attach event handlers
    this._attachViewsHierarchyHandlers(container);
  }

  /**
   * Get lenses for a workspace
   */
  _getLensesForWorkspace(workspaceId) {
    // Get sets for this workspace
    const sets = this.viewRegistry?.getSetsForWorkspace?.(workspaceId) || this.sets;
    const lenses = [];

    for (const set of sets) {
      const registrySet = this.viewRegistry?.sets?.get(set.id);
      if (registrySet) {
        const setLenses = this.viewRegistry?.getLensesForSet?.(set.id) || [];
        for (const lens of setLenses) {
          lenses.push({ ...lens, setName: set.name, setId: set.id });
        }
      } else if (set.views) {
        // Fallback to legacy views
        for (const view of set.views) {
          lenses.push({
            id: view.id,
            name: view.name,
            lensType: view.type,
            setName: set.name,
            setId: set.id
          });
        }
      }
    }

    return lenses;
  }

  /**
   * Render a lens item with nested focuses
   */
  _renderLensItem(lens) {
    const isActive = lens.id === this.currentLensId || lens.id === this.currentViewId;
    const viewIcons = {
      grid: 'ph-table', table: 'ph-table',
      cards: 'ph-cards',
      kanban: 'ph-kanban',
      calendar: 'ph-calendar-blank',
      graph: 'ph-graph',
      timeline: 'ph-clock-countdown',
      filesystem: 'ph-folder-open'
    };
    const icon = viewIcons[lens.lensType] || 'ph-table';

    // Get focuses for this lens
    const focuses = this.viewRegistry?.getFocusesForLens?.(lens.id) || [];
    const set = this.sets.find(s => s.id === lens.setId);
    const totalRecords = set?.records?.length || 0;

    let focusHtml = '';
    if (focuses.length > 0) {
      focusHtml = `
        <div class="focus-children">
          ${focuses.map(focus => {
            const focusRecords = this._getFilteredRecordCountForFocus(focus, set);
            return `
              <div class="focus-item ${focus.id === this.currentFocusId ? 'active' : ''}"
                   data-focus-id="${focus.id}">
                <i class="ph ph-funnel"></i>
                <span>${this._escapeHtml(focus.name)}</span>
                <span class="focus-restriction">${focusRecords}/${totalRecords}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    return `
      <div class="lens-group">
        <div class="lens-item ${isActive ? 'active' : ''}"
             data-lens-id="${lens.id}"
             data-set-id="${lens.setId}">
          <i class="ph ${icon}"></i>
          <span>${this._escapeHtml(lens.name)}</span>
          <span class="lens-set-name">${lens.setName ? `· ${this._escapeHtml(lens.setName)}` : ''}</span>
        </div>
        ${focusHtml}
      </div>
    `;
  }

  /**
   * Render a lens item from legacy view object
   */
  _renderLensItemFromView(view, set) {
    const isActive = view.id === this.currentViewId;
    const viewIcons = {
      table: 'ph-table',
      cards: 'ph-cards',
      kanban: 'ph-kanban',
      calendar: 'ph-calendar-blank',
      graph: 'ph-graph',
      filesystem: 'ph-folder-open'
    };
    const icon = viewIcons[view.type] || 'ph-table';

    return `
      <div class="lens-item ${isActive ? 'active' : ''}"
           data-view-id="${view.id}"
           data-set-id="${set.id}">
        <i class="ph ${icon}"></i>
        <span>${this._escapeHtml(view.name)}</span>
      </div>
    `;
  }

  /**
   * Attach event handlers for views hierarchy
   */
  _attachViewsHierarchyHandlers(container) {
    // Workspace toggle
    container.querySelectorAll('.workspace-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const group = header.closest('.workspace-group');
        const workspaceId = group.dataset.workspaceId;
        group.classList.toggle('expanded');

        if (!this.expandedWorkspaces) this.expandedWorkspaces = new Set();
        if (group.classList.contains('expanded')) {
          this.expandedWorkspaces.add(workspaceId);
        } else {
          this.expandedWorkspaces.delete(workspaceId);
        }
      });
    });

    // Lens click
    container.querySelectorAll('.lens-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const lensId = item.dataset.lensId || item.dataset.viewId;
        const setId = item.dataset.setId;

        if (setId && setId !== this.currentSetId) {
          this._selectSet(setId);
        }
        if (lensId) {
          this._selectView(lensId);
        }
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showViewContextMenu(e, item.dataset.lensId || item.dataset.viewId);
      });
    });

    // Focus click
    container.querySelectorAll('.focus-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this._selectFocus(item.dataset.focusId);
      });
    });

    // Empty hint click
    container.querySelector('#create-first-view')?.addEventListener('click', () => {
      this._showNewViewTypeMenu?.();
    });
  }

  /**
   * Render sources navigation (import hierarchy)
   * FIX #1: Sources panel shows ONLY true imports (GIVEN events)
   * Sets are NOT shown here - they belong in the Sets panel
   *
   * EO Principle: Sources are GIVEN (immutable external data)
   * Sets are MEANT (interpretive schema definitions)
   */
  _renderSourcesNav() {
    const container = document.getElementById('sources-nav');
    if (!container) return;

    // Initialize sources registry if needed
    if (!this.sources) {
      this.sources = [];
    }

    // Extract true sources from sets with provenance (for backwards compatibility)
    // but DO NOT show sets in sources panel
    const sourceRegistry = new Map();

    for (const set of this.sets) {
      const prov = set.datasetProvenance;
      if (prov && (prov.originalFilename || prov.provenance?.source)) {
        const sourceName = prov.originalFilename || prov.provenance?.source || 'Unknown';
        const sourceKey = sourceName.toLowerCase();

        if (!sourceRegistry.has(sourceKey)) {
          // Create a true Source entry (GIVEN)
          sourceRegistry.set(sourceKey, {
            id: `src_${sourceKey.replace(/[^a-z0-9]/g, '_')}`,
            type: 'given', // ALWAYS given
            entityType: 'source',
            name: sourceName,
            importedAt: prov.importedAt,
            provenance: prov.provenance,
            recordCount: set.records?.length || 0,
            isReadOnly: true // Sources are immutable
          });
        } else {
          // Aggregate record count from multiple sets derived from same source
          sourceRegistry.get(sourceKey).recordCount += (set.records?.length || 0);
        }
      }
    }

    // Also include any explicit sources
    for (const source of this.sources) {
      if (!sourceRegistry.has(source.id)) {
        sourceRegistry.set(source.id, source);
      }
    }

    // Sort sources by import date (newest first)
    const sortedSources = Array.from(sourceRegistry.values()).sort((a, b) => {
      if (!a.importedAt) return 1;
      if (!b.importedAt) return -1;
      return new Date(b.importedAt) - new Date(a.importedAt);
    });

    // Empty state - no sources imported yet
    if (sortedSources.length === 0) {
      container.innerHTML = `
        <div class="nav-empty-state">
          <i class="ph ph-file-arrow-down"></i>
          <span>No data imported yet</span>
          <button class="btn-link" id="btn-first-import">Import CSV, JSON, or ICS</button>
        </div>
      `;
      container.querySelector('#btn-first-import')?.addEventListener('click', () => {
        this._showImportModal();
      });
      return;
    }

    // Render sources as a flat list (not a tree with sets!)
    let html = '';
    for (const source of sortedSources) {
      const sourceIcon = this._getSourceIcon(source.name);
      const provenanceInfo = this._formatSourceProvenance(source);
      const importDate = source.importedAt ? new Date(source.importedAt).toLocaleDateString() : '';

      html += `
        <div class="nav-item source-item" data-source-id="${source.id}" title="${provenanceInfo}">
          <i class="ph ${sourceIcon} source-icon"></i>
          <div class="source-info">
            <span class="source-name">${this._escapeHtml(this._truncateSourceName(source.name))}</span>
            <span class="source-meta-inline">${importDate}</span>
          </div>
          <span class="source-provenance-badge" title="GIVEN: Immutable import">◉</span>
          <span class="nav-item-count" title="${source.recordCount} records imported">${source.recordCount}</span>
        </div>
      `;
    }

    container.innerHTML = html;

    // Attach event handlers for source items
    container.querySelectorAll('.source-item').forEach(item => {
      item.addEventListener('click', () => {
        const sourceId = item.dataset.sourceId;
        this._showSourceDetail(sourceId);
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showSourceContextMenu(e, item.dataset.sourceId);
      });
    });
  }

  /**
   * Show source detail panel
   * Displays provenance information and derived sets
   */
  _showSourceDetail(sourceId) {
    // Find the source
    const source = this.sources?.find(s => s.id === sourceId) ||
      Array.from(this._getSourceRegistry().values()).find(s => s.id === sourceId);

    if (!source) {
      console.warn('Source not found:', sourceId);
      return;
    }

    // Find sets derived from this source
    const derivedSets = this.sets.filter(set => {
      const prov = set.datasetProvenance;
      if (!prov) return false;
      const sourceName = prov.originalFilename || prov.provenance?.source;
      return sourceName?.toLowerCase() === source.name.toLowerCase();
    });

    // Show in detail panel
    const detailBody = document.getElementById('detail-panel-body');
    if (!detailBody) return;

    detailBody.innerHTML = `
      <div class="source-detail">
        <div class="source-detail-header">
          <i class="ph ${this._getSourceIcon(source.name)} source-detail-icon"></i>
          <h3>${this._escapeHtml(source.name)}</h3>
          <span class="given-badge">GIVEN</span>
        </div>

        <div class="detail-section provenance-section">
          <h4><i class="ph ph-git-branch"></i> Provenance</h4>
          <div class="provenance-info">
            <div class="provenance-item">
              <span class="provenance-label">Imported:</span>
              <span class="provenance-value">${source.importedAt ? new Date(source.importedAt).toLocaleString() : 'Unknown'}</span>
            </div>
            ${source.provenance?.agent ? `
              <div class="provenance-item">
                <span class="provenance-label">Agent:</span>
                <span class="provenance-value">${source.provenance.agent}</span>
              </div>
            ` : ''}
            ${source.provenance?.method ? `
              <div class="provenance-item">
                <span class="provenance-label">Method:</span>
                <span class="provenance-value">${source.provenance.method}</span>
              </div>
            ` : ''}
            <div class="provenance-item">
              <span class="provenance-label">Records:</span>
              <span class="provenance-value">${source.recordCount}</span>
            </div>
          </div>
        </div>

        <div class="detail-section derived-sets-section">
          <h4><i class="ph ph-table"></i> Derived Sets (${derivedSets.length})</h4>
          <div class="derived-sets-list">
            ${derivedSets.map(set => `
              <div class="derived-set-item" data-set-id="${set.id}">
                <i class="${set.icon || 'ph ph-table'}"></i>
                <span>${this._escapeHtml(set.name)}</span>
                <span class="nav-item-count">${set.records?.length || 0}</span>
              </div>
            `).join('')}
            ${derivedSets.length === 0 ? `
              <div class="empty-hint">No sets derived from this source</div>
            ` : ''}
          </div>
        </div>

        <div class="detail-section immutability-notice">
          <i class="ph ph-lock"></i>
          <span>This source is immutable (read-only). To modify data, create a derived Set.</span>
        </div>
      </div>
    `;

    // Attach handlers for derived set items
    detailBody.querySelectorAll('.derived-set-item').forEach(item => {
      item.addEventListener('click', () => {
        this._selectSet(item.dataset.setId);
      });
    });

    // Show detail panel
    document.getElementById('detail-panel')?.classList.add('open');
  }

  /**
   * Get source registry from sets
   */
  _getSourceRegistry() {
    const registry = new Map();
    for (const set of this.sets) {
      const prov = set.datasetProvenance;
      if (prov && (prov.originalFilename || prov.provenance?.source)) {
        const sourceName = prov.originalFilename || prov.provenance?.source;
        const sourceKey = sourceName.toLowerCase();
        if (!registry.has(sourceKey)) {
          registry.set(sourceKey, {
            id: `src_${sourceKey.replace(/[^a-z0-9]/g, '_')}`,
            name: sourceName,
            importedAt: prov.importedAt,
            provenance: prov.provenance,
            recordCount: 0
          });
        }
        registry.get(sourceKey).recordCount += (set.records?.length || 0);
      }
    }
    return registry;
  }

  /**
   * Show context menu for source
   */
  _showSourceContextMenu(e, sourceId) {
    const menu = [
      { icon: 'ph-info', label: 'View Details', action: () => this._showSourceDetail(sourceId) },
      { icon: 'ph-table', label: 'Create Derived Set...', action: () => this._showCreateDerivedSetModal(sourceId) },
      { divider: true },
      { icon: 'ph-export', label: 'Export Source Data', action: () => this._exportSource(sourceId) }
    ];

    this._showContextMenu(e.pageX, e.pageY, menu);
  }

  /**
   * Get icon for source file type
   */
  _getSourceIcon(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'csv': return 'ph-file-csv';
      case 'json': return 'ph-file-code';
      case 'xlsx':
      case 'xls': return 'ph-file-xls';
      case 'ics': return 'ph-calendar-blank';
      default: return 'ph-file';
    }
  }

  /**
   * Truncate source name for display
   */
  _truncateSourceName(name) {
    if (name.length > 20) {
      return name.slice(0, 17) + '...';
    }
    return name;
  }

  /**
   * Format provenance info for tooltip
   */
  _formatSourceProvenance(source) {
    const parts = [];
    if (source.importedAt) {
      parts.push(`Imported: ${new Date(source.importedAt).toLocaleDateString()}`);
    }
    if (source.provenance?.agent) {
      parts.push(`From: ${source.provenance.agent}`);
    }
    if (source.provenance?.method) {
      parts.push(`Via: ${source.provenance.method}`);
    }
    return parts.join('\n') || source.name;
  }

  /**
   * Render workspaces navigation
   */
  _renderWorkspacesNav() {
    const container = document.getElementById('workspaces-nav');
    if (!container) return;

    const workspaces = this.viewRegistry?.getAllWorkspaces?.() || [];

    if (workspaces.length === 0) {
      container.innerHTML = `
        <div class="nav-item empty-hint" id="create-first-workspace">
          <i class="ph ph-plus-circle"></i>
          <span>Create Workspace</span>
        </div>
      `;
      container.querySelector('#create-first-workspace')?.addEventListener('click', () => {
        this._showNewWorkspaceModal();
      });
      return;
    }

    container.innerHTML = workspaces.map(workspace => `
      <div class="nav-item ${workspace.id === this.currentWorkspaceId ? 'active' : ''}"
           data-workspace-id="${workspace.id}">
        <i class="ph ${workspace.icon || 'ph-folder-simple'}"></i>
        <span>${this._escapeHtml(workspace.name)}</span>
        <span class="nav-item-badge" title="Horizon: ${workspace.epistemicStatus}">
          <i class="ph ph-eye"></i>
        </span>
      </div>
    `).join('');

    // Attach click handlers
    container.querySelectorAll('.nav-item[data-workspace-id]').forEach(item => {
      item.addEventListener('click', () => {
        this._selectWorkspace(item.dataset.workspaceId);
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showWorkspaceContextMenu(e, item.dataset.workspaceId);
      });
    });
  }

  /**
   * Render focuses navigation (filtered views)
   */
  _renderFocusesNav() {
    const container = document.getElementById('focuses-nav');
    if (!container) return;

    // Get focuses for current lens
    const focuses = this.viewRegistry?.getFocusesForLens?.(this.currentLensId || this.currentViewId) || [];

    if (focuses.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Calculate restriction ratios for each focus (Rule 5 visibility)
    const set = this.getCurrentSet();
    const totalRecords = set?.records?.length || 0;

    container.innerHTML = `
      <div class="nav-section-header">
        <span class="nav-section-title">Focuses</span>
        <span class="nav-section-hint" title="Rule 5: Focuses can only restrict, never expand">↓ Restrict</span>
        <button class="nav-section-action" id="btn-new-focus" title="Add Focus (Rule 5: Restrict only)">
          <i class="ph ph-funnel"></i>
        </button>
      </div>
      ${focuses.map(focus => {
        const focusRecords = this._getFilteredRecordCountForFocus(focus, set);
        const restrictionPercent = totalRecords > 0 ? Math.round((focusRecords / totalRecords) * 100) : 100;
        return `
        <div class="nav-item focus-item ${focus.id === this.currentFocusId ? 'active' : ''}"
             data-focus-id="${focus.id}"
             title="Rule 5: Restricts to ${focusRecords} of ${totalRecords} (${restrictionPercent}%)">
          <i class="ph ph-funnel"></i>
          <span>${this._escapeHtml(focus.name)}</span>
          <span class="focus-restriction-ratio">(${focusRecords}/${totalRecords})</span>
          <div class="focus-restriction-bar">
            <div class="focus-restriction-fill" style="width: ${restrictionPercent}%"></div>
          </div>
        </div>
      `;}).join('')}
    `;

    // Attach click handlers
    container.querySelectorAll('.nav-item[data-focus-id]').forEach(item => {
      item.addEventListener('click', () => {
        this._selectFocus(item.dataset.focusId);
      });
    });

    document.getElementById('btn-new-focus')?.addEventListener('click', () => {
      this._showNewFocusModal();
    });
  }

  /**
   * Select a workspace
   */
  _selectWorkspace(workspaceId) {
    this.currentWorkspaceId = workspaceId;
    this.viewRegistry?.setActiveWorkspace?.(workspaceId);

    // Get sets for this workspace
    const sets = this.viewRegistry?.getSetsForWorkspace?.(workspaceId) || [];
    if (sets.length > 0) {
      this._selectSet(sets[0].id);
    }

    this._renderSidebar();
    this._updateBreadcrumb();
    this._saveData();
  }

  /**
   * Select a focus
   */
  _selectFocus(focusId) {
    this.currentFocusId = focusId;
    this.viewRegistry?.setActiveFocus?.(focusId);
    this._renderView();
    this._renderFocusesNav();
    this._updateBreadcrumb();
  }

  /**
   * Clear focus (back to lens view)
   */
  _clearFocus() {
    this.currentFocusId = null;
    this.viewRegistry?.setActiveFocus?.(null);
    this._renderView();
    this._renderFocusesNav();
    this._updateBreadcrumb();
  }

  /**
   * Show notification
   */
  _showNotification(message) {
    // Simple notification - could be enhanced
    console.log('Notification:', message);
  }

  _renderSetsNav() {
    const container = this.elements.setsNav;
    if (!container) return;

    container.innerHTML = this.sets.map(set => `
      <div class="nav-item ${set.id === this.currentSetId ? 'active' : ''}"
           data-set-id="${set.id}">
        <i class="${set.icon || 'ph ph-table'}"></i>
        <span>${this._escapeHtml(set.name)}</span>
        <span class="nav-item-count">${set.records.length}</span>
      </div>
    `).join('');

    // Attach click handlers
    container.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const setId = item.dataset.setId;
        this._selectSet(setId);
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showSetContextMenu(e, item.dataset.setId);
      });
    });
  }

  _renderViewsNav() {
    const container = this.elements.viewsNav;
    const set = this.getCurrentSet();
    if (!container || !set) return;

    const viewIcons = {
      table: 'ph-table',
      cards: 'ph-cards',
      kanban: 'ph-kanban',
      calendar: 'ph-calendar-blank',
      graph: 'ph-graph',
      filesystem: 'ph-folder-open'
    };

    container.innerHTML = set.views.map(view => `
      <div class="nav-item ${view.id === this.currentViewId ? 'active' : ''}"
           data-view-id="${view.id}">
        <i class="ph ${viewIcons[view.type] || 'ph-table'}"></i>
        <span>${this._escapeHtml(view.name)}</span>
      </div>
    `).join('');

    // Attach click handlers
    container.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.dataset.viewId;
        this._selectView(viewId);
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showViewContextMenu(e, item.dataset.viewId);
      });
    });

    // Also render the tab bar
    this._renderTabBar();
  }

  // --------------------------------------------------------------------------
  // Browser-Style Tab Bar
  // --------------------------------------------------------------------------

  /**
   * Render the browser-style tab bar
   */
  _renderTabBar() {
    const container = this.elements.tabBarTabs;
    const set = this.getCurrentSet();
    if (!container) return;

    if (!set) {
      container.innerHTML = '';
      return;
    }

    const viewIcons = {
      table: 'ph-table',
      cards: 'ph-cards',
      kanban: 'ph-kanban',
      calendar: 'ph-calendar-blank',
      graph: 'ph-graph',
      filesystem: 'ph-folder-open'
    };

    container.innerHTML = set.views.map(view => `
      <div class="browser-tab ${view.id === this.currentViewId ? 'active' : ''}"
           data-view-id="${view.id}"
           draggable="true">
        <div class="tab-icon">
          <i class="ph ${viewIcons[view.type] || 'ph-table'}"></i>
        </div>
        <span class="tab-title">${this._escapeHtml(view.name)}</span>
        <div class="tab-modified"></div>
        <div class="tab-close" title="Close tab (Ctrl+W)">
          <i class="ph ph-x"></i>
        </div>
        ${view.id === this.currentViewId ? '<div class="tab-curve-right"></div>' : ''}
      </div>
    `).join('');

    // Attach event handlers to tabs
    this._attachTabEventHandlers();
    this._checkTabOverflow();
  }

  /**
   * Attach event handlers to tab elements
   */
  _attachTabEventHandlers() {
    const container = this.elements.tabBarTabs;
    if (!container) return;

    container.querySelectorAll('.browser-tab').forEach(tab => {
      const viewId = tab.dataset.viewId;

      // Click to select tab
      tab.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-close')) {
          this._selectView(viewId);
        }
      });

      // Middle-click to toss tab
      tab.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          this._tossTab(viewId);
        }
      });

      // Right-click context menu
      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showTabContextMenu(e, viewId);
      });

      // Close button
      tab.querySelector('.tab-close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this._tossTab(viewId);
      });

      // Drag and drop for reordering
      tab.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', viewId);
        tab.classList.add('dragging');
      });

      tab.addEventListener('dragend', () => {
        tab.classList.remove('dragging');
        container.querySelectorAll('.browser-tab').forEach(t => {
          t.classList.remove('drag-over', 'drag-over-right');
        });
      });

      tab.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingTab = container.querySelector('.dragging');
        if (draggingTab && draggingTab !== tab) {
          const rect = tab.getBoundingClientRect();
          const midpoint = rect.left + rect.width / 2;
          tab.classList.remove('drag-over', 'drag-over-right');
          if (e.clientX < midpoint) {
            tab.classList.add('drag-over');
          } else {
            tab.classList.add('drag-over-right');
          }
        }
      });

      tab.addEventListener('dragleave', () => {
        tab.classList.remove('drag-over', 'drag-over-right');
      });

      tab.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedViewId = e.dataTransfer.getData('text/plain');
        const targetViewId = viewId;
        if (draggedViewId !== targetViewId) {
          const rect = tab.getBoundingClientRect();
          const midpoint = rect.left + rect.width / 2;
          const insertAfter = e.clientX >= midpoint;
          this._reorderTabs(draggedViewId, targetViewId, insertAfter);
        }
        tab.classList.remove('drag-over', 'drag-over-right');
      });

      // Double-click to rename
      tab.addEventListener('dblclick', (e) => {
        if (!e.target.closest('.tab-close')) {
          this._renameTab(viewId);
        }
      });
    });
  }

  /**
   * Create a new tab
   */
  _createNewTab() {
    const set = this.getCurrentSet();
    if (!set) return;

    // Show a quick menu to choose view type
    this._showNewViewTypeMenu();
  }

  /**
   * Show menu to select new view type
   */
  _showNewViewTypeMenu() {
    const existing = document.querySelector('.tab-new-menu');
    if (existing) existing.remove();

    const btn = this.elements.newTabBtn;
    const rect = btn.getBoundingClientRect();

    const menu = document.createElement('div');
    menu.className = 'tab-context-menu tab-new-menu';
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;
    menu.innerHTML = `
      <div class="tab-context-item" data-type="table">
        <i class="ph ph-table"></i>
        <span>Table View</span>
      </div>
      <div class="tab-context-item" data-type="cards">
        <i class="ph ph-cards"></i>
        <span>Cards View</span>
      </div>
      <div class="tab-context-item" data-type="kanban">
        <i class="ph ph-kanban"></i>
        <span>Kanban View</span>
      </div>
      <div class="tab-context-item" data-type="calendar">
        <i class="ph ph-calendar-blank"></i>
        <span>Calendar View</span>
      </div>
      <div class="tab-context-item" data-type="graph">
        <i class="ph ph-graph"></i>
        <span>Graph View</span>
      </div>
    `;

    document.body.appendChild(menu);

    menu.querySelectorAll('.tab-context-item').forEach(item => {
      item.addEventListener('click', () => {
        const viewType = item.dataset.type;
        this._addNewTabOfType(viewType);
        menu.remove();
      });
    });

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', function closeMenu(e) {
        if (!e.target.closest('.tab-new-menu')) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      });
    }, 0);
  }

  /**
   * Add a new tab of specific type
   */
  _addNewTabOfType(viewType) {
    const set = this.getCurrentSet();
    if (!set) return;

    const viewCount = set.views.filter(v => v.type === viewType).length;
    const name = viewCount > 0
      ? `${viewType.charAt(0).toUpperCase() + viewType.slice(1)} View ${viewCount + 1}`
      : `${viewType.charAt(0).toUpperCase() + viewType.slice(1)} View`;

    const view = createView(name, viewType);
    set.views.push(view);
    this.currentViewId = view.id;

    // Remember this view for the current set
    if (this.currentSetId) {
      this.lastViewPerSet[this.currentSetId] = view.id;
    }

    this._renderViewsNav();
    this._renderView();
    this._updateBreadcrumb();
    this._saveData();
  }

  /**
   * Toss a tab - removes from view but nothing is ever deleted
   * Tossed items can be picked back up from the tossed items list
   * Shows undo toast for 5 seconds to allow recovery
   */
  _tossTab(viewId) {
    const set = this.getCurrentSet();
    if (!set || set.views.length <= 1) {
      // Can't toss the last tab
      this._showToast('Cannot toss the last tab', 'warning');
      return;
    }

    const viewIndex = set.views.findIndex(v => v.id === viewId);
    if (viewIndex === -1) return;

    const view = set.views[viewIndex];
    const wasCurrentView = this.currentViewId === viewId;

    // Toss to the tossed items pile (nothing is ever deleted)
    this.tossedItems.unshift({
      type: 'view',
      view: { ...view },
      setId: set.id,
      tossedAt: new Date().toISOString()
    });
    if (this.tossedItems.length > this.maxTossedItems) {
      this.tossedItems.pop();
    }

    // Remove the view from current set
    set.views.splice(viewIndex, 1);

    // If we're tossing the current view, switch to adjacent tab
    if (wasCurrentView) {
      const newIndex = Math.min(viewIndex, set.views.length - 1);
      this.currentViewId = set.views[newIndex]?.id;
      // Remember this view for the current set
      if (this.currentSetId && this.currentViewId) {
        this.lastViewPerSet[this.currentSetId] = this.currentViewId;
      }
    }

    this._renderViewsNav();
    this._renderView();
    this._updateBreadcrumb();
    this._saveData();

    // Show undo toast with countdown
    this._showToast(`Tossed "${view.name}"`, 'info', {
      countdown: 5000,
      action: {
        label: 'Undo',
        callback: () => {
          // Restore the view at its original position
          const tossedIndex = this.tossedItems.findIndex(
            t => t.type === 'view' && t.view.id === view.id
          );
          if (tossedIndex !== -1) {
            this.tossedItems.splice(tossedIndex, 1);
            // Re-insert at original position
            set.views.splice(viewIndex, 0, view);
            if (wasCurrentView) {
              this.currentViewId = view.id;
              // Remember this view for the current set
              if (this.currentSetId) {
                this.lastViewPerSet[this.currentSetId] = view.id;
              }
            }
            this._renderViewsNav();
            this._renderView();
            this._updateBreadcrumb();
            this._saveData();
            this._showToast(`Restored "${view.name}"`, 'success');
          }
        }
      }
    });
  }

  /**
   * Pick up the last tossed item (restore it)
   */
  _pickUpLastTossed() {
    if (this.tossedItems.length === 0) {
      this._showToast('Nothing in the tossed pile to pick up', 'info');
      return;
    }

    const tossedItem = this.tossedItems.shift();

    if (tossedItem.type === 'view') {
      const set = this.sets.find(s => s.id === tossedItem.setId);
      if (!set) {
        this._showToast('Original set no longer exists', 'warning');
        return;
      }

      // Restore the view
      set.views.push(tossedItem.view);
      this.currentViewId = tossedItem.view.id;

      if (this.currentSetId !== tossedItem.setId) {
        this.currentSetId = tossedItem.setId;
        this._renderSidebar();
      }

      // Remember this view for the set (use tossedItem.setId as that's the current set now)
      this.lastViewPerSet[tossedItem.setId] = tossedItem.view.id;

      this._renderViewsNav();
      this._renderView();
      this._updateBreadcrumb();
      this._saveData();
      this._showToast(`Picked up view "${tossedItem.view.name}"`, 'success');
    } else if (tossedItem.type === 'record') {
      const set = this.sets.find(s => s.id === tossedItem.setId);
      if (!set) {
        this._showToast('Original set no longer exists', 'warning');
        return;
      }

      // Restore the record
      set.records.push(tossedItem.record);

      if (this.currentSetId !== tossedItem.setId) {
        this.currentSetId = tossedItem.setId;
        this._renderSidebar();
      }

      this._renderView();
      this._saveData();
      this._showToast('Picked up record', 'success');
    }
  }

  /**
   * Pick up data from various sources (field, column, record, view)
   * This allows users to "grab" data and move/copy it elsewhere
   */
  _pickUp(type, data, source) {
    this.pickedUp = {
      type,      // 'field', 'column', 'record', 'view', 'selection'
      data,      // The actual data being picked up
      source,    // Where it came from { setId, viewId, recordId?, fieldId? }
      pickedAt: new Date().toISOString()
    };

    // Update UI to show something is picked up
    this._updatePickedUpIndicator();
    this._showToast(`Picked up ${type}`, 'info');
  }

  /**
   * Put down (drop) the currently picked up item
   */
  _putDown(targetType, target) {
    if (!this.pickedUp) {
      this._showToast('Nothing picked up to put down', 'warning');
      return;
    }

    const { type, data, source } = this.pickedUp;

    // Handle different put down scenarios
    switch (targetType) {
      case 'field':
        // Put field value into another field
        if (type === 'field') {
          this._putFieldIntoField(data, target);
        }
        break;
      case 'record':
        // Put data into a record
        if (type === 'record') {
          this._mergeRecords(data, target);
        }
        break;
      case 'view':
        // Add record(s) to a view's set
        if (type === 'record' || type === 'selection') {
          this._addToSet(data, target);
        }
        break;
    }

    this._clearPickedUp();
  }

  /**
   * Clear the picked up state
   */
  _clearPickedUp() {
    this.pickedUp = null;
    this._updatePickedUpIndicator();
  }

  /**
   * Update the UI to show what's currently picked up
   */
  _updatePickedUpIndicator() {
    let indicator = document.getElementById('picked-up-indicator');

    if (!this.pickedUp) {
      if (indicator) indicator.remove();
      document.body.classList.remove('has-picked-up');
      return;
    }

    document.body.classList.add('has-picked-up');

    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'picked-up-indicator';
      indicator.className = 'picked-up-indicator';
      document.body.appendChild(indicator);
    }

    const typeIcons = {
      field: 'ph-text-aa',
      column: 'ph-columns',
      record: 'ph-rows',
      view: 'ph-table',
      selection: 'ph-selection'
    };

    const typeLabels = {
      field: 'cell value',
      column: 'column',
      record: 'record',
      view: 'view',
      selection: `${this.selectedRecords?.size || 0} records`
    };

    indicator.innerHTML = `
      <div class="picked-up-content">
        <i class="ph ${typeIcons[this.pickedUp.type] || 'ph-hand-grabbing'}"></i>
        <span>Holding ${typeLabels[this.pickedUp.type] || this.pickedUp.type}</span>
        <button class="picked-up-drop" title="Put down (Esc)">
          <i class="ph ph-x"></i>
        </button>
      </div>
    `;

    indicator.querySelector('.picked-up-drop')?.addEventListener('click', () => {
      this._clearPickedUp();
      this._showToast('Dropped picked up item', 'info');
    });
  }

  /**
   * Reorder tabs via drag and drop
   */
  _reorderTabs(draggedViewId, targetViewId, insertAfter) {
    const set = this.getCurrentSet();
    if (!set) return;

    const draggedIndex = set.views.findIndex(v => v.id === draggedViewId);
    const targetIndex = set.views.findIndex(v => v.id === targetViewId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const [draggedView] = set.views.splice(draggedIndex, 1);
    let insertIndex = targetIndex;
    if (draggedIndex < targetIndex) insertIndex--;
    if (insertAfter) insertIndex++;

    set.views.splice(insertIndex, 0, draggedView);

    this._renderViewsNav();
    this._saveData();
  }

  /**
   * Rename a tab
   */
  _renameTab(viewId) {
    const set = this.getCurrentSet();
    const view = set?.views.find(v => v.id === viewId);
    if (!view) return;

    const tab = this.elements.tabBarTabs?.querySelector(`[data-view-id="${viewId}"]`);
    if (!tab) return;

    const titleEl = tab.querySelector('.tab-title');
    const currentName = view.name;

    // Create inline input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'tab-rename-input';
    input.style.cssText = `
      flex: 1;
      background: var(--bg-tertiary);
      border: 1px solid var(--primary-500);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 13px;
      color: var(--text-primary);
      outline: none;
    `;

    titleEl.replaceWith(input);
    input.focus();
    input.select();

    const finishRename = () => {
      const newName = input.value.trim() || currentName;
      view.name = newName;

      const newTitle = document.createElement('span');
      newTitle.className = 'tab-title';
      newTitle.textContent = newName;
      input.replaceWith(newTitle);

      this._renderViewsNav();
      this._saveData();
    };

    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        input.value = currentName;
        input.blur();
      }
    });
  }

  /**
   * Check if tabs overflow and show scroll buttons
   */
  _checkTabOverflow() {
    const container = this.elements.tabBarTabs;
    if (!container) return;

    const hasOverflow = container.scrollWidth > container.clientWidth;
    const scrollLeft = this.elements.tabScrollLeft;
    const scrollRight = this.elements.tabScrollRight;

    if (hasOverflow) {
      scrollLeft.style.display = container.scrollLeft > 0 ? 'flex' : 'none';
      scrollRight.style.display =
        container.scrollLeft < container.scrollWidth - container.clientWidth
          ? 'flex'
          : 'none';
    } else {
      scrollLeft.style.display = 'none';
      scrollRight.style.display = 'none';
    }
  }

  /**
   * Scroll tabs in direction
   */
  _scrollTabs(direction) {
    const container = this.elements.tabBarTabs;
    if (!container) return;

    const scrollAmount = 200;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });

    setTimeout(() => this._checkTabOverflow(), 300);
  }

  /**
   * Toggle tab list dropdown
   */
  _toggleTabListDropdown() {
    if (this.tabListDropdownOpen) {
      this._closeTabListDropdown();
    } else {
      this._openTabListDropdown();
    }
  }

  /**
   * Open tab list dropdown
   */
  _openTabListDropdown() {
    this._closeTabListDropdown(); // Remove any existing

    const set = this.getCurrentSet();
    if (!set) return;

    const btn = this.elements.tabListBtn;
    const tabBar = this.elements.tabBar;

    const dropdown = document.createElement('div');
    dropdown.className = 'tab-list-dropdown';
    dropdown.innerHTML = `
      <div class="tab-list-header">
        <h4>Open Tabs</h4>
        <span>${set.views.length} tabs</span>
      </div>
      <div class="tab-list-body">
        <div class="tab-list-section">
          ${set.views.map(view => `
            <div class="tab-list-item ${view.id === this.currentViewId ? 'active' : ''}"
                 data-view-id="${view.id}">
              <div class="tab-list-item-icon">
                <i class="ph ${this._getViewIcon(view.type)}"></i>
              </div>
              <span class="tab-list-item-title">${this._escapeHtml(view.name)}</span>
              ${set.views.length > 1 ? `
                <div class="tab-list-item-toss" data-view-id="${view.id}" title="Toss">
                  <i class="ph ph-arrow-bend-up-right"></i>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ${this.tossedItems.length > 0 ? `
          <div class="tab-list-section tossed-pile">
            <div class="tab-list-section-title">
              <i class="ph ph-hand-grabbing"></i>
              Tossed (Pick Up)
            </div>
            ${this.tossedItems.slice(0, 5).map((item, index) => {
              if (item.type === 'view') {
                return `
                  <div class="tab-list-item" data-pickup-index="${index}">
                    <div class="tab-list-item-icon">
                      <i class="ph ${this._getViewIcon(item.view.type)}"></i>
                    </div>
                    <span class="tab-list-item-title">${this._escapeHtml(item.view.name)}</span>
                    <span class="tab-list-item-hint">view</span>
                  </div>
                `;
              } else if (item.type === 'record') {
                const primaryValue = Object.values(item.record.values)[0] || 'Untitled';
                return `
                  <div class="tab-list-item" data-pickup-index="${index}">
                    <div class="tab-list-item-icon">
                      <i class="ph ph-rows"></i>
                    </div>
                    <span class="tab-list-item-title">${this._escapeHtml(String(primaryValue).slice(0, 30))}</span>
                    <span class="tab-list-item-hint">record</span>
                  </div>
                `;
              }
              return '';
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;

    tabBar.appendChild(dropdown);
    this.tabListDropdownOpen = true;

    // Attach handlers
    dropdown.querySelectorAll('.tab-list-item[data-view-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-list-item-toss')) {
          this._selectView(item.dataset.viewId);
          this._closeTabListDropdown();
        }
      });
    });

    dropdown.querySelectorAll('.tab-list-item-toss').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._tossTab(btn.dataset.viewId);
        // Re-render dropdown
        this._closeTabListDropdown();
        this._openTabListDropdown();
      });
    });

    dropdown.querySelectorAll('.tab-list-item[data-pickup-index]').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.pickupIndex, 10);
        if (index >= 0 && index < this.tossedItems.length) {
          const tossedItem = this.tossedItems.splice(index, 1)[0];
          const set = this.sets.find(s => s.id === tossedItem.setId);

          if (set) {
            if (tossedItem.type === 'view') {
              set.views.push(tossedItem.view);
              this.currentViewId = tossedItem.view.id;
              // Remember this view for the set
              this.lastViewPerSet[tossedItem.setId] = tossedItem.view.id;
              this._renderViewsNav();
              this._renderView();
              this._saveData();
              this._showToast(`Picked up view "${tossedItem.view.name}"`, 'success');
            } else if (tossedItem.type === 'record') {
              set.records.push(tossedItem.record);
              this._renderView();
              this._saveData();
              this._showToast('Picked up record', 'success');
            }
          }
        }
        this._closeTabListDropdown();
      });
    });
  }

  /**
   * Close tab list dropdown
   */
  _closeTabListDropdown() {
    const dropdown = document.querySelector('.tab-list-dropdown');
    if (dropdown) dropdown.remove();
    this.tabListDropdownOpen = false;
  }

  /**
   * Show tab context menu
   */
  _showTabContextMenu(e, viewId) {
    this._closeTabContextMenu();

    const set = this.getCurrentSet();
    const view = set?.views.find(v => v.id === viewId);
    if (!view) return;

    const viewIndex = set.views.findIndex(v => v.id === viewId);
    const isFirst = viewIndex === 0;
    const isLast = viewIndex === set.views.length - 1;
    const canClose = set.views.length > 1;

    const menu = document.createElement('div');
    menu.className = 'tab-context-menu';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.innerHTML = `
      <div class="tab-context-item" data-action="duplicate">
        <i class="ph ph-copy"></i>
        <span>Duplicate Tab</span>
      </div>
      <div class="tab-context-item" data-action="rename">
        <i class="ph ph-pencil"></i>
        <span>Rename Tab</span>
      </div>
      <div class="tab-context-separator"></div>
      <div class="tab-context-item ${isFirst ? 'disabled' : ''}" data-action="move-left">
        <i class="ph ph-arrow-left"></i>
        <span>Move Left</span>
      </div>
      <div class="tab-context-item ${isLast ? 'disabled' : ''}" data-action="move-right">
        <i class="ph ph-arrow-right"></i>
        <span>Move Right</span>
      </div>
      <div class="tab-context-separator"></div>
      <div class="tab-context-item ${canClose ? '' : 'disabled'}" data-action="toss">
        <i class="ph ph-arrow-bend-up-right"></i>
        <span>Toss Tab</span>
        <span class="shortcut">Ctrl+W</span>
      </div>
      <div class="tab-context-item ${canClose && set.views.length > 1 ? '' : 'disabled'}" data-action="toss-others">
        <i class="ph ph-arrows-out-line-horizontal"></i>
        <span>Toss Other Tabs</span>
      </div>
      <div class="tab-context-item ${canClose && !isLast ? '' : 'disabled'}" data-action="toss-right">
        <i class="ph ph-arrow-line-right"></i>
        <span>Toss Tabs to the Right</span>
      </div>
      <div class="tab-context-separator"></div>
      <div class="tab-context-item" data-action="toggle-provenance">
        <i class="ph ${view.config.showProvenance ? 'ph-check-square' : 'ph-square'}"></i>
        <span>Show Provenance</span>
      </div>
    `;

    document.body.appendChild(menu);
    this.tabContextMenuOpen = true;

    // Position adjustment if off-screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${window.innerHeight - rect.height - 8}px`;
    }

    // Attach handlers
    menu.querySelectorAll('.tab-context-item:not(.disabled)').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this._handleTabContextAction(action, viewId);
        this._closeTabContextMenu();
      });
    });
  }

  /**
   * Handle tab context menu action
   */
  _handleTabContextAction(action, viewId) {
    const set = this.getCurrentSet();
    if (!set) return;

    const viewIndex = set.views.findIndex(v => v.id === viewId);
    const view = set.views[viewIndex];

    switch (action) {
      case 'duplicate':
        const dupView = createView(`${view.name} (Copy)`, view.type, { ...view.config });
        set.views.splice(viewIndex + 1, 0, dupView);
        this.currentViewId = dupView.id;
        // Remember this view for the current set
        if (this.currentSetId) {
          this.lastViewPerSet[this.currentSetId] = dupView.id;
        }
        this._renderViewsNav();
        this._renderView();
        this._saveData();
        break;

      case 'rename':
        this._renameTab(viewId);
        break;

      case 'move-left':
        if (viewIndex > 0) {
          [set.views[viewIndex - 1], set.views[viewIndex]] = [set.views[viewIndex], set.views[viewIndex - 1]];
          this._renderViewsNav();
          this._saveData();
        }
        break;

      case 'move-right':
        if (viewIndex < set.views.length - 1) {
          [set.views[viewIndex], set.views[viewIndex + 1]] = [set.views[viewIndex + 1], set.views[viewIndex]];
          this._renderViewsNav();
          this._saveData();
        }
        break;

      case 'toss':
        this._tossTab(viewId);
        break;

      case 'toss-others':
        const viewsToToss = set.views.filter(v => v.id !== viewId);
        viewsToToss.forEach(v => {
          this.tossedItems.unshift({
            type: 'view',
            view: { ...v },
            setId: set.id,
            tossedAt: new Date().toISOString()
          });
        });
        set.views = [view];
        this.currentViewId = viewId;
        // Remember this view for the current set
        if (this.currentSetId) {
          this.lastViewPerSet[this.currentSetId] = viewId;
        }
        this._renderViewsNav();
        this._renderView();
        this._saveData();
        this._showToast(`Tossed ${viewsToToss.length} tabs`, 'info');
        break;

      case 'toss-right':
        const rightViews = set.views.slice(viewIndex + 1);
        rightViews.forEach(v => {
          this.tossedItems.unshift({
            type: 'view',
            view: { ...v },
            setId: set.id,
            tossedAt: new Date().toISOString()
          });
        });
        set.views = set.views.slice(0, viewIndex + 1);
        if (!set.views.find(v => v.id === this.currentViewId)) {
          this.currentViewId = viewId;
          // Remember this view for the current set
          if (this.currentSetId) {
            this.lastViewPerSet[this.currentSetId] = viewId;
          }
        }
        this._renderViewsNav();
        this._renderView();
        this._saveData();
        this._showToast(`Tossed ${rightViews.length} tabs`, 'info');
        break;

      case 'toggle-provenance':
        view.config.showProvenance = !view.config.showProvenance;
        this._renderView();
        this._saveData();
        this._showToast(view.config.showProvenance ? 'Provenance visible' : 'Provenance hidden', 'info');
        break;
    }
  }

  /**
   * Close tab context menu
   */
  _closeTabContextMenu() {
    const menu = document.querySelector('.tab-context-menu:not(.tab-new-menu)');
    if (menu) menu.remove();
    this.tabContextMenuOpen = false;
  }

  /**
   * Get view type icon class
   */
  _getViewIcon(viewType) {
    const icons = {
      table: 'ph-table',
      cards: 'ph-cards',
      kanban: 'ph-kanban',
      calendar: 'ph-calendar-blank',
      graph: 'ph-graph'
    };
    return icons[viewType] || 'ph-table';
  }

  /**
   * Navigate to next tab
   */
  _nextTab() {
    const set = this.getCurrentSet();
    if (!set || set.views.length <= 1) return;

    const currentIndex = set.views.findIndex(v => v.id === this.currentViewId);
    const nextIndex = (currentIndex + 1) % set.views.length;
    this._selectView(set.views[nextIndex].id);
  }

  /**
   * Navigate to previous tab
   */
  _prevTab() {
    const set = this.getCurrentSet();
    if (!set || set.views.length <= 1) return;

    const currentIndex = set.views.findIndex(v => v.id === this.currentViewId);
    const prevIndex = (currentIndex - 1 + set.views.length) % set.views.length;
    this._selectView(set.views[prevIndex].id);
  }

  /**
   * Toss current tab
   */
  _tossCurrentTab() {
    if (this.currentViewId) {
      this._tossTab(this.currentViewId);
    }
  }

  _selectSet(setId) {
    this.currentSetId = setId;

    // Lazy load records for this set if needed
    if (this._useLazyLoading) {
      this._loadSetRecords(setId);
    }

    const set = this.getCurrentSet();

    // Use remembered view for this set, or fall back to first view
    const rememberedViewId = this.lastViewPerSet[setId];
    const rememberedView = rememberedViewId && set?.views.find(v => v.id === rememberedViewId);
    this.currentViewId = rememberedView ? rememberedViewId : set?.views[0]?.id;

    this._renderSidebar();
    this._renderView();
    this._updateBreadcrumb();
    this._saveData();
  }

  _selectView(viewId) {
    this.currentViewId = viewId;

    // Remember this view for the current set
    if (this.currentSetId) {
      this.lastViewPerSet[this.currentSetId] = viewId;
    }

    // Update view switcher
    const view = this.getCurrentView();
    document.querySelectorAll('.view-switch-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view?.type);
    });

    this._renderViewsNav();
    this._renderView();
    this._updateBreadcrumb();
    this._saveData();
  }

  _switchViewType(viewType) {
    const set = this.getCurrentSet();
    if (!set) return;

    // Find or create a view of this type
    let view = set.views.find(v => v.type === viewType);
    if (!view) {
      view = createView(`${viewType.charAt(0).toUpperCase() + viewType.slice(1)} View`, viewType);
      set.views.push(view);
      this._renderViewsNav();
    }

    this.currentViewId = view.id;

    // Remember this view for the current set
    if (this.currentSetId) {
      this.lastViewPerSet[this.currentSetId] = view.id;
    }

    // Update view switcher buttons
    document.querySelectorAll('.view-switch-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewType);
    });

    this._renderView();
    this._updateBreadcrumb();
    this._saveData();
  }

  _updateBreadcrumb() {
    const workspace = this.viewRegistry?.getWorkspace?.(this.currentWorkspaceId);
    const set = this.getCurrentSet();
    const view = this.getCurrentView();
    const focus = this.viewRegistry?.getFocus?.(this.currentFocusId);

    // Calculate restriction ratio for EO Rule 5 visibility
    const totalRecords = set?.records?.length || 0;
    const visibleRecords = focus ? this._getFilteredRecordCount(focus) : totalRecords;
    const restrictionRatio = totalRecords > 0 ? `${visibleRecords} of ${totalRecords}` : '';

    // Workspace breadcrumb - CLICKABLE (ascend hierarchy)
    const workspaceBreadcrumb = document.getElementById('current-workspace-name');
    if (workspaceBreadcrumb) {
      workspaceBreadcrumb.innerHTML = `
        <i class="ph ${workspace?.icon || 'ph-folder-simple'}"></i>
        ${this._escapeHtml(workspace?.name || 'Workspace')}
        <i class="ph ph-caret-down breadcrumb-dropdown-icon"></i>
      `;
      workspaceBreadcrumb.classList.add('breadcrumb-clickable');
      workspaceBreadcrumb.onclick = () => this._showWorkspaceBreadcrumbMenu(workspaceBreadcrumb);
      // Log navigation activity with EO operator
      this._logNavigationActivity('DES', 'workspace', workspace?.id);
    }

    // Set breadcrumb - CLICKABLE (shows sibling sets)
    if (this.elements.currentSetName) {
      const provenanceIcon = this._getProvenanceStatusIcon(set);
      this.elements.currentSetName.innerHTML = `
        <span class="breadcrumb-provenance-icon" title="Provenance: ${this._getProvenanceTooltip(set)}">${provenanceIcon}</span>
        ${this._escapeHtml(set?.name || 'No Set')}
        <i class="ph ph-caret-down breadcrumb-dropdown-icon"></i>
      `;
      this.elements.currentSetName.classList.add('breadcrumb-clickable');
      this.elements.currentSetName.onclick = () => this._showSetBreadcrumbMenu(this.elements.currentSetName);
    }

    // View/Lens breadcrumb - CLICKABLE (shows sibling lenses)
    if (this.elements.currentViewName) {
      const epistemicBadge = this._getEpistemicStatusBadge(view);
      this.elements.currentViewName.innerHTML = `
        <i class="ph ${this._getLensIcon(view?.type)}"></i>
        ${this._escapeHtml(view?.name || 'No Lens')}
        ${epistemicBadge}
        <i class="ph ph-caret-down breadcrumb-dropdown-icon"></i>
      `;
      this.elements.currentViewName.classList.add('breadcrumb-clickable');
      this.elements.currentViewName.onclick = () => this._showLensBreadcrumbMenu(this.elements.currentViewName);
    }

    // Focus breadcrumb (only show if a focus is active) - shows RESTRICTION RATIO (Rule 5)
    const focusBreadcrumb = document.getElementById('current-focus-name');
    if (focusBreadcrumb) {
      if (focus) {
        focusBreadcrumb.innerHTML = `
          <i class="ph ph-caret-right"></i>
          <i class="ph ph-funnel"></i>
          ${this._escapeHtml(focus.name)}
          <span class="breadcrumb-restriction-ratio" title="Rule 5: Focus restricts to ${restrictionRatio}">(${restrictionRatio})</span>
          <button class="breadcrumb-clear" title="Clear focus (expand horizon)" onclick="getDataWorkbench()?._clearFocus()">
            <i class="ph ph-x"></i>
          </button>
        `;
        focusBreadcrumb.style.display = 'inline-flex';
      } else {
        focusBreadcrumb.style.display = 'none';
      }
    }

    // Update horizon transparency panel
    this._updateHorizonPanel(workspace, set, view, focus, totalRecords, visibleRecords);
  }

  /**
   * Get filtered record count for a focus (Rule 5 restriction calculation)
   */
  _getFilteredRecordCount(focus) {
    const set = this.getCurrentSet();
    return this._getFilteredRecordCountForFocus(focus, set);
  }

  /**
   * Get filtered record count for a focus with explicit set (Rule 5)
   */
  _getFilteredRecordCountForFocus(focus, set) {
    if (!set || !focus?.restrictions?.filters) return set?.records?.length || 0;

    let records = set.records || [];
    for (const filter of focus.restrictions.filters) {
      records = records.filter(r => this._matchesFilter(r, filter));
    }
    return records.length;
  }

  /**
   * Get provenance status icon (◉ full, ◐ partial, ○ none)
   */
  _getProvenanceStatusIcon(set) {
    if (!set) return '○';
    const prov = set.datasetProvenance;
    if (!prov) return '○';

    // Count filled provenance elements
    let filled = 0;
    if (prov.originalFilename) filled++;
    if (prov.importedAt) filled++;
    if (prov.provenance?.agent) filled++;
    if (prov.provenance?.method) filled++;
    if (prov.provenance?.source) filled++;

    if (filled >= 4) return '◉'; // Full provenance
    if (filled >= 1) return '◐'; // Partial provenance
    return '○'; // No provenance
  }

  /**
   * Get provenance tooltip text
   */
  _getProvenanceTooltip(set) {
    if (!set?.datasetProvenance) return 'No provenance (MEANT without GIVEN chain)';
    const prov = set.datasetProvenance;
    const parts = [];
    if (prov.originalFilename) parts.push(`Source: ${prov.originalFilename}`);
    if (prov.importedAt) parts.push(`Imported: ${new Date(prov.importedAt).toLocaleDateString()}`);
    if (prov.provenance?.method) parts.push(`Method: ${prov.provenance.method}`);
    if (prov.provenance?.agent) parts.push(`Agent: ${prov.provenance.agent}`);
    return parts.join(' | ') || 'Partial provenance';
  }

  /**
   * Get epistemic status badge for view (Rule 8)
   */
  _getEpistemicStatusBadge(view) {
    const status = view?.epistemicStatus || 'preliminary';
    const badges = {
      'preliminary': '<span class="epistemic-badge preliminary" title="Preliminary interpretation">○</span>',
      'reviewed': '<span class="epistemic-badge reviewed" title="Reviewed interpretation">✓</span>',
      'contested': '<span class="epistemic-badge contested" title="Contested interpretation">⚠</span>',
      'superseded': '<span class="epistemic-badge superseded" title="Superseded (see newer version)">⊘</span>'
    };
    return badges[status] || badges['preliminary'];
  }

  /**
   * Show workspace breadcrumb dropdown menu (sibling workspaces)
   */
  _showWorkspaceBreadcrumbMenu(element) {
    const workspaces = this.viewRegistry?.getAllWorkspaces?.() || [];
    this._showBreadcrumbDropdown(element, workspaces.map(ws => ({
      id: ws.id,
      name: ws.name,
      icon: ws.icon || 'ph-folder-simple',
      active: ws.id === this.currentWorkspaceId,
      onClick: () => this._selectWorkspace(ws.id)
    })), 'Workspaces (Horizons)');
  }

  /**
   * Show set breadcrumb dropdown menu (sibling sets)
   */
  _showSetBreadcrumbMenu(element) {
    const sets = this.sets || [];
    this._showBreadcrumbDropdown(element, sets.map(s => ({
      id: s.id,
      name: s.name,
      icon: s.icon || 'ph-table',
      badge: this._getProvenanceStatusIcon(s),
      active: s.id === this.currentSetId,
      onClick: () => this._selectSet(s.id)
    })), 'Sets (Data Collections)');
  }

  /**
   * Show lens breadcrumb dropdown menu (sibling lenses)
   */
  _showLensBreadcrumbMenu(element) {
    const set = this.getCurrentSet();
    const views = set?.views || [];
    this._showBreadcrumbDropdown(element, views.map(v => ({
      id: v.id,
      name: v.name,
      icon: this._getLensIcon(v.type),
      badge: this._getEpistemicStatusBadge(v),
      active: v.id === this.currentViewId,
      onClick: () => this._selectView(v.id)
    })), 'Lenses (Interpretations)');
  }

  /**
   * Show breadcrumb dropdown menu
   */
  _showBreadcrumbDropdown(anchor, items, title) {
    // Remove existing dropdown
    document.querySelector('.breadcrumb-dropdown')?.remove();

    const rect = anchor.getBoundingClientRect();
    const dropdown = document.createElement('div');
    dropdown.className = 'breadcrumb-dropdown';
    dropdown.innerHTML = `
      <div class="breadcrumb-dropdown-header">${title}</div>
      ${items.map(item => `
        <div class="breadcrumb-dropdown-item ${item.active ? 'active' : ''}" data-id="${item.id}">
          <i class="ph ${item.icon}"></i>
          <span>${this._escapeHtml(item.name)}</span>
          ${item.badge ? `<span class="breadcrumb-dropdown-badge">${item.badge}</span>` : ''}
        </div>
      `).join('')}
    `;
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${rect.left}px`;
    document.body.appendChild(dropdown);

    // Attach click handlers
    items.forEach((item, idx) => {
      dropdown.querySelectorAll('.breadcrumb-dropdown-item')[idx]?.addEventListener('click', () => {
        item.onClick();
        dropdown.remove();
      });
    });

    // Close on outside click
    const closeHandler = (e) => {
      if (!dropdown.contains(e.target) && !anchor.contains(e.target)) {
        dropdown.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }

  /**
   * Update horizon transparency panel (Rule 4: Perspectivality)
   */
  _updateHorizonPanel(workspace, set, view, focus, totalRecords, visibleRecords) {
    let panel = document.getElementById('horizon-transparency-panel');
    if (!panel) {
      // Create panel if it doesn't exist
      panel = document.createElement('div');
      panel.id = 'horizon-transparency-panel';
      panel.className = 'horizon-panel';
      document.querySelector('.header-left')?.appendChild(panel);
    }

    const horizonType = focus ? 'FOCUS' : (view ? 'LENS' : (set ? 'SET' : 'WORKSPACE'));
    const restrictionPercent = totalRecords > 0 ? Math.round((visibleRecords / totalRecords) * 100) : 100;

    panel.innerHTML = `
      <div class="horizon-indicator" title="Current Horizon (Rule 4: No view from nowhere)">
        <i class="ph ph-eye"></i>
        <span class="horizon-level">${horizonType}</span>
        <span class="horizon-scope">${visibleRecords}/${totalRecords}</span>
        <div class="horizon-bar">
          <div class="horizon-bar-fill" style="width: ${restrictionPercent}%"></div>
        </div>
      </div>
    `;
  }

  /**
   * Log navigation activity with EO operator (Rule 6, 7)
   */
  _logNavigationActivity(operator, targetType, targetId) {
    if (!this.navigationLog) this.navigationLog = [];

    const operators = {
      'SEG': '｜', // Segment: restrict scope
      'ALT': '∿', // Alternate: switch interpretation
      'DES': '⊡', // Designate: reveal/name
      'NUL': '∅'  // Recognition: search
    };

    this.navigationLog.push({
      timestamp: new Date().toISOString(),
      operator: operator,
      operatorSymbol: operators[operator] || operator,
      targetType: targetType,
      targetId: targetId,
      context: {
        workspaceId: this.currentWorkspaceId,
        setId: this.currentSetId,
        viewId: this.currentViewId,
        focusId: this.currentFocusId
      }
    });

    // Keep last 50 navigation actions
    if (this.navigationLog.length > 50) {
      this.navigationLog = this.navigationLog.slice(-50);
    }
  }

  /**
   * Get icon for lens type
   */
  _getLensIcon(viewType) {
    const icons = {
      'table': 'ph-table',
      'grid': 'ph-table',
      'cards': 'ph-cards',
      'kanban': 'ph-kanban',
      'calendar': 'ph-calendar-blank',
      'graph': 'ph-graph',
      'timeline': 'ph-timeline'
    };
    return icons[viewType] || 'ph-table';
  }

  // --------------------------------------------------------------------------
  // View Rendering
  // --------------------------------------------------------------------------

  _renderView() {
    const view = this.getCurrentView();
    if (!view) {
      this._renderEmptyState();
      return;
    }

    // Reset displayed record count when switching views
    // Use smaller initial batch for faster first paint
    this.displayedRecordCount = this.initialBatchSize;

    // Check if we need to show loading for large datasets
    const records = this.getFilteredRecords();
    const needsLoading = records.length > this.loadingThreshold;

    if (needsLoading) {
      this._showLoadingOverlay('Loading view...', {
        showProgress: records.length > 200,
        progress: 0,
        progressText: `Preparing ${records.length.toLocaleString()} records...`
      });

      // Use requestAnimationFrame to allow the loading UI to render
      requestAnimationFrame(() => {
        this._doRenderView(view);
        this._hideLoadingOverlay();
        this._updateStatus();
      });
    } else {
      this._doRenderView(view);
      this._updateStatus();
    }
  }

  /**
   * Actually perform the view rendering (called after loading indicator is shown)
   */
  _doRenderView(view) {
    switch (view.type) {
      case 'table':
        this._renderTableView();
        break;
      case 'cards':
        this._renderCardsView();
        break;
      case 'kanban':
        this._renderKanbanView();
        break;
      case 'calendar':
        this._renderCalendarView();
        break;
      case 'graph':
        this._renderGraphView();
        break;
      case 'filesystem':
        this._renderFilesystemView();
        break;
      default:
        this._renderTableView();
    }
  }

  _renderEmptyState() {
    this.elements.contentArea.innerHTML = `
      <div class="data-import-landing">
        <!-- Clio Events Export Section -->
        <div class="import-section">
          <div class="import-section-header">
            <i class="ph ph-scales"></i>
            <h3 class="import-section-title">Clio Events Export</h3>
          </div>

          <div class="import-subsection">
            <span class="import-subsection-label">Google Calendar events</span>
            <div class="ics-dropzone" id="ics-dropzone">
              <div class="dropzone-content">
                <i class="ph ph-calendar-blank dropzone-icon"></i>
                <p class="dropzone-text">Drop ICS or click</p>
              </div>
              <input type="file" id="ics-file-input" accept=".ics" hidden>
            </div>
          </div>

          <button class="btn btn-primary btn-generate" id="btn-generate-content" disabled>
            <i class="ph ph-sparkle"></i>
            Generate Events, Relationships &amp; Case Content
          </button>
        </div>

        <!-- Divider -->
        <div class="import-divider">
          <span>or</span>
        </div>

        <!-- General Import Section -->
        <div class="import-section import-section-secondary">
          <button class="btn btn-secondary" id="empty-import-data">
            <i class="ph ph-download"></i>
            Import CSV, JSON, or Excel
          </button>
          <button class="btn btn-secondary" id="empty-create-set">
            <i class="ph ph-plus"></i>
            Create Empty Set
          </button>
        </div>
      </div>
    `;

    // ICS Dropzone handlers
    const icsDropzone = document.getElementById('ics-dropzone');
    const icsFileInput = document.getElementById('ics-file-input');
    const generateBtn = document.getElementById('btn-generate-content');

    icsDropzone?.addEventListener('click', () => icsFileInput?.click());

    icsFileInput?.addEventListener('change', async (e) => {
      if (e.target.files[0]) {
        await this._handleICSFileSelect(e.target.files[0], icsDropzone, generateBtn);
      }
    });

    icsDropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      icsDropzone.classList.add('dragover');
    });

    icsDropzone?.addEventListener('dragleave', () => {
      icsDropzone.classList.remove('dragover');
    });

    icsDropzone?.addEventListener('drop', async (e) => {
      e.preventDefault();
      icsDropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.name.toLowerCase().endsWith('.ics')) {
        await this._handleICSFileSelect(file, icsDropzone, generateBtn);
      }
    });

    generateBtn?.addEventListener('click', () => {
      if (this._pendingICSData) {
        this._importICSData(this._pendingICSData);
      }
    });

    document.getElementById('empty-create-set')?.addEventListener('click', () => {
      this._showNewSetModal();
    });

    document.getElementById('empty-import-data')?.addEventListener('click', () => {
      this._showImportModal();
    });
  }

  /**
   * Handle ICS file selection for the landing page
   */
  async _handleICSFileSelect(file, dropzone, generateBtn) {
    try {
      dropzone.innerHTML = `
        <div class="dropzone-content">
          <i class="ph ph-spinner ph-spin dropzone-icon"></i>
          <p class="dropzone-text">Parsing calendar...</p>
        </div>
      `;

      const text = await this._readFileAsText(file);
      const icsParser = new ICSParser();
      const parseResult = icsParser.parse(text);

      // Store for later import
      this._pendingICSData = {
        file,
        parseResult,
        calendarInfo: parseResult.calendarInfo
      };

      // Update dropzone to show success
      const eventCount = parseResult.rows.length;
      const calName = parseResult.calendarInfo?.calendarName || 'Calendar';
      dropzone.innerHTML = `
        <div class="dropzone-content dropzone-success">
          <i class="ph ph-check-circle dropzone-icon"></i>
          <p class="dropzone-text">${file.name}</p>
          <p class="dropzone-subtext">${eventCount} events from ${calName}</p>
        </div>
      `;
      dropzone.classList.add('has-file');

      // Enable generate button
      generateBtn.disabled = false;

    } catch (error) {
      dropzone.innerHTML = `
        <div class="dropzone-content dropzone-error">
          <i class="ph ph-warning-circle dropzone-icon"></i>
          <p class="dropzone-text">Failed to parse ICS file</p>
          <p class="dropzone-subtext">${error.message}</p>
        </div>
      `;
    }
  }

  /**
   * Import ICS data into workbench
   */
  _importICSData(icsData) {
    const { file, parseResult } = icsData;

    // Create a new set for the calendar events
    const setName = parseResult.calendarInfo?.calendarName ||
                    file.name.replace(/\.ics$/i, '') ||
                    'Calendar Events';

    const set = createSet(setName, 'ph-calendar-blank');

    // Define fields based on ICS data structure
    set.fields = [
      createField('Summary', FieldTypes.TEXT, { isPrimary: true }),
      createField('Start', FieldTypes.DATE, { includeTime: true }),
      createField('End', FieldTypes.DATE, { includeTime: true }),
      createField('Location', FieldTypes.TEXT),
      createField('Description', FieldTypes.LONG_TEXT),
      createField('Status', FieldTypes.SELECT, {
        choices: [
          { id: 'confirmed', name: 'CONFIRMED', color: 'green' },
          { id: 'tentative', name: 'TENTATIVE', color: 'yellow' },
          { id: 'cancelled', name: 'CANCELLED', color: 'red' }
        ]
      }),
      createField('Organizer', FieldTypes.EMAIL),
      createField('Attendees', FieldTypes.TEXT),
      createField('All Day', FieldTypes.CHECKBOX),
      createField('Recurring', FieldTypes.CHECKBOX)
    ];

    // Store provenance
    set.datasetProvenance = {
      importedAt: new Date().toISOString(),
      originalFilename: file.name,
      provenance: {
        source: 'Google Calendar',
        method: 'ICS Import',
        agent: parseResult.calendarInfo?.prodId || 'Unknown'
      }
    };

    // Create records from parsed rows
    for (const row of parseResult.rows) {
      const values = {};
      set.fields.forEach(field => {
        const header = field.name;
        let value = row[header];

        // Handle special conversions
        if (field.type === FieldTypes.CHECKBOX) {
          value = value === 'Yes';
        } else if (field.type === FieldTypes.SELECT && value) {
          // Find or create choice
          const choice = field.options.choices?.find(c =>
            c.name.toLowerCase() === String(value).toLowerCase()
          );
          value = choice?.id || null;
        }

        values[field.id] = value;
      });

      set.records.push(createRecord(set.id, values));
    }

    // Add set and select it
    this.sets.push(set);
    this.currentSetId = set.id;
    this.currentViewId = set.views[0]?.id;

    // Clear pending data
    this._pendingICSData = null;

    // Save and refresh
    this._saveData();
    this._renderSidebar();
    this._renderView();
    this._updateBreadcrumb();

    this._showToast(`Imported ${parseResult.rows.length} events from ${file.name}`, 'success');
  }

  /**
   * Read file as text (utility)
   */
  _readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // --------------------------------------------------------------------------
  // Table View
  // --------------------------------------------------------------------------

  _renderTableView() {
    const set = this.getCurrentSet();
    const allRecords = this.getFilteredRecords();
    const fields = this._getVisibleFields();
    const view = this.getCurrentView();
    // Always show provenance column for data with sources
    const hasProvenance = set?.datasetProvenance?.originalFilename || allRecords.some(r => r.provenance);
    const showProvenance = view?.config.showProvenance !== false && hasProvenance;

    // Implement chunked loading for large datasets
    const totalRecords = allRecords.length;
    const displayCount = Math.min(this.displayedRecordCount, totalRecords);
    const records = allRecords.slice(0, displayCount);
    const hasMoreRecords = displayCount < totalRecords;
    const remainingRecords = totalRecords - displayCount;

    let html = `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-row-number">
                <input type="checkbox" class="row-checkbox" id="select-all">
              </th>
              ${showProvenance ? `
                <th class="col-provenance col-source" title="Data source and provenance">
                  <div class="th-content">
                    <i class="ph ph-git-branch"></i>
                    <span class="field-name">Source</span>
                  </div>
                </th>
              ` : ''}
              ${fields.map(field => `
                <th style="width: ${field.width}px; position: relative;"
                    data-field-id="${field.id}">
                  <div class="th-content">
                    <i class="ph ${FieldTypeIcons[field.type] || 'ph-text-aa'}"></i>
                    <span class="field-name">${this._escapeHtml(field.name)}</span>
                    <button class="th-dropdown">
                      <i class="ph ph-caret-down"></i>
                    </button>
                  </div>
                  <div class="th-resize-handle"></div>
                </th>
              `).join('')}
              <th class="col-add" id="add-column-btn" title="Add a new field/column">
                <div class="add-column-content">
                  <i class="ph ph-columns-plus-right"></i>
                  <span class="add-column-label">Add field</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
    `;

    if (allRecords.length === 0) {
      html += `
        <tr>
          <td colspan="${fields.length + (showProvenance ? 3 : 2)}" class="add-row-cell" id="add-first-record" title="Add a new record/row (Ctrl+N)">
            <div class="add-row-content">
              <i class="ph ph-rows-plus-bottom"></i>
              <span>Add your first record</span>
            </div>
          </td>
        </tr>
      `;
    } else {
      records.forEach((record, index) => {
        const isSelected = this.selectedRecords.has(record.id);
        const sourceInfo = showProvenance ? this._getRecordSourceInfo(record, set) : null;
        html += `
          <tr data-record-id="${record.id}" class="${isSelected ? 'selected' : ''}">
            <td class="col-row-number">
              <input type="checkbox" class="row-checkbox"
                     data-record-id="${record.id}"
                     ${isSelected ? 'checked' : ''}>
            </td>
            ${showProvenance ? `
              <td class="col-provenance col-source"
                  data-record-id="${record.id}"
                  title="${this._escapeHtml(sourceInfo.tooltip)}">
                <div class="provenance-cell">
                  <span class="provenance-icon ${sourceInfo.type}">${sourceInfo.icon}</span>
                  <span class="provenance-source-name" data-source="${this._escapeHtml(sourceInfo.source)}">${this._escapeHtml(sourceInfo.shortName)}</span>
                </div>
              </td>
            ` : ''}
            ${fields.map(field => this._renderCell(record, field)).join('')}
            <td class="col-add"></td>
          </tr>
        `;
      });

      // Load More button if there are more records
      if (hasMoreRecords) {
        const loadMoreCount = Math.min(this.recordBatchSize, remainingRecords);
        html += `
          <tr class="load-more-row">
            <td colspan="${fields.length + (showProvenance ? 3 : 2)}" class="load-more-cell">
              <button class="load-more-btn" id="load-more-records">
                <i class="ph ph-caret-down"></i>
                <span>Load ${loadMoreCount.toLocaleString()} more</span>
                <span class="load-more-remaining">(${remainingRecords.toLocaleString()} remaining)</span>
              </button>
              <button class="load-all-btn" id="load-all-records">
                <i class="ph ph-list"></i>
                <span>Load all ${totalRecords.toLocaleString()}</span>
              </button>
            </td>
          </tr>
        `;
      }

      // Add row button at the end
      html += `
        <tr>
          <td class="col-row-number add-row-cell" id="add-row-btn" title="Add a new record/row (Ctrl+N)">
            <i class="ph ph-rows-plus-bottom"></i>
          </td>
          <td colspan="${fields.length + (showProvenance ? 2 : 1)}" class="add-row-cell" id="add-row-cell" title="Add a new record/row (Ctrl+N)">
            <div class="add-row-content">
              <i class="ph ph-rows-plus-bottom"></i>
              <span>Add record</span>
            </div>
          </td>
        </tr>
      `;
    }

    html += '</tbody></table></div>';

    this.elements.contentArea.innerHTML = html;
    this._attachTableEventListeners();
    this._attachProvenanceClickHandlers();
    this._attachLoadMoreHandlers();
  }

  /**
   * Attach event handlers for load more buttons
   */
  _attachLoadMoreHandlers() {
    const loadMoreBtn = document.getElementById('load-more-records');
    const loadAllBtn = document.getElementById('load-all-records');

    loadMoreBtn?.addEventListener('click', () => {
      this._loadMoreRecords(false);
    });

    loadAllBtn?.addEventListener('click', () => {
      this._loadMoreRecords(true);
    });
  }

  /**
   * Load more records into the table view
   * @param {boolean} loadAll - If true, loads all remaining records
   */
  _loadMoreRecords(loadAll = false) {
    const allRecords = this.getFilteredRecords();
    const totalRecords = allRecords.length;

    if (loadAll) {
      // Show loading indicator for large datasets
      if (totalRecords - this.displayedRecordCount > 500) {
        this._showLoadingOverlay('Loading all records...', {
          showProgress: true,
          progress: 0,
          progressText: `Loading ${totalRecords.toLocaleString()} records...`
        });

        requestAnimationFrame(() => {
          this.displayedRecordCount = totalRecords;
          this._renderTableView();
          this._hideLoadingOverlay();
        });
      } else {
        this.displayedRecordCount = totalRecords;
        this._renderTableView();
      }
    } else {
      // Load next batch
      this.displayedRecordCount = Math.min(
        this.displayedRecordCount + this.recordBatchSize,
        totalRecords
      );
      this._renderTableView();
    }
  }

  /**
   * Get source info for a record (for provenance column)
   */
  _getRecordSourceInfo(record, set) {
    const datasetProv = set?.datasetProvenance;
    const recordProv = record?.provenance;

    // Determine source type and info
    let type = 'given';
    let icon = '◉';
    let source = '';
    let shortName = '';
    let tooltip = '';

    if (datasetProv?.originalFilename) {
      source = datasetProv.originalFilename;
      shortName = this._truncateSourceName(source, 15);
      tooltip = `Source: ${source}`;

      if (datasetProv.importedAt) {
        tooltip += `\nImported: ${new Date(datasetProv.importedAt).toLocaleDateString()}`;
      }
      if (datasetProv.provenance?.method) {
        tooltip += `\nMethod: ${datasetProv.provenance.method}`;
      }

      // Get file type icon
      const ext = source.split('.').pop()?.toLowerCase();
      if (ext === 'csv') icon = '📄';
      else if (ext === 'json') icon = '{ }';
      else if (ext === 'ics') icon = '📅';
      else icon = '◉';
    } else if (recordProv) {
      type = 'derived';
      icon = '⚙️';
      source = recordProv.source || recordProv.method || 'Derived';
      shortName = this._truncateSourceName(source, 15);
      tooltip = `Derived record\nMethod: ${recordProv.method || 'unknown'}`;
    } else {
      type = 'manual';
      icon = '✏️';
      source = 'Manual';
      shortName = 'Manual';
      tooltip = 'Manually created record';
    }

    return { type, icon, source, shortName, tooltip };
  }

  /**
   * Truncate source name for column display
   */
  _truncateSourceName(name, maxLen = 15) {
    if (!name) return '';
    if (name.length <= maxLen) return name;
    return name.slice(0, maxLen - 3) + '...';
  }

  /**
   * Attach click handlers for provenance column
   */
  _attachProvenanceClickHandlers() {
    this.container.querySelectorAll('.provenance-source-name').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const source = el.dataset.source;
        if (source && source !== 'Manual' && source !== 'Derived') {
          // Navigate to source in sidebar
          const sourceGroup = document.querySelector(`.source-group[data-source="${source}"]`);
          if (sourceGroup) {
            sourceGroup.classList.add('expanded');
            sourceGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight briefly
            sourceGroup.style.outline = '2px solid var(--primary-500)';
            setTimeout(() => sourceGroup.style.outline = '', 2000);
          }
        }
      });
    });
  }

  _getVisibleFields() {
    const set = this.getCurrentSet();
    const view = this.getCurrentView();
    if (!set) return [];

    let fields = [...set.fields];

    // Apply field order from view config
    if (view?.config.fieldOrder?.length > 0) {
      fields.sort((a, b) => {
        const aIndex = view.config.fieldOrder.indexOf(a.id);
        const bIndex = view.config.fieldOrder.indexOf(b.id);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }

    // Filter out hidden fields
    if (view?.config.hiddenFields?.length > 0) {
      fields = fields.filter(f => !view.config.hiddenFields.includes(f.id));
    }

    return fields;
  }

  _renderCell(record, field) {
    const value = record.values[field.id];
    const cellClass = `cell-${field.type} cell-editable`;

    let content = '';

    switch (field.type) {
      case FieldTypes.TEXT:
      case FieldTypes.LONG_TEXT:
        content = value ? this._escapeHtml(value) : '<span class="cell-empty">Empty</span>';
        break;

      case FieldTypes.NUMBER:
        content = value != null ? `<span class="cell-number">${this._formatNumber(value, field)}</span>` : '<span class="cell-empty">-</span>';
        break;

      case FieldTypes.CHECKBOX:
        content = `
          <div class="cell-checkbox">
            <i class="ph ${value ? 'ph-check-square checked' : 'ph-square unchecked'}"></i>
          </div>
        `;
        break;

      case FieldTypes.SELECT:
        if (value) {
          const choice = field.options.choices?.find(c => c.id === value);
          if (choice) {
            content = `<span class="select-tag color-${choice.color || 'gray'}">${this._escapeHtml(choice.name)}</span>`;
          }
        } else {
          content = '<span class="cell-empty">-</span>';
        }
        break;

      case FieldTypes.MULTI_SELECT:
        if (Array.isArray(value) && value.length > 0) {
          content = '<div class="cell-select">';
          value.forEach(v => {
            const choice = field.options.choices?.find(c => c.id === v);
            if (choice) {
              content += `<span class="select-tag color-${choice.color || 'gray'}">${this._escapeHtml(choice.name)}</span>`;
            }
          });
          content += '</div>';
        } else {
          content = '<span class="cell-empty">-</span>';
        }
        break;

      case FieldTypes.DATE:
        content = value ? `<span class="cell-date">${this._formatDate(value, field)}</span>` : '<span class="cell-empty">-</span>';
        break;

      case FieldTypes.URL:
        content = value ? `<span class="cell-url"><a href="${this._escapeHtml(value)}" target="_blank">${this._escapeHtml(value)}</a></span>` : '<span class="cell-empty">-</span>';
        break;

      case FieldTypes.EMAIL:
        content = value ? `<span class="cell-url"><a href="mailto:${this._escapeHtml(value)}">${this._escapeHtml(value)}</a></span>` : '<span class="cell-empty">-</span>';
        break;

      case FieldTypes.LINK:
        if (Array.isArray(value) && value.length > 0) {
          content = '<div class="cell-link">';
          value.forEach(linkedId => {
            // Find linked record name
            const linkedSet = this.sets.find(s => s.id === field.options.linkedSetId);
            const linkedRecord = linkedSet?.records.find(r => r.id === linkedId);
            const primaryField = linkedSet?.fields.find(f => f.isPrimary);
            const name = linkedRecord?.values[primaryField?.id] || linkedId;
            content += `<span class="link-chip" data-linked-id="${linkedId}"><i class="ph ph-link"></i>${this._escapeHtml(name)}</span>`;
          });
          content += '</div>';
        } else {
          content = '<span class="cell-empty">-</span>';
        }
        break;

      case FieldTypes.FORMULA:
        const result = this._evaluateFormula(field.options.formula, record);
        content = `<span class="cell-formula">${result}</span>`;
        break;

      case FieldTypes.AUTONUMBER:
        const set = this.getCurrentSet();
        const index = set?.records.findIndex(r => r.id === record.id) || 0;
        content = `<span class="cell-number">${index + 1}</span>`;
        break;

      case FieldTypes.JSON:
        if (value !== null && value !== undefined) {
          const displayMode = field.options?.displayMode || 'keyValue';
          if (displayMode === 'raw') {
            // Raw mode: show JSON string
            const jsonStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            content = `<span class="cell-json-raw">${this._escapeHtml(jsonStr)}</span>`;
          } else {
            // Key-value mode (default): use nested object rendering
            content = this._renderJsonKeyValue(value, field);
          }
        } else {
          content = '<span class="cell-empty">-</span>';
        }
        break;

      default:
        // Handle nested objects and arrays properly
        if (value !== null && value !== undefined) {
          if (typeof value === 'object') {
            content = this._renderNestedValue(value);
          } else {
            content = this._escapeHtml(String(value));
          }
        } else {
          content = '<span class="cell-empty">-</span>';
        }
    }

    return `<td class="${cellClass}" data-field-id="${field.id}">${content}</td>`;
  }

  _formatNumber(value, field) {
    const num = Number(value);
    if (isNaN(num)) return value;

    const precision = field.options?.precision || 0;

    switch (field.options?.format) {
      case 'currency':
        return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: precision });
      case 'percent':
        return (num * 100).toFixed(precision) + '%';
      default:
        return num.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision });
    }
  }

  _formatDate(value, field) {
    try {
      const date = new Date(value);
      if (field.options?.includeTime) {
        return date.toLocaleString();
      }
      return date.toLocaleDateString();
    } catch (e) {
      return value;
    }
  }

  _evaluateFormula(formula, record) {
    // Simple formula evaluation - can be extended
    try {
      if (!formula) return '';
      // This is a placeholder - real implementation would use FormulaEngine
      return formula;
    } catch (e) {
      return '#ERROR';
    }
  }

  _attachTableEventListeners() {
    const table = document.querySelector('.data-table');
    if (!table) return;

    // Use event delegation for most table interactions
    // This greatly reduces the number of event listeners for better performance

    // Delegated click handler for the entire table
    table.addEventListener('click', (e) => {
      const target = e.target;

      // Select all checkbox
      if (target.id === 'select-all') {
        const set = this.getCurrentSet();
        if (!set) return;
        if (target.checked) {
          set.records.forEach(r => this.selectedRecords.add(r.id));
        } else {
          this.selectedRecords.clear();
        }
        this._renderTableView();
        return;
      }

      // Row checkbox
      if (target.classList.contains('row-checkbox') && target.dataset.recordId) {
        const recordId = target.dataset.recordId;
        if (target.checked) {
          this.selectedRecords.add(recordId);
        } else {
          this.selectedRecords.delete(recordId);
        }
        this._updateStatus();
        const row = target.closest('tr');
        row?.classList.toggle('selected', target.checked);
        return;
      }

      // Checkbox cell toggle (single click)
      const checkboxCell = target.closest('.cell-checkbox');
      if (checkboxCell) {
        const td = checkboxCell.closest('td');
        const recordId = td?.closest('tr')?.dataset.recordId;
        const fieldId = td?.dataset.fieldId;
        if (recordId && fieldId) {
          e.stopPropagation(); // Prevent row click
          this._toggleCheckbox(recordId, fieldId);
        }
        return;
      }

      // Field header dropdown
      const dropdown = target.closest('.th-dropdown');
      if (dropdown) {
        e.stopPropagation();
        const th = dropdown.closest('th');
        this._showFieldContextMenu(e, th.dataset.fieldId);
        return;
      }

      // Add column button
      if (target.closest('#add-column-btn')) {
        this._showFieldTypePicker(e);
        return;
      }

      // Add record buttons
      if (target.closest('#add-row-btn') || target.closest('#add-row-cell') || target.closest('#add-first-record')) {
        this.addRecord();
        return;
      }

      // Row click for detail panel (but not on checkboxes or editing cells)
      if (target.type !== 'checkbox' && !target.closest('.cell-editing')) {
        const row = target.closest('tr[data-record-id]');
        if (row) {
          this._showRecordDetail(row.dataset.recordId);
        }
      }
    });

    // Delegated double-click for cell editing
    table.addEventListener('dblclick', (e) => {
      const cell = e.target.closest('td.cell-editable');
      if (cell && !cell.classList.contains('cell-editing')) {
        this._startCellEdit(cell);
      }
    });

    // Delegated context menu for rows and column headers
    table.addEventListener('contextmenu', (e) => {
      // Check for column header first
      const th = e.target.closest('th[data-field-id]');
      if (th) {
        e.preventDefault();
        this._showFieldContextMenu(e, th.dataset.fieldId);
        return;
      }

      // Then check for row
      const row = e.target.closest('tr[data-record-id]');
      if (row) {
        e.preventDefault();
        this._showRecordContextMenu(e, row.dataset.recordId);
      }
    });

    // Column resize handles still need individual attachment for drag state
    document.querySelectorAll('.th-resize-handle').forEach(handle => {
      this._attachResizeHandler(handle);
    });
  }

  _startCellEdit(cell) {
    if (this.editingCell) {
      this._endCellEdit();
    }

    const recordId = cell.closest('tr')?.dataset.recordId;
    const fieldId = cell.dataset.fieldId;
    if (!recordId || !fieldId) return;

    const set = this.getCurrentSet();
    const record = set?.records.find(r => r.id === recordId);
    const field = set?.fields.find(f => f.id === fieldId);
    if (!record || !field) return;

    // Non-editable field types
    if ([FieldTypes.FORMULA, FieldTypes.ROLLUP, FieldTypes.COUNT, FieldTypes.AUTONUMBER].includes(field.type)) {
      return;
    }

    const currentValue = record.values[fieldId];

    // If field has subfields configured, use the subfields modal
    if (field.options?.subfields) {
      this._showSubfieldsEditModal(recordId, fieldId, currentValue);
      return;
    }

    // Store original content for cancel restoration (avoids full re-render)
    const originalContent = cell.innerHTML;
    this.editingCell = { cell, recordId, fieldId, originalContent, field };
    cell.classList.add('cell-editing');

    // Render appropriate editor
    switch (field.type) {
      case FieldTypes.SELECT:
        this._renderSelectEditor(cell, field, currentValue);
        break;
      case FieldTypes.MULTI_SELECT:
        this._renderMultiSelectEditor(cell, field, currentValue);
        break;
      case FieldTypes.DATE:
        this._renderDateEditor(cell, field, currentValue);
        break;
      case FieldTypes.CHECKBOX:
        // Checkbox is toggled directly, not edited
        break;
      case FieldTypes.JSON:
        this._renderJsonEditor(cell, field, currentValue);
        break;
      default:
        this._renderTextEditor(cell, field, currentValue);
    }
  }

  _renderTextEditor(cell, field, value) {
    const isLongText = field.type === FieldTypes.LONG_TEXT;

    // Create element properly - input needs value attribute, not inner content
    const input = document.createElement(isLongText ? 'textarea' : 'input');
    input.type = 'text';
    input.className = 'cell-input';
    input.value = value || '';

    cell.innerHTML = '';
    cell.appendChild(input);

    input.focus();
    input.select?.();

    input.addEventListener('blur', () => this._endCellEdit());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !isLongText) {
        this._endCellEdit();
      }
      if (e.key === 'Escape') {
        this._cancelCellEdit();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        this._endCellEdit();
        this._moveToNextCell(e.shiftKey);
      }
    });
  }

  _renderSelectEditor(cell, field, value) {
    const choices = field.options.choices || [];

    let html = '<div class="select-dropdown">';
    choices.forEach(choice => {
      html += `
        <div class="select-option ${choice.id === value ? 'selected' : ''}" data-value="${choice.id}">
          <span class="select-tag color-${choice.color || 'gray'}">${this._escapeHtml(choice.name)}</span>
        </div>
      `;
    });
    html += '</div>';

    cell.innerHTML = html;

    cell.querySelectorAll('.select-option').forEach(option => {
      option.addEventListener('click', () => {
        this._updateCellValue(option.dataset.value);
        this._endCellEdit();
      });
    });

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', this._closeSelectEditor, { once: true });
    }, 10);
  }

  _closeSelectEditor = (e) => {
    if (!e.target.closest('.select-dropdown')) {
      this._endCellEdit();
    }
  }

  _renderDateEditor(cell, field, value) {
    const input = document.createElement('input');
    input.type = field.options?.includeTime ? 'datetime-local' : 'date';
    input.className = 'cell-input';
    input.value = value || '';

    cell.innerHTML = '';
    cell.appendChild(input);

    input.focus();

    input.addEventListener('blur', () => this._endCellEdit());
    input.addEventListener('change', () => this._endCellEdit());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._cancelCellEdit();
    });
  }

  _renderJsonEditor(cell, field, value) {
    const textarea = document.createElement('textarea');
    textarea.className = 'cell-input cell-json-editor';

    // Convert value to JSON string for editing
    let jsonString = '';
    if (value !== null && value !== undefined) {
      if (typeof value === 'object') {
        try {
          jsonString = JSON.stringify(value, null, 2);
        } catch (e) {
          jsonString = String(value);
        }
      } else {
        jsonString = String(value);
      }
    }
    textarea.value = jsonString;

    // Add validation indicator
    const wrapper = document.createElement('div');
    wrapper.className = 'json-editor-wrapper';

    const validationIndicator = document.createElement('span');
    validationIndicator.className = 'json-validation-indicator valid';
    validationIndicator.innerHTML = '<i class="ph ph-check-circle"></i>';

    wrapper.appendChild(textarea);
    wrapper.appendChild(validationIndicator);

    cell.innerHTML = '';
    cell.appendChild(wrapper);

    textarea.focus();
    textarea.select();

    // Validate JSON on input
    const validateJson = () => {
      const val = textarea.value.trim();
      if (!val) {
        validationIndicator.className = 'json-validation-indicator valid';
        validationIndicator.innerHTML = '<i class="ph ph-check-circle"></i>';
        return true;
      }
      try {
        JSON.parse(val);
        validationIndicator.className = 'json-validation-indicator valid';
        validationIndicator.innerHTML = '<i class="ph ph-check-circle"></i>';
        return true;
      } catch (e) {
        validationIndicator.className = 'json-validation-indicator invalid';
        validationIndicator.innerHTML = '<i class="ph ph-x-circle"></i>';
        return false;
      }
    };

    textarea.addEventListener('input', validateJson);

    textarea.addEventListener('blur', () => {
      // Only save if valid JSON
      if (validateJson()) {
        this._endJsonEdit();
      }
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._cancelCellEdit();
      }
      // Cmd/Ctrl+Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (validateJson()) {
          this._endJsonEdit();
        }
      }
    });
  }

  _endJsonEdit() {
    if (!this.editingCell) return;

    const { cell, recordId, fieldId, field } = this.editingCell;
    const textarea = cell.querySelector('.cell-json-editor');

    if (textarea) {
      const rawValue = textarea.value.trim();
      let parsedValue = null;

      if (rawValue) {
        try {
          parsedValue = JSON.parse(rawValue);
        } catch (e) {
          // If not valid JSON, store as string
          parsedValue = rawValue;
        }
      }

      this._updateRecordValue(recordId, fieldId, parsedValue);
    }

    // Clear editing state first
    const editingRef = this.editingCell;
    this.editingCell = null;

    // Update display
    requestAnimationFrame(() => {
      this._updateCellDisplay(editingRef.cell, editingRef.recordId, editingRef.field);
      editingRef.cell.classList.add('cell-edit-saved');
      setTimeout(() => editingRef.cell.classList.remove('cell-edit-saved'), 300);
    });
  }

  _endCellEdit() {
    if (!this.editingCell) return;

    const { cell, recordId, fieldId, field } = this.editingCell;
    const input = cell.querySelector('.cell-input');

    if (input) {
      const newValue = input.value;
      this._updateRecordValue(recordId, fieldId, newValue);
    }

    // Clear editing state first
    const editingRef = this.editingCell;
    this.editingCell = null;

    // Use requestAnimationFrame for smoother update with visual feedback
    requestAnimationFrame(() => {
      this._updateCellDisplay(editingRef.cell, editingRef.recordId, editingRef.field);
      // Add saved animation feedback
      editingRef.cell.classList.add('cell-edit-saved');
      setTimeout(() => editingRef.cell.classList.remove('cell-edit-saved'), 300);
    });
  }

  _cancelCellEdit() {
    if (!this.editingCell) return;

    const { cell, originalContent } = this.editingCell;
    this.editingCell = null;

    // Restore original content directly with visual feedback
    requestAnimationFrame(() => {
      cell.innerHTML = originalContent;
      cell.classList.remove('cell-editing');
      // Add cancelled animation feedback
      cell.classList.add('cell-edit-cancelled');
      setTimeout(() => cell.classList.remove('cell-edit-cancelled'), 200);
    });
  }

  /**
   * Update only the specific cell's display content without re-rendering the table.
   * This is the key performance optimization for inline editing.
   */
  _updateCellDisplay(cell, recordId, field) {
    const set = this.getCurrentSet();
    const record = set?.records.find(r => r.id === recordId);
    if (!record || !field) return;

    const value = record.values[field.id];
    cell.classList.remove('cell-editing');

    // Generate new cell content based on field type
    cell.innerHTML = this._renderCellContent(field, value);

    // Re-attach click handler for checkbox cells
    if (field.type === FieldTypes.CHECKBOX) {
      const checkbox = cell.querySelector('.cell-checkbox');
      if (checkbox) {
        cell.onclick = () => {
          this._toggleCheckbox(recordId, field.id);
        };
      }
    }
  }

  /**
   * Render just the inner content of a cell (without the td wrapper).
   * Used for targeted cell updates.
   */
  _renderCellContent(field, value) {
    // Check if field has subfields configured
    const hasSubfields = field.options?.subfields;
    if (hasSubfields) {
      return this._renderCellWithSubfields(field, value);
    }

    switch (field.type) {
      case FieldTypes.TEXT:
      case FieldTypes.LONG_TEXT:
        return value ? this._escapeHtml(value) : '<span class="cell-empty">Empty</span>';

      case FieldTypes.NUMBER:
        return value != null ? `<span class="cell-number">${this._formatNumber(value, field)}</span>` : '<span class="cell-empty">-</span>';

      case FieldTypes.CHECKBOX:
        return `
          <div class="cell-checkbox">
            <i class="ph ${value ? 'ph-check-square checked' : 'ph-square unchecked'}"></i>
          </div>
        `;

      case FieldTypes.SELECT:
        if (value) {
          const choice = field.options?.choices?.find(c => c.id === value);
          if (choice) {
            return `<span class="select-tag color-${choice.color || 'gray'}">${this._escapeHtml(choice.name)}</span>`;
          }
        }
        return '<span class="cell-empty">-</span>';

      case FieldTypes.MULTI_SELECT:
        if (Array.isArray(value) && value.length > 0) {
          let content = '<div class="cell-select">';
          value.forEach(v => {
            const choice = field.options?.choices?.find(c => c.id === v);
            if (choice) {
              content += `<span class="select-tag color-${choice.color || 'gray'}">${this._escapeHtml(choice.name)}</span>`;
            }
          });
          return content + '</div>';
        }
        return '<span class="cell-empty">-</span>';

      case FieldTypes.DATE:
        return value ? `<span class="cell-date">${this._formatDate(value, field)}</span>` : '<span class="cell-empty">-</span>';

      case FieldTypes.URL:
        return value ? `<span class="cell-url"><a href="${this._escapeHtml(value)}" target="_blank">${this._escapeHtml(value)}</a></span>` : '<span class="cell-empty">-</span>';

      case FieldTypes.EMAIL:
        return value ? `<span class="cell-url"><a href="mailto:${this._escapeHtml(value)}">${this._escapeHtml(value)}</a></span>` : '<span class="cell-empty">-</span>';

      case FieldTypes.JSON:
        if (value !== null && value !== undefined) {
          const displayMode = field.options?.displayMode || 'keyValue';
          if (displayMode === 'raw') {
            const jsonStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            return `<span class="cell-json-raw">${this._escapeHtml(jsonStr)}</span>`;
          } else {
            return this._renderJsonKeyValue(value, field);
          }
        }
        return '<span class="cell-empty">-</span>';

      default:
        return value ? this._escapeHtml(String(value)) : '<span class="cell-empty">-</span>';
    }
  }

  _updateCellValue(value) {
    if (!this.editingCell) return;
    const { recordId, fieldId } = this.editingCell;
    this._updateRecordValue(recordId, fieldId, value);
  }

  _updateRecordValue(recordId, fieldId, value, skipUndo = false) {
    const set = this.getCurrentSet();
    const record = set?.records.find(r => r.id === recordId);
    if (!record) return;

    const oldValue = record.values[fieldId];

    // Skip if value hasn't changed
    if (oldValue === value) return;

    // Track for undo/redo (unless this is an undo/redo operation)
    if (!skipUndo) {
      this._pushUndoAction({
        type: 'update_field',
        recordId,
        fieldId,
        oldValue,
        newValue: value,
        setId: set.id
      });
    }

    // Create EO event for the change
    if (this.eoApp) {
      this._createEOEvent('record_updated', {
        recordId,
        fieldId,
        oldValue,
        newValue: value
      });
    }

    record.values[fieldId] = value;
    record.updatedAt = new Date().toISOString();

    this._saveData();
  }

  _pushUndoAction(action) {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxUndoStackSize) {
      this.undoStack.shift();
    }
    // Clear redo stack when a new action is performed
    this.redoStack = [];
    this._updateUndoRedoStatus();
  }

  _undo() {
    if (this.undoStack.length === 0) {
      this._showToast('Nothing to undo', 'info');
      return;
    }

    const action = this.undoStack.pop();
    this.redoStack.push(action);

    switch (action.type) {
      case 'update_field':
        this._updateRecordValue(action.recordId, action.fieldId, action.oldValue, true);
        this._renderView();
        this._showToast('Undone', 'success');
        break;

      case 'delete_record':
        // Restore deleted record
        const set = this.sets.find(s => s.id === action.setId);
        if (set) {
          set.records.push(action.record);
          this._saveData();
          this._renderView();
          this._showToast('Record restored', 'success');
        }
        break;

      case 'create_record':
        // Remove created record
        const createSet = this.sets.find(s => s.id === action.setId);
        if (createSet) {
          const idx = createSet.records.findIndex(r => r.id === action.recordId);
          if (idx > -1) {
            createSet.records.splice(idx, 1);
            this._saveData();
            this._renderView();
            this._showToast('Record creation undone', 'success');
          }
        }
        break;
    }

    this._updateUndoRedoStatus();
  }

  _redo() {
    if (this.redoStack.length === 0) {
      this._showToast('Nothing to redo', 'info');
      return;
    }

    const action = this.redoStack.pop();
    this.undoStack.push(action);

    switch (action.type) {
      case 'update_field':
        this._updateRecordValue(action.recordId, action.fieldId, action.newValue, true);
        this._renderView();
        this._showToast('Redone', 'success');
        break;

      case 'delete_record':
        // Re-delete the record
        const set = this.sets.find(s => s.id === action.setId);
        if (set) {
          const idx = set.records.findIndex(r => r.id === action.record.id);
          if (idx > -1) {
            set.records.splice(idx, 1);
            this._saveData();
            this._renderView();
            this._showToast('Record deleted again', 'success');
          }
        }
        break;

      case 'create_record':
        // Re-create the record
        const createSet = this.sets.find(s => s.id === action.setId);
        if (createSet) {
          createSet.records.push(action.record);
          this._saveData();
          this._renderView();
          this._showToast('Record recreated', 'success');
        }
        break;
    }

    this._updateUndoRedoStatus();
  }

  _updateUndoRedoStatus() {
    // Update any UI elements that show undo/redo status
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
  }

  _toggleCheckbox(recordId, fieldId) {
    const set = this.getCurrentSet();
    const record = set?.records.find(r => r.id === recordId);
    const field = set?.fields.find(f => f.id === fieldId);
    if (!record || !field) return;

    const currentValue = record.values[fieldId];
    this._updateRecordValue(recordId, fieldId, !currentValue);

    // Find the cell and update only its content - no full re-render
    const cell = document.querySelector(`tr[data-record-id="${recordId}"] td[data-field-id="${fieldId}"]`);
    if (cell) {
      requestAnimationFrame(() => {
        this._updateCellDisplay(cell, recordId, field);
      });
    }
  }

  _attachResizeHandler(handle) {
    let startX, startWidth, th;

    const onMouseDown = (e) => {
      th = handle.closest('th');
      startX = e.pageX;
      startWidth = th.offsetWidth;
      handle.classList.add('resizing');

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      const width = Math.max(80, startWidth + (e.pageX - startX));
      th.style.width = width + 'px';
    };

    const onMouseUp = () => {
      handle.classList.remove('resizing');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Save the new width
      const fieldId = th.dataset.fieldId;
      const set = this.getCurrentSet();
      const field = set?.fields.find(f => f.id === fieldId);
      if (field) {
        field.width = th.offsetWidth;
        this._saveData();
      }
    };

    handle.addEventListener('mousedown', onMouseDown);
  }

  // --------------------------------------------------------------------------
  // Cards View
  // --------------------------------------------------------------------------

  _renderCardsView() {
    const allRecords = this.getFilteredRecords();
    const fields = this._getVisibleFields();

    // Implement chunked loading for large datasets
    const totalRecords = allRecords.length;
    const displayCount = Math.min(this.displayedRecordCount, totalRecords);
    const records = allRecords.slice(0, displayCount);
    const hasMoreRecords = displayCount < totalRecords;
    const remainingRecords = totalRecords - displayCount;

    let html = '<div class="card-grid">';

    if (allRecords.length === 0) {
      html = `
        <div class="empty-state">
          <i class="ph ph-cards"></i>
          <h3>No Records</h3>
          <p>Add your first record to see it here</p>
          <button class="btn btn-primary" id="cards-add-record">
            <i class="ph ph-plus"></i>
            Add Record
          </button>
        </div>
      `;
    } else {
      records.forEach(record => {
        const primaryField = fields.find(f => f.isPrimary) || fields[0];
        const title = record.values[primaryField?.id] || 'Untitled';
        const isSelected = this.selectedRecords.has(record.id);

        html += `
          <div class="record-card ${isSelected ? 'selected' : ''}" data-record-id="${record.id}">
            <div class="card-header">
              <span class="card-title">${this._escapeHtml(title)}</span>
              <button class="card-menu"><i class="ph ph-dots-three"></i></button>
            </div>
            <div class="card-body">
              ${fields.slice(1, 5).map(field => {
                const value = record.values[field.id];
                const formatted = this._formatCellValueSimple(value, field);
                return `
                  <div class="card-field">
                    <span class="card-field-label">${this._escapeHtml(field.name)}</span>
                    <span class="card-field-value">${formatted}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      });

      // Load More button if there are more records
      if (hasMoreRecords) {
        const loadMoreCount = Math.min(this.recordBatchSize, remainingRecords);
        html += `
          <div class="cards-load-more">
            <button class="load-more-btn" id="cards-load-more">
              <i class="ph ph-caret-down"></i>
              <span>Load ${loadMoreCount.toLocaleString()} more</span>
              <span class="load-more-remaining">(${remainingRecords.toLocaleString()} remaining)</span>
            </button>
            <button class="load-all-btn" id="cards-load-all">
              <i class="ph ph-cards"></i>
              <span>Load all ${totalRecords.toLocaleString()}</span>
            </button>
          </div>
        `;
      }
    }

    html += '</div>';
    this.elements.contentArea.innerHTML = html;

    // Attach event listeners
    document.querySelectorAll('.record-card').forEach(card => {
      card.addEventListener('click', () => {
        this._showRecordDetail(card.dataset.recordId);
      });

      card.querySelector('.card-menu')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showRecordContextMenu(e, card.dataset.recordId);
      });
    });

    document.getElementById('cards-add-record')?.addEventListener('click', () => this.addRecord());

    // Load more handlers for cards view
    document.getElementById('cards-load-more')?.addEventListener('click', () => {
      this._loadMoreRecordsForView('cards', false);
    });
    document.getElementById('cards-load-all')?.addEventListener('click', () => {
      this._loadMoreRecordsForView('cards', true);
    });
  }

  /**
   * Load more records for a specific view type
   * @param {string} viewType - The type of view (cards, kanban)
   * @param {boolean} loadAll - If true, loads all remaining records
   */
  _loadMoreRecordsForView(viewType, loadAll = false) {
    const allRecords = this.getFilteredRecords();
    const totalRecords = allRecords.length;

    if (loadAll) {
      if (totalRecords - this.displayedRecordCount > 500) {
        this._showLoadingOverlay('Loading all records...', {
          showProgress: true,
          progress: 0,
          progressText: `Loading ${totalRecords.toLocaleString()} records...`
        });

        requestAnimationFrame(() => {
          this.displayedRecordCount = totalRecords;
          if (viewType === 'cards') this._renderCardsView();
          else if (viewType === 'kanban') this._renderKanbanView();
          this._hideLoadingOverlay();
        });
      } else {
        this.displayedRecordCount = totalRecords;
        if (viewType === 'cards') this._renderCardsView();
        else if (viewType === 'kanban') this._renderKanbanView();
      }
    } else {
      this.displayedRecordCount = Math.min(
        this.displayedRecordCount + this.recordBatchSize,
        totalRecords
      );
      if (viewType === 'cards') this._renderCardsView();
      else if (viewType === 'kanban') this._renderKanbanView();
    }
  }

  _formatCellValueSimple(value, field) {
    if (value == null || value === '') return '<span class="cell-empty">-</span>';

    switch (field.type) {
      case FieldTypes.CHECKBOX:
        return value ? '<i class="ph ph-check-circle" style="color: var(--success-500)"></i>' : '<i class="ph ph-circle" style="color: var(--text-muted)"></i>';
      case FieldTypes.SELECT:
        const choice = field.options.choices?.find(c => c.id === value);
        return choice ? `<span class="select-tag color-${choice.color}">${this._escapeHtml(choice.name)}</span>` : '-';
      case FieldTypes.DATE:
        return this._formatDate(value, field);
      default:
        return this._escapeHtml(String(value));
    }
  }

  // --------------------------------------------------------------------------
  // Kanban View
  // --------------------------------------------------------------------------

  _renderKanbanView() {
    const set = this.getCurrentSet();
    const records = this.getFilteredRecords();
    const view = this.getCurrentView();

    // Find grouping field (must be a select field)
    let groupField = set?.fields.find(f => f.type === FieldTypes.SELECT);
    if (view?.config.kanbanField) {
      groupField = set?.fields.find(f => f.id === view.config.kanbanField) || groupField;
    }

    if (!groupField) {
      this.elements.contentArea.innerHTML = `
        <div class="empty-state">
          <i class="ph ph-kanban"></i>
          <h3>No Status Field</h3>
          <p>Add a single select field to use Kanban view</p>
          <button class="btn btn-primary" id="kanban-add-field">
            <i class="ph ph-plus"></i>
            Add Select Field
          </button>
        </div>
      `;

      document.getElementById('kanban-add-field')?.addEventListener('click', () => {
        this._addField(FieldTypes.SELECT, 'Status');
      });
      return;
    }

    const choices = groupField.options.choices || [];
    const primaryField = set?.fields.find(f => f.isPrimary) || set?.fields[0];

    let html = '<div class="kanban-container">';

    // Create a column for each choice + uncategorized
    const columns = [...choices, { id: null, name: 'Uncategorized', color: 'gray' }];

    columns.forEach(column => {
      const columnRecords = records.filter(r => {
        const val = r.values[groupField.id];
        return column.id === null ? (val == null || val === '') : val === column.id;
      });

      const isUncategorized = column.id === null;
      html += `
        <div class="kanban-column" data-column-id="${column.id || 'null'}">
          <div class="kanban-column-header">
            <div class="kanban-column-title">
              <span class="select-tag color-${column.color || 'gray'}">${this._escapeHtml(column.name)}</span>
              <span class="kanban-column-count">${columnRecords.length}</span>
            </div>
            ${!isUncategorized ? `
              <button class="kanban-column-edit" data-choice-id="${column.id}" title="Edit status">
                <i class="ph ph-pencil-simple"></i>
              </button>
            ` : ''}
          </div>
          <div class="kanban-column-body" data-column-id="${column.id || 'null'}">
            ${columnRecords.map(record => {
              const title = record.values[primaryField?.id] || 'Untitled';
              return `
                <div class="kanban-card" data-record-id="${record.id}" draggable="true">
                  <div class="kanban-card-title">${this._escapeHtml(title)}</div>
                </div>
              `;
            }).join('')}
            <div class="kanban-add-card" data-column-id="${column.id || ''}">
              <i class="ph ph-plus"></i>
              <span>Add</span>
            </div>
          </div>
        </div>
      `;
    });

    // Add "Add Status" button at the end
    html += `
      <div class="kanban-add-column">
        <button class="kanban-add-status-btn" id="kanban-add-status">
          <i class="ph ph-plus"></i>
          <span>Add Status</span>
        </button>
      </div>
    `;

    html += '</div>';
    this.elements.contentArea.innerHTML = html;

    // Drag and drop
    this._attachKanbanDragHandlers(groupField);

    // Card click
    document.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('click', () => {
        this._showRecordDetail(card.dataset.recordId);
      });
    });

    // Add card buttons
    document.querySelectorAll('.kanban-add-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const columnId = btn.dataset.columnId;
        const record = this.addRecord();
        if (columnId) {
          this._updateRecordValue(record.id, groupField.id, columnId);
        }
      });
    });

    // Edit status buttons
    document.querySelectorAll('.kanban-column-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const choiceId = btn.dataset.choiceId;
        this._showEditStatusModal(groupField, choiceId);
      });
    });

    // Add status button
    document.getElementById('kanban-add-status')?.addEventListener('click', () => {
      this._showAddStatusModal(groupField);
    });
  }

  _showEditStatusModal(field, choiceId) {
    const choice = field.options?.choices?.find(c => c.id === choiceId);
    if (!choice) return;

    const colors = ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];

    this._showModal('Edit Status', `
      <div class="modal-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="status-name" value="${this._escapeHtml(choice.name)}" class="form-input">
        </div>
        <div class="form-group">
          <label>Color</label>
          <div class="color-picker">
            ${colors.map(color => `
              <button class="color-option color-${color} ${choice.color === color ? 'selected' : ''}"
                      data-color="${color}" title="${color}"></button>
            `).join('')}
          </div>
        </div>
        <div class="form-group" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-primary);">
          <button class="btn btn-danger" id="delete-status-btn">
            <i class="ph ph-trash"></i>
            Delete Status
          </button>
        </div>
      </div>
    `, () => {
      const name = document.getElementById('status-name')?.value?.trim();
      const selectedColor = document.querySelector('.color-option.selected')?.dataset.color || choice.color;

      if (!name) {
        alert('Please enter a name');
        return;
      }

      // Update the choice
      choice.name = name;
      choice.color = selectedColor;

      this._saveData();
      this._renderKanbanView();
      this._showToast('Status updated', 'success');
    });

    // Attach color picker handlers
    setTimeout(() => {
      document.querySelectorAll('.color-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        });
      });

      document.getElementById('delete-status-btn')?.addEventListener('click', () => {
        if (confirm(`Delete status "${choice.name}"? Records with this status will become uncategorized.`)) {
          // Remove the choice
          const idx = field.options.choices.findIndex(c => c.id === choiceId);
          if (idx > -1) {
            field.options.choices.splice(idx, 1);

            // Clear this value from all records
            const set = this.getCurrentSet();
            set?.records.forEach(r => {
              if (r.values[field.id] === choiceId) {
                r.values[field.id] = null;
              }
            });

            this._saveData();
            this._closeModal();
            this._renderKanbanView();
            this._showToast('Status deleted', 'success');
          }
        }
      });
    }, 0);
  }

  _showAddStatusModal(field) {
    const colors = ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];

    this._showModal('Add Status', `
      <div class="modal-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="status-name" placeholder="Enter status name" class="form-input">
        </div>
        <div class="form-group">
          <label>Color</label>
          <div class="color-picker">
            ${colors.map((color, i) => `
              <button class="color-option color-${color} ${i === 0 ? 'selected' : ''}"
                      data-color="${color}" title="${color}"></button>
            `).join('')}
          </div>
        </div>
      </div>
    `, () => {
      const name = document.getElementById('status-name')?.value?.trim();
      const selectedColor = document.querySelector('.color-option.selected')?.dataset.color || 'gray';

      if (!name) {
        alert('Please enter a name');
        return;
      }

      // Add the new choice
      if (!field.options.choices) {
        field.options.choices = [];
      }

      field.options.choices.push({
        id: generateId(),
        name,
        color: selectedColor
      });

      this._saveData();
      this._renderKanbanView();
      this._showToast('Status added', 'success');
    });

    // Attach color picker handlers
    setTimeout(() => {
      document.querySelectorAll('.color-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        });
      });
      document.getElementById('status-name')?.focus();
    }, 0);
  }

  _attachKanbanDragHandlers(groupField) {
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-column-body');

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.dataset.recordId);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        columns.forEach(col => col.classList.remove('drag-over'));
      });
    });

    columns.forEach(column => {
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        column.classList.add('drag-over');
      });

      column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over');
      });

      column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');

        const recordId = e.dataTransfer.getData('text/plain');
        const columnId = column.dataset.columnId;
        const newValue = columnId === 'null' ? null : columnId;

        this._updateRecordValue(recordId, groupField.id, newValue);
        this._renderKanbanView();
      });
    });
  }

  // --------------------------------------------------------------------------
  // Calendar View
  // --------------------------------------------------------------------------

  _renderCalendarView() {
    const set = this.getCurrentSet();
    const records = this.getFilteredRecords();

    // Find date field
    let dateField = set?.fields.find(f => f.type === FieldTypes.DATE);

    if (!dateField) {
      this.elements.contentArea.innerHTML = `
        <div class="empty-state">
          <i class="ph ph-calendar-blank"></i>
          <h3>No Date Field</h3>
          <p>Add a date field to use Calendar view</p>
          <button class="btn btn-primary" id="calendar-add-field">
            <i class="ph ph-plus"></i>
            Add Date Field
          </button>
        </div>
      `;

      document.getElementById('calendar-add-field')?.addEventListener('click', () => {
        this._addField(FieldTypes.DATE, 'Date');
      });
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const primaryField = set?.fields.find(f => f.isPrimary) || set?.fields[0];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    let html = `
      <div class="calendar-container">
        <div class="calendar-header">
          <div class="calendar-nav">
            <button class="calendar-nav-btn" id="cal-prev"><i class="ph ph-caret-left"></i></button>
            <button class="calendar-nav-btn" id="cal-next"><i class="ph ph-caret-right"></i></button>
          </div>
          <h2 class="calendar-title">${monthNames[month]} ${year}</h2>
          <button class="btn btn-secondary" id="cal-today">Today</button>
        </div>
        <div class="calendar-grid">
    `;

    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
      html += `<div class="calendar-day-header">${day}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
      html += '<div class="calendar-day other-month"></div>';
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();

      // Find records for this day
      const dayRecords = records.filter(r => {
        const val = r.values[dateField.id];
        return val && val.startsWith(dateStr);
      });

      html += `
        <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}">
          <div class="calendar-day-number">${day}</div>
          ${dayRecords.slice(0, 3).map(r => {
            const title = r.values[primaryField?.id] || 'Event';
            return `<div class="calendar-event" data-record-id="${r.id}">${this._escapeHtml(title)}</div>`;
          }).join('')}
          ${dayRecords.length > 3 ? `<div class="calendar-event">+${dayRecords.length - 3} more</div>` : ''}
        </div>
      `;
    }

    html += '</div></div>';
    this.elements.contentArea.innerHTML = html;

    // Attach event listeners
    document.querySelectorAll('.calendar-event').forEach(event => {
      event.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showRecordDetail(event.dataset.recordId);
      });
    });

    document.querySelectorAll('.calendar-day').forEach(day => {
      day.addEventListener('click', () => {
        const date = day.dataset.date;
        if (date) {
          const record = this.addRecord();
          this._updateRecordValue(record.id, dateField.id, date);
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Graph View (Cytoscape.js powered)
  // --------------------------------------------------------------------------

  _renderGraphView() {
    const set = this.getCurrentSet();
    const records = this.getFilteredRecords();
    const primaryField = set?.fields.find(f => f.isPrimary) || set?.fields[0];

    // Check for link fields to show relationships
    const linkFields = set?.fields.filter(f => f.type === FieldTypes.LINK) || [];

    // Check for a corresponding relationship set
    const relationshipSet = set ? this.sets.find(s =>
      s.name === `${set.name} - Relationships` ||
      s.name === `${set.name} - Edges`
    ) : null;
    const hasRelationshipSet = relationshipSet && relationshipSet.records?.length > 0;

    // Determine if we have any relationship data
    const hasRelationships = linkFields.length > 0 || hasRelationshipSet;
    const relationshipInfo = hasRelationshipSet
      ? `${relationshipSet.records.length} relationships`
      : (linkFields.length > 0 ? `${linkFields.length} relationship type${linkFields.length !== 1 ? 's' : ''}` : '');

    // Initialize graph display settings if not set
    if (!this.graphSettings) {
      this.graphSettings = {
        layout: 'force', // 'force', 'circular', 'grid', 'concentric'
        showLabels: true,
        labelPosition: 'outside', // 'inside', 'outside', 'hover'
        nodeSize: 'medium', // 'small', 'medium', 'large'
      };
    }

    this.elements.contentArea.innerHTML = `
      <div class="graph-container">
        <div class="graph-toolbar">
          <div class="graph-info">
            <i class="ph ph-graph"></i>
            <span>${records.length} nodes${hasRelationships ? `, ${relationshipInfo}` : ''}</span>
          </div>
          <div class="graph-controls-inline">
            <div class="graph-control-group">
              <label class="graph-control-label">Layout:</label>
              <select id="graph-layout-select" class="graph-select">
                <option value="force" ${this.graphSettings.layout === 'force' ? 'selected' : ''}>Force</option>
                <option value="circular" ${this.graphSettings.layout === 'circular' ? 'selected' : ''}>Circular</option>
                <option value="grid" ${this.graphSettings.layout === 'grid' ? 'selected' : ''}>Grid</option>
                <option value="concentric" ${this.graphSettings.layout === 'concentric' ? 'selected' : ''}>Concentric</option>
              </select>
            </div>
            <div class="graph-control-group">
              <label class="graph-control-label">Labels:</label>
              <select id="graph-label-select" class="graph-select">
                <option value="outside" ${this.graphSettings.labelPosition === 'outside' ? 'selected' : ''}>Outside</option>
                <option value="inside" ${this.graphSettings.labelPosition === 'inside' ? 'selected' : ''}>Inside</option>
                <option value="hover" ${this.graphSettings.labelPosition === 'hover' ? 'selected' : ''}>On Hover</option>
              </select>
            </div>
            <div class="graph-control-group">
              <label class="graph-control-label">Size:</label>
              <select id="graph-size-select" class="graph-select">
                <option value="small" ${this.graphSettings.nodeSize === 'small' ? 'selected' : ''}>Small</option>
                <option value="medium" ${this.graphSettings.nodeSize === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="large" ${this.graphSettings.nodeSize === 'large' ? 'selected' : ''}>Large</option>
              </select>
            </div>
            <div class="graph-control-divider"></div>
            <button class="graph-control-btn" id="graph-zoom-in" title="Zoom In">
              <i class="ph ph-magnifying-glass-plus"></i>
            </button>
            <button class="graph-control-btn" id="graph-zoom-out" title="Zoom Out">
              <i class="ph ph-magnifying-glass-minus"></i>
            </button>
            <button class="graph-control-btn" id="graph-center" title="Center & Fit">
              <i class="ph ph-crosshair"></i>
            </button>
          </div>
        </div>
        <div class="graph-canvas-wrapper" id="cy-workbench-container">
          <div class="graph-loading" id="graph-loading">
            <div class="graph-loading-content">
              <i class="ph ph-spinner ph-spin"></i>
              <span>Calculating layout...</span>
            </div>
          </div>
        </div>
        ${!hasRelationships && records.length > 0 ? `
          <div class="graph-hint graph-hint-actionable">
            <div class="graph-hint-content">
              <i class="ph ph-link-simple"></i>
              <div class="graph-hint-text">
                <strong>No relationships found</strong>
                <p>Add a "Link to record" field to connect records and visualize relationships as edges in the graph.</p>
              </div>
            </div>
            <button class="graph-hint-action" id="graph-add-link-field">
              <i class="ph ph-plus"></i>
              Add Link Field
            </button>
          </div>
        ` : ''}
      </div>
    `;

    // Show loading indicator for large graphs
    const showGraphLoading = records.length > 50;
    if (showGraphLoading) {
      this._showGraphLoading('Building graph...');
    }

    // Initialize Cytoscape graph (use setTimeout to allow loading UI to render)
    if (showGraphLoading) {
      setTimeout(() => {
        this._initWorkbenchCytoscape(records, primaryField, linkFields);
      }, 50);
    } else {
      this._initWorkbenchCytoscape(records, primaryField, linkFields);
    }

    // Add control event listeners
    document.getElementById('graph-layout-select')?.addEventListener('change', (e) => {
      this.graphSettings.layout = e.target.value;
      this._showGraphLoading('Recalculating layout...');
      setTimeout(() => {
        this._applyWorkbenchLayout();
      }, 50);
    });

    document.getElementById('graph-label-select')?.addEventListener('change', (e) => {
      this.graphSettings.labelPosition = e.target.value;
      this._updateWorkbenchLabelStyle();
    });

    document.getElementById('graph-size-select')?.addEventListener('change', (e) => {
      this.graphSettings.nodeSize = e.target.value;
      this._updateWorkbenchNodeSize();
    });

    // Zoom controls
    document.getElementById('graph-zoom-in')?.addEventListener('click', () => {
      if (this.workbenchCy) {
        this.workbenchCy.zoom(this.workbenchCy.zoom() * 1.2);
        this.workbenchCy.center();
      }
    });

    document.getElementById('graph-zoom-out')?.addEventListener('click', () => {
      if (this.workbenchCy) {
        this.workbenchCy.zoom(this.workbenchCy.zoom() / 1.2);
        this.workbenchCy.center();
      }
    });

    document.getElementById('graph-center')?.addEventListener('click', () => {
      if (this.workbenchCy) {
        this.workbenchCy.fit(undefined, 50);
      }
    });

    // Add Link Field button in graph hint
    document.getElementById('graph-add-link-field')?.addEventListener('click', () => {
      this._addLinkFieldFromGraph();
    });
  }

  /**
   * Helper to add a link field from the graph view hint
   */
  _addLinkFieldFromGraph() {
    const set = this.getCurrentSet();
    if (!set) return;

    // Show linked set selection modal, then add the field
    this._showLinkedSetSelectionModal((options) => {
      if (options) {
        this._addField(FieldTypes.LINK, 'Related Records', options);
        this._showToast('Link field added! Connect records to see relationships in the graph.', 'success');
        // Switch to table view to show the new field
        this._switchViewType('table');
      }
    });
  }

  /**
   * Initialize Cytoscape graph for workbench
   */
  _initWorkbenchCytoscape(records, primaryField, linkFields) {
    const container = document.getElementById('cy-workbench-container');
    if (!container || records.length === 0) return;

    // Destroy existing instance
    if (this.workbenchCy) {
      this.workbenchCy.destroy();
      this.workbenchCy = null;
    }

    // Get size class
    const sizeClass = `size-${this.graphSettings.nodeSize || 'medium'}`;
    const labelClass = `label-${this.graphSettings.labelPosition || 'outside'}`;

    // Create nodes
    const nodes = records.map(record => {
      const label = record.values?.[primaryField?.id] || 'Untitled';
      return {
        data: {
          id: record.id,
          label: label,
          record: record
        },
        classes: `${sizeClass} ${labelClass}`
      };
    });

    // Build node maps for edge lookup
    const nodeMap = new Map(records.map(r => [r.id, r]));
    const nodeByTitle = new Map();
    records.forEach(record => {
      const title = record.values?.[primaryField?.id];
      if (title) nodeByTitle.set(title, record);
    });

    // Create edges from link fields
    const edges = [];
    records.forEach(record => {
      linkFields.forEach(field => {
        const linkedIds = record.values?.[field.id] || [];
        if (Array.isArray(linkedIds)) {
          linkedIds.forEach(linkedId => {
            if (nodeMap.has(linkedId)) {
              edges.push({
                data: {
                  id: `${record.id}-${linkedId}-${field.name}`,
                  source: record.id,
                  target: linkedId,
                  fieldName: field.name
                }
              });
            }
          });
        }
      });
    });

    // Also look for edges in relationship sets
    const currentSet = this.getCurrentSet();
    if (currentSet) {
      const relationshipSet = this.sets.find(s =>
        s.name === `${currentSet.name} - Relationships` ||
        s.name === `${currentSet.name} - Edges` ||
        (s.name?.includes('Relationships') && s.name?.includes(currentSet.name))
      );

      if (relationshipSet) {
        const fromField = relationshipSet.fields?.find(f =>
          f.name?.toLowerCase() === 'from' || f.name?.toLowerCase() === 'source'
        );
        const toField = relationshipSet.fields?.find(f =>
          f.name?.toLowerCase() === 'to' || f.name?.toLowerCase() === 'target'
        );

        if (fromField && toField) {
          relationshipSet.records?.forEach(relRecord => {
            const fromValue = relRecord.values?.[fromField.id];
            const toValue = relRecord.values?.[toField.id];

            if (!fromValue || !toValue) return;

            // Find matching nodes by ID or title
            let sourceRecord = nodeMap.get(fromValue) || nodeByTitle.get(fromValue);
            let targetRecord = nodeMap.get(toValue) || nodeByTitle.get(toValue);

            if (sourceRecord && targetRecord) {
              const typeField = relationshipSet.fields?.find(f => f.name?.toLowerCase() === 'type');
              const edgeType = typeField ? relRecord.values?.[typeField.id] : 'relationship';

              edges.push({
                data: {
                  id: `${sourceRecord.id}-${targetRecord.id}-${edgeType}`,
                  source: sourceRecord.id,
                  target: targetRecord.id,
                  fieldName: edgeType
                }
              });
            }
          });
        }
      }
    }

    // Count connections for node sizing
    const connectionCount = new Map();
    edges.forEach(edge => {
      connectionCount.set(edge.data.source, (connectionCount.get(edge.data.source) || 0) + 1);
      connectionCount.set(edge.data.target, (connectionCount.get(edge.data.target) || 0) + 1);
    });

    // Add connection count to node data
    nodes.forEach(node => {
      node.data.connections = connectionCount.get(node.data.id) || 0;
      if (node.data.connections >= 3) {
        node.classes += ' high-connectivity';
      }
    });

    // Initialize Cytoscape with workbench stylesheet
    this.workbenchCy = createCytoscapeInstance(container, {
      useWorkbenchStyle: true,
      elements: [...nodes, ...edges]
    });

    // Apply initial layout
    this._applyWorkbenchLayout();

    // Set up event handlers
    this.workbenchCy.on('tap', 'node', (evt) => {
      const nodeId = evt.target.id();
      this._showRecordDetail(nodeId);
    });

    // Hover effects
    this.workbenchCy.on('mouseover', 'node', (evt) => {
      evt.target.addClass('highlighted');
      container.style.cursor = 'pointer';
    });

    this.workbenchCy.on('mouseout', 'node', (evt) => {
      evt.target.removeClass('highlighted');
      container.style.cursor = 'default';
    });

    this.workbenchCy.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      const edgeData = edge.data();
      this._showEdgeDetail(edgeData);
    });

    this.workbenchCy.on('mouseover', 'edge', (evt) => {
      evt.target.addClass('highlighted');
      container.style.cursor = 'pointer';
    });

    this.workbenchCy.on('mouseout', 'edge', (evt) => {
      evt.target.removeClass('highlighted');
      container.style.cursor = 'default';
    });
  }

  /**
   * Show loading indicator in graph view
   */
  _showGraphLoading(message = 'Calculating layout...') {
    const loadingEl = document.getElementById('graph-loading');
    if (loadingEl) {
      const textEl = loadingEl.querySelector('span');
      if (textEl) textEl.textContent = message;
      loadingEl.style.display = 'flex';
    }
  }

  /**
   * Hide loading indicator in graph view
   */
  _hideGraphLoading() {
    const loadingEl = document.getElementById('graph-loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  }

  /**
   * Apply layout to workbench graph
   */
  _applyWorkbenchLayout() {
    if (!this.workbenchCy) return;

    const layoutType = this.graphSettings?.layout || 'force';
    const layoutConfig = getLayoutConfig(layoutType);

    // Add callback to hide loading when layout completes
    const layout = this.workbenchCy.layout({
      ...layoutConfig,
      stop: () => {
        this._hideGraphLoading();
      }
    });
    layout.run();
  }

  /**
   * Update label style on workbench graph
   */
  _updateWorkbenchLabelStyle() {
    if (!this.workbenchCy) return;

    const labelPosition = this.graphSettings?.labelPosition || 'outside';

    // Remove existing label classes and add new one
    this.workbenchCy.nodes().forEach(node => {
      node.removeClass('label-outside label-inside label-hover');
      node.addClass(`label-${labelPosition}`);
    });
  }

  /**
   * Update node size on workbench graph
   */
  _updateWorkbenchNodeSize() {
    if (!this.workbenchCy) return;

    const nodeSize = this.graphSettings?.nodeSize || 'medium';

    // Remove existing size classes and add new one
    this.workbenchCy.nodes().forEach(node => {
      node.removeClass('size-small size-medium size-large');
      node.addClass(`size-${nodeSize}`);
    });
  }

  // --------------------------------------------------------------------------
  // Filesystem View - Full Content Hierarchy
  // --------------------------------------------------------------------------

  _renderFilesystemView() {
    const currentSet = this.getCurrentSet();

    // Build hierarchy: Sources → Sets → Views → Records
    const hierarchy = this._buildContentHierarchy();

    this.elements.contentArea.innerHTML = `
      <div class="filesystem-container">
        <div class="filesystem-toolbar">
          <div class="filesystem-info">
            <i class="ph ph-folder-open"></i>
            <span>Content Hierarchy</span>
          </div>
          <div class="filesystem-breadcrumb" id="fs-breadcrumb">
            <span class="fs-breadcrumb-item root" data-level="root">
              <i class="ph ph-house"></i> Root
            </span>
          </div>
          <div class="filesystem-controls">
            <button class="filesystem-control-btn ${this.fsViewMode === 'tree' ? 'active' : ''}"
                    data-mode="tree" title="Tree View">
              <i class="ph ph-tree-structure"></i>
            </button>
            <button class="filesystem-control-btn ${this.fsViewMode === 'columns' ? 'active' : ''}"
                    data-mode="columns" title="Column View">
              <i class="ph ph-columns"></i>
            </button>
          </div>
        </div>
        <div class="filesystem-content" id="fs-content">
          ${this.fsViewMode === 'columns'
            ? this._renderFilesystemTable(hierarchy, currentSet)
            : this._renderFilesystemTree(hierarchy, currentSet)}
        </div>
      </div>
    `;

    this._attachFilesystemEventHandlers();
  }

  /**
   * Build the complete content hierarchy
   * Structure: Sources (GIVEN) → Sets (Interpretation) → Views (Lens) → Records
   */
  _buildContentHierarchy() {
    const hierarchy = {
      sources: new Map(),
      manualSets: []
    };

    // Group sets by their source
    for (const set of this.sets) {
      const prov = set.datasetProvenance;
      if (prov && (prov.originalFilename || prov.provenance?.source)) {
        const sourceName = prov.originalFilename || prov.provenance?.source || 'Unknown';
        const sourceKey = sourceName.toLowerCase();

        if (!hierarchy.sources.has(sourceKey)) {
          hierarchy.sources.set(sourceKey, {
            name: sourceName,
            type: 'source',
            level: 'given',
            importedAt: prov.importedAt,
            provenance: prov.provenance,
            children: []
          });
        }
        hierarchy.sources.get(sourceKey).children.push({
          ...set,
          type: 'set',
          level: 'meant'
        });
      } else {
        hierarchy.manualSets.push({
          ...set,
          type: 'set',
          level: 'meant'
        });
      }
    }

    return hierarchy;
  }

  /**
   * Render the filesystem tree view
   */
  _renderFilesystemTree(hierarchy, currentSet) {
    let html = '<div class="fs-tree">';

    // Layer indicator
    html += `
      <div class="fs-layer-legend">
        <div class="fs-layer-item given">
          <i class="ph ph-download"></i>
          <span>GIVEN</span>
          <span class="fs-layer-desc">Raw data sources</span>
        </div>
        <div class="fs-layer-item meant">
          <i class="ph ph-database"></i>
          <span>MEANT</span>
          <span class="fs-layer-desc">Interpreted data</span>
        </div>
        <div class="fs-layer-item lens">
          <i class="ph ph-eye"></i>
          <span>LENS</span>
          <span class="fs-layer-desc">Views & perspectives</span>
        </div>
        <div class="fs-layer-item entity">
          <i class="ph ph-rows"></i>
          <span>ENTITY</span>
          <span class="fs-layer-desc">Individual records</span>
        </div>
      </div>
    `;

    // Render imported sources
    const sources = Array.from(hierarchy.sources.values());
    if (sources.length > 0) {
      html += `<div class="fs-section">`;
      for (const source of sources) {
        const isExpanded = this.expandedFsNodes?.has(`source:${source.name}`) ?? true;
        html += this._renderSourceNode(source, isExpanded, currentSet);
      }
      html += `</div>`;
    }

    // Render manual sets
    if (hierarchy.manualSets.length > 0) {
      const isExpanded = this.expandedFsNodes?.has('manual') ?? true;
      html += `
        <div class="fs-section">
          <div class="fs-node source-node manual ${isExpanded ? 'expanded' : ''}" data-node-id="manual">
            <div class="fs-node-header" data-level="given">
              <i class="ph ph-caret-right fs-toggle"></i>
              <i class="ph ph-pencil-simple-line fs-icon"></i>
              <span class="fs-node-title">Manual Entry</span>
              <span class="fs-node-count">${hierarchy.manualSets.length} sets</span>
            </div>
            <div class="fs-node-children">
              ${hierarchy.manualSets.map(set => this._renderSetNode(set, currentSet)).join('')}
            </div>
          </div>
        </div>
      `;
    }

    // If no data yet
    if (sources.length === 0 && hierarchy.manualSets.length === 0) {
      html += `
        <div class="fs-empty">
          <i class="ph ph-folder-open"></i>
          <h3>No Content Yet</h3>
          <p>Import data or create a set to see the content hierarchy</p>
          <div class="fs-empty-actions">
            <button class="btn btn-primary" id="fs-import-btn">
              <i class="ph ph-file-arrow-down"></i> Import Data
            </button>
            <button class="btn btn-secondary" id="fs-create-set-btn">
              <i class="ph ph-plus"></i> Create Set
            </button>
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  /**
   * Render the filesystem as a table view (like Windows Explorer / Finder)
   */
  _renderFilesystemTable(hierarchy, currentSet) {
    const rows = [];

    // Flatten hierarchy into table rows
    const sources = Array.from(hierarchy.sources.values());
    for (const source of sources) {
      const sourceExpanded = this.expandedFsNodes?.has(`source:${source.name}`) ?? true;
      const importDate = source.importedAt
        ? new Date(source.importedAt).toLocaleDateString()
        : '';

      rows.push({
        id: `source:${source.name}`,
        name: source.name,
        type: 'Source',
        icon: this._getSourceIcon(source.name).replace('ph-', ''),
        count: `${source.children.length} sets`,
        modified: importDate,
        depth: 0,
        hasChildren: source.children.length > 0,
        expanded: sourceExpanded,
        nodeType: 'source'
      });

      if (sourceExpanded) {
        for (const set of source.children) {
          this._addSetToTableRows(rows, set, 1, currentSet);
        }
      }
    }

    // Manual sets
    if (hierarchy.manualSets.length > 0) {
      const manualExpanded = this.expandedFsNodes?.has('manual') ?? true;

      rows.push({
        id: 'manual',
        name: 'Manual Entry',
        type: 'Source',
        icon: 'pencil-simple-line',
        count: `${hierarchy.manualSets.length} sets`,
        modified: '',
        depth: 0,
        hasChildren: hierarchy.manualSets.length > 0,
        expanded: manualExpanded,
        nodeType: 'source'
      });

      if (manualExpanded) {
        for (const set of hierarchy.manualSets) {
          this._addSetToTableRows(rows, set, 1, currentSet);
        }
      }
    }

    if (rows.length === 0) {
      return `
        <div class="fs-table-empty">
          <i class="ph ph-folder-open"></i>
          <h3>No Content Yet</h3>
          <p>Import data or create a set to get started</p>
          <div class="fs-empty-actions">
            <button class="btn btn-primary" id="fs-import-btn">
              <i class="ph ph-file-arrow-down"></i> Import Data
            </button>
            <button class="btn btn-secondary" id="fs-create-set-btn">
              <i class="ph ph-plus"></i> Create Set
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="fs-table-container">
        <table class="fs-table">
          <thead>
            <tr>
              <th class="fs-table-name">Name</th>
              <th class="fs-table-type">Type</th>
              <th class="fs-table-count">Records</th>
              <th class="fs-table-modified">Modified</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => this._renderTableRow(row, currentSet)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Add a set and its children to table rows
   */
  _addSetToTableRows(rows, set, depth, currentSet) {
    const isActive = set.id === currentSet?.id;
    const setExpanded = this.expandedFsNodes?.has(`set:${set.id}`) ?? isActive;
    const views = set.views || [];
    const recordCount = set.records?.length || 0;

    // Extract just the icon name (e.g., 'database' from 'ph ph-database' or 'ph-database')
    const rawIcon = set.icon || 'ph ph-database';
    const iconName = rawIcon.split(' ').pop().replace('ph-', '');

    rows.push({
      id: `set:${set.id}`,
      setId: set.id,
      name: set.name,
      type: 'Dataset',
      icon: iconName,
      count: `${recordCount} records`,
      modified: '',
      depth: depth,
      hasChildren: views.length > 0,
      expanded: setExpanded,
      nodeType: 'set',
      isActive: isActive
    });

    if (setExpanded) {
      // Add views
      for (const view of views) {
        const viewIcons = {
          table: 'table',
          cards: 'cards',
          kanban: 'kanban',
          calendar: 'calendar-blank',
          graph: 'graph',
          filesystem: 'folder-open'
        };
        const isViewActive = view.id === this.currentViewId && set.id === currentSet?.id;

        rows.push({
          id: `view:${view.id}`,
          viewId: view.id,
          setId: set.id,
          name: view.name,
          type: view.type.charAt(0).toUpperCase() + view.type.slice(1),
          icon: viewIcons[view.type] || 'table',
          count: '',
          modified: '',
          depth: depth + 1,
          hasChildren: false,
          expanded: false,
          nodeType: 'view',
          isActive: isViewActive
        });
      }
    }
  }

  /**
   * Render a single table row
   */
  _renderTableRow(row, currentSet) {
    const indent = row.depth * 20;
    const toggleIcon = row.hasChildren
      ? (row.expanded ? 'ph-caret-down' : 'ph-caret-right')
      : 'ph-minus';
    const toggleClass = row.hasChildren ? 'fs-table-toggle' : 'fs-table-spacer';

    return `
      <tr class="fs-table-row ${row.isActive ? 'active' : ''} ${row.nodeType}-row"
          data-row-id="${this._escapeHtml(row.id)}"
          data-node-type="${row.nodeType}"
          ${row.setId ? `data-set-id="${row.setId}"` : ''}
          ${row.viewId ? `data-view-id="${row.viewId}"` : ''}>
        <td class="fs-table-name">
          <div class="fs-table-name-content" style="padding-left: ${indent}px">
            <i class="ph ${toggleIcon} ${toggleClass}"></i>
            <i class="ph ph-${row.icon} fs-table-icon"></i>
            <span class="fs-table-name-text">${this._escapeHtml(row.name)}</span>
          </div>
        </td>
        <td class="fs-table-type">
          <span class="fs-type-badge fs-type-${row.nodeType}">${row.type}</span>
        </td>
        <td class="fs-table-count">${row.count}</td>
        <td class="fs-table-modified">${row.modified}</td>
      </tr>
    `;
  }

  /**
   * Render a source node
   */
  _renderSourceNode(source, isExpanded, currentSet) {
    const sourceIcon = this._getSourceIcon(source.name);
    const provTooltip = this._formatSourceProvenance(source);
    const importDate = source.importedAt
      ? new Date(source.importedAt).toLocaleDateString()
      : '';

    return `
      <div class="fs-node source-node ${isExpanded ? 'expanded' : ''}"
           data-node-id="source:${this._escapeHtml(source.name)}">
        <div class="fs-node-header" data-level="given" title="${this._escapeHtml(provTooltip)}">
          <i class="ph ph-caret-right fs-toggle"></i>
          <i class="ph ${sourceIcon} fs-icon"></i>
          <span class="fs-node-title">${this._escapeHtml(source.name)}</span>
          <span class="fs-node-meta">${importDate}</span>
          <span class="fs-node-count">${source.children.length} sets</span>
        </div>
        <div class="fs-node-children">
          ${source.children.map(set => this._renderSetNode(set, currentSet)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render a set node with its views
   */
  _renderSetNode(set, currentSet) {
    const isActive = set.id === currentSet?.id;
    const isExpanded = this.expandedFsNodes?.has(`set:${set.id}`) ?? isActive;
    const views = set.views || [];

    return `
      <div class="fs-node set-node ${isExpanded ? 'expanded' : ''} ${isActive ? 'active' : ''}"
           data-node-id="set:${set.id}">
        <div class="fs-node-header" data-level="meant" data-set-id="${set.id}">
          <i class="ph ph-caret-right fs-toggle"></i>
          <i class="${set.icon || 'ph ph-database'} fs-icon"></i>
          <span class="fs-node-title">${this._escapeHtml(set.name)}</span>
          <span class="fs-node-count">${set.records?.length || 0} records</span>
        </div>
        <div class="fs-node-children">
          ${views.map(view => this._renderViewNode(view, set, currentSet)).join('')}
          ${this._renderRecordsSummary(set)}
        </div>
      </div>
    `;
  }

  /**
   * Render a view node
   */
  _renderViewNode(view, set, currentSet) {
    const isActive = view.id === this.currentViewId && set.id === currentSet?.id;
    const viewIcons = {
      table: 'ph-table',
      cards: 'ph-cards',
      kanban: 'ph-kanban',
      calendar: 'ph-calendar-blank',
      graph: 'ph-graph',
      filesystem: 'ph-folder-open'
    };

    return `
      <div class="fs-node view-node ${isActive ? 'active' : ''}"
           data-node-id="view:${view.id}"
           data-view-id="${view.id}"
           data-set-id="${set.id}">
        <div class="fs-node-header" data-level="lens">
          <i class="ph ph-minus fs-spacer"></i>
          <i class="ph ${viewIcons[view.type] || 'ph-table'} fs-icon"></i>
          <span class="fs-node-title">${this._escapeHtml(view.name)}</span>
          <span class="fs-node-type">${view.type}</span>
        </div>
      </div>
    `;
  }

  /**
   * Render records summary under a set
   */
  _renderRecordsSummary(set) {
    const recordCount = set.records?.length || 0;
    if (recordCount === 0) return '';

    const isExpanded = this.expandedFsNodes?.has(`records:${set.id}`) ?? false;
    const displayRecords = isExpanded ? set.records.slice(0, 50) : [];
    const primaryField = set.fields?.find(f => f.isPrimary) || set.fields?.[0];

    return `
      <div class="fs-node records-node ${isExpanded ? 'expanded' : ''}"
           data-node-id="records:${set.id}">
        <div class="fs-node-header" data-level="entity">
          <i class="ph ph-caret-right fs-toggle"></i>
          <i class="ph ph-rows fs-icon"></i>
          <span class="fs-node-title">Records</span>
          <span class="fs-node-count">${recordCount} items</span>
        </div>
        <div class="fs-node-children">
          ${displayRecords.map(record => {
            const title = record.values?.[primaryField?.id] || 'Untitled';
            return `
              <div class="fs-node record-node" data-record-id="${record.id}" data-set-id="${set.id}">
                <div class="fs-node-header" data-level="entity">
                  <i class="ph ph-minus fs-spacer"></i>
                  <i class="ph ph-file-text fs-icon"></i>
                  <span class="fs-node-title">${this._escapeHtml(String(title).substring(0, 40))}</span>
                </div>
              </div>
            `;
          }).join('')}
          ${recordCount > 50 ? `
            <div class="fs-more-indicator">
              <i class="ph ph-dots-three"></i>
              <span>+${recordCount - 50} more records</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Attach event handlers to filesystem view
   */
  _attachFilesystemEventHandlers() {
    const container = document.getElementById('fs-content');
    if (!container) return;

    // Initialize state
    if (!this.expandedFsNodes) this.expandedFsNodes = new Set();
    if (!this.fsViewMode) this.fsViewMode = 'columns';

    const tree = container.querySelector('.fs-tree');

    // Restore selection from previous render
    if (this.selectedFsNodeId) {
      const selectedNode = container.querySelector(`.fs-node[data-node-id="${this.selectedFsNodeId}"]`);
      if (selectedNode) {
        selectedNode.classList.add('selected');
      }
    }
    if (tree) {
      tree.setAttribute('tabindex', '0');
    }

    // Helper to select a node visually (without opening)
    const selectNode = (nodeId) => {
      // Remove previous selection
      container.querySelectorAll('.fs-node.selected').forEach(n => {
        n.classList.remove('selected');
      });
      this.selectedFsNodeId = nodeId;
      if (nodeId) {
        const node = container.querySelector(`.fs-node[data-node-id="${nodeId}"]`);
        if (node) {
          node.classList.add('selected');
          // Scroll into view if needed
          node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    };

    // Helper to open/navigate to a node
    const openNode = (node) => {
      if (!node) return;

      if (node.classList.contains('set-node')) {
        const setId = node.querySelector('.fs-node-header')?.dataset.setId;
        if (setId) this._selectSet(setId);
      } else if (node.classList.contains('view-node')) {
        const setId = node.dataset.setId;
        const viewId = node.dataset.viewId;
        if (setId && viewId) {
          if (this.currentSetId !== setId) this._selectSet(setId);
          this._selectView(viewId);
        }
      } else if (node.classList.contains('record-node')) {
        const recordId = node.dataset.recordId;
        const setId = node.dataset.setId;
        if (recordId && setId) {
          if (this.currentSetId !== setId) this._selectSet(setId);
          this._showRecordDetail(recordId);
        }
      } else if (node.classList.contains('source-node') || node.classList.contains('records-node')) {
        // Toggle expand/collapse for container nodes
        node.classList.toggle('expanded');
        const nodeId = node.dataset.nodeId;
        if (node.classList.contains('expanded')) {
          this.expandedFsNodes.add(nodeId);
        } else {
          this.expandedFsNodes.delete(nodeId);
        }
      }
    };

    // Get all navigable nodes in order
    const getNavigableNodes = () => {
      const nodes = [];
      const collectNodes = (parentEl) => {
        parentEl.querySelectorAll(':scope > .fs-node, :scope > .fs-section > .fs-node').forEach(node => {
          nodes.push(node);
          // If expanded, also collect children
          if (node.classList.contains('expanded')) {
            const children = node.querySelector('.fs-node-children');
            if (children) collectNodes(children);
          }
        });
      };
      collectNodes(tree);
      return nodes;
    };

    // Toggle nodes via chevron click
    container.querySelectorAll('.fs-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const node = toggle.closest('.fs-node');
        const nodeId = node.dataset.nodeId;
        node.classList.toggle('expanded');
        if (node.classList.contains('expanded')) {
          this.expandedFsNodes.add(nodeId);
        } else {
          this.expandedFsNodes.delete(nodeId);
        }
      });
    });

    // Single-click on any node header = select only
    container.querySelectorAll('.fs-node-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.fs-toggle')) return;
        const node = header.closest('.fs-node');
        const nodeId = node?.dataset.nodeId;
        if (nodeId) {
          selectNode(nodeId);
          tree?.focus();
        }
      });
    });

    // Double-click on any node header = open/navigate
    container.querySelectorAll('.fs-node-header').forEach(header => {
      header.addEventListener('dblclick', (e) => {
        if (e.target.closest('.fs-toggle')) return;
        const node = header.closest('.fs-node');
        openNode(node);
      });
    });

    // Keyboard navigation
    tree?.addEventListener('keydown', (e) => {
      const nodes = getNavigableNodes();
      const currentIndex = nodes.findIndex(n => n.dataset.nodeId === this.selectedFsNodeId);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < nodes.length - 1) {
            selectNode(nodes[currentIndex + 1].dataset.nodeId);
          } else if (currentIndex === -1 && nodes.length > 0) {
            selectNode(nodes[0].dataset.nodeId);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            selectNode(nodes[currentIndex - 1].dataset.nodeId);
          } else if (currentIndex === -1 && nodes.length > 0) {
            selectNode(nodes[nodes.length - 1].dataset.nodeId);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex >= 0) {
            const node = nodes[currentIndex];
            if (!node.classList.contains('expanded') && node.querySelector('.fs-node-children')) {
              node.classList.add('expanded');
              this.expandedFsNodes.add(node.dataset.nodeId);
            }
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex >= 0) {
            const node = nodes[currentIndex];
            if (node.classList.contains('expanded')) {
              node.classList.remove('expanded');
              this.expandedFsNodes.delete(node.dataset.nodeId);
            } else {
              // Navigate to parent
              const parent = node.parentElement?.closest('.fs-node');
              if (parent?.dataset.nodeId) {
                selectNode(parent.dataset.nodeId);
              }
            }
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (currentIndex >= 0) {
            openNode(nodes[currentIndex]);
          }
          break;
        case ' ':
          e.preventDefault();
          if (currentIndex >= 0) {
            const node = nodes[currentIndex];
            // Space toggles expand/collapse
            if (node.querySelector('.fs-node-children')) {
              node.classList.toggle('expanded');
              if (node.classList.contains('expanded')) {
                this.expandedFsNodes.add(node.dataset.nodeId);
              } else {
                this.expandedFsNodes.delete(node.dataset.nodeId);
              }
            }
          }
          break;
      }
    });

    // View mode toggle
    document.querySelectorAll('.filesystem-control-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.fsViewMode = btn.dataset.mode;
        this._renderFilesystemView();
      });
    });

    // Empty state buttons
    document.getElementById('fs-import-btn')?.addEventListener('click', () => {
      this._showImportModal();
    });

    document.getElementById('fs-create-set-btn')?.addEventListener('click', () => {
      this._showNewSetModal();
    });

    // Table view event handlers
    this._attachTableEventHandlers(container);
  }

  /**
   * Attach event handlers for table view
   */
  _attachTableEventHandlers(container) {
    const table = container.querySelector('.fs-table');
    if (!table) return;

    // Single click to select
    table.querySelectorAll('.fs-table-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // If clicking on toggle, handle expand/collapse
        if (e.target.closest('.fs-table-toggle')) {
          const rowId = row.dataset.rowId;
          if (this.expandedFsNodes.has(rowId)) {
            this.expandedFsNodes.delete(rowId);
          } else {
            this.expandedFsNodes.add(rowId);
          }
          this._renderFilesystemView();
          return;
        }

        // Select the row
        table.querySelectorAll('.fs-table-row.selected').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        this.selectedFsNodeId = row.dataset.rowId;
      });

      // Double click to open
      row.addEventListener('dblclick', () => {
        const nodeType = row.dataset.nodeType;
        const setId = row.dataset.setId;
        const viewId = row.dataset.viewId;

        if (nodeType === 'set' && setId) {
          this._selectSet(setId);
        } else if (nodeType === 'view' && setId && viewId) {
          if (this.currentSetId !== setId) this._selectSet(setId);
          this._selectView(viewId);
        } else if (nodeType === 'source') {
          // Toggle expand
          const rowId = row.dataset.rowId;
          if (this.expandedFsNodes.has(rowId)) {
            this.expandedFsNodes.delete(rowId);
          } else {
            this.expandedFsNodes.add(rowId);
          }
          this._renderFilesystemView();
        }
      });
    });

    // Keyboard navigation for table
    table.setAttribute('tabindex', '0');
    table.addEventListener('keydown', (e) => {
      const rows = Array.from(table.querySelectorAll('.fs-table-row'));
      const selectedRow = table.querySelector('.fs-table-row.selected');
      const currentIndex = selectedRow ? rows.indexOf(selectedRow) : -1;

      const selectRow = (index) => {
        if (index >= 0 && index < rows.length) {
          rows.forEach(r => r.classList.remove('selected'));
          rows[index].classList.add('selected');
          rows[index].scrollIntoView({ block: 'nearest' });
          this.selectedFsNodeId = rows[index].dataset.rowId;
        }
      };

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectRow(currentIndex + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectRow(currentIndex > 0 ? currentIndex - 1 : 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (selectedRow) {
            const rowId = selectedRow.dataset.rowId;
            if (!this.expandedFsNodes.has(rowId)) {
              this.expandedFsNodes.add(rowId);
              this._renderFilesystemView();
            }
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (selectedRow) {
            const rowId = selectedRow.dataset.rowId;
            if (this.expandedFsNodes.has(rowId)) {
              this.expandedFsNodes.delete(rowId);
              this._renderFilesystemView();
            }
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedRow) {
            selectedRow.dispatchEvent(new MouseEvent('dblclick'));
          }
          break;
      }
    });
  }

  // --------------------------------------------------------------------------
  // Record Operations
  // --------------------------------------------------------------------------

  addRecord(values = {}, skipUndo = false) {
    const set = this.getCurrentSet();
    if (!set) return null;

    const record = createRecord(set.id, values);
    set.records.push(record);

    // Track for undo (unless skipping)
    if (!skipUndo) {
      this._pushUndoAction({
        type: 'create_record',
        recordId: record.id,
        record: { ...record },
        setId: set.id
      });
    }

    // Create EO event
    if (this.eoApp) {
      this._createEOEvent('record_created', { recordId: record.id, values });
    }

    this._saveData();
    this._renderView();

    return record;
  }

  deleteRecord(recordId, skipUndo = false) {
    const set = this.getCurrentSet();
    if (!set) return;

    const index = set.records.findIndex(r => r.id === recordId);
    if (index === -1) return;

    const record = set.records[index];

    // Track for undo (unless skipping)
    if (!skipUndo) {
      this._pushUndoAction({
        type: 'delete_record',
        recordId,
        record: { ...record, values: { ...record.values } },
        setId: set.id
      });
    }

    // Create EO event
    if (this.eoApp) {
      this._createEOEvent('record_deleted', { recordId, record });
    }

    set.records.splice(index, 1);
    this.selectedRecords.delete(recordId);

    this._saveData();
    this._renderView();
  }

  duplicateRecord(recordId) {
    const set = this.getCurrentSet();
    const original = set?.records.find(r => r.id === recordId);
    if (!original) return;

    const duplicate = createRecord(set.id, { ...original.values });
    set.records.push(duplicate);

    this._saveData();
    this._renderView();

    return duplicate;
  }

  // --------------------------------------------------------------------------
  // Field Operations
  // --------------------------------------------------------------------------

  _addField(type, name = 'New Field') {
    const set = this.getCurrentSet();
    if (!set) return;

    const field = createField(name, type);

    // For select fields, add default choices
    if (type === FieldTypes.SELECT || type === FieldTypes.MULTI_SELECT) {
      field.options.choices = [
        { id: generateId(), name: 'Option 1', color: 'blue' },
        { id: generateId(), name: 'Option 2', color: 'green' },
        { id: generateId(), name: 'Option 3', color: 'yellow' }
      ];
    }

    set.fields.push(field);
    this._saveData();
    this._renderView();

    return field;
  }

  _deleteField(fieldId) {
    const set = this.getCurrentSet();
    if (!set) return;

    const index = set.fields.findIndex(f => f.id === fieldId);
    if (index === -1) return;

    // Don't delete the primary field if it's the only one
    if (set.fields[index].isPrimary && set.fields.length === 1) {
      return;
    }

    set.fields.splice(index, 1);

    // Remove field values from all records
    set.records.forEach(record => {
      delete record.values[fieldId];
    });

    this._saveData();
    this._renderView();
  }

  _renameField(fieldId, newName) {
    const set = this.getCurrentSet();
    const field = set?.fields.find(f => f.id === fieldId);
    if (!field) return;

    field.name = newName;
    this._saveData();
    this._renderView();
  }

  _changeFieldType(fieldId, newType, options = {}) {
    const set = this.getCurrentSet();
    const field = set?.fields.find(f => f.id === fieldId);
    if (!field) return;

    const oldType = field.type;

    // Don't do anything if the type hasn't changed
    if (oldType === newType) return;

    // Record the change in activity stream
    this._createEOEvent('field_type_changed', {
      setId: set.id,
      setName: set.name,
      fieldId: field.id,
      fieldName: field.name,
      oldType: oldType,
      newType: newType
    });

    // Update the field type
    field.type = newType;

    // Reset type-specific options for the new type
    field.options = {};
    switch (newType) {
      case FieldTypes.SELECT:
      case FieldTypes.MULTI_SELECT:
        field.options.choices = [
          { id: generateId(), name: 'Option 1', color: 'blue' },
          { id: generateId(), name: 'Option 2', color: 'green' },
          { id: generateId(), name: 'Option 3', color: 'yellow' }
        ];
        break;
      case FieldTypes.NUMBER:
        field.options.precision = 0;
        field.options.format = 'number';
        break;
      case FieldTypes.DATE:
        field.options.includeTime = false;
        field.options.dateFormat = 'local';
        field.options.timeFormat = '12h';
        break;
      case FieldTypes.LINK:
        // Use provided options or defaults
        field.options.linkedSetId = options.linkedSetId || null;
        field.options.allowMultiple = options.allowMultiple || false;
        break;
      case FieldTypes.ATTACHMENT:
        field.options.maxFiles = null;
        break;
      case FieldTypes.PHONE:
        field.options.defaultCountry = 'US';
        break;
      case FieldTypes.FORMULA:
        field.options.formula = '';
        field.options.resultType = 'text';
        break;
      case FieldTypes.ROLLUP:
        field.options.linkedFieldId = null;
        field.options.rollupFieldId = null;
        field.options.aggregation = 'SUM';
        break;
      case FieldTypes.COUNT:
        field.options.linkedFieldId = null;
        break;
      case FieldTypes.AUTONUMBER:
        field.options.prefix = '';
        field.options.startValue = 1;
        break;
      case FieldTypes.JSON:
        field.options.displayMode = 'keyValue';
        break;
    }

    this._saveData();
    this._renderView();
  }

  // --------------------------------------------------------------------------
  // Context Menus
  // --------------------------------------------------------------------------

  _showRecordContextMenu(e, recordId) {
    const menu = this.elements.contextMenu;
    if (!menu) return;

    const hasPickedUp = this.pickedUp && this.pickedUp.type === 'record';

    menu.innerHTML = `
      <div class="context-menu-item" data-action="open">
        <i class="ph ph-arrow-square-out"></i>
        <span>Open record</span>
      </div>
      <div class="context-menu-item" data-action="pick-up">
        <i class="ph ph-hand-grabbing"></i>
        <span>Pick up record</span>
      </div>
      ${hasPickedUp ? `
        <div class="context-menu-item" data-action="put-down">
          <i class="ph ph-hand-pointing"></i>
          <span>Put down here (merge)</span>
        </div>
      ` : ''}
      <div class="context-menu-item" data-action="duplicate">
        <i class="ph ph-copy"></i>
        <span>Duplicate</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item warning" data-action="toss">
        <i class="ph ph-arrow-bend-up-right"></i>
        <span>Toss record</span>
      </div>
    `;

    // Calculate position with viewport boundary checking
    const menuWidth = 200;
    const menuHeight = 130;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = e.pageX;
    let top = e.pageY;

    if (left + menuWidth > viewportWidth - 10) {
      left = viewportWidth - menuWidth - 10;
    }
    if (left < 10) left = 10;
    if (top + menuHeight > viewportHeight - 10) {
      top = viewportHeight - menuHeight - 10;
    }
    if (top < 10) top = 10;

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.classList.add('active');

    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        menu.classList.remove('active');
        const action = item.dataset.action;

        switch (action) {
          case 'open':
            this._showRecordDetail(recordId);
            break;
          case 'pick-up':
            const set = this.getCurrentSet();
            const record = set?.records.find(r => r.id === recordId);
            if (record) {
              this._pickUp('record', { ...record }, {
                setId: set.id,
                viewId: this.currentViewId,
                recordId
              });
            }
            break;
          case 'put-down':
            if (this.pickedUp?.type === 'record') {
              this._mergeRecords(this.pickedUp.data, recordId);
              this._clearPickedUp();
            }
            break;
          case 'duplicate':
            this.duplicateRecord(recordId);
            break;
          case 'toss':
            this._tossRecord(recordId);
            break;
        }
      });
    });
  }

  /**
   * Toss a record (not deleted, just removed from view)
   */
  _tossRecord(recordId) {
    const set = this.getCurrentSet();
    if (!set) return;

    const recordIndex = set.records.findIndex(r => r.id === recordId);
    if (recordIndex === -1) return;

    const record = set.records[recordIndex];

    // Add to tossed items
    this.tossedItems.unshift({
      type: 'record',
      record: { ...record },
      setId: set.id,
      tossedAt: new Date().toISOString()
    });

    if (this.tossedItems.length > this.maxTossedItems) {
      this.tossedItems.pop();
    }

    // Remove from set
    set.records.splice(recordIndex, 1);

    this._renderView();
    this._saveData();
    this._showToast('Record tossed - pick it up from the tossed pile', 'info');
  }

  /**
   * Merge two records together
   */
  _mergeRecords(sourceRecord, targetRecordId) {
    const set = this.getCurrentSet();
    if (!set) return;

    const targetRecord = set.records.find(r => r.id === targetRecordId);
    if (!targetRecord) return;

    // Merge values from source into target (source wins for non-empty values)
    Object.entries(sourceRecord.values).forEach(([fieldId, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        targetRecord.values[fieldId] = value;
      }
    });

    targetRecord.updatedAt = new Date().toISOString();

    this._renderView();
    this._saveData();
    this._showToast('Records merged', 'success');
  }

  _showFieldContextMenu(e, fieldId) {
    const menu = this.elements.contextMenu;
    if (!menu) return;

    const set = this.getCurrentSet();
    const field = set?.fields.find(f => f.id === fieldId);
    if (!field) return;

    // Get friendly type name for display
    const typeNames = {
      'text': 'Text',
      'longText': 'Long text',
      'number': 'Number',
      'select': 'Single select',
      'multiSelect': 'Multiple select',
      'date': 'Date',
      'checkbox': 'Checkbox',
      'link': 'Link',
      'attachment': 'Attachment',
      'url': 'URL',
      'email': 'Email',
      'phone': 'Phone',
      'formula': 'Formula',
      'rollup': 'Rollup',
      'count': 'Count',
      'autonumber': 'Autonumber',
      'json': 'JSON'
    };

    const hasSubfields = field.options?.subfields;
    const subfieldLabel = hasSubfields
      ? `Subfields (${field.options.subfields.mode})`
      : 'Add Subfields';

    menu.innerHTML = `
      <div class="context-menu-item" data-action="rename">
        <i class="ph ph-pencil"></i>
        <span>Rename field</span>
      </div>
      <div class="context-menu-item" data-action="change-type">
        <i class="ph ${FieldTypeIcons[field.type]}"></i>
        <span>Change type (${typeNames[field.type] || field.type})</span>
      </div>
      <div class="context-menu-item" data-action="configure-subfields">
        <i class="ph ph-brackets-curly"></i>
        <span>${subfieldLabel}</span>
      </div>
      <div class="context-menu-item" data-action="hide">
        <i class="ph ph-eye-slash"></i>
        <span>Hide field</span>
      </div>
      ${!field.isPrimary ? `
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" data-action="delete">
          <i class="ph ph-trash"></i>
          <span>Delete field</span>
        </div>
      ` : ''}
    `;

    // Calculate position with viewport boundary checking
    const menuWidth = 200; // approximate width based on min-width: 180px + padding
    const menuHeight = field.isPrimary ? 120 : 160; // approximate height
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = e.pageX;
    let top = e.pageY;

    // Prevent menu from going off right edge
    if (left + menuWidth > viewportWidth - 10) {
      left = viewportWidth - menuWidth - 10;
    }
    // Prevent menu from going off left edge
    if (left < 10) {
      left = 10;
    }
    // Prevent menu from going off bottom edge
    if (top + menuHeight > viewportHeight - 10) {
      top = viewportHeight - menuHeight - 10;
    }
    // Prevent menu from going off top edge
    if (top < 10) {
      top = 10;
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.classList.add('active');

    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (clickEvent) => {
        menu.classList.remove('active');
        const action = item.dataset.action;

        switch (action) {
          case 'rename':
            this._showRenameFieldModal(fieldId);
            break;
          case 'change-type':
            this._showFieldTypePicker(clickEvent, (newType, options = {}) => {
              this._changeFieldType(fieldId, newType, options);
            });
            break;
          case 'configure-subfields':
            this._showSubfieldsConfigModal(fieldId);
            break;
          case 'hide':
            this._hideField(fieldId);
            break;
          case 'delete':
            this._deleteField(fieldId);
            break;
        }
      });
    });
  }

  _showSetContextMenu(e, setId) {
    const menu = this.elements.contextMenu;
    if (!menu) return;

    menu.innerHTML = `
      <div class="context-menu-item" data-action="rename">
        <i class="ph ph-pencil"></i>
        <span>Rename</span>
      </div>
      <div class="context-menu-item" data-action="duplicate">
        <i class="ph ph-copy"></i>
        <span>Duplicate</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" data-action="delete">
        <i class="ph ph-trash"></i>
        <span>Delete</span>
      </div>
    `;

    // Calculate position with viewport boundary checking
    const menuWidth = 200;
    const menuHeight = 130;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = e.pageX;
    let top = e.pageY;

    if (left + menuWidth > viewportWidth - 10) {
      left = viewportWidth - menuWidth - 10;
    }
    if (left < 10) left = 10;
    if (top + menuHeight > viewportHeight - 10) {
      top = viewportHeight - menuHeight - 10;
    }
    if (top < 10) top = 10;

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.classList.add('active');

    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        menu.classList.remove('active');
        // Handle set actions
      });
    });
  }

  _showViewContextMenu(e, viewId) {
    const menu = this.elements.contextMenu;
    if (!menu) return;

    menu.innerHTML = `
      <div class="context-menu-item" data-action="rename">
        <i class="ph ph-pencil"></i>
        <span>Rename</span>
      </div>
      <div class="context-menu-item" data-action="duplicate">
        <i class="ph ph-copy"></i>
        <span>Duplicate</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" data-action="delete">
        <i class="ph ph-trash"></i>
        <span>Delete</span>
      </div>
    `;

    // Calculate position with viewport boundary checking
    const viewMenuWidth = 200;
    const viewMenuHeight = 130;
    const vWidth = window.innerWidth;
    const vHeight = window.innerHeight;

    let viewLeft = e.pageX;
    let viewTop = e.pageY;

    if (viewLeft + viewMenuWidth > vWidth - 10) {
      viewLeft = vWidth - viewMenuWidth - 10;
    }
    if (viewLeft < 10) viewLeft = 10;
    if (viewTop + viewMenuHeight > vHeight - 10) {
      viewTop = vHeight - viewMenuHeight - 10;
    }
    if (viewTop < 10) viewTop = 10;

    menu.style.left = viewLeft + 'px';
    menu.style.top = viewTop + 'px';
    menu.classList.add('active');
  }

  // --------------------------------------------------------------------------
  // Field Type Picker
  // --------------------------------------------------------------------------

  _showFieldTypePicker(e, callback = null) {
    const picker = this.elements.fieldTypePicker;
    if (!picker) return;

    const pickerWidth = 240; // matches CSS width
    const viewportWidth = window.innerWidth;

    // Try to get position from th/button, or fall back to event coordinates
    const targetElement = e.target.closest('th, button, .context-menu-item');
    let left, top;

    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      left = rect.left;
      top = rect.bottom + 4;
    } else {
      // Fallback to event coordinates
      left = e.pageX || e.clientX || 100;
      top = e.pageY || e.clientY || 100;
    }

    // Calculate left position, ensuring picker doesn't go off the right edge
    if (left + pickerWidth > viewportWidth - 10) {
      left = viewportWidth - pickerWidth - 10;
    }
    // Ensure it doesn't go off the left edge either
    if (left < 10) {
      left = 10;
    }

    picker.style.left = left + 'px';
    picker.style.top = top + 'px';
    picker.classList.add('active');

    picker.querySelectorAll('.field-type-item').forEach(item => {
      item.addEventListener('click', () => {
        picker.classList.remove('active');
        const type = item.dataset.type;

        // For LINK type, show a modal to select the target set
        if (type === FieldTypes.LINK) {
          this._showLinkedSetSelectionModal(({ linkedSetId, allowMultiple }) => {
            if (callback) {
              // When changing type, pass the options through callback
              callback(type, { linkedSetId, allowMultiple });
            } else {
              // When adding new field, create with options
              const field = this._addField(type, 'Link');
              if (field) {
                field.options.linkedSetId = linkedSetId;
                field.options.allowMultiple = allowMultiple;
                this._saveData();
                this._renderView();
              }
            }
          });
        } else {
          if (callback) {
            callback(type);
          } else {
            this._addField(type);
          }
        }
      }, { once: true });
    });
  }

  _hideField(fieldId) {
    const view = this.getCurrentView();
    if (!view) return;

    if (!view.config.hiddenFields) {
      view.config.hiddenFields = [];
    }
    view.config.hiddenFields.push(fieldId);

    this._saveData();
    this._renderView();
  }

  // --------------------------------------------------------------------------
  // Modals
  // --------------------------------------------------------------------------

  _showModal(title, content, onConfirm) {
    const overlay = this.elements.modal;
    const modal = overlay?.querySelector('.modal');
    if (!overlay || !modal) return;

    modal.querySelector('.modal-title').textContent = title;
    modal.querySelector('.modal-body').innerHTML = content;

    overlay.classList.add('active');

    const confirmBtn = document.getElementById('modal-confirm');
    confirmBtn.onclick = () => {
      if (onConfirm) onConfirm();
      this._closeModal();
    };
  }

  _closeModal() {
    this.elements.modal?.classList.remove('active');
  }

  _showNewSetModal() {
    this._showModal('Create New Set', `
      <div class="form-group">
        <label class="form-label">Set Name</label>
        <input type="text" class="form-input" id="new-set-name" placeholder="My Data" autofocus>
      </div>
    `, () => {
      const name = document.getElementById('new-set-name')?.value || 'Untitled Set';
      const set = createSet(name);
      this.sets.push(set);
      this.currentSetId = set.id;
      this.currentViewId = set.views[0]?.id;

      this._saveData();
      this._renderSidebar();
      this._renderView();
      this._updateBreadcrumb();
    });

    // Focus input
    setTimeout(() => {
      document.getElementById('new-set-name')?.focus();
    }, 100);
  }

  _showNewViewModal() {
    this._showModal('Create New Lens', `
      <div class="form-group">
        <label class="form-label">Lens Name</label>
        <input type="text" class="form-input" id="new-view-name" placeholder="My View">
      </div>
      <div class="form-group">
        <label class="form-label">Lens Type</label>
        <select class="form-select" id="new-view-type">
          <option value="table">Grid (Table)</option>
          <option value="cards">Cards</option>
          <option value="kanban">Kanban</option>
          <option value="calendar">Calendar</option>
          <option value="graph">Graph</option>
          <option value="timeline">Timeline</option>
        </select>
      </div>
      <div class="compliance-note">
        <i class="ph ph-info"></i>
        <span>Lenses are MEANT events - interpretations of how to visualize data (Rule 1)</span>
      </div>
    `, () => {
      const name = document.getElementById('new-view-name')?.value || 'New View';
      const type = document.getElementById('new-view-type')?.value || 'table';

      const set = this.getCurrentSet();
      if (!set) return;

      // Create in legacy format
      const view = createView(name, type);
      set.views.push(view);
      this.currentViewId = view.id;

      // Also create in registry
      try {
        this.viewRegistry?.createLens?.({
          id: view.id,
          name: name,
          lensType: this._mapViewTypeToLensType(type),
          config: view.config || {}
        }, set.id);
      } catch (e) {
        console.warn('Failed to create lens in registry:', e);
      }

      this._saveData();
      this._renderViewsNav();
      this._renderView();
      this._updateBreadcrumb();
    });
  }

  /**
   * Show modal to create a new workspace
   */
  _showNewWorkspaceModal() {
    this._showModal('Create New Workspace', `
      <div class="form-group">
        <label class="form-label">Workspace Name</label>
        <input type="text" class="form-input" id="new-workspace-name" placeholder="My Workspace" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-input" id="new-workspace-desc" rows="2" placeholder="Optional description..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Icon</label>
        <select class="form-select" id="new-workspace-icon">
          <option value="ph-folder-simple">Folder</option>
          <option value="ph-briefcase">Briefcase</option>
          <option value="ph-buildings">Buildings</option>
          <option value="ph-users">Team</option>
          <option value="ph-rocket">Project</option>
          <option value="ph-lightbulb">Ideas</option>
        </select>
      </div>
      <div class="compliance-note">
        <i class="ph ph-shield-check"></i>
        <span>Workspaces define horizon boundaries (Rule 4: Perspectivality)</span>
      </div>
    `, () => {
      const name = document.getElementById('new-workspace-name')?.value || 'Untitled Workspace';
      const desc = document.getElementById('new-workspace-desc')?.value || '';
      const icon = document.getElementById('new-workspace-icon')?.value || 'ph-folder-simple';

      try {
        const workspace = this.viewRegistry?.createWorkspace?.({
          name,
          description: desc,
          icon,
          horizon: { timeRange: null, actors: [], entityTypes: [] }
        }, ['user_action']);

        if (workspace) {
          this.currentWorkspaceId = workspace.id;
          this._renderSidebar();
          this._updateBreadcrumb();
          this._saveData();
        }
      } catch (e) {
        alert('Failed to create workspace: ' + e.message);
      }
    });

    setTimeout(() => {
      document.getElementById('new-workspace-name')?.focus();
    }, 100);
  }

  /**
   * Show modal to create a new focus (filtered view)
   * Rule 5: Focus can only RESTRICT, never expand
   */
  _showNewFocusModal() {
    const set = this.getCurrentSet();
    if (!set) return;

    const fields = set.fields || [];

    this._showModal('Create Focus (Filtered View)', `
      <div class="form-group">
        <label class="form-label">Focus Name</label>
        <input type="text" class="form-input" id="new-focus-name" placeholder="e.g., My Tasks This Week" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Filter By</label>
        <select class="form-select" id="focus-filter-field">
          <option value="">Select field...</option>
          ${fields.map(f => `<option value="${f.id}">${this._escapeHtml(f.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Operator</label>
        <select class="form-select" id="focus-filter-op">
          <option value="equals">Equals</option>
          <option value="not_equals">Not Equals</option>
          <option value="contains">Contains</option>
          <option value="is_empty">Is Empty</option>
          <option value="is_not_empty">Is Not Empty</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Value</label>
        <input type="text" class="form-input" id="focus-filter-value" placeholder="Filter value...">
      </div>
      <div class="compliance-note warning">
        <i class="ph ph-warning"></i>
        <span><strong>Rule 5:</strong> Focuses can only RESTRICT what's visible, never expand beyond the parent lens.</span>
      </div>
    `, () => {
      const name = document.getElementById('new-focus-name')?.value || 'Filtered View';
      const fieldId = document.getElementById('focus-filter-field')?.value;
      const operator = document.getElementById('focus-filter-op')?.value || 'equals';
      const value = document.getElementById('focus-filter-value')?.value;

      if (!fieldId) {
        alert('Please select a field to filter by');
        return;
      }

      try {
        const focus = this.viewRegistry?.createFocus?.({
          name,
          restrictions: {
            filters: [{
              fieldId,
              operator,
              value
            }]
          },
          provenance: { filterReason: 'user_created_focus' }
        }, this.currentLensId || this.currentViewId);

        if (focus) {
          this.currentFocusId = focus.id;
          this._renderFocusesNav();
          this._renderView();
          this._updateBreadcrumb();
          this._saveData();
        }
      } catch (e) {
        alert('Failed to create focus: ' + e.message);
      }
    });

    setTimeout(() => {
      document.getElementById('new-focus-name')?.focus();
    }, 100);
  }

  /**
   * Show modal to create a snapshot
   * Rule 9: Snapshots are immutable captures that can be superseded
   */
  _showNewSnapshotModal() {
    this._showModal('Create Snapshot', `
      <div class="form-group">
        <label class="form-label">Snapshot Name</label>
        <input type="text" class="form-input" id="new-snapshot-name"
               placeholder="e.g., Q1 Review - ${new Date().toLocaleDateString()}" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Purpose</label>
        <select class="form-select" id="snapshot-purpose">
          <option value="review">Review/Audit</option>
          <option value="backup">Backup</option>
          <option value="milestone">Milestone</option>
          <option value="comparison">Comparison Point</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-input" id="snapshot-notes" rows="2" placeholder="Optional notes about this snapshot..."></textarea>
      </div>
      <div class="compliance-note">
        <i class="ph ph-camera"></i>
        <span><strong>Rule 9:</strong> Snapshots are immutable. They capture the current state and can be superseded but never modified.</span>
      </div>
    `, () => {
      const name = document.getElementById('new-snapshot-name')?.value ||
                   `Snapshot ${new Date().toLocaleDateString()}`;
      const purpose = document.getElementById('snapshot-purpose')?.value || 'review';
      const notes = document.getElementById('snapshot-notes')?.value || '';

      try {
        const sourceViewId = this.currentFocusId || this.currentLensId || this.currentViewId;
        const snapshot = this.viewRegistry?.createSnapshot?.({
          name,
          annotations: { purpose, notes }
        }, sourceViewId, 'current_user');

        if (snapshot) {
          this._showNotification(`Snapshot "${name}" created successfully`);
          alert(`Snapshot created!\n\nID: ${snapshot.id}\nCaptured at: ${snapshot.capturedAt}`);
        }
      } catch (e) {
        alert('Failed to create snapshot: ' + e.message);
      }
    });

    setTimeout(() => {
      document.getElementById('new-snapshot-name')?.focus();
    }, 100);
  }

  /**
   * Show workspace context menu
   */
  _showWorkspaceContextMenu(e, workspaceId) {
    const menu = this.elements.contextMenu;
    if (!menu) return;

    menu.innerHTML = `
      <div class="context-menu-item" data-action="rename">
        <i class="ph ph-pencil"></i>
        <span>Rename</span>
      </div>
      <div class="context-menu-item" data-action="snapshot">
        <i class="ph ph-camera"></i>
        <span>Create Snapshot</span>
      </div>
      <div class="context-menu-item" data-action="lineage">
        <i class="ph ph-tree-structure"></i>
        <span>View Lineage (Rule 7)</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" data-action="supersede">
        <i class="ph ph-arrows-clockwise"></i>
        <span>Supersede (Rule 9)</span>
      </div>
    `;

    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    menu.classList.add('active');

    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        menu.classList.remove('active');
        const action = item.dataset.action;

        switch (action) {
          case 'snapshot':
            this._showNewSnapshotModal();
            break;
          case 'lineage':
            this._showViewLineage(workspaceId);
            break;
          case 'supersede':
            this._showSupersedeModal(workspaceId);
            break;
        }
      });
    });
  }

  /**
   * Show view lineage (Rule 7: Traceability)
   */
  _showViewLineage(viewId) {
    const lineage = this.viewRegistry?.getViewLineage?.(viewId) || [];

    if (lineage.length === 0) {
      alert('No lineage information available');
      return;
    }

    const lineageHtml = lineage.map((item, index) => `
      ${index > 0 ? '<div class="lineage-arrow"><i class="ph ph-arrow-down"></i></div>' : ''}
      <div class="lineage-item ${index === 0 ? 'current' : ''}">
        <div class="lineage-type">${item.viewType.toUpperCase()}</div>
        <div class="lineage-name">${this._escapeHtml(item.name)}</div>
        <div class="lineage-id">${item.id}</div>
      </div>
    `).join('');

    this._showModal('View Lineage (Rule 7: Groundedness)', `
      <div class="lineage-chain">
        ${lineageHtml}
      </div>
      <div class="compliance-note">
        <i class="ph ph-link"></i>
        <span>All interpretations must trace back to Given events (raw experience)</span>
      </div>
    `, null);

    // Hide confirm button for info-only modal
    document.getElementById('modal-confirm').style.display = 'none';
    document.getElementById('modal-cancel').textContent = 'Close';
  }

  /**
   * Show supersede modal (Rule 9: Defeasibility)
   */
  _showSupersedeModal(viewId) {
    const view = this.viewRegistry?.workspaces?.get(viewId) ||
                 this.viewRegistry?.sets?.get(viewId) ||
                 this.viewRegistry?.lenses?.get(viewId);

    if (!view) return;

    this._showModal('Supersede View (Rule 9)', `
      <div class="form-group">
        <label class="form-label">Current: ${this._escapeHtml(view.name)}</label>
        <input type="text" class="form-input" id="supersede-new-name"
               value="${this._escapeHtml(view.name)} (Updated)" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Reason for Supersession</label>
        <textarea class="form-input" id="supersede-reason" rows="2"
                  placeholder="Why is this being superseded?"></textarea>
      </div>
      <div class="compliance-note warning">
        <i class="ph ph-warning"></i>
        <span><strong>Rule 9:</strong> The original view will be marked as superseded but NOT deleted. Views are never erased, only replaced.</span>
      </div>
    `, () => {
      const newName = document.getElementById('supersede-new-name')?.value;
      const reason = document.getElementById('supersede-reason')?.value;

      if (!newName) return;

      try {
        const newView = this.viewRegistry?.supersedeView?.(viewId, {
          ...view.toJSON?.() || view,
          name: newName
        }, reason);

        if (newView) {
          this._showNotification(`View superseded. New ID: ${newView.id}`);
          this._renderSidebar();
        }
      } catch (e) {
        alert('Failed to supersede: ' + e.message);
      }
    });
  }

  _showRenameFieldModal(fieldId) {
    const set = this.getCurrentSet();
    const field = set?.fields.find(f => f.id === fieldId);
    if (!field) return;

    this._showModal('Rename Field', `
      <div class="form-group">
        <label class="form-label">Field Name</label>
        <input type="text" class="form-input" id="rename-field-input" value="${this._escapeHtml(field.name)}">
      </div>
    `, () => {
      const newName = document.getElementById('rename-field-input')?.value;
      if (newName) {
        this._renameField(fieldId, newName);
      }
    });

    setTimeout(() => {
      const input = document.getElementById('rename-field-input');
      input?.focus();
      input?.select();
    }, 100);
  }

  /**
   * Show modal to configure subfields for a field (column-level configuration)
   */
  _showSubfieldsConfigModal(fieldId) {
    const set = this.getCurrentSet();
    const field = set?.fields.find(f => f.id === fieldId);
    if (!field) return;

    const existingConfig = field.options?.subfields || { mode: 'custom', schema: [], display: 'compact' };
    const schemaRows = existingConfig.schema || [];

    // Build schema rows HTML
    const buildSchemaRowsHtml = (rows) => {
      if (rows.length === 0) {
        return '<div class="subfields-schema-empty">No subfields defined. Add one below or paste JSON to detect.</div>';
      }
      return rows.map((sf, idx) => `
        <div class="subfields-schema-row" data-index="${idx}">
          <input type="text" class="form-input subfield-key" placeholder="Key" value="${this._escapeHtml(sf.key || '')}">
          <select class="form-select subfield-type">
            <option value="text" ${sf.type === 'text' ? 'selected' : ''}>Text</option>
            <option value="number" ${sf.type === 'number' ? 'selected' : ''}>Number</option>
            <option value="boolean" ${sf.type === 'boolean' ? 'selected' : ''}>Boolean</option>
            <option value="date" ${sf.type === 'date' ? 'selected' : ''}>Date</option>
            <option value="email" ${sf.type === 'email' ? 'selected' : ''}>Email</option>
            <option value="url" ${sf.type === 'url' ? 'selected' : ''}>URL</option>
          </select>
          <label class="subfield-required-label">
            <input type="checkbox" class="subfield-required" ${sf.required ? 'checked' : ''}>
            Req
          </label>
          <button type="button" class="btn btn-icon subfield-remove" title="Remove">
            <i class="ph ph-x"></i>
          </button>
        </div>
      `).join('');
    };

    const html = `
      <div class="subfields-config-modal">
        <div class="form-group">
          <label class="form-label">Subfield Mode</label>
          <div class="subfields-mode-toggle">
            <label class="radio-label">
              <input type="radio" name="subfields-mode" value="custom" ${existingConfig.mode === 'custom' ? 'checked' : ''}>
              <span>Custom</span>
              <small>Each cell can have its own unique subfields</small>
            </label>
            <label class="radio-label">
              <input type="radio" name="subfields-mode" value="standard" ${existingConfig.mode === 'standard' ? 'checked' : ''}>
              <span>Standard</span>
              <small>Same subfields for all rows (schema-defined)</small>
            </label>
          </div>
        </div>

        <div class="form-group subfields-schema-section" style="${existingConfig.mode === 'custom' ? 'display:none' : ''}">
          <label class="form-label">Schema Definition</label>
          <div class="subfields-schema-list" id="subfields-schema-list">
            ${buildSchemaRowsHtml(schemaRows)}
          </div>
          <button type="button" class="btn btn-secondary" id="add-subfield-btn">
            <i class="ph ph-plus"></i> Add Subfield
          </button>
        </div>

        <div class="form-group">
          <label class="form-label">Display Mode</label>
          <select class="form-select" id="subfields-display">
            <option value="compact" ${existingConfig.display === 'compact' ? 'selected' : ''}>Compact (indicator only)</option>
            <option value="inline" ${existingConfig.display === 'inline' ? 'selected' : ''}>Inline (show key subfields)</option>
            <option value="expanded" ${existingConfig.display === 'expanded' ? 'selected' : ''}>Expanded (show all in cell)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Detect from JSON (paste sample)</label>
          <textarea class="form-input subfields-json-detect" id="subfields-json-detect" rows="3" placeholder='{"key1": "value", "key2": 123}'></textarea>
          <button type="button" class="btn btn-secondary" id="detect-schema-btn">
            <i class="ph ph-magnifying-glass"></i> Detect Schema
          </button>
        </div>

        ${existingConfig.mode !== 'custom' || schemaRows.length > 0 ? `
          <div class="form-group">
            <button type="button" class="btn btn-danger" id="remove-subfields-btn">
              <i class="ph ph-trash"></i> Remove All Subfields
            </button>
          </div>
        ` : ''}
      </div>
    `;

    this._showModal(`Configure Subfields: ${field.name}`, html, () => {
      // Collect configuration
      const mode = document.querySelector('input[name="subfields-mode"]:checked')?.value || 'custom';
      const display = document.getElementById('subfields-display')?.value || 'compact';

      // Collect schema from rows
      const schema = [];
      document.querySelectorAll('.subfields-schema-row').forEach(row => {
        const key = row.querySelector('.subfield-key')?.value?.trim();
        const type = row.querySelector('.subfield-type')?.value || 'text';
        const required = row.querySelector('.subfield-required')?.checked || false;
        if (key) {
          schema.push({ key, type, required });
        }
      });

      // Update field options
      if (!field.options) field.options = {};
      field.options.subfields = { mode, schema, display };

      this._saveData();
      this._renderView();
      this._showToast('Subfields configured', 'success');
    });

    // Attach event handlers after modal is shown
    setTimeout(() => {
      // Mode toggle - show/hide schema section
      document.querySelectorAll('input[name="subfields-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          const schemaSection = document.querySelector('.subfields-schema-section');
          if (schemaSection) {
            schemaSection.style.display = e.target.value === 'standard' ? '' : 'none';
          }
        });
      });

      // Add subfield button
      document.getElementById('add-subfield-btn')?.addEventListener('click', () => {
        const list = document.getElementById('subfields-schema-list');
        const emptyMsg = list.querySelector('.subfields-schema-empty');
        if (emptyMsg) emptyMsg.remove();

        const idx = list.querySelectorAll('.subfields-schema-row').length;
        const newRow = document.createElement('div');
        newRow.className = 'subfields-schema-row';
        newRow.dataset.index = idx;
        newRow.innerHTML = `
          <input type="text" class="form-input subfield-key" placeholder="Key" value="">
          <select class="form-select subfield-type">
            <option value="text" selected>Text</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="date">Date</option>
            <option value="email">Email</option>
            <option value="url">URL</option>
          </select>
          <label class="subfield-required-label">
            <input type="checkbox" class="subfield-required">
            Req
          </label>
          <button type="button" class="btn btn-icon subfield-remove" title="Remove">
            <i class="ph ph-x"></i>
          </button>
        `;
        list.appendChild(newRow);
        newRow.querySelector('.subfield-key')?.focus();

        // Attach remove handler
        newRow.querySelector('.subfield-remove')?.addEventListener('click', () => {
          newRow.remove();
        });
      });

      // Attach remove handlers to existing rows
      document.querySelectorAll('.subfield-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          btn.closest('.subfields-schema-row')?.remove();
        });
      });

      // Detect schema from JSON
      document.getElementById('detect-schema-btn')?.addEventListener('click', () => {
        const jsonInput = document.getElementById('subfields-json-detect')?.value?.trim();
        if (!jsonInput) {
          this._showToast('Please paste JSON to detect schema', 'warning');
          return;
        }

        try {
          const parsed = JSON.parse(jsonInput);
          const obj = Array.isArray(parsed) ? parsed[0] : parsed;
          if (typeof obj !== 'object' || obj === null) {
            this._showToast('JSON must be an object or array of objects', 'warning');
            return;
          }

          // Infer schema from object keys
          const detectedSchema = Object.entries(obj).map(([key, value]) => {
            let type = 'text';
            if (typeof value === 'number') type = 'number';
            else if (typeof value === 'boolean') type = 'boolean';
            else if (typeof value === 'string') {
              if (/^\d{4}-\d{2}-\d{2}/.test(value)) type = 'date';
              else if (/^https?:\/\//.test(value)) type = 'url';
              else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) type = 'email';
            }
            return { key, type, required: false };
          });

          // Update the schema list
          const list = document.getElementById('subfields-schema-list');
          list.innerHTML = detectedSchema.map((sf, idx) => `
            <div class="subfields-schema-row" data-index="${idx}">
              <input type="text" class="form-input subfield-key" placeholder="Key" value="${this._escapeHtml(sf.key)}">
              <select class="form-select subfield-type">
                <option value="text" ${sf.type === 'text' ? 'selected' : ''}>Text</option>
                <option value="number" ${sf.type === 'number' ? 'selected' : ''}>Number</option>
                <option value="boolean" ${sf.type === 'boolean' ? 'selected' : ''}>Boolean</option>
                <option value="date" ${sf.type === 'date' ? 'selected' : ''}>Date</option>
                <option value="email" ${sf.type === 'email' ? 'selected' : ''}>Email</option>
                <option value="url" ${sf.type === 'url' ? 'selected' : ''}>URL</option>
              </select>
              <label class="subfield-required-label">
                <input type="checkbox" class="subfield-required">
                Req
              </label>
              <button type="button" class="btn btn-icon subfield-remove" title="Remove">
                <i class="ph ph-x"></i>
              </button>
            </div>
          `).join('');

          // Reattach remove handlers
          document.querySelectorAll('.subfield-remove').forEach(btn => {
            btn.addEventListener('click', () => {
              btn.closest('.subfields-schema-row')?.remove();
            });
          });

          // Switch to standard mode
          document.querySelector('input[name="subfields-mode"][value="standard"]').checked = true;
          document.querySelector('.subfields-schema-section').style.display = '';

          this._showToast(`Detected ${detectedSchema.length} subfields`, 'success');
        } catch (e) {
          this._showToast('Invalid JSON: ' + e.message, 'error');
        }
      });

      // Remove all subfields button
      document.getElementById('remove-subfields-btn')?.addEventListener('click', () => {
        if (confirm('Remove all subfield configuration from this field?')) {
          delete field.options.subfields;
          this._saveData();
          this._closeModal();
          this._renderView();
          this._showToast('Subfields removed', 'success');
        }
      });
    }, 100);
  }

  /**
   * Show modal to edit subfields for a specific cell value
   */
  _showSubfieldsEditModal(recordId, fieldId, currentValue) {
    const set = this.getCurrentSet();
    const field = set?.fields.find(f => f.id === fieldId);
    const record = set?.records.find(r => r.id === recordId);
    if (!field || !record) return;

    const subfieldsConfig = field.options?.subfields;
    if (!subfieldsConfig) return;

    // Parse current value - can be { value, params } or just a primitive
    let mainValue = currentValue;
    let params = {};
    if (currentValue && typeof currentValue === 'object' && 'value' in currentValue) {
      mainValue = currentValue.value;
      params = currentValue.params || {};
    }

    const isStandard = subfieldsConfig.mode === 'standard';
    const schema = subfieldsConfig.schema || [];

    // Build params editor HTML
    let paramsHtml = '';
    if (isStandard && schema.length > 0) {
      // Standard mode: show form based on schema
      paramsHtml = schema.map(sf => {
        const val = params[sf.key] ?? '';
        const reqLabel = sf.required ? ' <span class="required">*</span>' : '';
        let inputHtml = '';

        switch (sf.type) {
          case 'boolean':
            inputHtml = `<input type="checkbox" class="subfield-value-input" data-key="${sf.key}" ${val ? 'checked' : ''}>`;
            break;
          case 'number':
            inputHtml = `<input type="number" class="form-input subfield-value-input" data-key="${sf.key}" value="${this._escapeHtml(String(val))}">`;
            break;
          case 'date':
            inputHtml = `<input type="date" class="form-input subfield-value-input" data-key="${sf.key}" value="${this._escapeHtml(String(val))}">`;
            break;
          case 'email':
            inputHtml = `<input type="email" class="form-input subfield-value-input" data-key="${sf.key}" value="${this._escapeHtml(String(val))}">`;
            break;
          case 'url':
            inputHtml = `<input type="url" class="form-input subfield-value-input" data-key="${sf.key}" value="${this._escapeHtml(String(val))}" placeholder="https://...">`;
            break;
          default:
            inputHtml = `<input type="text" class="form-input subfield-value-input" data-key="${sf.key}" value="${this._escapeHtml(String(val))}">`;
        }

        return `
          <div class="subfield-edit-row">
            <label class="subfield-edit-label">${this._escapeHtml(sf.key)}${reqLabel}</label>
            ${inputHtml}
          </div>
        `;
      }).join('');
    } else {
      // Custom mode: show existing params + ability to add new
      const existingParams = Object.entries(params);
      paramsHtml = `
        <div id="custom-params-list">
          ${existingParams.map(([key, val]) => `
            <div class="subfield-edit-row custom-param-row">
              <input type="text" class="form-input param-key" value="${this._escapeHtml(key)}" placeholder="Key">
              <input type="text" class="form-input param-value" value="${this._escapeHtml(String(val))}" placeholder="Value">
              <button type="button" class="btn btn-icon param-remove" title="Remove">
                <i class="ph ph-x"></i>
              </button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn btn-secondary" id="add-custom-param-btn">
          <i class="ph ph-plus"></i> Add Parameter
        </button>
      `;
    }

    const html = `
      <div class="subfields-edit-modal">
        <div class="form-group">
          <label class="form-label">Main Value</label>
          <input type="text" class="form-input" id="subfield-main-value" value="${this._escapeHtml(String(mainValue ?? ''))}">
        </div>

        <div class="form-group">
          <label class="form-label">Parameters ${isStandard ? '(Standard Schema)' : '(Custom)'}</label>
          <div class="subfields-params-editor">
            ${paramsHtml}
          </div>
        </div>

        <div class="form-group subfields-json-paste-section">
          <label class="form-label">Or paste JSON</label>
          <textarea class="form-input" id="subfield-json-paste" rows="3" placeholder='{"param1": "value1", "param2": 123}'></textarea>
          <button type="button" class="btn btn-secondary" id="parse-json-params-btn">
            <i class="ph ph-code"></i> Parse JSON
          </button>
        </div>
      </div>
    `;

    this._showModal(`Edit: ${field.name}`, html, () => {
      const newMainValue = document.getElementById('subfield-main-value')?.value;
      const newParams = {};

      if (isStandard) {
        // Collect from standard schema inputs
        document.querySelectorAll('.subfield-value-input').forEach(input => {
          const key = input.dataset.key;
          let val;
          if (input.type === 'checkbox') {
            val = input.checked;
          } else if (input.type === 'number') {
            val = input.value ? parseFloat(input.value) : null;
          } else {
            val = input.value || null;
          }
          if (val !== null && val !== '') {
            newParams[key] = val;
          }
        });
      } else {
        // Collect from custom param rows
        document.querySelectorAll('.custom-param-row').forEach(row => {
          const key = row.querySelector('.param-key')?.value?.trim();
          const val = row.querySelector('.param-value')?.value;
          if (key) {
            // Try to parse as number or boolean
            let parsedVal = val;
            if (val === 'true') parsedVal = true;
            else if (val === 'false') parsedVal = false;
            else if (/^-?\d+\.?\d*$/.test(val)) parsedVal = parseFloat(val);
            newParams[key] = parsedVal;
          }
        });
      }

      // Build the new value structure
      const hasParams = Object.keys(newParams).length > 0;
      const newValue = hasParams
        ? { value: newMainValue, params: newParams }
        : newMainValue;

      this._updateRecordValue(recordId, fieldId, newValue);

      // Update cell display
      const cell = document.querySelector(`tr[data-record-id="${recordId}"] td[data-field-id="${fieldId}"]`);
      if (cell) {
        cell.innerHTML = this._renderCellContent(field, newValue);
      }

      this._showToast('Value updated', 'success');
    });

    // Attach event handlers
    setTimeout(() => {
      // Custom mode: add parameter button
      document.getElementById('add-custom-param-btn')?.addEventListener('click', () => {
        const list = document.getElementById('custom-params-list');
        const newRow = document.createElement('div');
        newRow.className = 'subfield-edit-row custom-param-row';
        newRow.innerHTML = `
          <input type="text" class="form-input param-key" placeholder="Key">
          <input type="text" class="form-input param-value" placeholder="Value">
          <button type="button" class="btn btn-icon param-remove" title="Remove">
            <i class="ph ph-x"></i>
          </button>
        `;
        list.appendChild(newRow);
        newRow.querySelector('.param-key')?.focus();

        newRow.querySelector('.param-remove')?.addEventListener('click', () => {
          newRow.remove();
        });
      });

      // Remove handlers for existing rows
      document.querySelectorAll('.param-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          btn.closest('.custom-param-row')?.remove();
        });
      });

      // Parse JSON button
      document.getElementById('parse-json-params-btn')?.addEventListener('click', () => {
        const jsonInput = document.getElementById('subfield-json-paste')?.value?.trim();
        if (!jsonInput) {
          this._showToast('Please paste JSON to parse', 'warning');
          return;
        }

        try {
          const parsed = JSON.parse(jsonInput);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            this._showToast('JSON must be an object', 'warning');
            return;
          }

          if (isStandard) {
            // Fill in standard schema inputs
            Object.entries(parsed).forEach(([key, val]) => {
              const input = document.querySelector(`.subfield-value-input[data-key="${key}"]`);
              if (input) {
                if (input.type === 'checkbox') {
                  input.checked = Boolean(val);
                } else {
                  input.value = String(val);
                }
              }
            });
          } else {
            // Add as custom params
            const list = document.getElementById('custom-params-list');
            Object.entries(parsed).forEach(([key, val]) => {
              const newRow = document.createElement('div');
              newRow.className = 'subfield-edit-row custom-param-row';
              newRow.innerHTML = `
                <input type="text" class="form-input param-key" value="${this._escapeHtml(key)}" placeholder="Key">
                <input type="text" class="form-input param-value" value="${this._escapeHtml(String(val))}" placeholder="Value">
                <button type="button" class="btn btn-icon param-remove" title="Remove">
                  <i class="ph ph-x"></i>
                </button>
              `;
              list.appendChild(newRow);

              newRow.querySelector('.param-remove')?.addEventListener('click', () => {
                newRow.remove();
              });
            });
          }

          this._showToast('JSON parsed', 'success');
          document.getElementById('subfield-json-paste').value = '';
        } catch (e) {
          this._showToast('Invalid JSON: ' + e.message, 'error');
        }
      });
    }, 100);
  }

  /**
   * Show modal to select which set to link to when creating/changing to a LINK field
   * @param {Function} callback - Called with { linkedSetId, allowMultiple } when confirmed
   * @param {Object} existingOptions - Optional existing options to pre-populate
   */
  _showLinkedSetSelectionModal(callback, existingOptions = {}) {
    const currentSet = this.getCurrentSet();

    // Get all sets except the current one (can't link to self in most cases, but we'll allow it)
    const availableSets = this.sets || [];

    if (availableSets.length === 0) {
      alert('No sets available to link to. Please create at least one set first.');
      return;
    }

    const setOptions = availableSets.map(s => {
      const selected = existingOptions.linkedSetId === s.id ? 'selected' : '';
      const isCurrent = s.id === currentSet?.id ? ' (current set)' : '';
      return `<option value="${s.id}" ${selected}>${this._escapeHtml(s.name)}${isCurrent}</option>`;
    }).join('');

    const allowMultipleChecked = existingOptions.allowMultiple ? 'checked' : '';

    this._showModal('Link to Records', `
      <div class="form-group">
        <label class="form-label">Link to which set?</label>
        <select class="form-select" id="linked-set-select">
          <option value="">Select a set...</option>
          ${setOptions}
        </select>
        <div class="form-hint" style="margin-top: 6px; font-size: 11px; color: var(--text-tertiary);">
          Choose the set containing records you want to link to
        </div>
      </div>
      <div class="form-group">
        <label class="form-checkbox" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="allow-multiple-check" ${allowMultipleChecked}>
          <span>Allow linking to multiple records</span>
        </label>
        <div class="form-hint" style="margin-top: 6px; font-size: 11px; color: var(--text-tertiary);">
          When enabled, each cell can link to multiple records from the selected set
        </div>
      </div>
    `, () => {
      const linkedSetId = document.getElementById('linked-set-select')?.value;
      const allowMultiple = document.getElementById('allow-multiple-check')?.checked || false;

      if (!linkedSetId) {
        alert('Please select a set to link to');
        return;
      }

      if (callback) {
        callback({ linkedSetId, allowMultiple });
      }
    });

    setTimeout(() => {
      document.getElementById('linked-set-select')?.focus();
    }, 100);
  }

  // --------------------------------------------------------------------------
  // Detail Panel
  // --------------------------------------------------------------------------

  _showRecordDetail(recordId) {
    const set = this.getCurrentSet();
    const record = set?.records.find(r => r.id === recordId);
    if (!record) return;

    const panel = this.elements.detailPanel;
    const body = document.getElementById('detail-panel-body');
    if (!panel || !body) return;

    this.currentDetailRecordId = recordId;

    const fields = set.fields;
    const primaryField = fields.find(f => f.isPrimary) || fields[0];
    const title = record.values[primaryField?.id] || 'Untitled';

    body.innerHTML = `
      <div class="detail-record">
        <h2 style="font-size: 18px; margin-bottom: 16px;">
          <i class="ph ph-note" style="color: var(--primary-500);"></i>
          ${this._escapeHtml(title)}
        </h2>
        ${fields.map(field => {
          const value = record.values[field.id];
          const isEditable = ![FieldTypes.FORMULA, FieldTypes.ROLLUP, FieldTypes.COUNT, FieldTypes.AUTONUMBER].includes(field.type);
          return `
            <div class="detail-field-group" data-field-id="${field.id}">
              <div class="detail-field-label">
                <i class="ph ${FieldTypeIcons[field.type]}"></i>
                ${this._escapeHtml(field.name)}
              </div>
              <div class="detail-field-value ${isEditable ? 'editable' : ''}"
                   data-field-id="${field.id}"
                   data-record-id="${recordId}"
                   ${isEditable ? 'title="Click to edit"' : ''}>
                ${this._renderDetailFieldValue(field, value)}
              </div>
            </div>
          `;
        }).join('')}
        <div class="detail-actions">
          <button class="detail-action-btn" id="detail-duplicate">
            <i class="ph ph-copy"></i>
            <span>Duplicate</span>
          </button>
          <button class="detail-action-btn danger" id="detail-delete">
            <i class="ph ph-trash"></i>
            <span>Delete</span>
          </button>
        </div>

        ${this._renderProvenanceSection(record, set)}

        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-primary);">
          <div style="font-size: 11px; color: var(--text-muted);">
            <i class="ph ph-clock"></i> Created: ${new Date(record.createdAt).toLocaleString()}<br>
            <i class="ph ph-pencil"></i> Updated: ${new Date(record.updatedAt).toLocaleString()}<br>
            <i class="ph ph-hash"></i> ID: ${record.id}
          </div>
        </div>
      </div>
    `;

    // Add click handlers for editable fields
    body.querySelectorAll('.detail-field-value.editable').forEach(el => {
      el.addEventListener('click', () => {
        this._startDetailFieldEdit(el);
      });
    });

    // Action buttons
    document.getElementById('detail-duplicate')?.addEventListener('click', () => {
      this.duplicateRecord(recordId);
      this._showToast('Record duplicated', 'success');
    });

    document.getElementById('detail-delete')?.addEventListener('click', () => {
      if (confirm('Delete this record?')) {
        this.deleteRecord(recordId);
        panel.classList.remove('open');
        this._showToast('Record deleted', 'success');
      }
    });

    // Provenance field editing
    body.querySelectorAll('.provenance-value.editable').forEach(el => {
      el.addEventListener('click', () => {
        this._startProvenanceEdit(el, recordId, set);
      });
    });

    panel.classList.add('open');
  }

  /**
   * Show edge details in the detail panel
   */
  _showEdgeDetail(edgeData) {
    const panel = this.elements.detailPanel;
    const body = document.getElementById('detail-panel-body');
    if (!panel || !body) return;

    const set = this.getCurrentSet();
    const sourceRecord = set?.records.find(r => r.id === edgeData.source);
    const targetRecord = set?.records.find(r => r.id === edgeData.target);

    const primaryField = set?.fields?.find(f => f.isPrimary) || set?.fields?.[0];
    const sourceName = sourceRecord?.values?.[primaryField?.id] || edgeData.source;
    const targetName = targetRecord?.values?.[primaryField?.id] || edgeData.target;

    this.currentDetailRecordId = null;

    body.innerHTML = `
      <div class="detail-record">
        <h2 style="font-size: 18px; margin-bottom: 16px;">
          <i class="ph ph-arrow-right" style="color: var(--primary-500);"></i>
          Edge Details
        </h2>

        <div class="detail-field-group">
          <div class="detail-field-label">
            <i class="ph ph-link"></i>
            Relationship Type
          </div>
          <div class="detail-field-value">
            ${this._escapeHtml(edgeData.fieldName || 'Link')}
          </div>
        </div>

        <div class="detail-field-group">
          <div class="detail-field-label">
            <i class="ph ph-export"></i>
            Source
          </div>
          <div class="detail-field-value edge-node-link" data-record-id="${edgeData.source}" style="cursor: pointer; color: var(--primary-500);">
            ${this._escapeHtml(sourceName)}
          </div>
        </div>

        <div class="detail-field-group">
          <div class="detail-field-label">
            <i class="ph ph-sign-in"></i>
            Target
          </div>
          <div class="detail-field-value edge-node-link" data-record-id="${edgeData.target}" style="cursor: pointer; color: var(--primary-500);">
            ${this._escapeHtml(targetName)}
          </div>
        </div>

        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-primary);">
          <div style="font-size: 11px; color: var(--text-muted);">
            <i class="ph ph-hash"></i> Edge ID: ${this._escapeHtml(edgeData.id)}
          </div>
        </div>
      </div>
    `;

    // Add click handlers for navigating to source/target records
    body.querySelectorAll('.edge-node-link').forEach(el => {
      el.addEventListener('click', () => {
        const recordId = el.dataset.recordId;
        if (recordId) {
          this._showRecordDetail(recordId);
        }
      });
    });

    panel.classList.add('open');
  }

  /**
   * Start editing a provenance field
   */
  _startProvenanceEdit(el, recordId, set) {
    const provKey = el.dataset.provKey;
    const record = set.records.find(r => r.id === recordId);
    if (!record) return;

    // Get current value
    const currentValue = record.provenance?.[provKey] || '';
    const isRef = currentValue && typeof currentValue === 'object' && '$ref' in currentValue;

    el.classList.add('editing');

    // Create editor with toggle for text vs. reference
    el.innerHTML = `
      <div class="prov-editor" style="display: flex; flex-direction: column; gap: 6px;">
        <div class="prov-editor-tabs" style="display: flex; gap: 4px; margin-bottom: 4px;">
          <button class="prov-tab ${!isRef ? 'active' : ''}" data-mode="text"
                  style="padding: 2px 8px; font-size: 10px; border-radius: 3px; border: 1px solid var(--border-primary); background: ${!isRef ? 'var(--primary-500)' : 'transparent'}; color: ${!isRef ? 'white' : 'var(--text-muted)'}; cursor: pointer;">
            Text
          </button>
          <button class="prov-tab ${isRef ? 'active' : ''}" data-mode="ref"
                  style="padding: 2px 8px; font-size: 10px; border-radius: 3px; border: 1px solid var(--border-primary); background: ${isRef ? 'var(--primary-500)' : 'transparent'}; color: ${isRef ? 'white' : 'var(--text-muted)'}; cursor: pointer;">
            Link Record
          </button>
        </div>
        <input type="text" class="prov-input"
               placeholder="${isRef ? 'Search records...' : 'Enter value...'}"
               value="${isRef ? '' : this._escapeHtml(String(currentValue))}"
               style="padding: 4px 8px; font-size: 12px; border: 1px solid var(--border-primary); border-radius: 4px; width: 100%;">
        <div class="prov-editor-actions" style="display: flex; gap: 4px; justify-content: flex-end;">
          <button class="prov-cancel" style="padding: 2px 8px; font-size: 11px; border-radius: 3px; border: 1px solid var(--border-primary); background: transparent; cursor: pointer;">
            Cancel
          </button>
          <button class="prov-save" style="padding: 2px 8px; font-size: 11px; border-radius: 3px; border: none; background: var(--primary-500); color: white; cursor: pointer;">
            Save
          </button>
        </div>
      </div>
    `;

    const input = el.querySelector('.prov-input');
    let currentMode = isRef ? 'ref' : 'text';

    input.focus();
    input.select();

    // Tab switching
    el.querySelectorAll('.prov-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        currentMode = tab.dataset.mode;
        el.querySelectorAll('.prov-tab').forEach(t => {
          const isActive = t.dataset.mode === currentMode;
          t.style.background = isActive ? 'var(--primary-500)' : 'transparent';
          t.style.color = isActive ? 'white' : 'var(--text-muted)';
          t.classList.toggle('active', isActive);
        });
        input.placeholder = currentMode === 'ref' ? 'Search records...' : 'Enter value...';
        input.value = '';
        input.focus();
      });
    });

    // Save handler
    const saveValue = () => {
      const inputValue = input.value.trim();
      let newValue = null;

      if (inputValue) {
        if (currentMode === 'ref') {
          // Try to find a matching record
          const matchedRecord = this._findRecordBySearch(inputValue);
          if (matchedRecord) {
            newValue = { $ref: matchedRecord.id };
          } else {
            this._showToast('No matching record found', 'error');
            return;
          }
        } else {
          newValue = inputValue;
        }
      }

      // Update record provenance
      if (!record.provenance) {
        record.provenance = {};
      }
      record.provenance[provKey] = newValue;

      record.updatedAt = new Date().toISOString();
      this._saveData();
      this._showRecordDetail(recordId);
      this._renderView();
    };

    // Cancel handler
    const cancelEdit = () => {
      this._showRecordDetail(recordId);
    };

    el.querySelector('.prov-save')?.addEventListener('click', (e) => {
      e.stopPropagation();
      saveValue();
    });

    el.querySelector('.prov-cancel')?.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelEdit();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveValue();
      }
      if (e.key === 'Escape') {
        cancelEdit();
      }
    });
  }

  /**
   * Search for a record by text
   */
  _findRecordBySearch(query) {
    const lowerQuery = query.toLowerCase();

    for (const set of this.sets) {
      for (const record of set.records) {
        // Check primary field
        const primaryField = set.fields.find(f => f.isPrimary) || set.fields[0];
        const primaryValue = record.values[primaryField?.id];
        if (primaryValue && String(primaryValue).toLowerCase().includes(lowerQuery)) {
          return record;
        }

        // Check all text values
        for (const [fieldId, value] of Object.entries(record.values)) {
          if (typeof value === 'string' && value.toLowerCase().includes(lowerQuery)) {
            return record;
          }
        }
      }
    }

    return null;
  }

  _renderDetailFieldValue(field, value) {
    if (value === null || value === undefined || value === '') {
      return '<span class="cell-empty">Empty - click to add</span>';
    }

    switch (field.type) {
      case FieldTypes.CHECKBOX:
        return `<i class="ph ${value ? 'ph-check-square' : 'ph-square'}" style="font-size: 18px; color: ${value ? 'var(--success-500)' : 'var(--text-muted)'}"></i>`;
      case FieldTypes.SELECT:
        const choice = field.options?.choices?.find(c => c.id === value);
        return choice ? `<span class="select-tag color-${choice.color || 'gray'}">${this._escapeHtml(choice.name)}</span>` : this._escapeHtml(String(value));
      case FieldTypes.MULTI_SELECT:
        if (Array.isArray(value)) {
          return value.map(v => {
            const c = field.options?.choices?.find(ch => ch.id === v);
            return c ? `<span class="select-tag color-${c.color || 'gray'}">${this._escapeHtml(c.name)}</span>` : '';
          }).join(' ');
        }
        return '<span class="cell-empty">-</span>';
      case FieldTypes.DATE:
        return this._formatDate(value, field);
      case FieldTypes.URL:
        return `<a href="${this._escapeHtml(value)}" target="_blank" style="color: var(--primary-500);">${this._escapeHtml(value)}</a>`;
      case FieldTypes.EMAIL:
        return `<a href="mailto:${this._escapeHtml(value)}" style="color: var(--primary-500);">${this._escapeHtml(value)}</a>`;
      default:
        if (typeof value === 'object') {
          return `<code style="font-size: 11px;">${this._escapeHtml(JSON.stringify(value, null, 2).substring(0, 100))}...</code>`;
        }
        return this._escapeHtml(String(value));
    }
  }

  _startDetailFieldEdit(el) {
    const fieldId = el.dataset.fieldId;
    const recordId = el.dataset.recordId;

    const set = this.getCurrentSet();
    const record = set?.records.find(r => r.id === recordId);
    const field = set?.fields.find(f => f.id === fieldId);

    if (!record || !field) return;

    const currentValue = record.values[fieldId];

    el.classList.add('editing');

    // Create appropriate editor based on field type
    switch (field.type) {
      case FieldTypes.CHECKBOX:
        // Toggle immediately
        this._updateRecordValue(recordId, fieldId, !currentValue);
        el.classList.remove('editing');
        el.innerHTML = this._renderDetailFieldValue(field, !currentValue);
        this._renderView();
        break;

      case FieldTypes.SELECT:
        el.innerHTML = `
          <select class="detail-editor">
            <option value="">Select...</option>
            ${(field.options?.choices || []).map(c =>
              `<option value="${c.id}" ${c.id === currentValue ? 'selected' : ''}>${this._escapeHtml(c.name)}</option>`
            ).join('')}
          </select>
        `;
        const selectEditor = el.querySelector('select');
        selectEditor.focus();
        selectEditor.addEventListener('change', () => {
          this._updateRecordValue(recordId, fieldId, selectEditor.value || null);
          el.classList.remove('editing');
          el.innerHTML = this._renderDetailFieldValue(field, selectEditor.value || null);
          this._renderView();
        });
        selectEditor.addEventListener('blur', () => {
          el.classList.remove('editing');
          el.innerHTML = this._renderDetailFieldValue(field, record.values[fieldId]);
        });
        break;

      case FieldTypes.DATE:
        this._showDatePickerEditor(el, field, recordId, currentValue);
        break;

      case FieldTypes.LONG_TEXT:
        el.innerHTML = `
          <div class="detail-editor-wrapper">
            <textarea class="detail-editor" rows="4">${this._escapeHtml(currentValue || '')}</textarea>
            <div class="detail-editor-actions">
              <button class="detail-editor-cancel" title="Cancel (Escape)">
                <i class="ph ph-x"></i>
              </button>
              <button class="detail-editor-save" title="Save (Enter)">
                <i class="ph ph-check"></i>
              </button>
            </div>
          </div>
        `;
        const textareaEditor = el.querySelector('textarea');
        textareaEditor.focus();

        const saveTextarea = () => {
          this._updateRecordValue(recordId, fieldId, textareaEditor.value);
          el.classList.remove('editing');
          el.innerHTML = this._renderDetailFieldValue(field, textareaEditor.value);
          this._renderView();
        };

        const cancelTextarea = () => {
          el.classList.remove('editing');
          el.innerHTML = this._renderDetailFieldValue(field, currentValue);
        };

        el.querySelector('.detail-editor-save')?.addEventListener('click', (e) => {
          e.stopPropagation();
          saveTextarea();
        });
        el.querySelector('.detail-editor-cancel')?.addEventListener('click', (e) => {
          e.stopPropagation();
          cancelTextarea();
        });
        textareaEditor.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') cancelTextarea();
        });
        break;

      default:
        el.innerHTML = `
          <div class="detail-editor-wrapper">
            <input type="text" class="detail-editor" value="${this._escapeHtml(currentValue || '')}">
            <div class="detail-editor-actions">
              <button class="detail-editor-cancel" title="Cancel (Escape)">
                <i class="ph ph-x"></i>
              </button>
              <button class="detail-editor-save" title="Save (Enter)">
                <i class="ph ph-check"></i>
              </button>
            </div>
          </div>
        `;
        const inputEditor = el.querySelector('input');
        inputEditor.focus();
        inputEditor.select();

        const saveInput = () => {
          this._updateRecordValue(recordId, fieldId, inputEditor.value);
          el.classList.remove('editing');
          el.innerHTML = this._renderDetailFieldValue(field, inputEditor.value);
          this._renderView();
        };

        const cancelInput = () => {
          el.classList.remove('editing');
          el.innerHTML = this._renderDetailFieldValue(field, currentValue);
        };

        el.querySelector('.detail-editor-save')?.addEventListener('click', (e) => {
          e.stopPropagation();
          saveInput();
        });
        el.querySelector('.detail-editor-cancel')?.addEventListener('click', (e) => {
          e.stopPropagation();
          cancelInput();
        });
        inputEditor.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveInput();
          }
          if (e.key === 'Escape') {
            cancelInput();
          }
        });
    }
  }

  // --------------------------------------------------------------------------
  // Date Picker
  // --------------------------------------------------------------------------

  _showDatePickerEditor(el, field, recordId, currentValue) {
    const includeTime = field.options?.includeTime;
    const currentDate = currentValue ? new Date(currentValue) : new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    el.innerHTML = this._renderDatePicker(currentDate, includeTime);
    el.classList.add('date-picker-open');

    const picker = el.querySelector('.date-picker');
    if (!picker) return;

    // Attach navigation
    picker.querySelector('.dp-prev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._navigateDatePicker(el, field, recordId, -1);
    });

    picker.querySelector('.dp-next')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._navigateDatePicker(el, field, recordId, 1);
    });

    // Attach day click handlers
    picker.querySelectorAll('.dp-day:not(.other-month):not(.empty)').forEach(day => {
      day.addEventListener('click', (e) => {
        e.stopPropagation();
        const selectedDay = parseInt(day.textContent);
        const displayedDate = new Date(picker.dataset.year, picker.dataset.month, selectedDay);

        let value = displayedDate.toISOString().split('T')[0];

        if (includeTime) {
          const timeInput = picker.querySelector('.dp-time-input');
          if (timeInput?.value) {
            value += 'T' + timeInput.value;
          }
        }

        this._updateRecordValue(recordId, field.id, value);
        el.classList.remove('editing', 'date-picker-open');
        el.innerHTML = this._renderDetailFieldValue(field, value);
        this._renderView();
      });
    });

    // Today button
    picker.querySelector('.dp-today')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const today = new Date();
      let value = today.toISOString().split('T')[0];
      if (includeTime) {
        value = today.toISOString().slice(0, 16);
      }
      this._updateRecordValue(recordId, field.id, value);
      el.classList.remove('editing', 'date-picker-open');
      el.innerHTML = this._renderDetailFieldValue(field, value);
      this._renderView();
    });

    // Clear button
    picker.querySelector('.dp-clear')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._updateRecordValue(recordId, field.id, null);
      el.classList.remove('editing', 'date-picker-open');
      el.innerHTML = this._renderDetailFieldValue(field, null);
      this._renderView();
    });

    // Store context for navigation
    picker.dataset.recordId = recordId;
    picker.dataset.fieldId = field.id;
    picker.dataset.year = year;
    picker.dataset.month = month;
  }

  _navigateDatePicker(el, field, recordId, delta) {
    const picker = el.querySelector('.date-picker');
    if (!picker) return;

    let year = parseInt(picker.dataset.year);
    let month = parseInt(picker.dataset.month) + delta;

    if (month < 0) {
      month = 11;
      year--;
    } else if (month > 11) {
      month = 0;
      year++;
    }

    const currentDate = new Date(year, month, 1);
    el.innerHTML = this._renderDatePicker(currentDate, field.options?.includeTime);

    // Reattach event handlers
    this._showDatePickerEditor(el, field, recordId, currentDate.toISOString());
  }

  _renderDatePicker(currentDate, includeTime) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let daysHtml = '';
    // Empty cells
    for (let i = 0; i < startDay; i++) {
      daysHtml += '<div class="dp-day empty"></div>';
    }
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      const isSelected = d === currentDate.getDate() && month === currentDate.getMonth() && year === currentDate.getFullYear();
      daysHtml += `<div class="dp-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}">${d}</div>`;
    }

    return `
      <div class="date-picker" data-year="${year}" data-month="${month}">
        <div class="dp-header">
          <button class="dp-nav dp-prev" type="button"><i class="ph ph-caret-left"></i></button>
          <span class="dp-title">${monthNames[month]} ${year}</span>
          <button class="dp-nav dp-next" type="button"><i class="ph ph-caret-right"></i></button>
        </div>
        <div class="dp-weekdays">
          ${dayNames.map(d => `<div class="dp-weekday">${d}</div>`).join('')}
        </div>
        <div class="dp-days">
          ${daysHtml}
        </div>
        ${includeTime ? `
          <div class="dp-time">
            <label>Time:</label>
            <input type="time" class="dp-time-input" value="${currentDate.toTimeString().slice(0, 5)}">
          </div>
        ` : ''}
        <div class="dp-footer">
          <button class="dp-btn dp-today" type="button">Today</button>
          <button class="dp-btn dp-clear" type="button">Clear</button>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // Filter & Sort Panels
  // --------------------------------------------------------------------------

  _showFilterPanel() {
    // TODO: Implement filter dropdown
    console.log('Show filter panel');
  }

  _showSortPanel() {
    const panel = document.getElementById('sort-panel');
    if (!panel) return;

    const set = this.getCurrentSet();
    const view = this.getCurrentView();
    if (!set) return;

    // Populate the sort rules from current view config
    const container = document.getElementById('sort-rules');
    if (container) {
      container.innerHTML = '';

      // Add existing sorts
      const sorts = view?.config.sorts || [];
      sorts.forEach((sort, index) => {
        this._addSortRule(container, set.fields, sort, index);
      });
    }

    panel.style.display = 'block';

    // Position near the sort button
    const btn = document.getElementById('btn-sort');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      panel.style.top = `${rect.bottom + 4}px`;
      panel.style.right = `${window.innerWidth - rect.right}px`;
    }
  }

  _addSortRule(container, fields, sort = null, index = -1) {
    const ruleId = index >= 0 ? index : container.children.length;
    const sortableFields = fields.filter(f =>
      ![FieldTypes.FORMULA, FieldTypes.ROLLUP, FieldTypes.MULTI_SELECT].includes(f.type)
    );

    const rule = document.createElement('div');
    rule.className = 'sort-rule';
    rule.dataset.ruleIndex = ruleId;
    rule.innerHTML = `
      <select class="sort-field-select">
        <option value="">Select field...</option>
        ${sortableFields.map(f => `
          <option value="${f.id}" ${sort?.fieldId === f.id ? 'selected' : ''}>
            ${this._escapeHtml(f.name)}
          </option>
        `).join('')}
      </select>
      <select class="sort-direction-select">
        <option value="asc" ${sort?.direction === 'asc' ? 'selected' : ''}>A → Z</option>
        <option value="desc" ${sort?.direction === 'desc' ? 'selected' : ''}>Z → A</option>
      </select>
      <button class="sort-rule-remove" title="Remove sort">
        <i class="ph ph-x"></i>
      </button>
    `;

    rule.querySelector('.sort-rule-remove').addEventListener('click', () => {
      rule.remove();
    });

    container.appendChild(rule);
  }

  // --------------------------------------------------------------------------
  // Status Updates
  // --------------------------------------------------------------------------

  _updateStatus() {
    const set = this.getCurrentSet();
    const records = this.getFilteredRecords();

    if (this.elements.recordCount) {
      this.elements.recordCount.querySelector('span:last-child').textContent =
        `${records.length} record${records.length !== 1 ? 's' : ''}`;
    }

    if (this.elements.selectedCount) {
      this.elements.selectedCount.querySelector('span:last-child').textContent =
        `${this.selectedRecords.size} selected`;
    }

    // Update bulk actions toolbar
    this._updateBulkActionsToolbar();
  }

  // --------------------------------------------------------------------------
  // Keyboard Shortcuts
  // --------------------------------------------------------------------------

  _handleKeyDown(e) {
    // Escape to close modals/menus and clear selection
    if (e.key === 'Escape') {
      this._closeModal();
      this._hideKeyboardShortcuts();
      this._hideFilterPanel();
      this._hideSortPanel();
      this._closeTabListDropdown();
      this._closeTabContextMenu();
      this.elements.contextMenu?.classList.remove('active');
      this.elements.fieldTypePicker?.classList.remove('active');
      this.elements.detailPanel?.classList.remove('open');

      if (this.editingCell) {
        this._cancelCellEdit();
      }

      // Clear selection when Escape is pressed (if no modal is open)
      if (this.selectedRecords.size > 0) {
        this._clearSelection();
        this._showToast('Selection cleared', 'info');
      }

      // Hide search results
      this._hideSearchResults();
    }

    // ? to show keyboard shortcuts
    if (e.key === '?' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      this._showKeyboardShortcuts();
    }

    // ========== TAB SHORTCUTS ==========

    // Ctrl + T for new tab
    if ((e.metaKey || e.ctrlKey) && e.key === 't' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      this._createNewTab();
    }

    // Ctrl + W to toss current tab
    if ((e.metaKey || e.ctrlKey) && e.key === 'w' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      this._tossCurrentTab();
    }

    // Ctrl + Shift + T to pick up last tossed tab
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      this._pickUpLastTossed();
    }

    // Escape also clears picked up item
    if (e.key === 'Escape' && this.pickedUp) {
      this._clearPickedUp();
      this._showToast('Dropped picked up item', 'info');
    }

    // ========== UNDO/REDO ==========

    // Ctrl + Z for undo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && !e.target.closest('input, textarea')) {
      e.preventDefault();
      this._undo();
    }

    // Ctrl + Shift + Z or Ctrl + Y for redo
    if ((e.metaKey || e.ctrlKey) && ((e.shiftKey && e.key === 'Z') || e.key === 'y') && !e.target.closest('input, textarea')) {
      e.preventDefault();
      this._redo();
    }

    // Ctrl + Tab to go to next tab
    if ((e.metaKey || e.ctrlKey) && e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      this._nextTab();
    }

    // Ctrl + Shift + Tab to go to previous tab
    if ((e.metaKey || e.ctrlKey) && e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      this._prevTab();
    }

    // Ctrl + 1-9 to switch to specific tab (1-indexed)
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      const tabIndex = parseInt(e.key, 10);
      if (tabIndex >= 1 && tabIndex <= 9) {
        const set = this.getCurrentSet();
        if (set && set.views.length > 0) {
          const viewIndex = tabIndex === 9 ? set.views.length - 1 : Math.min(tabIndex - 1, set.views.length - 1);
          if (set.views[viewIndex]) {
            e.preventDefault();
            this._selectView(set.views[viewIndex].id);
          }
        }
      }
    }

    // ========== RECORD SHORTCUTS ==========

    // Cmd/Ctrl + N for new record
    if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      this.addRecord();
    }

    // Cmd/Ctrl + D for duplicate
    if ((e.metaKey || e.ctrlKey) && e.key === 'd' && !e.target.closest('input, textarea')) {
      if (this.selectedRecords.size > 0) {
        e.preventDefault();
        this._bulkDuplicate();
      }
    }

    // Cmd/Ctrl + A to select all
    if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      this._selectAll();
    }

    // Cmd/Ctrl + F for filter
    if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      this._toggleFilterPanel();
    }

    // Cmd/Ctrl + S for snapshot
    if ((e.metaKey || e.ctrlKey) && e.key === 's' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      this._showNewSnapshotModal();
    }

    // Cmd/Ctrl + / to focus search
    if ((e.metaKey || e.ctrlKey) && e.key === '/' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      document.getElementById('global-search')?.focus();
    }

    // Delete selected records
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('input, textarea')) {
      if (this.selectedRecords.size > 0) {
        e.preventDefault();
        this._bulkDelete();
      }
    }

    // Number keys for view TYPE switching (1-5) - only when not using Ctrl
    if (!e.target.closest('input, textarea') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const viewMap = { '1': 'table', '2': 'cards', '3': 'kanban', '4': 'calendar', '5': 'graph' };
      if (viewMap[e.key]) {
        e.preventDefault();
        this._switchViewType(viewMap[e.key]);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Keyboard Shortcuts Modal
  // --------------------------------------------------------------------------

  _showKeyboardShortcuts() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  _hideKeyboardShortcuts() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // --------------------------------------------------------------------------
  // Bulk Operations
  // --------------------------------------------------------------------------

  _selectAll() {
    const set = this.getCurrentSet();
    if (!set) return;

    set.records.forEach(r => this.selectedRecords.add(r.id));
    this._renderTableView();
    this._updateBulkActionsToolbar();
  }

  _clearSelection() {
    this.selectedRecords.clear();
    this._renderTableView();
    this._updateBulkActionsToolbar();
  }

  _updateBulkActionsToolbar() {
    const toolbar = document.getElementById('bulk-actions-toolbar');
    const countEl = document.getElementById('bulk-selected-count');

    if (!toolbar) return;

    if (this.selectedRecords.size > 0) {
      toolbar.style.display = 'flex';
      if (countEl) {
        countEl.textContent = `${this.selectedRecords.size} selected`;
      }
    } else {
      toolbar.style.display = 'none';
    }
  }

  _bulkDuplicate() {
    if (this.selectedRecords.size === 0) return;

    const count = this.selectedRecords.size;
    this.selectedRecords.forEach(id => {
      this.duplicateRecord(id);
    });

    this._showToast(`Duplicated ${count} record${count !== 1 ? 's' : ''}`, 'success');
  }

  _bulkExport() {
    if (this.selectedRecords.size === 0) return;

    const set = this.getCurrentSet();
    if (!set) return;

    const selectedRecords = set.records.filter(r => this.selectedRecords.has(r.id));

    // Show export format selection dialog
    if (typeof showExportDialog === 'function') {
      showExportDialog({
        name: set.name,
        fields: set.fields,
        records: selectedRecords,
        allSets: this.sets, // For multi-tab Excel export option
        onExport: (result) => {
          this._showToast(
            `Exported ${result.recordCount} record${result.recordCount !== 1 ? 's' : ''} to ${result.format.toUpperCase()}`,
            'success'
          );
        }
      });
    } else {
      // Fallback to JSON export if dialog not available
      const exportData = {
        setName: set.name,
        fields: set.fields,
        records: selectedRecords,
        exportedAt: new Date().toISOString()
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${set.name}_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);
      this._showToast(`Exported ${this.selectedRecords.size} record${this.selectedRecords.size !== 1 ? 's' : ''}`, 'success');
    }
  }

  _bulkDelete() {
    if (this.selectedRecords.size === 0) return;

    const count = this.selectedRecords.size;
    if (!confirm(`Delete ${count} record${count !== 1 ? 's' : ''}? This cannot be undone.`)) {
      return;
    }

    const idsToDelete = [...this.selectedRecords];
    idsToDelete.forEach(id => this.deleteRecord(id));

    this.selectedRecords.clear();
    this._updateBulkActionsToolbar();
    this._showToast(`Deleted ${count} record${count !== 1 ? 's' : ''}`, 'success');
  }

  // --------------------------------------------------------------------------
  // Toast Notifications
  // --------------------------------------------------------------------------

  _showToast(message, type = 'info', options = {}) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = {
      success: 'ph-check-circle',
      error: 'ph-x-circle',
      warning: 'ph-warning',
      info: 'ph-info'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}${options.action ? ' has-action' : ''}`;

    let actionHtml = '';
    if (options.action) {
      actionHtml = `<button class="toast-action">${this._escapeHtml(options.action.label)}</button>`;
    }

    let progressHtml = '';
    if (options.countdown) {
      progressHtml = `<div class="toast-progress"><div class="toast-progress-bar"></div></div>`;
    }

    toast.innerHTML = `
      <i class="ph ${icons[type] || 'ph-info'} toast-icon"></i>
      <span class="toast-message">${this._escapeHtml(message)}</span>
      ${actionHtml}
      <button class="toast-close"><i class="ph ph-x"></i></button>
      ${progressHtml}
    `;

    container.appendChild(toast);

    // Action button handler
    if (options.action) {
      toast.querySelector('.toast-action').addEventListener('click', () => {
        options.action.callback();
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
      });
    }

    // Start countdown animation if specified
    if (options.countdown) {
      const progressBar = toast.querySelector('.toast-progress-bar');
      progressBar.style.animation = `toast-countdown ${options.countdown}ms linear`;
    }

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    });

    const duration = options.duration || (options.countdown ? options.countdown : 4000);
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);

    return toast;
  }

  // --------------------------------------------------------------------------
  // Loading Overlay
  // --------------------------------------------------------------------------

  /**
   * Show a loading overlay in the content area
   * @param {string} message - Loading message to display
   * @param {object} options - Options for the loading overlay
   * @param {boolean} options.showProgress - Whether to show a progress bar
   * @param {number} options.progress - Current progress percentage (0-100)
   */
  _showLoadingOverlay(message = 'Loading...', options = {}) {
    // Remove existing loading overlay if any
    this._hideLoadingOverlay();

    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loading-overlay';

    let progressHtml = '';
    if (options.showProgress) {
      progressHtml = `
        <div class="loading-progress-container">
          <div class="loading-progress-bar" id="loading-progress-bar" style="width: ${options.progress || 0}%"></div>
        </div>
        <p class="loading-progress-text" id="loading-progress-text">${options.progressText || ''}</p>
      `;
    }

    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner">
          <i class="ph ph-spinner ph-spin"></i>
        </div>
        <p class="loading-text">${this._escapeHtml(message)}</p>
        ${progressHtml}
      </div>
    `;

    this.elements.contentArea?.appendChild(overlay);
    return overlay;
  }

  /**
   * Update the loading overlay progress
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} text - Optional text to display
   */
  _updateLoadingProgress(progress, text = null) {
    const progressBar = document.getElementById('loading-progress-bar');
    const progressText = document.getElementById('loading-progress-text');

    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
    if (progressText && text !== null) {
      progressText.textContent = text;
    }
  }

  /**
   * Hide the loading overlay
   */
  _hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  // --------------------------------------------------------------------------
  // Advanced Filter Panel
  // --------------------------------------------------------------------------

  _toggleFilterPanel() {
    const panel = document.getElementById('filter-panel');
    if (!panel) return;

    if (panel.style.display === 'none') {
      this._showFilterPanel();
    } else {
      this._hideFilterPanel();
    }
  }

  _showFilterPanel() {
    const panel = document.getElementById('filter-panel');
    if (!panel) return;

    // Close sort panel if open
    this._hideSortPanel();

    panel.style.display = 'block';

    // Initialize with one empty filter if none exist
    const filterGroups = document.getElementById('filter-groups');
    if (filterGroups && filterGroups.children.length === 0) {
      this._addFilterRow();
    }
  }

  _hideFilterPanel() {
    const panel = document.getElementById('filter-panel');
    if (panel) {
      panel.style.display = 'none';
    }
  }

  _addFilterRow() {
    const container = document.getElementById('filter-groups');
    if (!container) return;

    const set = this.getCurrentSet();
    const fields = set?.fields || [];

    const row = document.createElement('div');
    row.className = 'filter-row';
    row.innerHTML = `
      <select class="filter-field">
        <option value="">Select field...</option>
        ${fields.map(f => `<option value="${f.id}">${this._escapeHtml(f.name)}</option>`).join('')}
      </select>
      <select class="filter-operator">
        <option value="contains">contains</option>
        <option value="equals">equals</option>
        <option value="not_equals">does not equal</option>
        <option value="is_empty">is empty</option>
        <option value="is_not_empty">is not empty</option>
        <option value="greater_than">greater than</option>
        <option value="less_than">less than</option>
      </select>
      <input type="text" class="filter-value" placeholder="Value...">
      <button class="filter-remove-btn" title="Remove filter">
        <i class="ph ph-x"></i>
      </button>
    `;

    row.querySelector('.filter-remove-btn').addEventListener('click', () => row.remove());

    // Hide value input for is_empty/is_not_empty
    row.querySelector('.filter-operator').addEventListener('change', (e) => {
      const valueInput = row.querySelector('.filter-value');
      if (e.target.value === 'is_empty' || e.target.value === 'is_not_empty') {
        valueInput.style.display = 'none';
      } else {
        valueInput.style.display = 'block';
      }
    });

    container.appendChild(row);
  }

  _applyFilters() {
    const view = this.getCurrentView();
    if (!view) return;

    const rows = document.querySelectorAll('#filter-groups .filter-row');
    const logic = document.getElementById('filter-logic')?.value || 'and';

    view.config.filters = [];
    view.config.filterLogic = logic;

    rows.forEach(row => {
      const fieldId = row.querySelector('.filter-field')?.value;
      const operator = row.querySelector('.filter-operator')?.value;
      const value = row.querySelector('.filter-value')?.value;

      if (fieldId) {
        view.config.filters.push({ fieldId, operator, filterValue: value });
      }
    });

    this._hideFilterPanel();
    this._renderView();
    this._saveData();

    const count = view.config.filters.length;
    if (count > 0) {
      this._showToast(`Applied ${count} filter${count !== 1 ? 's' : ''}`, 'info');
    }
  }

  _clearFilters() {
    const view = this.getCurrentView();
    if (view) {
      view.config.filters = [];
      view.config.filterLogic = 'and';
    }

    const container = document.getElementById('filter-groups');
    if (container) {
      container.innerHTML = '';
    }

    this._hideFilterPanel();
    this._renderView();
    this._saveData();
  }

  // --------------------------------------------------------------------------
  // Sort Panel
  // --------------------------------------------------------------------------

  _toggleSortPanel() {
    const panel = document.getElementById('sort-panel');
    if (!panel) return;

    if (panel.style.display === 'none') {
      this._showSortPanel();
    } else {
      this._hideSortPanel();
    }
  }

  _showSortPanel() {
    const panel = document.getElementById('sort-panel');
    if (!panel) return;

    // Close filter panel if open
    this._hideFilterPanel();

    panel.style.display = 'block';

    // Initialize with one empty sort if none exist
    const sortRules = document.getElementById('sort-rules');
    if (sortRules && sortRules.children.length === 0) {
      this._addSortRow();
    }
  }

  _hideSortPanel() {
    const panel = document.getElementById('sort-panel');
    if (panel) {
      panel.style.display = 'none';
    }
  }

  _addSortRow() {
    const container = document.getElementById('sort-rules');
    if (!container) return;

    const set = this.getCurrentSet();
    const fields = set?.fields || [];

    const row = document.createElement('div');
    row.className = 'sort-row';
    row.innerHTML = `
      <select class="sort-field">
        <option value="">Select field...</option>
        ${fields.map(f => `<option value="${f.id}">${this._escapeHtml(f.name)}</option>`).join('')}
      </select>
      <select class="sort-direction">
        <option value="asc">Ascending (A-Z)</option>
        <option value="desc">Descending (Z-A)</option>
      </select>
      <button class="sort-remove-btn" title="Remove sort">
        <i class="ph ph-x"></i>
      </button>
    `;

    row.querySelector('.sort-remove-btn').addEventListener('click', () => row.remove());

    container.appendChild(row);
  }

  _applySorts() {
    const view = this.getCurrentView();
    if (!view) return;

    const rows = document.querySelectorAll('#sort-rules .sort-row');

    view.config.sorts = [];

    rows.forEach(row => {
      const fieldId = row.querySelector('.sort-field')?.value;
      const direction = row.querySelector('.sort-direction')?.value;

      if (fieldId) {
        view.config.sorts.push({ fieldId, direction });
      }
    });

    this._hideSortPanel();
    this._renderView();
    this._saveData();

    const count = view.config.sorts.length;
    if (count > 0) {
      this._showToast(`Applied ${count} sort${count !== 1 ? 's' : ''}`, 'info');
    }
  }

  _clearSorts() {
    const view = this.getCurrentView();
    if (view) {
      view.config.sorts = [];
    }

    const container = document.getElementById('sort-rules');
    if (container) {
      container.innerHTML = '';
    }

    this._hideSortPanel();
    this._renderView();
    this._saveData();
  }

  // --------------------------------------------------------------------------
  // Global Search
  // --------------------------------------------------------------------------

  _handleSearch(query) {
    if (!query || query.length < 2) {
      this._hideSearchResults();
      this.currentSearchQuery = null;
      return;
    }

    this.currentSearchQuery = query;
    const results = [];
    const lowerQuery = query.toLowerCase();

    // Search across all sets and records
    this.sets.forEach(set => {
      // Search set name
      if (set.name.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'set', id: set.id, name: set.name, icon: 'ph-table', matchedField: null });
      }

      // Search records - check ALL fields, not just primary
      set.records.forEach(record => {
        const primaryField = set.fields.find(f => f.isPrimary) || set.fields[0];
        const primaryValue = record.values[primaryField?.id] || 'Untitled';
        let matchedField = null;
        let matchedValue = null;

        // Check each field for matches
        for (const field of set.fields) {
          const value = record.values[field.id];
          if (value && String(value).toLowerCase().includes(lowerQuery)) {
            matchedField = field;
            matchedValue = String(value);
            break;
          }
        }

        if (matchedField) {
          results.push({
            type: 'record',
            id: record.id,
            setId: set.id,
            name: primaryValue,
            setName: set.name,
            icon: 'ph-note',
            matchedField: matchedField.name,
            matchedValue: matchedValue,
            query: query
          });
        }
      });
    });

    this._renderSearchResults(results.slice(0, 15), query);
  }

  _highlightMatch(text, query) {
    if (!text || !query) return this._escapeHtml(text || '');

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const startIndex = lowerText.indexOf(lowerQuery);

    if (startIndex === -1) return this._escapeHtml(text);

    const before = text.substring(0, startIndex);
    const match = text.substring(startIndex, startIndex + query.length);
    const after = text.substring(startIndex + query.length);

    return `${this._escapeHtml(before)}<mark class="search-highlight">${this._escapeHtml(match)}</mark>${this._escapeHtml(after)}`;
  }

  _renderSearchResults(results, query) {
    let dropdown = document.querySelector('.search-results-dropdown');

    if (results.length === 0) {
      // Show "no results" message
      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'search-results-dropdown';
        document.querySelector('.sidebar-search')?.appendChild(dropdown);
      }
      dropdown.innerHTML = `
        <div class="search-no-results">
          <i class="ph ph-magnifying-glass"></i>
          <span>No results found for "${this._escapeHtml(query)}"</span>
        </div>
      `;
      return;
    }

    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'search-results-dropdown';
      document.querySelector('.sidebar-search')?.appendChild(dropdown);
    }

    dropdown.innerHTML = `
      <div class="search-results-header">
        <span>${results.length} result${results.length !== 1 ? 's' : ''}</span>
      </div>
      ${results.map(r => `
        <div class="search-result-item" data-type="${r.type}" data-id="${r.id}" data-set-id="${r.setId || ''}">
          <div class="search-result-icon">
            <i class="ph ${r.icon}"></i>
          </div>
          <div class="search-result-content">
            <span class="result-title">${this._highlightMatch(r.name, query)}</span>
            ${r.matchedField && r.matchedField !== 'Name' ? `
              <span class="result-context">
                <span class="result-field">${this._escapeHtml(r.matchedField)}:</span>
                ${this._highlightMatch(r.matchedValue?.substring(0, 50) + (r.matchedValue?.length > 50 ? '...' : ''), query)}
              </span>
            ` : ''}
            <span class="result-type">${r.type}${r.setName ? ` in ${this._escapeHtml(r.setName)}` : ''}</span>
          </div>
        </div>
      `).join('')}
    `;

    dropdown.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const type = item.dataset.type;
        if (type === 'set') {
          this._selectSet(item.dataset.id);
        } else if (type === 'record') {
          if (item.dataset.setId) {
            this._selectSet(item.dataset.setId);
          }
          // Scroll to and highlight the record in the grid
          setTimeout(() => {
            this._highlightRecordInGrid(item.dataset.id);
          }, 100);
          this._showRecordDetail(item.dataset.id);
        }
        this._hideSearchResults();
        document.getElementById('global-search').value = '';
      });
    });
  }

  _highlightRecordInGrid(recordId) {
    // Find and scroll to the record in the grid
    const row = document.querySelector(`tr[data-record-id="${recordId}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('search-highlight-row');
      setTimeout(() => {
        row.classList.remove('search-highlight-row');
      }, 2000);
    }
  }

  _showSearchResults() {
    const dropdown = document.querySelector('.search-results-dropdown');
    const searchWrapper = document.querySelector('.sidebar-search');
    if (searchWrapper) {
      searchWrapper.classList.add('focused');
    }
  }

  _hideSearchResults() {
    const dropdown = document.querySelector('.search-results-dropdown');
    if (dropdown) dropdown.remove();

    const searchWrapper = document.querySelector('.sidebar-search');
    if (searchWrapper) {
      searchWrapper.classList.remove('focused');
    }
  }

  _moveToNextCell(reverse = false) {
    // TODO: Implement cell navigation
  }

  // --------------------------------------------------------------------------
  // EO Integration
  // --------------------------------------------------------------------------

  _createEOEvent(action, data) {
    if (!this.eoApp) return;

    try {
      // Create a Given event for raw data changes
      // Using 'received' mode since this is user input data
      this.eoApp.recordGiven('received', data, { action });
    } catch (e) {
      console.error('Failed to create EO event:', e);
    }
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  _escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  // --------------------------------------------------------------------------
  // Provenance Utilities
  // --------------------------------------------------------------------------

  /**
   * Get provenance status for a record
   * @returns 'full' | 'partial' | 'none'
   */
  _getRecordProvenanceStatus(record, set) {
    // Check if provenance functions are available
    if (typeof getProvenanceStatus !== 'function') {
      return 'none';
    }

    // Resolve provenance (record + dataset inheritance)
    const datasetProv = set?.datasetProvenance?.provenance || null;
    const recordProv = record?.provenance || null;

    // Merge provenance (record takes precedence)
    const resolved = typeof mergeProvenance === 'function'
      ? mergeProvenance(datasetProv, recordProv)
      : (recordProv || datasetProv || null);

    return getProvenanceStatus(resolved);
  }

  /**
   * Get provenance indicator symbol
   */
  _getProvenanceIndicator(status) {
    switch (status) {
      case 'full': return '◉';
      case 'partial': return '◐';
      default: return '○';
    }
  }

  /**
   * Render provenance section for detail panel
   */
  _renderProvenanceSection(record, set) {
    // Get resolved provenance (merging dataset + record level)
    const datasetProv = set?.datasetProvenance?.provenance || {};
    const recordProv = record?.provenance || {};

    const status = this._getRecordProvenanceStatus(record, set);
    const indicator = this._getProvenanceIndicator(status);

    // Provenance elements with their display info
    const elements = [
      { key: 'agent', label: 'Agent', icon: 'ph-user', hint: 'Who provided this?' },
      { key: 'method', label: 'Method', icon: 'ph-flask', hint: 'How was it produced?' },
      { key: 'source', label: 'Source', icon: 'ph-file-text', hint: 'Where was it published?' },
      { key: 'term', label: 'Term', icon: 'ph-bookmark', hint: 'Key concept used' },
      { key: 'definition', label: 'Definition', icon: 'ph-book-open', hint: 'What does that mean here?' },
      { key: 'jurisdiction', label: 'Jurisdiction', icon: 'ph-map-pin', hint: 'Where does this apply?' },
      { key: 'scale', label: 'Scale', icon: 'ph-arrows-out', hint: 'At what level?' },
      { key: 'timeframe', label: 'Timeframe', icon: 'ph-calendar', hint: 'When was this observed?' },
      { key: 'background', label: 'Background', icon: 'ph-info', hint: 'What context/conditions?' }
    ];

    return `
      <div class="provenance-section" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-primary);">
        <div class="provenance-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span class="prov-indicator prov-${status}" style="font-size: 14px;">${indicator}</span>
          <span style="font-weight: 500; font-size: 13px;">Provenance</span>
          <span style="font-size: 11px; color: var(--text-muted);">
            ${status === 'full' ? '(complete)' : status === 'partial' ? '(partial)' : '(none)'}
          </span>
        </div>
        <div class="provenance-grid" style="display: grid; gap: 8px;">
          ${elements.map(el => {
            const value = recordProv[el.key] ?? datasetProv[el.key] ?? null;
            const inherited = !recordProv[el.key] && datasetProv[el.key];
            const isRef = value && typeof value === 'object' && '$ref' in value;
            const displayValue = this._formatProvenanceValue(value);

            return `
              <div class="provenance-field" data-prov-key="${el.key}" data-record-id="${record.id}"
                   style="display: flex; align-items: flex-start; gap: 8px; padding: 4px 0;">
                <i class="ph ${el.icon}" style="color: var(--text-muted); margin-top: 2px; flex-shrink: 0;"></i>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 2px;">
                    ${el.label}
                    ${inherited ? '<span style="font-size: 10px; opacity: 0.7;">(inherited)</span>' : ''}
                  </div>
                  <div class="provenance-value editable ${isRef ? 'is-ref' : ''}"
                       data-prov-key="${el.key}"
                       data-record-id="${record.id}"
                       title="${el.hint}"
                       style="font-size: 12px; color: ${value ? 'var(--text-primary)' : 'var(--text-muted)'}; cursor: pointer;">
                    ${displayValue || '<span style="opacity: 0.5;">Click to add</span>'}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Format provenance value for display
   */
  _formatProvenanceValue(value) {
    if (value === null || value === undefined) {
      return '';
    }

    // Record reference
    if (typeof value === 'object' && '$ref' in value) {
      const refId = value.$ref;
      // Try to find the referenced record's name
      const refRecord = this._findRecordById(refId);
      const refName = refRecord ? this._getRecordPrimaryValue(refRecord) : refId.substring(0, 8);
      return `<span class="prov-ref"><i class="ph ph-arrow-right"></i> ${this._escapeHtml(refName)}</span>`;
    }

    return this._escapeHtml(String(value));
  }

  /**
   * Find a record by ID across all sets
   */
  _findRecordById(recordId) {
    for (const set of this.sets) {
      const record = set.records.find(r => r.id === recordId);
      if (record) return record;
    }
    return null;
  }

  /**
   * Get primary field value for a record
   */
  _getRecordPrimaryValue(record) {
    const set = this.sets.find(s => s.id === record.setId);
    if (!set) return record.id;
    const primaryField = set.fields.find(f => f.isPrimary) || set.fields[0];
    return record.values[primaryField?.id] || record.id;
  }

  /**
   * Render a nested value (object or array) for display in a table cell
   */
  _renderNestedValue(value, depth = 0) {
    if (value === null || value === undefined) {
      return '<span class="cell-empty">-</span>';
    }

    // Prevent infinite nesting - show JSON after max depth
    const MAX_DEPTH = 3;
    if (depth >= MAX_DEPTH) {
      return `<span class="nested-json-preview">${this._escapeHtml(JSON.stringify(value))}</span>`;
    }

    // Array of objects -> nested table
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '<span class="cell-empty">[]</span>';
      }

      // Array of primitives -> comma-separated badges
      if (value.every(item => typeof item !== 'object' || item === null)) {
        return this._renderPrimitiveArray(value);
      }

      // Array of objects -> nested table
      return this._renderNestedTable(value, depth);
    }

    // Single object -> key-value display
    if (typeof value === 'object') {
      return this._renderNestedObject(value, depth);
    }

    // Primitive value
    return this._escapeHtml(String(value));
  }

  /**
   * Render an array of primitive values as badges/chips
   */
  _renderPrimitiveArray(arr) {
    const items = arr.slice(0, 10); // Limit display
    const hasMore = arr.length > 10;

    let html = '<div class="nested-array-badges">';
    items.forEach(item => {
      html += `<span class="nested-badge">${this._escapeHtml(String(item))}</span>`;
    });
    if (hasMore) {
      html += `<span class="nested-badge nested-more">+${arr.length - 10} more</span>`;
    }
    html += '</div>';
    return html;
  }

  /**
   * Render an array of objects as a nested table
   */
  _renderNestedTable(arr, depth) {
    // Filter to only objects
    const objects = arr.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item));

    if (objects.length === 0) {
      // Mixed array - show as JSON
      return `<span class="nested-json-preview">${this._escapeHtml(JSON.stringify(arr))}</span>`;
    }

    // Get all unique keys from all objects
    const keys = new Set();
    objects.forEach(obj => Object.keys(obj).forEach(k => keys.add(k)));
    const headers = Array.from(keys);

    // Limit columns for readability
    const displayHeaders = headers.slice(0, 6);
    const hasMoreCols = headers.length > 6;

    // Limit rows
    const displayRows = objects.slice(0, 5);
    const hasMoreRows = objects.length > 5;

    let html = '<div class="nested-table-container">';
    html += '<table class="nested-table">';

    // Header
    html += '<thead><tr>';
    displayHeaders.forEach(h => {
      html += `<th>${this._escapeHtml(h)}</th>`;
    });
    if (hasMoreCols) {
      html += '<th class="nested-more-col">...</th>';
    }
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    displayRows.forEach(obj => {
      html += '<tr>';
      displayHeaders.forEach(h => {
        const cellValue = obj[h];
        html += `<td>${this._renderNestedValue(cellValue, depth + 1)}</td>`;
      });
      if (hasMoreCols) {
        html += '<td class="nested-more-col">...</td>';
      }
      html += '</tr>';
    });

    if (hasMoreRows) {
      html += `<tr class="nested-more-row"><td colspan="${displayHeaders.length + (hasMoreCols ? 1 : 0)}">+${objects.length - 5} more rows</td></tr>`;
    }
    html += '</tbody></table>';

    // Add expand button for full view
    html += `<button class="nested-expand-btn" onclick="event.stopPropagation(); window.eoWorkbench._showNestedDataModal(${this._escapeHtml(JSON.stringify(JSON.stringify(arr)))})"><i class="ph ph-arrows-out-simple"></i></button>`;
    html += '</div>';

    return html;
  }

  /**
   * Render a single object as key-value pairs
   */
  _renderNestedObject(obj, depth) {
    const keys = Object.keys(obj);

    if (keys.length === 0) {
      return '<span class="cell-empty">{}</span>';
    }

    // For small objects (1-2 keys), show inline
    if (keys.length <= 2 && keys.every(k => typeof obj[k] !== 'object')) {
      return '<span class="nested-object-inline">' +
        keys.map(k => `<span class="nested-kv"><span class="nested-key">${this._escapeHtml(k)}:</span> <span class="nested-val">${this._escapeHtml(String(obj[k]))}</span></span>`).join(' ') +
        '</span>';
    }

    // For larger objects, show as compact table
    const displayKeys = keys.slice(0, 4);
    const hasMore = keys.length > 4;

    let html = '<div class="nested-object-container">';
    html += '<div class="nested-object-grid">';
    displayKeys.forEach(k => {
      html += `<div class="nested-object-row">`;
      html += `<span class="nested-key">${this._escapeHtml(k)}</span>`;
      html += `<span class="nested-val">${this._renderNestedValue(obj[k], depth + 1)}</span>`;
      html += '</div>';
    });
    if (hasMore) {
      html += `<div class="nested-object-more">+${keys.length - 4} more fields</div>`;
    }
    html += '</div>';

    // Add expand button
    html += `<button class="nested-expand-btn" onclick="event.stopPropagation(); window.eoWorkbench._showNestedDataModal(${this._escapeHtml(JSON.stringify(JSON.stringify(obj)))})"><i class="ph ph-arrows-out-simple"></i></button>`;
    html += '</div>';

    return html;
  }

  /**
   * Render a cell that has subfields configured
   * Handles the { value, params } structure
   */
  _renderCellWithSubfields(field, value) {
    const subfieldsConfig = field.options?.subfields;
    if (!subfieldsConfig) {
      // Fallback to normal rendering
      return this._renderCellContent({ ...field, options: { ...field.options, subfields: null } }, value);
    }

    // Parse the value - can be { value, params } or just a primitive
    let mainValue = value;
    let params = {};

    if (value && typeof value === 'object' && 'value' in value) {
      mainValue = value.value;
      params = value.params || {};
    }

    const hasParams = Object.keys(params).length > 0;
    const displayMode = subfieldsConfig.display || 'compact';

    // Render main value
    let mainValueHtml = '';
    if (mainValue != null && mainValue !== '') {
      mainValueHtml = this._escapeHtml(String(mainValue));
    } else {
      mainValueHtml = '<span class="cell-empty">Empty</span>';
    }

    // Display based on mode
    switch (displayMode) {
      case 'compact':
        // Show main value + indicator if params exist
        if (hasParams) {
          const paramCount = Object.keys(params).length;
          return `
            <div class="cell-with-subfields compact">
              <span class="subfields-main-value">${mainValueHtml}</span>
              <span class="subfields-indicator" title="${paramCount} parameter${paramCount > 1 ? 's' : ''}">
                <i class="ph ph-brackets-curly"></i>
                <span class="subfields-count">${paramCount}</span>
              </span>
            </div>
          `;
        }
        return mainValueHtml;

      case 'inline':
        // Show main value + key params as inline badges
        if (hasParams) {
          const schema = subfieldsConfig.schema || [];
          const inlineKeys = schema.length > 0
            ? schema.slice(0, 3).map(s => s.key)
            : Object.keys(params).slice(0, 3);

          let inlineParamsHtml = inlineKeys.map(key => {
            if (params[key] != null) {
              const val = params[key];
              const displayVal = typeof val === 'boolean'
                ? (val ? '✓' : '✗')
                : String(val).substring(0, 15) + (String(val).length > 15 ? '…' : '');
              return `<span class="subfield-inline-badge" title="${this._escapeHtml(key)}: ${this._escapeHtml(String(val))}">
                <span class="subfield-inline-key">${this._escapeHtml(key)}</span>
                <span class="subfield-inline-val">${this._escapeHtml(displayVal)}</span>
              </span>`;
            }
            return '';
          }).filter(Boolean).join('');

          const remainingCount = Object.keys(params).length - inlineKeys.length;
          if (remainingCount > 0) {
            inlineParamsHtml += `<span class="subfields-more">+${remainingCount}</span>`;
          }

          return `
            <div class="cell-with-subfields inline">
              <span class="subfields-main-value">${mainValueHtml}</span>
              <div class="subfields-inline-params">${inlineParamsHtml}</div>
            </div>
          `;
        }
        return mainValueHtml;

      case 'expanded':
        // Show main value + all params as key-value rows
        if (hasParams) {
          let paramsHtml = '<div class="subfields-expanded-params">';
          Object.entries(params).forEach(([key, val]) => {
            const displayVal = typeof val === 'boolean'
              ? `<i class="ph ${val ? 'ph-check-circle' : 'ph-x-circle'}"></i>`
              : this._escapeHtml(String(val));
            paramsHtml += `
              <div class="subfield-expanded-row">
                <span class="subfield-expanded-key">${this._escapeHtml(key)}</span>
                <span class="subfield-expanded-val">${displayVal}</span>
              </div>
            `;
          });
          paramsHtml += '</div>';

          return `
            <div class="cell-with-subfields expanded">
              <div class="subfields-main-value">${mainValueHtml}</div>
              ${paramsHtml}
            </div>
          `;
        }
        return mainValueHtml;

      default:
        return mainValueHtml;
    }
  }

  /**
   * Render JSON field value as elegant key-value pairs
   * This is the default display for JSON field type
   */
  _renderJsonKeyValue(value, field) {
    // Handle string values - try to parse as JSON
    let data = value;
    if (typeof value === 'string') {
      try {
        data = JSON.parse(value);
      } catch (e) {
        // Not valid JSON, show as raw string
        return `<span class="cell-json-raw">${this._escapeHtml(value)}</span>`;
      }
    }

    // Null/undefined
    if (data === null || data === undefined) {
      return '<span class="cell-empty">-</span>';
    }

    // Primitives (number, boolean, string that wasn't JSON)
    if (typeof data !== 'object') {
      return this._renderJsonPrimitive(data);
    }

    // Arrays
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return '<span class="cell-empty json-empty">[]</span>';
      }
      // For arrays, show count with preview
      const preview = data.slice(0, 3).map(item =>
        typeof item === 'object' ? '{...}' : String(item)
      ).join(', ');
      const hasMore = data.length > 3 ? ` +${data.length - 3}` : '';
      return `<span class="json-array-preview" title="${this._escapeHtml(JSON.stringify(data))}">[${this._escapeHtml(preview)}${hasMore}]</span>`;
    }

    // Objects - render as key-value pairs
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return '<span class="cell-empty json-empty">{}</span>';
    }

    let html = '<div class="json-kv-container">';

    // Show up to 4 key-value pairs
    const displayKeys = keys.slice(0, 4);
    displayKeys.forEach(key => {
      const val = data[key];
      html += '<div class="json-kv-row">';
      html += `<span class="json-key">${this._escapeHtml(key)}</span>`;
      html += `<span class="json-val">${this._renderJsonPrimitive(val)}</span>`;
      html += '</div>';
    });

    if (keys.length > 4) {
      html += `<div class="json-kv-more">+${keys.length - 4} more</div>`;
    }

    html += '</div>';

    // Add expand button for larger objects
    if (keys.length > 2) {
      html = `<div class="json-kv-wrapper">${html}<button class="nested-expand-btn" onclick="event.stopPropagation(); window.eoWorkbench._showNestedDataModal(${this._escapeHtml(JSON.stringify(JSON.stringify(data)))})"><i class="ph ph-arrows-out-simple"></i></button></div>`;
    }

    return html;
  }

  /**
   * Render a JSON primitive value with appropriate formatting
   */
  _renderJsonPrimitive(val) {
    if (val === null) {
      return '<span class="json-null">null</span>';
    }
    if (val === undefined) {
      return '<span class="json-undefined">undefined</span>';
    }
    if (typeof val === 'boolean') {
      return `<span class="json-bool"><i class="ph ${val ? 'ph-check-circle' : 'ph-x-circle'}"></i> ${val}</span>`;
    }
    if (typeof val === 'number') {
      return `<span class="json-number">${val}</span>`;
    }
    if (typeof val === 'string') {
      // Truncate long strings
      const display = val.length > 30 ? val.substring(0, 30) + '...' : val;
      return `<span class="json-string" title="${this._escapeHtml(val)}">${this._escapeHtml(display)}</span>`;
    }
    if (Array.isArray(val)) {
      return `<span class="json-array">[${val.length}]</span>`;
    }
    if (typeof val === 'object') {
      return `<span class="json-object">{${Object.keys(val).length}}</span>`;
    }
    return this._escapeHtml(String(val));
  }

  /**
   * Show modal with full nested data view
   */
  _showNestedDataModal(jsonString) {
    const data = JSON.parse(jsonString);

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'nested-data-modal';

    // Render full data recursively
    if (Array.isArray(data)) {
      modalContent.innerHTML = this._renderFullNestedTable(data);
    } else {
      modalContent.innerHTML = this._renderFullNestedObject(data);
    }

    // Show in modal
    const modal = document.getElementById('modal-overlay');
    const modalBody = modal.querySelector('.modal-body');
    const modalTitle = modal.querySelector('.modal-title');

    if (modal && modalBody && modalTitle) {
      modalTitle.textContent = 'Nested Data';
      modalBody.innerHTML = '';
      modalBody.appendChild(modalContent);
      modal.classList.add('active');
    }
  }

  /**
   * Render full nested table for modal view
   */
  _renderFullNestedTable(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return '<p class="cell-empty">No data</p>';
    }

    // Get all unique keys
    const keys = new Set();
    arr.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(k => keys.add(k));
      }
    });
    const headers = Array.from(keys);

    let html = '<div class="nested-modal-table-wrapper">';
    html += '<table class="nested-modal-table">';

    // Header
    html += '<thead><tr>';
    headers.forEach(h => {
      html += `<th>${this._escapeHtml(h)}</th>`;
    });
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    arr.forEach((item, idx) => {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        html += '<tr>';
        headers.forEach(h => {
          const cellValue = item[h];
          html += `<td>${this._renderModalCellValue(cellValue)}</td>`;
        });
        html += '</tr>';
      } else {
        html += `<tr><td colspan="${headers.length}">${this._renderModalCellValue(item)}</td></tr>`;
      }
    });
    html += '</tbody></table></div>';

    return html;
  }

  /**
   * Render full nested object for modal view
   */
  _renderFullNestedObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return `<p>${this._escapeHtml(String(obj))}</p>`;
    }

    let html = '<div class="nested-modal-object">';
    Object.entries(obj).forEach(([key, value]) => {
      html += '<div class="nested-modal-field">';
      html += `<div class="nested-modal-key">${this._escapeHtml(key)}</div>`;
      html += `<div class="nested-modal-value">${this._renderModalCellValue(value)}</div>`;
      html += '</div>';
    });
    html += '</div>';

    return html;
  }

  /**
   * Render a cell value for modal display (recursive)
   */
  _renderModalCellValue(value) {
    if (value === null || value === undefined) {
      return '<span class="cell-empty">-</span>';
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return '<span class="cell-empty">[]</span>';
      if (value.every(item => typeof item !== 'object' || item === null)) {
        return value.map(v => `<span class="nested-badge">${this._escapeHtml(String(v))}</span>`).join(' ');
      }
      return this._renderFullNestedTable(value);
    }

    if (typeof value === 'object') {
      return this._renderFullNestedObject(value);
    }

    return this._escapeHtml(String(value));
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  getSets() {
    return this.sets;
  }

  getRecords(setId = null) {
    const targetSetId = setId || this.currentSetId;
    const set = this.sets.find(s => s.id === targetSetId);
    return set?.records || [];
  }

  getFields(setId = null) {
    const targetSetId = setId || this.currentSetId;
    const set = this.sets.find(s => s.id === targetSetId);
    return set?.fields || [];
  }

  refresh() {
    this._renderView();
  }

  exportData() {
    return {
      sets: this.sets,
      exportedAt: new Date().toISOString()
    };
  }

  importData(data, importName = null) {
    if (data.sets) {
      this.sets = data.sets;
      this.currentSetId = this.sets[0]?.id;

      // Create a new view labeled with the import name
      const set = this.getCurrentSet();
      if (set && importName) {
        const newView = createView(importName, 'table');
        set.views.push(newView);
        this.currentViewId = newView.id;
      } else {
        this.currentViewId = this.sets[0]?.views[0]?.id;
      }

      this._saveData();
      this._renderSidebar();
      this._renderViewsNav();
      this._renderView();
    }
  }
}

// ============================================================================
// Initialization
// ============================================================================

let _workbench = null;

function initDataWorkbench(container = 'content-area', eoApp = null) {
  _workbench = new EODataWorkbench(container);
  _workbench.init(eoApp);
  return _workbench;
}

function getDataWorkbench() {
  return _workbench;
}

// Global exports
if (typeof window !== 'undefined') {
  window.FieldTypes = FieldTypes;
  window.createSet = createSet;
  window.createField = createField;
  window.createView = createView;
  window.createRecord = createRecord;
  window.EODataWorkbench = EODataWorkbench;
  window.initDataWorkbench = initDataWorkbench;
  window.getDataWorkbench = getDataWorkbench;
}

// Module exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FieldTypes,
    createSet,
    createField,
    createView,
    createRecord,
    EODataWorkbench,
    initDataWorkbench,
    getDataWorkbench
  };
}
