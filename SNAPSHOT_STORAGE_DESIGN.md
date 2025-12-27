# Snapshot Storage Design

## Problem Statement

As the event log grows, loading time increases linearly since all events must be replayed to derive current state. We need a strategy to:
1. Store snapshots at size/event thresholds for faster loading
2. Maintain access to full event history when needed
3. Support online storage with point-in-time queries

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Event Log (Append-Only)                  │
│  [e₁] → [e₂] → [e₃] → ... → [eₙ₋₁] → [eₙ]                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    State Derivation (replay all events)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Current State (computed)                 │
└─────────────────────────────────────────────────────────────┘
```

**Pain Points:**
- Full replay required on every load
- O(n) loading time where n = event count
- Memory pressure during replay
- No partial loading capability

---

## Proposed Architecture: Materialized Snapshots

### Core Concept

Periodically materialize the derived state as a **checkpoint snapshot**, then only replay events after that checkpoint.

```
┌─────────────────────────────────────────────────────────────┐
│   COLD TIER: Archived Events                                │
│   [e₁] → [e₂] → ... → [e₁₀₀₀]                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│   SNAPSHOT (Checkpoint at e₁₀₀₀)                            │
│   • Complete materialized state                             │
│   • Logical clock: 1000                                     │
│   • Timestamp: 2024-01-15T00:00:00Z                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│   HOT TIER: Active Events                                   │
│   [e₁₀₀₁] → [e₁₀₀₂] → ... → [eₙ]                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    Fast Load: Snapshot + Delta Replay
```

---

## Snapshot Triggering Strategies

### Option A: Event Count Threshold

```javascript
const SNAPSHOT_THRESHOLD = {
  eventCount: 1000,      // Create snapshot every 1000 events
  minEventsSinceLast: 100 // Don't snapshot if < 100 events since last
};
```

**Pros:** Simple, predictable
**Cons:** Doesn't account for data complexity

### Option B: Size-Based Threshold

```javascript
const SNAPSHOT_THRESHOLD = {
  eventLogSizeBytes: 5 * 1024 * 1024,  // 5MB event log
  stateSizeBytes: 10 * 1024 * 1024,    // 10MB derived state
};
```

**Pros:** Directly addresses memory/storage concerns
**Cons:** Harder to measure dynamically

### Option C: Hybrid (Recommended)

```javascript
const SNAPSHOT_THRESHOLD = {
  // Trigger on ANY of these conditions
  eventCount: 1000,
  eventLogSizeBytes: 5 * 1024 * 1024,
  timeSinceLastSnapshot: 7 * 24 * 60 * 60 * 1000, // 7 days

  // Only if at least this many events accumulated
  minEventsSinceLast: 50
};
```

---

## Snapshot Data Structure

```javascript
const StateSnapshot = {
  // Metadata
  id: "snapshot_1704067200000",
  version: "1.0.0",
  createdAt: "2024-01-01T00:00:00Z",

  // Position in event log
  checkpoint: {
    logicalClock: 1000,
    lastEventId: "evt_abc123",
    lastEventTimestamp: "2024-01-01T00:00:00Z",
    eventCount: 1000
  },

  // Materialized state
  state: {
    // All sets with their records
    sets: {
      "set_123": {
        config: { /* SetConfig */ },
        records: {
          "rec_001": { /* full record data */ },
          "rec_002": { /* full record data */ }
        }
      }
    },

    // All edges (graph connections)
    edges: [
      { from: "rec_001", to: "rec_002", type: "links", metadata: {} }
    ],

    // View configurations
    views: {
      workspaces: { /* ... */ },
      lenses: { /* ... */ },
      focuses: { /* ... */ }
    },

    // Horizon configurations
    horizons: { /* ... */ }
  },

  // Integrity
  checksum: "sha256:abc123...",

  // Provenance
  provenance: {
    agent: "system",
    method: "automatic_checkpoint",
    eventRange: { from: "evt_first", to: "evt_abc123" }
  }
};
```

---

## Storage Tiers

### Local Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       IndexedDB                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Object Stores:                                             │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  "snapshots"                                          │ │
│  │  • keyPath: id                                        │ │
│  │  • indexes: checkpoint.logicalClock, createdAt        │ │
│  │  • Stores: StateSnapshot objects                      │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  "events_hot" (active events after last snapshot)     │ │
│  │  • Current event store behavior                       │ │
│  │  • Only events since last checkpoint                  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  "events_archive" (optional, for history queries)     │ │
│  │  • Older events before snapshot                       │ │
│  │  • Can be lazily loaded or stored separately          │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  "metadata"                                           │ │
│  │  • latestSnapshotId                                   │ │
│  │  • snapshotPolicy configuration                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Loading Strategy

```javascript
async function loadState() {
  // 1. Load latest snapshot (fast - single read)
  const snapshot = await db.snapshots.orderBy('checkpoint.logicalClock')
                                      .last();

  // 2. Initialize state from snapshot
  if (snapshot) {
    initializeStateFromSnapshot(snapshot);
  }

  // 3. Replay only events after checkpoint
  const hotEvents = await db.events_hot.toArray();
  for (const event of hotEvents) {
    applyEvent(event);
  }

  // Load time: O(1) snapshot + O(k) where k << n
}
```

---

## Online Storage Architecture

### Multi-Tier Cloud Storage

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  HOT: Latest Snapshot + Active Events               │   │
│  │       (IndexedDB - always available)                │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ Sync
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLOUD STORAGE                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  WARM: Recent Snapshots (last 30 days)              │   │
│  │        Low-latency object storage (S3, R2, etc.)    │   │
│  │        Fast retrieval for recent history            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  COLD: Full Event Archive                           │   │
│  │        Compressed event log segments                │   │
│  │        S3 Glacier / Archive storage                 │   │
│  │        For compliance, audit, full reconstruction   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  METADATA: Snapshot Index                           │   │
│  │        Database (SQLite/Postgres)                   │   │
│  │        Quick lookup: "What snapshots exist?"        │   │
│  │        Point-in-time query routing                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Snapshot Index Schema

```sql
CREATE TABLE snapshots (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL,

  -- Checkpoint position
  logical_clock   INTEGER NOT NULL,
  last_event_id   TEXT NOT NULL,
  event_count     INTEGER NOT NULL,

  -- Timestamps
  checkpoint_at   TIMESTAMP NOT NULL,  -- When state was captured
  created_at      TIMESTAMP NOT NULL,  -- When snapshot was created

  -- Storage location
  storage_tier    TEXT NOT NULL,       -- 'warm' | 'cold'
  storage_path    TEXT NOT NULL,       -- S3 key or path
  size_bytes      INTEGER NOT NULL,

  -- Integrity
  checksum        TEXT NOT NULL,

  -- Indexing
  INDEX idx_workspace_clock (workspace_id, logical_clock DESC),
  INDEX idx_checkpoint_time (workspace_id, checkpoint_at DESC)
);

