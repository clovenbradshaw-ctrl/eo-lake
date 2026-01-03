/**
 * EO Agent Session Management
 *
 * Implements agent declaration for the Experience Engine.
 * An agent is the entity making claims/observations in the system.
 *
 * Agent identity flows into:
 * - The 'agent' element of the 9-element provenance schema
 * - The 'actor' field of all events
 * - The uploadContext for imports
 *
 * Session lifecycle:
 * 1. Session created at app startup (anonymous by default)
 * 2. Agent can be "declared" with identity information
 * 3. Session ID persists across page reloads (localStorage)
 * 4. New sessions can be started explicitly
 */

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Agent types classify the kind of entity making claims
 */
const AgentType = Object.freeze({
  // Human agents
  PERSON: 'person',           // Individual human user
  TEAM: 'team',               // Group of humans acting collectively

  // System agents
  SYSTEM: 'system',           // The Lakṣaṇa system itself
  IMPORT: 'import',           // Import subsystem (for automated ingestion)
  SYNC: 'sync',               // Sync engine (for remote operations)

  // Instrument agents
  SENSOR: 'sensor',           // Physical measurement device
  API: 'api',                 // External API source

  // Institutional agents
  INSTITUTION: 'institution', // Organization/company
  SERVICE: 'service',         // Third-party service

  // Unknown/anonymous
  ANONYMOUS: 'anonymous'      // Undeclared agent
});

/**
 * Session status
 */
const SessionStatus = Object.freeze({
  ACTIVE: 'active',
  EXPIRED: 'expired',
  TERMINATED: 'terminated'
});

// ============================================================================
// Agent Session Class
// ============================================================================

/**
 * AgentSession represents a declared agent operating within a session.
 *
 * A session binds an agent identity to a time window of activity.
 * All events created during the session are attributed to this agent.
 */
class AgentSession {
  constructor(options = {}) {
    // Session identity
    this.sessionId = options.sessionId || this._generateSessionId();

    // Agent identity (can be declared later)
    this.agentId = options.agentId || null;
    this.agentType = options.agentType || AgentType.ANONYMOUS;
    this.agentName = options.agentName || null;

    // Optional agent metadata
    this.email = options.email || null;
    this.institution = options.institution || null;
    this.role = options.role || null;

    // Session metadata
    this.createdAt = options.createdAt || new Date().toISOString();
    this.declaredAt = options.declaredAt || null;
    this.expiresAt = options.expiresAt || null;
    this.status = options.status || SessionStatus.ACTIVE;

    // Client context (auto-detected)
    this.userAgent = options.userAgent || this._detectUserAgent();
    this.platform = options.platform || this._detectPlatform();
    this.timezone = options.timezone || this._detectTimezone();
    this.locale = options.locale || this._detectLocale();

    // Subscribers for session changes
    this._subscribers = new Set();
  }

