/**
 * EO Graph Traversal - First-Class Edges and Pipeline Evaluation
 *
 * Implements graph traversal using existing EO operators:
 * - SEG: Select starting nodes / filter during traversal
 * - CON: Follow one edge (connection)
 * - REC: Follow edges recursively
 * - SUP: Hold multiple paths (superposition)
 * - SYN: Collapse paths to result (synthesis)
 * - ALT: Switch edge type mid-traversal (alternation)
 * - DES: Name/type the result (designation)
 * - NUL: Handle dead ends (nullity)
 * - INS: Insert into state (insertion)
 *
 * COMPLIANCE NOTES:
 * - Edges are first-class Given events
 * - EdgeIndex is a derived view (read-only)
 * - Traversal results are ephemeral, not persisted
 * - All access respects Horizon-mediated visibility (Rule 4)
 */

/**
 * Operator types for graph traversal pipelines
 */
const GraphOperator = Object.freeze({
  SEG: 'SEG',   // Segmentation - filter/select nodes
  CON: 'CON',   // Connection - traverse edges
  REC: 'REC',   // Recursion - repeated traversal
  SUP: 'SUP',   // Superposition - branching paths
  SYN: 'SYN',   // Synthesis - collapse/aggregate
  ALT: 'ALT',   // Alternation - switch context
  DES: 'DES',   // Designation - name intermediate result
  NUL: 'NUL',   // Nullity - handle empty results
  INS: 'INS'    // Insertion - add to state
});

/**
 * Traversal direction
 */
const Direction = Object.freeze({
  OUT: 'out',
  IN: 'in',
  BOTH: 'both'
});

/**
 * Path collection modes
 */
const CollectMode = Object.freeze({
  PATHS: 'paths',
  NODES: 'nodes',
  TERMINAL_NODES: 'terminal_nodes',
  EDGES: 'edges'
});

/**
 * Synthesis modes
 */
const SynthesisMode = Object.freeze({
  SHORTEST_PATH: 'shortest_path',
  ALL_PATHS: 'all_paths',
  UNION_NODES: 'union_nodes',
  COUNT: 'count',
  AGGREGATE: 'aggregate'
});

// ============================================================================
// EDGE EVENT SCHEMA
// ============================================================================

/**
 * Create an edge event (Given event with edge payload)
 *
 * Edge events represent relationships between items in the graph.
 * They are first-class Given events, immutable and append-only.
 *
 * @param {Object} params - Edge parameters
 * @param {string} params.from - Source node ID
 * @param {string} params.to - Target node ID
 * @param {string} params.type - Edge type (e.g., 'knows', 'employed_by')
 * @param {Object} params.properties - Edge properties (e.g., { since: 2019 })
 * @param {string} params.actor - Who created this edge
 * @param {Object} params.context - Context envelope
 * @returns {Object} Edge event ready for appending to event store
 */
function createEdgeEvent(params) {
  const { from, to, type, properties = {}, actor, context = {} } = params;

  if (!from || !to || !type) {
    throw new Error('Edge requires from, to, and type');
  }

  const eventId = generateEdgeId(from, to, type);

  return {
    id: eventId,
    type: 'given',
    actor: actor || 'system',
    timestamp: new Date().toISOString(),
    mode: 'received',
    context: {
      workspace: context.workspace || 'default',
      schemaVersion: context.schemaVersion || '1.0',
      source: context.source || 'graph_input',
      ...context
    },
    payload: {
      action: 'edge_create',
      edge: {
        from,
        to,
        type,
        properties
      }
    }
  };
}

/**
 * Generate deterministic edge ID
 */
function generateEdgeId(from, to, type) {
  const str = `edge:${from}:${to}:${type}:${Date.now()}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return 'edge_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
}

/**
 * Create a node event (Given event with node payload)
 *
 * @param {Object} params - Node parameters
 * @param {string} params.id - Node ID
 * @param {string} params.type - Node type (e.g., 'person', 'org', 'contract')
 * @param {Object} params.properties - Node properties
 * @param {string} params.actor - Who created this node
 * @param {Object} params.context - Context envelope
 * @returns {Object} Node event ready for appending to event store
 */
function createNodeEvent(params) {
  const { id, type, properties = {}, actor, context = {} } = params;

  if (!id || !type) {
    throw new Error('Node requires id and type');
  }

  const eventId = generateNodeEventId(id);

  return {
    id: eventId,
    type: 'given',
    actor: actor || 'system',
    timestamp: new Date().toISOString(),
    mode: 'received',
    context: {
      workspace: context.workspace || 'default',
      schemaVersion: context.schemaVersion || '1.0',
      source: context.source || 'graph_input',
      ...context
    },
    payload: {
      action: 'node_create',
      node: {
        id,
        type,
        properties
      }
    }
  };
}

/**
 * Generate deterministic node event ID
 */
function generateNodeEventId(nodeId) {
  const str = `node:${nodeId}:${Date.now()}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return 'node_evt_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
}

