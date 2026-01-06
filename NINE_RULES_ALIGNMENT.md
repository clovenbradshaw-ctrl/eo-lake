# noema - Nine Rules Alignment

This document details how noema aligns with the **Nine Rules of Experience Engines** — a rigorous philosophical framework for building trustworthy, transparent data systems that prevent fabrication, erasure, and dogmatic thinking.

---

## Overview

noema is an Airtable-style data workbench built from the ground up on Experience Engine principles. Every architectural decision, from the append-only event log to the horizon-gated access layer, directly implements one or more of the Nine Rules.

### The Fundamental Axiom

> **AXIOM 0: The append-only log is the database. Everything else is a view.**

This axiom underpins the entire system. State is never stored directly — it is always computed from the immutable event log.

---

## The Three Parts

The Nine Rules are organized into three philosophical parts:

| Part | Focus | Rules | Violation Prevented |
|------|-------|-------|---------------------|
| **I: The Given** | Raw Experience Protection | 1, 2, 3 | Fabrication, Erasure |
| **II: The Horizon** | Perspectival Coherence | 4, 5, 6 | Context Collapse, Omniscience |
| **III: The Meant** | Interpretive Accountability | 7, 8, 9 | Groundlessness, Dogmatism |

---

## Part I: The Given
### *"Experience must not be fabricated"*

### Rule 1: Distinction (The Partition Axiom)

**Principle:** Every event is EITHER "given" (raw experience) OR "meant" (interpretation) — never both, never neither.

**Violation Prevented:** Categorical Confusion

**Implementation in noema:**

```javascript
// noema_event_store.js
const EventType = Object.freeze({
  GIVEN: 'given',
  MEANT: 'meant'
});
```

Every event in the system must declare its type. The `EOEventStore.validate()` method enforces this exhaustively:

```javascript
// Validation rejects events without proper classification
if (!event.type || !Object.values(EventType).includes(event.type)) {
  errors.push('RULE_1: Event must have type "given" or "meant"');
}
```

**How noema Aligns:**
- ✅ All events carry an explicit `type` field
- ✅ Event types are frozen enums — no runtime modification
- ✅ Validation rejects any event without proper classification
- ✅ UI distinguishes Given events (raw data imports) from Meant events (views, configurations)

---

### Rule 2: Impenetrability (Anti-Confabulation)

**Principle:** Given events may only derive from other Given events or external sources. Interpretations cannot fabricate experiences.

**Violation Prevented:** Confabulation (making up experiences)

**Implementation in noema:**

```javascript
// noema_event_store.js - Parent chain validation
if (event.type === EventType.GIVEN && event.parents) {
  for (const parentId of event.parents) {
    const parent = this._index.get(parentId);
    if (parent && parent.type === EventType.MEANT) {
      errors.push('RULE_2: Given event cannot derive from Meant event (confabulation)');
    }
  }
}
```

Given events have a `mode` field indicating their source:

```javascript
const GivenMode = Object.freeze({
  PERCEIVED: 'perceived',   // Sensory input
  REPORTED: 'reported',     // External report
  MEASURED: 'measured',     // Instrument reading
  RECEIVED: 'received'      // Message/data received
});
```

**How noema Aligns:**
- ✅ Given events trace only to external sources or other Given events
- ✅ The compliance checker validates derivation chains
- ✅ Import operations produce Given events with `mode: RECEIVED`
- ✅ User data entry produces Given events with `mode: PERCEIVED`
- ✅ Meant events cannot be ancestors of Given events

---

### Rule 3: Ineliminability (Anti-Gaslighting)

**Principle:** Given events can never be deleted, modified, or overwritten. The past is immutable.

**Violation Prevented:** Gaslighting (erasing or altering history)

**Implementation in noema:**

```javascript
// noema_event_store.js - Append-only enforcement
append(event) {
  // Events are frozen to prevent mutation
  Object.freeze(finalEvent);
  if (finalEvent.context) Object.freeze(finalEvent.context);
  if (finalEvent.payload) Object.freeze(finalEvent.payload);
  if (finalEvent.frame) Object.freeze(finalEvent.frame);

  // Only operation: append to log
  this._log.push(finalEvent);
  this._index.set(finalEvent.id, finalEvent);
}
```

