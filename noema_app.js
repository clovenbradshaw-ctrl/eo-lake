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
  complianceCheckInterval: 60000,
  // Performance: Defer compliance checking until after initial load
  complianceCheckDelay: 10000, // Wait 10 seconds before first check
  deferComplianceChecking: true // Enable deferred compliance checking
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

    // Agent session
    this.agentSession = null;

    // Current context
    this.currentWorkspace = APP_CONFIG.defaultWorkspace;
    this.currentHorizon = null;

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

    // Initialize agent session
    if (typeof initAgentSession !== 'undefined') {
      this.agentSession = initAgentSession({
        agentId: options.actor,
        agentName: options.agentName,
        agentType: options.agentType
      });
      console.log('EOApp: Agent session initialized', this.agentSession.sessionId);
    }

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
   * Get the current actor from agent session
   */
  get currentActor() {
    if (this.agentSession) {
      return this.agentSession.getActor();
    }
    // Fallback to generated ID
    return this._fallbackActor || (this._fallbackActor = this._generateActorId());
  }

  /**
   * Generate a random actor ID (fallback when no session)
   */
  _generateActorId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Declare agent identity
   */
  declareAgent(identity) {
    if (!this.agentSession) {
      if (typeof initAgentSession !== 'undefined') {
        this.agentSession = initAgentSession(identity);
      } else {
        console.warn('EOApp: Agent session not available');
        return null;
      }
    } else {
      this.agentSession.declare(identity);
    }

    this._emit('agent_declared', this.agentSession.toIdentity());
    console.log('EOApp: Agent declared', this.agentSession.getDisplayName());

    return this.agentSession;
  }

  /**
   * Get agent session info
   */
  getAgentInfo() {
    if (!this.agentSession) {
      return {
        actor: this.currentActor,
        isDeclared: false,
        sessionId: null
      };
    }

    return {
      actor: this.currentActor,
      isDeclared: this.agentSession.isDeclared(),
      sessionId: this.agentSession.sessionId,
      displayName: this.agentSession.getDisplayName(),
      identity: this.agentSession.toIdentity()
    };
  }

  /**
   * Start periodic compliance checking
   * Performance: Uses deferred start to avoid blocking initial load
   */
  _startComplianceChecking() {
    // Use deferred delay for initial check (default 10s instead of 1s)
    const initialDelay = APP_CONFIG.deferComplianceChecking
      ? APP_CONFIG.complianceCheckDelay
      : 1000;

    // Run initial check after delay
    this._complianceTimeout = setTimeout(() => {
      this.runComplianceCheck();

      // Schedule periodic checks only after first check completes
      this._complianceInterval = setInterval(
        () => this.runComplianceCheck(),
        APP_CONFIG.complianceCheckInterval
      );
    }, initialDelay);
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
      epistemicType: EpistemicType.GIVEN,
      category: 'raw_data',
      actor: options.actor || this.currentActor,
      timestamp: new Date().toISOString(),
      mode: mode,
      parents: this.eventStore.getHeads ? this.eventStore.getHeads().map(e => e.id) : [],
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
      epistemicType: EpistemicType.MEANT,
      category: 'interpretation',
      actor: options.actor || this.currentActor,
      timestamp: new Date().toISOString(),
      parents: this.eventStore.getHeads ? this.eventStore.getHeads().map(e => e.id) : [],
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
      agent: this.getAgentInfo(),
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

    if (this._complianceTimeout) {
      clearTimeout(this._complianceTimeout);
    }
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
  console.log('Noema: Initializing application...');

  // Initialize the EOApp instance (core Experience Engine)
  _app = new EOApp();
  await _app.init(options);
  console.log('Noema: EOApp core initialized');

  // Initialize the data workbench (the main UI)
  // Await to ensure IndexedDB records are loaded before rendering (EO: GIVEN before MEANT)
  _dataWorkbench = await initDataWorkbench('content-area', _app);

  // Set up global event handlers
  setupGlobalHandlers();

  // Update sync status indicator
  updateSyncStatus('synced');

  // Connect the event bus to the app (enables reactive updates)
  if (window.connectEventBus) {
    window.connectEventBus(_app);
    console.log('Noema: Event bus connected to EOApp');
  }

  // Connect transparency panel to the app
  if (window.getTransparencyPanel) {
    const transparency = window.getTransparencyPanel();
    if (transparency) {
      transparency.connect(_app);
      console.log('Noema: Transparency panel connected to EOApp');
    }
  }

  // Load common definitions if available
  if (window.EO?.loadCommonDefinitions && _dataWorkbench) {
    try {
      // Load common definitions from the JSON file
      const result = await window.EO.loadCommonDefinitions(_dataWorkbench, 'common_definitions.json');
      if (result.loaded > 0) {
        console.log(`Noema: Loaded ${result.loaded} common definitions`);
      }
    } catch (error) {
      console.warn('Noema: Could not load common definitions:', error.message);
    }
  }

  console.log('Noema: Application initialized');

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
      showingHistory = false;
      handleGlobalSearch(e.target.value);
    }, 300));

    // Show search history on focus when empty
    searchInput.addEventListener('focus', () => {
      if (!searchInput.value.trim()) {
        showSearchHistory();
      }
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', handleSearchKeyboard);

    // Hide results on blur (with delay for click handling)
    searchInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (!document.activeElement?.closest('.search-results-dropdown')) {
          hideSearchResults();
        }
      }, 200);
    });
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
// Global Search with Prefix Support
// ============================================================================

const SEARCH_PREFIXES = {
  '@': { name: 'fields', icon: 'ph-text-aa', description: 'Search fields and values' },
  '#': { name: 'sets', icon: 'ph-database', description: 'Search sets by name' },
  '/': { name: 'views', icon: 'ph-eye', description: 'Search views/lenses' },
  '?': { name: 'sources', icon: 'ph-download-simple', description: 'Search data sources' },
  '>': { name: 'commands', icon: 'ph-terminal', description: 'Run commands' },
  '!': { name: 'provenance', icon: 'ph-git-branch', description: 'Search by provenance' }
};

