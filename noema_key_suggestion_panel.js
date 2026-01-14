/**
 * EO Definition Population Panel - Manage Stub Definitions
 *
 * All keys appear in definitions by default as stubs. This panel helps
 * populate those stub definitions with actual values from:
 * - API lookups (Wikidata, eCFR, Federal Register)
 * - Manual entry
 * - Marking as local-only (no external definition needed)
 *
 * Features:
 * - Shows stub definitions that need population
 * - Displays API suggestions with confidence scores
 * - One-click population from best API suggestion
 * - Manual entry form for custom definitions
 * - Mark as local-only for internal/project-specific terms
 * - Batch operations for efficiency
 *
 * MIGRATION NOTE: This replaces the old "suggestion approval" workflow.
 * Now definitions exist immediately and need to be *populated*, not *approved*.
 */

// ============================================================================
// SECTION I: Key Suggestion Store
// ============================================================================

/**
 * KeySuggestionStore - Manages pending and approved key suggestions
 */
class KeySuggestionStore {
  constructor() {
    this.pendingSuggestions = new Map(); // sourceId -> suggestions[]
    this.approvedSuggestions = new Map(); // sourceId -> suggestions[]
    this.rejectedSuggestions = new Map(); // sourceId -> suggestions[]
    this.eventTarget = typeof EventTarget !== 'undefined' ? new EventTarget() : null;
  }

  /**
   * Add pending suggestions for a source
   * @param {string} sourceId - The source ID
   * @param {Array} suggestions - Array of suggestion objects
   */
  addPendingSuggestions(sourceId, suggestions) {
    const existing = this.pendingSuggestions.get(sourceId) || [];
    const merged = [...existing, ...suggestions];
    this.pendingSuggestions.set(sourceId, merged);
    this._emit('suggestions:added', { sourceId, count: suggestions.length });
  }

  /**
   * Get pending suggestions for a source
   * @param {string} sourceId - The source ID
   * @returns {Array} - Pending suggestions
   */
  getPendingSuggestions(sourceId) {
    return this.pendingSuggestions.get(sourceId) || [];
  }

  /**
   * Get all pending suggestions across all sources
   * @returns {Map} - Map of sourceId -> suggestions[]
   */
  getAllPendingSuggestions() {
    return new Map(this.pendingSuggestions);
  }

  /**
   * Get total count of pending suggestions
   * @returns {number}
   */
  getPendingCount() {
    let count = 0;
    for (const suggestions of this.pendingSuggestions.values()) {
      count += suggestions.length;
    }
    return count;
  }

  /**
   * Approve a suggestion
   * @param {string} sourceId - The source ID
   * @param {string} fieldId - The field ID
   */
  approveSuggestion(sourceId, fieldId) {
    const pending = this.pendingSuggestions.get(sourceId) || [];
    const index = pending.findIndex(s => s.fieldId === fieldId);

    if (index !== -1) {
      const suggestion = pending.splice(index, 1)[0];
      suggestion.status = 'approved';
      suggestion.approvedAt = new Date().toISOString();

      const approved = this.approvedSuggestions.get(sourceId) || [];
      approved.push(suggestion);
      this.approvedSuggestions.set(sourceId, approved);

      if (pending.length === 0) {
        this.pendingSuggestions.delete(sourceId);
      } else {
        this.pendingSuggestions.set(sourceId, pending);
      }

      this._emit('suggestion:approved', { sourceId, fieldId, suggestion });
    }
  }

  /**
   * Reject a suggestion
   * @param {string} sourceId - The source ID
   * @param {string} fieldId - The field ID
   */
  rejectSuggestion(sourceId, fieldId) {
    const pending = this.pendingSuggestions.get(sourceId) || [];
    const index = pending.findIndex(s => s.fieldId === fieldId);

    if (index !== -1) {
      const suggestion = pending.splice(index, 1)[0];
      suggestion.status = 'rejected';
      suggestion.rejectedAt = new Date().toISOString();

      const rejected = this.rejectedSuggestions.get(sourceId) || [];
      rejected.push(suggestion);
      this.rejectedSuggestions.set(sourceId, rejected);

      if (pending.length === 0) {
        this.pendingSuggestions.delete(sourceId);
      } else {
        this.pendingSuggestions.set(sourceId, pending);
      }

      this._emit('suggestion:rejected', { sourceId, fieldId, suggestion });
    }
  }

  /**
   * Approve all suggestions for a source
   * @param {string} sourceId - The source ID
   */
  approveAll(sourceId) {
    const pending = this.pendingSuggestions.get(sourceId) || [];
    const fieldIds = pending.map(s => s.fieldId);
    fieldIds.forEach(fieldId => this.approveSuggestion(sourceId, fieldId));
    this._emit('suggestions:approved-all', { sourceId, count: fieldIds.length });
  }

  /**
   * Reject all suggestions for a source
   * @param {string} sourceId - The source ID
   */
  rejectAll(sourceId) {
    const pending = this.pendingSuggestions.get(sourceId) || [];
    const fieldIds = pending.map(s => s.fieldId);
    fieldIds.forEach(fieldId => this.rejectSuggestion(sourceId, fieldId));
    this._emit('suggestions:rejected-all', { sourceId, count: fieldIds.length });
  }

  /**
   * Get approved suggestions for a source
   * @param {string} sourceId - The source ID
   * @returns {Array}
   */
  getApprovedSuggestions(sourceId) {
    return this.approvedSuggestions.get(sourceId) || [];
  }

  /**
   * Check if source has pending suggestions
   * @param {string} sourceId - The source ID
   * @returns {boolean}
   */
  hasPendingSuggestions(sourceId) {
    return (this.pendingSuggestions.get(sourceId)?.length || 0) > 0;
  }

  /**
   * Clear all suggestions for a source
   * @param {string} sourceId - The source ID
   */
  clearSuggestions(sourceId) {
    this.pendingSuggestions.delete(sourceId);
    this.approvedSuggestions.delete(sourceId);
    this.rejectedSuggestions.delete(sourceId);
    this._emit('suggestions:cleared', { sourceId });
  }

  /**
   * Emit event
   * @private
   */
  _emit(eventName, detail) {
    if (this.eventTarget) {
      try {
        this.eventTarget.dispatchEvent(new CustomEvent(eventName, { detail }));
      } catch (e) {
        // EventTarget not available
      }
    }
  }

  /**
   * Subscribe to events
   * @param {string} eventName - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} - Unsubscribe function
   */
  on(eventName, handler) {
    if (this.eventTarget) {
      this.eventTarget.addEventListener(eventName, handler);
    }
    return () => {
      if (this.eventTarget) {
        this.eventTarget.removeEventListener(eventName, handler);
      }
    };
  }
}

// ============================================================================
// SECTION II: Key Suggestion Generator
// ============================================================================

/**
 * KeySuggestionGenerator - Generates suggestions for field definitions
 */