CREATE TABLE event_segments (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL,

  -- Event range
  clock_start     INTEGER NOT NULL,
  clock_end       INTEGER NOT NULL,
  event_count     INTEGER NOT NULL,

  -- Storage
  storage_tier    TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL,
  compressed      BOOLEAN DEFAULT TRUE,

  -- Status
  archived_at     TIMESTAMP NOT NULL,

  INDEX idx_workspace_range (workspace_id, clock_start, clock_end)
);
```

---

## Point-in-Time Query Flow

### Query: "Show me the data as of January 15, 2024"

```javascript
async function queryPointInTime(targetTimestamp) {
  // 1. Find the closest snapshot BEFORE target time
  const snapshot = await api.findSnapshotBefore({
    workspaceId,
    timestamp: targetTimestamp
  });

  // 2. Calculate which events need to be replayed
  const eventsNeeded = await api.getEventRange({
    workspaceId,
    fromClock: snapshot.checkpoint.logicalClock + 1,
    toTimestamp: targetTimestamp
  });

  // 3. Determine if we need to fetch from cloud
  const fetchPlan = {
    snapshot: snapshot.storageTier === 'local' ? null : snapshot,
    events: eventsNeeded.filter(e => e.storageTier !== 'local')
  };

  // 4. Fetch remote data if needed
  if (fetchPlan.snapshot) {
    await downloadSnapshot(fetchPlan.snapshot);
  }
  if (fetchPlan.events.length > 0) {
    await downloadEventSegments(fetchPlan.events);
  }

  // 5. Reconstruct state
  const state = initializeFromSnapshot(snapshot);
  for (const event of eventsNeeded) {
    applyEvent(state, event);
  }

  return state;
}
```

### Query Optimization Strategies

```
Query: "What was record X on date Y?"

