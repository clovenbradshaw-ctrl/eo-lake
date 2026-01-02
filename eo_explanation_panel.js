/**
 * EO Explanation Panel - "Why / How did this happen?" UI Component
 *
 * Provides user-facing explanations for any data transformation, view state,
 * or computed value. Makes EO the explanation layer without exposing operators.
 *
 * DESIGN PRINCIPLE:
 * - Simple mode: Plain English, no jargon
 * - Advanced mode: Show operator symbols and chains for power users
 * - Never mandatory: Users can ignore explanations entirely
 */

// ============================================================================
// Explanation Panel Class
// ============================================================================

class EOExplanationPanel {
  constructor(options = {}) {
    this.container = options.container || null;
    this.target = options.target || null; // What we're explaining
    this.targetType = options.targetType || 'view'; // 'view', 'field', 'value', 'record'
    this.showAdvanced = false;
    this.onClose = options.onClose || null;

    // Get language module
    this.language = window.EOLanguage || {};
  }

  /**
   * Show explanation for a filtered view
   */
  explainView(viewConfig) {
    const operators = this._extractViewOperators(viewConfig);
    return this._renderExplanation({
      title: 'How this view works',
      icon: 'ph-funnel',
      operators,
      context: viewConfig
    });
  }

  /**
   * Show explanation for a calculated value
   */
  explainCalculation(derivedValue) {
    const operators = this._extractCalculationOperators(derivedValue);
    return this._renderExplanation({
      title: 'How this value was calculated',
      icon: 'ph-function',
      operators,
      context: derivedValue
    });
  }

  /**
   * Show explanation for a record's lineage
   */
  explainLineage(record) {
    const history = this._extractLineageHistory(record);
    return this._renderLineageExplanation({
      title: 'Record history',
      icon: 'ph-git-branch',
      history,
      context: record
    });
  }

  /**
   * Show explanation for a field's interpretation
   */
  explainField(fieldBinding) {
    return this._renderFieldExplanation(fieldBinding);
  }

  /**
   * Show explanation for a superposed value (multiple interpretations)
   */
  explainSuperposition(superposedValue) {
    return this._renderSuperpositionExplanation(superposedValue);
  }

  // ============================================================================
  // Operator Extraction
  // ============================================================================

  /**
   * Extract operator chain from a view configuration
   */
  _extractViewOperators(viewConfig) {
    const operators = [];

    // Source
    if (viewConfig.sourceId) {
      operators.push({
        type: 'INS',
        params: { source: viewConfig.sourceName || viewConfig.sourceId }
      });
    }

    // Filters (SEG)
    if (viewConfig.filters && viewConfig.filters.length > 0) {
      viewConfig.filters.forEach(filter => {
        operators.push({
          type: 'SEG',
          params: {
            field: filter.fieldName || filter.field,
            operator: this._getOperatorSymbol(filter.operator),
            value: filter.value
          }
        });
      });
    }

    // Field selection (SEG for hidden fields)
    if (viewConfig.hiddenFields && viewConfig.hiddenFields.length > 0) {
      operators.push({
        type: 'SEG',
        params: {
          action: 'hide',
          fields: viewConfig.hiddenFields.length,
          description: `${viewConfig.hiddenFields.length} fields hidden`
        }
      });
    }

    // Grouping (SEG + reorganization)
    if (viewConfig.groupBy) {
      operators.push({
        type: 'SEG',
        params: {
          action: 'group',
          field: viewConfig.groupByFieldName || viewConfig.groupBy,
          description: `Organized around ${viewConfig.groupByFieldName || viewConfig.groupBy}`
        }
      });
    }

    // Sorting (SEG)
    if (viewConfig.sortField) {
      operators.push({
        type: 'SEG',
        params: {
          action: 'sort',
          field: viewConfig.sortFieldName || viewConfig.sortField,
          direction: viewConfig.sortDirection || 'asc'
        }
      });
    }

    return operators;
  }

