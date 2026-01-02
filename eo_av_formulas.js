/**
 * EO AV Formulas - Advaita Vedanta-Inspired Semantic Formula Functions
 *
 * Implements formula types based on Advaita Vedanta epistemology:
 * 1. Neti-Neti (EXCEPT/UNLESS) - Truth by elimination
 * 2. Provisional (VALID_WHEN/ASSUMING) - Scoped truth with assumptions
 * 3. Partial Identity (EQUIVALENT_WHEN) - Purpose-bound equivalence
 * 4. Self-Correcting (WITH_ASSUMPTIONS/FRAGILITY) - Queryable assumptions
 * 5. Non-Assertive (DIAGNOSTIC) - Observation without decision
 * 6. Recursive (REFINE_UNTIL) - Convergent truth
 *
 * PRINCIPLE: Formulas that manage meaning, not just compute values.
 */

// ============================================================================
// EO Operator Types (for decomposition)
// ============================================================================

const Op = Object.freeze({
  CON: 'CON',   // Connect
  SEG: 'SEG',   // Segment
  SYN: 'SYN',   // Synthesize
  ALT: 'ALT',   // Alter
  DES: 'DES',   // Designate
  NUL: 'NUL',   // Null
  INS: 'INS',   // Insert
  REC: 'REC',   // Record/Recurse
  SUP: 'SUP'    // Superposition
});

// ============================================================================
// Argument Types
// ============================================================================

const ArgType = Object.freeze({
  ANY: 'any',
  TEXT: 'text',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  DATE: 'date',
  ARRAY: 'array',
  OBJECT: 'object'
});

// ============================================================================
// Function Registry
// ============================================================================

const AVFunctionRegistry = new Map();

/**
 * Register an AV-inspired function
 */
function register(name, definition) {
  AVFunctionRegistry.set(name, {
    name,
    ...definition,
    isAVInspired: true
  });
}

/**
 * Get a registered function
 */
function getFunction(name) {
  return AVFunctionRegistry.get(name);
}

/**
 * Get all AV-inspired functions
 */
function getAllFunctions() {
  return Array.from(AVFunctionRegistry.values());
}

// ============================================================================
// Helper Functions
// ============================================================================

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

function projectFields(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const field of fields) {
    if (field in obj) {
      result[field] = obj[field];
    }
  }
  return result;
}

function findDifferences(a, b, ignoring = []) {
  const diffs = [];
  const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);

  for (const key of allKeys) {
    if (ignoring.includes(key)) continue;
    if (!deepEqual(a?.[key], b?.[key])) {
      diffs.push(`${key}: ${JSON.stringify(a?.[key])} vs ${JSON.stringify(b?.[key])}`);
    }
  }

  return diffs;
}

function findMatches(projA, projB) {
  const matches = [];
  for (const key of Object.keys(projA)) {
    if (deepEqual(projA[key], projB[key])) {
      matches.push(`${key}: ${JSON.stringify(projA[key])}`);
    }
  }
  return matches;
}

function fragilityLevel(level) {
  switch (level?.toLowerCase()) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

function fragilityLabel(level) {
  switch (level) {
    case 3: return 'HIGH';
    case 2: return 'MEDIUM';
    case 1: return 'LOW';
    default: return 'NONE';
  }
}

function evaluateScopeCompatibility(scope, targetContext) {
  // Simple scope compatibility check
  if (!scope || !targetContext) return true;

  // Check if all scope conditions are satisfied in target context
  if (typeof scope === 'object') {
    for (const [key, value] of Object.entries(scope)) {
      if (targetContext[key] !== value) return false;
    }
  }

  return true;
}

function countChanges(before, after) {
  if (!before || !after) return 0;
  let count = 0;

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (!deepEqual(before[key], after[key])) count++;
  }

  return count;
}

function isStable(value, condition) {
  switch (condition) {
    case 'STABLE':
    case 'NO_CONFLICTS':
    case 'CONVERGED':
      return true; // Simplified - actual implementation would check conflicts
    default:
      return false;
  }
}

function applyRefinementRules(value, rules) {
  // Simplified refinement - actual implementation would apply each rule
  return { ...value };
}

// ============================================================================
// NETI-NETI FORMULAS (Truth by Elimination)
// ============================================================================

