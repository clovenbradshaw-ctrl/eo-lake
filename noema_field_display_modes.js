/**
 * Noema Field Display Modes
 *
 * Provides multiple rendering modes for nested/JSON data in table cells:
 * - summary: Compact count/type summary
 * - chips: Visual tokens with type icons
 * - table: Inline mini-table
 * - graph: Relationship visualization (mini node graph)
 * - raw: Original JSON (Given data)
 *
 * Also implements Horizon levels for progressive detail disclosure:
 * - minimal: Just counts
 * - basic: Names and types
 * - detailed: Names, types, key options
 * - full: Everything including IDs
 *
 * EO Alignment:
 * - Raw mode = Given (uninterpreted import)
 * - Other modes = Meant (interpreted/structured views)
 */

const FieldDisplayModes = {
  SUMMARY: 'summary',
  CHIPS: 'chips',
  TABLE: 'table',
  GRAPH: 'graph',
  RAW: 'raw',
  NAVIGATE: 'navigate', // n8n-style drill-down navigation
  TREE_VIEW: 'treeView', // Interactive nested tree with depth tracking
  KEY_VALUE: 'keyValue' // Legacy mode for backwards compatibility
};

const HorizonLevels = {
  MINIMAL: 'minimal',
  BASIC: 'basic',
  DETAILED: 'detailed',
  FULL: 'full'
};

/**
 * Type icons for chip rendering (Phosphor icons)
 */
const TypeStyles = {
  text: { icon: 'ph-text-t', color: 'gray', label: 'Text' },
  string: { icon: 'ph-text-t', color: 'gray', label: 'Text' },
  number: { icon: 'ph-hash', color: 'blue', label: 'Number' },
  integer: { icon: 'ph-hash', color: 'blue', label: 'Number' },
  float: { icon: 'ph-hash', color: 'blue', label: 'Number' },
  date: { icon: 'ph-calendar', color: 'purple', label: 'Date' },
  datetime: { icon: 'ph-calendar', color: 'purple', label: 'DateTime' },
  link: { icon: 'ph-link', color: 'green', label: 'Link' },
  relation: { icon: 'ph-link', color: 'green', label: 'Link' },
  formula: { icon: 'ph-function', color: 'orange', label: 'Formula' },
  computed: { icon: 'ph-function', color: 'orange', label: 'Computed' },
  select: { icon: 'ph-list', color: 'teal', label: 'Select' },
  multiSelect: { icon: 'ph-list-checks', color: 'teal', label: 'Multi-Select' },
  boolean: { icon: 'ph-toggle-left', color: 'pink', label: 'Boolean' },
  checkbox: { icon: 'ph-check-square', color: 'pink', label: 'Checkbox' },
  attachment: { icon: 'ph-paperclip', color: 'amber', label: 'Attachment' },
  file: { icon: 'ph-file', color: 'amber', label: 'File' },
  json: { icon: 'ph-brackets-curly', color: 'slate', label: 'JSON' },
  object: { icon: 'ph-brackets-curly', color: 'slate', label: 'Object' },
  array: { icon: 'ph-brackets-square', color: 'indigo', label: 'Array' },
  email: { icon: 'ph-envelope', color: 'cyan', label: 'Email' },
  url: { icon: 'ph-globe', color: 'cyan', label: 'URL' },
  phone: { icon: 'ph-phone', color: 'cyan', label: 'Phone' },
  currency: { icon: 'ph-currency-dollar', color: 'emerald', label: 'Currency' },
  percent: { icon: 'ph-percent', color: 'emerald', label: 'Percent' },
  rating: { icon: 'ph-star', color: 'yellow', label: 'Rating' },
  duration: { icon: 'ph-timer', color: 'violet', label: 'Duration' },
  unknown: { icon: 'ph-question', color: 'gray', label: 'Unknown' }
};

/**
 * Field Display Modes Manager
 */
class FieldDisplayModesManager {
  constructor(workbench) {
    this.workbench = workbench;
  }

  /**
   * Get default display config for a field
   */
  getDefaultDisplayConfig() {
    return {
      defaultMode: FieldDisplayModes.CHIPS,
      defaultHorizon: HorizonLevels.DETAILED,
      modes: {
        summary: { template: '{count} items' },
        chips: { maxVisible: 6, showTypes: true, expandable: true },
        table: { columns: null, sortBy: null, maxRows: 5 },
        graph: { layout: 'dagre', showLabels: true },
        navigate: { maxItems: 50, showTypes: true },
        treeView: { maxDepth: 6, showStats: true, showBreadcrumb: true, showDepthControls: true, initialExpandDepth: 1 }
      }
    };
  }