Instead of deletion, the system uses **tombstones**:

```javascript
// Tombstones mark events as "deleted" without erasure
createTombstone(targetId, actor, reason, context) {
  const tombstone = {
    type: EventType.GIVEN,  // Tombstone is itself a Given event
    payload: {
      action: 'tombstone',
      targetId,
      reason,
      originalType: target.type
    }
  };
  return this.append(tombstone);  // Target remains in log
}
```

**How noema Aligns:**
- ✅ No `delete()` or `update()` methods exist on the event store
- ✅ All events are `Object.freeze()`-ed on append
- ✅ "Deletion" creates tombstone events, preserving the original
- ✅ Logical clock enforces temporal ordering
- ✅ Compliance checker verifies no modification markers exist
- ✅ Full history is always available for audit

---

## Part II: The Horizon
### *"There is no view from nowhere"*

### Rule 4: Perspectivality (Anti-Omniscience)

**Principle:** All data access is mediated by a "horizon" (context). There is no universal view.

**Violation Prevented:** Context Collapse (treating partial views as complete)

**Implementation in noema:**

```javascript
// noema_horizon.js - HorizonGate mediates ALL access
class HorizonGate {
  constructor(horizon, eventStore) {
    this.horizon = horizon;
    this.eventStore = eventStore;
  }

  // Nothing is retrieved except through the gate
  isAvailable(event) {
    // Check workspace, actor, frame, time range, tags...
  }

  getAvailable() {
    return this.eventStore.getAll().filter(e => this.isAvailable(e));
  }
}
```

Horizons define bounded access:

```javascript
class Horizon {
  constructor(params) {
    this.workspaces = params.workspaces || [];  // Which workspaces visible
    this.actors = params.actors || [];          // Which actors visible
    this.frames = params.frames || [];          // Which purposes visible
    this.timeRange = params.timeRange || null;  // Time window
    this.tags = params.tags || [];              // Required tags
  }
}
```

**How noema Aligns:**
- ✅ All data retrieval goes through `HorizonGate`
- ✅ Different users/contexts see different data
- ✅ No global "see everything" endpoint (except auditing)
- ✅ Workspaces provide natural horizon boundaries
- ✅ The View Hierarchy (Workspaces → Sets → Lenses → Focuses) is perspectival
- ✅ Transparency panel shows which horizon is active

---

### Rule 5: Restrictivity (Foreclosure)

**Principle:** Narrowing the horizon can only restrict visibility, never expand it. Focus forecloses; narrowing cannot conjure new access.

**Violation Prevented:** Foreclosure Violation (gaining access by narrowing scope)

**Implementation in noema:**

```javascript
// noema_horizon.js - Refinement only restricts
refine(refinements) {
  return new Horizon({
    // Workspaces: intersection only
    workspaces: refinements.workspaces
      ? this.workspaces.filter(w => refinements.workspaces.includes(w))
      : [...this.workspaces],

    // Actors: intersection only
    actors: refinements.actors
      ? this.actors.filter(a => refinements.actors.includes(a))
      : [...this.actors],

    // Time: intersection only (narrower window)
    timeRange: this._narrowTimeRange(refinements.timeRange),

    // Tags: union (more specific)
    tags: [...new Set([...this.tags, ...(refinements.tags || [])])]
  });
}
```

Verification is built in:

```javascript
// noema_horizon.js - Verify restrictivity
verifyRestrictivity(parentId, childId, eventStore) {
  const parentAvailable = parentGate.getAvailable();
  const childAvailable = childGate.getAvailable();

  // All child-available events must be parent-available
  for (const event of childAvailable) {
    if (!parentAvailable.has(event.id)) {
      return { valid: false, error: `Rule 5 violation` };
    }
  }
  return { valid: true };
}
```

**How noema Aligns:**
- ✅ `Horizon.refine()` mathematically enforces intersection
- ✅ Focuses can only filter, never expand parent Lens
- ✅ Compliance checker runs `verifyRestrictivity()` on all horizon pairs
- ✅ View hierarchy levels only narrow: Workspace → Set → Lens → Focus
- ✅ Cannot add workspaces/actors when refining down

---

### Rule 6: Coherence (Locality)

**Principle:** Valid interpretations at broad horizons remain valid when the horizon is narrowed.

