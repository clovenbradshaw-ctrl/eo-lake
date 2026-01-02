/**
 * EO Formula Engine - Pipeline-Based Formula Evaluation System
 *
 * Implements the EO (Epistemic Objects) paradigm for formula evaluation where:
 * - All formulas are pipelines of typed operators
 * - Nodes exist in a unified relational graph
 * - Dependencies are extracted at definition time
 * - Every transformation step is inspectable
 *
 * Pipeline Operators:
 * - CON (Connect): Establish relational reach to another set/node
 * - SEG (Segment): Filter/segment records
 * - SYN (Synthesize): Aggregate/collapse multiple values
 * - ALT (Alter): Transform values
 * - DES (Designate): Project/select a property
 * - NUL (Null): Handle absence/default values
 */

// ============================================================================
// Operator Types
// ============================================================================

const OperatorTypes = Object.freeze({
  CON: 'CON',   // Connect - establish relational reach
  SEG: 'SEG',   // Segment - filter/condition
  SYN: 'SYN',   // Synthesize - aggregate/collapse
  ALT: 'ALT',   // Alter - transform values
  DES: 'DES',   // Designate - project property
  NUL: 'NUL'    // Null - handle absence
});

const OperatorLabels = {
  [OperatorTypes.CON]: 'Connect',
  [OperatorTypes.SEG]: 'Segment',
  [OperatorTypes.SYN]: 'Synthesize',
  [OperatorTypes.ALT]: 'Alter',
  [OperatorTypes.DES]: 'Designate',
  [OperatorTypes.NUL]: 'Null Handler'
};

// SYN aggregation modes
const SynthesizeModes = Object.freeze({
  SUM: 'SUM',
  COUNT: 'COUNT',
  AVG: 'AVG',
  MIN: 'MIN',
  MAX: 'MAX',
  FIRST: 'FIRST',
  LAST: 'LAST',
  CONCAT: 'CONCAT',
  COLLECT: 'COLLECT'
});

// ALT transformation modes
const AlterModes = Object.freeze({
  ARITHMETIC: 'ARITHMETIC',
  MAP: 'MAP',
  MULTIPLY: 'MULTIPLY',
  DIVIDE: 'DIVIDE',
  ADD: 'ADD',
  SUBTRACT: 'SUBTRACT',
  FUNCTION: 'FUNCTION'
});

// Arithmetic operations
const ArithmeticOps = Object.freeze({
  ADD: 'ADD',
  SUBTRACT: 'SUBTRACT',
  MULTIPLY: 'MULTIPLY',
  DIVIDE: 'DIVIDE',
  MOD: 'MOD',
  POWER: 'POWER'
});

// Comparison operators for SEG conditions
const ComparisonOps = Object.freeze({
  EQ: 'eq',
  NE: 'ne',
  GT: 'gt',
  GE: 'ge',
  LT: 'lt',
  LE: 'le',
  CONTAINS: 'contains',
  STARTS_WITH: 'startsWith',
  ENDS_WITH: 'endsWith',
  IS_EMPTY: 'isEmpty',
  IS_NOT_EMPTY: 'isNotEmpty'
});

// ============================================================================
// Node Types
// ============================================================================

const NodeTypes = Object.freeze({
  SOURCE: 'source',     // Root data source (table/set)
  DERIVED: 'derived',   // Computed from pipeline
  FIELD: 'field',       // Field reference within a record
  LITERAL: 'literal'    // Literal value
});

// ============================================================================
// Expression Parser
// ============================================================================

/**
 * Parses formula expressions into pipeline AST
 *
 * Supported syntax:
 * - Field references: {Field Name}
 * - Node references: #NodeName
 * - Chained access: #Orders.#Customer.Name
 * - Filters: #Orders[Status = "Complete"]
 * - Aggregations: .SUM(), .COUNT(), .AVG(), .MIN(), .MAX(), .FIRST()
 * - Property access: .PropertyName
 * - Arithmetic: +, -, *, /
 * - Functions: FUNCTION_NAME(args)
 */
class EOFormulaParser {
  constructor() {
    this.pos = 0;
    this.input = '';
    this.tokens = [];
  }

  /**
   * Parse an expression string into a pipeline AST
   * @param {string} expr - The expression to parse
   * @returns {Object} Pipeline definition with operators and dependencies
   */
  parse(expr) {
    if (!expr || typeof expr !== 'string') {
      return { pipeline: [], dependencies: [], returnType: 'unknown' };
    }

    this.input = expr.trim();
    this.pos = 0;

    try {
      const ast = this._parseExpression();
      const pipeline = this._astToPipeline(ast);
      const dependencies = this._extractDependencies(pipeline);
      const returnType = this._inferReturnType(pipeline);

      return { pipeline, dependencies, returnType, ast };
    } catch (error) {
      return {
        pipeline: [],
        dependencies: [],
        returnType: 'error',
        error: error.message,
        position: this.pos
      };
    }
  }

  /**
   * Parse the top-level expression
   */
  _parseExpression() {
    return this._parseArithmetic();
  }

