/**
 * EO SQL Query - SQL Interface for Set Creation with EO-IR Provenance
 *
 * Write SQL to query raw data → Create Sets with full provenance tracking.
 *
 * EO-IR Integration:
 * - Every SQL query is parsed into an EO operation pipeline
 * - The pipeline is stored as the Set's derivation
 * - Full grounding chain from Set → Query → Source → Raw Data
 *
 * Supported SQL:
 * - SELECT columns FROM source
 * - WHERE conditions (=, !=, <, >, <=, >=, LIKE, IN, IS NULL, IS NOT NULL)
 * - ORDER BY column [ASC|DESC]
 * - LIMIT n [OFFSET m]
 * - GROUP BY column
 * - Aggregates: COUNT, SUM, AVG, MIN, MAX
 * - JOIN (INNER, LEFT)
 * - UNION
 */

// ============================================================================
// SQL Parser - Translates SQL to EO-IR Pipeline
// ============================================================================

/**
 * Predicate mapping from SQL operators to EO predicates
 */
const SQL_TO_EO_PREDICATE = Object.freeze({
  '=': 'eq',
  '==': 'eq',
  '!=': 'neq',
  '<>': 'neq',
  '>': 'gt',
  '<': 'lt',
  '>=': 'gte',
  '<=': 'lte',
  'LIKE': 'contains',  // Simplified - full LIKE needs pattern handling
  'IN': 'in',
  'IS NULL': 'null',
  'IS NOT NULL': 'notnull'
});

/**
 * EOSQLParser - Parses SQL into EO-IR operation pipeline
 */
class EOSQLParser {
  constructor() {
    this.tokens = [];
    this.position = 0;
  }

  /**
   * Parse SQL query string into EO-IR pipeline
   * @param {string} sql - The SQL query
   * @returns {Object} - { pipeline: Operation[], sourceRefs: string[], error?: string }
   */
  parse(sql) {
    try {
      this.tokens = this._tokenize(sql);
      this.position = 0;

      const statement = this._parseStatement();
      return {
        success: true,
        pipeline: statement.pipeline,
        sourceRefs: statement.sourceRefs,
        selectFields: statement.selectFields,
        aggregates: statement.aggregates,
        sql: sql.trim()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        sql: sql.trim()
      };
    }
  }

  /**
   * Tokenize SQL string
   */
  _tokenize(sql) {
    const tokens = [];
    const regex = /(\s+)|('[^']*')|("[^"]*")|(\d+\.?\d*)|([a-zA-Z_][a-zA-Z0-9_]*)|([<>=!]+)|([,\(\)\*])/g;
    let match;

    while ((match = regex.exec(sql)) !== null) {
      const [full, whitespace, singleQuote, doubleQuote, number, identifier, operator, punct] = match;

      if (whitespace) continue;

      if (singleQuote || doubleQuote) {
        const str = singleQuote || doubleQuote;
        tokens.push({ type: 'STRING', value: str.slice(1, -1) });
      } else if (number) {
        tokens.push({ type: 'NUMBER', value: parseFloat(number) });
      } else if (identifier) {
        const upper = identifier.toUpperCase();
        const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER', 'BY', 'ASC', 'DESC',
                         'LIMIT', 'OFFSET', 'GROUP', 'HAVING', 'JOIN', 'INNER', 'LEFT', 'RIGHT',
                         'ON', 'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'IN',
                         'LIKE', 'IS', 'NULL', 'NOT', 'UNION', 'ALL', 'BETWEEN'];
        if (keywords.includes(upper)) {
          tokens.push({ type: 'KEYWORD', value: upper });
        } else {
          tokens.push({ type: 'IDENTIFIER', value: identifier });
        }
      } else if (operator) {
        tokens.push({ type: 'OPERATOR', value: operator });
      } else if (punct) {
        tokens.push({ type: 'PUNCT', value: punct });
      }
    }

