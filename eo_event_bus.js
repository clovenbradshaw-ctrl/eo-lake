/**
 * EO Event Bus - Reactive Updates System
 *
 * A centralized event bus for reactive UI updates and inter-module communication.
 * All events flow through this bus, enabling decoupled architecture while
 * maintaining compliance with the Nine Rules.
 *
 * COMPLIANCE NOTES:
 * - This is a DERIVED system - it reacts to the authoritative event log
 * - It does NOT store state - the event log is the only source of truth
 * - All subscriptions are for notification, not for creating new Given events
 */

/**
 * Event types for the bus
 */
const BusEventType = Object.freeze({
  // Store events
  GIVEN_RECORDED: 'given_recorded',
  MEANT_RECORDED: 'meant_recorded',
  TOMBSTONE_CREATED: 'tombstone_created',
  SUPERSESSION_CREATED: 'supersession_created',

  // Derived state events
  ENTITY_CREATED: 'entity_created',
  ENTITY_UPDATED: 'entity_updated',
  ENTITY_DELETED: 'entity_deleted',
  VIEW_UPDATED: 'view_updated',

  // UI events
  VIEW_CHANGED: 'view_changed',
  HORIZON_CHANGED: 'horizon_changed',
  SELECTION_CHANGED: 'selection_changed',
  MODAL_OPENED: 'modal_opened',
  MODAL_CLOSED: 'modal_closed',

  // Compliance events
  COMPLIANCE_CHECK: 'compliance_check',
  RULE_VIOLATION: 'rule_violation',

  // Sync events
  SYNC_STARTED: 'sync_started',
  SYNC_COMPLETED: 'sync_completed',
  SYNC_FAILED: 'sync_failed',
  SYNC_CONFLICT: 'sync_conflict',

  // Graph events
  NODE_SELECTED: 'node_selected',
  NODE_EXPANDED: 'node_expanded',
  NODE_COLLAPSED: 'node_collapsed',
  EDGE_SELECTED: 'edge_selected',
  GRAPH_LAYOUT_CHANGED: 'graph_layout_changed',

  // Workbench events
  FIELD_UPDATED: 'field_updated',
  ROW_SELECTED: 'row_selected',
  FILTER_CHANGED: 'filter_changed',
  SORT_CHANGED: 'sort_changed',

  // Ghost events
  ENTITY_GHOSTED: 'entity_ghosted',
  ENTITY_RESURRECTED: 'entity_resurrected',
  HAUNT_DETECTED: 'haunt_detected',
  HAUNT_RESOLVED: 'haunt_resolved',
  GHOST_DORMANT: 'ghost_dormant',
  GHOST_EXPIRED: 'ghost_expired'
});

/**
 * Priority levels for event handlers
 */
const HandlerPriority = Object.freeze({
  CRITICAL: 0,    // System-level handlers (compliance, persistence)
  HIGH: 1,        // State derivation
  NORMAL: 2,      // UI updates
  LOW: 3          // Analytics, logging
});

/**
 * Event wrapper with metadata
 */
class BusEvent {
  constructor(type, payload, options = {}) {
    this.type = type;
    this.payload = payload;
    this.timestamp = new Date().toISOString();
    this.id = this._generateId();
    this.source = options.source || 'unknown';
    this.propagationStopped = false;
  }

  _generateId() {
    return 'bus_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  stopPropagation() {
    this.propagationStopped = true;
  }
}

/**
 * Subscription handle
 */
class Subscription {
  constructor(bus, type, handler, options) {
    this.bus = bus;
    this.type = type;
    this.handler = handler;
    this.priority = options.priority || HandlerPriority.NORMAL;
    this.once = options.once || false;
    this.filter = options.filter || null;
    this.active = true;
  }

  unsubscribe() {
    this.active = false;
    this.bus._removeSubscription(this);
  }
}

/**
 * The Event Bus
 */
class EOEventBus {
  constructor() {
    // Subscriptions by event type
    this._subscriptions = new Map();

    // All-event subscribers (for logging, debugging)
    this._wildcardSubscriptions = [];

    // Event history (for debugging, limited size)
    this._history = [];
    this._historyLimit = 100;

    // Pending events (for batching)
    this._pendingEvents = [];
    this._batchMode = false;

    // Stats
    this._stats = {
      eventsEmitted: 0,
      handlersInvoked: 0,
      errors: 0
    };
  }

  /**
   * Subscribe to an event type
   *
   * @param {string} type - Event type or '*' for all events
   * @param {Function} handler - Event handler
   * @param {Object} options - { priority, once, filter }
   * @returns {Subscription}
   */
  on(type, handler, options = {}) {
    if (type === '*') {
      const sub = new Subscription(this, type, handler, options);
      this._wildcardSubscriptions.push(sub);
      this._sortWildcardSubscriptions();
      return sub;
    }

    if (!this._subscriptions.has(type)) {
      this._subscriptions.set(type, []);
    }

    const sub = new Subscription(this, type, handler, options);
    this._subscriptions.get(type).push(sub);
    this._sortSubscriptions(type);

    return sub;
  }

  /**
   * Subscribe for a single event only
   */
  once(type, handler, options = {}) {
    return this.on(type, handler, { ...options, once: true });
  }

  /**
   * Remove a subscription
   */
  off(type, handler) {
    if (type === '*') {
      this._wildcardSubscriptions = this._wildcardSubscriptions.filter(
        s => s.handler !== handler
      );
      return;
    }

    const subs = this._subscriptions.get(type);
    if (subs) {
      this._subscriptions.set(type, subs.filter(s => s.handler !== handler));
    }
  }

