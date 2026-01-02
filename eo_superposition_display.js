/**
 * EO Superposition Display - SUP Visual Indicators
 *
 * Makes superposition (multiple conflicting values) a first-class visual concept.
 * Shows when values disagree and provides resolution UI.
 *
 * PRINCIPLE: Disagreement is preserved, not hidden.
 * Cell shows: $4.2M ⊕3 (meaning 3 valid values exist)
 */

// ============================================================================
// Superposition State
// ============================================================================

const SuperpositionState = Object.freeze({
  SINGLE: 'single',           // One value, no conflict
  SUPERPOSED: 'superposed',   // Multiple values, unresolved
  RESOLVED: 'resolved',       // Multiple values, one chosen
  MANUAL: 'manual'            // User explicitly set value
});

// ============================================================================
// Resolution Strategies
// ============================================================================

const ResolutionStrategy = Object.freeze({
  MOST_RECENT: 'most_recent',
  HIGHEST_CONFIDENCE: 'highest_confidence',
  PRIMARY_SOURCE: 'primary_source',
  AGGREGATE: 'aggregate',
  MANUAL: 'manual',
  KEEP_ALL: 'keep_all'
});

const ResolutionStrategyLabels = Object.freeze({
  [ResolutionStrategy.MOST_RECENT]: {
    label: 'Most recent',
    description: 'Use the value from the most recent source',
    icon: 'ph-clock'
  },
  [ResolutionStrategy.HIGHEST_CONFIDENCE]: {
    label: 'Highest confidence',
    description: 'Use the value with the highest confidence score',
    icon: 'ph-seal-check'
  },
  [ResolutionStrategy.PRIMARY_SOURCE]: {
    label: 'Primary source',
    description: 'Use the value from the designated primary source',
    icon: 'ph-star'
  },
  [ResolutionStrategy.AGGREGATE]: {
    label: 'Aggregate',
    description: 'Combine values (e.g., average, sum)',
    icon: 'ph-calculator'
  },
  [ResolutionStrategy.MANUAL]: {
    label: 'Manual selection',
    description: 'You choose which value to use',
    icon: 'ph-cursor-click'
  },
  [ResolutionStrategy.KEEP_ALL]: {
    label: 'Keep all',
    description: 'Show all values without choosing',
    icon: 'ph-git-fork'
  }
});

// ============================================================================
// Superposition Value Class
// ============================================================================

/**
 * Represents a value that may have multiple interpretations
 */
class SuperposedValue {
  constructor(options = {}) {
    this.fieldId = options.fieldId;
    this.recordId = options.recordId;
    this.values = options.values || []; // Array of { value, source, confidence, timestamp }
    this.resolution = options.resolution || null; // { strategy, selectedIndex, resolvedValue }
    this.state = this._determineState();
  }

  _determineState() {
    if (this.values.length === 0) return SuperpositionState.SINGLE;
    if (this.values.length === 1) return SuperpositionState.SINGLE;
    if (this.resolution && this.resolution.strategy !== ResolutionStrategy.KEEP_ALL) {
      return SuperpositionState.RESOLVED;
    }
    return SuperpositionState.SUPERPOSED;
  }

  /**
   * Get the display value (what to show in the cell)
   */
  getDisplayValue() {
    if (this.values.length === 0) return null;
    if (this.values.length === 1) return this.values[0].value;

    if (this.resolution) {
      switch (this.resolution.strategy) {
        case ResolutionStrategy.MOST_RECENT:
          return this._getMostRecent().value;
        case ResolutionStrategy.HIGHEST_CONFIDENCE:
          return this._getHighestConfidence().value;
        case ResolutionStrategy.PRIMARY_SOURCE:
          return this._getPrimarySource()?.value || this.values[0].value;
        case ResolutionStrategy.AGGREGATE:
          return this._getAggregated();
        case ResolutionStrategy.MANUAL:
          return this.values[this.resolution.selectedIndex]?.value;
        case ResolutionStrategy.KEEP_ALL:
          return this.values.map(v => v.value);
      }
    }

    // Default to first value
    return this.values[0].value;
  }

