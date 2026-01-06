/**
 * EO Semantic Browser - Browse and Manage Schema Semantics
 *
 * Provides UI for:
 * - Browsing all schema semantics in the registry
 * - Viewing semantic details and version history
 * - Creating new semantic definitions
 * - Searching and filtering semantics
 */

// ============================================================================
// Semantic Browser Class
// ============================================================================

class SemanticBrowser {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Container element
   */
  constructor(options = {}) {
    this.container = options.container;

    // Get registry
    this.registry = window.EOSchemaSemantic?.getSemanticRegistry();
    this.bindingStore = window.EOInterpretationBinding?.getBindingStore();

    // State
    this.filter = {
      query: '',
      status: null
    };
    this.selectedSemantic = null;
  }

  /**
   * Render the browser
   */
  render() {
    if (!this.container) return;

    const semantics = this.getFilteredSemantics();

    const html = `
      <div class="semantic-browser">
        <div class="browser-header">
          <h3>
            <i class="ph ph-book-open"></i>
            Schema Semantics
          </h3>
          <button class="btn btn-primary" id="semantic-new-btn">
            <i class="ph ph-plus"></i> New
          </button>
        </div>

        <div class="browser-search">
          <div class="search-input-wrapper">
            <i class="ph ph-magnifying-glass"></i>
            <input type="text" id="semantic-search"
              placeholder="Search semantics..."
              value="${this.filter.query}">
          </div>
          <div class="status-filters">
            ${this.renderStatusFilters()}
          </div>
        </div>

        <div class="browser-stats">
          <span>${semantics.length} semantics</span>
          <span>${this.registry?.size || 0} total in registry</span>
        </div>

        <div class="semantic-list" id="semantic-list">
          ${this.renderSemanticList(semantics)}
        </div>

        <div class="semantic-detail" id="semantic-detail">
          ${this.selectedSemantic ? this.renderSemanticDetail(this.selectedSemantic) : ''}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
  }

  /**
   * Get filtered semantics
   */
  getFilteredSemantics() {
    if (!this.registry) return [];

    let semantics = this.registry.getAll();

    // Filter by status
    if (this.filter.status) {
      semantics = semantics.filter(s => s.status === this.filter.status);
    }

    // Filter by query
    if (this.filter.query) {
      const q = this.filter.query.toLowerCase();
      semantics = semantics.filter(s =>
        s.term.toLowerCase().includes(q) ||
        s.canonical_label.toLowerCase().includes(q) ||
        s.definition.toLowerCase().includes(q) ||
        s.aliases.some(a => a.toLowerCase().includes(q))
      );
    }

    // Sort by usage then name
    semantics.sort((a, b) => {
      const usageDiff = (b.usage_stats?.bindings || 0) - (a.usage_stats?.bindings || 0);
      if (usageDiff !== 0) return usageDiff;
      return a.term.localeCompare(b.term);
    });

    return semantics;
  }

  /**
   * Render status filter buttons
   */
  renderStatusFilters() {
    const statuses = ['stable', 'provisional', 'draft', 'protected'];
    return statuses.map(status => `
      <button class="filter-btn ${this.filter.status === status ? 'active' : ''}"
        data-status="${status}">
        ${status}
      </button>
    `).join('');
  }

  /**
   * Render semantic list
   */
  renderSemanticList(semantics) {
    if (semantics.length === 0) {
      return '<div class="empty-list">No semantics found</div>';
    }

    return semantics.map(s => {
      const usageCount = this.getUsageCount(s.id);
      return `
        <div class="semantic-card ${this.selectedSemantic?.id === s.id ? 'selected' : ''}"
          data-id="${s.id}">
          <div class="card-header">
            <span class="semantic-term">${s.canonical_label || s.term}</span>
            <span class="status-badge status-${s.status}">${s.status}</span>
          </div>
          <div class="card-definition">${this.truncate(s.definition, 100)}</div>
          <div class="card-meta">
            <span class="jurisdiction">${s.jurisdiction || 'unspecified'}</span>
            <span class="usage">${usageCount} uses</span>
            <span class="version">v${s.version}</span>
          </div>
          ${s.aligned_uris.length > 0 ? `
            <div class="aligned-uris">
              ${s.aligned_uris.slice(0, 2).map(uri => `
                <span class="uri-badge">${this.extractSource(uri)}</span>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Render semantic detail view
   */
  renderSemanticDetail(semantic) {
    const usageCount = this.getUsageCount(semantic.id);

    return `
      <div class="detail-header">
        <h4>${semantic.canonical_label || semantic.term}</h4>
        <span class="status-badge status-${semantic.status}">${semantic.status}</span>
      </div>

      <div class="detail-section">
        <label>URI</label>
        <code class="uri">${semantic.id}</code>
      </div>

      <div class="detail-section">
        <label>Definition</label>
        <p>${semantic.definition}</p>
      </div>

      <div class="detail-section">
        <label>Aliases</label>
        <div class="alias-list">
          ${semantic.aliases.map(a => `<span class="alias-tag">${a}</span>`).join('')}
          ${semantic.aliases.length === 0 ? '<span class="empty">No aliases</span>' : ''}
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-section">
          <label>Jurisdiction</label>
          <span>${semantic.jurisdiction || 'Unspecified'}</span>
        </div>
        <div class="detail-section">
          <label>Scale</label>
          <span>${semantic.scale || 'Unspecified'}</span>
        </div>
        <div class="detail-section">
          <label>Timeframe</label>
          <span>${semantic.timeframe || 'Unspecified'}</span>
        </div>
      </div>

      <div class="detail-section">
        <label>Background Assumptions</label>
        <div class="background-list">
          ${semantic.background.map(b => `<span class="bg-tag">${b}</span>`).join('')}
          ${semantic.background.length === 0 ? '<span class="empty">None specified</span>' : ''}
        </div>
      </div>

      <div class="detail-section">
        <label>Aligned URIs</label>
        <div class="aligned-list">
          ${semantic.aligned_uris.map(uri => `
            <a href="${uri}" target="_blank" class="aligned-uri">
              <i class="ph ph-arrow-square-out"></i>
              ${uri}
            </a>
          `).join('')}
          ${semantic.aligned_uris.length === 0 ? '<span class="empty">None</span>' : ''}
        </div>
      </div>

      <div class="detail-section">
        <label>Usage Stats</label>
        <div class="usage-stats">
          <span>Used in ${usageCount} datasets</span>
          <span>Created: ${this.formatDate(semantic.created_at)}</span>
          ${semantic.usage_stats?.last_used ?
            `<span>Last used: ${this.formatDate(semantic.usage_stats.last_used)}</span>` : ''}
        </div>
      </div>

      <div class="detail-actions">
        ${semantic.status !== 'protected' ? `
          <button class="btn" id="detail-edit-btn">
            <i class="ph ph-pencil"></i> Edit
          </button>
          <button class="btn" id="detail-version-btn">
            <i class="ph ph-git-branch"></i> New Version
          </button>
        ` : ''}
        <button class="btn" id="detail-export-btn">
          <i class="ph ph-download"></i> Export
        </button>
      </div>
    `;
  }

  /**
   * Get usage count for a semantic
   */
  getUsageCount(semanticUri) {
    if (!this.bindingStore) return 0;
    const bindings = this.bindingStore.getBySemantic(semanticUri);
    return bindings.length;
  }

  /**
   * Extract source name from URI
   */
  extractSource(uri) {
    if (uri.includes('wikidata.org')) return 'Wikidata';
    if (uri.includes('qudt.org')) return 'QUDT';
    if (uri.startsWith('eo://')) return 'EO';
    return 'External';
  }

  /**
   * Truncate text
   */
  truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  /**
   * Format date
   */
  formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Search input
    const searchInput = this.container.querySelector('#semantic-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filter.query = e.target.value;
        this.updateList();
      });
    }

