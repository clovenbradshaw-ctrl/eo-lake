/**
 * EO Import System - CSV and JSON Import with Schema Inference
 *
 * Features:
 * - CSV parsing with auto-delimiter detection
 * - JSON parsing with structure normalization
 * - Schema inference with field type detection
 * - Progress events for real-time UI updates
 * - Immediate data display after import
 */

// ============================================================================
// CSV Parser
// ============================================================================

/**
 * Parse CSV with intelligent delimiter detection
 */
class CSVParser {
  constructor() {
    this.delimiters = [',', ';', '\t', '|'];
  }

  /**
   * Parse CSV text into records
   * @param {string} text - Raw CSV text
   * @param {Object} options - { delimiter, hasHeaders }
   * @returns {{ headers: string[], rows: object[], delimiter: string, hasHeaders: boolean }}
   */
  parse(text, options = {}) {
    // Normalize line endings
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Detect delimiter if not specified
    const delimiter = options.delimiter || this._detectDelimiter(text);

    // Parse into lines (handling quoted fields with newlines)
    const lines = this._parseLines(text, delimiter);

    if (lines.length === 0) {
      return { headers: [], rows: [], delimiter, hasHeaders: false };
    }

    // Detect if first row is headers
    const hasHeaders = options.hasHeaders !== undefined
      ? options.hasHeaders
      : this._detectHeaders(lines);

    // Extract headers
    const headers = hasHeaders
      ? lines[0].map((h, i) => this._sanitizeHeader(h) || `Column ${i + 1}`)
      : lines[0].map((_, i) => `Column ${i + 1}`);

    // Convert to row objects
    const dataLines = hasHeaders ? lines.slice(1) : lines;
    const rows = dataLines.map((line, rowIndex) => {
      const row = {};
      headers.forEach((header, i) => {
        row[header] = line[i] !== undefined ? line[i] : '';
      });
      row._rowIndex = rowIndex;
      return row;
    });

    return {
      headers,
      rows,
      delimiter,
      hasHeaders,
      totalRows: rows.length
    };
  }

  /**
   * Detect the most likely delimiter
   */
  _detectDelimiter(text) {
    const firstLines = text.split('\n').slice(0, 10).join('\n');

    const counts = this.delimiters.map(d => ({
      delimiter: d,
      count: (firstLines.match(new RegExp(d === '|' ? '\\|' : d, 'g')) || []).length
    }));

    // Sort by count, prefer comma for ties
    counts.sort((a, b) => {
      if (b.count === a.count) {
        return a.delimiter === ',' ? -1 : 1;
      }
      return b.count - a.count;
    });

    return counts[0].count > 0 ? counts[0].delimiter : ',';
  }

