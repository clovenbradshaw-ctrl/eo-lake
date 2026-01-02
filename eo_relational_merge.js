/**
 * EO Relational Merge - Phase-Space Mode
 *
 * Refactored to center on the 3 Questions framework.
 *
 * CORE PRINCIPLE:
 * Users don't choose joins. They answer three questions about how
 * realities should relate - and the system derives everything else.
 *
 * THE THREE QUESTIONS:
 * 1. Recognition: "Who is recognized as a row/entity?"
 * 2. Boundary: "What happens to mismatches/absence?"
 * 3. Resolution: "When do differences collapse?"
 *
 * See eo_merge_questions.js for the core model.
 */

// Import or reference the Questions model
// (In browser, these are global; in Node, use require)
const Questions = (typeof require !== 'undefined')
  ? require('./eo_merge_questions.js')
  : {
      Recognition: window.Recognition,
      Boundary: window.Boundary,
      Resolution: window.Resolution,
      MergePosition: window.MergePosition,
      MergeExecutor: window.MergeExecutor,
      createMerge: window.createMerge,
      Presets: window.Presets,
      MODES: window.MERGE_MODES_27,
      findModeByKey: window.findModeByKey
    };

// ============================================================================
// UI OPTIONS - User-facing presentations of the 3 Questions
// ============================================================================

/**
 * Recognition options for UI
 */
const RECOGNITION_OPTIONS = {
  MUTUAL: {
    id: 'mutual',
    phaseValue: -1,
    title: 'Keep only matches',
    description: 'Only rows that exist in both sources.',
    details: 'Like finding the overlap in a Venn diagram. If a record doesn\'t have a match in both sources, it\'s excluded.',
    tag: 'INNER JOIN',
    icon: 'ph-handshake',
    sqlFamily: 'INNER',
    sqlHint: 'SELECT * FROM A INNER JOIN B'
  },
  ONE_SIDED: {
    id: 'one_sided',
    phaseValue: 1,
    title: 'Keep all from one side',
    description: 'All rows from primary source, matches from other.',
    details: 'Keep every record from your chosen "primary" source. Add matching data from the other source where available.',
    tag: 'LEFT/RIGHT JOIN',
    icon: 'ph-crown-simple',
    requiresDirection: true,
    sqlFamily: 'LEFT/RIGHT',
    sqlHint: 'SELECT * FROM A LEFT JOIN B'
  },
  INDEPENDENT: {
    id: 'independent',
    phaseValue: 0,
    title: 'Keep all from both',
    description: 'All rows from both sources, matched where possible.',
    details: 'Include every record from both sources. Matched rows are combined; unmatched rows appear with gaps.',
    tag: 'FULL OUTER JOIN',
    icon: 'ph-users-three',
    sqlFamily: 'FULL',
    sqlHint: 'SELECT * FROM A FULL OUTER JOIN B'
  }
};

/**
 * Boundary options for UI
 */
const BOUNDARY_OPTIONS = {
  DROP: {
    id: 'drop',
    phaseValue: -1,
    title: 'Remove unmatched rows',
    description: 'Discard rows without matches.',
    details: 'Rows that don\'t find a match are excluded from results. Simplest output, but you lose visibility into what didn\'t match.',
    tag: 'Filter out gaps',
    icon: 'ph-prohibit',
    warning: 'Unmatched rows will be permanently excluded.',
    sqlHint: 'WHERE match IS NOT NULL'
  },
  MARK: {
    id: 'mark',
    phaseValue: 1,
    title: 'Keep with NULL values',
    description: 'Unmatched rows show NULL for missing fields.',
    details: 'Standard SQL behavior. Unmatched rows are kept but have NULL values where data from the other source would appear.',
    tag: 'Standard NULLs',
    icon: 'ph-minus-circle',
    sqlHint: 'Unmatched fields → NULL'
  },
  EXPOSE: {
    id: 'expose',
    phaseValue: '√2',
    title: 'Track gaps as data',
    description: 'Create visible records of what didn\'t match.',
    details: 'In addition to NULLs, generate gap analysis: counts of unmatched rows, which sources they came from, and diagnostic tables.',
    tag: 'Gap analysis',
    icon: 'ph-chart-bar',
    sqlHint: '+ gap tracking tables'
  }
};

/**
 * Resolution options for UI
 */
const RESOLUTION_OPTIONS = {
  IMMEDIATE: {
    id: 'immediate',
    phaseValue: -1,
    title: 'Create final result',
    description: 'The merged data is ready to use.',
    details: 'Merge produces a single, definitive output. Any conflicts are resolved during the merge. Best for production data.',
    tag: 'Final output',
    icon: 'ph-lightning',
    sqlHint: 'CREATE TABLE merged_result AS ...'
  },
  DEFERRED: {
    id: 'deferred',
    phaseValue: 1,
    title: 'Create staging table',
    description: 'Review and clean up before finalizing.',
    details: 'Merge creates a working copy for inspection. You can review conflicts, fix issues, then finalize. Best for data cleaning workflows.',
    tag: 'Review first',
    icon: 'ph-hourglass-medium',
    sqlHint: 'CREATE TEMP TABLE staging AS ...'
  },
  NON_FINAL: {
    id: 'non_final',
    phaseValue: 0,
    title: 'Keep both versions',
    description: 'Preserve all source data for comparison.',
    details: 'Both source perspectives remain visible. Use for auditing, comparing datasets over time, or when you need to see "what changed".',
    tag: 'Compare mode',
    icon: 'ph-magnifying-glass',
    sqlHint: 'UNION ALL with source markers'
  }
};

