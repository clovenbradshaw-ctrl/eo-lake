/**
 * EO Query Language - Dual Parser for EOQL and SQL
 *
 * Two input languages, one output: OperatorChain
 *
 * EOQL (EO Query Language):
 *   Pipe-based, operator-explicit, EO-native
 *   Example:
 *     FROM caselink AS e
 *     |> SEG e.plaintiff CONTAINS 'WALLACE'
 *     |> CON payments AS p ON e.case_number = p.case_id TYPE LEFT CONFLICT EXPOSE_ALL
 *     |> ALT NOW
 *     |> DES 'Wallace_Evictions'
 *
 * SQL (with EO extensions):
 *   Standard SQL with required EO clauses
 *   Example:
 *     SELECT e.*, p.amount
 *     FROM caselink e
 *     LEFT JOIN payments p ON e.case_number = p.case_id
 *     CONFLICT EXPOSE_ALL
 *     WHERE e.plaintiff LIKE '%WALLACE%'
 *     AS OF NOW
 *     AS SET 'Wallace_Evictions'
 */

// ============================================================================
// Token Types
// ============================================================================

const TokenType = Object.freeze({
  // Keywords
  KEYWORD: 'KEYWORD',
  OPERATOR_KEYWORD: 'OPERATOR_KEYWORD',

  // Literals
  IDENTIFIER: 'IDENTIFIER',
  STRING: 'STRING',
  NUMBER: 'NUMBER',

  // Operators
  COMPARISON: 'COMPARISON',
  PIPE: 'PIPE',

  // Punctuation
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COMMA: 'COMMA',
  DOT: 'DOT',
  STAR: 'STAR',

  // Special
  EOF: 'EOF',
  UNKNOWN: 'UNKNOWN'
});

// EOQL operator keywords
const EOQL_OPERATORS = ['FROM', 'SEG', 'CON', 'ALT', 'DES', 'SYN', 'SUP', 'NUL', 'AGG', 'INS'];

// EOQL keywords
const EOQL_KEYWORDS = [
  'AS', 'ON', 'TYPE', 'CONFLICT', 'NOW', 'AS_OF', 'EVENTS', 'BETWEEN', 'VERSION',
  'STATIC', 'DYNAMIC', 'AND', 'OR', 'NOT', 'CONTAINS', 'STARTS', 'ENDS',
  'INNER', 'LEFT', 'RIGHT', 'FULL', 'EXPOSE_ALL', 'PICK_FIRST', 'PICK_LAST',
  'AGGREGATE', 'CLUSTER', 'CONFIDENCE', 'EVIDENCE', 'METHOD', 'EXPECT',
  'WITHIN', 'DAYS', 'OF', 'BASIS', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'GROUP', 'BY', 'WORLD_STATE', 'EVENT_TIME', 'DATA_VERSION',
  'SAME_ENTITY', 'DUPLICATE', 'ALIAS', 'UNRESOLVED', 'FRAME_DEPENDENT'
];

// SQL keywords
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'IS', 'NULL',
  'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'GROUP', 'HAVING',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'ON', 'AS', 'OF',
  'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'FIRST', 'LAST',
  'UNION', 'ALL', 'BETWEEN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  // EO extensions
  'CONFLICT', 'EXPOSE_ALL', 'PICK_FIRST', 'PICK_LAST', 'CLUSTER',
  'SET', 'AS_OF', 'NOW', 'VERSION', 'STATIC', 'DYNAMIC'
];

// ============================================================================
// Token
// ============================================================================

class Token {
  constructor(type, value, position) {
    this.type = type;
    this.value = value;
    this.position = position;
  }

  toString() {
    return `${this.type}(${this.value})`;
  }
}

// ============================================================================
// Tokenizer Base
// ============================================================================

class Tokenizer {
  constructor(input, keywords = [], operators = []) {
    this.input = input;
    this.pos = 0;
    this.keywords = new Set(keywords.map(k => k.toUpperCase()));
    this.operators = new Set(operators.map(o => o.toUpperCase()));
  }

  tokenize() {
    const tokens = [];

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const token = this.nextToken();
      if (token) tokens.push(token);
    }

