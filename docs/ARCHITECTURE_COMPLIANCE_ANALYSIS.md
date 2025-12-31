# Architecture Compliance Analysis

> This document identifies gaps between the current implementation and the canonical architecture defined in `CORE_ARCHITECTURE.md`.

---

## Executive Summary

The current codebase has a **5-level hierarchy** that must be refactored to the **4-level canonical hierarchy**:

| Current | Target |
|---------|--------|
| PROJECT → WORKSPACE → SET → LENS → FOCUS → EXPORT | PROJECT → SOURCE → SET → LENS → VIEW |

**Critical Issues:**
1. **Lens/View conflation**: Current `LensConfig` contains view types (Grid, Cards) - these are separate concepts
2. **Missing default Lens auto-creation**: Sets don't auto-create a default Lens
3. **Focus layer should be absorbed**: Focus filtering belongs in View, not as a separate level
4. **Null Source not formalized**: Blank tables don't properly create null Sources
5. **Set doesn't track sourceBindings**: Missing explicit Source → Set relationship

---

## Detailed Gap Analysis

### 1. Hierarchy Level Mismatch

**Current (eo_view_hierarchy.js):**
```
ProjectConfig    → Level 0 (organizational container)
WorkspaceConfig  → Level 1 (contextual boundary)
SetConfig        → Level 2 (typed data collection)
LensConfig       → Level 3 (actually VIEW types: Grid, Cards, Kanban)
FocusConfig      → Level 4 (filtered perspective)
ExportConfig     → Level 5 (immutable capture)
```

**Required:**
```
PROJECT (wrapper - contains all below)
  └─ SOURCE       → Level 1 (GIVEN - immutable import origin)
  └─ SET          → Level 2 (data + schema)
      └─ LENS     → Level 3 (data slice: default or pivoted)
          └─ VIEW → Level 4 (visualization: Grid, Cards, Kanban, etc.)
```

**Files to modify:**
- `eo_view_hierarchy.js` - Major restructuring needed
- `eo_data_workbench.js` - UI and state management updates
- `eo_source_join.js` - Source/Set creation flow

---

### 2. Lens vs View Conflation

**Current Problem (eo_view_hierarchy.js:441-554):**
```javascript
class LensConfig {
  constructor(options) {
    this.lensType = options.lensType || LensType.GRID;  // ← This is VIEW type, not Lens
    // ...
  }
}

const LensType = Object.freeze({
  GRID: 'grid',       // These are VIEW types
  CARDS: 'cards',
  KANBAN: 'kanban',
  // ...
});
```

**Required Separation:**

**Lens (data slice):**
```javascript
class LensConfig {
  constructor(options) {
    this.id = options.id;
    this.name = options.name;
    this.setId = options.setId;
    this.isDefault = options.isDefault || false;
    this.pivot = options.pivot || null;  // null = entire Set
    this.includedFields = options.includedFields || 'all';
    this.viewIds = options.viewIds || [];  // Child views
  }
}

// Pivot types
const PivotType = Object.freeze({
  NONE: null,           // Default lens - all records
  FILTER: 'filter',     // predicate-based subset
  GROUP: 'group',       // grouped by field value
  EXTRACT: 'extract'    // record type from JSON
});
```

**View (visualization):**
```javascript
class ViewConfig {
  constructor(options) {
    this.id = options.id;
    this.name = options.name;
    this.lensId = options.lensId;
    this.viewType = options.viewType;  // Grid, Kanban, Cards, etc.
    this.config = options.config;       // view-specific settings
  }
}

const ViewType = Object.freeze({
  GRID: 'grid',
  CARDS: 'cards',
  KANBAN: 'kanban',
  CALENDAR: 'calendar',
  GRAPH: 'graph',
  TIMELINE: 'timeline'
});
```

---

### 3. Missing Default Lens Auto-Creation

**Current Problem:**
When a Set is created, no default Lens is auto-created. Users directly create "Lenses" (which are actually Views).

**Required Flow:**
```javascript
// When creating a Set:
function createSet(sourceId, name, schema) {
  const set = new SetConfig({ name, sourceBindings: [{ sourceId }], schema });

  // AUTO-CREATE default Lens
  const defaultLens = new LensConfig({
    name: `All ${name}`,
    setId: set.id,
    isDefault: true,
    pivot: null  // No pivot = entire Set
  });

  // AUTO-CREATE default View on default Lens
  const defaultView = new ViewConfig({
    name: `${name} Grid`,
    lensId: defaultLens.id,
    viewType: ViewType.GRID
  });

  return { set, defaultLens, defaultView };
}
```

**Files to modify:**
- `eo_source_join.js:SetCreator.createSetFromSource()` - Add auto-creation
- `eo_data_workbench.js:createSet()` - Add auto-creation
- `eo_view_hierarchy.js` - Add factory methods

---

### 4. Null Source Not Formalized

**Current State (eo_source_join.js:213-299):**
The `createEmptySource()` method exists but:
- Uses `origin: 'manual'` instead of `sourceType: 'null'`
- Doesn't match the event schema in CORE_ARCHITECTURE.md

**Required Event Format:**
```javascript
{
  id: "src_002",
  type: "given",
  category: "source_created",
  payload: {
    name: "Untitled Table",
    sourceType: "null",  // ← Must be "null" not "manual"
    locator: null,
    rawSchema: { columns: [], rowCount: 0 }
  }
}
```

**Files to modify:**
- `eo_source_join.js:createEmptySource()` - Update sourceType
- `eo_data_workbench.js` - Ensure "New Table" uses null Source flow

---

### 5. Set Missing sourceBindings

