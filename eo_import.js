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
      temporalExtent: null, // { minDate, maxDate, fields[] } - date range across all date columns
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

      // Track date formats and temporal extent
      if (typeInfo.type === 'date' && typeInfo.dateFormat) {
        inferenceDecisions.dateFormatsDetected.push({
          field: header,
          format: typeInfo.dateFormat,
          minDate: typeInfo.minDate,
          maxDate: typeInfo.maxDate
        });
      }

      // Capture unique values for matching (up to 50 unique values)
      const uniqueValuesSet = new Set(values.map(v => String(v).trim()).filter(v => v));
      const uniqueValues = Array.from(uniqueValuesSet).slice(0, 50);

      return {
        name: header,
        type: typeInfo.type,
        confidence: typeInfo.confidence,
        options: typeInfo.options || {},
        isPrimary: index === 0,
        samples: values.slice(0, 10), // Increased from 3 to 10 samples
        uniqueValues: uniqueValues,   // All unique values (up to 50) for matching
        sampleCount: values.length,
        uniqueCount: uniqueValuesSet.size
      };
    });

    // Aggregate temporal extent across all date columns
    if (inferenceDecisions.dateFormatsDetected.length > 0) {
      const allDates = inferenceDecisions.dateFormatsDetected
        .filter(d => d.minDate && d.maxDate)
        .flatMap(d => [new Date(d.minDate), new Date(d.maxDate)]);

      if (allDates.length > 0) {
        allDates.sort((a, b) => a - b);
        inferenceDecisions.temporalExtent = {
          minDate: allDates[0].toISOString(),
          maxDate: allDates[allDates.length - 1].toISOString(),
          fields: inferenceDecisions.dateFormatsDetected
            .filter(d => d.minDate && d.maxDate)
            .map(d => d.field)
        };
      }
    }

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
    const parsedDates = []; // Track parsed dates for temporal extent

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
        const parsed = new Date(strValue);
        if (!isNaN(parsed.getTime())) parsedDates.push(parsed);
      } else if (this.patterns.dateAlt.test(strValue)) {
        typeCounts.date++;
        dateFormat = strValue.includes('/') ? 'MM/DD/YYYY' : 'DD-MM-YYYY';
        const parsed = this._parseAltDate(strValue, dateFormat);
        if (parsed && !isNaN(parsed.getTime())) parsedDates.push(parsed);
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
      const result = { type: 'date', confidence: typeCounts.date / total, candidates, uniqueCount, dateFormat };
      // Add temporal extent if we have parsed dates
      if (parsedDates.length > 0) {
        parsedDates.sort((a, b) => a - b);
        result.minDate = parsedDates[0].toISOString();
        result.maxDate = parsedDates[parsedDates.length - 1].toISOString();
      }
      return result;
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

  /**
   * Parse alternative date formats (MM/DD/YYYY or DD-MM-YYYY)
   */
  _parseAltDate(strValue, format) {
    try {
      const parts = strValue.split(/[\/\-]/);
      if (parts.length !== 3) return null;

      let year, month, day;
      if (format === 'MM/DD/YYYY') {
        [month, day, year] = parts;
      } else {
        [day, month, year] = parts;
      }

      // Handle 2-digit years
      if (year.length === 2) {
        year = parseInt(year) > 50 ? '19' + year : '20' + year;
      }

      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } catch {
      return null;
    }
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
   * Import file as Source only (no automatic Set creation)
   *
   * REBUILT FROM SCRATCH - Simplified, reliable implementation.
   *
   * This creates a Source (GIVEN data) that users can view and create Sets from.
   * Sources are stored directly on workbench.sources for reliable access.
   *
   * @param {File} file - File to import
   * @param {Object} options - Import options
   * @returns {Promise<{ success: boolean, source: Source, schema: Object }>}
   */
  async importToSource(file, options = {}) {
    const startTime = Date.now();
    const importedAt = new Date().toISOString();

    this._emitProgress('started', {
      fileName: file.name,
      fileSize: file.size,
      phase: 'reading',
      mode: 'source_only'
    });

    try {
      // Step 1: Read file content
      const text = await this._readFile(file);

      this._emitProgress('progress', {
        phase: 'parsing',
        percentage: 20
      });

      // Step 2: Determine file type and parse
      const fileName = file.name.toLowerCase();
      const isICS = fileName.endsWith('.ics') || file.type === 'text/calendar';
      const isCSV = fileName.endsWith('.csv') ||
                    file.type === 'text/csv' ||
                    (!isICS && !this._isJSON(text));

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

      this._emitProgress('progress', {
        phase: 'inferring',
        percentage: 40,
        rowCount: parseResult.rows.length
      });

      // Step 3: Infer schema from data
      const schema = this.schemaInferrer.inferSchema(parseResult.headers, parseResult.rows);

      this._emitProgress('progress', {
        phase: 'creating_source',
        percentage: 60,
        fieldCount: schema.fields.length
      });

      // Step 4: Compute content hash for data integrity
      let contentHash = null;
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(text);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
          // Hash computation is optional
        }
      }

      // Step 5: Build the source object
      const sourceId = 'src_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8);

      const source = {
        id: sourceId,
        name: file.name,
        type: 'source',

        // Raw data - the actual imported records
        records: parseResult.rows,
        recordCount: parseResult.rows.length,

        // Schema information
        schema: {
          fields: schema.fields || parseResult.headers.map(h => ({
            name: h,
            type: 'text',
            sourceColumn: h
          })),
          inferenceDecisions: schema.inferenceDecisions || null
        },

        // File metadata
        fileIdentity: {
          originalFilename: file.name,
          contentHash: contentHash,
          rawSize: file.size,
          encoding: 'utf-8',
          mimeType: mimeType,
          lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null
        },

        // Provenance (9-element EO structure)
        provenance: {
          agent: options.provenance?.agent || null,
          method: options.provenance?.method || `${isICS ? 'ICS' : isCSV ? 'CSV' : 'JSON'} import`,
          source: options.provenance?.source || file.name,
          term: options.provenance?.term || null,
          definition: options.provenance?.definition || null,
          jurisdiction: options.provenance?.jurisdiction || null,
          scale: options.provenance?.scale || null,
          timeframe: options.provenance?.timeframe || null,
          background: options.provenance?.background || null
        },

        // Parsing decisions (for transparency)
        parsingDecisions: parseResult.parsingDecisions || {
          delimiter: parseResult.delimiter,
          hasHeaders: parseResult.hasHeaders
        },

        // Timestamps
        importedAt: importedAt,
        createdAt: importedAt,

        // Derived sets tracking
        derivedSetIds: [],

        // Multi-record type analysis (for sources with multiple record types)
        multiRecordAnalysis: options.schemaDivergence ? {
          typeField: options.schemaDivergence.typeField,
          types: options.schemaDivergence.types.map(t => ({
            value: t.type,
            label: t.type,
            count: t.count,
            specificFields: t.specificFields || []
          })),
          commonFields: options.schemaDivergence.commonFields || [],
          divergenceScore: options.schemaDivergence.divergenceScore
        } : null,

        // View preference for multi-record sources
        sourceViewMode: 'unified',

        // Status
        status: 'active'
      };

      this._emitProgress('progress', {
        phase: 'storing',
        percentage: 80
      });

      // Step 6: Store the source on the workbench
      // CRITICAL: This is the single source of truth for imported data
      if (this.workbench) {
        // Initialize sources array if needed
        if (!Array.isArray(this.workbench.sources)) {
          console.warn('ImportOrchestrator: workbench.sources was not an array, initializing');
          this.workbench.sources = [];
        }

        // Add source to workbench
        this.workbench.sources.push(source);
        console.log('ImportOrchestrator: Source added to workbench.sources', {
          sourceId: source.id,
          sourceName: source.name,
          recordCount: source.recordCount,
          totalSources: this.workbench.sources.length
        });

        // Also add to sourceStore if it exists (for compatibility)
        if (this.workbench.sourceStore?.sources) {
          this.workbench.sourceStore.sources.set(sourceId, source);
        }

        // Add source to current project (if a project is selected)
        if (typeof this.workbench._addSourceToProject === 'function') {
          this.workbench._addSourceToProject(source.id);
          console.log('ImportOrchestrator: Source added to current project');
        }

        // Persist the data
        if (typeof this.workbench._saveData === 'function') {
          this.workbench._saveData();
          console.log('ImportOrchestrator: Data saved to localStorage');
        }
      } else {
        console.error('ImportOrchestrator: No workbench reference - source will NOT be visible!');
      }

      // Step 7a: Create stub definitions for all fields (keys in definitions by default)
      let stubDefinitions = [];
      if (options.createStubDefinitions !== false) {
        this._emitProgress('progress', {
          phase: 'creating_stub_definitions',
          percentage: 85
        });

        try {
          stubDefinitions = this._createStubDefinitions(source, options);
          console.log('ImportOrchestrator: Created', stubDefinitions.length, 'stub definitions');

          // Link fields to their stub definitions
          if (stubDefinitions.length > 0) {
            source.schema.fields = source.schema.fields.map(field => {
              const stubDef = stubDefinitions.find(d => d.term.term === field.name);
              if (stubDef) {
                field.definitionId = stubDef.id;
              }
              return field;
            });

            // Save data and update definitions panel
            if (typeof this.workbench?._saveData === 'function') {
              this.workbench._saveData();
            }
            if (typeof this.workbench?._renderDefinitionsNav === 'function') {
              this.workbench._renderDefinitionsNav();
            }
          }
        } catch (stubError) {
          console.warn('ImportOrchestrator: Stub definition creation failed (non-fatal):', stubError);
        }
      }

      // Step 7b: Trigger definition lookups for imported keys (async, non-blocking)
      // This populates stub definitions with API suggestions
      let definitionLookupResult = null;
      if (options.enableDefinitionLookup !== false) {
        this._emitProgress('progress', {
          phase: 'looking_up_definitions',
          percentage: 90
        });

        try {
          definitionLookupResult = await this._triggerDefinitionLookup(source, stubDefinitions, options);
          if (definitionLookupResult) {
            // Re-save with enriched data
            if (typeof this.workbench._saveData === 'function') {
              this.workbench._saveData();
            }
          }
        } catch (lookupError) {
          console.warn('ImportOrchestrator: Definition lookup failed (non-fatal):', lookupError);
        }
      }

      this._emitProgress('completed', {
        fileName: file.name,
        sourceId: source.id,
        recordCount: source.recordCount,
        fieldCount: schema.fields.length,
        duration: Date.now() - startTime,
        mode: 'source_only',
        stubDefinitions: {
          created: stubDefinitions.length,
          needPopulation: stubDefinitions.length
        },
        definitionLookup: definitionLookupResult ? {
          keysLookedUp: definitionLookupResult.summary?.totalKeys || 0,
          keysWithMatches: definitionLookupResult.summary?.keysWithMatches || 0,
          definitionsWithSuggestions: definitionLookupResult.summary?.definitionsWithSuggestions || 0
        } : null
      });

      return {
        success: true,
        source: source,
        schema: schema,
        recordCount: source.recordCount,
        fieldCount: schema.fields.length,
        stubDefinitions: stubDefinitions,
        definitionLookup: definitionLookupResult
      };

    } catch (error) {
      this._emitProgress('failed', {
        fileName: file.name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Import a file and split into multiple Sources based on a type field.
   * Use when data contains records with different schemas (e.g., images, documents, videos).
   *
   * @param {File} file - The file to import
   * @param {Object} options - Import options
   * @param {Object} options.schemaDivergence - Schema divergence analysis from ImportAnalyzer
   * @param {Object} options.provenance - EO 9-element provenance
   * @returns {Promise<{success: boolean, sources: Array, parentSourceId: string}>}
   */
  async importToSources(file, options = {}) {
    const startTime = Date.now();
    const importedAt = new Date().toISOString();
    const schemaDivergence = options.schemaDivergence;

    if (!schemaDivergence || !schemaDivergence.typeField) {
      // Fall back to single source import
      return this.importToSource(file, options);
    }

    this._emitProgress('started', {
      fileName: file.name,
      fileSize: file.size,
      phase: 'reading',
      mode: 'split_sources'
    });

    try {
      // Step 1: Read and parse the file
      const text = await this._readFile(file);

      this._emitProgress('progress', {
        phase: 'parsing',
        percentage: 10
      });

      const fileName = file.name.toLowerCase();
      const isICS = fileName.endsWith('.ics') || file.type === 'text/calendar';
      const isCSV = fileName.endsWith('.csv') ||
                    file.type === 'text/csv' ||
                    (!isICS && !this._isJSON(text));

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

      // Step 2: Compute content hash for parent reference
      let contentHash = null;
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(text);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
          // Hash computation is optional
        }
      }

      // Step 3: Group records by type
      const typeField = schemaDivergence.typeField;
      const { headers, rows } = parseResult;

      const rowsByType = {};
      for (const row of rows) {
        const typeValue = row[typeField] || '_untyped';
        if (!rowsByType[typeValue]) {
          rowsByType[typeValue] = [];
        }
        rowsByType[typeValue].push(row);
      }

      const typeValues = Object.keys(rowsByType);

      this._emitProgress('progress', {
        phase: 'splitting',
        percentage: 30,
        typeCount: typeValues.length
      });

      // Step 4: Create a source for each type
      const createdSources = [];
      const baseFileName = file.name.replace(/\.(csv|json|xlsx|xls|ics)$/i, '');
      let processed = 0;

      for (const typeValue of typeValues) {
        const typeRows = rowsByType[typeValue];
        const typeName = this._formatViewName(typeValue);
        const sourceName = `${baseFileName} - ${typeName}`;

        // Find headers that are actually used by this type
        const usedHeaders = headers.filter(header => {
          if (header === typeField) return false; // Skip type field itself
          return typeRows.some(row => {
            const val = row[header];
            return val !== null && val !== undefined && val !== '';
          });
        });

        // Infer schema for this type's data
        const typeSchema = this.schemaInferrer.inferSchema(usedHeaders, typeRows);

        // Create the source
        const sourceId = 'src_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8);

        const source = {
          id: sourceId,
          name: sourceName,
          type: 'source',

          // Records for this type only
          records: typeRows,
          recordCount: typeRows.length,

          // Type-specific schema
          schema: {
            fields: typeSchema.fields || usedHeaders.map(h => ({
              name: h,
              type: 'text',
              sourceColumn: h
            })),
            inferenceDecisions: typeSchema.inferenceDecisions || null
          },

          // File metadata (shared reference to original file)
          fileIdentity: {
            originalFilename: file.name,
            splitSourceName: sourceName,
            contentHash: contentHash,
            rawSize: file.size,
            encoding: 'utf-8',
            mimeType: mimeType,
            lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null
          },

          // Provenance
          provenance: {
            agent: options.provenance?.agent || null,
            method: options.provenance?.method || `${isICS ? 'ICS' : isCSV ? 'CSV' : 'JSON'} import (split by ${typeField})`,
            source: options.provenance?.source || file.name,
            term: options.provenance?.term || null,
            definition: options.provenance?.definition || null,
            jurisdiction: options.provenance?.jurisdiction || null,
            scale: options.provenance?.scale || null,
            timeframe: options.provenance?.timeframe || null,
            background: options.provenance?.background || null
          },

          // Split metadata
          splitInfo: {
            typeField: typeField,
            typeValue: typeValue,
            originalFileName: file.name,
            siblingTypes: typeValues.filter(t => t !== typeValue)
          },

          // Parsing decisions
          parsingDecisions: parseResult.parsingDecisions || {
            delimiter: parseResult.delimiter,
            hasHeaders: parseResult.hasHeaders
          },

          // Timestamps
          importedAt: importedAt,
          createdAt: importedAt,

          // Derived sets tracking
          derivedSetIds: [],

          // Status
          status: 'active'
        };

        // Add to workbench
        if (this.workbench) {
          if (!Array.isArray(this.workbench.sources)) {
            this.workbench.sources = [];
          }
          this.workbench.sources.push(source);

          // Add source to current project
          if (typeof this.workbench._addSourceToProject === 'function') {
            this.workbench._addSourceToProject(source.id);
          }
        }

        createdSources.push({
          sourceId: source.id,
          name: sourceName,
          type: typeValue,
          recordCount: source.recordCount,
          fieldCount: source.schema.fields.length
        });

        processed++;

        this._emitProgress('progress', {
          phase: 'creating_sources',
          percentage: 30 + Math.round((processed / typeValues.length) * 60),
          currentType: typeName,
          typesProcessed: processed,
          totalTypes: typeValues.length
        });

        // Yield to prevent UI blocking
        await new Promise(r => setTimeout(r, 0));
      }

      // Step 5: Save data
      if (this.workbench && typeof this.workbench._saveData === 'function') {
        this.workbench._saveData();
        console.log('ImportOrchestrator: Split sources saved to localStorage', {
          sourcesCreated: createdSources.length,
          totalRecords: rows.length
        });
      }

      this._emitProgress('completed', {
        fileName: file.name,
        sourcesCreated: createdSources.length,
        recordCount: rows.length,
        duration: Date.now() - startTime,
        mode: 'split_sources'
      });

      return {
        success: true,
        sources: createdSources,
        totalRecordCount: rows.length,
        typeField: typeField
      };

    } catch (error) {
      this._emitProgress('failed', {
        fileName: file.name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get the SourceStore instance
   * Returns workbench.sourceStore if available, otherwise creates one
   */
  _getSourceStore() {
    if (this.workbench?.sourceStore) {
      return this.workbench.sourceStore;
    }

    // Create and attach to workbench
    if (this.workbench) {
      this.workbench.sourceStore = this._createSourceStore();
      return this.workbench.sourceStore;
    }

    return this._createSourceStore();
  }

  /**
   * Create a source store instance
   */
  _createSourceStore() {
    const sources = new Map();
    return {
      sources: sources,
      createSource(config) {
        const id = 'src_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8);
        const source = {
          id,
          name: config.name,
          type: 'source',
          records: config.records,
          recordCount: config.records.length,
          schema: config.schema,
          provenance: config.provenance,
          fileIdentity: config.fileMetadata,
          parsingDecisions: config.parseResult?.parsingDecisions || null,
          importedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          derivedSetIds: [],
          status: 'active'
        };
        sources.set(id, source);
        return source;
      },
      get(id) { return sources.get(id); },
      getAll() { return Array.from(sources.values()); },
      getByStatus(status) { return this.getAll().filter(s => s.status === status); }
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
   * Flatten nested objects into dot-notation keys
   * e.g., {address: {city: "NYC", zip: "10001"}} -> {"address.city": "NYC", "address.zip": "10001"}
   */
  _flattenObject(obj, prefix = '', result = {}) {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        this._flattenObject(value, newKey, result);
      } else {
        // Keep primitives and arrays as-is
        result[newKey] = value;
      }
    }
    return result;
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
    } else if (this._isEOAwareFormat(data)) {
      // EO-Aware import format with dataset, schema_semantics, and interpretation
      return this._parseEOAwareJSON(data);
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

    // Handle arrays of primitives (strings, numbers, etc.)
    // If the first record is not an object, wrap all records in objects with a "value" field
    if (records.length > 0 && (typeof records[0] !== 'object' || records[0] === null)) {
      records = records.map(item => ({ value: item }));
    }

    // Flatten nested objects into dot-notation keys
    // e.g., {address: {city: "NYC"}} -> {"address.city": "NYC"}
    records = records.map(record => this._flattenObject(record));

    // Extract headers from ALL records to capture fields that may be missing in some records
    // Preserve order from first record, then add any additional fields found in other records
    const headerSet = new Set();
    const headers = [];

    // First, add headers from the first record (preserves original order)
    for (const key of Object.keys(records[0])) {
      if (!key.startsWith('_')) {
        headers.push(key);
        headerSet.add(key);
      }
    }

    // Then scan remaining records for any additional fields
    for (let i = 1; i < records.length; i++) {
      for (const key of Object.keys(records[i])) {
        if (!key.startsWith('_') && !headerSet.has(key)) {
          headers.push(key);
          headerSet.add(key);
        }
      }
    }

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

  // ─────────────────────────────────────────────────────────────────────────
  // EO-Aware Import Format Support
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if data is in EO-Aware format
   *
   * EO-Aware format has:
   * - dataset: { id, source, ingested_at, data[] }
   * - schema_semantics: [ SchemaSemantic[] ]
   * - interpretation: { InterpretationBinding }
   */
  _isEOAwareFormat(data) {
    return (
      data &&
      typeof data === 'object' &&
      data.dataset &&
      typeof data.dataset === 'object' &&
      Array.isArray(data.dataset.data)
    );
  }

  /**
   * Parse EO-Aware JSON format
   *
   * Returns parsed result with embedded semantic and interpretation metadata
   */
  _parseEOAwareJSON(data) {
    const dataset = data.dataset;
    const schemaSemantics = data.schema_semantics || [];
    const interpretation = data.interpretation || null;

    // Extract records from dataset.data
    let records = dataset.data || [];

    // Flatten nested objects if needed
    records = records.map(record => this._flattenObject(record));

    // Build headers from records
    const headerSet = new Set();
    const headers = [];

    for (const record of records) {
      for (const key of Object.keys(record)) {
        if (!key.startsWith('_') && !headerSet.has(key)) {
          headers.push(key);
          headerSet.add(key);
        }
      }
    }

    // Return with EO-aware metadata attached
    return {
      headers,
      rows: records,
      hasHeaders: true,
      totalRows: records.length,
      fileType: 'eo_aware_json',
      eoAware: {
        datasetId: dataset.id,
        datasetSource: dataset.source,
        ingestedAt: dataset.ingested_at,
        schemaSemantics,
        interpretation
      }
    };
  }

  /**
   * Validate EO-Aware import data
   *
   * Validates according to EO rules:
   * - Reject if interpretation present but agent missing
   * - Reject if semantic_uri referenced but not defined
   * - Reject if column has multiple conflicting bindings
   * - Reject if semantic definition changed without version bump
   * - Warn if jurisdiction/scale/background missing
   */
  validateEOAwareImport(data) {
    const errors = [];
    const warnings = [];

    if (!data || !data.dataset) {
      errors.push('Missing dataset object');
      return { valid: false, errors, warnings };
    }

    // Check dataset
    if (!data.dataset.data || !Array.isArray(data.dataset.data)) {
      errors.push('Dataset must have data array');
    }

    // Check interpretation
    const interpretation = data.interpretation;
    if (interpretation) {
      // RULE: Agent is required
      if (!interpretation.agent || interpretation.agent.trim() === '') {
        errors.push('Interpretation present but agent is missing');
      }

      // Check bindings
      const bindings = interpretation.bindings || [];
      const semanticUris = new Set((data.schema_semantics || []).map(s => s.id));
      const columnsSeen = new Set();

      for (const binding of bindings) {
        // RULE: Semantic URI must be defined
        if (binding.semantic_uri && !semanticUris.has(binding.semantic_uri)) {
          errors.push(`Semantic URI referenced but not defined: ${binding.semantic_uri}`);
        }

        // RULE: No conflicting bindings
        if (columnsSeen.has(binding.column)) {
          errors.push(`Column has multiple conflicting bindings: ${binding.column}`);
        }
        columnsSeen.add(binding.column);
      }

      // Warnings for missing provenance
      if (!interpretation.jurisdiction) {
        warnings.push('jurisdiction_missing');
      }
      if (!interpretation.scale) {
        warnings.push('scale_unspecified');
      }
      if (!interpretation.background || interpretation.background.length === 0) {
        warnings.push('background_empty');
      }
    }

    // Check schema semantics
    for (const semantic of (data.schema_semantics || [])) {
      if (!semantic.id) {
        errors.push('Schema semantic missing id');
      }
      if (!semantic.term) {
        errors.push('Schema semantic missing term');
      }
      if (!semantic.definition) {
        warnings.push(`Schema semantic ${semantic.id} missing definition`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Process EO-Aware import
   *
   * Handles the full import workflow for EO-aware JSON:
   * 1. Validate the import data
   * 2. Import schema semantics to registry
   * 3. Import dataset as source
   * 4. Create interpretation binding
   * 5. Link dataset to interpretation
   */
  async processEOAwareImport(parseResult, options = {}) {
    const eoData = parseResult.eoAware;
    if (!eoData) {
      throw new Error('Not an EO-aware import');
    }

    const results = {
      dataset: null,
      semantics: [],
      interpretation: null,
      warnings: []
    };

    // Step 1: Import schema semantics
    if (eoData.schemaSemantics && eoData.schemaSemantics.length > 0) {
      const registry = window.EOSchemaSemantic?.getSemanticRegistry();
      if (registry) {
        for (const semanticData of eoData.schemaSemantics) {
          const semantic = new window.EOSchemaSemantic.SchemaSemantic(semanticData);
          registry.add(semantic);
          results.semantics.push(semantic);
        }
      }
    }

    // Step 2: Create interpretation binding
    if (eoData.interpretation && window.EOInterpretationBinding) {
      const binding = window.EOInterpretationBinding.createInterpretationBinding({
        ...eoData.interpretation,
        source_dataset: eoData.datasetId
      });

      const store = window.EOInterpretationBinding.getBindingStore();
      store.add(binding);
      results.interpretation = binding;

      // Record usage for each bound semantic
      const registry = window.EOSchemaSemantic?.getSemanticRegistry();
      if (registry) {
        for (const b of binding.bindings) {
          registry.recordUsage(b.semantic_uri);
        }
      }
    }

    return results;
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
   * Create stub definitions for all fields in a source
   * Implements the "keys in definitions by default" pattern
   *
   * @param {Object} source - The imported source object
   * @param {Object} options - Options
   * @returns {DefinitionSource[]} - Array of stub definitions
   */
  _createStubDefinitions(source, options = {}) {
    const createStubDefinitionsForSource = typeof window !== 'undefined' &&
      window.EO?.createStubDefinitionsForSource;

    if (!createStubDefinitionsForSource) {
      console.log('ImportOrchestrator: createStubDefinitionsForSource not available');
      return [];
    }

    const stubDefinitions = createStubDefinitionsForSource(source);

    // Auto-import stub definitions into workbench.definitions array
    if (this.workbench?.definitions && Array.isArray(this.workbench.definitions)) {
      const addedDefinitions = [];

      for (const defSource of stubDefinitions) {
        // Convert DefinitionSource stub to internal definition format
        const internalDef = this._convertStubToInternalDefinition(defSource, source);

        // Check for duplicates by term name
        const existingDef = this.workbench.definitions.find(d =>
          d.terms?.[0]?.name === defSource.term?.term ||
          d.name === internalDef.name
        );

        if (!existingDef) {
          this.workbench.definitions.push(internalDef);
          addedDefinitions.push(internalDef);
        }
      }

      // Add definitions to current project
      if (addedDefinitions.length > 0 && typeof this.workbench._addDefinitionToProject === 'function') {
        for (const def of addedDefinitions) {
          this.workbench._addDefinitionToProject(def.id);
        }
      }

      console.log('ImportOrchestrator: Added', addedDefinitions.length, 'stub definitions to workbench');
    } else {
      // Fallback: store in source's local definitions
      source.stubDefinitions = stubDefinitions;
      console.log('ImportOrchestrator: Stored stub definitions in source (workbench.definitions not available)');
    }

    return stubDefinitions;
  }

  /**
   * Convert a DefinitionSource stub to internal definition format
   * Handles stubs which don't have authority/source/validity populated yet
   *
   * @param {Object} defSource - DefinitionSource stub object
   * @param {Object} source - The data source the key came from
   * @returns {Object} - Internal definition format for workbench
   */
  _convertStubToInternalDefinition(defSource, source) {
    const id = defSource.id || `def_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // For stubs, name is just the term since we don't have authority yet
    const termLabel = defSource.term?.label || defSource.term?.term || 'Unknown';
    const name = termLabel;

    // Create term entry
    const term = {
      id: `term_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: defSource.term?.term || '',
      label: defSource.term?.label || defSource.term?.term,
      type: 'stub',
      description: defSource.term?.definitionText || null,
      fieldType: defSource.discoveredFrom?.fieldType || null
    };

    return {
      id,
      name,
      description: `Key from ${source?.name || 'imported data'}`,
      sourceUri: null,
      format: 'stub',
      importedAt: new Date().toISOString(),
      status: defSource.status || 'stub',
      populationMethod: defSource.populationMethod || 'pending',
      terms: [term],

      // Track origin - includes all source field properties for matching and dictionary table
      discoveredFrom: {
        sourceId: source?.id || defSource.discoveredFrom?.sourceId,
        sourceName: source?.name || defSource.discoveredFrom?.sourceName,
        fieldId: defSource.discoveredFrom?.fieldId || defSource.term?.term,
        fieldName: defSource.discoveredFrom?.fieldName || defSource.term?.term,
        fieldType: defSource.discoveredFrom?.fieldType,
        fieldConfidence: defSource.discoveredFrom?.fieldConfidence ?? null,
        fieldIsPrimary: defSource.discoveredFrom?.fieldIsPrimary ?? null,
        fieldSamples: defSource.discoveredFrom?.fieldSamples || null,
        fieldOptions: defSource.discoveredFrom?.fieldOptions || null,
        fieldUniqueValues: defSource.discoveredFrom?.fieldUniqueValues || null,
        fieldSampleCount: defSource.discoveredFrom?.fieldSampleCount ?? null,
        fieldUniqueCount: defSource.discoveredFrom?.fieldUniqueCount ?? null,
        discoveredAt: defSource.discoveredFrom?.discoveredAt || new Date().toISOString()
      },

      // Store full DefinitionSource for later population
      definitionSource: {
        term: defSource.term,
        authority: defSource.authority || null,
        source: defSource.source || null,
        version: defSource.version || null,
        validity: defSource.validity || null,
        jurisdiction: defSource.jurisdiction || null,
        status: defSource.status,
        populationMethod: defSource.populationMethod,
        apiSuggestions: defSource.apiSuggestions || [],
        discoveredFrom: defSource.discoveredFrom || null
      }
    };
  }

  /**
   * Trigger definition lookups for imported keys
   *
   * Calls external APIs (Wikidata, eCFR, Federal Register) to find
   * definition details for each key/field in the imported source.
   * Now populates stub definitions with apiSuggestions instead of creating new suggestions.
   *
   * @param {Object} source - The imported source object
   * @param {DefinitionSource[]} stubDefinitions - The stub definitions to populate
   * @param {Object} options - Import options
   * @returns {Promise<Object|null>} - Lookup results or null if unavailable
   */
  async _triggerDefinitionLookup(source, stubDefinitions = [], options = {}) {
    // Check if KeyDefinitionLookup is available
    const getEnricher = typeof window !== 'undefined' && window.EO?.getImportDefinitionEnricher;
    if (!getEnricher) {
      console.log('ImportOrchestrator: KeyDefinitionLookup not loaded, skipping definition lookup');
      return null;
    }

    try {
      const enricher = getEnricher();
      if (!enricher) {
        return null;
      }

      console.log('ImportOrchestrator: Starting definition lookup for', source.schema?.fields?.length || 0, 'keys');

      // Enrich the source with definition lookups
      await enricher.enrichSource(source, {
        sourceId: source.id,
        frame: {
          id: source.id,
          type: 'source',
          name: source.name
        },
        provenance: source.provenance || options.provenance
      });

      const results = enricher.getSourceLookupResults(source);

      // NEW: Attach API results to stub definitions as apiSuggestions
      let definitionsWithSuggestions = 0;
      if (results?.keys && stubDefinitions.length > 0) {
        for (const keyResult of results.keys) {
          const stubDef = stubDefinitions.find(d => d.term.term === keyResult.key);
          if (stubDef && (keyResult.matches?.length > 0 || keyResult.regulatoryMatches?.length > 0)) {
            // Build API suggestions from lookup results
            const apiSuggestions = [];

            // Add concept matches as suggestions
            for (const match of (keyResult.matches || [])) {
              apiSuggestions.push({
                source: match.source || 'wikidata',
                uri: match.uri || match.id,
                confidence: keyResult.confidence || 0.5,
                authority: keyResult.suggestedDefinition?.authority || null,
                validity: keyResult.suggestedDefinition?.validity || null,
                jurisdiction: keyResult.suggestedDefinition?.jurisdiction || null,
                definitionText: match.description || null,
                label: match.label || null
              });
            }

            // Add regulatory matches as suggestions
            for (const match of (keyResult.regulatoryMatches || [])) {
              apiSuggestions.push({
                source: match.source || 'ecfr',
                uri: match.url || null,
                confidence: (keyResult.confidence || 0.5) + 0.1, // Regulatory slightly higher
                authority: keyResult.suggestedDefinition?.authority || null,
                validity: keyResult.suggestedDefinition?.validity || null,
                jurisdiction: keyResult.suggestedDefinition?.jurisdiction || null,
                definitionText: match.snippet || null,
                citation: match.citation || null
              });
            }

            if (apiSuggestions.length > 0) {
              stubDef.apiSuggestions = apiSuggestions;
              stubDef.updatedAt = new Date().toISOString();
              definitionsWithSuggestions++;

              // Also sync API suggestions back to workbench definitions
              if (this.workbench?.definitions && Array.isArray(this.workbench.definitions)) {
                const internalDef = this.workbench.definitions.find(d =>
                  d.terms?.[0]?.name === keyResult.key ||
                  d.discoveredFrom?.fieldName === keyResult.key
                );
                if (internalDef && internalDef.definitionSource) {
                  internalDef.definitionSource.apiSuggestions = apiSuggestions;
                  internalDef.definitionSource.updatedAt = stubDef.updatedAt;
                }
              }
            }
          }
        }
      }

      // Trigger re-render of definitions panel if workbench has the method
      if (this.workbench?._renderDefinitionsNav) {
        this.workbench._renderDefinitionsNav();
      }

      if (results) {
        results.summary = results.summary || {};
        results.summary.definitionsWithSuggestions = definitionsWithSuggestions;

        console.log('ImportOrchestrator: Definition lookup complete', {
          totalKeys: results.summary?.totalKeys,
          keysWithMatches: results.summary?.keysWithMatches,
          keysWithAuthority: results.summary?.keysWithAuthority,
          keysWithRegulatory: results.summary?.keysWithRegulatory,
          definitionsWithSuggestions
        });
      }

      return results;

    } catch (error) {
      console.warn('ImportOrchestrator: Definition lookup error:', error);
      return null;
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

      // Schema divergence detection (for split by type)
      schemaDivergence: null,

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

    // Analyze schema divergence by type field
    if (analysis.viewSplitCandidates.length > 0) {
      analysis.schemaDivergence = this._analyzeSchemaByType(parseResult, analysis.viewSplitCandidates);
    }

    // Detect embedded provenance
    const provAnalysis = this._detectEmbeddedProvenance(parseResult);
    analysis.hasEmbeddedProvenance = provAnalysis.found;
    analysis.provenanceFields = provAnalysis.fields;

    return analysis;
  }

  /**
   * Analyze schema differences across type values
   * Returns divergence info if different types have significantly different fields
   */
  _analyzeSchemaByType(parseResult, viewSplitCandidates) {
    const rows = parseResult.rows || [];
    const headers = parseResult.headers || [];

    if (rows.length < 2 || headers.length < 2) return null;

    // Use the best split candidate (usually 'type' field or first candidate)
    const typeCandidate = viewSplitCandidates.find(c =>
      c.field.toLowerCase() === 'type' ||
      c.field.toLowerCase() === 'filetype' ||
      c.field.toLowerCase() === '_type'
    ) || viewSplitCandidates[0];

    if (!typeCandidate || typeCandidate.uniqueCount < 2) return null;

    const typeField = typeCandidate.field;

    // Group rows by type and track which fields have values
    const typeSchemas = {};

    for (const row of rows) {
      const typeValue = row[typeField] || '_untyped';

      if (!typeSchemas[typeValue]) {
        typeSchemas[typeValue] = {
          count: 0,
          fieldsWithValues: new Set(),
          sampleRecord: row
        };
      }

      typeSchemas[typeValue].count++;

      // Track which fields have non-empty values
      for (const header of headers) {
        const val = row[header];
        if (val !== null && val !== undefined && val !== '') {
          typeSchemas[typeValue].fieldsWithValues.add(header);
        }
      }
    }

    // Calculate overlap between type schemas
    const types = Object.keys(typeSchemas);
    if (types.length < 2) return null;

    // Get all unique fields across all types (excluding type field itself)
    const allFields = new Set();
    for (const type of types) {
      for (const field of typeSchemas[type].fieldsWithValues) {
        if (field !== typeField) allFields.add(field);
      }
    }

    // Find fields that are common to ALL types vs type-specific
    const commonFields = new Set();
    const typeSpecificFields = {};

    for (const field of allFields) {
      const typesWithField = types.filter(t => typeSchemas[t].fieldsWithValues.has(field));
      if (typesWithField.length === types.length) {
        commonFields.add(field);
      } else {
        // Track which types have this field
        for (const t of typesWithField) {
          if (!typeSpecificFields[t]) typeSpecificFields[t] = new Set();
          typeSpecificFields[t].add(field);
        }
      }
    }

    // Calculate divergence score (0 = all same, 1 = completely different)
    const totalFields = allFields.size;
    const commonFieldCount = commonFields.size;
    const divergenceScore = totalFields > 0 ? 1 - (commonFieldCount / totalFields) : 0;

    // Build type info for UI
    const typeInfo = types.map(type => {
      const schema = typeSchemas[type];
      const specificFields = typeSpecificFields[type] || new Set();
      return {
        type,
        count: schema.count,
        totalFields: schema.fieldsWithValues.size - 1, // -1 for type field itself
        specificFields: [...specificFields],
        specificFieldCount: specificFields.size
      };
    }).sort((a, b) => b.count - a.count);

    // Recommend split if divergence is significant (>30% type-specific fields)
    const shouldSplit = divergenceScore > 0.3 ||
                        typeInfo.some(t => t.specificFieldCount >= 2);

    return {
      typeField,
      divergenceScore,
      shouldSplit,
      commonFields: [...commonFields],
      commonFieldCount,
      totalFieldCount: totalFields,
      types: typeInfo,
      summary: shouldSplit
        ? `${types.length} types with ${Math.round(divergenceScore * 100)}% field divergence`
        : null
    };
  }

  /**
   * Extract a balanced array from text starting at a given position.
   * Handles nested brackets, strings (with escaped quotes), and comments.
   */
  _extractBalancedArray(text, startIndex) {
    let depth = 0;
    let inString = false;
    let stringChar = null;
    let escaped = false;
    let arrayStart = -1;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';

      // Handle escape sequences
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }

      // Handle string boundaries
      if ((char === '"' || char === "'" || char === '`') && !inString) {
        inString = true;
        stringChar = char;
        continue;
      }
      if (char === stringChar && inString) {
        inString = false;
        stringChar = null;
        continue;
      }

      // Skip content inside strings
      if (inString) continue;

      // Handle brackets
      if (char === '[') {
        if (depth === 0) arrayStart = i;
        depth++;
      } else if (char === ']') {
        depth--;
        if (depth === 0 && arrayStart !== -1) {
          return text.substring(arrayStart, i + 1);
        }
      }
    }
    return null;
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
          // Find the start position of each array and extract with balanced bracket matching
          const nodeStart = rawText.match(/(?:const|let|var)\s+nodes\s*=\s*/);
          const edgeStart = rawText.match(/(?:const|let|var)\s+edges\s*=\s*/);
          const edgeEventsStart = rawText.match(/(?:const|let|var)\s+edgeEvents\s*=\s*/);

          // Extract nodes array with balanced brackets
          if (nodeStart) {
            const startIdx = rawText.indexOf(nodeStart[0]) + nodeStart[0].length;
            const nodesArray = this._extractBalancedArray(rawText, startIdx);
            if (nodesArray) {
              try {
                const fn = new Function('return ' + nodesArray);
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
          }

          // Extract edges array with balanced brackets
          if (edgeStart) {
            const startIdx = rawText.indexOf(edgeStart[0]) + edgeStart[0].length;
            const edgesArray = this._extractBalancedArray(rawText, startIdx);
            if (edgesArray) {
              try {
                const fn = new Function('return ' + edgesArray);
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
          }

          // Extract edgeEvents array with balanced brackets
          if (edgeEventsStart) {
            const startIdx = rawText.indexOf(edgeEventsStart[0]) + edgeEventsStart[0].length;
            const edgeEventsArray = this._extractBalancedArray(rawText, startIdx);
            if (edgeEventsArray) {
              try {
                const fn = new Function('return ' + edgeEventsArray);
                result.edgeEvents = fn();
              } catch (e) {
                console.warn('Failed to parse edgeEvents:', e);
              }
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
    ? '.csv,.tsv,.json,.xlsx,.xls,.numbers,.ods,.ics'
    : '.csv,.tsv,.json,.ics';

  const dropzoneText = ExcelParser.isAvailable()
    ? 'Drop spreadsheet or data file here'
    : 'Drop CSV, TSV, JSON, or ICS file here';

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

        <!-- Schema Divergence Banner (for split sources) -->
        <div class="import-split-detected" id="import-split-detected" style="display: none;">
          <div class="split-detected-header">
            <div class="split-detected-icon">
              <i class="ph ph-git-branch"></i>
            </div>
            <div class="split-detected-content">
              <strong>Different Record Types Detected</strong>
              <p id="split-detected-info">Records have different fields based on type</p>
            </div>
          </div>
          <div class="split-type-chips" id="split-type-chips"></div>
          <div class="split-options">
            <label class="checkbox-label split-option-label">
              <input type="checkbox" id="import-split-sources" checked>
              <span>Split into separate sources by type</span>
            </label>
            <p class="option-hint">Each type becomes its own source with only its relevant fields</p>
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
              <input type="radio" name="import-type-handling" id="import-create-views" value="views" checked>
              <span>Create views by type</span>
            </label>
            <p class="option-hint">Recommended - One dataset with filtered views per type, hiding irrelevant fields</p>
          </div>
          <div class="view-option">
            <label class="checkbox-label">
              <input type="radio" name="import-type-handling" id="import-separate-sets" value="sets">
              <span>Create separate datasets per type</span>
            </label>
            <p class="option-hint">Each type becomes its own dataset with only its fields</p>
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
          <div class="preview-sample-header">
            <h4>Sample Data</h4>
            <div class="preview-view-toggle" id="preview-view-toggle" style="display: none;">
              <button class="preview-view-btn active" data-mode="unified" title="View all records in one table">
                <i class="ph ph-table"></i>
                <span>Unified</span>
              </button>
              <button class="preview-view-btn" data-mode="split" title="View records split by type">
                <i class="ph ph-rows"></i>
                <span>By Type</span>
              </button>
            </div>
          </div>
          <div class="sample-table-wrapper" id="sample-table-wrapper">
            <table class="sample-table" id="sample-table">
            </table>
          </div>
        </div>

        <!-- Provenance Section - All 9 EO Categories -->
        <div class="import-provenance-section">
          <div class="import-provenance-title">
            <i class="ph ph-fingerprint"></i>
            Provenance <span class="provenance-optional">(recommended)</span>
          </div>
          <div class="import-provenance-subtitle">
            Add context about where this data comes from. The system auto-tracks file identity, timestamp, and import method.
          </div>

          <!-- Epistemic Triad: How was this produced? -->
          <div class="import-provenance-triad">
            <div class="import-provenance-triad-header">
              <i class="ph ph-brain"></i>
              <span class="triad-name">Epistemic</span>
              <span class="triad-question">How was this produced?</span>
            </div>
            <div class="import-provenance-grid">
              <div class="import-provenance-field">
                <label class="import-provenance-label">
                  <i class="ph ph-user"></i> Agent
                </label>
                <input type="text" class="import-provenance-input" id="prov-agent"
                       placeholder="Person, organization, or system...">
              </div>
              <div class="import-provenance-field">
                <label class="import-provenance-label">
                  <i class="ph ph-flask"></i> Method
                </label>
                <input type="text" class="import-provenance-input" id="prov-method"
                       placeholder="Export, FOIA, scrape, manual entry...">
              </div>
              <div class="import-provenance-field">
                <label class="import-provenance-label">
                  <i class="ph ph-file-text"></i> Source
                </label>
                <input type="text" class="import-provenance-input" id="prov-source"
                       placeholder="Database name, document, URL...">
              </div>
            </div>
          </div>

          <!-- Semantic Triad: What does it mean? -->
          <div class="import-provenance-triad">
            <div class="import-provenance-triad-header">
              <i class="ph ph-book-open"></i>
              <span class="triad-name">Semantic</span>
              <span class="triad-question">What does it mean?</span>
            </div>
            <div class="import-provenance-grid">
              <div class="import-provenance-field">
                <label class="import-provenance-label">
                  <i class="ph ph-bookmark"></i> Term
                </label>
                <input type="text" class="import-provenance-input" id="prov-term"
                       placeholder="Key concept, entity type...">
              </div>
              <div class="import-provenance-field">
                <label class="import-provenance-label">
                  <i class="ph ph-book-open"></i> Definition
                </label>
                <input type="text" class="import-provenance-input" id="prov-definition"
                       placeholder="What this term means here...">
              </div>
              <div class="import-provenance-field">
                <label class="import-provenance-label">
                  <i class="ph ph-map-pin"></i> Jurisdiction
                </label>
                <input type="text" class="import-provenance-input" id="prov-jurisdiction"
                       placeholder="City of Riverside, US Federal...">
              </div>
            </div>
          </div>

          <!-- Situational Triad: When/where does it hold? -->
          <div class="import-provenance-triad">
            <div class="import-provenance-triad-header">
              <i class="ph ph-compass"></i>
              <span class="triad-name">Situational</span>
              <span class="triad-question">When/where does it hold?</span>
            </div>
            <div class="import-provenance-grid">
              <div class="import-provenance-field">
                <label class="import-provenance-label">
                  <i class="ph ph-arrows-out"></i> Scale
                </label>
                <input type="text" class="import-provenance-input" id="prov-scale"
                       placeholder="Individual, department, citywide...">
              </div>
              <div class="import-provenance-field">
                <label class="import-provenance-label">
                  <i class="ph ph-calendar"></i> Timeframe
                </label>
                <input type="text" class="import-provenance-input" id="prov-timeframe"
                       placeholder="2019-2024, as of March 2024...">
              </div>
              <div class="import-provenance-field">
                <label class="import-provenance-label">
                  <i class="ph ph-info"></i> Background
                </label>
                <input type="text" class="import-provenance-input" id="prov-background"
                       placeholder="During investigation, post-COVID...">
              </div>
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

  // Get workbench reference and ensure sourceStore is initialized
  const workbench = typeof getDataWorkbench === 'function' ? getDataWorkbench() : null;
  if (workbench) {
    // CRITICAL: Initialize the sourceStore on the workbench BEFORE creating orchestrator
    // This ensures the import uses the same sourceStore as the workbench display
    if (!workbench.sourceStore) {
      // Initialize sourceStore if it doesn't exist
      if (typeof SourceStore !== 'undefined') {
        const eventStore = workbench.eoApp?.eventStore || null;
        workbench.sourceStore = new SourceStore(eventStore);
      } else {
        // Fallback: create simple in-memory store
        workbench.sourceStore = createSimpleSourceStore();
      }
    }
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
    const validExtensions = ['.csv', '.tsv', '.json', '.xlsx', '.xls', '.numbers', '.ods', '.ics'];
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

    // Collect all 9 provenance fields
    const provenance = {
      // Epistemic triad
      agent: document.getElementById('prov-agent')?.value || null,
      method: document.getElementById('prov-method')?.value || null,
      source: document.getElementById('prov-source')?.value || null,
      // Semantic triad
      term: document.getElementById('prov-term')?.value || null,
      definition: document.getElementById('prov-definition')?.value || null,
      jurisdiction: document.getElementById('prov-jurisdiction')?.value || null,
      // Situational triad
      scale: document.getElementById('prov-scale')?.value || null,
      timeframe: document.getElementById('prov-timeframe')?.value || null,
      background: document.getElementById('prov-background')?.value || null
    };

    try {
      // Listen for progress events
      const progressHandler = (e) => {
        updateProgress(e.detail);
      };
      window.addEventListener('eo-import-progress', progressHandler);

      let result;

      // Check if split sources is enabled
      const splitSourcesEnabled = document.getElementById('import-split-sources')?.checked;
      const shouldSplitSources = splitSourcesEnabled && analysisData?.schemaDivergence?.shouldSplit;

      if (shouldSplitSources) {
        // Import as multiple Sources split by type
        result = await orchestrator.importToSources(currentFile, {
          provenance,
          originalSource: rawFileContent,
          schemaDivergence: analysisData.schemaDivergence
        });

        window.removeEventListener('eo-import-progress', progressHandler);

        // Show success for split sources import
        progressSection.style.display = 'none';
        successSection.style.display = 'flex';

        document.getElementById('success-message').textContent =
          `Successfully imported ${result.totalRecordCount} records into ${result.sources.length} Sources`;

        // Show created sources info
        const sourcesList = result.sources.map(s =>
          `<span style="display: inline-block; padding: 2px 8px; margin: 2px; background: var(--bg-tertiary); border-radius: 4px;">
            ${s.name} (${s.recordCount})
          </span>`
        ).join('');
        document.getElementById('success-views-created').innerHTML = `
          <div style="margin-top: 8px;"><i class="ph ph-git-branch"></i> Split by <strong>${result.typeField}</strong>:</div>
          <div style="margin-top: 6px;">${sourcesList}</div>
          <div style="margin-top: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
            <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">
              Each source has its own schema with only relevant fields.
              Click on a source in the sidebar to view and create Sets.
            </p>
          </div>
        `;

        // Refresh workbench sidebar to show new sources
        if (workbench?._renderSidebar) {
          workbench._renderSidebar();
        }

        // Record activity for each imported source
        if (workbench?._recordActivity) {
          for (const source of result.sources) {
            workbench._recordActivity({
              action: 'create',
              entityType: 'source',
              name: source.name,
              details: `${source.recordCount} records imported from "${currentFile.name}"`,
              canReverse: false
            });
          }
        }

        // Navigate to the first created source after modal closes
        if (workbench?._showSourceDetail && result.sources?.[0]?.sourceId) {
          setTimeout(() => {
            workbench._showSourceDetail(result.sources[0].sourceId);
          }, 1900);
        }

      } else {
        // Import as single Source (default)
        result = await orchestrator.importToSource(currentFile, {
          provenance,
          originalSource: rawFileContent,
          schemaDivergence: analysisData?.schemaDivergence
        });

        window.removeEventListener('eo-import-progress', progressHandler);

        // Show success for source import
        progressSection.style.display = 'none';
        successSection.style.display = 'flex';

        document.getElementById('success-message').textContent =
          `Successfully imported ${result.recordCount} records as Source`;

        // Show next steps info
        document.getElementById('success-views-created').innerHTML = `
          <div style="margin-top: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
            <p style="margin: 0 0 8px 0; font-weight: 500;">
              <i class="ph ph-info"></i> Next Steps
            </p>
            <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">
              Click on the source in the sidebar to view data, then use
              <strong>"Create Set"</strong> to select fields and create a Set,
              or <strong>"Join"</strong> to combine with other sources.
            </p>
          </div>
        `;

        // Refresh workbench sidebar to show new source
        if (workbench?._renderSidebar) {
          workbench._renderSidebar();
        }

        // Record activity for the imported source
        if (workbench?._recordActivity && result.source) {
          workbench._recordActivity({
            action: 'create',
            entityType: 'source',
            name: result.source.name || currentFile.name,
            details: `${result.recordCount} records imported from "${currentFile.name}"`,
            canReverse: false
          });
        }

        // Navigate to the newly imported source after modal closes
        if (workbench?._showSourceDetail && result.source?.id) {
          setTimeout(() => {
            workbench._showSourceDetail(result.source.id);
          }, 1900); // After modal close delay (1800ms)
        }
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
      const fileName = file.name.toLowerCase();
      const isSpreadsheet = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ||
                           fileName.endsWith('.numbers') || fileName.endsWith('.ods');

      if (isSpreadsheet) {
        // Handle spreadsheet files (Excel, Numbers, ODS)
        if (!ExcelParser.isAvailable()) {
          throw new Error('Spreadsheet support requires the SheetJS library');
        }
        const buffer = await readFileAsArrayBuffer(file);
        rawFileContent = buffer; // Store as binary for spreadsheet
        const excelParser = new ExcelParser();
        const excelData = excelParser.parse(buffer);

        // For spreadsheet files, use first sheet for preview (or combine all)
        if (excelData.sheets.length === 0) {
          throw new Error('No data found in spreadsheet file');
        }

        // Combine all sheets for preview
        const firstSheet = excelData.sheets[0];
        previewData = {
          fileName: file.name,
          fileSize: file.size,
          isCSV: false,
          isSpreadsheet: true,
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
      if (isSpreadsheet) {
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

      // Show schema divergence banner (for source mode split)
      const splitBanner = document.getElementById('import-split-detected');
      const splitChips = document.getElementById('split-type-chips');
      if (analysisData.schemaDivergence?.shouldSplit && !analysisData.isGraphData) {
        splitBanner.style.display = 'block';
        const divergence = analysisData.schemaDivergence;

        // Update info text
        document.getElementById('split-detected-info').textContent =
          `${divergence.types.length} types with ${Math.round(divergence.divergenceScore * 100)}% field divergence`;

        // Build type chips
        splitChips.innerHTML = divergence.types.slice(0, 6).map(t => `
          <span class="split-type-chip">
            <span class="chip-name">${escapeHtml(t.type)}</span>
            <span class="chip-count">(${t.count})</span>
            ${t.specificFieldCount > 0 ? `<span class="chip-fields">+${t.specificFieldCount} fields</span>` : ''}
          </span>
        `).join('') + (divergence.types.length > 6 ? '<span class="split-type-chip">...</span>' : '');
      } else {
        splitBanner.style.display = 'none';
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

      // Sample table with view mode toggle
      const sampleTableWrapper = document.getElementById('sample-table-wrapper');
      const viewToggle = document.getElementById('preview-view-toggle');
      let previewViewMode = 'unified';

      // Show view toggle if there's schema divergence
      const hasSchemaDivergence = analysisData.schemaDivergence?.types?.length > 1;
      viewToggle.style.display = hasSchemaDivergence ? 'flex' : 'none';

      // Function to render sample table based on view mode
      function renderPreviewSampleTable(mode) {
        previewViewMode = mode;

        // Update toggle button states
        viewToggle.querySelectorAll('.preview-view-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        if (mode === 'split' && hasSchemaDivergence) {
          // Render split tables by type
          const divergence = analysisData.schemaDivergence;
          const typeField = divergence.typeField;
          const typeColors = [
            { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' },
            { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
            { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)', text: '#f59e0b' },
            { bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.3)', text: '#8b5cf6' },
            { bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.3)', text: '#ec4899' },
          ];

          // Group rows by type
          const rowsByType = {};
          previewData.sampleRows.forEach(row => {
            const typeVal = row[typeField] || '_untyped';
            if (!rowsByType[typeVal]) rowsByType[typeVal] = [];
            rowsByType[typeVal].push(row);
          });

          // Build split tables
          sampleTableWrapper.innerHTML = divergence.types.slice(0, 4).map((typeInfo, idx) => {
            const typeRows = rowsByType[typeInfo.type] || [];
            const color = typeColors[idx % typeColors.length];
            const commonFields = divergence.commonFields.slice(0, 3);
            const specificFields = (typeInfo.specificFields || []).slice(0, 3);
            const displayFields = [...commonFields, ...specificFields];

            return `
              <div class="preview-split-section" style="border: 1px solid ${color.border}; border-radius: 6px; margin-bottom: 12px; overflow: hidden;">
                <div style="background: ${color.bg}; padding: 8px 12px; border-bottom: 2px solid ${color.border}; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-weight: 600; color: ${color.text};">${escapeHtml(typeInfo.type)}</span>
                  <span style="font-size: 11px; color: var(--text-muted);">${typeInfo.count} records</span>
                </div>
                <table class="sample-table" style="margin: 0;">
                  <thead>
                    <tr>
                      ${displayFields.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
                      ${displayFields.length < 6 && typeInfo.specificFields?.length > 3 ? '<th>...</th>' : ''}
                    </tr>
                  </thead>
                  <tbody>
                    ${typeRows.slice(0, 2).map(row => `
                      <tr>
                        ${displayFields.map(h => {
                          const val = row[h];
                          const displayVal = val === null || val === undefined ? '' :
                            (typeof val === 'object' ? JSON.stringify(val) : String(val));
                          return `<td>${escapeHtml(displayVal.substring(0, 30))}</td>`;
                        }).join('')}
                        ${displayFields.length < 6 && typeInfo.specificFields?.length > 3 ? '<td>...</td>' : ''}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `;
          }).join('');

        } else {
          // Render unified table (default)
          const displayHeaders = previewData.headers.slice(0, 6);

          // If we have schema divergence, add column shading
          let fieldTypeMap = {};
          if (hasSchemaDivergence) {
            const divergence = analysisData.schemaDivergence;
            const typeColors = [
              'rgba(59, 130, 246, 0.1)',   // blue
              'rgba(16, 185, 129, 0.1)',   // green
              'rgba(245, 158, 11, 0.1)',   // amber
              'rgba(139, 92, 246, 0.1)',   // purple
              'rgba(236, 72, 153, 0.1)',   // pink
            ];
            divergence.types.forEach((typeInfo, idx) => {
              (typeInfo.specificFields || []).forEach(f => {
                fieldTypeMap[f] = typeColors[idx % typeColors.length];
              });
            });
          }

          sampleTableWrapper.innerHTML = `
            <table class="sample-table" id="sample-table">
              <thead>
                <tr>
                  ${displayHeaders.map(h => {
                    const bgColor = fieldTypeMap[h] || '';
                    return `<th style="${bgColor ? 'background:' + bgColor : ''}">${escapeHtml(h)}</th>`;
                  }).join('')}
                  ${previewData.headers.length > 6 ? '<th>...</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${previewData.sampleRows.slice(0, 3).map(row => `
                  <tr>
                    ${displayHeaders.map(h => {
                      const val = row[h];
                      const displayVal = val === null || val === undefined ? '' :
                        (typeof val === 'object' ? JSON.stringify(val) : String(val));
                      const bgColor = fieldTypeMap[h] || '';
                      return `<td style="${bgColor ? 'background:' + bgColor : ''}">${escapeHtml(displayVal.substring(0, 40))}</td>`;
                    }).join('')}
                    ${previewData.headers.length > 6 ? '<td>...</td>' : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        }
      }

      // Initial render
      renderPreviewSampleTable('unified');

      // Handle view toggle clicks
      viewToggle.querySelectorAll('.preview-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          renderPreviewSampleTable(btn.dataset.mode);
        });
      });

      // Enable import - provenance fields are optional, system auto-tracks what it can
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
      case 'splitting_by_type':
        progressText.textContent = 'Splitting by record type...';
        progressDetail.textContent = `Found ${data.typeCount} types`;
        break;
      case 'creating_type_sets':
        progressText.textContent = `Creating dataset: ${data.currentType}`;
        progressDetail.textContent = `${data.typesProcessed} of ${data.totalTypes} types`;
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

  .preview-sample-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .preview-sample-header h4 {
    margin-bottom: 0;
  }

  .preview-view-toggle {
    display: flex;
    align-items: center;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
  }

  .preview-view-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preview-view-btn:hover {
    color: var(--text-primary);
    background: var(--bg-secondary);
  }

  .preview-view-btn.active {
    background: var(--bg-primary);
    color: var(--text-primary);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .preview-view-btn i {
    font-size: 12px;
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
    max-width: 180px;
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
    max-width: 280px;
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

  /* Schema Split Detection Banner */
  .import-split-detected {
    padding: 12px 16px;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.1));
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: var(--radius-md);
    margin-bottom: 16px;
  }

  .split-detected-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }

  .split-detected-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #22c55e;
    border-radius: 8px;
    color: white;
    font-size: 20px;
    flex-shrink: 0;
  }

  .split-detected-content strong {
    display: block;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .split-detected-content p {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0;
  }

  .split-type-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
    padding-left: 52px;
  }

  .split-type-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: var(--bg-secondary);
    border-radius: 12px;
    font-size: 12px;
    color: var(--text-primary);
  }

  .split-type-chip .chip-count {
    color: var(--text-secondary);
    font-size: 11px;
  }

  .split-type-chip .chip-fields {
    color: var(--text-tertiary);
    font-size: 10px;
  }

  .split-options {
    padding-left: 52px;
  }

  .split-option-label {
    font-weight: 500;
  }

  .split-options .option-hint {
    margin-left: 24px;
    margin-top: 2px;
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
    width: 140px;
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
    margin-bottom: 12px;
  }

  .provenance-optional {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 12px;
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

  /* Import Provenance Triads */
  .import-provenance-triad {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-primary);
  }

  .import-provenance-triad:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .import-provenance-triad-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .import-provenance-triad-header > i {
    color: var(--primary);
    font-size: 16px;
  }

  .import-provenance-triad-header .triad-name {
    font-weight: 600;
    font-size: 12px;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .import-provenance-triad-header .triad-question {
    font-size: 11px;
    color: var(--text-muted);
    margin-left: auto;
  }

  .import-provenance-label > i {
    margin-right: 4px;
    color: var(--text-muted);
  }

  /* Make provenance grid 3 columns for triads */
  .import-provenance-triad .import-provenance-grid {
    grid-template-columns: 1fr 1fr 1fr;
  }

  @media (max-width: 768px) {
    .import-provenance-triad .import-provenance-grid {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(importStyles);


// ============================================================================
// Simple SourceStore (fallback when SourceStore class not available)
// ============================================================================

/**
 * Creates a simple in-memory source store as a fallback
 * This is used when the SourceStore class isn't available
 */
function createSimpleSourceStore() {
  const sources = new Map();

  return {
    sources: sources,

    createSource(config) {
      const id = 'src_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
      const source = {
        id,
        name: config.name,
        records: Object.freeze([...config.records]),
        recordCount: config.records.length,
        schema: config.schema,
        provenance: config.provenance,
        fileIdentity: config.fileMetadata,
        importedAt: new Date().toISOString(),
        derivedSetIds: [],
        status: 'active'
      };
      sources.set(id, source);
      return source;
    },

    get(id) {
      return sources.get(id);
    },

    getAll() {
      return Array.from(sources.values());
    },

    getByStatus(status) {
      return this.getAll().filter(s => s.status === status);
    }
  };
}

// Export the helper
if (typeof window !== 'undefined') {
  window.createSimpleSourceStore = createSimpleSourceStore;
}


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
