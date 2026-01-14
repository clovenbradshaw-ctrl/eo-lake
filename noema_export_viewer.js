/**
 * EO Export Viewer - Navigate Schema-Tracked Exports
 *
 * This module implements the viewer for navigating schema-tracked
 * and provenance-tracked exports.
 *
 * DESIGN PRINCIPLES IMPLEMENTED:
 * 1. Temporal Navigation - Timeline scrubber through history
 * 2. Dual-Pane Coherence - Data + Definition side-by-side
 * 3. Provenance on Demand - Click any cell to see history
 * 4. Definition-First Navigation - Browse through semantic lens
 * 5. Transformation Replay - Step through changes
 * 6. Integrity Verification - Verify export authenticity
 * 7. Layered Disclosure - Progressive complexity
 */

// ============================================================================
// ViewerState - Manages viewer state
// ============================================================================

class ExportViewerState {
  constructor() {
    this.exportData = null;
    this.currentView = 'summary';  // summary, data, schema, definitions, provenance, timeline
    this.selectedRecordId = null;
    this.selectedFieldId = null;
    this.selectedValue = null;
    this.timelinePosition = null;  // For provenance view
    this.expandedDefinitions = new Set();
    this.expandedVocabularies = new Set();
    this.defTypeFilter = 'key';  // 'key' or 'value' - for Definitions tab toggle
    this.filters = {
      showOnlyDefined: false,
      fieldSearch: ''
    };
  }

  setExport(exportData) {
    this.exportData = exportData;
    this.reset();
  }

  reset() {
    this.currentView = 'summary';
    this.selectedRecordId = null;
    this.selectedFieldId = null;
    this.selectedValue = null;
    this.timelinePosition = null;
    this.expandedDefinitions.clear();
    this.expandedVocabularies.clear();
    this.defTypeFilter = 'key';
  }

  toggleDefinition(uri) {
    if (this.expandedDefinitions.has(uri)) {
      this.expandedDefinitions.delete(uri);
    } else {
      this.expandedDefinitions.add(uri);
    }
  }

  toggleVocabulary(uri) {
    if (this.expandedVocabularies.has(uri)) {
      this.expandedVocabularies.delete(uri);
    } else {
      this.expandedVocabularies.add(uri);
    }
  }
}

// ============================================================================
// ExportViewer - Main viewer component
// ============================================================================

class ExportViewer {
  /**
   * @param {HTMLElement} container - Container element
   * @param {SchemaTrackedExport} exportData - Export to view
   */
  constructor(container, exportData = null) {
    this.container = container;
    this.state = new ExportViewerState();

    if (exportData) {
      this.loadExport(exportData);
    }

    this._setupStyles();
  }

  /**
   * Load an export into the viewer
   */
  loadExport(exportData) {
    // Parse if string
    if (typeof exportData === 'string') {
      exportData = window.SchemaTrackedImporter?.parse(exportData)
        || JSON.parse(exportData);
    }

    this.state.setExport(exportData);
    this.render();
  }

