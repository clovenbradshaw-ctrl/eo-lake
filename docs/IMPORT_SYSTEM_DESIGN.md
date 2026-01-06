# Import System Design

## Overview

This document outlines a robust, compliant import system for noema that handles CSV and JSON imports, creates appropriate views, enables immediate app refresh, and maintains full provenance when importing to existing views.

---

## Core Principles

All import operations MUST comply with the Nine Rules:

1. **Rule 1 (Distinction)**: Imports are GIVEN events (raw external data)
2. **Rule 2 (Impenetrability)**: Import events can only reference other GIVEN events
3. **Rule 3 (Ineliminability)**: Imported data is never erased, only superseded
4. **Rule 7 (Groundedness)**: Any interpretations (views, mappings) must reference import events
5. **Rule 9 (Defeasibility)**: Import interpretations can be revised without losing originals

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         IMPORT ORCHESTRATOR                          │
│  (Coordinates all import phases, emits progress events)              │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│  FILE PARSER    │   │  SCHEMA INFERRER │   │  PROVENANCE BUILDER  │
│  (CSV/JSON)     │   │  (Field Types)   │   │  (Metadata Chain)    │
└────────┬────────┘   └────────┬─────────┘   └──────────┬───────────┘
         │                     │                        │
         └─────────────────────┼────────────────────────┘
                               ▼
         ┌─────────────────────────────────────────────┐
         │              EVENT GENERATOR                 │
         │  (Creates GIVEN events for each record)      │
         └────────────────────┬────────────────────────┘
                              │
         ┌────────────────────┼────────────────────────┐
         ▼                    ▼                        ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│  EVENT STORE    │  │  VIEW GENERATOR │  │  REACTIVE REFRESH       │
│  (Append)       │  │  (MEANT events) │  │  (EventBus → UI)        │
└─────────────────┘  └─────────────────┘  └─────────────────────────┘
```

---

## Part 1: File Parsing

### 1.1 CSV Parser

```javascript
class CSVImporter {
  /**
   * Parse CSV with intelligent detection
   */
  parse(file, options = {}) {
    return {
      delimiter: detectDelimiter(file),     // , ; \t |
      encoding: detectEncoding(file),        // UTF-8, Latin-1, etc.
      hasHeaders: inferHeaderRow(file),      // Boolean
      rows: parsedRows,                       // Array of objects
      rawLines: originalLines,                // Preserve for provenance
      parseWarnings: []                       // Non-fatal issues
    };
  }
}
```

**Detection Features:**
- Auto-detect delimiter (comma, semicolon, tab, pipe)
- Handle quoted fields with embedded delimiters
- Detect and convert encoding
- Handle multiline fields
- Skip empty rows (configurable)

### 1.2 JSON Parser

```javascript
class JSONImporter {
  /**
   * Parse JSON with structure analysis
   */
  parse(file, options = {}) {
    return {
      structure: analyzeStructure(data),  // 'array' | 'nested' | 'keyed'
      records: normalizedRecords,          // Flattened to array
      viewHints: extractViewHints(data),   // See Part 3
      provenance: {
        originalStructure: structureSnapshot,
        flattenStrategy: strategyUsed
      }
    };
  }
}
```

**JSON Structure Handling:**

| Structure | Example | Normalization |
|-----------|---------|---------------|
| **Array** | `[{...}, {...}]` | Direct use |
| **Keyed** | `{"001": {...}, "002": {...}}` | Convert keys to `_key` field |
| **Nested** | `{"users": [...], "orders": [...]}` | Create multiple sets |
| **Single** | `{...}` | Wrap in array |

---

## Part 2: Schema Inference

### 2.1 Field Type Detection

```javascript
class SchemaInferrer {
  /**
   * Analyze all values to determine field types
   */
  inferSchema(records) {
    return {
      fields: [
        {
          name: 'email',
          type: 'EMAIL',           // One of 16 FieldTypes
          confidence: 0.98,        // How confident the inference is
          nullPercentage: 0.05,    // Missing value rate
          examples: ['a@b.com'],   // Sample values
          constraints: {           // Inferred constraints
            unique: true,
            maxLength: 254
          }
        }
      ],
      warnings: []                 // Ambiguous detections
    };
  }
}
```

**Type Inference Priority:**

```
1. AUTONUMBER    → Sequential integers starting from 1
2. DATE          → ISO dates, common formats
3. NUMBER        → Numeric with consistent decimals
4. CHECKBOX      → Boolean patterns (true/false, yes/no, 1/0)
5. EMAIL         → RFC 5322 pattern
6. URL           → HTTP(S) pattern
7. PHONE         → Phone number patterns
8. MULTI_SELECT  → Comma-separated, repeated values
9. SELECT        → Low cardinality (<20 unique values)
10. LONG_TEXT    → Length > 255 characters
11. TEXT         → Default fallback
```

### 2.2 Relationship Detection

```javascript
/**
 * Detect potential LINK fields based on:
 * - Field names ending in _id, Id, ID
 * - Values matching other record IDs
 * - Foreign key patterns
 */
