/**
 * EO Workbench - User Interface Controller
 *
 * Manages the UI for the Experience Engine application.
 */

class EOWorkbench {
  constructor() {
    this.app = null;
    this.currentView = 'dashboard';
    this.selectedEntity = null;
    this.modal = null;
  }

  /**
   * Initialize the workbench
   */
  async init() {
    console.log('EOWorkbench: Initializing...');

    // Initialize the app
    this.app = await initApp({
      actor: 'user_' + Math.random().toString(36).substr(2, 6)
    });
    this.app.setUI(this);

    // Set up event listeners
    this._setupEventListeners();

    // Subscribe to app events
    this.app.on('event', () => this._updateEventLog());
    this.app.on('compliance', (report) => this._updateComplianceBadge(report));
    this.app.on('given_recorded', () => this._updateStats());
    this.app.on('meant_recorded', () => this._updateStats());

    // Initial render
    this._render();

    console.log('EOWorkbench: Initialized');
  }

  /**
   * Set up DOM event listeners
   */
  _setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        if (view) this._switchView(view);
      });
    });

    // Modal close
    document.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this._closeModal();
      }
    });

    document.querySelector('.modal-close')?.addEventListener('click', () => {
      this._closeModal();
    });

    // New Given button
    document.getElementById('btn-new-given')?.addEventListener('click', () => {
      this._showNewGivenModal();
    });

    // New Meant button
    document.getElementById('btn-new-meant')?.addEventListener('click', () => {
      this._showNewMeantModal();
    });

    // Run compliance check
    document.getElementById('btn-run-compliance')?.addEventListener('click', () => {
      this._runComplianceCheck();
    });

    // Export data
    document.getElementById('btn-export')?.addEventListener('click', () => {
      this._exportData();
    });
  }

  /**
   * Switch to a different view
   */
  _switchView(view) {
    this.currentView = view;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });

    // Show/hide sections
    document.querySelectorAll('.view-section').forEach(section => {
      section.style.display = section.dataset.view === view ? 'block' : 'none';
    });

    // Update header title
    const titles = {
      dashboard: 'Dashboard',
      workbench: 'Data Workbench',
      events: 'Event Log',
      graph: 'Experience Graph',
      entities: 'Entities',
      compliance: 'Compliance',
      settings: 'Settings'
    };
    document.querySelector('.header-title').textContent = titles[view] || view;

    // Refresh the view
    this._renderView(view);
  }

  /**
   * Render the current view
   */
  _render() {
    this._updateStats();
    this._updateEventLog();
    this._updateEntities();
    this._updateComplianceReport();
    this._switchView(this.currentView);
  }

  /**
   * Render a specific view
   */
  _renderView(view) {
    switch (view) {
      case 'dashboard':
        this._updateStats();
        this._updateEventLog();
        break;
      case 'events':
        this._updateEventLog();
        break;
      case 'entities':
        this._updateEntities();
        break;
      case 'compliance':
        this._updateComplianceReport();
        break;
    }
  }

  /**
   * Update statistics display
   */
  _updateStats() {
    const stats = this.app.getStats();

    document.getElementById('stat-total-events').textContent = stats.events.total;
    document.getElementById('stat-given-count').textContent = stats.events.given;
    document.getElementById('stat-meant-count').textContent = stats.events.meant;
    document.getElementById('stat-horizons').textContent = stats.horizons;
  }

  /**
   * Update event log display
   */
  _updateEventLog() {
    const container = document.getElementById('event-log-container');
    if (!container) return;

    const events = this.app.getEventLog().slice(-50).reverse();

    if (events.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No events yet</div>
          <div class="empty-state-description">
            Record your first experience to get started
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = events.map(event => this._renderEventItem(event)).join('');
  }

  /**
   * Render a single event item
   */
  _renderEventItem(event) {
    const isGiven = event.type === 'given';
    const time = new Date(event.timestamp).toLocaleTimeString();
    const payload = JSON.stringify(event.payload, null, 2).substring(0, 100);

    return `
      <div class="event-item" data-event-id="${event.id}">
        <div class="event-type-indicator ${event.type}"></div>
        <div class="event-content">
          <div class="event-header">
            <span class="event-actor">${event.actor}</span>
            <span class="event-type-label ${event.type}">${event.type.toUpperCase()}</span>
            <span class="event-time">${time}</span>
          </div>
          <div class="event-payload">${this._escapeHtml(payload)}${payload.length >= 100 ? '...' : ''}</div>
          <div class="event-meta">
            ${event.mode ? `<span>Mode: ${event.mode}</span>` : ''}
            ${event.provenance ? `<span class="event-provenance">Provenance: ${event.provenance.length} events</span>` : ''}
            ${event.frame ? `<span>Frame: ${event.frame.purpose}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Update entities display
   */
  _updateEntities() {
    const container = document.getElementById('entity-grid-container');
    if (!container) return;

    const entities = this.app.getEntities();

    if (entities.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-title">No entities yet</div>
          <div class="empty-state-description">
            Create entities from your recorded experiences
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = entities.map(entity => this._renderEntityCard(entity)).join('');
  }

  /**
   * Render an entity card
   */
  _renderEntityCard(entity) {
    const data = entity.data || {};
    const title = data.title || data.name || entity.id;
    const description = data.description || JSON.stringify(data).substring(0, 100);

    return `
      <div class="entity-card" data-entity-id="${entity.id}">
        <div class="entity-header">
          <div>
            <div class="entity-type">${entity.type}</div>
            <div class="entity-title">${this._escapeHtml(title)}</div>
          </div>
        </div>
        <div class="entity-body">${this._escapeHtml(description)}</div>
        <div class="entity-footer">
          <span>v${entity.version}</span>
          <span>${entity.sourceEvents.length} events</span>
        </div>
      </div>
    `;
  }

  /**
   * Update compliance badge
   */
  _updateComplianceBadge(report) {
    const badge = document.getElementById('compliance-badge');
    if (!badge) return;

    const level = report.audit.conformanceLevel;
    const levelClass = level.toLowerCase().replace('_', '-');

    badge.className = 'compliance-badge ' + levelClass.split('-')[0];
    badge.innerHTML = `
      <span>${report.audit.summary.passed}/${report.audit.summary.total}</span>
      <span>${level.replace('_', ' ')}</span>
    `;
  }

  /**
   * Update compliance report
   */
  _updateComplianceReport() {
    const container = document.getElementById('compliance-report');
    if (!container) return;

    const report = this.app.runComplianceCheck();

    container.innerHTML = `
      <div class="rule-list">
        ${report.rules.map(rule => this._renderRuleItem(rule)).join('')}
      </div>
    `;
  }

  /**
   * Render a rule item in compliance report
   */
  _renderRuleItem(rule) {
    return `
      <div class="rule-item">
        <div class="rule-status ${rule.passed ? 'pass' : 'fail'}">
          ${rule.passed ? '✓' : '✗'}
        </div>
        <div class="rule-info">
          <div class="rule-name">Rule ${rule.rule}: ${rule.name}</div>
          <div class="rule-description">
            ${rule.passed ? 'All checks passed' : `${rule.violations.length} violation(s)`}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Show the new Given modal
   */
  _showNewGivenModal() {
    const modal = document.querySelector('.modal');
    const overlay = document.querySelector('.modal-overlay');

    modal.querySelector('.modal-title').textContent = 'Record Given Experience';
    modal.querySelector('.modal-body').innerHTML = `
      <form id="form-new-given">
        <div class="form-group">
          <label class="form-label">Mode</label>
          <select class="form-select" name="mode">
            <option value="perceived">Perceived</option>
            <option value="reported">Reported</option>
            <option value="measured">Measured</option>
            <option value="received">Received</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Action</label>
          <input type="text" class="form-input" name="action" placeholder="e.g., observation, measurement">
        </div>
        <div class="form-group">
          <label class="form-label">Content</label>
          <textarea class="form-textarea" name="content" placeholder="Describe the raw experience..."></textarea>
        </div>
      </form>
    `;

    modal.querySelector('.modal-footer').innerHTML = `
      <button class="btn btn-outline" onclick="workbench._closeModal()">Cancel</button>
      <button class="btn btn-given" onclick="workbench._submitNewGiven()">Record Given</button>
    `;

    overlay.classList.add('active');
  }

  /**
   * Submit new Given form
   */
  _submitNewGiven() {
    const form = document.getElementById('form-new-given');
    const mode = form.mode.value;
    const action = form.action.value || 'observation';
    const content = form.content.value;

    if (!content) {
      alert('Please enter content for the experience');
      return;
    }

    const result = this.app.recordGiven(mode, {
      action,
      content
    });

    if (result.success) {
      this._closeModal();
      this._render();
    } else {
      alert('Failed to record: ' + (result.error || result.errors?.join(', ')));
    }
  }

  /**
   * Show the new Meant modal
   */
  _showNewMeantModal() {
    const modal = document.querySelector('.modal');
    const overlay = document.querySelector('.modal-overlay');

    // Get Given events for provenance selection
    const givenEvents = this.app.getGivenEvents().slice(-20);

    modal.querySelector('.modal-title').textContent = 'Record Interpretation';
    modal.querySelector('.modal-body').innerHTML = `
      <form id="form-new-meant">
        <div class="form-group">
          <label class="form-label">Purpose (Frame)</label>
          <input type="text" class="form-input" name="purpose" placeholder="e.g., summary, analysis, categorization">
        </div>
        <div class="form-group">
          <label class="form-label">Interpretation</label>
          <textarea class="form-textarea" name="interpretation" placeholder="Your interpretation of the experiences..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Provenance (select source experiences)</label>
          <div class="provenance-list" style="max-height: 200px; overflow-y: auto;">
            ${givenEvents.map(e => `
              <label style="display: flex; gap: 8px; padding: 8px; cursor: pointer;">
                <input type="checkbox" name="provenance" value="${e.id}">
                <span style="font-size: 12px; color: var(--text-secondary);">
                  ${e.payload?.action || 'event'}: ${(e.payload?.content || JSON.stringify(e.payload)).substring(0, 50)}...
                </span>
              </label>
            `).join('')}
          </div>
        </div>
      </form>
    `;

    modal.querySelector('.modal-footer').innerHTML = `
      <button class="btn btn-outline" onclick="workbench._closeModal()">Cancel</button>
      <button class="btn btn-meant" onclick="workbench._submitNewMeant()">Record Interpretation</button>
    `;

    overlay.classList.add('active');
  }

  /**
   * Submit new Meant form
   */
  _submitNewMeant() {
    const form = document.getElementById('form-new-meant');
    const purpose = form.purpose.value || 'interpretation';
    const interpretation = form.interpretation.value;
    const provenanceInputs = form.querySelectorAll('input[name="provenance"]:checked');
    const provenance = Array.from(provenanceInputs).map(input => input.value);

    if (!interpretation) {
      alert('Please enter an interpretation');
      return;
    }

    if (provenance.length === 0) {
      alert('Rule 7: Interpretations must have provenance. Please select at least one source experience.');
      return;
    }

    const result = this.app.recordMeant(purpose, { content: interpretation }, provenance);

    if (result.success) {
      this._closeModal();
      this._render();
    } else {
      alert('Failed to record: ' + (result.error || result.errors?.join(', ')));
    }
  }

  /**
   * Close the modal
   */
  _closeModal() {
    document.querySelector('.modal-overlay')?.classList.remove('active');
  }

  /**
   * Run compliance check
   */
  _runComplianceCheck() {
    const report = this.app.runComplianceCheck();
    this._updateComplianceReport();
    this._updateComplianceBadge(report);

    const reportText = this.app.complianceChecker.generateReport(
      this.app.complianceChecker.runAudit()
    );

    console.log(reportText);
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
    a.download = `experience-engine-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Escape HTML
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global instance
let workbench = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  workbench = new EOWorkbench();
  await workbench.init();
});
