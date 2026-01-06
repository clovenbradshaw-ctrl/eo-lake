/**
 * EO User Activity Tracking
 *
 * Comprehensive audit trail for all user actions in the system.
 * Every action that affects data or system state should be tracked
 * with full provenance linking to the user who performed it.
 *
 * Design Principles:
 * 1. ALL actions attributable to users - no anonymous modifications
 * 2. Immutable audit log - activities cannot be modified after creation
 * 3. Rich context - capture why, how, and what for each action
 * 4. Queryable - efficiently find actions by user, time, type, target
 * 5. Privacy-aware - respect data retention policies
 *
 * Activity Categories:
 * - Authentication: login, logout, password changes
 * - Data: create, read, update, delete operations
 * - Import/Export: data movement operations
 * - Sharing: collaboration and access changes
 * - System: configuration and settings changes
 */

// ============================================================================
// Activity Categories and Types
// ============================================================================

/**
 * High-level activity categories
 */
const ActivityCategory = Object.freeze({
  AUTH: 'auth',           // Authentication events
  DATA: 'data',           // Data manipulation
  IMPORT: 'import',       // Data import operations
  EXPORT: 'export',       // Data export operations
  SHARE: 'share',         // Sharing and collaboration
  SYSTEM: 'system',       // System configuration
  VIEW: 'view'            // Viewing/reading actions (optional tracking)
});

/**
 * Specific activity types within each category
 */
const ActivityType = Object.freeze({
  // Authentication
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_LOGIN_FAILED: 'auth.login_failed',
  AUTH_PASSWORD_CHANGED: 'auth.password_changed',
  AUTH_PASSWORD_RESET: 'auth.password_reset',
  AUTH_MFA_ENABLED: 'auth.mfa_enabled',
  AUTH_MFA_DISABLED: 'auth.mfa_disabled',
  AUTH_SESSION_EXPIRED: 'auth.session_expired',

  // Data operations
  DATA_CREATED: 'data.created',
  DATA_UPDATED: 'data.updated',
  DATA_DELETED: 'data.deleted',
  DATA_RESTORED: 'data.restored',
  DATA_MERGED: 'data.merged',
  DATA_SPLIT: 'data.split',

  // Record-level operations
  RECORD_CREATED: 'data.record_created',
  RECORD_UPDATED: 'data.record_updated',
  RECORD_DELETED: 'data.record_deleted',

  // Field-level operations
  FIELD_UPDATED: 'data.field_updated',
  FIELD_CLEARED: 'data.field_cleared',

  // Schema operations
  SCHEMA_CREATED: 'data.schema_created',
  SCHEMA_UPDATED: 'data.schema_updated',
  SCHEMA_FIELD_ADDED: 'data.schema_field_added',
  SCHEMA_FIELD_REMOVED: 'data.schema_field_removed',
  SCHEMA_FIELD_RENAMED: 'data.schema_field_renamed',

  // Import operations
  IMPORT_STARTED: 'import.started',
  IMPORT_COMPLETED: 'import.completed',
  IMPORT_FAILED: 'import.failed',
  IMPORT_CANCELLED: 'import.cancelled',

  // Export operations
  EXPORT_STARTED: 'export.started',
  EXPORT_COMPLETED: 'export.completed',
  EXPORT_FAILED: 'export.failed',

  // Sharing and collaboration
  SHARE_PROJECT: 'share.project',
  SHARE_SET: 'share.set',
  SHARE_VIEW: 'share.view',
  SHARE_REVOKED: 'share.revoked',
  SHARE_INVITATION_SENT: 'share.invitation_sent',
  SHARE_INVITATION_ACCEPTED: 'share.invitation_accepted',
  SHARE_INVITATION_DECLINED: 'share.invitation_declined',

  // Access control
  ACCESS_GRANTED: 'share.access_granted',
  ACCESS_REVOKED: 'share.access_revoked',
  ACCESS_ROLE_CHANGED: 'share.role_changed',

  // System configuration
  SYSTEM_SETTINGS_CHANGED: 'system.settings_changed',
  SYSTEM_INTEGRATION_ADDED: 'system.integration_added',
  SYSTEM_INTEGRATION_REMOVED: 'system.integration_removed',

  // User management
  USER_CREATED: 'system.user_created',
  USER_UPDATED: 'system.user_updated',
  USER_DEACTIVATED: 'system.user_deactivated',
  USER_REACTIVATED: 'system.user_reactivated',

  // Project operations
  PROJECT_CREATED: 'data.project_created',
  PROJECT_UPDATED: 'data.project_updated',
  PROJECT_ARCHIVED: 'data.project_archived',
  PROJECT_RESTORED: 'data.project_restored',
  PROJECT_DELETED: 'data.project_deleted',

  // View/read operations (optional)
  VIEW_PROJECT: 'view.project',
  VIEW_SET: 'view.set',
  VIEW_RECORD: 'view.record',
  VIEW_EXPORTED_DATA: 'view.exported_data'
});

