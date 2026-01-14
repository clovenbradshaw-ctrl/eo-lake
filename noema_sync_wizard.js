/**
 * EO Sync Wizard - Step-by-step cloud sync configuration
 *
 * Provides a guided wizard experience for setting up and managing
 * cloud synchronization using the EOModal system.
 */

// ============================================================================
// EOSyncWizard - Main Wizard Controller
// ============================================================================

class EOSyncWizard {
  constructor(syncAPI) {
    this.syncAPI = syncAPI;
    this.wizard = null;
  }

  /**
   * Show the sync wizard
   * Automatically determines which view to show based on current config
   */
  show() {
    const status = this.syncAPI.getStatus();

    if (status.configured && status.enabled) {
      // Already configured and enabled - show status modal
      this._showStatusModal();
    } else if (status.configured) {
      // Configured but not enabled - show enable prompt
      this._showEnableModal();
    } else {
      // Not configured - show welcome wizard
      this._showWelcomeWizard();
    }
  }

  /**
   * Show the welcome/setup wizard for first-time users
   */
  _showWelcomeWizard() {
    const status = this.syncAPI.getStatus();

    this.wizard = new EOWizardModal({
      id: 'sync-wizard',
      size: 'medium',
      onComplete: async (data, wizard) => {
        await this._completeSetup(data, wizard);
      },
      onCancel: () => {
        // User cancelled - stay local only
      }
    });

    this.wizard.setSteps([
      // Step 1: Welcome
      {
        title: 'Cloud Sync',
        shortTitle: 'Welcome',
        content: (data) => `
          <div class="sync-wizard-welcome">
            <div class="sync-wizard-icon">
              <i class="ph ph-cloud-arrow-up"></i>
            </div>
            <p class="sync-wizard-intro">
              Your data is stored locally in your browser. Set up cloud sync to:
            </p>
            <ul class="sync-wizard-benefits">
              <li><i class="ph ph-shield-check"></i> Backup your data automatically</li>
              <li><i class="ph ph-devices"></i> Sync across multiple devices</li>
              <li><i class="ph ph-arrow-counter-clockwise"></i> Recover if you clear browser data</li>
            </ul>
            <div class="sync-wizard-local-status">
              <div class="sync-wizard-status-header">
                <i class="ph ph-database"></i> Local Storage Status
              </div>
              <div class="sync-wizard-status-row">
                <span>Events stored:</span>
                <strong>${status.localEventCount.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        `,
        showBack: false,
        nextLabel: 'Set Up Cloud Sync',
        buttons: [
          {
            label: 'Continue without sync',
            action: 'skip',
            secondary: true,
            onClick: (e, wizard) => wizard.hide()
          },
          {
            label: 'Set Up Cloud Sync',
            icon: 'ph-arrow-right',
            action: 'next',
            primary: true,
            onClick: (e, wizard) => wizard.next()
          }
        ]
      },

      // Step 2: Configuration
      {
        title: 'Connect Your Server',
        shortTitle: 'Configure',
        content: (data) => `
          <div class="sync-wizard-config">
            <div class="sync-wizard-field">
              <label for="sync-wiz-endpoint">API Endpoint</label>
              <input
                type="url"
                id="sync-wiz-endpoint"
                name="endpoint"
                placeholder="https://api.example.com"
                value="${data.endpoint || ''}"
                autocomplete="off"
              >
              <span class="sync-wizard-hint">The base URL of your sync API server</span>
            </div>

            <div class="sync-wizard-field">
              <label for="sync-wiz-token">Auth Token</label>
              <div class="sync-wizard-token-input">
                <input
                  type="password"
                  id="sync-wiz-token"
                  name="authToken"
                  placeholder="Bearer token or API key"
                  value="${data.authToken || ''}"
                  autocomplete="off"
                >
                <button type="button" class="sync-wizard-token-toggle" id="sync-wiz-token-toggle">
                  <i class="ph ph-eye"></i>
                </button>
              </div>
              <span class="sync-wizard-hint">Authentication token for API requests</span>
            </div>

            <div class="sync-wizard-field">
              <label for="sync-wiz-workspace">Workspace ID</label>
              <input
                type="text"
                id="sync-wiz-workspace"
                name="workspaceId"
                placeholder="default"
                value="${data.workspaceId || 'default'}"
                autocomplete="off"
              >
              <span class="sync-wizard-hint">Identifier for this workspace on the server (optional)</span>
            </div>
          </div>
        `,
        onEnter: () => {
          // Setup token toggle
          const toggleBtn = document.getElementById('sync-wiz-token-toggle');
          const tokenInput = document.getElementById('sync-wiz-token');
          if (toggleBtn && tokenInput) {
            toggleBtn.addEventListener('click', () => {
              if (tokenInput.type === 'password') {
                tokenInput.type = 'text';
                toggleBtn.innerHTML = '<i class="ph ph-eye-slash"></i>';
              } else {
                tokenInput.type = 'password';
                toggleBtn.innerHTML = '<i class="ph ph-eye"></i>';
              }
            });
          }
        },
        validate: (inputs, wizard) => {
          if (!inputs.endpoint || !inputs.endpoint.trim()) {
            this._showFieldError('sync-wiz-endpoint', 'API endpoint is required');
            return false;
          }
          if (!inputs.authToken || !inputs.authToken.trim()) {
            this._showFieldError('sync-wiz-token', 'Auth token is required');
            return false;
          }
          try {
            new URL(inputs.endpoint);
          } catch {
            this._showFieldError('sync-wiz-endpoint', 'Please enter a valid URL');
            return false;
          }
          return true;
        },
        collectData: (inputs) => ({
          endpoint: inputs.endpoint.trim(),
          authToken: inputs.authToken.trim(),
          workspaceId: inputs.workspaceId?.trim() || 'default'
        }),
        nextLabel: 'Test Connection'
      },

      // Step 3: Test Connection
      {
        title: 'Testing Connection',
        shortTitle: 'Test',
        content: () => `
          <div class="sync-wizard-test">
            <div class="sync-wizard-test-status" id="sync-wiz-test-status">
              <div class="sync-wizard-spinner"></div>
              <span>Connecting to server...</span>
            </div>
          </div>
        `,
        showBack: true,
        buttons: [], // No buttons during testing
        onEnter: async (data, wizard) => {
          await this._testConnection(data, wizard);
        }
      },

      // Step 4: Success / Enable
      {
        title: 'Connection Successful',
        shortTitle: 'Enable',
        content: (data) => `
          <div class="sync-wizard-success">
            <div class="sync-wizard-success-icon">
              <i class="ph ph-check-circle"></i>
            </div>
            <p class="sync-wizard-success-text">Successfully connected to your sync server!</p>
            <div class="sync-wizard-server-info">
              <div class="sync-wizard-info-row">
                <span>Server:</span>
                <strong>${this._getHostname(data.endpoint)}</strong>
              </div>
              <div class="sync-wizard-info-row">
                <span>Workspace:</span>
                <strong>${data.workspaceId}</strong>
              </div>
            </div>
            <div class="sync-wizard-enable-toggle">
              <label class="sync-wizard-toggle-label">
                <input type="checkbox" name="enabled" checked>
                <span class="sync-wizard-toggle-slider"></span>
                <span>Enable automatic sync</span>
              </label>
            </div>
          </div>
        `,
        collectData: (inputs) => ({
          enabled: inputs.enabled
        }),
        finishLabel: 'Save & Enable Sync'
      }
    ]);

    this.wizard.show();
  }

