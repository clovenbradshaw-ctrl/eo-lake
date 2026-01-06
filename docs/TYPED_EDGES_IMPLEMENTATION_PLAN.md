# Typed Edges Implementation Plan

## Overview

This document outlines the implementation strategy for adding **typed edges** and **EO operators** to Noema.

### The Core Principle

> **Edges express relationships. Entity types determine the rules of interpretation. EO operators determine the consequences.**

Same edge + different entity pair = different consequences.
Same edge + different EO role = different system reaction.

### On EO Roles

> **EO roles may be stored as conditional assertions of intent, but never as intrinsic properties; the system continuously evaluates whether observed behavior supports those assertions.**

EO roles (holon/protogon/emanon) don't CAUSE different effects — they SENSITIZE entities differently to the same edges. Think of edges as force vectors and EO roles as susceptibility profiles.

### Architecture Benefits

This separation keeps the system:
- Intelligible (edges are declarative, operators are procedural)
- Evolvable (add new operators without changing edge schema)
- Explainable (trace any outcome back through operators to edges)
- Adaptive (EO roles can shift as edge patterns change)

---

## Phase 1: Edge Registry & Type System

### 1.1 New File: `eo_edge_registry.js`

The edge registry defines:
- All valid edge types
- Allowed source/target node type pairs
- Required and optional properties per edge type
- Risk semantics
- Rollup semantics
- UI affordances

```javascript
// Edge Categories
SEMANTIC_EDGES      // Meaning lineage
DEPENDENCY_EDGES    // Usage/impact
AUTHORITY_EDGES     // Epistemic
TEMPORAL_EDGES      // Change

// Core Edge Types
EdgeType = {
  // Semantic edges (meaning lineage)
  DEFINES_MEANING_OF:    { from: ['Definition'], to: ['Field'] },
  INHERITS_MEANING_FROM: { from: ['Definition'], to: ['Definition'] },
  REFINES_MEANING_OF:    { from: ['Definition'], to: ['ExternalStandard'] },
  EQUIVALENT_TO:         { from: ['Definition'], to: ['Definition', 'ExternalStandard'], bidirectional: true },
  CONFLICTS_WITH:        { from: ['Definition'], to: ['Definition', 'ExternalStandard'], bidirectional: true },

  // Dependency edges (usage/impact)
  DEPENDS_ON:            { from: ['Rule', 'Report', 'API', 'Lens'], to: ['Definition'] },
  DERIVES_FROM:          { from: ['Definition'], to: ['Definition'] },
  VALIDATES_AGAINST:     { from: ['Rule'], to: ['Definition'] },
  USES_FIELD:            { from: ['Lens', 'Rule'], to: ['Field'] },

  // Authority edges (epistemic)
  GOVERNED_BY:           { from: ['Definition'], to: ['Process'] },
  ASSERTED_BY:           { from: ['Definition'], to: ['Actor', 'System'] },
  IMPOSED_BY:            { from: ['Definition'], to: ['ExternalStandard'] },

  // Temporal edges (change)
  SUPERSEDES:            { from: ['Definition'], to: ['Definition'] },
  VALID_DURING:          { from: ['Definition'], to: ['TimeRange'] },
  VERSION_OF:            { from: ['Definition'], to: ['Definition'] }
}
```

### 1.2 Edge Constraints & Validation

Each edge type has:
- `allowedPairs`: Valid (fromType, toType) combinations
- `requiredProperties`: Properties that must be present
- `optionalProperties`: Properties that may be present
- `riskSemantics`: How this edge affects risk calculation
- `rollupSemantics`: How this edge contributes to usage counts

### 1.3 Node Type Registry

Minimal canonical node types:
- `Definition` - Meaning commitment
- `Field` - Dataset column/property
- `Dataset` / `Set` - Table/collection
- `Process` - Lifecycle/workflow
- `Rule` - Validation/automation
- `ExternalStandard` - URI vocabulary term
- `Actor` - Person/role/system
- `Lens` - View/transformation
- `TimeRange` - Temporal boundary

