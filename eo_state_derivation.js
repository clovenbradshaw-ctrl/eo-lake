/**
 * EO State Derivation - Compute Views from the Event Log
 *
 * AXIOM 0: The append-only log is the database. Everything else is a view.
 *
 * This module computes derived state from the event log. State is never
 * authoritative - it can always be recomputed from the log.
 *
 * State derivation respects:
 * - Rule 4: Perspectivality - state is computed per-horizon
 * - Rule 5: Restrictivity - narrower horizons see less
 * - Rule 7: Groundedness - interpretations trace to raw experience
 * - Rule 8: Determinacy - meaning depends on context
 */

/**
 * A derived entity - computed from Given events
 */
class DerivedEntity {
  constructor(id, type, data, sourceEvents = []) {
    this.id = id;
    this.type = type;
    this.data = data;
    this.sourceEvents = sourceEvents;
    this.version = 0;
    this.lastModified = null;
    this.tombstoned = false;
  }

  /**
   * Apply an event to update this entity
   */
  applyEvent(event) {
    this.version++;
    this.lastModified = event.timestamp;
    this.sourceEvents.push(event.id);

    if (event.payload?.action === 'tombstone' && event.payload?.targetId === this.id) {
      this.tombstoned = true;
      return;
    }

    // Merge payload data
    if (event.payload?.data) {
      this.data = { ...this.data, ...event.payload.data };
    }
  }
}

/**
 * A derived view - a collection of entities for a specific purpose
 */
class DerivedView {
  constructor(id, name, entityType = null, filter = null) {
    this.id = id;
    this.name = name;
    this.entityType = entityType;
    this.filter = filter;
    this.entities = new Map();
    this.sortOrder = [];
    this.version = 0;
  }

  /**
   * Add or update an entity in this view
   */
  setEntity(entity) {
    if (this.entityType && entity.type !== this.entityType) return;
    if (this.filter && !this.filter(entity)) return;

    this.entities.set(entity.id, entity);
    this.version++;

    // Update sort order
    if (!this.sortOrder.includes(entity.id)) {
      this.sortOrder.push(entity.id);
    }
  }

  /**
   * Get all entities in order
   */
  getEntities() {
    return this.sortOrder
      .map(id => this.entities.get(id))
      .filter(e => e && !e.tombstoned);
  }

  /**
   * Get entity by ID
   */
  getEntity(id) {
    const entity = this.entities.get(id);
    return entity && !entity.tombstoned ? entity : null;
  }
}

/**
 * State Derivation Engine
 *
 * Computes derived state from the event log, respecting horizons.
 */
class EOStateDerivation {
  /**
   * @param {EOEventStore} eventStore
   * @param {HorizonLattice} horizonLattice
   */
  constructor(eventStore, horizonLattice) {
    this.eventStore = eventStore;
    this.horizonLattice = horizonLattice;

    // Derived state caches (per horizon)
    this._entityCaches = new Map();
    this._viewCaches = new Map();

    // Derivation rules
    this._derivationRules = new Map();

    // Subscribe to new events for incremental updates
    this.eventStore.subscribe(event => this._handleNewEvent(event));

    // Register default derivation rules
    this._registerDefaultRules();
  }

  /**
   * Register a derivation rule
   *
   * @param {string} eventAction - The action type to match
   * @param {Function} rule - (event, entities, views) => void
   */
  registerRule(eventAction, rule) {
    if (!this._derivationRules.has(eventAction)) {
      this._derivationRules.set(eventAction, []);
    }
    this._derivationRules.get(eventAction).push(rule);
  }

  /**
   * Register default derivation rules
   */
  _registerDefaultRules() {
    // Entity creation
    this.registerRule('entity_create', (event, entities) => {
      const entity = new DerivedEntity(
        event.payload.entityId || event.id,
        event.payload.entityType || 'record',
        event.payload.data || {},
        [event.id]
      );
      entity.lastModified = event.timestamp;
      entities.set(entity.id, entity);
    });

    // Entity update
    this.registerRule('entity_update', (event, entities) => {
      const entityId = event.payload.entityId;
      if (entities.has(entityId)) {
        const entity = entities.get(entityId);
        entity.applyEvent(event);
      }
    });

    // Tombstone
    this.registerRule('tombstone', (event, entities) => {
      const targetId = event.payload.targetId;
      if (entities.has(targetId)) {
        entities.get(targetId).tombstoned = true;
      }
    });

    // Field update
    this.registerRule('field_update', (event, entities) => {
      const entityId = event.payload.entityId;
      const field = event.payload.field;
      const value = event.payload.value;

      if (entities.has(entityId) && field) {
        const entity = entities.get(entityId);
        entity.data[field] = value;
        entity.version++;
        entity.lastModified = event.timestamp;
        entity.sourceEvents.push(event.id);
      }
    });
  }

  /**
   * Handle new event for incremental updates
   */
  _handleNewEvent(event) {
    // Invalidate caches for affected horizons
    // For now, clear all caches (could be optimized)
    this._entityCaches.clear();
    this._viewCaches.clear();
  }

