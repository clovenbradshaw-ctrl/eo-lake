/**
 * Noema JSON Navigator
 *
 * Provides n8n-style drill-down navigation for JSON fields.
 * Instead of showing the entire JSON tree at once, shows one level at a time
 * with breadcrumb navigation to drill down or back up.
 *
 * Key features:
 * - Single level view: Only shows immediate keys/values at current path
 * - Breadcrumb navigation: Click to navigate to any parent level
 * - Type-aware rendering: Different styles for objects, arrays, primitives
 * - Inline navigation: Click on nested values to drill down
 */

const JsonNavigator = {
  // Instance state is stored per-cell using data attributes

  /**
   * Create a navigator instance for a cell
   */
  create(containerId, value, options = {}) {
    const state = {
      containerId,
      path: [],
      data: this._parseValue(value),
      options: {
        maxItems: options.maxItems || 50,
        showTypes: options.showTypes !== false,
        ...options
      }
    };

    return state;
  },

  /**
   * Parse value to ensure it's a usable object
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
  },

  /**
   * Get value at current path
   */
  getValueAtPath(data, path) {
    let current = data;

    for (const key of path) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  },

  /**
   * Get the type label for a value
   */
  getValueType(value) {
    if (value === null) return { type: 'null', label: 'null', icon: 'ph-prohibit' };
    if (value === undefined) return { type: 'undefined', label: 'undefined', icon: 'ph-question' };
    if (Array.isArray(value)) return { type: 'array', label: `Array(${value.length})`, icon: 'ph-brackets-square' };
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      return { type: 'object', label: `Object(${keys.length})`, icon: 'ph-brackets-curly' };
    }
    if (typeof value === 'boolean') return { type: 'boolean', label: value ? 'true' : 'false', icon: 'ph-toggle-left' };
    if (typeof value === 'number') return { type: 'number', label: 'number', icon: 'ph-hash' };
    if (typeof value === 'string') {
      // Check for special string types
      if (value.startsWith('rec')) return { type: 'string', label: 'record id', icon: 'ph-identification-card' };
      if (value.includes('@')) return { type: 'string', label: 'email', icon: 'ph-envelope' };
      if (value.startsWith('http')) return { type: 'string', label: 'url', icon: 'ph-link' };
      if (/^\+?\d[\d\s-]{6,}$/.test(value)) return { type: 'string', label: 'phone', icon: 'ph-phone' };
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return { type: 'string', label: 'date', icon: 'ph-calendar' };
      return { type: 'string', label: 'string', icon: 'ph-text-t' };
    }
    return { type: 'unknown', label: typeof value, icon: 'ph-question' };
  },

  /**
   * Check if a value can be drilled into
   */
  isDrillable(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return false;
  },

  /**
   * Render the breadcrumb navigation
   */
  renderBreadcrumbs(state) {
    const { path, containerId } = state;

    let html = '<div class="jnav-breadcrumbs">';

    // Root/back button
    html += `<button class="jnav-breadcrumb jnav-breadcrumb-root" data-container="${containerId}" data-path-index="-1">`;
    html += '<i class="ph ph-house"></i>';
    html += '</button>';

    // Path segments
    path.forEach((segment, index) => {
      html += '<span class="jnav-breadcrumb-sep"><i class="ph ph-caret-right"></i></span>';
      html += `<button class="jnav-breadcrumb jnav-breadcrumb-segment" data-container="${containerId}" data-path-index="${index}">`;
      html += this._escapeHtml(String(segment));
      html += '</button>';
    });

    html += '</div>';

    return html;
  },

  /**
   * Render the current level's content
   */
  renderLevel(state) {
    const { data, path, containerId, options } = state;
    const current = this.getValueAtPath(data, path);

    // Handle null/undefined
    if (current === null || current === undefined) {
      return `<div class="jnav-empty"><span class="jnav-null">${current === null ? 'null' : 'undefined'}</span></div>`;
    }

    // Handle primitives at this level (shouldn't happen often)
    if (typeof current !== 'object') {
      return this.renderPrimitiveValue(current, state);
    }

    // Handle arrays and objects
    const isArray = Array.isArray(current);
    const entries = isArray
      ? current.map((v, i) => [i, v])
      : Object.entries(current);

    if (entries.length === 0) {
      return `<div class="jnav-empty">${isArray ? 'Empty array' : 'Empty object'}</div>`;
    }

    // Limit display
    const displayEntries = entries.slice(0, options.maxItems);
    const hasMore = entries.length > options.maxItems;

    let html = '<div class="jnav-level">';

    displayEntries.forEach(([key, value]) => {
      const typeInfo = this.getValueType(value);
      const drillable = this.isDrillable(value);
      const rowClasses = ['jnav-row'];
      if (drillable) rowClasses.push('jnav-row-drillable');

      html += `<div class="${rowClasses.join(' ')}"`;
      if (drillable) {
        html += ` data-container="${containerId}" data-key="${this._escapeHtml(String(key))}"`;
      }
      html += '>';

      // Key column
      html += '<div class="jnav-key">';
      if (isArray) {
        html += `<span class="jnav-index">${key}</span>`;
      } else {
        html += `<span class="jnav-field-name">${this._escapeHtml(String(key))}</span>`;
      }
      html += '</div>';

      // Value column
      html += '<div class="jnav-value">';

      if (drillable) {
        // Show type badge and preview for drillable values
        html += `<span class="jnav-type-badge jnav-type-${typeInfo.type}">`;
        html += `<i class="ph ${typeInfo.icon}"></i>`;
        html += `<span>${typeInfo.label}</span>`;
        html += '</span>';

        // Add preview for objects/arrays
        html += '<span class="jnav-preview">';
        html += this._getPreview(value);
        html += '</span>';

        // Drill indicator
        html += '<span class="jnav-drill-indicator"><i class="ph ph-caret-right"></i></span>';
      } else {
        // Render primitive value inline
        html += this.renderInlineValue(value, typeInfo);
      }

      html += '</div>';
      html += '</div>';
    });

    if (hasMore) {
      html += `<div class="jnav-row jnav-row-more">`;
      html += `<span class="jnav-more-count">+${entries.length - options.maxItems} more items</span>`;
      html += '</div>';
    }

    html += '</div>';

    return html;
  },

  /**
   * Get a short preview of a drillable value
   */
  _getPreview(value) {
    if (Array.isArray(value)) {
      if (value.length === 0) return '';
      // Show first few values/types
      const previews = value.slice(0, 3).map(v => {
        if (v === null) return 'null';
        if (typeof v === 'object') return Array.isArray(v) ? '[...]' : '{...}';
        if (typeof v === 'string') return `"${v.substring(0, 15)}${v.length > 15 ? '...' : ''}"`;
        return String(v);
      });
      return this._escapeHtml(previews.join(', ') + (value.length > 3 ? ', ...' : ''));
    }

    if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value);
      if (keys.length === 0) return '';
      const preview = keys.slice(0, 4).join(', ');
      return this._escapeHtml(preview + (keys.length > 4 ? ', ...' : ''));
    }

    return '';
  },

  /**
   * Render a primitive value inline
   */
  renderInlineValue(value, typeInfo) {
    if (value === null) {
      return '<span class="jnav-null">null</span>';
    }

    if (value === undefined) {
      return '<span class="jnav-undefined">undefined</span>';
    }

    if (typeof value === 'boolean') {
      return `<span class="jnav-boolean jnav-boolean-${value}">${value}</span>`;
    }

    if (typeof value === 'number') {
      return `<span class="jnav-number">${value}</span>`;
    }

    if (typeof value === 'string') {
      // Truncate long strings
      const display = value.length > 100 ? value.substring(0, 100) + '...' : value;

      // Special rendering for certain types
      if (typeInfo.label === 'url') {
        return `<a href="${this._escapeHtml(value)}" target="_blank" class="jnav-url">${this._escapeHtml(display)}</a>`;
      }
      if (typeInfo.label === 'email') {
        return `<a href="mailto:${this._escapeHtml(value)}" class="jnav-email">${this._escapeHtml(display)}</a>`;
      }

      return `<span class="jnav-string">${this._escapeHtml(display)}</span>`;
    }

    return `<span class="jnav-unknown">${this._escapeHtml(String(value))}</span>`;
  },

  /**
   * Render when we've drilled into a primitive
   */
  renderPrimitiveValue(value, state) {
    const typeInfo = this.getValueType(value);

    let html = '<div class="jnav-primitive-view">';
    html += `<div class="jnav-type-indicator">`;
    html += `<i class="ph ${typeInfo.icon}"></i>`;
    html += `<span>${typeInfo.label}</span>`;
    html += '</div>';
    html += '<div class="jnav-primitive-value">';
    html += this.renderInlineValue(value, typeInfo);
    html += '</div>';
    html += '</div>';

    return html;
  },

  /**
   * Full render of the navigator
   */
  render(state) {
    let html = `<div class="jnav-container" id="${state.containerId}">`;

    // Breadcrumbs (always show, root is home)
    html += this.renderBreadcrumbs(state);

    // Current level content
    html += this.renderLevel(state);

    html += '</div>';

    return html;
  },

  /**
   * Navigate to a path
   */
  navigateTo(state, newPath) {
    state.path = [...newPath];
    return this.render(state);
  },

  /**
   * Drill down one level
   */
  drillDown(state, key) {
    state.path.push(key);
    return this.render(state);
  },

  /**
   * Go up to a specific path index (-1 for root)
   */
  goUp(state, pathIndex) {
    if (pathIndex < 0) {
      state.path = [];
    } else {
      state.path = state.path.slice(0, pathIndex + 1);
    }
    return this.render(state);
  },

  /**
   * Escape HTML special characters
   */
  _escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