Strategy 1: Full State Reconstruction (naive)
┌─────────────────────────────────────────────────────┐
│  Load snapshot → replay all events → extract X     │
│  Cost: O(snapshot) + O(events_until_Y)             │
└─────────────────────────────────────────────────────┘

Strategy 2: Record-Specific Reconstruction (optimized)
┌─────────────────────────────────────────────────────┐
│  1. Index events by targetId                       │
│  2. Load snapshot → extract X from snapshot        │
│  3. Replay only events where targetId = X          │
│  Cost: O(snapshot) + O(events_for_X)               │
└─────────────────────────────────────────────────────┘

Strategy 3: Record Snapshots (aggressive optimization)
┌─────────────────────────────────────────────────────┐
│  Store per-record version history alongside state  │
│  { recordId, versions: [{clock, state}, ...] }     │
│  Cost: O(1) lookup + O(versions_for_X)             │
│  Tradeoff: Higher storage, faster queries          │
└─────────────────────────────────────────────────────┘
```

---

## Sync Protocol

### Event-Level Sync (Current)

```
Client A                          Cloud                         Client B
   │                                │                               │
   │──── push(events[1001-1010]) ──▶│                               │
   │                                │◀── pull(since: 1000) ────────│
   │                                │──── events[1001-1010] ───────▶│
```

### Snapshot-Aware Sync (Proposed)

```
Client A                          Cloud                         Client B
   │                                │                               │
   │ (creates snapshot at 1000)     │                               │
   │──── push(snapshot_1000) ──────▶│                               │
   │──── push(events[1001-1010]) ──▶│                               │
   │                                │                               │
   │                                │     (new client, never synced)│
   │                                │◀───── "I have nothing" ───────│
   │                                │                               │
   │                                │──── snapshot_1000 ───────────▶│
   │                                │──── events[1001-1010] ───────▶│
   │                                │     (fast bootstrap!)          │
```

### Incremental Sync for Large Datasets

```javascript
const SyncManifest = {
  workspaceId: "ws_123",

  // Current state summary
  current: {
    latestSnapshotId: "snap_1000",
    latestEventClock: 1050,
    eventCountSinceSnapshot: 50
  },

  // Available snapshots for bootstrapping
  availableSnapshots: [
    { id: "snap_1000", clock: 1000, sizeBytes: 2_000_000 },
    { id: "snap_500", clock: 500, sizeBytes: 1_000_000 }
  ],

  // Event segments for partial sync
  eventSegments: [
    { range: [1, 500], sizeBytes: 500_000, archived: true },
    { range: [501, 1000], sizeBytes: 500_000, archived: true },
    { range: [1001, 1050], sizeBytes: 50_000, archived: false }
  ]
};

// Client requests what it needs
const clientRequest = {
  have: {
    latestSnapshot: "snap_500",
    latestEventClock: 520
  },
  want: "latest"
};

