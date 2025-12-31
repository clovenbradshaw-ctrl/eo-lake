/**
 * EO Compliance Checker - Validates all 9 Rules of Experience Engines
 *
 * The Nine Rules:
 *
 * Part I: The Given (Experience must not be fabricated)
 *   Rule 1: Distinction - Given ⊕ Meant, exhaustive and exclusive
 *   Rule 2: Impenetrability - Given derives only from Given (anti-confabulation)
 *   Rule 3: Ineliminability - Given cannot be erased (anti-gaslighting)
 *
 * Part II: The Horizon (There is no view from nowhere)
 *   Rule 4: Perspectivality - No universal access; horizon mediates all
 *   Rule 5: Restrictivity - Refinement only restricts availability
 *   Rule 6: Coherence - Valid inference survives refinement
 *
 * Part III: The Meant (Meaning must earn its keep)
 *   Rule 7: Groundedness - All interpretations have provenance in Given
 *   Rule 8: Determinacy - Meaning crystallizes at minimal horizons
 *   Rule 9: Defeasibility - Interpretations supersedable; no global ordering
 *
 * Conformance Levels:
 *   - Given-conformant (Rules 1,2,3): Experiential Integrity
 *   - Horizon-conformant (Rules 4,5,6): Perspectival Coherence
 *   - Meant-conformant (Rules 7,8,9): Interpretive Accountability
 */

/**
 * Rule check result
 */
