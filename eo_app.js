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
let _dataWorkbench = null;

function getApp() {
  return _app;
}

async function initApp(options = {}) {
  console.log('EO Lake: Initializing application...');

  // Initialize the EOApp instance (core Experience Engine)
  _app = new EOApp();
  await _app.init(options);
  console.log('EO Lake: EOApp core initialized');

  // Initialize the data workbench (the main UI)
  _dataWorkbench = initDataWorkbench('content-area', _app);

  // Set up global event handlers
  setupGlobalHandlers();

  // Update sync status indicator
  updateSyncStatus('synced');

  // Connect the event bus to the app (enables reactive updates)
  if (window.connectEventBus) {
    window.connectEventBus(_app);
    console.log('EO Lake: Event bus connected to EOApp');
  }

  // Connect transparency panel to the app
  if (window.getTransparencyPanel) {
    const transparency = window.getTransparencyPanel();
    if (transparency) {
      transparency.connect(_app);
      console.log('EO Lake: Transparency panel connected to EOApp');
    }
  }

  console.log('EO Lake: Application initialized');

  return _dataWorkbench;
}

// ============================================================================
// Global Event Handlers
// ============================================================================

function setupGlobalHandlers() {
  // Global search
  const searchInput = document.getElementById('global-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      handleGlobalSearch(e.target.value);
    }, 300));
  }

  // Settings button
  document.getElementById('nav-settings')?.addEventListener('click', () => {
    showSettingsModal();
  });

  // Sync status click
  document.getElementById('nav-sync')?.addEventListener('click', () => {
    showSyncDetails();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleGlobalKeyboard);

  // Listen for storage changes (cross-tab sync)
  window.addEventListener('storage', (e) => {
    if (e.key === 'eo_lake_data') {
      console.log('Data changed in another tab, refreshing...');
      _dataWorkbench?._loadData();
      _dataWorkbench?.refresh();
    }
  });
}

// ============================================================================
// Global Search
// ============================================================================

function handleGlobalSearch(query) {
  if (!query || query.length < 2) {
    hideSearchResults();
    return;
  }

  const workbench = getDataWorkbench();
  if (!workbench) return;

  const results = [];
  const queryLower = query.toLowerCase();

  workbench.getSets().forEach(set => {
    if (set.name.toLowerCase().includes(queryLower)) {
      results.push({ type: 'set', id: set.id, title: set.name, subtitle: `${set.records.length} records` });
    }

    const primaryField = set.fields.find(f => f.isPrimary) || set.fields[0];
    set.records.forEach(record => {
      const primaryValue = record.values[primaryField?.id] || '';
      if (String(primaryValue).toLowerCase().includes(queryLower)) {
        results.push({ type: 'record', id: record.id, setId: set.id, title: String(primaryValue), subtitle: set.name });
      }
    });
  });

  showSearchResults(results.slice(0, 10));
}

function showSearchResults(results) {
  let dropdown = document.getElementById('search-results');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'search-results';
    dropdown.className = 'search-results-dropdown';
    document.querySelector('.sidebar-search')?.appendChild(dropdown);
  }

  if (results.length === 0) {
    dropdown.innerHTML = '<div class="search-no-results"><i class="ph ph-magnifying-glass"></i><span>No results found</span></div>';
  } else {
    dropdown.innerHTML = results.map(r => `
      <div class="search-result-item" data-type="${r.type}" data-id="${r.id}" data-set-id="${r.setId || ''}">
        <i class="ph ${r.type === 'set' ? 'ph-table' : 'ph-file'}"></i>
        <div class="search-result-content">
          <div class="search-result-title">${escapeHtmlApp(r.title)}</div>
          <div class="search-result-subtitle">${escapeHtmlApp(r.subtitle)}</div>
        </div>
      </div>
    `).join('');

    dropdown.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.dataset.type === 'set') _dataWorkbench?._selectSet(item.dataset.id);
        else if (item.dataset.setId) {
          _dataWorkbench?._selectSet(item.dataset.setId);
          setTimeout(() => _dataWorkbench?._showRecordDetail(item.dataset.id), 100);
        }
        hideSearchResults();
        document.getElementById('global-search').value = '';
      });
    });
  }
  dropdown.style.display = 'block';
}

function hideSearchResults() {
  const dropdown = document.getElementById('search-results');
  if (dropdown) dropdown.style.display = 'none';
}

// ============================================================================
// Sync Status
// ============================================================================

