# Layer Activity Tracking Rules

> **Canonical Reference**: How all 6 layers track activities using EO operators.
>
> Every user action in EO Lake is recorded as an activity using a composition of the 9 canonical operators.

---

## The Activity Signature

All activities follow a single elegant signature:

```
OPERATOR(target, context, [frame])
```

| Component | Required | Description |
|-----------|----------|-------------|
| **OPERATOR** | Yes | One of the 9 canonical operators (INS, DES, SEG, CON, SYN, ALT, SUP, REC, NUL) |
| **target** | Yes | What is being operated on |
| **context** | Yes | Who, how, and from where |
| **frame** | Optional | Epistemic frame (validity, claims, uncertainty) |

### Target Structure

```javascript
target = {
  id: string,           // Entity ID (e.g., "set_001", "rec_xyz")
  type: LayerType,      // project | source | definition | set | lens | view
  field?: string,       // Optional: specific field affected
  scope?: string,       // Optional: parent container
  value?: any,          // Optional: data payload
  relatedTo?: string,   // Optional: linked entity (for CON)
  delta?: [prev, next]  // Optional: change values (for ALT)
}
```

### Context Structure (9-Element Form)

```javascript
context = {
  epistemic: {
    agent: string,       // Who: "user:michael", "system", "import:csv"
    method: string,      // How: "interactive_ui", "api_call", "file_import"
    source: string       // Where: "web_app", "cli", "sync_service"
  },
  semantic: {
    term: string,        // Semantic term being applied
    definition: string,  // Definition ID for meaning
    jurisdiction: string // Legal/domain scope
  },
  situational: {
    scale: string,       // "single_operation", "batch", "migration"
    timeframe: string,   // ISO timestamp or range
    background: string   // Why this action is happening
  }
}
```

### Frame Structure (Epistemic Qualification)

```javascript
frame = {
  claim: string,           // What is being asserted
  epistemicStatus: string, // "certain" | "preliminary" | "hypothetical"
  validFrom?: timestamp,   // When claim becomes valid
  validUntil?: timestamp,  // When claim expires
  supersedes?: string      // ID of prior claim being corrected
}
```

---

## The 9 Operators

| Op | Symbol | Verb | Guarantee | Primary Epistemic Type |
|----|--------|------|-----------|----------------------|
| **INS** | ⊕ | Assert existence | Once asserted, never erased | GIVEN |
| **DES** | ⊙ | Designate identity | References are explicit | MEANT |
| **SEG** | ⊘ | Scope visibility | Hidden ≠ deleted | MEANT |
| **CON** | ⊗ | Connect entities | Semantics live in the connection | MEANT |
| **SYN** | ≡ | Synthesize identity | Equivalence is pre-query | MEANT |
| **ALT** | Δ | Alternate world state | Time is projection, not filtering | MEANT |
| **SUP** | ∥ | Superpose interpretations | Disagreement preserved | MEANT |
| **REC** | ← | Record grounding | Everything traceable to origin | IMPLICIT |
| **NUL** | ∅ | Assert meaningful absence | Non-events are first-class | DERIVED |

---

## Layer-Operator Matrix

Which operators apply to which layers:

| Layer | INS | DES | SEG | CON | SYN | ALT | SUP | REC | NUL |
|-------|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| **PROJECT** | ● | ● | ● | ○ | ○ | ○ | ○ | ● | ● |
| **SOURCE** | ● | ● | ○ | ● | ○ | ○ | ○ | ● | ○ |
| **DEFINITION** | ● | ● | ○ | ● | ● | ● | ● | ● | ● |
| **SET** | ● | ● | ○ | ● | ● | ● | ● | ● | ● |
| **LENS** | ● | ● | ● | ● | ○ | ● | ● | ● | ● |
| **VIEW** | ● | ● | ● | ○ | ○ | ● | ● | ● | ● |

**Legend:** ● = commonly used, ○ = rarely/contextually used

---

## Layer 0: PROJECT

**Type:** MEANT (organizational container)

### Valid Operations

