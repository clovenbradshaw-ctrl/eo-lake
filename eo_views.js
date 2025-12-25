/**
 * EO Views - Advanced View Management System
 *
 * Provides multiple view types for exploring Experience Engine data:
 * - Table View: Spreadsheet-like grid with sorting and filtering
 * - Card View: Visual cards for entity browsing
 * - Timeline View: Chronological event visualization
 * - Kanban View: Status-based board layout
 *
 * COMPLIANCE NOTES:
 * - All views are DERIVED from the event log - read-only presentations
 * - View configurations are stored as Meant events (interpretations of how to see data)
 * - User actions in views create new events through proper channels
 * - Views respect horizon-mediated access (Rule 4)
 */

/**
 * View types
 */
const ViewType = Object.freeze({
  TABLE: 'table',
  CARD: 'card',
  TIMELINE: 'timeline',
  KANBAN: 'kanban',
  GRAPH: 'graph'
});

/**
 * Column types for table view
 */
const ColumnType = Object.freeze({
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  SELECT: 'select',
  MULTISELECT: 'multiselect',
  CHECKBOX: 'checkbox',
  REFERENCE: 'reference',
  FORMULA: 'formula'
});

/**
 * Sort direction
 */
const SortDirection = Object.freeze({
  ASC: 'asc',
  DESC: 'desc'
});

/**
 * Filter operators
 */
const FilterOperator = Object.freeze({
  EQUALS: 'equals',
  NOT_EQUALS: 'not_equals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not_contains',
  STARTS_WITH: 'starts_with',
  ENDS_WITH: 'ends_with',
  GREATER_THAN: 'greater_than',
  LESS_THAN: 'less_than',
  IS_EMPTY: 'is_empty',
  IS_NOT_EMPTY: 'is_not_empty'
});

/**
 * View Column Definition
 */
class ViewColumn {
  constructor(options) {
    this.id = options.id || 'col_' + Date.now();
    this.field = options.field;
    this.label = options.label || options.field;
    this.type = options.type || ColumnType.TEXT;
    this.width = options.width || 150;
    this.visible = options.visible !== false;
    this.sortable = options.sortable !== false;
    this.filterable = options.filterable !== false;
    this.formula = options.formula || null;
    this.options = options.options || [];  // For select types
  }

  getValue(entity) {
    if (this.formula) {
      return this._evaluateFormula(entity);
    }

    // Navigate nested paths
    const parts = this.field.split('.');
    let value = entity;
    for (const part of parts) {
      if (value == null) return null;
      value = value[part];
    }
    return value;
  }

  _evaluateFormula(entity) {
    try {
      // Simple formula evaluation
      // Supports: field references, basic math, string operations
      const formula = this.formula;

      // Replace field references with values
      const processed = formula.replace(/\{([^}]+)\}/g, (match, field) => {
        const parts = field.split('.');
        let value = entity;
        for (const part of parts) {
          if (value == null) return 'null';
          value = value[part];
        }
        return typeof value === 'string' ? `"${value}"` : value;
      });

      // Safe evaluation (limited)
      return this._safeEval(processed);
    } catch (e) {
      return '#ERROR';
    }
  }

  _safeEval(expr) {
    // Only allow safe operations
    const safePattern = /^[\d\s+\-*/().,"'\w]+$/;
    if (!safePattern.test(expr)) {
      return '#UNSAFE';
    }

    try {
      return Function('"use strict"; return (' + expr + ')')();
    } catch (e) {
      return '#ERROR';
    }
  }

  format(value) {
    if (value == null) return '';

    switch (this.type) {
      case ColumnType.DATE:
        return new Date(value).toLocaleDateString();
      case ColumnType.NUMBER:
        return typeof value === 'number' ? value.toLocaleString() : value;
      case ColumnType.CHECKBOX:
        return value ? '✓' : '';
      case ColumnType.MULTISELECT:
        return Array.isArray(value) ? value.join(', ') : value;
      default:
        return String(value);
    }
  }
}

/**
 * View Filter
 */
class ViewFilter {
  constructor(options) {
    this.id = options.id || 'filter_' + Date.now();
    this.field = options.field;
    this.operator = options.operator || FilterOperator.CONTAINS;
    this.value = options.value;
    this.enabled = options.enabled !== false;
  }

