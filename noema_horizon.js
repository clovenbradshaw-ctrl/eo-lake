/**
 * EO Horizon-Lattice - Perspectival Access Control
 *
 * Implements Rules 4, 5, 6 from the Experience Engine specification:
 *
 * Rule 4: Perspectivality (Anti-Omniscience)
 *   - All memory availability is mediated by horizon
 *   - No memory is universally accessible
 *   - There is no God's-eye view
 *
 * Rule 5: Restrictivity (Foreclosure)
 *   - Refinement of horizon may only restrict availability
 *   - Focus forecloses; narrowing cannot conjure new access
 *
 * Rule 6: Coherence (Locality)
 *   - Valid inference at broad horizon remains valid at refinements
 *   - Valid inference survives refinement
 *
 * The Horizon-Lattice (H, ⊑, ⊓) is a bounded meet-semilattice where:
 *   - ⊑ is the refinement ordering (broader to narrower)
 *   - ⊓ is the meet operation (greatest common refinement)
 *   - ⊤_H is the maximal horizon (broadest context)
 */

/**
 * Horizon types for common access patterns
 */
const HorizonType = Object.freeze({
  GLOBAL: 'global',           // Broadest - rarely used directly
  WORKSPACE: 'workspace',     // Scoped to a workspace
  PROJECT: 'project',         // Scoped to a project within workspace
  SESSION: 'session',         // Scoped to a user session
  VIEW: 'view',               // Scoped to a specific view/frame
  MOMENT: 'moment'            // Most refined - a specific point in time
});

/**
 * A Horizon defines a perspectival context that filters access to events
 */
class Horizon {
  /**
   * @param {Object} params
   * @param {string} params.id - Unique horizon identifier
   * @param {string} params.type - One of HorizonType
   * @param {string} params.name - Human-readable name
   * @param {string[]} params.workspaces - Accessible workspace IDs
   * @param {string[]} params.actors - Accessible actor IDs (empty = all in scope)
   * @param {string[]} params.frames - Accessible frame purposes (empty = all)
   * @param {Object} params.timeRange - { start, end } ISO timestamps
   * @param {string[]} params.tags - Tags that events must have
   * @param {string} params.parentId - ID of broader parent horizon
   */
  constructor(params) {
    this.id = params.id;
    this.type = params.type || HorizonType.WORKSPACE;
    this.name = params.name || params.id;
    this.workspaces = params.workspaces || [];
    this.actors = params.actors || [];
    this.frames = params.frames || [];
    this.timeRange = params.timeRange || null;
    this.tags = params.tags || [];
    this.parentId = params.parentId || null;

    // Freeze to prevent mutation
    Object.freeze(this.workspaces);
    Object.freeze(this.actors);
    Object.freeze(this.frames);
    Object.freeze(this.tags);
    if (this.timeRange) Object.freeze(this.timeRange);
    Object.freeze(this);
  }

  /**
   * Create a refinement of this horizon (narrower scope)
   * Rule 5: Refinement can only restrict, never expand
   */
  refine(refinements) {
    const refined = {
      id: refinements.id || `${this.id}_refined_${Date.now()}`,
      type: this._narrowerType(refinements.type),
      name: refinements.name || `${this.name} (refined)`,
      parentId: this.id,

      // Refinement can only narrow workspace access
      workspaces: refinements.workspaces
        ? this.workspaces.filter(w => refinements.workspaces.includes(w))
        : [...this.workspaces],

      // Refinement can only narrow actor access
      actors: refinements.actors
        ? (this.actors.length === 0
            ? refinements.actors
            : this.actors.filter(a => refinements.actors.includes(a)))
        : [...this.actors],

      // Refinement can only narrow frame access
      frames: refinements.frames
        ? (this.frames.length === 0
            ? refinements.frames
            : this.frames.filter(f => refinements.frames.includes(f)))
        : [...this.frames],

      // Refinement can only narrow time range
      timeRange: this._narrowTimeRange(refinements.timeRange),

      // Refinement can only add tags (more specific)
      tags: [...new Set([...this.tags, ...(refinements.tags || [])])]
    };

    return new Horizon(refined);
  }

  /**
   * Get a narrower horizon type
   */
  _narrowerType(requestedType) {
    const order = [
      HorizonType.GLOBAL,
      HorizonType.WORKSPACE,
      HorizonType.PROJECT,
      HorizonType.SESSION,
      HorizonType.VIEW,
      HorizonType.MOMENT
    ];

    const currentIdx = order.indexOf(this.type);
    const requestedIdx = order.indexOf(requestedType);

    // Can only move to same or narrower type
    if (requestedIdx > currentIdx) {
      return requestedType;
    }
    return this.type;
  }