detectRelationships(records, existingSets) {
  return {
    internalLinks: [],    // Links within this import
    externalLinks: [],    // Links to existing sets
    suggestions: []       // Possible but uncertain links
  };
}
```

---

## Part 3: JSON → View Creation

### 3.1 View Hints from JSON Structure

JSON files can include metadata that creates views automatically:

```json
{
  "_noema_meta": {
    "set": {
      "name": "Customer Orders",
      "description": "Q4 2024 orders"
    },
    "views": [
      {
        "name": "Active Orders",
        "type": "kanban",
        "config": {
          "groupBy": "status",
          "filters": [
            { "field": "status", "operator": "not_equals", "value": "cancelled" }
          ],
          "sorts": [
            { "field": "created_at", "direction": "desc" }
          ],
          "hiddenFields": ["internal_notes"]
        }
      },
      {
        "name": "By Date",
        "type": "calendar",
        "config": {
          "dateField": "order_date",
          "titleField": "customer_name"
        }
      },
      {
        "name": "Order Table",
        "type": "table",
        "config": {
          "fieldOrder": ["order_id", "customer_name", "total", "status"],
          "sorts": [{ "field": "order_id", "direction": "asc" }]
        }
      }
    ],
    "fields": {
      "status": {
        "type": "SELECT",
        "options": ["pending", "processing", "shipped", "delivered", "cancelled"]
      },
      "total": {
        "type": "NUMBER",
        "format": "currency"
      }
    }
  },
  "records": [
    { "order_id": 1, "customer_name": "Alice", "total": 99.99, "status": "shipped" }
  ]
}
```

### 3.2 View Generation Flow

```
JSON with _noema_meta
       │
       ▼
┌──────────────────────────┐
│  Extract View Hints      │
│  - Parse _noema_meta        │
│  - Validate view configs │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│  Create Set GIVEN Event  │
│  - Record import source  │
│  - Capture raw structure │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│  Create Field GIVEN      │
│  Events (one per field)  │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│  Create Record GIVEN     │
│  Events (one per row)    │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  Create View MEANT Events            │
│  - References Set GIVEN event        │
│  - References Field GIVEN events     │
│  - epistemicStatus: 'preliminary'    │
│  - frame.purpose: 'import_view'      │
└───────────┬──────────────────────────┘
            │
            ▼
        All Views Available
```

### 3.3 Default View Generation

If no `_noema_meta` is provided, generate sensible defaults:

```javascript
function generateDefaultViews(schema) {
  const views = [];

  // 1. Always create a Table view
  views.push({
    name: 'All Records',
    type: 'table',
    config: { fieldOrder: schema.fields.map(f => f.name) }
  });

  // 2. If SELECT field exists → Kanban
  const selectField = schema.fields.find(f => f.type === 'SELECT');
  if (selectField) {
    views.push({
      name: `By ${selectField.name}`,
      type: 'kanban',
      config: { groupBy: selectField.name }
    });
  }

  // 3. If DATE field exists → Calendar
  const dateField = schema.fields.find(f => f.type === 'DATE');
  if (dateField) {
    views.push({
      name: 'Timeline',
      type: 'calendar',
      config: { dateField: dateField.name }
    });
  }

  // 4. If LINK fields exist → Graph
  const linkFields = schema.fields.filter(f => f.type === 'LINK');
  if (linkFields.length > 0) {
    views.push({
      name: 'Relationships',
      type: 'graph',
      config: { linkFields: linkFields.map(f => f.name) }
    });
  }

  return views;
}
```

---

## Part 4: Immediate App Refresh

### 4.1 Reactive Update Architecture

The key is using the existing `EOEventBus` for immediate UI updates:

```
Import Records
      │
      ▼
