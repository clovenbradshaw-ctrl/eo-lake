/**
 * EO User Account Management
 *
 * Establishes User as the primary agent for all provenance tracking.
 * Unlike sessions (which are temporal), Users are persistent identities
 * that own all actions and data within the system.
 *
 * Core Principle:
 * EVERY action in the system must be attributable to a User.
 * System-initiated actions are attributed to a system user or
 * to the user who initiated the triggering action.
 *
 * User identity flows into:
 * - The 'agent' element of the 9-element provenance schema (as userId)
 * - The 'actor' field of all events (as user:{userId})
 * - All activity records
 * - All data modifications
 *
 * Hierarchy:
 * User (persistent) → Session (temporal) → Activity (instantaneous)
 */

// ============================================================================
// User Status
// ============================================================================

/**
 * User account status
 */
const UserStatus = Object.freeze({
  ACTIVE: 'active',           // Normal active user
  PENDING: 'pending',         // Awaiting email verification or approval
  SUSPENDED: 'suspended',     // Temporarily disabled
  DEACTIVATED: 'deactivated', // User-initiated deactivation
  DELETED: 'deleted'          // Soft-deleted (for provenance preservation)
});

/**
 * User roles for authorization
 */
const UserRole = Object.freeze({
  OWNER: 'owner',             // Full control, cannot be removed
  ADMIN: 'admin',             // Full control, can manage users
  EDITOR: 'editor',           // Can create, edit, delete data
  VIEWER: 'viewer',           // Read-only access
  GUEST: 'guest'              // Limited temporary access
});

/**
 * Special system users (for system-initiated actions)
 */
const SystemUsers = Object.freeze({
  SYSTEM: {
    id: 'user_system',
    displayName: 'System',
    email: null,
    role: UserRole.ADMIN,
    isSystemUser: true
  },
  IMPORT: {
    id: 'user_import',
    displayName: 'Import Service',
    email: null,
    role: UserRole.EDITOR,
    isSystemUser: true
  },
  SYNC: {
    id: 'user_sync',
    displayName: 'Sync Service',
    email: null,
    role: UserRole.EDITOR,
    isSystemUser: true
  },
  MIGRATION: {
    id: 'user_migration',
    displayName: 'Migration Service',
    email: null,
    role: UserRole.ADMIN,
    isSystemUser: true
  },
  ANONYMOUS: {
    id: 'user_anonymous',
    displayName: 'Anonymous',
    email: null,
    role: UserRole.GUEST,
    isSystemUser: true
  }
});

// ============================================================================
// User ID Generation
// ============================================================================

/**
 * Generate a unique user ID
 * Format: user_{timestamp}_{random}
 */
function generateUserId() {
  const timestamp = Date.now().toString(36);
  const random = generateRandomString(8);
  return `user_${timestamp}_${random}`;
}

/**
 * Generate random string for IDs
 */
function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return result;
}

/**
 * Validate user ID format
 */
function isValidUserId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^user_[a-z0-9]+_[a-z0-9]+$/.test(id) ||
         Object.values(SystemUsers).some(u => u.id === id);
}

// ============================================================================
// User Class
// ============================================================================

/**
 * User represents a persistent identity in the system.
 *
 * Every action is attributed to a User. Users are the ultimate
 * source of provenance for all data in the system.
 */
class User {
  constructor(options = {}) {
    // Core identity
    this.id = options.id || generateUserId();
    this.email = options.email || null;
    this.displayName = options.displayName || null;

    // Authentication (stored hashed/external)
    this.authProvider = options.authProvider || 'local'; // local, google, github, etc.
    this.authProviderId = options.authProviderId || null;
    this.emailVerified = options.emailVerified || false;

    // Profile
    this.firstName = options.firstName || null;
    this.lastName = options.lastName || null;
    this.avatarUrl = options.avatarUrl || null;
    this.timezone = options.timezone || null;
    this.locale = options.locale || null;

    // Organization context
    this.organization = options.organization || null;
    this.department = options.department || null;
    this.title = options.title || null;

    // Authorization
    this.role = options.role || UserRole.EDITOR;
    this.permissions = options.permissions || [];

    // Status
    this.status = options.status || UserStatus.ACTIVE;
    this.isSystemUser = options.isSystemUser || false;

    // Timestamps
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || new Date().toISOString();
    this.lastLoginAt = options.lastLoginAt || null;
    this.lastActiveAt = options.lastActiveAt || null;

    // Provenance metadata
    this.createdBy = options.createdBy || null; // userId of creator (for audit)

    // Settings (user preferences)
    this.settings = options.settings || {};
  }

