/**
 * EO Definition Behavior - Definition-Aware Operation Rules
 *
 * Makes definitions (DES) influence behavior, not just labels.
 * Implements ALT as a view-level toggle for definition frames.
 *
 * PRINCIPLE: Definitions should influence behavior, not just labels.
 * If a field is bound to qudt:USD, aggregation defaults to currency-safe modes.
 */

// ============================================================================
// Definition Frame Types
// ============================================================================

const DefinitionFrameType = Object.freeze({
  JURISDICTION: 'jurisdiction',  // Legal/geographic context
  TIMEFRAME: 'timeframe',        // Temporal validity
  STANDARD: 'standard',          // Accounting/reporting standard
  SCALE: 'scale',                // Unit of measurement
  AUTHORITY: 'authority'         // Defining body
});

// ============================================================================
// Known Unit Namespaces
// ============================================================================

const UnitNamespaces = Object.freeze({
  QUDT: 'http://qudt.org/vocab/unit/',
  UCUM: 'http://unitsofmeasure.org/',
  SCHEMA: 'https://schema.org/'
});

// ============================================================================
// Unit Categories for Compatibility Checking
// ============================================================================

const UnitCategories = Object.freeze({
  CURRENCY: {
    pattern: /^(USD|EUR|GBP|JPY|CNY|CHF|CAD|AUD|NZD|currency)/i,
    qudtPattern: /qudt.*\/(USD|EUR|GBP|Currency)/i,
    aggregationModes: ['SUM', 'AVG', 'MIN', 'MAX'],
    requiresExactMatch: true, // Can't mix USD and EUR
    conversionPossible: true
  },
  LENGTH: {
    pattern: /^(meter|metre|foot|feet|inch|mile|km|kilometer|cm|mm)/i,
    qudtPattern: /qudt.*\/(M|FT|IN|MI|KM)/i,
    aggregationModes: ['SUM', 'AVG', 'MIN', 'MAX'],
    requiresExactMatch: false, // Can convert between units
    conversionPossible: true
  },
  WEIGHT: {
    pattern: /^(kg|kilogram|gram|pound|lb|ounce|oz|ton)/i,
    qudtPattern: /qudt.*\/(KG|GM|LB|OZ)/i,
    aggregationModes: ['SUM', 'AVG', 'MIN', 'MAX'],
    requiresExactMatch: false,
    conversionPossible: true
  },
  TIME: {
    pattern: /^(second|minute|hour|day|week|month|year)/i,
    qudtPattern: /qudt.*\/(SEC|MIN|HR|DAY)/i,
    aggregationModes: ['SUM', 'AVG', 'MIN', 'MAX'],
    requiresExactMatch: false,
    conversionPossible: true
  },
  COUNT: {
    pattern: /^(count|number|quantity|unit)/i,
    qudtPattern: /qudt.*\/(NUM|UNITLESS)/i,
    aggregationModes: ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX'],
    requiresExactMatch: true, // Counts of different things shouldn't mix
    conversionPossible: false
  },
  PERCENTAGE: {
    pattern: /^(percent|pct|ratio|rate)/i,
    qudtPattern: /qudt.*\/(PERCENT|FRACTION)/i,
    aggregationModes: ['AVG', 'MIN', 'MAX'], // SUM doesn't make sense for percentages
    requiresExactMatch: true,
    conversionPossible: false
  }
});

// ============================================================================
// Definition-Aware Rules Engine
// ============================================================================

class DefinitionBehaviorEngine {
  constructor() {
    this.bindingStore = window.EOInterpretationBinding?.getBindingStore?.() || null;
    this.semanticRegistry = window.EOSchemaSemantic?.getSemanticRegistry?.() || null;
  }

