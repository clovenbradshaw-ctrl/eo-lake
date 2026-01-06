/**
 * EO Modal - Reusable Modal Component System
 *
 * Provides a clean, accessible modal system for the noema application.
 * Supports single modals and multi-step wizards.
 */

// ============================================================================
// EOModal - Base Modal Class
// ============================================================================

class EOModal {
  constructor(options = {}) {
    this.id = options.id || 'eo-modal-' + Date.now();
    this.title = options.title || '';
    this.content = options.content || '';
    this.size = options.size || 'medium'; // small, medium, large
    this.closable = options.closable !== false;
    this.onClose = options.onClose || null;
    this.buttons = options.buttons || [];

    this.element = null;
    this.backdrop = null;
    this._boundKeyHandler = this._handleKeydown.bind(this);
  }

  /**
   * Show the modal
   */
  show() {
    this._create();
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.element);

    // Trigger reflow for animation
    this.backdrop.offsetHeight;
    this.element.offsetHeight;

    this.backdrop.classList.add('visible');
    this.element.classList.add('visible');

    // Add event listeners
    document.addEventListener('keydown', this._boundKeyHandler);

    // Focus first focusable element
    const focusable = this.element.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return this;
  }

  /**
   * Hide the modal
   */
  hide() {
    if (!this.element) return;

    this.backdrop.classList.remove('visible');
    this.element.classList.remove('visible');

    // Wait for animation
    setTimeout(() => this.destroy(), 200);

    return this;
  }

  /**
   * Destroy the modal and clean up
   */
  destroy() {
    document.removeEventListener('keydown', this._boundKeyHandler);

    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
    }
    if (this.element) {
      this.element.remove();
      this.element = null;
    }

    // Restore body scroll if no other modals
    if (!document.querySelector('.eo-modal')) {
      document.body.style.overflow = '';
    }
  }

  /**
   * Update modal content
   */
  setContent(content) {
    this.content = content;
    if (this.element) {
      const body = this.element.querySelector('.eo-modal-body');
      if (body) body.innerHTML = content;
    }
    return this;
  }

  /**
   * Update modal title
   */
  setTitle(title) {
    this.title = title;
    if (this.element) {
      const titleEl = this.element.querySelector('.eo-modal-title');
      if (titleEl) titleEl.textContent = title;
    }
    return this;
  }

  /**
   * Set loading state
   */
  setLoading(loading, message = 'Loading...') {
    if (!this.element) return this;

    const body = this.element.querySelector('.eo-modal-body');
    const footer = this.element.querySelector('.eo-modal-footer');

    if (loading) {
      this._savedContent = body.innerHTML;
      body.innerHTML = `
        <div class="eo-modal-loading">
          <div class="eo-modal-spinner"></div>
          <span>${message}</span>
        </div>
      `;
      if (footer) footer.style.display = 'none';
    } else {
      if (this._savedContent) {
        body.innerHTML = this._savedContent;
        this._savedContent = null;
      }
      if (footer) footer.style.display = '';
    }

    return this;
  }

  /**
   * Show success state
   */
  showSuccess(message, autoClose = 2000) {
    this.setContent(`
      <div class="eo-modal-status eo-modal-success">
        <i class="ph ph-check-circle"></i>
        <span>${message}</span>
      </div>
    `);

    if (autoClose) {
      setTimeout(() => this.hide(), autoClose);
    }

    return this;
  }

  /**
   * Show error state
   */
  showError(message) {
    this.setContent(`
      <div class="eo-modal-status eo-modal-error">
        <i class="ph ph-warning-circle"></i>
        <span>${message}</span>
      </div>
    `);

    return this;
  }

  /**
   * Update footer buttons
   */
  setButtons(buttons) {
    this.buttons = buttons;
    if (this.element) {
      let footer = this.element.querySelector('.eo-modal-footer');
      if (!footer && buttons.length > 0) {
        // Create footer if it doesn't exist but we have buttons to render
        footer = document.createElement('div');
        footer.className = 'eo-modal-footer';
        this.element.appendChild(footer);
      }
      if (footer) {
        footer.innerHTML = this._renderButtons();
        this._attachButtonHandlers(footer);
      }
    }
    return this;
  }

  // Private methods

  _create() {
    // Create backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'eo-modal-backdrop';
    this.backdrop.id = this.id + '-backdrop';

    if (this.closable) {
      this.backdrop.addEventListener('click', () => this.hide());
    }

    // Create modal
    this.element = document.createElement('div');
    this.element.className = `eo-modal eo-modal-${this.size}`;
    this.element.id = this.id;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');

    this.element.innerHTML = `
      <div class="eo-modal-header">
        <h3 class="eo-modal-title">${this.title}</h3>
        ${this.closable ? '<button class="eo-modal-close" aria-label="Close"><i class="ph ph-x"></i></button>' : ''}
      </div>
      <div class="eo-modal-body">
        ${this.content}
      </div>
      ${this.buttons.length > 0 ? `<div class="eo-modal-footer">${this._renderButtons()}</div>` : ''}
    `;

    // Attach event handlers
    if (this.closable) {
      const closeBtn = this.element.querySelector('.eo-modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.hide());
      }
    }

    this._attachButtonHandlers(this.element.querySelector('.eo-modal-footer'));
  }

  _renderButtons() {
    return this.buttons.map(btn => {
      const classes = ['eo-modal-btn'];
      if (btn.primary) classes.push('eo-modal-btn-primary');
      if (btn.secondary) classes.push('eo-modal-btn-secondary');
      if (btn.danger) classes.push('eo-modal-btn-danger');
      if (btn.disabled) classes.push('disabled');

      return `<button class="${classes.join(' ')}" data-action="${btn.action || ''}" ${btn.disabled ? 'disabled' : ''}>
        ${btn.icon ? `<i class="ph ${btn.icon}"></i>` : ''}
        ${btn.label}
      </button>`;
    }).join('');
  }

  _attachButtonHandlers(footer) {
    if (!footer) return;

    footer.querySelectorAll('.eo-modal-btn').forEach(btn => {
      const action = btn.dataset.action;
      const buttonDef = this.buttons.find(b => b.action === action);

      if (buttonDef && buttonDef.onClick) {
        btn.addEventListener('click', (e) => {
          buttonDef.onClick(e, this);
        });
      }
    });
  }

  _handleKeydown(e) {
    if (e.key === 'Escape' && this.closable) {
      this.hide();
    }
  }
}


