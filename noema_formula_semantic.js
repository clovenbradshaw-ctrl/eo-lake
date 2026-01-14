/**
 * EO Formula Semantic Functions - AV-Inspired Epistemic Operators
 *
 * Implements Layer 3 of the Formula System Architecture:
 * Semantic functions that manage meaning, not just compute values.
 *
 * These functions are inspired by Advaita Vedanta (AV) philosophy and
 * represent the unique differentiators of the Noema formula system.
 *
 * PRINCIPLES:
 * - Values carry epistemological metadata
 * - Truth can be provisional, scoped, or diagnostic
 * - Elimination is as valid as assertion
 * - Iteration refines toward truth
 */

// ============================================================================
// Semantic Value Structures
// ============================================================================

/**
 * Check if a value is a semantic value object
 */
function isSemanticValue(value) {
  return value && typeof value === 'object' && value._semantic === true;
}

/**
 * Create a semantic value wrapper
 */
function createSemanticValue(value, metadata = {}) {
  return {
    _semantic: true,
    value,
    created: Date.now(),
    ...metadata
  };
}

/**
 * Extract raw value from potentially semantic-wrapped value
 */
function unwrap(value) {
  if (isSemanticValue(value)) {
    return value.value;
  }
  if (value && typeof value === 'object' && value._type === 'superposition') {
    // For superpositions, return as-is (handled separately)
    return value;
  }
  return value;
}

// ============================================================================
// EXCEPT - Neti-Neti (Not This, Not This)
// ============================================================================

/**
 * EXCEPT - Truth by elimination
 *
 * AV Origin: "Neti Neti" - The method of arriving at truth by systematically
 * eliminating what is NOT true.
 *
 * Returns a value that represents "everything except" the specified exclusions.
 * The result is semantically tagged as a "by-elimination" value.
 *
 * @param {any} universe - The complete set of possibilities
 * @param {...any} exclusions - Values to exclude
 * @returns {object} Semantic value with exclusions metadata
 *
 * Examples:
 *   EXCEPT(#AllStatuses, "Cancelled", "Deleted")
 *   → Represents all statuses except cancelled/deleted
 *
 *   EXCEPT({Score}, 0)
 *   → Represents non-zero scores
 */
function EXCEPT(universe, ...exclusions) {
  // Flatten exclusions if arrays passed
  const excludedValues = exclusions.flat();

  // If universe is an array, physically remove exclusions
  if (Array.isArray(universe)) {
    const excludeSet = new Set(excludedValues.map(v => JSON.stringify(v)));
    const remaining = universe.filter(item =>
      !excludeSet.has(JSON.stringify(item))
    );

    return createSemanticValue(remaining, {
      type: 'except',
      method: 'neti-neti',
      original: universe,
      excluded: excludedValues,
      excludedCount: universe.length - remaining.length,
      explanation: `Derived by eliminating ${excludedValues.length} exclusion(s) from ${universe.length} possibilities`
    });
  }

  // For scalar values, check if value matches any exclusion
  const isExcluded = excludedValues.some(exc =>
    JSON.stringify(exc) === JSON.stringify(universe)
  );

  if (isExcluded) {
    return createSemanticValue(null, {
      type: 'except',
      method: 'neti-neti',
      excluded: true,
      reason: 'Value matched exclusion list'
    });
  }

  return createSemanticValue(universe, {
    type: 'except',
    method: 'neti-neti',
    excluded: false,
    verified: true,
    explanation: 'Value passed exclusion filter'
  });
}

// ============================================================================
// UNLESS - Conditional Exception
// ============================================================================

/**
 * UNLESS - Returns a default unless an exception condition is met
 *
 * AV Origin: Conditional truth - a statement holds unless explicitly
 * overridden by a higher-priority exception.
 *
 * @param {any} defaultValue - The default value to return
 * @param {boolean} exceptionCondition - If true, use exception value
 * @param {any} exceptionValue - Value to use when exception is triggered
 * @returns {object} Semantic value with exception tracking
 *
 * Examples:
 *   UNLESS("Active", {EndDate} < TODAY(), "Expired")
 *   → Returns "Active" unless end date has passed
 *
 *   UNLESS(100, {VIP} = TRUE, 0)
 *   → Returns 100 unless VIP, then 0 (no fee for VIPs)
 */
