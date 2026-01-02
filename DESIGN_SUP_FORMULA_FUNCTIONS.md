# SUP Formula Functions: General Purpose Specification

## Overview

This specification defines formula functions for working with **superpositions** (SUP) - values that hold multiple possible states simultaneously without forcing resolution until explicitly requested.

These functions extend the existing formula system (`eo_formula_editor.js`) to integrate with the superposition display system (`eo_superposition_display.js`), enabling formulas to create, inspect, collapse, and combine superposed values.

## Design Principles

1. **Domain-agnostic** — Works for budgets, dates, text, anything
2. **Composable** — SUP values can flow through other formulas
3. **Explicit** — User controls when collapse happens
4. **Auditable** — Superposition history is preserved
5. **Familiar syntax** — Follows existing formula conventions

---

## Part I: Creating Superpositions

### SUPERPOSE

The fundamental function. Holds multiple values without forcing resolution.

```
SUPERPOSE(value1, value2, [value3, ...])
```

**Returns:** Superposition object containing all values

**Examples:**
```javascript
SUPERPOSE(50000, 52000)
// → ∧[50000, 52000]

SUPERPOSE("approved", "pending", "rejected")
// → ∧["approved", "pending", "rejected"]

SUPERPOSE({Start Date}, {Alt Start Date})
// → ∧[2025-01-15, 2025-02-01]
```

**Use when:** You have multiple candidate values and don't want to pick yet.

---

### SUPERPOSE_IF

Conditionally creates superposition only when values differ.

```
SUPERPOSE_IF(value1, value2, [value3, ...])
```

**Returns:** Single value if all equal, superposition if they differ

**Examples:**
```javascript
SUPERPOSE_IF(100, 100, 100)
// → 100 (no superposition needed)

SUPERPOSE_IF(100, 100, 105)
// → ∧[100, 105]

SUPERPOSE_IF({Budget v1}, {Budget v2}, {Budget v3})
// → Single value or superposition depending on agreement
```

**Use when:** You want superposition only when there's actual disagreement.

---

### WEIGHTED

Creates superposition with explicit weights (confidence, probability, or preference).

```
WEIGHTED(value1, weight1, value2, weight2, [...])
```

**Returns:** Superposition with probability/weight metadata

**Examples:**
```javascript
WEIGHTED(50000, 0.7, 52000, 0.3)
// → ∧[50000 (70%), 52000 (30%)]

WEIGHTED("yes", 3, "no", 1, "maybe", 1)
// → ∧["yes" (60%), "no" (20%), "maybe" (20%)]

WEIGHTED({Estimate Low}, 0.25, {Estimate Mid}, 0.5, {Estimate High}, 0.25)
// → Triangular distribution
```

**Use when:** Some values are more likely/preferred than others.

---

### SOURCED

Creates superposition where each value is tagged with its origin.

```
SOURCED(value1, source1, value2, source2, [...])
```

**Returns:** Superposition with source attribution

**Examples:**
```javascript
SOURCED(50000, "Finance", 52000, "Operations")
// → ∧[50000 ←Finance, 52000 ←Operations]

SOURCED({Field A}, "System Import", {Field B}, "Manual Entry")
// → Track where each value came from

SOURCED(
  {Q1 Estimate}, "January Forecast",
  {Q1 Estimate v2}, "March Revision",
  {Q1 Actual}, "Final Close"
)
// → Full provenance chain
```

**Use when:** You need audit trail of which source provided which value.

---

### UNCERTAIN

Creates superposition representing measurement uncertainty or confidence interval.

```
UNCERTAIN(central_value, uncertainty, [type])
```

**Types:** "absolute", "percent", "stddev", "range"

**Returns:** Superposition representing uncertainty band

**Examples:**
```javascript
UNCERTAIN(1000, 50, "absolute")
// → ∧[950...1050] or ∧[950, 1000, 1050]

UNCERTAIN(1000, 5, "percent")
// → ∧[950...1050]

UNCERTAIN(1000, 100, "stddev")
// → Normal distribution centered at 1000, σ=100

UNCERTAIN({Measurement}, {Error Margin})
// → Value with explicit uncertainty
```

