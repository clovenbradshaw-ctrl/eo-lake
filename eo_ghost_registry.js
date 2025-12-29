/**
 * EO Ghost Registry - Deleted Data That Haunts
 *
 * EO PHILOSOPHY:
 * Deletion is not erasure - it's a transformation into ghost state.
 * Ghosts are first-class citizens that continue to influence the system.
 *
 * Implements:
 * - Rule 3 (Ineliminability): Nothing truly disappears; deletion creates a ghost
 * - Rule 9 (Defeasibility): Interpretations can be superseded, creating ghost versions
 * - NUL Operator (∅): "Assert meaningful absence" - ghosts are meaningful absences
 *
 * Ghost Lifecycle:
 * Entity (Active) → Ghost (Active) → Ghost (Dormant) → Ghost (Purged)
 *                       ↑                                    ↓
 *                       └──────── resurrect() ←──────────────┘
 *
 * Haunt Types:
 * - Reference: Deleted entity was linked by other entities
 * - Computation: Derived values depended on deleted data
 * - Semantic: Entity names/identifiers leave traces
 */

// ============================================================================
// Ghost Status
// ============================================================================

const GhostStatus = Object.freeze({
  ACTIVE: 'active',       // Recently deleted, actively tracked
  DORMANT: 'dormant',     // Old ghost, reduced tracking
  RESURRECTED: 'resurrected', // Was ghost, now restored
  PURGED: 'purged'        // Marked for removal (tombstone remains in log)
});

const HauntType = Object.freeze({
  REFERENCE: 'reference',       // Entity referenced this ghost
  COMPUTATION: 'computation',   // Derived value used this ghost
  SEMANTIC: 'semantic',         // Name/identifier collision
  STRUCTURAL: 'structural'      // Schema/structure dependency
});

const RetentionPolicy = Object.freeze({
  STANDARD: 'standard',         // Normal retention
  LEGAL_HOLD: 'legal_hold',     // Cannot be purged
  PERMANENT: 'permanent',       // Never expires
  TEMPORARY: 'temporary'        // Short-lived ghost
});

// ============================================================================
// Ghost Record
// ============================================================================

/**
 * Create a ghost record from a tombstone event
 */
