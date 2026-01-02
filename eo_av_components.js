/**
 * EO AV Components - Advaita Vedanta-Inspired UI Components
 *
 * Implements UX patterns based on Advaita Vedanta principles for definitions:
 * 1. Interpretation Active Banner - Shows when data is viewed through definitions (Adhyāsa prevention)
 * 2. Scope Summary Card - Displays retains/discards (Jahadajahallakṣaṇā)
 * 3. Provisional Interpretation Badge - Shows confidence with caveats
 * 4. Semantic Layer Indicator - Color-coded ontological levels
 *
 * PRINCIPLE: Make interpretation visible to prevent superimposition errors.
 */

// ============================================================================
// Ontological Layer Colors (Pāramārthika / Vyāvahārika / Prātibhāsika)
// ============================================================================

const OntologicalLayers = Object.freeze({
  RAW: {
    id: 'raw',
    label: 'Raw Data',
    sanskrit: 'Pāramārthika',
    description: 'Ultimate reality - recorded facts',
    color: '#1a73e8',       // Blue
    bgColor: '#e8f0fe',
    icon: 'ph-database'
  },
  DEFINITION: {
    id: 'definition',
    label: 'Definition',
    sanskrit: 'Vyāvahārika',
    description: 'Practical reality - interpretive rules',
    color: '#f59e0b',       // Amber
    bgColor: '#fef3c7',
    icon: 'ph-book-open'
  },
  DERIVED: {
    id: 'derived',
    label: 'Derived View',
    sanskrit: 'Prātibhāsika',
    description: 'Apparent reality - computed results',
    color: '#8b5cf6',       // Purple
    bgColor: '#ede9fe',
    icon: 'ph-eye'
  }
});

// ============================================================================
// Interpretation Active Banner
// ============================================================================

/**
 * Creates an "Interpretation Active" banner that shows when data is being
 * viewed through a definition layer (Adhyāsa prevention)
 */
class InterpretationActiveBanner {
  /**
   * @param {Object} options
   * @param {Object} options.definition - The active definition object
   * @param {HTMLElement} options.container - Container element
   * @param {Function} options.onViewRaw - Callback when "View raw" clicked
   * @param {Function} options.onChangeDefinition - Callback when "Change definition" clicked
   */
  constructor(options = {}) {
    this.definition = options.definition;
    this.container = options.container;
    this.onViewRaw = options.onViewRaw;
    this.onChangeDefinition = options.onChangeDefinition;
  }

