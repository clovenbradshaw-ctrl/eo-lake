/**
 * Noema Unified Nested Lens
 *
 * Implements the unified nested data specification for viewing nested data
 * with toggle between embedded and normalized views.
 *
 * Core Concepts:
 * - One source of truth, two structural views
 * - Embedded View: All data in one table, nested data in cells
 * - Normalized View: Nested arrays become their own linked tables
 * - Hybrid View: User-selected mix of embedded and normalized
 *
 * The data never changes structure. Only the *lens* changes.
 *
 * EO Alignment:
 * - Source data is GIVEN (immutable)
 * - Structure views are MEANT (interpretations)
 * - Normalization creates derived Sets with provenance
 */

// ============================================================================
// Constants & Types
// ============================================================================

const StructureModes = Object.freeze({
  EMBEDDED: 'embedded',
  HYBRID: 'hybrid',
  NORMALIZED: 'normalized'
});

const CellDisplayTypes = Object.freeze({
  SUMMARY: 'summary',
  CHIPS: 'chips',
  INLINE_TABLE: 'inlineTable',
  LINK: 'link'
});

const TableRelationship = Object.freeze({
  ROOT: 'root',
  CHILD: 'child'
});

// ============================================================================
// UnifiedNestedLensManager
// ============================================================================

/**
 * Main controller for the Unified Nested Data Lens feature.
 * Manages the toggle between embedded/normalized views and coordinates
 * the rendering of linked tables.
 */
