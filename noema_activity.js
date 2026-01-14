/**
 * EO Activity System - Compact Format
 *
 * Design Principle: Store simple. Expand when needed.
 *
 * Activity storage format:
 *   { id, ts, op, actor, target, field?, delta?, method?, source?, seq?, ctx? }
 *
 * USER ATTRIBUTION:
 * The 'actor' field should be in format:
 *   - user:{userId} - for user-initiated actions (PREFERRED)
 *   - agent:{agentId} - for agent-level actions
 *   - session:{sessionId} - fallback for anonymous actions
 *   - system - for system-initiated actions
 *
 * All activities should be traceable to a user account for complete provenance.
 *
 * The 9 operators (INS, DES, SEG, CON, SYN, ALT, SUP, REC, NUL) are the vocabulary.
 * Context is referenced, not embedded (unless truly needed).
 *
 * ENFORCEMENT: See eo_activity_enforcement.js for comprehensive rule validation
 * based on docs/LAYER_ACTIVITY_TRACKING_RULES.md
 */

// Import enforcement if available
let enforcement = null;
if (typeof require !== 'undefined') {
  try {
    enforcement = require('./eo_activity_enforcement.js');
  } catch (e) {
    // Enforcement module not available - will use basic validation
  }
}

// ============================================================================
// Constants
// ============================================================================

const OPERATORS = Object.freeze({
  INS: 'INS',  // ⊕ Assert existence
  DES: 'DES',  // ⊙ Designate identity
  SEG: 'SEG',  // ⊘ Scope visibility
  CON: 'CON',  // ⊗ Connect entities
  SYN: 'SYN',  // ≡ Synthesize identity
  ALT: 'ALT',  // Δ Alternate world state
  SUP: 'SUP',  // ∥ Superpose interpretations
  REC: 'REC',  // ← Record grounding
  NUL: 'NUL'   // ∅ Assert meaningful absence
});

const OP_SYMBOLS = Object.freeze({
  INS: '⊕', DES: '⊙', SEG: '⊘', CON: '⊗', SYN: '≡',
  ALT: 'Δ', SUP: '∥', REC: '←', NUL: '∅'
});

// ============================================================================
// ID Generation
// ============================================================================

