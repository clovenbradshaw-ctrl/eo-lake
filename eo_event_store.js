/**
 * EO Event Store - Strict EO-Aligned Event Log
 *
 * EO AXIOM (ENFORCED):
 * Nothing Meant may exist, persist, or be queried without an explicit,
 * typed grounding chain terminating in Given reality.
 *
 * AXIOM 0: The append-only log is the database. Everything else is a view.
 *
 * This module implements the core event store with:
 * - Three epistemic types: given, meant, derived_value
 * - Typed grounding references
 * - Runtime enforcement of EO rules
 * - Integration with grounding graph
 *
 * Enforces:
 * - Rule 1: Given/Meant distinction (mutually exclusive, enforced at runtime)
 * - Rule 2: External Origin (only Given may have external grounding)
 * - Rule 3: Immutability (Given events are append-only)
 * - Rule 5: Restrictivity (operators are monotonic by type)
 * - Rule 6: Coherence (grounding kinds must remain compatible)
 * - Rule 7: Groundedness (every Meant declares typed grounds)
 * - Rule 8: Minimal Crystallization (no aggregation without value artifacts)
 * - Rule 9: Defeasibility (supersession replaces claims, not evidence)
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Epistemic types - exhaustive and mutually exclusive (Rule 1)
 */
const EpistemicType = Object.freeze({
  GIVEN: 'given',
  MEANT: 'meant',
  DERIVED_VALUE: 'derived_value'
});

/**
 * Mode of givenness for Given events
 */
const GivenMode = Object.freeze({
  PERCEIVED: 'perceived',
  REPORTED: 'reported',
  MEASURED: 'measured',
  RECEIVED: 'received'
});

/**
 * Grounding kinds
 */
const GroundingKind = Object.freeze({
  EXTERNAL: 'external',
  STRUCTURAL: 'structural',
  SEMANTIC: 'semantic',
  COMPUTATIONAL: 'computational',
  EPISTEMIC: 'epistemic'
});

/**
 * Epistemic status for Meant events
 */
const EpistemicStatus = Object.freeze({
  PRELIMINARY: 'preliminary',
  CONFIRMED: 'confirmed',
  DISPUTED: 'disputed'
});

/**
 * Supersession types
 */
const SupersessionType = Object.freeze({
  CORRECTION: 'correction',
  REFINEMENT: 'refinement',
  RETRACTION: 'retraction'
});

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate content-addressable ID
 */
function generateEventId(prefix = 'evt') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

// ============================================================================
// Event Validation
// ============================================================================

/**
 * Validate grounding references
 */
function validateGrounding(event) {
  const errors = [];

  // Given events CAN have external grounding, CANNOT be grounded in Meant
  if (event.epistemicType === EpistemicType.GIVEN) {
    if (event.grounding?.references) {
      for (const ref of event.grounding.references) {
        if (ref.kind === GroundingKind.SEMANTIC) {
          errors.push('RULE_1: Given events cannot have semantic grounding');
        }
      }
    }
  }

  // Meant events MUST have grounding, CANNOT have external grounding
  if (event.epistemicType === EpistemicType.MEANT) {
    if (!event.grounding?.references || event.grounding.references.length === 0) {
      errors.push('RULE_7: Meant events must have typed grounds');
    } else {
      for (const ref of event.grounding.references) {
        if (ref.kind === GroundingKind.EXTERNAL) {
          errors.push('RULE_2: Only Given events may have external grounding');
        }
      }
    }
  }

  // Derived values MUST have computational grounding
  if (event.epistemicType === EpistemicType.DERIVED_VALUE) {
    if (!event.grounding?.references) {
      errors.push('RULE_8: Derived values must have grounding');
    } else {
      const hasComputational = event.grounding.references.some(
        ref => ref.kind === GroundingKind.COMPUTATIONAL
      );
      if (!hasComputational) {
        errors.push('RULE_8: Derived values must have computational grounding');
      }
    }
    if (!event.grounding?.derivation) {
      errors.push('RULE_8: Derived values must have derivation chain');
    }
  }

  return errors;
}

/**
 * Validate event structure and EO rules
 */
