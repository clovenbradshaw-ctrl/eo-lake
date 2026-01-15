/**
 * EO Temporal Pipeline - Visual Pipeline Editor with Time-Travel
 *
 * Combines TouchDesigner's "cooking" model with Noema's immutable event log
 * to create a visual pipeline editor that can scrub through time.
 *
 * Core Concepts:
 * - Pipeline Canvas: Visual drag-and-drop node editor
 * - Cooking: Re-evaluation when inputs change or timestamp changes
 * - Temporal Scrubbing: Timeline that sets AS_OF timestamp via Horizon
 * - Live Previews: Each node shows intermediate results
 *
 * Integrates with:
 * - EOFormulaEngine: Uses existing operators (CON, SEG, SYN, ALT, DES, NUL)
 * - PipelineGraph: Reuses dependency tracking and dirty propagation
 * - Horizon: Uses timeRange for AS_OF queries
 * - EventStore: Queries events at specific timestamps
 */

// ============================================================================
// Pipeline Node Types
// ============================================================================

const TemporalNodeType = Object.freeze({
  SOURCE: 'source',       // Starting point - Set, Lens, or Focus
  CON: 'con',             // Connect/join to related set
  SEG: 'seg',             // Segment/filter records
  SYN: 'syn',             // Synthesize/aggregate values
  ALT: 'alt',             // Alter/transform values
  DES: 'des',             // Designate/project field
  NUL: 'nul'              // Null handler/default
});

const TemporalNodeLabels = {
  [TemporalNodeType.SOURCE]: 'Source',
  [TemporalNodeType.CON]: 'Connect',
  [TemporalNodeType.SEG]: 'Segment',
  [TemporalNodeType.SYN]: 'Synthesize',
  [TemporalNodeType.ALT]: 'Alter',
  [TemporalNodeType.DES]: 'Designate',
  [TemporalNodeType.NUL]: 'Null Handler'
};

const TemporalNodeIcons = {
  [TemporalNodeType.SOURCE]: 'ph-database',
  [TemporalNodeType.CON]: 'ph-link',
  [TemporalNodeType.SEG]: 'ph-funnel',
  [TemporalNodeType.SYN]: 'ph-sigma',
  [TemporalNodeType.ALT]: 'ph-magic-wand',
  [TemporalNodeType.DES]: 'ph-cursor-click',
  [TemporalNodeType.NUL]: 'ph-prohibit'
};

const TemporalNodeColors = {
  [TemporalNodeType.SOURCE]: '#6366f1',  // Indigo
  [TemporalNodeType.CON]: '#8b5cf6',     // Violet
  [TemporalNodeType.SEG]: '#ec4899',     // Pink
  [TemporalNodeType.SYN]: '#f59e0b',     // Amber
  [TemporalNodeType.ALT]: '#10b981',     // Emerald
  [TemporalNodeType.DES]: '#3b82f6',     // Blue
  [TemporalNodeType.NUL]: '#6b7280'      // Gray
};

// ============================================================================
// Cook Status
// ============================================================================

const CookStatus = Object.freeze({
  CLEAN: 'clean',         // Cached value is valid
  DIRTY: 'dirty',         // Needs re-evaluation
  COOKING: 'cooking',     // Currently evaluating
  ERROR: 'error'          // Last evaluation failed
});

// ============================================================================
// Pipeline Node
// ============================================================================

/**
 * Represents a node in the visual pipeline
 */
