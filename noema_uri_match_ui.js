/**
 * EO URI Match UI - Display components for URI matching results
 *
 * Shows:
 * - Match quality scores with visual indicators
 * - Field coverage (X of 9 fields available)
 * - Modification status from original URI source
 * - Justification for each match selection
 */

// ============================================================================
// SECTION I: URI Match Card Component
// ============================================================================

/**
 * Render a single URI match result card
 * @param {URIMatchResult|Object} match - The match to display
 * @param {Object} options - Display options
 * @returns {string} - HTML string
 */
function renderURIMatchCard(match, options = {}) {
  const summary = match.getSummary ? match.getSummary() : match;
  const coverage = summary.fieldCoverage || match.fieldCoverage || {};
  const isSelected = options.selected || false;

  // Quality color based on label
  const qualityColors = {
    'Excellent': { bg: '#dcfce7', border: '#16a34a', text: '#15803d' },
    'Good': { bg: '#d1fae5', border: '#10b981', text: '#059669' },
    'Fair': { bg: '#fef3c7', border: '#f59e0b', text: '#d97706' },
    'Partial': { bg: '#ffedd5', border: '#f97316', text: '#ea580c' },
    'Weak': { bg: '#fee2e2', border: '#ef4444', text: '#dc2626' }
  };

  const colors = qualityColors[summary.qualityLabel || 'Weak'] || qualityColors['Weak'];
  const score = Math.round((summary.score || 0) * 100);

  return `
    <div class="uri-match-card ${isSelected ? 'selected' : ''}" data-uri="${escapeHtml(summary.uri || '')}" style="--quality-bg: ${colors.bg}; --quality-border: ${colors.border}; --quality-text: ${colors.text}">
      <div class="match-header">
        <div class="match-source-badge">${escapeHtml(summary.source || 'Unknown')}</div>
        <div class="match-quality" title="Match Quality: ${score}%">
          <span class="quality-label">${escapeHtml(summary.qualityLabel || 'Unknown')}</span>
          <span class="quality-score">${score}%</span>
        </div>
      </div>

      <div class="match-label">${escapeHtml(summary.label || 'Untitled')}</div>
      <div class="match-description">${escapeHtml((summary.description || '').substring(0, 120))}${(summary.description?.length || 0) > 120 ? '...' : ''}</div>

      ${summary.uri ? `<div class="match-uri">${escapeHtml(summary.uri)}</div>` : ''}

      <div class="match-coverage">
        <div class="coverage-bar">
          <div class="coverage-fill" style="width: ${Math.round((coverage.percentage || 0) * 100)}%"></div>
        </div>
        <div class="coverage-text">
          <i class="ph ph-table"></i>
          <span>${coverage.count || 0} of ${coverage.total || 9} fields</span>
        </div>
      </div>

      ${coverage.groups?.length > 0 ? `
        <div class="coverage-groups">
          ${coverage.groups.map(g => `<span class="group-tag">${escapeHtml(g)}</span>`).join('')}
        </div>
      ` : ''}

      <div class="match-actions">
        <button class="btn-select-match" data-action="select" ${isSelected ? 'disabled' : ''}>
          ${isSelected ? '<i class="ph ph-check"></i> Selected' : '<i class="ph ph-arrow-right"></i> Use This'}
        </button>
        <button class="btn-justify-match" data-action="justify" title="View justification">
          <i class="ph ph-info"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * Render a list of URI match results
 * @param {URIMatchResult[]} matches - Array of matches
 * @param {Object} options - Display options
 * @returns {string} - HTML string
 */
function renderURIMatchList(matches, options = {}) {
  if (!matches || matches.length === 0) {
    return `
      <div class="uri-match-empty">
        <i class="ph ph-magnifying-glass"></i>
        <div class="empty-title">No URI matches found</div>
        <div class="empty-desc">Try adjusting your search term or create a local definition</div>
      </div>
    `;
  }

  const selectedUri = options.selectedUri || null;

  return `
    <div class="uri-match-list">
      <div class="match-list-header">
        <span class="match-count">${matches.length} match${matches.length !== 1 ? 'es' : ''} found</span>
        <span class="match-sort">Sorted by quality</span>
      </div>
      <div class="match-list-items">
        ${matches.map(m => renderURIMatchCard(m, {
          selected: selectedUri && (m.uri === selectedUri || m.getSummary?.().uri === selectedUri)
        })).join('')}
      </div>
    </div>
  `;
}

// ============================================================================
// SECTION II: Field Coverage Display
// ============================================================================

/**
 * Render field coverage indicator
 * @param {Object} coverage - Field coverage object
 * @param {Object} options - Display options
 * @returns {string} - HTML string
 */
function renderFieldCoverageIndicator(coverage, options = {}) {
  if (!coverage) {
    return `<div class="field-coverage-na">Field coverage unknown</div>`;
  }

  const percentage = Math.round((coverage.percentage || 0) * 100);
  const groups = coverage.groups || [];

  // Color based on coverage
  let color = '#ef4444'; // red
  if (percentage >= 70) color = '#16a34a'; // green
  else if (percentage >= 50) color = '#f59e0b'; // amber
  else if (percentage >= 30) color = '#f97316'; // orange

  const fieldLabels = {
    term: 'Term',
    authority: 'Authority',
    source: 'Source',
    validity: 'Validity',
    jurisdiction: 'Jurisdiction',
    version: 'Version',
    status: 'Status',
    populationMethod: 'Method',
    discoveredFrom: 'Origin'
  };

  const allFields = ['term', 'authority', 'source', 'validity', 'jurisdiction', 'version', 'status', 'populationMethod', 'discoveredFrom'];

  return `
    <div class="field-coverage-indicator" style="--coverage-color: ${color}">
      <div class="coverage-header">
        <div class="coverage-title">
          <i class="ph ph-table"></i>
          Field Coverage
        </div>
        <div class="coverage-value">${coverage.count}/${coverage.total} (${percentage}%)</div>
      </div>

      <div class="coverage-bar-large">
        <div class="coverage-fill" style="width: ${percentage}%"></div>
        <div class="coverage-markers">
          ${allFields.map((f, i) => `
            <div class="coverage-marker ${groups.includes(f) ? 'filled' : ''}"
                 style="left: ${(i / allFields.length) * 100}%"
                 title="${fieldLabels[f] || f}">
            </div>
          `).join('')}
        </div>
      </div>

      <div class="coverage-legend">
        ${allFields.map(f => `
          <div class="legend-item ${groups.includes(f) ? 'covered' : ''}">
            <span class="legend-dot"></span>
            <span class="legend-label">${fieldLabels[f] || f}</span>
          </div>
        `).join('')}
      </div>

      ${options.showDetails && groups.length > 0 ? `
        <div class="coverage-details">
          <div class="details-title">Available from source:</div>
          <ul>
            ${groups.map(g => `<li>${fieldLabels[g] || g}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================================================
// SECTION III: Modification Status Display
// ============================================================================

/**
 * Render modification status badge
 * @param {Object} modStatus - Modification status from getModificationStatus()
 * @returns {string} - HTML string
 */
function renderModificationStatus(modStatus) {
  if (!modStatus) {
    return '';
  }

  return `
    <div class="modification-status status-${modStatus.status}" style="--status-color: ${modStatus.color}">
      <i class="ph ${modStatus.icon}"></i>
      <span class="status-message">${escapeHtml(modStatus.message)}</span>
      ${modStatus.details ? `<span class="status-details">${escapeHtml(modStatus.details)}</span>` : ''}
    </div>
  `;
}

/**
 * Render detailed modification comparison
 * @param {Object} comparison - Result from checkModifications()
 * @returns {string} - HTML string
 */
function renderModificationComparison(comparison) {
  if (!comparison || !comparison.modified) {
    return `
      <div class="modification-comparison unchanged">
        <i class="ph ph-check-circle"></i>
        <span>Definition matches original URI source</span>
      </div>
    `;
  }

  return `
    <div class="modification-comparison modified">
      <div class="comparison-header">
        <i class="ph ph-pencil-simple"></i>
        <span>Modified from ${escapeHtml(comparison.source?.source || 'URI')} source</span>
      </div>

      <div class="modification-list">
        ${comparison.modifications.map(mod => `
          <div class="modification-group">
            <div class="group-name">${escapeHtml(mod.group)}</div>
            ${mod.changes.map(change => `
              <div class="field-change ${change.type}">
                <span class="field-name">${escapeHtml(change.field)}</span>
                <div class="change-values">
                  <div class="original-value">
                    <span class="value-label">Original:</span>
                    <span class="value-content">${escapeHtml(String(change.original ?? 'null'))}</span>
                  </div>
                  <span class="arrow">→</span>
                  <div class="current-value">
                    <span class="value-label">Current:</span>
                    <span class="value-content">${escapeHtml(String(change.current ?? 'null'))}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>

      <div class="comparison-footer">
        <a href="${escapeHtml(comparison.source?.uri || '#')}" target="_blank" rel="noopener" class="source-link">
          <i class="ph ph-arrow-square-out"></i>
          View original source
        </a>
      </div>
    </div>
  `;
}

// ============================================================================
// SECTION IV: Justification Panel
// ============================================================================

/**
 * Render match justification panel
 * @param {Object} justification - From generateJustification()
 * @returns {string} - HTML string
 */
function renderJustificationPanel(justification) {
  if (!justification) {
    return '';
  }

  const match = justification.match || {};
  const coverage = match.fieldCoverage || {};

  return `
    <div class="justification-panel">
      <div class="justification-header">
        <h4><i class="ph ph-scales"></i> Match Justification</h4>
        <div class="overall-score">
          <span class="score-value">${justification.overallScore}%</span>
          <span class="score-label">${escapeHtml(justification.qualityLabel)}</span>
        </div>
      </div>

      <div class="justification-match">
        <div class="match-info">
          <span class="source-badge">${escapeHtml(match.source || 'Unknown')}</span>
          <span class="match-label">${escapeHtml(match.label || 'Untitled')}</span>
        </div>
        ${match.uri ? `<div class="match-uri">${escapeHtml(match.uri)}</div>` : ''}
      </div>

      <div class="justification-reasons">
        <h5>Why this match:</h5>
        <ul>
          ${justification.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
        </ul>
      </div>

      <div class="justification-coverage">
        ${renderFieldCoverageIndicator(coverage, { showDetails: true })}
      </div>

      <div class="justification-recommendation ${justification.overallScore >= 70 ? 'recommended' : ''}">
        <i class="ph ${justification.overallScore >= 70 ? 'ph-thumbs-up' : 'ph-info'}"></i>
        <span>${escapeHtml(justification.recommendation)}</span>
      </div>
    </div>
  `;
}

// ============================================================================
// SECTION V: URI Match Picker Modal
// ============================================================================

/**
 * Create and show URI match picker modal
 * @param {string} term - The term being defined
 * @param {URIMatchResult[]} matches - Available matches
 * @param {Object} options - Modal options
 * @returns {Promise<URIMatchResult|null>} - Selected match or null
 */
function showURIMatchPicker(term, matches, options = {}) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'uri-match-modal-backdrop';

    modal.innerHTML = `
      <div class="uri-match-modal">
        <div class="modal-header">
          <div class="header-content">
            <h3><i class="ph ph-link"></i> Select URI Source</h3>
            <div class="term-badge">${escapeHtml(term)}</div>
          </div>
          <button class="btn-close" data-action="close"><i class="ph ph-x"></i></button>
        </div>

        <div class="modal-body">
          <div class="match-explanation">
            <p>Select an authoritative URI source to populate the definition. The quality score indicates how well each result matches, and field coverage shows which of the 9 definition fields can be auto-populated.</p>
          </div>

          ${renderURIMatchList(matches, options)}
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="skip">
            <i class="ph ph-skip-forward"></i> Skip (Create Local)
          </button>
          <button class="btn btn-primary" data-action="confirm" disabled>
            <i class="ph ph-check"></i> Use Selected
          </button>
        </div>
      </div>
    `;

    // Inject modal styles
    injectURIMatchStyles();

    document.body.appendChild(modal);

    let selectedMatch = null;

    // Event handlers
    const handleClose = () => {
      modal.remove();
      resolve(null);
    };

    const handleSkip = () => {
      modal.remove();
      resolve(null);
    };

    const handleConfirm = () => {
      modal.remove();
      resolve(selectedMatch);
    };

    const handleSelectMatch = (uri) => {
      selectedMatch = matches.find(m =>
        (m.uri === uri) || (m.getSummary?.().uri === uri)
      );

      // Update UI
      modal.querySelectorAll('.uri-match-card').forEach(card => {
        card.classList.remove('selected');
        card.querySelector('.btn-select-match').disabled = false;
        card.querySelector('.btn-select-match').innerHTML = '<i class="ph ph-arrow-right"></i> Use This';
      });

      if (selectedMatch) {
        const selectedCard = modal.querySelector(`[data-uri="${uri}"]`);
        if (selectedCard) {
          selectedCard.classList.add('selected');
          const btn = selectedCard.querySelector('.btn-select-match');
          btn.disabled = true;
          btn.innerHTML = '<i class="ph ph-check"></i> Selected';
        }
        modal.querySelector('[data-action="confirm"]').disabled = false;
      }
    };

    // Attach event listeners
    modal.querySelector('[data-action="close"]').addEventListener('click', handleClose);
    modal.querySelector('[data-action="skip"]').addEventListener('click', handleSkip);
    modal.querySelector('[data-action="confirm"]').addEventListener('click', handleConfirm);

    modal.querySelectorAll('.uri-match-card').forEach(card => {
      card.querySelector('[data-action="select"]').addEventListener('click', () => {
        handleSelectMatch(card.dataset.uri);
      });

      card.querySelector('[data-action="justify"]')?.addEventListener('click', () => {
        // Find the match and show justification
        const uri = card.dataset.uri;
        const match = matches.find(m => (m.uri === uri) || (m.getSummary?.().uri === uri));
        if (match && window.EO?.getURIMatchingService) {
          const justification = window.EO.getURIMatchingService().generateJustification(match, term);
          showJustificationModal(justification);
        }
      });
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) handleClose();
    });

    // Close on ESC
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  });
}

