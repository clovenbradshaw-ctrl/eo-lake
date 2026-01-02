/**
 * EO Live Source - Data Lives in the Source, Views Are Just Queries
 *
 * Core Principle:
 * - Data resides in IndexedDB (the "source"), not in app memory
 * - Sets don't contain records - they contain derivation specifications
 * - Views execute queries against the source on-demand
 * - All views show sync status: when was this data last refreshed?
 *
 * Architecture:
 * ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
 * │   Remote API     │────▶│   IndexedDB      │◀────│   View Query     │
 * │   (origin)       │     │   (local cache)  │     │   (lens)         │
 * └──────────────────┘     └──────────────────┘     └──────────────────┘
 *         │                        │                        │
 *    Source of Truth          Local Mirror           Interpretation
 *    (may be stale)        (tracks freshness)       (always live)
 */

// ============================================================================
// Constants
// ============================================================================

const SyncStatus = Object.freeze({
  FRESH: 'fresh',           // Recently synced, data is current
  STALE: 'stale',           // Needs refresh
  SYNCING: 'syncing',       // Currently fetching
  OFFLINE: 'offline',       // No connection, using cached
  ERROR: 'error',           // Sync failed
  NEVER: 'never'            // Never synced (local only)
});

const FRESHNESS_THRESHOLD_MS = 5 * 60 * 1000;  // 5 minutes = fresh
const STALE_THRESHOLD_MS = 30 * 60 * 1000;     // 30 minutes = definitely stale

// ============================================================================
// SourceHandle - Reference to data that lives elsewhere
// ============================================================================

/**
 * SourceHandle - A handle to data that lives in IndexedDB/API
 *
 * This is NOT the data. This is a reference that knows:
 * - Where the data lives
 * - When it was last synced
 * - How to query it
 * - How to refresh it
 */
class SourceHandle {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type || 'imported';  // 'imported', 'api', 'derived'

    // Sync metadata - ALWAYS visible
    this.sync = {
      lastSyncAt: config.lastSyncAt || null,
      lastSyncClock: config.lastSyncClock || 0,
      syncStatus: config.syncStatus || SyncStatus.NEVER,
      syncError: null,
      recordCount: config.recordCount || null,  // Cached count, may be stale
      origin: config.origin || null  // Where did this data come from?
    };

    // Schema (known structure)
    this.schema = config.schema || null;

    // For API sources
    this.apiConfig = config.apiConfig || null;

    // For derived sources (sets with derivation)
    this.derivation = config.derivation || null;

    // Storage reference
    this._storage = config.storage || null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Freshness
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get freshness status with human-readable message
   */
  getFreshness() {
    if (!this.sync.lastSyncAt) {
      return {
        status: SyncStatus.NEVER,
        message: 'Never synced',
        sinceMs: null,
        sinceHuman: 'never'
      };
    }

    const now = Date.now();
    const lastSync = new Date(this.sync.lastSyncAt).getTime();
    const sinceMs = now - lastSync;

    let status;
    if (this.sync.syncStatus === SyncStatus.SYNCING) {
      status = SyncStatus.SYNCING;
    } else if (this.sync.syncStatus === SyncStatus.ERROR) {
      status = SyncStatus.ERROR;
    } else if (sinceMs < FRESHNESS_THRESHOLD_MS) {
      status = SyncStatus.FRESH;
    } else if (sinceMs < STALE_THRESHOLD_MS) {
      status = SyncStatus.STALE;
    } else {
      status = SyncStatus.STALE;
    }

    return {
      status,
      message: this._formatSyncMessage(status, sinceMs),
      sinceMs,
      sinceHuman: this._formatDuration(sinceMs),
      lastSyncAt: this.sync.lastSyncAt
    };
  }

  _formatSyncMessage(status, sinceMs) {
    switch (status) {
      case SyncStatus.SYNCING:
        return 'Syncing...';
      case SyncStatus.ERROR:
        return `Sync failed: ${this.sync.syncError || 'unknown error'}`;
      case SyncStatus.FRESH:
        return `Updated ${this._formatDuration(sinceMs)} ago`;
      case SyncStatus.STALE:
        return `Last updated ${this._formatDuration(sinceMs)} ago`;
      default:
        return 'Unknown sync status';
    }
  }

