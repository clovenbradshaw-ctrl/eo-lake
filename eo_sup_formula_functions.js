/**
 * EO SUP Formula Functions - Superposition-Aware Formula Functions
 *
 * Provides formula functions for creating, inspecting, collapsing, and
 * combining superposition values within the formula system.
 *
 * PRINCIPLE: Disagreement is preserved, not hidden. User controls when collapse happens.
 */

// ============================================================================
// Superposition Object Structure
// ============================================================================

/**
 * Check if a value is a superposition object
 */
function isSuperpositionObject(value) {
  return value && typeof value === 'object' && value._type === 'superposition';
}

/**
 * Create a basic superposition object
 */
function createSuperpositionObject(states, options = {}) {
  if (!states || states.length === 0) return null;
  if (states.length === 1 && !options.forceSuper) return states[0].value;

  return {
    _type: 'superposition',
    states: states,
    created: Date.now(),
    weighted: options.weighted || false,
    sourced: options.sourced || false,
    ...options.metadata
  };
}

// ============================================================================
// Part I: Creation Functions
// ============================================================================

/**
 * SUPERPOSE - The fundamental function. Holds multiple values without forcing resolution.
 * @param {...any} values - Values to hold in superposition
 * @returns {object} Superposition object containing all values
 */
function SUPERPOSE(...values) {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];

  const states = values.map((v, i) => ({
    value: v,
    index: i
  }));

  return createSuperpositionObject(states);
}

/**
 * SUPERPOSE_IF - Creates superposition only when values differ
 * @param {...any} values - Values to potentially superpose
 * @returns {any|object} Single value if all equal, superposition if they differ
 */
function SUPERPOSE_IF(...values) {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];

  // Check if all values are the same
  const unique = new Map();
  values.forEach((v, i) => {
    const key = JSON.stringify(v);
    if (!unique.has(key)) {
      unique.set(key, { value: v, index: i });
    }
  });

  if (unique.size === 1) {
    return values[0]; // All same, return single value
  }

  // Values differ, create superposition with unique values
  const states = Array.from(unique.values());
  return createSuperpositionObject(states);
}

/**
 * WEIGHTED - Creates superposition with explicit weights/probabilities
 * @param {...any} args - Alternating value, weight pairs
 * @returns {object} Superposition with probability metadata
 */
function WEIGHTED(...args) {
  if (args.length < 2) return args[0] || null;

  const states = [];
  for (let i = 0; i < args.length; i += 2) {
    const value = args[i];
    const weight = args[i + 1] !== undefined ? Number(args[i + 1]) : 1;
    states.push({ value, weight });
  }

  // Normalize weights to probabilities
  const totalWeight = states.reduce((sum, s) => sum + s.weight, 0);
  states.forEach(s => {
    s.probability = totalWeight > 0 ? s.weight / totalWeight : 1 / states.length;
  });

  return createSuperpositionObject(states, { weighted: true });
}

/**
 * SOURCED - Creates superposition where each value is tagged with its origin
 * @param {...any} args - Alternating value, source pairs
 * @returns {object} Superposition with source attribution
 */
function SOURCED(...args) {
  if (args.length < 2) return args[0] || null;

  const states = [];
  for (let i = 0; i < args.length; i += 2) {
    const value = args[i];
    const source = args[i + 1] !== undefined ? String(args[i + 1]) : 'unknown';
    states.push({ value, source, timestamp: Date.now() });
  }

  return createSuperpositionObject(states, { sourced: true });
}

/**
 * UNCERTAIN - Creates superposition representing measurement uncertainty
 * @param {number} centralValue - The central/expected value
 * @param {number} uncertainty - The uncertainty magnitude
 * @param {string} type - Type: "absolute", "percent", or "stddev"
 * @returns {object} Superposition representing uncertainty band
 */
function UNCERTAIN(centralValue, uncertainty, type = 'absolute') {
  const central = Number(centralValue);
  const unc = Number(uncertainty);

  if (isNaN(central)) return null;
  if (isNaN(unc) || unc === 0) return central;

  let delta;
  switch (type) {
    case 'percent':
      delta = central * (unc / 100);
      break;
    case 'stddev':
      delta = unc;
      break;
    case 'absolute':
    default:
      delta = unc;
  }

  const states = [
    { value: central - delta, label: 'low', probability: 0.25 },
    { value: central, label: 'central', probability: 0.5 },
    { value: central + delta, label: 'high', probability: 0.25 }
  ];

  return createSuperpositionObject(states, {
    weighted: true,
    metadata: {
      uncertainty: { type, magnitude: unc, delta },
      distribution: type === 'stddev' ? 'normal' : 'uniform'
    }
  });
}

/**
 * RANGE_SUP - Creates superposition from a continuous range (discretized)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} steps - Number of steps (default 3)
 * @returns {object} Superposition of values spanning the range
 */