  render() {
    if (!this.container || !this.definition) return;

    const def = this.definition;
    const operator = def.derivation?.operator || 'PROJECT';
    const symbol = def.derivation?.symbol || '→';
    const citation = def.source?.citation || 'Unknown source';
    const effectiveDate = def.validity?.from || '';
    const term = def.referent?.term || 'Unknown';

    this.container.innerHTML = `
      <div class="eo-interpretation-banner">
        <div class="banner-icon">
          <i class="ph ph-eye"></i>
        </div>
        <div class="banner-content">
          <div class="banner-title">
            <span class="viewing-label">Viewing through:</span>
            <span class="definition-name">${this._escapeHtml(term)}</span>
            <span class="operator-badge" style="background: ${this._getOperatorColor(operator)}">
              ${symbol} ${operator}
            </span>
          </div>
          <div class="banner-meta">
            <span class="citation">${this._escapeHtml(citation)}</span>
            ${effectiveDate ? `<span class="effective-date">Effective ${effectiveDate}</span>` : ''}
            ${def.epistemicStance?.confidence === 'low' ? `
              <span class="provisional-badge">Provisional</span>
            ` : ''}
          </div>
        </div>
        <div class="banner-actions">
          <button class="btn-sm btn-outline" id="view-raw-btn">
            <i class="ph ph-database"></i>
            View raw
          </button>
          <button class="btn-sm btn-outline" id="change-def-btn">
            <i class="ph ph-swap"></i>
            Change definition
          </button>
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  _attachEventListeners() {
    const viewRawBtn = this.container.querySelector('#view-raw-btn');
    const changeDefBtn = this.container.querySelector('#change-def-btn');

    if (viewRawBtn && this.onViewRaw) {
      viewRawBtn.addEventListener('click', () => this.onViewRaw());
    }

    if (changeDefBtn && this.onChangeDefinition) {
      changeDefBtn.addEventListener('click', () => this.onChangeDefinition());
    }
  }

  _getOperatorColor(operator) {
    const colors = {
      PROJECT: '#1a73e8',
      SCOPE: '#ea4335',
      EXTEND: '#34a853',
      COMPOSE: '#9c27b0',
      DERIVE: '#ff9800',
      OVERRIDE: '#f44336',
      CONTEST: '#e91e63',
      DEFER: '#607d8b'
    };
    return colors[operator] || '#607d8b';
  }

  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  hide() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// ============================================================================
// Scope Summary Card (Jahadajahallakṣaṇā)
// ============================================================================

/**
 * Displays a summary of what a definition retains and discards from its source.
 * Implements Jahadajahallakṣaṇā - partial identity visualization.
 */
class ScopeSummaryCard {
  /**
   * @param {Object} options
   * @param {Object} options.definition - The definition object
   * @param {HTMLElement} options.container - Container element
   * @param {boolean} options.expanded - Whether to show expanded view
   */
  constructor(options = {}) {
    this.definition = options.definition;
    this.container = options.container;
    this.expanded = options.expanded ?? false;
  }

  render() {
    if (!this.container || !this.definition) return;

    const def = this.definition;
    const operator = def.derivation?.operator || 'PROJECT';
    const symbol = def.derivation?.symbol || '→';
    const term = def.referent?.term || 'Unknown';
    const purpose = def.parameters?.purpose || '';

    // Get retains/discards from partialIdentity or fallback to parameters
    const retains = def.partialIdentity?.retains || [];
    const discards = def.partialIdentity?.discards || [];

    // Programs for scope
    const programs = def.jurisdiction?.programs || [];
    const geographic = def.jurisdiction?.geographic || '';

    const hasPartialIdentity = retains.length > 0 || discards.length > 0;

    this.container.innerHTML = `
      <div class="eo-scope-summary-card ${this.expanded ? 'expanded' : ''}">
        <div class="scope-header">
          <span class="scope-symbol" style="color: ${this._getOperatorColor(operator)}">${symbol}</span>
          <span class="scope-operator">${operator}:</span>
          <span class="scope-term">${this._escapeHtml(term)}</span>
          ${!this.expanded ? `
            <button class="btn-icon expand-btn" title="Show details">
              <i class="ph ph-caret-down"></i>
            </button>
          ` : ''}
        </div>

        ${purpose ? `
          <div class="scope-purpose">
            <span class="purpose-label">For the purpose of:</span>
            <span class="purpose-value">${this._escapeHtml(purpose)}</span>
          </div>
        ` : ''}

        ${hasPartialIdentity ? `
          <div class="scope-identity ${this.expanded ? 'visible' : ''}">
            ${retains.length > 0 ? `
              <div class="identity-section retains-section">
                <div class="section-label">
                  <span class="section-badge rd-retain">Retains</span>
                </div>
                <div class="section-items">
                  ${retains.map(r => `<span class="identity-chip retain">${this._escapeHtml(r)}</span>`).join('')}
                </div>
              </div>
            ` : ''}

            ${discards.length > 0 ? `
              <div class="identity-section discards-section">
                <div class="section-label">
                  <span class="section-badge rd-discard">Discards</span>
                </div>
                <div class="section-items">
                  ${discards.map(d => `<span class="identity-chip discard">${this._escapeHtml(d)}</span>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="scope-validity ${this.expanded ? 'visible' : ''}">
          ${programs.length > 0 ? `
            <div class="validity-item">
              <span class="validity-label">Valid for:</span>
              <span class="validity-value">${programs.map(p => this._escapeHtml(p)).join(', ')}</span>
            </div>
          ` : ''}
          ${geographic ? `
            <div class="validity-item">
              <span class="validity-label">Jurisdiction:</span>
              <span class="validity-value">${this._escapeHtml(geographic)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  _attachEventListeners() {
    const expandBtn = this.container.querySelector('.expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        this.expanded = !this.expanded;
        this.render();
      });
    }
  }

  _getOperatorColor(operator) {
    const colors = {
      PROJECT: '#1a73e8',
      SCOPE: '#ea4335',
      EXTEND: '#34a853',
      COMPOSE: '#9c27b0',
      DERIVE: '#ff9800',
      OVERRIDE: '#f44336',
      CONTEST: '#e91e63',
      DEFER: '#607d8b'
    };
    return colors[operator] || '#607d8b';
  }

  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// ============================================================================
// Provisional Interpretation Badge
// ============================================================================

/**
 * Shows a badge for provisional/low-confidence interpretations with caveats
 */
class ProvisionalBadge {
  /**
   * @param {Object} options
   * @param {string} options.confidence - Confidence level (high, medium, low)
   * @param {string} options.caveats - Caveats text
   * @param {HTMLElement} options.container - Container element
   */
  constructor(options = {}) {
    this.confidence = options.confidence || 'medium';
    this.caveats = options.caveats || '';
    this.container = options.container;
  }

  render() {
    if (!this.container) return;

    const isLow = this.confidence === 'low';
    const isMedium = this.confidence === 'medium';

    if (!isLow && !isMedium) {
      this.container.innerHTML = '';
      return;
    }

    this.container.innerHTML = `
      <div class="eo-provisional-badge ${isLow ? 'low' : 'medium'}">
        <div class="badge-header">
          <span class="badge-icon">${isLow ? '⚠' : 'ℹ'}</span>
          <span class="badge-title">
            ${isLow ? 'Provisional Interpretation' : 'Moderate Confidence'}
          </span>
        </div>
        ${this.caveats ? `
          <div class="badge-caveats">
            <p>${this._escapeHtml(this.caveats)}</p>
          </div>
        ` : ''}
        <div class="badge-footer">
          <span class="footer-text">
            ${isLow
              ? 'This interpretation may change. Use with caution.'
              : 'This interpretation is reasonable but not authoritative.'}
          </span>
        </div>
      </div>
    `;
  }

  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// ============================================================================
// Semantic Layer Indicator
// ============================================================================

/**
 * Shows which ontological layer the current view represents
 */
class SemanticLayerIndicator {
  /**
   * @param {Object} options
   * @param {string} options.layer - Layer type: 'raw', 'definition', 'derived'
   * @param {HTMLElement} options.container - Container element
   * @param {boolean} options.compact - Compact mode
   */
  constructor(options = {}) {
    this.layer = options.layer || 'raw';
    this.container = options.container;
    this.compact = options.compact ?? false;
  }

  render() {
    if (!this.container) return;

    const layerInfo = OntologicalLayers[this.layer.toUpperCase()] || OntologicalLayers.RAW;

    if (this.compact) {
      this.container.innerHTML = `
        <span class="eo-layer-indicator compact"
              style="background: ${layerInfo.bgColor}; color: ${layerInfo.color}"
              title="${layerInfo.description}">
          <i class="ph ${layerInfo.icon}"></i>
          <span>${layerInfo.label}</span>
        </span>
      `;
    } else {
      this.container.innerHTML = `
        <div class="eo-layer-indicator" style="border-color: ${layerInfo.color}">
          <div class="layer-header" style="background: ${layerInfo.bgColor}">
            <i class="ph ${layerInfo.icon}" style="color: ${layerInfo.color}"></i>
            <span class="layer-label" style="color: ${layerInfo.color}">${layerInfo.label}</span>
            <span class="layer-sanskrit">${layerInfo.sanskrit}</span>
          </div>
          <div class="layer-description">
            ${layerInfo.description}
          </div>
        </div>
      `;
    }
  }
}

// ============================================================================
// Definition Why Tooltip
// ============================================================================

/**
 * Shows contextual explanation for an applied definition
 */
class DefinitionWhyTooltip {
  /**
   * @param {Object} options
   * @param {Object} options.definition - The definition object
   * @param {HTMLElement} options.anchor - Anchor element to position near
   */
  constructor(options = {}) {
    this.definition = options.definition;
    this.anchor = options.anchor;
    this.element = null;
  }

  show() {
    if (!this.definition || !this.anchor) return;

    const def = this.definition;
    const operator = def.derivation?.operator || 'PROJECT';
    const symbol = def.derivation?.symbol || '→';
    const citation = def.source?.citation || 'Unknown';
    const retains = def.partialIdentity?.retains || [];
    const discards = def.partialIdentity?.discards || [];

    this.element = document.createElement('div');
    this.element.className = 'eo-definition-why-tooltip';
    this.element.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-title">Why this interpretation?</span>
        <button class="btn-icon tooltip-close">
          <i class="ph ph-x"></i>
        </button>
      </div>
      <div class="tooltip-body">
        <div class="tooltip-row">
          <span class="row-label">Defined per:</span>
          <span class="row-value">${this._escapeHtml(citation)}</span>
        </div>
        <div class="tooltip-row">
          <span class="row-label">Adoption:</span>
          <span class="row-value">${symbol} ${operator}</span>
        </div>
        ${retains.length > 0 ? `
          <div class="tooltip-row">
            <span class="row-label">Retains:</span>
            <span class="row-value">${retains.map(r => this._escapeHtml(r)).join(', ')}</span>
          </div>
        ` : ''}
        ${discards.length > 0 ? `
          <div class="tooltip-row">
            <span class="row-label">Discards:</span>
            <span class="row-value">${discards.map(d => this._escapeHtml(d)).join(', ')}</span>
          </div>
        ` : ''}
      </div>
      <div class="tooltip-footer">
        <a href="#" class="tooltip-link view-definition">View definition</a>
        <a href="#" class="tooltip-link view-source">View source</a>
      </div>
    `;

    // Position tooltip
    const rect = this.anchor.getBoundingClientRect();
    this.element.style.position = 'absolute';
    this.element.style.top = `${rect.bottom + 8}px`;
    this.element.style.left = `${rect.left}px`;

    document.body.appendChild(this.element);

    // Close handler
    this.element.querySelector('.tooltip-close').addEventListener('click', () => this.hide());

    // Click outside to close
    setTimeout(() => {
      document.addEventListener('click', this._onClickOutside);
    }, 0);
  }

  _onClickOutside = (e) => {
    if (this.element && !this.element.contains(e.target) && !this.anchor.contains(e.target)) {
      this.hide();
    }
  };

  hide() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    document.removeEventListener('click', this._onClickOutside);
  }

  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// ============================================================================
// CSS Styles
// ============================================================================

const avComponentStyles = `
/* Interpretation Active Banner */
.eo-interpretation-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: linear-gradient(90deg, #fef3c7 0%, #fef9c3 100%);
  border: 1px solid #f59e0b;
  border-radius: 8px;
  margin-bottom: 12px;
}

.eo-interpretation-banner .banner-icon {
  color: #f59e0b;
  font-size: 20px;
}

.eo-interpretation-banner .banner-content {
  flex: 1;
}

.eo-interpretation-banner .banner-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.eo-interpretation-banner .viewing-label {
  color: #92400e;
  font-size: 13px;
}

.eo-interpretation-banner .definition-name {
  font-weight: 600;
  color: #78350f;
}

.eo-interpretation-banner .operator-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  color: white;
  font-size: 11px;
  font-weight: 500;
}

.eo-interpretation-banner .banner-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #92400e;
  margin-top: 2px;
}

.eo-interpretation-banner .provisional-badge {
  background: #fef2f2;
  color: #b91c1c;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.eo-interpretation-banner .banner-actions {
  display: flex;
  gap: 8px;
}

/* Scope Summary Card */
.eo-scope-summary-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 16px;
}

.eo-scope-summary-card .scope-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.eo-scope-summary-card .scope-symbol {
  font-size: 18px;
  font-weight: bold;
}

.eo-scope-summary-card .scope-operator {
  color: #64748b;
  font-size: 13px;
}

.eo-scope-summary-card .scope-term {
  color: #1e293b;
}

.eo-scope-summary-card .scope-purpose {
  margin-top: 8px;
  padding: 8px 12px;
  background: #e0f2fe;
  border-radius: 6px;
}

.eo-scope-summary-card .purpose-label {
  color: #0369a1;
  font-size: 12px;
}

.eo-scope-summary-card .purpose-value {
  color: #0c4a6e;
  font-weight: 500;
}

.eo-scope-summary-card .scope-identity {
  margin-top: 12px;
  display: none;
}

.eo-scope-summary-card .scope-identity.visible,
.eo-scope-summary-card.expanded .scope-identity {
  display: block;
}

.eo-scope-summary-card .identity-section {
  margin-bottom: 8px;
}

.eo-scope-summary-card .section-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.eo-scope-summary-card .section-badge.rd-retain {
  background: #dcfce7;
  color: #166534;
}

.eo-scope-summary-card .section-badge.rd-discard {
  background: #fee2e2;
  color: #991b1b;
}

.eo-scope-summary-card .section-items {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.eo-scope-summary-card .identity-chip {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 12px;
}

.eo-scope-summary-card .identity-chip.retain {
  background: #f0fdf4;
  border: 1px solid #86efac;
  color: #166534;
}

.eo-scope-summary-card .identity-chip.discard {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  color: #991b1b;
}

.eo-scope-summary-card .scope-validity {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  display: none;
}

.eo-scope-summary-card .scope-validity.visible,
.eo-scope-summary-card.expanded .scope-validity {
  display: block;
}

.eo-scope-summary-card .validity-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 4px;
}

.eo-scope-summary-card .validity-label {
  color: #64748b;
}

.eo-scope-summary-card .validity-value {
  color: #1e293b;
}

/* Provisional Badge */
.eo-provisional-badge {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 12px;
}

.eo-provisional-badge.low {
  background: #fef2f2;
  border: 1px solid #fca5a5;
}

.eo-provisional-badge.medium {
  background: #fefce8;
  border: 1px solid #fde047;
}

.eo-provisional-badge .badge-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.eo-provisional-badge.low .badge-header {
  color: #b91c1c;
}

.eo-provisional-badge.medium .badge-header {
  color: #a16207;
}

.eo-provisional-badge .badge-caveats {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.5);
  border-radius: 4px;
  font-size: 13px;
}

.eo-provisional-badge .badge-footer {
  margin-top: 8px;
  font-size: 11px;
  color: #64748b;
}

/* Layer Indicator */
.eo-layer-indicator.compact {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.eo-layer-indicator:not(.compact) {
  border: 2px solid;
  border-radius: 8px;
  overflow: hidden;
}

.eo-layer-indicator .layer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}

.eo-layer-indicator .layer-label {
  font-weight: 600;
}

.eo-layer-indicator .layer-sanskrit {
  font-size: 11px;
  font-style: italic;
  opacity: 0.8;
}

.eo-layer-indicator .layer-description {
  padding: 8px 12px;
  font-size: 12px;
  color: #64748b;
}

/* Definition Why Tooltip */
.eo-definition-why-tooltip {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  width: 300px;
  z-index: 1000;
}

.eo-definition-why-tooltip .tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
}

.eo-definition-why-tooltip .tooltip-title {
  font-weight: 600;
  color: #1e293b;
}

.eo-definition-why-tooltip .tooltip-body {
  padding: 12px;
}

.eo-definition-why-tooltip .tooltip-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.eo-definition-why-tooltip .row-label {
  color: #64748b;
  min-width: 70px;
}

.eo-definition-why-tooltip .row-value {
  color: #1e293b;
}

.eo-definition-why-tooltip .tooltip-footer {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.eo-definition-why-tooltip .tooltip-link {
  font-size: 12px;
  color: #2563eb;
  text-decoration: none;
}

.eo-definition-why-tooltip .tooltip-link:hover {
  text-decoration: underline;
}

/* Semantic Humility Box (for definition builder) */
.semantic-humility-box {
  margin-top: 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
  border: 1px solid #c4b5fd;
  border-radius: 8px;
}

.semantic-humility-box .humility-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.semantic-humility-box .humility-icon {
  font-size: 18px;
}

.semantic-humility-box .humility-title {
  font-weight: 600;
  color: #6b21a8;
}

.semantic-humility-box .humility-text {
  font-size: 13px;
  color: #7c3aed;
  margin: 0;
  line-height: 1.5;
}

/* Caveats Box */
.caveats-box {
  transition: all 0.2s ease;
}

.caveats-box.caveats-required {
  animation: pulse-warning 2s infinite;
}

@keyframes pulse-warning {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.2); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1); }
}