**Use when:** Values have known measurement error or confidence intervals.

---

### RANGE_SUP

Creates superposition from a continuous range (discretized).

```
RANGE_SUP(min, max, [steps])
```

**Returns:** Superposition of values spanning the range

**Examples:**
```javascript
RANGE_SUP(100, 200, 5)
// → ∧[100, 125, 150, 175, 200]

RANGE_SUP(0, 1, 11)
// → ∧[0, 0.1, 0.2, ... 1.0]

RANGE_SUP({Low Estimate}, {High Estimate}, 3)
// → ∧[low, mid, high]
```

**Use when:** You have bounds but not specific candidates.

---

### SNAPSHOT

Captures current superposition state at a point in time.

```
SNAPSHOT(superposition, [label])
```

**Returns:** Timestamped copy of superposition state

**Examples:**
```javascript
SNAPSHOT({Budget})
// → Frozen copy of current superposition state

SNAPSHOT({Status}, "Pre-meeting")
// → Labeled snapshot for comparison
```

**Use when:** You want to preserve superposition state before potential changes.

---

## Part II: Inspecting Superpositions (Non-Collapsing)

### IS_SUPERPOSED

Tests whether a value is in superposition.

```
IS_SUPERPOSED(value)
```

**Returns:** TRUE if superposed, FALSE if single value

**Examples:**
```javascript
IS_SUPERPOSED(SUPERPOSE(1, 2))
// → TRUE

IS_SUPERPOSED(100)
// → FALSE

IF(IS_SUPERPOSED({Budget}), "⚠️ Unresolved", "✓ Confirmed")
// → Status indicator
```

---

### COUNT_STATES

Returns how many states are in the superposition.

```
COUNT_STATES(superposition)
```

**Returns:** Number (1 if not superposed)

**Examples:**
```javascript
COUNT_STATES(SUPERPOSE(1, 2, 3))
// → 3

COUNT_STATES(100)
// → 1

IF(COUNT_STATES({Value}) > 2, "Complex", "Simple")
// → Complexity indicator
```

---

### GET_STATES

Extracts all values as an array without collapsing.

```
GET_STATES(superposition)
```

**Returns:** Array of all values

**Examples:**
```javascript
GET_STATES(SUPERPOSE(100, 200, 300))
// → [100, 200, 300]

ARRAYJOIN(GET_STATES({Options}), " / ")
// → "Option A / Option B / Option C"

MAX(GET_STATES({Estimates}))
// → Highest estimate without collapsing
```

---

### GET_STATE

Gets a specific state by index without collapsing.

```
GET_STATE(superposition, index)
```

**Returns:** Value at that index (1-indexed)

**Examples:**
```javascript
GET_STATE(SUPERPOSE("A", "B", "C"), 2)
// → "B"

GET_STATE({Ranked Options}, 1)
// → Top-ranked option
```

---

### GET_WEIGHTS

Extracts weights/probabilities as array.

```
GET_WEIGHTS(superposition)
```

**Returns:** Array of weights (equal weights if unweighted)

**Examples:**
```javascript
GET_WEIGHTS(WEIGHTED(100, 0.7, 200, 0.3))
// → [0.7, 0.3]

GET_WEIGHTS(SUPERPOSE(1, 2, 3))
// → [0.333, 0.333, 0.333]
```

---

### GET_SOURCES

Extracts source attributions as array.

```
GET_SOURCES(superposition)
```

**Returns:** Array of source labels

**Examples:**
```javascript
GET_SOURCES(SOURCED(100, "A", 200, "B"))
// → ["A", "B"]

ARRAYJOIN(GET_SOURCES({Budget}), ", ")
// → "Finance, Operations, Executive"
```

---

### SPREAD

Returns the spread/range of a numeric superposition.

```
SPREAD(superposition)
```

