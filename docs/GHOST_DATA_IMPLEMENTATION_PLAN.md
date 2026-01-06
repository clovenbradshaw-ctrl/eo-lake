# Ghost Data Implementation Plan

## Overview

This plan introduces "Ghost Data" - deleted records that continue to "haunt" the system by influencing behavior, providing audit trails, and enabling recovery. Based on patterns from eo-activibase's tombstone and supersession mechanisms, adapted for noema's Nine Rules architecture.

## Philosophy: Ghosts Are First-Class Citizens

In the EO framework, deletion is not erasure - it's a transformation. Ghost data represents:
- **Rule 3 (Ineliminability)**: Nothing truly disappears; deletion creates a ghost
- **Rule 9 (Defeasibility)**: Interpretations can be superseded, creating ghost versions
- **NUL Operator (∅)**: "Assert meaningful absence" - ghosts are meaningful absences

**Key Insight from eo-activibase**: The `tossPile` with `showGhosts: true` setting demonstrates that deleted items should remain queryable and potentially visible.

---

## Current State in noema

### Already Implemented
- **Tombstone events** in `noema_event_store.js` - deletion recorded as GIVEN events
- **Supersession** for MEANT events - old interpretations replaced, not deleted
- **`tombstoned: true` flag** on derived entities
- **NUL operator** in activity recording
- **Tossed items array** in workbench (UI-level soft delete)

### Missing (Ghost Data Features)
- Ghost data registry with metadata
- Haunt mechanics (how ghosts influence active data)
- Ghost visibility controls per horizon
- Resurrection/restore functionality
- Ghost analytics and aging
- Trash/recycle bin UI

---

## Implementation Plan

### Phase 1: Ghost Data Registry

**New Module: `noema_ghost_registry.js`**

```javascript
/**
 * Ghost Data Registry
 * Tracks deleted entities and their haunting influence
 */
class EOGhostRegistry {
  constructor(eventStore, eventBus) {
    this._ghosts = new Map();  // entityId → GhostRecord
    this._hauntings = new Map();  // targetId → Set<ghostId>
    this._eventStore = eventStore;
    this._eventBus = eventBus;
  }

  // GhostRecord structure
  _createGhostRecord(entityId, tombstoneEvent) {
    return {
      id: entityId,
      ghostedAt: tombstoneEvent.timestamp,
      ghostedBy: tombstoneEvent.actor,
      reason: tombstoneEvent.payload.reason,
      snapshot: tombstoneEvent.payload.targetSnapshot,
      tombstoneEventId: tombstoneEvent.id,

      // Haunting metadata
      hauntTargets: [],      // Entities this ghost influences
      hauntType: null,       // 'reference' | 'computation' | 'semantic'
      hauntStrength: 1.0,    // Decay over time (0.0-1.0)

      // Lifecycle
      status: 'active',      // 'active' | 'dormant' | 'resurrected' | 'purged'
      lastHauntedAt: null,
      resurrectionCount: 0,

      // Retention
      retentionPolicy: 'standard',  // 'standard' | 'legal_hold' | 'permanent'
      expiresAt: null
    };
  }
}
```

**Key Methods:**
- `registerGhost(entityId, tombstoneEvent)` - Create ghost from deletion
- `getGhost(entityId)` - Retrieve ghost record
- `getAllGhosts(options)` - Query ghosts with filters
- `resurrect(ghostId, actor, reason)` - Restore ghost to active entity
- `recordHaunt(ghostId, targetId, hauntType)` - Track ghost influence
- `getHauntingGhosts(entityId)` - Get ghosts affecting an entity

---

### Phase 2: Haunt Mechanics

**Concept**: Ghosts "haunt" active data by leaving traces of their former existence.

#### 2.1 Reference Haunting
When a deleted entity was referenced by other entities:

```javascript
// In noema_state_derivation.js
deriveEntity(entityId) {
  const entity = this._computeEntity(entityId);

  // Check for ghost references
  const ghostRefs = this._ghostRegistry.findGhostReferences(entity);
  if (ghostRefs.length > 0) {
    entity._hauntedBy = ghostRefs.map(g => ({
      ghostId: g.id,
      field: g.referencingField,
      originalValue: g.snapshot[g.referencingField],
      hauntType: 'reference'
    }));
  }

  return entity;
}
```

#### 2.2 Computation Haunting
When derived values depended on deleted data:

```javascript
// Ghost influence on computed fields
computeDerivedValue(formula, inputs) {
  const result = evaluate(formula, inputs);

  // Track if any inputs were ghosts
  const ghostInputs = inputs.filter(i => this._ghostRegistry.isGhost(i.entityId));
  if (ghostInputs.length > 0) {
    result._derivedFromGhosts = ghostInputs.map(g => g.entityId);
    result._hauntWarning = 'Value computed from deleted data';
  }

  return result;
}
```

#### 2.3 Semantic Haunting
When entity names/identifiers leave traces:

