# EO Lake: Core Architecture

> **Canonical Reference**: All production code must align to this specification.
>
> **Scope**: This architecture operates within Projects. Each Project contains its own SOURCE → SET → LENS → VIEW hierarchy.

---

## The Core Idea

EO Lake is a data workbench built on a single principle: **raw data and interpretation must remain separate, and you must always be able to trace any conclusion back to its source.**

This comes from Emergent Ontology's distinction between:

- **GIVEN:** What actually happened. Immutable. Cannot be edited, only appended.
- **MEANT:** What you think it means. Revisable. Can be superseded, refined, discarded.

Every feature in the app maps to this distinction. The architecture enforces it so you can't accidentally launder interpretation as fact.

---

## The Four Levels

```
PROJECT
  └─ SOURCE → SET → LENS → VIEW
```

| Level | Epistemic Status | What You Can Do |
|-------|------------------|-----------------|
| **Source** | GIVEN | Look only. Immutable import origin. Always exists. |
| **Set** | GIVEN (data) + MEANT (schema) | Browse only. Flat data with typed columns. |
| **Lens** | MEANT | The data slice. Default (whole Set) or pivoted. |
| **View** | MEANT | Work here. Grid, Kanban, Calendar, Graph, Cards. |

**All four levels always exist.** Even a blank table you create from scratch has a Source (null), a Set, a Lens (default), and a View.

---

## The Quick Start Illusion

When a user clicks "New Table" and starts typing, it feels like they're just making a spreadsheet. Here's what's actually happening:

```
User clicks "New Table"
         ↓
1. NULL SOURCE created (type: manual, empty)
         ↓
2. SET created (bound to null source, empty schema)
         ↓
3. DEFAULT LENS created (pass-through, no pivot)
         ↓
4. GRID VIEW created (user lands here)
         ↓
User adds a column "Name"
         ↓
5. Source mutation: column added to null source schema
         ↓
User adds a row "Alice"
         ↓
6. Source mutation: record appended to null source
         ↓
... user keeps working, always in View,
    but every change flows back to the null Source
```

The user thinks they're editing a table. They're actually editing through a View, through a Lens, through a Set, into a Source. The architecture is always there — it's just invisible when you don't need it.

---

## Level 1: SOURCE

### What It Is

The origin of data. Always exists. A Source is either:

- **File import:** CSV, JSON, Excel uploaded
- **API sync:** External system connected
- **Scrape:** Web data captured
- **Manual/Null:** Empty origin for user-created tables

Even a blank table has a Source. It's a null Source — an empty container that receives data as the user types.

### Why It Matters

Sources are your audit trail. Every cell traces back to a Source. For imported data, that's the original file. For user-entered data, that's the null Source where their keystrokes land.

This is Rule 3 (Ineliminable): the past cannot be erased. Even "I typed this myself" is a fact about where data came from.

### What's Stored

**File import Source:**
```javascript
{
  id: "src_001",
  type: "given",
  category: "source_created",
  timestamp: "2024-12-27T14:00:00Z",
  actor: "user:michael",
  payload: {
    name: "wallace_evictions.csv",
    sourceType: "csv",
    locator: {
      filePath: "/uploads/wallace_evictions.csv",
      sha256: "a3f2b8c9..."
    },
    rawSchema: {
      columns: ["case_number", "plaintiff", "defendant", "status"],
      rowCount: 33
    }
  }
}
```

**Null Source (blank table):**
```javascript
{
  id: "src_002",
  type: "given",
  category: "source_created",
  timestamp: "2024-12-27T15:00:00Z",
  actor: "user:michael",
  payload: {
    name: "Untitled Table",
    sourceType: "null",
    locator: null,
    rawSchema: {
      columns: [],
      rowCount: 0
    }
  }
}
```

As the user adds columns and rows, mutations append to this null Source:

```javascript
// User adds "Name" column
{
  id: "evt_010",
  type: "given",
  category: "source_schema_modified",
  timestamp: "2024-12-27T15:01:00Z",
  actor: "user:michael",
  payload: {
    sourceId: "src_002",
    action: "add_column",
    column: { name: "Name", type: "text" }
  }
}

// User adds a row
{
  id: "evt_011",
  type: "given",
  category: "record_created",
  timestamp: "2024-12-27T15:02:00Z",
  actor: "user:michael",
  payload: {
    sourceId: "src_002",
    setId: "set_002",
    values: { "Name": "Alice" }
  }
}
```

### App Behavior

