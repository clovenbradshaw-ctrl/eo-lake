/**
 * EO Pipeline Graph - Formula Dependency Tracking and Caching
 *
 * Manages the dependency graph between formula nodes with:
 * - Dependency extraction at definition time
 * - Dirty propagation when sources change
 * - Cached value management
 * - Topological ordering for evaluation
 * - Cycle detection
 *
 * This is the glue between the parser and evaluator, ensuring
 * formulas are evaluated in the correct order and cached appropriately.
 */

// ============================================================================
// Node Status
// ============================================================================

const NodeStatus = Object.freeze({
  CLEAN: 'clean',       // Cached value is valid
  DIRTY: 'dirty',       // Needs re-evaluation
  EVALUATING: 'evaluating', // Currently being evaluated
  ERROR: 'error'        // Last evaluation failed
});

// ============================================================================
// Dependency Types
// ============================================================================

const DependencyType = Object.freeze({
  FIELD: 'field',       // Same-set field reference {Field}
  SET: 'set',           // Cross-set reference #Set
  SET_FIELD: 'set_field', // Cross-set field #Set.Field
  NODE: 'node',         // Named formula node
  VOLATILE: 'volatile'  // Volatile function (NOW, TODAY, etc.)
});

// ============================================================================
// Formula Node
// ============================================================================

/**
 * Represents a formula node in the dependency graph
 */
class FormulaNode {
  constructor(id, config = {}) {
    this.id = id;
    this.name = config.name || id;
    this.formula = config.formula || '';
    this.pipeline = config.pipeline || [];
    this.dependencies = config.dependencies || [];
    this.returnType = config.returnType || 'unknown';

    // Caching
    this.status = NodeStatus.DIRTY;
    this.cachedValue = undefined;
    this.cachedAt = null;
    this.cacheTTL = config.cacheTTL || null; // null = no TTL

    // Metadata
    this.isVolatile = config.isVolatile || false; // Contains NOW(), TODAY(), etc.
    this.lastError = null;
    this.evaluationCount = 0;
    this.lastEvaluatedAt = null;
    this.avgEvaluationTime = 0;

    // Graph edges (populated by PipelineGraph)
    this.dependsOn = new Set();   // Nodes this depends on
    this.dependedBy = new Set();  // Nodes that depend on this
  }

  /**
   * Mark this node as dirty (needs re-evaluation)
   */
  markDirty() {
    if (this.status !== NodeStatus.DIRTY) {
      this.status = NodeStatus.DIRTY;
      this.cachedValue = undefined;
      return true;
    }
    return false;
  }

  /**
   * Check if cached value is still valid
   */
  isCacheValid() {
    if (this.status !== NodeStatus.CLEAN) return false;
    if (this.isVolatile) return false;
    if (this.cachedValue === undefined) return false;

    // Check TTL if set
    if (this.cacheTTL && this.cachedAt) {
      const age = Date.now() - this.cachedAt;
      if (age > this.cacheTTL) {
        this.markDirty();
        return false;
      }
    }

    return true;
  }

  /**
   * Set the cached value
   */
  setCachedValue(value, evaluationTime = 0) {
    this.cachedValue = value;
    this.cachedAt = Date.now();
    this.status = NodeStatus.CLEAN;
    this.lastEvaluatedAt = Date.now();
    this.evaluationCount++;
    this.lastError = null;

    // Update rolling average evaluation time
    const n = this.evaluationCount;
    this.avgEvaluationTime = ((n - 1) * this.avgEvaluationTime + evaluationTime) / n;
  }

  /**
   * Mark as error state
   */
  setError(error) {
    this.status = NodeStatus.ERROR;
    this.lastError = error;
    this.cachedValue = undefined;
  }

