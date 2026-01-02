/**
 * eo_formula_parser.js
 *
 * Enhanced parser for formula expressions with syntax:
 * - {Field Name}         → Same-set field reference
 * - #Set.Field           → Cross-set field reference
 * - #Set.Set.Field       → Chained traversal
 * - $                    → Current item in MAP/FILTER
 * - $.property           → Property of current item
 * - [condition]          → Filter condition
 * - &                    → Concatenation
 * - "text" or 'text'     → String literals
 * - FUNCTION(args)       → Function call
 * - AND, OR, NOT         → Logical operators
 * - =, !=, >, <, >=, <=  → Comparison operators
 * - +, -, *, /           → Arithmetic operators
 */

window.EOFormulaParserV2 = (function() {

  // ═══════════════════════════════════════════════════════════════
  // TOKEN TYPES
  // ═══════════════════════════════════════════════════════════════

  const TokenType = {
    // Literals
    NUMBER: 'NUMBER',
    STRING: 'STRING',
    BOOLEAN: 'BOOLEAN',

    // References
    FIELD_REF: 'FIELD_REF',         // {Field Name}
    SET_FIELD_REF: 'SET_FIELD_REF', // #Set.Field or #Set.Set.Field
    CURRENT_ITEM: 'CURRENT_ITEM',   // $

    // Operators
    CONCAT: 'CONCAT',               // &
    PLUS: 'PLUS',                   // +
    MINUS: 'MINUS',                 // -
    MULTIPLY: 'MULTIPLY',           // *
    DIVIDE: 'DIVIDE',               // /

    // Comparison
    EQ: 'EQ',                       // =
    NEQ: 'NEQ',                     // != or <>
    GT: 'GT',                       // >
    LT: 'LT',                       // <
    GTE: 'GTE',                     // >=
    LTE: 'LTE',                     // <=

    // Logical
    AND: 'AND',
    OR: 'OR',
    NOT: 'NOT',

    // Structural
    LPAREN: 'LPAREN',               // (
    RPAREN: 'RPAREN',               // )
    LBRACKET: 'LBRACKET',           // [
    RBRACKET: 'RBRACKET',           // ]
    COMMA: 'COMMA',                 // ,
    DOT: 'DOT',                     // .

    // Identifiers
    FUNCTION: 'FUNCTION',           // Known function name
    IDENTIFIER: 'IDENTIFIER',       // Generic identifier

    // Special
    EOF: 'EOF',
  };

  // ═══════════════════════════════════════════════════════════════
  // TOKENIZER
  // ═══════════════════════════════════════════════════════════════

  class Tokenizer {
    constructor(input) {
      this.input = input;
      this.pos = 0;
      this.tokens = [];
    }

    tokenize() {
      this.tokens = [];
      this.pos = 0;

      while (this.pos < this.input.length) {
        this.skipWhitespace();
        if (this.pos >= this.input.length) break;

        const char = this.peek();

        // String literals
        if (char === '"' || char === "'") {
          this.tokens.push(this.readString(char));
          continue;
        }

        // Numbers
        if (this.isDigit(char) || (char === '.' && this.isDigit(this.peekAhead(1)))) {
          this.tokens.push(this.readNumber());
          continue;
        }

        // Field reference {Field Name}
        if (char === '{') {
          this.tokens.push(this.readFieldRef());
          continue;
        }

        // Set.Field reference #Set.Field
        if (char === '#') {
          this.tokens.push(this.readSetFieldRef());
          continue;
        }

        // Current item $
        if (char === '$') {
          this.advance();
          this.tokens.push({ type: TokenType.CURRENT_ITEM, value: '$' });
          continue;
        }

        // Two-character operators
        if (this.match('!=') || this.match('<>')) {
          this.advance(2);
          this.tokens.push({ type: TokenType.NEQ, value: '!=' });
          continue;
        }
        if (this.match('>=')) {
          this.advance(2);
          this.tokens.push({ type: TokenType.GTE, value: '>=' });
          continue;
        }
        if (this.match('<=')) {
          this.advance(2);
          this.tokens.push({ type: TokenType.LTE, value: '<=' });
          continue;
        }

        // Single-character operators
        const singleCharTokens = {
          '&': TokenType.CONCAT,
          '+': TokenType.PLUS,
          '-': TokenType.MINUS,
          '*': TokenType.MULTIPLY,
          '/': TokenType.DIVIDE,
          '=': TokenType.EQ,
          '>': TokenType.GT,
          '<': TokenType.LT,
          '(': TokenType.LPAREN,
          ')': TokenType.RPAREN,
          '[': TokenType.LBRACKET,
          ']': TokenType.RBRACKET,
          ',': TokenType.COMMA,
          '.': TokenType.DOT,
        };

        if (char in singleCharTokens) {
          this.advance();
          this.tokens.push({ type: singleCharTokens[char], value: char });
          continue;
        }

        // Keywords and identifiers
        if (this.isAlpha(char) || char === '_') {
          const token = this.readIdentifier();
          this.tokens.push(token);
          continue;
        }

        throw new Error(`Unexpected character at position ${this.pos}: "${char}"`);
      }

      this.tokens.push({ type: TokenType.EOF });
      return this.tokens;
    }

    peek(offset = 0) {
      return this.input[this.pos + offset];
    }

    peekAhead(n) {
      return this.input[this.pos + n];
    }

    advance(count = 1) {
      const char = this.input.slice(this.pos, this.pos + count);
      this.pos += count;
      return char;
    }

    match(str) {
      return this.input.slice(this.pos, this.pos + str.length) === str;
    }

    skipWhitespace() {
      while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
        this.pos++;
      }
    }

    isDigit(ch) {
      return ch >= '0' && ch <= '9';
    }

    isAlpha(ch) {
      return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
    }

    isAlphaNumeric(ch) {
      return this.isAlpha(ch) || this.isDigit(ch) || ch === '_';
    }

    readString(quote) {
      this.advance(); // skip opening quote
      let value = '';
      while (this.pos < this.input.length && this.peek() !== quote) {
        if (this.peek() === '\\' && this.peekAhead(1) === quote) {
          this.advance(); // skip backslash
        }
        value += this.advance();
      }
      this.advance(); // skip closing quote
      return { type: TokenType.STRING, value };
    }

    readNumber() {
      let value = '';
      let hasDecimal = false;
      while (this.pos < this.input.length) {
        const ch = this.peek();
        if (this.isDigit(ch)) {
          value += this.advance();
        } else if (ch === '.' && !hasDecimal) {
          hasDecimal = true;
          value += this.advance();
        } else {
          break;
        }
      }
      return { type: TokenType.NUMBER, value: parseFloat(value) };
    }

    readFieldRef() {
      this.advance(); // skip {
      let name = '';
      while (this.pos < this.input.length && this.peek() !== '}') {
        name += this.advance();
      }
      this.advance(); // skip }
      return { type: TokenType.FIELD_REF, value: name.trim() };
    }

    readSetFieldRef() {
      this.advance(); // skip #
      let path = '';
      // Read until we hit something that's not part of the path
      while (this.pos < this.input.length && /[a-zA-Z0-9_.]/.test(this.peek())) {
        path += this.advance();
      }
      return { type: TokenType.SET_FIELD_REF, value: path };
    }

    readIdentifier() {
      let name = '';
      while (this.pos < this.input.length && this.isAlphaNumeric(this.peek())) {
        name += this.advance();
      }

      const upper = name.toUpperCase();

      // Check for keywords
      if (upper === 'AND') {
        return { type: TokenType.AND, value: 'AND' };
      }
      if (upper === 'OR') {
        return { type: TokenType.OR, value: 'OR' };
      }
      if (upper === 'NOT') {
        return { type: TokenType.NOT, value: 'NOT' };
      }
      if (upper === 'TRUE') {
        return { type: TokenType.BOOLEAN, value: true };
      }
      if (upper === 'FALSE') {
        return { type: TokenType.BOOLEAN, value: false };
      }

      // Check if it's a known function
      if (window.EOFormulaFunctions?.has(upper)) {
        return { type: TokenType.FUNCTION, value: upper };
      }

      // Generic identifier
      return { type: TokenType.IDENTIFIER, value: name };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // AST NODE TYPES
  // ═══════════════════════════════════════════════════════════════

  const ASTNode = {
    Literal: (value, dataType) => ({ type: 'Literal', value, dataType }),
    FieldRef: (name) => ({ type: 'FieldRef', name }),
    SetFieldRef: (path) => ({
      type: 'SetFieldRef',
      path,
      parts: path.split('.'),
    }),
    CurrentItem: () => ({ type: 'CurrentItem' }),
    CurrentItemProperty: (property) => ({ type: 'CurrentItemProperty', property }),
    BinaryOp: (operator, left, right) => ({ type: 'BinaryOp', operator, left, right }),
    UnaryOp: (operator, operand) => ({ type: 'UnaryOp', operator, operand }),
    FunctionCall: (name, args) => ({ type: 'FunctionCall', name, args }),
    Filter: (source, condition) => ({ type: 'Filter', source, condition }),
    Concat: (parts) => ({ type: 'Concat', parts }),
    PropertyAccess: (source, property) => ({ type: 'PropertyAccess', source, property }),
    Aggregation: (source, mode) => ({ type: 'Aggregation', source, mode }),
  };

  // ═══════════════════════════════════════════════════════════════
  // PARSER (Recursive Descent)
  // ═══════════════════════════════════════════════════════════════

  class Parser {
    constructor(tokens) {
      this.tokens = tokens;
      this.pos = 0;
    }

    parse() {
      const ast = this.parseExpression();
      this.expect(TokenType.EOF);
      return ast;
    }

    peek() {
      return this.tokens[this.pos];
    }

    advance() {
      return this.tokens[this.pos++];
    }

    expect(type) {
      const token = this.advance();
      if (token.type !== type) {
        throw new Error(`Expected ${type}, got ${token.type}`);
      }
      return token;
    }

    match(...types) {
      return types.includes(this.peek().type);
    }

    // Grammar: Expression → Concat
    parseExpression() {
      return this.parseConcat();
    }

    // Concat → Or (& Or)*
    parseConcat() {
      let left = this.parseOr();

      while (this.match(TokenType.CONCAT)) {
        const parts = [left];
        while (this.match(TokenType.CONCAT)) {
          this.advance(); // skip &
          parts.push(this.parseOr());
        }
        left = ASTNode.Concat(parts);
      }

      return left;
    }

    // Or → And (OR And)*
    parseOr() {
      let left = this.parseAnd();

      while (this.match(TokenType.OR)) {
        this.advance();
        const right = this.parseAnd();
        left = ASTNode.BinaryOp('OR', left, right);
      }

      return left;
    }

    // And → Not (AND Not)*
    parseAnd() {
      let left = this.parseNot();

      while (this.match(TokenType.AND)) {
        this.advance();
        const right = this.parseNot();
        left = ASTNode.BinaryOp('AND', left, right);
      }

      return left;
    }

    // Not → NOT Not | Comparison
    parseNot() {
      if (this.match(TokenType.NOT)) {
        this.advance();
        return ASTNode.UnaryOp('NOT', this.parseNot());
      }
      return this.parseComparison();
    }

    // Comparison → Addition ((= | != | > | < | >= | <=) Addition)*
    parseComparison() {
      let left = this.parseAddition();

      while (this.match(TokenType.EQ, TokenType.NEQ, TokenType.GT, TokenType.LT, TokenType.GTE, TokenType.LTE)) {
        const op = this.advance().value;
        const right = this.parseAddition();
        left = ASTNode.BinaryOp(op, left, right);
      }

      return left;
    }

    // Addition → Multiplication ((+ | -) Multiplication)*
    parseAddition() {
      let left = this.parseMultiplication();

      while (this.match(TokenType.PLUS, TokenType.MINUS)) {
        const op = this.advance().value;
        const right = this.parseMultiplication();
        left = ASTNode.BinaryOp(op, left, right);
      }

      return left;
    }

    // Multiplication → Unary ((* | /) Unary)*
    parseMultiplication() {
      let left = this.parseUnary();

      while (this.match(TokenType.MULTIPLY, TokenType.DIVIDE)) {
        const op = this.advance().value;
        const right = this.parseUnary();
        left = ASTNode.BinaryOp(op, left, right);
      }

      return left;
    }

    // Unary → (- | NOT) Unary | Chain
    parseUnary() {
      if (this.match(TokenType.MINUS)) {
        this.advance();
        return ASTNode.UnaryOp('-', this.parseUnary());
      }
      return this.parseChain();
    }

    // Chain → Primary (. identifier | . AGGREGATION() | [filter])*
    parseChain() {
      let node = this.parsePrimary();

      while (this.match(TokenType.DOT, TokenType.LBRACKET)) {
        if (this.match(TokenType.DOT)) {
          this.advance(); // consume .

          // Check for aggregation (.SUM(), .COUNT(), etc.)
          if (this.match(TokenType.IDENTIFIER, TokenType.FUNCTION)) {
            const name = this.advance().value;
            const upper = name.toUpperCase();

            // Check if it's an aggregation function
            const aggregations = ['SUM', 'COUNT', 'AVG', 'AVERAGE', 'MIN', 'MAX', 'FIRST', 'LAST', 'CONCAT', 'COLLECT'];
            if (aggregations.includes(upper) && this.match(TokenType.LPAREN)) {
              this.advance(); // (
              this.expect(TokenType.RPAREN); // )
              node = ASTNode.Aggregation(node, upper);
            } else {
              // Property access
              node = ASTNode.PropertyAccess(node, name);
            }
          }
        } else if (this.match(TokenType.LBRACKET)) {
          // Filter [condition]
          this.advance(); // [
          const condition = this.parseExpression();
          this.expect(TokenType.RBRACKET);
          node = ASTNode.Filter(node, condition);
        }
      }

      return node;
    }

    // Primary → Literal | FieldRef | SetFieldRef | CurrentItem | FunctionCall | (Expression)
    parsePrimary() {
      const token = this.peek();

      // Literals
      if (this.match(TokenType.NUMBER)) {
        this.advance();
        return ASTNode.Literal(token.value, 'number');
      }
      if (this.match(TokenType.STRING)) {
        this.advance();
        return ASTNode.Literal(token.value, 'string');
      }
      if (this.match(TokenType.BOOLEAN)) {
        this.advance();
        return ASTNode.Literal(token.value, 'boolean');
      }

      // Field reference {Field Name}
      if (this.match(TokenType.FIELD_REF)) {
        this.advance();
        return ASTNode.FieldRef(token.value);
      }

      // Set.Field reference #Set.Field
      if (this.match(TokenType.SET_FIELD_REF)) {
        this.advance();
        return ASTNode.SetFieldRef(token.value);
      }

      // Current item $ or $.property
      if (this.match(TokenType.CURRENT_ITEM)) {
        this.advance();
        if (this.match(TokenType.DOT)) {
          this.advance();
          if (this.match(TokenType.IDENTIFIER, TokenType.FUNCTION)) {
            const prop = this.advance().value;
            return ASTNode.CurrentItemProperty(prop);
          }
        }
        return ASTNode.CurrentItem();
      }

      // Function call
      if (this.match(TokenType.FUNCTION)) {
        const name = this.advance().value;
        this.expect(TokenType.LPAREN);
        const args = this.parseArgumentList();
        this.expect(TokenType.RPAREN);
        return ASTNode.FunctionCall(name, args);
      }

      // Identifier (could be function or field without braces)
      if (this.match(TokenType.IDENTIFIER)) {
        const name = this.advance().value;
        // Check if it's a function call
        if (this.match(TokenType.LPAREN)) {
          this.advance(); // (
          const args = this.parseArgumentList();
          this.expect(TokenType.RPAREN);
          return ASTNode.FunctionCall(name.toUpperCase(), args);
        }
        // Treat as field reference
        return ASTNode.FieldRef(name);
      }

      // Parenthesized expression
      if (this.match(TokenType.LPAREN)) {
        this.advance();
        const expr = this.parseExpression();
        this.expect(TokenType.RPAREN);
        return expr;
      }

      throw new Error(`Unexpected token: ${token.type}`);
    }

    // ArgumentList → (Expression (, Expression)*)?
    parseArgumentList() {
      const args = [];

      if (!this.match(TokenType.RPAREN)) {
        args.push(this.parseExpression());

        while (this.match(TokenType.COMMA)) {
          this.advance();
          args.push(this.parseExpression());
        }
      }

      return args;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // AST TO PIPELINE CONVERTER
  // ═══════════════════════════════════════════════════════════════

  const Op = window.EOFormulaFunctions?.Op || {
    CON: 'CON',
    SEG: 'SEG',
    DES: 'DES',
    SYN: 'SYN',
    ALT: 'ALT',
    NUL: 'NUL',
    INS: 'INS',
    SUP: 'SUP',
  };

  function astToPipeline(ast, context = {}) {

    function convert(node) {
      if (!node) return { pipeline: [], value: null };

      switch (node.type) {
        case 'Literal':
          return {
            pipeline: [],
            value: node.value,
            valueType: node.dataType,
          };

        case 'FieldRef':
          return {
            pipeline: [
              { operator: Op.DES, params: { property: node.name, scope: 'local' } }
            ],
            isFieldRef: true,
            fieldName: node.name,
          };

        case 'SetFieldRef': {
          const parts = node.parts;
          const pipeline = [];

          // First part is the Set (CON)
          pipeline.push({
            operator: Op.CON,
            params: { source: parts[0] }
          });

          // Middle parts are chained traversals (more CON)
          for (let i = 1; i < parts.length - 1; i++) {
            pipeline.push({
              operator: Op.CON,
              params: { source: parts[i] }
            });
          }

          // Last part is the field (DES)
          if (parts.length > 1) {
            pipeline.push({
              operator: Op.DES,
              params: { property: parts[parts.length - 1] }
            });
          }

          return { pipeline, isSetRef: true, path: node.path };
        }

        case 'CurrentItem':
          return {
            pipeline: [],
            isCurrent: true,
          };

        case 'CurrentItemProperty':
          return {
            pipeline: [
              { operator: Op.DES, params: { property: node.property, scope: 'current' } }
            ],
            isCurrent: true,
            property: node.property,
          };

        case 'PropertyAccess': {
          const source = convert(node.source);
          return {
            pipeline: [
              ...source.pipeline,
              { operator: Op.DES, params: { property: node.property } }
            ],
          };
        }

        case 'Aggregation': {
          const source = convert(node.source);
          return {
            pipeline: [
              ...source.pipeline,
              { operator: Op.SYN, params: { mode: node.mode } }
            ],
          };
        }

        case 'Filter': {
          const source = convert(node.source);
          const condition = convert(node.condition);
          return {
            pipeline: [
              ...source.pipeline,
              { operator: Op.SEG, params: { condition: condition } }
            ],
            isFilter: true,
          };
        }

        case 'BinaryOp': {
          const left = convert(node.left);
          const right = convert(node.right);

          // Arithmetic operators
          if (['+', '-', '*', '/'].includes(node.operator)) {
            return {
              pipeline: [
                {
                  operator: Op.ALT,
                  params: {
                    mode: 'ARITHMETIC',
                    op: node.operator,
                    left: left,
                    right: right,
                  }
                }
              ],
            };
          }

          // Comparison operators
          if (['=', '!=', '>', '<', '>=', '<='].includes(node.operator)) {
            return {
              pipeline: [
                {
                  operator: Op.SEG,
                  params: {
                    mode: 'COMPARE',
                    op: node.operator,
                    left: left,
                    right: right,
                  }
                }
              ],
              returns: 'boolean',
            };
          }

          // Logical operators
          if (['AND', 'OR'].includes(node.operator)) {
            return {
              pipeline: [
                {
                  operator: Op.SYN,
                  params: {
                    mode: node.operator,
                    left: left,
                    right: right,
                  }
                }
              ],
              returns: 'boolean',
            };
          }

          throw new Error(`Unknown binary operator: ${node.operator}`);
        }

        case 'UnaryOp': {
          const operand = convert(node.operand);

          if (node.operator === '-') {
            return {
              pipeline: [
                {
                  operator: Op.ALT,
                  params: { mode: 'NEGATE', operand }
                }
              ],
            };
          }

          if (node.operator === 'NOT') {
            return {
              pipeline: [
                {
                  operator: Op.ALT,
                  params: { mode: 'NOT', operand }
                }
              ],
              returns: 'boolean',
            };
          }

          throw new Error(`Unknown unary operator: ${node.operator}`);
        }

        case 'FunctionCall': {
          const fnDef = window.EOFormulaFunctions?.get(node.name);
          const convertedArgs = node.args.map(arg => convert(arg));

          if (fnDef) {
            const fnPipeline = fnDef.toPipeline({ args: convertedArgs });
            return {
              pipeline: fnPipeline,
              functionName: node.name,
              args: convertedArgs,
            };
          }

          // Unknown function - wrap as ALT/FUNCTION
          return {
            pipeline: [
              {
                operator: Op.ALT,
                params: {
                  mode: 'FUNCTION',
                  function: node.name,
                  args: convertedArgs
                }
              }
            ],
            functionName: node.name,
            args: convertedArgs,
          };
        }

        case 'Concat': {
          const parts = node.parts.map(p => convert(p));
          return {
            pipeline: [
              { operator: Op.SYN, params: { mode: 'CONCAT', parts, separator: '' } }
            ],
          };
        }

        default:
          throw new Error(`Unknown AST node type: ${node.type}`);
      }
    }

    return convert(ast);
  }

  // ═══════════════════════════════════════════════════════════════
  // DEPENDENCY EXTRACTION
  // ═══════════════════════════════════════════════════════════════

  function extractDependencies(ast) {
    const deps = {
      localFields: [],     // {Field Name} references
      setFields: [],       // #Set.Field references
      functions: [],       // Functions used
      usesCurrentItem: false, // Uses $ syntax
    };

    function walk(node) {
      if (!node) return;

      switch (node.type) {
        case 'FieldRef':
          if (!deps.localFields.includes(node.name)) {
            deps.localFields.push(node.name);
          }
          break;

        case 'SetFieldRef':
          deps.setFields.push({
            path: node.path,
            set: node.parts[0],
            field: node.parts[node.parts.length - 1],
          });
          break;

        case 'CurrentItem':
        case 'CurrentItemProperty':
          deps.usesCurrentItem = true;
          break;

        case 'FunctionCall':
          if (!deps.functions.includes(node.name)) {
            deps.functions.push(node.name);
          }
          node.args.forEach(walk);
          break;

        case 'BinaryOp':
          walk(node.left);
          walk(node.right);
          break;

        case 'UnaryOp':
          walk(node.operand);
          break;

        case 'Filter':
          walk(node.source);
          walk(node.condition);
          break;

        case 'PropertyAccess':
          walk(node.source);
          break;

        case 'Aggregation':
          walk(node.source);
          break;

        case 'Concat':
          node.parts.forEach(walk);
          break;
      }
    }

    walk(ast);
    return deps;
  }

  // ═══════════════════════════════════════════════════════════════
  // RETURN TYPE INFERENCE
  // ═══════════════════════════════════════════════════════════════

  function inferReturnType(ast) {
    if (!ast) return 'unknown';

    switch (ast.type) {
      case 'Literal':
        return ast.dataType;

      case 'FunctionCall': {
        const fnDef = window.EOFormulaFunctions?.get(ast.name);
        if (fnDef?.returns) {
          return fnDef.returns;
        }
        return 'unknown';
      }

      case 'BinaryOp':
        if (['+', '-', '*', '/'].includes(ast.operator)) {
          return 'number';
        }
        if (['=', '!=', '>', '<', '>=', '<=', 'AND', 'OR'].includes(ast.operator)) {
          return 'boolean';
        }
        return 'unknown';

      case 'UnaryOp':
        if (ast.operator === '-') return 'number';
        if (ast.operator === 'NOT') return 'boolean';
        return 'unknown';

      case 'Concat':
        return 'text';

      case 'Aggregation':
        if (['SUM', 'AVG', 'AVERAGE', 'MIN', 'MAX', 'COUNT'].includes(ast.mode)) {
          return 'number';
        }
        if (ast.mode === 'CONCAT') return 'text';
        if (ast.mode === 'COLLECT') return 'array';
        return 'unknown';

      default:
        return 'unknown';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  return {
    TokenType,
    ASTNode,

    /**
     * Parse a formula expression
     * @param {string} expression - The formula text
     * @returns {{ ast: object, tokens: array, pipeline: object, dependencies: object, returnType: string }}
     */
    parse(expression) {
      if (!expression || typeof expression !== 'string') {
        return {
          expression: '',
          tokens: [],
          ast: null,
          pipeline: { pipeline: [] },
          dependencies: { localFields: [], setFields: [], functions: [], usesCurrentItem: false },
          returnType: 'unknown',
        };
      }

      try {
        const tokenizer = new Tokenizer(expression.trim());
        const tokens = tokenizer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const pipeline = astToPipeline(ast);
        const dependencies = extractDependencies(ast);
        const returnType = inferReturnType(ast);

        return {
          expression,
          tokens,
          ast,
          pipeline,
          dependencies,
          returnType,
        };
      } catch (error) {
        return {
          expression,
          tokens: [],
          ast: null,
          pipeline: { pipeline: [] },
          dependencies: { localFields: [], setFields: [], functions: [], usesCurrentItem: false },
          returnType: 'error',
          error: error.message,
        };
      }
    },

    /**
     * Validate a formula expression
     * @returns {{ valid: boolean, error?: string }}
     */
    validate(expression) {
      try {
        const result = this.parse(expression);
        if (result.error) {
          return { valid: false, error: result.error };
        }
        return { valid: true };
      } catch (error) {
        return { valid: false, error: error.message };
      }
    },

    /**
     * Get tokens only (for syntax highlighting)
     */
    tokenize(expression) {
      try {
        const tokenizer = new Tokenizer(expression.trim());
        return tokenizer.tokenize();
      } catch (error) {
        return [];
      }
    },

    /**
     * Get a human-readable description of the pipeline
     */
    describePipeline(expression) {
      const parsed = this.parse(expression);
      if (parsed.error) return parsed.error;

      const steps = parsed.pipeline.pipeline || [];
      if (steps.length === 0) return 'No pipeline steps';

      const opLabels = {
        CON: 'Connect',
        SEG: 'Segment',
        SYN: 'Synthesize',
        ALT: 'Transform',
        DES: 'Designate',
        NUL: 'Null Handler',
        INS: 'Instantiate',
        SUP: 'Superposition',
      };

      return steps.map((step, i) => {
        const label = opLabels[step.operator] || step.operator;
        const params = step.params ? ` (${JSON.stringify(step.params)})` : '';
        return `${i + 1}. ${step.operator} → ${label}${params}`;
      }).join('\n');
    },
  };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.EOFormulaParserV2;
}
