# Design: Nested Data Normalization (JSON → Linked Set)

## Problem Statement

Nested JSON structures embedded in fields create a tension:

**As JSON in a cell:**
- Hard to query ("find all formula fields across all tables")
- No schema enforcement on nested items
- Can't relate nested items to other entities
- Editing is error-prone (manual JSON manipulation)
- No independent provenance per nested item

**As separate unlinked data:**
- Loses the parent-child relationship
- Context of "these fields belong to THIS table" is lost
- Manual joins required

**The ideal:** Nested data should be viewable *both* as embedded JSON (compact) *and* as a linked Set (queryable), with the user able to swap at will.

## The Normalization Concept

**Normalization** extracts nested JSON into a first-class Set while maintaining bidirectional links to the parent record.

```
BEFORE:
┌─────────────────────────────────────────────────────────────────┐
│ Tables Set                                                      │
├─────────────────┬───────────────────────────────────────────────┤
│ name            │ fields (JSON)                                 │
├─────────────────┼───────────────────────────────────────────────┤
│ Evictions       │ [{"name":"Client","type":"text"},{"name":...  │
│ Properties      │ [{"name":"Address","type":"text"},{"name":... │
│ Staff           │ [{"name":"Name","type":"text"},{"name":"Em... │
└─────────────────┴───────────────────────────────────────────────┘

AFTER:
┌─────────────────────────────────────────────────────────────────┐
│ Tables Set                                                      │
├─────────────────┬───────────────────────────────────────────────┤
│ name            │ fields (→ Fields Set)                         │
├─────────────────┼───────────────────────────────────────────────┤
│ Evictions       │ [Client, Case Manager, Status, ...] (6)       │
│ Properties      │ [Address, Owner, Type, ...] (4)               │
│ Staff           │ [Name, Email, Role] (3)                       │
└─────────────────┴───────────────────────────────────────────────┘
        │
        │ linked
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ Fields Set (auto-generated)                                     │
├──────────┬─────────┬──────────┬──────────────┬──────────────────┤
│ name     │ type    │ options  │ parent_table │ _provenance      │
├──────────┼─────────┼──────────┼──────────────┼──────────────────┤
│ Client   │ text    │ {req:t}  │ → Evictions  │ given_evt_001[0] │
│ Case Mgr │ link    │ {→Staff} │ → Evictions  │ given_evt_001[1] │
│ Status   │ text    │ {}       │ → Evictions  │ given_evt_001[2] │
│ Address  │ text    │ {}       │ → Properties │ given_evt_002[0] │
│ Owner    │ text    │ {}       │ → Properties │ given_evt_002[1] │
│ ...      │ ...     │ ...      │ ...          │ ...              │
└──────────┴─────────┴──────────┴──────────────┴──────────────────┘
```

### EO Alignment

This directly implements multiple EO rules:

| Rule | How Normalization Complies |
|------|---------------------------|
| **Rule 1: Distinction** | Original JSON is Given; normalized Set records are Meant |
| **Rule 3: Ineliminability** | Original JSON preserved, normalization creates NEW records |
| **Rule 7: Groundedness** | Each normalized record has `_provenance` pointing to JSON path |
| **Rule 9: Defeasibility** | Can re-normalize if schema changes; old interpretation superseded |

## Core Concepts

### 1. Normalization Event

When user triggers normalization, the system creates a **Normalization Event**:

```javascript
{
  id: "evt_norm_xxx",
  type: "meant",                    // This is an interpretation
  operation: "normalize",

  source: {
    setId: "set_tables",
    fieldId: "fld_fields",
    path: "$"                       // JSONPath to array
  },

  target: {
    setId: "set_fields",            // New or existing Set
    setName: "Fields",
    relationship: "one-to-many"     // Parent has many children
  },

  mapping: {
    // How JSON properties map to Set fields
    "name": { targetField: "fld_name", type: "text" },
    "type": { targetField: "fld_type", type: "select", options: [...] },
    "options": { targetField: "fld_options", type: "json" },
    // Auto-generated relationship field
    "_parent": { targetField: "fld_parent_table", type: "link", linkedSetId: "set_tables" }
  },

  provenance: ["given_evt_import_xxx"],  // Original import event

  createdAt: "2024-01-15T...",
  createdBy: "user_xxx"
}
```

