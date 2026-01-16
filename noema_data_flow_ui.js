/**
 * EO Data Flow UI - n8n-Inspired Visual Canvas Interface
 *
 * Clean, accessible visual canvas for data transformation pipelines.
 * Features:
 * - Dotted grid canvas with pan/zoom
 * - Card-style nodes with clean design
 * - Right-rail inspector (not inline config)
 * - Command palette (/) for adding nodes
 * - Collapsible timeline for temporal scrubbing
 * - AI assistant integration
 * - Execution state visualization
 */

// ============================================================================
// Data Flow Canvas
// ============================================================================

/**
 * Main canvas component for the Data Flow visual editor
 */
class DataFlowCanvas {
  constructor(container, pipeline, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    this.pipeline = pipeline;

    // Options
    this.options = {
      showTimeline: options.showTimeline ?? true,
      timelineCollapsed: options.timelineCollapsed ?? true,
      showAIButton: options.showAIButton ?? true,
      runMode: options.runMode ?? 'auto',
      ...options
    };

    // Canvas state
    this.pan = { x: 0, y: 0 };
    this.zoom = 1;
    this.isPanning = false;
    this.isDragging = false;
    this.dragTarget = null;
    this.dragOffset = { x: 0, y: 0 };

    // Wire drawing
    this.isDrawingWire = false;
    this.wireStart = null;

    // Selection
    this.selectedNodeId = null;
    this.selectedWireId = null;

    // Command palette state
    this.isCommandPaletteOpen = false;

    // Callbacks
    this.onNodeSelect = options.onNodeSelect || null;
    this.onPipelineChange = options.onPipelineChange || null;
    this.onAIRequest = options.onAIRequest || null;

    // Initialize
    this._createDOM();
    this._bindEvents();
    this._injectStyles();
    this.render();

    // Connect pipeline callbacks
    this.pipeline.onChange = () => this.render();
  }

