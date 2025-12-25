/**
 * EO Data Workbench - Interactive Data Management Interface
 *
 * Provides an interactive workbench for creating, editing, and analyzing
 * Experience Engine data with formula support and live calculations.
 *
 * COMPLIANCE NOTES:
 * - All edits create NEW events (Given for raw data, Meant for interpretations)
 * - Formula calculations are DERIVED - they don't modify the log
 * - The workbench respects horizon-mediated access (Rule 4)
 * - Undo is not "delete" - it's supersession (Rule 9)
 */

/**
 * Formula functions available in the workbench
 */
const FormulaFunctions = Object.freeze({
  // Math
  SUM: 'SUM',
  AVG: 'AVG',
  MIN: 'MIN',
  MAX: 'MAX',
  COUNT: 'COUNT',
  ABS: 'ABS',
  ROUND: 'ROUND',
  FLOOR: 'FLOOR',
  CEIL: 'CEIL',

  // String
  CONCAT: 'CONCAT',
  UPPER: 'UPPER',
  LOWER: 'LOWER',
  TRIM: 'TRIM',
  LEN: 'LEN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  MID: 'MID',

  // Date
  NOW: 'NOW',
  TODAY: 'TODAY',
  YEAR: 'YEAR',
  MONTH: 'MONTH',
  DAY: 'DAY',
  DATEDIFF: 'DATEDIFF',

  // Logical
  IF: 'IF',
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',

  // Reference
  LOOKUP: 'LOOKUP',
  COUNT_LINKED: 'COUNT_LINKED'
});

/**
 * Formula Parser and Evaluator
 */
class FormulaEngine {
  constructor(app) {
    this.app = app;
    this._cache = new Map();
  }

  /**
   * Parse and evaluate a formula
   */
  evaluate(formula, context = {}) {
    try {
      // Check cache
      const cacheKey = formula + JSON.stringify(context);
      if (this._cache.has(cacheKey)) {
        return this._cache.get(cacheKey);
      }

      // Parse the formula
      const ast = this._parse(formula);

      // Evaluate
      const result = this._evaluateNode(ast, context);

      // Cache result
      this._cache.set(cacheKey, result);

      return result;
    } catch (e) {
      return { error: e.message };
    }
  }

  /**
   * Parse formula into AST
   */
  _parse(formula) {
    const tokens = this._tokenize(formula);
    return this._parseExpression(tokens, 0).node;
  }

  /**
   * Tokenize formula string
   */
  _tokenize(formula) {
    const tokens = [];
    let i = 0;

    while (i < formula.length) {
      const char = formula[i];

      // Skip whitespace
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // Number
      if (/\d/.test(char)) {
        let num = '';
        while (i < formula.length && /[\d.]/.test(formula[i])) {
          num += formula[i];
          i++;
        }
        tokens.push({ type: 'number', value: parseFloat(num) });
        continue;
      }

      // String literal
      if (char === '"' || char === "'") {
        const quote = char;
        let str = '';
        i++;
        while (i < formula.length && formula[i] !== quote) {
          str += formula[i];
          i++;
        }
        i++; // Skip closing quote
        tokens.push({ type: 'string', value: str });
        continue;
      }

      // Field reference
      if (char === '{') {
        let field = '';
        i++;
        while (i < formula.length && formula[i] !== '}') {
          field += formula[i];
          i++;
        }
        i++; // Skip closing brace
        tokens.push({ type: 'field', value: field });
        continue;
      }

      // Function or identifier
      if (/[a-zA-Z_]/.test(char)) {
        let ident = '';
        while (i < formula.length && /[a-zA-Z0-9_]/.test(formula[i])) {
          ident += formula[i];
          i++;
        }
        tokens.push({ type: 'identifier', value: ident.toUpperCase() });
        continue;
      }

      // Operators and punctuation
      if ('+-*/(),%<>=!&|'.includes(char)) {
        // Check for two-character operators
        const twoChar = formula.substring(i, i + 2);
        if (['<=', '>=', '!=', '==', '&&', '||'].includes(twoChar)) {
          tokens.push({ type: 'operator', value: twoChar });
          i += 2;
        } else {
          tokens.push({ type: 'operator', value: char });
          i++;
        }
        continue;
      }

      throw new Error(`Unexpected character: ${char}`);
    }

    return tokens;
  }