// ============================================================================
// EDGE INDEX (Derived View)
// ============================================================================

/**
 * EdgeIndex - Derived index for graph traversal
 *
 * This is a READ-ONLY view built from edge events in the event store.
 * It provides O(1) lookups for graph traversal operations.
 *
 * COMPLIANCE: This is a derived view (Rule 7 - all interpretations grounded)
 */
class EdgeIndex {
  constructor() {
    // Primary indexes
    this.byFrom = new Map();      // nodeId -> Edge[]
    this.byTo = new Map();        // nodeId -> Edge[]
    this.byType = new Map();      // edgeType -> Edge[]
    this.byId = new Map();        // edgeId -> Edge

    // Node index
    this.nodes = new Map();       // nodeId -> Node

    // Metadata
    this.edgeCount = 0;
    this.nodeCount = 0;
    this.lastRebuild = null;
  }

  /**
   * Rebuild index from event store
   *
   * @param {Array} events - Array of events from event store
   */
  rebuild(events) {
    this.clear();

    for (const event of events) {
      if (event.payload?.action === 'node_create' && event.payload?.node) {
        this.indexNode(event.payload.node, event.id);
      }
      if (event.payload?.action === 'edge_create' && event.payload?.edge) {
        this.indexEdge(event.payload.edge, event.id);
      }
    }

    this.lastRebuild = new Date().toISOString();
  }

  /**
   * Index a single node
   */
  indexNode(node, eventId) {
    const indexed = {
      ...node,
      _eventId: eventId
    };
    this.nodes.set(node.id, indexed);
    this.nodeCount++;
  }

  /**
   * Index a single edge
   */
  indexEdge(edge, eventId) {
    const indexed = {
      id: eventId,
      from: edge.from,
      to: edge.to,
      type: edge.type,
      properties: edge.properties || {},
      _eventId: eventId
    };

    // Index by ID
    this.byId.set(eventId, indexed);

    // Index by from
    if (!this.byFrom.has(edge.from)) {
      this.byFrom.set(edge.from, []);
    }
    this.byFrom.get(edge.from).push(indexed);

    // Index by to
    if (!this.byTo.has(edge.to)) {
      this.byTo.set(edge.to, []);
    }
    this.byTo.get(edge.to).push(indexed);

    // Index by type
    if (!this.byType.has(edge.type)) {
      this.byType.set(edge.type, []);
    }
    this.byType.get(edge.type).push(indexed);

    this.edgeCount++;
  }

  /**
   * Clear all indexes
   */
  clear() {
    this.byFrom.clear();
    this.byTo.clear();
    this.byType.clear();
    this.byId.clear();
    this.nodes.clear();
    this.edgeCount = 0;
    this.nodeCount = 0;
  }

  /**
   * Get node by ID
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all nodes
   */
  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  /**
   * Get nodes by type
   */
  getNodesByType(type) {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }

  /**
   * Single-hop traversal (this is CON - Connection operator)
   *
   * @param {string} nodeId - Starting node
   * @param {Object} options - Traversal options
   * @param {string} options.direction - 'out', 'in', or 'both'
   * @param {string[]} options.edgeTypes - Filter by edge types (null = all)
   * @param {Function} options.edgeFilter - Custom edge filter function
   * @returns {Edge[]} Matching edges
   */
  traverse(nodeId, options = {}) {
    const {
      direction = Direction.OUT,
      edgeTypes = null,
      edgeFilter = null
    } = options;

    let edges = [];

    // Collect outgoing edges
    if (direction === Direction.OUT || direction === Direction.BOTH) {
      const outgoing = this.byFrom.get(nodeId) || [];
      edges.push(...outgoing);
    }

    // Collect incoming edges
    if (direction === Direction.IN || direction === Direction.BOTH) {
      const incoming = this.byTo.get(nodeId) || [];
      edges.push(...incoming);
    }

    // Filter by edge types
    if (edgeTypes && edgeTypes.length > 0) {
      edges = edges.filter(e => edgeTypes.includes(e.type));
    }

    // Apply custom filter
    if (edgeFilter) {
      edges = edges.filter(edgeFilter);
    }

    return edges;
  }