**Returns:** Difference between max and min states

**Examples:**
```javascript
SPREAD(SUPERPOSE(100, 150, 200))
// → 100

SPREAD(WEIGHTED(1000, 0.8, 1200, 0.2))
// → 200

IF(SPREAD({Estimate}) > 1000, "High variance", "Tight estimate")
```

---

### EXPECTED

Returns probability-weighted expected value (numeric only).

```
EXPECTED(superposition)
```

**Returns:** Weighted average without collapsing

**Examples:**
```javascript
EXPECTED(WEIGHTED(100, 0.7, 200, 0.3))
// → 130

EXPECTED(SUPERPOSE(10, 20, 30))
// → 20 (equal weights assumed)

{Budget Forecast} - EXPECTED({Budget Scenarios})
// → Deviation from expected
```

---

### PROBABILITY_OF

Returns probability of a specific value.

```
PROBABILITY_OF(superposition, value)
```

**Returns:** Probability (0-1)

**Examples:**
```javascript
PROBABILITY_OF(WEIGHTED("yes", 0.6, "no", 0.4), "yes")
// → 0.6

PROBABILITY_OF(SUPERPOSE(1, 2, 3), 2)
// → 0.333

IF(PROBABILITY_OF({Outcome}, "success") > 0.5, "Likely", "Unlikely")
```

---

### VARIANCE

Returns statistical variance of numeric superposition.

```
VARIANCE(superposition)
```

**Returns:** Variance value

**Examples:**
```javascript
VARIANCE(SUPERPOSE(10, 20, 30))
// → 66.67

SQRT(VARIANCE({Estimates}))
// → Standard deviation
```

---

### ENTROPY

Returns information entropy of superposition (uncertainty measure).

```
ENTROPY(superposition)
```

**Returns:** Entropy in bits (0 = certain, higher = more uncertain)

**Examples:**
```javascript
ENTROPY(SUPERPOSE(1))
// → 0 (no uncertainty)

ENTROPY(SUPERPOSE(1, 2))
// → 1 bit (maximum for 2 states)

ENTROPY(WEIGHTED(1, 0.99, 2, 0.01))
// → ~0.08 bits (low uncertainty)
```

---

### CONFLICT_LEVEL

Returns a measure of how much states disagree.

```
CONFLICT_LEVEL(superposition)
```

**Returns:** 0 (no conflict) to 1 (maximum conflict)

**Examples:**
```javascript
CONFLICT_LEVEL(SUPERPOSE(100, 100))
// → 0 (agreement)

CONFLICT_LEVEL(SUPERPOSE(100, 200))
// → Higher value

CONFLICT_LEVEL(SUPERPOSE("yes", "no"))
// → 1 (binary opposition)
```

---

## Part III: Collapsing Superpositions

### COLLAPSE

Forces superposition to resolve to single value.

```
COLLAPSE(superposition, method)
```

**Methods:**
- `"first"` — First value (default)
- `"last"` — Last value
- `"max"` — Maximum (numeric)
- `"min"` — Minimum (numeric)
- `"random"` — Random selection
- `"weighted"` — Random weighted by probabilities
- `"expected"` — Expected value (numeric)
- `"majority"` — Most common value
- `"median"` — Middle value (numeric)

**Examples:**
```javascript
COLLAPSE(SUPERPOSE(10, 20, 30), "max")
// → 30

COLLAPSE(WEIGHTED("A", 0.7, "B", 0.3), "weighted")
// → "A" (70% of the time)

COLLAPSE({Options}, "first")
// → First option
```

---

### COLLAPSE_BY_SOURCE

Collapses by selecting value from specified source.

```
COLLAPSE_BY_SOURCE(superposition, source_name)
```

**Returns:** Value from that source, or error if not found

**Examples:**
```javascript
COLLAPSE_BY_SOURCE(
  SOURCED(50000, "Finance", 52000, "Ops"),
  "Finance"
)
// → 50000

COLLAPSE_BY_SOURCE({Budget}, {Authoritative Source})
// → Dynamic source selection
```

