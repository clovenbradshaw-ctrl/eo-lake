/**
 * EO Event Store - The Append-Only Log
 *
 * AXIOM 0: The append-only log is the database. Everything else is a view.
 *
 * This implements the core event store that serves as the foundation of the
 * Experience Engine. All state is derived from this log.
 *
 * Now integrated with EO Layer 4 Operators:
 * - Every event records which EO operator(s) were applied
 * - Operator(Target) ⟨ in Context ⟩ is the canonical form
 * - Legacy actions are automatically mapped to operators
 *
 * Enforces:
 * - Rule 1: Distinction (Given vs Meant partition)
 * - Rule 2: Impenetrability (Given derives only from Given)
 * - Rule 3: Ineliminability (append-only, no erasure)
 * - Rule 8: Idempotent replay
 * - Rule 9: Revision without erasure
 */

/**
 * Event types - exhaustive and mutually exclusive (Rule 1)
 */
const EventType = Object.freeze({
  GIVEN: 'given',
  MEANT: 'meant'
});

/**
 * Mode of givenness for Given events
 */
const GivenMode = Object.freeze({
  PERCEIVED: 'perceived',   // Sensory input
  REPORTED: 'reported',     // External report
  MEASURED: 'measured',     // Instrument reading
  RECEIVED: 'received'      // Message/data received
});

/**
 * Epistemic status for Meant events
 */
const EpistemicStatus = Object.freeze({
  PRELIMINARY: 'preliminary',
  REVIEWED: 'reviewed',
  CONTESTED: 'contested'
});

/**
 * Generate content-addressable ID using DJB2 hash
 */
function generateEventId(payload) {
  const str = JSON.stringify(payload) + Date.now() + Math.random();
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return 'evt_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
}

/**
 * EOEventStore - The append-only event log
 *
 * Implements Axiom 0: Log Primacy
 */
class EOEventStore {
  constructor() {
    // The log - ordered sequence of events
    this._log = [];

    // Index for O(1) lookup by ID
    this._index = new Map();

    // Logical clock for causal ordering
    this._logicalClock = 0;

    // Events parked waiting for parents (causal readiness)
    this._parked = new Map();

    // Subscribers for reactive updates
    this._subscribers = new Set();

    // Frozen state (prevents appends when true)
    this._frozen = false;

    // ─────────────────────────────────────────────────────────────────────────
    // EO Operator Indexes (Layer 4 Integration)
    // ─────────────────────────────────────────────────────────────────────────

    // Index by operator for fast operator-based queries
    this._byOperator = new Map();

    // Index by target entity for entity-centric queries
    this._byEntity = new Map();

    // Activity store integration (lazy initialized)
    this._activityStore = null;
  }

  /**
   * Get or create activity store integration
   */
  async getActivityStore() {
    if (!this._activityStore && typeof window !== 'undefined' && window.EOActivity) {
      this._activityStore = await window.EOActivity.getStore();
    }
    return this._activityStore;
  }

  /**
   * Get current logical clock value
   */
  get clock() {
    return this._logicalClock;
  }

  /**
   * Get total event count
   */
  get size() {
    return this._log.length;
  }

  /**
   * Check if store is frozen
   */
  get frozen() {
    return this._frozen;
  }

