/**
 * EO Activity System
 *
 * Implements the EO-compliant activity recording system where:
 * - Actions are transformations, not events
 * - Every activity is: Operator × Target × Context
 * - Operators are atomic, actions can be sequences
 * - Context is the full 9-element EO provenance
 *
 * Storage Architecture:
 * 1. eo_activities     - Operator applications (atomic)
 * 2. eo_contexts       - Reusable context objects
 * 3. eo_sequences      - Compound action sequences
 */

// ============================================================================
// Activity Atom - The Fundamental Unit
// ============================================================================

/**
 * Create an activity atom - the minimal EO activity record
 *
 * EO Canonical Form: Operator(Target) ⟨ in Context ⟩
 *
 * - Operator is PRIMARY (defines the transformation)
 * - Target is the OPERAND (relational position being acted upon)
 * - Context is CONSTITUTIVE (not decorative - grounds the meaning)
 *
 * @param {Object} params
 * @param {string} params.operator - One of the 9 EO operators (NUL, DES, INS, SEG, CON, ALT, SYN, SUP, REC)
 * @param {Object} params.target - Relational position being transformed
 * @param {Object} params.context - The 9-element EO context (required, not optional)
 * @param {Object} options - Additional options
 * @returns {Object} Activity atom
 */
function createActivityAtom(params, options = {}) {
  const { operator, target, context } = params;

  // ─────────────────────────────────────────────────────────────────────────
  // EO VALIDATION: All three components are required
  // "Never allow an operator without a declared target.
  //  Never allow a target change without an operator.
  //  Never allow either without context."
  // ─────────────────────────────────────────────────────────────────────────

  const validation = validateActivityAtom(operator, target, context);
  if (!validation.valid) {
    console.error('Invalid EO activity atom:', validation.errors);
    if (options.strict) {
      throw new Error(`Invalid EO activity: ${validation.errors.join(', ')}`);
    }
  }

  const atom = {
    id: generateActivityId(),
    type: 'activity_atom',

    // ─────────────────────────────────────────────────────────────────────────
    // OPERATOR (Primary) - The transformation being applied
    // ─────────────────────────────────────────────────────────────────────────
    operator: operator,

    // ─────────────────────────────────────────────────────────────────────────
    // TARGET (Operand) - The relational position being acted upon
    // Not just "object" in CRUD sense - can be entity, relationship,
    // boundary, definition, frame, or even another operator (in REC cases)
    // ─────────────────────────────────────────────────────────────────────────
    target: normalizeTarget(target),

    // ─────────────────────────────────────────────────────────────────────────
    // CONTEXT (Constitutive) - Ontological grounding, not just metadata
    // Without context, the operator is undefined
    // With wrong context, the action is misclassified
    // ─────────────────────────────────────────────────────────────────────────
    context: normalizeContext(context),

    // Temporal ordering
    timestamp: new Date().toISOString(),
    logicalClock: options.logicalClock || Date.now(),

    // Sequence membership (if part of compound action)
    sequenceId: options.sequenceId || null,
    sequenceIndex: options.sequenceIndex || null,

    // Lineage
    causedBy: options.causedBy || null,
    supersedes: options.supersedes || null,

    // Validation status
    _valid: validation.valid,
    _warnings: validation.warnings
  };

  return atom;
}

/**
 * Validate an activity atom
 * EO Rule: All three components (operator, target, context) are required
 */