  /**
   * Parse arithmetic operations (lowest precedence)
   */
  _parseArithmetic() {
    let left = this._parseTerm();

    while (this._peek() === '+' || this._peek() === '-') {
      const op = this._consume();
      const right = this._parseTerm();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  /**
   * Parse terms (multiplication, division - higher precedence)
   */
  _parseTerm() {
    let left = this._parseUnary();

    while (this._peek() === '*' || this._peek() === '/') {
      const op = this._consume();
      const right = this._parseUnary();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  /**
   * Parse unary operations
   */
  _parseUnary() {
    if (this._peek() === '-') {
      this._consume();
      return { type: 'unary', op: '-', operand: this._parseUnary() };
    }
    return this._parseChain();
  }

  /**
   * Parse chained access (e.g., #Orders.Customer.Name.SUM())
   */
  _parseChain() {
    let node = this._parsePrimary();

    while (this._peek() === '.') {
      this._consume(); // consume '.'

      // Check for aggregation function
      const aggMatch = this._matchAggregation();
      if (aggMatch) {
        node = { type: 'aggregation', mode: aggMatch, source: node };
        continue;
      }

      // Property access
      const propName = this._parseIdentifier();
      if (propName) {
        node = { type: 'property', name: propName, source: node };
      }
    }

    return node;
  }

  /**
   * Parse primary expressions (field refs, node refs, literals, functions, parens)
   */
  _parsePrimary() {
    this._skipWhitespace();

    // Parenthesized expression
    if (this._peek() === '(') {
      this._consume();
      const expr = this._parseExpression();
      this._expect(')');
      return expr;
    }

    // Field reference: {Field Name}
    if (this._peek() === '{') {
      return this._parseFieldReference();
    }

    // Node reference: #NodeName
    if (this._peek() === '#') {
      return this._parseNodeReference();
    }

    // String literal
    if (this._peek() === '"' || this._peek() === "'") {
      return this._parseStringLiteral();
    }

    // Number literal
    if (this._isDigit(this._peek()) || (this._peek() === '.' && this._isDigit(this._peekAhead(1)))) {
      return this._parseNumberLiteral();
    }

    // Function call or identifier
    const ident = this._parseIdentifier();
    if (ident) {
      this._skipWhitespace();
      if (this._peek() === '(') {
        return this._parseFunctionCall(ident);
      }
      // Could be a boolean or special value
      if (ident.toLowerCase() === 'true') return { type: 'literal', value: true, dataType: 'boolean' };
      if (ident.toLowerCase() === 'false') return { type: 'literal', value: false, dataType: 'boolean' };
      if (ident.toLowerCase() === 'null') return { type: 'literal', value: null, dataType: 'null' };
      // Treat as field reference without braces
      return { type: 'field', name: ident };
    }

    throw new Error(`Unexpected character at position ${this.pos}: "${this._peek()}"`);
  }

  /**
   * Parse field reference: {Field Name}
   */
  _parseFieldReference() {
    this._expect('{');
    let name = '';
    while (this.pos < this.input.length && this._peek() !== '}') {
      name += this._consume();
    }
    this._expect('}');

    // Check for filter
    this._skipWhitespace();
    let filter = null;
    if (this._peek() === '[') {
      filter = this._parseFilter();
    }

    return { type: 'field', name: name.trim(), filter };
  }

  /**
   * Parse node reference: #NodeName or #NodeName[filter]
   */
  _parseNodeReference() {
    this._expect('#');
    const name = this._parseIdentifier();
    if (!name) {
      throw new Error('Expected node name after #');
    }

    this._skipWhitespace();
    let filter = null;
    if (this._peek() === '[') {
      filter = this._parseFilter();
    }

    return { type: 'nodeRef', name, filter };
  }

  /**
   * Parse filter: [field op value]
   */
  _parseFilter() {
    this._expect('[');
    this._skipWhitespace();

    // Parse left side (field name)
    let field = '';
    while (this.pos < this.input.length && !this._isComparisonStart()) {
      const ch = this._peek();
      if (ch === ']') break;
      field += this._consume();
    }
    field = field.trim();

    // Parse operator
    this._skipWhitespace();
    const op = this._parseComparisonOperator();

    // Parse right side (value)
    this._skipWhitespace();
    const value = this._parseFilterValue();

    this._skipWhitespace();
    this._expect(']');

    return { field, op, value };
  }

  /**
   * Check if current position is start of comparison operator
   */
  _isComparisonStart() {
    const ch = this._peek();
    return ch === '=' || ch === '!' || ch === '<' || ch === '>';
  }

  /**
   * Parse comparison operator
   */
  _parseComparisonOperator() {
    this._skipWhitespace();
    const ch = this._peek();
    const next = this._peekAhead(1);

    if (ch === '=' && next === '=') {
      this._consume(); this._consume();
      return ComparisonOps.EQ;
    }
    if (ch === '=') {
      this._consume();
      return ComparisonOps.EQ;
    }
    if (ch === '!' && next === '=') {
      this._consume(); this._consume();
      return ComparisonOps.NE;
    }
    if (ch === '<' && next === '=') {
      this._consume(); this._consume();
      return ComparisonOps.LE;
    }
    if (ch === '>' && next === '=') {
      this._consume(); this._consume();
      return ComparisonOps.GE;
    }
    if (ch === '<') {
      this._consume();
      return ComparisonOps.LT;
    }
    if (ch === '>') {
      this._consume();
      return ComparisonOps.GT;
    }

    throw new Error(`Unknown comparison operator at position ${this.pos}`);
  }

  /**
   * Parse filter value (string or number)
   */
  _parseFilterValue() {
    this._skipWhitespace();

    if (this._peek() === '"' || this._peek() === "'") {
      const lit = this._parseStringLiteral();
      return lit.value;
    }

    if (this._isDigit(this._peek()) || this._peek() === '-') {
      const lit = this._parseNumberLiteral();
      return lit.value;
    }

    // Identifier (could be field reference or enum value)
    const ident = this._parseIdentifier();
    if (ident) {
      if (ident.toLowerCase() === 'true') return true;
      if (ident.toLowerCase() === 'false') return false;
      if (ident.toLowerCase() === 'null') return null;
      return ident;
    }

    throw new Error(`Expected value at position ${this.pos}`);
  }

  /**
   * Parse string literal
   */
  _parseStringLiteral() {
    const quote = this._consume();
    let value = '';
    while (this.pos < this.input.length && this._peek() !== quote) {
      if (this._peek() === '\\') {
        this._consume();
        const escaped = this._consume();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          default: value += escaped;
        }
      } else {
        value += this._consume();
      }
    }
    this._expect(quote);
    return { type: 'literal', value, dataType: 'string' };
  }

  /**
   * Parse number literal
   */
  _parseNumberLiteral() {
    let str = '';
    if (this._peek() === '-') {
      str += this._consume();
    }
    while (this._isDigit(this._peek()) || this._peek() === '.') {
      str += this._consume();
    }
    const value = parseFloat(str);
    return { type: 'literal', value, dataType: 'number' };
  }

  /**
   * Parse function call: FUNC_NAME(arg1, arg2, ...)
   */
  _parseFunctionCall(name) {
    this._expect('(');
    const args = [];

    this._skipWhitespace();
    if (this._peek() !== ')') {
      args.push(this._parseExpression());

      while (this._peek() === ',') {
        this._consume();
        this._skipWhitespace();
        args.push(this._parseExpression());
      }
    }

    this._expect(')');
    return { type: 'function', name: name.toUpperCase(), args };
  }

  /**
   * Match aggregation function (.SUM(), .COUNT(), etc.)
   */
  _matchAggregation() {
    const savedPos = this.pos;
    const ident = this._parseIdentifier();

    if (!ident) {
      this.pos = savedPos;
      return null;
    }

    const upper = ident.toUpperCase();
    if (Object.values(SynthesizeModes).includes(upper)) {
      this._skipWhitespace();
      if (this._peek() === '(') {
        this._consume();
        this._expect(')');
        return upper;
      }
    }

    this.pos = savedPos;
    return null;
  }

  /**
   * Parse an identifier
   */
  _parseIdentifier() {
    this._skipWhitespace();
    if (!this._isAlpha(this._peek()) && this._peek() !== '_') {
      return null;
    }

    let name = '';
    while (this._isAlphaNumeric(this._peek()) || this._peek() === '_') {
      name += this._consume();
    }
    return name;
  }

  // Helper methods
  _peek() { return this.pos < this.input.length ? this.input[this.pos] : null; }
  _peekAhead(n) { return (this.pos + n) < this.input.length ? this.input[this.pos + n] : null; }
  _consume() { return this.pos < this.input.length ? this.input[this.pos++] : null; }
  _expect(ch) {
    this._skipWhitespace();
    if (this._peek() !== ch) {
      throw new Error(`Expected "${ch}" at position ${this.pos}, got "${this._peek()}"`);
    }
    return this._consume();
  }
  _skipWhitespace() { while (this._peek() === ' ' || this._peek() === '\t' || this._peek() === '\n') this.pos++; }
  _isDigit(ch) { return ch >= '0' && ch <= '9'; }
  _isAlpha(ch) { return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'); }
  _isAlphaNumeric(ch) { return this._isAlpha(ch) || this._isDigit(ch); }

  /**
   * Convert AST to pipeline operators
   */
  _astToPipeline(ast) {
    if (!ast) return [];

    switch (ast.type) {
      case 'binary':
        return this._binaryToPipeline(ast);

      case 'unary':
        return this._unaryToPipeline(ast);

      case 'field':
        return this._fieldToPipeline(ast);

      case 'nodeRef':
        return this._nodeRefToPipeline(ast);

      case 'property':
        return this._propertyToPipeline(ast);

      case 'aggregation':
        return this._aggregationToPipeline(ast);

      case 'function':
        return this._functionToPipeline(ast);

      case 'literal':
        return [{ operator: OperatorTypes.ALT, mode: AlterModes.FUNCTION, value: ast.value }];

      default:
        return [];
    }
  }

  /**
   * Convert binary operation to pipeline
   */
  _binaryToPipeline(ast) {
    const opMap = {
      '+': ArithmeticOps.ADD,
      '-': ArithmeticOps.SUBTRACT,
      '*': ArithmeticOps.MULTIPLY,
      '/': ArithmeticOps.DIVIDE
    };

    return [{
      operator: OperatorTypes.ALT,
      mode: AlterModes.ARITHMETIC,
      op: opMap[ast.op] || ast.op,
      inputs: [
        { pipeline: this._astToPipeline(ast.left) },
        { pipeline: this._astToPipeline(ast.right) }
      ]
    }];
  }

  /**
   * Convert unary operation to pipeline
   */
  _unaryToPipeline(ast) {
    if (ast.op === '-') {
      return [{
        operator: OperatorTypes.ALT,
        mode: AlterModes.ARITHMETIC,
        op: ArithmeticOps.MULTIPLY,
        inputs: [
          { pipeline: this._astToPipeline(ast.operand) },
          { pipeline: [{ operator: OperatorTypes.ALT, mode: AlterModes.FUNCTION, value: -1 }] }
        ]
      }];
    }
    return this._astToPipeline(ast.operand);
  }

  /**
   * Convert field reference to pipeline
   */
  _fieldToPipeline(ast) {
    const pipeline = [
      { operator: OperatorTypes.DES, property: ast.name }
    ];

    if (ast.filter) {
      pipeline.unshift({
        operator: OperatorTypes.SEG,
        condition: { field: ast.filter.field, [ast.filter.op]: ast.filter.value }
      });
    }

    return pipeline;
  }

  /**
   * Convert node reference to pipeline
   */
  _nodeRefToPipeline(ast) {
    const pipeline = [
      { operator: OperatorTypes.CON, source: ast.name }
    ];

    if (ast.filter) {
      pipeline.push({
        operator: OperatorTypes.SEG,
        condition: { field: ast.filter.field, [ast.filter.op]: ast.filter.value }
      });
    }

    return pipeline;
  }

  /**
   * Convert property access to pipeline
   */
  _propertyToPipeline(ast) {
    const sourcePipeline = this._astToPipeline(ast.source);
    sourcePipeline.push({ operator: OperatorTypes.DES, property: ast.name });
    return sourcePipeline;
  }

  /**
   * Convert aggregation to pipeline
   */
  _aggregationToPipeline(ast) {
    const sourcePipeline = this._astToPipeline(ast.source);
    sourcePipeline.push({ operator: OperatorTypes.SYN, mode: ast.mode });
    return sourcePipeline;
  }

  /**
   * Convert function call to pipeline
   */
  _functionToPipeline(ast) {
    // For functions, we use ALT with FUNCTION mode
    return [{
      operator: OperatorTypes.ALT,
      mode: AlterModes.FUNCTION,
      function: ast.name,
      args: ast.args.map(arg => ({ pipeline: this._astToPipeline(arg) }))
    }];
  }

  /**
   * Extract dependencies from pipeline
   */
  _extractDependencies(pipeline) {
    const deps = new Set();

    const extract = (steps) => {
      for (const step of steps) {
        if (step.operator === OperatorTypes.CON && step.source) {
          deps.add(step.source);
        }
        if (step.operator === OperatorTypes.DES && step.property) {
          deps.add(step.property);
        }
        if (step.inputs) {
          for (const input of step.inputs) {
            if (input.pipeline) extract(input.pipeline);
            if (input.ref) deps.add(input.ref);
          }
        }
        if (step.args) {
          for (const arg of step.args) {
            if (arg.pipeline) extract(arg.pipeline);
          }
        }
      }
    };

    extract(pipeline);
    return Array.from(deps);
  }

  /**
   * Infer return type from pipeline
   */
  _inferReturnType(pipeline) {
    if (pipeline.length === 0) return 'unknown';

    const lastStep = pipeline[pipeline.length - 1];

    if (lastStep.operator === OperatorTypes.SYN) {
      switch (lastStep.mode) {
        case SynthesizeModes.COUNT:
          return 'number';
        case SynthesizeModes.SUM:
        case SynthesizeModes.AVG:
        case SynthesizeModes.MIN:
        case SynthesizeModes.MAX:
          return 'number';
        case SynthesizeModes.CONCAT:
          return 'text';
        case SynthesizeModes.COLLECT:
          return 'array';
        case SynthesizeModes.FIRST:
        case SynthesizeModes.LAST:
          return 'unknown';
      }
    }

    if (lastStep.operator === OperatorTypes.ALT) {
      if (lastStep.mode === AlterModes.ARITHMETIC) return 'number';
    }

    return 'unknown';
  }
}

// ============================================================================
// Formula Graph - Node and Dependency Management
// ============================================================================

/**
 * Manages the graph of formula nodes and their dependencies
 */
class FormulaGraph {
  constructor() {
    this.nodes = new Map();  // nodeId -> Node
    this.dirty = new Set();  // Set of dirty node IDs
  }

  /**
   * Create or update a node
   */
  setNode(nodeId, definition) {
    const existing = this.nodes.get(nodeId);

    const node = {
      id: nodeId,
      name: definition.name || nodeId,
      description: definition.description || '',
      type: definition.type || NodeTypes.DERIVED,
      pipeline: definition.pipeline || [],
      dependencies: definition.dependencies || [],
      returnType: definition.returnType || 'unknown',
      cachedValue: existing?.cachedValue ?? null,
      dirty: true,
      lastEvaluated: null,
      metadata: definition.metadata || {}
    };

    this.nodes.set(nodeId, node);
    this.dirty.add(nodeId);

    // Mark downstream nodes dirty
    this._markDependentsDirty(nodeId);

    return node;
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  /**
   * Remove a node
   */
  removeNode(nodeId) {
    this.nodes.delete(nodeId);
    this.dirty.delete(nodeId);
  }

  /**
   * Mark a node as dirty (needs re-evaluation)
   */
  markDirty(nodeId) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.dirty = true;
      this.dirty.add(nodeId);
      this._markDependentsDirty(nodeId);
    }
  }

  /**
   * Mark all nodes that depend on the given node as dirty
   */
  _markDependentsDirty(nodeId) {
    for (const [id, node] of this.nodes) {
      if (node.dependencies.includes(nodeId)) {
        node.dirty = true;
        this.dirty.add(id);
        this._markDependentsDirty(id);
      }
    }
  }

  /**
   * Get all nodes in topological order (dependencies first)
   */
  getTopologicalOrder() {
    const visited = new Set();
    const order = [];

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          visit(depId);
        }
        order.push(nodeId);
      }
    };

    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    return order;
  }

