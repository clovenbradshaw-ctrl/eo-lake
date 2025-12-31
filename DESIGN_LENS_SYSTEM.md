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
| Schema | Shared (hides fields) | Independent per type with overrides | Fully independent |
| Records | References, filtered | Multi-membership (can be in multiple lenses) | Copied/split |
| Provenance | To parent Set | To parent Set + type | To Source directly |
| Operations | Affect all records | Scoped to lens | Fully isolated |
| Cross-type queries | Easy | Easy via parent Set | Manual joins |
| Field customization | None | Per-lens with bidirectional sync | Per-set |
| Field management | Set-only | Set-level with lens overrides | Per-set |
| Record overlap | N/A (display filter) | Supported (multi-lens membership) | None |

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

  // Flexible selector for multi-lens membership
  selector: {
    type: "field_match",                 // or "compound", "tag_match"
    fieldId: "fld_type",
    operator: "is",                      // "is", "in", "contains", etc.
    value: "person"
  },

  // Field overrides (not copies) - inherits from Set
  fieldOverrides: {
    "fld_email": {
      type: "email",                     // Override Set's "text" type
      validation: { required: true },
      displayName: "Work Email",         // Lens-local display name
      order: 2                           // Position in this lens
    },
    "fld_phone": {
      type: "phone",
      format: "US"
    }
  },

  // Which Set fields are included in this lens
  includedFields: ["fld_name", "fld_email", "fld_phone"],
  excludedFields: ["fld_industry", "fld_founded"],
  fieldOrder: ["fld_name", "fld_email", "fld_phone"],

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

  // Canonical field registry (Set level)
  fields: [
    {
      id: "fld_email",
      name: "email",
      type: "text",                      // Base type (can be overridden per lens)
      width: 200,
      isPrimary: false,
      sourceColumn: "email_address",
      validation: {}
    },
    // ... more fields
  ],

  lenses: [
    { id: "lens_person", ... },
    { id: "lens_company", ... },
    { id: "lens_sponsors", ... }         // Records can be in multiple lenses
  ],

  lensConfig: {
    autoCreateLenses: true,              // Auto-create lenses for new type values
    defaultLens: "lens_person",          // Default lens for manual record creation
    allowMultiMembership: true,          // Records can match multiple lens selectors
    orphanHandling: "unassigned"         // "default" | "reject" | "unassigned"
  },

  // Records remain at Set level, lenses reference them via selectors
  records: [
    {
      id: "rec_001",
      values: { ... },
      _lensIds: ["lens_person", "lens_sponsors"],  // Computed membership
      _lensMeta: { ... }                           // Per-lens metadata
    }
  ]
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

## Bidirectional Field Inheritance

Fields flow **both directions** between Set and Lens levels. The Set maintains the canonical field registry; lenses hold configuration overrides.

### Field Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│  SET: CRM Data                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  FIELD REGISTRY (canonical source of truth)               │  │
│  │  ┌─────────┬─────────┬─────────┬─────────┬─────────────┐  │  │
│  │  │ name    │ email   │ phone   │ industry│ employees   │  │  │
│  │  │ text    │ text    │ text    │ text    │ number      │  │  │
│  │  └────┬────┴────┬────┴────┬────┴────┬────┴──────┬──────┘  │  │
│  └───────┼─────────┼─────────┼─────────┼──────────┼──────────┘  │
│          │         │         │         │          │             │
│    ┌─────┴─────────┴─────────┴───┐ ┌───┴──────────┴─────┐       │
│    │  LENS: Person               │ │  LENS: Company     │       │
│    │  ┌─────────────────────┐    │ │  ┌──────────────┐  │       │
│    │  │ Field Overrides:    │    │ │  │ Overrides:   │  │       │
│    │  │ email → type:email  │    │ │  │ industry →   │  │       │
│    │  │ phone → type:phone  │    │ │  │  type:select │  │       │
│    │  │        format:US    │    │ │  │  options:[…] │  │       │
│    │  └─────────────────────┘    │ │  └──────────────┘  │       │
│    │  Included: name,email,phone │ │  Included: name,   │       │
│    │  Excluded: industry,empl.   │ │   industry,empl.   │       │
│    └─────────────────────────────┘ │  Excluded: email,  │       │
│                                    │   phone            │       │
│                                    └────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Change Propagation Rules

#### Set → Lens (Downward)

