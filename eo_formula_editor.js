/**
 * EO Formula Editor - Formula Creation and Editing Module
 *
 * Provides a comprehensive formula editor for creating and editing
 * formula fields with syntax help, field references, and function browser.
 */

// ============================================================================
// EOFormulaEditor - Formula Editor Modal
// ============================================================================

class EOFormulaEditor {
  constructor(workbench) {
    this.workbench = workbench;
    this.modal = null;
    this.field = null; // Existing field when editing
    this.onSave = null;
    this.onCancel = null;

    // Formula function categories from the specification
    this.functionCategories = {
      text: {
        name: 'Text',
        icon: 'ph-text-aa',
        functions: [
          { name: 'CONCATENATE', syntax: 'CONCATENATE(text1, [text2, ...])', description: 'Joins text values into one string' },
          { name: 'LEFT', syntax: 'LEFT(string, howMany)', description: 'Extract characters from the beginning' },
          { name: 'RIGHT', syntax: 'RIGHT(string, howMany)', description: 'Extract characters from the end' },
          { name: 'MID', syntax: 'MID(string, start, count)', description: 'Extract a substring' },
          { name: 'LEN', syntax: 'LEN(string)', description: 'Returns string length' },
          { name: 'LOWER', syntax: 'LOWER(string)', description: 'Convert to lowercase' },
          { name: 'UPPER', syntax: 'UPPER(string)', description: 'Convert to uppercase' },
          { name: 'TRIM', syntax: 'TRIM(string)', description: 'Remove leading/trailing whitespace' },
          { name: 'SUBSTITUTE', syntax: 'SUBSTITUTE(string, old, new, [index])', description: 'Replace text occurrences' },
          { name: 'REPLACE', syntax: 'REPLACE(string, start, count, replacement)', description: 'Replace at position' },
          { name: 'FIND', syntax: 'FIND(search, text, [start])', description: 'Find position of text' },
          { name: 'SEARCH', syntax: 'SEARCH(search, text, [start])', description: 'Find position (case-insensitive)' },
          { name: 'REPT', syntax: 'REPT(string, number)', description: 'Repeat string N times' },
          { name: 'T', syntax: 'T(value)', description: 'Returns text if value is text' },
          { name: 'ARRAYJOIN', syntax: 'ARRAYJOIN(array, separator)', description: 'Join array into string' },
          { name: 'ENCODE_URL_COMPONENT', syntax: 'ENCODE_URL_COMPONENT(string)', description: 'URL-encode a string' }
        ]
      },
      numeric: {
        name: 'Numeric',
        icon: 'ph-hash',
        functions: [
          { name: 'SUM', syntax: 'SUM(number1, [number2, ...])', description: 'Sum of numbers' },
          { name: 'AVERAGE', syntax: 'AVERAGE(number1, [number2, ...])', description: 'Average of numbers' },
          { name: 'MAX', syntax: 'MAX(number1, [number2, ...])', description: 'Maximum value' },
          { name: 'MIN', syntax: 'MIN(number1, [number2, ...])', description: 'Minimum value' },
          { name: 'COUNT', syntax: 'COUNT(value1, [value2, ...])', description: 'Count numeric values' },
          { name: 'COUNTA', syntax: 'COUNTA(value1, [value2, ...])', description: 'Count non-empty values' },
          { name: 'COUNTALL', syntax: 'COUNTALL(value1, [value2, ...])', description: 'Count all values' },
          { name: 'ABS', syntax: 'ABS(number)', description: 'Absolute value' },
          { name: 'ROUND', syntax: 'ROUND(number, precision)', description: 'Round to precision' },
          { name: 'ROUNDUP', syntax: 'ROUNDUP(number, precision)', description: 'Round up to precision' },
          { name: 'ROUNDDOWN', syntax: 'ROUNDDOWN(number, precision)', description: 'Round down to precision' },
          { name: 'CEILING', syntax: 'CEILING(number, [significance])', description: 'Round up to significance' },
          { name: 'FLOOR', syntax: 'FLOOR(number, [significance])', description: 'Round down to significance' },
          { name: 'INT', syntax: 'INT(number)', description: 'Integer part of number' },
          { name: 'MOD', syntax: 'MOD(number, divisor)', description: 'Remainder after division' },
          { name: 'POWER', syntax: 'POWER(base, exponent)', description: 'Raise to power' },
          { name: 'SQRT', syntax: 'SQRT(number)', description: 'Square root' },
          { name: 'EXP', syntax: 'EXP(power)', description: 'e raised to power' },
          { name: 'LOG', syntax: 'LOG(number, [base])', description: 'Logarithm' },
          { name: 'VALUE', syntax: 'VALUE(text)', description: 'Convert text to number' },
          { name: 'EVEN', syntax: 'EVEN(number)', description: 'Round to next even' },
          { name: 'ODD', syntax: 'ODD(number)', description: 'Round to next odd' }
        ]
      },
      logical: {
        name: 'Logical',
        icon: 'ph-git-branch',
        functions: [
          { name: 'IF', syntax: 'IF(condition, value_if_true, value_if_false)', description: 'Conditional logic' },
          { name: 'SWITCH', syntax: 'SWITCH(expr, [pattern, result]..., [default])', description: 'Match patterns' },
          { name: 'AND', syntax: 'AND(logical1, [logical2, ...])', description: 'True if all true' },
          { name: 'OR', syntax: 'OR(logical1, [logical2, ...])', description: 'True if any true' },
          { name: 'NOT', syntax: 'NOT(logical)', description: 'Reverse logical value' },
          { name: 'XOR', syntax: 'XOR(logical1, [logical2, ...])', description: 'Exclusive or' },
          { name: 'TRUE', syntax: 'TRUE()', description: 'Returns true' },
          { name: 'FALSE', syntax: 'FALSE()', description: 'Returns false' },
          { name: 'BLANK', syntax: 'BLANK()', description: 'Returns blank value' },
          { name: 'ERROR', syntax: 'ERROR()', description: 'Returns error value' },
          { name: 'ISERROR', syntax: 'ISERROR(expression)', description: 'Check if expression errors' }
        ]
      },
      date: {
        name: 'Date & Time',
        icon: 'ph-calendar',
        functions: [
          { name: 'NOW', syntax: 'NOW()', description: 'Current date and time' },
          { name: 'TODAY', syntax: 'TODAY()', description: 'Current date' },
          { name: 'YEAR', syntax: 'YEAR(date)', description: 'Extract year' },
          { name: 'MONTH', syntax: 'MONTH(date)', description: 'Extract month (1-12)' },
          { name: 'DAY', syntax: 'DAY(date)', description: 'Extract day (1-31)' },
          { name: 'HOUR', syntax: 'HOUR(datetime)', description: 'Extract hour (0-23)' },
          { name: 'MINUTE', syntax: 'MINUTE(datetime)', description: 'Extract minute (0-59)' },
          { name: 'SECOND', syntax: 'SECOND(datetime)', description: 'Extract second (0-59)' },
          { name: 'WEEKDAY', syntax: 'WEEKDAY(date, [startDay])', description: 'Day of week (0-6)' },
          { name: 'WEEKNUM', syntax: 'WEEKNUM(date, [startDay])', description: 'Week number in year' },
          { name: 'DATEADD', syntax: 'DATEADD(date, count, unit)', description: 'Add to date' },
          { name: 'DATETIME_DIFF', syntax: 'DATETIME_DIFF(date1, date2, [unit])', description: 'Difference between dates' },
          { name: 'DATETIME_FORMAT', syntax: 'DATETIME_FORMAT(date, [format])', description: 'Format date as string' },
          { name: 'DATETIME_PARSE', syntax: 'DATETIME_PARSE(string, [format])', description: 'Parse string to date' },
          { name: 'DATESTR', syntax: 'DATESTR(date)', description: 'Date as YYYY-MM-DD' },
          { name: 'TIMESTR', syntax: 'TIMESTR(datetime)', description: 'Time as HH:MM:SS' },
          { name: 'TONOW', syntax: 'TONOW(date)', description: 'Days from date to now' },
          { name: 'WORKDAY', syntax: 'WORKDAY(start, numDays, [holidays])', description: 'Add working days' },
          { name: 'WORKDAY_DIFF', syntax: 'WORKDAY_DIFF(start, end, [holidays])', description: 'Count working days' },
          { name: 'IS_BEFORE', syntax: 'IS_BEFORE(date1, date2)', description: 'Check if date1 < date2' },
          { name: 'IS_AFTER', syntax: 'IS_AFTER(date1, date2)', description: 'Check if date1 > date2' },
          { name: 'IS_SAME', syntax: 'IS_SAME(date1, date2, [unit])', description: 'Check if dates equal' },
          { name: 'CREATED_TIME', syntax: 'CREATED_TIME()', description: 'Record creation time' },
          { name: 'LAST_MODIFIED_TIME', syntax: 'LAST_MODIFIED_TIME([field])', description: 'Last modification time' },
          { name: 'SET_LOCALE', syntax: 'SET_LOCALE(date, locale)', description: 'Set date locale' },
          { name: 'SET_TIMEZONE', syntax: 'SET_TIMEZONE(date, timezone)', description: 'Set date timezone' }
        ]
      },
      array: {
        name: 'Array',
        icon: 'ph-list-bullets',
        functions: [
          { name: 'ARRAYCOMPACT', syntax: 'ARRAYCOMPACT(array)', description: 'Remove empty values' },
          { name: 'ARRAYFLATTEN', syntax: 'ARRAYFLATTEN(array)', description: 'Flatten nested arrays' },
          { name: 'ARRAYUNIQUE', syntax: 'ARRAYUNIQUE(array)', description: 'Remove duplicates' },
          { name: 'ARRAYSLICE', syntax: 'ARRAYSLICE(array, start, [end])', description: 'Extract array subset' }
        ]
      },
      regex: {
        name: 'Regex',
        icon: 'ph-magnifying-glass',
        functions: [
          { name: 'REGEX_MATCH', syntax: 'REGEX_MATCH(text, regex)', description: 'Check if text matches pattern' },
          { name: 'REGEX_EXTRACT', syntax: 'REGEX_EXTRACT(text, regex)', description: 'Extract first match' },
          { name: 'REGEX_REPLACE', syntax: 'REGEX_REPLACE(text, regex, replacement)', description: 'Replace matches' }
        ]
      },
      record: {
        name: 'Record',
        icon: 'ph-rows',
        functions: [
          { name: 'RECORD_ID', syntax: 'RECORD_ID()', description: 'Current record ID' }
        ]
      },
      superposition: {
        name: 'Superposition',
        icon: 'ph-git-fork',
        functions: [
          // Creation (4)
          { name: 'SUPERPOSE', syntax: 'SUPERPOSE(value1, value2, [...])', description: 'Hold multiple values without resolution' },
          { name: 'SUPERPOSE_IF', syntax: 'SUPERPOSE_IF(value1, value2, [...])', description: 'Superpose only if values differ' },
          { name: 'WEIGHTED', syntax: 'WEIGHTED(value1, weight1, [...])', description: 'Superposition with probabilities' },
          { name: 'SOURCED', syntax: 'SOURCED(value1, source1, [...])', description: 'Superposition with source attribution' },
          // Inspection (8)
          { name: 'IS_SUPERPOSED', syntax: 'IS_SUPERPOSED(value)', description: 'Check if value is superposed' },
          { name: 'COUNT_STATES', syntax: 'COUNT_STATES(superposition)', description: 'Count states in superposition' },
          { name: 'GET_STATES', syntax: 'GET_STATES(superposition)', description: 'Extract all values as array' },
          { name: 'GET_STATE', syntax: 'GET_STATE(superposition, index)', description: 'Get specific state by index' },
          { name: 'GET_WEIGHTS', syntax: 'GET_WEIGHTS(superposition)', description: 'Extract weights as array' },
          { name: 'GET_SOURCES', syntax: 'GET_SOURCES(superposition)', description: 'Extract sources as array' },
          { name: 'SPREAD', syntax: 'SPREAD(superposition)', description: 'Range of numeric superposition' },
          { name: 'EXPECTED', syntax: 'EXPECTED(superposition)', description: 'Weighted expected value' },
          // Collapse (4)
          { name: 'COLLAPSE', syntax: 'COLLAPSE(superposition, method)', description: 'Force resolution to single value' },
          { name: 'COLLAPSE_BY_SOURCE', syntax: 'COLLAPSE_BY_SOURCE(superposition, source)', description: 'Select value by source' },
          { name: 'COLLAPSE_IF', syntax: 'COLLAPSE_IF(superposition, condition, method)', description: 'Conditional collapse' },
          { name: 'COLLAPSE_WHEN_SINGLE', syntax: 'COLLAPSE_WHEN_SINGLE(superposition)', description: 'Collapse only if unanimous' },
          // Combination (3)
          { name: 'UNION_SUP', syntax: 'UNION_SUP(sup1, sup2, [...])', description: 'Combine keeping all unique states' },
          { name: 'INTERSECT_SUP', syntax: 'INTERSECT_SUP(sup1, sup2, [...])', description: 'Keep common states only' },
          { name: 'DIFF_SUP', syntax: 'DIFF_SUP(sup1, sup2)', description: 'States in first not in second' },
          // Propagation (3)
          { name: 'MAP_SUP', syntax: 'MAP_SUP(superposition, transform)', description: 'Apply function to each state' },
          { name: 'FILTER_SUP', syntax: 'FILTER_SUP(superposition, predicate)', description: 'Keep matching states' },
          { name: 'REDUCE_SUP', syntax: 'REDUCE_SUP(superposition, reducer, initial)', description: 'Reduce to single value' },
          // Display (2)
          { name: 'FORMAT_SUP', syntax: 'FORMAT_SUP(superposition, format)', description: 'Format for display' },
          { name: 'SUMMARIZE_SUP', syntax: 'SUMMARIZE_SUP(superposition)', description: 'Human-readable summary' }
        ]
      },
      eoOperators: {
        name: 'EO Operators',
        icon: 'ph-flow-arrow',
        functions: [
          // Pipeline Operators
          { name: '#Reference', syntax: '#NodeName', description: 'Reference another node/set in the graph' },
          { name: '#Filter', syntax: '#NodeName[field = "value"]', description: 'Filter referenced records by condition' },
          { name: '.Property', syntax: '#NodeName.PropertyName', description: 'Access a property from connected records' },
          { name: '.SUM()', syntax: '#NodeName.Property.SUM()', description: 'Sum values from connected records (SYN operator)' },
          { name: '.COUNT()', syntax: '#NodeName.COUNT()', description: 'Count connected records (SYN operator)' },
          { name: '.AVG()', syntax: '#NodeName.Property.AVG()', description: 'Average values from connected records (SYN operator)' },
          { name: '.MIN()', syntax: '#NodeName.Property.MIN()', description: 'Minimum value from connected records (SYN operator)' },
          { name: '.MAX()', syntax: '#NodeName.Property.MAX()', description: 'Maximum value from connected records (SYN operator)' },
          { name: '.FIRST()', syntax: '#NodeName.FIRST()', description: 'First connected record (SYN operator)' },
          { name: '.LAST()', syntax: '#NodeName.LAST()', description: 'Last connected record (SYN operator)' },
          { name: '.CONCAT()', syntax: '#NodeName.Property.CONCAT()', description: 'Concatenate values from connected records' },
          { name: '.COLLECT()', syntax: '#NodeName.Property.COLLECT()', description: 'Collect values as array' },
          // Examples
          { name: 'Rollup Example', syntax: '#Orders[Status = "Complete"].Total.SUM()', description: 'Sum of Total from completed Orders (like a Rollup)' },
          { name: 'Lookup Example', syntax: '#Customer.Name', description: 'Get Name from linked Customer (like a Lookup)' },
          { name: 'Chain Example', syntax: '#Orders.#Customer.AccountManager', description: 'Traverse multiple relationships' },
          { name: 'Arithmetic', syntax: '#Q4Revenue - #Q3Revenue', description: 'Compute difference between two nodes' }
        ]
      }
    };

    // Operators
    this.operators = [
      { symbol: '+', name: 'Addition', example: '1 + 2' },
      { symbol: '-', name: 'Subtraction', example: '5 - 3' },
      { symbol: '*', name: 'Multiplication', example: '4 * 2' },
      { symbol: '/', name: 'Division', example: '10 / 2' },
      { symbol: '&', name: 'Concatenation', example: '"Hello" & " " & "World"' },
      { symbol: '=', name: 'Equal', example: 'A = B' },
      { symbol: '!=', name: 'Not equal', example: 'A != B' },
      { symbol: '>', name: 'Greater than', example: 'A > B' },
      { symbol: '<', name: 'Less than', example: 'A < B' },
      { symbol: '>=', name: 'Greater or equal', example: 'A >= B' },
      { symbol: '<=', name: 'Less or equal', example: 'A <= B' }
    ];
  }