  /**
   * Clear cache for all nodes
   */
  clearCache() {
    for (const node of this.nodes.values()) {
      node.cachedValue = null;
      node.dirty = true;
    }
    this.dirty = new Set(this.nodes.keys());
  }
}

// ============================================================================
// Pipeline Evaluator
// ============================================================================

/**
 * Evaluates pipeline operators against a context
 */
class PipelineEvaluator {
  constructor(options = {}) {
    this.graph = options.graph || new FormulaGraph();
    this.functions = options.functions || {};
    this.getSet = options.getSet || (() => null);
    this.getLinkedRecords = options.getLinkedRecords || (() => []);
  }

  /**
   * Evaluate a node by ID
   */
  evaluateNode(nodeId, context = {}) {
    const node = this.graph.getNode(nodeId);
    if (!node) {
      return { value: null, error: `Node not found: ${nodeId}` };
    }

    // Check cache
    if (!node.dirty && node.cachedValue !== null) {
      return { value: node.cachedValue, fromCache: true };
    }

    // Resolve dependencies first
    for (const depId of node.dependencies) {
      const depNode = this.graph.getNode(depId);
      if (depNode?.dirty) {
        this.evaluateNode(depId, context);
      }
    }

    // Execute pipeline
    try {
      const result = this.evaluatePipeline(node.pipeline, context);

      // Cache result
      node.cachedValue = result.value;
      node.dirty = false;
      node.lastEvaluated = Date.now();
      this.graph.dirty.delete(nodeId);

      return result;
    } catch (error) {
      return { value: null, error: error.message };
    }
  }

