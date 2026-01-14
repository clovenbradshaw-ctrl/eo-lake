/**
 * EO Disambiguation Panel - UI for resolving ambiguous key meanings
 *
 * This module provides the UI components for:
 * 1. Showing disambiguation options when a key has multiple possible meanings
 * 2. Allowing users to select the correct meaning
 * 3. Creating new meanings when none of the options fit
 * 4. Learning from user decisions to improve future suggestions
 */

// ============================================================================
// SECTION I: Disambiguation Panel Component
// ============================================================================

/**
 * DisambiguationPanel - Shows when a key/term needs disambiguation
 *
 * Usage:
 * const panel = new DisambiguationPanel({
 *   container: document.getElementById('panel'),
 *   term: 'rate',
 *   candidates: [...],
 *   context: { siblingFields: [...], domain: '...' },
 *   onSelect: (definitionId, decision) => { ... },
 *   onCreateNew: (newDefinition) => { ... },
 *   onCancel: () => { ... }
 * });
 * panel.render();
 */
class DisambiguationPanel {
  constructor(options = {}) {
    this.container = options.container;
    this.term = options.term || '';
    this.candidates = options.candidates || [];
    this.context = options.context || {};
    this.bestMatch = options.bestMatch || null;
    this.confidence = options.confidence || 0;
    this.reasoning = options.reasoning || '';

    // Callbacks
    this.onSelect = options.onSelect || (() => {});
    this.onCreateNew = options.onCreateNew || (() => {});
    this.onCancel = options.onCancel || (() => {});

    // State
    this.selectedId = null;
    this.showCreateForm = false;
  }