**Violation Prevented:** Coherence Failure (contradicting yourself at different scopes)

**Implementation in noema:**

```javascript
// noema_compliance.js - Coherence checking
checkRule6_Coherence() {
  for (const meant of meantEvents) {
    for (const broad of validHorizons) {
      for (const narrow of validHorizons) {
        if (this.horizonLattice.isBroaderOrEqual(broad.id, narrow.id)) {
          // Check provenance coherence
          if (narrowGate.isAvailable(meant)) {
            for (const provId of meant.provenance) {
              if (broadGate.get(provId) && !narrowGate.get(provId)) {
                violations.push({
                  error: 'Provenance available at broad but not at refinement'
                });
              }
            }
          }
        }
      }
    }
  }
}
```

**How noema Aligns:**
- ✅ Derivation validity is checked at all horizon levels
- ✅ Interpretations with provenance available broadly remain valid narrowly
- ✅ The horizon lattice forms a proper meet-semilattice
- ✅ State derivation respects horizon constraints
- ✅ Views inherit coherence from parent views

---

## Part III: The Meant
### *"Meaning must earn its keep"*

### Rule 7: Groundedness (Anti-Delusion)

**Principle:** All interpretations must have provenance — they must trace back to raw Given events.

**Violation Prevented:** Groundlessness (free-floating interpretations)

**Implementation in noema:**

```javascript
// noema_event_store.js - Meant events require provenance
if (event.type === EventType.MEANT) {
  if (!event.provenance || event.provenance.length === 0) {
    errors.push('RULE_7: Meant event must have non-empty provenance');
  }
}

// Transitive grounding verification
verifyGrounding(event, visited = new Set()) {
  if (event.type === EventType.GIVEN) {
    return { grounded: true };
  }

  for (const provId of event.provenance) {
    const provEvent = this._index.get(provId);
    const result = this.verifyGrounding(provEvent, visited);
    if (!result.grounded) return result;
  }

  return { grounded: true };
}
```

**How noema Aligns:**
- ✅ Every Meant event has a non-empty `provenance` array
- ✅ Provenance chains are transitively verified
- ✅ Circular provenance is detected and rejected
- ✅ Views reference the Given events they interpret
- ✅ View configurations store their derivation history
- ✅ Compliance reports show average provenance chain length

---

### Rule 8: Determinacy (Meaning-as-Use)

**Principle:** Meaning crystallizes at minimal, specific horizons — not at some universal, abstract level.

**Violation Prevented:** Premature Determinacy (claiming universal meaning)

**Implementation in noema:**

```javascript
// noema_event_store.js - Meant events require frames
if (!event.frame) {
  errors.push('RULE_8: Meant event must have frame');
} else if (!event.frame.purpose) {
  errors.push('RULE_8: Frame must have purpose');
}

// noema_compliance.js - Check for universalization
if (meant.frame?.universal === true) {
  violations.push({
    error: 'Frame claims universal validity (Platonic error)'
  });
}
```

Epistemic status tracks certainty level:

```javascript
const EpistemicStatus = Object.freeze({
  PRELIMINARY: 'preliminary',  // Initial interpretation
  REVIEWED: 'reviewed',        // Validated
  CONTESTED: 'contested'       // Under dispute
});
```

**How noema Aligns:**
- ✅ Every Meant event has a `frame` with explicit `purpose`
- ✅ Interpretations are contextualized, not universal
- ✅ Views specify their purpose (workflow, analytics, etc.)
- ✅ No interpretation claims to be "the truth"
- ✅ Multiple Lenses can coexist for same data
- ✅ Epistemic status tracks confidence level

---

### Rule 9: Defeasibility (Anti-Dogma)

**Principle:** Interpretations can be superseded. Later readings may overturn earlier ones. Nothing claims infallibility.

**Violation Prevented:** Dogmatism (immutable, unchallengeable claims)

**Implementation in noema:**

```javascript
// noema_event_store.js - Supersession, not deletion
createSupersession(targetId, newInterpretation, actor, frame, provenance, context, supersessionType = 'refinement') {
  const supersession = {
    type: EventType.MEANT,
    supersedes: targetId,
    supersessionType,  // 'correction' | 'refinement' | 'retraction'
    payload: newInterpretation
  };
  return this.append(supersession);
}
```

