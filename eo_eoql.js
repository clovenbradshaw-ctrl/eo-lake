/**
 * EOQL - Epistemic Ontology Query Language
 *
 * A query language designed for systems that refuse to:
 * - collapse interpretation into fact
 * - collapse time into state
 * - collapse disagreement into error
 * - collapse absence into deletion
 *
 * EOQL exposes 6 primitives as the interrogative surface:
 * 1. GIVEN / MEANT - Distinguish facts from interpretations
 * 2. EXISTS vs VISIBLE - Separate existence from appearance
 * 3. UNDER FRAME - Evaluate truth under explicit assumptions
 * 4. AS OF / BETWEEN - Temporal projection (ALT)
 * 5. TRACE / GROUNDED BY - Provenance traversal (REC)
 * 6. ABSENCE - Query missing events (NUL)
 *
 * Plus SQL-like capabilities for standard queries on records.
 */

// ============================================================================
// EOQL Types and Constants
// ============================================================================

/**
 * Query modes for epistemic filtering
 */
const EOQLMode = Object.freeze({
  GIVEN: 'given',      // Only instantiated facts
  MEANT: 'meant',      // Only interpretations
  ALL: 'all'           // Both (default for SQL-style queries)
});

/**
 * Visibility modes for scope filtering
 */
const EOQLVisibility = Object.freeze({
  EXISTS: 'exists',    // Include hidden/segmented artifacts
  VISIBLE: 'visible'   // Only visible within current scope
});

/**
 * Time modes for temporal queries
 */
const EOQLTimeMode = Object.freeze({
  AS_OF: 'as_of',
  BETWEEN: 'between',
  CURRENT: 'current'
});

/**
 * Query target types
 */
const EOQLTarget = Object.freeze({
  RECORDS: 'records',
  EVENTS: 'events',
  CLAIMS: 'claims',
  EDGES: 'edges',
  ABSENCES: 'absences',
  ACTIVITIES: 'activities'
});

/**
 * Comparison operators
 */
const EOQLOperator = Object.freeze({
  EQ: '=',
  NE: '!=',
  GT: '>',
  GE: '>=',
  LT: '<',
  LE: '<=',
  IN: 'IN',
  NOT_IN: 'NOT IN',
  LIKE: 'LIKE',
  CONTAINS: 'CONTAINS',
  IS_NULL: 'IS NULL',
  IS_NOT_NULL: 'IS NOT NULL'
});

// ============================================================================
// EOQL Intermediate Representation (IR)
// ============================================================================

/**
 * EOQL-IR - The query plan representation
 *
 * Every EOQL query compiles to this structure before execution.
 * This ensures all dimensions are explicit - no silent defaults.
 */
class EOQLIR {
  constructor(options = {}) {
    // What we're selecting
    this.target = options.target || EOQLTarget.RECORDS;
    this.select = options.select || ['*'];

    // P1: GIVEN / MEANT mode
    this.epistemicMode = options.epistemicMode || EOQLMode.ALL;

    // P2: EXISTS / VISIBLE mode
    this.visibilityMode = options.visibilityMode || EOQLVisibility.VISIBLE;

    // P3: UNDER FRAME
    this.frame = options.frame || null;
    this.frameVersion = options.frameVersion || 'latest';

    // P4: AS OF / BETWEEN
    this.timeMode = options.timeMode || EOQLTimeMode.CURRENT;
    this.timeStart = options.timeStart || null;
    this.timeEnd = options.timeEnd || null;

    // P5: TRACE / GROUNDED BY
    this.trace = options.trace || false;
    this.traceDepth = options.traceDepth || 10;
    this.groundingFilters = options.groundingFilters || [];

    // P6: ABSENCE query
    this.absencePattern = options.absencePattern || null;
    this.absenceWindow = options.absenceWindow || null;

    // Standard SQL-like clauses
    this.from = options.from || null;  // Set/source name
    this.where = options.where || [];
    this.orderBy = options.orderBy || [];
    this.limit = options.limit || null;
    this.offset = options.offset || 0;

    // Join clauses (for linking across sets)
    this.joins = options.joins || [];

    // Aggregation
    this.groupBy = options.groupBy || [];
    this.having = options.having || [];
    this.aggregations = options.aggregations || [];

    // Return options
    this.returnOptions = {
      includeContext: options.includeContext !== false,
      includeFrame: options.includeFrame !== false,
      includeProvenance: options.includeProvenance || false,
      includeConflicts: options.includeConflicts || false,
      includeSuperseded: options.includeSuperseded || false,
      format: options.format || 'records'
    };

    // Query metadata
    this.metadata = {
      queryId: generateQueryId(),
      createdAt: new Date().toISOString(),
      source: options.source || 'user'
    };
  }

  /**
   * Convert to JSON for storage/transmission
   */
  toJSON() {
    return {
      target: this.target,
      select: this.select,
      epistemicMode: this.epistemicMode,
      visibilityMode: this.visibilityMode,
      frame: this.frame,
      frameVersion: this.frameVersion,
      timeMode: this.timeMode,
      timeStart: this.timeStart,
      timeEnd: this.timeEnd,
      trace: this.trace,
      traceDepth: this.traceDepth,
      groundingFilters: this.groundingFilters,
      absencePattern: this.absencePattern,
      absenceWindow: this.absenceWindow,
      from: this.from,
      where: this.where,
      orderBy: this.orderBy,
      limit: this.limit,
      offset: this.offset,
      joins: this.joins,
      groupBy: this.groupBy,
      having: this.having,
      aggregations: this.aggregations,
      returnOptions: this.returnOptions,
      metadata: this.metadata
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json) {
    return new EOQLIR(json);
  }

  /**
   * Clone with modifications
   */
  clone(modifications = {}) {
    return new EOQLIR({ ...this.toJSON(), ...modifications });
  }
}

function generateQueryId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `qry_${ts}_${rand}`;
}

// ============================================================================
// EOQL Parser
// ============================================================================

/**
 * Token types for EOQL lexer
 */
const TokenType = Object.freeze({
  // Keywords
  FIND: 'FIND',
  SELECT: 'SELECT',
  FROM: 'FROM',
  WHERE: 'WHERE',
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  ORDER: 'ORDER',
  BY: 'BY',
  ASC: 'ASC',
  DESC: 'DESC',
  LIMIT: 'LIMIT',
  OFFSET: 'OFFSET',
  JOIN: 'JOIN',
  ON: 'ON',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  INNER: 'INNER',
  GROUP: 'GROUP',
  HAVING: 'HAVING',

  // EOQL-specific keywords
  GIVEN: 'GIVEN',
  MEANT: 'MEANT',
  EXISTS: 'EXISTS',
  VISIBLE: 'VISIBLE',
  UNDER: 'UNDER',
  FRAME: 'FRAME',
  AS: 'AS',
  OF: 'OF',
  BETWEEN: 'BETWEEN',
  TRACE: 'TRACE',
  GROUNDED: 'GROUNDED',
  DEPTH: 'DEPTH',
  ABSENCE: 'ABSENCE',
  WITHIN: 'WITHIN',

  // Targets
  RECORDS: 'RECORDS',
  EVENTS: 'EVENTS',
  CLAIMS: 'CLAIMS',
  EDGES: 'EDGES',
  ABSENCES: 'ABSENCES',
  ACTIVITIES: 'ACTIVITIES',

  // Operators
  EQ: 'EQ',
  NE: 'NE',
  GT: 'GT',
  GE: 'GE',
  LT: 'LT',
  LE: 'LE',
  IN: 'IN',
  LIKE: 'LIKE',
  CONTAINS: 'CONTAINS',
  IS: 'IS',
  NULL: 'NULL',

  // Aggregations
  COUNT: 'COUNT',
  SUM: 'SUM',
  AVG: 'AVG',
  MIN: 'MIN',
  MAX: 'MAX',

  // Literals
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  IDENTIFIER: 'IDENTIFIER',

  // Punctuation
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  LBRACKET: 'LBRACKET',
  RBRACKET: 'RBRACKET',
  COMMA: 'COMMA',
  DOT: 'DOT',
  STAR: 'STAR',

  // End
  EOF: 'EOF'
});

