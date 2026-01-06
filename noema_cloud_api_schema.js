/**
 * EO Cloud Storage API Schema
 *
 * Single-table event stream design. The cloud stores ONLY events.
 * All state (sets, records, views, fields) is derived client-side by replaying events.
 *
 * This is pure event sourcing - the activity stream IS the database.
 *
 * Key Insight for Partial Fetching:
 * Even with one table, we can be smart about what we GET:
 * - Delta sync: events since logical clock X
 * - Workspace scoping: only events for workspace Y
 * - Category filtering: only schema events, only data events
 * - Entity filtering: only events affecting set Z
 * - Bloom reconciliation: "what am I missing?"
 */

// =============================================================================
// CLOUD DATABASE SCHEMA - SINGLE TABLE
// =============================================================================

/**
 * The cloud database has ONE table: events.
 * This is the append-only activity stream.
 * Everything else is derived.
 */
const CloudDatabaseSchema = {

  /**
   * TABLE: events
   *
   * The canonical, append-only event log.
   * This IS the database. All state is derived by replaying events.
   *
   * Indexed for efficient partial queries.
   */
  events: {
    primaryKey: 'id',
    columns: {
      // === IDENTITY ===
      id: 'string',                    // Globally unique event ID

      // === ORDERING ===
      logical_clock: 'bigint',         // Total order within workspace
      timestamp: 'timestamp',          // Wall clock (for display, not ordering)

      // === SCOPING (for partial fetch) ===
      workspace_id: 'string',          // Primary partition key
      entity_id: 'string',             // Set/record/field this affects (nullable)
      entity_type: 'string',           // 'workspace' | 'set' | 'field' | 'record' | 'view'

      // === CLASSIFICATION ===
      epistemic_type: 'string',        // 'given' | 'meant' | 'derived_value'
      category: 'string',              // 'schema' | 'data' | 'view' | 'import' | 'edge' | ...
      action: 'string',                // 'create' | 'update' | 'delete' | 'supersede' | ...

      // === ACTOR ===
      actor: 'string',                 // Who created this event
      device_id: 'string',             // Which device

      // === DAG STRUCTURE ===
      parents: 'json',                 // Parent event IDs (for causal ordering)

      // === PROVENANCE ===
      grounding: 'json',               // Grounding references and derivation chain
      frame: 'json',                   // Epistemic frame (for 'meant' events)
      supersession: 'json',            // What this supersedes (corrections, retractions)

      // === PAYLOAD ===
      payload: 'json'                  // The actual event data
    },

    indexes: [
      // Primary query: delta sync within workspace
      ['workspace_id', 'logical_clock'],

      // Category-filtered sync (e.g., "just schema events")
      ['workspace_id', 'category', 'logical_clock'],

      // Entity-specific queries (e.g., "events for this set")
      ['workspace_id', 'entity_id', 'logical_clock'],

      // Entity type queries (e.g., "all record events")
      ['workspace_id', 'entity_type', 'logical_clock'],

      // Action queries (e.g., "all deletes for conflict resolution")
      ['workspace_id', 'action', 'logical_clock'],

      // Actor queries (for audit/blame)
      ['workspace_id', 'actor', 'logical_clock'],

      // Device queries (for device-specific sync)
      ['device_id', 'logical_clock'],

      // Standalone indexes for global queries
      'workspace_id',
      'logical_clock',
      'timestamp'
    ],

    // Partition by workspace for horizontal scaling
    partitionKey: 'workspace_id'
  }
};


// =============================================================================
// EVENT CATEGORIES - What types of events exist
// =============================================================================

/**
 * Event categories for filtered sync.
 * Client can request "give me only X category events" to reduce payload.
 */
const EventCategories = {
  // Schema events - structure of the data
  SCHEMA: 'schema',          // set_create, field_create, field_update, etc.

  // Data events - the actual records
  DATA: 'data',              // record_create, record_update, record_delete

  // View events - how data is displayed
  VIEW: 'view',              // view_create, view_update, filter changes

  // Import events - bulk data ingestion
  IMPORT: 'import',          // file imports, with provenance

  // Edge events - graph relationships
  EDGE: 'edge',              // edge_create, edge_delete

  // Workspace events - workspace-level changes
  WORKSPACE: 'workspace'     // workspace_create, workspace_update, horizon changes
};