---

### COLLAPSE_IF

Conditionally collapses only when condition is met.

```
COLLAPSE_IF(superposition, condition, method)
```

**Returns:** Collapsed value if condition true, original superposition if false

**Examples:**
```javascript
COLLAPSE_IF({Pending}, {Approved} = TRUE, "first")
// → Collapses only when approved

COLLAPSE_IF({Estimate}, TODAY() > {Deadline}, "expected")
// → Collapses after deadline passes
```

---

### COLLAPSE_WHEN_SINGLE

Collapses only if there's actually just one value (auto-resolve agreement).

```
COLLAPSE_WHEN_SINGLE(superposition)
```

**Returns:** Single value if unanimous, superposition if not

**Examples:**
```javascript
COLLAPSE_WHEN_SINGLE(SUPERPOSE(100, 100, 100))
// → 100

COLLAPSE_WHEN_SINGLE(SUPERPOSE(100, 200))
// → ∧[100, 200] (no collapse)
```

---

### COALESCE_SUP

Returns first non-superposed value, or collapses first superposition found.

```
COALESCE_SUP(value1, value2, [...], collapse_method)
```

**Returns:** First definite value, or collapsed first superposition

**Examples:**
```javascript
COALESCE_SUP({Confirmed}, {Estimated}, {Default})
// → First non-superposed value

COALESCE_SUP({A}, {B}, {C}, "expected")
// → First definite, or expected value of first superposition
```

---

### RESOLVE

Interactive collapse—marks superposition as requiring human decision.

```
RESOLVE(superposition, prompt, [resolver])
```

**Returns:** Superposition tagged for resolution

**Examples:**
```javascript
RESOLVE({Budget}, "Select final budget")
// → Flags for human resolution in UI

RESOLVE({Options}, "Choose approach", "Project Manager")
// → Assigns to specific resolver
```

---

## Part IV: Combining Superpositions

### UNION_SUP

Combines superpositions, keeping all unique states.

```
UNION_SUP(sup1, sup2, [...])
```

**Returns:** Combined superposition with all states

**Examples:**
```javascript
UNION_SUP(SUPERPOSE(1, 2), SUPERPOSE(2, 3))
// → ∧[1, 2, 3]

UNION_SUP({Options A}, {Options B})
// → All options from both
```

---

### INTERSECT_SUP

Keeps only states present in all superpositions.

```
INTERSECT_SUP(sup1, sup2, [...])
```

**Returns:** Superposition of common states only

**Examples:**
```javascript
INTERSECT_SUP(SUPERPOSE(1, 2, 3), SUPERPOSE(2, 3, 4))
// → ∧[2, 3]

INTERSECT_SUP({Acceptable to A}, {Acceptable to B})
// → Mutually acceptable options
```

---

### DIFF_SUP

Returns states in first superposition but not in second.

```
DIFF_SUP(sup1, sup2)
```

**Returns:** Superposition of differing states

**Examples:**
```javascript
DIFF_SUP(SUPERPOSE(1, 2, 3), SUPERPOSE(2, 3))
// → ∧[1]

DIFF_SUP({All Options}, {Rejected Options})
// → Remaining options
```

---

### PRODUCT_SUP

Cartesian product—all combinations of states.

```
PRODUCT_SUP(sup1, sup2, [combiner])
```

**Returns:** Superposition of all combinations

**Examples:**
```javascript
PRODUCT_SUP(SUPERPOSE(1, 2), SUPERPOSE(10, 20))
// → ∧[(1,10), (1,20), (2,10), (2,20)]

PRODUCT_SUP(SUPERPOSE(10, 20), SUPERPOSE(1, 2), (a, b) => a * b)
// → ∧[10, 20, 20, 40]
```

---

### ZIP_SUP

Pairs states by position.

```
ZIP_SUP(sup1, sup2, [combiner])
```

**Returns:** Superposition of paired states

