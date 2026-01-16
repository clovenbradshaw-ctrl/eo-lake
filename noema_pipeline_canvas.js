/**
 * EO Pipeline Canvas - n8n-Inspired Visual Pipeline Builder
 *
 * A clean, card-based canvas for building data transformation pipelines.
 * Features:
 * - Dotted grid background with infinite pan/zoom
 * - Card-style draggable nodes
 * - Bezier curve connections between nodes
 * - Right-rail inspector for node configuration
 * - Execution state visualization
 */

// ============================================================================
// Node Types & Configuration
// ============================================================================

const CanvasNodeTypes = Object.freeze({
  // Source nodes
  SOURCE: 'source',
  IMPORT: 'import',

  // Transform nodes
  FILTER: 'filter',
  MERGE: 'merge',
  TRANSFORM: 'transform',
  SELECT: 'select',
  DEDUPE: 'dedupe',
  SORT: 'sort',
  CODE: 'code',

  // Output nodes
  AGGREGATE: 'aggregate',
  PREVIEW: 'preview',
  SAVE: 'save',
  EXPORT: 'export'
});

const NodeCategories = {
  source: {
    label: 'Sources',
    icon: 'ph-package',
    color: '#6366f1',
    types: ['source', 'import']
  },
  transform: {
    label: 'Transform',
    icon: 'ph-lightning',
    color: '#f59e0b',
    types: ['filter', 'merge', 'transform', 'select', 'dedupe', 'sort', 'code']
  },
  output: {
    label: 'Output',
    icon: 'ph-chart-bar',
    color: '#10b981',
    types: ['aggregate', 'preview', 'save', 'export']
  }
};

const NodeConfig = {
  source: { icon: 'ph-package', label: 'Set', category: 'source', description: 'Pull records from a data source' },
  import: { icon: 'ph-download', label: 'Import', category: 'source', description: 'Load external data' },
  filter: { icon: 'ph-funnel', label: 'Filter', category: 'transform', description: 'Keep matching records' },
  merge: { icon: 'ph-git-merge', label: 'Merge', category: 'transform', description: 'Combine data sources' },
  transform: { icon: 'ph-pencil', label: 'Transform', category: 'transform', description: 'Modify field values' },
  select: { icon: 'ph-list', label: 'Select', category: 'transform', description: 'Choose fields to keep' },
  dedupe: { icon: 'ph-users-three', label: 'Dedupe', category: 'transform', description: 'Remove duplicates' },
  sort: { icon: 'ph-sort-ascending', label: 'Sort', category: 'transform', description: 'Order records' },
  code: { icon: 'ph-code', label: 'Code', category: 'transform', description: 'Custom JavaScript' },
  aggregate: { icon: 'ph-sigma', label: 'Aggregate', category: 'output', description: 'Calculate summaries' },
  preview: { icon: 'ph-eye', label: 'Preview', category: 'output', description: 'View data at this point' },
  save: { icon: 'ph-floppy-disk', label: 'Save', category: 'output', description: 'Save to a Set' },
  export: { icon: 'ph-export', label: 'Export', category: 'output', description: 'Download or send' }
};

const NodeStatus = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error',
  STALE: 'stale'
});

// ============================================================================
// Pipeline Canvas Class
// ============================================================================

class PipelineCanvas {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    if (!this.container) {
      throw new Error('Pipeline canvas container not found');
    }

    this.options = {
      gridSize: 20,
      minZoom: 0.25,
      maxZoom: 2,
      nodeWidth: 200,
      nodeHeight: 80,
      onNodeSelect: null,
      onNodeChange: null,
      onConnectionChange: null,
      ...options
    };

    // State
    this.nodes = new Map();
    this.connections = [];
    this.selectedNodeId = null;
    this.selectedConnectionId = null;

    // Canvas state
    this.pan = { x: 0, y: 0 };
    this.zoom = 1;
    this.isDragging = false;
    this.isPanning = false;
    this.dragNode = null;
    this.dragOffset = { x: 0, y: 0 };
    this.connectingFrom = null;

    // Elements
    this.elements = {};

    // Initialize
    this._render();
    this._attachEventListeners();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Rendering
  // ═══════════════════════════════════════════════════════════════════════════