function RANGE_SUP(min, max, steps = 3) {
  const minVal = Number(min);
  const maxVal = Number(max);
  const numSteps = Math.max(2, Math.floor(Number(steps)));

  if (isNaN(minVal) || isNaN(maxVal)) return null;
  if (minVal === maxVal) return minVal;

  const states = [];
  for (let i = 0; i < numSteps; i++) {
    const value = minVal + (maxVal - minVal) * (i / (numSteps - 1));
    states.push({
      value: value,
      index: i,
      probability: 1 / numSteps
    });
  }

  return createSuperpositionObject(states, {
    weighted: true,
    metadata: { range: { min: minVal, max: maxVal, steps: numSteps } }
  });
}

/**
 * SNAPSHOT - Captures current superposition state at a point in time
 * @param {any} superposition - The superposition to snapshot
 * @param {string} label - Optional label for the snapshot
 * @returns {object} Timestamped copy of superposition state
 */
function SNAPSHOT(superposition, label = null) {
  if (!isSuperpositionObject(superposition)) {
    return {
      _type: 'snapshot',
      value: superposition,
      timestamp: Date.now(),
      label: label
    };
  }

  return {
    _type: 'snapshot',
    superposition: JSON.parse(JSON.stringify(superposition)),
    timestamp: Date.now(),
    label: label
  };
}

// ============================================================================
// Part II: Inspection Functions (Non-Collapsing)
// ============================================================================

/**
 * IS_SUPERPOSED - Tests whether a value is in superposition
 * @param {any} value - Value to test
 * @returns {boolean} TRUE if superposed, FALSE if single value
 */
function IS_SUPERPOSED(value) {
  return isSuperpositionObject(value) && value.states && value.states.length > 1;
}

/**
 * COUNT_STATES - Returns how many states are in the superposition
 * @param {any} superposition - The superposition to count
 * @returns {number} Number of states (1 if not superposed)
 */
function COUNT_STATES(superposition) {
  if (!isSuperpositionObject(superposition)) return 1;
  return superposition.states ? superposition.states.length : 1;
}

/**
 * GET_STATES - Extracts all values as an array without collapsing
 * @param {any} superposition - The superposition to extract from
 * @returns {array} Array of all values
 */
function GET_STATES(superposition) {
  if (!isSuperpositionObject(superposition)) return [superposition];
  if (!superposition.states) return [superposition];
  return superposition.states.map(s => s.value);
}

/**
 * GET_STATE - Gets a specific state by index (1-indexed)
 * @param {any} superposition - The superposition
 * @param {number} index - 1-based index
 * @returns {any} Value at that index
 */
function GET_STATE(superposition, index) {
  if (!isSuperpositionObject(superposition)) {
    return index === 1 ? superposition : null;
  }
  const idx = Math.floor(Number(index)) - 1;
  if (idx < 0 || idx >= superposition.states.length) return null;
  return superposition.states[idx]?.value;
}

/**
 * GET_WEIGHTS - Extracts weights/probabilities as array
 * @param {any} superposition - The superposition
 * @returns {array} Array of weights (equal weights if unweighted)
 */
function GET_WEIGHTS(superposition) {
  if (!isSuperpositionObject(superposition)) return [1];
  if (!superposition.states) return [1];

  const n = superposition.states.length;
  return superposition.states.map(s =>
    s.probability !== undefined ? s.probability :
    s.weight !== undefined ? s.weight :
    (1 / n)
  );
}

/**
 * GET_SOURCES - Extracts source attributions as array
 * @param {any} superposition - The superposition
 * @returns {array} Array of source labels
 */
function GET_SOURCES(superposition) {
  if (!isSuperpositionObject(superposition)) return ['direct'];
  if (!superposition.states) return ['direct'];
  return superposition.states.map(s => s.source || 'unknown');
}

/**
 * SPREAD - Returns the spread/range of a numeric superposition
 * @param {any} superposition - The superposition
 * @returns {number} Difference between max and min states
 */
function SPREAD(superposition) {
  const values = GET_STATES(superposition)
    .map(v => Number(v))
    .filter(n => !isNaN(n));

  if (values.length === 0) return 0;
  if (values.length === 1) return 0;

  return Math.max(...values) - Math.min(...values);
}

/**
 * EXPECTED - Returns probability-weighted expected value (numeric only)
 * @param {any} superposition - The superposition
 * @returns {number} Weighted average without collapsing
 */
function EXPECTED(superposition) {
  if (!isSuperpositionObject(superposition)) {
    return Number(superposition) || 0;
  }

  const weights = GET_WEIGHTS(superposition);
  const states = superposition.states || [];

  let sum = 0;
  let weightSum = 0;

  states.forEach((s, i) => {
    const val = Number(s.value);
    if (!isNaN(val)) {
      sum += val * weights[i];
      weightSum += weights[i];
    }
  });

  return weightSum > 0 ? sum / weightSum * states.length / states.length : 0;
}

/**
 * PROBABILITY_OF - Returns probability of a specific value
 * @param {any} superposition - The superposition
 * @param {any} value - The value to find probability of
 * @returns {number} Probability (0-1)
 */
function PROBABILITY_OF(superposition, value) {
  if (!isSuperpositionObject(superposition)) {
    return JSON.stringify(superposition) === JSON.stringify(value) ? 1 : 0;
  }

  const weights = GET_WEIGHTS(superposition);
  const states = superposition.states || [];
  const valueStr = JSON.stringify(value);

  let totalProb = 0;
  states.forEach((s, i) => {
    if (JSON.stringify(s.value) === valueStr) {
      totalProb += weights[i];
    }
  });

  return totalProb;
}

