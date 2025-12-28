/**
 * EO Import System - CSV, JSON, Excel, and ICS Import with Schema Inference
 *
 * Features:
 * - CSV parsing with auto-delimiter detection
 * - JSON parsing with structure normalization
 * - Graph data detection (nodes/edges pattern)
 * - Excel (.xlsx) support with multiple sheets
 * - ICS (iCalendar) parsing for calendar events
 * - Schema inference with field type detection
 * - EO 9-element provenance collection
 * - View creation from field values (split by type)
 * - Original source preservation
 * - Progress events for real-time UI updates
 */

// ============================================================================
// ICS Parser (iCalendar Format)
// ============================================================================

/**
 * Parse ICS (iCalendar) files - commonly exported from Google Calendar, Outlook, etc.
 *
 * ICS Format Reference: RFC 5545
 * https://tools.ietf.org/html/rfc5545
 */
class ICSParser {
  constructor() {
    // Standard iCalendar date formats
    this.datePatterns = {
      // Full datetime with timezone: 20231215T100000Z
      utc: /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
      // Local datetime: 20231215T100000
      local: /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
      // Date only: 20231215
      dateOnly: /^(\d{4})(\d{2})(\d{2})$/
    };
  }

  /**
   * Parse ICS text into calendar events
   * @param {string} text - Raw ICS file content
   * @returns {{ headers: string[], rows: object[], calendarInfo: object }}
   */
  parse(text) {
    // Normalize line endings and unfold long lines (RFC 5545 line folding)
    text = this._unfoldLines(text);

    const events = [];
    const calendarInfo = this._parseCalendarInfo(text);

    // Extract all VEVENT blocks
    const eventBlocks = this._extractBlocks(text, 'VEVENT');

    for (const block of eventBlocks) {
      const event = this._parseEvent(block);
      if (event) {
        events.push(event);
      }
    }

    // Define standard headers for calendar events
    const headers = [
      'Summary',
      'Start',
      'End',
      'Location',
      'Description',
      'Status',
      'Organizer',
      'Attendees',
      'Categories',
      'UID',
      'Created',
      'LastModified',
      'AllDay',
      'Recurring'
    ];

    // Convert events to row format
    const rows = events.map(event => ({
      'Summary': event.summary || '',
      'Start': event.start || '',
      'End': event.end || '',
      'Location': event.location || '',
      'Description': event.description || '',
      'Status': event.status || '',
      'Organizer': event.organizer || '',
      'Attendees': event.attendees?.join(', ') || '',
      'Categories': event.categories?.join(', ') || '',
      'UID': event.uid || '',
      'Created': event.created || '',
      'LastModified': event.lastModified || '',
      'AllDay': event.allDay ? 'Yes' : 'No',
      'Recurring': event.recurring ? 'Yes' : 'No'
    }));

    return {
      headers,
      rows,
      hasHeaders: true,
      totalRows: rows.length,
      calendarInfo,
      fileType: 'ics'
    };
  }

  /**
   * Unfold ICS lines (lines can be folded by inserting CRLF + space/tab)
   */
  _unfoldLines(text) {
    // Normalize all line endings to \n
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Unfold: remove newline followed by space or tab
    text = text.replace(/\n[ \t]/g, '');
    return text;
  }

  /**
   * Extract calendar-level information
   */
  _parseCalendarInfo(text) {
    const info = {
      version: this._extractProperty(text, 'VERSION'),
      prodId: this._extractProperty(text, 'PRODID'),
      calendarName: this._extractProperty(text, 'X-WR-CALNAME'),
      timezone: this._extractProperty(text, 'X-WR-TIMEZONE')
    };
    return info;
  }

  /**
   * Extract all blocks of a given type (e.g., VEVENT, VTODO)
   */
  _extractBlocks(text, blockType) {
    const blocks = [];
    const startMarker = `BEGIN:${blockType}`;
    const endMarker = `END:${blockType}`;

    let searchStart = 0;
    while (true) {
      const blockStart = text.indexOf(startMarker, searchStart);
      if (blockStart === -1) break;

      const blockEnd = text.indexOf(endMarker, blockStart);
      if (blockEnd === -1) break;

      const blockContent = text.substring(blockStart + startMarker.length, blockEnd);
      blocks.push(blockContent);

      searchStart = blockEnd + endMarker.length;
    }

    return blocks;
  }

  /**
   * Parse a single VEVENT block
   */
  _parseEvent(block) {
    const event = {};

    // Basic properties
    event.summary = this._extractProperty(block, 'SUMMARY');
    event.description = this._unescapeText(this._extractProperty(block, 'DESCRIPTION'));
    event.location = this._extractProperty(block, 'LOCATION');
    event.uid = this._extractProperty(block, 'UID');
    event.status = this._extractProperty(block, 'STATUS');

    // Dates
    const dtstart = this._extractPropertyWithParams(block, 'DTSTART');
    const dtend = this._extractPropertyWithParams(block, 'DTEND');

    event.start = this._parseDate(dtstart.value, dtstart.params);
    event.end = this._parseDate(dtend.value, dtend.params);
    event.allDay = dtstart.params?.VALUE === 'DATE' || (!dtstart.value?.includes('T'));

    // Timestamps
    event.created = this._parseDate(this._extractProperty(block, 'CREATED'));
    event.lastModified = this._parseDate(this._extractProperty(block, 'DTSTAMP') ||
                                          this._extractProperty(block, 'LAST-MODIFIED'));

    // Organizer (extract email from MAILTO:)
    const organizer = this._extractProperty(block, 'ORGANIZER');
    if (organizer) {
      event.organizer = this._extractEmail(organizer);
    }

    // Attendees (can have multiple)
    event.attendees = this._extractAllProperties(block, 'ATTENDEE')
      .map(a => this._extractEmail(a))
      .filter(a => a);

    // Categories
    const categories = this._extractProperty(block, 'CATEGORIES');
    if (categories) {
      event.categories = categories.split(',').map(c => c.trim());
    }

    // Recurrence
    const rrule = this._extractProperty(block, 'RRULE');
    event.recurring = !!rrule;
    if (rrule) {
      event.recurrenceRule = rrule;
    }

    return event;
  }

  /**
   * Extract a single property value
   */
  _extractProperty(text, propertyName) {
    const regex = new RegExp(`^${propertyName}(?:;[^:]*)?:(.*)$`, 'mi');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Extract property with its parameters
   */
  _extractPropertyWithParams(text, propertyName) {
    const regex = new RegExp(`^${propertyName}(;[^:]*)?:(.*)$`, 'mi');
    const match = text.match(regex);

    if (!match) {
      return { value: null, params: {} };
    }

    const params = {};
    if (match[1]) {
      // Parse parameters like ;VALUE=DATE;TZID=America/New_York
      const paramParts = match[1].substring(1).split(';');
      for (const part of paramParts) {
        const [key, value] = part.split('=');
        if (key && value) {
          params[key.toUpperCase()] = value;
        }
      }
    }

    return {
      value: match[2]?.trim() || null,
      params
    };
  }

  /**
   * Extract all instances of a property (for properties that can appear multiple times)
   */
  _extractAllProperties(text, propertyName) {
    const regex = new RegExp(`^${propertyName}(?:;[^:]*)?:(.*)$`, 'gmi');
    const values = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      values.push(match[1].trim());
    }
    return values;
  }

  /**
   * Parse ICS date/datetime to ISO format
   */
  _parseDate(value, params = {}) {
    if (!value) return null;

    let match;

    // UTC datetime: 20231215T100000Z
    if ((match = value.match(this.datePatterns.utc))) {
      const [, year, month, day, hour, minute, second] = match;
      return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    }

    // Local datetime: 20231215T100000
    if ((match = value.match(this.datePatterns.local))) {
      const [, year, month, day, hour, minute, second] = match;
      const timezone = params.TZID || '';
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    }

    // Date only: 20231215
    if ((match = value.match(this.datePatterns.dateOnly))) {
      const [, year, month, day] = match;
      return `${year}-${month}-${day}`;
    }

    return value; // Return as-is if can't parse
  }