  /**
   * Narrow a time range (intersection)
   */
  _narrowTimeRange(newRange) {
    if (!this.timeRange && !newRange) return null;
    if (!this.timeRange) return newRange;
    if (!newRange) return { ...this.timeRange };

    const start = this.timeRange.start && newRange.start
      ? (this.timeRange.start > newRange.start ? this.timeRange.start : newRange.start)
      : (this.timeRange.start || newRange.start);

    const end = this.timeRange.end && newRange.end
      ? (this.timeRange.end < newRange.end ? this.timeRange.end : newRange.end)
      : (this.timeRange.end || newRange.end);

    return { start, end };
  }

  /**
   * Check if this horizon is a refinement of another
   * h1 ⊑ h2 means h1 is broader than h2
   */
  isRefinementOf(other) {
    // Check type ordering
    const order = [
      HorizonType.GLOBAL,
      HorizonType.WORKSPACE,
      HorizonType.PROJECT,
      HorizonType.SESSION,
      HorizonType.VIEW,
      HorizonType.MOMENT
    ];

    const thisIdx = order.indexOf(this.type);
    const otherIdx = order.indexOf(other.type);

    if (thisIdx < otherIdx) return false; // This is broader, not a refinement

    // Check workspaces (refinement must be subset)
    if (other.workspaces.length > 0) {
      if (!this.workspaces.every(w => other.workspaces.includes(w))) {
        return false;
      }
    }

    // Check actors
    if (other.actors.length > 0 && this.actors.length > 0) {
      if (!this.actors.every(a => other.actors.includes(a))) {
        return false;
      }
    }

    // Check frames
    if (other.frames.length > 0 && this.frames.length > 0) {
      if (!this.frames.every(f => other.frames.includes(f))) {
        return false;
      }
    }

    // Check time range
    if (other.timeRange && this.timeRange) {
      if (this.timeRange.start < other.timeRange.start) return false;
      if (this.timeRange.end > other.timeRange.end) return false;
    }

    // Check tags (refinement must have all parent tags plus possibly more)
    if (!other.tags.every(t => this.tags.includes(t))) {
      return false;
    }

    return true;
  }
}

/**
 * The Horizon Gate - mediates all access to events
 *
 * Rule 4: Nothing is retrieved except through the gate
 */
class HorizonGate {
  /**
   * @param {Horizon} horizon - The active horizon
   * @param {EOEventStore} eventStore - The event store to gate
   */
  constructor(horizon, eventStore) {
    this.horizon = horizon;
    this.eventStore = eventStore;
  }

  /**
   * Check if an event is available through this gate
   * @returns {boolean}
   */
  isAvailable(event) {
    // Check workspace
    if (this.horizon.workspaces.length > 0) {
      if (!event.context?.workspace) return false;
      if (!this.horizon.workspaces.includes(event.context.workspace)) return false;
    }

    // Check actor
    if (this.horizon.actors.length > 0) {
      if (!this.horizon.actors.includes(event.actor)) return false;
    }

    // Check frame (for Meant events)
    if (this.horizon.frames.length > 0 && event.frame) {
      if (!this.horizon.frames.includes(event.frame.purpose)) return false;
    }

    // Check time range
    if (this.horizon.timeRange) {
      const eventTime = new Date(event.timestamp).getTime();
      if (this.horizon.timeRange.start) {
        const start = new Date(this.horizon.timeRange.start).getTime();
        if (eventTime < start) return false;
      }
      if (this.horizon.timeRange.end) {
        const end = new Date(this.horizon.timeRange.end).getTime();
        if (eventTime > end) return false;
      }
    }

    // Check tags
    if (this.horizon.tags.length > 0) {
      const eventTags = event.payload?.tags || [];
      if (!this.horizon.tags.every(t => eventTags.includes(t))) return false;
    }

    return true;
  }

  /**
   * Get all available events through this gate
   */
  getAvailable() {
    return this.eventStore.getAll().filter(e => this.isAvailable(e));
  }

  /**
   * Get available Given events
   */
  getAvailableGiven() {
    return this.eventStore.getGiven().filter(e => this.isAvailable(e));
  }

  /**
   * Get available Meant events
   */
  getAvailableMeant() {
    return this.eventStore.getMeant().filter(e => this.isAvailable(e));
  }

  /**
   * Get a specific event if available
   */
  get(eventId) {
    const event = this.eventStore.get(eventId);
    if (event && this.isAvailable(event)) {
      return event;
    }
    return null;
  }

  /**
   * Check if a derivation is valid within this horizon
   * Rule 6: Valid inference at broader horizon survives refinement
   */
  isValidDerivation(premises, conclusion) {
    // All premises must be available
    for (const premise of premises) {
      if (!this.isAvailable(premise)) {
        return { valid: false, reason: 'Premise not available in horizon' };
      }
    }

    // Conclusion must have provenance in available premises
    if (conclusion.provenance) {
      const premiseIds = new Set(premises.map(p => p.id));
      for (const provId of conclusion.provenance) {
        if (!premiseIds.has(provId)) {
          // Check if the provenance event is available
          const provEvent = this.get(provId);
          if (!provEvent) {
            return { valid: false, reason: 'Provenance not available in horizon' };
          }
        }
      }
    }

    return { valid: true };
  }
}

