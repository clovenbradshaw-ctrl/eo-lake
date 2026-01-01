/**
 * EO Definition Builder - 9-Parameter Definition System with Operator Derivations
 *
 * This module provides a comprehensive definition builder for creating EO-aligned
 * definitions with full operator support, derivation traces, and epistemic framing.
 *
 * The 9 Parameters:
 * 1. Referent - What is being defined (term, label, level, dataType)
 * 2. Authority - Who defines it (name, shortName, uri, type)
 * 3. Source - Where it comes from (citation, url, document type)
 * 4. Operator/Derivation - How it's adopted (PROJECT, SCOPE, EXTEND, etc.)
 * 5. Frame - The dataset/context this applies to
 * 6. Validity - When it's in force (from, to, supersedes)
 * 7. Jurisdiction - Where it applies (geographic, programs)
 * 8. Parameters - Operational constraints (inclusions, exclusions, threshold)
 * 9. Epistemic Stance - Confidence and accountability
 *
 * Plus: Scope Note (STABILIZE) - Your operational commitment
 */

// ============================================================================
// SECTION I: Operator Definitions (Closed Set)
// ============================================================================

/**
 * DefinitionOperator - The 8 operators for definition adoption
 *
 * Each operator defines how a source definition is transformed
 * when adopted into a local context.
 */
const DefinitionOperator = Object.freeze({
  PROJECT: 'PROJECT',     // Use exactly as-is
  SCOPE: 'SCOPE',         // Narrow/restrict
  EXTEND: 'EXTEND',       // Broaden/add
  COMPOSE: 'COMPOSE',     // Combine with other rules
  DERIVE: 'DERIVE',       // Adapt/transform
  OVERRIDE: 'OVERRIDE',   // Supersede externally
  CONTEST: 'CONTEST',     // Disagree with
  DEFER: 'DEFER'          // Reference only
});

/**
 * Operator metadata including symbols, predicates, and descriptions
 */
const OperatorMetadata = Object.freeze({
  [DefinitionOperator.PROJECT]: {
    symbol: '→',
    name: 'PROJECT',
    predicate: 'eo:definedAccordingTo',
    predicateDesc: 'Following this definition exactly',
    transformation: 'exact',
    description: 'Use exactly as-is',
    requiresParams: false
  },
  [DefinitionOperator.SCOPE]: {
    symbol: '⊂',
    name: 'SCOPE',
    predicate: 'eo:definedAccordingTo',
    predicateDesc: 'Using a narrower interpretation',
    transformation: 'narrowed',
    description: 'Narrow/restrict',
    requiresParams: true,
    paramFields: ['narrowTo']
  },
  [DefinitionOperator.EXTEND]: {
    symbol: '⊃',
    name: 'EXTEND',
    predicate: 'eo:derivedFrom',
    predicateDesc: 'Extended beyond the source',
    transformation: 'extended',
    description: 'Broaden/add',
    requiresParams: true,
    paramFields: ['additions']
  },
  [DefinitionOperator.COMPOSE]: {
    symbol: '∧',
    name: 'COMPOSE',
    predicate: 'eo:constrainedBy',
    predicateDesc: 'Combined with additional constraints',
    transformation: 'composed',
    description: 'Combine with other rules',
    requiresParams: true,
    paramFields: ['composedWith']
  },
  [DefinitionOperator.DERIVE]: {
    symbol: '←',
    name: 'DERIVE',
    predicate: 'eo:derivedFrom',
    predicateDesc: 'Adapted/transformed from source',
    transformation: 'adapted',
    description: 'Adapt/transform',
    requiresParams: true,
    paramFields: ['transformation']
  },
  [DefinitionOperator.OVERRIDE]: {
    symbol: '↓',
    name: 'OVERRIDE',
    predicate: 'eo:overrides',
    predicateDesc: 'Local definition takes precedence',
    transformation: 'overridden',
    description: 'Supersede externally',
    requiresParams: true,
    paramFields: ['rationale']
  },
  [DefinitionOperator.CONTEST]: {
    symbol: '⊗',
    name: 'CONTEST',
    predicate: 'eo:contests',
    predicateDesc: 'Disagrees with source definition',
    transformation: 'contested',
    description: 'Disagree with',
    requiresParams: true,
    paramFields: ['point', 'position']
  },
  [DefinitionOperator.DEFER]: {
    symbol: '↑',
    name: 'DEFER',
    predicate: 'rdfs:seeAlso',
    predicateDesc: 'Reference only, no adoption',
    transformation: 'reference',
    description: 'Reference only',
    requiresParams: false
  }
});

// ============================================================================
// SECTION II: Referent Level & Data Types
// ============================================================================

/**
 * ReferentLevel - What type of thing is being defined
 */
const ReferentLevel = Object.freeze({
  KEY: 'key',         // Column/field
  VALUE: 'value',     // Enum value
  ENTITY: 'entity'    // Record/entity type
});

/**
 * ReferentDataType - The data type of the referent
 */
const ReferentDataType = Object.freeze({
  STRING: 'string',
  ENUM: 'enum',
  NUMBER: 'number',
  DATE: 'date',
  BOOLEAN: 'boolean',
  URI: 'uri',
  JSON: 'json'
});

// ============================================================================
// SECTION III: Epistemic Stance Types
// ============================================================================

/**
 * DefinitionIntent - Why this definition is being created
 */
const DefinitionIntent = Object.freeze({
  COMPLIANCE: 'compliance',     // Regulatory requirement
  REPORTING: 'reporting',       // Reporting standard
  ANALYSIS: 'analysis',         // For analysis purposes
  OPERATIONAL: 'operational',   // Day-to-day operations
  EXPLORATION: 'exploration'    // Exploratory/experimental
});

/**
 * DefinitionConfidence - How confident in this definition
 */
const DefinitionConfidence = Object.freeze({
  HIGH: 'high',       // Well-understood, stable
  MEDIUM: 'medium',   // Reasonable interpretation
  LOW: 'low'          // Exploratory, may change
});

/**
 * AccountabilityFrame - The accountability context
 */
const AccountabilityFrame = Object.freeze({
  LEGAL: 'legal',             // Auditable, legal requirement
  CONTRACTUAL: 'contractual', // Funder requirement
  OPERATIONAL: 'operational', // Org policy
  ANALYTICAL: 'analytical',   // For this analysis only
  INFORMAL: 'informal'        // Rough guidance
});

