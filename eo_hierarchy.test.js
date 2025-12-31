/**
 * Tests for EO Hierarchy - Content Creation from Imports to Views
 *
 * Run with: node eo_hierarchy.test.js
 *
 * Tests the complete hierarchy chain: SOURCE → SET → LENS → VIEW
 * Based on CORE_ARCHITECTURE.md specifications
 */

const hierarchy = require('./eo_hierarchy.js');

const {
  // Constants
  ViewTypes,
  ViewTypeInfo,
  PivotTypes,
  SourceTypes,

  // Factory functions
  createSource,
  createNullSource,
  createSet,
  createSetFromScratch,
  createLens,
  createDefaultLens,
  createTypeScopedLens,
  createView,

  // Utilities
  generateId,
  buildViewConfig,

  // Manager
  HierarchyManager,
  initHierarchyManager
} = hierarchy;

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
    throw new Error(`${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
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

function assertDefined(value, message = '') {
  if (value === undefined || value === null) {
    throw new Error(`${message} Expected defined value, got ${value}`);
  }
}

function assertStartsWith(str, prefix, message = '') {
  if (!str || !str.startsWith(prefix)) {
    throw new Error(`${message} Expected "${str}" to start with "${prefix}"`);
  }
}

function assertArrayLength(arr, length, message = '') {
  if (!Array.isArray(arr) || arr.length !== length) {
    throw new Error(`${message} Expected array length ${length}, got ${arr?.length}`);
  }
}

function assertContains(arr, item, message = '') {
  if (!arr || !arr.includes(item)) {
    throw new Error(`${message} Expected array to contain "${item}"`);
  }
}

function assertHasProperty(obj, prop, message = '') {
  if (!obj || !(prop in obj)) {
    throw new Error(`${message} Expected object to have property "${prop}"`);
  }
}

// ============================================================================
// Test Data Helpers
// ============================================================================

function createTestRecords() {
  return [
    { name: 'John Doe', email: 'john@example.com', amount: 100 },
    { name: 'Jane Smith', email: 'jane@example.com', amount: 200 },
    { name: 'Bob Wilson', email: 'bob@example.com', amount: 300 }
  ];
}

function createTestFields() {
  return [
    { name: 'name', type: 'text' },
    { name: 'email', type: 'email' },
    { name: 'amount', type: 'number' }
  ];
}

function createMixedTypeRecords() {
  return [
    { type: 'person', name: 'John', email: 'john@example.com' },
    { type: 'person', name: 'Jane', email: 'jane@example.com' },
    { type: 'company', name: 'Acme Inc', website: 'acme.com' },
    { type: 'company', name: 'TechCorp', website: 'techcorp.com' }
  ];
}

// ============================================================================
// Source Creation Tests
// ============================================================================

console.log('\n== SOURCE Creation Tests ==\n');

test('createSource - creates source with correct id prefix', () => {
  const source = createSource({
    name: 'Test Source',
    projectId: 'proj_001',
    sourceType: SourceTypes.FILE,
    records: createTestRecords()
  });
  assertStartsWith(source.id, 'src_', 'Source ID should start with src_');
});

test('createSource - marks source as GIVEN type', () => {
  const source = createSource({
    name: 'Test Source',
    projectId: 'proj_001',
    records: []
  });
  assertEqual(source.type, 'given', 'Source type should be "given"');
});

test('createSource - sets category to source_created', () => {
  const source = createSource({
    name: 'Test Source',
    projectId: 'proj_001',
    records: []
  });
  assertEqual(source.category, 'source_created', 'Category should be source_created');
});

test('createSource - stores records immutably', () => {
  const records = createTestRecords();
  const source = createSource({
    name: 'Test Source',
    projectId: 'proj_001',
    records
  });
  assertEqual(source.recordCount, 3, 'Should have 3 records');
  assertTrue(Object.isFrozen(source.records), 'Records should be frozen');
});

test('createSource - infers columns from records when rawSchema.columns not provided', () => {
  // Note: Must pass rawSchema without columns to trigger inference
  const source = createSource({
    name: 'Test Source',
    projectId: 'proj_001',
    rawSchema: { rowCount: 3 }, // No columns array - will infer from records
    records: createTestRecords()
  });
  assertTrue(source.payload.rawSchema.columns.length > 0, 'Should infer columns');
  assertContains(source.payload.rawSchema.columns, 'name', 'Should contain name column');
  assertContains(source.payload.rawSchema.columns, 'email', 'Should contain email column');
});

test('createSource - uses explicit rawSchema when provided', () => {
  const source = createSource({
    name: 'Test Source',
    projectId: 'proj_001',
    rawSchema: { columns: ['col1', 'col2'], rowCount: 100 },
    records: []
  });
  assertArrayLength(source.payload.rawSchema.columns, 2, 'Should use provided columns');
  assertEqual(source.payload.rawSchema.rowCount, 100, 'Should use provided rowCount');
});

test('createSource - initializes empty derivedSetIds', () => {
  const source = createSource({
    name: 'Test Source',
    projectId: 'proj_001',
    records: []
  });
  assertTrue(Array.isArray(source.derivedSetIds), 'derivedSetIds should be array');
  assertArrayLength(source.derivedSetIds, 0, 'derivedSetIds should be empty initially');
});

test('createSource - sets status to active', () => {
  const source = createSource({
    name: 'Test Source',
    projectId: 'proj_001',
    records: []
  });
  assertEqual(source.status, 'active', 'Status should be active');
});

test('createSource - includes timestamp', () => {
  const source = createSource({
    name: 'Test Source',
    projectId: 'proj_001',
    records: []
  });
  assertDefined(source.timestamp, 'Should have timestamp');
  assertTrue(source.timestamp.includes('T'), 'Timestamp should be ISO format');
});

test('createSource - uses provided actor', () => {
  const source = createSource({
    name: 'Test Source',
    projectId: 'proj_001',
    actor: 'user:michael',
    records: []
  });
  assertEqual(source.actor, 'user:michael', 'Should use provided actor');
});

test('createSource - defaults actor to current_user', () => {
  const source = createSource({
    name: 'Test Source',
    projectId: 'proj_001',
    records: []
  });
  assertEqual(source.actor, 'current_user', 'Should default to current_user');
});

// Null Source Tests
console.log('\n== NULL Source Tests ==\n');

test('createNullSource - creates source with null type', () => {
  const source = createNullSource({
    name: 'Blank Table',
    projectId: 'proj_001'
  });
  assertEqual(source.payload.sourceType, 'null', 'sourceType should be null');
});

test('createNullSource - has empty records', () => {
  const source = createNullSource({
    name: 'Blank Table',
    projectId: 'proj_001'
  });
  assertArrayLength(source.records, 0, 'Should have empty records');
  assertEqual(source.recordCount, 0, 'Record count should be 0');
});

test('createNullSource - has empty schema', () => {
  const source = createNullSource({
    name: 'Blank Table',
    projectId: 'proj_001'
  });
  assertArrayLength(source.payload.rawSchema.columns, 0, 'Should have empty columns');
  assertEqual(source.payload.rawSchema.rowCount, 0, 'Row count should be 0');
});

test('createNullSource - has null locator', () => {
  const source = createNullSource({
    name: 'Blank Table',
    projectId: 'proj_001'
  });
  assertEqual(source.payload.locator, null, 'Locator should be null');
});

test('createNullSource - is still GIVEN type', () => {
  const source = createNullSource({
    name: 'Blank Table',
    projectId: 'proj_001'
  });
  assertEqual(source.type, 'given', 'Even null source is GIVEN');
});

test('createNullSource - defaults name to Untitled Table', () => {
  const source = createNullSource({
    projectId: 'proj_001'
  });
  assertEqual(source.payload.name, 'Untitled Table', 'Should default name');
});

// ============================================================================
// Set Creation Tests
// ============================================================================

console.log('\n== SET Creation Tests ==\n');

test('createSet - creates set with correct id prefix', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set } = createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: createTestFields()
  });
  assertStartsWith(set.id, 'set_', 'Set ID should start with set_');
});

test('createSet - marks set as MEANT type', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set } = createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: []
  });
  assertEqual(set.type, 'meant', 'Set type should be meant');
});

test('createSet - has source binding with provenance', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set } = createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: []
  });
  assertArrayLength(set.payload.sourceBindings, 1, 'Should have one source binding');
  assertEqual(set.payload.sourceBindings[0].sourceId, source.id, 'Should reference source');
  assertContains(set.provenance, source.id, 'Provenance should contain source ID');
});

test('createSet - auto-creates default lens', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set, defaultLens } = createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: createTestFields()
  });
  assertDefined(defaultLens, 'Should create default lens');
  assertStartsWith(defaultLens.id, 'lens_', 'Lens ID should start with lens_');
  assertTrue(defaultLens.payload.isDefault, 'Lens should be marked as default');
});

test('createSet - auto-creates default view', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { defaultView } = createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: createTestFields()
  });
  assertDefined(defaultView, 'Should create default view');
  assertStartsWith(defaultView.id, 'view_', 'View ID should start with view_');
  assertEqual(defaultView.payload.viewType, 'grid', 'Default view should be grid');
});

test('createSet - links lens to set', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set, defaultLens } = createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: []
  });
  assertContains(set.lensIds, defaultLens.id, 'Set should reference lens');
});

test('createSet - generates field IDs', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set } = createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: [{ name: 'Field1', type: 'text' }]
  });
  const field = set.payload.schema.fields[0];
  assertStartsWith(field.id, 'fld_', 'Field ID should start with fld_');
});

test('createSet - preserves explicit field IDs', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set } = createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: [{ id: 'fld_custom_id', name: 'Field1', type: 'text' }]
  });
  assertEqual(set.payload.schema.fields[0].id, 'fld_custom_id', 'Should preserve custom ID');
});

test('createSet - first field is primary by default', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set } = createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: createTestFields()
  });
  assertTrue(set.payload.schema.fields[0].isPrimary, 'First field should be primary');
  assertFalse(set.payload.schema.fields[1].isPrimary, 'Second field should not be primary');
});

test('createSet - respects explicit isPrimary true on non-first field', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set } = createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: [
      { name: 'First', type: 'text' },  // Will be primary by default (index 0)
      { name: 'Second', type: 'text', isPrimary: true }  // Explicitly primary
    ]
  });
  // Note: Implementation uses `field.isPrimary || index === 0`, so first field is always primary
  // when no explicit isPrimary is set, and explicit isPrimary: true is respected
  assertTrue(set.payload.schema.fields[0].isPrimary, 'First field is primary by default');
  assertTrue(set.payload.schema.fields[1].isPrimary, 'Second field respects explicit true');
});

test('createSet - transforms records with field IDs', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set } = createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: [{ id: 'fld_name', name: 'name', type: 'text' }],
    records: [{ name: 'John' }]
  });
  assertEqual(set.recordCount, 1, 'Should have 1 record');
  assertDefined(set.records[0].values, 'Record should have values object');
  assertEqual(set.records[0].values.fld_name, 'John', 'Should map value to field ID');
});

test('createSet - assigns record IDs', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set } = createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: [{ name: 'name', type: 'text' }],
    records: [{ name: 'John' }, { name: 'Jane' }]
  });
  assertStartsWith(set.records[0].id, 'rec_', 'Record should have generated ID');
  assertTrue(set.records[0].id !== set.records[1].id, 'Records should have unique IDs');
});

// createSetFromScratch Tests
console.log('\n== SET from Scratch Tests ==\n');

test('createSetFromScratch - creates complete chain', () => {
  const { source, set, defaultLens, defaultView } = createSetFromScratch({
    name: 'New Table',
    projectId: 'proj_001'
  });
  assertDefined(source, 'Should create source');
  assertDefined(set, 'Should create set');
  assertDefined(defaultLens, 'Should create lens');
  assertDefined(defaultView, 'Should create view');
});

test('createSetFromScratch - source is null type', () => {
  const { source } = createSetFromScratch({
    name: 'New Table',
    projectId: 'proj_001'
  });
  assertEqual(source.payload.sourceType, 'null', 'Source should be null type');
});

test('createSetFromScratch - set bound to source', () => {
  const { source, set } = createSetFromScratch({
    name: 'New Table',
    projectId: 'proj_001'
  });
  assertEqual(set.payload.sourceBindings[0].sourceId, source.id, 'Set should bind to source');
});

test('createSetFromScratch - has default Name field', () => {
  const { set } = createSetFromScratch({
    name: 'New Table',
    projectId: 'proj_001'
  });
  assertEqual(set.payload.schema.fields[0].name, 'Name', 'Should have Name field');
  assertEqual(set.payload.schema.fields[0].type, 'text', 'Name field should be text');
});

test('createSetFromScratch - accepts custom fields', () => {
  const { set } = createSetFromScratch({
    name: 'New Table',
    projectId: 'proj_001',
    fields: [
      { name: 'Title', type: 'text' },
      { name: 'Amount', type: 'number' }
    ]
  });
  assertArrayLength(set.payload.schema.fields, 2, 'Should have 2 fields');
  assertEqual(set.payload.schema.fields[1].name, 'Amount', 'Should have Amount field');
});

test('createSetFromScratch - starts with empty records', () => {
  const { set } = createSetFromScratch({
    name: 'New Table',
    projectId: 'proj_001'
  });
  assertEqual(set.recordCount, 0, 'Should start with 0 records');
});

test('createSetFromScratch - names source appropriately', () => {
  const { source } = createSetFromScratch({
    name: 'My Table',
    projectId: 'proj_001'
  });
  assertEqual(source.payload.name, 'My Table (source)', 'Source name should include (source)');
});

// ============================================================================
// Lens Creation Tests
// ============================================================================

console.log('\n== LENS Creation Tests ==\n');

test('createLens - creates lens with correct id prefix', () => {
  const { lens } = createLens({
    name: 'Test Lens',
    setId: 'set_001',
    projectId: 'proj_001'
  });
  assertStartsWith(lens.id, 'lens_', 'Lens ID should start with lens_');
});

test('createLens - marks lens as MEANT type', () => {
  const { lens } = createLens({
    name: 'Test Lens',
    setId: 'set_001',
    projectId: 'proj_001'
  });
  assertEqual(lens.type, 'meant', 'Lens type should be meant');
});

test('createLens - has set in provenance', () => {
  const { lens } = createLens({
    name: 'Test Lens',
    setId: 'set_001',
    projectId: 'proj_001'
  });
  assertContains(lens.provenance, 'set_001', 'Provenance should contain set ID');
});

test('createLens - auto-creates grid view', () => {
  const { lens, view } = createLens({
    name: 'Test Lens',
    setId: 'set_001',
    projectId: 'proj_001'
  });
  assertDefined(view, 'Should create default view');
  assertEqual(view.payload.viewType, 'grid', 'Default view should be grid');
  assertContains(lens.viewIds, view.id, 'Lens should reference view');
});

test('createLens - supports includedFields as array', () => {
  const { lens } = createLens({
    name: 'Test Lens',
    setId: 'set_001',
    projectId: 'proj_001',
    includedFields: ['fld_001', 'fld_002']
  });
  assertArrayLength(lens.payload.includedFields, 2, 'Should have 2 included fields');
});

test('createLens - supports includedFields as "all"', () => {
  const { lens } = createLens({
    name: 'Test Lens',
    setId: 'set_001',
    projectId: 'proj_001',
    includedFields: 'all'
  });
  assertEqual(lens.payload.includedFields, 'all', 'Should accept "all"');
});

test('createLens - stores pivot configuration', () => {
  const pivot = { type: 'filter', predicate: { field: 'fld_status', op: 'eq', value: 'active' } };
  const { lens } = createLens({
    name: 'Active Items',
    setId: 'set_001',
    projectId: 'proj_001',
    pivot
  });
  assertEqual(lens.payload.pivot.type, 'filter', 'Should store pivot type');
  assertEqual(lens.payload.pivot.predicate.value, 'active', 'Should store predicate');
});

test('createLens - stores field overrides', () => {
  const fieldOverrides = { fld_001: { width: 300, hidden: true } };
  const { lens } = createLens({
    name: 'Test Lens',
    setId: 'set_001',
    projectId: 'proj_001',
    fieldOverrides
  });
  assertEqual(lens.payload.fieldOverrides.fld_001.width, 300, 'Should store field override');
});

// createDefaultLens Tests
test('createDefaultLens - marks as default', () => {
  const { lens } = createDefaultLens({
    name: 'All Items',
    setId: 'set_001',
    projectId: 'proj_001',
    fields: []
  });
  assertTrue(lens.payload.isDefault, 'Should be marked as default');
});

test('createDefaultLens - has null pivot (pass-through)', () => {
  const { lens } = createDefaultLens({
    name: 'All Items',
    setId: 'set_001',
    projectId: 'proj_001',
    fields: []
  });
  assertEqual(lens.payload.pivot, null, 'Default lens should have null pivot');
});

test('createDefaultLens - includes all fields', () => {
  const { lens } = createDefaultLens({
    name: 'All Items',
    setId: 'set_001',
    projectId: 'proj_001',
    fields: []
  });
  assertEqual(lens.payload.includedFields, 'all', 'Should include all fields');
});

// createTypeScopedLens Tests
console.log('\n== Type-Scoped LENS Tests ==\n');

test('createTypeScopedLens - creates filter pivot', () => {
  const { lens } = createTypeScopedLens({
    name: 'People',
    setId: 'set_001',
    projectId: 'proj_001',
    typeField: 'fld_type',
    typeValue: 'person',
    includedFields: ['fld_name', 'fld_email']
  });
  assertEqual(lens.payload.pivot.type, 'filter', 'Should have filter pivot');
  assertEqual(lens.payload.pivot.predicate.field, 'fld_type', 'Should filter on type field');
  assertEqual(lens.payload.pivot.predicate.value, 'person', 'Should filter on type value');
});

test('createTypeScopedLens - creates selector for multi-lens membership', () => {
  const { lens } = createTypeScopedLens({
    name: 'Companies',
    setId: 'set_001',
    projectId: 'proj_001',
    typeField: 'fld_type',
    typeValue: 'company',
    includedFields: ['fld_name', 'fld_website']
  });
  assertDefined(lens.payload.selector, 'Should have selector');
  assertEqual(lens.payload.selector.type, 'field_match', 'Selector type should be field_match');
  assertEqual(lens.payload.selector.value, 'company', 'Selector should match company');
});

test('createTypeScopedLens - is not marked as default', () => {
  const { lens } = createTypeScopedLens({
    name: 'People',
    setId: 'set_001',
    projectId: 'proj_001',
    typeField: 'fld_type',
    typeValue: 'person',
    includedFields: ['fld_name']
  });
  assertFalse(lens.payload.isDefault, 'Type-scoped lens should not be default');
});

test('createTypeScopedLens - includes specified fields only', () => {
  const includedFields = ['fld_name', 'fld_email'];
  const { lens } = createTypeScopedLens({
    name: 'People',
    setId: 'set_001',
    projectId: 'proj_001',
    typeField: 'fld_type',
    typeValue: 'person',
    includedFields
  });
  assertArrayLength(lens.payload.includedFields, 2, 'Should have 2 included fields');
});

// ============================================================================
// View Creation Tests
// ============================================================================

console.log('\n== VIEW Creation Tests ==\n');

test('createView - creates view with correct id prefix', () => {
  const view = createView({
    name: 'Test View',
    lensId: 'lens_001',
    projectId: 'proj_001',
    viewType: ViewTypes.GRID
  });
  assertStartsWith(view.id, 'view_', 'View ID should start with view_');
});

test('createView - marks view as MEANT type', () => {
  const view = createView({
    name: 'Test View',
    lensId: 'lens_001',
    projectId: 'proj_001'
  });
  assertEqual(view.type, 'meant', 'View type should be meant');
});

test('createView - has lens in provenance', () => {
  const view = createView({
    name: 'Test View',
    lensId: 'lens_001',
    projectId: 'proj_001'
  });
  assertContains(view.provenance, 'lens_001', 'Provenance should contain lens ID');
});

test('createView - defaults to grid view type', () => {
  const view = createView({
    name: 'Test View',
    lensId: 'lens_001',
    projectId: 'proj_001'
  });
  assertEqual(view.payload.viewType, 'grid', 'Should default to grid');
});

// Test all view types
console.log('\n== VIEW Type Tests ==\n');

test('createView - GRID view has correct config', () => {
  const view = createView({
    name: 'Grid View',
    lensId: 'lens_001',
    projectId: 'proj_001',
    viewType: ViewTypes.GRID,
    config: { fieldWidths: { fld_001: 200 }, rowHeight: 'large' }
  });
  assertEqual(view.payload.viewType, 'grid', 'Should be grid type');
  assertEqual(view.payload.config.fieldWidths.fld_001, 200, 'Should have field width');
  assertEqual(view.payload.config.rowHeight, 'large', 'Should have row height');
});

test('createView - CARDS view has correct config', () => {
  const view = createView({
    name: 'Cards View',
    lensId: 'lens_001',
    projectId: 'proj_001',
    viewType: ViewTypes.CARDS,
    config: {
      cardTitleField: 'fld_name',
      cardDescriptionField: 'fld_desc',
      cardImageField: 'fld_image'
    }
  });
  assertEqual(view.payload.viewType, 'cards', 'Should be cards type');
  assertEqual(view.payload.config.cardTitleField, 'fld_name', 'Should have title field');
  assertEqual(view.payload.config.cardImageField, 'fld_image', 'Should have image field');
});

test('createView - KANBAN view has correct config', () => {
  const view = createView({
    name: 'Kanban View',
    lensId: 'lens_001',
    projectId: 'proj_001',
    viewType: ViewTypes.KANBAN,
    config: {
      statusField: 'fld_status',
      columnOrder: ['todo', 'in_progress', 'done'],
      cardTitleField: 'fld_title'
    }
  });
  assertEqual(view.payload.viewType, 'kanban', 'Should be kanban type');
  assertEqual(view.payload.config.statusField, 'fld_status', 'Should have status field');
  assertArrayLength(view.payload.config.columnOrder, 3, 'Should have 3 columns');
});

test('createView - CALENDAR view has correct config', () => {
  const view = createView({
    name: 'Calendar View',
    lensId: 'lens_001',
    projectId: 'proj_001',
    viewType: ViewTypes.CALENDAR,
    config: {
      dateField: 'fld_date',
      endDateField: 'fld_end_date',
      eventTitleField: 'fld_title'
    }
  });
  assertEqual(view.payload.viewType, 'calendar', 'Should be calendar type');
  assertEqual(view.payload.config.dateField, 'fld_date', 'Should have date field');
  assertEqual(view.payload.config.endDateField, 'fld_end_date', 'Should have end date field');
});

test('createView - GRAPH view has correct config', () => {
  const view = createView({
    name: 'Graph View',
    lensId: 'lens_001',
    projectId: 'proj_001',
    viewType: ViewTypes.GRAPH,
    config: {
      linkFields: ['fld_parent', 'fld_related'],
      nodeLabel: 'fld_name',
      layout: 'force'
    }
  });
  assertEqual(view.payload.viewType, 'graph', 'Should be graph type');
  assertArrayLength(view.payload.config.linkFields, 2, 'Should have 2 link fields');
  assertEqual(view.payload.config.layout, 'force', 'Should have layout');
});

test('createView - TIMELINE view has correct config', () => {
  const view = createView({
    name: 'Timeline View',
    lensId: 'lens_001',
    projectId: 'proj_001',
    viewType: ViewTypes.TIMELINE,
    config: {
      dateField: 'fld_date',
      titleField: 'fld_title'
    }
  });
  assertEqual(view.payload.viewType, 'timeline', 'Should be timeline type');
  assertEqual(view.payload.config.dateField, 'fld_date', 'Should have date field');
  assertEqual(view.payload.config.titleField, 'fld_title', 'Should have title field');
});

test('createView - preserves filters and sort in config', () => {
  const view = createView({
    name: 'Filtered View',
    lensId: 'lens_001',
    projectId: 'proj_001',
    viewType: ViewTypes.GRID,
    config: {
      filters: [{ field: 'fld_status', op: 'eq', value: 'active' }],
      sort: [{ field: 'fld_name', direction: 'asc' }]
    }
  });
  assertArrayLength(view.payload.config.filters, 1, 'Should have 1 filter');
  assertArrayLength(view.payload.config.sort, 1, 'Should have 1 sort');
});

// ============================================================================
// buildViewConfig Tests
// ============================================================================

console.log('\n== buildViewConfig Tests ==\n');

test('buildViewConfig - provides defaults for missing config', () => {
  const config = buildViewConfig(ViewTypes.GRID, {});
  assertTrue(Array.isArray(config.visibleFields), 'Should have visibleFields array');
  assertTrue(Array.isArray(config.filters), 'Should have filters array');
  assertTrue(Array.isArray(config.sort), 'Should have sort array');
});

test('buildViewConfig - grid has fieldWidths and rowHeight', () => {
  const config = buildViewConfig(ViewTypes.GRID, {});
  assertHasProperty(config, 'fieldWidths', 'Grid should have fieldWidths');
  assertEqual(config.rowHeight, 'medium', 'Grid should default to medium rowHeight');
});

test('buildViewConfig - kanban has required fields', () => {
  const config = buildViewConfig(ViewTypes.KANBAN, {});
  assertHasProperty(config, 'statusField', 'Kanban should have statusField');
  assertHasProperty(config, 'columnOrder', 'Kanban should have columnOrder');
  assertHasProperty(config, 'cardTitleField', 'Kanban should have cardTitleField');
});

test('buildViewConfig - graph has required fields', () => {
  const config = buildViewConfig(ViewTypes.GRAPH, {});
  assertHasProperty(config, 'linkFields', 'Graph should have linkFields');
  assertHasProperty(config, 'nodeLabel', 'Graph should have nodeLabel');
  assertEqual(config.layout, 'dagre', 'Graph should default to dagre layout');
});

// ============================================================================
// HierarchyManager Tests
// ============================================================================

console.log('\n== HierarchyManager Tests ==\n');

test('HierarchyManager - initializes with empty storage', () => {
  const manager = new HierarchyManager();
  assertEqual(manager.sources.size, 0, 'Should have no sources');
  assertEqual(manager.sets.size, 0, 'Should have no sets');
  assertEqual(manager.lenses.size, 0, 'Should have no lenses');
  assertEqual(manager.views.size, 0, 'Should have no views');
});

test('HierarchyManager - createSource stores source', () => {
  const manager = new HierarchyManager();
  const source = manager.createSource({
    name: 'Test Source',
    projectId: 'proj_001',
    records: createTestRecords()
  });
  assertEqual(manager.sources.size, 1, 'Should have 1 source');
  assertEqual(manager.getSource(source.id).id, source.id, 'Should retrieve source');
});

test('HierarchyManager - createNullSource stores source', () => {
  const manager = new HierarchyManager();
  const source = manager.createNullSource({
    name: 'Blank Table',
    projectId: 'proj_001'
  });
  assertEqual(manager.sources.size, 1, 'Should have 1 source');
  assertEqual(source.payload.sourceType, 'null', 'Should be null type');
});

test('HierarchyManager - createSet validates source exists', () => {
  const manager = new HierarchyManager();
  let threw = false;
  try {
    manager.createSet({
      name: 'Test Set',
      projectId: 'proj_001',
      sourceId: 'nonexistent_source',
      fields: []
    });
  } catch (e) {
    threw = true;
    assertTrue(e.message.includes('not found'), 'Should mention source not found');
  }
  assertTrue(threw, 'Should throw for nonexistent source');
});

test('HierarchyManager - createSet stores set, lens, and view', () => {
  const manager = new HierarchyManager();
  const source = manager.createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set, defaultLens, defaultView } = manager.createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: createTestFields()
  });
  assertEqual(manager.sets.size, 1, 'Should have 1 set');
  assertEqual(manager.lenses.size, 1, 'Should have 1 lens');
  assertEqual(manager.views.size, 1, 'Should have 1 view');
});

test('HierarchyManager - createSetFromScratch creates complete chain', () => {
  const manager = new HierarchyManager();
  const { source, set, defaultLens, defaultView } = manager.createSetFromScratch({
    name: 'New Table',
    projectId: 'proj_001'
  });
  assertEqual(manager.sources.size, 1, 'Should have 1 source');
  assertEqual(manager.sets.size, 1, 'Should have 1 set');
  assertEqual(manager.lenses.size, 1, 'Should have 1 lens');
  assertEqual(manager.views.size, 1, 'Should have 1 view');
});

test('HierarchyManager - createLens validates set exists', () => {
  const manager = new HierarchyManager();
  let threw = false;
  try {
    manager.createLens({
      name: 'Test Lens',
      setId: 'nonexistent_set',
      projectId: 'proj_001'
    });
  } catch (e) {
    threw = true;
    assertTrue(e.message.includes('not found'), 'Should mention set not found');
  }
  assertTrue(threw, 'Should throw for nonexistent set');
});

test('HierarchyManager - createLens adds lens to set', () => {
  const manager = new HierarchyManager();
  const { set } = manager.createSetFromScratch({ name: 'Table', projectId: 'proj_001' });
  const { lens } = manager.createLens({
    name: 'Custom Lens',
    setId: set.id,
    projectId: 'proj_001'
  });
  assertEqual(manager.lenses.size, 2, 'Should have 2 lenses (default + custom)');
  assertTrue(set.lensIds.includes(lens.id), 'Set should reference new lens');
});

test('HierarchyManager - createView validates lens exists', () => {
  const manager = new HierarchyManager();
  let threw = false;
  try {
    manager.createView({
      name: 'Test View',
      lensId: 'nonexistent_lens',
      projectId: 'proj_001'
    });
  } catch (e) {
    threw = true;
    assertTrue(e.message.includes('not found'), 'Should mention lens not found');
  }
  assertTrue(threw, 'Should throw for nonexistent lens');
});

test('HierarchyManager - createView adds view to lens', () => {
  const manager = new HierarchyManager();
  const { defaultLens } = manager.createSetFromScratch({ name: 'Table', projectId: 'proj_001' });
  const view = manager.createView({
    name: 'Kanban View',
    lensId: defaultLens.id,
    projectId: 'proj_001',
    viewType: ViewTypes.KANBAN
  });
  assertEqual(manager.views.size, 2, 'Should have 2 views');
  assertTrue(defaultLens.viewIds.includes(view.id), 'Lens should reference new view');
});

test('HierarchyManager - getChainForView returns complete chain', () => {
  const manager = new HierarchyManager();
  const { source, set, defaultLens, defaultView } = manager.createSetFromScratch({
    name: 'Test Table',
    projectId: 'proj_001'
  });
  const chain = manager.getChainForView(defaultView.id);
  assertDefined(chain, 'Should return chain');
  assertEqual(chain.source.id, source.id, 'Chain should have source');
  assertEqual(chain.set.id, set.id, 'Chain should have set');
  assertEqual(chain.lens.id, defaultLens.id, 'Chain should have lens');
  assertEqual(chain.view.id, defaultView.id, 'Chain should have view');
});

test('HierarchyManager - getLensesForSet returns all lenses', () => {
  const manager = new HierarchyManager();
  const { set } = manager.createSetFromScratch({ name: 'Table', projectId: 'proj_001' });
  manager.createLens({ name: 'Lens 2', setId: set.id, projectId: 'proj_001' });
  manager.createLens({ name: 'Lens 3', setId: set.id, projectId: 'proj_001' });
  const lenses = manager.getLensesForSet(set.id);
  assertEqual(lenses.length, 3, 'Should have 3 lenses');
});

test('HierarchyManager - getDefaultLensForSet returns default lens', () => {
  const manager = new HierarchyManager();
  const { set, defaultLens } = manager.createSetFromScratch({ name: 'Table', projectId: 'proj_001' });
  manager.createLens({ name: 'Custom Lens', setId: set.id, projectId: 'proj_001' });
  const foundLens = manager.getDefaultLensForSet(set.id);
  assertEqual(foundLens.id, defaultLens.id, 'Should find default lens');
  assertTrue(foundLens.payload.isDefault, 'Found lens should be marked default');
});

test('HierarchyManager - getViewsForLens returns all views', () => {
  const manager = new HierarchyManager();
  const { defaultLens } = manager.createSetFromScratch({ name: 'Table', projectId: 'proj_001' });
  manager.createView({ name: 'View 2', lensId: defaultLens.id, projectId: 'proj_001' });
  manager.createView({ name: 'View 3', lensId: defaultLens.id, projectId: 'proj_001' });
  const views = manager.getViewsForLens(defaultLens.id);
  assertEqual(views.length, 3, 'Should have 3 views');
});

test('HierarchyManager - updateView updates view config', () => {
  const manager = new HierarchyManager();
  const { defaultView } = manager.createSetFromScratch({ name: 'Table', projectId: 'proj_001' });
  manager.updateView(defaultView.id, {
    name: 'Updated View',
    config: { rowHeight: 'large' }
  });
  const updated = manager.getView(defaultView.id);
  assertEqual(updated.payload.name, 'Updated View', 'Name should be updated');
  assertEqual(updated.payload.config.rowHeight, 'large', 'Config should be updated');
});

test('HierarchyManager - navigateToView sets active selections', () => {
  const manager = new HierarchyManager();
  const { set, defaultLens, defaultView } = manager.createSetFromScratch({
    name: 'Table',
    projectId: 'proj_001'
  });
  manager.navigateToView(defaultView.id);
  assertEqual(manager.activeSetId, set.id, 'Active set should be set');
  assertEqual(manager.activeLensId, defaultLens.id, 'Active lens should be set');
  assertEqual(manager.activeViewId, defaultView.id, 'Active view should be set');
});

// ============================================================================
// Import Data Tests
// ============================================================================

console.log('\n== Import Data Tests ==\n');

test('HierarchyManager - importData creates complete hierarchy', () => {
  const manager = new HierarchyManager();
  const result = manager.importData({
    name: 'Imported Data',
    projectId: 'proj_001',
    records: createTestRecords(),
    schema: { fields: createTestFields() },
    actor: 'user:importer'
  });
  assertDefined(result.source, 'Should create source');
  assertDefined(result.set, 'Should create set');
  assertDefined(result.defaultLens, 'Should create default lens');
  assertDefined(result.defaultView, 'Should create default view');
});

test('HierarchyManager - importData source is file type', () => {
  const manager = new HierarchyManager();
  const result = manager.importData({
    name: 'Imported Data',
    projectId: 'proj_001',
    records: createTestRecords(),
    schema: { fields: createTestFields() }
  });
  assertEqual(result.source.payload.sourceType, 'file', 'Source should be file type');
});

test('HierarchyManager - importData with multi-record creates type lenses', () => {
  const manager = new HierarchyManager();
  const result = manager.importData({
    name: 'Mixed Data',
    projectId: 'proj_001',
    records: createMixedTypeRecords(),
    schema: { fields: [
      { name: 'type', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'email', type: 'email' },
      { name: 'website', type: 'url' }
    ]},
    multiRecordAnalysis: {
      typeField: 'fld_type',
      types: [
        { value: 'person', commonFields: ['fld_name'], specificFields: ['fld_email'] },
        { value: 'company', commonFields: ['fld_name'], specificFields: ['fld_website'] }
      ]
    }
  });
  assertEqual(result.typeLenses.length, 2, 'Should create 2 type lenses');
});

// ============================================================================
// Export/Import Tests
// ============================================================================

console.log('\n== Export/Import Tests ==\n');

test('HierarchyManager - export includes all data', () => {
  const manager = new HierarchyManager();
  manager.createSetFromScratch({ name: 'Table 1', projectId: 'proj_001' });
  manager.createSetFromScratch({ name: 'Table 2', projectId: 'proj_001' });
  const exported = manager.export();
  assertEqual(exported.version, '3.0', 'Should have version');
  assertEqual(exported.sources.length, 2, 'Should have 2 sources');
  assertEqual(exported.sets.length, 2, 'Should have 2 sets');
  assertEqual(exported.lenses.length, 2, 'Should have 2 lenses');
  assertEqual(exported.views.length, 2, 'Should have 2 views');
});

test('HierarchyManager - import restores data', () => {
  const manager1 = new HierarchyManager();
  manager1.createSetFromScratch({ name: 'Table 1', projectId: 'proj_001' });
  const exported = manager1.export();

  const manager2 = new HierarchyManager();
  manager2.import(exported);
  assertEqual(manager2.sources.size, 1, 'Should restore source');
  assertEqual(manager2.sets.size, 1, 'Should restore set');
  assertEqual(manager2.lenses.size, 1, 'Should restore lens');
  assertEqual(manager2.views.size, 1, 'Should restore view');
});

test('HierarchyManager - getStats returns correct counts', () => {
  const manager = new HierarchyManager();
  manager.createSetFromScratch({ name: 'Table', projectId: 'proj_001' });
  const stats = manager.getStats();
  assertEqual(stats.sources, 1, 'Should count sources');
  assertEqual(stats.sets, 1, 'Should count sets');
  assertEqual(stats.lenses, 1, 'Should count lenses');
  assertEqual(stats.views, 1, 'Should count views');
});

// ============================================================================
// Subscription Tests
// ============================================================================

console.log('\n== Subscription Tests ==\n');

test('HierarchyManager - subscribe receives notifications', () => {
  const manager = new HierarchyManager();
  const events = [];
  manager.subscribe((type, data) => events.push({ type, data }));
  manager.createSetFromScratch({ name: 'Table', projectId: 'proj_001' });
  assertTrue(events.length > 0, 'Should receive events');
  assertTrue(events.some(e => e.type === 'scratch_set_created'), 'Should receive scratch_set_created');
});

test('HierarchyManager - unsubscribe stops notifications', () => {
  const manager = new HierarchyManager();
  const events = [];
  const unsubscribe = manager.subscribe((type) => events.push(type));
  manager.createSetFromScratch({ name: 'Table 1', projectId: 'proj_001' });
  const countAfterFirst = events.length;
  unsubscribe();
  manager.createSetFromScratch({ name: 'Table 2', projectId: 'proj_001' });
  assertEqual(events.length, countAfterFirst, 'Should not receive more events after unsubscribe');
});

// ============================================================================
// Constants Tests
// ============================================================================

console.log('\n== Constants Tests ==\n');

test('ViewTypes - has all expected types', () => {
  assertEqual(ViewTypes.GRID, 'grid', 'Should have GRID');
  assertEqual(ViewTypes.CARDS, 'cards', 'Should have CARDS');
  assertEqual(ViewTypes.KANBAN, 'kanban', 'Should have KANBAN');
  assertEqual(ViewTypes.CALENDAR, 'calendar', 'Should have CALENDAR');
  assertEqual(ViewTypes.GRAPH, 'graph', 'Should have GRAPH');
  assertEqual(ViewTypes.TIMELINE, 'timeline', 'Should have TIMELINE');
});

test('ViewTypes - is frozen', () => {
  assertTrue(Object.isFrozen(ViewTypes), 'ViewTypes should be frozen');
});

test('ViewTypeInfo - has metadata for all types', () => {
  for (const type of Object.values(ViewTypes)) {
    assertDefined(ViewTypeInfo[type], `Should have info for ${type}`);
    assertDefined(ViewTypeInfo[type].icon, `Should have icon for ${type}`);
    assertDefined(ViewTypeInfo[type].label, `Should have label for ${type}`);
    assertDefined(ViewTypeInfo[type].description, `Should have description for ${type}`);
  }
});

test('SourceTypes - has all expected types', () => {
  assertEqual(SourceTypes.FILE, 'file', 'Should have FILE');
  assertEqual(SourceTypes.API, 'api', 'Should have API');
  assertEqual(SourceTypes.SCRAPE, 'scrape', 'Should have SCRAPE');
  assertEqual(SourceTypes.NULL, 'null', 'Should have NULL');
});

test('PivotTypes - has all expected types', () => {
  assertEqual(PivotTypes.NONE, null, 'Should have NONE as null');
  assertEqual(PivotTypes.FILTER, 'filter', 'Should have FILTER');
  assertEqual(PivotTypes.GROUP, 'group', 'Should have GROUP');
  assertEqual(PivotTypes.EXTRACT, 'extract', 'Should have EXTRACT');
});

// ============================================================================
// ID Generation Tests
// ============================================================================

console.log('\n== ID Generation Tests ==\n');

test('generateId - creates unique IDs', () => {
  const id1 = generateId('test');
  const id2 = generateId('test');
  assertTrue(id1 !== id2, 'IDs should be unique');
});

test('generateId - uses provided prefix', () => {
  const id = generateId('custom');
  assertStartsWith(id, 'custom_', 'Should use provided prefix');
});

// ============================================================================
// Provenance Chain Tests
// ============================================================================

console.log('\n== Provenance Chain Tests ==\n');

test('Provenance - View traces to Lens', () => {
  const { lens, view } = createLens({
    name: 'Test Lens',
    setId: 'set_001',
    projectId: 'proj_001'
  });
  assertContains(view.provenance, lens.id, 'View should trace to lens');
});

test('Provenance - Lens traces to Set', () => {
  const { lens } = createLens({
    name: 'Test Lens',
    setId: 'set_001',
    projectId: 'proj_001'
  });
  assertContains(lens.provenance, 'set_001', 'Lens should trace to set');
});

test('Provenance - Set traces to Source', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set } = createSet({
    name: 'Test Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: []
  });
  assertContains(set.provenance, source.id, 'Set should trace to source');
});

test('Provenance - complete chain is traceable', () => {
  const manager = new HierarchyManager();
  const { source, set, defaultLens, defaultView } = manager.createSetFromScratch({
    name: 'Test Table',
    projectId: 'proj_001'
  });

  // View → Lens
  assertContains(defaultView.provenance, defaultLens.id, 'View should trace to lens');

  // Lens → Set
  assertContains(defaultLens.provenance, set.id, 'Lens should trace to set');

  // Set → Source
  assertContains(set.provenance, source.id, 'Set should trace to source');
});

// ============================================================================
// Edge Cases
// ============================================================================

console.log('\n== Edge Cases ==\n');

test('createSet - handles empty fields array', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set } = createSet({
    name: 'Empty Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: []
  });
  assertArrayLength(set.payload.schema.fields, 0, 'Should have no fields');
});

test('createSet - handles empty records array', () => {
  const source = createNullSource({ name: 'Source', projectId: 'proj_001' });
  const { set } = createSet({
    name: 'Empty Set',
    projectId: 'proj_001',
    sourceId: source.id,
    fields: createTestFields(),
    records: []
  });
  assertEqual(set.recordCount, 0, 'Should have no records');
});

test('createLens - handles empty fields for view config', () => {
  const { view } = createLens({
    name: 'Test Lens',
    setId: 'set_001',
    projectId: 'proj_001',
    fields: []
  });
  assertTrue(Array.isArray(view.payload.config.visibleFields), 'Should have visibleFields');
});

test('HierarchyManager - getChainForView returns null for nonexistent view', () => {
  const manager = new HierarchyManager();
  const chain = manager.getChainForView('nonexistent_view');
  assertEqual(chain, null, 'Should return null');
});

test('HierarchyManager - getAllSources filters inactive sources', () => {
  const manager = new HierarchyManager();
  const source = manager.createNullSource({ name: 'Source', projectId: 'proj_001' });
  // Note: Sources are frozen, so this tests the filter logic
  const allSources = manager.getAllSources();
  assertTrue(allSources.length >= 1, 'Should have at least 1 active source');
  assertTrue(allSources.every(s => s.status === 'active'), 'All should be active');
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