register('EXCEPT', {
  category: 'Semantic',
  description: 'Start with a value, subtract violations (Neti-Neti pattern)',
  eoDecomposition: [Op.NUL, Op.SEG, Op.ALT],
  eoExplanation: 'NUL(detect) → SEG(violations) → ALT(subtract) - Truth by elimination',
  avOrigin: 'Neti-Neti (not this, not this)',
  args: [
    { name: 'baseValue', type: ArgType.ANY, required: true, description: 'The value if no violations' },
    { name: 'violations', type: ArgType.ARRAY, required: true, description: 'Array of UNLESS() conditions' }
  ],
  returns: ArgType.ANY,
  implementation: (baseValue, violations) => {
    const failed = (violations || []).filter(v => v && v.failed);
    if (failed.length === 0) {
      return { value: baseValue, reasons: [], valid: true };
    }
    return {
      value: null,
      valid: false,
      reasons: failed.map(v => v.reason),
      eliminatedBy: 'EXCEPT'
    };
  },
  toPipeline: (args) => [
    { operator: Op.NUL, params: { mode: 'DETECT_VIOLATIONS', violations: args.violations } },
    { operator: Op.SEG, params: { mode: 'FILTER_FAILURES' } },
    { operator: Op.ALT, params: { mode: 'SUBTRACT_FROM_BASE', base: args.baseValue } }
  ],
  examples: [
    'EXCEPT("Valid", UNLESS({HasLicense}, "No license"), UNLESS({Insured}, "Not insured"))'
  ]
});

register('UNLESS', {
  category: 'Semantic',
  description: 'Define a violation condition for EXCEPT',
  eoDecomposition: [Op.SEG, Op.NUL],
  eoExplanation: 'SEG(test condition) → NUL(mark violation) - Elimination clause',
  avOrigin: 'Neti-Neti component',
  args: [
    { name: 'condition', type: ArgType.BOOLEAN, required: true, description: 'Condition that must be true' },
    { name: 'reason', type: ArgType.TEXT, required: true, description: 'Reason for violation if false' }
  ],
  returns: ArgType.OBJECT,
  implementation: (condition, reason) => ({
    failed: !condition,
    reason: reason,
    type: 'UNLESS'
  }),
  toPipeline: (args) => [
    { operator: Op.SEG, params: { condition: args.condition } },
    { operator: Op.NUL, params: { mode: 'MARK_VIOLATION', reason: args.reason } }
  ],
  examples: [
    'UNLESS({HasLicense}, "Missing license")',
    'UNLESS({Age} >= 18, "Must be 18 or older")'
  ]
});

// ============================================================================
// PROVISIONAL FORMULAS (Scoped Truth)
// ============================================================================

register('VALID_WHEN', {
  category: 'Semantic',
  description: 'Attach scope to a value - value is only valid within scope',
  eoDecomposition: [Op.DES],
  eoExplanation: 'DES(attach scope) - Provisional truth within context',
  avOrigin: 'Vyāvahārika satya (practical/contextual truth)',
  args: [
    { name: 'value', type: ArgType.ANY, required: true, description: 'The value to scope' },
    { name: 'scopeCondition', type: ArgType.BOOLEAN, required: true, description: 'Condition for validity' }
  ],
  returns: ArgType.OBJECT,
  implementation: (value, scopeCondition) => ({
    value: value,
    scope: scopeCondition,
    scopeDescription: String(scopeCondition),
    portable: false,
    type: 'SCOPED_VALUE'
  }),
  toPipeline: (args) => [
    { operator: Op.DES, params: { mode: 'ATTACH_SCOPE', scope: args.scopeCondition } }
  ],
  examples: [
    'VALID_WHEN({Revenue}, {Region} = "US")',
    'VALID_WHEN({Total}, {FiscalYear} = 2024)'
  ]
});

register('ASSUMING', {
  category: 'Semantic',
  description: 'Attach explicit assumptions to a computed value',
  eoDecomposition: [Op.DES, Op.SUP],
  eoExplanation: 'DES(attach assumptions) - Makes hidden assumptions visible',
  avOrigin: 'Adhyāsa awareness (superimposition audit)',
  args: [
    { name: 'value', type: ArgType.ANY, required: true, description: 'The computed value' },
    { name: 'assumptions', type: ArgType.ARRAY, required: true, description: 'Array of assumption strings' }
  ],
  returns: ArgType.OBJECT,
  implementation: (value, assumptions) => ({
    value: value,
    assumptions: assumptions || [],
    assumptionCount: (assumptions || []).length,
    type: 'ASSUMED_VALUE'
  }),
  toPipeline: (args) => [
    { operator: Op.DES, params: { mode: 'ATTACH_ASSUMPTIONS', assumptions: args.assumptions } }
  ],
  examples: [
    'ASSUMING({Price} * {Qty}, "Currency is USD", "Price includes tax")',
    'ASSUMING({Total}, "Exchange rate as of close", "No pending transactions")'
  ]
});

