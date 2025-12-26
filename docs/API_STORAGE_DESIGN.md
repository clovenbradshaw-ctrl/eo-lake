# API Storage Design: Operator-Driven Data Architecture

## Executive Summary

This document proposes an API storage layer for EO Lake that leverages the 9 EO operators as the semantic foundation for intelligent, demand-driven data synchronization. Instead of "download everything" or "manual fetch," we implement **operator-driven streaming** where the activity stream itself describes what data is needed and when.

---

## Part I: Core Insight — Operators as Data Requests

### The Traditional Problem

Traditional APIs force a choice:
- **Download all** → Massive bandwidth, slow startup, wasted storage
- **Query on demand** → High latency, poor offline experience
- **Smart caching** → Complex invalidation, stale data

### The EO Solution: Operator-Semantic Streaming

Every user action in EO is an operator. Every operator implies a data requirement:

| Operator | Data Requirement |
|----------|------------------|
| **NUL (∅)** | Know what's *missing* (requires metadata about expected vs present) |
| **DES (⊡)** | Definition schemas, type hierarchies, term registries |
| **INS (△)** | Write path — outbound only, queued for sync |
| **SEG (｜)** | Filter criteria → only fetch matching subset |
| **CON (⋈)** | Relationship traversal → fetch connected entities on demand |
| **ALT (∿)** | Definition switch → may require alternate definition schemas |
| **SYN (∨)** | Aggregation → can be computed server-side, send only result |
| **SUP (⊕)** | Multiple truths → fetch all sources for conflict resolution |
| **REC (⟳)** | Re-centering → may trigger new perspective's data requirements |

**Key Insight**: The activity stream *is* the demand signal. We don't need a separate caching layer—we stream operators and fulfill their implied data needs.

---

## Part II: Activity Stream Architecture

### 2.1 What the Activity Stream Actually Is

The activity stream is **not** a log of completed actions. It's a **bidirectional operator channel**:

```
┌─────────────────────────────────────────────────────────────────┐
│                     ACTIVITY STREAM                              │
│                                                                  │
│  ┌──────────────┐                          ┌──────────────┐     │
│  │   CLIENT     │  ═══════════════════════ │   SERVER     │     │
│  │              │                          │              │     │
│  │  User Action │ ──── Operator Intent ─── │  Resolve &   │     │
│  │     │        │                          │  Fulfill     │     │
│  │     ▼        │                          │     │        │     │
│  │  Operator    │ ◄─── Data Slice ──────── │     ▼        │     │
│  │  Execution   │                          │  Data        │     │
│  │     │        │                          │  Selection   │     │
│  │     ▼        │                          │              │     │
│  │  Local State │                          │              │     │
│  └──────────────┘                          └──────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Stream Message Types

```typescript
// Client → Server (Operator Intents)
type OperatorIntent = {
  id: string;                    // Request correlation ID
  timestamp: ISO8601;
  actor: ActorRef;
  horizon: HorizonRef;           // Current perspective

  operator: {
    type: 'NUL' | 'DES' | 'INS' | 'SEG' | 'CON' | 'ALT' | 'SYN' | 'SUP' | 'REC';
    params: OperatorParams;
  };

  // Optimization hints
  hints: {
    localEventCount: number;     // How much we already have
    lastSyncClock: number;       // Our last known server state
    prefetchDepth: number;       // How deep to prefetch relationships
  };
};

// Server → Client (Data Fulfillment)
type DataSlice = {
  requestId: string;             // Correlates to OperatorIntent.id

  // The actual data (minimal)
  events: Event[];               // Only what's needed for this operator

  // Metadata for smart caching
  meta: {
    totalMatching: number;       // How many total match (for pagination)
    horizon: HorizonRef;         // Under which perspective
    expiresAt?: ISO8601;         // When this slice goes stale
    continuationToken?: string;  // For pagination/streaming
  };

  // Prefetched relationship hints
  relationships: {
    entityId: string;
    relationType: string;
    targetCount: number;         // How many related, not the data itself
  }[];
};
```

### 2.3 The SEG Operator: Smart Filtering

The most common data request is **SEG** (segmentation/filtering). Here's how it avoids downloading everything:

```typescript
// User opens a "Active Deals" view
// Client sends:
{
  operator: {
    type: 'SEG',
    params: {
      collection: 'deals',
      filter: { status: 'active' },
      sort: { field: 'updatedAt', order: 'desc' },
      limit: 50,
      offset: 0
    }
  },
  hints: {
    localEventCount: 23,  // We have 23 deal events locally
    lastSyncClock: 15847
  }
}