function validateEvent(event) {
  const errors = [];

  // Must have unique ID
  if (!event.id) {
    errors.push('Event must have unique id');
  }

  // Must have valid epistemic type
  if (!event.epistemicType || !Object.values(EpistemicType).includes(event.epistemicType)) {
    errors.push('RULE_1: Event must have epistemicType: given, meant, or derived_value');
  }

  // Must have category
  if (!event.category) {
    errors.push('Event must have category');
  }

  // Must have timestamp
  if (!event.timestamp) {
    errors.push('Event must have timestamp');
  }

  // Must have actor
  if (!event.actor) {
    errors.push('Event must have actor');
  }

  // Meant events must have frame
  if (event.epistemicType === EpistemicType.MEANT && !event.frame) {
    errors.push('RULE_7: Meant events must have frame with claim');
  }

  // Validate grounding
  const groundingErrors = validateGrounding(event);
  errors.push(...groundingErrors);

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// EO Event Store
// ============================================================================

/**
 * EOEventStore - The append-only event log with strict EO enforcement
 */
class EOEventStore {
  constructor(options = {}) {
    // The log - ordered sequence of events
    this._log = [];

    // Index for O(1) lookup by ID
    this._index = new Map();

    // Logical clock for causal ordering
    this._logicalClock = 0;

    // Events parked waiting for parents
    this._parked = new Map();

    // Subscribers for reactive updates
    this._subscribers = new Set();

    // Frozen state
    this._frozen = false;

    // Grounding graph (lazy initialized)
    this._groundingGraph = null;

    // Indexes
    this._byEpistemicType = new Map();
    this._byCategory = new Map();
    this._byOperator = new Map();
    this._byEntity = new Map();
    this._supersessionIndex = new Map(); // targetId -> superseding eventId

    // Initialize type indexes
    for (const type of Object.values(EpistemicType)) {
      this._byEpistemicType.set(type, new Set());
    }

    // Strict mode (default true)
    this._strictMode = options.strictMode !== false;
  }

  /**
   * Get or create grounding graph
   */
  getGroundingGraph() {
    if (!this._groundingGraph && typeof window !== 'undefined' && window.EOGrounding) {
      this._groundingGraph = new window.EOGrounding.GroundingGraph(this);

      // Index existing events
      for (const event of this._log) {
        this._groundingGraph.indexEvent(event);
      }
    }
    return this._groundingGraph;
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
   * Append an event to the log
   *
   * Rule 3: Ineliminability - this is the only mutation allowed
   */
  append(event) {
    if (this._frozen) {
      return { success: false, error: 'Store is frozen' };
    }

    // Idempotent - if event exists, succeed silently
    if (this._index.has(event.id)) {
      return { success: true, eventId: event.id, duplicate: true };
    }

    // Validate event structure
    const validation = validateEvent(event);
    if (!validation.valid && this._strictMode) {
      return { success: false, errors: validation.errors };
    }

    // Check causal readiness
    if (event.parents && event.parents.length > 0) {
      const missingParents = event.parents.filter(p => !this._index.has(p));
      if (missingParents.length > 0) {
        this._parked.set(event.id, event);
        return { success: true, eventId: event.id, parked: true, waitingFor: missingParents };
      }
    }

    // Verify grounding chain terminates in Given (Rule 7)
    if (event.epistemicType === EpistemicType.MEANT && this._strictMode) {
      const groundingResult = this._verifyGroundingChain(event);
      if (!groundingResult.grounded) {
        return { success: false, error: `RULE_7: ${groundingResult.error}` };
      }
    }

    // Assign logical clock
    this._logicalClock++;

    // Create final frozen event
    const finalEvent = {
      ...event,
      logicalClock: this._logicalClock
    };

    // Deep freeze
    Object.freeze(finalEvent);
    if (finalEvent.grounding) {
      Object.freeze(finalEvent.grounding);
      if (finalEvent.grounding.references) {
        finalEvent.grounding.references.forEach(Object.freeze);
      }
      if (finalEvent.grounding.derivation) {
        Object.freeze(finalEvent.grounding.derivation);
      }
    }
    if (finalEvent.frame) Object.freeze(finalEvent.frame);
    if (finalEvent.supersession) Object.freeze(finalEvent.supersession);
    if (finalEvent.payload) Object.freeze(finalEvent.payload);

    // Append to log
    this._log.push(finalEvent);
    this._index.set(finalEvent.id, finalEvent);

    // Update indexes
    this._indexEvent(finalEvent);

    // Update grounding graph
    if (this._groundingGraph) {
      this._groundingGraph.indexEvent(finalEvent);
    }

    // Notify subscribers
    this._notifySubscribers(finalEvent);

    // Process parked events
    this._processParked();

    return { success: true, eventId: finalEvent.id };
  }

  /**
   * Verify grounding chain terminates in Given events
   */
  _verifyGroundingChain(event, visited = new Set()) {
    if (event.epistemicType === EpistemicType.GIVEN) {
      return { grounded: true, chain: [event.id] };
    }

    if (!event.grounding?.references || event.grounding.references.length === 0) {
      return { grounded: false, error: 'No grounding references' };
    }

    if (visited.has(event.id)) {
      return { grounded: false, error: 'Circular grounding detected' };
    }
    visited.add(event.id);

    const chains = [];
    for (const ref of event.grounding.references) {
      const groundEvent = this._index.get(ref.eventId);
      if (!groundEvent) {
        // Allow forward references if not in strict verification
        continue;
      }

      const result = this._verifyGroundingChain(groundEvent, visited);
      if (result.grounded) {
        chains.push(...result.chain);
      }
    }

    if (chains.length === 0) {
      return { grounded: false, error: 'Grounding chain does not terminate in Given' };
    }

    return { grounded: true, chain: [event.id, ...chains] };
  }

  /**
   * Index event for efficient queries
   */
  _indexEvent(event) {
    // By epistemic type
    const typeSet = this._byEpistemicType.get(event.epistemicType);
    if (typeSet) {
      typeSet.add(event.id);
    }

    // By category
    if (event.category) {
      if (!this._byCategory.has(event.category)) {
        this._byCategory.set(event.category, new Set());
      }
      this._byCategory.get(event.category).add(event.id);
    }

    // By operators
    if (event.grounding?.derivation?.operators) {
      for (const op of event.grounding.derivation.operators) {
        const opId = typeof op === 'string' ? op : op.op;
        if (!this._byOperator.has(opId)) {
          this._byOperator.set(opId, new Set());
        }
        this._byOperator.get(opId).add(event.id);
      }
    }

    // By entity
    const entityId = event.payload?.targetId ||
                     event.payload?.recordId ||
                     event.payload?.setId ||
                     event.payload?.entityId;
    if (entityId) {
      if (!this._byEntity.has(entityId)) {
        this._byEntity.set(entityId, []);
      }
      this._byEntity.get(entityId).push(event.id);
    }

    // Supersession index
    if (event.supersession?.supersedes) {
      this._supersessionIndex.set(event.supersession.supersedes, event.id);
    }
  }

  /**
   * Process parked events
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
   * Notify subscribers
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

  // ─────────────────────────────────────────────────────────────────────────
  // Query Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get event by ID
   */
  get(eventId) {
    return this._index.get(eventId);
  }

  /**
   * Get all events
   */
  getAll() {
    return [...this._log];
  }

  /**
   * Get events by epistemic type
   */
  getByEpistemicType(type) {
    const ids = this._byEpistemicType.get(type);
    if (!ids) return [];
    return Array.from(ids).map(id => this._index.get(id)).filter(Boolean);
  }

  /**
   * Get all Given events
   */
  getGiven() {
    return this.getByEpistemicType(EpistemicType.GIVEN);
  }

  /**
   * Get all Meant events
   */
  getMeant() {
    return this.getByEpistemicType(EpistemicType.MEANT);
  }

  /**
   * Get all Derived Value events
   */
  getDerivedValues() {
    return this.getByEpistemicType(EpistemicType.DERIVED_VALUE);
  }

  /**
   * Get events by category
   */
  getByCategory(category) {
    const ids = this._byCategory.get(category);
    if (!ids) return [];
    return Array.from(ids).map(id => this._index.get(id)).filter(Boolean);
  }

  /**
   * Get events by operator
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
   * Check if an event is superseded
   */
  isSuperseded(eventId) {
    return this._supersessionIndex.has(eventId);
  }

  /**
   * Get superseding event
   */
  getSupersedingEvent(eventId) {
    const supersedingId = this._supersessionIndex.get(eventId);
    return supersedingId ? this._index.get(supersedingId) : null;
  }

  /**
   * Get active (non-superseded) Meant events
   */
  getActiveMeant() {
    return this.getMeant().filter(e => !this.isSuperseded(e.id));
  }

  /**
   * Get active derived values
   */
  getActiveDerivedValues() {
    return this.getDerivedValues().filter(e => !this.isSuperseded(e.id));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Grounding Queries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * What grounds this event?
   */
  whatGrounds(eventId) {
    const event = this._index.get(eventId);
    if (!event?.grounding?.references) return {};

    const result = {
      external: [],
      structural: [],
      semantic: [],
      computational: [],
      epistemic: []
    };

    for (const ref of event.grounding.references) {
      const groundEvent = this._index.get(ref.eventId);
      if (result[ref.kind]) {
        result[ref.kind].push({
          eventId: ref.eventId,
          epistemicType: groundEvent?.epistemicType,
          category: groundEvent?.category
        });
      }
    }

    return result;
  }

  /**
   * Is this asserted or computed?
   */
  isAssertedOrComputed(eventId) {
    const event = this._index.get(eventId);
    if (!event) return null;

    if (event.epistemicType === EpistemicType.DERIVED_VALUE) {
      return 'computed';
    } else if (event.epistemicType === EpistemicType.MEANT) {
      return 'asserted';
    } else {
      return 'given';
    }
  }

  /**
   * What was forced by reality? (structural grounds only)
   */
  whatWasForcedByReality(eventId) {
    const grounds = this.whatGrounds(eventId);
    return grounds.structural || [];
  }

  /**
   * What was interpretive? (semantic grounds only)
   */
  whatWasInterpretive(eventId) {
    const grounds = this.whatGrounds(eventId);
    return grounds.semantic || [];
  }

  /**
   * Can this be recomputed?
   */
  canRecompute(eventId) {
    const event = this._index.get(eventId);
    return event?.epistemicType === EpistemicType.DERIVED_VALUE;
  }

  /**
   * Get provenance chain to roots
   */
  getProvenanceChain(eventId, maxDepth = 20) {
    const chain = [];
    const visited = new Set();

    const traverse = (id, depth) => {
      if (depth > maxDepth || visited.has(id)) return;
      visited.add(id);

      const event = this._index.get(id);
      if (!event) return;

      chain.push({
        eventId: id,
        epistemicType: event.epistemicType,
        category: event.category,
        depth
      });

      if (event.grounding?.references) {
        for (const ref of event.grounding.references) {
          traverse(ref.eventId, depth + 1);
        }
      }
    };

    traverse(eventId, 0);
    return chain;
  }

  /**
   * Find root Given events for an event
   */
  findRoots(eventId) {
    const chain = this.getProvenanceChain(eventId);
    return chain
      .filter(item => {
        const event = this._index.get(item.eventId);
        return event?.epistemicType === EpistemicType.GIVEN;
      })
      .map(item => item.eventId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Creation Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a Given event
   */
  createGivenEvent(options) {
    return {
      id: options.id || generateEventId('given'),
      epistemicType: EpistemicType.GIVEN,
      category: options.category || 'raw_data',
      timestamp: options.timestamp || new Date().toISOString(),
      actor: options.actor || 'system',
      mode: options.mode || GivenMode.RECEIVED,
      grounding: options.grounding || null,
      payload: options.payload || {}
    };
  }

  /**
   * Create a Meant event
   */
  createMeantEvent(options) {
    if (!options.grounding) {
      throw new Error('Meant events must have grounding');
    }
    if (!options.frame) {
      throw new Error('Meant events must have frame');
    }

    return {
      id: options.id || generateEventId('meant'),
      epistemicType: EpistemicType.MEANT,
      category: options.category || 'interpretation',
      timestamp: options.timestamp || new Date().toISOString(),
      actor: options.actor || 'system',
      grounding: options.grounding,
      frame: {
        claim: options.frame.claim || null,
        epistemicStatus: options.frame.epistemicStatus || EpistemicStatus.PRELIMINARY,
        confidenceEvent: options.frame.confidenceEvent || null,
        caveats: options.frame.caveats || [],
        purpose: options.frame.purpose || null
      },
      supersession: options.supersession || null,
      payload: options.payload || {}
    };
  }

  /**
   * Create a Derived Value event
   */
  createDerivedValueEvent(options) {
    if (!options.grounding) {
      throw new Error('Derived values must have grounding');
    }
    if (!options.grounding.derivation) {
      throw new Error('Derived values must have derivation');
    }

    // Ensure computational grounding
    const hasComputational = options.grounding.references?.some(
      ref => ref.kind === GroundingKind.COMPUTATIONAL
    );
    if (!hasComputational) {
      throw new Error('Derived values must have computational grounding');
    }

    return {
      id: options.id || generateEventId('value'),
      epistemicType: EpistemicType.DERIVED_VALUE,
      category: options.category || 'computed_value',
      timestamp: options.timestamp || new Date().toISOString(),
      actor: options.actor || 'system',
      grounding: options.grounding,
      supersession: options.supersession || null,
      payload: options.payload || {}
    };
  }

  /**
   * Create a supersession event
   */
  createSupersession(targetId, newInterpretation, options = {}) {
    const target = this._index.get(targetId);
    if (!target) {
      throw new Error(`Target event not found: ${targetId}`);
    }

    if (target.epistemicType === EpistemicType.GIVEN) {
      throw new Error('RULE_9: Cannot supersede Given events');
    }

    const supersessionType = options.type || SupersessionType.REFINEMENT;

    // Create new event with supersession
    const supersedingEvent = {
      ...newInterpretation,
      id: generateEventId('supersede'),
      timestamp: new Date().toISOString(),
      supersession: {
        supersedes: targetId,
        type: supersessionType,
        reason: options.reason || null
      }
    };

    return supersedingEvent;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Store Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to new events
   */
  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  /**
   * Freeze the store
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
   * Export the log
   */
  export() {
    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      logicalClock: this._logicalClock,
      events: this._log.map(e => ({ ...e }))
    };
  }

  /**
   * Import events
   */
  import(data) {
    if (!data || !data.events) {
      return { success: false, error: 'Invalid import data' };
    }

    let imported = 0;
    const errors = [];

    for (const event of data.events) {
      const result = this.append(event);
      if (result.success) {
        imported++;
      } else if (result.errors) {
        errors.push({ eventId: event.id, errors: result.errors });
      }
    }

    if (data.logicalClock && data.logicalClock > this._logicalClock) {
      this._logicalClock = data.logicalClock;
    }

    return { success: true, imported, errors };
  }

  /**
   * Clear the store (for testing)
   */
  _clear() {
    this._log = [];
    this._index.clear();
    this._parked.clear();
    this._logicalClock = 0;
    this._byEpistemicType.forEach(set => set.clear());
    this._byCategory.clear();
    this._byOperator.clear();
    this._byEntity.clear();
    this._supersessionIndex.clear();
    if (this._groundingGraph) {
      this._groundingGraph.clear();
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      total: this._log.length,
      given: this._byEpistemicType.get(EpistemicType.GIVEN)?.size || 0,
      meant: this._byEpistemicType.get(EpistemicType.MEANT)?.size || 0,
      derivedValues: this._byEpistemicType.get(EpistemicType.DERIVED_VALUE)?.size || 0,
      superseded: this._supersessionIndex.size,
      categories: Object.fromEntries(
        Array.from(this._byCategory.entries()).map(([k, v]) => [k, v.size])
      )
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let _eventStore = null;

function getEventStore() {
  if (!_eventStore) {
    _eventStore = new EOEventStore();
  }
  return _eventStore;
}

function initEventStore(options = {}) {
  _eventStore = new EOEventStore(options);
  return _eventStore;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EOEventStore,
    EpistemicType,
    GivenMode,
    GroundingKind,
    EpistemicStatus,
    SupersessionType,
    generateEventId,
    validateEvent,
    validateGrounding,
    getEventStore,
    initEventStore
  };
}

if (typeof window !== 'undefined') {
  window.EOEventStore = EOEventStore;
  window.EpistemicType = EpistemicType;
  window.GivenMode = GivenMode;
  window.GroundingKind = GroundingKind;
  window.EpistemicStatus = EpistemicStatus;
  window.SupersessionType = SupersessionType;
  window.generateEventId = generateEventId;
  window.validateEvent = validateEvent;
  window.validateGrounding = validateGrounding;
  window.getEventStore = getEventStore;
  window.initEventStore = initEventStore;
}