function genId(prefix = 'act') {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

// ============================================================================
// Core Activity Creation
// ============================================================================

/**
 * Create a compact activity record
 *
 * @param {string} op - Operator (INS, DES, SEG, CON, SYN, ALT, SUP, REC, NUL)
 * @param {string|Object} target - Entity ID or { id, field }
 * @param {string} actor - Who performed the action (user:{id}, agent:{id}, or session:{id})
 * @param {Object} options - Additional options
 * @returns {Object} Compact activity record
 */
function createActivity(op, target, actor, options = {}) {
  // Validate operator
  if (!OPERATORS[op]) {
    throw new Error(`Invalid operator: ${op}. Must be one of: ${Object.keys(OPERATORS).join(', ')}`);
  }

  // Normalize actor - prefer user:{userId} format
  let normalizedActor = actor;
  if (!actor) {
    // Try to get from current user/session
    if (typeof window !== 'undefined') {
      if (window.getCurrentUserActor) {
        normalizedActor = window.getCurrentUserActor();
      } else if (window.getCurrentActor) {
        normalizedActor = window.getCurrentActor();
      }
    }
  }
  // Warn if still no actor (provenance incomplete)
  if (!normalizedActor) {
    console.warn('Creating activity without actor - provenance incomplete');
    normalizedActor = 'unknown';
  }

  // Normalize target
  const targetId = typeof target === 'string' ? target : (target.id || target.entityId);
  const field = typeof target === 'object' ? (target.field || target.fieldId) : null;

  const activity = {
    id: options.id || genId('act'),
    ts: options.ts || Date.now(),
    op,
    actor: normalizedActor,
    target: targetId
  };

  // Extract userId from actor if in user:{id} format for direct indexing
  if (normalizedActor.startsWith('user:')) {
    activity.userId = normalizedActor.substring(5);
  }

  // Optional fields - only include if present
  if (field) activity.field = field;
  if (options.delta) activity.delta = options.delta;  // [prev, next]
  if (options.method) activity.method = options.method;
  if (options.source) activity.source = options.source;
  if (options.seq) activity.seq = options.seq;
  if (options.ctx) activity.ctx = options.ctx;
  if (options.data) activity.data = options.data;  // Additional payload

  // Delegation tracking
  if (options.delegatedFrom) activity.delegatedFrom = options.delegatedFrom;

  return activity;
}

/**
 * Validate an activity record
 *
 * @param {Object} activity - The activity to validate
 * @param {Object} options - Validation options
 * @param {string} options.layerType - Layer type for layer-specific validation
 * @param {boolean} options.strict - If true, treats warnings as errors
 * @param {boolean} options.enforceRules - If true, uses comprehensive enforcement (default: true if enforcement available)
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateActivity(activity, options = {}) {
  // Use comprehensive enforcement if available and not explicitly disabled
  if (enforcement && options.enforceRules !== false) {
    return enforcement.enforceActivityRules(activity, options);
  }

  // Fallback to basic validation
  const errors = [];
  const warnings = [];

  if (!activity.op) {
    errors.push('Missing operator (op)');
  } else if (!OPERATORS[activity.op]) {
    errors.push(`Invalid operator: ${activity.op}`);
  }

  if (!activity.target) {
    errors.push('Missing target - every activity must specify what is being operated on');
  }

  if (!activity.actor) {
    errors.push('Missing actor - every activity must specify who/what is performing it');
  }

  if (!activity.ts) {
    errors.push('Missing timestamp (ts)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================================================
// Activity Expansion (Compact → Verbose)
// ============================================================================

/**
 * Expand a compact activity to verbose format
 * Used for compliance validation, display, and legacy compatibility
 *
 * @param {Object} activity - Compact activity record
 * @param {Function} loadContext - Optional function to load context by ID
 * @returns {Object} Verbose activity atom
 */
function expand(activity, loadContext = null) {
  // Build context from activity fields or loaded context
  let context;
  if (activity.ctx && loadContext) {
    context = loadContext(activity.ctx);
  } else {
    context = {
      epistemic: {
        agent: activity.actor,
        method: activity.method || null,
        source: activity.source || null
      },
      semantic: {
        term: null,
        definition: null,
        jurisdiction: null
      },
      situational: {
        scale: null,
        timeframe: new Date(activity.ts).toISOString(),
        background: null
      }
    };
  }

  // Build target object
  const target = {
    id: activity.target,
    entityId: activity.target,
    positionType: 'entity',
    fieldId: activity.field || null,
    previousValue: activity.delta ? activity.delta[0] : undefined,
    newValue: activity.delta ? activity.delta[1] : undefined
  };

  // Merge any additional data
  if (activity.data) {
    Object.assign(target, activity.data);
  }

  return {
    id: activity.id,
    type: 'activity_atom',
    operator: activity.op,
    symbol: OP_SYMBOLS[activity.op],
    target,
    context,
    timestamp: new Date(activity.ts).toISOString(),
    logicalClock: activity.ts,
    sequenceId: activity.seq || null,
    sequenceIndex: null,
    causedBy: null,
    supersedes: null,
    _valid: true,
    _warnings: []
  };
}

/**
 * Compact a verbose activity to storage format
 * Used for migration from old format
 *
 * @param {Object} verbose - Verbose activity atom
 * @returns {Object} Compact activity record
 */
function compact(verbose) {
  const activity = {
    id: verbose.id,
    ts: verbose.logicalClock || new Date(verbose.timestamp).getTime(),
    op: verbose.operator,
    actor: verbose.context?.epistemic?.agent,
    target: verbose.target?.id || verbose.target?.entityId
  };

  if (verbose.target?.fieldId) {
    activity.field = verbose.target.fieldId;
  }

  if (verbose.target?.previousValue !== undefined || verbose.target?.newValue !== undefined) {
    activity.delta = [verbose.target.previousValue, verbose.target.newValue];
  }

  if (verbose.context?.epistemic?.method) {
    activity.method = verbose.context.epistemic.method;
  }

  if (verbose.context?.epistemic?.source) {
    activity.source = verbose.context.epistemic.source;
  }

  if (verbose.sequenceId) {
    activity.seq = verbose.sequenceId;
  }

  return activity;
}

/**
 * Detect if an activity is in old verbose format
 */
function isVerboseFormat(activity) {
  return activity.type === 'activity_atom' || activity.operator !== undefined;
}

/**
 * Migrate old verbose format to compact
 */
function migrate(activity) {
  if (isVerboseFormat(activity)) {
    return compact(activity);
  }
  return activity;
}

// ============================================================================
// Activity Convenience Wrappers
// ============================================================================

const Activity = {
  /**
   * Assert existence (INS)
   */
  insert(target, actor, options = {}) {
    return createActivity('INS', target, actor, options);
  },

  /**
   * Designate identity (DES)
   */
  designate(target, actor, name, options = {}) {
    return createActivity('DES', target, actor, {
      delta: [null, name],
      ...options
    });
  },

  /**
   * Scope visibility (SEG)
   */
  segment(target, actor, options = {}) {
    return createActivity('SEG', target, actor, options);
  },

  /**
   * Connect entities (CON)
   */
  connect(target, actor, relatedTo, options = {}) {
    return createActivity('CON', target, actor, {
      data: { relatedTo },
      ...options
    });
  },

  /**
   * Synthesize identity (SYN) - merge/dedupe
   */
  synthesize(target, actor, mergedFrom, options = {}) {
    return createActivity('SYN', target, actor, {
      data: { mergedFrom },
      ...options
    });
  },

  /**
   * Alternate world state (ALT) - update/change
   */
  update(target, actor, delta, options = {}) {
    return createActivity('ALT', target, actor, {
      delta,
      ...options
    });
  },

  /**
   * Superpose interpretations (SUP)
   */
  superpose(target, actor, interpretations, options = {}) {
    return createActivity('SUP', target, actor, {
      data: { interpretations },
      ...options
    });
  },

  /**
   * Record grounding (REC)
   */
  record(target, actor, options = {}) {
    return createActivity('REC', target, actor, options);
  },

  /**
   * Assert meaningful absence (NUL) - delete/ghost
   */
  nullify(target, actor, reason, options = {}) {
    return createActivity('NUL', target, actor, {
      data: { reason },
      ...options
    });
  }
};

// ============================================================================
// Ghost Activity Helpers (thin wrappers)
// ============================================================================

const GhostActivities = {
  /**
   * Record entity ghosting (soft delete)
   */
  ghost(entityId, actor, reason = null) {
    return Activity.nullify(entityId, actor, reason || 'user_deletion', {
      method: 'soft_delete'
    });
  },

  /**
   * Record ghost resurrection
   */
  resurrect(entityId, actor, reason = null) {
    return Activity.insert(entityId, actor, {
      method: 'resurrect',
      data: { reason: reason || 'user_resurrection', wasGhost: true }
    });
  },

  /**
   * Record haunt detection
   */
  haunt(ghostId, targetId, hauntType) {
    return Activity.connect(targetId, 'system', ghostId, {
      method: 'haunt_detection',
      data: { hauntType }
    });
  },

  /**
   * Record haunt resolution
   */
  resolveHaunt(ghostId, targetId, actor) {
    return Activity.nullify(targetId, actor, 'haunt_resolved', {
      method: 'haunt_resolution',
      data: { ghostId }
    });
  }
};

// ============================================================================
// Context Management
// ============================================================================

/**
 * Create a reusable context record
 * Stored separately, referenced by ID
 */
function createContext(fields, id = null) {
  return {
    id: id || genId('ctx'),
    ...fields,
    createdAt: Date.now()
  };
}

/**
 * Context templates for common scenarios
 */
const ContextTemplates = {
  uiInteraction(actor) {
    return createContext({
      method: 'interactive_ui',
      source: 'web_app',
      scale: 'single_operation'
    });
  },

  apiCall(actor, endpoint) {
    return createContext({
      method: 'api_call',
      source: endpoint,
      scale: 'api_request'
    });
  },

  import(actor, filename) {
    return createContext({
      method: 'file_import',
      source: filename,
      scale: 'batch_operation'
    });
  },

  system(trigger) {
    return createContext({
      method: 'automated_process',
      source: 'system',
      background: trigger
    });
  },

  legal(jurisdiction, definition) {
    return createContext({
      jurisdiction,
      definition,
      scale: 'legal_operation'
    });
  }
};

// ============================================================================
// Activity Sequences (Compound Actions)
// ============================================================================

/**
 * Create an activity sequence for compound operations
 */
function createSequence(name, actor, options = {}) {
  return {
    id: genId('seq'),
    ts: Date.now(),
    name,
    actor,
    ops: [],
    ctx: options.ctx || null,
    completed: false,
    completedAt: null
  };
}

/**
 * Add an activity to a sequence
 */
function addToSequence(sequence, activity) {
  activity.seq = sequence.id;
  sequence.ops.push(activity.op);
  return activity;
}

/**
 * Complete a sequence
 */
function completeSequence(sequence) {
  sequence.completed = true;
  sequence.completedAt = Date.now();
  return sequence;
}

// ============================================================================
// Activity Store
// ============================================================================

class ActivityStore {
  constructor() {
    this.activities = new Map();
    this.sequences = new Map();
    this.contexts = new Map();

    // Indexes
    this.byOp = new Map();
    this.byTarget = new Map();
    this.byActor = new Map();
    this.byUserId = new Map(); // NEW: Index by user ID for efficient user queries
    this.byTime = [];

    this.dbName = 'eo_activity_store';
    this.dbVersion = 3;  // Bumped for userId index
    this.db = null;
  }

  /**
   * Initialize IndexedDB
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        this._loadFromDB().then(resolve).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        // Activities store
        if (!db.objectStoreNames.contains('activities')) {
          const actStore = db.createObjectStore('activities', { keyPath: 'id' });
          actStore.createIndex('op', 'op', { unique: false });
          actStore.createIndex('target', 'target', { unique: false });
          actStore.createIndex('actor', 'actor', { unique: false });
          actStore.createIndex('ts', 'ts', { unique: false });
          actStore.createIndex('seq', 'seq', { unique: false });
        } else if (oldVersion < 2) {
          // Migrate from old indexes
          const tx = event.target.transaction;
          const store = tx.objectStore('activities');

          // Delete old nested indexes if they exist
          try {
            if (store.indexNames.contains('agent')) store.deleteIndex('agent');
            if (store.indexNames.contains('operator')) store.deleteIndex('operator');
            if (store.indexNames.contains('entityId')) store.deleteIndex('entityId');
            if (store.indexNames.contains('timestamp')) store.deleteIndex('timestamp');
            if (store.indexNames.contains('sequenceId')) store.deleteIndex('sequenceId');
          } catch (e) {
            console.warn('Index migration warning:', e);
          }

          // Create new flat indexes
          if (!store.indexNames.contains('op')) {
            store.createIndex('op', 'op', { unique: false });
          }
          if (!store.indexNames.contains('target')) {
            store.createIndex('target', 'target', { unique: false });
          }
          if (!store.indexNames.contains('actor')) {
            store.createIndex('actor', 'actor', { unique: false });
          }
          if (!store.indexNames.contains('ts')) {
            store.createIndex('ts', 'ts', { unique: false });
          }
        }

        // Sequences store
        if (!db.objectStoreNames.contains('sequences')) {
          const seqStore = db.createObjectStore('sequences', { keyPath: 'id' });
          seqStore.createIndex('ts', 'ts', { unique: false });
        }

        // Contexts store
        if (!db.objectStoreNames.contains('contexts')) {
          db.createObjectStore('contexts', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Load data from IndexedDB
   */
  async _loadFromDB() {
    if (!this.db) return;

    const activities = await this._getAllFromStore('activities');
    for (const act of activities) {
      // Migrate old format if needed
      const migrated = migrate(act);
      this.activities.set(migrated.id, migrated);
      this._indexActivity(migrated);
    }

    const sequences = await this._getAllFromStore('sequences');
    for (const seq of sequences) {
      this.sequences.set(seq.id, seq);
    }

    const contexts = await this._getAllFromStore('contexts');
    for (const ctx of contexts) {
      this.contexts.set(ctx.id, ctx);
    }

    console.log(`ActivityStore loaded: ${this.activities.size} activities, ${this.sequences.size} sequences, ${this.contexts.size} contexts`);
  }

  async _getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async _saveToDB(storeName, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Index an activity for fast queries
   */
  _indexActivity(activity) {
    // By operator
    if (!this.byOp.has(activity.op)) {
      this.byOp.set(activity.op, new Set());
    }
    this.byOp.get(activity.op).add(activity.id);

    // By target
    if (activity.target) {
      if (!this.byTarget.has(activity.target)) {
        this.byTarget.set(activity.target, new Set());
      }
      this.byTarget.get(activity.target).add(activity.id);
    }

    // By actor
    if (activity.actor) {
      if (!this.byActor.has(activity.actor)) {
        this.byActor.set(activity.actor, new Set());
      }
      this.byActor.get(activity.actor).add(activity.id);
    }

    // By userId (extracted from actor or explicit)
    const userId = activity.userId ||
      (activity.actor?.startsWith('user:') ? activity.actor.substring(5) : null);
    if (userId) {
      if (!this.byUserId.has(userId)) {
        this.byUserId.set(userId, new Set());
      }
      this.byUserId.get(userId).add(activity.id);
    }

    // By time
    this.byTime.push({ id: activity.id, ts: activity.ts });
    this.byTime.sort((a, b) => a.ts - b.ts);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Record Methods
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Record an activity
   *
   * @param {Object} activity - The activity to record
   * @param {Object} options - Recording options
   * @param {string} options.layerType - Layer type for validation
   * @param {boolean} options.strict - If true, throws on validation errors
   * @param {boolean} options.skipValidation - If true, skips validation (not recommended)
   */
  async record(activity, options = {}) {
    // Ensure compact format
    const stored = isVerboseFormat(activity) ? compact(activity) : activity;

    // Validate unless explicitly skipped
    if (!options.skipValidation) {
      const validation = validateActivity(stored, {
        layerType: options.layerType,
        strict: options.strict
      });

      if (!validation.valid) {
        const error = new Error(
          `Activity validation failed:\n` +
          validation.errors.map(e => `  - ${e}`).join('\n')
        );
        error.name = 'ActivityValidationError';
        error.activity = stored;
        error.errors = validation.errors;

        if (options.strict) {
          throw error;
        } else {
          console.warn(`Activity ${stored.id} recorded with validation errors:`, validation.errors);
        }
      }

      // Log warnings
      if (validation.warnings.length > 0) {
        console.warn(`Activity ${stored.id} has warnings:`, validation.warnings);
        stored._warnings = validation.warnings;
      }
    }

    this.activities.set(stored.id, stored);
    this._indexActivity(stored);

    if (this.db) {
      await this._saveToDB('activities', stored);
    }

    this._emit('activity:recorded', stored);
    return stored;
  }

  /**
   * Record an activity with strict enforcement
   * Throws if validation fails
   *
   * @param {Object} activity - The activity to record
   * @param {Object} options - Recording options (layerType required for full enforcement)
   */
  async recordStrict(activity, options = {}) {
    return this.record(activity, { ...options, strict: true });
  }

  /**
   * Record a sequence
   */
  async recordSequence(sequence, activities) {
    this.sequences.set(sequence.id, sequence);

    for (const activity of activities) {
      await this.record(activity);
    }

    if (this.db) {
      await this._saveToDB('sequences', sequence);
    }

    this._emit('sequence:recorded', sequence);
    return sequence;
  }

  /**
   * Save a context
   */
  async saveContext(context) {
    this.contexts.set(context.id, context);

    if (this.db) {
      await this._saveToDB('contexts', context);
    }

    return context;
  }

  /**
   * Get a context by ID
   */
  getContext(contextId) {
    return this.contexts.get(contextId) || null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Query Methods
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get activity by ID
   */
  get(id) {
    return this.activities.get(id) || null;
  }

  /**
   * Get expanded activity by ID
   */
  getExpanded(id) {
    const activity = this.get(id);
    if (!activity) return null;
    return expand(activity, (ctxId) => this.getContext(ctxId));
  }

  /**
   * Get activities by operator
   */
  getByOperator(op) {
    const ids = this.byOp.get(op);
    if (!ids) return [];
    return Array.from(ids).map(id => this.activities.get(id));
  }

  /**
   * Get activities by target entity
   */
  getByEntity(entityId) {
    const ids = this.byTarget.get(entityId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.activities.get(id));
  }

  /**
   * Get activities by actor
   */
  getByActor(actor) {
    const ids = this.byActor.get(actor);
    if (!ids) return [];
    return Array.from(ids).map(id => this.activities.get(id));
  }

  /**
   * Get activities by user ID
   * This is the preferred method for querying user-specific activities
   */
  getByUserId(userId) {
    const ids = this.byUserId.get(userId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.activities.get(id));
  }

  /**
   * Get activities by time range
   */
  getByTimeRange(startTs, endTs) {
    return this.byTime
      .filter(entry => entry.ts >= startTs && entry.ts <= endTs)
      .map(entry => this.activities.get(entry.id));
  }

  /**
   * Get recent activities
   */
  getRecent(limit = 50) {
    const sorted = Array.from(this.activities.values())
      .sort((a, b) => b.ts - a.ts);
    return sorted.slice(0, limit);
  }

  /**
   * Query activities with filters
   */
  query(filters = {}) {
    let results = Array.from(this.activities.values());

    if (filters.op) {
      const ops = Array.isArray(filters.op) ? filters.op : [filters.op];
      results = results.filter(a => ops.includes(a.op));
    }

    if (filters.target) {
      results = results.filter(a => a.target === filters.target);
    }

    if (filters.actor) {
      results = results.filter(a => a.actor === filters.actor);
    }

    // Filter by userId (preferred over actor for user-specific queries)
    if (filters.userId) {
      results = results.filter(a => {
        const activityUserId = a.userId ||
          (a.actor?.startsWith('user:') ? a.actor.substring(5) : null);
        return activityUserId === filters.userId;
      });
    }

    if (filters.method) {
      results = results.filter(a => a.method === filters.method);
    }

    if (filters.seq) {
      results = results.filter(a => a.seq === filters.seq);
    }

    if (filters.startTs) {
      results = results.filter(a => a.ts >= filters.startTs);
    }

    if (filters.endTs) {
      results = results.filter(a => a.ts <= filters.endTs);
    }

    // Filter by delegation
    if (filters.delegatedFrom) {
      results = results.filter(a => a.delegatedFrom === filters.delegatedFrom);
    }
    if (filters.isDelegated !== undefined) {
      results = results.filter(a => (a.delegatedFrom != null) === filters.isDelegated);
    }

    // Sort
    const sortBy = filters.sortBy || 'ts';
    const sortDir = filters.sortDir || 'desc';
    results.sort((a, b) => {
      const cmp = (a[sortBy] || 0) - (b[sortBy] || 0);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    // Limit
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get statistics
   */
  getStats() {
    const stats = {
      totalActivities: this.activities.size,
      totalSequences: this.sequences.size,
      totalContexts: this.contexts.size,
      byOperator: {}
    };

    for (const [op, ids] of this.byOp) {
      stats.byOperator[op] = ids.size;
    }

    return stats;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Event Emitter
  // ──────────────────────────────────────────────────────────────────────────

  _listeners = new Map();

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this._listeners.get(event).delete(callback);
  }

  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (e) {
          console.error(`Error in activity listener for ${event}:`, e);
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Legacy Compatibility
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get all activities in expanded (verbose) format
   * For legacy consumers that expect the old format
   */
  getAllExpanded() {
    return Array.from(this.activities.values())
      .map(a => expand(a, (ctxId) => this.getContext(ctxId)));
  }

  /**
   * Alias for legacy code
   */
  getByAgent(agent) {
    return this.getByActor(agent);
  }
}

// ============================================================================
// Global Instance
// ============================================================================

let activityStoreInstance = null;

async function getActivityStore() {
  if (!activityStoreInstance) {
    activityStoreInstance = new ActivityStore();
    await activityStoreInstance.init();
  }
  return activityStoreInstance;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Core
    OPERATORS,
    OP_SYMBOLS,
    genId,
    createActivity,
    validateActivity,

    // Expansion
    expand,
    compact,
    migrate,
    isVerboseFormat,

    // Convenience
    Activity,
    GhostActivities,

    // Context
    createContext,
    ContextTemplates,

    // Sequences
    createSequence,
    addToSequence,
    completeSequence,

    // Store
    ActivityStore,
    getActivityStore,

    // Enforcement (re-export if available)
    enforcement
  };
}

if (typeof window !== 'undefined') {
  // Load enforcement module for browser
  if (!enforcement && window.EOActivityEnforcement) {
    enforcement = window.EOActivityEnforcement;
  }

  window.EOActivity = {
    // Core
    OPERATORS,
    OP_SYMBOLS,
    genId,
    create: createActivity,
    validate: validateActivity,

    // Expansion
    expand,
    compact,
    migrate,

    // Convenience
    Activity,
    ghost: GhostActivities,

    // Context
    createContext,
    templates: ContextTemplates,

    // Sequences
    createSequence,
    addToSequence,
    completeSequence,

    // Store
    Store: ActivityStore,
    getStore: getActivityStore,

    // Enforcement
    enforcement: enforcement
  };

  // Legacy global
  window.GhostActivities = GhostActivities;

  // Auto-initialize
  getActivityStore().then(store => {
    window.activityStore = store;
    console.log('EO Activity Store initialized (compact format with enforcement)');
  }).catch(err => {
    console.error('Failed to initialize Activity Store:', err);
  });
}