register('SCOPE_COMPATIBLE', {
  category: 'Semantic',
  description: 'Check if a scoped value can be used in current context',
  eoDecomposition: [Op.SEG, Op.DES],
  eoExplanation: 'SEG(compare scopes) → DES(compatibility result)',
  avOrigin: 'Context compatibility check',
  args: [
    { name: 'scopedValue', type: ArgType.ANY, required: true, description: 'A value with scope attached' },
    { name: 'targetContext', type: ArgType.ANY, required: true, description: 'The context to check against' }
  ],
  returns: ArgType.BOOLEAN,
  implementation: (scopedValue, targetContext) => {
    if (!scopedValue?.scope) return true; // No scope = universal
    return evaluateScopeCompatibility(scopedValue.scope, targetContext);
  },
  toPipeline: (args) => [
    { operator: Op.SEG, params: { mode: 'COMPARE_SCOPES' } }
  ],
  examples: [
    'IF(SCOPE_COMPATIBLE({Revenue_Q4}, {CurrentContext}), {Revenue_Q4}, BLANK())'
  ]
});

// ============================================================================
// PARTIAL IDENTITY FORMULAS (Jahadajahallakṣaṇā)
// ============================================================================

register('EQUIVALENT_WHEN', {
  category: 'Semantic',
  description: 'Test equivalence under projection (purpose-bound identity)',
  eoDecomposition: [Op.CON, Op.SEG, Op.ALT],
  eoExplanation: 'CON(both values) → SEG(project retained fields) → ALT(compare)',
  avOrigin: 'Jahadajahallakṣaṇā (partial identity)',
  args: [
    { name: 'valueA', type: ArgType.ANY, required: true, description: 'First value to compare' },
    { name: 'valueB', type: ArgType.ANY, required: true, description: 'Second value to compare' },
    { name: 'ignoring', type: ArgType.ARRAY, required: false, description: 'Fields to ignore' },
    { name: 'retaining', type: ArgType.ARRAY, required: true, description: 'Fields that must match' }
  ],
  returns: ArgType.OBJECT,
  implementation: (valueA, valueB, ignoring = [], retaining) => {
    const projA = projectFields(valueA, retaining || []);
    const projB = projectFields(valueB, retaining || []);
    const equivalent = deepEqual(projA, projB);

    return {
      equivalent,
      forPurpose: (retaining || []).join('+'),
      ignoredDifferences: findDifferences(valueA, valueB, ignoring || []),
      retainedMatches: equivalent ? (retaining || []) : findMatches(projA, projB),
      type: 'EQUIVALENCE_RESULT'
    };
  },
  toPipeline: (args) => [
    { operator: Op.SEG, params: { mode: 'PROJECT', fields: args.retaining } },
    { operator: Op.ALT, params: { mode: 'COMPARE_PROJECTED' } }
  ],
  examples: [
    'EQUIVALENT_WHEN({CustA}, {CustB}, IGNORING("Source"), RETAINING("TaxID", "Name"))',
    'EQUIVALENT_WHEN({RecordA}, {RecordB}, null, RETAINING("ID", "Amount"))'
  ]
});

register('IGNORING', {
  category: 'Semantic',
  description: 'Define fields to ignore in equivalence check',
  eoDecomposition: [Op.DES],
  eoExplanation: 'DES(mark as ignorable)',
  avOrigin: 'Jahadajahallakṣaṇā component (jahad - discard)',
  args: [
    { name: 'fields', type: ArgType.ARRAY, required: true, description: 'Field names to ignore', variadic: true }
  ],
  returns: ArgType.ARRAY,
  implementation: (...fields) => fields.flat(),
  toPipeline: () => [],
  examples: [
    'IGNORING("SourceSystem", "CreatedAt", "UpdatedAt")'
  ]
});

