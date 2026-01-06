# Intelligent Linked Records Viewing Design

## Executive Summary

noema's event-sourced, local-first architecture provides unique advantages for linked record viewing that sidestep traditional schema-first limitations.

---

## Schema-First Limitations That DON'T Affect Us

### 1. **N+1 Query Problem** ❌ NOT A PROBLEM

**Traditional Schema-First Pain:**
```sql
-- Load 100 records, then 100 separate queries for linked records
SELECT * FROM orders;           -- 1 query
SELECT * FROM customers WHERE id = ?;  -- N queries
```

**Why noema is Different:**
- All data is local (IndexedDB) - no network latency
- Entities are derived from event log in memory
- Can resolve unlimited links in O(1) per link via index lookups
- No database connection overhead

### 2. **Schema Migration Complexity** ❌ NOT A PROBLEM

**Traditional Pain:**
- Adding a relationship field requires ALTER TABLE
- Changing relationship type requires data migration
- Breaking changes require coordinated deploys

**Why noema is Different:**
- Event sourcing preserves historical interpretations
- Schema is a "Meant" (interpretation) not a constraint
- Old events don't break when schema evolves
- Can retroactively reinterpret relationships

### 3. **Circular Reference Handling** ❌ NOT A PROBLEM

**Traditional Pain:**
```javascript
// ORMs explode or require special config
user.posts.author.posts.author... // Stack overflow
```

**Why noema is Different:**
- Graph system already handles cycles (noema_graph.js)
- Visited-set tracking in traversal (getProvenanceChain)
- Visualization layouts designed for cycles
- Max-depth controls prevent infinite expansion

### 4. **Deep Nesting Performance** ❌ NOT A PROBLEM

**Traditional Pain:**
- SQL JOINs degrade exponentially with depth
- 5+ level joins become prohibitively slow
- Must denormalize or use graph databases

**Why noema is Different:**
- Local storage = O(1) access per entity
- No JOIN operation - direct ID lookup
- Can traverse 100+ levels without network cost
- Memory is the only constraint (abundant on modern devices)

### 5. **Cross-Schema Queries** ❌ NOT A PROBLEM

**Traditional Pain:**
- Different tables need explicit JOINs
- Cross-database relationships require federation
- Schema boundaries create query silos

**Why noema is Different:**
- All Sets live in same entity namespace
- LINK field simply references any Set by ID
- Entity derivation doesn't care about Set boundaries
- Can query relationships across any Set types

### 6. **Relationship Cardinality Enforcement** ❌ NOT A PROBLEM

**Traditional Pain:**
- Foreign keys enforce 1:1, 1:N, N:M at DB level
- Changing cardinality requires schema migration
- Orphaned references cause errors

**Why noema is Different:**
- LINK field's `allowMultiple` is interpretive, not enforced
- Orphaned links gracefully show ID as fallback
- Can change cardinality without data loss
- Events preserve what WAS linked even if target deleted

### 7. **Permission Inheritance Complexity** ❌ NOT A PROBLEM

**Traditional Pain:**
- Row-level security on linked records is complex
- "Can see order but not customer" requires views
- Cascading permissions need recursive checks

**Why noema is Different:**
- Horizon Lattice provides natural scope boundaries
- Link visibility respects horizon inclusion
- Perspectival views automatically filter
- No special permission JOIN logic needed

---

## Intelligent Viewing Opportunities

### 1. **Inline Record Expansion**