// Server responds:
{
  events: [...],  // Only 27 new/changed events since clock 15847
  meta: {
    totalMatching: 156,  // 156 total active deals exist
    horizon: 'workspace:sales'
  },
  relationships: [
    { entityId: 'deal_1', relationType: 'customer', targetCount: 1 },
    { entityId: 'deal_1', relationType: 'contacts', targetCount: 3 }
    // We know relationships exist, but don't download them yet
  ]
}
```

**Result**: Instead of downloading all deals (could be 10,000+), we get:
- Only changed events (delta sync)
- Only matching filter (active only)
- Only first page (limit 50)
- Relationship *counts* not data (fetch on demand)

### 2.4 The CON Operator: Relationship Traversal

When user expands a relationship, CON triggers targeted fetch:

```typescript
// User clicks "View Customer" on Deal
{
  operator: {
    type: 'CON',
    params: {
      sourceEntity: 'deal_abc123',
      relationship: 'customer',
      traversal: 'outbound'
    }
  },
  hints: {
    prefetchDepth: 1  // Get customer + their immediate properties
  }
}

// Server responds with just that customer:
{
  events: [
    { type: 'given', entity: 'customer_xyz', ... },
    // Customer's observations
  ],
  relationships: [
    { entityId: 'customer_xyz', relationType: 'deals', targetCount: 7 },
    { entityId: 'customer_xyz', relationType: 'contacts', targetCount: 12 }
  ]
}
```

### 2.5 The SYN Operator: Server-Side Aggregation

For aggregations, we don't download raw data—we request the synthesis:

```typescript
// User views "Revenue by Quarter" dashboard
{
  operator: {
    type: 'SYN',
    params: {
      collection: 'deals',
      groupBy: 'quarter',
      aggregate: { field: 'amount', mode: 'sum' },
      filter: { status: 'closed_won' }
    }
  }
}

// Server computes and returns only the result:
{
  events: [], // No raw events needed!
  synthesized: {
    '2024-Q1': { sum: 4200000, count: 47 },
    '2024-Q2': { sum: 3900000, count: 51 },
    '2024-Q3': { sum: 5100000, count: 63 },
    '2024-Q4': { sum: 4800000, count: 58 }
  },
  meta: {
    computedAt: '2025-12-26T...',
    sourceEventCount: 219  // How many events were aggregated
  }
}
```

**Result**: Dashboard loads with 4 numbers, not 219 deal records.

---

## Part III: Horizon-Scoped Streaming

### 3.1 Horizons as Access Scopes

Every stream connection is bound to a **Horizon** (Rule 4: Perspectivality):

```typescript
type StreamConnection = {
  connectionId: string;
  actor: ActorRef;

  // Horizon defines what data is visible to this connection
  horizon: {
    type: 'global' | 'workspace' | 'project' | 'session';
    workspaces: string[];        // Which workspaces visible
    actors: string[];            // Whose data visible
    frames: string[];            // Which interpretive frames
    timeRange?: { start, end };  // Temporal bounds
  };

  // Active subscriptions within this horizon
  subscriptions: Subscription[];
};
```

### 3.2 Subscription Refinement (Rule 5: Restrictivity)

Users can refine their view, which only *restricts* (never expands) data:

```typescript
// Start: All workspace deals
subscription_1: {
  collection: 'deals',
  filter: { workspace: 'sales' }
}

// Refine: Only my deals (intersection, never union)
subscription_2 = refine(subscription_1, {
  filter: { owner: currentUser }
});

// Further refine: Only active ones
subscription_3 = refine(subscription_2, {
  filter: { status: 'active' }
});
```

Each refinement is a **Focus** (foreclosure). The server only streams events matching the most restrictive active focus.

### 3.3 Live Subscription Model

Instead of polling, we use **operator subscriptions**:

```typescript
// Subscribe to SEG results (live filtered view)
{
  action: 'subscribe',
  subscription: {
    id: 'sub_active_deals',
    operator: {
      type: 'SEG',
      params: { collection: 'deals', filter: { status: 'active' } }
    },
    horizon: 'workspace:sales'
  }
}

// Server pushes matching events as they occur:
{
  subscriptionId: 'sub_active_deals',
  event: { type: 'given', ... },  // New deal created
  changeType: 'enter'             // Entered the filter
}

