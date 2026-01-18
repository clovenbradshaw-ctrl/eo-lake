/**
 * EO User Activity Tracking
 *
 * Comprehensive audit trail for all user actions in the system.
 * Every action that affects data or system state should be tracked
 * with full provenance linking to the user who performed it.
 *
 * IMPORTANT: This module uses the EO 9-operator vocabulary for all activities.
 * The 9 operators are the canonical verbs for describing state changes:
 *
 *   INS (⊕) - Assert existence (create, insert)
 *   DES (⊙) - Designate identity (name, identify, bind)
 *   SEG (⊘) - Scope visibility (filter, segment, restrict access)
 *   CON (⊗) - Connect entities (relate, link, share)
 *   SYN (≡) - Synthesize identity (merge, combine)
 *   ALT (Δ) - Alternate world state (update, modify, change)
 *   SUP (∥) - Superpose interpretations (interpret, layer meaning)
 *   REC (←) - Record grounding (import, reference, cite)
 *   NUL (∅) - Assert meaningful absence (delete, archive, ghost)
 *
 * Design Principles:
 * 1. ALL actions attributable to users - no anonymous modifications
 * 2. Immutable audit log - activities cannot be modified after creation
 * 3. EO operator vocabulary - every action maps to one of 9 operators
 * 4. Rich context - capture why, how, and what for each action
 * 5. Queryable - efficiently find actions by user, time, type, target
 */

// ============================================================================
// EO Operators (from eo_activity.js)
// ============================================================================

/**
 * The 9 canonical EO operators
 * Every user activity MUST map to one of these operators
 */
const EO_OPERATORS = Object.freeze({
  INS: '⊕',   // Assert existence
  DES: '⊙',   // Designate identity
  SEG: '⊘',   // Scope visibility
  CON: '⊗',   // Connect entities
  SYN: '≡',   // Synthesize identity
  ALT: 'Δ',   // Alternate world state
  SUP: '∥',   // Superpose interpretations
  REC: '←',   // Record grounding
  NUL: '∅'    // Assert meaningful absence
});

// ============================================================================
// Activity Categories and Types (mapped to EO operators)
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
 * Activity types mapped to EO operators
 *
 * Each activity type specifies:
 * - op: The EO operator this maps to
 * - category: High-level category
 * - description: Human-readable description
 */
