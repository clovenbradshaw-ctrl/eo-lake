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
   * Rule 1: Distinction (The Partition Axiom)
   *
   * Raw experience and interpretation are two exhaustive, mutually exclusive modes.
   * There is no third category and no ambiguity between them.
   */
  checkRule1_Distinction() {
    const violations = [];
    const details = [];
    const events = this.eventStore.getAll();

    details.push(`Checking ${events.length} events for type classification`);

    for (const event of events) {
      // Check that type exists and is valid
      if (!event.type) {
        violations.push({
          eventId: event.id,
          error: 'Event has no type classification'
        });
      } else if (event.type !== 'given' && event.type !== 'meant') {
        violations.push({
          eventId: event.id,
          error: `Invalid type "${event.type}" - must be "given" or "meant"`
        });
      }

      // Check for hybrid indicators (warning)
      if (event.type === 'given' && event.frame) {
        details.push(`Warning: Given event ${event.id} has frame (unusual but allowed)`);
      }

      if (event.type === 'meant' && event.mode) {
        details.push(`Warning: Meant event ${event.id} has mode (unusual but allowed)`);
      }
    }

    const givenCount = events.filter(e => e.type === 'given').length;
    const meantCount = events.filter(e => e.type === 'meant').length;
    details.push(`Given: ${givenCount}, Meant: ${meantCount}`);

    return new RuleCheckResult(
      1,
      'Distinction (Partition Axiom)',
      violations.length === 0,
      details,
      violations
    );
  }

  /**
   * Rule 2: Impenetrability (Anti-Confabulation)
   *
   * Raw experience may only be derived from raw experience.
   * No interpretive process may produce the given.
   */
  checkRule2_Impenetrability() {
    const violations = [];
    const details = [];
    const givenEvents = this.eventStore.getGiven();

    details.push(`Checking ${givenEvents.length} Given events for confabulation`);

    for (const event of givenEvents) {
      if (event.parents && event.parents.length > 0) {
        for (const parentId of event.parents) {
          const parent = this.eventStore.get(parentId);
          if (parent && parent.type === 'meant') {
            violations.push({
              eventId: event.id,
              parentId: parentId,
              error: 'Given event derives from Meant event (confabulation)'
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
          if (source && source.type === 'meant') {
            violations.push({
              eventId: event.id,
              sourceId: sourceId,
              error: 'Given event payload indicates derivation from Meant'
            });
          }
        }
      }
    }

    details.push(`Checked parent chains for all Given events`);

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
   * Rule 7: Groundedness (Anti-Delusion)
   *
   * Every interpretation must have non-empty provenance in raw experience.
   * There are no free-floating meanings.
   */
  checkRule7_Groundedness() {
    const violations = [];
    const details = [];

    const meantEvents = this.eventStore.getMeant();

    details.push(`Checking groundedness for ${meantEvents.length} Meant events`);

    for (const meant of meantEvents) {
      // Check for provenance
      if (!meant.provenance || meant.provenance.length === 0) {
        violations.push({
          eventId: meant.id,
          error: 'Meant event has no provenance (groundless)'
        });
        continue;
      }

      // Verify transitive grounding
      const grounding = this.eventStore.verifyGrounding(meant);
      if (!grounding.grounded) {
        violations.push({
          eventId: meant.id,
          error: `Grounding verification failed: ${grounding.error}`
        });
      }
    }

    // Count grounding chains
    let totalChainLength = 0;
    let chainCount = 0;
    for (const meant of meantEvents) {
      if (meant.provenance) {
        const chain = this.eventStore.getProvenanceChain(meant.id);
        totalChainLength += chain.length;
        chainCount++;
      }
    }

    if (chainCount > 0) {
      details.push(`Average provenance chain length: ${(totalChainLength / chainCount).toFixed(2)}`);
    }

    return new RuleCheckResult(
      7,
      'Groundedness (Anti-Delusion)',
      violations.length === 0,
      details,
      violations
    );
  }

  /**
   * Rule 8: Determinacy (Meaning-as-Use)
   *
   * Semantic equivalence is maximal behavioral indistinguishability.
   * Meaning crystallizes at minimal horizons—never at some general height.
   */
  checkRule8_Determinacy() {
    const violations = [];
    const details = [];

    const meantEvents = this.eventStore.getMeant();

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

      if (!meant.frame.purpose) {
        violations.push({
          eventId: meant.id,
          error: 'Frame has no purpose (meaning undetermined)'
        });
      }

      // Check for explicit horizon specification
      if (!meant.frame.horizon) {
        details.push(`Note: Meant event ${meant.id} has no horizon in frame`);
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

    return new RuleCheckResult(
      8,
      'Determinacy (Meaning-as-Use)',
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
