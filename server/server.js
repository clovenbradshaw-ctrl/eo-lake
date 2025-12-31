/**
 * EO Lake Sync Server
 *
 * A simple sync server for cloud backup of EO Lake events.
 * Uses SQLite for storage and Express for the REST API.
 *
 * Usage:
 *   npm install
 *   npm start
 *
 * Environment variables:
 *   PORT - Server port (default: 3001)
 *   AUTH_TOKEN - Required auth token for API access (default: 'eo-lake-sync-token')
 *   DB_PATH - Path to SQLite database (default: './eo_lake_sync.db')
 */

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 3001;
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'eo-lake-sync-token';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'eo_lake_sync.db');

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create events table
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
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
    device_id       TEXT,
    parents         TEXT DEFAULT '[]',
    grounding       TEXT,
    frame           TEXT,
    supersession    TEXT,
    context         TEXT,
    payload         TEXT NOT NULL,
    received_at     TEXT DEFAULT (datetime('now'))
  )
`);

// Create indexes for efficient queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_events_workspace_clock
    ON events (workspace_id, logical_clock);
  CREATE INDEX IF NOT EXISTS idx_events_workspace_category_clock
    ON events (workspace_id, category, logical_clock);
  CREATE INDEX IF NOT EXISTS idx_events_workspace_entity_clock
    ON events (workspace_id, entity_id, logical_clock);
`);

// Get next logical clock for a workspace
function getNextClock(workspaceId) {
  const row = db.prepare(`
    SELECT COALESCE(MAX(logical_clock), 0) + 1 as next_clock
    FROM events
    WHERE workspace_id = ?
  `).get(workspaceId);
  return row.next_clock;
}