  /**
   * Parse nested data from a field value
   */
  parseNestedData(value) {
    if (value === null || value === undefined) {
      return { items: [], isArray: false, isEmpty: true };
    }

    // Handle string values - try to parse as JSON
    let data = value;
    if (typeof value === 'string') {
      try {
        data = JSON.parse(value);
      } catch (e) {
        return { items: [], isArray: false, isEmpty: false, rawString: value };
      }
    }

    if (Array.isArray(data)) {
      return {
        items: data.map((item, idx) => this._normalizeItem(item, idx)),
        isArray: true,
        isEmpty: data.length === 0,
        raw: data
      };
    }

    if (typeof data === 'object' && data !== null) {
      // Single object - wrap in array
      return {
        items: [this._normalizeItem(data, 0)],
        isArray: false,
        isEmpty: false,
        raw: data
      };
    }

    // Primitive
    return { items: [], isArray: false, isEmpty: false, primitive: data };
  }

  /**
   * Normalize an item for consistent rendering
   */
  _normalizeItem(item, index) {
    if (typeof item !== 'object' || item === null) {
      return { _index: index, _value: item, _type: typeof item };
    }

    // Try to detect common field definition patterns
    const normalized = {
      _index: index,
      _raw: item
    };

    // Common name fields
    normalized.name = item.name || item.title || item.label || item.field_name ||
                      item.fieldName || item.displayName || item.key || `Item ${index + 1}`;

    // Common type fields
    normalized.type = item.type || item.fieldType || item.dataType ||
                      item.kind || item.valueType || this._inferType(item);

    // Common ID fields
    normalized.id = item.id || item._id || item.key || item.fieldId || `item_${index}`;

    // Detect if this looks like a field definition
    normalized._isFieldDefinition = !!(item.type || item.fieldType || item.dataType);

    // Extract options/config if present
    if (item.options || item.config || item.settings) {
      normalized.options = item.options || item.config || item.settings;
    }

    // Extract relationships
    if (item.linkedTableId || item.linkedSetId || item.referencedTable || item.foreignKey) {
      normalized._hasRelation = true;
      normalized._linkedTo = item.linkedTableId || item.linkedSetId ||
                             item.referencedTable || item.foreignKey;
    }

    // Extract formula if present
    if (item.formula || item.expression || item.computed) {
      normalized._hasFormula = true;
      normalized._formula = item.formula || item.expression || item.computed;
    }

    return normalized;
  }

  /**
   * Infer type from value structure
   */
  _inferType(item) {
    if (item.formula || item.expression) return 'formula';
    if (item.linkedTableId || item.linkedSetId) return 'link';
    if (item.choices || item.options?.choices) return 'select';
    if (typeof item === 'boolean') return 'boolean';
    if (typeof item === 'number') return 'number';
    if (typeof item === 'string') {
      if (item.includes('@')) return 'email';
      if (item.startsWith('http')) return 'url';
    }
    return 'text';
  }

  /**
   * Get type style for rendering
   */
  getTypeStyle(type) {
    const normalizedType = (type || 'unknown').toLowerCase().replace(/[^a-z]/g, '');
    return TypeStyles[normalizedType] || TypeStyles.unknown;
  }

  // ==================== RENDER METHODS ====================

  /**
   * Main render entry point
   */
  renderCell(value, field, searchTerm = '') {
    const displayConfig = field.options?.displayConfig || this.getDefaultDisplayConfig();
    const mode = displayConfig.defaultMode || FieldDisplayModes.CHIPS;
    const horizon = displayConfig.defaultHorizon || HorizonLevels.DETAILED;

    const parsed = this.parseNestedData(value);

    // Handle empty/primitive cases
    if (parsed.isEmpty) {
      return '<span class="cell-empty">-</span>';
    }
    if (parsed.rawString !== undefined) {
      return `<span class="cell-json-raw">${this._escapeHtml(parsed.rawString)}</span>`;
    }
    if (parsed.primitive !== undefined) {
      return this._renderPrimitive(parsed.primitive, searchTerm);
    }

    // Render based on mode
    switch (mode) {
      case FieldDisplayModes.SUMMARY:
        return this.renderSummary(parsed, horizon, displayConfig.modes.summary);
      case FieldDisplayModes.CHIPS:
        return this.renderChips(parsed, horizon, displayConfig.modes.chips, searchTerm);
      case FieldDisplayModes.TABLE:
        return this.renderTable(parsed, horizon, displayConfig.modes.table, searchTerm);
      case FieldDisplayModes.GRAPH:
        return this.renderGraph(parsed, horizon, displayConfig.modes.graph);
      case FieldDisplayModes.RAW:
        return this.renderRaw(value, searchTerm);
      case FieldDisplayModes.NAVIGATE:
        return this.renderNavigate(value, field, displayConfig.modes.navigate);
      case FieldDisplayModes.TREE_VIEW:
        return this.renderTreeView(value, field, displayConfig.modes.treeView);
      case FieldDisplayModes.KEY_VALUE:
      default:
        return this.renderChips(parsed, horizon, displayConfig.modes.chips, searchTerm);
    }
  }