{
  subscriptionId: 'sub_active_deals',
  event: { type: 'meant', supersedes: '...', ... },
  changeType: 'exit'              // Status changed to 'closed', left filter
}
```

---

## Part IV: The SUP Challenge — Multi-Source Truth

### 4.1 Superposition in API Context

When multiple sources report different values, we need intelligent handling:

```typescript
// CRM says revenue is $4.2M
// Finance system says $3.9M
// BI pipeline says $4.0M

// All three are Given events from different sources:
{
  events: [
    { type: 'given', source: 'crm', value: 4200000, ... },
    { type: 'given', source: 'finance', value: 3900000, ... },
    { type: 'given', source: 'bi_pipeline', value: 4000000, ... }
  ],
  superposition: {
    entityId: 'revenue_q4',
    values: [
      { value: 4200000, context: { source: 'crm', method: 'measured' } },
      { value: 3900000, context: { source: 'finance', method: 'declared' } },
      { value: 4000000, context: { source: 'bi', method: 'aggregated' } }
    ],
    resolution: null  // Not yet resolved
  }
}
```

### 4.2 Resolution Strategies

Client can request specific resolution:

```typescript
// Request SYN to resolve SUP
{
  operator: {
    type: 'SYN',
    params: {
      target: 'revenue_q4',
      mode: 'prefer_source',
      sourcePreference: ['finance', 'crm', 'bi']
    }
  }
}

// Server returns resolved value + provenance
{
  resolved: {
    value: 3900000,
    resolution: {
      mode: 'prefer_source',
      chosenSource: 'finance',
      alternatives: [
        { source: 'crm', value: 4200000, rejected: 'lower_priority' },
        { source: 'bi', value: 4000000, rejected: 'lower_priority' }
      ]
    }
  }
}
```

---

## Part V: Intelligent Prefetching via REC

### 5.1 REC as Navigation Prediction

The REC (recursion/re-centering) operator reveals user navigation patterns:

```typescript
// User pivots from Person-centered to Team-centered view
{
  operator: {
    type: 'REC',
    params: {
      newCenter: 'team',
      previousCenter: 'person'
    }
  }
}
```

The server can predict:
- User will likely want Team aggregates
- Team member lists will be needed
- Team-level metrics should prefetch

### 5.2 Prefetch Graph

Build a prefetch graph from REC patterns:

```
┌────────────┐     REC      ┌────────────┐
│   Person   │ ───────────► │    Team    │
│   View     │              │    View    │
└────────────┘              └────────────┘
      │                           │
      │ CON(projects)             │ CON(members)
      ▼                           ▼
┌────────────┐              ┌────────────┐
│  Projects  │              │   People   │
│   List     │              │   List     │
└────────────┘              └────────────┘
```

When user enters "Person View," system prefetches:
1. Person's direct properties (immediate)
2. Person's projects (high probability, 1-hop)
3. Team (if REC pattern detected, likely next)

---

## Part VI: Data Budget System

### 6.1 Operator Cost Model

Each operator has a cost profile:

```typescript
const OPERATOR_COSTS = {
  NUL: { bandwidth: 'minimal', latency: 'low' },      // Metadata only
  DES: { bandwidth: 'minimal', latency: 'low' },      // Schema only
  INS: { bandwidth: 'outbound', latency: 'async' },   // Writes queue
  SEG: { bandwidth: 'variable', latency: 'medium' },  // Depends on filter selectivity
  CON: { bandwidth: 'targeted', latency: 'low' },     // Single relationship
  ALT: { bandwidth: 'minimal', latency: 'low' },      // Just switch frame
  SYN: { bandwidth: 'minimal', latency: 'medium' },   // Computed server-side
  SUP: { bandwidth: 'variable', latency: 'medium' },  // All sources needed
  REC: { bandwidth: 'high', latency: 'high' }         // Structure rebuild
};
```

### 6.2 Client Data Budget

Client specifies constraints:

```typescript
{
  connection: {
    dataBudget: {
      maxInitialPayload: '5MB',     // First load limit
      maxEventRate: '100/sec',       // Streaming limit
      maxCacheSize: '50MB',          // Local storage limit
      prefetchDepth: 2,              // How many hops to prefetch
      aggregatePreference: 'server'  // Prefer SYN on server
    }
  }
}
```

Server respects these when fulfilling operators:
- If SEG would return 10MB, paginate or suggest SYN
- If CON depth 5 requested but budget is 2, return counts for deeper levels
- If cache full, suggest eviction candidates

### 6.3 Adaptive Quality

System adapts to connection quality:

```typescript
// Slow connection detected
{
  qualityAdaptation: {
    connection: 'slow',
    adaptations: [
      { operator: 'SEG', adaptation: 'reduce_limit', newLimit: 20 },
      { operator: 'SYN', adaptation: 'server_only' },
      { operator: 'CON', adaptation: 'counts_only' },
      { operator: 'REC', adaptation: 'defer_until_idle' }
    ]
  }
}
```

---

## Part VII: Implementation Architecture

### 7.1 API Endpoints

```
POST /stream/connect
  → Establish WebSocket connection with Horizon scope

