/**
 * EO Graph - Experience Graph Visualization
 *
 * Visualizes the relationships between Given and Meant events as a graph.
 * Shows provenance chains, supersession relationships, and horizon boundaries.
 *
 * Now powered by Cytoscape.js for improved performance and features.
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
  HORIZON_CONTAINS: 'horizon_contains', // Horizon -> Event
  GRAPH_DATA: 'graph_data'      // Graph edge from edge_create events
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
 * Graph Node - Data structure for nodes
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
    return getNodeColor ? getNodeColor(this.type) : '#8b98a5';
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
 * Graph Edge - Data structure for edges
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
    return getEdgeColor ? getEdgeColor(this.type) : '#38444d';
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
 * Experience Graph - Main visualization component (Cytoscape.js powered)
 */
class EOGraph {
  constructor(container, app) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    this.app = app;

    // Data storage
    this.nodes = new Map();
    this.edges = [];

    // Cytoscape instance
    this.cy = null;

    // State
    this.selectedNode = null;
    this.hoveredNode = null;

    // Layout
    this.layout = LayoutType.FORCE;

    // Visibility filters
    this.showGiven = true;
    this.showMeant = true;
    this.showProvenance = true;
    this.showSupersession = true;
    this.showParents = false;

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

    // Ensure container has proper styling
    this.container.style.position = 'relative';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.backgroundColor = '#0f1419';

    // Initialize Cytoscape
    this.cy = createCytoscapeInstance(this.container, {
      useWorkbenchStyle: false
    });

    // Set up event handlers
    this._setupCytoscapeEvents();

    // Build graph from app data
    this.buildFromApp();

    // Draw legend
    this._drawLegend();