    // Status filter buttons
    this.container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const status = btn.dataset.status;
        this.filter.status = this.filter.status === status ? null : status;
        this.render();
      });
    });

    // Semantic card selection
    this.container.querySelectorAll('.semantic-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.selectedSemantic = this.registry?.get(id);
        this.render();
      });
    });

    // New semantic button
    this.container.querySelector('#semantic-new-btn')?.addEventListener('click', () => {
      this.showNewSemanticForm();
    });

    // Export button
    this.container.querySelector('#detail-export-btn')?.addEventListener('click', () => {
      if (this.selectedSemantic) {
        this.exportSemantic(this.selectedSemantic);
      }
    });
  }

  /**
   * Update just the list part
   */
  updateList() {
    const listContainer = this.container.querySelector('#semantic-list');
    if (listContainer) {
      const semantics = this.getFilteredSemantics();
      listContainer.innerHTML = this.renderSemanticList(semantics);

      // Re-attach card listeners
      listContainer.querySelectorAll('.semantic-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.dataset.id;
          this.selectedSemantic = this.registry?.get(id);
          this.render();
        });
      });
    }
  }

  /**
   * Show form for creating new semantic
   */
  showNewSemanticForm() {
    const detailContainer = this.container.querySelector('#semantic-detail');
    if (!detailContainer) return;

    detailContainer.innerHTML = `
      <div class="semantic-form">
        <h4>New Schema Semantic</h4>

        <div class="form-field">
          <label>Term</label>
          <input type="text" id="form-term" placeholder="e.g., surface_air_temperature">
        </div>

        <div class="form-field">
          <label>Label</label>
          <input type="text" id="form-label" placeholder="e.g., Surface air temperature">
        </div>

        <div class="form-field">
          <label>Definition</label>
          <textarea id="form-definition" rows="3"
            placeholder="Human-readable definition of what this means..."></textarea>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label>Jurisdiction</label>
            <input type="text" id="form-jurisdiction" placeholder="e.g., WMO">
          </div>
          <div class="form-field">
            <label>Scale</label>
            <select id="form-scale">
              <option value="">Select...</option>
              <option value="site">Site</option>
              <option value="region">Region</option>
              <option value="global">Global</option>
              <option value="system">System</option>
            </select>
          </div>
          <div class="form-field">
            <label>Timeframe</label>
            <select id="form-timeframe">
              <option value="">Select...</option>
              <option value="instantaneous">Instantaneous</option>
              <option value="period">Period</option>
              <option value="open-ended">Open-ended</option>
            </select>
          </div>
        </div>

        <div class="form-field">
          <label>Aliases (comma-separated)</label>
          <input type="text" id="form-aliases" placeholder="temp, temperature, air_temp">
        </div>

        <div class="form-field">
          <label>Status</label>
          <select id="form-status">
            <option value="draft">Draft</option>
            <option value="provisional">Provisional</option>
            <option value="stable">Stable</option>
          </select>
        </div>

        <div class="form-actions">
          <button class="btn" id="form-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="form-save-btn">Create</button>
        </div>
      </div>
    `;

    // Attach form listeners
    detailContainer.querySelector('#form-cancel-btn')?.addEventListener('click', () => {
      this.selectedSemantic = null;
      this.render();
    });

    detailContainer.querySelector('#form-save-btn')?.addEventListener('click', () => {
      this.saveNewSemantic();
    });
  }

  /**
   * Save new semantic from form
   */
  saveNewSemantic() {
    const term = this.container.querySelector('#form-term')?.value?.trim();
    const label = this.container.querySelector('#form-label')?.value?.trim();
    const definition = this.container.querySelector('#form-definition')?.value?.trim();

    if (!term || !definition) {
      alert('Term and definition are required');
      return;
    }

    const aliases = (this.container.querySelector('#form-aliases')?.value || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    const semantic = new window.EOSchemaSemantic.SchemaSemantic({
      term,
      canonical_label: label || term,
      definition,
      jurisdiction: this.container.querySelector('#form-jurisdiction')?.value || null,
      scale: this.container.querySelector('#form-scale')?.value || null,
      timeframe: this.container.querySelector('#form-timeframe')?.value || null,
      aliases,
      status: this.container.querySelector('#form-status')?.value || 'draft',
      created_by: this.getCurrentAgent()
    });

    this.registry?.add(semantic);
    this.selectedSemantic = semantic;
    this.render();
  }

  /**
   * Export semantic as JSON
   */
  exportSemantic(semantic) {
    const json = JSON.stringify(semantic.toJSON(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${semantic.term}_v${semantic.version}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Get current agent
   */
  getCurrentAgent() {
    if (typeof window !== 'undefined' && window.EOAgent) {
      const agent = window.EOAgent.getCurrentAgent?.();
      return agent?.id || agent?.name || 'user:anonymous';
    }
    return 'user:anonymous';
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create and show semantic browser
 */
function showSemanticBrowser(container) {
  const browser = new SemanticBrowser({ container });
  browser.render();
  return browser;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SemanticBrowser,
    showSemanticBrowser
  };
}

if (typeof window !== 'undefined') {
  window.SemanticBrowser = SemanticBrowser;
  window.showSemanticBrowser = showSemanticBrowser;
}