    tokens.push({ type: 'EOF', value: null });
    return tokens;
  }

  _current() {
    return this.tokens[this.position] || { type: 'EOF', value: null };
  }

  _peek(offset = 0) {
    return this.tokens[this.position + offset] || { type: 'EOF', value: null };
  }

  _consume(expectedType, expectedValue = null) {
    const token = this._current();
    if (token.type !== expectedType || (expectedValue && token.value !== expectedValue)) {
      throw new Error(`Expected ${expectedType}${expectedValue ? ` '${expectedValue}'` : ''}, got ${token.type} '${token.value}'`);
    }
    this.position++;
    return token;
  }

  _match(type, value = null) {
    const token = this._current();
    if (token.type === type && (!value || token.value === value)) {
      this.position++;
      return token;
    }
    return null;
  }

  /**
   * Parse a SELECT statement
   */
  _parseStatement() {
    const pipeline = [];
    const sourceRefs = [];
    let selectFields = [];
    let aggregates = [];

    // SELECT
    this._consume('KEYWORD', 'SELECT');

    // DISTINCT?
    const distinct = !!this._match('KEYWORD', 'DISTINCT');

    // Column list
    const columns = this._parseColumnList();
    selectFields = columns.fields;
    aggregates = columns.aggregates;

    // FROM
    this._consume('KEYWORD', 'FROM');

    // Table/source reference
    const source = this._parseSourceRef();
    sourceRefs.push(source.name);

    // SOURCE operation
    pipeline.push({
      op: 'SOURCE',
      params: { sourceId: source.name, alias: source.alias }
    });

    // JOIN?
    while (this._current().type === 'KEYWORD' &&
           ['JOIN', 'INNER', 'LEFT', 'RIGHT'].includes(this._current().value)) {
      const join = this._parseJoin();
      sourceRefs.push(join.table);
      pipeline.push({
        op: 'JOIN',
        params: {
          rightSourceId: join.table,
          leftKey: join.leftKey,
          rightKey: join.rightKey,
          type: join.type
        }
      });
    }

    // WHERE?
    if (this._match('KEYWORD', 'WHERE')) {
      const conditions = this._parseConditions();
      for (const cond of conditions) {
        pipeline.push({
          op: 'FILTER',
          params: {
            field: cond.field,
            predicate: cond.predicate,
            value: cond.value
          }
        });
      }
    }

    // GROUP BY?
    if (this._match('KEYWORD', 'GROUP')) {
      this._consume('KEYWORD', 'BY');
      const groupFields = this._parseIdentifierList();
      pipeline.push({
        op: 'GROUP',
        params: { by: groupFields.length === 1 ? groupFields[0] : groupFields }
      });

      // Add aggregates
      for (const agg of aggregates) {
        pipeline.push({
          op: 'AGGREGATE',
          params: {
            fn: agg.fn,
            field: agg.field,
            as: agg.alias
          }
        });
      }
    }

    // HAVING? (post-group filter)
    if (this._match('KEYWORD', 'HAVING')) {
      const havingConds = this._parseConditions();
      for (const cond of havingConds) {
        pipeline.push({
          op: 'FILTER',
          params: {
            field: cond.field,
            predicate: cond.predicate,
            value: cond.value,
            stage: 'post-group'
          }
        });
      }
    }

    // ORDER BY?
    if (this._match('KEYWORD', 'ORDER')) {
      this._consume('KEYWORD', 'BY');
      const orderClauses = this._parseOrderByList();
      for (const order of orderClauses) {
        pipeline.push({
          op: 'SORT',
          params: {
            field: order.field,
            direction: order.direction
          }
        });
      }
    }

    // LIMIT?
    if (this._match('KEYWORD', 'LIMIT')) {
      const limitToken = this._consume('NUMBER');
      const limitOp = {
        op: 'LIMIT',
        params: { count: limitToken.value }
      };

      // OFFSET?
      if (this._match('KEYWORD', 'OFFSET')) {
        const offsetToken = this._consume('NUMBER');
        limitOp.params.offset = offsetToken.value;
      }
      pipeline.push(limitOp);
    }

    // SELECT (field projection) - applied last
    if (!columns.isSelectAll) {
      pipeline.push({
        op: 'SELECT',
        params: { fields: selectFields }
      });
    }

    // UNION?
    if (this._match('KEYWORD', 'UNION')) {
      const all = !!this._match('KEYWORD', 'ALL');
      const rightStatement = this._parseStatement();
      sourceRefs.push(...rightStatement.sourceRefs);
      pipeline.push({
        op: 'UNION',
        params: {
          rightPipeline: rightStatement.pipeline,
          all
        }
      });
    }

    return { pipeline, sourceRefs, selectFields, aggregates };
  }

  /**
   * Parse column list (SELECT ...)
   */
  _parseColumnList() {
    const fields = [];
    const aggregates = [];
    let isSelectAll = false;

    do {
      if (this._match('PUNCT', '*')) {
        isSelectAll = true;
        fields.push('*');
      } else if (this._current().type === 'KEYWORD' &&
                 ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(this._current().value)) {
        // Aggregate function
        const fn = this._consume('KEYWORD').value;
        this._consume('PUNCT', '(');

        let field = null;
        if (this._match('PUNCT', '*')) {
          field = '*';
        } else {
          field = this._consume('IDENTIFIER').value;
        }
        this._consume('PUNCT', ')');

        // AS alias?
        let alias = `${fn.toLowerCase()}_${field}`;
        if (this._match('KEYWORD', 'AS')) {
          alias = this._consume('IDENTIFIER').value;
        }

        aggregates.push({ fn, field, alias });
        fields.push(alias);
      } else {
        // Regular column
        const col = this._consume('IDENTIFIER').value;
        let alias = col;

        if (this._match('KEYWORD', 'AS')) {
          alias = this._consume('IDENTIFIER').value;
        }

        fields.push(alias);
      }
    } while (this._match('PUNCT', ','));

    return { fields, aggregates, isSelectAll };
  }

  /**
   * Parse source reference (FROM ...)
   */
  _parseSourceRef() {
    const name = this._consume('IDENTIFIER').value;
    let alias = name;

    if (this._match('KEYWORD', 'AS') || this._current().type === 'IDENTIFIER') {
      if (this._current().type === 'IDENTIFIER') {
        alias = this._consume('IDENTIFIER').value;
      }
    }

    return { name, alias };
  }

  /**
   * Parse JOIN clause
   */
  _parseJoin() {
    let type = 'inner';

    if (this._match('KEYWORD', 'LEFT')) {
      type = 'left';
    } else if (this._match('KEYWORD', 'RIGHT')) {
      type = 'right';
    } else if (this._match('KEYWORD', 'INNER')) {
      type = 'inner';
    }

    this._consume('KEYWORD', 'JOIN');
    const tableRef = this._parseSourceRef();

    this._consume('KEYWORD', 'ON');
    const leftKey = this._consume('IDENTIFIER').value;
    this._consume('OPERATOR', '=');
    const rightKey = this._consume('IDENTIFIER').value;

    return { table: tableRef.name, alias: tableRef.alias, leftKey, rightKey, type };
  }

  /**
   * Parse WHERE conditions
   */
  _parseConditions() {
    const conditions = [];

    do {
      const cond = this._parseCondition();
      conditions.push(cond);
    } while (this._match('KEYWORD', 'AND'));

    // Note: OR is more complex - would need expression tree
    // For now, we flatten to AND conditions

    return conditions;
  }

  /**
   * Parse single condition
   */
  _parseCondition() {
    const field = this._consume('IDENTIFIER').value;

    // IS NULL / IS NOT NULL
    if (this._match('KEYWORD', 'IS')) {
      const not = !!this._match('KEYWORD', 'NOT');
      this._consume('KEYWORD', 'NULL');
      return {
        field,
        predicate: not ? 'notnull' : 'null',
        value: null
      };
    }

    // IN (...)
    if (this._match('KEYWORD', 'IN')) {
      this._consume('PUNCT', '(');
      const values = [];
      do {
        const val = this._current();
        if (val.type === 'STRING' || val.type === 'NUMBER') {
          values.push(this._consume(val.type).value);
        }
      } while (this._match('PUNCT', ','));
      this._consume('PUNCT', ')');
      return { field, predicate: 'in', value: values };
    }

    // LIKE
    if (this._match('KEYWORD', 'LIKE')) {
      const pattern = this._consume('STRING').value;
      // Convert SQL LIKE to predicate
      if (pattern.startsWith('%') && pattern.endsWith('%')) {
        return { field, predicate: 'contains', value: pattern.slice(1, -1) };
      } else if (pattern.startsWith('%')) {
        return { field, predicate: 'ends', value: pattern.slice(1) };
      } else if (pattern.endsWith('%')) {
        return { field, predicate: 'starts', value: pattern.slice(0, -1) };
      }
      return { field, predicate: 'contains', value: pattern.replace(/%/g, '') };
    }

    // BETWEEN
    if (this._match('KEYWORD', 'BETWEEN')) {
      const low = this._current().type === 'STRING' ?
        this._consume('STRING').value : this._consume('NUMBER').value;
      this._consume('KEYWORD', 'AND');
      const high = this._current().type === 'STRING' ?
        this._consume('STRING').value : this._consume('NUMBER').value;
      // Expand to two conditions
      return { field, predicate: 'between', value: [low, high] };
    }

    // Standard comparison operators
    const op = this._consume('OPERATOR').value;
    const predicate = SQL_TO_EO_PREDICATE[op] || 'eq';

    let value;
    const valToken = this._current();
    if (valToken.type === 'STRING') {
      value = this._consume('STRING').value;
    } else if (valToken.type === 'NUMBER') {
      value = this._consume('NUMBER').value;
    } else if (valToken.type === 'KEYWORD' && valToken.value === 'NULL') {
      this._consume('KEYWORD', 'NULL');
      value = null;
    } else {
      value = this._consume('IDENTIFIER').value;
    }

    return { field, predicate, value };
  }

  /**
   * Parse identifier list
   */
  _parseIdentifierList() {
    const ids = [];
    do {
      ids.push(this._consume('IDENTIFIER').value);
    } while (this._match('PUNCT', ','));
    return ids;
  }

  /**
   * Parse ORDER BY list
   */
  _parseOrderByList() {
    const orders = [];
    do {
      const field = this._consume('IDENTIFIER').value;
      let direction = 'asc';
      if (this._match('KEYWORD', 'DESC')) {
        direction = 'desc';
      } else {
        this._match('KEYWORD', 'ASC');
      }
      orders.push({ field, direction });
    } while (this._match('PUNCT', ','));
    return orders;
  }
}