register('RETAINING', {
  category: 'Semantic',
  description: 'Define fields that must match in equivalence check',
  eoDecomposition: [Op.DES],
  eoExplanation: 'DES(mark as required)',
  avOrigin: 'Jahadajahallakṣaṇā component (ajahad - retain)',
  args: [
    { name: 'fields', type: ArgType.ARRAY, required: true, description: 'Field names to retain', variadic: true }
  ],
  returns: ArgType.ARRAY,
  implementation: (...fields) => fields.flat(),
  toPipeline: () => [],
  examples: [
    'RETAINING("TaxID", "LegalName", "Address")'
  ]
});

// ============================================================================
// SELF-CORRECTING FORMULAS (Queryable Assumptions)
// ============================================================================

register('WITH_ASSUMPTIONS', {
  category: 'Semantic',
  description: 'Attach queryable assumptions with fragility tracking',
  eoDecomposition: [Op.ALT, Op.DES, Op.SUP],
  eoExplanation: 'ALT(compute) → DES(assumptions) → SUP(fragility)',
  avOrigin: 'Adhyāsa (superimposition) awareness',
  args: [
    { name: 'value', type: ArgType.ANY, required: true, description: 'The computed value' },
    { name: 'assumptions', type: ArgType.ARRAY, required: true, description: 'Array of assumptions' },
    { name: 'fragilityConditions', type: ArgType.ARRAY, required: false, description: 'Conditions that increase fragility' }
  ],
  returns: ArgType.OBJECT,
  implementation: (value, assumptions, fragilityConditions = []) => {
    const triggered = fragilityConditions.filter(c => c?.triggered);
    const maxFragility = triggered.reduce((max, c) =>
      Math.max(max, fragilityLevel(c?.level)), 0);

    return {
      value: value,
      assumptions: assumptions || [],
      fragility: fragilityLabel(maxFragility),
      fragilityReasons: triggered.map(c => c?.reason).filter(Boolean),
      type: 'ASSUMPTION_TRACKED_VALUE'
    };
  },
  toPipeline: (args) => [
    { operator: Op.ALT, params: { mode: 'COMPUTE' } },
    { operator: Op.DES, params: { mode: 'ATTACH_ASSUMPTIONS', assumptions: args.assumptions } },
    { operator: Op.SUP, params: { mode: 'FRAGILITY_CHECK', conditions: args.fragilityConditions } }
  ],
  examples: [
    'WITH_ASSUMPTIONS({Price} * {Qty} * {Rate}, ["IDs unique", "Currency at spot"], HIGH_IF({Rate}.age > 24h))'
  ]
});

register('HIGH_IF', {
  category: 'Semantic',
  description: 'Define a high-fragility condition',
  eoDecomposition: [Op.SEG],
  eoExplanation: 'SEG(test fragility condition)',
  avOrigin: 'Fragility classification',
  args: [
    { name: 'condition', type: ArgType.BOOLEAN, required: true, description: 'Condition that triggers high fragility' },
    { name: 'reason', type: ArgType.TEXT, required: false, description: 'Why this is high fragility' }
  ],
  returns: ArgType.OBJECT,
  implementation: (condition, reason = 'Condition triggered') => ({
    triggered: !!condition,
    level: 'HIGH',
    reason: reason
  }),
  toPipeline: () => [],
  examples: [
    'HIGH_IF({DataAge} > 24, "Data more than 24 hours old")'
  ]
});

register('MEDIUM_IF', {
  category: 'Semantic',
  description: 'Define a medium-fragility condition',
  eoDecomposition: [Op.SEG],
  eoExplanation: 'SEG(test fragility condition)',
  avOrigin: 'Fragility classification',
  args: [
    { name: 'condition', type: ArgType.BOOLEAN, required: true, description: 'Condition that triggers medium fragility' },
    { name: 'reason', type: ArgType.TEXT, required: false, description: 'Why this is medium fragility' }
  ],
  returns: ArgType.OBJECT,
  implementation: (condition, reason = 'Condition triggered') => ({
    triggered: !!condition,
    level: 'MEDIUM',
    reason: reason
  }),
  toPipeline: () => [],
  examples: [
    'MEDIUM_IF({Quantity} < 0, "Negative quantity detected")'
  ]
});

// ============================================================================
// NON-ASSERTIVE FORMULAS (Observation Only)
// ============================================================================