  /**
   * Get node info for debugging
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      formula: this.formula,
      status: this.status,
      cachedValue: this.cachedValue,
      dependencies: [...this.dependsOn],
      dependents: [...this.dependedBy],
      isVolatile: this.isVolatile,
      evaluationCount: this.evaluationCount,
      avgEvaluationTime: Math.round(this.avgEvaluationTime * 100) / 100
    };
  }
}

// ============================================================================
// Pipeline Graph
// ============================================================================

/**
 * Manages the dependency graph of formula nodes
 */
class PipelineGraph {
  constructor(options = {}) {
    this.nodes = new Map();       // nodeId -> FormulaNode
    this.dirty = new Set();       // Set of dirty node IDs
    this.evaluationOrder = [];    // Cached topological order

    // External resolvers (provided by caller)
    this.getSet = options.getSet || (() => null);
    this.getField = options.getField || (() => null);

    // Statistics
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      evaluations: 0,
      dirtyPropagations: 0
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Node Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Add or update a node in the graph
   */
  setNode(nodeId, config) {
    const existing = this.nodes.get(nodeId);

    // Create or update node
    const node = existing || new FormulaNode(nodeId, config);

    if (existing) {
      // Update existing node
      node.name = config.name || node.name;
      node.formula = config.formula || node.formula;
      node.pipeline = config.pipeline || node.pipeline;
      node.dependencies = config.dependencies || node.dependencies;
      node.returnType = config.returnType || node.returnType;
      node.isVolatile = config.isVolatile || node.isVolatile;
      node.cacheTTL = config.cacheTTL ?? node.cacheTTL;
    }

    this.nodes.set(nodeId, node);

    // Rebuild edges for this node
    this._rebuildEdges(nodeId);

    // Mark dirty and propagate
    this.markDirty(nodeId);

    // Invalidate topological order
    this.evaluationOrder = [];

    return node;
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  /**
   * Remove a node from the graph
   */
  removeNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Remove edges
    for (const depId of node.dependsOn) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependedBy.delete(nodeId);
      }
    }