EventStore.append(givenEvent)
      │
      ▼
EventBus.emit('GIVEN_RECORDED', event)
      │
      ├─────────────────────────────────────┐
      ▼                                     ▼
StateDerivation.invalidateCache()    UI.handleNewEvent()
      │                                     │
      ▼                                     ▼
Cache Rebuilt                         DOM Updated
```

### 4.2 Batch Import with Progress

For large imports, use batching with progress events:

```javascript
class ImportOrchestrator {
  async import(file, options) {
    const BATCH_SIZE = 100;
    const records = parseFile(file);

    // Emit start event
    eventBus.emit('IMPORT_STARTED', {
      totalRecords: records.length,
      fileName: file.name
    });

    // Process in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      // Use batch mode to prevent UI thrashing
      eventBus.startBatch();

      for (const record of batch) {
        await eventStore.append(createGivenEvent(record));
      }

      eventBus.endBatch(); // Triggers single UI update

      // Emit progress
      eventBus.emit('IMPORT_PROGRESS', {
        processed: Math.min(i + BATCH_SIZE, records.length),
        total: records.length,
        percentage: Math.round(((i + BATCH_SIZE) / records.length) * 100)
      });

      // Yield to UI thread
      await new Promise(r => setTimeout(r, 0));
    }

    // Emit completion
    eventBus.emit('IMPORT_COMPLETED', {
      totalRecords: records.length,
      setId: createdSet.id,
      viewIds: createdViews.map(v => v.id)
    });
  }
}
```

### 4.3 UI Subscription for Live Updates

```javascript
// In noema_data_workbench.js
eventBus.on('IMPORT_STARTED', (data) => {
  showProgressBar(data.totalRecords);
});

eventBus.on('IMPORT_PROGRESS', (data) => {
  updateProgressBar(data.percentage);
});

eventBus.on('IMPORT_COMPLETED', (data) => {
  hideProgressBar();
  switchToView(data.viewIds[0]); // Show first created view
  showSuccessNotification(`Imported ${data.totalRecords} records`);
});

eventBus.on('GIVEN_RECORDED', (event) => {
  if (event.payload.action === 'entity_create') {
    // Refresh current view if relevant
    if (currentSetId === event.payload.setId) {
      refreshCurrentView();
    }
  }
});
```

### 4.4 Optimistic UI Pattern

For even faster perceived performance:

```javascript
async importRecord(record) {
  // 1. Generate ID optimistically
  const tempId = generateTempId();

  // 2. Update UI immediately
  renderRecord({ ...record, id: tempId, _pending: true });

  // 3. Persist async
  const event = await eventStore.append(createGivenEvent(record));

  // 4. Replace temp with real
  replaceRecord(tempId, event.payload.entityId);
}
```

---

## Part 5: Import to Existing View (Maintaining Provenance)

### 5.1 Import Modes

```javascript
const ImportMode = {
  NEW_SET: 'new_set',           // Create new set and views
  APPEND_TO_SET: 'append',      // Add records to existing set
  MERGE_TO_SET: 'merge',        // Update existing + add new
  UPDATE_ONLY: 'update'         // Only update existing records
};
```

### 5.2 Provenance Chain for Existing Views

When importing to an existing view, provenance must link back:

```
Original Import (GIVEN)
    │
    ▼
Set Created (GIVEN)
    │
    ▼
View Created (MEANT) ←── provenance: [set_given_id]
    │
    │  ← New Import Event (GIVEN)
    │       provenance: {
    │         importSource: 'quarterly_update.csv',
    │         targetSet: set_id,
    │         importMode: 'append',
    │         previousImportId: original_import_id
    │       }
    │
    ▼
