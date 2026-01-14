/**
 * EO Interpretation Panel - Column Interpretation UI
 *
 * Provides UI for viewing and editing column interpretations:
 * - View current bindings for a dataset
 * - Search for semantic suggestions
 * - Bind columns to semantic URIs
 * - Create new semantic definitions
 */

// ============================================================================
// Interpretation Panel Class
// ============================================================================

class InterpretationPanel {
  /**
   * @param {Object} options
   * @param {string} options.datasetId - Dataset being interpreted
   * @param {string[]} options.columns - Available columns
   * @param {HTMLElement} options.container - Container element
   */
  constructor(options = {}) {
    this.datasetId = options.datasetId;
    this.columns = options.columns || [];
    this.container = options.container;

    // Get stores
    this.bindingStore = window.EOInterpretationBinding?.getBindingStore();
    this.semanticRegistry = window.EOSchemaSemantic?.getSemanticRegistry();
    this.suggestionEngine = window.EOSemanticSuggestions?.getSuggestionEngine();

    // State
    this.currentBinding = null;
    this.searchResults = new Map();

    // Connect suggestion engine to registry
    if (this.suggestionEngine && this.semanticRegistry) {
      this.suggestionEngine.setRegistry(this.semanticRegistry);
    }
  }

  /**
   * Render the panel
   */
  render() {
    if (!this.container) return;

    // Load current binding
    this.currentBinding = this.bindingStore?.getActiveForDataset(this.datasetId);

    const html = `
      <div class="interpretation-panel">
        <div class="interpretation-header">
          <h3>
            <i class="ph ph-link"></i>
            Column Interpretation
          </h3>
          <button class="btn-icon" id="interp-close-btn" title="Close">
            <i class="ph ph-x"></i>
          </button>
        </div>

        <div class="interpretation-stats">
          <span class="stat">
            <i class="ph ph-database"></i>
            ${this.datasetId || 'Unknown'}
          </span>
          <span class="stat">
            <i class="ph ph-columns"></i>
            ${this.getBoundCount()}/${this.columns.length} columns bound
          </span>
        </div>

        <div class="interpretation-columns" id="interp-columns">
          ${this.renderColumns()}
        </div>

        <div class="interpretation-context">
          <h4>Interpretation Context</h4>
          ${this.renderContext()}
        </div>

        <div class="interpretation-actions">
          <button class="btn btn-primary" id="interp-save-btn">
            <i class="ph ph-floppy-disk"></i>
            Save Interpretation
          </button>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
  }

  /**
   * Get count of bound columns
   */
  getBoundCount() {
    if (!this.currentBinding) return 0;
    return this.currentBinding.bindings?.length || 0;
  }

  /**
   * Render column list
   */
  renderColumns() {
    return this.columns.map(column => {
      const binding = this.currentBinding?.getBindingForColumn(column);
      const semantic = binding ? this.semanticRegistry?.get(binding.semantic_uri) : null;

      if (binding && semantic) {
        return `
          <div class="column-binding" data-column="${column}">
            <div class="column-header">
              <span class="column-name">${column}</span>
              <span class="binding-status bound">
                <i class="ph ph-check-circle"></i> Bound
              </span>
            </div>
            <div class="binding-info">
              <div class="semantic-label">${semantic.canonical_label || semantic.term}</div>
              <div class="semantic-meta">
                <span class="confidence">${binding.confidence}</span>
                <span class="jurisdiction">${semantic.jurisdiction || 'unspecified'}</span>
              </div>
              <div class="semantic-definition">${semantic.definition}</div>
            </div>
            <div class="binding-actions">
              <button class="btn-sm" data-action="edit" data-column="${column}">
                <i class="ph ph-pencil"></i> Edit
              </button>
              <button class="btn-sm btn-danger" data-action="unbind" data-column="${column}">
                <i class="ph ph-x"></i> Unbind
              </button>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="column-binding unbound" data-column="${column}">
            <div class="column-header">
              <span class="column-name">${column}</span>
              <span class="binding-status unbound">
                <i class="ph ph-question"></i> Unbound
              </span>
            </div>
            <div class="suggestion-search">
              <input type="text" class="search-input"
                placeholder="Search for meaning..."
                data-column="${column}"
                value="${column}">
              <button class="btn-sm btn-primary" data-action="search" data-column="${column}">
                <i class="ph ph-magnifying-glass"></i>
              </button>
            </div>
            <div class="suggestion-results" id="results-${column}"></div>
          </div>
        `;
      }
    }).join('');
  }

  /**
   * Render interpretation context
   */
  renderContext() {
    const binding = this.currentBinding;
    const agent = binding?.agent || this.getCurrentAgent();

    return `
      <div class="context-field">
        <label>Agent</label>
        <input type="text" id="context-agent" value="${agent}" readonly>
      </div>
      <div class="context-field">
        <label>Jurisdiction</label>
        <input type="text" id="context-jurisdiction"
          value="${binding?.jurisdiction || ''}"
          placeholder="e.g., WMO, ISO, internal">
      </div>
      <div class="context-field">
        <label>Scale</label>
        <select id="context-scale">
          <option value="">Select scale...</option>
          <option value="site" ${binding?.scale === 'site' ? 'selected' : ''}>Site</option>
          <option value="region" ${binding?.scale === 'region' ? 'selected' : ''}>Region</option>
          <option value="global" ${binding?.scale === 'global' ? 'selected' : ''}>Global</option>
          <option value="system" ${binding?.scale === 'system' ? 'selected' : ''}>System</option>
        </select>
      </div>
      <div class="context-field">
        <label>Timeframe</label>
        <select id="context-timeframe">
          <option value="">Select timeframe...</option>
          <option value="instantaneous" ${binding?.timeframe === 'instantaneous' ? 'selected' : ''}>Instantaneous</option>
          <option value="period" ${binding?.timeframe === 'period' ? 'selected' : ''}>Period</option>
          <option value="open-ended" ${binding?.timeframe === 'open-ended' ? 'selected' : ''}>Open-ended</option>
        </select>
      </div>
      <div class="context-field full-width">
        <label>Background Assumptions</label>
        <input type="text" id="context-background"
          value="${(binding?.background || []).join(', ')}"
          placeholder="e.g., outdoor_sensor, calibrated_2024">
      </div>
    `;
  }

  /**
   * Get current agent identifier
   */
  getCurrentAgent() {
    // Try to get from EOAgent if available
    if (typeof window !== 'undefined' && window.EOAgent) {
      const agent = window.EOAgent.getCurrentAgent?.();
      return agent?.id || agent?.name || 'user:anonymous';
    }
    return 'user:anonymous';
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close button
    this.container.querySelector('#interp-close-btn')?.addEventListener('click', () => {
      this.close();
    });

    // Search buttons
    this.container.querySelectorAll('[data-action="search"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const column = btn.dataset.column;
        this.searchSuggestions(column);
      });
    });

    // Search on enter
    this.container.querySelectorAll('.search-input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const column = input.dataset.column;
          this.searchSuggestions(column);
        }
      });
    });

    // Unbind buttons
    this.container.querySelectorAll('[data-action="unbind"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const column = btn.dataset.column;
        this.unbindColumn(column);
      });
    });

    // Save button
    this.container.querySelector('#interp-save-btn')?.addEventListener('click', () => {
      this.saveInterpretation();
    });
  }

  /**
   * Search for suggestions for a column
   */
  async searchSuggestions(column) {
    const input = this.container.querySelector(`input[data-column="${column}"]`);
    const resultsContainer = this.container.querySelector(`#results-${column}`);
    if (!input || !resultsContainer) return;

    const term = input.value.trim();
    if (!term) return;

    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';

    try {
      const suggestions = await this.suggestionEngine?.getSuggestions(term, {});
      this.searchResults.set(column, suggestions);
      this.renderSuggestions(column, suggestions);
    } catch (error) {
      resultsContainer.innerHTML = `<div class="error">Search failed: ${error.message}</div>`;
    }
  }