  /**
   * Generate a cryptographically-informed session ID
   * Format: ses_{timestamp}_{random}
   */
  _generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = this._generateRandom(12);
    return `ses_${timestamp}_${random}`;
  }

  /**
   * Generate random string
   */
  _generateRandom(length) {
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
   * Detect user agent string
   */
  _detectUserAgent() {
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent;
    }
    return null;
  }

  /**
   * Detect platform
   */
  _detectPlatform() {
    if (typeof navigator !== 'undefined') {
      return navigator.platform || null;
    }
    return null;
  }

  /**
   * Detect timezone
   */
  _detectTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }

  /**
   * Detect locale
   */
  _detectLocale() {
    if (typeof navigator !== 'undefined') {
      return navigator.language || navigator.languages?.[0] || null;
    }
    return null;
  }

  /**
   * Declare agent identity
   *
   * Call this when the user identifies themselves or when the system
   * knows who is operating.
   */
  declare(identity) {
    const previousState = this.toIdentity();

    // Update identity fields
    if (identity.agentId !== undefined) this.agentId = identity.agentId;
    if (identity.agentType !== undefined) this.agentType = identity.agentType;
    if (identity.agentName !== undefined) this.agentName = identity.agentName;
    if (identity.email !== undefined) this.email = identity.email;
    if (identity.institution !== undefined) this.institution = identity.institution;
    if (identity.role !== undefined) this.role = identity.role;

    // Mark as declared
    this.declaredAt = new Date().toISOString();

    // Generate agentId if name provided but no ID
    if (!this.agentId && this.agentName) {
      this.agentId = this._generateAgentId(this.agentName);
    }

    // Persist changes
    this.save();

    // Notify subscribers
    this._notify('declared', { previous: previousState, current: this.toIdentity() });

    return this;
  }

  /**
   * Generate agent ID from name
   */
  _generateAgentId(name) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 20);
    const suffix = this._generateRandom(6);
    return `agt_${slug}_${suffix}`;
  }

  /**
   * Check if the session is declared (agent identity known)
   */
  isDeclared() {
    return this.declaredAt !== null && this.agentType !== AgentType.ANONYMOUS;
  }

  /**
   * Check if the session is active
   */
  isActive() {
    if (this.status !== SessionStatus.ACTIVE) return false;
    if (this.expiresAt && new Date(this.expiresAt) < new Date()) {
      this.status = SessionStatus.EXPIRED;
      return false;
    }
    return true;
  }

  /**
   * Get the actor string for events
   * This is what goes into the 'actor' field of events
   */
  getActor() {
    if (this.agentId) {
      return this.agentId;
    }
    if (this.agentName) {
      return this.agentName;
    }
    // Fall back to session-based actor
    return `session:${this.sessionId}`;
  }

  /**
   * Get agent identity for the 'agent' provenance element
   */
  toAgentProvenance() {
    const prov = {
      sessionId: this.sessionId,
      declaredAt: this.declaredAt
    };

    if (this.agentId) prov.agentId = this.agentId;
    if (this.agentType) prov.agentType = this.agentType;
    if (this.agentName) prov.agentName = this.agentName;
    if (this.email) prov.email = this.email;
    if (this.institution) prov.institution = this.institution;
    if (this.role) prov.role = this.role;

    return prov;
  }

  /**
   * Get upload context for imports
   * Matches the structure expected by eo_provenance.createUploadContext
   */
  toUploadContext() {
    return {
      userId: this.agentId || this.agentName || null,
      sessionId: this.sessionId,
      userAgent: this.userAgent,
      ipAddress: null // Not tracked client-side
    };
  }

  /**
   * Get full identity object (for serialization)
   */
  toIdentity() {
    return {
      sessionId: this.sessionId,
      agentId: this.agentId,
      agentType: this.agentType,
      agentName: this.agentName,
      email: this.email,
      institution: this.institution,
      role: this.role,
      createdAt: this.createdAt,
      declaredAt: this.declaredAt,
      expiresAt: this.expiresAt,
      status: this.status
    };
  }

  /**
   * Get client context
   */
  toClientContext() {
    return {
      userAgent: this.userAgent,
      platform: this.platform,
      timezone: this.timezone,
      locale: this.locale
    };
  }

  /**
   * Get display name for UI
   */
  getDisplayName() {
    if (this.agentName) return this.agentName;
    if (this.email) return this.email.split('@')[0];
    if (this.agentId) return this.agentId;
    return `Session ${this.sessionId.slice(0, 12)}...`;
  }

  /**
   * Subscribe to session changes
   */
  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  /**
   * Notify subscribers
   */
  _notify(eventType, data) {
    for (const callback of this._subscribers) {
      try {
        callback({ type: eventType, ...data });
      } catch (err) {
        console.error('AgentSession subscriber error:', err);
      }
    }
  }

  /**
   * Save session to localStorage
   */
  save() {
    if (typeof localStorage === 'undefined') return;

    const data = {
      identity: this.toIdentity(),
      clientContext: this.toClientContext()
    };

    localStorage.setItem('eo_agent_session', JSON.stringify(data));
  }

  /**
   * Terminate the session
   */
  terminate() {
    this.status = SessionStatus.TERMINATED;
    this._notify('terminated', { sessionId: this.sessionId });
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('eo_agent_session');
    }
  }

  /**
   * Create a new session (for session rotation)
   */
  rotate() {
    const oldSessionId = this.sessionId;
    this.sessionId = this._generateSessionId();
    this.createdAt = new Date().toISOString();
    this.status = SessionStatus.ACTIVE;
    this.save();
    this._notify('rotated', { oldSessionId, newSessionId: this.sessionId });
    return this;
  }

  /**
   * Load session from localStorage
   */
  static load() {
    if (typeof localStorage === 'undefined') return null;

    try {
      const data = localStorage.getItem('eo_agent_session');
      if (!data) return null;

      const parsed = JSON.parse(data);
      const session = new AgentSession({
        ...parsed.identity,
        ...parsed.clientContext
      });

      // Check if session has expired
      if (!session.isActive()) {
        return null;
      }

      return session;
    } catch (err) {
      console.warn('Failed to load agent session:', err);
      return null;
    }
  }
}