  /**
   * Extract operator chain from a derived/calculated value
   */
  _extractCalculationOperators(derivedValue) {
    const operators = [];

    // Get grounding if available
    const grounding = derivedValue.grounding || derivedValue.getGrounding?.() || {};

    // Source connection (CON)
    if (grounding.sourceField || derivedValue.linkedField) {
      operators.push({
        type: 'CON',
        params: {
          target: grounding.sourceSetName || 'source records',
          field: grounding.sourceField || derivedValue.linkedField
        }
      });
    }

    // Filter if applicable (SEG)
    if (grounding.filter || derivedValue.filter) {
      const filter = grounding.filter || derivedValue.filter;
      operators.push({
        type: 'SEG',
        params: {
          field: filter.field,
          operator: filter.operator,
          value: filter.value
        }
      });
    }

    // Aggregation (SYN)
    if (grounding.aggregation || derivedValue.aggregation) {
      const agg = grounding.aggregation || derivedValue.aggregation;
      operators.push({
        type: 'SYN',
        params: {
          function: agg.function || agg.type || 'aggregate',
          field: agg.field,
          groupBy: agg.groupBy
        }
      });
    }

    // Naming/labeling (DES)
    if (derivedValue.label || derivedValue.name) {
      operators.push({
        type: 'DES',
        params: {
          name: derivedValue.label || derivedValue.name
        }
      });
    }

    return operators;
  }