// Search state
const SEARCH_HISTORY_KEY = 'eo_search_history';
const MAX_SEARCH_HISTORY = 10;
let searchSelectedIndex = -1;
let currentSearchResults = [];
let showingHistory = false;

// Get search history from localStorage
function getSearchHistory() {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

// Add to search history
function addToSearchHistory(query) {
  if (!query || query.length < 2) return;
  let history = getSearchHistory();
  // Remove if exists
  history = history.filter(h => h.query !== query);
  // Add to front
  history.unshift({ query, timestamp: Date.now() });
  // Keep max items
  history = history.slice(0, MAX_SEARCH_HISTORY);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

// Clear search history
function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

function parseSearchQuery(query) {
  const firstChar = query.charAt(0);
  if (SEARCH_PREFIXES[firstChar]) {
    return { prefix: firstChar, term: query.slice(1).trim() };
  }
  return { prefix: '', term: query.trim() };
}

function updateSearchPrefixHint(prefix) {
  const hint = document.getElementById('search-prefix-hint');
  const legend = document.getElementById('search-prefix-legend');

  if (!hint) return;

  if (prefix && SEARCH_PREFIXES[prefix]) {
    hint.textContent = SEARCH_PREFIXES[prefix].name;
    hint.dataset.prefix = prefix;
    hint.classList.add('active');
  } else {
    hint.classList.remove('active');
    hint.textContent = '';
  }

  // Update legend active state
  if (legend) {
    legend.querySelectorAll('.prefix-item').forEach(item => {
      item.classList.toggle('active', item.dataset.prefix === prefix);
    });
  }
}

// Keyboard navigation handler for search
function handleSearchKeyboard(e) {
  const dropdown = document.getElementById('search-results');
  if (!dropdown || dropdown.style.display === 'none') {
    if (e.key === 'Escape') {
      hideSearchResults();
      e.target.blur();
    }
    return;
  }

  const items = dropdown.querySelectorAll('.search-result-item, .search-history-item');
  const maxIndex = items.length - 1;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      searchSelectedIndex = Math.min(searchSelectedIndex + 1, maxIndex);
      updateSearchSelection(items);
      break;
    case 'ArrowUp':
      e.preventDefault();
      searchSelectedIndex = Math.max(searchSelectedIndex - 1, -1);
      updateSearchSelection(items);
      break;
    case 'Enter':
      e.preventDefault();
      if (searchSelectedIndex >= 0 && items[searchSelectedIndex]) {
        const item = items[searchSelectedIndex];
        if (item.classList.contains('search-history-item')) {
          // Apply history query
          const query = item.dataset.query;
          e.target.value = query;
          showingHistory = false;
          handleGlobalSearch(query);
        } else {
          handleSearchResultClick(item);
          addToSearchHistory(e.target.value);
        }
      }
      break;
    case 'Escape':
      e.preventDefault();
      hideSearchResults();
      e.target.blur();
      break;
    case 'Tab':
      // Allow tab to cycle through results
      if (items.length > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          searchSelectedIndex = searchSelectedIndex <= 0 ? maxIndex : searchSelectedIndex - 1;
        } else {
          searchSelectedIndex = searchSelectedIndex >= maxIndex ? 0 : searchSelectedIndex + 1;
        }
        updateSearchSelection(items);
      }
      break;
  }
}

// Update visual selection in dropdown
function updateSearchSelection(items) {
  items.forEach((item, index) => {
    item.classList.toggle('selected', index === searchSelectedIndex);
    if (index === searchSelectedIndex) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

// Show search history dropdown
function showSearchHistory() {
  const history = getSearchHistory();
  if (history.length === 0) {
    showSearchSuggestions();
    return;
  }

  showingHistory = true;
  searchSelectedIndex = -1;

  let dropdown = document.getElementById('search-results');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'search-results';
    dropdown.className = 'search-results-dropdown';
    document.querySelector('.sidebar-search')?.appendChild(dropdown);
  }

  dropdown.innerHTML = `
    <div class="search-history-header">
      <span><i class="ph ph-clock-counter-clockwise"></i> Recent searches</span>
      <button class="search-history-clear" onclick="clearSearchHistory(); hideSearchResults();" title="Clear history">
        <i class="ph ph-x"></i>
      </button>
    </div>
    ${history.map(h => `
      <div class="search-history-item" data-query="${escapeHtmlApp(h.query)}">
        <i class="ph ph-clock-counter-clockwise"></i>
        <span>${escapeHtmlApp(h.query)}</span>
      </div>
    `).join('')}
    <div class="search-history-footer">
      <span>Press ↑↓ to navigate, Enter to select</span>
    </div>
  `;

  dropdown.querySelectorAll('.search-history-item').forEach(item => {
    item.addEventListener('click', () => {
      const query = item.dataset.query;
      document.getElementById('global-search').value = query;
      showingHistory = false;
      handleGlobalSearch(query);
    });
  });

  dropdown.style.display = 'block';
}

// Show search suggestions when no history
function showSearchSuggestions() {
  let dropdown = document.getElementById('search-results');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'search-results';
    dropdown.className = 'search-results-dropdown';
    document.querySelector('.sidebar-search')?.appendChild(dropdown);
  }

  dropdown.innerHTML = `
    <div class="search-suggestions">
      <div class="search-suggestions-title">
        <i class="ph ph-lightbulb"></i>
        <span>Search tips</span>
      </div>
      <div class="search-suggestion-item" data-prefix="">
        <kbd></kbd><span>Search records by name</span>
      </div>
      <div class="search-suggestion-item" data-prefix="@">
        <kbd>@</kbd><span>Search all field values</span>
      </div>
      <div class="search-suggestion-item" data-prefix="#">
        <kbd>#</kbd><span>Find sets by name</span>
      </div>
      <div class="search-suggestion-item" data-prefix="/">
        <kbd>/</kbd><span>Search views/lenses</span>
      </div>
      <div class="search-suggestion-item" data-prefix=">">
        <kbd>></kbd><span>Run commands</span>
      </div>
      <div class="search-suggestions-hint">
        Type to search or use a prefix
      </div>
    </div>
  `;

  dropdown.querySelectorAll('.search-suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const prefix = item.dataset.prefix;
      const input = document.getElementById('global-search');
      input.value = prefix;
      input.focus();
      if (prefix) {
        showingHistory = false;
        handleGlobalSearch(prefix);
      }
    });
  });

  dropdown.style.display = 'block';
}