  // ═══════════════════════════════════════════════════════════════
  // DOM Creation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create the DOM structure
   */
  _createDOM() {
    this.container.innerHTML = '';
    this.container.className = 'df-container';

    this.element = document.createElement('div');
    this.element.className = 'df-editor';
    this.element.innerHTML = `
      <div class="df-toolbar">
        <div class="df-toolbar-left">
          <button class="df-btn df-btn-icon" data-action="zoom-in" title="Zoom In">
            <i class="ph-bold ph-magnifying-glass-plus"></i>
          </button>
          <button class="df-btn df-btn-icon" data-action="zoom-out" title="Zoom Out">
            <i class="ph-bold ph-magnifying-glass-minus"></i>
          </button>
          <button class="df-btn df-btn-icon" data-action="fit" title="Fit to View">
            <i class="ph-bold ph-arrows-out"></i>
          </button>
          <span class="df-zoom-label">100%</span>
        </div>
        <div class="df-toolbar-center">
          <span class="df-pipeline-name">${this.pipeline.name}</span>
        </div>
        <div class="df-toolbar-right">
          <select class="df-run-mode" title="Run Mode">
            <option value="auto" ${this.options.runMode === 'auto' ? 'selected' : ''}>Auto Run</option>
            <option value="manual" ${this.options.runMode === 'manual' ? 'selected' : ''}>Manual</option>
          </select>
          <button class="df-btn df-btn-primary" data-action="run" title="Run Flow">
            <i class="ph-bold ph-play"></i> Run
          </button>
        </div>
      </div>

      <div class="df-main">
        <div class="df-canvas-area">
          <svg class="df-canvas-svg">
            <defs>
              <marker id="df-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="var(--df-wire-color, #666)" />
              </marker>
              <marker id="df-arrow-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="var(--df-accent, #6366f1)" />
              </marker>
            </defs>
            <g class="df-wires"></g>
            <g class="df-wire-preview"></g>
          </svg>
          <div class="df-canvas">
            <div class="df-nodes"></div>
          </div>

          <button class="df-add-btn" data-action="add-node" title="Add Node">
            <i class="ph-bold ph-plus"></i>
          </button>

          ${this.options.showAIButton ? `
            <button class="df-ai-btn" data-action="ai-assist" title="Ask AI">
              <i class="ph-bold ph-robot"></i>
            </button>
          ` : ''}
        </div>

        <div class="df-inspector">
          <div class="df-inspector-header">
            <span>Inspector</span>
            <button class="df-btn df-btn-icon df-btn-small" data-action="close-inspector">
              <i class="ph-bold ph-x"></i>
            </button>
          </div>
          <div class="df-inspector-content">
            <div class="df-inspector-empty">
              <i class="ph-duotone ph-cursor-click"></i>
              <span>Select a node to configure</span>
            </div>
          </div>
        </div>
      </div>

      ${this.options.showTimeline ? `
        <div class="df-timeline ${this.options.timelineCollapsed ? 'collapsed' : ''}">
          <div class="df-timeline-header" data-action="toggle-timeline">
            <i class="ph-bold ph-clock"></i>
            <span class="df-timeline-label">${this._formatTimestamp(this.pipeline.currentTimestamp)}</span>
            <i class="ph-bold ph-caret-up df-timeline-toggle"></i>
          </div>
          <div class="df-timeline-body">
            <div class="df-timeline-controls">
              <button class="df-btn df-btn-icon df-btn-small" data-action="prev-keyframe">
                <i class="ph-bold ph-skip-back"></i>
              </button>
              <button class="df-btn df-btn-icon df-btn-small df-play-btn" data-action="play">
                <i class="ph-bold ph-play"></i>
              </button>
              <button class="df-btn df-btn-icon df-btn-small" data-action="next-keyframe">
                <i class="ph-bold ph-skip-forward"></i>
              </button>
              <select class="df-speed-select">
                <option value="0.5">0.5x</option>
                <option value="1" selected>1x</option>
                <option value="2">2x</option>
                <option value="4">4x</option>
              </select>
            </div>
            <div class="df-timeline-track">
              <div class="df-timeline-bar">
                <div class="df-timeline-keyframes"></div>
                <div class="df-timeline-handle"></div>
              </div>
            </div>
            <div class="df-timeline-time">
              ${this._formatTimestamp(this.pipeline.currentTimestamp)}
            </div>
          </div>
        </div>
      ` : ''}

      <div class="df-command-palette" style="display: none;">
        <div class="df-palette-overlay"></div>
        <div class="df-palette-modal">
          <div class="df-palette-search">
            <i class="ph-bold ph-magnifying-glass"></i>
            <input type="text" placeholder="Search nodes..." autofocus>
          </div>
          <div class="df-palette-categories">
            <div class="df-palette-category" data-category="source">
              <div class="df-palette-category-header">
                <i class="ph-bold ph-package"></i> Sources
              </div>
              <div class="df-palette-items"></div>
            </div>
            <div class="df-palette-category" data-category="transform">
              <div class="df-palette-category-header">
                <i class="ph-bold ph-lightning"></i> Transform
              </div>
              <div class="df-palette-items"></div>
            </div>
            <div class="df-palette-category" data-category="output">
              <div class="df-palette-category-header">
                <i class="ph-bold ph-chart-bar"></i> Output
              </div>
              <div class="df-palette-items"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="df-ai-panel" style="display: none;">
        <div class="df-ai-header">
          <i class="ph-bold ph-robot"></i>
          <span>AI Assistant</span>
          <button class="df-btn df-btn-icon df-btn-small" data-action="close-ai">
            <i class="ph-bold ph-x"></i>
          </button>
        </div>
        <div class="df-ai-body">
          <div class="df-ai-suggestions">
            <button class="df-ai-suggestion" data-ai="suggest">Suggest next step</button>
            <button class="df-ai-suggestion" data-ai="explain">Explain this flow</button>
            <button class="df-ai-suggestion" data-ai="debug">Help debug</button>
          </div>
          <div class="df-ai-input">
            <input type="text" placeholder="Ask AI anything...">
            <button class="df-btn df-btn-icon"><i class="ph-bold ph-paper-plane-right"></i></button>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);

    // Cache DOM references
    this.canvasEl = this.element.querySelector('.df-canvas');
    this.nodesEl = this.element.querySelector('.df-nodes');
    this.wiresEl = this.element.querySelector('.df-wires');
    this.wirePreviewEl = this.element.querySelector('.df-wire-preview');
    this.inspectorContent = this.element.querySelector('.df-inspector-content');
    this.zoomLabel = this.element.querySelector('.df-zoom-label');
    this.commandPalette = this.element.querySelector('.df-command-palette');
    this.paletteSearch = this.commandPalette?.querySelector('input');
    this.aiPanel = this.element.querySelector('.df-ai-panel');
    this.timelineEl = this.element.querySelector('.df-timeline');
    this.timelineHandle = this.element.querySelector('.df-timeline-handle');
    this.timelineLabel = this.element.querySelector('.df-timeline-label');
    this.timelineTime = this.element.querySelector('.df-timeline-time');

    // Populate command palette
    this._populateCommandPalette();
  }

  /**
   * Populate the command palette with node options
   */
  _populateCommandPalette() {
    const categories = {
      source: [
        DataFlowNodeType.SET,
        DataFlowNodeType.LENS,
        DataFlowNodeType.FOCUS,
        DataFlowNodeType.IMPORT
      ],
      transform: [
        DataFlowNodeType.FILTER,
        DataFlowNodeType.JOIN,
        DataFlowNodeType.TRANSFORM,
        DataFlowNodeType.SELECT,
        DataFlowNodeType.HANDLE_NULLS,
        DataFlowNodeType.BRANCH,
        DataFlowNodeType.CODE
      ],
      output: [
        DataFlowNodeType.AGGREGATE,
        DataFlowNodeType.PREVIEW,
        DataFlowNodeType.SAVE,
        DataFlowNodeType.EXPORT,
        DataFlowNodeType.AI_ACTION
      ]
    };

    for (const [category, types] of Object.entries(categories)) {
      const container = this.commandPalette.querySelector(
        `.df-palette-category[data-category="${category}"] .df-palette-items`
      );
      if (!container) continue;

      container.innerHTML = types.map(type => `
        <button class="df-palette-item" data-node-type="${type}">
          <i class="ph-bold ${DataFlowNodeIcons[type]}"></i>
          <span>${DataFlowNodeLabels[type]}</span>
        </button>
      `).join('');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Event Binding
  // ═══════════════════════════════════════════════════════════════

  /**
   * Bind all event handlers
   */
  _bindEvents() {
    // Toolbar actions
    this.element.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this._handleAction(e.currentTarget.dataset.action, e);
      });
    });

    // Run mode change
    const runModeSelect = this.element.querySelector('.df-run-mode');
    if (runModeSelect) {
      runModeSelect.addEventListener('change', (e) => {
        this.pipeline.runMode = e.target.value;
      });
    }

    // Canvas panning
    this.canvasEl.addEventListener('mousedown', (e) => {
      if (e.target === this.canvasEl || e.target.classList.contains('df-nodes')) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.pan.x, y: e.clientY - this.pan.y };
        this.canvasEl.style.cursor = 'grabbing';
        this._clearSelection();
      }
    });

    // Mouse move for panning, dragging, wire drawing
    document.addEventListener('mousemove', (e) => this._handleMouseMove(e));

    // Mouse up
    document.addEventListener('mouseup', () => this._handleMouseUp());

    // Zoom with wheel
    this.canvasEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this._setZoom(this.zoom * delta, e.clientX, e.clientY);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this._handleKeyDown(e));

    // Command palette search
    if (this.paletteSearch) {
      this.paletteSearch.addEventListener('input', (e) => {
        this._filterPaletteItems(e.target.value);
      });
    }

    // Palette item click
    this.commandPalette?.addEventListener('click', (e) => {
      const item = e.target.closest('.df-palette-item');
      if (item) {
        const type = item.dataset.nodeType;
        this._addNodeFromPalette(type);
      }

      // Close on overlay click
      if (e.target.classList.contains('df-palette-overlay')) {
        this._closeCommandPalette();
      }
    });

    // AI suggestions
    this.aiPanel?.querySelectorAll('[data-ai]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.onAIRequest) {
          this.onAIRequest(btn.dataset.ai, this.pipeline);
        }
      });
    });

    // Timeline scrubbing
    const timelineBar = this.element.querySelector('.df-timeline-bar');
    if (timelineBar) {
      timelineBar.addEventListener('mousedown', (e) => {
        this._scrubTimeline(e);
        const onMove = (e) => this._scrubTimeline(e);
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }
  }

  /**
   * Handle toolbar/button actions
   */
  _handleAction(action, e) {
    switch (action) {
      case 'zoom-in':
        this._setZoom(this.zoom * 1.2);
        break;
      case 'zoom-out':
        this._setZoom(this.zoom / 1.2);
        break;
      case 'fit':
        this._fitToView();
        break;
      case 'run':
        this.pipeline.executeAll();
        break;
      case 'add-node':
        this._openCommandPalette();
        break;
      case 'ai-assist':
        this._toggleAIPanel();
        break;
      case 'close-ai':
        this.aiPanel.style.display = 'none';
        break;
      case 'close-inspector':
        this._clearSelection();
        break;
      case 'toggle-timeline':
        this._toggleTimeline();
        break;
      case 'play':
        this._togglePlay();
        break;
      case 'prev-keyframe':
        this._prevKeyframe();
        break;
      case 'next-keyframe':
        this._nextKeyframe();
        break;
    }
  }

  /**
   * Handle mouse move
   */
  _handleMouseMove(e) {
    if (this.isPanning) {
      this.pan.x = e.clientX - this.panStart.x;
      this.pan.y = e.clientY - this.panStart.y;
      this._updateTransform();
    } else if (this.isDragging && this.dragTarget) {
      const rect = this.canvasEl.getBoundingClientRect();
      const x = (e.clientX - rect.left - this.pan.x) / this.zoom - this.dragOffset.x;
      const y = (e.clientY - rect.top - this.pan.y) / this.zoom - this.dragOffset.y;
      this.pipeline.moveNode(this.dragTarget, x, y);
      this._updateNodePosition(this.dragTarget);
      this._updateWires();
    } else if (this.isDrawingWire) {
      this._updateWirePreview(e);
    }
  }

  /**
   * Handle mouse up
   */
  _handleMouseUp() {
    this.isPanning = false;
    this.isDragging = false;
    this.dragTarget = null;
    this.canvasEl.style.cursor = 'grab';

    if (this.isDrawingWire) {
      this._cancelWireDrawing();
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  _handleKeyDown(e) {
    // Skip if in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') {
        this._closeCommandPalette();
        e.target.blur();
      }
      return;
    }

    switch (e.key) {
      case '/':
        e.preventDefault();
        this._openCommandPalette();
        break;
      case 'Escape':
        this._closeCommandPalette();
        this.aiPanel.style.display = 'none';
        this._clearSelection();
        break;
      case 'Delete':
      case 'Backspace':
        if (this.selectedNodeId) {
          this._deleteSelectedNode();
        } else if (this.selectedWireId) {
          this._deleteSelectedWire();
        }
        break;
      case 'd':
        if ((e.metaKey || e.ctrlKey) && this.selectedNodeId) {
          e.preventDefault();
          this._duplicateSelectedNode();
        }
        break;
      case 'r':
        if (!e.metaKey && !e.ctrlKey) {
          this.pipeline.executeAll();
        }
        break;
      case '?':
        this._toggleAIPanel();
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Canvas Controls
  // ═══════════════════════════════════════════════════════════════

  /**
   * Set zoom level
   */
  _setZoom(newZoom, cx, cy) {
    newZoom = Math.max(0.25, Math.min(2, newZoom));

    if (cx !== undefined && cy !== undefined) {
      const rect = this.canvasEl.getBoundingClientRect();
      const x = cx - rect.left;
      const y = cy - rect.top;
      this.pan.x = x - (x - this.pan.x) * (newZoom / this.zoom);
      this.pan.y = y - (y - this.pan.y) * (newZoom / this.zoom);
    }

    this.zoom = newZoom;
    this._updateTransform();
    this.zoomLabel.textContent = `${Math.round(newZoom * 100)}%`;
  }

  /**
   * Update canvas transform
   */
  _updateTransform() {
    this.nodesEl.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;

    const svg = this.element.querySelector('.df-canvas-svg');
    svg.querySelector('.df-wires').setAttribute('transform',
      `translate(${this.pan.x}, ${this.pan.y}) scale(${this.zoom})`);
    svg.querySelector('.df-wire-preview').setAttribute('transform',
      `translate(${this.pan.x}, ${this.pan.y}) scale(${this.zoom})`);
  }

  /**
   * Fit all nodes in view
   */
  _fitToView() {
    const nodes = Array.from(this.pipeline.nodes.values());
    if (nodes.length === 0) return;

    const nodeWidth = 220;
    const nodeHeight = 100;

    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + nodeWidth));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + nodeHeight));

    const rect = this.canvasEl.getBoundingClientRect();
    const padding = 80;

    const scaleX = (rect.width - padding * 2) / (maxX - minX || 1);
    const scaleY = (rect.height - padding * 2) / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY, 1);

    this.zoom = scale;
    this.pan.x = padding - minX * scale + (rect.width - padding * 2 - (maxX - minX) * scale) / 2;
    this.pan.y = padding - minY * scale + (rect.height - padding * 2 - (maxY - minY) * scale) / 2;

    this._updateTransform();
    this.zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  }

  // ═══════════════════════════════════════════════════════════════
  // Node Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Add node from command palette
   */
  _addNodeFromPalette(type) {
    const rect = this.canvasEl.getBoundingClientRect();
    const x = (rect.width / 2 - this.pan.x) / this.zoom;
    const y = (rect.height / 2 - this.pan.y) / this.zoom;

    const node = this.pipeline.addNode(type, { x, y });
    this._closeCommandPalette();
    this._selectNode(node.id);
  }

  /**
   * Select a node
   */
  _selectNode(nodeId) {
    // Clear previous selection
    if (this.selectedNodeId) {
      const prev = this.nodesEl.querySelector(`[data-node-id="${this.selectedNodeId}"]`);
      if (prev) prev.classList.remove('selected');
    }

    this.selectedNodeId = nodeId;
    this.selectedWireId = null;

    if (nodeId) {
      const el = this.nodesEl.querySelector(`[data-node-id="${nodeId}"]`);
      if (el) el.classList.add('selected');

      const node = this.pipeline.getNode(nodeId);
      this._updateInspector(node);

      if (this.onNodeSelect) {
        this.onNodeSelect(node);
      }
    }
  }

  /**
   * Clear selection
   */
  _clearSelection() {
    if (this.selectedNodeId) {
      const prev = this.nodesEl.querySelector(`[data-node-id="${this.selectedNodeId}"]`);
      if (prev) prev.classList.remove('selected');
    }
    this.selectedNodeId = null;
    this.selectedWireId = null;
    this._updateInspector(null);
  }

  /**
   * Delete selected node
   */
  _deleteSelectedNode() {
    if (!this.selectedNodeId) return;
    this.pipeline.removeNode(this.selectedNodeId);
    this.selectedNodeId = null;
    this._updateInspector(null);
    this.render();
  }

  /**
   * Duplicate selected node
   */
  _duplicateSelectedNode() {
    const node = this.pipeline.getNode(this.selectedNodeId);
    if (!node) return;

    const newNode = this.pipeline.addNode(node.type, {
      x: node.x + 40,
      y: node.y + 40,
      config: { ...node.config },
      label: node.label
    });

    this.render();
    this._selectNode(newNode.id);
  }

  /**
   * Delete selected wire
   */
  _deleteSelectedWire() {
    if (!this.selectedWireId) return;
    this.pipeline.removeWire(this.selectedWireId);
    this.selectedWireId = null;
    this._updateWires();
  }

  /**
   * Render a node card
   */
  _renderNode(node) {
    const existing = this.nodesEl.querySelector(`[data-node-id="${node.id}"]`);
    if (existing) existing.remove();

    const category = NodeTypeCategory[node.type];
    const color = CategoryColors[category];

    const el = document.createElement('div');
    el.className = `df-node df-node-${node.type} df-state-${node.state}`;
    el.dataset.nodeId = node.id;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.setProperty('--node-color', color);

    // State indicator
    const stateIcon = {
      [ExecutionState.IDLE]: '',
      [ExecutionState.RUNNING]: '<i class="ph-bold ph-circle-notch df-spin"></i>',
      [ExecutionState.SUCCESS]: '<i class="ph-bold ph-check-circle"></i>',
      [ExecutionState.ERROR]: '<i class="ph-bold ph-x-circle"></i>',
      [ExecutionState.STALE]: '<i class="ph-bold ph-warning-circle"></i>'
    }[node.state] || '';

    el.innerHTML = `
      <div class="df-node-header">
        <i class="ph-bold ${DataFlowNodeIcons[node.type]} df-node-icon"></i>
        <span class="df-node-label">${node.label}</span>
        <span class="df-node-state">${stateIcon}</span>
      </div>
      <div class="df-node-summary">${node.getConfigSummary()}</div>
      <div class="df-node-preview">
        ${node.preview.summaryText || ''}
        ${node.preview.recordCount !== null ? `
          <span class="df-preview-count">${node.preview.recordCount}</span>
        ` : ''}
      </div>
      <div class="df-node-ports">
        ${!node.isSource() ? `
          <div class="df-port df-port-in" data-port="in">
            <div class="df-port-dot"></div>
          </div>
        ` : '<div class="df-port-spacer"></div>'}
        ${node.isBranch() ? `
          <div class="df-port df-port-out df-port-true" data-port="true">
            <span class="df-port-label">T</span>
            <div class="df-port-dot"></div>
          </div>
          <div class="df-port df-port-out df-port-false" data-port="false">
            <span class="df-port-label">F</span>
            <div class="df-port-dot"></div>
          </div>
        ` : `
          <div class="df-port df-port-out" data-port="out">
            <div class="df-port-dot"></div>
          </div>
        `}
      </div>
    `;

    // Node events
    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.df-port')) {
        this._startWireDrawing(node.id, e.target.closest('.df-port').dataset.port, e);
        return;
      }

      this._selectNode(node.id);
      this.isDragging = true;
      this.dragTarget = node.id;
      this.dragOffset = {
        x: (e.clientX - this.canvasEl.getBoundingClientRect().left - this.pan.x) / this.zoom - node.x,
        y: (e.clientY - this.canvasEl.getBoundingClientRect().top - this.pan.y) / this.zoom - node.y
      };
    });

    el.addEventListener('dblclick', () => {
      this._selectNode(node.id);
      this.element.querySelector('.df-inspector input, .df-inspector select')?.focus();
    });

    // Port connection
    el.querySelectorAll('.df-port').forEach(port => {
      port.addEventListener('mouseup', () => {
        if (this.isDrawingWire && this.wireStart) {
          this._completeWireDrawing(node.id, port.dataset.port);
        }
      });
    });

    this.nodesEl.appendChild(el);
  }

  /**
   * Update node position
   */
  _updateNodePosition(nodeId) {
    const node = this.pipeline.getNode(nodeId);
    const el = this.nodesEl.querySelector(`[data-node-id="${nodeId}"]`);
    if (node && el) {
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Wire Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Start drawing a wire
   */
  _startWireDrawing(nodeId, port, e) {
    e.stopPropagation();
    this.isDrawingWire = true;
    this.wireStart = { nodeId, port };
  }

  /**
   * Update wire preview
   */
  _updateWirePreview(e) {
    if (!this.wireStart) return;

    const source = this.pipeline.getNode(this.wireStart.nodeId);
    if (!source) return;

    const rect = this.canvasEl.getBoundingClientRect();
    const x2 = (e.clientX - rect.left - this.pan.x) / this.zoom;
    const y2 = (e.clientY - rect.top - this.pan.y) / this.zoom;

    const isOutput = this.wireStart.port !== 'in';
    const x1 = source.x + (isOutput ? 220 : 0);
    const y1 = source.y + 50;

    this.wirePreviewEl.innerHTML = this._createWirePath(x1, y1, x2, y2, 'df-wire-drawing');
  }

  /**
   * Complete wire drawing
   */
  _completeWireDrawing(targetNodeId, targetPort) {
    if (!this.wireStart) return;

    let sourceId, targetId, sourcePort, sTargetPort;

    if (this.wireStart.port !== 'in' && targetPort === 'in') {
      sourceId = this.wireStart.nodeId;
      targetId = targetNodeId;
      sourcePort = this.wireStart.port;
      sTargetPort = targetPort;
    } else if (this.wireStart.port === 'in' && targetPort !== 'in') {
      sourceId = targetNodeId;
      targetId = this.wireStart.nodeId;
      sourcePort = targetPort;
      sTargetPort = 'in';
    } else {
      this._cancelWireDrawing();
      return;
    }

    if (sourceId === targetId) {
      this._cancelWireDrawing();
      return;
    }

    this.pipeline.connect(sourceId, targetId, {
      sourcePort,
      targetPort: sTargetPort
    });

    this._cancelWireDrawing();
    this.render();
  }

  /**
   * Cancel wire drawing
   */
  _cancelWireDrawing() {
    this.isDrawingWire = false;
    this.wireStart = null;
    this.wirePreviewEl.innerHTML = '';
  }

  /**
   * Update all wires
   */
  _updateWires() {
    const paths = [];

    for (const wire of this.pipeline.wires.values()) {
      const source = this.pipeline.getNode(wire.sourceId);
      const target = this.pipeline.getNode(wire.targetId);

      if (source && target) {
        const x1 = source.x + 220;
        const y1 = source.y + 50;
        const x2 = target.x;
        const y2 = target.y + 50;

        const selected = wire.id === this.selectedWireId ? 'selected' : '';
        paths.push(this._createWirePath(x1, y1, x2, y2, selected, wire.id));
      }
    }

    this.wiresEl.innerHTML = paths.join('');

    // Bind click handlers
    this.wiresEl.querySelectorAll('.df-wire').forEach(wire => {
      wire.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedWireId = wire.dataset.wireId;
        this.selectedNodeId = null;
        this._updateWires();
        this._updateInspector(null);
      });
    });
  }

  /**
   * Create SVG path for wire
   */
  _createWirePath(x1, y1, x2, y2, className = '', wireId = '') {
    const dx = Math.abs(x2 - x1);
    const cp = Math.max(60, dx * 0.4);

    const d = `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`;
    const markerId = className.includes('selected') ? 'df-arrow-selected' : 'df-arrow';

    return `
      <path class="df-wire ${className}" d="${d}"
            data-wire-id="${wireId}"
            marker-end="url(#${markerId})"/>
    `;
  }

  // ═══════════════════════════════════════════════════════════════
  // Inspector Panel
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update inspector for selected node
   */
  _updateInspector(node) {
    if (!node) {
      this.inspectorContent.innerHTML = `
        <div class="df-inspector-empty">
          <i class="ph-duotone ph-cursor-click"></i>
          <span>Select a node to configure</span>
        </div>
      `;
      return;
    }

    const category = NodeTypeCategory[node.type];
    const color = CategoryColors[category];
    const fields = this._getInspectorFields(node);

    this.inspectorContent.innerHTML = `
      <div class="df-inspector-node">
        <div class="df-inspector-header-row" style="--node-color: ${color}">
          <i class="ph-bold ${DataFlowNodeIcons[node.type]}"></i>
          <input type="text" class="df-inspector-label" value="${node.label}"
                 data-field="label">
        </div>

        <div class="df-inspector-state df-state-${node.state}">
          <span class="df-state-dot"></span>
          <span>${node.state}</span>
          ${node.error ? `<span class="df-error-msg">${node.error}</span>` : ''}
        </div>

        <div class="df-inspector-section">
          <div class="df-inspector-section-header">Configuration</div>
          <div class="df-inspector-fields">
            ${fields}
          </div>
        </div>

        ${node.preview.recordCount !== null || node.cachedValue ? `
          <div class="df-inspector-section">
            <div class="df-inspector-section-header">Preview</div>
            <div class="df-inspector-preview">
              ${this._renderPreview(node)}
            </div>
          </div>
        ` : ''}

        <div class="df-inspector-actions">
          <button class="df-btn df-btn-small" data-action="run-node">
            <i class="ph-bold ph-play"></i> Run from here
          </button>
          <button class="df-btn df-btn-small df-btn-danger" data-action="delete-node">
            <i class="ph-bold ph-trash"></i>
          </button>
        </div>
      </div>
    `;

    // Bind field changes
    this.inspectorContent.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('change', (e) => {
        const field = e.target.dataset.field;
        let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

        if (e.target.type === 'number') {
          value = parseFloat(value) || 0;
        }

        if (field === 'label') {
          node.label = value;
        } else {
          this.pipeline.configureNode(node.id, { [field]: value });
        }

        this.render();
      });
    });

    // Bind action buttons
    this.inspectorContent.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'run-node') {
          this.pipeline.executeFrom(node.id);
        } else if (action === 'delete-node') {
          this._deleteSelectedNode();
        }
      });
    });
  }

  /**
   * Get inspector fields HTML for node type
   */
  _getInspectorFields(node) {
    switch (node.type) {
      case DataFlowNodeType.SET:
        return this._renderFields([
          { name: 'setId', label: 'Set', type: 'select', options: this._getSetOptions() }
        ], node.config);

      case DataFlowNodeType.LENS:
        return this._renderFields([
          { name: 'lensId', label: 'Lens', type: 'select', options: this._getLensOptions() }
        ], node.config);

      case DataFlowNodeType.FILTER:
        return this._renderFields([
          { name: 'field', label: 'Field', type: 'text', placeholder: 'Field name' },
          { name: 'operator', label: 'Operator', type: 'select', options: [
            { value: 'eq', label: 'equals' },
            { value: 'ne', label: 'not equals' },
            { value: 'gt', label: '>' },
            { value: 'lt', label: '<' },
            { value: 'gte', label: '>=' },
            { value: 'lte', label: '<=' },
            { value: 'contains', label: 'contains' },
            { value: 'startsWith', label: 'starts with' },
            { value: 'endsWith', label: 'ends with' },
            { value: 'isEmpty', label: 'is empty' },
            { value: 'isNotEmpty', label: 'is not empty' }
          ]},
          { name: 'value', label: 'Value', type: 'text', placeholder: 'Comparison value' }
        ], node.config);

      case DataFlowNodeType.JOIN:
        return this._renderFields([
          { name: 'targetSetId', label: 'Target Set', type: 'select', options: this._getSetOptions() },
          { name: 'joinField', label: 'Join Field', type: 'text', placeholder: 'Field to match' },
          { name: 'joinType', label: 'Join Type', type: 'select', options: [
            { value: 'inner', label: 'Inner' },
            { value: 'left', label: 'Left' }
          ]}
        ], node.config);

      case DataFlowNodeType.TRANSFORM:
        return this._renderFields([
          { name: 'field', label: 'Field', type: 'text', placeholder: 'Field to transform' },
          { name: 'operation', label: 'Operation', type: 'select', options: [
            { value: 'map', label: 'Expression' },
            { value: 'multiply', label: 'Multiply by' },
            { value: 'add', label: 'Add' }
          ]},
          { name: 'expression', label: 'Expression/Value', type: 'text', placeholder: 'Use $ for field value' }
        ], node.config);

      case DataFlowNodeType.SELECT:
        return this._renderFields([
          { name: 'fields', label: 'Fields', type: 'textarea', placeholder: 'field1, field2, field3' }
        ], node.config);

      case DataFlowNodeType.HANDLE_NULLS:
        return this._renderFields([
          { name: 'strategy', label: 'Strategy', type: 'select', options: [
            { value: 'default', label: 'Use default value' },
            { value: 'remove', label: 'Remove record' },
            { value: 'keep', label: 'Keep null' }
          ]},
          { name: 'defaultValue', label: 'Default Value', type: 'text' }
        ], node.config);

      case DataFlowNodeType.BRANCH:
        return this._renderFields([
          { name: 'field', label: 'Field', type: 'text' },
          { name: 'operator', label: 'Condition', type: 'select', options: [
            { value: 'eq', label: 'equals' },
            { value: 'ne', label: 'not equals' },
            { value: 'gt', label: '>' },
            { value: 'lt', label: '<' }
          ]},
          { name: 'value', label: 'Value', type: 'text' }
        ], node.config);

      case DataFlowNodeType.CODE:
        return `
          <div class="df-field">
            <label>JavaScript Code</label>
            <textarea class="df-code-input" data-field="code" rows="8"
                      placeholder="// Input is 'input'\n// Return transformed data"
            >${node.config.code || ''}</textarea>
          </div>
        `;

      case DataFlowNodeType.AGGREGATE:
        return this._renderFields([
          { name: 'function', label: 'Function', type: 'select', options: [
            { value: 'SUM', label: 'Sum' },
            { value: 'COUNT', label: 'Count' },
            { value: 'AVG', label: 'Average' },
            { value: 'MIN', label: 'Minimum' },
            { value: 'MAX', label: 'Maximum' },
            { value: 'FIRST', label: 'First' },
            { value: 'LAST', label: 'Last' }
          ]},
          { name: 'field', label: 'Field', type: 'text', placeholder: 'Field to aggregate' },
          { name: 'groupBy', label: 'Group By', type: 'text', placeholder: 'Optional grouping field' }
        ], node.config);

      case DataFlowNodeType.EXPORT:
        return this._renderFields([
          { name: 'format', label: 'Format', type: 'select', options: [
            { value: 'csv', label: 'CSV' },
            { value: 'json', label: 'JSON' }
          ]},
          { name: 'fileName', label: 'File Name', type: 'text', placeholder: 'export' }
        ], node.config);

      case DataFlowNodeType.AI_ACTION:
        return this._renderFields([
          { name: 'action', label: 'Action', type: 'select', options: [
            { value: 'classify', label: 'Classify' },
            { value: 'sentiment', label: 'Sentiment Analysis' },
            { value: 'extract', label: 'Extract Entities' },
            { value: 'summarize', label: 'Summarize' },
            { value: 'custom', label: 'Custom Prompt' }
          ]},
          { name: 'prompt', label: 'Prompt', type: 'textarea', placeholder: 'Describe what AI should do...' },
          { name: 'outputField', label: 'Output Field', type: 'text', placeholder: 'ai_result' }
        ], node.config);

      default:
        return '<div class="df-inspector-empty">No configuration available</div>';
    }
  }

  /**
   * Render form fields
   */
  _renderFields(fields, config) {
    return fields.map(f => {
      const value = config[f.name] ?? '';

      if (f.type === 'select') {
        return `
          <div class="df-field">
            <label>${f.label}</label>
            <select data-field="${f.name}">
              <option value="">Select...</option>
              ${f.options.map(o => `
                <option value="${o.value}" ${o.value === value ? 'selected' : ''}>
                  ${o.label}
                </option>
              `).join('')}
            </select>
          </div>
        `;
      }

      if (f.type === 'textarea') {
        const displayValue = Array.isArray(value) ? value.join(', ') : value;
        return `
          <div class="df-field">
            <label>${f.label}</label>
            <textarea data-field="${f.name}" rows="3"
                      placeholder="${f.placeholder || ''}">${displayValue}</textarea>
          </div>
        `;
      }

      if (f.type === 'checkbox') {
        return `
          <div class="df-field df-field-checkbox">
            <label>
              <input type="checkbox" data-field="${f.name}" ${value ? 'checked' : ''}>
              ${f.label}
            </label>
          </div>
        `;
      }

      return `
        <div class="df-field">
          <label>${f.label}</label>
          <input type="${f.type}" data-field="${f.name}"
                 value="${value}" placeholder="${f.placeholder || ''}">
        </div>
      `;
    }).join('');
  }

  /**
   * Render preview data
   */
  _renderPreview(node) {
    const value = node.cachedValue;
    if (!value) return '<span class="df-preview-empty">No data</span>';

    if (Array.isArray(value)) {
      const sample = value.slice(0, 3);
      return `
        <div class="df-preview-count">${value.length} records</div>
        <table class="df-preview-table">
          <tbody>
            ${sample.map(r => {
              const vals = r.values || r;
              const keys = Object.keys(vals).slice(0, 4);
              return `<tr>${keys.map(k => `<td>${vals[k] ?? ''}</td>`).join('')}</tr>`;
            }).join('')}
          </tbody>
        </table>
        ${value.length > 3 ? `<div class="df-preview-more">+${value.length - 3} more</div>` : ''}
      `;
    }

    if (typeof value === 'object') {
      return `<pre class="df-preview-json">${JSON.stringify(value, null, 2)}</pre>`;
    }

    return `<div class="df-preview-value">${value}</div>`;
  }

  /**
   * Get Set options for dropdowns
   */
  _getSetOptions() {
    const sets = this.pipeline.workbench?.sets || [];
    return sets.map(s => ({ value: s.id, label: s.name || s.id }));
  }

  /**
   * Get Lens options for dropdowns
   */
  _getLensOptions() {
    const options = [];
    const sets = this.pipeline.workbench?.sets || [];
    for (const set of sets) {
      for (const lens of (set.lenses || [])) {
        options.push({ value: lens.id, label: `${set.name}/${lens.name}` });
      }
    }
    return options;
  }

  // ═══════════════════════════════════════════════════════════════
  // Command Palette
  // ═══════════════════════════════════════════════════════════════

  /**
   * Open command palette
   */
  _openCommandPalette() {
    this.isCommandPaletteOpen = true;
    this.commandPalette.style.display = 'flex';
    this.paletteSearch.value = '';
    this.paletteSearch.focus();
    this._filterPaletteItems('');
  }

  /**
   * Close command palette
   */
  _closeCommandPalette() {
    this.isCommandPaletteOpen = false;
    this.commandPalette.style.display = 'none';
  }

  /**
   * Filter palette items by search
   */
  _filterPaletteItems(query) {
    const q = query.toLowerCase();
    this.commandPalette.querySelectorAll('.df-palette-item').forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(q) ? 'flex' : 'none';
    });

    // Hide empty categories
    this.commandPalette.querySelectorAll('.df-palette-category').forEach(cat => {
      const hasVisible = cat.querySelectorAll('.df-palette-item[style*="flex"]').length > 0 ||
                         cat.querySelectorAll('.df-palette-item:not([style])').length > 0;
      cat.style.display = hasVisible || !q ? 'block' : 'none';
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // AI Panel
  // ═══════════════════════════════════════════════════════════════

  /**
   * Toggle AI panel visibility
   */
  _toggleAIPanel() {
    if (this.aiPanel.style.display === 'none') {
      this.aiPanel.style.display = 'flex';
    } else {
      this.aiPanel.style.display = 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Timeline
  // ═══════════════════════════════════════════════════════════════

  /**
   * Toggle timeline expanded/collapsed
   */
  _toggleTimeline() {
    if (this.timelineEl) {
      this.timelineEl.classList.toggle('collapsed');
    }
  }

  /**
   * Scrub timeline
   */
  _scrubTimeline(e) {
    const bar = this.element.querySelector('.df-timeline-bar');
    if (!bar) return;

    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    const { timelineStart, timelineEnd } = this.pipeline;
    const start = timelineStart || (timelineEnd - 365 * 24 * 60 * 60 * 1000);
    const timestamp = start + (timelineEnd - start) * pos;

    this.pipeline.setTimestamp(timestamp);
    this._updateTimelineUI(timestamp);
  }

  /**
   * Update timeline UI
   */
  _updateTimelineUI(timestamp) {
    if (this.timelineHandle) {
      const { timelineStart, timelineEnd } = this.pipeline;
      const start = timelineStart || (timelineEnd - 365 * 24 * 60 * 60 * 1000);
      const range = timelineEnd - start;
      const pos = range > 0 ? (timestamp - start) / range : 0.5;
      this.timelineHandle.style.left = `${pos * 100}%`;
    }

    const formatted = this._formatTimestamp(timestamp);
    if (this.timelineLabel) this.timelineLabel.textContent = formatted;
    if (this.timelineTime) this.timelineTime.textContent = formatted;
  }

  /**
   * Toggle play/pause
   */
  _togglePlay() {
    // Playback implementation would go here
    const btn = this.element.querySelector('.df-play-btn i');
    if (btn) {
      btn.className = btn.className.includes('play')
        ? 'ph-bold ph-pause'
        : 'ph-bold ph-play';
    }
  }

  /**
   * Jump to previous keyframe
   */
  _prevKeyframe() {
    const current = this.pipeline.currentTimestamp;
    const prev = [...this.pipeline.keyframes].reverse().find(k => k.timestamp < current);
    if (prev) {
      this.pipeline.setTimestamp(prev.timestamp);
      this._updateTimelineUI(prev.timestamp);
    }
  }

  /**
   * Jump to next keyframe
   */
  _nextKeyframe() {
    const current = this.pipeline.currentTimestamp;
    const next = this.pipeline.keyframes.find(k => k.timestamp > current);
    if (next) {
      this.pipeline.setTimestamp(next.timestamp);
      this._updateTimelineUI(next.timestamp);
    }
  }

  /**
   * Format timestamp
   */
  _formatTimestamp(ts) {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Rendering
  // ═══════════════════════════════════════════════════════════════

  /**
   * Full render
   */
  render() {
    // Render nodes
    this.nodesEl.innerHTML = '';
    for (const node of this.pipeline.nodes.values()) {
      this._renderNode(node);
    }

    // Update wires
    this._updateWires();

    // Restore selection
    if (this.selectedNodeId) {
      const el = this.nodesEl.querySelector(`[data-node-id="${this.selectedNodeId}"]`);
      if (el) {
        el.classList.add('selected');
        const node = this.pipeline.getNode(this.selectedNodeId);
        this._updateInspector(node);
      }
    }

    // Update timeline
    this._updateTimelineUI(this.pipeline.currentTimestamp);
  }

  /**
   * Cleanup
   */
  destroy() {
    this.container.innerHTML = '';
  }

  // ═══════════════════════════════════════════════════════════════
  // Styles
  // ═══════════════════════════════════════════════════════════════

  /**
   * Inject CSS styles
   */
  _injectStyles() {
    if (document.getElementById('df-styles')) return;

    const style = document.createElement('style');
    style.id = 'df-styles';
    style.textContent = DataFlowStyles;
    document.head.appendChild(style);
  }
}

// ============================================================================
// CSS Styles (n8n-inspired clean design)
// ============================================================================

const DataFlowStyles = `
/* ═══════════════════════════════════════════════════════════════
   Data Flow - Base Variables
   ═══════════════════════════════════════════════════════════════ */

.df-container {
  --df-bg-primary: #1e1e1e;
  --df-bg-secondary: #252525;
  --df-bg-tertiary: #2d2d2d;
  --df-bg-hover: #3a3a3a;
  --df-border: #3a3a3a;
  --df-border-light: #444;
  --df-text-primary: #e5e5e5;
  --df-text-secondary: #999;
  --df-text-muted: #666;
  --df-accent: #6366f1;
  --df-accent-hover: #818cf8;
  --df-success: #10b981;
  --df-error: #ef4444;
  --df-warning: #f59e0b;
  --df-info: #3b82f6;
  --df-wire-color: #666;

  --df-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --df-font-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;

  --df-radius-sm: 4px;
  --df-radius-md: 8px;
  --df-radius-lg: 12px;

  --df-shadow-sm: 0 1px 2px rgba(0,0,0,0.2);
  --df-shadow-md: 0 4px 12px rgba(0,0,0,0.25);
  --df-shadow-lg: 0 8px 24px rgba(0,0,0,0.35);
}

/* ═══════════════════════════════════════════════════════════════
   Layout
   ═══════════════════════════════════════════════════════════════ */

.df-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--df-bg-primary);
  color: var(--df-text-primary);
  font-family: var(--df-font);
  font-size: 13px;
}