  /**
   * Validate event structure and rules
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate(event) {
    const errors = [];

    // Rule 1: Must have valid type (given or meant)
    if (!event.type || !Object.values(EventType).includes(event.type)) {
      errors.push('RULE_1: Event must have type "given" or "meant"');
    }

    // Must have unique ID
    if (!event.id) {
      errors.push('RULE_1: Event must have unique ID');
    }

    // Must have actor
    if (!event.actor) {
      errors.push('RULE_1: Event must have actor');
    }

    // Must have timestamp
    if (!event.timestamp) {
      errors.push('RULE_1: Event must have timestamp');
    }

    // Must have context envelope
    if (!event.context) {
      errors.push('RULE_1: Event must have context envelope');
    } else {
      if (!event.context.workspace) {
        errors.push('RULE_1: Context must have workspace');
      }
      if (!event.context.schemaVersion) {
        errors.push('RULE_1: Context must have schemaVersion');
      }
    }

    // Must have payload
    if (event.payload === undefined) {
      errors.push('RULE_1: Event must have payload');
    }

    // Rule 2: Impenetrability - Given events can only derive from Given or external
    if (event.type === EventType.GIVEN && event.parents) {
      for (const parentId of event.parents) {
        const parent = this._index.get(parentId);
        if (parent && parent.type === EventType.MEANT) {
          errors.push('RULE_2: Given event cannot derive from Meant event (confabulation)');
        }
      }
    }

    // Rule 7: Groundedness - Meant events must have provenance in Given
    if (event.type === EventType.MEANT) {
      if (!event.provenance || event.provenance.length === 0) {
        errors.push('RULE_7: Meant event must have non-empty provenance');
      } else {
        // Verify provenance refers to existing Given events
        for (const provId of event.provenance) {
          const provEvent = this._index.get(provId);
          if (provEvent && provEvent.type !== EventType.GIVEN) {
            // Allow chains of Meant that ultimately ground in Given
            // This is checked transitively
          }
        }
      }

      // Must have frame
      if (!event.frame) {
        errors.push('RULE_8: Meant event must have frame');
      } else if (!event.frame.purpose) {
        errors.push('RULE_8: Frame must have purpose');
      }
    }

    // Given events should have mode
    if (event.type === EventType.GIVEN && !event.mode) {
      // Warning but not error
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Verify transitive grounding of Meant event in Given events
   * Rule 7: All interpretations must ultimately trace to raw experience
   */
  verifyGrounding(event, visited = new Set()) {
    if (event.type === EventType.GIVEN) {
      return { grounded: true, chain: [event.id] };
    }

    if (!event.provenance || event.provenance.length === 0) {
      return { grounded: false, error: 'No provenance' };
    }

    if (visited.has(event.id)) {
      return { grounded: false, error: 'Circular provenance' };
    }
    visited.add(event.id);

    const chains = [];
    for (const provId of event.provenance) {
      const provEvent = this._index.get(provId);
      if (!provEvent) {
        return { grounded: false, error: `Missing provenance event: ${provId}` };
      }

      const result = this.verifyGrounding(provEvent, visited);
      if (!result.grounded) {
        return result;
      }
      chains.push(...result.chain);
    }

    return { grounded: true, chain: [event.id, ...chains] };
  }

  /**
   * Append an event to the log
   *
   * Rule 3: Ineliminability - this is the only mutation allowed
   * Rule 8: Idempotent - appending same event twice is safe
   *
   * @returns {Object} { success: boolean, eventId?: string, error?: string, parked?: boolean }
   */
  append(event) {
    if (this._frozen) {
      return { success: false, error: 'Store is frozen' };
    }

    // Rule 8: Idempotent replay - if event exists, succeed silently
    if (this._index.has(event.id)) {
      return { success: true, eventId: event.id, duplicate: true };
    }

    // Validate event structure
    const validation = this.validate(event);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Check causal readiness - all parents must exist
    if (event.parents && event.parents.length > 0) {
      const missingParents = event.parents.filter(p => !this._index.has(p));
      if (missingParents.length > 0) {
        // Park the event until parents arrive
        this._parked.set(event.id, event);
        return { success: true, eventId: event.id, parked: true, waitingFor: missingParents };
      }
    }

    // Verify grounding for Meant events
    if (event.type === EventType.MEANT) {
      const grounding = this.verifyGrounding(event);
      if (!grounding.grounded) {
        return { success: false, error: `RULE_7: ${grounding.error}` };
      }
    }

    // Assign logical clock
    this._logicalClock++;

    // ─────────────────────────────────────────────────────────────────────────
    // EO Operator Integration
    // Derive operators from payload.action if not explicitly provided
    // ─────────────────────────────────────────────────────────────────────────
    let operators = event.operators;
    if (!operators && event.payload?.action) {
      operators = this._deriveOperators(event.payload.action);
    }

    const finalEvent = {
      ...event,
      logicalClock: this._logicalClock,
      operators: operators || null // EO Layer 4 operators
    };

    // Freeze the event object to prevent mutation (Rule 3)
    Object.freeze(finalEvent);
    if (finalEvent.context) Object.freeze(finalEvent.context);
    if (finalEvent.payload) Object.freeze(finalEvent.payload);
    if (finalEvent.frame) Object.freeze(finalEvent.frame);

    // Append to log
    this._log.push(finalEvent);
    this._index.set(finalEvent.id, finalEvent);

    // Index by operators
    this._indexByOperator(finalEvent);

    // Index by entity
    this._indexByEntity(finalEvent);

    // Notify subscribers
    this._notifySubscribers(finalEvent);

    // Check if any parked events can now be processed
    this._processParked();

    // Record activity atom asynchronously (non-blocking)
    this._recordActivity(finalEvent);

    return { success: true, eventId: finalEvent.id };
  }