/**
 * Why categories matter for partial sync:
 *
 * Scenario: User opens a workspace after being offline.
 *
 * NAIVE: Fetch all 50,000 events. 5MB download. 10 seconds.
 *
 * SMART:
 *   1. Fetch SCHEMA events first (maybe 200 events, 50KB)
 *      → User sees table structure immediately
 *   2. Fetch VIEW events (maybe 50 events, 10KB)
 *      → User sees their saved views
 *   3. Fetch DATA events for current view, paginated
 *      → User sees first 100 records quickly
 *   4. Background: continue syncing remaining DATA events
 *
 * Result: Time-to-interactive drops from 10s to <1s
 */


// =============================================================================
// API ENDPOINTS
// =============================================================================

// -----------------------------------------------------------------------------
// POST /events - Push events to cloud
// -----------------------------------------------------------------------------

/**
 * POST /api/v1/events
 *
 * Push local events to the cloud. Append-only, idempotent.
 * The ONLY write operation. Everything is an event.
 */
const PostEvents = {
  method: 'POST',
  path: '/api/v1/events',
  headers: {
    'Authorization': 'Bearer {token}',
    'X-Device-ID': '{device_id}',
    'Content-Type': 'application/json'
  },
  body: {
    // Events to append (batch, typically 1-1000)
    events: [
      {
        id: 'evt_abc123',
        logical_clock: 12345,
        timestamp: '2025-01-15T10:30:00Z',
        workspace_id: 'ws_xyz',
        entity_id: 'rec_456',           // Optional: what entity this affects
        entity_type: 'record',
        epistemic_type: 'meant',
        category: 'data',
        action: 'update',
        actor: 'user_789',
        device_id: 'dev_abc',
        parents: ['evt_prev1', 'evt_prev2'],
        grounding: {
          references: [
            { eventId: 'evt_source', kind: 'structural' }
          ]
        },
        frame: {
          claim: 'record update',
          epistemicStatus: 'preliminary'
        },
        payload: {
          record_id: 'rec_456',
          field_id: 'fld_name',
          old_value: 'Draft',
          new_value: 'Final'
        }
      }
    ],
    // Client's vector clock for conflict detection
    vector_clock: {
      'dev_abc': 100,
      'dev_def': 50
    }
  },
  response: {
    // What was accepted
    accepted: ['evt_abc123'],
    accepted_count: 1,

    // What was rejected (duplicates are OK, not errors)
    rejected: [],

    // Conflicts detected (concurrent edits to same entity)
    conflicts: [
      {
        your_event: 'evt_abc123',
        their_event: 'evt_xyz789',
        entity_id: 'rec_456',
        common_ancestor: 'evt_prev1',
        // Client must resolve - server doesn't auto-merge
        resolution_required: true
      }
    ],

    // Server's current state
    server_logical_clock: 12350,
    server_vector_clock: {
      'dev_abc': 100,
      'dev_def': 52,
      'dev_ghi': 30
    }
  }
};


// -----------------------------------------------------------------------------
// GET /events - Fetch events from cloud (the key partial-fetch endpoint)
// -----------------------------------------------------------------------------

/**
 * GET /api/v1/events
 *
 * Fetch events with smart filtering. This is where partial fetching shines.
 *
 * You NEVER need to fetch all events. Use these filters:
 * - since_clock: Delta sync (most common)
 * - category: Only schema, only data, etc.
 * - entity_id: Only events for a specific set/record
 * - entity_type: Only record events, only field events
 */
const GetEvents = {
  method: 'GET',
  path: '/api/v1/events',
  headers: {
    'Authorization': 'Bearer {token}',
    'X-Device-ID': '{device_id}'
  },
  query: {
    // === REQUIRED: Workspace scope ===
    workspace_id: 'string',

    // === DELTA SYNC: "What's new since I last synced?" ===
    since_clock: 'number',             // Events with logical_clock > this value
    // OR for multi-device scenarios:
    since_vector_clock: 'json',        // URL-encoded vector clock

    // === CATEGORY FILTER: "Only give me schema events" ===
    category: 'string',                // 'schema' | 'data' | 'view' | 'import' | 'edge'
    categories: 'string',              // Comma-separated: 'schema,view'

    // === ENTITY FILTER: "Only events for this set" ===
    entity_id: 'string',               // Specific set/record/field ID
    entity_type: 'string',             // 'set' | 'record' | 'field' | 'view'

    // === ACTION FILTER: "Only creates and updates, no deletes" ===
    action: 'string',                  // 'create' | 'update' | 'delete'
    actions: 'string',                 // Comma-separated

    // === PAGINATION ===
    limit: 'number',                   // Default 1000, max 5000
    cursor: 'string',                  // Opaque cursor for next page

    // === ORDERING ===
    order: 'string'                    // 'asc' (default) | 'desc'
  },
  response: {
    events: [
      // Full event objects matching the query
    ],

    // Pagination
    has_more: true,
    next_cursor: 'cursor_xyz',         // Pass this to get next page
    count: 1000,                       // Events in this response

    // Sync position after this batch
    latest_clock: 12500,               // Highest logical_clock in response
    server_clock: 12500                // Server's current max logical_clock
  }
};