.df-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.df-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ═══════════════════════════════════════════════════════════════
   Toolbar
   ═══════════════════════════════════════════════════════════════ */

.df-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: var(--df-bg-secondary);
  border-bottom: 1px solid var(--df-border);
  gap: 16px;
}

.df-toolbar-left,
.df-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.df-toolbar-center {
  flex: 1;
  text-align: center;
}

.df-pipeline-name {
  font-weight: 600;
  color: var(--df-text-primary);
}

.df-zoom-label {
  font-size: 12px;
  color: var(--df-text-secondary);
  min-width: 44px;
  text-align: center;
}

.df-run-mode {
  padding: 6px 8px;
  background: var(--df-bg-tertiary);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-sm);
  color: var(--df-text-primary);
  font-size: 12px;
  cursor: pointer;
}

/* ═══════════════════════════════════════════════════════════════
   Buttons
   ═══════════════════════════════════════════════════════════════ */

.df-btn {
  padding: 8px 14px;
  border: none;
  border-radius: var(--df-radius-sm);
  background: var(--df-bg-tertiary);
  color: var(--df-text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.df-btn:hover {
  background: var(--df-bg-hover);
}

.df-btn-icon {
  padding: 8px;
  width: 34px;
  height: 34px;
  justify-content: center;
}

.df-btn-small {
  padding: 6px;
  width: 28px;
  height: 28px;
  font-size: 12px;
}

.df-btn-primary {
  background: var(--df-accent);
  color: white;
}

.df-btn-primary:hover {
  background: var(--df-accent-hover);
}

.df-btn-danger:hover {
  background: var(--df-error);
  color: white;
}

/* ═══════════════════════════════════════════════════════════════
   Canvas
   ═══════════════════════════════════════════════════════════════ */

.df-canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--df-bg-primary);
  /* Dotted grid background */
  background-image: radial-gradient(circle, var(--df-border) 1px, transparent 1px);
  background-size: 24px 24px;
}

