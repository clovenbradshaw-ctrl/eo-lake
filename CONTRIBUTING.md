# Contributing to noema - Experience Engine

This guide ensures all contributions maintain compliance with the **Nine Rules of Experience Engines**.

## The Fundamental Law

> **The append-only log is the database. Everything else is a view.**

Every piece of state in this application derives from the event log. There is no other source of truth.

---

## The Nine Rules - Quick Reference

### Part I: The Given (Raw Experience Protection)

| Rule | Name | Requirement | Violation |
|------|------|-------------|-----------|
| 1 | **Distinction** | Every event is either `given` OR `meant`, never both | Categorical Confusion |
| 2 | **Impenetrability** | `given` events derive only from external sources or other `given` events | Confabulation |
| 3 | **Ineliminability** | `given` events can never be deleted, modified, or overwritten | Gaslighting |

### Part II: The Horizon (Perspectival Coherence)

| Rule | Name | Requirement | Violation |
|------|------|-------------|-----------|
| 4 | **Perspectivality** | All access is mediated by horizon; no universal view | Context Collapse |
| 5 | **Restrictivity** | Horizon refinement can only restrict, never expand access | Foreclosure Violation |
| 6 | **Coherence** | Valid inference at broad horizon survives refinement | Coherence Failure |

### Part III: The Meant (Interpretive Accountability)

| Rule | Name | Requirement | Violation |
|------|------|-------------|-----------|
| 7 | **Groundedness** | All interpretations must have provenance in `given` events | Groundlessness |
| 8 | **Determinacy** | Meaning crystallizes at minimal horizons, not universal | Premature Determinacy |
| 9 | **Defeasibility** | Interpretations can be superseded; no dogmatic claims | Dogmatism |

---

## Code Patterns for Compliance

### Recording Raw Experience (Given Events)

```javascript
// CORRECT: Record a Given event
app.recordGiven(GivenMode.PERCEIVED, {
  action: 'observation',
  content: 'User clicked button X'
});

// WRONG: Never create Given from interpretation
// This violates Rule 2 (Impenetrability)
const interpretation = app.getMeantEvents()[0];
app.recordGiven(GivenMode.RECEIVED, {
  derivedFrom: interpretation.id  // CONFABULATION!
});
```

### Creating Interpretations (Meant Events)

```javascript
// CORRECT: Meant event with provenance
const givenEvents = app.getGivenEvents();
app.recordMeant(
  'summary',                           // Frame purpose
  { content: 'User is exploring...' }, // Interpretation
  givenEvents.map(e => e.id)           // Provenance (REQUIRED)
);

// WRONG: Meant without provenance violates Rule 7
app.recordMeant('analysis', { content: '...' }, []);  // GROUNDLESS!
```

### Deletion is Supersession

```javascript
// CORRECT: Use tombstones, not deletion
app.deleteEntity(entityId, 'No longer needed');
// This creates a NEW event that marks the old one superseded

// WRONG: Never mutate or delete from the log
eventStore._log.splice(index, 1);  // GASLIGHTING!
event.payload.value = newValue;     // GASLIGHTING!
```

### Horizon-Mediated Access

```javascript
// CORRECT: Access through the gate
const gate = app.getGate();
const available = gate.getAvailable();

// WRONG: Bypassing horizon violates Rule 4
const allEvents = eventStore.getAll();  // Only use for admin/compliance
```

---

## File Structure and Responsibilities

```
noema/
├── noema_event_store.js     # Rules 1, 2, 3, 8, 9 - Core append-only log
├── noema_horizon.js         # Rules 4, 5, 6 - Perspectival access
├── noema_compliance.js      # All 9 rules - Audit and validation
├── noema_state_derivation.js # Derived views (NEVER authoritative)
├── noema_persistence.js     # Local storage (mirrors log)
├── noema_sync.js            # Cloud sync (respects all rules)
├── noema_event_bus.js       # Reactive updates
├── noema_graph.js           # Graph visualization
├── noema_views.js           # View management
├── noema_data_workbench.js  # Data manipulation UI
├── noema_app.js             # Main controller
├── noema_workbench.js       # UI controller
├── noema_styles.css         # Styling
└── index.html            # Entry point
```