  /**
   * Render suggestion results
   */
  renderSuggestions(column, suggestions) {
    const resultsContainer = this.container.querySelector(`#results-${column}`);
    if (!resultsContainer) return;

    if (!suggestions || suggestions.length === 0) {
      resultsContainer.innerHTML = `
        <div class="no-results">
          No suggestions found.
          <button class="btn-sm btn-link" data-action="create-new" data-column="${column}">
            + Create new semantic
          </button>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = suggestions.slice(0, 5).map((s, i) => `
      <div class="suggestion-item" data-column="${column}" data-index="${i}">
        <div class="suggestion-header">
          <span class="suggestion-label">${s.label}</span>
          <span class="suggestion-source source-${s.source.split('_')[0]}">${s.source}</span>
        </div>
        <div class="suggestion-description">${s.description || 'No description'}</div>
        <div class="suggestion-meta">
          <span class="score">${Math.round(s.score * 100)}%</span>
          ${s.warnings?.length > 0 ? `<span class="warnings">${s.warnings.length} warnings</span>` : ''}
        </div>
        <button class="btn-sm btn-primary" data-action="bind" data-column="${column}" data-uri="${s.candidate_uri}">
          Select
        </button>
      </div>
    `).join('');

    // Add event listeners for bind buttons
    resultsContainer.querySelectorAll('[data-action="bind"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const column = btn.dataset.column;
        const uri = btn.dataset.uri;
        this.bindColumn(column, uri);
      });
    });
  }

  /**
   * Bind a column to a semantic URI
   */
  bindColumn(column, semanticUri) {
    // Check if semantic exists in registry
    let semantic = this.semanticRegistry?.get(semanticUri);

    // If not, check if it's from suggestions and needs to be created
    if (!semantic) {
      const suggestions = this.searchResults.get(column);
      const suggestion = suggestions?.find(s => s.candidate_uri === semanticUri);

      if (suggestion) {
        // Create local semantic from external suggestion
        semantic = window.EOSchemaSemantic?.createSemanticFromExternal({
          uri: suggestion.candidate_uri,
          label: suggestion.label,
          description: suggestion.description,
          role: suggestion.role
        }, {
          created_by: this.getCurrentAgent()
        });

        if (semantic) {
          this.semanticRegistry?.add(semantic);
          // Use the new local URI
          semanticUri = semantic.id;
        }
      }
    }

    // Update current binding
    if (!this.currentBinding) {
      this.currentBinding = window.EOInterpretationBinding?.createInterpretationBinding({
        source_dataset: this.datasetId,
        agent: this.getCurrentAgent(),
        method: 'manual_binding'
      });
    }

    this.currentBinding.addBinding({
      column,
      semantic_uri: semanticUri,
      confidence: 'high'
    });

    // Re-render
    this.render();
  }

  /**
   * Unbind a column
   */
  unbindColumn(column) {
    if (this.currentBinding) {
      this.currentBinding.removeBinding(column);
      this.render();
    }
  }

  /**
   * Save interpretation
   */
  async saveInterpretation() {
    if (!this.currentBinding) {
      alert('No interpretation to save');
      return;
    }

    // Update context fields
    this.currentBinding.jurisdiction = this.container.querySelector('#context-jurisdiction')?.value || null;
    this.currentBinding.scale = this.container.querySelector('#context-scale')?.value || null;
    this.currentBinding.timeframe = this.container.querySelector('#context-timeframe')?.value || null;

    const bgInput = this.container.querySelector('#context-background')?.value || '';
    this.currentBinding.background = bgInput.split(',').map(s => s.trim()).filter(Boolean);

    // Save to store
    this.bindingStore?.add(this.currentBinding);

    // Record usage for bound semantics
    for (const b of this.currentBinding.bindings) {
      this.semanticRegistry?.recordUsage(b.semantic_uri);
    }

    alert('Interpretation saved!');
  }

  /**
   * Close the panel
   */
  close() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// ============================================================================
// Panel Factory
// ============================================================================

/**
 * Create and show interpretation panel
 */
function showInterpretationPanel(datasetId, columns, container) {
  const panel = new InterpretationPanel({
    datasetId,
    columns,
    container
  });
  panel.render();
  return panel;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    InterpretationPanel,
    showInterpretationPanel
  };
}

if (typeof window !== 'undefined') {
  window.InterpretationPanel = InterpretationPanel;
  window.showInterpretationPanel = showInterpretationPanel;
}
