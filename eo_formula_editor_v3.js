/**
 * EO Formula Editor V3 - Epistemic-Native Formula Workbench
 *
 * A formula editor that embodies EO principles through its layout and interaction design:
 * - Vertical epistemic flow: Frame → Expression → Operators → Claim
 * - Frame-aware evaluation context (time reference, timezone, update rhythm)
 * - Real-time operator lens showing SEG, ALT, CON operators in use
 * - Result preview as epistemic claim (value + evaluation context + confidence)
 *
 * Design philosophy:
 * - Formulas are not calculators—they are relational claims
 * - Each evaluation is a tiny knowledge production event
 * - The modal layout mirrors the causal order of meaning crystallization
 */

// ============================================================================
// EO Operator Descriptions for UI
// ============================================================================

const EO_OPERATOR_DESCRIPTIONS = {
  CON: {
    code: 'CON',
    name: 'Connection',
    short: 'Field reference',
    description: 'Establishes relational reach to data source',
    color: '#3b82f6', // blue
    bgColor: 'rgba(59, 130, 246, 0.1)',
  },
  SEG: {
    code: 'SEG',
    name: 'Segmentation',
    short: 'Conditional boundary',
    description: 'Draws boundaries between states or conditions',
    color: '#8b5cf6', // purple
    bgColor: 'rgba(139, 92, 246, 0.1)',
  },
  ALT: {
    code: 'ALT',
    name: 'Alteration',
    short: 'Transformation',
    description: 'Transforms values through operations',
    color: '#f59e0b', // amber
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  SYN: {
    code: 'SYN',
    name: 'Synthesis',
    short: 'Aggregation',
    description: 'Combines multiple values into one',
    color: '#10b981', // emerald
    bgColor: 'rgba(16, 185, 129, 0.1)',
  },
  DES: {
    code: 'DES',
    name: 'Designation',
    short: 'Property access',
    description: 'Projects a specific property or assigns meaning',
    color: '#06b6d4', // cyan
    bgColor: 'rgba(6, 182, 212, 0.1)',
  },
  NUL: {
    code: 'NUL',
    name: 'Null Handler',
    short: 'Absence handling',
    description: 'Handles missing or absent values',
    color: '#6b7280', // gray
    bgColor: 'rgba(107, 114, 128, 0.1)',
  },
  INS: {
    code: 'INS',
    name: 'Instantiation',
    short: 'Value creation',
    description: 'Creates new values from specifications',
    color: '#ec4899', // pink
    bgColor: 'rgba(236, 72, 153, 0.1)',
  },
  SUP: {
    code: 'SUP',
    name: 'Superposition',
    short: 'Multiple states',
    description: 'Holds multiple possible values simultaneously',
    color: '#14b8a6', // teal
    bgColor: 'rgba(20, 184, 166, 0.1)',
  },
  REC: {
    code: 'REC',
    name: 'Recursion',
    short: 'Self-reference',
    description: 'Recursive or iterative computation',
    color: '#f97316', // orange
    bgColor: 'rgba(249, 115, 22, 0.1)',
  },
};

// Mapping from AST/function patterns to EO operators
const PATTERN_TO_OPERATORS = {
  // Conditionals → SEG
  'IF': ['SEG', 'ALT'],
  'SWITCH': ['SEG', 'ALT'],
  'IFS': ['SEG', 'ALT'],
  // Comparisons → SEG
  'comparison': ['SEG'],
  '<': ['SEG', 'ALT'],
  '>': ['SEG', 'ALT'],
  '=': ['SEG'],
  '!=': ['SEG'],
  '<=': ['SEG', 'ALT'],
  '>=': ['SEG', 'ALT'],
  // Aggregations → SYN
  'SUM': ['SYN'],
  'COUNT': ['SYN'],
  'COUNTA': ['SYN'],
  'AVERAGE': ['SYN'],
  'AVG': ['SYN'],
  'MIN': ['SYN', 'SEG'],
  'MAX': ['SYN', 'SEG'],
  'CONCATENATE': ['SYN'],
  'ARRAYJOIN': ['SYN'],
  // Logical → SYN
  'AND': ['SYN'],
  'OR': ['SYN'],
  'NOT': ['ALT'],
  // Date → ALT (temporal)
  'NOW': ['CON', 'ALT'],
  'TODAY': ['CON', 'ALT'],
  'DATEADD': ['ALT'],
  'DATETIME_DIFF': ['ALT'],
  'IS_BEFORE': ['SEG', 'ALT'],
  'IS_AFTER': ['SEG', 'ALT'],
  // Text → ALT
  'UPPER': ['ALT'],
  'LOWER': ['ALT'],
  'TRIM': ['ALT'],
  'LEFT': ['ALT', 'SEG'],
  'RIGHT': ['ALT', 'SEG'],
  'MID': ['ALT', 'SEG'],
  'SUBSTITUTE': ['ALT'],
  'REPLACE': ['ALT'],
  // Null handling → NUL
  'BLANK': ['NUL'],
  'ISERROR': ['NUL', 'SEG'],
  'IF_ERROR': ['NUL', 'SEG'],
  // Field reference → CON
  'fieldRef': ['CON', 'DES'],
  'setFieldRef': ['CON', 'DES'],
  // Superposition → SUP
  'SUPERPOSE': ['SUP'],
  'WEIGHTED': ['SUP'],
  'SOURCED': ['SUP'],
  'COLLAPSE': ['SUP', 'SYN'],
};

// ============================================================================
// Evaluation Context Definitions
// ============================================================================

const EVALUATION_CONTEXTS = {
  timeReference: {
    label: 'Time Reference',
    options: [
      { value: 'system_now', label: 'system_now', hint: 'now()' },
      { value: 'record_created', label: 'record_created', hint: 'CREATED_TIME()' },
      { value: 'record_modified', label: 'record_modified', hint: 'LAST_MODIFIED_TIME()' },
      { value: 'static', label: 'static', hint: 'Fixed point in time' },
    ],
    default: 'system_now',
  },
  timezone: {
    label: 'Timezone',
    options: [
      { value: 'workspace', label: 'workspace', hint: 'Workspace default' },
      { value: 'user', label: 'user', hint: 'User preference' },
      { value: 'utc', label: 'UTC', hint: 'Coordinated Universal Time' },
    ],
    default: 'workspace',
  },
  updateRhythm: {
    label: 'Update Rhythm',
    options: [
      { value: 'on_change', label: 'on change', hint: 'When dependencies change' },
      { value: 'on_load', label: 'on load', hint: 'When record loads' },
      { value: 'periodic', label: 'periodic', hint: '+ time tick' },
      { value: 'manual', label: 'manual', hint: 'User-triggered' },
    ],
    default: 'on_change',
  },
};

// ============================================================================
// Result Type Definitions
// ============================================================================

const RESULT_TYPES = {
  text: { label: 'Text', icon: 'ph-text-aa', color: 'var(--field-text)' },
  number: { label: 'Number', icon: 'ph-hash', color: 'var(--field-number)' },
  date: { label: 'Date', icon: 'ph-calendar', color: 'var(--field-date)' },
  checkbox: { label: 'Boolean', icon: 'ph-check-square', color: 'var(--field-checkbox)' },
  state: { label: 'State', icon: 'ph-git-branch', color: 'var(--meant-color)' },
  signal: { label: 'Signal', icon: 'ph-bell', color: 'var(--warning-500)' },
};

// ============================================================================
// EOFormulaEditorV3 - EO-Native Formula Workbench
// ============================================================================

class EOFormulaEditorV3 {
  constructor(workbench) {
    this.workbench = workbench;
    this.modal = null;
    this.field = null;
    this.onSave = null;
    this.onCancel = null;

    // State
    this.parsedFormula = null;
    this.detectedOperators = [];
    this.evaluationContext = {
      timeReference: 'system_now',
      timezone: 'workspace',
      updateRhythm: 'on_change',
    };

    // Autocomplete state
    this.autocompleteVisible = false;
    this.autocompleteSuggestions = [];
    this.autocompleteIndex = 0;

    // Function categories (inherited from V2 for function browser)
    this.functionCategories = this._getFunctionCategories();

    // Flat list of all functions for autocomplete
    this.allFunctions = this._getAllFunctions();
  }

  /**
   * Show the formula editor for creating a new formula field
   */
  showCreate(onSave, onCancel) {
    this.field = null;
    this.onSave = onSave;
    this.onCancel = onCancel;
    this._showModal('Formula', false);
  }

  /**
   * Show the formula editor for editing an existing formula field
   */
  showEdit(field, onSave, onCancel) {
    this.field = field;
    this.onSave = onSave;
    this.onCancel = onCancel;
    this._showModal('Formula', true);
  }

  /**
   * Internal method to show the modal
   */
  _showModal(title, isEdit) {
    // Destroy any existing modal
    if (this.modal) {
      this.modal.destroy();
      this.modal = null;
    }

    const set = this.workbench.getCurrentSet();
    const fields = set?.fields || [];
    const availableFields = isEdit
      ? fields.filter(f => f.id !== this.field?.id)
      : fields;

    // Create modal with custom structure (no default header/footer)
    this.modal = new EOModal({
      id: 'formula-editor-modal-v3',
      title: '',
      size: 'large',
      content: this._renderContent(availableFields, isEdit),
      closable: true,
      buttons: [], // Custom footer rendered in content
      onClose: () => {
        if (this.onCancel) this.onCancel();
      },
    });

    this.modal.show();

    // Hide default header, we use custom header
    const defaultHeader = this.modal.element?.querySelector('.eo-modal-header');
    if (defaultHeader) defaultHeader.style.display = 'none';

    this._attachEventListeners();

    // Initial parse if editing
    if (isEdit && this.field?.options?.formula) {
      this._updateFromFormula(this.field.options.formula);
    }

    // Focus the name input
    setTimeout(() => {
      const nameInput = this.modal?.element?.querySelector('#formula-field-name-v3');
      if (nameInput) nameInput.focus();
    }, 100);
  }

  /**
   * Render the complete modal content with EO-native layout
   */
  _renderContent(fields, isEdit) {
    const fieldName = this.field?.name || '';
    const formula = this.field?.options?.formula || '';
    const resultType = this.field?.options?.resultType || 'text';

    return `
      <div class="formula-editor-v3">
        <!-- ═══════════════════════════════════════════════════════════════ -->
        <!-- Header: Claim Type + Meta -->
        <!-- ═══════════════════════════════════════════════════════════════ -->
        <header class="formula-v3-header">
          <div class="formula-v3-title-group">
            <div class="formula-v3-title">
              <i class="ph ph-function"></i>
              <h2>Formula</h2>
            </div>
            <div class="formula-v3-meta">
              <span class="formula-v3-chip">
                <strong>Produces</strong>
                <span class="formula-v3-result-type-label">${RESULT_TYPES[resultType]?.label || 'Text'}</span>
              </span>
              <span class="formula-v3-chip">
                <strong>Evaluated</strong> per record
              </span>
              <span class="formula-v3-chip">
                <strong>Cadence</strong>
                <span class="formula-v3-cadence-label">on change</span>
              </span>
            </div>
          </div>
          <div class="formula-v3-actions">
            <button type="button" class="formula-v3-btn" id="btn-browse-functions">
              <i class="ph ph-list-magnifying-glass"></i> Functions
            </button>
            <button type="button" class="formula-v3-btn formula-v3-btn-primary" id="btn-save-formula">
              <i class="ph ph-check"></i> ${isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </header>

        <!-- ═══════════════════════════════════════════════════════════════ -->
        <!-- Context Strip: Evaluation Frame -->
        <!-- ═══════════════════════════════════════════════════════════════ -->
        <div class="formula-v3-context">
          <details class="formula-v3-context-details">
            <summary class="formula-v3-context-summary">
              <div class="formula-v3-context-left">
                <span class="formula-v3-context-badge">Frame</span>
                <span class="formula-v3-context-label">Evaluation Context</span>
                <span class="formula-v3-context-preview">
                  · ${this.evaluationContext.timeReference}
                  · ${this.evaluationContext.timezone}
                  · ${this.evaluationContext.updateRhythm.replace('_', ' ')}
                </span>
              </div>
              <i class="ph ph-caret-down formula-v3-context-chevron"></i>
            </summary>
            <div class="formula-v3-context-grid">
              ${this._renderContextField('timeReference')}
              ${this._renderContextField('timezone')}
              ${this._renderContextField('updateRhythm')}
            </div>
          </details>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════ -->
        <!-- Body: Editor + Rail -->
        <!-- ═══════════════════════════════════════════════════════════════ -->
        <div class="formula-v3-body">
          <!-- Left: Editor Card -->
          <section class="formula-v3-editor-card">
            <div class="formula-v3-editor-head">
              <div class="formula-v3-editor-head-left">
                <div class="formula-v3-name-input-group">
                  <input
                    type="text"
                    id="formula-field-name-v3"
                    class="formula-v3-name-input"
                    placeholder="Field name..."
                    value="${this._escapeHtml(fieldName)}"
                    autocomplete="off"
                  >
                </div>
              </div>
              <div class="formula-v3-result-type-selector">
                ${Object.entries(RESULT_TYPES).slice(0, 4).map(([type, info]) => `
                  <button type="button"
                    class="formula-v3-type-pill ${resultType === type ? 'selected' : ''}"
                    data-type="${type}"
                    title="${info.label}">
                    <i class="ph ${info.icon}"></i>
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="formula-v3-editor-body">
              <div class="formula-v3-editor-area">
                <div class="formula-v3-editor-hint">
                  <i class="ph ph-info"></i>
                  <span>This expression is a relational claim over your data</span>
                </div>
                <div class="formula-v3-textarea-wrapper">
                  <textarea
                    id="formula-input-v3"
                    class="formula-v3-textarea"
                    placeholder="IF(NOT BLANK({Due date}) AND {Due date} < NOW(), &quot;⚠️&quot;, &quot;&quot;)"
                    spellcheck="false"
                  >${this._escapeHtml(formula)}</textarea>
                  <div class="formula-v3-autocomplete" id="formula-autocomplete" style="display: none;">
                    <div class="formula-v3-autocomplete-list" id="formula-autocomplete-list"></div>
                  </div>
                </div>
              </div>

              <div class="formula-v3-inline-tools">
                ${this._renderFieldPills(fields)}
                ${this._renderQuickInserts()}
              </div>
            </div>
          </section>

          <!-- Right: Rail (Operators + Preview) -->
          <aside class="formula-v3-rail">
            <!-- Operator Lens Panel -->
            <section class="formula-v3-panel" id="operator-lens-panel">
              <h3 class="formula-v3-panel-title">
                <i class="ph ph-flow-arrow"></i>
                Operators in use
              </h3>
              <div class="formula-v3-panel-content formula-v3-operators-grid-container" id="operator-lens-content">
                <div class="formula-v3-operators-empty">
                  <i class="ph ph-brackets-curly"></i>
                  <span>Enter a formula to see operators</span>
                </div>
              </div>
            </section>

            <!-- EO Translation Panel -->
            <section class="formula-v3-panel" id="eo-translation-panel">
              <h3 class="formula-v3-panel-title">
                <i class="ph ph-code"></i>
                EO Notation
              </h3>
              <div class="formula-v3-panel-content" id="eo-translation-content">
                <div class="formula-v3-eo-empty">
                  <span>EO translation will appear here</span>
                </div>
              </div>
            </section>

            <!-- Result Preview Panel -->
            <section class="formula-v3-panel" id="result-preview-panel">
              <h3 class="formula-v3-panel-title">
                <i class="ph ph-eye"></i>
                Result
              </h3>
              <div class="formula-v3-panel-content" id="result-preview-content">
                <div class="formula-v3-result-empty">
                  <span>Preview will appear here</span>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════ -->
        <!-- Footer: Dependencies + Actions -->
        <!-- ═══════════════════════════════════════════════════════════════ -->
        <footer class="formula-v3-footer">
          <div class="formula-v3-footer-info" id="formula-dependencies-info">
            <span class="formula-v3-footer-hint">
              <i class="ph ph-info"></i>
              Formula will recalculate when dependencies change
            </span>
          </div>
          <div class="formula-v3-footer-actions">
            <button type="button" class="formula-v3-btn" id="btn-cancel-formula">
              Cancel
            </button>
            <button type="button" class="formula-v3-btn formula-v3-btn-primary" id="btn-save-formula-footer">
              <i class="ph ph-check"></i> ${isEdit ? 'Save Changes' : 'Create Field'}
            </button>
          </div>
        </footer>

        <!-- Hidden: Result type value -->
        <input type="hidden" id="formula-result-type-v3" value="${resultType}">

        <!-- Function Browser Drawer (hidden by default) -->
        <div class="formula-v3-drawer" id="function-browser-drawer">
          <div class="formula-v3-drawer-header">
            <h3>Functions</h3>
            <button type="button" class="formula-v3-drawer-close" id="close-function-browser">
              <i class="ph ph-x"></i>
            </button>
          </div>
          <div class="formula-v3-drawer-search">
            <i class="ph ph-magnifying-glass"></i>
            <input type="text" id="function-search-v3" placeholder="Search functions..." autocomplete="off">
          </div>
          <div class="formula-v3-drawer-content" id="function-list-v3">
            ${this._renderFunctionList()}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render a context field dropdown
   */
  _renderContextField(fieldKey) {
    const config = EVALUATION_CONTEXTS[fieldKey];
    const currentValue = this.evaluationContext[fieldKey];
    const currentOption = config.options.find(o => o.value === currentValue) || config.options[0];

    return `
      <div class="formula-v3-context-field">
        <label>${config.label}</label>
        <div class="formula-v3-context-select" data-field="${fieldKey}">
          <span class="formula-v3-context-select-value">${currentOption.label}</span>
          <span class="formula-v3-context-select-hint">${currentOption.hint}</span>
          <i class="ph ph-caret-down"></i>
          <select class="formula-v3-context-select-input" data-field="${fieldKey}">
            ${config.options.map(opt => `
              <option value="${opt.value}" ${opt.value === currentValue ? 'selected' : ''}>
                ${opt.label}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
    `;
  }

  /**
   * Render field pills for quick insertion
   */
  _renderFieldPills(fields) {
    if (fields.length === 0) return '';

    const displayFields = fields.slice(0, 5);
    const remainingCount = fields.length - 5;

    return displayFields.map(field => `
      <button type="button" class="formula-v3-pill formula-v3-field-pill" data-field-name="${this._escapeHtml(field.name)}">
        {${this._escapeHtml(field.name)}}
      </button>
    `).join('') + (remainingCount > 0 ? `
      <button type="button" class="formula-v3-pill formula-v3-more-fields">
        +${remainingCount} more
      </button>
    ` : '');
  }

  /**
   * Render quick insert buttons
   */
  _renderQuickInserts() {
    const quickFunctions = ['NOW()', 'IF()', 'BLANK()', 'AND', '<', '='];
    return quickFunctions.map(fn => `
      <button type="button" class="formula-v3-pill formula-v3-fn-pill" data-insert="${fn}">
        ${fn}
      </button>
    `).join('');
  }

  /**
   * Render the function list organized by category
   */
  _renderFunctionList() {
    return Object.entries(this.functionCategories).map(([key, category]) => `
      <div class="formula-v3-fn-group" data-category="${key}">
        <button type="button" class="formula-v3-fn-group-header">
          <i class="ph ${category.icon}"></i>
          <span>${category.name}</span>
          <span class="formula-v3-fn-group-count">${category.functions.length}</span>
          <i class="ph ph-caret-right formula-v3-fn-group-arrow"></i>
        </button>
        <div class="formula-v3-fn-group-content">
          ${category.functions.map(fn => `
            <button type="button" class="formula-v3-fn-item" data-syntax="${this._escapeHtml(fn.syntax)}">
              <div class="formula-v3-fn-name">${fn.name}</div>
              <div class="formula-v3-fn-syntax">${this._escapeHtml(fn.syntax)}</div>
              <div class="formula-v3-fn-desc">${fn.description}</div>
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  /**
   * Attach all event listeners
   */
  _attachEventListeners() {
    const modalEl = this.modal?.element;
    if (!modalEl) return;

    // Formula input - real-time parsing and autocomplete
    const formulaInput = modalEl.querySelector('#formula-input-v3');
    if (formulaInput) {
      formulaInput.addEventListener('input', (e) => {
        this._updateFromFormula(formulaInput.value);
        this._handleAutocomplete(formulaInput);
      });

      formulaInput.addEventListener('keydown', (e) => {
        this._handleAutocompleteKeydown(e, formulaInput);
      });

      formulaInput.addEventListener('blur', () => {
        // Delay hiding to allow click on suggestion
        setTimeout(() => this._hideAutocomplete(), 150);
      });
    }

    // Result type pills
    modalEl.querySelectorAll('.formula-v3-type-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        modalEl.querySelectorAll('.formula-v3-type-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        const type = pill.dataset.type;
        const hiddenInput = modalEl.querySelector('#formula-result-type-v3');
        if (hiddenInput) hiddenInput.value = type;
        // Update header label
        const label = modalEl.querySelector('.formula-v3-result-type-label');
        if (label) label.textContent = RESULT_TYPES[type]?.label || type;
      });
    });

    // Field pills
    modalEl.querySelectorAll('.formula-v3-field-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const fieldName = pill.dataset.fieldName;
        this._insertAtCursor(`{${fieldName}}`);
      });
    });

    // Function/operator quick inserts
    modalEl.querySelectorAll('.formula-v3-fn-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const insertText = pill.dataset.insert;
        this._insertAtCursor(insertText);
      });
    });

    // Context field selects
    modalEl.querySelectorAll('.formula-v3-context-select-input').forEach(select => {
      select.addEventListener('change', () => {
        const field = select.dataset.field;
        const value = select.value;
        this.evaluationContext[field] = value;
        // Update display
        const container = select.closest('.formula-v3-context-select');
        const valueEl = container?.querySelector('.formula-v3-context-select-value');
        const hintEl = container?.querySelector('.formula-v3-context-select-hint');
        const option = EVALUATION_CONTEXTS[field]?.options.find(o => o.value === value);
        if (valueEl && option) valueEl.textContent = option.label;
        if (hintEl && option) hintEl.textContent = option.hint;
        // Update cadence label in header
        if (field === 'updateRhythm') {
          const cadenceLabel = modalEl.querySelector('.formula-v3-cadence-label');
          if (cadenceLabel && option) cadenceLabel.textContent = option.label;
        }
        // Update preview
        this._updateFromFormula(formulaInput?.value || '');
      });
    });

    // Function browser toggle
    const browseFnBtn = modalEl.querySelector('#btn-browse-functions');
    const fnDrawer = modalEl.querySelector('#function-browser-drawer');
    const closeFnBtn = modalEl.querySelector('#close-function-browser');

    if (browseFnBtn && fnDrawer) {
      browseFnBtn.addEventListener('click', () => {
        fnDrawer.classList.add('open');
      });
    }
    if (closeFnBtn && fnDrawer) {
      closeFnBtn.addEventListener('click', () => {
        fnDrawer.classList.remove('open');
      });
    }

    // Function group expand/collapse
    modalEl.querySelectorAll('.formula-v3-fn-group-header').forEach(header => {
      header.addEventListener('click', () => {
        const group = header.closest('.formula-v3-fn-group');
        if (group) group.classList.toggle('expanded');
      });
    });

    // Function item click
    modalEl.querySelectorAll('.formula-v3-fn-item').forEach(item => {
      item.addEventListener('click', () => {
        const syntax = item.dataset.syntax;
        this._insertAtCursor(syntax);
        fnDrawer?.classList.remove('open');
      });
    });

    // Function search
    const fnSearch = modalEl.querySelector('#function-search-v3');
    if (fnSearch) {
      fnSearch.addEventListener('input', () => {
        this._filterFunctions(fnSearch.value);
      });
    }

    // Save buttons
    const saveBtn = modalEl.querySelector('#btn-save-formula');
    const saveFooterBtn = modalEl.querySelector('#btn-save-formula-footer');
    [saveBtn, saveFooterBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => this._handleSave());
      }
    });

    // Cancel button
    const cancelBtn = modalEl.querySelector('#btn-cancel-formula');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (this.onCancel) this.onCancel();
        this.modal.hide();
      });
    }
  }

  /**
   * Update everything from the current formula
   */
  _updateFromFormula(formula) {
    const modalEl = this.modal?.element;
    if (!modalEl) return;

    // Parse the formula
    this.parsedFormula = null;
    this.detectedOperators = [];

    if (formula.trim()) {
      try {
        if (window.EOFormulaParserV2) {
          this.parsedFormula = window.EOFormulaParserV2.parse(formula);
        }
      } catch (e) {
        // Parse error - will show in preview
      }
    }

    // Detect operators from formula
    this._detectOperators(formula);

    // Update operator lens
    this._updateOperatorLens();

    // Update EO translation
    this._updateEOTranslation(formula);

    // Update result preview
    this._updateResultPreview(formula);

    // Update dependencies info
    this._updateDependenciesInfo();
  }

  /**
   * Detect which EO operators are used in the formula
   */
  _detectOperators(formula) {
    this.detectedOperators = [];
    const operatorsUsed = new Map(); // code -> { ops, examples }

    if (!formula.trim()) return;

    const upperFormula = formula.toUpperCase();

    // Check for functions
    Object.entries(PATTERN_TO_OPERATORS).forEach(([pattern, ops]) => {
      if (pattern.includes('(')) return; // Skip non-function patterns for now

      // Check if this function is used
      const fnPattern = new RegExp(`\\b${pattern}\\s*\\(`, 'i');
      if (fnPattern.test(formula) || upperFormula.includes(pattern)) {
        ops.forEach(op => {
          if (!operatorsUsed.has(op)) {
            operatorsUsed.set(op, { examples: [] });
          }
          operatorsUsed.get(op).examples.push(pattern);
        });
      }
    });

    // Check for field references → CON + DES
    if (formula.includes('{') || formula.includes('#')) {
      if (!operatorsUsed.has('CON')) {
        operatorsUsed.set('CON', { examples: [] });
      }
      operatorsUsed.get('CON').examples.push('field reference');

      if (!operatorsUsed.has('DES')) {
        operatorsUsed.set('DES', { examples: [] });
      }
      operatorsUsed.get('DES').examples.push('property access');
    }

    // Check for comparison operators → SEG + ALT
    if (/<|>|!=|<=|>=/.test(formula)) {
      if (!operatorsUsed.has('SEG')) {
        operatorsUsed.set('SEG', { examples: [] });
      }
      if (!operatorsUsed.has('ALT')) {
        operatorsUsed.set('ALT', { examples: [] });
      }
      operatorsUsed.get('SEG').examples.push('comparison');
      operatorsUsed.get('ALT').examples.push('comparison');
    }

    // Check for arithmetic → ALT
    if (/[+\-*/]/.test(formula.replace(/{[^}]*}/g, ''))) {
      if (!operatorsUsed.has('ALT')) {
        operatorsUsed.set('ALT', { examples: [] });
      }
      operatorsUsed.get('ALT').examples.push('arithmetic');
    }

    // Convert to array with descriptions
    operatorsUsed.forEach((data, code) => {
      const opInfo = EO_OPERATOR_DESCRIPTIONS[code];
      if (opInfo) {
        this.detectedOperators.push({
          ...opInfo,
          examples: [...new Set(data.examples)].slice(0, 2),
        });
      }
    });
  }

  /**
   * Update the operator lens panel
   */
  _updateOperatorLens() {
    const content = this.modal?.element?.querySelector('#operator-lens-content');
    if (!content) return;

    if (this.detectedOperators.length === 0) {
      content.innerHTML = `
        <div class="formula-v3-operators-empty">
          <i class="ph ph-brackets-curly"></i>
          <span>Enter a formula to see operators</span>
        </div>
      `;
      return;
    }

    // Use grid layout when 4+ operators, otherwise use list
    const useGrid = this.detectedOperators.length >= 4;
    const containerClass = useGrid ? 'formula-v3-operators-grid' : 'formula-v3-operators-list';

    content.innerHTML = `
      <div class="${containerClass}">
        ${this.detectedOperators.map(op => `
          <div class="formula-v3-operator ${useGrid ? 'formula-v3-operator-compact' : ''}" style="--op-color: ${op.color}; --op-bg: ${op.bgColor}">
            <div class="formula-v3-operator-header">
              <code class="formula-v3-operator-code">${op.code}</code>
              <span class="formula-v3-operator-name">${op.short}</span>
            </div>
            ${useGrid ? '' : `<div class="formula-v3-operator-desc">${op.description}</div>`}
            ${op.examples.length > 0 ? `
              <div class="formula-v3-operator-examples">
                ${op.examples.map(ex => `<span class="formula-v3-operator-example">${ex}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Update the result preview panel
   */
  _updateResultPreview(formula) {
    const content = this.modal?.element?.querySelector('#result-preview-content');
    if (!content) return;

    if (!formula.trim()) {
      content.innerHTML = `
        <div class="formula-v3-result-empty">
          <span>Preview will appear here</span>
        </div>
      `;
      return;
    }

    // Check for parse errors
    if (this.parsedFormula?.error) {
      content.innerHTML = `
        <div class="formula-v3-result-error">
          <div class="formula-v3-result-error-icon">
            <i class="ph ph-warning-circle"></i>
          </div>
          <div class="formula-v3-result-error-message">
            ${this._escapeHtml(this.parsedFormula.error)}
          </div>
        </div>
      `;
      return;
    }

    // Basic validation
    const openParens = (formula.match(/\(/g) || []).length;
    const closeParens = (formula.match(/\)/g) || []).length;
    const openBraces = (formula.match(/\{/g) || []).length;
    const closeBraces = (formula.match(/\}/g) || []).length;

    if (openParens !== closeParens) {
      content.innerHTML = `
        <div class="formula-v3-result-error">
          <div class="formula-v3-result-error-icon">
            <i class="ph ph-warning"></i>
          </div>
          <div class="formula-v3-result-error-message">
            Unbalanced parentheses
          </div>
        </div>
      `;
      return;
    }

    if (openBraces !== closeBraces) {
      content.innerHTML = `
        <div class="formula-v3-result-error">
          <div class="formula-v3-result-error-icon">
            <i class="ph ph-warning"></i>
          </div>
          <div class="formula-v3-result-error-message">
            Unbalanced braces in field reference
          </div>
        </div>
      `;
      return;
    }

    // Try to infer what the formula does
    const returnType = this.parsedFormula?.returnType || 'text';
    const resultTypeInfo = RESULT_TYPES[returnType] || RESULT_TYPES.text;

    // Evaluate against sample data from the workbench
    let sampleResult = '—';
    let resultLabel = 'Computed value';
    let sampleResults = [];

    const set = this.workbench?.getCurrentSet?.();
    const records = set?.records || [];
    const sampleRecords = records.slice(0, 3);

    if (sampleRecords.length > 0 && this.workbench?._evaluateFormula) {
      // Evaluate formula against sample records
      for (const record of sampleRecords) {
        try {
          const result = this.workbench._evaluateFormula(formula, record);
          sampleResults.push(result);
        } catch (e) {
          sampleResults.push('#ERROR');
        }
      }

      // Display results
      if (sampleResults.length === 1) {
        sampleResult = this._escapeHtml(String(sampleResults[0]));
        resultLabel = 'Sample result (row 1)';
      } else if (sampleResults.length > 1) {
        // Show multiple sample results
        const uniqueResults = [...new Set(sampleResults.map(r => String(r)))];
        if (uniqueResults.length === 1) {
          sampleResult = this._escapeHtml(uniqueResults[0]);
          resultLabel = `Consistent across ${sampleResults.length} rows`;
        } else {
          sampleResult = sampleResults.map(r => this._escapeHtml(String(r))).join(', ');
          resultLabel = `Sample results (rows 1-${sampleResults.length})`;
        }
      }
    } else {
      // Fallback: Generate a sample result based on formula pattern when no data available
      if (/\bIF\s*\(/i.test(formula)) {
        if (formula.includes('⚠️') || formula.includes('warning')) {
          sampleResult = '⚠️';
          resultLabel = 'Conditional signal';
        } else {
          sampleResult = '"..."';
          resultLabel = 'Conditional result (no sample data)';
        }
      } else if (/\b(SUM|COUNT|AVG|AVERAGE|MIN|MAX)\s*\(/i.test(formula)) {
        sampleResult = '123';
        resultLabel = 'Aggregated value';
      } else if (/\bNOW\s*\(\)/i.test(formula) || /\bTODAY\s*\(\)/i.test(formula)) {
        sampleResult = new Date().toLocaleDateString();
        resultLabel = 'Current time';
      } else if (/\bCONCATENATE\s*\(/i.test(formula) || /&/.test(formula)) {
        sampleResult = '"text..."';
        resultLabel = 'Combined text';
      }
    }

    // Determine confidence based on completeness
    const confidence = this.parsedFormula && !this.parsedFormula.error ? 'high' : 'medium';

    content.innerHTML = `
      <div class="formula-v3-result">
        <div class="formula-v3-result-main">
          <div class="formula-v3-result-value">${sampleResult}</div>
          <div class="formula-v3-result-label">${resultLabel}</div>
        </div>
        <div class="formula-v3-result-meta">
          <div class="formula-v3-result-meta-row">
            <span>Evaluated</span>
            <strong>now</strong>
          </div>
          <div class="formula-v3-result-meta-row">
            <span>Confidence</span>
            <strong>${confidence}</strong>
          </div>
          <div class="formula-v3-result-meta-row">
            <span>Cadence</span>
            <strong>${this.evaluationContext.updateRhythm.replace('_', ' ')}</strong>
          </div>
        </div>
      </div>
      <div class="formula-v3-result-tip">
        <i class="ph ph-lightbulb"></i>
        <span>Tip: Upgrade to a typed <code>state</code> for richer semantics</span>
      </div>
    `;
  }

  /**
   * Update the dependencies info in the footer
   */
  _updateDependenciesInfo() {
    const info = this.modal?.element?.querySelector('#formula-dependencies-info');
    if (!info) return;

    const deps = this.parsedFormula?.dependencies;
    if (!deps || deps.localFields.length === 0) {
      info.innerHTML = `
        <span class="formula-v3-footer-hint">
          <i class="ph ph-info"></i>
          Formula will recalculate when dependencies change
        </span>
      `;
      return;
    }

    const fieldNames = deps.localFields.slice(0, 3).join(', ');
    const more = deps.localFields.length > 3 ? ` + ${deps.localFields.length - 3} more` : '';

    let evalInfo = '';
    if (deps.functions.some(f => ['NOW', 'TODAY'].includes(f))) {
      evalInfo = ' or when time reference ticks';
    }

    info.innerHTML = `
      <span class="formula-v3-footer-hint">
        <i class="ph ph-link"></i>
        Recalculates when <strong>${fieldNames}${more}</strong> changes${evalInfo}
      </span>
    `;
  }

  /**
   * Insert text at cursor position in formula textarea
   */
  _insertAtCursor(text) {
    const textarea = this.modal?.element?.querySelector('#formula-input-v3');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);

    textarea.value = before + text + after;

    // Position cursor appropriately
    let cursorPos = start + text.length;
    if (text.includes('(') && text.includes(')')) {
      cursorPos = start + text.indexOf('(') + 1;
    }

    textarea.setSelectionRange(cursorPos, cursorPos);
    textarea.focus();

    // Trigger update
    this._updateFromFormula(textarea.value);
  }

  /**
   * Filter functions in the function browser
   */
  _filterFunctions(query) {
    const modalEl = this.modal?.element;
    if (!modalEl) return;

    const normalizedQuery = query.toLowerCase().trim();
    const groups = modalEl.querySelectorAll('.formula-v3-fn-group');

    groups.forEach(group => {
      const items = group.querySelectorAll('.formula-v3-fn-item');
      let hasVisible = false;

      items.forEach(item => {
        const name = item.querySelector('.formula-v3-fn-name')?.textContent.toLowerCase() || '';
        const desc = item.querySelector('.formula-v3-fn-desc')?.textContent.toLowerCase() || '';
        const matches = normalizedQuery === '' || name.includes(normalizedQuery) || desc.includes(normalizedQuery);

        item.style.display = matches ? '' : 'none';
        if (matches) hasVisible = true;
      });

      group.style.display = hasVisible ? '' : 'none';
      if (normalizedQuery && hasVisible) {
        group.classList.add('expanded');
      }
    });
  }

  /**
   * Handle save button click
   */
  _handleSave() {
    const modalEl = this.modal?.element;
    const nameInput = modalEl?.querySelector('#formula-field-name-v3');
    const formulaInput = modalEl?.querySelector('#formula-input-v3');
    const resultTypeInput = modalEl?.querySelector('#formula-result-type-v3');

    const name = nameInput?.value?.trim() || '';
    const formula = formulaInput?.value?.trim() || '';
    const resultType = resultTypeInput?.value || 'text';

    // Validation
    if (!name) {
      this._showFieldError(nameInput, 'Field name is required');
      return;
    }

    if (!formula) {
      this._showFieldError(formulaInput, 'Formula is required');
      return;
    }

    // Check for duplicate field names
    const set = this.workbench.getCurrentSet();
    const existingField = set?.fields.find(f =>
      f.name.toLowerCase() === name.toLowerCase() &&
      f.id !== this.field?.id
    );

    if (existingField) {
      this._showFieldError(nameInput, 'A field with this name already exists');
      return;
    }

    // Call save callback with extended options
    if (this.onSave) {
      this.onSave({
        name,
        formula,
        resultType,
        evaluationContext: { ...this.evaluationContext },
      });
    }

    this.modal.hide();
  }

  /**
   * Show error on a field
   */
  _showFieldError(input, message) {
    if (!input) return;

    input.classList.add('error');

    // Remove existing error message
    const parent = input.parentNode;
    const existingError = parent.querySelector('.formula-v3-field-error');
    if (existingError) existingError.remove();

    // Add error message
    const errorEl = document.createElement('div');
    errorEl.className = 'formula-v3-field-error';
    errorEl.textContent = message;
    parent.appendChild(errorEl);

    // Focus and shake
    input.focus();
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 500);

    // Clear error on input
    const clearError = () => {
      input.classList.remove('error');
      errorEl.remove();
      input.removeEventListener('input', clearError);
    };
    input.addEventListener('input', clearError);
  }

  /**
   * Update the EO translation panel
   */
  _updateEOTranslation(formula) {
    const content = this.modal?.element?.querySelector('#eo-translation-content');
    if (!content) return;

    if (!formula.trim()) {
      content.innerHTML = `
        <div class="formula-v3-eo-empty">
          <span>EO translation will appear here</span>
        </div>
      `;
      return;
    }

    // Convert formula to EO notation
    const eoTranslation = this._translateToEO(formula);

    content.innerHTML = `
      <div class="formula-v3-eo-translation">
        <div class="formula-v3-eo-code">
          ${eoTranslation.map(line => `<div class="formula-v3-eo-line">${line}</div>`).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Translate a formula to EO operation(target, object, [parameter]) notation
   */
  _translateToEO(formula) {
    const lines = [];
    const fieldRefs = formula.match(/\{([^}]+)\}/g) || [];

    // Extract field references → CON operations
    fieldRefs.forEach(ref => {
      const fieldName = ref.replace(/[{}]/g, '');
      lines.push(`<span class="eo-op-con">CON</span>(record, <span class="eo-field">"${fieldName}"</span>)`);
    });

    // Detect and translate functions
    const fnMatches = [...formula.matchAll(/(\b[A-Z_]+)\s*\(/gi)];
    fnMatches.forEach(match => {
      const fnName = match[1].toUpperCase();
      const fnConfig = this._getEOFunctionTranslation(fnName);
      if (fnConfig) {
        lines.push(fnConfig);
      }
    });

    // Detect comparisons → SEG operations
    if (/<|>|<=|>=|!=|=(?!=)/.test(formula)) {
      const compMatch = formula.match(/([^<>=!]+)\s*(<|>|<=|>=|!=|=)\s*([^<>=!]+)/);
      if (compMatch) {
        const op = compMatch[2];
        lines.push(`<span class="eo-op-seg">SEG</span>(value, <span class="eo-param">"${op}"</span>, [boundary])`);
      }
    }

    // Detect arithmetic → ALT operations
    if (/[+\-*/]/.test(formula.replace(/\{[^}]*\}/g, '').replace(/"[^"]*"/g, ''))) {
      lines.push(`<span class="eo-op-alt">ALT</span>(value, transform, [operand])`);
    }

    if (lines.length === 0) {
      lines.push(`<span class="eo-comment">// Enter a formula to see EO translation</span>`);
    }

    return lines;
  }

  /**
   * Get EO translation for a specific function
   */
  _getEOFunctionTranslation(fnName) {
    const translations = {
      'IF': `<span class="eo-op-seg">SEG</span>(condition, <span class="eo-param">"true"</span>, [then_branch])\n  → <span class="eo-op-alt">ALT</span>(branch, value, [])`,
      'SWITCH': `<span class="eo-op-seg">SEG</span>(expr, pattern, [result])`,
      'AND': `<span class="eo-op-syn">SYN</span>(conditions, <span class="eo-param">"all"</span>, [])`,
      'OR': `<span class="eo-op-syn">SYN</span>(conditions, <span class="eo-param">"any"</span>, [])`,
      'NOT': `<span class="eo-op-alt">ALT</span>(value, <span class="eo-param">"negate"</span>, [])`,
      'SUM': `<span class="eo-op-syn">SYN</span>(values, <span class="eo-param">"sum"</span>, [])`,
      'AVERAGE': `<span class="eo-op-syn">SYN</span>(values, <span class="eo-param">"mean"</span>, [])`,
      'AVG': `<span class="eo-op-syn">SYN</span>(values, <span class="eo-param">"mean"</span>, [])`,
      'MIN': `<span class="eo-op-syn">SYN</span>(values, <span class="eo-param">"min"</span>, [])\n  → <span class="eo-op-seg">SEG</span>(result, boundary, [])`,
      'MAX': `<span class="eo-op-syn">SYN</span>(values, <span class="eo-param">"max"</span>, [])\n  → <span class="eo-op-seg">SEG</span>(result, boundary, [])`,
      'COUNT': `<span class="eo-op-syn">SYN</span>(values, <span class="eo-param">"count"</span>, [])`,
      'CONCATENATE': `<span class="eo-op-syn">SYN</span>(strings, <span class="eo-param">"concat"</span>, [])`,
      'LEFT': `<span class="eo-op-alt">ALT</span>(string, <span class="eo-param">"slice"</span>, [0, n])\n  → <span class="eo-op-seg">SEG</span>(string, position, [n])`,
      'RIGHT': `<span class="eo-op-alt">ALT</span>(string, <span class="eo-param">"slice"</span>, [-n])\n  → <span class="eo-op-seg">SEG</span>(string, position, [n])`,
      'MID': `<span class="eo-op-alt">ALT</span>(string, <span class="eo-param">"slice"</span>, [start, count])\n  → <span class="eo-op-seg">SEG</span>(string, range, [start, end])`,
      'UPPER': `<span class="eo-op-alt">ALT</span>(string, <span class="eo-param">"uppercase"</span>, [])`,
      'LOWER': `<span class="eo-op-alt">ALT</span>(string, <span class="eo-param">"lowercase"</span>, [])`,
      'TRIM': `<span class="eo-op-alt">ALT</span>(string, <span class="eo-param">"trim"</span>, [])`,
      'NOW': `<span class="eo-op-con">CON</span>(system, <span class="eo-param">"time"</span>, [])\n  → <span class="eo-op-alt">ALT</span>(time, <span class="eo-param">"format"</span>, [])`,
      'TODAY': `<span class="eo-op-con">CON</span>(system, <span class="eo-param">"date"</span>, [])`,
      'DATEADD': `<span class="eo-op-alt">ALT</span>(date, <span class="eo-param">"add"</span>, [count, unit])`,
      'DATETIME_DIFF': `<span class="eo-op-alt">ALT</span>(date1, <span class="eo-param">"diff"</span>, [date2, unit])`,
      'BLANK': `<span class="eo-op-nul">NUL</span>(value, <span class="eo-param">"check"</span>, [])`,
      'ISERROR': `<span class="eo-op-nul">NUL</span>(expr, <span class="eo-param">"error_check"</span>, [])\n  → <span class="eo-op-seg">SEG</span>(result, boolean, [])`,
      'SUPERPOSE': `<span class="eo-op-sup">SUP</span>(values, <span class="eo-param">"hold"</span>, [])`,
      'WEIGHTED': `<span class="eo-op-sup">SUP</span>(values, <span class="eo-param">"weighted"</span>, [weights])`,
      'COLLAPSE': `<span class="eo-op-sup">SUP</span>(superposition, <span class="eo-param">"collapse"</span>, [method])\n  → <span class="eo-op-syn">SYN</span>(values, method, [])`,
    };
    return translations[fnName] || null;
  }

  /**
   * Handle autocomplete for formula input
   */
  _handleAutocomplete(textarea) {
    const cursorPos = textarea.selectionStart;
    const text = textarea.value.substring(0, cursorPos);

    // Find current word being typed
    const wordMatch = text.match(/([A-Z_][A-Z_0-9]*)$/i);
    if (!wordMatch || wordMatch[1].length < 2) {
      this._hideAutocomplete();
      return;
    }

    const query = wordMatch[1].toUpperCase();
    const suggestions = this.allFunctions.filter(fn =>
      fn.name.startsWith(query) || fn.name.includes(query)
    ).slice(0, 8);

    if (suggestions.length === 0) {
      this._hideAutocomplete();
      return;
    }

    this.autocompleteSuggestions = suggestions;
    this.autocompleteIndex = 0;
    this._showAutocomplete(suggestions, wordMatch[1].length);
  }

  /**
   * Show autocomplete dropdown
   */
  _showAutocomplete(suggestions, wordLength) {
    const dropdown = this.modal?.element?.querySelector('#formula-autocomplete');
    const list = this.modal?.element?.querySelector('#formula-autocomplete-list');
    if (!dropdown || !list) return;

    list.innerHTML = suggestions.map((fn, i) => `
      <div class="formula-v3-autocomplete-item ${i === 0 ? 'selected' : ''}" data-index="${i}" data-syntax="${this._escapeHtml(fn.syntax)}">
        <div class="formula-v3-autocomplete-name">${fn.name}</div>
        <div class="formula-v3-autocomplete-desc">${fn.description}</div>
      </div>
    `).join('');

    // Attach click handlers
    list.querySelectorAll('.formula-v3-autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const syntax = item.dataset.syntax;
        this._selectAutocompleteSuggestion(syntax);
      });
    });

    dropdown.style.display = 'block';
    this.autocompleteVisible = true;
  }

  /**
   * Hide autocomplete dropdown
   */
  _hideAutocomplete() {
    const dropdown = this.modal?.element?.querySelector('#formula-autocomplete');
    if (dropdown) {
      dropdown.style.display = 'none';
    }
    this.autocompleteVisible = false;
    this.autocompleteSuggestions = [];
    this.autocompleteIndex = 0;
  }

  /**
   * Handle keyboard navigation in autocomplete
   */
  _handleAutocompleteKeydown(e, textarea) {
    if (!this.autocompleteVisible) return;

    const list = this.modal?.element?.querySelector('#formula-autocomplete-list');
    if (!list) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.autocompleteIndex = Math.min(this.autocompleteIndex + 1, this.autocompleteSuggestions.length - 1);
      this._updateAutocompleteSelection(list);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.autocompleteIndex = Math.max(this.autocompleteIndex - 1, 0);
      this._updateAutocompleteSelection(list);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (this.autocompleteSuggestions.length > 0) {
        e.preventDefault();
        const selected = this.autocompleteSuggestions[this.autocompleteIndex];
        if (selected) {
          this._selectAutocompleteSuggestion(selected.syntax);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._hideAutocomplete();
    }
  }

  /**
   * Update visual selection in autocomplete list
   */
  _updateAutocompleteSelection(list) {
    list.querySelectorAll('.formula-v3-autocomplete-item').forEach((item, i) => {
      item.classList.toggle('selected', i === this.autocompleteIndex);
    });
  }

  /**
   * Insert selected autocomplete suggestion
   */
  _selectAutocompleteSuggestion(syntax) {
    const textarea = this.modal?.element?.querySelector('#formula-input-v3');
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const text = textarea.value;

    // Find the word to replace
    const beforeCursor = text.substring(0, cursorPos);
    const wordMatch = beforeCursor.match(/([A-Z_][A-Z_0-9]*)$/i);
    const wordStart = wordMatch ? cursorPos - wordMatch[1].length : cursorPos;

    // Replace the partial word with the full syntax
    const before = text.substring(0, wordStart);
    const after = text.substring(cursorPos);
    textarea.value = before + syntax + after;

    // Position cursor inside the parentheses
    const parenPos = syntax.indexOf('(');
    const newCursorPos = wordStart + (parenPos >= 0 ? parenPos + 1 : syntax.length);
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();

    this._hideAutocomplete();
    this._updateFromFormula(textarea.value);
  }

  /**
   * Get flat list of all functions for autocomplete
   */
  _getAllFunctions() {
    const functions = [];
    const categories = this._getFunctionCategories();
    Object.values(categories).forEach(category => {
      category.functions.forEach(fn => {
        functions.push(fn);
      });
    });
    return functions;
  }

  /**
   * Get function categories (same as V2 for compatibility)
   */
  _getFunctionCategories() {
    return {
      logical: {
        name: 'Logical',
        icon: 'ph-git-branch',
        functions: [
          { name: 'IF', syntax: 'IF(condition, value_if_true, value_if_false)', description: 'Conditional logic' },
          { name: 'SWITCH', syntax: 'SWITCH(expr, [pattern, result]..., [default])', description: 'Match patterns' },
          { name: 'AND', syntax: 'AND(logical1, [logical2, ...])', description: 'True if all true' },
          { name: 'OR', syntax: 'OR(logical1, [logical2, ...])', description: 'True if any true' },
          { name: 'NOT', syntax: 'NOT(logical)', description: 'Reverse logical value' },
          { name: 'BLANK', syntax: 'BLANK()', description: 'Returns blank value' },
          { name: 'ISERROR', syntax: 'ISERROR(expression)', description: 'Check if expression errors' },
        ]
      },
      numeric: {
        name: 'Numeric',
        icon: 'ph-hash',
        functions: [
          { name: 'SUM', syntax: 'SUM(number1, [number2, ...])', description: 'Sum of numbers' },
          { name: 'AVERAGE', syntax: 'AVERAGE(number1, [number2, ...])', description: 'Average of numbers' },
          { name: 'MAX', syntax: 'MAX(number1, [number2, ...])', description: 'Maximum value' },
          { name: 'MIN', syntax: 'MIN(number1, [number2, ...])', description: 'Minimum value' },
          { name: 'COUNT', syntax: 'COUNT(value1, [value2, ...])', description: 'Count numeric values' },
          { name: 'ROUND', syntax: 'ROUND(number, precision)', description: 'Round to precision' },
          { name: 'ABS', syntax: 'ABS(number)', description: 'Absolute value' },
        ]
      },
      text: {
        name: 'Text',
        icon: 'ph-text-aa',
        functions: [
          { name: 'CONCATENATE', syntax: 'CONCATENATE(text1, [text2, ...])', description: 'Joins text values' },
          { name: 'LEFT', syntax: 'LEFT(string, howMany)', description: 'Extract from beginning' },
          { name: 'RIGHT', syntax: 'RIGHT(string, howMany)', description: 'Extract from end' },
          { name: 'MID', syntax: 'MID(string, start, count)', description: 'Extract substring' },
          { name: 'LEN', syntax: 'LEN(string)', description: 'String length' },
          { name: 'UPPER', syntax: 'UPPER(string)', description: 'Convert to uppercase' },
          { name: 'LOWER', syntax: 'LOWER(string)', description: 'Convert to lowercase' },
          { name: 'TRIM', syntax: 'TRIM(string)', description: 'Remove whitespace' },
        ]
      },
      date: {
        name: 'Date & Time',
        icon: 'ph-calendar',
        functions: [
          { name: 'NOW', syntax: 'NOW()', description: 'Current date and time' },
          { name: 'TODAY', syntax: 'TODAY()', description: 'Current date' },
          { name: 'DATEADD', syntax: 'DATEADD(date, count, unit)', description: 'Add to date' },
          { name: 'DATETIME_DIFF', syntax: 'DATETIME_DIFF(date1, date2, [unit])', description: 'Difference between dates' },
          { name: 'YEAR', syntax: 'YEAR(date)', description: 'Extract year' },
          { name: 'MONTH', syntax: 'MONTH(date)', description: 'Extract month' },
          { name: 'DAY', syntax: 'DAY(date)', description: 'Extract day' },
        ]
      },
      semantic: {
        name: 'Semantic (EO)',
        icon: 'ph-flow-arrow',
        functions: [
          { name: 'EXCEPT', syntax: 'EXCEPT(value, exclusion, ...)', description: 'Value unless exclusion matches' },
          { name: 'UNLESS', syntax: 'UNLESS(value, exception, default)', description: 'Value unless exception' },
          { name: 'VALID_WHEN', syntax: 'VALID_WHEN(value, scope)', description: 'Attach validity scope' },
          { name: 'ASSUMING', syntax: 'ASSUMING(value, assumption, ...)', description: 'Value with assumptions' },
          { name: 'DIAGNOSTIC', syntax: 'DIAGNOSTIC(value)', description: 'Mark as non-assertive' },
        ]
      },
      superposition: {
        name: 'Superposition',
        icon: 'ph-git-fork',
        functions: [
          { name: 'SUPERPOSE', syntax: 'SUPERPOSE(value1, value2, [...])', description: 'Hold multiple values' },
          { name: 'WEIGHTED', syntax: 'WEIGHTED(value1, weight1, [...])', description: 'Weighted superposition' },
          { name: 'COLLAPSE', syntax: 'COLLAPSE(superposition, method)', description: 'Force resolution' },
          { name: 'IS_SUPERPOSED', syntax: 'IS_SUPERPOSED(value)', description: 'Check if superposed' },
        ]
      },
    };
  }

  /**
   * Escape HTML special characters
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ============================================================================
// Export
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EOFormulaEditorV3 };
}

if (typeof window !== 'undefined') {
  window.EOFormulaEditorV3 = EOFormulaEditorV3;
}
