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
  AUTONUMBER: 'autonumber'
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
  [FieldTypes.AUTONUMBER]: 'ph-number-square-one'
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
      // Deduplication config
      deduplication: config.deduplication || {
        enabled: false,
        fields: [],           // Field IDs to use for duplicate detection
        strategy: 'newest',   // 'newest', 'oldest', 'merge'
        caseSensitive: false  // Whether string comparison is case-sensitive
      },
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
    this.selectedRecords = new Set();
    this.editingCell = null;
    this.clipboard = null;

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
    this.recentlyClosedTabs = [];
    this.maxRecentlyClosedTabs = 10;
    this.tabListDropdownOpen = false;
    this.tabContextMenuOpen = false;
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
      if (!e.target.closest('.field-type-picker') && !e.target.closest('.col-add')) {
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

    // Deduplication panel
    document.getElementById('btn-dedupe')?.addEventListener('click', () => this._toggleDedupePanel());
    document.getElementById('dedupe-panel-close')?.addEventListener('click', () => this._hideDedupePanel());
    document.getElementById('dedupe-apply')?.addEventListener('click', () => this._applyDeduplicationConfig());
    document.getElementById('dedupe-clear')?.addEventListener('click', () => this._clearDeduplicationConfig());

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
        this.sets = parsed.sets || [];
        this.currentSetId = parsed.currentSetId;
        this.currentViewId = parsed.currentViewId;
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }

  _saveData() {
    try {
      localStorage.setItem('eo_lake_data', JSON.stringify({
        sets: this.sets,
        currentSetId: this.currentSetId,
        currentViewId: this.currentViewId
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

    // Apply deduplication
    records = this._applyDeduplication(records, view, set);

    return records;
  }

  /**
   * Apply deduplication to records based on view config
   * @param {Array} records - Records to deduplicate
   * @param {Object} view - Current view with deduplication config
   * @param {Object} set - Current set with field definitions
   * @returns {Array} Deduplicated records
   */
  _applyDeduplication(records, view, set) {
    const dedupeConfig = view?.config?.deduplication;

    // If deduplication is not enabled or no fields specified, return original records
    if (!dedupeConfig?.enabled || !dedupeConfig?.fields?.length) {
      return records;
    }

    const { fields: dedupeFieldIds, strategy = 'newest', caseSensitive = false } = dedupeConfig;

    // Create a map to track unique records by their dedupe key
    const uniqueRecords = new Map();

    for (const record of records) {
      // Build the dedupe key from specified fields
      const keyParts = dedupeFieldIds.map(fieldId => {
        const field = set.fields.find(f => f.id === fieldId);
        let value = record.values[fieldId];

        // Handle linked records - use the linked record's primary value for comparison
        if (field?.type === FieldTypes.LINK && value) {
          value = this._resolveLinkValue(value, field);
        }

        // Normalize string values for case-insensitive comparison
        if (typeof value === 'string' && !caseSensitive) {
          value = value.toLowerCase().trim();
        }

        return value ?? '';
      });

      const dedupeKey = keyParts.join('|||');

      if (!uniqueRecords.has(dedupeKey)) {
        // First occurrence - add to map
        uniqueRecords.set(dedupeKey, record);
      } else {
        // Duplicate found - apply strategy
        const existing = uniqueRecords.get(dedupeKey);

        switch (strategy) {
          case 'newest':
            // Keep the record with the more recent updatedAt/createdAt
            const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
            const currentTime = new Date(record.updatedAt || record.createdAt).getTime();
            if (currentTime > existingTime) {
              uniqueRecords.set(dedupeKey, record);
            }
            break;

          case 'oldest':
            // Keep the record with the older createdAt
            const existingCreated = new Date(existing.createdAt).getTime();
            const currentCreated = new Date(record.createdAt).getTime();
            if (currentCreated < existingCreated) {
              uniqueRecords.set(dedupeKey, record);
            }
            break;

          case 'merge':
            // Merge non-empty values from the newer record into the older one
            const merged = this._mergeRecords(existing, record);
            uniqueRecords.set(dedupeKey, merged);
            break;

          default:
            // Default to newest
            break;
        }
      }
    }

    return Array.from(uniqueRecords.values());
  }

  /**
   * Resolve link field value to a comparable string
   */
  _resolveLinkValue(linkValue, field) {
    if (!linkValue) return '';

    // Link values can be a single ID or array of IDs
    const linkedSetId = field.options?.linkedSetId;
    const linkedSet = this.sets.find(s => s.id === linkedSetId);
    if (!linkedSet) return String(linkValue);

    // Get the linked record(s) and return their primary field value
    const ids = Array.isArray(linkValue) ? linkValue : [linkValue];
    const primaryField = linkedSet.fields.find(f => f.isPrimary);

    const values = ids.map(id => {
      const linkedRecord = linkedSet.records.find(r => r.id === id);
      if (linkedRecord && primaryField) {
        return linkedRecord.values[primaryField.id] || '';
      }
      return '';
    });

    return values.join(', ');
  }

  /**
   * Merge two records, keeping non-empty values from the newer one
   */
  _mergeRecords(older, newer) {
    const merged = { ...older };
    merged.values = { ...older.values };

    // Merge values from newer record if they're non-empty
    for (const [key, value] of Object.entries(newer.values)) {
      if (value != null && value !== '' &&
          (merged.values[key] == null || merged.values[key] === '')) {
        merged.values[key] = value;
      }
    }

    // Update timestamp to reflect merge
    merged.updatedAt = new Date().toISOString();

    return merged;
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
    this._renderWorkspacesNav();
    this._renderSetsNav();
    this._renderViewsNav();
    this._renderFocusesNav();
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

    container.innerHTML = `
      <div class="nav-section-header">
        <span class="nav-section-title">Focuses</span>
        <button class="nav-section-action" id="btn-new-focus" title="Add Focus (Rule 5: Restrict only)">
          <i class="ph ph-funnel"></i>
        </button>
      </div>
      ${focuses.map(focus => `
        <div class="nav-item focus-item ${focus.id === this.currentFocusId ? 'active' : ''}"
             data-focus-id="${focus.id}">
          <i class="ph ph-funnel"></i>
          <span>${this._escapeHtml(focus.name)}</span>
          <span class="nav-item-badge rule-badge" title="Rule 5: Can only restrict">R5</span>
        </div>
      `).join('')}
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
      graph: 'ph-graph'
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
      graph: 'ph-graph'
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

      // Middle-click to close tab
      tab.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          this._closeTab(viewId);
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
        this._closeTab(viewId);
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

    this._renderViewsNav();
    this._renderView();
    this._updateBreadcrumb();
    this._saveData();
  }

  /**
   * Close a tab
   */
  _closeTab(viewId) {
    const set = this.getCurrentSet();
    if (!set || set.views.length <= 1) {
      // Can't close the last tab
      return;
    }

    const viewIndex = set.views.findIndex(v => v.id === viewId);
    if (viewIndex === -1) return;

    const view = set.views[viewIndex];

    // Save to recently closed
    this.recentlyClosedTabs.unshift({
      view: { ...view },
      setId: set.id,
      closedAt: new Date().toISOString()
    });
    if (this.recentlyClosedTabs.length > this.maxRecentlyClosedTabs) {
      this.recentlyClosedTabs.pop();
    }

    // Remove the view
    set.views.splice(viewIndex, 1);

    // If we're closing the current view, switch to adjacent tab
    if (this.currentViewId === viewId) {
      const newIndex = Math.min(viewIndex, set.views.length - 1);
      this.currentViewId = set.views[newIndex]?.id;
    }

    this._renderViewsNav();
    this._renderView();
    this._updateBreadcrumb();
    this._saveData();
  }

  /**
   * Reopen the last closed tab
   */
  _reopenClosedTab() {
    if (this.recentlyClosedTabs.length === 0) return;

    const closedTab = this.recentlyClosedTabs.shift();
    const set = this.sets.find(s => s.id === closedTab.setId);
    if (!set) return;

    // Restore the view
    set.views.push(closedTab.view);
    this.currentViewId = closedTab.view.id;

    if (this.currentSetId !== closedTab.setId) {
      this.currentSetId = closedTab.setId;
      this._renderSidebar();
    }

    this._renderViewsNav();
    this._renderView();
    this._updateBreadcrumb();
    this._saveData();
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
                <div class="tab-list-item-close" data-view-id="${view.id}">
                  <i class="ph ph-x"></i>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ${this.recentlyClosedTabs.length > 0 ? `
          <div class="tab-list-section recently-closed">
            <div class="tab-list-section-title">Recently Closed</div>
            ${this.recentlyClosedTabs.slice(0, 5).map(item => `
              <div class="tab-list-item" data-restore-view-id="${item.view.id}">
                <div class="tab-list-item-icon">
                  <i class="ph ${this._getViewIcon(item.view.type)}"></i>
                </div>
                <span class="tab-list-item-title">${this._escapeHtml(item.view.name)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    tabBar.appendChild(dropdown);
    this.tabListDropdownOpen = true;

    // Attach handlers
    dropdown.querySelectorAll('.tab-list-item[data-view-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-list-item-close')) {
          this._selectView(item.dataset.viewId);
          this._closeTabListDropdown();
        }
      });
    });

    dropdown.querySelectorAll('.tab-list-item-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._closeTab(btn.dataset.viewId);
        // Re-render dropdown
        this._closeTabListDropdown();
        this._openTabListDropdown();
      });
    });

    dropdown.querySelectorAll('.tab-list-item[data-restore-view-id]').forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.dataset.restoreViewId;
        const tabIndex = this.recentlyClosedTabs.findIndex(t => t.view.id === viewId);
        if (tabIndex !== -1) {
          const closedTab = this.recentlyClosedTabs.splice(tabIndex, 1)[0];
          const set = this.sets.find(s => s.id === closedTab.setId);
          if (set) {
            set.views.push(closedTab.view);
            this.currentViewId = closedTab.view.id;
            this._renderViewsNav();
            this._renderView();
            this._saveData();
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
      <div class="tab-context-item ${canClose ? '' : 'disabled'}" data-action="close">
        <i class="ph ph-x"></i>
        <span>Close Tab</span>
        <span class="shortcut">Ctrl+W</span>
      </div>
      <div class="tab-context-item ${canClose && set.views.length > 1 ? '' : 'disabled'}" data-action="close-others">
        <i class="ph ph-x-circle"></i>
        <span>Close Other Tabs</span>
      </div>
      <div class="tab-context-item ${canClose && !isLast ? '' : 'disabled'}" data-action="close-right">
        <i class="ph ph-arrow-line-right"></i>
        <span>Close Tabs to the Right</span>
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

      case 'close':
        this._closeTab(viewId);
        break;

      case 'close-others':
        const viewsToClose = set.views.filter(v => v.id !== viewId);
        viewsToClose.forEach(v => {
          this.recentlyClosedTabs.unshift({
            view: { ...v },
            setId: set.id,
            closedAt: new Date().toISOString()
          });
        });
        set.views = [view];
        this.currentViewId = viewId;
        this._renderViewsNav();
        this._renderView();
        this._saveData();
        break;

      case 'close-right':
        const rightViews = set.views.slice(viewIndex + 1);
        rightViews.forEach(v => {
          this.recentlyClosedTabs.unshift({
            view: { ...v },
            setId: set.id,
            closedAt: new Date().toISOString()
          });
        });
        set.views = set.views.slice(0, viewIndex + 1);
        if (!set.views.find(v => v.id === this.currentViewId)) {
          this.currentViewId = viewId;
        }
        this._renderViewsNav();
        this._renderView();
        this._saveData();
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
   * Close current tab
   */
  _closeCurrentTab() {
    if (this.currentViewId) {
      this._closeTab(this.currentViewId);
    }
  }

  _selectSet(setId) {
    this.currentSetId = setId;
    const set = this.getCurrentSet();
    this.currentViewId = set?.views[0]?.id;

    this._renderSidebar();
    this._renderView();
    this._updateBreadcrumb();
    this._saveData();
  }

  _selectView(viewId) {
    this.currentViewId = viewId;

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

    // Workspace breadcrumb
    const workspaceBreadcrumb = document.getElementById('current-workspace-name');
    if (workspaceBreadcrumb) {
      workspaceBreadcrumb.innerHTML = `
        <i class="ph ${workspace?.icon || 'ph-folder-simple'}"></i>
        ${this._escapeHtml(workspace?.name || 'Workspace')}
      `;
    }

    // Set breadcrumb
    if (this.elements.currentSetName) {
      this.elements.currentSetName.textContent = set?.name || 'No Set';
    }

    // View/Lens breadcrumb
    if (this.elements.currentViewName) {
      this.elements.currentViewName.innerHTML = `
        <i class="ph ${this._getLensIcon(view?.type)}"></i>
        ${this._escapeHtml(view?.name || 'No Lens')}
      `;
    }

    // Focus breadcrumb (only show if a focus is active)
    const focusBreadcrumb = document.getElementById('current-focus-name');
    if (focusBreadcrumb) {
      if (focus) {
        focusBreadcrumb.innerHTML = `
          <i class="ph ph-caret-right"></i>
          <i class="ph ph-funnel"></i>
          ${this._escapeHtml(focus.name)}
          <button class="breadcrumb-clear" title="Clear focus" onclick="getDataWorkbench()?._clearFocus()">
            <i class="ph ph-x"></i>
          </button>
        `;
        focusBreadcrumb.style.display = 'inline-flex';
      } else {
        focusBreadcrumb.style.display = 'none';
      }
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
      default:
        this._renderTableView();
    }

    this._updateStatus();
  }

  _renderEmptyState() {
    this.elements.contentArea.innerHTML = `
      <div class="empty-state">
        <i class="ph ph-database"></i>
        <h3>No Data Yet</h3>
        <p>Create your first set to get started</p>
        <button class="btn btn-primary" id="empty-create-set">
          <i class="ph ph-plus"></i>
          Create Set
        </button>
      </div>
    `;

    document.getElementById('empty-create-set')?.addEventListener('click', () => {
      this._showNewSetModal();
    });
  }

  // --------------------------------------------------------------------------
  // Table View
  // --------------------------------------------------------------------------

  _renderTableView() {
    const set = this.getCurrentSet();
    const records = this.getFilteredRecords();
    const fields = this._getVisibleFields();

    let html = `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-row-number">
                <input type="checkbox" class="row-checkbox" id="select-all">
              </th>
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
              <th class="col-add" id="add-column-btn">
                <i class="ph ph-plus"></i>
              </th>
            </tr>
          </thead>
          <tbody>
    `;

    if (records.length === 0) {
      html += `
        <tr>
          <td colspan="${fields.length + 2}" class="add-row-cell" id="add-first-record">
            <div class="add-row-content">
              <i class="ph ph-plus"></i>
              <span>Add your first record</span>
            </div>
          </td>
        </tr>
      `;
    } else {
      records.forEach((record, index) => {
        const isSelected = this.selectedRecords.has(record.id);
        html += `
          <tr data-record-id="${record.id}" class="${isSelected ? 'selected' : ''}">
            <td class="col-row-number">
              <input type="checkbox" class="row-checkbox"
                     data-record-id="${record.id}"
                     ${isSelected ? 'checked' : ''}>
            </td>
            ${fields.map(field => this._renderCell(record, field)).join('')}
            <td class="col-add"></td>
          </tr>
        `;
      });

      // Add row button at the end
      html += `
        <tr>
          <td class="col-row-number add-row-cell" id="add-row-btn">
            <i class="ph ph-plus"></i>
          </td>
          <td colspan="${fields.length + 1}" class="add-row-cell" id="add-row-cell">
            <div class="add-row-content">
              <span>Add record</span>
            </div>
          </td>
        </tr>
      `;
    }

    html += '</tbody></table></div>';

    this.elements.contentArea.innerHTML = html;
    this._attachTableEventListeners();
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

    // Delegated context menu for rows
    table.addEventListener('contextmenu', (e) => {
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

    // Store original content for cancel restoration (avoids full re-render)
    const originalContent = cell.innerHTML;
    this.editingCell = { cell, recordId, fieldId, originalContent, field };
    cell.classList.add('cell-editing');

    const currentValue = record.values[fieldId];

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

    // Use requestAnimationFrame for smoother update
    requestAnimationFrame(() => {
      this._updateCellDisplay(editingRef.cell, editingRef.recordId, editingRef.field);
    });
  }

  _cancelCellEdit() {
    if (!this.editingCell) return;

    const { cell, originalContent } = this.editingCell;
    this.editingCell = null;

    // Restore original content directly - no re-render needed
    requestAnimationFrame(() => {
      cell.innerHTML = originalContent;
      cell.classList.remove('cell-editing');
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

      default:
        return value ? this._escapeHtml(String(value)) : '<span class="cell-empty">-</span>';
    }
  }

  _updateCellValue(value) {
    if (!this.editingCell) return;
    const { recordId, fieldId } = this.editingCell;
    this._updateRecordValue(recordId, fieldId, value);
  }

  _updateRecordValue(recordId, fieldId, value) {
    const set = this.getCurrentSet();
    const record = set?.records.find(r => r.id === recordId);
    if (!record) return;

    // Create EO event for the change
    if (this.eoApp) {
      this._createEOEvent('record_updated', {
        recordId,
        fieldId,
        oldValue: record.values[fieldId],
        newValue: value
      });
    }

    record.values[fieldId] = value;
    record.updatedAt = new Date().toISOString();

    this._saveData();
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
    const records = this.getFilteredRecords();
    const fields = this._getVisibleFields();

    let html = '<div class="card-grid">';

    if (records.length === 0) {
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

      html += `
        <div class="kanban-column" data-column-id="${column.id || 'null'}">
          <div class="kanban-column-header">
            <div class="kanban-column-title">
              <span class="select-tag color-${column.color || 'gray'}">${this._escapeHtml(column.name)}</span>
              <span class="kanban-column-count">${columnRecords.length}</span>
            </div>
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
  // Graph View
  // --------------------------------------------------------------------------

  _renderGraphView() {
    this.elements.contentArea.innerHTML = `
      <div class="graph-container">
        <canvas class="graph-canvas" id="graph-canvas"></canvas>
        <div class="graph-controls">
          <button class="graph-control-btn" id="graph-zoom-in" title="Zoom In">
            <i class="ph ph-magnifying-glass-plus"></i>
          </button>
          <button class="graph-control-btn" id="graph-zoom-out" title="Zoom Out">
            <i class="ph ph-magnifying-glass-minus"></i>
          </button>
          <button class="graph-control-btn" id="graph-center" title="Center">
            <i class="ph ph-crosshair"></i>
          </button>
        </div>
      </div>
    `;

    // If we have the graph module, initialize it
    if (typeof initGraph === 'function') {
      const graph = initGraph('graph-canvas', this);
      this._graphInstance = graph;
    }
  }

  // --------------------------------------------------------------------------
  // Record Operations
  // --------------------------------------------------------------------------

  addRecord(values = {}) {
    const set = this.getCurrentSet();
    if (!set) return null;

    const record = createRecord(set.id, values);
    set.records.push(record);

    // Create EO event
    if (this.eoApp) {
      this._createEOEvent('record_created', { recordId: record.id, values });
    }

    this._saveData();
    this._renderView();

    return record;
  }

  deleteRecord(recordId) {
    const set = this.getCurrentSet();
    if (!set) return;

    const index = set.records.findIndex(r => r.id === recordId);
    if (index === -1) return;

    // Create EO event
    if (this.eoApp) {
      this._createEOEvent('record_deleted', { recordId, record: set.records[index] });
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

    menu.innerHTML = `
      <div class="context-menu-item" data-action="open">
        <i class="ph ph-arrow-square-out"></i>
        <span>Open record</span>
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
        const action = item.dataset.action;

        switch (action) {
          case 'open':
            this._showRecordDetail(recordId);
            break;
          case 'duplicate':
            this.duplicateRecord(recordId);
            break;
          case 'delete':
            this.deleteRecord(recordId);
            break;
        }
      });
    });
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
      'autonumber': 'Autonumber'
    };

    menu.innerHTML = `
      <div class="context-menu-item" data-action="rename">
        <i class="ph ph-pencil"></i>
        <span>Rename field</span>
      </div>
      <div class="context-menu-item" data-action="change-type">
        <i class="ph ${FieldTypeIcons[field.type]}"></i>
        <span>Change type (${typeNames[field.type] || field.type})</span>
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

    panel.classList.add('open');
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
        el.innerHTML = `<input type="${field.options?.includeTime ? 'datetime-local' : 'date'}" class="detail-editor" value="${currentValue || ''}">`;
        const dateEditor = el.querySelector('input');
        dateEditor.focus();
        dateEditor.addEventListener('change', () => {
          this._updateRecordValue(recordId, fieldId, dateEditor.value || null);
          el.classList.remove('editing');
          el.innerHTML = this._renderDetailFieldValue(field, dateEditor.value || null);
          this._renderView();
        });
        dateEditor.addEventListener('blur', () => {
          setTimeout(() => {
            el.classList.remove('editing');
            el.innerHTML = this._renderDetailFieldValue(field, record.values[fieldId]);
          }, 100);
        });
        break;

      case FieldTypes.LONG_TEXT:
        el.innerHTML = `<textarea class="detail-editor" rows="4">${this._escapeHtml(currentValue || '')}</textarea>`;
        const textareaEditor = el.querySelector('textarea');
        textareaEditor.focus();
        textareaEditor.addEventListener('blur', () => {
          this._updateRecordValue(recordId, fieldId, textareaEditor.value);
          el.classList.remove('editing');
          el.innerHTML = this._renderDetailFieldValue(field, textareaEditor.value);
          this._renderView();
        });
        break;

      default:
        el.innerHTML = `<input type="text" class="detail-editor" value="${this._escapeHtml(currentValue || '')}">`;
        const inputEditor = el.querySelector('input');
        inputEditor.focus();
        inputEditor.select();

        const saveInput = () => {
          this._updateRecordValue(recordId, fieldId, inputEditor.value);
          el.classList.remove('editing');
          el.innerHTML = this._renderDetailFieldValue(field, inputEditor.value);
          this._renderView();
        };

        inputEditor.addEventListener('blur', saveInput);
        inputEditor.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveInput();
          }
          if (e.key === 'Escape') {
            el.classList.remove('editing');
            el.innerHTML = this._renderDetailFieldValue(field, currentValue);
          }
        });
    }
  }

  // --------------------------------------------------------------------------
  // Filter & Sort Panels
  // --------------------------------------------------------------------------

  _showFilterPanel() {
    // TODO: Implement filter dropdown
    console.log('Show filter panel');
  }

  _showSortPanel() {
    // TODO: Implement sort dropdown
    console.log('Show sort panel');
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
    // Escape to close modals/menus
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

    // Ctrl + W to close current tab
    if ((e.metaKey || e.ctrlKey) && e.key === 'w' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      this._closeCurrentTab();
    }

    // Ctrl + Shift + T to reopen closed tab
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      this._reopenClosedTab();
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

    const selectedData = set.records.filter(r => this.selectedRecords.has(r.id));
    const exportData = {
      setName: set.name,
      fields: set.fields,
      records: selectedData,
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

  _showToast(message, type = 'info') {
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
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="ph ${icons[type] || 'ph-info'} toast-icon"></i>
      <span class="toast-message">${this._escapeHtml(message)}</span>
      <button class="toast-close"><i class="ph ph-x"></i></button>
    `;

    container.appendChild(toast);

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
      }
    }, 4000);
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
  // Deduplication Panel
  // --------------------------------------------------------------------------

  _toggleDedupePanel() {
    const panel = document.getElementById('dedupe-panel');
    if (!panel) return;

    if (panel.style.display === 'none') {
      this._showDedupePanel();
    } else {
      this._hideDedupePanel();
    }
  }

  _showDedupePanel() {
    // Hide other panels
    this._hideFilterPanel();
    this._hideSortPanel();

    const panel = document.getElementById('dedupe-panel');
    if (!panel) return;

    panel.style.display = 'block';

    // Populate fields
    this._populateDedupeFields();

    // Load current config
    const view = this.getCurrentView();
    const dedupeConfig = view?.config?.deduplication || { enabled: false, fields: [], strategy: 'newest', caseSensitive: false };

    // Set enable toggle
    const enabledCheckbox = document.getElementById('dedupe-enabled');
    if (enabledCheckbox) {
      enabledCheckbox.checked = dedupeConfig.enabled;
    }

    // Set strategy
    const strategySelect = document.getElementById('dedupe-strategy');
    if (strategySelect) {
      strategySelect.value = dedupeConfig.strategy || 'newest';
    }

    // Set case sensitive
    const caseSensitiveCheckbox = document.getElementById('dedupe-case-sensitive');
    if (caseSensitiveCheckbox) {
      caseSensitiveCheckbox.checked = dedupeConfig.caseSensitive || false;
    }

    // Check selected fields
    const selectedFields = dedupeConfig.fields || [];
    const fieldsContainer = document.getElementById('dedupe-fields');
    if (fieldsContainer) {
      fieldsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = selectedFields.includes(checkbox.value);
      });
    }
  }

  _hideDedupePanel() {
    const panel = document.getElementById('dedupe-panel');
    if (panel) {
      panel.style.display = 'none';
    }
  }

  _populateDedupeFields() {
    const container = document.getElementById('dedupe-fields');
    if (!container) return;

    const set = this.getCurrentSet();
    const fields = set?.fields || [];

    container.innerHTML = fields.map(field => `
      <label class="dedupe-field-item">
        <input type="checkbox" value="${field.id}">
        <i class="ph ${FieldTypeIcons[field.type] || 'ph-text-aa'} field-icon"></i>
        <span class="field-name">${this._escapeHtml(field.name)}</span>
      </label>
    `).join('');
  }

  _applyDeduplicationConfig() {
    const view = this.getCurrentView();
    if (!view) return;

    // Ensure deduplication config exists
    if (!view.config.deduplication) {
      view.config.deduplication = {
        enabled: false,
        fields: [],
        strategy: 'newest',
        caseSensitive: false
      };
    }

    // Get enabled state
    const enabledCheckbox = document.getElementById('dedupe-enabled');
    view.config.deduplication.enabled = enabledCheckbox?.checked || false;

    // Get selected fields
    const fieldsContainer = document.getElementById('dedupe-fields');
    const selectedFields = [];
    if (fieldsContainer) {
      fieldsContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
        selectedFields.push(checkbox.value);
      });
    }
    view.config.deduplication.fields = selectedFields;

    // Get strategy
    const strategySelect = document.getElementById('dedupe-strategy');
    view.config.deduplication.strategy = strategySelect?.value || 'newest';

    // Get case sensitive
    const caseSensitiveCheckbox = document.getElementById('dedupe-case-sensitive');
    view.config.deduplication.caseSensitive = caseSensitiveCheckbox?.checked || false;

    this._hideDedupePanel();
    this._renderView();
    this._saveData();

    if (view.config.deduplication.enabled && selectedFields.length > 0) {
      const originalCount = this.getCurrentSet()?.records?.length || 0;
      const filteredCount = this.getFilteredRecords().length;
      const deduped = originalCount - filteredCount;
      if (deduped > 0) {
        this._showToast(`Deduplication active: ${deduped} duplicate${deduped !== 1 ? 's' : ''} hidden`, 'info');
      } else {
        this._showToast('Deduplication enabled (no duplicates found)', 'info');
      }
    } else if (!view.config.deduplication.enabled) {
      this._showToast('Deduplication disabled', 'info');
    } else {
      this._showToast('Select at least one field for deduplication', 'warning');
    }
  }

  _clearDeduplicationConfig() {
    const view = this.getCurrentView();
    if (view && view.config.deduplication) {
      view.config.deduplication = {
        enabled: false,
        fields: [],
        strategy: 'newest',
        caseSensitive: false
      };
    }

    // Reset UI
    const enabledCheckbox = document.getElementById('dedupe-enabled');
    if (enabledCheckbox) enabledCheckbox.checked = false;

    const fieldsContainer = document.getElementById('dedupe-fields');
    if (fieldsContainer) {
      fieldsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
      });
    }

    const strategySelect = document.getElementById('dedupe-strategy');
    if (strategySelect) strategySelect.value = 'newest';

    const caseSensitiveCheckbox = document.getElementById('dedupe-case-sensitive');
    if (caseSensitiveCheckbox) caseSensitiveCheckbox.checked = false;

    this._hideDedupePanel();
    this._renderView();
    this._saveData();

    this._showToast('Deduplication disabled', 'info');
  }

  // --------------------------------------------------------------------------
  // Global Search
  // --------------------------------------------------------------------------

  _handleSearch(query) {
    if (!query || query.length < 2) {
      this._hideSearchResults();
      return;
    }

    const results = [];
    const lowerQuery = query.toLowerCase();

    // Search across all sets and records
    this.sets.forEach(set => {
      // Search set name
      if (set.name.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'set', id: set.id, name: set.name, icon: 'ph-table' });
      }

      // Search records
      set.records.forEach(record => {
        const primaryField = set.fields.find(f => f.isPrimary) || set.fields[0];
        const primaryValue = record.values[primaryField?.id];

        if (primaryValue && String(primaryValue).toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'record',
            id: record.id,
            setId: set.id,
            name: primaryValue,
            setName: set.name,
            icon: 'ph-note'
          });
        }
      });
    });

    this._renderSearchResults(results.slice(0, 10));
  }

  _renderSearchResults(results) {
    let dropdown = document.querySelector('.search-results-dropdown');

    if (results.length === 0) {
      if (dropdown) dropdown.remove();
      return;
    }

    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'search-results-dropdown';
      document.querySelector('.sidebar-search')?.appendChild(dropdown);
    }

    dropdown.innerHTML = results.map(r => `
      <div class="search-result-item" data-type="${r.type}" data-id="${r.id}" data-set-id="${r.setId || ''}">
        <i class="ph ${r.icon}"></i>
        <span class="result-title">${this._escapeHtml(r.name)}</span>
        <span class="result-type">${r.type}${r.setName ? ` · ${this._escapeHtml(r.setName)}` : ''}</span>
      </div>
    `).join('');

    dropdown.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const type = item.dataset.type;
        if (type === 'set') {
          this._selectSet(item.dataset.id);
        } else if (type === 'record') {
          if (item.dataset.setId) {
            this._selectSet(item.dataset.setId);
          }
          this._showRecordDetail(item.dataset.id);
        }
        this._hideSearchResults();
        document.getElementById('global-search').value = '';
      });
    });
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