| Action | Operators | Signature |
|--------|-----------|-----------|
| Create project | INS + DES | `INS(project, ctx)` then `DES(project, ctx)` |
| Rename project | DES | `DES(project, ctx, { delta: [old, new] })` |
| Archive project | SEG | `SEG(project, ctx, { visibility: 'archived' })` |
| Delete project | NUL | `NUL(project, ctx, { reason })` |
| Restore project | INS | `INS(project, ctx, { wasArchived: true })` |

### Activity Rules

```javascript
// PROJECT CREATION
// Always: INS to assert existence, then DES to name it
INS({
  id: "proj_001",
  type: "project",
  value: { description: "Wallace Studios Investigation" }
}, {
  epistemic: { agent: "user:michael", method: "interactive_ui" }
});

DES({
  id: "proj_001",
  type: "project",
  delta: [null, "Wallace Studios Investigation"]
}, {
  epistemic: { agent: "user:michael", method: "user_designation" }
});

// PROJECT ARCHIVAL
// Use SEG not NUL - project still exists, just hidden
SEG({
  id: "proj_001",
  type: "project",
  value: { visibility: "archived", scope: "archive_area" }
}, {
  epistemic: { agent: "user:michael", method: "project_archival" }
});
```

### Implicit Rules

1. **REC is always implicit** - every project action records grounding
2. **Cannot CON projects together** (use workspace hierarchy instead)
3. **Cannot SYN projects** (each project is unique identity)

---

## Layer 1: SOURCE

**Type:** GIVEN (immutable origin)

### Valid Operations

| Action | Operators | Signature |
|--------|-----------|-----------|
| Import file | INS + DES + REC | `INS(source, ctx)` + grounding chain |
| Connect API | INS + DES + CON | `INS(source, ctx)` + API connection |
| Create null source | INS + DES | `INS(source, ctx, { sourceType: 'null' })` |
| Record sync | INS + REC | `INS(source, ctx, { sourceType: 'sync' })` |

### Activity Rules

```javascript
// FILE IMPORT
// INS to assert source exists, REC to ground it to file
INS({
  id: "src_001",
  type: "source",
  value: {
    sourceType: "csv",
    locator: { filePath: "/uploads/evictions.csv", sha256: "a3f2..." },
    rawSchema: { columns: ["case", "plaintiff"], rowCount: 33 }
  }
}, {
  epistemic: { agent: "user:michael", method: "file_import", source: "evictions.csv" }
});

REC({
  id: "src_001",
  type: "source_grounding",
  value: {
    chain: [{ kind: "file", path: "/uploads/evictions.csv", hash: "a3f2..." }]
  }
}, {
  epistemic: { agent: "system", method: "provenance_capture" }
});

DES({
  id: "src_001",
  type: "source",
  delta: [null, "Wallace Evictions CSV"]
}, {
  epistemic: { agent: "user:michael", method: "user_designation" }
});

// API CONNECTION
// CON links source to external system
INS({
  id: "src_002",
  type: "source",
  value: { sourceType: "api", endpoint: "https://caselink.gov/api/v1" }
}, {
  epistemic: { agent: "user:michael", method: "api_connection" }
});

CON({
  id: "src_002",
  type: "api_binding",
  relatedTo: "external:caselink_api",
  value: { connectionType: "sync", schedule: "daily" }
}, {
  epistemic: { agent: "user:michael", method: "api_connection" }
});
```

### Immutability Rules

1. **Sources are append-only** - new data uses INS, never modify existing
2. **No SEG on Sources** - raw data cannot be hidden at source level
3. **No ALT on Sources** - sources don't change; create new source for updates
4. **No SYN on Sources** - source identity is fixed at creation
5. **No NUL on Sources** - sources cannot be deleted, only disconnected

---

## Layer 2: DEFINITION

**Type:** MEANT (semantic vocabulary)

### Valid Operations

| Action | Operators | Signature |
|--------|-----------|-----------|
| Import external ontology | INS + DES + CON | External URI binding |
| Create custom vocabulary | INS + DES | Local definition creation |
| Add term to definition | INS + CON | Term addition |
| Link definitions | CON | Cross-reference |
| Mark term deprecated | NUL | Soft deprecation |
| Merge duplicate terms | SYN | Identity synthesis |
| Propose alternate meaning | SUP | Superposition |
| Update term metadata | ALT | Value alternation |