```
┌─────────────────────────────────────────────────────────────┐
│ Task: "Design homepage"                                     │
│ Status: In Progress                                         │
│ Assignee: [▼ Sarah Chen]                                    │
│           ┌─────────────────────────────────────┐           │
│           │ 📧 sarah@example.com                │           │
│           │ 🏢 Engineering                       │           │
│           │ 📊 5 other tasks assigned           │           │
│           └─────────────────────────────────────┘           │
│ Project: [Homepage Redesign →]                              │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Approach:**
- Click/hover on link chip expands inline panel
- Show primary field + configurable "preview fields"
- Include rollup summary (count of backlinks)
- "→" link navigates to full record

### 2. **Bi-directional Link Discovery**

Show automatic backlinks without explicit reverse-link fields:

```javascript
// Scan all Sets for LINK fields pointing to this record
function findBacklinks(recordId, targetSetId) {
  const backlinks = [];

  for (const set of this.sets) {
    const linkFields = set.fields.filter(f =>
      f.type === 'link' && f.options.linkedSetId === targetSetId
    );

    for (const record of set.records) {
      for (const field of linkFields) {
        if (record.values[field.id]?.includes(recordId)) {
          backlinks.push({ set, record, field });
        }
      }
    }
  }

  return backlinks;
}
```

**Display:**
```
┌─────────────────────────────────────────────────────────────┐
│ Customer: "Acme Corp"                                       │
├─────────────────────────────────────────────────────────────┤
│ ⬇️ LINKED FROM (backlinks)                                  │
│   Orders (3): #001, #002, #003                              │
│   Support Tickets (1): "API Integration Help"               │
│   Invoices (3): INV-2024-001, INV-2024-002...              │
└─────────────────────────────────────────────────────────────┘
```

### 3. **Relationship Graph View**

Leverage existing `noema_graph.js` for linked record visualization:

```
                    ┌──────────────┐
                    │   Project    │
                    │  "Homepage"  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌────▼────┐ ┌─────▼─────┐
        │   Task    │ │  Task   │ │   Task    │
        │ "Design"  │ │ "Build" │ │ "Deploy"  │
        └─────┬─────┘ └────┬────┘ └───────────┘
              │            │
        ┌─────▼─────┐ ┌────▼────┐
        │   User    │ │  User   │
        │  "Sarah"  │ │ "Mike"  │
        └───────────┘ └─────────┘
```

**New Edge Type:**
```javascript
// Add to GraphEdgeType
RECORD_LINK: 'record_link'  // Direct record-to-record relationship
```

### 4. **Multi-Hop Traversal View**

Show relationship chains with depth control:

```
Customer → Orders → Line Items → Products → Suppliers

[Depth: 1] [2] [3] [4]  [Relationship Path: ________________]