    tokens.push(new Token(TokenType.EOF, null, this.pos));
    return tokens;
  }

  skipWhitespace() {
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        this.pos++;
      } else if (char === '-' && this.input[this.pos + 1] === '-') {
        // Single-line comment
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
          this.pos++;
        }
      } else {
        break;
      }
    }
  }

  nextToken() {
    const startPos = this.pos;
    const char = this.input[this.pos];

    // Pipe operator |>
    if (char === '|' && this.input[this.pos + 1] === '>') {
      this.pos += 2;
      return new Token(TokenType.PIPE, '|>', startPos);
    }

    // String literals
    if (char === "'" || char === '"') {
      return this.readString(char);
    }

    // Numbers
    if (this.isDigit(char) || (char === '-' && this.isDigit(this.input[this.pos + 1]))) {
      return this.readNumber();
    }

    // Identifiers and keywords
    if (this.isAlpha(char) || char === '_') {
      return this.readIdentifier();
    }

    // Comparison operators
    if (char === '=' || char === '!' || char === '<' || char === '>') {
      return this.readComparison();
    }

    // Punctuation
    switch (char) {
      case '(':
        this.pos++;
        return new Token(TokenType.LPAREN, '(', startPos);
      case ')':
        this.pos++;
        return new Token(TokenType.RPAREN, ')', startPos);
      case ',':
        this.pos++;
        return new Token(TokenType.COMMA, ',', startPos);
      case '.':
        this.pos++;
        return new Token(TokenType.DOT, '.', startPos);
      case '*':
        this.pos++;
        return new Token(TokenType.STAR, '*', startPos);
    }

    // Unknown
    this.pos++;
    return new Token(TokenType.UNKNOWN, char, startPos);
  }

  readString(quote) {
    const startPos = this.pos;
    this.pos++; // Skip opening quote
    let value = '';

    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      if (this.input[this.pos] === '\\' && this.pos + 1 < this.input.length) {
        this.pos++;
        value += this.input[this.pos];
      } else {
        value += this.input[this.pos];
      }
      this.pos++;
    }

    this.pos++; // Skip closing quote
    return new Token(TokenType.STRING, value, startPos);
  }

  readNumber() {
    const startPos = this.pos;
    let value = '';

    if (this.input[this.pos] === '-') {
      value += '-';
      this.pos++;
    }

    while (this.pos < this.input.length && (this.isDigit(this.input[this.pos]) || this.input[this.pos] === '.')) {
      value += this.input[this.pos];
      this.pos++;
    }

    return new Token(TokenType.NUMBER, parseFloat(value), startPos);
  }

  readIdentifier() {
    const startPos = this.pos;
    let value = '';

    while (this.pos < this.input.length && (this.isAlphaNumeric(this.input[this.pos]) || this.input[this.pos] === '_')) {
      value += this.input[this.pos];
      this.pos++;
    }

    const upper = value.toUpperCase();

    if (this.operators.has(upper)) {
      return new Token(TokenType.OPERATOR_KEYWORD, upper, startPos);
    }

    if (this.keywords.has(upper)) {
      return new Token(TokenType.KEYWORD, upper, startPos);
    }

    return new Token(TokenType.IDENTIFIER, value, startPos);
  }

  readComparison() {
    const startPos = this.pos;
    let value = this.input[this.pos];
    this.pos++;

    if (this.input[this.pos] === '=' || this.input[this.pos] === '>') {
      value += this.input[this.pos];
      this.pos++;
    }

    return new Token(TokenType.COMPARISON, value, startPos);
  }

  isDigit(char) {
    return char >= '0' && char <= '9';
  }

  isAlpha(char) {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }

  isAlphaNumeric(char) {
    return this.isAlpha(char) || this.isDigit(char);
  }
}

// ============================================================================
// EOQL Parser
// ============================================================================

class EOQLParser {
  constructor() {
    this.tokens = [];
    this.pos = 0;
  }

