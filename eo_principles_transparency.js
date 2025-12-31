/**
 * EO Principles Transparency Panel
 *
 * "The append-only log is the database. Everything else is a view."
 *
 * This module provides a transparent window into HOW the application
 * works according to the Nine Rules of Experience Engines. Every operation
 * is mapped to the principles it upholds, making the philosophical
 * foundations visible and verifiable.
 *
 * The transparency panel shows:
 * - Real-time rule compliance status
 * - Event stream with principle annotations
 * - Provenance chains (how Meant grounds in Given)
 * - Horizon filtering effects
 * - Operation → Principle mappings
 */

/**
 * The Nine Rules with their philosophical grounding
 */
const NINE_RULES = Object.freeze([
  // Part I: The Given
  {
    number: 1,
    name: 'Distinction',
    part: 'THE GIVEN',
    partNumber: 'I',
    axiom: 'Given ⊕ Meant',
    principle: 'Every event is EITHER raw experience OR interpretation—never both, never neither.',
    violation: 'Categorical Confusion',
    icon: 'ph-split-vertical',
    color: '#10b981' // green
  },
  {
    number: 2,
    name: 'Impenetrability',
    part: 'THE GIVEN',
    partNumber: 'I',
    axiom: 'Given ← Given only',
    principle: 'Raw experience derives only from raw experience. Interpretations cannot fabricate experiences.',
    violation: 'Confabulation',
    icon: 'ph-shield-check',
    color: '#10b981'
  },
  {
    number: 3,
    name: 'Ineliminability',
    part: 'THE GIVEN',
    partNumber: 'I',
    axiom: 'Given persists',
    principle: 'Raw experience cannot be erased, edited, or replaced. The past is immutable.',
    violation: 'Gaslighting',
    icon: 'ph-lock-laminated',
    color: '#10b981'
  },
  // Part II: The Horizon
  {
    number: 4,
    name: 'Perspectivality',
    part: 'THE HORIZON',
    partNumber: 'II',
    axiom: 'No view from nowhere',
    principle: 'All access is mediated by context (horizon). There is no universal "god\'s eye" view.',
    violation: 'Context Collapse',
    icon: 'ph-eye',
    color: '#8b5cf6' // purple
  },
  {
    number: 5,
    name: 'Restrictivity',
    part: 'THE HORIZON',
    partNumber: 'II',
    axiom: 'Refinement only restricts',
    principle: 'Narrowing context can only hide information, never reveal new information.',
    violation: 'Foreclosure Violation',
    icon: 'ph-funnel',
    color: '#8b5cf6'
  },
  {
    number: 6,
    name: 'Coherence',
    part: 'THE HORIZON',
    partNumber: 'II',
    axiom: 'Valid inference survives refinement',
    principle: 'If an interpretation is valid in a broad context, it remains valid in all narrower contexts.',
    violation: 'Coherence Failure',
    icon: 'ph-check-circle',
    color: '#8b5cf6'
  },
  // Part III: The Meant
  {
    number: 7,
    name: 'Groundedness',
    part: 'THE MEANT',
    partNumber: 'III',
    axiom: 'Meant → Given (provenance)',
    principle: 'Every interpretation must trace back to raw experience. No free-floating meanings.',
    violation: 'Groundlessness',
    icon: 'ph-tree-structure',
    color: '#f59e0b' // amber
  },
  {
    number: 8,
    name: 'Determinacy',
    part: 'THE MEANT',
    partNumber: 'III',
    axiom: 'Meaning crystallizes locally',
    principle: 'Meaning is determined by use within a specific context, not by abstract universal definition.',
    violation: 'Premature Determinacy',
    icon: 'ph-target',
    color: '#f59e0b'
  },
  {
    number: 9,
    name: 'Defeasibility',
    part: 'THE MEANT',
    partNumber: 'III',
    axiom: 'No dogma',
    principle: 'Interpretations can be superseded. Later readings may overturn earlier ones.',
    violation: 'Dogmatism',
    icon: 'ph-arrows-clockwise',
    color: '#f59e0b'
  }
]);

/**
 * Operation types and which rules they touch
 */