---

## Adding New Features

### Before You Start

1. **Run the compliance check**: `app.runComplianceCheck()`
2. **Understand which rules your feature touches**
3. **Plan how state changes will be logged**

### The Compliance Checklist

Before submitting any change, verify:

- [ ] **Rule 1**: All new events have explicit `type: 'given'` or `type: 'meant'`
- [ ] **Rule 2**: No `given` events derive from `meant` events
- [ ] **Rule 3**: No mutations to existing events; all changes are new events
- [ ] **Rule 4**: Access goes through HorizonGate, not direct log access
- [ ] **Rule 5**: Any new horizon is a refinement (subset) of its parent
- [ ] **Rule 6**: Derivations remain valid under horizon refinement
- [ ] **Rule 7**: All `meant` events have non-empty `provenance` array
- [ ] **Rule 8**: `meant` events have `frame` with `purpose`
- [ ] **Rule 9**: No events claim `immutable: true` or `infallible` status

### Testing Compliance

```javascript
// Run after making changes
const audit = app.runComplianceCheck();
console.log(audit);  // Should show 9/9 rules passing

// Or programmatically
if (audit.audit.conformanceLevel !== 'FULL_CONFORMANCE') {
  throw new Error('Compliance violation!');
}
```

---

## Common Violations and Fixes

### Violation: "Given event derives from Meant event"

**Problem**: You're creating raw experience from interpretation.

```javascript
// BAD
const analysis = app.getMeantEvents()[0];
app.recordGiven('received', { basedOn: analysis.id });
```

**Fix**: Given events come from external sources only.

```javascript
// GOOD
app.recordGiven('received', {
  action: 'user_input',
  content: userInput
});
```

### Violation: "Meant event has no provenance"

**Problem**: Interpretation without grounding.

```javascript
// BAD
app.recordMeant('conclusion', { content: 'I think...' }, []);
```

**Fix**: Always trace to source experiences.

```javascript
// GOOD
const sources = app.getGivenEvents().filter(e => /* relevant */);
app.recordMeant('conclusion', { content: 'Based on evidence...' },
  sources.map(e => e.id));
```

### Violation: "Event modified after creation"

**Problem**: Mutating historical record.

```javascript
// BAD
const event = eventStore.get(id);
event.payload.status = 'updated';  // Mutation!
```

**Fix**: Create a new event that supersedes.

```javascript
// GOOD
eventStore.createSupersession(id,
  { status: 'updated' },
  actor, frame, provenance, context
);
```

---

## Architecture Principles

### 1. Log Primacy
The event log is the only source of truth. All other state is derived.

### 2. Append-Only
Events are immutable once written. "Changes" are new events.

### 3. Horizon-Mediated Access
There is no God's-eye view. All access is perspectival.

### 4. Grounded Interpretation
Every interpretation traces to raw experience.

### 5. Revisable Meaning
Interpretations can be superseded; nothing is dogma.

---

## Pull Request Requirements

1. **Compliance Audit Passes**: Run and include output of `app.runComplianceCheck()`
2. **No Direct Log Mutation**: Review for any `_log` or `_index` modifications
3. **Provenance Chains**: Verify all new Meant events have provenance
4. **Horizon Respect**: Access goes through gates, not raw store

---

## Questions?

If you're unsure whether something violates the Nine Rules:

1. Ask: "Does this create experience from interpretation?" (Rule 2)
2. Ask: "Does this erase or modify history?" (Rule 3)
3. Ask: "Does this interpretation trace to experience?" (Rule 7)
4. Ask: "Does this claim certainty or finality?" (Rule 9)

When in doubt, the safest path is:
- **Record raw experience as Given**
- **Derive meaning as Meant with provenance**
- **Never mutate, only append**
- **Access through horizons**

---

*"These nine rules describe the minimal conditions under which recorded experience remains interpretable without enabling fabrication, erasure, or dogma."*