// ============================================================================
// SQL Executor - Runs Pipeline Against Source Data
// ============================================================================

/**
 * EOSQLExecutor - Executes parsed SQL pipeline against source data
 */
class EOSQLExecutor {
  constructor(dataProvider) {
    // dataProvider: { getSourceData(sourceId) → rows[], getSourceSchema(sourceId) → fields[] }
    this.dataProvider = dataProvider;
  }

  /**
   * Execute a parsed pipeline
   * @param {Object[]} pipeline - EO-IR operation pipeline
   * @param {Object} context - Execution context
   * @returns {Object} - { rows: any[], columns: string[], stats: Object }
   */
  execute(pipeline, context = {}) {
    let data = [];
    let columns = [];
    const stats = {
      inputRows: 0,
      outputRows: 0,
      operationsExecuted: [],
      executionTime: 0
    };

    const startTime = performance.now();

    for (const op of pipeline) {
      const beforeCount = data.length;
      const result = this._executeOperation(op, data, columns, context);
      data = result.data;
      columns = result.columns || columns;

      stats.operationsExecuted.push({
        op: op.op,
        params: op.params,
        inputRows: beforeCount,
        outputRows: data.length
      });
    }

    stats.executionTime = Math.round(performance.now() - startTime);
    stats.outputRows = data.length;

    return { rows: data, columns, stats };
  }