/**
 * EOQL Lexer - Tokenizes EOQL query strings
 */
class EOQLLexer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.tokens = [];
  }

  static KEYWORDS = new Map([
    ['find', TokenType.FIND],
    ['select', TokenType.SELECT],
    ['from', TokenType.FROM],
    ['where', TokenType.WHERE],
    ['and', TokenType.AND],
    ['or', TokenType.OR],
    ['not', TokenType.NOT],
    ['order', TokenType.ORDER],
    ['by', TokenType.BY],
    ['asc', TokenType.ASC],
    ['desc', TokenType.DESC],
    ['limit', TokenType.LIMIT],
    ['offset', TokenType.OFFSET],
    ['join', TokenType.JOIN],
    ['on', TokenType.ON],
    ['left', TokenType.LEFT],
    ['right', TokenType.RIGHT],
    ['inner', TokenType.INNER],
    ['group', TokenType.GROUP],
    ['having', TokenType.HAVING],
    ['given', TokenType.GIVEN],
    ['meant', TokenType.MEANT],
    ['exists', TokenType.EXISTS],
    ['visible', TokenType.VISIBLE],
    ['under', TokenType.UNDER],
    ['frame', TokenType.FRAME],
    ['as', TokenType.AS],
    ['of', TokenType.OF],
    ['between', TokenType.BETWEEN],
    ['trace', TokenType.TRACE],
    ['grounded', TokenType.GROUNDED],
    ['depth', TokenType.DEPTH],
    ['absence', TokenType.ABSENCE],
    ['within', TokenType.WITHIN],
    ['records', TokenType.RECORDS],
    ['events', TokenType.EVENTS],
    ['claims', TokenType.CLAIMS],
    ['edges', TokenType.EDGES],
    ['absences', TokenType.ABSENCES],
    ['activities', TokenType.ACTIVITIES],
    ['in', TokenType.IN],
    ['like', TokenType.LIKE],
    ['contains', TokenType.CONTAINS],
    ['is', TokenType.IS],
    ['null', TokenType.NULL],
    ['count', TokenType.COUNT],
    ['sum', TokenType.SUM],
    ['avg', TokenType.AVG],
    ['min', TokenType.MIN],
    ['max', TokenType.MAX],
    ['true', TokenType.BOOLEAN],
    ['false', TokenType.BOOLEAN]
  ]);

  tokenize() {
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const char = this.input[this.pos];

      // String literal
      if (char === '"' || char === "'") {
        this.tokens.push(this.readString());
        continue;
      }

      // Number
      if (this.isDigit(char) || (char === '-' && this.isDigit(this.peek(1)))) {
        this.tokens.push(this.readNumber());
        continue;
      }

      // Identifier or keyword
      if (this.isAlpha(char) || char === '_') {
        this.tokens.push(this.readIdentifier());
        continue;
      }

      // Operators and punctuation
      switch (char) {
        case '=':
          this.pos++;
          this.tokens.push({ type: TokenType.EQ, value: '=' });
          break;
        case '!':
          if (this.peek(1) === '=') {
            this.pos += 2;
            this.tokens.push({ type: TokenType.NE, value: '!=' });
          } else {
            throw new EOQLParseError(`Unexpected character: ${char}`, this.pos);
          }
          break;
        case '>':
          if (this.peek(1) === '=') {
            this.pos += 2;
            this.tokens.push({ type: TokenType.GE, value: '>=' });
          } else {
            this.pos++;
            this.tokens.push({ type: TokenType.GT, value: '>' });
          }
          break;
        case '<':
          if (this.peek(1) === '=') {
            this.pos += 2;
            this.tokens.push({ type: TokenType.LE, value: '<=' });
          } else if (this.peek(1) === '>') {
            this.pos += 2;
            this.tokens.push({ type: TokenType.NE, value: '<>' });
          } else {
            this.pos++;
            this.tokens.push({ type: TokenType.LT, value: '<' });
          }
          break;
        case '(':
          this.pos++;
          this.tokens.push({ type: TokenType.LPAREN, value: '(' });
          break;
        case ')':
          this.pos++;
          this.tokens.push({ type: TokenType.RPAREN, value: ')' });
          break;
        case '[':
          this.pos++;
          this.tokens.push({ type: TokenType.LBRACKET, value: '[' });
          break;
        case ']':
          this.pos++;
          this.tokens.push({ type: TokenType.RBRACKET, value: ']' });
          break;
        case ',':
          this.pos++;
          this.tokens.push({ type: TokenType.COMMA, value: ',' });
          break;
        case '.':
          this.pos++;
          this.tokens.push({ type: TokenType.DOT, value: '.' });
          break;
        case '*':
          this.pos++;
          this.tokens.push({ type: TokenType.STAR, value: '*' });
          break;
        default:
          throw new EOQLParseError(`Unexpected character: ${char}`, this.pos);
      }
    }

    this.tokens.push({ type: TokenType.EOF, value: null });
    return this.tokens;
  }

  skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
    // Skip comments
    if (this.pos < this.input.length && this.input[this.pos] === '-' && this.peek(1) === '-') {
      while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
        this.pos++;
      }
      this.skipWhitespace();
    }
  }

  peek(offset = 0) {
    return this.input[this.pos + offset] || '';
  }

  isDigit(char) {
    return /[0-9]/.test(char);
  }

  isAlpha(char) {
    return /[a-zA-Z_]/.test(char);
  }

  isAlphaNumeric(char) {
    return /[a-zA-Z0-9_]/.test(char);
  }

  readString() {
    const quote = this.input[this.pos++];
    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      if (this.input[this.pos] === '\\') {
        this.pos++;
        if (this.pos < this.input.length) {
          value += this.input[this.pos++];
        }
      } else {
        value += this.input[this.pos++];
      }
    }
    this.pos++; // Skip closing quote
    return { type: TokenType.STRING, value };
  }

  readNumber() {
    let value = '';
    if (this.input[this.pos] === '-') {
      value += this.input[this.pos++];
    }
    while (this.pos < this.input.length && (this.isDigit(this.input[this.pos]) || this.input[this.pos] === '.')) {
      value += this.input[this.pos++];
    }
    return { type: TokenType.NUMBER, value: parseFloat(value) };
  }

  readIdentifier() {
    let value = '';
    while (this.pos < this.input.length && this.isAlphaNumeric(this.input[this.pos])) {
      value += this.input[this.pos++];
    }
    const lower = value.toLowerCase();
    const keyword = EOQLLexer.KEYWORDS.get(lower);
    if (keyword) {
      return { type: keyword, value: lower === 'true' ? true : lower === 'false' ? false : value };
    }
    return { type: TokenType.IDENTIFIER, value };
  }
}

/**
 * EOQL Parser - Parses tokens into EOQL IR
 */
class EOQLParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse() {
    const ir = new EOQLIR();

    // Handle FIND (EOQL style) or SELECT (SQL style)
    if (this.check(TokenType.FIND)) {
      this.parseFind(ir);
    } else if (this.check(TokenType.SELECT)) {
      this.parseSelect(ir);
    } else {
      throw new EOQLParseError('Query must start with FIND or SELECT', 0);
    }

    return ir;
  }

  /**
   * Parse EOQL-style FIND query
   * FIND <target> [GIVEN|MEANT] [EXISTS|VISIBLE] [UNDER FRAME <frame>] [AS OF <time>|BETWEEN <t1> AND <t2>]
   */
  parseFind(ir) {
    this.consume(TokenType.FIND);

    // Parse target
    if (this.check(TokenType.RECORDS)) {
      this.advance();
      ir.target = EOQLTarget.RECORDS;
    } else if (this.check(TokenType.EVENTS)) {
      this.advance();
      ir.target = EOQLTarget.EVENTS;
    } else if (this.check(TokenType.CLAIMS)) {
      this.advance();
      ir.target = EOQLTarget.CLAIMS;
    } else if (this.check(TokenType.EDGES)) {
      this.advance();
      ir.target = EOQLTarget.EDGES;
    } else if (this.check(TokenType.ABSENCES)) {
      this.advance();
      ir.target = EOQLTarget.ABSENCES;
    } else if (this.check(TokenType.ACTIVITIES)) {
      this.advance();
      ir.target = EOQLTarget.ACTIVITIES;
    }

    // Parse epistemic mode (GIVEN | MEANT)
    if (this.check(TokenType.GIVEN)) {
      this.advance();
      ir.epistemicMode = EOQLMode.GIVEN;
    } else if (this.check(TokenType.MEANT)) {
      this.advance();
      ir.epistemicMode = EOQLMode.MEANT;
    }

    // Parse visibility mode (EXISTS | VISIBLE)
    if (this.check(TokenType.EXISTS)) {
      this.advance();
      ir.visibilityMode = EOQLVisibility.EXISTS;
    } else if (this.check(TokenType.VISIBLE)) {
      this.advance();
      ir.visibilityMode = EOQLVisibility.VISIBLE;
    }

    // Parse UNDER FRAME
    if (this.check(TokenType.UNDER)) {
      this.advance();
      this.consume(TokenType.FRAME);
      const frameName = this.consume(TokenType.IDENTIFIER);
      ir.frame = frameName.value;
    }

    // Parse time clause (AS OF | BETWEEN)
    if (this.check(TokenType.AS)) {
      this.advance();
      this.consume(TokenType.OF);
      ir.timeMode = EOQLTimeMode.AS_OF;
      ir.timeStart = this.parseValue();
    } else if (this.check(TokenType.BETWEEN)) {
      this.advance();
      ir.timeMode = EOQLTimeMode.BETWEEN;
      ir.timeStart = this.parseValue();
      this.consume(TokenType.AND);
      ir.timeEnd = this.parseValue();
    }

    // Parse FROM clause
    if (this.check(TokenType.FROM)) {
      this.advance();
      const source = this.consume(TokenType.IDENTIFIER);
      ir.from = source.value;
    }

    // Parse WHERE clause
    if (this.check(TokenType.WHERE)) {
      this.advance();
      ir.where = this.parseWhereConditions();
    }

    // Parse TRACE
    if (this.check(TokenType.TRACE)) {
      this.advance();
      ir.trace = true;
      if (this.check(TokenType.DEPTH)) {
        this.advance();
        const depth = this.consume(TokenType.NUMBER);
        ir.traceDepth = depth.value;
      }
    }

    // Parse GROUNDED BY
    if (this.check(TokenType.GROUNDED)) {
      this.advance();
      this.consume(TokenType.BY);
      ir.groundingFilters = this.parseWhereConditions();
    }

    // Parse ORDER BY
    if (this.check(TokenType.ORDER)) {
      this.advance();
      this.consume(TokenType.BY);
      ir.orderBy = this.parseOrderBy();
    }

    // Parse LIMIT and OFFSET
    if (this.check(TokenType.LIMIT)) {
      this.advance();
      const limit = this.consume(TokenType.NUMBER);
      ir.limit = limit.value;
    }

    if (this.check(TokenType.OFFSET)) {
      this.advance();
      const offset = this.consume(TokenType.NUMBER);
      ir.offset = offset.value;
    }

    return ir;
  }

  /**
   * Parse SQL-style SELECT query
   */
  parseSelect(ir) {
    this.consume(TokenType.SELECT);

    ir.target = EOQLTarget.RECORDS;

    // Parse select list
    ir.select = this.parseSelectList();

    // Parse FROM
    if (this.check(TokenType.FROM)) {
      this.advance();
      const source = this.consume(TokenType.IDENTIFIER);
      ir.from = source.value;
    }

    // Parse JOINs
    while (this.check(TokenType.JOIN) || this.check(TokenType.LEFT) ||
           this.check(TokenType.RIGHT) || this.check(TokenType.INNER)) {
      ir.joins.push(this.parseJoin());
    }

    // Parse WHERE
    if (this.check(TokenType.WHERE)) {
      this.advance();
      ir.where = this.parseWhereConditions();
    }

    // Parse GROUP BY
    if (this.check(TokenType.GROUP)) {
      this.advance();
      this.consume(TokenType.BY);
      ir.groupBy = this.parseGroupBy();
    }

    // Parse HAVING
    if (this.check(TokenType.HAVING)) {
      this.advance();
      ir.having = this.parseWhereConditions();
    }

    // Parse ORDER BY
    if (this.check(TokenType.ORDER)) {
      this.advance();
      this.consume(TokenType.BY);
      ir.orderBy = this.parseOrderBy();
    }

    // Parse LIMIT and OFFSET
    if (this.check(TokenType.LIMIT)) {
      this.advance();
      const limit = this.consume(TokenType.NUMBER);
      ir.limit = limit.value;
    }

    if (this.check(TokenType.OFFSET)) {
      this.advance();
      const offset = this.consume(TokenType.NUMBER);
      ir.offset = offset.value;
    }

    // Check for EOQL extensions in SELECT queries
    // GIVEN/MEANT mode
    if (this.check(TokenType.GIVEN)) {
      this.advance();
      ir.epistemicMode = EOQLMode.GIVEN;
    } else if (this.check(TokenType.MEANT)) {
      this.advance();
      ir.epistemicMode = EOQLMode.MEANT;
    }

    return ir;
  }

  parseSelectList() {
    const list = [];

    if (this.check(TokenType.STAR)) {
      this.advance();
      list.push('*');
    } else {
      do {
        if (list.length > 0) {
          this.consume(TokenType.COMMA);
        }

        // Check for aggregation
        if (this.checkAggregation()) {
          list.push(this.parseAggregation());
        } else {
          const field = this.parseFieldReference();
          list.push(field);
        }
      } while (this.check(TokenType.COMMA));
    }

    return list;
  }

  checkAggregation() {
    return this.check(TokenType.COUNT) || this.check(TokenType.SUM) ||
           this.check(TokenType.AVG) || this.check(TokenType.MIN) ||
           this.check(TokenType.MAX);
  }

  parseAggregation() {
    const func = this.advance();
    this.consume(TokenType.LPAREN);
    let field = '*';
    if (!this.check(TokenType.STAR)) {
      field = this.parseFieldReference();
    } else {
      this.advance();
    }
    this.consume(TokenType.RPAREN);

    let alias = null;
    if (this.check(TokenType.AS)) {
      this.advance();
      alias = this.consume(TokenType.IDENTIFIER).value;
    }

    return {
      type: 'aggregation',
      function: func.value.toLowerCase(),
      field,
      alias
    };
  }

  parseFieldReference() {
    let field = this.consume(TokenType.IDENTIFIER).value;

    // Handle dotted field references (e.g., record.field)
    while (this.check(TokenType.DOT)) {
      this.advance();
      field += '.' + this.consume(TokenType.IDENTIFIER).value;
    }

    // Handle alias
    let alias = null;
    if (this.check(TokenType.AS)) {
      this.advance();
      alias = this.consume(TokenType.IDENTIFIER).value;
    }

    return alias ? { field, alias } : field;
  }

  parseWhereConditions() {
    const conditions = [];
    conditions.push(this.parseCondition());

    while (this.check(TokenType.AND) || this.check(TokenType.OR)) {
      const connector = this.advance().type === TokenType.AND ? 'AND' : 'OR';
      conditions.push({ connector, condition: this.parseCondition() });
    }

    return conditions;
  }

  parseCondition() {
    // Handle NOT
    if (this.check(TokenType.NOT)) {
      this.advance();
      return { not: true, condition: this.parseCondition() };
    }

    // Handle parenthesized expressions
    if (this.check(TokenType.LPAREN)) {
      this.advance();
      const inner = this.parseWhereConditions();
      this.consume(TokenType.RPAREN);
      return { group: inner };
    }

    // Standard condition: field op value
    const field = this.parseFieldReference();

    // Handle IS NULL / IS NOT NULL
    if (this.check(TokenType.IS)) {
      this.advance();
      if (this.check(TokenType.NOT)) {
        this.advance();
        this.consume(TokenType.NULL);
        return { field, op: EOQLOperator.IS_NOT_NULL, value: null };
      } else {
        this.consume(TokenType.NULL);
        return { field, op: EOQLOperator.IS_NULL, value: null };
      }
    }

    // Handle IN / NOT IN
    if (this.check(TokenType.NOT)) {
      this.advance();
      this.consume(TokenType.IN);
      const values = this.parseValueList();
      return { field, op: EOQLOperator.NOT_IN, value: values };
    }

    if (this.check(TokenType.IN)) {
      this.advance();
      const values = this.parseValueList();
      return { field, op: EOQLOperator.IN, value: values };
    }

    // Handle LIKE
    if (this.check(TokenType.LIKE)) {
      this.advance();
      const pattern = this.parseValue();
      return { field, op: EOQLOperator.LIKE, value: pattern };
    }

    // Handle CONTAINS
    if (this.check(TokenType.CONTAINS)) {
      this.advance();
      const value = this.parseValue();
      return { field, op: EOQLOperator.CONTAINS, value };
    }

    // Standard comparison operators
    const op = this.parseOperator();
    const value = this.parseValue();

    return { field, op, value };
  }

  parseOperator() {
    if (this.check(TokenType.EQ)) {
      this.advance();
      return EOQLOperator.EQ;
    }
    if (this.check(TokenType.NE)) {
      this.advance();
      return EOQLOperator.NE;
    }
    if (this.check(TokenType.GT)) {
      this.advance();
      return EOQLOperator.GT;
    }
    if (this.check(TokenType.GE)) {
      this.advance();
      return EOQLOperator.GE;
    }
    if (this.check(TokenType.LT)) {
      this.advance();
      return EOQLOperator.LT;
    }
    if (this.check(TokenType.LE)) {
      this.advance();
      return EOQLOperator.LE;
    }

    throw new EOQLParseError(`Expected operator, got ${this.current().type}`, this.pos);
  }

  parseValue() {
    if (this.check(TokenType.STRING)) {
      return this.advance().value;
    }
    if (this.check(TokenType.NUMBER)) {
      return this.advance().value;
    }
    if (this.check(TokenType.BOOLEAN)) {
      return this.advance().value;
    }
    if (this.check(TokenType.NULL)) {
      this.advance();
      return null;
    }
    if (this.check(TokenType.IDENTIFIER)) {
      return { ref: this.advance().value };
    }

    throw new EOQLParseError(`Expected value, got ${this.current().type}`, this.pos);
  }

  parseValueList() {
    this.consume(TokenType.LPAREN);
    const values = [];

    do {
      if (values.length > 0) {
        this.consume(TokenType.COMMA);
      }
      values.push(this.parseValue());
    } while (this.check(TokenType.COMMA));

    this.consume(TokenType.RPAREN);
    return values;
  }

  parseJoin() {
    let type = 'inner';
    if (this.check(TokenType.LEFT)) {
      this.advance();
      type = 'left';
    } else if (this.check(TokenType.RIGHT)) {
      this.advance();
      type = 'right';
    } else if (this.check(TokenType.INNER)) {
      this.advance();
    }

    this.consume(TokenType.JOIN);
    const table = this.consume(TokenType.IDENTIFIER).value;

    let alias = null;
    if (this.check(TokenType.AS)) {
      this.advance();
      alias = this.consume(TokenType.IDENTIFIER).value;
    }

    this.consume(TokenType.ON);
    const condition = this.parseCondition();

    return { type, table, alias, on: condition };
  }

  parseGroupBy() {
    const fields = [];

    do {
      if (fields.length > 0) {
        this.consume(TokenType.COMMA);
      }
      fields.push(this.parseFieldReference());
    } while (this.check(TokenType.COMMA));

    return fields;
  }

  parseOrderBy() {
    const orders = [];

    do {
      if (orders.length > 0) {
        this.consume(TokenType.COMMA);
      }

      const field = this.parseFieldReference();
      let direction = 'asc';

      if (this.check(TokenType.ASC)) {
        this.advance();
        direction = 'asc';
      } else if (this.check(TokenType.DESC)) {
        this.advance();
        direction = 'desc';
      }

      orders.push({ field, direction });
    } while (this.check(TokenType.COMMA));

    return orders;
  }

  check(type) {
    return this.current().type === type;
  }

  current() {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: null };
  }

  advance() {
    const token = this.current();
    this.pos++;
    return token;
  }

  consume(type) {
    if (!this.check(type)) {
      throw new EOQLParseError(`Expected ${type}, got ${this.current().type}`, this.pos);
    }
    return this.advance();
  }
}