### Activity Rules

```javascript
// IMPORT EXTERNAL ONTOLOGY
// CON links to external URI namespace
INS({
  id: "def_qudt",
  type: "definition",
  value: { sourceType: "external", uri: "http://qudt.org/vocab/unit/" }
}, {
  epistemic: { agent: "user:michael", method: "ontology_import" },
  semantic: { definition: "qudt", term: "unit_vocabulary" }
});

CON({
  id: "def_qudt",
  type: "external_binding",
  relatedTo: "uri:http://qudt.org/vocab/unit/",
  value: { relationship: "LINKED_TO", trusted: true }
}, {
  epistemic: { agent: "user:michael", method: "external_link" }
});

DES({
  id: "def_qudt",
  type: "definition",
  delta: [null, "QUDT Units"]
}, {
  epistemic: { agent: "user:michael", method: "user_designation" }
});

// CREATE CUSTOM VOCABULARY
INS({
  id: "def_status",
  type: "definition",
  value: {
    sourceType: "custom",
    uri: "https://groundtruth.nashville.gov/vocab/status",
    terms: [
      { id: "open", label: "Open", uri: "...#open" },
      { id: "closed", label: "Closed", uri: "...#closed" }
    ]
  }
}, {
  epistemic: { agent: "user:michael", method: "vocabulary_creation" }
});

// MERGE DUPLICATE TERMS (SYN)
SYN({
  id: "term_canonical",
  type: "term_resolution",
  value: {
    left: "term_open_v1",
    right: "term_open_v2",
    canonical: "term_open_v1",
    confidence: 1.0
  }
}, {
  epistemic: { agent: "user:michael", method: "term_deduplication" },
  semantic: { term: "same_meaning" }
});

// PROPOSE ALTERNATE INTERPRETATION (SUP)
SUP({
  id: "term_plaintiff",
  type: "term_interpretation",
  value: {
    interpretations: [
      { id: "interp_1", meaning: "Legal entity filing suit", source: "legal_dictionary" },
      { id: "interp_2", meaning: "Complaining party", source: "common_usage" }
    ],
    resolution: "FRAME_DEPENDENT"
  }
}, {
  epistemic: { agent: "user:michael", method: "interpretation_superposition" },
  semantic: { jurisdiction: "US_legal" }
});
```

### Semantic Rules

1. **External is preferred** - CON to external URI encouraged
2. **SYN for deduplication** - merge terms with same meaning
3. **SUP for ambiguity** - preserve multiple interpretations
4. **NUL for deprecation** - mark terms as no longer recommended
5. **ALT for updates** - change term metadata over time

---

## Layer 3: SET

**Type:** GIVEN (data) + MEANT (schema)

### Valid Operations

| Action | Operators | Signature |
|--------|-----------|-----------|
| Create set from source | INS + DES + CON | Set creation with source binding |
| Create empty set | INS + DES | Null source binding |
| Add field | INS + DES | Schema modification |
| Rename field | DES | Field re-designation |
| Change field type | ALT | Type alternation |
| Bind field to definition | CON | Semantic binding |
| Unbind field | NUL | Remove binding |
| Add record | INS | Data insertion |
| Update record | ALT | Value alternation |
| Delete record | NUL | Soft delete (ghost) |
| Merge duplicate records | SYN | Entity resolution |
| Mark uncertain match | SUP | Superposition |
| Join sets | INS + CON | Joined set creation |

### Activity Rules

