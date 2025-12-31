# Design: Lens System for Record-Type Subsets

## Problem Statement

When importing data with multiple record types (e.g., a JSON file containing both "person" and "company" records), the current system creates:
- One Set with all records
- Views per record type (filtered table perspectives)

**The limitation:** Views are display-only filters. They hide irrelevant fields but don't create true subsets with their own refined schemas. Users working with "person" records still see (hidden) company-specific fields in the data model, and operations apply uniformly across all record types.

## The Lens Concept

A **Lens** is a first-class subset of a Set, scoped to a specific record type, with its own refined schema.

```
SOURCE (GIVEN)
    ↓
   SET (MEANT) ─────────────────────────────────────
    │                    │                         │
    ▼                    ▼                         ▼
┌─────────────┐   ┌─────────────┐           ┌─────────────┐
│  Lens:      │   │  Lens:      │           │  View:      │
│  "Person"   │   │  "Company"  │           │ "All Data"  │
├─────────────┤   ├─────────────┤           ├─────────────┤
│ Fields:     │   │ Fields:     │           │ All fields  │
│ - name      │   │ - name      │           │ All records │
│ - email     │   │ - industry  │           │ (legacy)    │
│ - phone     │   │ - founded   │           └─────────────┘
│             │   │ - employees │
│ Records:    │   │             │
│ (42 people) │   │ Records:    │
└─────────────┘   │ (15 comps)  │
                  └─────────────┘
```

### Lens vs View vs Separate Sets

| Aspect | View (Current) | Lens (Proposed) | Separate Sets |
|--------|----------------|-----------------|---------------|
| Schema | Shared (hides fields) | Independent per type | Fully independent |
| Records | References, filtered | Partitioned subset | Copied/split |
| Provenance | To parent Set | To parent Set + type | To Source directly |
| Operations | Affect all records | Scoped to type | Fully isolated |
| Cross-type queries | Easy | Possible via parent | Manual joins |
| Field customization | None | Per-lens | Per-set |

## Use Cases

### 1. Type-Specific Field Configuration
Each lens can have field settings tailored to its record type:
- Person lens: email field validates as email, phone as phone number
- Company lens: employees field is numeric, industry is select dropdown

### 2. Type-Scoped Operations
Operations like "enrich" or "validate" can be lens-aware:
- Enrich Person lens: Add social media handles
- Enrich Company lens: Add business registration info

### 3. Type-Specific Views
Each lens can have its own views:
- Person lens: Card view (contact card layout), Table view
- Company lens: Kanban by industry, Org chart view

### 4. Gradual Separation
Users start with lenses, can later "detach" to fully separate Sets:
```
Set with Lenses → Detach Lens → Independent Set (with provenance)
```

### 5. Mixed Record Types Handling
Real-world data often has heterogeneous records:
- CRM export: Contacts, Organizations, Deals
- Event data: Sessions, Speakers, Sponsors
- Inventory: Products, Suppliers, Warehouses

## Data Model

### Lens Definition

```javascript
{
  id: "lens_xxx",
  name: "Person",                        // Display name
  setId: "set_xxx",                      // Parent set reference

  typeSelector: {                        // How records are selected
    fieldId: "fld_type",                 // Type field reference
    operator: "is",                      // Matching operator
    value: "person"                      // Type value
  },

  schema: {                              // Lens-specific schema
    fields: [                            // Only relevant fields
      { id: "fld_name", name: "Name", type: "text", ... },
      { id: "fld_email", name: "Email", type: "email", ... },
      { id: "fld_phone", name: "Phone", type: "phone", ... }
    ],
    fieldOrder: ["fld_name", "fld_email", "fld_phone"],
    excludedFields: ["fld_industry", "fld_founded"]  // Fields from Set not in this lens
  },

  stats: {
    recordCount: 42,
    lastUpdated: "2024-01-15T..."
  },

  views: [                               // Lens-scoped views
    { id: "view_xxx", name: "Table", type: "table", ... },
    { id: "view_yyy", name: "Cards", type: "cards", ... }
  ],

  metadata: {
    icon: "ph-user",
    color: "#3B82F6",
    description: "Individual contacts",
    isRecordTypeLens: true,              // Auto-generated from type detection
    typeSpecificFields: ["email", "phone"],
    commonFields: ["name", "description"]
  },

  createdAt: "2024-01-15T...",
  createdBy: "user_xxx"
}
```