  /**
   * Get count of alternate values
   */
  getAlternateCount() {
    return this.values.length;
  }

  /**
   * Check if this value is superposed
   */
  isSuperposed() {
    return this.values.length > 1;
  }

  /**
   * Resolve using a strategy
   */
  resolve(strategy, selectedIndex = null) {
    this.resolution = {
      strategy,
      selectedIndex,
      resolvedAt: Date.now()
    };
    this.state = this._determineState();
  }

  _getMostRecent() {
    return this.values.reduce((latest, v) =>
      (v.timestamp > (latest.timestamp || 0)) ? v : latest
    , this.values[0]);
  }

  _getHighestConfidence() {
    return this.values.reduce((best, v) =>
      (v.confidence > (best.confidence || 0)) ? v : best
    , this.values[0]);
  }

  _getPrimarySource() {
    return this.values.find(v => v.isPrimary);
  }

  _getAggregated() {
    const numericValues = this.values
      .map(v => parseFloat(v.value))
      .filter(v => !isNaN(v));

    if (numericValues.length === 0) return this.values[0].value;

    // Default to average
    const sum = numericValues.reduce((a, b) => a + b, 0);
    return sum / numericValues.length;
  }
}

// ============================================================================
// Superposition Cell Renderer
// ============================================================================

/**
 * Renders a cell that may contain superposed values
 */
class SuperpositionCellRenderer {
  constructor(options = {}) {
    this.showIndicator = options.showIndicator !== false;
    this.indicatorPosition = options.indicatorPosition || 'right';
    this.onClick = options.onClick;
  }

  /**
   * Render a cell value with superposition indicator
   */
  render(value, container) {
    if (!(value instanceof SuperposedValue)) {
      // Not a superposed value, render normally
      container.textContent = this._formatValue(value);
      return;
    }

    const displayValue = value.getDisplayValue();
    const isSuperposed = value.isSuperposed();
    const alternateCount = value.getAlternateCount();

    container.className = `eo-sup-cell ${isSuperposed ? 'has-alternates' : ''} ${value.state}`;

    if (!isSuperposed) {
      container.innerHTML = `<span class="eo-sup-value">${this._formatValue(displayValue)}</span>`;
      return;
    }

    // Render with indicator
    container.innerHTML = `
      <span class="eo-sup-value">${this._formatValue(displayValue)}</span>
      ${this.showIndicator ? `
        <span class="eo-sup-indicator" title="${alternateCount} values from different sources">
          <span class="eo-sup-symbol">⊕</span>
          <span class="eo-sup-count">${alternateCount}</span>
        </span>
      ` : ''}
    `;

    // Add click handler
    if (this.onClick) {
      const indicator = container.querySelector('.eo-sup-indicator');
      if (indicator) {
        indicator.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onClick(value, container);
        });
      }
    }
  }

  _formatValue(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value.map(v => this._formatSingleValue(v)).join(' | ');
    }
    return this._formatSingleValue(value);
  }

  _formatSingleValue(value) {
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return String(value);
  }
}

// ============================================================================
// Superposition Resolution Panel
// ============================================================================

/**
 * UI panel for resolving superposed values
 */
class SuperpositionResolutionPanel {
  constructor(options = {}) {
    this.container = options.container;
    this.superposedValue = options.superposedValue;
    this.onResolve = options.onResolve;
    this.onClose = options.onClose;
  }

