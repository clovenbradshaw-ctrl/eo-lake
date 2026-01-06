# noema - Compliant View Hierarchy Design

## Overview

This document defines a **Nine Rules-compliant** hierarchy for organizing data views in noema. Views are interpretations of raw experience data - they are MEANT events, not sources of truth.

---

## Fundamental Principle

> **Views are Meant Events**: Every view configuration is an interpretation of how to see Given data. Views do not create, modify, or delete raw experience - they only present it through a particular lens.

---

## The View Hierarchy

```
                    ┌─────────────────────────────────────────┐
                    │            HORIZON GATE                  │
                    │  (Rule 4: All access is perspectival)    │
                    └─────────────────────────┬───────────────┘
                                              │
                    ┌─────────────────────────▼───────────────┐
                    │           VIEW REGISTRY                  │
                    │    (Manages all view configurations)     │
                    └─────────────────────────┬───────────────┘
                                              │
           ┌──────────────────┬───────────────┼───────────────┬──────────────────┐
           │                  │               │               │                  │
           ▼                  ▼               ▼               ▼                  ▼
    ┌─────────────┐    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    ┌─────────────┐
    │  WORKSPACES │    │    SETS     │ │   LENSES    │ │   FOCUSES   │    │  SNAPSHOTS  │
    │  (Contexts) │    │ (Datasets)  │ │(View Types) │ │ (Filtered)  │    │  (Static)   │
    └──────┬──────┘    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘    └─────────────┘
           │                  │               │               │
           │                  │               │               │
           ▼                  ▼               ▼               ▼
    ┌─────────────────────────────────────────────────────────────────────────────────┐
    │                           DERIVED STATE LAYER                                    │
    │                    (Computed from Event Log - Read Only)                         │
    │                                                                                  │
    │   Rule 7: All views have provenance in Given events                              │
    │   Rule 8: Views crystallize at minimal horizons                                  │
    │   Rule 9: Views can be superseded, never dogmatic                                │
    └─────────────────────────────────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────▼───────────────┐
                    │            EVENT LOG (Given)            │
                    │     The sole source of truth             │
                    │                                          │
                    │   Rule 1: Events are Given or Meant      │
                    │   Rule 2: Given from external only       │
                    │   Rule 3: Given events are immutable     │
                    └─────────────────────────────────────────┘
```

---

## Hierarchy Levels

### Level 1: Workspaces (Contextual Boundaries)

**Purpose**: Define the broadest organizational context for viewing data.

**Compliance**:
- Workspaces are MEANT events - interpretations of how to organize work
- Each workspace respects Rule 4 (Perspectivality) - represents a particular horizon
- Workspace access can only RESTRICT, never expand (Rule 5: Restrictivity)

```javascript
const WorkspaceConfig = {
  id: 'workspace_xxx',
  type: 'meant',
  name: 'Project Alpha',

  // Rule 7: Grounded in Given events
  provenance: ['given_event_001', 'given_event_002'],

  // Rule 4: Horizon definition
  horizon: {
    timeRange: { from: '2024-01-01', to: null },
    actors: ['user_a', 'user_b'],
    entityTypes: ['task', 'document']
  },

  // Rule 9: Defeasibility metadata
  epistemicStatus: 'preliminary',
  supersedes: null,
  supersededBy: null
};
```

---

### Level 2: Sets (Typed Data Collections)

**Purpose**: Group related entities into coherent collections with shared schema.

**Compliance**:
- Sets are MEANT events defining how to interpret entity groupings
- Set boundaries are interpretations, not ontological facts
- Sets have provenance tracking back to the Given events they interpret

```javascript
const SetConfig = {
  id: 'set_xxx',
  type: 'meant',
  name: 'Active Tasks',
  workspaceId: 'workspace_xxx',

  // Schema is an interpretation of entity structure
  schema: {
    fields: [
      { id: 'field_1', name: 'Title', type: 'text', isPrimary: true },
      { id: 'field_2', name: 'Status', type: 'select' },
      { id: 'field_3', name: 'Due Date', type: 'date' }
    ]
  },

  // Rule 7: Provenance chain
  provenance: {
    derivedFrom: ['given_event_xxx'],
    createdAt: '2024-01-15T10:00:00Z',
    createdBy: 'user_a'
  },

  // Rule 6: Coherence constraints
  coherenceRules: {
    includeTypes: ['task'],
    excludeDeleted: true
  }
};
```

---

### Level 3: Lenses (View Type Perspectives)

**Purpose**: Define HOW to visualize data - the rendering perspective.

**Types**:
| Lens Type | Purpose | Best For |
|-----------|---------|----------|
| **Grid** | Tabular data display | Bulk editing, data entry |
| **Cards** | Visual entity browsing | Quick scanning, media-rich |
| **Kanban** | Status-based columns | Workflow tracking |
| **Timeline** | Chronological ordering | Event sequences, history |
| **Calendar** | Date-positioned events | Scheduling, deadlines |
| **Graph** | Relationship networks | Connections, dependencies |