  /**
   * Get the other end of an edge from a given node
   */
  getOtherEnd(edge, fromNodeId) {
    if (edge.from === fromNodeId) {
      return edge.to;
    } else if (edge.to === fromNodeId) {
      return edge.from;
    }
    return null;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      nodeCount: this.nodeCount,
      edgeCount: this.edgeCount,
      edgeTypes: Array.from(this.byType.keys()),
      nodeTypes: Array.from(new Set(Array.from(this.nodes.values()).map(n => n.type))),
      lastRebuild: this.lastRebuild
    };
  }
}

// ============================================================================
// PIPELINE STATE
// ============================================================================

/**
 * TraversalState - State passed through pipeline
 */
class TraversalState {
  constructor(initialNodes = []) {
    this.nodes = new Set(initialNodes);     // Current node set (IDs)
    this.edges = [];                         // Edges traversed
    this.paths = [];                         // Path accumulator
    this.visited = new Set();                // Cycle detection
    this.depth = 0;                          // Current recursion depth
    this.namedResults = new Map();           // DES-named intermediate results
    this.nul = null;                         // NUL condition if triggered
  }

  /**
   * Clone state for branching
   */
  clone() {
    const cloned = new TraversalState();
    cloned.nodes = new Set(this.nodes);
    cloned.edges = [...this.edges];
    cloned.paths = this.paths.map(p => p.clone ? p.clone() : p);
    cloned.visited = new Set(this.visited);
    cloned.depth = this.depth;
    cloned.namedResults = new Map(this.namedResults);
    cloned.nul = this.nul;
    return cloned;
  }

  /**
   * Get node IDs as array
   */
  getNodeIds() {
    return Array.from(this.nodes);
  }

  /**
   * Check if empty
   */
  isEmpty() {
    return this.nodes.size === 0;
  }
}

/**
 * Path - Represents a traversal path
 */
class TraversalPath {
  constructor(startNodeId) {
    this.nodes = [startNodeId];
    this.edges = [];
  }

  /**
   * Extend path with an edge
   */
  extend(edge, toNodeId) {
    const extended = new TraversalPath(this.nodes[0]);
    extended.nodes = [...this.nodes, toNodeId];
    extended.edges = [...this.edges, edge];
    return extended;
  }

  /**
   * Get path length (number of edges)
   */
  get length() {
    return this.edges.length;
  }

  /**
   * Get terminal node
   */
  get terminal() {
    return this.nodes[this.nodes.length - 1];
  }

  /**
   * Check if path contains node
   */
  contains(nodeId) {
    return this.nodes.includes(nodeId);
  }

  /**
   * Clone this path
   */
  clone() {
    const cloned = new TraversalPath(this.nodes[0]);
    cloned.nodes = [...this.nodes];
    cloned.edges = [...this.edges];
    return cloned;
  }
}

// ============================================================================
// OPERATOR IMPLEMENTATIONS
// ============================================================================

/**
 * Apply SEG (Segmentation) operator
 *
 * Filters nodes based on criteria.
 *
 * @param {Object} params - SEG parameters
 * @param {string} params.nodeId - Select specific node by ID
 * @param {string|string[]} params.nodeType - Filter by node type(s)
 * @param {Object} params.nodeFilter - Property filter { property, operator, value }
 * @param {boolean} params.excludeVisited - Exclude already-visited nodes
 * @param {number} params.maxResults - Limit results
 * @param {string} params.intersectWith - Intersect with named result
 * @param {TraversalState} state - Current state
 * @param {EdgeIndex} index - Edge index
 * @returns {TraversalState} Updated state
 */
function applySEG(params, state, index) {
  const result = state.clone();

  // Select specific node
  if (params.nodeId) {
    result.nodes = new Set([params.nodeId]);
    return result;
  }

  // If no current nodes, start from all nodes matching criteria
  if (result.nodes.size === 0 && (params.nodeType || params.nodeFilter)) {
    const allNodes = index.getAllNodes();
    for (const node of allNodes) {
      if (matchesNodeCriteria(node, params)) {
        result.nodes.add(node.id);
      }
    }
    return result;
  }

  // Filter existing nodes
  const filtered = new Set();
  for (const nodeId of result.nodes) {
    const node = index.getNode(nodeId);
    if (!node) continue;

    // Type filter
    if (params.nodeType) {
      const types = Array.isArray(params.nodeType) ? params.nodeType : [params.nodeType];
      if (!types.includes(node.type)) continue;
    }

    // Property filter
    if (params.nodeFilter && !matchesPropertyFilter(node.properties, params.nodeFilter)) {
      continue;
    }

    // Exclude visited
    if (params.excludeVisited && result.visited.has(nodeId)) {
      continue;
    }

    filtered.add(nodeId);
  }

  // Intersect with named result
  if (params.intersectWith && result.namedResults.has(params.intersectWith)) {
    const namedNodes = result.namedResults.get(params.intersectWith);
    const intersection = new Set();
    for (const nodeId of filtered) {
      if (namedNodes.has(nodeId)) {
        intersection.add(nodeId);
      }
    }
    result.nodes = intersection;
  } else {
    result.nodes = filtered;
  }

  // Apply max results
  if (params.maxResults && result.nodes.size > params.maxResults) {
    const limited = Array.from(result.nodes).slice(0, params.maxResults);
    result.nodes = new Set(limited);
  }

  return result;
}