register('DIAGNOSTIC', {
  category: 'Semantic',
  description: 'Mark a value as non-assertive (cannot drive decisions)',
  eoDecomposition: [Op.DES],
  eoExplanation: 'DES(mark non-assertive) - Value for observation only',
  avOrigin: 'Illuminative but non-binding cognition',
  args: [
    { name: 'value', type: ArgType.ANY, required: true, description: 'The diagnostic value' },
    { name: 'reason', type: ArgType.TEXT, required: false, description: 'Why this is diagnostic only' }
  ],
  returns: ArgType.OBJECT,
  implementation: (value, reason) => ({
    value: value,
    _diagnostic: true,
    _nonAssertive: true,
    reason: reason || 'For investigation only',
    type: 'DIAGNOSTIC_VALUE',
    // Marker that enforcement layer checks
    __noDecision: true
  }),
  toPipeline: () => [
    { operator: Op.DES, params: { mode: 'MARK_DIAGNOSTIC' } }
  ],
  examples: [
    'DIAGNOSTIC(COMPARE({SystemA.Balance}, {SystemB.Balance}), "For investigation only")',
    'DIAGNOSTIC({Variance}, "Not for automated action")'
  ],
  // Special flag for enforcement layer
  nonAssertive: true
});

register('COMPARE', {
  category: 'Semantic',
  description: 'Compare two values for diagnostic purposes',
  eoDecomposition: [Op.ALT],
  eoExplanation: 'ALT(compute difference)',
  avOrigin: 'Observational comparison',
  args: [
    { name: 'valueA', type: ArgType.ANY, required: true, description: 'First value' },
    { name: 'valueB', type: ArgType.ANY, required: true, description: 'Second value' }
  ],
  returns: ArgType.OBJECT,
  implementation: (valueA, valueB) => {
    const numA = parseFloat(valueA);
    const numB = parseFloat(valueB);

    if (!isNaN(numA) && !isNaN(numB)) {
      return {
        valueA: numA,
        valueB: numB,
        difference: numA - numB,
        percentDiff: numB !== 0 ? ((numA - numB) / numB) * 100 : null,
        equal: numA === numB,
        type: 'COMPARISON_RESULT'
      };
    }

    return {
      valueA,
      valueB,
      equal: deepEqual(valueA, valueB),
      type: 'COMPARISON_RESULT'
    };
  },
  toPipeline: () => [
    { operator: Op.ALT, params: { mode: 'COMPARE' } }
  ],
  examples: [
    'COMPARE({System1.Total}, {System2.Total})'
  ]
});

// ============================================================================
// RECURSIVE STABILIZATION FORMULAS (Convergent Truth)
// ============================================================================

register('REFINE_UNTIL', {
  category: 'Semantic',
  description: 'Iteratively refine a value until stable',
  eoDecomposition: [Op.REC, Op.SEG, Op.SYN],
  eoExplanation: 'REC(iterate) until fixed point - Convergent truth',
  avOrigin: 'Truth via repeated correction',
  args: [
    { name: 'initial', type: ArgType.ANY, required: true, description: 'Initial value' },
    { name: 'stableCondition', type: ArgType.TEXT, required: true, description: 'Condition: STABLE, NO_CONFLICTS, CONVERGED' },
    { name: 'maxIterations', type: ArgType.NUMBER, required: false, description: 'Maximum iterations (default 10)' },
    { name: 'rules', type: ArgType.ARRAY, required: true, description: 'Refinement rules to apply' }
  ],
  returns: ArgType.OBJECT,
  implementation: (initial, stableCondition, maxIterations = 10, rules) => {
    let current = initial;
    let iterations = 0;
    const changes = [];

    while (iterations < maxIterations) {
      const next = applyRefinementRules(current, rules);
      const changeCount = countChanges(current, next);
      changes.push(changeCount);

      if (changeCount === 0 || isStable(next, stableCondition)) {
        return {
          value: next,
          iterations: iterations + 1,
          stable: true,
          changesPerIteration: changes,
          type: 'REFINED_VALUE'
        };
      }

      current = next;
      iterations++;
    }

    return {
      value: current,
      iterations: maxIterations,
      stable: false,
      changesPerIteration: changes,
      warning: 'Max iterations reached without convergence',
      type: 'REFINED_VALUE'
    };
  },
  toPipeline: (args) => [
    { operator: Op.REC, params: {
      mode: 'REFINE',
      until: args.stableCondition,
      maxIterations: args.maxIterations,
      rules: args.rules
    }}
  ],
  examples: [
    'REFINE_UNTIL({RawData}, "STABLE", 5, MERGE_DUPLICATES("ID"), RESOLVE_BY("newest"))'
  ]
});