.df-canvas-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.df-canvas-svg .df-wires {
  pointer-events: all;
}

.df-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.df-nodes {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

/* Add/AI buttons */
.df-add-btn,
.df-ai-btn {
  position: absolute;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  box-shadow: var(--df-shadow-md);
  transition: all 0.2s ease;
  z-index: 100;
}

.df-add-btn {
  bottom: 80px;
  right: 24px;
  background: var(--df-accent);
  color: white;
}

.df-add-btn:hover {
  transform: scale(1.1);
  background: var(--df-accent-hover);
}

.df-ai-btn {
  bottom: 24px;
  right: 24px;
  background: var(--df-bg-secondary);
  color: var(--df-text-primary);
  border: 1px solid var(--df-border);
}

.df-ai-btn:hover {
  background: var(--df-bg-hover);
}

/* ═══════════════════════════════════════════════════════════════
   Nodes (Card Style)
   ═══════════════════════════════════════════════════════════════ */

.df-node {
  position: absolute;
  width: 220px;
  background: var(--df-bg-secondary);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-lg);
  box-shadow: var(--df-shadow-md);
  cursor: move;
  user-select: none;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.df-node:hover {
  border-color: var(--df-border-light);
}

.df-node.selected {
  border-color: var(--node-color, var(--df-accent));
  box-shadow: 0 0 0 2px var(--node-color, var(--df-accent)), var(--df-shadow-md);
}

/* Node Header */
.df-node-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--df-border);
}