// Alias for backward compatibility
const DECISION_OPTIONS = RESOLUTION_OPTIONS;

// ============================================================================
// RelationalMergeConfig - Configuration State (delegates to MergePosition)
// ============================================================================

class RelationalMergeConfig {
  constructor() {
    this.reset();
  }

  reset() {
    // The 3 answers
    this._recognition = null;
    this._boundary = null;
    this._resolution = null;
    this._direction = null;

    // Sources and join configuration
    this.leftSource = null;
    this.rightSource = null;
    this.joinConditions = [];
    this.outputFields = [];
    this.setName = '';

    // Internal position (rebuilt on changes)
    this._position = null;
  }

  // === Setters that update the position ===

  setRecognition(recognition, direction = null) {
    this._recognition = recognition;
    this._direction = recognition === 'one_sided' ? (direction || 'left') : null;
    this._rebuildPosition();
  }

  setBoundary(boundary) {
    this._boundary = boundary;
    this._rebuildPosition();
  }

  setResolution(resolution) {
    this._resolution = resolution;
    this._rebuildPosition();
  }

  // Alias for backward compatibility
  setDecision(decision) {
    this.setResolution(decision);
  }

  _rebuildPosition() {
    if (this._recognition && this._boundary && this._resolution) {
      this._position = new Questions.MergePosition(
        this._recognition,
        this._boundary,
        this._resolution,
        this._direction
      );
    } else {
      this._position = null;
    }
  }

  // === Getters (delegate to position) ===

  get recognition() { return this._recognition; }
  get boundary() { return this._boundary; }
  get resolution() { return this._resolution; }
  get decision() { return this._resolution; } // alias
  get recognitionDirection() { return this._direction; }

  getPosition() {
    return this._position;
  }

  isComplete() {
    return this._position?.isComplete() ?? false;
  }

  getCoordinates() {
    return this._position?.getCoordinates() ?? null;
  }

  getConfigKey() {
    return this._position?.getModeKey() ?? null;
  }

  getMergeMode() {
    const key = this.getConfigKey();
    return key ? Questions.findModeByKey(key) : null;
  }

  getDerivedOperation() {
    return this._position?.deriveBehavior() ?? null;
  }

  getJoinType() {
    return this._position?.deriveJoinType() ?? null;
  }

  getSummary() {
    const recognitionLabel = this._recognition
      ? RECOGNITION_OPTIONS[this._recognition.toUpperCase()]?.title || this._recognition
      : 'Not set';
    const boundaryLabel = this._boundary
      ? BOUNDARY_OPTIONS[this._boundary.toUpperCase()]?.title || this._boundary
      : 'Not set';
    const resolutionLabel = this._resolution
      ? RESOLUTION_OPTIONS[this._resolution.toUpperCase()]?.title || this._resolution
      : 'Not set';

    return {
      recognition: recognitionLabel,
      boundary: boundaryLabel,
      resolution: resolutionLabel,
      decision: resolutionLabel // alias
    };
  }

  getPlainLanguageDescription() {
    return this._position?.describe() ?? null;
  }

  getGuardrailWarnings() {
    const warnings = this._position?.getWarnings() ?? [];
    return warnings.map(w => w.message);
  }

  getRecommendations() {
    const recommendations = [];
    if (this._position?.isRecommended()) {
      recommendations.push('This is an EO-recommended configuration.');
    }

    if (this._boundary === 'drop' && this._resolution === 'immediate') {
      recommendations.push('Consider using "Mark mismatches" or "Defer resolution" for more visibility.');
    }

    return recommendations;
  }

  toJSON() {
    const mode = this.getMergeMode();
    const behavior = this.getDerivedOperation();

    return {
      // The 3 answers
      recognition: this._recognition,
      boundary: this._boundary,
      resolution: this._resolution,
      recognitionDirection: this._direction,

      // Derived values
      coordinates: this.getCoordinates(),
      configKey: this.getConfigKey(),
      mergeMode: mode ? { key: mode.id, name: mode.name } : null,
      derivedOperation: behavior,
      joinType: this.getJoinType(),

      // Sources and config
      leftSource: this.leftSource?.id,
      rightSource: this.rightSource?.id,
      joinConditions: this.joinConditions,
      outputFields: this.outputFields,
      setName: this.setName
    };
  }
}

// ============================================================================
// RelationalMergeUI - User Interface
// ============================================================================

class RelationalMergeUI {
  constructor(sourceStore, container) {
    this.sourceStore = sourceStore;
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    this.config = new RelationalMergeConfig();
    this._onComplete = null;
    this._onCancel = null;
    this._currentStep = 'sources';
    this._purposeShown = false;
  }