Updated Records (GIVEN)
    │
    ▼
View Still Valid (MEANT references all GIVEN events)
```

### 5.3 Merge Strategy with Provenance

```javascript
class MergeImporter {
  /**
   * Import with full provenance tracking
   */
  async mergeToSet(records, targetSetId, options) {
    const {
      matchField = 'id',              // Field to match existing records
      conflictStrategy = 'newer',      // 'newer' | 'keep_existing' | 'prompt'
      createMissing = true             // Create records if no match
    } = options;

    // Create import event (GIVEN) - metadata about this import operation
    const importEvent = await this.eventStore.append({
      type: 'given',
      mode: GivenMode.RECEIVED,
      payload: {
        action: 'import_batch',
        targetSet: targetSetId,
        importMode: 'merge',
        matchField: matchField,
        conflictStrategy: conflictStrategy,
        recordCount: records.length,
        importTimestamp: new Date().toISOString(),
        sourceFile: {
          name: options.fileName,
          size: options.fileSize,
          hash: options.fileHash
        }
      }
    });

    for (const record of records) {
      const existing = await this.findExisting(targetSetId, matchField, record[matchField]);

      if (existing) {
        // Update existing record
        await this.eventStore.append({
          type: 'given',
          mode: GivenMode.RECEIVED,
          parents: [existing.id, importEvent.id], // Link to both
          payload: {
            action: 'entity_update',
            entityId: existing.entityId,
            changes: diffRecords(existing, record),
            mergeSource: importEvent.id           // Track where update came from
          }
        });
      } else if (createMissing) {
        // Create new record
        await this.eventStore.append({
          type: 'given',
          mode: GivenMode.RECEIVED,
          parents: [importEvent.id],
          payload: {
            action: 'entity_create',
            entityId: generateId('ent'),
            setId: targetSetId,
            data: record,
            importSource: importEvent.id
          }
        });
      }
    }

    return { importEventId: importEvent.id };
  }
}
```

### 5.4 Field Mapping for Different Schemas

When importing to an existing set with different field names:

```javascript
class FieldMapper {
  /**
   * Map incoming fields to existing schema
   */
  createMapping(incomingFields, existingFields) {
    return {
      // Auto-matched fields
      autoMapped: [
        { incoming: 'customer_email', existing: 'email', confidence: 0.95 },
        { incoming: 'order_total', existing: 'total', confidence: 0.90 }
      ],

      // Fields needing user decision
      unmappedIncoming: ['new_field_1', 'new_field_2'],
      unmappedExisting: ['legacy_field'],

      // User selections
      userMappings: {},  // To be filled by UI

      // Actions for unmapped
      createNewFields: true,   // Create fields for unmapped incoming
      ignoreUnmapped: false    // Don't import unmapped fields
    };
  }
}
```

**Field Mapping UI Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│                    FIELD MAPPING                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Incoming File         →    Existing Set                     │
│  ──────────────              ────────────                    │
│                                                              │
│  ✓ customer_email     ───→   email          (95% match)     │
│  ✓ order_total        ───→   total          (90% match)     │
│  ✓ created_at         ───→   created_at     (exact)         │
│                                                              │
│  ⚠ customer_id        ───→   [Select field ▼] or [Create]  │
│  ⚠ shipping_address   ───→   [Select field ▼] or [Create]  │
│                                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                              │
│  Unmapped existing fields (will be left empty):              │
│  • legacy_notes                                              │
│  • old_status                                                │
│                                                              │
│                    [Cancel]  [Import with Mapping]           │
└─────────────────────────────────────────────────────────────┘
```

### 5.5 Provenance Visualization

After import, users can trace any record's history:

```javascript
function getRecordProvenance(recordId) {
  const record = stateDerivation.getEntity(recordId);
  const events = eventStore.getEventChain(record.originEventId);

  return {
    created: {
      timestamp: events[0].timestamp,
      source: events[0].payload.importSource,
      actor: events[0].actor
    },
    updates: events.slice(1).map(e => ({
      timestamp: e.timestamp,
      changes: e.payload.changes,
      source: e.payload.mergeSource,
      actor: e.actor
    })),
    imports: extractImportEvents(events)  // All import batches that touched this record
  };
}
```

