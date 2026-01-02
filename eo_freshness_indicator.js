/**
 * EO Freshness Indicator - Always Show Sync Status
 *
 * Core Principle:
 * - Users should ALWAYS know how fresh their data is
 * - The view is a live query against a source
 * - Only EXPORT creates a saved snapshot
 *
 * Visual Language:
 * ● Fresh (green)   - Synced within 5 minutes
 * ◐ Stale (yellow)  - Synced within 30 minutes
 * ○ Old (red)       - Synced over 30 minutes ago
 * ↻ Syncing (blue)  - Currently refreshing
 * ⚠ Error (red)     - Sync failed
 * ◌ Never (gray)    - Local only, never synced
 */

// ============================================================================
// FreshnessIndicator Component
// ============================================================================

class FreshnessIndicator {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    this.options = {
      showDetails: options.showDetails !== false,
      showRefreshButton: options.showRefreshButton !== false,
      compact: options.compact || false
    };

    this._sourceHandle = null;
    this._updateInterval = null;

    this._render();
  }

  /**
   * Attach to a source handle
   */
  attach(sourceHandle) {
    this._sourceHandle = sourceHandle;
    this._startUpdating();
    this.update();
  }

  /**
   * Detach and stop updating
   */
  detach() {
    this._sourceHandle = null;
    this._stopUpdating();
  }

  /**
   * Update the indicator
   */
  update() {
    if (!this._sourceHandle) {
      this._renderEmpty();
      return;
    }

    const freshness = this._sourceHandle.getFreshness();
    this._renderFreshness(freshness);
  }

  _render() {
    this.container.innerHTML = `
      <div class="eo-freshness-indicator" role="status" aria-live="polite">
        <span class="freshness-icon"></span>
        <span class="freshness-text"></span>
        ${this.options.showRefreshButton ? `
          <button class="freshness-refresh" title="Refresh data" aria-label="Refresh data">
            ↻
          </button>
        ` : ''}
      </div>
    `;

    this._iconEl = this.container.querySelector('.freshness-icon');
    this._textEl = this.container.querySelector('.freshness-text');
    this._refreshBtn = this.container.querySelector('.freshness-refresh');

    if (this._refreshBtn) {
      this._refreshBtn.addEventListener('click', () => this._onRefresh());
    }

    // Add styles if not already present
    this._ensureStyles();
  }

  _renderFreshness(freshness) {
    const { status, message, sinceHuman, lastSyncAt } = freshness;

    // Icon and color based on status
    const config = this._getStatusConfig(status);

    this._iconEl.textContent = config.icon;
    this._iconEl.style.color = config.color;
    this._iconEl.title = message;

    if (this.options.compact) {
      this._textEl.textContent = sinceHuman || status;
    } else {
      this._textEl.textContent = message;
    }

    this._textEl.style.color = config.color;

    // Update refresh button state
    if (this._refreshBtn) {
      this._refreshBtn.disabled = status === 'syncing';
      if (status === 'syncing') {
        this._refreshBtn.classList.add('spinning');
      } else {
        this._refreshBtn.classList.remove('spinning');
      }
    }

    // Update container class for styling hooks
    this.container.querySelector('.eo-freshness-indicator').className =
      `eo-freshness-indicator status-${status}`;
  }

  _renderEmpty() {
    this._iconEl.textContent = '◌';
    this._iconEl.style.color = '#999';
    this._textEl.textContent = 'No source';
    this._textEl.style.color = '#999';
  }

  _getStatusConfig(status) {
    switch (status) {
      case 'fresh':
        return { icon: '●', color: '#22c55e' };  // Green
      case 'stale':
        return { icon: '◐', color: '#eab308' };  // Yellow
      case 'syncing':
        return { icon: '↻', color: '#3b82f6' };  // Blue
      case 'error':
        return { icon: '⚠', color: '#ef4444' };  // Red
      case 'offline':
        return { icon: '○', color: '#f97316' };  // Orange
      case 'never':
      default:
        return { icon: '◌', color: '#9ca3af' };  // Gray
    }
  }

  async _onRefresh() {
    if (!this._sourceHandle) return;

    try {
      await this._sourceHandle.refresh();
      this.update();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }

  _startUpdating() {
    this._stopUpdating();
    // Update every 30 seconds
    this._updateInterval = setInterval(() => this.update(), 30000);
  }

  _stopUpdating() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
  }

  _ensureStyles() {
    if (document.getElementById('eo-freshness-styles')) return;

    const style = document.createElement('style');
    style.id = 'eo-freshness-styles';
    style.textContent = `
      .eo-freshness-indicator {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-family: system-ui, -apple-system, sans-serif;
        padding: 4px 8px;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.05);
      }

      .eo-freshness-indicator .freshness-icon {
        font-size: 10px;
        line-height: 1;
      }

      .eo-freshness-indicator .freshness-text {
        color: #666;
      }

      .eo-freshness-indicator .freshness-refresh {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 14px;
        padding: 2px 4px;
        border-radius: 3px;
        color: #666;
        transition: all 0.2s;
      }

      .eo-freshness-indicator .freshness-refresh:hover {
        background: rgba(0, 0, 0, 0.1);
        color: #333;
      }

      .eo-freshness-indicator .freshness-refresh:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      .eo-freshness-indicator .freshness-refresh.spinning {
        animation: eo-spin 1s linear infinite;
      }

      @keyframes eo-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      /* Status-specific backgrounds */
      .eo-freshness-indicator.status-fresh {
        background: rgba(34, 197, 94, 0.1);
      }

      .eo-freshness-indicator.status-stale {
        background: rgba(234, 179, 8, 0.1);
      }

      .eo-freshness-indicator.status-error {
        background: rgba(239, 68, 68, 0.1);
      }

      .eo-freshness-indicator.status-syncing {
        background: rgba(59, 130, 246, 0.1);
      }
    `;
    document.head.appendChild(style);
  }

  destroy() {
    this._stopUpdating();
    this.container.innerHTML = '';
  }
}