const ActivityType = Object.freeze({
  // ──────────────────────────────────────────────────────────────────────────
  // Authentication (INS for sessions, NUL for logout, ALT for changes)
  // ──────────────────────────────────────────────────────────────────────────
  AUTH_LOGIN: { id: 'auth.login', op: 'INS', category: 'auth', description: 'User logged in (session created)' },
  AUTH_LOGOUT: { id: 'auth.logout', op: 'NUL', category: 'auth', description: 'User logged out (session ended)' },
  AUTH_LOGIN_FAILED: { id: 'auth.login_failed', op: 'NUL', category: 'auth', description: 'Login attempt failed' },
  AUTH_PASSWORD_CHANGED: { id: 'auth.password_changed', op: 'ALT', category: 'auth', description: 'Password changed' },
  AUTH_PASSWORD_RESET: { id: 'auth.password_reset', op: 'ALT', category: 'auth', description: 'Password reset' },
  AUTH_SESSION_EXPIRED: { id: 'auth.session_expired', op: 'NUL', category: 'auth', description: 'Session expired' },

  // ──────────────────────────────────────────────────────────────────────────
  // Data operations (INS, ALT, NUL, SYN)
  // ──────────────────────────────────────────────────────────────────────────
  DATA_CREATED: { id: 'data.created', op: 'INS', category: 'data', description: 'Data created' },
  DATA_UPDATED: { id: 'data.updated', op: 'ALT', category: 'data', description: 'Data updated' },
  DATA_DELETED: { id: 'data.deleted', op: 'NUL', category: 'data', description: 'Data deleted (ghosted)' },
  DATA_RESTORED: { id: 'data.restored', op: 'INS', category: 'data', description: 'Data restored from ghost' },
  DATA_MERGED: { id: 'data.merged', op: 'SYN', category: 'data', description: 'Data merged (synthesized)' },
  DATA_SPLIT: { id: 'data.split', op: 'SEG', category: 'data', description: 'Data split (segmented)' },

  // ──────────────────────────────────────────────────────────────────────────
  // Record-level operations
  // ──────────────────────────────────────────────────────────────────────────
  RECORD_CREATED: { id: 'data.record_created', op: 'INS', category: 'data', description: 'Record created' },
  RECORD_UPDATED: { id: 'data.record_updated', op: 'ALT', category: 'data', description: 'Record updated' },
  RECORD_DELETED: { id: 'data.record_deleted', op: 'NUL', category: 'data', description: 'Record deleted' },

  // ──────────────────────────────────────────────────────────────────────────
  // Field-level operations
  // ──────────────────────────────────────────────────────────────────────────
  FIELD_UPDATED: { id: 'data.field_updated', op: 'ALT', category: 'data', description: 'Field value updated' },
  FIELD_CLEARED: { id: 'data.field_cleared', op: 'NUL', category: 'data', description: 'Field value cleared' },

  // ──────────────────────────────────────────────────────────────────────────
  // Schema operations (DES for naming/binding, INS for creation)
  // ──────────────────────────────────────────────────────────────────────────
  SCHEMA_CREATED: { id: 'data.schema_created', op: 'INS', category: 'data', description: 'Schema created' },
  SCHEMA_UPDATED: { id: 'data.schema_updated', op: 'ALT', category: 'data', description: 'Schema updated' },
  SCHEMA_FIELD_ADDED: { id: 'data.schema_field_added', op: 'INS', category: 'data', description: 'Schema field added' },
  SCHEMA_FIELD_REMOVED: { id: 'data.schema_field_removed', op: 'NUL', category: 'data', description: 'Schema field removed' },
  SCHEMA_FIELD_RENAMED: { id: 'data.schema_field_renamed', op: 'DES', category: 'data', description: 'Schema field renamed (redesignated)' },

  // ──────────────────────────────────────────────────────────────────────────
  // Semantic binding operations (DES, SUP)
  // ──────────────────────────────────────────────────────────────────────────
  BINDING_CREATED: { id: 'data.binding_created', op: 'DES', category: 'data', description: 'Semantic binding created' },
  BINDING_UPDATED: { id: 'data.binding_updated', op: 'ALT', category: 'data', description: 'Semantic binding updated' },
  BINDING_REMOVED: { id: 'data.binding_removed', op: 'NUL', category: 'data', description: 'Semantic binding removed' },
  INTERPRETATION_ADDED: { id: 'data.interpretation_added', op: 'SUP', category: 'data', description: 'Interpretation superposed' },

  // ──────────────────────────────────────────────────────────────────────────
  // Import operations (REC for recording external data)
  // ──────────────────────────────────────────────────────────────────────────
  IMPORT_STARTED: { id: 'import.started', op: 'REC', category: 'import', description: 'Import started' },
  IMPORT_COMPLETED: { id: 'import.completed', op: 'REC', category: 'import', description: 'Import completed (data recorded)' },
  IMPORT_FAILED: { id: 'import.failed', op: 'NUL', category: 'import', description: 'Import failed' },
  IMPORT_CANCELLED: { id: 'import.cancelled', op: 'NUL', category: 'import', description: 'Import cancelled' },

  // ──────────────────────────────────────────────────────────────────────────
  // Export operations (REC for recording to external)
  // ──────────────────────────────────────────────────────────────────────────
  EXPORT_STARTED: { id: 'export.started', op: 'REC', category: 'export', description: 'Export started' },
  EXPORT_COMPLETED: { id: 'export.completed', op: 'REC', category: 'export', description: 'Export completed' },
  EXPORT_FAILED: { id: 'export.failed', op: 'NUL', category: 'export', description: 'Export failed' },

  // ──────────────────────────────────────────────────────────────────────────
  // Sharing and collaboration (CON for connections, SEG for access)
  // ──────────────────────────────────────────────────────────────────────────
  SHARE_PROJECT: { id: 'share.project', op: 'CON', category: 'share', description: 'Project shared (connection created)' },
  SHARE_SET: { id: 'share.set', op: 'CON', category: 'share', description: 'Set shared' },
  SHARE_VIEW: { id: 'share.view', op: 'CON', category: 'share', description: 'View shared' },
  SHARE_REVOKED: { id: 'share.revoked', op: 'NUL', category: 'share', description: 'Share revoked (connection removed)' },
  SHARE_INVITATION_SENT: { id: 'share.invitation_sent', op: 'CON', category: 'share', description: 'Invitation sent' },
  SHARE_INVITATION_ACCEPTED: { id: 'share.invitation_accepted', op: 'CON', category: 'share', description: 'Invitation accepted' },
  SHARE_INVITATION_DECLINED: { id: 'share.invitation_declined', op: 'NUL', category: 'share', description: 'Invitation declined' },

  // ──────────────────────────────────────────────────────────────────────────
  // Access control (SEG for scoping visibility)
  // ──────────────────────────────────────────────────────────────────────────
  ACCESS_GRANTED: { id: 'share.access_granted', op: 'SEG', category: 'share', description: 'Access granted (visibility scoped)' },
  ACCESS_REVOKED: { id: 'share.access_revoked', op: 'SEG', category: 'share', description: 'Access revoked (visibility restricted)' },
  ACCESS_ROLE_CHANGED: { id: 'share.role_changed', op: 'ALT', category: 'share', description: 'Access role changed' },

  // ──────────────────────────────────────────────────────────────────────────
  // System configuration (ALT for changes, INS/NUL for integrations)
  // ──────────────────────────────────────────────────────────────────────────
  SYSTEM_SETTINGS_CHANGED: { id: 'system.settings_changed', op: 'ALT', category: 'system', description: 'System settings changed' },
  SYSTEM_INTEGRATION_ADDED: { id: 'system.integration_added', op: 'CON', category: 'system', description: 'Integration added (connection)' },
  SYSTEM_INTEGRATION_REMOVED: { id: 'system.integration_removed', op: 'NUL', category: 'system', description: 'Integration removed' },

  // ──────────────────────────────────────────────────────────────────────────
  // User management (INS, ALT, NUL)
  // ──────────────────────────────────────────────────────────────────────────
  USER_CREATED: { id: 'system.user_created', op: 'INS', category: 'system', description: 'User created' },
  USER_UPDATED: { id: 'system.user_updated', op: 'ALT', category: 'system', description: 'User updated' },
  USER_DEACTIVATED: { id: 'system.user_deactivated', op: 'NUL', category: 'system', description: 'User deactivated (ghosted)' },
  USER_REACTIVATED: { id: 'system.user_reactivated', op: 'INS', category: 'system', description: 'User reactivated' },

  // ──────────────────────────────────────────────────────────────────────────
  // Project operations
  // ──────────────────────────────────────────────────────────────────────────
  PROJECT_CREATED: { id: 'data.project_created', op: 'INS', category: 'data', description: 'Project created' },
  PROJECT_UPDATED: { id: 'data.project_updated', op: 'ALT', category: 'data', description: 'Project updated' },
  PROJECT_ARCHIVED: { id: 'data.project_archived', op: 'NUL', category: 'data', description: 'Project archived (ghosted)' },
  PROJECT_RESTORED: { id: 'data.project_restored', op: 'INS', category: 'data', description: 'Project restored' },
  PROJECT_DELETED: { id: 'data.project_deleted', op: 'NUL', category: 'data', description: 'Project deleted' },

  // ──────────────────────────────────────────────────────────────────────────
  // View/read operations (REC for recording access)
  // ──────────────────────────────────────────────────────────────────────────
  VIEW_PROJECT: { id: 'view.project', op: 'REC', category: 'view', description: 'Project viewed' },
  VIEW_SET: { id: 'view.set', op: 'REC', category: 'view', description: 'Set viewed' },
  VIEW_RECORD: { id: 'view.record', op: 'REC', category: 'view', description: 'Record viewed' },
  VIEW_EXPORTED_DATA: { id: 'view.exported_data', op: 'REC', category: 'view', description: 'Exported data viewed' }
});