/**
 * Check if node matches criteria
 */
function matchesNodeCriteria(node, params) {
  if (params.nodeType) {
    const types = Array.isArray(params.nodeType) ? params.nodeType : [params.nodeType];
    if (!types.includes(node.type)) return false;
  }

  if (params.nodeFilter && !matchesPropertyFilter(node.properties, params.nodeFilter)) {
    return false;
  }

  return true;
}

/**
 * Check if properties match filter
 */
function matchesPropertyFilter(properties, filter) {
  const { property, operator, value } = filter;
  const propValue = properties?.[property];

  switch (operator) {
    case '=':
    case 'eq':
      return propValue === value;
    case '!=':
    case 'neq':
      return propValue !== value;
    case '>':
    case 'gt':
      return propValue > value;
    case '<':
    case 'lt':
      return propValue < value;
    case '>=':
    case 'gte':
      return propValue >= value;
    case '<=':
    case 'lte':
      return propValue <= value;
    case 'contains':
      return String(propValue).includes(String(value));
    case 'startsWith':
      return String(propValue).startsWith(String(value));
    case 'endsWith':
      return String(propValue).endsWith(String(value));
    case 'in':
      return Array.isArray(value) && value.includes(propValue);
    case 'exists':
      return propValue !== undefined && propValue !== null;
    default:
      return true;
  }
}

/**
 * Apply CON (Connection) operator
 *
 * Traverse edges from current nodes.
 *
 * @param {Object} params - CON parameters
 * @param {string[]} params.edgeTypes - Edge types to follow (null = all)
 * @param {string} params.direction - 'out', 'in', 'both'
 * @param {Object} params.edgeFilter - Edge property filter
 * @param {string} params.return - 'nodes', 'edges', 'both'
 * @param {TraversalState} state - Current state
 * @param {EdgeIndex} index - Edge index
 * @returns {TraversalState} Updated state
 */
function applyCON(params, state, index) {
  const result = state.clone();
  const newNodes = new Set();
  const newEdges = [];

  for (const nodeId of state.nodes) {
    const edges = index.traverse(nodeId, {
      direction: params.direction || Direction.OUT,
      edgeTypes: params.edgeTypes,
      edgeFilter: params.edgeFilter ? (e) => matchesPropertyFilter(e.properties, params.edgeFilter) : null
    });

    for (const edge of edges) {
      const otherEnd = index.getOtherEnd(edge, nodeId);
      if (otherEnd) {
        newNodes.add(otherEnd);
        newEdges.push(edge);
      }
    }
  }

  // Update based on return type
  const returnType = params.return || 'nodes';
  if (returnType === 'nodes' || returnType === 'both') {
    result.nodes = newNodes;
  }
  if (returnType === 'edges' || returnType === 'both') {
    result.edges = [...result.edges, ...newEdges];
  }

  return result;
}

/**
 * Apply REC (Recursion) operator
 *
 * Repeatedly apply a pipeline until termination condition.
 *
 * @param {Object} params - REC parameters
 * @param {Array} params.pipeline - Pipeline to repeat
 * @param {Object} params.until - Termination conditions
 * @param {number} params.until.maxDepth - Maximum recursion depth
 * @param {string} params.until.targetReached - Stop when target node found
 * @param {boolean} params.until.fixedPoint - Stop when no new nodes
 * @param {Object} params.until.condition - Custom stop condition
 * @param {string} params.collect - What to accumulate: 'paths', 'nodes', 'terminal_nodes'
 * @param {TraversalState} state - Current state
 * @param {Object} context - Evaluation context
 * @returns {TraversalState} Updated state
 */