/**
 * Show justification modal
 */
function showJustificationModal(justification) {
  const modal = document.createElement('div');
  modal.className = 'justification-modal-backdrop';

  modal.innerHTML = `
    <div class="justification-modal">
      <button class="btn-close" data-action="close"><i class="ph ph-x"></i></button>
      ${renderJustificationPanel(justification)}
    </div>
  `;

  document.body.appendChild(modal);

  const handleClose = () => modal.remove();

  modal.querySelector('[data-action="close"]').addEventListener('click', handleClose);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) handleClose();
  });
}

// ============================================================================
// SECTION VI: Helper Functions
// ============================================================================

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/**
 * Inject CSS styles for URI match components
 */
function injectURIMatchStyles() {
  if (document.getElementById('uri-match-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'uri-match-styles';
  styles.textContent = `
    /* URI Match Card */
    .uri-match-card {
      background: var(--bg-primary, white);
      border: 2px solid var(--border-color, #e5e7eb);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .uri-match-card:hover {
      border-color: var(--quality-border);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .uri-match-card.selected {
      border-color: var(--quality-border);
      background: var(--quality-bg);
    }

    .match-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .match-source-badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 4px 10px;
      background: #f1f5f9;
      border-radius: 12px;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .match-quality {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
    }

    .quality-label {
      font-weight: 600;
      color: var(--quality-text);
    }

    .quality-score {
      background: var(--quality-bg);
      color: var(--quality-text);
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.8rem;
    }

    .match-label {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text-primary, #1f2937);
      margin-bottom: 6px;
    }

    .match-description {
      font-size: 0.9rem;
      color: var(--text-secondary, #6b7280);
      line-height: 1.5;
      margin-bottom: 8px;
    }

    .match-uri {
      font-size: 0.8rem;
      font-family: monospace;
      color: var(--text-muted, #9ca3af);
      word-break: break-all;
      margin-bottom: 12px;
    }

    /* Coverage Bar */
    .match-coverage {
      margin-bottom: 10px;
    }

    .coverage-bar {
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 6px;
    }

    .coverage-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #059669);
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .coverage-text {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      color: var(--text-secondary, #6b7280);
    }

    .coverage-groups {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }

    .group-tag {
      font-size: 0.7rem;
      padding: 3px 8px;
      background: #e0f2fe;
      color: #0369a1;
      border-radius: 10px;
      font-weight: 500;
    }

    /* Match Actions */
    .match-actions {
      display: flex;
      gap: 8px;
    }

    .btn-select-match {
      flex: 1;
      padding: 10px 16px;
      background: var(--primary-600, #2563eb);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .btn-select-match:hover:not(:disabled) {
      background: var(--primary-700, #1d4ed8);
    }

    .btn-select-match:disabled {
      background: #059669;
      cursor: default;
    }

    .btn-justify-match {
      padding: 10px 14px;
      background: #f1f5f9;
      border: none;
      border-radius: 8px;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-justify-match:hover {
      background: #e2e8f0;
      color: #475569;
    }

    /* Empty State */
    .uri-match-empty {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-secondary, #6b7280);
    }

    .uri-match-empty i {
      font-size: 3rem;
      opacity: 0.3;
      margin-bottom: 16px;
    }

    .empty-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .empty-desc {
      font-size: 0.9rem;
    }

    /* Match List */
    .uri-match-list {
      max-height: 60vh;
      overflow-y: auto;
    }

    .match-list-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: var(--text-secondary, #6b7280);
      margin-bottom: 12px;
      padding: 0 4px;
    }

    .match-count {
      font-weight: 600;
    }

    /* Field Coverage Indicator (Large) */
    .field-coverage-indicator {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
    }

    .coverage-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .coverage-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: var(--text-primary, #1f2937);
    }

    .coverage-value {
      font-weight: 700;
      color: var(--coverage-color);
    }

    .coverage-bar-large {
      height: 12px;
      background: #e5e7eb;
      border-radius: 6px;
      position: relative;
      margin-bottom: 16px;
    }

    .coverage-bar-large .coverage-fill {
      background: var(--coverage-color);
    }

    .coverage-markers {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }

    .coverage-marker {
      position: absolute;
      top: -2px;
      width: 4px;
      height: 16px;
      background: #cbd5e1;
      border-radius: 2px;
      transform: translateX(-50%);
    }

    .coverage-marker.filled {
      background: var(--coverage-color);
    }

    .coverage-legend {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: #9ca3af;
    }

    .legend-item.covered {
      color: var(--coverage-color);
      font-weight: 600;
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #e5e7eb;
    }

    .legend-item.covered .legend-dot {
      background: var(--coverage-color);
    }

    /* Modification Status */
    .modification-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.9rem;
      background: color-mix(in srgb, var(--status-color) 10%, white);
      border: 1px solid color-mix(in srgb, var(--status-color) 30%, white);
      color: var(--status-color);
    }

    .modification-status i {
      font-size: 1.1rem;
    }

    .status-details {
      font-size: 0.8rem;
      opacity: 0.8;
      margin-left: auto;
    }

    /* Modification Comparison */
    .modification-comparison {
      background: #f8fafc;
      border-radius: 10px;
      padding: 16px;
    }

    .modification-comparison.unchanged {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .comparison-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #b45309;
      margin-bottom: 14px;
    }

    .modification-group {
      margin-bottom: 12px;
    }

    .group-name {
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .field-change {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 6px;
    }

    .field-name {
      font-weight: 600;
      font-size: 0.85rem;
      color: #374151;
      display: block;
      margin-bottom: 6px;
    }

    .change-values {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.85rem;
    }

    .original-value, .current-value {
      flex: 1;
    }

    .value-label {
      font-size: 0.7rem;
      color: #9ca3af;
      display: block;
    }

    .original-value .value-content {
      text-decoration: line-through;
      color: #ef4444;
    }

    .current-value .value-content {
      color: #059669;
      font-weight: 500;
    }

    .arrow {
      color: #9ca3af;
    }

    .comparison-footer {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid #e5e7eb;
    }

    .source-link {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #2563eb;
      text-decoration: none;
      font-size: 0.85rem;
    }

    .source-link:hover {
      text-decoration: underline;
    }

    /* Justification Panel */
    .justification-panel {
      background: white;
      border-radius: 12px;
      padding: 20px;
    }

    .justification-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .justification-header h4 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1.1rem;
    }

    .overall-score {
      text-align: right;
    }

    .score-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #059669;
    }

    .score-label {
      display: block;
      font-size: 0.8rem;
      color: #6b7280;
    }

    .justification-match {
      background: #f8fafc;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
    }

    .match-info {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }

    .source-badge {
      font-size: 0.7rem;
      padding: 3px 8px;
      background: #e0f2fe;
      color: #0369a1;
      border-radius: 10px;
      font-weight: 600;
    }

    .justification-reasons {
      margin-bottom: 16px;
    }

    .justification-reasons h5 {
      font-size: 0.85rem;
      margin: 0 0 10px;
      color: #374151;
    }

    .justification-reasons ul {
      margin: 0;
      padding-left: 20px;
    }

    .justification-reasons li {
      font-size: 0.9rem;
      color: #6b7280;
      margin-bottom: 6px;
    }

    .justification-coverage {
      margin-bottom: 16px;
    }

    .justification-recommendation {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background: #fef3c7;
      border-radius: 8px;
      color: #92400e;
      font-size: 0.9rem;
    }

    .justification-recommendation.recommended {
      background: #dcfce7;
      color: #166534;
    }

    /* Modal Styles */
    .uri-match-modal-backdrop,
    .justification-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease;
    }

    .uri-match-modal {
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 700px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease;
    }

    .justification-modal {
      max-width: 500px;
      position: relative;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.1rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .term-badge {
      background: #dbeafe;
      color: #1e40af;
      padding: 4px 12px;
      border-radius: 14px;
      font-size: 0.85rem;
      font-weight: 600;
      font-family: monospace;
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
    }

    .match-explanation {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      font-size: 0.9rem;
      color: #166534;
    }

    .match-explanation p {
      margin: 0;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 24px;
      border-top: 1px solid #e5e7eb;
    }

    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      border: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #2563eb;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #1d4ed8;
    }

    .btn-primary:disabled {
      background: #93c5fd;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #475569;
    }

    .btn-secondary:hover {
      background: #e2e8f0;
    }

    .btn-close {
      background: none;
      border: none;
      padding: 8px;
      cursor: pointer;
      color: #64748b;
      border-radius: 6px;
    }

    .btn-close:hover {
      background: #f1f5f9;
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

  document.head.appendChild(styles);
}

// ============================================================================
// SECTION VII: Exports
// ============================================================================

// Export for browser
if (typeof window !== 'undefined') {
  window.EO = window.EO || {};
  window.EO.URIMatchUI = {
    renderURIMatchCard,
    renderURIMatchList,
    renderFieldCoverageIndicator,
    renderModificationStatus,
    renderModificationComparison,
    renderJustificationPanel,
    showURIMatchPicker,
    showJustificationModal,
    injectURIMatchStyles
  };
}

// Export for Node.js/ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderURIMatchCard,
    renderURIMatchList,
    renderFieldCoverageIndicator,
    renderModificationStatus,
    renderModificationComparison,
    renderJustificationPanel,
    showURIMatchPicker,
    showJustificationModal,
    injectURIMatchStyles
  };
}
