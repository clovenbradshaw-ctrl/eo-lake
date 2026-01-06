# Cloud Database Setup

This document explains how to set up the cloud database for noema sync.

## Architecture

The cloud stores exactly **one table**: the event stream. Everything else (sets, records, views, fields) is derived client-side by replaying events.

```
┌──────────────────────────────────────────────────────────────┐
│                         CLOUD                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                     events table                        │  │
│  │  (append-only activity stream, partitioned by workspace)│  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              │
                    POST/GET /events
                              │
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   sets   │  │  fields  │  │ records  │  │  views   │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                    (derived by replaying events)             │
└──────────────────────────────────────────────────────────────┘
```

## Table Schema

### PostgreSQL

```sql
CREATE TABLE events (
    -- Identity
    id              TEXT PRIMARY KEY,

    -- Ordering
    logical_clock   BIGINT NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Scoping (for partial fetch)
    workspace_id    TEXT NOT NULL,
    entity_id       TEXT,                    -- set/record/field this affects
    entity_type     TEXT,                    -- 'workspace'|'set'|'field'|'record'|'view'

    -- Classification
    epistemic_type  TEXT NOT NULL,           -- 'given'|'meant'|'derived_value'
    category        TEXT NOT NULL,           -- 'schema'|'data'|'view'|'import'|'edge'|'workspace'
    action          TEXT NOT NULL,           -- 'create'|'update'|'delete'|'supersede'

    -- Actor
    actor           TEXT NOT NULL,
    device_id       TEXT NOT NULL,

    -- DAG structure
    parents         JSONB DEFAULT '[]',

    -- Provenance
    grounding       JSONB,
    frame           JSONB,
    supersession    JSONB,

    -- Payload
    payload         JSONB NOT NULL
);

-- Partition by workspace for horizontal scaling
-- (Use native partitioning or Citus for large deployments)
```

### SQLite (for simpler deployments)

```sql
CREATE TABLE events (
    id              TEXT PRIMARY KEY,
    logical_clock   INTEGER NOT NULL,
    timestamp       TEXT NOT NULL,
    workspace_id    TEXT NOT NULL,
    entity_id       TEXT,
    entity_type     TEXT,
    epistemic_type  TEXT NOT NULL,
    category        TEXT NOT NULL,
    action          TEXT NOT NULL,
    actor           TEXT NOT NULL,
    device_id       TEXT NOT NULL,
    parents         TEXT DEFAULT '[]',       -- JSON array
    grounding       TEXT,                    -- JSON
    frame           TEXT,                    -- JSON
    supersession    TEXT,                    -- JSON
    payload         TEXT NOT NULL            -- JSON
);
```

## Required Indexes

These indexes enable efficient partial fetching. **All queries include `workspace_id`** as the first filter.

```sql
-- Primary: Delta sync within workspace
CREATE INDEX idx_events_workspace_clock
    ON events (workspace_id, logical_clock);

-- Category-filtered sync ("just schema events")
CREATE INDEX idx_events_workspace_category_clock
    ON events (workspace_id, category, logical_clock);

-- Entity-specific queries ("events for this set")
CREATE INDEX idx_events_workspace_entity_clock
    ON events (workspace_id, entity_id, logical_clock);

-- Entity type queries ("all record events")
CREATE INDEX idx_events_workspace_entitytype_clock
    ON events (workspace_id, entity_type, logical_clock);

-- Actor queries (audit/blame)
CREATE INDEX idx_events_workspace_actor_clock
    ON events (workspace_id, actor, logical_clock);

-- Device queries (device-specific sync)
CREATE INDEX idx_events_device_clock
    ON events (device_id, logical_clock);

-- Timestamp queries (human-readable time ranges)
CREATE INDEX idx_events_workspace_timestamp
    ON events (workspace_id, timestamp);
```

## Why These Indexes?

Every query is designed for partial fetching:

| Query Pattern | Index Used | Example |
|---------------|------------|---------|
| Delta sync | `workspace_clock` | `WHERE workspace_id = ? AND logical_clock > ?` |
| Schema only | `workspace_category_clock` | `WHERE workspace_id = ? AND category = 'schema'` |
| One set's events | `workspace_entity_clock` | `WHERE workspace_id = ? AND entity_id = 'set_123'` |
| All record events | `workspace_entitytype_clock` | `WHERE workspace_id = ? AND entity_type = 'record'` |

## Event Categories

Events are classified by `category` for filtered sync:

| Category | Contains | Typical Count |
|----------|----------|---------------|
| `workspace` | Workspace create/update, horizon changes | 1-10 |
| `schema` | Set and field create/update/delete | 50-500 |
| `view` | View create/update, filter/sort changes | 20-200 |
| `data` | Record create/update/delete | 1,000-1,000,000+ |
| `import` | Bulk import events with provenance | 10-100 |
| `edge` | Graph relationship events | varies |

**Key insight**: Schema events are rare, data events are common. Fetch schema first for fast time-to-interactive.

## Constraints

```sql
-- Ensure idempotent inserts (same event ID = no error)
-- PostgreSQL: Use ON CONFLICT DO NOTHING
-- SQLite: Use INSERT OR IGNORE

-- Logical clock must be unique per workspace
-- (enforced in application layer, not DB constraint)
-- This allows concurrent inserts from different devices

-- No foreign keys - this is an append-only log
-- Referential integrity is handled by grounding chains
```

## Scaling Considerations

### Small (< 100k events)
- Single SQLite file or small PostgreSQL instance
- All indexes fit in memory
- No partitioning needed

### Medium (100k - 10M events)
- PostgreSQL with proper indexing
- Consider read replicas for GET-heavy workloads
- Monitor index size

### Large (> 10M events)
- Partition by `workspace_id` (native PostgreSQL partitioning)
- Or use Citus for distributed PostgreSQL
- Archive old events to cold storage (S3 + Parquet)
- Consider workspace-level sharding

## API Implementation Notes

### POST /events (append)

```sql
-- Idempotent insert
INSERT INTO events (id, logical_clock, timestamp, workspace_id, ...)
VALUES ($1, $2, $3, $4, ...)
ON CONFLICT (id) DO NOTHING
RETURNING id;

-- Returns empty if duplicate (already synced)
```

### GET /events (delta sync)

```sql
-- Typical delta sync query
SELECT * FROM events
WHERE workspace_id = $1
  AND logical_clock > $2
ORDER BY logical_clock ASC
LIMIT $3;
```

### GET /events with category filter

```sql
-- Schema-only sync (fast initial load)
SELECT * FROM events
WHERE workspace_id = $1
  AND category = 'schema'
  AND logical_clock > $2
ORDER BY logical_clock ASC
LIMIT $3;
```

### GET /events with entity filter

```sql
-- Sync one set only
SELECT * FROM events
WHERE workspace_id = $1
  AND entity_id = $2
  AND logical_clock > $3
ORDER BY logical_clock ASC
LIMIT $4;
```

## Maintenance

### Monitoring

```sql
-- Event count per workspace
SELECT workspace_id, COUNT(*), MAX(logical_clock)
FROM events
GROUP BY workspace_id;

-- Events per category (identify if data is dominating)
SELECT category, COUNT(*)
FROM events
WHERE workspace_id = $1
GROUP BY category;

-- Recent activity
SELECT workspace_id, COUNT(*)
FROM events
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY workspace_id;
```

### Cleanup (optional)

Events are immutable, but you can archive old ones:

```sql
-- Move events older than 1 year to archive
-- (Only if you have archival storage set up)
INSERT INTO events_archive
SELECT * FROM events
WHERE timestamp < NOW() - INTERVAL '1 year';

DELETE FROM events
WHERE timestamp < NOW() - INTERVAL '1 year';

-- IMPORTANT: This breaks full replay from cloud
-- Clients must have local copy or accept partial history
```

## Quick Start

### Development (SQLite)

```bash
sqlite3 noema.db < schema.sql
```

### Production (PostgreSQL)

```bash
psql -d noema -f schema.sql
psql -d noema -f indexes.sql
```

### Docker Compose Example

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: noema
      POSTGRES_USER: eo
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```