/**
 * VARIANCE - Returns statistical variance of numeric superposition
 * @param {any} superposition - The superposition
 * @returns {number} Variance value
 */
function VARIANCE(superposition) {
  if (!isSuperpositionObject(superposition)) return 0;

  const exp = EXPECTED(superposition);
  const weights = GET_WEIGHTS(superposition);
  const states = superposition.states || [];

  let variance = 0;
  states.forEach((s, i) => {
    const val = Number(s.value);
    if (!isNaN(val)) {
      variance += Math.pow(val - exp, 2) * weights[i];
    }
  });

  return variance;
}

/**
 * ENTROPY - Returns information entropy of superposition (uncertainty measure)
 * @param {any} superposition - The superposition
 * @returns {number} Entropy in bits (0 = certain, higher = more uncertain)
 */
function ENTROPY(superposition) {
  if (!isSuperpositionObject(superposition)) return 0;

  const weights = GET_WEIGHTS(superposition);

  // Normalize weights if needed
  const sum = weights.reduce((a, b) => a + b, 0);
  const probs = sum > 0 ? weights.map(w => w / sum) : weights;

  let entropy = 0;
  probs.forEach(p => {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  });

  return entropy;
}

/**
 * CONFLICT_LEVEL - Returns a measure of how much states disagree (0-1)
 * @param {any} superposition - The superposition
 * @returns {number} 0 (no conflict) to 1 (maximum conflict)
 */
function CONFLICT_LEVEL(superposition) {
  if (!isSuperpositionObject(superposition)) return 0;

  const states = superposition.states || [];
  if (states.length <= 1) return 0;

  const values = states.map(s => JSON.stringify(s.value));
  const unique = new Set(values);

  if (unique.size === 1) return 0;

  // Normalized: 1 when all different, approaching 0 when mostly same
  return (unique.size - 1) / (values.length - 1);
}

/**
 * CONSENSUS - Checks if superposition shows consensus (low spread)
 * @param {any} superposition - The superposition
 * @param {number} threshold - Maximum spread for consensus
 * @returns {boolean} TRUE if spread below threshold
 */
function CONSENSUS(superposition, threshold) {
  return SPREAD(superposition) <= Number(threshold);
}

// ============================================================================
// Part III: Collapse Functions
// ============================================================================

/**
 * COLLAPSE - Forces superposition to resolve to single value
 * @param {any} superposition - The superposition to collapse
 * @param {string} method - Collapse method: first, last, max, min, random, weighted, expected, majority, median
 * @returns {any} Single resolved value
 */
function COLLAPSE(superposition, method = 'first') {
  if (!isSuperpositionObject(superposition)) return superposition;

  const states = superposition.states || [];
  if (states.length === 0) return null;
  if (states.length === 1) return states[0].value;

  const values = states.map(s => s.value);
  const weights = GET_WEIGHTS(superposition);

  switch (method.toLowerCase()) {
    case 'first':
      return values[0];

    case 'last':
      return values[values.length - 1];

    case 'max': {
      const nums = values.map(Number).filter(n => !isNaN(n));
      if (nums.length === 0) return values[0];
      return Math.max(...nums);
    }

    case 'min': {
      const nums = values.map(Number).filter(n => !isNaN(n));
      if (nums.length === 0) return values[0];
      return Math.min(...nums);
    }

    case 'random':
      return values[Math.floor(Math.random() * values.length)];

    case 'weighted': {
      const r = Math.random();
      let cumulative = 0;
      for (let i = 0; i < values.length; i++) {
        cumulative += weights[i];
        if (r <= cumulative) return values[i];
      }
      return values[values.length - 1];
    }

    case 'expected':
      return EXPECTED(superposition);

    case 'majority': {
      const counts = {};
      values.forEach(v => {
        const key = JSON.stringify(v);
        counts[key] = (counts[key] || 0) + 1;
      });
      const maxEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return JSON.parse(maxEntry[0]);
    }

    case 'median': {
      const nums = values.map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (nums.length === 0) return values[0];
      const mid = Math.floor(nums.length / 2);
      return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    }

    default:
      return values[0];
  }
}

/**
 * COLLAPSE_BY_SOURCE - Collapses by selecting value from specified source
 * @param {any} superposition - The superposition
 * @param {string} sourceName - The source to select
 * @returns {any} Value from that source, or error if not found
 */
function COLLAPSE_BY_SOURCE(superposition, sourceName) {
  if (!isSuperpositionObject(superposition)) return superposition;

  const states = superposition.states || [];
  const match = states.find(s => s.source === sourceName);

  if (!match) {
    // Return first value as fallback, could also throw
    console.warn(`COLLAPSE_BY_SOURCE: Source '${sourceName}' not found`);
    return states[0]?.value;
  }

  return match.value;
}

