# Type-Based View Generation Design

## Overview

When importing JSON with a detected `type` field (or similar discriminator), the system automatically creates filtered views for each type. These views provide immediate organization without complex splitting logic.

**Two Levels:**

1. **Import Level (Source)** - Auto-generate subviews per detected type
2. **Elevate to Set** - Subviews become core views on the resulting set

---

## How It Works

### Current State (What We Already Have)

The import system already detects:
- Type field presence (`type`, `kind`, `category`, etc.)
- Unique type values (person, org, contract, etc.)
- Record counts per type
- Graph structure (nodes + edges)

```
┌─────────────────────────────────────────────────┐
│ Graph Data Detected                             │
│ 71 nodes (person, org, contract, property,      │
│ funding, payment, bank_account, document,       │
│ event, complaint, violation) and 97 edges       │
└─────────────────────────────────────────────────┘
```

### Proposed Enhancement

**On Import → Auto-create Subviews**

```
┌─────────────────────────────────────────────────────────────────┐
│  Import as Source                                               │
│                                                                 │
│  ✓ 11 types detected - creating views:                         │
│                                                                 │
│    📋 All Records (71)                                          │
│    ├── 👤 person (12)                                          │
│    ├── 🏢 org (8)                                               │
│    ├── 📄 contract (15)                                         │
│    ├── 🏠 property (9)                                          │
│    ├── 💰 funding (7)                                           │
│    ├── 💳 payment (6)                                           │
│    ├── 🏦 bank_account (4)                                      │
│    ├── 📑 document (5)                                          │
│    ├── 📅 event (3)                                             │
│    ├── ⚠️ complaint (1)                                         │
│    └── 🚫 violation (1)                                         │
│                                                                 │
│  [x] Create views per type (recommended)                        │
└─────────────────────────────────────────────────────────────────┘
```

**On Elevate to Set → Views Become Core Views**

When user elevates the source to a set:
- All type-based views transfer as "core views"
- Core views are non-deletable, always available
- User can still create additional custom views

---

## Data Model

### Source with Subviews

```javascript
{
  id: "source_123",
  name: "sample.json",
  type: "source",
  records: [...],
  fields: [...],

  // NEW: Subviews on source
  views: [
    {
      id: "view_all",
      name: "All Records",
      isCore: true,
      filter: null
    },
    {
      id: "view_person",
      name: "person",
      isCore: true,
      filter: { field: "type", operator: "equals", value: "person" },
      icon: "user"  // Auto-assigned or user-customizable
    },
    {
      id: "view_org",
      name: "org",
      isCore: true,
      filter: { field: "type", operator: "equals", value: "org" },
      icon: "building"
    },
    // ... one view per type
  ]
}
```

### Set with Core Views

```javascript
{
  id: "set_456",
  name: "sample",
  type: "set",
  records: [...],
  fields: [...],

  views: [
    {
      id: "view_all",
      name: "All Records",
      isCore: true,        // Cannot be deleted
      isDefault: true,     // Shows by default
      filter: null
    },
    {
      id: "view_person",
      name: "person",
      isCore: true,        // Transferred from source
      filter: { field: "type", operator: "equals", value: "person" }
    },
    // ... core views from import
    {
      id: "view_custom_1",
      name: "High Value",
      isCore: false,       // User-created, can be deleted
      filter: { field: "amount", operator: "gt", value: 10000 }
    }
  ],

  // Track provenance
  elevatedFrom: "source_123"
}
```

---

## Implementation

### 1. Import Analysis (Existing + Enhancement)

```javascript
// In ImportAnalyzer
_analyzeTypeField(records, typeFieldName = 'type') {
  const typeCounts = new Map();

  for (const record of records) {
    const typeValue = record[typeFieldName];
    if (typeValue) {
      typeCounts.set(typeValue, (typeCounts.get(typeValue) || 0) + 1);
    }
  }

  return {
    typeField: typeFieldName,
    types: Array.from(typeCounts.entries()).map(([type, count]) => ({
      value: type,
      count,
      suggestedIcon: this._suggestIconForType(type)
    })),
    totalTypes: typeCounts.size
  };
}

_suggestIconForType(typeName) {
  const iconMap = {
    person: 'user',
    people: 'users',
    org: 'building',
    organization: 'building',
    company: 'building',
    contract: 'file-text',
    document: 'file',
    property: 'home',
    payment: 'credit-card',
    funding: 'dollar-sign',
    bank_account: 'landmark',
    event: 'calendar',
    complaint: 'alert-triangle',
    violation: 'x-circle'
  };
  return iconMap[typeName.toLowerCase()] || 'circle';
}
```