function applyREC(params, state, index, context) {
  const result = state.clone();
  let current = state.clone();
  let depth = 0;
  const allPaths = [];
  const allNodes = new Set(state.nodes);
  const targetId = params.until?.targetReached;

  // Initialize paths from starting nodes
  let activePaths = Array.from(state.nodes).map(nodeId => new TraversalPath(nodeId));

  while (true) {
    // Check max depth BEFORE extending
    if (params.until?.maxDepth !== undefined && depth >= params.until.maxDepth) {
      break;
    }

    // Mark current nodes as visited
    for (const nodeId of current.nodes) {
      current.visited.add(nodeId);
    }

    // Extend paths FIRST
    const newActivePaths = [];
    let targetReached = false;

    for (const path of activePaths) {
      const terminalNode = path.terminal;

      // Get edges from this terminal node
      const edges = index.traverse(terminalNode, {
        direction: params.pipeline[0]?.params?.direction || Direction.OUT,
        edgeTypes: params.pipeline[0]?.params?.edgeTypes
      });

      for (const edge of edges) {
        const otherEnd = index.getOtherEnd(edge, terminalNode);
        if (otherEnd && !path.contains(otherEnd)) {
          const extended = path.extend(edge, otherEnd);
          newActivePaths.push(extended);
          allNodes.add(otherEnd);

          // Check if this path reaches target
          if (targetId && otherEnd === targetId) {
            targetReached = true;
            if (params.collect === CollectMode.PATHS) {
              allPaths.push(extended);
            }
          }
        }
      }
    }

    // Update active paths
    activePaths = newActivePaths;

    // Check if target was reached
    if (targetId && targetReached) {
      // Continue to find all paths to target at this depth level
      // (we've already collected them above)
      break;
    }

    // Check custom condition
    if (params.until?.condition) {
      const newNodeIds = newActivePaths.map(p => p.terminal);
      const anyMatch = newNodeIds.some(nodeId => {
        const node = index.getNode(nodeId);
        return node && matchesPropertyFilter(node.properties || { type: node.type }, params.until.condition);
      });
      if (anyMatch) break;
    }

    // Check fixed point - no new paths found
    if (params.until?.fixedPoint && newActivePaths.length === 0) {
      break;
    }

    // No new paths found at all
    if (newActivePaths.length === 0) {
      break;
    }

    // Update current state for next iteration
    current.nodes = new Set(newActivePaths.map(p => p.terminal));
    depth++;
  }

  // Set result based on collect mode
  result.depth = depth;

  switch (params.collect) {
    case CollectMode.PATHS:
      result.paths = allPaths;
      result.nodes = new Set(allPaths.map(p => p.terminal));
      break;
    case CollectMode.NODES:
      result.nodes = allNodes;
      break;
    case CollectMode.TERMINAL_NODES:
      result.nodes = new Set(activePaths.map(p => p.terminal));
      break;
    default:
      result.nodes = allNodes;
  }

  return result;
}

/**
 * Apply SUP (Superposition) operator
 *
 * Handle multiple paths/branches.
 *
 * @param {Object} params - SUP parameters
 * @param {string} params.mode - 'all_paths', 'shortest', 'all_nodes'
 * @param {boolean} params.preserveStructure - Keep path structure
 * @param {TraversalState} state - Current state
 * @returns {TraversalState} Updated state
 */
function applySUP(params, state, index) {
  const result = state.clone();

  switch (params.mode) {
    case 'shortest':
      if (result.paths.length > 0) {
        const shortest = result.paths.reduce((min, path) =>
          path.length < min.length ? path : min
        );
        result.paths = [shortest];
      }
      break;

    case 'all_paths':
      // Keep all paths (default behavior)
      break;

    case 'all_nodes':
      // Flatten all path nodes into node set
      const allNodes = new Set();
      for (const path of result.paths) {
        for (const nodeId of path.nodes) {
          allNodes.add(nodeId);
        }
      }
      result.nodes = allNodes;
      break;
  }

  return result;
}

/**
 * Apply SYN (Synthesis) operator
 *
 * Collapse and aggregate results.
 *
 * @param {Object} params - SYN parameters
 * @param {string} params.mode - 'shortest_path', 'all_paths', 'union_nodes', 'count', 'aggregate'
 * @param {Object} params.aggregate - Aggregation config { property, function }
 * @param {string} params.groupBy - Group results by this designation
 * @param {Object} params.having - Filter groups { count: { '>': 0 } }
 * @param {TraversalState} state - Current state
 * @returns {TraversalState} Updated state
 */