  /**
   * Show status modal for configured users
   */
  _showStatusModal() {
    const status = this.syncAPI.getStatus();
    const config = this.syncAPI.config;

    const modal = new EOModal({
      id: 'sync-status-modal',
      title: 'Sync Status',
      size: 'medium',
      content: `
        <div class="sync-status-view">
          <div class="sync-status-indicator ${status.syncInProgress ? 'syncing' : 'ready'}">
            <i class="ph ${status.syncInProgress ? 'ph-arrows-clockwise spinning' : 'ph-cloud-check'}"></i>
            <span>${status.syncInProgress ? 'Syncing...' : 'Cloud sync enabled'}</span>
          </div>

          <div class="sync-status-info">
            <div class="sync-status-row">
              <span>Server:</span>
              <strong>${this._getHostname(config.endpoint)}</strong>
            </div>
            <div class="sync-status-row">
              <span>Workspace:</span>
              <strong>${config.workspaceId}</strong>
            </div>
            ${status.lastSync ? `
              <div class="sync-status-row">
                <span>Last sync:</span>
                <strong>${this._formatTimeAgo(status.lastSync.timestamp)}</strong>
              </div>
              <div class="sync-status-row">
                <span>Events pushed:</span>
                <strong>${status.lastSync.pushedCount || 0}</strong>
              </div>
              <div class="sync-status-row">
                <span>Events pulled:</span>
                <strong>${status.lastSync.pulledCount || 0}</strong>
              </div>
            ` : ''}
            <div class="sync-status-row">
              <span>Local events:</span>
              <strong>${status.localEventCount.toLocaleString()}</strong>
            </div>
          </div>

          ${status.lastError ? `
            <div class="sync-status-error">
              <i class="ph ph-warning-circle"></i>
              <span>${status.lastError}</span>
            </div>
          ` : ''}
        </div>
      `,
      buttons: [
        {
          label: 'Settings',
          icon: 'ph-gear',
          action: 'settings',
          secondary: true,
          onClick: () => {
            modal.hide();
            setTimeout(() => this._showSettingsModal(), 250);
          }
        },
        {
          label: 'Sync Now',
          icon: 'ph-arrows-clockwise',
          action: 'sync',
          primary: true,
          disabled: status.syncInProgress,
          onClick: async (e, m) => {
            await this._performSync(m);
          }
        }
      ]
    });

    modal.show();
  }