  /**
   * Extract lineage history from a record
   */
  _extractLineageHistory(record) {
    const history = [];

    // Check for provenance/grounding data
    const provenance = record._provenance || record.provenance || {};
    const events = record._events || [];

    // Creation event
    if (provenance.source || record.sourceId) {
      history.push({
        action: 'Created',
        operator: 'INS',
        description: `Imported from ${provenance.source || record.sourceName || 'source'}`,
        timestamp: provenance.importedAt || record.createdAt
      });
    }

    // Field bindings (DES)
    if (provenance.bindings && Object.keys(provenance.bindings).length > 0) {
      history.push({
        action: 'Interpreted',
        operator: 'DES',
        description: `${Object.keys(provenance.bindings).length} fields bound to definitions`,
        timestamp: provenance.boundAt
      });
    }

    // Merge events (SYN)
    if (provenance.mergedFrom && provenance.mergedFrom.length > 0) {
      history.push({
        action: 'Combined',
        operator: 'SYN',
        description: `Merged with ${provenance.mergedFrom.length} other record(s)`,
        timestamp: provenance.mergedAt
      });
    }

    // Add any explicit events
    events.forEach(event => {
      history.push({
        action: event.action || event.type,
        operator: event.operator || 'REC',
        description: event.description || event.summary,
        timestamp: event.timestamp || event.at
      });
    });

    // If no history found, add a default
    if (history.length === 0) {
      history.push({
        action: 'Exists',
        operator: 'INS',
        description: 'Record exists in the system',
        timestamp: record.createdAt || null
      });
    }

    return history;
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  /**
   * Render a standard explanation panel
   */
  _renderExplanation({ title, icon, operators, context }) {
    const container = this.container || document.createElement('div');
    container.className = 'eo-explanation-panel';

    const simpleExplanation = this._generateSimpleExplanation(operators);
    const advancedExplanation = this._generateAdvancedExplanation(operators);

    container.innerHTML = `
      <div class="eo-explanation-header">
        <div class="eo-explanation-title">
          <i class="ph ${icon}"></i>
          <span>${title}</span>
        </div>
        <div class="eo-explanation-controls">
          <button class="btn-icon eo-toggle-advanced" title="Show technical details">
            <i class="ph ph-code"></i>
          </button>
          <button class="btn-icon eo-close-btn" title="Close">
            <i class="ph ph-x"></i>
          </button>
        </div>
      </div>

      <div class="eo-explanation-body">
        <div class="eo-explanation-simple ${this.showAdvanced ? 'hidden' : ''}">
          ${simpleExplanation}
        </div>
        <div class="eo-explanation-advanced ${this.showAdvanced ? '' : 'hidden'}">
          ${advancedExplanation}
        </div>
      </div>

      <div class="eo-explanation-footer">
        <div class="eo-explanation-stats">
          <span class="eo-stat">
            <i class="ph ph-stack"></i>
            ${operators.length} step${operators.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    `;

    this._attachEventListeners(container);
    return container;
  }

  /**
   * Render lineage explanation as a timeline
   */
  _renderLineageExplanation({ title, icon, history, context }) {
    const container = this.container || document.createElement('div');
    container.className = 'eo-explanation-panel eo-lineage-panel';

    const timelineHtml = history.map((event, index) => {
      const opDisplay = this.language.getOperatorDisplay?.(event.operator) ||
        { symbol: '•', name: event.operator };

      return `
        <div class="eo-lineage-event ${index === history.length - 1 ? 'current' : ''}">
          <div class="eo-lineage-connector">
            <span class="eo-lineage-dot" title="${opDisplay.name}">${opDisplay.symbol}</span>
            ${index < history.length - 1 ? '<span class="eo-lineage-line"></span>' : ''}
          </div>
          <div class="eo-lineage-content">
            <div class="eo-lineage-action">${event.action}</div>
            <div class="eo-lineage-description">${event.description}</div>
            ${event.timestamp ? `<div class="eo-lineage-timestamp">${this._formatTimestamp(event.timestamp)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="eo-explanation-header">
        <div class="eo-explanation-title">
          <i class="ph ${icon}"></i>
          <span>${title}</span>
        </div>
        <button class="btn-icon eo-close-btn" title="Close">
          <i class="ph ph-x"></i>
        </button>
      </div>

      <div class="eo-explanation-body">
        <div class="eo-lineage-timeline">
          ${timelineHtml}
        </div>
      </div>
    `;

    this._attachEventListeners(container);
    return container;
  }

  /**
   * Render field interpretation explanation
   */
  _renderFieldExplanation(fieldBinding) {
    const container = this.container || document.createElement('div');
    container.className = 'eo-explanation-panel eo-field-explanation';

    const binding = fieldBinding || {};
    const hasBinding = binding.uri || binding.semanticUri;

    container.innerHTML = `
      <div class="eo-explanation-header">
        <div class="eo-explanation-title">
          <i class="ph ph-tag"></i>
          <span>Field interpretation</span>
        </div>
        <button class="btn-icon eo-close-btn" title="Close">
          <i class="ph ph-x"></i>
        </button>
      </div>

      <div class="eo-explanation-body">
        ${hasBinding ? `
          <div class="eo-field-binding">
            <div class="eo-field-label">${binding.fieldName || 'Field'}</div>
            <div class="eo-field-meaning">
              <span class="eo-operator-symbol">⊙</span>
              <span>Interpreted as: <strong>${binding.label || binding.semanticLabel || 'defined concept'}</strong></span>
            </div>
            ${binding.uri ? `
              <div class="eo-field-uri">
                <i class="ph ph-link"></i>
                <code>${binding.uri}</code>
              </div>
            ` : ''}
            ${binding.description ? `
              <div class="eo-field-description">${binding.description}</div>
            ` : ''}
            ${binding.context ? `
              <div class="eo-field-context">
                <span class="label">Context:</span>
                ${binding.context.jurisdiction ? `<span class="tag">📍 ${binding.context.jurisdiction}</span>` : ''}
                ${binding.context.timeframe ? `<span class="tag">📅 ${binding.context.timeframe}</span>` : ''}
                ${binding.context.scale ? `<span class="tag">📊 ${binding.context.scale}</span>` : ''}
              </div>
            ` : ''}
          </div>
        ` : `
          <div class="eo-field-unbound">
            <i class="ph ph-question"></i>
            <span>This field has no semantic binding yet.</span>
            <button class="btn btn-sm btn-outline eo-add-binding-btn">
              <i class="ph ph-plus"></i>
              Add interpretation
            </button>
          </div>
        `}
      </div>
    `;

    this._attachEventListeners(container);
    return container;
  }

  /**
   * Render superposition explanation (multiple values)
   */
  _renderSuperpositionExplanation(superposedValue) {
    const container = this.container || document.createElement('div');
    container.className = 'eo-explanation-panel eo-superposition-explanation';

    const values = superposedValue.values || [];
    const valuesHtml = values.map((v, i) => `
      <div class="eo-sup-value ${v.selected ? 'selected' : ''}">
        <div class="eo-sup-value-content">
          <span class="eo-sup-value-data">${this._formatValue(v.value)}</span>
          ${v.source ? `<span class="eo-sup-value-source">from ${v.source}</span>` : ''}
        </div>
        ${v.confidence ? `
          <div class="eo-sup-value-confidence" title="Confidence: ${Math.round(v.confidence * 100)}%">
            <div class="confidence-bar" style="width: ${v.confidence * 100}%"></div>
          </div>
        ` : ''}
      </div>
    `).join('');

    container.innerHTML = `
      <div class="eo-explanation-header">
        <div class="eo-explanation-title">
          <i class="ph ph-git-fork"></i>
          <span>Multiple values exist</span>
        </div>
        <button class="btn-icon eo-close-btn" title="Close">
          <i class="ph ph-x"></i>
        </button>
      </div>

      <div class="eo-explanation-body">
        <div class="eo-sup-intro">
          <span class="eo-operator-symbol">∥</span>
          <span>${values.length} interpretations from different sources</span>
        </div>

        <div class="eo-sup-values">
          ${valuesHtml}
        </div>

        <div class="eo-sup-resolution">
          <div class="eo-sup-resolution-label">Resolution strategy:</div>
          <div class="eo-sup-resolution-options">
            <button class="btn btn-sm ${superposedValue.resolution === 'recent' ? 'active' : ''}" data-resolution="recent">
              Most recent
            </button>
            <button class="btn btn-sm ${superposedValue.resolution === 'confidence' ? 'active' : ''}" data-resolution="confidence">
              Highest confidence
            </button>
            <button class="btn btn-sm ${superposedValue.resolution === 'all' ? 'active' : ''}" data-resolution="all">
              Keep all
            </button>
          </div>
        </div>
      </div>
    `;

    this._attachEventListeners(container);
    return container;
  }

  // ============================================================================
  // Explanation Generation
  // ============================================================================

  /**
   * Generate simple, plain-English explanation
   */
  _generateSimpleExplanation(operators) {
    if (!operators || operators.length === 0) {
      return '<p class="eo-no-transform">No transformations applied. Showing all data as recorded.</p>';
    }

    const steps = operators.map(op => this._operatorToSimpleText(op));

    return `
      <div class="eo-simple-steps">
        ${steps.map((step, i) => `
          <div class="eo-simple-step">
            <span class="eo-step-number">${i + 1}</span>
            <span class="eo-step-text">${step}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Generate advanced explanation with operator symbols
   */
  _generateAdvancedExplanation(operators) {
    if (!operators || operators.length === 0) {
      return '<p class="eo-no-transform">Identity transformation (no operators applied)</p>';
    }

    return `
      <div class="eo-advanced-steps">
        ${operators.map(op => {
          const display = this.language.getOperatorDisplay?.(op.type) ||
            { symbol: '?', name: op.type };
          return `
            <div class="eo-advanced-step">
              <span class="eo-operator-badge" title="${display.name}">
                ${display.symbol}
              </span>
              <span class="eo-operator-name">${display.name}</span>
              <span class="eo-operator-params">${this._formatParams(op.params)}</span>
            </div>
          `;
        }).join('<span class="eo-step-arrow">→</span>')}
      </div>
    `;
  }

  /**
   * Convert an operator to simple text
   */
  _operatorToSimpleText(op) {
    const params = op.params || {};

    switch (op.type) {
      case 'INS':
        return `Data from <strong>${params.source || 'source'}</strong>`;

      case 'SEG':
        if (params.action === 'hide') {
          return `${params.fields || 'Some'} fields are hidden`;
        }
        if (params.action === 'group') {
          return `Organized around <strong>${params.field}</strong>`;
        }
        if (params.action === 'sort') {
          return `Sorted by <strong>${params.field}</strong> (${params.direction === 'desc' ? 'descending' : 'ascending'})`;
        }
        return `Filtered to show only <strong>${params.field}</strong> ${params.operator || 'matching'} <strong>"${params.value}"</strong>`;

      case 'DES':
        return `Labeled as <strong>"${params.name}"</strong>`;

      case 'CON':
        return `Connected to <strong>${params.target}</strong>${params.field ? ` via ${params.field}` : ''}`;

      case 'SYN':
        if (params.function) {
          return `Calculated <strong>${params.function}</strong> of <strong>${params.field}</strong>${params.groupBy ? ` for each ${params.groupBy}` : ''}`;
        }
        return `Combined from multiple sources`;

      case 'SUP':
        return `<strong>${params.count || 'Multiple'}</strong> values preserved from different sources`;

      case 'ALT':
        return `As known on <strong>${params.date}</strong>`;

      case 'REC':
        return `Tracked from <strong>${params.source}</strong>`;

      case 'NUL':
        return `Expected value is <strong>missing</strong>`;

      default:
        return `${op.type}: ${JSON.stringify(params)}`;
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  _getOperatorSymbol(operator) {
    const symbols = {
      'equals': '=',
      'not_equals': '≠',
      'contains': '∋',
      'not_contains': '∌',
      'starts_with': '⊃',
      'ends_with': '⊂',
      'greater_than': '>',
      'less_than': '<',
      'greater_or_equal': '≥',
      'less_or_equal': '≤',
      'is_empty': '∅',
      'is_not_empty': '≠∅'
    };
    return symbols[operator] || operator;
  }

  _formatParams(params) {
    if (!params) return '';

    const parts = [];
    if (params.field) parts.push(params.field);
    if (params.operator) parts.push(params.operator);
    if (params.value !== undefined) parts.push(`"${params.value}"`);
    if (params.function) parts.push(`${params.function}()`);
    if (params.target) parts.push(`→ ${params.target}`);
    if (params.action) parts.push(params.action);

    return parts.join(' ');
  }

  _formatValue(value) {
    if (value === null || value === undefined) return '<em>empty</em>';
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value);
  }

  _formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    return date.toLocaleString();
  }

  _attachEventListeners(container) {
    // Close button
    const closeBtn = container.querySelector('.eo-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        container.remove();
        if (this.onClose) this.onClose();
      });
    }

    // Advanced toggle
    const toggleBtn = container.querySelector('.eo-toggle-advanced');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.showAdvanced = !this.showAdvanced;
        const simple = container.querySelector('.eo-explanation-simple');
        const advanced = container.querySelector('.eo-explanation-advanced');
        if (simple) simple.classList.toggle('hidden', this.showAdvanced);
        if (advanced) advanced.classList.toggle('hidden', !this.showAdvanced);
        toggleBtn.classList.toggle('active', this.showAdvanced);
      });
    }

    // Resolution buttons
    const resolutionBtns = container.querySelectorAll('[data-resolution]');
    resolutionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        resolutionBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Emit event for resolution change
        container.dispatchEvent(new CustomEvent('resolution-change', {
          detail: { resolution: btn.dataset.resolution }
        }));
      });
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Show explanation for a view as a popup
 */
function showViewExplanation(viewConfig, anchorElement) {
  const panel = new EOExplanationPanel();
  const element = panel.explainView(viewConfig);

  // Position near anchor
  if (anchorElement) {
    element.style.position = 'absolute';
    const rect = anchorElement.getBoundingClientRect();
    element.style.top = `${rect.bottom + 8}px`;
    element.style.left = `${rect.left}px`;
  }

  document.body.appendChild(element);
  return element;
}

/**
 * Show explanation for a calculated value
 */
function showCalculationExplanation(derivedValue, anchorElement) {
  const panel = new EOExplanationPanel();
  const element = panel.explainCalculation(derivedValue);

  if (anchorElement) {
    element.style.position = 'absolute';
    const rect = anchorElement.getBoundingClientRect();
    element.style.top = `${rect.bottom + 8}px`;
    element.style.left = `${rect.left}px`;
  }

  document.body.appendChild(element);
  return element;
}

/**
 * Show lineage for a record
 */
function showLineageExplanation(record, anchorElement) {
  const panel = new EOExplanationPanel();
  const element = panel.explainLineage(record);

  if (anchorElement) {
    element.style.position = 'absolute';
    const rect = anchorElement.getBoundingClientRect();
    element.style.top = `${rect.bottom + 8}px`;
    element.style.left = `${rect.left}px`;
  }

  document.body.appendChild(element);
  return element;
}

/**
 * Show superposition explanation
 */
function showSuperpositionExplanation(superposedValue, anchorElement) {
  const panel = new EOExplanationPanel();
  const element = panel.explainSuperposition(superposedValue);

  if (anchorElement) {
    element.style.position = 'absolute';
    const rect = anchorElement.getBoundingClientRect();
    element.style.top = `${rect.bottom + 8}px`;
    element.style.left = `${rect.left}px`;
  }

  document.body.appendChild(element);
  return element;
}

// ============================================================================
// Export
// ============================================================================

window.EOExplanationPanel = EOExplanationPanel;
window.EOExplanation = {
  Panel: EOExplanationPanel,
  showViewExplanation,
  showCalculationExplanation,
  showLineageExplanation,
  showSuperpositionExplanation
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EOExplanationPanel, ...window.EOExplanation };
}
