# Power Query & Power Pivot: EO Operator Mapping & Implementation Strategy

This document maps Microsoft Power Query and Power Pivot capabilities to Noema's EO (Expression Operator) system, identifying what can be recreated using existing operators and what needs to be built.

---

## Executive Summary

**Good News**: Noema's EO architecture is philosophically superior to Power Query/Power Pivot in several ways:
- Full provenance tracking (Power Query has none)
- Superposition support for multi-value uncertainty (Power Query collapses)
- Epistemically-grounded type system (Given/Meant/Derived distinction)
- Query folding equivalent through operator chain validation

**Gap Analysis**:
| Category | Power Query/Pivot | Noema EO | Coverage |
|----------|------------------|----------|----------|
| Data Connectors | 100+ | 4 (CSV, JSON, Excel, ICS) | ~4% |
| Row Operations | ~25 transforms | 18 operators | ~80% |
| Column Operations | ~30 transforms | Via TRANSFORM + formulas | ~70% |
| Aggregations | ~15 functions | 9 aggregations | ~90% |
| Time Intelligence | ~20 DAX functions | 6 date functions | ~30% |
| Visual Builder | Power Query Editor | Canvas + Data Flow | ~60% |

---

## Part 1: Power Query Capabilities → EO Mapping

### 1.1 Data Connectors (SOURCE_GIVEN / INS Operator)

#### Currently Supported
```
Power Query          → EO Equivalent
─────────────────────────────────────
Excel files          → noema_import.js (Excel parser)
CSV files            → noema_import.js (CSV parser)
JSON files           → noema_import.js (JSON parser)
iCalendar (.ics)     → noema_import.js (ICS parser)
```

#### Needed Connectors (Priority Order)

**Tier 1 - Essential (Build First)**
| Connector | EO Implementation Strategy |
|-----------|---------------------------|
| **SQL Databases** | New `SOURCE_SQL` operator with connection pooling |
| **REST APIs** | New `SOURCE_API` operator with auth handling |
| **SharePoint/OneDrive** | Via REST API connector + OAuth |
| **Google Sheets** | Via REST API connector + OAuth |

**Tier 2 - High Value**
| Connector | EO Implementation Strategy |
|-----------|---------------------------|
| **PostgreSQL/MySQL** | Extend SOURCE_SQL with dialect adapters |
| **Parquet files** | Columnar format support in import.js |
| **OData feeds** | REST API with OData query building |
| **PDF extraction** | New parser in import.js |

**Tier 3 - Enterprise**
| Connector | Notes |
|-----------|-------|
| Snowflake, BigQuery, Databricks | Cloud data warehouse connectors |
| Salesforce, Dynamics 365 | CRM-specific APIs |
| Azure Blob, S3, Data Lake | Cloud storage |

#### Proposed Connector Architecture
```javascript
// noema_connectors.js - New file
const ConnectorRegistry = {
  // Each connector implements standard interface
  register(name, {
    connect: async (config) => connection,
    query: async (connection, params) => data,
    schema: async (connection) => fields,
    testConnection: async (config) => boolean
  })
};

// Maps to existing EO
// INS ⊕ → Assert existence of external data
// DES ⊙ → Name the resulting Set
```

---

### 1.2 Row Operations → EO Operators

| Power Query Transform | EO Operator | Implementation Status |
|----------------------|-------------|----------------------|
| **Filter Rows** | `FILTER` / `SEG ⊘` | ✅ Exists |
| **Remove Duplicates** | `DEDUPE` step | ✅ Exists (pipeline) |
| **Keep Top N** | `LIMIT` | ✅ Exists |
| **Remove Errors** | `FILTER` + error predicate | ✅ Composable |
| **Group By** | `AGGREGATE` / `SYN ≡` | ✅ Exists |
| **Sort Rows** | `SORT` step | ✅ Exists (pipeline) |
| **Append Queries** | `MERGE` step | ✅ Exists |
| **Keep Range** | `FILTER` with index | ⚠️ Need row index |
| **Remove Alternating Rows** | `FILTER` with modulo | ⚠️ Need row index |
| **Transpose** | New `TRANSPOSE` operator | ❌ Build |
| **Reverse Rows** | New `REVERSE` operator | ❌ Build |

