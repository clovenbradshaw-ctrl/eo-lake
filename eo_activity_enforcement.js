/**
 * EO Activity Enforcement - Rule Validation
 *
 * Enforces the rules defined in docs/LAYER_ACTIVITY_TRACKING_RULES.md
 *
 * This module provides comprehensive validation for:
 * 1. Universal activity requirements (operator, target, actor, timestamp)
 * 2. Operator-specific required fields
 * 3. Layer-specific constraints (which operators are allowed where)
 */

// ============================================================================
// Constants
// ============================================================================

const OPERATORS = Object.freeze({
  INS: 'INS',
  DES: 'DES',
  SEG: 'SEG',
  CON: 'CON',
  SYN: 'SYN',
  ALT: 'ALT',
  SUP: 'SUP',
  REC: 'REC',
  NUL: 'NUL'
});

const LAYER_TYPES = Object.freeze({
  PROJECT: 'project',
  SOURCE: 'source',
  DEFINITION: 'definition',
  SET: 'set',
  LENS: 'lens',
  VIEW: 'view'
});

// ============================================================================
// Layer-Operator Matrix
// ============================================================================

/**
 * Defines which operators are allowed for each layer.
 * Based on the Layer-Operator Matrix from LAYER_ACTIVITY_TRACKING_RULES.md
 *
 * Values:
 * - 'allowed': commonly used, fully permitted
 * - 'rare': rarely/contextually used, allowed with warning
 * - 'forbidden': not allowed for this layer
 */
const LAYER_OPERATOR_MATRIX = Object.freeze({
  [LAYER_TYPES.PROJECT]: {
    INS: 'allowed',
    DES: 'allowed',
    SEG: 'allowed',     // Archival
    CON: 'rare',        // Workspace hierarchy only
    SYN: 'rare',        // Projects shouldn't be synthesized
    ALT: 'rare',        // Limited use
    SUP: 'rare',        // Limited use
    REC: 'allowed',     // Implicit in all
    NUL: 'allowed'      // Deletion
  },
  [LAYER_TYPES.SOURCE]: {
    INS: 'allowed',
    DES: 'allowed',
    SEG: 'forbidden',   // Raw data cannot be hidden at source level
    CON: 'allowed',     // API connections
    SYN: 'forbidden',   // Source identity is fixed at creation
    ALT: 'forbidden',   // Sources don't change; create new source for updates
    SUP: 'forbidden',   // Sources are GIVEN, no interpretations
    REC: 'allowed',     // Provenance is essential
    NUL: 'forbidden'    // Sources cannot be deleted, only disconnected
  },
  [LAYER_TYPES.DEFINITION]: {
    INS: 'allowed',
    DES: 'allowed',
    SEG: 'rare',
    CON: 'allowed',     // External URI binding
    SYN: 'allowed',     // Merge duplicate terms
    ALT: 'allowed',     // Update term metadata
    SUP: 'allowed',     // Preserve multiple interpretations
    REC: 'allowed',
    NUL: 'allowed'      // Deprecate terms
  },
  [LAYER_TYPES.SET]: {
    INS: 'allowed',
    DES: 'allowed',
    SEG: 'rare',
    CON: 'allowed',     // Joins, bindings
    SYN: 'allowed',     // Entity resolution
    ALT: 'allowed',     // Record updates
    SUP: 'allowed',     // Uncertain matches
    REC: 'allowed',
    NUL: 'allowed'      // Soft delete
  },
  [LAYER_TYPES.LENS]: {
    INS: 'allowed',
    DES: 'allowed',
    SEG: 'allowed',     // Filter/hide
    CON: 'allowed',     // Clone with reference
    SYN: 'rare',
    ALT: 'allowed',     // Update filter, temporal lens
    SUP: 'allowed',
    REC: 'allowed',
    NUL: 'allowed'      // Delete lens
  },
  [LAYER_TYPES.VIEW]: {
    INS: 'allowed',
    DES: 'allowed',
    SEG: 'allowed',     // Filter, hide columns
    CON: 'rare',        // Duplicate view
    SYN: 'rare',
    ALT: 'allowed',     // Config changes, edits
    SUP: 'allowed',
    REC: 'allowed',
    NUL: 'allowed'      // Delete view
  }
});

// ============================================================================
// Operator-Specific Validation Rules
// ============================================================================

/**
 * Defines required fields for each operator.
 * Based on Validation Rules table from LAYER_ACTIVITY_TRACKING_RULES.md
 */