// Get current max clock for a workspace
function getCurrentClock(workspaceId) {
  const row = db.prepare(`
    SELECT COALESCE(MAX(logical_clock), 0) as current_clock
    FROM events
    WHERE workspace_id = ?
  `).get(workspaceId);
  return row.current_clock;
}

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const workspaceHeader = req.headers['x-workspace-id'];

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== AUTH_TOKEN) {
    return res.status(403).json({ error: 'Invalid auth token' });
  }

  // Store workspace ID for use in handlers
  req.workspaceId = workspaceHeader || req.body?.workspace_id || req.query?.workspace_id || 'default';

  next();
}

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/v1/events - Push events to server
app.post('/api/v1/events', authenticate, (req, res) => {
  try {
    const { events, workspace_id } = req.body;
    const workspaceId = workspace_id || req.workspaceId;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'events array required' });
    }

    const accepted = [];
    const rejected = [];
    const conflicts = [];

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO events (
        id, logical_clock, timestamp, workspace_id, entity_id, entity_type,
        epistemic_type, category, action, actor, device_id,
        parents, grounding, frame, supersession, context, payload
      ) VALUES (
        @id, @logical_clock, @timestamp, @workspace_id, @entity_id, @entity_type,
        @epistemic_type, @category, @action, @actor, @device_id,
        @parents, @grounding, @frame, @supersession, @context, @payload
      )
    `);

    const checkStmt = db.prepare('SELECT id FROM events WHERE id = ?');

    // Use a transaction for batch inserts
    const insertMany = db.transaction((events) => {
      for (const event of events) {
        // Check if event already exists
        const existing = checkStmt.get(event.id);
        if (existing) {
          // Duplicate - idempotent, not an error
          accepted.push({ id: event.id, status: 'duplicate' });
          continue;
        }

        try {
          // Assign server logical clock if not provided
          const serverClock = getNextClock(workspaceId);

          const result = insertStmt.run({
            id: event.id,
            logical_clock: event.logical_clock || serverClock,
            timestamp: event.timestamp || new Date().toISOString(),
            workspace_id: workspaceId,
            entity_id: event.entity_id || null,
            entity_type: event.entity_type || null,
            epistemic_type: event.epistemic_type || 'given',
            category: event.category || 'data',
            action: event.action || 'unknown',
            actor: event.actor || 'unknown',
            device_id: event.device_id || null,
            parents: JSON.stringify(event.parents || []),
            grounding: event.grounding ? JSON.stringify(event.grounding) : null,
            frame: event.frame ? JSON.stringify(event.frame) : null,
            supersession: event.supersession ? JSON.stringify(event.supersession) : null,
            context: event.context ? JSON.stringify(event.context) : null,
            payload: JSON.stringify(event.payload || {})
          });

          if (result.changes > 0) {
            accepted.push({ id: event.id, status: 'accepted', logical_clock: serverClock });
          }
        } catch (err) {
          rejected.push({ id: event.id, error: err.message });
        }
      }
    });

    insertMany(events);

    const serverClock = getCurrentClock(workspaceId);

    res.json({
      success: true,
      accepted,
      rejected,
      conflicts,
      server_logical_clock: serverClock,
      count: {
        total: events.length,
        accepted: accepted.length,
        rejected: rejected.length,
        conflicts: conflicts.length
      }
    });

  } catch (error) {
    console.error('POST /api/v1/events error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/events - Pull events from server
app.get('/api/v1/events', authenticate, (req, res) => {
  try {
    const workspaceId = req.query.workspace_id || req.workspaceId;
    const sinceClock = parseInt(req.query.since_clock) || 0;
    const category = req.query.category;
    const entityId = req.query.entity_id;
    const limit = Math.min(parseInt(req.query.limit) || 1000, 10000);
    const cursor = parseInt(req.query.cursor) || 0;

    let query = 'SELECT * FROM events WHERE workspace_id = ? AND logical_clock > ?';
    const params = [workspaceId, sinceClock];

    // Category filter
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    // Entity filter
    if (entityId) {
      query += ' AND entity_id = ?';
      params.push(entityId);
    }

    // Pagination using cursor (logical_clock offset)
    if (cursor > 0) {
      query += ' AND logical_clock > ?';
      params.push(cursor);
    }

    query += ' ORDER BY logical_clock ASC LIMIT ?';
    params.push(limit + 1); // Fetch one extra to check if there's more

    const rows = db.prepare(query).all(...params);

    // Check if there are more results
    const hasMore = rows.length > limit;
    if (hasMore) {
      rows.pop(); // Remove the extra row
    }

    // Parse JSON fields
    const events = rows.map(row => ({
      id: row.id,
      logical_clock: row.logical_clock,
      timestamp: row.timestamp,
      workspace_id: row.workspace_id,
      entity_id: row.entity_id,
      entity_type: row.entity_type,
      epistemic_type: row.epistemic_type,
      category: row.category,
      action: row.action,
      actor: row.actor,
      device_id: row.device_id,
      parents: JSON.parse(row.parents || '[]'),
      grounding: row.grounding ? JSON.parse(row.grounding) : null,
      frame: row.frame ? JSON.parse(row.frame) : null,
      supersession: row.supersession ? JSON.parse(row.supersession) : null,
      context: row.context ? JSON.parse(row.context) : null,
      payload: JSON.parse(row.payload || '{}')
    }));

    const latestClock = getCurrentClock(workspaceId);
    const nextCursor = events.length > 0 ? events[events.length - 1].logical_clock : null;

    res.json({
      events,
      has_more: hasMore,
      next_cursor: nextCursor,
      latest_clock: latestClock,
      count: events.length
    });

  } catch (error) {
    console.error('GET /api/v1/events error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/status - Get workspace sync status
app.get('/api/v1/status', authenticate, (req, res) => {
  try {
    const workspaceId = req.query.workspace_id || req.workspaceId;

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_events,
        MAX(logical_clock) as latest_clock,
        MIN(timestamp) as earliest_event,
        MAX(timestamp) as latest_event
      FROM events
      WHERE workspace_id = ?
    `).get(workspaceId);

    const categoryStats = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM events
      WHERE workspace_id = ?
      GROUP BY category
    `).all(workspaceId);

    res.json({
      workspace_id: workspaceId,
      total_events: stats.total_events || 0,
      latest_clock: stats.latest_clock || 0,
      earliest_event: stats.earliest_event,
      latest_event: stats.latest_event,
      by_category: Object.fromEntries(categoryStats.map(r => [r.category, r.count]))
    });

  } catch (error) {
    console.error('GET /api/v1/status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
=====================================
  EO Lake Sync Server
=====================================
  Port:       ${PORT}
  Database:   ${DB_PATH}
  Auth Token: ${AUTH_TOKEN}

  API Endpoints:
    POST /api/v1/events  - Push events
    GET  /api/v1/events  - Pull events
    GET  /api/v1/status  - Workspace status
    GET  /health         - Health check

  Configure in EO Lake:
    Endpoint:  http://localhost:${PORT}
    Token:     ${AUTH_TOKEN}
    Workspace: default (or any name)
=====================================
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  db.close();
  process.exit(0);
});