function validateActivityAtom(operator, target, context) {
  const result = { valid: true, errors: [], warnings: [] };

  // Operator validation
  if (!operator) {
    result.valid = false;
    result.errors.push('Operator is required');
  } else if (typeof window !== 'undefined' && window.EOOperators && !window.EOOperators.isValid(operator)) {
    result.valid = false;
    result.errors.push(`Invalid operator: ${operator}`);
  }

  // Target validation
  if (!target) {
    result.valid = false;
    result.errors.push('Target is required');
  } else {
    if (!target.id && !target.entityId && !target.entity_id) {
      result.warnings.push('Target has no ID - may be difficult to trace');
    }
    if (!target.type && !target.entityType && !target.entity_type && !target.positionType) {
      result.warnings.push('Target has no type - classification may be ambiguous');
    }
  }

  // Context validation
  if (!context) {
    result.valid = false;
    result.errors.push('Context is required - operator meaning is undefined without context');
  } else if (!context.$ref) {
    // Check for at least one epistemic element (who/how/where)
    const hasEpistemic = context.epistemic?.agent || context.epistemic?.method || context.epistemic?.source ||
                         context.agent || context.method || context.source;
    if (!hasEpistemic) {
      result.warnings.push('Context has no epistemic grounding (agent/method/source)');
    }
  }

  return result;
}

/**
 * Normalize target to standard form
 * Target = relational position being acted upon
 */
function normalizeTarget(target) {
  if (!target) return null;

  return {
    // Identity
    id: target.id || target.entityId || target.entity_id || null,

    // Type of relational position
    // Can be: entity, relationship, boundary, definition, frame, operator
    positionType: target.positionType || target.type || target.entityType || target.entity_type || 'entity',

    // For sub-entity targeting
    fieldId: target.fieldId || target.field_id || null,

    // Relationship context (for CON/SEG operators)
    relatedTo: target.relatedTo || target.targetId || null,
    relationshipType: target.relationshipType || target.linkType || null,

    // Value change tracking
    previousValue: target.previousValue,
    newValue: target.newValue,

    // For boundary/frame targeting
    scope: target.scope || null
  };
}

/**
 * Generate unique activity ID
 */
function generateActivityId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `act_${timestamp}_${random}`;
}

/**
 * Generate unique sequence ID
 */
function generateSequenceId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `seq_${timestamp}_${random}`;
}

/**
 * Generate unique context ID
 */