  /**
   * Check if an aggregation is valid given field definitions
   */
  validateAggregation(fields, aggregationType) {
    const result = {
      valid: true,
      warnings: [],
      errors: [],
      suggestions: []
    };

    if (!fields || fields.length === 0) {
      return result;
    }

    // Get bindings for all fields
    const bindings = fields.map(f => this._getFieldBinding(f));
    const units = bindings.map(b => this._extractUnit(b)).filter(Boolean);

    // Check for mixed units
    if (units.length > 1) {
      const uniqueUnits = [...new Set(units.map(u => u.uri || u.label))];
      if (uniqueUnits.length > 1) {
        const category = this._getUnitCategory(units[0]);

        if (category?.requiresExactMatch) {
          result.valid = false;
          result.errors.push({
            type: 'MIXED_UNITS',
            message: `Cannot ${aggregationType} values with different units: ${uniqueUnits.join(', ')}`,
            units: uniqueUnits
          });
        } else if (category?.conversionPossible) {
          result.warnings.push({
            type: 'UNIT_CONVERSION_NEEDED',
            message: `Values have different units (${uniqueUnits.join(', ')}). Conversion will be applied.`,
            units: uniqueUnits
          });
          result.suggestions.push({
            action: 'CONVERT_UNITS',
            message: 'Convert all values to a common unit before aggregating'
          });
        }
      }
    }

    // Check if aggregation type is appropriate for the unit category
    if (units.length > 0) {
      const category = this._getUnitCategory(units[0]);
      if (category && !category.aggregationModes.includes(aggregationType.toUpperCase())) {
        result.warnings.push({
          type: 'INAPPROPRIATE_AGGREGATION',
          message: `${aggregationType} may not be meaningful for ${category.name || 'this type of'} values`,
          suggestion: `Consider using: ${category.aggregationModes.join(', ')}`
        });
      }
    }

    return result;
  }

  /**
   * Check if a comparison is valid between two fields
   */
  validateComparison(field1, field2) {
    const result = {
      valid: true,
      warnings: [],
      requiresConversion: false
    };

    const binding1 = this._getFieldBinding(field1);
    const binding2 = this._getFieldBinding(field2);

    // Check unit compatibility
    const unit1 = this._extractUnit(binding1);
    const unit2 = this._extractUnit(binding2);

    if (unit1 && unit2) {
      const cat1 = this._getUnitCategory(unit1);
      const cat2 = this._getUnitCategory(unit2);

      if (cat1 !== cat2) {
        result.valid = false;
        result.warnings.push({
          type: 'INCOMPATIBLE_UNITS',
          message: 'Cannot compare values of different unit types'
        });
      } else if (unit1.uri !== unit2.uri) {
        result.requiresConversion = true;
        result.warnings.push({
          type: 'UNIT_CONVERSION',
          message: `Comparing ${unit1.label} to ${unit2.label} - conversion applied`
        });
      }
    }

    // Check definition frame compatibility
    const frame1 = this._extractFrame(binding1);
    const frame2 = this._extractFrame(binding2);

    if (frame1 && frame2) {
      const frameDiffs = this._compareFrames(frame1, frame2);
      if (frameDiffs.length > 0) {
        result.warnings.push({
          type: 'DIFFERENT_FRAMES',
          message: `These values use different definition frames`,
          differences: frameDiffs
        });
      }
    }

    return result;
  }

  /**
   * Get recommended aggregation modes for a field
   */
  getRecommendedAggregations(field) {
    const binding = this._getFieldBinding(field);
    const unit = this._extractUnit(binding);

    if (unit) {
      const category = this._getUnitCategory(unit);
      if (category) {
        return {
          recommended: category.aggregationModes,
          default: category.aggregationModes[0],
          reason: `Based on unit type: ${unit.label || unit.uri}`
        };
      }
    }

    // Default recommendations
    return {
      recommended: ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX'],
      default: 'SUM',
      reason: 'No unit binding - all aggregations available'
    };
  }