  _render() {
    this.container.innerHTML = `
      <div class="pipeline-canvas-wrapper">
        <div class="pipeline-canvas-toolbar">
          <button class="canvas-btn" data-action="add-node" title="Add Node">
            <i class="ph ph-plus"></i>
          </button>
          <div class="canvas-toolbar-divider"></div>
          <button class="canvas-btn" data-action="zoom-in" title="Zoom In">
            <i class="ph ph-magnifying-glass-plus"></i>
          </button>
          <button class="canvas-btn" data-action="zoom-out" title="Zoom Out">
            <i class="ph ph-magnifying-glass-minus"></i>
          </button>
          <button class="canvas-btn" data-action="fit-view" title="Fit to View">
            <i class="ph ph-arrows-out"></i>
          </button>
          <div class="canvas-toolbar-divider"></div>
          <button class="canvas-btn" data-action="run" title="Run Pipeline">
            <i class="ph ph-play"></i>
          </button>
        </div>

        <div class="pipeline-canvas-viewport">
          <svg class="pipeline-canvas-svg">
            <defs>
              <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="var(--canvas-grid-color, #e5e7eb)"/>
              </pattern>
            </defs>
            <rect class="pipeline-canvas-grid" width="100%" height="100%" fill="url(#grid-dots)"/>
            <g class="pipeline-canvas-connections"></g>
          </svg>
          <div class="pipeline-canvas-nodes"></div>
        </div>

        <div class="pipeline-canvas-minimap">
          <canvas class="minimap-canvas" width="150" height="100"></canvas>
        </div>
      </div>
    `;

    this.elements = {
      wrapper: this.container.querySelector('.pipeline-canvas-wrapper'),
      toolbar: this.container.querySelector('.pipeline-canvas-toolbar'),
      viewport: this.container.querySelector('.pipeline-canvas-viewport'),
      svg: this.container.querySelector('.pipeline-canvas-svg'),
      grid: this.container.querySelector('.pipeline-canvas-grid'),
      connectionsGroup: this.container.querySelector('.pipeline-canvas-connections'),
      nodesContainer: this.container.querySelector('.pipeline-canvas-nodes'),
      minimap: this.container.querySelector('.minimap-canvas')
    };

    this._injectStyles();
    this._updateTransform();
  }

