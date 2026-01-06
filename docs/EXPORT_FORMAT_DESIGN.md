# noema Export Format Design

## Overview

noema's export system provides granular control over what data to export, enabling use cases from full system backup to lightweight data sharing. The design follows EO principles: exports are **Given** events that preserve provenance and enable reconstruction.

---

## Export Scope Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                     MASTER ARCHIVE                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    WORKSPACE                               │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                     SET                              │  │  │
│  │  │  ┌────────────────────────────────────────────────┐ │  │  │
│  │  │  │                   VIEW                          │ │  │  │
│  │  │  │  ┌──────────────────────────────────────────┐  │ │  │  │
│  │  │  │  │              SELECTION                    │  │ │  │  │
│  │  │  │  └──────────────────────────────────────────┘  │ │  │  │
│  │  │  └────────────────────────────────────────────────┘ │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Cross-cutting concerns (can be included/excluded at any scope):
  ├── Definitions (Schema Semantics + Interpretation Bindings)
  ├── History (Event Log subset)
  ├── Activity (Operator applications)
  ├── Ghosts (Deleted artifacts)
  └── Sources (Original import data)
```

---

## Export Types

### 1. Master Archive Export
**Purpose**: Complete backup enabling full system reconstruction
**Use Case**: Disaster recovery, migration, archival compliance

```javascript
{
  format: "noema-archive",
  version: "1.0",
  exported_at: "2025-12-30T10:00:00Z",
  exported_by: "user@example.com",

  // The authoritative source - enables full reconstruction
  event_log: {
    events: Event[],           // Complete append-only log
    logical_clock: number,     // Final clock value
    supersession_index: {},    // Event replacement chains
  },

  // Current computed state (for faster loading, optional)
  snapshot: {
    sets: Set[],
    records: Record[],
    views: View[],
    ghost_registry: Ghost[],
    tossed_items: TossedItem[],
  },

  // Semantic layer
  definitions: {
    schema_semantics: SchemaSemantic[],
    interpretation_bindings: InterpretationBinding[],
  },

  // Original imports preserved verbatim
  sources: {
    imports: [{
      id: string,
      file_name: string,
      file_type: "csv" | "json" | "xlsx" | "ics",
      original_data: string | object,  // Raw file content or parsed
      import_event_id: string,         // Link to event log
      provenance: Provenance9Element,
    }]
  },

  // Activity layer
  activity: {
    atoms: ActivityAtom[],     // All operator applications
    sequences: Sequence[],     // Compound action groupings
  },

  // Access control configurations
  horizons: Horizon[],

  // Navigation/UI state (optional)
  navigation: {
    breadcrumb_log: BreadcrumbEntry[],
    undo_stack: UndoEntry[],
    redo_stack: RedoEntry[],
  },

  // Checksums for integrity verification
  integrity: {
    event_count: number,
    record_count: number,
    checksum: string,          // SHA-256 of event_log
  }
}
```

**File Extension**: `.eolake` (compressed JSON or CBOR)

---

### 2. Workspace Export
**Purpose**: Export everything in a workspace (may have multiple)
**Use Case**: Team handoff, workspace backup, collaboration

```javascript
{
  format: "noema-workspace",
  version: "1.0",
  workspace_id: string,
  workspace_name: string,

  sets: Set[],                 // All sets in workspace

  // Include options (configurable)
  include: {
    history: boolean,          // Event log for this workspace
    history_depth: "full" | "30d" | "90d" | "1y" | number,
    definitions: boolean,      // Referenced schema semantics
    sources: boolean,          // Original import files
    ghosts: boolean,           // Deleted items
    activity: boolean,         // Operator audit trail
  },

  // Filtered event log (if history included)
  event_log?: Event[],

  // Referenced definitions only
  definitions?: {
    schema_semantics: SchemaSemantic[],
    interpretation_bindings: InterpretationBinding[],
  },

  sources?: ImportSource[],
  ghosts?: Ghost[],
  activity?: ActivityAtom[],
}
```

**File Extension**: `.eolake-ws`

---

### 3. Set Export
**Purpose**: Export a single set with configurable depth
**Use Case**: Sharing a dataset, creating a derivative work

```javascript
{
  format: "noema-set",
  version: "1.0",

  set: {
    id: string,
    name: string,
    description?: string,

    fields: Field[],
    records: Record[],
    views: View[],             // All views for this set
  },

  include: {
    history: boolean,
    history_depth: "full" | "30d" | "90d" | "1y" | number,
    definitions: boolean,      // Field semantic bindings
    source: boolean,           // Original import if exists
    linked_records: boolean,   // Records from linked sets
    linked_sets_schema: boolean, // Schema of linked sets (no records)
  },

  // Provenance chain (how this set came to be)
  lineage?: {
    source_event_id: string,
    parent_set_id?: string,    // If derived/filtered
    derivation_chain: EventRef[],
  },

  // If linked_records included
  linked_data?: {
    sets: [{
      id: string,
      name: string,
      fields: Field[],
      records: Record[],       // Only linked records
    }]
  },

  definitions?: SchemaSemantic[],
  source?: ImportSource,
  history?: Event[],
}
```

**File Extension**: `.eolake-set`

---

### 4. View Export
**Purpose**: Export exactly what's visible in a view
**Use Case**: Sharing a filtered/sorted perspective, reports

```javascript
{
  format: "noema-view",
  version: "1.0",

  view: {
    id: string,
    name: string,
    type: "table" | "cards" | "kanban" | "calendar" | "graph",
    configuration: ViewConfig,
  },

  // Only the data visible in this view
  data: {
    fields: Field[],           // Only visible fields
    records: Record[],         // Only matching records, in view order
  },

  // Parent set reference (for context)
  set_reference: {
    id: string,
    name: string,
    total_records: number,     // For "X of Y records" context
    total_fields: number,
  },

  include: {
    definitions: boolean,
    view_history: boolean,     // Changes to this view
  },

  definitions?: SchemaSemantic[],
  history?: Event[],           // View-specific events only
}
```

**File Extension**: `.eolake-view`

---

### 5. Selection Export
**Purpose**: Export specific selected records
**Use Case**: Ad-hoc sharing, extracting subset

```javascript
{
  format: "noema-selection",
  version: "1.0",

  selection: {
    record_ids: string[],
    source_set_id: string,
    source_set_name: string,
    source_view_id?: string,
    source_view_name?: string,
  },

  data: {
    fields: Field[],
    records: Record[],
  },

  include: {
    definitions: boolean,
    record_history: boolean,   // History for selected records only
    linked_records: boolean,
  },

  definitions?: SchemaSemantic[],
  history?: Event[],
  linked_data?: LinkedData,
}
```

**File Extension**: `.eolake-sel`

---

### 6. Definitions Export
**Purpose**: Export semantic vocabulary only (no data)
**Use Case**: Sharing schema standards, vocabulary alignment

```javascript
{
  format: "noema-definitions",
  version: "1.0",

  schema_semantics: [{
    id: string,                // eo://schema/column/{slug}/v{n}
    term: string,
    definition: string,

    // 9-element alignment
    jurisdiction: string,
    scale: string,
    timeframe: string,
    background: string[],

    aliases: string[],
    aligned_uris: string[],    // Wikidata, QUDT, etc.

    version: number,
    status: "draft" | "provisional" | "stable" | "deprecated",
    role: "quantity" | "property" | "identifier" | "temporal" | "spatial" | "categorical" | "textual",

    usage_stats?: {
      datasets: number,
      bindings: number,
    }
  }],

  // How definitions relate to each other
  relationships?: [{
    from_id: string,
    to_id: string,
    relationship: "broader" | "narrower" | "related" | "replaces" | "sameAs",
  }],

  // Interpretation templates (reusable binding patterns)
  binding_templates?: [{
    id: string,
    name: string,
    description: string,
    bindings: BindingPattern[],
  }],

  include: {
    history: boolean,          // Definition evolution
    usage_examples: boolean,   // Sample bindings (no data)
  },

  history?: Event[],
}
```

**File Extension**: `.eolake-def`

---

### 7. Activity/Audit Export
**Purpose**: Export audit trail for compliance
**Use Case**: Regulatory compliance, debugging, forensics

```javascript
{
  format: "noema-audit",
  version: "1.0",

  audit_scope: {
    start_time: ISO8601,
    end_time: ISO8601,

    // Filter options
    actors?: string[],         // Specific users
    sets?: string[],           // Specific sets
    operators?: Operator[],    // Specific operations
    categories?: EventCategory[],
  },

  activity: {
    atoms: [{
      id: string,
      timestamp: ISO8601,
      logical_clock: number,

      operator: Operator,      // NUL, DES, INS, SEG, CON, ALT, SYN, SUP, REC
      target: {
        id: string,
        type: string,
        name?: string,         // Human-readable
      },

      actor: string,

      // Full 9-element context
      context: {
        epistemic: { agent, method, source },
        semantic: { term, definition, jurisdiction },
        situational: { scale, timeframe, background },
      },

      // What changed (summary)
      change_summary?: string,

      // Sequence info
      sequence_id?: string,
      sequence_index?: number,
    }],

    sequences: [{
      id: string,
      name: string,            // "Import CSV", "Bulk Edit", etc.
      atom_count: number,
      start_time: ISO8601,
      end_time: ISO8601,
    }],
  },

  // Supersession chains (what replaced what)
  supersessions: [{
    original_id: string,
    replacement_id: string,
    type: "correction" | "refinement" | "retraction",
    reason: string,
    timestamp: ISO8601,
  }],

  // Statistics
  summary: {
    total_events: number,
    by_operator: { [operator]: number },
    by_actor: { [actor]: number },
    by_category: { [category]: number },
  },
}
```

**File Extension**: `.eolake-audit`

---

### 8. Differential/Incremental Export
**Purpose**: Export changes since a point in time
**Use Case**: Incremental backups, sync, replication

```javascript
{
  format: "noema-delta",
  version: "1.0",

  delta: {
    base_logical_clock: number,    // Changes after this point
    base_timestamp: ISO8601,
    current_logical_clock: number,
    current_timestamp: ISO8601,
  },

  // New events since base
  new_events: Event[],

  // Summary of changes
  changes: {
    sets_created: string[],
    sets_modified: string[],
    sets_deleted: string[],        // Ghosted

    records_created: number,
    records_modified: number,
    records_deleted: number,

    definitions_added: string[],
    definitions_modified: string[],
    definitions_deprecated: string[],
  },

  // For applying delta
  application_order: EventRef[],   // Correct order to replay

  // Integrity
  integrity: {
    base_checksum: string,         // Expected state before delta
    result_checksum: string,       // Expected state after delta
  },
}
```

**File Extension**: `.eolake-delta`

---

### 9. Snapshot Export
**Purpose**: Current state only, no history
**Use Case**: Quick sharing, external tool import

```javascript
{
  format: "noema-snapshot",
  version: "1.0",
  snapshot_time: ISO8601,

  // What to include (configurable)
  scope: "workspace" | "sets" | "set" | "view",
  scope_ids: string[],

  // Current state only
  sets: [{
    id: string,
    name: string,
    fields: Field[],
    records: Record[],
    views: View[],
  }],

  // Optionally include definitions
  include_definitions: boolean,
  definitions?: SchemaSemantic[],

  // No history, no events, no activity
  // This is explicitly a lossy export
  lossy_notice: "This export contains current state only. History and provenance are not included.",
}
```

**File Extension**: `.eolake-snap`

---

### 10. Interop Exports (Standard Formats)
**Purpose**: Export to standard formats for external tools
**Use Case**: Spreadsheets, BI tools, other databases

#### CSV Export
```javascript
{
  format: "csv",
  options: {
    delimiter: "," | ";" | "\t",
    quote_char: '"',
    escape_char: "\\",
    include_headers: boolean,
    date_format: "ISO8601" | "locale" | string,
    null_representation: "" | "NULL" | "N/A",
    multiselect_delimiter: ";",
  },

  // Optional sidecar for metadata
  generate_sidecar: boolean,  // Creates .csv.meta.json
}
```

#### JSON Export
```javascript
{
  format: "json",
  options: {
    structure: "array" | "object" | "ndjson",
    include_metadata: boolean,
    include_field_ids: boolean,
    pretty_print: boolean,
    date_format: "ISO8601" | "unix" | "unix_ms",
  }
}
```

#### Excel Export
```javascript
{
  format: "xlsx",
  options: {
    one_sheet_per_set: boolean,
    include_metadata_sheet: boolean,
    include_definitions_sheet: boolean,
    auto_column_width: boolean,
    freeze_header_row: boolean,
  }
}
```

#### SQL Export
```javascript
{
  format: "sql",
  options: {
    dialect: "postgresql" | "mysql" | "sqlite" | "standard",
    include_create_table: boolean,
    include_drop_table: boolean,
    batch_size: number,
    table_prefix?: string,
  }
}
```

---

## Export Configuration UI

### Export Dialog Options

```
┌────────────────────────────────────────────────────────────────┐
│  Export Data                                              [×]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  SCOPE                                                         │
│  ○ Master Archive (everything, full reconstruction)           │
│  ○ Workspace                                                   │
│  ○ Set: [dropdown]                                             │
│  ○ View: [dropdown]                                            │
│  ○ Selected Records (3 selected)                              │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  FORMAT                                                        │
│  ○ noema Native (.eolake)  - Full fidelity                  │
│  ○ JSON                       - Structured data                │
│  ○ CSV                        - Tabular data                   │
│  ○ Excel                      - Spreadsheet                    │
│  ○ SQL                        - Database import                │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  INCLUDE                                     [noema only]    │
│  ☑ Definitions (semantic vocabulary)                          │
│  ☑ History ────────────────────────────────────────────        │
│       ○ Full history                                           │
│       ○ Last 30 days                                           │
│       ○ Last 90 days                                           │
│       ○ Last year                                              │
│  ☐ Activity log (operator audit trail)                        │
│  ☐ Ghosts (deleted items)                                     │
│  ☐ Original imports (verbatim source files)                   │
│  ☐ Linked records (from related sets)                         │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  PREVIEW                                                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Export will include:                                      │ │
│  │   • 1 set (Customers)                                     │ │
│  │   • 1,234 records                                         │ │
│  │   • 8 fields                                              │ │
│  │   • 3 views                                               │ │
│  │   • 12 definitions                                        │ │
│  │   • 4,521 events (90 days)                               │ │
│  │                                                           │ │
│  │ Estimated size: 2.4 MB                                    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│                           [Cancel]  [Export]                   │
└────────────────────────────────────────────────────────────────┘
```

---

## Import Considerations

Each export format must support clean import:

### Master Archive Import
- Full system restore
- Merge with existing (conflict resolution)
- Selective import (choose what to restore)

### Set/View Import
- Import as new set
- Merge into existing set (match by field or record ID)
- Link to existing definitions or import new

### Definitions Import
- Merge with existing vocabulary
- Version conflict handling
- URI alignment verification

---

## Export Metadata Header

All noema native exports include a standard header:

```javascript
{
  _noema_export: {
    format: string,            // Format identifier
    version: string,           // Format version

    exported_at: ISO8601,
    exported_by: string,       // Actor
    export_method: string,     // "ui" | "api" | "scheduled"

    source_system: {
      version: string,         // noema version
      instance_id?: string,
    },

    scope: {
      type: string,            // "master" | "workspace" | "set" | etc.
      ids: string[],
    },

    options: {
      // All selected export options
    },

    integrity: {
      checksum: string,
      record_count: number,
      event_count?: number,
    },

    // Export is itself a Given event
    export_event_id: string,
  }
}
```

---

## Summary: Export Use Cases

| Use Case | Format | Scope | Key Options |
|----------|--------|-------|-------------|
| Full backup/DR | Master Archive | Everything | All options enabled |
| Team handoff | Workspace | One workspace | History, definitions |
| Share dataset | Set | One set | Definitions, linked schema |
| Share report | View | Filtered view | Minimal |
| Ad-hoc share | Selection | Picked records | Minimal |
| Vocabulary sync | Definitions | Definitions only | Usage examples |
| Compliance audit | Audit | Time range | Actor filter |
| Incremental backup | Delta | Since timestamp | Full events |
| Quick share | Snapshot | Current state | No history |
| External tool | CSV/JSON/XLSX | Set or view | Format options |

---

## Implementation Priority

### Phase 1: Core Exports
1. Set Export (single set with options)
2. View Export (visible data only)
3. Snapshot Export (current state)
4. Enhanced CSV/JSON/XLSX exports

### Phase 2: Full Fidelity
5. Master Archive Export
6. Workspace Export
7. Definitions Export

### Phase 3: Advanced
8. Selection Export
9. Audit Export
10. Delta Export

### Phase 4: Interop
11. SQL Export
12. Import functionality for all formats