WS /stream/{connectionId}
  → Bidirectional operator streaming

POST /sync/delta
  → Efficient delta sync (Bloom filter reconciliation)

GET /catalog/schema
  → DES: Fetch type definitions and schemas

POST /aggregate
  → SYN: Server-side aggregation request

GET /relationships/{entityId}
  → CON: Relationship metadata (counts, not data)
```

### 7.2 Server Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      API SERVER                                  │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  Stream Handler │  │ Operator Router │  │ Horizon Gate   │  │
│  │  (WebSocket)    │──│ (9 operators)   │──│ (Access Ctrl)  │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
│           │                    │                    │           │
│           ▼                    ▼                    ▼           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              EVENT STORE (Source of Truth)               │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐    │   │
│  │  │ Given   │ │ Meant   │ │ Index   │ │ Materialized │    │   │
│  │  │ Events  │ │ Events  │ │ Layer   │ │ Views (SYN) │    │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 OPTIMIZATION LAYER                        │   │
│  │  • SEG indexes (filtered view precomputation)            │   │
│  │  • SYN caches (aggregate materialization)                │   │
│  │  • CON graphs (relationship indexes)                     │   │
│  │  • REC patterns (navigation prediction)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Client Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT                                      │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  UI Layer       │  │ Operator Engine │  │ Local Store    │  │
│  │  (Views)        │──│ (9 operators)   │──│ (IndexedDB)    │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
│           │                    │                    │           │
│           ▼                    ▼                    ▼           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 STREAM CLIENT                             │   │
│  │  • Connection manager (reconnect, backoff)               │   │
│  │  • Operator serializer (intent → wire format)            │   │
│  │  • Data deserializer (wire format → events)              │   │
│  │  • Subscription manager (live updates)                   │   │
│  │  • Prefetch predictor (based on REC patterns)            │   │
│  │  • Budget enforcer (data limits)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part VIII: Example Flows

### 8.1 Opening a Workspace (Minimal Initial Load)

```
1. Client: Connect with horizon = workspace:sales

2. Server: Return workspace metadata (DES)
   - Schema: Collections, field types
   - Counts: How many records per collection
   - Recent: Last 10 modified entities
   → ~50KB payload

3. Client: User opens "Deals" collection

4. Client: SEG { collection: deals, limit: 50 }

5. Server: Return first 50 deals
   - Events for 50 deals
   - Relationship counts per deal
   → ~200KB payload

6. Client: User clicks "Acme Corp" deal

7. Client: CON { entity: deal_acme, relationships: [customer, contacts] }

8. Server: Return customer + contacts
   - Customer entity
   - 3 contact entities
   → ~30KB payload

TOTAL: ~280KB instead of downloading entire workspace (could be 50MB+)
```

### 8.2 Dashboard with Aggregates

```
1. Client: User opens Sales Dashboard

2. Client: Multiple SYN operators:
   - SYN { deals, groupBy: quarter, aggregate: sum(amount) }
   - SYN { deals, groupBy: owner, aggregate: count }
   - SYN { deals, filter: closed_this_month, aggregate: sum }

3. Server: Returns computed results only
   - 4 quarterly totals
   - 8 owner counts
   - 1 monthly total
   → ~5KB payload

4. Client: Renders dashboard instantly

NO raw deal data downloaded. Aggregates computed server-side.
```

### 8.3 Conflict Resolution (SUP Flow)

```
1. Client: Viewing revenue field, sees SUP indicator

2. Client: Request SUP details
   { operator: SUP, entity: revenue_q4 }

3. Server: Returns all sources
   - CRM: $4.2M (measured, Oct 1)
   - Finance: $3.9M (declared, Dec 15)
   - BI: $4.0M (aggregated, Dec 20)
   → Shows context diff