/**
 * Activity result/outcome
 */
const ActivityResult = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
  PARTIAL: 'partial',
  CANCELLED: 'cancelled',
  PENDING: 'pending'
});

// ============================================================================
// Activity Entry
// ============================================================================

/**
 * Generate unique activity ID
 */
function generateActivityId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `uact_${timestamp}_${random}`;
}

/**
 * UserActivity represents a single tracked user action
 *
 * This is the core audit log entry. Each activity captures:
 * - WHO: userId (required), sessionId
 * - WHAT: type, category, target
 * - WHEN: timestamp
 * - WHERE: clientContext (IP, user agent, etc.)
 * - WHY: reason, context
 * - HOW: method, details
 * - RESULT: outcome, changes made
 */
class UserActivity {
  constructor(options = {}) {
    // Identity
    this.id = options.id || generateActivityId();

    // WHO - User attribution (REQUIRED)
    this.userId = options.userId;
    this.userDisplayName = options.userDisplayName || null;
    this.sessionId = options.sessionId || null;

    // Delegation tracking
    this.delegatedFrom = options.delegatedFrom || null;
    this.delegationReason = options.delegationReason || null;

    // WHAT - Action classification
    this.type = options.type; // From ActivityType
    this.category = options.category || this._deriveCategory(options.type);

    // Target of the action
    this.targetType = options.targetType || null; // project, set, record, field, user
    this.targetId = options.targetId || null;
    this.targetName = options.targetName || null;

    // WHEN
    this.timestamp = options.timestamp || new Date().toISOString();

    // WHERE - Client context
    this.clientContext = options.clientContext || {
      ipAddress: null,
      userAgent: null,
      platform: null,
      timezone: null,
      locale: null
    };

    // WHY - Reason/context
    this.reason = options.reason || null;
    this.context = options.context || {};

    // HOW - Method details
    this.method = options.method || null; // ui, api, import, scheduled, etc.
    this.details = options.details || {};

    // RESULT - Outcome
    this.result = options.result || ActivityResult.SUCCESS;
    this.errorMessage = options.errorMessage || null;
    this.changes = options.changes || null; // { before: {}, after: {} }

    // Metadata
    this.metadata = options.metadata || {};

    // Immutability - freeze after creation
    Object.freeze(this.clientContext);
    Object.freeze(this.context);
    Object.freeze(this.details);
    if (this.changes) Object.freeze(this.changes);
    Object.freeze(this.metadata);
  }

  /**
   * Derive category from activity type
   */
  _deriveCategory(type) {
    if (!type) return null;
    const prefix = type.split('.')[0];
    return prefix || null;
  }

  /**
   * Check if this is a data modification activity
   */
  isDataModification() {
    return this.category === ActivityCategory.DATA &&
           [ActivityType.DATA_CREATED, ActivityType.DATA_UPDATED,
            ActivityType.DATA_DELETED, ActivityType.RECORD_CREATED,
            ActivityType.RECORD_UPDATED, ActivityType.RECORD_DELETED,
            ActivityType.FIELD_UPDATED].includes(this.type);
  }