  /**
   * Extract email from MAILTO: URI or CN parameter
   */
  _extractEmail(value) {
    if (!value) return null;

    // Try MAILTO: format
    const mailtoMatch = value.match(/mailto:([^\s;]+)/i);
    if (mailtoMatch) {
      return mailtoMatch[1].toLowerCase();
    }

    // Try to find email pattern
    const emailMatch = value.match(/[\w.+-]+@[\w.-]+\.\w+/i);
    if (emailMatch) {
      return emailMatch[0].toLowerCase();
    }

    return value;
  }

  /**
   * Unescape ICS text (handle escaped characters)
   */
  _unescapeText(text) {
    if (!text) return text;
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }
}


// ============================================================================
// CSV Parser
// ============================================================================

/**
 * Parse CSV with intelligent delimiter detection
 * Enhanced with parsing decision tracking for provenance
 */
class CSVParser {
  constructor() {
    this.delimiters = [',', ';', '\t', '|'];
  }

  /**
   * Parse CSV text into records
   * @param {string} text - Raw CSV text
   * @param {Object} options - { delimiter, hasHeaders }
   * @returns {{ headers: string[], rows: object[], delimiter: string, hasHeaders: boolean, parsingDecisions: object }}
   */
  parse(text, options = {}) {
    const startTime = performance.now();

    // Track parsing decisions for provenance
    const parsingDecisions = {
      delimiterDetected: null,
      delimiterConfidence: null,
      delimiterCandidates: [],
      headerDetected: null,
      headerConfidence: null,
      lineEndingNormalized: false,
      quotedFieldsFound: 0,
      sanitizedHeaders: []
    };

    // Normalize line endings
    const originalLineEndings = text.includes('\r\n') ? 'CRLF' : (text.includes('\r') ? 'CR' : 'LF');
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    parsingDecisions.lineEndingNormalized = originalLineEndings !== 'LF';
    parsingDecisions.originalLineEnding = originalLineEndings;

    // Detect delimiter if not specified
    const delimiterResult = this._detectDelimiterWithConfidence(text);
    const delimiter = options.delimiter || delimiterResult.delimiter;
    parsingDecisions.delimiterDetected = delimiter;
    parsingDecisions.delimiterConfidence = delimiterResult.confidence;
    parsingDecisions.delimiterCandidates = delimiterResult.candidates;

    // Parse into lines (handling quoted fields with newlines)
    const parseResult = this._parseLinesWithStats(text, delimiter);
    const lines = parseResult.lines;
    parsingDecisions.quotedFieldsFound = parseResult.quotedFieldCount;

    if (lines.length === 0) {
      return { headers: [], rows: [], delimiter, hasHeaders: false, parsingDecisions };
    }

    // Detect if first row is headers
    const headerResult = this._detectHeadersWithConfidence(lines);
    const hasHeaders = options.hasHeaders !== undefined
      ? options.hasHeaders
      : headerResult.isHeaders;
    parsingDecisions.headerDetected = hasHeaders;
    parsingDecisions.headerConfidence = headerResult.confidence;

    // Extract headers
    const headers = hasHeaders
      ? lines[0].map((h, i) => {
          const sanitized = this._sanitizeHeader(h) || `Column ${i + 1}`;
          if (sanitized !== h) {
            parsingDecisions.sanitizedHeaders.push({ original: h, sanitized, index: i });
          }
          return sanitized;
        })
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

    parsingDecisions.processingTimeMs = Math.round(performance.now() - startTime);

    return {
      headers,
      rows,
      delimiter,
      hasHeaders,
      totalRows: rows.length,
      parsingDecisions
    };
  }

