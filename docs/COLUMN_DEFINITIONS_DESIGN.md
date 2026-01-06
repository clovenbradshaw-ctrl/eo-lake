# Column Definitions Design

## Overview

When data reaches the Set (interpretation) level, every column/key needs a definition. Definitions should:
1. Be referenceable via URI or manually created
2. Exist as a **record type** that can be reused and pivoted
3. Be managed at the Set level (like Airtable's "Manage Fields")

---

## Core Principle

> **Definitions are records, not metadata.**

Instead of storing column meanings as hidden metadata, they exist as **records in a "Definitions" Set**. This enables:
- Table/Cards view of all definitions
- Filtering by jurisdiction, role, status, domain
- Linking from fields to definition records
- Usage analytics (which fields use which definitions)
- Governance workflows (draft → review → stable)

---

## Architecture

### Three Cooperating Subsystems

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DEFINITIONS SET                               │
│  (Records = SchemaSemantic objects stored as a pivotable dataset)   │
│                                                                      │
│  Records can be viewed in table, cards, filtered by jurisdiction    │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ references
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                    FIELD → DEFINITION BINDINGS                       │
│         (ColumnBinding links field.id to definition record.id)       │
│                                                                      │
│  Stored on InterpretationBinding per Set                            │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ attached to
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                           DATA SETS                                  │
│              (User's data with fields that need definitions)         │
│                                                                      │
│  Set.fields → each field can have a definition_id                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### 1. Definition Record (stored in Definitions Set)

Each definition is a **record** with these fields:

```javascript
{
  // Identity
  id: "def_abc123",                      // Record ID
  uri: "eo://schema/column/surface_air_temperature/v1", // Semantic URI

  // Core meaning
  term: "surface_air_temperature",       // Canonical term (slug-like)
  label: "Surface Air Temperature",      // Human-readable label
  definition: "Air temperature measured 2m above ground...",

  // Classification
  role: "quantity",                      // quantity|property|identifier|temporal|spatial|categorical|textual
  status: "stable",                      // draft|provisional|stable|deprecated|protected

  // EO 9-Element Provenance
  jurisdiction: "WMO",                   // Authority context
  scale: "site",                         // site|region|global|system|variable
  timeframe: "instantaneous",            // instantaneous|period|snapshot|persistent|open-ended
  background: ["sensor_height_2m", "shielded"], // Assumed conditions

  // Matching
  aliases: ["temp", "air_temp", "t2m"],  // For suggestion engine
  domain_hints: ["meteorology", "climate"], // Domain context

  // External alignments
  external_uris: [                       // Links to authoritative sources
    "https://www.wikidata.org/entity/Q11466",
    "http://qudt.org/vocab/quantitykind/AirTemperature"
  ],

  // Units (for QUDT alignment)
  unit_uri: "http://qudt.org/vocab/unit/DEG_C",
  quantity_kind: "Temperature",

  // Usage tracking
  usage_count: 47,                       // How many fields use this
  last_used: "2025-01-28",

  // Audit
  created_by: "user@example.com",
  created_at: "2024-06-15T10:30:00Z",
  updated_by: "admin@example.com",
  updated_at: "2025-01-20T14:22:00Z"
}
```

### 2. Field Extension (on Set.fields)

Each field gains a `definition_id` linking to a Definition record:

```javascript
{
  id: "fld_xyz",
  name: "temperature",
  type: "NUMBER",

  // NEW: Link to definition record
  definition_id: "def_abc123",           // Links to Definition record

  // Binding metadata (inline for quick access)
  binding: {
    confidence: "high",                  // high|medium|low|provisional
    method: "manual_binding",            // How it was bound
    bound_at: "2025-01-28T09:15:00Z",
    bound_by: "user@example.com"
  }
}
```

### 3. Definitions Set (System Set)

A special system set that stores all definitions:

```javascript
{
  id: "set_definitions",
  name: "Column Definitions",
  icon: "ph-book-open",
  isSystemSet: true,                     // Cannot be deleted

  fields: [
    { id: "fld_term", name: "Term", type: "TEXT", isPrimary: true },
    { id: "fld_label", name: "Label", type: "TEXT" },
    { id: "fld_definition", name: "Definition", type: "LONG_TEXT" },
    { id: "fld_role", name: "Role", type: "SELECT", options: {
      choices: [
        { id: "quantity", name: "Quantity", color: "blue" },
        { id: "property", name: "Property", color: "purple" },
        { id: "identifier", name: "Identifier", color: "green" },
        { id: "temporal", name: "Temporal", color: "orange" },
        { id: "spatial", name: "Spatial", color: "cyan" },
        { id: "categorical", name: "Categorical", color: "pink" },
        { id: "textual", name: "Textual", color: "gray" }
      ]
    }},
    { id: "fld_status", name: "Status", type: "SELECT", options: {
      choices: [
        { id: "draft", name: "Draft", color: "gray" },
        { id: "provisional", name: "Provisional", color: "yellow" },
        { id: "stable", name: "Stable", color: "green" },
        { id: "deprecated", name: "Deprecated", color: "red" },
        { id: "protected", name: "Protected", color: "blue" }
      ]
    }},
    { id: "fld_jurisdiction", name: "Jurisdiction", type: "SELECT" },
    { id: "fld_scale", name: "Scale", type: "SELECT" },
    { id: "fld_timeframe", name: "Timeframe", type: "SELECT" },
    { id: "fld_aliases", name: "Aliases", type: "MULTI_SELECT" },
    { id: "fld_external_uris", name: "External URIs", type: "JSON" },
    { id: "fld_usage_count", name: "Usage Count", type: "ROLLUP" }
  ],

  views: [
    { id: "view_all", name: "All Definitions", type: "table" },
    { id: "view_by_role", name: "By Role", type: "kanban", config: { groupBy: "fld_role" }},
    { id: "view_by_status", name: "By Status", type: "kanban", config: { groupBy: "fld_status" }},
    { id: "view_by_jurisdiction", name: "By Jurisdiction", type: "table", config: { groups: ["fld_jurisdiction"] }}
  ]
}
```

---

## UX Flow

### 1. Right Panel States

```
┌─────────────────────────────────────────────────────────────────────┐
│ SELECTION                      │ RIGHT PANEL SHOWS                  │
├────────────────────────────────┼────────────────────────────────────┤
│ Record selected                │ Record details (existing)          │
│ View selected                  │ View configuration (existing)      │
│ Set (master) selected          │ Interpretation + Field Manager     │
│ Definition record selected     │ Definition details + usage         │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Set-Level Panel (when Set master is selected)

```
┌──────────────────────────────────────────────────────────────────┐
│ ╔══════════════════════════════════════════════════════════════╗ │
│ ║  SET: Weather Observations                              [×]  ║ │
│ ╠══════════════════════════════════════════════════════════════╣ │
│ ║                                                              ║ │
│ ║  INTERPRETATION PARAMETERS                           [Edit]  ║ │
│ ║  ┌────────────────────────────────────────────────────────┐  ║ │
│ ║  │ Jurisdiction: WMO                                      │  ║ │
│ ║  │ Scale: site                                            │  ║ │
│ ║  │ Timeframe: observation                                 │  ║ │
│ ║  │ Source Set: weather_stations_raw                       │  ║ │
│ ║  │ Agent: user@example.com                                │  ║ │
│ ║  └────────────────────────────────────────────────────────┘  ║ │
│ ║                                                              ║ │
│ ║  ─────────────────────────────────────────────────────────   ║ │
│ ║                                                              ║ │
│ ║  FIELD DEFINITIONS                           [+ Add Field]   ║ │
│ ║  ┌────────────────────────────────────────────────────────┐  ║ │
│ ║  │ ┌──────────────────────────────────────────────────┐   │  ║ │
│ ║  │ │ ▸ station_id              [●] Identifier          │   │  ║ │
│ ║  │ │   Linked: Station Identifier (stable)             │   │  ║ │
│ ║  │ └──────────────────────────────────────────────────┘   │  ║ │
│ ║  │ ┌──────────────────────────────────────────────────┐   │  ║ │
│ ║  │ │ ▸ temperature             [○] Quantity            │   │  ║ │
│ ║  │ │   Linked: Surface Air Temperature (stable)        │   │  ║ │
│ ║  │ └──────────────────────────────────────────────────┘   │  ║ │
│ ║  │ ┌──────────────────────────────────────────────────┐   │  ║ │
│ ║  │ │ ▸ humidity                [○] Quantity            │   │  ║ │
│ ║  │ │   Linked: Relative Humidity (stable)              │   │  ║ │
│ ║  │ └──────────────────────────────────────────────────┘   │  ║ │
│ ║  │ ┌──────────────────────────────────────────────────┐   │  ║ │
│ ║  │ │ ▸ custom_metric           [!] Undefined           │   │  ║ │
│ ║  │ │   ○ Search definitions  ○ Create new              │   │  ║ │
│ ║  │ └──────────────────────────────────────────────────┘   │  ║ │
│ ║  └────────────────────────────────────────────────────────┘  ║ │
│ ║                                                              ║ │
│ ║  Coverage: 3/4 fields defined (75%)                          ║ │
│ ╚══════════════════════════════════════════════════════════════╝ │
└──────────────────────────────────────────────────────────────────┘
```

### 3. Field Definition Workflow

When user clicks on an undefined field:

```
┌─────────────────────────────────────────────────────────────────────┐
│  DEFINE: custom_metric                                         [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─ SUGGESTED DEFINITIONS ─────────────────────────────────────────┐ │
│  │                                                                  │ │
│  │  ● Metric (count) - stable                           [Use]      │ │
│  │    Generic measurement or KPI                                    │ │
│  │    Jurisdiction: internal | Scale: variable                      │ │
│  │                                                                  │ │
│  │  ○ Custom Metric (property) - provisional            [Use]      │ │
│  │    User-defined measurement                                      │ │
│  │    Jurisdiction: internal | Scale: system                        │ │
│  │                                                                  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─ OR CREATE NEW ─────────────────────────────────────────────────┐ │
│  │                                                                  │ │
│  │  Term: [custom_metric____________]                               │ │
│  │  Label: [Custom Metric___________]                               │ │
│  │  Definition: [___________________]                               │ │
│  │                                                                  │ │
│  │  Role: [● Quantity ○ Property ○ Identifier ○ ...]               │ │
│  │                                                                  │ │
│  │  Jurisdiction: [internal_______▾]                                │ │
│  │  Scale: [system_____________▾]                                   │ │
│  │  Timeframe: [variable_________▾]                                 │ │
│  │                                                                  │ │
│  │  Aliases: [metric, kpi, measure] + [Add]                        │ │
│  │                                                                  │ │
│  │                              [Create & Link]                     │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─ OR LINK EXTERNAL URI ──────────────────────────────────────────┐ │
│  │                                                                  │ │
│  │  URI: [https://www.wikidata.org/entity/Q____]                   │ │
│  │                                                         [Fetch]  │ │
│  │                                                                  │ │
│  │  When fetched, will create local definition wrapping this URI   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Suggestion Engine

### Pipeline (per field)

```
┌─────────────────────────────────────────────────────────────────────┐
│ INPUT: field.name = "temp", field.type = NUMBER                     │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Local Registry Lookup (O(1))                                │
│                                                                      │
│   Normalize: "temp" → "temp"                                        │
│   Exact match: ✗                                                    │
│   Alias match: ✓ "temp" → Surface Air Temperature                   │
│   Score: 0.9                                                        │
│                                                                      │
│   → RETURN EARLY if score ≥ 0.8                                     │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ (only if no strong local match)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: External Discovery (Wikidata/QUDT)                          │
│                                                                      │
│   Query wbsearchentities for "temp"                                 │
│   Filter: keep only quantities/properties                            │
│   Discard: patents, papers, sensors, methods                        │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Ranking                                                      │
│                                                                      │
│   +0.4  exact/alias name match                                      │
│   +0.25 unit consistency (QUDT)                                     │
│   +0.15 domain match                                                │
│   +0.10 prior local usage                                           │
│   −0.30 if role ≠ quantity/property                                 │
│                                                                      │
│   Return top 5                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Definitions Set Infrastructure
- [ ] Create system "Definitions" Set on workspace init
- [ ] Migrate existing SchemaSemantic objects to Definition records
- [ ] Add `definition_id` field to Set.fields schema
- [ ] Create views: All, By Role, By Status, By Jurisdiction

### Phase 2: Set-Level Field Manager UI
- [ ] Detect when Set (not View) is selected
- [ ] Render Interpretation Parameters section in right panel
- [ ] Render Field Definitions list showing all fields
- [ ] Show definition status per field (linked, undefined, draft)
- [ ] Calculate and display coverage percentage

### Phase 3: Definition Binding Workflow
- [ ] "Define Field" modal with suggestion engine
- [ ] Search existing definitions with fuzzy matching
- [ ] Create new definition form with EO provenance
- [ ] External URI fetcher (Wikidata lookup)
- [ ] Link/unlink definition from field

### Phase 4: Suggestion Engine
- [ ] Local registry lookup (fast path)
- [ ] External API integration (Wikidata, QUDT)
- [ ] Candidate filtering (remove non-semantic results)
- [ ] Ranking algorithm with usage boosting

### Phase 5: Governance & Analytics
- [ ] Definition status workflow (draft → review → stable)
- [ ] Usage tracking (which fields use which definitions)
- [ ] Definition provenance warnings (incomplete 9-element)
- [ ] Bulk definition operations

---

## Key Rules (for implementer)

1. **Local registry first, always** - Never hit external APIs for repeat lookups
2. **External APIs are discovery only** - Results wrap into local definitions
3. **Never bind automatically** - All bindings require user confirmation
4. **Never embed meaning in datasets** - Meaning lives in Definitions Set
5. **Every chosen URI becomes reusable** - External URIs create local records
6. **Filtering is mandatory** - Discard patents, papers, methods from suggestions
7. **Explain why a suggestion exists** - Show match source (alias, usage, external)

---

## Questions to Resolve

1. **Multi-version definitions**: How to handle when a field is linked to v1 but v2 exists?
2. **Definition sharing across workspaces**: Federated definitions registry?
3. **Conflicting definitions**: Same term, different meanings in different jurisdictions?
4. **Bulk operations**: Define 50 fields at once from CSV mapping file?

---

## Related Files

- `noema_schema_semantic.js` - Current SchemaSemantic implementation (will become Definition record source)
- `noema_interpretation_binding.js` - InterpretationBinding & ColumnBinding classes
- `noema_data_workbench.js` - Main UI (add Set-level panel, Field Manager)