function handleGlobalSearch(query) {
  if (!query || query.length < 1) {
    if (document.activeElement?.id === 'global-search') {
      showSearchHistory();
    } else {
      hideSearchResults();
    }
    updateSearchPrefixHint('');
    return;
  }

  const { prefix, term } = parseSearchQuery(query);
  updateSearchPrefixHint(prefix);

  if (term.length < 1 && prefix !== '>') {
    hideSearchResults();
    return;
  }

  const workbench = getDataWorkbench();
  if (!workbench) return;

  let results = [];
  const termLower = term.toLowerCase();

  switch (prefix) {
    case '@': // Search field values across all sets
      results = searchFieldValues(workbench, termLower);
      break;
    case '#': // Search sets by name
      results = searchSets(workbench, termLower);
      break;
    case '/': // Search views/lenses
      results = searchViews(workbench, termLower);
      break;
    case '?': // Search sources
      results = searchSources(workbench, termLower);
      break;
    case '>': // Commands
      results = searchCommands(termLower);
      break;
    case '!': // Search by provenance
      results = searchByProvenance(workbench, termLower);
      break;
    default: // Unified search across all types
      results = searchUnified(workbench, termLower);
  }

  // Reset selection when results change
  searchSelectedIndex = -1;
  currentSearchResults = results;

  showSearchResults(results.slice(0, 20), prefix, query);
}