  /**
   * Evaluate a pipeline against a context
   */
  evaluatePipeline(pipeline, context = {}) {
    if (!pipeline || pipeline.length === 0) {
      return { value: null, steps: [] };
    }

    let result = context.currentValue ?? null;
    const steps = [];

    for (const step of pipeline) {
      const stepResult = this.executeOperator(step, result, context);
      steps.push({
        operator: step.operator,
        input: result,
        output: stepResult.value,
        error: stepResult.error
      });

      if (stepResult.error) {
        return { value: null, error: stepResult.error, steps };
      }

      result = stepResult.value;
    }

    return { value: result, steps };
  }

  /**
   * Execute a single operator
   */
  executeOperator(step, input, context) {
    try {
      switch (step.operator) {
        case OperatorTypes.CON:
          return this._executeCON(step, input, context);

        case OperatorTypes.SEG:
          return this._executeSEG(step, input, context);

        case OperatorTypes.DES:
          return this._executeDES(step, input, context);

        case OperatorTypes.SYN:
          return this._executeSYN(step, input, context);

        case OperatorTypes.ALT:
          return this._executeALT(step, input, context);

        case OperatorTypes.NUL:
          return this._executeNUL(step, input, context);

        default:
          return { value: input, error: `Unknown operator: ${step.operator}` };
      }
    } catch (error) {
      return { value: null, error: error.message };
    }
  }