```javascript
// CREATE SET FROM SOURCE
INS({
  id: "set_001",
  type: "set",
  scope: "proj_001",
  value: { schema: { fields: [] } }
}, {
  epistemic: { agent: "user:michael", method: "set_creation" }
});

CON({
  id: "set_001",
  type: "source_binding",
  relatedTo: "src_001",
  value: { relationship: "DERIVED_FROM", mapping: "direct" }
}, {
  epistemic: { agent: "user:michael", method: "source_derivation" }
});

DES({
  id: "set_001",
  type: "set",
  delta: [null, "Evictions"]
}, {
  epistemic: { agent: "user:michael", method: "user_designation" }
});

// ADD FIELD
INS({
  id: "fld_07",
  type: "field",
  scope: "set_001",
  value: { fieldType: "currency", config: { currency: "USD" } }
}, {
  epistemic: { agent: "user:michael", method: "schema_modification" }
});

DES({
  id: "fld_07",
  type: "field",
  delta: [null, "judgment_amount"]
}, {
  epistemic: { agent: "user:michael", method: "user_designation" }
});

// BIND FIELD TO DEFINITION (CON)
CON({
  id: "fld_07",
  type: "semantic_binding",
  scope: "set_001",
  relatedTo: "def_qudt",
  value: { termId: "USD", relationship: "HAS_UNIT" }
}, {
  epistemic: { agent: "user:michael", method: "semantic_binding" },
  semantic: { definition: "def_qudt", term: "USD" }
});

// ADD RECORD (INS)
INS({
  id: "rec_001",
  type: "record",
  scope: "set_001",
  value: {
    fld_01: "24-CV-1234",
    fld_02: "ACME Holdings",
    fld_07: 5000.00
  }
}, {
  epistemic: { agent: "user:michael", method: "manual_entry", source: "user_input" }
});

// UPDATE RECORD (ALT)
ALT({
  id: "rec_001",
  type: "record",
  field: "fld_07",
  delta: [5000.00, 7500.00]
}, {
  epistemic: { agent: "user:michael", method: "inline_edit" }
});

// DELETE RECORD (NUL - ghost)
NUL({
  id: "rec_001",
  type: "record",
  scope: "set_001",
  value: { reason: "user_deletion", retentionPolicy: "30_days" }
}, {
  epistemic: { agent: "user:michael", method: "soft_delete" }
});

// MERGE DUPLICATES (SYN)
SYN({
  id: "rec_canonical",
  type: "entity_resolution",
  value: {
    left: "rec_001",
    right: "rec_002",
    canonical: "rec_001",
    confidence: 0.95,
    matchMethod: "fuzzy_name_address"
  }
}, {
  epistemic: { agent: "user:michael", method: "entity_resolution" },
  semantic: { term: "same_entity" }
});

// UNCERTAIN MATCH (SUP)
SUP({
  id: "match_001",
  type: "entity_match",
  value: {
    left: "rec_003",
    right: "rec_004",
    interpretations: [
      { id: "same", probability: 0.6 },
      { id: "different", probability: 0.4 }
    ],
    resolution: "UNRESOLVED"
  }
}, {
  epistemic: { agent: "user:michael", method: "match_uncertainty" }
});

// JOIN SETS (INS + CON)
INS({
  id: "set_joined",
  type: "set",
  scope: "proj_001",
  value: { schema: { fields: [] }, isJoined: true }
}, {
  epistemic: { agent: "user:michael", method: "join_creation" }
});

CON({
  id: "set_joined",
  type: "join",
  relatedTo: ["set_001", "set_002"],
  value: {
    joinType: "LEFT",
    conditions: [{ left: "fld_01", right: "fld_case_num", op: "eq" }],
    conflictPolicy: "LEFT_WINS"  // REQUIRED for CON
  }
}, {
  epistemic: { agent: "user:michael", method: "join_specification" }
});
```

### Data Integrity Rules

1. **CON requires conflictPolicy** - joins must specify how to handle conflicts
2. **NUL creates ghosts** - deleted records remain as influences
3. **SYN is pre-query** - merged entities show as one before any query
4. **SUP preserves uncertainty** - don't force resolution on ambiguous matches
5. **ALT tracks all changes** - every field update creates activity

---

## Layer 4: LENS

**Type:** MEANT (data slice)

### Valid Operations

| Action | Operators | Signature |
|--------|-----------|-----------|
| Create default lens | INS + DES | Auto-created with set |
| Create filtered lens | INS + DES + SEG | Pivoted slice |
| Create grouped lens | INS + DES + SEG | Grouped slice |
| Rename lens | DES | Re-designation |
| Update filter | ALT | Filter alternation |
| Hide fields | SEG | Field visibility |
| Delete lens | NUL | Soft delete |
| Copy lens | INS + CON | Clone with reference |
| Create temporal lens | INS + ALT | AS_OF slice |