  /**
   * Execute single operation
   */
  _executeOperation(op, data, columns, context) {
    switch (op.op) {
      case 'SOURCE':
        return this._source(op.params);

      case 'FILTER':
        return { data: this._filter(data, op.params), columns };

      case 'SORT':
        return { data: this._sort(data, op.params), columns };

      case 'LIMIT':
        return { data: this._limit(data, op.params), columns };

      case 'SELECT':
        return this._select(data, op.params);

      case 'GROUP':
        return this._group(data, op.params, columns);

      case 'AGGREGATE':
        return this._aggregate(data, op.params, columns);

      case 'JOIN':
        return this._join(data, op.params, context);

      case 'UNION':
        return this._union(data, op.params, context);

      default:
        console.warn(`Unknown operation: ${op.op}`);
        return { data, columns };
    }
  }

  _source(params) {
    const sourceData = this.dataProvider.getSourceData(params.sourceId);
    const columns = sourceData.length > 0 ? Object.keys(sourceData[0]) : [];
    return { data: [...sourceData], columns };
  }

  _filter(data, params) {
    const { field, predicate, value } = params;

    return data.filter(row => {
      const cellValue = row[field];
      const cellStr = String(cellValue ?? '').toLowerCase();
      const compareStr = String(value ?? '').toLowerCase();

      switch (predicate) {
        case 'eq': return cellStr === compareStr;
        case 'neq': return cellStr !== compareStr;
        case 'gt': return parseFloat(cellValue) > parseFloat(value);
        case 'lt': return parseFloat(cellValue) < parseFloat(value);
        case 'gte': return parseFloat(cellValue) >= parseFloat(value);
        case 'lte': return parseFloat(cellValue) <= parseFloat(value);
        case 'contains': return cellStr.includes(compareStr);
        case 'starts': return cellStr.startsWith(compareStr);
        case 'ends': return cellStr.endsWith(compareStr);
        case 'in': return Array.isArray(value) && value.map(v => String(v).toLowerCase()).includes(cellStr);
        case 'null': return cellValue === null || cellValue === undefined || cellValue === '';
        case 'notnull': return cellValue !== null && cellValue !== undefined && cellValue !== '';
        case 'between': return parseFloat(cellValue) >= parseFloat(value[0]) && parseFloat(cellValue) <= parseFloat(value[1]);
        default: return true;
      }
    });
  }