  /**
   * CON (Connect) - Retrieve related records
   */
  _executeCON(step, input, context) {
    const source = step.source;

    // If source starts with # it's a node reference
    if (source.startsWith('#')) {
      const nodeId = source.slice(1);
      const result = this.evaluateNode(nodeId, context);
      return { value: result.value };
    }

    // Try to get as set/table
    const set = this.getSet(source);
    if (set) {
      return { value: set.records || [] };
    }

    // Try to get linked records
    const linkedRecords = this.getLinkedRecords(context.currentRecord, source);
    if (linkedRecords) {
      return { value: linkedRecords };
    }

    return { value: [], error: `Source not found: ${source}` };
  }

  /**
   * SEG (Segment) - Filter records
   */
  _executeSEG(step, input, context) {
    if (!Array.isArray(input)) {
      // If single record, check if it matches
      if (input && typeof input === 'object') {
        const matches = this._evaluateCondition(step.condition, input);
        return { value: matches ? input : null };
      }
      return { value: input };
    }

    const filtered = input.filter(record => {
      const values = record.values || record;
      return this._evaluateCondition(step.condition, values);
    });

    return { value: filtered };
  }

  /**
   * DES (Designate) - Project/access property
   */
  _executeDES(step, input, context) {
    const property = step.property;

    // If input is array, map to property values
    if (Array.isArray(input)) {
      const values = input.map(item => {
        const values = item.values || item;
        return values[property] ?? this._getFieldValue(context, property, item);
      });
      return { value: values };
    }

    // If input is object, get property
    if (input && typeof input === 'object') {
      const values = input.values || input;
      return { value: values[property] ?? null };
    }

    // Try to get from context record
    const value = this._getFieldValue(context, property, context.currentRecord);
    return { value };
  }

  /**
   * Get field value from record, handling field name lookup
   */
  _getFieldValue(context, fieldNameOrId, record) {
    if (!record) {
      record = context.currentRecord;
    }
    if (!record) return null;

    const values = record.values || record;

    // Direct lookup
    if (fieldNameOrId in values) {
      return values[fieldNameOrId];
    }

    // Look up by field name in set
    const set = context.currentSet;
    if (set && set.fields) {
      const field = set.fields.find(f =>
        f.name === fieldNameOrId || f.id === fieldNameOrId
      );
      if (field) {
        return values[field.id] ?? values[field.name] ?? null;
      }
    }

    return null;
  }

  /**
   * SYN (Synthesize) - Aggregate values
   */
  _executeSYN(step, input, context) {
    const values = Array.isArray(input) ? input : [input];
    const mode = step.mode;
    const property = step.property;

    // If property specified, extract values first
    let nums = values;
    if (property) {
      nums = values.map(v => {
        const vals = v?.values || v;
        return vals?.[property] ?? v;
      });
    }

    // Filter to numbers for numeric operations
    const numericValues = nums.map(v => Number(v)).filter(n => !isNaN(n));

    switch (mode) {
      case SynthesizeModes.SUM:
        return { value: numericValues.reduce((a, b) => a + b, 0) };

      case SynthesizeModes.COUNT:
        return { value: values.length };

      case SynthesizeModes.AVG:
        if (numericValues.length === 0) return { value: 0 };
        return { value: numericValues.reduce((a, b) => a + b, 0) / numericValues.length };

      case SynthesizeModes.MIN:
        if (numericValues.length === 0) return { value: null };
        return { value: Math.min(...numericValues) };

      case SynthesizeModes.MAX:
        if (numericValues.length === 0) return { value: null };
        return { value: Math.max(...numericValues) };

      case SynthesizeModes.FIRST:
        return { value: values[0] ?? null };

      case SynthesizeModes.LAST:
        return { value: values[values.length - 1] ?? null };

      case SynthesizeModes.CONCAT:
        return { value: nums.filter(v => v != null).join(step.separator || ', ') };

      case SynthesizeModes.COLLECT:
        return { value: nums };

      default:
        return { value: values };
    }
  }