  /**
   * Get the display name, with fallbacks
   */
  getDisplayName() {
    if (this.displayName) return this.displayName;
    if (this.firstName && this.lastName) return `${this.firstName} ${this.lastName}`;
    if (this.firstName) return this.firstName;
    if (this.email) return this.email.split('@')[0];
    return `User ${this.id.slice(5, 13)}`;
  }

  /**
   * Get initials for avatar display
   */
  getInitials() {
    const name = this.getDisplayName();
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  /**
   * Check if user is active
   */
  isActive() {
    return this.status === UserStatus.ACTIVE;
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission) {
    // Owners and admins have all permissions
    if (this.role === UserRole.OWNER || this.role === UserRole.ADMIN) {
      return true;
    }
    return this.permissions.includes(permission);
  }

  /**
   * Check if user can perform an action based on role
   */
  canPerform(action) {
    const rolePermissions = {
      [UserRole.OWNER]: ['*'],
      [UserRole.ADMIN]: ['read', 'write', 'delete', 'manage_users'],
      [UserRole.EDITOR]: ['read', 'write', 'delete'],
      [UserRole.VIEWER]: ['read'],
      [UserRole.GUEST]: ['read']
    };

    const allowed = rolePermissions[this.role] || [];
    return allowed.includes('*') || allowed.includes(action);
  }

  /**
   * Get actor string for events
   * Format: user:{userId}
   */
  getActor() {
    return `user:${this.id}`;
  }

  /**
   * Get provenance attribution object
   * This goes into the 'agent' element of 9-element provenance
   */
  toProvenance() {
    return {
      userId: this.id,
      displayName: this.getDisplayName(),
      email: this.email,
      organization: this.organization,
      role: this.role,
      isSystemUser: this.isSystemUser
    };
  }

  /**
   * Get user summary for UI display
   */
  toSummary() {
    return {
      id: this.id,
      displayName: this.getDisplayName(),
      email: this.email,
      avatarUrl: this.avatarUrl,
      role: this.role,
      status: this.status,
      initials: this.getInitials()
    };
  }

  /**
   * Serialize for storage
   */
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      displayName: this.displayName,
      authProvider: this.authProvider,
      authProviderId: this.authProviderId,
      emailVerified: this.emailVerified,
      firstName: this.firstName,
      lastName: this.lastName,
      avatarUrl: this.avatarUrl,
      timezone: this.timezone,
      locale: this.locale,
      organization: this.organization,
      department: this.department,
      title: this.title,
      role: this.role,
      permissions: this.permissions,
      status: this.status,
      isSystemUser: this.isSystemUser,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLoginAt: this.lastLoginAt,
      lastActiveAt: this.lastActiveAt,
      createdBy: this.createdBy,
      settings: this.settings
    };
  }

  /**
   * Create from stored data
   */
  static fromJSON(data) {
    return new User(data);
  }

  /**
   * Update user fields
   */
  update(fields) {
    const allowedFields = [
      'displayName', 'firstName', 'lastName', 'avatarUrl',
      'timezone', 'locale', 'organization', 'department', 'title',
      'settings'
    ];

    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        this[field] = fields[field];
      }
    }

    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Record login
   */
  recordLogin() {
    this.lastLoginAt = new Date().toISOString();
    this.lastActiveAt = this.lastLoginAt;
    this.updatedAt = this.lastLoginAt;
  }

  /**
   * Record activity
   */
  recordActivity() {
    this.lastActiveAt = new Date().toISOString();
  }
}

// ============================================================================
// User Store
// ============================================================================

/**
 * UserStore manages user persistence
 */
class UserStore {
  constructor() {
    this.users = new Map();
    this.byEmail = new Map();
    this.dbName = 'eo_user_store';
    this.dbVersion = 1;
    this.db = null;
    this._currentUser = null;
    this._subscribers = new Set();

    // Initialize system users
    this._initSystemUsers();
  }