  /**
   * Parse expression (precedence climbing)
   */
  _parseExpression(tokens, pos) {
    let { node, pos: newPos } = this._parsePrimary(tokens, pos);

    while (newPos < tokens.length) {
      const token = tokens[newPos];

      if (token.type === 'operator' && ['+', '-', '*', '/', '<', '>', '<=', '>=', '==', '!=', '&&', '||'].includes(token.value)) {
        const operator = token.value;
        newPos++;
        const { node: right, pos: rightPos } = this._parsePrimary(tokens, newPos);
        node = { type: 'binary', operator, left: node, right };
        newPos = rightPos;
      } else {
        break;
      }
    }

    return { node, pos: newPos };
  }

  /**
   * Parse primary expression
   */
  _parsePrimary(tokens, pos) {
    if (pos >= tokens.length) {
      throw new Error('Unexpected end of expression');
    }

    const token = tokens[pos];

    // Number
    if (token.type === 'number') {
      return { node: { type: 'literal', value: token.value }, pos: pos + 1 };
    }

    // String
    if (token.type === 'string') {
      return { node: { type: 'literal', value: token.value }, pos: pos + 1 };
    }

    // Field reference
    if (token.type === 'field') {
      return { node: { type: 'field', name: token.value }, pos: pos + 1 };
    }

    // Function call
    if (token.type === 'identifier') {
      const funcName = token.value;
      pos++;

      if (pos < tokens.length && tokens[pos].value === '(') {
        pos++; // Skip opening paren
        const args = [];

        while (pos < tokens.length && tokens[pos].value !== ')') {
          const { node: arg, pos: argPos } = this._parseExpression(tokens, pos);
          args.push(arg);
          pos = argPos;

          if (pos < tokens.length && tokens[pos].value === ',') {
            pos++;
          }
        }

        pos++; // Skip closing paren
        return { node: { type: 'call', name: funcName, args }, pos };
      }

      // Identifier without parentheses (constant or boolean)
      if (funcName === 'TRUE') return { node: { type: 'literal', value: true }, pos };
      if (funcName === 'FALSE') return { node: { type: 'literal', value: false }, pos };

      throw new Error(`Unknown identifier: ${funcName}`);
    }

    // Grouped expression
    if (token.value === '(') {
      pos++;
      const { node, pos: exprPos } = this._parseExpression(tokens, pos);
      if (tokens[exprPos]?.value !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      return { node, pos: exprPos + 1 };
    }

    // Unary operators
    if (token.value === '-' || token.value === '!') {
      const { node, pos: exprPos } = this._parsePrimary(tokens, pos + 1);
      return { node: { type: 'unary', operator: token.value, operand: node }, pos: exprPos };
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
  }

  /**
   * Evaluate AST node
   */
  _evaluateNode(node, context) {
    switch (node.type) {
      case 'literal':
        return node.value;

      case 'field':
        return this._getFieldValue(node.name, context);

      case 'unary':
        const operand = this._evaluateNode(node.operand, context);
        if (node.operator === '-') return -operand;
        if (node.operator === '!') return !operand;
        break;

      case 'binary':
        const left = this._evaluateNode(node.left, context);
        const right = this._evaluateNode(node.right, context);
        return this._evaluateBinary(node.operator, left, right);

      case 'call':
        const args = node.args.map(arg => this._evaluateNode(arg, context));
        return this._evaluateFunction(node.name, args, context);
    }

    return null;
  }

  /**
   * Evaluate binary operator
   */
  _evaluateBinary(operator, left, right) {
    switch (operator) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return right !== 0 ? left / right : '#DIV/0';
      case '<': return left < right;
      case '>': return left > right;
      case '<=': return left <= right;
      case '>=': return left >= right;
      case '==': return left === right;
      case '!=': return left !== right;
      case '&&': return left && right;
      case '||': return left || right;
    }
    return null;
  }

  /**
   * Evaluate function call
   */
  _evaluateFunction(name, args, context) {
    switch (name) {
      // Math functions
      case 'SUM':
        return args.flat().reduce((a, b) => a + (Number(b) || 0), 0);
      case 'AVG':
        const flatArgs = args.flat();
        return flatArgs.reduce((a, b) => a + (Number(b) || 0), 0) / flatArgs.length;
      case 'MIN':
        return Math.min(...args.flat().map(Number));
      case 'MAX':
        return Math.max(...args.flat().map(Number));
      case 'COUNT':
        return args.flat().length;
      case 'ABS':
        return Math.abs(args[0]);
      case 'ROUND':
        return Math.round(args[0] * Math.pow(10, args[1] || 0)) / Math.pow(10, args[1] || 0);
      case 'FLOOR':
        return Math.floor(args[0]);
      case 'CEIL':
        return Math.ceil(args[0]);

      // String functions
      case 'CONCAT':
        return args.join('');
      case 'UPPER':
        return String(args[0]).toUpperCase();
      case 'LOWER':
        return String(args[0]).toLowerCase();
      case 'TRIM':
        return String(args[0]).trim();
      case 'LEN':
        return String(args[0]).length;
      case 'LEFT':
        return String(args[0]).substring(0, args[1] || 1);
      case 'RIGHT':
        return String(args[0]).slice(-(args[1] || 1));
      case 'MID':
        return String(args[0]).substring(args[1] || 0, (args[1] || 0) + (args[2] || 1));

      // Date functions
      case 'NOW':
        return new Date().toISOString();
      case 'TODAY':
        return new Date().toISOString().split('T')[0];
      case 'YEAR':
        return new Date(args[0]).getFullYear();
      case 'MONTH':
        return new Date(args[0]).getMonth() + 1;
      case 'DAY':
        return new Date(args[0]).getDate();
      case 'DATEDIFF':
        const d1 = new Date(args[0]);
        const d2 = new Date(args[1]);
        return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));

      // Logical functions
      case 'IF':
        return args[0] ? args[1] : args[2];
      case 'AND':
        return args.every(Boolean);
      case 'OR':
        return args.some(Boolean);
      case 'NOT':
        return !args[0];

      // Reference functions
      case 'LOOKUP':
        return this._lookup(args[0], args[1], context);
      case 'COUNT_LINKED':
        return this._countLinked(args[0], context);

      default:
        return `#UNKNOWN_FUNC(${name})`;
    }
  }

  /**
   * Get field value from context
   */
  _getFieldValue(fieldPath, context) {
    const parts = fieldPath.split('.');
    let value = context.row || context;

    for (const part of parts) {
      if (value == null) return null;
      value = value[part];
    }

    return value;
  }

  /**
   * Lookup a value from linked entities
   */
  _lookup(entityId, field, context) {
    const entities = this.app.getEntities();
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return null;

    return this._getFieldValue(field, { row: entity });
  }

  /**
   * Count linked references
   */
  _countLinked(field, context) {
    const value = this._getFieldValue(field, context);
    if (Array.isArray(value)) return value.length;
    return value ? 1 : 0;
  }

  /**
   * Clear formula cache
   */
  clearCache() {
    this._cache.clear();
  }
}