.df-node-icon {
  font-size: 18px;
  color: var(--node-color, var(--df-accent));
}

.df-node-label {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
  color: var(--df-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.df-node-state {
  font-size: 14px;
}

.df-state-idle .df-node-state { color: var(--df-text-muted); }
.df-state-running .df-node-state { color: var(--df-info); }
.df-state-success .df-node-state { color: var(--df-success); }
.df-state-error .df-node-state { color: var(--df-error); }
.df-state-stale .df-node-state { color: var(--df-warning); }

/* Node Content */
.df-node-summary {
  padding: 10px 14px;
  font-size: 12px;
  color: var(--df-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.df-node-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-top: 1px solid var(--df-border);
  font-size: 12px;
  color: var(--df-text-muted);
  min-height: 36px;
}

.df-preview-count {
  background: var(--df-bg-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--df-text-secondary);
}

/* Node Ports */
.df-node-ports {
  display: flex;
  justify-content: space-between;
  padding: 8px 14px 12px;
}

.df-port {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: crosshair;
}

.df-port-spacer {
  width: 16px;
}

.df-port-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--df-bg-tertiary);
  border: 2px solid var(--df-text-muted);
  transition: all 0.15s;
}

.df-port:hover .df-port-dot {
  border-color: var(--node-color, var(--df-accent));
  transform: scale(1.25);
}

.df-port-label {
  font-size: 10px;
  color: var(--df-text-muted);
  font-weight: 600;
}

/* Spin animation */
.df-spin {
  animation: df-spin 1s linear infinite;
}

@keyframes df-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ═══════════════════════════════════════════════════════════════
   Wires
   ═══════════════════════════════════════════════════════════════ */

.df-wire {
  fill: none;
  stroke: var(--df-wire-color);
  stroke-width: 2;
  cursor: pointer;
  transition: stroke 0.15s;
}

.df-wire:hover,
.df-wire.selected {
  stroke: var(--df-accent);
  stroke-width: 3;
}

.df-wire-drawing {
  stroke: var(--df-accent);
  stroke-width: 2;
  stroke-dasharray: 6 4;
}

/* ═══════════════════════════════════════════════════════════════
   Inspector
   ═══════════════════════════════════════════════════════════════ */

.df-inspector {
  width: 320px;
  background: var(--df-bg-secondary);
  border-left: 1px solid var(--df-border);
  display: flex;
  flex-direction: column;
}

.df-inspector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  font-weight: 600;
  border-bottom: 1px solid var(--df-border);
}