  /**
   * Parse CSV lines handling quoted fields
   */
  _parseLines(text, delimiter) {
    const lines = [];
    let currentLine = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote
            currentField += '"';
            i += 2;
          } else {
            // End of quoted field
            inQuotes = false;
            i++;
          }
        } else {
          currentField += char;
          i++;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
        } else if (char === delimiter) {
          currentLine.push(currentField.trim());
          currentField = '';
          i++;
        } else if (char === '\n') {
          currentLine.push(currentField.trim());
          if (currentLine.some(f => f !== '')) {
            lines.push(currentLine);
          }
          currentLine = [];
          currentField = '';
          i++;
        } else {
          currentField += char;
          i++;
        }
      }
    }

    // Handle last field/line
    if (currentField || currentLine.length > 0) {
      currentLine.push(currentField.trim());
      if (currentLine.some(f => f !== '')) {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  /**
   * Detect if first row is headers (heuristic)
   */
  _detectHeaders(lines) {
    if (lines.length < 2) return true;

    const firstRow = lines[0];
    const secondRow = lines[1];

    // Check if first row looks like headers:
    // - All strings, no numbers
    // - Different types from second row
    const firstRowNumeric = firstRow.filter(v => !isNaN(parseFloat(v)) && v.trim() !== '').length;
    const secondRowNumeric = secondRow.filter(v => !isNaN(parseFloat(v)) && v.trim() !== '').length;

    // If first row has fewer numbers than second, likely headers
    if (firstRowNumeric < secondRowNumeric) return true;

    // If first row values look like column names (short, no spaces at start)
    const looksLikeHeaders = firstRow.every(v =>
      v.length < 50 &&
      !/^\d+$/.test(v) &&
      !/^\d{4}-\d{2}-\d{2}/.test(v)
    );

    return looksLikeHeaders;
  }

  /**
   * Sanitize header name
   */
  _sanitizeHeader(header) {
    return String(header)
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ')
      .substring(0, 100);
  }
}


// ============================================================================
// Schema Inferrer
// ============================================================================

/**
 * Infer field types from data
 */
class SchemaInferrer {
  constructor() {
    // Regex patterns for type detection
    this.patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\/.+/i,
      phone: /^[\d\s\-\+\(\)]{7,}$/,
      date: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/,
      dateAlt: /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/,
      number: /^-?\d+\.?\d*$/,
      boolean: /^(true|false|yes|no|1|0)$/i
    };
  }

  /**
   * Infer schema from parsed data
   * @param {string[]} headers - Column headers
   * @param {object[]} rows - Data rows
   * @returns {{ fields: object[] }}
   */
  inferSchema(headers, rows) {
    const fields = headers.map((header, index) => {
      const values = rows.map(row => row[header]).filter(v => v !== '' && v !== null && v !== undefined);
      const typeInfo = this._inferType(values, header);

      return {
        name: header,
        type: typeInfo.type,
        confidence: typeInfo.confidence,
        options: typeInfo.options || {},
        isPrimary: index === 0,
        samples: values.slice(0, 3)
      };
    });

    return { fields };
  }

  /**
   * Infer type from values
   */
  _inferType(values, fieldName) {
    if (values.length === 0) {
      return { type: 'text', confidence: 0.5 };
    }

    const typeCounts = {
      email: 0,
      url: 0,
      phone: 0,
      date: 0,
      number: 0,
      checkbox: 0,
      select: 0,
      longText: 0,
      text: 0
    };

    const uniqueValues = new Set();

    for (const value of values) {
      const strValue = String(value).trim();
      uniqueValues.add(strValue.toLowerCase());

      if (this.patterns.email.test(strValue)) {
        typeCounts.email++;
      } else if (this.patterns.url.test(strValue)) {
        typeCounts.url++;
      } else if (this.patterns.phone.test(strValue)) {
        typeCounts.phone++;
      } else if (this.patterns.date.test(strValue) || this.patterns.dateAlt.test(strValue)) {
        typeCounts.date++;
      } else if (this.patterns.number.test(strValue)) {
        typeCounts.number++;
      } else if (this.patterns.boolean.test(strValue)) {
        typeCounts.checkbox++;
      } else if (strValue.length > 100) {
        typeCounts.longText++;
      } else {
        typeCounts.text++;
      }
    }

    // Calculate best type
    const total = values.length;
    const threshold = 0.7; // 70% of values should match type

    // Check for SELECT (low cardinality)
    const uniqueCount = uniqueValues.size;
    if (uniqueCount <= 20 && uniqueCount < total * 0.5 && total > 5) {
      const choices = Array.from(uniqueValues).map((name, i) => ({
        id: 'choice_' + Math.random().toString(36).substr(2, 9),
        name: String(name),
        color: ['blue', 'green', 'yellow', 'red', 'purple', 'pink', 'orange', 'gray'][i % 8]
      }));
      return {
        type: 'select',
        confidence: 0.85,
        options: { choices }
      };
    }

    // Check other types by ratio
    if (typeCounts.email / total > threshold) {
      return { type: 'email', confidence: typeCounts.email / total };
    }
    if (typeCounts.url / total > threshold) {
      return { type: 'url', confidence: typeCounts.url / total };
    }
    if (typeCounts.date / total > threshold) {
      return { type: 'date', confidence: typeCounts.date / total };
    }
    if (typeCounts.number / total > threshold) {
      return { type: 'number', confidence: typeCounts.number / total };
    }
    if (typeCounts.checkbox / total > threshold) {
      return { type: 'checkbox', confidence: typeCounts.checkbox / total };
    }
    if (typeCounts.phone / total > threshold) {
      return { type: 'phone', confidence: typeCounts.phone / total };
    }
    if (typeCounts.longText / total > 0.3) {
      return { type: 'longText', confidence: typeCounts.longText / total };
    }

    // Default to text
    return { type: 'text', confidence: 0.8 };
  }
}