/**
 * COLLAPSE_IF - Conditionally collapses only when condition is met
 * @param {any} superposition - The superposition
 * @param {boolean} condition - Condition for collapse
 * @param {string} method - Collapse method
 * @returns {any|object} Collapsed value if condition true, original if false
 */
function COLLAPSE_IF(superposition, condition, method = 'first') {
  if (!condition) return superposition;
  return COLLAPSE(superposition, method);
}

/**
 * COLLAPSE_WHEN_SINGLE - Collapses only if all states are identical
 * @param {any} superposition - The superposition
 * @returns {any|object} Single value if unanimous, superposition if not
 */
function COLLAPSE_WHEN_SINGLE(superposition) {
  if (!isSuperpositionObject(superposition)) return superposition;

  const states = superposition.states || [];
  if (states.length === 0) return null;
  if (states.length === 1) return states[0].value;

  const unique = new Set(states.map(s => JSON.stringify(s.value)));
  if (unique.size === 1) {
    return states[0].value;
  }

  return superposition;
}

/**
 * COALESCE_SUP - Returns first non-superposed value, or collapses first superposition
 * @param {...any} args - Values to coalesce, optionally ending with collapse method
 * @returns {any} First definite value, or collapsed first superposition
 */
function COALESCE_SUP(...args) {
  // Check if last arg is a collapse method
  const methods = ['first', 'last', 'max', 'min', 'random', 'weighted', 'expected', 'majority', 'median'];
  let method = 'first';
  let values = args;

  if (args.length > 0 && typeof args[args.length - 1] === 'string' &&
      methods.includes(args[args.length - 1].toLowerCase())) {
    method = args[args.length - 1];
    values = args.slice(0, -1);
  }

  for (const v of values) {
    if (v == null) continue;
    if (!IS_SUPERPOSED(v)) return v;
  }

  // All superposed or null, collapse first non-null superposition
  for (const v of values) {
    if (v != null && isSuperpositionObject(v)) {
      return COLLAPSE(v, method);
    }
  }

  return null;
}

/**
 * RESOLVE - Interactive collapse, marks superposition as requiring human decision
 * @param {any} superposition - The superposition
 * @param {string} prompt - Prompt for resolution
 * @param {string} resolver - Optional resolver assignment
 * @returns {object} Superposition tagged for resolution
 */
function RESOLVE(superposition, prompt, resolver = null) {
  if (!isSuperpositionObject(superposition)) return superposition;

  return {
    ...superposition,
    needsResolution: true,
    resolutionPrompt: prompt,
    assignedResolver: resolver,
    resolutionRequested: Date.now()
  };
}

/**
 * TIMEOUT - Auto-collapses after duration if not manually resolved
 * @param {any} superposition - The superposition
 * @param {number|string} duration - Duration in ms or string like "7 days"
 * @param {string} fallbackMethod - Method to use for auto-collapse
 * @returns {object} Superposition that auto-collapses
 */
function TIMEOUT(superposition, duration, fallbackMethod = 'first') {
  if (!isSuperpositionObject(superposition)) return superposition;

  let durationMs;
  if (typeof duration === 'string') {
    // Parse duration strings like "7 days", "24 hours"
    const match = duration.match(/(\d+)\s*(day|hour|minute|second|ms)?s?/i);
    if (match) {
      const num = parseInt(match[1]);
      const unit = (match[2] || 'ms').toLowerCase();
      const multipliers = {
        'ms': 1,
        'second': 1000,
        'minute': 60000,
        'hour': 3600000,
        'day': 86400000
      };
      durationMs = num * (multipliers[unit] || 1);
    } else {
      durationMs = parseInt(duration) || 86400000; // Default 24 hours
    }
  } else {
    durationMs = Number(duration) || 86400000;
  }

  return {
    ...superposition,
    timeout: {
      deadline: Date.now() + durationMs,
      method: fallbackMethod,
      duration: durationMs
    }
  };
}

// ============================================================================
// Part IV: Combination Functions
// ============================================================================

/**
 * UNION_SUP - Combines superpositions, keeping all unique states
 * @param {...any} sups - Superpositions to combine
 * @returns {object} Combined superposition with all states
 */
function UNION_SUP(...sups) {
  const allStates = [];
  const seen = new Set();

  for (const sup of sups) {
    const states = isSuperpositionObject(sup) ? sup.states : [{ value: sup }];
    for (const s of states) {
      const key = JSON.stringify(s.value);
      if (!seen.has(key)) {
        seen.add(key);
        allStates.push({ ...s });
      }
    }
  }

  if (allStates.length === 0) return null;
  if (allStates.length === 1) return allStates[0].value;

  return createSuperpositionObject(allStates);
}

/**
 * INTERSECT_SUP - Keeps only states present in all superpositions
 * @param {...any} sups - Superpositions to intersect
 * @returns {object} Superposition of common states only
 */
function INTERSECT_SUP(...sups) {
  if (sups.length === 0) return null;

  const getValueSet = (sup) => {
    const states = isSuperpositionObject(sup) ? sup.states : [{ value: sup }];
    return new Set(states.map(s => JSON.stringify(s.value)));
  };

  let common = getValueSet(sups[0]);

  for (let i = 1; i < sups.length; i++) {
    const vals = getValueSet(sups[i]);
    common = new Set([...common].filter(v => vals.has(v)));
  }

  if (common.size === 0) return null;

  const states = [...common].map(v => ({ value: JSON.parse(v) }));

  if (states.length === 1) return states[0].value;
  return createSuperpositionObject(states);
}