### Activity Rules

```javascript
// CREATE DEFAULT LENS (auto-created with set)
INS({
  id: "lens_001",
  type: "lens",
  scope: "set_001",
  value: { isDefault: true, pivot: null, includedFields: "all" }
}, {
  epistemic: { agent: "system", method: "auto_creation" }
});

DES({
  id: "lens_001",
  type: "lens",
  delta: [null, "All Evictions"]
}, {
  epistemic: { agent: "system", method: "default_designation" }
});

// CREATE FILTERED LENS (SEG)
INS({
  id: "lens_002",
  type: "lens",
  scope: "set_001",
  value: { isDefault: false }
}, {
  epistemic: { agent: "user:michael", method: "lens_creation" }
});

SEG({
  id: "lens_002",
  type: "lens_pivot",
  value: {
    pivotType: "filter",
    predicate: { field: "party_type", op: "eq", value: "landlord" },
    visibilityType: "FILTERED"  // Hidden records still exist
  }
}, {
  epistemic: { agent: "user:michael", method: "filter_definition" }
});

DES({
  id: "lens_002",
  type: "lens",
  delta: [null, "Landlords Only"]
}, {
  epistemic: { agent: "user:michael", method: "user_designation" }
});

// CREATE TEMPORAL LENS (ALT - world reconstruction)
INS({
  id: "lens_003",
  type: "lens",
  scope: "set_001",
  value: { isDefault: false }
}, {
  epistemic: { agent: "user:michael", method: "lens_creation" }
});

ALT({
  id: "lens_003",
  type: "temporal_context",
  value: {
    semantics: "WORLD_STATE",  // "What did we believe at time T?"
    temporalType: "AS_OF",
    timestamp: "2024-06-01T00:00:00Z",
    evaluation: "STATIC"
  }
}, {
  epistemic: { agent: "user:michael", method: "temporal_projection" },
  situational: { timeframe: "2024-06-01T00:00:00Z" }
}, {
  claim: "Reconstruct knowledge state as of June 1, 2024",
  epistemicStatus: "certain"
});

DES({
  id: "lens_003",
  type: "lens",
  delta: [null, "June 2024 Snapshot"]
}, {
  epistemic: { agent: "user:michael", method: "user_designation" }
});

// HIDE FIELDS (SEG)
SEG({
  id: "lens_002",
  type: "field_visibility",
  value: {
    hiddenFields: ["fld_03", "fld_04"],
    visibilityType: "HIDDEN"  // Fields exist, just not shown
  }
}, {
  epistemic: { agent: "user:michael", method: "field_hiding" }
});

// UPDATE FILTER (ALT)
ALT({
  id: "lens_002",
  type: "lens_pivot",
  delta: [
    { field: "party_type", op: "eq", value: "landlord" },
    { field: "party_type", op: "in", value: ["landlord", "property_manager"] }
  ]
}, {
  epistemic: { agent: "user:michael", method: "filter_update" }
});
```

### Visibility Rules

1. **SEG for filtering** - filtered records exist, just scoped out
2. **SEG for hiding** - hidden fields exist, just not visible
3. **ALT for temporal** - AS_OF reconstructs world state
4. **Default lens always exists** - every set has at least one lens
5. **Lenses are restrictive only** - cannot expand beyond parent set

---

## Layer 5: VIEW

**Type:** MEANT (visualization/workspace)

### Valid Operations

| Action | Operators | Signature |
|--------|-----------|-----------|
| Create view | INS + DES + SEG | View with visibility config |
| Rename view | DES | Re-designation |
| Change view type | ALT | Grid → Kanban, etc. |
| Apply filter | SEG | Temporary visibility |
| Apply sort | ALT | Order alternation |
| Hide column | SEG | Field visibility |
| Resize column | ALT | Config change |
| Edit cell | ALT | Value change (propagates to set) |
| Add record | INS | Record creation (propagates to set) |
| Delete record | NUL | Soft delete (propagates to set) |
| Delete view | NUL | View removal |
| Duplicate view | INS + CON | Clone with reference |

