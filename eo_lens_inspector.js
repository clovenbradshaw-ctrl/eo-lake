/**
 * EO Lens Inspector - Lens Pipeline Visualization
 *
 * Shows how a Lens transforms data from source to view.
 * Displays the transformation pipeline in both simple and advanced modes.
 *
 * A Lens is already an EO program - this component makes that visible.
 */

// ============================================================================
// Lens Inspector Class
// ============================================================================

class EOLensInspector {
  constructor(options = {}) {
    this.container = options.container || null;
    this.lens = options.lens || null;
    this.showAdvanced = options.showAdvanced || false;
    this.onDuplicate = options.onDuplicate || null;
    this.onEdit = options.onEdit || null;
    this.onClose = options.onClose || null;

    this.language = window.EOLanguage || {};
  }

  /**
   * Set the lens to inspect
   */
  setLens(lens) {
    this.lens = lens;
    if (this.container) {
      this.render();
    }
  }

  /**
   * Render the inspector panel
   */
  render() {
    if (!this.container) return;

    const pipeline = this._extractPipeline(this.lens);
    const stats = this._calculateStats(pipeline);

    this.container.innerHTML = `
      <div class="eo-lens-inspector">
        <div class="eo-lens-header">
          <div class="eo-lens-title">
            <i class="ph ${this._getLensIcon(this.lens?.type)}"></i>
            <span>${this.lens?.name || 'Unnamed Lens'}</span>
          </div>
          <div class="eo-lens-controls">
            <button class="btn-icon eo-toggle-advanced" title="Show operator details">
              <i class="ph ph-code"></i>
            </button>
            ${this.onClose ? `
              <button class="btn-icon eo-close-btn" title="Close">
                <i class="ph ph-x"></i>
              </button>
            ` : ''}
          </div>
        </div>

        <div class="eo-lens-meta">
          <span class="eo-lens-type">
            <i class="ph ${this._getLensIcon(this.lens?.type)}"></i>
            ${this._getLensTypeName(this.lens?.type)}
          </span>
          <span class="eo-lens-steps">
            <i class="ph ph-stack"></i>
            ${pipeline.length} transformation${pipeline.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div class="eo-lens-pipeline">
          <div class="eo-pipeline-simple ${this.showAdvanced ? 'hidden' : ''}">
            ${this._renderSimplePipeline(pipeline)}
          </div>
          <div class="eo-pipeline-advanced ${this.showAdvanced ? '' : 'hidden'}">
            ${this._renderAdvancedPipeline(pipeline)}
          </div>
        </div>

        <div class="eo-lens-actions">
          <button class="btn btn-sm btn-outline eo-duplicate-btn">
            <i class="ph ph-copy"></i>
            Save as new transformation
          </button>
          <button class="btn btn-sm btn-outline eo-edit-btn">
            <i class="ph ph-pencil"></i>
            Modify
          </button>
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  /**
   * Extract transformation pipeline from lens configuration
   */
  _extractPipeline(lens) {
    if (!lens) return [];

    const pipeline = [];

    // 1. Source reference
    if (lens.sourceSetId || lens.setId) {
      pipeline.push({
        step: 'source',
        operator: 'INS',
        description: 'Start with source data',
        details: {
          setName: lens.setName || lens.sourceSetName || 'Source Set',
          setId: lens.sourceSetId || lens.setId
        },
        userText: `From ${lens.setName || lens.sourceSetName || 'source data'}`
      });
    }

    // 2. Field selection (hidden fields)
    if (lens.hiddenFields && lens.hiddenFields.length > 0) {
      pipeline.push({
        step: 'select',
        operator: 'SEG',
        description: 'Select visible fields',
        details: {
          hidden: lens.hiddenFields,
          hiddenCount: lens.hiddenFields.length
        },
        userText: `Show ${lens.visibleFields?.length || 'selected'} fields (${lens.hiddenFields.length} hidden)`
      });
    }

    // 3. Filters
    if (lens.filters && lens.filters.length > 0) {
      lens.filters.forEach((filter, index) => {
        pipeline.push({
          step: 'filter',
          operator: 'SEG',
          description: `Filter: ${filter.field} ${filter.operator} ${filter.value}`,
          details: filter,
          userText: this._filterToText(filter)
        });
      });
    }

    // 4. Grouping / Organization
    if (lens.groupBy || lens.groupByFieldId) {
      pipeline.push({
        step: 'group',
        operator: 'SEG',
        description: `Group by ${lens.groupByFieldName || lens.groupBy}`,
        details: {
          field: lens.groupByFieldId || lens.groupBy,
          fieldName: lens.groupByFieldName
        },
        userText: `Organize around ${lens.groupByFieldName || lens.groupBy}`
      });
    }

    // 5. Sorting
    if (lens.sortField || lens.sortFieldId) {
      pipeline.push({
        step: 'sort',
        operator: 'SEG',
        description: `Sort by ${lens.sortFieldName || lens.sortField}`,
        details: {
          field: lens.sortFieldId || lens.sortField,
          fieldName: lens.sortFieldName,
          direction: lens.sortDirection || 'asc'
        },
        userText: `Sort by ${lens.sortFieldName || lens.sortField} (${lens.sortDirection === 'desc' ? 'Z→A' : 'A→Z'})`
      });
    }

    // 6. Pivot / View type transformation
    if (lens.type && lens.type !== 'grid') {
      pipeline.push({
        step: 'pivot',
        operator: 'SEG',
        description: `Transform to ${lens.type} view`,
        details: {
          viewType: lens.type,
          pivotConfig: lens.pivotConfig
        },
        userText: `Display as ${this._getLensTypeName(lens.type)}`
      });
    }

    // 7. Rollups / Aggregations
    if (lens.rollups && lens.rollups.length > 0) {
      lens.rollups.forEach(rollup => {
        pipeline.push({
          step: 'aggregate',
          operator: 'SYN',
          description: `Calculate ${rollup.function}(${rollup.field})`,
          details: rollup,
          userText: `Calculate ${rollup.function} of ${rollup.fieldName || rollup.field}`
        });
      });
    }

    // 8. Linked fields / Connections
    if (lens.linkedFields && lens.linkedFields.length > 0) {
      lens.linkedFields.forEach(link => {
        pipeline.push({
          step: 'link',
          operator: 'CON',
          description: `Link to ${link.targetSet}`,
          details: link,
          userText: `Connect to ${link.targetSetName || link.targetSet}`
        });
      });
    }

    // 9. Definition bindings
    if (lens.bindings && Object.keys(lens.bindings).length > 0) {
      const bindingCount = Object.keys(lens.bindings).length;
      pipeline.push({
        step: 'interpret',
        operator: 'DES',
        description: `${bindingCount} field interpretations`,
        details: lens.bindings,
        userText: `${bindingCount} fields have semantic definitions`
      });
    }

    return pipeline;
  }

  /**
   * Render simple pipeline view (for users)
   */
  _renderSimplePipeline(pipeline) {
    if (pipeline.length === 0) {
      return `
        <div class="eo-pipeline-empty">
          <i class="ph ph-eye"></i>
          <span>Showing all data, no transformations applied</span>
        </div>
      `;
    }

    return `
      <div class="eo-pipeline-steps">
        ${pipeline.map((step, index) => `
          <div class="eo-pipeline-step">
            <div class="eo-step-indicator">
              <span class="eo-step-number">${index + 1}</span>
              ${index < pipeline.length - 1 ? '<span class="eo-step-connector"></span>' : ''}
            </div>
            <div class="eo-step-content">
              <span class="eo-step-icon">${this._getStepIcon(step.step)}</span>
              <span class="eo-step-text">${step.userText}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render advanced pipeline view (for power users)
   */
  _renderAdvancedPipeline(pipeline) {
    if (pipeline.length === 0) {
      return `
        <div class="eo-pipeline-empty">
          <code>Identity()</code> - no operators applied
        </div>
      `;
    }

    const operatorDisplay = pipeline.map(step => {
      const opInfo = this.language.getOperatorDisplay?.(step.operator) ||
        { symbol: '?', name: step.operator };
      return opInfo.symbol;
    }).join(' → ');

    return `
      <div class="eo-pipeline-chain">
        <div class="eo-chain-summary">
          <code>${operatorDisplay}</code>
        </div>
        <div class="eo-chain-details">
          ${pipeline.map((step, index) => {
            const opInfo = this.language.getOperatorDisplay?.(step.operator) ||
              { symbol: '?', name: step.operator };
            return `
              <div class="eo-chain-step">
                <span class="eo-operator-badge" title="${opInfo.name}">${opInfo.symbol}</span>
                <span class="eo-operator-name">${opInfo.name}</span>
                <span class="eo-operator-desc">${step.description}</span>
              </div>
            `;
          }).join('<span class="eo-chain-arrow">→</span>')}
        </div>
      </div>
    `;
  }

  /**
   * Calculate pipeline stats
   */
  _calculateStats(pipeline) {
    const stats = {
      total: pipeline.length,
      byOperator: {}
    };

    pipeline.forEach(step => {
      stats.byOperator[step.operator] = (stats.byOperator[step.operator] || 0) + 1;
    });

    return stats;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  _getLensIcon(type) {
    const icons = {
      grid: 'ph-table',
      cards: 'ph-cards',
      kanban: 'ph-kanban',
      calendar: 'ph-calendar',
      timeline: 'ph-chart-line',
      graph: 'ph-graph'
    };
    return icons[type] || 'ph-table';
  }

  _getLensTypeName(type) {
    const names = {
      grid: 'Table',
      cards: 'Cards',
      kanban: 'Board',
      calendar: 'Calendar',
      timeline: 'Timeline',
      graph: 'Graph'
    };
    return names[type] || 'View';
  }

  _getStepIcon(step) {
    const icons = {
      source: '📥',
      select: '👁',
      filter: '🔍',
      group: '📂',
      sort: '↕️',
      pivot: '🔄',
      aggregate: '∑',
      link: '🔗',
      interpret: '🏷️'
    };
    return icons[step] || '•';
  }

  _filterToText(filter) {
    const operators = {
      equals: 'is',
      not_equals: 'is not',
      contains: 'contains',
      not_contains: 'does not contain',
      starts_with: 'starts with',
      ends_with: 'ends with',
      greater_than: 'is greater than',
      less_than: 'is less than',
      is_empty: 'is empty',
      is_not_empty: 'is not empty'
    };

    const opText = operators[filter.operator] || filter.operator;

    if (filter.operator === 'is_empty' || filter.operator === 'is_not_empty') {
      return `${filter.fieldName || filter.field} ${opText}`;
    }

    return `${filter.fieldName || filter.field} ${opText} "${filter.value}"`;
  }

  _attachEventListeners() {
    if (!this.container) return;

    // Toggle advanced view
    const toggleBtn = this.container.querySelector('.eo-toggle-advanced');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.showAdvanced = !this.showAdvanced;
        const simple = this.container.querySelector('.eo-pipeline-simple');
        const advanced = this.container.querySelector('.eo-pipeline-advanced');
        if (simple) simple.classList.toggle('hidden', this.showAdvanced);
        if (advanced) advanced.classList.toggle('hidden', !this.showAdvanced);
        toggleBtn.classList.toggle('active', this.showAdvanced);
      });
    }

    // Close button
    const closeBtn = this.container.querySelector('.eo-close-btn');
    if (closeBtn && this.onClose) {
      closeBtn.addEventListener('click', () => this.onClose());
    }

    // Duplicate button
    const duplicateBtn = this.container.querySelector('.eo-duplicate-btn');
    if (duplicateBtn) {
      duplicateBtn.addEventListener('click', () => {
        if (this.onDuplicate) {
          this.onDuplicate(this.lens);
        } else {
          this._handleDuplicate();
        }
      });
    }

    // Edit button
    const editBtn = this.container.querySelector('.eo-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (this.onEdit) {
          this.onEdit(this.lens);
        }
      });
    }
  }

  _handleDuplicate() {
    // Default duplicate behavior - emit event
    this.container.dispatchEvent(new CustomEvent('lens-duplicate', {
      bubbles: true,
      detail: { lens: this.lens }
    }));
  }
}

// ============================================================================
// Lens Pipeline Store
// ============================================================================

/**
 * Store for tracking lens transformations as serializable EO programs
 */
class LensPipelineStore {
  constructor() {
    this.pipelines = new Map();
  }

  /**
   * Register a lens's pipeline for later retrieval
   */
  register(lensId, pipeline) {
    this.pipelines.set(lensId, {
      pipeline,
      operators: pipeline.map(step => step.operator),
      registeredAt: Date.now()
    });
  }

  /**
   * Get a lens's pipeline
   */
  get(lensId) {
    return this.pipelines.get(lensId);
  }

  /**
   * Serialize a lens to an EO program representation
   */
  serializeToEO(lensId) {
    const entry = this.pipelines.get(lensId);
    if (!entry) return null;

    return {
      version: '1.0',
      operators: entry.pipeline.map(step => ({
        op: step.operator,
        params: step.details || {}
      })),
      serializedAt: Date.now()
    };
  }

  /**
   * Create a new lens from an EO program
   */
  deserializeFromEO(program) {
    // This would reconstruct a lens config from an EO program
    // Implementation depends on the full lens config structure
    return {
      steps: program.operators.map(op => ({
        operator: op.op,
        details: op.params
      }))
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create and show a lens inspector panel
 */
function showLensInspector(lens, container, options = {}) {
  const inspector = new EOLensInspector({
    container,
    lens,
    ...options
  });
  inspector.render();
  return inspector;
}

/**
 * Get singleton pipeline store
 */
let _pipelineStore = null;
function getPipelineStore() {
  if (!_pipelineStore) {
    _pipelineStore = new LensPipelineStore();
  }
  return _pipelineStore;
}

// ============================================================================
// Export
// ============================================================================

window.EOLensInspector = EOLensInspector;
window.LensPipelineStore = LensPipelineStore;
window.EOLens = {
  Inspector: EOLensInspector,
  PipelineStore: LensPipelineStore,
  showLensInspector,
  getPipelineStore
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EOLensInspector, LensPipelineStore, showLensInspector, getPipelineStore };
}