/**
 * DIFF_SUP - Returns states in first superposition but not in second
 * @param {any} sup1 - First superposition
 * @param {any} sup2 - Second superposition
 * @returns {object} Superposition of differing states
 */
function DIFF_SUP(sup1, sup2) {
  const states1 = isSuperpositionObject(sup1) ? sup1.states : [{ value: sup1 }];
  const vals2Set = new Set(
    (isSuperpositionObject(sup2) ? sup2.states : [{ value: sup2 }])
      .map(s => JSON.stringify(s.value))
  );

  const diffStates = states1.filter(s => !vals2Set.has(JSON.stringify(s.value)));

  if (diffStates.length === 0) return null;
  if (diffStates.length === 1) return diffStates[0].value;

  return createSuperpositionObject(diffStates);
}

/**
 * PRODUCT_SUP - Cartesian product of superpositions, all combinations
 * @param {any} sup1 - First superposition
 * @param {any} sup2 - Second superposition
 * @param {function} combiner - Optional combiner function (default creates tuple)
 * @returns {object} Superposition of all combinations
 */
function PRODUCT_SUP(sup1, sup2, combiner = null) {
  const vals1 = GET_STATES(sup1);
  const vals2 = GET_STATES(sup2);
  const combineFn = combiner || ((a, b) => [a, b]);

  const states = [];
  for (const v1 of vals1) {
    for (const v2 of vals2) {
      states.push({ value: combineFn(v1, v2) });
    }
  }

  if (states.length === 0) return null;
  if (states.length === 1) return states[0].value;

  return createSuperpositionObject(states);
}

/**
 * ZIP_SUP - Pairs states by position
 * @param {any} sup1 - First superposition
 * @param {any} sup2 - Second superposition
 * @param {function} combiner - Optional combiner function
 * @returns {object} Superposition of paired states
 */
function ZIP_SUP(sup1, sup2, combiner = null) {
  const vals1 = GET_STATES(sup1);
  const vals2 = GET_STATES(sup2);
  const combineFn = combiner || ((a, b) => [a, b]);

  const len = Math.min(vals1.length, vals2.length);
  const states = [];

  for (let i = 0; i < len; i++) {
    states.push({ value: combineFn(vals1[i], vals2[i]) });
  }

  if (states.length === 0) return null;
  if (states.length === 1) return states[0].value;

  return createSuperpositionObject(states);
}

// ============================================================================
// Part V: Propagation Functions
// ============================================================================

/**
 * MAP_SUP - Applies function to each state independently
 * @param {any} superposition - The superposition
 * @param {function} fn - Transform function
 * @returns {object} Superposition with transformed states
 */
function MAP_SUP(superposition, fn) {
  if (!isSuperpositionObject(superposition)) {
    return fn(superposition);
  }

  const states = (superposition.states || []).map(s => ({
    ...s,
    value: fn(s.value)
  }));

  return createSuperpositionObject(states, {
    weighted: superposition.weighted,
    sourced: superposition.sourced
  });
}

/**
 * FILTER_SUP - Keeps only states matching condition
 * @param {any} superposition - The superposition
 * @param {function} predicate - Filter predicate
 * @returns {object|null} Filtered superposition
 */
function FILTER_SUP(superposition, predicate) {
  if (!isSuperpositionObject(superposition)) {
    return predicate(superposition) ? superposition : null;
  }

  const states = (superposition.states || []).filter(s => predicate(s.value));

  if (states.length === 0) return null;
  if (states.length === 1) return states[0].value;

  // Renormalize weights if weighted
  if (superposition.weighted) {
    const totalWeight = states.reduce((sum, s) => sum + (s.weight || s.probability || 0), 0);
    if (totalWeight > 0) {
      states.forEach(s => {
        const w = s.weight || s.probability || 0;
        s.probability = w / totalWeight;
      });
    }
  }

  return createSuperpositionObject(states, {
    weighted: superposition.weighted,
    sourced: superposition.sourced
  });
}

/**
 * REDUCE_SUP - Reduces all states to single value (collapses by computation)
 * @param {any} superposition - The superposition
 * @param {function} reducer - Reducer function (accumulator, current) => new accumulator
 * @param {any} initial - Initial accumulator value
 * @returns {any} Single reduced value
 */
function REDUCE_SUP(superposition, reducer, initial) {
  const values = GET_STATES(superposition);
  return values.reduce(reducer, initial);
}

/**
 * PROPAGATE - Controls how superposition flows through a formula
 * @param {any} superposition - The superposition
 * @param {function} fn - Transform function
 * @param {string} mode - Mode: "expand", "collapse_first", "parallel", "expected"
 * @returns {any|object} Result based on mode
 */