class KeySuggestionGenerator {
  constructor(options = {}) {
    this.store = options.store || new KeySuggestionStore();

    // Common field patterns for better suggestions
    this.fieldPatterns = {
      // Identifiers
      id: { role: 'identifier', description: 'Unique identifier' },
      uuid: { role: 'identifier', description: 'Universally unique identifier' },
      key: { role: 'identifier', description: 'Primary key' },

      // Temporal
      date: { role: 'temporal', description: 'Date value' },
      time: { role: 'temporal', description: 'Time value' },
      timestamp: { role: 'temporal', description: 'Timestamp value' },
      created: { role: 'temporal', description: 'Creation timestamp' },
      updated: { role: 'temporal', description: 'Last update timestamp' },
      due: { role: 'temporal', description: 'Due date' },

      // Status/State
      status: { role: 'categorical', description: 'Status indicator' },
      state: { role: 'categorical', description: 'State value' },
      type: { role: 'categorical', description: 'Type classification' },
      category: { role: 'categorical', description: 'Category classification' },
      priority: { role: 'categorical', description: 'Priority level' },
      severity: { role: 'categorical', description: 'Severity level' },

      // Quantitative
      count: { role: 'quantity', description: 'Count or number of items' },
      amount: { role: 'quantity', description: 'Amount or total' },
      price: { role: 'quantity', description: 'Price value' },
      cost: { role: 'quantity', description: 'Cost value' },
      total: { role: 'quantity', description: 'Total value' },
      estimate: { role: 'quantity', description: 'Estimated value' },

      // Textual
      name: { role: 'textual', description: 'Name or title' },
      title: { role: 'textual', description: 'Title' },
      description: { role: 'textual', description: 'Description text' },
      notes: { role: 'textual', description: 'Additional notes' },
      comment: { role: 'textual', description: 'Comment or remark' },

      // People/Entities
      assignee: { role: 'property', description: 'Assigned person' },
      owner: { role: 'property', description: 'Owner or responsible party' },
      author: { role: 'property', description: 'Author or creator' },
      reporter: { role: 'property', description: 'Person who reported' },

      // Boolean
      completed: { role: 'property', description: 'Completion status' },
      active: { role: 'property', description: 'Active/inactive status' },
      enabled: { role: 'property', description: 'Enabled/disabled status' },
      verified: { role: 'property', description: 'Verification status' },

      // Versioning
      version: { role: 'property', description: 'Version identifier' },
      release: { role: 'property', description: 'Release identifier' }
    };
  }