### 2. Synchronized Views

The parent field can render in two modes:

**Embedded Mode** (default after normalization):
```
┌─────────────────────────────────────────────────────────────────┐
│ fields                                          [Embedded ▼]    │
├─────────────────────────────────────────────────────────────────┤
│ [Client] [Case Manager] [Status] [Filed Date] [Amount] [Field6]│
│ 6 linked records                               [Open Fields →]  │
└─────────────────────────────────────────────────────────────────┘
```

**Linked Mode** (expanded):
```
┌─────────────────────────────────────────────────────────────────┐
│ fields                                          [Linked ▼]      │
├─────────────────────────────────────────────────────────────────┤
│ → Fields Set (filtered: parent_table = "Evictions")             │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ name        │ type    │ options                            │  │
│ ├─────────────┼─────────┼────────────────────────────────────┤  │
│ │ Client      │ text    │ required: true                     │  │
│ │ Case Manager│ link    │ → Staff                            │  │
│ │ Status      │ text    │ —                                  │  │
│ │ ...         │ ...     │ ...                                │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                        [+ Add Field] [Open Set] │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Bidirectional Sync

Changes propagate in both directions:

**Edit in Fields Set → Update source JSON:**
```javascript
// User renames "Client" to "Client Name" in Fields Set
// System creates event:
{
  type: "meant",
  operation: "update",
  setId: "set_fields",
  recordId: "rec_client",
  changes: { name: "Client Name" },
  provenance: ["evt_norm_xxx"],     // Links to normalization

  // Sync instruction (optional, if user wants JSON updated)
  sync: {
    enabled: true,
    target: {
      setId: "set_tables",
      recordId: "rec_evictions",
      fieldId: "fld_fields",
      path: "$[0].name"
    }
  }
}
```

**Edit source JSON → Update normalized Set:**
```javascript
// User edits raw JSON in Tables Set
// System detects change, creates sync event:
{
  type: "meant",
  operation: "sync_from_source",

  source: {
    setId: "set_tables",
    recordId: "rec_evictions",
    fieldId: "fld_fields",
    changes: {
      "$[0].name": "Client Name"    // JSONPath notation
    }
  },

  target: {
    setId: "set_fields",
    recordId: "rec_client",
    changes: { name: "Client Name" }
  },

  provenance: ["evt_norm_xxx"]
}
```

### 4. Sync Modes

Users can choose sync behavior:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Bidirectional** | Changes sync both ways | Live editing, tight coupling |
| **Source → Target** | JSON edits update Set, Set edits don't affect JSON | JSON is authoritative |
| **Target → Source** | Set edits update JSON, JSON edits don't affect Set | Set is authoritative |
| **None (Snapshot)** | No sync after initial normalization | One-time extraction |

## Data Model

### Normalized Set Configuration

```javascript
{
  id: "set_fields",
  name: "Fields",

  // Mark as normalized/derived
  derivation: {
    type: "normalized",
    sourceSetId: "set_tables",
    sourceFieldId: "fld_fields",
    normalizationEventId: "evt_norm_xxx"
  },

  // Schema inferred from JSON structure
  fields: [
    {
      id: "fld_name",
      name: "name",
      type: "text",
      sourceMapping: "$.name"       // JSONPath in source
    },
    {
      id: "fld_type",
      name: "type",
      type: "select",
      options: ["text", "number", "date", "link", "formula", ...],
      sourceMapping: "$.type"
    },
    {
      id: "fld_options",
      name: "options",
      type: "json",                 // Keep nested parts as JSON
      sourceMapping: "$.options"
    },
    {
      id: "fld_parent_table",
      name: "parent_table",
      type: "link",
      linkedSetId: "set_tables",
      isBacklink: true,             // Auto-generated relationship
      sourceMapping: null           // Computed, not from JSON
    },
    {
      id: "fld_provenance",
      name: "_provenance",
      type: "text",
      system: true,                 // Hidden by default
      sourceMapping: null           // Computed: source_record[index]
    }
  ],

  // Sync configuration
  sync: {
    mode: "bidirectional",          // bidirectional | source_to_target | target_to_source | none
    autoSync: true,                 // Sync on every change vs manual
    conflictResolution: "source_wins"  // source_wins | target_wins | manual
  },

  metadata: {
    isNormalized: true,
    sourceDescription: "Extracted from 'fields' column in Tables Set",
    recordCount: 13,                // Total fields across all tables
    lastSyncedAt: "2024-01-15T..."
  }
}
```

### Parent Field After Normalization

```javascript
// The 'fields' field in Tables Set transforms:
{
  id: "fld_fields",
  name: "fields",

  // Type changes from json to link
  type: "link",
  linkedSetId: "set_fields",
  relationship: "one-to-many",

  // Original type preserved for rollback
  originalType: "json",

  // Normalization reference
  normalization: {
    eventId: "evt_norm_xxx",
    targetSetId: "set_fields",
    syncMode: "bidirectional"
  },

  // Display configuration
  displayConfig: {
    defaultMode: "chips",           // Show as chips by default
    showRawToggle: true,            // Allow viewing original JSON
    expandable: true                // Can expand to inline table
  }
}
```

### Provenance Chain

Every normalized record maintains full provenance:

```javascript
{
  id: "rec_client_field",
  setId: "set_fields",

  data: {
    name: "Client",
    type: "text",
    options: { required: true },
    parent_table: "rec_evictions"   // Link to parent record
  },

  // Full provenance chain
  provenance: {
    // Immediate source: normalization event
    directSource: {
      eventId: "evt_norm_xxx",
      type: "normalization"
    },

    // Ultimate source: original import
    rootSource: {
      eventId: "given_evt_import_xxx",
      type: "import",
      sourceFile: "airtable_export.json",
      jsonPath: "$.tables[0].fields[0]"
    },

    // Path through the system
    chain: [
      "given_evt_import_xxx",       // 1. Import (Given)
      "evt_set_create_xxx",         // 2. Create Tables Set (Meant)
      "evt_norm_xxx"                // 3. Normalize fields (Meant)
    ]
  },

  createdAt: "2024-01-15T...",
  createdBy: "user_xxx"
}
```

## UI Components

### 1. Normalization Wizard

Triggered from Field Display Modes (see DESIGN_FIELD_DISPLAY_MODES.md) or field context menu.

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ Normalize Nested Data                                   [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Source: Tables.fields (JSON array)                              │
│ Records to extract: 13 items across 3 parent records            │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ DETECTED SCHEMA                                                 │
│ ┌─────────────┬──────────┬───────────────────────────────────┐  │
│ │ JSON Key    │ Type     │ Sample Values                     │  │
│ ├─────────────┼──────────┼───────────────────────────────────┤  │
│ │ name        │ text     │ "Client", "Status", "Amount"      │  │
│ │ type        │ select   │ "text", "link", "formula" (6 vals)│  │
│ │ id          │ text     │ "fld_xxx" (unique)                │  │
│ │ options     │ json     │ {required: true}, {linkedTable...}│  │
│ └─────────────┴──────────┴───────────────────────────────────┘  │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ TARGET SET                                                      │
│ ○ Create new Set: [Fields                    ]                  │
│ ○ Add to existing Set: [Select Set... ▼]                        │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ SYNC MODE                                                       │
│ ● Bidirectional - Changes sync both ways (recommended)          │
│ ○ Source → Target - JSON is authoritative                       │
│ ○ Target → Source - Set is authoritative                        │
│ ○ Snapshot - One-time extraction, no ongoing sync               │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ ADVANCED OPTIONS                                    [Expand ▼]  │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│                              [Cancel]  [Preview]  [Normalize →] │
└─────────────────────────────────────────────────────────────────┘
```