// ============================================================================
// ViewHeader Component - Shows source info, freshness, and export action
// ============================================================================

/**
 * ViewHeader - Header for any view showing source + freshness + export
 *
 * Pattern:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ 📋 Active Deals                    ● Updated 2m ago   [Export] │
 * │ Viewing 50 of 1,234 records from "CRM Export"                  │
 * └─────────────────────────────────────────────────────────────────┘
 */
class ViewHeader {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    this.options = options;
    this._query = null;
    this._sourceHandle = null;
    this._freshnessIndicator = null;

    this._render();
  }

  /**
   * Attach to a query (which has a source)
   */
  attach(query, sourceHandle) {
    this._query = query;
    this._sourceHandle = sourceHandle;

    if (query) {
      query.attachSource(sourceHandle);
    }

    this._updateHeader();
  }

  async _updateHeader() {
    if (!this._query || !this._sourceHandle) return;

    const freshness = this._sourceHandle.getFreshness();
    const count = await this._sourceHandle.getRecordCount();

    // Update view name
    this._viewNameEl.textContent = this._query.name;

    // Update source info
    this._sourceInfoEl.textContent = `from "${this._sourceHandle.name}"`;

    // Update count
    this._countEl.textContent = `${count.toLocaleString()} records`;

    // Update freshness
    this._freshnessIndicator.attach(this._sourceHandle);
  }

  _render() {
    this.container.innerHTML = `
      <div class="eo-view-header">
        <div class="view-header-main">
          <div class="view-header-left">
            <span class="view-icon">📋</span>
            <h2 class="view-name">Untitled View</h2>
            <span class="view-badge">LIVE</span>
          </div>
          <div class="view-header-right">
            <div class="view-freshness"></div>
            <button class="view-export-btn" title="Export creates a saved snapshot">
              Export ↓
            </button>
          </div>
        </div>
        <div class="view-header-meta">
          <span class="view-count">0 records</span>
          <span class="view-source-info">from source</span>
        </div>
      </div>
    `;

    this._viewNameEl = this.container.querySelector('.view-name');
    this._sourceInfoEl = this.container.querySelector('.view-source-info');
    this._countEl = this.container.querySelector('.view-count');
    this._exportBtn = this.container.querySelector('.view-export-btn');

    // Create freshness indicator
    const freshnessContainer = this.container.querySelector('.view-freshness');
    this._freshnessIndicator = new FreshnessIndicator(freshnessContainer);

    // Export handler
    this._exportBtn.addEventListener('click', () => this._onExport());

    this._ensureStyles();
  }

  async _onExport() {
    if (!this._query) return;

    // Show export dialog
    const dialog = new ExportDialog(this._query, this._sourceHandle);
    dialog.show();
  }

  _ensureStyles() {
    if (document.getElementById('eo-view-header-styles')) return;

    const style = document.createElement('style');
    style.id = 'eo-view-header-styles';
    style.textContent = `
      .eo-view-header {
        padding: 12px 16px;
        border-bottom: 1px solid #e5e7eb;
        background: #fafafa;
      }

      .view-header-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }

      .view-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .view-icon {
        font-size: 20px;
      }

      .view-name {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
        color: #1f2937;
      }

      .view-badge {
        font-size: 9px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 10px;
        background: #dbeafe;
        color: #1d4ed8;
        letter-spacing: 0.5px;
      }

      .view-header-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .view-export-btn {
        padding: 6px 12px;
        font-size: 13px;
        font-weight: 500;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: white;
        color: #374151;
        cursor: pointer;
        transition: all 0.2s;
      }

      .view-export-btn:hover {
        background: #f3f4f6;
        border-color: #9ca3af;
      }

      .view-header-meta {
        font-size: 12px;
        color: #6b7280;
        display: flex;
        gap: 8px;
      }

      .view-count {
        font-weight: 500;
      }
    `;
    document.head.appendChild(style);
  }

  destroy() {
    if (this._freshnessIndicator) {
      this._freshnessIndicator.destroy();
    }
    this.container.innerHTML = '';
  }
}