Starting from: "Acme Corp"
├─ Orders (3 records)
│  └─ Line Items (12 records)
│     └─ Products (8 unique)
│        └─ Suppliers (3 unique)
```

**Implementation:**
```javascript
function traverseLinks(record, depth = 2, visited = new Set()) {
  if (depth === 0 || visited.has(record.id)) return { record, children: [] };
  visited.add(record.id);

  const set = this.sets.find(s => s.id === record.setId);
  const linkFields = set.fields.filter(f => f.type === 'link');

  const children = [];
  for (const field of linkFields) {
    const linkedIds = record.values[field.id] || [];
    const linkedSet = this.sets.find(s => s.id === field.options.linkedSetId);

    for (const linkedId of linkedIds) {
      const linkedRecord = linkedSet?.records.find(r => r.id === linkedId);
      if (linkedRecord) {
        children.push({
          field: field.name,
          ...traverseLinks(linkedRecord, depth - 1, visited)
        });
      }
    }
  }

  return { record, children };
}
```

### 5. **Provenance-Traced Relationships**

Show WHY records are linked (unique to noema):

```
┌─────────────────────────────────────────────────────────────┐
│ Link: Task "Design" → User "Sarah"                          │
├─────────────────────────────────────────────────────────────┤
│ 📜 Provenance Trail                                         │
│                                                             │
│ Given: "Received Slack message from @manager"               │
│   ↓ interpreted as                                          │
│ Meant: "Assign Sarah to Design task"                        │
│   ↓ recorded at                                             │
│ Timestamp: 2024-01-15 10:32:04                              │
│ Actor: workspace_admin                                       │
└─────────────────────────────────────────────────────────────┘
```

### 6. **Contextual Field Selection**

Smart preview showing relevant fields based on context:

```javascript
// Determine preview fields based on viewing context
function getContextualPreviewFields(linkedSet, viewingContext) {
  const primary = linkedSet.fields.find(f => f.isPrimary);

  // Context-aware field selection
  const contextFields = {
    // When viewing from Orders, show customer contact info
    'Order.Customer': ['email', 'phone', 'company'],
    // When viewing from Tasks, show user's current load
    'Task.Assignee': ['email', 'department', 'activeTaskCount'],
    // When viewing from Invoice, show payment status
    'Invoice.Customer': ['balance', 'paymentTerms', 'lastPayment']
  };

  const key = `${viewingContext.setName}.${viewingContext.fieldName}`;
  const extraFields = contextFields[key] || [];

  return [primary, ...linkedSet.fields.filter(f =>
    extraFields.includes(f.name)
  )];
}
```

### 7. **Aggregate Rollups Across Links**

Auto-compute statistics from linked records:

```
┌─────────────────────────────────────────────────────────────┐
│ Customer: "Acme Corp"                                       │
├─────────────────────────────────────────────────────────────┤
│ 📊 Computed from Links                                      │
│                                                             │
│ Total Orders: 47                                            │
│ Total Revenue: $125,340                                     │
│ Avg Order Value: $2,667                                     │
│ Open Support Tickets: 2                                     │
│ Last Activity: 3 days ago                                   │
└─────────────────────────────────────────────────────────────┘
```

### 8. **Link Health Indicators**

Visual indicators for link status:

```
┌──────────────────────────────────────────────────┐
│ Related Records                                  │
│                                                  │
│ [✓ Active Customer] - linked, accessible         │
│ [⚠ Archived Project] - linked, but archived     │
│ [❌ #deleted_123] - orphaned reference           │
│ [🔒 Confidential Doc] - linked, no horizon access│
└──────────────────────────────────────────────────┘
```

---

## Proposed Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   LinkedRecordViewer                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ LinkResolutionService                                │   │
│  │ - resolveLink(recordId) → DerivedEntity             │   │
│  │ - findBacklinks(recordId) → BacklinkResult[]        │   │
│  │ - traverseLinks(record, depth) → LinkTree           │   │
│  │ - getProvenance(linkEvent) → ProvenanceChain        │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│  ┌────────────┬───────────┼───────────┬────────────┐       │
│  │            │           │           │            │       │
│  ▼            ▼           ▼           ▼            ▼       │
│ Inline     Backlink    Graph      Multi-hop    Rollup     │
│ Expander   Panel       View       Navigator    Calculator  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

| Feature | Complexity | Value | Priority |
|---------|------------|-------|----------|
| Inline Expansion | Low | High | P0 |
| Backlink Discovery | Medium | High | P0 |
| Link Health Indicators | Low | Medium | P1 |
| Contextual Previews | Medium | Medium | P1 |
| Multi-hop Traversal | Medium | High | P1 |
| Graph Integration | Low* | High | P1 |
| Provenance Display | Medium | Medium | P2 |
| Aggregate Rollups | High | Medium | P2 |

*Low because noema_graph.js already exists

---

## Key Advantages Summary

| Traditional Schema-First | noema Approach |
|--------------------------|------------------|
| Network-bound queries | Local-first, instant |
| Rigid cardinality | Flexible interpretation |
| Schema migrations | Append-only evolution |
| Orphan errors | Graceful degradation |
| Permission complexity | Horizon-based scoping |
| Cycle prevention | Graph-native handling |

The event-sourced, local-first architecture means we can implement features that would be prohibitively expensive in traditional systems - like showing full provenance trails for every link, computing real-time backlinks without explicit reverse fields, and traversing arbitrary-depth relationship chains without performance degradation.