**Advanced Options (expanded):**
```
│ ADVANCED OPTIONS                                    [Collapse ▲]│
│                                                                 │
│ Field Mapping                                                   │
│ ┌─────────────┬──────────────┬─────────────────────────────────┐│
│ │ JSON Key    │ Set Field    │ Type Override                   ││
│ ├─────────────┼──────────────┼─────────────────────────────────┤│
│ │ name        │ [name      ] │ [text ▼]                        ││
│ │ type        │ [type      ] │ [select ▼] [Edit options...]    ││
│ │ id          │ [source_id ] │ [text ▼]                        ││
│ │ options     │ [options   ] │ [json ▼] [Expand nested...]     ││
│ └─────────────┴──────────────┴─────────────────────────────────┘│
│                                                                 │
│ ☑ Add backlink field to parent (parent_table)                   │
│ ☑ Include provenance field (_provenance)                        │
│ ☐ Flatten nested 'options' object into separate fields          │
│ ☐ Keep original JSON field (as read-only backup)                │
```

### 2. Linked Field Cell Renderer

After normalization, the field renders as a relation:

```
┌─────────────────────────────────────────────────────────────────┐
│ fields                                              [⇄ Sync ✓]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ VIEW MODE: [Embedded ▼]                                         │
│                                                                 │
│ ┌────────────┐ ┌─────────────────┐ ┌────────────┐ ┌──────────┐ │
│ │ 📝 Client  │ │ 🔗 Case Manager │ │ 📝 Status  │ │ +3 more  │ │
│ └────────────┘ └─────────────────┘ └────────────┘ └──────────┘ │
│                                                                 │
│ [View All in Fields Set →]  [+ Add Field]  [View Raw JSON]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Sync indicator states:**
- `[⇄ Sync ✓]` - Bidirectional, in sync
- `[⇄ Sync ⚠]` - Bidirectional, pending changes
- `[→ Sync]` - Source to target only
- `[← Sync]` - Target to source only
- `[Snapshot]` - No sync

### 3. Inline Expanded View

Clicking "View All" or expanding:

```
┌─────────────────────────────────────────────────────────────────┐
│ fields                                              [⇄ Sync ✓]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ VIEW MODE: [Linked Table ▼]                                     │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ ┌──────────────┬─────────┬─────────────────────────────┐  │   │
│ │ │ name         │ type    │ options                      │  │   │
│ │ ├──────────────┼─────────┼─────────────────────────────┤  │   │
│ │ │ Client       │ 📝 text │ required: true               │  │   │
│ │ │ Case Manager │ 🔗 link │ → Staff (many-to-one)        │  │   │
│ │ │ Status       │ 📝 text │ —                            │  │   │
│ │ │ Filed Date   │ 📅 date │ format: MM/DD/YYYY           │  │   │
│ │ │ Amount       │ 🔢 num  │ currency: USD                │  │   │
│ │ │ Field 6      │ ⚙️ form │ =CONCAT({Client}, ...)       │  │   │
│ │ └──────────────┴─────────┴─────────────────────────────┘  │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│ [+ Add Field]  [Open in Full View →]  [↻ Re-sync]               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Cross-Set Query Interface