#### Row Index Enhancement
```javascript
// Add to noema_operators.js
// New technical operator mapping to ALT (alternate world state)
{
  name: 'INDEX',
  class: 'SHAPE',
  canonic: 'ALT',
  description: 'Add row index as field',
  params: {
    field_name: { type: 'string', default: '__row_index' },
    start_from: { type: 'number', default: 0 }
  }
}
```

---

### 1.3 Column Operations → EO Operators

| Power Query Transform | EO Operator(s) | Status |
|----------------------|----------------|--------|
| **Select Columns** | `SELECT` | ✅ Exists |
| **Remove Columns** | `SELECT` (inverse) | ✅ Composable |
| **Rename Columns** | `RENAME` | ✅ Exists |
| **Duplicate Column** | `TRANSFORM` + copy | ✅ Composable |
| **Add Column from Examples** | AI-assisted `COMPUTE` | 🔮 Future |
| **Custom Column** | `COMPUTE` | ✅ Exists |
| **Conditional Column** | `COMPUTE` + IF formula | ✅ Composable |
| **Index Column** | `INDEX` operator | ⚠️ Build |
| **Split Column (delimiter)** | `TRANSFORM` + SPLIT formula | ✅ Exists |
| **Split Column (positions)** | `TRANSFORM` + substring | ✅ Exists |
| **Merge Columns** | `TRANSFORM` + CONCAT | ✅ Exists |
| **Pivot Column** | New `PIVOT` operator | ❌ Build |
| **Unpivot Columns** | New `UNPIVOT` operator | ❌ Build |
| **Fill Down/Up** | New `FILL` operator | ❌ Build |
| **Replace Values** | `TRANSFORM` + REPLACE | ✅ Exists |
| **Replace Errors** | `TRANSFORM` + IFERROR | ⚠️ Need IFERROR |
| **Change Type** | `TRANSFORM` + type cast | ⚠️ Need cast functions |

#### Critical Missing: Pivot/Unpivot Operators
```javascript
// PIVOT: Convert rows to columns (SEG + ALT combination)
{
  name: 'PIVOT',
  class: 'SHAPE',
  canonic: ['SEG', 'ALT'],  // Segments by attribute, alternates structure
  description: 'Reshape from long to wide format',
  params: {
    attribute_column: { type: 'string', required: true },
    value_column: { type: 'string', required: true },
    aggregate_function: { type: 'enum', values: ['SUM','AVG','COUNT','FIRST'] }
  }
}

// UNPIVOT: Convert columns to rows (opposite reshape)
{
  name: 'UNPIVOT',
  class: 'SHAPE',
  canonic: 'ALT',
  description: 'Reshape from wide to long format',
  params: {
    columns_to_unpivot: { type: 'array', required: true },
    attribute_column_name: { type: 'string', default: 'Attribute' },
    value_column_name: { type: 'string', default: 'Value' }
  }
}
```

---

### 1.4 Merge & Join Operations → CON Operator

Power Query merge types map directly to the existing `JOIN` operator:

| Power Query Merge | EO JOIN Type | Conflict Policy |
|-------------------|--------------|-----------------|
| **Left Outer** | `LEFT` | `EXPOSE_ALL` |
| **Right Outer** | `RIGHT` | `EXPOSE_ALL` |
| **Full Outer** | `FULL` | `EXPOSE_ALL` |
| **Inner** | `INNER` | `EXPOSE_ALL` |
| **Left Anti** | `LEFT_ANTI` | N/A |
| **Right Anti** | `RIGHT_ANTI` | N/A |
| **Fuzzy Merge** | `LEFT` + normalization | ✅ Exists (noema_pipeline.js) |

#### Existing Fuzzy Match Support
From `noema_pipeline.js`:
```javascript
// Already implemented!
const NormalizationFunctions = {
  lowercase: (val) => String(val).toLowerCase(),
  removeSpaces: (val) => String(val).replace(/\s+/g, ''),
  removeSpecialChars: (val) => String(val).replace(/[^a-zA-Z0-9]/g, ''),
  // ... etc
};

// Fuzzy similarity already available
function similarityScore(str1, str2) {
  // Levenshtein-based similarity
}
```

**Enhancement Needed**: Expose fuzzy merge threshold in UI
```javascript
// Add to JOIN operator params
fuzzy_match: {
  enabled: { type: 'boolean', default: false },
  threshold: { type: 'number', min: 0, max: 1, default: 0.8 },
  normalization: { type: 'array', items: ['lowercase', 'removeSpaces', ...] }
}
```

---

### 1.5 Query Folding → Operator Chain Optimization