// Unified search across all types with ranking
function searchUnified(workbench, query) {
  const allResults = [];

  // Collect all searchable items
  const items = [];

  // Add sets
  workbench.getSets().forEach(set => {
    items.push({
      type: 'set',
      id: set.id,
      title: set.name,
      subtitle: `${set.records.length} records · ${set.fields.length} fields`,
      icon: set.icon || 'ph-table',
      searchText: set.name
    });

    // Add records (primary field)
    const primaryField = set.fields.find(f => f.isPrimary) || set.fields[0];
    set.records.forEach(record => {
      const primaryValue = record.values[primaryField?.id] || '';
      if (primaryValue) {
        items.push({
          type: 'record',
          id: record.id,
          setId: set.id,
          title: String(primaryValue),
          subtitle: set.name,
          icon: 'ph-file',
          searchText: String(primaryValue)
        });
      }
    });

    // Add views
    (set.views || []).forEach(view => {
      items.push({
        type: 'view',
        id: view.id,
        setId: set.id,
        title: view.name,
        subtitle: `${view.type} · ${set.name}`,
        icon: getViewIcon(view.type),
        searchText: view.name
      });
    });
  });

  // Add commands
  const commands = [
    { id: 'new_record', name: 'New Record', desc: 'Create a new record', icon: 'ph-plus', action: 'newRecord' },
    { id: 'new_set', name: 'New Set', desc: 'Create a new data set', icon: 'ph-table-plus', action: 'newSet' },
    { id: 'import', name: 'Import Data', desc: 'Import spreadsheet or data file', icon: 'ph-download', action: 'import' },
    { id: 'filter', name: 'Add Filter', desc: 'Create a focus/filter', icon: 'ph-funnel', action: 'filter' },
    { id: 'createExport', name: 'Create Export', desc: 'Download and record immutable export', icon: 'ph-export', action: 'createExport' },
    { id: 'settings', name: 'Settings', desc: 'Open settings', icon: 'ph-gear', action: 'settings' }
  ];
  commands.forEach(cmd => {
    items.push({
      type: 'command',
      id: cmd.id,
      title: cmd.name,
      subtitle: cmd.desc,
      icon: cmd.icon,
      action: cmd.action,
      searchText: `${cmd.name} ${cmd.desc}`
    });
  });

  // Use Fuse.js for fuzzy matching if available
  if (typeof Fuse !== 'undefined') {
    const fuse = new Fuse(items, {
      keys: ['searchText', 'title', 'subtitle'],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      ignoreLocation: true
    });
    const fuseResults = fuse.search(query);
    return fuseResults.map(r => ({ ...r.item, score: r.score }));
  }

  // Fallback: basic scoring
  return items
    .map(item => {
      const searchText = item.searchText.toLowerCase();
      let score = 1;

      if (searchText === query) {
        score = 0; // Exact match
      } else if (searchText.startsWith(query)) {
        score = 0.1; // Starts with
      } else if (searchText.includes(query)) {
        score = 0.3; // Contains
      } else {
        return null; // No match
      }

      // Boost certain types
      if (item.type === 'command') score -= 0.05;
      if (item.type === 'set') score -= 0.03;

      return { ...item, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);
}

function searchRecordsPrimary(workbench, query) {
  const results = [];
  workbench.getSets().forEach(set => {
    const primaryField = set.fields.find(f => f.isPrimary) || set.fields[0];
    set.records.forEach(record => {
      const primaryValue = record.values[primaryField?.id] || '';
      if (String(primaryValue).toLowerCase().includes(query)) {
        results.push({
          type: 'record',
          id: record.id,
          setId: set.id,
          title: String(primaryValue),
          subtitle: set.name,
          icon: 'ph-file'
        });
      }
    });
  });
  return results;
}

function searchFieldValues(workbench, query) {
  const results = [];
  // Parse field:value format if present
  const hasColon = query.includes(':');
  const [fieldPart, valuePart] = hasColon ? query.split(':') : ['', query];
  const searchTerm = valuePart || query;

  // First, search for field definitions that match the query
  // (when user searches @status, show fields named "status")
  if (!hasColon && query.length > 0) {
    const seenFields = new Set();
    workbench.getSets().forEach(set => {
      set.fields.forEach(field => {
        const fieldKey = `${set.id}:${field.id}`;
        if (field.name.toLowerCase().includes(query) && !seenFields.has(fieldKey)) {
          seenFields.add(fieldKey);
          results.push({
            type: 'field_definition',
            id: field.id,
            setId: set.id,
            title: field.name,
            subtitle: `${field.type} field in ${set.name}`,
            icon: 'ph-text-aa'
          });
        }
      });
    });
  }

  // Then, search for field values in records
  workbench.getSets().forEach(set => {
    set.records.forEach(record => {
      set.fields.forEach(field => {
        if (fieldPart && !field.name.toLowerCase().includes(fieldPart)) return;

        const value = record.values[field.id];
        if (value && String(value).toLowerCase().includes(searchTerm)) {
          const primaryField = set.fields.find(f => f.isPrimary) || set.fields[0];
          const primaryValue = record.values[primaryField?.id] || record.id;
          results.push({
            type: 'field_match',
            id: record.id,
            setId: set.id,
            title: `${field.name}: ${String(value).slice(0, 50)}`,
            subtitle: `${primaryValue} · ${set.name}`,
            icon: 'ph-text-aa'
          });
        }
      });
    });
  });
  return results;
}

function searchSets(workbench, query) {
  return workbench.getSets()
    .filter(set => set.name.toLowerCase().includes(query))
    .map(set => ({
      type: 'set',
      id: set.id,
      title: set.name,
      subtitle: `${set.records.length} records · ${set.fields.length} fields`,
      icon: set.icon || 'ph-table'
    }));
}

function searchViews(workbench, query) {
  const results = [];
  workbench.getSets().forEach(set => {
    (set.views || []).forEach(view => {
      if (view.name.toLowerCase().includes(query)) {
        results.push({
          type: 'view',
          id: view.id,
          setId: set.id,
          title: view.name,
          subtitle: `${view.type} · ${set.name}`,
          icon: getViewIcon(view.type)
        });
      }
    });
  });
  return results;
}

function searchSources(workbench, query) {
  const results = [];
  const sourceMap = new Map();

  workbench.getSets().forEach(set => {
    const prov = set.datasetProvenance;
    if (prov && prov.originalFilename) {
      const sourceName = prov.originalFilename;
      if (sourceName.toLowerCase().includes(query)) {
        if (!sourceMap.has(sourceName)) {
          sourceMap.set(sourceName, { sets: [], importedAt: prov.importedAt });
        }
        sourceMap.get(sourceName).sets.push(set);
      }
    }
  });

  sourceMap.forEach((data, sourceName) => {
    results.push({
      type: 'source',
      id: sourceName,
      title: sourceName,
      subtitle: `${data.sets.length} sets · Imported ${new Date(data.importedAt).toLocaleDateString()}`,
      icon: getSourceIcon(sourceName),
      sets: data.sets
    });
  });

  return results;
}

function searchCommands(query) {
  const commands = [
    { id: 'new_record', name: 'New Record', desc: 'Create a new record', icon: 'ph-plus', action: 'newRecord' },
    { id: 'new_set', name: 'New Set', desc: 'Create a new data set', icon: 'ph-table-plus', action: 'newSet' },
    { id: 'import', name: 'Import Data', desc: 'Import spreadsheet or data file', icon: 'ph-download', action: 'import' },
    { id: 'filter', name: 'Add Filter', desc: 'Create a focus/filter', icon: 'ph-funnel', action: 'filter' },
    { id: 'createExport', name: 'Create Export', desc: 'Download and record immutable export', icon: 'ph-export', action: 'createExport' },
    { id: 'settings', name: 'Settings', desc: 'Open settings', icon: 'ph-gear', action: 'settings' }
  ];

  return commands
    .filter(cmd => cmd.name.toLowerCase().includes(query) || cmd.desc.toLowerCase().includes(query))
    .map(cmd => ({
      type: 'command',
      id: cmd.id,
      title: cmd.name,
      subtitle: cmd.desc,
      icon: cmd.icon,
      action: cmd.action
    }));
}

function searchByProvenance(workbench, query) {
  const results = [];
  workbench.getSets().forEach(set => {
    const prov = set.datasetProvenance;
    if (prov) {
      const provenanceStr = JSON.stringify(prov).toLowerCase();
      if (provenanceStr.includes(query)) {
        results.push({
          type: 'set',
          id: set.id,
          title: set.name,
          subtitle: `Source: ${prov.originalFilename || 'Manual'}`,
          icon: 'ph-git-branch'
        });
      }
    }
  });
  return results;
}

function getViewIcon(type) {
  const icons = {
    table: 'ph-table',
    cards: 'ph-cards',
    kanban: 'ph-kanban',
    calendar: 'ph-calendar-blank',
    graph: 'ph-graph',
    filesystem: 'ph-folder-open'
  };
  return icons[type] || 'ph-table';
}

/**
 * Get icon for source based on sourceType or file extension
 * @param {string|Object} source - Filename string or source object
 * @returns {string} Phosphor icon class
 */
function getSourceIcon(source) {
  // If passed a source object, check sourceType first
  if (typeof source === 'object' && source !== null) {
    // Live source types get distinctive icons
    if (source.sourceType === 'rss') return 'ph-rss';
    if (source.sourceType === 'api') return 'ph-plugs-connected';
    if (source.sourceType === 'scrape') return 'ph-globe';
    if (source.sourceType === 'null') return 'ph-table';

    // Fall through to file extension check
    source = source.name || '';
  }

  // File extension based icons
  const filename = typeof source === 'string' ? source : '';
  const ext = filename.split('.').pop()?.toLowerCase();
  const icons = {
    csv: 'ph-file-csv',
    json: 'ph-file-code',
    xlsx: 'ph-file-xls',
    xls: 'ph-file-xls',
    ics: 'ph-calendar-blank'
  };
  return icons[ext] || 'ph-file';
}

function showSearchResults(results, prefix = '', query = '') {
  let dropdown = document.getElementById('search-results');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'search-results';
    dropdown.className = 'search-results-dropdown';
    document.querySelector('.sidebar-search')?.appendChild(dropdown);
  }

  if (results.length === 0) {
    const prefixInfo = SEARCH_PREFIXES[prefix];
    dropdown.innerHTML = `
      <div class="search-no-results">
        <i class="ph ph-magnifying-glass-minus"></i>
        <div class="search-no-results-text">
          <strong>${prefixInfo ? `No ${prefixInfo.name} found` : 'No results found'}</strong>
          <span>Try a different search term${!prefix ? ' or use a prefix' : ''}</span>
        </div>
        ${!prefix ? `
          <div class="search-no-results-hints">
            <span class="hint-chip" data-prefix="@"><kbd>@</kbd> fields</span>
            <span class="hint-chip" data-prefix="#"><kbd>#</kbd> sets</span>
            <span class="hint-chip" data-prefix=">"><kbd>></kbd> commands</span>
          </div>
        ` : ''}
      </div>
    `;

    dropdown.querySelectorAll('.hint-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const input = document.getElementById('global-search');
        const newQuery = chip.dataset.prefix + (query || '');
        input.value = newQuery;
        handleGlobalSearch(newQuery);
      });
    });
  } else {
    // Group results by type for unified search (no prefix)
    let html = '';
    if (!prefix) {
      const grouped = groupResultsByType(results);
      const typeLabels = {
        command: 'Commands',
        set: 'Sets',
        record: 'Records',
        view: 'Views',
        field_match: 'Field Matches',
        field_definition: 'Fields',
        source: 'Sources'
      };

      for (const [type, items] of Object.entries(grouped)) {
        if (items.length > 0) {
          html += `<div class="search-results-group">
            <div class="search-results-group-label">${typeLabels[type] || type}</div>
            ${items.map(r => renderSearchResultItem(r, query)).join('')}
          </div>`;
        }
      }
    } else {
      html = results.map(r => renderSearchResultItem(r, query)).join('');
    }

    // Add footer with count and keyboard hints
    html += `
      <div class="search-results-footer">
        <span>${results.length} result${results.length !== 1 ? 's' : ''}</span>
        <span class="search-footer-hint">↑↓ navigate · ↵ select · esc close</span>
      </div>
    `;

    dropdown.innerHTML = html;

    dropdown.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        handleSearchResultClick(item);
        addToSearchHistory(document.getElementById('global-search').value);
      });
    });
  }
  dropdown.style.display = 'block';
}

