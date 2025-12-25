/**
 * EO Lake - Data Workbench
 * Airtable-style data management with EO sync principles
 *
 * Core Concepts:
 * - Sets: Collections of records (like Airtable bases/tables)
 * - Views: Different ways to visualize a Set (Table, Cards, Kanban, etc.)
 * - Records: Individual data entries with typed fields
 * - Fields: Typed columns with various data types
 *
 * EO Integration:
 * - All record operations create Given events (raw data)
 * - Computed fields and derivations create Meant events (interpretations)
 * - Full provenance tracking for all changes
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
      field.options.precision = options.precision || 0;
      field.options.format = options.format || 'number'; // number, currency, percent
      break;
    case FieldTypes.DATE:
      field.options.includeTime = options.includeTime || false;
      field.options.format = options.format || 'local';
      break;
    case FieldTypes.LINK:
      field.options.linkedSetId = options.linkedSetId || null;
      field.options.allowMultiple = options.allowMultiple || false;
      break;
    case FieldTypes.FORMULA:
      field.options.formula = options.formula || '';
      break;
    case FieldTypes.ROLLUP:
      field.options.linkedFieldId = options.linkedFieldId || null;
      field.options.rollupFieldId = options.rollupFieldId || null;
      field.options.aggregation = options.aggregation || 'SUM';
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

    // State
    this.sets = [];
    this.currentSetId = null;
    this.currentViewId = null;
    this.selectedRecords = new Set();
    this.editingCell = null;
    this.clipboard = null;

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

    // Load persisted data
    this._loadData();

    // If no sets exist, create a default one
    if (this.sets.length === 0) {
      this._createDefaultSet();
    }

    // Set current set and view
    if (!this.currentSetId && this.sets.length > 0) {
      this.currentSetId = this.sets[0].id;
      this.currentViewId = this.sets[0].views[0]?.id;
    }

    // Bind elements
    this._bindElements();

    // Attach event listeners
    this._attachEventListeners();

    // Render initial UI
    this._renderSidebar();
    this._renderView();

    // Update status
    this._updateStatus();

    console.log('EO Data Workbench initialized');
    return this;
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
      currentViewName: document.getElementById('current-view-name')
    };
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

    // Filter/Sort buttons
    document.getElementById('btn-filter')?.addEventListener('click', () => this._showFilterPanel());
    document.getElementById('btn-sort')?.addEventListener('click', () => this._showSortPanel());
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
    this._renderSetsNav();
    this._renderViewsNav();
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
    const set = this.getCurrentSet();
    const view = this.getCurrentView();

    if (this.elements.currentSetName) {
      this.elements.currentSetName.textContent = set?.name || 'No Set';
    }
    if (this.elements.currentViewName) {
      this.elements.currentViewName.textContent = view?.name || 'No View';
    }
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
        content = value ? this._escapeHtml(String(value)) : '<span class="cell-empty">-</span>';
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
    // Select all checkbox
    document.getElementById('select-all')?.addEventListener('change', (e) => {
      const set = this.getCurrentSet();
      if (!set) return;

      if (e.target.checked) {
        set.records.forEach(r => this.selectedRecords.add(r.id));
      } else {
        this.selectedRecords.clear();
      }

      this._renderTableView();
    });

    // Row checkboxes
    document.querySelectorAll('.row-checkbox[data-record-id]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const recordId = e.target.dataset.recordId;
        if (e.target.checked) {
          this.selectedRecords.add(recordId);
        } else {
          this.selectedRecords.delete(recordId);
        }
        this._updateStatus();

        // Update row highlight
        const row = e.target.closest('tr');
        row?.classList.toggle('selected', e.target.checked);
      });
    });

    // Cell click for editing
    document.querySelectorAll('.data-table td.cell-editable').forEach(cell => {
      cell.addEventListener('dblclick', (e) => {
        this._startCellEdit(cell);
      });
    });

    // Checkbox cells - single click to toggle
    document.querySelectorAll('.cell-checkbox').forEach(cell => {
      const td = cell.closest('td');
      td?.addEventListener('click', () => {
        const recordId = td.closest('tr')?.dataset.recordId;
        const fieldId = td.dataset.fieldId;
        if (recordId && fieldId) {
          this._toggleCheckbox(recordId, fieldId);
        }
      });
    });

    // Row click for detail panel
    document.querySelectorAll('.data-table tbody tr[data-record-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox' || e.target.closest('.cell-editing')) return;
        this._showRecordDetail(row.dataset.recordId);
      });

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showRecordContextMenu(e, row.dataset.recordId);
      });
    });

    // Add record buttons
    document.getElementById('add-row-btn')?.addEventListener('click', () => this.addRecord());
    document.getElementById('add-row-cell')?.addEventListener('click', () => this.addRecord());
    document.getElementById('add-first-record')?.addEventListener('click', () => this.addRecord());

    // Add column button
    document.getElementById('add-column-btn')?.addEventListener('click', (e) => {
      this._showFieldTypePicker(e);
    });

    // Field header dropdowns
    document.querySelectorAll('.th-dropdown').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const th = btn.closest('th');
        this._showFieldContextMenu(e, th.dataset.fieldId);
      });
    });

    // Column resize handles
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

    this.editingCell = { cell, recordId, fieldId };
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
    const tag = isLongText ? 'textarea' : 'input';

    cell.innerHTML = `<${tag} type="text" class="cell-input">${value || ''}</${tag}>`;

    const input = cell.querySelector('.cell-input');
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

    const { cell, recordId, fieldId } = this.editingCell;
    const input = cell.querySelector('.cell-input');

    if (input) {
      const newValue = input.value;
      this._updateRecordValue(recordId, fieldId, newValue);
    }

    this.editingCell = null;
    this._renderTableView();
  }

  _cancelCellEdit() {
    if (!this.editingCell) return;
    this.editingCell = null;
    this._renderTableView();
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
    if (!record) return;

    const currentValue = record.values[fieldId];
    this._updateRecordValue(recordId, fieldId, !currentValue);
    this._renderTableView();
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

    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
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

    menu.innerHTML = `
      <div class="context-menu-item" data-action="rename">
        <i class="ph ph-pencil"></i>
        <span>Rename field</span>
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

    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    menu.classList.add('active');

    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        menu.classList.remove('active');
        const action = item.dataset.action;

        switch (action) {
          case 'rename':
            this._showRenameFieldModal(fieldId);
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

    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
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

    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    menu.classList.add('active');
  }

  // --------------------------------------------------------------------------
  // Field Type Picker
  // --------------------------------------------------------------------------

  _showFieldTypePicker(e) {
    const picker = this.elements.fieldTypePicker;
    if (!picker) return;

    const rect = e.target.closest('th, button').getBoundingClientRect();
    picker.style.left = rect.left + 'px';
    picker.style.top = (rect.bottom + 4) + 'px';
    picker.classList.add('active');

    picker.querySelectorAll('.field-type-item').forEach(item => {
      item.addEventListener('click', () => {
        picker.classList.remove('active');
        const type = item.dataset.type;
        this._addField(type);
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
    this._showModal('Create New View', `
      <div class="form-group">
        <label class="form-label">View Name</label>
        <input type="text" class="form-input" id="new-view-name" placeholder="My View">
      </div>
      <div class="form-group">
        <label class="form-label">View Type</label>
        <select class="form-select" id="new-view-type">
          <option value="table">Table</option>
          <option value="cards">Cards</option>
          <option value="kanban">Kanban</option>
          <option value="calendar">Calendar</option>
          <option value="graph">Graph</option>
        </select>
      </div>
    `, () => {
      const name = document.getElementById('new-view-name')?.value || 'New View';
      const type = document.getElementById('new-view-type')?.value || 'table';

      const set = this.getCurrentSet();
      if (!set) return;

      const view = createView(name, type);
      set.views.push(view);
      this.currentViewId = view.id;

      this._saveData();
      this._renderViewsNav();
      this._renderView();
      this._updateBreadcrumb();
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

    const fields = set.fields;
    const primaryField = fields.find(f => f.isPrimary) || fields[0];
    const title = record.values[primaryField?.id] || 'Untitled';

    body.innerHTML = `
      <div class="detail-record">
        <h2 style="font-size: 18px; margin-bottom: 16px;">${this._escapeHtml(title)}</h2>
        ${fields.map(field => {
          const value = record.values[field.id];
          return `
            <div class="form-group">
              <label class="form-label">
                <i class="ph ${FieldTypeIcons[field.type]}" style="margin-right: 4px;"></i>
                ${this._escapeHtml(field.name)}
              </label>
              <div class="detail-value">${this._formatCellValueSimple(value, field)}</div>
            </div>
          `;
        }).join('')}
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-primary);">
          <div style="font-size: 11px; color: var(--text-muted);">
            Created: ${new Date(record.createdAt).toLocaleString()}<br>
            Updated: ${new Date(record.updatedAt).toLocaleString()}
          </div>
        </div>
      </div>
    `;

    panel.classList.add('open');
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
  }

  // --------------------------------------------------------------------------
  // Keyboard Shortcuts
  // --------------------------------------------------------------------------

  _handleKeyDown(e) {
    // Escape to close modals/menus
    if (e.key === 'Escape') {
      this._closeModal();
      this.elements.contextMenu?.classList.remove('active');
      this.elements.fieldTypePicker?.classList.remove('active');
      this.elements.detailPanel?.classList.remove('open');

      if (this.editingCell) {
        this._cancelCellEdit();
      }
    }

    // Cmd/Ctrl + N for new record
    if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      this.addRecord();
    }

    // Delete selected records
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('input, textarea')) {
      if (this.selectedRecords.size > 0) {
        e.preventDefault();
        this.selectedRecords.forEach(id => this.deleteRecord(id));
      }
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
      this.eoApp.recordExperience({
        type: 'given',
        payload: {
          action,
          ...data
        }
      });
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