/**
 * Parse an EOQL query string into IR
 */
function parseEOQL(query) {
  const lexer = new EOQLLexer(query);
  const tokens = lexer.tokenize();
  const parser = new EOQLParser(tokens);
  return parser.parse();
}

// ============================================================================
// EOQL Evaluator
// ============================================================================

/**
 * EOQL Evaluator - Executes queries against the EO data model
 */
class EOQLEvaluator {
  constructor(options = {}) {
    this.eventStore = options.eventStore || null;
    this.activityStore = options.activityStore || null;
    this.dataWorkbench = options.dataWorkbench || null;
  }

  /**
   * Execute an EOQL query
   */
  async execute(irOrQuery) {
    const ir = typeof irOrQuery === 'string' ? parseEOQL(irOrQuery) : irOrQuery;

    const result = {
      success: true,
      data: [],
      metadata: {
        queryId: ir.metadata.queryId,
        executedAt: new Date().toISOString(),
        frame: ir.frame,
        frameVersion: ir.frameVersion,
        timeMode: ir.timeMode,
        timeStart: ir.timeStart,
        timeEnd: ir.timeEnd,
        epistemicMode: ir.epistemicMode,
        visibilityMode: ir.visibilityMode,
        conflicts: [],
        warnings: []
      }
    };

    try {
      switch (ir.target) {
        case EOQLTarget.RECORDS:
          result.data = await this.executeRecordQuery(ir);
          break;
        case EOQLTarget.EVENTS:
          result.data = await this.executeEventQuery(ir);
          break;
        case EOQLTarget.CLAIMS:
          result.data = await this.executeClaimQuery(ir);
          break;
        case EOQLTarget.ACTIVITIES:
          result.data = await this.executeActivityQuery(ir);
          break;
        case EOQLTarget.ABSENCES:
          result.data = await this.executeAbsenceQuery(ir);
          break;
        default:
          result.data = await this.executeRecordQuery(ir);
      }

      // Apply trace if requested
      if (ir.trace && result.data.length > 0) {
        result.provenance = await this.traceProvenance(result.data, ir.traceDepth);
      }

      result.metadata.rowCount = result.data.length;

    } catch (error) {
      result.success = false;
      result.error = error.message;
      result.metadata.warnings.push(error.message);
    }

    return result;
  }