  _sort(data, params) {
    const { field, direction } = params;
    return [...data].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      let cmp;
      if (!isNaN(aNum) && !isNaN(bNum)) {
        cmp = aNum - bNum;
      } else {
        cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''));
      }

      return direction === 'desc' ? -cmp : cmp;
    });
  }

  _limit(data, params) {
    const { count, offset = 0 } = params;
    return data.slice(offset, offset + count);
  }

  _select(data, params) {
    const { fields } = params;
    if (fields.includes('*')) {
      return { data, columns: data.length > 0 ? Object.keys(data[0]) : [] };
    }

    const projected = data.map(row => {
      const newRow = {};
      for (const field of fields) {
        newRow[field] = row[field];
      }
      return newRow;
    });

    return { data: projected, columns: fields };
  }

  _group(data, params, columns) {
    const { by } = params;
    const groupKeys = Array.isArray(by) ? by : [by];

    // Group data by key(s)
    const groups = new Map();
    for (const row of data) {
      const keyParts = groupKeys.map(k => row[k] ?? '(null)');
      const key = keyParts.join('|||');
      if (!groups.has(key)) {
        groups.set(key, { keyValues: keyParts, rows: [] });
      }
      groups.get(key).rows.push(row);
    }

    // Convert to grouped rows (aggregates will be applied next)
    const groupedData = [];
    for (const [key, group] of groups) {
      const baseRow = {};
      groupKeys.forEach((k, i) => baseRow[k] = group.keyValues[i]);
      baseRow._groupRows = group.rows;
      baseRow._groupCount = group.rows.length;
      groupedData.push(baseRow);
    }

    return { data: groupedData, columns: groupKeys };
  }

  _aggregate(data, params, columns) {
    const { fn, field, as } = params;

    // Apply aggregate to each group (or entire dataset if no GROUP BY)
    const aggregated = data.map(row => {
      const rows = row._groupRows || [row];
      let result;

      switch (fn) {
        case 'COUNT':
          result = field === '*' ? rows.length : rows.filter(r => r[field] != null).length;
          break;
        case 'SUM':
          result = rows.reduce((sum, r) => sum + (parseFloat(r[field]) || 0), 0);
          break;
        case 'AVG':
          const nums = rows.map(r => parseFloat(r[field])).filter(n => !isNaN(n));
          result = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
          break;
        case 'MIN':
          const minVals = rows.map(r => r[field]).filter(v => v != null);
          result = minVals.length > 0 ? Math.min(...minVals.map(v => parseFloat(v) || 0)) : null;
          break;
        case 'MAX':
          const maxVals = rows.map(r => r[field]).filter(v => v != null);
          result = maxVals.length > 0 ? Math.max(...maxVals.map(v => parseFloat(v) || 0)) : null;
          break;
        default:
          result = null;
      }

      const newRow = { ...row };
      delete newRow._groupRows;
      delete newRow._groupCount;
      newRow[as] = result;
      return newRow;
    });

    return { data: aggregated, columns: [...columns, as] };
  }

  _join(leftData, params, context) {
    const { rightSourceId, leftKey, rightKey, type } = params;
    const rightData = this.dataProvider.getSourceData(rightSourceId);

    // Build index on right table
    const rightIndex = new Map();
    for (const row of rightData) {
      const key = String(row[rightKey] ?? '');
      if (!rightIndex.has(key)) rightIndex.set(key, []);
      rightIndex.get(key).push(row);
    }

    const result = [];
    const rightColumns = rightData.length > 0 ? Object.keys(rightData[0]) : [];
    const leftColumns = leftData.length > 0 ? Object.keys(leftData[0]) : [];

    for (const leftRow of leftData) {
      const key = String(leftRow[leftKey] ?? '');
      const matches = rightIndex.get(key) || [];

      if (matches.length > 0) {
        for (const rightRow of matches) {
          result.push({ ...leftRow, ...rightRow });
        }
      } else if (type === 'left') {
        const nullRight = {};
        for (const col of rightColumns) nullRight[col] = null;
        result.push({ ...leftRow, ...nullRight });
      }
    }

    return { data: result, columns: [...new Set([...leftColumns, ...rightColumns])] };
  }

  _union(leftData, params, context) {
    const { rightPipeline, all } = params;
    const rightResult = this.execute(rightPipeline, context);

    const combined = [...leftData, ...rightResult.rows];

    if (!all) {
      // Remove duplicates (based on JSON stringification)
      const seen = new Set();
      const unique = combined.filter(row => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { data: unique, columns: rightResult.columns };
    }

    return { data: combined, columns: rightResult.columns };
  }
}

