/**
 * EO Lake - Data Export Module
 *
 * Provides export functionality for:
 * - CSV (single file with all records)
 * - JSON (structured data with metadata)
 * - Excel (.xlsx) with multiple tabs (one per set or view)
 *
 * Uses SheetJS (XLSX) library for Excel export when available.
 */

// ============================================================================
// CSV Exporter
// ============================================================================

class CSVExporter {
  /**
   * Export records to CSV format
   * @param {Object} options - Export options
   * @param {string} options.name - Base filename
   * @param {Array} options.fields - Field definitions
   * @param {Array} options.records - Records to export
   * @param {string} [options.delimiter=','] - CSV delimiter
   * @returns {Blob} CSV file as Blob
   */
  static export(options) {
    const { name, fields, records, delimiter = ',' } = options;

    // Build header row
    const headers = fields.map(f => CSVExporter.escapeCSV(f.name, delimiter));

    // Build data rows
    const rows = records.map(record => {
      return fields.map(field => {
        const value = record.values?.[field.id] ?? '';
        return CSVExporter.formatValue(value, field, delimiter);
      });
    });

    // Combine into CSV string
    const csvContent = [
      headers.join(delimiter),
      ...rows.map(row => row.join(delimiter))
    ].join('\n');

    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Escape a value for CSV
   */
  static escapeCSV(value, delimiter = ',') {
    if (value == null) return '';
    const str = String(value);

    // Check if escaping is needed
    const needsEscape = str.includes(delimiter) ||
                        str.includes('"') ||
                        str.includes('\n') ||
                        str.includes('\r');

    if (needsEscape) {
      // Escape double quotes by doubling them
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * Format a field value for CSV export
   */
  static formatValue(value, field, delimiter) {
    if (value == null || value === '') return '';

    switch (field.type) {
      case 'MULTI_SELECT':
        // Join array values
        if (Array.isArray(value)) {
          return CSVExporter.escapeCSV(value.join('; '), delimiter);
        }
        return CSVExporter.escapeCSV(value, delimiter);

      case 'CHECKBOX':
        return value ? 'true' : 'false';

      case 'DATE':
        // Format date if it's a Date object or ISO string
        if (value instanceof Date) {
          return value.toISOString().split('T')[0];
        }
        return CSVExporter.escapeCSV(value, delimiter);

      case 'ATTACHMENT':
      case 'JSON':
        // Serialize complex objects
        if (typeof value === 'object') {
          return CSVExporter.escapeCSV(JSON.stringify(value), delimiter);
        }
        return CSVExporter.escapeCSV(value, delimiter);

      case 'NUMBER':
        // Keep numbers as-is
        return String(value);

      default:
        return CSVExporter.escapeCSV(value, delimiter);
    }
  }
}


// ============================================================================
// JSON Exporter
// ============================================================================

class JSONExporter {
  /**
   * Export records to JSON format
   * @param {Object} options - Export options
   * @param {string} options.name - Set name
   * @param {Array} options.fields - Field definitions
   * @param {Array} options.records - Records to export
   * @param {boolean} [options.pretty=true] - Pretty print JSON
   * @param {boolean} [options.includeMetadata=true] - Include export metadata
   * @returns {Blob} JSON file as Blob
   */
  static export(options) {
    const {
      name,
      fields,
      records,
      pretty = true,
      includeMetadata = true
    } = options;

    const exportData = {
      setName: name,
      fields: fields.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        options: f.options || {}
      })),
      records: records.map(r => ({
        id: r.id,
        values: r.values,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      }))
    };

    if (includeMetadata) {
      exportData.exportedAt = new Date().toISOString();
      exportData.recordCount = records.length;
      exportData.fieldCount = fields.length;
    }

    const json = pretty
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);

    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Export multiple sets to a single JSON file
   */
  static exportMultipleSets(sets, options = {}) {
    const { pretty = true } = options;

    const exportData = {
      exportedAt: new Date().toISOString(),
      setCount: sets.length,
      sets: sets.map(set => ({
        name: set.name,
        id: set.id,
        icon: set.icon,
        fields: set.fields.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          options: f.options || {}
        })),
        records: set.records.map(r => ({
          id: r.id,
          values: r.values,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
        })),
        recordCount: set.records.length
      }))
    };

    const json = pretty
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);

    return new Blob([json], { type: 'application/json' });
  }
}