// ============================================================================
// SECTION IV: Definition Builder State
// ============================================================================

/**
 * DefinitionBuilderState - Manages the state of a definition being built
 */
class DefinitionBuilderState {
  constructor(options = {}) {
    // Context (from app)
    this.context = {
      frameId: options.frameId || null,
      frameName: options.frameName || null,
      user: options.user || null,
      intent: options.intent || DefinitionIntent.ANALYSIS
    };

    // 1. Referent
    this.referent = {
      term: '',
      label: '',
      level: ReferentLevel.KEY,
      dataType: ReferentDataType.STRING
    };

    // 2. Authority
    this.authority = {
      name: '',
      shortName: '',
      uri: '',
      type: 'federal_agency'
    };

    // 3. Source
    this.source = {
      citation: '',
      url: '',
      title: '',
      type: 'regulation'
    };

    // 4. Operator/Derivation
    this.operator = DefinitionOperator.PROJECT;
    this.operatorParams = {};

    // 5. Frame (derived from context)
    this.frame = {
      id: options.frameId ? `eo:frame/${options.frameId}` : null,
      type: 'dataset'
    };

    // 6. Validity
    this.validity = {
      from: '',
      to: '',
      supersedes: ''
    };

    // 7. Jurisdiction
    this.jurisdiction = {
      geographic: '',
      programs: []
    };

    // 8. Parameters
    this.parameters = {
      inclusions: [],
      exclusions: [],
      threshold: '',
      categories: []
    };

    // 9. Epistemic Stance
    this.epistemicStance = {
      intent: options.intent || DefinitionIntent.ANALYSIS,
      confidence: DefinitionConfidence.MEDIUM,
      accountability: AccountabilityFrame.OPERATIONAL,
      notes: ''
    };

    // Scope Note (STABILIZE)
    this.scopeNote = '';

    // Selected authority from search
    this.selectedAuthority = null;

    // Validation state
    this.validationErrors = [];
  }

  /**
   * Set a field value by path (e.g., 'referent.term')
   */
  set(path, value) {
    const parts = path.split('.');
    let obj = this;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    return this;
  }

  /**
   * Get a field value by path
   */
  get(path) {
    const parts = path.split('.');
    let obj = this;
    for (const part of parts) {
      obj = obj?.[part];
    }
    return obj;
  }

  /**
   * Get the current operator metadata
   */
  getOperatorMetadata() {
    return OperatorMetadata[this.operator];
  }

  /**
   * Generate the derivation trace string
   */
  getDerivationTrace() {
    const term = this.referent.term || 'term';
    const citation = this.source.citation || 'source';
    const frameName = this.context.frameName || 'frame';
    const opMeta = this.getOperatorMetadata();

    switch (this.operator) {
      case DefinitionOperator.PROJECT:
        return `${term} = PROJECT(${citation} → ${frameName})`;
      case DefinitionOperator.SCOPE:
        const scopeTo = this.operatorParams.narrowTo || '...';
        return `${term} = SCOPE(${citation}, {${scopeTo}})`;
      case DefinitionOperator.EXTEND:
        const extend = this.operatorParams.additions || '...';
        return `${term} = EXTEND(${citation}, [${extend}])`;
      case DefinitionOperator.COMPOSE:
        const compose = this.operatorParams.composedWith || '...';
        return `${term} = COMPOSE(${citation} ∧ ${compose})`;
      case DefinitionOperator.DERIVE:
        return `${term} = DERIVE(${citation}, transform)`;
      case DefinitionOperator.OVERRIDE:
        return `${term} = OVERRIDE(local ↓ ${citation})`;
      case DefinitionOperator.CONTEST:
        return `${term} = CONTEST(${citation}, disagreement)`;
      case DefinitionOperator.DEFER:
        return `${term} → DEFER(${citation})`;
      default:
        return `${term} = ${this.operator}(${citation})`;
    }
  }

  /**
   * Validate the current state
   */
  validate() {
    this.validationErrors = [];

    // Required: Referent term
    if (!this.referent.term?.trim()) {
      this.validationErrors.push({ field: 'referent.term', message: 'Term is required' });
    }

    // Required: Authority name
    if (!this.authority.name?.trim()) {
      this.validationErrors.push({ field: 'authority.name', message: 'Authority name is required' });
    }

    // Required: Citation or URL
    if (!this.source.citation?.trim() && !this.source.url?.trim()) {
      this.validationErrors.push({ field: 'source.citation', message: 'Citation or URL is required' });
    }

    // Required: Validity from date
    if (!this.validity.from) {
      this.validationErrors.push({ field: 'validity.from', message: 'Effective date is required' });
    }

    // Operator-specific params
    const opMeta = this.getOperatorMetadata();
    if (opMeta.requiresParams && opMeta.paramFields) {
      for (const field of opMeta.paramFields) {
        if (!this.operatorParams[field]?.trim()) {
          this.validationErrors.push({
            field: `operatorParams.${field}`,
            message: `${field} is required for ${this.operator} operator`
          });
        }
      }
    }

    return this.validationErrors.length === 0;
  }