// Group results by type
function groupResultsByType(results) {
  const grouped = {
    command: [],
    set: [],
    view: [],
    record: [],
    field_match: [],
    field_definition: [],
    source: []
  };

  results.forEach(r => {
    if (grouped[r.type]) {
      grouped[r.type].push(r);
    }
  });

  return grouped;
}

// Render a single search result item with highlighting
function renderSearchResultItem(r, query = '') {
  const highlightedTitle = highlightMatch(r.title, query);
  const highlightedSubtitle = highlightMatch(r.subtitle, query);
  const typeIcon = getTypeIcon(r.type);

  return `
    <div class="search-result-item" data-type="${r.type}" data-id="${r.id}" data-set-id="${r.setId || ''}" data-action="${r.action || ''}">
      <i class="ph ${r.icon || 'ph-file'}"></i>
      <div class="search-result-content">
        <div class="search-result-title">${highlightedTitle}</div>
        <div class="search-result-subtitle">${highlightedSubtitle}</div>
      </div>
      <span class="search-result-type-badge type-${r.type}">${typeIcon}</span>
      ${r.type === 'command' ? '<kbd class="search-result-kbd">↵</kbd>' : ''}
    </div>
  `;
}

// Highlight matching text
function highlightMatch(text, query) {
  if (!text || !query) return escapeHtmlApp(text);
  const escaped = escapeHtmlApp(text);
  const queryLower = query.toLowerCase();
  const textLower = escaped.toLowerCase();
  const index = textLower.indexOf(queryLower);
  if (index === -1) return escaped;
  return escaped.slice(0, index) +
    '<mark class="search-highlight">' +
    escaped.slice(index, index + query.length) +
    '</mark>' +
    escaped.slice(index + query.length);
}

// Get icon for result type badge
function getTypeIcon(type) {
  const icons = {
    command: '<i class="ph ph-terminal"></i>',
    set: '<i class="ph ph-table"></i>',
    record: '<i class="ph ph-file"></i>',
    view: '<i class="ph ph-eye"></i>',
    field_match: '<i class="ph ph-text-aa"></i>',
    field_definition: '<i class="ph ph-text-columns"></i>',
    source: '<i class="ph ph-download-simple"></i>'
  };
  return icons[type] || '';
}