Power Query's "query folding" pushes operations to data source. EO equivalent:

```javascript
// noema_query_folding.js - New capability
class QueryFolder {
  constructor(connection) {
    this.connection = connection;
    this.foldableOperators = ['FILTER', 'SELECT', 'AGGREGATE', 'LIMIT', 'SORT'];
  }

  // Analyze operator chain for foldable segments
  analyze(operatorChain) {
    const segments = [];
    let currentSegment = { operators: [], foldable: true };

    for (const op of operatorChain) {
      if (this.foldableOperators.includes(op.name) && this.connection.supports(op)) {
        currentSegment.operators.push(op);
      } else {
        if (currentSegment.operators.length > 0) {
          segments.push(currentSegment);
        }
        currentSegment = { operators: [op], foldable: false };
      }
    }

    return segments;
  }

  // Generate native query (SQL, etc.) from foldable segment
  fold(segment) {
    if (!segment.foldable) return null;
    return this.connection.generateQuery(segment.operators);
  }
}
```

**Visual Indicator** (like Power Query's folding indicators):
```javascript
// In Canvas UI, show folding status per step
const FoldingIndicator = {
  FOLDED: '⚡',      // Executes at source
  LOCAL: '💻',       // Executes locally
  PARTIAL: '⚡💻'    // Split execution
};
```

---

## Part 2: Power Pivot / DAX → EO Mapping

### 2.1 Data Modeling Features

| Power Pivot Feature | EO Equivalent | Status |
|--------------------|---------------|--------|
| **Relationships** | `LINK` operator | ✅ Exists |
| **Star Schema** | Multiple LINKs | ✅ Composable |
| **Hierarchies** | DES with path notation | ⚠️ Need hierarchy support |
| **Calculated Columns** | `COMPUTE` → derived_value | ✅ Exists |
| **Measures** | `AGGREGATE` → derived_value | ✅ Exists |
| **KPIs** | COMPUTE + threshold logic | ⚠️ Need KPI framework |
| **Perspectives** | SEG for visibility | ✅ Composable |

#### Hierarchy Support
```javascript
// New capability for drill-down hierarchies
const HierarchyDefinition = {
  name: 'Date Hierarchy',
  levels: [
    { name: 'Year', expression: 'YEAR([Date])' },
    { name: 'Quarter', expression: 'QUARTER([Date])' },
    { name: 'Month', expression: 'MONTH([Date])' },
    { name: 'Day', expression: '[Date]' }
  ],
  // Maps to DES operator for naming each level
  // Maps to SEG operator for drill-down filtering
};
```

---

### 2.2 DAX Functions → EO Formula Functions

#### Aggregation Functions (SYN ≡)

| DAX Function | EO Formula | Status |
|-------------|------------|--------|
| `SUM(column)` | `SUM(field)` | ✅ Exists |
| `SUMX(table, expr)` | `SUM(MAP(set, expr))` | ✅ Composable |
| `AVERAGE(column)` | `AVERAGE(field)` | ✅ Exists |
| `AVERAGEX(table, expr)` | `AVERAGE(MAP(set, expr))` | ✅ Composable |
| `COUNT(column)` | `COUNT(field)` | ✅ Exists |
| `COUNTX(table, expr)` | `COUNT(MAP(set, expr))` | ✅ Composable |
| `DISTINCTCOUNT(column)` | `COUNTA(UNIQUE(field))` | ⚠️ Need UNIQUE |
| `MIN(column)` | `MIN(field)` | ✅ Exists |
| `MAX(column)` | `MAX(field)` | ✅ Exists |
| `MEDIAN(column)` | `MEDIAN(field)` | ✅ Exists |
| `RANKX(table, expr)` | New `RANK` function | ❌ Build |
| `PERCENTILE(column, k)` | New `PERCENTILE` function | ❌ Build |

#### Time Intelligence Functions (ALT Δ)

| DAX Function | EO Operator | Status |
|-------------|-------------|--------|
| `TOTALYTD(expr, date)` | `ASOF` + `BETWEEN` + `AGGREGATE` | ⚠️ Build helper |
| `TOTALQTD(expr, date)` | `ASOF` + `BETWEEN` + `AGGREGATE` | ⚠️ Build helper |
| `TOTALMTD(expr, date)` | `ASOF` + `BETWEEN` + `AGGREGATE` | ⚠️ Build helper |
| `SAMEPERIODLASTYEAR(date)` | `DATEADD(date, -1, 'year')` | ✅ Exists |
| `DATEADD(date, n, interval)` | `DATEADD(date, n, interval)` | ✅ Exists |
| `PARALLELPERIOD(date, n, interval)` | New formula function | ❌ Build |
| `DATESYTD(date)` | `BETWEEN` with year start | ⚠️ Build helper |
| `DATESINPERIOD(date, n, interval)` | `BETWEEN` + `DATEADD` | ✅ Composable |

**Time Intelligence Helper Library**:
```javascript
// noema_time_intelligence.js - New file

// YTD - Year to Date
function TOTALYTD(expression, dateField, options = {}) {
  const yearStart = options.fiscalYearEnd
    ? calculateFiscalYearStart(dateField, options.fiscalYearEnd)
    : `DATE(YEAR(${dateField}), 1, 1)`;

  // Decomposes to: BETWEEN (ALT) + AGGREGATE (SYN)
  return {
    operator: 'AGGREGATE',
    params: {
      expression,
      filter: `${dateField} >= ${yearStart} AND ${dateField} <= TODAY()`
    }
  };
}

// Period-over-Period comparison
function CALCULATE_YOY(measure, dateField) {
  return {
    current: measure,
    prior: `CALCULATE(${measure}, DATEADD(${dateField}, -1, 'year'))`,
    change: `(${measure} - CALCULATE(${measure}, DATEADD(${dateField}, -1, 'year'))) /
             CALCULATE(${measure}, DATEADD(${dateField}, -1, 'year'))`
  };
}

// Rolling periods
function ROLLING(expression, dateField, periods, interval) {
  // Uses BETWEEN operator (ALT Δ)
  return {
    operator: 'AGGREGATE',
    params: {
      expression,
      filter: `${dateField} >= DATEADD(TODAY(), -${periods}, '${interval}')
               AND ${dateField} <= TODAY()`
    }
  };
}
```

#### Filter Context Functions (CALCULATE equivalent)

DAX's `CALCULATE` is its most powerful function - it modifies filter context. EO mapping:

```javascript
// CALCULATE decomposes to SEG (scope visibility) + operator execution
function CALCULATE(expression, ...filters) {
  return {
    operator: 'COMPUTE',
    canonic: 'SEG',  // Modify visibility scope
    params: {
      expression,
      context_filters: filters,
      // Key insight: filters modify which records the expression sees
    }
  };
}

// Examples:
// CALCULATE(SUM(Sales[Amount]), Product[Category] = "Bikes")
// → SEG by Category=Bikes, then AGGREGATE SUM

// ALL() removes filters - maps to removing SEG
// ALLEXCEPT() keeps some filters
// KEEPFILTERS() preserves existing context
```

**Proposed Filter Context System**:
```javascript
// noema_filter_context.js - New capability

class FilterContext {
  constructor(baseFilters = []) {
    this.filters = baseFilters;
  }

  // CALCULATE - add/modify filters
  calculate(expression, ...modifiers) {
    const newContext = this.clone();
    for (const mod of modifiers) {
      if (mod.type === 'FILTER') {
        newContext.filters.push(mod.predicate);
      } else if (mod.type === 'ALL') {
        newContext.filters = newContext.filters.filter(f =>
          !mod.tables.includes(f.table)
        );
      } else if (mod.type === 'ALLEXCEPT') {
        newContext.filters = newContext.filters.filter(f =>
          mod.keepColumns.includes(f.column)
        );
      }
    }
    return this.evaluate(expression, newContext);
  }

  // Maps to SEG operator
  toOperator() {
    return {
      name: 'FILTER',
      canonic: 'SEG',
      params: { predicates: this.filters }
    };
  }
}
```

---

### 2.3 Table Manipulation Functions

| DAX Function | EO Equivalent | Status |
|-------------|---------------|--------|
| `SUMMARIZE(table, groupBy, ...)` | `AGGREGATE` with grouping | ✅ Exists |
| `SUMMARIZECOLUMNS(...)` | Enhanced `AGGREGATE` | ⚠️ Extend |
| `ADDCOLUMNS(table, ...)` | `COMPUTE` + `TRANSFORM` | ✅ Composable |
| `SELECTCOLUMNS(table, ...)` | `SELECT` + `RENAME` | ✅ Composable |
| `FILTER(table, condition)` | `FILTER` | ✅ Exists |
| `TOPN(n, table, orderBy)` | `SORT` + `LIMIT` | ✅ Composable |
| `UNION(table1, table2)` | `MERGE` step | ✅ Exists |
| `INTERSECT(table1, table2)` | `JOIN` INNER | ✅ Exists |
| `EXCEPT(table1, table2)` | `JOIN` LEFT_ANTI | ✅ Exists |
| `CROSSJOIN(table1, table2)` | New `CROSS_JOIN` | ❌ Build |
| `GENERATE(table1, table2expr)` | Iterator pattern | ❌ Build |
| `GENERATESERIES(start, end, incr)` | New `SERIES` operator | ❌ Build |
| `TREATAS(values, column)` | Virtual relationship | ❌ Build |

---

## Part 3: Visual Interface Mapping

### 3.1 Power Query Editor → Noema Canvas

| PQ Editor Component | Noema Equivalent | Enhancement Needed |
|--------------------|------------------|-------------------|
| **Queries Pane** | Canvas node list | ✅ Exists |
| **Data Preview** | Preview in inspector | ✅ Exists |
| **Applied Steps** | Pipeline steps | ✅ Exists |
| **Formula Bar** | Code view toggle | ⚠️ Add EOQL display |
| **Column Headers** | Grid view | ⚠️ Add type indicators |
| **Column Quality** | New profiling panel | ❌ Build |
| **Column Distribution** | New histogram component | ❌ Build |
| **Transform Ribbon** | Node palette | ✅ Exists |

#### Data Profiling Enhancement
```javascript
// noema_data_profiling.js - New capability

class DataProfiler {
  profile(set) {
    return {
      rowCount: set.records.length,
      columns: set.fields.map(field => ({
        name: field.name,
        type: field.type,
        // Quality metrics
        quality: {
          valid: this.countValid(set, field),
          error: this.countErrors(set, field),
          empty: this.countEmpty(set, field),
          validPercent: (valid / rowCount * 100).toFixed(1)
        },
        // Distribution metrics
        distribution: {
          distinct: this.countDistinct(set, field),
          unique: this.countUnique(set, field),  // appear exactly once
          min: this.getMin(set, field),
          max: this.getMax(set, field),
          histogram: this.buildHistogram(set, field, 10)
        }
      }))
    };
  }

  // Visual rendering
  renderProfileBar(column) {
    // Green = valid, Red = error, Gray = empty
    return `<div class="profile-bar">
      <span class="valid" style="width:${column.quality.validPercent}%"></span>
      <span class="error" style="width:${column.quality.errorPercent}%"></span>
      <span class="empty" style="width:${column.quality.emptyPercent}%"></span>
    </div>`;
  }
}
```

---

### 3.2 Power Pivot Views → Noema Views

| Power Pivot View | Noema Equivalent | Status |
|-----------------|------------------|--------|
| **Data View** | Grid component | ✅ Exists |
| **Diagram View** | Data Flow canvas | ✅ Exists |
| **Calculation Area** | Formula editor | ⚠️ Enhance |
| **Relationship Lines** | Connection arrows | ✅ Exists |
| **Measure Grid** | New component | ❌ Build |

#### Measure Grid Component
```javascript
// noema_measure_grid.js - New component

class MeasureGrid {
  constructor(container) {
    this.measures = [];
    this.container = container;
  }

  addMeasure(definition) {
    const measure = {
      id: generateId(),
      name: definition.name,
      expression: definition.expression,
      format: definition.format || 'General',
      folder: definition.folder || 'Measures',
      // EO decomposition
      operators: this.decompose(definition.expression)
    };
    this.measures.push(measure);
    this.render();
  }

  // Show measures in Excel-like calculation area
  render() {
    return `
      <div class="measure-grid">
        ${this.measures.map(m => `
          <div class="measure-cell" data-id="${m.id}">
            <span class="measure-name">${m.name}</span>
            <span class="measure-formula">${m.expression}</span>
            <span class="measure-operators">${m.operators.map(o => o.symbol).join(' ')}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
}
```

---

## Part 4: Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Core missing operators for data reshaping

| Item | Priority | EO Operators Used |
|------|----------|-------------------|
| `PIVOT` operator | P0 | SEG + ALT |
| `UNPIVOT` operator | P0 | ALT |
| `INDEX` operator | P0 | ALT |
| `FILL` operator (fill down/up) | P1 | ALT |
| `TRANSPOSE` operator | P2 | ALT |

### Phase 2: Aggregation & Analytics (Weeks 3-4)
**Goal**: DAX-equivalent calculation power

| Item | Priority | EO Operators Used |
|------|----------|-------------------|
| `RANK` formula function | P0 | SYN |
| `PERCENTILE` formula function | P0 | SYN |
| `UNIQUE` / `DISTINCT` functions | P0 | SYN |
| Time intelligence library | P0 | ALT + BETWEEN + AGGREGATE |
| Filter context system (CALCULATE) | P1 | SEG + compute chain |
| Window functions (running totals) | P1 | ALT + SYN |

### Phase 3: Connectors (Weeks 5-8)
**Goal**: Enterprise data source support

| Item | Priority | EO Operators Used |
|------|----------|-------------------|
| SQL connector framework | P0 | INS + DES |
| PostgreSQL adapter | P0 | SOURCE_SQL |
| MySQL adapter | P1 | SOURCE_SQL |
| REST API connector | P0 | INS + DES |
| OAuth flow support | P0 | (infrastructure) |
| Query folding engine | P1 | Optimizer layer |

### Phase 4: Visual Enhancements (Weeks 9-10)
**Goal**: Power Query Editor parity

| Item | Priority | Component |
|------|----------|-----------|
| Data profiling panel | P0 | New component |
| Column quality indicators | P0 | Grid enhancement |
| Distribution histograms | P1 | Chart component |
| Formula bar with EOQL | P1 | Editor enhancement |
| Folding indicators | P2 | Canvas enhancement |

### Phase 5: Advanced Features (Weeks 11-12)
**Goal**: Power Pivot parity

| Item | Priority | Notes |
|------|----------|-------|
| Hierarchy definitions | P1 | Drill-down support |
| Measure library | P1 | Reusable calculations |
| KPI framework | P2 | Thresholds + indicators |
| Calculation groups | P3 | DAX 2020+ feature |

---

## Part 5: EO Advantage - Features Power Query CAN'T Do

### 5.1 Superposition (SUP ∥) - Multi-Value Fields

Power Query forces single values. EO preserves uncertainty:

```javascript
// When merging conflicting data sources
// Power Query: Pick first/last, lose information
// EO: Preserve both with SUPERPOSE

// Example: Two sources disagree on customer address
const merged = JOIN(source1, source2, {
  on: 'customer_id',
  conflict_policy: 'SUPERPOSE'  // Not available in Power Query!
});

// Result: address field contains SUPERPOSED values
// { customer_id: 123, address: SUPERPOSE("123 Main St", "456 Oak Ave") }

// Later collapse when decision made
COLLAPSE(address, 'latest')  // or 'weighted', 'by_source', etc.
```

### 5.2 Full Provenance (REC ←)

Power Query has no lineage tracking. EO records everything:

```javascript
// Every transformation records grounding
const transformed = TRANSFORM(set, {
  expression: 'CONCAT(first_name, " ", last_name)',
  target_field: 'full_name'
});

// Can trace any value
TRACE(record.full_name)
// → Returns: {
//   derivation: [
//     { operator: 'TRANSFORM', params: {...}, timestamp: ... },
//     { operator: 'SOURCE_GIVEN', source: 'customers.csv', row: 42 }
//   ],
//   groundingChain: [...references to original data...]
// }
```

### 5.3 Temporal Operators (ASOF, BETWEEN)

Power Query has no native time-travel. EO built for it:

```javascript
// View data as it existed at a point in time
ASOF(set, '2024-01-15', { mode: 'WORLD_STATE' })

// Compare states across time
BETWEEN(set, '2024-01-01', '2024-03-31', { mode: 'EVENT_TIME' })

// Power Query would require complex date filtering
// EO makes it semantic and queryable
```

### 5.4 Epistemic Types (Given/Meant/Derived)

Power Query treats all data the same. EO distinguishes:

```javascript
// GIVEN: Original imported data (immutable)
// MEANT: Human interpretation, views, insights
// DERIVED_VALUE: Computed aggregates (never embedded in Meant)

// This prevents the common BI mistake of storing aggregates as facts
// AGGREGATE always produces derived_value, enforced by type system
```

---

## Part 6: On-Demand Operator Generation

### Dynamic Operator Composition

For custom Power Query M-code patterns, generate EO equivalents:

```javascript
// noema_operator_composer.js

class OperatorComposer {
  // Parse Power Query M and generate EO chain
  fromMCode(mCode) {
    const ast = parseMCode(mCode);
    return this.translateAST(ast);
  }

  translateAST(node) {
    switch(node.type) {
      case 'Table.SelectRows':
        return { operator: 'FILTER', canonic: 'SEG', params: node.predicate };
      case 'Table.Group':
        return { operator: 'AGGREGATE', canonic: 'SYN', params: node.grouping };
      case 'Table.Join':
        return { operator: 'JOIN', canonic: 'CON', params: node.joinSpec };
      // ... etc
    }
  }

  // Generate custom operator from template
  createCustomOperator(template) {
    return {
      name: template.name,
      class: template.class,
      canonic: template.mapToCanonic(),  // Must map to 9 operators
      params: template.params,
      execute: (input, params) => {
        // Compose from existing operators
        let result = input;
        for (const step of template.steps) {
          result = this.executeOperator(step.operator, result, step.params);
        }
        return result;
      }
    };
  }
}
```

### Example: Creating a "Remove Duplicates by Key" Composite Operator

```javascript
// User wants Power Query's "Remove Duplicates" but keeping first occurrence

const RemoveDuplicatesByKey = OperatorComposer.createCustomOperator({
  name: 'DEDUPE_BY_KEY',
  class: 'RESTRICTIVE',
  canonic: ['SEG', 'SYN'],  // Segments groups, synthesizes to one
  params: {
    key_fields: { type: 'array', required: true },
    keep: { type: 'enum', values: ['first', 'last'], default: 'first' }
  },
  steps: [
    { operator: 'AGGREGATE', params: {
        groupBy: '${key_fields}',
        aggregations: [{ field: '*', function: '${keep}' }]
    }}
  ]
});

// Register for use
OperatorRegistry.register(RemoveDuplicatesByKey);
```

---

## Appendix: Complete EO ↔ Power Query/DAX Mapping Table

| Power Query/DAX | EO Operator | Canonic | Status |
|-----------------|-------------|---------|--------|
| Get Data | SOURCE_GIVEN | INS ⊕ | ✅ |
| Filter Rows | FILTER | SEG ⊘ | ✅ |
| Remove Columns | SELECT | DES ⊙ | ✅ |
| Rename Columns | RENAME | DES ⊙ | ✅ |
| Custom Column | COMPUTE | ALT Δ | ✅ |
| Group By | AGGREGATE | SYN ≡ | ✅ |
| Merge Queries | JOIN | CON ⊗ | ✅ |
| Append Queries | MERGE step | INS ⊕ | ✅ |
| Sort | SORT step | ALT Δ | ✅ |
| Remove Duplicates | DEDUPE step | SYN ≡ | ✅ |
| Pivot | PIVOT | SEG + ALT | ❌ Build |
| Unpivot | UNPIVOT | ALT Δ | ❌ Build |
| Fill Down | FILL | ALT Δ | ❌ Build |
| Transpose | TRANSPOSE | ALT Δ | ❌ Build |
| CALCULATE | FilterContext | SEG ⊘ | ⚠️ Build |
| TOTALYTD | TimeIntel lib | ALT + SYN | ⚠️ Build |
| RANKX | RANK function | SYN ≡ | ❌ Build |
| Relationships | LINK | CON ⊗ | ✅ |
| Hierarchies | Hierarchy def | DES + SEG | ⚠️ Build |
| KPIs | KPI framework | compute chain | ❌ Build |
| Error handling | NUL operator | NUL ∅ | ✅ |
| Parameters | Query params | ALT Δ | ✅ |
| Query folding | Optimizer | meta-layer | ❌ Build |

---

## Conclusion

Noema's EO architecture provides a philosophically richer foundation than Power Query/Power Pivot. The 9 canonical operators (INS, DES, SEG, CON, SYN, ALT, SUP, REC, NUL) map cleanly to Power Query transformations while adding capabilities Microsoft's tools lack (superposition, provenance, temporal operators).

**Immediate priorities**:
1. Add PIVOT/UNPIVOT operators (most requested reshaping)
2. Build time intelligence library (business-critical for reporting)
3. Implement SQL connector framework (access enterprise data)
4. Add data profiling UI (quality visibility)

The existing 18 technical operators + 150 formula functions + canvas UI provide ~70% coverage of Power Query capabilities. With the additions outlined above, Noema can achieve feature parity while maintaining its epistemological advantages.