  /**
   * ALT (Alter) - Transform values
   */
  _executeALT(step, input, context) {
    switch (step.mode) {
      case AlterModes.ARITHMETIC:
        return this._executeArithmetic(step, input, context);

      case AlterModes.MAP:
        return this._executeMap(step, input, context);

      case AlterModes.FUNCTION:
        return this._executeFunction(step, input, context);

      case AlterModes.MULTIPLY:
        return { value: Number(input) * Number(step.value) };

      case AlterModes.DIVIDE:
        const divisor = Number(step.value);
        if (divisor === 0) return { value: null, error: 'Division by zero' };
        return { value: Number(input) / divisor };

      case AlterModes.ADD:
        return { value: Number(input) + Number(step.value) };

      case AlterModes.SUBTRACT:
        return { value: Number(input) - Number(step.value) };

      default:
        return { value: input };
    }
  }

  /**
   * Execute arithmetic operation
   */
  _executeArithmetic(step, input, context) {
    const inputs = step.inputs || [];
    if (inputs.length < 2) {
      return { value: step.value ?? input };
    }

    // Evaluate both inputs
    const left = inputs[0].pipeline
      ? this.evaluatePipeline(inputs[0].pipeline, context).value
      : inputs[0].ref
        ? this.evaluateNode(inputs[0].ref, context).value
        : inputs[0].value;

    const right = inputs[1].pipeline
      ? this.evaluatePipeline(inputs[1].pipeline, context).value
      : inputs[1].ref
        ? this.evaluateNode(inputs[1].ref, context).value
        : inputs[1].value;

    const leftNum = Number(left);
    const rightNum = Number(right);

    switch (step.op) {
      case ArithmeticOps.ADD:
      case '+':
        return { value: leftNum + rightNum };
      case ArithmeticOps.SUBTRACT:
      case '-':
        return { value: leftNum - rightNum };
      case ArithmeticOps.MULTIPLY:
      case '*':
        return { value: leftNum * rightNum };
      case ArithmeticOps.DIVIDE:
      case '/':
        if (rightNum === 0) return { value: null, error: 'Division by zero' };
        return { value: leftNum / rightNum };
      case ArithmeticOps.MOD:
        return { value: leftNum % rightNum };
      case ArithmeticOps.POWER:
        return { value: Math.pow(leftNum, rightNum) };
      default:
        return { value: null, error: `Unknown arithmetic operation: ${step.op}` };
    }
  }

  /**
   * Execute map transformation
   */
  _executeMap(step, input, context) {
    if (!Array.isArray(input)) {
      return this._evaluateInlineExpression(step.expression, input, context);
    }

    const mapped = input.map(item => {
      const result = this._evaluateInlineExpression(step.expression, item, context);
      return result.value;
    });

    return { value: mapped };
  }

  /**
   * Execute function call
   */
  _executeFunction(step, input, context) {
    const funcName = step.function;

    // If no function name, treat as literal
    if (!funcName) {
      return { value: step.value ?? input };
    }

    // Evaluate arguments
    const evaluatedArgs = (step.args || []).map(arg => {
      if (arg.pipeline) {
        return this.evaluatePipeline(arg.pipeline, context).value;
      }
      return arg.value ?? arg;
    });

    // Look up function
    const func = this.functions[funcName];
    if (func) {
      try {
        const result = func(...evaluatedArgs);
        return { value: result };
      } catch (error) {
        return { value: null, error: `Error in ${funcName}: ${error.message}` };
      }
    }

    // Check built-in functions
    const builtinResult = this._executeBuiltinFunction(funcName, evaluatedArgs, input, context);
    if (builtinResult !== undefined) {
      return builtinResult;
    }

    return { value: null, error: `Unknown function: ${funcName}` };
  }

  /**
   * Execute built-in function
   */
  _executeBuiltinFunction(name, args, input, context) {
    switch (name) {
      // Text functions
      case 'CONCATENATE':
      case 'CONCAT':
        return { value: args.join('') };
      case 'LEFT':
        return { value: String(args[0] || '').substring(0, Number(args[1]) || 0) };
      case 'RIGHT':
        return { value: String(args[0] || '').slice(-(Number(args[1]) || 0)) };
      case 'MID':
        return { value: String(args[0] || '').substring(Number(args[1]) - 1 || 0, (Number(args[1]) - 1 || 0) + (Number(args[2]) || 0)) };
      case 'LEN':
        return { value: String(args[0] || '').length };
      case 'LOWER':
        return { value: String(args[0] || '').toLowerCase() };
      case 'UPPER':
        return { value: String(args[0] || '').toUpperCase() };
      case 'TRIM':
        return { value: String(args[0] || '').trim() };

      // Numeric functions
      case 'SUM':
        return { value: args.flat().reduce((a, b) => Number(a) + Number(b), 0) };
      case 'AVERAGE':
      case 'AVG':
        const nums = args.flat().map(Number).filter(n => !isNaN(n));
        return { value: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0 };
      case 'MAX':
        return { value: Math.max(...args.flat().map(Number).filter(n => !isNaN(n))) };
      case 'MIN':
        return { value: Math.min(...args.flat().map(Number).filter(n => !isNaN(n))) };
      case 'COUNT':
        return { value: args.flat().filter(v => v != null).length };
      case 'ABS':
        return { value: Math.abs(Number(args[0])) };
      case 'ROUND':
        const precision = Number(args[1]) || 0;
        const factor = Math.pow(10, precision);
        return { value: Math.round(Number(args[0]) * factor) / factor };
      case 'FLOOR':
        return { value: Math.floor(Number(args[0])) };
      case 'CEIL':
      case 'CEILING':
        return { value: Math.ceil(Number(args[0])) };
      case 'SQRT':
        return { value: Math.sqrt(Number(args[0])) };
      case 'POWER':
        return { value: Math.pow(Number(args[0]), Number(args[1])) };

      // Logical functions
      case 'IF':
        return { value: args[0] ? args[1] : args[2] };
      case 'AND':
        return { value: args.every(v => !!v) };
      case 'OR':
        return { value: args.some(v => !!v) };
      case 'NOT':
        return { value: !args[0] };
      case 'SWITCH':
        const expr = args[0];
        for (let i = 1; i < args.length - 1; i += 2) {
          if (expr === args[i]) return { value: args[i + 1] };
        }
        return { value: args.length % 2 === 0 ? args[args.length - 1] : null };

      // Date functions
      case 'NOW':
        return { value: new Date().toISOString() };
      case 'TODAY':
        return { value: new Date().toISOString().split('T')[0] };
      case 'YEAR':
        return { value: new Date(args[0]).getFullYear() };
      case 'MONTH':
        return { value: new Date(args[0]).getMonth() + 1 };
      case 'DAY':
        return { value: new Date(args[0]).getDate() };
      case 'DATETIME_FORMAT': {
        const d = new Date(args[0]);
        const format = args[1];
        if (!format) return { value: d.toISOString() };
        return { value: format
          .replace('YYYY', d.getFullYear())
          .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
          .replace('DD', String(d.getDate()).padStart(2, '0'))
          .replace('HH', String(d.getHours()).padStart(2, '0'))
          .replace('mm', String(d.getMinutes()).padStart(2, '0'))
          .replace('ss', String(d.getSeconds()).padStart(2, '0'))
        };
      }
      case 'DATETIME_PARSE':
        return { value: new Date(args[0]).toISOString() };

      // Array functions
      case 'ARRAYUNIQUE':
        return { value: [...new Set(args[0])] };
      case 'ARRAYCOMPACT':
        return { value: (args[0] || []).filter(v => v != null && v !== '') };
      case 'ARRAYJOIN':
        return { value: (args[0] || []).join(args[1] || ', ') };

      // Special functions
      case 'COALESCE':
        return { value: args.find(v => v != null && v !== '') ?? null };
      case 'BLANK':
        return { value: null };
      case 'ERROR':
        return { value: null, error: 'ERROR' };

      // Record functions
      case 'RECORD_ID':
        return { value: context?.currentRecord?.id || null };

      default:
        return undefined;
    }
  }