  /**
   * Build the complete definition object
   */
  build() {
    const opMeta = this.getOperatorMetadata();

    const obj = {
      // 1. Referent
      referent: {
        term: this.referent.term?.trim() || undefined,
        label: this.referent.label?.trim() || undefined,
        level: this.referent.level,
        dataType: this.referent.dataType
      },

      // 2. Authority
      authority: {
        name: this.authority.name?.trim() || undefined,
        shortName: this.authority.shortName?.trim() || undefined,
        uri: this.authority.uri?.trim() || undefined,
        type: this.authority.type
      },

      // 3. Source
      source: {
        citation: this.source.citation?.trim() || undefined,
        url: this.source.url?.trim() || undefined,
        title: this.source.title?.trim() || undefined,
        type: this.source.type
      },

      // 4. Derivation
      derivation: {
        operator: this.operator,
        symbol: opMeta.symbol,
        transformation: opMeta.transformation,
        params: Object.keys(this.operatorParams).length > 0 ? { ...this.operatorParams } : undefined
      },

      // Predicate (semantic relationship)
      predicate: opMeta.predicate,

      // 5. Frame
      frame: this.frame.id ? {
        id: this.frame.id,
        type: this.frame.type
      } : undefined,

      // 6. Validity
      validity: {
        from: this.validity.from || undefined,
        to: this.validity.to || undefined,
        supersedes: this.validity.supersedes?.trim() || undefined
      },

      // 7. Jurisdiction
      jurisdiction: {
        geographic: this.jurisdiction.geographic?.trim() || undefined,
        programs: this.jurisdiction.programs.length > 0 ? [...this.jurisdiction.programs] : undefined
      },

      // 8. Parameters
      parameters: {
        inclusions: this.parameters.inclusions.length > 0 ? [...this.parameters.inclusions] : undefined,
        exclusions: this.parameters.exclusions.length > 0 ? [...this.parameters.exclusions] : undefined,
        threshold: this.parameters.threshold?.trim() || undefined,
        categories: this.parameters.categories.length > 0 ? [...this.parameters.categories] : undefined
      },

      // Scope Note (STABILIZE)
      scopeNote: this.scopeNote?.trim() || undefined,

      // Provenance
      provenance: {
        assertedBy: this.context.user,
        method: 'manual_definition',
        assertedAt: new Date().toISOString()
      },

      // 9. Epistemic Stance
      epistemicStance: {
        intent: this.epistemicStance.intent,
        confidence: this.epistemicStance.confidence,
        accountability: this.epistemicStance.accountability,
        notes: this.epistemicStance.notes?.trim() || undefined
      }
    };

    return this._clean(obj);
  }

  /**
   * Remove undefined/null/empty values
   */
  _clean(obj) {
    Object.keys(obj).forEach(k => {
      if (obj[k] === undefined || obj[k] === null || obj[k] === '') {
        delete obj[k];
      } else if (typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
        this._clean(obj[k]);
        if (Object.keys(obj[k]).length === 0) delete obj[k];
      }
    });
    return obj;
  }

  /**
   * Reset to initial state
   */
  reset() {
    this.referent = { term: '', label: '', level: ReferentLevel.KEY, dataType: ReferentDataType.STRING };
    this.authority = { name: '', shortName: '', uri: '', type: 'federal_agency' };
    this.source = { citation: '', url: '', title: '', type: 'regulation' };
    this.operator = DefinitionOperator.PROJECT;
    this.operatorParams = {};
    this.validity = { from: '', to: '', supersedes: '' };
    this.jurisdiction = { geographic: '', programs: [] };
    this.parameters = { inclusions: [], exclusions: [], threshold: '', categories: [] };
    this.epistemicStance = {
      intent: this.context.intent || DefinitionIntent.ANALYSIS,
      confidence: DefinitionConfidence.MEDIUM,
      accountability: AccountabilityFrame.OPERATIONAL,
      notes: ''
    };
    this.scopeNote = '';
    this.selectedAuthority = null;
    this.validationErrors = [];
    return this;
  }

  /**
   * Load from existing definition object
   */
  loadFrom(def) {
    if (def.referent) {
      this.referent = { ...this.referent, ...def.referent };
    }
    if (def.authority) {
      this.authority = { ...this.authority, ...def.authority };
    }
    if (def.source) {
      this.source = { ...this.source, ...def.source };
    }
    if (def.derivation) {
      this.operator = def.derivation.operator || DefinitionOperator.PROJECT;
      this.operatorParams = def.derivation.params || {};
    }
    if (def.validity) {
      this.validity = { ...this.validity, ...def.validity };
    }
    if (def.jurisdiction) {
      this.jurisdiction = {
        geographic: def.jurisdiction.geographic || '',
        programs: def.jurisdiction.programs || []
      };
    }
    if (def.parameters) {
      this.parameters = {
        inclusions: def.parameters.inclusions || [],
        exclusions: def.parameters.exclusions || [],
        threshold: def.parameters.threshold || '',
        categories: def.parameters.categories || []
      };
    }
    if (def.epistemicStance) {
      this.epistemicStance = { ...this.epistemicStance, ...def.epistemicStance };
    }
    if (def.scopeNote) {
      this.scopeNote = def.scopeNote;
    }
    return this;
  }
}

// ============================================================================
// SECTION V: Definition Builder UI Component
// ============================================================================

/**
 * DefinitionBuilderUI - Interactive UI component for building definitions
 */
class DefinitionBuilderUI {
  constructor(options = {}) {
    this.containerId = options.containerId || 'definition-builder';
    this.state = new DefinitionBuilderState(options);
    this.onSave = options.onSave || null;
    this.onCancel = options.onCancel || null;
    this.currentSource = 'ecfr';
    this.searchResults = [];
    this.outputTab = 'json';

    // Bind methods
    this._handleInput = this._handleInput.bind(this);
    this._handleOperatorSelect = this._handleOperatorSelect.bind(this);
    this._handleChipAdd = this._handleChipAdd.bind(this);
  }