| Action | Result |
|--------|--------|
| Click Source in sidebar | Opens read-only preview: origin info, detected columns, raw data sample |
| File Source | Shows file name, import date, original row count |
| Null Source | Shows "Manual entry" badge, creation date, current row count |
| Edit Source directly | Not possible. Edits flow through View → Lens → Set → Source |
| Delete Source | Not possible. Can archive to hide, but data remains. |

### Sidebar Display

```
📥 SOURCES (GIVEN)
├─ 📄 wallace_evictions.csv (33 rows) — imported Dec 27
├─ 🔗 CaseLink API sync (147 rows) — synced Dec 26
├─ ✏️ My Tasks (12 rows) — manual entry
└─ ✏️ Client List (0 rows) — manual entry (empty)
```

---

## Level 2: SET

### What It Is

The flat rectangle of data with a typed schema. All columns, all records from its Source(s). A Set always binds to at least one Source.

### Why It Matters

The Set is your canonical data store. It has structure (schema) but no filtering, no pivoting. You're not yet saying "these rows are Landlords" — you're just saying "this column is a date, this column links to that other Set."

### The Relationship to Source

| Source Type | Set Behavior |
|-------------|--------------|
| File import | Set schema derived from Source columns, can rename/retype |
| API sync | Set schema maps API fields to columns |
| Null (manual) | Set schema starts empty, grows as user adds columns |

For null Sources, the Set and Source grow together. Add a column in the View, it propagates down through Lens and Set to modify the Source schema.

### What's Stored

```javascript
{
  id: "set_001",
  type: "meant",
  category: "set_created",
  timestamp: "2024-12-27T14:05:00Z",
  actor: "user:michael",
  payload: {
    name: "Evictions",
    sourceBindings: [
      { sourceId: "src_001", mapping: "direct" }
    ],
    schema: {
      fields: [
        { id: "fld_01", name: "case_number", type: "text", isPrimary: true },
        { id: "fld_02", name: "plaintiff", type: "text" },
        { id: "fld_03", name: "defendant", type: "text" },
        { id: "fld_04", name: "filing_date", type: "date" },
        { id: "fld_05", name: "status", type: "select", options: ["open", "judgment", "dismissed"] },
        { id: "fld_06", name: "property_id", type: "link", linkedSet: "set_properties" }
      ]
    }
  },
  provenance: ["src_001"]
}
```

### App Behavior

The Set is a browse-only staging area. You can look, but you can't work here.

| Action | Result |
|--------|--------|
| Click Set in sidebar | Opens Set browser: schema list + read-only data preview |
| Inline edit | Not allowed. Must be in a View. |
| Filter/sort | Not available. Must be in a View. |
| Create Lens | Primary action from here. |
| Edit schema | Opens schema editor (renames propagate to Source for null Sources) |

### Set Browser UI

