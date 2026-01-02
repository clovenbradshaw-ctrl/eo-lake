/**
 * EO Storage - IndexedDB-based storage for large data
 *
 * Solves the localStorage quota issue by storing large record data in IndexedDB
 * while keeping lightweight metadata in localStorage for quick access.
 *
 * Architecture:
 * - localStorage: metadata, configuration, UI state (small data < 1MB)
 * - IndexedDB: records, source data, merged results (large data)
 */

const EO_STORAGE_DB_NAME = 'eo_workbench_db';
const EO_STORAGE_DB_VERSION = 1;

class EOStorage {
  constructor() {
    this.db = null;
    this._initPromise = null;
    this._cache = new Map(); // In-memory cache for frequently accessed data
    this._cacheMaxSize = 50; // Max items to cache
  }

  /**
   * Initialize the IndexedDB database
   */
  async init() {
    if (this.db) return this.db;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(EO_STORAGE_DB_NAME, EO_STORAGE_DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store for source records
        if (!db.objectStoreNames.contains('source_records')) {
          const sourceStore = db.createObjectStore('source_records', { keyPath: 'id' });
          sourceStore.createIndex('sourceId', 'sourceId', { unique: false });
        }

        // Store for set records
        if (!db.objectStoreNames.contains('set_records')) {
          const setStore = db.createObjectStore('set_records', { keyPath: 'id' });
          setStore.createIndex('setId', 'setId', { unique: false });
        }

        // Store for merge results (cached computed merges)
        if (!db.objectStoreNames.contains('merge_results')) {
          const mergeStore = db.createObjectStore('merge_results', { keyPath: 'id' });
          mergeStore.createIndex('setId', 'setId', { unique: false });
          mergeStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store for large blobs (file contents, etc.)
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs', { keyPath: 'id' });
        }
      };
    });

    return this._initPromise;
  }

  /**
   * Store records for a source
   */
  async storeSourceRecords(sourceId, records) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('source_records', 'readwrite');
      const store = tx.objectStore('source_records');

      // First, clear existing records for this source
      const index = store.index('sourceId');
      const range = IDBKeyRange.only(sourceId);
      const cursorRequest = index.openCursor(range);

      const keysToDelete = [];
      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          keysToDelete.push(cursor.primaryKey);
          cursor.continue();
        } else {
          // Delete all existing records
          keysToDelete.forEach(key => store.delete(key));

          // Add new records
          records.forEach((record, i) => {
            store.put({
              id: `${sourceId}_${i}`,
              sourceId: sourceId,
              index: i,
              data: record
            });
          });
        }
      };

      tx.oncomplete = () => {
        this._cache.delete(`source_${sourceId}`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get records for a source
   */
  async getSourceRecords(sourceId) {
    // Check cache first
    const cacheKey = `source_${sourceId}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('source_records', 'readonly');
      const store = tx.objectStore('source_records');
      const index = store.index('sourceId');
      const range = IDBKeyRange.only(sourceId);
      const request = index.getAll(range);

      request.onsuccess = () => {
        // Sort by index and extract data
        const results = request.result
          .sort((a, b) => a.index - b.index)
          .map(r => r.data);

        // Cache the results
        this._addToCache(cacheKey, results);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store records for a set
   */
  async storeSetRecords(setId, records) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('set_records', 'readwrite');
      const store = tx.objectStore('set_records');

      // First, clear existing records for this set
      const index = store.index('setId');
      const range = IDBKeyRange.only(setId);
      const cursorRequest = index.openCursor(range);

      const keysToDelete = [];
      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          keysToDelete.push(cursor.primaryKey);
          cursor.continue();
        } else {
          // Delete all existing records
          keysToDelete.forEach(key => store.delete(key));

          // Add new records
          records.forEach((record, i) => {
            store.put({
              id: `${setId}_${i}`,
              setId: setId,
              index: i,
              data: record
            });
          });
        }
      };

      tx.oncomplete = () => {
        this._cache.delete(`set_${setId}`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get records for a set
   */
  async getSetRecords(setId) {
    // Check cache first
    const cacheKey = `set_${setId}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('set_records', 'readonly');
      const store = tx.objectStore('set_records');
      const index = store.index('setId');
      const range = IDBKeyRange.only(setId);
      const request = index.getAll(range);

      request.onsuccess = () => {
        // Sort by index and extract data
        const results = request.result
          .sort((a, b) => a.index - b.index)
          .map(r => r.data);

        // Cache the results
        this._addToCache(cacheKey, results);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store a merge result (cached computation)
   */
  async storeMergeResult(setId, result) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('merge_results', 'readwrite');
      const store = tx.objectStore('merge_results');

      store.put({
        id: setId,
        setId: setId,
        timestamp: Date.now(),
        records: result.records,
        fields: result.fields,
        totalCount: result.totalCount
      });

      tx.oncomplete = () => {
        this._cache.delete(`merge_${setId}`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get a cached merge result
   */
  async getMergeResult(setId) {
    const cacheKey = `merge_${setId}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('merge_results', 'readonly');
      const store = tx.objectStore('merge_results');
      const request = store.get(setId);

      request.onsuccess = () => {
        if (request.result) {
          this._addToCache(cacheKey, request.result);
        }
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete merge result for a set
   */
  async deleteMergeResult(setId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('merge_results', 'readwrite');
      const store = tx.objectStore('merge_results');
      store.delete(setId);

      tx.oncomplete = () => {
        this._cache.delete(`merge_${setId}`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Delete all records for a source
   */
  async deleteSourceRecords(sourceId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('source_records', 'readwrite');
      const store = tx.objectStore('source_records');
      const index = store.index('sourceId');
      const range = IDBKeyRange.only(sourceId);
      const cursorRequest = index.openCursor(range);

      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => {
        this._cache.delete(`source_${sourceId}`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Delete all records for a set
   */
  async deleteSetRecords(setId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('set_records', 'readwrite');
      const store = tx.objectStore('set_records');
      const index = store.index('setId');
      const range = IDBKeyRange.only(setId);
      const cursorRequest = index.openCursor(range);

      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => {
        this._cache.delete(`set_${setId}`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats() {
    await this.init();

    const stats = {
      sources: 0,
      sets: 0,
      mergeResults: 0,
      totalRecords: 0
    };

    const stores = ['source_records', 'set_records', 'merge_results'];

    for (const storeName of stores) {
      const count = await new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (storeName === 'source_records') stats.sources = count;
      else if (storeName === 'set_records') stats.sets = count;
      else if (storeName === 'merge_results') stats.mergeResults = count;

      stats.totalRecords += count;
    }

    return stats;
  }

  /**
   * Clear all data from IndexedDB
   */
  async clearAll() {
    await this.init();

    const stores = ['source_records', 'set_records', 'merge_results', 'blobs'];

    for (const storeName of stores) {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    this._cache.clear();
  }

  /**
   * Add item to LRU cache
   */
  _addToCache(key, value) {
    // Remove oldest if at max size
    if (this._cache.size >= this._cacheMaxSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(key, value);
  }

  /**
   * Clear the in-memory cache
   */
  clearCache() {
    this._cache.clear();
  }
}

// Singleton instance
const eoStorage = new EOStorage();

// Export for both module and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EOStorage, eoStorage };
}

if (typeof window !== 'undefined') {
  window.EOStorage = EOStorage;
  window.eoStorage = eoStorage;
}