  /**
   * Execute a query against records (standard SQL-like behavior)
   */
  async executeRecordQuery(ir) {
    // Get the workbench to access sets and records
    const workbench = this.dataWorkbench || (typeof window !== 'undefined' && window.dataWorkbench);
    if (!workbench) {
      throw new EOQLError('Data workbench not available');
    }

    // Get the source set
    let records = [];
    if (ir.from) {
      const set = workbench.sets?.find(s =>
        s.name.toLowerCase() === ir.from.toLowerCase() || s.id === ir.from
      );
      if (!set) {
        throw new EOQLError(`Set not found: ${ir.from}`);
      }
      records = set.records || [];
    } else {
      // Query across all sets in current workspace
      const allSets = workbench.sets || [];
      for (const set of allSets) {
        const setRecords = (set.records || []).map(r => ({ ...r, _setId: set.id, _setName: set.name }));
        records.push(...setRecords);
      }
    }

    // Apply epistemic mode filter
    records = this.applyEpistemicFilter(records, ir);

    // Apply time filter
    records = this.applyTimeFilter(records, ir);

    // Apply WHERE conditions
    if (ir.where.length > 0) {
      records = records.filter(r => this.evaluateConditions(r, ir.where));
    }

    // Apply grounding filters
    if (ir.groundingFilters.length > 0) {
      records = this.applyGroundingFilter(records, ir.groundingFilters);
    }

    // Apply ORDER BY
    if (ir.orderBy.length > 0) {
      records = this.applyOrderBy(records, ir.orderBy);
    }

    // Apply LIMIT and OFFSET
    if (ir.offset > 0) {
      records = records.slice(ir.offset);
    }
    if (ir.limit !== null) {
      records = records.slice(0, ir.limit);
    }

    // Project selected fields
    if (ir.select.length > 0 && ir.select[0] !== '*') {
      records = records.map(r => this.projectFields(r, ir.select));
    }

    // Add metadata if requested
    if (ir.returnOptions.includeContext || ir.returnOptions.includeFrame) {
      records = records.map(r => this.enrichWithMetadata(r, ir));
    }

    return records;
  }

  /**
   * Execute a query against events
   */
  async executeEventQuery(ir) {
    const store = this.eventStore || (typeof window !== 'undefined' && window.getEventStore?.());
    if (!store) {
      throw new EOQLError('Event store not available');
    }

    let events = store.getAll();

    // Apply epistemic type filter
    if (ir.epistemicMode === EOQLMode.GIVEN) {
      events = events.filter(e => e.epistemicType === 'given');
    } else if (ir.epistemicMode === EOQLMode.MEANT) {
      events = events.filter(e => e.epistemicType === 'meant');
    }

    // Apply time filter
    events = this.applyEventTimeFilter(events, ir);

    // Apply WHERE conditions
    if (ir.where.length > 0) {
      events = events.filter(e => this.evaluateConditions(e, ir.where));
    }

    // Apply supersession filter
    if (!ir.returnOptions.includeSuperseded) {
      events = events.filter(e => !store.isSuperseded(e.id));
    }

    // Apply ORDER BY
    if (ir.orderBy.length > 0) {
      events = this.applyOrderBy(events, ir.orderBy);
    }

    // Apply LIMIT and OFFSET
    if (ir.offset > 0) {
      events = events.slice(ir.offset);
    }
    if (ir.limit !== null) {
      events = events.slice(0, ir.limit);
    }

    return events;
  }

  /**
   * Execute a query against claims (MEANT events with frames)
   */
  async executeClaimQuery(ir) {
    const store = this.eventStore || (typeof window !== 'undefined' && window.getEventStore?.());
    if (!store) {
      throw new EOQLError('Event store not available');
    }

    let claims = store.getMeant().filter(e => e.frame?.claim);

    // Apply time filter
    claims = this.applyEventTimeFilter(claims, ir);

    // Apply WHERE conditions
    if (ir.where.length > 0) {
      claims = claims.filter(c => this.evaluateConditions(c, ir.where));
    }

    // Apply supersession filter
    if (!ir.returnOptions.includeSuperseded) {
      claims = claims.filter(c => !store.isSuperseded(c.id));
    }

    // Apply ORDER BY
    if (ir.orderBy.length > 0) {
      claims = this.applyOrderBy(claims, ir.orderBy);
    }

    // Apply LIMIT and OFFSET
    if (ir.offset > 0) {
      claims = claims.slice(ir.offset);
    }
    if (ir.limit !== null) {
      claims = claims.slice(0, ir.limit);
    }

    // Format as claim objects
    return claims.map(c => ({
      id: c.id,
      claim: c.frame.claim,
      epistemicStatus: c.frame.epistemicStatus,
      caveats: c.frame.caveats,
      purpose: c.frame.purpose,
      timestamp: c.timestamp,
      actor: c.actor,
      grounding: c.grounding,
      _event: ir.returnOptions.includeContext ? c : undefined
    }));
  }

  /**
   * Execute a query against activities
   */
  async executeActivityQuery(ir) {
    const store = this.activityStore ||
      (typeof window !== 'undefined' && window.activityStore) ||
      (typeof window !== 'undefined' && await window.EOActivity?.getStore());

    if (!store) {
      throw new EOQLError('Activity store not available');
    }

    // Build activity store query filters
    const filters = {};

    // Extract simple equality conditions for activity store query
    for (const cond of ir.where) {
      if (typeof cond === 'object' && cond.field && cond.op === EOQLOperator.EQ) {
        if (cond.field === 'operator') filters.operator = cond.value;
        if (cond.field === 'entityId') filters.entityId = cond.value;
        if (cond.field === 'agent') filters.agent = cond.value;
      }
    }

    // Time range
    if (ir.timeStart) filters.startTime = ir.timeStart;
    if (ir.timeEnd) filters.endTime = ir.timeEnd;

    // Limit
    if (ir.limit) filters.limit = ir.limit;

    let activities = store.query(filters);

    // Apply remaining WHERE conditions not handled by store
    if (ir.where.length > 0) {
      activities = activities.filter(a => this.evaluateConditions(a, ir.where));
    }

    // Apply ORDER BY
    if (ir.orderBy.length > 0) {
      activities = this.applyOrderBy(activities, ir.orderBy);
    }

    return activities;
  }