**Compliance**:
- Each lens is a MEANT event - an interpretation of presentation
- Lens configurations are grounded in the Set's Given data
- Multiple lenses can coexist - none is "correct" (Rule 9: no dogmatism)

```javascript
const LensConfig = {
  id: 'lens_xxx',
  type: 'meant',
  lensType: 'kanban',
  setId: 'set_xxx',
  name: 'Task Board',

  // Lens-specific configuration
  config: {
    groupByField: 'field_2', // Status
    cardTitleField: 'field_1',
    cardDescriptionField: null,
    columnOrder: ['todo', 'in_progress', 'done'],
    showEmptyColumns: true
  },

  // Visual settings
  display: {
    columnWidth: 280,
    cardHeight: 'auto',
    showFieldLabels: true
  },

  // Rule 7: Provenance
  provenance: {
    derivedFromSet: 'set_xxx',
    derivedFromLens: null, // Or parent lens if derived
    purpose: 'workflow_tracking'
  },

  // Rule 8: Determinacy at minimal horizon
  frame: {
    purpose: 'workflow_visualization',
    epistemicStatus: 'preliminary'
  }
};
```

---

### Level 4: Focuses (Filtered Perspectives)

**Purpose**: Apply constraints to narrow what data is visible within a lens.

**Compliance**:
- Focuses are refinements - they can only RESTRICT (Rule 5)
- Each focus maintains provenance to its parent lens
- Focuses inherit horizon constraints and can only narrow them

```javascript
const FocusConfig = {
  id: 'focus_xxx',
  type: 'meant',
  name: 'My Tasks This Week',
  lensId: 'lens_xxx',

  // Rule 5: Only restrictions, never expansions
  restrictions: {
    filters: [
      { field: 'assignee', operator: 'equals', value: 'user_a' },
      { field: 'dueDate', operator: 'within', value: 'this_week' }
    ],
    sorts: [
      { field: 'dueDate', direction: 'asc' }
    ],
    limit: null // No artificial limit
  },

  // Visibility constraints
  visibility: {
    hiddenFields: ['internal_notes'],
    hiddenRecords: [] // IDs explicitly hidden
  },

  // Rule 7: Provenance chain
  provenance: {
    derivedFromLens: 'lens_xxx',
    filterReason: 'personal_task_view',
    createdBy: 'user_a'
  },

  // Rule 6: Coherence guarantee
  // What's valid in the lens remains valid in the focus
  coherenceInherited: true
};
```

---

### Level 5: Snapshots (Immutable Captures)

**Purpose**: Create read-only captures of a view at a specific point in time.

**Compliance**:
- Snapshots are MEANT events that crystallize a moment
- They capture the view configuration AND the data state
- Snapshots cannot be edited, only superseded (Rule 9)

```javascript
const SnapshotConfig = {
  id: 'snapshot_xxx',
  type: 'meant',
  name: 'Q1 Review - Task Status',
  sourceViewId: 'focus_xxx', // Can snapshot any level

  // Captured state
  capturedAt: '2024-03-31T23:59:59Z',
  capturedBy: 'user_a',

  // The frozen view configuration
  viewConfig: { /* ... full lens/focus config */ },

  // The data as it appeared
  dataState: {
    recordIds: ['rec_1', 'rec_2', 'rec_3'],
    eventLogPosition: 'event_xxx' // Last included event
  },

  // Rule 9: Defeasibility
  annotations: {
    purpose: 'quarterly_review',
    notes: 'Status snapshot for Q1 planning review'
  },

  // Immutability marker
  immutable: true,
  supersededBy: null
};
```

---

## The View Registry

Central coordinator ensuring compliant view management.

```javascript
class ViewRegistry {
  constructor(horizonGate, eventStore) {
    this.gate = horizonGate;  // Rule 4: All access through gate
    this.store = eventStore;  // Source of Given events
    this.views = new Map();
  }

  /**
   * Create a new view (Meant event)
   * Rule 7: Must have provenance
   */
  createView(config, provenance) {
    if (!provenance || provenance.length === 0) {
      throw new ComplianceError('Rule 7: Views require provenance');
    }

    // All views are Meant events
    const viewEvent = {
      id: generateId('view'),
      type: 'meant',
      category: 'view_config',
      payload: config,
      provenance: provenance,
      frame: {
        purpose: 'data_visualization',
        epistemicStatus: 'preliminary'
      },
      timestamp: new Date().toISOString()
    };

    this.store.append(viewEvent);
    this.views.set(viewEvent.id, config);

    return viewEvent.id;
  }

  /**
   * Get view data respecting horizon
   * Rule 4: All access perspectival
   * Rule 5: Can only restrict
   */
  getViewData(viewId, horizon) {
    const config = this.views.get(viewId);
    if (!config) return null;

    // Get data through horizon gate (Rule 4)
    const available = this.gate.getAvailable(horizon);

    // Apply view's restrictions (Rule 5)
    let data = this._applyFilters(available, config.restrictions);
    data = this._applySorts(data, config.restrictions?.sorts);

    return {
      config,
      data,
      horizon,
      accessedAt: new Date().toISOString()
    };
  }

  /**
   * Supersede a view (Rule 9: Defeasibility)
   */
  supersedeView(viewId, newConfig, reason, provenance) {
    const oldView = this.views.get(viewId);
    if (!oldView) return null;

    // Create supersession event
    const supersessionEvent = {
      type: 'meant',
      category: 'view_supersession',
      payload: {
        supersedes: viewId,
        newConfig,
        reason
      },
      provenance: [...provenance, viewId],
      frame: {
        purpose: 'view_refinement',
        epistemicStatus: 'preliminary'
      }
    };

    this.store.append(supersessionEvent);

    // Mark old view as superseded
    oldView.supersededBy = supersessionEvent.id;

    return supersessionEvent.id;
  }

  /**
   * Get view lineage (provenance chain)
   * Rule 7: Traceability
   */
  getViewLineage(viewId) {
    const lineage = [];
    let current = this.views.get(viewId);

    while (current) {
      lineage.push({
        id: current.id,
        name: current.name,
        provenance: current.provenance
      });

      // Walk up the hierarchy
      const parentId = current.provenance?.derivedFromLens ||
                       current.provenance?.derivedFromSet ||
                       current.provenance?.derivedFromWorkspace;
      current = parentId ? this.views.get(parentId) : null;
    }

    return lineage;
  }
}
```