  /**
   * Evaluate inline expression (e.g., "$ * 1.1")
   */
  _evaluateInlineExpression(expr, value, context) {
    if (!expr) return { value };

    // Simple $ replacement
    const replaced = expr.replace(/\$/g, String(value));

    try {
      // Use safe evaluation
      const result = this._safeEval(replaced);
      return { value: result };
    } catch (error) {
      return { value: null, error: error.message };
    }
  }

  /**
   * Safe evaluation of simple expressions
   */
  _safeEval(expr) {
    // Only allow numbers, operators, parentheses
    if (!/^[\d\s+\-*/.()]+$/.test(expr)) {
      throw new Error('Invalid expression');
    }
    return Function('"use strict"; return (' + expr + ')')();
  }

  /**
   * NUL (Null) - Handle absence
   */
  _executeNUL(step, input, context) {
    if (input == null || input === '' || (Array.isArray(input) && input.length === 0)) {
      return { value: step.default ?? null };
    }
    return { value: input };
  }

  /**
   * Evaluate a condition against values
   */
  _evaluateCondition(condition, values) {
    if (!condition) return true;

    const fieldValue = values[condition.field];

    // Check each comparison operator
    if (condition[ComparisonOps.EQ] !== undefined) {
      return fieldValue == condition[ComparisonOps.EQ];
    }
    if (condition[ComparisonOps.NE] !== undefined) {
      return fieldValue != condition[ComparisonOps.NE];
    }
    if (condition[ComparisonOps.GT] !== undefined) {
      return Number(fieldValue) > Number(condition[ComparisonOps.GT]);
    }
    if (condition[ComparisonOps.GE] !== undefined) {
      return Number(fieldValue) >= Number(condition[ComparisonOps.GE]);
    }
    if (condition[ComparisonOps.LT] !== undefined) {
      return Number(fieldValue) < Number(condition[ComparisonOps.LT]);
    }
    if (condition[ComparisonOps.LE] !== undefined) {
      return Number(fieldValue) <= Number(condition[ComparisonOps.LE]);
    }
    if (condition[ComparisonOps.CONTAINS] !== undefined) {
      return String(fieldValue || '').includes(condition[ComparisonOps.CONTAINS]);
    }
    if (condition[ComparisonOps.STARTS_WITH] !== undefined) {
      return String(fieldValue || '').startsWith(condition[ComparisonOps.STARTS_WITH]);
    }
    if (condition[ComparisonOps.ENDS_WITH] !== undefined) {
      return String(fieldValue || '').endsWith(condition[ComparisonOps.ENDS_WITH]);
    }
    if (condition[ComparisonOps.IS_EMPTY] !== undefined) {
      return fieldValue == null || fieldValue === '';
    }
    if (condition[ComparisonOps.IS_NOT_EMPTY] !== undefined) {
      return fieldValue != null && fieldValue !== '';
    }

    return true;
  }
}

// ============================================================================
// Formula Engine - Main Entry Point
// ============================================================================

/**
 * Main formula engine that ties everything together
 */
class EOFormulaEngine {
  constructor(options = {}) {
    this.parser = new EOFormulaParser();
    this.graph = new FormulaGraph();
    this.evaluator = new PipelineEvaluator({
      graph: this.graph,
      functions: this._buildFunctionLibrary(options.functions),
      getSet: options.getSet || (() => null),
      getLinkedRecords: options.getLinkedRecords || (() => [])
    });

    // Reference to workbench for data access
    this.workbench = options.workbench || null;
  }