function createGhostRecord(entityId, tombstoneEvent, options = {}) {
  const now = new Date().toISOString();

  return {
    // Identity
    id: entityId,
    ghostId: `ghost_${entityId}`,

    // Tombstone reference
    tombstoneEventId: tombstoneEvent.id,
    tombstoneTimestamp: tombstoneEvent.timestamp,

    // Deletion metadata
    ghostedAt: now,
    ghostedBy: tombstoneEvent.actor,
    reason: tombstoneEvent.payload?.reason || 'No reason provided',

    // Snapshot of deleted content
    snapshot: tombstoneEvent.payload?.targetSnapshot || {
      type: options.entityType || 'unknown',
      payload: options.originalPayload || {}
    },

    // Entity metadata
    entityType: options.entityType || tombstoneEvent.payload?.targetSnapshot?.type || 'unknown',
    workspace: tombstoneEvent.context?.workspace || options.workspace || 'default',

    // Haunting state
    hauntTargets: [],          // IDs of entities this ghost influences
    hauntCount: 0,             // Number of active haunts
    lastHauntedAt: null,       // When ghost last influenced something

    // Haunt strength decays over time (0.0 - 1.0)
    hauntStrength: 1.0,

    // Lifecycle
    status: GhostStatus.ACTIVE,
    resurrectionCount: 0,
    lastResurrectedAt: null,

    // Retention
    retentionPolicy: options.retentionPolicy || RetentionPolicy.STANDARD,
    expiresAt: options.expiresAt || null,

    // Audit trail
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Create a haunt record
 */
function createHauntRecord(ghostId, targetId, hauntType, options = {}) {
  return {
    ghostId,
    targetId,
    hauntType,
    field: options.field || null,           // Which field references the ghost
    originalValue: options.originalValue || null,
    detectedAt: new Date().toISOString(),
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
    metadata: options.metadata || {}
  };
}

// ============================================================================
// Ghost Registry
// ============================================================================

/**
 * EOGhostRegistry - Central registry for ghost data
 */
class EOGhostRegistry {
  constructor(options = {}) {
    // Ghost records by entity ID
    this._ghosts = new Map();

    // Haunt relationships: ghostId -> Set of haunt records
    this._hauntsByGhost = new Map();

    // Reverse index: targetId -> Set of ghost IDs haunting it
    this._hauntsByTarget = new Map();

    // Semantic ghosts: "type:name" -> ghost record
    this._semanticGhosts = new Map();

    // Event references
    this._eventStore = options.eventStore || null;
    this._eventBus = options.eventBus || null;
    this._persistence = options.persistence || null;

    // Configuration
    this._config = {
      // How long before ghost becomes dormant (ms)
      dormantThreshold: options.dormantThreshold || 30 * 24 * 60 * 60 * 1000, // 30 days
      // How fast haunt strength decays per day
      hauntDecayRate: options.hauntDecayRate || 0.1,
      // Whether to auto-register ghosts on tombstone
      autoRegister: options.autoRegister !== false,
      // Max ghosts to keep in memory
      maxGhosts: options.maxGhosts || 10000
    };

    // Statistics
    this._stats = {
      totalGhosts: 0,
      activeGhosts: 0,
      dormantGhosts: 0,
      resurrections: 0,
      hauntsDetected: 0,
      hauntsResolved: 0
    };

    // Initialize
    this._initialized = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Initialize the registry, optionally with external dependencies
   */
  async init(options = {}) {
    if (options.eventStore) this._eventStore = options.eventStore;
    if (options.eventBus) this._eventBus = options.eventBus;
    if (options.persistence) this._persistence = options.persistence;

    // Subscribe to tombstone events if event bus available
    if (this._eventBus && this._config.autoRegister) {
      this._setupEventSubscriptions();
    }

    // Load persisted ghosts
    if (this._persistence) {
      await this._loadFromPersistence();
    }

    this._initialized = true;
    console.log('EOGhostRegistry: Initialized', this.getStats());
  }

  /**
   * Set up event bus subscriptions
   */
  _setupEventSubscriptions() {
    // Auto-register ghost on tombstone
    this._eventBus.on('tombstone_created', (event) => {
      const tombstoneEvent = event.payload;
      if (tombstoneEvent?.payload?.targetId) {
        this.registerGhost(tombstoneEvent.payload.targetId, tombstoneEvent);
      }
    }, { priority: 1 }); // High priority - before UI updates

    // Detect haunts when entities are accessed
    this._eventBus.on('entity_updated', (event) => {
      this._checkForHaunts(event.payload?.entityId);
    });

    console.log('EOGhostRegistry: Event subscriptions active');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ghost Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a ghost from a deletion/tombstone event
   *
   * @param {string} entityId - The deleted entity's ID
   * @param {Object} tombstoneEvent - The tombstone event from the log
   * @param {Object} options - Additional options
   * @returns {Object} The created ghost record
   */
  registerGhost(entityId, tombstoneEvent, options = {}) {
    // Check if already a ghost
    if (this._ghosts.has(entityId)) {
      const existing = this._ghosts.get(entityId);
      // If resurrected, allow re-ghosting
      if (existing.status !== GhostStatus.RESURRECTED) {
        console.warn(`EOGhostRegistry: Entity ${entityId} is already a ghost`);
        return existing;
      }
    }

    // Create ghost record
    const ghost = createGhostRecord(entityId, tombstoneEvent, options);
    this._ghosts.set(entityId, ghost);

    // Register semantic ghost if named
    const name = ghost.snapshot?.payload?.name || ghost.snapshot?.name;
    if (name) {
      const semanticKey = `${ghost.entityType}:${name}`;
      this._semanticGhosts.set(semanticKey, ghost);
    }

    // Initialize haunt tracking
    this._hauntsByGhost.set(entityId, new Set());

    // Update stats
    this._stats.totalGhosts++;
    this._stats.activeGhosts++;

    // Emit event
    if (this._eventBus) {
      this._eventBus.emit('entity_ghosted', {
        entityId,
        ghostRecord: ghost,
        timestamp: ghost.ghostedAt
      }, { source: 'ghostRegistry' });
    }

    // Persist
    this._persistGhost(ghost);

    console.log(`EOGhostRegistry: Registered ghost for ${entityId}`);
    return ghost;
  }

  /**
   * Get a ghost record by entity ID
   */
  getGhost(entityId) {
    return this._ghosts.get(entityId) || null;
  }

  /**
   * Check if an entity is a ghost
   */
  isGhost(entityId) {
    const ghost = this._ghosts.get(entityId);
    return ghost && ghost.status !== GhostStatus.RESURRECTED;
  }

  /**
   * Get all ghosts with optional filters
   */
  getAllGhosts(options = {}) {
    let ghosts = Array.from(this._ghosts.values());

    // Filter by status
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      ghosts = ghosts.filter(g => statuses.includes(g.status));
    }

    // Filter by entity type
    if (options.entityType) {
      ghosts = ghosts.filter(g => g.entityType === options.entityType);
    }

    // Filter by workspace
    if (options.workspace) {
      ghosts = ghosts.filter(g => g.workspace === options.workspace);
    }

    // Filter by actor
    if (options.ghostedBy) {
      ghosts = ghosts.filter(g => g.ghostedBy === options.ghostedBy);
    }

    // Filter by age
    if (options.maxAgeDays) {
      const cutoff = Date.now() - (options.maxAgeDays * 24 * 60 * 60 * 1000);
      ghosts = ghosts.filter(g => new Date(g.ghostedAt).getTime() > cutoff);
    }

    // Sort
    if (options.sortBy) {
      const sortField = options.sortBy;
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      ghosts.sort((a, b) => {
        if (a[sortField] < b[sortField]) return -1 * sortOrder;
        if (a[sortField] > b[sortField]) return 1 * sortOrder;
        return 0;
      });
    } else {
      // Default: most recent first
      ghosts.sort((a, b) => new Date(b.ghostedAt) - new Date(a.ghostedAt));
    }

    // Limit
    if (options.limit) {
      ghosts = ghosts.slice(0, options.limit);
    }

    return ghosts;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Haunting
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Record a haunt - when a ghost influences active data
   *
   * @param {string} ghostId - The ghost's entity ID
   * @param {string} targetId - The entity being haunted
   * @param {string} hauntType - Type of haunting (reference, computation, etc.)
   * @param {Object} options - Additional options
   */
  recordHaunt(ghostId, targetId, hauntType, options = {}) {
    const ghost = this._ghosts.get(ghostId);
    if (!ghost) {
      console.warn(`EOGhostRegistry: Cannot record haunt - ghost ${ghostId} not found`);
      return null;
    }

    // Create haunt record
    const haunt = createHauntRecord(ghostId, targetId, hauntType, options);

    // Add to ghost's haunt list
    if (!this._hauntsByGhost.has(ghostId)) {
      this._hauntsByGhost.set(ghostId, new Set());
    }
    this._hauntsByGhost.get(ghostId).add(haunt);

    // Add to reverse index
    if (!this._hauntsByTarget.has(targetId)) {
      this._hauntsByTarget.set(targetId, new Set());
    }
    this._hauntsByTarget.get(targetId).add(ghostId);

    // Update ghost record
    if (!ghost.hauntTargets.includes(targetId)) {
      ghost.hauntTargets.push(targetId);
    }
    ghost.hauntCount++;
    ghost.lastHauntedAt = haunt.detectedAt;
    ghost.updatedAt = haunt.detectedAt;

    // Update stats
    this._stats.hauntsDetected++;

    // Emit event
    if (this._eventBus) {
      this._eventBus.emit('haunt_detected', {
        ghostId,
        targetId,
        hauntType,
        haunt
      }, { source: 'ghostRegistry' });
    }

    // Persist
    this._persistGhost(ghost);

    return haunt;
  }

  /**
   * Get all ghosts haunting a specific entity
   */
  getHauntingGhosts(entityId) {
    const ghostIds = this._hauntsByTarget.get(entityId);
    if (!ghostIds) return [];

    return Array.from(ghostIds)
      .map(id => this._ghosts.get(id))
      .filter(g => g && g.status !== GhostStatus.RESURRECTED);
  }

  /**
   * Get all entities a ghost is haunting
   */
  getHauntedEntities(ghostId) {
    const ghost = this._ghosts.get(ghostId);
    if (!ghost) return [];

    return ghost.hauntTargets.slice();
  }

  /**
   * Resolve a haunt (e.g., after fixing a broken reference)
   */
  resolveHaunt(ghostId, targetId, actor) {
    const haunts = this._hauntsByGhost.get(ghostId);
    if (!haunts) return false;

    let resolved = false;
    for (const haunt of haunts) {
      if (haunt.targetId === targetId && !haunt.resolved) {
        haunt.resolved = true;
        haunt.resolvedAt = new Date().toISOString();
        haunt.resolvedBy = actor;
        resolved = true;
        this._stats.hauntsResolved++;
      }
    }

    if (resolved) {
      // Update ghost
      const ghost = this._ghosts.get(ghostId);
      if (ghost) {
        ghost.hauntTargets = ghost.hauntTargets.filter(t => t !== targetId);
        ghost.hauntCount = Math.max(0, ghost.hauntCount - 1);
        ghost.updatedAt = new Date().toISOString();
        this._persistGhost(ghost);
      }

      // Update reverse index
      const targetGhosts = this._hauntsByTarget.get(targetId);
      if (targetGhosts) {
        targetGhosts.delete(ghostId);
        if (targetGhosts.size === 0) {
          this._hauntsByTarget.delete(targetId);
        }
      }

      // Emit event
      if (this._eventBus) {
        this._eventBus.emit('haunt_resolved', {
          ghostId,
          targetId,
          resolvedBy: actor
        }, { source: 'ghostRegistry' });
      }
    }

    return resolved;
  }

  /**
   * Check if an entity is haunted
   */
  isHaunted(entityId) {
    const ghosts = this._hauntsByTarget.get(entityId);
    return ghosts && ghosts.size > 0;
  }

  /**
   * Get haunt info for an entity (for UI display)
   */
  getHauntInfo(entityId) {
    const ghosts = this.getHauntingGhosts(entityId);
    if (ghosts.length === 0) return null;

    return {
      isHaunted: true,
      ghostCount: ghosts.length,
      ghosts: ghosts.map(g => ({
        id: g.id,
        name: g.snapshot?.payload?.name || g.snapshot?.name || g.id,
        type: g.entityType,
        ghostedAt: g.ghostedAt,
        reason: g.reason
      }))
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Resurrection
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resurrect a ghost - restore it to active state
   *
   * @param {string} ghostId - The ghost's entity ID
   * @param {string} actor - Who is resurrecting
   * @param {Object} options - Resurrection options
   * @returns {Object} Result with success status and new entity event
   */
  resurrect(ghostId, actor, options = {}) {
    const ghost = this._ghosts.get(ghostId);
    if (!ghost) {
      return { success: false, error: 'Ghost not found' };
    }

    if (ghost.status === GhostStatus.RESURRECTED) {
      return { success: false, error: 'Ghost already resurrected' };
    }

    if (ghost.retentionPolicy === RetentionPolicy.LEGAL_HOLD && !options.overrideLegalHold) {
      return { success: false, error: 'Cannot resurrect ghost under legal hold without override' };
    }

    const now = new Date().toISOString();

    // Update ghost status
    ghost.status = GhostStatus.RESURRECTED;
    ghost.resurrectionCount++;
    ghost.lastResurrectedAt = now;
    ghost.updatedAt = now;

    // Update stats
    this._stats.activeGhosts--;
    this._stats.resurrections++;

    // Clear haunts if requested
    if (options.clearHaunts) {
      for (const targetId of ghost.hauntTargets) {
        this.resolveHaunt(ghostId, targetId, actor);
      }
    }

    // Create resurrection event if event store available
    let resurrectionEvent = null;
    if (this._eventStore && options.createEvent !== false) {
      resurrectionEvent = {
        id: `resurrection_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
        epistemicType: 'given',
        category: 'resurrection',
        timestamp: now,
        actor: actor,
        payload: {
          action: 'resurrect',
          ghostId: ghost.id,
          originalSnapshot: ghost.snapshot,
          reason: options.reason || 'User requested resurrection'
        },
        grounding: {
          references: [{
            kind: 'structural',
            eventId: ghost.tombstoneEventId,
            role: 'resurrects'
          }]
        }
      };

      // Append to event store
      if (typeof this._eventStore.append === 'function') {
        this._eventStore.append(resurrectionEvent);
      }
    }

    // Emit event
    if (this._eventBus) {
      this._eventBus.emit('entity_resurrected', {
        ghostId,
        actor,
        ghost,
        resurrectionEvent
      }, { source: 'ghostRegistry' });
    }

    // Persist
    this._persistGhost(ghost);

    console.log(`EOGhostRegistry: Resurrected ghost ${ghostId}`);
    return {
      success: true,
      ghost,
      resurrectionEvent,
      snapshot: ghost.snapshot
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update ghost status based on age and activity
   */
  updateGhostStatuses() {
    const now = Date.now();
    let updated = 0;

    for (const ghost of this._ghosts.values()) {
      if (ghost.status !== GhostStatus.ACTIVE) continue;

      const age = now - new Date(ghost.ghostedAt).getTime();

      // Check for dormancy
      if (age > this._config.dormantThreshold) {
        ghost.status = GhostStatus.DORMANT;
        ghost.updatedAt = new Date().toISOString();
        this._stats.activeGhosts--;
        this._stats.dormantGhosts++;
        updated++;

        // Emit event
        if (this._eventBus) {
          this._eventBus.emit('ghost_dormant', {
            ghostId: ghost.id,
            age: age
          }, { source: 'ghostRegistry' });
        }
      }

      // Decay haunt strength
      const daysSinceGhosted = age / (24 * 60 * 60 * 1000);
      ghost.hauntStrength = Math.max(0, 1 - (daysSinceGhosted * this._config.hauntDecayRate));
    }

    if (updated > 0) {
      console.log(`EOGhostRegistry: Updated ${updated} ghost statuses`);
    }

    return updated;
  }

  /**
   * Check for expiring ghosts
   */
  checkExpirations() {
    const now = new Date();
    const expired = [];

    for (const ghost of this._ghosts.values()) {
      if (ghost.expiresAt && new Date(ghost.expiresAt) <= now) {
        if (ghost.retentionPolicy !== RetentionPolicy.LEGAL_HOLD) {
          ghost.status = GhostStatus.PURGED;
          ghost.updatedAt = now.toISOString();
          expired.push(ghost);

          // Emit event
          if (this._eventBus) {
            this._eventBus.emit('ghost_expired', {
              ghostId: ghost.id,
              expiresAt: ghost.expiresAt
            }, { source: 'ghostRegistry' });
          }
        }
      }
    }

    return expired;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Semantic Ghosts
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if a name is used by a ghost
   */
  isNameGhosted(name, entityType) {
    const key = `${entityType}:${name}`;
    return this._semanticGhosts.has(key);
  }

  /**
   * Get ghost by name
   */
  getGhostByName(name, entityType) {
    const key = `${entityType}:${name}`;
    return this._semanticGhosts.get(key) || null;
  }

  /**
   * Clear a semantic ghost (allow name reuse)
   */
  clearSemanticGhost(name, entityType) {
    const key = `${entityType}:${name}`;
    return this._semanticGhosts.delete(key);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Detection Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Find ghost references in an entity's data
   */
  findGhostReferences(entity) {
    const ghostRefs = [];

    if (!entity || !entity.payload) return ghostRefs;

    // Check all fields for ghost references
    const checkValue = (value, field) => {
      if (typeof value === 'string') {
        // Check if this is a reference to a ghost
        if (this._ghosts.has(value)) {
          const ghost = this._ghosts.get(value);
          if (ghost.status !== GhostStatus.RESURRECTED) {
            ghostRefs.push({
              field,
              ghostId: value,
              ghost
            });
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach((v, i) => checkValue(v, `${field}[${i}]`));
      } else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
          checkValue(v, `${field}.${k}`);
        }
      }
    };

    for (const [key, value] of Object.entries(entity.payload)) {
      checkValue(value, key);
    }

    return ghostRefs;
  }

  /**
   * Check an entity for haunts (called on entity access/update)
   */
  _checkForHaunts(entityId) {
    if (!entityId || !this._eventStore) return;

    // This would be expanded to check the entity's references
    // against known ghosts and record haunts as needed
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Persistence
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Persist a ghost to storage
   */
  async _persistGhost(ghost) {
    if (!this._persistence) return;

    try {
      await this._persistence.saveGhost(ghost);
    } catch (err) {
      console.error('EOGhostRegistry: Failed to persist ghost', err);
    }
  }

  /**
   * Load ghosts from persistence
   */
  async _loadFromPersistence() {
    if (!this._persistence) return;

    try {
      const ghosts = await this._persistence.loadGhosts();
      if (ghosts && ghosts.length > 0) {
        for (const ghost of ghosts) {
          this._ghosts.set(ghost.id, ghost);

          // Rebuild indexes
          if (ghost.hauntTargets) {
            this._hauntsByGhost.set(ghost.id, new Set());
            for (const targetId of ghost.hauntTargets) {
              if (!this._hauntsByTarget.has(targetId)) {
                this._hauntsByTarget.set(targetId, new Set());
              }
              this._hauntsByTarget.get(targetId).add(ghost.id);
            }
          }

          // Rebuild semantic index
          const name = ghost.snapshot?.payload?.name || ghost.snapshot?.name;
          if (name) {
            const key = `${ghost.entityType}:${name}`;
            this._semanticGhosts.set(key, ghost);
          }
        }

        // Update stats
        this._stats.totalGhosts = this._ghosts.size;
        this._stats.activeGhosts = Array.from(this._ghosts.values())
          .filter(g => g.status === GhostStatus.ACTIVE).length;
        this._stats.dormantGhosts = Array.from(this._ghosts.values())
          .filter(g => g.status === GhostStatus.DORMANT).length;

        console.log(`EOGhostRegistry: Loaded ${ghosts.length} ghosts from persistence`);
      }
    } catch (err) {
      console.error('EOGhostRegistry: Failed to load ghosts', err);
    }
  }

  /**
   * Export all ghosts
   */
  export() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      ghosts: Array.from(this._ghosts.values()),
      stats: this.getStats()
    };
  }

  /**
   * Import ghosts
   */
  import(data) {
    if (!data || !data.ghosts) {
      return { success: false, error: 'Invalid import data' };
    }

    let imported = 0;
    for (const ghost of data.ghosts) {
      if (!this._ghosts.has(ghost.id)) {
        this._ghosts.set(ghost.id, ghost);
        imported++;
      }
    }

    return { success: true, imported };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get registry statistics
   */
  getStats() {
    return {
      ...this._stats,
      totalHaunts: this._hauntsByGhost.size,
      hauntedEntities: this._hauntsByTarget.size,
      semanticGhosts: this._semanticGhosts.size
    };
  }

  /**
   * Get summary for display
   */
  getSummary() {
    const stats = this.getStats();
    const recentGhosts = this.getAllGhosts({ limit: 5 });

    return {
      stats,
      recentGhosts: recentGhosts.map(g => ({
        id: g.id,
        name: g.snapshot?.payload?.name || g.snapshot?.name || g.id,
        type: g.entityType,
        ghostedAt: g.ghostedAt,
        status: g.status
      }))
    };
  }

  /**
   * Clear the registry (for testing)
   */
  _clear() {
    this._ghosts.clear();
    this._hauntsByGhost.clear();
    this._hauntsByTarget.clear();
    this._semanticGhosts.clear();
    this._stats = {
      totalGhosts: 0,
      activeGhosts: 0,
      dormantGhosts: 0,
      resurrections: 0,
      hauntsDetected: 0,
      hauntsResolved: 0
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let _ghostRegistry = null;

function getGhostRegistry() {
  if (!_ghostRegistry) {
    _ghostRegistry = new EOGhostRegistry();
  }
  return _ghostRegistry;
}

function initGhostRegistry(options = {}) {
  _ghostRegistry = new EOGhostRegistry(options);
  return _ghostRegistry;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GhostStatus,
    HauntType,
    RetentionPolicy,
    createGhostRecord,
    createHauntRecord,
    EOGhostRegistry,
    getGhostRegistry,
    initGhostRegistry
  };
}

if (typeof window !== 'undefined') {
  window.GhostStatus = GhostStatus;
  window.HauntType = HauntType;
  window.RetentionPolicy = RetentionPolicy;
  window.createGhostRecord = createGhostRecord;
  window.createHauntRecord = createHauntRecord;
  window.EOGhostRegistry = EOGhostRegistry;
  window.getGhostRegistry = getGhostRegistry;
  window.initGhostRegistry = initGhostRegistry;
}