// ============================================================================
// ExportDialog - Export creates a frozen snapshot
// ============================================================================

/**
 * ExportDialog - Export is when data is "saved"
 *
 * Key message: "Export creates a frozen snapshot of your current view.
 * This snapshot becomes a new source that will not change."
 */
class ExportDialog {
  constructor(query, sourceHandle) {
    this._query = query;
    this._sourceHandle = sourceHandle;
    this._dialog = null;
  }

  show() {
    const freshness = this._sourceHandle.getFreshness();

    this._dialog = document.createElement('div');
    this._dialog.className = 'eo-export-dialog-overlay';
    this._dialog.innerHTML = `
      <div class="eo-export-dialog">
        <div class="export-dialog-header">
          <h3>Export Snapshot</h3>
          <button class="export-close-btn" aria-label="Close">×</button>
        </div>

        <div class="export-dialog-body">
          <div class="export-info-box">
            <div class="export-info-icon">📸</div>
            <div class="export-info-text">
              <strong>Export creates a frozen snapshot</strong>
              <p>This snapshot captures your current view at this moment.
              It becomes a new source that will not change, even if the
              original data updates.</p>
            </div>
          </div>

          <div class="export-source-info">
            <div class="export-source-row">
              <span class="label">Source:</span>
              <span class="value">${this._sourceHandle.name}</span>
            </div>
            <div class="export-source-row">
              <span class="label">Data freshness:</span>
              <span class="value ${freshness.status}">${freshness.message}</span>
            </div>
            <div class="export-source-row">
              <span class="label">View:</span>
              <span class="value">${this._query.name}</span>
            </div>
          </div>

          <div class="export-warning ${freshness.status === 'stale' ? 'visible' : ''}">
            ⚠️ Your source data is stale. Consider refreshing before exporting
            to ensure you capture the latest information.
          </div>

          <div class="export-form">
            <label for="export-name">Snapshot name:</label>
            <input type="text" id="export-name"
                   value="${this._query.name} - ${new Date().toLocaleDateString()}"
                   placeholder="Enter a name for this snapshot">

            <label for="export-format">Format:</label>
            <select id="export-format">
              <option value="eo">EO Snapshot (.eo) - Full provenance</option>
              <option value="csv">CSV - Spreadsheet compatible</option>
              <option value="json">JSON - Structured data</option>
            </select>
          </div>
        </div>

        <div class="export-dialog-footer">
          <button class="export-cancel-btn">Cancel</button>
          <button class="export-refresh-btn">↻ Refresh First</button>
          <button class="export-confirm-btn">Export Snapshot</button>
        </div>
      </div>
    `;

    document.body.appendChild(this._dialog);
    this._ensureStyles();
    this._attachHandlers();
  }

  _attachHandlers() {
    this._dialog.querySelector('.export-close-btn').addEventListener('click', () => this.hide());
    this._dialog.querySelector('.export-cancel-btn').addEventListener('click', () => this.hide());

    this._dialog.querySelector('.export-refresh-btn').addEventListener('click', async () => {
      await this._sourceHandle.refresh();
      // Re-render with fresh info
      this.hide();
      this.show();
    });

    this._dialog.querySelector('.export-confirm-btn').addEventListener('click', async () => {
      await this._doExport();
    });

    // Close on backdrop click
    this._dialog.addEventListener('click', (e) => {
      if (e.target === this._dialog) {
        this.hide();
      }
    });
  }

  async _doExport() {
    const name = this._dialog.querySelector('#export-name').value;
    const format = this._dialog.querySelector('#export-format').value;

    // Collect all records from the query
    const records = [];
    for await (const record of this._query.streamAll()) {
      records.push(record);
    }

    // Create export based on format
    let blob, filename;
    const timestamp = new Date().toISOString();

    switch (format) {
      case 'csv':
        const csv = this._toCSV(records);
        blob = new Blob([csv], { type: 'text/csv' });
        filename = `${name}.csv`;
        break;

      case 'json':
        const json = JSON.stringify(records, null, 2);
        blob = new Blob([json], { type: 'application/json' });
        filename = `${name}.json`;
        break;

      case 'eo':
      default:
        const eoExport = this._toEOSnapshot(records, name, timestamp);
        blob = new Blob([JSON.stringify(eoExport, null, 2)], { type: 'application/json' });
        filename = `${name}.eo.json`;
        break;
    }

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    this.hide();
  }