**Examples:**
```javascript
ZIP_SUP(SUPERPOSE("A", "B"), SUPERPOSE(1, 2))
// → ∧[("A", 1), ("B", 2)]

ZIP_SUP({Low Estimates}, {High Estimates}, (l, h) => (l + h) / 2)
// → Midpoints
```

---

## Part V: Propagation Functions

### MAP_SUP

Applies function to each state independently.

```
MAP_SUP(superposition, formula)
```

**Returns:** Superposition with transformed states

**Examples:**
```javascript
MAP_SUP(SUPERPOSE(10, 20, 30), x => x * 1.1)
// → ∧[11, 22, 33]

MAP_SUP({Price Options}, x => x * {Quantity})
// → All possible totals

MAP_SUP({Dates}, x => DATEADD(x, 7, "days"))
// → All dates shifted
```

---

### FILTER_SUP

Keeps only states matching condition.

```
FILTER_SUP(superposition, condition)
```

**Returns:** Filtered superposition

**Examples:**
```javascript
FILTER_SUP(SUPERPOSE(10, 20, 30, 40), x => x > 15)
// → ∧[20, 30, 40]

FILTER_SUP({Candidates}, x => x.score > 80)
// → Only high-scoring candidates
```

---

### REDUCE_SUP

Reduces all states to single value (collapses by computation).

```
REDUCE_SUP(superposition, reducer, initial)
```

**Returns:** Single reduced value

**Examples:**
```javascript
REDUCE_SUP(SUPERPOSE(10, 20, 30), (a, b) => a + b, 0)
// → 60 (sum of all states)

REDUCE_SUP({Options}, (best, curr) => IF(curr.score > best.score, curr, best), {first})
// → Best option by score
```

---

### PROPAGATE

Explicitly controls how superposition flows through a formula.

```
PROPAGATE(superposition, formula, mode)
```

**Modes:**
- `"expand"` — Calculate all combinations (default)
- `"collapse_first"` — Collapse inputs, then calculate
- `"parallel"` — Calculate each state independently
- `"expected"` — Use expected values

**Examples:**
```javascript
PROPAGATE(SUPERPOSE(10, 20), x => x + 5, "expand")
// → ∧[15, 25]

PROPAGATE(SUPERPOSE(10, 20), x => x + SUPERPOSE(1, 2), "expand")
// → ∧[11, 12, 21, 22] (all combinations)

PROPAGATE(SUPERPOSE(10, 20), x => x * 2, "expected")
// → 30 (expected value of input × 2)
```

---

## Part VI: Stabilization & Control

### HOLD

Prevents accidental collapse—superposition must be explicitly collapsed.

```
HOLD(superposition)
```

**Returns:** Protected superposition

**Examples:**
```javascript
HOLD(SUPERPOSE(1, 2, 3))
// → Protected ∧[1, 2, 3]

COLLAPSE(HOLD({Options}), "first")
// → Still works—explicit collapse allowed
```

---

### DEFER

Marks superposition for later resolution.

```
DEFER(superposition, until)
```

**Returns:** Deferred superposition

**Examples:**
```javascript
DEFER({Budget Options}, {Decision Date})
// → Collapses when decision date passes

DEFER({Candidates}, "final_review")
// → Collapses at named milestone
```

---

### REQUIRE_RESOLUTION

Marks superposition as blocking—must be resolved before dependent calculations.

```
REQUIRE_RESOLUTION(superposition, message)
```

**Returns:** Blocking superposition

**Examples:**
```javascript
REQUIRE_RESOLUTION({Pricing}, "Pricing must be confirmed before invoice")
// → Downstream formulas show error until resolved
```

---

### TIMEOUT

Auto-collapses after duration if not manually resolved.

```
TIMEOUT(superposition, duration, fallback_method)
```

**Returns:** Superposition that auto-collapses

**Examples:**
```javascript
TIMEOUT({Approval}, "7 days", "first")
// → Auto-approves first option after 7 days

TIMEOUT({Bid}, "24 hours", "max")
// → Takes highest bid after auction closes
```