  /**
   * Render the disambiguation panel
   */
  render() {
    if (!this.container) return;

    const contextCluesHtml = this._renderContextClues();
    const candidatesHtml = this._renderCandidates();
    const createFormHtml = this._renderCreateForm();

    this.container.innerHTML = `
      <div class="eo-disambiguation-panel">
        <div class="disambiguation-header">
          <div class="disambiguation-icon">
            <i class="ph ph-question"></i>
          </div>
          <div class="disambiguation-title">
            <h3>Disambiguate: "${this._escapeHtml(this.term)}"</h3>
            <p class="disambiguation-subtitle">This term has multiple possible meanings. Which applies here?</p>
          </div>
          <button class="disambiguation-close" title="Cancel">
            <i class="ph ph-x"></i>
          </button>
        </div>

        ${contextCluesHtml}

        <div class="disambiguation-candidates">
          <div class="candidates-header">
            <span class="candidates-label">Possible Meanings</span>
            <span class="candidates-count">${this.candidates.length} options</span>
          </div>
          ${candidatesHtml}
        </div>

        <div class="disambiguation-divider">
          <span>or</span>
        </div>

        <div class="disambiguation-create-section ${this.showCreateForm ? 'expanded' : ''}">
          <button class="create-toggle-btn" id="toggle-create-form">
            <i class="ph ph-plus-circle"></i>
            <span>Create New Meaning for "${this._escapeHtml(this.term)}"</span>
            <i class="ph ph-caret-down toggle-icon"></i>
          </button>
          ${createFormHtml}
        </div>

        <div class="disambiguation-footer">
          <button class="btn-secondary" id="btn-cancel-disambiguation">
            Cancel
          </button>
          <button class="btn-primary" id="btn-confirm-disambiguation" ${this.selectedId ? '' : 'disabled'}>
            <i class="ph ph-check"></i>
            Confirm Selection
          </button>
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  /**
   * Render context clues section
   */
  _renderContextClues() {
    const clues = [];

    if (this.context.siblingFields?.length) {
      clues.push({
        icon: 'ph-columns',
        label: 'Sibling fields',
        value: this.context.siblingFields.slice(0, 5).join(', ')
      });
    }

    if (this.context.domain) {
      clues.push({
        icon: 'ph-folder-simple',
        label: 'Domain',
        value: this.context.domain
      });
    }

    if (this.context.sampleValues?.length) {
      const samples = this.context.sampleValues.slice(0, 3).map(v => String(v)).join(', ');
      clues.push({
        icon: 'ph-list-bullets',
        label: 'Sample values',
        value: samples
      });
    }

    if (clues.length === 0) {
      return '';
    }

    return `
      <div class="context-clues">
        <div class="context-clues-header">
          <i class="ph ph-lightbulb"></i>
          <span>Context clues detected:</span>
        </div>
        <div class="context-clues-list">
          ${clues.map(clue => `
            <div class="context-clue">
              <i class="ph ${clue.icon}"></i>
              <span class="clue-label">${clue.label}:</span>
              <span class="clue-value">${this._escapeHtml(clue.value)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render candidate options
   */
  _renderCandidates() {
    if (this.candidates.length === 0) {
      return `
        <div class="no-candidates">
          <i class="ph ph-magnifying-glass"></i>
          <p>No existing definitions match this term.</p>
          <p class="hint">Create a new definition below.</p>
        </div>
      `;
    }

    return this.candidates.map((candidate, index) => {
      const isSelected = this.selectedId === candidate.id;
      const isBestMatch = this.bestMatch?.id === candidate.id;
      const score = candidate.score?.total || 0;
      const scorePercent = Math.round(score * 100);

      return `
        <div class="candidate-option ${isSelected ? 'selected' : ''} ${isBestMatch ? 'best-match' : ''}"
             data-candidate-id="${candidate.id}">
          <div class="candidate-radio">
            <input type="radio" name="disambiguation" id="cand_${candidate.id}"
                   value="${candidate.id}" ${isSelected ? 'checked' : ''}>
            <label for="cand_${candidate.id}"></label>
          </div>
          <div class="candidate-content">
            <div class="candidate-header">
              <span class="candidate-label">${this._escapeHtml(candidate.label || candidate.term)}</span>
              ${candidate.role ? `<span class="candidate-role role-${candidate.role}">${candidate.role}</span>` : ''}
              ${isBestMatch ? '<span class="best-match-badge"><i class="ph ph-star"></i> Best Match</span>' : ''}
            </div>
            <div class="candidate-definition">
              ${this._escapeHtml(candidate.definition || 'No definition text available')}
            </div>
            <div class="candidate-meta">
              ${candidate.authority ? `
                <span class="candidate-authority">
                  <i class="ph ph-buildings"></i> ${this._escapeHtml(candidate.authority)}
                </span>
              ` : ''}
              ${candidate.meaningUri ? `
                <span class="candidate-uri" title="${this._escapeHtml(candidate.meaningUri)}">
                  <i class="ph ph-link"></i> Linked URI
                </span>
              ` : ''}
              ${candidate.usageCount > 0 ? `
                <span class="candidate-usage">
                  <i class="ph ph-chart-line"></i> Used by ${candidate.usageCount} field${candidate.usageCount > 1 ? 's' : ''}
                </span>
              ` : ''}
            </div>
            ${candidate.score ? `
              <div class="candidate-score">
                <div class="score-bar">
                  <div class="score-fill" style="width: ${scorePercent}%"></div>
                </div>
                <span class="score-label">${scorePercent}% match</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Render the create new definition form
   */
  _renderCreateForm() {
    if (!this.showCreateForm) {
      return `<div class="create-form-container" style="display: none;"></div>`;
    }

    const roles = [
      { id: 'quantity', label: 'Quantity', desc: 'Measurable value (count, amount, measurement)' },
      { id: 'property', label: 'Property', desc: 'Descriptive attribute (color, status, type)' },
      { id: 'identifier', label: 'Identifier', desc: 'Unique key (ID, code, reference)' },
      { id: 'temporal', label: 'Temporal', desc: 'Time-related (date, timestamp, period)' },
      { id: 'spatial', label: 'Spatial', desc: 'Location-related (address, coordinates)' },
      { id: 'categorical', label: 'Categorical', desc: 'Classification (category, tag, group)' },
      { id: 'textual', label: 'Textual', desc: 'Free-form text (name, description, notes)' }
    ];

    return `
      <div class="create-form-container">
        <div class="create-form">
          <div class="form-group">
            <label for="new-def-label">Label</label>
            <input type="text" id="new-def-label" class="form-input"
                   placeholder="Human-readable name"
                   value="${this._escapeHtml(this._formatAsLabel(this.term))}">
          </div>

          <div class="form-group">
            <label for="new-def-definition">Definition</label>
            <textarea id="new-def-definition" class="form-input" rows="3"
                      placeholder="What does this term mean in your context?"></textarea>
          </div>

          <div class="form-group">
            <label>Role</label>
            <div class="role-options">
              ${roles.map(role => `
                <label class="role-option">
                  <input type="radio" name="new-def-role" value="${role.id}">
                  <span class="role-label">${role.label}</span>
                  <span class="role-desc">${role.desc}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="form-group">
            <label for="new-def-domain">Domain Hints (comma-separated)</label>
            <input type="text" id="new-def-domain" class="form-input"
                   placeholder="e.g., finance, accounting, banking"
                   value="${this._escapeHtml(this.context.domain || '')}">
          </div>

          <div class="form-group">
            <label for="new-def-siblings">Related Fields (comma-separated)</label>
            <input type="text" id="new-def-siblings" class="form-input"
                   placeholder="e.g., principal, term, payment"
                   value="${this._escapeHtml(this.context.siblingFields?.slice(0, 5).join(', ') || '')}">
          </div>

          <div class="form-actions">
            <button class="btn-secondary" id="btn-cancel-create">Cancel</button>
            <button class="btn-primary" id="btn-create-definition">
              <i class="ph ph-plus"></i> Create & Select
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  _attachEventListeners() {
    // Close button
    this.container.querySelector('.disambiguation-close')?.addEventListener('click', () => {
      this.onCancel();
    });

    // Cancel button
    this.container.querySelector('#btn-cancel-disambiguation')?.addEventListener('click', () => {
      this.onCancel();
    });

    // Candidate selection
    this.container.querySelectorAll('.candidate-option').forEach(option => {
      option.addEventListener('click', (e) => {
        if (e.target.closest('.candidate-uri')) return; // Don't select when clicking URI link

        const id = option.dataset.candidateId;
        this._selectCandidate(id);
      });
    });

    // Radio button change
    this.container.querySelectorAll('input[name="disambiguation"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this._selectCandidate(e.target.value);
      });
    });

    // Confirm button
    this.container.querySelector('#btn-confirm-disambiguation')?.addEventListener('click', () => {
      if (this.selectedId) {
        const candidate = this.candidates.find(c => c.id === this.selectedId);
        this.onSelect(this.selectedId, {
          term: this.term,
          selectedDefinitionId: this.selectedId,
          selectedLabel: candidate?.label || candidate?.term,
          method: 'user_selection',
          context: this.context,
          alternatives: this.candidates.filter(c => c.id !== this.selectedId).map(c => c.id)
        });
      }
    });

    // Toggle create form
    this.container.querySelector('#toggle-create-form')?.addEventListener('click', () => {
      this.showCreateForm = !this.showCreateForm;
      this.render();
    });

    // Cancel create
    this.container.querySelector('#btn-cancel-create')?.addEventListener('click', () => {
      this.showCreateForm = false;
      this.render();
    });

    // Create definition
    this.container.querySelector('#btn-create-definition')?.addEventListener('click', () => {
      this._createNewDefinition();
    });
  }

  /**
   * Select a candidate
   */
  _selectCandidate(id) {
    this.selectedId = id;

    // Update UI
    this.container.querySelectorAll('.candidate-option').forEach(option => {
      option.classList.toggle('selected', option.dataset.candidateId === id);
      const radio = option.querySelector('input[type="radio"]');
      if (radio) radio.checked = option.dataset.candidateId === id;
    });

    // Enable confirm button
    const confirmBtn = this.container.querySelector('#btn-confirm-disambiguation');
    if (confirmBtn) confirmBtn.disabled = false;
  }

  /**
   * Create a new definition from the form
   */
  _createNewDefinition() {
    const label = this.container.querySelector('#new-def-label')?.value?.trim();
    const definition = this.container.querySelector('#new-def-definition')?.value?.trim();
    const role = this.container.querySelector('input[name="new-def-role"]:checked')?.value;
    const domainHints = this.container.querySelector('#new-def-domain')?.value
      ?.split(',').map(s => s.trim()).filter(Boolean) || [];
    const siblingPatterns = this.container.querySelector('#new-def-siblings')?.value
      ?.split(',').map(s => s.trim()).filter(Boolean) || [];

    if (!label) {
      this._showError('Please enter a label for the definition');
      return;
    }

    const newDefinition = {
      term: this.term,
      label,
      definition,
      role: role || 'property',
      contextSignature: {
        domainHints,
        siblingPatterns,
        valuePatterns: [],
        unitHints: []
      },
      createdAt: new Date().toISOString(),
      createdBy: 'user',
      method: 'user_creation'
    };

    this.onCreateNew(newDefinition);
  }

  /**
   * Show error message
   */
  _showError(message) {
    const existing = this.container.querySelector('.form-error');
    if (existing) existing.remove();

    const error = document.createElement('div');
    error.className = 'form-error';
    error.innerHTML = `<i class="ph ph-warning"></i> ${this._escapeHtml(message)}`;

    const form = this.container.querySelector('.create-form');
    if (form) {
      form.insertBefore(error, form.firstChild);
      setTimeout(() => error.remove(), 3000);
    }
  }

  /**
   * Format field name as label
   */
  _formatAsLabel(name) {
    return name
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }

  /**
   * Escape HTML
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ============================================================================
// SECTION II: Inline Disambiguation Widget
// ============================================================================

/**
 * InlineDisambiguationWidget - Compact widget for field-level disambiguation
 * Shows as a small indicator next to field names when disambiguation is needed
 */
class InlineDisambiguationWidget {
  constructor(options = {}) {
    this.container = options.container;
    this.fieldName = options.fieldName;
    this.currentDefinition = options.currentDefinition;
    this.disambiguationStatus = options.disambiguationStatus || {};
    this.onTriggerDisambiguation = options.onTriggerDisambiguation || (() => {});
  }

  render() {
    if (!this.container) return;

    const needsDisambiguation = this.disambiguationStatus.needsDisambiguation;
    const hasDefinition = !!this.currentDefinition;

    let statusIcon, statusClass, statusTitle;

    if (!hasDefinition) {
      statusIcon = 'ph-question';
      statusClass = 'undefined';
      statusTitle = 'No definition linked - click to define';
    } else if (needsDisambiguation) {
      statusIcon = 'ph-warning-circle';
      statusClass = 'ambiguous';
      statusTitle = `Ambiguous: ${this.disambiguationStatus.candidates?.length || 0} possible meanings`;
    } else if (this.currentDefinition.status === 'stub') {
      statusIcon = 'ph-circle-dashed';
      statusClass = 'stub';
      statusTitle = 'Stub definition - needs population';
    } else {
      statusIcon = 'ph-check-circle';
      statusClass = 'defined';
      statusTitle = `Linked to: ${this.currentDefinition.label || this.currentDefinition.term}`;
    }

    this.container.innerHTML = `
      <button class="inline-disambiguation-btn ${statusClass}" title="${statusTitle}">
        <i class="ph ${statusIcon}"></i>
      </button>
    `;

    this.container.querySelector('.inline-disambiguation-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onTriggerDisambiguation({
        fieldName: this.fieldName,
        currentDefinition: this.currentDefinition,
        disambiguationStatus: this.disambiguationStatus
      });
    });
  }
}

// ============================================================================
// SECTION III: Batch Disambiguation Panel
// ============================================================================

/**
 * BatchDisambiguationPanel - Handle multiple fields needing disambiguation at once
 * Useful after importing data with many ambiguous fields
 */
class BatchDisambiguationPanel {
  constructor(options = {}) {
    this.container = options.container;
    this.fields = options.fields || [];  // Array of { fieldName, candidates, context }
    this.workbench = options.workbench;
    this.disambiguationEngine = options.disambiguationEngine;

    this.onComplete = options.onComplete || (() => {});
    this.onCancel = options.onCancel || (() => {});

    // State
    this.decisions = new Map();  // fieldName -> selected definition
    this.currentIndex = 0;
  }

  render() {
    if (!this.container) return;

    const ambiguousFields = this.fields.filter(f => f.candidates?.length > 1);
    const progress = this.decisions.size;
    const total = ambiguousFields.length;

    this.container.innerHTML = `
      <div class="batch-disambiguation-panel">
        <div class="batch-header">
          <h2><i class="ph ph-list-checks"></i> Batch Disambiguation</h2>
          <p>${total} field${total !== 1 ? 's' : ''} need${total === 1 ? 's' : ''} disambiguation</p>
          <div class="batch-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${(progress / total) * 100}%"></div>
            </div>
            <span class="progress-label">${progress} of ${total} resolved</span>
          </div>
        </div>

        <div class="batch-fields-list">
          ${ambiguousFields.map((field, index) => this._renderFieldItem(field, index)).join('')}
        </div>

        <div class="batch-footer">
          <button class="btn-secondary" id="btn-cancel-batch">Cancel</button>
          <button class="btn-secondary" id="btn-auto-resolve">
            <i class="ph ph-magic-wand"></i> Auto-resolve High Confidence
          </button>
          <button class="btn-primary" id="btn-apply-batch" ${progress < total ? 'disabled' : ''}>
            <i class="ph ph-check"></i> Apply All (${progress}/${total})
          </button>
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  _renderFieldItem(field, index) {
    const decision = this.decisions.get(field.fieldName);
    const isResolved = !!decision;
    const candidates = field.candidates || [];
    const bestMatch = candidates[0];

    return `
      <div class="batch-field-item ${isResolved ? 'resolved' : ''}" data-field="${this._escapeHtml(field.fieldName)}">
        <div class="field-item-header">
          <div class="field-item-status">
            <i class="ph ${isResolved ? 'ph-check-circle' : 'ph-circle'}"></i>
          </div>
          <div class="field-item-name">
            <span class="field-name">${this._escapeHtml(field.fieldName)}</span>
            ${isResolved ? `
              <span class="field-resolution">
                → ${this._escapeHtml(decision.label || decision.term)}
              </span>
            ` : `
              <span class="field-candidates-count">
                ${candidates.length} possible meaning${candidates.length !== 1 ? 's' : ''}
              </span>
            `}
          </div>
          <div class="field-item-actions">
            ${isResolved ? `
              <button class="btn-icon" data-action="change" title="Change selection">
                <i class="ph ph-pencil"></i>
              </button>
            ` : `
              <button class="btn-icon" data-action="resolve" title="Resolve now">
                <i class="ph ph-arrow-right"></i>
              </button>
            `}
          </div>
        </div>
        ${!isResolved && bestMatch ? `
          <div class="field-item-suggestion">
            <span class="suggestion-label">Best match:</span>
            <span class="suggestion-value">${this._escapeHtml(bestMatch.label || bestMatch.term)}</span>
            ${bestMatch.score ? `
              <span class="suggestion-score">${Math.round(bestMatch.score.total * 100)}%</span>
            ` : ''}
            <button class="btn-link accept-suggestion" data-field="${this._escapeHtml(field.fieldName)}" data-def-id="${bestMatch.id}">
              Accept
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  _attachEventListeners() {
    // Cancel
    this.container.querySelector('#btn-cancel-batch')?.addEventListener('click', () => {
      this.onCancel();
    });

    // Auto-resolve
    this.container.querySelector('#btn-auto-resolve')?.addEventListener('click', () => {
      this._autoResolveHighConfidence();
    });

    // Apply all
    this.container.querySelector('#btn-apply-batch')?.addEventListener('click', () => {
      this.onComplete(Array.from(this.decisions.entries()).map(([fieldName, definition]) => ({
        fieldName,
        definitionId: definition.id,
        definition
      })));
    });

    // Accept suggestion
    this.container.querySelectorAll('.accept-suggestion').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fieldName = btn.dataset.field;
        const defId = btn.dataset.defId;
        const field = this.fields.find(f => f.fieldName === fieldName);
        const definition = field?.candidates?.find(c => c.id === defId);
        if (definition) {
          this.decisions.set(fieldName, definition);
          this.render();
        }
      });
    });

    // Resolve individual
    this.container.querySelectorAll('[data-action="resolve"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fieldName = btn.closest('.batch-field-item')?.dataset.field;
        this._showFieldDisambiguation(fieldName);
      });
    });

    // Change selection
    this.container.querySelectorAll('[data-action="change"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fieldName = btn.closest('.batch-field-item')?.dataset.field;
        this._showFieldDisambiguation(fieldName);
      });
    });
  }

  _autoResolveHighConfidence() {
    for (const field of this.fields) {
      if (this.decisions.has(field.fieldName)) continue;

      const bestMatch = field.candidates?.[0];
      if (bestMatch?.score?.total >= 0.8) {
        this.decisions.set(field.fieldName, bestMatch);
      }
    }
    this.render();
  }

  _showFieldDisambiguation(fieldName) {
    const field = this.fields.find(f => f.fieldName === fieldName);
    if (!field) return;

    // Create modal for individual disambiguation
    const modal = document.createElement('div');
    modal.className = 'disambiguation-modal';
    modal.innerHTML = `
      <div class="disambiguation-modal-overlay"></div>
      <div class="disambiguation-modal-content"></div>
    `;
    document.body.appendChild(modal);

    const panel = new DisambiguationPanel({
      container: modal.querySelector('.disambiguation-modal-content'),
      term: field.fieldName,
      candidates: field.candidates,
      context: field.context,
      bestMatch: field.candidates[0],
      confidence: field.candidates[0]?.score?.total || 0,
      onSelect: (definitionId, decision) => {
        const definition = field.candidates.find(c => c.id === definitionId);
        if (definition) {
          this.decisions.set(fieldName, definition);
        }
        modal.remove();
        this.render();
      },
      onCreateNew: (newDef) => {
        // Handle new definition creation
        this.decisions.set(fieldName, { ...newDef, id: `new_${Date.now()}` });
        modal.remove();
        this.render();
      },
      onCancel: () => {
        modal.remove();
      }
    });
    panel.render();

    // Close on overlay click
    modal.querySelector('.disambiguation-modal-overlay')?.addEventListener('click', () => {
      modal.remove();
    });
  }

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ============================================================================
// SECTION IV: CSS Styles
// ============================================================================

