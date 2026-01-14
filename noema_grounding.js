/**
 * EO Grounding - Typed Grounding System
 *
 * EO AXIOM (ENFORCED):
 * Nothing Meant may exist, persist, or be queried without an explicit,
 * typed grounding chain terminating in Given reality.
 *
 * This module provides:
 * - Grounding chain construction and validation
 * - Grounding graph traversal
 * - Grounding queries by type
 * - Grounding visualization
 *
 * Key concepts:
 * - Every grounding reference has a TYPE (external, structural, semantic, computational, epistemic)
 * - Grounding chains must terminate in Given events
 * - The grounding graph is queryable by type
 */

// ============================================================================
// Import types (for reference, these are defined in eo_types.js)
// ============================================================================

// GroundingKind: external, structural, semantic, computational, epistemic
// EpistemicType: given, meant, derived_value

// ============================================================================
// Grounding Chain Builder
// ============================================================================

/**
 * GroundingChainBuilder - Fluent API for building grounding chains
 */
class GroundingChainBuilder {
  constructor() {
    this._references = [];
    this._derivation = null;
  }

  /**
   * Add external grounding (only valid for Given events)
   */
  external(eventId) {
    this._references.push({
      eventId,
      kind: 'external'
    });
    return this;
  }

  /**
   * Add structural grounding (forced by data shape)
   */
  structural(eventId) {
    this._references.push({
      eventId,
      kind: 'structural'
    });
    return this;
  }

  /**
   * Add semantic grounding (interpretive meaning)
   */
  semantic(eventId) {
    this._references.push({
      eventId,
      kind: 'semantic'
    });
    return this;
  }

  /**
   * Add computational grounding (operator execution result)
   */
  computational(eventId) {
    this._references.push({
      eventId,
      kind: 'computational'
    });
    return this;
  }

  /**
   * Add epistemic grounding (confidence, status, claims)
   */
  epistemic(eventId) {
    this._references.push({
      eventId,
      kind: 'epistemic'
    });
    return this;
  }

  /**
   * Set derivation (operator chain that produced this)
   */
  withDerivation(operators, inputs = {}, frozenParams = {}) {
    this._derivation = {
      operators,
      inputs,
      frozenParams
    };
    return this;
  }

  /**
   * Build the grounding object
   */
  build() {
    return {
      references: [...this._references],
      derivation: this._derivation
    };
  }
}

/**
 * Create a new grounding chain builder
 */
function grounding() {
  return new GroundingChainBuilder();
}

// ============================================================================
// Grounding Graph
// ============================================================================

/**
 * GroundingGraph - Manages and queries the grounding relationships
 */
class GroundingGraph {
  constructor(eventStore) {
    this._eventStore = eventStore;

    // Indexes for efficient queries
    this._groundsIndex = new Map();    // eventId -> [events it grounds]
    this._groundedByIndex = new Map(); // eventId -> [events that ground it]
    this._byKindIndex = new Map();     // kind -> Set of (from, to) pairs

    // Initialize kind indexes
    for (const kind of ['external', 'structural', 'semantic', 'computational', 'epistemic']) {
      this._byKindIndex.set(kind, new Set());
    }
  }

  /**
   * Index a grounding relationship
   */
  indexGrounding(fromEventId, toEventId, kind) {
    // Forward index: what does this event ground?
    if (!this._groundsIndex.has(toEventId)) {
      this._groundsIndex.set(toEventId, []);
    }
    this._groundsIndex.get(toEventId).push({ eventId: fromEventId, kind });

    // Reverse index: what grounds this event?
    if (!this._groundedByIndex.has(fromEventId)) {
      this._groundedByIndex.set(fromEventId, []);
    }
    this._groundedByIndex.get(fromEventId).push({ eventId: toEventId, kind });

    // Kind index
    const kindSet = this._byKindIndex.get(kind);
    if (kindSet) {
      kindSet.add(`${fromEventId}:${toEventId}`);
    }
  }

  /**
   * Index all groundings from an event
   */
  indexEvent(event) {
    if (!event.grounding?.references) return;

    for (const ref of event.grounding.references) {
      this.indexGrounding(event.id, ref.eventId, ref.kind);
    }
  }