const OPERATION_RULE_MAP = Object.freeze({
  // Given operations
  'record_given': {
    name: 'Record Raw Experience',
    description: 'Appending a new Given event to the log',
    rules: [1, 2, 3],
    explanation: {
      1: 'Event is classified as "given" (partition maintained)',
      2: 'Event derives from external source, not interpretation',
      3: 'Event is appended immutably to the log'
    }
  },
  'import_data': {
    name: 'Import External Data',
    description: 'Bringing in data from outside the system',
    rules: [1, 2, 3],
    explanation: {
      1: 'Imported data becomes Given events',
      2: 'External origin ensures no confabulation',
      3: 'Original data preserved in append-only log'
    }
  },

  // Meant operations
  'record_meant': {
    name: 'Record Interpretation',
    description: 'Creating a new Meant event with provenance',
    rules: [1, 7, 8, 9],
    explanation: {
      1: 'Event is classified as "meant" (partition maintained)',
      7: 'Provenance links to Given events required',
      8: 'Frame and purpose specified for context',
      9: 'Marked as defeasible (can be superseded)'
    }
  },
  'supersede': {
    name: 'Supersede Interpretation',
    description: 'A new interpretation replaces an earlier one',
    rules: [3, 7, 9],
    explanation: {
      3: 'Original interpretation preserved (not deleted)',
      7: 'New interpretation maintains provenance',
      9: 'Demonstrates defeasibility in action'
    }
  },

  // Horizon operations
  'change_horizon': {
    name: 'Change Perspective',
    description: 'Switching to a different viewing context',
    rules: [4, 5, 6],
    explanation: {
      4: 'Access mediated by new horizon',
      5: 'Narrower horizons restrict visibility',
      6: 'Valid interpretations remain coherent'
    }
  },
  'refine_horizon': {
    name: 'Refine Horizon',
    description: 'Creating a more specific viewing context',
    rules: [4, 5],
    explanation: {
      4: 'New perspective created',
      5: 'Can only restrict, never expand access'
    }
  },

  // View operations
  'derive_view': {
    name: 'Derive View',
    description: 'Computing a view from the event log',
    rules: [3, 4],
    explanation: {
      3: 'View is derived from immutable log (not authoritative)',
      4: 'View respects current horizon constraints'
    }
  },
  'filter_view': {
    name: 'Filter View',
    description: 'Applying filters to narrow what is shown',
    rules: [4, 5],
    explanation: {
      4: 'Filtering is a form of perspectival access',
      5: 'Filters only restrict, never add data'
    }
  },

  // Entity operations
  'create_entity': {
    name: 'Create Entity',
    description: 'Creating a new record in the workbench',
    rules: [1, 2, 3],
    explanation: {
      1: 'Creation recorded as Given event',
      2: 'Entity data comes from user input (external)',
      3: 'Appended immutably to log'
    }
  },
  'update_entity': {
    name: 'Update Entity',
    description: 'Modifying a field value',
    rules: [1, 3, 9],
    explanation: {
      1: 'Update is a new Given event (not mutation)',
      3: 'Original value preserved, new value appended',
      9: 'Old value can still be accessed (not erased)'
    }
  },
  'delete_entity': {
    name: 'Delete Entity',
    description: 'Soft-deleting via tombstone',
    rules: [3, 9],
    explanation: {
      3: 'Deletion is a tombstone event (original preserved)',
      9: 'Tombstone is defeasible (can be reversed)'
    }
  },

  // Ghost operations
  'ghost_entity': {
    name: 'Ghost Entity',
    description: 'Transition entity to ghost state (soft delete)',
    rules: [3, 7, 9],
    explanation: {
      3: 'Original entity preserved in log, ghost record created',
      7: 'Ghost maintains provenance to original entity',
      9: 'Ghost can be resurrected (defeasible deletion)'
    }
  },
  'resurrect_ghost': {
    name: 'Resurrect Ghost',
    description: 'Restore a ghost back to active entity',
    rules: [1, 3, 7],
    explanation: {
      1: 'Resurrection recorded as new Given event',
      3: 'Ghost history preserved, new state appended',
      7: 'Resurrection grounds in original entity and ghost'
    }
  },
  'detect_haunt': {
    name: 'Detect Haunt',
    description: 'System detects ghost influence on active data',
    rules: [3, 7],
    explanation: {
      3: 'Ghost existence is ineliminable (still has effects)',
      7: 'Haunt relationship has provenance chain'
    }
  },
  'resolve_haunt': {
    name: 'Resolve Haunt',
    description: 'Clear ghost influence on an entity',
    rules: [3, 7, 9],
    explanation: {
      3: 'Haunt resolution recorded, original haunt preserved',
      7: 'Resolution has provenance to haunt and resolver',
      9: 'Haunt can potentially recur (defeasible resolution)'
    }
  }
});