.caveats-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #b91c1c;
  font-weight: 500;
}

.caveats-warning .warning-icon {
  font-size: 18px;
}

/* Purpose Box */
.purpose-box {
  margin-bottom: 16px;
}

.purpose-hint {
  font-size: 13px;
}

/* Retains/Discards Box */
.retains-discards-box {
  margin-bottom: 16px;
}

.retains-discards-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 500;
  color: #166534;
}

.rd-icon {
  font-size: 20px;
  font-weight: bold;
}

.rd-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-right: 6px;
}

.rd-badge.rd-retain {
  background: #dcfce7;
  color: #166534;
}

.rd-badge.rd-discard {
  background: #fee2e2;
  color: #991b1b;
}

.chip.chip-retain {
  background: #f0fdf4;
  border: 1px solid #86efac;
  color: #166534;
}

.chip.chip-discard {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  color: #991b1b;
}

/* Required markers */
.required-label {
  display: flex;
  align-items: center;
  gap: 4px;
}

.required-marker {
  color: #dc2626;
  font-weight: bold;
}

/* Highlight boxes */
.highlight-box.blue {
  background: #eff6ff;
  border: 1px solid #93c5fd;
}

.highlight-box.green {
  background: #f0fdf4;
  border: 1px solid #86efac;
}