  /**
   * Show enable modal for configured but disabled sync
   */
  _showEnableModal() {
    const status = this.syncAPI.getStatus();
    const config = this.syncAPI.config;

    const modal = new EOModal({
      id: 'sync-enable-modal',
      title: 'Enable Cloud Sync',
      size: 'medium',
      content: `
        <div class="sync-enable-view">
          <div class="sync-enable-icon">
            <i class="ph ph-cloud-slash"></i>
          </div>
          <p>Cloud sync is configured but not enabled.</p>
          <div class="sync-status-info">
            <div class="sync-status-row">
              <span>Server:</span>
              <strong>${this._getHostname(config.endpoint)}</strong>
            </div>
            <div class="sync-status-row">
              <span>Workspace:</span>
              <strong>${config.workspaceId}</strong>
            </div>
            <div class="sync-status-row">
              <span>Local events:</span>
              <strong>${status.localEventCount.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      `,
      buttons: [
        {
          label: 'Settings',
          icon: 'ph-gear',
          action: 'settings',
          secondary: true,
          onClick: () => {
            modal.hide();
            setTimeout(() => this._showSettingsModal(), 250);
          }
        },
        {
          label: 'Enable Sync',
          icon: 'ph-cloud-arrow-up',
          action: 'enable',
          primary: true,
          onClick: async (e, m) => {
            this.syncAPI.configure({ enabled: true });
            m.hide();
            setTimeout(() => this._showStatusModal(), 250);
          }
        }
      ]
    });

    modal.show();
  }