---

## Part 6: Import UI/UX

### 6.1 Import Modal

```
┌─────────────────────────────────────────────────────────────┐
│  IMPORT DATA                                            ✕   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │     📁 Drop CSV or JSON file here                   │    │
│  │         or click to browse                          │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Import to:                                                  │
│  ○ New Set                                                   │
│  ● Existing Set: [Customer Orders        ▼]                 │
│                                                              │
│  Import Mode:                                                │
│  ○ Append (add new records)                                 │
│  ● Merge (update existing, add new)                         │
│  ○ Update only (skip new records)                           │
│                                                              │
│  Match records by: [order_id              ▼]                │
│                                                              │
│  On conflict:                                                │
│  ● Use newer value                                          │
│  ○ Keep existing value                                      │
│  ○ Ask for each conflict                                    │
│                                                              │
│                                                              │
│                    [Cancel]        [Preview Import →]        │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Preview Screen

```
┌─────────────────────────────────────────────────────────────┐
│  IMPORT PREVIEW                                         ✕   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  File: quarterly_orders.csv (2.4 MB)                         │
│  Records: 1,247                                              │
│  Detected Encoding: UTF-8                                    │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Schema Preview:                                             │
│  ┌──────────────┬───────────┬─────────────────────────────┐ │
│  │ Field        │ Type      │ Sample Values               │ │
│  ├──────────────┼───────────┼─────────────────────────────┤ │
│  │ order_id     │ AUTONUMBER│ 1001, 1002, 1003           │ │
│  │ customer     │ TEXT      │ Alice, Bob, Carol          │ │
│  │ email        │ EMAIL     │ alice@co.com, bob@co.com   │ │
│  │ total        │ NUMBER    │ 99.99, 149.50, 75.00       │ │
│  │ status       │ SELECT    │ pending, shipped (5 opts)  │ │
│  │ order_date   │ DATE      │ 2024-01-15, 2024-01-16     │ │
│  └──────────────┴───────────┴─────────────────────────────┘ │
│                                                              │
│  Views to Create:                                            │
│  ☑ All Records (table)                                      │
│  ☑ By Status (kanban)                                       │
│  ☑ Timeline (calendar)                                      │
│  ☐ Custom view...                                           │
│                                                              │
│  ⚠ 3 records have missing 'email' values                    │
│  ⚠ 12 duplicate order_ids detected                          │
│                                                              │
│                    [← Back]        [Import 1,247 Records]    │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Progress Overlay

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                    Importing Records...                      │
│                                                              │
│     ████████████████████░░░░░░░░░░░░░░░  847 / 1,247        │
│                                                              │
│                         68%                                  │
│                                                              │
│     ✓ Parsed file                                           │
│     ✓ Inferred schema                                       │
│     ✓ Created set                                           │
│     ◐ Importing records...                                  │
│     ○ Creating views                                        │
│                                                              │
│                       [Cancel Import]                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 7: Implementation Plan

### Phase 1: Core Parsers (Priority: HIGH)
- [ ] CSV parser with delimiter detection
- [ ] JSON parser with structure normalization
- [ ] Schema inference engine
- [ ] Unit tests for parsers

### Phase 2: Event Integration (Priority: HIGH)
- [ ] Import orchestrator
- [ ] Batch event creation
- [ ] EventBus integration for progress
- [ ] UI refresh subscriptions

### Phase 3: View Generation (Priority: HIGH)
- [ ] `_noema_meta` parser for JSON
- [ ] Default view generator
- [ ] View MEANT event creation with provenance

### Phase 4: Merge Import (Priority: MEDIUM)
- [ ] Record matching logic
- [ ] Conflict resolution strategies
- [ ] Field mapping UI
- [ ] Provenance chain maintenance

