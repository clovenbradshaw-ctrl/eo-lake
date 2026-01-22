/**
 * Noema Nested JSON Viewer
 *
 * Interactive tree-table viewer for deeply nested JSON data.
 * Provides depth tracking, type badges, schema visualization,
 * and multiple view modes (tree, schema, stats).
 *
 * Key features:
 * - Tree View: Collapsible hierarchy with depth indicators
 * - Schema View: Structural map of the data shape
 * - Stats Panel: Depth, object/array counts, key counts
 * - Breadcrumb navigation for drill-down
 * - Expand-to-depth controls
 *
 * EO Alignment:
 * - Raw data = Given (uninterpreted)
 * - Tree/Schema views = Meant (interpreted structure)
 */

// ============================================================================
// Constants
// ============================================================================

const NestedViewModes = Object.freeze({
  TREE: 'tree',
  SCHEMA: 'schema',
  STATS: 'stats'
});

const DepthColors = [
  'njv-depth-1', // blue
  'njv-depth-2', // green
  'njv-depth-3', // yellow
  'njv-depth-4', // orange
  'njv-depth-5', // red
  'njv-depth-6'  // purple
];

// ============================================================================
// NestedJsonViewer Class
// ============================================================================

class NestedJsonViewer {
  constructor(options = {}) {
    this.options = {
      maxDepth: 6,
      maxItems: 100,
      showStats: true,
      showBreadcrumb: true,
      showDepthControls: true,
      initialExpandDepth: 1,
      ...options
    };

    this.containerId = null;
    this.data = null;
    this.expandedPaths = new Set();
    this.focusPath = '';
    this.viewMode = NestedViewModes.TREE;
  }

  // ==========================================================================
  // Core Methods
  // ==========================================================================

  /**
   * Create a viewer instance with data
   */
  create(containerId, value, options = {}) {
    this.containerId = containerId;
    this.data = this._parseValue(value);
    this.options = { ...this.options, ...options };
    this.expandedPaths = new Set();
    this.focusPath = '';

    // Auto-expand to initial depth
    if (this.options.initialExpandDepth > 0) {
      this._expandToDepth(this.options.initialExpandDepth);
    }

    return this.render();
  }

  /**
   * Parse value ensuring it's a usable object
   */
  _parseValue(value) {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
    return value;
  }

  // ==========================================================================
  // Stats Calculation
  // ==========================================================================

  /**
   * Calculate statistics about the data structure
   */
  calculateStats(obj, depth = 0) {
    const stats = {
      maxDepth: depth,
      totalKeys: 0,
      objects: 0,
      arrays: 0,
      primitives: 0
    };

    if (obj === null || typeof obj !== 'object') {
      stats.primitives++;
      return stats;
    }

    if (Array.isArray(obj)) {
      stats.arrays++;
      obj.forEach(item => {
        const childStats = this.calculateStats(item, depth + 1);
        stats.maxDepth = Math.max(stats.maxDepth, childStats.maxDepth);
        stats.totalKeys += childStats.totalKeys;
        stats.objects += childStats.objects;
        stats.arrays += childStats.arrays;
        stats.primitives += childStats.primitives;
      });
    } else {
      stats.objects++;
      Object.entries(obj).forEach(([key, value]) => {
        stats.totalKeys++;
        const childStats = this.calculateStats(value, depth + 1);
        stats.maxDepth = Math.max(stats.maxDepth, childStats.maxDepth);
        stats.totalKeys += childStats.totalKeys;
        stats.objects += childStats.objects;
        stats.arrays += childStats.arrays;
        stats.primitives += childStats.primitives;
      });
    }

    return stats;
  }

  // ==========================================================================
  // Rendering - Main
  // ==========================================================================

  /**
   * Full render of the viewer
   */
  render() {
    if (!this.data) {
      return `<div class="njv-container njv-empty" id="${this.containerId}">
        <span class="njv-empty-message">No data</span>
      </div>`;
    }

    const stats = this.calculateStats(this.data);

    let html = `<div class="njv-container" id="${this.containerId}">`;

    // Stats panel
    if (this.options.showStats) {
      html += this._renderStatsPanel(stats);
    }

    // View mode selector and depth controls
    html += '<div class="njv-controls">';
    html += this._renderViewModeSelector();
    if (this.options.showDepthControls) {
      html += this._renderDepthControls(stats.maxDepth);
    }
    html += '</div>';

    // Breadcrumb
    if (this.options.showBreadcrumb && this.focusPath) {
      html += this._renderBreadcrumb();
    }

    // Main content based on view mode
    switch (this.viewMode) {
      case NestedViewModes.TREE:
        html += this._renderTreeView();
        break;
      case NestedViewModes.SCHEMA:
        html += this._renderSchemaView();
        break;
      case NestedViewModes.STATS:
        html += this._renderDetailedStats(stats);
        break;
    }

    html += '</div>';
    return html;
  }

