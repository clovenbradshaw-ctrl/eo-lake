/**
 * Lakṣaṇa Formula Language Explainer
 * Interactive documentation for the formula language
 */

class EOFormulaExplainer {
  constructor() {
    this.activeSection = 'overview';
    this.activeTab = 'aggregation';
    this.modal = null;

    this.sections = [
      { id: 'overview', label: 'Overview', icon: '◉' },
      { id: 'syntax', label: 'Syntax', icon: '⌘' },
      { id: 'operators', label: 'EO Operators', icon: '◇' },
      { id: 'functions', label: 'Functions', icon: 'ƒ' },
      { id: 'semantic', label: 'Semantic', icon: '❋' },
      { id: 'examples', label: 'Examples', icon: '≡' },
    ];
  }

  /**
   * Show the explainer in a modal
   */
  show() {
    if (typeof EOModal !== 'undefined') {
      this.modal = new EOModal({
        id: 'formula-explainer-modal',
        title: 'Lakṣaṇa Formula Language',
        size: 'large',
        content: this._renderContent(),
        buttons: [
          { label: 'Close', action: 'cancel' }
        ]
      });
      this.modal.show();
      this._attachEventHandlers();
    } else {
      // Fallback to native modal
      this._showNativeModal();
    }
  }

  /**
   * Render as inline content (for embedding in a tab)
   */
  renderInline() {
    return this._renderContent();
  }

  _showNativeModal() {
    const modal = document.getElementById('modal-overlay');
    const modalTitle = modal?.querySelector('.modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');

    if (!modal || !modalBody) return;

    modalTitle.textContent = 'Lakṣaṇa Formula Language';
    modalBody.innerHTML = this._renderContent();
    modalFooter.innerHTML = '<button class="btn btn-secondary" onclick="closeModal()">Close</button>';
    modal.classList.add('active');

    this._attachEventHandlers();
  }

  _renderContent() {
    return `
      <div class="formula-explainer">
        <div class="formula-explainer-layout">
          <!-- Sidebar Nav -->
          <nav class="formula-explainer-nav">
            ${this.sections.map(({ id, label, icon }) => `
              <button
                class="formula-explainer-nav-item ${this.activeSection === id ? 'active' : ''}"
                data-section="${id}"
              >
                <span class="formula-explainer-nav-icon">${icon}</span>
                ${label}
              </button>
            `).join('')}
          </nav>

          <!-- Main Content -->
          <main class="formula-explainer-content">
            <div class="formula-explainer-section ${this.activeSection === 'overview' ? 'active' : ''}" data-section-content="overview">
              ${this._renderOverview()}
            </div>
            <div class="formula-explainer-section ${this.activeSection === 'syntax' ? 'active' : ''}" data-section-content="syntax">
              ${this._renderSyntax()}
            </div>
            <div class="formula-explainer-section ${this.activeSection === 'operators' ? 'active' : ''}" data-section-content="operators">
              ${this._renderOperators()}
            </div>
            <div class="formula-explainer-section ${this.activeSection === 'functions' ? 'active' : ''}" data-section-content="functions">
              ${this._renderFunctions()}
            </div>
            <div class="formula-explainer-section ${this.activeSection === 'semantic' ? 'active' : ''}" data-section-content="semantic">
              ${this._renderSemantic()}
            </div>
            <div class="formula-explainer-section ${this.activeSection === 'examples' ? 'active' : ''}" data-section-content="examples">
              ${this._renderExamples()}
            </div>
          </main>
        </div>

        <!-- Footer -->
        <footer class="formula-explainer-footer">
          <p>Lakṣaṇa Formula Language v1.0</p>
          <p>Standard functions powered by <strong>formulajs</strong> (MIT) • Custom parser, EO decomposition, and semantic functions built for Lakṣaṇa</p>
        </footer>
      </div>
    `;
  }