| Change at Set Level | Effect on Lenses |
|---------------------|------------------|
| Add field | Field available to all lenses (not auto-included) |
| Rename field | Name updates in all lenses (unless lens has override) |
| Change field type | Type updates in lenses (unless lens has override) |
| Delete field | Field removed from all lenses |
| Reorder fields | Base order updates (lens order takes precedence) |

#### Lens → Set (Upward)

| Change at Lens Level | Effect on Set |
|----------------------|---------------|
| Add override (type, format, validation) | Stored as lens-local override |
| "Promote" override to Set | Override becomes Set default, other lenses inherit |
| Add new field | Field added to Set registry, available to other lenses |
| Request field deletion | Must confirm; removes from Set and all lenses |

### Override Model

```javascript
// Set field (canonical)
{
  id: "fld_email",
  name: "Email",
  type: "text",                    // Base type
  width: 200,
  isPrimary: false,
  sourceColumn: "email_address"
}

// Lens field override (Person lens)
{
  fieldId: "fld_email",            // Reference to Set field
  overrides: {
    type: "email",                 // Refined type for this lens
    validation: {
      required: true,
      pattern: "^[^@]+@[^@]+$"
    }
  },
  lensSpecific: {
    displayName: "Work Email",     // Lens-local display name
    width: 250,                    // Lens-local width
    order: 2                       // Position in this lens
  }
}
```

### Propagation Examples

**Example 1: Set renames field**
```
Set: Rename "email" → "email_address"
  ↓
Person Lens: Field name updates to "email_address"
             (but displayName override "Work Email" preserved)
  ↓
Company Lens: Field name updates to "email_address"
```

**Example 2: Lens promotes override**
```
Person Lens: User clicks "Promote to Set" on email type:email
  ↓
Set: email field type changes from "text" to "email"
  ↓
Company Lens: email field now also type:email
              (can still override if needed)
```

**Example 3: Lens adds new field**
```
Person Lens: User adds "linkedin_url" field
  ↓
Set: "linkedin_url" added to field registry
  ↓
Company Lens: "linkedin_url" now available (not auto-included)
```

## Multi-Lens Record Membership

Records can belong to **multiple lenses simultaneously**. This enables modeling complex real-world relationships.

### Use Cases

1. **Contact at Company**: A person record can appear in both Person and Company lenses
2. **Product Categories**: A product can be in "Electronics" and "Sale Items" lenses
3. **Event Roles**: An attendee can be both "Speaker" and "Sponsor"
4. **Status + Type**: Combine type-based lenses with status-based lenses

### Membership Model

```
┌─────────────────────────────────────────────────────────────────┐
│  SET: Event Data                                                │
│                                                                 │
│  Records:                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ rec_001: Alice (type: person, role: speaker, sponsor: yes) │ │
│  │ rec_002: Bob (type: person, role: attendee)                │ │
│  │ rec_003: Acme Corp (type: company, sponsor: yes)           │ │
│  │ rec_004: Workshop A (type: session, track: technical)      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Lenses:                                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ 👤 People    │ │ 🎤 Speakers  │ │ 💰 Sponsors  │            │
│  │              │ │              │ │              │            │
│  │ Alice    ●───┼─┼──────●───────┼─┼──────●       │            │
│  │ Bob      ●   │ │              │ │              │            │
│  │              │ │              │ │ Acme     ●   │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                 │
│  Alice appears in: People, Speakers, Sponsors (3 lenses)        │
└─────────────────────────────────────────────────────────────────┘
```

### Selector Types

Lenses use **selectors** to determine membership. Multiple selector types enable flexible partitioning:

```javascript
// Type-based selector (original)
{
  type: "field_match",
  fieldId: "fld_type",
  operator: "is",
  value: "person"
}

// Multi-value selector
{
  type: "field_match",
  fieldId: "fld_role",
  operator: "in",
  values: ["speaker", "panelist", "moderator"]
}

// Boolean selector
{
  type: "field_match",
  fieldId: "fld_is_sponsor",
  operator: "is",
  value: true
}

// Compound selector (AND)
{
  type: "compound",
  operator: "and",
  selectors: [
    { type: "field_match", fieldId: "fld_type", operator: "is", value: "person" },
    { type: "field_match", fieldId: "fld_status", operator: "is", value: "active" }
  ]
}

// Tag-based selector
{
  type: "tag_match",
  tagField: "fld_tags",
  hasTag: "vip"
}
```

### Multi-Membership Data Model