/**
 * Get EO operator for an activity type
 */
function getActivityOperator(activityType) {
  if (typeof activityType === 'object' && activityType.op) {
    return activityType.op;
  }
  // Find by id if string passed
  for (const [key, val] of Object.entries(ActivityType)) {
    if (val.id === activityType) {
      return val.op;
    }
  }
  return null;
}

/**
 * Get activity type info by ID
 */
function getActivityTypeById(typeId) {
  for (const [key, val] of Object.entries(ActivityType)) {
    if (val.id === typeId) {
      return { key, ...val };
    }
  }
  return null;
}

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
 * - WHAT: type, category, target, EO operator
 * - WHEN: timestamp
 * - WHERE: clientContext (IP, user agent, etc.)
 * - WHY: reason, context
 * - HOW: method, details
 * - RESULT: outcome, changes made
 *
 * EO OPERATOR ALIGNMENT:
 * Every activity maps to one of the 9 EO operators (INS, DES, SEG, CON, SYN, ALT, SUP, REC, NUL).
 * This enables consistent querying and understanding of what type of state change occurred.
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

    // WHAT - Action classification with EO operator
    this.type = this._normalizeType(options.type); // Activity type ID (e.g., 'data.created')
    this.op = options.op || this._deriveOperator(options.type); // EO operator (INS, DES, etc.)
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

    // Delta for ALT operations (matches eo_activity.js format)
    this.delta = options.delta || null; // [previousValue, newValue]

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
    if (this.delta) Object.freeze(this.delta);
    if (this.changes) Object.freeze(this.changes);
    Object.freeze(this.metadata);
  }

  /**
   * Normalize type to string ID
   */
  _normalizeType(type) {
    if (!type) return null;
    if (typeof type === 'object' && type.id) {
      return type.id;
    }
    return type;
  }

  /**
   * Derive EO operator from activity type
   */
  _deriveOperator(type) {
    if (!type) return null;
    // If type is an ActivityType object with op field
    if (typeof type === 'object' && type.op) {
      return type.op;
    }
    // If type is a string, look it up
    const typeInfo = getActivityTypeById(type);
    return typeInfo?.op || null;
  }

  /**
   * Derive category from activity type
   */
  _deriveCategory(type) {
    if (!type) return null;
    // If type is an ActivityType object with category field
    if (typeof type === 'object' && type.category) {
      return type.category;
    }
    // If type is a string ID, parse prefix or look up
    if (typeof type === 'string') {
      const typeInfo = getActivityTypeById(type);
      if (typeInfo?.category) return typeInfo.category;
      // Fallback to prefix parsing
      const prefix = type.split('.')[0];
      return prefix || null;
    }
    return null;
  }

  /**
   * Get the EO operator symbol
   */
  getOperatorSymbol() {
    return this.op ? EO_OPERATORS[this.op] : null;
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
      op: this.op,  // EO operator
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
      delta: this.delta ? [...this.delta] : null,  // [prev, next] for ALT operations
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
    this.dbVersion = 2;  // Bumped for EO operator index
    this.db = null;

    // Indexes for efficient querying
    this.byUser = new Map();      // userId -> Set<activityId>
    this.byTarget = new Map();    // targetId -> Set<activityId>
    this.byType = new Map();      // type -> Set<activityId>
    this.byOp = new Map();        // EO operator -> Set<activityId> (NEW: EO-aligned)
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

    // By EO operator (for EO-aligned queries)
    if (activity.op) {
      if (!this.byOp.has(activity.op)) {
        this.byOp.set(activity.op, new Set());
      }
      this.byOp.get(activity.op).add(activity.id);
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
   * Get activities by EO operator
   * This enables EO-aligned queries like "all INS operations" or "all NUL operations"
   *
   * @param {string} op - EO operator (INS, DES, SEG, CON, SYN, ALT, SUP, REC, NUL)
   * @param {Object} options - Query options
   */
  getByOperator(op, options = {}) {
    const ids = this.byOp.get(op);
    if (!ids) return [];

    let activities = Array.from(ids).map(id => this.activities.get(id));

    // Filter by user if specified
    if (options.userId) {
      activities = activities.filter(a => a.userId === options.userId);
    }

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

    // Filter by EO operator (PRIMARY filter for EO-aligned queries)
    if (filters.op) {
      const ops = Array.isArray(filters.op) ? filters.op : [filters.op];
      results = results.filter(a => ops.includes(a.op));
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
    // EO Operators
    EO_OPERATORS,

    // Types
    ActivityCategory,
    ActivityType,
    ActivityResult,

    // Classes
    UserActivity,
    UserActivityStore,

    // ID generation
    generateActivityId,

    // EO operator helpers
    getActivityOperator,
    getActivityTypeById,

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
    // EO Operators
    EO_OPERATORS,

    // Types
    ActivityCategory,
    ActivityType,
    ActivityResult,

    // Classes
    UserActivity,
    UserActivityStore,

    // ID generation
    generateActivityId,

    // EO operator helpers
    getActivityOperator,
    getActivityTypeById,

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