const DISAMBIGUATION_STYLES = `
/* Disambiguation Panel */
.eo-disambiguation-panel {
  background: var(--bg-primary, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.disambiguation-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.disambiguation-icon {
  width: 40px;
  height: 40px;
  background: var(--warning-bg, #fff8e6);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.disambiguation-icon i {
  font-size: 20px;
  color: var(--warning-color, #f5a623);
}

.disambiguation-title {
  flex: 1;
}

.disambiguation-title h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
}

.disambiguation-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #666);
}

.disambiguation-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--text-secondary, #666);
}

.disambiguation-close:hover {
  color: var(--text-primary, #333);
}

/* Context Clues */
.context-clues {
  background: var(--bg-secondary, #f5f5f5);
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.context-clues-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #666);
  margin-bottom: 8px;
}

.context-clues-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.context-clue {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.context-clue i {
  color: var(--text-secondary, #666);
}

.clue-label {
  color: var(--text-secondary, #666);
}

.clue-value {
  color: var(--text-primary, #333);
}

/* Candidates */
.disambiguation-candidates {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.candidates-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.candidates-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary, #666);
}

.candidates-count {
  font-size: 12px;
  color: var(--text-secondary, #666);
}

.candidate-option {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.candidate-option:hover {
  border-color: var(--primary-color, #007bff);
  background: var(--primary-bg, #f0f7ff);
}

.candidate-option.selected {
  border-color: var(--primary-color, #007bff);
  background: var(--primary-bg, #f0f7ff);
  box-shadow: 0 0 0 2px var(--primary-light, rgba(0, 123, 255, 0.2));
}

.candidate-option.best-match {
  border-color: var(--success-color, #28a745);
}

.candidate-radio {
  flex-shrink: 0;
  padding-top: 2px;
}

.candidate-content {
  flex: 1;
  min-width: 0;
}

.candidate-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.candidate-label {
  font-weight: 600;
  font-size: 14px;
}

.candidate-role {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-secondary, #f0f0f0);
  color: var(--text-secondary, #666);
}

.best-match-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--success-bg, #d4edda);
  color: var(--success-color, #28a745);
  display: flex;
  align-items: center;
  gap: 4px;
}

.candidate-definition {
  font-size: 13px;
  color: var(--text-secondary, #666);
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.candidate-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--text-tertiary, #999);
}

.candidate-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.candidate-score {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.score-bar {
  flex: 1;
  height: 4px;
  background: var(--bg-secondary, #e0e0e0);
  border-radius: 2px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  background: var(--primary-color, #007bff);
  transition: width 0.3s ease;
}

.score-label {
  font-size: 11px;
  color: var(--text-secondary, #666);
}

/* Divider */
.disambiguation-divider {
  display: flex;
  align-items: center;
  padding: 0 16px;
}

.disambiguation-divider::before,
.disambiguation-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color, #e0e0e0);
}

.disambiguation-divider span {
  padding: 0 12px;
  font-size: 12px;
  color: var(--text-secondary, #666);
}

/* Create Section */
.disambiguation-create-section {
  padding: 0 16px 16px;
}

.create-toggle-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: none;
  border: 1px dashed var(--border-color, #ccc);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary, #666);
  transition: all 0.15s ease;
}

.create-toggle-btn:hover {
  border-color: var(--primary-color, #007bff);
  color: var(--primary-color, #007bff);
}

.create-toggle-btn .toggle-icon {
  margin-left: auto;
  transition: transform 0.2s ease;
}

.disambiguation-create-section.expanded .toggle-icon {
  transform: rotate(180deg);
}

.create-form-container {
  margin-top: 12px;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #666);
  margin-bottom: 4px;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 6px;
  font-size: 13px;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color, #007bff);
  box-shadow: 0 0 0 2px var(--primary-light, rgba(0, 123, 255, 0.2));
}

.role-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.role-option {
  display: flex;
  flex-direction: column;
  padding: 8px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.role-option:hover {
  border-color: var(--primary-color, #007bff);
}

.role-option input {
  display: none;
}

.role-option input:checked + .role-label {
  color: var(--primary-color, #007bff);
}

.role-option input:checked ~ .role-desc {
  color: var(--text-primary, #333);
}

.role-label {
  font-weight: 500;
  font-size: 13px;
}

.role-desc {
  font-size: 11px;
  color: var(--text-secondary, #999);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.form-error {
  padding: 8px 12px;
  background: var(--error-bg, #fdf2f2);
  border: 1px solid var(--error-border, #f5c6cb);
  border-radius: 6px;
  color: var(--error-color, #dc3545);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Footer */
.disambiguation-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border-color, #e0e0e0);
  background: var(--bg-secondary, #f8f8f8);
}

/* Buttons */
.btn-primary, .btn-secondary {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.btn-primary {
  background: var(--primary-color, #007bff);
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-dark, #0056b3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: var(--text-primary, #333);
  border: 1px solid var(--border-color, #ccc);
}

.btn-secondary:hover {
  background: var(--bg-secondary, #f5f5f5);
}

.btn-link {
  background: none;
  border: none;
  color: var(--primary-color, #007bff);
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-icon {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-secondary, #666);
  border-radius: 4px;
}

.btn-icon:hover {
  background: var(--bg-secondary, #f0f0f0);
  color: var(--text-primary, #333);
}

/* Inline Widget */
.inline-disambiguation-btn {
  background: none;
  border: none;
  padding: 2px 4px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.inline-disambiguation-btn.undefined {
  color: var(--warning-color, #f5a623);
}

.inline-disambiguation-btn.ambiguous {
  color: var(--error-color, #dc3545);
}

.inline-disambiguation-btn.stub {
  color: var(--text-secondary, #999);
}

.inline-disambiguation-btn.defined {
  color: var(--success-color, #28a745);
}

.inline-disambiguation-btn:hover {
  background: var(--bg-secondary, #f0f0f0);
}

/* Batch Panel */
.batch-disambiguation-panel {
  background: var(--bg-primary, #fff);
  border-radius: 8px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.batch-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.batch-header h2 {
  margin: 0 0 8px 0;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-header p {
  margin: 0 0 12px 0;
  color: var(--text-secondary, #666);
}

.batch-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-secondary, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color, #007bff);
  transition: width 0.3s ease;
}

.progress-label {
  font-size: 12px;
  color: var(--text-secondary, #666);
}

.batch-fields-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
}

.batch-field-item {
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  margin-bottom: 8px;
  overflow: hidden;
}

.batch-field-item.resolved {
  border-color: var(--success-color, #28a745);
  background: var(--success-bg, #f0fff4);
}

.field-item-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
}

.field-item-status i {
  font-size: 18px;
  color: var(--text-secondary, #999);
}

.batch-field-item.resolved .field-item-status i {
  color: var(--success-color, #28a745);
}

.field-item-name {
  flex: 1;
}

.field-name {
  font-weight: 500;
}

.field-resolution {
  font-size: 12px;
  color: var(--success-color, #28a745);
  margin-left: 8px;
}

.field-candidates-count {
  font-size: 12px;
  color: var(--text-secondary, #666);
  margin-left: 8px;
}

.field-item-suggestion {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary, #f8f8f8);
  border-top: 1px solid var(--border-color, #e0e0e0);
  font-size: 12px;
}

.suggestion-label {
  color: var(--text-secondary, #666);
}

.suggestion-value {
  font-weight: 500;
}

.suggestion-score {
  background: var(--primary-bg, #e3f2fd);
  color: var(--primary-color, #007bff);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.accept-suggestion {
  margin-left: auto;
}

.batch-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border-color, #e0e0e0);
}

/* Modal */
.disambiguation-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.disambiguation-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.disambiguation-modal-content {
  position: relative;
  z-index: 1;
  width: 90%;
  max-width: 600px;
}

/* No candidates */
.no-candidates {
  text-align: center;
  padding: 32px;
  color: var(--text-secondary, #666);
}

.no-candidates i {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.no-candidates p {
  margin: 0 0 4px 0;
}

.no-candidates .hint {
  font-size: 12px;
  color: var(--text-tertiary, #999);
}
`;

// Inject styles
function injectDisambiguationStyles() {
  if (typeof document !== 'undefined' && !document.getElementById('eo-disambiguation-styles')) {
    const style = document.createElement('style');
    style.id = 'eo-disambiguation-styles';
    style.textContent = DISAMBIGUATION_STYLES;
    document.head.appendChild(style);
  }
}

// ============================================================================
// SECTION V: Exports
// ============================================================================

// Export for browser
if (typeof window !== 'undefined') {
  window.EO = window.EO || {};
  window.EO.DisambiguationPanel = DisambiguationPanel;
  window.EO.InlineDisambiguationWidget = InlineDisambiguationWidget;
  window.EO.BatchDisambiguationPanel = BatchDisambiguationPanel;
  window.EO.injectDisambiguationStyles = injectDisambiguationStyles;

  // Auto-inject styles
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectDisambiguationStyles);
  } else {
    injectDisambiguationStyles();
  }
}

// Export for Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DisambiguationPanel,
    InlineDisambiguationWidget,
    BatchDisambiguationPanel,
    DISAMBIGUATION_STYLES
  };
}
