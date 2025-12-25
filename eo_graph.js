/**
 * EO Graph - Experience Graph Visualization
 *
 * Visualizes the relationships between Given and Meant events as a graph.
 * Shows provenance chains, supersession relationships, and horizon boundaries.
 *
 * COMPLIANCE NOTES:
 * - This is a DERIVED visualization - it renders from the event log
 * - Read-only: No graph interactions modify the authoritative log
 * - User actions (selection, expand) create NEW events through proper channels
 * - Respects horizon-mediated access (Rule 4)
 */

/**
 * Node types in the experience graph
 */
const GraphNodeType = Object.freeze({
  GIVEN: 'given',
  MEANT: 'meant',
  ENTITY: 'entity',
  HORIZON: 'horizon'
});

/**
 * Edge types in the experience graph
 */
const GraphEdgeType = Object.freeze({
  PROVENANCE: 'provenance',     // Meant -> Given (grounding)
  SUPERSEDES: 'supersedes',     // Meant -> Meant (revision)
  PARENT: 'parent',             // Event -> Event (causal order)
  ENTITY_SOURCE: 'entity_source', // Entity -> Event
  HORIZON_CONTAINS: 'horizon_contains' // Horizon -> Event
});

/**
 * Layout algorithms
 */
const LayoutType = Object.freeze({
  FORCE: 'force',
  HIERARCHICAL: 'hierarchical',
  RADIAL: 'radial',
  TIMELINE: 'timeline'
});

/**
 * Graph Node
 */
class GraphNode {
  constructor(id, type, data) {
    this.id = id;
    this.type = type;
    this.data = data;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.fx = null; // Fixed position
    this.fy = null;
    this.visible = true;
    this.expanded = true;
    this.selected = false;
    this.highlighted = false;
  }

  get label() {
    if (this.type === GraphNodeType.GIVEN) {
      return this.data.payload?.action || 'Given';
    }
    if (this.type === GraphNodeType.MEANT) {
      return this.data.frame?.purpose || 'Interpretation';
    }
    if (this.type === GraphNodeType.ENTITY) {
      return this.data.data?.title || this.data.type || 'Entity';
    }
    if (this.type === GraphNodeType.HORIZON) {
      return this.data.name || 'Horizon';
    }
    return this.id;
  }

  get color() {
    switch (this.type) {
      case GraphNodeType.GIVEN: return '#00ba7c';
      case GraphNodeType.MEANT: return '#7856ff';
      case GraphNodeType.ENTITY: return '#1d9bf0';
      case GraphNodeType.HORIZON: return '#ffad1f';
      default: return '#8b98a5';
    }
  }

  get radius() {
    switch (this.type) {
      case GraphNodeType.HORIZON: return 24;
      case GraphNodeType.ENTITY: return 16;
      default: return 12;
    }
  }
}

/**
 * Graph Edge
 */
class GraphEdge {
  constructor(source, target, type) {
    this.id = `${source}-${target}-${type}`;
    this.source = source;
    this.target = target;
    this.type = type;
    this.visible = true;
    this.highlighted = false;
  }

  get color() {
    switch (this.type) {
      case GraphEdgeType.PROVENANCE: return '#00ba7c';
      case GraphEdgeType.SUPERSEDES: return '#f4212e';
      case GraphEdgeType.PARENT: return '#6e7a88';
      case GraphEdgeType.ENTITY_SOURCE: return '#1d9bf0';
      default: return '#38444d';
    }
  }

  get dashArray() {
    switch (this.type) {
      case GraphEdgeType.SUPERSEDES: return '5,5';
      case GraphEdgeType.HORIZON_CONTAINS: return '2,2';
      default: return null;
    }
  }
}

/**
 * Force-Directed Layout Engine
 */
class ForceLayout {
  constructor(options = {}) {
    this.strength = options.strength || -100;
    this.linkDistance = options.linkDistance || 80;
    this.iterations = options.iterations || 300;
    this.friction = options.friction || 0.9;
    this.centerStrength = options.centerStrength || 0.1;
  }