  /**
   * Show the formula editor for creating a new formula field
   */
  showCreate(onSave, onCancel) {
    this.field = null;
    this.onSave = onSave;
    this.onCancel = onCancel;
    this._showModal('Create Formula Field', false);
  }

  /**
   * Show the formula editor for editing an existing formula field
   */
  showEdit(field, onSave, onCancel) {
    this.field = field;
    this.onSave = onSave;
    this.onCancel = onCancel;
    this._showModal('Edit Formula Field', true);
  }

  /**
   * Internal method to show the modal
   */
  _showModal(title, isEdit) {
    // Destroy any existing modal immediately to prevent duplicate element IDs
    if (this.modal) {
      this.modal.destroy();
      this.modal = null;
    }

    const set = this.workbench.getCurrentSet();
    const fields = set?.fields || [];

    // Filter out the current formula field when editing
    const availableFields = isEdit
      ? fields.filter(f => f.id !== this.field?.id)
      : fields;

    this.modal = new EOModal({
      id: 'formula-editor-modal',
      title: title,
      size: 'large',
      content: this._renderContent(availableFields, isEdit),
      closable: true,
      onClose: () => {
        if (this.onCancel) this.onCancel();
      },
      buttons: [
        {
          label: 'Cancel',
          action: 'cancel',
          secondary: true,
          onClick: (e, modal) => {
            if (this.onCancel) this.onCancel();
            modal.hide();
          }
        },
        {
          label: isEdit ? 'Save Changes' : 'Create Field',
          icon: 'ph-check',
          action: 'save',
          primary: true,
          onClick: (e, modal) => {
            this._handleSave(modal);
          }
        }
      ]
    });

    this.modal.show();
    this._attachEventListeners();

    // Focus the name input (use modal element for scoped lookup)
    setTimeout(() => {
      const nameInput = this.modal?.element?.querySelector('#formula-field-name');
      if (nameInput) nameInput.focus();
    }, 100);
  }

