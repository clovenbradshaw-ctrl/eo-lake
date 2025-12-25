/**
 * EO App Controller - Main Application Orchestration
 *
 * The unified entry point for the Experience Engine application.
 * Coordinates all subsystems: event store, horizons, compliance,
 * state derivation, persistence, and sync.
 */

/**
 * Application configuration
 */
const APP_CONFIG = {
  version: '1.0.0',
  schemaVersion: '1.0',
  defaultWorkspace: 'default',
  autoSaveInterval: 30000,
  complianceCheckInterval: 60000
};

/**
 * Main Application Controller
 */
class EOApp {
  constructor() {
    // Core subsystems
    this.eventStore = null;
    this.horizonLattice = null;
    this.stateDerivation = null;
    this.persistence = null;
    this.syncEngine = null;
    this.complianceChecker = null;

    // Current context
    this.currentWorkspace = APP_CONFIG.defaultWorkspace;
    this.currentHorizon = null;
    this.currentActor = null;

    // UI references
    this.ui = null;

    // Intervals
    this._complianceInterval = null;

    // Event subscribers
    this._subscribers = new Map();
  }

  /**
   * Initialize the application
   */
  async init(options = {}) {
    console.log('EOApp: Initializing Experience Engine v' + APP_CONFIG.version);

    // Initialize event store
    this.eventStore = initEventStore();
    console.log('EOApp: Event store initialized');

    // Initialize horizon lattice
    this.horizonLattice = initHorizonLattice();
    console.log('EOApp: Horizon lattice initialized');

    // Create default workspace horizon
    const workspaceHorizon = this.horizonLattice.add({
      id: 'workspace_' + this.currentWorkspace,
      type: HorizonType.WORKSPACE,
      name: this.currentWorkspace,
      workspaces: [this.currentWorkspace]
    });
    this.currentHorizon = workspaceHorizon.id;

    // Initialize state derivation
    this.stateDerivation = initStateDerivation(this.eventStore, this.horizonLattice);
    console.log('EOApp: State derivation initialized');

    // Initialize persistence
    this.persistence = await initPersistence(
      this.eventStore,
      this.horizonLattice,
      { dbName: options.dbName || 'eo_experience_engine' }
    );
    console.log('EOApp: Persistence initialized');

    // Initialize sync engine
    this.syncEngine = initSyncEngine(this.eventStore, this.persistence);
    console.log('EOApp: Sync engine initialized');

    // Initialize compliance checker
    this.complianceChecker = initComplianceChecker(this.eventStore, this.horizonLattice);
    console.log('EOApp: Compliance checker initialized');

    // Set current actor
    this.currentActor = options.actor || this._generateActorId();

    // Start compliance checking interval
    if (options.complianceChecking !== false) {
      this._startComplianceChecking();
    }

    // Subscribe to new events for UI updates
    this.eventStore.subscribe(event => this._handleNewEvent(event));

    console.log('EOApp: Initialization complete');

    return this;
  }

  /**
   * Generate a random actor ID
   */
  _generateActorId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Start periodic compliance checking
   */
  _startComplianceChecking() {
    // Run initial check
    setTimeout(() => this.runComplianceCheck(), 1000);

    // Schedule periodic checks
    this._complianceInterval = setInterval(
      () => this.runComplianceCheck(),
      APP_CONFIG.complianceCheckInterval
    );
  }

  /**
   * Run a compliance check
   */
  runComplianceCheck() {
    const audit = this.complianceChecker.runAudit();
    const report = audit.toReport();

    console.log('EOApp: Compliance check -', report.audit.conformanceLevel);

    this._emit('compliance', report);

    return report;
  }

  /**
   * Handle new events
   */
  _handleNewEvent(event) {
    this._emit('event', event);
  }