// ============================================================================
// Agent Session Manager (Singleton)
// ============================================================================

/**
 * AgentSessionManager provides the global session and handles lifecycle
 */
class AgentSessionManager {
  constructor() {
    this._session = null;
    this._systemSession = null;
  }

  /**
   * Initialize or restore the session
   */
  init(options = {}) {
    // Try to restore existing session
    if (options.restore !== false) {
      const restored = AgentSession.load();
      if (restored) {
        this._session = restored;
        console.log('AgentSession: Restored session', this._session.sessionId);
        return this._session;
      }
    }

    // Create new session
    this._session = new AgentSession(options);
    this._session.save();
    console.log('AgentSession: Created new session', this._session.sessionId);

    return this._session;
  }

  /**
   * Get the current session
   */
  get() {
    if (!this._session) {
      this.init();
    }
    return this._session;
  }

  /**
   * Get system session (for system-initiated events)
   */
  getSystemSession() {
    if (!this._systemSession) {
      this._systemSession = new AgentSession({
        agentId: 'system',
        agentType: AgentType.SYSTEM,
        agentName: 'Lakṣaṇa System',
        sessionId: 'system'
      });
    }
    return this._systemSession;
  }

  /**
   * Declare agent identity on current session
   */
  declare(identity) {
    return this.get().declare(identity);
  }

  /**
   * Get current actor string for events
   */
  getActor() {
    return this.get().getActor();
  }

  /**
   * Start a new session (replacing current)
   */
  newSession(options = {}) {
    if (this._session) {
      this._session.terminate();
    }
    this._session = new AgentSession(options);
    this._session.save();
    console.log('AgentSession: Started new session', this._session.sessionId);
    return this._session;
  }

  /**
   * End current session
   */
  endSession() {
    if (this._session) {
      this._session.terminate();
      this._session = null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _sessionManager = null;

function getSessionManager() {
  if (!_sessionManager) {
    _sessionManager = new AgentSessionManager();
  }
  return _sessionManager;
}

/**
 * Initialize agent session system
 */
function initAgentSession(options = {}) {
  const manager = getSessionManager();
  return manager.init(options);
}

/**
 * Get current agent session
 */
function getAgentSession() {
  return getSessionManager().get();
}

/**
 * Declare agent identity
 */
function declareAgent(identity) {
  return getSessionManager().declare(identity);
}

/**
 * Get current actor for events
 */
function getCurrentActor() {
  return getSessionManager().getActor();
}

/**
 * Get system actor for system-initiated events
 */
function getSystemActor() {
  return getSessionManager().getSystemSession().getActor();
}

// ============================================================================
// Agent Declaration UI Support
// ============================================================================

/**
 * Create agent declaration form HTML
 */
function createAgentDeclarationForm(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const session = getAgentSession();

  container.innerHTML = `
    <div class="agent-declaration-form">
      <div class="agent-form-header">
        <i class="ph ph-user-circle"></i>
        <span>Declare Your Identity</span>
      </div>
      <p class="agent-form-hint">
        Your identity is attached to all observations and claims you make.
        This ensures proper provenance tracking.
      </p>
      <div class="agent-form-fields">
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" id="agent-name" class="form-input"
                 placeholder="Your name or identifier"
                 value="${session.agentName || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Email (optional)</label>
          <input type="email" id="agent-email" class="form-input"
                 placeholder="you@example.com"
                 value="${session.email || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Institution (optional)</label>
          <input type="text" id="agent-institution" class="form-input"
                 placeholder="Organization or company"
                 value="${session.institution || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Role (optional)</label>
          <input type="text" id="agent-role" class="form-input"
                 placeholder="Your role or capacity"
                 value="${session.role || ''}">
        </div>
      </div>
      <div class="agent-form-actions">
        <button id="agent-declare-btn" class="btn btn-primary">
          <i class="ph ph-check"></i> Declare Identity
        </button>
        <button id="agent-anonymous-btn" class="btn btn-secondary">
          Continue Anonymously
        </button>
      </div>
      <div class="agent-session-info">
        <small>Session: ${session.sessionId}</small>
      </div>
    </div>
  `;

  // Wire up buttons
  document.getElementById('agent-declare-btn')?.addEventListener('click', () => {
    const name = document.getElementById('agent-name')?.value?.trim();
    const email = document.getElementById('agent-email')?.value?.trim();
    const institution = document.getElementById('agent-institution')?.value?.trim();
    const role = document.getElementById('agent-role')?.value?.trim();

    if (!name) {
      alert('Please enter your name');
      return;
    }

    declareAgent({
      agentName: name,
      agentType: AgentType.PERSON,
      email: email || undefined,
      institution: institution || undefined,
      role: role || undefined
    });

    // Close modal or update UI
    container.dispatchEvent(new CustomEvent('agent-declared', {
      detail: getAgentSession().toIdentity()
    }));
  });

  document.getElementById('agent-anonymous-btn')?.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('agent-skipped'));
  });