  /**
   * Render Summary Mode
   */
  renderSummary(parsed, horizon, config = {}) {
    const { items } = parsed;
    const count = items.length;

    if (count === 0) {
      return '<span class="cell-empty">No items</span>';
    }

    switch (horizon) {
      case HorizonLevels.MINIMAL:
        return `<span class="fdm-summary fdm-summary-minimal">${count} item${count !== 1 ? 's' : ''}</span>`;

      case HorizonLevels.BASIC: {
        const typeCounts = this._countByType(items);
        const typeStr = Object.entries(typeCounts)
          .map(([type, cnt]) => `${cnt} ${type}`)
          .join(', ');
        return `<span class="fdm-summary fdm-summary-basic">${count} item${count !== 1 ? 's' : ''}: ${typeStr}</span>`;
      }

      case HorizonLevels.DETAILED: {
        const names = items.slice(0, 4).map(i => i.name).join(', ');
        const more = items.length > 4 ? `, +${items.length - 4} more` : '';
        return `<span class="fdm-summary fdm-summary-detailed">${count} item${count !== 1 ? 's' : ''}: ${this._escapeHtml(names)}${more}</span>`;
      }

      case HorizonLevels.FULL:
      default: {
        const details = items.slice(0, 3).map(i => {
          const typeStyle = this.getTypeStyle(i.type);
          return `${i.name} (${typeStyle.label})`;
        }).join(', ');
        const more = items.length > 3 ? `, +${items.length - 3} more` : '';
        return `<span class="fdm-summary fdm-summary-full">${count} item${count !== 1 ? 's' : ''}: ${this._escapeHtml(details)}${more}</span>`;
      }
    }
  }

  /**
   * Render Chips Mode
   */
  renderChips(parsed, horizon, config = {}, searchTerm = '') {
    const { items } = parsed;
    const { maxVisible = 6, showTypes = true, expandable = true } = config;

    if (items.length === 0) {
      return '<span class="cell-empty">No items</span>';
    }

    const displayItems = items.slice(0, maxVisible);
    const hasMore = items.length > maxVisible;

    let html = '<div class="fdm-chips-container">';

    displayItems.forEach(item => {
      const typeStyle = this.getTypeStyle(item.type);
      const chipContent = this._getChipContent(item, horizon, typeStyle);

      // Build chip classes
      const chipClasses = ['fdm-chip', `fdm-chip-${typeStyle.color}`];
      if (item._hasRelation) chipClasses.push('fdm-chip-has-relation');
      if (item._hasFormula) chipClasses.push('fdm-chip-has-formula');

      // Build tooltip
      const tooltip = this._buildChipTooltip(item, horizon);

      html += `<span class="${chipClasses.join(' ')}" title="${this._escapeHtml(tooltip)}" data-item-id="${item.id}">`;

      // Icon (show in basic+ horizon)
      if (showTypes && horizon !== HorizonLevels.MINIMAL) {
        html += `<i class="ph ${typeStyle.icon} fdm-chip-icon"></i>`;
      }

      // Name
      html += `<span class="fdm-chip-name">${this._highlightText(chipContent.name, searchTerm)}</span>`;

      // Type suffix for detailed+ horizon
      if (horizon === HorizonLevels.DETAILED || horizon === HorizonLevels.FULL) {
        if (chipContent.suffix) {
          html += `<span class="fdm-chip-suffix">${this._escapeHtml(chipContent.suffix)}</span>`;
        }
      }

      // Relation indicator
      if (item._hasRelation && (horizon === HorizonLevels.DETAILED || horizon === HorizonLevels.FULL)) {
        html += `<i class="ph ph-arrow-right fdm-chip-relation"></i>`;
      }

      html += '</span>';
    });

    if (hasMore) {
      html += `<span class="fdm-chip fdm-chip-more">+${items.length - maxVisible}</span>`;
    }

    html += '</div>';

    // Add inline mode toggle
    html += this._renderInlineModeToggle();

    return html;
  }

  /**
   * Get chip content based on horizon
   */
  _getChipContent(item, horizon, typeStyle) {
    const name = item.name || 'Unnamed';

    switch (horizon) {
      case HorizonLevels.MINIMAL:
        return { name };

      case HorizonLevels.BASIC:
        return { name };

      case HorizonLevels.DETAILED:
        return {
          name,
          suffix: item._hasRelation ? `→ ${item._linkedTo}` :
                  item._hasFormula ? '(fx)' : null
        };

      case HorizonLevels.FULL:
      default:
        let suffix = typeStyle.label;
        if (item._hasRelation) suffix += ` → ${item._linkedTo}`;
        if (item._hasFormula) suffix += ' (fx)';
        if (item.options?.required) suffix += ' *';
        return { name, suffix };
    }
  }