/**
 * EOPrinciplesTransparency - The main transparency panel manager
 */
class EOPrinciplesTransparency {
  constructor(options = {}) {
    this.container = null;
    this.eventBus = options.eventBus || (typeof getEventBus !== 'undefined' ? getEventBus() : null);
    this.eventStore = options.eventStore || null;
    this.horizonLattice = options.horizonLattice || null;
    this.complianceChecker = options.complianceChecker || null;

    // State
    this.isOpen = false;
    this.activeTab = 'principles';
    this.operationLog = [];
    this.maxOperationLog = 50;
    this.lastAudit = null;
    this.ruleStates = new Map();

    // Initialize rule states
    NINE_RULES.forEach(rule => {
      this.ruleStates.set(rule.number, {
        passed: true,
        lastCheck: null,
        touchCount: 0,
        violations: []
      });
    });

    // Bind methods
    this.render = this.render.bind(this);
    this.toggle = this.toggle.bind(this);
    this.logOperation = this.logOperation.bind(this);
  }

  /**
   * Initialize the transparency panel
   */
  init(containerId = 'principles-panel') {
    // Create container if it doesn't exist
    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = containerId;
      this.container.className = 'principles-panel';
      document.body.appendChild(this.container);
    }

    // Subscribe to events
    if (this.eventBus) {
      this._subscribeToEvents();
    }

    // Initial render
    this.render();

    // Run initial compliance check
    this.runComplianceCheck();