// ============================================================================
// Set Builder - Creates EO Sets with EO-IR Provenance
// ============================================================================

/**
 * EOSQLSetBuilder - Creates Sets from SQL queries with full provenance
 */
class EOSQLSetBuilder {
  constructor(eventStore, dataProvider) {
    this.eventStore = eventStore;
    this.dataProvider = dataProvider;
    this.parser = new EOSQLParser();
    this.executor = new EOSQLExecutor(dataProvider);
  }

  /**
   * Execute SQL and create a new Set with EO-IR provenance
   *
   * @param {Object} options
   * @param {string} options.sql - The SQL query
   * @param {string} options.setName - Name for the new Set
   * @param {string} options.actor - Who is creating this
   * @param {Object} options.frame - EO-IR Frame metadata
   * @returns {Object} - { set: SetConfig, events: Event[], result: { rows, columns } }
   */
  createSetFromSQL(options) {
    const { sql, setName, actor = 'user', frame = {} } = options;

    // 1. Parse SQL to pipeline
    const parsed = this.parser.parse(sql);
    if (!parsed.success) {
      throw new Error(`SQL Parse Error: ${parsed.error}`);
    }

    // 2. Execute pipeline
    const result = this.executor.execute(parsed.pipeline);

    // 3. Create events with EO-IR provenance
    const events = [];
    const timestamp = new Date().toISOString();
    const setId = generateOntologyId('set');

    // Check if query involves joins
    const joinOps = parsed.pipeline.filter(op => op.op === 'JOIN');
    const isJoinQuery = joinOps.length > 0;

    // Event: Query Executed (documents the transformation)
    const queryEventId = generateOntologyId('evt');
    const queryEvent = {
      id: queryEventId,
      epistemicType: 'meant',
      category: isJoinQuery ? 'join_executed' : 'query_executed',
      timestamp,
      actor,
      payload: {
        sql: parsed.sql,
        pipeline: parsed.pipeline,
        sourceRefs: parsed.sourceRefs,
        resultStats: {
          rowCount: result.rows.length,
          columns: result.columns,
          executionMs: result.stats.executionTime
        },
        // Include join-specific information for CON derivation
        ...(isJoinQuery && {
          joinDetails: {
            joinCount: joinOps.length,
            joinTypes: joinOps.map(op => op.params.type),
            joinConditions: joinOps.map(op => ({
              leftSource: parsed.sourceRefs[0],
              rightSource: op.params.rightSourceId,
              leftKey: op.params.leftKey,
              rightKey: op.params.rightKey,
              type: op.params.type
            }))
          }
        })
      },
      grounding: {
        references: parsed.sourceRefs.map(srcId => ({
          eventId: this._getSourceEventId(srcId),
          kind: 'structural'
        })),
        derivation: {
          strategy: isJoinQuery ? 'con' : 'seg',
          operators: parsed.pipeline,
          inputs: Object.fromEntries(parsed.sourceRefs.map(s => [s, this._getSourceEventId(s)])),
          frozenParams: { sql: parsed.sql }
        },
        kind: 'computational'
      },
      frame: {
        claim: isJoinQuery
          ? `Joined ${parsed.sourceRefs.length} sources: ${parsed.sourceRefs.join(', ')}`
          : `Executed SQL query: ${parsed.sql.substring(0, 100)}...`,
        epistemicStatus: 'confirmed',
        purpose: isJoinQuery ? 'data_join' : 'query_execution'
      }
    };
    events.push(queryEvent);

    // Event: Set Defined (the resulting Set)
    const setEventId = generateOntologyId('evt');
    const setEvent = {
      id: setEventId,
      epistemicType: 'meant',
      category: 'set_defined',
      timestamp,
      actor,
      payload: {
        id: setId,
        name: setName,
        fields: this._inferFieldsFromResult(result),
        recordCount: result.rows.length
      },
      grounding: {
        references: [
          { eventId: queryEventId, kind: 'computational' },
          ...parsed.sourceRefs.map(srcId => ({
            eventId: this._getSourceEventId(srcId),
            kind: 'structural'
          }))
        ],
        derivation: {
          pipeline: parsed.pipeline,
          inputs: { queryEventId }
        }
      },
      frame: {
        purpose: frame.purpose || `Set created from SQL query`,
        epistemicStatus: frame.epistemicStatus || 'preliminary',
        methodology: `SQL: ${parsed.sql}`,
        caveats: frame.caveats || []
      }
    };
    events.push(setEvent);

    // Event: Records Created (for each resulting row)
    const recordEvents = result.rows.map((row, index) => {
      const recordId = generateOntologyId('rec');
      return {
        id: generateOntologyId('evt'),
        epistemicType: 'meant',
        category: 'record_created',
        timestamp,
        actor: 'system:sql_query',
        payload: {
          id: recordId,
          setId,
          values: row,
          rowIndex: index
        },
        grounding: {
          references: [
            { eventId: setEventId, kind: 'semantic' }
          ],
          derivation: {
            pipeline: [{ op: 'SELECT_ROW', params: { index } }],
            inputs: { setEventId }
          }
        }
      };
    });
    events.push(...recordEvents);

    // Determine derivation strategy based on pipeline
    // CON = Join (multiple sources), SEG = Single source with filters
    const hasJoin = parsed.pipeline.some(op => op.op === 'JOIN');
    const derivationStrategy = hasJoin ? DerivationStrategy.CON : DerivationStrategy.SEG;

    // Build derivation config based on strategy
    let derivationConfig;
    if (hasJoin) {
      // CON derivation for joins
      const joinOps = parsed.pipeline.filter(op => op.op === 'JOIN');
      derivationConfig = new DerivationConfig({
        strategy: DerivationStrategy.CON,
        joinSetIds: parsed.sourceRefs, // All sources involved in the join
        constraint: {
          sql: parsed.sql,
          pipeline: parsed.pipeline,
          joinConditions: joinOps.map(op => ({
            leftKey: op.params.leftKey,
            rightKey: op.params.rightKey,
            type: op.params.type,
            rightSourceId: op.params.rightSourceId
          }))
        },
        derivedBy: actor
      });
    } else {
      // SEG derivation for single-source queries
      derivationConfig = new DerivationConfig({
        strategy: DerivationStrategy.SEG,
        parentSourceId: parsed.sourceRefs[0],
        constraint: {
          sql: parsed.sql,
          pipeline: parsed.pipeline
        },
        derivedBy: actor
      });
    }

    // Create SetConfig
    const setConfig = new SetConfig({
      id: setId,
      name: setName,
      fields: this._inferFieldsFromResult(result),
      derivation: derivationConfig
    });

    return {
      set: setConfig,
      events,
      result: {
        rows: result.rows,
        columns: result.columns,
        stats: result.stats
      },
      pipeline: parsed.pipeline
    };
  }

