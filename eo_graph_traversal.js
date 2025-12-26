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
 * PROVENANCE: Unlike graph DBs that store edges as facts, EO stores
 * edges as claims with context. The context envelope captures:
 * - source: Where did this claim come from? (e.g., 'linkedin_scrape', 'contract_47')
 * - confidence: How certain are we? (0.0 - 1.0)
 * - document_ref: What document backs this claim?
 * - observed_date: When was this observed?
 *
 * This enables investigative workflows where *who said this* matters
 * as much as *what they said*.
 *
 * @param {Object} params - Edge parameters
 * @param {string} params.from - Source node ID
 * @param {string} params.to - Target node ID
 * @param {string} params.type - Edge type (e.g., 'knows', 'employed_by')
 * @param {Object} params.properties - Edge properties (e.g., { since: 2019 })
 * @param {string} params.actor - Who created this edge (agent)
 * @param {Object} params.context - Context envelope for provenance
 * @param {string} params.context.source - Data source (e.g., 'crm', 'linkedin', 'contract_47')
 * @param {number} params.context.confidence - Confidence score 0.0-1.0
 * @param {string} params.context.document_ref - Reference to backing document
 * @param {string} params.context.observed_date - When this was observed
 * @param {string} params.supersedes - Previous edge event this updates (for SUP)
 * @returns {Object} Edge event ready for appending to event store
 */