function updateSyncStatus(status) {
  const badge = document.getElementById('sync-status-badge');
  if (!badge) return;
  badge.className = 'sync-badge ' + status;
  const icons = { synced: 'ph-check-circle', syncing: 'ph-arrows-clockwise', error: 'ph-warning-circle' };
  badge.innerHTML = `<i class="ph ${icons[status] || icons.synced}"></i>`;
}

function showSyncDetails() {
  const workbench = getDataWorkbench();
  if (!workbench) return;
  const data = workbench.exportData();
  const size = new Blob([JSON.stringify(data)]).size;
  const sizeStr = size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;
  alert(`EO Lake Sync Status\n\nSets: ${data.sets?.length || 0}\nTotal Records: ${data.sets?.reduce((sum, s) => sum + s.records.length, 0) || 0}\nData Size: ${sizeStr}\nStorage: localStorage\nStatus: Synced`);
}

// ============================================================================
// Settings
// ============================================================================

function showSettingsModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = modal?.querySelector('.modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');
  if (!modal || !modalBody) return;

  modalTitle.textContent = 'Settings';
  modalBody.innerHTML = `
    <div class="form-group">
      <label class="form-label">Import Data</label>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
        <button class="btn btn-primary" onclick="closeModal(); setTimeout(showImportModal, 100);">
          <i class="ph ph-file-csv"></i> Import CSV / JSON
        </button>
      </div>
      <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
        Import data from CSV or JSON files with automatic field type detection.
      </p>
    </div>
    <div class="form-group">
      <label class="form-label">Data Management</label>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-secondary" onclick="exportAllData()"><i class="ph ph-export"></i> Export JSON</button>
        <button class="btn btn-secondary" onclick="importLegacyData()"><i class="ph ph-download"></i> Import JSON (Legacy)</button>
        <button class="btn btn-danger" onclick="clearAllData()"><i class="ph ph-trash"></i> Clear All</button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">About</label>
      <div style="font-size: 12px; color: var(--text-muted);">EO Lake v1.0.0<br>Data Workbench with EO Sync</div>
    </div>
  `;
  modalFooter.innerHTML = '<button class="btn btn-secondary" onclick="closeModal()">Close</button>';
  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('active');
}

// ============================================================================
// Data Export/Import
// ============================================================================

function exportAllData() {
  const workbench = getDataWorkbench();
  if (!workbench) return;
  const data = workbench.exportData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eo-lake-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  closeModal();
}

function importLegacyData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        // Extract name from file (remove .json extension)
        const importName = file.name.replace(/\.json$/i, '');
        getDataWorkbench()?.importData(data, importName);
        closeModal();
        alert('Data imported successfully!');
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Keep old name for backwards compatibility
function importData() {
  // Use new import modal by default
  closeModal();
  setTimeout(showImportModal, 100);
}

function clearAllData() {
  if (!confirm('Clear all data? This cannot be undone.')) return;
  localStorage.removeItem('eo_lake_data');
  window.location.reload();
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

function handleGlobalKeyboard(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('global-search')?.focus();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'e' && !e.target.closest('input, textarea')) {
    e.preventDefault();
    exportAllData();
  }
}

// ============================================================================
// Utilities
// ============================================================================

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function escapeHtmlApp(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// ============================================================================
// Additional Styles
// ============================================================================

const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
  .search-results-dropdown {
    position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px;
    background: var(--bg-secondary); border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
    max-height: 300px; overflow-y: auto; z-index: 100; display: none;
  }
  .search-result-item {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer;
  }
  .search-result-item:hover { background: var(--bg-hover); }
  .search-result-item i { font-size: 16px; color: var(--text-muted); width: 20px; }
  .search-result-content { flex: 1; min-width: 0; }
  .search-result-title { font-size: 13px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .search-result-subtitle { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .search-no-results { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px; color: var(--text-muted); font-size: 13px; }
  .search-no-results i { font-size: 24px; }
  .sidebar-search { position: relative; }
  .select-dropdown { position: absolute; top: 100%; left: 0; min-width: 200px; background: var(--bg-secondary); border: 1px solid var(--border-primary); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 100; max-height: 200px; overflow-y: auto; }
  .select-option { padding: 8px 12px; cursor: pointer; }
  .select-option:hover { background: var(--bg-hover); }
  .select-option.selected { background: var(--bg-active); }
`;
document.head.appendChild(additionalStyles);

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
  window.exportAllData = exportAllData;
  window.importData = importData;
  window.importLegacyData = importLegacyData;
  window.clearAllData = clearAllData;
  window.closeModal = closeModal;
}