  /**
   * Execute an absence query (NUL primitive)
   */
  async executeAbsenceQuery(ir) {
    if (!ir.absencePattern) {
      throw new EOQLError('Absence query requires an expectation pattern');
    }

    const store = this.eventStore || (typeof window !== 'undefined' && window.getEventStore?.());
    if (!store) {
      throw new EOQLError('Event store not available');
    }

    // Get events in the window
    let events = store.getAll();
    events = this.applyEventTimeFilter(events, ir);

    // Check for expected events that didn't occur
    const absences = [];

    // This is a simplified absence detection
    // A full implementation would use expectation rules
    if (ir.where.length > 0) {
      const expectedPattern = ir.where[0];

      // Check if any event matches the expected pattern
      const found = events.some(e => this.evaluateConditions(e, [expectedPattern]));

      if (!found) {
        absences.push({
          type: 'absence',
          pattern: expectedPattern,
          window: { start: ir.timeStart, end: ir.timeEnd },
          detectedAt: new Date().toISOString(),
          frame: ir.frame
        });
      }
    }

    return absences;
  }

  /**
   * Trace provenance for results
   */
  async traceProvenance(results, maxDepth) {
    const store = this.eventStore || (typeof window !== 'undefined' && window.getEventStore?.());
    if (!store) return [];

    const provenance = [];

    for (const result of results) {
      const eventId = result.id || result._eventId;
      if (eventId) {
        const chain = store.getProvenanceChain(eventId, maxDepth);
        provenance.push({
          resultId: eventId,
          chain,
          roots: store.findRoots(eventId)
        });
      }
    }

    return provenance;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Filter Helpers
  // ──────────────────────────────────────────────────────────────────────────

  applyEpistemicFilter(records, ir) {
    // For records, epistemic mode affects which source events are considered
    // This is a simplified implementation
    return records;
  }

  applyTimeFilter(records, ir) {
    if (ir.timeMode === EOQLTimeMode.CURRENT) {
      return records;
    }

    // Filter by creation/update time
    return records.filter(r => {
      const recordTime = r.updatedAt || r.createdAt || r.timestamp;
      if (!recordTime) return true;

      if (ir.timeMode === EOQLTimeMode.AS_OF) {
        return recordTime <= ir.timeStart;
      }

      if (ir.timeMode === EOQLTimeMode.BETWEEN) {
        return recordTime >= ir.timeStart && recordTime <= ir.timeEnd;
      }

      return true;
    });
  }

  applyEventTimeFilter(events, ir) {
    if (ir.timeMode === EOQLTimeMode.CURRENT) {
      return events;
    }

    return events.filter(e => {
      const eventTime = e.timestamp;
      if (!eventTime) return true;

      if (ir.timeMode === EOQLTimeMode.AS_OF) {
        return eventTime <= ir.timeStart;
      }

      if (ir.timeMode === EOQLTimeMode.BETWEEN) {
        return eventTime >= ir.timeStart && eventTime <= ir.timeEnd;
      }

      return true;
    });
  }

  applyGroundingFilter(records, filters) {
    // Filter records based on grounding requirements
    // This requires looking up the source events
    const store = this.eventStore || (typeof window !== 'undefined' && window.getEventStore?.());
    if (!store) return records;

    return records.filter(r => {
      const eventId = r._eventId;
      if (!eventId) return true;

      const grounds = store.whatGrounds(eventId);
      // Check if grounding matches filters
      return this.evaluateConditions(grounds, filters);
    });
  }

  applyOrderBy(items, orderBy) {
    return [...items].sort((a, b) => {
      for (const order of orderBy) {
        const field = typeof order.field === 'string' ? order.field : order.field.field;
        const aVal = this.getFieldValue(a, field);
        const bVal = this.getFieldValue(b, field);

        let cmp = 0;
        if (aVal == null && bVal == null) cmp = 0;
        else if (aVal == null) cmp = 1;
        else if (bVal == null) cmp = -1;
        else if (typeof aVal === 'number' && typeof bVal === 'number') {
          cmp = aVal - bVal;
        } else {
          cmp = String(aVal).localeCompare(String(bVal));
        }

        if (cmp !== 0) {
          return order.direction === 'desc' ? -cmp : cmp;
        }
      }
      return 0;
    });
  }

  evaluateConditions(item, conditions) {
    if (!conditions || conditions.length === 0) return true;

    let result = this.evaluateSingleCondition(item, conditions[0]);

    for (let i = 1; i < conditions.length; i++) {
      const { connector, condition } = conditions[i];
      const condResult = this.evaluateSingleCondition(item, condition);

      if (connector === 'AND') {
        result = result && condResult;
      } else if (connector === 'OR') {
        result = result || condResult;
      }
    }

    return result;
  }

  evaluateSingleCondition(item, condition) {
    if (!condition) return true;

    // Handle NOT
    if (condition.not) {
      return !this.evaluateSingleCondition(item, condition.condition);
    }

    // Handle grouped conditions
    if (condition.group) {
      return this.evaluateConditions(item, condition.group);
    }

    const field = typeof condition.field === 'string' ? condition.field : condition.field?.field;
    const value = this.getFieldValue(item, field);
    const target = condition.value;

    switch (condition.op) {
      case EOQLOperator.EQ:
        return value == target;
      case EOQLOperator.NE:
        return value != target;
      case EOQLOperator.GT:
        return value > target;
      case EOQLOperator.GE:
        return value >= target;
      case EOQLOperator.LT:
        return value < target;
      case EOQLOperator.LE:
        return value <= target;
      case EOQLOperator.IN:
        return Array.isArray(target) && target.includes(value);
      case EOQLOperator.NOT_IN:
        return Array.isArray(target) && !target.includes(value);
      case EOQLOperator.LIKE:
        return this.matchLike(value, target);
      case EOQLOperator.CONTAINS:
        return String(value).toLowerCase().includes(String(target).toLowerCase());
      case EOQLOperator.IS_NULL:
        return value == null;
      case EOQLOperator.IS_NOT_NULL:
        return value != null;
      default:
        return true;
    }
  }

  matchLike(value, pattern) {
    if (value == null || pattern == null) return false;
    // Convert SQL LIKE pattern to regex
    const regex = new RegExp(
      '^' + String(pattern)
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.') + '$',
      'i'
    );
    return regex.test(String(value));
  }

  getFieldValue(item, field) {
    if (!item || !field) return undefined;

    // Handle dotted paths
    const parts = String(field).split('.');
    let value = item;

    for (const part of parts) {
      if (value == null) return undefined;
      value = value[part];
    }

    return value;
  }

  projectFields(item, select) {
    const result = {};

    for (const field of select) {
      if (typeof field === 'string') {
        result[field] = this.getFieldValue(item, field);
      } else if (field.type === 'aggregation') {
        // Aggregations handled separately
      } else if (field.field) {
        const key = field.alias || field.field;
        result[key] = this.getFieldValue(item, field.field);
      }
    }

    return result;
  }

  enrichWithMetadata(item, ir) {
    const enriched = { ...item };

    if (ir.returnOptions.includeFrame && ir.frame) {
      enriched._frame = ir.frame;
      enriched._frameVersion = ir.frameVersion;
    }

    if (ir.returnOptions.includeContext) {
      enriched._epistemicMode = ir.epistemicMode;
      enriched._visibilityMode = ir.visibilityMode;
      enriched._timeMode = ir.timeMode;
    }

    return enriched;
  }
}

// ============================================================================
// EOQL Errors
// ============================================================================

class EOQLError extends Error {
  constructor(message, code = 'EOQL_ERROR') {
    super(message);
    this.name = 'EOQLError';
    this.code = code;
  }
}

class EOQLParseError extends EOQLError {
  constructor(message, position) {
    super(message, 'PARSE_ERROR');
    this.position = position;
  }
}

// ============================================================================
// EOQL Query Builder (Fluent API)
// ============================================================================

/**
 * Fluent API for building EOQL queries
 */
class EOQLQueryBuilder {
  constructor() {
    this._ir = new EOQLIR();
  }