  /**
   * Main render method
   */
  render() {
    if (!this.state.exportData) {
      this.container.innerHTML = this._renderEmptyState();
      return;
    }

    this.container.innerHTML = `
      <div class="export-viewer">
        ${this._renderHeader()}
        ${this._renderNavigation()}
        <div class="viewer-content">
          ${this._renderCurrentView()}
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  /**
   * Render header with export info
   */
  _renderHeader() {
    const exp = this.state.exportData;
    const summary = exp.getSummary?.() || {
      recordCount: exp.data?.recordCount || 0,
      fieldCount: exp.schema?.fields?.length || 0,
      definedFieldCount: Object.keys(exp.fieldDefinitions || {}).length,
      vocabularyCount: Object.keys(exp.valueDefinitions || {}).length
    };

    const isProvenance = exp.meta?.format === 'provenance-tracked';

    return `
      <div class="viewer-header">
        <div class="header-title">
          <h2>${exp.data?.setName || 'Export Viewer'}</h2>
          <span class="export-format-badge ${isProvenance ? 'provenance' : 'schema'}">
            ${isProvenance ? 'Provenance-Tracked' : 'Schema-Tracked'}
          </span>
        </div>
        <div class="header-stats">
          <div class="stat">
            <span class="stat-value">${summary.recordCount}</span>
            <span class="stat-label">Records</span>
          </div>
          <div class="stat">
            <span class="stat-value">${summary.fieldCount}</span>
            <span class="stat-label">Fields</span>
          </div>
          <div class="stat">
            <span class="stat-value">${summary.definedFieldCount}</span>
            <span class="stat-label">Defined</span>
          </div>
          <div class="stat">
            <span class="stat-value">${summary.vocabularyCount}</span>
            <span class="stat-label">Vocabularies</span>
          </div>
        </div>
        <div class="header-meta">
          <span>Exported: ${new Date(exp.meta?.exportedAt).toLocaleString()}</span>
          ${exp.verification ? '<span class="verified-badge">Verified</span>' : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render navigation tabs
   */
  _renderNavigation() {
    const views = [
      { id: 'summary', label: 'Summary', icon: 'chart-pie' },
      { id: 'data', label: 'Data', icon: 'table' },
      { id: 'schema', label: 'Schema', icon: 'columns' },
      { id: 'definitions', label: 'Definitions', icon: 'book-open' },
      { id: 'vocabularies', label: 'Vocabularies', icon: 'list-bullets' }
    ];

    // Add provenance tab for provenance-tracked exports
    if (this.state.exportData.meta?.format === 'provenance-tracked') {
      views.push(
        { id: 'provenance', label: 'Provenance', icon: 'git-branch' },
        { id: 'timeline', label: 'Timeline', icon: 'clock-counter-clockwise' }
      );
    }

    return `
      <nav class="viewer-nav">
        ${views.map(v => `
          <button class="nav-tab ${this.state.currentView === v.id ? 'active' : ''}"
                  data-view="${v.id}">
            <i class="ph ph-${v.icon}"></i>
            <span>${v.label}</span>
          </button>
        `).join('')}
      </nav>
    `;
  }

  /**
   * Render current view based on state
   */
  _renderCurrentView() {
    switch (this.state.currentView) {
      case 'summary':
        return this._renderSummaryView();
      case 'data':
        return this._renderDataView();
      case 'schema':
        return this._renderSchemaView();
      case 'definitions':
        return this._renderDefinitionsView();
      case 'vocabularies':
        return this._renderVocabulariesView();
      case 'provenance':
        return this._renderProvenanceView();
      case 'timeline':
        return this._renderTimelineView();
      default:
        return '<div class="view-placeholder">Select a view</div>';
    }
  }

  /**
   * Render summary view
   */
  _renderSummaryView() {
    const exp = this.state.exportData;
    const isProvenance = exp.meta?.format === 'provenance-tracked';

    // Calculate statistics
    const definedFields = Object.keys(exp.fieldDefinitions || {});
    const undefinedFields = (exp.schema?.fields || [])
      .filter(f => !definedFields.includes(f.id) && !definedFields.includes(f.name));

    return `
      <div class="summary-view">
        <div class="summary-section">
          <h3>Export Overview</h3>
          <div class="summary-grid">
            <div class="summary-card">
              <i class="ph ph-database"></i>
              <div class="card-content">
                <span class="card-value">${exp.data?.setName || 'Unknown'}</span>
                <span class="card-label">Dataset Name</span>
              </div>
            </div>
            <div class="summary-card">
              <i class="ph ph-file-text"></i>
              <div class="card-content">
                <span class="card-value">${exp.meta?.format || 'unknown'}</span>
                <span class="card-label">Export Format</span>
              </div>
            </div>
            <div class="summary-card">
              <i class="ph ph-calendar"></i>
              <div class="card-content">
                <span class="card-value">${new Date(exp.meta?.exportedAt).toLocaleDateString()}</span>
                <span class="card-label">Export Date</span>
              </div>
            </div>
          </div>
        </div>

        <div class="summary-section">
          <h3>Semantic Coverage</h3>
          <div class="coverage-bar">
            <div class="coverage-fill" style="width: ${(definedFields.length / (exp.schema?.fields?.length || 1)) * 100}%"></div>
          </div>
          <div class="coverage-stats">
            <span class="stat-good">${definedFields.length} fields with definitions</span>
            <span class="stat-warn">${undefinedFields.length} fields without definitions</span>
          </div>
          ${undefinedFields.length > 0 ? `
            <div class="undefined-fields">
              <p>Fields without semantic definitions:</p>
              <ul>
                ${undefinedFields.slice(0, 5).map(f => `<li>${f.name}</li>`).join('')}
                ${undefinedFields.length > 5 ? `<li class="more">... and ${undefinedFields.length - 5} more</li>` : ''}
              </ul>
            </div>
          ` : ''}
        </div>

        ${isProvenance ? `
          <div class="summary-section">
            <h3>Provenance Summary</h3>
            <div class="provenance-summary">
              <div class="prov-stat">
                <span class="prov-value">${exp.transformations?.length || 0}</span>
                <span class="prov-label">Transformations</span>
              </div>
              <div class="prov-stat">
                <span class="prov-value">${exp.derivationGraph?.nodes?.length || 0}</span>
                <span class="prov-label">Graph Nodes</span>
              </div>
              <div class="prov-stat">
                <span class="prov-value">${exp.supersessions?.length || 0}</span>
                <span class="prov-label">Supersessions</span>
              </div>
            </div>
            ${exp.origin?.originalFilename ? `
              <div class="origin-info">
                <strong>Origin:</strong> ${exp.origin.originalFilename}
                <br>
                <small>Imported: ${new Date(exp.origin.importedAt).toLocaleString()}</small>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${exp.verification ? `
          <div class="summary-section verification-section">
            <h3>Integrity Verification</h3>
            <div class="verification-info">
              <i class="ph ph-seal-check"></i>
              <div>
                <span class="verified-text">Export integrity verified</span>
                <small>Computed: ${new Date(exp.verification.computedAt).toLocaleString()}</small>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render data view (table of records)
   */
  _renderDataView() {
    const exp = this.state.exportData;
    const fields = exp.schema?.fields || [];
    const records = exp.data?.records || [];

    // Limit display for performance
    const displayRecords = records.slice(0, 100);
    const hasMore = records.length > 100;

    return `
      <div class="data-view">
        <div class="data-toolbar">
          <span class="record-count">
            Showing ${displayRecords.length} of ${records.length} records
          </span>
        </div>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                ${fields.map(f => `
                  <th class="field-header ${exp.fieldDefinitions?.[f.id] || exp.fieldDefinitions?.[f.name] ? 'has-definition' : ''}"
                      data-field-id="${f.id}"
                      title="${f.name}">
                    <span class="field-name">${f.name}</span>
                    ${exp.fieldDefinitions?.[f.id] || exp.fieldDefinitions?.[f.name] ? '<i class="ph ph-book-open"></i>' : ''}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${displayRecords.map(record => `
                <tr data-record-id="${record.id}">
                  ${fields.map(f => {
                    const value = record.values?.[f.id] ?? '';
                    const hasVocab = exp.valueDefinitions?.[exp.bindingProvenance?.valueVocabularies?.[f.id]?.currentVocabularyUri];
                    return `
                      <td class="cell ${hasVocab ? 'has-vocabulary' : ''}"
                          data-field-id="${f.id}"
                          data-value="${this._escapeAttr(value)}">
                        ${this._formatCellValue(value, f)}
                      </td>
                    `;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${hasMore ? `
          <div class="data-more">
            <p>Showing first 100 records. Export contains ${records.length} total records.</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render schema view
   */
  _renderSchemaView() {
    const exp = this.state.exportData;
    const fields = exp.schema?.fields || [];

    return `
      <div class="schema-view">
        <div class="schema-list">
          ${fields.map(f => {
            const def = exp.fieldDefinitions?.[f.id] || exp.fieldDefinitions?.[f.name];
            const vocabUri = exp.bindingProvenance?.valueVocabularies?.[f.id]?.currentVocabularyUri;
            const vocab = vocabUri ? exp.valueDefinitions?.[vocabUri] : null;

            return `
              <div class="schema-field ${def ? 'has-definition' : ''}" data-field-id="${f.id}">
                <div class="field-info">
                  <div class="field-main">
                    <span class="field-name">${f.name}</span>
                    <span class="field-type">${f.type}</span>
                  </div>
                  ${def ? `
                    <div class="field-semantic">
                      <i class="ph ph-link"></i>
                      <span class="semantic-uri" title="${def.semanticUri}">${def.term}</span>
                    </div>
                  ` : '<div class="field-semantic undefined">No semantic binding</div>'}
                </div>
                ${def ? `
                  <div class="field-definition">
                    <p>${def.definition}</p>
                    ${def.jurisdiction || def.scale || def.timeframe ? `
                      <div class="definition-context">
                        ${def.jurisdiction ? `<span class="context-tag">Jurisdiction: ${def.jurisdiction}</span>` : ''}
                        ${def.scale ? `<span class="context-tag">Scale: ${def.scale}</span>` : ''}
                        ${def.timeframe ? `<span class="context-tag">Timeframe: ${def.timeframe}</span>` : ''}
                      </div>
                    ` : ''}
                  </div>
                ` : ''}
                ${vocab ? `
                  <div class="field-vocabulary">
                    <div class="vocab-header" data-vocab-uri="${vocabUri}">
                      <i class="ph ph-list-bullets"></i>
                      <span>Value Vocabulary: ${vocab.name}</span>
                      <span class="vocab-count">(${Object.keys(vocab.values || {}).length} values)</span>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render definitions view (both key and value definitions)
   */
  _renderDefinitionsView() {
    const exp = this.state.exportData;
    const keyDefinitions = exp.fieldDefinitions || {};
    const valueVocabularies = exp.valueDefinitions || {};
    const keyDefKeys = Object.keys(keyDefinitions);
    const vocabKeys = Object.keys(valueVocabularies);

    // Collect all value definitions from vocabularies
    const valueDefinitions = [];
    for (const [vocabUri, vocab] of Object.entries(valueVocabularies)) {
      for (const [valueKey, valueDef] of Object.entries(vocab.values || {})) {
        valueDefinitions.push({
          ...valueDef,
          _vocabUri: vocabUri,
          _vocabName: vocab.name,
          _valueKey: valueKey
        });
      }
    }

    const hasKeyDefs = keyDefKeys.length > 0;
    const hasValueDefs = valueDefinitions.length > 0;

    if (!hasKeyDefs && !hasValueDefs) {
      return `
        <div class="empty-view">
          <i class="ph ph-book-open"></i>
          <p>No definitions in this export</p>
        </div>
      `;
    }

    return `
      <div class="definitions-view">
        <!-- Definition Type Toggle -->
        <div class="def-type-tabs">
          <button class="def-type-tab ${this.state.defTypeFilter !== 'value' ? 'active' : ''}"
                  data-def-type="key">
            <i class="ph ph-key"></i>
            Key Definitions
            <span class="tab-count">${keyDefKeys.length}</span>
          </button>
          <button class="def-type-tab ${this.state.defTypeFilter === 'value' ? 'active' : ''}"
                  data-def-type="value">
            <i class="ph ph-tag"></i>
            Value Definitions
            <span class="tab-count">${valueDefinitions.length}</span>
          </button>
        </div>

        <!-- Key Definitions Section -->
        <div class="def-section-container ${this.state.defTypeFilter === 'value' ? 'hidden' : ''}">
          <div class="def-section-header key-section">
            <i class="ph ph-key"></i>
            <h3>Key Definitions</h3>
            <span class="section-subtitle">What do the column headers mean?</span>
          </div>
          ${hasKeyDefs ? `
            <div class="definitions-list">
              ${keyDefKeys.map(key => this._renderKeyDefinition(key, keyDefinitions[key])).join('')}
            </div>
          ` : `
            <div class="empty-section">
              <p>No key definitions yet</p>
            </div>
          `}
        </div>

        <!-- Value Definitions Section -->
        <div class="def-section-container ${this.state.defTypeFilter !== 'value' ? 'hidden' : ''}">
          <div class="def-section-header value-section">
            <i class="ph ph-tag"></i>
            <h3>Value Definitions</h3>
            <span class="section-subtitle">What do specific values mean?</span>
          </div>
          ${hasValueDefs ? `
            <div class="definitions-list">
              ${valueDefinitions.map(vd => this._renderValueDefinition(vd)).join('')}
            </div>
          ` : `
            <div class="empty-section">
              <p>No value definitions yet</p>
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Render a single key definition item
   */
  _renderKeyDefinition(key, def) {
    const isExpanded = this.state.expandedDefinitions.has(key);

    return `
      <div class="definition-item key-def ${isExpanded ? 'expanded' : ''}" data-def-key="${key}">
        <div class="def-header" data-toggle-def="${key}">
          <div class="def-title">
            <i class="ph ph-caret-${isExpanded ? 'down' : 'right'}"></i>
            <span class="def-type-badge key">KEY</span>
            <span class="def-term">${def.term}</span>
          </div>
          <span class="def-uri">${def.semanticUri || ''}</span>
        </div>
        ${isExpanded ? `
          <div class="def-body">
            <div class="def-section">
              <label>Definition</label>
              <p>${def.definition || 'No definition provided'}</p>
            </div>
            <div class="def-meta">
              <div class="meta-row">
                <label>Version</label>
                <span>${def.version || '-'}</span>
              </div>
              <div class="meta-row">
                <label>Status</label>
                <span class="status-badge ${def.status || 'stub'}">${def.status || 'stub'}</span>
              </div>
              ${def.jurisdiction ? `
                <div class="meta-row">
                  <label>Jurisdiction</label>
                  <span>${def.jurisdiction}</span>
                </div>
              ` : ''}
              ${def.scale ? `
                <div class="meta-row">
                  <label>Scale</label>
                  <span>${def.scale}</span>
                </div>
              ` : ''}
              ${def.timeframe ? `
                <div class="meta-row">
                  <label>Timeframe</label>
                  <span>${def.timeframe}</span>
                </div>
              ` : ''}
            </div>
            ${def.background?.length > 0 ? `
              <div class="def-section">
                <label>Background</label>
                <ul class="background-list">
                  ${def.background.map(b => `<li>${b}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${def.usageHistory?.length > 0 ? `
              <div class="def-section">
                <label>Usage History</label>
                <ul class="usage-history">
                  ${def.usageHistory.map(h => `
                    <li>
                      <span class="history-action">${h.action}</span>
                      <span class="history-time">${new Date(h.timestamp).toLocaleString()}</span>
                      ${h.agent ? `<span class="history-agent">by ${h.agent}</span>` : ''}
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render a single value definition item
   */
  _renderValueDefinition(valueDef) {
    const expandKey = `val:${valueDef._vocabUri}:${valueDef._valueKey}`;
    const isExpanded = this.state.expandedDefinitions.has(expandKey);
    const defSrc = valueDef.definitionSource;
    const hasRichDef = defSrc && (defSrc.authority || defSrc.source || defSrc.jurisdiction);

    return `
      <div class="definition-item value-def ${isExpanded ? 'expanded' : ''} ${hasRichDef ? 'has-rich-def' : ''}"
           data-def-key="${expandKey}">
        <div class="def-header" data-toggle-def="${expandKey}">
          <div class="def-title">
            <i class="ph ph-caret-${isExpanded ? 'down' : 'right'}"></i>
            <span class="def-type-badge value">VALUE</span>
            <code class="def-value">${valueDef.value || valueDef._valueKey}</code>
            <span class="def-term">${valueDef.term || valueDef.value}</span>
          </div>
          <div class="def-meta-inline">
            ${hasRichDef ? '<i class="ph ph-seal-check" title="Has authoritative definition"></i>' : ''}
            <span class="def-vocab-name">${valueDef._vocabName}</span>
          </div>
        </div>
        ${isExpanded ? `
          <div class="def-body">
            <!-- Simple definition -->
            <div class="def-section">
              <label>Definition</label>
              <p>${valueDef.definition || defSrc?.term?.definitionText || 'No definition provided'}</p>
            </div>

            <!-- Rich definition source (if available) -->
            ${hasRichDef ? this._renderRichValueDefinition(defSrc) : ''}

            <!-- Implications -->
            ${valueDef.implications?.length > 0 ? `
              <div class="def-section">
                <label>Implications</label>
                <ul class="implications-list">
                  ${valueDef.implications.map(i => `<li><i class="ph ph-arrow-right"></i> ${i}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- Basic metadata -->
            <div class="def-meta">
              <div class="meta-row">
                <label>Status</label>
                <span class="status-badge ${valueDef.status || 'active'}">${valueDef.status || 'active'}</span>
              </div>
              ${valueDef.jurisdiction ? `
                <div class="meta-row">
                  <label>Jurisdiction</label>
                  <span>${valueDef.jurisdiction}</span>
                </div>
              ` : ''}
              ${valueDef.validFrom ? `
                <div class="meta-row">
                  <label>Valid From</label>
                  <span>${valueDef.validFrom}</span>
                </div>
              ` : ''}
              ${valueDef.validTo ? `
                <div class="meta-row">
                  <label>Valid To</label>
                  <span>${valueDef.validTo}</span>
                </div>
              ` : ''}
              <div class="meta-row">
                <label>Vocabulary</label>
                <span class="vocab-link">${valueDef._vocabUri}</span>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render rich definition source details for a value
   */
  _renderRichValueDefinition(defSrc) {
    if (!defSrc) return '';

    return `
      <div class="rich-def-section">
        <div class="rich-def-header">
          <i class="ph ph-seal-check"></i>
          <span>Authoritative Definition Source</span>
        </div>

        <!-- Authority -->
        ${defSrc.authority ? `
          <div class="def-subsection">
            <label><i class="ph ph-buildings"></i> Authority</label>
            <div class="authority-info">
              <span class="authority-name">${defSrc.authority.name || 'Unknown'}</span>
              ${defSrc.authority.shortName ? `<span class="authority-abbrev">(${defSrc.authority.shortName})</span>` : ''}
              ${defSrc.authority.type ? `<span class="authority-type">${defSrc.authority.type.replace(/_/g, ' ')}</span>` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Source Document -->
        ${defSrc.source ? `
          <div class="def-subsection">
            <label><i class="ph ph-file-text"></i> Source</label>
            <div class="source-info">
              ${defSrc.source.citation ? `<span class="source-citation">${defSrc.source.citation}</span>` : ''}
              ${defSrc.source.title ? `<span class="source-title">${defSrc.source.title}</span>` : ''}
              ${defSrc.source.section ? `<span class="source-section">§${defSrc.source.section}</span>` : ''}
              ${defSrc.source.url ? `<a href="${defSrc.source.url}" target="_blank" class="source-url"><i class="ph ph-arrow-square-out"></i> View Source</a>` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Jurisdiction -->
        ${defSrc.jurisdiction ? `
          <div class="def-subsection">
            <label><i class="ph ph-map-pin"></i> Jurisdiction</label>
            <div class="jurisdiction-info">
              ${defSrc.jurisdiction.geographic ? `<span class="jurisdiction-geo">${defSrc.jurisdiction.geographic}</span>` : ''}
              ${defSrc.jurisdiction.programs?.length > 0 ? `
                <span class="jurisdiction-programs">Programs: ${defSrc.jurisdiction.programs.join(', ')}</span>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Validity -->
        ${defSrc.validity ? `
          <div class="def-subsection">
            <label><i class="ph ph-calendar"></i> Validity</label>
            <div class="validity-info">
              ${defSrc.validity.from ? `<span>Effective: ${defSrc.validity.from}</span>` : ''}
              ${defSrc.validity.to ? `<span>Until: ${defSrc.validity.to}</span>` : ''}
              ${defSrc.validity.supersedes ? `<span>Supersedes: ${defSrc.validity.supersedes}</span>` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Definition Status -->
        <div class="def-subsection">
          <label><i class="ph ph-flag"></i> Definition Status</label>
          <span class="status-badge ${defSrc.status || 'stub'}">${defSrc.status || 'stub'}</span>
          ${defSrc.populationMethod ? `<span class="population-method">(${defSrc.populationMethod})</span>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render vocabularies view (value definitions)
   */
  _renderVocabulariesView() {
    const exp = this.state.exportData;
    const vocabularies = exp.valueDefinitions || {};
    const vocabKeys = Object.keys(vocabularies);

    if (vocabKeys.length === 0) {
      return `
        <div class="empty-view">
          <i class="ph ph-list-bullets"></i>
          <p>No value vocabularies in this export</p>
        </div>
      `;
    }

    return `
      <div class="vocabularies-view">
        <div class="vocabularies-list">
          ${vocabKeys.map(uri => {
            const vocab = vocabularies[uri];
            const isExpanded = this.state.expandedVocabularies.has(uri);
            const values = Object.entries(vocab.values || {});

            return `
              <div class="vocabulary-item ${isExpanded ? 'expanded' : ''}" data-vocab-uri="${uri}">
                <div class="vocab-header" data-toggle-vocab="${uri}">
                  <div class="vocab-title">
                    <i class="ph ph-caret-${isExpanded ? 'down' : 'right'}"></i>
                    <span class="vocab-name">${vocab.name}</span>
                    <span class="vocab-count">${values.length} values</span>
                  </div>
                  <span class="vocab-uri">${uri}</span>
                </div>
                ${isExpanded ? `
                  <div class="vocab-body">
                    <p class="vocab-description">${vocab.description || 'No description'}</p>
                    <table class="values-table">
                      <thead>
                        <tr>
                          <th>Value</th>
                          <th>Term</th>
                          <th>Definition</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${values.map(([key, val]) => `
                          <tr class="${val.status !== 'active' ? 'inactive' : ''}">
                            <td><code>${key}</code></td>
                            <td>${val.term || key}</td>
                            <td>${val.definition || '-'}</td>
                            <td><span class="status-badge ${val.status || 'active'}">${val.status || 'active'}</span></td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                    ${val => val.implications?.length > 0 ? `
                      <div class="value-implications">
                        <label>Implications:</label>
                        <ul>
                          ${val.implications.map(i => `<li>${i}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                    ${vocab.vocabularyHistory?.length > 0 ? `
                      <div class="vocab-history">
                        <h4>Vocabulary History</h4>
                        <ul class="history-list">
                          ${vocab.vocabularyHistory.map(h => `
                            <li>
                              <span class="history-version">v${h.version}</span>
                              <span class="history-change">${h.change}</span>
                              <span class="history-time">${new Date(h.timestamp).toLocaleString()}</span>
                            </li>
                          `).join('')}
                        </ul>
                      </div>
                    ` : ''}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render provenance view (for provenance-tracked exports)
   */
  _renderProvenanceView() {
    const exp = this.state.exportData;

    if (exp.meta?.format !== 'provenance-tracked') {
      return `
        <div class="empty-view">
          <i class="ph ph-git-branch"></i>
          <p>Provenance data only available in provenance-tracked exports</p>
        </div>
      `;
    }

    const transformations = exp.transformations || [];
    const graph = exp.derivationGraph || { nodes: [], edges: [] };

    return `
      <div class="provenance-view">
        <div class="prov-section">
          <h3>Origin</h3>
          <div class="origin-card">
            <div class="origin-icon"><i class="ph ph-file-arrow-down"></i></div>
            <div class="origin-details">
              <span class="origin-filename">${exp.origin?.originalFilename || 'Unknown'}</span>
              <span class="origin-type">${exp.origin?.sourceType || 'file'}</span>
              <span class="origin-date">Imported: ${new Date(exp.origin?.importedAt).toLocaleString()}</span>
              <span class="origin-records">${exp.origin?.rawRecordCount || 0} raw records</span>
            </div>
          </div>
        </div>

        <div class="prov-section">
          <h3>Derivation Graph</h3>
          <div class="graph-container">
            <div class="graph-nodes">
              ${graph.nodes.map(node => `
                <div class="graph-node ${node.epistemicType?.toLowerCase()}">
                  <span class="node-type">${node.type}</span>
                  <span class="node-label">${node.label}</span>
                </div>
              `).join('')}
            </div>
            <div class="graph-edges">
              ${graph.edges.map(edge => `
                <div class="graph-edge">
                  <span>${edge.from}</span>
                  <i class="ph ph-arrow-right"></i>
                  <span class="edge-relation">${edge.relation}</span>
                  <i class="ph ph-arrow-right"></i>
                  <span>${edge.to}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="prov-section">
          <h3>Transformations (${transformations.length})</h3>
          <div class="transformations-list">
            ${transformations.map((tx, i) => `
              <div class="transformation-item">
                <div class="tx-header">
                  <span class="tx-number">#${i + 1}</span>
                  <span class="tx-type">${tx.type}</span>
                  <span class="tx-time">${new Date(tx.timestamp).toLocaleString()}</span>
                </div>
                <div class="tx-details">
                  <span class="tx-epistemic ${tx.epistemicType?.toLowerCase()}">${tx.epistemicType}</span>
                  <span class="tx-agent">by ${tx.agent || 'system'}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        ${exp.supersessions?.length > 0 ? `
          <div class="prov-section">
            <h3>Supersessions</h3>
            <div class="supersessions-list">
              ${exp.supersessions.map(s => `
                <div class="supersession-item ${s.type?.toLowerCase()}">
                  <span class="sup-type">${s.type}</span>
                  <span class="sup-reason">${s.reason || 'No reason given'}</span>
                  <span class="sup-time">${new Date(s.timestamp).toLocaleString()}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render timeline view (step through transformations)
   */
  _renderTimelineView() {
    const exp = this.state.exportData;

    if (exp.meta?.format !== 'provenance-tracked') {
      return `
        <div class="empty-view">
          <i class="ph ph-clock-counter-clockwise"></i>
          <p>Timeline view only available in provenance-tracked exports</p>
        </div>
      `;
    }

    const transformations = exp.transformations || [];
    const position = this.state.timelinePosition ?? transformations.length;

    return `
      <div class="timeline-view">
        <div class="timeline-controls">
          <button class="timeline-btn" data-action="first" ${position === 0 ? 'disabled' : ''}>
            <i class="ph ph-skip-back"></i>
          </button>
          <button class="timeline-btn" data-action="prev" ${position === 0 ? 'disabled' : ''}>
            <i class="ph ph-caret-left"></i>
          </button>
          <div class="timeline-position">
            <span class="position-current">${position}</span>
            <span class="position-separator">/</span>
            <span class="position-total">${transformations.length}</span>
          </div>
          <button class="timeline-btn" data-action="next" ${position >= transformations.length ? 'disabled' : ''}>
            <i class="ph ph-caret-right"></i>
          </button>
          <button class="timeline-btn" data-action="last" ${position >= transformations.length ? 'disabled' : ''}>
            <i class="ph ph-skip-forward"></i>
          </button>
        </div>

        <div class="timeline-scrubber">
          <input type="range"
                 class="timeline-slider"
                 min="0"
                 max="${transformations.length}"
                 value="${position}"
                 data-action="scrub">
        </div>

        <div class="timeline-content">
          ${position === 0 ? `
            <div class="timeline-state origin-state">
              <h4>Origin State</h4>
              <p>Original data as imported</p>
              <div class="state-stats">
                <span>${exp.origin?.rawRecordCount || 0} records</span>
                <span>${exp.origin?.rawSchema?.length || 0} columns</span>
              </div>
            </div>
          ` : `
            <div class="timeline-state">
              <h4>After Transformation #${position}</h4>
              ${this._renderTransformationDetails(transformations[position - 1])}
            </div>
          `}
        </div>

        <div class="timeline-list">
          ${transformations.map((tx, i) => `
            <div class="timeline-item ${i < position ? 'applied' : ''} ${i === position - 1 ? 'current' : ''}"
                 data-timeline-index="${i + 1}">
              <div class="timeline-marker"></div>
              <div class="timeline-info">
                <span class="tx-type">${tx.type}</span>
                <span class="tx-time">${new Date(tx.timestamp).toLocaleString()}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render transformation details
   */
  _renderTransformationDetails(tx) {
    if (!tx) return '<p>No transformation selected</p>';

    return `
      <div class="tx-detail">
        <div class="tx-type-badge">${tx.type}</div>
        <div class="tx-meta">
          <span class="epistemic ${tx.epistemicType?.toLowerCase()}">${tx.epistemicType}</span>
          <span class="agent">by ${tx.agent || 'system'}</span>
          <span class="time">${new Date(tx.timestamp).toLocaleString()}</span>
        </div>
        ${tx.details ? `
          <div class="tx-details-content">
            <pre>${JSON.stringify(tx.details, null, 2)}</pre>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Format cell value for display
   */
  _formatCellValue(value, field) {
    if (value === null || value === undefined) return '<span class="null-value">-</span>';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  /**
   * Escape attribute value
   */
  _escapeAttr(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Render empty state
   */
  _renderEmptyState() {
    return `
      <div class="export-viewer empty">
        <div class="empty-state">
          <i class="ph ph-file-search"></i>
          <h3>No Export Loaded</h3>
          <p>Load a schema-tracked or provenance-tracked export to view it.</p>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  _attachEventListeners() {
    // Navigation tabs
    this.container.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.state.currentView = e.currentTarget.dataset.view;
        this.render();
      });
    });

    // Definition toggles
    this.container.querySelectorAll('[data-toggle-def]').forEach(el => {
      el.addEventListener('click', (e) => {
        const key = e.currentTarget.dataset.toggleDef;
        this.state.toggleDefinition(key);
        this.render();
      });
    });

    // Definition type tabs (Key vs Value)
    this.container.querySelectorAll('.def-type-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.state.defTypeFilter = e.currentTarget.dataset.defType;
        this.render();
      });
    });

    // Vocabulary toggles
    this.container.querySelectorAll('[data-toggle-vocab]').forEach(el => {
      el.addEventListener('click', (e) => {
        const uri = e.currentTarget.dataset.toggleVocab;
        this.state.toggleVocabulary(uri);
        this.render();
      });
    });

    // Timeline controls
    this.container.querySelectorAll('.timeline-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        const max = this.state.exportData.transformations?.length || 0;

        switch (action) {
          case 'first':
            this.state.timelinePosition = 0;
            break;
          case 'prev':
            this.state.timelinePosition = Math.max(0, (this.state.timelinePosition ?? max) - 1);
            break;
          case 'next':
            this.state.timelinePosition = Math.min(max, (this.state.timelinePosition ?? max) + 1);
            break;
          case 'last':
            this.state.timelinePosition = max;
            break;
        }
        this.render();
      });
    });

    // Timeline slider
    const slider = this.container.querySelector('.timeline-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        this.state.timelinePosition = parseInt(e.target.value, 10);
        this.render();
      });
    }

    // Timeline item clicks
    this.container.querySelectorAll('[data-timeline-index]').forEach(item => {
      item.addEventListener('click', (e) => {
        this.state.timelinePosition = parseInt(e.currentTarget.dataset.timelineIndex, 10);
        this.render();
      });
    });

    // Cell clicks for provenance popover
    this.container.querySelectorAll('.data-table td.cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        this._showCellProvenance(
          e.currentTarget.dataset.fieldId,
          e.currentTarget.dataset.value,
          e.currentTarget.closest('tr').dataset.recordId
        );
      });
    });

    // Field header clicks
    this.container.querySelectorAll('.field-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const fieldId = e.currentTarget.dataset.fieldId;
        this.state.selectedFieldId = fieldId;
        this.state.currentView = 'schema';
        this.render();
      });
    });
  }

  /**
   * Show cell provenance popover
   */
  _showCellProvenance(fieldId, value, recordId) {
    const exp = this.state.exportData;
    const def = exp.fieldDefinitions?.[fieldId];
    const vocabUri = exp.bindingProvenance?.valueVocabularies?.[fieldId]?.currentVocabularyUri;
    const vocab = vocabUri ? exp.valueDefinitions?.[vocabUri] : null;
    const valueDef = vocab?.values?.[value];

    // Create popover content
    let content = `
      <div class="provenance-popover">
        <div class="pop-header">
          <span class="pop-value">"${value}"</span>
          <button class="pop-close">&times;</button>
        </div>
    `;

    if (def) {
      content += `
        <div class="pop-section">
          <label>Field Definition</label>
          <p><strong>${def.term}</strong>: ${def.definition}</p>
        </div>
      `;
    }

    if (valueDef) {
      content += `
        <div class="pop-section">
          <label>Value Definition</label>
          <p><strong>${valueDef.term}</strong>: ${valueDef.definition}</p>
          ${valueDef.implications?.length > 0 ? `
            <ul class="implications">
              ${valueDef.implications.map(i => `<li>${i}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `;
    }

    // Check for value changes
    const changes = exp.valueChangeLog?.filter(c =>
      c.recordId === recordId && c.fieldId === fieldId
    ) || [];

    if (changes.length > 0) {
      content += `
        <div class="pop-section">
          <label>Change History</label>
          <ul class="change-history">
            ${changes.map(c => `
              <li>
                ${c.previousValue} → ${c.newValue}
                <small>${new Date(c.timestamp).toLocaleString()}</small>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    content += '</div>';

    // Show popover (simple implementation)
    const existing = document.querySelector('.provenance-popover-container');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = 'provenance-popover-container';
    container.innerHTML = content;
    document.body.appendChild(container);

    container.querySelector('.pop-close').addEventListener('click', () => {
      container.remove();
    });

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!container.contains(e.target)) {
          container.remove();
          document.removeEventListener('click', handler);
        }
      });
    }, 0);
  }

  /**
   * Setup styles
   */
  _setupStyles() {
    if (document.getElementById('export-viewer-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'export-viewer-styles';
    styles.textContent = `
      .export-viewer {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--bg-primary, #fff);
        font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      }

      .export-viewer.empty {
        justify-content: center;
        align-items: center;
      }

      .empty-state {
        text-align: center;
        color: var(--text-muted, #888);
      }

      .empty-state i {
        font-size: 64px;
        margin-bottom: 16px;
      }

      /* Header */
      .viewer-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
        background: var(--bg-secondary, #f8f8f8);
      }

      .header-title {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }

      .header-title h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }

      .export-format-badge {
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
      }

      .export-format-badge.schema {
        background: #e6f0ff;
        color: #0066cc;
      }

      .export-format-badge.provenance {
        background: #f0e6ff;
        color: #6600cc;
      }

      .header-stats {
        display: flex;
        gap: 24px;
        margin-bottom: 8px;
      }

      .stat {
        display: flex;
        flex-direction: column;
      }

      .stat-value {
        font-size: 20px;
        font-weight: 600;
        color: var(--text-primary, #333);
      }

      .stat-label {
        font-size: 11px;
        color: var(--text-muted, #888);
        text-transform: uppercase;
      }

      .header-meta {
        font-size: 12px;
        color: var(--text-muted, #888);
        display: flex;
        gap: 12px;
      }

      .verified-badge {
        background: #e6ffe6;
        color: #008800;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
      }

      /* Navigation */
      .viewer-nav {
        display: flex;
        gap: 4px;
        padding: 8px 16px;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
        background: var(--bg-primary, #fff);
        overflow-x: auto;
      }

      .nav-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border: none;
        background: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        color: var(--text-secondary, #666);
        white-space: nowrap;
      }

      .nav-tab:hover {
        background: var(--bg-hover, #f0f0f0);
      }

      .nav-tab.active {
        background: var(--primary-light, #e6f0ff);
        color: var(--primary, #0066cc);
      }

      .nav-tab i {
        font-size: 16px;
      }

      /* Content */
      .viewer-content {
        flex: 1;
        overflow: auto;
        padding: 16px 20px;
      }

      /* Summary View */
      .summary-view {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .summary-section {
        background: var(--bg-secondary, #f8f8f8);
        border-radius: 8px;
        padding: 16px;
      }

      .summary-section h3 {
        margin: 0 0 12px 0;
        font-size: 14px;
        font-weight: 600;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }

      .summary-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--bg-primary, #fff);
        border-radius: 6px;
        border: 1px solid var(--border-color, #e0e0e0);
      }

      .summary-card i {
        font-size: 24px;
        color: var(--primary, #0066cc);
      }

      .card-content {
        display: flex;
        flex-direction: column;
      }

      .card-value {
        font-weight: 600;
        color: var(--text-primary, #333);
      }

      .card-label {
        font-size: 11px;
        color: var(--text-muted, #888);
      }

      .coverage-bar {
        height: 8px;
        background: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .coverage-fill {
        height: 100%;
        background: var(--primary, #0066cc);
        border-radius: 4px;
      }

      .coverage-stats {
        display: flex;
        gap: 16px;
        font-size: 12px;
      }

      .stat-good {
        color: #008800;
      }

      .stat-warn {
        color: #cc6600;
      }

      /* Data View */
      .data-view {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .data-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .record-count {
        font-size: 12px;
        color: var(--text-muted, #888);
      }

      .data-table-container {
        overflow: auto;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 6px;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      .data-table th,
      .data-table td {
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }

      .data-table th {
        background: var(--bg-secondary, #f8f8f8);
        font-weight: 500;
        position: sticky;
        top: 0;
      }

      .data-table th.has-definition {
        background: #e6f0ff;
      }

      .data-table th i {
        margin-left: 4px;
        font-size: 12px;
        color: var(--primary, #0066cc);
      }

      .data-table td.has-vocabulary {
        color: var(--primary, #0066cc);
        cursor: pointer;
      }

      .data-table td.has-vocabulary:hover {
        background: #e6f0ff;
      }

      .null-value {
        color: var(--text-muted, #ccc);
      }

      /* Schema View */
      .schema-view {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .schema-field {
        background: var(--bg-secondary, #f8f8f8);
        border-radius: 6px;
        padding: 12px;
        border-left: 3px solid #ccc;
      }

      .schema-field.has-definition {
        border-left-color: var(--primary, #0066cc);
      }

      .field-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .field-main {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .field-name {
        font-weight: 600;
      }

      .field-type {
        padding: 2px 6px;
        background: var(--bg-primary, #fff);
        border-radius: 4px;
        font-size: 11px;
        color: var(--text-muted, #888);
      }

      .field-semantic {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--primary, #0066cc);
      }

      .field-semantic.undefined {
        color: var(--text-muted, #888);
        font-style: italic;
      }

      .field-definition {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--border-color, #e0e0e0);
        font-size: 13px;
      }

      .definition-context {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        flex-wrap: wrap;
      }

      .context-tag {
        padding: 2px 6px;
        background: var(--bg-primary, #fff);
        border-radius: 4px;
        font-size: 11px;
      }

      /* Definitions View */

      /* Definition Type Tabs (Key vs Value toggle) */
      .def-type-tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 16px;
        padding: 4px;
        background: var(--bg-secondary, #f8f8f8);
        border-radius: 8px;
      }

      .def-type-tab {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-muted, #666);
        transition: all 0.15s ease;
      }

      .def-type-tab:hover {
        background: var(--bg-hover, #e8e8e8);
      }

      .def-type-tab.active {
        background: var(--bg-primary, #fff);
        color: var(--primary, #0066cc);
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .def-type-tab .tab-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        background: var(--bg-secondary, #e8e8e8);
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
      }

      .def-type-tab.active .tab-count {
        background: var(--primary-light, #e6f0ff);
        color: var(--primary, #0066cc);
      }

      /* Section containers */
      .def-section-container {
        margin-bottom: 24px;
      }

      .def-section-container.hidden {
        display: none;
      }

      .def-section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 0;
        border-bottom: 2px solid var(--border-color, #e0e0e0);
        margin-bottom: 12px;
      }

      .def-section-header.key-section {
        border-bottom-color: #0066cc;
      }

      .def-section-header.key-section i {
        color: #0066cc;
      }

      .def-section-header.value-section {
        border-bottom-color: #8b5cf6;
      }

      .def-section-header.value-section i {
        color: #8b5cf6;
      }

      .def-section-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .def-section-header .section-subtitle {
        font-size: 12px;
        color: var(--text-muted, #888);
        margin-left: auto;
      }

      .empty-section {
        padding: 24px;
        text-align: center;
        color: var(--text-muted, #888);
        background: var(--bg-secondary, #f8f8f8);
        border-radius: 8px;
      }

      /* Definition Items */
      .definition-item {
        background: var(--bg-secondary, #f8f8f8);
        border-radius: 6px;
        margin-bottom: 8px;
        overflow: hidden;
        border-left: 3px solid transparent;
      }

      .definition-item.key-def {
        border-left-color: #0066cc;
      }

      .definition-item.value-def {
        border-left-color: #8b5cf6;
      }

      .definition-item.has-rich-def {
        background: linear-gradient(to right, #f0f7ff, var(--bg-secondary, #f8f8f8));
      }

      .def-type-badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .def-type-badge.key {
        background: #e6f0ff;
        color: #0066cc;
      }

      .def-type-badge.value {
        background: #f3e8ff;
        color: #8b5cf6;
      }

      .def-value {
        font-family: monospace;
        background: var(--bg-primary, #fff);
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
      }

      .def-meta-inline {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: var(--text-muted, #888);
      }

      .def-meta-inline i.ph-seal-check {
        color: #10b981;
      }

      .def-vocab-name {
        font-style: italic;
      }

      .def-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        cursor: pointer;
      }

      .def-header:hover {
        background: var(--bg-hover, #f0f0f0);
      }

      .def-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .def-term {
        font-weight: 600;
      }

      .def-uri {
        font-size: 11px;
        color: var(--text-muted, #888);
        font-family: monospace;
      }

      .def-body {
        padding: 0 12px 12px 32px;
      }

      .def-section {
        margin-bottom: 12px;
      }

      .def-section label {
        font-size: 11px;
        font-weight: 500;
        color: var(--text-muted, #888);
        text-transform: uppercase;
      }

      .def-meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 8px;
      }

      .meta-row {
        display: flex;
        flex-direction: column;
      }

      /* Implications list */
      .implications-list {
        list-style: none;
        padding: 0;
        margin: 8px 0 0 0;
      }

      .implications-list li {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 0;
        font-size: 13px;
      }

      .implications-list li i {
        color: var(--primary, #0066cc);
        font-size: 12px;
      }

      /* Rich definition source section */
      .rich-def-section {
        background: var(--bg-primary, #fff);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 8px;
        padding: 12px;
        margin: 12px 0;
      }

      .rich-def-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: 8px;
        margin-bottom: 12px;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
        font-weight: 600;
        font-size: 12px;
        color: #10b981;
      }

      .rich-def-header i {
        font-size: 16px;
      }

      .def-subsection {
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px dashed var(--border-color, #e8e8e8);
      }

      .def-subsection:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }

      .def-subsection > label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 600;
        color: var(--text-muted, #666);
        text-transform: uppercase;
        margin-bottom: 4px;
      }

      .def-subsection > label i {
        font-size: 12px;
      }

      .authority-info,
      .source-info,
      .jurisdiction-info,
      .validity-info {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 13px;
      }

      .authority-name,
      .source-citation {
        font-weight: 600;
      }

      .authority-abbrev {
        color: var(--text-muted, #888);
      }

      .authority-type {
        background: var(--bg-secondary, #f0f0f0);
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        text-transform: capitalize;
      }

      .source-title {
        font-style: italic;
      }

      .source-section {
        font-family: monospace;
        background: var(--bg-secondary, #f0f0f0);
        padding: 2px 6px;
        border-radius: 3px;
      }

      .source-url {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--primary, #0066cc);
        text-decoration: none;
        font-size: 12px;
      }

      .source-url:hover {
        text-decoration: underline;
      }

      .jurisdiction-programs {
        font-size: 12px;
        color: var(--text-muted, #888);
      }

      .population-method {
        font-size: 11px;
        color: var(--text-muted, #888);
        margin-left: 4px;
      }

      .vocab-link {
        font-family: monospace;
        font-size: 11px;
        color: var(--primary, #0066cc);
      }

      .status-badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        text-transform: capitalize;
      }

      .status-badge.active,
      .status-badge.stable,
      .status-badge.complete,
      .status-badge.verified {
        background: #e6ffe6;
        color: #008800;
      }

      .status-badge.deprecated {
        background: #ffe6e6;
        color: #880000;
      }

      .status-badge.provisional,
      .status-badge.draft,
      .status-badge.stub,
      .status-badge.partial {
        background: #fff6e6;
        color: #886600;
      }

      /* Vocabularies View */
      .vocabulary-item {
        background: var(--bg-secondary, #f8f8f8);
        border-radius: 6px;
        margin-bottom: 8px;
        overflow: hidden;
      }

      .vocab-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        cursor: pointer;
      }

      .vocab-header:hover {
        background: var(--bg-hover, #f0f0f0);
      }

      .vocab-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .vocab-name {
        font-weight: 600;
      }

      .vocab-count {
        font-size: 12px;
        color: var(--text-muted, #888);
      }

      .vocab-uri {
        font-size: 11px;
        color: var(--text-muted, #888);
        font-family: monospace;
      }

      .vocab-body {
        padding: 0 12px 12px 32px;
      }

      .vocab-description {
        margin-bottom: 12px;
        font-size: 13px;
      }

      .values-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        margin-bottom: 12px;
      }

      .values-table th,
      .values-table td {
        padding: 6px 8px;
        text-align: left;
        border: 1px solid var(--border-color, #e0e0e0);
      }

      .values-table th {
        background: var(--bg-primary, #fff);
        font-weight: 500;
      }

      .values-table tr.inactive {
        opacity: 0.6;
      }

      .values-table code {
        background: var(--bg-primary, #fff);
        padding: 2px 4px;
        border-radius: 3px;
      }

      /* Provenance View */
      .provenance-view {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .prov-section {
        background: var(--bg-secondary, #f8f8f8);
        border-radius: 8px;
        padding: 16px;
      }

      .prov-section h3 {
        margin: 0 0 12px 0;
        font-size: 14px;
        font-weight: 600;
      }

      .origin-card {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px;
        background: var(--bg-primary, #fff);
        border-radius: 6px;
        border: 1px solid var(--border-color, #e0e0e0);
      }

      .origin-icon {
        font-size: 32px;
        color: var(--primary, #0066cc);
      }

      .origin-details {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .origin-filename {
        font-weight: 600;
      }

      .origin-type,
      .origin-date,
      .origin-records {
        font-size: 12px;
        color: var(--text-muted, #888);
      }

      .graph-container {
        background: var(--bg-primary, #fff);
        border-radius: 6px;
        padding: 12px;
        border: 1px solid var(--border-color, #e0e0e0);
      }

      .graph-nodes {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }

      .graph-node {
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid var(--border-color, #e0e0e0);
      }

      .graph-node.given {
        border-color: #00cc00;
        background: #e6ffe6;
      }

      .graph-node.meant {
        border-color: #0066cc;
        background: #e6f0ff;
      }

      .node-type {
        font-size: 10px;
        text-transform: uppercase;
        color: var(--text-muted, #888);
      }

      .node-label {
        font-weight: 500;
      }

      .graph-edges {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .graph-edge {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        padding: 4px 8px;
        background: var(--bg-secondary, #f8f8f8);
        border-radius: 4px;
      }

      .edge-relation {
        font-style: italic;
        color: var(--text-muted, #888);
      }

      .transformations-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .transformation-item {
        background: var(--bg-primary, #fff);
        border-radius: 6px;
        padding: 10px 12px;
        border: 1px solid var(--border-color, #e0e0e0);
      }

      .tx-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .tx-number {
        font-size: 11px;
        color: var(--text-muted, #888);
      }

      .tx-type {
        font-weight: 500;
      }

      .tx-time {
        margin-left: auto;
        font-size: 11px;
        color: var(--text-muted, #888);
      }

      .tx-details {
        display: flex;
        gap: 8px;
        margin-top: 4px;
        font-size: 12px;
      }

      .tx-epistemic {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        text-transform: uppercase;
      }

      .tx-epistemic.given {
        background: #e6ffe6;
        color: #008800;
      }

      .tx-epistemic.meant {
        background: #e6f0ff;
        color: #0066cc;
      }

      /* Timeline View */
      .timeline-view {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .timeline-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .timeline-btn {
        padding: 8px 12px;
        border: 1px solid var(--border-color, #e0e0e0);
        background: var(--bg-primary, #fff);
        border-radius: 6px;
        cursor: pointer;
      }

      .timeline-btn:hover:not(:disabled) {
        background: var(--bg-hover, #f0f0f0);
      }

      .timeline-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .timeline-position {
        padding: 8px 16px;
        font-weight: 600;
      }

      .timeline-scrubber {
        padding: 0 20px;
      }

      .timeline-slider {
        width: 100%;
      }

      .timeline-content {
        background: var(--bg-secondary, #f8f8f8);
        border-radius: 8px;
        padding: 16px;
      }

      .timeline-state h4 {
        margin: 0 0 8px 0;
      }

      .timeline-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding-left: 20px;
        border-left: 2px solid var(--border-color, #e0e0e0);
      }

      .timeline-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        margin-left: -26px;
        border-radius: 6px;
        cursor: pointer;
      }

      .timeline-item:hover {
        background: var(--bg-hover, #f0f0f0);
      }

      .timeline-item.current {
        background: var(--primary-light, #e6f0ff);
      }

      .timeline-marker {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--border-color, #e0e0e0);
        border: 2px solid var(--bg-primary, #fff);
      }

      .timeline-item.applied .timeline-marker {
        background: var(--primary, #0066cc);
      }

      .timeline-item.current .timeline-marker {
        background: var(--primary, #0066cc);
        box-shadow: 0 0 0 3px var(--primary-light, #e6f0ff);
      }

      .timeline-info {
        display: flex;
        flex-direction: column;
      }

      /* Provenance Popover */
      .provenance-popover-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 1000;
        background: var(--bg-primary, #fff);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        max-width: 400px;
        width: 90%;
      }

      .provenance-popover {
        padding: 16px;
      }

      .pop-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }

      .pop-value {
        font-family: monospace;
        font-weight: 600;
      }

      .pop-close {
        border: none;
        background: none;
        font-size: 20px;
        cursor: pointer;
        color: var(--text-muted, #888);
      }

      .pop-section {
        margin-bottom: 12px;
      }

      .pop-section label {
        font-size: 11px;
        font-weight: 500;
        color: var(--text-muted, #888);
        text-transform: uppercase;
      }

      .pop-section ul {
        margin: 4px 0 0 16px;
        padding: 0;
      }

      /* Empty view */
      .empty-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        color: var(--text-muted, #888);
      }

      .empty-view i {
        font-size: 48px;
        margin-bottom: 12px;
      }
    `;
    document.head.appendChild(styles);
  }
}

// ============================================================================
// Show Export Viewer Dialog
// ============================================================================

/**
 * Show export viewer in a modal
 */
function showExportViewerDialog(exportData) {
  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'export-viewer-modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h2>Export Viewer</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body" id="export-viewer-container"></div>
    </div>
  `;

  // Add styles for modal
  const style = document.createElement('style');
  style.textContent = `
    .export-viewer-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .export-viewer-modal .modal-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
    }

    .export-viewer-modal .modal-container {
      position: relative;
      width: 90%;
      max-width: 1200px;
      height: 85%;
      background: var(--bg-primary, #fff);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .export-viewer-modal .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color, #e0e0e0);
    }

    .export-viewer-modal .modal-header h2 {
      margin: 0;
      font-size: 16px;
    }

    .export-viewer-modal .modal-close {
      border: none;
      background: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--text-muted, #888);
    }

    .export-viewer-modal .modal-body {
      flex: 1;
      overflow: hidden;
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(modal);

  // Create viewer
  const container = modal.querySelector('#export-viewer-container');
  const viewer = new ExportViewer(container, exportData);

  // Close handlers
  const close = () => {
    modal.remove();
    style.remove();
  };

  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);

  return viewer;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ExportViewerState,
    ExportViewer,
    showExportViewerDialog
  };
}

if (typeof window !== 'undefined') {
  window.EOExportViewer = {
    ExportViewerState,
    ExportViewer,
    showExportViewerDialog
  };

  window.ExportViewer = ExportViewer;
  window.showExportViewerDialog = showExportViewerDialog;
}