  /**
   * Generate suggestions for a source's fields
   * @param {Object} source - The source object
   * @param {Object} options - Generation options
   * @returns {Array} - Generated suggestions
   */
  async generateForSource(source, options = {}) {
    if (!source?.schema?.fields) {
      return [];
    }

    const suggestions = [];
    const fields = source.schema.fields;

    for (const field of fields) {
      const suggestion = await this._generateFieldSuggestion(field, source, options);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Store the suggestions
    if (suggestions.length > 0 && !options.skipStore) {
      this.store.addPendingSuggestions(source.id, suggestions);
    }

    return suggestions;
  }

  /**
   * Generate a suggestion for a single field
   * @param {Object} field - The field object
   * @param {Object} source - The source object
   * @param {Object} options - Generation options
   * @returns {Object|null} - Generated suggestion or null
   * @private
   */
  async _generateFieldSuggestion(field, source, options = {}) {
    const fieldName = field.name || '';
    const fieldType = field.type || 'text';
    const normalizedName = this._normalizeFieldName(fieldName);

    // Find matching pattern
    const patternMatch = this._findPatternMatch(normalizedName);

    // Calculate confidence based on pattern match and type alignment
    let confidence = 0.5; // Base confidence
    let matchReason = 'field name analysis';

    if (patternMatch) {
      confidence += 0.3;
      matchReason = `matches "${patternMatch.pattern}" pattern`;
    }

    // Type alignment check
    if (this._typesAlign(fieldType, patternMatch?.role)) {
      confidence += 0.1;
    }

    // Create suggestion
    const suggestion = {
      id: this._generateId(),
      sourceId: source.id,
      fieldId: field.name, // Using name as ID for now
      fieldName: field.name,
      fieldType: fieldType,

      // Suggested definition
      suggestedDefinition: {
        term: fieldName,
        label: this._formatLabel(fieldName),
        role: patternMatch?.role || this._inferRole(fieldType),
        description: patternMatch?.description || this._generateDescription(fieldName, fieldType),

        // EO 9-parameter structure (partial)
        referent: {
          term: fieldName,
          label: this._formatLabel(fieldName),
          dataType: fieldType
        },
        predicate: {
          predicate: 'exactMatch',
          needsConfirmation: true
        },
        authority: null, // To be looked up
        validity: null,
        jurisdiction: null,
        parameters: null,
        provenance: {
          method: 'auto_suggestion',
          assertedAt: new Date().toISOString(),
          source: 'KeySuggestionGenerator'
        },
        epistemicStance: {
          confidence: confidence > 0.7 ? 'medium' : 'low',
          notes: matchReason
        }
      },

      // Metadata
      confidence: confidence,
      matchReason: matchReason,
      status: 'pending',
      createdAt: new Date().toISOString(),

      // Sample values if available
      sampleValues: source.records?.slice(0, 3).map(r => r[fieldName]).filter(Boolean) || []
    };

    return suggestion;
  }

  /**
   * Normalize field name for pattern matching
   * @param {string} name - Field name
   * @returns {string} - Normalized name
   * @private
   */
  _normalizeFieldName(name) {
    return name
      .toLowerCase()
      .replace(/[_-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
  }

  /**
   * Find pattern match for normalized field name
   * @param {string} normalizedName - Normalized field name
   * @returns {Object|null} - Pattern match or null
   * @private
   */
  _findPatternMatch(normalizedName) {
    const words = normalizedName.split(' ');

    for (const word of words) {
      if (this.fieldPatterns[word]) {
        return {
          pattern: word,
          ...this.fieldPatterns[word]
        };
      }
    }

    // Check for partial matches
    for (const [pattern, info] of Object.entries(this.fieldPatterns)) {
      if (normalizedName.includes(pattern)) {
        return {
          pattern,
          ...info
        };
      }
    }

    return null;
  }

  /**
   * Check if field type aligns with suggested role
   * @param {string} fieldType - Field type
   * @param {string} role - Suggested role
   * @returns {boolean}
   * @private
   */
  _typesAlign(fieldType, role) {
    const typeRoleMap = {
      'number': ['quantity'],
      'integer': ['quantity', 'identifier'],
      'date': ['temporal'],
      'datetime': ['temporal'],
      'boolean': ['property'],
      'text': ['textual', 'property', 'identifier'],
      'select': ['categorical']
    };

    const expectedRoles = typeRoleMap[fieldType] || [];
    return expectedRoles.includes(role);
  }

  /**
   * Infer role from field type
   * @param {string} fieldType - Field type
   * @returns {string} - Inferred role
   * @private
   */
  _inferRole(fieldType) {
    const typeRoleMap = {
      'number': 'quantity',
      'integer': 'quantity',
      'date': 'temporal',
      'datetime': 'temporal',
      'boolean': 'property',
      'text': 'textual',
      'select': 'categorical'
    };

    return typeRoleMap[fieldType] || 'property';
  }

  /**
   * Format field name as label
   * @param {string} name - Field name
   * @returns {string} - Formatted label
   * @private
   */
  _formatLabel(name) {
    return name
      .replace(/[_-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Generate description from field name and type
   * @param {string} name - Field name
   * @param {string} type - Field type
   * @returns {string} - Generated description
   * @private
   */
  _generateDescription(name, type) {
    const label = this._formatLabel(name);
    const typeDescriptions = {
      'number': 'numeric value',
      'integer': 'integer value',
      'date': 'date',
      'datetime': 'timestamp',
      'boolean': 'boolean flag',
      'text': 'text value',
      'select': 'selection'
    };

    const typeDesc = typeDescriptions[type] || 'value';
    return `${label} - a ${typeDesc} field`;
  }

  /**
   * Generate unique ID
   * @returns {string}
   * @private
   */
  _generateId() {
    return 'sug_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get the suggestion store
   * @returns {KeySuggestionStore}
   */
  getStore() {
    return this.store;
  }
}

// ============================================================================
// SECTION III: Key Suggestion Panel UI
// ============================================================================

/**
 * KeySuggestionPanel - UI Panel for approving/rejecting suggestions
 */
class KeySuggestionPanel {
  constructor(options = {}) {
    this.store = options.store || getKeySuggestionStore();
    this.container = options.container || null;
    this.workbench = options.workbench || null;
    this.isVisible = false;

    // Bind event handlers
    this._onSuggestionsAdded = this._onSuggestionsAdded.bind(this);
    this._onSuggestionApproved = this._onSuggestionApproved.bind(this);
    this._onSuggestionRejected = this._onSuggestionRejected.bind(this);

    // Subscribe to store events
    this.store.on('suggestions:added', this._onSuggestionsAdded);
    this.store.on('suggestion:approved', this._onSuggestionApproved);
    this.store.on('suggestion:rejected', this._onSuggestionRejected);
  }

  /**
   * Show the suggestion panel
   * @param {string} sourceId - Optional: focus on specific source
   */
  show(sourceId = null) {
    this.currentSourceId = sourceId;
    this.isVisible = true;
    this.render();
  }

  /**
   * Hide the suggestion panel
   */
  hide() {
    this.isVisible = false;
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Render the panel
   */
  render() {
    if (!this.container) return;

    const allSuggestions = this.store.getAllPendingSuggestions();
    const totalCount = this.store.getPendingCount();

    if (totalCount === 0) {
      this.container.innerHTML = `
        <div class="key-suggestion-panel empty">
          <div class="panel-header">
            <h3>
              <i class="ph ph-lightbulb"></i>
              Key Definition Suggestions
            </h3>
            <button class="btn-icon close-btn" title="Close">
              <i class="ph ph-x"></i>
            </button>
          </div>
          <div class="panel-content">
            <div class="empty-state">
              <i class="ph ph-check-circle"></i>
              <p>No pending suggestions</p>
              <span class="hint">All key definitions have been reviewed</span>
            </div>
          </div>
        </div>
      `;
      this._attachCloseHandler();
      return;
    }

    this.container.innerHTML = `
      <div class="key-suggestion-panel">
        <div class="panel-header">
          <h3>
            <i class="ph ph-lightbulb"></i>
            Key Definition Suggestions
            <span class="badge">${totalCount}</span>
          </h3>
          <button class="btn-icon close-btn" title="Close">
            <i class="ph ph-x"></i>
          </button>
        </div>

        <div class="panel-description">
          <i class="ph ph-info"></i>
          <span>Review and approve suggested definitions for imported fields.
          Approved definitions help maintain data consistency.</span>
        </div>

        <div class="panel-actions">
          <button class="btn btn-sm btn-success approve-all-btn">
            <i class="ph ph-checks"></i>
            Approve All
          </button>
          <button class="btn btn-sm btn-outline reject-all-btn">
            <i class="ph ph-x"></i>
            Dismiss All
          </button>
        </div>

        <div class="suggestions-list">
          ${this._renderSuggestionsList(allSuggestions)}
        </div>
      </div>
    `;

    this._attachEventHandlers();
  }

  /**
   * Render suggestions list
   * @param {Map} allSuggestions - Map of sourceId -> suggestions[]
   * @returns {string} - HTML string
   * @private
   */
  _renderSuggestionsList(allSuggestions) {
    let html = '';

    for (const [sourceId, suggestions] of allSuggestions) {
      if (suggestions.length === 0) continue;

      // Group by source
      html += `
        <div class="suggestion-group" data-source-id="${sourceId}">
          <div class="group-header">
            <i class="ph ph-database"></i>
            <span class="source-name">${this._getSourceName(sourceId)}</span>
            <span class="count">${suggestions.length} field${suggestions.length !== 1 ? 's' : ''}</span>
          </div>

          <div class="group-items">
            ${suggestions.map(s => this._renderSuggestionItem(s, sourceId)).join('')}
          </div>
        </div>
      `;
    }

    return html || '<p class="no-suggestions">No pending suggestions</p>';
  }

  /**
   * Render a single suggestion item with all 9 definition fields
   * @param {Object} suggestion - Suggestion object
   * @param {string} sourceId - Source ID
   * @returns {string} - HTML string
   * @private
   */
  _renderSuggestionItem(suggestion, sourceId) {
    const def = suggestion.suggestedDefinition || {};
    const confidence = Math.round((suggestion.confidence || 0.5) * 100);
    const confidenceClass = confidence >= 70 ? 'high' : confidence >= 50 ? 'medium' : 'low';

    const roleIcons = {
      'identifier': 'ph-key',
      'temporal': 'ph-calendar',
      'categorical': 'ph-list-bullets',
      'quantity': 'ph-hash',
      'textual': 'ph-text-aa',
      'property': 'ph-tag',
      'spatial': 'ph-map-pin'
    };

    const roleIcon = roleIcons[def.role] || 'ph-circle';

    // Extract all definition fields
    const term = def.term || {};
    const authority = def.authority || {};
    const source = def.source || {};
    const version = def.version || {};
    const validity = def.validity || {};
    const jurisdiction = def.jurisdiction || {};
    const status = def.status || suggestion.status || 'stub';
    const populationMethod = def.populationMethod || 'pending';

    // Build sample values display
    const samplesHtml = suggestion.sampleValues?.length > 0
      ? `<span class="def-field-value samples" title="${suggestion.sampleValues.slice(0, 5).join(', ')}">
           e.g. "${suggestion.sampleValues[0]}"${suggestion.sampleValues.length > 1 ? ` (+${suggestion.sampleValues.length - 1} more)` : ''}
         </span>`
      : '';

    // Build jurisdiction display
    const jurisdictionParts = [];
    if (jurisdiction.geographic) jurisdictionParts.push(jurisdiction.geographic);
    if (jurisdiction.programs?.length) jurisdictionParts.push(jurisdiction.programs.join(', '));
    const jurisdictionText = jurisdictionParts.join(' • ') || '—';

    // Build validity display
    const validityText = validity.from
      ? `${validity.from}${validity.to ? ' to ' + validity.to : ' onwards'}`
      : '—';

    return `
      <div class="suggestion-item suggestion-item-expanded" data-field-id="${suggestion.fieldId}" data-source-id="${sourceId}">
        <div class="item-header-row">
          <div class="item-icon">
            <i class="ph ${roleIcon}"></i>
          </div>
          <div class="item-title">
            <span class="field-name">${suggestion.fieldName}</span>
            <span class="confidence ${confidenceClass}">${confidence}%</span>
          </div>
          <div class="item-actions">
            <button class="btn-icon btn-approve" title="Approve" data-action="approve" data-field-id="${suggestion.fieldId}" data-source-id="${sourceId}">
              <i class="ph ph-check"></i>
            </button>
            <button class="btn-icon btn-reject" title="Reject" data-action="reject" data-field-id="${suggestion.fieldId}" data-source-id="${sourceId}">
              <i class="ph ph-x"></i>
            </button>
          </div>
        </div>

        <div class="definition-fields-grid">
          <!-- Row 1: Role, Type, Samples -->
          <div class="def-field">
            <span class="def-field-label">Role</span>
            <span class="def-field-value role-badge">${def.role || 'property'}</span>
          </div>
          <div class="def-field">
            <span class="def-field-label">Type</span>
            <span class="def-field-value type-badge">${suggestion.fieldType}</span>
          </div>
          <div class="def-field def-field-wide">
            <span class="def-field-label">Samples</span>
            ${samplesHtml || '<span class="def-field-value muted">—</span>'}
          </div>

          <!-- Row 2: Definition Text -->
          <div class="def-field def-field-full">
            <span class="def-field-label">Definition</span>
            <span class="def-field-value definition-text">${term.definitionText || def.description || '<span class="muted">No definition text</span>'}</span>
          </div>

          <!-- Row 3: Authority, Source Citation -->
          <div class="def-field">
            <span class="def-field-label">Authority</span>
            <span class="def-field-value">${authority.shortName || authority.name || '<span class="muted">—</span>'}</span>
          </div>
          <div class="def-field def-field-wide">
            <span class="def-field-label">Source Citation</span>
            <span class="def-field-value citation">${source.citation || source.title || '<span class="muted">—</span>'}</span>
          </div>

          <!-- Row 4: Validity, Jurisdiction, Status -->
          <div class="def-field">
            <span class="def-field-label">Validity</span>
            <span class="def-field-value">${validityText}</span>
          </div>
          <div class="def-field">
            <span class="def-field-label">Jurisdiction</span>
            <span class="def-field-value">${jurisdictionText}</span>
          </div>
          <div class="def-field">
            <span class="def-field-label">Status</span>
            <span class="def-field-value status-badge status-${status}">${status}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get source name from ID
   * @param {string} sourceId - Source ID
   * @returns {string} - Source name
   * @private
   */
  _getSourceName(sourceId) {
    if (this.workbench?.sources) {
      const source = this.workbench.sources.find(s => s.id === sourceId);
      if (source) return source.name;
    }
    if (this.workbench?.sourceStore?.sources) {
      const source = this.workbench.sourceStore.sources.get(sourceId);
      if (source) return source.name;
    }
    return 'Unknown Source';
  }

  /**
   * Attach close handler
   * @private
   */
  _attachCloseHandler() {
    const closeBtn = this.container?.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
  }

  /**
   * Attach event handlers
   * @private
   */
  _attachEventHandlers() {
    if (!this.container) return;

    // Close button
    this._attachCloseHandler();

    // Approve all
    const approveAllBtn = this.container.querySelector('.approve-all-btn');
    if (approveAllBtn) {
      approveAllBtn.addEventListener('click', () => this._approveAll());
    }

    // Reject all
    const rejectAllBtn = this.container.querySelector('.reject-all-btn');
    if (rejectAllBtn) {
      rejectAllBtn.addEventListener('click', () => this._rejectAll());
    }

    // Individual approve/reject buttons
    this.container.querySelectorAll('[data-action="approve"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sourceId = btn.dataset.sourceId;
        const fieldId = btn.dataset.fieldId;
        this._approveSuggestion(sourceId, fieldId);
      });
    });

    this.container.querySelectorAll('[data-action="reject"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sourceId = btn.dataset.sourceId;
        const fieldId = btn.dataset.fieldId;
        this._rejectSuggestion(sourceId, fieldId);
      });
    });
  }

  /**
   * Approve a single suggestion
   * @param {string} sourceId - Source ID
   * @param {string} fieldId - Field ID
   * @private
   */
  _approveSuggestion(sourceId, fieldId) {
    this.store.approveSuggestion(sourceId, fieldId);

    // Animate removal
    const item = this.container?.querySelector(`[data-field-id="${fieldId}"][data-source-id="${sourceId}"].suggestion-item`);
    if (item) {
      item.classList.add('approved-out');
      setTimeout(() => {
        this.render();
      }, 300);
    }
  }

  /**
   * Reject a single suggestion
   * @param {string} sourceId - Source ID
   * @param {string} fieldId - Field ID
   * @private
   */
  _rejectSuggestion(sourceId, fieldId) {
    this.store.rejectSuggestion(sourceId, fieldId);

    // Animate removal
    const item = this.container?.querySelector(`[data-field-id="${fieldId}"][data-source-id="${sourceId}"].suggestion-item`);
    if (item) {
      item.classList.add('rejected-out');
      setTimeout(() => {
        this.render();
      }, 300);
    }
  }

  /**
   * Approve all suggestions
   * @private
   */
  _approveAll() {
    const allSuggestions = this.store.getAllPendingSuggestions();
    for (const sourceId of allSuggestions.keys()) {
      this.store.approveAll(sourceId);
    }

    // Show success feedback
    this._showFeedback('All suggestions approved', 'success');

    setTimeout(() => {
      this.render();
    }, 500);
  }

  /**
   * Reject all suggestions
   * @private
   */
  _rejectAll() {
    const allSuggestions = this.store.getAllPendingSuggestions();
    for (const sourceId of allSuggestions.keys()) {
      this.store.rejectAll(sourceId);
    }

    setTimeout(() => {
      this.render();
    }, 300);
  }

  /**
   * Show feedback message
   * @param {string} message - Message to show
   * @param {string} type - Message type (success, error, info)
   * @private
   */
  _showFeedback(message, type = 'info') {
    const panel = this.container?.querySelector('.key-suggestion-panel');
    if (!panel) return;

    const feedback = document.createElement('div');
    feedback.className = `feedback-message ${type}`;
    feedback.innerHTML = `
      <i class="ph ${type === 'success' ? 'ph-check-circle' : 'ph-info'}"></i>
      <span>${message}</span>
    `;

    panel.insertBefore(feedback, panel.firstChild.nextSibling);

    setTimeout(() => {
      feedback.classList.add('fade-out');
      setTimeout(() => feedback.remove(), 300);
    }, 2000);
  }

  /**
   * Event handler for suggestions added
   * @private
   */
  _onSuggestionsAdded(event) {
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * Event handler for suggestion approved
   * @private
   */
  _onSuggestionApproved(event) {
    // Could trigger definition creation here
  }

  /**
   * Event handler for suggestion rejected
   * @private
   */
  _onSuggestionRejected(event) {
    // Log or track rejection
  }

  /**
   * Destroy the panel
   */
  destroy() {
    this.hide();
    // Unsubscribe from events would happen here if we stored unsubscribe functions
  }
}

// ============================================================================
// SECTION IV: Notification Badge
// ============================================================================

/**
 * Create a notification badge for pending suggestions
 * @param {number} count - Number of pending suggestions
 * @returns {string} - HTML string
 */
function createSuggestionBadge(count) {
  if (!count || count === 0) return '';

  return `
    <span class="suggestion-badge" title="${count} pending suggestion${count !== 1 ? 's' : ''}">
      ${count > 99 ? '99+' : count}
    </span>
  `;
}

/**
 * Create a suggestion notification banner
 * @param {number} count - Number of pending suggestions
 * @param {Function} onReview - Callback when user clicks review
 * @returns {HTMLElement|null}
 */
function createSuggestionBanner(count, onReview) {
  if (!count || count === 0) return null;

  const banner = document.createElement('div');
  banner.className = 'suggestion-banner';
  banner.innerHTML = `
    <div class="banner-content">
      <i class="ph ph-lightbulb"></i>
      <span>${count} key definition suggestion${count !== 1 ? 's' : ''} available</span>
    </div>
    <div class="banner-actions">
      <button class="btn btn-sm btn-primary review-btn">Review</button>
      <button class="btn-icon dismiss-btn" title="Dismiss">
        <i class="ph ph-x"></i>
      </button>
    </div>
  `;

  banner.querySelector('.review-btn')?.addEventListener('click', () => {
    if (onReview) onReview();
  });

  banner.querySelector('.dismiss-btn')?.addEventListener('click', () => {
    banner.classList.add('dismissed');
    setTimeout(() => banner.remove(), 300);
  });

  return banner;
}

// ============================================================================
// SECTION V: CSS Styles
// ============================================================================

/**
 * Inject CSS styles for the suggestion panel
 */
function injectKeySuggestionStyles() {
  if (document.getElementById('key-suggestion-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'key-suggestion-styles';
  styles.textContent = `
    /* Key Suggestion Panel */
    .key-suggestion-panel {
      background: var(--bg-primary, #ffffff);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      max-height: 80vh;
      overflow: hidden;
    }

    .key-suggestion-panel .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
    }

    .key-suggestion-panel .panel-header h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .key-suggestion-panel .panel-header .badge {
      background: var(--primary-color, #3b82f6);
      color: white;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 12px;
    }

    .key-suggestion-panel .panel-description {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 16px;
      background: var(--bg-secondary, #f9fafb);
      font-size: 13px;
      color: var(--text-secondary, #6b7280);
    }

    .key-suggestion-panel .panel-description i {
      color: var(--primary-color, #3b82f6);
      flex-shrink: 0;
    }

    .key-suggestion-panel .panel-actions {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
    }

    .key-suggestion-panel .suggestions-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    /* Suggestion Group */
    .suggestion-group {
      margin-bottom: 12px;
    }

    .suggestion-group .group-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg-secondary, #f9fafb);
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary, #1f2937);
    }

    .suggestion-group .group-header .count {
      margin-left: auto;
      font-size: 12px;
      color: var(--text-secondary, #6b7280);
    }

    .suggestion-group .group-items {
      padding: 4px 0;
    }

    /* Suggestion Item - Expanded View */
    .suggestion-item {
      display: flex;
      flex-direction: column;
      padding: 12px;
      margin: 8px 0;
      border-radius: 8px;
      background: var(--bg-primary, #ffffff);
      border: 1px solid var(--border-color, #e5e7eb);
      transition: all 0.2s ease;
    }

    .suggestion-item:hover {
      border-color: var(--primary-color, #3b82f6);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .suggestion-item.approved-out {
      animation: slideOutRight 0.3s ease forwards;
      background: #dcfce7;
    }

    .suggestion-item.rejected-out {
      animation: slideOutLeft 0.3s ease forwards;
      background: #fee2e2;
    }

    @keyframes slideOutRight {
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    @keyframes slideOutLeft {
      to {
        transform: translateX(-100%);
        opacity: 0;
      }
    }

    /* Header Row */
    .suggestion-item .item-header-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
    }

    .suggestion-item .item-icon {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      background: var(--bg-secondary, #f3f4f6);
      color: var(--primary-color, #3b82f6);
      flex-shrink: 0;
    }

    .suggestion-item .item-icon i {
      font-size: 16px;
    }

    .suggestion-item .item-title {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .suggestion-item .field-name {
      font-weight: 600;
      font-size: 14px;
      color: var(--text-primary, #1f2937);
    }

    .suggestion-item .confidence {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }

    .suggestion-item .confidence.high {
      background: #dcfce7;
      color: #166534;
    }

    .suggestion-item .confidence.medium {
      background: #fef3c7;
      color: #92400e;
    }

    .suggestion-item .confidence.low {
      background: #f3f4f6;
      color: #6b7280;
    }

    .suggestion-item .item-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }

    .suggestion-item .btn-approve {
      color: #16a34a;
    }

    .suggestion-item .btn-approve:hover {
      background: #dcfce7;
    }

    .suggestion-item .btn-reject {
      color: #dc2626;
    }

    .suggestion-item .btn-reject:hover {
      background: #fee2e2;
    }

    /* Definition Fields Grid - 9 fields layout */
    .definition-fields-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px 12px;
    }

    .def-field {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .def-field-wide {
      grid-column: span 2;
    }

    .def-field-full {
      grid-column: span 3;
    }

    .def-field-label {
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary, #6b7280);
    }

    .def-field-value {
      font-size: 12px;
      color: var(--text-primary, #1f2937);
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .def-field-value.muted,
    .def-field-value .muted {
      color: var(--text-secondary, #9ca3af);
      font-style: italic;
    }

    .def-field-value.role-badge,
    .def-field-value.type-badge {
      display: inline-block;
      padding: 2px 6px;
      background: var(--bg-secondary, #f3f4f6);
      border-radius: 4px;
      font-size: 11px;
      width: fit-content;
    }

    .def-field-value.samples {
      background: #fef3c7;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .def-field-value.definition-text {
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .def-field-value.citation {
      font-family: monospace;
      font-size: 11px;
      background: var(--bg-secondary, #f9fafb);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .def-field-value.status-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      width: fit-content;
    }

    .status-badge.status-stub {
      background: #fef3c7;
      color: #92400e;
    }

    .status-badge.status-partial {
      background: #dbeafe;
      color: #1e40af;
    }

    .status-badge.status-complete {
      background: #dcfce7;
      color: #166534;
    }

    .status-badge.status-verified {
      background: #d1fae5;
      color: #047857;
    }

    .status-badge.status-local_only {
      background: #f3f4f6;
      color: #6b7280;
    }

    /* Empty State */
    .key-suggestion-panel.empty .panel-content {
      padding: 40px 20px;
      text-align: center;
    }

    .key-suggestion-panel .empty-state {
      color: var(--text-secondary, #6b7280);
    }

    .key-suggestion-panel .empty-state i {
      font-size: 48px;
      color: #16a34a;
      margin-bottom: 12px;
    }

    .key-suggestion-panel .empty-state p {
      margin: 0 0 4px;
      font-weight: 500;
      color: var(--text-primary, #1f2937);
    }

    .key-suggestion-panel .empty-state .hint {
      font-size: 13px;
    }

    /* Suggestion Badge */
    .suggestion-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      background: #ef4444;
      color: white;
      font-size: 11px;
      font-weight: 600;
      border-radius: 9px;
      margin-left: 6px;
    }

    /* Suggestion Banner */
    .suggestion-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: linear-gradient(90deg, #eef2ff, #e0e7ff);
      border-radius: 8px;
      margin: 8px 0;
      animation: slideDown 0.3s ease;
    }

    .suggestion-banner.dismissed {
      animation: slideUp 0.3s ease forwards;
    }

    @keyframes slideDown {
      from {
        transform: translateY(-10px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes slideUp {
      to {
        transform: translateY(-10px);
        opacity: 0;
      }
    }

    .suggestion-banner .banner-content {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--primary-color, #3b82f6);
    }

    .suggestion-banner .banner-content i {
      font-size: 18px;
    }

    .suggestion-banner .banner-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Feedback Message */
    .feedback-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      margin: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      animation: fadeIn 0.3s ease;
    }

    .feedback-message.success {
      background: #dcfce7;
      color: #166534;
    }

    .feedback-message.fade-out {
      animation: fadeOut 0.3s ease forwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeOut {
      to { opacity: 0; transform: translateY(-5px); }
    }
  `;

  document.head.appendChild(styles);
}

// ============================================================================
// SECTION VI: Definition Population Store
// ============================================================================

/**
 * DefinitionPopulationStore - Manages stub definitions that need population
 * This replaces KeySuggestionStore for the new "keys in definitions by default" pattern
 */
class DefinitionPopulationStore {
  constructor() {
    this.definitions = new Map(); // definitionId -> DefinitionSource
    this.eventTarget = typeof EventTarget !== 'undefined' ? new EventTarget() : null;
  }

  /**
   * Add stub definitions for tracking
   * @param {DefinitionSource[]} definitions - Array of stub definitions
   */
  addDefinitions(definitions) {
    for (const def of definitions) {
      this.definitions.set(def.id, def);
    }
    this._emit('definitions:added', { count: definitions.length });
  }

  /**
   * Get all definitions that need population
   * @returns {DefinitionSource[]}
   */
  getDefinitionsNeedingPopulation() {
    return Array.from(this.definitions.values()).filter(d =>
      d.status === 'stub' || d.status === 'partial'
    );
  }

  /**
   * Get all definitions grouped by source
   * @returns {Map<string, DefinitionSource[]>}
   */
  getDefinitionsBySource() {
    const bySource = new Map();
    for (const def of this.definitions.values()) {
      const sourceId = def.discoveredFrom?.sourceId || 'unknown';
      if (!bySource.has(sourceId)) {
        bySource.set(sourceId, []);
      }
      bySource.get(sourceId).push(def);
    }
    return bySource;
  }

  /**
   * Get count of definitions needing population
   * @returns {number}
   */
  getPopulationNeededCount() {
    return this.getDefinitionsNeedingPopulation().length;
  }

  /**
   * Get count of definitions with API suggestions
   * @returns {number}
   */
  getDefinitionsWithSuggestionsCount() {
    return Array.from(this.definitions.values()).filter(d =>
      d.apiSuggestions && d.apiSuggestions.length > 0
    ).length;
  }

  /**
   * Populate a definition from an API suggestion
   * @param {string} definitionId - Definition ID
   * @param {Object} suggestion - The suggestion to use
   */
  populateFromSuggestion(definitionId, suggestion) {
    const def = this.definitions.get(definitionId);
    if (!def) return null;

    // Use the DefinitionSource method to populate
    const populatedDef = def.populateFromSuggestion(suggestion);
    this.definitions.set(definitionId, populatedDef);

    this._emit('definition:populated', {
      definitionId,
      method: 'api_suggestion',
      suggestion
    });

    return populatedDef;
  }

  /**
   * Mark a definition as local-only
   * @param {string} definitionId - Definition ID
   * @param {string} notes - Optional notes
   */
  markAsLocalOnly(definitionId, notes = null) {
    const def = this.definitions.get(definitionId);
    if (!def) return null;

    const updatedDef = def.markAsLocalOnly(notes);
    this.definitions.set(definitionId, updatedDef);

    this._emit('definition:local-only', { definitionId, notes });

    return updatedDef;
  }

  /**
   * Auto-populate all definitions with high-confidence suggestions
   * @param {number} minConfidence - Minimum confidence threshold (0-1)
   * @returns {number} - Count of definitions populated
   */
  autoPopulateHighConfidence(minConfidence = 0.8) {
    let count = 0;
    for (const def of this.getDefinitionsNeedingPopulation()) {
      if (def.apiSuggestions?.length > 0) {
        const bestSuggestion = def.getBestSuggestion();
        if (bestSuggestion && (bestSuggestion.confidence || 0) >= minConfidence) {
          this.populateFromSuggestion(def.id, bestSuggestion);
          count++;
        }
      }
    }

    this._emit('definitions:auto-populated', { count, minConfidence });
    return count;
  }

  /**
   * Get a definition by ID
   * @param {string} definitionId
   * @returns {DefinitionSource|null}
   */
  get(definitionId) {
    return this.definitions.get(definitionId) || null;
  }

  /**
   * Remove a definition
   * @param {string} definitionId
   */
  remove(definitionId) {
    this.definitions.delete(definitionId);
    this._emit('definition:removed', { definitionId });
  }

  /**
   * Clear all definitions
   */
  clear() {
    this.definitions.clear();
    this._emit('definitions:cleared', {});
  }

  /**
   * Emit event
   * @private
   */
  _emit(eventName, detail) {
    if (this.eventTarget) {
      try {
        this.eventTarget.dispatchEvent(new CustomEvent(eventName, { detail }));
      } catch (e) {
        // EventTarget not available
      }
    }
  }

  /**
   * Subscribe to events
   */
  on(eventName, handler) {
    if (this.eventTarget) {
      this.eventTarget.addEventListener(eventName, handler);
    }
    return () => {
      if (this.eventTarget) {
        this.eventTarget.removeEventListener(eventName, handler);
      }
    };
  }
}

// ============================================================================
// SECTION VII: Definition Population Panel UI
// ============================================================================

/**
 * DefinitionPopulationPanel - UI for populating stub definitions
 * Replaces KeySuggestionPanel for the new workflow
 */
class DefinitionPopulationPanel {
  constructor(options = {}) {
    this.store = options.store || getDefinitionPopulationStore();
    this.container = options.container || null;
    this.workbench = options.workbench || null;
    this.isVisible = false;

    // Event handlers
    this._onDefinitionsAdded = this._onDefinitionsAdded.bind(this);
    this._onDefinitionPopulated = this._onDefinitionPopulated.bind(this);

    // Subscribe to store events
    this.store.on('definitions:added', this._onDefinitionsAdded);
    this.store.on('definition:populated', this._onDefinitionPopulated);
  }

  /**
   * Show the panel
   */
  show(sourceId = null) {
    this.currentSourceId = sourceId;
    this.isVisible = true;
    this.render();
  }

  /**
   * Hide the panel
   */
  hide() {
    this.isVisible = false;
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Render the panel
   */
  render() {
    if (!this.container) return;

    const needingPopulation = this.store.getDefinitionsNeedingPopulation();
    const withSuggestions = this.store.getDefinitionsWithSuggestionsCount();

    if (needingPopulation.length === 0) {
      this.container.innerHTML = `
        <div class="definition-population-panel empty">
          <div class="panel-header">
            <h3>
              <i class="ph ph-book-open"></i>
              Definition Population
            </h3>
            <button class="btn-icon close-btn" title="Close">
              <i class="ph ph-x"></i>
            </button>
          </div>
          <div class="panel-content">
            <div class="empty-state">
              <i class="ph ph-check-circle"></i>
              <p>All definitions are populated</p>
              <span class="hint">No stub definitions need attention</span>
            </div>
          </div>
        </div>
      `;
      this._attachCloseHandler();
      return;
    }

    this.container.innerHTML = `
      <div class="definition-population-panel">
        <div class="panel-header">
          <h3>
            <i class="ph ph-book-open"></i>
            Definition Population
            <span class="badge">${needingPopulation.length}</span>
          </h3>
          <button class="btn-icon close-btn" title="Close">
            <i class="ph ph-x"></i>
          </button>
        </div>

        <div class="panel-description">
          <i class="ph ph-info"></i>
          <span>These keys need definitions. Select from API suggestions or enter manually.</span>
        </div>

        ${withSuggestions > 0 ? `
          <div class="panel-actions">
            <button class="btn btn-sm btn-primary auto-populate-btn">
              <i class="ph ph-lightning"></i>
              Auto-populate ${withSuggestions} with suggestions
            </button>
            <button class="btn btn-sm btn-outline mark-all-local-btn">
              <i class="ph ph-house"></i>
              Mark all as local
            </button>
          </div>
        ` : `
          <div class="panel-actions">
            <button class="btn btn-sm btn-outline mark-all-local-btn">
              <i class="ph ph-house"></i>
              Mark all as local-only
            </button>
          </div>
        `}

        <div class="definitions-list">
          ${this._renderDefinitionsList(needingPopulation)}
        </div>
      </div>
    `;

    this._attachEventHandlers();
  }

  /**
   * Render the definitions list
   * @private
   */
  _renderDefinitionsList(definitions) {
    // Group by source
    const bySource = new Map();
    for (const def of definitions) {
      const sourceId = def.discoveredFrom?.sourceId || 'unknown';
      const sourceName = def.discoveredFrom?.sourceName || 'Unknown Source';
      const key = `${sourceId}|${sourceName}`;
      if (!bySource.has(key)) {
        bySource.set(key, { sourceId, sourceName, definitions: [] });
      }
      bySource.get(key).definitions.push(def);
    }

    let html = '';
    for (const [key, group] of bySource) {
      html += `
        <div class="definition-group" data-source-id="${group.sourceId}">
          <div class="group-header">
            <i class="ph ph-database"></i>
            <span class="source-name">${group.sourceName}</span>
            <span class="count">${group.definitions.length} definition${group.definitions.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="group-items">
            ${group.definitions.map(d => this._renderDefinitionItem(d)).join('')}
          </div>
        </div>
      `;
    }

    return html || '<p class="no-definitions">No definitions need population</p>';
  }

  /**
   * Render a single definition item
   * @private
   */
  _renderDefinitionItem(def) {
    const hasSuggestions = def.apiSuggestions && def.apiSuggestions.length > 0;
    const bestSuggestion = hasSuggestions ? def.getBestSuggestion() : null;
    const confidence = bestSuggestion ? Math.round((bestSuggestion.confidence || 0.5) * 100) : 0;
    const confidenceClass = confidence >= 70 ? 'high' : confidence >= 50 ? 'medium' : 'low';

    return `
      <div class="definition-item" data-definition-id="${def.id}">
        <div class="item-main">
          <div class="item-icon">
            <i class="ph ${hasSuggestions ? 'ph-lightbulb' : 'ph-question'}"></i>
          </div>
          <div class="item-content">
            <div class="item-header">
              <span class="term-name">${def.term.term}</span>
              <span class="term-label">${def.term.label || ''}</span>
              ${hasSuggestions ? `
                <span class="confidence ${confidenceClass}">${confidence}%</span>
              ` : ''}
            </div>
            ${hasSuggestions && bestSuggestion ? `
              <div class="suggestion-preview">
                <span class="suggestion-source">${bestSuggestion.source}</span>
                ${bestSuggestion.authority?.name ? `
                  <span class="suggestion-authority">${bestSuggestion.authority.shortName || bestSuggestion.authority.name}</span>
                ` : ''}
                ${bestSuggestion.definitionText ? `
                  <span class="suggestion-text">"${bestSuggestion.definitionText.substring(0, 80)}..."</span>
                ` : ''}
              </div>
            ` : `
              <div class="no-suggestions">
                <span>No API suggestions found</span>
              </div>
            `}
          </div>
        </div>
        <div class="item-actions">
          ${hasSuggestions ? `
            <button class="btn-icon btn-accept" title="Accept best suggestion"
                    data-action="accept" data-definition-id="${def.id}">
              <i class="ph ph-check"></i>
            </button>
            ${def.apiSuggestions.length > 1 ? `
              <button class="btn-icon btn-more" title="View all ${def.apiSuggestions.length} suggestions"
                      data-action="view-more" data-definition-id="${def.id}">
                <i class="ph ph-dots-three"></i>
              </button>
            ` : ''}
          ` : ''}
          <button class="btn-icon btn-manual" title="Enter manually"
                  data-action="manual" data-definition-id="${def.id}">
            <i class="ph ph-pencil"></i>
          </button>
          <button class="btn-icon btn-local" title="Mark as local-only"
                  data-action="local" data-definition-id="${def.id}">
            <i class="ph ph-house"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach close handler
   * @private
   */
  _attachCloseHandler() {
    const closeBtn = this.container?.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
  }

  /**
   * Attach all event handlers
   * @private
   */
  _attachEventHandlers() {
    if (!this.container) return;

    this._attachCloseHandler();

    // Auto-populate button
    const autoPopulateBtn = this.container.querySelector('.auto-populate-btn');
    if (autoPopulateBtn) {
      autoPopulateBtn.addEventListener('click', () => {
        const count = this.store.autoPopulateHighConfidence(0.7);
        this._showFeedback(`Auto-populated ${count} definitions`, 'success');
        setTimeout(() => this.render(), 500);
      });
    }

    // Mark all as local button
    const markAllLocalBtn = this.container.querySelector('.mark-all-local-btn');
    if (markAllLocalBtn) {
      markAllLocalBtn.addEventListener('click', () => {
        const defs = this.store.getDefinitionsNeedingPopulation();
        for (const def of defs) {
          this.store.markAsLocalOnly(def.id);
        }
        this._showFeedback(`Marked ${defs.length} as local-only`, 'success');
        setTimeout(() => this.render(), 500);
      });
    }

    // Individual action buttons
    this.container.querySelectorAll('[data-action="accept"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const defId = btn.dataset.definitionId;
        const def = this.store.get(defId);
        if (def?.apiSuggestions?.length > 0) {
          this.store.populateFromSuggestion(defId, def.getBestSuggestion());
          this._animateRemove(defId);
        }
      });
    });

    this.container.querySelectorAll('[data-action="local"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const defId = btn.dataset.definitionId;
        this.store.markAsLocalOnly(defId);
        this._animateRemove(defId);
      });
    });

    this.container.querySelectorAll('[data-action="manual"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const defId = btn.dataset.definitionId;
        this._showManualEntryForm(defId);
      });
    });

    this.container.querySelectorAll('[data-action="view-more"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const defId = btn.dataset.definitionId;
        this._showSuggestionsList(defId);
      });
    });
  }

  /**
   * Animate item removal
   * @private
   */
  _animateRemove(definitionId) {
    const item = this.container?.querySelector(`[data-definition-id="${definitionId}"].definition-item`);
    if (item) {
      item.classList.add('populated-out');
      setTimeout(() => this.render(), 300);
    }
  }

  /**
   * Show manual entry form (placeholder - could be expanded)
   * @private
   */
  _showManualEntryForm(definitionId) {
    // TODO: Show a modal or inline form for manual entry
    console.log('Manual entry for:', definitionId);
    alert('Manual entry form coming soon. For now, use the Definition Source Builder.');
  }

  /**
   * Show all suggestions for a definition
   * @private
   */
  _showSuggestionsList(definitionId) {
    // TODO: Show a dropdown or modal with all suggestions
    const def = this.store.get(definitionId);
    if (def?.apiSuggestions) {
      console.log('All suggestions for', def.term.term, ':', def.apiSuggestions);
    }
  }

  /**
   * Show feedback message
   * @private
   */
  _showFeedback(message, type = 'info') {
    const panel = this.container?.querySelector('.definition-population-panel');
    if (!panel) return;

    const feedback = document.createElement('div');
    feedback.className = `feedback-message ${type}`;
    feedback.innerHTML = `
      <i class="ph ${type === 'success' ? 'ph-check-circle' : 'ph-info'}"></i>
      <span>${message}</span>
    `;

    panel.insertBefore(feedback, panel.firstChild.nextSibling);

    setTimeout(() => {
      feedback.classList.add('fade-out');
      setTimeout(() => feedback.remove(), 300);
    }, 2000);
  }

  /**
   * Event handler
   * @private
   */
  _onDefinitionsAdded(event) {
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * Event handler
   * @private
   */
  _onDefinitionPopulated(event) {
    // Could show notification or update UI
  }

  /**
   * Destroy the panel
   */
  destroy() {
    this.hide();
  }
}

// ============================================================================
// SECTION VIII: CSS Styles (Updated)
// ============================================================================

/**
 * Inject CSS styles for the definition population panel
 */
function injectDefinitionPopulationStyles() {
  if (document.getElementById('definition-population-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'definition-population-styles';
  styles.textContent = `
    /* Definition Population Panel - extends key-suggestion-panel styles */
    .definition-population-panel {
      background: var(--bg-primary, #ffffff);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      max-height: 80vh;
      overflow: hidden;
    }

    .definition-population-panel .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
    }

    .definition-population-panel .panel-header h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .definition-population-panel .panel-header .badge {
      background: var(--warning-color, #f59e0b);
      color: white;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 12px;
    }

    .definition-population-panel .panel-description {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 16px;
      background: var(--bg-secondary, #f9fafb);
      font-size: 13px;
      color: var(--text-secondary, #6b7280);
    }

    .definition-population-panel .panel-actions {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
    }

    .definition-population-panel .definitions-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .definition-group {
      margin-bottom: 12px;
    }

    .definition-group .group-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg-secondary, #f9fafb);
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
    }

    .definition-group .group-header .count {
      margin-left: auto;
      font-size: 12px;
      color: var(--text-secondary, #6b7280);
    }

    .definition-item {
      display: flex;
      align-items: flex-start;
      padding: 12px;
      margin: 4px 0;
      border-radius: 6px;
      background: var(--bg-primary, #ffffff);
      border: 1px solid var(--border-color, #e5e7eb);
      transition: all 0.2s ease;
    }

    .definition-item:hover {
      border-color: var(--primary-color, #3b82f6);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .definition-item.populated-out {
      animation: slideOutRight 0.3s ease forwards;
      background: #dcfce7;
    }

    .definition-item .item-main {
      display: flex;
      gap: 12px;
      flex: 1;
    }

    .definition-item .item-icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: var(--bg-secondary, #f3f4f6);
      color: var(--warning-color, #f59e0b);
      flex-shrink: 0;
    }

    .definition-item .item-icon i {
      font-size: 18px;
    }

    .definition-item .item-content {
      flex: 1;
      min-width: 0;
    }

    .definition-item .item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .definition-item .term-name {
      font-weight: 600;
      color: var(--text-primary, #1f2937);
      font-family: monospace;
    }

    .definition-item .term-label {
      font-size: 12px;
      color: var(--text-secondary, #6b7280);
    }

    .definition-item .confidence {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
      margin-left: auto;
    }

    .definition-item .confidence.high { background: #dcfce7; color: #166534; }
    .definition-item .confidence.medium { background: #fef3c7; color: #92400e; }
    .definition-item .confidence.low { background: #f3f4f6; color: #6b7280; }

    .definition-item .suggestion-preview {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 12px;
      color: var(--text-secondary, #6b7280);
    }

    .definition-item .suggestion-preview span {
      padding: 2px 6px;
      background: var(--bg-secondary, #f3f4f6);
      border-radius: 4px;
    }

    .definition-item .suggestion-source {
      color: var(--primary-color, #3b82f6);
      font-weight: 500;
    }

    .definition-item .suggestion-text {
      font-style: italic;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .definition-item .no-suggestions {
      font-size: 12px;
      color: var(--text-secondary, #9ca3af);
      font-style: italic;
    }

    .definition-item .item-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }

    .definition-item .btn-accept { color: #16a34a; }
    .definition-item .btn-accept:hover { background: #dcfce7; }

    .definition-item .btn-manual { color: #3b82f6; }
    .definition-item .btn-manual:hover { background: #dbeafe; }

    .definition-item .btn-local { color: #8b5cf6; }
    .definition-item .btn-local:hover { background: #ede9fe; }

    .definition-item .btn-more { color: #6b7280; }
    .definition-item .btn-more:hover { background: #f3f4f6; }

    /* Empty state */
    .definition-population-panel.empty .panel-content {
      padding: 40px 20px;
      text-align: center;
    }

    .definition-population-panel .empty-state {
      color: var(--text-secondary, #6b7280);
    }

    .definition-population-panel .empty-state i {
      font-size: 48px;
      color: #16a34a;
      margin-bottom: 12px;
    }

    .definition-population-panel .empty-state p {
      margin: 0 0 4px;
      font-weight: 500;
      color: var(--text-primary, #1f2937);
    }
  `;

  document.head.appendChild(styles);
}

// ============================================================================
// SECTION IX: Singleton Instances & Exports
// ============================================================================

// Singleton instances
let _keySuggestionStore = null;
let _keySuggestionGenerator = null;
let _keySuggestionPanel = null;
let _definitionPopulationStore = null;
let _definitionPopulationPanel = null;

/**
 * Get or create the suggestion store singleton
 * @returns {KeySuggestionStore}
 */
function getKeySuggestionStore() {
  if (!_keySuggestionStore) {
    _keySuggestionStore = new KeySuggestionStore();
  }
  return _keySuggestionStore;
}

/**
 * Get or create the suggestion generator singleton
 * @returns {KeySuggestionGenerator}
 */
function getKeySuggestionGenerator() {
  if (!_keySuggestionGenerator) {
    _keySuggestionGenerator = new KeySuggestionGenerator({
      store: getKeySuggestionStore()
    });
  }
  return _keySuggestionGenerator;
}

/**
 * Initialize the suggestion panel
 * @param {Object} options - Panel options
 * @returns {KeySuggestionPanel}
 */
function initKeySuggestionPanel(options = {}) {
  if (!_keySuggestionPanel) {
    _keySuggestionPanel = new KeySuggestionPanel({
      store: getKeySuggestionStore(),
      ...options
    });
  } else if (options.container) {
    _keySuggestionPanel.container = options.container;
  }
  return _keySuggestionPanel;
}

/**
 * Generate suggestions for a source and optionally show the panel
 * @param {Object} source - Source object
 * @param {Object} options - Options
 * @returns {Promise<Array>} - Generated suggestions
 */
async function autoImportSuggestions(source, options = {}) {
  const generator = getKeySuggestionGenerator();
  const suggestions = await generator.generateForSource(source, options);

  if (suggestions.length > 0 && options.showPanel !== false) {
    // Inject styles if needed
    injectKeySuggestionStyles();

    // Initialize or show panel
    if (options.container) {
      const panel = initKeySuggestionPanel({
        container: options.container,
        workbench: options.workbench
      });
      panel.show(source.id);
    }
  }

  return suggestions;
}

// ============================================================================
// Definition Population Functions (New API)
// ============================================================================

/**
 * Get or create the definition population store singleton
 * @returns {DefinitionPopulationStore}
 */
function getDefinitionPopulationStore() {
  if (!_definitionPopulationStore) {
    _definitionPopulationStore = new DefinitionPopulationStore();
  }
  return _definitionPopulationStore;
}

/**
 * Initialize or get the definition population panel
 * @param {Object} options
 * @returns {DefinitionPopulationPanel}
 */
function initDefinitionPopulationPanel(options = {}) {
  if (!_definitionPopulationPanel) {
    _definitionPopulationPanel = new DefinitionPopulationPanel(options);
  }
  if (options.container) {
    _definitionPopulationPanel.container = options.container;
  }
  if (options.workbench) {
    _definitionPopulationPanel.workbench = options.workbench;
  }
  return _definitionPopulationPanel;
}

/**
 * Add stub definitions from import and optionally show the panel
 * This is the new entry point for the "keys in definitions by default" workflow
 *
 * @param {DefinitionSource[]} stubDefinitions - Stub definitions from import
 * @param {Object} options - Options
 * @returns {number} - Count of definitions added
 */
function addStubDefinitionsForPopulation(stubDefinitions, options = {}) {
  const store = getDefinitionPopulationStore();
  store.addDefinitions(stubDefinitions);

  if (stubDefinitions.length > 0 && options.showPanel !== false) {
    injectDefinitionPopulationStyles();

    if (options.container) {
      const panel = initDefinitionPopulationPanel({
        container: options.container,
        workbench: options.workbench
      });
      panel.show();
    }
  }

  return stubDefinitions.length;
}

/**
 * Create a badge showing count of definitions needing population
 * @param {Object} options
 * @returns {HTMLElement}
 */
function createDefinitionPopulationBadge(options = {}) {
  const store = getDefinitionPopulationStore();
  const count = store.getPopulationNeededCount();

  if (count === 0) return null;

  const badge = document.createElement('span');
  badge.className = 'definition-population-badge';
  badge.innerHTML = `
    <i class="ph ph-book-open"></i>
    <span class="count">${count}</span>
  `;
  badge.title = `${count} definitions need population`;

  // Apply inline styles for standalone use
  badge.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: #fef3c7;
    color: #92400e;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  `;

  if (options.onClick) {
    badge.addEventListener('click', options.onClick);
  }

  return badge;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.EOKeySuggestions = {
    // Legacy suggestion workflow
    KeySuggestionStore,
    KeySuggestionGenerator,
    KeySuggestionPanel,
    getKeySuggestionStore,
    getKeySuggestionGenerator,
    initKeySuggestionPanel,
    autoImportSuggestions,
    createSuggestionBadge,
    createSuggestionBanner,
    injectKeySuggestionStyles,

    // NEW: Definition population workflow (keys in definitions by default)
    DefinitionPopulationStore,
    DefinitionPopulationPanel,
    getDefinitionPopulationStore,
    initDefinitionPopulationPanel,
    addStubDefinitionsForPopulation,
    createDefinitionPopulationBadge,
    injectDefinitionPopulationStyles
  };
}

// Export for Node.js/ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Legacy suggestion workflow
    KeySuggestionStore,
    KeySuggestionGenerator,
    KeySuggestionPanel,
    getKeySuggestionStore,
    getKeySuggestionGenerator,
    initKeySuggestionPanel,
    autoImportSuggestions,
    createSuggestionBadge,
    createSuggestionBanner,
    injectKeySuggestionStyles,

    // NEW: Definition population workflow (keys in definitions by default)
    DefinitionPopulationStore,
    DefinitionPopulationPanel,
    getDefinitionPopulationStore,
    initDefinitionPopulationPanel,
    addStubDefinitionsForPopulation,
    createDefinitionPopulationBadge,
    injectDefinitionPopulationStyles
  };
}
