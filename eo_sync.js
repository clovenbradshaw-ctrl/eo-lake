/**
 * EO Sync Protocol - Cloud Synchronization Layer
 *
 * Implements the sync protocol from the Sync Handbook.
 * Currently a stub for future cloud API integration.
 *
 * Key principles:
 * - Rule 3: Capture Before Coordination (local-first)
 * - Rule 4: Non-Collapse of Concurrency
 * - Rule 6: Operations, Not Snapshots
 * - Rule 7: Failure Is a State
 * - Rule 8: Idempotent Replay
 *
 * Protocol Messages:
 * - SCOPE: Negotiate session parameters
 * - INV: Advertise what you have (inventory)
 * - HAVE: Declare possession
 * - WANT: Request events
 * - SEND: Transfer events
 * - REFUSE: Decline with reason
 */

/**
 * Sync message types
 */
const SyncMessageType = Object.freeze({
  SCOPE: 'scope',
  SCOPE_ACK: 'scope_ack',
  INV: 'inv',
  HAVE: 'have',
  WANT: 'want',
  SEND: 'send',
  ACK: 'ack',
  REFUSE: 'refuse',
  CONFLICT: 'conflict'
});

/**
 * Sync status
 */
const SyncStatus = Object.freeze({
  IDLE: 'idle',
  CONNECTING: 'connecting',
  NEGOTIATING: 'negotiating',
  SYNCING: 'syncing',
  COMPLETE: 'complete',
  FAILED: 'failed',
  OFFLINE: 'offline'
});

/**
 * Bloom filter for efficient set reconciliation
 */
class BloomFilter {
  constructor(size = 1024, hashCount = 3) {
    this.size = size;
    this.hashCount = hashCount;
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }

  /**
   * Simple hash function
   */
  _hash(str, seed) {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % this.size;
  }

  /**
   * Add an item to the filter
   */
  add(item) {
    for (let i = 0; i < this.hashCount; i++) {
      const bit = this._hash(item, i);
      const byteIdx = Math.floor(bit / 8);
      const bitIdx = bit % 8;
      this.bits[byteIdx] |= (1 << bitIdx);
    }
  }

