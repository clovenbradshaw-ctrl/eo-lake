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

    // Focus the name input
    setTimeout(() => {
      const nameInput = document.getElementById('formula-field-name');
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
      <div class="formula-editor">
        <!-- Left Panel: Editor -->
        <div class="formula-editor-main">
          <!-- Field Name -->
          <div class="formula-editor-section">
            <label class="formula-editor-label" for="formula-field-name">
              Field Name
            </label>
            <input
              type="text"
              id="formula-field-name"
              class="formula-editor-input"
              placeholder="Enter field name..."
              value="${this._escapeHtml(fieldName)}"
              autocomplete="off"
            >
          </div>

          <!-- Formula Input -->
          <div class="formula-editor-section formula-editor-section-grow">
            <label class="formula-editor-label" for="formula-input">
              Formula
              <span class="formula-editor-hint">Use field names in {curly braces} to reference fields</span>
            </label>
            <div class="formula-input-wrapper">
              <textarea
                id="formula-input"
                class="formula-editor-textarea"
                placeholder="Enter your formula... e.g., IF({Status} = 'Done', 'Complete', 'In Progress')"
                spellcheck="false"
              >${this._escapeHtml(formula)}</textarea>
            </div>
            <div class="formula-editor-toolbar">
              ${this.operators.map(op => `
                <button type="button" class="formula-op-btn" data-insert="${op.symbol}" title="${op.name}: ${op.example}">
                  ${op.symbol}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Result Type -->
          <div class="formula-editor-section">
            <label class="formula-editor-label">
              Result Type
            </label>
            <div class="formula-result-types">
              <label class="formula-result-type ${resultType === 'text' ? 'selected' : ''}">
                <input type="radio" name="resultType" value="text" ${resultType === 'text' ? 'checked' : ''}>
                <i class="ph ph-text-aa"></i>
                <span>Text</span>
              </label>
              <label class="formula-result-type ${resultType === 'number' ? 'selected' : ''}">
                <input type="radio" name="resultType" value="number" ${resultType === 'number' ? 'checked' : ''}>
                <i class="ph ph-hash"></i>
                <span>Number</span>
              </label>
              <label class="formula-result-type ${resultType === 'date' ? 'selected' : ''}">
                <input type="radio" name="resultType" value="date" ${resultType === 'date' ? 'checked' : ''}>
                <i class="ph ph-calendar"></i>
                <span>Date</span>
              </label>
              <label class="formula-result-type ${resultType === 'checkbox' ? 'selected' : ''}">
                <input type="radio" name="resultType" value="checkbox" ${resultType === 'checkbox' ? 'checked' : ''}>
                <i class="ph ph-check-square"></i>
                <span>Checkbox</span>
              </label>
            </div>
          </div>

          <!-- Preview (optional enhancement) -->
          <div class="formula-editor-section">
            <label class="formula-editor-label">
              Preview
            </label>
            <div class="formula-preview" id="formula-preview">
              <span class="formula-preview-placeholder">Enter a formula to see a preview</span>
            </div>
          </div>
        </div>

        <!-- Right Panel: Reference -->
        <div class="formula-editor-sidebar">
          <!-- Field References -->
          <div class="formula-sidebar-section">
            <div class="formula-sidebar-header">
              <i class="ph ph-columns"></i>
              Fields
            </div>
            <div class="formula-field-list" id="formula-field-list">
              ${this._renderFieldList(fields)}
            </div>
          </div>

          <!-- Function Browser -->
          <div class="formula-sidebar-section formula-sidebar-section-grow">
            <div class="formula-sidebar-header">
              <i class="ph ph-function"></i>
              Functions
            </div>
            <div class="formula-search-wrapper">
              <i class="ph ph-magnifying-glass"></i>
              <input
                type="text"
                id="formula-function-search"
                class="formula-search-input"
                placeholder="Search functions..."
                autocomplete="off"
              >
            </div>
            <div class="formula-function-categories" id="formula-function-categories">
              ${this._renderFunctionCategories()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render the list of available fields
   */
  _renderFieldList(fields) {
    if (fields.length === 0) {
      return '<div class="formula-empty-state">No fields available</div>';
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
        <button type="button" class="formula-field-item" data-field-name="${this._escapeHtml(field.name)}">
          <i class="ph ${icon}"></i>
          <span>${this._escapeHtml(field.name)}</span>
        </button>
      `;
    }).join('');
  }

  /**
   * Render function categories
   */
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

    // Field reference clicks
    const fieldList = modalEl.querySelector('#formula-field-list');
    if (fieldList) {
      fieldList.addEventListener('click', (e) => {
        const fieldItem = e.target.closest('.formula-field-item');
        if (fieldItem) {
          const fieldName = fieldItem.dataset.fieldName;
          this._insertAtCursor(`{${fieldName}}`);
        }
      });
    }

    // Function clicks
    const functionCategories = modalEl.querySelector('#formula-function-categories');
    if (functionCategories) {
      functionCategories.addEventListener('click', (e) => {
        // Category toggle
        const categoryHeader = e.target.closest('.formula-category-header');
        if (categoryHeader) {
          const category = categoryHeader.closest('.formula-category');
          category.classList.toggle('expanded');
          return;
        }

        // Function insert
        const functionItem = e.target.closest('.formula-function-item');
        if (functionItem) {
          const syntax = functionItem.dataset.syntax;
          this._insertAtCursor(syntax);
        }
      });
    }

    // Operator buttons
    const toolbar = modalEl.querySelector('.formula-editor-toolbar');
    if (toolbar) {
      toolbar.addEventListener('click', (e) => {
        const opBtn = e.target.closest('.formula-op-btn');
        if (opBtn) {
          const insertText = opBtn.dataset.insert;
          this._insertAtCursor(` ${insertText} `);
        }
      });
    }

    // Function search
    const searchInput = modalEl.querySelector('#formula-function-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this._filterFunctions(e.target.value);
      });
    }

    // Result type selection
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
    const textarea = document.getElementById('formula-input');
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
   * Filter functions based on search query
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

      // Expand categories with matches, collapse others when searching
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
    const formulaInput = document.getElementById('formula-input');
    const preview = document.getElementById('formula-preview');
    if (!formulaInput || !preview) return;

    const formula = formulaInput.value.trim();

    if (!formula) {
      preview.innerHTML = '<span class="formula-preview-placeholder">Enter a formula to see a preview</span>';
      return;
    }

    // Simple validation/preview
    // Check for basic syntax issues
    const openParens = (formula.match(/\(/g) || []).length;
    const closeParens = (formula.match(/\)/g) || []).length;
    const openBraces = (formula.match(/\{/g) || []).length;
    const closeBraces = (formula.match(/\}/g) || []).length;

    if (openParens !== closeParens) {
      preview.innerHTML = `<span class="formula-preview-error"><i class="ph ph-warning"></i> Unbalanced parentheses</span>`;
      return;
    }

    if (openBraces !== closeBraces) {
      preview.innerHTML = `<span class="formula-preview-error"><i class="ph ph-warning"></i> Unbalanced braces in field reference</span>`;
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
      preview.innerHTML = `<span class="formula-preview-warning"><i class="ph ph-info"></i> Unknown field(s): ${invalidRefs.join(', ')}</span>`;
      return;
    }

    // Show formula structure
    preview.innerHTML = `<span class="formula-preview-valid"><i class="ph ph-check"></i> Formula syntax looks valid</span>`;
  }

  /**
   * Handle save button click
   */
  _handleSave(modal) {
    const nameInput = document.getElementById('formula-field-name');
    const formulaInput = document.getElementById('formula-input');
    const resultTypeInput = document.querySelector('input[name="resultType"]:checked');

    const name = nameInput?.value?.trim() || '';
    const formula = formulaInput?.value?.trim() || '';
    const resultType = resultTypeInput?.value || 'text';

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
    const input = document.getElementById(inputId);
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