---

## Part VII: Comparison & Analysis

### COMPARE_SUP

Compares two superpositions for similarity.

```
COMPARE_SUP(sup1, sup2)
```

**Returns:** Object with overlap, difference metrics

**Examples:**
```javascript
COMPARE_SUP({Version 1 Options}, {Version 2 Options})
// → { overlap: 0.8, added: [...], removed: [...] }
```

---

### DIVERGENCE

Measures how different two superpositions are.

```
DIVERGENCE(sup1, sup2, [method])
```

**Methods:** "jaccard", "kl", "cosine"

**Returns:** Divergence score (0 = identical)

**Examples:**
```javascript
DIVERGENCE({Team A Estimates}, {Team B Estimates})
// → 0.3 (30% different)
```

---

### CONSENSUS

Checks if superposition shows consensus (low spread, high agreement).

```
CONSENSUS(superposition, threshold)
```

**Returns:** TRUE if spread below threshold

**Examples:**
```javascript
CONSENSUS(SUPERPOSE(100, 102, 99), 5)
// → TRUE (spread of 3 is under 5)

IF(CONSENSUS({Votes}, 0.1), "Agreement", "Discuss further")
```

---

### OUTLIERS

Identifies states that are statistical outliers.

```
OUTLIERS(superposition, [threshold])
```

**Returns:** Superposition of outlier states only

**Examples:**
```javascript
OUTLIERS(SUPERPOSE(10, 11, 12, 100))
// → ∧[100]

COUNT_STATES(OUTLIERS({Estimates}))
// → Number of outlier estimates
```

---

## Part VIII: Display & Formatting

### FORMAT_SUP

Formats superposition for display.

```
FORMAT_SUP(superposition, format)
```

**Formats:**
- `"list"` — "A, B, C"
- `"range"` — "100-200"
- `"weighted"` — "A (70%), B (30%)"
- `"sourced"` — "100 (Finance), 200 (Ops)"
- `"compact"` — "∧3 values"

**Examples:**
```javascript
FORMAT_SUP(SUPERPOSE(100, 200, 300), "range")
// → "100-300"

FORMAT_SUP(WEIGHTED("yes", 0.8, "no", 0.2), "weighted")
// → "yes (80%), no (20%)"

FORMAT_SUP({Options}, "compact")
// → "∧4 options"
```

---

### SUMMARIZE_SUP

Generates text summary of superposition.

```
SUMMARIZE_SUP(superposition)
```

**Returns:** Human-readable summary

**Examples:**
```javascript
SUMMARIZE_SUP(WEIGHTED(100, 0.6, 150, 0.3, 200, 0.1))
// → "3 values ranging 100-200, expected 120, most likely 100 (60%)"
```

---

## Quick Reference: When to Use What

| Situation | Function |
|-----------|----------|
| Multiple candidates, no preference | `SUPERPOSE` |
| Some options more likely | `WEIGHTED` |
| Need to track where values came from | `SOURCED` |
| Measurement with error bars | `UNCERTAIN` |
| Check if resolved | `IS_SUPERPOSED` |
| Get expected/mean value | `EXPECTED` |
| Need a definite answer | `COLLAPSE` |
| Only collapse if unanimous | `COLLAPSE_WHEN_SINGLE` |
| Keep only common options | `INTERSECT_SUP` |
| Apply formula to each option | `MAP_SUP` |
| Auto-resolve after time | `TIMEOUT` |

---

## Function Categories Summary

| Category | Count | Purpose |
|----------|-------|---------|
| **Creation** | 7 | Make superpositions |
| **Inspection** | 13 | Query without collapsing |
| **Collapse** | 6 | Force resolution |
| **Combination** | 5 | Merge superpositions |
| **Propagation** | 4 | Flow through formulas |
| **Stabilization** | 4 | Prevent premature collapse |
| **Comparison** | 4 | Analyze differences |
| **Display** | 2 | Format for output |

---

## Formula Composition Examples