  /**
   * Check if two records can be merged
   */
  validateMerge(record1, record2) {
    const result = {
      valid: true,
      conflicts: [],
      warnings: [],
      resolutions: []
    };

    // Get all field bindings for both records
    const fields1 = Object.keys(record1).filter(k => !k.startsWith('_'));
    const fields2 = Object.keys(record2).filter(k => !k.startsWith('_'));
    const allFields = [...new Set([...fields1, ...fields2])];

    for (const field of allFields) {
      const val1 = record1[field];
      const val2 = record2[field];

      // If both have values and they differ
      if (val1 !== undefined && val2 !== undefined && val1 !== val2) {
        const binding1 = this._getFieldBinding({ id: field, value: val1 });
        const binding2 = this._getFieldBinding({ id: field, value: val2 });

        // Check if definitions are compatible
        const frame1 = this._extractFrame(binding1);
        const frame2 = this._extractFrame(binding2);

        if (frame1 && frame2) {
          const frameDiffs = this._compareFrames(frame1, frame2);
          if (frameDiffs.length > 0) {
            result.conflicts.push({
              field,
              type: 'FRAME_CONFLICT',
              values: [val1, val2],
              frames: [frame1, frame2],
              message: `Field "${field}" has different definitions in each record`
            });
            result.resolutions.push({
              field,
              options: ['USE_FIRST', 'USE_SECOND', 'SUPERPOSE', 'MANUAL']
            });
          }
        }

        // Add as general conflict
        if (!result.conflicts.find(c => c.field === field)) {
          result.conflicts.push({
            field,
            type: 'VALUE_CONFLICT',
            values: [val1, val2],
            message: `Field "${field}" has different values`
          });
          result.resolutions.push({
            field,
            options: ['USE_FIRST', 'USE_SECOND', 'USE_RECENT', 'SUPERPOSE']
          });
        }
      }
    }

    result.valid = result.conflicts.length === 0;
    return result;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  _getFieldBinding(field) {
    if (!this.bindingStore) return null;

    const fieldId = field.id || field.fieldId || field;
    const datasetId = field.datasetId || field.setId;

    if (datasetId) {
      const binding = this.bindingStore.getActiveForDataset(datasetId);
      return binding?.columnBindings?.[fieldId];
    }

    return null;
  }

  _extractUnit(binding) {
    if (!binding) return null;

    // Check for explicit unit
    if (binding.unit) {
      return binding.unit;
    }

    // Check for QUDT binding
    const uri = binding.semanticUri || binding.uri;
    if (uri) {
      for (const [namespace, prefix] of Object.entries(UnitNamespaces)) {
        if (uri.startsWith(prefix)) {
          return {
            uri,
            namespace,
            label: uri.replace(prefix, '')
          };
        }
      }
    }

    return null;
  }

  _extractFrame(binding) {
    if (!binding) return null;

    return {
      jurisdiction: binding.jurisdiction || binding.context?.jurisdiction,
      timeframe: binding.timeframe || binding.context?.timeframe,
      standard: binding.standard || binding.context?.standard,
      scale: binding.scale || binding.context?.scale,
      authority: binding.authority || binding.context?.authority
    };
  }

  _getUnitCategory(unit) {
    if (!unit) return null;

    const uri = unit.uri || '';
    const label = unit.label || '';

    for (const [name, category] of Object.entries(UnitCategories)) {
      if (category.pattern.test(label) || category.qudtPattern?.test(uri)) {
        return { ...category, name };
      }
    }

    return null;
  }

  _compareFrames(frame1, frame2) {
    const differences = [];

    for (const key of Object.keys(DefinitionFrameType)) {
      const frameKey = DefinitionFrameType[key];
      if (frame1[frameKey] && frame2[frameKey] && frame1[frameKey] !== frame2[frameKey]) {
        differences.push({
          aspect: frameKey,
          value1: frame1[frameKey],
          value2: frame2[frameKey]
        });
      }
    }

    return differences;
  }
}

// ============================================================================
// Definition Frame Selector Component
// ============================================================================

class DefinitionFrameSelector {
  constructor(options = {}) {
    this.container = options.container;
    this.currentFrame = options.currentFrame || {};
    this.availableFrames = options.availableFrames || [];
    this.onChange = options.onChange;
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="eo-frame-selector">
        <div class="eo-frame-header">
          <span class="eo-frame-label">Definition Frame</span>
          <span class="eo-frame-indicator" title="Affects how values are interpreted">
            <i class="ph ph-info"></i>
          </span>
        </div>

        <div class="eo-frame-controls">
          ${this._renderFrameDropdown('jurisdiction', 'Jurisdiction', this._getJurisdictionOptions())}
          ${this._renderFrameDropdown('standard', 'Standard', this._getStandardOptions())}
          ${this._renderFrameDropdown('timeframe', 'Timeframe', this._getTimeframeOptions())}
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  _renderFrameDropdown(key, label, options) {
    const currentValue = this.currentFrame[key] || '';

    return `
      <div class="eo-frame-control">
        <label class="eo-frame-control-label">${label}</label>
        <select class="eo-frame-select" data-frame-key="${key}">
          <option value="">Any</option>
          ${options.map(opt => `
            <option value="${opt.value}" ${opt.value === currentValue ? 'selected' : ''}>
              ${opt.label}
            </option>
          `).join('')}
        </select>
      </div>
    `;
  }

  _getJurisdictionOptions() {
    return [
      { value: 'US', label: 'United States' },
      { value: 'EU', label: 'European Union' },
      { value: 'UK', label: 'United Kingdom' },
      { value: 'GLOBAL', label: 'Global / International' }
    ];
  }

  _getStandardOptions() {
    return [
      { value: 'GAAP', label: 'US GAAP' },
      { value: 'IFRS', label: 'IFRS' },
      { value: 'STATUTORY', label: 'Statutory' },
      { value: 'MANAGEMENT', label: 'Management Reporting' }
    ];
  }

  _getTimeframeOptions() {
    const currentYear = new Date().getFullYear();
    return [
      { value: 'CURRENT', label: 'Current' },
      { value: `FY${currentYear}`, label: `FY ${currentYear}` },
      { value: `FY${currentYear - 1}`, label: `FY ${currentYear - 1}` },
      { value: 'HISTORICAL', label: 'Historical' }
    ];
  }

  _attachEventListeners() {
    if (!this.container) return;

    const selects = this.container.querySelectorAll('.eo-frame-select');
    selects.forEach(select => {
      select.addEventListener('change', (e) => {
        const key = e.target.dataset.frameKey;
        const value = e.target.value;

        this.currentFrame[key] = value || undefined;

        if (this.onChange) {
          this.onChange(this.currentFrame);
        }

        // Dispatch event
        this.container.dispatchEvent(new CustomEvent('frame-change', {
          bubbles: true,
          detail: { frame: this.currentFrame }
        }));
      });
    });
  }

  getFrame() {
    return this.currentFrame;
  }

  setFrame(frame) {
    this.currentFrame = frame;
    this.render();
  }
}

// ============================================================================
// View-Level Definition Toggle Component
// ============================================================================

class DefinitionToggle {
  constructor(options = {}) {
    this.container = options.container;
    this.fieldName = options.fieldName;
    this.definitions = options.definitions || [];
    this.currentDefinition = options.currentDefinition;
    this.onChange = options.onChange;
  }