  /**
   * EOQL style: find(target)
   */
  find(target) {
    this._ir.target = target;
    return this;
  }

  /**
   * SQL style: select(...fields)
   */
  select(...fields) {
    this._ir.select = fields.length > 0 ? fields : ['*'];
    return this;
  }

  /**
   * Source set/table
   */
  from(source) {
    this._ir.from = source;
    return this;
  }

  /**
   * Filter to GIVEN only
   */
  given() {
    this._ir.epistemicMode = EOQLMode.GIVEN;
    return this;
  }

  /**
   * Filter to MEANT only
   */
  meant() {
    this._ir.epistemicMode = EOQLMode.MEANT;
    return this;
  }

  /**
   * Include all existence (hidden/visible)
   */
  exists() {
    this._ir.visibilityMode = EOQLVisibility.EXISTS;
    return this;
  }

  /**
   * Filter to visible only
   */
  visible() {
    this._ir.visibilityMode = EOQLVisibility.VISIBLE;
    return this;
  }

  /**
   * Specify frame
   */
  underFrame(frameId, version = 'latest') {
    this._ir.frame = frameId;
    this._ir.frameVersion = version;
    return this;
  }

  /**
   * Time filter: as of
   */
  asOf(timestamp) {
    this._ir.timeMode = EOQLTimeMode.AS_OF;
    this._ir.timeStart = timestamp;
    return this;
  }

  /**
   * Time filter: between
   */
  between(start, end) {
    this._ir.timeMode = EOQLTimeMode.BETWEEN;
    this._ir.timeStart = start;
    this._ir.timeEnd = end;
    return this;
  }

  /**
   * Add WHERE condition
   */
  where(field, op, value) {
    if (arguments.length === 2) {
      // Shorthand: where(field, value) => equals
      value = op;
      op = EOQLOperator.EQ;
    }
    this._ir.where.push({ field, op, value });
    return this;
  }

  /**
   * Add AND condition
   */
  and(field, op, value) {
    if (arguments.length === 2) {
      value = op;
      op = EOQLOperator.EQ;
    }
    this._ir.where.push({ connector: 'AND', condition: { field, op, value } });
    return this;
  }

  /**
   * Add OR condition
   */
  or(field, op, value) {
    if (arguments.length === 2) {
      value = op;
      op = EOQLOperator.EQ;
    }
    this._ir.where.push({ connector: 'OR', condition: { field, op, value } });
    return this;
  }

  /**
   * Enable trace
   */
  trace(depth = 10) {
    this._ir.trace = true;
    this._ir.traceDepth = depth;
    return this;
  }

  /**
   * Add grounding filter
   */
  groundedBy(field, op, value) {
    if (arguments.length === 2) {
      value = op;
      op = EOQLOperator.EQ;
    }
    this._ir.groundingFilters.push({ field, op, value });
    return this;
  }

  /**
   * Order by field
   */
  orderBy(field, direction = 'asc') {
    this._ir.orderBy.push({ field, direction });
    return this;
  }

  /**
   * Limit results
   */
  limit(n) {
    this._ir.limit = n;
    return this;
  }

  /**
   * Offset results
   */
  offset(n) {
    this._ir.offset = n;
    return this;
  }

  /**
   * Include provenance in results
   */
  withProvenance() {
    this._ir.returnOptions.includeProvenance = true;
    return this;
  }

  /**
   * Include conflicts in results
   */
  withConflicts() {
    this._ir.returnOptions.includeConflicts = true;
    return this;
  }

  /**
   * Get the IR
   */
  build() {
    return this._ir;
  }

  /**
   * Convert to query string
   */
  toString() {
    return formatEOQL(this._ir);
  }

