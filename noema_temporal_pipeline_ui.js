/**
 * EO Temporal Pipeline UI - Visual Pipeline Editor Interface
 *
 * Provides the visual interface for the Temporal Pipeline:
 * - Canvas with pan/zoom for node arrangement
 * - Node components with live previews
 * - Wire rendering with bezier curves
 * - Operator palette for drag-and-drop
 * - Timeline scrubber for temporal navigation
 * - Inspector panel for node configuration
 */

// ============================================================================
// Pipeline Canvas
// ============================================================================

/**
 * Main canvas component for the visual pipeline editor
 */
class TemporalPipelineCanvas {
  constructor(container, pipeline, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    this.pipeline = pipeline;
    this.options = options;

    // Canvas state
    this.pan = { x: 0, y: 0 };
    this.zoom = 1;
    this.isDragging = false;
    this.isPanning = false;
    this.dragTarget = null;
    this.dragOffset = { x: 0, y: 0 };

    // Wire drawing state
    this.isDrawingWire = false;
    this.wireStart = null;
    this.wirePreview = null;

    // Selection state
    this.selectedNodeId = null;
    this.selectedWireId = null;

    // UI callbacks
    this.onNodeSelect = options.onNodeSelect || null;
    this.onNodeConfigure = options.onNodeConfigure || null;
    this.onPipelineChange = options.onPipelineChange || null;

    // Initialize
    this._createDOM();
    this._bindEvents();
    this.render();

    // Connect to pipeline
    this.pipeline.onCook = () => this.render();
  }