function generateContextId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ctx_${timestamp}_${random}`;
}

// ============================================================================
// Context Management
// ============================================================================

/**
 * Normalize context to standard 9-element form
 */
function normalizeContext(context) {
  if (!context) {
    return createEmptyContext();
  }

  // If it's a reference, return as-is
  if (context.$ref) {
    return { $ref: context.$ref };
  }

  // Normalize to triadic structure
  return {
    // Epistemic Triad - How the claim was produced
    epistemic: {
      agent: context.epistemic?.agent || context.agent || null,
      method: context.epistemic?.method || context.method || null,
      source: context.epistemic?.source || context.source || null
    },

    // Semantic Triad - What the claim means
    semantic: {
      term: context.semantic?.term || context.term || null,
      definition: context.semantic?.definition || context.definition || null,
      jurisdiction: context.semantic?.jurisdiction || context.jurisdiction || null
    },

    // Situational Triad - When/where it holds
    situational: {
      scale: context.situational?.scale || context.scale || null,
      timeframe: context.situational?.timeframe || context.timeframe || null,
      background: context.situational?.background || context.background || null
    }
  };
}

/**
 * Create empty context structure
 */
function createEmptyContext() {
  return {
    epistemic: { agent: null, method: null, source: null },
    semantic: { term: null, definition: null, jurisdiction: null },
    situational: { scale: null, timeframe: null, background: null }
  };
}

/**
 * Create context for common scenarios
 */
const ContextTemplates = {
  /**
   * User interaction via UI
   */
  userInteraction(userId, action) {
    return {
      epistemic: {
        agent: userId,
        method: 'interactive_ui',
        source: 'web_app'
      },
      semantic: {
        term: action,
        definition: null,
        jurisdiction: 'user_workspace'
      },
      situational: {
        scale: 'single_operation',
        timeframe: new Date().toISOString(),
        background: null
      }
    };
  },

  /**
   * Data import
   */
  dataImport(importerId, filename, source) {
    return {
      epistemic: {
        agent: importerId,
        method: 'file_import',
        source: filename
      },
      semantic: {
        term: 'imported_data',
        definition: null,
        jurisdiction: source || 'external'
      },
      situational: {
        scale: 'batch_operation',
        timeframe: new Date().toISOString(),
        background: 'data_ingestion'
      }
    };
  },

  /**
   * System automation
   */
  systemAutomation(systemId, trigger) {
    return {
      epistemic: {
        agent: systemId,
        method: 'automated_process',
        source: 'system'
      },
      semantic: {
        term: trigger,
        definition: null,
        jurisdiction: 'system_internal'
      },
      situational: {
        scale: 'system_operation',
        timeframe: new Date().toISOString(),
        background: 'automation_trigger'
      }
    };
  },

  /**
   * API request
   */
  apiRequest(clientId, endpoint) {
    return {
      epistemic: {
        agent: clientId,
        method: 'api_call',
        source: 'external_api'
      },
      semantic: {
        term: endpoint,
        definition: null,
        jurisdiction: 'api_scope'
      },
      situational: {
        scale: 'api_request',
        timeframe: new Date().toISOString(),
        background: null
      }
    };
  },

  /**
   * Ghost creation (entity deletion)
   */
  ghostCreation(actor, reason) {
    return {
      epistemic: {
        agent: actor,
        method: 'soft_delete',
        source: 'ghost_registry'
      },
      semantic: {
        term: 'ghost_creation',
        definition: 'Entity transitioned to ghost state',
        jurisdiction: 'data_lifecycle'
      },
      situational: {
        scale: 'single_entity',
        timeframe: new Date().toISOString(),
        background: reason || 'deletion_requested'
      }
    };
  },

  /**
   * Ghost resurrection (entity restoration)
   */
  ghostResurrection(actor, reason) {
    return {
      epistemic: {
        agent: actor,
        method: 'restore',
        source: 'ghost_registry'
      },
      semantic: {
        term: 'ghost_resurrection',
        definition: 'Ghost restored to active entity',
        jurisdiction: 'data_lifecycle'
      },
      situational: {
        scale: 'single_entity',
        timeframe: new Date().toISOString(),
        background: reason || 'restoration_requested'
      }
    };
  },

  /**
   * Haunt detection
   */
  hauntDetection(hauntType) {
    return {
      epistemic: {
        agent: 'system',
        method: 'automatic_detection',
        source: 'ghost_registry'
      },
      semantic: {
        term: 'haunt_detection',
        definition: `Ghost influence detected (${hauntType})`,
        jurisdiction: 'data_integrity'
      },
      situational: {
        scale: 'relationship',
        timeframe: new Date().toISOString(),
        background: 'ghost_reference_check'
      }
    };
  },

  /**
   * Haunt resolution
   */
  hauntResolution(actor) {
    return {
      epistemic: {
        agent: actor,
        method: 'manual_resolution',
        source: 'ghost_registry'
      },
      semantic: {
        term: 'haunt_resolution',
        definition: 'Ghost influence resolved',
        jurisdiction: 'data_integrity'
      },
      situational: {
        scale: 'relationship',
        timeframe: new Date().toISOString(),
        background: 'reference_cleanup'
      }
    };
  }
};

// ============================================================================
// Ghost Activity Helpers
// ============================================================================

/**
 * Create activity atoms for ghost operations
 */
const GhostActivities = {
  /**
   * Record entity ghosting (soft delete)
   */
  ghost(entityId, entityType, actor, reason) {
    return createActivityAtom({
      operator: 'NUL',
      target: {
        entityId,
        entityType,
        positionType: 'entity'
      },
      context: ContextTemplates.ghostCreation(actor, reason)
    });
  },

  /**
   * Record ghost resurrection
   */
  resurrect(ghostId, entityType, actor, reason) {
    return createActivityAtom({
      operator: 'INS',
      target: {
        entityId: ghostId,
        entityType,
        positionType: 'ghost'
      },
      context: ContextTemplates.ghostResurrection(actor, reason)
    });
  },

  /**
   * Record haunt detection
   */
  haunt(ghostId, targetId, hauntType) {
    return createActivityAtom({
      operator: 'CON',
      target: {
        entityId: targetId,
        relatedId: ghostId,
        positionType: 'haunt_relationship'
      },
      context: ContextTemplates.hauntDetection(hauntType)
    });
  },

  /**
   * Record haunt resolution
   */
  resolveHaunt(ghostId, targetId, actor) {
    return createActivityAtom({
      operator: 'NUL',
      target: {
        entityId: targetId,
        relatedId: ghostId,
        positionType: 'haunt_relationship'
      },
      context: ContextTemplates.hauntResolution(actor)
    });
  }
};

/**
 * Flatten triadic context to 9 flat fields
 */
function flattenContext(context) {
  if (!context || context.$ref) return context;

  return {
    agent: context.epistemic?.agent || null,
    method: context.epistemic?.method || null,
    source: context.epistemic?.source || null,
    term: context.semantic?.term || null,
    definition: context.semantic?.definition || null,
    jurisdiction: context.semantic?.jurisdiction || null,
    scale: context.situational?.scale || null,
    timeframe: context.situational?.timeframe || null,
    background: context.situational?.background || null
  };
}

/**
 * Count filled context elements
 */
function countContextElements(context) {
  const flat = flattenContext(context);
  if (!flat || flat.$ref) return 0;
  return Object.values(flat).filter(v => v != null).length;
}

// ============================================================================
// Activity Sequences (Compound Actions)
// ============================================================================

/**
 * Create an activity sequence - a compound action made of multiple operators
 *
 * @param {Object} params
 * @param {string} params.name - Human-readable name for the sequence
 * @param {Object[]} params.atoms - Array of activity atom parameters
 * @param {Object} params.context - Shared context for all atoms
 * @returns {Object} Activity sequence with generated atoms
 */
function createActivitySequence(params) {
  const { name, atoms, context } = params;
  const sequenceId = generateSequenceId();

  const sequence = {
    id: sequenceId,
    type: 'activity_sequence',
    name: name,
    timestamp: new Date().toISOString(),

    // The operators in order
    operators: atoms.map(a => a.operator),

    // Check if this matches a known compound pattern
    pattern: null,

    // The individual atoms
    atoms: [],

    // Shared context (atoms can override)
    context: normalizeContext(context),

    // Sequence metadata
    atomCount: atoms.length,
    completed: false,
    completedAt: null
  };

  // Check for known pattern match
  if (window.EOOperators?.matchCompound) {
    const match = window.EOOperators.matchCompound(sequence.operators);
    if (match) {
      sequence.pattern = match.id;
    }
  }

  // Generate atoms with sequence membership
  sequence.atoms = atoms.map((atomParams, index) => {
    const atomContext = atomParams.context
      ? mergeContexts(context, atomParams.context)
      : context;

    return createActivityAtom(
      {
        operator: atomParams.operator,
        target: atomParams.target,
        context: atomContext
      },
      {
        sequenceId: sequenceId,
        sequenceIndex: index,
        causedBy: index > 0 ? sequence.atoms[index - 1]?.id : null
      }
    );
  });

  return sequence;
}

/**
 * Merge two contexts (child overrides parent)
 */
function mergeContexts(parent, child) {
  if (!parent) return normalizeContext(child);
  if (!child) return normalizeContext(parent);

  const p = normalizeContext(parent);
  const c = normalizeContext(child);

  return {
    epistemic: {
      agent: c.epistemic?.agent ?? p.epistemic?.agent,
      method: c.epistemic?.method ?? p.epistemic?.method,
      source: c.epistemic?.source ?? p.epistemic?.source
    },
    semantic: {
      term: c.semantic?.term ?? p.semantic?.term,
      definition: c.semantic?.definition ?? p.semantic?.definition,
      jurisdiction: c.semantic?.jurisdiction ?? p.semantic?.jurisdiction
    },
    situational: {
      scale: c.situational?.scale ?? p.situational?.scale,
      timeframe: c.situational?.timeframe ?? p.situational?.timeframe,
      background: c.situational?.background ?? p.situational?.background
    }
  };
}

/**
 * Mark a sequence as completed
 */
function completeSequence(sequence) {
  sequence.completed = true;
  sequence.completedAt = new Date().toISOString();
  return sequence;
}

// ============================================================================
// Activity Store
// ============================================================================

/**
 * In-memory activity store with IndexedDB persistence
 */
class ActivityStore {
  constructor() {
    this.activities = new Map();     // id -> activity atom
    this.sequences = new Map();      // id -> activity sequence
    this.contexts = new Map();       // id -> reusable context

    // Indexes for fast querying
    this.byOperator = new Map();     // operator -> Set<activity_id>
    this.byEntity = new Map();       // entity_id -> Set<activity_id>
    this.byAgent = new Map();        // agent -> Set<activity_id>
    this.byTimestamp = [];           // sorted array for time-range queries

    this.dbName = 'eo_activity_store';
    this.dbVersion = 1;
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

        // Activities store
        if (!db.objectStoreNames.contains('activities')) {
          const actStore = db.createObjectStore('activities', { keyPath: 'id' });
          actStore.createIndex('operator', 'operator', { unique: false });
          actStore.createIndex('entityId', 'target.entityId', { unique: false });
          actStore.createIndex('timestamp', 'timestamp', { unique: false });
          actStore.createIndex('sequenceId', 'sequenceId', { unique: false });
          actStore.createIndex('agent', 'context.epistemic.agent', { unique: false });
        }

        // Sequences store
        if (!db.objectStoreNames.contains('sequences')) {
          const seqStore = db.createObjectStore('sequences', { keyPath: 'id' });
          seqStore.createIndex('pattern', 'pattern', { unique: false });
          seqStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Contexts store
        if (!db.objectStoreNames.contains('contexts')) {
          db.createObjectStore('contexts', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Load data from IndexedDB into memory
   */
  async _loadFromDB() {
    if (!this.db) return;

    // Load activities
    const activities = await this._getAllFromStore('activities');
    for (const act of activities) {
      this.activities.set(act.id, act);
      this._indexActivity(act);
    }

    // Load sequences
    const sequences = await this._getAllFromStore('sequences');
    for (const seq of sequences) {
      this.sequences.set(seq.id, seq);
    }

    // Load contexts
    const contexts = await this._getAllFromStore('contexts');
    for (const ctx of contexts) {
      this.contexts.set(ctx.id, ctx);
    }

    console.log(`ActivityStore loaded: ${this.activities.size} activities, ${this.sequences.size} sequences`);
  }

  /**
   * Get all records from an object store
   */
  async _getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save to IndexedDB
   */
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
    if (!this.byOperator.has(activity.operator)) {
      this.byOperator.set(activity.operator, new Set());
    }
    this.byOperator.get(activity.operator).add(activity.id);

    // By entity
    const entityId = activity.target?.entityId;
    if (entityId) {
      if (!this.byEntity.has(entityId)) {
        this.byEntity.set(entityId, new Set());
      }
      this.byEntity.get(entityId).add(activity.id);
    }

    // By agent
    const agent = activity.context?.epistemic?.agent;
    if (agent) {
      if (!this.byAgent.has(agent)) {
        this.byAgent.set(agent, new Set());
      }
      this.byAgent.get(agent).add(activity.id);
    }

    // By timestamp (maintain sorted order)
    this.byTimestamp.push({
      id: activity.id,
      timestamp: activity.timestamp
    });
    this.byTimestamp.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Record an activity atom
   */
  async record(activityAtom) {
    this.activities.set(activityAtom.id, activityAtom);
    this._indexActivity(activityAtom);

    if (this.db) {
      await this._saveToDB('activities', activityAtom);
    }

    // Emit event for real-time updates
    this._emit('activity:recorded', activityAtom);

    return activityAtom;
  }

  /**
   * Record an activity sequence
   */
  async recordSequence(sequence) {
    this.sequences.set(sequence.id, sequence);

    // Record all atoms
    for (const atom of sequence.atoms) {
      await this.record(atom);
    }

    if (this.db) {
      await this._saveToDB('sequences', sequence);
    }

    this._emit('sequence:recorded', sequence);

    return sequence;
  }

  /**
   * Save a reusable context
   */
  async saveContext(context) {
    const id = context.id || generateContextId();
    const contextWithId = { ...context, id };

    this.contexts.set(id, contextWithId);

    if (this.db) {
      await this._saveToDB('contexts', contextWithId);
    }

    return contextWithId;
  }

  /**
   * Get a context by ID
   */
  getContext(contextId) {
    return this.contexts.get(contextId) || null;
  }

  /**
   * Resolve a context reference
   */
  resolveContext(contextOrRef) {
    if (!contextOrRef) return createEmptyContext();
    if (contextOrRef.$ref) {
      return this.getContext(contextOrRef.$ref) || createEmptyContext();
    }
    return contextOrRef;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Query Methods
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get activity by ID
   */
  get(activityId) {
    return this.activities.get(activityId) || null;
  }

  /**
   * Get all activities for an operator
   */
  getByOperator(operator) {
    const ids = this.byOperator.get(operator);
    if (!ids) return [];
    return Array.from(ids).map(id => this.activities.get(id));
  }

  /**
   * Get all activities for an entity
   */
  getByEntity(entityId) {
    const ids = this.byEntity.get(entityId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.activities.get(id));
  }

  /**
   * Get all activities by an agent
   */
  getByAgent(agent) {
    const ids = this.byAgent.get(agent);
    if (!ids) return [];
    return Array.from(ids).map(id => this.activities.get(id));
  }

  /**
   * Get activities in a time range
   */
  getByTimeRange(startTime, endTime) {
    return this.byTimestamp
      .filter(entry => {
        return entry.timestamp >= startTime && entry.timestamp <= endTime;
      })
      .map(entry => this.activities.get(entry.id));
  }

  /**
   * Get recent activities
   */
  getRecent(limit = 50) {
    const sorted = Array.from(this.activities.values())
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return sorted.slice(0, limit);
  }

  /**
   * Query activities with filters
   */
  query(filters = {}) {
    let results = Array.from(this.activities.values());

    // Filter by operator(s)
    if (filters.operator) {
      const ops = Array.isArray(filters.operator) ? filters.operator : [filters.operator];
      results = results.filter(a => ops.includes(a.operator));
    }

    // Filter by entity
    if (filters.entityId) {
      results = results.filter(a => a.target?.entityId === filters.entityId);
    }

    // Filter by entity type
    if (filters.entityType) {
      results = results.filter(a => a.target?.entityType === filters.entityType);
    }

    // Filter by agent
    if (filters.agent) {
      results = results.filter(a => {
        const ctx = this.resolveContext(a.context);
        return ctx.epistemic?.agent === filters.agent;
      });
    }

    // Filter by method
    if (filters.method) {
      results = results.filter(a => {
        const ctx = this.resolveContext(a.context);
        return ctx.epistemic?.method === filters.method;
      });
    }

    // Filter by time range
    if (filters.startTime) {
      results = results.filter(a => a.timestamp >= filters.startTime);
    }
    if (filters.endTime) {
      results = results.filter(a => a.timestamp <= filters.endTime);
    }

    // Filter by sequence membership
    if (filters.sequenceId) {
      results = results.filter(a => a.sequenceId === filters.sequenceId);
    }

    // Filter dangerous operators only
    if (filters.dangerousOnly) {
      results = results.filter(a => {
        return window.EOOperators?.isDangerous(a.operator);
      });
    }

    // Sort
    const sortBy = filters.sortBy || 'timestamp';
    const sortDir = filters.sortDir || 'desc';
    results.sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'desc' ? -cmp : cmp;
    });

    // Limit
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get activity statistics
   */
  getStats() {
    const stats = {
      totalActivities: this.activities.size,
      totalSequences: this.sequences.size,
      byOperator: {},
      byEntityType: {},
      byAgent: {},
      dangerousCount: 0
    };

    for (const [op, ids] of this.byOperator) {
      stats.byOperator[op] = ids.size;
      if (window.EOOperators?.isDangerous(op)) {
        stats.dangerousCount += ids.size;
      }
    }

    for (const act of this.activities.values()) {
      const entityType = act.target?.entityType || 'unknown';
      stats.byEntityType[entityType] = (stats.byEntityType[entityType] || 0) + 1;

      const ctx = this.resolveContext(act.context);
      const agent = ctx.epistemic?.agent || 'unknown';
      stats.byAgent[agent] = (stats.byAgent[agent] || 0) + 1;
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
}

// ============================================================================
// Convenience Functions for Common Operations
// ============================================================================

/**
 * Create and record an activity in one call
 */
async function recordActivity(store, operator, target, context, options = {}) {
  const atom = createActivityAtom({ operator, target, context }, options);
  return store.record(atom);
}

/**
 * Create common activity patterns
 */
const ActivityPatterns = {
  /**
   * Create a new entity
   */
  create(store, entityType, entityId, name, context) {
    return createActivitySequence({
      name: `Create ${entityType}`,
      atoms: [
        { operator: 'INS', target: { entityId, entityType } },
        { operator: 'DES', target: { entityId, entityType, newValue: name } }
      ],
      context
    });
  },

  /**
   * Update a field value
   */
  updateField(store, entityId, fieldId, oldValue, newValue, context) {
    return createActivityAtom({
      operator: 'DES',
      target: {
        entityId,
        entityType: 'record',
        fieldId,
        previousValue: oldValue,
        newValue
      },
      context
    });
  },

  /**
   * Link two entities
   */
  link(store, sourceId, targetId, linkType, context) {
    return createActivityAtom({
      operator: 'CON',
      target: {
        entityId: sourceId,
        entityType: 'link',
        newValue: { targetId, linkType }
      },
      context
    });
  },

  /**
   * Delete/tombstone an entity
   */
  delete(store, entityId, entityType, context) {
    return createActivityAtom({
      operator: 'NUL',
      target: { entityId, entityType },
      context
    });
  },

  /**
   * Merge entities
   */
  merge(store, sourceIds, targetId, entityType, context) {
    return createActivityAtom({
      operator: 'SYN',
      target: {
        entityId: targetId,
        entityType,
        previousValue: sourceIds,
        newValue: targetId
      },
      context
    });
  },

  /**
   * Toggle a boolean state
   */
  toggle(store, entityId, fieldId, oldValue, newValue, context) {
    return createActivityAtom({
      operator: 'ALT',
      target: {
        entityId,
        entityType: 'field',
        fieldId,
        previousValue: oldValue,
        newValue
      },
      context
    });
  }
};

// ============================================================================
// Global Instance
// ============================================================================

let activityStoreInstance = null;

/**
 * Get or create the global activity store instance
 */
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
    createActivityAtom,
    validateActivityAtom,
    normalizeTarget,
    createActivitySequence,
    generateActivityId,
    generateSequenceId,
    generateContextId,
    normalizeContext,
    createEmptyContext,
    ContextTemplates,
    flattenContext,
    countContextElements,
    mergeContexts,
    completeSequence,
    ActivityStore,
    recordActivity,
    ActivityPatterns,
    getActivityStore
  };
}

if (typeof window !== 'undefined') {
  window.EOActivity = {
    createAtom: createActivityAtom,
    validateAtom: validateActivityAtom,
    normalizeTarget,
    createSequence: createActivitySequence,
    generateId: generateActivityId,
    generateSequenceId,
    generateContextId,
    normalizeContext,
    emptyContext: createEmptyContext,
    templates: ContextTemplates,
    flattenContext,
    countContextElements,
    mergeContexts,
    completeSequence,
    Store: ActivityStore,
    record: recordActivity,
    patterns: ActivityPatterns,
    getStore: getActivityStore,
    // Ghost activities
    ghost: GhostActivities
  };

  // Expose GhostActivities globally for convenience
  window.GhostActivities = GhostActivities;

  // Auto-initialize
  getActivityStore().then(store => {
    window.activityStore = store;
    console.log('EO Activity Store initialized');
  }).catch(err => {
    console.error('Failed to initialize Activity Store:', err);
  });
}