```javascript
// Record with multi-lens membership
{
  id: "rec_001",
  setId: "set_xxx",
  values: {
    fld_name: "Alice",
    fld_type: "person",
    fld_role: "speaker",
    fld_is_sponsor: true,
    fld_email: "alice@example.com",
    fld_company: "Acme Corp"
  },

  // Computed membership (cached, recomputed on change)
  _lensIds: ["lens_people", "lens_speakers", "lens_sponsors"],

  // Per-lens metadata (optional)
  _lensMeta: {
    "lens_speakers": {
      sessionCount: 3,
      addedAt: "2024-01-10T..."
    },
    "lens_sponsors": {
      tier: "gold",
      addedAt: "2024-01-05T..."
    }
  }
}
```

### Membership Computation

```javascript
// On record change, recompute lens membership
function computeLensMembership(record, lenses) {
  return lenses
    .filter(lens => evaluateSelector(record, lens.selector))
    .map(lens => lens.id);
}

// Selector evaluation
function evaluateSelector(record, selector) {
  switch (selector.type) {
    case "field_match":
      const value = record.values[selector.fieldId];
      switch (selector.operator) {
        case "is": return value === selector.value;
        case "in": return selector.values.includes(value);
        case "contains": return value?.includes(selector.value);
        // ...
      }
    case "compound":
      if (selector.operator === "and") {
        return selector.selectors.every(s => evaluateSelector(record, s));
      } else {
        return selector.selectors.some(s => evaluateSelector(record, s));
      }
    case "tag_match":
      const tags = record.values[selector.tagField] || [];
      return tags.includes(selector.hasTag);
  }
}
```

### UI Implications

#### Record View Shows Lens Badges

```
┌─────────────────────────────────────────────────────────────┐
│  Alice Johnson                                              │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐                    │
│  │👤 Person│ │🎤 Speaker│ │💰 Sponsor │                    │
│  └─────────┘ └──────────┘ └───────────┘                    │
│                                                             │
│  Email: alice@example.com                                   │
│  Company: Acme Corp                                         │
│  Sessions: 3                                                │
└─────────────────────────────────────────────────────────────┘
```

#### Lens Stats Show Overlap

```
┌──────────────────────────────────────┐
│  LENSES                              │
├──────────────────────────────────────┤
│  👤 People     42 records            │
│  🎤 Speakers   12 records (10 people)│
│  💰 Sponsors   8 records  (3 people) │
│  📅 Sessions   25 records            │
│                                      │
│  ⓘ Some records appear in multiple  │
│    lenses. Total unique: 71          │
└──────────────────────────────────────┘
```

## Set-Level Field Management

Fields are managed at the Set level with a unified interface. Changes propagate to all lenses, with visibility into lens-specific overrides.

### Field Management UI

```
┌──────────────────────────────────────────────────────────────────────┐
│  Set: CRM Data › Field Management                               ✕    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ FIELDS                                               [+ Add]   │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ ⋮⋮ name                                                  │  │  │
│  │  │    Type: text    Primary: ✓                              │  │  │
│  │  │    Lenses: All (no overrides)                            │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ ⋮⋮ email                                                 │  │  │
│  │  │    Type: text                                            │  │  │
│  │  │    Lenses: 👤 Person (→ email, required)                 │  │  │
│  │  │            🏢 Company (→ text)                           │  │  │
│  │  │    ┌─────────────────────────────────────────────────┐   │  │  │
│  │  │    │ Override in Person: type=email, required=true   │   │  │  │
│  │  │    │                    [Promote to Set] [Remove]    │   │  │  │
│  │  │    └─────────────────────────────────────────────────┘   │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ ⋮⋮ industry                                              │  │  │
│  │  │    Type: text                                            │  │  │
│  │  │    Lenses: 🏢 Company only (→ select, options:[...])     │  │  │
│  │  │            ⚠️ Not in: 👤 Person                          │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Legend: → indicates lens-specific type override                     │
│                                                     [Done]           │
└──────────────────────────────────────────────────────────────────────┘
```

### Field Detail Panel