  show(options = {}) {
    this._onComplete = options.onComplete;
    this._onCancel = options.onCancel;
    this._purposeShown = false;
    this._currentStep = 'sources';
    this.config.reset();
    this._render();
  }

  hide() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
    }
  }

  _render() {
    let sources = this.sourceStore.getByStatus?.('active') || [];
    if (sources.length === 0) {
      sources = this.sourceStore.getAll?.() || [];
    }

    this.container.style.display = 'block';
    this.container.innerHTML = `
      <div class="relational-merge-overlay">
        <div class="relational-merge-modal">
          ${this._renderHeader()}
          <div class="relational-merge-body">
            ${this._renderStepIndicator()}
            ${this._renderCurrentStep(sources)}
          </div>
          ${this._renderFooter()}
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  _renderHeader() {
    return `
      <div class="relational-merge-header">
        <h2><i class="ph ph-git-merge"></i> Relational Merge</h2>
        <p class="relational-merge-subtitle">Phase-Space Mode</p>
        <button class="relational-merge-close" id="rm-close-btn">
          <i class="ph ph-x"></i>
        </button>
      </div>
    `;
  }

  _renderStepIndicator() {
    const steps = [
      { id: 'sources', label: 'Sources', icon: 'ph-database' },
      { id: 'questions', label: 'Three Questions', icon: 'ph-compass' },
      { id: 'conditions', label: 'Conditions', icon: 'ph-link' },
      { id: 'review', label: 'Review', icon: 'ph-check-circle' }
    ];

    const currentIndex = steps.findIndex(s => s.id === this._currentStep);

    return `
      <div class="rm-step-indicator">
        ${steps.map((step, i) => `
          <div class="rm-step ${i === currentIndex ? 'active' : ''} ${i < currentIndex ? 'completed' : ''}">
            <div class="rm-step-icon">
              ${i < currentIndex ? '<i class="ph ph-check"></i>' : `<i class="ph ${step.icon}"></i>`}
            </div>
            <span class="rm-step-label">${step.label}</span>
          </div>
          ${i < steps.length - 1 ? '<div class="rm-step-line"></div>' : ''}
        `).join('')}
      </div>
    `;
  }

  _renderCurrentStep(sources) {
    switch (this._currentStep) {
      case 'sources':
        return this._renderSourcesStep(sources);
      case 'questions':
        return this._renderQuestionsStep();
      case 'conditions':
        return this._renderConditionsStep();
      case 'review':
        return this._renderReviewStep();
      default:
        return '';
    }
  }

  _renderSourcesStep(sources) {
    return `
      <div class="rm-step-content">
        <div class="rm-sources-section">
          <div class="rm-source-picker">
            <label>First Source (A)</label>
            <select id="rm-left-source" class="rm-source-select">
              <option value="">Select source...</option>
              ${sources.map(s => `
                <option value="${s.id}" ${String(this.config.leftSource?.id) === String(s.id) ? 'selected' : ''}>
                  ${this._escapeHtml(s.name)} (${s.recordCount} records)
                </option>
              `).join('')}
            </select>
            ${this.config.leftSource ? this._renderSourcePreview(this.config.leftSource, 'left') : ''}
          </div>

          <div class="rm-source-connector">
            <div class="rm-connector-icon">
              <i class="ph ph-git-merge"></i>
            </div>
          </div>

          <div class="rm-source-picker">
            <label>Second Source (B)</label>
            <select id="rm-right-source" class="rm-source-select">
              <option value="">Select source...</option>
              ${sources.map(s => `
                <option value="${s.id}" ${String(this.config.rightSource?.id) === String(s.id) ? 'selected' : ''}>
                  ${this._escapeHtml(s.name)} (${s.recordCount} records)
                </option>
              `).join('')}
            </select>
            ${this.config.rightSource ? this._renderSourcePreview(this.config.rightSource, 'right') : ''}
          </div>
        </div>
      </div>
    `;
  }

  _renderSourcePreview(source, side) {
    const fields = source.schema?.fields || [];
    return `
      <div class="rm-source-preview">
        <div class="rm-source-stats">
          <span><i class="ph ph-rows"></i> ${source.recordCount} records</span>
          <span><i class="ph ph-columns"></i> ${fields.length} fields</span>
        </div>
        <div class="rm-field-list">
          ${fields.slice(0, 6).map(f => `
            <span class="rm-field-chip">
              <i class="ph ${this._getFieldTypeIcon(f.type)}"></i>
              ${this._escapeHtml(f.name)}
            </span>
          `).join('')}
          ${fields.length > 6 ? `<span class="rm-field-more">+${fields.length - 6} more</span>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * The Three Questions step - the heart of the UI
   */
  _renderQuestionsStep() {
    return `
      <div class="rm-step-content rm-questions-content">
        ${!this._purposeShown ? `
          <div class="rm-purpose-banner" id="rm-purpose-banner">
            <p><em>Answer three questions to configure your merge. Each maps to familiar SQL concepts.</em></p>
            <button class="rm-purpose-dismiss" id="rm-purpose-dismiss">
              <i class="ph ph-x"></i>
            </button>
          </div>
        ` : ''}

        <div class="rm-panels">
          ${this._renderQuestionPanel('recognition', '1. Which Rows to Include', 'Which records appear in the output?', RECOGNITION_OPTIONS)}
          ${this._renderQuestionPanel('boundary', '2. Handle Unmatched Rows', 'What happens to rows without matches?', BOUNDARY_OPTIONS)}
          ${this._renderQuestionPanel('resolution', '3. Output Type', 'What kind of result do you want?', RESOLUTION_OPTIONS)}
        </div>

        ${this._renderPositionSummary()}
      </div>
    `;
  }

  _renderQuestionPanel(questionId, title, question, options) {
    const currentValue = this.config[questionId];
    const isSet = currentValue !== null;

    // Get SQL crosswalk hint for this question type
    const sqlCrosswalk = this._getSqlCrosswalk(questionId);

    return `
      <div class="rm-panel ${isSet ? 'rm-panel-set' : ''}" data-panel="${questionId}">
        <div class="rm-panel-header">
          <h3><i class="ph ${this._getQuestionIcon(questionId)}"></i> ${title}</h3>
          <span class="rm-panel-question">${question}</span>
        </div>
        ${sqlCrosswalk ? `<div class="rm-panel-sql-hint"><i class="ph ph-database"></i> ${sqlCrosswalk}</div>` : ''}

        <div class="rm-options">
          ${Object.values(options).map(opt => `
            <button type="button" class="rm-option ${currentValue === opt.id ? 'selected' : ''}"
                    data-question="${questionId}" data-value="${opt.id}">
              <div class="rm-option-icon"><i class="ph ${opt.icon}"></i></div>
              <div class="rm-option-content">
                <span class="rm-option-title">${opt.title}</span>
                <span class="rm-option-desc">${opt.description}</span>
                <span class="rm-option-details">${opt.details}</span>
                ${opt.sqlHint ? `<span class="rm-option-sql-hint"><code>${opt.sqlHint}</code></span>` : ''}
              </div>
              <span class="rm-option-tag">${opt.tag}</span>
            </button>
          `).join('')}
        </div>

        ${questionId === 'recognition' && currentValue === 'one_sided' ? `
          <div class="rm-direction-picker">
            <label>Which source has authority?</label>
            <div class="rm-direction-options">
              <button class="rm-direction-btn ${this.config.recognitionDirection === 'left' ? 'selected' : ''}"
                      data-direction="left">
                <i class="ph ph-arrow-left"></i>
                <span>Source A (${this._escapeHtml(this.config.leftSource?.name || 'Left')})</span>
              </button>
              <button class="rm-direction-btn ${this.config.recognitionDirection === 'right' ? 'selected' : ''}"
                      data-direction="right">
                <i class="ph ph-arrow-right"></i>
                <span>Source B (${this._escapeHtml(this.config.rightSource?.name || 'Right')})</span>
              </button>
            </div>
          </div>
        ` : ''}

        ${questionId === 'boundary' && currentValue === 'drop' ? `
          <div class="rm-panel-note">
            <i class="ph ph-warning"></i>
            <span>Erased gaps cannot be recovered.</span>
          </div>
        ` : ''}

        ${isSet ? '<div class="rm-panel-status"><i class="ph ph-check-circle"></i> Answered</div>' : ''}
      </div>
    `;
  }

  _getQuestionIcon(questionId) {
    switch (questionId) {
      case 'recognition': return 'ph-users';
      case 'boundary': return 'ph-map-trifold';
      case 'resolution': return 'ph-clock';
      default: return 'ph-question';
    }
  }

  _getSqlCrosswalk(questionId) {
    switch (questionId) {
      case 'recognition':
        return 'SQL equivalent: Determines JOIN type (INNER, LEFT, RIGHT, FULL)';
      case 'boundary':
        return 'SQL equivalent: How unmatched rows are handled (filtered, NULL, tracked)';
      case 'resolution':
        return 'SQL equivalent: Result table type (permanent, temp/staging, view)';
      default:
        return null;
    }
  }

  _renderPositionSummary() {
    if (!this.config.isComplete()) {
      return `
        <div class="rm-phase-summary rm-phase-incomplete">
          <div class="rm-phase-header">
            <i class="ph ph-compass"></i>
            <span>Merge Position</span>
          </div>
          <p class="rm-phase-message">Answer all three questions to define the merge position.</p>
        </div>
      `;
    }

    const summary = this.config.getSummary();
    const description = this.config.getPlainLanguageDescription();
    const warnings = this.config.getGuardrailWarnings();
    const recommendations = this.config.getRecommendations();
    const behavior = this.config.getDerivedOperation();
    const mode = this.config.getMergeMode();
    const coords = this.config.getCoordinates();

    return `
      <div class="rm-phase-summary rm-phase-complete">
        <div class="rm-phase-header">
          <i class="ph ph-check-circle"></i>
          <span>Position Defined</span>
          ${mode ? `<code class="rm-mode-code">${mode.id} [${coords.join(', ')}]</code>` : ''}
        </div>

        ${mode ? `<div class="rm-mode-name">${mode.name}</div>` : ''}

        <div class="rm-phase-values">
          <div class="rm-phase-value">
            <label>Recognition:</label>
            <span>${summary.recognition}</span>
          </div>
          <div class="rm-phase-value">
            <label>Boundaries:</label>
            <span>${summary.boundary}</span>
          </div>
          <div class="rm-phase-value">
            <label>Resolution:</label>
            <span>${summary.resolution}</span>
          </div>
        </div>

        <p class="rm-phase-description">${description}</p>

        ${recommendations.length > 0 ? `
          <div class="rm-phase-recommendations">
            ${recommendations.map(r => `
              <div class="rm-recommendation">
                <i class="ph ph-star"></i>
                <span>${r}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${warnings.length > 0 ? `
          <div class="rm-phase-warnings">
            ${warnings.map(w => `
              <div class="rm-warning">
                <i class="ph ph-info"></i>
                <span>${w}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <details class="rm-derived-operation">
          <summary><i class="ph ph-code"></i> Derived behavior</summary>
          <div class="rm-derived-content">
            <div class="rm-derived-sql">
              <strong>SQL equivalent:</strong>
              <code>${behavior?.sqlEquivalent || 'Custom logic required'}</code>
            </div>
            <div class="rm-derived-flags">
              <span>Preserve NULLs: ${behavior?.preserveNulls ? 'Yes' : 'No'}</span>
              <span>Expose structure: ${behavior?.exposeStructure ? 'Yes' : 'No'}</span>
              <span>Defer decision: ${behavior?.deferDecision ? 'Yes' : 'No'}</span>
            </div>
            ${behavior?.requiresCustomLogic ? `
              <p class="rm-derived-note">
                <em>This configuration requires staged or custom logic beyond standard SQL.</em>
              </p>
            ` : ''}
          </div>
        </details>
      </div>
    `;
  }

  _renderConditionsStep() {
    const leftFields = this.config.leftSource?.schema?.fields || [];
    const rightFields = this.config.rightSource?.schema?.fields || [];

    return `
      <div class="rm-step-content">
        <div class="rm-conditions-section">
          <h3><i class="ph ph-link"></i> Join Conditions</h3>
          <p class="rm-section-desc">Map fields between sources to connect records</p>

          <div class="rm-conditions-list" id="rm-conditions-list">
            ${this.config.joinConditions.length === 0 ? `
              <div class="rm-condition-empty">
                <i class="ph ph-arrow-fat-lines-right"></i>
                <span>Add a condition to connect the sources</span>
              </div>
            ` : this.config.joinConditions.map((c, i) => this._renderCondition(c, i, leftFields, rightFields)).join('')}
          </div>

          <button class="rm-add-condition-btn" id="rm-add-condition-btn">
            <i class="ph ph-plus"></i> Add Condition
          </button>
        </div>

        <div class="rm-output-section">
          <h3><i class="ph ph-columns"></i> Output Fields</h3>
          <p class="rm-section-desc">Select which fields to include in the result</p>

          <div class="rm-output-controls">
            <button class="rm-output-btn" id="rm-add-all-left-btn">
              <i class="ph ph-check-square"></i> Add All from A
            </button>
            <button class="rm-output-btn" id="rm-add-all-right-btn">
              <i class="ph ph-check-square"></i> Add All from B
            </button>
          </div>

          <div class="rm-output-list" id="rm-output-list">
            ${this.config.outputFields.length === 0 ? `
              <div class="rm-output-empty">
                <span>No fields selected</span>
              </div>
            ` : this.config.outputFields.map((f, i) => this._renderOutputField(f, i)).join('')}
          </div>
        </div>

        <div class="rm-name-section">
          <label>Set Name</label>
          <input type="text" id="rm-set-name" class="rm-set-name-input"
                 placeholder="Enter name for the merged set..."
                 value="${this._escapeHtml(this.config.setName || '')}">
        </div>
      </div>
    `;
  }

  _renderCondition(condition, index, leftFields, rightFields) {
    return `
      <div class="rm-condition" data-index="${index}">
        <select class="rm-condition-left">
          <option value="">Select field from A...</option>
          ${leftFields.map(f => `
            <option value="${f.name}" ${condition.leftField === f.name ? 'selected' : ''}>
              ${this._escapeHtml(f.name)}
            </option>
          `).join('')}
        </select>

        <select class="rm-condition-operator">
          <option value="eq" ${condition.operator === 'eq' ? 'selected' : ''}>=</option>
          <option value="contains" ${condition.operator === 'contains' ? 'selected' : ''}>contains</option>
          <option value="starts" ${condition.operator === 'starts' ? 'selected' : ''}>starts with</option>
          <option value="ends" ${condition.operator === 'ends' ? 'selected' : ''}>ends with</option>
        </select>

        <select class="rm-condition-right">
          <option value="">Select field from B...</option>
          ${rightFields.map(f => `
            <option value="${f.name}" ${condition.rightField === f.name ? 'selected' : ''}>
              ${this._escapeHtml(f.name)}
            </option>
          `).join('')}
        </select>

        <button class="rm-condition-remove" title="Remove condition">
          <i class="ph ph-x"></i>
        </button>
      </div>
    `;
  }

  _renderOutputField(field, index) {
    return `
      <div class="rm-output-field" data-index="${index}">
        <span class="rm-output-source ${field.source}">
          ${field.source === 'left' ? 'A' : 'B'}
        </span>
        <span class="rm-output-name">${this._escapeHtml(field.field)}</span>
        <button class="rm-output-remove" title="Remove field">
          <i class="ph ph-x"></i>
        </button>
      </div>
    `;
  }

  _renderReviewStep() {
    const summary = this.config.getSummary();
    const behavior = this.config.getDerivedOperation();

    return `
      <div class="rm-step-content rm-review-content">
        <div class="rm-review-section">
          <h3><i class="ph ph-info"></i> Merge Summary</h3>

          <div class="rm-review-grid">
            <div class="rm-review-item">
              <label>Sources</label>
              <div class="rm-review-sources">
                <span class="rm-review-source">${this._escapeHtml(this.config.leftSource?.name || 'Source A')}</span>
                <i class="ph ph-git-merge"></i>
                <span class="rm-review-source">${this._escapeHtml(this.config.rightSource?.name || 'Source B')}</span>
              </div>
            </div>

            <div class="rm-review-item">
              <label>Three Questions Answered</label>
              <div class="rm-review-position">
                <span><strong>Recognition:</strong> ${summary.recognition}</span>
                <span><strong>Boundaries:</strong> ${summary.boundary}</span>
                <span><strong>Resolution:</strong> ${summary.resolution}</span>
              </div>
            </div>

            <div class="rm-review-item">
              <label>Derived Operation</label>
              <code class="rm-review-operation">${behavior?.sqlEquivalent || 'Custom'}</code>
            </div>

            <div class="rm-review-item">
              <label>Join Conditions</label>
              <div class="rm-review-conditions">
                ${this.config.joinConditions.length === 0
                  ? '<span class="rm-review-empty">No conditions defined</span>'
                  : this.config.joinConditions.map(c =>
                      `<span>${this._escapeHtml(c.leftField)} ${c.operator === 'eq' ? '=' : c.operator} ${this._escapeHtml(c.rightField)}</span>`
                    ).join('')
                }
              </div>
            </div>

            <div class="rm-review-item">
              <label>Output Fields</label>
              <span>${this.config.outputFields.length} fields selected</span>
            </div>

            <div class="rm-review-item">
              <label>Result Set Name</label>
              <span>${this._escapeHtml(this.config.setName) || 'Untitled'}</span>
            </div>
          </div>
        </div>

        <div class="rm-review-preview" id="rm-preview-section">
          <button class="rm-preview-btn" id="rm-preview-btn">
            <i class="ph ph-eye"></i> Preview Results
          </button>
          <div class="rm-preview-results" id="rm-preview-results"></div>
        </div>

        <div class="rm-review-warning">
          <i class="ph ph-warning"></i>
          <span>What you erase now cannot be recovered.</span>
        </div>
      </div>
    `;
  }

  _renderFooter() {
    const canProceed = this._canProceedFromCurrentStep();
    const isLastStep = this._currentStep === 'review';

    return `
      <div class="relational-merge-footer">
        <div class="rm-footer-left">
          ${this._currentStep !== 'sources' ? `
            <button class="rm-btn rm-btn-secondary" id="rm-back-btn">
              <i class="ph ph-arrow-left"></i> Back
            </button>
          ` : ''}
        </div>
        <div class="rm-footer-right">
          <button class="rm-btn rm-btn-secondary" id="rm-cancel-btn">Cancel</button>
          <button class="rm-btn rm-btn-primary" id="rm-next-btn" ${!canProceed ? 'disabled' : ''}>
            ${isLastStep ? '<i class="ph ph-check"></i> Apply merge' : 'Continue <i class="ph ph-arrow-right"></i>'}
          </button>
        </div>
        ${isLastStep ? '<p class="rm-footer-warning">You can revise these later. What you erase now cannot be recovered.</p>' : ''}
      </div>
    `;
  }

  _canProceedFromCurrentStep() {
    switch (this._currentStep) {
      case 'sources':
        return this.config.leftSource && this.config.rightSource;
      case 'questions':
        return this.config.isComplete();
      case 'conditions':
        const validConditions = this.config.joinConditions.filter(c => c.leftField && c.rightField);
        return validConditions.length > 0 && this.config.outputFields.length > 0;
      case 'review':
        return true;
      default:
        return false;
    }
  }

  _attachEventListeners() {
    // Footer navigation
    const footer = this.container.querySelector('.relational-merge-footer');
    if (footer) {
      footer.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.id === 'rm-cancel-btn') {
          this.hide();
          this._onCancel?.();
        } else if (btn.id === 'rm-back-btn') {
          this._goToPreviousStep();
        } else if (btn.id === 'rm-next-btn' && !btn.disabled) {
          if (this._currentStep === 'review') {
            this._executeMerge();
          } else {
            this._goToNextStep();
          }
        }
      });
    }

    // Close button
    this.container.querySelector('#rm-close-btn')?.addEventListener('click', () => {
      this.hide();
      this._onCancel?.();
    });

    // Purpose banner dismiss
    this.container.querySelector('#rm-purpose-dismiss')?.addEventListener('click', () => {
      this._purposeShown = true;
      this.container.querySelector('#rm-purpose-banner')?.remove();
    });

    // Source selection
    this.container.querySelector('#rm-left-source')?.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      let source = this.sourceStore.get?.(selectedId);
      if (!source) {
        source = this.sourceStore.getAll?.().find(s => String(s.id) === String(selectedId));
      }
      this.config.leftSource = source;
      this._render();
    });

    this.container.querySelector('#rm-right-source')?.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      let source = this.sourceStore.get?.(selectedId);
      if (!source) {
        source = this.sourceStore.getAll?.().find(s => String(s.id) === String(selectedId));
      }
      this.config.rightSource = source;
      this._render();
    });

    // Question answers - using event delegation for reliability
    // This fixes issues where buttons in later panels might not respond
    const panelsContainer = this.container.querySelector('.rm-panels');
    if (panelsContainer) {
      panelsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.rm-option');
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        const question = btn.dataset.question;
        const value = btn.dataset.value;

        if (question === 'recognition') {
          this.config.setRecognition(value);
        } else if (question === 'boundary') {
          this.config.setBoundary(value);
        } else if (question === 'resolution') {
          this.config.setResolution(value);
        }

        this._render();
      });
    }

    // Direction selection
    this.container.querySelectorAll('.rm-direction-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.config.setRecognition('one_sided', btn.dataset.direction);
        this._render();
      });
    });

    // Conditions step
    this.container.querySelector('#rm-add-condition-btn')?.addEventListener('click', () => {
      this.config.joinConditions.push({
        id: `cond_${Date.now()}`,
        leftField: '',
        rightField: '',
        operator: 'eq'
      });
      this._render();
    });

    this.container.querySelectorAll('.rm-condition').forEach(condEl => {
      const index = parseInt(condEl.dataset.index);
      const condition = this.config.joinConditions[index];

      condEl.querySelector('.rm-condition-left')?.addEventListener('change', (e) => {
        condition.leftField = e.target.value;
        this._updateNextButtonState();
      });

      condEl.querySelector('.rm-condition-operator')?.addEventListener('change', (e) => {
        condition.operator = e.target.value;
      });

      condEl.querySelector('.rm-condition-right')?.addEventListener('change', (e) => {
        condition.rightField = e.target.value;
        this._updateNextButtonState();
      });

      condEl.querySelector('.rm-condition-remove')?.addEventListener('click', () => {
        this.config.joinConditions.splice(index, 1);
        this._render();
      });
    });

    // Output fields
    this.container.querySelector('#rm-add-all-left-btn')?.addEventListener('click', () => {
      this._addAllFieldsFromSource('left');
    });

    this.container.querySelector('#rm-add-all-right-btn')?.addEventListener('click', () => {
      this._addAllFieldsFromSource('right');
    });

    this.container.querySelectorAll('.rm-output-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.closest('.rm-output-field').dataset.index);
        this.config.outputFields.splice(index, 1);
        this._render();
      });
    });

    // Set name
    this.container.querySelector('#rm-set-name')?.addEventListener('input', (e) => {
      this.config.setName = e.target.value;
    });

    // Preview
    this.container.querySelector('#rm-preview-btn')?.addEventListener('click', () => {
      this._showPreview();
    });
  }

  _updateNextButtonState() {
    const nextBtn = this.container.querySelector('#rm-next-btn');
    if (nextBtn) {
      nextBtn.disabled = !this._canProceedFromCurrentStep();
    }
  }

  _goToNextStep() {
    const steps = ['sources', 'questions', 'conditions', 'review'];
    const currentIndex = steps.indexOf(this._currentStep);
    if (currentIndex < steps.length - 1) {
      this._currentStep = steps[currentIndex + 1];
      this._render();
    }
  }

  _goToPreviousStep() {
    const steps = ['sources', 'questions', 'conditions', 'review'];
    const currentIndex = steps.indexOf(this._currentStep);
    if (currentIndex > 0) {
      this._currentStep = steps[currentIndex - 1];
      this._render();
    }
  }

  _addAllFieldsFromSource(side) {
    const source = side === 'left' ? this.config.leftSource : this.config.rightSource;
    if (!source) return;

    const fields = source.schema?.fields || [];
    for (const field of fields) {
      const exists = this.config.outputFields.some(f =>
        f.source === side && f.field === field.name
      );
      if (!exists) {
        this.config.outputFields.push({
          source: side,
          field: field.name,
          type: field.type
        });
      }
    }
    this._render();
  }

  _showPreview() {
    const previewEl = this.container.querySelector('#rm-preview-results');
    if (!previewEl) return;

    const validConditions = this.config.joinConditions.filter(c =>
      c.leftField && c.rightField
    );

    if (validConditions.length === 0) {
      previewEl.innerHTML = `
        <div class="rm-preview-error">
          <i class="ph ph-warning"></i>
          <span>Add at least one complete join condition</span>
        </div>
      `;
      return;
    }

    try {
      const position = this.config.getPosition();
      const executor = new Questions.MergeExecutor();

      const leftRecords = this.config.leftSource?.records || [];
      const rightRecords = this.config.rightSource?.records || [];

      const outputFields = this.config.outputFields.map(f => ({
        name: f.field,
        source: f.source,
        originalField: f.field,
        type: f.type
      }));

      const result = executor.execute(
        position,
        leftRecords,
        rightRecords,
        validConditions,
        outputFields
      );

      if (!result.success) {
        previewEl.innerHTML = `
          <div class="rm-preview-error">
            <i class="ph ph-warning"></i>
            <span>${result.error || 'Preview failed'}</span>
          </div>
        `;
        return;
      }

      const records = result.records.slice(0, 10);
      const fields = outputFields;

      previewEl.innerHTML = `
        <div class="rm-preview-table-wrapper">
          <table class="rm-preview-table">
            <thead>
              <tr>
                ${fields.map(f => `<th>${this._escapeHtml(f.name)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${records.map(rec => `
                <tr>
                  ${fields.map(f => `
                    <td>${this._escapeHtml(String(rec.values?.[f.name] ?? ''))}</td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="rm-preview-info">
          Showing ${records.length} of ${result.totalCount} records
        </div>
      `;
    } catch (error) {
      previewEl.innerHTML = `
        <div class="rm-preview-error">
          <i class="ph ph-warning"></i>
          <span>${error.message || 'Preview failed'}</span>
        </div>
      `;
    }
  }

  _executeMerge() {
    const validConditions = this.config.joinConditions.filter(c => c.leftField && c.rightField);
    if (validConditions.length === 0) {
      alert('At least one complete join condition is required');
      return;
    }

    if (this.config.outputFields.length === 0) {
      alert('At least one output field must be selected');
      return;
    }

    const timestamp = new Date().toISOString();
    const setId = `set_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    const fields = this.config.outputFields.map((f, i) => ({
      id: `fld_${setId}_${i}`,
      name: f.rename || f.field,
      originalField: f.field,
      source: f.source,
      type: f.type || 'text',
      width: 150
    }));

    const newSet = {
      id: setId,
      name: this.config.setName || 'Merged Set',
      icon: 'ph-git-merge',
      fields: fields,
      records: [],
      recordCount: null,
      isVirtual: true,
      views: [{
        id: `view_${Date.now().toString(36)}`,
        name: 'All Records',
        type: 'table',
        config: {}
      }],
      createdAt: timestamp,
      updatedAt: timestamp,
      derivation: {
        strategy: 'CON',
        operator: 'relational_merge',
        sourceItems: [
          { type: 'source', id: this.config.leftSource?.id, name: this.config.leftSource?.name },
          { type: 'source', id: this.config.rightSource?.id, name: this.config.rightSource?.name }
        ],
        // Store the 3 questions answers
        threeQuestions: {
          recognition: this.config.recognition,
          boundary: this.config.boundary,
          resolution: this.config.resolution,
          direction: this.config.recognitionDirection
        },
        relationalPosition: this.config.toJSON(),
        joinConfig: {
          type: this.config.getJoinType(),
          conditions: validConditions.map(c => ({
            leftField: c.leftField,
            rightField: c.rightField,
            operator: c.operator || 'eq'
          }))
        },
        outputFields: this.config.outputFields.map(f => ({
          field: f.field,
          source: f.source,
          rename: f.rename,
          type: f.type
        }))
      }
    };

    this.hide();
    this._onComplete?.({
      set: newSet,
      isVirtual: true,
      stats: {
        resultRecords: 'pending',
        leftSource: this.config.leftSource?.name,
        rightSource: this.config.rightSource?.name,
        leftRecordCount: this.config.leftSource?.recordCount || 0,
        rightRecordCount: this.config.rightSource?.recordCount || 0,
        joinType: this.config.getJoinType(),
        threeQuestions: {
          recognition: this.config.recognition,
          boundary: this.config.boundary,
          resolution: this.config.resolution
        }
      }
    });
  }

  _getFieldTypeIcon(type) {
    const typeIcons = {
      'text': 'ph-text-t',
      'number': 'ph-hash',
      'date': 'ph-calendar',
      'datetime': 'ph-clock',
      'boolean': 'ph-toggle-left',
      'currency': 'ph-currency-dollar',
      'email': 'ph-envelope',
      'url': 'ph-link',
      'phone': 'ph-phone'
    };
    return typeIcons[type?.toLowerCase()] || 'ph-text-t';
  }

  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// ============================================================================
// Export
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RelationalMergeConfig,
    RelationalMergeUI,
    RECOGNITION_OPTIONS,
    BOUNDARY_OPTIONS,
    RESOLUTION_OPTIONS,
    DECISION_OPTIONS
  };
}

if (typeof window !== 'undefined') {
  window.RelationalMergeConfig = RelationalMergeConfig;
  window.RelationalMergeUI = RelationalMergeUI;
  window.RECOGNITION_OPTIONS = RECOGNITION_OPTIONS;
  window.BOUNDARY_OPTIONS = BOUNDARY_OPTIONS;
  window.RESOLUTION_OPTIONS = RESOLUTION_OPTIONS;
  window.DECISION_OPTIONS = DECISION_OPTIONS;
}