function handleSearchResultClick(item) {
  const type = item.dataset.type;
  const id = item.dataset.id;
  const setId = item.dataset.setId;
  const action = item.dataset.action;

  switch (type) {
    case 'set':
      _dataWorkbench?._selectSet(id);
      break;
    case 'record':
    case 'field_match':
      if (setId) {
        _dataWorkbench?._selectSet(setId);
        setTimeout(() => _dataWorkbench?._showRecordDetail(id), 100);
      }
      break;
    case 'field_definition':
      // Navigate to the set and open the schema panel
      if (setId) {
        _dataWorkbench?._selectSet(setId, 'schema');
      }
      break;
    case 'view':
      if (setId) {
        _dataWorkbench?._selectSet(setId);
        setTimeout(() => _dataWorkbench?._selectView(id), 100);
      }
      break;
    case 'source':
      // Expand source in sidebar and scroll to it
      const sourceGroup = document.querySelector(`.source-group[data-source="${id}"]`);
      if (sourceGroup) {
        sourceGroup.classList.add('expanded');
        sourceGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      break;
    case 'command':
      executeCommand(action);
      break;
  }

  hideSearchResults();
  document.getElementById('global-search').value = '';
}

function executeCommand(action) {
  switch (action) {
    case 'newRecord':
      _dataWorkbench?.addRecord();
      break;
    case 'newSet':
      _dataWorkbench?._showNewSetModal?.() || document.getElementById('btn-new-set')?.click();
      break;
    case 'import':
      showImportModal?.() || document.getElementById('btn-import')?.click();
      break;
    case 'filter':
      document.getElementById('btn-filter')?.click();
      break;
    case 'createExport':
      document.getElementById('btn-export')?.click();
      break;
    case 'settings':
      showSettingsModal();
      break;
  }
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

/**
 * Ensure the sync API is initialized
 * Returns the sync API instance or null if initialization fails
 */
function ensureSyncAPI() {
  // Check if already initialized
  if (typeof window.getEOSyncAPI === 'function') {
    const existingAPI = window.getEOSyncAPI();
    if (existingAPI) {
      return existingAPI;
    }
  }

  // Try to initialize it
  if (typeof window.initSyncAPI === 'function' && typeof window.getEventStore === 'function') {
    const eventStore = window.getEventStore();
    if (eventStore) {
      return window.initSyncAPI(eventStore);
    }
  }

  return null;
}

function showSyncDetails() {
  // Use the sync wizard if available
  if (typeof window.showSyncWizard === 'function') {
    const syncAPI = ensureSyncAPI();
    if (syncAPI) {
      window.showSyncWizard(syncAPI);
      return;
    }
  }
  // Fallback: open settings modal with sync section visible
  showSettingsModal();
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

  // Get sync status for display
  let syncStatusHtml = '';
  const syncAPI = ensureSyncAPI();
  if (syncAPI) {
    const status = syncAPI.getStatus();
    const config = syncAPI.config || {};

      if (status.configured && status.enabled) {
        const hostname = config.endpoint ? (() => { try { return new URL(config.endpoint).hostname; } catch { return config.endpoint; } })() : 'Unknown';
        syncStatusHtml = `
          <div class="settings-sync-status settings-sync-enabled">
            <div class="settings-sync-indicator">
              <i class="ph ph-cloud-check"></i>
              <span>Cloud sync enabled</span>
            </div>
            <div class="settings-sync-details">
              <span>Server: ${hostname}</span>
              ${status.lastSync ? `<span>Last sync: ${formatTimeAgo(status.lastSync.timestamp)}</span>` : ''}
            </div>
          </div>
        `;
      } else if (status.configured) {
        syncStatusHtml = `
          <div class="settings-sync-status settings-sync-disabled">
            <div class="settings-sync-indicator">
              <i class="ph ph-cloud-slash"></i>
              <span>Cloud sync configured but disabled</span>
            </div>
          </div>
        `;
      } else {
        syncStatusHtml = `
          <div class="settings-sync-status settings-sync-not-configured">
            <div class="settings-sync-indicator">
              <i class="ph ph-cloud"></i>
              <span>Cloud sync not configured</span>
            </div>
            <p class="settings-sync-hint">Set up cloud sync to backup and sync your data across devices.</p>
          </div>
        `;
      }
  }

  modalTitle.textContent = 'Settings';
  modalBody.innerHTML = `
    <div class="form-group">
      <label class="form-label"><i class="ph ph-cloud-arrow-up"></i> Cloud Sync</label>
      ${syncStatusHtml}
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
        <button class="btn btn-primary" id="settings-configure-sync">
          <i class="ph ph-gear"></i> Configure Sync
        </button>
        <button class="btn btn-secondary" id="settings-sync-now" style="display: none;">
          <i class="ph ph-arrows-clockwise"></i> Sync Now
        </button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label"><i class="ph ph-file-csv"></i> Import Data</label>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
        <button class="btn btn-secondary" onclick="closeModal(); setTimeout(showImportModal, 100);">
          <i class="ph ph-download-simple"></i> Import CSV / JSON
        </button>
      </div>
      <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
        Import data from CSV or JSON files with automatic field type detection.
      </p>
    </div>
    <div class="form-group">
      <label class="form-label"><i class="ph ph-database"></i> Data Management</label>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-secondary" onclick="exportAllData()"><i class="ph ph-export"></i> Export JSON</button>
        <button class="btn btn-secondary" onclick="clearSampleData()"><i class="ph ph-flask"></i> Clear Sample Data</button>
        <button class="btn btn-danger" onclick="clearAllData()"><i class="ph ph-trash"></i> Clear All</button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label"><i class="ph ph-book-open"></i> Documentation</label>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-secondary" id="settings-formula-guide">
          <i class="ph ph-function"></i> Formula Language Guide
        </button>
      </div>
      <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
        Learn about Noema's formula syntax, EO operators, and semantic functions.
      </p>
    </div>
    <div class="form-group">
      <label class="form-label"><i class="ph ph-info"></i> About</label>
      <div style="font-size: 12px; color: var(--text-muted);">Noema v1.0.0<br>Data Workbench with EO Sync</div>
    </div>
  `;
  modalFooter.innerHTML = '<button class="btn btn-secondary" onclick="closeModal()">Close</button>';
  modal.classList.add('active');

  // Setup sync button handlers
  const configureSyncBtn = document.getElementById('settings-configure-sync');
  const syncNowBtn = document.getElementById('settings-sync-now');

  if (configureSyncBtn) {
    configureSyncBtn.addEventListener('click', () => {
      closeModal();
      setTimeout(() => {
        if (typeof window.showSyncWizard === 'function') {
          const syncAPIForWizard = ensureSyncAPI();
          if (syncAPIForWizard) {
            window.showSyncWizard(syncAPIForWizard);
          }
        }
      }, 100);
    });
  }

  // Show/enable sync now button if configured and enabled
  if (syncAPI) {
    const status = syncAPI.getStatus();
    if (status.configured && status.enabled && syncNowBtn) {
      syncNowBtn.style.display = 'inline-flex';
      syncNowBtn.addEventListener('click', async () => {
        syncNowBtn.disabled = true;
        syncNowBtn.innerHTML = '<i class="ph ph-arrows-clockwise spinning"></i> Syncing...';
        try {
          await syncAPI.sync();
          syncNowBtn.innerHTML = '<i class="ph ph-check-circle"></i> Synced!';
          setTimeout(() => {
            syncNowBtn.disabled = false;
            syncNowBtn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Sync Now';
          }, 2000);
        } catch (err) {
          syncNowBtn.innerHTML = '<i class="ph ph-x-circle"></i> Failed';
          setTimeout(() => {
            syncNowBtn.disabled = false;
            syncNowBtn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Sync Now';
          }, 2000);
        }
      });
    }
  }

  // Formula guide button handler
  const formulaGuideBtn = document.getElementById('settings-formula-guide');
  if (formulaGuideBtn) {
    formulaGuideBtn.addEventListener('click', () => {
      closeModal();
      setTimeout(() => {
        if (typeof window.showFormulaExplainer === 'function') {
          window.showFormulaExplainer();
        }
      }, 100);
    });
  }
}

function formatTimeAgo(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

  return date.toLocaleDateString();
}

function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('active');

  // Restore standard modal footer buttons (some modals replace these with custom buttons)
  const modalFooter = document.getElementById('modal-footer');
  if (modalFooter) {
    modalFooter.innerHTML = `
      <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
      <button class="btn btn-primary" id="modal-confirm">Save</button>
    `;
    // Re-attach cancel click handler
    document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  }
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
  a.download = `laksana-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  closeModal();
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

function clearSampleData() {
  const wb = getDataWorkbench();
  if (!wb) return;

  // Find all sample projects (using isSample flag)
  const sampleProjects = wb.projects?.filter(p => p.isSample === true) || [];

  // Also find any orphaned sample sources/sets (for backwards compatibility)
  const sampleSources = wb.sources?.filter(s => s.isSample === true) || [];
  const sampleSets = wb.sets?.filter(s => s.isSample === true) || [];

  if (sampleProjects.length === 0 && sampleSources.length === 0 && sampleSets.length === 0) {
    if (typeof wb._showToast === 'function') {
      wb._showToast('No sample data found', 'info');
    } else {
      alert('No sample data found');
    }
    return;
  }

  if (!confirm('Clear sample data? This will permanently remove all sample projects and their contents.')) return;

  // Collect all IDs to remove from sample projects
  const sourceIdsToRemove = new Set(sampleSources.map(s => s.id));
  const setIdsToRemove = new Set(sampleSets.map(s => s.id));
  const definitionIdsToRemove = new Set();
  const exportIdsToRemove = new Set();

  for (const project of sampleProjects) {
    (project.sourceIds || []).forEach(id => sourceIdsToRemove.add(id));
    (project.setIds || []).forEach(id => setIdsToRemove.add(id));
    (project.definitionIds || []).forEach(id => definitionIdsToRemove.add(id));
    (project.exportIds || []).forEach(id => exportIdsToRemove.add(id));
  }

  // Remove associated sources
  if (sourceIdsToRemove.size > 0) {
    wb.sources = wb.sources?.filter(s => !sourceIdsToRemove.has(s.id)) || [];
  }

  // Remove associated sets
  if (setIdsToRemove.size > 0) {
    wb.sets = wb.sets?.filter(s => !setIdsToRemove.has(s.id)) || [];
  }

  // Remove associated definitions
  if (definitionIdsToRemove.size > 0) {
    wb.definitions = wb.definitions?.filter(d => !definitionIdsToRemove.has(d.id)) || [];
  }

  // Remove associated exports
  if (exportIdsToRemove.size > 0) {
    wb.exports = wb.exports?.filter(e => !exportIdsToRemove.has(e.id)) || [];
  }

  // Remove the sample projects
  wb.projects = wb.projects?.filter(p => p.isSample !== true) || [];

  // Clear current project selection if it was a sample project
  if (sampleProjects.some(p => p.id === wb.currentProjectId)) {
    wb.currentProjectId = null;
  }

  // Clear current set/view/source/lens if they reference sample data
  if (setIdsToRemove.has(wb.currentSetId)) {
    wb.currentSetId = null;
    wb.currentViewId = null;
    wb.currentLensId = null;
  }
  if (sourceIdsToRemove.has(wb.currentSourceId)) {
    wb.currentSourceId = null;
  }

  // Remove browser tabs that reference sample sets or sources
  if (wb.browserTabs && wb.browserTabs.length > 0) {
    wb.browserTabs = wb.browserTabs.filter(tab => {
      if (tab.type === 'set' || tab.type === 'view' || tab.type === 'schema' || tab.type === 'lens') {
        return !setIdsToRemove.has(tab.contentId);
      }
      if (tab.type === 'source') {
        return !sourceIdsToRemove.has(tab.contentId);
      }
      return true;
    });
    // If active tab was removed, switch to first available tab
    if (wb.activeTabId && !wb.browserTabs.find(t => t.id === wb.activeTabId)) {
      if (wb.browserTabs.length > 0) {
        wb.activeTabId = wb.browserTabs[0].id;
        if (typeof wb._syncStateFromTab === 'function') {
          wb._syncStateFromTab(wb.browserTabs[0]);
        }
      } else {
        wb.activeTabId = null;
      }
    }
  }

  // Clean up expanded state for sample projects, sets, and lenses
  if (wb.expandedProjects) {
    for (const project of sampleProjects) {
      delete wb.expandedProjects[project.id];
    }
  }
  if (wb.expandedSets) {
    for (const setId of setIdsToRemove) {
      delete wb.expandedSets[setId];
    }
  }
  if (wb.lastViewPerSet) {
    for (const setId of setIdsToRemove) {
      delete wb.lastViewPerSet[setId];
    }
  }
  // Clean up expanded lenses state (lenses belong to sets, so we need to find them)
  if (wb.expandedLenses) {
    // Since sample sets have been removed, clear any orphaned lens references
    for (const lensId of Object.keys(wb.expandedLenses)) {
      // Check if any remaining set has this lens
      const lensExists = (wb.sets || []).some(s =>
        s.lenses?.some(l => l.id === lensId)
      );
      if (!lensExists) {
        delete wb.expandedLenses[lensId];
      }
    }
  }

  // Save and refresh
  if (typeof wb._saveData === 'function') {
    wb._saveData();
  }
  if (typeof wb._renderSidebar === 'function') {
    wb._renderSidebar();
  }
  if (typeof wb._renderTabBar === 'function') {
    wb._renderTabBar();
  }
  if (typeof wb._renderView === 'function') {
    wb._renderView();
  }
  if (typeof wb._updateBreadcrumb === 'function') {
    wb._updateBreadcrumb();
  }

  // Close the settings modal
  closeModal();

  if (typeof wb._showToast === 'function') {
    wb._showToast('Sample data cleared', 'success');
  }
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
  /* Search dropdown base */
  .search-results-dropdown {
    position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px;
    background: var(--bg-secondary); border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
    max-height: 400px; overflow-y: auto; z-index: 100; display: none;
  }

  /* Search result items */
  .search-result-item {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer;
    border-left: 3px solid transparent; transition: all 0.15s ease;
  }
  .search-result-item:hover { background: var(--bg-hover); }
  .search-result-item.selected {
    background: var(--primary-50, rgba(59, 130, 246, 0.1));
    border-left-color: var(--primary-500, #3b82f6);
  }
  .search-result-item > i { font-size: 16px; color: var(--text-muted); width: 20px; flex-shrink: 0; }
  .search-result-content { flex: 1; min-width: 0; }
  .search-result-title { font-size: 13px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .search-result-subtitle { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .search-result-kbd { font-size: 10px; padding: 2px 6px; background: var(--bg-tertiary); border-radius: 3px; color: var(--text-muted); }
  .search-result-type-badge { font-size: 12px; color: var(--text-muted); opacity: 0.7; }
  .search-highlight { background: var(--warning-100, #fef3c7); color: var(--warning-800, #92400e); padding: 0 2px; border-radius: 2px; }

  /* Results grouping */
  .search-results-group { border-bottom: 1px solid var(--border-secondary); }
  .search-results-group:last-of-type { border-bottom: none; }
  .search-results-group-label {
    font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--text-muted); padding: 8px 12px 4px; background: var(--bg-tertiary);
  }

  /* Results footer */
  .search-results-footer {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 12px; font-size: 11px; color: var(--text-muted);
    border-top: 1px solid var(--border-secondary); background: var(--bg-tertiary);
    position: sticky; bottom: 0;
  }
  .search-footer-hint { opacity: 0.7; }

  /* No results state */
  .search-no-results {
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    padding: 24px 20px; color: var(--text-muted); text-align: center;
  }
  .search-no-results > i { font-size: 32px; opacity: 0.5; }
  .search-no-results-text { display: flex; flex-direction: column; gap: 4px; }
  .search-no-results-text strong { font-size: 14px; color: var(--text-secondary); }
  .search-no-results-text span { font-size: 12px; }
  .search-no-results-hints { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; justify-content: center; }
  .hint-chip {
    display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;
    background: var(--bg-tertiary); border-radius: 12px; font-size: 11px;
    cursor: pointer; transition: background 0.15s;
  }
  .hint-chip:hover { background: var(--bg-hover); }
  .hint-chip kbd { font-size: 10px; font-weight: 600; color: var(--primary-500); }

  /* Search history */
  .search-history-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 12px 6px; font-size: 11px; color: var(--text-muted);
    border-bottom: 1px solid var(--border-secondary);
  }
  .search-history-header span { display: flex; align-items: center; gap: 6px; }
  .search-history-clear {
    background: none; border: none; cursor: pointer; padding: 4px;
    color: var(--text-muted); border-radius: 4px; transition: all 0.15s;
  }
  .search-history-clear:hover { background: var(--bg-hover); color: var(--text-primary); }
  .search-history-item {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px;
    cursor: pointer; border-left: 3px solid transparent; transition: all 0.15s;
  }
  .search-history-item:hover { background: var(--bg-hover); }
  .search-history-item.selected {
    background: var(--primary-50, rgba(59, 130, 246, 0.1));
    border-left-color: var(--primary-500, #3b82f6);
  }
  .search-history-item i { font-size: 14px; color: var(--text-muted); }
  .search-history-item span { font-size: 13px; color: var(--text-primary); }
  .search-history-footer {
    padding: 8px 12px; font-size: 11px; color: var(--text-muted);
    border-top: 1px solid var(--border-secondary); background: var(--bg-tertiary);
    text-align: center;
  }

  /* Search suggestions */
  .search-suggestions { padding: 12px; }
  .search-suggestions-title {
    display: flex; align-items: center; gap: 6px; font-size: 12px;
    font-weight: 500; color: var(--text-secondary); margin-bottom: 10px;
  }
  .search-suggestion-item {
    display: flex; align-items: center; gap: 10px; padding: 8px 10px;
    border-radius: var(--radius-md); cursor: pointer; transition: background 0.15s;
  }
  .search-suggestion-item:hover { background: var(--bg-hover); }
  .search-suggestion-item kbd {
    min-width: 20px; text-align: center; font-size: 12px; font-weight: 600;
    color: var(--primary-500); background: var(--primary-50, rgba(59, 130, 246, 0.1));
    padding: 2px 6px; border-radius: 4px;
  }
  .search-suggestion-item span { font-size: 13px; color: var(--text-secondary); }
  .search-suggestions-hint {
    margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-secondary);
    font-size: 11px; color: var(--text-muted); text-align: center;
  }

  /* Base sidebar search */
  .sidebar-search { position: relative; }

  /* Select dropdown (generic) */
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
  window.clearAllData = clearAllData;
  window.closeModal = closeModal;
}