  /**
   * Create the DOM structure
   */
  _createDOM() {
    this.container.innerHTML = '';
    this.container.className = 'temporal-pipeline-container';

    // Main layout
    this.element = document.createElement('div');
    this.element.className = 'temporal-pipeline-editor';
    this.element.innerHTML = `
      <div class="tp-toolbar">
        <div class="tp-toolbar-left">
          <button class="tp-btn tp-btn-icon" data-action="zoom-in" title="Zoom In">
            <i class="ph-bold ph-magnifying-glass-plus"></i>
          </button>
          <button class="tp-btn tp-btn-icon" data-action="zoom-out" title="Zoom Out">
            <i class="ph-bold ph-magnifying-glass-minus"></i>
          </button>
          <button class="tp-btn tp-btn-icon" data-action="fit" title="Fit to View">
            <i class="ph-bold ph-arrows-out"></i>
          </button>
          <span class="tp-zoom-label">100%</span>
        </div>
        <div class="tp-toolbar-center">
          <span class="tp-pipeline-name">${this.pipeline.name}</span>
        </div>
        <div class="tp-toolbar-right">
          <button class="tp-btn tp-btn-icon" data-action="cook" title="Cook All">
            <i class="ph-bold ph-cooking-pot"></i>
          </button>
          <button class="tp-btn tp-btn-icon" data-action="export" title="Export Formula">
            <i class="ph-bold ph-export"></i>
          </button>
        </div>
      </div>

      <div class="tp-main">
        <div class="tp-palette">
          <div class="tp-palette-header">Operators</div>
          <div class="tp-palette-items"></div>
        </div>

        <div class="tp-canvas-wrapper">
          <svg class="tp-canvas-svg">
            <defs>
              <marker id="tp-arrowhead" markerWidth="10" markerHeight="7"
                refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
              </marker>
            </defs>
            <g class="tp-wires"></g>
            <g class="tp-wire-preview"></g>
          </svg>
          <div class="tp-canvas">
            <div class="tp-nodes"></div>
          </div>
        </div>

        <div class="tp-inspector">
          <div class="tp-inspector-header">Inspector</div>
          <div class="tp-inspector-content">
            <div class="tp-inspector-empty">Select a node to configure</div>
          </div>
        </div>
      </div>

      <div class="tp-timeline">
        <div class="tp-timeline-controls">
          <button class="tp-btn tp-btn-icon" data-action="prev-keyframe" title="Previous Keyframe">
            <i class="ph-bold ph-skip-back"></i>
          </button>
          <button class="tp-btn tp-btn-icon tp-play-btn" data-action="play" title="Play">
            <i class="ph-bold ph-play"></i>
          </button>
          <button class="tp-btn tp-btn-icon" data-action="next-keyframe" title="Next Keyframe">
            <i class="ph-bold ph-skip-forward"></i>
          </button>
          <select class="tp-speed-select">
            <option value="0.5">0.5x</option>
            <option value="1" selected>1x</option>
            <option value="2">2x</option>
            <option value="4">4x</option>
          </select>
        </div>
        <div class="tp-timeline-track">
          <div class="tp-timeline-bar">
            <div class="tp-timeline-keyframes"></div>
            <div class="tp-timeline-handle"></div>
          </div>
        </div>
        <div class="tp-timeline-time">
          <span class="tp-current-time"></span>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);

    // Cache DOM references
    this.canvasEl = this.element.querySelector('.tp-canvas');
    this.nodesEl = this.element.querySelector('.tp-nodes');
    this.wiresEl = this.element.querySelector('.tp-wires');
    this.wirePreviewEl = this.element.querySelector('.tp-wire-preview');
    this.paletteItemsEl = this.element.querySelector('.tp-palette-items');
    this.inspectorContent = this.element.querySelector('.tp-inspector-content');
    this.zoomLabel = this.element.querySelector('.tp-zoom-label');
    this.timelineBar = this.element.querySelector('.tp-timeline-bar');
    this.timelineHandle = this.element.querySelector('.tp-timeline-handle');
    this.timelineKeyframes = this.element.querySelector('.tp-timeline-keyframes');
    this.currentTimeEl = this.element.querySelector('.tp-current-time');
    this.playBtn = this.element.querySelector('.tp-play-btn');

    // Create timeline scrubber
    this.scrubber = new TimelineScrubber(this.pipeline, {
      onScrub: (timestamp) => this._updateTimeDisplay(timestamp),
      onPlayStateChange: (isPlaying) => this._updatePlayButton(isPlaying)
    });

    // Populate palette
    this._populatePalette();

    // Update timeline
    this._updateTimeline();
  }

  /**
   * Populate the operator palette
   */
  _populatePalette() {
    const operators = [
      { type: TemporalNodeType.SOURCE, label: 'Source', icon: TemporalNodeIcons[TemporalNodeType.SOURCE] },
      { type: TemporalNodeType.CON, label: 'Connect', icon: TemporalNodeIcons[TemporalNodeType.CON] },
      { type: TemporalNodeType.SEG, label: 'Segment', icon: TemporalNodeIcons[TemporalNodeType.SEG] },
      { type: TemporalNodeType.SYN, label: 'Synthesize', icon: TemporalNodeIcons[TemporalNodeType.SYN] },
      { type: TemporalNodeType.ALT, label: 'Alter', icon: TemporalNodeIcons[TemporalNodeType.ALT] },
      { type: TemporalNodeType.DES, label: 'Designate', icon: TemporalNodeIcons[TemporalNodeType.DES] },
      { type: TemporalNodeType.NUL, label: 'Null', icon: TemporalNodeIcons[TemporalNodeType.NUL] }
    ];

    this.paletteItemsEl.innerHTML = operators.map(op => `
      <div class="tp-palette-item" draggable="true" data-node-type="${op.type}"
           style="--node-color: ${TemporalNodeColors[op.type]}">
        <i class="ph-bold ${op.icon}"></i>
        <span>${op.label}</span>
      </div>
    `).join('');
  }

  /**
   * Bind event handlers
   */
  _bindEvents() {
    // Toolbar actions
    this.element.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        this._handleAction(action);
      });
    });

    // Canvas panning
    this.canvasEl.addEventListener('mousedown', (e) => {
      if (e.target === this.canvasEl || e.target === this.nodesEl) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.pan.x, y: e.clientY - this.pan.y };
        this.canvasEl.style.cursor = 'grabbing';
      }
    });

    document.addEventListener('mousemove', (e) => {
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
    });

    document.addEventListener('mouseup', () => {
      this.isPanning = false;
      this.isDragging = false;
      this.dragTarget = null;
      this.canvasEl.style.cursor = 'grab';

      if (this.isDrawingWire) {
        this._cancelWireDrawing();
      }
    });

    // Zoom with wheel
    this.canvasEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this._setZoom(this.zoom * delta, e.clientX, e.clientY);
    });

    // Drag from palette
    this.paletteItemsEl.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.tp-palette-item');
      if (item) {
        e.dataTransfer.setData('node-type', item.dataset.nodeType);
      }
    });

    this.canvasEl.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    this.canvasEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData('node-type');
      if (nodeType) {
        const rect = this.canvasEl.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.pan.x) / this.zoom;
        const y = (e.clientY - rect.top - this.pan.y) / this.zoom;
        this._addNode(nodeType, x, y);
      }
    });

    // Timeline scrubbing
    this.timelineBar.addEventListener('mousedown', (e) => {
      this._scrubTimeline(e);
      const onMove = (e) => this._scrubTimeline(e);
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // Speed selector
    this.element.querySelector('.tp-speed-select').addEventListener('change', (e) => {
      this.scrubber.setSpeed(parseFloat(e.target.value));
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedNodeId) {
          this._deleteNode(this.selectedNodeId);
        } else if (this.selectedWireId) {
          this._deleteWire(this.selectedWireId);
        }
      }

      if (e.key === ' ') {
        e.preventDefault();
        this.scrubber.togglePlay();
      }
    });
  }

  /**
   * Handle toolbar actions
   */
  _handleAction(action) {
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
      case 'cook':
        this.pipeline.cookAll();
        break;
      case 'export':
        this._exportFormula();
        break;
      case 'play':
        this.scrubber.togglePlay();
        break;
      case 'prev-keyframe':
        this.scrubber.prevKeyframe();
        break;
      case 'next-keyframe':
        this.scrubber.nextKeyframe();
        break;
    }
  }

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

    // Update SVG wires
    const svg = this.element.querySelector('.tp-canvas-svg');
    svg.querySelector('.tp-wires').setAttribute('transform',
      `translate(${this.pan.x}, ${this.pan.y}) scale(${this.zoom})`);
  }

  /**
   * Fit all nodes in view
   */
  _fitToView() {
    const nodes = Array.from(this.pipeline.nodes.values());
    if (nodes.length === 0) return;

    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + 180));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + 120));

    const rect = this.canvasEl.getBoundingClientRect();
    const padding = 50;

    const scaleX = (rect.width - padding * 2) / (maxX - minX);
    const scaleY = (rect.height - padding * 2) / (maxY - minY);
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
   * Add a node from palette drop
   */
  _addNode(type, x, y) {
    const node = this.pipeline.addNode(type, { x, y });
    this._renderNode(node);
    this._selectNode(node.id);

    if (this.onPipelineChange) {
      this.onPipelineChange(this.pipeline);
    }

    return node;
  }

  /**
   * Delete a node
   */
  _deleteNode(nodeId) {
    this.pipeline.removeNode(nodeId);
    this.render();

    if (this.selectedNodeId === nodeId) {
      this.selectedNodeId = null;
      this._updateInspector(null);
    }

    if (this.onPipelineChange) {
      this.onPipelineChange(this.pipeline);
    }
  }

  /**
   * Select a node
   */
  _selectNode(nodeId) {
    // Deselect previous
    if (this.selectedNodeId) {
      const prevEl = this.nodesEl.querySelector(`[data-node-id="${this.selectedNodeId}"]`);
      if (prevEl) prevEl.classList.remove('selected');
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
   * Render a single node
   */
  _renderNode(node) {
    const existing = this.nodesEl.querySelector(`[data-node-id="${node.id}"]`);
    if (existing) {
      existing.remove();
    }

    const el = document.createElement('div');
    el.className = `tp-node tp-node-${node.type} ${node.status}`;
    el.dataset.nodeId = node.id;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.setProperty('--node-color', TemporalNodeColors[node.type]);

    el.innerHTML = `
      <div class="tp-node-header">
        <i class="ph-bold ${TemporalNodeIcons[node.type]}"></i>
        <span class="tp-node-label">${node.label}</span>
        <span class="tp-node-status"></span>
      </div>
      <div class="tp-node-config">${this._getNodeConfigSummary(node)}</div>
      <div class="tp-node-preview">
        <div class="tp-preview-text">${node.preview.summaryText || 'Not cooked'}</div>
        ${node.preview.recordCount !== null ? `
          <div class="tp-preview-bar">
            <div class="tp-preview-bar-fill" style="width: ${Math.min(100, node.preview.recordCount / 10)}%"></div>
          </div>
        ` : ''}
      </div>
      <div class="tp-node-ports">
        ${node.type !== TemporalNodeType.SOURCE ? `
          <div class="tp-port tp-port-in" data-port="in"></div>
        ` : ''}
        <div class="tp-port tp-port-out" data-port="out"></div>
      </div>
    `;

    // Node dragging
    el.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('tp-port')) {
        this._startWireDrawing(node.id, e.target.dataset.port, e);
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

    // Double-click to configure
    el.addEventListener('dblclick', () => {
      if (this.onNodeConfigure) {
        this.onNodeConfigure(node);
      }
    });

    // Port hover for wire connection
    el.querySelectorAll('.tp-port').forEach(port => {
      port.addEventListener('mouseup', () => {
        if (this.isDrawingWire && this.wireStart) {
          this._completeWireDrawing(node.id, port.dataset.port);
        }
      });
    });

    this.nodesEl.appendChild(el);
  }

  /**
   * Get summary text for node config
   */
  _getNodeConfigSummary(node) {
    switch (node.type) {
      case TemporalNodeType.SOURCE:
        return node.config.setName || node.config.setId || 'No source';
      case TemporalNodeType.CON:
        return `→ ${node.config.targetSetName || node.config.targetSetId || 'target'}`;
      case TemporalNodeType.SEG:
        return `${node.config.field || '?'} ${node.config.operator || '='} ${node.config.value || '?'}`;
      case TemporalNodeType.SYN:
        return `${node.config.mode || 'SUM'}${node.config.field ? '(' + node.config.field + ')' : ''}`;
      case TemporalNodeType.ALT:
        return `${node.config.operation || 'transform'} ${node.config.value || ''}`;
      case TemporalNodeType.DES:
        return `→ ${node.config.property || 'property'}`;
      case TemporalNodeType.NUL:
        return `default: ${node.config.defaultValue ?? 'null'}`;
      default:
        return '';
    }
  }

  /**
   * Update node position in DOM
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
  // Wire Drawing
  // ═══════════════════════════════════════════════════════════════

  /**
   * Start drawing a wire from a port
   */
  _startWireDrawing(nodeId, port, e) {
    this.isDrawingWire = true;
    this.wireStart = { nodeId, port };
  }

  /**
   * Update wire preview during drawing
   */
  _updateWirePreview(e) {
    if (!this.wireStart) return;

    const sourceNode = this.pipeline.getNode(this.wireStart.nodeId);
    const sourceEl = this.nodesEl.querySelector(`[data-node-id="${this.wireStart.nodeId}"]`);
    if (!sourceNode || !sourceEl) return;

    const rect = this.canvasEl.getBoundingClientRect();
    const x2 = (e.clientX - rect.left - this.pan.x) / this.zoom;
    const y2 = (e.clientY - rect.top - this.pan.y) / this.zoom;

    const isOutput = this.wireStart.port === 'out';
    const x1 = sourceNode.x + (isOutput ? 180 : 0);
    const y1 = sourceNode.y + 60;

    this.wirePreviewEl.innerHTML = this._createWirePath(x1, y1, x2, y2, 'preview');
  }

  /**
   * Complete wire drawing
   */
  _completeWireDrawing(targetNodeId, targetPort) {
    if (!this.wireStart) return;

    // Determine source and target based on port types
    let sourceId, targetId;
    if (this.wireStart.port === 'out' && targetPort === 'in') {
      sourceId = this.wireStart.nodeId;
      targetId = targetNodeId;
    } else if (this.wireStart.port === 'in' && targetPort === 'out') {
      sourceId = targetNodeId;
      targetId = this.wireStart.nodeId;
    } else {
      this._cancelWireDrawing();
      return;
    }

    // Can't connect to self
    if (sourceId === targetId) {
      this._cancelWireDrawing();
      return;
    }

    const wire = this.pipeline.connect(sourceId, targetId);
    if (wire) {
      this._updateWires();
      this.pipeline.cookAll();

      if (this.onPipelineChange) {
        this.onPipelineChange(this.pipeline);
      }
    }

    this._cancelWireDrawing();
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
        const x1 = source.x + 180;
        const y1 = source.y + 60;
        const x2 = target.x;
        const y2 = target.y + 60;

        const selected = wire.id === this.selectedWireId ? 'selected' : '';
        paths.push(this._createWirePath(x1, y1, x2, y2, selected, wire.id));
      }
    }

    this.wiresEl.innerHTML = paths.join('');

    // Bind wire click handlers
    this.wiresEl.querySelectorAll('.tp-wire').forEach(wire => {
      wire.addEventListener('click', (e) => {
        e.stopPropagation();
        this._selectWire(wire.dataset.wireId);
      });
    });
  }

  /**
   * Create SVG path for a wire
   */
  _createWirePath(x1, y1, x2, y2, className = '', wireId = '') {
    const dx = Math.abs(x2 - x1);
    const cp = Math.max(50, dx * 0.5);

    const d = `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`;

    return `
      <path class="tp-wire ${className}" d="${d}"
            data-wire-id="${wireId}"
            marker-end="url(#tp-arrowhead)"/>
    `;
  }

  /**
   * Select a wire
   */
  _selectWire(wireId) {
    this.selectedWireId = wireId;
    this.selectedNodeId = null;
    this._updateWires();
    this._updateInspector(null);
  }

  /**
   * Delete a wire
   */
  _deleteWire(wireId) {
    this.pipeline.removeWire(wireId);
    this._updateWires();

    if (this.selectedWireId === wireId) {
      this.selectedWireId = null;
    }

    if (this.onPipelineChange) {
      this.onPipelineChange(this.pipeline);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Inspector Panel
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update inspector panel for selected node
   */
  _updateInspector(node) {
    if (!node) {
      this.inspectorContent.innerHTML = `
        <div class="tp-inspector-empty">Select a node to configure</div>
      `;
      return;
    }

    const fields = this._getConfigFields(node);

    this.inspectorContent.innerHTML = `
      <div class="tp-inspector-node">
        <div class="tp-inspector-title">
          <i class="ph-bold ${TemporalNodeIcons[node.type]}"></i>
          <span>${node.label}</span>
        </div>

        <div class="tp-inspector-status">
          Status: <span class="tp-status-${node.status}">${node.status}</span>
        </div>

        <div class="tp-inspector-fields">
          ${fields}
        </div>

        <div class="tp-inspector-preview">
          <div class="tp-inspector-preview-header">Preview</div>
          <div class="tp-inspector-preview-content">
            ${node.preview.summaryText || 'Not cooked'}
            ${node.preview.sampleValues.length > 0 ? `
              <div class="tp-preview-samples">
                ${node.preview.sampleValues.map(v => `<span>${v}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>

        ${node.lastError ? `
          <div class="tp-inspector-error">
            <i class="ph-bold ph-warning"></i>
            ${node.lastError}
          </div>
        ` : ''}
      </div>
    `;

    // Bind field change handlers
    this.inspectorContent.querySelectorAll('[data-config-field]').forEach(input => {
      input.addEventListener('change', (e) => {
        const field = e.target.dataset.configField;
        let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

        // Type coercion for numbers
        if (e.target.type === 'number') {
          value = parseFloat(value);
        }

        node.config[field] = value;
        node.markDirty();
        this.pipeline._propagateDirty(node.id);
        this.pipeline.cookAll();

        if (this.onPipelineChange) {
          this.onPipelineChange(this.pipeline);
        }
      });
    });
  }

  /**
   * Get configuration fields HTML for a node type
   */
  _getConfigFields(node) {
    switch (node.type) {
      case TemporalNodeType.SOURCE:
        return this._renderFields([
          { name: 'setId', label: 'Set', type: 'select', options: this._getSetOptions() },
          { name: 'setName', label: 'Set Name', type: 'text' }
        ], node.config);

      case TemporalNodeType.CON:
        return this._renderFields([
          { name: 'targetSetId', label: 'Target Set', type: 'select', options: this._getSetOptions() },
          { name: 'joinField', label: 'Join Field', type: 'text' }
        ], node.config);

      case TemporalNodeType.SEG:
        return this._renderFields([
          { name: 'field', label: 'Field', type: 'text' },
          { name: 'operator', label: 'Operator', type: 'select', options: [
            { value: 'eq', label: '=' },
            { value: 'ne', label: '≠' },
            { value: 'gt', label: '>' },
            { value: 'lt', label: '<' },
            { value: 'gte', label: '≥' },
            { value: 'lte', label: '≤' },
            { value: 'contains', label: 'contains' },
            { value: 'isEmpty', label: 'is empty' },
            { value: 'isNotEmpty', label: 'is not empty' }
          ]},
          { name: 'value', label: 'Value', type: 'text' }
        ], node.config);

      case TemporalNodeType.SYN:
        return this._renderFields([
          { name: 'mode', label: 'Aggregation', type: 'select', options: [
            { value: 'SUM', label: 'Sum' },
            { value: 'COUNT', label: 'Count' },
            { value: 'AVG', label: 'Average' },
            { value: 'MIN', label: 'Minimum' },
            { value: 'MAX', label: 'Maximum' },
            { value: 'FIRST', label: 'First' },
            { value: 'LAST', label: 'Last' },
            { value: 'CONCAT', label: 'Concatenate' },
            { value: 'COLLECT', label: 'Collect' }
          ]},
          { name: 'field', label: 'Field', type: 'text' },
          { name: 'separator', label: 'Separator (for CONCAT)', type: 'text' }
        ], node.config);

      case TemporalNodeType.ALT:
        return this._renderFields([
          { name: 'operation', label: 'Operation', type: 'select', options: [
            { value: 'multiply', label: 'Multiply' },
            { value: 'divide', label: 'Divide' },
            { value: 'add', label: 'Add' },
            { value: 'subtract', label: 'Subtract' },
            { value: 'map', label: 'Map Expression' }
          ]},
          { name: 'value', label: 'Value', type: 'number' },
          { name: 'expression', label: 'Expression (use $ for value)', type: 'text' }
        ], node.config);

      case TemporalNodeType.DES:
        return this._renderFields([
          { name: 'property', label: 'Property', type: 'text' }
        ], node.config);

      case TemporalNodeType.NUL:
        return this._renderFields([
          { name: 'defaultValue', label: 'Default Value', type: 'text' }
        ], node.config);

      default:
        return '';
    }
  }

  /**
   * Render form fields
   */
  _renderFields(fields, config) {
    return fields.map(field => {
      const value = config[field.name] ?? '';

      if (field.type === 'select') {
        return `
          <div class="tp-field">
            <label>${field.label}</label>
            <select data-config-field="${field.name}">
              ${field.options.map(opt => `
                <option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>
                  ${opt.label}
                </option>
              `).join('')}
            </select>
          </div>
        `;
      }

      if (field.type === 'checkbox') {
        return `
          <div class="tp-field tp-field-checkbox">
            <label>
              <input type="checkbox" data-config-field="${field.name}"
                     ${value ? 'checked' : ''}>
              ${field.label}
            </label>
          </div>
        `;
      }

      return `
        <div class="tp-field">
          <label>${field.label}</label>
          <input type="${field.type}" data-config-field="${field.name}"
                 value="${value}" placeholder="${field.placeholder || ''}">
        </div>
      `;
    }).join('');
  }

  /**
   * Get set options for dropdowns
   */
  _getSetOptions() {
    if (!this.pipeline.workbench?.sets) {
      return [{ value: '', label: 'No sets available' }];
    }

    return this.pipeline.workbench.sets.map(set => ({
      value: set.id,
      label: set.name || set.id
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // Timeline
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update timeline UI
   */
  _updateTimeline() {
    // Update keyframes
    this.timelineKeyframes.innerHTML = this.pipeline.keyframes.map(kf => {
      const pos = this._getKeyframePosition(kf);
      return `
        <div class="tp-keyframe tp-keyframe-${kf.type}"
             style="left: ${pos * 100}%"
             title="${kf.label}"
             data-timestamp="${kf.timestamp}">
        </div>
      `;
    }).join('');

    // Update handle position
    const pos = this.scrubber.getPosition();
    this.timelineHandle.style.left = `${pos * 100}%`;

    // Update time display
    this._updateTimeDisplay(this.pipeline.currentTimestamp);
  }

  /**
   * Get keyframe position (0-1)
   */
  _getKeyframePosition(keyframe) {
    const { timelineStart, timelineEnd } = this.pipeline;
    const start = timelineStart || (timelineEnd - 365 * 24 * 60 * 60 * 1000);
    const range = timelineEnd - start;

    if (range === 0) return 0.5;
    return (keyframe.timestamp - start) / range;
  }

  /**
   * Handle timeline scrub interaction
   */
  _scrubTimeline(e) {
    const rect = this.timelineBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    this.scrubber.scrubTo(pos);
    this._updateTimeline();
  }

  /**
   * Update time display
   */
  _updateTimeDisplay(timestamp) {
    const date = new Date(timestamp);
    this.currentTimeEl.textContent = date.toLocaleString();
    this.timelineHandle.style.left = `${this.scrubber.getPosition() * 100}%`;
  }

  /**
   * Update play button state
   */
  _updatePlayButton(isPlaying) {
    const icon = this.playBtn.querySelector('i');
    icon.className = isPlaying ? 'ph-bold ph-pause' : 'ph-bold ph-play';
  }

  // ═══════════════════════════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════════════════════════

  /**
   * Export pipeline as formula
   */
  _exportFormula() {
    const formula = this.pipeline.toFormula();
    console.log('Pipeline formula:', formula);

    // Copy to clipboard
    navigator.clipboard?.writeText(formula).then(() => {
      // Could show a toast notification
    });

    return formula;
  }

  // ═══════════════════════════════════════════════════════════════
  // Render
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

    // Update timeline
    this._updateTimeline();

    // Restore selection
    if (this.selectedNodeId) {
      const el = this.nodesEl.querySelector(`[data-node-id="${this.selectedNodeId}"]`);
      if (el) el.classList.add('selected');
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.scrubber.destroy();
    this.container.innerHTML = '';
  }
}

// ============================================================================
// CSS Styles
// ============================================================================

const temporalPipelineStyles = `
.temporal-pipeline-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary, #1a1a1a);
  color: var(--text-primary, #e5e5e5);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.temporal-pipeline-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Toolbar */
.tp-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-secondary, #252525);
  border-bottom: 1px solid var(--border, #333);
}

.tp-toolbar-left, .tp-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tp-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: var(--bg-tertiary, #333);
  color: var(--text-primary, #e5e5e5);
  cursor: pointer;
  transition: background 0.15s;
}

.tp-btn:hover {
  background: var(--bg-hover, #444);
}

.tp-btn-icon {
  padding: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tp-zoom-label {
  font-size: 12px;
  color: var(--text-secondary, #999);
  min-width: 40px;
}

.tp-pipeline-name {
  font-weight: 500;
}

/* Main Layout */
.tp-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Palette */
.tp-palette {
  width: 180px;
  background: var(--bg-secondary, #252525);
  border-right: 1px solid var(--border, #333);
  display: flex;
  flex-direction: column;
}

.tp-palette-header {
  padding: 12px;
  font-weight: 500;
  border-bottom: 1px solid var(--border, #333);
}

.tp-palette-items {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tp-palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-tertiary, #333);
  border-radius: 4px;
  cursor: grab;
  border-left: 3px solid var(--node-color);
  transition: background 0.15s;
}

.tp-palette-item:hover {
  background: var(--bg-hover, #444);
}

.tp-palette-item i {
  color: var(--node-color);
}

/* Canvas */
.tp-canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--bg-primary, #1a1a1a);
  background-image:
    radial-gradient(circle, var(--border, #333) 1px, transparent 1px);
  background-size: 20px 20px;
}

.tp-canvas-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.tp-canvas-svg .tp-wires {
  pointer-events: all;
}

.tp-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.tp-nodes {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

/* Nodes */
.tp-node {
  position: absolute;
  width: 180px;
  background: var(--bg-secondary, #252525);
  border: 1px solid var(--border, #333);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  cursor: move;
  user-select: none;
}

.tp-node.selected {
  border-color: var(--node-color);
  box-shadow: 0 0 0 2px var(--node-color);
}

.tp-node.cooking {
  border-color: #f59e0b;
}

.tp-node.error {
  border-color: #ef4444;
}

.tp-node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-tertiary, #333);
  border-radius: 5px 5px 0 0;
  border-bottom: 1px solid var(--border, #333);
}

.tp-node-header i {
  color: var(--node-color);
}

.tp-node-label {
  font-weight: 500;
  flex: 1;
}

.tp-node-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-secondary, #666);
}

.tp-node.clean .tp-node-status {
  background: #10b981;
}

.tp-node.dirty .tp-node-status {
  background: #f59e0b;
}

.tp-node.cooking .tp-node-status {
  background: #3b82f6;
  animation: pulse 0.5s ease-in-out infinite;
}

.tp-node.error .tp-node-status {
  background: #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.tp-node-config {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-secondary, #999);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tp-node-preview {
  padding: 8px 12px;
  border-top: 1px solid var(--border, #333);
}

.tp-preview-text {
  font-size: 12px;
  color: var(--text-secondary, #999);
}

.tp-preview-bar {
  height: 4px;
  background: var(--bg-tertiary, #333);
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
}

.tp-preview-bar-fill {
  height: 100%;
  background: var(--node-color);
  transition: width 0.2s;
}

.tp-node-ports {
  display: flex;
  justify-content: space-between;
  padding: 0 8px 8px;
}

.tp-port {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--bg-tertiary, #333);
  border: 2px solid var(--text-secondary, #666);
  cursor: crosshair;
  transition: all 0.15s;
}

.tp-port:hover {
  border-color: var(--node-color);
  transform: scale(1.2);
}

/* Wires */
.tp-wire {
  fill: none;
  stroke: var(--text-secondary, #666);
  stroke-width: 2;
  cursor: pointer;
  transition: stroke 0.15s;
}

.tp-wire:hover, .tp-wire.selected {
  stroke: var(--accent, #6366f1);
  stroke-width: 3;
}

.tp-wire.preview {
  stroke: var(--accent, #6366f1);
  stroke-dasharray: 5 5;
}

/* Inspector */
.tp-inspector {
  width: 280px;
  background: var(--bg-secondary, #252525);
  border-left: 1px solid var(--border, #333);
  display: flex;
  flex-direction: column;
}

.tp-inspector-header {
  padding: 12px;
  font-weight: 500;
  border-bottom: 1px solid var(--border, #333);
}

.tp-inspector-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.tp-inspector-empty {
  color: var(--text-secondary, #666);
  text-align: center;
  padding: 20px;
}

.tp-inspector-node {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tp-inspector-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.tp-inspector-status {
  font-size: 12px;
  color: var(--text-secondary, #999);
}

.tp-status-clean { color: #10b981; }
.tp-status-dirty { color: #f59e0b; }
.tp-status-cooking { color: #3b82f6; }
.tp-status-error { color: #ef4444; }

.tp-inspector-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tp-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tp-field label {
  font-size: 12px;
  color: var(--text-secondary, #999);
}

.tp-field input, .tp-field select {
  padding: 8px;
  background: var(--bg-tertiary, #333);
  border: 1px solid var(--border, #444);
  border-radius: 4px;
  color: var(--text-primary, #e5e5e5);
  font-size: 13px;
}

.tp-field input:focus, .tp-field select:focus {
  outline: none;
  border-color: var(--accent, #6366f1);
}

.tp-inspector-preview {
  border-top: 1px solid var(--border, #333);
  padding-top: 12px;
}

.tp-inspector-preview-header {
  font-size: 12px;
  color: var(--text-secondary, #999);
  margin-bottom: 8px;
}

.tp-inspector-preview-content {
  font-size: 13px;
}

.tp-preview-samples {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.tp-preview-samples span {
  padding: 2px 6px;
  background: var(--bg-tertiary, #333);
  border-radius: 3px;
  font-size: 11px;
}

.tp-inspector-error {
  padding: 8px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  color: #ef4444;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Timeline */
.tp-timeline {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary, #252525);
  border-top: 1px solid var(--border, #333);
}

.tp-timeline-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tp-speed-select {
  padding: 4px;
  background: var(--bg-tertiary, #333);
  border: 1px solid var(--border, #444);
  border-radius: 4px;
  color: var(--text-primary, #e5e5e5);
  font-size: 12px;
}

.tp-timeline-track {
  flex: 1;
}

.tp-timeline-bar {
  position: relative;
  height: 24px;
  background: var(--bg-tertiary, #333);
  border-radius: 4px;
  cursor: pointer;
}

.tp-timeline-keyframes {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.tp-keyframe {
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: 4px;
  background: var(--text-secondary, #666);
  border-radius: 2px;
  transform: translateX(-50%);
}

.tp-keyframe-import { background: #10b981; }
.tp-keyframe-schema { background: #f59e0b; }
.tp-keyframe-bookmark { background: #6366f1; }

.tp-timeline-handle {
  position: absolute;
  top: 2px;
  bottom: 2px;
  width: 4px;
  background: var(--accent, #6366f1);
  border-radius: 2px;
  transform: translateX(-50%);
  box-shadow: 0 0 4px var(--accent, #6366f1);
}

.tp-timeline-time {
  min-width: 160px;
  font-size: 12px;
  text-align: right;
  color: var(--text-secondary, #999);
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.id = 'temporal-pipeline-styles';
  styleEl.textContent = temporalPipelineStyles;
  if (!document.getElementById('temporal-pipeline-styles')) {
    document.head.appendChild(styleEl);
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof window !== 'undefined') {
  window.TemporalPipelineCanvas = TemporalPipelineCanvas;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TemporalPipelineCanvas
  };
}
