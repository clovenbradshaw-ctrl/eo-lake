/**
 * eo_formula_functions.js
 *
 * Complete function library with:
 * - Wrapper around formulajs implementations (when available)
 * - EO operator decomposition for each function
 * - Argument specifications
 * - Return type inference
 * - Pipeline generation
 */

window.EOFormulaFunctions = (function() {

  // ═══════════════════════════════════════════════════════════════
  // EO OPERATOR TYPES
  // ═══════════════════════════════════════════════════════════════

  const Op = {
    CON: 'CON',   // Connection - establish relational reach
    SEG: 'SEG',   // Segment - filter/partition/extract
    DES: 'DES',   // Designate - project property, assign meaning
    SYN: 'SYN',   // Synthesize - aggregate/collapse many→one
    ALT: 'ALT',   // Alternate - transform value(s)
    NUL: 'NUL',   // Null - handle absence
    INS: 'INS',   // Instantiate - create new value
    SUP: 'SUP',   // Superposition - hold multiple values
    REC: 'REC',   // Recursion - self-reference
  };

  // ═══════════════════════════════════════════════════════════════
  // ARGUMENT TYPES
  // ═══════════════════════════════════════════════════════════════

  const ArgType = {
    VALUE: 'value',           // Single value (scalar)
    ARRAY: 'array',           // Array of values
    FIELD: 'field',           // Field reference {Field} or #Set.Field
    FILTER: 'filter',         // Filter condition [Status = "Active"]
    TEXT: 'text',             // String literal
    NUMBER: 'number',         // Numeric literal
    BOOLEAN: 'boolean',       // Boolean
    DATE: 'date',             // Date value
    ANY: 'any',               // Any type
    LAMBDA: 'lambda',         // Expression with $ (current item)
  };

  // ═══════════════════════════════════════════════════════════════
  // FUNCTION REGISTRY
  // ═══════════════════════════════════════════════════════════════

  const functions = {};

  /**
   * Register a function with its metadata
   */
  function register(name, config) {
    functions[name.toUpperCase()] = {
      name: name.toUpperCase(),
      ...config,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // AGGREGATION FUNCTIONS (SYN)
  // These collapse arrays to single values
  // ═══════════════════════════════════════════════════════════════

  register('SUM', {
    category: 'Numeric',
    description: 'Add all numbers in a set',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:sum) - Synthesizes multiple values into their sum',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true, description: 'Numbers to sum' },
      { name: 'filter', type: ArgType.FILTER, required: false, description: 'Optional filter condition' },
    ],
    returns: ArgType.NUMBER,
    implementation: (values, filter) => {
      const arr = Array.isArray(values) ? values : [values];
      const filtered = filter ? arr.filter(filter) : arr;
      const nums = filtered.flat().map(v => Number(v)).filter(n => !isNaN(n));
      return nums.reduce((a, b) => a + b, 0);
    },
    toPipeline: (args) => [
      ...(args?.filter ? [{ operator: Op.SEG, params: { condition: args.filter } }] : []),
      { operator: Op.SYN, params: { mode: 'SUM' } },
    ],
    examples: [
      'SUM({Amount})',
      'SUM(#Orders.Total)',
      'SUM(#Orders.Total, [Status = "Paid"])',
    ],
  });

  register('AVERAGE', {
    category: 'Numeric',
    description: 'Calculate the mean of numbers in a set',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:average) - Synthesizes multiple values into their arithmetic mean',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
      { name: 'filter', type: ArgType.FILTER, required: false },
    ],
    returns: ArgType.NUMBER,
    implementation: (values, filter) => {
      const arr = Array.isArray(values) ? values : [values];
      const filtered = filter ? arr.filter(filter) : arr;
      const nums = filtered.flat().map(v => Number(v)).filter(n => !isNaN(n));
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    },
    toPipeline: (args) => [
      ...(args?.filter ? [{ operator: Op.SEG, params: { condition: args.filter } }] : []),
      { operator: Op.SYN, params: { mode: 'AVERAGE' } },
    ],
    examples: [
      'AVERAGE({Score})',
      'AVERAGE(#Reviews.Rating)',
    ],
  });

  register('COUNT', {
    category: 'Numeric',
    description: 'Count the number of items',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:count) - Synthesizes a set into its cardinality',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
      { name: 'filter', type: ArgType.FILTER, required: false },
    ],
    returns: ArgType.NUMBER,
    implementation: (values, filter) => {
      const arr = Array.isArray(values) ? values : [values];
      const filtered = filter ? arr.filter(filter) : arr;
      return filtered.flat().filter(v => v != null).length;
    },
    toPipeline: (args) => [
      ...(args?.filter ? [{ operator: Op.SEG, params: { condition: args.filter } }] : []),
      { operator: Op.SYN, params: { mode: 'COUNT' } },
    ],
    examples: [
      'COUNT(#Orders)',
      'COUNT(#Tasks, [Status = "Complete"])',
    ],
  });

  register('COUNTA', {
    category: 'Numeric',
    description: 'Count non-empty values',
    eoDecomposition: [Op.SEG, Op.SYN],
    eoExplanation: 'SEG(not empty) → SYN(count) - Filters then counts',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (...values) => {
      return values.flat().filter(v => v != null && v !== '').length;
    },
    toPipeline: () => [
      { operator: Op.SEG, params: { condition: { notEmpty: true } } },
      { operator: Op.SYN, params: { mode: 'COUNT' } },
    ],
  });

  register('MIN', {
    category: 'Numeric',
    description: 'Find the smallest value',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:min) - Synthesizes to the minimum value',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
      { name: 'filter', type: ArgType.FILTER, required: false },
    ],
    returns: ArgType.NUMBER,
    implementation: (...values) => {
      const nums = values.flat().map(v => Number(v)).filter(n => !isNaN(n));
      return nums.length ? Math.min(...nums) : null;
    },
    toPipeline: (args) => [
      ...(args?.filter ? [{ operator: Op.SEG, params: { condition: args.filter } }] : []),
      { operator: Op.SYN, params: { mode: 'MIN' } },
    ],
  });

  register('MAX', {
    category: 'Numeric',
    description: 'Find the largest value',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:max) - Synthesizes to the maximum value',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
      { name: 'filter', type: ArgType.FILTER, required: false },
    ],
    returns: ArgType.NUMBER,
    implementation: (...values) => {
      const nums = values.flat().map(v => Number(v)).filter(n => !isNaN(n));
      return nums.length ? Math.max(...nums) : null;
    },
    toPipeline: (args) => [
      ...(args?.filter ? [{ operator: Op.SEG, params: { condition: args.filter } }] : []),
      { operator: Op.SYN, params: { mode: 'MAX' } },
    ],
  });

  register('MEDIAN', {
    category: 'Numeric',
    description: 'Find the middle value',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:median) - Synthesizes to the median value',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (...values) => {
      const nums = values.flat().map(v => Number(v)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (!nums.length) return null;
      const mid = Math.floor(nums.length / 2);
      return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    },
    toPipeline: () => [
      { operator: Op.SYN, params: { mode: 'MEDIAN' } },
    ],
  });

  register('FIRST', {
    category: 'Aggregation',
    description: 'Get the first item',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:first) - Synthesizes to the first element',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (values) => {
      const arr = Array.isArray(values) ? values : [values];
      return arr[0] ?? null;
    },
    toPipeline: () => [
      { operator: Op.SYN, params: { mode: 'FIRST' } },
    ],
  });

  register('LAST', {
    category: 'Aggregation',
    description: 'Get the last item',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:last) - Synthesizes to the last element',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (values) => {
      const arr = Array.isArray(values) ? values : [values];
      return arr[arr.length - 1] ?? null;
    },
    toPipeline: () => [
      { operator: Op.SYN, params: { mode: 'LAST' } },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // ARRAY FUNCTIONS (SEG + ALT)
  // Transform or filter arrays
  // ═══════════════════════════════════════════════════════════════

  register('MAP', {
    category: 'Array',
    description: 'Transform each item in a set',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:map) - Applies transformation to each element',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
      { name: 'transform', type: ArgType.LAMBDA, required: true, description: 'Use $ for current item' },
    ],
    returns: ArgType.ARRAY,
    implementation: (values, transformFn) => {
      const arr = Array.isArray(values) ? values : [values];
      if (typeof transformFn === 'function') {
        return arr.map(transformFn);
      }
      return arr;
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'MAP', expression: args?.transform } },
    ],
    examples: [
      'MAP(#Orders, $.Total * 1.1)',
      'MAP(#Products, $.Price * {Discount})',
    ],
  });

  register('FILTER', {
    category: 'Array',
    description: 'Keep only items matching a condition',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(condition) - Segments the set by the condition',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
      { name: 'condition', type: ArgType.LAMBDA, required: true },
    ],
    returns: ArgType.ARRAY,
    implementation: (values, conditionFn) => {
      const arr = Array.isArray(values) ? values : [values];
      if (typeof conditionFn === 'function') {
        return arr.filter(conditionFn);
      }
      return arr;
    },
    toPipeline: (args) => [
      { operator: Op.SEG, params: { condition: args?.condition } },
    ],
    examples: [
      'FILTER(#Orders, $.Status = "Active")',
      'FILTER(#Tasks, $.DueDate < TODAY())',
    ],
  });

  register('SORT', {
    category: 'Array',
    description: 'Sort items by a value',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:sort) - Reorders elements without changing them',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
      { name: 'by', type: ArgType.LAMBDA, required: false },
      { name: 'direction', type: ArgType.TEXT, required: false, default: 'asc' },
    ],
    returns: ArgType.ARRAY,
    implementation: (values, byFn, direction = 'asc') => {
      const arr = Array.isArray(values) ? [...values] : [values];
      const sorted = arr.sort((a, b) => {
        const aVal = typeof byFn === 'function' ? byFn(a) : a;
        const bVal = typeof byFn === 'function' ? byFn(b) : b;
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      });
      return direction === 'desc' ? sorted.reverse() : sorted;
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'SORT', by: args?.by, direction: args?.direction } },
    ],
  });

  register('UNIQUE', {
    category: 'Array',
    description: 'Remove duplicate values',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(mode:unique) - Segments by identity, keeping one of each',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.ARRAY,
    implementation: (values) => {
      const arr = Array.isArray(values) ? values : [values];
      return [...new Set(arr)];
    },
    toPipeline: () => [
      { operator: Op.SEG, params: { mode: 'UNIQUE' } },
    ],
  });

  register('ARRAYUNIQUE', {
    category: 'Array',
    description: 'Remove duplicate values (alias for UNIQUE)',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(mode:unique) - Segments by identity, keeping one of each',
    args: [
      { name: 'array', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.ARRAY,
    implementation: (values) => {
      const arr = Array.isArray(values) ? values : [values];
      return [...new Set(arr)];
    },
    toPipeline: () => [
      { operator: Op.SEG, params: { mode: 'UNIQUE' } },
    ],
  });

  register('REVERSE', {
    category: 'Array',
    description: 'Reverse the order of items',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:reverse) - Inverts element order',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.ARRAY,
    implementation: (values) => {
      const arr = Array.isArray(values) ? [...values] : [values];
      return arr.reverse();
    },
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'REVERSE' } },
    ],
  });

  register('FLATTEN', {
    category: 'Array',
    description: 'Flatten nested arrays',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:flatten) - Collapses nested structure',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.ARRAY,
    implementation: (values) => {
      const arr = Array.isArray(values) ? values : [values];
      return arr.flat(Infinity);
    },
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'FLATTEN' } },
    ],
  });

  register('ARRAYFLATTEN', {
    category: 'Array',
    description: 'Flatten nested arrays (alias)',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:flatten) - Collapses nested structure',
    args: [
      { name: 'array', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.ARRAY,
    implementation: (values) => {
      const arr = Array.isArray(values) ? values : [values];
      return arr.flat(Infinity);
    },
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'FLATTEN' } },
    ],
  });

  register('COMPACT', {
    category: 'Array',
    description: 'Remove empty/null values',
    eoDecomposition: [Op.SEG, Op.NUL],
    eoExplanation: 'SEG(not null) + NUL(remove) - Filters out absence',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.ARRAY,
    implementation: (values) => {
      const arr = Array.isArray(values) ? values : [values];
      return arr.filter(v => v != null && v !== '');
    },
    toPipeline: () => [
      { operator: Op.SEG, params: { condition: { notNull: true } } },
    ],
  });

  register('ARRAYCOMPACT', {
    category: 'Array',
    description: 'Remove empty/null values (alias)',
    eoDecomposition: [Op.SEG, Op.NUL],
    eoExplanation: 'SEG(not null) + NUL(remove) - Filters out absence',
    args: [
      { name: 'array', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.ARRAY,
    implementation: (values) => {
      const arr = Array.isArray(values) ? values : [values];
      return arr.filter(v => v != null && v !== '');
    },
    toPipeline: () => [
      { operator: Op.SEG, params: { condition: { notNull: true } } },
    ],
  });

  register('ARRAYSLICE', {
    category: 'Array',
    description: 'Extract a portion of an array',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(start:n, end:m) - Segments array by position',
    args: [
      { name: 'array', type: ArgType.ARRAY, required: true },
      { name: 'start', type: ArgType.NUMBER, required: true },
      { name: 'end', type: ArgType.NUMBER, required: false },
    ],
    returns: ArgType.ARRAY,
    implementation: (values, start, end) => {
      const arr = Array.isArray(values) ? values : [values];
      return end !== undefined ? arr.slice(start, end) : arr.slice(start);
    },
    toPipeline: (args) => [
      { operator: Op.SEG, params: { mode: 'SLICE', start: args?.start, end: args?.end } },
    ],
  });

  register('ARRAYJOIN', {
    category: 'Array',
    description: 'Join array elements into a string',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:concat) - Synthesizes array into joined string',
    args: [
      { name: 'array', type: ArgType.ARRAY, required: true },
      { name: 'separator', type: ArgType.TEXT, required: false, default: ', ' },
    ],
    returns: ArgType.TEXT,
    implementation: (values, separator = ', ') => {
      const arr = Array.isArray(values) ? values : [values];
      return arr.filter(v => v != null).join(separator);
    },
    toPipeline: (args) => [
      { operator: Op.SYN, params: { mode: 'CONCAT', separator: args?.separator || ', ' } },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // TEXT FUNCTIONS (ALT)
  // Transform text values
  // ═══════════════════════════════════════════════════════════════

  register('CONCATENATE', {
    category: 'Text',
    description: 'Join text values together',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:concat) - Synthesizes texts into one string',
    args: [
      { name: 'text1', type: ArgType.TEXT, required: true },
      { name: 'text2', type: ArgType.TEXT, required: false },
    ],
    returns: ArgType.TEXT,
    implementation: (...args) => args.join(''),
    toPipeline: () => [
      { operator: Op.SYN, params: { mode: 'CONCAT', separator: '' } },
    ],
    examples: [
      'CONCATENATE({First}, " ", {Last})',
      'CONCATENATE("Hello ", {Name})',
    ],
  });

  register('CONCAT', {
    category: 'Text',
    description: 'Join text values together (alias)',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:concat) - Synthesizes texts into one string',
    args: [
      { name: 'text1', type: ArgType.TEXT, required: true },
      { name: 'text2', type: ArgType.TEXT, required: false },
    ],
    returns: ArgType.TEXT,
    implementation: (...args) => args.join(''),
    toPipeline: () => [
      { operator: Op.SYN, params: { mode: 'CONCAT', separator: '' } },
    ],
  });

  register('UPPER', {
    category: 'Text',
    description: 'Convert text to uppercase',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:case, case:upper) - Transforms character case',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (text) => String(text || '').toUpperCase(),
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'CASE', case: 'upper' } },
    ],
  });

  register('LOWER', {
    category: 'Text',
    description: 'Convert text to lowercase',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:case, case:lower) - Transforms character case',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (text) => String(text || '').toLowerCase(),
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'CASE', case: 'lower' } },
    ],
  });

  register('TRIM', {
    category: 'Text',
    description: 'Remove leading and trailing whitespace',
    eoDecomposition: [Op.ALT, Op.NUL],
    eoExplanation: 'ALT(mode:trim) + NUL(remove whitespace) - Removes absent-equivalent characters',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (text) => String(text || '').trim(),
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'TRIM' } },
    ],
  });

  register('LEFT', {
    category: 'Text',
    description: 'Extract characters from the start',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(start:0, end:n) - Segments text by position',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
      { name: 'count', type: ArgType.NUMBER, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (text, count) => String(text || '').substring(0, Number(count) || 0),
    toPipeline: (args) => [
      { operator: Op.SEG, params: { mode: 'SLICE', start: 0, end: args?.count } },
    ],
  });

  register('RIGHT', {
    category: 'Text',
    description: 'Extract characters from the end',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(start:-n, end:end) - Segments text by position from end',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
      { name: 'count', type: ArgType.NUMBER, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (text, count) => String(text || '').slice(-(Number(count) || 0)),
    toPipeline: (args) => [
      { operator: Op.SEG, params: { mode: 'SLICE', start: -(args?.count || 0) } },
    ],
  });

  register('MID', {
    category: 'Text',
    description: 'Extract characters from the middle',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(start:n, length:m) - Segments text by position and length',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
      { name: 'start', type: ArgType.NUMBER, required: true },
      { name: 'count', type: ArgType.NUMBER, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (text, start, count) => {
      const str = String(text || '');
      const s = (Number(start) || 1) - 1; // 1-indexed
      return str.substring(s, s + (Number(count) || 0));
    },
    toPipeline: (args) => [
      { operator: Op.SEG, params: { mode: 'SLICE', start: (args?.start || 1) - 1, length: args?.count } },
    ],
  });

  register('LEN', {
    category: 'Text',
    description: 'Get the length of text',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:length) - Designates the cardinality of characters',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (text) => String(text || '').length,
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'length' } },
    ],
  });

  register('FIND', {
    category: 'Text',
    description: 'Find position of text within text (case-sensitive)',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:position) - Designates location within text',
    args: [
      { name: 'find', type: ArgType.TEXT, required: true },
      { name: 'within', type: ArgType.TEXT, required: true },
      { name: 'start', type: ArgType.NUMBER, required: false, default: 1 },
    ],
    returns: ArgType.NUMBER,
    implementation: (find, within, start = 1) => {
      const str = String(within || '');
      const pos = str.indexOf(String(find || ''), (Number(start) || 1) - 1);
      return pos === -1 ? 0 : pos + 1; // 1-indexed, 0 if not found
    },
    toPipeline: (args) => [
      { operator: Op.DES, params: { property: 'position', search: args?.find, start: args?.start } },
    ],
  });

  register('SEARCH', {
    category: 'Text',
    description: 'Find position of text (case-insensitive)',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:position, caseInsensitive) - Designates location within text',
    args: [
      { name: 'find', type: ArgType.TEXT, required: true },
      { name: 'within', type: ArgType.TEXT, required: true },
      { name: 'start', type: ArgType.NUMBER, required: false, default: 1 },
    ],
    returns: ArgType.NUMBER,
    implementation: (find, within, start = 1) => {
      const str = String(within || '').toLowerCase();
      const pos = str.indexOf(String(find || '').toLowerCase(), (Number(start) || 1) - 1);
      return pos === -1 ? 0 : pos + 1;
    },
    toPipeline: (args) => [
      { operator: Op.DES, params: { property: 'position', search: args?.find, start: args?.start, caseInsensitive: true } },
    ],
  });

  register('REPLACE', {
    category: 'Text',
    description: 'Replace text at a specific position',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:replace) - Transforms by substitution',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
      { name: 'start', type: ArgType.NUMBER, required: true },
      { name: 'count', type: ArgType.NUMBER, required: true },
      { name: 'newText', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (text, start, count, newText) => {
      const str = String(text || '');
      const s = (Number(start) || 1) - 1;
      const c = Number(count) || 0;
      return str.substring(0, s) + String(newText || '') + str.substring(s + c);
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'REPLACE', start: args?.start, count: args?.count, replacement: args?.newText } },
    ],
  });

  register('SUBSTITUTE', {
    category: 'Text',
    description: 'Replace all occurrences of text',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:substitute) - Transforms by pattern substitution',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
      { name: 'oldText', type: ArgType.TEXT, required: true },
      { name: 'newText', type: ArgType.TEXT, required: true },
      { name: 'occurrence', type: ArgType.NUMBER, required: false },
    ],
    returns: ArgType.TEXT,
    implementation: (text, oldText, newText, occurrence) => {
      const str = String(text || '');
      const old = String(oldText || '');
      const replacement = String(newText || '');

      if (occurrence !== undefined) {
        let count = 0;
        return str.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), (match) => {
          count++;
          return count === Number(occurrence) ? replacement : match;
        });
      }
      return str.split(old).join(replacement);
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'SUBSTITUTE', find: args?.oldText, replace: args?.newText } },
    ],
  });

  register('SPLIT', {
    category: 'Text',
    description: 'Split text into an array',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(mode:split) - Segments text by delimiter into array',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
      { name: 'delimiter', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.ARRAY,
    implementation: (text, delimiter) => String(text || '').split(delimiter),
    toPipeline: (args) => [
      { operator: Op.SEG, params: { mode: 'SPLIT', delimiter: args?.delimiter } },
    ],
  });

  register('REPT', {
    category: 'Text',
    description: 'Repeat text a specified number of times',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:repeat) - Transforms by repetition',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
      { name: 'times', type: ArgType.NUMBER, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (text, times) => String(text || '').repeat(Math.max(0, Number(times) || 0)),
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'REPEAT', times: args?.times } },
    ],
  });

  register('T', {
    category: 'Text',
    description: 'Returns text if value is text, empty string otherwise',
    eoDecomposition: [Op.ALT, Op.NUL],
    eoExplanation: 'ALT(mode:coerce) + NUL(default:"") - Coerces to text or empty',
    args: [
      { name: 'value', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (value) => typeof value === 'string' ? value : '',
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'COERCE_TEXT' } },
    ],
  });

  register('ENCODE_URL_COMPONENT', {
    category: 'Text',
    description: 'URL-encode a string',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:encode, format:url) - Transforms for URL safety',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (text) => encodeURIComponent(String(text || '')),
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'ENCODE', format: 'url' } },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // LOGICAL FUNCTIONS (SEG + ALT)
  // ═══════════════════════════════════════════════════════════════

  register('IF', {
    category: 'Logical',
    description: 'Return one value if true, another if false',
    eoDecomposition: [Op.SEG, Op.ALT],
    eoExplanation: 'SEG(condition) → ALT(select branch) - Segments by condition, selects result',
    args: [
      { name: 'condition', type: ArgType.BOOLEAN, required: true },
      { name: 'valueIfTrue', type: ArgType.ANY, required: true },
      { name: 'valueIfFalse', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (condition, valueIfTrue, valueIfFalse) => condition ? valueIfTrue : valueIfFalse,
    toPipeline: (args) => [
      { operator: Op.SEG, params: { condition: args?.condition } },
      { operator: Op.ALT, params: { mode: 'SELECT', ifTrue: args?.valueIfTrue, ifFalse: args?.valueIfFalse } },
    ],
    examples: [
      'IF({Status} = "Active", "Yes", "No")',
      'IF({Total} > 1000, "High", "Low")',
    ],
  });

  register('IFS', {
    category: 'Logical',
    description: 'Check multiple conditions in order',
    eoDecomposition: [Op.SEG, Op.ALT],
    eoExplanation: 'Multiple SEG(condition) → ALT(select) in sequence',
    args: [
      { name: 'condition1', type: ArgType.BOOLEAN, required: true },
      { name: 'value1', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (...args) => {
      for (let i = 0; i < args.length - 1; i += 2) {
        if (args[i]) return args[i + 1];
      }
      return null;
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'IFS', conditions: args } },
    ],
  });

  register('SWITCH', {
    category: 'Logical',
    description: 'Match a value against cases',
    eoDecomposition: [Op.SEG, Op.ALT],
    eoExplanation: 'SEG(match) → ALT(select case) - Pattern matching',
    args: [
      { name: 'expression', type: ArgType.ANY, required: true },
      { name: 'case1', type: ArgType.ANY, required: true },
      { name: 'result1', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (...args) => {
      const expr = args[0];
      for (let i = 1; i < args.length - 1; i += 2) {
        if (expr === args[i]) return args[i + 1];
      }
      // Return default if odd number of args (last one is default)
      return args.length % 2 === 0 ? args[args.length - 1] : null;
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'SWITCH', cases: args } },
    ],
  });

  register('AND', {
    category: 'Logical',
    description: 'True if all conditions are true',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:all) - Synthesizes booleans with logical conjunction',
    args: [
      { name: 'conditions', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.BOOLEAN,
    implementation: (...args) => args.every(v => !!v),
    toPipeline: () => [
      { operator: Op.SYN, params: { mode: 'AND' } },
    ],
  });

  register('OR', {
    category: 'Logical',
    description: 'True if any condition is true',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:any) - Synthesizes booleans with logical disjunction',
    args: [
      { name: 'conditions', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.BOOLEAN,
    implementation: (...args) => args.some(v => !!v),
    toPipeline: () => [
      { operator: Op.SYN, params: { mode: 'OR' } },
    ],
  });

  register('NOT', {
    category: 'Logical',
    description: 'Invert a boolean value',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:negate) - Transforms boolean to its opposite',
    args: [
      { name: 'value', type: ArgType.BOOLEAN, required: true },
    ],
    returns: ArgType.BOOLEAN,
    implementation: (value) => !value,
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'NEGATE' } },
    ],
  });

  register('XOR', {
    category: 'Logical',
    description: 'True if exactly one condition is true',
    eoDecomposition: [Op.SYN],
    eoExplanation: 'SYN(mode:xor) - Synthesizes booleans with exclusive or',
    args: [
      { name: 'conditions', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.BOOLEAN,
    implementation: (...args) => args.filter(v => !!v).length === 1,
    toPipeline: () => [
      { operator: Op.SYN, params: { mode: 'XOR' } },
    ],
  });

  register('TRUE', {
    category: 'Logical',
    description: 'Returns true',
    eoDecomposition: [Op.INS],
    eoExplanation: 'INS(value:true) - Instantiates boolean true',
    args: [],
    returns: ArgType.BOOLEAN,
    implementation: () => true,
    toPipeline: () => [
      { operator: Op.INS, params: { value: true } },
    ],
  });

  register('FALSE', {
    category: 'Logical',
    description: 'Returns false',
    eoDecomposition: [Op.INS],
    eoExplanation: 'INS(value:false) - Instantiates boolean false',
    args: [],
    returns: ArgType.BOOLEAN,
    implementation: () => false,
    toPipeline: () => [
      { operator: Op.INS, params: { value: false } },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // NULL HANDLING FUNCTIONS (NUL)
  // ═══════════════════════════════════════════════════════════════

  register('ISBLANK', {
    category: 'Null',
    description: 'Check if a value is blank/empty',
    eoDecomposition: [Op.NUL, Op.DES],
    eoExplanation: 'NUL(detect) → DES(isAbsent) - Detects and designates absence',
    args: [
      { name: 'value', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.BOOLEAN,
    implementation: (value) => value == null || value === '',
    toPipeline: () => [
      { operator: Op.NUL, params: { mode: 'DETECT' } },
    ],
  });

  register('BLANK', {
    category: 'Null',
    description: 'Return a blank value',
    eoDecomposition: [Op.NUL],
    eoExplanation: 'NUL(create) - Instantiates absence',
    args: [],
    returns: ArgType.ANY,
    implementation: () => null,
    toPipeline: () => [
      { operator: Op.NUL, params: { mode: 'CREATE' } },
    ],
  });

  register('IFBLANK', {
    category: 'Null',
    description: 'Return a default value if blank',
    eoDecomposition: [Op.NUL, Op.ALT],
    eoExplanation: 'NUL(detect) → ALT(substitute) - Replaces absence with default',
    args: [
      { name: 'value', type: ArgType.ANY, required: true },
      { name: 'default', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (value, defaultValue) =>
      (value == null || value === '') ? defaultValue : value,
    toPipeline: (args) => [
      { operator: Op.NUL, params: { mode: 'COALESCE', default: args?.default } },
    ],
    examples: [
      'IFBLANK({Nickname}, {Name})',
      'IFBLANK({Custom}, "Default")',
    ],
  });

  register('COALESCE', {
    category: 'Null',
    description: 'Return first non-blank value',
    eoDecomposition: [Op.NUL, Op.SYN],
    eoExplanation: 'NUL(detect each) → SYN(first non-null) - Finds first present value',
    args: [
      { name: 'value1', type: ArgType.ANY, required: true },
      { name: 'value2', type: ArgType.ANY, required: false },
    ],
    returns: ArgType.ANY,
    implementation: (...args) => args.find(v => v != null && v !== '') ?? null,
    toPipeline: () => [
      { operator: Op.NUL, params: { mode: 'COALESCE' } },
    ],
  });

  register('IFERROR', {
    category: 'Null',
    description: 'Return a default value if error',
    eoDecomposition: [Op.NUL, Op.ALT],
    eoExplanation: 'NUL(detectError) → ALT(substitute) - Catches and replaces errors',
    args: [
      { name: 'value', type: ArgType.ANY, required: true },
      { name: 'default', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (value, defaultValue) => {
      try {
        if (value instanceof Error || value === '#ERROR') return defaultValue;
        return value;
      } catch {
        return defaultValue;
      }
    },
    toPipeline: (args) => [
      { operator: Op.NUL, params: { mode: 'CATCH_ERROR', default: args?.default } },
    ],
  });

  register('ISERROR', {
    category: 'Null',
    description: 'Check if value is an error',
    eoDecomposition: [Op.NUL, Op.DES],
    eoExplanation: 'NUL(detectError) → DES(isError) - Detects error state',
    args: [
      { name: 'value', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.BOOLEAN,
    implementation: (value) => value instanceof Error || value === '#ERROR',
    toPipeline: () => [
      { operator: Op.NUL, params: { mode: 'DETECT_ERROR' } },
    ],
  });

  register('ERROR', {
    category: 'Null',
    description: 'Return an error value',
    eoDecomposition: [Op.NUL],
    eoExplanation: 'NUL(createError) - Instantiates error state',
    args: [],
    returns: ArgType.ANY,
    implementation: () => '#ERROR',
    toPipeline: () => [
      { operator: Op.NUL, params: { mode: 'CREATE_ERROR' } },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // MATH FUNCTIONS (ALT)
  // ═══════════════════════════════════════════════════════════════

  register('ROUND', {
    category: 'Numeric',
    description: 'Round to specified decimal places',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:round) - Transforms number by rounding',
    args: [
      { name: 'number', type: ArgType.NUMBER, required: true },
      { name: 'places', type: ArgType.NUMBER, required: false, default: 0 },
    ],
    returns: ArgType.NUMBER,
    implementation: (number, places = 0) => {
      const factor = Math.pow(10, Number(places) || 0);
      return Math.round(Number(number) * factor) / factor;
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'ROUND', places: args?.places } },
    ],
  });

  register('ROUNDUP', {
    category: 'Numeric',
    description: 'Round up to specified decimal places',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:roundUp) - Transforms by upward rounding',
    args: [
      { name: 'number', type: ArgType.NUMBER, required: true },
      { name: 'places', type: ArgType.NUMBER, required: false, default: 0 },
    ],
    returns: ArgType.NUMBER,
    implementation: (number, places = 0) => {
      const factor = Math.pow(10, Number(places) || 0);
      return Math.ceil(Number(number) * factor) / factor;
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'ROUND_UP', places: args?.places } },
    ],
  });

  register('ROUNDDOWN', {
    category: 'Numeric',
    description: 'Round down to specified decimal places',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:roundDown) - Transforms by downward rounding',
    args: [
      { name: 'number', type: ArgType.NUMBER, required: true },
      { name: 'places', type: ArgType.NUMBER, required: false, default: 0 },
    ],
    returns: ArgType.NUMBER,
    implementation: (number, places = 0) => {
      const factor = Math.pow(10, Number(places) || 0);
      return Math.floor(Number(number) * factor) / factor;
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'ROUND_DOWN', places: args?.places } },
    ],
  });

  register('FLOOR', {
    category: 'Numeric',
    description: 'Round down to nearest multiple',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:floor) - Transforms by downward rounding',
    args: [
      { name: 'number', type: ArgType.NUMBER, required: true },
      { name: 'significance', type: ArgType.NUMBER, required: false, default: 1 },
    ],
    returns: ArgType.NUMBER,
    implementation: (number, significance = 1) => {
      const sig = Number(significance) || 1;
      return Math.floor(Number(number) / sig) * sig;
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'FLOOR', significance: args?.significance } },
    ],
  });

  register('CEILING', {
    category: 'Numeric',
    description: 'Round up to nearest multiple',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:ceiling) - Transforms by upward rounding',
    args: [
      { name: 'number', type: ArgType.NUMBER, required: true },
      { name: 'significance', type: ArgType.NUMBER, required: false, default: 1 },
    ],
    returns: ArgType.NUMBER,
    implementation: (number, significance = 1) => {
      const sig = Number(significance) || 1;
      return Math.ceil(Number(number) / sig) * sig;
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'CEILING', significance: args?.significance } },
    ],
  });

  register('ABS', {
    category: 'Numeric',
    description: 'Get absolute value',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:abs) - Transforms by removing sign',
    args: [
      { name: 'number', type: ArgType.NUMBER, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (number) => Math.abs(Number(number)),
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'ABS' } },
    ],
  });

  register('INT', {
    category: 'Numeric',
    description: 'Get integer part of number',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:int) - Transforms by truncating decimal',
    args: [
      { name: 'number', type: ArgType.NUMBER, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (number) => Math.floor(Number(number)),
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'INT' } },
    ],
  });

  register('MOD', {
    category: 'Numeric',
    description: 'Get remainder after division',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:mod) - Transforms via modulo operation',
    args: [
      { name: 'number', type: ArgType.NUMBER, required: true },
      { name: 'divisor', type: ArgType.NUMBER, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (number, divisor) => Number(number) % Number(divisor),
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'MOD', divisor: args?.divisor } },
    ],
  });

  register('POWER', {
    category: 'Numeric',
    description: 'Raise to a power',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:power) - Transforms via exponentiation',
    args: [
      { name: 'number', type: ArgType.NUMBER, required: true },
      { name: 'exponent', type: ArgType.NUMBER, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (number, exponent) => Math.pow(Number(number), Number(exponent)),
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'POWER', exponent: args?.exponent } },
    ],
  });

  register('SQRT', {
    category: 'Numeric',
    description: 'Square root',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:sqrt) - Transforms via square root',
    args: [
      { name: 'number', type: ArgType.NUMBER, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (number) => Math.sqrt(Number(number)),
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'SQRT' } },
    ],
  });

  register('EXP', {
    category: 'Numeric',
    description: 'e raised to a power',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:exp) - Transforms via natural exponentiation',
    args: [
      { name: 'power', type: ArgType.NUMBER, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (power) => Math.exp(Number(power)),
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'EXP' } },
    ],
  });

  register('LOG', {
    category: 'Numeric',
    description: 'Logarithm',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:log) - Transforms via logarithm',
    args: [
      { name: 'number', type: ArgType.NUMBER, required: true },
      { name: 'base', type: ArgType.NUMBER, required: false, default: 10 },
    ],
    returns: ArgType.NUMBER,
    implementation: (number, base = 10) => Math.log(Number(number)) / Math.log(Number(base) || 10),
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'LOG', base: args?.base } },
    ],
  });

  register('VALUE', {
    category: 'Numeric',
    description: 'Convert text to number',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:coerce, type:number) - Transforms text to numeric',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (text) => {
      const num = Number(String(text || '').replace(/[^0-9.-]/g, ''));
      return isNaN(num) ? 0 : num;
    },
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'COERCE_NUMBER' } },
    ],
  });

  register('EVEN', {
    category: 'Numeric',
    description: 'Round to next even number',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:even) - Transforms to nearest even',
    args: [
      { name: 'number', type: ArgType.NUMBER, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (number) => {
      const n = Number(number);
      const ceil = Math.ceil(Math.abs(n));
      const even = ceil % 2 === 0 ? ceil : ceil + 1;
      return n >= 0 ? even : -even;
    },
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'EVEN' } },
    ],
  });

  register('ODD', {
    category: 'Numeric',
    description: 'Round to next odd number',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:odd) - Transforms to nearest odd',
    args: [
      { name: 'number', type: ArgType.NUMBER, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (number) => {
      const n = Number(number);
      const ceil = Math.ceil(Math.abs(n));
      const odd = ceil % 2 === 1 ? ceil : ceil + 1;
      return n >= 0 ? odd : -odd;
    },
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'ODD' } },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // DATE FUNCTIONS (INS, DES, ALT)
  // ═══════════════════════════════════════════════════════════════

  register('NOW', {
    category: 'Date',
    description: 'Current date and time',
    eoDecomposition: [Op.INS],
    eoExplanation: 'INS(temporal:now) - Instantiates current moment',
    args: [],
    returns: ArgType.DATE,
    implementation: () => new Date(),
    toPipeline: () => [
      { operator: Op.INS, params: { mode: 'NOW' } },
    ],
    isVolatile: true,
  });

  register('TODAY', {
    category: 'Date',
    description: 'Current date (without time)',
    eoDecomposition: [Op.INS],
    eoExplanation: 'INS(temporal:today) - Instantiates current date',
    args: [],
    returns: ArgType.DATE,
    implementation: () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    },
    toPipeline: () => [
      { operator: Op.INS, params: { mode: 'TODAY' } },
    ],
    isVolatile: true,
  });

  register('DATE', {
    category: 'Date',
    description: 'Create a date from year, month, day',
    eoDecomposition: [Op.INS],
    eoExplanation: 'INS(temporal:construct) - Instantiates date from components',
    args: [
      { name: 'year', type: ArgType.NUMBER, required: true },
      { name: 'month', type: ArgType.NUMBER, required: true },
      { name: 'day', type: ArgType.NUMBER, required: true },
    ],
    returns: ArgType.DATE,
    implementation: (year, month, day) => new Date(Number(year), Number(month) - 1, Number(day)),
    toPipeline: (args) => [
      { operator: Op.INS, params: { mode: 'DATE', year: args?.year, month: args?.month, day: args?.day } },
    ],
  });

  register('YEAR', {
    category: 'Date',
    description: 'Extract year from date',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:year) - Designates year component',
    args: [
      { name: 'date', type: ArgType.DATE, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (date) => new Date(date).getFullYear(),
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'year' } },
    ],
  });

  register('MONTH', {
    category: 'Date',
    description: 'Extract month from date (1-12)',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:month) - Designates month component',
    args: [
      { name: 'date', type: ArgType.DATE, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (date) => new Date(date).getMonth() + 1,
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'month' } },
    ],
  });

  register('DAY', {
    category: 'Date',
    description: 'Extract day from date (1-31)',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:day) - Designates day component',
    args: [
      { name: 'date', type: ArgType.DATE, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (date) => new Date(date).getDate(),
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'day' } },
    ],
  });

  register('HOUR', {
    category: 'Date',
    description: 'Extract hour from datetime (0-23)',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:hour) - Designates hour component',
    args: [
      { name: 'datetime', type: ArgType.DATE, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (date) => new Date(date).getHours(),
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'hour' } },
    ],
  });

  register('MINUTE', {
    category: 'Date',
    description: 'Extract minute from datetime (0-59)',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:minute) - Designates minute component',
    args: [
      { name: 'datetime', type: ArgType.DATE, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (date) => new Date(date).getMinutes(),
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'minute' } },
    ],
  });

  register('SECOND', {
    category: 'Date',
    description: 'Extract second from datetime (0-59)',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:second) - Designates second component',
    args: [
      { name: 'datetime', type: ArgType.DATE, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (date) => new Date(date).getSeconds(),
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'second' } },
    ],
  });

  register('DATEADD', {
    category: 'Date',
    description: 'Add time to a date',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:dateAdd) - Transforms date by adding duration',
    args: [
      { name: 'date', type: ArgType.DATE, required: true },
      { name: 'amount', type: ArgType.NUMBER, required: true },
      { name: 'unit', type: ArgType.TEXT, required: true, options: ['days', 'weeks', 'months', 'years'] },
    ],
    returns: ArgType.DATE,
    implementation: (date, amount, unit) => {
      const d = new Date(date);
      const amt = Number(amount);
      switch (String(unit).toLowerCase()) {
        case 'days': case 'day': d.setDate(d.getDate() + amt); break;
        case 'weeks': case 'week': d.setDate(d.getDate() + amt * 7); break;
        case 'months': case 'month': d.setMonth(d.getMonth() + amt); break;
        case 'years': case 'year': d.setFullYear(d.getFullYear() + amt); break;
        case 'hours': case 'hour': d.setHours(d.getHours() + amt); break;
        case 'minutes': case 'minute': d.setMinutes(d.getMinutes() + amt); break;
        case 'seconds': case 'second': d.setSeconds(d.getSeconds() + amt); break;
      }
      return d;
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'DATE_ADD', amount: args?.amount, unit: args?.unit } },
    ],
  });

  register('DATETIME_DIFF', {
    category: 'Date',
    description: 'Calculate difference between dates',
    eoDecomposition: [Op.ALT, Op.DES],
    eoExplanation: 'ALT(mode:diff) → DES(property:duration) - Computes and designates temporal distance',
    args: [
      { name: 'date1', type: ArgType.DATE, required: true },
      { name: 'date2', type: ArgType.DATE, required: true },
      { name: 'unit', type: ArgType.TEXT, required: false, default: 'days' },
    ],
    returns: ArgType.NUMBER,
    implementation: (date1, date2, unit = 'days') => {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      const diff = d2.getTime() - d1.getTime();
      switch (String(unit).toLowerCase()) {
        case 'seconds': case 'second': return Math.floor(diff / 1000);
        case 'minutes': case 'minute': return Math.floor(diff / (1000 * 60));
        case 'hours': case 'hour': return Math.floor(diff / (1000 * 60 * 60));
        case 'days': case 'day': return Math.floor(diff / (1000 * 60 * 60 * 24));
        case 'weeks': case 'week': return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
        case 'months': case 'month': return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
        case 'years': case 'year': return d2.getFullYear() - d1.getFullYear();
        default: return Math.floor(diff / (1000 * 60 * 60 * 24));
      }
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'DATE_DIFF', unit: args?.unit } },
    ],
  });

  register('WEEKDAY', {
    category: 'Date',
    description: 'Get day of week (0=Sunday by default)',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:weekday) - Designates weekday component',
    args: [
      { name: 'date', type: ArgType.DATE, required: true },
      { name: 'startDay', type: ArgType.NUMBER, required: false, default: 0 },
    ],
    returns: ArgType.NUMBER,
    implementation: (date, startDay = 0) => {
      const day = new Date(date).getDay();
      return (day - Number(startDay) + 7) % 7;
    },
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'weekday' } },
    ],
  });

  register('WEEKNUM', {
    category: 'Date',
    description: 'Get week number in year',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:weeknum) - Designates week number',
    args: [
      { name: 'date', type: ArgType.DATE, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (date) => {
      const d = new Date(date);
      const start = new Date(d.getFullYear(), 0, 1);
      const diff = d.getTime() - start.getTime();
      return Math.ceil((diff / (1000 * 60 * 60 * 24) + start.getDay() + 1) / 7);
    },
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'weeknum' } },
    ],
  });

  register('DATETIME_FORMAT', {
    category: 'Date',
    description: 'Format date as string',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:format) - Transforms date to formatted string',
    args: [
      { name: 'date', type: ArgType.DATE, required: true },
      { name: 'format', type: ArgType.TEXT, required: false },
    ],
    returns: ArgType.TEXT,
    implementation: (date, format) => {
      const d = new Date(date);
      if (!format) return d.toISOString();
      // Simple format support
      return format
        .replace('YYYY', d.getFullYear())
        .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
        .replace('DD', String(d.getDate()).padStart(2, '0'))
        .replace('HH', String(d.getHours()).padStart(2, '0'))
        .replace('mm', String(d.getMinutes()).padStart(2, '0'))
        .replace('ss', String(d.getSeconds()).padStart(2, '0'));
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'FORMAT', format: args?.format } },
    ],
  });

  register('DATETIME_PARSE', {
    category: 'Date',
    description: 'Parse string to date',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:parse) - Transforms string to date',
    args: [
      { name: 'string', type: ArgType.TEXT, required: true },
      { name: 'format', type: ArgType.TEXT, required: false },
    ],
    returns: ArgType.DATE,
    implementation: (string) => new Date(string),
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'PARSE_DATE', format: args?.format } },
    ],
  });

  register('DATESTR', {
    category: 'Date',
    description: 'Date as YYYY-MM-DD string',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:format, format:ISO) - Transforms date to ISO date string',
    args: [
      { name: 'date', type: ArgType.DATE, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (date) => new Date(date).toISOString().split('T')[0],
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'FORMAT', format: 'YYYY-MM-DD' } },
    ],
  });

  register('TIMESTR', {
    category: 'Date',
    description: 'Time as HH:MM:SS string',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:format, format:time) - Transforms datetime to time string',
    args: [
      { name: 'datetime', type: ArgType.DATE, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (date) => new Date(date).toTimeString().split(' ')[0],
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'FORMAT', format: 'HH:mm:ss' } },
    ],
  });

  register('TONOW', {
    category: 'Date',
    description: 'Days from date to now',
    eoDecomposition: [Op.ALT, Op.DES],
    eoExplanation: 'ALT(diff with now) → DES(days) - Computes days to present',
    args: [
      { name: 'date', type: ArgType.DATE, required: true },
    ],
    returns: ArgType.NUMBER,
    implementation: (date) => {
      const d = new Date(date);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    },
    toPipeline: () => [
      { operator: Op.ALT, params: { mode: 'DATE_DIFF', unit: 'days', toNow: true } },
    ],
  });

  register('IS_BEFORE', {
    category: 'Date',
    description: 'Check if date1 is before date2',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(comparison:lt) - Segments by temporal comparison',
    args: [
      { name: 'date1', type: ArgType.DATE, required: true },
      { name: 'date2', type: ArgType.DATE, required: true },
    ],
    returns: ArgType.BOOLEAN,
    implementation: (date1, date2) => new Date(date1) < new Date(date2),
    toPipeline: () => [
      { operator: Op.SEG, params: { mode: 'COMPARE', op: 'lt' } },
    ],
  });

  register('IS_AFTER', {
    category: 'Date',
    description: 'Check if date1 is after date2',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(comparison:gt) - Segments by temporal comparison',
    args: [
      { name: 'date1', type: ArgType.DATE, required: true },
      { name: 'date2', type: ArgType.DATE, required: true },
    ],
    returns: ArgType.BOOLEAN,
    implementation: (date1, date2) => new Date(date1) > new Date(date2),
    toPipeline: () => [
      { operator: Op.SEG, params: { mode: 'COMPARE', op: 'gt' } },
    ],
  });

  register('IS_SAME', {
    category: 'Date',
    description: 'Check if dates are the same',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(comparison:eq) - Segments by temporal equality',
    args: [
      { name: 'date1', type: ArgType.DATE, required: true },
      { name: 'date2', type: ArgType.DATE, required: true },
      { name: 'unit', type: ArgType.TEXT, required: false, default: 'day' },
    ],
    returns: ArgType.BOOLEAN,
    implementation: (date1, date2, unit = 'day') => {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      switch (String(unit).toLowerCase()) {
        case 'year': return d1.getFullYear() === d2.getFullYear();
        case 'month': return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
        case 'day': default: return d1.toDateString() === d2.toDateString();
      }
    },
    toPipeline: () => [
      { operator: Op.SEG, params: { mode: 'COMPARE', op: 'eq' } },
    ],
  });

  register('CREATED_TIME', {
    category: 'Date',
    description: 'Record creation time',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:createdTime) - Designates creation timestamp',
    args: [],
    returns: ArgType.DATE,
    implementation: () => new Date(), // Would be pulled from record context
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'createdTime', scope: 'record' } },
    ],
  });

  register('LAST_MODIFIED_TIME', {
    category: 'Date',
    description: 'Last modification time',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:modifiedTime) - Designates modification timestamp',
    args: [
      { name: 'field', type: ArgType.FIELD, required: false },
    ],
    returns: ArgType.DATE,
    implementation: () => new Date(), // Would be pulled from record context
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'modifiedTime', scope: 'record' } },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // REGEX FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  register('REGEX_MATCH', {
    category: 'Regex',
    description: 'Check if text matches a pattern',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(condition:regex) - Segments by pattern match',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
      { name: 'pattern', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.BOOLEAN,
    implementation: (text, pattern) => {
      try {
        return new RegExp(pattern).test(String(text || ''));
      } catch {
        return false;
      }
    },
    toPipeline: (args) => [
      { operator: Op.SEG, params: { mode: 'REGEX_MATCH', pattern: args?.pattern } },
    ],
  });

  register('REGEX_EXTRACT', {
    category: 'Regex',
    description: 'Extract first match from text',
    eoDecomposition: [Op.SEG, Op.DES],
    eoExplanation: 'SEG(regex) → DES(match) - Segments by pattern and designates match',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
      { name: 'pattern', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (text, pattern) => {
      try {
        const match = String(text || '').match(new RegExp(pattern));
        return match ? match[0] : null;
      } catch {
        return null;
      }
    },
    toPipeline: (args) => [
      { operator: Op.SEG, params: { mode: 'REGEX_EXTRACT', pattern: args?.pattern } },
    ],
  });

  register('REGEX_REPLACE', {
    category: 'Regex',
    description: 'Replace matches in text',
    eoDecomposition: [Op.ALT],
    eoExplanation: 'ALT(mode:regex_replace) - Transforms by pattern substitution',
    args: [
      { name: 'text', type: ArgType.TEXT, required: true },
      { name: 'pattern', type: ArgType.TEXT, required: true },
      { name: 'replacement', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.TEXT,
    implementation: (text, pattern, replacement) => {
      try {
        return String(text || '').replace(new RegExp(pattern, 'g'), replacement);
      } catch {
        return text;
      }
    },
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'REGEX_REPLACE', pattern: args?.pattern, replacement: args?.replacement } },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // RECORD FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  register('RECORD_ID', {
    category: 'Record',
    description: 'Current record ID',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:id) - Designates record identifier',
    args: [],
    returns: ArgType.TEXT,
    implementation: () => null, // Would be pulled from record context
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'id', scope: 'record' } },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // CONNECTION FUNCTIONS (CON) - EO Unique
  // These traverse relationships
  // ═══════════════════════════════════════════════════════════════

  register('LOOKUP', {
    category: 'Connection',
    description: 'Get values from related records',
    eoDecomposition: [Op.CON, Op.DES],
    eoExplanation: 'CON(traverse) → DES(property) - Traverses connection and projects property',
    args: [
      { name: 'connection', type: ArgType.FIELD, required: true, description: 'The #Set.Field reference' },
    ],
    returns: ArgType.ANY,
    toPipeline: (args) => [
      { operator: Op.CON, params: { source: args?.connection?.set } },
      { operator: Op.DES, params: { property: args?.connection?.field } },
    ],
  });

  register('ROLLUP', {
    category: 'Connection',
    description: 'Aggregate values from related records',
    eoDecomposition: [Op.CON, Op.SEG, Op.DES, Op.SYN],
    eoExplanation: 'CON → SEG? → DES → SYN - Full aggregation pipeline over connection',
    args: [
      { name: 'connection', type: ArgType.FIELD, required: true },
      { name: 'aggregation', type: ArgType.TEXT, required: true, options: ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'] },
      { name: 'filter', type: ArgType.FILTER, required: false },
    ],
    returns: ArgType.NUMBER,
    toPipeline: (args) => [
      { operator: Op.CON, params: { source: args?.connection?.set } },
      ...(args?.filter ? [{ operator: Op.SEG, params: { condition: args.filter } }] : []),
      { operator: Op.DES, params: { property: args?.connection?.field } },
      { operator: Op.SYN, params: { mode: args?.aggregation } },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // SUPERPOSITION FUNCTIONS (SUP) - EO Unique
  // ═══════════════════════════════════════════════════════════════

  register('SUPERPOSE', {
    category: 'Superposition',
    description: 'Hold multiple contradictory values',
    eoDecomposition: [Op.SUP],
    eoExplanation: 'SUP(create) - Creates superposition of values',
    args: [
      { name: 'values', type: ArgType.ARRAY, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (...values) => ({ _type: 'superposition', states: values.map(v => ({ value: v })) }),
    toPipeline: () => [
      { operator: Op.SUP, params: { mode: 'CREATE' } },
    ],
  });

  register('COLLAPSE', {
    category: 'Superposition',
    description: 'Collapse superposition using strategy',
    eoDecomposition: [Op.SUP, Op.SYN],
    eoExplanation: 'SUP(resolve) → SYN(mode) - Resolves superposition to single value',
    args: [
      { name: 'supValue', type: ArgType.ANY, required: true },
      { name: 'strategy', type: ArgType.TEXT, required: true, options: ['first', 'last', 'max', 'min', 'random', 'weighted', 'expected', 'majority', 'median'] },
    ],
    returns: ArgType.ANY,
    implementation: (supValue, strategy) => {
      if (!supValue?._type === 'superposition') return supValue;
      const values = supValue.states?.map(s => s.value) || [];
      if (!values.length) return null;
      switch (strategy) {
        case 'first': return values[0];
        case 'last': return values[values.length - 1];
        case 'max': return Math.max(...values.filter(v => typeof v === 'number'));
        case 'min': return Math.min(...values.filter(v => typeof v === 'number'));
        case 'random': return values[Math.floor(Math.random() * values.length)];
        default: return values[0];
      }
    },
    toPipeline: (args) => [
      { operator: Op.SYN, params: { mode: args?.strategy } },
    ],
  });

  register('IS_SUPERPOSED', {
    category: 'Superposition',
    description: 'Check if value is a superposition',
    eoDecomposition: [Op.SUP, Op.DES],
    eoExplanation: 'SUP(detect) → DES(isSuperposed) - Detects superposition state',
    args: [
      { name: 'value', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.BOOLEAN,
    implementation: (value) => value?._type === 'superposition',
    toPipeline: () => [
      { operator: Op.SUP, params: { mode: 'DETECT' } },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // AV-INSPIRED SEMANTIC FORMULAS
  // Meaning-aware operations: scope, assumptions, equivalence, convergence
  // Based on Advaita Vedānta epistemic patterns
  // ═══════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────────
  // NETI-NETI PATTERN: Truth by elimination
  // "Not this, not this" - define validity by what disqualifies
  // ─────────────────────────────────────────────────────────────────

  register('EXCEPT', {
    category: 'Semantic',
    description: 'Start with a value, subtract violations (Neti-Neti pattern)',
    eoDecomposition: [Op.NUL, Op.SEG, Op.ALT],
    eoExplanation: 'NUL(detect) → SEG(violations) → ALT(subtract) - Truth by elimination',
    avOrigin: 'Neti-Neti (not this, not this)',
    args: [
      { name: 'baseValue', type: ArgType.ANY, required: true, description: 'Value if no violations' },
      { name: 'violations', type: ArgType.ARRAY, required: true, description: 'Array of UNLESS() conditions' },
    ],
    returns: ArgType.ANY,
    implementation: (baseValue, ...violations) => {
      const violationResults = violations.flat();
      const failed = violationResults.filter(v => v && v.failed);
      if (failed.length === 0) {
        return { value: baseValue, reasons: [], valid: true };
      }
      return {
        value: null,
        reasons: failed.map(v => v.reason),
        valid: false,
        eliminatedBy: 'EXCEPT'
      };
    },
    toPipeline: (args) => [
      { operator: Op.NUL, params: { mode: 'DETECT_VIOLATIONS', violations: args?.violations } },
      { operator: Op.SEG, params: { mode: 'FILTER_FAILURES' } },
      { operator: Op.ALT, params: { mode: 'SUBTRACT_FROM_BASE', base: args?.baseValue } },
    ],
    examples: [
      'EXCEPT("Valid", UNLESS({HasLicense}, "No license"), UNLESS({Insured}, "Not insured"))',
      'EXCEPT("Approved", UNLESS({CreditScore} > 600, "Low credit"), UNLESS({Income} > 30000, "Insufficient income"))',
    ],
  });

  register('UNLESS', {
    category: 'Semantic',
    description: 'Define a violation condition for EXCEPT (true = pass, false = fail)',
    eoDecomposition: [Op.SEG, Op.NUL],
    eoExplanation: 'SEG(test condition) → NUL(mark violation) - Elimination clause',
    avOrigin: 'Neti-Neti component',
    args: [
      { name: 'condition', type: ArgType.BOOLEAN, required: true, description: 'Condition that must be true' },
      { name: 'reason', type: ArgType.TEXT, required: true, description: 'Reason if condition fails' },
    ],
    returns: ArgType.ANY,
    implementation: (condition, reason) => ({
      failed: !condition,
      reason: reason,
      _type: 'unless_clause'
    }),
    toPipeline: (args) => [
      { operator: Op.SEG, params: { condition: args?.condition } },
      { operator: Op.NUL, params: { mode: 'MARK_VIOLATION', reason: args?.reason } },
    ],
    examples: [
      'UNLESS({HasLicense}, "Missing license")',
      'UNLESS({Age} >= 18, "Must be 18 or older")',
    ],
  });

  // ─────────────────────────────────────────────────────────────────
  // PROVISIONAL TRUTH: Scoped validity
  // Values that are only true within specific contexts
  // ─────────────────────────────────────────────────────────────────

  register('VALID_WHEN', {
    category: 'Semantic',
    description: 'Attach scope to a value - value is only valid within scope',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(attach scope) - Provisional truth within context',
    avOrigin: 'Vyāvahārika satya (practical/contextual truth)',
    args: [
      { name: 'value', type: ArgType.ANY, required: true, description: 'The value to scope' },
      { name: 'scopeCondition', type: ArgType.BOOLEAN, required: true, description: 'Condition defining valid scope' },
      { name: 'scopeDescription', type: ArgType.TEXT, required: false, description: 'Human-readable scope description' },
    ],
    returns: ArgType.ANY,
    implementation: (value, scopeCondition, scopeDescription) => ({
      value: value,
      scope: scopeCondition,
      scopeDescription: scopeDescription || String(scopeCondition),
      portable: false,
      _type: 'scoped_value'
    }),
    toPipeline: (args) => [
      { operator: Op.DES, params: { mode: 'ATTACH_SCOPE', scope: args?.scopeCondition } },
    ],
    examples: [
      'VALID_WHEN({Revenue}, {Region} = "US", "US region only")',
      'VALID_WHEN(SUM(#Orders.Total), {FiscalYear} = 2024, "FY2024")',
    ],
  });

  register('ASSUMING', {
    category: 'Semantic',
    description: 'Attach explicit assumptions to a computed value',
    eoDecomposition: [Op.DES, Op.SUP],
    eoExplanation: 'DES(attach assumptions) - Makes hidden assumptions visible',
    avOrigin: 'Adhyāsa awareness (superimposition audit)',
    args: [
      { name: 'value', type: ArgType.ANY, required: true, description: 'The computed value' },
      { name: 'assumptions', type: ArgType.ARRAY, required: true, description: 'List of assumption strings' },
    ],
    returns: ArgType.ANY,
    implementation: (value, ...assumptions) => ({
      value: value,
      assumptions: assumptions.flat(),
      assumptionCount: assumptions.flat().length,
      _type: 'assumed_value'
    }),
    toPipeline: (args) => [
      { operator: Op.DES, params: { mode: 'ATTACH_ASSUMPTIONS', assumptions: args?.assumptions } },
    ],
    examples: [
      'ASSUMING({Price} * {Qty}, "Currency is USD", "Price includes tax")',
      'ASSUMING({ExchangeRate} * {Amount}, "Spot rate as of today", "No fees applied")',
    ],
  });

  register('SCOPE_COMPATIBLE', {
    category: 'Semantic',
    description: 'Check if a scoped value can be used in current context',
    eoDecomposition: [Op.SEG, Op.DES],
    eoExplanation: 'SEG(compare scopes) → DES(compatibility result)',
    avOrigin: 'Context compatibility check',
    args: [
      { name: 'scopedValue', type: ArgType.ANY, required: true, description: 'A value created with VALID_WHEN' },
      { name: 'targetContext', type: ArgType.ANY, required: true, description: 'Context to check compatibility against' },
    ],
    returns: ArgType.BOOLEAN,
    implementation: (scopedValue, targetContext) => {
      // No scope = universal compatibility
      if (!scopedValue || scopedValue._type !== 'scoped_value') return true;
      if (!scopedValue.scope) return true;

      // If scope is a boolean, return it directly
      if (typeof scopedValue.scope === 'boolean') return scopedValue.scope;

      // Otherwise, compare context objects if possible
      if (typeof targetContext === 'object' && typeof scopedValue.scope === 'object') {
        // Check if all scope requirements are met in target context
        for (const [key, value] of Object.entries(scopedValue.scope)) {
          if (targetContext[key] !== value) return false;
        }
        return true;
      }

      return scopedValue.scope === targetContext;
    },
    toPipeline: (args) => [
      { operator: Op.SEG, params: { mode: 'COMPARE_SCOPES' } },
    ],
    examples: [
      'IF(SCOPE_COMPATIBLE({ScopedRevenue}, {CurrentContext}), {ScopedRevenue}, BLANK())',
    ],
  });

  // ─────────────────────────────────────────────────────────────────
  // PARTIAL IDENTITY: Purpose-bound equivalence
  // Things can be "the same" for some purposes but not others
  // ─────────────────────────────────────────────────────────────────

  register('EQUIVALENT_WHEN', {
    category: 'Semantic',
    description: 'Test equivalence under projection (purpose-bound identity)',
    eoDecomposition: [Op.CON, Op.SEG, Op.ALT],
    eoExplanation: 'CON(both values) → SEG(project retained fields) → ALT(compare)',
    avOrigin: 'Jahadajahallakṣaṇā (partial identity)',
    args: [
      { name: 'valueA', type: ArgType.ANY, required: true, description: 'First value to compare' },
      { name: 'valueB', type: ArgType.ANY, required: true, description: 'Second value to compare' },
      { name: 'retaining', type: ArgType.ARRAY, required: true, description: 'Fields to use for comparison' },
      { name: 'ignoring', type: ArgType.ARRAY, required: false, description: 'Fields to explicitly ignore' },
    ],
    returns: ArgType.ANY,
    implementation: (valueA, valueB, retaining, ignoring = []) => {
      // Handle simple values
      if (typeof valueA !== 'object' || typeof valueB !== 'object') {
        const equivalent = valueA === valueB;
        return { equivalent, forPurpose: 'direct_comparison', _type: 'equivalence_result' };
      }

      // Project to retained fields
      const projectFields = (obj, fields) => {
        if (!obj || !fields) return obj;
        const result = {};
        for (const field of fields) {
          if (obj.hasOwnProperty(field)) {
            result[field] = obj[field];
          }
        }
        return result;
      };

      // Find differences in ignored fields
      const findIgnoredDifferences = (objA, objB, ignored) => {
        const diffs = [];
        for (const field of ignored) {
          if (objA?.[field] !== objB?.[field]) {
            diffs.push(`${field}: ${objA?.[field]} vs ${objB?.[field]}`);
          }
        }
        return diffs;
      };

      const projA = projectFields(valueA, retaining);
      const projB = projectFields(valueB, retaining);

      // Deep equality check
      const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const equivalent = deepEqual(projA, projB);

      return {
        equivalent,
        forPurpose: retaining.join('+'),
        ignoredDifferences: findIgnoredDifferences(valueA, valueB, ignoring || []),
        retainedFields: retaining,
        projectedA: projA,
        projectedB: projB,
        _type: 'equivalence_result'
      };
    },
    toPipeline: (args) => [
      { operator: Op.SEG, params: { mode: 'PROJECT', fields: args?.retaining } },
      { operator: Op.ALT, params: { mode: 'COMPARE_PROJECTED' } },
    ],
    examples: [
      'EQUIVALENT_WHEN({CustomerA}, {CustomerB}, ["TaxID", "Name"], ["SourceSystem"])',
      'EQUIVALENT_WHEN({RecordA}, {RecordB}, ["Email", "Phone"])',
    ],
  });

  // ─────────────────────────────────────────────────────────────────
  // SELF-CORRECTING: Explicit assumptions with fragility assessment
  // Values that know their own weakness
  // ─────────────────────────────────────────────────────────────────

  register('WITH_ASSUMPTIONS', {
    category: 'Semantic',
    description: 'Compute value with explicit queryable assumptions',
    eoDecomposition: [Op.ALT, Op.DES, Op.SUP],
    eoExplanation: 'ALT(compute) → DES(attach assumptions) → SUP(if fragile, hold as uncertain)',
    avOrigin: 'Adhyāsa (superimposition) awareness',
    args: [
      { name: 'value', type: ArgType.ANY, required: true, description: 'The computed value' },
      { name: 'assumptions', type: ArgType.ARRAY, required: true, description: 'List of assumption strings' },
    ],
    returns: ArgType.ANY,
    implementation: (value, ...assumptions) => ({
      value: value,
      assumptions: assumptions.flat(),
      assumptionCount: assumptions.flat().length,
      queryable: true,
      _type: 'self_aware_value'
    }),
    toPipeline: (args) => [
      { operator: Op.ALT, params: { mode: 'COMPUTE' } },
      { operator: Op.DES, params: { mode: 'ATTACH_ASSUMPTIONS', assumptions: args?.assumptions } },
    ],
    examples: [
      'WITH_ASSUMPTIONS({Price} * {Quantity} * {ExchangeRate}, "IDs are globally unique", "Currency converts at spot rate")',
    ],
  });

  register('FRAGILITY', {
    category: 'Semantic',
    description: 'Assess fragility/confidence of a computed value',
    eoDecomposition: [Op.SEG, Op.DES],
    eoExplanation: 'SEG(check conditions) → DES(attach fragility score)',
    avOrigin: 'Adhyāsa (superimposition) awareness',
    args: [
      { name: 'value', type: ArgType.ANY, required: true, description: 'Value to assess' },
      { name: 'conditions', type: ArgType.ARRAY, required: true, description: 'Fragility conditions as {level, condition, reason}' },
    ],
    returns: ArgType.ANY,
    implementation: (value, ...conditions) => {
      const allConditions = conditions.flat();
      const triggered = allConditions.filter(c => c && c.triggered);

      const fragilityLevels = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
      const fragilityLabels = ['STABLE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

      const maxLevel = triggered.reduce((max, c) => {
        const level = fragilityLevels[c.level?.toUpperCase()] || 0;
        return Math.max(max, level);
      }, 0);

      return {
        value: value,
        fragility: fragilityLabels[maxLevel] || 'STABLE',
        fragilityLevel: maxLevel,
        fragilityReasons: triggered.map(c => c.reason),
        conditionsChecked: allConditions.length,
        _type: 'fragile_value'
      };
    },
    toPipeline: (args) => [
      { operator: Op.SEG, params: { mode: 'CHECK_FRAGILITY', conditions: args?.conditions } },
      { operator: Op.DES, params: { mode: 'ATTACH_FRAGILITY' } },
    ],
    examples: [
      'FRAGILITY({DerivedValue}, HIGH_IF({DataAge} > 24, "Data is stale"), MEDIUM_IF({Confidence} < 0.8, "Low confidence"))',
    ],
  });

  register('HIGH_IF', {
    category: 'Semantic',
    description: 'Create a HIGH fragility condition',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(condition) - Fragility check',
    avOrigin: 'Fragility assessment component',
    args: [
      { name: 'condition', type: ArgType.BOOLEAN, required: true },
      { name: 'reason', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (condition, reason) => ({
      level: 'HIGH',
      triggered: !!condition,
      reason: reason,
      _type: 'fragility_condition'
    }),
    toPipeline: () => [
      { operator: Op.SEG, params: { mode: 'FRAGILITY_CHECK', level: 'HIGH' } },
    ],
  });

  register('MEDIUM_IF', {
    category: 'Semantic',
    description: 'Create a MEDIUM fragility condition',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(condition) - Fragility check',
    avOrigin: 'Fragility assessment component',
    args: [
      { name: 'condition', type: ArgType.BOOLEAN, required: true },
      { name: 'reason', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (condition, reason) => ({
      level: 'MEDIUM',
      triggered: !!condition,
      reason: reason,
      _type: 'fragility_condition'
    }),
    toPipeline: () => [
      { operator: Op.SEG, params: { mode: 'FRAGILITY_CHECK', level: 'MEDIUM' } },
    ],
  });

  register('LOW_IF', {
    category: 'Semantic',
    description: 'Create a LOW fragility condition',
    eoDecomposition: [Op.SEG],
    eoExplanation: 'SEG(condition) - Fragility check',
    avOrigin: 'Fragility assessment component',
    args: [
      { name: 'condition', type: ArgType.BOOLEAN, required: true },
      { name: 'reason', type: ArgType.TEXT, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (condition, reason) => ({
      level: 'LOW',
      triggered: !!condition,
      reason: reason,
      _type: 'fragility_condition'
    }),
    toPipeline: () => [
      { operator: Op.SEG, params: { mode: 'FRAGILITY_CHECK', level: 'LOW' } },
    ],
  });

  // ─────────────────────────────────────────────────────────────────
  // NON-ASSERTIVE: Values for observation only
  // Cannot drive decisions or automations
  // ─────────────────────────────────────────────────────────────────

  register('DIAGNOSTIC', {
    category: 'Semantic',
    description: 'Mark a value as non-assertive (cannot drive decisions)',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(mark non-assertive) - Value for observation only',
    avOrigin: 'Illuminative but non-binding cognition',
    args: [
      { name: 'value', type: ArgType.ANY, required: true, description: 'The diagnostic value' },
      { name: 'reason', type: ArgType.TEXT, required: false, description: 'Why this is diagnostic-only' },
    ],
    returns: ArgType.ANY,
    implementation: (value, reason) => ({
      value: value,
      _diagnostic: true,
      _nonAssertive: true,
      reason: reason || 'For investigation only',
      _type: 'diagnostic_value'
    }),
    toPipeline: () => [
      { operator: Op.DES, params: { mode: 'MARK_DIAGNOSTIC' } },
    ],
    examples: [
      'DIAGNOSTIC(COMPARE(#SystemA.Balance, #SystemB.Balance), "For investigation only")',
      'DIAGNOSTIC({SuspiciousFlag}, "Requires human review")',
    ],
  });

  register('IS_DIAGNOSTIC', {
    category: 'Semantic',
    description: 'Check if a value is marked as diagnostic/non-assertive',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(check diagnostic flag)',
    avOrigin: 'Non-assertive detection',
    args: [
      { name: 'value', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.BOOLEAN,
    implementation: (value) => !!(value && value._diagnostic),
    toPipeline: () => [
      { operator: Op.DES, params: { mode: 'CHECK_DIAGNOSTIC' } },
    ],
  });

  // ─────────────────────────────────────────────────────────────────
  // RECURSIVE STABILIZATION: Convergent refinement
  // Iteratively refine until stable (fixed point)
  // ─────────────────────────────────────────────────────────────────

  register('REFINE_UNTIL', {
    category: 'Semantic',
    description: 'Iteratively refine a value until stable',
    eoDecomposition: [Op.REC, Op.SEG, Op.SYN],
    eoExplanation: 'REC(iterate) until fixed point - Convergent truth',
    avOrigin: 'Truth via repeated correction',
    args: [
      { name: 'initial', type: ArgType.ANY, required: true, description: 'Starting value' },
      { name: 'refineFn', type: ArgType.LAMBDA, required: true, description: 'Function to apply each iteration' },
      { name: 'stableCondition', type: ArgType.TEXT, required: false, default: 'NO_CHANGE', options: ['NO_CHANGE', 'STABLE', 'CONVERGED'] },
      { name: 'maxIterations', type: ArgType.NUMBER, required: false, default: 10 },
    ],
    returns: ArgType.ANY,
    implementation: (initial, refineFn, stableCondition = 'NO_CHANGE', maxIterations = 10) => {
      let current = initial;
      let iterations = 0;
      const changes = [];
      const maxIter = Math.min(Number(maxIterations) || 10, 100); // Cap at 100 for safety

      while (iterations < maxIter) {
        let next;
        try {
          next = typeof refineFn === 'function' ? refineFn(current) : current;
        } catch (e) {
          return {
            value: current,
            iterations: iterations,
            stable: false,
            error: e.message,
            changesPerIteration: changes,
            _type: 'refined_value'
          };
        }

        // Count changes (simple comparison)
        const changed = JSON.stringify(current) !== JSON.stringify(next);
        changes.push(changed ? 1 : 0);

        if (!changed) {
          return {
            value: next,
            iterations: iterations + 1,
            stable: true,
            converged: true,
            changesPerIteration: changes,
            _type: 'refined_value'
          };
        }

        current = next;
        iterations++;
      }

      return {
        value: current,
        iterations: maxIter,
        stable: false,
        converged: false,
        changesPerIteration: changes,
        warning: 'Max iterations reached without convergence',
        _type: 'refined_value'
      };
    },
    toPipeline: (args) => [
      { operator: Op.REC, params: {
        mode: 'REFINE',
        until: args?.stableCondition,
        maxIterations: args?.maxIterations,
      }},
    ],
    examples: [
      'REFINE_UNTIL({RawData}, $.normalize(), "STABLE", 5)',
    ],
  });

  // ─────────────────────────────────────────────────────────────────
  // SEMANTIC HELPERS
  // ─────────────────────────────────────────────────────────────────

  register('GET_ASSUMPTIONS', {
    category: 'Semantic',
    description: 'Extract assumptions from an assumed value',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:assumptions) - Retrieve attached assumptions',
    avOrigin: 'Assumption introspection',
    args: [
      { name: 'assumedValue', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.ARRAY,
    implementation: (assumedValue) => {
      if (!assumedValue) return [];
      return assumedValue.assumptions || [];
    },
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'assumptions' } },
    ],
  });

  register('GET_SCOPE', {
    category: 'Semantic',
    description: 'Extract scope from a scoped value',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:scope) - Retrieve attached scope',
    avOrigin: 'Scope introspection',
    args: [
      { name: 'scopedValue', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (scopedValue) => {
      if (!scopedValue) return null;
      return {
        scope: scopedValue.scope,
        description: scopedValue.scopeDescription,
        portable: scopedValue.portable
      };
    },
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'scope' } },
    ],
  });

  register('GET_FRAGILITY', {
    category: 'Semantic',
    description: 'Extract fragility assessment from a value',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:fragility) - Retrieve fragility info',
    avOrigin: 'Fragility introspection',
    args: [
      { name: 'fragileValue', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (fragileValue) => {
      if (!fragileValue) return { fragility: 'UNKNOWN' };
      return {
        fragility: fragileValue.fragility || 'STABLE',
        level: fragileValue.fragilityLevel || 0,
        reasons: fragileValue.fragilityReasons || []
      };
    },
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'fragility' } },
    ],
  });

  register('UNWRAP', {
    category: 'Semantic',
    description: 'Extract the raw value from any semantic wrapper',
    eoDecomposition: [Op.DES],
    eoExplanation: 'DES(property:value) - Extract unwrapped value',
    avOrigin: 'Value extraction',
    args: [
      { name: 'wrappedValue', type: ArgType.ANY, required: true },
    ],
    returns: ArgType.ANY,
    implementation: (wrappedValue) => {
      if (!wrappedValue) return wrappedValue;
      if (typeof wrappedValue !== 'object') return wrappedValue;
      if ('value' in wrappedValue) return wrappedValue.value;
      return wrappedValue;
    },
    toPipeline: () => [
      { operator: Op.DES, params: { property: 'value' } },
    ],
    examples: [
      'UNWRAP(ASSUMING({Price}, "USD"))',
      'UNWRAP(VALID_WHEN({Revenue}, {Region} = "US"))',
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  return {
    Op,
    ArgType,
    functions,

    /**
     * Get a function definition
     */
    get(name) {
      return functions[name?.toUpperCase()];
    },

    /**
     * Check if function exists
     */
    has(name) {
      return name?.toUpperCase() in functions;
    },

    /**
     * Execute a function
     */
    execute(name, args) {
      const fn = functions[name?.toUpperCase()];
      if (!fn) throw new Error(`Unknown function: ${name}`);
      return fn.implementation(...(Array.isArray(args) ? args : [args]));
    },

    /**
     * Get pipeline for a function
     */
    getPipeline(name, args) {
      const fn = functions[name?.toUpperCase()];
      if (!fn) throw new Error(`Unknown function: ${name}`);
      return fn.toPipeline(args);
    },

    /**
     * Get all functions by category
     */
    getByCategory() {
      const categories = {};
      for (const [name, fn] of Object.entries(functions)) {
        if (!categories[fn.category]) categories[fn.category] = [];
        categories[fn.category].push(fn);
      }
      return categories;
    },

    /**
     * Get all functions that use a specific operator
     */
    getByOperator(operator) {
      return Object.values(functions).filter(fn =>
        fn.eoDecomposition.includes(operator)
      );
    },

    /**
     * Get function library for UI display
     */
    getLibraryForUI() {
      return Object.values(functions).map(fn => ({
        name: fn.name,
        category: fn.category,
        description: fn.description,
        args: fn.args,
        returns: fn.returns,
        eoOperators: fn.eoDecomposition,
        eoExplanation: fn.eoExplanation,
        examples: fn.examples || [],
      }));
    },

    /**
     * Get function names grouped by EO operator
     */
    getByEOOperator() {
      const byOp = {};
      for (const op of Object.values(Op)) {
        byOp[op] = Object.values(functions)
          .filter(fn => fn.eoDecomposition.includes(op))
          .map(fn => fn.name);
      }
      return byOp;
    },

    /**
     * Register a custom function
     */
    register,
  };

})();

// ============================================================================
// Register Semantic Functions (AV-Inspired)
// ============================================================================

// Register semantic functions if available
// These are loaded from eo_formula_semantic.js
(function registerSemanticFunctions() {
  if (typeof window !== 'undefined' && window.EOSemanticFormulas) {
    const semantic = window.EOSemanticFormulas;

    // Register each semantic function definition
    if (semantic.definitions && Array.isArray(semantic.definitions)) {
      semantic.definitions.forEach(def => {
        if (def.name && def.implementation) {
          window.EOFormulaFunctions.register(def.name, {
            category: def.category || 'Semantic',
            description: def.description || '',
            args: def.args || [],
            returns: def.returns || 'any',
            eoDecomposition: def.eoDecomposition || [],
            eoExplanation: def.eoExplanation || '',
            avOrigin: def.avOrigin,
            examples: def.examples || [],
            implementation: def.implementation,
          });
        }
      });
      console.log(`Registered ${semantic.definitions.length} semantic functions`);
    }
  }
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.EOFormulaFunctions;
}