  /**
   * Get all events that ground a specific event
   */
  getGrounds(eventId) {
    return this._groundsIndex.get(eventId) || [];
  }

  /**
   * Get all events grounded by a specific event
   */
  getGroundedBy(eventId) {
    return this._groundedByIndex.get(eventId) || [];
  }

  /**
   * Get grounding by kind
   */
  getByKind(kind) {
    const pairs = this._byKindIndex.get(kind);
    if (!pairs) return [];

    return Array.from(pairs).map(pair => {
      const [from, to] = pair.split(':');
      return { from, to, kind };
    });
  }

  /**
   * Trace grounding chain to roots (Given events)
   */
  traceToRoots(eventId, maxDepth = 20) {
    const visited = new Set();
    const roots = [];
    const chain = [];

    const traverse = (id, depth) => {
      if (depth > maxDepth || visited.has(id)) return;
      visited.add(id);

      const event = this._eventStore?.get?.(id);
      if (!event) return;

      chain.push({
        eventId: id,
        epistemicType: event.epistemicType,
        depth
      });

      // Given events are roots
      if (event.epistemicType === 'given') {
        roots.push(id);
        return;
      }

      // Traverse grounds
      const grounds = this.getGrounds(id);
      for (const ground of grounds) {
        traverse(ground.eventId, depth + 1);
      }
    };

    traverse(eventId, 0);

    return {
      eventId,
      roots,
      chain,
      isGrounded: roots.length > 0,
      maxDepthReached: chain.some(c => c.depth >= maxDepth)
    };
  }

  /**
   * Verify grounding chain terminates in Given
   */
  verifyGrounding(eventId) {
    const trace = this.traceToRoots(eventId);

    if (!trace.isGrounded) {
      return {
        valid: false,
        error: 'Grounding chain does not terminate in Given events',
        trace
      };
    }

    if (trace.maxDepthReached) {
      return {
        valid: false,
        error: 'Grounding chain exceeds maximum depth',
        trace
      };
    }

    return {
      valid: true,
      roots: trace.roots,
      trace
    };
  }