class RuleCheckResult {
  constructor(ruleNumber, ruleName, passed, details = [], violations = []) {
    this.ruleNumber = ruleNumber;
    this.ruleName = ruleName;
    this.passed = passed;
    this.details = details;
    this.violations = violations;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Compliance audit result
 */
class ComplianceAudit {
  constructor() {
    this.results = [];
    this.startTime = new Date().toISOString();
    this.endTime = null;
  }

  addResult(result) {
    this.results.push(result);
  }

  complete() {
    this.endTime = new Date().toISOString();
  }

  get passed() {
    return this.results.every(r => r.passed);
  }

  get passedCount() {
    return this.results.filter(r => r.passed).length;
  }

  get failedCount() {
    return this.results.filter(r => !r.passed).length;
  }

  get conformanceLevel() {
    const givenRules = [1, 2, 3];
    const horizonRules = [4, 5, 6];
    const meantRules = [7, 8, 9];

    const givenPassed = givenRules.every(n =>
      this.results.find(r => r.ruleNumber === n)?.passed
    );
    const horizonPassed = horizonRules.every(n =>
      this.results.find(r => r.ruleNumber === n)?.passed
    );
    const meantPassed = meantRules.every(n =>
      this.results.find(r => r.ruleNumber === n)?.passed
    );

    if (givenPassed && horizonPassed && meantPassed) {
      return 'FULL_CONFORMANCE';
    } else if (givenPassed && horizonPassed) {
      return 'HORIZON_CONFORMANT';
    } else if (givenPassed) {
      return 'GIVEN_CONFORMANT';
    }
    return 'NON_CONFORMANT';
  }

  toReport() {
    return {
      audit: {
        startTime: this.startTime,
        endTime: this.endTime,
        conformanceLevel: this.conformanceLevel,
        summary: {
          total: this.results.length,
          passed: this.passedCount,
          failed: this.failedCount
        }
      },
      rules: this.results.map(r => ({
        rule: r.ruleNumber,
        name: r.ruleName,
        passed: r.passed,
        details: r.details,
        violations: r.violations
      }))
    };
  }
}

/**
 * The Compliance Checker
 */
class EOComplianceChecker {
  /**
   * @param {EOEventStore} eventStore
   * @param {HorizonLattice} horizonLattice
   */
  constructor(eventStore, horizonLattice) {
    this.eventStore = eventStore;
    this.horizonLattice = horizonLattice;
  }

  /**
   * Run a full compliance audit
   */
  runAudit() {
    const audit = new ComplianceAudit();

    // Part I: The Given
    audit.addResult(this.checkRule1_Distinction());
    audit.addResult(this.checkRule2_Impenetrability());
    audit.addResult(this.checkRule3_Ineliminability());

    // Part II: The Horizon
    audit.addResult(this.checkRule4_Perspectivality());
    audit.addResult(this.checkRule5_Restrictivity());
    audit.addResult(this.checkRule6_Coherence());

    // Part III: The Meant
    audit.addResult(this.checkRule7_Groundedness());
    audit.addResult(this.checkRule8_Determinacy());
    audit.addResult(this.checkRule9_Defeasibility());

    audit.complete();
    return audit;
  }

  /**
   * Rule 1: Distinction (The Partition Axiom) - STRICT EO
   *
   * Events must have one of three exhaustive, mutually exclusive epistemic types:
   * - given: External reality (immutable, append-only)
   * - meant: Interpretation (requires grounding)
   * - derived_value: Computed value (requires computational grounding)
   */
  checkRule1_Distinction() {
    const violations = [];
    const details = [];
    const events = this.eventStore.getAll();

    const validTypes = ['given', 'meant', 'derived_value'];

    details.push(`Checking ${events.length} events for epistemic type classification`);

    for (const event of events) {
      // Use standardized epistemicType field
      const epistemicType = event.epistemicType;

      // Check that epistemic type exists and is valid
      if (!epistemicType) {
        violations.push({
          eventId: event.id,
          error: 'Event has no epistemic type classification'
        });
      } else if (!validTypes.includes(epistemicType)) {
        violations.push({
          eventId: event.id,
          error: `Invalid epistemic type "${epistemicType}" - must be one of: ${validTypes.join(', ')}`
        });
      }

      // Check for hybrid indicators (warning)
      if (epistemicType === 'given' && event.frame) {
        details.push(`Warning: Given event ${event.id} has frame (unusual but allowed)`);
      }

      if (epistemicType === 'meant' && event.mode) {
        details.push(`Warning: Meant event ${event.id} has mode (unusual but allowed)`);
      }

      // STRICT: derived_value must have computational grounding
      if (epistemicType === 'derived_value') {
        const hasComputational = event.grounding?.references?.some(
          ref => ref.kind === 'computational'
        );
        if (!hasComputational) {
          violations.push({
            eventId: event.id,
            error: 'Derived value must have computational grounding'
          });
        }
      }
    }

    const givenCount = events.filter(e => (e.epistemicType || e.type) === 'given').length;
    const meantCount = events.filter(e => (e.epistemicType || e.type) === 'meant').length;
    const derivedCount = events.filter(e => (e.epistemicType || e.type) === 'derived_value').length;
    details.push(`Given: ${givenCount}, Meant: ${meantCount}, Derived Values: ${derivedCount}`);

    return new RuleCheckResult(
      1,
      'Distinction (Partition Axiom)',
      violations.length === 0,
      details,
      violations
    );
  }

  /**
   * Rule 2: Impenetrability (Anti-Confabulation) - STRICT EO
   *
   * External Origin: Only Given may have external grounding.
   * Raw experience may only be derived from raw experience.
   * No interpretive process may produce the given.
   */
  checkRule2_Impenetrability() {
    const violations = [];
    const details = [];
    const events = this.eventStore.getAll();
    const givenEvents = this.eventStore.getGiven();

    details.push(`Checking ${givenEvents.length} Given events for confabulation`);

    // Check Given events
    for (const event of givenEvents) {
      if (event.parents && event.parents.length > 0) {
        for (const parentId of event.parents) {
          const parent = this.eventStore.get(parentId);
          const parentType = parent?.epistemicType || parent?.type;
          if (parent && (parentType === 'meant' || parentType === 'derived_value')) {
            violations.push({
              eventId: event.id,
              parentId: parentId,
              error: `Given event derives from ${parentType} event (confabulation)`
            });
          }
        }
      }

      // Check if event has any indication it was generated from interpretation
      if (event.payload?.derivedFrom) {
        const sources = Array.isArray(event.payload.derivedFrom)
          ? event.payload.derivedFrom
          : [event.payload.derivedFrom];

        for (const sourceId of sources) {
          const source = this.eventStore.get(sourceId);
          const sourceType = source?.epistemicType || source?.type;
          if (source && sourceType !== 'given') {
            violations.push({
              eventId: event.id,
              sourceId: sourceId,
              error: `Given event payload indicates derivation from ${sourceType}`
            });
          }
        }
      }
    }

    // STRICT: Check that only Given has external grounding
    details.push('Checking external grounding restrictions');
    for (const event of events) {
      const epistemicType = event.epistemicType || event.type;

      if (event.grounding?.references) {
        for (const ref of event.grounding.references) {
          if (ref.kind === 'external' && epistemicType !== 'given') {
            violations.push({
              eventId: event.id,
              error: `Only Given events may have external grounding (found in ${epistemicType})`
            });
          }
        }
      }
    }

    details.push(`Checked parent chains and grounding for all Given events`);

    return new RuleCheckResult(
      2,
      'Impenetrability (Anti-Confabulation)',
      violations.length === 0,
      details,
      violations
    );
  }

  /**
   * Rule 3: Ineliminability (Anti-Gaslighting)
   *
   * Raw experience persists through all operations.
   * The given cannot be erased, edited, or replaced.
   */
  checkRule3_Ineliminability() {
    const violations = [];
    const details = [];

    // Check 1: Event store is append-only
    // (This is enforced by design, but we verify the invariant)
    const events = this.eventStore.getAll();
    const eventIds = new Set(events.map(e => e.id));

    details.push('Verifying append-only invariant');

    // Check that events are ordered by logical clock
    let lastClock = 0;
    for (const event of events) {
      if (event.logicalClock < lastClock) {
        violations.push({
          eventId: event.id,
          error: `Logical clock regression: ${event.logicalClock} < ${lastClock}`
        });
      }
      lastClock = event.logicalClock;
    }

    // Check 2: No Given events have been modified
    // (We check for modification markers or inconsistencies)
    for (const event of this.eventStore.getGiven()) {
      if (event._modified || event._edited) {
        violations.push({
          eventId: event.id,
          error: 'Given event has modification markers'
        });
      }
    }

    // Check 3: Tombstones don't erase, they supersede
    const tombstones = events.filter(e => e.payload?.action === 'tombstone');
    for (const tombstone of tombstones) {
      const targetId = tombstone.payload?.targetId;
      if (targetId && !eventIds.has(targetId)) {
        violations.push({
          eventId: tombstone.id,
          targetId: targetId,
          error: 'Tombstone references non-existent event (may have been erased)'
        });
      }
    }

    details.push(`Verified ${events.length} events, ${tombstones.length} tombstones`);

    return new RuleCheckResult(
      3,
      'Ineliminability (Anti-Gaslighting)',
      violations.length === 0,
      details,
      violations
    );
  }

  /**
   * Rule 4: Perspectivality (Anti-Omniscience)
   *
   * All memory availability is mediated by horizon.
   * No memory is universally accessible.
   */
  checkRule4_Perspectivality() {
    const violations = [];
    const details = [];

    const horizons = this.horizonLattice.getAll();
    const events = this.eventStore.getAll();

    details.push(`Checking ${horizons.length} horizons and ${events.length} events`);

    // Check that different horizons provide different access
    if (horizons.length > 1) {
      const accessPatterns = new Map();

      for (const horizon of horizons) {
        if (horizon.id === '_TOP_') continue;

        const gate = this.horizonLattice.createGate(horizon.id, this.eventStore);
        const available = gate.getAvailable();
        const signature = available.map(e => e.id).sort().join(',');

        if (!accessPatterns.has(signature)) {
          accessPatterns.set(signature, []);
        }
        accessPatterns.get(signature).push(horizon.id);
      }

      details.push(`Found ${accessPatterns.size} distinct access patterns`);

      // Warning if all horizons have same access
      if (accessPatterns.size === 1 && horizons.length > 2) {
        details.push('Warning: All horizons have identical access (may indicate design issue)');
      }
    }

    // Check for "god's eye view" - a horizon with access to everything
    for (const horizon of horizons) {
      if (horizon.id === '_TOP_') continue;

      const gate = this.horizonLattice.createGate(horizon.id, this.eventStore);
      const available = gate.getAvailable();

      if (available.length === events.length && events.length > 0) {
        // Check if this is intentional (top-level workspace horizon)
        if (horizon.type !== 'global' && horizon.type !== 'workspace') {
          violations.push({
            horizonId: horizon.id,
            error: 'Non-global horizon has access to all events (omniscience)'
          });
        }
      }
    }

    return new RuleCheckResult(
      4,
      'Perspectivality (Anti-Omniscience)',
      violations.length === 0,
      details,
      violations
    );
  }

  /**
   * Rule 5: Restrictivity (Foreclosure)
   *
   * Refinement of horizon may only restrict availability, never expand it.
   */
  checkRule5_Restrictivity() {
    const violations = [];
    const details = [];

    const horizons = this.horizonLattice.getAll();

    for (const horizon of horizons) {
      if (!horizon.parentId || horizon.parentId === '_TOP_') continue;

      const result = this.horizonLattice.verifyRestrictivity(
        horizon.parentId,
        horizon.id,
        this.eventStore
      );

      if (!result.valid) {
        violations.push({
          childId: horizon.id,
          parentId: horizon.parentId,
          violatingEvent: result.violatingEvent,
          error: result.error
        });
      }
    }

    details.push(`Checked ${horizons.length} horizon parent-child relationships`);

    return new RuleCheckResult(
      5,
      'Restrictivity (Foreclosure)',
      violations.length === 0,
      details,
      violations
    );
  }

  /**
   * Rule 6: Coherence (Locality)
   *
   * Any legitimate interpretive move in a broad horizon must remain
   * legitimate in all refinements of that horizon.
   */
  checkRule6_Coherence() {
    const violations = [];
    const details = [];

    const meantEvents = this.eventStore.getMeant();
    const horizons = this.horizonLattice.getAll();

    details.push(`Checking coherence for ${meantEvents.length} Meant events`);

    for (const meant of meantEvents) {
      // Find horizons where this interpretation is valid
      const validHorizons = [];

      for (const horizon of horizons) {
        const gate = this.horizonLattice.createGate(horizon.id, this.eventStore);

        // Check if interpretation is available
        if (!gate.isAvailable(meant)) continue;

        // Check if provenance is available
        let provenanceAvailable = true;
        for (const provId of (meant.provenance || [])) {
          if (!gate.get(provId)) {
            provenanceAvailable = false;
            break;
          }
        }

        if (provenanceAvailable) {
          validHorizons.push(horizon);
        }
      }

      // For each valid horizon, check that all refinements are also valid
      for (const broad of validHorizons) {
        for (const narrow of validHorizons) {
          if (narrow.id === broad.id) continue;

          if (this.horizonLattice.isBroaderOrEqual(broad.id, narrow.id)) {
            // narrow is a refinement of broad
            // Check that if valid at broad, still valid at narrow
            const broadGate = this.horizonLattice.createGate(broad.id, this.eventStore);
            const narrowGate = this.horizonLattice.createGate(narrow.id, this.eventStore);

            // If meant is available at broad, it should be at narrow
            // (unless horizon restricts it, which is allowed)
            // The key is provenance coherence
            if (narrowGate.isAvailable(meant)) {
              for (const provId of (meant.provenance || [])) {
                if (broadGate.get(provId) && !narrowGate.get(provId)) {
                  // Provenance was available at broad but not at narrow
                  // This is a coherence failure
                  violations.push({
                    meantId: meant.id,
                    broadHorizon: broad.id,
                    narrowHorizon: narrow.id,
                    provenanceId: provId,
                    error: 'Provenance available at broad horizon but not at refinement'
                  });
                }
              }
            }
          }
        }
      }
    }

    return new RuleCheckResult(
      6,
      'Coherence (Locality)',
      violations.length === 0,
      details,
      violations
    );
  }

  /**
   * Rule 7: Groundedness (Anti-Delusion) - STRICT EO
   *
   * Every Meant event must have TYPED grounds.
   * Grounding chains must terminate in Given events.
   * There are no free-floating meanings.
   *
   * Grounding Kinds:
   * - external: Only for Given
   * - structural: Forced by data shape
   * - semantic: Interpretive meaning
   * - computational: Operator execution
   * - epistemic: Confidence, status, claims
   */
  checkRule7_Groundedness() {
    const violations = [];
    const details = [];

    const meantEvents = this.eventStore.getMeant();
    const derivedValues = this.eventStore.getDerivedValues?.() || [];

    details.push(`Checking groundedness for ${meantEvents.length} Meant events and ${derivedValues.length} derived values`);

    // Check Meant events
    for (const meant of meantEvents) {
      // STRICT: Check for typed grounding (new system)
      if (meant.grounding?.references) {
        if (meant.grounding.references.length === 0) {
          violations.push({
            eventId: meant.id,
            error: 'Meant event has empty grounding references'
          });
          continue;
        }

        // Verify each reference has a kind
        for (const ref of meant.grounding.references) {
          if (!ref.kind) {
            violations.push({
              eventId: meant.id,
              error: `Grounding reference to ${ref.eventId} has no kind (untyped)`
            });
          }
        }

        // Verify transitive grounding terminates in Given
        const chain = this.eventStore.getProvenanceChain?.(meant.id) || [];
        const hasGivenRoot = chain.some(item => {
          const event = this.eventStore.get(item.eventId);
          return (event?.epistemicType || event?.type) === 'given';
        });

        if (!hasGivenRoot && chain.length > 0) {
          violations.push({
            eventId: meant.id,
            error: 'Grounding chain does not terminate in Given event'
          });
        }
      } else if (!meant.provenance || meant.provenance.length === 0) {
        // Fallback for legacy events without typed grounding
        violations.push({
          eventId: meant.id,
          error: 'Meant event has no grounding (groundless interpretation)'
        });
      }
    }

    // Check Derived Values
    for (const value of derivedValues) {
      if (!value.grounding?.references) {
        violations.push({
          eventId: value.id,
          error: 'Derived value has no grounding'
        });
        continue;
      }

      // STRICT: Derived values must have computational grounding
      const hasComputational = value.grounding.references.some(
        ref => ref.kind === 'computational'
      );
      if (!hasComputational) {
        violations.push({
          eventId: value.id,
          error: 'Derived value missing computational grounding'
        });
      }

      // STRICT: Derived values must have derivation chain
      if (!value.grounding.derivation) {
        violations.push({
          eventId: value.id,
          error: 'Derived value missing derivation chain (operators not recorded)'
        });
      }
    }

    // Count grounding chains
    let totalChainLength = 0;
    let chainCount = 0;
    const allEvents = [...meantEvents, ...derivedValues];

    for (const event of allEvents) {
      if (event.grounding?.references || event.provenance) {
        const chain = this.eventStore.getProvenanceChain?.(event.id) || [];
        totalChainLength += chain.length;
        chainCount++;
      }
    }

    if (chainCount > 0) {
      details.push(`Average provenance chain length: ${(totalChainLength / chainCount).toFixed(2)}`);
    }

    // Grounding kind statistics
    const kindCounts = { external: 0, structural: 0, semantic: 0, computational: 0, epistemic: 0 };
    for (const event of allEvents) {
      if (event.grounding?.references) {
        for (const ref of event.grounding.references) {
          if (ref.kind && kindCounts[ref.kind] !== undefined) {
            kindCounts[ref.kind]++;
          }
        }
      }
    }
    details.push(`Grounding by kind: ${JSON.stringify(kindCounts)}`);

    return new RuleCheckResult(
      7,
      'Groundedness (Anti-Delusion)',
      violations.length === 0,
      details,
      violations
    );
  }

  /**
   * Rule 8: Determinacy (Minimal Crystallization) - STRICT EO
   *
   * Semantic equivalence is maximal behavioral indistinguishability.
   * Meaning crystallizes at minimal horizons—never at some general height.
   *
   * STRICT RULE: No aggregation without value artifacts.
   * - Aggregations MUST produce derived_value events
   * - Insights MUST reference value events (never embed values)
   * - Confidence MUST be a derived value (never embedded)
   */
  checkRule8_Determinacy() {
    const violations = [];
    const details = [];

    const meantEvents = this.eventStore.getMeant();
    const derivedValues = this.eventStore.getDerivedValues?.() || [];

    details.push(`Checking determinacy for ${meantEvents.length} Meant events`);

    // Check that all Meant events have frames
    for (const meant of meantEvents) {
      if (!meant.frame) {
        violations.push({
          eventId: meant.id,
          error: 'Meant event has no frame (meaning not contextualized)'
        });
        continue;
      }

      // STRICT: Check for embedded values (violation of minimal crystallization)
      if (meant.payload?.value !== undefined && typeof meant.payload.value === 'number') {
        // Check if this is an insight that should reference a derived_value instead
        if (meant.category === 'insight' || meant.frame?.purpose === 'insight') {
          violations.push({
            eventId: meant.id,
            error: 'Insight embeds numeric value instead of referencing derived_value'
          });
        }
      }

      // STRICT: Check for embedded confidence (should be a reference)
      if (meant.frame?.confidence !== undefined && typeof meant.frame.confidence === 'number') {
        violations.push({
          eventId: meant.id,
          error: 'Frame embeds confidence score instead of referencing confidence event'
        });
      }

      // Check for explicit horizon specification
      if (!meant.frame.horizon && !meant.frame.purpose) {
        details.push(`Note: Meant event ${meant.id} has no horizon or purpose in frame`);
      }
    }

    // STRICT: Check aggregation execution events reference derived values
    const aggregationExecutions = meantEvents.filter(
      e => e.category === 'aggregation_executed' || e.payload?.action === 'aggregate'
    );
    details.push(`Found ${aggregationExecutions.length} aggregation executions`);

    for (const execution of aggregationExecutions) {
      // Check that there's a corresponding derived_value
      const hasResultValue = derivedValues.some(v =>
        v.grounding?.references?.some(ref => ref.eventId === execution.id)
      );

      if (!hasResultValue) {
        violations.push({
          eventId: execution.id,
          error: 'Aggregation execution has no corresponding derived_value result'
        });
      }
    }

    // Check for premature universalization
    for (const meant of meantEvents) {
      if (meant.frame?.universal === true) {
        violations.push({
          eventId: meant.id,
          error: 'Frame claims universal validity (Platonic error)'
        });
      }

      // Check for overly broad claims
      if (meant.frame?.scope === 'all' || meant.frame?.scope === 'universal') {
        details.push(`Warning: Meant event ${meant.id} has very broad scope`);
      }
    }

    // Group interpretations by frame purpose to check equivalence patterns
    const byPurpose = new Map();
    for (const meant of meantEvents) {
      const purpose = meant.frame?.purpose || 'unframed';
      if (!byPurpose.has(purpose)) {
        byPurpose.set(purpose, []);
      }
      byPurpose.get(purpose).push(meant);
    }

    details.push(`Found ${byPurpose.size} distinct frame purposes`);
    details.push(`Derived values available: ${derivedValues.length}`);

    return new RuleCheckResult(
      8,
      'Determinacy (Minimal Crystallization)',
      violations.length === 0,
      details,
      violations
    );
  }

  /**
   * Rule 9: Defeasibility (Anti-Dogma)
   *
   * Interpretations may be superseded. Later readings may overturn earlier ones.
   * But there is no global supersession ordering across all horizons.
   */
  checkRule9_Defeasibility() {
    const violations = [];
    const details = [];

    const meantEvents = this.eventStore.getMeant();

    details.push(`Checking defeasibility for ${meantEvents.length} Meant events`);

    // Check for dogmatic markers
    for (const meant of meantEvents) {
      // Check for immutability claims
      if (meant.immutable === true || meant.final === true) {
        violations.push({
          eventId: meant.id,
          error: 'Meant event claims immutability (dogmatism)'
        });
      }

      // Check epistemic status
      if (meant.epistemicStatus === 'infallible' || meant.epistemicStatus === 'certain') {
        violations.push({
          eventId: meant.id,
          error: 'Meant event claims infallibility (dogmatism)'
        });
      }
    }

    // Check for global ordering attempts
    // (A global ordering would be a total order on all interpretations)
    const supersessionChains = new Map();
    for (const meant of meantEvents) {
      if (meant.supersedes) {
        if (!supersessionChains.has(meant.supersedes)) {
          supersessionChains.set(meant.supersedes, []);
        }
        supersessionChains.get(meant.supersedes).push(meant.id);
      }
    }

    details.push(`Found ${supersessionChains.size} supersession relationships`);

    // Check that supersession is frame-local (not universal)
    for (const meant of meantEvents) {
      if (meant.supersedes && meant.supersessionScope === 'global') {
        violations.push({
          eventId: meant.id,
          error: 'Supersession claims global scope (violates locality)'
        });
      }
    }

    // Verify that active interpretations can be identified per-frame
    const activeByFrame = new Map();
    for (const meant of this.eventStore.getActiveInterpretations()) {
      const purpose = meant.frame?.purpose || 'unframed';
      if (!activeByFrame.has(purpose)) {
        activeByFrame.set(purpose, []);
      }
      activeByFrame.get(purpose).push(meant);
    }

    details.push(`Active interpretations across ${activeByFrame.size} frames`);

    return new RuleCheckResult(
      9,
      'Defeasibility (Anti-Dogma)',
      violations.length === 0,
      details,
      violations
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ghost Data Compliance
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check ghost data compliance with the Nine Rules
   * Ghost operations must respect:
   * - Rule 3: Ghosts preserve ineliminability (original data remains in log)
   * - Rule 7: Ghosts maintain groundedness (provenance to tombstone event)
   * - Rule 9: Ghosts are defeasible (can be resurrected)
   *
   * @param {EOGhostRegistry} ghostRegistry - The ghost registry to check
   * @returns {Object} Ghost compliance report
   */
  checkGhostCompliance(ghostRegistry) {
    if (!ghostRegistry) {
      return {
        passed: true,
        details: ['Ghost registry not available'],
        violations: []
      };
    }

    const violations = [];
    const details = [];
    const ghosts = ghostRegistry.getAllGhosts();

    details.push(`Checking ${ghosts.length} ghost records`);

    for (const ghost of ghosts) {
      // Rule 3: Ghost must have valid tombstone event in log
      if (!ghost.tombstoneEventId) {
        violations.push({
          ghostId: ghost.id,
          rule: 3,
          error: 'Ghost has no tombstone event reference (violates ineliminability)'
        });
      } else {
        // Verify tombstone exists in event store
        const tombstone = this.eventStore.get(ghost.tombstoneEventId);
        if (!tombstone) {
          violations.push({
            ghostId: ghost.id,
            rule: 3,
            error: `Tombstone event ${ghost.tombstoneEventId} not found in log`
          });
        }
      }

      // Rule 7: Ghost snapshot must be grounded
      if (!ghost.snapshot) {
        violations.push({
          ghostId: ghost.id,
          rule: 7,
          error: 'Ghost has no snapshot (groundedness violation)'
        });
      }

      // Rule 9: Ghost must be in a valid lifecycle state
      const validStatuses = ['active', 'dormant', 'resurrected', 'purged'];
      if (!validStatuses.includes(ghost.status)) {
        violations.push({
          ghostId: ghost.id,
          rule: 9,
          error: `Invalid ghost status: ${ghost.status}`
        });
      }

      // Check retention policy compliance
      if (ghost.retentionPolicy === 'legal_hold' && ghost.status === 'purged') {
        violations.push({
          ghostId: ghost.id,
          rule: 3,
          error: 'Ghost under legal hold was purged (retention violation)'
        });
      }
    }

    // Check haunt relationships
    const stats = ghostRegistry.getStats();
    details.push(`Active ghosts: ${stats.activeGhosts}`);
    details.push(`Total haunts detected: ${stats.hauntsDetected}`);
    details.push(`Haunts resolved: ${stats.hauntsResolved}`);

    return {
      passed: violations.length === 0,
      details,
      violations,
      stats
    };
  }

  /**
   * Run full audit including ghost compliance
   * @param {EOGhostRegistry} ghostRegistry - Optional ghost registry
   */
  async runFullAuditWithGhosts(ghostRegistry = null) {
    const audit = await this.runFullAudit();

    if (ghostRegistry) {
      const ghostCompliance = this.checkGhostCompliance(ghostRegistry);
      audit.ghostCompliance = ghostCompliance;

      // Ghost violations affect overall conformance
      if (!ghostCompliance.passed) {
        // Ghost violations primarily affect Rule 3 (ineliminability)
        const rule3Result = audit.results.find(r => r.ruleNumber === 3);
        if (rule3Result) {
          rule3Result.violations.push(...ghostCompliance.violations.filter(v => v.rule === 3));
          if (rule3Result.violations.length > 0) {
            rule3Result.passed = false;
          }
        }
      }
    }

    return audit;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Interpretation Layer Compliance
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check interpretation binding compliance
   *
   * Rules:
   * I1: Interpretations must have agents (no anonymous meaning)
   * I2: Semantic URIs must resolve (no dangling references)
   * I3: No conflicting bindings (each column bound once per interpretation)
   * I4: Version integrity (semantic changes require version bumps)
   */
  checkInterpretationCompliance() {
    const violations = [];
    const details = [];

    // Get binding store and semantic registry
    const bindingStore = typeof window !== 'undefined' && window.EOInterpretationBinding?.getBindingStore?.();
    const semanticRegistry = typeof window !== 'undefined' && window.EOSchemaSemantic?.getSemanticRegistry?.();

    if (!bindingStore) {
      details.push('InterpretationBindingStore not available');
      return { passed: true, details, violations, rules: [] };
    }

    const bindings = bindingStore.getAll();
    details.push(`Checking ${bindings.length} interpretation bindings`);

    const ruleResults = [];

    // Rule I1: Agent is required
    const i1Violations = [];
    for (const binding of bindings) {
      if (!binding.agent || binding.agent.trim() === '') {
        i1Violations.push({
          bindingId: binding.id,
          error: 'InterpretationBinding missing agent'
        });
      }
    }
    ruleResults.push({
      rule: 'I1',
      name: 'Agent Required',
      passed: i1Violations.length === 0,
      violations: i1Violations
    });
    violations.push(...i1Violations);

    // Rule I2: Semantic URI resolution
    const i2Violations = [];
    if (semanticRegistry) {
      for (const binding of bindings) {
        for (const b of binding.bindings || []) {
          if (b.semantic_uri && !semanticRegistry.get(b.semantic_uri)) {
            i2Violations.push({
              bindingId: binding.id,
              column: b.column,
              semanticUri: b.semantic_uri,
              error: 'Semantic URI not found in registry'
            });
          }
        }
      }
    }
    ruleResults.push({
      rule: 'I2',
      name: 'Semantic Resolution',
      passed: i2Violations.length === 0,
      violations: i2Violations
    });
    violations.push(...i2Violations);

    // Rule I3: No conflicting bindings
    const i3Violations = [];
    for (const binding of bindings) {
      const columnCounts = new Map();
      for (const b of binding.bindings || []) {
        const count = (columnCounts.get(b.column) || 0) + 1;
        columnCounts.set(b.column, count);
        if (count > 1) {
          i3Violations.push({
            bindingId: binding.id,
            column: b.column,
            error: 'Column has multiple bindings in same interpretation'
          });
        }
      }
    }
    ruleResults.push({
      rule: 'I3',
      name: 'No Conflicts',
      passed: i3Violations.length === 0,
      violations: i3Violations
    });
    violations.push(...i3Violations);

    // Rule I4: Version integrity (check for definition changes without version bump)
    // This requires tracking historical changes - for now we check status
    const i4Violations = [];
    if (semanticRegistry) {
      const semantics = semanticRegistry.getAll();
      const byTerm = new Map();
      for (const s of semantics) {
        if (!byTerm.has(s.term)) {
          byTerm.set(s.term, []);
        }
        byTerm.get(s.term).push(s);
      }

      for (const [term, versions] of byTerm) {
        if (versions.length > 1) {
          // Sort by version
          versions.sort((a, b) => a.version - b.version);
          for (let i = 1; i < versions.length; i++) {
            const prev = versions[i - 1];
            const curr = versions[i];
            // Check if definition changed but version didn't bump correctly
            if (prev.definition !== curr.definition && curr.version <= prev.version) {
              i4Violations.push({
                term,
                prevVersion: prev.version,
                currVersion: curr.version,
                error: 'Semantic definition changed without version bump'
              });
            }
          }
        }
      }
    }
    ruleResults.push({
      rule: 'I4',
      name: 'Version Integrity',
      passed: i4Violations.length === 0,
      violations: i4Violations
    });
    violations.push(...i4Violations);

    // Summary stats
    const semanticCount = semanticRegistry?.size || 0;
    const boundColumns = bindings.reduce((sum, b) => sum + (b.bindings?.length || 0), 0);
    details.push(`Schema semantics in registry: ${semanticCount}`);
    details.push(`Total column bindings: ${boundColumns}`);
    details.push(`Rules passed: ${ruleResults.filter(r => r.passed).length}/4`);

    return {
      passed: violations.length === 0,
      details,
      violations,
      rules: ruleResults
    };
  }

  /**
   * Validate an individual interpretation binding
   */
  validateInterpretationBinding(binding) {
    const errors = [];
    const warnings = [];

    // Check agent
    if (!binding.agent || binding.agent.trim() === '') {
      errors.push('InterpretationBinding requires an agent');
    }

    // Check source dataset
    if (!binding.source_dataset) {
      errors.push('InterpretationBinding requires a source_dataset');
    }

    // Check method
    const validMethods = ['manual_binding', 'suggested_accepted', 'imported', 'inferred', 'migrated'];
    if (binding.method && !validMethods.includes(binding.method)) {
      warnings.push(`Unknown binding method: ${binding.method}`);
    }

    // Check bindings array
    if (!binding.bindings || binding.bindings.length === 0) {
      warnings.push('InterpretationBinding has no column bindings');
    }

    // Check for duplicates
    const columns = new Set();
    for (const b of binding.bindings || []) {
      if (columns.has(b.column)) {
        errors.push(`Duplicate binding for column: ${b.column}`);
      }
      columns.add(b.column);

      // Check semantic URI format
      if (b.semantic_uri && !b.semantic_uri.startsWith('eo://')) {
        warnings.push(`Non-standard semantic URI: ${b.semantic_uri}`);
      }
    }

    // Check provenance completeness
    if (!binding.jurisdiction) {
      warnings.push('jurisdiction_missing');
    }
    if (!binding.scale) {
      warnings.push('scale_unspecified');
    }
    if (!binding.timeframe) {
      warnings.push('timeframe_unspecified');
    }
    if (!binding.background || binding.background.length === 0) {
      warnings.push('background_empty');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Run full audit including interpretation compliance
   */
  async runFullAuditWithInterpretations() {
    const audit = this.runAudit();

    // Add interpretation compliance
    const interpretationCompliance = this.checkInterpretationCompliance();
    audit.interpretationCompliance = interpretationCompliance;

    // Interpretation violations primarily affect Rule 7 (groundedness)
    // since semantics provide grounding for meanings
    if (!interpretationCompliance.passed) {
      const rule7Result = audit.results.find(r => r.ruleNumber === 7);
      if (rule7Result) {
        const interpretationViolations = interpretationCompliance.violations.map(v => ({
          ...v,
          source: 'interpretation_layer'
        }));
        rule7Result.violations.push(...interpretationViolations);
        if (rule7Result.violations.length > 0) {
          rule7Result.passed = false;
        }
      }
    }

    return audit;
  }

  /**
   * Generate a human-readable compliance report
   */
  generateReport(audit) {
    const lines = [];

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                 EXPERIENCE ENGINE COMPLIANCE AUDIT            ');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`Audit Time: ${audit.startTime} - ${audit.endTime}`);
    lines.push(`Conformance Level: ${audit.conformanceLevel}`);
    lines.push(`Rules Passed: ${audit.passedCount}/${audit.results.length}`);
    lines.push('');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('');

    // Part I: The Given
    lines.push('PART I: THE GIVEN');
    lines.push('(Experience must not be fabricated)');
    lines.push('');

    for (const result of audit.results.slice(0, 3)) {
      this._appendRuleResult(lines, result);
    }

    // Part II: The Horizon
    lines.push('PART II: THE HORIZON');
    lines.push('(There is no view from nowhere)');
    lines.push('');

    for (const result of audit.results.slice(3, 6)) {
      this._appendRuleResult(lines, result);
    }

    // Part III: The Meant
    lines.push('PART III: THE MEANT');
    lines.push('(Meaning must earn its keep)');
    lines.push('');

    for (const result of audit.results.slice(6, 9)) {
      this._appendRuleResult(lines, result);
    }

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(`                    END OF COMPLIANCE REPORT                   `);
    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }

  _appendRuleResult(lines, result) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    lines.push(`Rule ${result.ruleNumber}: ${result.ruleName}`);
    lines.push(`Status: ${status}`);

    if (result.details.length > 0) {
      lines.push('Details:');
      for (const detail of result.details) {
        lines.push(`  - ${detail}`);
      }
    }

    if (result.violations.length > 0) {
      lines.push('Violations:');
      for (const v of result.violations.slice(0, 5)) {
        lines.push(`  ! ${v.error}`);
        if (v.eventId) lines.push(`    Event: ${v.eventId}`);
      }
      if (result.violations.length > 5) {
        lines.push(`  ... and ${result.violations.length - 5} more`);
      }
    }

    lines.push('');
  }
}

// Singleton
let _complianceChecker = null;

function getComplianceChecker(eventStore, horizonLattice) {
  if (!_complianceChecker) {
    _complianceChecker = new EOComplianceChecker(eventStore, horizonLattice);
  }
  return _complianceChecker;
}

function initComplianceChecker(eventStore, horizonLattice) {
  _complianceChecker = new EOComplianceChecker(eventStore, horizonLattice);
  return _complianceChecker;
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EOComplianceChecker,
    RuleCheckResult,
    ComplianceAudit,
    getComplianceChecker,
    initComplianceChecker
  };
}

if (typeof window !== 'undefined') {
  window.EOComplianceChecker = EOComplianceChecker;
  window.RuleCheckResult = RuleCheckResult;
  window.ComplianceAudit = ComplianceAudit;
  window.getComplianceChecker = getComplianceChecker;
  window.initComplianceChecker = initComplianceChecker;
}