  /**
   * Execute the query
   */
  async execute(evaluator) {
    const eval_ = evaluator || new EOQLEvaluator();
    return eval_.execute(this._ir);
  }
}

/**
 * Create a new query builder
 */
function eoql() {
  return new EOQLQueryBuilder();
}

// ============================================================================
// EOQL Formatter (IR to String)
// ============================================================================

/**
 * Format EOQL IR as a query string
 */
function formatEOQL(ir) {
  const parts = [];

  // Target
  if (ir.target !== EOQLTarget.RECORDS) {
    parts.push(`FIND ${ir.target.toUpperCase()}`);
  } else if (ir.select.length > 0) {
    if (ir.select[0] === '*') {
      parts.push('SELECT *');
    } else {
      const fields = ir.select.map(f => {
        if (typeof f === 'string') return f;
        if (f.type === 'aggregation') {
          const aggStr = `${f.function.toUpperCase()}(${f.field})`;
          return f.alias ? `${aggStr} AS ${f.alias}` : aggStr;
        }
        if (f.alias) return `${f.field} AS ${f.alias}`;
        return f.field;
      });
      parts.push(`SELECT ${fields.join(', ')}`);
    }
  } else {
    parts.push('FIND RECORDS');
  }

  // Epistemic mode
  if (ir.epistemicMode !== EOQLMode.ALL) {
    parts.push(ir.epistemicMode.toUpperCase());
  }

  // Visibility
  if (ir.visibilityMode === EOQLVisibility.EXISTS) {
    parts.push('EXISTS');
  } else if (ir.visibilityMode === EOQLVisibility.VISIBLE) {
    parts.push('VISIBLE');
  }

  // Frame
  if (ir.frame) {
    parts.push(`UNDER FRAME ${ir.frame}`);
  }

  // Time
  if (ir.timeMode === EOQLTimeMode.AS_OF && ir.timeStart) {
    parts.push(`AS OF "${ir.timeStart}"`);
  } else if (ir.timeMode === EOQLTimeMode.BETWEEN && ir.timeStart && ir.timeEnd) {
    parts.push(`BETWEEN "${ir.timeStart}" AND "${ir.timeEnd}"`);
  }

  // FROM
  if (ir.from) {
    parts.push(`FROM ${ir.from}`);
  }

  // WHERE
  if (ir.where.length > 0) {
    parts.push(`WHERE ${formatConditions(ir.where)}`);
  }

  // TRACE
  if (ir.trace) {
    parts.push(`TRACE DEPTH ${ir.traceDepth}`);
  }

  // GROUNDED BY
  if (ir.groundingFilters.length > 0) {
    parts.push(`GROUNDED BY ${formatConditions(ir.groundingFilters)}`);
  }

  // ORDER BY
  if (ir.orderBy.length > 0) {
    const orders = ir.orderBy.map(o => {
      const field = typeof o.field === 'string' ? o.field : o.field.field;
      return `${field} ${o.direction.toUpperCase()}`;
    });
    parts.push(`ORDER BY ${orders.join(', ')}`);
  }

  // LIMIT
  if (ir.limit !== null) {
    parts.push(`LIMIT ${ir.limit}`);
  }

  // OFFSET
  if (ir.offset > 0) {
    parts.push(`OFFSET ${ir.offset}`);
  }

  return parts.join('\n');
}

function formatConditions(conditions) {
  if (!conditions || conditions.length === 0) return '';

  const parts = [];

  for (let i = 0; i < conditions.length; i++) {
    const item = conditions[i];

    if (i > 0 && item.connector) {
      parts.push(item.connector);
      parts.push(formatSingleCondition(item.condition));
    } else if (item.condition) {
      parts.push(formatSingleCondition(item.condition));
    } else {
      parts.push(formatSingleCondition(item));
    }
  }

  return parts.join(' ');
}

function formatSingleCondition(cond) {
  if (!cond) return '';

  if (cond.not) {
    return `NOT ${formatSingleCondition(cond.condition)}`;
  }

  if (cond.group) {
    return `(${formatConditions(cond.group)})`;
  }

  const field = typeof cond.field === 'string' ? cond.field : cond.field?.field;
  const value = typeof cond.value === 'string' ? `"${cond.value}"` : cond.value;

  if (cond.op === EOQLOperator.IN || cond.op === EOQLOperator.NOT_IN) {
    const values = cond.value.map(v => typeof v === 'string' ? `"${v}"` : v).join(', ');
    return `${field} ${cond.op} (${values})`;
  }

  if (cond.op === EOQLOperator.IS_NULL) {
    return `${field} IS NULL`;
  }

  if (cond.op === EOQLOperator.IS_NOT_NULL) {
    return `${field} IS NOT NULL`;
  }

  return `${field} ${cond.op} ${value}`;
}

// ============================================================================
// EOQL Saved Queries Store
// ============================================================================

/**
 * Store for saved EOQL queries
 */
class EOQLQueryStore {
  constructor() {
    this.queries = new Map();
    this.dbName = 'eo_eoql_queries';
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        this._loadQueries().then(resolve).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('queries')) {
          const store = db.createObjectStore('queries', { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: true });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  async _loadQueries() {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('queries', 'readonly');
      const store = tx.objectStore('queries');
      const request = store.getAll();

      request.onsuccess = () => {
        for (const query of request.result || []) {
          this.queries.set(query.id, query);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async save(name, ir, description = '') {
    const id = generateQueryId();
    const query = {
      id,
      name,
      description,
      ir: ir.toJSON(),
      queryString: formatEOQL(ir),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.queries.set(id, query);

    if (this.db) {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction('queries', 'readwrite');
        const store = tx.objectStore('queries');
        const request = store.put(query);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    return query;
  }

  get(id) {
    return this.queries.get(id);
  }

  getByName(name) {
    for (const query of this.queries.values()) {
      if (query.name === name) return query;
    }
    return null;
  }

  getAll() {
    return Array.from(this.queries.values())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async delete(id) {
    this.queries.delete(id);

    if (this.db) {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction('queries', 'readwrite');
        const store = tx.objectStore('queries');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}

// ============================================================================
// EOQL Examples
// ============================================================================

const EOQL_EXAMPLES = [
  {
    name: 'Basic Record Query',
    category: 'SQL-style',
    description: 'Simple SELECT query with WHERE clause',
    query: `SELECT *
FROM Tasks
WHERE status = "active"
ORDER BY created_at DESC
LIMIT 10`
  },
  {
    name: 'Given Only (Facts)',
    category: 'EOQL',
    description: 'Query only instantiated facts, not interpretations',
    query: `FIND RECORDS
GIVEN VISIBLE
FROM Measurements
WHERE method = "measured"
ORDER BY timestamp DESC`
  },
  {
    name: 'Meant Only (Interpretations)',
    category: 'EOQL',
    description: 'Query only interpretations and inferences',
    query: `FIND CLAIMS
MEANT VISIBLE
UNDER FRAME default_analysis
WHERE epistemicStatus = "confirmed"`
  },
  {
    name: 'Time Travel Query',
    category: 'EOQL',
    description: 'Query state as of a specific time',
    query: `FIND RECORDS
GIVEN VISIBLE
AS OF "2024-01-01T00:00:00Z"
FROM Projects
WHERE status = "active"`
  },
  {
    name: 'Change Detection',
    category: 'EOQL',
    description: 'Query changes between two times',
    query: `FIND EVENTS
GIVEN EXISTS
BETWEEN "2024-01-01" AND "2024-12-31"
WHERE category = "raw_data"
ORDER BY timestamp ASC`
  },
  {
    name: 'Provenance Trace',
    category: 'EOQL',
    description: 'Query with full provenance chain',
    query: `FIND CLAIMS
MEANT VISIBLE
FROM Insights
WHERE term = "risk_score"
TRACE DEPTH 5`
  },
  {
    name: 'Grounded Query',
    category: 'EOQL',
    description: 'Only accept claims with specific grounding',
    query: `FIND CLAIMS
MEANT VISIBLE
WHERE term = "biodiversity"
GROUNDED BY source.type = "peer_reviewed"`
  },
  {
    name: 'Activity Query',
    category: 'EOQL',
    description: 'Query system activities',
    query: `FIND ACTIVITIES
WHERE operator IN ("INS", "DES", "CON")
ORDER BY timestamp DESC
LIMIT 50`
  }
];

// ============================================================================
// Global Instance and Export
// ============================================================================

let eoqlEvaluator = null;
let eoqlQueryStore = null;

async function initEOQL(options = {}) {
  eoqlEvaluator = new EOQLEvaluator(options);
  eoqlQueryStore = new EOQLQueryStore();
  await eoqlQueryStore.init();

  console.log('EOQL initialized');
  return { evaluator: eoqlEvaluator, queryStore: eoqlQueryStore };
}

function getEOQLEvaluator() {
  if (!eoqlEvaluator) {
    eoqlEvaluator = new EOQLEvaluator();
  }
  return eoqlEvaluator;
}

async function getEOQLQueryStore() {
  if (!eoqlQueryStore) {
    eoqlQueryStore = new EOQLQueryStore();
    await eoqlQueryStore.init();
  }
  return eoqlQueryStore;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Types
    EOQLMode,
    EOQLVisibility,
    EOQLTimeMode,
    EOQLTarget,
    EOQLOperator,
    TokenType,

    // Classes
    EOQLIR,
    EOQLLexer,
    EOQLParser,
    EOQLEvaluator,
    EOQLQueryBuilder,
    EOQLQueryStore,
    EOQLError,
    EOQLParseError,

    // Functions
    parseEOQL,
    formatEOQL,
    eoql,
    initEOQL,
    getEOQLEvaluator,
    getEOQLQueryStore,

    // Examples
    EOQL_EXAMPLES
  };
}

if (typeof window !== 'undefined') {
  window.EOQL = {
    // Types
    Mode: EOQLMode,
    Visibility: EOQLVisibility,
    TimeMode: EOQLTimeMode,
    Target: EOQLTarget,
    Operator: EOQLOperator,

    // Classes
    IR: EOQLIR,
    Lexer: EOQLLexer,
    Parser: EOQLParser,
    Evaluator: EOQLEvaluator,
    QueryBuilder: EOQLQueryBuilder,
    QueryStore: EOQLQueryStore,
    Error: EOQLError,
    ParseError: EOQLParseError,

    // Functions
    parse: parseEOQL,
    format: formatEOQL,
    query: eoql,
    init: initEOQL,
    getEvaluator: getEOQLEvaluator,
    getQueryStore: getEOQLQueryStore,

    // Examples
    examples: EOQL_EXAMPLES
  };

  // Auto-initialize
  initEOQL().catch(err => {
    console.error('Failed to initialize EOQL:', err);
  });
}