  /**
   * Build tooltip for chip
   */
  _buildChipTooltip(item, horizon) {
    const lines = [`Name: ${item.name}`];
    const typeStyle = this.getTypeStyle(item.type);
    lines.push(`Type: ${typeStyle.label}`);

    if (item.id && horizon === HorizonLevels.FULL) {
      lines.push(`ID: ${item.id}`);
    }

    if (item._hasRelation) {
      lines.push(`Links to: ${item._linkedTo}`);
    }

    if (item._hasFormula) {
      lines.push(`Formula: ${item._formula}`);
    }

    if (item.options) {
      if (item.options.required) lines.push('Required: Yes');
      if (item.options.unique) lines.push('Unique: Yes');
    }

    return lines.join('\n');
  }

  /**
   * Render Table Mode
   */
  renderTable(parsed, horizon, config = {}, searchTerm = '') {
    const { items } = parsed;
    const { maxRows = 5 } = config;

    if (items.length === 0) {
      return '<span class="cell-empty">No items</span>';
    }

    // Determine columns based on horizon
    const columns = this._getTableColumns(items, horizon);
    const displayItems = items.slice(0, maxRows);
    const hasMore = items.length > maxRows;

    let html = '<div class="fdm-table-container">';
    html += '<table class="fdm-table">';

    // Header
    html += '<thead><tr>';
    columns.forEach(col => {
      html += `<th class="fdm-table-th">${this._escapeHtml(col.label)}</th>`;
    });
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    displayItems.forEach(item => {
      html += '<tr class="fdm-table-row">';
      columns.forEach(col => {
        const value = this._getColumnValue(item, col);
        html += `<td class="fdm-table-td">${this._renderTableCell(value, col, searchTerm)}</td>`;
      });
      html += '</tr>';
    });

    if (hasMore) {
      html += `<tr class="fdm-table-more-row"><td colspan="${columns.length}">+${items.length - maxRows} more items</td></tr>`;
    }

    html += '</tbody></table>';
    html += '</div>';

    // Add inline mode toggle
    html += this._renderInlineModeToggle();

    return html;
  }

  /**
   * Get table columns based on horizon
   */
  _getTableColumns(items, horizon) {
    const columns = [];

    // Always show name
    columns.push({ key: 'name', label: 'Name', type: 'text' });

    if (horizon === HorizonLevels.MINIMAL) {
      return columns;
    }

    // Basic: add type
    columns.push({ key: 'type', label: 'Type', type: 'type' });

    if (horizon === HorizonLevels.BASIC) {
      return columns;
    }

    // Detailed: add options summary
    columns.push({ key: 'options', label: 'Options', type: 'options' });

    if (horizon === HorizonLevels.DETAILED) {
      return columns;
    }

    // Full: add ID
    columns.unshift({ key: 'id', label: 'ID', type: 'text' });

    return columns;
  }

  /**
   * Get column value from item
   */
  _getColumnValue(item, col) {
    switch (col.key) {
      case 'name':
        return item.name;
      case 'type':
        return item.type;
      case 'id':
        return item.id;
      case 'options':
        return this._summarizeOptions(item);
      default:
        return item._raw?.[col.key] ?? item[col.key];
    }
  }

  /**
   * Summarize options for display
   */
  _summarizeOptions(item) {
    const parts = [];

    if (item._hasRelation) {
      parts.push(`→ ${item._linkedTo}`);
    }
    if (item._hasFormula) {
      const formula = item._formula;
      parts.push(`=${formula?.substring(0, 20)}${formula?.length > 20 ? '...' : ''}`);
    }
    if (item.options?.required) {
      parts.push('required');
    }
    if (item.options?.unique) {
      parts.push('unique');
    }
    if (item.options?.choices) {
      parts.push(`${item.options.choices.length} choices`);
    }

    return parts.length > 0 ? parts.join(', ') : '—';
  }

  /**
   * Render table cell value
   */
  _renderTableCell(value, col, searchTerm) {
    if (value === null || value === undefined || value === '') {
      return '<span class="fdm-table-empty">—</span>';
    }

    if (col.type === 'type') {
      const typeStyle = this.getTypeStyle(value);
      return `<span class="fdm-table-type fdm-type-${typeStyle.color}"><i class="ph ${typeStyle.icon}"></i> ${typeStyle.label}</span>`;
    }

    return this._highlightText(String(value), searchTerm);
  }