```
┌─────────────────────────────────────────────────────────────────┐
│ SET: Evictions                                  [Create Lens ▾] │
│ 180 records · 6 fields · 1 source                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SCHEMA                         DATA PREVIEW                    │
│  ──────                         ────────────                    │
│  case_number (text) ●           case_number  plaintiff  status  │
│  plaintiff (text)               24-CV-1234   ACME LLC   open    │
│  defendant (text)               24-CV-1235   Jones...   judg    │
│  filing_date (date)             24-CV-1236   Smith...   open    │
│  status (select)                                                │
│  property_id (link)             Showing 10 of 180 records       │
│                                 (read-only preview)             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│            [Create Lens] to start working with this data        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Level 3: LENS

### What It Is

The data slice you're working with. A Lens is either:

- **Default:** Pass-through of the entire Set (most common)
- **Pivoted:** Filtered to a record type, grouped by a column, or extracted subset

Every View requires a Lens. The Lens defines *what data* you see. The View defines *how* you see it.

### Why Lens Always Exists

Even when you're "just looking at the Set," you're looking through the default Lens. This matters because:

1. **Consistency:** The chain is always SOURCE → SET → LENS → VIEW. No exceptions.
2. **Clarity:** "What data am I seeing?" is always answered by the Lens.
3. **Extensibility:** You can later pivot the default Lens into something more specific.

### Default Lens

When you create a Set, a default Lens is auto-created:

```javascript
{
  id: "lens_001",
  type: "meant",
  category: "lens_created",
  timestamp: "2024-12-27T14:06:00Z",
  actor: "system",
  payload: {
    name: "All Evictions",
    setId: "set_001",
    isDefault: true,
    pivot: null,                    // ← no pivot = entire Set
    includedFields: "all"
  },
  provenance: ["set_001"]
}
```

### Pivoted Lens

When you need a subset — filtering to a record type from JSON, grouping by a column, extracting linked entities:

```javascript
{
  id: "lens_002",
  type: "meant",
  category: "lens_created",
  timestamp: "2024-12-27T14:30:00Z",
  actor: "user:michael",
  payload: {
    name: "Landlords",
    setId: "set_001",
    isDefault: false,
    pivot: {
      type: "filter",
      predicate: { field: "party_type", op: "eq", value: "landlord" }
    },
    includedFields: ["fld_02", "fld_08", "fld_09"]
  },
  provenance: ["set_001"]
}
```

### Pivot Types

| Type | What It Does | Example |
|------|--------------|---------|
| **None (default)** | All records, all columns | Default Lens |
| **Filter** | Only rows matching predicate | `party_type = 'landlord'` |
| **Group** | One "row" per unique value | Group by `property_address` |
| **Extract** | Pull record type from JSON | `WHERE _type = 'Person'` |

### When You Need a Pivot

| Situation | Lens Configuration |
|-----------|-------------------|
| Clean CSV, one entity type | Default Lens (no pivot) |
| JSON dump with mixed `_type` values | Filter: `_type = 'Person'` |
| Want to see data grouped | Group by: `status` |
| Want only some columns visible | `includedFields: [...]` |

### App Behavior

| Action | Result |
|--------|--------|
| Click "Create Lens" on Set | Modal: name, pivot options, column selection |
| Click Lens in sidebar | Expands to show its Views |
| Edit Lens | Change pivot or included columns |
| Delete Lens | Only if no Views depend on it |

### Sidebar Display

```
📦 SETS (SCHEMA)
├─ Evictions (180 records)
│   └─ 🔷 All Evictions (default lens)
│   └─ 🔷 Landlords (pivot: party_type = landlord)
│   └─ 🔷 By Property (pivot: group by property_id)
└─ Tasks (45 records)
    └─ 🔷 All Tasks (default lens)
```

---

## Level 4: VIEW

### What It Is

The working environment. The visualization of a Lens. This is where you edit, filter, sort, and interact with data.

A View answers: **How do I want to see this Lens?** Grid, Kanban, Calendar, Graph, Cards.

### Why It Matters

The View is where MEANT happens. You're now interpreting the data: choosing how to display it, what to emphasize, how to interact. Every action in a View generates an event with provenance tracing back through Lens → Set → Source.

### View Types

| Type | Renderer | Best For |
|------|----------|----------|
| **Grid** | Spreadsheet rows/columns | General editing, data review |
| **Cards** | Visual cards with field preview | Contacts, properties, scanning |
| **Kanban** | Columns by status field | Workflow, task management |
| **Calendar** | Events on date grid | Scheduling, deadlines |
| **Graph** | Nodes and edges | Relationships, networks |

### What's Stored

```javascript
{
  id: "view_001",
  type: "meant",
  category: "view_created",
  timestamp: "2024-12-27T14:10:00Z",
  actor: "user:michael",
  payload: {
    name: "Evictions Grid",
    lensId: "lens_001",
    viewType: "grid",
    config: {
      visibleFields: ["fld_01", "fld_02", "fld_03", "fld_05"],
      fieldWidths: { "fld_01": 120, "fld_02": 200 },
      sort: [{ field: "fld_04", direction: "desc" }],
      rowHeight: "medium"
    }
  },
  provenance: ["lens_001"]
}
```

**Kanban config:**
```javascript
config: {
  statusField: "fld_05",
  columnOrder: ["open", "hearing", "judgment", "dismissed"],
  cardTitleField: "fld_01",
  cardPreviewFields: ["fld_02", "fld_03"]
}
```

**Graph config:**
```javascript
config: {
  linkFields: ["fld_06"],
  nodeLabel: "fld_01",
  nodeColorField: "fld_05",
  layout: "dagre"
}
```

### App Behavior

This is where all features live:

| Action | Result |
|--------|--------|
| Click View in sidebar | Opens in main content area with full features |
| Inline edit a cell | Allowed. Event created, propagates to Source. |
| Filter bar | Available. Temporary filters (not saved). |
| Sort controls | Available. Click column headers. |
| Add record | Allowed. Creates record in Source. |
| Add column | Allowed. Modifies Source schema. |
| Switch view type | Changes renderer, preserves data. |
| Reorder/resize columns | Updates View config. |

### View UI

```
┌─────────────────────────────────────────────────────────────────┐
│ 👁 Evictions Grid                   [Grid ▾] [Filter] [Sort]    │
│ Lens: All Evictions · 180 records               [⋮ View Options]│
├─────────────────────────────────────────────────────────────────┤
│ + Add filter                                                    │
├─────────────────────────────────────────────────────────────────┤
│ case_number │ plaintiff      │ defendant      │ status │ + │   │
│─────────────┼────────────────┼────────────────┼────────┼───┤   │
│ 24-CV-1234  │ ACME Holdings  │ Jane Doe       │ open   │   │   │
│ 24-CV-1235  │ Wallace LLC    │ John Smith     │ judg.  │   │   │
│ + New row   │                │                │        │   │   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Complete Data Flow