  /**
   * Show settings modal for editing configuration
   */
  _showSettingsModal() {
    const config = this.syncAPI.config;

    const modal = new EOModal({
      id: 'sync-settings-modal',
      title: 'Sync Settings',
      size: 'medium',
      content: `
        <div class="sync-wizard-config">
          <div class="sync-wizard-field">
            <label for="sync-set-endpoint">API Endpoint</label>
            <input
              type="url"
              id="sync-set-endpoint"
              name="endpoint"
              placeholder="https://api.example.com"
              value="${config.endpoint || ''}"
              autocomplete="off"
            >
          </div>

          <div class="sync-wizard-field">
            <label for="sync-set-token">Auth Token</label>
            <div class="sync-wizard-token-input">
              <input
                type="password"
                id="sync-set-token"
                name="authToken"
                placeholder="Bearer token or API key"
                value="${config.authToken || ''}"
                autocomplete="off"
              >
              <button type="button" class="sync-wizard-token-toggle" id="sync-set-token-toggle">
                <i class="ph ph-eye"></i>
              </button>
            </div>
          </div>

          <div class="sync-wizard-field">
            <label for="sync-set-workspace">Workspace ID</label>
            <input
              type="text"
              id="sync-set-workspace"
              name="workspaceId"
              placeholder="default"
              value="${config.workspaceId || 'default'}"
              autocomplete="off"
            >
          </div>

          <div class="sync-wizard-field">
            <label class="sync-wizard-toggle-label">
              <input type="checkbox" name="enabled" id="sync-set-enabled" ${config.enabled ? 'checked' : ''}>
              <span class="sync-wizard-toggle-slider"></span>
              <span>Enable sync</span>
            </label>
          </div>

          <div class="sync-settings-actions">
            <button type="button" class="eo-modal-btn eo-modal-btn-secondary" id="sync-set-test">
              <i class="ph ph-plugs"></i> Test Connection
            </button>
          </div>
        </div>
      `,
      buttons: [
        {
          label: 'Cancel',
          action: 'cancel',
          secondary: true,
          onClick: (e, m) => m.hide()
        },
        {
          label: 'Save Settings',
          icon: 'ph-check',
          action: 'save',
          primary: true,
          onClick: async (e, m) => {
            await this._saveSettings(m);
          }
        }
      ]
    });

    modal.show();

    // Setup token toggle after modal is shown
    setTimeout(() => {
      const toggleBtn = document.getElementById('sync-set-token-toggle');
      const tokenInput = document.getElementById('sync-set-token');
      if (toggleBtn && tokenInput) {
        toggleBtn.addEventListener('click', () => {
          if (tokenInput.type === 'password') {
            tokenInput.type = 'text';
            toggleBtn.innerHTML = '<i class="ph ph-eye-slash"></i>';
          } else {
            tokenInput.type = 'password';
            toggleBtn.innerHTML = '<i class="ph ph-eye"></i>';
          }
        });
      }

      const testBtn = document.getElementById('sync-set-test');
      if (testBtn) {
        testBtn.addEventListener('click', async () => {
          await this._testSettingsConnection(modal);
        });
      }
    }, 100);
  }

  // Private helper methods

  async _testConnection(data, wizard) {
    const statusEl = document.getElementById('sync-wiz-test-status');

    try {
      // Configure the API with the new settings (but don't enable yet)
      this.syncAPI.configure({
        endpoint: data.endpoint,
        authToken: data.authToken,
        workspaceId: data.workspaceId,
        enabled: false
      });

      // Test the connection
      const result = await this.syncAPI.testConnection();

      if (result.success) {
        // Move to success step
        wizard.next();
      } else {
        // Show error and allow retry
        statusEl.innerHTML = `
          <div class="sync-wizard-test-error">
            <i class="ph ph-x-circle"></i>
            <span>${result.error || 'Connection failed'}</span>
          </div>
        `;
        wizard.setButtons([
          {
            label: 'Back',
            action: 'back',
            secondary: true,
            onClick: () => wizard.prev()
          },
          {
            label: 'Retry',
            icon: 'ph-arrow-clockwise',
            action: 'retry',
            primary: true,
            onClick: () => this._testConnection(data, wizard)
          }
        ]);
      }
    } catch (error) {
      statusEl.innerHTML = `
        <div class="sync-wizard-test-error">
          <i class="ph ph-x-circle"></i>
          <span>${error.message || 'Connection failed'}</span>
        </div>
      `;
      wizard.setButtons([
        {
          label: 'Back',
          action: 'back',
          secondary: true,
          onClick: () => wizard.prev()
        },
        {
          label: 'Retry',
          icon: 'ph-arrow-clockwise',
          action: 'retry',
          primary: true,
          onClick: () => this._testConnection(data, wizard)
        }
      ]);
    }
  }

  async _completeSetup(data, wizard) {
    // Save the configuration with enabled state
    this.syncAPI.configure({
      endpoint: data.endpoint,
      authToken: data.authToken,
      workspaceId: data.workspaceId,
      enabled: data.enabled
    });

    wizard.hide();

    // Show a toast notification
    if (typeof window._dataWorkbench?._showToast === 'function') {
      window._dataWorkbench._showToast('Cloud sync enabled successfully!', 'success');
    }

    // Trigger initial sync if enabled
    if (data.enabled) {
      this.syncAPI.sync().catch(err => {
        console.error('Initial sync failed:', err);
      });
    }
  }

  async _performSync(modal) {
    const syncBtn = modal.element.querySelector('[data-action="sync"]');
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<i class="ph ph-arrows-clockwise spinning"></i> Syncing...';
    }