---

## Phase 2: EO Operators Layer

### 2.1 New File: `eo_operators.js`

Operators are **pure functions** that:
1. Read edges and node properties from the graph
2. Compute derived values (never mutate)
3. Return explainable results

```javascript
// Operator Categories
PRESSURE_OPERATORS     // Stability, authority, dependency pressure
ROLLUP_OPERATORS       // Usage aggregation
RISK_OPERATORS         // Attention/risk computation
INFERENCE_OPERATORS    // EO role inference
```

### 2.2 Core Operators

#### Stability Pressure Operator
```javascript
stabilityPressureOperator(definition, edges) {
  // Inputs: definition.stability, incoming DEPENDS_ON edges
  // Output: pressure score, explanation
  // Higher pressure = more things depend on interpretive meaning
}
```

#### Authority Pressure Operator
```javascript
authorityPressureOperator(definition, edges) {
  // Inputs: definition.authority, GOVERNED_BY/IMPOSED_BY edges
  // Output: pressure score, explanation
  // Higher pressure = human authority with external governance
}
```

#### Dependency Fanout Operator
```javascript
dependencyFanoutOperator(definition, edges) {
  // Inputs: outgoing DEPENDS_ON, DERIVES_FROM edges
  // Output: fanout score, tier breakdown, explanation
  // Higher fanout = more downstream dependencies
}
```

#### Temporal Flux Operator
```javascript
temporalFluxOperator(definition, edges) {
  // Inputs: definition.time, SUPERSEDES edges, VALID_DURING edges
  // Output: flux score, explanation
  // Higher flux = more version churn or temporal constraints
}
```

### 2.3 Composed Risk Operator

```javascript
riskOperator(definition, edges) {
  const stability = stabilityPressureOperator(definition, edges);
  const authority = authorityPressureOperator(definition, edges);
  const dependency = dependencyFanoutOperator(definition, edges);
  const temporal = temporalFluxOperator(definition, edges);

  return {
    status: computeRiskStatus(stability, authority, dependency, temporal),
    drivers: explainRiskDrivers(...),
    explanation: generateExplanation(...)
  };
}
```

### 2.4 EO Role Inference Operator

```javascript
eoBehaviorProfileOperator(definition, edges) {
  const scores = {
    stabilityPressure: stabilityPressureOperator(...).score,
    authorityPressure: authorityPressureOperator(...).score,
    temporalFlux: temporalFluxOperator(...).score,
    dependencyFanout: dependencyFanoutOperator(...).score
  };

  return {
    actsLike: inferRole(scores), // 'holon' | 'protogon' | 'emanon' | 'mixed'
    scores,
    explanation: explainInference(scores)
  };
}

// Role inference rules (emergent, not stamped):
// holon: high stability, high authority, low temporal flux, high dependency
// protogon: interpretive stability, moderate authority, moderate flux
// emanon: contextual stability, dynamic authority, high flux
```

---

## Phase 3: Event Store Extensions

### 3.1 New Event Types

Add to `eo_event_store.js`:
```javascript
// Edge lifecycle events
BusEventType.EDGE_CREATED
BusEventType.EDGE_UPDATED
BusEventType.EDGE_DELETED

// Derived computation events
BusEventType.RISK_COMPUTED
BusEventType.USAGE_COMPUTED
BusEventType.EO_PROFILE_COMPUTED
```

### 3.2 Edge Event Schema

```javascript
{
  id: "evt_edge_...",
  epistemicType: "given", // Edges are facts
  category: "edge",
  timestamp: ISO8601,
  actor: "user:..." or "system:...",
  payload: {
    edgeType: "DEFINES_MEANING_OF",
    sourceId: "def_...",
    sourceType: "Definition",
    targetId: "fld_...",
    targetType: "Field",
    properties: {
      confidence: 0.95,
      effectiveDate: "2026-01-06"
    }
  }
}
```

---

## Phase 4: Graph System Updates