class TemporalPipelineNode {
  constructor(config = {}) {
    this.id = config.id || `node_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    this.type = config.type || TemporalNodeType.SOURCE;
    this.label = config.label || TemporalNodeLabels[this.type];
    this.config = config.config || {};

    // Position on canvas
    this.x = config.x || 0;
    this.y = config.y || 0;

    // Connections
    this.inputs = [];   // Array of wire IDs
    this.outputs = [];  // Array of wire IDs

    // Cooking state
    this.status = CookStatus.DIRTY;
    this.cachedValue = null;
    this.cachedAt = null;
    this.lastError = null;

    // Preview data
    this.preview = {
      recordCount: null,
      sampleValues: [],
      summaryText: ''
    };
  }

  /**
   * Mark this node as dirty (needs re-evaluation)
   */
  markDirty() {
    if (this.status !== CookStatus.DIRTY) {
      this.status = CookStatus.DIRTY;
      this.cachedValue = null;
      this.cachedAt = null;
      return true;
    }
    return false;
  }

  /**
   * Set cooked result
   */
  setCookedValue(value) {
    this.cachedValue = value;
    this.cachedAt = Date.now();
    this.status = CookStatus.CLEAN;
    this.lastError = null;
    this._updatePreview(value);
  }

  /**
   * Set error state
   */
  setError(error) {
    this.status = CookStatus.ERROR;
    this.lastError = error;
    this.cachedValue = null;
    this.preview = {
      recordCount: null,
      sampleValues: [],
      summaryText: `Error: ${error}`
    };
  }

  /**
   * Update preview based on cooked value
   */
  _updatePreview(value) {
    if (Array.isArray(value)) {
      this.preview = {
        recordCount: value.length,
        sampleValues: value.slice(0, 3).map(v => {
          if (v && typeof v === 'object') {
            return v.values ? Object.values(v.values)[0] : Object.values(v)[0];
          }
          return v;
        }),
        summaryText: `${value.length} records`
      };
    } else if (value !== null && value !== undefined) {
      this.preview = {
        recordCount: 1,
        sampleValues: [value],
        summaryText: String(value).slice(0, 50)
      };
    } else {
      this.preview = {
        recordCount: 0,
        sampleValues: [],
        summaryText: 'No data'
      };
    }
  }

  /**
   * Get node info for serialization
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      label: this.label,
      config: this.config,
      x: this.x,
      y: this.y
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json) {
    return new TemporalPipelineNode(json);
  }
}

// ============================================================================
// Pipeline Wire
// ============================================================================

/**
 * Represents a connection between nodes
 */
class PipelineWire {
  constructor(config = {}) {
    this.id = config.id || `wire_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    this.sourceId = config.sourceId;
    this.targetId = config.targetId;
    this.sourcePort = config.sourcePort || 'out';
    this.targetPort = config.targetPort || 'in';
  }

  toJSON() {
    return {
      id: this.id,
      sourceId: this.sourceId,
      targetId: this.targetId,
      sourcePort: this.sourcePort,
      targetPort: this.targetPort
    };
  }

  static fromJSON(json) {
    return new PipelineWire(json);
  }
}

// ============================================================================
// Keyframe
// ============================================================================

/**
 * Represents a significant moment in time (import, schema change, etc.)
 */
class Keyframe {
  constructor(config = {}) {
    this.timestamp = config.timestamp;
    this.type = config.type || 'event';  // 'import', 'schema', 'bookmark'
    this.label = config.label || '';
    this.eventId = config.eventId || null;
  }
}

// ============================================================================
// Temporal Pipeline
// ============================================================================

/**
 * Main Temporal Pipeline class - manages nodes, wires, and cooking
 */
class TemporalPipeline {
  constructor(options = {}) {
    this.id = options.id || `pipeline_${Date.now().toString(36)}`;
    this.name = options.name || 'Untitled Pipeline';

    // Nodes and wires
    this.nodes = new Map();
    this.wires = new Map();

    // Current timestamp for temporal queries
    this.currentTimestamp = options.timestamp || Date.now();

    // Keyframes (significant moments)
    this.keyframes = [];

    // External dependencies
    this.eventStore = options.eventStore || null;
    this.formulaEngine = options.formulaEngine || null;
    this.workbench = options.workbench || null;

    // Callbacks
    this.onCook = options.onCook || null;
    this.onTimestampChange = options.onTimestampChange || null;

    // Timeline bounds
    this.timelineStart = options.timelineStart || null;
    this.timelineEnd = options.timelineEnd || Date.now();

    // Cooking state
    this._cookingInProgress = false;
    this._cookQueue = [];
  }