/**
 * JSON Navigator Manager
 * Manages multiple navigator instances and handles events
 */
class JsonNavigatorManager {
  constructor() {
    this.instances = new Map();
    this._boundClickHandler = this._handleClick.bind(this);
    this._initialized = false;
    this._viewMode = new Map(); // containerId -> 'simple' | 'tree'
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
   * Create a new navigator instance
   */
  createNavigator(containerId, value, options = {}) {
    const state = JsonNavigator.create(containerId, value, options);
    this.instances.set(containerId, state);
    return JsonNavigator.render(state);
  }

  /**
   * Get navigator state by container ID
   */
  getState(containerId) {
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
   * Handle click events for navigation
   */
  _handleClick(e) {
    // Check for mode toggle button click
    const modeBtn = e.target.closest('.jnav-mode-btn');
    if (modeBtn) {
      const wrapperId = modeBtn.dataset.wrapperId;
      const newMode = modeBtn.dataset.mode;

      if (wrapperId && newMode) {
        e.preventDefault();
        e.stopPropagation();
        this.switchMode(wrapperId, newMode);
      }
      return;
    }

    // Check for breadcrumb click
    const breadcrumb = e.target.closest('.jnav-breadcrumb');
    if (breadcrumb) {
      const containerId = breadcrumb.dataset.container;
      const pathIndex = parseInt(breadcrumb.dataset.pathIndex, 10);
      const state = this.instances.get(containerId);

      if (state) {
        e.preventDefault();
        e.stopPropagation();
        const html = JsonNavigator.goUp(state, pathIndex);
        this._updateContainer(containerId, html);
      }
      return;
    }

    // Check for drillable row click
    const drillableRow = e.target.closest('.jnav-row-drillable');
    if (drillableRow) {
      const containerId = drillableRow.dataset.container;
      const key = drillableRow.dataset.key;
      const state = this.instances.get(containerId);

      if (state && key !== undefined) {
        e.preventDefault();
        e.stopPropagation();

        // Parse key - could be numeric for arrays
        const parsedKey = /^\d+$/.test(key) ? parseInt(key, 10) : key;
        const html = JsonNavigator.drillDown(state, parsedKey);
        this._updateContainer(containerId, html);
      }
      return;
    }
  }

  /**
   * Clean up instance
   */
  destroyNavigator(containerId) {
    this.instances.delete(containerId);
    this._viewMode.delete(containerId);
  }

  /**
   * Clean up all
   */
  destroy() {
    document.removeEventListener('click', this._boundClickHandler);
    this.instances.clear();
    this._viewMode.clear();
    this._initialized = false;
  }

  /**
   * Create navigator with mode toggle support
   * @param {string} containerId - Unique container ID
   * @param {*} value - JSON data to display
   * @param {object} options - Configuration options
   * @param {boolean} options.showModeToggle - Show toggle between simple/tree views
   * @param {string} options.defaultMode - 'simple' or 'tree'
   */
  createNavigatorWithToggle(containerId, value, options = {}) {
    const { showModeToggle = true, defaultMode = 'simple' } = options;

    this._viewMode.set(containerId, defaultMode);

    if (defaultMode === 'tree' && typeof nestedJsonViewerManager !== 'undefined') {
      return this._renderTreeMode(containerId, value, options, showModeToggle);
    }

    const navHtml = this.createNavigator(containerId, value, options);
    if (!showModeToggle) return navHtml;

    return this._wrapWithModeToggle(navHtml, containerId, 'simple', value);
  }

  /**
   * Render tree mode view
   */
  _renderTreeMode(containerId, value, options, showModeToggle) {
    // Store value for mode switching
    this._storeValue(containerId, value);

    const treeContainerId = `njv-${containerId}`;
    nestedJsonViewerManager.init();

    const treeHtml = nestedJsonViewerManager.createViewer(treeContainerId, value, {
      maxDepth: options.maxDepth || 6,
      showStats: options.showStats !== false,
      showBreadcrumb: true,
      showDepthControls: true,
      initialExpandDepth: options.initialExpandDepth || 1
    });

    if (!showModeToggle) return treeHtml;

    return this._wrapWithModeToggle(treeHtml, containerId, 'tree', value);
  }

  /**
   * Store value for container (for mode switching)
   */
  _storeValue(containerId, value) {
    if (!this._storedValues) {
      this._storedValues = new Map();
    }
    this._storedValues.set(containerId, value);
  }

  /**
   * Get stored value for container
   */
  _getStoredValue(containerId) {
    return this._storedValues?.get(containerId);
  }

  /**
   * Wrap navigator HTML with mode toggle buttons
   */
  _wrapWithModeToggle(html, containerId, currentMode, value) {
    this._storeValue(containerId, value);

    const isSimple = currentMode === 'simple';
    const isTree = currentMode === 'tree';

    return `
      <div class="jnav-mode-wrapper" id="jnav-wrapper-${containerId}">
        <div class="jnav-mode-toggle">
          <button class="jnav-mode-btn ${isSimple ? 'jnav-mode-active' : ''}"
                  data-wrapper-id="${containerId}"
                  data-mode="simple"
                  title="Simple navigation">
            <i class="ph ph-compass"></i>
            <span>Navigate</span>
          </button>
          <button class="jnav-mode-btn ${isTree ? 'jnav-mode-active' : ''}"
                  data-wrapper-id="${containerId}"
                  data-mode="tree"
                  title="Tree view with depth tracking">
            <i class="ph ph-git-branch"></i>
            <span>Tree View</span>
          </button>
        </div>
        <div class="jnav-mode-content">
          ${html}
        </div>
      </div>
    `;
  }

  /**
   * Switch view mode for a container
   */
  switchMode(containerId, newMode) {
    const value = this._getStoredValue(containerId);
    if (!value) return;

    this._viewMode.set(containerId, newMode);

    const wrapper = document.getElementById(`jnav-wrapper-${containerId}`);
    if (!wrapper) return;

    // Clean up old instances
    this.destroyNavigator(containerId);
    if (typeof nestedJsonViewerManager !== 'undefined') {
      nestedJsonViewerManager.destroyViewer(`njv-${containerId}`);
    }

    // Re-render with new mode
    const newHtml = this.createNavigatorWithToggle(containerId, value, {
      showModeToggle: true,
      defaultMode: newMode
    });

    wrapper.outerHTML = newHtml;
  }
}

// Create global instance
const jsonNavigatorManager = new JsonNavigatorManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    JsonNavigator,
    JsonNavigatorManager,
    jsonNavigatorManager
  };
}

// Make available globally for browser
if (typeof window !== 'undefined') {
  window.JsonNavigator = JsonNavigator;
  window.JsonNavigatorManager = JsonNavigatorManager;
  window.jsonNavigatorManager = jsonNavigatorManager;
}