  _injectStyles() {
    if (document.getElementById('pipeline-canvas-styles')) return;

    const style = document.createElement('style');
    style.id = 'pipeline-canvas-styles';
    style.textContent = `
      .pipeline-canvas-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 400px;
        background: var(--canvas-bg, #fafafa);
        border-radius: var(--radius-md, 8px);
        overflow: hidden;
      }

      .pipeline-canvas-toolbar {
        position: absolute;
        top: 12px;
        left: 12px;
        display: flex;
        gap: 4px;
        padding: 6px;
        background: var(--bg-primary, white);
        border-radius: var(--radius-md, 8px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 100;
      }

      .canvas-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: var(--radius-sm, 4px);
        cursor: pointer;
        color: var(--text-secondary, #6b7280);
        transition: all 0.15s ease;
      }

      .canvas-btn:hover {
        background: var(--bg-secondary, #f3f4f6);
        color: var(--text-primary, #111827);
      }

      .canvas-btn[data-action="run"] {
        color: var(--primary-color, #6366f1);
      }

      .canvas-btn[data-action="run"]:hover {
        background: var(--primary-light, #eef2ff);
      }

      .canvas-toolbar-divider {
        width: 1px;
        margin: 4px 4px;
        background: var(--border-color, #e5e7eb);
      }

      .pipeline-canvas-viewport {
        position: absolute;
        inset: 0;
        overflow: hidden;
        cursor: grab;
      }

      .pipeline-canvas-viewport.panning {
        cursor: grabbing;
      }

      .pipeline-canvas-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }

      .pipeline-canvas-grid {
        pointer-events: all;
      }

      .pipeline-canvas-nodes {
        position: absolute;
        inset: 0;
        transform-origin: 0 0;
      }

      /* Node card styles */
      .pipeline-node {
        position: absolute;
        width: 200px;
        min-height: 72px;
        background: var(--bg-primary, white);
        border: 2px solid var(--border-color, #e5e7eb);
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        cursor: move;
        user-select: none;
        transition: box-shadow 0.15s ease, border-color 0.15s ease;
      }

      .pipeline-node:hover {
        box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      }

      .pipeline-node.selected {
        border-color: var(--primary-color, #6366f1);
        box-shadow: 0 0 0 3px var(--primary-light, rgba(99, 102, 241, 0.2));
      }

      .pipeline-node.running {
        border-color: var(--primary-color, #6366f1);
        animation: node-pulse 1.5s infinite;
      }

      .pipeline-node.success {
        border-color: var(--success-color, #10b981);
      }

      .pipeline-node.error {
        border-color: var(--error-color, #ef4444);
      }

      .pipeline-node.stale {
        border-color: var(--warning-color, #f59e0b);
        opacity: 0.8;
      }

      @keyframes node-pulse {
        0%, 100% { box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2); }
        50% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.1); }
      }

      .pipeline-node-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
      }

      .pipeline-node-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        font-size: 14px;
      }

      .pipeline-node-icon.source { background: #eef2ff; color: #6366f1; }
      .pipeline-node-icon.transform { background: #fef3c7; color: #f59e0b; }
      .pipeline-node-icon.output { background: #d1fae5; color: #10b981; }

      .pipeline-node-title {
        flex: 1;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary, #111827);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .pipeline-node-status {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--border-color, #e5e7eb);
      }

      .pipeline-node-status.running { background: var(--primary-color, #6366f1); animation: status-blink 0.8s infinite; }
      .pipeline-node-status.success { background: var(--success-color, #10b981); }
      .pipeline-node-status.error { background: var(--error-color, #ef4444); }
      .pipeline-node-status.stale { background: var(--warning-color, #f59e0b); }

      @keyframes status-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      .pipeline-node-body {
        padding: 10px 14px;
        font-size: 12px;
        color: var(--text-secondary, #6b7280);
      }

      .pipeline-node-metric {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary, #111827);
      }

      /* Connection ports */
      .pipeline-node-port {
        position: absolute;
        width: 14px;
        height: 14px;
        background: var(--bg-primary, white);
        border: 2px solid var(--border-color, #e5e7eb);
        border-radius: 50%;
        cursor: crosshair;
        transition: all 0.15s ease;
        z-index: 10;
      }

      .pipeline-node-port:hover {
        transform: scale(1.3);
        border-color: var(--primary-color, #6366f1);
        background: var(--primary-light, #eef2ff);
      }

      .pipeline-node-port.input {
        left: -7px;
        top: 50%;
        transform: translateY(-50%);
      }

      .pipeline-node-port.output {
        right: -7px;
        top: 50%;
        transform: translateY(-50%);
      }

      .pipeline-node-port.input:hover,
      .pipeline-node-port.output:hover {
        transform: translateY(-50%) scale(1.3);
      }

      .pipeline-node-port.connecting {
        border-color: var(--primary-color, #6366f1);
        background: var(--primary-color, #6366f1);
      }

      /* Connections (SVG paths) */
      .pipeline-connection {
        fill: none;
        stroke: var(--border-color, #d1d5db);
        stroke-width: 2;
        pointer-events: stroke;
        cursor: pointer;
        transition: stroke 0.15s ease;
      }

      .pipeline-connection:hover {
        stroke: var(--primary-color, #6366f1);
        stroke-width: 3;
      }

      .pipeline-connection.selected {
        stroke: var(--primary-color, #6366f1);
        stroke-width: 3;
      }

      .pipeline-connection.temp {
        stroke: var(--primary-color, #6366f1);
        stroke-dasharray: 8, 4;
        opacity: 0.6;
      }

      /* Minimap */
      .pipeline-canvas-minimap {
        position: absolute;
        bottom: 12px;
        right: 12px;
        background: var(--bg-primary, white);
        border-radius: var(--radius-md, 8px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        padding: 4px;
        z-index: 100;
      }

      .minimap-canvas {
        display: block;
        border-radius: 4px;
      }

      /* Node palette overlay */
      .pipeline-node-palette {
        position: absolute;
        top: 60px;
        left: 12px;
        width: 220px;
        max-height: calc(100% - 80px);
        background: var(--bg-primary, white);
        border-radius: var(--radius-md, 8px);
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 200;
        overflow: hidden;
        display: none;
      }

      .pipeline-node-palette.visible {
        display: block;
      }

      .palette-search {
        padding: 12px;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
      }

      .palette-search input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--border-color, #e5e7eb);
        border-radius: var(--radius-sm, 4px);
        font-size: 13px;
        outline: none;
      }

      .palette-search input:focus {
        border-color: var(--primary-color, #6366f1);
      }

      .palette-categories {
        padding: 8px;
        max-height: 300px;
        overflow-y: auto;
      }

      .palette-category {
        margin-bottom: 12px;
      }

      .palette-category-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--text-tertiary, #9ca3af);
        letter-spacing: 0.5px;
      }

      .palette-node-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: var(--radius-sm, 4px);
        cursor: pointer;
        transition: background 0.1s ease;
      }

      .palette-node-item:hover {
        background: var(--bg-secondary, #f3f4f6);
      }

      .palette-node-item-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        font-size: 14px;
      }

      .palette-node-item-info {
        flex: 1;
        min-width: 0;
      }

      .palette-node-item-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary, #111827);
      }

      .palette-node-item-desc {
        font-size: 11px;
        color: var(--text-tertiary, #9ca3af);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Empty state */
      .pipeline-canvas-empty {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        color: var(--text-tertiary, #9ca3af);
        pointer-events: none;
      }

      .pipeline-canvas-empty-icon {
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
      }

      .pipeline-canvas-empty-text {
        font-size: 14px;
        margin-bottom: 4px;
      }

      .pipeline-canvas-empty-hint {
        font-size: 12px;
        opacity: 0.7;
      }

      /* Pipeline view toggle */
      .pipeline-view-toggle {
        display: flex;
        gap: 2px;
        padding: 2px;
        background: var(--bg-secondary, #f3f4f6);
        border-radius: var(--radius-sm, 4px);
      }

      .pipeline-view-toggle .toggle-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 24px;
        border: none;
        background: transparent;
        border-radius: 3px;
        cursor: pointer;
        color: var(--text-tertiary, #9ca3af);
        font-size: 14px;
        transition: all 0.15s ease;
      }

      .pipeline-view-toggle .toggle-btn:hover {
        color: var(--text-primary, #111827);
      }

      .pipeline-view-toggle .toggle-btn.active {
        background: var(--bg-primary, white);
        color: var(--primary-color, #6366f1);
        box-shadow: 0 1px 2px rgba(0,0,0,0.08);
      }
    `;
    document.head.appendChild(style);
  }