function UNLESS(defaultValue, exceptionCondition, exceptionValue) {
  const condition = Boolean(exceptionCondition);

  if (condition) {
    return createSemanticValue(exceptionValue, {
      type: 'unless',
      exceptionTriggered: true,
      originalDefault: defaultValue,
      explanation: 'Exception condition was met'
    });
  }

  return createSemanticValue(defaultValue, {
    type: 'unless',
    exceptionTriggered: false,
    potentialException: exceptionValue,
    explanation: 'Default value used; exception condition not met'
  });
}

// ============================================================================
// VALID_WHEN - Scoped/Provisional Truth
// ============================================================================

/**
 * VALID_WHEN - Marks a value as valid only under specific conditions
 *
 * AV Origin: Vyāvahārika satya (conventional/contextual truth) - truth that
 * holds within a specific frame of reference or context.
 *
 * The value carries its validity scope, making downstream systems aware
 * that the value may not apply universally.
 *
 * @param {any} value - The value to scope
 * @param {boolean|string} scope - The validity condition or scope name
 * @param {string} description - Human-readable description of the scope
 * @returns {object} Semantic value with validity scope
 *
 * Examples:
 *   VALID_WHEN({TaxRate}, {Country} = "US", "US Tax Context")
 *   → Tax rate that's only valid for US context
 *
 *   VALID_WHEN({Estimate}, "Draft", "Before finalization")
 *   → Estimate value only valid in draft mode
 */
function VALID_WHEN(value, scope, description = '') {
  // Determine if scope is currently valid
  const isValid = typeof scope === 'boolean' ? scope : Boolean(scope);
  const scopeName = typeof scope === 'string' ? scope : (description || 'scoped');

  return createSemanticValue(value, {
    type: 'valid_when',
    scope: scopeName,
    scopeDescription: description,
    currentlyValid: isValid,
    provisional: true,
    explanation: isValid
      ? `Value valid within scope: ${scopeName}`
      : `Value NOT currently valid (scope: ${scopeName})`
  });
}

// ============================================================================
// ASSUMING - Provisional Values with Explicit Assumptions
// ============================================================================

/**
 * ASSUMING - Returns a value that explicitly carries its assumptions
 *
 * AV Origin: Adhyāropa (superimposition) - provisional assertion that's
 * understood to be later corrected or refined.
 *
 * The value is usable but carries metadata about what assumptions
 * were made to derive it.
 *
 * @param {any} value - The computed/assumed value
 * @param {string|string[]} assumptions - What was assumed to derive this
 * @param {number} confidence - Optional confidence level (0-1)
 * @returns {object} Semantic value with assumption tracking
 *
 * Examples:
 *   ASSUMING(1000000, "Linear growth", 0.7)
 *   → Revenue projection assuming linear growth, 70% confident
 *
 *   ASSUMING({Estimate} * 1.2, ["20% buffer", "No scope change"], 0.8)
 *   → Adjusted estimate with documented assumptions
 */
function ASSUMING(value, assumptions, confidence = 1) {
  const assumptionList = Array.isArray(assumptions) ? assumptions : [assumptions];
  const conf = Math.max(0, Math.min(1, Number(confidence) || 1));

  return createSemanticValue(value, {
    type: 'assuming',
    assumptions: assumptionList,
    confidence: conf,
    provisional: true,
    requiresValidation: conf < 0.9,
    explanation: `Value derived assuming: ${assumptionList.join('; ')} (${Math.round(conf * 100)}% confidence)`
  });
}

// ============================================================================
// DIAGNOSTIC - Non-Assertive Values
// ============================================================================

/**
 * DIAGNOSTIC - Creates a value that cannot drive decisions
 *
 * AV Origin: Non-assertive cognition - information that's observed
 * but not yet validated for action.
 *
 * Diagnostic values can be displayed, logged, and analyzed but should
 * not be used as inputs to business logic or trigger automations.
 *
 * @param {any} value - The diagnostic value
 * @param {string} purpose - Why this diagnostic exists
 * @param {string} source - Where this value came from
 * @returns {object} Semantic value marked as diagnostic
 *
 * Examples:
 *   DIAGNOSTIC({DebugInfo}, "Troubleshooting", "System Log")
 *   → Debug info visible but not actionable
 *
 *   DIAGNOSTIC(AVERAGE(#SalesData.Amount), "Trend Analysis", "BI Query")
 *   → Calculated metric for observation only
 */