  return container;
}

// ============================================================================
// Agent Badge UI Component
// ============================================================================

/**
 * Create agent badge HTML for display in UI
 */
function createAgentBadge(session = null) {
  session = session || getAgentSession();

  const isDeclared = session.isDeclared();
  const displayName = session.getDisplayName();
  const initials = displayName.slice(0, 2).toUpperCase();

  return `
    <div class="agent-badge ${isDeclared ? 'declared' : 'anonymous'}"
         title="${isDeclared ? 'Agent: ' + displayName : 'Anonymous session - click to declare'}">
      <div class="agent-badge-avatar">${initials}</div>
      <div class="agent-badge-info">
        <span class="agent-badge-name">${displayName}</span>
        ${!isDeclared ? '<span class="agent-badge-status">Anonymous</span>' : ''}
      </div>
    </div>
  `;
}

// ============================================================================
// Styles
// ============================================================================

const agentStyles = `
  /* Agent Declaration Form */
  .agent-declaration-form {
    max-width: 400px;
    padding: 24px;
  }

  .agent-form-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .agent-form-header i {
    font-size: 24px;
    color: var(--primary-500, #6366f1);
  }

  .agent-form-hint {
    font-size: 13px;
    color: var(--text-muted, #9ca3af);
    margin-bottom: 20px;
    line-height: 1.5;
  }

  .agent-form-fields {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }

  .agent-form-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .agent-session-info {
    text-align: center;
    color: var(--text-muted, #9ca3af);
    font-family: monospace;
  }

  /* Agent Badge */
  .agent-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px 4px 4px;
    background: var(--bg-secondary, #f9fafb);
    border: 1px solid var(--border-primary, #e5e7eb);
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .agent-badge:hover {
    background: var(--bg-hover, #f3f4f6);
    border-color: var(--border-secondary, #d1d5db);
  }

  .agent-badge.declared {
    background: var(--primary-50, #eef2ff);
    border-color: var(--primary-200, #c7d2fe);
  }

  .agent-badge-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--primary-500, #6366f1);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
  }

  .agent-badge.anonymous .agent-badge-avatar {
    background: var(--text-muted, #9ca3af);
  }

  .agent-badge-info {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .agent-badge-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary, #111827);
  }

  .agent-badge-status {
    font-size: 10px;
    color: var(--text-muted, #9ca3af);
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.id = 'eo-agent-styles';
  styleEl.textContent = agentStyles;
  document.head.appendChild(styleEl);
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Types
    AgentType,
    SessionStatus,

    // Classes
    AgentSession,
    AgentSessionManager,

    // Functions
    getSessionManager,
    initAgentSession,
    getAgentSession,
    declareAgent,
    getCurrentActor,
    getSystemActor,

    // UI
    createAgentDeclarationForm,
    createAgentBadge
  };
}

if (typeof window !== 'undefined') {
  window.EOAgent = {
    // Types
    AgentType,
    SessionStatus,

    // Classes
    AgentSession,
    AgentSessionManager,

    // Functions
    getSessionManager,
    initAgentSession,
    getAgentSession,
    declareAgent,
    getCurrentActor,
    getSystemActor,

    // UI
    createAgentDeclarationForm,
    createAgentBadge
  };

  // Also expose key functions at window level for convenience
  window.initAgentSession = initAgentSession;
  window.getAgentSession = getAgentSession;
  window.declareAgent = declareAgent;
  window.getCurrentActor = getCurrentActor;
}