  /**
   * Emit an event
   *
   * @param {string} type - Event type
   * @param {*} payload - Event data
   * @param {Object} options - Emission options
   */
  emit(type, payload, options = {}) {
    const event = new BusEvent(type, payload, options);

    if (this._batchMode) {
      this._pendingEvents.push(event);
      return event;
    }

    this._processEvent(event);
    return event;
  }

  /**
   * Process an event through handlers
   */
  _processEvent(event) {
    this._stats.eventsEmitted++;

    // Add to history
    this._history.push({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      source: event.source
    });

    if (this._history.length > this._historyLimit) {
      this._history.shift();
    }

    // Get type-specific handlers
    const handlers = this._subscriptions.get(event.type) || [];

    // Combine with wildcard handlers
    const allHandlers = [...handlers, ...this._wildcardSubscriptions]
      .filter(s => s.active)
      .filter(s => !s.filter || s.filter(event))
      .sort((a, b) => a.priority - b.priority);

    // Invoke handlers
    for (const sub of allHandlers) {
      if (event.propagationStopped) break;

      try {
        sub.handler(event);
        this._stats.handlersInvoked++;

        if (sub.once) {
          sub.unsubscribe();
        }
      } catch (err) {
        this._stats.errors++;
        console.error('EOEventBus: Handler error', err);
      }
    }
  }

  /**
   * Enable batch mode - events are queued until flush
   */
  startBatch() {
    this._batchMode = true;
  }

  /**
   * Flush pending events and exit batch mode
   */
  flushBatch() {
    this._batchMode = false;
    const events = [...this._pendingEvents];
    this._pendingEvents = [];

    for (const event of events) {
      this._processEvent(event);
    }

    return events.length;
  }

  /**
   * Remove a subscription internally
   */
  _removeSubscription(sub) {
    if (sub.type === '*') {
      this._wildcardSubscriptions = this._wildcardSubscriptions.filter(s => s !== sub);
    } else {
      const subs = this._subscriptions.get(sub.type);
      if (subs) {
        this._subscriptions.set(sub.type, subs.filter(s => s !== sub));
      }
    }
  }

  /**
   * Sort subscriptions by priority
   */
  _sortSubscriptions(type) {
    const subs = this._subscriptions.get(type);
    if (subs) {
      subs.sort((a, b) => a.priority - b.priority);
    }
  }

  _sortWildcardSubscriptions() {
    this._wildcardSubscriptions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get event history
   */
  getHistory(limit = 50) {
    return this._history.slice(-limit);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this._stats,
      subscriptionCount: Array.from(this._subscriptions.values())
        .reduce((sum, subs) => sum + subs.length, 0) + this._wildcardSubscriptions.length,
      eventTypes: this._subscriptions.size
    };
  }

  /**
   * Clear all subscriptions
   */
  clear() {
    this._subscriptions.clear();
    this._wildcardSubscriptions = [];
  }

  /**
   * Create a scoped emitter for a specific source
   */
  createEmitter(source) {
    return {
      emit: (type, payload, options = {}) => {
        return this.emit(type, payload, { ...options, source });
      }
    };
  }
}

/**
 * Integration helpers for connecting to the Experience Engine
 */
class EOEventBusIntegration {
  constructor(eventBus, app) {
    this.bus = eventBus;
    this.app = app;
  }

  /**
   * Wire up the event bus to the Experience Engine app
   */
  connect() {
    // Subscribe to store events
    this.app.eventStore.subscribe(event => {
      if (event.epistemicType === 'given') {
        this.bus.emit(BusEventType.GIVEN_RECORDED, event, { source: 'eventStore' });

        if (event.payload?.action === 'tombstone') {
          this.bus.emit(BusEventType.TOMBSTONE_CREATED, event, { source: 'eventStore' });
        }
      } else if (event.epistemicType === 'meant') {
        this.bus.emit(BusEventType.MEANT_RECORDED, event, { source: 'eventStore' });

        if (event.supersedes) {
          this.bus.emit(BusEventType.SUPERSESSION_CREATED, event, { source: 'eventStore' });
        }
      }
    });

    // Subscribe to app events
    this.app.on('compliance', report => {
      this.bus.emit(BusEventType.COMPLIANCE_CHECK, report, { source: 'app' });

      // Emit individual violations
      for (const rule of report.rules) {
        if (!rule.passed) {
          for (const violation of rule.violations) {
            this.bus.emit(BusEventType.RULE_VIOLATION, {
              rule: rule.rule,
              ruleName: rule.name,
              violation
            }, { source: 'compliance' });
          }
        }
      }
    });

    this.app.on('horizon_changed', horizon => {
      this.bus.emit(BusEventType.HORIZON_CHANGED, horizon, { source: 'app' });
    });

    console.log('EOEventBus: Connected to Experience Engine');
  }
}

// Singleton
let _eventBus = null;

function getEventBus() {
  if (!_eventBus) {
    _eventBus = new EOEventBus();
  }
  return _eventBus;
}

function initEventBus() {
  _eventBus = new EOEventBus();
  return _eventBus;
}

function connectEventBus(app) {
  const bus = getEventBus();
  const integration = new EOEventBusIntegration(bus, app);
  integration.connect();
  return bus;
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BusEventType,
    HandlerPriority,
    BusEvent,
    Subscription,
    EOEventBus,
    EOEventBusIntegration,
    getEventBus,
    initEventBus,
    connectEventBus
  };
}

if (typeof window !== 'undefined') {
  window.BusEventType = BusEventType;
  window.HandlerPriority = HandlerPriority;
  window.BusEvent = BusEvent;
  window.Subscription = Subscription;
  window.EOEventBus = EOEventBus;
  window.EOEventBusIntegration = EOEventBusIntegration;
  window.getEventBus = getEventBus;
  window.initEventBus = initEventBus;
  window.connectEventBus = connectEventBus;
}
