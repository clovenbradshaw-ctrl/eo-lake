/**
 * EO Integration - Wires EO Components into the Data Workbench
 *
 * This module connects:
 * - eo_language.js - Centralized labels
 * - eo_explanation_panel.js - "Why/How" explanations
 * - eo_lens_inspector.js - Lens pipeline visualization
 * - eo_restriction_messages.js - EO-grounded restrictions
 * - eo_definition_behavior.js - Definition-aware operations
 * - eo_superposition_display.js - SUP visual indicators
 *
 * to the main DataWorkbench class.
 */

// ============================================================================
// Integration Manager
// ============================================================================

class EOIntegrationManager {
  constructor() {
    this.initialized = false;
    this.workbench = null;
  }

  /**
   * Initialize integration with the data workbench
   */
  init(workbench) {
    if (this.initialized) return;

    this.workbench = workbench;

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._setup());
    } else {
      this._setup();
    }

    this.initialized = true;
  }

  _setup() {
    this._injectExplanationButtons();
    this._injectLensInspector();
    this._injectDefinitionFrameToggle();
    this._setupRestrictionHandling();
    this._setupSuperpositionRendering();
    this._setupEventListeners();
  }

  // ============================================================================
  // Explanation Panel Integration
  // ============================================================================

  _injectExplanationButtons() {
    // Add "Why this view?" button to filter panel
    this._observeElement('#filter-panel', (filterPanel) => {
      this._addWhyButton(filterPanel);
    });

    // Add explanation to column headers
    this._observeElement('.grid-header', (header) => {
      this._addColumnExplanationTriggers(header);
    });
  }

  _addWhyButton(filterPanel) {
    // Check if already added
    if (filterPanel.querySelector('.eo-why-btn')) return;

    const header = filterPanel.querySelector('.panel-header') ||
                   filterPanel.querySelector('h3') ||
                   filterPanel.firstElementChild;

    if (!header) return;

    const whyBtn = document.createElement('button');
    whyBtn.className = 'btn-icon eo-why-btn';
    whyBtn.title = 'Why does this view show these records?';
    whyBtn.innerHTML = '<i class="ph ph-question"></i>';

    whyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showViewExplanation(whyBtn);
    });

    header.appendChild(whyBtn);
  }

  _showViewExplanation(anchorElement) {
    // Remove any existing explanation panels
    document.querySelectorAll('.eo-explanation-panel').forEach(p => p.remove());

    // Get current view config
    const view = this.workbench?.getCurrentView?.();
    if (!view) return;

    // Build view config for explanation
    const viewConfig = {
      sourceId: view.setId,
      sourceName: this.workbench?.getCurrentSet?.()?.name,
      filters: (view.config?.filters || []).map(f => {
        const field = this._getFieldById(f.fieldId);
        return {
          field: f.fieldId,
          fieldName: field?.name || f.fieldId,
          operator: f.operator,
          value: f.filterValue
        };
      }),
      hiddenFields: view.config?.hiddenFields || [],
      groupBy: view.config?.groupByFieldId,
      groupByFieldName: this._getFieldById(view.config?.groupByFieldId)?.name,
      sortField: view.config?.sortFieldId,
      sortFieldName: this._getFieldById(view.config?.sortFieldId)?.name,
      sortDirection: view.config?.sortDirection,
      type: view.type || 'grid'
    };

    // Show explanation
    if (window.EOExplanation?.showViewExplanation) {
      window.EOExplanation.showViewExplanation(viewConfig, anchorElement);
    }
  }

  _addColumnExplanationTriggers(header) {
    const headerCells = header.querySelectorAll('.grid-header-cell, th');
    headerCells.forEach(cell => {
      // Skip if already has trigger
      if (cell.querySelector('.eo-field-info-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'btn-icon btn-xs eo-field-info-btn';
      btn.title = 'Field interpretation';
      btn.innerHTML = '<i class="ph ph-info"></i>';
      btn.style.opacity = '0';
      btn.style.marginLeft = '4px';

      cell.addEventListener('mouseenter', () => btn.style.opacity = '0.5');
      cell.addEventListener('mouseleave', () => btn.style.opacity = '0');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fieldId = cell.dataset.fieldId || cell.getAttribute('data-field');
        this._showFieldExplanation(fieldId, btn);
      });

      cell.appendChild(btn);
    });
  }

  _showFieldExplanation(fieldId, anchorElement) {
    if (!fieldId) return;

    // Remove existing panels
    document.querySelectorAll('.eo-explanation-panel').forEach(p => p.remove());

    // Get field binding
    const binding = this._getFieldBinding(fieldId);

    // Show field explanation
    const panel = new window.EOExplanationPanel({
      onClose: () => {}
    });

    const element = panel._renderFieldExplanation(binding || { fieldId });

    if (anchorElement) {
      element.style.position = 'absolute';
      element.style.zIndex = '1000';
      const rect = anchorElement.getBoundingClientRect();
      element.style.top = `${rect.bottom + 8}px`;
      element.style.left = `${rect.left}px`;
    }

    document.body.appendChild(element);
  }

  // ============================================================================
  // Lens Inspector Integration
  // ============================================================================

  _injectLensInspector() {
    // Add lens inspector to view tabs area
    this._observeElement('.view-tabs', (tabsArea) => {
      this._addLensInspectorButton(tabsArea);
    });
  }

  _addLensInspectorButton(tabsArea) {
    // Check if already added
    if (tabsArea.querySelector('.eo-lens-inspector-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'btn-icon eo-lens-inspector-btn';
    btn.title = 'View transformation pipeline';
    btn.innerHTML = '<i class="ph ph-flow-arrow"></i>';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showLensInspector(btn);
    });

    // Insert after view tabs
    tabsArea.appendChild(btn);
  }

  _showLensInspector(anchorElement) {
    // Remove existing inspector
    document.querySelectorAll('.eo-lens-inspector').forEach(p => p.parentElement?.remove());

    const view = this.workbench?.getCurrentView?.();
    const set = this.workbench?.getCurrentSet?.();

    if (!view) return;

    // Build lens config
    const lensConfig = {
      name: view.name || 'Current View',
      type: view.type || 'grid',
      setId: view.setId,
      setName: set?.name,
      sourceSetId: view.setId,
      sourceSetName: set?.name,
      filters: view.config?.filters?.map(f => ({
        ...f,
        fieldName: this._getFieldById(f.fieldId)?.name
      })),
      hiddenFields: view.config?.hiddenFields,
      visibleFields: set?.fields?.filter(f => !view.config?.hiddenFields?.includes(f.id)),
      groupByFieldId: view.config?.groupByFieldId,
      groupByFieldName: this._getFieldById(view.config?.groupByFieldId)?.name,
      sortFieldId: view.config?.sortFieldId,
      sortFieldName: this._getFieldById(view.config?.sortFieldId)?.name,
      sortDirection: view.config?.sortDirection,
      rollups: view.config?.rollups,
      linkedFields: view.config?.linkedFields
    };

    // Create container
    const container = document.createElement('div');
    container.className = 'eo-lens-inspector-container';
    container.style.position = 'absolute';
    container.style.zIndex = '1000';

    if (anchorElement) {
      const rect = anchorElement.getBoundingClientRect();
      container.style.top = `${rect.bottom + 8}px`;
      container.style.right = '16px';
    }

    // Create inspector
    const inspector = new window.EOLensInspector({
      container,
      lens: lensConfig,
      onClose: () => container.remove(),
      onDuplicate: (lens) => {
        // Trigger view duplication in workbench
        this.workbench?._duplicateCurrentView?.();
        container.remove();
      }
    });

    inspector.render();
    document.body.appendChild(container);
  }

  // ============================================================================
  // Definition Frame Toggle Integration
  // ============================================================================

  _injectDefinitionFrameToggle() {
    // Add definition frame selector to view header
    this._observeElement('.view-header, .set-header', (header) => {
      this._addDefinitionFrameToggle(header);
    });
  }

  _addDefinitionFrameToggle(header) {
    // Check if already added
    if (header.querySelector('.eo-frame-selector')) return;

    // Only add if there are multiple definition frames available
    const definitions = this._getAvailableDefinitions();
    if (definitions.length <= 1) return;

    const container = document.createElement('div');
    container.className = 'eo-frame-toggle-container';

    const toggle = new window.EODefinitionBehavior.DefinitionToggle({
      container,
      fieldName: 'Active',
      definitions,
      currentDefinition: definitions[0],
      onChange: (definition) => {
        // Re-render view with new definition frame
        this.workbench?._renderView?.();
      }
    });

    toggle.render();
    header.appendChild(container);
  }

  _getAvailableDefinitions() {
    // Get available definition frames from the semantic registry
    const registry = window.EOSchemaSemantic?.getSemanticRegistry?.();
    if (!registry) return [];

    // This would return different definition frames (GAAP, IFRS, etc.)
    return [
      { id: 'default', label: 'Default', name: 'Default' }
      // More would come from the registry
    ];
  }

  // ============================================================================
  // Restriction Handling Integration
  // ============================================================================

  _setupRestrictionHandling() {
    // Wrap workbench methods to show EO restriction messages
    if (!this.workbench) return;

    // Override edit handlers to check restrictions
    const originalEditCell = this.workbench._handleCellEdit?.bind(this.workbench);
    if (originalEditCell) {
      this.workbench._handleCellEdit = (recordId, fieldId, newValue) => {
        const restriction = this._checkEditRestriction(recordId, fieldId);
        if (restriction) {
          window.EORestrictions?.showRestrictionToast(restriction);
          return false;
        }
        return originalEditCell(recordId, fieldId, newValue);
      };
    }

    // Override delete handlers
    const originalDeleteRecord = this.workbench._deleteRecord?.bind(this.workbench);
    if (originalDeleteRecord) {
      this.workbench._deleteRecord = (recordId) => {
        window.EORestrictions?.showRestrictionToast(
          window.EORestrictions?.RestrictionType?.CANNOT_DELETE_RECORD
        );
        return false;
      };
    }
  }

  _checkEditRestriction(recordId, fieldId) {
    // Check if this is a GIVEN record
    const record = this.workbench?._getRecordById?.(recordId);
    if (!record) return null;

    // Check epistemic type
    if (record._epistemicType === 'GIVEN' || record._type === 'GIVEN') {
      return window.EORestrictions?.RestrictionType?.CANNOT_EDIT_GIVEN;
    }

    // Check if we're in a view
    const view = this.workbench?.getCurrentView?.();
    if (view && view.type !== 'grid') {
      return window.EORestrictions?.RestrictionType?.CANNOT_EDIT_IN_VIEW;
    }

    return null;
  }

  // ============================================================================
  // Superposition Rendering Integration
  // ============================================================================

  _setupSuperpositionRendering() {
    // Extend cell rendering to handle superposed values
    this._observeElement('.grid-body, .data-grid tbody', (gridBody) => {
      this._enhanceCellsForSuperposition(gridBody);
    });
  }

  _enhanceCellsForSuperposition(gridBody) {
    // For each cell, check if it has superposed values
    const cells = gridBody.querySelectorAll('.grid-cell, td');

    cells.forEach(cell => {
      const recordId = cell.dataset.recordId || cell.parentElement?.dataset.recordId;
      const fieldId = cell.dataset.fieldId || cell.dataset.field;

      if (!recordId || !fieldId) return;

      // Check for superposition
      const supStore = window.EOSuperposition?.getSuperpositionStore?.();
      if (!supStore) return;

      const supValue = supStore.get(recordId, fieldId);
      if (supValue?.isSuperposed()) {
        this._renderSuperposedCell(cell, supValue);
      }
    });
  }

  _renderSuperposedCell(cell, superposedValue) {
    const renderer = new window.EOSuperposition.SuperpositionCellRenderer({
      onClick: (value, container) => {
        window.EOSuperposition.showResolutionPanel(value, container, (resolved) => {
          // Update the cell
          cell.textContent = resolved.getDisplayValue();
          cell.classList.remove('has-alternates');
        });
      }
    });

    renderer.render(superposedValue, cell);
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  _setupEventListeners() {
    // Listen for view changes to update explanations
    document.addEventListener('view-changed', () => {
      // Close any open explanation panels
      document.querySelectorAll('.eo-explanation-panel').forEach(p => p.remove());
    });

    // Listen for resolution changes
    document.addEventListener('resolution-applied', (e) => {
      const { value, strategy } = e.detail;
      console.log(`[EO] Resolved ${value.fieldId} using ${strategy}`);
    });

    // Listen for definition frame changes
    document.addEventListener('definition-change', (e) => {
      const { definition, fieldName } = e.detail;
      console.log(`[EO] Definition changed to ${definition.label} for ${fieldName}`);
    });

    // Listen for frame changes
    document.addEventListener('frame-change', (e) => {
      const { frame } = e.detail;
      console.log(`[EO] Frame changed:`, frame);
    });
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  _getFieldById(fieldId) {
    if (!fieldId) return null;
    const set = this.workbench?.getCurrentSet?.();
    return set?.fields?.find(f => f.id === fieldId);
  }

  _getFieldBinding(fieldId) {
    const bindingStore = window.EOInterpretationBinding?.getBindingStore?.();
    if (!bindingStore) return null;

    const set = this.workbench?.getCurrentSet?.();
    if (!set) return null;

    const binding = bindingStore.getActiveForDataset(set.id);
    return binding?.columnBindings?.[fieldId];
  }

  /**
   * Observe for an element to appear and run callback when it does
   */
  _observeElement(selector, callback) {
    // Check if element already exists
    const existing = document.querySelector(selector);
    if (existing) {
      callback(existing);
    }

    // Set up mutation observer for future elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches?.(selector)) {
              callback(node);
            }
            const child = node.querySelector?.(selector);
            if (child) {
              callback(child);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// ============================================================================
// Auto-Initialize
// ============================================================================

const eoIntegration = new EOIntegrationManager();

// Hook into workbench initialization
document.addEventListener('DOMContentLoaded', () => {
  // Wait for workbench to be available
  const checkWorkbench = setInterval(() => {
    if (window.dataWorkbench) {
      clearInterval(checkWorkbench);
      eoIntegration.init(window.dataWorkbench);
      console.log('[EO Integration] Initialized');
    }
  }, 100);

  // Stop checking after 10 seconds
  setTimeout(() => clearInterval(checkWorkbench), 10000);
});

// ============================================================================
// Export
// ============================================================================

window.EOIntegration = eoIntegration;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EOIntegrationManager, eoIntegration };
}