.df-inspector-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.df-inspector-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  color: var(--df-text-muted);
  text-align: center;
}

.df-inspector-empty i {
  font-size: 32px;
  opacity: 0.5;
}

.df-inspector-node {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.df-inspector-header-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.df-inspector-header-row i {
  font-size: 20px;
  color: var(--node-color, var(--df-accent));
}

.df-inspector-label {
  flex: 1;
  padding: 6px 10px;
  background: var(--df-bg-tertiary);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-sm);
  color: var(--df-text-primary);
  font-size: 14px;
  font-weight: 600;
}

.df-inspector-state {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--df-text-secondary);
  text-transform: capitalize;
}

.df-state-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--df-text-muted);
}

.df-state-idle .df-state-dot { background: var(--df-text-muted); }
.df-state-running .df-state-dot { background: var(--df-info); }
.df-state-success .df-state-dot { background: var(--df-success); }
.df-state-error .df-state-dot { background: var(--df-error); }
.df-state-stale .df-state-dot { background: var(--df-warning); }

.df-error-msg {
  color: var(--df-error);
  font-size: 11px;
  flex: 1;
}

.df-inspector-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.df-inspector-section-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--df-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.df-inspector-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.df-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.df-field label {
  font-size: 12px;
  color: var(--df-text-secondary);
  font-weight: 500;
}