  /**
   * Check if item might be in set
   */
  mightContain(item) {
    for (let i = 0; i < this.hashCount; i++) {
      const bit = this._hash(item, i);
      const byteIdx = Math.floor(bit / 8);
      const bitIdx = bit % 8;
      if ((this.bits[byteIdx] & (1 << bitIdx)) === 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Export to base64
   */
  toBase64() {
    return btoa(String.fromCharCode(...this.bits));
  }

  /**
   * Import from base64
   */
  static fromBase64(str, size = 1024, hashCount = 3) {
    const filter = new BloomFilter(size, hashCount);
    const decoded = atob(str);
    for (let i = 0; i < decoded.length; i++) {
      filter.bits[i] = decoded.charCodeAt(i);
    }
    return filter;
  }
}

/**
 * Vector clock for causal ordering
 */
class VectorClock {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.clock = new Map();
  }

  /**
   * Increment the clock for this node
   */
  increment() {
    const current = this.clock.get(this.nodeId) || 0;
    this.clock.set(this.nodeId, current + 1);
    return this;
  }

  /**
   * Merge with another clock
   */
  merge(other) {
    for (const [nodeId, value] of other.clock) {
      const current = this.clock.get(nodeId) || 0;
      this.clock.set(nodeId, Math.max(current, value));
    }
    return this;
  }

  /**
   * Compare to another clock
   * Returns: 'before' | 'after' | 'concurrent' | 'equal'
   */
  compare(other) {
    let thisGreater = false;
    let otherGreater = false;

    const allNodes = new Set([...this.clock.keys(), ...other.clock.keys()]);

    for (const nodeId of allNodes) {
      const thisValue = this.clock.get(nodeId) || 0;
      const otherValue = other.clock.get(nodeId) || 0;

      if (thisValue > otherValue) thisGreater = true;
      if (otherValue > thisValue) otherGreater = true;
    }

    if (thisGreater && otherGreater) return 'concurrent';
    if (thisGreater) return 'after';
    if (otherGreater) return 'before';
    return 'equal';
  }

  /**
   * Export to object
   */
  toObject() {
    return Object.fromEntries(this.clock);
  }

  /**
   * Import from object
   */
  static fromObject(obj, nodeId) {
    const vc = new VectorClock(nodeId);
    for (const [k, v] of Object.entries(obj)) {
      vc.clock.set(k, v);
    }
    return vc;
  }
}

/**
 * Sync scope - defines what can be synced
 */
class SyncScope {
  constructor(workspace, frames = [], horizon = null) {
    this.workspace = workspace;
    this.frames = frames;
    this.horizon = horizon;
    this.protocolVersion = '1.0';
  }

  toMessage() {
    return {
      type: SyncMessageType.SCOPE,
      workspace: this.workspace,
      frames: this.frames,
      horizon: this.horizon,
      protocolVersion: this.protocolVersion
    };
  }
}

/**
 * Sync session - manages a single sync operation
 */
class SyncSession {
  constructor(eventStore, scope, options = {}) {
    this.eventStore = eventStore;
    this.scope = scope;
    this.options = options;

    this.status = SyncStatus.IDLE;
    this.remoteHeads = [];
    this.localHeads = [];
    this.toSend = [];
    this.toReceive = [];
    this.conflicts = [];
    this.stats = {
      sent: 0,
      received: 0,
      conflicts: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * Start sync session
   */
  async start() {
    this.status = SyncStatus.NEGOTIATING;
    this.stats.startTime = new Date().toISOString();

    // Get local heads
    this.localHeads = this.eventStore.getHeads().map(e => e.id);

    return this.scope.toMessage();
  }

  /**
   * Create inventory message
   */
  createInventory() {
    const events = this.eventStore.getAll();

    // Build bloom filter
    const bloom = new BloomFilter();
    for (const event of events) {
      bloom.add(event.id);
    }

    return {
      type: SyncMessageType.INV,
      heads: this.localHeads,
      count: events.length,
      bloomFilter: bloom.toBase64()
    };
  }

  /**
   * Process received inventory
   */
  processInventory(inv) {
    this.remoteHeads = inv.heads || [];

    // Determine what we need
    const remoteBloom = inv.bloomFilter
      ? BloomFilter.fromBase64(inv.bloomFilter)
      : null;

    // We want remote heads that we definitely don't have
    this.toReceive = this.remoteHeads.filter(id => {
      if (this.eventStore.get(id)) return false;
      return true;
    });

    // What we might need to send
    const localEvents = this.eventStore.getAll();
    this.toSend = localEvents.filter(e => {
      // If remote might have it, skip
      if (remoteBloom && remoteBloom.mightContain(e.id)) return false;
      return true;
    });

    return {
      have: localEvents.map(e => e.id),
      want: this.toReceive
    };
  }

  /**
   * Create SEND message for requested events
   */
  createSend(requestedIds) {
    const events = [];

    for (const id of requestedIds) {
      const event = this.eventStore.get(id);
      if (event) {
        // Rule 2: Identity must not be laundered - preserve actor exactly
        events.push(event);
        this.stats.sent++;
      }
    }

    return {
      type: SyncMessageType.SEND,
      events
    };
  }

  /**
   * Process received events
   */
  processReceived(events) {
    const results = {
      accepted: [],
      rejected: [],
      conflicts: []
    };

    for (const event of events) {
      // Validate scope
      if (event.context?.workspace !== this.scope.workspace) {
        results.rejected.push({ id: event.id, reason: 'outside_scope' });
        continue;
      }

      // Detect conflicts (concurrent events)
      if (event.parents) {
        for (const parentId of event.parents) {
          const parent = this.eventStore.get(parentId);
          if (parent) {
            const localChildren = this.eventStore.getAll()
              .filter(e => e.parents?.includes(parentId) && e.id !== event.id);

            for (const localChild of localChildren) {
              // Both have same parent - concurrent
              if (!this._isCausallyOrdered(localChild, event)) {
                results.conflicts.push({
                  localEvent: localChild.id,
                  remoteEvent: event.id,
                  commonParent: parentId
                });
                this.conflicts.push({
                  local: localChild,
                  remote: event,
                  parent: parentId
                });
                this.stats.conflicts++;
              }
            }
          }
        }
      }

      // Append the event (Rule 8: idempotent)
      const result = this.eventStore.append(event);
      if (result.success) {
        results.accepted.push(event.id);
        this.stats.received++;
      } else {
        results.rejected.push({ id: event.id, reason: result.error });
      }
    }

    return results;
  }

  /**
   * Check if events are causally ordered
   */
  _isCausallyOrdered(a, b) {
    if (a.parents?.includes(b.id)) return true;
    if (b.parents?.includes(a.id)) return true;
    return false;
  }

  /**
   * Complete the sync session
   */
  complete() {
    this.status = SyncStatus.COMPLETE;
    this.stats.endTime = new Date().toISOString();

    return {
      status: this.status,
      stats: this.stats,
      conflicts: this.conflicts
    };
  }

  /**
   * Mark as failed
   */
  fail(error) {
    this.status = SyncStatus.FAILED;
    this.stats.endTime = new Date().toISOString();
    this.stats.error = error;

    return {
      status: this.status,
      error,
      stats: this.stats
    };
  }
}

/**
 * Sync Engine - manages sync operations
 */
class EOSyncEngine {
  constructor(eventStore, persistence) {
    this.eventStore = eventStore;
    this.persistence = persistence;

    this.status = SyncStatus.OFFLINE;
    this.apiEndpoint = null;
    this.deviceId = this._generateDeviceId();
    this.currentSession = null;

    // Retry configuration
    this.maxRetries = 4;
    this.retryDelays = [2000, 4000, 8000, 16000]; // Exponential backoff
  }

  /**
   * Generate a device ID
   */
  _generateDeviceId() {
    if (typeof localStorage !== 'undefined') {
      let deviceId = localStorage.getItem('eo_device_id');
      if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('eo_device_id', deviceId);
      }
      return deviceId;
    }
    return 'device_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Configure the sync endpoint
   * (To be called when cloud API is ready)
   */
  configure(endpoint, options = {}) {
    this.apiEndpoint = endpoint;
    this.authToken = options.authToken;
    this.status = SyncStatus.IDLE;

    console.log('EOSyncEngine: Configured for', endpoint);
  }

  /**
   * Check if sync is available
   */
  isAvailable() {
    return this.apiEndpoint !== null;
  }

  /**
   * Start a sync session
   */
  async sync(workspace, options = {}) {
    if (!this.isAvailable()) {
      return this._recordSyncFailure('Sync not configured');
    }

    const scope = new SyncScope(workspace, options.frames, options.horizon);
    this.currentSession = new SyncSession(this.eventStore, scope, options);

    this.status = SyncStatus.CONNECTING;

    try {
      // Start session
      const scopeMsg = await this.currentSession.start();

      // Exchange inventory
      const invMsg = this.currentSession.createInventory();

      // In the future, this will communicate with the cloud API:
      // const remoteInv = await this._sendToServer(invMsg);
      // const { want } = this.currentSession.processInventory(remoteInv);
      // const remoteEvents = await this._requestEvents(want);
      // this.currentSession.processReceived(remoteEvents);

      // For now, just record that we attempted
      console.log('EOSyncEngine: Sync attempted (cloud API not connected)');

      return this.currentSession.complete();

    } catch (error) {
      return this._handleSyncError(error);
    }
  }

  /**
   * Handle sync error with retry
   */
  async _handleSyncError(error, retryCount = 0) {
    if (retryCount < this.maxRetries) {
      const delay = this.retryDelays[retryCount];
      console.log(`EOSyncEngine: Retry ${retryCount + 1} after ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return this.sync(this.currentSession?.scope?.workspace);
    }

    return this._recordSyncFailure(error.message);
  }

  /**
   * Record sync failure as an event (Rule 7: Failure is a state)
   */
  _recordSyncFailure(error) {
    const failureEvent = {
      id: generateEventId({ action: 'sync_failure', error }),
      type: 'given',
      actor: 'sync_engine',
      timestamp: new Date().toISOString(),
      mode: 'received',
      parents: this.eventStore.getHeads().map(e => e.id),
      context: {
        workspace: this.currentSession?.scope?.workspace || 'system',
        schemaVersion: '1.0'
      },
      payload: {
        action: 'sync_failure',
        error,
        deviceId: this.deviceId
      }
    };

    this.eventStore.append(failureEvent);
    this.status = SyncStatus.FAILED;

    if (this.currentSession) {
      return this.currentSession.fail(error);
    }

    return { status: SyncStatus.FAILED, error };
  }

  /**
   * Get pending sync items
   */
  async getPendingItems() {
    if (!this.persistence) return [];
    return this.persistence.getPendingSync();
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      status: this.status,
      available: this.isAvailable(),
      endpoint: this.apiEndpoint,
      deviceId: this.deviceId,
      session: this.currentSession ? {
        workspace: this.currentSession.scope?.workspace,
        stats: this.currentSession.stats
      } : null
    };
  }

  /**
   * Placeholder for future API communication
   */
  async _sendToServer(message) {
    // Future implementation:
    // const response = await fetch(this.apiEndpoint, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${this.authToken}`
    //   },
    //   body: JSON.stringify(message)
    // });
    // return response.json();

    throw new Error('Cloud API not implemented');
  }
}

// Helper
function generateEventId(payload) {
  const str = JSON.stringify(payload) + Date.now() + Math.random();
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return 'evt_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
}

// Singleton
let _syncEngine = null;

function getSyncEngine() {
  return _syncEngine;
}

function initSyncEngine(eventStore, persistence) {
  _syncEngine = new EOSyncEngine(eventStore, persistence);
  return _syncEngine;
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SyncMessageType,
    SyncStatus,
    BloomFilter,
    VectorClock,
    SyncScope,
    SyncSession,
    EOSyncEngine,
    getSyncEngine,
    initSyncEngine
  };
}

if (typeof window !== 'undefined') {
  window.SyncMessageType = SyncMessageType;
  window.SyncStatus = SyncStatus;
  window.BloomFilter = BloomFilter;
  window.VectorClock = VectorClock;
  window.SyncScope = SyncScope;
  window.SyncSession = SyncSession;
  window.EOSyncEngine = EOSyncEngine;
  window.getSyncEngine = getSyncEngine;
  window.initSyncEngine = initSyncEngine;
}