// ============================================================================
// EOWizardModal - Multi-step Wizard Modal
// ============================================================================

class EOWizardModal extends EOModal {
  constructor(options = {}) {
    super(options);

    this.steps = options.steps || [];
    this.currentStep = 0;
    this.stepData = {}; // Collect data across steps
    this.onComplete = options.onComplete || null;
    this.onCancel = options.onCancel || null;
  }

  /**
   * Define wizard steps
   */
  setSteps(steps) {
    this.steps = steps;
    this.currentStep = 0;
    return this;
  }

  /**
   * Show the wizard at a specific step
   */
  show(startStep = 0) {
    this.currentStep = startStep;
    super.show();
    this._renderStep();
    return this;
  }

  /**
   * Go to next step
   */
  async next() {
    const step = this.steps[this.currentStep];

    // Validate current step if validator exists
    if (step.validate) {
      const isValid = await step.validate(this._getStepInputs(), this);
      if (!isValid) return false;
    }

    // Collect data from current step
    if (step.collectData) {
      Object.assign(this.stepData, step.collectData(this._getStepInputs()));
    }

    // Call onLeave hook
    if (step.onLeave) {
      await step.onLeave(this.stepData, this);
    }

    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this._renderStep();
      return true;
    } else {
      // Wizard complete
      if (this.onComplete) {
        await this.onComplete(this.stepData, this);
      }
      return true;
    }
  }

  /**
   * Go to previous step
   */
  prev() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this._renderStep();
      return true;
    }
    return false;
  }

  /**
   * Go to a specific step by index
   */
  goToStep(index) {
    if (index >= 0 && index < this.steps.length) {
      this.currentStep = index;
      this._renderStep();
      return true;
    }
    return false;
  }

  /**
   * Get current step index
   */
  getCurrentStep() {
    return this.currentStep;
  }

  /**
   * Get collected step data
   */
  getStepData() {
    return this.stepData;
  }

  /**
   * Set step data
   */
  setStepData(data) {
    Object.assign(this.stepData, data);
    return this;
  }

  // Private methods

  _renderStep() {
    const step = this.steps[this.currentStep];
    if (!step) return;

    // Update title
    this.setTitle(step.title || '');

    // Render step content with progress indicator
    const progressHtml = this._renderProgress();
    const contentHtml = typeof step.content === 'function'
      ? step.content(this.stepData, this)
      : step.content;

    const body = this.element.querySelector('.eo-modal-body');
    if (body) {
      body.innerHTML = progressHtml + contentHtml;
    }

    // Render step buttons
    this._renderStepButtons(step);

    // Call onEnter hook
    if (step.onEnter) {
      step.onEnter(this.stepData, this);
    }
  }

  _renderProgress() {
    if (this.steps.length <= 1) return '';

    return `
      <div class="eo-wizard-progress">
        ${this.steps.map((step, i) => `
          <div class="eo-wizard-step ${i === this.currentStep ? 'active' : ''} ${i < this.currentStep ? 'completed' : ''}">
            <div class="eo-wizard-step-indicator">
              ${i < this.currentStep ? '<i class="ph ph-check"></i>' : i + 1}
            </div>
            <span class="eo-wizard-step-label">${step.shortTitle || step.title || `Step ${i + 1}`}</span>
          </div>
        `).join('<div class="eo-wizard-step-line"></div>')}
      </div>
    `;
  }

  _renderStepButtons(step) {
    const buttons = [];

    // Custom buttons from step definition
    if (step.buttons) {
      buttons.push(...step.buttons);
    } else {
      // Default navigation buttons
      if (this.currentStep > 0 && step.showBack !== false) {
        buttons.push({
          label: step.backLabel || 'Back',
          action: 'back',
          secondary: true,
          onClick: () => this.prev()
        });
      }

      if (step.showCancel !== false && this.currentStep === 0) {
        buttons.push({
          label: 'Cancel',
          action: 'cancel',
          secondary: true,
          onClick: () => {
            if (this.onCancel) this.onCancel(this);
            this.hide();
          }
        });
      }

      if (this.currentStep < this.steps.length - 1) {
        buttons.push({
          label: step.nextLabel || 'Continue',
          icon: 'ph-arrow-right',
          action: 'next',
          primary: true,
          onClick: () => this.next()
        });
      } else {
        buttons.push({
          label: step.finishLabel || 'Finish',
          icon: 'ph-check',
          action: 'finish',
          primary: true,
          onClick: () => this.next()
        });
      }
    }

    this.setButtons(buttons);
  }

  _getStepInputs() {
    if (!this.element) return {};

    const inputs = {};
    this.element.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.name) {
        if (el.type === 'checkbox') {
          inputs[el.name] = el.checked;
        } else {
          inputs[el.name] = el.value;
        }
      }
    });

    return inputs;
  }
}


// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Show a simple confirmation modal
 */
function showConfirmModal(options) {
  return new Promise((resolve) => {
    const modal = new EOModal({
      title: options.title || 'Confirm',
      content: `<p>${options.message}</p>`,
      size: 'small',
      buttons: [
        {
          label: options.cancelLabel || 'Cancel',
          action: 'cancel',
          secondary: true,
          onClick: () => {
            modal.hide();
            resolve(false);
          }
        },
        {
          label: options.confirmLabel || 'Confirm',
          action: 'confirm',
          primary: options.danger ? false : true,
          danger: options.danger || false,
          onClick: () => {
            modal.hide();
            resolve(true);
          }
        }
      ]
    });

    modal.show();
  });
}

/**
 * Show a simple alert modal
 */
function showAlertModal(options) {
  return new Promise((resolve) => {
    const modal = new EOModal({
      title: options.title || 'Alert',
      content: `<p>${options.message}</p>`,
      size: 'small',
      buttons: [
        {
          label: options.buttonLabel || 'OK',
          action: 'ok',
          primary: true,
          onClick: () => {
            modal.hide();
            resolve();
          }
        }
      ]
    });

    modal.show();
  });
}


// ============================================================================
// Export
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EOModal, EOWizardModal, showConfirmModal, showAlertModal };
}

if (typeof window !== 'undefined') {
  window.EOModal = EOModal;
  window.EOWizardModal = EOWizardModal;
  window.showConfirmModal = showConfirmModal;
  window.showAlertModal = showAlertModal;
}
