# EO Lake: Complete Architecture

> **Canonical Reference**: All production code must align to this specification.
>
> **Scope**: This architecture operates within Projects. Each Project contains its own SOURCE → SET → LENS → VIEW hierarchy with DEFINITIONS providing semantic grounding.

---

## The Core Idea

EO Lake is a data workbench built on a single principle: **raw data and interpretation must remain separate, and you must always be able to trace any conclusion back to its source.**

This comes from Emergent Ontology's distinction between:

- **GIVEN:** What actually happened. Immutable. Cannot be edited, only appended.
- **MEANT:** What you think it means. Revisable. Can be superseded, refined, discarded.

Every feature in the app maps to this distinction. The architecture enforces it so you can't accidentally launder interpretation as fact.

---

## The Six Components

```
PROJECT (container)
│
├── DEFINITION (vocabulary) ←── preferably links OUTSIDE
│         │
│         │ binds to fields
│         ↓
└── SOURCE → SET → LENS → VIEW
```

| Component | Epistemic Status | What It Is |
|-----------|------------------|------------|
| **Project** | MEANT | Organizational container. Scopes everything else. |
| **Source** | GIVEN | Immutable import origin. Always exists. |
| **Definition** | MEANT | Vocabulary for semantic grounding. Best when external. |
| **Set** | GIVEN (data) + MEANT (schema) | Flat data with typed columns. |
| **Lens** | MEANT | Data slice. Default (whole Set) or pivoted. |
| **View** | MEANT | Visualization. Where you work. |

**All components exist within a Project.** Even a blank table has a Project containing a Source (null), a Set, Definitions available to bind, a Lens (default), and a View.

---

## Component 0: PROJECT

### What It Is

The organizational container. A Project scopes Sources, Definitions, Sets, Lenses, and Views into a coherent workspace. Everything lives inside a Project.

### Why It Matters

Projects define boundaries. A journalism investigation is one Project. A client engagement is another. Projects answer: **What belongs together?**

### What's Stored

```javascript
{
  id: "proj_001",
  type: "meant",
  category: "project_created",
  timestamp: "2024-12-27T10:00:00Z",
  actor: "user:michael",
  payload: {
    name: "Wallace Studios Investigation",
    description: "Eviction patterns at Wallace-owned properties"
  }
}
```

### App Behavior

| Action | Result |
|--------|--------|
| Create Project | Modal: name, description |
| Switch Project | All sidebar panels update to show that Project's contents |
| Archive Project | Hides from list, data preserved |

### Sidebar Display

```
┌─────────────────────────────────────────────────────────────────┐
│ 📁 Wallace Studios Investigation                         [▾]   │
└─────────────────────────────────────────────────────────────────┘
```

Everything below is scoped to this Project.

---

## Component 1: SOURCE

### What It Is

The origin of data. Always exists. A Source is either:

- **File import:** CSV, JSON, Excel uploaded
- **API sync:** External system connected
- **Scrape:** Web data captured
- **Manual/Null:** Empty origin for user-created tables

Even a blank table has a Source — a null Source that receives data as the user types.

### Why It Matters

Sources are your audit trail. Every cell traces back to a Source. This is Rule 3 (Ineliminable): the past cannot be erased.

### What's Stored

**File import Source:**
```javascript
{
  id: "src_001",
  type: "given",
  category: "source_created",
  projectId: "proj_001",
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
  projectId: "proj_001",
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

### App Behavior

| Action | Result |
|--------|--------|
| Click Source in sidebar | Opens read-only preview |
| Edit Source directly | Not possible. Edits flow through View → Lens → Set → Source |
| Delete Source | Not possible. Can archive, but data remains. |

### Sidebar Display

```
📥 SOURCES (GIVEN)
├─ 📄 wallace_evictions.csv (33 rows)
├─ 🔗 CaseLink sync (147 rows)
└─ ✏️ My Tasks (12 rows)
```

---

## Component 2: DEFINITION

### What It Is

A vocabulary that provides semantic grounding for your data. Definitions give meaning to your columns beyond their structural type.

### Why Definitions Should Link Outside (When Possible)

Here's the philosophical point that shapes the design: **a dataset gains meaning by connecting to something beyond itself.**

Think of Gödel: a formal system cannot fully define itself from within. Applied to data: if your only definition of "plaintiff" is "the data in the plaintiff column," you have a circle. Real meaning comes from linking to shared understanding outside your dataset.

**This doesn't mean external URIs are required.** You can absolutely create your own definitions. But when you link to Wikidata, QUDT, or Schema.org:

- Others can understand your data without asking you
- Your exports carry meaning with them
- You're joining a shared vocabulary instead of inventing your own
- Future you remembers what past you meant

**Design implications:**

| Principle | Design Choice |
|-----------|---------------|
| External is better | URI field is prominent, with search/suggestions |
| Custom is allowed | "Create custom term" always available |
| Linking is encouraged | When user types a term, suggest matching URIs |
| Never block | User can skip URI, but sees gentle nudge |

### Definition Types

| Type | URI | Example |
|------|-----|---------|
| **External (preferred)** | From standard ontology | `http://qudt.org/vocab/unit/USD` |
| **Custom with namespace** | Your own URI space | `https://groundtruth.nashville.gov/vocab/eviction_status#open` |
| **Custom local** | No URI (discouraged but allowed) | Just a label and description |