.highlight-box.red {
  background: #fef2f2;
  border: 1px solid #fca5a5;
}

.highlight-box.gray {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
`;

// Inject styles
function injectAVComponentStyles() {
  if (document.getElementById('eo-av-component-styles')) return;

  const style = document.createElement('style');
  style.id = 'eo-av-component-styles';
  style.textContent = avComponentStyles;
  document.head.appendChild(style);
}

// Auto-inject on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAVComponentStyles);
  } else {
    injectAVComponentStyles();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Show interpretation active banner
 */
function showInterpretationBanner(definition, container, options = {}) {
  const banner = new InterpretationActiveBanner({
    definition,
    container,
    onViewRaw: options.onViewRaw,
    onChangeDefinition: options.onChangeDefinition
  });
  banner.render();
  return banner;
}

/**
 * Show scope summary card
 */
function showScopeSummary(definition, container, options = {}) {
  const card = new ScopeSummaryCard({
    definition,
    container,
    expanded: options.expanded
  });
  card.render();
  return card;
}

/**
 * Show provisional badge
 */
function showProvisionalBadge(confidence, caveats, container) {
  const badge = new ProvisionalBadge({ confidence, caveats, container });
  badge.render();
  return badge;
}

/**
 * Show layer indicator
 */
function showLayerIndicator(layer, container, options = {}) {
  const indicator = new SemanticLayerIndicator({
    layer,
    container,
    compact: options.compact
  });
  indicator.render();
  return indicator;
}

/**
 * Show definition why tooltip
 */
function showDefinitionWhy(definition, anchor) {
  const tooltip = new DefinitionWhyTooltip({ definition, anchor });
  tooltip.show();
  return tooltip;
}

// ============================================================================
// Export
// ============================================================================

window.EOAVComponents = {
  // Classes
  InterpretationActiveBanner,
  ScopeSummaryCard,
  ProvisionalBadge,
  SemanticLayerIndicator,
  DefinitionWhyTooltip,

  // Constants
  OntologicalLayers,

  // Factory functions
  showInterpretationBanner,
  showScopeSummary,
  showProvisionalBadge,
  showLayerIndicator,
  showDefinitionWhy,

  // Utilities
  injectAVComponentStyles
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.EOAVComponents;
}