.df-field input,
.df-field select,
.df-field textarea {
  padding: 10px 12px;
  background: var(--df-bg-tertiary);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-sm);
  color: var(--df-text-primary);
  font-size: 13px;
  font-family: var(--df-font);
  transition: border-color 0.15s;
}

.df-field input:focus,
.df-field select:focus,
.df-field textarea:focus {
  outline: none;
  border-color: var(--df-accent);
}

.df-field input::placeholder,
.df-field textarea::placeholder {
  color: var(--df-text-muted);
}

.df-code-input {
  font-family: var(--df-font-mono);
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
}

.df-inspector-preview {
  background: var(--df-bg-tertiary);
  border-radius: var(--df-radius-sm);
  padding: 12px;
  max-height: 200px;
  overflow: auto;
}

.df-preview-table {
  width: 100%;
  font-size: 11px;
  border-collapse: collapse;
}

.df-preview-table td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--df-border);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.df-preview-json {
  font-family: var(--df-font-mono);
  font-size: 11px;
  margin: 0;
  white-space: pre-wrap;
}

.df-preview-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--df-accent);
}

.df-preview-more {
  font-size: 11px;
  color: var(--df-text-muted);
  margin-top: 8px;
}

.df-inspector-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--df-border);
}

/* ═══════════════════════════════════════════════════════════════
   Command Palette
   ═══════════════════════════════════════════════════════════════ */