---

## Compliance Checklist for Views

### Before Creating a View

- [ ] **Rule 1**: View is explicitly typed as `meant` (interpretation)
- [ ] **Rule 4**: View specifies its horizon constraints
- [ ] **Rule 5**: View only restricts parent scope, never expands
- [ ] **Rule 7**: View has non-empty provenance array

### During View Operations

- [ ] **Rule 2**: View never writes to Given events
- [ ] **Rule 3**: View never modifies existing event data
- [ ] **Rule 4**: All data access goes through HorizonGate
- [ ] **Rule 6**: Derivations valid at parent remain valid in child

### When Updating Views

- [ ] **Rule 3**: Update creates new event, doesn't modify old
- [ ] **Rule 9**: Original view marked superseded, not deleted
- [ ] **Rule 7**: Update event includes provenance to original

---

## View Derivation Patterns

### Pattern 1: Focus from Lens (Restriction)

```javascript
// Create a personal focus from shared lens
const personalFocus = registry.createFocus({
  name: 'My Assigned Tasks',
  lensId: 'team_task_board',
  restrictions: {
    filters: [{ field: 'assignee', value: currentUser.id }]
  }
}, [lensId, currentUser.initialGivenEventId]);
```

### Pattern 2: Lens from Set (Perspective)

```javascript
// Create kanban lens for existing set
const kanbanLens = registry.createLens({
  name: 'Sprint Board',
  setId: 'active_tasks',
  lensType: 'kanban',
  config: {
    groupByField: 'sprint',
    cardTitleField: 'title'
  }
}, [setId]);
```

### Pattern 3: Snapshot from Focus (Crystallization)

```javascript
// Capture current state for review
const snapshot = registry.createSnapshot({
  name: 'Sprint 5 Retrospective',
  sourceViewId: 'sprint_5_focus',
  annotations: {
    purpose: 'retrospective',
    reviewed: false
  }
}, [focusId]);
```

---

## Integration with noema

### View Events in the Log

All view configurations are stored as Meant events:

```javascript
// View creation event
{
  id: 'evt_view_001',
  type: 'meant',
  category: 'view_config',
  actor: 'user_a',
  timestamp: '2024-01-15T10:00:00Z',
  payload: {
    viewType: 'lens',
    lensType: 'kanban',
    name: 'Task Board',
    config: { ... }
  },
  provenance: ['evt_given_001', 'evt_given_002'],
  frame: {
    purpose: 'workflow_visualization',
    epistemicStatus: 'preliminary'
  }
}
```

### View State Derivation

Views are derived on-demand from the event log:

```javascript
// In EOStateDerivation
deriveViewState(viewId, horizon) {
  // 1. Get view config event
  const viewEvent = this.store.get(viewId);
  if (viewEvent.type !== 'meant') {
    throw new ComplianceError('View must be a Meant event');
  }

  // 2. Get accessible Given events through horizon
  const givenEvents = this.gate.getAvailable(horizon)
    .filter(e => e.type === 'given');

  // 3. Build current entity state
  const entities = this.buildEntities(givenEvents);

  // 4. Apply view configuration
  return this.applyViewConfig(entities, viewEvent.payload);
}
```

---

## Summary

| Level | Purpose | Compliance Key |
|-------|---------|----------------|
| **Workspace** | Contextual boundary | Rule 4, 5: Horizon definition |
| **Set** | Data collection | Rule 7: Schema as interpretation |
| **Lens** | View type | Rule 8, 9: Perspective, not truth |
| **Focus** | Filtered view | Rule 5: Only restricts |
| **Snapshot** | Frozen state | Rule 9: Crystallized, supersedable |

All views are **Meant events** - interpretations grounded in Given experience, accessed through horizons, and always supersedable. The event log remains the sole source of truth.

---

*"A view is not the data - it is one way of seeing the data."*