  matches(entity) {
    if (!this.enabled) return true;

    const fieldValue = this._getFieldValue(entity);
    const filterValue = this.value;

    switch (this.operator) {
      case FilterOperator.EQUALS:
        return fieldValue === filterValue;

      case FilterOperator.NOT_EQUALS:
        return fieldValue !== filterValue;

      case FilterOperator.CONTAINS:
        return String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase());

      case FilterOperator.NOT_CONTAINS:
        return !String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase());

      case FilterOperator.STARTS_WITH:
        return String(fieldValue).toLowerCase().startsWith(String(filterValue).toLowerCase());

      case FilterOperator.ENDS_WITH:
        return String(fieldValue).toLowerCase().endsWith(String(filterValue).toLowerCase());

      case FilterOperator.GREATER_THAN:
        return Number(fieldValue) > Number(filterValue);

      case FilterOperator.LESS_THAN:
        return Number(fieldValue) < Number(filterValue);

      case FilterOperator.IS_EMPTY:
        return fieldValue == null || fieldValue === '';

      case FilterOperator.IS_NOT_EMPTY:
        return fieldValue != null && fieldValue !== '';

      default:
        return true;
    }
  }

  _getFieldValue(entity) {
    const parts = this.field.split('.');
    let value = entity;
    for (const part of parts) {
      if (value == null) return null;
      value = value[part];
    }
    return value;
  }
}

/**
 * View Sort
 */
class ViewSort {
  constructor(field, direction = SortDirection.ASC) {
    this.field = field;
    this.direction = direction;
  }

  compare(a, b) {
    const valueA = this._getFieldValue(a);
    const valueB = this._getFieldValue(b);

    let result = 0;
    if (valueA == null && valueB == null) result = 0;
    else if (valueA == null) result = 1;
    else if (valueB == null) result = -1;
    else if (typeof valueA === 'number' && typeof valueB === 'number') {
      result = valueA - valueB;
    } else {
      result = String(valueA).localeCompare(String(valueB));
    }

    return this.direction === SortDirection.DESC ? -result : result;
  }

  _getFieldValue(entity) {
    const parts = this.field.split('.');
    let value = entity;
    for (const part of parts) {
      if (value == null) return null;
      value = value[part];
    }
    return value;
  }
}

/**
 * View Configuration
 */
class ViewConfig {
  constructor(options) {
    this.id = options.id || 'view_' + Date.now();
    this.name = options.name || 'Untitled View';
    this.type = options.type || ViewType.TABLE;
    this.entityType = options.entityType || null;
    this.columns = (options.columns || []).map(c => new ViewColumn(c));
    this.filters = (options.filters || []).map(f => new ViewFilter(f));
    this.sorts = (options.sorts || []).map(s => new ViewSort(s.field, s.direction));
    this.groupBy = options.groupBy || null;
    this.settings = options.settings || {};
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      entityType: this.entityType,
      columns: this.columns.map(c => ({
        id: c.id,
        field: c.field,
        label: c.label,
        type: c.type,
        width: c.width,
        visible: c.visible,
        formula: c.formula
      })),
      filters: this.filters.map(f => ({
        id: f.id,
        field: f.field,
        operator: f.operator,
        value: f.value,
        enabled: f.enabled
      })),
      sorts: this.sorts.map(s => ({
        field: s.field,
        direction: s.direction
      })),
      groupBy: this.groupBy,
      settings: this.settings
    };
  }
}

/**
 * View Manager - Manages view configurations and rendering
 */
class EOViewManager {
  constructor(app) {
    this.app = app;
    this.views = new Map();
    this.activeViewId = null;
    this.container = null;

    // Default views
    this._createDefaultViews();
  }