### Set with Lenses

```javascript
{
  id: "set_xxx",
  name: "CRM Data",
  // ... existing set fields ...

  lenses: [
    { id: "lens_person", ... },
    { id: "lens_company", ... }
  ],

  lensConfig: {
    typeField: "fld_type",               // Field used for lens partitioning
    autoCreateLenses: true,              // Auto-create lenses for new types
    defaultLens: "lens_person",          // Default lens for new records
    orphanHandling: "default" | "reject" | "unassigned"
  },

  // Records remain at Set level, lenses reference them
  records: [...]
}
```

## UI Concepts

### Create Set Modal with Lenses

```
┌──────────────────────────────────────────────────────────────────────┐
│  ✨ Create Set from Data                                        ✕    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐      ┌──────────────────────┐     ┌──────────┐ │
│  │ SOURCES       1 │  →   │ PIPELINE             │  →  │ OUTPUT   │ │
│  ├─────────────────┤      ├──────────────────────┤     ├──────────┤ │
│  │                 │      │                      │     │          │ │
│  │  📄 sample.json │      │ Record Types Found:  │     │ SET NAME │ │
│  │  71 records     │      │                      │     │ [sample] │ │
│  │  72 fields      │      │ ┌──────────────────┐ │     │          │ │
│  │                 │      │ │ ☐ 👤 Person (42) │ │     │ 71 REC   │ │
│  │                 │      │ │   └ 3 specific   │ │     │ 72 FLD   │ │
│  │                 │      │ │     fields       │ │     │          │ │
│  │                 │      │ │                  │ │     │ LENSES:  │ │
│  │                 │      │ │ ☐ 🏢 Company(15)│ │     │ Person   │ │
│  │                 │      │ │   └ 4 specific   │ │     │ Company  │ │
│  │                 │      │ │     fields       │ │     │ Product  │ │
│  │                 │      │ │                  │ │     │          │ │
│  │                 │      │ │ ☐ 📦 Product(14)│ │     │          │ │
│  │                 │      │ │   └ 5 specific   │ │     │          │ │
│  │                 │      │ │     fields       │ │     │          │ │
│  │                 │      │ └──────────────────┘ │     │          │ │
│  │                 │      │                      │     │          │ │
│  │                 │      │ ○ Create as views    │     │          │ │
│  │                 │      │ ● Create as lenses   │     │          │ │
│  │                 │      │ ○ Create separate    │     │          │ │
│  │                 │      │   sets               │     │          │ │
│  │                 │      │                      │     │          │ │
│  │ [+ Add Source]  │      │ [▽ Add Filter]       │     │ [Preview]│ │
│  │                 │      │ [☐ Select Fields]    │     │          │ │
│  └─────────────────┘      └──────────────────────┘     └──────────┘ │
│                                                                      │
│  🔗 Derived from 1 source              [Cancel]   [Create Set]       │
└──────────────────────────────────────────────────────────────────────┘
```

### Lens Configuration UI

When user selects "Create as lenses", they can configure each:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Configure Lens: Person                                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Name: [Person Contacts  ]    Icon: [👤 ▼]    Color: [🔵]            │
│                                                                      │
│  Fields to include:                  Type-specific settings:         │
│  ┌────────────────────────────┐     ┌───────────────────────────┐   │
│  │ ☑ name        (common)    │     │ email:                    │   │
│  │ ☑ description (common)    │     │   Type: [Email      ▼]    │   │
│  │ ☑ email       (specific)  │     │   Validate: [✓]           │   │
│  │ ☑ phone       (specific)  │     │                           │   │
│  │ ☐ industry    (other type)│     │ phone:                    │   │
│  │ ☐ founded     (other type)│     │   Type: [Phone      ▼]    │   │
│  └────────────────────────────┘     │   Format: [US        ▼]   │   │
│                                     └───────────────────────────┘   │
│                                                                      │
│  42 records will be in this lens                                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Workbench View with Lenses

In the main workbench, lenses appear as collapsible sub-items under a Set:

