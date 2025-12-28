/**
 * EOQL Editor - Visual Query Interface
 *
 * Provides both a code editor for writing EOQL/SQL queries
 * and a visual query builder interface.
 *
 * Features:
 * - Syntax highlighting for EOQL keywords
 * - Auto-complete for fields, sets, and keywords
 * - Visual query builder with EOQL primitives
 * - Query history and saved queries
 * - Results table with export
 * - Explain/analyze mode for query understanding
 */

// ============================================================================
// EOQL Editor Component
// ============================================================================

class EOQLEditor {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    this.options = {
      theme: options.theme || 'dark',
      showExamples: options.showExamples !== false,
      showHistory: options.showHistory !== false,
      showBuilder: options.showBuilder !== false,
      onExecute: options.onExecute || null,
      dataWorkbench: options.dataWorkbench || null,
      ...options
    };

    this.currentQuery = '';
    this.queryHistory = [];
    this.results = null;
    this.isExecuting = false;
    this.mode = 'code'; // 'code' or 'builder'

    this._init();
  }

  _init() {
    this._loadHistory();
    this._render();
    this._attachEventListeners();
  }

  _loadHistory() {
    try {
      const saved = localStorage.getItem('eoql_history');
      if (saved) {
        this.queryHistory = JSON.parse(saved).slice(0, 50);
      }
    } catch (e) {
      console.error('Failed to load EOQL history:', e);
    }
  }

  _saveHistory() {
    try {
      localStorage.setItem('eoql_history', JSON.stringify(this.queryHistory.slice(0, 50)));
    } catch (e) {
      console.error('Failed to save EOQL history:', e);
    }
  }

  _render() {
    this.container.innerHTML = `
      <div class="eoql-editor">
        <div class="eoql-header">
          <div class="eoql-title">
            <i class="ph ph-database"></i>
            <span>EOQL Query</span>
          </div>
          <div class="eoql-mode-toggle">
            <button class="eoql-mode-btn ${this.mode === 'code' ? 'active' : ''}" data-mode="code">
              <i class="ph ph-code"></i>
              Code
            </button>
            <button class="eoql-mode-btn ${this.mode === 'builder' ? 'active' : ''}" data-mode="builder">
              <i class="ph ph-squares-four"></i>
              Builder
            </button>
          </div>
          <div class="eoql-actions">
            <button class="eoql-btn eoql-btn-icon" data-action="format" title="Format Query">
              <i class="ph ph-magic-wand"></i>
            </button>
            <button class="eoql-btn eoql-btn-icon" data-action="explain" title="Explain Query">
              <i class="ph ph-info"></i>
            </button>
            <button class="eoql-btn eoql-btn-icon" data-action="save" title="Save Query">
              <i class="ph ph-floppy-disk"></i>
            </button>
          </div>
        </div>

        <div class="eoql-main">
          <div class="eoql-sidebar">
            ${this._renderSidebar()}
          </div>

          <div class="eoql-content">
            <div class="eoql-code-panel ${this.mode === 'code' ? '' : 'hidden'}">
              ${this._renderCodeEditor()}
            </div>

            <div class="eoql-builder-panel ${this.mode === 'builder' ? '' : 'hidden'}">
              ${this._renderQueryBuilder()}
            </div>

            <div class="eoql-execute-bar">
              <div class="eoql-execute-left">
                <select class="eoql-set-selector">
                  <option value="">All Sets</option>
                  ${this._renderSetOptions()}
                </select>
              </div>
              <div class="eoql-execute-right">
                <button class="eoql-btn eoql-btn-primary eoql-execute-btn" ${this.isExecuting ? 'disabled' : ''}>
                  <i class="ph ${this.isExecuting ? 'ph-spinner ph-spin' : 'ph-play'}"></i>
                  ${this.isExecuting ? 'Running...' : 'Execute'}
                </button>
              </div>
            </div>

            <div class="eoql-results-panel">
              ${this._renderResults()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderSidebar() {
    return `
      <div class="eoql-sidebar-section">
        <div class="eoql-sidebar-header">
          <i class="ph ph-clock-counter-clockwise"></i>
          History
        </div>
        <div class="eoql-history-list">
          ${this.queryHistory.length === 0
            ? '<div class="eoql-empty">No query history</div>'
            : this.queryHistory.slice(0, 10).map((item, i) => `
                <div class="eoql-history-item" data-index="${i}">
                  <div class="eoql-history-query">${this._escapeHtml(item.query.substring(0, 50))}${item.query.length > 50 ? '...' : ''}</div>
                  <div class="eoql-history-meta">${this._formatTime(item.timestamp)}</div>
                </div>
              `).join('')
          }
        </div>
      </div>

      <div class="eoql-sidebar-section">
        <div class="eoql-sidebar-header">
          <i class="ph ph-bookmark-simple"></i>
          Saved Queries
        </div>
        <div class="eoql-saved-list" id="eoql-saved-list">
          <div class="eoql-empty">Loading...</div>
        </div>
      </div>

      <div class="eoql-sidebar-section">
        <div class="eoql-sidebar-header">
          <i class="ph ph-lightbulb"></i>
          Examples
        </div>
        <div class="eoql-examples-list">
          ${(window.EOQL?.examples || []).map((ex, i) => `
            <div class="eoql-example-item" data-index="${i}">
              <div class="eoql-example-name">${this._escapeHtml(ex.name)}</div>
              <div class="eoql-example-category">${this._escapeHtml(ex.category)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="eoql-sidebar-section">
        <div class="eoql-sidebar-header">
          <i class="ph ph-table"></i>
          Sets
        </div>
        <div class="eoql-sets-list">
          ${this._renderSetsList()}
        </div>
      </div>
    `;
  }

  _renderCodeEditor() {
    return `
      <div class="eoql-code-wrapper">
        <div class="eoql-line-numbers" id="eoql-line-numbers">1</div>
        <textarea
          class="eoql-code-input"
          id="eoql-code-input"
          placeholder="-- Enter your EOQL or SQL query here

-- EOQL Example:
FIND RECORDS
GIVEN VISIBLE
FROM Tasks
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 10

-- SQL Example:
SELECT * FROM Projects WHERE active = true"
          spellcheck="false"
        >${this._escapeHtml(this.currentQuery)}</textarea>
        <div class="eoql-syntax-overlay" id="eoql-syntax-overlay"></div>
      </div>
    `;
  }

  _renderQueryBuilder() {
    return `
      <div class="eoql-builder">
        <div class="eoql-builder-section">
          <label class="eoql-builder-label">Query Type</label>
          <div class="eoql-builder-row">
            <select class="eoql-builder-select" id="eoql-builder-target">
              <option value="records">Records</option>
              <option value="events">Events</option>
              <option value="claims">Claims</option>
              <option value="activities">Activities</option>
              <option value="absences">Absences</option>
            </select>
          </div>
        </div>

        <div class="eoql-builder-section eoql-builder-eo-section">
          <label class="eoql-builder-label">
            <i class="ph ph-eye"></i>
            Epistemic Mode
          </label>
          <div class="eoql-builder-row eoql-builder-toggle-row">
            <button class="eoql-builder-toggle active" data-mode="all" data-group="epistemic">All</button>
            <button class="eoql-builder-toggle" data-mode="given" data-group="epistemic">
              <span class="eoql-given-badge">Given</span>
              Facts Only
            </button>
            <button class="eoql-builder-toggle" data-mode="meant" data-group="epistemic">
              <span class="eoql-meant-badge">Meant</span>
              Interpretations
            </button>
          </div>
        </div>

        <div class="eoql-builder-section eoql-builder-eo-section">
          <label class="eoql-builder-label">
            <i class="ph ph-eye-slash"></i>
            Visibility
          </label>
          <div class="eoql-builder-row eoql-builder-toggle-row">
            <button class="eoql-builder-toggle active" data-mode="visible" data-group="visibility">Visible Only</button>
            <button class="eoql-builder-toggle" data-mode="exists" data-group="visibility">All Existing</button>
          </div>
        </div>

        <div class="eoql-builder-section">
          <label class="eoql-builder-label">
            <i class="ph ph-frame-corners"></i>
            Frame (Optional)
          </label>
          <div class="eoql-builder-row">
            <select class="eoql-builder-select" id="eoql-builder-frame">
              <option value="">Default Frame</option>
              <option value="analysis">Analysis Frame</option>
              <option value="compliance">Compliance Frame</option>
              <option value="audit">Audit Frame</option>
            </select>
          </div>
        </div>

        <div class="eoql-builder-section">
          <label class="eoql-builder-label">
            <i class="ph ph-clock"></i>
            Time Range
          </label>
          <div class="eoql-builder-row">
            <select class="eoql-builder-select" id="eoql-builder-time-mode">
              <option value="current">Current State</option>
              <option value="as_of">As Of</option>
              <option value="between">Between</option>
            </select>
          </div>
          <div class="eoql-builder-row eoql-builder-time-inputs hidden" id="eoql-time-inputs">
            <input type="datetime-local" class="eoql-builder-input" id="eoql-time-start" />
            <span class="eoql-builder-time-sep hidden" id="eoql-time-sep">to</span>
            <input type="datetime-local" class="eoql-builder-input hidden" id="eoql-time-end" />
          </div>
        </div>

        <div class="eoql-builder-section">
          <label class="eoql-builder-label">
            <i class="ph ph-table"></i>
            From Set
          </label>
          <div class="eoql-builder-row">
            <select class="eoql-builder-select" id="eoql-builder-from">
              <option value="">All Sets</option>
              ${this._renderSetOptions()}
            </select>
          </div>
        </div>

        <div class="eoql-builder-section">
          <label class="eoql-builder-label">
            <i class="ph ph-funnel"></i>
            Conditions
          </label>
          <div class="eoql-builder-conditions" id="eoql-builder-conditions">
            <div class="eoql-builder-condition-row">
              <select class="eoql-builder-select eoql-builder-field">
                <option value="">Select field...</option>
              </select>
              <select class="eoql-builder-select eoql-builder-op">
                <option value="=">=</option>
                <option value="!=">!=</option>
                <option value=">">></option>
                <option value=">=">>=</option>
                <option value="<"><</option>
                <option value="<="><=</option>
                <option value="LIKE">LIKE</option>
                <option value="CONTAINS">CONTAINS</option>
                <option value="IN">IN</option>
                <option value="IS NULL">IS NULL</option>
              </select>
              <input type="text" class="eoql-builder-input eoql-builder-value" placeholder="Value" />
              <button class="eoql-builder-btn-icon eoql-builder-remove-condition">
                <i class="ph ph-x"></i>
              </button>
            </div>
          </div>
          <button class="eoql-builder-btn eoql-builder-add-condition">
            <i class="ph ph-plus"></i>
            Add Condition
          </button>
        </div>

        <div class="eoql-builder-section">
          <label class="eoql-builder-label">
            <i class="ph ph-tree-structure"></i>
            Provenance
          </label>
          <div class="eoql-builder-row">
            <label class="eoql-builder-checkbox">
              <input type="checkbox" id="eoql-builder-trace" />
              Include Trace (GROUNDED BY)
            </label>
          </div>
          <div class="eoql-builder-row eoql-builder-trace-depth hidden" id="eoql-trace-depth-row">
            <label>Depth:</label>
            <input type="number" class="eoql-builder-input eoql-builder-small" id="eoql-builder-trace-depth" value="5" min="1" max="20" />
          </div>
        </div>

        <div class="eoql-builder-section">
          <label class="eoql-builder-label">
            <i class="ph ph-sort-ascending"></i>
            Order By
          </label>
          <div class="eoql-builder-row">
            <select class="eoql-builder-select" id="eoql-builder-order-field">
              <option value="">No ordering</option>
            </select>
            <select class="eoql-builder-select eoql-builder-small" id="eoql-builder-order-dir">
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </select>
          </div>
        </div>

        <div class="eoql-builder-section">
          <label class="eoql-builder-label">
            <i class="ph ph-list-numbers"></i>
            Limit
          </label>
          <div class="eoql-builder-row">
            <input type="number" class="eoql-builder-input eoql-builder-small" id="eoql-builder-limit" placeholder="No limit" min="1" />
          </div>
        </div>

        <div class="eoql-builder-section">
          <button class="eoql-btn eoql-btn-secondary eoql-builder-generate">
            <i class="ph ph-code"></i>
            Generate Query
          </button>
        </div>
      </div>
    `;
  }

  _renderResults() {
    if (!this.results) {
      return `
        <div class="eoql-results-empty">
          <i class="ph ph-database"></i>
          <p>Execute a query to see results</p>
        </div>
      `;
    }

    if (!this.results.success) {
      return `
        <div class="eoql-results-error">
          <i class="ph ph-warning-circle"></i>
          <div class="eoql-error-title">Query Error</div>
          <div class="eoql-error-message">${this._escapeHtml(this.results.error || 'Unknown error')}</div>
        </div>
      `;
    }

    if (!this.results.data || this.results.data.length === 0) {
      return `
        <div class="eoql-results-empty">
          <i class="ph ph-magnifying-glass"></i>
          <p>No results found</p>
          <p class="eoql-results-meta">Query executed in ${this.results.metadata?.executionTime || 0}ms</p>
        </div>
      `;
    }

    return `
      <div class="eoql-results-header">
        <div class="eoql-results-info">
          <span class="eoql-results-count">${this.results.data.length} row${this.results.data.length !== 1 ? 's' : ''}</span>
          ${this.results.metadata?.executionTime ? `<span class="eoql-results-time">${this.results.metadata.executionTime}ms</span>` : ''}
        </div>
        <div class="eoql-results-actions">
          <button class="eoql-btn eoql-btn-icon" data-action="export-csv" title="Export CSV">
            <i class="ph ph-file-csv"></i>
          </button>
          <button class="eoql-btn eoql-btn-icon" data-action="export-json" title="Export JSON">
            <i class="ph ph-file-js"></i>
          </button>
          <button class="eoql-btn eoql-btn-icon" data-action="copy-results" title="Copy to Clipboard">
            <i class="ph ph-clipboard"></i>
          </button>
        </div>
      </div>
      <div class="eoql-results-table-wrapper">
        ${this._renderResultsTable()}
      </div>
      ${this.results.provenance ? this._renderProvenance() : ''}
      ${this.results.metadata?.conflicts?.length > 0 ? this._renderConflicts() : ''}
    `;
  }

  _renderResultsTable() {
    const data = this.results.data;
    if (!data || data.length === 0) return '';

    // Get all unique keys from the data
    const columns = new Set();
    for (const row of data) {
      for (const key of Object.keys(row)) {
        if (!key.startsWith('_')) { // Skip internal metadata fields
          columns.add(key);
        }
      }
    }

    const columnArray = Array.from(columns);

    return `
      <table class="eoql-results-table">
        <thead>
          <tr>
            ${columnArray.map(col => `<th>${this._escapeHtml(col)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.slice(0, 100).map(row => `
            <tr>
              ${columnArray.map(col => `
                <td>${this._formatCellValue(row[col])}</td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${data.length > 100 ? `<div class="eoql-results-truncated">Showing first 100 of ${data.length} rows</div>` : ''}
    `;
  }

  _renderProvenance() {
    if (!this.results.provenance || this.results.provenance.length === 0) return '';

    return `
      <div class="eoql-provenance-section">
        <div class="eoql-provenance-header">
          <i class="ph ph-tree-structure"></i>
          Provenance Trace
        </div>
        <div class="eoql-provenance-content">
          ${this.results.provenance.map(p => `
            <div class="eoql-provenance-item">
              <div class="eoql-provenance-result">${this._escapeHtml(p.resultId)}</div>
              <div class="eoql-provenance-chain">
                ${p.chain.map(c => `
                  <div class="eoql-provenance-node ${c.epistemicType}">
                    <span class="eoql-provenance-type">${c.epistemicType}</span>
                    <span class="eoql-provenance-id">${c.eventId.substring(0, 12)}...</span>
                  </div>
                `).join('<i class="ph ph-arrow-right"></i>')}
              </div>
              ${p.roots.length > 0 ? `
                <div class="eoql-provenance-roots">
                  Grounded in: ${p.roots.map(r => `<span class="eoql-given-badge">${r.substring(0, 12)}...</span>`).join(', ')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  _renderConflicts() {
    if (!this.results.metadata?.conflicts || this.results.metadata.conflicts.length === 0) return '';

    return `
      <div class="eoql-conflicts-section">
        <div class="eoql-conflicts-header">
          <i class="ph ph-warning"></i>
          Conflicts Detected
        </div>
        <div class="eoql-conflicts-content">
          ${this.results.metadata.conflicts.map(c => `
            <div class="eoql-conflict-item">
              ${this._escapeHtml(JSON.stringify(c))}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  _renderSetsList() {
    const workbench = this.options.dataWorkbench || window.dataWorkbench;
    if (!workbench || !workbench.sets) {
      return '<div class="eoql-empty">No sets available</div>';
    }

    return workbench.sets.map(set => `
      <div class="eoql-set-item" data-set-id="${set.id}" data-set-name="${this._escapeHtml(set.name)}">
        <i class="ph ${set.icon || 'ph-table'}"></i>
        <span>${this._escapeHtml(set.name)}</span>
        <span class="eoql-set-count">${set.records?.length || 0}</span>
      </div>
    `).join('');
  }

  _renderSetOptions() {
    const workbench = this.options.dataWorkbench || window.dataWorkbench;
    if (!workbench || !workbench.sets) {
      return '';
    }

    return workbench.sets.map(set =>
      `<option value="${this._escapeHtml(set.name)}">${this._escapeHtml(set.name)}</option>`
    ).join('');
  }

  _attachEventListeners() {
    // Mode toggle
    this.container.querySelectorAll('.eoql-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.mode = e.currentTarget.dataset.mode;
        this._render();
        this._attachEventListeners();
      });
    });

    // Code editor
    const codeInput = this.container.querySelector('#eoql-code-input');
    if (codeInput) {
      codeInput.addEventListener('input', (e) => {
        this.currentQuery = e.target.value;
        this._updateLineNumbers();
        this._updateSyntaxHighlight();
      });

      codeInput.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to execute
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          this.execute();
        }
        // Tab for indentation
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = e.target.selectionStart;
          const end = e.target.selectionEnd;
          e.target.value = e.target.value.substring(0, start) + '  ' + e.target.value.substring(end);
          e.target.selectionStart = e.target.selectionEnd = start + 2;
          this.currentQuery = e.target.value;
        }
      });

      codeInput.addEventListener('scroll', () => {
        const lineNumbers = this.container.querySelector('#eoql-line-numbers');
        if (lineNumbers) {
          lineNumbers.scrollTop = codeInput.scrollTop;
        }
      });
    }

    // Execute button
    this.container.querySelector('.eoql-execute-btn')?.addEventListener('click', () => {
      this.execute();
    });

    // Action buttons
    this.container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        this._handleAction(action);
      });
    });

    // History items
    this.container.querySelectorAll('.eoql-history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        if (this.queryHistory[index]) {
          this.setQuery(this.queryHistory[index].query);
        }
      });
    });

    // Example items
    this.container.querySelectorAll('.eoql-example-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        const examples = window.EOQL?.examples || [];
        if (examples[index]) {
          this.setQuery(examples[index].query);
        }
      });
    });

    // Set items (insert set name)
    this.container.querySelectorAll('.eoql-set-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const setName = e.currentTarget.dataset.setName;
        this._insertAtCursor(setName);
      });
    });

    // Builder event listeners
    this._attachBuilderListeners();

    // Load saved queries
    this._loadSavedQueries();
  }

  _attachBuilderListeners() {
    // Toggle buttons
    this.container.querySelectorAll('.eoql-builder-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const group = e.currentTarget.dataset.group;
        this.container.querySelectorAll(`.eoql-builder-toggle[data-group="${group}"]`).forEach(b => {
          b.classList.remove('active');
        });
        e.currentTarget.classList.add('active');
      });
    });

    // Time mode change
    const timeModeSelect = this.container.querySelector('#eoql-builder-time-mode');
    if (timeModeSelect) {
      timeModeSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        const timeInputs = this.container.querySelector('#eoql-time-inputs');
        const timeSep = this.container.querySelector('#eoql-time-sep');
        const timeEnd = this.container.querySelector('#eoql-time-end');

        if (mode === 'current') {
          timeInputs?.classList.add('hidden');
        } else {
          timeInputs?.classList.remove('hidden');
          if (mode === 'between') {
            timeSep?.classList.remove('hidden');
            timeEnd?.classList.remove('hidden');
          } else {
            timeSep?.classList.add('hidden');
            timeEnd?.classList.add('hidden');
          }
        }
      });
    }

    // Trace checkbox
    const traceCheckbox = this.container.querySelector('#eoql-builder-trace');
    if (traceCheckbox) {
      traceCheckbox.addEventListener('change', (e) => {
        const depthRow = this.container.querySelector('#eoql-trace-depth-row');
        if (e.target.checked) {
          depthRow?.classList.remove('hidden');
        } else {
          depthRow?.classList.add('hidden');
        }
      });
    }

    // Add condition button
    this.container.querySelector('.eoql-builder-add-condition')?.addEventListener('click', () => {
      this._addConditionRow();
    });

    // Remove condition buttons
    this.container.querySelectorAll('.eoql-builder-remove-condition').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const row = e.currentTarget.closest('.eoql-builder-condition-row');
        if (row) {
          row.remove();
        }
      });
    });

    // Generate query button
    this.container.querySelector('.eoql-builder-generate')?.addEventListener('click', () => {
      this._generateQueryFromBuilder();
    });

    // From set change - update field options
    const fromSelect = this.container.querySelector('#eoql-builder-from');
    if (fromSelect) {
      fromSelect.addEventListener('change', () => {
        this._updateFieldOptions();
      });
    }
  }

  _addConditionRow() {
    const container = this.container.querySelector('#eoql-builder-conditions');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'eoql-builder-condition-row';
    row.innerHTML = `
      <select class="eoql-builder-select eoql-builder-connector">
        <option value="AND">AND</option>
        <option value="OR">OR</option>
      </select>
      <select class="eoql-builder-select eoql-builder-field">
        <option value="">Select field...</option>
      </select>
      <select class="eoql-builder-select eoql-builder-op">
        <option value="=">=</option>
        <option value="!=">!=</option>
        <option value=">">></option>
        <option value=">=">>=</option>
        <option value="<"><</option>
        <option value="<="><=</option>
        <option value="LIKE">LIKE</option>
        <option value="CONTAINS">CONTAINS</option>
        <option value="IN">IN</option>
        <option value="IS NULL">IS NULL</option>
      </select>
      <input type="text" class="eoql-builder-input eoql-builder-value" placeholder="Value" />
      <button class="eoql-builder-btn-icon eoql-builder-remove-condition">
        <i class="ph ph-x"></i>
      </button>
    `;

    container.appendChild(row);

    // Attach remove listener
    row.querySelector('.eoql-builder-remove-condition')?.addEventListener('click', () => {
      row.remove();
    });

    this._updateFieldOptions();
  }

  _updateFieldOptions() {
    const fromSelect = this.container.querySelector('#eoql-builder-from');
    const setName = fromSelect?.value || '';

    const workbench = this.options.dataWorkbench || window.dataWorkbench;
    let fields = [];

    if (setName && workbench?.sets) {
      const set = workbench.sets.find(s => s.name === setName);
      if (set?.fields) {
        fields = set.fields;
      }
    }

    // Update all field selects
    const fieldSelects = this.container.querySelectorAll('.eoql-builder-field');
    const orderField = this.container.querySelector('#eoql-builder-order-field');

    const optionsHtml = `
      <option value="">Select field...</option>
      ${fields.map(f => `<option value="${this._escapeHtml(f.name)}">${this._escapeHtml(f.name)}</option>`).join('')}
    `;

    fieldSelects.forEach(select => {
      select.innerHTML = optionsHtml;
    });

    if (orderField) {
      orderField.innerHTML = `
        <option value="">No ordering</option>
        ${fields.map(f => `<option value="${this._escapeHtml(f.name)}">${this._escapeHtml(f.name)}</option>`).join('')}
      `;
    }
  }

  _generateQueryFromBuilder() {
    const builder = window.EOQL?.query();
    if (!builder) {
      console.error('EOQL not available');
      return;
    }

    // Target
    const target = this.container.querySelector('#eoql-builder-target')?.value || 'records';
    builder.find(target);

    // Epistemic mode
    const epistemicActive = this.container.querySelector('.eoql-builder-toggle[data-group="epistemic"].active');
    const epistemicMode = epistemicActive?.dataset.mode || 'all';
    if (epistemicMode === 'given') {
      builder.given();
    } else if (epistemicMode === 'meant') {
      builder.meant();
    }

    // Visibility
    const visibilityActive = this.container.querySelector('.eoql-builder-toggle[data-group="visibility"].active');
    const visibility = visibilityActive?.dataset.mode || 'visible';
    if (visibility === 'exists') {
      builder.exists();
    } else {
      builder.visible();
    }

    // Frame
    const frame = this.container.querySelector('#eoql-builder-frame')?.value;
    if (frame) {
      builder.underFrame(frame);
    }

    // Time
    const timeMode = this.container.querySelector('#eoql-builder-time-mode')?.value || 'current';
    const timeStart = this.container.querySelector('#eoql-time-start')?.value;
    const timeEnd = this.container.querySelector('#eoql-time-end')?.value;

    if (timeMode === 'as_of' && timeStart) {
      builder.asOf(timeStart);
    } else if (timeMode === 'between' && timeStart && timeEnd) {
      builder.between(timeStart, timeEnd);
    }

    // From
    const from = this.container.querySelector('#eoql-builder-from')?.value;
    if (from) {
      builder.from(from);
    }

    // Conditions
    const conditionRows = this.container.querySelectorAll('.eoql-builder-condition-row');
    conditionRows.forEach((row, index) => {
      const field = row.querySelector('.eoql-builder-field')?.value;
      const op = row.querySelector('.eoql-builder-op')?.value;
      const value = row.querySelector('.eoql-builder-value')?.value;
      const connector = row.querySelector('.eoql-builder-connector')?.value;

      if (field) {
        if (index === 0) {
          builder.where(field, op, value);
        } else if (connector === 'OR') {
          builder.or(field, op, value);
        } else {
          builder.and(field, op, value);
        }
      }
    });

    // Trace
    const trace = this.container.querySelector('#eoql-builder-trace')?.checked;
    const traceDepth = parseInt(this.container.querySelector('#eoql-builder-trace-depth')?.value || '5');
    if (trace) {
      builder.trace(traceDepth);
    }

    // Order
    const orderField = this.container.querySelector('#eoql-builder-order-field')?.value;
    const orderDir = this.container.querySelector('#eoql-builder-order-dir')?.value || 'asc';
    if (orderField) {
      builder.orderBy(orderField, orderDir);
    }

    // Limit
    const limit = parseInt(this.container.querySelector('#eoql-builder-limit')?.value);
    if (limit) {
      builder.limit(limit);
    }

    // Generate and set query
    const queryString = builder.toString();
    this.setQuery(queryString);
    this.mode = 'code';
    this._render();
    this._attachEventListeners();
  }

  async _loadSavedQueries() {
    const savedList = this.container.querySelector('#eoql-saved-list');
    if (!savedList) return;

    try {
      const store = await window.EOQL?.getQueryStore();
      if (!store) {
        savedList.innerHTML = '<div class="eoql-empty">No saved queries</div>';
        return;
      }

      const queries = store.getAll();
      if (queries.length === 0) {
        savedList.innerHTML = '<div class="eoql-empty">No saved queries</div>';
        return;
      }

      savedList.innerHTML = queries.map(q => `
        <div class="eoql-saved-item" data-query-id="${q.id}">
          <div class="eoql-saved-name">${this._escapeHtml(q.name)}</div>
          <div class="eoql-saved-meta">${this._formatTime(q.updatedAt)}</div>
        </div>
      `).join('');

      // Attach click listeners
      savedList.querySelectorAll('.eoql-saved-item').forEach(item => {
        item.addEventListener('click', async () => {
          const id = item.dataset.queryId;
          const query = store.get(id);
          if (query) {
            this.setQuery(query.queryString);
          }
        });
      });

    } catch (e) {
      console.error('Failed to load saved queries:', e);
      savedList.innerHTML = '<div class="eoql-empty">Failed to load</div>';
    }
  }

  _handleAction(action) {
    switch (action) {
      case 'format':
        this._formatQuery();
        break;
      case 'explain':
        this._explainQuery();
        break;
      case 'save':
        this._saveQuery();
        break;
      case 'export-csv':
        this._exportResults('csv');
        break;
      case 'export-json':
        this._exportResults('json');
        break;
      case 'copy-results':
        this._copyResults();
        break;
    }
  }

  _formatQuery() {
    if (!this.currentQuery.trim()) return;

    try {
      const ir = window.EOQL?.parse(this.currentQuery);
      if (ir) {
        const formatted = window.EOQL?.format(ir);
        this.setQuery(formatted);
      }
    } catch (e) {
      console.error('Failed to format query:', e);
    }
  }

  async _explainQuery() {
    if (!this.currentQuery.trim()) return;

    try {
      const ir = window.EOQL?.parse(this.currentQuery);
      if (ir) {
        const explanation = this._generateExplanation(ir);
        // Show explanation in a modal or tooltip
        alert(explanation);
      }
    } catch (e) {
      alert('Parse error: ' + e.message);
    }
  }

  _generateExplanation(ir) {
    const parts = [];

    parts.push(`Query Type: ${ir.target.toUpperCase()}`);

    if (ir.epistemicMode !== 'all') {
      parts.push(`Epistemic Mode: ${ir.epistemicMode.toUpperCase()} - ${ir.epistemicMode === 'given' ? 'Only instantiated facts' : 'Only interpretations/inferences'}`);
    }

    if (ir.visibilityMode === 'exists') {
      parts.push(`Visibility: EXISTS - Including hidden/segmented artifacts`);
    } else {
      parts.push(`Visibility: VISIBLE - Only visible within current scope`);
    }

    if (ir.frame) {
      parts.push(`Frame: ${ir.frame} (version: ${ir.frameVersion})`);
    }

    if (ir.timeMode !== 'current') {
      if (ir.timeMode === 'as_of') {
        parts.push(`Time: AS OF ${ir.timeStart}`);
      } else {
        parts.push(`Time: BETWEEN ${ir.timeStart} AND ${ir.timeEnd}`);
      }
    }

    if (ir.from) {
      parts.push(`Source: ${ir.from}`);
    }

    if (ir.where.length > 0) {
      parts.push(`Filters: ${ir.where.length} condition(s)`);
    }

    if (ir.trace) {
      parts.push(`Trace: Enabled (depth: ${ir.traceDepth})`);
    }

    if (ir.limit) {
      parts.push(`Limit: ${ir.limit} rows`);
    }

    return parts.join('\n');
  }

  async _saveQuery() {
    if (!this.currentQuery.trim()) {
      alert('No query to save');
      return;
    }

    const name = prompt('Query name:');
    if (!name) return;

    try {
      const ir = window.EOQL?.parse(this.currentQuery);
      if (!ir) {
        alert('Failed to parse query');
        return;
      }

      const store = await window.EOQL?.getQueryStore();
      if (!store) {
        alert('Query store not available');
        return;
      }

      await store.save(name, ir);
      this._loadSavedQueries();

    } catch (e) {
      alert('Failed to save query: ' + e.message);
    }
  }

  _exportResults(format) {
    if (!this.results?.data || this.results.data.length === 0) return;

    let content;
    let filename;
    let type;

    if (format === 'csv') {
      content = this._convertToCSV(this.results.data);
      filename = 'eoql-results.csv';
      type = 'text/csv';
    } else {
      content = JSON.stringify(this.results.data, null, 2);
      filename = 'eoql-results.json';
      type = 'application/json';
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  _convertToCSV(data) {
    if (!data || data.length === 0) return '';

    const columns = new Set();
    for (const row of data) {
      for (const key of Object.keys(row)) {
        if (!key.startsWith('_')) {
          columns.add(key);
        }
      }
    }

    const cols = Array.from(columns);
    const lines = [cols.join(',')];

    for (const row of data) {
      const values = cols.map(col => {
        const val = row[col];
        if (val == null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  _copyResults() {
    if (!this.results?.data) return;

    const text = JSON.stringify(this.results.data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      // Could show a toast notification here
      console.log('Results copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  _updateLineNumbers() {
    const codeInput = this.container.querySelector('#eoql-code-input');
    const lineNumbers = this.container.querySelector('#eoql-line-numbers');
    if (!codeInput || !lineNumbers) return;

    const lines = (this.currentQuery.match(/\n/g) || []).length + 1;
    lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
  }

  _updateSyntaxHighlight() {
    // Simple syntax highlighting overlay
    const overlay = this.container.querySelector('#eoql-syntax-overlay');
    if (!overlay) return;

    // For now, we'll rely on CSS styling of the textarea
    // A full implementation would use CodeMirror or similar
  }

  _insertAtCursor(text) {
    const codeInput = this.container.querySelector('#eoql-code-input');
    if (!codeInput) return;

    const start = codeInput.selectionStart;
    const end = codeInput.selectionEnd;
    codeInput.value = codeInput.value.substring(0, start) + text + codeInput.value.substring(end);
    codeInput.selectionStart = codeInput.selectionEnd = start + text.length;
    codeInput.focus();
    this.currentQuery = codeInput.value;
  }

  _formatCellValue(value) {
    if (value === null || value === undefined) {
      return '<span class="eoql-null">null</span>';
    }
    if (typeof value === 'boolean') {
      return value ? '<i class="ph ph-check-circle eoql-bool-true"></i>' : '<i class="ph ph-x-circle eoql-bool-false"></i>';
    }
    if (typeof value === 'object') {
      return `<code>${this._escapeHtml(JSON.stringify(value).substring(0, 100))}</code>`;
    }
    return this._escapeHtml(String(value));
  }

  _formatTime(timestamp) {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;

      if (diff < 60000) return 'just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

      return date.toLocaleDateString();
    } catch {
      return '';
    }
  }

  _escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  setQuery(query) {
    this.currentQuery = query;
    const codeInput = this.container.querySelector('#eoql-code-input');
    if (codeInput) {
      codeInput.value = query;
    }
    this._updateLineNumbers();
  }

  getQuery() {
    return this.currentQuery;
  }

  async execute() {
    if (!this.currentQuery.trim()) {
      this.results = { success: false, error: 'No query to execute' };
      this._renderResultsOnly();
      return;
    }

    this.isExecuting = true;
    this._renderExecuteButton();

    const startTime = Date.now();

    try {
      // Parse and execute
      const evaluator = window.EOQL?.getEvaluator();
      if (!evaluator) {
        throw new Error('EOQL evaluator not available');
      }

      this.results = await evaluator.execute(this.currentQuery);
      this.results.metadata = this.results.metadata || {};
      this.results.metadata.executionTime = Date.now() - startTime;

      // Add to history
      this.queryHistory.unshift({
        query: this.currentQuery,
        timestamp: new Date().toISOString(),
        success: this.results.success,
        rowCount: this.results.data?.length || 0
      });
      this._saveHistory();

      // Callback
      if (this.options.onExecute) {
        this.options.onExecute(this.results);
      }

    } catch (error) {
      this.results = {
        success: false,
        error: error.message,
        metadata: { executionTime: Date.now() - startTime }
      };
    } finally {
      this.isExecuting = false;
      this._renderResultsOnly();
      this._renderExecuteButton();
    }
  }

  _renderResultsOnly() {
    const resultsPanel = this.container.querySelector('.eoql-results-panel');
    if (resultsPanel) {
      resultsPanel.innerHTML = this._renderResults();

      // Re-attach results action listeners
      resultsPanel.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this._handleAction(e.currentTarget.dataset.action);
        });
      });
    }
  }

  _renderExecuteButton() {
    const btn = this.container.querySelector('.eoql-execute-btn');
    if (btn) {
      btn.disabled = this.isExecuting;
      btn.innerHTML = `
        <i class="ph ${this.isExecuting ? 'ph-spinner ph-spin' : 'ph-play'}"></i>
        ${this.isExecuting ? 'Running...' : 'Execute'}
      `;
    }
  }

  getResults() {
    return this.results;
  }

  clear() {
    this.currentQuery = '';
    this.results = null;
    const codeInput = this.container.querySelector('#eoql-code-input');
    if (codeInput) {
      codeInput.value = '';
    }
    this._updateLineNumbers();
    this._renderResultsOnly();
  }
}

// ============================================================================
// Modal Wrapper for EOQL Editor
// ============================================================================

class EOQLEditorModal {
  constructor(options = {}) {
    this.options = options;
    this.editor = null;
    this.modal = null;
  }

  open() {
    if (this.modal) {
      this.modal.classList.add('open');
      return;
    }

    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'eoql-modal-overlay';
    this.modal.innerHTML = `
      <div class="eoql-modal">
        <div class="eoql-modal-header">
          <h2>
            <i class="ph ph-database"></i>
            EOQL Query Console
          </h2>
          <button class="eoql-modal-close">
            <i class="ph ph-x"></i>
          </button>
        </div>
        <div class="eoql-modal-body" id="eoql-modal-container"></div>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Initialize editor
    this.editor = new EOQLEditor('#eoql-modal-container', this.options);

    // Close button
    this.modal.querySelector('.eoql-modal-close').addEventListener('click', () => {
      this.close();
    });

    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Close on escape
    document.addEventListener('keydown', this._handleEscape = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });

    setTimeout(() => {
      this.modal.classList.add('open');
    }, 10);
  }

  close() {
    if (this.modal) {
      this.modal.classList.remove('open');
      document.removeEventListener('keydown', this._handleEscape);

      setTimeout(() => {
        this.modal.remove();
        this.modal = null;
        this.editor = null;
      }, 300);
    }
  }

  getEditor() {
    return this.editor;
  }
}

// ============================================================================
// Global Functions
// ============================================================================

let eoqlEditorModal = null;

function openEOQLEditor(options = {}) {
  if (!eoqlEditorModal) {
    eoqlEditorModal = new EOQLEditorModal(options);
  }
  eoqlEditorModal.open();
  return eoqlEditorModal;
}

function closeEOQLEditor() {
  if (eoqlEditorModal) {
    eoqlEditorModal.close();
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EOQLEditor,
    EOQLEditorModal,
    openEOQLEditor,
    closeEOQLEditor
  };
}

if (typeof window !== 'undefined') {
  window.EOQLEditor = EOQLEditor;
  window.EOQLEditorModal = EOQLEditorModal;
  window.openEOQLEditor = openEOQLEditor;
  window.closeEOQLEditor = closeEOQLEditor;
}