Once normalized, users can query across all nested data:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Query: Fields Set                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Find all fields where:                                          │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ type         │ is       │ [formula ▼]                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                               [+ Add condition] │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ RESULTS (3 formula fields across 2 tables)                      │
│ ┌──────────────┬─────────────────────┬─────────────────────────┐│
│ │ name         │ parent_table        │ formula                 ││
│ ├──────────────┼─────────────────────┼─────────────────────────┤│
│ │ Field 6      │ → Evictions         │ =CONCAT({Client}, ...)  ││
│ │ Total        │ → Evictions         │ =SUM({Amount})          ││
│ │ Full Address │ → Properties        │ =CONCAT({Street}, ...)  ││
│ └──────────────┴─────────────────────┴─────────────────────────┘│
│                                                                 │
│ [Export Results]  [Create View from Query]                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Sync Conflict Resolution

When bidirectional sync detects conflicts:

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Sync Conflict Detected                                  [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Field "Client" was modified in both locations:                  │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ SOURCE (Tables.fields JSON)     │ TARGET (Fields Set)       │ │
│ ├─────────────────────────────────┼───────────────────────────┤ │
│ │ name: "Client Name"             │ name: "Primary Client"    │ │
│ │ modified: 2024-01-15 10:30      │ modified: 2024-01-15 10:32│ │
│ │ by: alice@example.com           │ by: bob@example.com       │ │
│ └─────────────────────────────────┴───────────────────────────┘ │
│                                                                 │
│ Resolution:                                                     │
│ ○ Keep source value: "Client Name"                              │
│ ○ Keep target value: "Primary Client"                           │
│ ○ Keep both (create superposition)                              │
│ ● Merge manually: [Client Name (Primary)          ]             │
│                                                                 │
│                                         [Cancel]  [Resolve →]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**"Keep both (superposition)"** creates a superposition value per existing EO semantics—multiple interpretations coexist until resolved.

## Interaction Flows

### Flow 1: Initial Normalization

```
1. User has "Tables" Set with "fields" JSON column
2. User clicks column header → "Create Linked Set..."
   (or: uses Field Display Mode → "Linked Set" action)
3. Normalization Wizard opens
4. System auto-detects schema from JSON structure
5. User reviews/adjusts field mapping
6. User selects sync mode (default: bidirectional)
7. User clicks "Normalize"
8. System creates:
   a. Normalization event (Meant, with provenance to Given)
   b. New "Fields" Set with inferred schema
   c. Records for each JSON array item (with provenance)
   d. Backlink field in Fields Set → Tables Set
   e. Transforms "fields" field from JSON to Link type
9. UI updates: "fields" column now shows linked records
10. User can toggle between Embedded/Linked/Raw views
```

### Flow 2: Edit in Normalized Set

```
1. User opens "Fields" Set
2. User changes "Client" name to "Client Name"
3. System creates update event:
   - type: meant
   - provenance: [normalization_event, original_given]
4. If sync enabled:
   a. System updates source JSON in Tables Set
   b. Creates sync event recording the propagation
5. Both views now show "Client Name"
```

### Flow 3: Edit Source JSON

```
1. User opens "Tables" Set
2. User clicks "View Raw JSON" for fields column
3. User edits JSON directly: changes "Client" to "Primary Client"
4. System detects change via diff
5. If sync enabled:
   a. System updates corresponding record in Fields Set
   b. Creates sync event with provenance
6. Conflict possible if Fields Set was also edited
   → Conflict resolution UI if needed
```

### Flow 4: Re-normalize After Schema Change

```
1. Source JSON gains new field: "description"
2. User notices new data not appearing in Fields Set
3. User clicks "Re-sync" → "Detect Schema Changes"
4. System shows:
   - New field detected: "description" (text)
   - Suggest: Add to Fields Set schema?
5. User confirms
6. System creates:
   a. Schema update event for Fields Set
   b. Updates all records with new field values
   c. Updates normalization mapping
```

### Flow 5: Denormalization (Rollback)

```
1. User decides normalization was a mistake
2. User clicks "Denormalize" in field settings
3. System shows warning:
   - "This will convert back to JSON"
   - "Edits made in Fields Set will be preserved in JSON"
   - "Fields Set will become orphaned (not deleted)"
4. User confirms
5. System:
   a. Regenerates JSON from current Fields Set state
   b. Changes field type back to JSON
   c. Marks Fields Set as "orphaned" (can be deleted or kept)
   d. Creates denormalization event with full provenance
```

## EO Compliance Details

### Rule 1: Distinction (Given vs Meant)

```
GIVEN (immutable):
├── Import event: raw JSON as imported
│   └── {"tables": [{"fields": [...]}]}
│
MEANT (interpretations):
├── Tables Set creation
│   └── Interprets JSON as table records
├── Normalization event
│   └── Interprets fields arrays as separate records
├── Fields Set records
│   └── Each field definition as queryable record
└── Sync events
    └── Each edit propagation
```

The original JSON is never modified in the Given log. All changes create new Meant events.

### Rule 3: Ineliminability

```javascript
// When user "edits" source JSON, actually:
{
  type: "meant",
  operation: "update",
  supersedes: "previous_meant_event_id",  // Chain, not overwrite

  // Original Given still exists:
  provenance: ["given_import_event_xxx"]
}

// User can always trace back:
// Current value → Meant chain → Original Given
```

### Rule 7: Groundedness

Every normalized record includes provenance:

```javascript
{
  id: "rec_field_client",
  data: { name: "Client", type: "text" },

  provenance: {
    // JSONPath to exact source location
    sourcePath: "$.tables[0].fields[0]",
    sourceEvent: "given_import_xxx",

    // Interpretation chain
    derivedVia: [
      "evt_set_tables_create",
      "evt_normalize_fields"
    ]
  }
}
```

### Rule 9: Defeasibility

Normalizations can be superseded:

```javascript
// First normalization
{ id: "evt_norm_v1", mapping: { name: "$.name", type: "$.type" } }

// Schema changes, re-normalize
{
  id: "evt_norm_v2",
  supersedes: "evt_norm_v1",
  mapping: {
    name: "$.name",
    type: "$.type",
    description: "$.description"  // New field
  }
}
```

Users can view history: "This normalization superseded by evt_norm_v2 on 2024-01-20"

## Implementation Phases

### Phase 1: Core Normalization
- [ ] Implement NormalizationEvent data structure
- [ ] Build schema inference from JSON arrays
- [ ] Create Normalization Wizard UI
- [ ] Generate Set and records from JSON
- [ ] Add provenance tracking to normalized records
- [ ] Transform source field from JSON to Link type

### Phase 2: Linked Field Rendering
- [ ] Implement linked field cell renderer
- [ ] Add view mode toggle (Embedded/Linked/Raw)
- [ ] Build inline expanded table view
- [ ] Add sync status indicator

### Phase 3: Bidirectional Sync
- [ ] Implement source → target sync
- [ ] Implement target → source sync
- [ ] Build change detection for JSON fields
- [ ] Create sync event logging
- [ ] Add sync mode configuration

### Phase 4: Conflict Resolution
- [ ] Detect conflicting edits
- [ ] Build conflict resolution UI
- [ ] Implement superposition option
- [ ] Add manual merge interface

### Phase 5: Cross-Set Queries
- [ ] Enable queries on normalized Sets
- [ ] Build "find all X across parents" UI
- [ ] Add grouping by parent record
- [ ] Create saved query views

### Phase 6: Schema Evolution
- [ ] Detect schema changes in source JSON
- [ ] Prompt for mapping updates
- [ ] Handle field additions/removals
- [ ] Implement denormalization/rollback

## Open Questions

1. **Nested normalization depth**: If `options` itself contains arrays, allow recursive normalization?
   - *Recommendation*: Yes, but limit to 2 levels. Offer "Flatten" option for deeply nested.

2. **Large array performance**: What if a JSON field has 10,000 items?
   - *Recommendation*: Batch record creation, paginate sync, warn user about performance.

3. **Polymorphic arrays**: JSON array with mixed item schemas (some have `email`, some have `industry`)
   - *Recommendation*: Use multi-record-type detection (existing feature), create Lenses per type.

4. **Sync frequency**: Real-time sync vs batched?
   - *Recommendation*: Batch by default (every 5 seconds), option for real-time.

5. **Partial normalization**: Normalize some JSON keys but leave others embedded?
   - *Recommendation*: Yes, Advanced Options → select which keys to extract.

6. **Multiple normalizations**: Same JSON field normalized to multiple Sets?
   - *Recommendation*: Not in Phase 1. Consider for future "views" of same data.

## Related Documents

- DESIGN_FIELD_DISPLAY_MODES.md - Field rendering modes (prerequisite UI)
- DESIGN_LENS_SYSTEM.md - Lenses for polymorphic normalized records
- DESIGN_JSON_MULTI_RECORD_VIEWS.md - Multi-record type detection