  /**
   * Derive entities for a specific horizon
   *
   * @param {string} horizonId - The horizon to derive for
   * @returns {Map<string, DerivedEntity>}
   */
  deriveEntities(horizonId) {
    // Check cache
    if (this._entityCaches.has(horizonId)) {
      return this._entityCaches.get(horizonId);
    }

    const entities = new Map();
    const gate = this.horizonLattice.createGate(horizonId, this.eventStore);
    const events = gate.getAvailable();

    // Sort events by causal order
    const sorted = this._topologicalSort(events);

    // Apply events to build entities
    for (const event of sorted) {
      const action = event.payload?.action;
      if (action && this._derivationRules.has(action)) {
        for (const rule of this._derivationRules.get(action)) {
          rule(event, entities, this._viewCaches.get(horizonId) || new Map());
        }
      }
    }

    // Cache the result
    this._entityCaches.set(horizonId, entities);

    return entities;
  }

  /**
   * Derive a view for a specific horizon
   *
   * @param {string} horizonId
   * @param {string} viewId
   * @param {Object} options - { entityType, filter, sort }
   */
  deriveView(horizonId, viewId, options = {}) {
    const cacheKey = `${horizonId}:${viewId}`;

    if (this._viewCaches.has(cacheKey)) {
      return this._viewCaches.get(cacheKey);
    }

    const entities = this.deriveEntities(horizonId);
    const view = new DerivedView(viewId, options.name || viewId, options.entityType, options.filter);

    for (const entity of entities.values()) {
      view.setEntity(entity);
    }

    // Apply sorting if specified
    if (options.sort) {
      view.sortOrder.sort((a, b) => {
        const entityA = view.entities.get(a);
        const entityB = view.entities.get(b);
        return options.sort(entityA, entityB);
      });
    }

    this._viewCaches.set(cacheKey, view);

    return view;
  }

  /**
   * Get a summary of the derived state
   */
  getSummary(horizonId) {
    const entities = this.deriveEntities(horizonId);
    const active = Array.from(entities.values()).filter(e => !e.tombstoned);

    const byType = new Map();
    for (const entity of active) {
      if (!byType.has(entity.type)) {
        byType.set(entity.type, 0);
      }
      byType.set(entity.type, byType.get(entity.type) + 1);
    }

    return {
      horizonId,
      totalEntities: entities.size,
      activeEntities: active.length,
      tombstoned: entities.size - active.length,
      byType: Object.fromEntries(byType)
    };
  }

  /**
   * Rebuild all derived state from the event log
   */
  rebuild() {
    this._entityCaches.clear();
    this._viewCaches.clear();

    // Pre-compute for all horizons
    for (const horizon of this.horizonLattice.getAll()) {
      this.deriveEntities(horizon.id);
    }
  }

  /**
   * Verify that state matches what would be derived from log
   */
  verify(horizonId) {
    const cached = this._entityCaches.get(horizonId);
    this._entityCaches.delete(horizonId);

    const fresh = this.deriveEntities(horizonId);

    if (!cached) {
      return { valid: true, cached: false };
    }

    // Compare
    if (cached.size !== fresh.size) {
      return { valid: false, reason: 'Size mismatch' };
    }

    for (const [id, entity] of cached) {
      const freshEntity = fresh.get(id);
      if (!freshEntity) {
        return { valid: false, reason: `Missing entity: ${id}` };
      }
      if (entity.version !== freshEntity.version) {
        return { valid: false, reason: `Version mismatch for ${id}` };
      }
    }

    return { valid: true };
  }

  /**
   * Topological sort respecting causal order
   */
  _topologicalSort(events) {
    const visited = new Set();
    const result = [];
    const eventMap = new Map(events.map(e => [e.id, e]));

    const visit = (event) => {
      if (visited.has(event.id)) return;
      visited.add(event.id);

      if (event.parents) {
        for (const parentId of event.parents) {
          const parent = eventMap.get(parentId);
          if (parent) visit(parent);
        }
      }

      result.push(event);
    };

    for (const event of events) {
      visit(event);
    }

    return result;
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this._entityCaches.clear();
    this._viewCaches.clear();
  }

  /**
   * Get statistics about derivation
   */
  getStats() {
    return {
      cachedHorizons: this._entityCaches.size,
      cachedViews: this._viewCaches.size,
      derivationRules: this._derivationRules.size
    };
  }
}

// Singleton
let _stateDerivation = null;

function getStateDerivation() {
  return _stateDerivation;
}

function initStateDerivation(eventStore, horizonLattice) {
  _stateDerivation = new EOStateDerivation(eventStore, horizonLattice);
  return _stateDerivation;
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DerivedEntity,
    DerivedView,
    EOStateDerivation,
    getStateDerivation,
    initStateDerivation
  };
}

if (typeof window !== 'undefined') {
  window.DerivedEntity = DerivedEntity;
  window.DerivedView = DerivedView;
  window.EOStateDerivation = EOStateDerivation;
  window.getStateDerivation = getStateDerivation;
  window.initStateDerivation = initStateDerivation;
}