// ============================================================================
// EO-Aware Exporter (exports with semantic and interpretation metadata)
// ============================================================================

class EOAwareExporter {
  /**
   * Export a dataset with full EO-aware metadata
   *
   * Produces the gold-standard EO-Aware JSON format:
   * - dataset: { id, source, ingested_at, data[] }
   * - schema_semantics: [ SchemaSemantic[] ]
   * - interpretation: { InterpretationBinding }
   *
   * @param {Object} options - Export options
   * @param {string} options.datasetId - Dataset/source ID
   * @param {string} options.name - Dataset name
   * @param {Array} options.fields - Field definitions
   * @param {Array} options.records - Records to export
   * @param {boolean} [options.pretty=true] - Pretty print JSON
   * @returns {Blob} EO-Aware JSON file as Blob
   */
  static async export(options) {
    const {
      datasetId,
      name,
      fields,
      records,
      pretty = true
    } = options;

    // Get interpretation binding for this dataset
    const bindingStore = window.EOInterpretationBinding?.getBindingStore();
    const binding = bindingStore?.getActiveForDataset(datasetId);

    // Collect schema semantics referenced by the binding
    const schemaSemantics = [];
    const semanticRegistry = window.EOSchemaSemantic?.getSemanticRegistry();

    if (binding && semanticRegistry) {
      const seenUris = new Set();
      for (const b of binding.bindings) {
        if (!seenUris.has(b.semantic_uri)) {
          const semantic = semanticRegistry.get(b.semantic_uri);
          if (semantic) {
            schemaSemantics.push(semantic.toJSON());
          }
          seenUris.add(b.semantic_uri);
        }
      }
    }

    // Build export data structure
    const exportData = {
      dataset: {
        id: datasetId || `ds_${Date.now().toString(36)}`,
        source: name,
        ingested_at: new Date().toISOString(),
        data: records.map(r => {
          const row = {};
          fields.forEach(field => {
            row[field.name] = r.values?.[field.id] ?? r[field.name] ?? '';
          });
          return row;
        })
      },
      schema_semantics: schemaSemantics,
      interpretation: binding ? {
        id: binding.id,
        agent: binding.agent,
        method: binding.method,
        bindings: binding.bindings.map(b => ({
          column: b.column,
          semantic_uri: b.semantic_uri,
          confidence: b.confidence
        })),
        jurisdiction: binding.jurisdiction,
        scale: binding.scale,
        timeframe: binding.timeframe,
        background: binding.background
      } : null
    };

    const json = pretty
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);

    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Export only schema semantics (for sharing semantic definitions)
   */
  static exportSemantics(semantics, options = {}) {
    const { pretty = true } = options;

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      count: semantics.length,
      schema_semantics: semantics.map(s =>
        typeof s.toJSON === 'function' ? s.toJSON() : s
      )
    };

    const json = pretty
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);

    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Export only interpretation bindings (for sharing interpretations)
   */
  static exportInterpretations(bindings, options = {}) {
    const { pretty = true } = options;

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      count: bindings.length,
      interpretations: bindings.map(b =>
        typeof b.toJSON === 'function' ? b.toJSON() : b
      )
    };

    const json = pretty
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);

    return new Blob([json], { type: 'application/json' });
  }
}


// ============================================================================
// Excel Exporter (using SheetJS/xlsx library)
// ============================================================================

class ExcelExporter {
  /**
   * Check if XLSX library is available
   */
  static isAvailable() {
    return typeof XLSX !== 'undefined';
  }