### What's Stored

**External Definition (linked to URI):**
```javascript
{
  id: "def_001",
  type: "meant",
  category: "definition_created",
  projectId: "proj_001",
  timestamp: "2024-12-27T13:00:00Z",
  actor: "user:michael",
  payload: {
    name: "QUDT Currency Units",
    uri: "http://qudt.org/vocab/unit/",
    sourceType: "external",
    terms: [
      { id: "USD", label: "US Dollar", uri: "http://qudt.org/vocab/unit/USD" },
      { id: "EUR", label: "Euro", uri: "http://qudt.org/vocab/unit/EUR" }
    ]
  }
}
```

**Custom Definition with namespace:**
```javascript
{
  id: "def_002",
  type: "meant",
  category: "definition_created",
  projectId: "proj_001",
  timestamp: "2024-12-27T13:05:00Z",
  actor: "user:michael",
  payload: {
    name: "Eviction Case Status",
    uri: "https://groundtruth.nashville.gov/vocab/eviction_status",
    sourceType: "custom",
    terms: [
      { id: "open", label: "Open", uri: "...#open", description: "Case filed, no judgment" },
      { id: "judgment_plaintiff", label: "Judgment for Plaintiff", uri: "...#judgment_plaintiff" },
      { id: "dismissed", label: "Dismissed", uri: "...#dismissed" }
    ]
  }
}
```

**Custom Definition without URI (allowed but flagged):**
```javascript
{
  id: "def_003",
  type: "meant",
  category: "definition_created",
  projectId: "proj_001",
  timestamp: "2024-12-27T13:10:00Z",
  actor: "user:michael",
  payload: {
    name: "My Status Codes",
    uri: null,                              // ← no URI
    sourceType: "local",
    terms: [
      { id: "active", label: "Active", description: "Currently in progress" },
      { id: "done", label: "Done", description: "Completed" }
    ]
  }
}
```

**Binding (field → definition term):**
```javascript
{
  id: "bind_001",
  type: "meant",
  category: "semantic_binding_created",
  projectId: "proj_001",
  timestamp: "2024-12-27T14:30:00Z",
  actor: "user:michael",
  payload: {
    setId: "set_evictions",
    fieldId: "fld_06",
    definitionId: "def_qudt_currency",
    termId: "USD"
  },
  provenance: ["set_evictions", "def_qudt_currency"]
}
```

### App Behavior

| Action | Result |
|--------|--------|
| Import Definition | Search Wikidata/QUDT/Schema.org, or paste URI |
| Create custom Definition | Modal: name, optional URI namespace, terms |
| No URI provided | Allowed, but shows hint: "Add a URI to make this shareable" |
| Bind field to Definition | In schema editor: pick Definition + term |
| Type in field editor | Autocomplete suggests matching terms from known ontologies |

### URI Encouragement UX

When creating a custom Definition without URI:

```
┌─────────────────────────────────────────────────────────────────┐
│ CREATE DEFINITION                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Name: [Case Status                    ]                        │
│                                                                 │
│  URI (optional):  [                                    ]        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 💡 Adding a URI makes your vocabulary shareable and     │   │
│  │    linkable. Try: https://yoursite.com/vocab/case_status│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Terms:                                                         │
│  ├─ open: "Case filed, no judgment"                            │
│  ├─ closed: "Case resolved"                                    │
│  └─ [+ Add term]                                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                               [Cancel]  [Create Definition]     │
└─────────────────────────────────────────────────────────────────┘
```

When typing a field name that matches a known term:

```
┌─────────────────────────────────────────────────────────────────┐
│ Field name: [amount                    ]                        │
│             ┌───────────────────────────────────────┐           │
│             │ 💡 Suggested bindings:                │           │
│             │    📐 qudt:USD (US Dollar)            │           │
│             │    📐 qudt:EUR (Euro)                 │           │
│             │    🌐 schema:MonetaryAmount           │           │
│             │    ─────────────────────              │           │
│             │    📋 Create custom definition...     │           │
│             └───────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### Sidebar Display

```
📖 MEANING (Definitions)
├─ 🌐 Wikidata Entities 🔗
├─ 📐 QUDT Units 🔗
├─ ⚖️ Schema.org Types 🔗
├─ 📋 Eviction Status 🔗
└─ 📋 My Status Codes ⚠️ (local only — no URI)
```

**Key Visual Indicators:**
- 🔗 = Linked to external URI (preferred)
- ⚠️ = Local only — works here but won't carry meaning elsewhere

---

## Component 3: SET

### What It Is

The flat rectangle of data with a typed schema. All columns, all records from its Source(s). A Set always binds to at least one Source, and its fields can optionally bind to Definitions.

### Why It Matters

The Set is your canonical data store. It has structure (schema) but work doesn't happen here. The schema has two layers:

**Structural:** Column names, data types, which Sources feed it.

**Semantic:** Definition bindings — what the columns mean.

### What's Stored

```javascript
{
  id: "set_001",
  type: "meant",
  category: "set_created",
  projectId: "proj_001",
  timestamp: "2024-12-27T14:05:00Z",
  actor: "user:michael",
  payload: {
    name: "Evictions",
    sourceBindings: [
      { sourceId: "src_001", mapping: "direct" }
    ],
    schema: {
      fields: [
        {
          id: "fld_01",
          name: "case_number",
          type: "text",
          isPrimary: true
        },
        {
          id: "fld_02",
          name: "plaintiff",
          type: "text",
          semanticBinding: {
            definitionId: "def_schema_org",
            termId: "Organization"
          }
        },
        {
          id: "fld_05",
          name: "status",
          type: "select",
          options: ["open", "hearing", "judgment_plaintiff", "dismissed"],
          semanticBinding: {
            definitionId: "def_eviction_status",
            termId: null  // bound to whole vocabulary
          }
        },
        {
          id: "fld_06",
          name: "judgment_amount",
          type: "number",
          semanticBinding: {
            definitionId: "def_qudt_currency",
            termId: "USD"
          }
        }
      ]
    }
  },
  provenance: ["src_001"]
}
```

### App Behavior

The Set is a browse-only staging area.

| Action | Result |
|--------|--------|
| Click Set in sidebar | Opens Set browser: schema + read-only data preview |
| Inline edit | Not allowed. Must be in a View. |
| Filter/sort | Not available. Must be in a View. |
| Create Lens | Primary action from here. |
| Edit schema | Opens schema editor: types, bindings, relationships |

### Set Browser UI

```
┌─────────────────────────────────────────────────────────────────┐
│ SET: Evictions                                  [Create Lens ▾] │
│ 180 records · 6 fields · 1 source · 4 bindings                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SCHEMA                         DATA PREVIEW                    │
│  ──────                         ────────────                    │
│  case_number (text) ●           case_number  plaintiff  status  │
│  plaintiff (text) 🌐            24-CV-1234   ACME LLC   open    │
│  defendant (text)               24-CV-1235   Jones...   judg    │
│  filing_date (date)             24-CV-1236   Smith...   open    │
│  status (select) 📋                                             │
│  judgment_amount (number) 📐    Showing 10 of 180 records       │
│                                 (read-only preview)             │
│                                                                 │
│  🌐 = Schema.org  📋 = custom vocab  📐 = QUDT                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│            [Create Lens] to start working with this data        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component 4: LENS

### What It Is

The data slice you're working with. A Lens is either:

- **Default:** Pass-through of the entire Set (most common)
- **Pivoted:** Filtered to a record type, grouped by a column, or extracted subset

Every View requires a Lens. The Lens defines *what data* you see. The View defines *how* you see it.

### Why Lens Always Exists

Even when you're "just looking at the Set," you're looking through the default Lens. The chain is always SOURCE → SET → LENS → VIEW.

### Default Lens

When you create a Set, a default Lens is auto-created:

```javascript
{
  id: "lens_001",
  type: "meant",
  category: "lens_created",
  projectId: "proj_001",
  timestamp: "2024-12-27T14:06:00Z",
  actor: "system",
  payload: {
    name: "All Evictions",
    setId: "set_001",
    isDefault: true,
    pivot: null,
    includedFields: "all"
  },
  provenance: ["set_001"]
}
```