const OPERATOR_REQUIREMENTS = Object.freeze({
  INS: {
    description: 'Assert existence',
    requiredFields: [
      { path: 'target', message: 'INS requires a target entity ID' },
      { path: 'data.type', message: 'INS requires target.type (valid layer type)', optional: true }
    ],
    validate: (activity) => {
      const errors = [];
      // Value is recommended but not strictly required
      if (!activity.data?.value && !activity.data?.type) {
        // Only warn if no useful data at all
      }
      return errors;
    }
  },

  DES: {
    description: 'Designate identity',
    requiredFields: [
      { path: 'target', message: 'DES requires a target entity ID' }
    ],
    validate: (activity) => {
      const errors = [];
      // DES typically uses delta for naming
      if (activity.delta) {
        const [, newName] = activity.delta;
        if (newName === null || newName === undefined || newName === '') {
          errors.push('DES requires non-empty new name in delta[1]');
        }
      }
      return errors;
    }
  },

  SEG: {
    description: 'Scope visibility',
    requiredFields: [
      { path: 'target', message: 'SEG requires a target entity ID' }
    ],
    validate: (activity) => {
      const errors = [];
      // SEG should specify visibility type or scope
      if (!activity.data?.scope && !activity.data?.visibility &&
          !activity.data?.visibilityType && !activity.data?.value?.visibility) {
        errors.push('SEG requires visibility specification (scope, visibility, or visibilityType)');
      }
      return errors;
    }
  },

  CON: {
    description: 'Connect entities',
    requiredFields: [
      { path: 'target', message: 'CON requires a target entity ID' }
    ],
    validate: (activity) => {
      const errors = [];

      // CON requires relatedTo
      if (!activity.data?.relatedTo) {
        errors.push('CON requires relatedTo - what entity is being connected to');
      }

      // For joins, CON requires conflictPolicy
      if (activity.data?.joinType || activity.data?.conditions) {
        if (!activity.data?.conflictPolicy) {
          errors.push('CON (join) requires explicit conflictPolicy for handling conflicts');
        }
      }

      return errors;
    }
  },

  SYN: {
    description: 'Synthesize identity',
    requiredFields: [
      { path: 'target', message: 'SYN requires a target entity ID' }
    ],
    validate: (activity) => {
      const errors = [];
      const data = activity.data || {};

      // SYN requires left, right, and canonical
      if (!data.left && !data.mergedFrom) {
        errors.push('SYN requires left entity ID or mergedFrom array');
      }
      if (!data.right && !data.mergedFrom) {
        errors.push('SYN requires right entity ID or mergedFrom array');
      }
      if (!data.canonical && !activity.target) {
        errors.push('SYN requires canonical (surviving) entity ID');
      }

      // Canonical must be one of left/right
      if (data.canonical && data.left && data.right) {
        if (data.canonical !== data.left && data.canonical !== data.right) {
          errors.push('SYN canonical must be one of left or right');
        }
      }

      return errors;
    }
  },

  ALT: {
    description: 'Alternate world state',
    requiredFields: [
      { path: 'target', message: 'ALT requires a target entity ID' }
    ],
    validate: (activity) => {
      const errors = [];

      // ALT requires delta [previous, next]
      if (!activity.delta) {
        errors.push('ALT requires delta [previousValue, newValue]');
      } else if (!Array.isArray(activity.delta) || activity.delta.length !== 2) {
        errors.push('ALT delta must be array with [previousValue, newValue]');
      }

      return errors;
    }
  },

  SUP: {
    description: 'Superpose interpretations',
    requiredFields: [
      { path: 'target', message: 'SUP requires a target entity ID' }
    ],
    validate: (activity) => {
      const errors = [];
      const data = activity.data || {};

      // SUP requires interpretations array with at least 2 items
      if (!data.interpretations) {
        errors.push('SUP requires interpretations array');
      } else if (!Array.isArray(data.interpretations)) {
        errors.push('SUP interpretations must be an array');
      } else if (data.interpretations.length < 2) {
        errors.push('SUP requires at least 2 interpretations');
      }

      return errors;
    }
  },

  REC: {
    description: 'Record grounding',
    requiredFields: [
      { path: 'target', message: 'REC requires a target entity ID' }
    ],
    validate: (activity) => {
      const errors = [];
      const data = activity.data || {};

      // REC should have provenance chain
      if (!data.chain && !data.provenance && !activity.source) {
        errors.push('REC requires provenance chain (data.chain or source)');
      }

      return errors;
    }
  },

  NUL: {
    description: 'Assert meaningful absence',
    requiredFields: [
      { path: 'target', message: 'NUL requires a target entity ID' }
    ],
    validate: (activity) => {
      const errors = [];
      const data = activity.data || {};

      // NUL requires reason
      if (!data.reason) {
        errors.push('NUL requires reason explaining why entity is being nullified');
      }

      return errors;
    }
  }
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate universal activity requirements
 * Every activity must have: operator, target, actor, timestamp
 */
function validateUniversalRequirements(activity) {
  const errors = [];
  const warnings = [];

  // 1. Operator is required
  if (!activity.op) {
    errors.push('Missing operator (op)');
  } else if (!OPERATORS[activity.op]) {
    errors.push(`Invalid operator: ${activity.op}. Must be one of: ${Object.keys(OPERATORS).join(', ')}`);
  }

  // 2. Target is required
  if (!activity.target) {
    errors.push('Missing target - every activity must specify what is being operated on');
  }

  // 3. Actor is required
  if (!activity.actor) {
    errors.push('Missing actor - every activity must specify who/what is performing it');
  }

  // 4. Timestamp is required
  if (!activity.ts) {
    errors.push('Missing timestamp (ts)');
  }

  return { errors, warnings };
}

/**
 * Validate operator-specific requirements
 */
function validateOperatorRequirements(activity) {
  const errors = [];
  const warnings = [];

  if (!activity.op || !OPERATORS[activity.op]) {
    return { errors, warnings }; // Already caught by universal validation
  }

  const requirements = OPERATOR_REQUIREMENTS[activity.op];
  if (!requirements) {
    return { errors, warnings };
  }

  // Check required fields
  for (const field of requirements.requiredFields) {
    const value = getNestedValue(activity, field.path);
    if (value === undefined || value === null) {
      if (field.optional) {
        warnings.push(field.message);
      } else {
        errors.push(field.message);
      }
    }
  }

  // Run custom validation
  if (requirements.validate) {
    const customErrors = requirements.validate(activity);
    errors.push(...customErrors);
  }

  return { errors, warnings };
}

/**
 * Validate layer-specific constraints
 * Checks if the operator is allowed for the given layer type
 */
function validateLayerConstraints(activity, layerType) {
  const errors = [];
  const warnings = [];

  if (!activity.op || !OPERATORS[activity.op]) {
    return { errors, warnings };
  }

  if (!layerType || !LAYER_TYPES[layerType.toUpperCase()]) {
    // Can't validate without layer type - just warn
    warnings.push(`Unknown layer type: ${layerType}. Cannot validate layer constraints.`);
    return { errors, warnings };
  }

  const normalizedLayer = layerType.toLowerCase();
  const matrix = LAYER_OPERATOR_MATRIX[normalizedLayer];

  if (!matrix) {
    return { errors, warnings };
  }

  const allowance = matrix[activity.op];

  if (allowance === 'forbidden') {
    errors.push(
      `Operator ${activity.op} is not allowed for ${normalizedLayer} layer. ` +
      getLayerOperatorReason(activity.op, normalizedLayer)
    );
  } else if (allowance === 'rare') {
    warnings.push(
      `Operator ${activity.op} is rarely used for ${normalizedLayer} layer. ` +
      `Consider if this is the intended operation.`
    );
  }

  // Additional layer-specific validation
  const layerErrors = validateLayerSpecificRules(activity, normalizedLayer);
  errors.push(...layerErrors.errors);
  warnings.push(...layerErrors.warnings);

  return { errors, warnings };
}

/**
 * Get explanation for why an operator is forbidden on a layer
 */
function getLayerOperatorReason(op, layer) {
  const reasons = {
    source: {
      SEG: 'Raw data cannot be hidden at source level.',
      SYN: 'Source identity is fixed at creation.',
      ALT: 'Sources are immutable. Create new source for updates.',
      SUP: 'Sources are GIVEN facts, not interpretations.',
      NUL: 'Sources cannot be deleted, only disconnected.'
    }
  };

  return reasons[layer]?.[op] || '';
}

/**
 * Validate layer-specific rules beyond operator allowance
 */
function validateLayerSpecificRules(activity, layer) {
  const errors = [];
  const warnings = [];

  switch (layer) {
    case 'source':
      // Sources are append-only
      if (activity.delta && activity.delta[0] !== null && activity.delta[0] !== undefined) {
        warnings.push('Sources are append-only. Modifying existing source data is discouraged.');
      }
      break;

    case 'definition':
      // CON for definitions requires valid URI for external
      if (activity.op === 'CON' && activity.data?.sourceType === 'external') {
        if (!activity.data?.uri && !activity.data?.relatedTo?.startsWith('uri:')) {
          errors.push('CON for external definition requires valid URI');
        }
      }
      break;

    case 'set':
      // CON for joins requires conflictPolicy
      if (activity.op === 'CON' && (activity.data?.joinType || activity.data?.conditions)) {
        if (!activity.data?.conflictPolicy) {
          errors.push('CON (join) in SET layer requires explicit conflictPolicy');
        }
      }
      break;

    case 'lens':
      // SEG must be restrictive (cannot expand beyond parent set)
      if (activity.op === 'SEG' && activity.data?.expandBeyondParent) {
        errors.push('SEG in LENS layer must be restrictive - cannot expand beyond parent set');
      }
      break;

    case 'view':
      // View edits should specify propagation
      if (activity.op === 'ALT' && activity.data?.type === 'record') {
        if (!activity.source && !activity.data?.propagateTo) {
          warnings.push('ALT on record in VIEW should specify propagation to SET layer');
        }
      }
      break;
  }

  return { errors, warnings };
}

// ============================================================================
// Main Validation Entry Point
// ============================================================================

/**
 * Comprehensive activity validation
 * Enforces all rules from LAYER_ACTIVITY_TRACKING_RULES.md
 *
 * @param {Object} activity - The activity to validate
 * @param {Object} options - Validation options
 * @param {string} options.layerType - The layer type (project, source, definition, set, lens, view)
 * @param {boolean} options.strict - If true, treats warnings as errors
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
function enforceActivityRules(activity, options = {}) {
  const allErrors = [];
  const allWarnings = [];

  // 1. Universal requirements
  const universal = validateUniversalRequirements(activity);
  allErrors.push(...universal.errors);
  allWarnings.push(...universal.warnings);

  // 2. Operator-specific requirements
  const operator = validateOperatorRequirements(activity);
  allErrors.push(...operator.errors);
  allWarnings.push(...operator.warnings);

  // 3. Layer-specific constraints (if layer type provided)
  if (options.layerType) {
    const layer = validateLayerConstraints(activity, options.layerType);
    allErrors.push(...layer.errors);
    allWarnings.push(...layer.warnings);
  }

  // In strict mode, warnings become errors
  if (options.strict) {
    allErrors.push(...allWarnings);
    allWarnings.length = 0;
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}

/**
 * Validate and throw if invalid
 * Use this for strict enforcement in production code
 */
function enforceOrThrow(activity, options = {}) {
  const result = enforceActivityRules(activity, { ...options, strict: true });

  if (!result.valid) {
    const error = new Error(
      `Activity validation failed:\n` +
      result.errors.map(e => `  - ${e}`).join('\n')
    );
    error.name = 'ActivityValidationError';
    error.activity = activity;
    error.errors = result.errors;
    throw error;
  }

  return activity;
}

/**
 * Create a validated activity
 * Wraps createActivity with enforcement
 */
function createValidatedActivity(op, target, actor, options = {}) {
  const activity = {
    id: options.id || generateId('act'),
    ts: options.ts || Date.now(),
    op,
    actor,
    target: typeof target === 'string' ? target : (target?.id || target?.entityId)
  };

  // Add optional fields
  const field = typeof target === 'object' ? (target?.field || target?.fieldId) : null;
  if (field) activity.field = field;
  if (options.delta) activity.delta = options.delta;
  if (options.method) activity.method = options.method;
  if (options.source) activity.source = options.source;
  if (options.seq) activity.seq = options.seq;
  if (options.ctx) activity.ctx = options.ctx;
  if (options.data) activity.data = options.data;

  // Validate
  const result = enforceActivityRules(activity, {
    layerType: options.layerType,
    strict: options.strict
  });

  if (!result.valid) {
    const error = new Error(
      `Cannot create activity - validation failed:\n` +
      result.errors.map(e => `  - ${e}`).join('\n')
    );
    error.name = 'ActivityValidationError';
    error.activity = activity;
    error.errors = result.errors;
    throw error;
  }

  // Attach warnings for logging/debugging
  if (result.warnings.length > 0) {
    activity._warnings = result.warnings;
    if (typeof console !== 'undefined') {
      console.warn(`Activity ${activity.id} has warnings:`, result.warnings);
    }
  }

  return activity;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(prefix = 'act') {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

// ============================================================================
// Convenience Validators
// ============================================================================

/**
 * Validate activity for PROJECT layer
 */
function validateProjectActivity(activity, options = {}) {
  return enforceActivityRules(activity, { ...options, layerType: 'project' });
}

/**
 * Validate activity for SOURCE layer
 */
function validateSourceActivity(activity, options = {}) {
  return enforceActivityRules(activity, { ...options, layerType: 'source' });
}

/**
 * Validate activity for DEFINITION layer
 */
function validateDefinitionActivity(activity, options = {}) {
  return enforceActivityRules(activity, { ...options, layerType: 'definition' });
}

/**
 * Validate activity for SET layer
 */
function validateSetActivity(activity, options = {}) {
  return enforceActivityRules(activity, { ...options, layerType: 'set' });
}

/**
 * Validate activity for LENS layer
 */
function validateLensActivity(activity, options = {}) {
  return enforceActivityRules(activity, { ...options, layerType: 'lens' });
}

/**
 * Validate activity for VIEW layer
 */
function validateViewActivity(activity, options = {}) {
  return enforceActivityRules(activity, { ...options, layerType: 'view' });
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Validate multiple activities
 * Returns summary of all validation results
 */
function validateActivities(activities, options = {}) {
  const results = [];
  let validCount = 0;
  let invalidCount = 0;
  const allErrors = [];
  const allWarnings = [];

  for (const activity of activities) {
    const result = enforceActivityRules(activity, options);
    results.push({
      activityId: activity.id,
      ...result
    });

    if (result.valid) {
      validCount++;
    } else {
      invalidCount++;
    }

    allErrors.push(...result.errors.map(e => `[${activity.id}] ${e}`));
    allWarnings.push(...result.warnings.map(w => `[${activity.id}] ${w}`));
  }

  return {
    total: activities.length,
    valid: validCount,
    invalid: invalidCount,
    allValid: invalidCount === 0,
    results,
    errors: allErrors,
    warnings: allWarnings
  };
}

/**
 * Validate an activity sequence/chain
 * Additional checks for sequence coherence
 */
function validateActivitySequence(activities, options = {}) {
  const batchResult = validateActivities(activities, options);
  const sequenceErrors = [];
  const sequenceWarnings = [];

  if (activities.length === 0) {
    sequenceErrors.push('Activity sequence must be non-empty');
    return {
      ...batchResult,
      sequenceValid: false,
      sequenceErrors,
      sequenceWarnings
    };
  }

  // Sequence should start with INS
  if (activities[0].op !== 'INS') {
    sequenceErrors.push('Activity sequence should start with INS (assert existence)');
  }

  // Sequence should typically end with DES
  if (activities[activities.length - 1].op !== 'DES') {
    sequenceWarnings.push('Activity sequence should typically end with DES (designate identity)');
  }

  // Check for REC (grounding) in sequence
  const hasREC = activities.some(a => a.op === 'REC');
  if (!hasREC) {
    sequenceWarnings.push('Activity sequence should include REC (record grounding) for provenance');
  }

  return {
    ...batchResult,
    sequenceValid: batchResult.allValid && sequenceErrors.length === 0,
    sequenceErrors,
    sequenceWarnings
  };
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Constants
    OPERATORS,
    LAYER_TYPES,
    LAYER_OPERATOR_MATRIX,
    OPERATOR_REQUIREMENTS,

    // Main validation
    enforceActivityRules,
    enforceOrThrow,
    createValidatedActivity,

    // Component validators
    validateUniversalRequirements,
    validateOperatorRequirements,
    validateLayerConstraints,

    // Layer-specific validators
    validateProjectActivity,
    validateSourceActivity,
    validateDefinitionActivity,
    validateSetActivity,
    validateLensActivity,
    validateViewActivity,

    // Batch validation
    validateActivities,
    validateActivitySequence
  };
}

if (typeof window !== 'undefined') {
  window.EOActivityEnforcement = {
    // Constants
    OPERATORS,
    LAYER_TYPES,
    LAYER_OPERATOR_MATRIX,
    OPERATOR_REQUIREMENTS,

    // Main validation
    enforce: enforceActivityRules,
    enforceOrThrow,
    createValidated: createValidatedActivity,

    // Component validators
    validateUniversal: validateUniversalRequirements,
    validateOperator: validateOperatorRequirements,
    validateLayer: validateLayerConstraints,

    // Layer-specific validators
    validateProject: validateProjectActivity,
    validateSource: validateSourceActivity,
    validateDefinition: validateDefinitionActivity,
    validateSet: validateSetActivity,
    validateLens: validateLensActivity,
    validateView: validateViewActivity,

    // Batch validation
    validateBatch: validateActivities,
    validateSequence: validateActivitySequence
  };
}