```javascript
// Track semantic ghosts (names that were used)
registerSemanticGhost(name, entityType, originalEntityId) {
  this._semanticGhosts.set(`${entityType}:${name}`, {
    originalId: originalEntityId,
    name,
    entityType,
    ghostedAt: Date.now(),
    reusable: false  // Prevent name collision until explicitly cleared
  });
}
```

---

### Phase 3: Ghost Visibility & Horizons

**Extend Horizon Configuration:**

```javascript
// In horizon configuration
{
  horizonId: 'audit-horizon',
  ghostVisibility: {
    mode: 'visible',           // 'hidden' | 'visible' | 'highlighted'
    showHauntIndicators: true, // Show when active data is haunted
    showGhostChains: true,     // Show full deletion lineage
    maxGhostAge: null,         // null = show all, or days
    statusFilter: ['active', 'dormant']  // Which ghost statuses
  }
}
```

**Ghost Visibility Modes:**
- `hidden` - Default user experience, ghosts not shown
- `visible` - Ghosts appear grayed out in views
- `highlighted` - Ghosts and haunt relationships emphasized (audit mode)

---

### Phase 4: UI Components

#### 4.1 Ghost Indicator Component

```javascript
// Visual indicator when data is haunted
renderHauntIndicator(entity) {
  if (!entity._hauntedBy?.length) return null;

  return `
    <span class="haunt-indicator" title="Influenced by deleted data">
      👻 ${entity._hauntedBy.length} ghost${entity._hauntedBy.length > 1 ? 's' : ''}
    </span>
  `;
}
```

#### 4.2 Trash/Ghost View

```javascript
// New view type in view hierarchy
{
  viewType: 'ghost-view',
  name: 'Deleted Items',
  icon: '🗑️',
  filters: {
    ghostStatus: ['active', 'dormant'],
    sortBy: 'ghostedAt',
    sortOrder: 'desc'
  },
  actions: ['resurrect', 'purge', 'view-haunts']
}
```

#### 4.3 Resurrection Dialog

```javascript
renderResurrectionDialog(ghost) {
  return {
    title: `Resurrect "${ghost.snapshot.name}"?`,
    warnings: [
      `This item was deleted by ${ghost.ghostedBy} on ${ghost.ghostedAt}`,
      `Reason: ${ghost.reason}`,
      ghost.hauntTargets.length > 0
        ? `Currently haunting ${ghost.hauntTargets.length} items`
        : null
    ],
    options: {
      restoreReferences: true,  // Re-link to entities that referenced this
      clearHaunts: true,        // Remove haunt indicators from affected entities
      notifyAffected: false     // Notify actors who worked with haunted data
    }
  };
}
```

---

### Phase 5: Event Bus Integration

**New Events:**

```javascript
// Add to noema_event_bus.js EVENT_TYPES
ENTITY_GHOSTED: 'entity:ghosted',
ENTITY_RESURRECTED: 'entity:resurrected',
HAUNT_DETECTED: 'ghost:haunt_detected',
HAUNT_RESOLVED: 'ghost:haunt_resolved',
GHOST_EXPIRED: 'ghost:expired',
GHOST_PURGED: 'ghost:purged'
```

**Event Handlers:**

```javascript
// Auto-register ghost on tombstone
eventBus.on('TOMBSTONE_CREATED', (event) => {
  ghostRegistry.registerGhost(event.payload.targetId, event);
  eventBus.emit('ENTITY_GHOSTED', {
    entityId: event.payload.targetId,
    ghostRecord: ghostRegistry.getGhost(event.payload.targetId)
  });
});

// Detect haunts when entities change
eventBus.on('ENTITY_UPDATED', (event) => {
  const haunts = ghostRegistry.detectHaunts(event.entityId);
  if (haunts.length > 0) {
    eventBus.emit('HAUNT_DETECTED', { entityId: event.entityId, haunts });
  }
});
```

---

### Phase 6: Activity Recording

**Extend Activity Atoms for Ghost Operations:**

```javascript
// In noema_activity.js
const GHOST_ACTIVITIES = {
  ghost: (entityId, reason) => ({
    operator: 'NUL',
    action: 'ghost',
    target: { entityId },
    context: { reason, ghostedAt: Date.now() }
  }),

  resurrect: (ghostId, options) => ({
    operator: 'INS',  // Re-asserting existence
    action: 'resurrect',
    target: { ghostId },
    context: { options, resurrectedAt: Date.now() }
  }),

  haunt: (ghostId, targetId, hauntType) => ({
    operator: 'CON',  // Connection between ghost and target
    action: 'haunt',
    target: { ghostId, targetId },
    context: { hauntType, detectedAt: Date.now() }
  })
};
```

---

### Phase 7: Compliance Integration

**Add Ghost Data Rules to Compliance Checker:**