  render() {
    if (!this.container || !this.superposedValue) return;

    const values = this.superposedValue.values;
    const currentResolution = this.superposedValue.resolution;

    this.container.innerHTML = `
      <div class="eo-sup-resolution-panel">
        <div class="eo-sup-header">
          <div class="eo-sup-title">
            <span class="eo-sup-symbol">∥</span>
            <span>Multiple values exist</span>
          </div>
          <button class="btn-icon eo-close-btn" title="Close">
            <i class="ph ph-x"></i>
          </button>
        </div>

        <div class="eo-sup-intro">
          <p>${values.length} sources provide different values for this field.</p>
        </div>

        <div class="eo-sup-values-list">
          ${values.map((v, index) => this._renderValueOption(v, index, currentResolution)).join('')}
        </div>

        <div class="eo-sup-divider"></div>

        <div class="eo-sup-strategies">
          <div class="eo-sup-strategies-label">Resolution strategy:</div>
          ${Object.entries(ResolutionStrategyLabels).map(([key, info]) =>
            this._renderStrategyOption(key, info, currentResolution)
          ).join('')}
        </div>

        <div class="eo-sup-actions">
          <button class="btn btn-primary eo-apply-btn">
            Apply Resolution
          </button>
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  _renderValueOption(value, index, currentResolution) {
    const isSelected = currentResolution?.strategy === ResolutionStrategy.MANUAL &&
                       currentResolution?.selectedIndex === index;

    return `
      <div class="eo-sup-value-option ${isSelected ? 'selected' : ''}" data-index="${index}">
        <div class="eo-sup-value-radio">
          <input type="radio" name="sup-value" value="${index}" ${isSelected ? 'checked' : ''}>
        </div>
        <div class="eo-sup-value-content">
          <div class="eo-sup-value-data">${this._formatValue(value.value)}</div>
          <div class="eo-sup-value-meta">
            ${value.source ? `<span class="eo-sup-source"><i class="ph ph-database"></i> ${value.source}</span>` : ''}
            ${value.timestamp ? `<span class="eo-sup-timestamp"><i class="ph ph-clock"></i> ${this._formatTimestamp(value.timestamp)}</span>` : ''}
            ${value.confidence !== undefined ? `
              <span class="eo-sup-confidence" title="Confidence: ${Math.round(value.confidence * 100)}%">
                <i class="ph ph-seal-check"></i>
                ${Math.round(value.confidence * 100)}%
              </span>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  _renderStrategyOption(key, info, currentResolution) {
    const isActive = currentResolution?.strategy === key;

    return `
      <button class="eo-sup-strategy ${isActive ? 'active' : ''}" data-strategy="${key}" title="${info.description}">
        <i class="ph ${info.icon}"></i>
        <span>${info.label}</span>
      </button>
    `;
  }

  _formatValue(value) {
    if (value === null || value === undefined) return '<em>empty</em>';
    if (typeof value === 'number') return value.toLocaleString();
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value);
  }

  _formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    return date.toLocaleDateString();
  }

  _attachEventListeners() {
    if (!this.container) return;

    // Close button
    const closeBtn = this.container.querySelector('.eo-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (this.onClose) this.onClose();
      });
    }

    // Strategy buttons
    const strategyBtns = this.container.querySelectorAll('.eo-sup-strategy');
    strategyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        strategyBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._selectedStrategy = btn.dataset.strategy;

        // If manual, show value selection
        const valueOptions = this.container.querySelectorAll('.eo-sup-value-option');
        valueOptions.forEach(opt => {
          opt.classList.toggle('selectable', this._selectedStrategy === ResolutionStrategy.MANUAL);
        });
      });
    });

    // Value selection (for manual strategy)
    const valueOptions = this.container.querySelectorAll('.eo-sup-value-option');
    valueOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        if (this._selectedStrategy !== ResolutionStrategy.MANUAL) {
          // Auto-select manual strategy when clicking a value
          this._selectedStrategy = ResolutionStrategy.MANUAL;
          strategyBtns.forEach(b => {
            b.classList.toggle('active', b.dataset.strategy === ResolutionStrategy.MANUAL);
          });
        }

        valueOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        opt.querySelector('input[type="radio"]').checked = true;
        this._selectedIndex = parseInt(opt.dataset.index);
      });
    });

    // Apply button
    const applyBtn = this.container.querySelector('.eo-apply-btn');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (this._selectedStrategy) {
          this.superposedValue.resolve(this._selectedStrategy, this._selectedIndex);

          if (this.onResolve) {
            this.onResolve(this.superposedValue);
          }

          this.container.dispatchEvent(new CustomEvent('resolution-applied', {
            bubbles: true,
            detail: {
              value: this.superposedValue,
              strategy: this._selectedStrategy,
              selectedIndex: this._selectedIndex
            }
          }));
        }
      });
    }
  }
}

// ============================================================================
// Superposition Store
// ============================================================================

/**
 * Tracks superposed values across the application
 */
class SuperpositionStore {
  constructor() {
    this.values = new Map(); // key: `${recordId}:${fieldId}` -> SuperposedValue
    this.defaultStrategy = ResolutionStrategy.MOST_RECENT;
  }

  /**
   * Register a superposed value
   */
  register(recordId, fieldId, values) {
    const key = `${recordId}:${fieldId}`;
    const supValue = new SuperposedValue({
      recordId,
      fieldId,
      values
    });
    this.values.set(key, supValue);
    return supValue;
  }

  /**
   * Get a superposed value
   */
  get(recordId, fieldId) {
    return this.values.get(`${recordId}:${fieldId}`);
  }

  /**
   * Check if a field has superposition
   */
  hasSuperposition(recordId, fieldId) {
    const val = this.get(recordId, fieldId);
    return val && val.isSuperposed();
  }

  /**
   * Resolve a superposed value
   */
  resolve(recordId, fieldId, strategy, selectedIndex = null) {
    const val = this.get(recordId, fieldId);
    if (val) {
      val.resolve(strategy, selectedIndex);
    }
    return val;
  }

  /**
   * Get all unresolved superpositions
   */
  getUnresolved() {
    return Array.from(this.values.values())
      .filter(v => v.state === SuperpositionState.SUPERPOSED);
  }

  /**
   * Set default resolution strategy
   */
  setDefaultStrategy(strategy) {
    this.defaultStrategy = strategy;
  }

  /**
   * Apply default strategy to all unresolved
   */
  resolveAllWithDefault() {
    const unresolved = this.getUnresolved();
    unresolved.forEach(v => {
      v.resolve(this.defaultStrategy);
    });
    return unresolved.length;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let _superpositionStore = null;

function getSuperpositionStore() {
  if (!_superpositionStore) {
    _superpositionStore = new SuperpositionStore();
  }
  return _superpositionStore;
}

/**
 * Create a superposed value from multiple sources
 */
function createSuperposedValue(recordId, fieldId, values) {
  return getSuperpositionStore().register(recordId, fieldId, values);
}

/**
 * Render a cell with superposition support
 */
function renderSuperposedCell(value, container, onClick) {
  const renderer = new SuperpositionCellRenderer({ onClick });
  renderer.render(value, container);
}

/**
 * Show resolution panel for a superposed value
 */
function showResolutionPanel(superposedValue, anchorElement, onResolve) {
  const container = document.createElement('div');
  container.className = 'eo-sup-resolution-container';

  if (anchorElement) {
    const rect = anchorElement.getBoundingClientRect();
    container.style.position = 'absolute';
    container.style.top = `${rect.bottom + 8}px`;
    container.style.left = `${rect.left}px`;
  }

  const panel = new SuperpositionResolutionPanel({
    container,
    superposedValue,
    onResolve: (value) => {
      if (onResolve) onResolve(value);
      container.remove();
    },
    onClose: () => container.remove()
  });

  panel.render();
  document.body.appendChild(container);

  return container;
}

// ============================================================================
// Export
// ============================================================================

window.EOSuperposition = {
  // Types
  SuperpositionState,
  ResolutionStrategy,
  ResolutionStrategyLabels,

  // Classes
  SuperposedValue,
  SuperpositionCellRenderer,
  SuperpositionResolutionPanel,
  SuperpositionStore,

  // Factory functions
  getSuperpositionStore,
  createSuperposedValue,
  renderSuperposedCell,
  showResolutionPanel
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.EOSuperposition;
}