  /**
   * Render the definition builder into the container
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container #${this.containerId} not found`);
      return;
    }

    container.innerHTML = this._buildHTML();
    this._attachEventListeners();
    this._updateOutput();
  }

  /**
   * Build the complete HTML
   */
  _buildHTML() {
    return `
      <div class="def-builder">
        <!-- Context Bar -->
        ${this._buildContextBar()}

        <div class="def-builder-layout">
          <!-- Main Form Panel -->
          <div class="def-builder-form">
            ${this._buildStep1Referent()}
            ${this._buildStep2Authority()}
            ${this._buildStep3Operator()}
            ${this._buildStep4Parameters()}
            ${this._buildStep5ScopeNote()}
            ${this._buildStep6Validity()}
            ${this._buildStep7Epistemic()}
            ${this._buildDerivationTrace()}
          </div>

          <!-- Output Panel -->
          <div class="def-builder-output">
            <h3>Definition Object</h3>
            ${this._buildOutputTabs()}
            <div id="def-output-json-view" class="def-output-view active">
              <pre class="def-output-json" id="def-output-json">{}</pre>
            </div>
            <div id="def-output-summary-view" class="def-output-view">
              <div class="def-summary" id="def-output-summary"></div>
            </div>
            <div class="def-output-actions">
              <button class="btn btn-copy" id="def-copy-btn">
                <i class="ph ph-copy"></i> Copy JSON
              </button>
              <button class="btn btn-secondary" id="def-clear-btn">
                <i class="ph ph-trash"></i> Clear
              </button>
              <button class="btn btn-primary" id="def-save-btn">
                <i class="ph ph-check"></i> Save Definition
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Build context bar
   */
  _buildContextBar() {
    return `
      <div class="def-context-bar">
        <div class="def-context-item">
          <label>Frame</label>
          <div class="value" id="def-ctx-frame">${this._escapeHtml(this.state.context.frameName || 'No frame selected')}</div>
        </div>
        <div class="def-context-item">
          <label>User</label>
          <div class="value" id="def-ctx-user">${this._escapeHtml(this.state.context.user || 'Anonymous')}</div>
        </div>
        <div class="def-context-item">
          <label>Intent</label>
          <div class="value">
            <select id="def-intent" class="def-select-inline" data-path="epistemicStance.intent">
              ${Object.entries(DefinitionIntent).map(([key, value]) =>
                `<option value="${value}" ${this.state.epistemicStance.intent === value ? 'selected' : ''}>${this._capitalize(value)}</option>`
              ).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Build Step 1: Referent
   */
  _buildStep1Referent() {
    return `
      <div class="def-step">
        <div class="def-step-header">
          <span class="def-step-num">1</span>
          <h3>Referent</h3>
          <span class="def-eo-param">EO &sect;1: Designated Entity</span>
        </div>
        <div class="def-step-desc">What are you defining? (column, value, or entity)</div>

        <div class="def-highlight-box green">
          <div class="def-field-row">
            <div class="def-field">
              <label>Term (key)</label>
              <input type="text" id="def-ref-term" data-path="referent.term"
                     placeholder="housing_status" value="${this._escapeHtml(this.state.referent.term)}" />
            </div>
            <div class="def-field">
              <label>Label</label>
              <input type="text" id="def-ref-label" data-path="referent.label"
                     placeholder="Housing Status" value="${this._escapeHtml(this.state.referent.label)}" />
            </div>
          </div>
          <div class="def-field-row">
            <div class="def-field">
              <label>Level</label>
              <select id="def-ref-level" data-path="referent.level">
                ${Object.entries(ReferentLevel).map(([key, value]) =>
                  `<option value="${value}" ${this.state.referent.level === value ? 'selected' : ''}>${this._capitalize(value)} (${key === 'KEY' ? 'column' : key === 'VALUE' ? 'enum' : 'record'})</option>`
                ).join('')}
              </select>
            </div>
            <div class="def-field">
              <label>Data Type</label>
              <select id="def-ref-datatype" data-path="referent.dataType">
                ${Object.entries(ReferentDataType).map(([key, value]) =>
                  `<option value="${value}" ${this.state.referent.dataType === value ? 'selected' : ''}>${this._capitalize(value)}</option>`
                ).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Build Step 2: Source Authority
   */
  _buildStep2Authority() {
    return `
      <div class="def-step">
        <div class="def-step-header">
          <span class="def-step-num">2</span>
          <h3>Source Authority</h3>
          <span class="def-eo-param">EO &sect;2: Normative Source</span>
        </div>
        <div class="def-step-desc">Where does the definition come from?</div>

        <div class="def-search-box">
          <div class="def-source-pills">
            <button class="def-source-pill ${this.currentSource === 'ecfr' ? 'active' : ''}" data-source="ecfr">eCFR</button>
            <button class="def-source-pill ${this.currentSource === 'federalRegister' ? 'active' : ''}" data-source="federalRegister">Fed Register</button>
            <button class="def-source-pill ${this.currentSource === 'wikidata' ? 'active' : ''}" data-source="wikidata">Wikidata</button>
            <button class="def-source-pill ${this.currentSource === 'internal' ? 'active' : ''}" data-source="internal">Internal</button>
          </div>
          <div class="def-search-row">
            <input type="text" id="def-auth-search" placeholder="Search for authority or regulation..." />
            <button id="def-auth-search-btn" class="btn btn-primary">
              <i class="ph ph-magnifying-glass"></i> Search
            </button>
          </div>
          <div id="def-auth-results"></div>
        </div>

        <div id="def-selected-authority"></div>

        <div class="def-field-row">
          <div class="def-field">
            <label>Authority Name</label>
            <input type="text" id="def-auth-name" data-path="authority.name"
                   placeholder="U.S. Department of Housing..." value="${this._escapeHtml(this.state.authority.name)}" />
          </div>
          <div class="def-field">
            <label>Short Name</label>
            <input type="text" id="def-auth-short" data-path="authority.shortName"
                   placeholder="HUD" value="${this._escapeHtml(this.state.authority.shortName)}" />
          </div>
        </div>
        <div class="def-field-row">
          <div class="def-field">
            <label>Authority URI</label>
            <input type="text" id="def-auth-uri" data-path="authority.uri"
                   placeholder="http://www.wikidata.org/entity/Q..." value="${this._escapeHtml(this.state.authority.uri)}" />
          </div>
          <div class="def-field">
            <label>Authority Type</label>
            <select id="def-auth-type" data-path="authority.type">
              <option value="federal_agency" ${this.state.authority.type === 'federal_agency' ? 'selected' : ''}>Federal Agency</option>
              <option value="state_agency" ${this.state.authority.type === 'state_agency' ? 'selected' : ''}>State Agency</option>
              <option value="local_gov" ${this.state.authority.type === 'local_gov' ? 'selected' : ''}>Local Gov</option>
              <option value="standards_body" ${this.state.authority.type === 'standards_body' ? 'selected' : ''}>Standards Body</option>
              <option value="internal" ${this.state.authority.type === 'internal' ? 'selected' : ''}>Internal</option>
            </select>
          </div>
        </div>
        <div class="def-field-row">
          <div class="def-field">
            <label>Citation</label>
            <input type="text" id="def-auth-citation" data-path="source.citation"
                   placeholder="24 CFR 578.3" value="${this._escapeHtml(this.state.source.citation)}" />
          </div>
          <div class="def-field">
            <label>Document URL</label>
            <input type="text" id="def-auth-url" data-path="source.url"
                   placeholder="https://www.ecfr.gov/..." value="${this._escapeHtml(this.state.source.url)}" />
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Build Step 3: Operator
   */
  _buildStep3Operator() {
    const currentOp = this.state.getOperatorMetadata();

    return `
      <div class="def-step">
        <div class="def-step-header">
          <span class="def-step-num">3</span>
          <h3>Operator</h3>
          <span class="def-eo-param">EO &sect;3: Mode of Adoption</span>
        </div>
        <div class="def-step-desc">How are you using this definition?</div>

        <div class="def-operator-grid">
          ${Object.entries(OperatorMetadata).map(([op, meta]) => `
            <div class="def-operator-option ${this.state.operator === op ? 'selected' : ''}" data-op="${op}">
              <div class="op-symbol">${meta.symbol}</div>
              <div class="op-name">${meta.name}</div>
              <div class="op-desc">${meta.description}</div>
            </div>
          `).join('')}
        </div>

        <div id="def-operator-params">
          ${this._buildOperatorParams()}
        </div>

        <div class="def-predicate-display">
          <div class="label">Derived Predicate</div>
          <div class="value" id="def-derived-predicate">${currentOp.predicate}</div>
          <div class="desc" id="def-predicate-desc">${currentOp.predicateDesc}</div>
        </div>
      </div>
    `;
  }

  /**
   * Build operator-specific parameters
   */
  _buildOperatorParams() {
    const opMeta = this.state.getOperatorMetadata();
    if (!opMeta.requiresParams) return '';

    let html = '<div class="def-operator-params-box">';
    html += `<h4>${opMeta.name} Parameters</h4>`;

    switch (this.state.operator) {
      case DefinitionOperator.SCOPE:
        html += `
          <div class="def-field">
            <label>What are you narrowing to?</label>
            <input type="text" id="def-op-narrow" data-op-param="narrowTo"
                   placeholder="e.g., Category 1 only" value="${this._escapeHtml(this.state.operatorParams.narrowTo || '')}" />
          </div>
        `;
        break;
      case DefinitionOperator.EXTEND:
        html += `
          <div class="def-field">
            <label>What are you adding?</label>
            <input type="text" id="def-op-add" data-op-param="additions"
                   placeholder="e.g., doubled-up households" value="${this._escapeHtml(this.state.operatorParams.additions || '')}" />
          </div>
        `;
        break;
      case DefinitionOperator.COMPOSE:
        html += `
          <div class="def-field">
            <label>Other rules being combined</label>
            <input type="text" id="def-op-compose" data-op-param="composedWith"
                   placeholder="e.g., local residency requirement" value="${this._escapeHtml(this.state.operatorParams.composedWith || '')}" />
          </div>
        `;
        break;
      case DefinitionOperator.DERIVE:
        html += `
          <div class="def-field">
            <label>How did you modify it?</label>
            <textarea id="def-op-transform" data-op-param="transformation" rows="2"
                      placeholder="e.g., Removed questions 7-8, rescaled to 0-10">${this._escapeHtml(this.state.operatorParams.transformation || '')}</textarea>
          </div>
        `;
        break;
      case DefinitionOperator.OVERRIDE:
        html += `
          <div class="def-field">
            <label>Why does local definition take precedence?</label>
            <input type="text" id="def-op-override" data-op-param="rationale"
                   placeholder="e.g., Federal definition too narrow for prevention" value="${this._escapeHtml(this.state.operatorParams.rationale || '')}" />
          </div>
        `;
        break;
      case DefinitionOperator.CONTEST:
        html += `
          <div class="def-field">
            <label>What do you disagree with?</label>
            <input type="text" id="def-op-contest-point" data-op-param="point"
                   placeholder="e.g., exclusion of doubled-up" value="${this._escapeHtml(this.state.operatorParams.point || '')}" />
          </div>
          <div class="def-field">
            <label>Your position</label>
            <input type="text" id="def-op-contest-pos" data-op-param="position"
                   placeholder="e.g., doubled-up should count as homeless" value="${this._escapeHtml(this.state.operatorParams.position || '')}" />
          </div>
        `;
        break;
    }

    html += '</div>';
    return html;
  }

  /**
   * Build Step 4: Parameters
   */
  _buildStep4Parameters() {
    return `
      <div class="def-step">
        <div class="def-step-header">
          <span class="def-step-num">4</span>
          <h3>Parameters</h3>
          <span class="def-eo-param">EO &sect;7: Operational Parameters</span>
        </div>
        <div class="def-step-desc">Your specific operational constraints</div>

        <div class="def-highlight-box amber">
          <div class="def-field">
            <label>Inclusions</label>
            <div class="def-chip-input" id="def-inclusions-chips">
              ${this.state.parameters.inclusions.map((val, i) =>
                `<span class="def-chip">${this._escapeHtml(val)} <span class="remove" data-chip="inclusions" data-index="${i}">&times;</span></span>`
              ).join('')}
              <input type="text" id="def-inclusions-input" placeholder="Type and press Enter..." />
            </div>
            <div class="def-hint">What's explicitly included in your definition</div>
          </div>
          <div class="def-field">
            <label>Exclusions</label>
            <div class="def-chip-input" id="def-exclusions-chips">
              ${this.state.parameters.exclusions.map((val, i) =>
                `<span class="def-chip">${this._escapeHtml(val)} <span class="remove" data-chip="exclusions" data-index="${i}">&times;</span></span>`
              ).join('')}
              <input type="text" id="def-exclusions-input" placeholder="Type and press Enter..." />
            </div>
            <div class="def-hint">What's explicitly excluded from your definition</div>
          </div>
          <div class="def-field-row">
            <div class="def-field">
              <label>Threshold</label>
              <input type="text" id="def-param-threshold" data-path="parameters.threshold"
                     placeholder="e.g., 60% AMI" value="${this._escapeHtml(this.state.parameters.threshold)}" />
            </div>
            <div class="def-field">
              <label>Categories</label>
              <input type="text" id="def-param-categories" data-path="parameters.categoriesStr"
                     placeholder="e.g., 1, 2" value="${this.state.parameters.categories.join(', ')}" />
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Build Step 5: Scope Note
   */
  _buildStep5ScopeNote() {
    return `
      <div class="def-step">
        <div class="def-step-header">
          <span class="def-step-num">5</span>
          <h3>Scope Note</h3>
          <span class="def-eo-param">EO &sect;4: STABILIZE</span>
        </div>
        <div class="def-step-desc">Your operational commitment &mdash; what does this mean FOR YOU?</div>

        <div class="def-highlight-box purple">
          <div class="def-field">
            <textarea id="def-scope-note" data-path="scopeNote" rows="4"
                      placeholder="Be specific. What edge cases have you decided? What interpretation are you committing to?&#10;&#10;Example: 'HUD Category 1 only. Overnight location determines status. Excludes doubled-up even if self-reported as homeless.'">${this._escapeHtml(this.state.scopeNote)}</textarea>
            <div class="def-hint">This cannot be auto-generated. It's YOUR operational definition.</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Build Step 6: Validity & Jurisdiction
   */
  _buildStep6Validity() {
    return `
      <div class="def-step">
        <div class="def-step-header">
          <span class="def-step-num">6</span>
          <h3>Validity &amp; Jurisdiction</h3>
          <span class="def-eo-param">EO &sect;5-6: Temporal Scope + Governance Domain</span>
        </div>

        <div class="def-field-row-3">
          <div class="def-field">
            <label>Effective From</label>
            <input type="date" id="def-valid-from" data-path="validity.from" value="${this.state.validity.from}" />
          </div>
          <div class="def-field">
            <label>Effective To</label>
            <input type="date" id="def-valid-to" data-path="validity.to" value="${this.state.validity.to}" />
          </div>
          <div class="def-field">
            <label>Supersedes</label>
            <input type="text" id="def-valid-supersedes" data-path="validity.supersedes"
                   placeholder="Prior version" value="${this._escapeHtml(this.state.validity.supersedes)}" />
          </div>
        </div>
        <div class="def-field-row">
          <div class="def-field">
            <label>Geographic Jurisdiction</label>
            <input type="text" id="def-juris-geo" data-path="jurisdiction.geographic"
                   placeholder="United States" value="${this._escapeHtml(this.state.jurisdiction.geographic)}" />
          </div>
          <div class="def-field">
            <label>Programs</label>
            <input type="text" id="def-juris-programs" data-path="jurisdiction.programsStr"
                   placeholder="CoC Program, ESG" value="${this.state.jurisdiction.programs.join(', ')}" />
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Build Step 7: Epistemic Stance
   */
  _buildStep7Epistemic() {
    return `
      <div class="def-step">
        <div class="def-step-header">
          <span class="def-step-num">7</span>
          <h3>Epistemic Stance</h3>
          <span class="def-eo-param">EO &sect;9: Confidence + Intent</span>
        </div>

        <div class="def-field-row">
          <div class="def-field">
            <label>Confidence</label>
            <select id="def-ep-confidence" data-path="epistemicStance.confidence">
              <option value="high" ${this.state.epistemicStance.confidence === 'high' ? 'selected' : ''}>High &mdash; well-understood, stable</option>
              <option value="medium" ${this.state.epistemicStance.confidence === 'medium' ? 'selected' : ''}>Medium &mdash; reasonable interpretation</option>
              <option value="low" ${this.state.epistemicStance.confidence === 'low' ? 'selected' : ''}>Low &mdash; exploratory, may change</option>
            </select>
          </div>
          <div class="def-field">
            <label>Accountability Frame</label>
            <select id="def-ep-accountability" data-path="epistemicStance.accountability">
              <option value="legal" ${this.state.epistemicStance.accountability === 'legal' ? 'selected' : ''}>Legal &mdash; auditable</option>
              <option value="contractual" ${this.state.epistemicStance.accountability === 'contractual' ? 'selected' : ''}>Contractual &mdash; funder requirement</option>
              <option value="operational" ${this.state.epistemicStance.accountability === 'operational' ? 'selected' : ''}>Operational &mdash; org policy</option>
              <option value="analytical" ${this.state.epistemicStance.accountability === 'analytical' ? 'selected' : ''}>Analytical &mdash; for this analysis</option>
              <option value="informal" ${this.state.epistemicStance.accountability === 'informal' ? 'selected' : ''}>Informal &mdash; rough guidance</option>
            </select>
          </div>
        </div>
        <div class="def-field">
          <label>Notes</label>
          <input type="text" id="def-ep-notes" data-path="epistemicStance.notes"
                 placeholder="Why this definition? Any caveats?" value="${this._escapeHtml(this.state.epistemicStance.notes)}" />
        </div>
      </div>
    `;
  }

  /**
   * Build derivation trace display
   */
  _buildDerivationTrace() {
    return `
      <div class="def-derivation-trace" id="def-derivation-trace">
        ${this.state.getDerivationTrace()}
      </div>
    `;
  }

  /**
   * Build output tabs
   */
  _buildOutputTabs() {
    return `
      <div class="def-output-tabs">
        <button class="def-output-tab ${this.outputTab === 'json' ? 'active' : ''}" data-tab="json">JSON</button>
        <button class="def-output-tab ${this.outputTab === 'summary' ? 'active' : ''}" data-tab="summary">Summary</button>
      </div>
    `;
  }

  /**
   * Build summary view
   */
  _buildSummary() {
    const def = this.state.build();
    const opMeta = this.state.getOperatorMetadata();

    return `
      <div class="def-summary-row"><span class="label">Referent</span><span class="value">${def.referent?.term || '—'} (${def.referent?.level || '—'})</span></div>
      <div class="def-summary-row"><span class="label">Authority</span><span class="value">${def.authority?.shortName || def.authority?.name || '—'}</span></div>
      <div class="def-summary-row"><span class="label">Citation</span><span class="value">${def.source?.citation || '—'}</span></div>
      <div class="def-summary-row"><span class="label">Operator</span><span class="value">${opMeta.symbol} ${opMeta.name}</span></div>
      <div class="def-summary-row"><span class="label">Predicate</span><span class="value">${def.predicate || '—'}</span></div>
      <div class="def-summary-row"><span class="label">Frame</span><span class="value">${def.frame?.id || '—'}</span></div>
      <div class="def-summary-row"><span class="label">Validity</span><span class="value">${def.validity?.from || '—'}</span></div>
      <div class="def-summary-row"><span class="label">Jurisdiction</span><span class="value">${def.jurisdiction?.geographic || '—'}</span></div>
      <div class="def-summary-row"><span class="label">Intent</span><span class="value">${def.epistemicStance?.intent || '—'}</span></div>
      <div class="def-summary-row"><span class="label">Confidence</span><span class="value">${def.epistemicStance?.confidence || '—'}</span></div>
    `;
  }

  /**
   * Attach event listeners
   */
  _attachEventListeners() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Input changes (using event delegation)
    container.addEventListener('input', this._handleInput);
    container.addEventListener('change', this._handleInput);

    // Operator selection
    container.querySelectorAll('.def-operator-option').forEach(el => {
      el.addEventListener('click', () => this._handleOperatorSelect(el.dataset.op));
    });

    // Source pills
    container.querySelectorAll('.def-source-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        container.querySelectorAll('.def-source-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentSource = pill.dataset.source;
      });
    });

    // Search button
    const searchBtn = container.querySelector('#def-auth-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => this._performSearch());
    }

    // Search on enter
    const searchInput = container.querySelector('#def-auth-search');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this._performSearch();
      });
    }

    // Chip inputs
    this._setupChipInput('inclusions');
    this._setupChipInput('exclusions');

    // Output tabs
    container.querySelectorAll('.def-output-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.outputTab = tab.dataset.tab;
        container.querySelectorAll('.def-output-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        container.querySelectorAll('.def-output-view').forEach(v => v.classList.remove('active'));
        container.querySelector(`#def-output-${tab.dataset.tab}-view`).classList.add('active');
      });
    });

    // Action buttons
    const copyBtn = container.querySelector('#def-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this._copyOutput());
    }

    const clearBtn = container.querySelector('#def-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this._clearForm());
    }

    const saveBtn = container.querySelector('#def-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this._saveDefinition());
    }
  }