### 2. View Generation on Import

```javascript
// In ImportOrchestrator
_createTypeViews(typeAnalysis) {
  const views = [
    {
      id: generateId(),
      name: 'All Records',
      isCore: true,
      isDefault: true,
      filter: null
    }
  ];

  for (const { value, count, suggestedIcon } of typeAnalysis.types) {
    views.push({
      id: generateId(),
      name: value,
      isCore: true,
      icon: suggestedIcon,
      filter: {
        field: typeAnalysis.typeField,
        operator: 'equals',
        value: value
      },
      recordCount: count  // For display in UI
    });
  }

  return views;
}
```

### 3. Elevate Source to Set

```javascript
// In DataWorkbench
async elevateSourceToSet(sourceId, options = {}) {
  const source = this.getSource(sourceId);

  const set = {
    id: generateId(),
    name: options.name || source.name,
    fields: [...source.fields],
    records: [...source.records],

    // Transfer views, marking as core
    views: source.views.map(view => ({
      ...view,
      isCore: true  // All source views become core views
    })),

    // Provenance
    elevatedFrom: sourceId,
    createdAt: new Date().toISOString()
  };

  this.addSet(set);

  return set;
}
```

---

## UI Updates

### Source View Selector

```
┌─────────────────────────────────────────────────┐
│ 📦 sample.json                        [Source]  │
├─────────────────────────────────────────────────┤
│ Views:                                          │
│ ┌─────────────────────────────────────────────┐│
││ 📋 All Records          71  │ ← selected     ││
│├─────────────────────────────────────────────┤│
││ 👤 person               12                   ││
││ 🏢 org                   8                   ││
││ 📄 contract             15                   ││
││ 🏠 property              9                   ││
││ 💰 funding               7                   ││
││ 💳 payment               6                   ││
││ 🏦 bank_account          4                   ││
││ 📑 document              5                   ││
││ 📅 event                 3                   ││
││ ⚠️ complaint             1                   ││
││ 🚫 violation             1                   ││
│└─────────────────────────────────────────────┘│
│                                                 │
│ [Elevate to Set]                               │
└─────────────────────────────────────────────────┘
```

### Set View Selector (After Elevation)

```
┌─────────────────────────────────────────────────┐
│ 📊 sample                              [Set]    │
├─────────────────────────────────────────────────┤
│ Core Views:                                     │
│   📋 All Records          71                    │
│   👤 person               12                    │
│   🏢 org                   8                    │
│   📄 contract             15                    │
│   ...                                           │
│                                                 │
│ Custom Views:                                   │
│   ➕ Add View                                   │
└─────────────────────────────────────────────────┘
```

---

## Edge Handling

### What if Type Field Changes?

If user modifies records after import:
- Core views remain (filter still applies)
- New types won't auto-generate views (user creates manually)
- Empty core views show 0 records (not hidden)

### Multiple Discriminator Fields?

Some datasets have multiple type-like fields:
```json
{ "type": "person", "role": "employee", "department": "engineering" }
```

**Options:**
1. Primary type field creates core views (default: `type`)
2. User can select which field to use during import
3. Future: Nested views (type → role → department)

### No Type Field?

If no discriminator detected:
- Single "All Records" view created
- User can manually create views after import/elevation

---

## Implementation Phases

### Phase 1: Core Implementation
- [ ] Add `views` array to source data model
- [ ] Generate type-based views on JSON import
- [ ] Add view selector UI to source panel
- [ ] Filter records based on selected view

### Phase 2: Elevate with Views
- [ ] Transfer views on elevate to set
- [ ] Mark transferred views as `isCore: true`
- [ ] Distinguish core vs custom views in UI
- [ ] Prevent deletion of core views

### Phase 3: Polish
- [ ] Icon auto-assignment for common types
- [ ] View record counts in selector
- [ ] User override of type field selection
- [ ] Persist view selection per source/set

---

## Benefits of This Approach

| vs. Full Splitting | Benefit |
|--------------------|---------|
| Simpler implementation | Views are just filters, no data restructuring |
| Preserves original data | No need for merge/undo operations |
| Familiar UX | Users already understand views |
| Incremental | Can add more sophisticated splitting later |
| Fast | No data transformation on import |

The type-based views give 80% of the value of full splitting with 20% of the complexity.