  /**
   * Render Graph Mode (mini relationship visualization)
   */
  renderGraph(parsed, horizon, config = {}) {
    const { items } = parsed;

    if (items.length === 0) {
      return '<span class="cell-empty">No items</span>';
    }

    // Find items with relationships
    const relations = [];
    const formulaDeps = [];

    items.forEach(item => {
      if (item._hasRelation) {
        relations.push({ from: item.name, to: item._linkedTo, type: 'link' });
      }
      if (item._hasFormula && item._formula) {
        // Extract field references from formula
        const refs = this._extractFormulaRefs(item._formula);
        refs.forEach(ref => {
          const targetItem = items.find(i => i.name === ref || i.id === ref);
          if (targetItem) {
            formulaDeps.push({ from: targetItem.name, to: item.name, type: 'formula' });
          }
        });
      }
    });

    // Build mini graph visualization
    let html = '<div class="fdm-graph-container">';

    // Node layout
    html += '<div class="fdm-graph-nodes">';
    items.slice(0, 8).forEach((item, idx) => {
      const typeStyle = this.getTypeStyle(item.type);
      const hasRelations = relations.some(r => r.from === item.name) ||
                          formulaDeps.some(d => d.from === item.name || d.to === item.name);

      html += `<div class="fdm-graph-node fdm-node-${typeStyle.color}${hasRelations ? ' fdm-node-connected' : ''}"
                   data-node-id="${item.id}"
                   style="--node-idx: ${idx}">`;
      html += `<i class="ph ${typeStyle.icon}"></i>`;
      if (horizon !== HorizonLevels.MINIMAL) {
        html += `<span class="fdm-node-name">${this._escapeHtml(item.name)}</span>`;
      }
      html += '</div>';
    });

    if (items.length > 8) {
      html += `<div class="fdm-graph-node fdm-node-more">+${items.length - 8}</div>`;
    }

    html += '</div>';

    // Legend if we have relations
    if (relations.length > 0 || formulaDeps.length > 0) {
      html += '<div class="fdm-graph-legend">';
      if (relations.length > 0) {
        html += `<span class="fdm-legend-item"><i class="ph ph-link"></i> ${relations.length} link${relations.length !== 1 ? 's' : ''}</span>`;
      }
      if (formulaDeps.length > 0) {
        html += `<span class="fdm-legend-item"><i class="ph ph-function"></i> ${formulaDeps.length} dep${formulaDeps.length !== 1 ? 's' : ''}</span>`;
      }
      html += '</div>';
    }

    html += '</div>';

    // Add inline mode toggle
    html += this._renderInlineModeToggle();

    return html;
  }