function PROPAGATE(superposition, fn, mode = 'expand') {
  switch (mode.toLowerCase()) {
    case 'expand':
    case 'parallel':
      return MAP_SUP(superposition, fn);

    case 'collapse_first':
      return fn(COLLAPSE(superposition, 'first'));

    case 'expected':
      return fn(EXPECTED(superposition));

    default:
      return MAP_SUP(superposition, fn);
  }
}

// ============================================================================
// Part VI: Stabilization Functions
// ============================================================================

/**
 * HOLD - Prevents accidental collapse, superposition must be explicitly collapsed
 * @param {any} superposition - The superposition to protect
 * @returns {object} Protected superposition
 */
function HOLD(superposition) {
  if (!isSuperpositionObject(superposition)) return superposition;

  return {
    ...superposition,
    held: true
  };
}

/**
 * DEFER - Marks superposition for later resolution
 * @param {any} superposition - The superposition
 * @param {any} until - Condition or date for resolution
 * @returns {object} Deferred superposition
 */
function DEFER(superposition, until) {
  if (!isSuperpositionObject(superposition)) return superposition;

  return {
    ...superposition,
    deferred: true,
    deferredUntil: until
  };
}

/**
 * REQUIRE_RESOLUTION - Marks superposition as blocking
 * @param {any} superposition - The superposition
 * @param {string} message - Blocking message
 * @returns {object} Blocking superposition
 */
function REQUIRE_RESOLUTION(superposition, message) {
  if (!isSuperpositionObject(superposition)) return superposition;

  return {
    ...superposition,
    blocking: true,
    blockingMessage: message
  };
}

// ============================================================================
// Part VII: Comparison & Analysis Functions
// ============================================================================

/**
 * COMPARE_SUP - Compares two superpositions for similarity
 * @param {any} sup1 - First superposition
 * @param {any} sup2 - Second superposition
 * @returns {object} Object with overlap, difference metrics
 */
function COMPARE_SUP(sup1, sup2) {
  const vals1 = GET_STATES(sup1).map(v => JSON.stringify(v));
  const vals2 = GET_STATES(sup2).map(v => JSON.stringify(v));

  const set1 = new Set(vals1);
  const set2 = new Set(vals2);

  const intersection = [...set1].filter(v => set2.has(v));
  const union = new Set([...set1, ...set2]);
  const onlyIn1 = [...set1].filter(v => !set2.has(v));
  const onlyIn2 = [...set2].filter(v => !set1.has(v));

  return {
    overlap: intersection.length / union.size,
    common: intersection.map(v => JSON.parse(v)),
    added: onlyIn2.map(v => JSON.parse(v)),
    removed: onlyIn1.map(v => JSON.parse(v)),
    count1: vals1.length,
    count2: vals2.length
  };
}

/**
 * DIVERGENCE - Measures how different two superpositions are
 * @param {any} sup1 - First superposition
 * @param {any} sup2 - Second superposition
 * @param {string} method - Method: "jaccard", "kl", "cosine"
 * @returns {number} Divergence score (0 = identical)
 */
function DIVERGENCE(sup1, sup2, method = 'jaccard') {
  const comparison = COMPARE_SUP(sup1, sup2);

  switch (method.toLowerCase()) {
    case 'jaccard':
      // Jaccard distance = 1 - Jaccard similarity
      return 1 - comparison.overlap;

    case 'cosine':
    case 'kl':
      // Simplified: use proportion of non-overlapping elements
      const total = comparison.count1 + comparison.count2;
      const diff = comparison.added.length + comparison.removed.length;
      return total > 0 ? diff / total : 0;

    default:
      return 1 - comparison.overlap;
  }
}

/**
 * OUTLIERS - Identifies states that are statistical outliers
 * @param {any} superposition - The superposition
 * @param {number} threshold - IQR multiplier (default 1.5)
 * @returns {object} Superposition of outlier states only
 */
function OUTLIERS(superposition, threshold = 1.5) {
  const values = GET_STATES(superposition);
  const nums = values
    .map((v, i) => ({ value: Number(v), index: i, original: v }))
    .filter(x => !isNaN(x.value))
    .sort((a, b) => a.value - b.value);

  if (nums.length < 4) return null; // Need enough data for IQR

  const q1Idx = Math.floor(nums.length * 0.25);
  const q3Idx = Math.floor(nums.length * 0.75);
  const q1 = nums[q1Idx].value;
  const q3 = nums[q3Idx].value;
  const iqr = q3 - q1;

  const lowerBound = q1 - threshold * iqr;
  const upperBound = q3 + threshold * iqr;

  const outliers = nums
    .filter(x => x.value < lowerBound || x.value > upperBound)
    .map(x => ({ value: x.original }));

  if (outliers.length === 0) return null;
  if (outliers.length === 1) return outliers[0].value;

  return createSuperpositionObject(outliers);
}

// ============================================================================
// Part VIII: Display & Formatting Functions
// ============================================================================

/**
 * FORMAT_SUP - Formats superposition for display
 * @param {any} superposition - The superposition
 * @param {string} format - Format: "list", "range", "weighted", "sourced", "compact"
 * @returns {string} Formatted string
 */