### 4.1 Updates to `eo_graph.js`

- Import edge registry
- Validate edges against registry on creation
- Support edge type filtering in visualization
- Add edge property display

### 4.2 Updates to `eo_graph_cytoscape.js`

- Edge styling by type category:
  - Semantic edges: Purple (#7856ff)
  - Dependency edges: Blue (#1d9bf0)
  - Authority edges: Orange (#ffad1f)
  - Temporal edges: Green (#00ba7c)
- Edge labels showing type
- Edge property tooltips

---

## Phase 5: Inference Engine Integration

### 5.1 New File: `eo_inference_engine.js`

Orchestrates operator execution:
```javascript
class EOInferenceEngine {
  constructor(eventStore, edgeRegistry, operators) { }

  // Compute all derived values for a definition
  computeProfile(definitionId) {
    const edges = this.getEdgesFor(definitionId);
    const definition = this.getDefinition(definitionId);

    return {
      usage: this.operators.usageRollup(definition, edges),
      risk: this.operators.risk(definition, edges),
      eoBehavior: this.operators.eoBehaviorProfile(definition, edges)
    };
  }

  // Simulate impact of a change
  simulateChange(definitionId, proposedChange) {
    // Compute before/after profiles
    // Return diff with explanations
  }

  // Subscribe to edge events and recompute
  onEdgeChanged(edgeEvent) {
    const affected = this.getAffectedDefinitions(edgeEvent);
    for (const defId of affected) {
      const profile = this.computeProfile(defId);
      this.eventBus.emit(BusEventType.PROFILE_UPDATED, { defId, profile });
    }
  }
}
```

---

## Phase 6: Definition Updates

### 6.1 Updates to `common_definitions.json`

Add edge type definitions:
```json
{
  "edgeTypes": [
    {
      "id": "edge.defines_meaning_of",
      "meaning": "Defines Meaning Of",
      "plainLanguage": "This definition provides the semantic meaning for a field",
      "category": "semantic",
      "allowedPairs": [
        { "from": "Definition", "to": "Field" }
      ],
      "requiredProperties": [],
      "optionalProperties": ["confidence", "effectiveDate"],
      "riskSemantics": {
        "contributesTo": "dependencyFanout",
        "weight": 1.0
      }
    }
    // ... more edge types
  ]
}
```

### 6.2 Updates to `eo_definitions_set.js`

- Add edge type registry loading
- Add edge creation/validation methods
- Update linked fields to use proper edge events

---

## Implementation Order

1. **eo_edge_registry.js** - Core edge type definitions
2. **eo_operators.js** - Pure operator functions
3. **eo_event_store.js updates** - Edge event types
4. **eo_inference_engine.js** - Operator orchestration
5. **eo_graph.js updates** - Graph visualization
6. **common_definitions.json updates** - Edge type definitions
7. **eo_definitions_set.js updates** - Integration

---

## Success Criteria

- [ ] All edge types have explicit constraints
- [ ] Operators are pure functions with no side effects
- [ ] Every derived value has an explanation trace
- [ ] EO roles are computed, never stored
- [ ] Risk status is explainable ("because of these edges...")
- [ ] Simulation works ("what breaks if I change X?")

---

## Appendix: Architectural Principles

### Edges vs Operators (The Core Distinction)

| Aspect | Edges | Operators |
|--------|-------|-----------|
| Nature | Structural facts | Transformations |
| Persistence | Stored | Computed |
| Mutability | Append-only (events) | Stateless |
| Purpose | "What relates" | "What that means now" |
| Philosophy | Vyavahārika (operational reality) | Cognition under conditions |

### EO Role Inference (Emergent, Not Stamped)

Nodes are NOT labeled "holon/protogon/emanon". Instead:
- Store node properties (stability, authority, time)
- Store edge patterns
- Operators infer role as a computed view

This keeps EO:
- Flexible (roles can shift as edges change)
- Explainable (role is derived from concrete facts)
- Philosophically coherent (roles are lakṣaṇa, not labels)