  /**
   * Create default views
   */
  _createDefaultViews() {
    // Event Log Table
    this.views.set('event_log', new ViewConfig({
      id: 'event_log',
      name: 'Event Log',
      type: ViewType.TABLE,
      columns: [
        { field: 'type', label: 'Type', type: ColumnType.SELECT, width: 80 },
        { field: 'actor', label: 'Actor', type: ColumnType.TEXT, width: 120 },
        { field: 'timestamp', label: 'Time', type: ColumnType.DATE, width: 150 },
        { field: 'payload.action', label: 'Action', type: ColumnType.TEXT, width: 120 },
        { field: 'payload.content', label: 'Content', type: ColumnType.TEXT, width: 300 }
      ]
    }));

    // Entity Cards
    this.views.set('entity_cards', new ViewConfig({
      id: 'entity_cards',
      name: 'Entities',
      type: ViewType.CARD,
      settings: {
        titleField: 'data.title',
        descriptionField: 'data.description',
        imageField: 'data.image'
      }
    }));

    // Timeline
    this.views.set('timeline', new ViewConfig({
      id: 'timeline',
      name: 'Timeline',
      type: ViewType.TIMELINE,
      settings: {
        dateField: 'timestamp',
        labelField: 'payload.action'
      }
    }));

    // Kanban (for entities with status)
    this.views.set('kanban', new ViewConfig({
      id: 'kanban',
      name: 'Board',
      type: ViewType.KANBAN,
      settings: {
        statusField: 'data.status',
        columns: ['todo', 'in_progress', 'done']
      }
    }));
  }