    for (const depId of node.dependedBy) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependsOn.delete(nodeId);
        this.markDirty(depId);
      }
    }

    this.nodes.delete(nodeId);
    this.dirty.delete(nodeId);
    this.evaluationOrder = [];

    return true;
  }

  /**
   * Rebuild dependency edges for a node
   */
  _rebuildEdges(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Clear existing outgoing edges
    for (const depId of node.dependsOn) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependedBy.delete(nodeId);
      }
    }
    node.dependsOn.clear();

    // Build new edges from dependencies
    for (const dep of node.dependencies) {
      // Normalize dependency to node ID
      let depNodeId = null;

      if (typeof dep === 'string') {
        depNodeId = dep;
      } else if (dep.type === DependencyType.SET) {
        depNodeId = `#${dep.name}`;
      } else if (dep.type === DependencyType.SET_FIELD) {
        depNodeId = `#${dep.set}.${dep.field}`;
      } else if (dep.type === DependencyType.NODE) {
        depNodeId = dep.nodeId;
      } else if (dep.set) {
        depNodeId = dep.field ? `#${dep.set}.${dep.field}` : `#${dep.set}`;
      }

      if (depNodeId && this.nodes.has(depNodeId)) {
        node.dependsOn.add(depNodeId);
        this.nodes.get(depNodeId).dependedBy.add(nodeId);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Dirty Propagation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Mark a node as dirty and propagate to dependents
   */
  markDirty(nodeId, visited = new Set()) {
    // Avoid infinite loops
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = this.nodes.get(nodeId);
    if (!node) return;

    if (node.markDirty()) {
      this.dirty.add(nodeId);
      this.stats.dirtyPropagations++;

      // Propagate to dependents
      for (const dependentId of node.dependedBy) {
        this.markDirty(dependentId, visited);
      }
    }
  }

  /**
   * Mark all nodes as dirty (e.g., after data refresh)
   */
  markAllDirty() {
    for (const nodeId of this.nodes.keys()) {
      const node = this.nodes.get(nodeId);
      node.markDirty();
      this.dirty.add(nodeId);
    }
    this.stats.dirtyPropagations += this.nodes.size;
  }

  /**
   * Get all dirty nodes
   */
  getDirtyNodes() {
    return Array.from(this.dirty);
  }

  // ═══════════════════════════════════════════════════════════════
  // Topological Ordering
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get nodes in topological order (dependencies first)
   */
  getTopologicalOrder() {
    // Use cached order if available
    if (this.evaluationOrder.length === this.nodes.size) {
      return this.evaluationOrder;
    }

    const visited = new Set();
    const temp = new Set(); // For cycle detection
    const order = [];
    const cycles = [];

    const visit = (nodeId, path = []) => {
      if (visited.has(nodeId)) return true;
      if (temp.has(nodeId)) {
        // Cycle detected
        cycles.push([...path, nodeId]);
        return false;
      }

      temp.add(nodeId);
      path.push(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependsOn) {
          if (!visit(depId, [...path])) {
            // Cycle in this path
          }
        }
      }

      temp.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);
      return true;
    };

    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    this.evaluationOrder = order;

    if (cycles.length > 0) {
      console.warn('Circular dependencies detected:', cycles);
    }

    return order;
  }

  /**
   * Get nodes that need to be evaluated for a specific node
   * Returns nodes in evaluation order
   */
  getEvaluationPath(targetNodeId) {
    const needed = new Set();
    const visited = new Set();

    const collectDependencies = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) return;

      // First collect all dependencies
      for (const depId of node.dependsOn) {
        collectDependencies(depId);
      }

      // Then add this node
      needed.add(nodeId);
    };

    collectDependencies(targetNodeId);

    // Return in topological order
    const fullOrder = this.getTopologicalOrder();
    return fullOrder.filter(id => needed.has(id));
  }

  // ═══════════════════════════════════════════════════════════════
  // Cycle Detection
  // ═══════════════════════════════════════════════════════════════

  /**
   * Check if adding a dependency would create a cycle
   */
  wouldCreateCycle(fromNodeId, toNodeId) {
    // Check if toNodeId depends on fromNodeId (directly or indirectly)
    const visited = new Set();

    const search = (nodeId) => {
      if (nodeId === fromNodeId) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) return false;

      for (const depId of node.dependsOn) {
        if (search(depId)) return true;
      }

      return false;
    };

    return search(toNodeId);
  }

  /**
   * Find all cycles in the graph
   */
  findCycles() {
    const cycles = [];
    const visited = new Set();
    const recStack = new Set();

    const dfs = (nodeId, path) => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependsOn) {
          if (!visited.has(depId)) {
            const result = dfs(depId, [...path, nodeId]);
            if (result) return result;
          } else if (recStack.has(depId)) {
            // Found cycle
            const cycleStart = path.indexOf(depId);
            if (cycleStart !== -1) {
              cycles.push(path.slice(cycleStart).concat(nodeId, depId));
            } else {
              cycles.push([...path, nodeId, depId]);
            }
          }
        }
      }

      recStack.delete(nodeId);
      return null;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  // ═══════════════════════════════════════════════════════════════
  // Cache Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get cached value for a node
   * @returns {{ value: any, hit: boolean }}
   */
  getCached(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return { value: undefined, hit: false };
    }

    if (node.isCacheValid()) {
      this.stats.cacheHits++;
      return { value: node.cachedValue, hit: true };
    }

    this.stats.cacheMisses++;
    return { value: undefined, hit: false };
  }

  /**
   * Set cached value for a node
   */
  setCached(nodeId, value, evaluationTime = 0) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.setCachedValue(value, evaluationTime);
      this.dirty.delete(nodeId);
      this.stats.evaluations++;
    }
  }

  /**
   * Clear all cached values
   */
  clearCache() {
    for (const node of this.nodes.values()) {
      node.markDirty();
    }
    this.dirty = new Set(this.nodes.keys());
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
  }

  /**
   * Clear cache for volatile nodes only (NOW, TODAY, etc.)
   */
  clearVolatileCache() {
    for (const [nodeId, node] of this.nodes.entries()) {
      if (node.isVolatile) {
        node.markDirty();
        this.dirty.add(nodeId);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Analysis
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get dependency tree for a node (for visualization)
   */
  getDependencyTree(nodeId, depth = 0, maxDepth = 10, visited = new Set()) {
    if (depth > maxDepth || visited.has(nodeId)) {
      return { id: nodeId, circular: visited.has(nodeId), truncated: depth > maxDepth };
    }

    visited.add(nodeId);

    const node = this.nodes.get(nodeId);
    if (!node) {
      return { id: nodeId, missing: true };
    }

    const children = [];
    for (const depId of node.dependsOn) {
      children.push(this.getDependencyTree(depId, depth + 1, maxDepth, new Set(visited)));
    }

    return {
      id: nodeId,
      name: node.name,
      status: node.status,
      hasCachedValue: node.cachedValue !== undefined,
      isVolatile: node.isVolatile,
      children: children.length > 0 ? children : undefined
    };
  }

  /**
   * Get impact analysis - what would be affected if this node changes
   */
  getImpactAnalysis(nodeId) {
    const affected = new Set();
    const visited = new Set();

    const propagate = (id) => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = this.nodes.get(id);
      if (!node) return;

      for (const dependentId of node.dependedBy) {
        affected.add(dependentId);
        propagate(dependentId);
      }
    };

    propagate(nodeId);

    return {
      sourceNode: nodeId,
      affectedNodes: Array.from(affected),
      affectedCount: affected.size,
      impactTree: this._buildImpactTree(nodeId)
    };
  }

  /**
   * Build impact tree for visualization
   */
  _buildImpactTree(nodeId, depth = 0, maxDepth = 5, visited = new Set()) {
    if (depth > maxDepth || visited.has(nodeId)) {
      return { id: nodeId, truncated: true };
    }

    visited.add(nodeId);

    const node = this.nodes.get(nodeId);
    if (!node) {
      return { id: nodeId, missing: true };
    }

    const children = [];
    for (const depId of node.dependedBy) {
      children.push(this._buildImpactTree(depId, depth + 1, maxDepth, new Set(visited)));
    }

    return {
      id: nodeId,
      name: node.name,
      children: children.length > 0 ? children : undefined
    };
  }

  /**
   * Get graph statistics
   */
  getStats() {
    let totalNodes = this.nodes.size;
    let cleanNodes = 0;
    let dirtyNodes = 0;
    let errorNodes = 0;
    let volatileNodes = 0;
    let totalDependencies = 0;
    let maxDependencies = 0;
    let maxDependents = 0;

    for (const node of this.nodes.values()) {
      switch (node.status) {
        case NodeStatus.CLEAN: cleanNodes++; break;
        case NodeStatus.DIRTY: dirtyNodes++; break;
        case NodeStatus.ERROR: errorNodes++; break;
      }

      if (node.isVolatile) volatileNodes++;

      const depCount = node.dependsOn.size;
      const depByCount = node.dependedBy.size;
      totalDependencies += depCount;
      maxDependencies = Math.max(maxDependencies, depCount);
      maxDependents = Math.max(maxDependents, depByCount);
    }

    return {
      totalNodes,
      cleanNodes,
      dirtyNodes,
      errorNodes,
      volatileNodes,
      totalDependencies,
      avgDependencies: totalNodes > 0 ? totalDependencies / totalNodes : 0,
      maxDependencies,
      maxDependents,
      cacheHitRate: this.stats.cacheHits + this.stats.cacheMisses > 0
        ? this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)
        : 0,
      ...this.stats
    };
  }

  /**
   * Export graph for visualization
   */
  toVisualizationData() {
    const nodes = [];
    const edges = [];

    for (const [nodeId, node] of this.nodes.entries()) {
      nodes.push({
        id: nodeId,
        label: node.name,
        status: node.status,
        isVolatile: node.isVolatile,
        hasCachedValue: node.cachedValue !== undefined,
        dependencyCount: node.dependsOn.size,
        dependentCount: node.dependedBy.size
      });

      for (const depId of node.dependsOn) {
        edges.push({
          source: nodeId,
          target: depId,
          type: 'depends_on'
        });
      }
    }

    return { nodes, edges };
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof window !== 'undefined') {
  window.PipelineGraph = PipelineGraph;
  window.FormulaNode = FormulaNode;
  window.NodeStatus = NodeStatus;
  window.DependencyType = DependencyType;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PipelineGraph,
    FormulaNode,
    NodeStatus,
    DependencyType
  };
}
