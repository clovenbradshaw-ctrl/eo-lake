/**
 * EO Sync API - Cloud Sync Interface
 *
 * Implements POST (push local events) and GET (pull remote events)
 * for append-only event synchronization.
 *
 * Designed for backup with future-proofing for intelligent delta sync.
 */

/**
 * Sync API Configuration
 */
const SyncAPIConfig = {
  // Stored in localStorage
  STORAGE_KEY: 'eo_sync_config',
  LAST_SYNC_KEY: 'eo_last_sync',

  // Defaults
  DEFAULT_TIMEOUT: 30000,
  MAX_RETRIES: 4,
  RETRY_DELAYS: [2000, 4000, 8000, 16000],

  // Batch size for pushing events
  PUSH_BATCH_SIZE: 100
};

/**
 * Sync API Client
 */
class EOSyncAPI {
  constructor(eventStore) {
    this.eventStore = eventStore;
    this.config = this._loadConfig();
    this.lastSync = this._loadLastSync();
    this.syncInProgress = false;
    this.lastError = null;

    // Subscribers for status updates
    this._subscribers = [];
  }

  /**
   * Load configuration from localStorage
   */
  _loadConfig() {
    try {
      const stored = localStorage.getItem(SyncAPIConfig.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('EOSyncAPI: Failed to load config', e);
    }
    return {
      endpoint: '',
      authToken: '',
      workspaceId: 'default',
      enabled: false
    };
  }

  /**
   * Save configuration to localStorage
   */
  _saveConfig() {
    try {
      localStorage.setItem(SyncAPIConfig.STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('EOSyncAPI: Failed to save config', e);
    }
  }

  /**
   * Load last sync info from localStorage
   */
  _loadLastSync() {
    try {
      const stored = localStorage.getItem(SyncAPIConfig.LAST_SYNC_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('EOSyncAPI: Failed to load last sync', e);
    }
    return {
      timestamp: null,
      serverClock: 0,
      pushedCount: 0,
      pulledCount: 0
    };
  }

  /**
   * Save last sync info to localStorage
   */
  _saveLastSync() {
    try {
      localStorage.setItem(SyncAPIConfig.LAST_SYNC_KEY, JSON.stringify(this.lastSync));
    } catch (e) {
      console.warn('EOSyncAPI: Failed to save last sync', e);
    }
  }

  /**
   * Configure the sync API
   */
  configure(options) {
    this.config = {
      ...this.config,
      ...options
    };
    this._saveConfig();
    this._notifySubscribers('configured');
    console.log('EOSyncAPI: Configured', { endpoint: this.config.endpoint, enabled: this.config.enabled });
  }

  /**
   * Check if sync is configured and enabled
   */
  isConfigured() {
    return this.config.endpoint && this.config.authToken && this.config.enabled;
  }

  /**
   * Get current sync status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      enabled: this.config.enabled,
      endpoint: this.config.endpoint,
      workspaceId: this.config.workspaceId,
      syncInProgress: this.syncInProgress,
      lastSync: this.lastSync,
      lastError: this.lastError,
      localEventCount: this.eventStore?.getAll()?.length || 0
    };
  }

  /**
   * Subscribe to status updates
   */
  subscribe(callback) {
    this._subscribers.push(callback);
    return () => {
      this._subscribers = this._subscribers.filter(s => s !== callback);
    };
  }

  /**
   * Notify subscribers of status changes
   */
  _notifySubscribers(event, data = {}) {
    const status = this.getStatus();
    for (const subscriber of this._subscribers) {
      try {
        subscriber({ event, status, ...data });
      } catch (e) {
        console.error('EOSyncAPI: Subscriber error', e);
      }
    }
  }

  /**
   * Make an authenticated API request with retry logic
   */
  async _fetch(path, options = {}, retryCount = 0) {
    const url = `${this.config.endpoint}${path}`;

    const fetchOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.authToken}`,
        'X-Workspace-ID': this.config.workspaceId,
        ...options.headers
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SyncAPIConfig.DEFAULT_TIMEOUT);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();

    } catch (error) {
      // Retry on network errors
      if (retryCount < SyncAPIConfig.MAX_RETRIES &&
          (error.name === 'AbortError' || error.message.includes('network') || error.message.includes('fetch'))) {
        const delay = SyncAPIConfig.RETRY_DELAYS[retryCount];
        console.log(`EOSyncAPI: Retry ${retryCount + 1} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this._fetch(path, options, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * POST events to the server (push local events)
   *
   * Per the handbook:
   * - Events are appended, never modified
   * - Server assigns logical_clock for ordering
   * - Duplicates are idempotent (not errors)
   */
  async pushEvents(events = null) {
    if (!this.isConfigured()) {
      throw new Error('Sync not configured');
    }

    // Get all local events if not specified
    if (!events) {
      events = this.eventStore.getAll();
    }

    if (events.length === 0) {
      return { pushed: 0, accepted: [], rejected: [], conflicts: [] };
    }

    console.log(`EOSyncAPI: Pushing ${events.length} events`);

    const results = {
      pushed: 0,
      accepted: [],
      rejected: [],
      conflicts: []
    };

    // Push in batches
    for (let i = 0; i < events.length; i += SyncAPIConfig.PUSH_BATCH_SIZE) {
      const batch = events.slice(i, i + SyncAPIConfig.PUSH_BATCH_SIZE);

      try {
        const response = await this._fetch('/api/v1/events', {
          method: 'POST',
          body: JSON.stringify({
            events: batch.map(e => this._prepareEventForSync(e)),
            workspace_id: this.config.workspaceId
          })
        });

        results.pushed += batch.length;
        results.accepted.push(...(response.accepted || []));
        results.rejected.push(...(response.rejected || []));
        results.conflicts.push(...(response.conflicts || []));

        // Update server clock if provided
        if (response.server_logical_clock) {
          this.lastSync.serverClock = Math.max(
            this.lastSync.serverClock || 0,
            response.server_logical_clock
          );
        }

      } catch (error) {
        console.error('EOSyncAPI: Push batch failed', error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Prepare an event for sync (ensure required fields)
   */
  _prepareEventForSync(event) {
    return {
      id: event.id,
      epistemic_type: event.epistemicType || event.type || 'given',
      category: event.category || this._inferCategory(event),
      action: event.action || event.payload?.action || 'unknown',
      actor: event.actor,
      timestamp: event.timestamp,
      logical_clock: event.logicalClock,
      parents: event.parents || [],
      entity_id: event.payload?.setId || event.payload?.recordId || event.payload?.fieldId || null,
      entity_type: this._inferEntityType(event),
      context: event.context || { workspace: this.config.workspaceId, schemaVersion: '1.0' },
      grounding: event.grounding || null,
      frame: event.frame || null,
      supersession: event.supersession || null,
      payload: event.payload
    };
  }

  /**
   * Infer event category from payload
   */
  _inferCategory(event) {
    const action = event.action || event.payload?.action || '';
    if (action.includes('set_') || action.includes('field_')) return 'schema';
    if (action.includes('record_')) return 'data';
    if (action.includes('view_') || action.includes('focus_')) return 'view';
    if (action.includes('import')) return 'import';
    if (action.includes('edge')) return 'edge';
    return 'data';
  }

  /**
   * Infer entity type from event
   */
  _inferEntityType(event) {
    const payload = event.payload || {};
    if (payload.recordId) return 'record';
    if (payload.fieldId) return 'field';
    if (payload.setId) return 'set';
    if (payload.viewId) return 'view';
    return 'workspace';
  }

  /**
   * GET events from the server (pull remote events)
   *
   * For v1: Pull all events (simple backup/restore)
   * Future: Use since_clock for delta sync
   */
  async pullEvents(options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Sync not configured');
    }

    const params = new URLSearchParams({
      workspace_id: this.config.workspaceId
    });

    // Future: Add delta sync support
    if (options.sinceClock !== undefined) {
      params.append('since_clock', options.sinceClock);
    }

    // Future: Add category filtering
    if (options.category) {
      params.append('category', options.category);
    }

    // Pagination
    if (options.limit) {
      params.append('limit', options.limit);
    }
    if (options.cursor) {
      params.append('cursor', options.cursor);
    }

    console.log(`EOSyncAPI: Pulling events`, Object.fromEntries(params));

    const response = await this._fetch(`/api/v1/events?${params.toString()}`, {
      method: 'GET'
    });

    const events = response.events || [];

    // Update server clock
    if (response.latest_clock || response.server_clock) {
      this.lastSync.serverClock = response.latest_clock || response.server_clock;
    }

    return {
      events,
      hasMore: response.has_more || false,
      nextCursor: response.next_cursor || null,
      count: events.length,
      serverClock: this.lastSync.serverClock
    };
  }

  /**
   * Apply pulled events to local store
   */
  applyPulledEvents(events) {
    const results = {
      applied: 0,
      duplicates: 0,
      parked: 0,
      errors: []
    };

    for (const event of events) {
      try {
        // Convert from API format to local format
        const localEvent = this._convertFromAPIFormat(event);

        const result = this.eventStore.append(localEvent);

        if (result.success) {
          if (result.duplicate) {
            results.duplicates++;
          } else if (result.parked) {
            results.parked++;
          } else {
            results.applied++;
          }
        } else {
          results.errors.push({ id: event.id, error: result.error });
        }
      } catch (error) {
        results.errors.push({ id: event.id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Convert API event format to local format
   */
  _convertFromAPIFormat(apiEvent) {
    return {
      id: apiEvent.id,
      type: apiEvent.epistemic_type || apiEvent.type || 'given',
      epistemicType: apiEvent.epistemic_type || apiEvent.type || 'given',
      category: apiEvent.category,
      action: apiEvent.action,
      actor: apiEvent.actor,
      timestamp: apiEvent.timestamp,
      logicalClock: apiEvent.logical_clock,
      parents: apiEvent.parents || [],
      context: apiEvent.context || {},
      grounding: apiEvent.grounding,
      frame: apiEvent.frame,
      supersession: apiEvent.supersession,
      payload: apiEvent.payload
    };
  }

  /**
   * Full sync: Push then Pull
   *
   * Order matters:
   * 1. Push local events first (so server knows about them)
   * 2. Pull remote events (including any from other devices)
   * 3. Apply pulled events to local store
   */
  async sync() {
    if (!this.isConfigured()) {
      throw new Error('Sync not configured');
    }

    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    this.lastError = null;
    this._notifySubscribers('sync_started');

    const syncResult = {
      success: false,
      pushed: 0,
      pulled: 0,
      applied: 0,
      conflicts: [],
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Step 1: Push local events
      console.log('EOSyncAPI: Step 1 - Pushing local events');
      const pushResult = await this.pushEvents();
      syncResult.pushed = pushResult.pushed;
      syncResult.conflicts = pushResult.conflicts;

      if (pushResult.rejected.length > 0) {
        console.warn('EOSyncAPI: Some events rejected', pushResult.rejected);
        syncResult.errors.push(...pushResult.rejected.map(r => ({ type: 'push_rejected', ...r })));
      }

      // Step 2: Pull remote events (full sync for now)
      console.log('EOSyncAPI: Step 2 - Pulling remote events');
      let allPulledEvents = [];
      let cursor = null;
      let hasMore = true;

      while (hasMore) {
        const pullResult = await this.pullEvents({ cursor, limit: 1000 });
        allPulledEvents.push(...pullResult.events);
        hasMore = pullResult.hasMore;
        cursor = pullResult.nextCursor;
      }

      syncResult.pulled = allPulledEvents.length;

      // Step 3: Apply pulled events
      console.log(`EOSyncAPI: Step 3 - Applying ${allPulledEvents.length} events`);
      const applyResult = this.applyPulledEvents(allPulledEvents);
      syncResult.applied = applyResult.applied;

      if (applyResult.errors.length > 0) {
        syncResult.errors.push(...applyResult.errors.map(e => ({ type: 'apply_error', ...e })));
      }

      // Update last sync info
      this.lastSync = {
        timestamp: syncResult.timestamp,
        serverClock: this.lastSync.serverClock,
        pushedCount: syncResult.pushed,
        pulledCount: syncResult.pulled
      };
      this._saveLastSync();

      syncResult.success = true;
      console.log('EOSyncAPI: Sync complete', syncResult);

    } catch (error) {
      console.error('EOSyncAPI: Sync failed', error);
      this.lastError = error.message;
      syncResult.errors.push({ type: 'sync_error', error: error.message });

      // Record sync failure as an event (Rule 7: Failure is a state)
      this._recordSyncFailure(error);

    } finally {
      this.syncInProgress = false;
      this._notifySubscribers('sync_completed', { result: syncResult });
    }

    return syncResult;
  }

  /**
   * Record sync failure as an event
   */
  _recordSyncFailure(error) {
    if (!this.eventStore) return;

    try {
      const failureEvent = {
        id: 'evt_sync_fail_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6),
        type: 'given',
        epistemicType: 'given',
        category: 'system',
        action: 'sync_failure',
        actor: 'sync_api',
        timestamp: new Date().toISOString(),
        logicalClock: Date.now(),
        parents: [],
        context: {
          workspace: this.config.workspaceId,
          schemaVersion: '1.0'
        },
        payload: {
          action: 'sync_failure',
          error: error.message,
          endpoint: this.config.endpoint
        }
      };

      this.eventStore.append(failureEvent);
    } catch (e) {
      console.error('EOSyncAPI: Failed to record sync failure event', e);
    }
  }

  /**
   * Test the connection to the API
   */
  async testConnection() {
    if (!this.config.endpoint || !this.config.authToken) {
      return { success: false, error: 'Endpoint and auth token required' };
    }

    try {
      // Try to fetch with limit 0 just to test auth
      const params = new URLSearchParams({
        workspace_id: this.config.workspaceId,
        limit: '1'
      });

      await this._fetch(`/api/v1/events?${params.toString()}`, { method: 'GET' });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
let _syncAPI = null;

function getSyncAPI() {
  return _syncAPI;
}

function initSyncAPI(eventStore) {
  _syncAPI = new EOSyncAPI(eventStore);
  return _syncAPI;
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EOSyncAPI,
    SyncAPIConfig,
    getSyncAPI,
    initSyncAPI
  };
}

if (typeof window !== 'undefined') {
  window.EOSyncAPI = EOSyncAPI;
  window.SyncAPIConfig = SyncAPIConfig;
  window.getSyncAPI = getSyncAPI;
  window.initSyncAPI = initSyncAPI;
}