  _toCSV(records) {
    if (records.length === 0) return '';

    const headers = Object.keys(records[0]).filter(k => !k.startsWith('_'));
    const rows = [headers.join(',')];

    for (const record of records) {
      const values = headers.map(h => {
        const val = record[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val);
      });
      rows.push(values.join(','));
    }

    return rows.join('\n');
  }

  _toEOSnapshot(records, name, timestamp) {
    return {
      type: 'eo_export',
      version: '1.0',
      meta: {
        name,
        exportedAt: timestamp,
        exportedBy: 'user',  // Would come from auth
        source: {
          id: this._sourceHandle.id,
          name: this._sourceHandle.name,
          lastSyncAt: this._sourceHandle.sync.lastSyncAt
        },
        query: this._query.toJSON(),
        recordCount: records.length
      },
      provenance: {
        grounding: {
          sourceId: this._sourceHandle.id,
          querySpec: this._query.spec,
          snapshotTime: timestamp
        },
        epistemicType: 'given',  // Export becomes GIVEN
        claim: `Frozen snapshot of "${this._query.name}" from "${this._sourceHandle.name}"`
      },
      records
    };
  }

  hide() {
    if (this._dialog) {
      this._dialog.remove();
      this._dialog = null;
    }
  }

  _ensureStyles() {
    if (document.getElementById('eo-export-dialog-styles')) return;

    const style = document.createElement('style');
    style.id = 'eo-export-dialog-styles';
    style.textContent = `
      .eo-export-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }

      .eo-export-dialog {
        background: white;
        border-radius: 12px;
        width: 480px;
        max-width: 90vw;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      }

      .export-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
      }

      .export-dialog-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }

      .export-close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #9ca3af;
        padding: 0;
        line-height: 1;
      }

      .export-close-btn:hover {
        color: #374151;
      }

      .export-dialog-body {
        padding: 20px;
      }

      .export-info-box {
        display: flex;
        gap: 12px;
        background: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
      }

      .export-info-icon {
        font-size: 32px;
      }

      .export-info-text strong {
        display: block;
        margin-bottom: 4px;
        color: #0c4a6e;
      }

      .export-info-text p {
        margin: 0;
        font-size: 13px;
        color: #0369a1;
        line-height: 1.5;
      }

      .export-source-info {
        background: #f9fafb;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
      }

      .export-source-row {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        font-size: 13px;
      }

      .export-source-row .label {
        color: #6b7280;
      }

      .export-source-row .value {
        font-weight: 500;
        color: #1f2937;
      }

      .export-source-row .value.fresh {
        color: #22c55e;
      }

      .export-source-row .value.stale {
        color: #eab308;
      }

      .export-warning {
        display: none;
        background: #fef3c7;
        border: 1px solid #fcd34d;
        border-radius: 6px;
        padding: 10px 12px;
        font-size: 13px;
        color: #92400e;
        margin-bottom: 16px;
      }

      .export-warning.visible {
        display: block;
      }

      .export-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .export-form label {
        font-size: 13px;
        font-weight: 500;
        color: #374151;
        margin-top: 8px;
      }

      .export-form input,
      .export-form select {
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
      }

      .export-form input:focus,
      .export-form select:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .export-dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
        border-radius: 0 0 12px 12px;
      }

      .export-dialog-footer button {
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .export-cancel-btn {
        background: white;
        border: 1px solid #d1d5db;
        color: #374151;
      }

      .export-cancel-btn:hover {
        background: #f3f4f6;
      }

      .export-refresh-btn {
        background: white;
        border: 1px solid #3b82f6;
        color: #3b82f6;
      }

      .export-refresh-btn:hover {
        background: #eff6ff;
      }

      .export-confirm-btn {
        background: #3b82f6;
        border: 1px solid #3b82f6;
        color: white;
      }

      .export-confirm-btn:hover {
        background: #2563eb;
      }
    `;
    document.head.appendChild(style);
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FreshnessIndicator,
    ViewHeader,
    ExportDialog
  };
}

if (typeof window !== 'undefined') {
  window.EOFreshnessIndicator = FreshnessIndicator;
  window.EOViewHeader = ViewHeader;
  window.EOExportDialog = ExportDialog;
}