### Quick Start (New Blank Table)

```
User clicks "New Table"
         ↓
SOURCE created (null, empty)
         ↓
SET created (bound to null source, empty schema)
         ↓
LENS created (default, no pivot)
         ↓
VIEW created (Grid, user lands here)
         ↓
User adds column "Name"
         ↓
Event: source_schema_modified (column added to null source)
         ↓
User adds row "Alice"
         ↓
Event: record_created (record added to null source)
         ↓
User keeps working... all changes flow to Source
```

### File Import

```
User drops CSV file
         ↓
SOURCE created (csv, 33 rows detected)
         ↓
Modal: "Create Set from Source"
         ↓
SET created (schema from CSV columns)
         ↓
LENS created (default)
         ↓
VIEW created (Grid)
         ↓
User lands in View, ready to work
```

### Creating a Pivot

```
User has Set "CaseLink Dump" (500 records, mixed types)
         ↓
User clicks "Create Lens"
         ↓
Modal: Name it "Landlords"
       Pivot: Filter where party_type = 'landlord'
       Columns: party_name, address, phone
         ↓
LENS created (pivot stored)
         ↓
VIEW created (Grid on this Lens)
         ↓
User sees 23 records (not 500)
         ↓
Edits propagate back to Source
```

---

## Sidebar Final Structure

Within a Project, the sidebar displays:

```
📥 SOURCES (GIVEN)
│  Look only. Import origins + null sources.
│
├─ 📄 wallace_evictions.csv (33 rows)
├─ 🔗 CaseLink sync (147 rows)
└─ ✏️ My Tasks (12 rows) ← null source, manual entry

📦 SETS (SCHEMA)
│  Browse only. Flat data rectangles.
│
├─ Evictions (180 records, 1 source)
└─ Tasks (12 records, 1 null source)

🔷 LENSES (DATA SLICE)
│  Default or pivoted. What data you see.
│
├─ All Evictions (default) ← Set: Evictions
├─ Landlords (filter pivot) ← Set: Evictions
└─ All Tasks (default) ← Set: Tasks

👁 VIEWS (WORK HERE)
│  Full features. How you see it.
│
├─ Evictions Grid ← Lens: All Evictions
├─ Evictions Kanban ← Lens: All Evictions
├─ Landlords Grid ← Lens: Landlords
└─ Tasks Board ← Lens: All Tasks
```

Or nested (preferred):

```
📥 SOURCES
├─ 📄 wallace_evictions.csv
├─ 🔗 CaseLink sync
└─ ✏️ My Tasks

📦 SETS
├─ Evictions
│   ├─ 🔷 All Evictions (default)
│   │   ├─ 👁 Grid
│   │   └─ 👁 Kanban
│   └─ 🔷 Landlords (pivot)
│       └─ 👁 Grid
└─ Tasks
    └─ 🔷 All Tasks (default)
        └─ 👁 Board
```

---

## Event Store Summary

| Category | Type | When |
|----------|------|------|
| `source_created` | given | File uploaded, API connected, or null source for new table |
| `source_schema_modified` | given | Column added/renamed (especially for null sources) |
| `record_created` | given | Row imported or user adds row |
| `record_updated` | given | User edits a cell |
| `set_created` | meant | Schema defined over a Source |
| `lens_created` | meant | Default or pivoted slice of Set |
| `view_created` | meant | Visualization config for a Lens |

---

## The Chain Is Always There

```
PROJECT
  └─ SOURCE → SET → LENS → VIEW
```

No exceptions. Even the simplest "new blank table" has all four. The architecture is invisible until you need it — but it's always there, ensuring every piece of data traces back to its origin.