// -----------------------------------------------------------------------------
// POST /events/reconcile - Bloom filter based sync
// -----------------------------------------------------------------------------

/**
 * POST /api/v1/events/reconcile
 *
 * Efficient set reconciliation: "What am I missing?"
 *
 * Client sends a Bloom filter of event IDs it has.
 * Server responds with events the client probably doesn't have.
 *
 * This is more efficient than delta sync when:
 * - Client has gaps in its event log (was offline during some syncs)
 * - Client isn't sure what it has (corrupted local state)
 * - Initial sync from scratch
 */
const ReconcileEvents = {
  method: 'POST',
  path: '/api/v1/events/reconcile',
  body: {
    workspace_id: 'string',

    // Bloom filter of event IDs client has
    bloom: {
      filter: 'base64_encoded_bits',   // The bloom filter data
      size: 8192,                      // Number of bits
      hash_count: 3,                   // Number of hash functions
      item_count: 5000                 // Approximate events in filter
    },

    // Client's DAG heads (leaf events with no children)
    heads: ['evt_abc', 'evt_def'],

    // Client's vector clock
    vector_clock: { /* ... */ },

    // Optional: Only reconcile certain categories
    categories: ['schema', 'data']
  },
  response: {
    // Events server thinks client is missing
    // (May include false positives from Bloom - client should dedupe)
    missing_events: [
      // Full event objects
    ],

    // Event IDs server doesn't have (client should push these)
    server_missing: ['evt_xyz'],

    // Sync status
    in_sync: false,
    your_behind_by: 150,               // Events you're missing
    server_behind_by: 2,               // Events server is missing from you

    // Server's current state
    server_heads: ['evt_latest1'],
    server_clock: 12500
  }
};


// =============================================================================
// SMART PARTIAL FETCH PATTERNS
// =============================================================================

/**
 * These patterns show how to leverage single-table event streaming
 * while still being smart about what you fetch.
 */
const PartialFetchPatterns = {

  /**
   * PATTERN 1: Initial Sync (New Device)
   *
   * Naive: GET all events → 50,000 events, 5MB, 10 seconds
   *
   * Smart: Prioritized category sync
   */
  initialSync: {
    description: 'First-time sync for a new device',
    steps: [
      {
        name: 'Fetch workspace metadata',
        request: 'GET /events?workspace_id=X&category=workspace&limit=100',
        why: 'Just the workspace config, ~1KB',
        userSees: 'Workspace name and settings'
      },
      {
        name: 'Fetch schema',
        request: 'GET /events?workspace_id=X&category=schema&limit=1000',
        why: 'Set and field definitions, ~50KB',
        userSees: 'Table structure (sets, columns)'
      },
      {
        name: 'Fetch views',
        request: 'GET /events?workspace_id=X&category=view&limit=500',
        why: 'View configurations, ~20KB',
        userSees: 'Saved views and filters'
      },
      {
        name: 'Fetch recent data for first set',
        request: 'GET /events?workspace_id=X&category=data&entity_id=SET_1&limit=500&order=desc',
        why: 'Most recent 500 record events for the active set',
        userSees: 'First screen of data, ready to use'
      },
      {
        name: 'Background: fetch remaining data',
        request: 'GET /events?workspace_id=X&category=data (paginated)',
        why: 'All historical data, in background',
        userSees: 'Nothing - this happens invisibly'
      }
    ],
    timeToInteractive: '<1 second (vs 10+ seconds naive)'
  },

  /**
   * PATTERN 2: Delta Sync (Returning User)
   *
   * User was offline, comes back online.
   * Only fetch what changed.
   */
  deltaSync: {
    description: 'Catch up after being offline',
    steps: [
      {
        name: 'Delta fetch',
        request: 'GET /events?workspace_id=X&since_clock=12000&limit=1000',
        why: 'Only events since last sync position',
        typical: '10-100 events, ~5-50KB'
      }
    ],
    note: 'If since_clock was 12000 and server is at 12050, you get 50 events instead of all 12050'
  },

  /**
   * PATTERN 3: Set-Specific Sync
   *
   * User clicks into a set they haven't opened in a while.
   * Only sync events for that set.
   */
  setSpecificSync: {
    description: 'Sync just one table/set',
    steps: [
      {
        name: 'Fetch set events',
        request: 'GET /events?workspace_id=X&entity_id=SET_ID&since_clock=LAST_SET_CLOCK',
        why: 'Only events affecting this specific set'
      }
    ],
    advantage: 'If workspace has 10 sets but user only uses 2, we never sync the other 8'
  },

  /**
   * PATTERN 4: Schema-Only Sync
   *
   * App startup - show structure before data.
   */
  schemaFirst: {
    description: 'Load structure before content',
    steps: [
      {
        name: 'Fetch schema events',
        request: 'GET /events?workspace_id=X&categories=schema,view&since_clock=LAST',
        why: 'Schema changes are rare and small'
      }
    ],
    note: 'Typically 0-5 schema events vs 1000+ data events in a delta sync'
  },

  /**
   * PATTERN 5: Conflict-Aware Sync
   *
   * Multiple devices editing concurrently.
   * Need to detect and resolve conflicts.
   */
  conflictAwareSync: {
    description: 'Handle concurrent edits',
    steps: [
      {
        name: 'Push local events',
        request: 'POST /events (with vector_clock)',
        why: 'Server compares vector clocks'
      },
      {
        name: 'Handle conflicts',
        note: 'Response includes conflicts array if concurrent edits detected'
      },
      {
        name: 'Pull their changes',
        request: 'GET /events?since_clock=X',
        why: 'Get events from other devices'
      }
    ]
  }
};