    return this;
  }

  /**
   * Subscribe to event bus for real-time updates
   */
  _subscribeToEvents() {
    // Given events
    this.eventBus.on(BusEventType.GIVEN_RECORDED, (event) => {
      this.logOperation('record_given', event.payload, [1, 2, 3]);
      this._touchRules([1, 2, 3]);
    });

    // Meant events
    this.eventBus.on(BusEventType.MEANT_RECORDED, (event) => {
      this.logOperation('record_meant', event.payload, [1, 7, 8, 9]);
      this._touchRules([1, 7, 8, 9]);
    });

    // Supersession
    this.eventBus.on(BusEventType.SUPERSESSION_CREATED, (event) => {
      this.logOperation('supersede', event.payload, [3, 7, 9]);
      this._touchRules([3, 7, 9]);
    });

    // Tombstone
    this.eventBus.on(BusEventType.TOMBSTONE_CREATED, (event) => {
      this.logOperation('delete_entity', event.payload, [3, 9]);
      this._touchRules([3, 9]);
    });

    // Horizon changes
    this.eventBus.on(BusEventType.HORIZON_CHANGED, (event) => {
      this.logOperation('change_horizon', event.payload, [4, 5, 6]);
      this._touchRules([4, 5, 6]);
    });

    // View changes
    this.eventBus.on(BusEventType.VIEW_UPDATED, (event) => {
      this.logOperation('derive_view', event.payload, [3, 4]);
      this._touchRules([3, 4]);
    });

    // Compliance events
    this.eventBus.on(BusEventType.COMPLIANCE_CHECK, (event) => {
      this._handleComplianceReport(event.payload);
    });

    // Rule violations
    this.eventBus.on(BusEventType.RULE_VIOLATION, (event) => {
      this._handleViolation(event.payload);
    });

    // Entity events
    this.eventBus.on(BusEventType.ENTITY_CREATED, (event) => {
      this.logOperation('create_entity', event.payload, [1, 2, 3]);
      this._touchRules([1, 2, 3]);
    });

    this.eventBus.on(BusEventType.ENTITY_UPDATED, (event) => {
      this.logOperation('update_entity', event.payload, [1, 3, 9]);
      this._touchRules([1, 3, 9]);
    });

    this.eventBus.on(BusEventType.ENTITY_DELETED, (event) => {
      this.logOperation('delete_entity', event.payload, [3, 9]);
      this._touchRules([3, 9]);
    });
  }

  /**
   * Log an operation with its rule mappings
   */
  logOperation(type, data, rules) {
    const operation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      timestamp: new Date().toISOString(),
      data: this._sanitizeData(data),
      rules,
      info: OPERATION_RULE_MAP[type] || { name: type, description: '', rules: [], explanation: {} }
    };

    this.operationLog.unshift(operation);

    if (this.operationLog.length > this.maxOperationLog) {
      this.operationLog.pop();
    }

    if (this.isOpen && this.activeTab === 'operations') {
      this._renderOperationsTab();
    }
  }

  /**
   * Sanitize data for display
   */
  _sanitizeData(data) {
    if (!data) return null;
    try {
      const str = JSON.stringify(data);
      if (str.length > 200) {
        return JSON.parse(str.substring(0, 197) + '...');
      }
      return data;
    } catch {
      return { type: typeof data };
    }
  }

  /**
   * Touch rules (mark as recently used)
   */
  _touchRules(ruleNumbers) {
    const now = Date.now();
    for (const num of ruleNumbers) {
      const state = this.ruleStates.get(num);
      if (state) {
        state.touchCount++;
        state.lastTouch = now;
      }
    }

    if (this.isOpen && this.activeTab === 'principles') {
      this._renderPrinciplesTab();
    }
  }

  /**
   * Handle compliance report
   */
  _handleComplianceReport(report) {
    this.lastAudit = report;

    if (report.rules) {
      for (const result of report.rules) {
        const state = this.ruleStates.get(result.rule);
        if (state) {
          state.passed = result.passed;
          state.lastCheck = new Date().toISOString();
          state.violations = result.violations || [];
        }
      }
    }

    if (this.isOpen) {
      this._renderPrinciplesTab();
    }
  }

  /**
   * Handle individual violation
   */
  _handleViolation(violation) {
    const state = this.ruleStates.get(violation.rule);
    if (state) {
      state.passed = false;
      state.violations.push(violation);
      if (state.violations.length > 10) {
        state.violations.shift();
      }
    }

    if (this.isOpen) {
      this._renderPrinciplesTab();
    }
  }

  /**
   * Run compliance check
   */
  runComplianceCheck() {
    if (this.complianceChecker) {
      const audit = this.complianceChecker.runAudit();
      this._handleComplianceReport(audit.toReport());
    }
  }

  /**
   * Toggle panel open/closed
   */
  toggle() {
    this.isOpen = !this.isOpen;
    this.render();
  }

  /**
   * Open the panel
   */
  open() {
    this.isOpen = true;
    this.render();
  }

  /**
   * Close the panel
   */
  close() {
    this.isOpen = false;
    this.render();
  }

  /**
   * Set active tab
   */
  setTab(tab) {
    this.activeTab = tab;
    this.render();
  }

  /**
   * Main render function
   */
  render() {
    if (!this.container) return;

    const toggleBtn = this._renderToggleButton();
    const panel = this.isOpen ? this._renderPanel() : '';

    this.container.innerHTML = toggleBtn + panel;
    this._attachEventListeners();
  }

  /**
   * Render toggle button
   */
  _renderToggleButton() {
    const allPassed = Array.from(this.ruleStates.values()).every(s => s.passed);
    const statusClass = allPassed ? 'compliant' : 'violation';

    return `
      <button class="principles-toggle ${this.isOpen ? 'open' : ''} ${statusClass}" id="principles-toggle">
        <i class="ph ph-eye${this.isOpen ? '-slash' : ''}"></i>
        <span class="toggle-label">9 Rules</span>
        <span class="toggle-status">
          ${allPassed ? '<i class="ph ph-check-circle"></i>' : '<i class="ph ph-warning-circle"></i>'}
        </span>
      </button>
    `;
  }

  /**
   * Render the main panel
   */
  _renderPanel() {
    return `
      <div class="principles-panel-content">
        <div class="principles-panel-header">
          <h2>
            <i class="ph ph-book-open"></i>
            Experience Engine Transparency
          </h2>
          <p class="principles-subtitle">"The append-only log is the database. Everything else is a view."</p>
        </div>

        <div class="principles-tabs">
          <button class="principles-tab ${this.activeTab === 'principles' ? 'active' : ''}" data-tab="principles">
            <i class="ph ph-scales"></i> The 9 Rules
          </button>
          <button class="principles-tab ${this.activeTab === 'operations' ? 'active' : ''}" data-tab="operations">
            <i class="ph ph-activity"></i> Live Operations
          </button>
          <button class="principles-tab ${this.activeTab === 'provenance' ? 'active' : ''}" data-tab="provenance">
            <i class="ph ph-tree-structure"></i> Provenance
          </button>
          <button class="principles-tab ${this.activeTab === 'log' ? 'active' : ''}" data-tab="log">
            <i class="ph ph-scroll"></i> Event Log
          </button>
        </div>

        <div class="principles-tab-content" id="principles-tab-content">
          ${this._renderActiveTab()}
        </div>

        <div class="principles-panel-footer">
          <button class="btn btn-sm" id="run-compliance-check">
            <i class="ph ph-arrows-clockwise"></i> Run Compliance Check
          </button>
          <span class="last-check">
            ${this.lastAudit ? `Last: ${new Date(this.lastAudit.audit?.endTime || Date.now()).toLocaleTimeString()}` : 'Not checked yet'}
          </span>
        </div>
      </div>
    `;
  }

  /**
   * Render active tab content
   */
  _renderActiveTab() {
    switch (this.activeTab) {
      case 'principles':
        return this._renderPrinciplesTabContent();
      case 'operations':
        return this._renderOperationsTabContent();
      case 'provenance':
        return this._renderProvenanceTabContent();
      case 'log':
        return this._renderLogTabContent();
      default:
        return this._renderPrinciplesTabContent();
    }
  }

  /**
   * Render principles tab
   */
  _renderPrinciplesTabContent() {
    const parts = [
      { name: 'THE GIVEN', subtitle: 'Experience must not be fabricated', rules: [1, 2, 3], color: '#10b981' },
      { name: 'THE HORIZON', subtitle: 'There is no view from nowhere', rules: [4, 5, 6], color: '#8b5cf6' },
      { name: 'THE MEANT', subtitle: 'Meaning must earn its keep', rules: [7, 8, 9], color: '#f59e0b' }
    ];

    return parts.map((part, idx) => `
      <div class="principles-part">
        <div class="part-header" style="border-left-color: ${part.color}">
          <span class="part-number">Part ${['I', 'II', 'III'][idx]}</span>
          <h3 class="part-name">${part.name}</h3>
          <p class="part-subtitle">${part.subtitle}</p>
        </div>
        <div class="rules-grid">
          ${part.rules.map(num => this._renderRuleCard(NINE_RULES[num - 1])).join('')}
        </div>
      </div>
    `).join('');
  }

  /**
   * Render a single rule card
   */
  _renderRuleCard(rule) {
    const state = this.ruleStates.get(rule.number);
    const statusClass = state.passed ? 'passed' : 'failed';
    const recentlyTouched = state.lastTouch && (Date.now() - state.lastTouch < 2000);

    return `
      <div class="rule-card ${statusClass} ${recentlyTouched ? 'touched' : ''}" data-rule="${rule.number}">
        <div class="rule-header">
          <div class="rule-number">${rule.number}</div>
          <div class="rule-icon"><i class="ph ${rule.icon}"></i></div>
          <div class="rule-status">
            ${state.passed
              ? '<i class="ph ph-check-circle"></i>'
              : '<i class="ph ph-warning-circle"></i>'}
          </div>
        </div>
        <h4 class="rule-name">${rule.name}</h4>
        <div class="rule-axiom">${rule.axiom}</div>
        <p class="rule-principle">${rule.principle}</p>
        <div class="rule-footer">
          <span class="rule-violation-label">Violation: <strong>${rule.violation}</strong></span>
          <span class="rule-touch-count" title="Times touched">${state.touchCount}</span>
        </div>
        ${state.violations.length > 0 ? `
          <div class="rule-violations">
            <strong>Active Violations:</strong>
            ${state.violations.slice(0, 2).map(v => `<div class="violation-item">${v.error || v.violation?.error || 'Unknown'}</div>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render operations tab
   */
  _renderOperationsTabContent() {
    if (this.operationLog.length === 0) {
      return `
        <div class="empty-operations">
          <i class="ph ph-activity"></i>
          <p>No operations recorded yet.</p>
          <p class="hint">Operations will appear here as you interact with the app.</p>
        </div>
      `;
    }

    return `
      <div class="operations-list">
        ${this.operationLog.map(op => this._renderOperationItem(op)).join('')}
      </div>
    `;
  }

  /**
   * Render a single operation item
   */
  _renderOperationItem(op) {
    const info = op.info;

    return `
      <div class="operation-item">
        <div class="operation-header">
          <span class="operation-name">${info.name}</span>
          <span class="operation-time">${new Date(op.timestamp).toLocaleTimeString()}</span>
        </div>
        <p class="operation-description">${info.description}</p>
        <div class="operation-rules">
          <span class="rules-label">Rules upheld:</span>
          ${op.rules.map(num => {
            const rule = NINE_RULES[num - 1];
            return `
              <span class="rule-badge" style="background-color: ${rule.color}20; color: ${rule.color}" title="${info.explanation[num] || rule.principle}">
                ${num}. ${rule.name}
              </span>
            `;
          }).join('')}
        </div>
        ${info.explanation && Object.keys(info.explanation).length > 0 ? `
          <div class="operation-explanations">
            ${op.rules.map(num => info.explanation[num] ? `
              <div class="explanation-item">
                <span class="explanation-rule">Rule ${num}:</span>
                ${info.explanation[num]}
              </div>
            ` : '').join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render provenance tab
   */
  _renderProvenanceTabContent() {
    if (!this.eventStore) {
      return `
        <div class="empty-provenance">
          <i class="ph ph-tree-structure"></i>
          <p>Event store not connected.</p>
        </div>
      `;
    }

    const meantEvents = this.eventStore.getMeant ? this.eventStore.getMeant().slice(-10) : [];

    if (meantEvents.length === 0) {
      return `
        <div class="empty-provenance">
          <i class="ph ph-tree-structure"></i>
          <p>No interpretations (Meant events) yet.</p>
          <p class="hint">Interpretations show how meaning grounds in raw experience.</p>
        </div>
      `;
    }

    return `
      <div class="provenance-intro">
        <p><strong>Rule 7 (Groundedness)</strong>: Every interpretation must trace to raw experience.</p>
        <p>Below shows how Meant events ground in Given events:</p>
      </div>
      <div class="provenance-chains">
        ${meantEvents.map(meant => this._renderProvenanceChain(meant)).join('')}
      </div>
    `;
  }

  /**
   * Render a provenance chain
   */
  _renderProvenanceChain(meant) {
    const provenance = meant.provenance || [];

    return `
      <div class="provenance-chain">
        <div class="chain-meant">
          <span class="event-type meant">MEANT</span>
          <span class="event-purpose">${meant.frame?.purpose || 'interpretation'}</span>
          <code class="event-id">${meant.id.substring(0, 8)}...</code>
        </div>
        <div class="chain-arrow">
          <i class="ph ph-arrow-down"></i>
          <span class="arrow-label">grounds in</span>
        </div>
        <div class="chain-given-list">
          ${provenance.length > 0 ? provenance.map(provId => {
            const given = this.eventStore.get ? this.eventStore.get(provId) : null;
            return `
              <div class="chain-given">
                <span class="event-type given">GIVEN</span>
                <span class="event-mode">${given?.mode || 'experience'}</span>
                <code class="event-id">${provId.substring(0, 8)}...</code>
              </div>
            `;
          }).join('') : `
            <div class="chain-warning">
              <i class="ph ph-warning"></i>
              No provenance! (Violates Rule 7)
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Render event log tab
   */
  _renderLogTabContent() {
    if (!this.eventStore) {
      return `
        <div class="empty-log">
          <i class="ph ph-scroll"></i>
          <p>Event store not connected.</p>
        </div>
      `;
    }

    const events = this.eventStore.getAll ? this.eventStore.getAll().slice(-20).reverse() : [];

    if (events.length === 0) {
      return `
        <div class="empty-log">
          <i class="ph ph-scroll"></i>
          <p>No events in the log yet.</p>
          <p class="hint">The append-only log is the single source of truth.</p>
        </div>
      `;
    }

    return `
      <div class="log-intro">
        <p><strong>The Append-Only Log</strong>: The database is the log. Everything else is a view.</p>
      </div>
      <div class="event-log-list">
        ${events.map(event => this._renderLogEvent(event)).join('')}
      </div>
    `;
  }

  /**
   * Render a log event
   */
  _renderLogEvent(event) {
    const isGiven = event.epistemicType === 'given';
    const typeClass = isGiven ? 'given' : 'meant';

    return `
      <div class="log-event ${typeClass}">
        <div class="log-event-header">
          <span class="event-type ${typeClass}">${event.epistemicType.toUpperCase()}</span>
          <span class="event-mode">${isGiven ? event.mode : event.frame?.purpose || 'interpretation'}</span>
          <span class="event-clock">LC: ${event.logicalClock}</span>
          <span class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="log-event-body">
          <code class="event-id">${event.id}</code>
          ${event.payload?.action ? `<span class="event-action">${event.payload.action}</span>` : ''}
        </div>
        ${!isGiven && event.provenance ? `
          <div class="log-event-provenance">
            <span class="provenance-label">Provenance:</span>
            ${event.provenance.map(p => `<code>${p.substring(0, 8)}</code>`).join(', ')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Re-render specific tabs
   */
  _renderPrinciplesTab() {
    const content = document.getElementById('principles-tab-content');
    if (content && this.activeTab === 'principles') {
      content.innerHTML = this._renderPrinciplesTabContent();
    }
  }

  _renderOperationsTab() {
    const content = document.getElementById('principles-tab-content');
    if (content && this.activeTab === 'operations') {
      content.innerHTML = this._renderOperationsTabContent();
    }
  }

  /**
   * Attach event listeners
   */
  _attachEventListeners() {
    // Toggle button
    const toggle = document.getElementById('principles-toggle');
    if (toggle) {
      toggle.addEventListener('click', this.toggle);
    }

    // Tab buttons
    const tabs = document.querySelectorAll('.principles-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.setTab(tab.dataset.tab);
      });
    });

    // Compliance check button
    const checkBtn = document.getElementById('run-compliance-check');
    if (checkBtn) {
      checkBtn.addEventListener('click', () => {
        this.runComplianceCheck();
      });
    }

    // Rule cards (expandable)
    const ruleCards = document.querySelectorAll('.rule-card');
    ruleCards.forEach(card => {
      card.addEventListener('click', () => {
        card.classList.toggle('expanded');
      });
    });
  }

  /**
   * Connect to app systems
   */
  connect(app) {
    if (app.eventStore) this.eventStore = app.eventStore;
    if (app.horizonLattice) this.horizonLattice = app.horizonLattice;
    if (app.complianceChecker) this.complianceChecker = app.complianceChecker;

    // Run initial check
    this.runComplianceCheck();

    return this;
  }
}

// Singleton instance
let _transparencyPanel = null;

function getTransparencyPanel() {
  if (!_transparencyPanel) {
    _transparencyPanel = new EOPrinciplesTransparency();
  }
  return _transparencyPanel;
}

function initTransparencyPanel(options = {}) {
  _transparencyPanel = new EOPrinciplesTransparency(options);
  return _transparencyPanel;
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NINE_RULES,
    OPERATION_RULE_MAP,
    EOPrinciplesTransparency,
    getTransparencyPanel,
    initTransparencyPanel
  };
}

if (typeof window !== 'undefined') {
  window.NINE_RULES = NINE_RULES;
  window.OPERATION_RULE_MAP = OPERATION_RULE_MAP;
  window.EOPrinciplesTransparency = EOPrinciplesTransparency;
  window.getTransparencyPanel = getTransparencyPanel;
  window.initTransparencyPanel = initTransparencyPanel;
}