  /**
   * Handle input changes
   */
  _handleInput(e) {
    const el = e.target;
    const path = el.dataset.path;
    const opParam = el.dataset.opParam;

    if (path) {
      // Handle special cases for array fields
      if (path === 'parameters.categoriesStr') {
        this.state.parameters.categories = el.value.split(',').map(s => s.trim()).filter(s => s);
      } else if (path === 'jurisdiction.programsStr') {
        this.state.jurisdiction.programs = el.value.split(',').map(s => s.trim()).filter(s => s);
      } else {
        this.state.set(path, el.value);
      }
      this._updateOutput();
    } else if (opParam) {
      this.state.operatorParams[opParam] = el.value;
      this._updateOutput();
    }
  }

  /**
   * Handle operator selection
   */
  _handleOperatorSelect(op) {
    this.state.operator = op;
    this.state.operatorParams = {};

    const container = document.getElementById(this.containerId);

    // Update operator grid selection
    container.querySelectorAll('.def-operator-option').forEach(el => {
      el.classList.toggle('selected', el.dataset.op === op);
    });

    // Update operator params
    const paramsContainer = container.querySelector('#def-operator-params');
    if (paramsContainer) {
      paramsContainer.innerHTML = this._buildOperatorParams();
      // Reattach event listeners for new inputs
      paramsContainer.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('input', this._handleInput);
      });
    }

    // Update predicate display
    const opMeta = OperatorMetadata[op];
    const predicateEl = container.querySelector('#def-derived-predicate');
    const descEl = container.querySelector('#def-predicate-desc');
    if (predicateEl) predicateEl.textContent = opMeta.predicate;
    if (descEl) descEl.textContent = opMeta.predicateDesc;

    this._updateOutput();
  }

  /**
   * Setup chip input
   */
  _setupChipInput(name) {
    const container = document.getElementById(this.containerId);
    const input = container.querySelector(`#def-${name}-input`);
    const chipsContainer = container.querySelector(`#def-${name}-chips`);

    if (!input || !chipsContainer) return;

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        e.preventDefault();
        this.state.parameters[name].push(input.value.trim());
        input.value = '';
        this._renderChips(name);
        this._updateOutput();
      }
    });

    // Chip removal (event delegation)
    chipsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove')) {
        const index = parseInt(e.target.dataset.index);
        this.state.parameters[name].splice(index, 1);
        this._renderChips(name);
        this._updateOutput();
      }
    });
  }

  /**
   * Render chips
   */
  _renderChips(name) {
    const container = document.getElementById(this.containerId);
    const chipsContainer = container.querySelector(`#def-${name}-chips`);
    const input = container.querySelector(`#def-${name}-input`);

    if (!chipsContainer || !input) return;

    const chips = this.state.parameters[name].map((val, i) =>
      `<span class="def-chip">${this._escapeHtml(val)} <span class="remove" data-chip="${name}" data-index="${i}">&times;</span></span>`
    ).join('');

    chipsContainer.innerHTML = chips;
    chipsContainer.appendChild(input);
  }

  /**
   * Perform authority search
   */
  async _performSearch() {
    const container = document.getElementById(this.containerId);
    const searchInput = container.querySelector('#def-auth-search');
    const resultsContainer = container.querySelector('#def-auth-results');

    const query = searchInput?.value?.trim();
    if (!query) return;

    resultsContainer.innerHTML = '<div class="def-loading">Searching...</div>';

    try {
      const api = window.EO?.getDefinitionAPI?.();
      if (!api) {
        resultsContainer.innerHTML = '<div class="def-no-results">API not available</div>';
        return;
      }

      let results = [];

      if (this.currentSource === 'wikidata') {
        results = await api.searchConcepts(query, { sources: ['wikidata'], limit: 8 });
      } else if (this.currentSource === 'ecfr') {
        results = await api.searchRegulatory(query, { sources: ['ecfr'], limit: 8 });
      } else if (this.currentSource === 'federalRegister') {
        results = await api.searchRegulatory(query, { sources: ['federalRegister'], limit: 8 });
      } else if (this.currentSource === 'internal') {
        results = [{
          label: 'Internal Definition',
          description: 'Define your own authority',
          source: 'Internal',
          meta: {}
        }];
      }

      this.searchResults = results;

      if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="def-no-results">No results found</div>';
        return;
      }

      resultsContainer.innerHTML = `
        <div class="def-search-results">
          ${results.map((r, i) => `
            <div class="def-search-result" data-index="${i}">
              <div class="result-label">${this._escapeHtml(r.label || r.title || 'Untitled')}</div>
              <div class="result-desc">${this._escapeHtml((r.description || r.snippet || '').substring(0, 100))}</div>
              <div class="result-uri">${this._escapeHtml(r.citation || r.uri || '')}</div>
            </div>
          `).join('')}
        </div>
      `;

      // Attach click handlers
      resultsContainer.querySelectorAll('.def-search-result').forEach(el => {
        el.addEventListener('click', () => this._selectAuthority(parseInt(el.dataset.index)));
      });

    } catch (error) {
      console.error('Search error:', error);
      resultsContainer.innerHTML = `<div class="def-no-results">Error: ${error.message}</div>`;
    }
  }

  /**
   * Select an authority from search results
   */
  _selectAuthority(index) {
    const result = this.searchResults[index];
    if (!result) return;

    this.state.selectedAuthority = result;

    const container = document.getElementById(this.containerId);

    // Clear results
    container.querySelector('#def-auth-results').innerHTML = '';

    // Show selected
    container.querySelector('#def-selected-authority').innerHTML = `
      <div class="def-selected-item">
        <div>
          <div class="label">${this._escapeHtml(result.label || result.title || 'Selected')}</div>
          <div class="uri">${this._escapeHtml(result.citation || result.uri || '')}</div>
        </div>
        <button class="btn-clear" id="def-clear-auth">&times;</button>
      </div>
    `;

    container.querySelector('#def-clear-auth')?.addEventListener('click', () => {
      this.state.selectedAuthority = null;
      container.querySelector('#def-selected-authority').innerHTML = '';
    });

    // Auto-fill fields
    if (result.citation) {
      this.state.source.citation = result.citation;
      const citationInput = container.querySelector('#def-auth-citation');
      if (citationInput) citationInput.value = result.citation;
    }

    if (result.url) {
      this.state.source.url = result.url;
      const urlInput = container.querySelector('#def-auth-url');
      if (urlInput) urlInput.value = result.url;
    }

    if (result.meta?.agencies?.[0]?.name) {
      this.state.authority.name = result.meta.agencies[0].name;
      const nameInput = container.querySelector('#def-auth-name');
      if (nameInput) nameInput.value = result.meta.agencies[0].name;
    }

    if (result.meta?.effective_on) {
      this.state.validity.from = result.meta.effective_on;
      const fromInput = container.querySelector('#def-valid-from');
      if (fromInput) fromInput.value = result.meta.effective_on;
    }

    this._updateOutput();
  }

  /**
   * Update the output display
   */
  _updateOutput() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const def = this.state.build();

    // Update JSON output
    const jsonEl = container.querySelector('#def-output-json');
    if (jsonEl) {
      jsonEl.textContent = JSON.stringify(def, null, 2);
    }

    // Update summary
    const summaryEl = container.querySelector('#def-output-summary');
    if (summaryEl) {
      summaryEl.innerHTML = this._buildSummary();
    }

    // Update derivation trace
    const traceEl = container.querySelector('#def-derivation-trace');
    if (traceEl) {
      traceEl.textContent = this.state.getDerivationTrace();
    }
  }

  /**
   * Copy output to clipboard
   */
  async _copyOutput() {
    const container = document.getElementById(this.containerId);
    const jsonEl = container.querySelector('#def-output-json');
    const copyBtn = container.querySelector('#def-copy-btn');

    if (!jsonEl || !copyBtn) return;

    try {
      await navigator.clipboard.writeText(jsonEl.textContent);
      copyBtn.innerHTML = '<i class="ph ph-check"></i> Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.innerHTML = '<i class="ph ph-copy"></i> Copy JSON';
        copyBtn.classList.remove('copied');
      }, 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }

  /**
   * Clear the form
   */
  _clearForm() {
    this.state.reset();
    this.searchResults = [];
    this.render();
  }

  /**
   * Save the definition
   */
  _saveDefinition() {
    if (!this.state.validate()) {
      const errors = this.state.validationErrors.map(e => e.message).join('\n');
      if (window.showAlertModal) {
        window.showAlertModal({
          title: 'Validation Error',
          message: 'Please fix the following errors:\n\n' + errors
        });
      } else {
        alert('Validation errors:\n' + errors);
      }
      return;
    }

    const def = this.state.build();

    if (this.onSave) {
      this.onSave(def);
    } else {
      console.log('Definition saved:', def);
      if (window.showAlertModal) {
        window.showAlertModal({
          title: 'Definition Saved',
          message: 'The definition has been created successfully.'
        });
      }
    }
  }

  /**
   * Helper: Escape HTML
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  /**
   * Helper: Capitalize
   */
  _capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  /**
   * Set context
   */
  setContext(context) {
    Object.assign(this.state.context, context);
    if (context.frameId) {
      this.state.frame.id = `eo:frame/${context.frameId}`;
    }
    return this;
  }

  /**
   * Get the current definition
   */
  getDefinition() {
    return this.state.build();
  }

  /**
   * Load an existing definition
   */
  loadDefinition(def) {
    this.state.loadFrom(def);
    this.render();
    return this;
  }
}