// =============================================================================
// WHY SINGLE TABLE + SMART FETCHING WINS
// =============================================================================

const WhySingleTable = {
  /**
   * The event stream IS the database.
   * Client derives current state by replaying events.
   *
   * Benefits:
   */
  benefits: [
    {
      name: 'Perfect audit trail',
      description: 'Every change is recorded. Time travel is trivial.'
    },
    {
      name: 'Conflict resolution',
      description: 'Concurrent edits create branches in the DAG, not lost updates.'
    },
    {
      name: 'Offline-first',
      description: 'Client appends events locally, syncs when online.'
    },
    {
      name: 'Simple cloud',
      description: 'Cloud is just append-only storage. No complex queries.'
    },
    {
      name: 'Cacheable',
      description: 'Events are immutable. Aggressive CDN caching possible.'
    }
  ],

  /**
   * Smart partial fetching makes this practical:
   */
  partialFetchAdvantages: [
    {
      strategy: 'Delta sync via logical clock',
      savings: '99%+ reduction for returning users',
      example: 'Fetch 50 new events instead of 10,000 total'
    },
    {
      strategy: 'Category filtering',
      savings: '90%+ reduction for initial load',
      example: 'Fetch 200 schema events first, data events later'
    },
    {
      strategy: 'Entity scoping',
      savings: 'Proportional to unused entities',
      example: '10 sets, user only uses 2 = 80% reduction'
    },
    {
      strategy: 'Bloom reconciliation',
      savings: 'Avoids full comparison',
      example: 'Send 1KB Bloom filter instead of 100KB ID list'
    }
  ]
};


// =============================================================================
// PAYLOAD SIZE ESTIMATES
// =============================================================================

const PayloadEstimates = {
  // Single event, typical
  singleEvent: '200-500 bytes',

  // Schema sync (all sets, fields, views for a workspace)
  schemaEvents: {
    count: '50-500 events',
    size: '10-100 KB'
  },

  // Data sync page (1000 record events)
  dataEventPage: {
    count: '1000 events',
    size: '200-500 KB'
  },

  // Delta sync (typical, user offline 1 hour)
  typicalDelta: {
    count: '10-100 events',
    size: '2-50 KB'
  },

  // Initial sync (full workspace, 10k records)
  fullInitialSync: {
    count: '10,000-50,000 events',
    size: '2-10 MB',
    note: 'Paginated, background, with prioritized schema first'
  }
};


// =============================================================================
// LOCAL ACTIVITY STORAGE (COMPACT FORMAT)
// =============================================================================

/**
 * Activities are stored locally in COMPACT format.
 * This is different from events - activities are the action log.
 *
 * Design Principle: Store simple. Expand when needed.
 */