  _formatDuration(ms) {
    if (ms < 60000) return 'just now';
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
    return `${Math.floor(ms / 86400000)}d`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Data Access - Always from IndexedDB, never in-memory
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get record count (from cache or fresh query)
   * @param {boolean} forceCount - If true, count from IndexedDB
   */
  async getRecordCount(forceCount = false) {
    if (!forceCount && this.sync.recordCount !== null) {
      return this.sync.recordCount;
    }

    if (!this._storage) {
      throw new Error('No storage attached to SourceHandle');
    }

    const count = await this._storage.countRecords(this.id);
    this.sync.recordCount = count;
    return count;
  }

  /**
   * Query records - returns an async iterator, NOT an array
   * Data is streamed from IndexedDB, never fully loaded into memory
   *
   * @param {Object} query - Query specification
   * @param {Object} query.filter - Predicate to apply
   * @param {Object} query.sort - Sort specification
   * @param {number} query.offset - Skip first N records
   * @param {number} query.limit - Return at most N records
   * @param {string[]} query.fields - Only return these fields (projection)
   * @returns {AsyncIterator} - Yields records one at a time
   */
  async* queryRecords(query = {}) {
    if (!this._storage) {
      throw new Error('No storage attached to SourceHandle');
    }

    yield* this._storage.queryRecords(this.id, query);
  }

  /**
   * Get a window of records (for virtual scroll)
   *
   * @param {number} offset - Start index
   * @param {number} limit - Number of records
   * @param {Object} options - Sort, filter options
   * @returns {Promise<{records: any[], total: number, offset: number}>}
   */
  async getWindow(offset, limit, options = {}) {
    if (!this._storage) {
      throw new Error('No storage attached to SourceHandle');
    }

    return this._storage.getRecordWindow(this.id, offset, limit, options);
  }

  /**
   * Get a single record by ID
   */
  async getRecord(recordId) {
    if (!this._storage) {
      throw new Error('No storage attached to SourceHandle');
    }

    return this._storage.getRecord(this.id, recordId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sync Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Refresh data from origin (API or re-import)
   */
  async refresh(options = {}) {
    if (this.type === 'imported' && !this.apiConfig) {
      // Local import - can't refresh from origin
      return {
        success: false,
        reason: 'Local import has no origin to refresh from'
      };
    }

    this.sync.syncStatus = SyncStatus.SYNCING;

    try {
      if (this.apiConfig) {
        // Fetch from API
        const result = await this._fetchFromApi(options);

        this.sync.lastSyncAt = new Date().toISOString();
        this.sync.lastSyncClock = result.serverClock || this.sync.lastSyncClock + 1;
        this.sync.syncStatus = SyncStatus.FRESH;
        this.sync.recordCount = result.count;

        return { success: true, added: result.added, updated: result.updated };
      }

      // For derived sources, re-evaluate derivation
      if (this.derivation) {
        // Derivation is just a query - no data to sync, it's always live
        this.sync.lastSyncAt = new Date().toISOString();
        this.sync.syncStatus = SyncStatus.FRESH;
        return { success: true, message: 'Derived source is always live' };
      }

      return { success: false, reason: 'Unknown source type' };

    } catch (error) {
      this.sync.syncStatus = SyncStatus.ERROR;
      this.sync.syncError = error.message;
      return { success: false, error: error.message };
    }
  }

  async _fetchFromApi(options) {
    // Placeholder - implement with actual API client
    // Should use delta sync with since_clock
    throw new Error('API fetch not implemented');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────────

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      sync: { ...this.sync },
      schema: this.schema,
      apiConfig: this.apiConfig,
      derivation: this.derivation
    };
  }

  static fromJSON(obj, storage) {
    return new SourceHandle({
      ...obj,
      storage
    });
  }
}

// ============================================================================
// LiveQuery - A query against a source that stays live
// ============================================================================

/**
 * LiveQuery - Represents a view's query against source data
 *
 * This is what a Set/View actually IS - not a collection of records,
 * but a specification for how to query them.
 */
class LiveQuery {
  constructor(config) {
    this.id = config.id || generateQueryId();
    this.sourceId = config.sourceId;
    this.name = config.name || 'Untitled Query';

    // Query specification
    this.spec = {
      filter: config.filter || null,        // Predicate
      sort: config.sort || null,            // { field, direction }
      fields: config.fields || null,        // Projection (null = all)
      limit: config.limit || null,          // Max records
      derivation: config.derivation || null // For derived sets (joins, etc.)
    };

    // Display preferences (not data)
    this.display = {
      visibleFields: config.visibleFields || null,
      fieldWidths: config.fieldWidths || {},
      groupBy: config.groupBy || null
    };

    // Execution state
    this._sourceHandle = null;
    this._lastExecutionAt = null;
    this._cachedCount = null;
  }

  /**
   * Attach source handle for execution
   */
  attachSource(sourceHandle) {
    this._sourceHandle = sourceHandle;
  }

  /**
   * Get freshness info from underlying source
   */
  getFreshness() {
    if (!this._sourceHandle) {
      return { status: SyncStatus.NEVER, message: 'Source not attached' };
    }
    return this._sourceHandle.getFreshness();
  }

  /**
   * Execute query and get a window of results
   * This is the main data access method for views
   */
  async getWindow(offset, limit) {
    if (!this._sourceHandle) {
      throw new Error('Source not attached to query');
    }

    const result = await this._sourceHandle.getWindow(offset, limit, {
      filter: this.spec.filter,
      sort: this.spec.sort,
      fields: this.spec.fields
    });

    this._lastExecutionAt = new Date().toISOString();
    this._cachedCount = result.total;

    return {
      records: result.records,
      total: result.total,
      offset: result.offset,
      freshness: this.getFreshness(),
      executedAt: this._lastExecutionAt
    };
  }

  /**
   * Get total count matching this query
   */
  async getCount() {
    if (!this._sourceHandle) {
      throw new Error('Source not attached to query');
    }

    // If no filter, use source count
    if (!this.spec.filter) {
      return this._sourceHandle.getRecordCount();
    }

    // Otherwise need to count with filter
    const result = await this._sourceHandle.getWindow(0, 0, {
      filter: this.spec.filter,
      countOnly: true
    });

    this._cachedCount = result.total;
    return result.total;
  }

  /**
   * Stream all matching records (for export, etc.)
   */
  async* streamAll() {
    if (!this._sourceHandle) {
      throw new Error('Source not attached to query');
    }

    yield* this._sourceHandle.queryRecords({
      filter: this.spec.filter,
      sort: this.spec.sort,
      fields: this.spec.fields
    });
  }

  /**
   * Refine this query (creates a new query, doesn't modify)
   */
  refine(refinement) {
    return new LiveQuery({
      sourceId: this.sourceId,
      name: refinement.name || `${this.name} (refined)`,
      filter: refinement.filter
        ? combineFilters(this.spec.filter, refinement.filter)
        : this.spec.filter,
      sort: refinement.sort || this.spec.sort,
      fields: refinement.fields || this.spec.fields,
      limit: refinement.limit ?? this.spec.limit
    });
  }

  toJSON() {
    return {
      id: this.id,
      sourceId: this.sourceId,
      name: this.name,
      spec: this.spec,
      display: this.display
    };
  }

  static fromJSON(obj) {
    return new LiveQuery(obj);
  }
}

// ============================================================================
// LiveSourceStorage - IndexedDB operations for live sources
// ============================================================================

/**
 * LiveSourceStorage - Manages source data in IndexedDB
 *
 * Data lives here, not in app memory. All access is through cursors/queries.
 */
class LiveSourceStorage {
  constructor() {
    this.dbName = 'eo_live_sources';
    this.dbVersion = 1;
    this._db = null;
    this._initPromise = null;
  }

  async init() {
    if (this._db) return this._db;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Source metadata (handles)
        if (!db.objectStoreNames.contains('sources')) {
          const sourceStore = db.createObjectStore('sources', { keyPath: 'id' });
          sourceStore.createIndex('name', 'name', { unique: false });
          sourceStore.createIndex('type', 'type', { unique: false });
          sourceStore.createIndex('lastSyncAt', 'sync.lastSyncAt', { unique: false });
        }

        // Source records (the actual data)
        if (!db.objectStoreNames.contains('records')) {
          const recordStore = db.createObjectStore('records', { keyPath: ['sourceId', 'id'] });
          recordStore.createIndex('sourceId', 'sourceId', { unique: false });
          recordStore.createIndex('sourceId_createdAt', ['sourceId', '_createdAt'], { unique: false });
          recordStore.createIndex('sourceId_updatedAt', ['sourceId', '_updatedAt'], { unique: false });
        }

        // Queries (saved views/sets)
        if (!db.objectStoreNames.contains('queries')) {
          const queryStore = db.createObjectStore('queries', { keyPath: 'id' });
          queryStore.createIndex('sourceId', 'sourceId', { unique: false });
          queryStore.createIndex('name', 'name', { unique: false });
        }
      };

      request.onsuccess = () => {
        this._db = request.result;
        resolve(this._db);
      };
    });