### Phase 5: UI/UX (Priority: MEDIUM)
- [ ] Import modal with drag-drop
- [ ] Preview screen
- [ ] Progress overlay
- [ ] Error handling and messaging

### Phase 6: Advanced Features (Priority: LOW)
- [ ] Import history view
- [ ] Undo/rollback import
- [ ] Export with `_noema_meta` preservation
- [ ] Import templates

---

## File Structure

```
noema/
├── noema_import_orchestrator.js    # Main coordinator
├── noema_csv_parser.js             # CSV parsing
├── noema_json_parser.js            # JSON parsing
├── noema_schema_inferrer.js        # Type detection
├── noema_field_mapper.js           # Schema mapping
├── noema_import_ui.js              # Modal and progress UI
└── ... (existing files)
```

---

## API Reference

### ImportOrchestrator

```javascript
const orchestrator = new ImportOrchestrator(eventStore, eventBus, stateDerivation);

// Full import with all options
const result = await orchestrator.import(file, {
  mode: ImportMode.MERGE_TO_SET,
  targetSetId: 'set_123',           // For existing set
  matchField: 'order_id',           // For merge mode
  conflictStrategy: 'newer',
  fieldMapping: { ... },            // Custom field mapping
  viewHints: { ... },               // Override auto-generated views
  onProgress: (progress) => { },    // Progress callback
  validateOnly: false               // Dry run mode
});

// Result
{
  success: true,
  importEventId: 'evt_import_xxx',
  setId: 'set_123',
  viewIds: ['view_1', 'view_2'],
  recordsCreated: 1000,
  recordsUpdated: 200,
  recordsSkipped: 47,
  warnings: [],
  provenance: {
    sourceFile: 'orders.csv',
    importTimestamp: '2024-12-25T10:30:00Z',
    actor: 'user_123'
  }
}
```

### EventBus Events

```javascript
// Subscribe to import events
eventBus.on('IMPORT_STARTED', handler);
eventBus.on('IMPORT_PROGRESS', handler);
eventBus.on('IMPORT_COMPLETED', handler);
eventBus.on('IMPORT_FAILED', handler);
eventBus.on('IMPORT_CANCELLED', handler);
```

---

## Compliance Checklist

| Rule | Requirement | Implementation |
|------|-------------|----------------|
| Rule 1 | Imports are GIVEN | All raw data recorded as GIVEN events |
| Rule 2 | GIVEN only references GIVEN | Import events only reference prior GIVEN events |
| Rule 3 | Never erase | All imports append-only, conflicts create new events |
| Rule 7 | Provenance required | Views (MEANT) reference import/record GIVEN events |
| Rule 9 | Defeasible | epistemicStatus: 'preliminary' on generated views |

---

## Security Considerations

1. **File Size Limits**: Max 50MB per import
2. **Row Limits**: Max 100,000 records per import
3. **Sanitization**: Strip potentially malicious content
4. **Validation**: Validate all user-provided field mappings
5. **Isolation**: Parse files in web worker (future enhancement)

---

## Testing Strategy

```javascript
describe('ImportOrchestrator', () => {
  test('imports CSV and creates GIVEN events', async () => {
    const file = createMockCSV([...]);
    const result = await orchestrator.import(file);

    expect(eventStore.getEvents()).toHaveLength(records.length + 1); // +1 for import event
    expect(result.recordsCreated).toBe(records.length);
  });

  test('maintains provenance on merge import', async () => {
    // First import
    await orchestrator.import(file1, { mode: ImportMode.NEW_SET });

    // Merge import
    const result = await orchestrator.import(file2, {
      mode: ImportMode.MERGE_TO_SET,
      targetSetId: createdSetId
    });

    // Verify provenance chain
    const record = stateDerivation.getEntity(updatedRecordId);
    const chain = eventStore.getEventChain(record.originEventId);
    expect(chain).toContainEventWithPayload({ action: 'import_batch' });
  });

  test('emits progress events during import', async () => {
    const progressEvents = [];
    eventBus.on('IMPORT_PROGRESS', (e) => progressEvents.push(e));

    await orchestrator.import(largeFile);

    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);
  });
});
```

---

*Last Updated: December 2024*