**Current (eo_view_hierarchy.js:347-435):**
```javascript
class SetConfig {
  constructor(options) {
    this.workspaceId = options.workspaceId || null;  // Parent workspace
    this.provenance = {
      derivedFrom: options.provenance?.derivedFrom || []  // Generic provenance
    };
    // No explicit sourceBindings
  }
}
```

**Required:**
```javascript
class SetConfig {
  constructor(options) {
    this.sourceBindings = options.sourceBindings || [];
    // sourceBindings: [{ sourceId: "src_001", mapping: "direct" }]
  }
}
```

**Files to modify:**
- `eo_view_hierarchy.js:SetConfig` - Add sourceBindings property
- `eo_source_join.js:SetCreator` - Populate sourceBindings on creation

---

### 6. Focus Should Be Absorbed into View

**Current (eo_view_hierarchy.js:560-659):**
`FocusConfig` is a separate level that applies restrictions on top of a Lens.

**Target Architecture:**
Views have their own filtering capability. Focus-level features should be View config.

**Migration:**
```javascript
// BEFORE (Focus as separate level)
class FocusConfig {
  restrictions: { filters: [], sorts: [], limit: null }
}

// AFTER (Focus absorbed into View)
class ViewConfig {
  config: {
    filters: [],      // Temporary filters (not saved to Lens)
    sorts: [],
    visibleFields: []
  }
}
```

**Files to modify:**
- `eo_view_hierarchy.js` - Remove or deprecate FocusConfig
- `eo_data_workbench.js` - Migrate Focus UI to View UI

---

### 7. Sidebar Structure Mismatch

**Current (eo_data_workbench.js / index.html):**
```
PROJECTS (ORG)
SOURCES (GIVEN)
DEFINITIONS (TERMS)
SETS (SCHEMA)
  └─ Set → Lens (View Types) → ...
EXPORTS (SNAPSHOT)
```

**Required (within a Project):**
```
SOURCES (GIVEN)
  ├─ wallace_evictions.csv
  └─ My Tasks (null source)

SETS (SCHEMA)
  └─ Evictions
      ├─ All Evictions (default lens)
      │   ├─ Grid (view)
      │   └─ Kanban (view)
      └─ Landlords (pivot lens)
          └─ Grid (view)
```

**Files to modify:**
- `index.html` - Sidebar panel structure
- `eo_data_workbench.js` - Sidebar rendering (`renderSidebar()`)

---

### 8. Event Categories Alignment

**Current (eo_event_store.js):**
Various event categories exist but don't match CORE_ARCHITECTURE.md spec.

**Required Categories:**
| Category | Type | When |
|----------|------|------|
| `source_created` | given | File uploaded, API connected, or null source |
| `source_schema_modified` | given | Column added/renamed (especially for null sources) |
| `record_created` | given | Row imported or user adds row |
| `record_updated` | given | User edits a cell |
| `set_created` | meant | Schema defined over a Source |
| `lens_created` | meant | Default or pivoted slice of Set |
| `view_created` | meant | Visualization config for a Lens |

**Files to modify:**
- `eo_event_store.js` - Ensure these categories exist
- `eo_types.js` - Add any missing event category constants

---

## Implementation Priority

### Phase 1: Core Data Model (Critical)

1. **Split LensConfig into Lens + View** (`eo_view_hierarchy.js`)
   - Create new `ViewConfig` class
   - Refactor `LensConfig` to be data-slice only
   - Rename `LensType` to `ViewType`

2. **Add sourceBindings to SetConfig** (`eo_view_hierarchy.js`)
   - Add property to class
   - Update all Set creation paths

3. **Formalize null Source** (`eo_source_join.js`)
   - Update `createEmptySource()` to use `sourceType: 'null'`

### Phase 2: Auto-Creation Flow

4. **Auto-create default Lens when Set is created** (`eo_source_join.js`, `eo_data_workbench.js`)

5. **Auto-create default View when Lens is created**

### Phase 3: UI Alignment

6. **Update sidebar to show nested structure** (`eo_data_workbench.js`)
   - Sets → Lenses → Views hierarchy

7. **Migrate Focus to View** (`eo_view_hierarchy.js`, `eo_data_workbench.js`)

### Phase 4: Event Store

8. **Align event categories** (`eo_event_store.js`, `eo_types.js`)

---

## Files Requiring Modification

| File | Priority | Changes |
|------|----------|---------|
| `eo_view_hierarchy.js` | P1 | Split Lens/View, add ViewConfig, update SetConfig |
| `eo_source_join.js` | P1 | Null source, sourceBindings, auto-creation |
| `eo_data_workbench.js` | P1-P2 | State management, sidebar, auto-creation |
| `eo_event_store.js` | P4 | Event categories |
| `eo_types.js` | P1 | ViewType enum, PivotType enum |
| `index.html` | P3 | Sidebar structure |
| `eo_ontology.js` | P2 | Align with new hierarchy |

---

## Backward Compatibility

Existing data must migrate:
1. Current `LensConfig` instances become `ViewConfig` with a parent default `LensConfig`
2. `FocusConfig` instances become saved filter presets on Views
3. Sets without sourceBindings get migration to link to their Sources

A migration script should be created to transform existing IndexedDB data.

---

## Testing Checklist

- [ ] "New Table" creates null Source → Set → default Lens → Grid View
- [ ] File import creates Source → Set → default Lens → Grid View
- [ ] Creating a Lens from Set shows pivot options
- [ ] Views can be created under any Lens
- [ ] Sidebar shows correct nesting
- [ ] All provenance chains trace back to Source
- [ ] Editing in View creates events with proper provenance