  /**
   * Detect delimiter with confidence score
   */
  _detectDelimiterWithConfidence(text) {
    const firstLines = text.split('\n').slice(0, 10).join('\n');

    const candidates = this.delimiters.map(d => {
      const regex = new RegExp(d === '|' ? '\\|' : d, 'g');
      const matches = firstLines.match(regex) || [];
      return {
        delimiter: d,
        count: matches.length,
        perLine: matches.length / Math.min(10, text.split('\n').length)
      };
    });

    // Sort by count, prefer comma for ties
    candidates.sort((a, b) => {
      if (b.count === a.count) {
        return a.delimiter === ',' ? -1 : 1;
      }
      return b.count - a.count;
    });

    const winner = candidates[0];
    const runnerUp = candidates[1];

    // Calculate confidence based on how much better winner is
    let confidence = 0.5;
    if (winner.count > 0) {
      if (runnerUp.count === 0) {
        confidence = 0.95;
      } else {
        const ratio = winner.count / runnerUp.count;
        confidence = Math.min(0.95, 0.5 + (ratio - 1) * 0.15);
      }
    }

    return {
      delimiter: winner.count > 0 ? winner.delimiter : ',',
      confidence,
      candidates: candidates.slice(0, 3)
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
   * Parse CSV lines handling quoted fields (with stats tracking)
   */
  _parseLinesWithStats(text, delimiter) {
    const lines = [];
    let currentLine = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;
    let quotedFieldCount = 0;

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
            quotedFieldCount++;
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

    return { lines, quotedFieldCount };
  }

  /**
   * Parse CSV lines handling quoted fields (legacy, calls new method)
   */
  _parseLines(text, delimiter) {
    return this._parseLinesWithStats(text, delimiter).lines;
  }

  /**
   * Detect if first row is headers with confidence score
   */
  _detectHeadersWithConfidence(lines) {
    if (lines.length < 2) {
      return { isHeaders: true, confidence: 0.6 };
    }

    const firstRow = lines[0];
    const secondRow = lines[1];

    let score = 0;
    const factors = [];

    // Factor 1: First row has fewer numbers than second row
    const firstRowNumeric = firstRow.filter(v => !isNaN(parseFloat(v)) && v.trim() !== '').length;
    const secondRowNumeric = secondRow.filter(v => !isNaN(parseFloat(v)) && v.trim() !== '').length;

    if (firstRowNumeric < secondRowNumeric) {
      score += 0.3;
      factors.push('fewer_numbers');
    }

    // Factor 2: First row values look like column names (short, no pure numbers, no dates)
    const looksLikeHeaders = firstRow.every(v =>
      v.length < 50 &&
      !/^\d+$/.test(v) &&
      !/^\d{4}-\d{2}-\d{2}/.test(v)
    );

    if (looksLikeHeaders) {
      score += 0.3;
      factors.push('looks_like_headers');
    }

    // Factor 3: First row has unique values (no duplicates)
    const uniqueFirst = new Set(firstRow.map(v => v.toLowerCase()));
    if (uniqueFirst.size === firstRow.length) {
      score += 0.2;
      factors.push('unique_values');
    }

    // Factor 4: No empty values in first row
    if (firstRow.every(v => v.trim() !== '')) {
      score += 0.1;
      factors.push('no_empty');
    }

    // Factor 5: Contains common header words
    const headerWords = /^(id|name|type|date|time|value|count|total|status|email|phone|address|description|title|category|price|amount|url|link)$/i;
    const headerWordCount = firstRow.filter(v => headerWords.test(v.trim())).length;
    if (headerWordCount > 0) {
      score += 0.1 * Math.min(headerWordCount / firstRow.length, 1);
      factors.push('header_words');
    }

    const confidence = Math.min(0.95, 0.4 + score);
    const isHeaders = confidence >= 0.5;

    return { isHeaders, confidence, factors };
  }

  /**
   * Detect if first row is headers (legacy, calls new method)
   */
  _detectHeaders(lines) {
    return this._detectHeadersWithConfidence(lines).isHeaders;
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
 * Enhanced with inference decision tracking for provenance
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
   * @returns {{ fields: object[], inferenceDecisions: object }}
   */
  inferSchema(headers, rows) {
    const startTime = performance.now();

    // Track inference decisions for provenance
    const inferenceDecisions = {
      fieldInferences: {},  // { fieldName: { type, confidence, candidates, sampleSize } }
      ambiguities: [],      // Fields where type was unclear
      dateFormatsDetected: [],
      nullRates: {},        // { fieldName: rate }
      processingTimeMs: null
    };

    const fields = headers.map((header, index) => {
      const allValues = rows.map(row => row[header]);
      const values = allValues.filter(v => v !== '' && v !== null && v !== undefined);
      const typeInfo = this._inferTypeWithDecisions(values, header);

      // Track null rate
      const nullRate = 1 - (values.length / Math.max(allValues.length, 1));
      inferenceDecisions.nullRates[header] = Math.round(nullRate * 100) / 100;

      // Track inference decision
      inferenceDecisions.fieldInferences[header] = {
        type: typeInfo.type,
        confidence: typeInfo.confidence,
        candidates: typeInfo.candidates || [],
        sampleSize: values.length,
        uniqueCount: typeInfo.uniqueCount
      };

      // Track ambiguities
      if (typeInfo.candidates && typeInfo.candidates.length > 1) {
        const topTwo = typeInfo.candidates.slice(0, 2);
        if (topTwo.length === 2 && topTwo[1].ratio > 0.3) {
          inferenceDecisions.ambiguities.push({
            field: header,
            chosen: typeInfo.type,
            alternative: topTwo[1].type,
            alternativeRatio: topTwo[1].ratio
          });
        }
      }

      // Track date formats
      if (typeInfo.type === 'date' && typeInfo.dateFormat) {
        inferenceDecisions.dateFormatsDetected.push({
          field: header,
          format: typeInfo.dateFormat
        });
      }

      return {
        name: header,
        type: typeInfo.type,
        confidence: typeInfo.confidence,
        options: typeInfo.options || {},
        isPrimary: index === 0,
        samples: values.slice(0, 3)
      };
    });

    inferenceDecisions.processingTimeMs = Math.round(performance.now() - startTime);

    return { fields, inferenceDecisions };
  }

  /**
   * Infer type with detailed decision tracking
   */
  _inferTypeWithDecisions(values, fieldName) {
    if (values.length === 0) {
      return { type: 'text', confidence: 0.5, candidates: [] };
    }

    const typeCounts = {
      email: 0,
      url: 0,
      phone: 0,
      date: 0,
      number: 0,
      checkbox: 0,
      longText: 0,
      text: 0
    };

    const uniqueValues = new Set();
    let dateFormat = null;

    for (const value of values) {
      const strValue = String(value).trim();
      uniqueValues.add(strValue.toLowerCase());

      if (this.patterns.email.test(strValue)) {
        typeCounts.email++;
      } else if (this.patterns.url.test(strValue)) {
        typeCounts.url++;
      } else if (this.patterns.phone.test(strValue)) {
        typeCounts.phone++;
      } else if (this.patterns.date.test(strValue)) {
        typeCounts.date++;
        dateFormat = 'ISO';
      } else if (this.patterns.dateAlt.test(strValue)) {
        typeCounts.date++;
        dateFormat = strValue.includes('/') ? 'MM/DD/YYYY' : 'DD-MM-YYYY';
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

    const total = values.length;
    const uniqueCount = uniqueValues.size;

    // Build candidates list sorted by ratio
    const candidates = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count, ratio: count / total }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.ratio - a.ratio);

    const threshold = 0.7;

    // Check for SELECT (low cardinality)
    if (uniqueCount <= 20 && uniqueCount < total * 0.5 && total > 5) {
      const choices = Array.from(uniqueValues).map((name, i) => ({
        id: 'choice_' + Math.random().toString(36).substr(2, 9),
        name: String(name),
        color: ['blue', 'green', 'yellow', 'red', 'purple', 'pink', 'orange', 'gray'][i % 8]
      }));
      return {
        type: 'select',
        confidence: 0.85,
        options: { choices },
        candidates,
        uniqueCount
      };
    }

    // Check other types by ratio
    if (typeCounts.email / total > threshold) {
      return { type: 'email', confidence: typeCounts.email / total, candidates, uniqueCount };
    }
    if (typeCounts.url / total > threshold) {
      return { type: 'url', confidence: typeCounts.url / total, candidates, uniqueCount };
    }
    if (typeCounts.date / total > threshold) {
      return { type: 'date', confidence: typeCounts.date / total, candidates, uniqueCount, dateFormat };
    }
    if (typeCounts.number / total > threshold) {
      return { type: 'number', confidence: typeCounts.number / total, candidates, uniqueCount };
    }
    if (typeCounts.checkbox / total > threshold) {
      return { type: 'checkbox', confidence: typeCounts.checkbox / total, candidates, uniqueCount };
    }
    if (typeCounts.phone / total > threshold) {
      return { type: 'phone', confidence: typeCounts.phone / total, candidates, uniqueCount };
    }
    if (typeCounts.longText / total > 0.3) {
      return { type: 'longText', confidence: typeCounts.longText / total, candidates, uniqueCount };
    }

    // Default to text
    return { type: 'text', confidence: 0.8, candidates, uniqueCount };
  }

  /**
   * Legacy method - calls new method and returns just type info
   */
  _inferType(values, fieldName) {
    const result = this._inferTypeWithDecisions(values, fieldName);
    return {
      type: result.type,
      confidence: result.confidence,
      options: result.options
    };
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
    this.icsParser = new ICSParser();
    this.schemaInferrer = new SchemaInferrer();
  }

  /**
   * Import a file (CSV, JSON, or ICS)
   * @param {File} file - File to import
   * @param {Object} options - Import options
   * @returns {Promise<{ success: boolean, setId: string, recordCount: number }>}
   */
  async import(file, options = {}) {
    const startTime = Date.now();
    const uploadInitiatedAt = new Date().toISOString();

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

      // Capture parse start time
      const parseStartedAt = new Date().toISOString();

      // Determine file type and parse
      const fileName = file.name.toLowerCase();
      const isICS = fileName.endsWith('.ics') || file.type === 'text/calendar';
      const isCSV = fileName.endsWith('.csv') ||
                    file.type === 'text/csv' ||
                    (!isICS && !this._isJSON(text));

      // Determine MIME type
      const mimeType = file.type || (isICS ? 'text/calendar' :
                       isCSV ? 'text/csv' : 'application/json');

      let parseResult;
      if (isICS) {
        parseResult = this.icsParser.parse(text);
      } else if (isCSV) {
        parseResult = this.csvParser.parse(text, options);
      } else {
        parseResult = this._parseJSON(text);
      }

      const parseCompletedAt = new Date().toISOString();

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

      // Enhance options with timing and file metadata
      const enhancedOptions = {
        ...options,
        // File metadata
        originalFileSize: file.size,
        originalFileType: mimeType,
        mimeType: mimeType,
        // Timing data
        uploadInitiatedAt,
        parseStartedAt,
        parseCompletedAt,
        // File timestamps (if available from File API)
        fileModifiedAt: file.lastModified ? new Date(file.lastModified).toISOString() : null
      };

      // Create the set and import records
      const result = await this._createSetWithRecords(setName, schema, parseResult, enhancedOptions);

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

    const fileName = file.name.toLowerCase();
    const isICS = fileName.endsWith('.ics') || file.type === 'text/calendar';
    const isCSV = fileName.endsWith('.csv') ||
                  file.type === 'text/csv' ||
                  (!isICS && !this._isJSON(text));

    let parseResult;
    if (isICS) {
      parseResult = this.icsParser.parse(text);
    } else if (isCSV) {
      parseResult = this.csvParser.parse(text, options);
    } else {
      parseResult = this._parseJSON(text);
    }

    const schema = this.schemaInferrer.inferSchema(parseResult.headers, parseResult.rows);

    return {
      fileName: file.name,
      fileSize: file.size,
      isCSV,
      isICS,
      delimiter: parseResult.delimiter,
      hasHeaders: parseResult.hasHeaders,
      headers: parseResult.headers,
      schema: schema,
      rowCount: parseResult.rows.length,
      sampleRows: parseResult.rows.slice(0, 5),
      calendarInfo: parseResult.calendarInfo || null
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
   * Check if text is valid JSON or JavaScript module syntax
   */
  _isJSON(text) {
    // First, try standard JSON parse
    try {
      JSON.parse(text);
      return true;
    } catch {
      // Not valid JSON, but check if it's JavaScript module syntax
      // which we can also handle
    }

    // Check for JavaScript module syntax (const/let/var declarations with arrays/objects)
    const hasJSModuleSyntax = /^\s*(const|let|var)\s+\w+\s*=\s*[\[\{]/m.test(text);
    if (hasJSModuleSyntax) {
      return true;
    }

    // Check for export statements with data
    const hasExportWithData = /^\s*export\s+(const|let|var|default)\s+/m.test(text);
    if (hasExportWithData) {
      return true;
    }

    return false;
  }

  /**
   * Convert JavaScript module syntax to JSON-parseable format
   * Handles: const nodes = [...], export { ... }, etc.
   */
  _convertJSModuleToJSON(text) {
    // Check if this looks like JS module syntax
    const hasConstDeclaration = /^\s*(const|let|var)\s+\w+\s*=/m.test(text);
    const hasExport = /^\s*export\s+/m.test(text);

    if (!hasConstDeclaration && !hasExport) {
      return null; // Not JS module syntax, return null to try regular JSON parse
    }

    // Extract variable assignments
    const result = {};

    // Pattern to match: const/let/var varName = <value>
    // This handles arrays and objects spanning multiple lines
    const varPattern = /(?:const|let|var)\s+(\w+)\s*=\s*/g;
    let match;
    const varPositions = [];

    while ((match = varPattern.exec(text)) !== null) {
      varPositions.push({
        name: match[1],
        start: match.index + match[0].length
      });
    }

    // For each variable, extract its value
    for (let i = 0; i < varPositions.length; i++) {
      const varInfo = varPositions[i];
      const startPos = varInfo.start;

      // Find the end of this value (next const/let/var or export or end)
      let endSearchPos = i < varPositions.length - 1
        ? text.lastIndexOf(';', varPositions[i + 1].start)
        : text.length;

      // Extract the value portion
      let valueText = text.substring(startPos, endSearchPos);

      // Remove trailing export statement if present
      const exportIndex = valueText.search(/\n\s*export\s+/);
      if (exportIndex !== -1) {
        valueText = valueText.substring(0, exportIndex);
      }

      // Clean up: remove trailing semicolons and whitespace
      valueText = valueText.replace(/;\s*$/, '').trim();

      // Try to find the balanced end of the array/object
      const firstChar = valueText[0];
      if (firstChar === '[' || firstChar === '{') {
        const closingChar = firstChar === '[' ? ']' : '}';
        let depth = 0;
        let inString = false;
        let stringChar = null;
        let endPos = 0;

        for (let j = 0; j < valueText.length; j++) {
          const char = valueText[j];
          const prevChar = j > 0 ? valueText[j - 1] : '';

          if (inString) {
            if (char === stringChar && prevChar !== '\\') {
              inString = false;
            }
          } else {
            if (char === '"' || char === "'" || char === '`') {
              inString = true;
              stringChar = char;
            } else if (char === firstChar) {
              depth++;
            } else if (char === closingChar) {
              depth--;
              if (depth === 0) {
                endPos = j + 1;
                break;
              }
            }
          }
        }

        if (endPos > 0) {
          valueText = valueText.substring(0, endPos);
        }
      }

      // Convert JS object syntax to JSON:
      // - Unquoted property names: { id: "value" } -> { "id": "value" }
      // - Single quotes to double quotes (but be careful with nested quotes)
      let jsonText = valueText;

      // Replace unquoted property names (simple approach for common patterns)
      // Match: word followed by colon, not inside a string
      jsonText = jsonText.replace(/(\{|\,)\s*(\w+)\s*:/g, '$1"$2":');

      // Handle single-quoted strings (convert to double quotes)
      // This is a simplified conversion - works for most cases
      jsonText = jsonText.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"');

      try {
        result[varInfo.name] = JSON.parse(jsonText);
      } catch (e) {
        // If JSON parse fails, try a more lenient approach using Function constructor
        try {
          // Safe evaluation for data literals only
          const fn = new Function('return ' + valueText);
          result[varInfo.name] = fn();
        } catch (e2) {
          console.warn(`Failed to parse variable ${varInfo.name}:`, e2.message);
        }
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Parse JSON into normalized format
   */
  _parseJSON(text) {
    // First, try to handle JavaScript module syntax
    const jsModuleData = this._convertJSModuleToJSON(text);

    let data;
    if (jsModuleData) {
      // JS module with nodes/edges arrays (graph data)
      if (jsModuleData.nodes && Array.isArray(jsModuleData.nodes)) {
        // This is graph data - return nodes as records
        // Each node should have its properties flattened
        const nodes = jsModuleData.nodes.map(node => {
          const record = {
            id: node.id,
            type: node.type,
            ...node.properties
          };
          // Only include subtype if defined
          if (node.subtype) {
            record.subtype = node.subtype;
          }
          return record;
        });
        data = nodes;
      } else {
        // Check for other common array variable names
        const arrayVars = Object.keys(jsModuleData).filter(k => Array.isArray(jsModuleData[k]));
        if (arrayVars.length > 0) {
          // Use the first array found
          data = jsModuleData[arrayVars[0]];
        } else {
          data = jsModuleData;
        }
      }
    } else {
      data = JSON.parse(text);
    }

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
   * Create set with records in batches (Enhanced with nested provenance)
   */
  async _createSetWithRecords(setName, schema, parseResult, options = {}) {
    const BATCH_SIZE = 100;
    const { headers, rows } = parseResult;
    const viewsCreated = [];
    const now = new Date().toISOString();

    // Create the set
    const set = createSet(setName);

    // Build comprehensive nested provenance structure
    const userProvenance = options.provenance || {};

    // Collect transformation log steps
    const transformationLog = [];

    // Step 1: Parse step (from parser decisions)
    if (parseResult.parsingDecisions) {
      transformationLog.push({
        step: 1,
        operation: 'PARSE',
        processor: parseResult.fileType === 'ics' ? 'ICSParser' :
                   parseResult.delimiter ? 'CSVParser' : 'JSONParser',
        decisions: parseResult.parsingDecisions,
        timestamp: options.parseStartedAt || now
      });
    }

    // Step 2: Schema inference step
    if (schema.inferenceDecisions) {
      transformationLog.push({
        step: 2,
        operation: 'INFER_SCHEMA',
        processor: 'SchemaInferrer',
        decisions: schema.inferenceDecisions,
        timestamp: now
      });
    }

    // Step 3: View creation step (populated below if views are created)
    // Will be added after view creation

    // Build quality audit from inference decisions
    const qualityAudit = schema.inferenceDecisions ? {
      validation: {
        schemaConformance: null,  // Calculated during import
        nullRates: schema.inferenceDecisions.nullRates || {},
        typeCoercionCount: 0,
        truncatedValues: 0
      },
      warnings: schema.inferenceDecisions.ambiguities?.map(a => ({
        code: 'AMBIGUOUS_TYPE',
        field: a.field,
        message: `Type "${a.chosen}" chosen over "${a.alternative}" (${Math.round(a.alternativeRatio * 100)}% match)`,
        affectedRecords: []
      })) || [],
      errors: [],
      completeness: {
        expectedRecords: rows.length,
        importedRecords: 0,  // Updated during import
        skippedRecords: 0,
        skippedReason: null
      }
    } : null;

    // Build file identity from options
    const fileIdentity = {
      contentHash: options.contentHash || null,
      rawSize: options.originalFileSize || (options.originalSource?.length) || null,
      encoding: options.encoding || 'utf-8',
      mimeType: options.mimeType || null
    };

    // Build schema mapping from inference
    const schemaMapping = schema.inferenceDecisions ? {
      inferredTypes: schema.inferenceDecisions.fieldInferences || {},
      fieldSemantics: {},  // Could be enhanced with semantic detection
      ontologyLinks: []
    } : null;

    // Build parser interpretation
    const parserInterpretation = parseResult.parsingDecisions ? {
      delimiter: parseResult.parsingDecisions.delimiterDetected || parseResult.delimiter || null,
      quoteChar: '"',
      escapeChar: '\\',
      nullRepresentation: ['', 'null', 'NULL', 'N/A', 'n/a'],
      dateFormats: schema.inferenceDecisions?.dateFormatsDetected || [],
      numberFormats: {}
    } : null;

    // Build import scope
    const importScope = {
      recordCount: rows.length,
      fieldCount: headers.length,
      fileCount: 1,
      sheetCount: options.sheetCount || null,
      totalBytes: options.originalFileSize || null
    };

    // Build temporal chain
    const temporalChain = {
      fileCreatedAt: options.fileCreatedAt || null,
      fileModifiedAt: options.fileModifiedAt || null,
      uploadInitiatedAt: options.uploadInitiatedAt || now,
      parseStartedAt: options.parseStartedAt || null,
      parseCompletedAt: options.parseCompletedAt || now,
      commitCompletedAt: null  // Set after commit
    };

    // Build import context
    const importContext = {
      previousVersionHash: options.previousVersionHash || null,
      supersedes: options.supersedes || null,
      retryCount: options.retryCount || 0,
      importMode: options.importMode || 'create',
      triggeredBy: options.triggeredBy || 'user'
    };

    // Build upload context
    const uploadContext = {
      userId: options.userId || null,
      sessionId: options.sessionId || null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      ipAddress: null  // Not captured client-side
    };

    // Construct the full nested provenance structure
    set.datasetProvenance = {
      // Top-level metadata (backwards compatible)
      importedAt: now,
      importedBy: options.importedBy || null,
      originalFilename: options.setName || setName,
      originalFileSize: options.originalFileSize || null,
      originalFileType: options.originalFileType || null,
      originalSource: options.originalSource || null,

      // EO 9-element provenance with nested upload metadata
      provenance: {
        // EPISTEMIC TRIAD
        agent: {
          value: userProvenance.agent || null,
          uploadContext: uploadContext
        },
        method: {
          value: userProvenance.method || null,
          transformationLog: transformationLog,
          qualityAudit: qualityAudit
        },
        source: {
          value: userProvenance.source || null,
          fileIdentity: fileIdentity,
          originVerification: options.originVerification || null,
          mergeManifest: options.mergeManifest || null
        },

        // SEMANTIC TRIAD
        term: {
          value: userProvenance.term || null,
          schemaMapping: schemaMapping
        },
        definition: {
          value: userProvenance.definition || null,
          parserInterpretation: parserInterpretation
        },
        jurisdiction: {
          value: userProvenance.jurisdiction || null,
          domainAuthority: options.domainAuthority || null
        },

        // SITUATIONAL TRIAD
        scale: {
          value: userProvenance.scale || null,
          importScope: importScope
        },
        timeframe: {
          value: userProvenance.timeframe || null,
          temporalChain: temporalChain
        },
        background: {
          value: userProvenance.background || null,
          importContext: importContext
        }
      }
    };

    // Replace default fields with inferred ones
    set.fields = schema.fields.map((field, index) => {
      return createField(field.name, field.type, {
        isPrimary: index === 0,
        ...field.options
      });
    });

    // Find the type field for view creation
    const typeFieldName = options.viewSplitField || 'type';
    const typeField = set.fields.find(f => f.name === typeFieldName);

    // Add records in batches
    let processed = 0;
    const typeValues = new Set();

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        const values = {};
        set.fields.forEach((field) => {
          const header = field.name;
          let value = row[header];
          value = this._convertValue(value, field.type, field.options);
          values[field.id] = value;

          // Track type values for view creation
          if (field.id === typeField?.id && value) {
            typeValues.add(String(value));
          }
        });

        set.records.push(createRecord(set.id, values));
      }

      processed = Math.min(i + BATCH_SIZE, rows.length);

      this._emitProgress('progress', {
        phase: 'importing',
        percentage: 50 + Math.round((processed / rows.length) * 40),
        recordsProcessed: processed,
        totalRecords: rows.length
      });

      await new Promise(r => setTimeout(r, 0));
    }

    // Create views by type if requested and type field exists
    if (options.createViewsByType && typeField && typeValues.size > 0) {
      this._emitProgress('progress', {
        phase: 'creating_views',
        percentage: 92
      });

      for (const typeValue of typeValues) {
        const viewName = this._formatViewName(typeValue);
        const view = createView(viewName, 'table', {
          filters: [{
            fieldId: typeField.id,
            operator: 'is',
            filterValue: typeValue,
            enabled: true
          }]
        });
        set.views.push(view);
        viewsCreated.push(viewName);
      }

      // Add view creation step to transformation log
      if (set.datasetProvenance?.provenance?.method?.transformationLog) {
        set.datasetProvenance.provenance.method.transformationLog.push({
          step: 3,
          operation: 'CREATE_VIEWS',
          processor: 'ImportOrchestrator',
          decisions: {
            splitField: typeFieldName,
            viewsCreated: viewsCreated,
            viewCount: viewsCreated.length
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    // Finalize provenance with completion data
    const commitTime = new Date().toISOString();

    if (set.datasetProvenance?.provenance) {
      // Update temporal chain with commit time
      if (set.datasetProvenance.provenance.timeframe?.temporalChain) {
        set.datasetProvenance.provenance.timeframe.temporalChain.commitCompletedAt = commitTime;
      }

      // Update quality audit completeness
      if (set.datasetProvenance.provenance.method?.qualityAudit?.completeness) {
        set.datasetProvenance.provenance.method.qualityAudit.completeness.importedRecords = set.records.length;
      }

      // Update import scope with final counts
      if (set.datasetProvenance.provenance.scale?.importScope) {
        set.datasetProvenance.provenance.scale.importScope.recordCount = set.records.length;
        set.datasetProvenance.provenance.scale.importScope.fieldCount = set.fields.length;
      }
    }

    // Add to workbench
    this.workbench.sets.push(set);
    this.workbench.currentSetId = set.id;
    this.workbench.currentViewId = set.views[0]?.id;

    // Handle edges if provided (graph data)
    if (options.includeEdges && options.graphInfo?.edges) {
      await this._importEdgesAsSet(setName, options.graphInfo);
    }

    // Create EO event for the import
    if (this.workbench.eoApp) {
      try {
        this.workbench.eoApp.recordGiven('received', {
          setId: set.id,
          setName: set.name,
          recordCount: set.records.length,
          fieldCount: set.fields.length,
          hasProvenance: true,  // We always have provenance now
          provenanceComplete: !!userProvenance.agent,  // True if user provided agent
          viewsCreated: viewsCreated.length
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
      fieldCount: set.fields.length,
      viewsCreated
    };
  }

  /**
   * Format a type value as a view name
   */
  _formatViewName(value) {
    // Capitalize first letter, replace underscores with spaces
    const formatted = String(value)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    return formatted;
  }

  /**
   * Import edges as a separate dataset (for graph data)
   */
  async _importEdgesAsSet(baseSetName, graphInfo) {
    if (!graphInfo.edges || graphInfo.edges.length === 0) return;

    const edgeSetName = `${baseSetName} - Relationships`;
    const edgeSet = createSet(edgeSetName);
    edgeSet.icon = 'ph-arrows-left-right';

    // Create fields for edge data
    edgeSet.fields = [
      createField('id', 'text', { isPrimary: true }),
      createField('from', 'text'),
      createField('to', 'text'),
      createField('type', 'text'),
      createField('properties', 'longText')
    ];

    // Add edge records
    for (const edge of graphInfo.edges) {
      const values = {
        [edgeSet.fields[0].id]: edge.id || '',
        [edgeSet.fields[1].id]: edge.from || '',
        [edgeSet.fields[2].id]: edge.to || '',
        [edgeSet.fields[3].id]: edge.type || '',
        [edgeSet.fields[4].id]: edge.properties ? JSON.stringify(edge.properties) : ''
      };
      edgeSet.records.push(createRecord(edgeSet.id, values));
    }

    // Note: We intentionally don't create views per edge type here.
    // Graph datasets often have many relationship types (brother_of, sibling_of,
    // married_to, owns, employed_by, etc.) and auto-creating a view for each
    // would clutter the UI. Users can filter by type manually if needed.

    this.workbench.sets.push(edgeSet);
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
// Import Analyzer - Detects structure, graph data, view split candidates
// ============================================================================

class ImportAnalyzer {
  /**
   * Analyze parsed data for structure patterns
   */
  analyze(parseResult, rawText) {
    const analysis = {
      // Basic stats
      totalRecords: parseResult.rows?.length || 0,
      totalFields: parseResult.headers?.length || 0,

      // Graph data detection
      isGraphData: false,
      graphInfo: null,

      // View split candidates (fields with low cardinality)
      viewSplitCandidates: [],

      // Embedded provenance detection
      hasEmbeddedProvenance: false,
      provenanceFields: [],

      // Original source
      originalSource: rawText,
      originalFormat: null
    };

    // Detect graph data
    const graphAnalysis = this._analyzeGraphData(parseResult, rawText);
    if (graphAnalysis.isGraph) {
      analysis.isGraphData = true;
      analysis.graphInfo = graphAnalysis;
    }

    // Find view split candidates
    analysis.viewSplitCandidates = this._findViewSplitCandidates(parseResult);

    // Detect embedded provenance
    const provAnalysis = this._detectEmbeddedProvenance(parseResult);
    analysis.hasEmbeddedProvenance = provAnalysis.found;
    analysis.provenanceFields = provAnalysis.fields;

    return analysis;
  }

  /**
   * Detect if this is graph data (nodes/edges pattern)
   */
  _analyzeGraphData(parseResult, rawText) {
    const result = {
      isGraph: false,
      nodes: null,
      edges: null,
      edgeEvents: null,
      nodeTypes: [],
      edgeTypes: [],
      nodeCount: 0,
      edgeCount: 0
    };

    // Check if raw text contains graph patterns
    if (typeof rawText === 'string') {
      const hasNodes = /\bnodes\s*[=:]/i.test(rawText);
      const hasEdges = /\bedges\s*[=:]/i.test(rawText);

      if (hasNodes || hasEdges) {
        // Try to extract graph structure from JS module
        try {
          // Look for const nodes = [...] patterns
          const nodeMatch = rawText.match(/(?:const|let|var)\s+nodes\s*=\s*(\[[\s\S]*?\]);/);
          const edgeMatch = rawText.match(/(?:const|let|var)\s+edges\s*=\s*(\[[\s\S]*?\]);/);
          const edgeEventsMatch = rawText.match(/(?:const|let|var)\s+edgeEvents\s*=\s*(\[[\s\S]*?\]);/);

          // Try Function constructor for safe evaluation
          if (nodeMatch) {
            try {
              const fn = new Function('return ' + nodeMatch[1]);
              result.nodes = fn();
              result.nodeCount = result.nodes.length;
              result.isGraph = true;

              // Extract node types
              const types = new Set();
              result.nodes.forEach(n => {
                if (n.type) types.add(n.type);
              });
              result.nodeTypes = Array.from(types);
            } catch (e) {
              console.warn('Failed to parse nodes:', e);
            }
          }

          if (edgeMatch) {
            try {
              const fn = new Function('return ' + edgeMatch[1]);
              result.edges = fn();
              result.edgeCount = result.edges.length;
              result.isGraph = true;

              // Extract edge types
              const types = new Set();
              result.edges.forEach(e => {
                if (e.type) types.add(e.type);
              });
              result.edgeTypes = Array.from(types);
            } catch (e) {
              console.warn('Failed to parse edges:', e);
            }
          }

          if (edgeEventsMatch) {
            try {
              const fn = new Function('return ' + edgeEventsMatch[1]);
              result.edgeEvents = fn();
            } catch (e) {
              console.warn('Failed to parse edgeEvents:', e);
            }
          }
        } catch (e) {
          console.warn('Graph analysis error:', e);
        }
      }
    }

    // Also check if the rows have 'type' field with consistent patterns
    if (!result.isGraph && parseResult.rows?.length > 0) {
      const hasTypeField = parseResult.headers?.includes('type');
      if (hasTypeField) {
        const types = new Set(parseResult.rows.map(r => r.type).filter(Boolean));
        if (types.size >= 2 && types.size <= 20) {
          // Multiple types suggest this could be entity data worth splitting
          result.nodeTypes = Array.from(types);
        }
      }
    }

    return result;
  }

  /**
   * Find fields suitable for creating separate views
   */
  _findViewSplitCandidates(parseResult) {
    const candidates = [];
    const rows = parseResult.rows || [];
    const headers = parseResult.headers || [];

    if (rows.length < 2) return candidates;

    for (const header of headers) {
      const values = rows.map(r => r[header]).filter(v => v != null && v !== '');
      const uniqueValues = new Set(values);

      // Good candidate: 2-20 unique values, covering at least 50% of records
      if (uniqueValues.size >= 2 && uniqueValues.size <= 20 && values.length >= rows.length * 0.5) {
        const valueCounts = {};
        values.forEach(v => {
          const key = String(v);
          valueCounts[key] = (valueCounts[key] || 0) + 1;
        });

        candidates.push({
          field: header,
          uniqueCount: uniqueValues.size,
          values: Array.from(uniqueValues).map(v => ({
            value: v,
            count: valueCounts[String(v)] || 0
          })).sort((a, b) => b.count - a.count)
        });
      }
    }

    // Sort by how good a candidate it is (fewer unique values = better)
    candidates.sort((a, b) => a.uniqueCount - b.uniqueCount);

    return candidates;
  }

  /**
   * Detect embedded provenance in the data
   */
  _detectEmbeddedProvenance(parseResult) {
    const result = { found: false, fields: [] };
    const rows = parseResult.rows || [];

    if (rows.length === 0) return result;

    // Check first few rows for provenance-like fields
    const sample = rows.slice(0, 5);

    // Look for context objects or provenance fields
    const provenancePatterns = ['context', 'source', 'provenance', 'meta', 'metadata'];
    const headers = parseResult.headers || [];

    for (const header of headers) {
      const lowerHeader = header.toLowerCase();
      if (provenancePatterns.some(p => lowerHeader.includes(p))) {
        result.found = true;
        result.fields.push(header);
      }
    }

    // Check for nested context objects
    for (const row of sample) {
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'object' && value !== null) {
          if ('source' in value || 'confidence' in value || 'agent' in value) {
            result.found = true;
            if (!result.fields.includes(key)) {
              result.fields.push(key);
            }
          }
        }
      }
    }

    return result;
  }
}


// ============================================================================
// Excel Parser (using SheetJS/xlsx library if available)
// ============================================================================

class ExcelParser {
  /**
   * Check if xlsx library is available
   */
  static isAvailable() {
    return typeof XLSX !== 'undefined';
  }

  /**
   * Parse Excel file
   * @param {ArrayBuffer} buffer - File content as ArrayBuffer
   * @returns {{ sheets: Array<{name, headers, rows}> }}
   */
  parse(buffer) {
    if (!ExcelParser.isAvailable()) {
      throw new Error('Excel support requires the SheetJS library. Please include xlsx.min.js');
    }

    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheets = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length === 0) continue;

      const headers = jsonData[0].map((h, i) => h || `Column ${i + 1}`);
      const rows = jsonData.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = row[i] !== undefined ? row[i] : '';
        });
        return obj;
      });

      sheets.push({
        name: sheetName,
        headers,
        rows,
        rowCount: rows.length,
        columnCount: headers.length
      });
    }

    return { sheets };
  }
}


// ============================================================================
// Import UI Component (Enhanced)
// ============================================================================

/**
 * Create and show enhanced import modal with provenance and view options
 */
function showImportModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = modal?.querySelector('.modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  if (!modal || !modalBody) return;

  modalTitle.textContent = 'Import Data';

  const acceptTypes = ExcelParser.isAvailable()
    ? '.csv,.json,.xlsx,.xls,.ics'
    : '.csv,.json,.ics';

  const dropzoneText = ExcelParser.isAvailable()
    ? 'Drop CSV, JSON, Excel, or ICS file here'
    : 'Drop CSV, JSON, or ICS file here';

  modalBody.innerHTML = `
    <div class="import-container">
      <!-- Drop Zone -->
      <div class="import-dropzone" id="import-dropzone">
        <div class="dropzone-content">
          <i class="ph ph-download-simple dropzone-icon"></i>
          <p class="dropzone-text">${dropzoneText}</p>
          <p class="dropzone-subtext">or click to browse</p>
        </div>
        <input type="file" id="import-file-input" accept="${acceptTypes}" hidden>
      </div>

      <!-- Preview Section (hidden initially) -->
      <div class="import-preview" id="import-preview" style="display: none;">
        <div class="preview-header">
          <div class="preview-file-info">
            <i class="ph ph-file-csv" id="preview-file-icon"></i>
            <span id="preview-filename">filename.csv</span>
            <span id="preview-filesize" class="text-muted"></span>
          </div>
          <button class="btn btn-sm btn-secondary" id="import-change-file">
            <i class="ph ph-arrow-counter-clockwise"></i> Change
          </button>
        </div>

        <!-- Graph Data Detection Banner -->
        <div class="import-graph-detected" id="import-graph-detected" style="display: none;">
          <div class="graph-detected-icon">
            <i class="ph ph-graph"></i>
          </div>
          <div class="graph-detected-content">
            <strong>Graph Data Detected</strong>
            <p id="graph-detected-info">Found nodes and edges</p>
          </div>
        </div>

        <div class="preview-stats">
          <div class="stat-item">
            <span class="stat-value" id="preview-rows">0</span>
            <span class="stat-label">Records</span>
          </div>
          <div class="stat-item">
            <span class="stat-value" id="preview-fields">0</span>
            <span class="stat-label">Fields</span>
          </div>
          <div class="stat-item">
            <span class="stat-value" id="preview-types">-</span>
            <span class="stat-label">Types</span>
          </div>
        </div>

        <!-- Type Distribution -->
        <div class="import-type-distribution" id="import-type-distribution" style="display: none;">
          <h4>Record Types</h4>
          <div class="type-bars" id="type-bars"></div>
        </div>

        <!-- View Creation Options -->
        <div class="import-view-options" id="import-view-options" style="display: none;">
          <div class="view-option">
            <label class="checkbox-label">
              <input type="checkbox" id="import-create-views" checked>
              <span>Create views by type</span>
            </label>
            <p class="option-hint">Create separate filtered views for each type</p>
          </div>
        </div>

        <!-- Edges Section for Graph Data -->
        <div class="import-edges-section" id="import-edges-section" style="display: none;">
          <h4>Relationships</h4>
          <div class="edges-info" id="edges-info"></div>
          <div class="edge-option">
            <label class="checkbox-label">
              <input type="checkbox" id="import-include-edges" checked>
              <span>Import edges as separate dataset</span>
            </label>
          </div>
        </div>

        <!-- Sample Data -->
        <div class="preview-sample">
          <h4>Sample Data</h4>
          <div class="sample-table-wrapper">
            <table class="sample-table" id="sample-table">
            </table>
          </div>
        </div>

        <!-- Import Options -->
        <div class="import-options">
          <div class="form-group">
            <label class="form-label">Dataset Name</label>
            <input type="text" class="form-input" id="import-set-name" placeholder="Enter name for the new dataset">
          </div>
        </div>

        <!-- Provenance Section -->
        <div class="import-provenance-section">
          <div class="import-provenance-title">
            <i class="ph ph-fingerprint"></i>
            Provenance (optional)
          </div>
          <div class="import-provenance-subtitle">
            Help track where this data comes from
          </div>
          <div class="import-provenance-grid">
            <div class="import-provenance-field">
              <label class="import-provenance-label">Who provided this?</label>
              <input type="text" class="import-provenance-input" id="prov-agent"
                     placeholder="Person, organization, or system...">
            </div>
            <div class="import-provenance-field">
              <label class="import-provenance-label">How was it produced?</label>
              <input type="text" class="import-provenance-input" id="prov-method"
                     placeholder="Export, FOIA, scrape, manual entry...">
            </div>
            <div class="import-provenance-field full-width">
              <label class="import-provenance-label">Original source or publication?</label>
              <input type="text" class="import-provenance-input" id="prov-source"
                     placeholder="Database name, document, URL...">
            </div>
            <div class="import-provenance-field">
              <label class="import-provenance-label">Jurisdiction/scope</label>
              <input type="text" class="import-provenance-input" id="prov-jurisdiction"
                     placeholder="City of Riverside, US Federal...">
            </div>
            <div class="import-provenance-field">
              <label class="import-provenance-label">Time period covered</label>
              <input type="text" class="import-provenance-input" id="prov-timeframe"
                     placeholder="2019-2024, as of March 2024...">
            </div>
            <div class="import-provenance-field full-width">
              <label class="import-provenance-label">Any important context?</label>
              <input type="text" class="import-provenance-input" id="prov-background"
                     placeholder="During investigation, post-COVID, etc...">
            </div>
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
          <div id="success-views-created" style="margin-top: 12px; font-size: 13px; color: var(--text-secondary);"></div>
        </div>
      </div>
    </div>
  `;

  modalFooter.innerHTML = `
    <button class="btn btn-secondary" id="import-cancel">Cancel</button>
    <button class="btn btn-primary" id="import-confirm" disabled>
      <i class="ph ph-download"></i> Import
    </button>
  `;

  modal.classList.add('active');

  // Initialize import handlers
  initImportHandlers();
}

/**
 * Initialize import modal handlers (Enhanced)
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
  let analysisData = null;
  let rawFileContent = null;
  let orchestrator = null;
  const analyzer = new ImportAnalyzer();

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
    const validExtensions = ['.csv', '.json', '.xlsx', '.xls', '.ics'];
    if (file && validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
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
                    currentFile.name.replace(/\.(csv|json|xlsx|xls)$/i, '');

    // Collect provenance
    const provenance = {
      agent: document.getElementById('prov-agent')?.value || null,
      method: document.getElementById('prov-method')?.value || null,
      source: document.getElementById('prov-source')?.value || null,
      jurisdiction: document.getElementById('prov-jurisdiction')?.value || null,
      timeframe: document.getElementById('prov-timeframe')?.value || null,
      background: document.getElementById('prov-background')?.value || null,
      term: null,
      definition: null,
      scale: null
    };

    // Check if we should create views by type
    const createViewsByType = document.getElementById('import-create-views')?.checked || false;
    const includeEdges = document.getElementById('import-include-edges')?.checked || false;

    try {
      // Listen for progress events
      const progressHandler = (e) => {
        updateProgress(e.detail);
      };
      window.addEventListener('eo-import-progress', progressHandler);

      // Import with enhanced options
      const result = await orchestrator.import(currentFile, {
        setName,
        provenance,
        originalSource: rawFileContent,
        createViewsByType,
        viewSplitField: analysisData?.viewSplitCandidates?.[0]?.field || 'type',
        graphInfo: analysisData?.graphInfo,
        includeEdges
      });

      window.removeEventListener('eo-import-progress', progressHandler);

      // Show success
      progressSection.style.display = 'none';
      successSection.style.display = 'flex';
      document.getElementById('success-message').textContent =
        `Successfully imported ${result.recordCount} records with ${result.fieldCount} fields`;

      // Show created views info
      if (result.viewsCreated && result.viewsCreated.length > 0) {
        document.getElementById('success-views-created').innerHTML =
          `<i class="ph ph-eye"></i> Created ${result.viewsCreated.length} views: ${result.viewsCreated.join(', ')}`;
      }

      // Close after delay
      setTimeout(() => {
        closeModal();
      }, 1800);

    } catch (error) {
      progressSection.style.display = 'none';
      previewSection.style.display = 'block';
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      alert('Import failed: ' + error.message);
    }
  });

  // Handle file selection (Enhanced)
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

      // Read raw file content for preservation and analysis
      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

      if (isExcel) {
        // Handle Excel files
        if (!ExcelParser.isAvailable()) {
          throw new Error('Excel support requires the SheetJS library');
        }
        const buffer = await readFileAsArrayBuffer(file);
        rawFileContent = buffer; // Store as binary for Excel
        const excelParser = new ExcelParser();
        const excelData = excelParser.parse(buffer);

        // For Excel, use first sheet for preview (or combine all)
        if (excelData.sheets.length === 0) {
          throw new Error('No data found in Excel file');
        }

        // Combine all sheets for preview
        const firstSheet = excelData.sheets[0];
        previewData = {
          fileName: file.name,
          fileSize: file.size,
          isCSV: false,
          isExcel: true,
          sheets: excelData.sheets,
          headers: firstSheet.headers,
          schema: new SchemaInferrer().inferSchema(firstSheet.headers, firstSheet.rows),
          rowCount: excelData.sheets.reduce((sum, s) => sum + s.rowCount, 0),
          sampleRows: firstSheet.rows.slice(0, 5)
        };
      } else {
        // CSV or JSON
        rawFileContent = await readFileAsText(file);
        previewData = await orchestrator.preview(file);
      }

      // Run analysis
      analysisData = analyzer.analyze(previewData, rawFileContent);

      // Update UI with preview
      dropzone.style.display = 'none';
      previewSection.style.display = 'block';

      // File info
      document.getElementById('preview-filename').textContent = file.name;
      document.getElementById('preview-filesize').textContent =
        `(${formatFileSize(file.size)})`;

      // Update file icon
      const fileIcon = document.getElementById('preview-file-icon');
      const fileNameLower = file.name.toLowerCase();
      if (isExcel) {
        fileIcon.className = 'ph ph-file-xls';
      } else if (fileNameLower.endsWith('.ics')) {
        fileIcon.className = 'ph ph-calendar-blank';
      } else if (fileNameLower.endsWith('.json')) {
        fileIcon.className = 'ph ph-file-js';
      } else {
        fileIcon.className = 'ph ph-file-csv';
      }

      // Stats
      document.getElementById('preview-rows').textContent = previewData.rowCount;
      document.getElementById('preview-fields').textContent = previewData.schema.fields.length;

      // Show type count if available
      const typesDisplay = document.getElementById('preview-types');
      if (analysisData.graphInfo?.nodeTypes?.length > 0) {
        typesDisplay.textContent = analysisData.graphInfo.nodeTypes.length;
      } else if (analysisData.viewSplitCandidates.length > 0) {
        typesDisplay.textContent = analysisData.viewSplitCandidates[0].uniqueCount;
      } else {
        typesDisplay.textContent = '-';
      }

      // Show graph data detected banner
      const graphBanner = document.getElementById('import-graph-detected');
      if (analysisData.isGraphData && analysisData.graphInfo) {
        graphBanner.style.display = 'flex';
        const graphInfo = analysisData.graphInfo;
        document.getElementById('graph-detected-info').textContent =
          `${graphInfo.nodeCount} nodes (${graphInfo.nodeTypes.join(', ')})` +
          (graphInfo.edgeCount > 0 ? ` and ${graphInfo.edgeCount} edges` : '');
      } else {
        graphBanner.style.display = 'none';
      }

      // Show type distribution
      const typeDistSection = document.getElementById('import-type-distribution');
      const typeBars = document.getElementById('type-bars');
      const typeCandidate = analysisData.viewSplitCandidates.find(c => c.field === 'type') ||
                           analysisData.viewSplitCandidates[0];

      if (typeCandidate && typeCandidate.values.length > 0) {
        typeDistSection.style.display = 'block';
        const maxCount = Math.max(...typeCandidate.values.map(v => v.count));
        typeBars.innerHTML = typeCandidate.values.slice(0, 10).map(v => {
          const pct = (v.count / maxCount) * 100;
          return `
            <div class="type-bar-row">
              <span class="type-bar-label">${escapeHtml(String(v.value))}</span>
              <div class="type-bar-track">
                <div class="type-bar-fill" style="width: ${pct}%"></div>
              </div>
              <span class="type-bar-count">${v.count}</span>
            </div>
          `;
        }).join('');

        // Show view options
        document.getElementById('import-view-options').style.display = 'block';
      } else {
        typeDistSection.style.display = 'none';
        document.getElementById('import-view-options').style.display = 'none';
      }

      // Show edges section for graph data
      const edgesSection = document.getElementById('import-edges-section');
      if (analysisData.isGraphData && analysisData.graphInfo?.edgeCount > 0) {
        edgesSection.style.display = 'block';
        const edgeInfo = analysisData.graphInfo;
        document.getElementById('edges-info').innerHTML = `
          <span class="edges-count">${edgeInfo.edgeCount} relationships</span>
          <span class="edges-types">${edgeInfo.edgeTypes.slice(0, 5).join(', ')}${edgeInfo.edgeTypes.length > 5 ? '...' : ''}</span>
        `;
      } else {
        edgesSection.style.display = 'none';
      }

      // Sample table
      const sampleTable = document.getElementById('sample-table');
      const displayHeaders = previewData.headers.slice(0, 6); // Limit columns for readability
      sampleTable.innerHTML = `
        <thead>
          <tr>
            ${displayHeaders.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
            ${previewData.headers.length > 6 ? '<th>...</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${previewData.sampleRows.slice(0, 3).map(row => `
            <tr>
              ${displayHeaders.map(h => `<td>${escapeHtml(String(row[h] || '').substring(0, 40))}</td>`).join('')}
              ${previewData.headers.length > 6 ? '<td>...</td>' : ''}
            </tr>
          `).join('')}
        </tbody>
      `;

      // Set name input
      document.getElementById('import-set-name').value =
        file.name.replace(/\.(csv|json|xlsx|xls)$/i, '');

      // Enable confirm
      confirmBtn.disabled = false;

    } catch (error) {
      // Reset dropzone
      const dropzoneText = ExcelParser.isAvailable()
        ? 'Drop CSV, JSON, or Excel file here'
        : 'Drop CSV or JSON file here';
      dropzone.innerHTML = `
        <div class="dropzone-content">
          <i class="ph ph-download-simple dropzone-icon"></i>
          <p class="dropzone-text">${dropzoneText}</p>
          <p class="dropzone-subtext">or click to browse</p>
        </div>
      `;
      dropzone.style.display = 'flex';
      alert('Failed to parse file: ' + error.message);
    }
  }

  // Helper: Read file as text
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // Helper: Read file as ArrayBuffer (for Excel)
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(new Uint8Array(e.target.result));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
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

  /* Graph Data Detected Banner */
  .import-graph-detected {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: var(--radius-md);
    margin-bottom: 16px;
  }

  .graph-detected-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--primary);
    border-radius: 8px;
    color: white;
    font-size: 20px;
  }

  .graph-detected-content strong {
    display: block;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .graph-detected-content p {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0;
  }

  /* Type Distribution */
  .import-type-distribution {
    margin-bottom: 16px;
  }

  .import-type-distribution h4 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 8px;
    text-transform: uppercase;
  }

  .type-bars {
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    padding: 8px 12px;
  }

  .type-bar-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 0;
  }

  .type-bar-label {
    width: 100px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .type-bar-track {
    flex: 1;
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    overflow: hidden;
  }

  .type-bar-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .type-bar-count {
    width: 40px;
    text-align: right;
    font-size: 12px;
    color: var(--text-muted);
  }

  /* View Options */
  .import-view-options {
    margin-bottom: 16px;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
  }

  .view-option {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  }

  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--primary);
  }

  .option-hint {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: 24px;
    margin-top: 0;
  }

  /* Edges Section */
  .import-edges-section {
    margin-bottom: 16px;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
  }

  .import-edges-section h4 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 8px;
    text-transform: uppercase;
  }

  .edges-info {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
    font-size: 13px;
  }

  .edges-count {
    font-weight: 500;
    color: var(--text-primary);
  }

  .edges-types {
    color: var(--text-muted);
  }

  .edge-option {
    padding-top: 8px;
    border-top: 1px solid var(--border-secondary);
  }

  /* Import Provenance Section */
  .import-provenance-section {
    margin-top: 20px;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-primary);
  }

  .import-provenance-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-primary);
  }

  .import-provenance-subtitle {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  .import-provenance-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .import-provenance-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .import-provenance-field.full-width {
    grid-column: 1 / -1;
  }

  .import-provenance-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .import-provenance-input {
    padding: 8px 10px;
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    font-size: 13px;
    background: white;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .import-provenance-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
  }

  .import-provenance-input::placeholder {
    color: var(--text-muted);
  }
`;
document.head.appendChild(importStyles);


// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ICSParser,
    CSVParser,
    SchemaInferrer,
    ImportOrchestrator,
    ImportAnalyzer,
    ExcelParser,
    showImportModal
  };
}

if (typeof window !== 'undefined') {
  window.ICSParser = ICSParser;
  window.CSVParser = CSVParser;
  window.SchemaInferrer = SchemaInferrer;
  window.ImportOrchestrator = ImportOrchestrator;
  window.ImportAnalyzer = ImportAnalyzer;
  window.ExcelParser = ExcelParser;
  window.showImportModal = showImportModal;
}