function applySYN(params, state, index) {
  const result = state.clone();

  switch (params.mode) {
    case SynthesisMode.SHORTEST_PATH:
      if (result.paths.length > 0) {
        result.paths = [result.paths.reduce((min, p) => p.length < min.length ? p : min)];
      }
      break;

    case SynthesisMode.ALL_PATHS:
      // Already have all paths
      break;

    case SynthesisMode.UNION_NODES:
      const union = new Set();
      for (const path of result.paths) {
        for (const nodeId of path.nodes) {
          union.add(nodeId);
        }
      }
      result.nodes = union;
      break;

    case SynthesisMode.COUNT:
      result.count = result.nodes.size;
      result.pathCount = result.paths.length;
      break;

    case SynthesisMode.AGGREGATE:
      if (params.aggregate) {
        const { property, function: fn } = params.aggregate;
        let values = [];

        // Collect values from edges
        for (const edge of result.edges) {
          if (edge.properties?.[property] !== undefined) {
            values.push(edge.properties[property]);
          }
        }

        // Apply aggregation function
        switch (fn) {
          case 'sum':
            result.aggregateValue = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            result.aggregateValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            break;
          case 'min':
            result.aggregateValue = Math.min(...values);
            break;
          case 'max':
            result.aggregateValue = Math.max(...values);
            break;
          case 'count':
            result.aggregateValue = values.length;
            break;
        }
      }
      break;
  }

  return result;
}

/**
 * Apply DES (Designation) operator
 *
 * Name intermediate results for later reference.
 *
 * @param {Object} params - DES parameters
 * @param {string} params.as - Name for this result
 * @param {TraversalState} state - Current state
 * @returns {TraversalState} Updated state
 */
function applyDES(params, state, index) {
  const result = state.clone();

  if (params.as) {
    result.namedResults.set(params.as, new Set(result.nodes));
  }

  return result;
}

/**
 * Apply ALT (Alternation) operator
 *
 * Switch context or rewind to previous state.
 *
 * @param {Object} params - ALT parameters
 * @param {string} params.rewindTo - Rewind to named result
 * @param {TraversalState} state - Current state
 * @returns {TraversalState} Updated state
 */
function applyALT(params, state, index) {
  const result = state.clone();

  if (params.rewindTo && result.namedResults.has(params.rewindTo)) {
    result.nodes = new Set(result.namedResults.get(params.rewindTo));
  }

  return result;
}

/**
 * Apply NUL (Nullity) operator
 *
 * Handle empty results.
 *
 * @param {Object} params - NUL parameters
 * @param {*} params.defaultValue - Value to return if empty
 * @param {string} params.onEmpty - Action: 'continue', 'stop', 'error'
 * @param {TraversalState} state - Current state
 * @returns {TraversalState} Updated state
 */
function applyNUL(params, state, index) {
  const result = state.clone();

  if (result.isEmpty()) {
    result.nul = {
      reason: 'empty_result',
      action: params.onEmpty || 'continue',
      defaultValue: params.defaultValue
    };
  }

  return result;
}

/**
 * Apply INS (Insertion) operator
 *
 * Add nodes to current state.
 *
 * @param {Object} params - INS parameters
 * @param {string[]} params.nodeIds - Node IDs to add
 * @param {string} params.fromNamed - Add from named result
 * @param {TraversalState} state - Current state
 * @returns {TraversalState} Updated state
 */
function applyINS(params, state, index) {
  const result = state.clone();

  if (params.nodeIds) {
    for (const nodeId of params.nodeIds) {
      result.nodes.add(nodeId);
    }
  }

  if (params.fromNamed && result.namedResults.has(params.fromNamed)) {
    const named = result.namedResults.get(params.fromNamed);
    for (const nodeId of named) {
      result.nodes.add(nodeId);
    }
  }

  return result;
}

// ============================================================================
// PIPELINE EVALUATOR
// ============================================================================

/**
 * Apply a single operator
 */
function applyOperator(step, state, index, context = {}) {
  switch (step.op) {
    case GraphOperator.SEG:
      return applySEG(step.params || {}, state, index);

    case GraphOperator.CON:
      return applyCON(step.params || {}, state, index);

    case GraphOperator.REC:
      return applyREC(step.params || {}, state, index, context);

    case GraphOperator.SUP:
      return applySUP(step.params || {}, state, index);

    case GraphOperator.SYN:
      return applySYN(step.params || {}, state, index);

    case GraphOperator.DES:
      return applyDES(step.params || {}, state, index);

    case GraphOperator.ALT:
      return applyALT(step.params || {}, state, index);

    case GraphOperator.NUL:
      return applyNUL(step.params || {}, state, index);

    case GraphOperator.INS:
      return applyINS(step.params || {}, state, index);

    default:
      console.warn(`Unknown operator: ${step.op}`);
      return state;
  }
}

/**
 * Evaluate a traversal pipeline
 *
 * @param {Array} pipeline - Array of operator steps
 * @param {TraversalState} initialState - Starting state
 * @param {EdgeIndex} index - Edge index
 * @param {Object} context - Evaluation context
 * @returns {TraversalState} Final state
 */
function evaluatePipeline(pipeline, initialState, index, context = {}) {
  let state = initialState;

  for (const step of pipeline) {
    state = applyOperator(step, state, index, context);

    // Check for NUL condition
    if (state.nul && state.nul.action === 'stop') {
      break;
    }
    if (state.nul && state.nul.action === 'error') {
      throw new Error(`Pipeline stopped: ${state.nul.reason}`);
    }
  }

  return state;
}