register('MERGE_DUPLICATES', {
  category: 'Semantic',
  description: 'Refinement rule to merge duplicates by key',
  eoDecomposition: [Op.SYN],
  eoExplanation: 'SYN(merge by key)',
  avOrigin: 'Entity resolution',
  args: [
    { name: 'keyField', type: ArgType.TEXT, required: true, description: 'Field to use as dedup key' }
  ],
  returns: ArgType.OBJECT,
  implementation: (keyField) => ({
    type: 'REFINEMENT_RULE',
    action: 'MERGE_DUPLICATES',
    keyField
  }),
  toPipeline: () => [],
  examples: [
    'MERGE_DUPLICATES("TaxID")'
  ]
});

register('RESOLVE_BY', {
  category: 'Semantic',
  description: 'Refinement rule for conflict resolution',
  eoDecomposition: [Op.ALT],
  eoExplanation: 'ALT(apply resolution)',
  avOrigin: 'Conflict resolution strategy',
  args: [
    { name: 'strategy', type: ArgType.TEXT, required: true, description: 'Strategy: newest, oldest, primary, aggregate' }
  ],
  returns: ArgType.OBJECT,
  implementation: (strategy) => ({
    type: 'REFINEMENT_RULE',
    action: 'RESOLVE_CONFLICTS',
    strategy
  }),
  toPipeline: () => [],
  examples: [
    'RESOLVE_BY("newest")',
    'RESOLVE_BY("primary")'
  ]
});

// ============================================================================
// FRAGILITY ASSESSMENT
// ============================================================================

register('FRAGILITY', {
  category: 'Semantic',
  description: 'Assess fragility/confidence of a computed value',
  eoDecomposition: [Op.SEG, Op.DES],
  eoExplanation: 'SEG(check conditions) → DES(attach fragility score)',
  avOrigin: 'Adhyāsa (superimposition) awareness',
  args: [
    { name: 'value', type: ArgType.ANY, required: true, description: 'Value to assess' },
    { name: 'conditions', type: ArgType.ARRAY, required: true, description: 'Fragility conditions' }
  ],
  returns: ArgType.OBJECT,
  implementation: (value, conditions) => {
    const triggered = (conditions || []).filter(c => c?.triggered);
    const maxFragility = triggered.reduce((max, c) =>
      Math.max(max, fragilityLevel(c?.level)), 0);

    return {
      value: value,
      fragility: fragilityLabel(maxFragility),
      fragilityReasons: triggered.map(c => c?.reason).filter(Boolean),
      type: 'FRAGILITY_ASSESSED_VALUE'
    };
  },
  toPipeline: (args) => [
    { operator: Op.SEG, params: { mode: 'CHECK_FRAGILITY', conditions: args.conditions } },
    { operator: Op.DES, params: { mode: 'ATTACH_FRAGILITY' } }
  ],
  examples: [
    'FRAGILITY({DerivedValue}, HIGH_IF({Age} > 24h), MEDIUM_IF({Source} = "estimated"))'
  ]
});

// ============================================================================
// DIAGNOSTIC ENFORCEMENT LAYER
// ============================================================================

/**
 * Check if a value is diagnostic and cannot be used in decisions
 */
function isDiagnostic(value) {
  return value && (value._diagnostic === true || value.__noDecision === true);
}

/**
 * Throw if diagnostic value is used in decision context
 */
function assertNotDiagnostic(value, context = 'decision') {
  if (isDiagnostic(value)) {
    throw new Error(
      `Cannot use DIAGNOSTIC value in ${context}. ` +
      `Reason: ${value.reason || 'Value is for observation only'}`
    );
  }
  return value;
}

/**
 * Wrap IF to enforce diagnostic restrictions
 */
function safeIF(condition, thenValue, elseValue) {
  // Check if condition contains diagnostic value
  if (isDiagnostic(condition)) {
    throw new Error(
      'Cannot use DIAGNOSTIC value as IF condition. ' +
      'Diagnostic values are for observation only and cannot drive decisions.'
    );
  }
  return condition ? thenValue : elseValue;
}