// ============================================================================
// Import Orchestrator
// ============================================================================

/**
 * Import orchestrator with progress events
 */
class ImportOrchestrator {
  constructor(workbench, eventBus = null) {
    this.workbench = workbench;
    this.eventBus = eventBus || (typeof getEventBus === 'function' ? getEventBus() : null);
    this.csvParser = new CSVParser();
    this.schemaInferrer = new SchemaInferrer();
  }

  /**
   * Import a file (CSV or JSON)
   * @param {File} file - File to import
   * @param {Object} options - Import options
   * @returns {Promise<{ success: boolean, setId: string, recordCount: number }>}
   */
  async import(file, options = {}) {
    const startTime = Date.now();

    this._emitProgress('started', {
      fileName: file.name,
      fileSize: file.size,
      phase: 'reading'
    });

    try {
      // Read file content
      const text = await this._readFile(file);

      this._emitProgress('progress', {
        phase: 'parsing',
        percentage: 10
      });

      // Determine file type and parse
      const isCSV = file.name.toLowerCase().endsWith('.csv') ||
                    file.type === 'text/csv' ||
                    !this._isJSON(text);

      let parseResult;
      if (isCSV) {
        parseResult = this.csvParser.parse(text, options);
      } else {
        parseResult = this._parseJSON(text);
      }

      this._emitProgress('progress', {
        phase: 'inferring',
        percentage: 30,
        rowCount: parseResult.rows.length
      });

      // Infer schema
      const schema = this.schemaInferrer.inferSchema(parseResult.headers, parseResult.rows);

      this._emitProgress('progress', {
        phase: 'creating',
        percentage: 50,
        fieldCount: schema.fields.length
      });

      // Create set name from filename
      const setName = options.setName || file.name.replace(/\.(csv|json)$/i, '');

      // Create the set and import records
      const result = await this._createSetWithRecords(setName, schema, parseResult, options);

      this._emitProgress('completed', {
        fileName: file.name,
        setId: result.setId,
        recordCount: result.recordCount,
        fieldCount: schema.fields.length,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this._emitProgress('failed', {
        fileName: file.name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Preview import without actually importing
   */
  async preview(file, options = {}) {
    const text = await this._readFile(file);

    const isCSV = file.name.toLowerCase().endsWith('.csv') ||
                  file.type === 'text/csv' ||
                  !this._isJSON(text);

    let parseResult;
    if (isCSV) {
      parseResult = this.csvParser.parse(text, options);
    } else {
      parseResult = this._parseJSON(text);
    }

    const schema = this.schemaInferrer.inferSchema(parseResult.headers, parseResult.rows);

    return {
      fileName: file.name,
      fileSize: file.size,
      isCSV,
      delimiter: parseResult.delimiter,
      hasHeaders: parseResult.hasHeaders,
      headers: parseResult.headers,
      schema: schema,
      rowCount: parseResult.rows.length,
      sampleRows: parseResult.rows.slice(0, 5)
    };
  }

  /**
   * Read file as text
   */
  _readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Check if text is valid JSON
   */
  _isJSON(text) {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse JSON into normalized format
   */
  _parseJSON(text) {
    const data = JSON.parse(text);

    // Handle different JSON structures
    let records = [];

    if (Array.isArray(data)) {
      records = data;
    } else if (data.records && Array.isArray(data.records)) {
      records = data.records;
    } else if (data.sets && Array.isArray(data.sets)) {
      // EO Lake export format - use first set's records
      if (data.sets.length > 0 && data.sets[0].records) {
        return this._convertEOLakeExport(data.sets[0]);
      }
    } else if (typeof data === 'object') {
      // Single object or keyed object
      const keys = Object.keys(data);
      if (keys.every(k => typeof data[k] === 'object' && !Array.isArray(data[k]))) {
        // Keyed objects: { "id1": {...}, "id2": {...} }
        records = keys.map(key => ({ _key: key, ...data[key] }));
      } else {
        // Single record
        records = [data];
      }
    }

    if (records.length === 0) {
      return { headers: [], rows: [], hasHeaders: true };
    }

    // Extract headers from first record
    const headers = Object.keys(records[0]).filter(k => !k.startsWith('_'));

    return {
      headers,
      rows: records,
      hasHeaders: true,
      totalRows: records.length
    };
  }

  /**
   * Convert EO Lake export format
   */
  _convertEOLakeExport(set) {
    const headers = set.fields.map(f => f.name);
    const rows = set.records.map(record => {
      const row = {};
      set.fields.forEach(field => {
        row[field.name] = record.values[field.id] || '';
      });
      return row;
    });

    return { headers, rows, hasHeaders: true, totalRows: rows.length };
  }

  /**
   * Create set with records in batches
   */
  async _createSetWithRecords(setName, schema, parseResult, options) {
    const BATCH_SIZE = 100;
    const { headers, rows } = parseResult;

    // Create the set
    const set = createSet(setName);

    // Replace default fields with inferred ones
    set.fields = schema.fields.map((field, index) => {
      return createField(field.name, field.type, {
        isPrimary: index === 0,
        ...field.options
      });
    });

    // Add records in batches
    let processed = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        const values = {};
        set.fields.forEach((field, index) => {
          const header = headers[index];
          let value = row[header];

          // Convert values based on type
          value = this._convertValue(value, field.type, field.options);
          values[field.id] = value;
        });

        set.records.push(createRecord(set.id, values));
      }

      processed = Math.min(i + BATCH_SIZE, rows.length);

      this._emitProgress('progress', {
        phase: 'importing',
        percentage: 50 + Math.round((processed / rows.length) * 45),
        recordsProcessed: processed,
        totalRecords: rows.length
      });

      // Yield to UI thread
      await new Promise(r => setTimeout(r, 0));
    }

    // Add to workbench
    this.workbench.sets.push(set);
    this.workbench.currentSetId = set.id;
    this.workbench.currentViewId = set.views[0]?.id;

    // Create EO event for the import
    if (this.workbench.eoApp) {
      try {
        this.workbench.eoApp.recordGiven('received', {
          setId: set.id,
          setName: set.name,
          recordCount: set.records.length,
          fieldCount: set.fields.length
        }, { action: 'import_data' });
      } catch (e) {
        console.error('Failed to create EO import event:', e);
      }
    }

    // Save and refresh UI immediately
    this.workbench._saveData();
    this.workbench._renderSidebar();
    this.workbench._renderView();
    this.workbench._updateStatus();

    return {
      success: true,
      setId: set.id,
      recordCount: set.records.length,
      fieldCount: set.fields.length
    };
  }

  /**
   * Convert value to appropriate type
   */
  _convertValue(value, type, options = {}) {
    if (value === '' || value === null || value === undefined) {
      return type === 'checkbox' ? false : '';
    }

    // Preserve nested objects and arrays as-is for proper rendering
    if (typeof value === 'object') {
      return value;
    }

    const strValue = String(value).trim();

    switch (type) {
      case 'number':
        const num = parseFloat(strValue.replace(/,/g, ''));
        return isNaN(num) ? 0 : num;

      case 'checkbox':
        return /^(true|yes|1)$/i.test(strValue);

      case 'date':
        // Try to normalize date format
        if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(strValue)) {
          const parts = strValue.split(/[\/\-]/);
          // Assume MM/DD/YYYY or DD/MM/YYYY based on values
          const month = parseInt(parts[0]) > 12 ? parts[1] : parts[0];
          const day = parseInt(parts[0]) > 12 ? parts[0] : parts[1];
          const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return strValue;

      case 'select':
        // Find matching choice
        if (options.choices) {
          const choice = options.choices.find(c =>
            c.name.toLowerCase() === strValue.toLowerCase()
          );
          return choice ? choice.id : strValue;
        }
        return strValue;

      default:
        return strValue;
    }
  }

  /**
   * Emit progress event
   */
  _emitProgress(type, data) {
    if (this.eventBus) {
      this.eventBus.emit('IMPORT_' + type.toUpperCase(), data);
    }

    // Also dispatch DOM event for UI components
    window.dispatchEvent(new CustomEvent('eo-import-progress', {
      detail: { type, ...data }
    }));
  }
}


// ============================================================================
// Import UI Component
// ============================================================================

/**
 * Create and show import modal
 */
function showImportModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = modal?.querySelector('.modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  if (!modal || !modalBody) return;

  modalTitle.textContent = 'Import Data';

  modalBody.innerHTML = `
    <div class="import-container">
      <!-- Drop Zone -->
      <div class="import-dropzone" id="import-dropzone">
        <div class="dropzone-content">
          <i class="ph ph-upload-simple dropzone-icon"></i>
          <p class="dropzone-text">Drop CSV or JSON file here</p>
          <p class="dropzone-subtext">or click to browse</p>
        </div>
        <input type="file" id="import-file-input" accept=".csv,.json" hidden>
      </div>

      <!-- Preview Section (hidden initially) -->
      <div class="import-preview" id="import-preview" style="display: none;">
        <div class="preview-header">
          <div class="preview-file-info">
            <i class="ph ph-file-csv"></i>
            <span id="preview-filename">filename.csv</span>
            <span id="preview-filesize" class="text-muted"></span>
          </div>
          <button class="btn btn-sm btn-secondary" id="import-change-file">
            <i class="ph ph-arrow-counter-clockwise"></i> Change
          </button>
        </div>

        <div class="preview-stats">
          <div class="stat-item">
            <span class="stat-value" id="preview-rows">0</span>
            <span class="stat-label">Rows</span>
          </div>
          <div class="stat-item">
            <span class="stat-value" id="preview-fields">0</span>
            <span class="stat-label">Fields</span>
          </div>
          <div class="stat-item">
            <span class="stat-value" id="preview-delimiter">-</span>
            <span class="stat-label">Delimiter</span>
          </div>
        </div>

        <div class="preview-schema">
          <h4>Detected Schema</h4>
          <div class="schema-table" id="schema-table">
            <!-- Schema rows rendered here -->
          </div>
        </div>

        <div class="preview-sample">
          <h4>Sample Data</h4>
          <div class="sample-table-wrapper">
            <table class="sample-table" id="sample-table">
              <!-- Sample rows rendered here -->
            </table>
          </div>
        </div>

        <div class="import-options">
          <div class="form-group">
            <label class="form-label">Set Name</label>
            <input type="text" class="form-input" id="import-set-name" placeholder="Enter name for the new set">
          </div>
        </div>
      </div>

      <!-- Progress Section (hidden initially) -->
      <div class="import-progress" id="import-progress" style="display: none;">
        <div class="progress-content">
          <div class="progress-icon">
            <i class="ph ph-spinner ph-spin"></i>
          </div>
          <p class="progress-text" id="progress-text">Importing data...</p>
          <div class="progress-bar-container">
            <div class="progress-bar" id="progress-bar" style="width: 0%"></div>
          </div>
          <p class="progress-detail" id="progress-detail">Preparing...</p>
        </div>
      </div>

      <!-- Success Section (hidden initially) -->
      <div class="import-success" id="import-success" style="display: none;">
        <div class="success-content">
          <i class="ph ph-check-circle success-icon"></i>
          <h3>Import Complete!</h3>
          <p id="success-message">Successfully imported 0 records</p>
        </div>
      </div>
    </div>
  `;

  modalFooter.innerHTML = `
    <button class="btn btn-secondary" id="import-cancel">Cancel</button>
    <button class="btn btn-primary" id="import-confirm" disabled>
      <i class="ph ph-upload"></i> Import
    </button>
  `;

  modal.classList.add('active');

  // Initialize import handlers
  initImportHandlers();
}

/**
 * Initialize import modal handlers
 */
function initImportHandlers() {
  const dropzone = document.getElementById('import-dropzone');
  const fileInput = document.getElementById('import-file-input');
  const previewSection = document.getElementById('import-preview');
  const progressSection = document.getElementById('import-progress');
  const successSection = document.getElementById('import-success');
  const confirmBtn = document.getElementById('import-confirm');
  const cancelBtn = document.getElementById('import-cancel');
  const changeFileBtn = document.getElementById('import-change-file');

  let currentFile = null;
  let previewData = null;
  let orchestrator = null;

  // Get workbench reference
  const workbench = typeof getDataWorkbench === 'function' ? getDataWorkbench() : null;
  if (workbench) {
    orchestrator = new ImportOrchestrator(workbench);
  }

  // Dropzone click
  dropzone.addEventListener('click', () => fileInput.click());

  // File input change
  fileInput.addEventListener('change', async (e) => {
    if (e.target.files[0]) {
      await handleFileSelect(e.target.files[0]);
    }
  });

  // Drag and drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.json'))) {
      await handleFileSelect(file);
    }
  });

  // Change file button
  changeFileBtn?.addEventListener('click', () => {
    previewSection.style.display = 'none';
    dropzone.style.display = 'flex';
    confirmBtn.disabled = true;
    fileInput.click();
  });

  // Cancel button
  cancelBtn.addEventListener('click', () => {
    closeModal();
  });

  // Confirm import
  confirmBtn.addEventListener('click', async () => {
    if (!currentFile || !orchestrator) return;

    // Show progress
    dropzone.style.display = 'none';
    previewSection.style.display = 'none';
    progressSection.style.display = 'flex';
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;

    const setName = document.getElementById('import-set-name')?.value ||
                    currentFile.name.replace(/\.(csv|json)$/i, '');

    try {
      // Listen for progress events
      const progressHandler = (e) => {
        updateProgress(e.detail);
      };
      window.addEventListener('eo-import-progress', progressHandler);

      const result = await orchestrator.import(currentFile, { setName });

      window.removeEventListener('eo-import-progress', progressHandler);

      // Show success
      progressSection.style.display = 'none';
      successSection.style.display = 'flex';
      document.getElementById('success-message').textContent =
        `Successfully imported ${result.recordCount} records with ${result.fieldCount} fields`;

      // Close after delay
      setTimeout(() => {
        closeModal();
      }, 1500);

    } catch (error) {
      progressSection.style.display = 'none';
      previewSection.style.display = 'block';
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      alert('Import failed: ' + error.message);
    }
  });

  // Handle file selection
  async function handleFileSelect(file) {
    currentFile = file;

    if (!orchestrator) {
      alert('Workbench not initialized');
      return;
    }

    try {
      // Show loading state on dropzone
      dropzone.innerHTML = `
        <div class="dropzone-content">
          <i class="ph ph-spinner ph-spin dropzone-icon"></i>
          <p class="dropzone-text">Analyzing file...</p>
        </div>
      `;

      // Get preview
      previewData = await orchestrator.preview(file);

      // Update UI with preview
      dropzone.style.display = 'none';
      previewSection.style.display = 'block';

      // File info
      document.getElementById('preview-filename').textContent = file.name;
      document.getElementById('preview-filesize').textContent =
        `(${formatFileSize(file.size)})`;

      // Stats
      document.getElementById('preview-rows').textContent = previewData.rowCount;
      document.getElementById('preview-fields').textContent = previewData.schema.fields.length;
      document.getElementById('preview-delimiter').textContent =
        previewData.isCSV ? getDelimiterName(previewData.delimiter) : 'JSON';

      // Schema table
      const schemaTable = document.getElementById('schema-table');
      schemaTable.innerHTML = previewData.schema.fields.map(field => `
        <div class="schema-row">
          <div class="schema-field-name">
            <i class="${getFieldTypeIcon(field.type)}"></i>
            ${escapeHtml(field.name)}
          </div>
          <div class="schema-field-type">
            ${getFieldTypeName(field.type)}
            <span class="confidence">${Math.round(field.confidence * 100)}%</span>
          </div>
          <div class="schema-field-sample">
            ${field.samples.slice(0, 2).map(s => `<span class="sample-value">${escapeHtml(String(s).substring(0, 30))}</span>`).join('')}
          </div>
        </div>
      `).join('');

      // Sample table
      const sampleTable = document.getElementById('sample-table');
      sampleTable.innerHTML = `
        <thead>
          <tr>
            ${previewData.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${previewData.sampleRows.slice(0, 3).map(row => `
            <tr>
              ${previewData.headers.map(h => `<td>${escapeHtml(String(row[h] || '').substring(0, 50))}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      `;

      // Set name input
      document.getElementById('import-set-name').value =
        file.name.replace(/\.(csv|json)$/i, '');

      // Enable confirm
      confirmBtn.disabled = false;

    } catch (error) {
      // Reset dropzone
      dropzone.innerHTML = `
        <div class="dropzone-content">
          <i class="ph ph-upload-simple dropzone-icon"></i>
          <p class="dropzone-text">Drop CSV or JSON file here</p>
          <p class="dropzone-subtext">or click to browse</p>
        </div>
      `;
      alert('Failed to parse file: ' + error.message);
    }
  }

  // Update progress display
  function updateProgress(data) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressDetail = document.getElementById('progress-detail');

    if (data.percentage !== undefined) {
      progressBar.style.width = data.percentage + '%';
    }

    switch (data.phase) {
      case 'reading':
        progressText.textContent = 'Reading file...';
        progressDetail.textContent = '';
        break;
      case 'parsing':
        progressText.textContent = 'Parsing data...';
        progressDetail.textContent = '';
        break;
      case 'inferring':
        progressText.textContent = 'Detecting field types...';
        progressDetail.textContent = `Found ${data.rowCount} rows`;
        break;
      case 'creating':
        progressText.textContent = 'Creating fields...';
        progressDetail.textContent = `${data.fieldCount} fields detected`;
        break;
      case 'importing':
        progressText.textContent = 'Importing records...';
        progressDetail.textContent = `${data.recordsProcessed} of ${data.totalRecords}`;
        break;
    }
  }
}

// Helper functions
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getDelimiterName(d) {
  const names = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };
  return names[d] || d;
}

function getFieldTypeIcon(type) {
  const icons = {
    text: 'ph ph-text-aa',
    longText: 'ph ph-text-align-left',
    number: 'ph ph-hash',
    select: 'ph ph-list-bullets',
    multiSelect: 'ph ph-list-checks',
    date: 'ph ph-calendar',
    checkbox: 'ph ph-check-square',
    email: 'ph ph-envelope',
    url: 'ph ph-globe',
    phone: 'ph ph-phone'
  };
  return icons[type] || 'ph ph-text-aa';
}

function getFieldTypeName(type) {
  const names = {
    text: 'Text',
    longText: 'Long Text',
    number: 'Number',
    select: 'Select',
    multiSelect: 'Multi Select',
    date: 'Date',
    checkbox: 'Checkbox',
    email: 'Email',
    url: 'URL',
    phone: 'Phone'
  };
  return names[type] || 'Text';
}

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}


// ============================================================================
// Import Styles
// ============================================================================

const importStyles = document.createElement('style');
importStyles.textContent = `
  .import-container {
    min-height: 400px;
  }

  .import-dropzone {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    border: 2px dashed var(--border-secondary);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all 0.2s;
    background: var(--bg-secondary);
  }

  .import-dropzone:hover,
  .import-dropzone.dragover {
    border-color: var(--primary);
    background: rgba(99, 102, 241, 0.05);
  }

  .dropzone-content {
    text-align: center;
    padding: 40px;
  }

  .dropzone-icon {
    font-size: 48px;
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  .dropzone-text {
    font-size: 16px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .dropzone-subtext {
    font-size: 13px;
    color: var(--text-muted);
  }

  .import-preview {
    display: none;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    margin-bottom: 16px;
  }

  .preview-file-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
  }

  .preview-file-info i {
    font-size: 20px;
    color: var(--primary);
  }

  .preview-stats {
    display: flex;
    gap: 24px;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    margin-bottom: 16px;
  }

  .stat-item {
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .stat-label {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .preview-schema h4,
  .preview-sample h4 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 8px;
    text-transform: uppercase;
  }

  .schema-table {
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    overflow: hidden;
    margin-bottom: 16px;
    max-height: 200px;
    overflow-y: auto;
  }

  .schema-row {
    display: grid;
    grid-template-columns: 1fr 120px 1fr;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-primary);
    align-items: center;
  }

  .schema-row:last-child {
    border-bottom: none;
  }

  .schema-field-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
  }

  .schema-field-name i {
    color: var(--text-muted);
  }

  .schema-field-type {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .schema-field-type .confidence {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .schema-field-sample {
    display: flex;
    gap: 8px;
    overflow: hidden;
  }

  .sample-value {
    font-size: 12px;
    color: var(--text-muted);
    background: var(--bg-tertiary);
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
  }

  .sample-table-wrapper {
    overflow-x: auto;
    margin-bottom: 16px;
  }

  .sample-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .sample-table th,
  .sample-table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-primary);
    white-space: nowrap;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sample-table th {
    background: var(--bg-secondary);
    font-weight: 600;
    color: var(--text-secondary);
  }

  .sample-table td {
    color: var(--text-primary);
  }

  .import-options {
    padding-top: 16px;
    border-top: 1px solid var(--border-primary);
  }

  .import-progress {
    display: none;
    align-items: center;
    justify-content: center;
    min-height: 300px;
  }

  .progress-content {
    text-align: center;
    width: 100%;
    max-width: 400px;
  }

  .progress-icon {
    font-size: 48px;
    color: var(--primary);
    margin-bottom: 16px;
  }

  .progress-icon .ph-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .progress-text {
    font-size: 16px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 16px;
  }

  .progress-bar-container {
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 12px;
  }

  .progress-bar {
    height: 100%;
    background: var(--primary);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .progress-detail {
    font-size: 13px;
    color: var(--text-muted);
  }

  .import-success {
    display: none;
    align-items: center;
    justify-content: center;
    min-height: 300px;
  }

  .success-content {
    text-align: center;
  }

  .success-icon {
    font-size: 64px;
    color: var(--success);
    margin-bottom: 16px;
  }

  .success-content h3 {
    font-size: 20px;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .success-content p {
    color: var(--text-secondary);
  }

  .text-muted {
    color: var(--text-muted);
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 12px;
  }
`;
document.head.appendChild(importStyles);


// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CSVParser,
    SchemaInferrer,
    ImportOrchestrator,
    showImportModal
  };
}

if (typeof window !== 'undefined') {
  window.CSVParser = CSVParser;
  window.SchemaInferrer = SchemaInferrer;
  window.ImportOrchestrator = ImportOrchestrator;
  window.showImportModal = showImportModal;
}