```
┌──────────────────────────────────────────────────────────────────────┐
│  SETS                                                                │
├──────────────────────────────────────────────────────────────────────┤
│  📊 CRM Data (71 records)                              [▼]           │
│  ├─ 👤 Person (42)                                                   │
│  │    └─ Table | Cards                                               │
│  ├─ 🏢 Company (15)                                                  │
│  │    └─ Table | Kanban                                              │
│  └─ 📦 Product (14)                                                  │
│       └─ Table | Gallery                                             │
│                                                                      │
│  📊 Other Set (100 records)                            [▶]           │
└──────────────────────────────────────────────────────────────────────┘
```

## Behavior Details

### Record Assignment

Records are automatically assigned to lenses based on the type selector:
- On import: Records assigned based on type field value
- On record creation: User selects lens or uses default
- On type change: Record moves to appropriate lens

### Orphan Handling

When a record's type value doesn't match any lens:
- **default**: Assign to default lens
- **reject**: Prevent creation/update
- **unassigned**: Keep in Set but no lens (visible in "All Records")

### Schema Independence

Each lens maintains its own field list:
- Lens fields reference Set fields but with lens-specific configuration
- Field types can be refined (text → email within Person lens)
- Field order and visibility are lens-specific

### Cross-Lens Operations

Some operations work across lenses:
- Search: Can search across all lenses or within specific lens
- Export: Can export entire Set or specific lens
- Formula fields: Can reference data across lenses

## EO Compliance

### Epistemic Status

- **SOURCE**: GIVEN (immutable external data)
- **SET**: MEANT (interpreted dataset)
- **LENS**: MEANT (type-scoped interpretation within a Set)
- **VIEW**: MEANT (display configuration within a Lens or Set)

### Provenance Chain

```
Source (file import)
  → Set (interpretation)
    → Lens (type-scoped subset)
      → View (display configuration)
```

Each lens carries provenance:
```javascript
lensProvenance: {
  strategy: "partition",              // Lens was created by partitioning
  parentSetId: "set_xxx",
  typeSelector: { field, op, value },
  derivedAt: "2024-01-15T...",
  derivedBy: "user_xxx"
}
```

### Grounding

Lens fields ground in Set fields, which ground in Source columns:
```
Lens:Person.email
  → Set:CRM.email
    → Source:data.json.email_address
```

## Migration Path

### Phase 1: Views as Proto-Lenses
Current record-type views are conceptual predecessors to lenses. They can be upgraded:
```
existing view (type filter + hidden fields) → lens
```

### Phase 2: Lens Creation
- New "Create as lenses" option in Create Set modal
- Auto-detection of record types triggers lens recommendation
- Manual lens creation from existing Set

### Phase 3: Full Lens Capabilities
- Lens-specific field types
- Lens-scoped operations
- Lens detachment to independent Sets

## Open Questions

1. **Field Inheritance**: Should lens fields fully inherit Set field changes, or should lenses "snapshot" field configs?

2. **Cross-Lens Records**: Should a record ever belong to multiple lenses? (Current: no, single type)

3. **Lens-Level Permissions**: Should lenses have independent access controls?

4. **Lens Formulas**: Can a formula in one lens reference data from another lens?

5. **Lens Aggregation**: When showing Set-level aggregations, how do lens boundaries affect calculations?

6. **Visual Hierarchy**: How prominent should lenses be vs. views? Are they peers or is a lens more like a "sub-set"?

## Alternatives Considered

### A. Enhanced Views Only
Keep views but add field customization per view.
- **Pro**: Simpler model
- **Con**: Views are display-only; schema customization feels misplaced

### B. Auto-Split to Separate Sets
Automatically create separate Sets per type.
- **Pro**: Maximum independence
- **Con**: Loses relationship between records; hard to query across types

### C. Virtual Sets (Aliases)
Create lightweight Set "aliases" that filter another Set.
- **Pro**: Memory efficient
- **Con**: Still shares schema; doesn't solve field customization

**Recommendation**: Lenses provide the right balance—type isolation with maintained relationships.

## Summary

**Lenses** are type-scoped subsets within a Set that provide:
- Independent schemas per record type
- Type-specific field configuration
- Maintained provenance and relationships
- Clean separation while preserving queryability

This addresses the core limitation of views (display-only filtering) while avoiding the fragmentation of separate Sets.