  /**
   * Derive EO operators from legacy action string
   */
  _deriveOperators(action) {
    if (typeof window !== 'undefined' && window.EOOperators?.mapLegacy) {
      return window.EOOperators.mapLegacy(action);
    }
    // Fallback mapping for when EOOperators isn't loaded
    return this._fallbackOperatorMapping(action);
  }

  /**
   * Fallback operator mapping when EOOperators module isn't available
   */
  _fallbackOperatorMapping(action) {
    const lower = action.toLowerCase();
    if (lower.includes('create') || lower.includes('add') || lower.includes('new')) return ['INS'];
    if (lower.includes('delete') || lower.includes('remove') || lower.includes('tombstone')) return ['NUL'];
    if (lower.includes('update') || lower.includes('rename') || lower.includes('set')) return ['DES'];
    if (lower.includes('link') || lower.includes('connect')) return ['CON'];
    if (lower.includes('unlink') || lower.includes('filter')) return ['SEG'];
    if (lower.includes('merge') || lower.includes('combine')) return ['SYN'];
    if (lower.includes('toggle') || lower.includes('switch')) return ['ALT'];
    if (lower.includes('horizon') || lower.includes('overlay')) return ['SUP'];
    if (lower.includes('self') || lower.includes('auto') || lower.includes('migrate')) return ['REC'];
    return ['DES']; // Default to designation
  }

  /**
   * Index event by its operators
   */
  _indexByOperator(event) {
    if (!event.operators) return;
    for (const op of event.operators) {
      if (!this._byOperator.has(op)) {
        this._byOperator.set(op, new Set());
      }
      this._byOperator.get(op).add(event.id);
    }
  }

  /**
   * Index event by target entity
   */
  _indexByEntity(event) {
    const entityId = event.payload?.targetId ||
                     event.payload?.recordId ||
                     event.payload?.setId ||
                     event.payload?.viewId ||
                     event.payload?.entityId;
    if (entityId) {
      if (!this._byEntity.has(entityId)) {
        this._byEntity.set(entityId, []);
      }
      this._byEntity.get(entityId).push(event.id);
    }
  }