    return this._initPromise;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Source Handle Operations
  // ─────────────────────────────────────────────────────────────────────────

  async saveSourceHandle(handle) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sources', 'readwrite');
      tx.objectStore('sources').put(handle.toJSON());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSourceHandle(sourceId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sources', 'readonly');
      const request = tx.objectStore('sources').get(sourceId);
      request.onsuccess = () => {
        if (request.result) {
          resolve(SourceHandle.fromJSON(request.result, this));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSourceHandles() {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sources', 'readonly');
      const request = tx.objectStore('sources').getAll();
      request.onsuccess = () => {
        resolve(request.result.map(obj => SourceHandle.fromJSON(obj, this)));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Record Operations - Cursor-based, never load all into memory
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Count records for a source
   */
  async countRecords(sourceId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readonly');
      const index = tx.objectStore('records').index('sourceId');
      const request = index.count(IDBKeyRange.only(sourceId));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a window of records (for virtual scroll)
   */
  async getRecordWindow(sourceId, offset, limit, options = {}) {
    const db = await this.init();
    const { filter, sort, countOnly } = options;

    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readonly');
      const index = tx.objectStore('records').index('sourceId');
      const range = IDBKeyRange.only(sourceId);

      const records = [];
      let count = 0;
      let skipped = 0;

      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (!cursor) {
          // Done iterating
          resolve({
            records: countOnly ? [] : records,
            total: count,
            offset
          });
          return;
        }

        const record = cursor.value;

        // Apply filter
        if (filter && !this._matchesFilter(record, filter)) {
          cursor.continue();
          return;
        }

        count++;

        // Skip until offset
        if (skipped < offset) {
          skipped++;
          cursor.continue();
          return;
        }

        // Collect until limit
        if (!countOnly && records.length < limit) {
          records.push(record);
        }

        // Continue to get accurate count
        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Query records as async iterator
   */
  async* queryRecords(sourceId, query = {}) {
    const db = await this.init();
    const { filter, sort, fields, limit } = query;

    let yielded = 0;

    // Open cursor
    const tx = db.transaction('records', 'readonly');
    const index = tx.objectStore('records').index('sourceId');
    const range = IDBKeyRange.only(sourceId);

    // Wrap cursor in async iteration
    const cursorIterator = this._cursorToAsyncIterator(index, range);

    for await (const record of cursorIterator) {
      // Apply filter
      if (filter && !this._matchesFilter(record, filter)) {
        continue;
      }

      // Apply projection
      let result = record;
      if (fields && fields.length > 0) {
        result = {};
        for (const field of fields) {
          result[field] = record[field];
        }
        result.id = record.id;
        result.sourceId = record.sourceId;
      }

      yield result;

      yielded++;
      if (limit && yielded >= limit) {
        break;
      }
    }
  }

  async* _cursorToAsyncIterator(index, range) {
    // Convert IDB cursor to async iterator
    const request = index.openCursor(range);

    let resolveCurrent = null;
    let rejectCurrent = null;
    let done = false;

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (resolveCurrent) {
          const resolve = resolveCurrent;
          resolveCurrent = null;
          resolve({ value: cursor.value, cursor });
        }
      } else {
        done = true;
        if (resolveCurrent) {
          resolveCurrent({ done: true });
        }
      }
    };

    request.onerror = () => {
      done = true;
      if (rejectCurrent) {
        rejectCurrent(request.error);
      }
    };

    while (!done) {
      const result = await new Promise((resolve, reject) => {
        resolveCurrent = resolve;
        rejectCurrent = reject;
      });

      if (result.done) break;

      yield result.value;

      // Advance cursor
      if (result.cursor) {
        result.cursor.continue();
      }
    }
  }

  /**
   * Get single record
   */
  async getRecord(sourceId, recordId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readonly');
      const request = tx.objectStore('records').get([sourceId, recordId]);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store records (for import/sync)
   */
  async storeRecords(sourceId, records) {
    const db = await this.init();
    const timestamp = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      const store = tx.objectStore('records');

      let stored = 0;
      for (const record of records) {
        const storedRecord = {
          ...record,
          sourceId,
          id: record.id || generateRecordId(),
          _createdAt: record._createdAt || timestamp,
          _updatedAt: timestamp
        };
        store.put(storedRecord);
        stored++;
      }

      tx.oncomplete = () => resolve({ stored });
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Clear all records for a source
   */
  async clearRecords(sourceId) {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      const store = tx.objectStore('records');
      const index = store.index('sourceId');
      const range = IDBKeyRange.only(sourceId);

      const request = index.openCursor(range);
      let deleted = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          deleted++;
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve({ deleted });
      tx.onerror = () => reject(tx.error);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Query (Saved View) Operations
  // ─────────────────────────────────────────────────────────────────────────

  async saveQuery(query) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queries', 'readwrite');
      tx.objectStore('queries').put(query.toJSON());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getQuery(queryId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queries', 'readonly');
      const request = tx.objectStore('queries').get(queryId);
      request.onsuccess = () => {
        if (request.result) {
          resolve(LiveQuery.fromJSON(request.result));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getQueriesForSource(sourceId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queries', 'readonly');
      const index = tx.objectStore('queries').index('sourceId');
      const request = index.getAll(IDBKeyRange.only(sourceId));
      request.onsuccess = () => {
        resolve(request.result.map(obj => LiveQuery.fromJSON(obj)));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Filter Evaluation
  // ─────────────────────────────────────────────────────────────────────────

  _matchesFilter(record, filter) {
    if (!filter) return true;

    switch (filter.type) {
      case 'AND':
        return filter.conditions.every(c => this._matchesFilter(record, c));
      case 'OR':
        return filter.conditions.some(c => this._matchesFilter(record, c));
      case 'NOT':
        return !this._matchesFilter(record, filter.operand);
      case 'COMPARISON':
        return this._evaluateComparison(record, filter);
      default:
        return true;
    }
  }

  _evaluateComparison(record, filter) {
    const value = record[filter.field];
    const compare = filter.value;
    const valueStr = String(value ?? '').toLowerCase();
    const compareStr = String(compare ?? '').toLowerCase();

    switch (filter.operator) {
      case 'eq': return valueStr === compareStr;
      case 'neq': return valueStr !== compareStr;
      case 'gt': return parseFloat(value) > parseFloat(compare);
      case 'gte': return parseFloat(value) >= parseFloat(compare);
      case 'lt': return parseFloat(value) < parseFloat(compare);
      case 'lte': return parseFloat(value) <= parseFloat(compare);
      case 'contains': return valueStr.includes(compareStr);
      case 'starts': return valueStr.startsWith(compareStr);
      case 'ends': return valueStr.endsWith(compareStr);
      case 'null': return value === null || value === undefined || value === '';
      case 'notnull': return value !== null && value !== undefined && value !== '';
      case 'in': return Array.isArray(compare) && compare.map(v => String(v).toLowerCase()).includes(valueStr);
      default: return true;
    }
  }
}

// ============================================================================
// ViewportController - Manages windowed access for UI
// ============================================================================

/**
 * ViewportController - Connects UI to live query with windowed access
 *
 * Handles:
 * - Virtual scrolling (only load visible + buffer)
 * - Freshness display
 * - Background refresh
 */
class ViewportController {
  constructor(query, options = {}) {
    this.query = query;
    this.options = {
      windowSize: options.windowSize || 100,     // Records to keep in memory
      bufferSize: options.bufferSize || 50,      // Pre-fetch buffer
      refreshInterval: options.refreshInterval || null  // Auto-refresh (ms)
    };

    // Current viewport state
    this.state = {
      offset: 0,
      visibleStart: 0,
      visibleEnd: 0,
      totalCount: null,
      records: [],          // Current window of records
      loading: false
    };

    // Callbacks
    this._onUpdate = null;
    this._onFreshnessChange = null;

    // Auto-refresh
    this._refreshTimer = null;
  }

  /**
   * Initialize and load first window
   */
  async init() {
    await this._loadWindow(0);

    if (this.options.refreshInterval) {
      this._startAutoRefresh();
    }
  }

  /**
   * Scroll to position
   */
  async scrollTo(index) {
    const windowStart = Math.max(0, index - this.options.bufferSize);

    // Check if we need to load new window
    if (windowStart < this.state.offset ||
        index >= this.state.offset + this.state.records.length - this.options.bufferSize) {
      await this._loadWindow(windowStart);
    }

    this.state.visibleStart = index;
  }

  /**
   * Get records for current viewport
   */
  getVisibleRecords(startIndex, count) {
    const localStart = startIndex - this.state.offset;
    const localEnd = localStart + count;

    if (localStart < 0 || localEnd > this.state.records.length) {
      // Need to load
      this._loadWindow(startIndex);
      return [];
    }

    return this.state.records.slice(localStart, localEnd);
  }

  /**
   * Get freshness info
   */
  getFreshness() {
    return this.query.getFreshness();
  }

  /**
   * Force refresh from source
   */
  async refresh() {
    const sourceHandle = this.query._sourceHandle;
    if (sourceHandle) {
      await sourceHandle.refresh();
      await this._loadWindow(this.state.offset);
    }
  }

  async _loadWindow(offset) {
    this.state.loading = true;
    this._notifyUpdate();

    try {
      const result = await this.query.getWindow(offset, this.options.windowSize);

      this.state.offset = offset;
      this.state.records = result.records;
      this.state.totalCount = result.total;
      this.state.loading = false;

      this._notifyUpdate();
    } catch (error) {
      this.state.loading = false;
      throw error;
    }
  }

  _startAutoRefresh() {
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    this._refreshTimer = setInterval(() => {
      this.refresh();
    }, this.options.refreshInterval);
  }

  _notifyUpdate() {
    if (this._onUpdate) {
      this._onUpdate(this.state);
    }
  }

  onUpdate(callback) {
    this._onUpdate = callback;
  }

  onFreshnessChange(callback) {
    this._onFreshnessChange = callback;
  }

  destroy() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateQueryId() {
  return `qry_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
}

function generateRecordId() {
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
}

function combineFilters(existing, additional) {
  if (!existing) return additional;
  if (!additional) return existing;

  return {
    type: 'AND',
    conditions: [existing, additional]
  };
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SyncStatus,
    SourceHandle,
    LiveQuery,
    LiveSourceStorage,
    ViewportController,
    FRESHNESS_THRESHOLD_MS,
    STALE_THRESHOLD_MS
  };
}

if (typeof window !== 'undefined') {
  window.EOLiveSource = {
    SyncStatus,
    SourceHandle,
    LiveQuery,
    LiveSourceStorage,
    ViewportController,
    FRESHNESS_THRESHOLD_MS,
    STALE_THRESHOLD_MS
  };
}