  /**
   * Create a Given event (raw experience)
   */
  recordGiven(mode, content, options = {}) {
    const event = {
      id: generateEventId({ action: 'record_given', content }),
      type: EventType.GIVEN,
      actor: options.actor || this.currentActor,
      timestamp: new Date().toISOString(),
      mode: mode,
      parents: this.eventStore.getHeads().map(e => e.id),
      context: {
        workspace: options.workspace || this.currentWorkspace,
        schemaVersion: APP_CONFIG.schemaVersion,
        ...(options.context || {})
      },
      payload: {
        action: options.action || 'observation',
        ...content
      }
    };

    const result = this.eventStore.append(event);

    if (result.success) {
      this._emit('given_recorded', event);
    }

    return result;
  }

  /**
   * Create a Meant event (interpretation)
   */
  recordMeant(purpose, interpretation, provenance, options = {}) {
    if (!provenance || provenance.length === 0) {
      return { success: false, error: 'Rule 7: Meant events require provenance' };
    }

    const event = {
      id: generateEventId({ action: 'record_meant', interpretation }),
      type: EventType.MEANT,
      actor: options.actor || this.currentActor,
      timestamp: new Date().toISOString(),
      parents: this.eventStore.getHeads().map(e => e.id),
      context: {
        workspace: options.workspace || this.currentWorkspace,
        schemaVersion: APP_CONFIG.schemaVersion,
        ...(options.context || {})
      },
      frame: {
        purpose: purpose,
        horizon: options.horizon || 'session',
        audience: options.audience
      },
      provenance: provenance,
      epistemicStatus: options.epistemicStatus || EpistemicStatus.PRELIMINARY,
      payload: interpretation
    };

    const result = this.eventStore.append(event);

    if (result.success) {
      this._emit('meant_recorded', event);
    }

    return result;
  }

  /**
   * Create an entity
   */
  createEntity(entityType, data, options = {}) {
    const entityId = options.entityId || 'ent_' + Math.random().toString(36).substr(2, 9);

    return this.recordGiven(GivenMode.RECEIVED, {
      action: 'entity_create',
      entityId,
      entityType,
      data
    }, options);
  }

  /**
   * Update an entity field
   */
  updateEntityField(entityId, field, value, options = {}) {
    return this.recordGiven(GivenMode.RECEIVED, {
      action: 'field_update',
      entityId,
      field,
      value
    }, options);
  }

  /**
   * Delete (tombstone) an entity
   */
  deleteEntity(entityId, reason, options = {}) {
    return this.eventStore.createTombstone(
      entityId,
      options.actor || this.currentActor,
      reason,
      {
        workspace: options.workspace || this.currentWorkspace,
        schemaVersion: APP_CONFIG.schemaVersion
      }
    );
  }

  /**
   * Add an interpretation to an entity
   */
  interpretEntity(entityId, purpose, interpretation, options = {}) {
    // Find the entity's source events
    const stateDerivation = getStateDerivation();
    const entities = stateDerivation.deriveEntities(this.currentHorizon);
    const entity = entities.get(entityId);

    if (!entity) {
      return { success: false, error: 'Entity not found' };
    }

    return this.recordMeant(purpose, interpretation, entity.sourceEvents, options);
  }

  /**
   * Switch to a different horizon
   */
  setHorizon(horizonId) {
    const horizon = this.horizonLattice.get(horizonId);
    if (!horizon) {
      throw new Error('Horizon not found: ' + horizonId);
    }
    this.currentHorizon = horizonId;
    this._emit('horizon_changed', horizon);
    return horizon;
  }

  /**
   * Create a new horizon (refinement of current)
   */
  createHorizon(refinements) {
    const current = this.horizonLattice.get(this.currentHorizon);
    const newHorizon = current.refine(refinements);
    this.horizonLattice.add(newHorizon);
    return newHorizon;
  }

  /**
   * Get current gate (horizon-filtered access)
   */
  getGate() {
    return this.horizonLattice.createGate(this.currentHorizon, this.eventStore);
  }