function FORMAT_SUP(superposition, format = 'list') {
  if (!isSuperpositionObject(superposition)) return String(superposition);

  const states = superposition.states || [];
  const values = states.map(s => s.value);
  const weights = GET_WEIGHTS(superposition);
  const sources = GET_SOURCES(superposition);

  switch (format.toLowerCase()) {
    case 'list':
      return values.join(', ');

    case 'range': {
      const nums = values.map(Number).filter(n => !isNaN(n));
      if (nums.length === 0) return values.join(', ');
      return `${Math.min(...nums)}–${Math.max(...nums)}`;
    }

    case 'weighted':
      return states.map((s, i) =>
        `${s.value} (${Math.round(weights[i] * 100)}%)`
      ).join(', ');

    case 'sourced':
      return states.map((s, i) =>
        `${s.value} (${sources[i]})`
      ).join(', ');

    case 'compact':
      return `∧${values.length} values`;

    default:
      return values.join(', ');
  }
}

/**
 * SUMMARIZE_SUP - Generates human-readable summary
 * @param {any} superposition - The superposition
 * @returns {string} Human-readable summary
 */
function SUMMARIZE_SUP(superposition) {
  if (!isSuperpositionObject(superposition)) {
    return `Single value: ${superposition}`;
  }

  const count = COUNT_STATES(superposition);
  const values = GET_STATES(superposition);
  const weights = GET_WEIGHTS(superposition);

  // Check if all numeric
  const nums = values.map(Number).filter(n => !isNaN(n));

  if (nums.length === values.length && nums.length > 0) {
    const exp = EXPECTED(superposition);
    const minVal = Math.min(...nums);
    const maxVal = Math.max(...nums);
    const maxIdx = weights.indexOf(Math.max(...weights));
    const mostLikely = values[maxIdx];
    const mostLikelyPct = Math.round(weights[maxIdx] * 100);

    return `${count} values, range ${minVal}–${maxVal}, expected ${exp.toFixed(2)}, most likely ${mostLikely} (${mostLikelyPct}%)`;
  } else {
    const preview = values.slice(0, 3).join(', ');
    const more = count > 3 ? '...' : '';
    return `${count} options: ${preview}${more}`;
  }
}

// ============================================================================
// Formula Function Registry
// ============================================================================

/**
 * All SUP formula functions for registration with formula evaluator
 */
const SUPFormulaFunctions = {
  // Creation
  SUPERPOSE,
  SUPERPOSE_IF,
  WEIGHTED,
  SOURCED,
  UNCERTAIN,
  RANGE_SUP,
  SNAPSHOT,

  // Inspection
  IS_SUPERPOSED,
  COUNT_STATES,
  GET_STATES,
  GET_STATE,
  GET_WEIGHTS,
  GET_SOURCES,
  SPREAD,
  EXPECTED,
  PROBABILITY_OF,
  VARIANCE,
  ENTROPY,
  CONFLICT_LEVEL,
  CONSENSUS,

  // Collapse
  COLLAPSE,
  COLLAPSE_BY_SOURCE,
  COLLAPSE_IF,
  COLLAPSE_WHEN_SINGLE,
  COALESCE_SUP,
  RESOLVE,
  TIMEOUT,

  // Combination
  UNION_SUP,
  INTERSECT_SUP,
  DIFF_SUP,
  PRODUCT_SUP,
  ZIP_SUP,

  // Propagation
  MAP_SUP,
  FILTER_SUP,
  REDUCE_SUP,
  PROPAGATE,

  // Stabilization
  HOLD,
  DEFER,
  REQUIRE_RESOLUTION,

  // Comparison
  COMPARE_SUP,
  DIVERGENCE,
  OUTLIERS,

  // Display
  FORMAT_SUP,
  SUMMARIZE_SUP
};

/**
 * Function metadata for the formula editor
 */