  /**
   * Initialize system users
   */
  _initSystemUsers() {
    for (const [key, data] of Object.entries(SystemUsers)) {
      const user = new User(data);
      this.users.set(user.id, user);
    }
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

        if (!db.objectStoreNames.contains('users')) {
          const store = db.createObjectStore('users', { keyPath: 'id' });
          store.createIndex('email', 'email', { unique: true });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('role', 'role', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('currentUser')) {
          db.createObjectStore('currentUser', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Load users from IndexedDB
   */
  async _loadFromDB() {
    if (!this.db) return;

    // Load users
    const users = await this._getAllFromStore('users');
    for (const userData of users) {
      const user = User.fromJSON(userData);
      this.users.set(user.id, user);
      if (user.email) {
        this.byEmail.set(user.email.toLowerCase(), user.id);
      }
    }

    // Load current user reference
    try {
      const currentUserData = await this._getFromStore('currentUser', 'current');
      if (currentUserData?.userId) {
        this._currentUser = this.users.get(currentUserData.userId) || null;
      }
    } catch {
      // No current user stored
    }

    console.log(`UserStore loaded: ${this.users.size} users`);
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

  async _getFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
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

  async _deleteFromDB(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // User CRUD
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Create a new user
   */
  async create(userData, createdBy = null) {
    // Validate email uniqueness
    if (userData.email) {
      const existing = this.getByEmail(userData.email);
      if (existing) {
        throw new Error(`User with email ${userData.email} already exists`);
      }
    }

    const user = new User({
      ...userData,
      createdBy: createdBy?.id || createdBy || SystemUsers.SYSTEM.id
    });

    this.users.set(user.id, user);
    if (user.email) {
      this.byEmail.set(user.email.toLowerCase(), user.id);
    }

    if (this.db) {
      await this._saveToDB('users', user.toJSON());
    }

    this._notify('user:created', user);
    return user;
  }

  /**
   * Get user by ID
   */
  get(userId) {
    return this.users.get(userId) || null;
  }

  /**
   * Get user by email
   */
  getByEmail(email) {
    if (!email) return null;
    const userId = this.byEmail.get(email.toLowerCase());
    return userId ? this.users.get(userId) : null;
  }

  /**
   * Update a user
   */
  async update(userId, fields, updatedBy = null) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Handle email change
    if (fields.email && fields.email !== user.email) {
      const existing = this.getByEmail(fields.email);
      if (existing && existing.id !== userId) {
        throw new Error(`Email ${fields.email} is already in use`);
      }
      // Update email index
      if (user.email) {
        this.byEmail.delete(user.email.toLowerCase());
      }
      this.byEmail.set(fields.email.toLowerCase(), userId);
    }

    user.update(fields);

    if (this.db) {
      await this._saveToDB('users', user.toJSON());
    }

    this._notify('user:updated', user);
    return user;
  }

  /**
   * Deactivate a user (soft delete)
   */
  async deactivate(userId, deactivatedBy = null) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    if (user.isSystemUser) {
      throw new Error('Cannot deactivate system users');
    }

    user.status = UserStatus.DEACTIVATED;
    user.updatedAt = new Date().toISOString();

    if (this.db) {
      await this._saveToDB('users', user.toJSON());
    }

    this._notify('user:deactivated', user);
    return user;
  }

  /**
   * List all users
   */
  list(options = {}) {
    let users = Array.from(this.users.values());

    // Filter out system users by default
    if (!options.includeSystem) {
      users = users.filter(u => !u.isSystemUser);
    }

    // Filter by status
    if (options.status) {
      users = users.filter(u => u.status === options.status);
    }

    // Filter by role
    if (options.role) {
      users = users.filter(u => u.role === options.role);
    }

    // Sort
    const sortBy = options.sortBy || 'createdAt';
    const sortDir = options.sortDir || 'desc';
    users.sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'desc' ? -cmp : cmp;
    });

    // Limit
    if (options.limit) {
      users = users.slice(0, options.limit);
    }

    return users;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Current User Management
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Set the current logged-in user
   */
  async setCurrentUser(user) {
    if (typeof user === 'string') {
      user = this.get(user);
    }

    this._currentUser = user;

    if (this.db && user) {
      await this._saveToDB('currentUser', { key: 'current', userId: user.id });
    } else if (this.db) {
      await this._deleteFromDB('currentUser', 'current');
    }

    this._notify('user:login', user);
    return user;
  }

  /**
   * Get the current logged-in user
   */
  getCurrentUser() {
    return this._currentUser;
  }

  /**
   * Clear current user (logout)
   */
  async clearCurrentUser() {
    const user = this._currentUser;
    this._currentUser = null;

    if (this.db) {
      await this._deleteFromDB('currentUser', 'current');
    }

    this._notify('user:logout', user);
  }

  /**
   * Get current actor for events
   * Falls back to anonymous if no user logged in
   */
  getCurrentActor() {
    if (this._currentUser) {
      return this._currentUser.getActor();
    }
    return `user:${SystemUsers.ANONYMOUS.id}`;
  }

  /**
   * Get current user's provenance attribution
   */
  getCurrentProvenance() {
    if (this._currentUser) {
      return this._currentUser.toProvenance();
    }
    return {
      userId: SystemUsers.ANONYMOUS.id,
      displayName: 'Anonymous',
      role: UserRole.GUEST,
      isSystemUser: true
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // System User Helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get system user by key
   */
  getSystemUser(key) {
    const data = SystemUsers[key.toUpperCase()];
    if (!data) return null;
    return this.users.get(data.id);
  }

  /**
   * Get actor for system-initiated actions
   */
  getSystemActor() {
    return `user:${SystemUsers.SYSTEM.id}`;
  }

  /**
   * Get actor for import operations
   */
  getImportActor() {
    return `user:${SystemUsers.IMPORT.id}`;
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
        console.error(`UserStore subscriber error for ${event}:`, err);
      }
    }
  }
}

// ============================================================================
// User Activity Log
// ============================================================================

/**
 * UserActivityType - Types of user activities for audit log
 */
const UserActivityType = Object.freeze({
  // Authentication
  LOGIN: 'login',
  LOGOUT: 'logout',
  PASSWORD_CHANGE: 'password_change',

  // Account management
  ACCOUNT_CREATED: 'account_created',
  ACCOUNT_UPDATED: 'account_updated',
  ACCOUNT_DEACTIVATED: 'account_deactivated',

  // Data operations (high-level)
  DATA_IMPORTED: 'data_imported',
  DATA_EXPORTED: 'data_exported',
  DATA_DELETED: 'data_deleted',

  // Project operations
  PROJECT_CREATED: 'project_created',
  PROJECT_UPDATED: 'project_updated',
  PROJECT_SHARED: 'project_shared',

  // Collaboration
  INVITATION_SENT: 'invitation_sent',
  INVITATION_ACCEPTED: 'invitation_accepted'
});

/**
 * UserActivityEntry - A single activity log entry
 */
class UserActivityEntry {
  constructor(options = {}) {
    this.id = options.id || `uact_${Date.now().toString(36)}_${generateRandomString(6)}`;
    this.userId = options.userId;
    this.type = options.type;
    this.timestamp = options.timestamp || new Date().toISOString();
    this.details = options.details || {};
    this.metadata = {
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null,
      sessionId: options.sessionId || null
    };
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      type: this.type,
      timestamp: this.timestamp,
      details: this.details,
      metadata: this.metadata
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _userStoreInstance = null;

/**
 * Get the global UserStore instance
 */
async function getUserStore() {
  if (!_userStoreInstance) {
    _userStoreInstance = new UserStore();
    await _userStoreInstance.init();
  }
  return _userStoreInstance;
}

/**
 * Get current user (synchronous, for convenience)
 */
function getCurrentUser() {
  return _userStoreInstance?.getCurrentUser() || null;
}

/**
 * Get current actor string
 */
function getCurrentUserActor() {
  return _userStoreInstance?.getCurrentActor() || `user:${SystemUsers.ANONYMOUS.id}`;
}

/**
 * Get current user's provenance
 */
function getCurrentUserProvenance() {
  return _userStoreInstance?.getCurrentProvenance() || {
    userId: SystemUsers.ANONYMOUS.id,
    displayName: 'Anonymous',
    role: UserRole.GUEST,
    isSystemUser: true
  };
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Types
    UserStatus,
    UserRole,
    SystemUsers,
    UserActivityType,

    // ID utilities
    generateUserId,
    isValidUserId,

    // Classes
    User,
    UserStore,
    UserActivityEntry,

    // Singleton access
    getUserStore,
    getCurrentUser,
    getCurrentUserActor,
    getCurrentUserProvenance
  };
}

if (typeof window !== 'undefined') {
  window.EOUser = {
    // Types
    UserStatus,
    UserRole,
    SystemUsers,
    UserActivityType,

    // ID utilities
    generateUserId,
    isValidUserId,

    // Classes
    User,
    UserStore,
    UserActivityEntry,

    // Singleton access
    getUserStore,
    getCurrentUser,
    getCurrentUserActor,
    getCurrentUserProvenance
  };

  // Auto-initialize
  getUserStore().then(store => {
    window.userStore = store;
    console.log('EO User Store initialized');
  }).catch(err => {
    console.error('Failed to initialize User Store:', err);
  });
}