  // ═══════════════════════════════════════════════════════════════
  // Node Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Add a node to the pipeline
   */
  addNode(type, config = {}) {
    const node = new TemporalPipelineNode({
      type,
      ...config
    });
    this.nodes.set(node.id, node);
    return node;
  }

  /**
   * Remove a node and its connected wires
   */
  removeNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Remove connected wires
    for (const wireId of [...node.inputs, ...node.outputs]) {
      this.removeWire(wireId);
    }

    this.nodes.delete(nodeId);
    return true;
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  /**
   * Update node position
   */
  moveNode(nodeId, x, y) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.x = x;
      node.y = y;
    }
  }

  /**
   * Update node configuration
   */
  configureNode(nodeId, config) {
    const node = this.nodes.get(nodeId);
    if (node) {
      Object.assign(node.config, config);
      node.markDirty();
      this._propagateDirty(nodeId);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Wire Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Connect two nodes with a wire
   */
  connect(sourceId, targetId, ports = {}) {
    const source = this.nodes.get(sourceId);
    const target = this.nodes.get(targetId);

    if (!source || !target) return null;

    // Check for cycles
    if (this._wouldCreateCycle(sourceId, targetId)) {
      console.warn('Connection would create cycle');
      return null;
    }

    const wire = new PipelineWire({
      sourceId,
      targetId,
      sourcePort: ports.sourcePort || 'out',
      targetPort: ports.targetPort || 'in'
    });

    this.wires.set(wire.id, wire);
    source.outputs.push(wire.id);
    target.inputs.push(wire.id);

    // Mark target as dirty
    target.markDirty();
    this._propagateDirty(targetId);

    return wire;
  }

  /**
   * Remove a wire
   */
  removeWire(wireId) {
    const wire = this.wires.get(wireId);
    if (!wire) return false;

    const source = this.nodes.get(wire.sourceId);
    const target = this.nodes.get(wire.targetId);

    if (source) {
      source.outputs = source.outputs.filter(id => id !== wireId);
    }
    if (target) {
      target.inputs = target.inputs.filter(id => id !== wireId);
      target.markDirty();
      this._propagateDirty(wire.targetId);
    }

    this.wires.delete(wireId);
    return true;
  }

  /**
   * Check if connecting source to target would create a cycle
   */
  _wouldCreateCycle(sourceId, targetId) {
    const visited = new Set();

    const hasPath = (from, to) => {
      if (from === to) return true;
      if (visited.has(from)) return false;
      visited.add(from);

      const node = this.nodes.get(from);
      if (!node) return false;

      for (const wireId of node.outputs) {
        const wire = this.wires.get(wireId);
        if (wire && hasPath(wire.targetId, to)) {
          return true;
        }
      }
      return false;
    };

    return hasPath(targetId, sourceId);
  }

  // ═══════════════════════════════════════════════════════════════
  // Dirty Propagation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Propagate dirty state to downstream nodes
   */
  _propagateDirty(nodeId, visited = new Set()) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = this.nodes.get(nodeId);
    if (!node) return;

    for (const wireId of node.outputs) {
      const wire = this.wires.get(wireId);
      if (wire) {
        const target = this.nodes.get(wire.targetId);
        if (target && target.markDirty()) {
          this._propagateDirty(wire.targetId, visited);
        }
      }
    }
  }

  /**
   * Mark all nodes as dirty (e.g., when timestamp changes)
   */
  markAllDirty() {
    for (const node of this.nodes.values()) {
      node.markDirty();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Temporal Control
  // ═══════════════════════════════════════════════════════════════

  /**
   * Set the current timestamp and re-cook
   */
  setTimestamp(timestamp) {
    if (this.currentTimestamp === timestamp) return;

    this.currentTimestamp = timestamp;
    this.markAllDirty();

    if (this.onTimestampChange) {
      this.onTimestampChange(timestamp);
    }

    // Debounce cooking for smooth scrubbing
    this._debouncedCook();
  }

  /**
   * Debounced cooking for scrubbing
   */
  _debouncedCook() {
    if (this._cookDebounceTimer) {
      clearTimeout(this._cookDebounceTimer);
    }
    this._cookDebounceTimer = setTimeout(() => {
      this.cookAll();
    }, 16); // ~60fps
  }

  /**
   * Get a Horizon configured with the current timestamp
   */
  getTemporalHorizon(baseHorizon = null) {
    const timeRange = {
      start: null,
      end: new Date(this.currentTimestamp).toISOString()
    };

    if (baseHorizon && typeof Horizon !== 'undefined') {
      return baseHorizon.refine({ timeRange });
    }

    // Return plain object if Horizon class not available
    return {
      timeRange,
      asOf: this.currentTimestamp
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Cooking (Evaluation)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Cook all dirty nodes in topological order
   */
  async cookAll() {
    if (this._cookingInProgress) {
      this._cookQueue.push('all');
      return;
    }

    this._cookingInProgress = true;

    try {
      const order = this._getTopologicalOrder();

      for (const nodeId of order) {
        const node = this.nodes.get(nodeId);
        if (node && node.status === CookStatus.DIRTY) {
          await this._cookNode(node);
        }
      }

      if (this.onCook) {
        this.onCook(this);
      }
    } finally {
      this._cookingInProgress = false;

      // Process queued cooks
      if (this._cookQueue.length > 0) {
        this._cookQueue = [];
        this.cookAll();
      }
    }
  }

  /**
   * Cook a single node
   */
  async _cookNode(node) {
    node.status = CookStatus.COOKING;

    try {
      // Get input values from connected nodes
      const inputValues = this._getInputValues(node);

      // Evaluate based on node type
      let result;
      switch (node.type) {
        case TemporalNodeType.SOURCE:
          result = await this._cookSource(node);
          break;
        case TemporalNodeType.CON:
          result = await this._cookCON(node, inputValues);
          break;
        case TemporalNodeType.SEG:
          result = await this._cookSEG(node, inputValues);
          break;
        case TemporalNodeType.SYN:
          result = await this._cookSYN(node, inputValues);
          break;
        case TemporalNodeType.ALT:
          result = await this._cookALT(node, inputValues);
          break;
        case TemporalNodeType.DES:
          result = await this._cookDES(node, inputValues);
          break;
        case TemporalNodeType.NUL:
          result = await this._cookNUL(node, inputValues);
          break;
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      node.setCookedValue(result);
    } catch (error) {
      node.setError(error.message);
    }
  }

  /**
   * Get input values for a node from its connected upstream nodes
   */
  _getInputValues(node) {
    const values = [];

    for (const wireId of node.inputs) {
      const wire = this.wires.get(wireId);
      if (wire) {
        const source = this.nodes.get(wire.sourceId);
        if (source && source.cachedValue !== null) {
          values.push(source.cachedValue);
        }
      }
    }

    return values.length === 1 ? values[0] : (values.length > 0 ? values : null);
  }

  /**
   * Get topological order of nodes (dependencies first)
   */
  _getTopologicalOrder() {
    const visited = new Set();
    const order = [];

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) return;

      // Visit dependencies first
      for (const wireId of node.inputs) {
        const wire = this.wires.get(wireId);
        if (wire) {
          visit(wire.sourceId);
        }
      }

      order.push(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    return order;
  }

  // ═══════════════════════════════════════════════════════════════
  // Node-Type Specific Cooking
  // ═══════════════════════════════════════════════════════════════

  /**
   * Cook a SOURCE node
   */
  async _cookSource(node) {
    const { setId, lensId } = node.config;

    if (!this.workbench) {
      throw new Error('No workbench connected');
    }

    // Get set data
    const set = this.workbench.sets?.find(s => s.id === setId);
    if (!set) {
      throw new Error(`Set not found: ${setId}`);
    }

    // If temporal query supported, filter by timestamp
    let records = set.records || [];

    if (this.eventStore) {
      // Query events at the current timestamp
      const horizon = this.getTemporalHorizon();
      records = this._filterRecordsByTimestamp(records, set, horizon);
    }

    return records;
  }

  /**
   * Filter records by timestamp using event store
   */
  _filterRecordsByTimestamp(records, set, horizon) {
    if (!this.eventStore || !horizon.asOf) {
      return records;
    }

    // Filter to records that existed at the timestamp
    const asOf = horizon.asOf;
    return records.filter(record => {
      // Check if record existed at the timestamp
      const createdAt = record.createdAt || record._pipeline?.createdAt;
      if (createdAt && new Date(createdAt).getTime() > asOf) {
        return false; // Record didn't exist yet
      }
      return true;
    });
  }

  /**
   * Cook a CON (Connect) node
   */
  async _cookCON(node, input) {
    const { targetSetId, joinField } = node.config;

    if (!this.workbench || !targetSetId) {
      return input;
    }

    const targetSet = this.workbench.sets?.find(s => s.id === targetSetId);
    if (!targetSet) {
      throw new Error(`Target set not found: ${targetSetId}`);
    }

    const targetRecords = targetSet.records || [];

    // If input is array, join each record
    if (Array.isArray(input)) {
      return input.map(record => {
        const values = record.values || record;
        const joinValue = values[joinField];

        // Find matching target records
        const matches = targetRecords.filter(tr => {
          const tv = tr.values || tr;
          return tv[joinField] === joinValue;
        });

        return {
          ...record,
          _joined: matches
        };
      });
    }

    return input;
  }

  /**
   * Cook a SEG (Segment) node
   */
  async _cookSEG(node, input) {
    const { field, operator, value } = node.config;

    if (!Array.isArray(input)) {
      return input;
    }

    return input.filter(record => {
      const values = record.values || record;
      const fieldValue = values[field];

      switch (operator) {
        case 'eq': return fieldValue == value;
        case 'ne': return fieldValue != value;
        case 'gt': return Number(fieldValue) > Number(value);
        case 'lt': return Number(fieldValue) < Number(value);
        case 'gte': return Number(fieldValue) >= Number(value);
        case 'lte': return Number(fieldValue) <= Number(value);
        case 'contains': return String(fieldValue || '').includes(value);
        case 'isEmpty': return fieldValue == null || fieldValue === '';
        case 'isNotEmpty': return fieldValue != null && fieldValue !== '';
        default: return true;
      }
    });
  }

  /**
   * Cook a SYN (Synthesize) node
   */
  async _cookSYN(node, input) {
    const { mode, field } = node.config;
    const values = Array.isArray(input) ? input : [input];

    // Extract field values if specified
    let nums = values;
    if (field) {
      nums = values.map(v => {
        const vals = v?.values || v;
        return vals?.[field] ?? v;
      });
    }

    const numericValues = nums.map(v => Number(v)).filter(n => !isNaN(n));

    switch (mode) {
      case 'SUM':
        return numericValues.reduce((a, b) => a + b, 0);
      case 'COUNT':
        return values.length;
      case 'AVG':
        return numericValues.length > 0
          ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
          : 0;
      case 'MIN':
        return numericValues.length > 0 ? Math.min(...numericValues) : null;
      case 'MAX':
        return numericValues.length > 0 ? Math.max(...numericValues) : null;
      case 'FIRST':
        return values[0] ?? null;
      case 'LAST':
        return values[values.length - 1] ?? null;
      case 'CONCAT':
        return nums.filter(v => v != null).join(node.config.separator || ', ');
      case 'COLLECT':
        return nums;
      default:
        return values;
    }
  }

  /**
   * Cook an ALT (Alter) node
   */
  async _cookALT(node, input) {
    const { operation, value, expression } = node.config;

    // Simple arithmetic operations
    if (operation === 'multiply') {
      return Number(input) * Number(value);
    }
    if (operation === 'divide') {
      if (Number(value) === 0) throw new Error('Division by zero');
      return Number(input) / Number(value);
    }
    if (operation === 'add') {
      return Number(input) + Number(value);
    }
    if (operation === 'subtract') {
      return Number(input) - Number(value);
    }

    // Array mapping
    if (operation === 'map' && Array.isArray(input)) {
      return input.map(item => {
        // Simple expression evaluation ($ = current value)
        if (expression) {
          const val = item?.values ? Object.values(item.values)[0] : item;
          const expr = expression.replace(/\$/g, String(val));
          try {
            return Function('"use strict"; return (' + expr + ')')();
          } catch {
            return val;
          }
        }
        return item;
      });
    }

    return input;
  }

  /**
   * Cook a DES (Designate) node
   */
  async _cookDES(node, input) {
    const { property } = node.config;

    if (!property) return input;

    if (Array.isArray(input)) {
      return input.map(item => {
        const values = item?.values || item;
        return values?.[property] ?? null;
      });
    }

    if (input && typeof input === 'object') {
      const values = input.values || input;
      return values[property] ?? null;
    }

    return input;
  }

  /**
   * Cook a NUL (Null Handler) node
   */
  async _cookNUL(node, input) {
    const { defaultValue } = node.config;

    if (input == null || input === '' || (Array.isArray(input) && input.length === 0)) {
      return defaultValue ?? null;
    }

    return input;
  }

  // ═══════════════════════════════════════════════════════════════
  // Keyframe Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Detect keyframes from event store
   */
  async detectKeyframes() {
    if (!this.eventStore) return;

    this.keyframes = [];

    // Get all events
    const events = this.eventStore._log || [];

    // Find significant events
    for (const event of events) {
      // Import events
      if (event.category === 'source' && event.operation === 'import') {
        this.keyframes.push(new Keyframe({
          timestamp: new Date(event.timestamp).getTime(),
          type: 'import',
          label: `Import: ${event.payload?.name || 'data'}`,
          eventId: event.id
        }));
      }

      // Schema changes
      if (event.category === 'set' && (event.operation === 'field_add' || event.operation === 'field_update')) {
        this.keyframes.push(new Keyframe({
          timestamp: new Date(event.timestamp).getTime(),
          type: 'schema',
          label: `Schema: ${event.payload?.fieldName || 'field change'}`,
          eventId: event.id
        }));
      }
    }

    // Sort by timestamp
    this.keyframes.sort((a, b) => a.timestamp - b.timestamp);

    // Update timeline bounds
    if (this.keyframes.length > 0) {
      this.timelineStart = this.keyframes[0].timestamp;
    }
  }

  /**
   * Add a user bookmark keyframe
   */
  addBookmark(label) {
    const keyframe = new Keyframe({
      timestamp: this.currentTimestamp,
      type: 'bookmark',
      label
    });
    this.keyframes.push(keyframe);
    this.keyframes.sort((a, b) => a.timestamp - b.timestamp);
    return keyframe;
  }

  /**
   * Jump to a keyframe
   */
  jumpToKeyframe(keyframe) {
    this.setTimestamp(keyframe.timestamp);
  }

  // ═══════════════════════════════════════════════════════════════
  // Formula Conversion
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate text formula from visual pipeline
   */
  toFormula() {
    const order = this._getTopologicalOrder();
    const parts = [];

    for (const nodeId of order) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      switch (node.type) {
        case TemporalNodeType.SOURCE:
          parts.push(`{${node.config.setName || node.config.setId}}`);
          break;
        case TemporalNodeType.CON:
          parts.push(`CON(${node.config.targetSetName || node.config.targetSetId})`);
          break;
        case TemporalNodeType.SEG:
          parts.push(`SEG(${node.config.field} ${node.config.operator} "${node.config.value}")`);
          break;
        case TemporalNodeType.SYN:
          parts.push(`SYN(${node.config.mode}${node.config.field ? ' ' + node.config.field : ''})`);
          break;
        case TemporalNodeType.ALT:
          parts.push(`ALT(${node.config.operation} ${node.config.value || node.config.expression})`);
          break;
        case TemporalNodeType.DES:
          parts.push(`DES(${node.config.property})`);
          break;
        case TemporalNodeType.NUL:
          parts.push(`NUL(${node.config.defaultValue})`);
          break;
      }
    }

    return parts.join(' → ');
  }

  /**
   * Create pipeline from text formula
   */
  static fromFormula(formula, parser) {
    if (!parser) {
      console.warn('No formula parser provided');
      return null;
    }

    const parsed = parser.parse(formula);
    if (parsed.error) {
      console.error('Formula parse error:', parsed.error);
      return null;
    }

    const pipeline = new TemporalPipeline();
    let lastNode = null;
    let x = 100;
    const y = 200;
    const spacing = 200;

    for (const step of parsed.pipeline) {
      let nodeType;
      let config = {};

      switch (step.operator) {
        case 'CON':
          nodeType = TemporalNodeType.CON;
          config = { targetSetId: step.source };
          break;
        case 'SEG':
          nodeType = TemporalNodeType.SEG;
          config = step.condition || {};
          break;
        case 'SYN':
          nodeType = TemporalNodeType.SYN;
          config = { mode: step.mode, field: step.property };
          break;
        case 'ALT':
          nodeType = TemporalNodeType.ALT;
          config = { operation: step.mode, value: step.value };
          break;
        case 'DES':
          nodeType = TemporalNodeType.DES;
          config = { property: step.property };
          break;
        case 'NUL':
          nodeType = TemporalNodeType.NUL;
          config = { defaultValue: step.default };
          break;
        default:
          continue;
      }

      const node = pipeline.addNode(nodeType, { config, x, y });
      x += spacing;

      if (lastNode) {
        pipeline.connect(lastNode.id, node.id);
      }

      lastNode = node;
    }

    return pipeline;
  }

  // ═══════════════════════════════════════════════════════════════
  // Serialization
  // ═══════════════════════════════════════════════════════════════

  /**
   * Serialize pipeline to JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      currentTimestamp: this.currentTimestamp,
      timelineStart: this.timelineStart,
      timelineEnd: this.timelineEnd,
      nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
      wires: Array.from(this.wires.values()).map(w => w.toJSON()),
      keyframes: this.keyframes.map(k => ({
        timestamp: k.timestamp,
        type: k.type,
        label: k.label,
        eventId: k.eventId
      }))
    };
  }

  /**
   * Create pipeline from JSON
   */
  static fromJSON(json, options = {}) {
    const pipeline = new TemporalPipeline({
      id: json.id,
      name: json.name,
      timestamp: json.currentTimestamp,
      timelineStart: json.timelineStart,
      timelineEnd: json.timelineEnd,
      ...options
    });

    // Restore nodes
    for (const nodeJson of json.nodes || []) {
      const node = TemporalPipelineNode.fromJSON(nodeJson);
      pipeline.nodes.set(node.id, node);
    }

    // Restore wires
    for (const wireJson of json.wires || []) {
      const wire = PipelineWire.fromJSON(wireJson);
      pipeline.wires.set(wire.id, wire);

      // Update node connections
      const source = pipeline.nodes.get(wire.sourceId);
      const target = pipeline.nodes.get(wire.targetId);
      if (source) source.outputs.push(wire.id);
      if (target) target.inputs.push(wire.id);
    }

    // Restore keyframes
    pipeline.keyframes = (json.keyframes || []).map(k => new Keyframe(k));

    return pipeline;
  }
}

// ============================================================================
// Timeline Scrubber Controller
// ============================================================================

/**
 * Controller for the timeline scrubber UI
 */
class TimelineScrubber {
  constructor(pipeline, options = {}) {
    this.pipeline = pipeline;
    this.isPlaying = false;
    this.playbackSpeed = options.playbackSpeed || 1;
    this._playbackInterval = null;

    // UI callbacks
    this.onScrub = options.onScrub || null;
    this.onPlayStateChange = options.onPlayStateChange || null;
  }

  /**
   * Scrub to a specific position (0-1)
   */
  scrubTo(position) {
    const { timelineStart, timelineEnd } = this.pipeline;
    const start = timelineStart || (timelineEnd - 365 * 24 * 60 * 60 * 1000); // Default 1 year
    const range = timelineEnd - start;
    const timestamp = start + (range * Math.max(0, Math.min(1, position)));

    this.pipeline.setTimestamp(timestamp);

    if (this.onScrub) {
      this.onScrub(timestamp, position);
    }
  }

  /**
   * Get current position (0-1)
   */
  getPosition() {
    const { timelineStart, timelineEnd, currentTimestamp } = this.pipeline;
    const start = timelineStart || (timelineEnd - 365 * 24 * 60 * 60 * 1000);
    const range = timelineEnd - start;

    if (range === 0) return 1;
    return (currentTimestamp - start) / range;
  }

  /**
   * Start playback
   */
  play() {
    if (this.isPlaying) return;

    this.isPlaying = true;
    const step = 1000 / 60; // ~60fps
    const timeStep = step * this.playbackSpeed * 1000; // 1 second per frame at 1x

    this._playbackInterval = setInterval(() => {
      const newTimestamp = this.pipeline.currentTimestamp + timeStep;

      if (newTimestamp >= this.pipeline.timelineEnd) {
        this.pause();
        return;
      }

      this.pipeline.setTimestamp(newTimestamp);

      if (this.onScrub) {
        this.onScrub(newTimestamp, this.getPosition());
      }
    }, step);

    if (this.onPlayStateChange) {
      this.onPlayStateChange(true);
    }
  }

  /**
   * Pause playback
   */
  pause() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    if (this._playbackInterval) {
      clearInterval(this._playbackInterval);
      this._playbackInterval = null;
    }

    if (this.onPlayStateChange) {
      this.onPlayStateChange(false);
    }
  }

  /**
   * Toggle play/pause
   */
  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Set playback speed
   */
  setSpeed(speed) {
    this.playbackSpeed = speed;

    // Restart if playing to apply new speed
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  /**
   * Jump to next keyframe
   */
  nextKeyframe() {
    const current = this.pipeline.currentTimestamp;
    const next = this.pipeline.keyframes.find(k => k.timestamp > current);

    if (next) {
      this.pipeline.jumpToKeyframe(next);
      if (this.onScrub) {
        this.onScrub(next.timestamp, this.getPosition());
      }
    }
  }

  /**
   * Jump to previous keyframe
   */
  prevKeyframe() {
    const current = this.pipeline.currentTimestamp;
    const prev = [...this.pipeline.keyframes]
      .reverse()
      .find(k => k.timestamp < current);

    if (prev) {
      this.pipeline.jumpToKeyframe(prev);
      if (this.onScrub) {
        this.onScrub(prev.timestamp, this.getPosition());
      }
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.pause();
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof window !== 'undefined') {
  window.TemporalPipeline = TemporalPipeline;
  window.TemporalPipelineNode = TemporalPipelineNode;
  window.PipelineWire = PipelineWire;
  window.TimelineScrubber = TimelineScrubber;
  window.Keyframe = Keyframe;
  window.TemporalNodeType = TemporalNodeType;
  window.TemporalNodeLabels = TemporalNodeLabels;
  window.TemporalNodeIcons = TemporalNodeIcons;
  window.TemporalNodeColors = TemporalNodeColors;
  window.CookStatus = CookStatus;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TemporalPipeline,
    TemporalPipelineNode,
    PipelineWire,
    TimelineScrubber,
    Keyframe,
    TemporalNodeType,
    TemporalNodeLabels,
    TemporalNodeIcons,
    TemporalNodeColors,
    CookStatus
  };
}