/**
 * The Horizon-Lattice manages the partially ordered set of horizons
 */
class HorizonLattice {
  constructor() {
    // All horizons indexed by ID
    this._horizons = new Map();

    // The top element (broadest horizon)
    this._top = new Horizon({
      id: '_TOP_',
      type: HorizonType.GLOBAL,
      name: 'Global',
      workspaces: [],
      actors: [],
      frames: []
    });
    this._horizons.set(this._top.id, this._top);
  }

  /**
   * Get the top (broadest) horizon
   */
  get top() {
    return this._top;
  }

  /**
   * Add a horizon to the lattice
   */
  add(horizon) {
    if (!(horizon instanceof Horizon)) {
      horizon = new Horizon(horizon);
    }
    this._horizons.set(horizon.id, horizon);
    return horizon;
  }

  /**
   * Get a horizon by ID
   */
  get(horizonId) {
    return this._horizons.get(horizonId);
  }

  /**
   * Get all horizons
   */
  getAll() {
    return Array.from(this._horizons.values());
  }

  /**
   * Compute the meet (greatest common refinement) of two horizons
   * This is the most specific horizon that is broader than both
   */
  meet(h1, h2) {
    // Find common ancestor through parent chain
    const ancestors1 = this._getAncestors(h1.id);
    const ancestors2 = this._getAncestors(h2.id);

    // Find first common ancestor
    for (const a1 of ancestors1) {
      if (ancestors2.includes(a1)) {
        return this.get(a1);
      }
    }

    // If no common ancestor, return top
    return this._top;
  }

  /**
   * Get ancestor chain for a horizon
   */
  _getAncestors(horizonId) {
    const ancestors = [horizonId];
    let current = this.get(horizonId);

    while (current && current.parentId) {
      ancestors.push(current.parentId);
      current = this.get(current.parentId);
    }

    ancestors.push(this._top.id);
    return ancestors;
  }

  /**
   * Check refinement ordering: h1 ⊑ h2 (h1 broader than or equal to h2)
   */
  isBroaderOrEqual(h1Id, h2Id) {
    if (h1Id === h2Id) return true;

    const ancestors = this._getAncestors(h2Id);
    return ancestors.includes(h1Id);
  }

  /**
   * Create a gate for a specific horizon
   */
  createGate(horizonId, eventStore) {
    const horizon = this.get(horizonId);
    if (!horizon) {
      throw new Error(`Horizon not found: ${horizonId}`);
    }
    return new HorizonGate(horizon, eventStore);
  }

  /**
   * Verify Rule 5: Refinement only restricts availability
   */
  verifyRestrictivity(parentId, childId, eventStore) {
    const parent = this.get(parentId);
    const child = this.get(childId);

    if (!parent || !child) {
      return { valid: false, error: 'Horizon not found' };
    }

    const parentGate = new HorizonGate(parent, eventStore);
    const childGate = new HorizonGate(child, eventStore);

    const parentAvailable = new Set(parentGate.getAvailable().map(e => e.id));
    const childAvailable = childGate.getAvailable();

    // All child-available events must be parent-available
    for (const event of childAvailable) {
      if (!parentAvailable.has(event.id)) {
        return {
          valid: false,
          error: `Rule 5 violation: Event ${event.id} available in child but not parent`,
          violatingEvent: event.id
        };
      }
    }

    return { valid: true };
  }

  /**
   * Export for persistence
   */
  export() {
    return {
      horizons: Array.from(this._horizons.values()).map(h => ({
        id: h.id,
        type: h.type,
        name: h.name,
        workspaces: [...h.workspaces],
        actors: [...h.actors],
        frames: [...h.frames],
        timeRange: h.timeRange ? { ...h.timeRange } : null,
        tags: [...h.tags],
        parentId: h.parentId
      }))
    };
  }

  /**
   * Import from persistence
   */
  import(data) {
    if (!data || !data.horizons) return;

    for (const h of data.horizons) {
      if (h.id !== '_TOP_') {
        this.add(new Horizon(h));
      }
    }
  }
}

// Singleton instance
let _horizonLattice = null;

function getHorizonLattice() {
  if (!_horizonLattice) {
    _horizonLattice = new HorizonLattice();
  }
  return _horizonLattice;
}

function initHorizonLattice() {
  _horizonLattice = new HorizonLattice();
  return _horizonLattice;
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HorizonType,
    Horizon,
    HorizonGate,
    HorizonLattice,
    getHorizonLattice,
    initHorizonLattice
  };
}

if (typeof window !== 'undefined') {
  window.HorizonType = HorizonType;
  window.Horizon = Horizon;
  window.HorizonGate = HorizonGate;
  window.HorizonLattice = HorizonLattice;
  window.getHorizonLattice = getHorizonLattice;
  window.initHorizonLattice = initHorizonLattice;
}