  /**
   * Build the function library including SUP functions
   */
  _buildFunctionLibrary(additionalFunctions = {}) {
    const library = {};

    // Add SUP functions if available
    if (typeof window !== 'undefined' && window.EOSUPFormulas) {
      Object.assign(library, window.EOSUPFormulas.functions);
    }

    // Add additional functions
    Object.assign(library, additionalFunctions);

    return library;
  }

  /**
   * Parse a formula expression
   */
  parseFormula(formula) {
    return this.parser.parse(formula);
  }

  /**
   * Evaluate a formula against a record
   */
  evaluateFormula(formula, record, context = {}) {
    // Parse the formula
    const parsed = this.parser.parse(formula);

    if (parsed.error) {
      return { value: '#ERROR', error: parsed.error };
    }

    // Build evaluation context
    const evalContext = {
      currentRecord: record,
      currentSet: context.set,
      currentValue: null,
      ...context
    };

    // Configure evaluator with data access
    if (this.workbench) {
      this.evaluator.getSet = (name) => {
        return this.workbench.sets?.find(s => s.name === name || s.id === name);
      };
      this.evaluator.getLinkedRecords = (record, fieldName) => {
        return this._getLinkedRecords(record, fieldName, context.set);
      };
    }

    // Evaluate the pipeline
    const result = this.evaluator.evaluatePipeline(parsed.pipeline, evalContext);

    return result;
  }

  /**
   * Get linked records for a link field
   */
  _getLinkedRecords(record, fieldName, currentSet) {
    if (!record || !currentSet) return [];

    // Find the link field
    const field = currentSet.fields?.find(f =>
      f.name === fieldName || f.id === fieldName
    );

    if (!field || field.type !== 'link') return [];

    // Get linked record IDs
    const values = record.values || record;
    const linkedData = values[field.id] || values[field.name];

    if (!linkedData) return [];

    // Find the linked set
    const linkedSetId = field.options?.linked?.setId;
    if (!linkedSetId || !this.workbench) return [];

    const linkedSet = this.workbench.sets?.find(s => s.id === linkedSetId);
    if (!linkedSet) return [];

    // Get linked record IDs from the array
    const linkedIds = Array.isArray(linkedData)
      ? linkedData.map(l => l.recordId || l)
      : [linkedData.recordId || linkedData];

    // Return matching records
    return (linkedSet.records || []).filter(r => linkedIds.includes(r.id));
  }

  /**
   * Define a named node in the graph
   */
  defineNode(nodeId, definition) {
    // If definition is a formula string, parse it
    if (typeof definition === 'string') {
      const parsed = this.parser.parse(definition);
      return this.graph.setNode(nodeId, {
        pipeline: parsed.pipeline,
        dependencies: parsed.dependencies,
        returnType: parsed.returnType
      });
    }

    return this.graph.setNode(nodeId, definition);
  }

  /**
   * Evaluate a named node
   */
  evaluateNode(nodeId, context = {}) {
    return this.evaluator.evaluateNode(nodeId, context);
  }

  /**
   * Get the pipeline for a formula (for inspection/debugging)
   */
  inspectFormula(formula) {
    const parsed = this.parser.parse(formula);
    return {
      formula,
      ...parsed,
      pipelineDescription: this._describePipeline(parsed.pipeline)
    };
  }

  /**
   * Generate human-readable description of a pipeline
   */
  _describePipeline(pipeline) {
    if (!pipeline || pipeline.length === 0) return 'Empty pipeline';

    return pipeline.map((step, i) => {
      const desc = this._describeOperator(step);
      return `${i + 1}. ${desc}`;
    }).join('\n');
  }

  /**
   * Describe a single operator
   */
  _describeOperator(step) {
    switch (step.operator) {
      case OperatorTypes.CON:
        return `CON → Connect to "${step.source}"`;

      case OperatorTypes.SEG:
        const cond = step.condition;
        const field = cond?.field || 'unknown';
        const op = Object.keys(cond || {}).find(k => k !== 'field') || 'eq';
        const val = cond?.[op];
        return `SEG → Filter where ${field} ${op} ${JSON.stringify(val)}`;

      case OperatorTypes.DES:
        return `DES → Select property "${step.property}"`;

      case OperatorTypes.SYN:
        return `SYN → Aggregate using ${step.mode}${step.property ? ` on ${step.property}` : ''}`;

      case OperatorTypes.ALT:
        if (step.mode === AlterModes.ARITHMETIC) {
          return `ALT → Compute ${step.op} operation`;
        }
        if (step.mode === AlterModes.FUNCTION) {
          return `ALT → Call function ${step.function || 'literal'}`;
        }
        return `ALT → Transform using ${step.mode}`;

      case OperatorTypes.NUL:
        return `NUL → Default to ${JSON.stringify(step.default)}`;

      default:
        return `Unknown operator: ${step.operator}`;
    }
  }

  /**
   * Mark a source node as dirty (data changed)
   */
  invalidate(nodeId) {
    this.graph.markDirty(nodeId);
  }

  /**
   * Clear all cached values
   */
  clearCache() {
    this.graph.clearCache();
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof window !== 'undefined') {
  window.EOFormulaEngine = EOFormulaEngine;
  window.EOFormulaParser = EOFormulaParser;
  window.FormulaGraph = FormulaGraph;
  window.PipelineEvaluator = PipelineEvaluator;
  window.OperatorTypes = OperatorTypes;
  window.OperatorLabels = OperatorLabels;
  window.SynthesizeModes = SynthesizeModes;
  window.AlterModes = AlterModes;
  window.ArithmeticOps = ArithmeticOps;
  window.ComparisonOps = ComparisonOps;
  window.NodeTypes = NodeTypes;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EOFormulaEngine,
    EOFormulaParser,
    FormulaGraph,
    PipelineEvaluator,
    OperatorTypes,
    OperatorLabels,
    SynthesizeModes,
    AlterModes,
    ArithmeticOps,
    ComparisonOps,
    NodeTypes
  };
}