// ============================================================================
// GRAPH TRAVERSAL ENGINE
// ============================================================================

/**
 * GraphTraversalEngine - Main interface for graph operations
 */
class GraphTraversalEngine {
  constructor(eventStore = null) {
    this.eventStore = eventStore;
    this.index = new EdgeIndex();
    this._subscribed = false;
  }

  /**
   * Initialize from event store
   */
  initialize(eventStore = null) {
    if (eventStore) {
      this.eventStore = eventStore;
    }

    if (this.eventStore) {
      this.rebuildIndex();

      // Subscribe to new events
      if (!this._subscribed) {
        this.eventStore.subscribe((event) => {
          if (event.payload?.action === 'node_create') {
            this.index.indexNode(event.payload.node, event.id);
          }
          if (event.payload?.action === 'edge_create') {
            this.index.indexEdge(event.payload.edge, event.id);
          }
        });
        this._subscribed = true;
      }
    }
  }

  /**
   * Rebuild index from event store
   */
  rebuildIndex() {
    if (this.eventStore) {
      const events = this.eventStore.getAll();
      this.index.rebuild(events);
    }
  }

  /**
   * Add a node
   */
  addNode(id, type, properties = {}, actor = 'system', context = {}) {
    const event = createNodeEvent({ id, type, properties, actor, context });

    if (this.eventStore) {
      const result = this.eventStore.append(event);
      if (!result.success) {
        throw new Error(`Failed to add node: ${result.error || result.errors?.join(', ')}`);
      }
    } else {
      // Direct index update if no event store
      this.index.indexNode({ id, type, properties }, event.id);
    }

    return event;
  }

  /**
   * Add an edge
   */
  addEdge(from, to, type, properties = {}, actor = 'system', context = {}) {
    const event = createEdgeEvent({ from, to, type, properties, actor, context });

    if (this.eventStore) {
      const result = this.eventStore.append(event);
      if (!result.success) {
        throw new Error(`Failed to add edge: ${result.error || result.errors?.join(', ')}`);
      }
    } else {
      // Direct index update if no event store
      this.index.indexEdge({ from, to, type, properties }, event.id);
    }

    return event;
  }