  /**
   * Set the container element
   */
  setContainer(container) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
  }

  /**
   * Get a view by ID
   */
  getView(viewId) {
    return this.views.get(viewId);
  }

  /**
   * Get all views
   */
  getAllViews() {
    return Array.from(this.views.values());
  }

  /**
   * Create a new view
   */
  createView(options) {
    const view = new ViewConfig(options);
    this.views.set(view.id, view);

    // Store as a Meant event (view configuration is an interpretation)
    this._persistViewConfig(view);

    return view;
  }

  /**
   * Update a view
   */
  updateView(viewId, updates) {
    const view = this.views.get(viewId);
    if (!view) return null;

    Object.assign(view, updates);
    this._persistViewConfig(view);

    return view;
  }

  /**
   * Delete a view
   */
  deleteView(viewId) {
    this.views.delete(viewId);
  }

  /**
   * Set active view
   */
  setActiveView(viewId) {
    this.activeViewId = viewId;
    this.render();
  }

  /**
   * Persist view configuration as a Meant event
   */
  _persistViewConfig(view) {
    // Views are interpretations of how to see data
    // They require provenance in the system's existence
    const givenEvents = this.app.getGivenEvents();
    if (givenEvents.length === 0) return;

    this.app.recordMeant(
      'view_configuration',
      { viewConfig: view.toJSON() },
      [givenEvents[0].id],  // Ground in first system event
      { epistemicStatus: EpistemicStatus.PRELIMINARY }
    );
  }

  /**
   * Get data for the current view
   */
  getData() {
    const view = this.views.get(this.activeViewId);
    if (!view) return [];

    // Get data through horizon gate
    let data;
    if (view.type === ViewType.TABLE && view.id === 'event_log') {
      data = this.app.getEventLog();
    } else {
      data = this.app.getEntities();
    }

    // Apply filters
    for (const filter of view.filters) {
      data = data.filter(item => filter.matches(item));
    }

    // Apply sorting
    if (view.sorts.length > 0) {
      data.sort((a, b) => {
        for (const sort of view.sorts) {
          const result = sort.compare(a, b);
          if (result !== 0) return result;
        }
        return 0;
      });
    }

    // Apply grouping if needed
    if (view.groupBy) {
      data = this._groupData(data, view.groupBy);
    }

    return data;
  }

  /**
   * Group data by a field
   */
  _groupData(data, field) {
    const groups = new Map();

    for (const item of data) {
      const parts = field.split('.');
      let value = item;
      for (const part of parts) {
        if (value == null) break;
        value = value[part];
      }

      const key = value == null ? '(empty)' : String(value);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    }

    return groups;
  }

  /**
   * Render the current view
   */
  render() {
    if (!this.container) return;

    const view = this.views.get(this.activeViewId);
    if (!view) {
      this.container.innerHTML = '<div class="empty-state">No view selected</div>';
      return;
    }

    const data = this.getData();

    switch (view.type) {
      case ViewType.TABLE:
        this._renderTable(view, data);
        break;
      case ViewType.CARD:
        this._renderCards(view, data);
        break;
      case ViewType.TIMELINE:
        this._renderTimeline(view, data);
        break;
      case ViewType.KANBAN:
        this._renderKanban(view, data);
        break;
      default:
        this.container.innerHTML = '<div class="empty-state">Unknown view type</div>';
    }
  }

  /**
   * Render table view
   */
  _renderTable(view, data) {
    const visibleColumns = view.columns.filter(c => c.visible);

    let html = `
      <div class="view-table-wrapper">
        <table class="view-table">
          <thead>
            <tr>
              ${visibleColumns.map(col => `
                <th style="width: ${col.width}px" data-field="${col.field}">
                  <div class="th-content">
                    <span>${this._escapeHtml(col.label)}</span>
                    ${col.sortable ? '<span class="sort-indicator"></span>' : ''}
                  </div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    if (data.length === 0) {
      html += `
        <tr>
          <td colspan="${visibleColumns.length}" class="empty-cell">
            No data to display
          </td>
        </tr>
      `;
    } else {
      for (const item of data) {
        html += `<tr data-id="${item.id}">`;
        for (const col of visibleColumns) {
          const value = col.getValue(item);
          const formatted = col.format(value);
          html += `<td class="cell-${col.type}">${this._escapeHtml(formatted)}</td>`;
        }
        html += '</tr>';
      }
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    this.container.innerHTML = html;
    this._attachTableEvents();
  }

  /**
   * Render card view
   */
  _renderCards(view, data) {
    const settings = view.settings || {};
    const titleField = settings.titleField || 'data.title';
    const descField = settings.descriptionField || 'data.description';

    if (data.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-title">No items</div>
        </div>
      `;
      return;
    }

    let html = '<div class="view-cards">';

    for (const item of data) {
      const title = this._getNestedValue(item, titleField) || item.id;
      const desc = this._getNestedValue(item, descField) || '';

      html += `
        <div class="view-card" data-id="${item.id}">
          <div class="view-card-header">
            <span class="view-card-type">${item.type || 'item'}</span>
          </div>
          <div class="view-card-title">${this._escapeHtml(String(title))}</div>
          <div class="view-card-desc">${this._escapeHtml(String(desc).substring(0, 100))}</div>
          <div class="view-card-footer">
            <span class="view-card-meta">v${item.version || 0}</span>
          </div>
        </div>
      `;
    }

    html += '</div>';
    this.container.innerHTML = html;
  }

  /**
   * Render timeline view
   */
  _renderTimeline(view, data) {
    const settings = view.settings || {};
    const dateField = settings.dateField || 'timestamp';
    const labelField = settings.labelField || 'payload.action';

    // Sort by date
    const sorted = [...data].sort((a, b) => {
      const dateA = new Date(this._getNestedValue(a, dateField) || 0);
      const dateB = new Date(this._getNestedValue(b, dateField) || 0);
      return dateB - dateA;
    });

    if (sorted.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-title">No events</div>
        </div>
      `;
      return;
    }

    let html = '<div class="view-timeline">';

    for (const item of sorted) {
      const date = new Date(this._getNestedValue(item, dateField) || 0);
      const label = this._getNestedValue(item, labelField) || 'Event';
      const typeClass = item.type === 'given' ? 'given' : 'meant';

      html += `
        <div class="timeline-item ${typeClass}" data-id="${item.id}">
          <div class="timeline-marker"></div>
          <div class="timeline-content">
            <div class="timeline-time">${date.toLocaleString()}</div>
            <div class="timeline-label">${this._escapeHtml(String(label))}</div>
            <div class="timeline-actor">${item.actor || ''}</div>
          </div>
        </div>
      `;
    }

    html += '</div>';
    this.container.innerHTML = html;
  }

  /**
   * Render kanban view
   */
  _renderKanban(view, data) {
    const settings = view.settings || {};
    const statusField = settings.statusField || 'data.status';
    const columns = settings.columns || ['todo', 'in_progress', 'done'];

    // Group by status
    const groups = new Map();
    for (const col of columns) {
      groups.set(col, []);
    }
    groups.set('_other_', []);

    for (const item of data) {
      const status = this._getNestedValue(item, statusField) || '_other_';
      if (groups.has(status)) {
        groups.get(status).push(item);
      } else {
        groups.get('_other_').push(item);
      }
    }

    let html = '<div class="view-kanban">';

    for (const col of columns) {
      const items = groups.get(col) || [];
      html += `
        <div class="kanban-column" data-status="${col}">
          <div class="kanban-column-header">
            <span class="kanban-column-title">${this._formatStatus(col)}</span>
            <span class="kanban-column-count">${items.length}</span>
          </div>
          <div class="kanban-column-body">
      `;

      for (const item of items) {
        const title = this._getNestedValue(item, 'data.title') || item.id;
        html += `
          <div class="kanban-card" data-id="${item.id}" draggable="true">
            <div class="kanban-card-title">${this._escapeHtml(String(title))}</div>
          </div>
        `;
      }

      html += '</div></div>';
    }

    html += '</div>';
    this.container.innerHTML = html;
    this._attachKanbanEvents();
  }

  /**
   * Attach table events
   */
  _attachTableEvents() {
    // Sorting
    this.container.querySelectorAll('th[data-field]').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.field;
        this._toggleSort(field);
      });
    });

    // Row selection
    this.container.querySelectorAll('tbody tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        const id = tr.dataset.id;
        this._onItemSelect(id);
      });
    });
  }

  /**
   * Attach kanban events
   */
  _attachKanbanEvents() {
    const cards = this.container.querySelectorAll('.kanban-card');

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });
    });

    const columns = this.container.querySelectorAll('.kanban-column-body');

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

        const itemId = e.dataTransfer.getData('text/plain');
        const newStatus = column.parentElement.dataset.status;
        this._onStatusChange(itemId, newStatus);
      });
    });
  }

  /**
   * Toggle sort on a field
   */
  _toggleSort(field) {
    const view = this.views.get(this.activeViewId);
    if (!view) return;

    const existingSort = view.sorts.find(s => s.field === field);

    if (existingSort) {
      if (existingSort.direction === SortDirection.ASC) {
        existingSort.direction = SortDirection.DESC;
      } else {
        view.sorts = view.sorts.filter(s => s.field !== field);
      }
    } else {
      view.sorts = [new ViewSort(field, SortDirection.ASC)];
    }

    this.render();
  }

  /**
   * Handle item selection
   */
  _onItemSelect(id) {
    const bus = getEventBus ? getEventBus() : null;
    if (bus) {
      bus.emit(BusEventType.SELECTION_CHANGED, { id });
    }
  }

  /**
   * Handle status change (for kanban)
   */
  _onStatusChange(itemId, newStatus) {
    // Create a new Given event for the status change
    this.app.updateEntityField(itemId, 'status', newStatus);
    this.render();
  }

  /**
   * Get nested value from object
   */
  _getNestedValue(obj, path) {
    const parts = path.split('.');
    let value = obj;
    for (const part of parts) {
      if (value == null) return null;
      value = value[part];
    }
    return value;
  }

  /**
   * Format status for display
   */
  _formatStatus(status) {
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Escape HTML
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Singleton
let _viewManager = null;

function getViewManager() {
  return _viewManager;
}

function initViewManager(app) {
  _viewManager = new EOViewManager(app);
  return _viewManager;
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ViewType,
    ColumnType,
    SortDirection,
    FilterOperator,
    ViewColumn,
    ViewFilter,
    ViewSort,
    ViewConfig,
    EOViewManager,
    getViewManager,
    initViewManager
  };
}

if (typeof window !== 'undefined') {
  window.ViewType = ViewType;
  window.ColumnType = ColumnType;
  window.SortDirection = SortDirection;
  window.FilterOperator = FilterOperator;
  window.ViewColumn = ViewColumn;
  window.ViewFilter = ViewFilter;
  window.ViewSort = ViewSort;
  window.ViewConfig = ViewConfig;
  window.EOViewManager = EOViewManager;
  window.getViewManager = getViewManager;
  window.initViewManager = initViewManager;
}