```javascript
// noema_compliance.js - Check for dogmatic markers
if (meant.immutable === true || meant.final === true) {
  violations.push({ error: 'Meant event claims immutability (dogmatism)' });
}

if (meant.epistemicStatus === 'infallible') {
  violations.push({ error: 'Meant event claims infallibility (dogmatism)' });
}

// Supersession must be frame-local, not global
if (meant.supersessionScope === 'global') {
  violations.push({ error: 'Supersession claims global scope' });
}
```

**How noema Aligns:**
- ✅ `supersedes` field chains interpretations
- ✅ Old views marked superseded, not deleted
- ✅ No `immutable` or `final` flags allowed on Meant events
- ✅ `epistemicStatus` never claims "infallible" or "certain"
- ✅ Active interpretations computed per-frame
- ✅ Full supersession history available
- ✅ Snapshots are crystallized but still supersedable

---

## Architectural Alignment Summary

### Core Modules and Their Rule Implementations

| Module | Primary Rules | Purpose |
|--------|--------------|---------|
| `noema_event_store.js` | 1, 2, 3, 7, 8, 9 | Append-only log, event validation |
| `noema_horizon.js` | 4, 5, 6 | Perspectival access control |
| `noema_compliance.js` | All | Continuous validation & auditing |
| `noema_view_hierarchy.js` | 4, 5, 7, 8, 9 | Views as Meant events |
| `noema_state_derivation.js` | 4, 6, 7 | Derive state respecting horizons |
| `noema_principles_transparency.js` | All | Real-time principle visibility |

### The View Hierarchy as Rule Implementation

```
HORIZON GATE (Rule 4: perspectival access)
        ↓
WORKSPACES (Rule 4: contextual boundaries)
        ↓
SETS (Rule 7: schema as interpretation)
        ↓
LENSES (Rule 8, 9: perspectives, not truth)
        ↓
FOCUSES (Rule 5: only restrict, never expand)
        ↓
SNAPSHOTS (Rule 9: crystallized but supersedable)
```

---

## Compliance Auditing

noema includes built-in compliance auditing that checks all Nine Rules:

```javascript
// Run a full compliance audit
const checker = getComplianceChecker(eventStore, horizonLattice);
const audit = checker.runAudit();

// Get conformance level
audit.conformanceLevel;
// Returns: 'FULL_CONFORMANCE' | 'HORIZON_CONFORMANT' | 'GIVEN_CONFORMANT' | 'NON_CONFORMANT'
```

### Conformance Levels

| Level | Rules Passed | Meaning |
|-------|--------------|---------|
| **FULL_CONFORMANCE** | 1-9 | Complete alignment |
| **HORIZON_CONFORMANT** | 1-6 | Experiential + Perspectival integrity |
| **GIVEN_CONFORMANT** | 1-3 | Experiential integrity only |
| **NON_CONFORMANT** | < 3 | Fundamental violations |

---

## Real-World Impact

By implementing all Nine Rules, noema prevents:

| What's Prevented | How | Rules |
|------------------|-----|-------|
| **Data Fabrication** | Given events only from external sources | 2 |
| **Data Erasure** | Append-only log, tombstones | 3 |
| **Context Collapse** | Horizon-gated access | 4 |
| **Scope Creep** | Restrictive refinement | 5 |
| **Circular Reasoning** | Provenance chains verified | 7 |
| **Premature Claims** | Frame-based determinacy | 8 |
| **Dogmatism** | Defeasible interpretations | 9 |

---

## Conclusion

noema is not just a data workbench — it's a philosophical statement implemented in code. Every event, every view, every access check enforces the Nine Rules. The result is a system where:

- **You cannot lie about the past** (Rules 1-3)
- **You cannot claim to see everything** (Rules 4-6)
- **You cannot claim your interpretation is final** (Rules 7-9)

This creates a foundation for trustworthy, auditable, and transparent data management.

---

*"A view is not the data — it is one way of seeing the data."*

---

## Further Reading

- `VIEW_HIERARCHY_DESIGN.md` — Detailed view system architecture
- `IMPORT_SYSTEM_DESIGN.md` — CSV/JSON import with rule compliance
- `noema_compliance.js` — Source code for compliance checking
- `noema_principles_transparency.js` — Real-time transparency panel
