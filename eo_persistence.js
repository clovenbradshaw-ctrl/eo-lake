/**
 * EO Persistence - Local-First Storage Layer
 *
 * Implements the persistence layer for the Experience Engine.
 * Uses IndexedDB for durable storage with localStorage fallback.
 *
 * Key principles:
 * - Local-first: All operations work offline
 * - Append-only: Events are never modified after storage
 * - Sync-ready: Maintains a queue for future cloud synchronization
 *
 * From the Sync Handbook:
 * "Rule 3: Capture Before Coordination - Recording an event must not
 *  require network connectivity or remote agreement."
 */

/**
 * IndexedDB Backend
 */
class IndexedDBBackend {
  constructor(dbName = 'eo_experience_engine') {
    this.dbName = dbName;
    this.version = 1;
    this.db = null;
  }

  /**
   * Initialize the database
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Events store - the append-only log
        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('type', 'type', { unique: false });
          eventStore.createIndex('timestamp', 'timestamp', { unique: false });
          eventStore.createIndex('logicalClock', 'logicalClock', { unique: false });
          eventStore.createIndex('actor', 'actor', { unique: false });
          eventStore.createIndex('workspace', 'context.workspace', { unique: false });
        }

        // Horizons store
        if (!db.objectStoreNames.contains('horizons')) {
          db.createObjectStore('horizons', { keyPath: 'id' });
        }

        // Sync queue - events pending sync to cloud
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Save an event
   */
  async saveEvent(event) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['events', 'syncQueue'], 'readwrite');
      const eventStore = tx.objectStore('events');
      const syncStore = tx.objectStore('syncQueue');

      // Save to events store
      eventStore.put(event);

      // Add to sync queue
      syncStore.put({
        id: event.id,
        eventId: event.id,
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Save multiple events
   */
  async saveEvents(events) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['events', 'syncQueue'], 'readwrite');
      const eventStore = tx.objectStore('events');
      const syncStore = tx.objectStore('syncQueue');

      for (const event of events) {
        eventStore.put(event);
        syncStore.put({
          id: event.id,
          eventId: event.id,
          status: 'pending',
          createdAt: new Date().toISOString(),
          retryCount: 0
        });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Load all events
   */
  async loadEvents() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('events', 'readonly');
      const store = tx.objectStore('events');
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by logical clock
        const events = request.result.sort((a, b) =>
          (a.logicalClock || 0) - (b.logicalClock || 0)
        );
        resolve(events);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get event by ID
   */
  async getEvent(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('events', 'readonly');
      const store = tx.objectStore('events');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save horizon
   */
  async saveHorizon(horizon) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('horizons', 'readwrite');
      const store = tx.objectStore('horizons');
      store.put(horizon);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Load all horizons
   */
  async loadHorizons() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('horizons', 'readonly');
      const store = tx.objectStore('horizons');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get pending sync items
   */
  async getPendingSyncItems() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('syncQueue', 'readonly');
      const store = tx.objectStore('syncQueue');
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Mark sync item as synced
   */
  async markSynced(eventId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const request = store.get(eventId);

      request.onsuccess = () => {
        const item = request.result;
        if (item) {
          item.status = 'synced';
          item.syncedAt = new Date().toISOString();
          store.put(item);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Mark sync item as failed
   */
  async markSyncFailed(eventId, error) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const request = store.get(eventId);

      request.onsuccess = () => {
        const item = request.result;
        if (item) {
          item.status = 'failed';
          item.error = error;
          item.retryCount++;
          item.lastAttempt = new Date().toISOString();
          store.put(item);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Save metadata
   */
  async saveMetadata(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      store.put({ key, value, updatedAt: new Date().toISOString() });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Load metadata
   */
  async loadMetadata(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    const events = await this.loadEvents();
    const syncQueue = await this.getPendingSyncItems();

    return {
      eventCount: events.length,
      pendingSyncCount: syncQueue.length,
      oldestEvent: events[0]?.timestamp,
      newestEvent: events[events.length - 1]?.timestamp
    };
  }

  /**
   * Clear all data (use with caution!)
   */
  async clear() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(
        ['events', 'horizons', 'syncQueue', 'metadata'],
        'readwrite'
      );

      tx.objectStore('events').clear();
      tx.objectStore('horizons').clear();
      tx.objectStore('syncQueue').clear();
      tx.objectStore('metadata').clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/**
 * LocalStorage fallback backend
 */
class LocalStorageBackend {
  constructor(prefix = 'eo_') {
    this.prefix = prefix;
  }

  async init() {
    return this;
  }

  async saveEvent(event) {
    const events = this._getEvents();
    events.push(event);
    this._setEvents(events);

    // Add to sync queue
    const queue = this._getSyncQueue();
    queue.push({
      id: event.id,
      eventId: event.id,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    this._setSyncQueue(queue);
  }

  async saveEvents(events) {
    for (const event of events) {
      await this.saveEvent(event);
    }
  }

  async loadEvents() {
    return this._getEvents().sort((a, b) =>
      (a.logicalClock || 0) - (b.logicalClock || 0)
    );
  }

  async getEvent(id) {
    return this._getEvents().find(e => e.id === id);
  }

  async saveHorizon(horizon) {
    const horizons = this._getHorizons();
    const idx = horizons.findIndex(h => h.id === horizon.id);
    if (idx >= 0) {
      horizons[idx] = horizon;
    } else {
      horizons.push(horizon);
    }
    this._setHorizons(horizons);
  }

  async loadHorizons() {
    return this._getHorizons();
  }

  async getPendingSyncItems() {
    return this._getSyncQueue().filter(item => item.status === 'pending');
  }

  async markSynced(eventId) {
    const queue = this._getSyncQueue();
    const item = queue.find(i => i.eventId === eventId);
    if (item) {
      item.status = 'synced';
      item.syncedAt = new Date().toISOString();
    }
    this._setSyncQueue(queue);
  }

  async markSyncFailed(eventId, error) {
    const queue = this._getSyncQueue();
    const item = queue.find(i => i.eventId === eventId);
    if (item) {
      item.status = 'failed';
      item.error = error;
    }
    this._setSyncQueue(queue);
  }

  async saveMetadata(key, value) {
    localStorage.setItem(this.prefix + 'meta_' + key, JSON.stringify(value));
  }

  async loadMetadata(key) {
    const value = localStorage.getItem(this.prefix + 'meta_' + key);
    return value ? JSON.parse(value) : null;
  }

  async getStats() {
    const events = this._getEvents();
    const syncQueue = this._getSyncQueue().filter(i => i.status === 'pending');
    return {
      eventCount: events.length,
      pendingSyncCount: syncQueue.length
    };
  }

  async clear() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.prefix)) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
  }

  _getEvents() {
    const data = localStorage.getItem(this.prefix + 'events');
    return data ? JSON.parse(data) : [];
  }

  _setEvents(events) {
    localStorage.setItem(this.prefix + 'events', JSON.stringify(events));
  }

  _getHorizons() {
    const data = localStorage.getItem(this.prefix + 'horizons');
    return data ? JSON.parse(data) : [];
  }

  _setHorizons(horizons) {
    localStorage.setItem(this.prefix + 'horizons', JSON.stringify(horizons));
  }

  _getSyncQueue() {
    const data = localStorage.getItem(this.prefix + 'syncQueue');
    return data ? JSON.parse(data) : [];
  }

  _setSyncQueue(queue) {
    localStorage.setItem(this.prefix + 'syncQueue', JSON.stringify(queue));
  }
}

/**
 * Persistence Manager
 */
class EOPersistence {
  constructor() {
    this.backend = null;
    this.eventStore = null;
    this.horizonLattice = null;
    this.autoSaveInterval = null;
    this.autoSaveDelay = 5000; // 5 seconds
    this._pendingSave = false;
  }

  /**
   * Initialize persistence with the best available backend
   */
  async init(eventStore, horizonLattice, options = {}) {
    this.eventStore = eventStore;
    this.horizonLattice = horizonLattice;

    // Try IndexedDB first, fall back to localStorage
    if (typeof indexedDB !== 'undefined') {
      try {
        this.backend = new IndexedDBBackend(options.dbName);
        await this.backend.init();
        console.log('EOPersistence: Using IndexedDB');
      } catch (e) {
        console.warn('EOPersistence: IndexedDB failed, using localStorage', e);
        this.backend = new LocalStorageBackend(options.prefix);
        await this.backend.init();
      }
    } else {
      this.backend = new LocalStorageBackend(options.prefix);
      await this.backend.init();
      console.log('EOPersistence: Using localStorage');
    }

    // Load existing data
    await this.load();

    // Subscribe to new events for auto-save
    this.eventStore.subscribe(() => this._scheduleSave());

    // Start auto-save interval
    if (options.autoSave !== false) {
      this.startAutoSave();
    }

    return this;
  }

  /**
   * Load all persisted data into the event store
   */
  async load() {
    const events = await this.backend.loadEvents();
    const horizons = await this.backend.loadHorizons();

    console.log(`EOPersistence: Loading ${events.length} events, ${horizons.length} horizons`);

    // Import events
    for (const event of events) {
      this.eventStore.append(event);
    }

    // Import horizons
    this.horizonLattice.import({ horizons });

    return { events: events.length, horizons: horizons.length };
  }

  /**
   * Save current state to persistence
   */
  async save() {
    const events = this.eventStore.export();
    const horizons = this.horizonLattice.export();

    // Save all events
    await this.backend.saveEvents(events.events);

    // Save all horizons
    for (const horizon of horizons.horizons) {
      await this.backend.saveHorizon(horizon);
    }

    // Save metadata
    await this.backend.saveMetadata('lastSave', new Date().toISOString());
    await this.backend.saveMetadata('eventCount', events.events.length);
    await this.backend.saveMetadata('logicalClock', events.logicalClock);

    this._pendingSave = false;

    return { events: events.events.length, horizons: horizons.horizons.length };
  }

  /**
   * Schedule a save (debounced)
   */
  _scheduleSave() {
    if (this._pendingSave) return;
    this._pendingSave = true;

    setTimeout(() => {
      this.save().catch(err => console.error('Auto-save failed:', err));
    }, this.autoSaveDelay);
  }

  /**
   * Start auto-save interval
   */
  startAutoSave(interval = 30000) {
    if (this.autoSaveInterval) return;

    this.autoSaveInterval = setInterval(() => {
      if (this._pendingSave) {
        this.save().catch(err => console.error('Auto-save failed:', err));
      }
    }, interval);
  }

  /**
   * Stop auto-save
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Get sync queue items (for future cloud sync)
   */
  async getPendingSync() {
    return this.backend.getPendingSyncItems();
  }

  /**
   * Mark event as synced
   */
  async markSynced(eventId) {
    return this.backend.markSynced(eventId);
  }

  /**
   * Mark sync as failed
   */
  async markSyncFailed(eventId, error) {
    return this.backend.markSyncFailed(eventId, error);
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    return this.backend.getStats();
  }

  /**
   * Export all data for backup
   */
  async exportBackup() {
    const events = await this.backend.loadEvents();
    const horizons = await this.backend.loadHorizons();
    const metadata = {
      exportedAt: new Date().toISOString(),
      eventCount: events.length,
      horizonCount: horizons.length
    };

    return { metadata, events, horizons };
  }

  /**
   * Import data from backup
   */
  async importBackup(backup) {
    if (!backup.events || !backup.horizons) {
      throw new Error('Invalid backup format');
    }

    // Clear existing data
    await this.backend.clear();

    // Import events
    await this.backend.saveEvents(backup.events);

    // Import horizons
    for (const horizon of backup.horizons) {
      await this.backend.saveHorizon(horizon);
    }

    // Reload into memory
    return this.load();
  }

  /**
   * Clear all persisted data
   */
  async clear() {
    await this.backend.clear();
    this.eventStore._clear();
  }
}

// Singleton
let _persistence = null;

function getPersistence() {
  return _persistence;
}

async function initPersistence(eventStore, horizonLattice, options = {}) {
  _persistence = new EOPersistence();
  await _persistence.init(eventStore, horizonLattice, options);
  return _persistence;
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    IndexedDBBackend,
    LocalStorageBackend,
    EOPersistence,
    getPersistence,
    initPersistence
  };
}

if (typeof window !== 'undefined') {
  window.IndexedDBBackend = IndexedDBBackend;
  window.LocalStorageBackend = LocalStorageBackend;
  window.EOPersistence = EOPersistence;
  window.getPersistence = getPersistence;
  window.initPersistence = initPersistence;
}