  render() {
    if (!this.container) return;

    if (this.definitions.length <= 1) {
      // No toggle needed if only one definition
      this.container.innerHTML = '';
      return;
    }

    this.container.innerHTML = `
      <div class="eo-definition-toggle">
        <span class="eo-toggle-label">${this.fieldName} Definition:</span>
        <select class="eo-definition-select">
          ${this.definitions.map(def => `
            <option value="${def.id}" ${def.id === this.currentDefinition?.id ? 'selected' : ''}>
              ${def.label || def.name}
            </option>
          `).join('')}
        </select>
        <span class="eo-toggle-hint" title="Switching definitions reinterprets the data without changing it">
          <i class="ph ph-info"></i>
        </span>
      </div>
    `;

    this._attachEventListeners();
  }

  _attachEventListeners() {
    const select = this.container?.querySelector('.eo-definition-select');
    if (select) {
      select.addEventListener('change', (e) => {
        const defId = e.target.value;
        const definition = this.definitions.find(d => d.id === defId);

        this.currentDefinition = definition;

        if (this.onChange) {
          this.onChange(definition);
        }

        this.container.dispatchEvent(new CustomEvent('definition-change', {
          bubbles: true,
          detail: { definition, fieldName: this.fieldName }
        }));
      });
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _behaviorEngine = null;

function getBehaviorEngine() {
  if (!_behaviorEngine) {
    _behaviorEngine = new DefinitionBehaviorEngine();
  }
  return _behaviorEngine;
}

// ============================================================================
// Export
// ============================================================================

window.EODefinitionBehavior = {
  // Types
  DefinitionFrameType,
  UnitCategories,

  // Classes
  DefinitionBehaviorEngine,
  DefinitionFrameSelector,
  DefinitionToggle,

  // Singleton
  getBehaviorEngine,

  // Convenience methods
  validateAggregation: (fields, type) => getBehaviorEngine().validateAggregation(fields, type),
  validateComparison: (f1, f2) => getBehaviorEngine().validateComparison(f1, f2),
  validateMerge: (r1, r2) => getBehaviorEngine().validateMerge(r1, r2),
  getRecommendedAggregations: (field) => getBehaviorEngine().getRecommendedAggregations(field)
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.EODefinitionBehavior;
}
