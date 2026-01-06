/**
 * Tests for EO Activity Enforcement
 *
 * Run with: node eo_activity_enforcement.test.js
 *
 * Tests validation rules from docs/LAYER_ACTIVITY_TRACKING_RULES.md
 */

const enforcement = require('./eo_activity_enforcement.js');

// ============================================================================
// Test Utilities
// ============================================================================

let passCount = 0;
let failCount = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failCount++;
    failures.push({ name, error: e.message });
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${e.message}`);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(`${message} Expected truthy value, got ${value}`);
  }
}

function assertFalse(value, message = '') {
  if (value) {
    throw new Error(`${message} Expected falsy value, got ${value}`);
  }
}

function assertContains(arr, item, message = '') {
  if (!arr.includes(item)) {
    throw new Error(`${message} Expected array to contain "${item}"`);
  }
}

function assertArrayContainsPartial(arr, partial, message = '') {
  const found = arr.some(item => item.includes(partial));
  if (!found) {
    throw new Error(`${message} Expected array to contain item with "${partial}". Got: ${arr.join(', ')}`);
  }
}

// ============================================================================
// Test Data
// ============================================================================

function createBasicActivity(op, overrides = {}) {
  return {
    id: 'act_test_123',
    ts: Date.now(),
    op,
    actor: 'user:test',
    target: 'entity_001',
    ...overrides
  };
}

// ============================================================================
// Universal Requirement Tests
// ============================================================================

console.log('\n== Universal Requirements ==\n');

test('validates activity with all required fields', () => {
  const activity = createBasicActivity('INS');
  const result = enforcement.validateUniversalRequirements(activity);
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('rejects activity without operator', () => {
  const activity = createBasicActivity('INS');
  delete activity.op;
  const result = enforcement.validateUniversalRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'operator', 'Should mention operator.');
});

test('rejects activity with invalid operator', () => {
  const activity = createBasicActivity('INVALID_OP');
  const result = enforcement.validateUniversalRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'Invalid operator', 'Should mention invalid operator.');
});

test('rejects activity without target', () => {
  const activity = createBasicActivity('INS');
  delete activity.target;
  const result = enforcement.validateUniversalRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'target', 'Should mention target.');
});

test('rejects activity without actor', () => {
  const activity = createBasicActivity('INS');
  delete activity.actor;
  const result = enforcement.validateUniversalRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'actor', 'Should mention actor.');
});

test('rejects activity without timestamp', () => {
  const activity = createBasicActivity('INS');
  delete activity.ts;
  const result = enforcement.validateUniversalRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'timestamp', 'Should mention timestamp.');
});

// ============================================================================
// Operator-Specific Requirement Tests
// ============================================================================

console.log('\n== Operator-Specific Requirements ==\n');

// INS
test('INS - accepts valid activity', () => {
  const activity = createBasicActivity('INS', {
    data: { type: 'set', value: { name: 'Test Set' } }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

// DES
test('DES - accepts valid activity with delta', () => {
  const activity = createBasicActivity('DES', {
    delta: [null, 'New Name']
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('DES - rejects empty new name in delta', () => {
  const activity = createBasicActivity('DES', {
    delta: ['Old Name', '']
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'new name', 'Should mention new name.');
});

// SEG
test('SEG - accepts valid activity with visibility', () => {
  const activity = createBasicActivity('SEG', {
    data: { visibility: 'hidden', scope: 'lens_001' }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('SEG - rejects activity without visibility specification', () => {
  const activity = createBasicActivity('SEG', {
    data: { other: 'stuff' }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'visibility', 'Should mention visibility.');
});

// CON
test('CON - accepts valid activity with relatedTo', () => {
  const activity = createBasicActivity('CON', {
    data: { relatedTo: 'entity_002' }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('CON - rejects activity without relatedTo', () => {
  const activity = createBasicActivity('CON', {
    data: { other: 'stuff' }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'relatedTo', 'Should mention relatedTo.');
});

test('CON - requires conflictPolicy for joins', () => {
  const activity = createBasicActivity('CON', {
    data: {
      relatedTo: 'entity_002',
      joinType: 'LEFT',
      conditions: [{ left: 'fld_01', right: 'fld_02' }]
    }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'conflictPolicy', 'Should mention conflictPolicy.');
});

test('CON - accepts join with conflictPolicy', () => {
  const activity = createBasicActivity('CON', {
    data: {
      relatedTo: 'entity_002',
      joinType: 'LEFT',
      conditions: [{ left: 'fld_01', right: 'fld_02' }],
      conflictPolicy: 'LEFT_WINS'
    }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

// SYN
test('SYN - accepts valid activity with mergedFrom', () => {
  const activity = createBasicActivity('SYN', {
    data: { mergedFrom: ['entity_001', 'entity_002'] }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('SYN - accepts valid activity with left/right/canonical', () => {
  const activity = createBasicActivity('SYN', {
    data: {
      left: 'entity_001',
      right: 'entity_002',
      canonical: 'entity_001'
    }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('SYN - rejects when canonical is neither left nor right', () => {
  const activity = createBasicActivity('SYN', {
    data: {
      left: 'entity_001',
      right: 'entity_002',
      canonical: 'entity_003'
    }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'canonical', 'Should mention canonical.');
});

// ALT
test('ALT - accepts valid activity with delta', () => {
  const activity = createBasicActivity('ALT', {
    delta: [100, 200]
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('ALT - rejects activity without delta', () => {
  const activity = createBasicActivity('ALT');
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'delta', 'Should mention delta.');
});

test('ALT - rejects activity with malformed delta', () => {
  const activity = createBasicActivity('ALT', {
    delta: [100] // Only one element
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'delta', 'Should mention delta.');
});

// SUP
test('SUP - accepts valid activity with interpretations', () => {
  const activity = createBasicActivity('SUP', {
    data: {
      interpretations: [
        { id: 'interp_1', meaning: 'First' },
        { id: 'interp_2', meaning: 'Second' }
      ]
    }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('SUP - rejects activity without interpretations', () => {
  const activity = createBasicActivity('SUP', {
    data: { other: 'stuff' }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'interpretations', 'Should mention interpretations.');
});

test('SUP - rejects activity with only one interpretation', () => {
  const activity = createBasicActivity('SUP', {
    data: {
      interpretations: [{ id: 'interp_1', meaning: 'Only one' }]
    }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'at least 2', 'Should mention at least 2.');
});

// REC
test('REC - accepts valid activity with chain', () => {
  const activity = createBasicActivity('REC', {
    data: { chain: [{ kind: 'file', path: '/data.csv' }] }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('REC - accepts valid activity with source', () => {
  const activity = createBasicActivity('REC', {
    source: 'data.csv'
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('REC - rejects activity without provenance', () => {
  const activity = createBasicActivity('REC');
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'provenance', 'Should mention provenance.');
});

// NUL
test('NUL - accepts valid activity with reason', () => {
  const activity = createBasicActivity('NUL', {
    data: { reason: 'user_deletion' }
  });
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('NUL - rejects activity without reason', () => {
  const activity = createBasicActivity('NUL');
  const result = enforcement.validateOperatorRequirements(activity);
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'reason', 'Should mention reason.');
});

// ============================================================================
// Layer Constraint Tests
// ============================================================================

console.log('\n== Layer Constraints ==\n');

// SOURCE layer restrictions
test('SOURCE layer - accepts INS', () => {
  const activity = createBasicActivity('INS');
  const result = enforcement.validateLayerConstraints(activity, 'source');
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('SOURCE layer - rejects SEG (forbidden)', () => {
  const activity = createBasicActivity('SEG', {
    data: { visibility: 'hidden' }
  });
  const result = enforcement.validateLayerConstraints(activity, 'source');
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'not allowed', 'Should mention not allowed.');
});

test('SOURCE layer - rejects ALT (forbidden)', () => {
  const activity = createBasicActivity('ALT', {
    delta: [100, 200]
  });
  const result = enforcement.validateLayerConstraints(activity, 'source');
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'not allowed', 'Should mention not allowed.');
});

test('SOURCE layer - rejects SYN (forbidden)', () => {
  const activity = createBasicActivity('SYN', {
    data: { mergedFrom: ['a', 'b'] }
  });
  const result = enforcement.validateLayerConstraints(activity, 'source');
  assertTrue(result.errors.length > 0, 'Should have errors.');
});

test('SOURCE layer - rejects SUP (forbidden)', () => {
  const activity = createBasicActivity('SUP', {
    data: { interpretations: [{}, {}] }
  });
  const result = enforcement.validateLayerConstraints(activity, 'source');
  assertTrue(result.errors.length > 0, 'Should have errors.');
});

test('SOURCE layer - rejects NUL (forbidden)', () => {
  const activity = createBasicActivity('NUL', {
    data: { reason: 'test' }
  });
  const result = enforcement.validateLayerConstraints(activity, 'source');
  assertTrue(result.errors.length > 0, 'Should have errors.');
});

// PROJECT layer
test('PROJECT layer - accepts INS', () => {
  const activity = createBasicActivity('INS');
  const result = enforcement.validateLayerConstraints(activity, 'project');
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('PROJECT layer - warns for rare operator CON', () => {
  const activity = createBasicActivity('CON', {
    data: { relatedTo: 'other' }
  });
  const result = enforcement.validateLayerConstraints(activity, 'project');
  assertTrue(result.errors.length === 0, 'Should have no errors.');
  assertTrue(result.warnings.length > 0, 'Should have warnings.');
  assertArrayContainsPartial(result.warnings, 'rarely used', 'Should mention rarely used.');
});

// SET layer
test('SET layer - accepts all common operators', () => {
  const ops = ['INS', 'DES', 'CON', 'SYN', 'ALT', 'SUP', 'REC', 'NUL'];
  for (const op of ops) {
    const activity = createBasicActivity(op);
    const result = enforcement.validateLayerConstraints(activity, 'set');
    assertTrue(result.errors.length === 0, `SET should accept ${op}.`);
  }
});

// SET layer - CON requires conflictPolicy for joins
test('SET layer - CON join requires conflictPolicy', () => {
  const activity = createBasicActivity('CON', {
    data: {
      relatedTo: 'other',
      joinType: 'LEFT',
      conditions: []
    }
  });
  const result = enforcement.validateLayerConstraints(activity, 'set');
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'conflictPolicy', 'Should mention conflictPolicy.');
});

// LENS layer
test('LENS layer - accepts SEG', () => {
  const activity = createBasicActivity('SEG', {
    data: { visibility: 'filtered' }
  });
  const result = enforcement.validateLayerConstraints(activity, 'lens');
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('LENS layer - rejects SEG that expands beyond parent', () => {
  const activity = createBasicActivity('SEG', {
    data: { visibility: 'filtered', expandBeyondParent: true }
  });
  const result = enforcement.validateLayerConstraints(activity, 'lens');
  assertTrue(result.errors.length > 0, 'Should have errors.');
  assertArrayContainsPartial(result.errors, 'restrictive', 'Should mention restrictive.');
});

// VIEW layer
test('VIEW layer - accepts all common operators', () => {
  const ops = ['INS', 'DES', 'SEG', 'ALT', 'SUP', 'REC', 'NUL'];
  for (const op of ops) {
    const activity = createBasicActivity(op);
    const result = enforcement.validateLayerConstraints(activity, 'view');
    assertTrue(result.errors.length === 0, `VIEW should accept ${op}.`);
  }
});

// ============================================================================
// Comprehensive Validation Tests
// ============================================================================

console.log('\n== Comprehensive Validation ==\n');

test('enforceActivityRules - validates complete activity', () => {
  const activity = createBasicActivity('ALT', {
    delta: [100, 200]
  });
  const result = enforcement.enforceActivityRules(activity, { layerType: 'set' });
  assertTrue(result.valid, 'Should be valid.');
  assertTrue(result.errors.length === 0, 'Should have no errors.');
});

test('enforceActivityRules - collects all errors', () => {
  const activity = {
    id: 'act_test',
    // Missing: ts, op, actor, target
  };
  const result = enforcement.enforceActivityRules(activity);
  assertFalse(result.valid, 'Should be invalid.');
  assertTrue(result.errors.length >= 3, 'Should have multiple errors.');
});

test('enforceActivityRules - strict mode converts warnings to errors', () => {
  const activity = createBasicActivity('CON', {
    data: { relatedTo: 'other' }
  });
  const normalResult = enforcement.enforceActivityRules(activity, { layerType: 'project' });
  assertTrue(normalResult.valid, 'Should be valid in normal mode.');
  assertTrue(normalResult.warnings.length > 0, 'Should have warnings.');

  const strictResult = enforcement.enforceActivityRules(activity, { layerType: 'project', strict: true });
  assertFalse(strictResult.valid, 'Should be invalid in strict mode.');
  assertTrue(strictResult.errors.length > 0, 'Warnings should become errors.');
});

test('enforceOrThrow - throws on invalid activity', () => {
  const activity = { id: 'test' }; // Missing required fields
  let threw = false;
  try {
    enforcement.enforceOrThrow(activity);
  } catch (e) {
    threw = true;
    assertEqual(e.name, 'ActivityValidationError', 'Should throw ActivityValidationError.');
  }
  assertTrue(threw, 'Should have thrown.');
});

test('enforceOrThrow - returns activity when valid', () => {
  // ALT with delta is a fully valid activity with no warnings
  const activity = createBasicActivity('ALT', {
    delta: [100, 200]
  });
  const result = enforcement.enforceOrThrow(activity);
  assertEqual(result.id, activity.id, 'Should return the activity.');
});

// ============================================================================
// Batch Validation Tests
// ============================================================================

console.log('\n== Batch Validation ==\n');

test('validateActivities - validates multiple activities', () => {
  const activities = [
    createBasicActivity('INS'),
    createBasicActivity('DES', { delta: [null, 'Name'] }),
    createBasicActivity('ALT', { delta: [1, 2] })
  ];
  const result = enforcement.validateActivities(activities);
  assertEqual(result.total, 3, 'Should count all activities.');
  assertEqual(result.valid, 3, 'All should be valid.');
  assertTrue(result.allValid, 'allValid should be true.');
});

test('validateActivities - counts invalid activities', () => {
  const activities = [
    createBasicActivity('INS'),
    { id: 'bad', op: 'ALT' }, // Missing fields
    createBasicActivity('DES', { delta: [null, 'Name'] })
  ];
  const result = enforcement.validateActivities(activities);
  assertEqual(result.total, 3, 'Should count all activities.');
  assertEqual(result.invalid, 1, 'Should count invalid.');
  assertFalse(result.allValid, 'allValid should be false.');
});

test('validateActivitySequence - validates sequence structure', () => {
  const activities = [
    createBasicActivity('INS'),
    createBasicActivity('REC', { source: 'file.csv' }),
    createBasicActivity('DES', { delta: [null, 'Name'] })
  ];
  const result = enforcement.validateActivitySequence(activities);
  assertTrue(result.sequenceValid, 'Sequence should be valid.');
  assertTrue(result.sequenceErrors.length === 0, 'Should have no sequence errors.');
});

test('validateActivitySequence - warns if not starting with INS', () => {
  const activities = [
    createBasicActivity('DES', { delta: [null, 'Name'] }),
    createBasicActivity('INS')
  ];
  const result = enforcement.validateActivitySequence(activities);
  assertTrue(result.sequenceErrors.length > 0, 'Should have sequence errors.');
  assertArrayContainsPartial(result.sequenceErrors, 'start with INS', 'Should mention starting with INS.');
});

test('validateActivitySequence - warns if not ending with DES', () => {
  const activities = [
    createBasicActivity('INS'),
    createBasicActivity('ALT', { delta: [1, 2] })
  ];
  const result = enforcement.validateActivitySequence(activities);
  assertTrue(result.sequenceWarnings.length > 0, 'Should have sequence warnings.');
  assertArrayContainsPartial(result.sequenceWarnings, 'end with DES', 'Should mention ending with DES.');
});

// ============================================================================
// Layer-Specific Validator Tests
// ============================================================================

console.log('\n== Layer-Specific Validators ==\n');

test('validateSourceActivity - uses source layer', () => {
  const activity = createBasicActivity('SEG', { data: { visibility: 'hidden' } });
  const result = enforcement.validateSourceActivity(activity);
  assertTrue(result.errors.length > 0, 'Should reject SEG on source.');
});

test('validateSetActivity - uses set layer', () => {
  const activity = createBasicActivity('ALT', { delta: [1, 2] });
  const result = enforcement.validateSetActivity(activity);
  assertTrue(result.valid, 'Should accept ALT on set.');
});

test('validateViewActivity - uses view layer', () => {
  const activity = createBasicActivity('SEG', { data: { visibility: 'filtered' } });
  const result = enforcement.validateViewActivity(activity);
  assertTrue(result.valid, 'Should accept SEG on view.');
});

// ============================================================================
// Test Summary
// ============================================================================

console.log('\n========================================');
console.log(`Tests: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log('========================================\n');

if (failCount > 0) {
  console.log('Failures:');
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('All tests passed! ✓\n');
  process.exit(0);
}