function DIAGNOSTIC(value, purpose = '', source = '') {
  return createSemanticValue(value, {
    type: 'diagnostic',
    assertive: false,
    actionable: false,
    purpose: purpose || 'observation',
    source: source || 'unknown',
    warning: 'This value should not drive automated decisions',
    explanation: `Diagnostic value for ${purpose || 'observation'}`
  });
}

// ============================================================================
// EQUIVALENT_WHEN - Purpose-Bound Identity
// ============================================================================

/**
 * EQUIVALENT_WHEN - Declares values equivalent for a specific purpose
 *
 * AV Origin: Purpose-bound identity - things are "the same" only
 * relative to a particular frame or purpose.
 *
 * This allows different representations to be treated as equivalent
 * for specific operations while maintaining their distinct identities.
 *
 * @param {any} value - The primary value
 * @param {any[]} equivalents - Values considered equivalent
 * @param {string} purpose - The purpose for which they're equivalent
 * @returns {object} Semantic value with equivalence metadata
 *
 * Examples:
 *   EQUIVALENT_WHEN({Country}, ["USA", "US", "United States"], "Matching")
 *   → All three strings match for country lookups
 *
 *   EQUIVALENT_WHEN({SKU}, [{OldSKU}, {LegacySKU}], "Inventory Lookup")
 *   → Multiple SKU formats treated as same product
 */
function EQUIVALENT_WHEN(value, equivalents, purpose = 'comparison') {
  const equivList = Array.isArray(equivalents) ? equivalents : [equivalents];

  // Create a matching function
  const matches = (testValue) => {
    if (testValue === value) return true;
    const testStr = JSON.stringify(testValue);
    return equivList.some(eq => JSON.stringify(eq) === testStr);
  };

  return createSemanticValue(value, {
    type: 'equivalent_when',
    equivalents: equivList,
    purpose,
    equivalentCount: equivList.length + 1, // Including primary
    matches, // Function for runtime matching
    explanation: `${equivList.length + 1} values treated as equivalent for ${purpose}`
  });
}

/**
 * IS_EQUIVALENT - Check if two values are equivalent given purpose context
 * Helper function for EQUIVALENT_WHEN
 */
function IS_EQUIVALENT(value1, value2, purpose = 'comparison') {
  // Check if either is a semantic equivalent value
  if (isSemanticValue(value1) && value1.type === 'equivalent_when') {
    if (value1.purpose === purpose && value1.matches) {
      return value1.matches(value2);
    }
  }
  if (isSemanticValue(value2) && value2.type === 'equivalent_when') {
    if (value2.purpose === purpose && value2.matches) {
      return value2.matches(value1);
    }
  }

  // Default: strict equality
  return JSON.stringify(unwrap(value1)) === JSON.stringify(unwrap(value2));
}

// ============================================================================
// REFINE_UNTIL - Convergent Iteration
// ============================================================================

/**
 * REFINE_UNTIL - Iteratively refines a value until condition is met
 *
 * AV Origin: Truth via repeated correction - understanding deepens
 * through successive approximations.
 *
 * Applies a refinement function repeatedly until the convergence
 * condition is satisfied or max iterations reached.
 *
 * @param {any} initialValue - Starting value
 * @param {function} refineFunction - Function to apply each iteration
 * @param {function} convergenceTest - Returns true when converged
 * @param {number} maxIterations - Safety limit
 * @returns {object} Semantic value with iteration history
 *
 * Examples:
 *   REFINE_UNTIL(1, x => (x + {Target}/x) / 2, x => ABS(x*x - {Target}) < 0.001, 100)
 *   → Newton-Raphson square root approximation
 *
 *   REFINE_UNTIL({Estimate}, x => x * 0.95, x => x < {Budget}, 20)
 *   → Reduce estimate until it fits budget
 */
function REFINE_UNTIL(initialValue, refineFunction, convergenceTest, maxIterations = 100) {
  let current = initialValue;
  const history = [current];
  let iterations = 0;
  let converged = false;
  let error = null;

  try {
    // Check if already converged
    if (typeof convergenceTest === 'function' && convergenceTest(current)) {
      converged = true;
    } else {
      while (iterations < maxIterations && !converged) {
        iterations++;

        // Apply refinement
        if (typeof refineFunction === 'function') {
          current = refineFunction(current);
        }
        history.push(current);

        // Check convergence
        if (typeof convergenceTest === 'function' && convergenceTest(current)) {
          converged = true;
        }
      }
    }
  } catch (e) {
    error = e.message;
  }

  return createSemanticValue(current, {
    type: 'refine_until',
    iterations,
    converged,
    maxIterations,
    history: history.slice(-10), // Keep last 10 for inspection
    initialValue,
    error,
    explanation: converged
      ? `Converged after ${iterations} iteration(s)`
      : `Reached max iterations (${maxIterations}) without convergence`
  });
}