```javascript
// In noema_compliance.js
GHOST_COMPLIANCE_RULES = {
  // Ghosts must have valid tombstone events
  GHOST_GROUNDED: (ghost) => {
    const tombstone = eventStore.get(ghost.tombstoneEventId);
    return tombstone && tombstone.payload?.action === 'tombstone';
  },

  // Ghost snapshots must match original entity state
  GHOST_SNAPSHOT_VALID: (ghost) => {
    const originalEvents = eventStore.getByEntity(ghost.id);
    return validateSnapshot(ghost.snapshot, originalEvents);
  },

  // Haunts must be recorded (Rule 7 - Groundedness)
  HAUNTS_RECORDED: (ghost) => {
    return ghost.hauntTargets.every(targetId =>
      activityStore.hasActivity('haunt', ghost.id, targetId)
    );
  },

  // Retention policies must be enforced
  RETENTION_COMPLIANT: (ghost) => {
    if (ghost.retentionPolicy === 'legal_hold') {
      return ghost.status !== 'purged';
    }
    return true;
  }
};
```

---

### Phase 8: Persistence

**IndexedDB Schema Extension:**

```javascript
// Add to noema_persistence.js
const GHOST_STORE = {
  name: 'ghosts',
  keyPath: 'id',
  indexes: [
    { name: 'by_status', keyPath: 'status' },
    { name: 'by_ghostedAt', keyPath: 'ghostedAt' },
    { name: 'by_ghostedBy', keyPath: 'ghostedBy' },
    { name: 'by_retentionPolicy', keyPath: 'retentionPolicy' },
    { name: 'by_expiresAt', keyPath: 'expiresAt' }
  ]
};

const HAUNT_STORE = {
  name: 'haunts',
  keyPath: ['ghostId', 'targetId'],
  indexes: [
    { name: 'by_ghost', keyPath: 'ghostId' },
    { name: 'by_target', keyPath: 'targetId' },
    { name: 'by_type', keyPath: 'hauntType' }
  ]
};
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| **NEW: `noema_ghost_registry.js`** | Core ghost data management module |
| `noema_event_store.js` | Hook ghost registration on tombstone creation |
| `noema_state_derivation.js` | Add haunt detection to entity derivation |
| `noema_event_bus.js` | Add ghost-related event types |
| `noema_activity.js` | Add ghost activity recording |
| `noema_compliance.js` | Add ghost compliance rules |
| `noema_persistence.js` | Add ghost and haunt IndexedDB stores |
| `noema_data_workbench.js` | Add ghost UI components, trash view |
| `noema_view_hierarchy.js` | Add ghost-view type |
| `noema_horizon.js` | Add ghost visibility configuration |
| `noema_principles_transparency.js` | Show ghost operations in transparency panel |

---

## Ghost Lifecycle Diagram

```
                    ┌─────────────┐
                    │   Entity    │
                    │  (Active)   │
                    └──────┬──────┘
                           │ delete()
                           ▼
                    ┌─────────────┐
                    │   Ghost     │
                    │  (Active)   │◄────────────────┐
                    └──────┬──────┘                 │
                           │                        │
            ┌──────────────┼──────────────┐        │
            │              │              │        │
            ▼              ▼              ▼        │
     ┌───────────┐  ┌───────────┐  ┌───────────┐  │ resurrect()
     │  Haunts   │  │ Time      │  │ Manual    │  │
     │  Active   │  │ Passes    │  │ Resurrect │──┘
     │  Entities │  │           │  │           │
     └───────────┘  └─────┬─────┘  └───────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   Ghost     │
                   │  (Dormant)  │
                   └──────┬──────┘
                          │ expires / purge()
                          ▼
                   ┌─────────────┐
                   │   Ghost     │
                   │  (Purged)   │
                   └─────────────┘
                          │
                          ▼
                   [Tombstone event remains
                    in append-only log forever
                    per Rule 3]
```

---

## Success Criteria

1. **Deletion creates ghost** - Every delete operation produces a ghost record
2. **Ghosts haunt** - References to deleted entities show haunt indicators
3. **Ghosts are queryable** - Can list all ghosts with filters
4. **Ghosts are visible** - Trash view shows deleted items
5. **Ghosts can resurrect** - Restore deleted entities with full history
6. **Haunts are tracked** - Activity log records all ghost influences
7. **Compliance passes** - Ghost operations comply with Nine Rules
8. **Horizons control visibility** - Different horizons show different ghost views

---

## Implementation Order

1. `noema_ghost_registry.js` - Core module (foundation)
2. Event bus integration - Ghost events
3. `noema_event_store.js` hooks - Auto-register ghosts
4. `noema_state_derivation.js` - Haunt detection
5. `noema_persistence.js` - Ghost storage
6. `noema_activity.js` - Ghost activity recording
7. `noema_compliance.js` - Ghost rules
8. UI components - Indicators, trash view, resurrection
9. Horizon integration - Visibility controls
10. Transparency panel - Ghost operation display