class UnifiedNestedLensManager {
  constructor(workbench, options = {}) {
    this.workbench = workbench;
    this.options = {
      container: null,
      onTableChange: null,
      onStructureChange: null,
      ...options
    };

    // State
    this.state = {
      structureMode: StructureModes.EMBEDDED,
      currentTable: null,
      filter: null,
      selectedRow: null,
      detailOpen: false,
      normalizedFields: new Map(), // fieldId -> { targetSetId, syncMode }
      viewMode: 'summary', // summary, chips, table
      breadcrumb: []
    };

    // Derived tables (created during normalization)
    this.derivedTables = new Map(); // setId -> { parentSetId, parentFieldId, records }

    // Bind methods
    this._handleStructureToggle = this._handleStructureToggle.bind(this);
    this._handleTableSelect = this._handleTableSelect.bind(this);
    this._handleCellClick = this._handleCellClick.bind(this);
    this._handleFilterClear = this._handleFilterClear.bind(this);
    this._handleBreadcrumbClick = this._handleBreadcrumbClick.bind(this);
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the lens manager with a source set
   */
  initialize(sourceSetId) {
    const set = this.workbench.sets.find(s => s.id === sourceSetId);
    if (!set) {
      console.error('UnifiedNestedLensManager: Source set not found:', sourceSetId);
      return;
    }

    this.state.currentTable = sourceSetId;
    this.state.breadcrumb = [{ id: sourceSetId, name: set.name, type: 'table' }];

    // Analyze nested fields
    this._analyzeNestedFields(set);

    // Initial render if container exists
    if (this.options.container) {
      this.render();
    }
  }

  /**
   * Analyze which fields contain nested data that could be normalized
   */
  _analyzeNestedFields(set) {
    const nestedFields = [];

    for (const field of set.fields) {
      if (field.type === 'json' || field.type === 'link') {
        // Check if records have array data in this field
        const hasArrayData = set.records.some(r => {
          const value = r.values[field.id];
          return Array.isArray(value) || (typeof value === 'string' && value.startsWith('['));
        });

        if (hasArrayData) {
          nestedFields.push({
            fieldId: field.id,
            fieldName: field.name,
            itemCount: this._countNestedItems(set, field.id)
          });
        }
      }
    }

    this.nestedFields = nestedFields;
    return nestedFields;
  }

  /**
   * Count total nested items across all records for a field
   */
  _countNestedItems(set, fieldId) {
    let count = 0;
    for (const record of set.records) {
      const value = record.values[fieldId];
      if (Array.isArray(value)) {
        count += value.length;
      } else if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            count += parsed.length;
          }
        } catch (e) {
          // Not JSON
        }
      }
    }
    return count;
  }

  // ==========================================================================
  // Structure Mode Management
  // ==========================================================================

  /**
   * Set the structure mode (embedded/hybrid/normalized)
   */
  setStructureMode(mode) {
    if (!Object.values(StructureModes).includes(mode)) {
      console.warn('Invalid structure mode:', mode);
      return;
    }

    const oldMode = this.state.structureMode;
    this.state.structureMode = mode;

    // Reset to root table when changing modes
    const rootSet = this._getRootSet();
    if (rootSet) {
      this.state.currentTable = rootSet.id;
      this.state.filter = null;
      this.state.breadcrumb = [{ id: rootSet.id, name: rootSet.name, type: 'table' }];
    }

    // Generate/update derived tables for normalized mode
    if (mode === StructureModes.NORMALIZED || mode === StructureModes.HYBRID) {
      this._generateDerivedTables();
    }

    // Notify listeners
    if (this.options.onStructureChange) {
      this.options.onStructureChange(mode, oldMode);
    }

    this.render();
  }

  /**
   * Toggle specific field normalization (for hybrid mode)
   */
  toggleFieldNormalization(fieldId, normalized) {
    if (normalized) {
      this.state.normalizedFields.set(fieldId, {
        targetSetId: `derived_${fieldId}_${Date.now()}`,
        syncMode: 'bidirectional'
      });
    } else {
      this.state.normalizedFields.delete(fieldId);
    }

    if (this.state.structureMode === StructureModes.HYBRID) {
      this._generateDerivedTables();
      this.render();
    }
  }

  /**
   * Check if a field is normalized in current view
   */
  isFieldNormalized(fieldId) {
    if (this.state.structureMode === StructureModes.EMBEDDED) {
      return false;
    }
    if (this.state.structureMode === StructureModes.NORMALIZED) {
      const nestedField = this.nestedFields?.find(f => f.fieldId === fieldId);
      return !!nestedField;
    }
    // Hybrid mode
    return this.state.normalizedFields.has(fieldId);
  }

  // ==========================================================================
  // Derived Tables Generation
  // ==========================================================================

  /**
   * Generate derived tables from nested data
   */
  _generateDerivedTables() {
    const rootSet = this._getRootSet();
    if (!rootSet) return;

    this.derivedTables.clear();

    const fieldsToNormalize = this._getFieldsToNormalize();

    for (const fieldInfo of fieldsToNormalize) {
      const field = rootSet.fields.find(f => f.id === fieldInfo.fieldId);
      if (!field) continue;

      const derivedRecords = [];
      const fieldDisplayMgr = new FieldDisplayModesManager(this.workbench);

      for (const parentRecord of rootSet.records) {
        const value = parentRecord.values[fieldInfo.fieldId];
        const parsed = fieldDisplayMgr.parseNestedData(value);

        if (parsed.items && parsed.items.length > 0) {
          for (let i = 0; i < parsed.items.length; i++) {
            const item = parsed.items[i];
            derivedRecords.push({
              id: `derived_${parentRecord.id}_${fieldInfo.fieldId}_${i}`,
              parentRecordId: parentRecord.id,
              parentSetId: rootSet.id,
              index: i,
              values: item._raw || item,
              normalizedItem: item
            });
          }
        }
      }

      // Infer schema from items
      const schema = this._inferSchemaFromRecords(derivedRecords);

      this.derivedTables.set(fieldInfo.fieldId, {
        id: `derived_${fieldInfo.fieldId}`,
        name: this._toTitleCase(field.name),
        parentSetId: rootSet.id,
        parentFieldId: fieldInfo.fieldId,
        relationship: TableRelationship.CHILD,
        records: derivedRecords,
        schema: schema,
        recordCount: derivedRecords.length
      });
    }
  }

  /**
   * Get list of fields to normalize based on current mode
   */
  _getFieldsToNormalize() {
    if (this.state.structureMode === StructureModes.NORMALIZED) {
      return this.nestedFields || [];
    }
    if (this.state.structureMode === StructureModes.HYBRID) {
      return (this.nestedFields || []).filter(f =>
        this.state.normalizedFields.has(f.fieldId)
      );
    }
    return [];
  }

  /**
   * Infer schema from derived records
   */
  _inferSchemaFromRecords(records) {
    const fieldMap = new Map();

    for (const record of records) {
      const values = record.values || {};
      for (const [key, value] of Object.entries(values)) {
        if (key.startsWith('_')) continue; // Skip internal fields

        if (!fieldMap.has(key)) {
          fieldMap.set(key, {
            id: `fld_${key}`,
            name: key,
            type: this._inferFieldType(value),
            samples: []
          });
        }

        const fieldInfo = fieldMap.get(key);
        if (fieldInfo.samples.length < 3 && value !== null && value !== undefined) {
          fieldInfo.samples.push(value);
        }
      }
    }

    return Array.from(fieldMap.values());
  }

  /**
   * Infer field type from value
   */
  _inferFieldType(value) {
    if (value === null || value === undefined) return 'text';
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'json';
    if (typeof value === 'object') return 'json';
    if (typeof value === 'string') {
      if (value.includes('@') && value.includes('.')) return 'email';
      if (value.startsWith('http')) return 'url';
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    }
    return 'text';
  }

  // ==========================================================================
  // Navigation
  // ==========================================================================

  /**
   * Navigate to a table
   */
  navigateToTable(tableId, filter = null) {
    const previousTable = this.state.currentTable;
    this.state.currentTable = tableId;
    this.state.filter = filter;

    // Update breadcrumb
    this._updateBreadcrumb(tableId, filter);

    if (this.options.onTableChange) {
      this.options.onTableChange(tableId, previousTable, filter);
    }

    this.render();
  }

  /**
   * Navigate to linked records (from a cell click)
   */
  navigateToLinkedRecords(fieldId, parentRecordId) {
    const derivedTable = this.derivedTables.get(fieldId);
    if (!derivedTable) return;

    this.navigateToTable(derivedTable.id, {
      type: 'parent',
      parentRecordId: parentRecordId
    });
  }

  /**
   * Update breadcrumb trail
   */
  _updateBreadcrumb(tableId, filter) {
    const rootSet = this._getRootSet();

    // Check if navigating to root
    if (tableId === rootSet?.id) {
      this.state.breadcrumb = [{ id: tableId, name: rootSet.name, type: 'table' }];
      return;
    }

    // Check if navigating to derived table
    for (const [fieldId, derivedTable] of this.derivedTables) {
      if (derivedTable.id === tableId) {
        // Start with root
        const crumbs = [{ id: rootSet.id, name: rootSet.name, type: 'table' }];

        // Add filter context if present
        if (filter?.parentRecordId) {
          const parentRecord = rootSet.records.find(r => r.id === filter.parentRecordId);
          if (parentRecord) {
            const primaryField = rootSet.fields.find(f => f.isPrimary);
            const recordName = primaryField
              ? parentRecord.values[primaryField.id]
              : 'Record';
            crumbs.push({ id: filter.parentRecordId, name: String(recordName), type: 'record' });
          }
        }

        // Add derived table
        crumbs.push({ id: tableId, name: derivedTable.name, type: 'table' });

        this.state.breadcrumb = crumbs;
        return;
      }
    }
  }

  /**
   * Clear current filter
   */
  clearFilter() {
    this.state.filter = null;
    this._updateBreadcrumb(this.state.currentTable, null);
    this.render();
  }

  // ==========================================================================
  // Table Data Access
  // ==========================================================================

  /**
   * Get the root set
   */
  _getRootSet() {
    if (!this.state.currentTable) return null;

    // Check if current table is a derived table
    for (const derivedTable of this.derivedTables.values()) {
      if (derivedTable.id === this.state.currentTable) {
        return this.workbench.sets.find(s => s.id === derivedTable.parentSetId);
      }
    }

    return this.workbench.sets.find(s => s.id === this.state.currentTable);
  }

  /**
   * Get current table data (either root set or derived table)
   */
  getCurrentTableData() {
    const rootSet = this._getRootSet();
    if (!rootSet) return null;

    // Check if viewing a derived table
    for (const [fieldId, derivedTable] of this.derivedTables) {
      if (derivedTable.id === this.state.currentTable) {
        let records = derivedTable.records;

        // Apply filter if present
        if (this.state.filter?.parentRecordId) {
          records = records.filter(r => r.parentRecordId === this.state.filter.parentRecordId);
        }

        return {
          id: derivedTable.id,
          name: derivedTable.name,
          fields: derivedTable.schema,
          records: records,
          relationship: TableRelationship.CHILD,
          parentSetId: derivedTable.parentSetId,
          parentFieldId: derivedTable.parentFieldId,
          totalCount: derivedTable.recordCount,
          filteredCount: records.length,
          isFiltered: !!this.state.filter
        };
      }
    }

    // Return root set data
    return {
      id: rootSet.id,
      name: rootSet.name,
      fields: rootSet.fields,
      records: rootSet.records,
      relationship: TableRelationship.ROOT,
      totalCount: rootSet.records.length,
      filteredCount: rootSet.records.length,
      isFiltered: false
    };
  }

  /**
   * Get table list for sidebar
   */
  getTableList() {
    const rootSet = this._getRootSet();
    if (!rootSet) return [];

    const tables = [{
      id: rootSet.id,
      name: rootSet.name,
      recordCount: rootSet.records.length,
      relationship: TableRelationship.ROOT,
      isActive: this.state.currentTable === rootSet.id
    }];

    // Add derived tables if in normalized/hybrid mode
    if (this.state.structureMode !== StructureModes.EMBEDDED) {
      for (const [fieldId, derivedTable] of this.derivedTables) {
        tables.push({
          id: derivedTable.id,
          name: derivedTable.name,
          recordCount: derivedTable.recordCount,
          relationship: TableRelationship.CHILD,
          parentFieldId: fieldId,
          isActive: this.state.currentTable === derivedTable.id
        });
      }
    }

    return tables;
  }

  // ==========================================================================
  // Rendering
  // ==========================================================================

  /**
   * Main render method
   */
  render() {
    if (!this.options.container) return;

    const container = this.options.container;
    container.innerHTML = '';
    container.className = 'unl-container';

    // Build main layout
    const layout = document.createElement('div');
    layout.className = `unl-layout unl-mode-${this.state.structureMode}`;
    layout.innerHTML = `
      <header class="unl-header">
        ${this._renderHeader()}
      </header>
      <aside class="unl-sidebar">
        ${this._renderSidebar()}
      </aside>
      <main class="unl-main">
        ${this._renderToolbar()}
        ${this._renderFilterBar()}
        <div class="unl-table-container">
          ${this._renderTable()}
        </div>
      </main>
      ${this.state.detailOpen ? `<aside class="unl-detail">${this._renderDetailPanel()}</aside>` : ''}
    `;

    container.appendChild(layout);
    this._attachEventListeners(container);
  }

  /**
   * Render header with structure toggle
   */
  _renderHeader() {
    return `
      <div class="unl-header-left">
        <nav class="unl-breadcrumb">
          ${this.state.breadcrumb.map((crumb, idx) => `
            <span class="unl-breadcrumb-item${idx === this.state.breadcrumb.length - 1 ? ' active' : ''}"
                  data-crumb-id="${crumb.id}"
                  data-crumb-type="${crumb.type}">
              ${this._escapeHtml(crumb.name)}
            </span>
            ${idx < this.state.breadcrumb.length - 1 ? '<span class="unl-breadcrumb-sep">›</span>' : ''}
          `).join('')}
        </nav>
      </div>
      <div class="unl-header-right">
        <div class="unl-structure-toggle">
          <span class="unl-structure-label">Structure</span>
          <div class="unl-structure-options">
            ${Object.values(StructureModes).map(mode => `
              <button class="unl-structure-btn${this.state.structureMode === mode ? ' active' : ''}"
                      data-mode="${mode}">
                ${this._toTitleCase(mode)}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render sidebar with table list
   */
  _renderSidebar() {
    const tables = this.getTableList();
    const isNormalized = this.state.structureMode !== StructureModes.EMBEDDED;

    return `
      <div class="unl-sidebar-section">
        <div class="unl-sidebar-title">Tables</div>
        <ul class="unl-table-list">
          ${tables.map(table => `
            <li class="unl-table-item${table.isActive ? ' active' : ''}"
                data-table-id="${table.id}">
              <span class="unl-table-icon ${table.relationship === TableRelationship.ROOT ? 'root' : 'child'}">
                ${table.relationship === TableRelationship.ROOT ? '★' : '↳'}
              </span>
              <span class="unl-table-name">${this._escapeHtml(table.name)}</span>
              <span class="unl-table-count">${table.recordCount}</span>
            </li>
          `).join('')}
        </ul>
      </div>

      ${isNormalized ? `
        <div class="unl-sidebar-section">
          <div class="unl-sidebar-title">Schema</div>
          <div class="unl-schema-mini">
            ${this._renderSchemaMini()}
          </div>
        </div>
      ` : ''}

      ${this.state.structureMode === StructureModes.HYBRID ? `
        <div class="unl-sidebar-section">
          <div class="unl-sidebar-title">Normalization</div>
          <div class="unl-normalization-config">
            ${this._renderNormalizationConfig()}
          </div>
        </div>
      ` : ''}
    `;
  }

  /**
   * Render mini schema graph
   */
  _renderSchemaMini() {
    const rootSet = this._getRootSet();
    if (!rootSet) return '';

    let html = `
      <div class="unl-schema-node">
        <span class="unl-schema-dot root"></span>
        <span>${this._escapeHtml(rootSet.name)}</span>
      </div>
    `;

    for (const [fieldId, derivedTable] of this.derivedTables) {
      html += `
        <div class="unl-schema-connector"></div>
        <div class="unl-schema-node">
          <span class="unl-schema-dot child"></span>
          <span>${this._escapeHtml(derivedTable.name)}</span>
        </div>
      `;
    }

    return html;
  }

  /**
   * Render normalization configuration (for hybrid mode)
   */
  _renderNormalizationConfig() {
    if (!this.nestedFields) return '';

    return this.nestedFields.map(field => {
      const isNormalized = this.state.normalizedFields.has(field.fieldId);
      return `
        <label class="unl-normalize-option">
          <input type="checkbox"
                 data-field-id="${field.fieldId}"
                 ${isNormalized ? 'checked' : ''}>
          <span class="unl-normalize-label">
            <span class="unl-normalize-name">${this._escapeHtml(field.fieldName)}</span>
            <span class="unl-normalize-badge">${isNormalized ? '↗ linked' : '● embedded'}</span>
          </span>
        </label>
      `;
    }).join('');
  }

  /**
   * Render toolbar
   */
  _renderToolbar() {
    const tableData = this.getCurrentTableData();
    if (!tableData) return '';

    const fieldCount = tableData.fields?.length || 0;
    const recordCount = tableData.filteredCount;

    return `
      <div class="unl-toolbar">
        <div class="unl-toolbar-left">
          <span class="unl-toolbar-title">${this._escapeHtml(tableData.name)}</span>
          <span class="unl-toolbar-subtitle">${recordCount} records · ${fieldCount} fields</span>
        </div>
        <div class="unl-toolbar-right">
          <div class="unl-view-mode-toggle">
            ${['summary', 'chips', 'table'].map(mode => `
              <button class="unl-view-mode-btn${this.state.viewMode === mode ? ' active' : ''}"
                      data-view="${mode}">
                ${this._toTitleCase(mode)}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render filter bar
   */
  _renderFilterBar() {
    if (!this.state.filter) return '';

    const rootSet = this._getRootSet();
    let filterText = '';

    if (this.state.filter.parentRecordId && rootSet) {
      const parentRecord = rootSet.records.find(r => r.id === this.state.filter.parentRecordId);
      if (parentRecord) {
        const primaryField = rootSet.fields.find(f => f.isPrimary);
        const recordName = primaryField
          ? parentRecord.values[primaryField.id]
          : this.state.filter.parentRecordId;
        filterText = `parent = "${recordName}"`;
      }
    }

    return `
      <div class="unl-filter-bar">
        <span class="unl-filter-label">Filtered:</span>
        <span class="unl-filter-value">${this._escapeHtml(filterText)}</span>
        <button class="unl-filter-clear" data-action="clear-filter">Clear filter ✕</button>
      </div>
    `;
  }

  /**
   * Render main table
   */
  _renderTable() {
    const tableData = this.getCurrentTableData();
    if (!tableData) return '<div class="unl-empty">No data</div>';

    const fields = tableData.fields || [];
    const records = tableData.records || [];

    if (records.length === 0) {
      return `
        <div class="unl-empty-state">
          <div class="unl-empty-icon">📋</div>
          <div class="unl-empty-title">No records</div>
          <div class="unl-empty-desc">This table is empty</div>
        </div>
      `;
    }

    return `
      <table class="unl-data-table">
        <thead>
          <tr>
            <th class="unl-th-row-num"></th>
            ${fields.map(field => {
              const isNormalized = this.isFieldNormalized(field.id);
              const isNested = this.nestedFields?.some(f => f.fieldId === field.id);
              const badge = isNormalized ? '↗ linked' : (isNested ? '● embedded' : '');
              const badgeClass = isNormalized ? 'linked' : 'embedded';

              return `
                <th class="unl-th" style="width: ${field.width || 200}px">
                  <div class="unl-col-header">
                    <span class="unl-col-name">${this._escapeHtml(field.name)}</span>
                    ${badge ? `<span class="unl-col-badge ${badgeClass}">${badge}</span>` : ''}
                  </div>
                </th>
              `;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${records.map((record, idx) => this._renderTableRow(record, idx, fields, tableData)).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Render a table row
   */
  _renderTableRow(record, rowIndex, fields, tableData) {
    const isSelected = this.state.selectedRow === record.id;

    return `
      <tr class="unl-row${isSelected ? ' selected' : ''}" data-record-id="${record.id}">
        <td class="unl-td-row-num">${rowIndex + 1}</td>
        ${fields.map(field => `
          <td class="unl-td" data-field-id="${field.id}">
            ${this._renderCell(record, field, tableData)}
          </td>
        `).join('')}
      </tr>
    `;
  }

  /**
   * Render a cell based on field type and normalization state
   */
  _renderCell(record, field, tableData) {
    const value = record.values?.[field.id] ?? record.normalizedItem?.[field.name];

    // Check if this field is normalized (shows as link)
    if (this.isFieldNormalized(field.id) && tableData.relationship === TableRelationship.ROOT) {
      return this._renderLinkedCell(record, field, value);
    }

    // Check if this is nested data that should be displayed embedded
    const isNestedField = this.nestedFields?.some(f => f.fieldId === field.id);
    if (isNestedField && this.state.structureMode === StructureModes.EMBEDDED) {
      return this._renderNestedCell(value, field);
    }

    // Check if this is a back-reference to parent
    if (field.id === '_parent' || field.name === '_parent') {
      return this._renderParentLink(record);
    }

    // Standard cell rendering
    return this._renderStandardCell(value, field);
  }

  /**
   * Render cell as a link to normalized table
   */
  _renderLinkedCell(record, field, value) {
    const derivedTable = this.derivedTables.get(field.id);
    if (!derivedTable) return this._renderStandardCell(value, field);

    // Count items for this parent record
    const itemCount = derivedTable.records.filter(r => r.parentRecordId === record.id).length;

    return `
      <span class="unl-cell-link"
            data-action="navigate"
            data-field-id="${field.id}"
            data-parent-id="${record.id}">
        ${itemCount} ${this._escapeHtml(derivedTable.name.toLowerCase())}
        <span class="unl-cell-link-arrow">→</span>
      </span>
    `;
  }

  /**
   * Render nested data in embedded mode
   */
  _renderNestedCell(value, field) {
    const displayMgr = new FieldDisplayModesManager(this.workbench);
    const parsed = displayMgr.parseNestedData(value);

    if (parsed.isEmpty) return '<span class="unl-cell-empty">—</span>';

    const items = parsed.items;
    const viewMode = this.state.viewMode;

    switch (viewMode) {
      case 'summary':
        return this._renderNestedSummary(items, field);
      case 'chips':
        return this._renderNestedChips(items);
      case 'table':
        return this._renderNestedInlineTable(items);
      default:
        return this._renderNestedSummary(items, field);
    }
  }

  /**
   * Render nested data as summary
   */
  _renderNestedSummary(items, field) {
    const count = items.length;
    const preview = items.slice(0, 3).map(i => i.name || 'item').join(' → ');
    const more = items.length > 3 ? ` → +${items.length - 3}` : '';

    return `
      <div class="unl-cell-summary" data-action="expand" data-field-id="${field.id}">
        <span class="unl-cell-summary-icon">⊞</span>
        <div class="unl-cell-summary-content">
          <span class="unl-cell-summary-count">${count} items</span>
          <span class="unl-cell-summary-preview">${this._escapeHtml(preview)}${more}</span>
        </div>
      </div>
    `;
  }

  /**
   * Render nested data as chips
   */
  _renderNestedChips(items) {
    const maxChips = 5;
    const displayItems = items.slice(0, maxChips);
    const hasMore = items.length > maxChips;

    const chips = displayItems.map(item => {
      const typeClass = this._getTypeClass(item.type);
      return `<span class="unl-chip ${typeClass}">${this._escapeHtml(item.name || 'item')}</span>`;
    }).join('');

    const moreChip = hasMore
      ? `<span class="unl-chip more">+${items.length - maxChips}</span>`
      : '';

    return `<div class="unl-cell-chips">${chips}${moreChip}</div>`;
  }

  /**
   * Render nested data as inline table
   */
  _renderNestedInlineTable(items) {
    const maxRows = 3;
    const displayItems = items.slice(0, maxRows);
    const hasMore = items.length > maxRows;

    // Get columns from first item
    const firstItem = displayItems[0]?._raw || displayItems[0] || {};
    const columns = Object.keys(firstItem).filter(k => !k.startsWith('_')).slice(0, 3);

    if (columns.length === 0) {
      return `<span class="unl-cell-empty">${items.length} items</span>`;
    }

    let html = `<div class="unl-cell-inline-table"><table class="unl-inline-table">`;
    html += `<thead><tr>${columns.map(col => `<th>${this._escapeHtml(col)}</th>`).join('')}</tr></thead>`;
    html += `<tbody>`;

    for (const item of displayItems) {
      const raw = item._raw || item;
      html += `<tr>`;
      for (const col of columns) {
        const val = raw[col];
        const display = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
        html += `<td>${this._escapeHtml(display.substring(0, 30))}</td>`;
      }
      html += `</tr>`;
    }

    html += `</tbody></table>`;
    if (hasMore) {
      html += `<div class="unl-inline-more">+${items.length - maxRows} more</div>`;
    }
    html += `</div>`;

    return html;
  }

  /**
   * Render link back to parent record
   */
  _renderParentLink(record) {
    const rootSet = this._getRootSet();
    if (!rootSet || !record.parentRecordId) return '<span class="unl-cell-empty">—</span>';

    const parentRecord = rootSet.records.find(r => r.id === record.parentRecordId);
    if (!parentRecord) return '<span class="unl-cell-empty">—</span>';

    const primaryField = rootSet.fields.find(f => f.isPrimary);
    const parentName = primaryField
      ? parentRecord.values[primaryField.id]
      : record.parentRecordId;

    return `
      <span class="unl-cell-link parent"
            data-action="navigate-parent"
            data-parent-id="${record.parentRecordId}">
        ${this._escapeHtml(String(parentName))}
      </span>
    `;
  }

  /**
   * Render standard cell value
   */
  _renderStandardCell(value, field) {
    if (value === null || value === undefined || value === '') {
      return '<span class="unl-cell-empty">—</span>';
    }

    if (typeof value === 'object') {
      return `<span class="unl-cell-json">${this._escapeHtml(JSON.stringify(value).substring(0, 50))}</span>`;
    }

    return `<span class="unl-cell-text">${this._escapeHtml(String(value))}</span>`;
  }

  /**
   * Render detail panel
   */
  _renderDetailPanel() {
    const tableData = this.getCurrentTableData();
    if (!tableData || !this.state.selectedRow) return '';

    const record = tableData.records.find(r => r.id === this.state.selectedRow);
    if (!record) return '';

    const values = record.values || record.normalizedItem || {};

    return `
      <div class="unl-detail-header">
        <button class="unl-detail-close" data-action="close-detail">✕</button>
        <div class="unl-detail-title">${this._escapeHtml(values.name || 'Record')}</div>
        <div class="unl-detail-path">${this._escapeHtml(record.id)}</div>
      </div>
      <div class="unl-detail-content">
        <div class="unl-detail-section">
          <div class="unl-detail-section-title">Properties</div>
          ${Object.entries(values).filter(([k]) => !k.startsWith('_')).map(([key, val]) => `
            <div class="unl-detail-field">
              <span class="unl-detail-field-label">${this._escapeHtml(key)}</span>
              <span class="unl-detail-field-value">${this._escapeHtml(typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val ?? ''))}</span>
            </div>
          `).join('')}
        </div>
        <div class="unl-raw-toggle">
          <button class="unl-raw-toggle-btn" data-action="toggle-raw">{ } View Raw JSON</button>
          <pre class="unl-raw-json">${this._escapeHtml(JSON.stringify(values, null, 2))}</pre>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Attach event listeners to rendered elements
   */
  _attachEventListeners(container) {
    // Structure toggle
    container.querySelectorAll('.unl-structure-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        this.setStructureMode(mode);
      });
    });

    // Table list items
    container.querySelectorAll('.unl-table-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tableId = e.currentTarget.dataset.tableId;
        this.navigateToTable(tableId);
      });
    });

    // View mode toggle
    container.querySelectorAll('.unl-view-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.state.viewMode = e.target.dataset.view;
        this.render();
      });
    });

    // Normalization config checkboxes
    container.querySelectorAll('.unl-normalize-option input').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const fieldId = e.target.dataset.fieldId;
        this.toggleFieldNormalization(fieldId, e.target.checked);
      });
    });

    // Breadcrumb navigation
    container.querySelectorAll('.unl-breadcrumb-item').forEach(crumb => {
      crumb.addEventListener('click', (e) => {
        const crumbId = e.currentTarget.dataset.crumbId;
        const crumbType = e.currentTarget.dataset.crumbType;
        this._handleBreadcrumbClick(crumbId, crumbType);
      });
    });

    // Filter clear
    container.querySelectorAll('[data-action="clear-filter"]').forEach(btn => {
      btn.addEventListener('click', () => this.clearFilter());
    });

    // Cell actions
    container.querySelectorAll('[data-action="navigate"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const fieldId = e.currentTarget.dataset.fieldId;
        const parentId = e.currentTarget.dataset.parentId;
        this.navigateToLinkedRecords(fieldId, parentId);
      });
    });

    container.querySelectorAll('[data-action="navigate-parent"]').forEach(link => {
      link.addEventListener('click', () => {
        const rootSet = this._getRootSet();
        if (rootSet) {
          this.navigateToTable(rootSet.id);
        }
      });
    });

    // Row selection
    container.querySelectorAll('.unl-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return; // Don't select when clicking actions
        const recordId = e.currentTarget.dataset.recordId;
        this.state.selectedRow = recordId;
        this.state.detailOpen = true;
        this.render();
      });
    });

    // Detail panel close
    container.querySelectorAll('[data-action="close-detail"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.detailOpen = false;
        this.state.selectedRow = null;
        this.render();
      });
    });

    // Raw JSON toggle
    container.querySelectorAll('[data-action="toggle-raw"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pre = e.target.parentElement.querySelector('.unl-raw-json');
        if (pre) {
          pre.classList.toggle('open');
        }
      });
    });
  }

  /**
   * Handle structure toggle
   */
  _handleStructureToggle(mode) {
    this.setStructureMode(mode);
  }

  /**
   * Handle table selection
   */
  _handleTableSelect(tableId) {
    this.navigateToTable(tableId);
  }

  /**
   * Handle cell click
   */
  _handleCellClick(recordId, fieldId) {
    if (this.isFieldNormalized(fieldId)) {
      this.navigateToLinkedRecords(fieldId, recordId);
    } else {
      this.state.selectedRow = recordId;
      this.state.detailOpen = true;
      this.render();
    }
  }

  /**
   * Handle filter clear
   */
  _handleFilterClear() {
    this.clearFilter();
  }

  /**
   * Handle breadcrumb click
   */
  _handleBreadcrumbClick(crumbId, crumbType) {
    if (crumbType === 'table') {
      // Navigate to table without filter
      for (const [fieldId, derivedTable] of this.derivedTables) {
        if (derivedTable.id === crumbId) {
          this.navigateToTable(crumbId, null);
          return;
        }
      }
      // Root table
      this.navigateToTable(crumbId, null);
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  _escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  _toTitleCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  _getTypeClass(type) {
    const typeMap = {
      text: 'action',
      link: 'trigger',
      formula: 'transform',
      select: 'response'
    };
    return typeMap[type] || 'action';
  }
}

// ============================================================================
// Export
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    StructureModes,
    CellDisplayTypes,
    TableRelationship,
    UnifiedNestedLensManager
  };
}

if (typeof window !== 'undefined') {
  window.StructureModes = StructureModes;
  window.CellDisplayTypes = CellDisplayTypes;
  window.TableRelationship = TableRelationship;
  window.UnifiedNestedLensManager = UnifiedNestedLensManager;
}