  apply(nodes, edges, width, height) {
    // Initialize positions if not set
    for (const node of nodes) {
      if (node.x === 0 && node.y === 0) {
        node.x = width / 2 + (Math.random() - 0.5) * width * 0.5;
        node.y = height / 2 + (Math.random() - 0.5) * height * 0.5;
      }
    }

    // Create node lookup
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Run simulation
    for (let i = 0; i < this.iterations; i++) {
      const alpha = 1 - i / this.iterations;

      // Apply repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];

          let dx = n2.x - n1.x;
          let dy = n2.y - n1.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;

          const force = this.strength * alpha / (dist * dist);
          const fx = dx / dist * force;
          const fy = dy / dist * force;

          n1.vx -= fx;
          n1.vy -= fy;
          n2.vx += fx;
          n2.vy += fy;
        }
      }

      // Apply link forces
      for (const edge of edges) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) continue;

        let dx = target.x - source.x;
        let dy = target.y - source.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = (dist - this.linkDistance) * 0.1 * alpha;
        const fx = dx / dist * force;
        const fy = dy / dist * force;

        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      // Apply centering force
      const cx = width / 2;
      const cy = height / 2;
      for (const node of nodes) {
        node.vx += (cx - node.x) * this.centerStrength * alpha;
        node.vy += (cy - node.y) * this.centerStrength * alpha;
      }

      // Update positions
      for (const node of nodes) {
        if (node.fx !== null) {
          node.x = node.fx;
          node.vx = 0;
        } else {
          node.vx *= this.friction;
          node.x += node.vx;
        }

        if (node.fy !== null) {
          node.y = node.fy;
          node.vy = 0;
        } else {
          node.vy *= this.friction;
          node.y += node.vy;
        }

        // Keep in bounds
        node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
        node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
      }
    }
  }
}

/**
 * Hierarchical Layout Engine
 */
class HierarchicalLayout {
  constructor(options = {}) {
    this.levelHeight = options.levelHeight || 100;
    this.nodeSpacing = options.nodeSpacing || 60;
    this.direction = options.direction || 'TB'; // TB, BT, LR, RL
  }

  apply(nodes, edges, width, height) {
    // Build adjacency for topological sort
    const children = new Map();
    const parents = new Map();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    for (const node of nodes) {
      children.set(node.id, []);
      parents.set(node.id, []);
    }

    for (const edge of edges) {
      if (edge.type === GraphEdgeType.PROVENANCE || edge.type === GraphEdgeType.PARENT) {
        const sourceChildren = children.get(edge.source);
        if (sourceChildren) sourceChildren.push(edge.target);

        const targetParents = parents.get(edge.target);
        if (targetParents) targetParents.push(edge.source);
      }
    }

    // Find roots (nodes with no parents in the visible set)
    const roots = nodes.filter(n => parents.get(n.id).length === 0);

    // Assign levels via BFS
    const levels = new Map();
    const queue = [...roots];
    for (const root of roots) {
      levels.set(root.id, 0);
    }

    while (queue.length > 0) {
      const nodeId = queue.shift();
      const level = levels.get(nodeId);

      for (const childId of children.get(nodeId) || []) {
        if (!levels.has(childId) || levels.get(childId) < level + 1) {
          levels.set(childId, level + 1);
          queue.push(childId);
        }
      }
    }

    // Group nodes by level
    const levelGroups = new Map();
    for (const node of nodes) {
      const level = levels.get(node.id) || 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level).push(node);
    }

    // Position nodes
    const maxLevel = Math.max(...levelGroups.keys(), 0);

    for (const [level, nodesAtLevel] of levelGroups) {
      const count = nodesAtLevel.length;
      const totalWidth = count * this.nodeSpacing;
      const startX = (width - totalWidth) / 2 + this.nodeSpacing / 2;

      nodesAtLevel.forEach((node, i) => {
        if (this.direction === 'TB' || this.direction === 'BT') {
          node.x = startX + i * this.nodeSpacing;
          node.y = this.direction === 'TB'
            ? 50 + level * this.levelHeight
            : height - 50 - level * this.levelHeight;
        } else {
          node.y = startX + i * this.nodeSpacing;
          node.x = this.direction === 'LR'
            ? 50 + level * this.levelHeight
            : width - 50 - level * this.levelHeight;
        }
      });
    }
  }
}

/**
 * Timeline Layout Engine
 */
class TimelineLayout {
  constructor(options = {}) {
    this.padding = options.padding || 50;
    this.rowHeight = options.rowHeight || 40;
  }