  _attachEventHandlers() {
    // Wait for DOM to be ready
    setTimeout(() => {
      const container = document.querySelector('.formula-explainer');
      if (!container) return;

      // Section navigation
      container.querySelectorAll('.formula-explainer-nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const section = e.currentTarget.dataset.section;
          this.activeSection = section;

          // Update nav active state
          container.querySelectorAll('.formula-explainer-nav-item').forEach(n =>
            n.classList.toggle('active', n.dataset.section === section)
          );

          // Update section visibility
          container.querySelectorAll('.formula-explainer-section').forEach(s =>
            s.classList.toggle('active', s.dataset.sectionContent === section)
          );
        });
      });

      // Function category tabs
      container.querySelectorAll('.formula-explainer-fn-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const tab = e.currentTarget.dataset.fnTab;
          this.activeTab = tab;

          // Update tab active state
          container.querySelectorAll('.formula-explainer-fn-tab').forEach(t =>
            t.classList.toggle('active', t.dataset.fnTab === tab)
          );

          // Update content visibility
          container.querySelectorAll('.formula-explainer-fn-content').forEach(c =>
            c.classList.toggle('active', c.dataset.fnTabContent === tab)
          );
        });
      });
    }, 50);
  }

  _operatorBadge(op) {
    const colors = {
      CON: 'badge-blue',
      SEG: 'badge-amber',
      DES: 'badge-emerald',
      SYN: 'badge-purple',
      ALT: 'badge-rose',
      NUL: 'badge-slate',
      INS: 'badge-cyan',
      SUP: 'badge-pink',
      REC: 'badge-orange',
    };
    return `<span class="formula-explainer-badge ${colors[op] || 'badge-slate'}">${op}</span>`;
  }

  _codeBlock(code, title = '') {
    return `
      <div class="formula-explainer-code-block">
        ${title ? `<div class="formula-explainer-code-title">${title}</div>` : ''}
        <pre><code>${this._escapeHtml(code)}</code></pre>
      </div>
    `;
  }

  _callout(content, title = '', type = 'info') {
    return `
      <div class="formula-explainer-callout formula-explainer-callout-${type}">
        ${title ? `<div class="formula-explainer-callout-title">${title}</div>` : ''}
        <div class="formula-explainer-callout-content">${content}</div>
      </div>
    `;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  _renderOverview() {
    return `
      <h2>What Makes Lakṣaṇa Formulas Different</h2>

      <p class="formula-explainer-intro">
        Lakṣaṇa formulas aren't just calculations—they're <strong>meaning-aware pipelines</strong> that
        decompose into primitive operators, traverse relationships, and manage the conditions under
        which values are meaningful.
      </p>

      <div class="formula-explainer-grid">
        <div class="formula-explainer-card card-blue">
          <div class="formula-explainer-card-icon">📐</div>
          <h3>Data-First Syntax</h3>
          <p>Target comes first, then modifiers, then filters. Familiar to Airtable/Excel users.</p>
        </div>
        <div class="formula-explainer-card card-purple">
          <div class="formula-explainer-card-icon">◇</div>
          <h3>EO Decomposition</h3>
          <p>Every function breaks down into 9 primitive operators. Fully inspectable.</p>
        </div>
        <div class="formula-explainer-card card-emerald">
          <div class="formula-explainer-card-icon">❋</div>
          <h3>Semantic Functions</h3>
          <p>AV-inspired operations that manage meaning, scope, and assumptions—not just values.</p>
        </div>
      </div>

      <h3>The Three-Layer Architecture</h3>

      <div class="formula-explainer-layers">
        <div class="formula-explainer-layer layer-emerald">
          <div class="formula-explainer-layer-title">Layer 3: Semantic Functions (Custom)</div>
          <div class="formula-explainer-layer-desc">EXCEPT, VALID_WHEN, DIAGNOSTIC, REFINE_UNTIL</div>
          <div class="formula-explainer-layer-note">AV-inspired • Meaning-aware • Unique to Lakṣaṇa</div>
        </div>
        <div class="formula-explainer-layer layer-purple">
          <div class="formula-explainer-layer-title">Layer 2: EO Operator Layer (Custom)</div>
          <div class="formula-explainer-layer-desc">Parser, Pipeline Decomposition, Graph Traversal</div>
          <div class="formula-explainer-layer-note">Your syntax • CON/SEG/SYN operators • Dependency tracking</div>
        </div>
        <div class="formula-explainer-layer layer-blue">
          <div class="formula-explainer-layer-title">Layer 1: formulajs (Borrowed)</div>
          <div class="formula-explainer-layer-desc">SUM, AVERAGE, UPPER, LEFT, DATE, IF, ROUND...</div>
          <div class="formula-explainer-layer-note">~200 functions • MIT license • Battle-tested</div>
        </div>
      </div>

      ${this._callout(
        `Most formula systems compute values. Lakṣaṇa formulas compute <em>claims</em>—values
        with lineage, scope, assumptions, and confidence. Every transformation is visible,
        every aggregation shows what was collapsed.`,
        'Why This Matters',
        'info'
      )}
    `;
  }

  _renderSyntax() {
    return `
      <h2>Formula Syntax</h2>

      <h3>The Core Pattern</h3>

      <div class="formula-explainer-syntax-box">
        <div class="formula-explainer-syntax-comment">// Data-first conditional syntax</div>
        <div class="formula-explainer-syntax-main">
          <span class="syntax-function">FUNCTION</span><span class="syntax-paren">(</span><span class="syntax-target">target</span><span class="syntax-comma">, </span><span class="syntax-modifier">modifier</span><span class="syntax-comma">, </span><span class="syntax-filter">[predicate]</span><span class="syntax-paren">)</span>
        </div>
        <div class="formula-explainer-syntax-legend">
          <span><span class="dot-target"></span> What to operate on</span>
          <span><span class="dot-modifier"></span> How to modify</span>
          <span><span class="dot-filter"></span> Optional filter</span>
        </div>
      </div>

      <h3>Reference Types</h3>

      <div class="formula-explainer-ref-list">
        <div class="formula-explainer-ref-item">
          <code class="ref-code ref-emerald">{Field}</code>
          <div class="ref-info">
            <div class="ref-name">Same-Set Field</div>
            <div class="ref-desc">Reference a field in the current record</div>
            <code class="ref-example">{Price}, {First Name}, {Status}</code>
          </div>
        </div>

        <div class="formula-explainer-ref-item">
          <code class="ref-code ref-blue">#Set.Field</code>
          <div class="ref-info">
            <div class="ref-name">Cross-Set Field</div>
            <div class="ref-desc">Reference through a connection to another set</div>
            <code class="ref-example">#Orders.Total, #Customer.Name</code>
          </div>
        </div>

        <div class="formula-explainer-ref-item">
          <code class="ref-code ref-purple">$</code>
          <div class="ref-info">
            <div class="ref-name">Current Item</div>
            <div class="ref-desc">Reference the current item in MAP/FILTER</div>
            <code class="ref-example">$.Total, $.Status, $.Price * $.Quantity</code>
          </div>
        </div>

        <div class="formula-explainer-ref-item">
          <code class="ref-code ref-amber">[condition]</code>
          <div class="ref-info">
            <div class="ref-name">Filter Predicate</div>
            <div class="ref-desc">Filter records by condition</div>
            <code class="ref-example">[Status = "Paid"], [Total > 1000 AND Active]</code>
          </div>
        </div>
      </div>

      <h3>Operators</h3>

      <div class="formula-explainer-ops-grid">
        <div class="formula-explainer-op">
          <code>&amp;</code>
          <div class="op-name">Concat</div>
          <div class="op-example">"a" &amp; "b"</div>
        </div>
        <div class="formula-explainer-op">
          <code>+ - * /</code>
          <div class="op-name">Math</div>
          <div class="op-example">{Price} * {Qty}</div>
        </div>
        <div class="formula-explainer-op">
          <code>= != > <</code>
          <div class="op-name">Compare</div>
          <div class="op-example">{Status} = "Active"</div>
        </div>
        <div class="formula-explainer-op">
          <code>AND OR NOT</code>
          <div class="op-name">Logic</div>
          <div class="op-example">{A} AND {B}</div>
        </div>
      </div>

      ${this._callout(
        `<ul>
          <li>Single <code>=</code> for equality (not <code>==</code>)</li>
          <li>Words for logic: <code>AND OR NOT</code> (not <code>&amp;&amp; ||</code>)</li>
          <li>Both quote styles: <code>"text"</code> and <code>'text'</code></li>
          <li>Array arithmetic is explicit—must use MAP or aggregate</li>
        </ul>`,
        'Key Decisions',
        'info'
      )}
    `;
  }

  _renderOperators() {
    const operators = [
      { op: 'CON', symbol: '⋈', name: 'Connection', desc: 'Establish relational reach—traverse to related records', color: 'blue' },
      { op: 'SEG', symbol: '|', name: 'Segment', desc: 'Filter, partition, extract—reduce by condition', color: 'amber' },
      { op: 'DES', symbol: '⊡', name: 'Designate', desc: 'Project property, assign meaning—pick what matters', color: 'emerald' },
      { op: 'SYN', symbol: '∨', name: 'Synthesize', desc: 'Aggregate, collapse many→one—combine with loss', color: 'purple' },
      { op: 'ALT', symbol: '∿', name: 'Alternate', desc: 'Transform value(s)—change without loss', color: 'rose' },
      { op: 'NUL', symbol: '∅', name: 'Null', desc: 'Handle absence—what happens when nothing is there', color: 'slate' },
      { op: 'INS', symbol: '△', name: 'Instantiate', desc: 'Create new value—bring something into existence', color: 'cyan' },
      { op: 'SUP', symbol: '⊕', name: 'Superposition', desc: 'Hold multiple contradictory values simultaneously', color: 'pink' },
      { op: 'REC', symbol: '⟳', name: 'Recursion', desc: 'Iterate until stable—convergent refinement', color: 'orange' },
    ];

    return `
      <h2>The Nine EO Operators</h2>

      <p class="formula-explainer-intro">
        Every formula decomposes into these primitive operators. This makes computation
        inspectable—you can see exactly what happened at each step.
      </p>

      <div class="formula-explainer-operators-list">
        ${operators.map(({ op, symbol, name, desc, color }) => `
          <div class="formula-explainer-operator-item">
            <div class="formula-explainer-operator-symbol operator-${color}">
              ${symbol}
            </div>
            <div class="formula-explainer-operator-info">
              <div class="formula-explainer-operator-header">
                ${this._operatorBadge(op)}
                <span class="formula-explainer-operator-name">${name}</span>
              </div>
              <div class="formula-explainer-operator-desc">${desc}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <h3>Example: How SUM Decomposes</h3>

      ${this._codeBlock('SUM(#Orders.Total, [Status = "Paid"])', 'Formula')}

      <div class="formula-explainer-pipeline">
        <div class="pipeline-step">
          ${this._operatorBadge('CON')}
          <span>Get Orders</span>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="pipeline-step">
          ${this._operatorBadge('SEG')}
          <span>Filter Paid</span>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="pipeline-step">
          ${this._operatorBadge('DES')}
          <span>Get Total</span>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="pipeline-step">
          ${this._operatorBadge('SYN')}
          <span>Sum</span>
        </div>
      </div>

      <div class="formula-explainer-decomposition">
        <div><span class="step-num">1.</span> ${this._operatorBadge('CON')} → Orders (47 records)</div>
        <div><span class="step-num">2.</span> ${this._operatorBadge('SEG')} → Status = "Paid" (12 records)</div>
        <div><span class="step-num">3.</span> ${this._operatorBadge('DES')} → Total (12 values)</div>
        <div><span class="step-num">4.</span> ${this._operatorBadge('SYN')} → SUM = <strong>$14,200</strong></div>
      </div>

      ${this._callout(
        `When SYN collapses 12 values into 1, Lakṣaṇa shows you what was lost. This is
        intentional—aggregation destroys information, and users should know.`,
        'SYN Makes Loss Visible',
        'warning'
      )}
    `;
  }

  _renderFunctions() {
    const categories = {
      aggregation: [
        { fn: 'SUM', sig: 'SUM(values, [filter])', desc: 'Add all numbers', ops: ['SYN'] },
        { fn: 'AVERAGE', sig: 'AVERAGE(values, [filter])', desc: 'Arithmetic mean', ops: ['SYN'] },
        { fn: 'COUNT', sig: 'COUNT(values, [filter])', desc: 'Count items', ops: ['SYN'] },
        { fn: 'MIN', sig: 'MIN(values, [filter])', desc: 'Smallest value', ops: ['SYN'] },
        { fn: 'MAX', sig: 'MAX(values, [filter])', desc: 'Largest value', ops: ['SYN'] },
        { fn: 'MEDIAN', sig: 'MEDIAN(values)', desc: 'Middle value', ops: ['SYN'] },
        { fn: 'FIRST', sig: 'FIRST(values)', desc: 'First item', ops: ['SYN'] },
        { fn: 'LAST', sig: 'LAST(values)', desc: 'Last item', ops: ['SYN'] },
      ],
      array: [
        { fn: 'MAP', sig: 'MAP(values, $.expr)', desc: 'Transform each item', ops: ['ALT'] },
        { fn: 'FILTER', sig: 'FILTER(values, $.cond)', desc: 'Keep matching items', ops: ['SEG'] },
        { fn: 'SORT', sig: 'SORT(values, $.prop, dir)', desc: 'Reorder items', ops: ['ALT'] },
        { fn: 'UNIQUE', sig: 'UNIQUE(values)', desc: 'Remove duplicates', ops: ['SEG'] },
        { fn: 'FLATTEN', sig: 'FLATTEN(values)', desc: 'Flatten nested arrays', ops: ['ALT'] },
        { fn: 'COMPACT', sig: 'COMPACT(values)', desc: 'Remove nulls/blanks', ops: ['SEG', 'NUL'] },
      ],
      text: [
        { fn: 'UPPER', sig: 'UPPER(text)', desc: 'Uppercase', ops: ['ALT'] },
        { fn: 'LOWER', sig: 'LOWER(text)', desc: 'Lowercase', ops: ['ALT'] },
        { fn: 'TRIM', sig: 'TRIM(text)', desc: 'Remove whitespace', ops: ['ALT'] },
        { fn: 'LEFT', sig: 'LEFT(text, n)', desc: 'First N chars', ops: ['SEG'] },
        { fn: 'RIGHT', sig: 'RIGHT(text, n)', desc: 'Last N chars', ops: ['SEG'] },
        { fn: 'LEN', sig: 'LEN(text)', desc: 'Character count', ops: ['DES'] },
        { fn: 'CONCAT', sig: 'CONCAT(values, sep)', desc: 'Join to string', ops: ['SYN'] },
        { fn: 'SPLIT', sig: 'SPLIT(text, delim)', desc: 'Split to array', ops: ['SEG'] },
      ],
      logic: [
        { fn: 'IF', sig: 'IF(cond, ifTrue, ifFalse)', desc: 'Conditional value', ops: ['SEG', 'ALT'] },
        { fn: 'IFS', sig: 'IFS(c1, v1, c2, v2, ...)', desc: 'Multiple conditions', ops: ['SEG', 'ALT'] },
        { fn: 'SWITCH', sig: 'SWITCH(expr, c1, v1, ...)', desc: 'Pattern match', ops: ['SEG', 'ALT'] },
        { fn: 'AND', sig: 'AND(cond1, cond2, ...)', desc: 'All true', ops: ['SYN'] },
        { fn: 'OR', sig: 'OR(cond1, cond2, ...)', desc: 'Any true', ops: ['SYN'] },
        { fn: 'NOT', sig: 'NOT(condition)', desc: 'Invert boolean', ops: ['ALT'] },
      ],
      math: [
        { fn: 'ROUND', sig: 'ROUND(num, places)', desc: 'Round to decimals', ops: ['ALT'] },
        { fn: 'FLOOR', sig: 'FLOOR(num)', desc: 'Round down', ops: ['ALT'] },
        { fn: 'CEILING', sig: 'CEILING(num)', desc: 'Round up', ops: ['ALT'] },
        { fn: 'ABS', sig: 'ABS(num)', desc: 'Absolute value', ops: ['ALT'] },
        { fn: 'MOD', sig: 'MOD(num, divisor)', desc: 'Remainder', ops: ['ALT'] },
        { fn: 'POWER', sig: 'POWER(num, exp)', desc: 'Exponentiation', ops: ['ALT'] },
        { fn: 'SQRT', sig: 'SQRT(num)', desc: 'Square root', ops: ['ALT'] },
      ],
      date: [
        { fn: 'NOW', sig: 'NOW()', desc: 'Current datetime', ops: ['INS'] },
        { fn: 'TODAY', sig: 'TODAY()', desc: 'Current date', ops: ['INS'] },
        { fn: 'DATE', sig: 'DATE(y, m, d)', desc: 'Construct date', ops: ['INS'] },
        { fn: 'YEAR', sig: 'YEAR(date)', desc: 'Extract year', ops: ['DES'] },
        { fn: 'MONTH', sig: 'MONTH(date)', desc: 'Extract month', ops: ['DES'] },
        { fn: 'DAY', sig: 'DAY(date)', desc: 'Extract day', ops: ['DES'] },
        { fn: 'DATEADD', sig: 'DATEADD(date, n, unit)', desc: 'Add to date', ops: ['ALT'] },
        { fn: 'DATEDIFF', sig: 'DATEDIFF(d1, d2, unit)', desc: 'Date difference', ops: ['ALT', 'DES'] },
      ],
      null: [
        { fn: 'BLANK', sig: 'BLANK()', desc: 'Return blank value', ops: ['NUL'] },
        { fn: 'ISBLANK', sig: 'ISBLANK(value)', desc: 'Check if blank', ops: ['NUL', 'DES'] },
        { fn: 'IFBLANK', sig: 'IFBLANK(value, default)', desc: 'Default if blank', ops: ['NUL', 'ALT'] },
        { fn: 'IFERROR', sig: 'IFERROR(value, default)', desc: 'Default if error', ops: ['NUL', 'ALT'] },
      ],
    };

    const categoryColors = {
      aggregation: 'purple',
      array: 'amber',
      text: 'emerald',
      logic: 'blue',
      math: 'rose',
      date: 'cyan',
      null: 'slate',
    };

    return `
      <h2>Function Library</h2>

      <div class="formula-explainer-fn-tabs">
        ${Object.keys(categories).map(cat => `
          <button class="formula-explainer-fn-tab ${this.activeTab === cat ? 'active' : ''}" data-fn-tab="${cat}">
            ${cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        `).join('')}
      </div>

      ${Object.entries(categories).map(([cat, fns]) => `
        <div class="formula-explainer-fn-content ${this.activeTab === cat ? 'active' : ''}" data-fn-tab-content="${cat}">
          <div class="formula-explainer-fn-list">
            ${fns.map(({ fn, sig, desc, ops }) => `
              <div class="formula-explainer-fn-item">
                <div class="formula-explainer-fn-info">
                  <code class="formula-explainer-fn-name fn-${categoryColors[cat]}">${fn}</code>
                  <div class="formula-explainer-fn-sig">${sig}</div>
                  <div class="formula-explainer-fn-desc">${desc}</div>
                </div>
                <div class="formula-explainer-fn-ops">
                  ${ops.map(op => this._operatorBadge(op)).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}

      ${this._callout(
        `Standard functions use the battle-tested formulajs library (MIT license).
        We wrap them to add EO decomposition and integrate with our syntax.`,
        'Powered by formulajs',
        'success'
      )}
    `;
  }

  _renderSemantic() {
    const semanticFunctions = [
      {
        fn: 'EXCEPT',
        tag: 'Neti-Neti',
        title: 'Truth by elimination',
        desc: 'Start with a value, subtract violations. Knowledge proceeds by ruling out misinterpretations, not asserting facts.',
        code: `EXCEPT("Approved",
  UNLESS({HasLicense}, "Missing license"),
  UNLESS({BackgroundCheck}, "Failed check"),
  UNLESS({InsuranceValid}, "Insurance expired")
)

// Returns: { value: null, reasons: ["Failed check"] }`,
        ops: ['NUL', 'SEG', 'ALT']
      },
      {
        fn: 'VALID_WHEN',
        tag: 'Vyāvahārika',
        title: 'Scoped truth',
        desc: 'Attach scope to a value. The value is "true enough" within its context, but not portable outside it.',
        code: `VALID_WHEN(
  SUM(#Orders.Total),
  {Region} = "US"
) ASSUMING("Currency is USD", "Fiscal year 2024")

// Returns: { value: 142000, scope: "US", portable: false }`,
        ops: ['DES']
      },
      {
        fn: 'DIAGNOSTIC',
        tag: 'Illuminative',
        title: 'Non-assertive value',
        desc: 'Mark a value as observation-only. It cannot drive decisions or automations. Distinguishes seeing from deciding.',
        code: `DIAGNOSTIC(
  {SystemA.Balance} - {SystemB.Balance},
  "For reconciliation review only"
)

// Using in IF() → ERROR: Cannot use DIAGNOSTIC in decision`,
        ops: ['DES']
      },
      {
        fn: 'EQUIVALENT_WHEN',
        tag: 'Jahadajahallakṣaṇā',
        title: 'Purpose-bound identity',
        desc: 'Test equivalence under projection. Two things can be "the same" for a specific purpose without being globally identical.',
        code: `EQUIVALENT_WHEN(
  {CustomerA}, {CustomerB},
  IGNORING("SourceSystem", "Format"),
  RETAINING("TaxID", "LegalEntity")
)

// Returns: { equivalent: true, forPurpose: "TaxID+LegalEntity" }`,
        ops: ['CON', 'SEG', 'ALT']
      },
      {
        fn: 'REFINE_UNTIL',
        tag: 'Recursive Correction',
        title: 'Convergent iteration',
        desc: 'Iteratively refine until stable. Knowledge stabilizes through repeated correction, not one-shot calculation.',
        code: `REFINE_UNTIL(
  {RawCustomers},
  STABLE,
  MAX_ITERATIONS(5),
  MERGE_DUPLICATES("TaxID"),
  RESOLVE_CONFLICTS("most_recent")
)

// Returns: { value: {...}, iterations: 3, stable: true }`,
        ops: ['REC', 'SEG', 'SYN']
      }
    ];

    return `
      <h2>Semantic Functions</h2>
      <p class="formula-explainer-intro">
        Inspired by Advaita Vedānta. These functions manage <em>meaning</em>, not just values.
      </p>

      <div class="formula-explainer-semantic-list">
        ${semanticFunctions.map(({ fn, tag, title, desc, code, ops }) => `
          <div class="formula-explainer-semantic-item">
            <div class="formula-explainer-semantic-header">
              <div class="formula-explainer-semantic-title">
                <code class="formula-explainer-semantic-fn">${fn}</code>
                <span class="formula-explainer-semantic-subtitle">${title}</span>
              </div>
              <span class="formula-explainer-semantic-tag">${tag}</span>
            </div>
            <div class="formula-explainer-semantic-body">
              <p class="formula-explainer-semantic-desc">${desc}</p>
              ${this._codeBlock(code)}
              <div class="formula-explainer-semantic-ops">
                ${ops.map(op => this._operatorBadge(op)).join('')}
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      ${this._callout(
        `Traditional formulas compute values. Semantic formulas compute <strong>claims</strong>—values
        with scope, assumptions, confidence, and restrictions on use. This is what makes
        Lakṣaṇa different from every other data tool.`,
        'The Core Shift',
        'semantic'
      )}
    `;
  }

  _renderExamples() {
    return `
      <h2>Formula Examples</h2>

      <h3>Basic Calculations</h3>
      ${this._codeBlock(`// Price × Quantity
{Price} * {Quantity}

// Full name
{First} & " " & {Last}

// Percentage with formatting
ROUND({Completed} / {Total} * 100, 1) & "%"`)}

      <h3>Conditional Logic</h3>
      ${this._codeBlock(`// Simple condition
IF({Status} = "Active", "✓ Active", "Inactive")

// Multiple conditions
IFS(
  {Score} >= 90, "A",
  {Score} >= 80, "B",
  {Score} >= 70, "C",
  TRUE, "F"
)

// Nested conditions
IF({DueDate} < TODAY(), "🔴 Overdue",
  IF({DueDate} < DATEADD(TODAY(), 7, "days"), "🟡 Soon", "🟢 OK")
)`)}

      <h3>Aggregations Over Connections</h3>
      ${this._codeBlock(`// Total revenue from paid orders
SUM(#Orders.Total, [Status = "Paid"])

// Average rating for verified reviews
AVERAGE(#Reviews.Rating, [Verified = TRUE])

// Count open tasks assigned to me
COUNT(#Tasks, [Status = "Open" AND Assignee = {CurrentUser}])

// Most recent order date
MAX(#Orders.Date)`)}

      <h3>Array Transformations</h3>
      ${this._codeBlock(`// Apply 10% markup to each order
MAP(#Orders, $.Total * 1.1)

// Get only active tasks
FILTER(#Tasks, $.Status = "Active" AND $.DueDate > TODAY())

// Sort products by price, highest first
SORT(#Products, $.Price, "desc")

// Unique category names, joined
CONCAT(UNIQUE(#Products.Category), ", ")`)}

      <h3>Chained Traversals</h3>
      ${this._codeBlock(`// Customer name for each order
#Orders.Customer.Name

// Project owner's email for each task
#Tasks.Project.Owner.Email

// Total of all line items across all orders
SUM(#Orders.LineItems.Amount)`)}

      <h3>Semantic/AV Functions</h3>
      ${this._codeBlock(`// Validation by elimination (Neti-Neti)
EXCEPT("Approved",
  UNLESS({HasLicense}, "License required"),
  UNLESS({Background} = "Clear", "Background check failed"),
  UNLESS({InsuranceExpiry} > TODAY(), "Insurance expired")
)

// Scoped truth with assumptions
VALID_WHEN(
  SUM(#Orders.Total),
  {Region} = "US"
) ASSUMING(
  "Currency is USD",
  "Fiscal year 2024",
  "Excludes refunds"
)

// Non-assertive diagnostic
DIAGNOSTIC(
  ABS({Expected} - {Actual}),
  "Variance for investigation - not for automated action"
)

// Entity resolution with convergence
REFINE_UNTIL(
  {ImportedContacts},
  STABLE,
  MAX_ITERATIONS(10),
  MERGE_BY("Email", "Phone"),
  PREFER("most_recent")
)`)}

      ${this._callout(
        `Every formula above can be expanded to show its EO operator pipeline.
        Click any formula result to see exactly how it was computed, step by step.`,
        'Pipeline Inspection',
        'info'
      )}
    `;
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.EOFormulaExplainer = EOFormulaExplainer;
}

// Helper function to show explainer (global access)
function showFormulaExplainer() {
  const explainer = new EOFormulaExplainer();
  explainer.show();
}

if (typeof window !== 'undefined') {
  window.showFormulaExplainer = showFormulaExplainer;
}