### Activity Rules

```javascript
// CREATE VIEW
INS({
  id: "view_001",
  type: "view",
  scope: "lens_001",
  value: { viewType: "grid", config: {} }
}, {
  epistemic: { agent: "user:michael", method: "view_creation" }
});

SEG({
  id: "view_001",
  type: "view_scope",
  value: {
    visibleFields: ["fld_01", "fld_02", "fld_05", "fld_07"],
    hiddenFields: ["fld_03", "fld_04"]
  }
}, {
  epistemic: { agent: "user:michael", method: "view_configuration" }
});

DES({
  id: "view_001",
  type: "view",
  delta: [null, "Evictions Grid"]
}, {
  epistemic: { agent: "user:michael", method: "user_designation" }
});

// CHANGE VIEW TYPE (ALT)
ALT({
  id: "view_001",
  type: "view_config",
  delta: [
    { viewType: "grid" },
    { viewType: "kanban", groupField: "fld_05" }
  ]
}, {
  epistemic: { agent: "user:michael", method: "view_type_change" }
});

// APPLY FILTER (SEG - temporary)
SEG({
  id: "view_001",
  type: "view_filter",
  value: {
    filters: [{ field: "fld_05", op: "eq", value: "open" }],
    temporary: true,
    visibilityType: "FILTERED"
  }
}, {
  epistemic: { agent: "user:michael", method: "filter_application" }
});

// APPLY SORT (ALT)
ALT({
  id: "view_001",
  type: "view_sort",
  delta: [
    null,
    [{ field: "fld_04", direction: "desc" }]
  ]
}, {
  epistemic: { agent: "user:michael", method: "sort_application" }
});

// EDIT CELL (ALT - propagates to set)
// This creates activity at VIEW layer AND SET layer
ALT({
  id: "rec_001",
  type: "record",
  field: "fld_07",
  scope: "view_001",  // Origin is view
  delta: [5000.00, 7500.00]
}, {
  epistemic: { agent: "user:michael", method: "inline_edit", source: "view_001" }
});

// ADD RECORD (INS - propagates to set)
INS({
  id: "rec_new",
  type: "record",
  scope: "view_001",  // Origin is view
  value: { fld_01: "24-CV-9999", fld_02: "New Case" }
}, {
  epistemic: { agent: "user:michael", method: "manual_entry", source: "view_001" }
});
```

### Edit Propagation Rules

1. **View edits propagate down** - edit in view → activity at view → activity at set → mutation at source
2. **SEG is layer-local** - view filters don't affect set or lens
3. **ALT for config changes** - any view setting change is ALT
4. **Track origin** - view activities include source: "view_xxx"

---

## Cross-Layer Activity Propagation

When an action in one layer affects another, create activities at each layer:

```javascript
// USER EDITS CELL IN VIEW
// 1. View layer activity
ALT({
  id: "rec_001",
  type: "record",
  field: "fld_07",
  scope: "view_001",
  delta: [5000.00, 7500.00]
}, {
  epistemic: { agent: "user:michael", method: "inline_edit", source: "view_001" }
});

// 2. Set layer activity (automatic)
ALT({
  id: "rec_001",
  type: "record",
  field: "fld_07",
  scope: "set_001",
  delta: [5000.00, 7500.00]
}, {
  epistemic: { agent: "user:michael", method: "propagated_edit", source: "view_001" },
  situational: { background: "Propagated from view_001" }
});

// 3. Source layer event (given)
// (Recorded as event, not activity - sources are GIVEN)
```

### Propagation Chain

```
VIEW (edit here)
  ↓ ALT activity
LENS (passes through)
  ↓ no activity (lenses don't store data)
SET (data lives here)
  ↓ ALT activity
SOURCE (immutable log)
  ↓ GIVEN event (append-only)
```

---

## Activity Sequence Patterns

### Import Flow