    try {
      const result = await this.syncAPI.sync();

      // Refresh the status view
      modal.hide();

      if (typeof window._dataWorkbench?._showToast === 'function') {
        window._dataWorkbench._showToast(
          `Synced: ${result.pushed || 0} pushed, ${result.pulled || 0} pulled`,
          'success'
        );
      }
    } catch (error) {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Sync Now';
      }

      if (typeof window._dataWorkbench?._showToast === 'function') {
        window._dataWorkbench._showToast('Sync failed: ' + error.message, 'error');
      }
    }
  }

  async _saveSettings(modal) {
    const endpoint = document.getElementById('sync-set-endpoint')?.value?.trim();
    const authToken = document.getElementById('sync-set-token')?.value?.trim();
    const workspaceId = document.getElementById('sync-set-workspace')?.value?.trim() || 'default';
    const enabled = document.getElementById('sync-set-enabled')?.checked || false;

    if (!endpoint) {
      this._showFieldError('sync-set-endpoint', 'API endpoint is required');
      return;
    }
    if (!authToken) {
      this._showFieldError('sync-set-token', 'Auth token is required');
      return;
    }

    this.syncAPI.configure({ endpoint, authToken, workspaceId, enabled });

    modal.hide();

    if (typeof window._dataWorkbench?._showToast === 'function') {
      window._dataWorkbench._showToast('Sync settings saved', 'success');
    }
  }

  async _testSettingsConnection(modal) {
    const testBtn = document.getElementById('sync-set-test');
    if (!testBtn) return;

    const originalContent = testBtn.innerHTML;
    testBtn.disabled = true;
    testBtn.innerHTML = '<i class="ph ph-arrows-clockwise spinning"></i> Testing...';

    try {
      const endpoint = document.getElementById('sync-set-endpoint')?.value?.trim();
      const authToken = document.getElementById('sync-set-token')?.value?.trim();
      const workspaceId = document.getElementById('sync-set-workspace')?.value?.trim() || 'default';

      // Temporarily configure for testing
      const prevConfig = { ...this.syncAPI.config };
      this.syncAPI.configure({ endpoint, authToken, workspaceId, enabled: false });

      const result = await this.syncAPI.testConnection();

      if (result.success) {
        testBtn.innerHTML = '<i class="ph ph-check-circle"></i> Connected!';
        testBtn.classList.add('success');
        setTimeout(() => {
          testBtn.innerHTML = originalContent;
          testBtn.classList.remove('success');
          testBtn.disabled = false;
        }, 2000);
      } else {
        testBtn.innerHTML = '<i class="ph ph-x-circle"></i> Failed';
        testBtn.classList.add('error');
        setTimeout(() => {
          testBtn.innerHTML = originalContent;
          testBtn.classList.remove('error');
          testBtn.disabled = false;
        }, 2000);

        // Restore previous config on failure
        this.syncAPI.configure(prevConfig);
      }
    } catch (error) {
      testBtn.innerHTML = '<i class="ph ph-x-circle"></i> Error';
      testBtn.classList.add('error');
      setTimeout(() => {
        testBtn.innerHTML = originalContent;
        testBtn.classList.remove('error');
        testBtn.disabled = false;
      }, 2000);
    }
  }

  _showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.classList.add('error');

    // Remove existing error message
    const existingError = field.parentElement.querySelector('.field-error');
    if (existingError) existingError.remove();

    // Add new error message
    const errorEl = document.createElement('span');
    errorEl.className = 'field-error';
    errorEl.textContent = message;
    field.parentElement.appendChild(errorEl);

    // Remove error state on input
    field.addEventListener('input', () => {
      field.classList.remove('error');
      errorEl.remove();
    }, { once: true });
  }

  _getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  _formatTimeAgo(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

    return date.toLocaleDateString();
  }
}


// ============================================================================
// Factory function
// ============================================================================

/**
 * Create and show the sync wizard
 */
function showSyncWizard(syncAPI) {
  const wizard = new EOSyncWizard(syncAPI);
  wizard.show();
  return wizard;
}


// ============================================================================
// Export
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EOSyncWizard, showSyncWizard };
}

if (typeof window !== 'undefined') {
  window.EOSyncWizard = EOSyncWizard;
  window.showSyncWizard = showSyncWizard;
}