### Budget Scenario Analysis
```javascript
// Create scenarios
{Budget Scenarios} = WEIGHTED(
  {Conservative}, 0.3,
  {Moderate}, 0.5,
  {Aggressive}, 0.2
)

// Calculate impacts
{Revenue Impact} = MAP_SUP({Budget Scenarios}, b => b * {Growth Rate})

// Get expected case
{Expected Revenue} = EXPECTED({Revenue Impact})

// Get range
{Revenue Range} = FORMAT_SUP({Revenue Impact}, "range")

// Check if decision needed
{Needs Decision} = SPREAD({Budget Scenarios}) > 10000
```

### Multi-Source Data Reconciliation
```javascript
// Collect from sources
{Raw Data} = SOURCED(
  {System A Value}, "System A",
  {System B Value}, "System B",
  {Manual Entry}, "User"
)

// Check agreement
{Has Conflict} = CONFLICT_LEVEL({Raw Data}) > 0

// Auto-resolve if unanimous
{Reconciled} = COLLAPSE_WHEN_SINGLE({Raw Data})

// Or require manual resolution
{Final} = IF(
  IS_SUPERPOSED({Reconciled}),
  RESOLVE({Reconciled}, "Values disagree—please select"),
  {Reconciled}
)
```

### Option Ranking
```javascript
// Score each option
{Scored Options} = MAP_SUP(
  {Candidates},
  c => { ...c, score: c.cost * 0.4 + c.quality * 0.6 }
)

// Filter viable
{Viable} = FILTER_SUP({Scored Options}, x => x.score > 70)

// If clear winner, collapse; otherwise present choices
{Recommendation} = IF(
  COUNT_STATES({Viable}) = 1,
  COLLAPSE({Viable}, "first"),
  RESOLVE({Viable}, "Multiple good options—please choose")
)
```

---

## Integration with Existing Systems

### Relationship to eo_superposition_display.js

This formula function library extends the existing superposition display system:

| Existing Concept | Formula Function Equivalent |
|-----------------|---------------------------|
| `SuperpositionState.SUPERPOSED` | `IS_SUPERPOSED() = TRUE` |
| `SuperpositionState.RESOLVED` | Result of `COLLAPSE()` |
| `ResolutionStrategy.MOST_RECENT` | `COLLAPSE(sup, "last")` |
| `ResolutionStrategy.HIGHEST_CONFIDENCE` | `COLLAPSE_BY_SOURCE(sup, highest_confidence_source)` |
| `ResolutionStrategy.PRIMARY_SOURCE` | `COLLAPSE_BY_SOURCE(sup, primary)` |
| `ResolutionStrategy.AGGREGATE` | `EXPECTED(sup)` or `REDUCE_SUP(sup, ...)` |
| `ResolutionStrategy.MANUAL` | `RESOLVE(sup, prompt)` |
| `ResolutionStrategy.KEEP_ALL` | No collapse (default behavior) |

### Relationship to eo_formula_editor.js

These functions integrate as a new category alongside existing function groups:

```javascript
superposition: {
  name: 'Superposition',
  icon: 'ph-git-fork',
  functions: [
    { name: 'SUPERPOSE', syntax: 'SUPERPOSE(value1, value2, [...])', description: 'Hold multiple values' },
    { name: 'WEIGHTED', syntax: 'WEIGHTED(value1, weight1, [...])', description: 'Weighted superposition' },
    { name: 'IS_SUPERPOSED', syntax: 'IS_SUPERPOSED(value)', description: 'Check if superposed' },
    { name: 'COLLAPSE', syntax: 'COLLAPSE(sup, method)', description: 'Resolve to single value' },
    // ... etc
  ]
}
```

---

## Implementation Notes

### Superposition Object Structure

```javascript
{
  _type: 'superposition',
  states: [
    { value: any, weight?: number, source?: string, timestamp?: number },
    // ...
  ],
  weighted: boolean,
  sourced: boolean,
  uncertainty?: { type: string, magnitude: number },
  held?: boolean,
  deferred_until?: any,
  blocking?: boolean,
  timeout?: { deadline: number, method: string }
}
```