```javascript
// 1. Source creation
INS(source, ctx) + REC(source, ctx)
// 2. Set creation
INS(set, ctx) + CON(set→source, ctx) + DES(set, ctx)
// 3. Definition bindings
CON(field→definition, ctx) // for each bound field
// 4. Lens creation (auto)
INS(lens, ctx) + DES(lens, ctx)
// 5. View creation
INS(view, ctx) + SEG(view, ctx) + DES(view, ctx)
```

### Record Edit Flow

```javascript
// At view layer
ALT({ id: rec, scope: view, delta: [old, new] }, ctx)
// Propagates to set layer
ALT({ id: rec, scope: set, delta: [old, new] }, { ...ctx, source: view })
```

### Entity Resolution Flow

```javascript
// Uncertain match
SUP({ left, right, interpretations: [...] }, ctx)
// User confirms match
SYN({ left, right, canonical: left }, ctx)
// System ghosts the duplicate
NUL({ id: right, reason: "merged_duplicate" }, ctx)
// System records haunt
CON({ ghost: right, target: left, hauntType: "merged" }, ctx)
```

### Delete Flow

```javascript
// User deletes record
NUL({ id: rec, reason: "user_deletion" }, ctx)
// System creates ghost
// Ghost influences are tracked via CON
CON({ ghost: rec, target: linked_rec, hauntType: "orphaned_reference" }, ctx)
```

---

## Compact Activity Format

For storage efficiency, activities use a compact format:

```javascript
{
  id: "act_abc123",          // Activity ID
  ts: 1704960000000,         // Timestamp (ms)
  op: "ALT",                 // Operator
  actor: "user:michael",     // Who
  target: "rec_001",         // Entity ID
  field?: "fld_07",          // Optional: field
  delta?: [5000, 7500],      // Optional: [prev, next]
  method?: "inline_edit",    // Optional: how
  source?: "view_001",       // Optional: where
  seq?: "seq_xyz",           // Optional: sequence ID
  ctx?: "ctx_abc",           // Optional: context ref
  data?: { ... }             // Optional: extra payload
}
```

### Expansion

Compact activities expand to full verbose format when needed:

```javascript
expand(activity, loadContext) → {
  id: "act_abc123",
  type: "activity_atom",
  operator: "ALT",
  symbol: "Δ",
  target: { id: "rec_001", fieldId: "fld_07", ... },
  context: { epistemic: {...}, semantic: {...}, situational: {...} },
  timestamp: "2024-01-01T00:00:00.000Z",
  ...
}
```

---

## Validation Rules

### Universal Rules

1. **Every activity must have an operator** - one of the 9
2. **Every activity must have a target** - what is being operated on
3. **Every activity must have an actor** - who/what is performing it
4. **Timestamp is required** - when the activity occurred

### Operator-Specific Rules

| Operator | Required Fields | Validation |
|----------|-----------------|------------|
| **INS** | target.type, target.value | Type must be valid layer |
| **DES** | target.id, delta[1] | New name must not be empty |
| **SEG** | target.scope, value.visibility | Visibility must be valid |
| **CON** | target.relatedTo, value.conflictPolicy | Must specify conflict resolution |
| **SYN** | value.left, value.right, value.canonical | Canonical must be one of left/right |
| **ALT** | delta | Must have [previous, next] |
| **SUP** | value.interpretations | Must have at least 2 interpretations |
| **REC** | value.chain | Must have provenance chain |
| **NUL** | value.reason | Must explain why |

### Layer-Specific Rules

| Layer | Constraint |
|-------|------------|
| **SOURCE** | Cannot use SEG, ALT, SYN, SUP, NUL |
| **DEFINITION** | CON requires valid URI for external |
| **SET** | CON (joins) requires conflictPolicy |
| **LENS** | SEG must be restrictive (cannot expand) |
| **VIEW** | Edits must propagate to SET |

---

## Summary

The EO activity tracking system follows a simple principle:

```
OPERATOR(target, context, [frame])
```

- **9 operators** cover all possible actions
- **6 layers** each have specific operator affinities
- **Activities propagate** from views down to sources
- **Compact storage** with on-demand expansion
- **Validation rules** ensure consistency

Every user action becomes a traceable, queryable activity that maintains the core distinction between GIVEN (what happened) and MEANT (what it means).