// Server responds with optimal transfer plan
const syncPlan = {
  // Option A: Full delta (if small)
  // events: [521...1050] (~53KB)

  // Option B: Snapshot + delta (if events large)
  snapshot: "snap_1000",
  events: [1001...1050]  // Much smaller!
};
```

---

## Storage Cleanup & Retention

### Retention Policy

```javascript
const RetentionPolicy = {
  // Local storage
  local: {
    keepSnapshots: 3,           // Keep last 3 snapshots locally
    keepHotEvents: true,        // Always keep events since last snapshot
    archiveThreshold: 7 * 24 * 60 * 60 * 1000  // Archive after 7 days
  },

  // Cloud storage
  cloud: {
    warmTier: {
      keepSnapshots: 30,        // Last 30 snapshots in warm storage
      maxAgeDays: 90            // Or max 90 days
    },
    coldTier: {
      keepForever: true,        // Full event archive
      compression: 'zstd',
      segmentSize: 10_000       // Events per segment file
    }
  }
};
```

### Cleanup Process

```javascript
async function runCleanup() {
  // 1. Identify snapshots to archive
  const localSnapshots = await db.snapshots.toArray();
  const toArchive = localSnapshots
    .sort((a, b) => b.checkpoint.logicalClock - a.checkpoint.logicalClock)
    .slice(RetentionPolicy.local.keepSnapshots);

  // 2. Upload to cloud before deleting locally
  for (const snapshot of toArchive) {
    await cloudStorage.upload(snapshot);
    await db.snapshots.delete(snapshot.id);
  }

  // 3. Archive old events (keep as single compressed segment)
  const latestLocalSnapshot = localSnapshots[0];
  const eventsToArchive = await db.events
    .where('logicalClock')
    .below(latestLocalSnapshot.checkpoint.logicalClock)
    .toArray();

  if (eventsToArchive.length > 0) {
    const segment = compressEvents(eventsToArchive);
    await cloudStorage.uploadEventSegment(segment);
    await db.events.where('logicalClock')
      .below(latestLocalSnapshot.checkpoint.logicalClock)
      .delete();
  }
}
```

---

## Implementation Phases

### Phase 1: Local Snapshots (Offline-First)
- Add `snapshots` object store to IndexedDB
- Implement snapshot creation on threshold
- Modify load to use snapshot + delta
- Background cleanup of old local snapshots

### Phase 2: Point-in-Time Queries (Local)
- Build event index by timestamp
- Implement local history viewer
- Add UI for "view as of date X"

### Phase 3: Cloud Sync Foundation
- Define cloud API endpoints
- Implement snapshot upload/download
- Add sync manifest exchange

### Phase 4: Cloud Point-in-Time
- Cloud snapshot index
- Remote event segment storage
- Federated query execution

### Phase 5: Advanced Optimization
- Per-record version tracking
- Incremental/differential snapshots
- Query-specific materialized views

---

## Alignment with EO Principles

| Principle | How Snapshots Support It |
|-----------|-------------------------|
| **Append-Only (Axiom 0)** | Snapshots are immutable; events never deleted, only archived |
| **Rule 3: Ineliminability** | Full event history preserved in cold storage |
| **Rule 9: Defeasibility** | Snapshots can be superseded; history remains queryable |
| **Provenance** | Snapshots include full provenance of their creation |
| **Perspectivality (Rule 4)** | Snapshots respect horizon boundaries |

---

## API Design

```javascript
// Snapshot creation
EOPersistence.createSnapshot(options?: { force?: boolean }): Promise<StateSnapshot>

// Load with snapshot optimization
EOPersistence.load(): Promise<void>  // Automatically uses latest snapshot

// Point-in-time queries
EOPersistence.getStateAt(timestamp: Date): Promise<DerivedState>
EOPersistence.getRecordAt(recordId: string, timestamp: Date): Promise<Record>

// Snapshot management
EOPersistence.listSnapshots(): Promise<SnapshotInfo[]>
EOPersistence.deleteSnapshot(id: string): Promise<void>  // Archives, doesn't delete
EOPersistence.getSnapshotPolicy(): SnapshotPolicy
EOPersistence.setSnapshotPolicy(policy: SnapshotPolicy): void

// Cloud sync (Phase 3+)
EOPersistence.syncToCloud(): Promise<SyncResult>
EOPersistence.fetchFromCloud(options: FetchOptions): Promise<void>
EOPersistence.queryRemoteHistory(query: HistoryQuery): Promise<QueryResult>
```

---

## Performance Expectations

| Scenario | Current (No Snapshots) | With Snapshots |
|----------|------------------------|----------------|
| Initial load (10K events) | ~2-5 seconds | ~200ms |
| Initial load (100K events) | ~20-50 seconds | ~200ms |
| Point-in-time query | Not supported | ~500ms (local), ~2s (cloud) |
| Storage overhead | 1x | ~1.2-1.5x (snapshot + events) |
| Sync (new device) | Download all events | Download snapshot + delta |

---

## Open Questions

1. **Snapshot Granularity**: Full state vs. per-workspace vs. per-set?
2. **Compression**: Compress snapshots? (zstd, gzip, brotli)
3. **Differential Snapshots**: Store only changes between snapshots?
4. **Horizon-Aware Snapshots**: Separate snapshots per horizon boundary?
5. **Conflict Resolution**: How to merge snapshots from offline-divergent clients?

---

## Next Steps

1. Review and discuss this design
2. Prototype Phase 1 (local snapshots)
3. Benchmark loading performance
4. Iterate based on real-world data sizes