  /**
   * Record activity atom for this event (async, non-blocking)
   */
  async _recordActivity(event) {
    try {
      const store = await this.getActivityStore();
      if (!store || !event.operators) return;

      // Build target from event payload
      const target = {
        id: event.payload?.targetId || event.payload?.recordId || event.payload?.setId || event.id,
        positionType: event.payload?.entityType || 'event',
        previousValue: event.payload?.previousValue,
        newValue: event.payload?.newValue || event.payload?.value
      };

      // Build context from event
      const context = {
        epistemic: {
          agent: event.actor,
          method: event.type === 'given' ? (event.mode || 'received') : 'interpretation',
          source: event.context?.source || 'event_store'
        },
        semantic: {
          term: event.payload?.action,
          definition: event.frame?.purpose,
          jurisdiction: event.context?.workspace
        },
        situational: {
          scale: 'event',
          timeframe: event.timestamp,
          background: event.context?.background
        }
      };

      // Record one atom per operator in sequence
      for (let i = 0; i < event.operators.length; i++) {
        const atom = window.EOActivity.createAtom({
          operator: event.operators[i],
          target,
          context
        }, {
          logicalClock: event.logicalClock,
          sequenceIndex: event.operators.length > 1 ? i : null
        });

        await store.record(atom);
      }
    } catch (err) {
      // Non-blocking - log but don't fail the event append
      console.warn('Failed to record activity:', err);
    }
  }