/**
 * Data Workbench - Main component
 */
class EODataWorkbench {
  constructor(container, app) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    this.app = app;

    this.formulaEngine = new FormulaEngine(app);
    this.viewManager = null;
    this.graph = null;
    this.eventBus = null;

    this.selectedRows = new Set();
    this.editingCell = null;
    this.currentView = 'table';

    // Column definitions for the main workbench
    this.columns = [
      { id: 'type', field: 'type', label: 'Type', width: 80, editable: false },
      { id: 'actor', field: 'actor', label: 'Actor', width: 120, editable: false },
      { id: 'timestamp', field: 'timestamp', label: 'Timestamp', width: 160, editable: false },
      { id: 'action', field: 'payload.action', label: 'Action', width: 120, editable: false },
      { id: 'content', field: 'payload.content', label: 'Content', width: 300, editable: false }
    ];

    // Quick filters
    this.quickFilters = {
      showGiven: true,
      showMeant: true,
      search: ''
    };
  }

  /**
   * Initialize the workbench
   */
  init() {
    if (!this.container) {
      console.error('EODataWorkbench: Container not found');
      return;
    }

    // Initialize view manager
    this.viewManager = initViewManager(this.app);

    // Initialize event bus
    this.eventBus = getEventBus();

    // Build UI
    this._render();

    // Subscribe to updates
    this.app.on('event', () => this._onDataChange());
    this.app.on('compliance', (report) => this._onComplianceUpdate(report));

    console.log('EODataWorkbench: Initialized');

    return this;
  }

  /**
   * Render the workbench
   */
  _render() {
    this.container.innerHTML = `
      <div class="workbench">
        <div class="workbench-toolbar">
          <div class="toolbar-left">
            <div class="view-switcher">
              <button class="view-btn active" data-view="table" title="Table View">
                <span class="view-icon">☰</span>
              </button>
              <button class="view-btn" data-view="cards" title="Card View">
                <span class="view-icon">▦</span>
              </button>
              <button class="view-btn" data-view="timeline" title="Timeline View">
                <span class="view-icon">⟿</span>
              </button>
              <button class="view-btn" data-view="graph" title="Graph View">
                <span class="view-icon">⬡</span>
              </button>
            </div>

            <div class="toolbar-divider"></div>

            <div class="quick-filters">
              <label class="filter-checkbox">
                <input type="checkbox" id="filter-given" checked>
                <span class="filter-label given">Given</span>
              </label>
              <label class="filter-checkbox">
                <input type="checkbox" id="filter-meant" checked>
                <span class="filter-label meant">Meant</span>
              </label>
            </div>
          </div>

          <div class="toolbar-center">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="workbench-search" placeholder="Search events...">
            </div>
          </div>

          <div class="toolbar-right">
            <button class="toolbar-btn" id="btn-add-given" title="Add Given">
              <span style="color: var(--given-color);">+</span> Given
            </button>
            <button class="toolbar-btn" id="btn-add-meant" title="Add Interpretation">
              <span style="color: var(--meant-color);">+</span> Meant
            </button>
            <div class="toolbar-divider"></div>
            <button class="toolbar-btn" id="btn-refresh" title="Refresh">↻</button>
            <button class="toolbar-btn" id="btn-export" title="Export">↓</button>
          </div>
        </div>

        <div class="workbench-content">
          <div class="workbench-main" id="workbench-main">
            <!-- View content rendered here -->
          </div>

          <div class="workbench-sidebar" id="workbench-sidebar">
            <div class="sidebar-section">
              <div class="sidebar-section-header">
                <span>Details</span>
              </div>
              <div class="sidebar-section-body" id="detail-panel">
                <div class="empty-state-small">Select an item to view details</div>
              </div>
            </div>

            <div class="sidebar-section">
              <div class="sidebar-section-header">
                <span>Provenance</span>
              </div>
              <div class="sidebar-section-body" id="provenance-panel">
                <div class="empty-state-small">No provenance data</div>
              </div>
            </div>

            <div class="sidebar-section">
              <div class="sidebar-section-header">
                <span>Formula Tester</span>
              </div>
              <div class="sidebar-section-body">
                <input type="text" class="form-input" id="formula-input" placeholder="e.g., SUM({data.value}, 10)">
                <div class="formula-result" id="formula-result"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="workbench-statusbar">
          <div class="status-left">
            <span id="status-count">0 items</span>
            <span class="status-divider">|</span>
            <span id="status-selected">0 selected</span>
          </div>
          <div class="status-right">
            <span id="status-compliance" class="compliance-status pass">9/9 Rules</span>
          </div>
        </div>
      </div>
    `;

    this._attachEventListeners();
    this._renderView();
  }

  /**
   * Attach event listeners
   */
  _attachEventListeners() {
    // View switcher
    this.container.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentView = btn.dataset.view;
        this._renderView();
      });
    });

    // Quick filters
    document.getElementById('filter-given')?.addEventListener('change', (e) => {
      this.quickFilters.showGiven = e.target.checked;
      this._renderView();
    });

    document.getElementById('filter-meant')?.addEventListener('change', (e) => {
      this.quickFilters.showMeant = e.target.checked;
      this._renderView();
    });

    // Search
    document.getElementById('workbench-search')?.addEventListener('input', (e) => {
      this.quickFilters.search = e.target.value;
      this._renderView();
    });

    // Add buttons
    document.getElementById('btn-add-given')?.addEventListener('click', () => {
      this._showAddGivenModal();
    });

    document.getElementById('btn-add-meant')?.addEventListener('click', () => {
      this._showAddMeantModal();
    });

    // Refresh
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      this.formulaEngine.clearCache();
      this._renderView();
    });

    // Export
    document.getElementById('btn-export')?.addEventListener('click', () => {
      this._exportData();
    });

    // Formula tester
    document.getElementById('formula-input')?.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        this._evaluateFormula();
      }
    });
  }

  /**
   * Render the current view
   */
  _renderView() {
    const mainContent = document.getElementById('workbench-main');
    if (!mainContent) return;

    // Get filtered data
    const data = this._getFilteredData();

    switch (this.currentView) {
      case 'table':
        this._renderTableView(mainContent, data);
        break;
      case 'cards':
        this._renderCardView(mainContent, data);
        break;
      case 'timeline':
        this._renderTimelineView(mainContent, data);
        break;
      case 'graph':
        this._renderGraphView(mainContent, data);
        break;
    }

    // Update status
    this._updateStatus(data.length);
  }

  /**
   * Get filtered data
   */
  _getFilteredData() {
    let data = this.app.getEventLog();

    // Type filter
    if (!this.quickFilters.showGiven) {
      data = data.filter(e => e.type !== 'given');
    }
    if (!this.quickFilters.showMeant) {
      data = data.filter(e => e.type !== 'meant');
    }

    // Search filter
    if (this.quickFilters.search) {
      const search = this.quickFilters.search.toLowerCase();
      data = data.filter(e => {
        const content = JSON.stringify(e).toLowerCase();
        return content.includes(search);
      });
    }

    return data;
  }

  /**
   * Render table view
   */
  _renderTableView(container, data) {
    let html = `
      <div class="workbench-table-wrapper">
        <table class="workbench-table">
          <thead>
            <tr>
              <th class="col-checkbox"><input type="checkbox" id="select-all"></th>
              ${this.columns.map(col => `
                <th style="width: ${col.width}px" class="sortable" data-field="${col.field}">
                  ${col.label}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    if (data.length === 0) {
      html += `
        <tr>
          <td colspan="${this.columns.length + 1}" class="empty-cell">
            No events match the current filters
          </td>
        </tr>
      `;
    } else {
      for (const item of data.slice().reverse().slice(0, 100)) {
        const isGiven = item.type === 'given';
        html += `
          <tr data-id="${item.id}" class="${isGiven ? 'row-given' : 'row-meant'}">
            <td class="col-checkbox">
              <input type="checkbox" class="row-select" data-id="${item.id}">
            </td>
        `;

        for (const col of this.columns) {
          const value = this._getNestedValue(item, col.field);
          const formatted = this._formatValue(value, col);
          html += `<td class="cell-${col.id}">${formatted}</td>`;
        }

        html += '</tr>';
      }
    }

    html += '</tbody></table></div>';
    container.innerHTML = html;

    // Attach row events
    this._attachTableEvents(container);
  }

  /**
   * Attach table event listeners
   */
  _attachTableEvents(container) {
    // Select all
    container.querySelector('#select-all')?.addEventListener('change', (e) => {
      const checkboxes = container.querySelectorAll('.row-select');
      checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) {
          this.selectedRows.add(cb.dataset.id);
        } else {
          this.selectedRows.delete(cb.dataset.id);
        }
      });
      this._updateStatus();
    });

    // Row selection
    container.querySelectorAll('.row-select').forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedRows.add(e.target.dataset.id);
        } else {
          this.selectedRows.delete(e.target.dataset.id);
        }
        this._updateStatus();
      });
    });

    // Row click for details
    container.querySelectorAll('tbody tr').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox') return;
        this._showDetails(row.dataset.id);
      });
    });
  }

  /**
   * Render card view
   */
  _renderCardView(container, data) {
    if (data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-title">No items</div>
        </div>
      `;
      return;
    }

    let html = '<div class="workbench-cards">';

    for (const item of data.slice().reverse().slice(0, 50)) {
      const isGiven = item.type === 'given';
      const content = item.payload?.content || item.payload?.action || '';

      html += `
        <div class="workbench-card ${isGiven ? 'card-given' : 'card-meant'}" data-id="${item.id}">
          <div class="card-header">
            <span class="card-type ${item.type}">${item.type.toUpperCase()}</span>
            <span class="card-time">${new Date(item.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="card-body">
            <div class="card-content">${this._escapeHtml(String(content).substring(0, 150))}</div>
          </div>
          <div class="card-footer">
            <span class="card-actor">${item.actor}</span>
            ${item.provenance ? `<span class="card-provenance">${item.provenance.length} sources</span>` : ''}
          </div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;

    // Card click events
    container.querySelectorAll('.workbench-card').forEach(card => {
      card.addEventListener('click', () => {
        this._showDetails(card.dataset.id);
      });
    });
  }

  /**
   * Render timeline view
   */
  _renderTimelineView(container, data) {
    if (data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-title">No events</div>
        </div>
      `;
      return;
    }

    let html = '<div class="workbench-timeline">';

    for (const item of data.slice().reverse().slice(0, 50)) {
      const isGiven = item.type === 'given';
      const date = new Date(item.timestamp);
      const label = item.payload?.action || item.type;

      html += `
        <div class="timeline-row ${isGiven ? 'given' : 'meant'}" data-id="${item.id}">
          <div class="timeline-date">
            <div class="timeline-date-day">${date.toLocaleDateString()}</div>
            <div class="timeline-date-time">${date.toLocaleTimeString()}</div>
          </div>
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-title">${this._escapeHtml(label)}</div>
            <div class="timeline-desc">${this._escapeHtml(String(item.payload?.content || '').substring(0, 100))}</div>
            <div class="timeline-meta">${item.actor}</div>
          </div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Render graph view
   */
  _renderGraphView(container, data) {
    container.innerHTML = '<div id="graph-container" style="width: 100%; height: 100%;"></div>';

    // Initialize graph if not already
    if (!this.graph) {
      this.graph = initGraph('graph-container', this.app);
    } else {
      // Refresh graph
      this.graph.container = document.getElementById('graph-container');
      this.graph.refresh();
    }
  }

  /**
   * Show details for an item
   */
  _showDetails(id) {
    const event = this.app.eventStore.get(id);
    if (!event) return;

    const detailPanel = document.getElementById('detail-panel');
    const provenancePanel = document.getElementById('provenance-panel');

    // Detail panel
    detailPanel.innerHTML = `
      <div class="detail-item">
        <div class="detail-label">ID</div>
        <div class="detail-value mono">${event.id}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Type</div>
        <div class="detail-value">
          <span class="type-badge ${event.type}">${event.type.toUpperCase()}</span>
        </div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Actor</div>
        <div class="detail-value">${event.actor}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Timestamp</div>
        <div class="detail-value">${new Date(event.timestamp).toLocaleString()}</div>
      </div>
      ${event.mode ? `
        <div class="detail-item">
          <div class="detail-label">Mode</div>
          <div class="detail-value">${event.mode}</div>
        </div>
      ` : ''}
      ${event.frame ? `
        <div class="detail-item">
          <div class="detail-label">Frame</div>
          <div class="detail-value">${event.frame.purpose}</div>
        </div>
      ` : ''}
      <div class="detail-item">
        <div class="detail-label">Payload</div>
        <div class="detail-value">
          <pre class="payload-preview">${JSON.stringify(event.payload, null, 2)}</pre>
        </div>
      </div>
    `;

    // Provenance panel
    if (event.provenance && event.provenance.length > 0) {
      let provHtml = '<div class="provenance-chain">';
      for (const provId of event.provenance) {
        const provEvent = this.app.eventStore.get(provId);
        if (provEvent) {
          provHtml += `
            <div class="provenance-item" data-id="${provId}">
              <span class="provenance-type ${provEvent.type}">${provEvent.type}</span>
              <span class="provenance-label">${provEvent.payload?.action || 'event'}</span>
            </div>
          `;
        }
      }
      provHtml += '</div>';
      provenancePanel.innerHTML = provHtml;
    } else {
      provenancePanel.innerHTML = `<div class="empty-state-small">
        ${event.type === 'given' ? 'Given events are raw experience' : 'No provenance chain'}
      </div>`;
    }
  }

  /**
   * Evaluate formula from input
   */
  _evaluateFormula() {
    const input = document.getElementById('formula-input');
    const result = document.getElementById('formula-result');
    if (!input || !result) return;

    const formula = input.value;
    if (!formula) {
      result.textContent = '';
      return;
    }

    const evalResult = this.formulaEngine.evaluate(formula, {});

    if (evalResult?.error) {
      result.innerHTML = `<span class="error">${evalResult.error}</span>`;
    } else {
      result.innerHTML = `<span class="success">${JSON.stringify(evalResult)}</span>`;
    }
  }

  /**
   * Update status bar
   */
  _updateStatus(itemCount = null) {
    const countEl = document.getElementById('status-count');
    const selectedEl = document.getElementById('status-selected');

    if (countEl && itemCount !== null) {
      countEl.textContent = `${itemCount} items`;
    }

    if (selectedEl) {
      selectedEl.textContent = `${this.selectedRows.size} selected`;
    }
  }

  /**
   * Handle data change
   */
  _onDataChange() {
    this.formulaEngine.clearCache();
    this._renderView();
  }

  /**
   * Handle compliance update
   */
  _onComplianceUpdate(report) {
    const el = document.getElementById('status-compliance');
    if (!el) return;

    const passed = report.audit.summary.passed;
    const total = report.audit.summary.total;
    const isPassing = passed === total;

    el.className = `compliance-status ${isPassing ? 'pass' : 'fail'}`;
    el.textContent = `${passed}/${total} Rules`;
  }

  /**
   * Show add Given modal
   */
  _showAddGivenModal() {
    // Use workbench's modal method if available, otherwise use app's
    if (typeof workbench !== 'undefined' && workbench._showNewGivenModal) {
      workbench._showNewGivenModal();
    }
  }

  /**
   * Show add Meant modal
   */
  _showAddMeantModal() {
    if (typeof workbench !== 'undefined' && workbench._showNewMeantModal) {
      workbench._showNewMeantModal();
    }
  }

  /**
   * Export data
   */
  async _exportData() {
    const data = await this.app.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `experience-engine-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Get nested value from object
   */
  _getNestedValue(obj, path) {
    const parts = path.split('.');
    let value = obj;
    for (const part of parts) {
      if (value == null) return null;
      value = value[part];
    }
    return value;
  }

  /**
   * Format value for display
   */
  _formatValue(value, column) {
    if (value == null) return '<span class="null-value">—</span>';

    // Type-specific formatting
    if (column.id === 'type') {
      return `<span class="type-badge ${value}">${value.toUpperCase()}</span>`;
    }

    if (column.id === 'timestamp') {
      return new Date(value).toLocaleString();
    }

    return this._escapeHtml(String(value).substring(0, 100));
  }

  /**
   * Escape HTML
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Refresh the workbench
   */
  refresh() {
    this.formulaEngine.clearCache();
    this._renderView();
  }
}

// Singleton
let _dataWorkbench = null;

function getDataWorkbench() {
  return _dataWorkbench;
}

function initDataWorkbench(container, app) {
  _dataWorkbench = new EODataWorkbench(container, app);
  _dataWorkbench.init();
  return _dataWorkbench;
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FormulaFunctions,
    FormulaEngine,
    EODataWorkbench,
    getDataWorkbench,
    initDataWorkbench
  };
}

if (typeof window !== 'undefined') {
  window.FormulaFunctions = FormulaFunctions;
  window.FormulaEngine = FormulaEngine;
  window.EODataWorkbench = EODataWorkbench;
  window.getDataWorkbench = getDataWorkbench;
  window.initDataWorkbench = initDataWorkbench;
}
