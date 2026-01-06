# SUP Formula Functions: Simplified Specification

## Overview

This specification defines formula functions for working with **superpositions** (SUP) - values that hold multiple possible states simultaneously without forcing resolution until explicitly requested.

These functions extend the existing formula system (`noema_formula_editor.js`) to integrate with the superposition display system (`noema_superposition_display.js`).

## Design Principles

1. **Domain-agnostic** — Works for budgets, dates, text, anything
2. **Composable** — SUP values can flow through other formulas
3. **Explicit** — User controls when collapse happens
4. **Minimal** — Only essential functions, no redundant operations

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
```

**Use when:** You need audit trail of which source provided which value.

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
```

---

### COLLAPSE_BY_SOURCE

Collapses by selecting value from specified source.

```
COLLAPSE_BY_SOURCE(superposition, source_name)
```

**Returns:** Value from that source, or first value if not found

**Examples:**
```javascript
COLLAPSE_BY_SOURCE(
  SOURCED(50000, "Finance", 52000, "Ops"),
  "Finance"
)
// → 50000
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

Collapses only if there's actually just one unique value (auto-resolve agreement).

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
```

---

## Part VI: Display & Formatting

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
// → "3 values, range 100-200, expected 120, most likely 100 (60%)"
```

---

## Quick Reference: When to Use What

| Situation | Function |
|-----------|----------|
| Multiple candidates, no preference | `SUPERPOSE` |
| Some options more likely | `WEIGHTED` |
| Need to track where values came from | `SOURCED` |
| Check if resolved | `IS_SUPERPOSED` |
| Get expected/mean value | `EXPECTED` |
| Need a definite answer | `COLLAPSE` |
| Only collapse if unanimous | `COLLAPSE_WHEN_SINGLE` |
| Keep only common options | `INTERSECT_SUP` |
| Apply formula to each option | `MAP_SUP` |

---

## Function Categories Summary

| Category | Count | Purpose |
|----------|-------|---------|
| **Creation** | 4 | Make superpositions |
| **Inspection** | 8 | Query without collapsing |
| **Collapse** | 4 | Force resolution |
| **Combination** | 3 | Merge superpositions |
| **Propagation** | 3 | Flow through formulas |
| **Display** | 2 | Format for output |
| **Total** | **22** | |

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

// Auto-resolve if unanimous
{Reconciled} = COLLAPSE_WHEN_SINGLE({Raw Data})

// Show status
{Status} = IF(IS_SUPERPOSED({Reconciled}), "Needs review", "Confirmed")
```

---

## Appendix: Full Function Reference

### Creation Functions (4)
- `SUPERPOSE(value1, value2, [...])` — Basic multi-value holder
- `SUPERPOSE_IF(value1, value2, [...])` — Conditional superposition
- `WEIGHTED(value1, weight1, [...])` — With probabilities
- `SOURCED(value1, source1, [...])` — With provenance

### Inspection Functions (8)
- `IS_SUPERPOSED(value)` → boolean
- `COUNT_STATES(superposition)` → number
- `GET_STATES(superposition)` → array
- `GET_STATE(superposition, index)` → value
- `GET_WEIGHTS(superposition)` → array
- `GET_SOURCES(superposition)` → array
- `SPREAD(superposition)` → number
- `EXPECTED(superposition)` → number

### Collapse Functions (4)
- `COLLAPSE(superposition, method)` → value
- `COLLAPSE_BY_SOURCE(superposition, source_name)` → value
- `COLLAPSE_IF(superposition, condition, method)` → value|superposition
- `COLLAPSE_WHEN_SINGLE(superposition)` → value|superposition

### Combination Functions (3)
- `UNION_SUP(sup1, sup2, [...])` — All unique states
- `INTERSECT_SUP(sup1, sup2, [...])` — Common states
- `DIFF_SUP(sup1, sup2)` — Difference

### Propagation Functions (3)
- `MAP_SUP(superposition, transform)` — Apply to each
- `FILTER_SUP(superposition, predicate)` — Keep matching
- `REDUCE_SUP(superposition, reducer, initial)` — Aggregate

### Display Functions (2)
- `FORMAT_SUP(superposition, format)` → string
- `SUMMARIZE_SUP(superposition)` → string