### Pivoted Lens

When you need a subset:

```javascript
{
  id: "lens_002",
  type: "meant",
  category: "lens_created",
  projectId: "proj_001",
  timestamp: "2024-12-27T14:30:00Z",
  actor: "user:michael",
  payload: {
    name: "Landlords",
    setId: "set_caselink_dump",
    isDefault: false,
    pivot: {
      type: "filter",
      predicate: { field: "party_type", op: "eq", value: "landlord" }
    },
    includedFields: ["fld_02", "fld_08", "fld_09"]
  },
  provenance: ["set_caselink_dump"]
}
```

### Pivot Types

| Type | What It Does | Example |
|------|--------------|---------|
| **None (default)** | All records, all columns | Default Lens |
| **Filter** | Only rows matching predicate | `party_type = 'landlord'` |
| **Group** | One "row" per unique value | Group by `property_address` |
| **Extract** | Pull record type from JSON | `WHERE _type = 'Person'` |

### App Behavior

| Action | Result |
|--------|--------|
| Click "Create Lens" on Set | Modal: name, pivot options, column selection |
| Click Lens in sidebar | Expands to show its Views |
| Edit Lens | Change pivot or included columns |

### Sidebar Display

```
🔷 LENSES (DATA SLICE)
├─ All Evictions (default)
├─ Landlords (filter)
└─ By Property (group)
```

---

## Component 5: VIEW

### What It Is

The working environment. The visualization of a Lens. This is where you edit, filter, sort, and interact with data.

A View answers: **How do I want to see this Lens?**

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
  projectId: "proj_001",
  timestamp: "2024-12-27T14:10:00Z",
  actor: "user:michael",
  payload: {
    name: "Evictions Grid",
    lensId: "lens_001",
    viewType: "grid",
    config: {
      visibleFields: ["fld_01", "fld_02", "fld_03", "fld_05", "fld_06"],
      fieldWidths: { "fld_01": 120, "fld_02": 200 },
      sort: [{ field: "fld_04", direction: "desc" }],
      rowHeight: "medium"
    }
  },
  provenance: ["lens_001"]
}
```

### App Behavior

This is where all features live:

| Action | Result |
|--------|--------|
| Click View in sidebar | Opens in main content area with full features |
| Inline edit | Allowed. Event created, propagates to Source. |
| Filter bar | Available. Temporary filters. |
| Sort controls | Available. Click column headers. |
| Add record | Allowed. Creates record in Source. |
| Add column | Allowed. Modifies Source schema. |
| Bind column to Definition | Allowed. Suggestions appear, custom allowed. |
| Switch view type | Changes renderer, preserves data. |

### View UI

```
┌─────────────────────────────────────────────────────────────────┐
│ 👁 Evictions Grid                   [Grid ▾] [Filter] [Sort]    │
│ Lens: All Evictions · Set: Evictions · 180 records              │
├─────────────────────────────────────────────────────────────────┤
│ + Add filter                                                    │
├─────────────────────────────────────────────────────────────────┤
│ case_number │ plaintiff 🌐   │ status 📋     │ amount 📐 │ + │  │
│─────────────┼────────────────┼───────────────┼───────────┼───┤  │
│ 24-CV-1234  │ ACME Holdings  │ open          │ —         │   │  │
│ 24-CV-1235  │ Wallace LLC    │ judgment_plt  │ $5,000    │   │  │
│ + New row   │                │               │           │   │  │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Quick Start Flow

When a user clicks "New Table" and starts typing:

```
User clicks "New Table"
         ↓
1. NULL SOURCE created (type: manual, empty)
         ↓
2. SET created (bound to null source, empty schema)
         ↓
3. DEFAULT LENS created (pass-through)
         ↓
4. GRID VIEW created (user lands here)
         ↓
User adds column "Amount"
         ↓
5. Source mutation: column added
         ↓
App suggests: "💡 Bind to qudt:USD?"
         ↓
User accepts (or skips)
         ↓
6. DEFINITION BINDING created (or not)
         ↓
User adds row "$5,000"
         ↓
7. Source mutation: record appended
         ↓
... user keeps working in View
```

---

## Complete Data Flow

### File Import