  apply(nodes, edges, width, height) {
    // Sort nodes by timestamp
    const sortedNodes = [...nodes].sort((a, b) => {
      const timeA = new Date(a.data.timestamp || 0).getTime();
      const timeB = new Date(b.data.timestamp || 0).getTime();
      return timeA - timeB;
    });

    if (sortedNodes.length === 0) return;

    // Find time range
    const times = sortedNodes.map(n => new Date(n.data.timestamp || 0).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timeRange = maxTime - minTime || 1;

    // Group by type for vertical separation
    const byType = {
      [GraphNodeType.GIVEN]: [],
      [GraphNodeType.MEANT]: [],
      [GraphNodeType.ENTITY]: []
    };

    for (const node of sortedNodes) {
      if (byType[node.type]) {
        byType[node.type].push(node);
      }
    }

    // Position nodes
    const usableWidth = width - this.padding * 2;
    let yOffset = this.padding;

    for (const type of [GraphNodeType.GIVEN, GraphNodeType.MEANT, GraphNodeType.ENTITY]) {
      const nodesOfType = byType[type] || [];
      for (const node of nodesOfType) {
        const time = new Date(node.data.timestamp || 0).getTime();
        const progress = (time - minTime) / timeRange;
        node.x = this.padding + progress * usableWidth;
        node.y = yOffset + (Math.random() - 0.5) * this.rowHeight * 0.5;
      }
      if (nodesOfType.length > 0) {
        yOffset += this.rowHeight * 2;
      }
    }
  }
}

/**
 * Experience Graph - Main visualization component
 */
class EOGraph {
  constructor(container, app) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    this.app = app;

    this.nodes = new Map();
    this.edges = [];

    this.width = 0;
    this.height = 0;

    this.selectedNode = null;
    this.hoveredNode = null;
    this.draggedNode = null;
    this.panOffset = { x: 0, y: 0 };
    this.scale = 1;

    this.layout = LayoutType.FORCE;
    this.showGiven = true;
    this.showMeant = true;
    this.showProvenance = true;
    this.showSupersession = true;
    this.showParents = false;

    this.layouts = {
      [LayoutType.FORCE]: new ForceLayout(),
      [LayoutType.HIERARCHICAL]: new HierarchicalLayout(),
      [LayoutType.TIMELINE]: new TimelineLayout()
    };

    // Event callbacks
    this.onNodeSelect = null;
    this.onNodeDoubleClick = null;
  }

  /**
   * Initialize the graph visualization
   */
  init() {
    if (!this.container) {
      console.error('EOGraph: Container not found');
      return;
    }

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');

    // Set up event listeners
    this._setupEventListeners();

    // Initial size
    this._resize();

    // Build graph from app data
    this.buildFromApp();

    // Start render loop
    this._render();

    return this;
  }

  /**
   * Build graph from Experience Engine data
   */
  buildFromApp() {
    this.nodes.clear();
    this.edges = [];

    // Get events through horizon gate (Rule 4: Perspectivality)
    const gate = this.app.getGate();
    const events = gate.getAvailable();

    // Create nodes for events
    for (const event of events) {
      const type = event.type === 'given' ? GraphNodeType.GIVEN : GraphNodeType.MEANT;
      const node = new GraphNode(event.id, type, event);

      // Check visibility filters
      if (type === GraphNodeType.GIVEN && !this.showGiven) {
        node.visible = false;
      }
      if (type === GraphNodeType.MEANT && !this.showMeant) {
        node.visible = false;
      }

      this.nodes.set(event.id, node);
    }

    // Create edges for relationships
    for (const event of events) {
      // Provenance edges (Meant -> Given)
      if (event.provenance && this.showProvenance) {
        for (const provId of event.provenance) {
          if (this.nodes.has(provId)) {
            this.edges.push(new GraphEdge(event.id, provId, GraphEdgeType.PROVENANCE));
          }
        }
      }

      // Supersession edges
      if (event.supersedes && this.showSupersession) {
        if (this.nodes.has(event.supersedes)) {
          this.edges.push(new GraphEdge(event.id, event.supersedes, GraphEdgeType.SUPERSEDES));
        }
      }

      // Parent edges (causal order)
      if (event.parents && this.showParents) {
        for (const parentId of event.parents) {
          if (this.nodes.has(parentId)) {
            this.edges.push(new GraphEdge(event.id, parentId, GraphEdgeType.PARENT));
          }
        }
      }
    }

    // Apply layout
    this.applyLayout();
  }