const LocalActivitySchema = {
  /**
   * TABLE: activities
   *
   * Compact activity records. ~150-200 bytes each vs ~800+ bytes verbose.
   */
  activities: {
    primaryKey: 'id',
    columns: {
      id: 'string',           // act_<timestamp36>_<random>
      ts: 'integer',          // Unix timestamp (ms)
      op: 'string',           // INS, DES, SEG, CON, SYN, ALT, SUP, REC, NUL
      actor: 'string',        // Who performed the action
      target: 'string',       // Entity ID
      field: 'string?',       // Field ID (if field-level operation)
      delta: 'json?',         // [previousValue, newValue] for changes
      method: 'string?',      // How the action was performed
      source: 'string?',      // External source reference
      seq: 'string?',         // Sequence ID for compound actions
      ctx: 'string?',         // Reference to contexts table
      data: 'json?'           // Additional payload
    },
    indexes: ['op', 'target', 'actor', 'ts', 'seq']
  },

  /**
   * TABLE: sequences
   *
   * Groups related activities (compound actions like joins)
   */
  sequences: {
    primaryKey: 'id',
    columns: {
      id: 'string',           // seq_<timestamp36>_<random>
      ts: 'integer',          // When sequence started
      name: 'string',         // Human name ("Join Sources")
      actor: 'string',        // Who initiated
      ops: 'json',            // ["INS", "CON", "DES"]
      ctx: 'string?',         // Shared context reference
      completed: 'boolean',
      completedAt: 'integer?'
    },
    indexes: ['ts']
  },

  /**
   * TABLE: contexts
   *
   * Rich context for rare cases (legal, compliance)
   * Most activities don't need this - context is sparse.
   */
  contexts: {
    primaryKey: 'id',
    columns: {
      id: 'string',           // ctx_<timestamp36>_<random>
      term: 'string?',        // Semantic term
      definition: 'string?',  // What it means
      jurisdiction: 'string?', // Legal/org scope
      scale: 'string?',       // Operation scale
      background: 'string?',  // Why/reasoning
      createdAt: 'integer'
    }
  }
};

/**
 * Example compact activity records:
 */
const ActivityExamples = {
  // Simple field update
  fieldUpdate: {
    id: 'act_m5x8a1_xyz789',
    ts: 1735643520,
    op: 'ALT',
    actor: 'user_789',
    target: 'rec_123',
    field: 'name',
    delta: ['John', 'Jane'],
    method: 'inline_edit'
  },

  // Create record
  createRecord: {
    id: 'act_m5x7k2_abc456',
    ts: 1735643460,
    op: 'INS',
    actor: 'user_789',
    target: 'rec_456',
    method: 'api'
  },

  // Delete (ghost)
  deleteRecord: {
    id: 'act_m5x9b2_def789',
    ts: 1735643580,
    op: 'NUL',
    actor: 'user_789',
    target: 'rec_123',
    method: 'soft_delete',
    data: { reason: 'user_deletion' }
  },

  // Join sources (sequence of 3 activities)
  joinSequence: {
    sequence: {
      id: 'seq_m5xa12_ghi012',
      ts: 1735643640,
      name: 'Join Sources',
      actor: 'user_789',
      ops: ['INS', 'CON', 'DES'],
      completed: true,
      completedAt: 1735643641
    },
    activities: [
      { id: 'act_001', ts: 1735643640, op: 'INS', actor: 'user_789', target: 'set_new', seq: 'seq_m5xa12_ghi012' },
      { id: 'act_002', ts: 1735643640, op: 'CON', actor: 'user_789', target: 'set_new', seq: 'seq_m5xa12_ghi012', method: 'left_join', data: { relatedTo: ['src_a', 'src_b'] } },
      { id: 'act_003', ts: 1735643641, op: 'DES', actor: 'user_789', target: 'set_new', seq: 'seq_m5xa12_ghi012', delta: [null, 'Employee Details'] }
    ]
  },

  // With rich context (legal operation)
  legalOperation: {
    activity: {
      id: 'act_legal_123',
      ts: 1735643700,
      op: 'NUL',
      actor: 'system',
      target: 'filing_789',
      method: 'expectation_check',
      ctx: 'ctx_metro_rule'
    },
    context: {
      id: 'ctx_metro_rule',
      jurisdiction: 'Metro County Court',
      definition: 'Per Rule 12.4',
      term: 'filing_deadline',
      createdAt: 1735643700
    }
  }
};