```
User drops CSV file into Project
         ↓
SOURCE created (csv, 33 rows)
         ↓
Modal: "Create Set from Source"
         ↓
SET created (schema from CSV columns)
         ↓
System suggests Definition bindings:
  - "plaintiff" → schema:Organization?
  - "amount" → qudt:USD?
         ↓
User accepts some, skips others, creates custom for "status"
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
Modal: Name "Landlords"
       Pivot: Filter where party_type = 'landlord'
       Columns: party_name, address, phone
         ↓
LENS created (pivot stored)
         ↓
VIEW created (Grid)
         ↓
User sees 23 records (not 500)
         ↓
Edits propagate back to Source
```

---

## Sidebar Final Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ 📁 Wallace Studios Investigation                         [▾]   │
└─────────────────────────────────────────────────────────────────┘

📥 SOURCES (GIVEN)
├─ 📄 wallace_evictions.csv (33 rows)
├─ 🔗 CaseLink sync (147 rows)
└─ ✏️ Notes (12 rows)

📖 MEANING (Definitions)
├─ 🌐 Wikidata Entities 🔗
├─ 📐 QUDT Units 🔗
├─ ⚖️ Schema.org Types 🔗
├─ 📋 Eviction Status 🔗
└─ 📋 My Tags ⚠️ (local)

📦 SETS (SCHEMA)
├─ Evictions (180 records) 📖 4/6
│   └─ Meaning: plaintiff 🌐, status 📋, amount 📐
├─ Properties (12 records) 📖 2/4
│   └─ Meaning: address 🌐, value 📐
└─ Notes (12 records) 📖 0/3
    └─ No bindings yet

🔷 LENSES (DATA SLICE)
├─ All Evictions (default)
├─ Landlords (filter)
├─ All Properties (default)
└─ All Notes (default)

👁 VIEWS (WORK HERE)
├─ Evictions Grid
├─ Evictions Kanban
├─ Landlords Grid
├─ Property Cards
└─ Notes List
```

Or nested by relationship:

```
📁 Wallace Studios Investigation

📥 SOURCES (GIVEN)
├─ 📄 wallace_evictions.csv
└─ 🔗 CaseLink sync

📖 MEANING (Definitions)
├─ 🌐 Wikidata 🔗
├─ 📐 QUDT 🔗
└─ 📋 Eviction Status 🔗

📦 SETS (SCHEMA)
├─ Evictions (180 records) 📖 4/6
│   ├─ Meaning: plaintiff 🌐, status 📋, amount 📐
│   ├─ 🔷 All Evictions (default)
│   │   ├─ 👁 Grid
│   │   └─ 👁 Kanban
│   └─ 🔷 Landlords (filter)
│       └─ 👁 Grid
└─ Properties (12 records)
    └─ 🔷 All Properties (default)
        └─ 👁 Cards
```

---

## Event Store Summary

| Category | Type | When |
|----------|------|------|
| `project_created` | meant | User creates new project |
| `source_created` | given | File uploaded, API connected, or null for new table |
| `source_schema_modified` | given | Column added/renamed |
| `record_created` | given | Row imported or user adds row |
| `record_updated` | given | User edits a cell |
| `definition_created` | meant | Vocabulary imported or custom created |
| `semantic_binding_created` | meant | Field bound to Definition term |
| `set_created` | meant | Schema defined over a Source |
| `lens_created` | meant | Default or pivoted slice of Set |
| `view_created` | meant | Visualization config for a Lens |

---

## The Full Chain

```
PROJECT (container)
│
├── DEFINITION ←───────────────────────┐
│      (vocabulary, preferably linked) │ binds to fields
│                                      ↓
└── SOURCE ────→ SET ────→ LENS ────→ VIEW
     (raw)    (flat +      (slice)   (work here)
               schema)
       ↑          ↑           ↑           ↑
     GIVEN    GIVEN+MEANT   MEANT       MEANT
```

---

## Summary Table

| Component | Type | What It Is | Features |
|-----------|------|------------|----------|
| **Project** | MEANT | Container | Scopes everything |
| **Source** | GIVEN | Import origin | Look only |
| **Definition** | MEANT | Vocabulary (preferably external) | Import, create, bind |
| **Set** | GIVEN + MEANT | Flat data + typed schema | Browse only |
| **Lens** | MEANT | Data slice | Filter, group, extract |
| **View** | MEANT | Visualization | Full editing |

The chain is always: **PROJECT** containing **SOURCE → SET → LENS → VIEW**, with **DEFINITIONS** binding to Set fields.

Work happens in Views. Everything else is source material (Sources, Sets), semantic grounding (Definitions), or data slicing (Lenses).