  /**
   * Check if this is an authentication activity
   */
  isAuthActivity() {
    return this.category === ActivityCategory.AUTH;
  }

  /**
   * Check if this activity was delegated (system acting on behalf of user)
   */
  isDelegated() {
    return this.delegatedFrom !== null;
  }

  /**
   * Get a human-readable summary of this activity
   */
  getSummary() {
    const user = this.userDisplayName || this.userId;
    const target = this.targetName || this.targetId || '';
    const typeLabel = this.type.replace(/\./g, ' ').replace(/_/g, ' ');

    if (target) {
      return `${user} ${typeLabel}: ${target}`;
    }
    return `${user} ${typeLabel}`;
  }

  /**
   * Serialize for storage
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      userDisplayName: this.userDisplayName,
      sessionId: this.sessionId,
      delegatedFrom: this.delegatedFrom,
      delegationReason: this.delegationReason,
      type: this.type,
      category: this.category,
      targetType: this.targetType,
      targetId: this.targetId,
      targetName: this.targetName,
      timestamp: this.timestamp,
      clientContext: { ...this.clientContext },
      reason: this.reason,
      context: { ...this.context },
      method: this.method,
      details: { ...this.details },
      result: this.result,
      errorMessage: this.errorMessage,
      changes: this.changes ? { ...this.changes } : null,
      metadata: { ...this.metadata }
    };
  }

  /**
   * Create from stored data
   */
  static fromJSON(data) {
    return new UserActivity(data);
  }
}

// ============================================================================
// Activity Store
// ============================================================================

/**
 * UserActivityStore provides persistent storage and querying for user activities
 */
class UserActivityStore {
  constructor() {
    this.activities = new Map();
    this.dbName = 'eo_user_activity_store';
    this.dbVersion = 1;
    this.db = null;

    // Indexes for efficient querying
    this.byUser = new Map();      // userId -> Set<activityId>
    this.byTarget = new Map();    // targetId -> Set<activityId>
    this.byType = new Map();      // type -> Set<activityId>
    this.byTime = [];             // Sorted by timestamp

    // Subscribers
    this._subscribers = new Set();
  }

  /**
   * Initialize IndexedDB
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        this._loadFromDB().then(resolve).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('activities')) {
          const store = db.createObjectStore('activities', { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('targetId', 'targetId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('sessionId', 'sessionId', { unique: false });
        }
      };
    });
  }

  /**
   * Load activities from IndexedDB
   */
  async _loadFromDB() {
    if (!this.db) return;

    const activities = await this._getAllFromStore('activities');
    for (const data of activities) {
      const activity = UserActivity.fromJSON(data);
      this.activities.set(activity.id, activity);
      this._indexActivity(activity);
    }

    console.log(`UserActivityStore loaded: ${this.activities.size} activities`);
  }

