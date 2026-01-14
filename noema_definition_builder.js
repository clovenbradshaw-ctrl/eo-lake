/**
 * EO Definition Builder - 9-Parameter Definition Construction System
 *
 * Implements the full EO 9-parameter definition schema with:
 * 1. Referent - What's being defined (term, label, level, data type)
 * 2. Authority - Source authority (API lookup to Wikidata, eCFR, etc.)
 * 3. Source Document - Citation and URL
 * 4. Operator - Mode of adoption (PROJECT, SCOPE, EXTEND, COMPOSE, etc.)
 * 5. Predicate - Derived from operator (eo:definedAccordingTo, etc.)
 * 6. Frame - Dataset/context binding
 * 7. Validity - Temporal scope (effective dates, supersession)
 * 8. Jurisdiction - Geographic and program scope
 * 9. Parameters - Operational constraints (inclusions, exclusions, thresholds)
 * 10. Scope Note - STABILIZE: operational commitment
 * 11. Provenance - Who asserted, when, how
 * 12. Epistemic Stance - Confidence, accountability, intent
 *
 * Features:
 * - Multi-step form with visual progress
 * - API search integration (Wikidata, eCFR, Federal Register)
 * - Operator selection with predicate derivation
 * - Chip inputs for inclusions/exclusions
 * - Real-time JSON output preview
 * - Derivation trace display
 * - Integration with existing DefinitionSource schema
 */

// ============================================================================
// SECTION I: Configuration
// ============================================================================

const DefinitionBuilderConfig = {
  // Frame defaults (can be overridden)
  defaultFrame: 'default_frame',
  defaultUser: 'anonymous',

  // Validation settings
  requireAuthority: false, // Allow stub definitions
  requireValidity: false,

  // API search debounce
  searchDebounceMs: 300
};

// ============================================================================
// SECTION II: Operator Definitions
// ============================================================================

/**
 * Operator types with derived predicates and metadata
 * These define HOW a definition is adopted/transformed
 */
const DefinitionOperator = Object.freeze({
  PROJECT: {
    id: 'PROJECT',
    symbol: '→',
    name: 'Project',
    description: 'Use exactly as-is',
    predicate: 'eo:definedAccordingTo',
    predicateDescription: 'Following this definition exactly',
    transformation: 'exact',
    requiresParams: false,
    color: '#1a73e8'
  },
  SCOPE: {
    id: 'SCOPE',
    symbol: '⊂',
    name: 'Scope',
    description: 'Narrow/restrict',
    predicate: 'eo:definedAccordingTo',
    predicateDescription: 'Using a narrower interpretation',
    transformation: 'narrowed',
    requiresParams: true,
    paramType: 'narrowTo',
    paramLabel: 'What are you narrowing to?',
    paramPlaceholder: 'e.g., Category 1 only',
    color: '#ea4335'
  },
  EXTEND: {
    id: 'EXTEND',
    symbol: '⊃',
    name: 'Extend',
    description: 'Broaden/add',
    predicate: 'eo:derivedFrom',
    predicateDescription: 'Extended beyond the source',
    transformation: 'extended',
    requiresParams: true,
    paramType: 'additions',
    paramLabel: 'What are you adding?',
    paramPlaceholder: 'e.g., doubled-up households',
    color: '#34a853'
  },
  COMPOSE: {
    id: 'COMPOSE',
    symbol: '∧',
    name: 'Compose',
    description: 'Combine with other rules',
    predicate: 'eo:constrainedBy',
    predicateDescription: 'Combined with additional constraints',
    transformation: 'composed',
    requiresParams: true,
    paramType: 'composedWith',
    paramLabel: 'Other rules being combined',
    paramPlaceholder: 'e.g., local residency requirement',
    color: '#9c27b0'
  },
  DERIVE: {
    id: 'DERIVE',
    symbol: '←',
    name: 'Derive',
    description: 'Adapt/transform',
    predicate: 'eo:derivedFrom',
    predicateDescription: 'Adapted/transformed from source',
    transformation: 'adapted',
    requiresParams: true,
    paramType: 'transformation',
    paramLabel: 'How did you modify it?',
    paramPlaceholder: 'e.g., Removed questions 7-8, rescaled to 0-10',
    isTextarea: true,
    color: '#ff9800'
  },
  OVERRIDE: {
    id: 'OVERRIDE',
    symbol: '↓',
    name: 'Override',
    description: 'Supersede externally',
    predicate: 'eo:overrides',
    predicateDescription: 'Local definition takes precedence',
    transformation: 'overridden',
    requiresParams: true,
    paramType: 'rationale',
    paramLabel: 'Why does local definition take precedence?',
    paramPlaceholder: 'e.g., Federal definition too narrow for prevention',
    color: '#f44336'
  },
  CONTEST: {
    id: 'CONTEST',
    symbol: '⊗',
    name: 'Contest',
    description: 'Disagree with',
    predicate: 'eo:contests',
    predicateDescription: 'Disagrees with source definition',
    transformation: 'contested',
    requiresParams: true,
    paramType: 'contestation',
    paramLabel: 'Contestation',
    multiParams: [
      { key: 'point', label: 'What do you disagree with?', placeholder: 'e.g., exclusion of doubled-up' },
      { key: 'position', label: 'Your position', placeholder: 'e.g., doubled-up should count as homeless' }
    ],
    color: '#e91e63'
  },
  DEFER: {
    id: 'DEFER',
    symbol: '↑',
    name: 'Defer',
    description: 'Reference only',
    predicate: 'rdfs:seeAlso',
    predicateDescription: 'Reference only, no adoption',
    transformation: 'reference',
    requiresParams: false,
    color: '#607d8b'
  }
});

/**
 * Get all operators as an array
 */
function getOperators() {
  return Object.values(DefinitionOperator);
}

/**
 * Get operator by ID
 */
function getOperatorById(id) {
  return DefinitionOperator[id] || null;
}

// ============================================================================
// SECTION III: Referent Levels and Data Types
// ============================================================================

/**
 * Referent levels - what type of thing is being defined
 */
const ReferentLevel = Object.freeze({
  KEY: { id: 'key', label: 'Key (column)', description: 'A column/field name' },
  VALUE: { id: 'value', label: 'Value (enum)', description: 'A specific value in an enumeration' },
  ENTITY: { id: 'entity', label: 'Entity (record)', description: 'A record/row type' }
});

/**
 * Data types for referents
 */
const ReferentDataType = Object.freeze({
  STRING: { id: 'string', label: 'String' },
  ENUM: { id: 'enum', label: 'Enum' },
  NUMBER: { id: 'number', label: 'Number' },
  DATE: { id: 'date', label: 'Date' },
  BOOLEAN: { id: 'boolean', label: 'Boolean' },
  URI: { id: 'uri', label: 'URI' }
});

/**
 * Intent types for epistemic stance
 */
const IntentType = Object.freeze({
  COMPLIANCE: { id: 'compliance', label: 'Compliance' },
  REPORTING: { id: 'reporting', label: 'Reporting' },
  ANALYSIS: { id: 'analysis', label: 'Analysis' },
  OPERATIONAL: { id: 'operational', label: 'Operational' },
  EXPLORATION: { id: 'exploration', label: 'Exploration' }
});

/**
 * Confidence levels
 */
const ConfidenceLevel = Object.freeze({
  HIGH: { id: 'high', label: 'High — well-understood, stable' },
  MEDIUM: { id: 'medium', label: 'Medium — reasonable interpretation' },
  LOW: { id: 'low', label: 'Low — exploratory, may change' }
});

/**
 * Accountability frames
 */