  /**
   * Apply the current layout algorithm
   */
  applyLayout() {
    const visibleNodes = Array.from(this.nodes.values()).filter(n => n.visible);
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    const visibleEdges = this.edges.filter(e =>
      visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );

    const layoutEngine = this.layouts[this.layout];
    if (layoutEngine) {
      layoutEngine.apply(visibleNodes, visibleEdges, this.width, this.height);
    }
  }

  /**
   * Set layout type
   */
  setLayout(type) {
    this.layout = type;
    this.applyLayout();
  }

  /**
   * Set up event listeners
   */
  _setupEventListeners() {
    // Resize
    window.addEventListener('resize', () => this._resize());

    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e));
    this.canvas.addEventListener('dblclick', (e) => this._onDoubleClick(e));
  }

  /**
   * Handle resize
   */
  _resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  /**
   * Get node at position
   */
  _getNodeAt(x, y) {
    // Transform to graph coordinates
    const gx = (x - this.panOffset.x) / this.scale;
    const gy = (y - this.panOffset.y) / this.scale;

    for (const node of this.nodes.values()) {
      if (!node.visible) continue;

      const dx = node.x - gx;
      const dy = node.y - gy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < node.radius) {
        return node;
      }
    }

    return null;
  }

  /**
   * Mouse down handler
   */
  _onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = this._getNodeAt(x, y);

    if (node) {
      this.draggedNode = node;
      node.fx = node.x;
      node.fy = node.y;

      // Select node
      if (this.selectedNode) {
        this.selectedNode.selected = false;
      }
      node.selected = true;
      this.selectedNode = node;

      if (this.onNodeSelect) {
        this.onNodeSelect(node);
      }
    } else {
      // Start panning
      this._panStart = { x: e.clientX, y: e.clientY };
    }
  }

  /**
   * Mouse move handler
   */
  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.draggedNode) {
      // Drag node
      const gx = (x - this.panOffset.x) / this.scale;
      const gy = (y - this.panOffset.y) / this.scale;
      this.draggedNode.x = gx;
      this.draggedNode.y = gy;
      this.draggedNode.fx = gx;
      this.draggedNode.fy = gy;
    } else if (this._panStart) {
      // Pan
      this.panOffset.x += e.clientX - this._panStart.x;
      this.panOffset.y += e.clientY - this._panStart.y;
      this._panStart = { x: e.clientX, y: e.clientY };
    } else {
      // Hover
      const node = this._getNodeAt(x, y);
      if (this.hoveredNode !== node) {
        if (this.hoveredNode) this.hoveredNode.highlighted = false;
        this.hoveredNode = node;
        if (node) node.highlighted = true;
        this.canvas.style.cursor = node ? 'pointer' : 'default';
      }
    }
  }

  /**
   * Mouse up handler
   */
  _onMouseUp(e) {
    if (this.draggedNode) {
      this.draggedNode.fx = null;
      this.draggedNode.fy = null;
      this.draggedNode = null;
    }
    this._panStart = null;
  }

  /**
   * Wheel handler (zoom)
   */
  _onWheel(e) {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, this.scale * delta));

    // Zoom toward mouse position
    this.panOffset.x = x - (x - this.panOffset.x) * (newScale / this.scale);
    this.panOffset.y = y - (y - this.panOffset.y) * (newScale / this.scale);
    this.scale = newScale;
  }

  /**
   * Double click handler
   */
  _onDoubleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = this._getNodeAt(x, y);
    if (node && this.onNodeDoubleClick) {
      this.onNodeDoubleClick(node);
    }
  }

  /**
   * Render loop
   */
  _render() {
    this._draw();
    requestAnimationFrame(() => this._render());
  }

  /**
   * Draw the graph
   */
  _draw() {
    const ctx = this.ctx;

    // Clear
    ctx.fillStyle = '#0f1419';
    ctx.fillRect(0, 0, this.width, this.height);

    // Apply transform
    ctx.save();
    ctx.translate(this.panOffset.x, this.panOffset.y);
    ctx.scale(this.scale, this.scale);

    // Draw edges
    for (const edge of this.edges) {
      const source = this.nodes.get(edge.source);
      const target = this.nodes.get(edge.target);

      if (!source?.visible || !target?.visible) continue;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      ctx.strokeStyle = edge.highlighted ? '#ffffff' : edge.color;
      ctx.lineWidth = edge.highlighted ? 2 : 1;

      if (edge.dashArray) {
        ctx.setLineDash(edge.dashArray.split(',').map(Number));
      } else {
        ctx.setLineDash([]);
      }

      ctx.stroke();

      // Draw arrow
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const arrowDist = target.radius + 5;
      const arrowX = target.x - Math.cos(angle) * arrowDist;
      const arrowY = target.y - Math.sin(angle) * arrowDist;

      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - 8 * Math.cos(angle - Math.PI / 6),
        arrowY - 8 * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        arrowX - 8 * Math.cos(angle + Math.PI / 6),
        arrowY - 8 * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = edge.color;
      ctx.fill();
    }

    ctx.setLineDash([]);

    // Draw nodes
    for (const node of this.nodes.values()) {
      if (!node.visible) continue;

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

      // Fill
      if (node.selected) {
        ctx.fillStyle = '#ffffff';
      } else if (node.highlighted) {
        ctx.fillStyle = node.color;
      } else {
        ctx.fillStyle = node.color + '80'; // Semi-transparent
      }
      ctx.fill();

      // Border
      ctx.strokeStyle = node.color;
      ctx.lineWidth = node.selected ? 3 : 1;
      ctx.stroke();

      // Label
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillStyle = '#e7e9ea';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        node.label.substring(0, 15),
        node.x,
        node.y + node.radius + 4
      );
    }

    ctx.restore();

    // Draw legend
    this._drawLegend();
  }

  /**
   * Draw legend
   */
  _drawLegend() {
    const ctx = this.ctx;
    const x = 10;
    let y = this.height - 80;

    ctx.font = '11px -apple-system, sans-serif';

    const items = [
      { color: '#00ba7c', label: 'Given (Raw Experience)' },
      { color: '#7856ff', label: 'Meant (Interpretation)' },
      { color: '#f4212e', label: 'Supersedes', dash: true }
    ];

    for (const item of items) {
      // Circle or line
      ctx.beginPath();
      if (item.dash) {
        ctx.setLineDash([4, 4]);
        ctx.moveTo(x, y + 6);
        ctx.lineTo(x + 20, y + 6);
        ctx.strokeStyle = item.color;
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.arc(x + 6, y + 6, 6, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
      }

      // Label
      ctx.fillStyle = '#8b98a5';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, x + 28, y + 6);

      y += 20;
    }
  }

  /**
   * Refresh graph data
   */
  refresh() {
    this.buildFromApp();
  }

  /**
   * Center the view
   */
  centerView() {
    if (this.nodes.size === 0) return;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const node of this.nodes.values()) {
      if (!node.visible) continue;
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    }

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    this.scale = Math.min(
      (this.width - 100) / graphWidth,
      (this.height - 100) / graphHeight,
      2
    );

    this.panOffset.x = (this.width - graphWidth * this.scale) / 2 - minX * this.scale;
    this.panOffset.y = (this.height - graphHeight * this.scale) / 2 - minY * this.scale;
  }

  /**
   * Export graph as image
   */
  toDataURL() {
    return this.canvas.toDataURL('image/png');
  }
}

// Singleton
let _graph = null;

function getGraph() {
  return _graph;
}

function initGraph(container, app) {
  _graph = new EOGraph(container, app);
  _graph.init();
  return _graph;
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GraphNodeType,
    GraphEdgeType,
    LayoutType,
    GraphNode,
    GraphEdge,
    ForceLayout,
    HierarchicalLayout,
    TimelineLayout,
    EOGraph,
    getGraph,
    initGraph
  };
}

if (typeof window !== 'undefined') {
  window.GraphNodeType = GraphNodeType;
  window.GraphEdgeType = GraphEdgeType;
  window.LayoutType = LayoutType;
  window.GraphNode = GraphNode;
  window.GraphEdge = GraphEdge;
  window.ForceLayout = ForceLayout;
  window.HierarchicalLayout = HierarchicalLayout;
  window.TimelineLayout = TimelineLayout;
  window.EOGraph = EOGraph;
  window.getGraph = getGraph;
  window.initGraph = initGraph;
}