// ============================================================================
// SECTION VI: Definition Builder Modal
// ============================================================================

/**
 * Show the definition builder in a modal
 */
function showDefinitionBuilderModal(options = {}) {
  const modalContent = '<div id="def-builder-modal-content"></div>';

  const modal = new EOModal({
    id: 'definition-builder-modal',
    title: 'EO Definition Builder',
    content: modalContent,
    size: 'large',
    buttons: []
  });

  modal.show();

  // Initialize the builder
  const builder = new DefinitionBuilderUI({
    containerId: 'def-builder-modal-content',
    ...options,
    onSave: (def) => {
      if (options.onSave) {
        options.onSave(def);
      }
      modal.hide();
    },
    onCancel: () => {
      modal.hide();
    }
  });

  builder.render();

  return { modal, builder };
}

// ============================================================================
// SECTION VII: Exports
// ============================================================================

// Export for browser
if (typeof window !== 'undefined') {
  window.EO = window.EO || {};

  // Types
  window.EO.DefinitionOperator = DefinitionOperator;
  window.EO.OperatorMetadata = OperatorMetadata;
  window.EO.ReferentLevel = ReferentLevel;
  window.EO.ReferentDataType = ReferentDataType;
  window.EO.DefinitionIntent = DefinitionIntent;
  window.EO.DefinitionConfidence = DefinitionConfidence;
  window.EO.AccountabilityFrame = AccountabilityFrame;

  // Classes
  window.EO.DefinitionBuilderState = DefinitionBuilderState;
  window.EO.DefinitionBuilderUI = DefinitionBuilderUI;

  // Functions
  window.EO.showDefinitionBuilderModal = showDefinitionBuilderModal;

  // Convenience aliases
  window.DefinitionBuilderUI = DefinitionBuilderUI;
  window.showDefinitionBuilderModal = showDefinitionBuilderModal;
}

// Export for Node.js/ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DefinitionOperator,
    OperatorMetadata,
    ReferentLevel,
    ReferentDataType,
    DefinitionIntent,
    DefinitionConfidence,
    AccountabilityFrame,
    DefinitionBuilderState,
    DefinitionBuilderUI,
    showDefinitionBuilderModal
  };
}