  _updateTransform() {
    const transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
    this.elements.nodesContainer.style.transform = transform;

    // Update SVG viewBox for connections
    const viewBox = this._getViewBox();
    this.elements.svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);

    // Update grid pattern
    const gridPattern = this.elements.svg.querySelector('#grid-dots');
    if (gridPattern) {
      const scaledSize = this.options.gridSize * this.zoom;
      gridPattern.setAttribute('width', scaledSize);
      gridPattern.setAttribute('height', scaledSize);
      gridPattern.setAttribute('patternTransform', `translate(${this.pan.x % scaledSize}, ${this.pan.y % scaledSize})`);
    }

    this._updateMinimap();
  }

  _getViewBox() {
    const rect = this.elements.viewport.getBoundingClientRect();
    return {
      x: -this.pan.x / this.zoom,
      y: -this.pan.y / this.zoom,
      width: rect.width / this.zoom,
      height: rect.height / this.zoom
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Node Management
  // ═══════════════════════════════════════════════════════════════════════════

  addNode(type, config = {}) {
    const id = config.id || `node_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const nodeConfig = NodeConfig[type];

    if (!nodeConfig) {
      console.error(`Unknown node type: ${type}`);
      return null;
    }

    // Calculate position (center of viewport if not specified)
    const viewBox = this._getViewBox();
    const x = config.x ?? (viewBox.x + viewBox.width / 2 - this.options.nodeWidth / 2);
    const y = config.y ?? (viewBox.y + viewBox.height / 2 - this.options.nodeHeight / 2);

    const node = {
      id,
      type,
      x,
      y,
      label: config.label || nodeConfig.label,
      status: NodeStatus.IDLE,
      config: config.config || {},
      metric: config.metric || null,
      createdAt: new Date().toISOString()
    };

    this.nodes.set(id, node);
    this._renderNode(node);
    this._renderConnections();
    this._updateEmptyState();

    if (this.options.onNodeChange) {
      this.options.onNodeChange('add', node);
    }

    return node;
  }

  removeNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Remove connections involving this node
    this.connections = this.connections.filter(conn =>
      conn.from !== nodeId && conn.to !== nodeId
    );

    // Remove DOM element
    const element = this.elements.nodesContainer.querySelector(`[data-node-id="${nodeId}"]`);
    if (element) {
      element.remove();
    }

    this.nodes.delete(nodeId);

    if (this.selectedNodeId === nodeId) {
      this.selectedNodeId = null;
    }

    this._renderConnections();
    this._updateEmptyState();

    if (this.options.onNodeChange) {
      this.options.onNodeChange('remove', node);
    }
  }

  updateNode(nodeId, updates) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    Object.assign(node, updates);
    this._renderNode(node);
    this._renderConnections();

    if (this.options.onNodeChange) {
      this.options.onNodeChange('update', node);
    }
  }

  selectNode(nodeId) {
    // Deselect previous
    if (this.selectedNodeId) {
      const prevEl = this.elements.nodesContainer.querySelector(`[data-node-id="${this.selectedNodeId}"]`);
      if (prevEl) prevEl.classList.remove('selected');
    }

    this.selectedNodeId = nodeId;
    this.selectedConnectionId = null;

    if (nodeId) {
      const el = this.elements.nodesContainer.querySelector(`[data-node-id="${nodeId}"]`);
      if (el) el.classList.add('selected');
    }

    if (this.options.onNodeSelect) {
      this.options.onNodeSelect(nodeId ? this.nodes.get(nodeId) : null);
    }
  }

  _renderNode(node) {
    const existing = this.elements.nodesContainer.querySelector(`[data-node-id="${node.id}"]`);
    const nodeConfig = NodeConfig[node.type];
    const category = nodeConfig?.category || 'transform';

    const html = `
      <div class="pipeline-node ${node.status}" data-node-id="${node.id}" style="left: ${node.x}px; top: ${node.y}px;">
        <div class="pipeline-node-port input" data-port="input"></div>
        <div class="pipeline-node-header">
          <div class="pipeline-node-icon ${category}">
            <i class="ph ${nodeConfig?.icon || 'ph-cube'}"></i>
          </div>
          <div class="pipeline-node-title">${this._escapeHtml(node.label)}</div>
          <div class="pipeline-node-status ${node.status}"></div>
        </div>
        <div class="pipeline-node-body">
          ${node.metric ? `<div class="pipeline-node-metric">${this._escapeHtml(String(node.metric))}</div>` : ''}
          ${!node.metric ? `<span style="opacity: 0.6;">${nodeConfig?.description || ''}</span>` : ''}
        </div>
        <div class="pipeline-node-port output" data-port="output"></div>
      </div>
    `;

    if (existing) {
      existing.outerHTML = html;
    } else {
      this.elements.nodesContainer.insertAdjacentHTML('beforeend', html);
    }

    // Re-attach event listeners
    const nodeEl = this.elements.nodesContainer.querySelector(`[data-node-id="${node.id}"]`);
    if (nodeEl && this.selectedNodeId === node.id) {
      nodeEl.classList.add('selected');
    }

    this._attachNodeEventListeners(nodeEl, node);
  }

  _updateEmptyState() {
    let emptyState = this.container.querySelector('.pipeline-canvas-empty');

    if (this.nodes.size === 0) {
      if (!emptyState) {
        this.elements.viewport.insertAdjacentHTML('beforeend', `
          <div class="pipeline-canvas-empty">
            <div class="pipeline-canvas-empty-icon">
              <i class="ph ph-flow-arrow"></i>
            </div>
            <div class="pipeline-canvas-empty-text">Start building your data flow</div>
            <div class="pipeline-canvas-empty-hint">Click + to add a node, or drag from the palette</div>
          </div>
        `);
      }
    } else if (emptyState) {
      emptyState.remove();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Connections
  // ═══════════════════════════════════════════════════════════════════════════

  addConnection(fromNodeId, toNodeId) {
    // Validate nodes exist
    if (!this.nodes.has(fromNodeId) || !this.nodes.has(toNodeId)) {
      return null;
    }

    // Check for existing connection
    const exists = this.connections.find(c => c.from === fromNodeId && c.to === toNodeId);
    if (exists) return exists;

    // Check for cycles (simple check)
    if (this._wouldCreateCycle(fromNodeId, toNodeId)) {
      console.warn('Connection would create a cycle');
      return null;
    }

    const connection = {
      id: `conn_${Date.now().toString(36)}`,
      from: fromNodeId,
      to: toNodeId
    };

    this.connections.push(connection);
    this._renderConnections();

    if (this.options.onConnectionChange) {
      this.options.onConnectionChange('add', connection);
    }

    return connection;
  }

  removeConnection(connectionId) {
    const index = this.connections.findIndex(c => c.id === connectionId);
    if (index === -1) return;

    const connection = this.connections[index];
    this.connections.splice(index, 1);
    this._renderConnections();

    if (this.options.onConnectionChange) {
      this.options.onConnectionChange('remove', connection);
    }
  }

  _wouldCreateCycle(fromNodeId, toNodeId) {
    // Simple DFS to check if toNode can reach fromNode
    const visited = new Set();
    const stack = [toNodeId];

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === fromNodeId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      // Find all nodes that this node connects to
      for (const conn of this.connections) {
        if (conn.from === current) {
          stack.push(conn.to);
        }
      }
    }

    return false;
  }

  _renderConnections() {
    // Clear existing connections
    this.elements.connectionsGroup.innerHTML = '';

    for (const conn of this.connections) {
      const fromNode = this.nodes.get(conn.from);
      const toNode = this.nodes.get(conn.to);

      if (!fromNode || !toNode) continue;

      const path = this._createConnectionPath(fromNode, toNode);
      const isSelected = this.selectedConnectionId === conn.id;

      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', path);
      pathEl.setAttribute('class', `pipeline-connection ${isSelected ? 'selected' : ''}`);
      pathEl.setAttribute('data-connection-id', conn.id);

      pathEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedNodeId = null;
        this.selectedConnectionId = conn.id;
        this._renderConnections();
      });

      this.elements.connectionsGroup.appendChild(pathEl);
    }
  }

  _createConnectionPath(fromNode, toNode) {
    // Port positions (output of fromNode, input of toNode)
    const x1 = fromNode.x + this.options.nodeWidth;
    const y1 = fromNode.y + this.options.nodeHeight / 2;
    const x2 = toNode.x;
    const y2 = toNode.y + this.options.nodeHeight / 2;

    // Bezier control points
    const dx = Math.abs(x2 - x1);
    const controlOffset = Math.max(50, dx * 0.4);

    const cx1 = x1 + controlOffset;
    const cy1 = y1;
    const cx2 = x2 - controlOffset;
    const cy2 = y2;

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Event Listeners
  // ═══════════════════════════════════════════════════════════════════════════

  _attachEventListeners() {
    // Toolbar buttons
    this.elements.toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      switch (action) {
        case 'add-node':
          this._toggleNodePalette();
          break;
        case 'zoom-in':
          this.zoomIn();
          break;
        case 'zoom-out':
          this.zoomOut();
          break;
        case 'fit-view':
          this.fitView();
          break;
        case 'run':
          this._runPipeline();
          break;
      }
    });

    // Canvas interactions
    this.elements.viewport.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.elements.viewport.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.elements.viewport.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.elements.viewport.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    this.elements.viewport.addEventListener('dblclick', (e) => this._onDoubleClick(e));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this._onKeyDown(e));

    // Click outside to deselect
    this.elements.grid.addEventListener('click', () => {
      this.selectNode(null);
      this.selectedConnectionId = null;
      this._hidePalette();
    });
  }

  _attachNodeEventListeners(nodeEl, node) {
    // Click to select
    nodeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectNode(node.id);
      this._hidePalette();
    });

    // Drag to move
    nodeEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('.pipeline-node-port')) return;

      e.stopPropagation();
      this.dragNode = node;
      this.isDragging = true;

      const rect = nodeEl.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    });

    // Port interactions for connections
    const ports = nodeEl.querySelectorAll('.pipeline-node-port');
    ports.forEach(port => {
      port.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const isOutput = port.dataset.port === 'output';

        if (isOutput) {
          this.connectingFrom = node.id;
          port.classList.add('connecting');
        }
      });

      port.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        const isInput = port.dataset.port === 'input';

        if (isInput && this.connectingFrom && this.connectingFrom !== node.id) {
          this.addConnection(this.connectingFrom, node.id);
        }

        this._endConnecting();
      });
    });
  }

  _onMouseDown(e) {
    if (e.target.closest('.pipeline-node') || e.target.closest('.pipeline-canvas-toolbar')) {
      return;
    }

    this.isPanning = true;
    this.panStart = { x: e.clientX - this.pan.x, y: e.clientY - this.pan.y };
    this.elements.viewport.classList.add('panning');
  }

  _onMouseMove(e) {
    if (this.isDragging && this.dragNode) {
      const rect = this.elements.viewport.getBoundingClientRect();
      const x = (e.clientX - rect.left - this.pan.x) / this.zoom - this.dragOffset.x;
      const y = (e.clientY - rect.top - this.pan.y) / this.zoom - this.dragOffset.y;

      // Snap to grid
      const snappedX = Math.round(x / this.options.gridSize) * this.options.gridSize;
      const snappedY = Math.round(y / this.options.gridSize) * this.options.gridSize;

      this.dragNode.x = snappedX;
      this.dragNode.y = snappedY;

      const nodeEl = this.elements.nodesContainer.querySelector(`[data-node-id="${this.dragNode.id}"]`);
      if (nodeEl) {
        nodeEl.style.left = `${snappedX}px`;
        nodeEl.style.top = `${snappedY}px`;
      }

      this._renderConnections();
      this._updateMinimap();
    } else if (this.isPanning) {
      this.pan.x = e.clientX - this.panStart.x;
      this.pan.y = e.clientY - this.panStart.y;
      this._updateTransform();
    }
  }

  _onMouseUp(e) {
    if (this.isDragging && this.dragNode) {
      if (this.options.onNodeChange) {
        this.options.onNodeChange('move', this.dragNode);
      }
    }

    this.isDragging = false;
    this.dragNode = null;
    this.isPanning = false;
    this.elements.viewport.classList.remove('panning');
    this._endConnecting();
  }

  _onWheel(e) {
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = this.elements.viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newZoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, this.zoom * delta));

    // Zoom towards mouse position
    this.pan.x = mouseX - (mouseX - this.pan.x) * (newZoom / this.zoom);
    this.pan.y = mouseY - (mouseY - this.pan.y) * (newZoom / this.zoom);
    this.zoom = newZoom;

    this._updateTransform();
  }

  _onDoubleClick(e) {
    if (e.target.closest('.pipeline-node')) return;

    // Add node at double-click position
    const rect = this.elements.viewport.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.pan.x) / this.zoom;
    const y = (e.clientY - rect.top - this.pan.y) / this.zoom;

    this._showNodePalette(x, y);
  }

  _onKeyDown(e) {
    // Only handle if canvas is focused
    if (!this.container.contains(document.activeElement) && document.activeElement !== document.body) {
      return;
    }

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        if (this.selectedNodeId) {
          this.removeNode(this.selectedNodeId);
        } else if (this.selectedConnectionId) {
          this.removeConnection(this.selectedConnectionId);
        }
        break;
      case 'Escape':
        this.selectNode(null);
        this._hidePalette();
        break;
      case '/':
        if (!e.target.matches('input, textarea')) {
          e.preventDefault();
          this._toggleNodePalette();
        }
        break;
    }
  }

  _endConnecting() {
    this.connectingFrom = null;
    const connectingPort = this.elements.nodesContainer.querySelector('.pipeline-node-port.connecting');
    if (connectingPort) {
      connectingPort.classList.remove('connecting');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Node Palette
  // ═══════════════════════════════════════════════════════════════════════════

  _toggleNodePalette() {
    const palette = this.container.querySelector('.pipeline-node-palette');
    if (palette) {
      palette.classList.toggle('visible');
    } else {
      this._showNodePalette();
    }
  }

  _showNodePalette(addX = null, addY = null) {
    this._hidePalette();

    const categoriesHtml = Object.entries(NodeCategories).map(([catKey, cat]) => {
      const nodesHtml = cat.types.map(type => {
        const config = NodeConfig[type];
        return `
          <div class="palette-node-item" data-node-type="${type}">
            <div class="palette-node-item-icon ${catKey}" style="background: ${cat.color}20; color: ${cat.color};">
              <i class="ph ${config.icon}"></i>
            </div>
            <div class="palette-node-item-info">
              <div class="palette-node-item-label">${config.label}</div>
              <div class="palette-node-item-desc">${config.description}</div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="palette-category">
          <div class="palette-category-header">
            <i class="ph ${cat.icon}" style="color: ${cat.color};"></i>
            ${cat.label}
          </div>
          ${nodesHtml}
        </div>
      `;
    }).join('');

    const html = `
      <div class="pipeline-node-palette visible">
        <div class="palette-search">
          <input type="text" placeholder="Search nodes..." class="palette-search-input">
        </div>
        <div class="palette-categories">
          ${categoriesHtml}
        </div>
      </div>
    `;

    this.elements.wrapper.insertAdjacentHTML('beforeend', html);

    const palette = this.container.querySelector('.pipeline-node-palette');
    const searchInput = palette.querySelector('.palette-search-input');

    // Focus search
    setTimeout(() => searchInput.focus(), 50);

    // Search filtering
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      palette.querySelectorAll('.palette-node-item').forEach(item => {
        const label = item.querySelector('.palette-node-item-label').textContent.toLowerCase();
        const desc = item.querySelector('.palette-node-item-desc').textContent.toLowerCase();
        item.style.display = (label.includes(query) || desc.includes(query)) ? '' : 'none';
      });
    });

    // Node selection
    palette.querySelectorAll('.palette-node-item').forEach(item => {
      item.addEventListener('click', () => {
        const type = item.dataset.nodeType;
        const config = { x: addX, y: addY };
        this.addNode(type, config);
        this._hidePalette();
      });
    });
  }

  _hidePalette() {
    const palette = this.container.querySelector('.pipeline-node-palette');
    if (palette) palette.remove();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Zoom & Pan
  // ═══════════════════════════════════════════════════════════════════════════

  zoomIn() {
    this.zoom = Math.min(this.options.maxZoom, this.zoom * 1.25);
    this._updateTransform();
  }

  zoomOut() {
    this.zoom = Math.max(this.options.minZoom, this.zoom * 0.8);
    this._updateTransform();
  }

  fitView() {
    if (this.nodes.size === 0) {
      this.pan = { x: 0, y: 0 };
      this.zoom = 1;
      this._updateTransform();
      return;
    }

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const node of this.nodes.values()) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + this.options.nodeWidth);
      maxY = Math.max(maxY, node.y + this.options.nodeHeight);
    }

    const padding = 60;
    const rect = this.elements.viewport.getBoundingClientRect();

    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;
    this.zoom = Math.min(1, Math.min(scaleX, scaleY));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.pan.x = rect.width / 2 - centerX * this.zoom;
    this.pan.y = rect.height / 2 - centerY * this.zoom;

    this._updateTransform();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Minimap
  // ═══════════════════════════════════════════════════════════════════════════

  _updateMinimap() {
    const canvas = this.elements.minimap;
    const ctx = canvas.getContext('2d');
    const rect = this.elements.viewport.getBoundingClientRect();

    // Clear
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this.nodes.size === 0) return;

    // Calculate scale
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const node of this.nodes.values()) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + this.options.nodeWidth);
      maxY = Math.max(maxY, node.y + this.options.nodeHeight);
    }

    const padding = 20;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    const scale = Math.min(canvas.width / contentWidth, canvas.height / contentHeight) * 0.9;
    const offsetX = (canvas.width - contentWidth * scale) / 2 - minX * scale + padding * scale;
    const offsetY = (canvas.height - contentHeight * scale) / 2 - minY * scale + padding * scale;

    // Draw nodes
    for (const node of this.nodes.values()) {
      const config = NodeConfig[node.type];
      const category = config?.category || 'transform';

      ctx.fillStyle = category === 'source' ? '#6366f1' : category === 'output' ? '#10b981' : '#f59e0b';
      ctx.fillRect(
        node.x * scale + offsetX,
        node.y * scale + offsetY,
        this.options.nodeWidth * scale,
        this.options.nodeHeight * scale
      );
    }

    // Draw connections
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;

    for (const conn of this.connections) {
      const from = this.nodes.get(conn.from);
      const to = this.nodes.get(conn.to);
      if (!from || !to) continue;

      ctx.beginPath();
      ctx.moveTo(
        (from.x + this.options.nodeWidth) * scale + offsetX,
        (from.y + this.options.nodeHeight / 2) * scale + offsetY
      );
      ctx.lineTo(
        to.x * scale + offsetX,
        (to.y + this.options.nodeHeight / 2) * scale + offsetY
      );
      ctx.stroke();
    }

    // Draw viewport rectangle
    const viewX = (-this.pan.x / this.zoom) * scale + offsetX;
    const viewY = (-this.pan.y / this.zoom) * scale + offsetY;
    const viewW = (rect.width / this.zoom) * scale;
    const viewH = (rect.height / this.zoom) * scale;

    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.strokeRect(viewX, viewY, viewW, viewH);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Pipeline Operations
  // ═══════════════════════════════════════════════════════════════════════════

  _runPipeline() {
    // Emit run event - actual execution handled by parent
    if (this.options.onRun) {
      this.options.onRun(this.getPipelineData());
    }
  }

  getPipelineData() {
    return {
      nodes: Array.from(this.nodes.values()),
      connections: [...this.connections]
    };
  }

  loadPipeline(data) {
    // Clear existing
    this.nodes.clear();
    this.connections = [];
    this.elements.nodesContainer.innerHTML = '';

    // Load nodes
    if (data.nodes) {
      for (const node of data.nodes) {
        this.nodes.set(node.id, node);
        this._renderNode(node);
      }
    }

    // Load connections
    if (data.connections) {
      this.connections = [...data.connections];
    }

    this._renderConnections();
    this._updateEmptyState();
    this.fitView();
  }

  setNodeStatus(nodeId, status, metric = null) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.status = status;
    if (metric !== null) node.metric = metric;

    this._renderNode(node);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Utilities
  // ═══════════════════════════════════════════════════════════════════════════

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  destroy() {
    // Remove event listeners and clean up
    this.container.innerHTML = '';
    this.nodes.clear();
    this.connections = [];
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof window !== 'undefined') {
  window.PipelineCanvas = PipelineCanvas;
  window.CanvasNodeTypes = CanvasNodeTypes;
  window.NodeCategories = NodeCategories;
  window.NodeConfig = NodeConfig;
  window.NodeStatus = NodeStatus;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PipelineCanvas,
    CanvasNodeTypes,
    NodeCategories,
    NodeConfig,
    NodeStatus
  };
}
