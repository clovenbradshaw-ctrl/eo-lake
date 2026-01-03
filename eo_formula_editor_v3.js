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

    // Debounce timer for formula updates (prevents UI freezing)
    this._updateDebounceTimer = null;

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
    // Destroy any existing modal and clear pending timers
    if (this.modal) {
      this.modal.destroy();
      this.modal = null;
    }
    clearTimeout(this._updateDebounceTimer);

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
        clearTimeout(this._updateDebounceTimer);
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
            <div class="formula-v3-drawer-actions">
              <button type="button" class="formula-v3-drawer-btn" id="btn-export-functions" title="Export function library for auditing">
                <i class="ph ph-download-simple"></i>
              </button>
              <button type="button" class="formula-v3-drawer-close" id="close-function-browser">
                <i class="ph ph-x"></i>
              </button>
            </div>
          </div>
          <div class="formula-v3-drawer-hint">
            <i class="ph ph-info"></i>
            <span>Right-click or Shift+click any function to view implementation details</span>
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
    return `
      ${this._renderReferenceSyntaxSection()}
      ${this._renderOperatorsSection()}
      <div class="formula-v3-section-divider">
        <span>Functions</span>
      </div>
      ${Object.entries(this.functionCategories).map(([key, category]) => `
        <div class="formula-v3-fn-group" data-category="${key}">
          <button type="button" class="formula-v3-fn-group-header">
            <i class="ph ${category.icon}"></i>
            <span>${category.name}</span>
            <span class="formula-v3-fn-group-count">${category.functions.length}</span>
            ${category.eoOperator ? `<span class="formula-v3-fn-group-eo">${category.eoOperator}</span>` : ''}
            <i class="ph ph-caret-right formula-v3-fn-group-arrow"></i>
          </button>
          <div class="formula-v3-fn-group-content">
            ${category.description ? `<div class="formula-v3-fn-group-desc">${category.description}</div>` : ''}
            ${category.functions.map(fn => `
              <button type="button" class="formula-v3-fn-item" data-syntax="${this._escapeHtml(fn.syntax)}">
                <div class="formula-v3-fn-name">${fn.name}</div>
                <div class="formula-v3-fn-syntax">${this._escapeHtml(fn.syntax)}</div>
                <div class="formula-v3-fn-desc">${fn.description}</div>
                ${fn.example ? `<div class="formula-v3-fn-example"><code>${this._escapeHtml(fn.example)}</code></div>` : ''}
              </button>
            `).join('')}
          </div>
        </div>
      `).join('')}
    `;
  }

  /**
   * Render the Reference Syntax documentation section
   */
  _renderReferenceSyntaxSection() {
    return `
      <div class="formula-v3-fn-group formula-v3-docs-group" data-category="reference">
        <button type="button" class="formula-v3-fn-group-header">
          <i class="ph ph-brackets-curly"></i>
          <span>Reference Syntax</span>
          <i class="ph ph-caret-right formula-v3-fn-group-arrow"></i>
        </button>
        <div class="formula-v3-fn-group-content">
          <div class="formula-v3-docs-section">
            <div class="formula-v3-docs-item" data-insert="{Field Name}">
              <div class="formula-v3-docs-syntax"><code>{Field Name}</code></div>
              <div class="formula-v3-docs-label">Same-Set Field</div>
              <div class="formula-v3-docs-desc">Reference a field in the current record</div>
              <div class="formula-v3-docs-example"><code>{Price}</code>, <code>{First Name}</code></div>
            </div>
            <div class="formula-v3-docs-item" data-insert="#Set.Field">
              <div class="formula-v3-docs-syntax"><code>#Set.Field</code></div>
              <div class="formula-v3-docs-label">Cross-Set Field</div>
              <div class="formula-v3-docs-desc">Reference a field through a connection</div>
              <div class="formula-v3-docs-example"><code>#Orders.Total</code>, <code>#Customer.Name</code></div>
            </div>
            <div class="formula-v3-docs-item" data-insert="#Set.Set.Field">
              <div class="formula-v3-docs-syntax"><code>#Set.Set.Field</code></div>
              <div class="formula-v3-docs-label">Chained Traversal</div>
              <div class="formula-v3-docs-desc">Traverse multiple connections</div>
              <div class="formula-v3-docs-example"><code>#Orders.Customer.Email</code></div>
            </div>
            <div class="formula-v3-docs-item" data-insert="$.Property">
              <div class="formula-v3-docs-syntax"><code>$</code> or <code>$.Property</code></div>
              <div class="formula-v3-docs-label">Current Item</div>
              <div class="formula-v3-docs-desc">Reference current item in MAP, FILTER, etc.</div>
              <div class="formula-v3-docs-example"><code>MAP(#Orders, $.Total * 1.1)</code></div>
            </div>
            <div class="formula-v3-docs-item" data-insert="[condition]">
              <div class="formula-v3-docs-syntax"><code>[condition]</code></div>
              <div class="formula-v3-docs-label">Filter Predicate</div>
              <div class="formula-v3-docs-desc">Filter records by condition</div>
              <div class="formula-v3-docs-example"><code>SUM(#Orders.Total, [Status = "Paid"])</code></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render the Operators documentation section
   */
  _renderOperatorsSection() {
    return `
      <div class="formula-v3-fn-group formula-v3-docs-group" data-category="operators">
        <button type="button" class="formula-v3-fn-group-header">
          <i class="ph ph-math-operations"></i>
          <span>Operators</span>
          <i class="ph ph-caret-right formula-v3-fn-group-arrow"></i>
        </button>
        <div class="formula-v3-fn-group-content">
          <div class="formula-v3-docs-section formula-v3-operators-docs">
            <div class="formula-v3-docs-row">
              <div class="formula-v3-docs-item formula-v3-docs-op" data-insert=" & ">
                <div class="formula-v3-docs-syntax"><code>&</code></div>
                <div class="formula-v3-docs-label">Concatenation</div>
                <div class="formula-v3-docs-desc">Join text values</div>
              </div>
              <div class="formula-v3-docs-item formula-v3-docs-op" data-insert=" + ">
                <div class="formula-v3-docs-syntax"><code>+ − * /</code></div>
                <div class="formula-v3-docs-label">Arithmetic</div>
                <div class="formula-v3-docs-desc">Math operations</div>
              </div>
            </div>
            <div class="formula-v3-docs-row">
              <div class="formula-v3-docs-item formula-v3-docs-op" data-insert=" = ">
                <div class="formula-v3-docs-syntax"><code>= != > < >= <=</code></div>
                <div class="formula-v3-docs-label">Comparison</div>
                <div class="formula-v3-docs-desc">Compare values</div>
              </div>
              <div class="formula-v3-docs-item formula-v3-docs-op" data-insert=" AND ">
                <div class="formula-v3-docs-syntax"><code>AND OR NOT</code></div>
                <div class="formula-v3-docs-label">Logical</div>
                <div class="formula-v3-docs-desc">Combine conditions</div>
              </div>
            </div>
          </div>
          <div class="formula-v3-docs-section formula-v3-eo-operators-docs">
            <div class="formula-v3-docs-subheader">EO Operators</div>
            <div class="formula-v3-eo-grid">
              <div class="formula-v3-eo-op" style="--op-color: #3b82f6"><code>CON</code><span>Connection</span></div>
              <div class="formula-v3-eo-op" style="--op-color: #8b5cf6"><code>SEG</code><span>Segment</span></div>
              <div class="formula-v3-eo-op" style="--op-color: #06b6d4"><code>DES</code><span>Designate</span></div>
              <div class="formula-v3-eo-op" style="--op-color: #10b981"><code>SYN</code><span>Synthesize</span></div>
              <div class="formula-v3-eo-op" style="--op-color: #f59e0b"><code>ALT</code><span>Alternate</span></div>
              <div class="formula-v3-eo-op" style="--op-color: #6b7280"><code>NUL</code><span>Null</span></div>
              <div class="formula-v3-eo-op" style="--op-color: #ec4899"><code>INS</code><span>Instantiate</span></div>
              <div class="formula-v3-eo-op" style="--op-color: #14b8a6"><code>SUP</code><span>Superpose</span></div>
              <div class="formula-v3-eo-op" style="--op-color: #f97316"><code>REC</code><span>Recursion</span></div>
            </div>
          </div>
        </div>
      </div>
    `;
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
        // Debounce expensive formula parsing and evaluation to prevent UI freezing
        clearTimeout(this._updateDebounceTimer);
        this._updateDebounceTimer = setTimeout(() => {
          this._updateFromFormula(formulaInput.value);
        }, 150);
        // Keep autocomplete responsive (lightweight operation)
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

    // Function item click - left click inserts, right click shows details
    modalEl.querySelectorAll('.formula-v3-fn-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          // Shift/Ctrl/Cmd+click shows function details
          const fnName = item.querySelector('.formula-v3-fn-name')?.textContent;
          this._showFunctionDetails(fnName);
        } else {
          // Regular click inserts syntax
          const syntax = item.dataset.syntax;
          this._insertAtCursor(syntax);
          fnDrawer?.classList.remove('open');
        }
      });
      // Add context menu for function details
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const fnName = item.querySelector('.formula-v3-fn-name')?.textContent;
        this._showFunctionDetails(fnName);
      });
    });

    // Docs items click (Reference Syntax, Operators)
    modalEl.querySelectorAll('.formula-v3-docs-item').forEach(item => {
      item.addEventListener('click', () => {
        const insertText = item.dataset.insert;
        if (insertText) {
          this._insertAtCursor(insertText);
        }
      });
    });

    // Export function library button
    const exportBtn = modalEl.querySelector('#btn-export-functions');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this._exportFunctionLibrary();
      });
    }

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
   * Get function categories - comprehensive Noema Formula Language library
   */
  _getFunctionCategories() {
    return {
      // ═══════════════════════════════════════════════════════════════
      // AGGREGATION (SYN Operator)
      // Collapse arrays to single values
      // ═══════════════════════════════════════════════════════════════
      aggregation: {
        name: 'Aggregation',
        icon: 'ph-chart-bar',
        description: 'Collapse multiple values into one',
        eoOperator: 'SYN',
        functions: [
          { name: 'SUM', syntax: 'SUM(values, [filter])', description: 'Add all numbers', example: 'SUM(#Orders.Total, [Status = "Paid"])' },
          { name: 'AVERAGE', syntax: 'AVERAGE(values, [filter])', description: 'Arithmetic mean', example: 'AVERAGE(#Reviews.Rating, [Verified = TRUE])' },
          { name: 'COUNT', syntax: 'COUNT(values, [filter])', description: 'Count items', example: 'COUNT(#Tasks, [Status = "Open"])' },
          { name: 'MIN', syntax: 'MIN(values, [filter])', description: 'Smallest value', example: 'MIN(#Bids.Amount)' },
          { name: 'MAX', syntax: 'MAX(values, [filter])', description: 'Largest value', example: 'MAX(#Scores.Value)' },
          { name: 'MEDIAN', syntax: 'MEDIAN(values)', description: 'Middle value', example: 'MEDIAN(#Sales.Amount)' },
          { name: 'FIRST', syntax: 'FIRST(values)', description: 'First item', example: 'FIRST(#Events)' },
          { name: 'LAST', syntax: 'LAST(values)', description: 'Last item', example: 'LAST(#Activities)' },
        ]
      },

      // ═══════════════════════════════════════════════════════════════
      // ARRAY (SEG + ALT Operators)
      // Transform or filter arrays
      // ═══════════════════════════════════════════════════════════════
      array: {
        name: 'Array',
        icon: 'ph-list-bullets',
        description: 'Transform and filter collections',
        eoOperator: 'SEG + ALT',
        functions: [
          { name: 'MAP', syntax: 'MAP(values, $.expression)', description: 'Transform each item', example: 'MAP(#Orders, $.Total * 1.1)' },
          { name: 'FILTER', syntax: 'FILTER(values, $.condition)', description: 'Keep matching items', example: 'FILTER(#Tasks, $.DueDate < TODAY())' },
          { name: 'SORT', syntax: 'SORT(values, $.property, direction)', description: 'Reorder items', example: 'SORT(#Items, $.Name, "asc")' },
          { name: 'UNIQUE', syntax: 'UNIQUE(values)', description: 'Remove duplicates', example: 'UNIQUE(#Tags.Name)' },
          { name: 'REVERSE', syntax: 'REVERSE(values)', description: 'Reverse order', example: 'REVERSE(#History)' },
          { name: 'FLATTEN', syntax: 'FLATTEN(values)', description: 'Flatten nested arrays', example: 'FLATTEN(#Orders.Items)' },
          { name: 'COMPACT', syntax: 'COMPACT(values)', description: 'Remove nulls/blanks', example: 'COMPACT(#Responses)' },
        ]
      },

      // ═══════════════════════════════════════════════════════════════
      // TEXT (ALT Operator)
      // Transform text values
      // ═══════════════════════════════════════════════════════════════
      text: {
        name: 'Text',
        icon: 'ph-text-aa',
        description: 'Transform and manipulate text',
        eoOperator: 'ALT',
        functions: [
          { name: 'UPPER', syntax: 'UPPER(text)', description: 'Uppercase', example: 'UPPER({Name})' },
          { name: 'LOWER', syntax: 'LOWER(text)', description: 'Lowercase', example: 'LOWER({Email})' },
          { name: 'TRIM', syntax: 'TRIM(text)', description: 'Remove whitespace', example: 'TRIM({Input})' },
          { name: 'LEFT', syntax: 'LEFT(text, count)', description: 'First N characters', example: 'LEFT({Code}, 3)' },
          { name: 'RIGHT', syntax: 'RIGHT(text, count)', description: 'Last N characters', example: 'RIGHT({Phone}, 4)' },
          { name: 'MID', syntax: 'MID(text, start, count)', description: 'Substring', example: 'MID({SSN}, 4, 2)' },
          { name: 'LEN', syntax: 'LEN(text)', description: 'Character count', example: 'LEN({Description})' },
          { name: 'FIND', syntax: 'FIND(search, text)', description: 'Position of substring', example: 'FIND("@", {Email})' },
          { name: 'REPLACE', syntax: 'REPLACE(text, start, count, new)', description: 'Replace by position', example: 'REPLACE({Phone}, 1, 3, "XXX")' },
          { name: 'SUBSTITUTE', syntax: 'SUBSTITUTE(text, old, new)', description: 'Replace all occurrences', example: 'SUBSTITUTE({Phone}, "-", "")' },
          { name: 'CONCAT', syntax: 'CONCAT(values, separator)', description: 'Join array to string', example: 'CONCAT(#Tags.Name, ", ")' },
          { name: 'SPLIT', syntax: 'SPLIT(text, delimiter)', description: 'Split string to array', example: 'SPLIT({Tags}, ",")' },
          { name: 'CONCATENATE', syntax: 'CONCATENATE(text1, text2, ...)', description: 'Join text values', example: 'CONCATENATE({First}, " ", {Last})' },
        ]
      },

      // ═══════════════════════════════════════════════════════════════
      // LOGICAL (SEG + ALT Operators)
      // Conditional logic
      // ═══════════════════════════════════════════════════════════════
      logical: {
        name: 'Logical',
        icon: 'ph-git-branch',
        description: 'Conditional logic and branching',
        eoOperator: 'SEG + ALT',
        functions: [
          { name: 'IF', syntax: 'IF(condition, ifTrue, ifFalse)', description: 'Conditional value', example: 'IF({Status} = "Active", "Yes", "No")' },
          { name: 'IFS', syntax: 'IFS(cond1, val1, cond2, val2, ...)', description: 'Multiple conditions', example: 'IFS({Score} >= 90, "A", {Score} >= 80, "B", TRUE, "C")' },
          { name: 'SWITCH', syntax: 'SWITCH(expr, case1, val1, ..., default)', description: 'Pattern match', example: 'SWITCH({Type}, "A", 1, "B", 2, 0)' },
          { name: 'AND', syntax: 'AND(cond1, cond2, ...)', description: 'All true', example: 'AND({Active}, {Verified})' },
          { name: 'OR', syntax: 'OR(cond1, cond2, ...)', description: 'Any true', example: 'OR({Admin}, {Manager})' },
          { name: 'NOT', syntax: 'NOT(condition)', description: 'Invert boolean', example: 'NOT({Archived})' },
          { name: 'XOR', syntax: 'XOR(cond1, cond2)', description: 'Exactly one true', example: 'XOR({OptionA}, {OptionB})' },
        ]
      },

      // ═══════════════════════════════════════════════════════════════
      // MATH (ALT Operator)
      // Numeric transformations
      // ═══════════════════════════════════════════════════════════════
      math: {
        name: 'Math',
        icon: 'ph-hash',
        description: 'Numeric operations and transformations',
        eoOperator: 'ALT',
        functions: [
          { name: 'ROUND', syntax: 'ROUND(number, places)', description: 'Round to decimals', example: 'ROUND({Price}, 2)' },
          { name: 'FLOOR', syntax: 'FLOOR(number, significance)', description: 'Round down', example: 'FLOOR({Value}, 10)' },
          { name: 'CEILING', syntax: 'CEILING(number, significance)', description: 'Round up', example: 'CEILING({Value}, 10)' },
          { name: 'ABS', syntax: 'ABS(number)', description: 'Absolute value', example: 'ABS({Difference})' },
          { name: 'MOD', syntax: 'MOD(number, divisor)', description: 'Remainder', example: 'MOD({Value}, 7)' },
          { name: 'POWER', syntax: 'POWER(number, exponent)', description: 'Exponentiation', example: 'POWER({Base}, 2)' },
          { name: 'SQRT', syntax: 'SQRT(number)', description: 'Square root', example: 'SQRT({Area})' },
          { name: 'LOG', syntax: 'LOG(number, base)', description: 'Logarithm', example: 'LOG({Value}, 10)' },
          { name: 'INT', syntax: 'INT(number)', description: 'Integer part', example: 'INT({Decimal})' },
          { name: 'VALUE', syntax: 'VALUE(text)', description: 'Convert text to number', example: 'VALUE({StringNum})' },
        ]
      },

      // ═══════════════════════════════════════════════════════════════
      // DATE (INS + DES + ALT Operators)
      // Temporal operations
      // ═══════════════════════════════════════════════════════════════
      date: {
        name: 'Date & Time',
        icon: 'ph-calendar',
        description: 'Temporal operations and formatting',
        eoOperator: 'INS + DES + ALT',
        functions: [
          { name: 'NOW', syntax: 'NOW()', description: 'Current datetime', example: 'NOW()' },
          { name: 'TODAY', syntax: 'TODAY()', description: 'Current date', example: 'TODAY()' },
          { name: 'DATE', syntax: 'DATE(year, month, day)', description: 'Construct date', example: 'DATE(2024, 1, 15)' },
          { name: 'YEAR', syntax: 'YEAR(date)', description: 'Extract year', example: 'YEAR({Created})' },
          { name: 'MONTH', syntax: 'MONTH(date)', description: 'Extract month (1-12)', example: 'MONTH({Date})' },
          { name: 'DAY', syntax: 'DAY(date)', description: 'Extract day (1-31)', example: 'DAY({Date})' },
          { name: 'WEEKDAY', syntax: 'WEEKDAY(date)', description: 'Day of week (1-7)', example: 'WEEKDAY({Date})' },
          { name: 'DATEADD', syntax: 'DATEADD(date, amount, unit)', description: 'Add to date', example: 'DATEADD({DueDate}, 7, "days")' },
          { name: 'DATEDIFF', syntax: 'DATEDIFF(date1, date2, unit)', description: 'Difference between dates', example: 'DATEDIFF({Start}, {End}, "days")' },
          { name: 'DATETIME_FORMAT', syntax: 'DATETIME_FORMAT(date, format)', description: 'Format date as text', example: 'DATETIME_FORMAT({Date}, "YYYY-MM-DD")' },
          { name: 'IS_BEFORE', syntax: 'IS_BEFORE(date1, date2)', description: 'Check if date1 < date2', example: 'IS_BEFORE({Start}, {End})' },
          { name: 'IS_AFTER', syntax: 'IS_AFTER(date1, date2)', description: 'Check if date1 > date2', example: 'IS_AFTER({Due}, TODAY())' },
        ]
      },

      // ═══════════════════════════════════════════════════════════════
      // NULL HANDLING (NUL Operator)
      // Handle absence
      // ═══════════════════════════════════════════════════════════════
      null: {
        name: 'Null Handling',
        icon: 'ph-prohibit',
        description: 'Handle missing or blank values',
        eoOperator: 'NUL',
        functions: [
          { name: 'BLANK', syntax: 'BLANK()', description: 'Return blank value', example: 'BLANK()' },
          { name: 'ISBLANK', syntax: 'ISBLANK(value)', description: 'Check if blank', example: 'ISBLANK({Field})' },
          { name: 'IFBLANK', syntax: 'IFBLANK(value, default)', description: 'Default if blank', example: 'IFBLANK({Nickname}, {Name})' },
          { name: 'IFERROR', syntax: 'IFERROR(value, default)', description: 'Default if error', example: 'IFERROR({Total} / {Count}, 0)' },
          { name: 'COALESCE', syntax: 'COALESCE(val1, val2, ...)', description: 'First non-blank value', example: 'COALESCE({Alt}, {Main}, "Default")' },
          { name: 'ISERROR', syntax: 'ISERROR(value)', description: 'Check if error', example: 'ISERROR({Formula})' },
        ]
      },

      // ═══════════════════════════════════════════════════════════════
      // CONNECTION (CON Operator)
      // Graph traversal
      // ═══════════════════════════════════════════════════════════════
      connection: {
        name: 'Connection',
        icon: 'ph-link',
        description: 'Graph traversal and lookups',
        eoOperator: 'CON',
        functions: [
          { name: 'LOOKUP', syntax: 'LOOKUP(#Set.Field)', description: 'Explicit lookup', example: 'LOOKUP(#Customer.Name)' },
          { name: 'ROLLUP', syntax: 'ROLLUP(#Set.Field, mode, [filter])', description: 'Aggregate over connection', example: 'ROLLUP(#Orders.Total, "SUM", [Status = "Paid"])' },
        ]
      },

      // ═══════════════════════════════════════════════════════════════
      // SEMANTIC (AV-Inspired)
      // Meaning-aware operations unique to Noema
      // ═══════════════════════════════════════════════════════════════
      semantic: {
        name: 'Semantic',
        icon: 'ph-flow-arrow',
        description: 'Meaning-aware operations (AV-inspired)',
        eoOperator: 'Multiple',
        functions: [
          { name: 'EXCEPT', syntax: 'EXCEPT(base, UNLESS(...), ...)', description: 'Truth by elimination', example: 'EXCEPT("Valid", UNLESS({HasLicense}, "Missing license"))' },
          { name: 'UNLESS', syntax: 'UNLESS(condition, reason)', description: 'Violation clause', example: 'UNLESS({HasInsurance}, "Not insured")' },
          { name: 'VALID_WHEN', syntax: 'VALID_WHEN(value, scope)', description: 'Scoped truth', example: 'VALID_WHEN(SUM(#Orders.Total), {Region} = "US")' },
          { name: 'ASSUMING', syntax: 'ASSUMING(value, assumptions...)', description: 'Attach assumptions', example: 'ASSUMING({Price}, "Currency is USD")' },
          { name: 'SCOPE_COMPATIBLE', syntax: 'SCOPE_COMPATIBLE(value, context)', description: 'Check scope match', example: 'SCOPE_COMPATIBLE({ScopedValue}, {Context})' },
          { name: 'EQUIVALENT_WHEN', syntax: 'EQUIVALENT_WHEN(a, b, retaining, ignoring)', description: 'Purpose-bound identity', example: 'EQUIVALENT_WHEN({A}, {B}, ["TaxID"], ["Source"])' },
          { name: 'DIAGNOSTIC', syntax: 'DIAGNOSTIC(value, reason)', description: 'Non-assertive value', example: 'DIAGNOSTIC({Diff}, "For review only")' },
          { name: 'REFINE_UNTIL', syntax: 'REFINE_UNTIL(initial, condition, max, rules)', description: 'Convergent iteration', example: 'REFINE_UNTIL({Raw}, STABLE, 5, ...)' },
          { name: 'FRAGILITY', syntax: 'FRAGILITY(value, conditions...)', description: 'Confidence assessment', example: 'FRAGILITY({Value}, HIGH_IF({Stale}, "Old data"))' },
        ]
      },

      // ═══════════════════════════════════════════════════════════════
      // SUPERPOSITION (SUP Operator)
      // Hold multiple values simultaneously
      // ═══════════════════════════════════════════════════════════════
      superposition: {
        name: 'Superposition',
        icon: 'ph-git-fork',
        description: 'Hold multiple contradictory values',
        eoOperator: 'SUP',
        functions: [
          { name: 'SUPERPOSE', syntax: 'SUPERPOSE(value1, value2, [...])', description: 'Hold multiple values', example: 'SUPERPOSE("Option A", "Option B")' },
          { name: 'WEIGHTED', syntax: 'WEIGHTED(value1, weight1, [...])', description: 'Weighted superposition', example: 'WEIGHTED("High", 0.7, "Low", 0.3)' },
          { name: 'COLLAPSE', syntax: 'COLLAPSE(superposition, method)', description: 'Force resolution', example: 'COLLAPSE({Sup}, "weighted")' },
          { name: 'IS_SUPERPOSED', syntax: 'IS_SUPERPOSED(value)', description: 'Check if superposed', example: 'IS_SUPERPOSED({Value})' },
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

  /**
   * Show detailed function information modal
   * Full transparency: implementation, library source, EO decomposition, pipeline
   */
  _showFunctionDetails(fnName) {
    if (!fnName) return;

    // Get function definition from the registry
    const fnDef = window.EOFormulaFunctions?.get?.(fnName);
    if (!fnDef) {
      console.warn(`Function ${fnName} not found in registry`);
      return;
    }

    // Get implementation source code
    const implSource = fnDef.implementation?.toString() || 'Implementation not available';

    // Determine library source
    const librarySource = this._getLibrarySource(fnName, fnDef);

    // Build pipeline visualization
    const pipeline = fnDef.toPipeline?.({}) || [];

    // Create the details modal
    const detailsHtml = `
      <div class="formula-v3-fn-details-modal">
        <div class="formula-v3-fn-details-header">
          <h2>${fnName}</h2>
          <span class="formula-v3-fn-details-category">${fnDef.category || 'Unknown'}</span>
          <button type="button" class="formula-v3-fn-details-close" id="close-fn-details">
            <i class="ph ph-x"></i>
          </button>
        </div>

        <div class="formula-v3-fn-details-body">
          <!-- Description -->
          <section class="formula-v3-fn-details-section">
            <h3>Description</h3>
            <p>${fnDef.description || 'No description available'}</p>
          </section>

          <!-- Syntax -->
          <section class="formula-v3-fn-details-section">
            <h3>Syntax</h3>
            <div class="formula-v3-fn-details-syntax">
              <code>${this._buildSyntaxString(fnName, fnDef.args)}</code>
            </div>
          </section>

          <!-- Arguments -->
          ${fnDef.args?.length ? `
          <section class="formula-v3-fn-details-section">
            <h3>Arguments</h3>
            <table class="formula-v3-fn-details-args">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                ${fnDef.args.map(arg => `
                  <tr>
                    <td><code>${arg.name}</code></td>
                    <td><code>${arg.type}</code></td>
                    <td>${arg.required ? '<span class="required">Yes</span>' : 'No'}</td>
                    <td>${arg.description || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </section>
          ` : ''}

          <!-- Returns -->
          <section class="formula-v3-fn-details-section">
            <h3>Returns</h3>
            <code>${fnDef.returns || 'any'}</code>
          </section>

          <!-- Examples -->
          ${fnDef.examples?.length ? `
          <section class="formula-v3-fn-details-section">
            <h3>Examples</h3>
            <div class="formula-v3-fn-details-examples">
              ${fnDef.examples.map(ex => `<code>${this._escapeHtml(ex)}</code>`).join('')}
            </div>
          </section>
          ` : ''}

          <!-- EO Decomposition -->
          <section class="formula-v3-fn-details-section">
            <h3>EO Operator Decomposition</h3>
            <div class="formula-v3-fn-details-eo">
              <div class="formula-v3-fn-details-eo-ops">
                ${(fnDef.eoDecomposition || []).map(op => {
                  const opInfo = EO_OPERATOR_DESCRIPTIONS[op] || { color: '#666' };
                  return `<span class="formula-v3-fn-eo-tag" style="--op-color: ${opInfo.color}">${op}</span>`;
                }).join(' → ')}
              </div>
              <p class="formula-v3-fn-details-eo-explanation">${fnDef.eoExplanation || ''}</p>
            </div>
          </section>

          <!-- Pipeline -->
          ${pipeline.length ? `
          <section class="formula-v3-fn-details-section">
            <h3>Evaluation Pipeline</h3>
            <div class="formula-v3-fn-details-pipeline">
              ${pipeline.map((step, i) => `
                <div class="formula-v3-pipeline-step">
                  <span class="formula-v3-pipeline-step-num">${i + 1}</span>
                  <span class="formula-v3-pipeline-step-op">${step.operator}</span>
                  <span class="formula-v3-pipeline-step-params">${JSON.stringify(step.params || {})}</span>
                </div>
              `).join('')}
            </div>
          </section>
          ` : ''}

          <!-- Library Source -->
          <section class="formula-v3-fn-details-section">
            <h3>Library Source</h3>
            <div class="formula-v3-fn-details-source">
              <div class="formula-v3-fn-source-badge ${librarySource.type}">
                <i class="ph ${librarySource.icon}"></i>
                <span>${librarySource.label}</span>
              </div>
              <p>${librarySource.description}</p>
            </div>
          </section>

          <!-- Implementation (JavaScript) -->
          <section class="formula-v3-fn-details-section">
            <h3>JavaScript Implementation</h3>
            <div class="formula-v3-fn-details-impl">
              <div class="formula-v3-impl-header">
                <span>eo_formula_functions.js</span>
                <button type="button" class="formula-v3-copy-btn" data-copy="${this._escapeHtml(implSource)}">
                  <i class="ph ph-copy"></i> Copy
                </button>
              </div>
              <pre class="formula-v3-impl-code"><code>${this._escapeHtml(implSource)}</code></pre>
            </div>
          </section>

          ${fnDef.avOrigin ? `
          <!-- AV Origin -->
          <section class="formula-v3-fn-details-section">
            <h3>AV (Advaita Vedānta) Origin</h3>
            <p class="formula-v3-fn-details-av">${fnDef.avOrigin}</p>
          </section>
          ` : ''}
        </div>

        <div class="formula-v3-fn-details-footer">
          <div class="formula-v3-fn-details-meta">
            <span>Registered in EOFormulaFunctions</span>
            <span>Category: ${fnDef.category}</span>
            ${fnDef.isVolatile ? '<span class="volatile">⚡ Volatile (re-evaluates)</span>' : ''}
          </div>
          <button type="button" class="formula-v3-btn" id="btn-use-fn">
            <i class="ph ph-plus"></i> Insert Function
          </button>
        </div>
      </div>
    `;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'formula-v3-fn-details-overlay';
    overlay.innerHTML = detailsHtml;
    document.body.appendChild(overlay);

    // Add animation
    requestAnimationFrame(() => overlay.classList.add('visible'));

    // Event handlers
    const closeBtn = overlay.querySelector('#close-fn-details');
    const useBtn = overlay.querySelector('#btn-use-fn');
    const copyBtns = overlay.querySelectorAll('.formula-v3-copy-btn');

    closeBtn?.addEventListener('click', () => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 200);
      }
    });

    useBtn?.addEventListener('click', () => {
      const syntax = this._buildSyntaxString(fnName, fnDef.args);
      this._insertAtCursor(syntax);
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
    });

    copyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.dataset.copy;
        navigator.clipboard.writeText(text).then(() => {
          btn.innerHTML = '<i class="ph ph-check"></i> Copied';
          setTimeout(() => {
            btn.innerHTML = '<i class="ph ph-copy"></i> Copy';
          }, 2000);
        });
      });
    });
  }

  /**
   * Build syntax string from function name and args
   */
  _buildSyntaxString(fnName, args) {
    if (!args || !args.length) return `${fnName}()`;
    const argParts = args.map(arg => {
      if (!arg.required) return `[${arg.name}]`;
      return arg.name;
    });
    return `${fnName}(${argParts.join(', ')})`;
  }

  /**
   * Determine the library source for a function
   */
  _getLibrarySource(fnName, fnDef) {
    // Semantic/AV functions
    if (fnDef.category === 'Semantic' || fnDef.avOrigin) {
      return {
        type: 'custom-av',
        icon: 'ph-brain',
        label: 'Noema Semantic (AV-inspired)',
        description: 'Custom implementation based on Advaita Vedānta epistemic patterns. These functions provide meaning-aware operations unique to Noema.'
      };
    }

    // Superposition functions
    if (fnDef.category === 'Superposition') {
      return {
        type: 'custom-sup',
        icon: 'ph-git-fork',
        label: 'Noema Superposition',
        description: 'Custom implementation for holding multiple contradictory values simultaneously. Unique to the EO (Epistemic Objects) framework.'
      };
    }

    // Connection/CON functions
    if (fnDef.category === 'Connection' || fnDef.eoDecomposition?.includes('CON')) {
      return {
        type: 'custom-con',
        icon: 'ph-link',
        label: 'Noema Connection',
        description: 'Custom implementation for graph traversal and relational operations. Enables cross-set field references and rollups.'
      };
    }

    // Check if using formulajs patterns
    const formulajsFunctions = ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'IF', 'AND', 'OR', 'NOT',
      'CONCATENATE', 'LEFT', 'RIGHT', 'MID', 'LEN', 'UPPER', 'LOWER', 'TRIM', 'ROUND', 'FLOOR',
      'CEILING', 'ABS', 'MOD', 'POWER', 'SQRT', 'LOG', 'NOW', 'TODAY', 'DATE', 'YEAR', 'MONTH',
      'DAY', 'HOUR', 'MINUTE', 'SECOND', 'DATEADD', 'ISBLANK', 'IFERROR', 'VALUE', 'INT'];

    if (formulajsFunctions.includes(fnName.toUpperCase())) {
      return {
        type: 'formulajs',
        icon: 'ph-function',
        label: 'formulajs-compatible',
        description: 'Implementation follows formulajs patterns for compatibility. The core logic is wrapped with EO operator decomposition for pipeline visualization.'
      };
    }

    // Default: custom Noema
    return {
      type: 'custom',
      icon: 'ph-cube',
      label: 'Noema Custom',
      description: 'Custom implementation developed for the Noema formula language. Fully auditable and traceable through the EO operator pipeline.'
    };
  }

  /**
   * Export the complete function library for auditing
   * Creates a comprehensive JSON file with all function metadata and implementations
   */
  _exportFunctionLibrary() {
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      description: 'Noema Formula Language - Complete Function Library Export',
      metadata: {
        totalFunctions: 0,
        categories: {},
        eoOperators: Object.keys(EO_OPERATOR_DESCRIPTIONS),
      },
      eoOperators: EO_OPERATOR_DESCRIPTIONS,
      functions: {},
      categoryIndex: {},
    };

    // Get all functions from registry
    const fnLib = window.EOFormulaFunctions;
    if (!fnLib) {
      console.error('EOFormulaFunctions not available');
      return;
    }

    const byCategory = fnLib.getByCategory?.() || {};

    Object.entries(byCategory).forEach(([category, functions]) => {
      exportData.metadata.categories[category] = functions.length;
      exportData.categoryIndex[category] = [];

      functions.forEach(fn => {
        exportData.metadata.totalFunctions++;
        exportData.categoryIndex[category].push(fn.name);

        // Get library source info
        const librarySource = this._getLibrarySource(fn.name, fn);

        exportData.functions[fn.name] = {
          name: fn.name,
          category: fn.category,
          description: fn.description,
          syntax: this._buildSyntaxString(fn.name, fn.args),
          arguments: fn.args?.map(arg => ({
            name: arg.name,
            type: arg.type,
            required: !!arg.required,
            description: arg.description || null,
            default: arg.default ?? null,
            options: arg.options || null,
          })) || [],
          returns: fn.returns,
          examples: fn.examples || [],
          eo: {
            decomposition: fn.eoDecomposition || [],
            explanation: fn.eoExplanation || null,
            pipeline: fn.toPipeline?.({}) || [],
          },
          avOrigin: fn.avOrigin || null,
          librarySource: {
            type: librarySource.type,
            label: librarySource.label,
            description: librarySource.description,
          },
          implementation: fn.implementation?.toString() || null,
          isVolatile: !!fn.isVolatile,
        };
      });
    });

    // Create downloadable file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noema-formula-library-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show confirmation
    const fnDrawer = this.modal?.element?.querySelector('#function-browser-drawer');
    if (fnDrawer) {
      const toast = document.createElement('div');
      toast.className = 'formula-v3-toast';
      toast.innerHTML = `
        <i class="ph ph-check-circle"></i>
        <span>Exported ${exportData.metadata.totalFunctions} functions for auditing</span>
      `;
      fnDrawer.appendChild(toast);
      setTimeout(() => toast.classList.add('visible'), 10);
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
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