/**
 * Wrap automation trigger to enforce diagnostic restrictions
 */
function safeAutomation(triggerValue, action) {
  if (isDiagnostic(triggerValue)) {
    throw new Error(
      'Cannot use DIAGNOSTIC value in automation. ' +
      'Diagnostic values cannot trigger automated actions.'
    );
  }
  return action(triggerValue);
}

// ============================================================================
// Category Summary
// ============================================================================

const AVCategories = Object.freeze({
  'Semantic': {
    description: 'Meaning-aware operations (scope, assumptions, equivalence, convergence)',
    icon: '📿',
    color: '#8b5cf6'
  }
});

// ============================================================================
// Function Renderer for Browser UI
// ============================================================================

function renderAVFunction(fn) {
  const operatorBadges = (fn.eoDecomposition || []).map(op =>
    `<span class="eo-badge eo-badge-${op.toLowerCase()}">${op}</span>`
  ).join('');

  const avBadge = fn.avOrigin
    ? `<span class="av-origin" title="${fn.avOrigin}">📿 AV</span>`
    : '';

  return `
    <div class="function-item av-function" data-function="${fn.name}">
      <div class="function-header">
        <span class="function-name">${fn.name}</span>
        ${avBadge}
        <span class="function-operators">${operatorBadges}</span>
      </div>
      <div class="function-signature">${fn.name}(${
        (fn.args || []).map(a => a.required ? a.name : `[${a.name}]`).join(', ')
      }) → ${fn.returns}</div>
      <div class="function-description">${fn.description}</div>
      <div class="function-eo-explanation">${fn.eoExplanation}</div>
      ${fn.avOrigin ? `<div class="function-av-origin">Origin: ${fn.avOrigin}</div>` : ''}
      ${fn.examples && fn.examples.length > 0 ? `
        <div class="function-examples">
          <span class="examples-label">Examples:</span>
          ${fn.examples.map(ex => `<code class="example">${ex}</code>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================================================
// CSS Styles for Function Browser
// ============================================================================

const avFormulaStyles = `
.function-item.av-function {
  border-left: 3px solid #8b5cf6;
}

.av-origin {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #f3e8ff;
  color: #7c3aed;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.function-av-origin {
  font-size: 11px;
  color: #7c3aed;
  font-style: italic;
  margin-top: 4px;
}

.function-examples {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
}

.function-examples .examples-label {
  font-size: 11px;
  color: #64748b;
  display: block;
  margin-bottom: 4px;
}

.function-examples code.example {
  display: block;
  font-size: 12px;
  background: #f8fafc;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 4px;
  font-family: monospace;
  color: #334155;
}

.eo-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.eo-badge-con { background: #dbeafe; color: #1d4ed8; }
.eo-badge-seg { background: #fef3c7; color: #b45309; }
.eo-badge-syn { background: #d1fae5; color: #047857; }
.eo-badge-alt { background: #fce7f3; color: #be185d; }
.eo-badge-des { background: #e0e7ff; color: #4338ca; }
.eo-badge-nul { background: #f3f4f6; color: #374151; }
.eo-badge-ins { background: #ccfbf1; color: #0d9488; }
.eo-badge-rec { background: #fae8ff; color: #a21caf; }
.eo-badge-sup { background: #fed7aa; color: #c2410c; }
`;

// Inject styles
function injectAVFormulaStyles() {
  if (document.getElementById('eo-av-formula-styles')) return;

  const style = document.createElement('style');
  style.id = 'eo-av-formula-styles';
  style.textContent = avFormulaStyles;
  document.head.appendChild(style);
}

// Auto-inject on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAVFormulaStyles);
  } else {
    injectAVFormulaStyles();
  }
}

// ============================================================================
// Export
// ============================================================================

window.EOAVFormulas = {
  // Registry
  AVFunctionRegistry,
  register,
  getFunction,
  getAllFunctions,

  // Categories
  AVCategories,

  // Operators
  Op,
  ArgType,

  // Enforcement
  isDiagnostic,
  assertNotDiagnostic,
  safeIF,
  safeAutomation,

  // Rendering
  renderAVFunction,
  injectAVFormulaStyles,

  // Helpers (exposed for testing)
  deepEqual,
  projectFields,
  findDifferences,
  fragilityLevel,
  fragilityLabel
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.EOAVFormulas;
}
