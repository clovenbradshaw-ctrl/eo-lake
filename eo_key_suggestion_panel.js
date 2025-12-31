/**
 * EO Key Suggestion Panel - Auto-Import Key Definition Suggestions
 *
 * Generates and presents key definition suggestions for imported/sample data.
 * Allows users to approve or reject suggestions before applying them.
 *
 * Features:
 * - Automatic suggestion generation based on field names and types
 * - Batch approval/rejection interface
 * - Integration with semantic suggestion engine
 * - Pending suggestions queue with persistence
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
   * Render a single suggestion item
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

    return `
      <div class="suggestion-item" data-field-id="${suggestion.fieldId}" data-source-id="${sourceId}">
        <div class="item-main">
          <div class="item-icon">
            <i class="ph ${roleIcon}"></i>
          </div>
          <div class="item-content">
            <div class="item-header">
              <span class="field-name">${suggestion.fieldName}</span>
              <span class="confidence ${confidenceClass}">${confidence}%</span>
            </div>
            <div class="item-details">
              <span class="role">${def.role || 'property'}</span>
              <span class="type">${suggestion.fieldType}</span>
              ${suggestion.sampleValues?.length > 0 ? `
                <span class="samples" title="${suggestion.sampleValues.join(', ')}">
                  e.g. "${suggestion.sampleValues[0]}"
                </span>
              ` : ''}
            </div>
            <div class="item-description">${def.description || ''}</div>
          </div>
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

    /* Suggestion Item */
    .suggestion-item {
      display: flex;
      align-items: flex-start;
      padding: 12px;
      margin: 4px 0;
      border-radius: 6px;
      background: var(--bg-primary, #ffffff);
      border: 1px solid var(--border-color, #e5e7eb);
      transition: all 0.2s ease;
    }

    .suggestion-item:hover {
      border-color: var(--primary-color, #3b82f6);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
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

    .suggestion-item .item-main {
      display: flex;
      gap: 12px;
      flex: 1;
    }

    .suggestion-item .item-icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: var(--bg-secondary, #f3f4f6);
      color: var(--primary-color, #3b82f6);
      flex-shrink: 0;
    }

    .suggestion-item .item-icon i {
      font-size: 18px;
    }

    .suggestion-item .item-content {
      flex: 1;
      min-width: 0;
    }

    .suggestion-item .item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .suggestion-item .field-name {
      font-weight: 600;
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

    .suggestion-item .item-details {
      display: flex;
      gap: 8px;
      font-size: 12px;
      color: var(--text-secondary, #6b7280);
      margin-bottom: 4px;
    }

    .suggestion-item .item-details span {
      padding: 2px 6px;
      background: var(--bg-secondary, #f3f4f6);
      border-radius: 4px;
    }

    .suggestion-item .item-details .samples {
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .suggestion-item .item-description {
      font-size: 12px;
      color: var(--text-secondary, #6b7280);
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
// SECTION VI: Singleton Instances & Exports
// ============================================================================

// Singleton instances
let _keySuggestionStore = null;
let _keySuggestionGenerator = null;
let _keySuggestionPanel = null;

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

// Export for browser
if (typeof window !== 'undefined') {
  window.EOKeySuggestions = {
    KeySuggestionStore,
    KeySuggestionGenerator,
    KeySuggestionPanel,
    getKeySuggestionStore,
    getKeySuggestionGenerator,
    initKeySuggestionPanel,
    autoImportSuggestions,
    createSuggestionBadge,
    createSuggestionBanner,
    injectKeySuggestionStyles
  };
}

// Export for Node.js/ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    KeySuggestionStore,
    KeySuggestionGenerator,
    KeySuggestionPanel,
    getKeySuggestionStore,
    getKeySuggestionGenerator,
    initKeySuggestionPanel,
    autoImportSuggestions,
    createSuggestionBadge,
    createSuggestionBanner,
    injectKeySuggestionStyles
  };
}