  /**
   * Process parked events whose parents have arrived
   */
  _processParked() {
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, event] of this._parked) {
        const missingParents = event.parents.filter(p => !this._index.has(p));
        if (missingParents.length === 0) {
          this._parked.delete(id);
          this.append(event);
          changed = true;
        }
      }
    }
  }

  /**
   * Create a tombstone event (Rule 9: revision without erasure)
   *
   * @param {string} targetId - ID of event to mark as deleted
   * @param {string} actor - Who is creating the tombstone
   * @param {string} reason - Why the event is being tombstoned
   * @param {Object} context - Context envelope
   */
  createTombstone(targetId, actor, reason, context) {
    const target = this._index.get(targetId);
    if (!target) {
      return { success: false, error: `Target event not found: ${targetId}` };
    }

    const tombstone = {
      id: generateEventId({ action: 'tombstone', targetId }),
      type: EventType.GIVEN,
      actor,
      timestamp: new Date().toISOString(),
      mode: GivenMode.RECEIVED,
      parents: this.getHeads().map(e => e.id),
      context: {
        ...context,
        schemaVersion: context?.schemaVersion || '1.0'
      },
      payload: {
        action: 'tombstone',
        targetId,
        reason,
        originalType: target.type
      }
    };

    return this.append(tombstone);
  }

  /**
   * Create a supersession event (Rule 9: interpretation revision)
   *
   * @param {string} targetId - ID of Meant event being superseded
   * @param {Object} newInterpretation - The new interpretation payload
   * @param {string} actor - Who is superseding
   * @param {Object} frame - The frame for the new interpretation
   * @param {string[]} provenance - Provenance for the new interpretation
   * @param {Object} context - Context envelope
   * @param {string} supersessionType - Type: 'correction' | 'refinement' | 'retraction'
   */
  createSupersession(targetId, newInterpretation, actor, frame, provenance, context, supersessionType = 'refinement') {
    const target = this._index.get(targetId);
    if (!target) {
      return { success: false, error: `Target event not found: ${targetId}` };
    }

    if (target.type !== EventType.MEANT) {
      return { success: false, error: 'Can only supersede Meant events' };
    }

    const supersession = {
      id: generateEventId({ action: 'supersession', targetId }),
      type: EventType.MEANT,
      actor,
      timestamp: new Date().toISOString(),
      parents: this.getHeads().map(e => e.id),
      context: {
        ...context,
        schemaVersion: context?.schemaVersion || '1.0'
      },
      frame,
      provenance: provenance || target.provenance, // Inherit provenance if not provided
      epistemicStatus: EpistemicStatus.PRELIMINARY,
      supersedes: targetId,
      supersessionType,
      payload: newInterpretation
    };

    return this.append(supersession);
  }

  /**
   * Get event by ID
   */
  get(eventId) {
    return this._index.get(eventId);
  }

  /**
   * Get all events in order
   */
  getAll() {
    return [...this._log];
  }

  /**
   * Get events by type
   */
  getByType(type) {
    return this._log.filter(e => e.type === type);
  }

  /**
   * Get all Given events
   */
  getGiven() {
    return this.getByType(EventType.GIVEN);
  }

  /**
   * Get all Meant events
   */
  getMeant() {
    return this.getByType(EventType.MEANT);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EO Operator Query Methods (Layer 4)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get events by operator
   * @param {string} operator - One of: NUL, DES, INS, SEG, CON, ALT, SYN, SUP, REC
   */
  getByOperator(operator) {
    const ids = this._byOperator.get(operator);
    if (!ids) return [];
    return Array.from(ids).map(id => this._index.get(id)).filter(Boolean);
  }

  /**
   * Get events for an entity
   */
  getByEntity(entityId) {
    const ids = this._byEntity.get(entityId);
    if (!ids) return [];
    return ids.map(id => this._index.get(id)).filter(Boolean);
  }

  /**
   * Get operator statistics
   */
  getOperatorStats() {
    const stats = {};
    for (const [op, ids] of this._byOperator) {
      stats[op] = ids.size;
    }
    return stats;
  }

  /**
   * Query events with operator-based filters
   * @param {Object} filters
   * @param {string|string[]} filters.operators - Filter by operator(s)
   * @param {string} filters.entityId - Filter by target entity
   * @param {boolean} filters.dangerousOnly - Only SYN and REC operators
   * @param {string} filters.startTime - ISO timestamp
   * @param {string} filters.endTime - ISO timestamp
   * @param {number} filters.limit - Max results
   */
  queryByOperator(filters = {}) {
    let results = [...this._log];

    // Filter by operators
    if (filters.operators) {
      const ops = Array.isArray(filters.operators) ? filters.operators : [filters.operators];
      results = results.filter(e => e.operators && e.operators.some(op => ops.includes(op)));
    }

    // Filter dangerous only (SYN, REC)
    if (filters.dangerousOnly) {
      results = results.filter(e => e.operators && e.operators.some(op => op === 'SYN' || op === 'REC'));
    }

    // Filter by entity
    if (filters.entityId) {
      const entityEvents = new Set(this._byEntity.get(filters.entityId) || []);
      results = results.filter(e => entityEvents.has(e.id));
    }

    // Filter by time range
    if (filters.startTime) {
      results = results.filter(e => e.timestamp >= filters.startTime);
    }
    if (filters.endTime) {
      results = results.filter(e => e.timestamp <= filters.endTime);
    }

    // Sort by timestamp descending (most recent first)
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Limit
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get the transformation history for an entity
   * Returns all operations applied to this entity in chronological order
   */
  getEntityHistory(entityId) {
    return this.getByEntity(entityId).sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    );
  }

  /**
   * Detect dangerous operator patterns
   * Returns events that might need review
   */
  detectDangerousPatterns() {
    const dangerous = [];

    // Find all SYN (synthesize) - potential data loss
    const synEvents = this.getByOperator('SYN');
    for (const event of synEvents) {
      dangerous.push({
        event,
        reason: 'SYN operator - data synthesis may lose original boundaries',
        severity: 'warning'
      });
    }

    // Find all REC (recurse) - self-modification
    const recEvents = this.getByOperator('REC');
    for (const event of recEvents) {
      dangerous.push({
        event,
        reason: 'REC operator - self-modification can cause cascades',
        severity: 'critical'
      });
    }

    // Find sequences where REC isn't last
    for (const event of this._log) {
      if (event.operators && event.operators.includes('REC')) {
        const recIndex = event.operators.indexOf('REC');
        if (recIndex < event.operators.length - 1) {
          dangerous.push({
            event,
            reason: 'REC operator not at end of sequence - may cause unintended effects',
            severity: 'warning'
          });
        }
      }
    }

    return dangerous;
  }

  /**
   * Get head events (events with no children)
   */
  getHeads() {
    const allParents = new Set();
    for (const event of this._log) {
      if (event.parents) {
        event.parents.forEach(p => allParents.add(p));
      }
    }
    return this._log.filter(e => !allParents.has(e.id));
  }

  /**
   * Get events in topological order (respecting causality)
   */
  getTopologicalOrder() {
    const visited = new Set();
    const result = [];

    const visit = (eventId) => {
      if (visited.has(eventId)) return;
      visited.add(eventId);

      const event = this._index.get(eventId);
      if (!event) return;

      if (event.parents) {
        for (const parentId of event.parents) {
          visit(parentId);
        }
      }
      result.push(event);
    };

    for (const event of this._log) {
      visit(event.id);
    }

    return result;
  }

  /**
   * Get active interpretations (not superseded) for a frame
   */
  getActiveInterpretations(frame = null) {
    const superseded = new Set();

    for (const event of this._log) {
      if (event.supersedes) {
        if (frame === null || (event.frame && event.frame.purpose === frame)) {
          superseded.add(event.supersedes);
        }
      }
    }

    return this._log.filter(e =>
      e.type === EventType.MEANT &&
      !superseded.has(e.id) &&
      (frame === null || (e.frame && e.frame.purpose === frame))
    );
  }

  /**
   * Get provenance chain for a Meant event
   */
  getProvenanceChain(eventId, maxDepth = 10) {
    const chain = [];
    const visited = new Set();

    const traverse = (id, depth) => {
      if (depth > maxDepth || visited.has(id)) return;
      visited.add(id);

      const event = this._index.get(id);
      if (!event) return;

      chain.push(event);

      if (event.provenance) {
        for (const provId of event.provenance) {
          traverse(provId, depth + 1);
        }
      }
    };

    traverse(eventId, 0);
    return chain;
  }

  /**
   * Check if an event is tombstoned
   */
  isTombstoned(eventId) {
    return this._log.some(e =>
      e.payload?.action === 'tombstone' &&
      e.payload?.targetId === eventId
    );
  }

  /**
   * Subscribe to new events
   */
  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  /**
   * Notify subscribers of new event
   */
  _notifySubscribers(event) {
    for (const callback of this._subscribers) {
      try {
        callback(event);
      } catch (err) {
        console.error('Subscriber error:', err);
      }
    }
  }

  /**
   * Freeze the store (prevent further appends)
   */
  freeze() {
    this._frozen = true;
  }

  /**
   * Unfreeze the store
   */
  unfreeze() {
    this._frozen = false;
  }

  /**
   * Export the log for persistence
   */
  export() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      logicalClock: this._logicalClock,
      events: this._log.map(e => ({ ...e })) // Shallow copy to allow serialization
    };
  }

  /**
   * Import events from persistence
   * Maintains all invariants during import
   */
  import(data) {
    if (!data || !data.events) {
      return { success: false, error: 'Invalid import data' };
    }

    let imported = 0;
    let errors = [];

    for (const event of data.events) {
      const result = this.append(event);
      if (result.success) {
        imported++;
      } else if (result.errors) {
        errors.push({ eventId: event.id, errors: result.errors });
      }
    }

    // Restore logical clock if needed
    if (data.logicalClock && data.logicalClock > this._logicalClock) {
      this._logicalClock = data.logicalClock;
    }

    return { success: true, imported, errors };
  }

  /**
   * Clear the store (for testing only)
   */
  _clear() {
    this._log = [];
    this._index.clear();
    this._parked.clear();
    this._logicalClock = 0;
  }
}

// Singleton instance
let _eventStore = null;

function getEventStore() {
  if (!_eventStore) {
    _eventStore = new EOEventStore();
  }
  return _eventStore;
}

function initEventStore() {
  _eventStore = new EOEventStore();
  return _eventStore;
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EOEventStore,
    EventType,
    GivenMode,
    EpistemicStatus,
    generateEventId,
    getEventStore,
    initEventStore
  };
}

if (typeof window !== 'undefined') {
  window.EOEventStore = EOEventStore;
  window.EventType = EventType;
  window.GivenMode = GivenMode;
  window.EpistemicStatus = EpistemicStatus;
  window.generateEventId = generateEventId;
  window.getEventStore = getEventStore;
  window.initEventStore = initEventStore;
}