Clicking a field expands full details with lens breakdown:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Field: email                                                   [✕]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SET DEFAULTS                          LENS OVERRIDES                │
│  ┌─────────────────────────────┐      ┌─────────────────────────┐   │
│  │ Name: [email            ]   │      │ 👤 Person               │   │
│  │ Type: [text           ▼]   │      │ ┌─────────────────────┐ │   │
│  │ Width: [200]               │      │ │ Type: [email    ▼]  │ │   │
│  │                            │      │ │ Required: [✓]       │ │   │
│  │ Source column:             │      │ │ Display: [Work Email]│ │   │
│  │   email_address            │      │ │                     │ │   │
│  │                            │      │ │ [Promote] [Clear]   │ │   │
│  │ ☐ Required                 │      │ └─────────────────────┘ │   │
│  │ ☐ Unique                   │      │                         │   │
│  │                            │      │ 🏢 Company              │   │
│  │                            │      │ ┌─────────────────────┐ │   │
│  │ [Apply to All Lenses]      │      │ │ (using Set defaults)│ │   │
│  └─────────────────────────────┘      │ │                     │ │   │
│                                       │ │ [+ Add Override]    │ │   │
│                                       │ └─────────────────────┘ │   │
│                                       └─────────────────────────┘   │
│                                                                      │
│  USAGE                                                               │
│  ├─ 👤 Person: 42 records with values (100%)                        │
│  ├─ 🏢 Company: 8 records with values (53%)                         │
│  └─ Total: 50 / 71 records (70%)                                    │
│                                                     [Delete Field]   │
└──────────────────────────────────────────────────────────────────────┘
```

### Operations

#### "Promote to Set"
Takes a lens override and makes it the Set default:
```
Before: Set(email: text), Person(email: override→email)
After:  Set(email: email), Person(no override)
```

#### "Apply to All Lenses"
Pushes Set defaults to all lenses, clearing overrides:
```
Before: Set(email: email), Person(email: text override)
After:  Set(email: email), Person(email: email, no override)
```

#### "Clear Override"
Removes lens-specific override, lens inherits Set default:
```
Before: Person(email: override→text)
After:  Person(inherits Set default)
```

### Data Model Update

```javascript
// Set with field registry
{
  id: "set_xxx",
  name: "CRM Data",

  // Canonical field registry (Set level)
  fields: [
    {
      id: "fld_email",
      name: "email",
      type: "text",              // Set default
      width: 200,
      isPrimary: false,
      sourceColumn: "email_address",
      validation: {},
      // Track which lenses include this field
      lensInclusion: {
        "lens_person": true,     // Included
        "lens_company": true,    // Included
        "lens_product": false    // Excluded
      }
    }
  ],

  lenses: [
    {
      id: "lens_person",
      name: "Person",
      selector: { ... },

      // Only overrides stored here (not full field copies)
      fieldOverrides: {
        "fld_email": {
          type: "email",         // Override type
          validation: { required: true },
          displayName: "Work Email",
          order: 2
        }
      },

      // Computed: which fields are in this lens
      includedFields: ["fld_name", "fld_email", "fld_phone"],

      views: [...]
    }
  ]
}
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

## Design Decisions

1. **Field Inheritance**: ✅ **Bidirectional** - Changes flow both ways between Set and Lens fields. See [Bidirectional Field Inheritance](#bidirectional-field-inheritance).

2. **Cross-Lens Records**: ✅ **Yes** - Records can belong to multiple lenses simultaneously. See [Multi-Lens Record Membership](#multi-lens-record-membership).

3. **Set-Level Field Management**: ✅ **Yes** - Fields can be managed at Set level with changes propagating to lenses. See [Set-Level Field Management](#set-level-field-management).

## Open Questions

1. **Lens-Level Permissions**: Should lenses have independent access controls?

2. **Lens Formulas**: Can a formula in one lens reference data from another lens?

3. **Lens Aggregation**: When showing Set-level aggregations, how do lens boundaries affect calculations?

4. **Visual Hierarchy**: How prominent should lenses be vs. views? Are they peers or is a lens more like a "sub-set"?

5. **Conflict Resolution**: When a field is modified at both Set and Lens level simultaneously, which wins?

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
- Independent schemas per record type with **bidirectional field inheritance**
- Type-specific field configuration via **overrides** (not copies)
- **Multi-lens membership** - records can belong to multiple lenses simultaneously
- **Set-level field management** with visibility into per-lens overrides
- Maintained provenance and relationships
- Clean separation while preserving queryability

### Key Design Decisions

1. **Bidirectional Field Flow**: Set maintains canonical field registry; lenses hold overrides. Changes propagate both directions with "Promote to Set" and "Apply to All" operations.

2. **Multi-Lens Membership**: Records can match multiple lens selectors (e.g., a person can be in "People", "Speakers", and "Sponsors" lenses).

3. **Unified Field Management**: Fields are managed at Set level with full visibility into which lenses include each field and what overrides exist.

This addresses the core limitation of views (display-only filtering) while avoiding the fragmentation of separate Sets.