### Nine Rules Alignment

| Rule | Alignment |
|------|-----------|
| **Distinction** | Superpositions are MEANT (interpretive) not GIVEN |
| **Impenetrability** | Raw data preserved; SUP is interpretation layer |
| **Ineliminability** | Original values preserved in states array |
| **Perspectivality** | Different users can COLLAPSE differently |
| **Restrictivity** | `FILTER_SUP` restricts, never expands |
| **Coherence** | Collapsed values consistent with original states |
| **Groundedness** | `SOURCED` tracks provenance |
| **Determinacy** | `COLLAPSE` crystallizes meaning |
| **Defeasibility** | Collapsed values can be superseded |

---

## Appendix: Full Function Reference

### Creation Functions (7)
- `SUPERPOSE(value1, value2, [...])` — Basic multi-value holder
- `SUPERPOSE_IF(value1, value2, [...])` — Conditional superposition
- `WEIGHTED(value1, weight1, [...])` — With probabilities
- `SOURCED(value1, source1, [...])` — With provenance
- `UNCERTAIN(central, uncertainty, [type])` — Error bands
- `RANGE_SUP(min, max, [steps])` — Discretized range
- `SNAPSHOT(superposition, [label])` — Frozen state

### Inspection Functions (13)
- `IS_SUPERPOSED(value)` → boolean
- `COUNT_STATES(superposition)` → number
- `GET_STATES(superposition)` → array
- `GET_STATE(superposition, index)` → value
- `GET_WEIGHTS(superposition)` → array
- `GET_SOURCES(superposition)` → array
- `SPREAD(superposition)` → number
- `EXPECTED(superposition)` → number
- `PROBABILITY_OF(superposition, value)` → number
- `VARIANCE(superposition)` → number
- `ENTROPY(superposition)` → number
- `CONFLICT_LEVEL(superposition)` → number (0-1)
- `CONSENSUS(superposition, threshold)` → boolean

### Collapse Functions (6)
- `COLLAPSE(superposition, method)` → value
- `COLLAPSE_BY_SOURCE(superposition, source_name)` → value
- `COLLAPSE_IF(superposition, condition, method)` → value|superposition
- `COLLAPSE_WHEN_SINGLE(superposition)` → value|superposition
- `COALESCE_SUP(value1, [...], method)` → value
- `RESOLVE(superposition, prompt, [resolver])` → tagged superposition

### Combination Functions (5)
- `UNION_SUP(sup1, sup2, [...])` — All unique states
- `INTERSECT_SUP(sup1, sup2, [...])` — Common states
- `DIFF_SUP(sup1, sup2)` — Difference
- `PRODUCT_SUP(sup1, sup2, [combiner])` — Cartesian product
- `ZIP_SUP(sup1, sup2, [combiner])` — Positional pairing

### Propagation Functions (4)
- `MAP_SUP(superposition, transform)` — Apply to each
- `FILTER_SUP(superposition, predicate)` — Keep matching
- `REDUCE_SUP(superposition, reducer, initial)` — Aggregate
- `PROPAGATE(superposition, formula, mode)` — Control flow

### Stabilization Functions (4)
- `HOLD(superposition)` — Prevent accidental collapse
- `DEFER(superposition, until)` — Delay resolution
- `REQUIRE_RESOLUTION(superposition, message)` — Mark blocking
- `TIMEOUT(superposition, duration, method)` — Auto-collapse

### Comparison Functions (4)
- `COMPARE_SUP(sup1, sup2)` → metrics object
- `DIVERGENCE(sup1, sup2, [method])` → number
- `CONSENSUS(superposition, threshold)` → boolean
- `OUTLIERS(superposition, [threshold])` → superposition

### Display Functions (2)
- `FORMAT_SUP(superposition, format)` → string
- `SUMMARIZE_SUP(superposition)` → string
