/**
 * EO Graph Traversal Tests
 *
 * Tests the graph traversal engine with the Nashville investigation data.
 */

// Load modules (works in both Node.js and browser)
let GraphTraversalEngine, GraphOperator, Direction, CollectMode, loadNashvilleDemo;

if (typeof require !== 'undefined') {
  const mod = require('./eo_graph_traversal.js');
  GraphTraversalEngine = mod.GraphTraversalEngine;
  GraphOperator = mod.GraphOperator;
  Direction = mod.Direction;
  CollectMode = mod.CollectMode;
  loadNashvilleDemo = mod.loadNashvilleDemo;
} else {
  GraphTraversalEngine = window.GraphTraversalEngine;
  GraphOperator = window.GraphOperator;
  Direction = window.Direction;
  CollectMode = window.CollectMode;
  loadNashvilleDemo = window.loadNashvilleDemo;
}

// Test runner
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEqual(actual, expected, msg = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition, msg = '') {
  if (!condition) {
    throw new Error(msg || 'Assertion failed');
  }
}

async function runTests() {
  console.log('=== EO Graph Traversal Tests ===\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (err) {
      console.log(`✗ ${name}`);
      console.log(`  ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  return failed === 0;
}

// ============================================================================
// TESTS
// ============================================================================

test('EdgeIndex: basic node and edge indexing', () => {
  const engine = new GraphTraversalEngine();

  engine.addNode('a', 'person', { name: 'Alice' });
  engine.addNode('b', 'person', { name: 'Bob' });
  engine.addEdge('a', 'b', 'knows', { since: 2020 });

  const stats = engine.getStats();
  assertEqual(stats.nodeCount, 2);
  assertEqual(stats.edgeCount, 1);
});

test('EdgeIndex: traverse outgoing edges', () => {
  const engine = new GraphTraversalEngine();

  engine.addNode('a', 'person', { name: 'Alice' });
  engine.addNode('b', 'person', { name: 'Bob' });
  engine.addNode('c', 'person', { name: 'Carol' });
  engine.addEdge('a', 'b', 'knows', {});
  engine.addEdge('a', 'c', 'knows', {});

  const edges = engine.index.traverse('a', { direction: Direction.OUT });
  assertEqual(edges.length, 2);
});

test('EdgeIndex: traverse incoming edges', () => {
  const engine = new GraphTraversalEngine();

  engine.addNode('a', 'person', { name: 'Alice' });
  engine.addNode('b', 'person', { name: 'Bob' });
  engine.addEdge('a', 'b', 'knows', {});

  const edges = engine.index.traverse('b', { direction: Direction.IN });
  assertEqual(edges.length, 1);
  assertEqual(edges[0].from, 'a');
});

test('EdgeIndex: filter by edge type', () => {
  const engine = new GraphTraversalEngine();

  engine.addNode('a', 'person', { name: 'Alice' });
  engine.addNode('b', 'person', { name: 'Bob' });
  engine.addEdge('a', 'b', 'knows', {});
  engine.addEdge('a', 'b', 'worked_with', {});

  const knowsEdges = engine.index.traverse('a', {
    direction: Direction.OUT,
    edgeTypes: ['knows']
  });
  assertEqual(knowsEdges.length, 1);
  assertEqual(knowsEdges[0].type, 'knows');
});

test('Nashville demo: loads correctly', () => {
  const engine = new GraphTraversalEngine();
  const result = loadNashvilleDemo(engine);

  assertEqual(result.nodeCount, 9);
  assertEqual(result.edgeCount, 13);

  const stats = engine.getStats();
  assertTrue(stats.edgeTypes.includes('knows'));
  assertTrue(stats.edgeTypes.includes('employed_by'));
  assertTrue(stats.edgeTypes.includes('owns'));
});

test('Pipeline: SEG selects starting node', () => {
  const engine = new GraphTraversalEngine();
  loadNashvilleDemo(engine);

  const pipeline = [
    { op: GraphOperator.SEG, params: { nodeId: 'bob' } }
  ];

  const result = engine.execute(pipeline);
  assertEqual(result.nodeIds.length, 1);
  assertEqual(result.nodeIds[0], 'bob');
});

test('Pipeline: SEG filters by node type', () => {
  const engine = new GraphTraversalEngine();
  loadNashvilleDemo(engine);

  const pipeline = [
    { op: GraphOperator.SEG, params: { nodeType: 'contract' } }
  ];

  const result = engine.execute(pipeline);
  assertEqual(result.nodeIds.length, 2);
  assertTrue(result.nodeIds.includes('contract_1'));
  assertTrue(result.nodeIds.includes('contract_2'));
});

test('Pipeline: CON traverses one hop', () => {
  const engine = new GraphTraversalEngine();
  loadNashvilleDemo(engine);

  const pipeline = [
    { op: GraphOperator.SEG, params: { nodeId: 'bob' } },
    { op: GraphOperator.CON, params: { direction: Direction.OUT, edgeTypes: ['knows'] } }
  ];

  const result = engine.execute(pipeline);
  assertTrue(result.nodeIds.includes('carol'), 'Bob knows Carol');
});

test('Pipeline: REC finds nodes within 2 hops', () => {
  const engine = new GraphTraversalEngine();
  loadNashvilleDemo(engine);

  const result = engine.findWithinHops('bob', 2);

  // Bob's 1-hop: alice, carol, metro, contract_1 (via knows, employed_by, approved)
  // Plus 2-hop from those nodes
  assertTrue(result.nodeIds.length > 2, `Found ${result.nodeIds.length} nodes within 2 hops`);
  assertTrue(result.nodeIds.includes('carol'), 'Carol is within 2 hops');
});

test('Query 1: Bob → Acme LLC paths', () => {
  const engine = new GraphTraversalEngine();
  loadNashvilleDemo(engine);

  // Find all paths from Bob to Acme LLC
  const result = engine.findPaths('bob', 'acme_llc', { maxDepth: 6 });

  // Expected paths:
  // 1. bob -> knows -> carol -> owns -> acme_llc
  // 2. bob -> approved -> contract_1 -> paid_to -> acme_llc

  assertTrue(result.paths.length >= 1, `Found ${result.paths.length} paths`);

  // Check that at least one path reaches acme_llc
  const reachesTarget = result.paths.some(p =>
    p.nodeIds[p.nodeIds.length - 1] === 'acme_llc'
  );
  assertTrue(reachesTarget, 'At least one path reaches Acme LLC');

  console.log(`    Found ${result.paths.length} path(s) from Bob to Acme LLC:`);
  for (const path of result.paths) {
    console.log(`      ${path.nodeIds.join(' → ')} (${path.length} hops)`);
  }
});

test('Query 2: Contract approval conflicts (simplified)', () => {
  const engine = new GraphTraversalEngine();
  loadNashvilleDemo(engine);

  // Find people who approved contracts that benefit someone they know
  // Simplified: Find approvers of contract_1 and check if they know Carol (owner of Acme)

  // Step 1: Who approved contract_1?
  const approvers = engine.execute([
    { op: GraphOperator.SEG, params: { nodeId: 'contract_1' } },
    { op: GraphOperator.CON, params: { direction: Direction.IN, edgeTypes: ['approved'] } }
  ]);

  assertTrue(approvers.nodeIds.includes('bob'), 'Bob approved contract_1');

  // Step 2: Who owns the company that got paid?
  const beneficiaries = engine.execute([
    { op: GraphOperator.SEG, params: { nodeId: 'contract_1' } },
    { op: GraphOperator.CON, params: { direction: Direction.OUT, edgeTypes: ['paid_to'] } },
    { op: GraphOperator.CON, params: { direction: Direction.IN, edgeTypes: ['owns'] } }
  ]);

  assertTrue(beneficiaries.nodeIds.includes('carol'), 'Carol owns Acme which got paid');

  // Step 3: Does Bob know Carol?
  const bobKnows = engine.execute([
    { op: GraphOperator.SEG, params: { nodeId: 'bob' } },
    { op: GraphOperator.CON, params: { direction: Direction.OUT, edgeTypes: ['knows'] } }
  ]);

  assertTrue(bobKnows.nodeIds.includes('carol'), 'Bob knows Carol - CONFLICT!');

  console.log('    Conflict detected: Bob approved contract paid to company owned by Carol, whom he knows');
});

test('Query 3: People in Nashville', () => {
  const engine = new GraphTraversalEngine();
  loadNashvilleDemo(engine);

  const result = engine.execute([
    { op: GraphOperator.SEG, params: {
        nodeType: 'person',
        nodeFilter: { property: 'city', operator: '=', value: 'Nashville' }
      }
    }
  ]);

  assertEqual(result.nodeIds.length, 3); // Alice, Bob, Dave
  assertTrue(result.nodeIds.includes('alice'));
  assertTrue(result.nodeIds.includes('bob'));
  assertTrue(result.nodeIds.includes('dave'));
});

test('Pipeline: DES names intermediate result', () => {
  const engine = new GraphTraversalEngine();
  loadNashvilleDemo(engine);

  const result = engine.execute([
    { op: GraphOperator.SEG, params: { nodeId: 'bob' } },
    { op: GraphOperator.CON, params: { direction: Direction.BOTH } },
    { op: GraphOperator.DES, params: { as: 'bob_connections' } },
    { op: GraphOperator.CON, params: { direction: Direction.BOTH } }
  ]);

  assertTrue(result.namedResults.bob_connections !== undefined);
  assertTrue(result.namedResults.bob_connections.length > 0);
});

test('Pipeline: SYN counts nodes', () => {
  const engine = new GraphTraversalEngine();
  loadNashvilleDemo(engine);

  const result = engine.execute([
    { op: GraphOperator.SEG, params: { nodeType: 'person' } },
    { op: GraphOperator.SYN, params: { mode: 'count' } }
  ]);

  assertEqual(result.count, 4); // Alice, Bob, Carol, Dave
});

test('findPaths: handles no path case', () => {
  const engine = new GraphTraversalEngine();

  engine.addNode('a', 'person', {});
  engine.addNode('b', 'person', {});
  // No edge between them

  const result = engine.findPaths('a', 'b', { maxDepth: 3 });
  assertEqual(result.paths.length, 0);
});

test('findPaths: handles cycle prevention', () => {
  const engine = new GraphTraversalEngine();

  engine.addNode('a', 'person', {});
  engine.addNode('b', 'person', {});
  engine.addNode('c', 'person', {});
  engine.addEdge('a', 'b', 'knows', {});
  engine.addEdge('b', 'c', 'knows', {});
  engine.addEdge('c', 'a', 'knows', {}); // Creates cycle

  const result = engine.findPaths('a', 'c', { maxDepth: 5 });

  // Should find path a -> b -> c, not loop forever
  assertTrue(result.paths.length >= 1);
  // No path should contain a node twice
  for (const path of result.paths) {
    const uniqueNodes = new Set(path.nodeIds);
    assertEqual(uniqueNodes.size, path.nodeIds.length, 'No duplicate nodes in path');
  }
});

test('Complex query: 2-degree separation', () => {
  const engine = new GraphTraversalEngine();
  loadNashvilleDemo(engine);

  // Find everyone within 2 degrees of Carol via 'knows' edges
  const result = engine.execute([
    { op: GraphOperator.SEG, params: { nodeId: 'carol' } },
    {
      op: GraphOperator.REC,
      params: {
        pipeline: [
          { op: GraphOperator.CON, params: { direction: Direction.BOTH, edgeTypes: ['knows'] } },
          { op: GraphOperator.SEG, params: { excludeVisited: true } }
        ],
        until: { maxDepth: 2 },
        collect: CollectMode.NODES
      }
    }
  ]);

  // Carol knows: Bob (directly), Dave (directly)
  // Bob knows: Alice
  // Dave knows: Alice
  // So within 2 degrees: Bob, Dave, Alice
  assertTrue(result.nodeIds.includes('bob'), 'Bob is within 2 degrees');
  assertTrue(result.nodeIds.includes('dave'), 'Dave is within 2 degrees');
  assertTrue(result.nodeIds.includes('alice'), 'Alice is within 2 degrees');
});

// Run tests
runTests().then(success => {
  if (typeof process !== 'undefined') {
    process.exit(success ? 0 : 1);
  }
});