  /**
   * Get the typed grounding graph for visualization
   */
  getGraphData() {
    const nodes = [];
    const edges = [];

    // Collect all nodes
    const allEventIds = new Set([
      ...this._groundsIndex.keys(),
      ...this._groundedByIndex.keys()
    ]);

    for (const eventId of allEventIds) {
      const event = this._eventStore?.get?.(eventId);
      if (event) {
        nodes.push({
          id: eventId,
          type: event.epistemicType,
          category: event.category,
          label: event.id.substring(0, 12)
        });
      }
    }

    // Collect all edges
    for (const [eventId, grounds] of this._groundsIndex) {
      for (const ground of grounds) {
        edges.push({
          from: eventId,
          to: ground.eventId,
          kind: ground.kind
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * Query: What grounds this insight?
   */
  whatGrounds(eventId) {
    const grounds = this.getGrounds(eventId);
    const result = {
      structural: [],
      semantic: [],
      computational: [],
      epistemic: [],
      external: []
    };

    for (const g of grounds) {
      if (result[g.kind]) {
        const event = this._eventStore?.get?.(g.eventId);
        result[g.kind].push({
          eventId: g.eventId,
          epistemicType: event?.epistemicType,
          category: event?.category
        });
      }
    }

    return result;
  }

  /**
   * Query: What was forced by reality? (structural grounds only)
   */
  whatWasForcedByReality(eventId) {
    const trace = this.traceToRoots(eventId);
    const structuralGrounds = [];

    for (const item of trace.chain) {
      const grounds = this.getGrounds(item.eventId);
      for (const g of grounds) {
        if (g.kind === 'structural') {
          const event = this._eventStore?.get?.(g.eventId);
          structuralGrounds.push({
            eventId: g.eventId,
            epistemicType: event?.epistemicType
          });
        }
      }
    }

    return structuralGrounds;
  }

  /**
   * Query: What was interpretive? (semantic grounds only)
   */
  whatWasInterpretive(eventId) {
    const trace = this.traceToRoots(eventId);
    const semanticGrounds = [];

    for (const item of trace.chain) {
      const grounds = this.getGrounds(item.eventId);
      for (const g of grounds) {
        if (g.kind === 'semantic') {
          const event = this._eventStore?.get?.(g.eventId);
          semanticGrounds.push({
            eventId: g.eventId,
            epistemicType: event?.epistemicType
          });
        }
      }
    }

    return semanticGrounds;
  }

  /**
   * Clear all indexes
   */
  clear() {
    this._groundsIndex.clear();
    this._groundedByIndex.clear();
    for (const [, set] of this._byKindIndex) {
      set.clear();
    }
  }
}

// ============================================================================
// Grounding Validators
// ============================================================================

/**
 * Validate grounding for a Given event
 */
function validateGivenGrounding(event) {
  const errors = [];

  // Given events CAN have external grounding
  // Given events SHOULD NOT have semantic grounding (they ARE reality)
  if (event.grounding?.references) {
    for (const ref of event.grounding.references) {
      if (ref.kind === 'semantic') {
        errors.push({
          code: 'GIVEN_SEMANTIC_GROUNDING',
          message: 'Given events should not have semantic grounding - they ARE reality'
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate grounding for a Meant event
 */
function validateMeantGrounding(event) {
  const errors = [];

  // Meant events MUST have grounding
  if (!event.grounding || !event.grounding.references || event.grounding.references.length === 0) {
    errors.push({
      code: 'MEANT_NO_GROUNDING',
      message: 'Meant events must have typed grounds'
    });
    return { valid: false, errors };
  }

  // Meant events CANNOT have external grounding
  for (const ref of event.grounding.references) {
    if (ref.kind === 'external') {
      errors.push({
        code: 'MEANT_EXTERNAL_GROUNDING',
        message: 'Only Given events may have external grounding'
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate grounding for a Derived Value event
 */
function validateDerivedValueGrounding(event) {
  const errors = [];

  // Derived values MUST have computational grounding
  if (!event.grounding || !event.grounding.references) {
    errors.push({
      code: 'DERIVED_NO_GROUNDING',
      message: 'Derived values must have grounding'
    });
    return { valid: false, errors };
  }

  const hasComputational = event.grounding.references.some(
    ref => ref.kind === 'computational'
  );

  if (!hasComputational) {
    errors.push({
      code: 'DERIVED_NO_COMPUTATIONAL',
      message: 'Derived values must have computational grounding'
    });
  }

  // Derived values MUST have derivation
  if (!event.grounding.derivation) {
    errors.push({
      code: 'DERIVED_NO_DERIVATION',
      message: 'Derived values must have derivation chain'
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate grounding based on epistemic type
 */
function validateGrounding(event) {
  switch (event.epistemicType) {
    case 'given':
      return validateGivenGrounding(event);
    case 'meant':
      return validateMeantGrounding(event);
    case 'derived_value':
      return validateDerivedValueGrounding(event);
    default:
      return {
        valid: false,
        errors: [{ code: 'UNKNOWN_TYPE', message: `Unknown epistemic type: ${event.epistemicType}` }]
      };
  }
}

// ============================================================================
// Grounding Factory Functions
// ============================================================================

/**
 * Create grounding for a Given event (import from external)
 */
function createGivenGrounding(externalSource) {
  return grounding()
    .external(externalSource)
    .build();
}

/**
 * Create grounding for a structural schema event
 */
function createStructuralSchemaGrounding(sourceEventId) {
  return grounding()
    .structural(sourceEventId)
    .build();
}

/**
 * Create grounding for a semantic schema event
 */
function createSemanticSchemaGrounding(structuralSchemaEventId) {
  return grounding()
    .structural(structuralSchemaEventId)
    .semantic(structuralSchemaEventId)
    .build();
}

/**
 * Create grounding for an aggregation execution
 */
function createAggregationGrounding(setEventId, operators) {
  return grounding()
    .computational(setEventId)
    .withDerivation(operators, { setId: setEventId })
    .build();
}

/**
 * Create grounding for an aggregation result (derived value)
 */
function createAggregationResultGrounding(executionEventId) {
  return grounding()
    .computational(executionEventId)
    .build();
}

/**
 * Create grounding for an insight
 */
function createInsightGrounding(valueEventIds, schemaEventId = null) {
  const builder = grounding();

  for (const valueId of valueEventIds) {
    builder.computational(valueId);
  }

  if (schemaEventId) {
    builder.semantic(schemaEventId);
  }

  return builder.build();
}

/**
 * Create grounding for a confidence assessment
 */
function createConfidenceGrounding(assessedEventId, sourceEventId, derivationOperators) {
  return grounding()
    .computational(assessedEventId)
    .external(sourceEventId)
    .withDerivation(derivationOperators, {
      assessedEventId,
      sourceEventId
    })
    .build();
}

// ============================================================================
// Grounding Display
// ============================================================================

/**
 * Format grounding kind for display
 */
function formatGroundingKind(kind) {
  const labels = {
    external: 'External Reality',
    structural: 'Data Structure',
    semantic: 'Interpretation',
    computational: 'Computation',
    epistemic: 'Epistemic Claim'
  };
  return labels[kind] || kind;
}

/**
 * Get icon for grounding kind
 */
function getGroundingKindIcon(kind) {
  const icons = {
    external: 'ph-globe',
    structural: 'ph-tree-structure',
    semantic: 'ph-lightbulb',
    computational: 'ph-function',
    epistemic: 'ph-brain'
  };
  return icons[kind] || 'ph-question';
}

/**
 * Get CSS class for grounding kind
 */
function getGroundingKindCSS(kind) {
  return `grounding-${kind}`;
}

/**
 * Render grounding badge
 */
function renderGroundingBadge(kind) {
  const label = formatGroundingKind(kind);
  const icon = getGroundingKindIcon(kind);
  return `<span class="grounding-badge ${getGroundingKindCSS(kind)}" title="${label}"><i class="${icon}"></i> ${label}</span>`;
}

// ============================================================================
// Grounding Styles
// ============================================================================

const groundingStyles = `
  .grounding-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .grounding-external {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .grounding-structural {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .grounding-semantic {
    background: rgba(168, 85, 247, 0.1);
    color: #7c3aed;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .grounding-computational {
    background: rgba(249, 115, 22, 0.1);
    color: #ea580c;
    border: 1px solid rgba(249, 115, 22, 0.3);
  }

  .grounding-epistemic {
    background: rgba(236, 72, 153, 0.1);
    color: #db2777;
    border: 1px solid rgba(236, 72, 153, 0.3);
  }

  .grounding-chain {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--bg-secondary, #f9fafb);
    border-radius: 8px;
  }

  .grounding-node {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: white;
    border-radius: 4px;
    border: 1px solid var(--border-color, #e5e7eb);
  }

  .grounding-arrow {
    color: var(--text-muted, #9ca3af);
    font-size: 12px;
    margin-left: 20px;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.id = 'eo-grounding-styles';
  styleEl.textContent = groundingStyles;
  if (!document.getElementById('eo-grounding-styles')) {
    document.head.appendChild(styleEl);
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Builder
    GroundingChainBuilder,
    grounding,

    // Graph
    GroundingGraph,

    // Validators
    validateGivenGrounding,
    validateMeantGrounding,
    validateDerivedValueGrounding,
    validateGrounding,

    // Factory functions
    createGivenGrounding,
    createStructuralSchemaGrounding,
    createSemanticSchemaGrounding,
    createAggregationGrounding,
    createAggregationResultGrounding,
    createInsightGrounding,
    createConfidenceGrounding,

    // Display
    formatGroundingKind,
    getGroundingKindIcon,
    getGroundingKindCSS,
    renderGroundingBadge
  };
}

if (typeof window !== 'undefined') {
  window.EOGrounding = {
    // Builder
    GroundingChainBuilder,
    grounding,

    // Graph
    GroundingGraph,

    // Validators
    validateGivenGrounding,
    validateMeantGrounding,
    validateDerivedValueGrounding,
    validate: validateGrounding,

    // Factory functions
    createGivenGrounding,
    createStructuralSchemaGrounding,
    createSemanticSchemaGrounding,
    createAggregationGrounding,
    createAggregationResultGrounding,
    createInsightGrounding,
    createConfidenceGrounding,

    // Display
    formatKind: formatGroundingKind,
    getKindIcon: getGroundingKindIcon,
    getKindCSS: getGroundingKindCSS,
    renderBadge: renderGroundingBadge
  };
}