const AccountabilityFrame = Object.freeze({
  LEGAL: { id: 'legal', label: 'Legal — auditable' },
  CONTRACTUAL: { id: 'contractual', label: 'Contractual — funder requirement' },
  OPERATIONAL: { id: 'operational', label: 'Operational — org policy' },
  ANALYTICAL: { id: 'analytical', label: 'Analytical — for this analysis' },
  INFORMAL: { id: 'informal', label: 'Informal — rough guidance' }
});

// ============================================================================
// SECTION IV: Definition Builder Store
// ============================================================================

/**
 * DefinitionBuilderStore - Manages the state of a definition being built
 * Uses EventTarget for reactivity
 */
class DefinitionBuilderStore {
  constructor(options = {}) {
    this.eventTarget = typeof EventTarget !== 'undefined' ? new EventTarget() : null;

    // Initialize state with defaults
    this.state = this._getInitialState(options);

    // Search state
    this.searchResults = [];
    this.isSearching = false;
    this.selectedAuthority = null;

    // Chip arrays
    this.inclusions = [];
    this.exclusions = [];

    // Context
    this.frame = options.frame || DefinitionBuilderConfig.defaultFrame;
    this.user = options.user || DefinitionBuilderConfig.defaultUser;
  }

  /**
   * Get initial state object
   * @private
   */
  _getInitialState(options = {}) {
    return {
      // Step 1: Referent
      referent: {
        term: options.term || '',
        label: options.label || '',
        level: options.level || 'key',
        dataType: options.dataType || 'string'
      },

      // Step 2: Authority
      authority: {
        name: '',
        shortName: '',
        uri: '',
        type: 'federal_agency'
      },

      // Step 3: Source Document
      source: {
        citation: '',
        url: '',
        title: '',
        type: 'regulation'
      },

      // Step 4: Operator
      operator: 'PROJECT',
      operatorParams: {},

      // Step 5: Validity
      validity: {
        from: '',
        to: '',
        supersedes: ''
      },

      // Step 6: Jurisdiction
      jurisdiction: {
        geographic: '',
        programs: ''
      },

      // Step 7: Parameters
      parameters: {
        threshold: '',
        categories: ''
      },

      // Step 8: Scope Note
      scopeNote: '',

      // Step 9: Epistemic Stance
      epistemicStance: {
        intent: 'analysis',
        confidence: 'medium',
        accountability: 'operational',
        notes: ''
      }
    };
  }

  /**
   * Update a field in the state
   * @param {string} path - Dot-notation path (e.g., 'referent.term')
   * @param {any} value - New value
   */
  set(path, value) {
    const parts = path.split('.');
    let current = this.state;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    const oldValue = current[parts[parts.length - 1]];
    current[parts[parts.length - 1]] = value;

    this._emit('state:changed', { path, value, oldValue });
  }

  /**
   * Get a field from the state
   * @param {string} path - Dot-notation path
   * @returns {any}
   */
  get(path) {
    const parts = path.split('.');
    let current = this.state;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }

    return current;
  }

  /**
   * Set the selected operator
   * @param {string} operatorId
   */
  setOperator(operatorId) {
    const oldOperator = this.state.operator;
    this.state.operator = operatorId;
    this.state.operatorParams = {};
    this._emit('operator:changed', { operator: operatorId, oldOperator });
  }

  /**
   * Set operator parameters
   * @param {Object} params
   */
  setOperatorParams(params) {
    this.state.operatorParams = { ...this.state.operatorParams, ...params };
    this._emit('operatorParams:changed', { params: this.state.operatorParams });
  }

  /**
   * Add an inclusion
   * @param {string} value
   */
  addInclusion(value) {
    if (value && !this.inclusions.includes(value)) {
      this.inclusions.push(value);
      this._emit('inclusions:changed', { inclusions: [...this.inclusions] });
    }
  }

  /**
   * Remove an inclusion
   * @param {number} index
   */
  removeInclusion(index) {
    this.inclusions.splice(index, 1);
    this._emit('inclusions:changed', { inclusions: [...this.inclusions] });
  }

  /**
   * Add an exclusion
   * @param {string} value
   */
  addExclusion(value) {
    if (value && !this.exclusions.includes(value)) {
      this.exclusions.push(value);
      this._emit('exclusions:changed', { exclusions: [...this.exclusions] });
    }
  }

  /**
   * Remove an exclusion
   * @param {number} index
   */
  removeExclusion(index) {
    this.exclusions.splice(index, 1);
    this._emit('exclusions:changed', { exclusions: [...this.exclusions] });
  }

  /**
   * Set selected authority from search
   * @param {Object} authority
   */
  setSelectedAuthority(authority) {
    this.selectedAuthority = authority;

    // Auto-populate authority fields
    if (authority) {
      if (authority.citation) this.set('source.citation', authority.citation);
      if (authority.url) this.set('source.url', authority.url);
      if (authority.meta?.agencies?.[0]?.name) {
        this.set('authority.name', authority.meta.agencies[0].name);
      }
      if (authority.meta?.effective_on) {
        this.set('validity.from', authority.meta.effective_on);
      }
    }

    this._emit('authority:selected', { authority });
  }

  /**
   * Clear selected authority
   */
  clearSelectedAuthority() {
    this.selectedAuthority = null;
    this._emit('authority:cleared', {});
  }

  /**
   * Get the current operator definition
   * @returns {Object}
   */
  getCurrentOperator() {
    return getOperatorById(this.state.operator) || DefinitionOperator.PROJECT;
  }

  /**
   * Get derived predicate from current operator
   * @returns {Object}
   */
  getDerivedPredicate() {
    const op = this.getCurrentOperator();
    return {
      predicate: op.predicate,
      description: op.predicateDescription
    };
  }

  /**
   * Generate derivation trace string
   * @returns {string}
   */
  getDerivationTrace() {
    const term = this.state.referent.term || 'term';
    const citation = this.state.source.citation || 'source';
    const op = this.getCurrentOperator();
    const params = this.state.operatorParams;

    switch (op.id) {
      case 'PROJECT':
        return `${term} = PROJECT(${citation} → ${this.frame})`;
      case 'SCOPE':
        return `${term} = SCOPE(${citation}, {${params.narrowTo || '...'}})`;
      case 'EXTEND':
        return `${term} = EXTEND(${citation}, [${params.additions || '...'}])`;
      case 'COMPOSE':
        return `${term} = COMPOSE(${citation} ∧ ${params.composedWith || '...'})`;
      case 'DERIVE':
        return `${term} = DERIVE(${citation}, transform)`;
      case 'OVERRIDE':
        return `${term} = OVERRIDE(local ↓ ${citation})`;
      case 'CONTEST':
        return `${term} = CONTEST(${citation}, disagreement)`;
      case 'DEFER':
        return `${term} → DEFER(${citation})`;
      default:
        return `${term} = ${op.symbol}(${citation})`;
    }
  }

  /**
   * Build the complete definition object
   * @returns {Object}
   */
  buildOutput() {
    const op = this.getCurrentOperator();

    const obj = {
      // 1. Referent
      referent: {
        term: this.state.referent.term || undefined,
        label: this.state.referent.label || undefined,
        level: this.state.referent.level,
        dataType: this.state.referent.dataType
      },

      // 2. Authority
      authority: this._cleanObject({
        name: this.state.authority.name,
        shortName: this.state.authority.shortName,
        uri: this.state.authority.uri,
        type: this.state.authority.type
      }),

      // 3. Source Document
      source: this._cleanObject({
        citation: this.state.source.citation,
        url: this.state.source.url,
        title: this.state.source.title,
        type: this.state.source.type
      }),

      // 4. Operator & Derivation
      derivation: {
        operator: op.id,
        symbol: op.symbol,
        transformation: op.transformation,
        params: Object.keys(this.state.operatorParams).length > 0
          ? this.state.operatorParams
          : undefined
      },

      // 5. Predicate
      predicate: op.predicate,

      // 6. Frame
      frame: {
        id: `eo:frame/${this.frame}`,
        type: 'dataset'
      },

      // 7. Validity
      validity: this._cleanObject({
        from: this.state.validity.from,
        to: this.state.validity.to,
        supersedes: this.state.validity.supersedes
      }),

      // 8. Jurisdiction
      jurisdiction: this._cleanObject({
        geographic: this.state.jurisdiction.geographic,
        programs: this.state.jurisdiction.programs
          ? this.state.jurisdiction.programs.split(',').map(s => s.trim()).filter(Boolean)
          : undefined
      }),

      // 9. Parameters
      parameters: this._cleanObject({
        inclusions: this.inclusions.length > 0 ? [...this.inclusions] : undefined,
        exclusions: this.exclusions.length > 0 ? [...this.exclusions] : undefined,
        threshold: this.state.parameters.threshold,
        categories: this.state.parameters.categories
          ? this.state.parameters.categories.split(',').map(s => s.trim()).filter(Boolean)
          : undefined
      }),

      // 10. Scope Note
      scopeNote: this.state.scopeNote || undefined,

      // 11. Provenance
      provenance: {
        assertedBy: this.user,
        method: 'definition_builder',
        assertedAt: new Date().toISOString()
      },

      // 12. Epistemic Stance
      epistemicStance: {
        intent: this.state.epistemicStance.intent,
        confidence: this.state.epistemicStance.confidence,
        accountability: this.state.epistemicStance.accountability,
        notes: this.state.epistemicStance.notes || undefined
      }
    };

    return this._cleanObject(obj);
  }

  /**
   * Remove null/undefined/empty values from object
   * @private
   */
  _cleanObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'object' && !Array.isArray(value)) {
        const cleanedNested = this._cleanObject(value);
        if (Object.keys(cleanedNested).length > 0) {
          cleaned[key] = cleanedNested;
        }
      } else if (Array.isArray(value)) {
        if (value.length > 0) {
          cleaned[key] = value;
        }
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  /**
   * Reset the store to initial state
   */
  reset() {
    this.state = this._getInitialState();
    this.searchResults = [];
    this.isSearching = false;
    this.selectedAuthority = null;
    this.inclusions = [];
    this.exclusions = [];
    this._emit('store:reset', {});
  }

  /**
   * Load state from a definition object
   * @param {Object} definition
   */
  loadFromDefinition(definition) {
    if (!definition) return;

    // Map definition fields to state
    if (definition.referent) {
      this.state.referent = { ...this.state.referent, ...definition.referent };
    }
    if (definition.authority) {
      this.state.authority = { ...this.state.authority, ...definition.authority };
    }
    if (definition.source) {
      this.state.source = { ...this.state.source, ...definition.source };
    }
    if (definition.derivation) {
      this.state.operator = definition.derivation.operator || 'PROJECT';
      this.state.operatorParams = definition.derivation.params || {};
    }
    if (definition.validity) {
      this.state.validity = { ...this.state.validity, ...definition.validity };
    }
    if (definition.jurisdiction) {
      this.state.jurisdiction.geographic = definition.jurisdiction.geographic || '';
      this.state.jurisdiction.programs = Array.isArray(definition.jurisdiction.programs)
        ? definition.jurisdiction.programs.join(', ')
        : '';
    }
    if (definition.parameters) {
      this.inclusions = definition.parameters.inclusions || [];
      this.exclusions = definition.parameters.exclusions || [];
      this.state.parameters.threshold = definition.parameters.threshold || '';
      this.state.parameters.categories = Array.isArray(definition.parameters.categories)
        ? definition.parameters.categories.join(', ')
        : '';
    }
    if (definition.scopeNote) {
      this.state.scopeNote = definition.scopeNote;
    }
    if (definition.epistemicStance) {
      this.state.epistemicStance = { ...this.state.epistemicStance, ...definition.epistemicStance };
    }

    this._emit('store:loaded', { definition });
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
   * @param {string} eventName
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
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
// SECTION V: Definition Builder Panel UI
// ============================================================================

/**
 * DefinitionBuilderPanel - Main UI component for building definitions
 */
class DefinitionBuilderPanel {
  constructor(options = {}) {
    this.store = options.store || new DefinitionBuilderStore(options);
    this.container = options.container || null;
    this.api = options.api || (window.EO?.getDefinitionAPI ? window.EO.getDefinitionAPI() : null);
    this.onSave = options.onSave || null;
    this.onCancel = options.onCancel || null;

    // Search state
    this.currentSource = 'ecfr';
    this.searchDebounce = null;

    // Bind methods
    this._onStoreChange = this._onStoreChange.bind(this);
    this._handleInputChange = this._handleInputChange.bind(this);

    // Subscribe to store events
    this.store.on('state:changed', this._onStoreChange);
    this.store.on('operator:changed', () => this.render());
    this.store.on('authority:selected', () => this.render());
    this.store.on('authority:cleared', () => this.render());
    this.store.on('inclusions:changed', () => this._updateChips('inclusions'));
    this.store.on('exclusions:changed', () => this._updateChips('exclusions'));

    // Inject styles
    injectDefinitionBuilderStyles();
  }

  /**
   * Show the panel
   * @param {Object} initialData - Optional initial definition data
   */
  show(initialData = null) {
    if (initialData) {
      this.store.loadFromDefinition(initialData);
    }
    this.render();
  }

  /**
   * Hide the panel
   */
  hide() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Render the panel
   */
  render() {
    if (!this.container) return;

    const op = this.store.getCurrentOperator();
    const predicate = this.store.getDerivedPredicate();
    const trace = this.store.getDerivationTrace();
    const output = this.store.buildOutput();

    this.container.innerHTML = `
      <div class="definition-builder">
        <div class="builder-layout">
          <!-- Main Form -->
          <div class="builder-form">
            ${this._renderContextBar()}
            ${this._renderStep1Referent()}
            ${this._renderStep2Authority()}
            ${this._renderStep3Operator()}
            ${this._renderStep4Parameters()}
            ${this._renderStep5ScopeNote()}
            ${this._renderStep6Validity()}
            ${this._renderStep7Epistemic()}
            ${this._renderDerivationTrace(trace)}
          </div>

          <!-- Output Panel -->
          <div class="builder-output">
            <div class="output-panel">
              <h3><i class="ph ph-code"></i> Definition Object</h3>

              <div class="output-tabs">
                <button class="output-tab active" data-tab="json">JSON</button>
                <button class="output-tab" data-tab="summary">Summary</button>
              </div>

              <div class="output-view active" data-view="json">
                <pre class="output-json">${this._escapeHtml(JSON.stringify(output, null, 2))}</pre>
              </div>

              <div class="output-view" data-view="summary">
                ${this._renderSummary(output)}
              </div>

              <div class="output-actions">
                <button class="btn btn-copy" data-action="copy">
                  <i class="ph ph-copy"></i> Copy JSON
                </button>
                <button class="btn btn-secondary" data-action="clear">
                  <i class="ph ph-trash"></i> Clear
                </button>
                ${this.onSave ? `
                  <button class="btn btn-primary" data-action="save">
                    <i class="ph ph-check"></i> Save
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._attachEventHandlers();
  }

  /**
   * Render context bar
   * @private
   */
  _renderContextBar() {
    return `
      <div class="context-bar">
        <div class="context-item">
          <label>Frame</label>
          <div class="value">${this.store.frame}</div>
        </div>
        <div class="context-item">
          <label>User</label>
          <div class="value">${this.store.user}</div>
        </div>
        <div class="context-item">
          <label>Intent</label>
          <div class="value">
            <select name="epistemicStance.intent" class="intent-select">
              ${Object.values(IntentType).map(i => `
                <option value="${i.id}" ${this.store.get('epistemicStance.intent') === i.id ? 'selected' : ''}>
                  ${i.label}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Step 1: Referent
   * @private
   */
  _renderStep1Referent() {
    const state = this.store.state.referent;

    return `
      <div class="builder-step">
        <div class="step-header">
          <span class="step-num">1</span>
          <h3>Referent</h3>
          <span class="eo-param">EO §1: Designated Entity</span>
        </div>
        <p class="step-desc">What are you defining? (column, value, or entity)</p>

        <div class="highlight-box green">
          <div class="field-row">
            <div class="field">
              <label>Term (key)</label>
              <input type="text" name="referent.term" value="${this._escapeHtml(state.term)}"
                     placeholder="housing_status" />
            </div>
            <div class="field">
              <label>Label</label>
              <input type="text" name="referent.label" value="${this._escapeHtml(state.label)}"
                     placeholder="Housing Status" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Level</label>
              <select name="referent.level">
                ${Object.values(ReferentLevel).map(l => `
                  <option value="${l.id}" ${state.level === l.id ? 'selected' : ''}>${l.label}</option>
                `).join('')}
              </select>
            </div>
            <div class="field">
              <label>Data Type</label>
              <select name="referent.dataType">
                ${Object.values(ReferentDataType).map(d => `
                  <option value="${d.id}" ${state.dataType === d.id ? 'selected' : ''}>${d.label}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Step 2: Source Authority
   * @private
   */
  _renderStep2Authority() {
    const auth = this.store.state.authority;
    const source = this.store.state.source;

    return `
      <div class="builder-step">
        <div class="step-header">
          <span class="step-num">2</span>
          <h3>Source Authority</h3>
          <span class="eo-param">EO §2: Normative Source</span>
        </div>
        <p class="step-desc">Where does the definition come from?</p>

        <div class="search-box">
          <div class="source-pills">
            <button class="source-pill ${this.currentSource === 'ecfr' ? 'active' : ''}" data-source="ecfr">eCFR</button>
            <button class="source-pill ${this.currentSource === 'fr' ? 'active' : ''}" data-source="fr">Fed Register</button>
            <button class="source-pill ${this.currentSource === 'wikidata' ? 'active' : ''}" data-source="wikidata">Wikidata</button>
            <button class="source-pill ${this.currentSource === 'internal' ? 'active' : ''}" data-source="internal">Internal</button>
          </div>
          <div class="search-row">
            <input type="text" id="auth-search" placeholder="Search for authority or regulation..." />
            <button class="btn-search" data-action="search">
              <i class="ph ph-magnifying-glass"></i> Search
            </button>
          </div>
          <div id="search-results"></div>
        </div>

        ${this.store.selectedAuthority ? `
          <div class="selected-item">
            <div>
              <div class="label">${this._escapeHtml(this.store.selectedAuthority.label || '')}</div>
              <div class="uri">${this._escapeHtml(this.store.selectedAuthority.citation || this.store.selectedAuthority.uri || '')}</div>
            </div>
            <button class="btn-clear" data-action="clear-authority">×</button>
          </div>
        ` : ''}

        <div class="field-row">
          <div class="field">
            <label>Authority Name</label>
            <input type="text" name="authority.name" value="${this._escapeHtml(auth.name)}"
                   placeholder="U.S. Department of Housing..." />
          </div>
          <div class="field">
            <label>Short Name</label>
            <input type="text" name="authority.shortName" value="${this._escapeHtml(auth.shortName)}"
                   placeholder="HUD" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Authority URI</label>
            <input type="text" name="authority.uri" value="${this._escapeHtml(auth.uri)}"
                   placeholder="http://www.wikidata.org/entity/Q..." />
          </div>
          <div class="field">
            <label>Authority Type</label>
            <select name="authority.type">
              <option value="federal_agency" ${auth.type === 'federal_agency' ? 'selected' : ''}>Federal Agency</option>
              <option value="state_agency" ${auth.type === 'state_agency' ? 'selected' : ''}>State Agency</option>
              <option value="local_gov" ${auth.type === 'local_gov' ? 'selected' : ''}>Local Gov</option>
              <option value="standards_body" ${auth.type === 'standards_body' ? 'selected' : ''}>Standards Body</option>
              <option value="internal" ${auth.type === 'internal' ? 'selected' : ''}>Internal</option>
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Citation</label>
            <input type="text" name="source.citation" value="${this._escapeHtml(source.citation)}"
                   placeholder="24 CFR 578.3" />
          </div>
          <div class="field">
            <label>Document URL</label>
            <input type="text" name="source.url" value="${this._escapeHtml(source.url)}"
                   placeholder="https://www.ecfr.gov/..." />
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Step 3: Operator
   * @private
   */
  _renderStep3Operator() {
    const currentOp = this.store.getCurrentOperator();
    const predicate = this.store.getDerivedPredicate();

    return `
      <div class="builder-step">
        <div class="step-header">
          <span class="step-num">3</span>
          <h3>Operator</h3>
          <span class="eo-param">EO §3: Mode of Adoption</span>
        </div>
        <p class="step-desc">How are you using this definition?</p>

        <div class="operator-grid">
          ${getOperators().map(op => `
            <div class="operator-option ${currentOp.id === op.id ? 'selected' : ''}"
                 data-operator="${op.id}" style="--op-color: ${op.color}">
              <div class="op-symbol">${op.symbol}</div>
              <div class="op-name">${op.name}</div>
              <div class="op-desc">${op.description}</div>
            </div>
          `).join('')}
        </div>

        ${this._renderOperatorParams(currentOp)}

        <div class="predicate-display">
          <div class="label">Derived Predicate</div>
          <div class="value">${predicate.predicate}</div>
          <div class="desc">${predicate.description}</div>
        </div>
      </div>
    `;
  }

  /**
   * Render operator-specific parameters
   * @private
   */
  _renderOperatorParams(op) {
    if (!op.requiresParams) return '';

    const params = this.store.state.operatorParams;

    if (op.multiParams) {
      return `
        <div class="operator-params">
          <h4>${op.paramLabel}</h4>
          ${op.multiParams.map(p => `
            <div class="field">
              <label>${p.label}</label>
              <input type="text" name="operatorParams.${p.key}"
                     value="${this._escapeHtml(params[p.key] || '')}"
                     placeholder="${p.placeholder}" />
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="operator-params">
        <h4>${op.paramLabel}</h4>
        <div class="field">
          ${op.isTextarea ? `
            <textarea name="operatorParams.${op.paramType}" rows="2"
                      placeholder="${op.paramPlaceholder}">${this._escapeHtml(params[op.paramType] || '')}</textarea>
          ` : `
            <input type="text" name="operatorParams.${op.paramType}"
                   value="${this._escapeHtml(params[op.paramType] || '')}"
                   placeholder="${op.paramPlaceholder}" />
          `}
        </div>
      </div>
    `;
  }

  /**
   * Render Step 4: Parameters
   * @private
   */
  _renderStep4Parameters() {
    const params = this.store.state.parameters;

    return `
      <div class="builder-step">
        <div class="step-header">
          <span class="step-num">4</span>
          <h3>Parameters</h3>
          <span class="eo-param">EO §7: Operational Parameters</span>
        </div>
        <p class="step-desc">Your specific operational constraints</p>

        <div class="highlight-box amber">
          <div class="field">
            <label>Inclusions</label>
            <div class="chip-input" id="inclusions-chips">
              ${this.store.inclusions.map((v, i) => `
                <span class="chip">
                  ${this._escapeHtml(v)}
                  <span class="remove" data-action="remove-inclusion" data-index="${i}">×</span>
                </span>
              `).join('')}
              <input type="text" id="inclusions-input" placeholder="Type and press Enter..." />
            </div>
            <div class="hint">What's explicitly included in your definition</div>
          </div>

          <div class="field">
            <label>Exclusions</label>
            <div class="chip-input" id="exclusions-chips">
              ${this.store.exclusions.map((v, i) => `
                <span class="chip">
                  ${this._escapeHtml(v)}
                  <span class="remove" data-action="remove-exclusion" data-index="${i}">×</span>
                </span>
              `).join('')}
              <input type="text" id="exclusions-input" placeholder="Type and press Enter..." />
            </div>
            <div class="hint">What's explicitly excluded from your definition</div>
          </div>

          <div class="field-row">
            <div class="field">
              <label>Threshold</label>
              <input type="text" name="parameters.threshold" value="${this._escapeHtml(params.threshold)}"
                     placeholder="e.g., 60% AMI" />
            </div>
            <div class="field">
              <label>Categories</label>
              <input type="text" name="parameters.categories" value="${this._escapeHtml(params.categories)}"
                     placeholder="e.g., 1, 2" />
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Step 5: Scope Note
   * @private
   */
  _renderStep5ScopeNote() {
    return `
      <div class="builder-step">
        <div class="step-header">
          <span class="step-num">5</span>
          <h3>Scope Note</h3>
          <span class="eo-param">EO §4: STABILIZE</span>
        </div>
        <p class="step-desc">Your operational commitment — what does this mean FOR YOU?</p>

        <div class="highlight-box purple">
          <div class="field">
            <textarea name="scopeNote" rows="4"
                      placeholder="Be specific. What edge cases have you decided? What interpretation are you committing to?&#10;&#10;Example: 'HUD Category 1 only. Overnight location determines status. Excludes doubled-up even if self-reported as homeless.'">${this._escapeHtml(this.store.state.scopeNote)}</textarea>
            <div class="hint">This cannot be auto-generated. It's YOUR operational definition.</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Step 6: Validity & Jurisdiction
   * @private
   */
  _renderStep6Validity() {
    const validity = this.store.state.validity;
    const jurisdiction = this.store.state.jurisdiction;

    return `
      <div class="builder-step">
        <div class="step-header">
          <span class="step-num">6</span>
          <h3>Validity & Jurisdiction</h3>
          <span class="eo-param">EO §5-6: Temporal Scope + Governance Domain</span>
        </div>

        <div class="field-row-3">
          <div class="field">
            <label>Effective From</label>
            <input type="date" name="validity.from" value="${validity.from}" />
          </div>
          <div class="field">
            <label>Effective To</label>
            <input type="date" name="validity.to" value="${validity.to}" />
          </div>
          <div class="field">
            <label>Supersedes</label>
            <input type="text" name="validity.supersedes" value="${this._escapeHtml(validity.supersedes)}"
                   placeholder="Prior version" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Geographic Jurisdiction</label>
            <input type="text" name="jurisdiction.geographic" value="${this._escapeHtml(jurisdiction.geographic)}"
                   placeholder="United States" />
          </div>
          <div class="field">
            <label>Programs</label>
            <input type="text" name="jurisdiction.programs" value="${this._escapeHtml(jurisdiction.programs)}"
                   placeholder="CoC Program, ESG" />
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Step 7: Epistemic Stance
   * @private
   */
  _renderStep7Epistemic() {
    const ep = this.store.state.epistemicStance;

    return `
      <div class="builder-step">
        <div class="step-header">
          <span class="step-num">7</span>
          <h3>Epistemic Stance</h3>
          <span class="eo-param">EO §9: Confidence + Intent</span>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Confidence</label>
            <select name="epistemicStance.confidence">
              ${Object.values(ConfidenceLevel).map(c => `
                <option value="${c.id}" ${ep.confidence === c.id ? 'selected' : ''}>${c.label}</option>
              `).join('')}
            </select>
          </div>
          <div class="field">
            <label>Accountability Frame</label>
            <select name="epistemicStance.accountability">
              ${Object.values(AccountabilityFrame).map(a => `
                <option value="${a.id}" ${ep.accountability === a.id ? 'selected' : ''}>${a.label}</option>
              `).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label>Notes</label>
          <input type="text" name="epistemicStance.notes" value="${this._escapeHtml(ep.notes)}"
                 placeholder="Why this definition? Any caveats?" />
        </div>
      </div>
    `;
  }

  /**
   * Render derivation trace
   * @private
   */
  _renderDerivationTrace(trace) {
    return `
      <div class="derivation-trace">
        <span class="trace-label">Derivation:</span>
        <code>${this._escapeHtml(trace)}</code>
      </div>
    `;
  }

  /**
   * Render summary view
   * @private
   */
  _renderSummary(obj) {
    return `
      <div class="eo-summary">
        <div class="row"><span class="label">Referent</span><span class="value">${obj.referent?.term || '—'} (${obj.referent?.level})</span></div>
        <div class="row"><span class="label">Authority</span><span class="value">${obj.authority?.shortName || obj.authority?.name || '—'}</span></div>
        <div class="row"><span class="label">Citation</span><span class="value">${obj.source?.citation || '—'}</span></div>
        <div class="row"><span class="label">Operator</span><span class="value">${obj.derivation?.symbol} ${obj.derivation?.operator}</span></div>
        <div class="row"><span class="label">Predicate</span><span class="value">${obj.predicate || '—'}</span></div>
        <div class="row"><span class="label">Frame</span><span class="value">${obj.frame?.id || '—'}</span></div>
        <div class="row"><span class="label">Validity</span><span class="value">${obj.validity?.from || '—'}</span></div>
        <div class="row"><span class="label">Jurisdiction</span><span class="value">${obj.jurisdiction?.geographic || '—'}</span></div>
        <div class="row"><span class="label">Intent</span><span class="value">${obj.epistemicStance?.intent}</span></div>
        <div class="row"><span class="label">Confidence</span><span class="value">${obj.epistemicStance?.confidence}</span></div>
      </div>
    `;
  }

  /**
   * Attach event handlers
   * @private
   */
  _attachEventHandlers() {
    if (!this.container) return;

    // Form inputs
    this.container.querySelectorAll('input[name], textarea[name], select[name]').forEach(el => {
      el.addEventListener('input', (e) => this._handleInputChange(e));
      el.addEventListener('change', (e) => this._handleInputChange(e));
    });

    // Operator selection
    this.container.querySelectorAll('.operator-option').forEach(el => {
      el.addEventListener('click', () => {
        const opId = el.dataset.operator;
        this.store.setOperator(opId);
      });
    });

    // Source pills
    this.container.querySelectorAll('.source-pill').forEach(el => {
      el.addEventListener('click', () => {
        this.currentSource = el.dataset.source;
        this.container.querySelectorAll('.source-pill').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
      });
    });

    // Search
    const searchBtn = this.container.querySelector('[data-action="search"]');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => this._performSearch());
    }

    const searchInput = this.container.querySelector('#auth-search');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this._performSearch();
      });
    }

    // Clear authority
    const clearAuthBtn = this.container.querySelector('[data-action="clear-authority"]');
    if (clearAuthBtn) {
      clearAuthBtn.addEventListener('click', () => this.store.clearSelectedAuthority());
    }

    // Chip inputs
    this._attachChipHandlers('inclusions');
    this._attachChipHandlers('exclusions');

    // Output tabs
    this.container.querySelectorAll('.output-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.container.querySelectorAll('.output-tab').forEach(t => t.classList.remove('active'));
        this.container.querySelectorAll('.output-view').forEach(v => v.classList.remove('active'));
        tab.classList.add('active');
        this.container.querySelector(`[data-view="${tabName}"]`)?.classList.add('active');
      });
    });

    // Action buttons
    const copyBtn = this.container.querySelector('[data-action="copy"]');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this._copyOutput());
    }

    const clearBtn = this.container.querySelector('[data-action="clear"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.store.reset();
        this.render();
      });
    }

    const saveBtn = this.container.querySelector('[data-action="save"]');
    if (saveBtn && this.onSave) {
      saveBtn.addEventListener('click', () => {
        const output = this.store.buildOutput();
        this.onSave(output);
      });
    }

    // Remove chip buttons
    this.container.querySelectorAll('[data-action="remove-inclusion"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        this.store.removeInclusion(index);
      });
    });

    this.container.querySelectorAll('[data-action="remove-exclusion"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        this.store.removeExclusion(index);
      });
    });
  }

  /**
   * Attach chip input handlers
   * @private
   */
  _attachChipHandlers(name) {
    const input = this.container.querySelector(`#${name}-input`);
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          e.preventDefault();
          if (name === 'inclusions') {
            this.store.addInclusion(input.value.trim());
          } else {
            this.store.addExclusion(input.value.trim());
          }
          input.value = '';
        }
      });
    }
  }

  /**
   * Update chips display
   * @private
   */
  _updateChips(name) {
    const container = this.container?.querySelector(`#${name}-chips`);
    if (!container) return;

    const input = container.querySelector('input');
    const arr = name === 'inclusions' ? this.store.inclusions : this.store.exclusions;

    container.innerHTML = arr.map((v, i) => `
      <span class="chip">
        ${this._escapeHtml(v)}
        <span class="remove" data-action="remove-${name.slice(0, -1)}" data-index="${i}">×</span>
      </span>
    `).join('') + `<input type="text" id="${name}-input" placeholder="Type and press Enter..." />`;

    // Reattach handlers
    this._attachChipHandlers(name);

    container.querySelectorAll(`[data-action="remove-${name.slice(0, -1)}"]`).forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        if (name === 'inclusions') {
          this.store.removeInclusion(index);
        } else {
          this.store.removeExclusion(index);
        }
      });
    });

    // Update output
    this._updateOutput();
  }

  /**
   * Handle input changes
   * @private
   */
  _handleInputChange(e) {
    const name = e.target.name;
    const value = e.target.value;

    if (name.startsWith('operatorParams.')) {
      const paramKey = name.replace('operatorParams.', '');
      this.store.setOperatorParams({ [paramKey]: value });
    } else {
      this.store.set(name, value);
    }

    this._updateOutput();
  }

  /**
   * Update output display
   * @private
   */
  _updateOutput() {
    const output = this.store.buildOutput();
    const jsonEl = this.container?.querySelector('.output-json');
    if (jsonEl) {
      jsonEl.textContent = JSON.stringify(output, null, 2);
    }

    const summaryEl = this.container?.querySelector('.eo-summary');
    if (summaryEl) {
      summaryEl.outerHTML = this._renderSummary(output);
    }

    const traceEl = this.container?.querySelector('.derivation-trace code');
    if (traceEl) {
      traceEl.textContent = this.store.getDerivationTrace();
    }
  }

  /**
   * Perform API search
   * @private
   */
  async _performSearch() {
    const query = this.container?.querySelector('#auth-search')?.value?.trim();
    if (!query) return;

    const resultsContainer = this.container?.querySelector('#search-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '<div class="loading"><i class="ph ph-spinner"></i> Searching...</div>';

    try {
      let results = [];

      if (this.api) {
        switch (this.currentSource) {
          case 'ecfr':
            results = await this.api.searchRegulatory(query, { sources: ['ecfr'], limit: 8 });
            break;
          case 'fr':
            results = await this.api.searchRegulatory(query, { sources: ['federalRegister'], limit: 8 });
            break;
          case 'wikidata':
            results = await this.api.searchConcepts(query, { sources: ['wikidata'], limit: 8 });
            break;
          case 'internal':
            results = [{ label: 'Internal Definition', desc: 'Define your own authority', source: 'Internal' }];
            break;
        }
      } else {
        // Fallback: direct API calls
        results = await this._directSearch(query);
      }

      if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
        return;
      }

      this.searchResults = results;
      resultsContainer.innerHTML = `
        <div class="search-results">
          ${results.map((r, i) => `
            <div class="search-result" data-index="${i}">
              <div class="result-label">${this._escapeHtml(r.label || r.title || 'Untitled')}</div>
              <div class="result-desc">${this._escapeHtml(r.desc || r.description || r.snippet || '').substring(0, 100)}</div>
              <div class="result-uri">${this._escapeHtml(r.citation || r.uri || '')}</div>
            </div>
          `).join('')}
        </div>
      `;

      // Attach click handlers
      resultsContainer.querySelectorAll('.search-result').forEach(el => {
        el.addEventListener('click', () => {
          const index = parseInt(el.dataset.index, 10);
          this._selectSearchResult(index);
        });
      });

    } catch (error) {
      resultsContainer.innerHTML = `<div class="no-results">Error: ${error.message}</div>`;
    }
  }

  /**
   * Direct API search fallback
   * @private
   */
  async _directSearch(query) {
    const sources = {
      ecfr: async () => {
        const res = await fetch(`https://www.ecfr.gov/api/search/v1/results?query=${encodeURIComponent(query)}&per_page=8`);
        const data = await res.json();
        return (data.results || []).map(r => ({
          label: r.hierarchy_headings?.slice(-2).join(' > ') || r.headings?.title || 'Untitled',
          desc: r.full_text_excerpt?.substring(0, 100) || '',
          citation: `${r.title || ''} CFR ${r.part || ''}${r.section ? '.' + r.section : ''}`,
          url: `https://www.ecfr.gov/current/title-${r.title}/part-${r.part}${r.section ? '/section-' + r.part + '.' + r.section : ''}`,
          source: 'eCFR',
          meta: r
        }));
      },
      fr: async () => {
        const res = await fetch(`https://www.federalregister.gov/api/v1/documents.json?conditions[term]=${encodeURIComponent(query)}&per_page=8`);
        const data = await res.json();
        return (data.results || []).map(r => ({
          label: r.title?.substring(0, 60) || 'Untitled',
          desc: r.abstract?.substring(0, 100) || '',
          citation: r.citation || r.document_number,
          url: r.html_url,
          source: 'Federal Register',
          meta: { agencies: r.agencies, effective_on: r.effective_on }
        }));
      },
      wikidata: async () => {
        const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&limit=8&format=json&origin=*`);
        const data = await res.json();
        return (data.search || []).map(e => ({
          label: e.label,
          desc: e.description || '',
          uri: `http://www.wikidata.org/entity/${e.id}`,
          source: 'Wikidata',
          meta: { id: e.id }
        }));
      },
      internal: async () => [{ label: 'Internal Definition', desc: 'Define your own authority', source: 'Internal' }]
    };

    return sources[this.currentSource] ? await sources[this.currentSource]() : [];
  }

  /**
   * Select a search result
   * @private
   */
  _selectSearchResult(index) {
    const result = this.searchResults[index];
    if (!result) return;

    this.store.setSelectedAuthority(result);

    // Clear search results
    const resultsContainer = this.container?.querySelector('#search-results');
    if (resultsContainer) {
      resultsContainer.innerHTML = '';
    }
  }

  /**
   * Copy output to clipboard
   * @private
   */
  async _copyOutput() {
    const output = this.store.buildOutput();
    const json = JSON.stringify(output, null, 2);

    try {
      await navigator.clipboard.writeText(json);

      const btn = this.container?.querySelector('[data-action="copy"]');
      if (btn) {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-check"></i> Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.classList.remove('copied');
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  /**
   * Store change handler
   * @private
   */
  _onStoreChange(event) {
    this._updateOutput();
  }

  /**
   * Escape HTML
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  /**
   * Destroy the panel
   */
  destroy() {
    this.hide();
    // Cleanup would go here
  }
}

// ============================================================================
// SECTION VI: CSS Styles
// ============================================================================

/**
 * Inject CSS styles for the definition builder
 */
function injectDefinitionBuilderStyles() {
  if (document.getElementById('definition-builder-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'definition-builder-styles';
  styles.textContent = `
    /* Definition Builder */
    .definition-builder {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--text-primary, #202124);
      line-height: 1.6;
      font-size: 14px;
    }

    .builder-layout {
      display: grid;
      grid-template-columns: 1fr 420px;
      gap: 24px;
    }

    @media (max-width: 900px) {
      .builder-layout {
        grid-template-columns: 1fr;
      }
    }

    .builder-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .builder-output {
      position: sticky;
      top: 20px;
      align-self: start;
    }

    /* Context Bar */
    .context-bar {
      background: var(--primary-50, #e8f0fe);
      border-radius: 8px;
      padding: 14px 18px;
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      font-size: 0.9rem;
    }

    .context-item label {
      font-size: 0.75rem;
      color: var(--text-secondary, #5f6368);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: block;
      margin-bottom: 2px;
    }

    .context-item .value {
      color: var(--primary-600, #1a73e8);
      font-weight: 600;
      font-size: 0.95rem;
    }

    .context-item select {
      padding: 4px 8px;
      font-size: 0.9rem;
      border: 1px solid var(--border-color, #dadce0);
      border-radius: 4px;
    }

    /* Steps */
    .builder-step {
      background: var(--bg-primary, white);
      border: 1px solid var(--border-color, #e0e0e0);
      border-radius: 12px;
      padding: 24px;
    }

    .step-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .step-num {
      width: 28px;
      height: 28px;
      background: var(--primary-600, #1a73e8);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .step-header h3 {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0;
    }

    .step-header .eo-param {
      font-size: 0.8rem;
      color: var(--text-muted, #9ca3af);
      font-family: monospace;
      margin-left: auto;
    }

    .step-desc {
      font-size: 0.95rem;
      color: var(--text-secondary, #5f6368);
      margin-bottom: 16px;
      line-height: 1.5;
    }

    /* Fields */
    .field {
      margin-bottom: 16px;
    }

    .field label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary, #5f6368);
      margin-bottom: 6px;
      letter-spacing: 0.2px;
    }

    .field input,
    .field textarea,
    .field select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border-color, #dadce0);
      border-radius: 6px;
      font-size: 0.95rem;
      font-family: inherit;
      line-height: 1.5;
    }

    .field input:focus,
    .field textarea:focus,
    .field select:focus {
      outline: none;
      border-color: var(--primary-500, #1a73e8);
      box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.15);
    }

    .field textarea {
      min-height: 80px;
      resize: vertical;
    }

    .field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .field-row-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 14px;
    }

    .hint {
      font-size: 0.8rem;
      color: var(--text-muted, #9ca3af);
      margin-top: 4px;
      line-height: 1.4;
    }

    /* Highlight Boxes */
    .highlight-box {
      border-radius: 10px;
      padding: 18px;
    }

    .highlight-box.green {
      background: #e8f5e9;
      border: 1px solid #81c784;
    }

    .highlight-box.blue {
      background: #e3f2fd;
      border: 1px solid #64b5f6;
    }

    .highlight-box.amber {
      background: #fff8e1;
      border: 1px solid #ffca28;
    }

    .highlight-box.purple {
      background: #f3e5f5;
      border: 1px solid #ba68c8;
    }

    /* Search Box */
    .search-box {
      background: var(--bg-secondary, #f8f9fa);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .source-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }

    .source-pill {
      padding: 6px 14px;
      background: var(--bg-primary, white);
      border: 1px solid var(--border-color, #dadce0);
      border-radius: 16px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .source-pill:hover {
      border-color: var(--primary-500, #1a73e8);
    }

    .source-pill.active {
      background: var(--primary-500, #1a73e8);
      color: white;
      border-color: var(--primary-500, #1a73e8);
    }

    .search-row {
      display: flex;
      gap: 10px;
    }

    .search-row input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid var(--border-color, #dadce0);
      border-radius: 6px;
      font-size: 0.95rem;
    }

    .btn-search {
      padding: 10px 18px;
      background: var(--primary-500, #1a73e8);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-search:hover {
      background: var(--primary-700, #1557b0);
    }

    .search-results {
      max-height: 240px;
      overflow-y: auto;
      border: 1px solid var(--border-color, #e0e0e0);
      border-radius: 8px;
      margin-top: 12px;
      background: var(--bg-primary, white);
    }

    .search-result {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border-light, #f5f5f5);
      cursor: pointer;
      font-size: 0.9rem;
    }

    .search-result:hover {
      background: var(--bg-secondary, #f8f9fa);
    }

    .search-result:last-child {
      border-bottom: none;
    }

    .result-label {
      font-weight: 600;
      color: var(--primary-600, #1a73e8);
      font-size: 0.95rem;
      margin-bottom: 2px;
    }

    .result-desc {
      color: var(--text-secondary, #5f6368);
      font-size: 0.85rem;
      line-height: 1.4;
    }

    .result-uri {
      font-size: 0.8rem;
      color: var(--text-muted, #9ca3af);
      font-family: monospace;
      margin-top: 4px;
    }

    .selected-item {
      background: #e8f5e9;
      border: 1px solid #81c784;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .selected-item .label {
      font-weight: 600;
      color: #2e7d32;
      font-size: 0.95rem;
    }

    .selected-item .uri {
      font-size: 0.85rem;
      color: var(--text-secondary, #5f6368);
      font-family: monospace;
      margin-top: 2px;
    }

    .btn-clear {
      background: none;
      border: none;
      color: #999;
      cursor: pointer;
      font-size: 1.25rem;
      padding: 6px 10px;
    }

    .loading, .no-results {
      padding: 20px;
      text-align: center;
      color: var(--text-muted, #9ca3af);
      font-size: 0.9rem;
    }

    .loading i {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Operator Grid */
    .operator-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    @media (min-width: 600px) {
      .operator-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    .operator-option {
      padding: 14px;
      background: var(--bg-primary, white);
      border: 2px solid var(--border-color, #e0e0e0);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.15s;
      text-align: center;
    }

    .operator-option:hover {
      border-color: var(--op-color, #1a73e8);
    }

    .operator-option.selected {
      border-color: var(--op-color, #1a73e8);
      background: color-mix(in srgb, var(--op-color, #1a73e8) 10%, white);
    }

    .operator-option .op-symbol {
      font-family: monospace;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--op-color, #1a73e8);
    }

    .operator-option .op-name {
      font-size: 0.95rem;
      font-weight: 600;
      margin-top: 4px;
    }

    .operator-option .op-desc {
      font-size: 0.85rem;
      color: var(--text-secondary, #5f6368);
      margin-top: 4px;
      line-height: 1.3;
    }

    /* Operator Params */
    .operator-params {
      background: var(--bg-secondary, #f8f9fa);
      border-radius: 8px;
      padding: 16px;
      margin-top: 14px;
    }

    .operator-params h4 {
      font-size: 0.85rem;
      color: var(--text-secondary, #5f6368);
      margin: 0 0 12px 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    /* Predicate Display */
    .predicate-display {
      background: #f3e5f5;
      border: 1px solid #ba68c8;
      border-radius: 10px;
      padding: 16px;
      margin-top: 16px;
    }

    .predicate-display .label {
      font-size: 0.8rem;
      color: #7b1fa2;
      text-transform: uppercase;
      margin-bottom: 6px;
      letter-spacing: 0.3px;
    }

    .predicate-display .value {
      font-family: monospace;
      font-size: 1rem;
      color: #7b1fa2;
      font-weight: 600;
    }

    .predicate-display .desc {
      font-size: 0.9rem;
      color: #9c27b0;
      margin-top: 6px;
      line-height: 1.4;
    }

    /* Chip Input */
    .chip-input {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--border-color, #dadce0);
      border-radius: 6px;
      min-height: 44px;
      background: var(--bg-primary, white);
    }

    .chip-input input {
      flex: 1;
      min-width: 120px;
      border: none !important;
      padding: 6px !important;
      font-size: 0.95rem;
      box-shadow: none !important;
    }

    .chip-input input:focus {
      outline: none;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: var(--primary-100, #e8f0fe);
      color: var(--primary-700, #1a73e8);
      border-radius: 14px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .chip .remove {
      cursor: pointer;
      font-weight: bold;
      opacity: 0.7;
      font-size: 1rem;
    }

    .chip .remove:hover {
      opacity: 1;
    }

    /* Derivation Trace */
    .derivation-trace {
      background: #263238;
      border-radius: 8px;
      padding: 14px 16px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.9rem;
      color: #80cbc4;
      overflow-x: auto;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .derivation-trace .trace-label {
      color: #90a4ae;
      font-size: 0.8rem;
      font-weight: 500;
    }

    /* Output Panel */
    .output-panel {
      background: var(--bg-primary, white);
      border: 1px solid var(--border-color, #e0e0e0);
      border-radius: 12px;
      padding: 20px;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
    }

    .output-panel h3 {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 16px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .output-tabs {
      display: flex;
      gap: 6px;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border-color, #e0e0e0);
    }

    .output-tab {
      padding: 10px 16px;
      background: none;
      border: none;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      color: var(--text-secondary, #5f6368);
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
    }

    .output-tab.active {
      color: var(--primary-600, #1a73e8);
      border-bottom-color: var(--primary-600, #1a73e8);
    }

    .output-view {
      display: none;
    }

    .output-view.active {
      display: block;
    }

    .output-json {
      background: #1e1e1e;
      color: #d4d4d4;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.8rem;
      line-height: 1.6;
      padding: 16px;
      border-radius: 8px;
      white-space: pre-wrap;
      max-height: 450px;
      overflow-y: auto;
      margin-bottom: 16px;
    }

    .eo-summary {
      font-size: 0.9rem;
      color: var(--text-secondary, #5f6368);
    }

    .eo-summary .row {
      display: flex;
      padding: 10px 0;
      border-bottom: 1px solid var(--border-light, #f0f0f0);
    }

    .eo-summary .row:last-child {
      border-bottom: none;
    }

    .eo-summary .label {
      width: 110px;
      font-weight: 600;
      color: var(--text-primary, #3c4043);
      font-size: 0.85rem;
    }

    .eo-summary .value {
      flex: 1;
      font-size: 0.9rem;
    }

    .output-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    /* Buttons */
    .btn {
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary {
      background: var(--primary-600, #1a73e8);
      color: white;
    }

    .btn-primary:hover {
      background: var(--primary-700, #1557b0);
    }

    .btn-secondary {
      background: var(--bg-secondary, #f1f3f4);
      color: var(--text-primary, #3c4043);
    }

    .btn-secondary:hover {
      background: var(--bg-tertiary, #e8eaed);
    }

    .btn-copy {
      background: #374151;
      color: white;
    }

    .btn-copy:hover {
      background: #4b5563;
    }

    .btn-copy.copied {
      background: #059669;
    }
  `;

  document.head.appendChild(styles);
}

// ============================================================================
// SECTION VII: Modal Integration
// ============================================================================

/**
 * Show definition builder in a modal
 * @param {Object} options
 * @returns {Promise<Object|null>} The built definition or null if cancelled
 */
function showDefinitionBuilderModal(options = {}) {
  return new Promise((resolve) => {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'definition-builder-modal-backdrop';
    modal.innerHTML = `
      <div class="definition-builder-modal">
        <div class="modal-header">
          <h2><i class="ph ph-book-open"></i> Definition Builder</h2>
          <button class="btn-close" title="Close"><i class="ph ph-x"></i></button>
        </div>
        <div class="modal-body" id="definition-builder-container"></div>
      </div>
    `;

    // Inject modal styles
    if (!document.getElementById('definition-builder-modal-styles')) {
      const modalStyles = document.createElement('style');
      modalStyles.id = 'definition-builder-modal-styles';
      modalStyles.textContent = `
        .definition-builder-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.2s ease;
        }

        .definition-builder-modal {
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 14px;
          width: 95vw;
          max-width: 1280px;
          max-height: 92vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
          animation: slideUp 0.3s ease;
        }

        .definition-builder-modal .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          background: var(--bg-primary, white);
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .definition-builder-modal .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .definition-builder-modal .btn-close {
          background: none;
          border: none;
          padding: 10px;
          cursor: pointer;
          color: var(--text-secondary, #5f6368);
          border-radius: 6px;
          font-size: 1.1rem;
        }

        .definition-builder-modal .btn-close:hover {
          background: var(--bg-secondary, #f1f3f4);
        }

        .definition-builder-modal .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(modalStyles);
    }

    document.body.appendChild(modal);

    // Create builder
    const container = modal.querySelector('#definition-builder-container');
    const panel = new DefinitionBuilderPanel({
      container,
      frame: options.frame,
      user: options.user,
      api: options.api,
      onSave: (definition) => {
        modal.remove();
        resolve(definition);
      },
      onCancel: () => {
        modal.remove();
        resolve(null);
      }
    });

    panel.show(options.initialData);

    // Close handlers
    modal.querySelector('.btn-close')?.addEventListener('click', () => {
      modal.remove();
      resolve(null);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(null);
      }
    });

    // ESC key
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        resolve(null);
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  });
}

// ============================================================================
// SECTION VIII: Singleton & Exports
// ============================================================================

let _definitionBuilderStore = null;
let _definitionBuilderPanel = null;

/**
 * Get or create the definition builder store singleton
 */
function getDefinitionBuilderStore(options = {}) {
  if (!_definitionBuilderStore) {
    _definitionBuilderStore = new DefinitionBuilderStore(options);
  }
  return _definitionBuilderStore;
}

/**
 * Initialize or get the definition builder panel
 */
function initDefinitionBuilderPanel(options = {}) {
  if (!_definitionBuilderPanel) {
    _definitionBuilderPanel = new DefinitionBuilderPanel(options);
  }
  if (options.container) {
    _definitionBuilderPanel.container = options.container;
  }
  return _definitionBuilderPanel;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.EODefinitionBuilder = {
    // Core classes
    DefinitionBuilderStore,
    DefinitionBuilderPanel,

    // Enums
    DefinitionOperator,
    ReferentLevel,
    ReferentDataType,
    IntentType,
    ConfidenceLevel,
    AccountabilityFrame,

    // Helper functions
    getOperators,
    getOperatorById,

    // Singletons
    getDefinitionBuilderStore,
    initDefinitionBuilderPanel,

    // Modal
    showDefinitionBuilderModal,

    // Styles
    injectDefinitionBuilderStyles,

    // Config
    DefinitionBuilderConfig
  };

  // Also attach to EO namespace
  window.EO = window.EO || {};
  window.EO.DefinitionBuilder = window.EODefinitionBuilder;
}

// Export for Node.js/ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DefinitionBuilderStore,
    DefinitionBuilderPanel,
    DefinitionOperator,
    ReferentLevel,
    ReferentDataType,
    IntentType,
    ConfidenceLevel,
    AccountabilityFrame,
    getOperators,
    getOperatorById,
    getDefinitionBuilderStore,
    initDefinitionBuilderPanel,
    showDefinitionBuilderModal,
    injectDefinitionBuilderStyles,
    DefinitionBuilderConfig
  };
}