  /**
   * Preview SQL query without creating Set
   */
  previewSQL(sql) {
    const parsed = this.parser.parse(sql);
    if (!parsed.success) {
      return { success: false, error: parsed.error };
    }

    const result = this.executor.execute(parsed.pipeline);

    return {
      success: true,
      pipeline: parsed.pipeline,
      sourceRefs: parsed.sourceRefs,
      result: {
        rows: result.rows.slice(0, 100), // Preview first 100
        columns: result.columns,
        totalRows: result.rows.length,
        stats: result.stats
      }
    };
  }

  /**
   * Get provenance chain for a SQL-derived Set
   */
  getProvenanceChain(setEventId) {
    const event = this.eventStore.get(setEventId);
    if (!event) return null;

    const chain = {
      set: event,
      query: null,
      sources: [],
      pipeline: event.grounding?.derivation?.pipeline || []
    };

    // Get query event
    const queryRef = event.grounding?.references?.find(r => r.kind === 'computational');
    if (queryRef) {
      chain.query = this.eventStore.get(queryRef.eventId);
    }

    // Get source events
    const sourceRefs = event.grounding?.references?.filter(r => r.kind === 'structural') || [];
    for (const ref of sourceRefs) {
      const sourceEvent = this.eventStore.get(ref.eventId);
      if (sourceEvent) chain.sources.push(sourceEvent);
    }

    return chain;
  }