    return this;
  }

  /**
   * Set up Cytoscape event handlers
   */
  _setupCytoscapeEvents() {
    // Node tap (selection)
    this.cy.on('tap', 'node', (evt) => {
      const cyNode = evt.target;
      const nodeId = cyNode.id();
      const graphNode = this.nodes.get(nodeId);

      // Update selection
      if (this.selectedNode) {
        this.selectedNode.selected = false;
      }

      if (graphNode) {
        graphNode.selected = true;
        this.selectedNode = graphNode;
      }

      // Trigger callback
      if (this.onNodeSelect && graphNode) {
        this.onNodeSelect(graphNode);
      }
    });

    // Node double-tap
    this.cy.on('dbltap', 'node', (evt) => {
      const cyNode = evt.target;
      const nodeId = cyNode.id();
      const graphNode = this.nodes.get(nodeId);

      if (this.onNodeDoubleClick && graphNode) {
        this.onNodeDoubleClick(graphNode);
      }
    });

    // Node hover - mouseover
    this.cy.on('mouseover', 'node', (evt) => {
      const cyNode = evt.target;
      cyNode.addClass('highlighted');

      const nodeId = cyNode.id();
      const graphNode = this.nodes.get(nodeId);
      if (graphNode) {
        graphNode.highlighted = true;
        this.hoveredNode = graphNode;
      }

      this.container.style.cursor = 'pointer';
    });

    // Node hover - mouseout
    this.cy.on('mouseout', 'node', (evt) => {
      const cyNode = evt.target;
      cyNode.removeClass('highlighted');

      const nodeId = cyNode.id();
      const graphNode = this.nodes.get(nodeId);
      if (graphNode) {
        graphNode.highlighted = false;
      }

      this.hoveredNode = null;
      this.container.style.cursor = 'default';
    });

    // Background tap - deselect
    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy) {
        if (this.selectedNode) {
          this.selectedNode.selected = false;
          this.selectedNode = null;
        }
        this.cy.elements().removeClass('selected');
      }
    });

    // Edge hover
    this.cy.on('mouseover', 'edge', (evt) => {
      evt.target.addClass('highlighted');
    });

    this.cy.on('mouseout', 'edge', (evt) => {
      evt.target.removeClass('highlighted');
    });

    // Track node positions after drag
    this.cy.on('dragfree', 'node', (evt) => {
      const cyNode = evt.target;
      const nodeId = cyNode.id();
      const graphNode = this.nodes.get(nodeId);
      if (graphNode) {
        const pos = cyNode.position();
        graphNode.x = pos.x;
        graphNode.y = pos.y;
      }
    });
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

    // Separate graph data events from regular events
    const nodeEvents = [];
    const edgeEvents = [];
    const regularEvents = [];

    for (const event of events) {
      const action = event.payload?.action;
      if (action === 'node_create') {
        nodeEvents.push(event);
      } else if (action === 'edge_create') {
        edgeEvents.push(event);
      } else {
        regularEvents.push(event);
      }
    }

    // Check if we have graph data - if so, use graph data mode
    const hasGraphData = nodeEvents.length > 0 || edgeEvents.length > 0;

    if (hasGraphData) {
      // Graph data mode: Create nodes from node_create events
      for (const event of nodeEvents) {
        const nodeData = event.payload?.node;
        if (!nodeData?.id) continue;

        const nodeId = nodeData.id;
        const type = GraphNodeType.GIVEN;
        const node = new GraphNode(nodeId, type, event);

        // Override label from node properties
        Object.defineProperty(node, 'label', {
          get: function() {
            return nodeData.properties?.name || nodeData.properties?.label || nodeId;
          }
        });

        if (!this.showGiven) {
          node.visible = false;
        }

        this.nodes.set(nodeId, node);
      }

      // Create edges from edge_create events
      for (const event of edgeEvents) {
        const edgeData = event.payload?.edge;
        if (!edgeData?.from || !edgeData?.to) continue;

        const fromId = edgeData.from;
        const toId = edgeData.to;

        if (this.nodes.has(fromId) && this.nodes.has(toId)) {
          const edge = new GraphEdge(fromId, toId, GraphEdgeType.GRAPH_DATA);
          edge.graphEdgeType = edgeData.type;
          this.edges.push(edge);
        }
      }
    } else {
      // EO event mode: Create nodes for all events
      for (const event of events) {
        const type = event.type === 'given' ? GraphNodeType.GIVEN : GraphNodeType.MEANT;
        const node = new GraphNode(event.id, type, event);

        if (type === GraphNodeType.GIVEN && !this.showGiven) {
          node.visible = false;
        }
        if (type === GraphNodeType.MEANT && !this.showMeant) {
          node.visible = false;
        }

        this.nodes.set(event.id, node);
      }
    }

    // Create edges for EO relationships
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

    // Load from workbench
    this._loadFromWorkbench();

    // Update Cytoscape graph
    this._updateCytoscapeGraph();
  }

  /**
   * Load nodes and edges from data workbench sets
   */
  _loadFromWorkbench() {
    const workbench = typeof getDataWorkbench === 'function' ? getDataWorkbench() : null;
    if (!workbench) return;

    const sets = workbench.getSets ? workbench.getSets() : workbench.sets || [];

    // First pass: Create nodes from non-relationship sets
    for (const set of sets) {
      const isRelationshipSet = set.name?.includes('Relationships') ||
        set.name?.includes('Edges') ||
        set.name?.includes('relationships');

      const hasFromField = set.fields?.some(f =>
        f.name?.toLowerCase() === 'from' || f.name?.toLowerCase() === 'source'
      );
      const hasToField = set.fields?.some(f =>
        f.name?.toLowerCase() === 'to' || f.name?.toLowerCase() === 'target'
      );

      if (isRelationshipSet || (hasFromField && hasToField)) continue;

      const idField = set.fields?.find(f =>
        f.name?.toLowerCase() === 'id' ||
        f.name?.toLowerCase() === 'node_id' ||
        f.name?.toLowerCase() === 'name'
      ) || set.fields?.[0];

      if (!idField) continue;

      const nameField = set.fields?.find(f =>
        f.name?.toLowerCase() === 'name' ||
        f.name?.toLowerCase() === 'label' ||
        f.name?.toLowerCase() === 'title'
      );

      for (const record of set.records || []) {
        const nodeId = record.values?.[idField.id];
        if (!nodeId || this.nodes.has(nodeId)) continue;

        const type = GraphNodeType.GIVEN;
        const node = new GraphNode(nodeId, type, record);

        const labelValue = (nameField ? record.values?.[nameField.id] : null) || nodeId;
        Object.defineProperty(node, 'label', { get: () => labelValue });

        if (!this.showGiven) {
          node.visible = false;
        }

        this.nodes.set(nodeId, node);
      }
    }

    // Second pass: Create edges from relationship sets
    for (const set of sets) {
      const isRelationshipSet = set.name?.includes('Relationships') ||
        set.name?.includes('Edges') ||
        set.name?.includes('relationships');

      const fromField = set.fields?.find(f =>
        f.name?.toLowerCase() === 'from' || f.name?.toLowerCase() === 'source'
      );
      const toField = set.fields?.find(f =>
        f.name?.toLowerCase() === 'to' || f.name?.toLowerCase() === 'target'
      );

      if (!isRelationshipSet && (!fromField || !toField)) continue;
      if (!fromField || !toField) continue;

      for (const record of set.records || []) {
        const fromId = record.values?.[fromField.id];
        const toId = record.values?.[toField.id];

        if (!fromId || !toId) continue;

        if (this.nodes.has(fromId) && this.nodes.has(toId)) {
          const edge = new GraphEdge(fromId, toId, GraphEdgeType.GRAPH_DATA);
          const typeField = set.fields?.find(f => f.name?.toLowerCase() === 'type');
          if (typeField) {
            edge.graphEdgeType = record.values?.[typeField.id];
          }
          this.edges.push(edge);
        }
      }
    }
  }

  /**
   * Update the Cytoscape graph with current data
   */
  _updateCytoscapeGraph() {
    if (!this.cy) return;

    // Batch update for performance
    this.cy.startBatch();

    // Clear existing elements
    this.cy.elements().remove();

    // Add nodes
    const cyNodes = [];
    for (const node of this.nodes.values()) {
      if (!node.visible) continue;
      cyNodes.push(nodeToCytoscape(node));
    }

    // Add edges
    const cyEdges = [];
    const visibleNodeIds = new Set([...this.nodes.values()].filter(n => n.visible).map(n => n.id));
    for (const edge of this.edges) {
      if (!edge.visible) continue;
      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) continue;
      cyEdges.push(edgeToCytoscape(edge));
    }

    this.cy.add([...cyNodes, ...cyEdges]);

    this.cy.endBatch();

    // Apply layout
    this.applyLayout();
  }

  /**
   * Apply the current layout algorithm
   */
  applyLayout() {
    if (!this.cy || this.cy.nodes().length === 0) return;

    let layoutConfig;

    switch (this.layout) {
      case LayoutType.FORCE:
        layoutConfig = getLayoutConfig('force');
        break;

      case LayoutType.HIERARCHICAL:
        layoutConfig = getLayoutConfig('hierarchical');
        break;

      case LayoutType.RADIAL:
        layoutConfig = getLayoutConfig('concentric');
        break;

      case LayoutType.TIMELINE:
        // Calculate timeline positions manually
        const container = this.container.getBoundingClientRect();
        const positions = calculateTimelinePositions(
          this.cy.nodes().jsons(),
          container.width,
          container.height
        );
        layoutConfig = {
          name: 'preset',
          positions: (node) => positions[node.id()] || { x: 0, y: 0 },
          animate: true,
          animationDuration: 500,
          fit: true,
          padding: 50
        };
        break;

      default:
        layoutConfig = getLayoutConfig('force');
    }

    this.cy.layout(layoutConfig).run();
  }

  /**
   * Set layout type
   */
  setLayout(type) {
    this.layout = type;
    this.applyLayout();
  }

  /**
   * Get node by ID
   */
  _getNodeById(id) {
    return this.nodes.get(id);
  }

  /**
   * Refresh graph data
   */
  refresh() {
    this.buildFromApp();
  }

  /**
   * Center and fit the view
   */
  centerView() {
    if (this.cy) {
      this.cy.fit(undefined, 50);
    }
  }

  /**
   * Zoom in
   */
  zoomIn() {
    if (this.cy) {
      this.cy.zoom(this.cy.zoom() * 1.2);
      this.cy.center();
    }
  }

  /**
   * Zoom out
   */
  zoomOut() {
    if (this.cy) {
      this.cy.zoom(this.cy.zoom() / 1.2);
      this.cy.center();
    }
  }

  /**
   * Get current zoom level
   */
  getZoom() {
    return this.cy ? this.cy.zoom() : 1;
  }

  /**
   * Set zoom level
   */
  setZoom(level) {
    if (this.cy) {
      this.cy.zoom(level);
    }
  }

  /**
   * Export graph as PNG data URL
   */
  toDataURL() {
    if (this.cy) {
      return this.cy.png({
        full: true,
        scale: 2,
        bg: '#0f1419'
      });
    }
    return null;
  }

  /**
   * Export graph as JSON
   */
  toJSON() {
    if (this.cy) {
      return this.cy.json();
    }
    return null;
  }

  /**
   * Draw legend
   */
  _drawLegend() {
    if (typeof drawGraphLegend === 'function' && typeof eoGraphLegendItems !== 'undefined') {
      drawGraphLegend(this.container, eoGraphLegendItems);
    }
  }

  /**
   * Set visibility filter for Given nodes
   */
  setShowGiven(show) {
    this.showGiven = show;
    this.buildFromApp();
  }

  /**
   * Set visibility filter for Meant nodes
   */
  setShowMeant(show) {
    this.showMeant = show;
    this.buildFromApp();
  }

  /**
   * Set visibility filter for provenance edges
   */
  setShowProvenance(show) {
    this.showProvenance = show;
    this.buildFromApp();
  }

  /**
   * Set visibility filter for supersession edges
   */
  setShowSupersession(show) {
    this.showSupersession = show;
    this.buildFromApp();
  }

  /**
   * Set visibility filter for parent edges
   */
  setShowParents(show) {
    this.showParents = show;
    this.buildFromApp();
  }

  /**
   * Destroy the graph instance
   */
  destroy() {
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }

    // Remove legend
    const legend = this.container.querySelector('.cy-legend');
    if (legend) legend.remove();
  }

  /**
   * Get Cytoscape instance for advanced usage
   */
  getCytoscape() {
    return this.cy;
  }

  /**
   * Get dimensions
   */
  get width() {
    return this.container ? this.container.clientWidth : 0;
  }

  get height() {
    return this.container ? this.container.clientHeight : 0;
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
  window.EOGraph = EOGraph;
  window.getGraph = getGraph;
  window.initGraph = initGraph;
}
