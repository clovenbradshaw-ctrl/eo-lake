/**
 * EO Sync API - Cloud Sync Interface
 *
 * Implements POST (push local events) and GET (pull remote events)
 * for append-only event synchronization.
 *
 * Designed for backup with future-proofing for intelligent delta sync.
 *
 * =============================================================================
 * SERVER-SIDE DATABASE SCHEMA
 * =============================================================================
 *
 * The server implementing this API should use the following schema.
 * Examples are provided for PostgreSQL, but the design works with any
 * relational database.
 *
 * -----------------------------------------------------------------------------
 * EVENTS TABLE
 * -----------------------------------------------------------------------------
 *
 * CREATE TABLE events (
 *   -- Primary identification
 *   id                VARCHAR(64) PRIMARY KEY,        -- Client-generated event ID (e.g., "evt_abc123")
 *   workspace_id      VARCHAR(64) NOT NULL,           -- Workspace/tenant isolation
 *
 *   -- Server-assigned ordering (critical for sync)
 *   logical_clock     BIGINT NOT NULL,                -- Server-assigned monotonic clock
 *
 *   -- Epistemic metadata
 *   epistemic_type    VARCHAR(32) NOT NULL,           -- 'given', 'derived', 'asserted', 'retracted'
 *   category          VARCHAR(32) NOT NULL,           -- 'schema', 'data', 'view', 'import', 'edge', 'system'
 *   action            VARCHAR(64) NOT NULL,           -- Action name (e.g., 'record_create', 'field_add')
 *
 *   -- Actor and timing
 *   actor             VARCHAR(128) NOT NULL,          -- Who/what created the event
 *   timestamp         TIMESTAMPTZ NOT NULL,           -- Client-provided timestamp (ISO 8601)
 *   client_clock      BIGINT,                         -- Client's logical clock (if provided)
 *
 *   -- Event graph (DAG structure)
 *   parents           JSONB DEFAULT '[]',             -- Array of parent event IDs
 *
 *   -- Entity reference (for efficient filtering)
 *   entity_id         VARCHAR(64),                    -- ID of affected entity (set, record, field)
 *   entity_type       VARCHAR(32),                    -- 'set', 'record', 'field', 'view', 'workspace'
 *
 *   -- Structured metadata
 *   context           JSONB DEFAULT '{}',             -- Workspace context, schema version
 *   grounding         JSONB,                          -- Source/provenance information
 *   frame             JSONB,                          -- Validity window / temporal context
 *   supersession      JSONB,                          -- What this event supersedes
 *
 *   -- Event payload
 *   payload           JSONB NOT NULL,                 -- Full event payload
 *
 *   -- Server metadata
 *   received_at       TIMESTAMPTZ DEFAULT NOW(),      -- When server received the event
 *
 *   -- Constraints
 *   UNIQUE(workspace_id, id)                          -- Events unique within workspace
 * );
 *
 * -----------------------------------------------------------------------------
 * REQUIRED INDEXES
 * -----------------------------------------------------------------------------
 *
 * These indexes are essential for the API's query patterns:
 *
 * 1. PRIMARY SYNC INDEX - Used for delta sync (GET with since_clock)
 *    This is the most critical index for sync performance.
 *
 *    CREATE INDEX idx_events_sync
 *      ON events (workspace_id, logical_clock);
 *
 * 2. DUPLICATE DETECTION - Used during POST to detect existing events
 *    The UNIQUE constraint serves this purpose, but an explicit index helps.
 *
 *    CREATE UNIQUE INDEX idx_events_workspace_id
 *      ON events (workspace_id, id);
 *
 * 3. CATEGORY FILTERING - Used when pulling events by category
 *    Supports filtering for 'schema', 'data', 'view', etc.
 *
 *    CREATE INDEX idx_events_category
 *      ON events (workspace_id, category, logical_clock);
 *
 * 4. ENTITY LOOKUP - Used for entity-specific event history
 *    Enables "get all events for record X" queries.
 *
 *    CREATE INDEX idx_events_entity
 *      ON events (workspace_id, entity_type, entity_id, logical_clock);
 *
 * 5. TIMESTAMP RANGE - Used for time-based queries and cleanup
 *    Supports queries like "events in the last 24 hours".
 *
 *    CREATE INDEX idx_events_timestamp
 *      ON events (workspace_id, timestamp);
 *
 * 6. PARENT LOOKUP - Used for DAG traversal (finding children)
 *    GIN index for efficient JSONB array containment queries.
 *
 *    CREATE INDEX idx_events_parents
 *      ON events USING GIN (parents);
 *
 * -----------------------------------------------------------------------------
 * OPTIONAL INDEXES (for advanced use cases)
 * -----------------------------------------------------------------------------
 *
 * 7. ACTOR INDEX - If you need to query events by actor
 *
 *    CREATE INDEX idx_events_actor
 *      ON events (workspace_id, actor, logical_clock);
 *
 * 8. EPISTEMIC TYPE - If filtering by epistemic type is common
 *
 *    CREATE INDEX idx_events_epistemic
 *      ON events (workspace_id, epistemic_type, logical_clock);
 *
 * 9. PAYLOAD FIELDS - For specific payload queries (use sparingly)
 *    Example: index on payload->>'setId' for set-specific queries
 *
 *    CREATE INDEX idx_events_payload_set
 *      ON events ((payload->>'setId'))
 *      WHERE payload->>'setId' IS NOT NULL;
 *
 * -----------------------------------------------------------------------------
 * LOGICAL CLOCK SEQUENCE
 * -----------------------------------------------------------------------------
 *
 * The server must assign monotonically increasing logical_clock values.
 * Use a sequence or similar mechanism:
 *
 *    CREATE SEQUENCE events_logical_clock_seq;
 *
 * Or per-workspace if you need workspace-isolated clocks:
 *
 *    CREATE TABLE workspace_clocks (
 *      workspace_id  VARCHAR(64) PRIMARY KEY,
 *      clock         BIGINT NOT NULL DEFAULT 0
 *    );
 *
 * -----------------------------------------------------------------------------
 * EXAMPLE QUERIES THE INDEXES SUPPORT
 * -----------------------------------------------------------------------------
 *
 * 1. Delta sync (most common - uses idx_events_sync):
 *    SELECT * FROM events
 *    WHERE workspace_id = $1 AND logical_clock > $2
 *    ORDER BY logical_clock ASC
 *    LIMIT 1000;
 *
 * 2. Duplicate check (uses idx_events_workspace_id):
 *    SELECT id FROM events
 *    WHERE workspace_id = $1 AND id = ANY($2);
 *
 * 3. Category filter (uses idx_events_category):
 *    SELECT * FROM events
 *    WHERE workspace_id = $1 AND category = 'schema' AND logical_clock > $2
 *    ORDER BY logical_clock ASC;
 *
 * 4. Entity history (uses idx_events_entity):
 *    SELECT * FROM events
 *    WHERE workspace_id = $1 AND entity_type = 'record' AND entity_id = $2
 *    ORDER BY logical_clock ASC;
 *
 * 5. Find children of an event (uses idx_events_parents):
 *    SELECT * FROM events
 *    WHERE parents @> '["evt_abc123"]'::jsonb;
 *
 * =============================================================================
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
      postEndpoint: '',
      getEndpoint: '',
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
    return this.config.postEndpoint && this.config.getEndpoint && this.config.authToken && this.config.enabled;
  }

  /**
   * Get current sync status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      enabled: this.config.enabled,
      postEndpoint: this.config.postEndpoint,
      getEndpoint: this.config.getEndpoint,
      workspaceId: this.config.workspaceId,
      syncInProgress: this.syncInProgress,
      lastSync: this.lastSync,
      lastError: this.lastError,
      localEventCount: this._getLocalDataCount()
    };
  }

  /**
   * Count local workbench data items for status display
   */
  _getLocalDataCount() {
    try {
      const data = localStorage.getItem('eo_lake_data');
      if (!data) return 0;

      const parsed = JSON.parse(data);
      let count = 0;

      // Count sets
      count += (parsed.sets || []).length;

      // Count all records across sets
      (parsed.sets || []).forEach(set => {
        count += (set.records || []).length;
      });

      // Count sources
      count += (parsed.sources || []).length;

      // Count projects
      count += (parsed.projects || []).length;

      return count;
    } catch (e) {
      return 0;
    }
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
  async _fetch(url, options = {}, retryCount = 0) {
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
        return this._fetch(url, options, retryCount + 1);
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
      // Convert workbench data from localStorage to events
      events = this._getWorkbenchDataAsEvents();
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
        const response = await this._fetch(this.config.postEndpoint, {
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
      epistemic_type: event.epistemicType || 'given',
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
   * Convert workbench localStorage data to events for syncing
   * This bridges the gap between workbench storage and event-based sync
   */
  _getWorkbenchDataAsEvents() {
    const events = [];

    try {
      const data = localStorage.getItem('eo_lake_data');
      if (!data) return events;

      const parsed = JSON.parse(data);
      const timestamp = new Date().toISOString();
      const actor = 'sync_client';
      let clock = Date.now();

      // Convert sets to events
      (parsed.sets || []).forEach(set => {
        // Set definition event
        events.push({
          id: `evt_set_${set.id}`,
          epistemicType: 'given',
          category: 'schema',
          action: 'set_define',
          actor,
          timestamp,
          logicalClock: clock++,
          parents: [],
          payload: {
            action: 'set_define',
            setId: set.id,
            name: set.name,
            fields: set.fields,
            views: set.views,
            derivation: set.derivation,
            datasetProvenance: set.datasetProvenance
          }
        });

        // Record events for each record in the set
        (set.records || []).forEach(record => {
          events.push({
            id: `evt_rec_${record.id}`,
            epistemicType: 'given',
            category: 'data',
            action: 'record_create',
            actor,
            timestamp,
            logicalClock: clock++,
            parents: [`evt_set_${set.id}`],
            payload: {
              action: 'record_create',
              setId: set.id,
              recordId: record.id,
              values: record.values
            }
          });
        });
      });

      // Convert sources to events
      (parsed.sources || []).forEach(source => {
        events.push({
          id: `evt_src_${source.id}`,
          epistemicType: 'given',
          category: 'import',
          action: 'source_import',
          actor,
          timestamp,
          logicalClock: clock++,
          parents: [],
          payload: {
            action: 'source_import',
            sourceId: source.id,
            name: source.name,
            type: source.type,
            filename: source.filename,
            importedAt: source.importedAt,
            rowCount: source.data?.length || 0,
            columns: source.columns,
            data: source.data
          }
        });
      });

      // Convert projects to events
      (parsed.projects || []).forEach(project => {
        events.push({
          id: `evt_proj_${project.id}`,
          epistemicType: 'given',
          category: 'workspace',
          action: 'project_create',
          actor,
          timestamp,
          logicalClock: clock++,
          parents: [],
          payload: {
            action: 'project_create',
            projectId: project.id,
            name: project.name,
            description: project.description,
            sourceIds: project.sourceIds,
            setIds: project.setIds,
            definitionIds: project.definitionIds,
            exportIds: project.exportIds
          }
        });
      });

      // Convert definitions to events
      (parsed.definitions || []).forEach(def => {
        events.push({
          id: `evt_def_${def.id}`,
          epistemicType: 'given',
          category: 'schema',
          action: 'definition_create',
          actor,
          timestamp,
          logicalClock: clock++,
          parents: [],
          payload: {
            action: 'definition_create',
            definitionId: def.id,
            ...def
          }
        });
      });

      // Convert exports to events
      (parsed.exports || []).forEach(exp => {
        events.push({
          id: `evt_exp_${exp.id}`,
          epistemicType: 'given',
          category: 'export',
          action: 'export_create',
          actor,
          timestamp,
          logicalClock: clock++,
          parents: [],
          payload: {
            action: 'export_create',
            exportId: exp.id,
            ...exp
          }
        });
      });

    } catch (e) {
      console.error('EOSyncAPI: Failed to convert workbench data to events', e);
    }

    return events;
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

    // Build GET URL with query params
    const getUrl = new URL(this.config.getEndpoint);
    params.forEach((value, key) => getUrl.searchParams.append(key, value));

    const response = await this._fetch(getUrl.toString(), {
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
   * Apply pulled events to local workbench storage
   * Converts events back to workbench data format
   */
  applyPulledEvents(events) {
    const results = {
      applied: 0,
      duplicates: 0,
      parked: 0,
      errors: []
    };

    try {
      // Load existing workbench data
      const existingData = localStorage.getItem('eo_lake_data');
      const workbench = existingData ? JSON.parse(existingData) : {
        sets: [],
        sources: [],
        projects: [],
        definitions: [],
        exports: [],
        tossedItems: [],
        activityLog: []
      };

      // Track what we've seen to avoid duplicates
      const seenSets = new Set(workbench.sets.map(s => s.id));
      const seenRecords = new Map(); // setId -> Set of recordIds
      const seenSources = new Set(workbench.sources.map(s => s.id));
      const seenProjects = new Set(workbench.projects.map(p => p.id));
      const seenDefinitions = new Set(workbench.definitions.map(d => d.id));
      const seenExports = new Set(workbench.exports.map(e => e.id));

      // Initialize record tracking for existing sets
      workbench.sets.forEach(set => {
        seenRecords.set(set.id, new Set((set.records || []).map(r => r.id)));
      });

      // Process events in order
      for (const event of events) {
        try {
          const payload = event.payload || {};
          const action = event.action || payload.action;

          switch (action) {
            case 'set_define':
              if (!seenSets.has(payload.setId)) {
                workbench.sets.push({
                  id: payload.setId,
                  name: payload.name,
                  fields: payload.fields || [],
                  records: [],
                  views: payload.views || [],
                  derivation: payload.derivation,
                  datasetProvenance: payload.datasetProvenance
                });
                seenSets.add(payload.setId);
                seenRecords.set(payload.setId, new Set());
                results.applied++;
              } else {
                results.duplicates++;
              }
              break;

            case 'record_create':
              const setForRecord = workbench.sets.find(s => s.id === payload.setId);
              if (setForRecord) {
                const recordSet = seenRecords.get(payload.setId) || new Set();
                if (!recordSet.has(payload.recordId)) {
                  setForRecord.records = setForRecord.records || [];
                  setForRecord.records.push({
                    id: payload.recordId,
                    values: payload.values || {}
                  });
                  recordSet.add(payload.recordId);
                  seenRecords.set(payload.setId, recordSet);
                  results.applied++;
                } else {
                  results.duplicates++;
                }
              } else {
                results.parked++;
              }
              break;

            case 'source_import':
              if (!seenSources.has(payload.sourceId)) {
                workbench.sources.push({
                  id: payload.sourceId,
                  name: payload.name,
                  type: payload.type,
                  filename: payload.filename,
                  importedAt: payload.importedAt,
                  columns: payload.columns,
                  data: payload.data
                });
                seenSources.add(payload.sourceId);
                results.applied++;
              } else {
                results.duplicates++;
              }
              break;

            case 'project_create':
              if (!seenProjects.has(payload.projectId)) {
                workbench.projects.push({
                  id: payload.projectId,
                  name: payload.name,
                  description: payload.description,
                  sourceIds: payload.sourceIds,
                  setIds: payload.setIds,
                  definitionIds: payload.definitionIds,
                  exportIds: payload.exportIds
                });
                seenProjects.add(payload.projectId);
                results.applied++;
              } else {
                results.duplicates++;
              }
              break;

            case 'definition_create':
              if (!seenDefinitions.has(payload.definitionId)) {
                const { action: _, definitionId, ...defData } = payload;
                workbench.definitions.push({
                  id: payload.definitionId,
                  ...defData
                });
                seenDefinitions.add(payload.definitionId);
                results.applied++;
              } else {
                results.duplicates++;
              }
              break;

            case 'export_create':
              if (!seenExports.has(payload.exportId)) {
                const { action: _, exportId, ...expData } = payload;
                workbench.exports.push({
                  id: payload.exportId,
                  ...expData
                });
                seenExports.add(payload.exportId);
                results.applied++;
              } else {
                results.duplicates++;
              }
              break;

            default:
              // Unknown action type, skip
              results.parked++;
          }
        } catch (error) {
          results.errors.push({ id: event.id, error: error.message });
        }
      }

      // Save updated workbench data
      localStorage.setItem('eo_lake_data', JSON.stringify(workbench));

    } catch (error) {
      console.error('EOSyncAPI: Failed to apply pulled events', error);
      results.errors.push({ id: 'apply_all', error: error.message });
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
    if (!this.config.getEndpoint || !this.config.authToken) {
      return { success: false, error: 'GET endpoint and auth token required' };
    }

    try {
      // Try to fetch with limit 1 just to test auth
      const getUrl = new URL(this.config.getEndpoint);
      getUrl.searchParams.append('workspace_id', this.config.workspaceId);
      getUrl.searchParams.append('limit', '1');

      await this._fetch(getUrl.toString(), { method: 'GET' });

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
  window.getEOSyncAPI = getSyncAPI; // Alias for consistent naming
  window.initSyncAPI = initSyncAPI;
}