  /**
   * Parse EOQL query into OperatorChain
   * @param {string} query - EOQL query string
   * @returns {Object} - { success, chain, error }
   */
  parse(query) {
    try {
      const tokenizer = new Tokenizer(query, EOQL_KEYWORDS, EOQL_OPERATORS);
      this.tokens = tokenizer.tokenize();
      this.pos = 0;

      // We need OperatorChain from eo_query_builder.js
      // For now, we'll build a plain object that can be converted
      const pipeline = [];
      let grounding = null;

      // FROM source [AS alias]
      this.expect(TokenType.OPERATOR_KEYWORD, 'FROM');
      const source = this.parseSourceRef();
      pipeline.push({
        op: 'INS',
        params: { sourceId: source.id, alias: source.alias },
        epistemicType: 'given'
      });

      // Pipeline: |> OPERATOR ...
      while (this.match(TokenType.PIPE)) {
        const opToken = this.current();

        if (opToken.type !== TokenType.OPERATOR_KEYWORD && opToken.type !== TokenType.KEYWORD) {
          throw new Error(`Expected operator after |>, got ${opToken.type}`);
        }

        const op = opToken.value.toUpperCase();
        this.advance();

        switch (op) {
          case 'SEG':
            pipeline.push(this.parseSEG());
            break;

          case 'CON':
            pipeline.push(this.parseCON());
            break;

          case 'ALT':
            pipeline.push(this.parseALT());
            break;

          case 'DES':
            pipeline.push(this.parseDES());
            break;

          case 'SYN':
            pipeline.push(this.parseSYN());
            break;

          case 'SUP':
            pipeline.push(this.parseSUP());
            break;

          case 'NUL':
            pipeline.push(this.parseNUL());
            break;

          case 'AGG':
            pipeline.push(this.parseAGG());
            break;

          default:
            throw new Error(`Unknown operator: ${op}`);
        }
      }

      return {
        success: true,
        pipeline,
        query: query.trim()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        query: query.trim()
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Operator Parsers
  // ─────────────────────────────────────────────────────────────────────────

  parseSEG() {
    const predicate = this.parsePredicate();
    return {
      op: 'SEG',
      params: {
        predicate,
        visibilityType: 'VISIBLE'
      },
      epistemicType: 'derived_value'
    };
  }

  parseCON() {
    // CON source AS alias ON left = right TYPE LEFT CONFLICT EXPOSE_ALL
    const source = this.parseSourceRef();

    this.expect(TokenType.KEYWORD, 'ON');
    const leftKey = this.parseFieldRef();
    this.expect(TokenType.COMPARISON, '=');
    const rightKey = this.parseFieldRef();

    let type = 'LEFT';
    if (this.matchKeyword('TYPE')) {
      type = this.expectKeyword(['INNER', 'LEFT', 'RIGHT', 'FULL']);
    }

    this.expect(TokenType.KEYWORD, 'CONFLICT');
    const conflict = this.expectKeyword(['EXPOSE_ALL', 'PICK_FIRST', 'PICK_LAST', 'AGGREGATE', 'CLUSTER']);

    return {
      op: 'CON',
      params: {
        rightSourceId: source.id,
        alias: source.alias,
        on: { left: leftKey, right: rightKey },
        type,
        conflict
      },
      epistemicType: 'derived_value'
    };
  }

  parseALT() {
    const token = this.current();

    if (token.type === TokenType.KEYWORD && token.value === 'NOW') {
      this.advance();
      return {
        op: 'ALT',
        params: {
          temporalType: 'AS_OF',
          timestamp: 'NOW',
          semantics: 'WORLD_STATE',
          evaluation: 'DYNAMIC'
        },
        epistemicType: 'derived_value'
      };
    }

    if (token.type === TokenType.KEYWORD && token.value === 'AS_OF') {
      this.advance();
      const timestamp = this.expectString();

      let evaluation = 'STATIC';
      if (this.matchKeyword('STATIC')) {
        evaluation = 'STATIC';
      } else if (this.matchKeyword('DYNAMIC')) {
        evaluation = 'DYNAMIC';
      }

      let semantics = 'WORLD_STATE';
      if (this.matchKeyword('WORLD_STATE')) {
        semantics = 'WORLD_STATE';
      } else if (this.matchKeyword('EVENT_TIME')) {
        semantics = 'EVENT_TIME';
      }

      return {
        op: 'ALT',
        params: {
          temporalType: 'AS_OF',
          timestamp,
          semantics,
          evaluation
        },
        epistemicType: 'derived_value'
      };
    }

    if (token.type === TokenType.KEYWORD && token.value === 'EVENTS') {
      this.advance();
      this.expect(TokenType.KEYWORD, 'BETWEEN');
      const start = this.expectString();
      this.expect(TokenType.KEYWORD, 'AND');
      const end = this.expectString();

      return {
        op: 'ALT',
        params: {
          temporalType: 'BETWEEN',
          start,
          end,
          semantics: 'EVENT_TIME',
          evaluation: 'STATIC'
        },
        epistemicType: 'derived_value'
      };
    }

    if (token.type === TokenType.KEYWORD && token.value === 'VERSION') {
      this.advance();
      const versionId = this.expectString();

      return {
        op: 'ALT',
        params: {
          temporalType: 'VERSION',
          versionId,
          semantics: 'DATA_VERSION',
          evaluation: 'STATIC'
        },
        epistemicType: 'derived_value'
      };
    }

    throw new Error(`Invalid ALT specification. Expected NOW, AS_OF, EVENTS, or VERSION`);
  }

  parseDES() {
    const designation = this.expectString();
    return {
      op: 'DES',
      params: { designation },
      epistemicType: 'meant'
    };
  }

  parseSYN() {
    // SYN left = right CONFIDENCE 0.9 EVIDENCE 'reason' METHOD 'fuzzy'
    const left = this.parseFieldRef();
    this.expect(TokenType.COMPARISON, '=');
    const right = this.parseFieldRef();

    let confidence = null;
    let evidence = null;
    let method = null;
    let synthesisType = 'SAME_ENTITY';

    while (this.current().type === TokenType.KEYWORD) {
      const kw = this.current().value;

      if (kw === 'CONFIDENCE') {
        this.advance();
        confidence = this.expectNumber();
      } else if (kw === 'EVIDENCE') {
        this.advance();
        evidence = this.expectString();
      } else if (kw === 'METHOD') {
        this.advance();
        method = this.expectString();
      } else if (kw === 'SAME_ENTITY' || kw === 'DUPLICATE' || kw === 'ALIAS') {
        this.advance();
        synthesisType = kw;
      } else {
        break;
      }
    }

    if (!evidence) {
      throw new Error('SYN requires EVIDENCE clause');
    }

    return {
      op: 'SYN',
      params: {
        left: { field: left },
        right: { field: right },
        synthesisType,
        confidence,
        method
      },
      epistemicType: 'meant',
      grounding: {
        reason: evidence,
        method
      }
    };
  }

  parseSUP() {
    // SUP field1, field2 AS result RESOLUTION FRAME_DEPENDENT
    const fields = [this.parseFieldRef()];

    while (this.match(TokenType.COMMA)) {
      fields.push(this.parseFieldRef());
    }

    let outputField = null;
    if (this.matchKeyword('AS')) {
      outputField = this.expectIdentifier();
    }

    let resolution = 'UNRESOLVED';
    if (this.matchKeyword('RESOLUTION')) {
      resolution = this.expectKeyword(['UNRESOLVED', 'FRAME_DEPENDENT', 'DEFERRED']);
    }

    return {
      op: 'SUP',
      params: {
        superpositionType: 'CONFLICTING_VALUES',
        interpretations: fields.map(f => ({ field: f })),
        resolution,
        field: outputField
      },
      epistemicType: 'meant'
    };
  }

  parseNUL() {
    // NUL EXPECT target ON join_key WITHIN 90 DAYS OF field BASIS 'reason'
    this.expect(TokenType.KEYWORD, 'EXPECT');
    const targetSource = this.expectIdentifier();

    this.expect(TokenType.KEYWORD, 'ON');
    const joinKey = this.expectIdentifier();

    let timeConstraint = null;
    if (this.matchKeyword('WITHIN')) {
      const offset = this.expectNumber();
      const unit = this.expectKeyword(['DAYS', 'HOURS', 'MINUTES']);
      this.expect(TokenType.KEYWORD, 'OF');
      const relativeTo = this.expectIdentifier();

      timeConstraint = {
        maxOffset: `${offset}${unit.charAt(0).toLowerCase()}`,
        relativeTo,
        direction: 'WITHIN'
      };
    }

    this.expect(TokenType.KEYWORD, 'BASIS');
    const basis = this.expectString();

    return {
      op: 'NUL',
      params: {
        expectation: {
          expected: { targetSource, joinKey },
          timeConstraint,
          basis
        },
        outputType: 'ABSENCE_RECORDS'
      },
      epistemicType: 'derived_value'
    };
  }

  parseAGG() {
    // AGG COUNT(*) AS count, SUM(amount) AS total [GROUP BY field]
    const aggregations = [];

    do {
      const fn = this.expectKeyword(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'FIRST', 'LAST']);
      this.expect(TokenType.LPAREN);

      let field = '*';
      if (this.match(TokenType.STAR)) {
        field = '*';
      } else {
        field = this.parseFieldRef();
      }

      this.expect(TokenType.RPAREN);
      this.expect(TokenType.KEYWORD, 'AS');
      const alias = this.expectIdentifier();

      aggregations.push({ fn, field, as: alias });

    } while (this.match(TokenType.COMMA));

    let groupBy = null;
    if (this.matchKeyword('GROUP')) {
      this.expect(TokenType.KEYWORD, 'BY');
      groupBy = [this.parseFieldRef()];
      while (this.match(TokenType.COMMA)) {
        groupBy.push(this.parseFieldRef());
      }
    }

    return {
      op: 'AGG',
      params: { aggregations, groupBy },
      epistemicType: 'derived_value'
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Predicate Parsing
  // ─────────────────────────────────────────────────────────────────────────

  parsePredicate() {
    return this.parseOrExpr();
  }

  parseOrExpr() {
    let left = this.parseAndExpr();

    while (this.matchKeyword('OR')) {
      const right = this.parseAndExpr();
      left = { type: 'OR', conditions: [left, right] };
    }

    return left;
  }

  parseAndExpr() {
    let left = this.parseNotExpr();

    while (this.matchKeyword('AND')) {
      const right = this.parseNotExpr();
      left = { type: 'AND', conditions: [left, right] };
    }

    return left;
  }

  parseNotExpr() {
    if (this.matchKeyword('NOT')) {
      const operand = this.parseComparison();
      return { type: 'NOT', operand };
    }

    return this.parseComparison();
  }

  parseComparison() {
    // Handle parentheses
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parsePredicate();
      this.expect(TokenType.RPAREN);
      return expr;
    }

    const field = this.parseFieldRef();

    // Check for comparison operator or keyword
    const token = this.current();

    if (token.type === TokenType.COMPARISON) {
      const op = this.mapComparisonOp(token.value);
      this.advance();
      const value = this.parseValue();
      return { type: 'COMPARISON', field, operator: op, value };
    }

    if (token.type === TokenType.KEYWORD) {
      const kw = token.value;

      if (kw === 'CONTAINS') {
        this.advance();
        const value = this.expectString();
        return { type: 'COMPARISON', field, operator: 'contains', value };
      }

      if (kw === 'STARTS') {
        this.advance();
        const value = this.expectString();
        return { type: 'COMPARISON', field, operator: 'starts', value };
      }

      if (kw === 'ENDS') {
        this.advance();
        const value = this.expectString();
        return { type: 'COMPARISON', field, operator: 'ends', value };
      }

      if (kw === 'IN') {
        this.advance();
        this.expect(TokenType.LPAREN);
        const values = this.parseValueList();
        this.expect(TokenType.RPAREN);
        return { type: 'COMPARISON', field, operator: 'in', value: values };
      }

      if (kw === 'BETWEEN') {
        this.advance();
        const low = this.parseValue();
        this.expect(TokenType.KEYWORD, 'AND');
        const high = this.parseValue();
        return { type: 'COMPARISON', field, operator: 'between', value: [low, high] };
      }

      if (kw === 'IS') {
        this.advance();
        if (this.matchKeyword('NOT')) {
          this.expect(TokenType.KEYWORD, 'NULL');
          return { type: 'COMPARISON', field, operator: 'notnull', value: null };
        }
        this.expect(TokenType.KEYWORD, 'NULL');
        return { type: 'COMPARISON', field, operator: 'null', value: null };
      }
    }

    throw new Error(`Expected comparison operator after field ${field}`);
  }

  mapComparisonOp(op) {
    switch (op) {
      case '=':
      case '==':
        return 'eq';
      case '!=':
      case '<>':
        return 'neq';
      case '>':
        return 'gt';
      case '>=':
        return 'gte';
      case '<':
        return 'lt';
      case '<=':
        return 'lte';
      default:
        return 'eq';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────

  parseSourceRef() {
    const id = this.expectIdentifier();
    let alias = null;

    if (this.matchKeyword('AS')) {
      alias = this.expectIdentifier();
    }

    return { id, alias };
  }

  parseFieldRef() {
    let field = this.expectIdentifier();

    // Handle dotted notation: table.field
    while (this.match(TokenType.DOT)) {
      field += '.' + this.expectIdentifier();
    }

    return field;
  }

  parseValue() {
    const token = this.current();

    if (token.type === TokenType.STRING) {
      this.advance();
      return token.value;
    }

    if (token.type === TokenType.NUMBER) {
      this.advance();
      return token.value;
    }

    if (token.type === TokenType.KEYWORD && (token.value === 'TRUE' || token.value === 'FALSE')) {
      this.advance();
      return token.value === 'TRUE';
    }

    if (token.type === TokenType.KEYWORD && token.value === 'NULL') {
      this.advance();
      return null;
    }

    throw new Error(`Expected value, got ${token.type}`);
  }

  parseValueList() {
    const values = [this.parseValue()];

    while (this.match(TokenType.COMMA)) {
      values.push(this.parseValue());
    }

    return values;
  }

  current() {
    return this.tokens[this.pos] || new Token(TokenType.EOF, null, 0);
  }

  advance() {
    this.pos++;
    return this.tokens[this.pos - 1];
  }

  match(type, value = null) {
    const token = this.current();
    if (token.type === type && (value === null || token.value === value)) {
      this.advance();
      return true;
    }
    return false;
  }

  matchKeyword(keyword) {
    const token = this.current();
    if ((token.type === TokenType.KEYWORD || token.type === TokenType.OPERATOR_KEYWORD) &&
        token.value.toUpperCase() === keyword.toUpperCase()) {
      this.advance();
      return true;
    }
    return false;
  }

  expect(type, value = null) {
    const token = this.current();
    if (token.type !== type || (value !== null && token.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` '${value}'` : ''}, got ${token.type} '${token.value}'`);
    }
    this.advance();
    return token;
  }

  expectKeyword(keywords) {
    const token = this.current();
    const upper = token.value?.toUpperCase();
    const valid = Array.isArray(keywords) ? keywords : [keywords];

    if ((token.type === TokenType.KEYWORD || token.type === TokenType.OPERATOR_KEYWORD) &&
        valid.includes(upper)) {
      this.advance();
      return upper;
    }

    throw new Error(`Expected one of [${valid.join(', ')}], got ${token.value}`);
  }

  expectIdentifier() {
    const token = this.current();
    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      return token.value;
    }
    throw new Error(`Expected identifier, got ${token.type} '${token.value}'`);
  }

  expectString() {
    const token = this.current();
    if (token.type === TokenType.STRING) {
      this.advance();
      return token.value;
    }
    throw new Error(`Expected string, got ${token.type}`);
  }

  expectNumber() {
    const token = this.current();
    if (token.type === TokenType.NUMBER) {
      this.advance();
      return token.value;
    }
    throw new Error(`Expected number, got ${token.type}`);
  }
}

// ============================================================================
// SQL Parser (with EO Extensions)
// ============================================================================

class SQLParser {
  constructor() {
    this.tokens = [];
    this.pos = 0;
  }

  /**
   * Parse SQL query into OperatorChain
   * @param {string} query - SQL query string
   * @returns {Object} - { success, pipeline, error }
   */
  parse(query) {
    try {
      const tokenizer = new Tokenizer(query, SQL_KEYWORDS, []);
      this.tokens = tokenizer.tokenize();
      this.pos = 0;

      const pipeline = [];
      let selectFields = [];
      let aggregates = [];

      // SELECT
      this.expect(TokenType.KEYWORD, 'SELECT');

      // DISTINCT?
      const distinct = this.matchKeyword('DISTINCT');

      // Column list
      const columns = this.parseColumnList();
      selectFields = columns.fields;
      aggregates = columns.aggregates;

      // FROM
      this.expect(TokenType.KEYWORD, 'FROM');

      // Table/source reference
      const source = this.parseSourceRef();
      pipeline.push({
        op: 'INS',
        params: { sourceId: source.id, alias: source.alias },
        epistemicType: 'given'
      });

      // JOIN clauses
      while (this.isJoinKeyword()) {
        const join = this.parseJoin();
        pipeline.push({
          op: 'CON',
          params: join,
          epistemicType: 'derived_value'
        });
      }

      // CONFLICT clause (EO extension - required after JOIN)
      let conflictPolicy = null;
      if (this.matchKeyword('CONFLICT')) {
        conflictPolicy = this.expectKeyword(['EXPOSE_ALL', 'PICK_FIRST', 'PICK_LAST', 'AGGREGATE', 'CLUSTER']);

        // Apply conflict policy to last CON operator
        const lastCon = pipeline.filter(op => op.op === 'CON').pop();
        if (lastCon) {
          lastCon.params.conflict = conflictPolicy;
        }
      }

      // WHERE
      if (this.matchKeyword('WHERE')) {
        const predicate = this.parseWherePredicate();
        pipeline.push({
          op: 'SEG',
          params: { predicate, visibilityType: 'VISIBLE' },
          epistemicType: 'derived_value'
        });
      }

      // GROUP BY
      if (this.matchKeyword('GROUP')) {
        this.expect(TokenType.KEYWORD, 'BY');
        const groupFields = this.parseIdentifierList();

        pipeline.push({
          op: 'AGG',
          params: {
            aggregations: aggregates.map(agg => ({
              fn: agg.fn,
              field: agg.field,
              as: agg.alias
            })),
            groupBy: groupFields
          },
          epistemicType: 'derived_value'
        });
      }

      // ORDER BY (converts to metadata, not a separate operator)
      // LIMIT (converts to SEG with limit)

      // AS OF clause (EO extension - temporal context)
      if (this.matchKeyword('AS')) {
        if (this.matchKeyword('OF')) {
          if (this.matchKeyword('NOW')) {
            pipeline.push({
              op: 'ALT',
              params: {
                temporalType: 'AS_OF',
                timestamp: 'NOW',
                semantics: 'WORLD_STATE',
                evaluation: 'DYNAMIC'
              },
              epistemicType: 'derived_value'
            });
          } else {
            const timestamp = this.expectString();
            let evaluation = 'STATIC';
            if (this.matchKeyword('STATIC')) evaluation = 'STATIC';
            if (this.matchKeyword('DYNAMIC')) evaluation = 'DYNAMIC';

            pipeline.push({
              op: 'ALT',
              params: {
                temporalType: 'AS_OF',
                timestamp,
                semantics: 'WORLD_STATE',
                evaluation
              },
              epistemicType: 'derived_value'
            });
          }
        } else if (this.matchKeyword('SET')) {
          // AS SET 'name' (EO extension - name the result)
          const setName = this.expectString();
          pipeline.push({
            op: 'DES',
            params: { designation: setName },
            epistemicType: 'meant'
          });
        }
      }

      // Check for second AS (for AS SET after AS OF)
      if (this.matchKeyword('AS')) {
        if (this.matchKeyword('SET')) {
          const setName = this.expectString();
          pipeline.push({
            op: 'DES',
            params: { designation: setName },
            epistemicType: 'meant'
          });
        }
      }

      // Validate: JOIN requires CONFLICT
      const hasJoin = pipeline.some(op => op.op === 'CON');
      if (hasJoin && !conflictPolicy) {
        throw new Error('JOIN requires CONFLICT clause. Add: CONFLICT EXPOSE_ALL (or PICK_FIRST, PICK_LAST, AGGREGATE, CLUSTER)');
      }

      // Add default ALT if not specified
      const hasAlt = pipeline.some(op => op.op === 'ALT');
      if (!hasAlt) {
        pipeline.push({
          op: 'ALT',
          params: {
            temporalType: 'AS_OF',
            timestamp: 'NOW',
            semantics: 'WORLD_STATE',
            evaluation: 'DYNAMIC'
          },
          epistemicType: 'derived_value'
        });
      }

      return {
        success: true,
        pipeline,
        selectFields,
        query: query.trim()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        query: query.trim()
      };
    }
  }

  isJoinKeyword() {
    const token = this.current();
    if (token.type !== TokenType.KEYWORD) return false;
    return ['JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER'].includes(token.value);
  }

  parseJoin() {
    let type = 'INNER';

    if (this.matchKeyword('LEFT')) {
      type = 'LEFT';
      this.matchKeyword('OUTER');
    } else if (this.matchKeyword('RIGHT')) {
      type = 'RIGHT';
      this.matchKeyword('OUTER');
    } else if (this.matchKeyword('FULL')) {
      type = 'FULL';
      this.matchKeyword('OUTER');
    } else if (this.matchKeyword('INNER')) {
      type = 'INNER';
    }

    this.expect(TokenType.KEYWORD, 'JOIN');
    const source = this.parseSourceRef();

    this.expect(TokenType.KEYWORD, 'ON');
    const leftKey = this.parseFieldRef();
    this.expect(TokenType.COMPARISON, '=');
    const rightKey = this.parseFieldRef();

    return {
      rightSourceId: source.id,
      alias: source.alias,
      on: { left: leftKey, right: rightKey },
      type,
      conflict: null  // Will be set by CONFLICT clause
    };
  }

  parseColumnList() {
    const fields = [];
    const aggregates = [];
    let isSelectAll = false;

    do {
      if (this.match(TokenType.STAR)) {
        isSelectAll = true;
        fields.push('*');
      } else if (this.isAggregateKeyword()) {
        const fn = this.current().value;
        this.advance();
        this.expect(TokenType.LPAREN);

        let field = '*';
        if (this.match(TokenType.STAR)) {
          field = '*';
        } else {
          field = this.parseFieldRef();
        }
        this.expect(TokenType.RPAREN);

        let alias = `${fn.toLowerCase()}_${field}`;
        if (this.matchKeyword('AS')) {
          alias = this.expectIdentifier();
        }

        aggregates.push({ fn, field, alias });
        fields.push(alias);

      } else {
        let field = this.parseFieldRef();
        let alias = field;

        if (this.matchKeyword('AS')) {
          alias = this.expectIdentifier();
        }

        fields.push(alias);
      }
    } while (this.match(TokenType.COMMA));

    return { fields, aggregates, isSelectAll };
  }

  isAggregateKeyword() {
    const token = this.current();
    return token.type === TokenType.KEYWORD &&
           ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'FIRST', 'LAST'].includes(token.value);
  }

  parseWherePredicate() {
    return this.parseOrExpr();
  }

  parseOrExpr() {
    let left = this.parseAndExpr();

    while (this.matchKeyword('OR')) {
      const right = this.parseAndExpr();
      left = { type: 'OR', conditions: [left, right] };
    }

    return left;
  }

  parseAndExpr() {
    let left = this.parseNotExpr();

    while (this.matchKeyword('AND')) {
      const right = this.parseNotExpr();
      left = { type: 'AND', conditions: [left, right] };
    }

    return left;
  }

  parseNotExpr() {
    if (this.matchKeyword('NOT')) {
      const operand = this.parseComparison();
      return { type: 'NOT', operand };
    }
    return this.parseComparison();
  }

  parseComparison() {
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseWherePredicate();
      this.expect(TokenType.RPAREN);
      return expr;
    }

    const field = this.parseFieldRef();
    const token = this.current();

    // IS NULL / IS NOT NULL
    if (token.type === TokenType.KEYWORD && token.value === 'IS') {
      this.advance();
      const not = this.matchKeyword('NOT');
      this.expect(TokenType.KEYWORD, 'NULL');
      return {
        type: 'COMPARISON',
        field,
        operator: not ? 'notnull' : 'null',
        value: null
      };
    }

    // IN (...)
    if (token.type === TokenType.KEYWORD && token.value === 'IN') {
      this.advance();
      this.expect(TokenType.LPAREN);
      const values = this.parseValueList();
      this.expect(TokenType.RPAREN);
      return { type: 'COMPARISON', field, operator: 'in', value: values };
    }

    // LIKE
    if (token.type === TokenType.KEYWORD && token.value === 'LIKE') {
      this.advance();
      const pattern = this.expectString();

      // Convert SQL LIKE to predicate
      let operator = 'contains';
      let value = pattern;

      if (pattern.startsWith('%') && pattern.endsWith('%')) {
        operator = 'contains';
        value = pattern.slice(1, -1);
      } else if (pattern.startsWith('%')) {
        operator = 'ends';
        value = pattern.slice(1);
      } else if (pattern.endsWith('%')) {
        operator = 'starts';
        value = pattern.slice(0, -1);
      }

      return { type: 'COMPARISON', field, operator, value };
    }

    // BETWEEN
    if (token.type === TokenType.KEYWORD && token.value === 'BETWEEN') {
      this.advance();
      const low = this.parseValue();
      this.expect(TokenType.KEYWORD, 'AND');
      const high = this.parseValue();
      return { type: 'COMPARISON', field, operator: 'between', value: [low, high] };
    }

    // Standard comparison
    if (token.type === TokenType.COMPARISON) {
      const op = this.mapComparisonOp(token.value);
      this.advance();
      const value = this.parseValue();
      return { type: 'COMPARISON', field, operator: op, value };
    }

    throw new Error(`Expected comparison operator after ${field}`);
  }

  mapComparisonOp(op) {
    switch (op) {
      case '=': case '==': return 'eq';
      case '!=': case '<>': return 'neq';
      case '>': return 'gt';
      case '>=': return 'gte';
      case '<': return 'lt';
      case '<=': return 'lte';
      default: return 'eq';
    }
  }

  parseSourceRef() {
    const id = this.expectIdentifier();
    let alias = null;

    if (this.matchKeyword('AS') || this.current().type === TokenType.IDENTIFIER) {
      alias = this.expectIdentifier();
    }

    return { id, alias };
  }

  parseFieldRef() {
    let field = this.expectIdentifier();
    while (this.match(TokenType.DOT)) {
      field += '.' + this.expectIdentifier();
    }
    return field;
  }

  parseIdentifierList() {
    const ids = [this.expectIdentifier()];
    while (this.match(TokenType.COMMA)) {
      ids.push(this.expectIdentifier());
    }
    return ids;
  }

  parseValue() {
    const token = this.current();

    if (token.type === TokenType.STRING) {
      this.advance();
      return token.value;
    }

    if (token.type === TokenType.NUMBER) {
      this.advance();
      return token.value;
    }

    if (token.type === TokenType.KEYWORD && token.value === 'NULL') {
      this.advance();
      return null;
    }

    throw new Error(`Expected value, got ${token.type}`);
  }

  parseValueList() {
    const values = [this.parseValue()];
    while (this.match(TokenType.COMMA)) {
      values.push(this.parseValue());
    }
    return values;
  }

  // Token helpers
  current() {
    return this.tokens[this.pos] || new Token(TokenType.EOF, null, 0);
  }

  advance() {
    this.pos++;
    return this.tokens[this.pos - 1];
  }

  match(type, value = null) {
    const token = this.current();
    if (token.type === type && (value === null || token.value === value)) {
      this.advance();
      return true;
    }
    return false;
  }

  matchKeyword(keyword) {
    const token = this.current();
    if (token.type === TokenType.KEYWORD && token.value.toUpperCase() === keyword.toUpperCase()) {
      this.advance();
      return true;
    }
    return false;
  }

  expect(type, value = null) {
    const token = this.current();
    if (token.type !== type || (value !== null && token.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` '${value}'` : ''}, got ${token.type} '${token.value}'`);
    }
    this.advance();
    return token;
  }

  expectKeyword(keywords) {
    const token = this.current();
    const valid = Array.isArray(keywords) ? keywords : [keywords];
    if (token.type === TokenType.KEYWORD && valid.includes(token.value.toUpperCase())) {
      this.advance();
      return token.value.toUpperCase();
    }
    throw new Error(`Expected one of [${valid.join(', ')}], got ${token.value}`);
  }

  expectIdentifier() {
    const token = this.current();
    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      return token.value;
    }
    throw new Error(`Expected identifier, got ${token.type}`);
  }

  expectString() {
    const token = this.current();
    if (token.type === TokenType.STRING) {
      this.advance();
      return token.value;
    }
    throw new Error(`Expected string, got ${token.type}`);
  }
}

// ============================================================================
// Unified Query Parser
// ============================================================================

class QueryParser {
  /**
   * Parse a query string (auto-detects language)
   * @param {string} query - Query string in EOQL or SQL
   * @param {Object} options - { language: 'eoql' | 'sql' | 'auto' }
   * @returns {Object} - { success, pipeline, error, language }
   */
  static parse(query, options = {}) {
    const language = options.language || this.detectLanguage(query);

    let result;
    if (language === 'eoql') {
      const parser = new EOQLParser();
      result = parser.parse(query);
    } else if (language === 'sql') {
      const parser = new SQLParser();
      result = parser.parse(query);
    } else {
      return {
        success: false,
        error: `Unknown query language: ${language}`,
        query
      };
    }

    return {
      ...result,
      language
    };
  }

  /**
   * Detect query language
   */
  static detectLanguage(query) {
    const trimmed = query.trim().toUpperCase();

    // EOQL uses |> pipe operator
    if (query.includes('|>')) {
      return 'eoql';
    }

    // SQL starts with SELECT
    if (trimmed.startsWith('SELECT')) {
      return 'sql';
    }

    // EOQL starts with FROM but has no SELECT
    if (trimmed.startsWith('FROM') && !trimmed.includes('SELECT')) {
      return 'eoql';
    }

    // Default to SQL
    return 'sql';
  }

  /**
   * Convert parsed pipeline to OperatorChain
   * Requires eo_query_builder.js to be loaded
   */
  static toOperatorChain(parseResult) {
    if (!parseResult.success) {
      throw new Error(parseResult.error);
    }

    // If EOQueryBuilder is available, use it
    if (typeof window !== 'undefined' && window.EOQueryBuilder) {
      const chain = new window.EOQueryBuilder.OperatorChain();

      for (const op of parseResult.pipeline) {
        switch (op.op) {
          case 'INS':
            chain.fromSource(op.params.sourceId, op.params.alias);
            break;
          case 'SEG':
            chain.filter(op.params.predicate, { visibilityType: op.params.visibilityType });
            break;
          case 'CON':
            chain.join(op.params.rightSourceId, {
              alias: op.params.alias,
              on: op.params.on,
              type: op.params.type,
              conflict: op.params.conflict
            });
            break;
          case 'ALT':
            if (op.params.temporalType === 'AS_OF') {
              chain.asOf(op.params.timestamp, {
                semantics: op.params.semantics,
                evaluation: op.params.evaluation
              });
            } else if (op.params.temporalType === 'BETWEEN') {
              chain.eventsBetween(op.params.start, op.params.end);
            } else if (op.params.temporalType === 'VERSION') {
              chain.version(op.params.versionId);
            }
            break;
          case 'DES':
            chain.name(op.params.designation);
            break;
          case 'AGG':
            chain.aggregate(op.params.aggregations, op.params.groupBy);
            break;
          case 'SYN':
            chain.synthesize(op.params.left, op.params.right, {
              type: op.params.synthesisType,
              confidence: op.params.confidence,
              evidence: op.grounding?.reason,
              method: op.params.method
            });
            break;
          case 'SUP':
            chain.superpose({
              type: op.params.superpositionType,
              interpretations: op.params.interpretations,
              resolution: op.params.resolution,
              field: op.params.field
            });
            break;
          case 'NUL':
            chain.expectAbsence(op.params.expectation);
            break;
        }
      }

      return chain;
    }

    // Return raw pipeline if OperatorChain not available
    return parseResult.pipeline;
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TokenType,
    Token,
    Tokenizer,
    EOQLParser,
    SQLParser,
    QueryParser
  };
}

if (typeof window !== 'undefined') {
  window.EOQueryLanguage = {
    TokenType,
    Token,
    Tokenizer,
    EOQLParser,
    SQLParser,
    QueryParser
  };
}