const SUPFunctionDefinitions = {
  name: 'Superposition',
  icon: 'ph-git-fork',
  functions: [
    // Creation
    { name: 'SUPERPOSE', syntax: 'SUPERPOSE(value1, value2, [...])', description: 'Hold multiple values without resolution' },
    { name: 'SUPERPOSE_IF', syntax: 'SUPERPOSE_IF(value1, value2, [...])', description: 'Superpose only if values differ' },
    { name: 'WEIGHTED', syntax: 'WEIGHTED(value1, weight1, [...])', description: 'Superposition with probabilities' },
    { name: 'SOURCED', syntax: 'SOURCED(value1, source1, [...])', description: 'Superposition with source attribution' },
    { name: 'UNCERTAIN', syntax: 'UNCERTAIN(value, uncertainty, [type])', description: 'Measurement with error margin' },
    { name: 'RANGE_SUP', syntax: 'RANGE_SUP(min, max, [steps])', description: 'Discretized range superposition' },
    { name: 'SNAPSHOT', syntax: 'SNAPSHOT(superposition, [label])', description: 'Capture superposition state' },

    // Inspection
    { name: 'IS_SUPERPOSED', syntax: 'IS_SUPERPOSED(value)', description: 'Check if value is superposed' },
    { name: 'COUNT_STATES', syntax: 'COUNT_STATES(superposition)', description: 'Count states in superposition' },
    { name: 'GET_STATES', syntax: 'GET_STATES(superposition)', description: 'Extract all values as array' },
    { name: 'GET_STATE', syntax: 'GET_STATE(superposition, index)', description: 'Get specific state by index' },
    { name: 'GET_WEIGHTS', syntax: 'GET_WEIGHTS(superposition)', description: 'Extract weights as array' },
    { name: 'GET_SOURCES', syntax: 'GET_SOURCES(superposition)', description: 'Extract sources as array' },
    { name: 'SPREAD', syntax: 'SPREAD(superposition)', description: 'Range of numeric superposition' },
    { name: 'EXPECTED', syntax: 'EXPECTED(superposition)', description: 'Weighted expected value' },
    { name: 'PROBABILITY_OF', syntax: 'PROBABILITY_OF(superposition, value)', description: 'Probability of specific value' },
    { name: 'VARIANCE', syntax: 'VARIANCE(superposition)', description: 'Statistical variance' },
    { name: 'ENTROPY', syntax: 'ENTROPY(superposition)', description: 'Information entropy in bits' },
    { name: 'CONFLICT_LEVEL', syntax: 'CONFLICT_LEVEL(superposition)', description: 'Disagreement measure (0-1)' },
    { name: 'CONSENSUS', syntax: 'CONSENSUS(superposition, threshold)', description: 'Check if spread below threshold' },

    // Collapse
    { name: 'COLLAPSE', syntax: 'COLLAPSE(superposition, method)', description: 'Force resolution to single value' },
    { name: 'COLLAPSE_BY_SOURCE', syntax: 'COLLAPSE_BY_SOURCE(superposition, source)', description: 'Select value by source' },
    { name: 'COLLAPSE_IF', syntax: 'COLLAPSE_IF(superposition, condition, method)', description: 'Conditional collapse' },
    { name: 'COLLAPSE_WHEN_SINGLE', syntax: 'COLLAPSE_WHEN_SINGLE(superposition)', description: 'Collapse only if unanimous' },
    { name: 'COALESCE_SUP', syntax: 'COALESCE_SUP(value1, [...], method)', description: 'First definite value' },
    { name: 'RESOLVE', syntax: 'RESOLVE(superposition, prompt, [resolver])', description: 'Mark for human resolution' },
    { name: 'TIMEOUT', syntax: 'TIMEOUT(superposition, duration, method)', description: 'Auto-collapse after time' },

    // Combination
    { name: 'UNION_SUP', syntax: 'UNION_SUP(sup1, sup2, [...])', description: 'Combine keeping all unique states' },
    { name: 'INTERSECT_SUP', syntax: 'INTERSECT_SUP(sup1, sup2, [...])', description: 'Keep common states only' },
    { name: 'DIFF_SUP', syntax: 'DIFF_SUP(sup1, sup2)', description: 'States in first not in second' },
    { name: 'PRODUCT_SUP', syntax: 'PRODUCT_SUP(sup1, sup2, [combiner])', description: 'Cartesian product' },
    { name: 'ZIP_SUP', syntax: 'ZIP_SUP(sup1, sup2, [combiner])', description: 'Pair states by position' },

    // Propagation
    { name: 'MAP_SUP', syntax: 'MAP_SUP(superposition, transform)', description: 'Apply function to each state' },
    { name: 'FILTER_SUP', syntax: 'FILTER_SUP(superposition, predicate)', description: 'Keep matching states' },
    { name: 'REDUCE_SUP', syntax: 'REDUCE_SUP(superposition, reducer, initial)', description: 'Reduce to single value' },
    { name: 'PROPAGATE', syntax: 'PROPAGATE(superposition, formula, mode)', description: 'Control flow through formula' },

    // Stabilization
    { name: 'HOLD', syntax: 'HOLD(superposition)', description: 'Prevent accidental collapse' },
    { name: 'DEFER', syntax: 'DEFER(superposition, until)', description: 'Mark for later resolution' },
    { name: 'REQUIRE_RESOLUTION', syntax: 'REQUIRE_RESOLUTION(superposition, message)', description: 'Mark as blocking' },

    // Comparison
    { name: 'COMPARE_SUP', syntax: 'COMPARE_SUP(sup1, sup2)', description: 'Compare for similarity' },
    { name: 'DIVERGENCE', syntax: 'DIVERGENCE(sup1, sup2, [method])', description: 'Measure difference' },
    { name: 'OUTLIERS', syntax: 'OUTLIERS(superposition, [threshold])', description: 'Identify statistical outliers' },

    // Display
    { name: 'FORMAT_SUP', syntax: 'FORMAT_SUP(superposition, format)', description: 'Format for display' },
    { name: 'SUMMARIZE_SUP', syntax: 'SUMMARIZE_SUP(superposition)', description: 'Human-readable summary' }
  ]
};

// ============================================================================
// Export
// ============================================================================

window.EOSUPFormulas = {
  // Utility
  isSuperpositionObject,
  createSuperpositionObject,

  // All functions
  ...SUPFormulaFunctions,

  // Function registry
  functions: SUPFormulaFunctions,
  definitions: SUPFunctionDefinitions
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.EOSUPFormulas;
}