  /**
   * Extract field references from a formula
   */
  _extractFormulaRefs(formula) {
    const refs = [];
    // Match {FieldName} patterns
    const matches = formula.match(/\{([^}]+)\}/g);
    if (matches) {
      matches.forEach(m => {
        refs.push(m.replace(/[{}]/g, ''));
      });
    }
    return refs;
  }

  /**
   * Render Raw JSON Mode
   */
  renderRaw(value, searchTerm = '') {
    let jsonStr;
    if (typeof value === 'object') {
      jsonStr = JSON.stringify(value, null, 2);
    } else {
      jsonStr = String(value);
    }

    // Truncate for cell display
    const truncated = jsonStr.length > 200;
    const display = truncated ? jsonStr.substring(0, 200) + '...' : jsonStr;

    let html = '<div class="fdm-raw-container">';
    html += `<pre class="fdm-raw-json">${this._highlightText(this._escapeHtml(display), searchTerm)}</pre>`;
    html += '<div class="fdm-raw-badge">GIVEN</div>';
    if (truncated) {
      html += '<button class="fdm-raw-expand" title="Expand">...</button>';
    }
    html += '</div>';

    // Add inline mode toggle
    html += this._renderInlineModeToggle();

    return html;
  }

  /**
   * Render Navigate Mode (n8n-style drill-down)
   */
  renderNavigate(value, field, config = {}) {
    // Check if JsonNavigator is available
    if (typeof JsonNavigator === 'undefined' || typeof jsonNavigatorManager === 'undefined') {
      // Fallback to chips if navigator not loaded
      const parsed = this.parseNestedData(value);
      return this.renderChips(parsed, HorizonLevels.DETAILED, {}, '');
    }

    // Generate unique container ID for this cell
    const containerId = `jnav-${field.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Initialize the navigator manager if needed
    jsonNavigatorManager.init();

    // Create and render the navigator
    const html = jsonNavigatorManager.createNavigator(containerId, value, {
      maxItems: config.maxItems || 50,
      showTypes: config.showTypes !== false
    });

    // Wrap with mode toggle
    let result = html;
    result += this._renderInlineModeToggle();

    return result;
  }

  /**
   * Render Tree View Mode (interactive nested tree with depth tracking)
   */
  renderTreeView(value, field, config = {}) {
    // Check if NestedJsonViewer is available
    if (typeof NestedJsonViewer === 'undefined' || typeof nestedJsonViewerManager === 'undefined') {
      // Fallback to navigate mode if viewer not loaded
      return this.renderNavigate(value, field, config);
    }

    // Generate unique container ID
    const containerId = `njv-${field.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Initialize the viewer manager if needed
    nestedJsonViewerManager.init();

    // Create and render the viewer
    const html = nestedJsonViewerManager.createViewer(containerId, value, {
      maxDepth: config.maxDepth || 6,
      showStats: config.showStats !== false,
      showBreadcrumb: config.showBreadcrumb !== false,
      showDepthControls: config.showDepthControls !== false,
      initialExpandDepth: config.initialExpandDepth || 1
    });

    // Wrap with mode toggle
    let result = html;
    result += this._renderInlineModeToggle();

    return result;
  }

  /**
   * Render inline mode toggle buttons
   */
  _renderInlineModeToggle() {
    return `
      <div class="fdm-mode-toggle" title="Switch display mode">
        <button class="fdm-mode-btn" data-mode="treeView" title="Tree View"><i class="ph ph-git-branch"></i></button>
        <button class="fdm-mode-btn" data-mode="navigate" title="Navigate"><i class="ph ph-compass"></i></button>
        <button class="fdm-mode-btn" data-mode="summary" title="Summary"><i class="ph ph-list-numbers"></i></button>
        <button class="fdm-mode-btn" data-mode="chips" title="Chips"><i class="ph ph-squares-four"></i></button>
        <button class="fdm-mode-btn" data-mode="table" title="Table"><i class="ph ph-table"></i></button>
        <button class="fdm-mode-btn" data-mode="graph" title="Graph"><i class="ph ph-graph"></i></button>
        <button class="fdm-mode-btn" data-mode="raw" title="Raw JSON"><i class="ph ph-brackets-curly"></i></button>
      </div>
    `;
  }

  /**
   * Render horizon selector for column header
   */
  renderHorizonSelector(currentHorizon = HorizonLevels.DETAILED) {
    const horizons = [
      { id: HorizonLevels.MINIMAL, label: 'Minimal', desc: 'Just counts' },
      { id: HorizonLevels.BASIC, label: 'Basic', desc: 'Names and types' },
      { id: HorizonLevels.DETAILED, label: 'Detailed', desc: 'With key options' },
      { id: HorizonLevels.FULL, label: 'Full', desc: 'Everything' }
    ];

    let html = '<div class="fdm-horizon-selector">';
    html += '<label class="fdm-horizon-label">Detail Level</label>';
    html += '<div class="fdm-horizon-options">';

    horizons.forEach(h => {
      const isSelected = h.id === currentHorizon;
      html += `
        <button class="fdm-horizon-btn${isSelected ? ' fdm-horizon-active' : ''}"
                data-horizon="${h.id}"
                title="${h.desc}">
          ${h.label}
        </button>
      `;
    });

    html += '</div></div>';
    return html;
  }

  /**
   * Render mode selector for column header dropdown
   */
  renderModeSelector(currentMode = FieldDisplayModes.CHIPS) {
    const modes = [
      { id: FieldDisplayModes.TREE_VIEW, label: 'Tree View', icon: 'ph-git-branch', desc: 'Interactive nested tree with depth tracking' },
      { id: FieldDisplayModes.NAVIGATE, label: 'Navigate', icon: 'ph-compass', desc: 'Drill-down navigation' },
      { id: FieldDisplayModes.SUMMARY, label: 'Summary', icon: 'ph-list-numbers' },
      { id: FieldDisplayModes.CHIPS, label: 'Chips', icon: 'ph-squares-four' },
      { id: FieldDisplayModes.TABLE, label: 'Table', icon: 'ph-table' },
      { id: FieldDisplayModes.GRAPH, label: 'Graph', icon: 'ph-graph' },
      { id: FieldDisplayModes.RAW, label: 'Raw JSON', icon: 'ph-brackets-curly' }
    ];

    let html = '<div class="fdm-mode-selector">';
    html += '<label class="fdm-mode-label">Display Mode</label>';
    html += '<div class="fdm-mode-options">';

    modes.forEach(m => {
      const isSelected = m.id === currentMode;
      html += `
        <button class="fdm-mode-option${isSelected ? ' fdm-mode-active' : ''}"
                data-mode="${m.id}">
          <i class="ph ${m.icon}"></i>
          <span>${m.label}</span>
          ${m.id === FieldDisplayModes.RAW ? '<span class="fdm-mode-badge">GIVEN</span>' : ''}
        </button>
      `;
    });

    html += '</div></div>';
    return html;
  }

  // ==================== HELPER METHODS ====================

  _countByType(items) {
    const counts = {};
    items.forEach(item => {
      const type = item.type || 'unknown';
      const typeStyle = this.getTypeStyle(type);
      counts[typeStyle.label] = (counts[typeStyle.label] || 0) + 1;
    });
    return counts;
  }

  _escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  _highlightText(text, searchTerm) {
    if (!searchTerm || !text) return this._escapeHtml(String(text));
    const escaped = this._escapeHtml(String(text));
    const regex = new RegExp(`(${this._escapeRegex(searchTerm)})`, 'gi');
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _renderPrimitive(value, searchTerm) {
    if (value === null) return '<span class="json-null">null</span>';
    if (value === undefined) return '<span class="json-undefined">undefined</span>';
    if (typeof value === 'boolean') {
      return `<span class="json-bool"><i class="ph ${value ? 'ph-check-circle' : 'ph-x-circle'}"></i> ${value}</span>`;
    }
    if (typeof value === 'number') {
      return `<span class="json-number">${this._highlightText(String(value), searchTerm)}</span>`;
    }
    return `<span class="json-string">${this._highlightText(String(value), searchTerm)}</span>`;
  }
}

// ==================== NORMALIZATION MANAGER ====================

/**
 * Handles the normalization of nested JSON into linked Sets
 */
class NestedDataNormalizationManager {
  constructor(workbench) {
    this.workbench = workbench;
  }

  /**
   * Analyze nested data to determine if it can be normalized
   */
  analyzeForNormalization(value, fieldId) {
    const displayMgr = new FieldDisplayModesManager(this.workbench);
    const parsed = displayMgr.parseNestedData(value);

    if (parsed.isEmpty || parsed.primitive !== undefined || !parsed.items.length) {
      return { canNormalize: false, reason: 'No structured data to normalize' };
    }

    // Analyze schema
    const schema = this._inferSchema(parsed.items);

    return {
      canNormalize: true,
      itemCount: parsed.items.length,
      isArray: parsed.isArray,
      schema,
      suggestedName: this._suggestSetName(fieldId),
      preview: parsed.items.slice(0, 3)
    };
  }

  /**
   * Infer schema from items
   */
  _inferSchema(items) {
    const fields = new Map();

    items.forEach(item => {
      const raw = item._raw || item;
      if (typeof raw !== 'object' || raw === null) return;

      Object.entries(raw).forEach(([key, value]) => {
        if (!fields.has(key)) {
          fields.set(key, {
            key,
            type: this._inferFieldType(value),
            samples: [],
            count: 0,
            nullCount: 0
          });
        }

        const field = fields.get(key);
        field.count++;
        if (value === null || value === undefined) {
          field.nullCount++;
        } else if (field.samples.length < 3) {
          field.samples.push(value);
        }
      });
    });

    // Calculate coverage and finalize
    return Array.from(fields.values()).map(f => ({
      ...f,
      coverage: f.count / items.length,
      nullable: f.nullCount > 0
    }));
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

  /**
   * Suggest a name for the normalized Set
   */
  _suggestSetName(fieldId) {
    // Extract meaningful name from field ID
    const name = fieldId
      .replace(/^fld_/, '')
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim();

    // Capitalize first letter of each word
    return name
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /**
   * Create normalized Set from nested data
   */
  async createNormalizedSet(sourceSetId, sourceFieldId, config) {
    const {
      targetSetName,
      schema,
      syncMode = 'bidirectional',
      createBacklink = true
    } = config;

    const sourceSet = this.workbench.sets.find(s => s.id === sourceSetId);
    if (!sourceSet) {
      throw new Error('Source set not found');
    }

    const sourceField = sourceSet.fields.find(f => f.id === sourceFieldId);
    if (!sourceField) {
      throw new Error('Source field not found');
    }

    // Generate IDs
    const targetSetId = `set_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const backlinkFieldId = `fld_parent_${sourceSetId}`;

    // Build target set fields from schema
    const targetFields = schema.map((f, idx) => ({
      id: `fld_${f.key}_${Date.now()}`,
      name: f.key,
      type: this._mapToNoemaFieldType(f.type),
      isPrimary: idx === 0,
      sourceMapping: `$.${f.key}`
    }));

    // Add backlink field if requested
    if (createBacklink) {
      targetFields.push({
        id: backlinkFieldId,
        name: `Parent ${sourceSet.name}`,
        type: 'link',
        options: {
          linkedSetId: sourceSetId
        },
        isBacklink: true
      });
    }

    // Extract records from source
    const records = [];
    sourceSet.records.forEach(sourceRecord => {
      const value = sourceRecord.values[sourceFieldId];
      const displayMgr = new FieldDisplayModesManager(this.workbench);
      const parsed = displayMgr.parseNestedData(value);

      parsed.items.forEach((item, itemIdx) => {
        const recordId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const values = {};

        // Map values from schema
        targetFields.forEach(field => {
          if (field.isBacklink) {
            values[field.id] = [{ recordId: sourceRecord.id }];
          } else if (field.sourceMapping) {
            const key = field.sourceMapping.replace('$.', '');
            values[field.id] = item._raw?.[key] ?? item[key];
          }
        });

        records.push({
          id: recordId,
          values,
          _provenance: {
            sourceRecordId: sourceRecord.id,
            sourceFieldId,
            itemIndex: itemIdx,
            normalizationTime: new Date().toISOString()
          }
        });
      });
    });

    // Create the target set
    const targetSet = {
      id: targetSetId,
      name: targetSetName,
      fields: targetFields,
      records,
      derivation: {
        type: 'normalized',
        sourceSetId,
        sourceFieldId,
        syncMode
      },
      sync: {
        mode: syncMode,
        autoSync: true,
        lastSyncedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    };

    // Update source field to be a link
    const updatedSourceField = {
      ...sourceField,
      type: 'link',
      originalType: sourceField.type,
      options: {
        ...sourceField.options,
        linkedSetId: targetSetId,
        displayConfig: {
          defaultMode: FieldDisplayModes.CHIPS,
          defaultHorizon: HorizonLevels.DETAILED
        }
      },
      normalization: {
        targetSetId,
        syncMode
      }
    };

    return {
      targetSet,
      updatedSourceField,
      recordCount: records.length
    };
  }

  /**
   * Map inferred type to Noema FieldTypes
   */
  _mapToNoemaFieldType(inferredType) {
    const mapping = {
      text: 'text',
      string: 'text',
      number: 'number',
      checkbox: 'checkbox',
      boolean: 'checkbox',
      email: 'email',
      url: 'url',
      date: 'date',
      json: 'json',
      select: 'select'
    };
    return mapping[inferredType] || 'text';
  }

  /**
   * Render normalization wizard UI
   */
  renderNormalizationWizard(analysis, sourceSetId, sourceFieldId) {
    const { itemCount, schema, suggestedName, preview } = analysis;

    let html = `
      <div class="fdm-normalize-wizard">
        <div class="fdm-normalize-header">
          <i class="ph ph-lightning"></i>
          <h3>Normalize Nested Data</h3>
        </div>

        <div class="fdm-normalize-stats">
          <span class="fdm-normalize-stat">
            <strong>${itemCount}</strong> items to extract
          </span>
          <span class="fdm-normalize-stat">
            <strong>${schema.length}</strong> fields detected
          </span>
        </div>

        <div class="fdm-normalize-section">
          <h4>Detected Schema</h4>
          <table class="fdm-normalize-schema-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Coverage</th>
                <th>Sample Values</th>
              </tr>
            </thead>
            <tbody>
    `;

    schema.forEach(field => {
      const displayMgr = new FieldDisplayModesManager(this.workbench);
      const typeStyle = displayMgr.getTypeStyle(field.type);
      const coverage = Math.round(field.coverage * 100);
      const samples = field.samples.slice(0, 2).map(s =>
        typeof s === 'object' ? '{...}' : String(s).substring(0, 20)
      ).join(', ');

      html += `
        <tr>
          <td><strong>${this._escapeHtml(field.key)}</strong></td>
          <td><span class="fdm-type-badge fdm-type-${typeStyle.color}"><i class="ph ${typeStyle.icon}"></i> ${typeStyle.label}</span></td>
          <td>${coverage}%</td>
          <td class="fdm-sample-values">${this._escapeHtml(samples)}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>

        <div class="fdm-normalize-section">
          <h4>Target Set</h4>
          <div class="fdm-normalize-input-group">
            <label>Set Name</label>
            <input type="text" class="fdm-normalize-input" id="fdm-target-set-name" value="${this._escapeHtml(suggestedName)}" />
          </div>
        </div>

        <div class="fdm-normalize-section">
          <h4>Sync Mode</h4>
          <div class="fdm-normalize-sync-options">
            <label class="fdm-normalize-radio">
              <input type="radio" name="fdm-sync-mode" value="bidirectional" checked />
              <span class="fdm-radio-label">
                <strong>Bidirectional</strong>
                <small>Changes sync both ways (recommended)</small>
              </span>
            </label>
            <label class="fdm-normalize-radio">
              <input type="radio" name="fdm-sync-mode" value="source_to_target" />
              <span class="fdm-radio-label">
                <strong>Source → Target</strong>
                <small>JSON is authoritative</small>
              </span>
            </label>
            <label class="fdm-normalize-radio">
              <input type="radio" name="fdm-sync-mode" value="target_to_source" />
              <span class="fdm-radio-label">
                <strong>Target → Source</strong>
                <small>Set is authoritative</small>
              </span>
            </label>
            <label class="fdm-normalize-radio">
              <input type="radio" name="fdm-sync-mode" value="none" />
              <span class="fdm-radio-label">
                <strong>Snapshot</strong>
                <small>One-time extraction, no ongoing sync</small>
              </span>
            </label>
          </div>
        </div>

        <div class="fdm-normalize-section">
          <label class="fdm-normalize-checkbox">
            <input type="checkbox" id="fdm-create-backlink" checked />
            <span>Add backlink field to parent record</span>
          </label>
        </div>

        <div class="fdm-normalize-actions">
          <button class="fdm-btn fdm-btn-secondary" data-action="cancel">Cancel</button>
          <button class="fdm-btn fdm-btn-primary" data-action="normalize">
            <i class="ph ph-lightning"></i> Normalize
          </button>
        </div>
      </div>
    `;

    return html;
  }

  _escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FieldDisplayModes,
    HorizonLevels,
    TypeStyles,
    FieldDisplayModesManager,
    NestedDataNormalizationManager
  };
}

// Also make available globally for browser
if (typeof window !== 'undefined') {
  window.FieldDisplayModes = FieldDisplayModes;
  window.HorizonLevels = HorizonLevels;
  window.TypeStyles = TypeStyles;
  window.FieldDisplayModesManager = FieldDisplayModesManager;
  window.NestedDataNormalizationManager = NestedDataNormalizationManager;
}