.df-command-palette {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 100px;
  z-index: 1000;
}

.df-palette-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
}

.df-palette-modal {
  position: relative;
  width: 420px;
  max-height: 500px;
  background: var(--df-bg-secondary);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-lg);
  box-shadow: var(--df-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.df-palette-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--df-border);
}

.df-palette-search i {
  color: var(--df-text-muted);
  font-size: 18px;
}

.df-palette-search input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--df-text-primary);
  font-size: 15px;
  outline: none;
}

.df-palette-search input::placeholder {
  color: var(--df-text-muted);
}

.df-palette-categories {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.df-palette-category {
  margin-bottom: 8px;
}

.df-palette-category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--df-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.df-palette-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.df-palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: var(--df-radius-sm);
  color: var(--df-text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
  width: 100%;
  text-align: left;
}

.df-palette-item:hover {
  background: var(--df-bg-hover);
}

.df-palette-item i {
  font-size: 18px;
  color: var(--df-text-secondary);
}

/* ═══════════════════════════════════════════════════════════════
   AI Panel
   ═══════════════════════════════════════════════════════════════ */

.df-ai-panel {
  position: absolute;
  bottom: 80px;
  right: 24px;
  width: 320px;
  background: var(--df-bg-secondary);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-lg);
  box-shadow: var(--df-shadow-lg);
  flex-direction: column;
  z-index: 200;
}

.df-ai-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--df-border);
  font-weight: 600;
}

.df-ai-header span {
  flex: 1;
}

.df-ai-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.df-ai-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.df-ai-suggestion {
  padding: 6px 12px;
  background: var(--df-bg-tertiary);
  border: 1px solid var(--df-border);
  border-radius: 16px;
  color: var(--df-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.df-ai-suggestion:hover {
  background: var(--df-bg-hover);
  color: var(--df-text-primary);
}

.df-ai-input {
  display: flex;
  gap: 8px;
}

.df-ai-input input {
  flex: 1;
  padding: 10px 12px;
  background: var(--df-bg-tertiary);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-sm);
  color: var(--df-text-primary);
  font-size: 13px;
}

.df-ai-input input:focus {
  outline: none;
  border-color: var(--df-accent);
}

/* ═══════════════════════════════════════════════════════════════
   Timeline
   ═══════════════════════════════════════════════════════════════ */

.df-timeline {
  background: var(--df-bg-secondary);
  border-top: 1px solid var(--df-border);
  transition: height 0.2s ease;
}

.df-timeline.collapsed .df-timeline-body {
  display: none;
}

.df-timeline.collapsed .df-timeline-toggle {
  transform: rotate(180deg);
}

.df-timeline-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  user-select: none;
}

.df-timeline-header:hover {
  background: var(--df-bg-hover);
}

.df-timeline-label {
  flex: 1;
  font-size: 12px;
  color: var(--df-text-secondary);
}

.df-timeline-toggle {
  transition: transform 0.2s;
  color: var(--df-text-muted);
}

.df-timeline-body {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px 14px;
}

.df-timeline-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.df-speed-select {
  padding: 4px 6px;
  background: var(--df-bg-tertiary);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-sm);
  color: var(--df-text-primary);
  font-size: 11px;
}

.df-timeline-track {
  flex: 1;
}

.df-timeline-bar {
  position: relative;
  height: 8px;
  background: var(--df-bg-tertiary);
  border-radius: 4px;
  cursor: pointer;
}

.df-timeline-keyframes {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.df-timeline-handle {
  position: absolute;
  top: -4px;
  width: 16px;
  height: 16px;
  background: var(--df-accent);
  border-radius: 50%;
  transform: translateX(-50%);
  box-shadow: 0 0 0 3px var(--df-bg-secondary);
  cursor: grab;
}

.df-timeline-time {
  min-width: 140px;
  font-size: 12px;
  text-align: right;
  color: var(--df-text-secondary);
}
`;

// ============================================================================
// Exports
// ============================================================================

if (typeof window !== 'undefined') {
  window.DataFlowCanvas = DataFlowCanvas;
  window.DataFlowStyles = DataFlowStyles;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DataFlowCanvas,
    DataFlowStyles
  };
}