  // ==========================================================================
  // Rendering - Stats Panel
  // ==========================================================================

  _renderStatsPanel(stats) {
    return `
      <div class="njv-stats-panel">
        <div class="njv-stat njv-stat-depth">
          <span class="njv-stat-value">${stats.maxDepth}</span>
          <span class="njv-stat-label">Max Depth</span>
        </div>
        <div class="njv-stat njv-stat-objects">
          <span class="njv-stat-value">${stats.objects}</span>
          <span class="njv-stat-label">Objects</span>
        </div>
        <div class="njv-stat njv-stat-arrays">
          <span class="njv-stat-value">${stats.arrays}</span>
          <span class="njv-stat-label">Arrays</span>
        </div>
        <div class="njv-stat njv-stat-primitives">
          <span class="njv-stat-value">${stats.primitives}</span>
          <span class="njv-stat-label">Primitives</span>
        </div>
        <div class="njv-stat njv-stat-keys">
          <span class="njv-stat-value">${stats.totalKeys}</span>
          <span class="njv-stat-label">Total Keys</span>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // Rendering - Controls
  // ==========================================================================

  _renderViewModeSelector() {
    const modes = [
      { id: NestedViewModes.TREE, label: 'Tree', icon: 'ph-git-branch' },
      { id: NestedViewModes.SCHEMA, label: 'Schema', icon: 'ph-stack' },
      { id: NestedViewModes.STATS, label: 'Analysis', icon: 'ph-chart-bar' }
    ];

    let html = '<div class="njv-view-modes">';
    modes.forEach(mode => {
      const isActive = this.viewMode === mode.id;
      html += `
        <button class="njv-view-btn ${isActive ? 'njv-view-active' : ''}"
                data-container="${this.containerId}"
                data-view="${mode.id}">
          <i class="ph ${mode.icon}"></i>
          <span>${mode.label}</span>
        </button>
      `;
    });
    html += '</div>';
    return html;
  }

  _renderDepthControls(maxDepth) {
    const displayDepth = Math.min(maxDepth, this.options.maxDepth);

    let html = '<div class="njv-depth-controls">';
    html += '<span class="njv-depth-label">Expand:</span>';

    for (let d = 1; d <= displayDepth; d++) {
      html += `
        <button class="njv-depth-btn"
                data-container="${this.containerId}"
                data-depth="${d}"
                title="Expand to level ${d}">
          L${d}
        </button>
      `;
    }

    html += `
      <button class="njv-depth-btn njv-collapse-btn"
              data-container="${this.containerId}"
              data-depth="0"
              title="Collapse all">
        <i class="ph ph-minus"></i>
      </button>
    `;

    html += '</div>';
    return html;
  }

  // ==========================================================================
  // Rendering - Breadcrumb
  // ==========================================================================

  _renderBreadcrumb() {
    if (!this.focusPath) return '';

    const parts = this.focusPath.split('.');

    let html = '<div class="njv-breadcrumb">';
    html += `
      <button class="njv-breadcrumb-item njv-breadcrumb-root"
              data-container="${this.containerId}"
              data-path="">
        <i class="ph ph-house"></i>
        root
      </button>
    `;

    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('.');
      const isLast = i === parts.length - 1;

      html += '<span class="njv-breadcrumb-sep"><i class="ph ph-caret-right"></i></span>';
      html += `
        <button class="njv-breadcrumb-item ${isLast ? 'njv-breadcrumb-current' : ''}"
                data-container="${this.containerId}"
                data-path="${this._escapeHtml(path)}">
          ${this._escapeHtml(part)}
        </button>
      `;
    });

    html += '</div>';
    return html;
  }

  // ==========================================================================
  // Rendering - Tree View
  // ==========================================================================

  _renderTreeView() {
    let html = '<div class="njv-tree-container">';
    html += '<table class="njv-tree-table">';

    // Header
    html += `
      <thead>
        <tr>
          <th class="njv-th njv-th-depth">Depth</th>
          <th class="njv-th njv-th-key">Key</th>
          <th class="njv-th njv-th-type">Type</th>
          <th class="njv-th njv-th-value">Value / Preview</th>
          <th class="njv-th njv-th-path">Path</th>
        </tr>
      </thead>
    `;

    // Body
    html += '<tbody>';

    if (typeof this.data === 'object' && this.data !== null) {
      Object.entries(this.data).forEach(([key, value]) => {
        html += this._renderTreeRow(key, value, 0, '');
      });
    } else {
      html += this._renderTreeRow('value', this.data, 0, '');
    }

    html += '</tbody>';
    html += '</table>';
    html += '</div>';

    return html;
  }

  _renderTreeRow(keyName, value, depth, parentPath) {
    const currentPath = parentPath ? `${parentPath}.${keyName}` : keyName;
    const isExpandable = value !== null && typeof value === 'object';
    const isExpanded = this.expandedPaths.has(currentPath);
    const isArray = Array.isArray(value);

    let html = '';

    // Main row
    const rowClasses = ['njv-row'];
    if (depth === 0) rowClasses.push('njv-row-root');
    if (isExpandable) rowClasses.push('njv-row-expandable');
    if (isExpanded) rowClasses.push('njv-row-expanded');

    html += `
      <tr class="${rowClasses.join(' ')}"
          data-container="${this.containerId}"
          data-path="${this._escapeHtml(currentPath)}"
          ${isExpandable ? 'data-expandable="true"' : ''}>
    `;

    // Depth column
    html += `<td class="njv-td njv-td-depth">${this._renderDepthIndicator(depth)}</td>`;

    // Key column
    html += `<td class="njv-td njv-td-key" style="padding-left: ${depth * 20 + 12}px">`;
    html += '<div class="njv-key-content">';

    if (isExpandable) {
      html += `<span class="njv-expand-icon">${isExpanded ?
        '<i class="ph ph-caret-down"></i>' :
        '<i class="ph ph-caret-right"></i>'}</span>`;
    } else {
      html += '<span class="njv-expand-spacer"></span>';
    }

    const keyClass = depth === 0 ? 'njv-key-root' : (isArray ? 'njv-key-index' : 'njv-key-name');
    html += `<span class="${keyClass}">${isArray && parentPath ? `[${keyName}]` : this._escapeHtml(String(keyName))}</span>`;
    html += '</div>';
    html += '</td>';

    // Type column
    html += `<td class="njv-td njv-td-type">${this._renderTypeBadge(value)}</td>`;

    // Value column
    html += `<td class="njv-td njv-td-value">`;
    if (!isExpanded) {
      html += `<span class="njv-preview">${this._getPreview(value)}</span>`;
    }
    html += '</td>';

    // Path column
    html += `<td class="njv-td njv-td-path"><span class="njv-path-text">${this._escapeHtml(currentPath)}</span></td>`;

    html += '</tr>';

    // Child rows if expanded
    if (isExpanded && isExpandable) {
      const entries = isArray ? value.map((v, i) => [i, v]) : Object.entries(value);
      entries.forEach(([k, v]) => {
        html += this._renderTreeRow(k, v, depth + 1, currentPath);
      });
    }

    return html;
  }

  _renderDepthIndicator(depth) {
    const maxDots = Math.min(depth + 1, this.options.maxDepth);

    let html = '<div class="njv-depth-indicator">';

    for (let i = 0; i < this.options.maxDepth; i++) {
      const colorClass = i < maxDots ? DepthColors[i % DepthColors.length] : 'njv-depth-empty';
      html += `<span class="njv-depth-dot ${colorClass}"></span>`;
    }

    html += `<span class="njv-depth-level">L${depth}</span>`;
    html += '</div>';

    return html;
  }

  _renderTypeBadge(value) {
    const type = this._getType(value);
    const config = {
      object: { class: 'njv-type-object', label: 'OBJ' },
      array: { class: 'njv-type-array', label: `ARR[${value?.length || 0}]` },
      string: { class: 'njv-type-string', label: 'STR' },
      number: { class: 'njv-type-number', label: 'NUM' },
      boolean: { class: 'njv-type-boolean', label: 'BOOL' },
      null: { class: 'njv-type-null', label: 'NULL' },
      undefined: { class: 'njv-type-undefined', label: 'UNDEF' }
    };

    const c = config[type] || { class: 'njv-type-unknown', label: type };
    return `<span class="njv-type-badge ${c.class}">${c.label}</span>`;
  }

  _getType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  _getPreview(value) {
    if (value === null) return '<span class="njv-null">null</span>';
    if (value === undefined) return '<span class="njv-undefined">undefined</span>';

    if (typeof value === 'string') {
      const truncated = value.length > 50 ? `${value.substring(0, 50)}...` : value;
      return `<span class="njv-string">"${this._escapeHtml(truncated)}"</span>`;
    }

    if (typeof value === 'boolean') {
      return `<span class="njv-boolean njv-boolean-${value}">${value}</span>`;
    }

    if (typeof value === 'number') {
      return `<span class="njv-number">${value}</span>`;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return '<span class="njv-empty-arr">[]</span>';
      const previews = value.slice(0, 3).map(v => {
        if (v === null) return 'null';
        if (typeof v === 'object') return Array.isArray(v) ? '[...]' : '{...}';
        if (typeof v === 'string') return `"${v.substring(0, 15)}${v.length > 15 ? '...' : ''}"`;
        return String(v);
      });
      return `<span class="njv-arr-preview">[${this._escapeHtml(previews.join(', '))}${value.length > 3 ? ', ...' : ''}]</span>`;
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return '<span class="njv-empty-obj">{}</span>';
      const preview = keys.slice(0, 4).join(', ');
      return `<span class="njv-obj-preview">{${this._escapeHtml(preview)}${keys.length > 4 ? ', ...' : ''}}</span>`;
    }

    return this._escapeHtml(String(value));
  }

  // ==========================================================================
  // Rendering - Schema View
  // ==========================================================================

  _renderSchemaView() {
    const schema = this._buildSchema(this.data);

    let html = '<div class="njv-schema-container">';
    html += this._renderSchemaNode(schema, 0);
    html += '</div>';

    return html;
  }

  _buildSchema(obj, path = '') {
    if (obj === null) return { type: 'null', path };
    if (obj === undefined) return { type: 'undefined', path };

    if (Array.isArray(obj)) {
      return {
        type: 'array',
        path,
        length: obj.length,
        items: obj.length > 0 ? this._buildSchema(obj[0], `${path}[0]`) : null
      };
    }

    if (typeof obj === 'object') {
      return {
        type: 'object',
        path,
        properties: Object.fromEntries(
          Object.entries(obj).map(([k, v]) => [k, this._buildSchema(v, path ? `${path}.${k}` : k)])
        )
      };
    }

    return { type: typeof obj, path, sample: String(obj).substring(0, 30) };
  }

  _renderSchemaNode(schema, depth) {
    if (!schema) return '';

    let html = '';

    if (schema.type === 'object' && schema.properties) {
      html += '<div class="njv-schema-object">';
      Object.entries(schema.properties).forEach(([key, value]) => {
        html += `
          <div class="njv-schema-property" style="margin-left: ${depth * 16}px">
            <div class="njv-schema-key">
              <span class="njv-schema-key-name">${this._escapeHtml(key)}</span>
              ${this._renderTypeBadge(value.type === 'object' ? {} : value.type === 'array' ? [] : value.type)}
            </div>
            ${(value.type === 'object' || value.type === 'array') ? this._renderSchemaNode(value, depth + 1) : ''}
          </div>
        `;
      });
      html += '</div>';
    } else if (schema.type === 'array' && schema.items) {
      html += `
        <div class="njv-schema-array" style="margin-left: ${depth * 16}px">
          <span class="njv-schema-array-info">[${schema.length} items] →</span>
          ${this._renderSchemaNode(schema.items, depth + 1)}
        </div>
      `;
    }

    return html;
  }

  // ==========================================================================
  // Rendering - Detailed Stats
  // ==========================================================================

  _renderDetailedStats(stats) {
    // Find deepest paths
    const deepPaths = this._findDeepPaths(this.data, '', 0, []);
    const sortedPaths = deepPaths.sort((a, b) => b.depth - a.depth).slice(0, 5);

    // Find largest arrays
    const arrays = this._findArrays(this.data, '', []);
    const sortedArrays = arrays.sort((a, b) => b.length - a.length).slice(0, 5);

    let html = '<div class="njv-detailed-stats">';

    // Summary cards
    html += `
      <div class="njv-stats-grid">
        <div class="njv-stat-card njv-stat-depth-card">
          <div class="njv-stat-card-value">${stats.maxDepth}</div>
          <div class="njv-stat-card-label">Maximum Nesting Depth</div>
          <div class="njv-stat-card-hint">Levels of nested data</div>
        </div>
        <div class="njv-stat-card njv-stat-complexity-card">
          <div class="njv-stat-card-value">${stats.objects + stats.arrays}</div>
          <div class="njv-stat-card-label">Complex Values</div>
          <div class="njv-stat-card-hint">${stats.objects} objects, ${stats.arrays} arrays</div>
        </div>
        <div class="njv-stat-card njv-stat-density-card">
          <div class="njv-stat-card-value">${(stats.totalKeys / Math.max(stats.objects, 1)).toFixed(1)}</div>
          <div class="njv-stat-card-label">Avg Keys/Object</div>
          <div class="njv-stat-card-hint">${stats.totalKeys} total keys</div>
        </div>
      </div>
    `;

    // Deepest paths
    if (sortedPaths.length > 0) {
      html += `
        <div class="njv-stats-section">
          <h4 class="njv-stats-section-title">
            <i class="ph ph-arrow-down-right"></i>
            Deepest Paths
          </h4>
          <div class="njv-stats-list">
            ${sortedPaths.map(p => `
              <div class="njv-stats-list-item">
                <span class="njv-stats-depth-badge">L${p.depth}</span>
                <span class="njv-stats-path">${this._escapeHtml(p.path)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Largest arrays
    if (sortedArrays.length > 0) {
      html += `
        <div class="njv-stats-section">
          <h4 class="njv-stats-section-title">
            <i class="ph ph-brackets-square"></i>
            Largest Arrays
          </h4>
          <div class="njv-stats-list">
            ${sortedArrays.map(a => `
              <div class="njv-stats-list-item">
                <span class="njv-stats-array-badge">${a.length}</span>
                <span class="njv-stats-path">${this._escapeHtml(a.path)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  _findDeepPaths(obj, path, depth, results) {
    if (obj === null || typeof obj !== 'object') {
      if (path) results.push({ path, depth });
      return results;
    }

    if (Array.isArray(obj)) {
      if (obj.length > 0) {
        this._findDeepPaths(obj[0], `${path}[0]`, depth + 1, results);
      }
    } else {
      Object.entries(obj).forEach(([k, v]) => {
        const newPath = path ? `${path}.${k}` : k;
        this._findDeepPaths(v, newPath, depth + 1, results);
      });
    }

    return results;
  }

  _findArrays(obj, path, results) {
    if (obj === null || typeof obj !== 'object') return results;

    if (Array.isArray(obj)) {
      results.push({ path: path || 'root', length: obj.length });
      obj.forEach((item, i) => {
        this._findArrays(item, `${path}[${i}]`, results);
      });
    } else {
      Object.entries(obj).forEach(([k, v]) => {
        this._findArrays(v, path ? `${path}.${k}` : k, results);
      });
    }

    return results;
  }

  // ==========================================================================
  // Navigation Methods
  // ==========================================================================

  /**
   * Toggle expand state for a path
   */
  toggleExpand(path) {
    if (this.expandedPaths.has(path)) {
      this.expandedPaths.delete(path);
    } else {
      this.expandedPaths.add(path);
    }
    return this.render();
  }

  /**
   * Expand all paths to specified depth
   */
  expandToDepth(depth) {
    this._expandToDepth(depth);
    return this.render();
  }

  _expandToDepth(depth) {
    this.expandedPaths.clear();
    if (depth <= 0) return;

    const traverse = (obj, currentPath = '', currentDepth = 0) => {
      if (currentDepth >= depth || !obj || typeof obj !== 'object') return;
      if (currentPath) this.expandedPaths.add(currentPath);

      if (Array.isArray(obj)) {
        obj.forEach((item, i) => {
          traverse(item, `${currentPath}[${i}]`, currentDepth + 1);
        });
      } else {
        Object.entries(obj).forEach(([k, v]) => {
          const newPath = currentPath ? `${currentPath}.${k}` : k;
          traverse(v, newPath, currentDepth + 1);
        });
      }
    };

    traverse(this.data);
  }

  /**
   * Set view mode
   */
  setViewMode(mode) {
    if (Object.values(NestedViewModes).includes(mode)) {
      this.viewMode = mode;
    }
    return this.render();
  }

  /**
   * Navigate to path (for breadcrumb)
   */
  navigateToPath(path) {
    this.focusPath = path;
    return this.render();
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  _escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// ============================================================================
// NestedJsonViewerManager - Event Handler
// ============================================================================

class NestedJsonViewerManager {
  constructor() {
    this.instances = new Map();
    this._boundClickHandler = this._handleClick.bind(this);
    this._initialized = false;
  }

  /**
   * Initialize global event listeners
   */
  init() {
    if (this._initialized) return;
    document.addEventListener('click', this._boundClickHandler);
    this._initialized = true;
  }

  /**
   * Create a new viewer instance
   */
  createViewer(containerId, value, options = {}) {
    const viewer = new NestedJsonViewer(options);
    const html = viewer.create(containerId, value, options);
    this.instances.set(containerId, viewer);
    return html;
  }

  /**
   * Get viewer by container ID
   */
  getViewer(containerId) {
    return this.instances.get(containerId);
  }

  /**
   * Update container with new HTML
   */
  _updateContainer(containerId, html) {
    const container = document.getElementById(containerId);
    if (container) {
      container.outerHTML = html;
    }
  }

  /**
   * Handle click events
   */
  _handleClick(e) {
    // View mode buttons
    const viewBtn = e.target.closest('.njv-view-btn');
    if (viewBtn) {
      const containerId = viewBtn.dataset.container;
      const viewMode = viewBtn.dataset.view;
      const viewer = this.instances.get(containerId);
      if (viewer) {
        e.preventDefault();
        e.stopPropagation();
        const html = viewer.setViewMode(viewMode);
        this._updateContainer(containerId, html);
      }
      return;
    }

    // Depth control buttons
    const depthBtn = e.target.closest('.njv-depth-btn');
    if (depthBtn) {
      const containerId = depthBtn.dataset.container;
      const depth = parseInt(depthBtn.dataset.depth, 10);
      const viewer = this.instances.get(containerId);
      if (viewer) {
        e.preventDefault();
        e.stopPropagation();
        const html = viewer.expandToDepth(depth);
        this._updateContainer(containerId, html);
      }
      return;
    }

    // Expandable row click
    const row = e.target.closest('.njv-row-expandable');
    if (row) {
      const containerId = row.dataset.container;
      const path = row.dataset.path;
      const viewer = this.instances.get(containerId);
      if (viewer) {
        e.preventDefault();
        e.stopPropagation();
        const html = viewer.toggleExpand(path);
        this._updateContainer(containerId, html);
      }
      return;
    }

    // Breadcrumb click
    const breadcrumbItem = e.target.closest('.njv-breadcrumb-item');
    if (breadcrumbItem) {
      const containerId = breadcrumbItem.dataset.container;
      const path = breadcrumbItem.dataset.path;
      const viewer = this.instances.get(containerId);
      if (viewer) {
        e.preventDefault();
        e.stopPropagation();
        const html = viewer.navigateToPath(path);
        this._updateContainer(containerId, html);
      }
      return;
    }
  }

  /**
   * Destroy a viewer instance
   */
  destroyViewer(containerId) {
    this.instances.delete(containerId);
  }

  /**
   * Destroy all
   */
  destroy() {
    document.removeEventListener('click', this._boundClickHandler);
    this.instances.clear();
    this._initialized = false;
  }
}

// Create global instance
const nestedJsonViewerManager = new NestedJsonViewerManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NestedJsonViewer,
    NestedJsonViewerManager,
    nestedJsonViewerManager,
    NestedViewModes
  };
}

// Make available globally for browser
if (typeof window !== 'undefined') {
  window.NestedJsonViewer = NestedJsonViewer;
  window.NestedJsonViewerManager = NestedJsonViewerManager;
  window.nestedJsonViewerManager = nestedJsonViewerManager;
  window.NestedViewModes = NestedViewModes;
}