  _inferFieldsFromResult(result) {
    if (result.rows.length === 0) return [];

    return result.columns.map(name => {
      const values = result.rows.map(r => r[name]).filter(v => v != null);
      const type = this._inferFieldType(values);
      return {
        id: generateOntologyId('fld'),
        name,
        type,
        sourceColumn: name
      };
    });
  }

  _inferFieldType(values) {
    if (values.length === 0) return 'text';

    const sample = values.slice(0, 100);

    // Check if all are numbers
    if (sample.every(v => !isNaN(parseFloat(v)) && isFinite(v))) {
      return sample.every(v => Number.isInteger(parseFloat(v))) ? 'integer' : 'number';
    }

    // Check if all are dates
    const datePattern = /^\d{4}-\d{2}-\d{2}/;
    if (sample.every(v => datePattern.test(String(v)))) {
      return 'date';
    }

    // Check if all are booleans
    const boolValues = ['true', 'false', 'yes', 'no', '1', '0'];
    if (sample.every(v => boolValues.includes(String(v).toLowerCase()))) {
      return 'boolean';
    }

    return 'text';
  }

  _getSourceEventId(sourceId) {
    // Look up the source event ID from the source ID
    // This would query the event store for the source_created event
    return `evt_source_${sourceId}`;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateOntologyId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

// ============================================================================
// Exports (for browser global scope)
// ============================================================================

if (typeof window !== 'undefined') {
  window.EOSQLParser = EOSQLParser;
  window.EOSQLExecutor = EOSQLExecutor;
  window.EOSQLSetBuilder = EOSQLSetBuilder;
  window.SQL_TO_EO_PREDICATE = SQL_TO_EO_PREDICATE;
}