  /**
   * Execute a traversal pipeline
   *
   * @param {Array} pipeline - Pipeline steps
   * @param {Object} options - Execution options
   * @param {string|string[]} options.startNodes - Starting node ID(s)
   * @returns {Object} Traversal result
   */
  execute(pipeline, options = {}) {
    // Create initial state
    const startNodes = options.startNodes
      ? (Array.isArray(options.startNodes) ? options.startNodes : [options.startNodes])
      : [];

    const initialState = new TraversalState(startNodes);

    // Evaluate pipeline
    const result = evaluatePipeline(pipeline, initialState, this.index, options.context || {});

    // Format result
    return {
      nodes: Array.from(result.nodes).map(id => this.index.getNode(id)).filter(Boolean),
      nodeIds: result.getNodeIds(),
      edges: result.edges,
      paths: result.paths.map(p => ({
        nodes: p.nodes.map(id => this.index.getNode(id)).filter(Boolean),
        nodeIds: p.nodes,
        edges: p.edges,
        length: p.length
      })),
      depth: result.depth,
      namedResults: Object.fromEntries(
        Array.from(result.namedResults.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      count: result.count,
      pathCount: result.pathCount,
      aggregateValue: result.aggregateValue,
      nul: result.nul
    };
  }

  /**
   * Convenience: Find all paths between two nodes
   */
  findPaths(fromId, toId, options = {}) {
    const maxDepth = options.maxDepth || 6;
    const edgeTypes = options.edgeTypes || null;
    const direction = options.direction || Direction.BOTH;

    const pipeline = [
      { op: GraphOperator.SEG, params: { nodeId: fromId } },
      {
        op: GraphOperator.REC,
        params: {
          pipeline: [
            { op: GraphOperator.CON, params: { direction, edgeTypes, return: 'both' } },
            { op: GraphOperator.SEG, params: { excludeVisited: true } }
          ],
          until: {
            targetReached: toId,
            maxDepth
          },
          collect: CollectMode.PATHS
        }
      },
      { op: GraphOperator.SUP, params: { mode: 'all_paths' } }
    ];

    return this.execute(pipeline, { startNodes: fromId });
  }

  /**
   * Convenience: Find nodes within N hops
   */
  findWithinHops(startId, maxHops, options = {}) {
    const edgeTypes = options.edgeTypes || null;
    const direction = options.direction || Direction.BOTH;
    const nodeType = options.nodeType || null;

    const pipeline = [
      { op: GraphOperator.SEG, params: { nodeId: startId } },
      {
        op: GraphOperator.REC,
        params: {
          pipeline: [
            { op: GraphOperator.CON, params: { direction, edgeTypes } },
            { op: GraphOperator.SEG, params: { excludeVisited: true, nodeType } }
          ],
          until: { maxDepth: maxHops },
          collect: CollectMode.NODES
        }
      }
    ];

    return this.execute(pipeline, { startNodes: startId });
  }

  /**
   * Get index statistics
   */
  getStats() {
    return this.index.getStats();
  }
}

// ============================================================================
// DEMO DATA: Nashville Investigation
// ============================================================================

/**
 * Load the Nashville investigation demo data
 */
function loadNashvilleDemo(engine) {
  const actor = 'demo_loader';
  const context = { workspace: 'nashville_investigation', source: 'demo' };

  // NODES
  const nodes = [
    { id: 'alice', type: 'person', properties: { name: 'Alice Chen', city: 'Nashville' } },
    { id: 'bob', type: 'person', properties: { name: 'Bob Smith', city: 'Nashville' } },
    { id: 'carol', type: 'person', properties: { name: 'Carol Jones', city: 'Memphis' } },
    { id: 'dave', type: 'person', properties: { name: 'Dave Wilson', city: 'Nashville' } },
    { id: 'metro', type: 'org', properties: { name: 'Metro Nashville' } },
    { id: 'ohs', type: 'org', properties: { name: 'Office of Homeless Services' } },
    { id: 'acme_llc', type: 'org', properties: { name: 'Acme Consulting LLC' } },
    { id: 'contract_1', type: 'contract', properties: { amount: 450000, date: '2023-03-15' } },
    { id: 'contract_2', type: 'contract', properties: { amount: 89000, date: '2023-07-22' } }
  ];

  // EDGES
  const edges = [
    { from: 'alice', to: 'bob', type: 'knows', properties: { since: 2019 } },
    { from: 'bob', to: 'carol', type: 'knows', properties: { since: 2021 } },
    { from: 'carol', to: 'dave', type: 'knows', properties: { since: 2018 } },
    { from: 'dave', to: 'alice', type: 'knows', properties: { since: 2020 } },
    { from: 'alice', to: 'bob', type: 'worked_with', properties: { project: 'housing initiative' } },
    { from: 'bob', to: 'metro', type: 'employed_by', properties: { role: 'analyst', start: 2020 } },
    { from: 'carol', to: 'ohs', type: 'employed_by', properties: { role: 'director', start: 2022 } },
    { from: 'carol', to: 'acme_llc', type: 'owns', properties: { percent: 100 } },
    { from: 'ohs', to: 'metro', type: 'part_of', properties: {} },
    { from: 'ohs', to: 'contract_1', type: 'awarded', properties: {} },
    { from: 'contract_1', to: 'acme_llc', type: 'paid_to', properties: {} },
    { from: 'dave', to: 'carol', type: 'married_to', properties: {} },
    { from: 'bob', to: 'contract_1', type: 'approved', properties: { date: '2023-03-10' } }
  ];

  // Add nodes
  for (const node of nodes) {
    engine.addNode(node.id, node.type, node.properties, actor, context);
  }

  // Add edges
  for (const edge of edges) {
    engine.addEdge(edge.from, edge.to, edge.type, edge.properties, actor, context);
  }

  return { nodeCount: nodes.length, edgeCount: edges.length };
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Operators
    GraphOperator,
    Direction,
    CollectMode,
    SynthesisMode,

    // Event creation
    createEdgeEvent,
    createNodeEvent,

    // Classes
    EdgeIndex,
    TraversalState,
    TraversalPath,
    GraphTraversalEngine,

    // Pipeline evaluation
    evaluatePipeline,
    applyOperator,

    // Demo
    loadNashvilleDemo
  };
}

if (typeof window !== 'undefined') {
  window.GraphOperator = GraphOperator;
  window.Direction = Direction;
  window.CollectMode = CollectMode;
  window.SynthesisMode = SynthesisMode;
  window.createEdgeEvent = createEdgeEvent;
  window.createNodeEvent = createNodeEvent;
  window.EdgeIndex = EdgeIndex;
  window.TraversalState = TraversalState;
  window.TraversalPath = TraversalPath;
  window.GraphTraversalEngine = GraphTraversalEngine;
  window.evaluatePipeline = evaluatePipeline;
  window.applyOperator = applyOperator;
  window.loadNashvilleDemo = loadNashvilleDemo;
}