// ============================================================================
// FRAGILITY - Measure Conclusion Robustness
// ============================================================================

/**
 * FRAGILITY - Measures how fragile a conclusion is to input changes
 *
 * AV Origin: Stability of knowledge - understanding which conclusions
 * are robust vs. which are sensitive to small changes.
 *
 * Returns a fragility score (0-1) where:
 * - 0 = completely robust (same conclusion regardless of variations)
 * - 1 = completely fragile (any change flips the conclusion)
 *
 * @param {any} baseValue - The primary computed value
 * @param {any[]} variations - Alternative values under different inputs
 * @param {string} metric - How to measure fragility: 'agreement', 'spread', 'variance'
 * @returns {object} Semantic value with fragility analysis
 *
 * Examples:
 *   FRAGILITY({Recommendation}, [#Scenario1.Result, #Scenario2.Result, #Scenario3.Result])
 *   → How often scenarios agree with base recommendation
 *
 *   FRAGILITY({Profit}, [#Optimistic.Profit, #Pessimistic.Profit], "spread")
 *   → Relative range of profit across scenarios
 */
function FRAGILITY(baseValue, variations, metric = 'agreement') {
  const variationList = Array.isArray(variations) ? variations : [variations];
  const allValues = [baseValue, ...variationList];

  let fragility = 0;
  let analysis = {};

  switch (metric.toLowerCase()) {
    case 'agreement': {
      // Fragility = 1 - (proportion agreeing with base)
      const baseStr = JSON.stringify(unwrap(baseValue));
      const agreeing = variationList.filter(v =>
        JSON.stringify(unwrap(v)) === baseStr
      ).length;
      fragility = variationList.length > 0
        ? 1 - (agreeing / variationList.length)
        : 0;
      analysis = {
        agreeing,
        total: variationList.length,
        agreementRate: 1 - fragility
      };
      break;
    }

    case 'spread': {
      // Fragility based on relative spread of numeric values
      const nums = allValues.map(v => Number(unwrap(v))).filter(n => !isNaN(n));
      if (nums.length >= 2) {
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        // Normalized spread
        fragility = mean !== 0 ? Math.min(1, (max - min) / Math.abs(mean)) : 0;
        analysis = { min, max, mean, spread: max - min };
      }
      break;
    }

    case 'variance': {
      // Fragility based on coefficient of variation
      const nums = allValues.map(v => Number(unwrap(v))).filter(n => !isNaN(n));
      if (nums.length >= 2) {
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const variance = nums.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / nums.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean !== 0 ? stdDev / Math.abs(mean) : 0;
        fragility = Math.min(1, cv); // Cap at 1
        analysis = { mean, variance, stdDev, coefficientOfVariation: cv };
      }
      break;
    }

    default:
      // Default to agreement
      const baseStr = JSON.stringify(unwrap(baseValue));
      const agreeing = variationList.filter(v =>
        JSON.stringify(unwrap(v)) === baseStr
      ).length;
      fragility = variationList.length > 0
        ? 1 - (agreeing / variationList.length)
        : 0;
  }

  // Interpret fragility level
  let interpretation;
  if (fragility < 0.2) interpretation = 'robust';
  else if (fragility < 0.4) interpretation = 'stable';
  else if (fragility < 0.6) interpretation = 'moderate';
  else if (fragility < 0.8) interpretation = 'sensitive';
  else interpretation = 'highly fragile';

  return createSemanticValue(fragility, {
    type: 'fragility',
    baseValue: unwrap(baseValue),
    variationCount: variationList.length,
    metric,
    analysis,
    interpretation,
    reliable: fragility < 0.4,
    explanation: `${interpretation} (fragility: ${(fragility * 100).toFixed(1)}%)`
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * UNWRAP_SEMANTIC - Extract raw value from semantic wrapper
 */
function UNWRAP_SEMANTIC(value) {
  return unwrap(value);
}

/**
 * IS_SEMANTIC - Check if value is semantically wrapped
 */
function IS_SEMANTIC(value) {
  return isSemanticValue(value);
}

/**
 * GET_SEMANTIC_TYPE - Get the semantic type of a value
 */
function GET_SEMANTIC_TYPE(value) {
  if (!isSemanticValue(value)) return null;
  return value.type || 'unknown';
}

/**
 * GET_SEMANTIC_METADATA - Get all metadata from semantic value
 */
function GET_SEMANTIC_METADATA(value) {
  if (!isSemanticValue(value)) return {};
  const { _semantic, value: _, created, ...metadata } = value;
  return metadata;
}

/**
 * IS_PROVISIONAL - Check if value is marked as provisional
 */
function IS_PROVISIONAL(value) {
  if (!isSemanticValue(value)) return false;
  return value.provisional === true;
}

/**
 * IS_DIAGNOSTIC_VALUE - Check if value is marked as diagnostic (non-actionable)
 */
function IS_DIAGNOSTIC_VALUE(value) {
  if (!isSemanticValue(value)) return false;
  return value.type === 'diagnostic' || value.assertive === false;
}

/**
 * GET_CONFIDENCE - Get confidence level from semantic value
 */
function GET_CONFIDENCE(value) {
  if (!isSemanticValue(value)) return 1; // Non-semantic = full confidence
  if (value.confidence !== undefined) return value.confidence;
  if (value.provisional) return 0.7;
  return 1;
}

/**
 * EXPLAIN_VALUE - Get human-readable explanation of semantic value
 */
function EXPLAIN_VALUE(value) {
  if (!isSemanticValue(value)) {
    return `Literal value: ${JSON.stringify(value)}`;
  }

  const parts = [`Type: ${value.type || 'semantic'}`];

  if (value.explanation) {
    parts.push(`Explanation: ${value.explanation}`);
  }

  if (value.assumptions) {
    parts.push(`Assumptions: ${value.assumptions.join('; ')}`);
  }

  if (value.confidence !== undefined) {
    parts.push(`Confidence: ${Math.round(value.confidence * 100)}%`);
  }

  if (value.provisional) {
    parts.push('Status: Provisional');
  }

  if (value.warning) {
    parts.push(`Warning: ${value.warning}`);
  }

  return parts.join(' | ');
}

// ============================================================================
// EO Operator Decomposition Metadata
// ============================================================================

const Op = window.EOFormulaFunctions?.Op || {
  CON: 'CON',
  SEG: 'SEG',
  DES: 'DES',
  SYN: 'SYN',
  ALT: 'ALT',
  NUL: 'NUL',
  INS: 'INS',
  SUP: 'SUP',
  REC: 'REC',
};

// ============================================================================
// Function Registry
// ============================================================================

const SemanticFunctions = {
  // Core Semantic Functions
  EXCEPT,
  UNLESS,
  VALID_WHEN,
  ASSUMING,
  DIAGNOSTIC,
  EQUIVALENT_WHEN,
  REFINE_UNTIL,
  FRAGILITY,

  // Helpers
  IS_EQUIVALENT,
  UNWRAP_SEMANTIC,
  IS_SEMANTIC,
  GET_SEMANTIC_TYPE,
  GET_SEMANTIC_METADATA,
  IS_PROVISIONAL,
  IS_DIAGNOSTIC_VALUE,
  GET_CONFIDENCE,
  EXPLAIN_VALUE,
};

/**
 * Function definitions with EO decomposition for formula registry
 */
const SemanticFunctionDefinitions = [
  {
    name: 'EXCEPT',
    category: 'Semantic',
    avOrigin: 'Neti-Neti (not this, not this)',
    description: 'Truth by elimination - returns what remains after exclusions',
    eoDecomposition: [Op.NUL, Op.SEG, Op.ALT],
    eoExplanation: 'NUL(detect exclusions) → SEG(filter out) → ALT(mark as by-elimination)',
    args: [
      { name: 'universe', type: 'array', required: true, description: 'Complete set of possibilities' },
      { name: 'exclusions', type: 'any', required: true, rest: true, description: 'Values to exclude' },
    ],
    returns: 'semantic',
    examples: [
      'EXCEPT(#AllStatuses, "Cancelled", "Deleted")',
      'EXCEPT({Options}, {InvalidOption})',
    ],
    implementation: EXCEPT,
  },
  {
    name: 'UNLESS',
    category: 'Semantic',
    avOrigin: 'Conditional exception',
    description: 'Returns default unless exception condition is met',
    eoDecomposition: [Op.SEG, Op.ALT],
    eoExplanation: 'SEG(check exception) → ALT(select appropriate value)',
    args: [
      { name: 'defaultValue', type: 'any', required: true },
      { name: 'exceptionCondition', type: 'boolean', required: true },
      { name: 'exceptionValue', type: 'any', required: true },
    ],
    returns: 'semantic',
    examples: [
      'UNLESS("Active", {EndDate} < TODAY(), "Expired")',
      'UNLESS(100, {VIP} = TRUE, 0)',
    ],
    implementation: UNLESS,
  },
  {
    name: 'VALID_WHEN',
    category: 'Semantic',
    avOrigin: 'Vyāvahārika satya (contextual truth)',
    description: 'Marks value as valid only under specific conditions',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(attach scope metadata)',
    args: [
      { name: 'value', type: 'any', required: true },
      { name: 'scope', type: 'any', required: true, description: 'Validity condition or scope name' },
      { name: 'description', type: 'text', required: false },
    ],
    returns: 'semantic',
    examples: [
      'VALID_WHEN({TaxRate}, {Country} = "US", "US Tax Context")',
      'VALID_WHEN({Estimate}, "Draft", "Before finalization")',
    ],
    implementation: VALID_WHEN,
  },
  {
    name: 'ASSUMING',
    category: 'Semantic',
    avOrigin: 'Adhyāropa (superimposition)',
    description: 'Returns value with explicit assumptions attached',
    eoDecomposition: [Op.ALT, Op.DES],
    eoExplanation: 'ALT(compute value) → DES(attach assumptions)',
    args: [
      { name: 'value', type: 'any', required: true },
      { name: 'assumptions', type: 'text', required: true, description: 'Assumption(s) made' },
      { name: 'confidence', type: 'number', required: false, default: 1, description: '0-1 confidence level' },
    ],
    returns: 'semantic',
    examples: [
      'ASSUMING(1000000, "Linear growth", 0.7)',
      'ASSUMING({Estimate} * 1.2, "20% buffer", 0.8)',
    ],
    implementation: ASSUMING,
  },
  {
    name: 'DIAGNOSTIC',
    category: 'Semantic',
    avOrigin: 'Non-assertive cognition',
    description: 'Creates a value that cannot drive automated decisions',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(mark as non-assertive)',
    args: [
      { name: 'value', type: 'any', required: true },
      { name: 'purpose', type: 'text', required: false },
      { name: 'source', type: 'text', required: false },
    ],
    returns: 'semantic',
    examples: [
      'DIAGNOSTIC({DebugInfo}, "Troubleshooting", "System Log")',
      'DIAGNOSTIC(AVERAGE(#Sales.Amount), "Trend Analysis")',
    ],
    implementation: DIAGNOSTIC,
  },
  {
    name: 'EQUIVALENT_WHEN',
    category: 'Semantic',
    avOrigin: 'Purpose-bound identity',
    description: 'Declares values equivalent for a specific purpose',
    eoDecomposition: [Op.SYN, Op.DES],
    eoExplanation: 'SYN(group equivalents) → DES(attach purpose)',
    args: [
      { name: 'value', type: 'any', required: true },
      { name: 'equivalents', type: 'array', required: true },
      { name: 'purpose', type: 'text', required: false, default: 'comparison' },
    ],
    returns: 'semantic',
    examples: [
      'EQUIVALENT_WHEN({Country}, ["USA", "US", "United States"], "Matching")',
      'EQUIVALENT_WHEN({SKU}, [{OldSKU}, {LegacySKU}], "Inventory Lookup")',
    ],
    implementation: EQUIVALENT_WHEN,
  },
  {
    name: 'REFINE_UNTIL',
    category: 'Semantic',
    avOrigin: 'Truth via repeated correction',
    description: 'Iteratively refines value until convergence condition is met',
    eoDecomposition: [Op.REC],
    eoExplanation: 'REC(iterate until convergence)',
    args: [
      { name: 'initialValue', type: 'any', required: true },
      { name: 'refineFunction', type: 'lambda', required: true },
      { name: 'convergenceTest', type: 'lambda', required: true },
      { name: 'maxIterations', type: 'number', required: false, default: 100 },
    ],
    returns: 'semantic',
    examples: [
      'REFINE_UNTIL(1, x => (x + {Target}/x) / 2, x => ABS(x*x - {Target}) < 0.001)',
      'REFINE_UNTIL({Estimate}, x => x * 0.95, x => x < {Budget}, 20)',
    ],
    implementation: REFINE_UNTIL,
  },
  {
    name: 'FRAGILITY',
    category: 'Semantic',
    avOrigin: 'Stability of knowledge',
    description: 'Measures how fragile a conclusion is to input variations',
    eoDecomposition: [Op.SYN, Op.DES],
    eoExplanation: 'SYN(compare variations) → DES(calculate fragility score)',
    args: [
      { name: 'baseValue', type: 'any', required: true },
      { name: 'variations', type: 'array', required: true, description: 'Alternative values under different inputs' },
      { name: 'metric', type: 'text', required: false, default: 'agreement', options: ['agreement', 'spread', 'variance'] },
    ],
    returns: 'number',
    examples: [
      'FRAGILITY({Recommendation}, [#Scenario1.Result, #Scenario2.Result])',
      'FRAGILITY({Profit}, [#Optimistic.Profit, #Pessimistic.Profit], "spread")',
    ],
    implementation: FRAGILITY,
  },
  {
    name: 'IS_EQUIVALENT',
    category: 'Semantic',
    description: 'Check if two values are equivalent given purpose context',
    eoDecomposition: [Op.SEG],
    args: [
      { name: 'value1', type: 'any', required: true },
      { name: 'value2', type: 'any', required: true },
      { name: 'purpose', type: 'text', required: false },
    ],
    returns: 'boolean',
    implementation: IS_EQUIVALENT,
  },
  {
    name: 'UNWRAP_SEMANTIC',
    category: 'Semantic',
    description: 'Extract raw value from semantic wrapper',
    eoDecomposition: [Op.DES],
    args: [{ name: 'value', type: 'any', required: true }],
    returns: 'any',
    implementation: UNWRAP_SEMANTIC,
  },
  {
    name: 'IS_SEMANTIC',
    category: 'Semantic',
    description: 'Check if value has semantic metadata',
    eoDecomposition: [Op.DES],
    args: [{ name: 'value', type: 'any', required: true }],
    returns: 'boolean',
    implementation: IS_SEMANTIC,
  },
  {
    name: 'GET_SEMANTIC_TYPE',
    category: 'Semantic',
    description: 'Get semantic type (except, unless, valid_when, etc.)',
    eoDecomposition: [Op.DES],
    args: [{ name: 'value', type: 'any', required: true }],
    returns: 'text',
    implementation: GET_SEMANTIC_TYPE,
  },
  {
    name: 'IS_PROVISIONAL',
    category: 'Semantic',
    description: 'Check if value is marked as provisional',
    eoDecomposition: [Op.DES],
    args: [{ name: 'value', type: 'any', required: true }],
    returns: 'boolean',
    implementation: IS_PROVISIONAL,
  },
  {
    name: 'IS_DIAGNOSTIC_VALUE',
    category: 'Semantic',
    description: 'Check if value is marked as diagnostic (non-actionable)',
    eoDecomposition: [Op.DES],
    args: [{ name: 'value', type: 'any', required: true }],
    returns: 'boolean',
    implementation: IS_DIAGNOSTIC_VALUE,
  },
  {
    name: 'GET_CONFIDENCE',
    category: 'Semantic',
    description: 'Get confidence level of semantic value (0-1)',
    eoDecomposition: [Op.DES],
    args: [{ name: 'value', type: 'any', required: true }],
    returns: 'number',
    implementation: GET_CONFIDENCE,
  },
  {
    name: 'EXPLAIN_VALUE',
    category: 'Semantic',
    description: 'Get human-readable explanation of semantic value',
    eoDecomposition: [Op.DES],
    args: [{ name: 'value', type: 'any', required: true }],
    returns: 'text',
    implementation: EXPLAIN_VALUE,
  },
];

// ============================================================================
// Exports
// ============================================================================

window.EOSemanticFormulas = {
  // Utility functions
  isSemanticValue,
  createSemanticValue,
  unwrap,

  // All semantic functions
  ...SemanticFunctions,

  // Function registry
  functions: SemanticFunctions,
  definitions: SemanticFunctionDefinitions,

  // For formula editor display
  categoryInfo: {
    name: 'Semantic',
    icon: 'ph-brain',
    description: 'AV-inspired functions that manage meaning, not just compute values'
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.EOSemanticFormulas;
}