4. User: Chooses resolution strategy

5. Client: SYN { mode: 'prefer_source', preference: ['finance'] }

6. Server: Returns resolved value with provenance

7. Client: Creates Meant event recording the resolution
   { type: 'meant', supersedes: superposition, resolution: ... }
```

---

## Part IX: Offline-First Considerations

### 9.1 Local-First with Selective Sync

The system remains **local-first** (Rule 3):

```
┌─────────────────────────────────────────────────────────┐
│                    DATA AVAILABILITY                     │
│                                                          │
│  ┌──────────────┐                                       │
│  │ ALWAYS LOCAL │  (from SEG/CON requests)              │
│  │              │  - Recently accessed data             │
│  │              │  - Actively subscribed data           │
│  │              │  - User-pinned data                   │
│  └──────────────┘                                       │
│                                                          │
│  ┌──────────────┐                                       │
│  │ ON DEMAND    │  (triggers API request)               │
│  │              │  - Unvisited collections              │
│  │              │  - Old historical data                │
│  │              │  - Other users' data                  │
│  └──────────────┘                                       │
│                                                          │
│  ┌──────────────┐                                       │
│  │ NEVER LOCAL  │  (always server-computed)             │
│  │              │  - Large aggregations                 │
│  │              │  - Cross-workspace queries            │
│  │              │  - Admin analytics                    │
│  └──────────────┘                                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Conflict-Free Offline Writes

INS operations work offline:

```typescript
// Offline: User creates new deal
{
  type: 'given',
  id: generateLocalId(),
  pending: true,  // Marked for sync
  ...
}

// Online: Sync queue processes
// Server may return conflict if same entity modified

// SUP created if conflict:
{
  superposition: {
    local: { ... },
    remote: { ... }
  },
  requiresResolution: true
}
```

---

## Part X: Security Model

### 10.1 Horizon-Enforced Access

Every stream request is validated against horizon:

```typescript
// Server validates every operator:
function validateOperator(operator: OperatorIntent, connection: StreamConnection) {
  const horizon = connection.horizon;

  // Check workspace access
  if (!horizon.workspaces.includes(operator.workspace)) {
    throw new AccessDenied('Workspace not in horizon');
  }

  // Check actor permissions
  if (!canActorPerform(connection.actor, operator)) {
    throw new AccessDenied('Actor lacks permission');
  }

  // Check temporal bounds
  if (operator.timeRange && !horizon.timeRange.contains(operator.timeRange)) {
    throw new AccessDenied('Time range outside horizon');
  }

  // Rule 5: Can only refine, never expand
  if (isRefinementViolation(operator, connection.activeHorizon)) {
    throw new RefinementViolation('Cannot expand beyond current horizon');
  }
}
```

### 10.2 Context-Based Filtering

Even within horizon, context filters apply:

```typescript
// User requests all deals
// But their horizon only includes team:west

// Server automatically applies:
SEG {
  filter: AND(
    userFilter,                    // Their explicit filter
    { team: horizon.teams },       // Horizon restriction
    { status: { not: 'deleted' }}  // Tombstone filtering
  )
}
```

---

## Summary: Why This Design

1. **Operators as Data Contracts**: Every UI action maps to an operator, which maps to a precise data requirement

2. **Minimal Data Transfer**: SEG returns only matching subset; SYN returns only aggregates; CON returns only relationships requested

3. **Live Subscriptions**: Changes stream to client only if they match active subscriptions

4. **Intelligent Prefetching**: REC patterns predict navigation, enabling proactive fetch

5. **Offline-First Preserved**: Local store remains source of truth; API enriches but doesn't replace

6. **Conflict as Data**: SUP treats multi-source disagreement as information, not error

7. **Budget-Aware**: Client specifies data limits; server adapts responses

8. **Horizon-Scoped Security**: All access mediated by perspectival access control

---

## Next Steps

1. **Phase 1**: Implement delta sync (Bloom filter reconciliation)
2. **Phase 2**: Add SEG and CON operator fulfillment
3. **Phase 3**: Add SYN server-side aggregation
4. **Phase 4**: Implement live subscriptions
5. **Phase 5**: Add REC-based prefetching
6. **Phase 6**: Build SUP conflict resolution UI

---

*This design treats the activity stream as semantic signal, not just event log. The operators themselves tell us what data is needed, when, and how.*