  async _getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async _saveToDB(storeName, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Index an activity for efficient querying
   */
  _indexActivity(activity) {
    // By user
    if (activity.userId) {
      if (!this.byUser.has(activity.userId)) {
        this.byUser.set(activity.userId, new Set());
      }
      this.byUser.get(activity.userId).add(activity.id);
    }

    // By target
    if (activity.targetId) {
      if (!this.byTarget.has(activity.targetId)) {
        this.byTarget.set(activity.targetId, new Set());
      }
      this.byTarget.get(activity.targetId).add(activity.id);
    }

    // By type
    if (activity.type) {
      if (!this.byType.has(activity.type)) {
        this.byType.set(activity.type, new Set());
      }
      this.byType.get(activity.type).add(activity.id);
    }

    // By time (maintain sorted order)
    this.byTime.push({
      id: activity.id,
      timestamp: new Date(activity.timestamp).getTime()
    });
    this.byTime.sort((a, b) => b.timestamp - a.timestamp);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Recording Activities
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Record a new activity
   *
   * @param {Object} options - Activity options
   * @returns {UserActivity} The recorded activity
   */
  async record(options) {
    // Validate userId is present
    if (!options.userId) {
      // Try to get from current user/session
      if (typeof window !== 'undefined') {
        if (window.getCurrentUser) {
          const user = window.getCurrentUser();
          if (user) {
            options.userId = user.id;
            options.userDisplayName = user.getDisplayName?.() || user.displayName;
          }
        }
        if (!options.userId && window.getAgentSession) {
          const session = window.getAgentSession();
          if (session?.userId) {
            options.userId = session.userId;
            options.userDisplayName = session.userDisplayName;
            options.sessionId = session.sessionId;
          }
        }
      }
    }

    // Still no userId - use anonymous for tracking but log warning
    if (!options.userId) {
      console.warn('Recording activity without userId - provenance incomplete');
      options.userId = 'user_anonymous';
    }

    const activity = new UserActivity(options);

    this.activities.set(activity.id, activity);
    this._indexActivity(activity);

    if (this.db) {
      await this._saveToDB('activities', activity.toJSON());
    }

    this._notify('activity:recorded', activity);
    return activity;
  }

  /**
   * Record a data modification activity
   */
  async recordDataChange(options) {
    return this.record({
      ...options,
      category: ActivityCategory.DATA,
      method: options.method || 'ui'
    });
  }

  /**
   * Record an authentication activity
   */
  async recordAuth(options) {
    return this.record({
      ...options,
      category: ActivityCategory.AUTH
    });
  }

  /**
   * Record an import activity
   */
  async recordImport(options) {
    return this.record({
      ...options,
      category: ActivityCategory.IMPORT
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Querying Activities
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get activity by ID
   */
  get(id) {
    return this.activities.get(id) || null;
  }

  /**
   * Get activities for a user
   */
  getByUser(userId, options = {}) {
    const ids = this.byUser.get(userId);
    if (!ids) return [];

    let activities = Array.from(ids).map(id => this.activities.get(id));

    // Apply filters
    if (options.type) {
      activities = activities.filter(a => a.type === options.type);
    }
    if (options.category) {
      activities = activities.filter(a => a.category === options.category);
    }
    if (options.startTime) {
      const start = new Date(options.startTime).getTime();
      activities = activities.filter(a => new Date(a.timestamp).getTime() >= start);
    }
    if (options.endTime) {
      const end = new Date(options.endTime).getTime();
      activities = activities.filter(a => new Date(a.timestamp).getTime() <= end);
    }

    // Sort by time (newest first)
    activities.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Limit
    if (options.limit) {
      activities = activities.slice(0, options.limit);
    }

    return activities;
  }

  /**
   * Get activities for a target (project, set, record, etc.)
   */
  getByTarget(targetId, options = {}) {
    const ids = this.byTarget.get(targetId);
    if (!ids) return [];

    let activities = Array.from(ids).map(id => this.activities.get(id));

    // Sort by time (newest first)
    activities.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (options.limit) {
      activities = activities.slice(0, options.limit);
    }

    return activities;
  }

  /**
   * Get recent activities
   */
  getRecent(options = {}) {
    const limit = options.limit || 100;
    const activities = this.byTime
      .slice(0, limit)
      .map(entry => this.activities.get(entry.id))
      .filter(Boolean);

    return activities;
  }

  /**
   * Query activities with filters
   */
  query(filters = {}) {
    let results = Array.from(this.activities.values());

    // Filter by user
    if (filters.userId) {
      results = results.filter(a => a.userId === filters.userId);
    }

    // Filter by type
    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      results = results.filter(a => types.includes(a.type));
    }

    // Filter by category
    if (filters.category) {
      results = results.filter(a => a.category === filters.category);
    }

    // Filter by target
    if (filters.targetId) {
      results = results.filter(a => a.targetId === filters.targetId);
    }
    if (filters.targetType) {
      results = results.filter(a => a.targetType === filters.targetType);
    }

    // Filter by result
    if (filters.result) {
      results = results.filter(a => a.result === filters.result);
    }

    // Filter by time range
    if (filters.startTime) {
      const start = new Date(filters.startTime).getTime();
      results = results.filter(a => new Date(a.timestamp).getTime() >= start);
    }
    if (filters.endTime) {
      const end = new Date(filters.endTime).getTime();
      results = results.filter(a => new Date(a.timestamp).getTime() <= end);
    }

    // Filter by session
    if (filters.sessionId) {
      results = results.filter(a => a.sessionId === filters.sessionId);
    }

    // Sort
    const sortDir = filters.sortDir || 'desc';
    results.sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return sortDir === 'desc' ? bTime - aTime : aTime - bTime;
    });

    // Limit
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get activity statistics for a user
   */
  getUserStats(userId) {
    const activities = this.getByUser(userId);

    const stats = {
      totalActivities: activities.length,
      byCategory: {},
      byType: {},
      byResult: {},
      firstActivity: null,
      lastActivity: null
    };

    for (const activity of activities) {
      // By category
      stats.byCategory[activity.category] =
        (stats.byCategory[activity.category] || 0) + 1;

      // By type
      stats.byType[activity.type] =
        (stats.byType[activity.type] || 0) + 1;

      // By result
      stats.byResult[activity.result] =
        (stats.byResult[activity.result] || 0) + 1;
    }

    if (activities.length > 0) {
      const sorted = [...activities].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      stats.firstActivity = sorted[0].timestamp;
      stats.lastActivity = sorted[sorted.length - 1].timestamp;
    }

    return stats;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Event Emitter
  // ──────────────────────────────────────────────────────────────────────────

  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  _notify(event, data) {
    for (const callback of this._subscribers) {
      try {
        callback({ type: event, data });
      } catch (err) {
        console.error(`UserActivityStore subscriber error for ${event}:`, err);
      }
    }
  }
}

// ============================================================================
// Singleton and Convenience Functions
// ============================================================================

let _activityStoreInstance = null;

/**
 * Get the global UserActivityStore instance
 */
async function getUserActivityStore() {
  if (!_activityStoreInstance) {
    _activityStoreInstance = new UserActivityStore();
    await _activityStoreInstance.init();
  }
  return _activityStoreInstance;
}

/**
 * Record a user activity (convenience function)
 */
async function recordUserActivity(options) {
  const store = await getUserActivityStore();
  return store.record(options);
}

/**
 * Record a data change activity (convenience function)
 */
async function recordDataActivity(type, targetId, targetType, options = {}) {
  const store = await getUserActivityStore();
  return store.recordDataChange({
    type,
    targetId,
    targetType,
    ...options
  });
}

/**
 * Get user's recent activities
 */
async function getUserRecentActivities(userId, limit = 50) {
  const store = await getUserActivityStore();
  return store.getByUser(userId, { limit });
}

/**
 * Get activities for a target entity
 */
async function getTargetActivities(targetId, limit = 50) {
  const store = await getUserActivityStore();
  return store.getByTarget(targetId, { limit });
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Types
    ActivityCategory,
    ActivityType,
    ActivityResult,

    // Classes
    UserActivity,
    UserActivityStore,

    // ID generation
    generateActivityId,

    // Singleton access
    getUserActivityStore,

    // Convenience functions
    recordUserActivity,
    recordDataActivity,
    getUserRecentActivities,
    getTargetActivities
  };
}

if (typeof window !== 'undefined') {
  window.EOUserActivity = {
    // Types
    ActivityCategory,
    ActivityType,
    ActivityResult,

    // Classes
    UserActivity,
    UserActivityStore,

    // ID generation
    generateActivityId,

    // Singleton access
    getUserActivityStore,

    // Convenience functions
    recordUserActivity,
    recordDataActivity,
    getUserRecentActivities,
    getTargetActivities
  };

  // Auto-initialize
  getUserActivityStore().then(store => {
    window.userActivityStore = store;
    console.log('EO User Activity Store initialized');
  }).catch(err => {
    console.error('Failed to initialize User Activity Store:', err);
  });
}