/**
 * Activity → Event Bridge
 *
 * When syncing to cloud, compact activities are expanded to events.
 */
const ActivityToEventBridge = {
  /**
   * Convert compact activity to cloud event format
   */
  toEvent: `
    function activityToEvent(activity, loadContext) {
      return {
        id: activity.id.replace('act_', 'evt_'),
        logical_clock: activity.ts,
        timestamp: new Date(activity.ts).toISOString(),
        workspace_id: activity.workspaceId || 'default',
        entity_id: activity.target,
        entity_type: activity.data?.entityType || 'record',
        epistemic_type: 'meant',
        category: categoryFromOp(activity.op),
        action: actionFromOp(activity.op),
        actor: activity.actor,
        device_id: activity.deviceId || 'unknown',
        parents: [],  // Determined during sync
        grounding: {
          references: [{ kind: 'structural', eventId: activity.id }]
        },
        frame: activity.ctx ? loadContext(activity.ctx) : null,
        payload: {
          op: activity.op,
          target: activity.target,
          field: activity.field,
          delta: activity.delta,
          method: activity.method,
          source: activity.source,
          ...activity.data
        }
      };
    }

    function categoryFromOp(op) {
      const map = {
        INS: 'data', DES: 'schema', SEG: 'view',
        CON: 'edge', SYN: 'data', ALT: 'data',
        SUP: 'data', REC: 'data', NUL: 'data'
      };
      return map[op] || 'data';
    }

    function actionFromOp(op) {
      const map = {
        INS: 'create', DES: 'update', SEG: 'update',
        CON: 'link', SYN: 'merge', ALT: 'update',
        SUP: 'superpose', REC: 'record', NUL: 'delete'
      };
      return map[op] || 'update';
    }
  `,

  /**
   * Size comparison
   */
  sizeComparison: {
    fieldUpdate: { compact: '~180 bytes', verbose: '~850 bytes', savings: '79%' },
    createRecord: { compact: '~150 bytes', verbose: '~750 bytes', savings: '80%' },
    deleteRecord: { compact: '~120 bytes', verbose: '~700 bytes', savings: '83%' },
    joinSequence: { compact: '~500 bytes', verbose: '~2400 bytes', savings: '79%' }
  }
};


// =============================================================================
// CLIENT-SIDE DERIVATION
// =============================================================================

/**
 * Since the cloud only stores events, the client must derive state.
 *
 * This happens locally and is fast because:
 * 1. Events are replayed once on initial sync
 * 2. Incremental updates apply deltas to existing state
 * 3. Indexes are built locally for query performance
 */
const ClientSideDerivation = {
  /**
   * Derive current state from events
   */
  deriveState: `
    function deriveState(events) {
      const state = {
        workspace: null,
        sets: new Map(),      // set_id -> set
        fields: new Map(),    // field_id -> field
        records: new Map(),   // record_id -> record
        views: new Map()      // view_id -> view
      };

      // Replay events in logical clock order
      for (const event of events.sort((a, b) => a.logical_clock - b.logical_clock)) {
        applyEvent(state, event);
      }

      return state;
    }
  `,

  /**
   * Incremental update (for delta sync)
   */
  applyDelta: `
    function applyDelta(state, newEvents) {
      // Just apply new events to existing state
      for (const event of newEvents) {
        applyEvent(state, event);
      }
      // State is now up-to-date
    }
  `,

  /**
   * This is why partial fetch works:
   * - We only fetch NEW events
   * - We apply them to EXISTING derived state
   * - No need to re-derive from scratch
   */
  keyInsight: 'Delta sync + incremental derivation = minimal network + minimal CPU'
};


// =============================================================================
// EXPORTS
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CloudDatabaseSchema,
    EventCategories,
    PostEvents,
    GetEvents,
    ReconcileEvents,
    PartialFetchPatterns,
    WhySingleTable,
    PayloadEstimates,
    LocalActivitySchema,
    ActivityExamples,
    ActivityToEventBridge,
    ClientSideDerivation
  };
}

if (typeof window !== 'undefined') {
  window.EOCloudAPISchema = {
    CloudDatabaseSchema,
    EventCategories,
    PostEvents,
    GetEvents,
    ReconcileEvents,
    PartialFetchPatterns,
    WhySingleTable,
    PayloadEstimates,
    LocalActivitySchema,
    ActivityExamples,
    ActivityToEventBridge,
    ClientSideDerivation
  };
}