  /**
   * Render the modal content
   */
  _renderContent(fields, isEdit) {
    const fieldName = this.field?.name || '';
    const formula = this.field?.options?.formula || '';
    const resultType = this.field?.options?.resultType || 'text';

    return `
      <div class="formula-editor-v2">
        <!-- Top: Field Name & Result Type in one row -->
        <div class="formula-editor-header">
          <div class="formula-editor-name-group">
            <label class="formula-editor-label" for="formula-field-name">Field Name</label>
            <input
              type="text"
              id="formula-field-name"
              class="formula-editor-input"
              placeholder="e.g., Total Price, Status Label..."
              value="${this._escapeHtml(fieldName)}"
              autocomplete="off"
            >
          </div>
          <div class="formula-editor-type-group">
            <label class="formula-editor-label">Returns</label>
            <div class="formula-result-type-pills">
              <button type="button" class="formula-type-pill ${resultType === 'text' ? 'selected' : ''}" data-type="text">
                <i class="ph ph-text-aa"></i> Text
              </button>
              <button type="button" class="formula-type-pill ${resultType === 'number' ? 'selected' : ''}" data-type="number">
                <i class="ph ph-hash"></i> Number
              </button>
              <button type="button" class="formula-type-pill ${resultType === 'date' ? 'selected' : ''}" data-type="date">
                <i class="ph ph-calendar"></i> Date
              </button>
              <button type="button" class="formula-type-pill ${resultType === 'checkbox' ? 'selected' : ''}" data-type="checkbox">
                <i class="ph ph-check-square"></i> Boolean
              </button>
            </div>
            <input type="hidden" name="resultType" value="${resultType}">
          </div>
        </div>

        <!-- Main Content: Editor + Reference Panel -->
        <div class="formula-editor-body">
          <!-- Left: Formula Editor -->
          <div class="formula-editor-main">
            <div class="formula-editor-input-area">
              <!-- Operator Toolbar -->
              <div class="formula-operator-bar">
                ${this.operators.map(op => `
                  <button type="button" class="formula-op-btn" data-insert="${op.symbol}" title="${op.name}">
                    ${op.symbol}
                  </button>
                `).join('')}
              </div>
              <!-- Formula Textarea -->
              <textarea
                id="formula-input"
                class="formula-editor-textarea"
                placeholder="IF({Status} = 'Done', 'Complete', 'In Progress')"
                spellcheck="false"
              >${this._escapeHtml(formula)}</textarea>
              <!-- Inline Validation -->
              <div class="formula-validation" id="formula-preview">
                <span class="formula-validation-idle"><i class="ph ph-info"></i> Use {Field Name} to reference fields</span>
              </div>
            </div>
          </div>

          <!-- Right: Reference Panel with Tabs -->
          <div class="formula-reference-panel">
            <div class="formula-reference-tabs">
              <button type="button" class="formula-ref-tab active" data-tab="fields">
                <i class="ph ph-columns"></i> Fields
              </button>
              <button type="button" class="formula-ref-tab" data-tab="functions">
                <i class="ph ph-function"></i> Functions
              </button>
            </div>

            <!-- Fields Tab -->
            <div class="formula-tab-content active" data-tab-content="fields">
              <div class="formula-field-chips" id="formula-field-list">
                ${this._renderFieldChips(fields)}
              </div>
            </div>

            <!-- Functions Tab -->
            <div class="formula-tab-content" data-tab-content="functions">
              <div class="formula-fn-search">
                <i class="ph ph-magnifying-glass"></i>
                <input
                  type="text"
                  id="formula-function-search"
                  placeholder="Search functions..."
                  autocomplete="off"
                >
              </div>
              <div class="formula-fn-disclosure-list" id="formula-function-list">
                ${this._renderFunctionDisclosures()}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render field chips (new design)
   */
  _renderFieldChips(fields) {
    if (fields.length === 0) {
      return '<div class="formula-empty-state"><i class="ph ph-info"></i> No fields available to reference</div>';
    }

    const fieldTypeIcons = {
      text: 'ph-text-aa',
      longText: 'ph-text-align-left',
      number: 'ph-hash',
      select: 'ph-list',
      multiSelect: 'ph-list-checks',
      date: 'ph-calendar',
      checkbox: 'ph-check-square',
      link: 'ph-link',
      attachment: 'ph-paperclip',
      url: 'ph-link-simple',
      email: 'ph-envelope',
      phone: 'ph-phone',
      formula: 'ph-function',
      rollup: 'ph-arrows-merge',
      count: 'ph-number-circle-one',
      autonumber: 'ph-number-square-one',
      json: 'ph-brackets-curly'
    };

    return fields.map(field => {
      const icon = fieldTypeIcons[field.type] || 'ph-circle';
      return `
        <button type="button" class="formula-field-chip" data-field-name="${this._escapeHtml(field.name)}" title="Click to insert {${this._escapeHtml(field.name)}}">
          <i class="ph ${icon}"></i>
          <span>${this._escapeHtml(field.name)}</span>
        </button>
      `;
    }).join('');
  }

  /**
   * Render category filter chips
   */
  _renderCategoryFilters() {
    return `
      <button type="button" class="formula-cat-chip active" data-category="all">All</button>
      ${Object.entries(this.functionCategories).map(([key, category]) => `
        <button type="button" class="formula-cat-chip" data-category="${key}">
          <i class="ph ${category.icon}"></i> ${category.name}
        </button>
      `).join('')}
    `;
  }

  /**
   * Render function categories as disclosure/accordion sections
   */
  _renderFunctionDisclosures() {
    return Object.entries(this.functionCategories).map(([key, category]) => `
      <div class="formula-fn-disclosure" data-category="${key}">
        <button type="button" class="formula-fn-disclosure-header">
          <i class="ph ${category.icon}"></i>
          <span class="formula-fn-disclosure-title">${category.name}</span>
          <span class="formula-fn-disclosure-count">${category.functions.length}</span>
          <i class="ph ph-caret-right formula-fn-disclosure-arrow"></i>
        </button>
        <div class="formula-fn-disclosure-content">
          ${category.functions.map(fn => `
            <button type="button" class="formula-fn-item" data-syntax="${this._escapeHtml(fn.syntax)}" data-category="${key}">
              <div class="formula-fn-name">${fn.name}</div>
              <div class="formula-fn-syntax">${this._escapeHtml(fn.syntax)}</div>
              <div class="formula-fn-desc">${fn.description}</div>
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  /**
   * Render flat function list (new design)
   */
  _renderFunctionList(filterCategory = 'all') {
    const functions = [];

    Object.entries(this.functionCategories).forEach(([key, category]) => {
      if (filterCategory === 'all' || filterCategory === key) {
        category.functions.forEach(fn => {
          functions.push({
            ...fn,
            category: key,
            categoryName: category.name,
            categoryIcon: category.icon
          });
        });
      }
    });

    if (functions.length === 0) {
      return '<div class="formula-empty-state">No functions match your search</div>';
    }

    return functions.map(fn => `
      <button type="button" class="formula-fn-item" data-syntax="${this._escapeHtml(fn.syntax)}" data-category="${fn.category}">
        <div class="formula-fn-header">
          <span class="formula-fn-name">${fn.name}</span>
          <span class="formula-fn-category"><i class="ph ${fn.categoryIcon}"></i></span>
        </div>
        <div class="formula-fn-syntax">${this._escapeHtml(fn.syntax)}</div>
        <div class="formula-fn-desc">${fn.description}</div>
      </button>
    `).join('');
  }

  // Keep old method for backwards compatibility
  _renderFieldList(fields) {
    return this._renderFieldChips(fields);
  }

  // Keep old method for backwards compatibility
  _renderFunctionCategories() {
    return Object.entries(this.functionCategories).map(([key, category]) => `
      <div class="formula-category" data-category="${key}">
        <button type="button" class="formula-category-header">
          <i class="ph ${category.icon}"></i>
          <span>${category.name}</span>
          <span class="formula-category-count">${category.functions.length}</span>
          <i class="ph ph-caret-down formula-category-toggle"></i>
        </button>
        <div class="formula-category-functions">
          ${category.functions.map(fn => `
            <button type="button" class="formula-function-item" data-syntax="${this._escapeHtml(fn.syntax)}">
              <div class="formula-function-name">${fn.name}</div>
              <div class="formula-function-desc">${fn.description}</div>
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  /**
   * Attach event listeners
   */
  _attachEventListeners() {
    const modalEl = this.modal.element;
    if (!modalEl) return;

    // Field chip clicks (new design)
    const fieldList = modalEl.querySelector('#formula-field-list');
    if (fieldList) {
      fieldList.addEventListener('click', (e) => {
        const fieldChip = e.target.closest('.formula-field-chip') || e.target.closest('.formula-field-item');
        if (fieldChip) {
          const fieldName = fieldChip.dataset.fieldName;
          this._insertAtCursor(`{${fieldName}}`);
        }
      });
    }

    // Tab switching (new design)
    const tabContainer = modalEl.querySelector('.formula-reference-tabs');
    if (tabContainer) {
      tabContainer.addEventListener('click', (e) => {
        const tab = e.target.closest('.formula-ref-tab');
        if (tab) {
          const tabName = tab.dataset.tab;
          // Update active tab
          modalEl.querySelectorAll('.formula-ref-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          // Show corresponding content
          modalEl.querySelectorAll('.formula-tab-content').forEach(c => c.classList.remove('active'));
          const content = modalEl.querySelector(`[data-tab-content="${tabName}"]`);
          if (content) content.classList.add('active');
        }
      });
    }

    // Function disclosure list clicks (disclosure toggle + function insert)
    const fnList = modalEl.querySelector('#formula-function-list');
    if (fnList) {
      fnList.addEventListener('click', (e) => {
        // Handle disclosure header click
        const disclosureHeader = e.target.closest('.formula-fn-disclosure-header');
        if (disclosureHeader) {
          const disclosure = disclosureHeader.closest('.formula-fn-disclosure');
          if (disclosure) {
            disclosure.classList.toggle('expanded');
          }
          return;
        }
        // Handle function item click
        const fnItem = e.target.closest('.formula-fn-item');
        if (fnItem) {
          const syntax = fnItem.dataset.syntax;
          this._insertAtCursor(syntax);
        }
      });
    }

    // Function clicks (old design fallback)
    const functionCategories = modalEl.querySelector('#formula-function-categories');
    if (functionCategories) {
      functionCategories.addEventListener('click', (e) => {
        const categoryHeader = e.target.closest('.formula-category-header');
        if (categoryHeader) {
          const category = categoryHeader.closest('.formula-category');
          category.classList.toggle('expanded');
          return;
        }
        const functionItem = e.target.closest('.formula-function-item');
        if (functionItem) {
          const syntax = functionItem.dataset.syntax;
          this._insertAtCursor(syntax);
        }
      });
    }

    // Operator buttons (works for both designs)
    modalEl.addEventListener('click', (e) => {
      const opBtn = e.target.closest('.formula-op-btn');
      if (opBtn) {
        const insertText = opBtn.dataset.insert;
        this._insertAtCursor(` ${insertText} `);
      }
    });

    // Function search
    const searchInput = modalEl.querySelector('#formula-function-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this._filterFunctionsV2(e.target.value);
      });
    }

    // Result type pills (new design)
    const typePills = modalEl.querySelector('.formula-result-type-pills');
    if (typePills) {
      typePills.addEventListener('click', (e) => {
        const pill = e.target.closest('.formula-type-pill');
        if (pill) {
          const type = pill.dataset.type;
          // Update active pill
          modalEl.querySelectorAll('.formula-type-pill').forEach(p => p.classList.remove('selected'));
          pill.classList.add('selected');
          // Update hidden input
          const hiddenInput = modalEl.querySelector('input[name="resultType"]');
          if (hiddenInput) hiddenInput.value = type;
        }
      });
    }

    // Result type selection (old design fallback)
    const resultTypes = modalEl.querySelectorAll('.formula-result-type input');
    resultTypes.forEach(input => {
      input.addEventListener('change', () => {
        modalEl.querySelectorAll('.formula-result-type').forEach(el => {
          el.classList.remove('selected');
        });
        input.closest('.formula-result-type').classList.add('selected');
      });
    });

    // Formula preview on input
    const formulaInput = modalEl.querySelector('#formula-input');
    if (formulaInput) {
      formulaInput.addEventListener('input', () => {
        this._updatePreview();
      });
    }
  }

  /**
   * Insert text at cursor position in formula input
   */
  _insertAtCursor(text) {
    const textarea = this.modal?.element?.querySelector('#formula-input');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);

    textarea.value = before + text + after;

    // Position cursor appropriately
    // For functions with parentheses, place cursor inside them
    let cursorPos = start + text.length;
    if (text.includes('(') && text.includes(')')) {
      cursorPos = start + text.indexOf('(') + 1;
    }

    textarea.setSelectionRange(cursorPos, cursorPos);
    textarea.focus();

    this._updatePreview();
  }

  /**
   * Filter functions based on search query (disclosure design)
   */
  _filterFunctionsV2(query) {
    const modalEl = this.modal.element;
    const disclosures = modalEl.querySelectorAll('.formula-fn-disclosure');
    const normalizedQuery = query.toLowerCase().trim();

    disclosures.forEach(disclosure => {
      const fnItems = disclosure.querySelectorAll('.formula-fn-item');
      let hasVisibleItems = false;

      fnItems.forEach(fn => {
        const name = fn.querySelector('.formula-fn-name')?.textContent.toLowerCase() || '';
        const syntax = fn.querySelector('.formula-fn-syntax')?.textContent.toLowerCase() || '';
        const desc = fn.querySelector('.formula-fn-desc')?.textContent.toLowerCase() || '';
        const matches = normalizedQuery === '' ||
          name.includes(normalizedQuery) ||
          syntax.includes(normalizedQuery) ||
          desc.includes(normalizedQuery);

        fn.style.display = matches ? '' : 'none';
        if (matches) hasVisibleItems = true;
      });

      // Hide disclosure if no matching items, show and expand if searching
      disclosure.style.display = hasVisibleItems ? '' : 'none';
      if (normalizedQuery !== '' && hasVisibleItems) {
        disclosure.classList.add('expanded');
      } else if (normalizedQuery === '') {
        disclosure.classList.remove('expanded');
      }
    });
  }

  /**
   * Filter functions based on search query (old design fallback)
   */
  _filterFunctions(query) {
    const modalEl = this.modal.element;
    const categories = modalEl.querySelectorAll('.formula-category');
    const normalizedQuery = query.toLowerCase().trim();

    categories.forEach(category => {
      const functions = category.querySelectorAll('.formula-function-item');
      let hasMatch = false;

      functions.forEach(fn => {
        const name = fn.querySelector('.formula-function-name').textContent.toLowerCase();
        const desc = fn.querySelector('.formula-function-desc').textContent.toLowerCase();
        const matches = normalizedQuery === '' || name.includes(normalizedQuery) || desc.includes(normalizedQuery);

        fn.style.display = matches ? '' : 'none';
        if (matches) hasMatch = true;
      });

      if (normalizedQuery !== '') {
        category.classList.toggle('expanded', hasMatch);
      }
      category.style.display = hasMatch || normalizedQuery === '' ? '' : 'none';
    });
  }

  /**
   * Update formula preview
   */
  _updatePreview() {
    const modalEl = this.modal?.element;
    const formulaInput = modalEl?.querySelector('#formula-input');
    const preview = modalEl?.querySelector('#formula-preview');
    if (!formulaInput || !preview) return;

    const formula = formulaInput.value.trim();

    if (!formula) {
      preview.innerHTML = '<span class="formula-validation-idle"><i class="ph ph-info"></i> Use {Field Name} to reference fields</span>';
      preview.className = 'formula-validation';
      return;
    }

    // Simple validation/preview
    // Check for basic syntax issues
    const openParens = (formula.match(/\(/g) || []).length;
    const closeParens = (formula.match(/\)/g) || []).length;
    const openBraces = (formula.match(/\{/g) || []).length;
    const closeBraces = (formula.match(/\}/g) || []).length;

    if (openParens !== closeParens) {
      preview.innerHTML = `<span class="formula-validation-error"><i class="ph ph-warning-circle"></i> Unbalanced parentheses</span>`;
      preview.className = 'formula-validation error';
      return;
    }

    if (openBraces !== closeBraces) {
      preview.innerHTML = `<span class="formula-validation-error"><i class="ph ph-warning-circle"></i> Unbalanced braces in field reference</span>`;
      preview.className = 'formula-validation error';
      return;
    }

    // Extract and validate field references
    const fieldRefs = formula.match(/\{([^}]+)\}/g) || [];
    const set = this.workbench.getCurrentSet();
    const fieldNames = new Set((set?.fields || []).map(f => f.name));

    const invalidRefs = fieldRefs
      .map(ref => ref.slice(1, -1))
      .filter(name => !fieldNames.has(name));

    if (invalidRefs.length > 0) {
      preview.innerHTML = `<span class="formula-validation-warning"><i class="ph ph-warning"></i> Unknown field: ${invalidRefs.join(', ')}</span>`;
      preview.className = 'formula-validation warning';
      return;
    }

    // Show formula structure
    preview.innerHTML = `<span class="formula-validation-valid"><i class="ph ph-check-circle"></i> Valid syntax</span>`;
    preview.className = 'formula-validation valid';
  }

  /**
   * Handle save button click
   */
  _handleSave(modal) {
    const modalEl = modal.element;
    const nameInput = modalEl?.querySelector('#formula-field-name');
    const formulaInput = modalEl?.querySelector('#formula-input');
    // Support both new design (hidden input) and old design (radio buttons)
    const hiddenResultType = modalEl?.querySelector('input[name="resultType"][type="hidden"]');
    const checkedResultType = modalEl?.querySelector('input[name="resultType"]:checked');

    const name = nameInput?.value?.trim() || '';
    const formula = formulaInput?.value?.trim() || '';
    const resultType = hiddenResultType?.value || checkedResultType?.value || 'text';

    // Validation
    if (!name) {
      this._showFieldError('formula-field-name', 'Field name is required');
      return;
    }

    if (!formula) {
      this._showFieldError('formula-input', 'Formula is required');
      return;
    }

    // Check for duplicate field names (when creating or renaming)
    const set = this.workbench.getCurrentSet();
    const existingField = set?.fields.find(f =>
      f.name.toLowerCase() === name.toLowerCase() &&
      f.id !== this.field?.id
    );

    if (existingField) {
      this._showFieldError('formula-field-name', 'A field with this name already exists');
      return;
    }

    // Call save callback
    if (this.onSave) {
      this.onSave({
        name,
        formula,
        resultType
      });
    }

    modal.hide();
  }

  /**
   * Show error on a field
   */
  _showFieldError(inputId, message) {
    const input = this.modal?.element?.querySelector(`#${inputId}`);
    if (!input) return;

    input.classList.add('error');

    // Remove existing error message
    const existingError = input.parentNode.querySelector('.formula-field-error');
    if (existingError) existingError.remove();

    // Add error message
    const errorEl = document.createElement('div');
    errorEl.className = 'formula-field-error';
    errorEl.textContent = message;
    input.parentNode.appendChild(errorEl);

    // Focus and shake
    input.focus();
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 500);

    // Clear error on input
    const clearError = () => {
      input.classList.remove('error');
      errorEl.remove();
      input.removeEventListener('input', clearError);
    };
    input.addEventListener('input', clearError);
  }

  /**
   * Escape HTML special characters
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}


// ============================================================================
// Export
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EOFormulaEditor };
}

if (typeof window !== 'undefined') {
  window.EOFormulaEditor = EOFormulaEditor;
}