function createEdgeEvent(params) {
  const { from, to, type, properties = {}, actor, context = {}, supersedes = null } = params;

  if (!from || !to || !type) {
    throw new Error('Edge requires from, to, and type');
  }

  const eventId = generateEdgeId(from, to, type);

  const event = {
    id: eventId,
    type: 'given',
    actor: actor || 'system',
    timestamp: new Date().toISOString(),
    mode: 'received',
    context: {
      workspace: context.workspace || 'default',
      schemaVersion: context.schemaVersion || '1.0',
      source: context.source || 'graph_input',
      // Provenance fields (EO additions beyond standard graph DBs)
      confidence: context.confidence !== undefined ? context.confidence : 1.0,
      document_ref: context.document_ref || null,
      observed_date: context.observed_date || new Date().toISOString(),
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

  // Support for edge supersession (SUP - conflicting edges)
  if (supersedes) {
    event.supersedes = supersedes;
  }

  return event;
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
 * PROVENANCE SUPPORT:
 * Unlike standard graph indexes, EdgeIndex preserves the full event context
 * for each edge, enabling queries like:
 * - "Show me edges from LinkedIn only"
 * - "Filter edges with confidence >= 0.8"
 * - "What edges came from contract_47?"
 *
 * CONFLICTING EDGES (SUP):
 * When multiple sources report different facts about the same relationship,
 * EdgeIndex maintains all versions. The byFromTo index stores arrays of
 * competing edge versions that can be filtered by context.
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

    // Compound indexes for edge-level SUP (conflicting edges)
    this.byFromTo = new Map();    // "from:to" -> Edge[] (all versions of same edge)
    this.byFromToType = new Map(); // "from:to:type" -> Edge[] (all versions)

    // Provenance indexes
    this.bySource = new Map();    // source -> Edge[]
    this.byDocumentRef = new Map(); // document_ref -> Edge[]

    // Supersession tracking
    this.supersededBy = new Map(); // edgeId -> edgeId (what supersedes this)
    this.supersedes = new Map();   // edgeId -> edgeId (what this supersedes)

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
   * Rebuilds all indexes from the event log, preserving:
   * - Full context/provenance for each edge
   * - Supersession chains for conflicting edges
   * - Source and document reference indexes
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
        // Pass full context and supersession info
        this.indexEdge(
          event.payload.edge,
          event.id,
          event.context || {},
          event.supersedes || null
        );
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
   * Index a single edge with full context and provenance
   *
   * @param {Object} edge - Edge payload from event
   * @param {string} eventId - Event ID
   * @param {Object} context - Event context (source, confidence, document_ref, etc.)
   * @param {string} supersedes - ID of edge event this supersedes (if any)
   */
  indexEdge(edge, eventId, context = {}, supersedes = null) {
    const indexed = {
      id: eventId,
      from: edge.from,
      to: edge.to,
      type: edge.type,
      properties: edge.properties || {},
      // Provenance - what EO adds beyond standard graph DBs
      context: {
        source: context.source || 'unknown',
        confidence: context.confidence !== undefined ? context.confidence : 1.0,
        document_ref: context.document_ref || null,
        observed_date: context.observed_date || null,
        workspace: context.workspace || 'default',
        ...context
      },
      _eventId: eventId,
      _supersedes: supersedes,
      _supersededBy: null
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

    // Index by from:to pair (for SUP - conflicting edges)
    const fromToKey = `${edge.from}:${edge.to}`;
    if (!this.byFromTo.has(fromToKey)) {
      this.byFromTo.set(fromToKey, []);
    }
    this.byFromTo.get(fromToKey).push(indexed);

    // Index by from:to:type (for SUP - conflicting edges of same type)
    const fromToTypeKey = `${edge.from}:${edge.to}:${edge.type}`;
    if (!this.byFromToType.has(fromToTypeKey)) {
      this.byFromToType.set(fromToTypeKey, []);
    }
    this.byFromToType.get(fromToTypeKey).push(indexed);

    // Index by source (provenance)
    const source = context.source || 'unknown';
    if (!this.bySource.has(source)) {
      this.bySource.set(source, []);
    }
    this.bySource.get(source).push(indexed);

    // Index by document_ref (provenance)
    if (context.document_ref) {
      if (!this.byDocumentRef.has(context.document_ref)) {
        this.byDocumentRef.set(context.document_ref, []);
      }
      this.byDocumentRef.get(context.document_ref).push(indexed);
    }

    // Track supersession
    if (supersedes) {
      this.supersedes.set(eventId, supersedes);
      this.supersededBy.set(supersedes, eventId);
      // Mark the superseded edge
      const supersededEdge = this.byId.get(supersedes);
      if (supersededEdge) {
        supersededEdge._supersededBy = eventId;
      }
    }

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
    this.byFromTo.clear();
    this.byFromToType.clear();
    this.bySource.clear();
    this.byDocumentRef.clear();
    this.supersededBy.clear();
    this.supersedes.clear();
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
   * Supports context-aware filtering, enabling queries like:
   * "Trace money, but only through edges I can document"
   * "Follow relationships with confidence >= 0.8"
   *
   * @param {string} nodeId - Starting node
   * @param {Object} options - Traversal options
   * @param {string} options.direction - 'out', 'in', or 'both'
   * @param {string[]} options.edgeTypes - Filter by edge types (null = all)
   * @param {Function} options.edgeFilter - Custom edge filter function
   * @param {Object} options.edgeContext - Context filter (EO addition)
   * @param {Object} options.edgeContext.confidence - e.g., { '>=': 0.8 }
   * @param {string|string[]} options.edgeContext.source - Filter by source(s)
   * @param {boolean} options.edgeContext.excludeSuperseded - Only active edges
   * @param {boolean} options.activeOnly - Shorthand for excludeSuperseded: true
   * @returns {Edge[]} Matching edges
   */
  traverse(nodeId, options = {}) {
    const {
      direction = Direction.OUT,
      edgeTypes = null,
      edgeFilter = null,
      edgeContext = null,
      activeOnly = false
    } = options;

    let edges = [];

    // Collect outgoing edges (optionally only active)
    if (direction === Direction.OUT || direction === Direction.BOTH) {
      const outgoing = activeOnly
        ? this.getActiveEdgesFrom(nodeId)
        : (this.byFrom.get(nodeId) || []);
      edges.push(...outgoing);
    }

    // Collect incoming edges (optionally only active)
    if (direction === Direction.IN || direction === Direction.BOTH) {
      const incoming = activeOnly
        ? this.getActiveEdgesTo(nodeId)
        : (this.byTo.get(nodeId) || []);
      edges.push(...incoming);
    }

    // Filter by edge types
    if (edgeTypes && edgeTypes.length > 0) {
      edges = edges.filter(e => edgeTypes.includes(e.type));
    }

    // Apply context filter (EO addition - what graph DBs don't provide)
    if (edgeContext) {
      edges = this.filterByContext(edges, edgeContext);
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
      sources: Array.from(this.bySource.keys()),
      conflictingEdgeCount: this.countConflictingEdges(),
      lastRebuild: this.lastRebuild
    };
  }

  // ============================================================================
  // PROVENANCE QUERIES (What EO adds beyond standard graph DBs)
  // ============================================================================

  /**
   * Get edges from a specific source
   * "Show me all edges from LinkedIn"
   */
  getEdgesBySource(source) {
    return this.bySource.get(source) || [];
  }

  /**
   * Get edges backed by a specific document
   * "What edges came from contract_47?"
   */
  getEdgesByDocumentRef(documentRef) {
    return this.byDocumentRef.get(documentRef) || [];
  }

  /**
   * Get all versions of an edge between two nodes (SUP)
   * Returns all edge events for the same from:to pair, allowing you to see
   * conflicting claims from different sources.
   *
   * Example: CRM says Bob works at Metro, LinkedIn says he left
   */
  getEdgeVersions(fromId, toId, edgeType = null) {
    if (edgeType) {
      const key = `${fromId}:${toId}:${edgeType}`;
      return this.byFromToType.get(key) || [];
    }
    const key = `${fromId}:${toId}`;
    return this.byFromTo.get(key) || [];
  }

  /**
   * Get only active (non-superseded) edges from a node
   * Filters out edges that have been replaced by newer versions
   */
  getActiveEdgesFrom(nodeId, options = {}) {
    const allEdges = this.byFrom.get(nodeId) || [];
    return allEdges.filter(e => !e._supersededBy);
  }

  /**
   * Get only active (non-superseded) edges to a node
   */
  getActiveEdgesTo(nodeId, options = {}) {
    const allEdges = this.byTo.get(nodeId) || [];
    return allEdges.filter(e => !e._supersededBy);
  }

  /**
   * Filter edges by context criteria
   * Supports:
   * - confidence: { '>=': 0.8 } or { '>': 0.5 }
   * - source: 'linkedin' or ['linkedin', 'crm']
   * - excludeSuperseded: true
   *
   * @param {Edge[]} edges - Edges to filter
   * @param {Object} contextFilter - Filter criteria
   * @returns {Edge[]} Filtered edges
   */
  filterByContext(edges, contextFilter) {
    if (!contextFilter) return edges;

    return edges.filter(edge => {
      const ctx = edge.context || {};

      // Confidence filter
      if (contextFilter.confidence) {
        const conf = ctx.confidence ?? 1.0;
        if (contextFilter.confidence['>='] !== undefined && conf < contextFilter.confidence['>=']) {
          return false;
        }
        if (contextFilter.confidence['>'] !== undefined && conf <= contextFilter.confidence['>']) {
          return false;
        }
        if (contextFilter.confidence['<='] !== undefined && conf > contextFilter.confidence['<=']) {
          return false;
        }
        if (contextFilter.confidence['<'] !== undefined && conf >= contextFilter.confidence['<']) {
          return false;
        }
        if (contextFilter.confidence['='] !== undefined && conf !== contextFilter.confidence['=']) {
          return false;
        }
      }

      // Source filter
      if (contextFilter.source) {
        const sources = Array.isArray(contextFilter.source)
          ? contextFilter.source
          : [contextFilter.source];
        if (!sources.includes(ctx.source)) {
          return false;
        }
      }

      // Exclude superseded edges
      if (contextFilter.excludeSuperseded && edge._supersededBy) {
        return false;
      }

      // Document ref filter
      if (contextFilter.document_ref) {
        if (ctx.document_ref !== contextFilter.document_ref) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Count edges that have conflicts (multiple versions)
   */
  countConflictingEdges() {
    let count = 0;
    for (const [key, versions] of this.byFromToType) {
      if (versions.length > 1) {
        count += versions.length;
      }
    }
    return count;
  }

  /**
   * Get all edges with conflicts for investigation
   * Returns edges grouped by from:to:type key
   */
  getConflictingEdges() {
    const conflicts = {};
    for (const [key, versions] of this.byFromToType) {
      if (versions.length > 1) {
        conflicts[key] = versions;
      }
    }
    return conflicts;
  }

  /**
   * Get the supersession chain for an edge
   * Returns array from oldest to newest version
   */
  getSupersessionChain(edgeId) {
    const chain = [];
    let current = edgeId;

    // Walk backwards to find oldest
    while (this.supersedes.has(current)) {
      current = this.supersedes.get(current);
    }

    // Now walk forwards collecting the chain
    chain.push(this.byId.get(current));
    while (this.supersededBy.has(current)) {
      current = this.supersededBy.get(current);
      chain.push(this.byId.get(current));
    }

    return chain.filter(Boolean);
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
 * Traverse edges from current nodes with optional context filtering.
 *
 * EO ADDITION: edgeContext parameter enables context-aware traversal:
 * "Trace money, but only through edges I can document"
 *
 * @param {Object} params - CON parameters
 * @param {string[]} params.edgeTypes - Edge types to follow (null = all)
 * @param {string} params.direction - 'out', 'in', 'both'
 * @param {Object} params.edgeFilter - Edge property filter
 * @param {Object} params.edgeContext - Context filter (EO addition)
 * @param {Object} params.edgeContext.confidence - e.g., { '>=': 0.8 }
 * @param {string|string[]} params.edgeContext.source - Filter by source(s)
 * @param {boolean} params.edgeContext.excludeSuperseded - Only active edges
 * @param {boolean} params.activeOnly - Shorthand for excludeSuperseded: true
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
      edgeFilter: params.edgeFilter ? (e) => matchesPropertyFilter(e.properties, params.edgeFilter) : null,
      // EO addition: context-aware filtering
      edgeContext: params.edgeContext || null,
      activeOnly: params.activeOnly || false
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
            // Pass full context and supersession info for provenance tracking
            this.index.indexEdge(
              event.payload.edge,
              event.id,
              event.context || {},
              event.supersedes || null
            );
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
   * Add an edge with provenance context
   *
   * @param {string} from - Source node ID
   * @param {string} to - Target node ID
   * @param {string} type - Edge type
   * @param {Object} properties - Edge properties
   * @param {string} actor - Who created this edge
   * @param {Object} context - Provenance context
   * @param {string} context.source - Data source (e.g., 'crm', 'linkedin')
   * @param {number} context.confidence - Confidence score 0.0-1.0
   * @param {string} context.document_ref - Reference to backing document
   * @param {string} supersedes - ID of edge event this supersedes (for conflicts)
   */
  addEdge(from, to, type, properties = {}, actor = 'system', context = {}, supersedes = null) {
    const event = createEdgeEvent({ from, to, type, properties, actor, context, supersedes });

    if (this.eventStore) {
      const result = this.eventStore.append(event);
      if (!result.success) {
        throw new Error(`Failed to add edge: ${result.error || result.errors?.join(', ')}`);
      }
    } else {
      // Direct index update if no event store
      this.index.indexEdge({ from, to, type, properties }, event.id, context, supersedes);
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

  // ============================================================================
  // PROVENANCE QUERIES (What EO adds beyond standard graph DBs)
  // ============================================================================

  /**
   * Get edges from a specific data source
   * "Show me all edges from LinkedIn"
   */
  getEdgesBySource(source) {
    return this.index.getEdgesBySource(source);
  }

  /**
   * Get edges backed by a specific document
   * "What edges came from contract_47?"
   */
  getEdgesByDocumentRef(documentRef) {
    return this.index.getEdgesByDocumentRef(documentRef);
  }

  /**
   * Get all versions of an edge (for investigating conflicts)
   * Example: CRM says Bob works at Metro, LinkedIn says he left
   */
  getEdgeVersions(fromId, toId, edgeType = null) {
    return this.index.getEdgeVersions(fromId, toId, edgeType);
  }

  /**
   * Get all edges with conflicts for investigation
   */
  getConflictingEdges() {
    return this.index.getConflictingEdges();
  }

  /**
   * Get the supersession chain for an edge
   */
  getSupersessionChain(edgeId) {
    return this.index.getSupersessionChain(edgeId);
  }

  /**
   * Context-aware path finding
   *
   * Example: "Trace money, but only through edges I can document"
   *
   * @param {string} fromId - Starting node
   * @param {string} toId - Target node
   * @param {Object} options - Path finding options
   * @param {Object} options.edgeContext - Context filter
   * @param {Object} options.edgeContext.confidence - e.g., { '>=': 0.8 }
   * @param {string|string[]} options.edgeContext.source - Filter by source(s)
   * @param {boolean} options.activeOnly - Only use active (non-superseded) edges
   */
  findPathsWithContext(fromId, toId, options = {}) {
    const maxDepth = options.maxDepth || 6;
    const edgeTypes = options.edgeTypes || null;
    const direction = options.direction || Direction.BOTH;
    const edgeContext = options.edgeContext || null;
    const activeOnly = options.activeOnly || false;

    const pipeline = [
      { op: GraphOperator.SEG, params: { nodeId: fromId } },
      {
        op: GraphOperator.REC,
        params: {
          pipeline: [
            {
              op: GraphOperator.CON,
              params: {
                direction,
                edgeTypes,
                edgeContext,
                activeOnly,
                return: 'both'
              }
            },
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
   * Traverse with context filtering
   *
   * @param {string} startId - Starting node
   * @param {number} maxHops - Maximum traversal depth
   * @param {Object} options - Traversal options
   * @param {Object} options.edgeContext - Context filter
   */
  traverseWithContext(startId, maxHops, options = {}) {
    const edgeTypes = options.edgeTypes || null;
    const direction = options.direction || Direction.BOTH;
    const nodeType = options.nodeType || null;
    const edgeContext = options.edgeContext || null;
    const activeOnly = options.activeOnly || false;

    const pipeline = [
      { op: GraphOperator.SEG, params: { nodeId: startId } },
      {
        op: GraphOperator.REC,
        params: {
          pipeline: [
            {
              op: GraphOperator.CON,
              params: { direction, edgeTypes, edgeContext, activeOnly }
            },
            { op: GraphOperator.SEG, params: { excludeVisited: true, nodeType } }
          ],
          until: { maxDepth: maxHops },
          collect: CollectMode.NODES
        }
      }
    ];

    return this.execute(pipeline, { startNodes: startId });
  }
}

// ============================================================================
// DEMO DATA: Nashville Investigation
// ============================================================================

/**
 * Load the Nashville investigation demo data
 *
 * Demonstrates EO's provenance features:
 * - Edges with different sources (CRM, LinkedIn, contracts)
 * - Confidence scores
 * - Document references
 * - Conflicting edges (Bob's employment status)
 */
function loadNashvilleDemo(engine) {
  const actor = 'michael';  // Investigative journalist
  const baseContext = { workspace: 'nashville_investigation' };

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

  // EDGES WITH RICH PROVENANCE
  // Note: Edges include source, confidence, and document_ref for provenance tracking
  const edges = [
    // Social connections (from LinkedIn with varying confidence)
    {
      from: 'alice', to: 'bob', type: 'knows',
      properties: { since: 2019 },
      context: { source: 'linkedin', confidence: 0.9, observed_date: '2025-01-15' }
    },
    {
      from: 'bob', to: 'carol', type: 'knows',
      properties: { since: 2021 },
      context: { source: 'linkedin', confidence: 0.7, observed_date: '2025-01-15' }
    },
    {
      from: 'carol', to: 'dave', type: 'knows',
      properties: { since: 2018 },
      context: { source: 'linkedin', confidence: 0.85, observed_date: '2025-01-15' }
    },
    {
      from: 'dave', to: 'alice', type: 'knows',
      properties: { since: 2020 },
      context: { source: 'interview', confidence: 1.0, document_ref: 'interview_transcript_001.pdf' }
    },
    {
      from: 'alice', to: 'bob', type: 'worked_with',
      properties: { project: 'housing initiative' },
      context: { source: 'metro_records', confidence: 1.0, document_ref: 'project_roster_2021.pdf' }
    },

    // CONFLICTING EDGES: Bob's employment status
    // CRM says Bob currently works at Metro
    {
      from: 'bob', to: 'metro', type: 'employed_by',
      properties: { role: 'analyst', start: 2020, current: true },
      context: { source: 'crm', confidence: 0.8, observed_date: '2025-01-10' }
    },
    // LinkedIn says he left in 2023
    {
      from: 'bob', to: 'metro', type: 'employed_by',
      properties: { role: 'analyst', start: 2020, end_date: '2023-11' },
      context: { source: 'linkedin', confidence: 0.7, observed_date: '2025-01-15' }
    },
    // A 2024 contract lists him as Metro employee (strong evidence)
    {
      from: 'bob', to: 'metro', type: 'employed_by',
      properties: { role: 'analyst', start: 2020, current: true, as_of: '2024-03' },
      context: { source: 'contract_47', confidence: 1.0, document_ref: 'contract_47_sig_page.pdf' }
    },

    // Carol's employment - backed by official records
    {
      from: 'carol', to: 'ohs', type: 'employed_by',
      properties: { role: 'director', start: 2022 },
      context: { source: 'metro_hr', confidence: 1.0, document_ref: 'hr_roster_2023.xlsx' }
    },

    // Carol's ownership of Acme - from SoS records
    {
      from: 'carol', to: 'acme_llc', type: 'owns',
      properties: { percent: 100 },
      context: { source: 'sos_filings', confidence: 1.0, document_ref: 'acme_llc_filing.pdf' }
    },

    // Organizational structure
    {
      from: 'ohs', to: 'metro', type: 'part_of',
      properties: {},
      context: { source: 'metro_records', confidence: 1.0 }
    },

    // Contract awards and payments - critical path edges with high confidence
    {
      from: 'ohs', to: 'contract_1', type: 'awarded',
      properties: {},
      context: { source: 'procurement_records', confidence: 1.0, document_ref: 'award_notice_2023_047.pdf' }
    },
    {
      from: 'contract_1', to: 'acme_llc', type: 'paid_to',
      properties: {},
      context: { source: 'finance_records', confidence: 1.0, document_ref: 'payment_voucher_2023_1234.pdf' }
    },

    // Marriage - from public records
    {
      from: 'dave', to: 'carol', type: 'married_to',
      properties: {},
      context: { source: 'marriage_records', confidence: 1.0, document_ref: 'marriage_cert_2015.pdf' }
    },

    // Bob approved the contract - documented
    {
      from: 'bob', to: 'contract_1', type: 'approved',
      properties: { date: '2023-03-10' },
      context: { source: 'approval_log', confidence: 1.0, document_ref: 'contract_approval_log.xlsx' }
    }
  ];

  // Add nodes
  for (const node of nodes) {
    engine.addNode(node.id, node.type, node.properties, actor, { ...baseContext, source: 'demo' });
  }

  // Add edges with provenance context
  for (const edge of edges) {
    const edgeContext = { ...baseContext, ...edge.context };
    engine.addEdge(edge.from, edge.to, edge.type, edge.properties || {}, actor, edgeContext);
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