  /**
   * Get derived entities for current horizon
   */
  getEntities() {
    const entities = this.stateDerivation.deriveEntities(this.currentHorizon);
    return Array.from(entities.values()).filter(e => !e.tombstoned);
  }

  /**
   * Get a derived view
   */
  getView(viewId, options = {}) {
    return this.stateDerivation.deriveView(this.currentHorizon, viewId, options);
  }

  /**
   * Get event log (horizon-filtered)
   */
  getEventLog() {
    const gate = this.getGate();
    return gate.getAvailable();
  }

  /**
   * Get Given events only
   */
  getGivenEvents() {
    const gate = this.getGate();
    return gate.getAvailableGiven();
  }

  /**
   * Get Meant events (interpretations)
   */
  getMeantEvents() {
    const gate = this.getGate();
    return gate.getAvailableMeant();
  }

  /**
   * Get active interpretations for a frame
   */
  getActiveInterpretations(frame = null) {
    return this.eventStore.getActiveInterpretations(frame);
  }

  /**
   * Get provenance chain for an event
   */
  getProvenanceChain(eventId) {
    return this.eventStore.getProvenanceChain(eventId);
  }

  /**
   * Subscribe to app events
   */
  on(eventType, callback) {
    if (!this._subscribers.has(eventType)) {
      this._subscribers.set(eventType, new Set());
    }
    this._subscribers.get(eventType).add(callback);

    return () => this._subscribers.get(eventType).delete(callback);
  }

  /**
   * Emit an app event
   */
  _emit(eventType, data) {
    const callbacks = this._subscribers.get(eventType);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(data);
        } catch (err) {
          console.error('EOApp: Event handler error:', err);
        }
      }
    }
  }

  /**
   * Get application statistics
   */
  getStats() {
    const events = this.eventStore.getAll();
    const givenCount = this.eventStore.getGiven().length;
    const meantCount = this.eventStore.getMeant().length;

    return {
      version: APP_CONFIG.version,
      workspace: this.currentWorkspace,
      horizon: this.currentHorizon,
      actor: this.currentActor,
      events: {
        total: events.length,
        given: givenCount,
        meant: meantCount,
        logicalClock: this.eventStore.clock
      },
      horizons: this.horizonLattice.getAll().length,
      derivation: this.stateDerivation.getStats(),
      sync: this.syncEngine.getStatus()
    };
  }

  /**
   * Export all data
   */
  async exportData() {
    return this.persistence.exportBackup();
  }

  /**
   * Import data
   */
  async importData(backup) {
    return this.persistence.importBackup(backup);
  }

  /**
   * Clear all data
   */
  async clearData() {
    await this.persistence.clear();
    this.stateDerivation.clearCache();
    this._emit('data_cleared', {});
  }

  /**
   * Configure cloud sync endpoint
   */
  configureSyncEndpoint(endpoint, options = {}) {
    this.syncEngine.configure(endpoint, options);
    this._emit('sync_configured', { endpoint });
  }

  /**
   * Trigger manual sync
   */
  async sync() {
    return this.syncEngine.sync(this.currentWorkspace);
  }

  /**
   * Set the UI reference
   */
  setUI(ui) {
    this.ui = ui;
  }

  /**
   * Shutdown the app
   */
  async shutdown() {
    console.log('EOApp: Shutting down...');

    if (this._complianceInterval) {
      clearInterval(this._complianceInterval);
    }

    if (this.persistence) {
      this.persistence.stopAutoSave();
      await this.persistence.save();
    }

    console.log('EOApp: Shutdown complete');
  }
}

// Singleton
let _app = null;

function getApp() {
  return _app;
}

async function initApp(options = {}) {
  _app = new EOApp();
  await _app.init(options);
  return _app;
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    APP_CONFIG,
    EOApp,
    getApp,
    initApp
  };
}

if (typeof window !== 'undefined') {
  window.APP_CONFIG = APP_CONFIG;
  window.EOApp = EOApp;
  window.getApp = getApp;
  window.initApp = initApp;
}