  /**
   * Export a single set to Excel
   * @param {Object} options - Export options
   * @param {string} options.name - Sheet name / filename
   * @param {Array} options.fields - Field definitions
   * @param {Array} options.records - Records to export
   * @returns {Blob} Excel file as Blob
   */
  static export(options) {
    if (!ExcelExporter.isAvailable()) {
      throw new Error('Excel export requires the SheetJS library. Please include xlsx.min.js');
    }

    const { name, fields, records } = options;

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Create worksheet data
    const wsData = ExcelExporter.buildWorksheetData(fields, records);

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths based on content
    ws['!cols'] = ExcelExporter.calculateColumnWidths(wsData, fields);

    // Add worksheet to workbook
    const sheetName = ExcelExporter.sanitizeSheetName(name);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Generate Excel file
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    return new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  /**
   * Export multiple sets to Excel with multiple tabs
   * @param {Array} sets - Array of sets to export
   * @param {Object} options - Export options
   * @returns {Blob} Excel file as Blob
   */
  static exportMultipleSets(sets, options = {}) {
    if (!ExcelExporter.isAvailable()) {
      throw new Error('Excel export requires the SheetJS library. Please include xlsx.min.js');
    }

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Track used sheet names to avoid duplicates
    const usedNames = new Set();

    // Add each set as a separate sheet
    for (const set of sets) {
      // Create worksheet data
      const wsData = ExcelExporter.buildWorksheetData(set.fields, set.records);

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      ws['!cols'] = ExcelExporter.calculateColumnWidths(wsData, set.fields);

      // Get unique sheet name
      let sheetName = ExcelExporter.sanitizeSheetName(set.name);
      let counter = 1;
      while (usedNames.has(sheetName)) {
        sheetName = ExcelExporter.sanitizeSheetName(`${set.name} (${counter})`);
        counter++;
      }
      usedNames.add(sheetName);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // Generate Excel file
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    return new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  /**
   * Build worksheet data array from fields and records
   */
  static buildWorksheetData(fields, records) {
    // Header row
    const headers = fields.map(f => f.name);

    // Data rows
    const rows = records.map(record => {
      return fields.map(field => {
        const value = record.values?.[field.id];
        return ExcelExporter.formatValueForExcel(value, field);
      });
    });

    return [headers, ...rows];
  }

  /**
   * Format a value for Excel export
   */
  static formatValueForExcel(value, field) {
    if (value == null || value === '') return '';

    switch (field.type) {
      case 'MULTI_SELECT':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return value;

      case 'CHECKBOX':
        return value ? 'Yes' : 'No';

      case 'DATE':
        // Return as Date object for Excel date formatting
        if (value instanceof Date) {
          return value;
        }
        if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
          return new Date(value);
        }
        return value;

      case 'NUMBER':
        // Return as number for Excel number formatting
        const num = parseFloat(value);
        return isNaN(num) ? value : num;

      case 'ATTACHMENT':
      case 'JSON':
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return value;

      default:
        return String(value);
    }
  }

  /**
   * Sanitize sheet name for Excel (max 31 chars, no special chars)
   */
  static sanitizeSheetName(name) {
    if (!name) return 'Sheet1';

    // Remove invalid characters: \ / ? * [ ] :
    let sanitized = name.replace(/[\\/?*[\]:]/g, '_');

    // Truncate to 31 characters (Excel limit)
    if (sanitized.length > 31) {
      sanitized = sanitized.substring(0, 31);
    }

    // Ensure not empty
    return sanitized || 'Sheet1';
  }

  /**
   * Calculate column widths based on content
   */
  static calculateColumnWidths(data, fields) {
    const cols = [];
    const numCols = fields.length;

    for (let i = 0; i < numCols; i++) {
      let maxWidth = 10; // Minimum width

      // Check header length
      if (data[0] && data[0][i]) {
        maxWidth = Math.max(maxWidth, String(data[0][i]).length);
      }

      // Check data values (sample first 100 rows)
      for (let j = 1; j < Math.min(data.length, 100); j++) {
        if (data[j] && data[j][i] != null) {
          const len = String(data[j][i]).length;
          maxWidth = Math.max(maxWidth, Math.min(len, 50)); // Cap at 50
        }
      }

      cols.push({ wch: maxWidth + 2 }); // Add padding
    }

    return cols;
  }
}


// ============================================================================
// Export Format Selection Dialog
// ============================================================================

/**
 * Show export format selection dialog
 * @param {Object} options - Dialog options
 * @param {string} options.name - Default filename
 * @param {Array} options.fields - Field definitions
 * @param {Array} options.records - Records to export
 * @param {Array} [options.allSets] - All sets (for multi-tab Excel export)
 * @param {Function} [options.onExport] - Callback after export
 */
function showExportDialog(options) {
  const { name, fields, records, allSets, onExport } = options;

  const modal = document.getElementById('modal-overlay');
  const modalTitle = modal?.querySelector('.modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  if (!modal || !modalBody) {
    console.error('Modal elements not found');
    return;
  }

  modalTitle.textContent = 'Export Data';

  const excelAvailable = ExcelExporter.isAvailable();
  const hasMultipleSets = allSets && allSets.length > 1;

  modalBody.innerHTML = `
    <div class="export-container">
      <div class="export-info">
        <i class="ph ph-export"></i>
        <span>${records.length} record${records.length !== 1 ? 's' : ''} selected for export</span>
      </div>

      <div class="form-group">
        <label class="form-label">Export Format</label>
        <div class="export-format-options">
          <label class="export-format-option">
            <input type="radio" name="export-format" value="csv" checked>
            <div class="format-card">
              <i class="ph ph-file-csv"></i>
              <div class="format-info">
                <span class="format-name">CSV</span>
                <span class="format-desc">Comma-separated values, opens in any spreadsheet</span>
              </div>
            </div>
          </label>

          <label class="export-format-option">
            <input type="radio" name="export-format" value="json">
            <div class="format-card">
              <i class="ph ph-file-code"></i>
              <div class="format-info">
                <span class="format-name">JSON</span>
                <span class="format-desc">Structured data with full field metadata</span>
              </div>
            </div>
          </label>

          <label class="export-format-option ${!excelAvailable ? 'disabled' : ''}">
            <input type="radio" name="export-format" value="xlsx" ${!excelAvailable ? 'disabled' : ''}>
            <div class="format-card">
              <i class="ph ph-file-xls"></i>
              <div class="format-info">
                <span class="format-name">Excel</span>
                <span class="format-desc">${excelAvailable ? 'Excel workbook with formatted columns' : 'Requires SheetJS library'}</span>
              </div>
            </div>
          </label>
        </div>
      </div>

      ${hasMultipleSets && excelAvailable ? `
      <div class="form-group" id="excel-options" style="display: none;">
        <label class="form-label">Excel Options</label>
        <label class="checkbox-label">
          <input type="checkbox" id="export-all-sets">
          <span>Export all ${allSets.length} sets as separate tabs</span>
        </label>
      </div>
      ` : ''}

      <div class="form-group">
        <label class="form-label">Filename</label>
        <input type="text" class="form-input" id="export-filename"
               value="${name || 'export'}" placeholder="Enter filename">
      </div>
    </div>
  `;

  modalFooter.innerHTML = `
    <button class="btn btn-secondary" id="export-cancel">Cancel</button>
    <button class="btn btn-primary" id="export-confirm">
      <i class="ph ph-export"></i> Export
    </button>
  `;

  // Show modal
  modal.classList.add('active');

  // Get elements
  const formatOptions = modalBody.querySelectorAll('input[name="export-format"]');
  const excelOptionsDiv = document.getElementById('excel-options');
  const allSetsCheckbox = document.getElementById('export-all-sets');
  const filenameInput = document.getElementById('export-filename');
  const cancelBtn = document.getElementById('export-cancel');
  const confirmBtn = document.getElementById('export-confirm');

  // Show/hide Excel options based on format selection
  formatOptions.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (excelOptionsDiv) {
        excelOptionsDiv.style.display = e.target.value === 'xlsx' ? 'block' : 'none';
      }
    });
  });

  // Close modal handler
  const closeModal = () => {
    modal.classList.remove('active');
  };

  // Cancel button
  cancelBtn.addEventListener('click', closeModal);

  // Confirm button
  confirmBtn.addEventListener('click', () => {
    const format = document.querySelector('input[name="export-format"]:checked').value;
    const filename = filenameInput.value.trim() || 'export';
    const exportAllSets = allSetsCheckbox?.checked && format === 'xlsx';

    try {
      let blob;
      let fullFilename;

      switch (format) {
        case 'csv':
          blob = CSVExporter.export({ name, fields, records });
          fullFilename = `${filename}.csv`;
          break;

        case 'json':
          if (exportAllSets && allSets) {
            blob = JSONExporter.exportMultipleSets(allSets);
          } else {
            blob = JSONExporter.export({ name, fields, records });
          }
          fullFilename = `${filename}.json`;
          break;

        case 'xlsx':
          if (exportAllSets && allSets) {
            blob = ExcelExporter.exportMultipleSets(allSets);
          } else {
            blob = ExcelExporter.export({ name, fields, records });
          }
          fullFilename = `${filename}.xlsx`;
          break;

        default:
          throw new Error(`Unknown format: ${format}`);
      }

      // Download file
      downloadBlob(blob, fullFilename);

      // Close modal
      closeModal();

      // Callback
      if (onExport) {
        onExport({ format, filename: fullFilename, recordCount: records.length });
      }

    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error.message}`);
    }
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}


/**
 * Download a blob as a file
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


/**
 * Quick export without dialog (for programmatic use)
 */
function quickExport(format, options) {
  const { name, fields, records, allSets } = options;

  let blob;
  let filename;
  const baseName = name || 'export';
  const dateStr = new Date().toISOString().split('T')[0];

  switch (format) {
    case 'csv':
      blob = CSVExporter.export({ name, fields, records });
      filename = `${baseName}_${dateStr}.csv`;
      break;

    case 'json':
      if (allSets) {
        blob = JSONExporter.exportMultipleSets(allSets);
      } else {
        blob = JSONExporter.export({ name, fields, records });
      }
      filename = `${baseName}_${dateStr}.json`;
      break;

    case 'xlsx':
      if (allSets) {
        blob = ExcelExporter.exportMultipleSets(allSets);
      } else {
        blob = ExcelExporter.export({ name, fields, records });
      }
      filename = `${baseName}_${dateStr}.xlsx`;
      break;

    default:
      throw new Error(`Unknown format: ${format}`);
  }

  downloadBlob(blob, filename);
  return { filename, size: blob.size };
}


// ============================================================================
// Export Styles (injected into page)
// ============================================================================

const exportStyles = document.createElement('style');
exportStyles.textContent = `
  .export-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .export-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--bg-secondary, #f5f5f5);
    border-radius: 8px;
    font-size: 14px;
  }

  .export-info i {
    font-size: 20px;
    color: var(--primary, #0066cc);
  }

  .export-format-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .export-format-option {
    cursor: pointer;
  }

  .export-format-option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .export-format-option input {
    display: none;
  }

  .export-format-option .format-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 2px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .export-format-option:hover .format-card {
    border-color: var(--primary, #0066cc);
    background: var(--bg-hover, #f8f8f8);
  }

  .export-format-option input:checked + .format-card {
    border-color: var(--primary, #0066cc);
    background: var(--primary-light, #e6f0ff);
  }

  .export-format-option.disabled:hover .format-card {
    border-color: var(--border-color, #e0e0e0);
    background: transparent;
  }

  .format-card i {
    font-size: 28px;
    color: var(--primary, #0066cc);
  }

  .format-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .format-name {
    font-weight: 600;
    font-size: 14px;
  }

  .format-desc {
    font-size: 12px;
    color: var(--text-muted, #888);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
  }

  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
  }
`;
document.head.appendChild(exportStyles);


// ============================================================================
// Module Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CSVExporter,
    JSONExporter,
    EOAwareExporter,
    ExcelExporter,
    showExportDialog,
    quickExport,
    downloadBlob
  };
}

if (typeof window !== 'undefined') {
  window.CSVExporter = CSVExporter;
  window.JSONExporter = JSONExporter;
  window.EOAwareExporter = EOAwareExporter;
  window.ExcelExporter = ExcelExporter;
  window.showExportDialog = showExportDialog;
  window.quickExport = quickExport;
  window.downloadBlob = downloadBlob;
}
