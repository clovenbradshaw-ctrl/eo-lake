/**
 * EO Source & Join System
 *
 * Key Principles:
 * 1. Imports create SOURCES (raw data), not Sets
 * 2. Users explicitly create Sets from Sources
 * 3. Joins are EO-IR compliant with full provenance
 * 4. No-code join tools with field mapping and conditionals
 *
 * EO-IR Integration:
 * - Sources are GIVEN events (immutable raw data entry points)
 * - Sets derived from Sources use SEG derivation strategy
 * - Joined Sets use CON (Connect) derivation strategy
 * - Full provenance chain from Source → Set → Joined Set
 */

// ============================================================================
// Source Store - Manages raw imported data
// ============================================================================

/**
 * SourceStore - Storage for raw imported data (GIVEN events)
 *
 * A Source represents immutable raw data from an import.
 * Unlike Sets, Sources cannot be edited - they are frozen at import time.
 */
class SourceStore {
  constructor(eventStore = null) {
    this.eventStore = eventStore;
    this.sources = new Map();
    this._listeners = [];
  }

  /**
   * Create a new Source from imported data
   * @param {Object} config
   * @param {string} config.name - Source name (usually filename)
   * @param {Object[]} config.records - Raw imported records
   * @param {Object[]} config.schema - Inferred schema (field definitions)
   * @param {Object} config.provenance - 9-element provenance from import
   * @param {Object} config.parseResult - Raw parse result with decisions
   * @returns {Source}
   */
  createSource(config) {
    const {
      name,
      records,
      schema,
      provenance = {},
      parseResult = {},
      fileMetadata = {}
    } = config;

    const sourceId = this._generateSourceId();
    const timestamp = new Date().toISOString();

    // Build source object
    const source = {
      id: sourceId,
      name,
      type: 'source',

      // Raw data (immutable)
      records: Object.freeze([...records]),
      recordCount: records.length,

      // Schema (inferred from data)
      schema: {
        fields: schema.fields || this._inferSchemaFromRecords(records),
        inferenceDecisions: schema.inferenceDecisions || null
      },

      // File identity
      fileIdentity: {
        originalFilename: fileMetadata.originalFilename || name,
        contentHash: fileMetadata.contentHash || null,
        rawSize: fileMetadata.rawSize || null,
        encoding: fileMetadata.encoding || 'utf-8',
        mimeType: fileMetadata.mimeType || null
      },

      // Provenance (9-element EO structure)
      provenance: this._normalizeProvenance(provenance),

      // Parsing decisions (for transparency)
      parsingDecisions: parseResult.parsingDecisions || null,

      // Timestamps
      importedAt: timestamp,
      createdAt: timestamp,

      // Derived sets (populated when sets are created from this source)
      derivedSetIds: [],

      // Status
      status: 'active' // 'active' | 'archived'
    };

    // Freeze the source (immutable)
    Object.freeze(source);

    // Store it
    this.sources.set(sourceId, source);

    // Create EO event for provenance
    if (this.eventStore) {
      this._createSourceEvent(source);
    }

    // Notify listeners
    this._notify('source_created', source);

    return source;
  }

  /**
   * Get a source by ID
   */
  get(sourceId) {
    return this.sources.get(sourceId);
  }

  /**
   * Get all sources
   */
  getAll() {
    return Array.from(this.sources.values());
  }

  /**
   * Get sources filtered by status
   */
  getByStatus(status) {
    return this.getAll().filter(s => s.status === status);
  }

  /**
   * Archive a source (soft delete)
   */
  archive(sourceId) {
    const source = this.sources.get(sourceId);
    if (!source) return null;

    // Create new source with archived status (immutability)
    const archivedSource = {
      ...source,
      status: 'archived',
      archivedAt: new Date().toISOString()
    };
    Object.freeze(archivedSource);

    this.sources.set(sourceId, archivedSource);
    this._notify('source_archived', archivedSource);

    return archivedSource;
  }

  /**
   * Register a derived set for a source
   */
  registerDerivedSet(sourceId, setId) {
    const source = this.sources.get(sourceId);
    if (!source) return;

    // Create updated source with new derived set
    const updatedSource = {
      ...source,
      derivedSetIds: [...source.derivedSetIds, setId]
    };
    Object.freeze(updatedSource);

    this.sources.set(sourceId, updatedSource);
    this._notify('source_updated', updatedSource);
  }

  /**
   * Subscribe to source events
   */
  subscribe(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  /**
   * Load sources from storage
   */
  loadFromStorage(data) {
    if (!data?.sources) return;

    for (const source of data.sources) {
      Object.freeze(source);
      this.sources.set(source.id, source);
    }
  }

  /**
   * Export sources for storage
   */
  toJSON() {
    return {
      sources: Array.from(this.sources.values())
    };
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  _generateSourceId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `src_${timestamp}_${random}`;
  }

  _inferSchemaFromRecords(records) {
    if (records.length === 0) return [];

    const firstRecord = records[0];
    const fields = Object.keys(firstRecord).map(key => ({
      name: key,
      type: this._inferFieldType(records, key),
      sourceColumn: key
    }));

    return fields;
  }

  _inferFieldType(records, fieldName) {
    const sample = records.slice(0, 100);
    const values = sample.map(r => r[fieldName]).filter(v => v != null && v !== '');

    if (values.length === 0) return 'text';

    // Check for numbers
    if (values.every(v => !isNaN(parseFloat(v)) && isFinite(v))) {
      return values.every(v => Number.isInteger(parseFloat(v))) ? 'integer' : 'number';
    }

    // Check for dates
    const datePattern = /^\d{4}-\d{2}-\d{2}/;
    if (values.every(v => datePattern.test(String(v)))) {
      return 'date';
    }

    // Check for booleans
    const boolValues = ['true', 'false', 'yes', 'no', '1', '0'];
    if (values.every(v => boolValues.includes(String(v).toLowerCase()))) {
      return 'boolean';
    }

    return 'text';
  }

  _normalizeProvenance(prov) {
    return {
      // Epistemic Triad
      agent: prov.agent || null,
      method: prov.method || null,
      source: prov.source || null,
      // Semantic Triad
      term: prov.term || null,
      definition: prov.definition || null,
      jurisdiction: prov.jurisdiction || null,
      // Situational Triad
      scale: prov.scale || null,
      timeframe: prov.timeframe || null,
      background: prov.background || null
    };
  }

  _createSourceEvent(source) {
    if (!this.eventStore?.add) return;

    const event = {
      id: `evt_${source.id}`,
      epistemicType: 'given',
      category: 'source_imported',
      timestamp: source.importedAt,
      actor: 'user',
      payload: {
        sourceId: source.id,
        name: source.name,
        recordCount: source.recordCount,
        schema: source.schema,
        fileIdentity: source.fileIdentity
      },
      grounding: {
        references: [],
        kind: 'external' // GIVEN events have external grounding
      },
      frame: {
        claim: `Imported source data: ${source.name}`,
        epistemicStatus: 'confirmed',
        purpose: 'data_import'
      }
    };

    this.eventStore.add(event);
  }

  _notify(eventType, data) {
    for (const listener of this._listeners) {
      try {
        listener(eventType, data);
      } catch (e) {
        console.warn('Source listener error:', e);
      }
    }
  }
}


// ============================================================================
// Set Creator - Creates Sets from Sources
// ============================================================================

/**
 * SetCreator - Handles explicit Set creation from Sources
 *
 * Unlike automatic import, this gives users control over:
 * - Which fields to include
 * - Field type overrides
 * - Initial filters
 * - Set naming and configuration
 */
class SetCreator {
  constructor(sourceStore, eventStore = null) {
    this.sourceStore = sourceStore;
    this.eventStore = eventStore;
  }

  /**
   * Create a Set from a Source with user-defined configuration
   *
   * @param {Object} config
   * @param {string} config.sourceId - ID of the source to derive from
   * @param {string} config.setName - Name for the new Set
   * @param {Object[]} config.selectedFields - Fields to include with type overrides
   * @param {Object[]} config.filters - Initial filters to apply
   * @param {Object} config.options - Additional options
   * @returns {Object} - { set, events, derivation }
   */
  createSetFromSource(config) {
    const {
      sourceId,
      setName,
      selectedFields,
      filters = [],
      options = {}
    } = config;

    const source = this.sourceStore.get(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    const timestamp = new Date().toISOString();
    const setId = this._generateSetId();

    // Build field definitions from selection
    const fields = this._buildFieldDefinitions(selectedFields, source.schema.fields);

    // Apply filters to source records
    let records = [...source.records];
    if (filters.length > 0) {
      records = this._applyFilters(records, filters);
    }

    // Transform records to use field IDs
    const transformedRecords = records.map((record, index) => ({
      id: this._generateRecordId(),
      setId,
      values: this._transformRecordValues(record, fields),
      createdAt: timestamp,
      updatedAt: timestamp,
      _sourceIndex: index // Track origin for provenance
    }));

    // Build derivation (SEG strategy - segment from source)
    const derivation = {
      strategy: 'seg',
      parentSourceId: sourceId,
      constraint: {
        selectedFields: selectedFields.map(f => f.name),
        filters: filters
      },
      derivedBy: options.actor || 'user',
      derivedAt: timestamp
    };

    // Build the Set
    const set = {
      id: setId,
      name: setName,
      icon: options.icon || 'ph-table',
      fields,
      records: transformedRecords,
      views: [
        this._createDefaultView()
      ],
      derivation,
      datasetProvenance: {
        originalFilename: source.fileIdentity.originalFilename,
        importedAt: source.importedAt,
        provenance: source.provenance,
        sourceId: sourceId
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Create provenance events
    const events = this._createDerivationEvents(set, source, derivation);

    // Register derived set with source
    this.sourceStore.registerDerivedSet(sourceId, setId);

    return { set, events, derivation };
  }

  /**
   * Preview a Set creation without actually creating it
   */
  previewSetFromSource(config) {
    const { sourceId, selectedFields, filters = [] } = config;

    const source = this.sourceStore.get(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    // Build preview fields
    const fields = this._buildFieldDefinitions(selectedFields, source.schema.fields);

    // Apply filters
    let records = [...source.records];
    if (filters.length > 0) {
      records = this._applyFilters(records, filters);
    }

    return {
      sourceId,
      sourceName: source.name,
      sourceRecordCount: source.recordCount,
      fields,
      filteredRecordCount: records.length,
      sampleRecords: records.slice(0, 10),
      filters
    };
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  _generateSetId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `set_${timestamp}_${random}`;
  }

  _generateRecordId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `rec_${timestamp}_${random}`;
  }

  _buildFieldDefinitions(selectedFields, sourceFields) {
    return selectedFields.map((selection, index) => {
      const sourceField = sourceFields.find(f => f.name === selection.name);

      return {
        id: this._generateFieldId(),
        name: selection.rename || selection.name,
        type: selection.type || sourceField?.type || 'text',
        width: 200,
        isPrimary: index === 0,
        sourceColumn: selection.name,
        options: selection.options || {}
      };
    });
  }

  _generateFieldId() {
    return 'fld_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  _applyFilters(records, filters) {
    return records.filter(record => {
      return filters.every(filter => {
        const value = record[filter.field];
        return this._evaluateFilter(value, filter.operator, filter.value);
      });
    });
  }

  _evaluateFilter(cellValue, operator, filterValue) {
    const cellStr = String(cellValue ?? '').toLowerCase();
    const filterStr = String(filterValue ?? '').toLowerCase();

    switch (operator) {
      case 'eq': return cellStr === filterStr;
      case 'neq': return cellStr !== filterStr;
      case 'contains': return cellStr.includes(filterStr);
      case 'starts': return cellStr.startsWith(filterStr);
      case 'ends': return cellStr.endsWith(filterStr);
      case 'gt': return parseFloat(cellValue) > parseFloat(filterValue);
      case 'lt': return parseFloat(cellValue) < parseFloat(filterValue);
      case 'gte': return parseFloat(cellValue) >= parseFloat(filterValue);
      case 'lte': return parseFloat(cellValue) <= parseFloat(filterValue);
      case 'null': return cellValue === null || cellValue === undefined || cellValue === '';
      case 'notnull': return cellValue !== null && cellValue !== undefined && cellValue !== '';
      default: return true;
    }
  }

  _transformRecordValues(record, fields) {
    const values = {};
    for (const field of fields) {
      values[field.id] = record[field.sourceColumn];
    }
    return values;
  }

  _createDefaultView() {
    return {
      id: 'view_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      name: 'All Records',
      type: 'table',
      config: {
        filters: [],
        sorts: [],
        groups: [],
        hiddenFields: [],
        fieldOrder: []
      },
      createdAt: new Date().toISOString()
    };
  }

  _createDerivationEvents(set, source, derivation) {
    const events = [];
    const timestamp = new Date().toISOString();

    // Event: Set created from source
    events.push({
      id: `evt_${set.id}`,
      epistemicType: 'meant',
      category: 'set_created',
      timestamp,
      actor: derivation.derivedBy,
      payload: {
        setId: set.id,
        name: set.name,
        fieldCount: set.fields.length,
        recordCount: set.records.length
      },
      grounding: {
        references: [
          { eventId: `evt_${source.id}`, kind: 'structural' }
        ],
        derivation: {
          strategy: 'seg',
          sourceId: source.id,
          constraint: derivation.constraint
        },
        kind: 'computational'
      },
      frame: {
        claim: `Created set "${set.name}" from source "${source.name}"`,
        epistemicStatus: 'confirmed',
        purpose: 'set_derivation'
      }
    });

    return events;
  }
}


// ============================================================================
// Join Builder - No-Code Join Interface
// ============================================================================

/**
 * JoinBuilder - No-code interface for creating joined Sets
 *
 * Features:
 * - Visual field mapping
 * - Multiple join conditions
 * - Join type selection (inner, left, right, full)
 * - Preview before execution
 * - Full EO-IR CON provenance
 */
class JoinBuilder {
  constructor(sourceStore, eventStore = null) {
    this.sourceStore = sourceStore;
    this.eventStore = eventStore;
    this._joinConfig = null;
  }

  /**
   * Initialize a new join configuration
   */
  initJoin() {
    this._joinConfig = {
      leftSource: null,
      rightSource: null,
      joinConditions: [],
      joinType: 'inner',
      outputFields: [],
      setName: '',
      options: {}
    };
    return this._joinConfig;
  }

  /**
   * Set the left source for the join
   */
  setLeftSource(sourceId) {
    const source = this.sourceStore.get(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    this._joinConfig.leftSource = {
      id: source.id,
      name: source.name,
      fields: source.schema.fields,
      recordCount: source.recordCount
    };

    return this._joinConfig;
  }

  /**
   * Set the right source for the join
   */
  setRightSource(sourceId) {
    const source = this.sourceStore.get(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    this._joinConfig.rightSource = {
      id: source.id,
      name: source.name,
      fields: source.schema.fields,
      recordCount: source.recordCount
    };

    return this._joinConfig;
  }

  /**
   * Add a join condition (field mapping)
   */
  addJoinCondition(condition) {
    const {
      leftField,
      rightField,
      operator = 'eq' // 'eq', 'contains', 'starts', 'ends'
    } = condition;

    this._joinConfig.joinConditions.push({
      id: `jc_${Date.now().toString(36)}`,
      leftField,
      rightField,
      operator
    });

    return this._joinConfig;
  }

  /**
   * Remove a join condition
   */
  removeJoinCondition(conditionId) {
    this._joinConfig.joinConditions = this._joinConfig.joinConditions
      .filter(c => c.id !== conditionId);
    return this._joinConfig;
  }

  /**
   * Set the join type
   */
  setJoinType(type) {
    const validTypes = ['inner', 'left', 'right', 'full'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid join type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }
    this._joinConfig.joinType = type;
    return this._joinConfig;
  }

  /**
   * Set output fields to include
   */
  setOutputFields(fields) {
    // fields: [{ source: 'left'|'right', field: 'fieldName', rename: 'optionalNewName' }]
    this._joinConfig.outputFields = fields.map(f => ({
      source: f.source,
      field: f.field,
      rename: f.rename || null
    }));
    return this._joinConfig;
  }

  /**
   * Add all fields from a source to output
   */
  addAllFieldsFromSource(sourceType) {
    const source = sourceType === 'left'
      ? this._joinConfig.leftSource
      : this._joinConfig.rightSource;

    if (!source) return this._joinConfig;

    const existingFields = new Set(
      this._joinConfig.outputFields
        .filter(f => f.source === sourceType)
        .map(f => f.field)
    );

    for (const field of source.fields) {
      if (!existingFields.has(field.name)) {
        this._joinConfig.outputFields.push({
          source: sourceType,
          field: field.name,
          rename: null
        });
      }
    }

    return this._joinConfig;
  }

  /**
   * Set the name for the resulting Set
   */
  setSetName(name) {
    this._joinConfig.setName = name;
    return this._joinConfig;
  }

  /**
   * Get the current join configuration
   */
  getConfig() {
    return { ...this._joinConfig };
  }

  /**
   * Validate the join configuration
   */
  validate() {
    const errors = [];

    if (!this._joinConfig.leftSource) {
      errors.push('Left source is required');
    }
    if (!this._joinConfig.rightSource) {
      errors.push('Right source is required');
    }
    if (this._joinConfig.joinConditions.length === 0) {
      errors.push('At least one join condition is required');
    }
    if (this._joinConfig.outputFields.length === 0) {
      errors.push('At least one output field is required');
    }
    if (!this._joinConfig.setName) {
      errors.push('Set name is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Preview the join results
   */
  preview(limit = 100) {
    const validation = this.validate();
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const leftSource = this.sourceStore.get(this._joinConfig.leftSource.id);
    const rightSource = this.sourceStore.get(this._joinConfig.rightSource.id);

    // Execute the join
    const joinResult = this._executeJoin(
      leftSource.records,
      rightSource.records,
      this._joinConfig.joinConditions,
      this._joinConfig.joinType
    );

    // Apply field selection
    const projectedRows = joinResult.map(row =>
      this._projectRow(row, this._joinConfig.outputFields)
    );

    return {
      success: true,
      rowCount: projectedRows.length,
      previewRows: projectedRows.slice(0, limit),
      joinStats: {
        leftRecords: leftSource.recordCount,
        rightRecords: rightSource.recordCount,
        matchedRecords: joinResult.length,
        joinType: this._joinConfig.joinType
      }
    };
  }

  /**
   * Execute the join and create a Set
   */
  execute() {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Invalid join configuration: ${validation.errors.join(', ')}`);
    }

    const leftSource = this.sourceStore.get(this._joinConfig.leftSource.id);
    const rightSource = this.sourceStore.get(this._joinConfig.rightSource.id);
    const timestamp = new Date().toISOString();
    const setId = this._generateSetId();

    // Execute the join
    const joinResult = this._executeJoin(
      leftSource.records,
      rightSource.records,
      this._joinConfig.joinConditions,
      this._joinConfig.joinType
    );

    // Build fields from output config
    const fields = this._buildOutputFields(
      this._joinConfig.outputFields,
      leftSource.schema.fields,
      rightSource.schema.fields
    );

    // Transform to records
    const records = joinResult.map((row, index) => ({
      id: this._generateRecordId(),
      setId,
      values: this._transformJoinedRow(row, fields, this._joinConfig.outputFields),
      createdAt: timestamp,
      updatedAt: timestamp,
      _joinIndex: index,
      _leftIndex: row._leftIndex,
      _rightIndex: row._rightIndex
    }));

    // Build CON derivation
    const derivation = {
      strategy: 'con',
      joinSetIds: [leftSource.id, rightSource.id],
      constraint: {
        joinConditions: this._joinConfig.joinConditions,
        joinType: this._joinConfig.joinType,
        outputFields: this._joinConfig.outputFields
      },
      derivedBy: this._joinConfig.options.actor || 'user',
      derivedAt: timestamp
    };

    // Build the Set
    const set = {
      id: setId,
      name: this._joinConfig.setName,
      icon: 'ph-intersect',
      fields,
      records,
      views: [
        this._createDefaultView()
      ],
      derivation,
      datasetProvenance: {
        joinedFrom: [
          { sourceId: leftSource.id, name: leftSource.name },
          { sourceId: rightSource.id, name: rightSource.name }
        ],
        joinType: this._joinConfig.joinType,
        joinConditions: this._joinConfig.joinConditions,
        importedAt: timestamp
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Create provenance events
    const events = this._createJoinEvents(set, leftSource, rightSource, derivation);

    return {
      set,
      events,
      derivation,
      stats: {
        leftRecords: leftSource.recordCount,
        rightRecords: rightSource.recordCount,
        resultRecords: records.length
      }
    };
  }

  /**
   * Generate SQL equivalent of the join
   */
  toSQL() {
    if (!this._joinConfig.leftSource || !this._joinConfig.rightSource) {
      return null;
    }

    const leftAlias = 'L';
    const rightAlias = 'R';
    const leftTable = this._joinConfig.leftSource.name.replace(/[^a-zA-Z0-9_]/g, '_');
    const rightTable = this._joinConfig.rightSource.name.replace(/[^a-zA-Z0-9_]/g, '_');

    // Build SELECT clause
    const selectFields = this._joinConfig.outputFields.map(f => {
      const alias = f.source === 'left' ? leftAlias : rightAlias;
      const fieldName = f.rename || f.field;
      return `${alias}.${f.field}${f.rename ? ` AS ${f.rename}` : ''}`;
    }).join(', ') || '*';

    // Build ON clause
    const onConditions = this._joinConfig.joinConditions.map(c => {
      return `${leftAlias}.${c.leftField} = ${rightAlias}.${c.rightField}`;
    }).join(' AND ');

    // Build join type
    const joinKeyword = {
      'inner': 'INNER JOIN',
      'left': 'LEFT JOIN',
      'right': 'RIGHT JOIN',
      'full': 'FULL OUTER JOIN'
    }[this._joinConfig.joinType];

    return `SELECT ${selectFields}
FROM ${leftTable} ${leftAlias}
${joinKeyword} ${rightTable} ${rightAlias}
ON ${onConditions}`;
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  _executeJoin(leftRecords, rightRecords, conditions, joinType) {
    // Build index on right table using first condition
    const primaryCondition = conditions[0];
    const rightIndex = new Map();

    for (let i = 0; i < rightRecords.length; i++) {
      const record = rightRecords[i];
      const key = String(record[primaryCondition.rightField] ?? '').toLowerCase();
      if (!rightIndex.has(key)) {
        rightIndex.set(key, []);
      }
      rightIndex.get(key).push({ record, index: i });
    }

    const result = [];
    const matchedRightIndices = new Set();

    for (let leftIdx = 0; leftIdx < leftRecords.length; leftIdx++) {
      const leftRecord = leftRecords[leftIdx];
      const leftKey = String(leftRecord[primaryCondition.leftField] ?? '').toLowerCase();
      const candidates = rightIndex.get(leftKey) || [];

      // Filter by all conditions
      const matches = candidates.filter(({ record: rightRecord }) => {
        return conditions.every(cond => {
          const leftVal = String(leftRecord[cond.leftField] ?? '').toLowerCase();
          const rightVal = String(rightRecord[cond.rightField] ?? '').toLowerCase();

          switch (cond.operator) {
            case 'eq': return leftVal === rightVal;
            case 'contains': return leftVal.includes(rightVal) || rightVal.includes(leftVal);
            case 'starts': return leftVal.startsWith(rightVal) || rightVal.startsWith(leftVal);
            case 'ends': return leftVal.endsWith(rightVal) || rightVal.endsWith(leftVal);
            default: return leftVal === rightVal;
          }
        });
      });

      if (matches.length > 0) {
        for (const { record: rightRecord, index: rightIdx } of matches) {
          matchedRightIndices.add(rightIdx);
          result.push({
            ...leftRecord,
            ...this._prefixRightFields(rightRecord),
            _leftIndex: leftIdx,
            _rightIndex: rightIdx
          });
        }
      } else if (joinType === 'left' || joinType === 'full') {
        // Left/Full join: include unmatched left records
        result.push({
          ...leftRecord,
          ...this._nullRightFields(rightRecords[0] || {}),
          _leftIndex: leftIdx,
          _rightIndex: null
        });
      }
    }

    // For right/full joins: include unmatched right records
    if (joinType === 'right' || joinType === 'full') {
      for (let rightIdx = 0; rightIdx < rightRecords.length; rightIdx++) {
        if (!matchedRightIndices.has(rightIdx)) {
          const rightRecord = rightRecords[rightIdx];
          result.push({
            ...this._nullLeftFields(leftRecords[0] || {}),
            ...this._prefixRightFields(rightRecord),
            _leftIndex: null,
            _rightIndex: rightIdx
          });
        }
      }
    }

    return result;
  }

  _prefixRightFields(record) {
    const prefixed = {};
    for (const [key, value] of Object.entries(record)) {
      prefixed[`_right_${key}`] = value;
    }
    return prefixed;
  }

  _nullRightFields(sampleRecord) {
    const nulled = {};
    for (const key of Object.keys(sampleRecord)) {
      nulled[`_right_${key}`] = null;
    }
    return nulled;
  }

  _nullLeftFields(sampleRecord) {
    const nulled = {};
    for (const key of Object.keys(sampleRecord)) {
      nulled[key] = null;
    }
    return nulled;
  }

  _projectRow(row, outputFields) {
    const projected = {};
    for (const field of outputFields) {
      const key = field.source === 'right' ? `_right_${field.field}` : field.field;
      const outputKey = field.rename || field.field;
      projected[outputKey] = row[key];
    }
    return projected;
  }

  _buildOutputFields(outputConfig, leftFields, rightFields) {
    return outputConfig.map((config, index) => {
      const sourceFields = config.source === 'left' ? leftFields : rightFields;
      const sourceField = sourceFields.find(f => f.name === config.field);

      return {
        id: this._generateFieldId(),
        name: config.rename || config.field,
        type: sourceField?.type || 'text',
        width: 200,
        isPrimary: index === 0,
        sourceColumn: config.field,
        sourceTable: config.source,
        options: {}
      };
    });
  }

  _transformJoinedRow(row, fields, outputConfig) {
    const values = {};
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const config = outputConfig[i];
      const key = config.source === 'right' ? `_right_${config.field}` : config.field;
      values[field.id] = row[key];
    }
    return values;
  }

  _generateSetId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `set_${timestamp}_${random}`;
  }

  _generateRecordId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `rec_${timestamp}_${random}`;
  }

  _generateFieldId() {
    return 'fld_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  _createDefaultView() {
    return {
      id: 'view_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      name: 'All Records',
      type: 'table',
      config: {
        filters: [],
        sorts: [],
        groups: [],
        hiddenFields: [],
        fieldOrder: []
      },
      createdAt: new Date().toISOString()
    };
  }

  _createJoinEvents(set, leftSource, rightSource, derivation) {
    const events = [];
    const timestamp = new Date().toISOString();

    // Event: Join executed
    const joinEventId = `evt_join_${set.id}`;
    events.push({
      id: joinEventId,
      epistemicType: 'meant',
      category: 'join_executed',
      timestamp,
      actor: derivation.derivedBy,
      payload: {
        leftSourceId: leftSource.id,
        rightSourceId: rightSource.id,
        joinType: this._joinConfig.joinType,
        joinConditions: this._joinConfig.joinConditions,
        resultCount: set.records.length
      },
      grounding: {
        references: [
          { eventId: `evt_${leftSource.id}`, kind: 'structural' },
          { eventId: `evt_${rightSource.id}`, kind: 'structural' }
        ],
        derivation: {
          strategy: 'con',
          inputs: {
            left: leftSource.id,
            right: rightSource.id
          },
          frozenParams: {
            joinConditions: this._joinConfig.joinConditions,
            joinType: this._joinConfig.joinType
          }
        },
        kind: 'computational'
      },
      frame: {
        claim: `Joined "${leftSource.name}" with "${rightSource.name}"`,
        epistemicStatus: 'confirmed',
        purpose: 'data_join'
      }
    });

    // Event: Set created from join
    events.push({
      id: `evt_${set.id}`,
      epistemicType: 'meant',
      category: 'set_created',
      timestamp,
      actor: derivation.derivedBy,
      payload: {
        setId: set.id,
        name: set.name,
        fieldCount: set.fields.length,
        recordCount: set.records.length,
        derivedVia: 'join'
      },
      grounding: {
        references: [
          { eventId: joinEventId, kind: 'computational' }
        ],
        derivation: derivation,
        kind: 'computational'
      },
      frame: {
        claim: `Created joined set "${set.name}"`,
        epistemicStatus: 'confirmed',
        purpose: 'set_derivation'
      }
    });

    return events;
  }
}


// ============================================================================
// Join Builder UI Component
// ============================================================================

/**
 * JoinBuilderUI - Visual interface for building joins
 */
class JoinBuilderUI {
  constructor(joinBuilder, container) {
    this.joinBuilder = joinBuilder;
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    this._onComplete = null;
    this._onCancel = null;
  }

  /**
   * Show the join builder modal
   */
  show(options = {}) {
    this._onComplete = options.onComplete;
    this._onCancel = options.onCancel;

    this.joinBuilder.initJoin();
    this._render();
    this._attachEventListeners();
  }

  /**
   * Hide the join builder
   */
  hide() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
    }
  }

  _render() {
    const sources = this.joinBuilder.sourceStore.getByStatus('active');
    const config = this.joinBuilder.getConfig();

    this.container.style.display = 'block';
    this.container.innerHTML = `
      <div class="join-builder-overlay">
        <div class="join-builder-modal">
          <div class="join-builder-header">
            <h2><i class="ph ph-intersect"></i> Create Joined Set</h2>
            <p class="join-builder-subtitle">Connect two sources using field mappings</p>
            <button class="join-builder-close" id="join-close-btn">
              <i class="ph ph-x"></i>
            </button>
          </div>

          <div class="join-builder-body">
            <!-- Source Selection -->
            <div class="join-sources-section">
              <div class="join-source-picker">
                <label>Left Source</label>
                <select id="join-left-source" class="join-source-select">
                  <option value="">Select source...</option>
                  ${sources.map(s => `
                    <option value="${s.id}" ${config.leftSource?.id === s.id ? 'selected' : ''}>
                      ${this._escapeHtml(s.name)} (${s.recordCount} records)
                    </option>
                  `).join('')}
                </select>
                ${config.leftSource ? `
                  <div class="join-source-fields" id="left-source-fields">
                    ${this._renderFieldList(config.leftSource.fields, 'left')}
                  </div>
                ` : ''}
              </div>

              <div class="join-type-picker">
                <label>Join Type</label>
                <div class="join-type-options">
                  ${['inner', 'left', 'right', 'full'].map(type => `
                    <button class="join-type-btn ${config.joinType === type ? 'active' : ''}"
                            data-type="${type}">
                      <i class="ph ${this._getJoinTypeIcon(type)}"></i>
                      <span>${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    </button>
                  `).join('')}
                </div>
                <p class="join-type-desc">${this._getJoinTypeDescription(config.joinType)}</p>
              </div>

              <div class="join-source-picker">
                <label>Right Source</label>
                <select id="join-right-source" class="join-source-select">
                  <option value="">Select source...</option>
                  ${sources.map(s => `
                    <option value="${s.id}" ${config.rightSource?.id === s.id ? 'selected' : ''}>
                      ${this._escapeHtml(s.name)} (${s.recordCount} records)
                    </option>
                  `).join('')}
                </select>
                ${config.rightSource ? `
                  <div class="join-source-fields" id="right-source-fields">
                    ${this._renderFieldList(config.rightSource.fields, 'right')}
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Join Conditions -->
            <div class="join-conditions-section">
              <h3><i class="ph ph-link"></i> Join Conditions</h3>
              <p class="section-desc">Map fields between sources to match records</p>

              <div class="join-conditions-list" id="join-conditions-list">
                ${config.joinConditions.length === 0 ? `
                  <div class="join-condition-empty">
                    <i class="ph ph-arrow-fat-lines-right"></i>
                    <span>Add a condition to connect the sources</span>
                  </div>
                ` : config.joinConditions.map(c => this._renderCondition(c, config)).join('')}
              </div>

              <button class="join-add-condition-btn" id="add-condition-btn"
                      ${!config.leftSource || !config.rightSource ? 'disabled' : ''}>
                <i class="ph ph-plus"></i> Add Condition
              </button>
            </div>

            <!-- Output Fields -->
            <div class="join-output-section">
              <h3><i class="ph ph-columns"></i> Output Fields</h3>
              <p class="section-desc">Select which fields to include in the result</p>

              <div class="join-output-controls">
                <button class="join-output-btn" id="add-all-left-btn"
                        ${!config.leftSource ? 'disabled' : ''}>
                  <i class="ph ph-check-square"></i> Add All Left
                </button>
                <button class="join-output-btn" id="add-all-right-btn"
                        ${!config.rightSource ? 'disabled' : ''}>
                  <i class="ph ph-check-square"></i> Add All Right
                </button>
              </div>

              <div class="join-output-list" id="join-output-list">
                ${config.outputFields.length === 0 ? `
                  <div class="join-output-empty">
                    <span>No fields selected</span>
                  </div>
                ` : config.outputFields.map((f, i) => this._renderOutputField(f, i)).join('')}
              </div>
            </div>

            <!-- Set Name -->
            <div class="join-name-section">
              <label>Set Name</label>
              <input type="text" id="join-set-name" class="join-set-name-input"
                     placeholder="Enter name for the joined set..."
                     value="${this._escapeHtml(config.setName || '')}">
            </div>

            <!-- Preview -->
            <div class="join-preview-section">
              <button class="join-preview-btn" id="join-preview-btn">
                <i class="ph ph-eye"></i> Preview Results
              </button>
              <div class="join-preview-results" id="join-preview-results"></div>
            </div>
          </div>

          <div class="join-builder-footer">
            <div class="join-sql-preview">
              <button class="join-sql-toggle" id="join-sql-toggle">
                <i class="ph ph-code"></i> View SQL
              </button>
              <pre class="join-sql-code" id="join-sql-code" style="display: none;"></pre>
            </div>
            <div class="join-builder-actions">
              <button class="btn btn-secondary" id="join-cancel-btn">Cancel</button>
              <button class="btn btn-primary" id="join-execute-btn">
                <i class="ph ph-intersect"></i> Create Joined Set
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderFieldList(fields, source) {
    return `
      <div class="field-chips">
        ${fields.map(f => `
          <span class="field-chip" data-source="${source}" data-field="${f.name}">
            <i class="ph ${this._getFieldTypeIcon(f.type)}"></i>
            ${this._escapeHtml(f.name)}
          </span>
        `).join('')}
      </div>
    `;
  }

  _renderCondition(condition, config) {
    const leftFields = config.leftSource?.fields || [];
    const rightFields = config.rightSource?.fields || [];

    return `
      <div class="join-condition" data-condition-id="${condition.id}">
        <select class="condition-left-field">
          <option value="">Select field...</option>
          ${leftFields.map(f => `
            <option value="${f.name}" ${condition.leftField === f.name ? 'selected' : ''}>
              ${this._escapeHtml(f.name)}
            </option>
          `).join('')}
        </select>

        <select class="condition-operator">
          <option value="eq" ${condition.operator === 'eq' ? 'selected' : ''}>=</option>
          <option value="contains" ${condition.operator === 'contains' ? 'selected' : ''}>contains</option>
          <option value="starts" ${condition.operator === 'starts' ? 'selected' : ''}>starts with</option>
          <option value="ends" ${condition.operator === 'ends' ? 'selected' : ''}>ends with</option>
        </select>

        <select class="condition-right-field">
          <option value="">Select field...</option>
          ${rightFields.map(f => `
            <option value="${f.name}" ${condition.rightField === f.name ? 'selected' : ''}>
              ${this._escapeHtml(f.name)}
            </option>
          `).join('')}
        </select>

        <button class="condition-remove-btn" title="Remove condition">
          <i class="ph ph-x"></i>
        </button>
      </div>
    `;
  }

  _renderOutputField(field, index) {
    return `
      <div class="join-output-field" data-index="${index}">
        <span class="output-source-badge ${field.source}">
          ${field.source === 'left' ? 'L' : 'R'}
        </span>
        <span class="output-field-name">${this._escapeHtml(field.field)}</span>
        ${field.rename ? `
          <span class="output-field-rename">→ ${this._escapeHtml(field.rename)}</span>
        ` : ''}
        <button class="output-field-remove" title="Remove field">
          <i class="ph ph-x"></i>
        </button>
      </div>
    `;
  }

  _attachEventListeners() {
    // Close button
    this.container.querySelector('#join-close-btn')?.addEventListener('click', () => {
      this.hide();
      this._onCancel?.();
    });

    // Cancel button
    this.container.querySelector('#join-cancel-btn')?.addEventListener('click', () => {
      this.hide();
      this._onCancel?.();
    });

    // Source selection
    this.container.querySelector('#join-left-source')?.addEventListener('change', (e) => {
      if (e.target.value) {
        this.joinBuilder.setLeftSource(e.target.value);
        this._render();
        this._attachEventListeners();
      }
    });

    this.container.querySelector('#join-right-source')?.addEventListener('change', (e) => {
      if (e.target.value) {
        this.joinBuilder.setRightSource(e.target.value);
        this._render();
        this._attachEventListeners();
      }
    });

    // Join type buttons
    this.container.querySelectorAll('.join-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.joinBuilder.setJoinType(btn.dataset.type);
        this._render();
        this._attachEventListeners();
      });
    });

    // Add condition button
    this.container.querySelector('#add-condition-btn')?.addEventListener('click', () => {
      this.joinBuilder.addJoinCondition({
        leftField: '',
        rightField: '',
        operator: 'eq'
      });
      this._render();
      this._attachEventListeners();
    });

    // Condition changes
    this.container.querySelectorAll('.join-condition').forEach(condEl => {
      const conditionId = condEl.dataset.conditionId;

      condEl.querySelector('.condition-left-field')?.addEventListener('change', (e) => {
        this._updateCondition(conditionId, 'leftField', e.target.value);
      });

      condEl.querySelector('.condition-operator')?.addEventListener('change', (e) => {
        this._updateCondition(conditionId, 'operator', e.target.value);
      });

      condEl.querySelector('.condition-right-field')?.addEventListener('change', (e) => {
        this._updateCondition(conditionId, 'rightField', e.target.value);
      });

      condEl.querySelector('.condition-remove-btn')?.addEventListener('click', () => {
        this.joinBuilder.removeJoinCondition(conditionId);
        this._render();
        this._attachEventListeners();
      });
    });

    // Add all fields buttons
    this.container.querySelector('#add-all-left-btn')?.addEventListener('click', () => {
      this.joinBuilder.addAllFieldsFromSource('left');
      this._render();
      this._attachEventListeners();
    });

    this.container.querySelector('#add-all-right-btn')?.addEventListener('click', () => {
      this.joinBuilder.addAllFieldsFromSource('right');
      this._render();
      this._attachEventListeners();
    });

    // Remove output field
    this.container.querySelectorAll('.output-field-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.closest('.join-output-field').dataset.index);
        const config = this.joinBuilder.getConfig();
        config.outputFields.splice(index, 1);
        this.joinBuilder.setOutputFields(config.outputFields);
        this._render();
        this._attachEventListeners();
      });
    });

    // Set name input
    this.container.querySelector('#join-set-name')?.addEventListener('input', (e) => {
      this.joinBuilder.setSetName(e.target.value);
    });

    // Preview button
    this.container.querySelector('#join-preview-btn')?.addEventListener('click', () => {
      this._showPreview();
    });

    // SQL toggle
    this.container.querySelector('#join-sql-toggle')?.addEventListener('click', () => {
      const sqlCode = this.container.querySelector('#join-sql-code');
      if (sqlCode) {
        const isHidden = sqlCode.style.display === 'none';
        sqlCode.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          sqlCode.textContent = this.joinBuilder.toSQL() || 'Select sources and conditions first';
        }
      }
    });

    // Execute button
    this.container.querySelector('#join-execute-btn')?.addEventListener('click', () => {
      this._executeJoin();
    });
  }

  _updateCondition(conditionId, field, value) {
    const config = this.joinBuilder.getConfig();
    const condition = config.joinConditions.find(c => c.id === conditionId);
    if (condition) {
      condition[field] = value;
      // Re-apply conditions by removing and re-adding
      this.joinBuilder._joinConfig.joinConditions = config.joinConditions;
    }
  }

  _showPreview() {
    const previewEl = this.container.querySelector('#join-preview-results');
    if (!previewEl) return;

    const result = this.joinBuilder.preview(20);

    if (!result.success) {
      previewEl.innerHTML = `
        <div class="preview-error">
          <i class="ph ph-warning"></i>
          <span>${result.errors.join(', ')}</span>
        </div>
      `;
      return;
    }

    const headers = result.previewRows.length > 0
      ? Object.keys(result.previewRows[0])
      : [];

    previewEl.innerHTML = `
      <div class="preview-stats">
        <span><strong>${result.rowCount}</strong> rows</span>
        <span>Left: ${result.joinStats.leftRecords} → Right: ${result.joinStats.rightRecords}</span>
      </div>
      <div class="preview-table-container">
        <table class="preview-table">
          <thead>
            <tr>
              ${headers.map(h => `<th>${this._escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${result.previewRows.map(row => `
              <tr>
                ${headers.map(h => `<td>${this._escapeHtml(String(row[h] ?? ''))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${result.rowCount > 20 ? `
        <div class="preview-more">Showing first 20 of ${result.rowCount} rows</div>
      ` : ''}
    `;
  }

  _executeJoin() {
    try {
      const result = this.joinBuilder.execute();
      this.hide();
      this._onComplete?.(result);
    } catch (error) {
      alert(`Join failed: ${error.message}`);
    }
  }

  _getJoinTypeIcon(type) {
    const icons = {
      'inner': 'ph-intersect',
      'left': 'ph-arrow-left',
      'right': 'ph-arrow-right',
      'full': 'ph-arrows-left-right'
    };
    return icons[type] || 'ph-intersect';
  }

  _getJoinTypeDescription(type) {
    const descriptions = {
      'inner': 'Only include records that match in both sources',
      'left': 'Include all records from left source, matched with right',
      'right': 'Include all records from right source, matched with left',
      'full': 'Include all records from both sources'
    };
    return descriptions[type] || '';
  }

  _getFieldTypeIcon(type) {
    const icons = {
      'text': 'ph-text-aa',
      'integer': 'ph-hash',
      'number': 'ph-hash',
      'date': 'ph-calendar',
      'boolean': 'ph-check-square'
    };
    return icons[type] || 'ph-text-aa';
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}


// ============================================================================
// Set From Source UI Component
// ============================================================================

/**
 * SetFromSourceUI - Visual interface for creating Sets from Sources
 */
class SetFromSourceUI {
  constructor(setCreator, container) {
    this.setCreator = setCreator;
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    this._onComplete = null;
    this._onCancel = null;
    this._source = null;
    this._selectedFields = [];
    this._filters = [];
  }

  /**
   * Show the set creator modal for a source
   */
  show(sourceId, options = {}) {
    this._onComplete = options.onComplete;
    this._onCancel = options.onCancel;
    this._source = this.setCreator.sourceStore.get(sourceId);

    if (!this._source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    // Initialize with all fields selected
    this._selectedFields = this._source.schema.fields.map(f => ({
      name: f.name,
      type: f.type,
      rename: null,
      include: true
    }));
    this._filters = [];

    this._render();
    this._attachEventListeners();
  }

  hide() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
    }
  }

  _render() {
    this.container.style.display = 'block';
    this.container.innerHTML = `
      <div class="set-creator-overlay">
        <div class="set-creator-modal">
          <div class="set-creator-header">
            <h2><i class="ph ph-table"></i> Create Set from Source</h2>
            <p class="set-creator-subtitle">
              <i class="ph ph-file"></i> ${this._escapeHtml(this._source.name)}
              <span class="record-count">${this._source.recordCount} records</span>
            </p>
            <button class="set-creator-close" id="set-creator-close-btn">
              <i class="ph ph-x"></i>
            </button>
          </div>

          <div class="set-creator-body">
            <!-- Set Name -->
            <div class="set-creator-name-section">
              <label>Set Name</label>
              <input type="text" id="set-creator-name" class="set-creator-name-input"
                     placeholder="Enter set name..."
                     value="${this._escapeHtml(this._source.name.replace(/\.[^/.]+$/, ''))}">
            </div>

            <!-- Field Selection -->
            <div class="set-creator-fields-section">
              <h3><i class="ph ph-columns"></i> Select Fields</h3>
              <p class="section-desc">Choose which fields to include and optionally rename them</p>

              <div class="field-select-actions">
                <button class="field-action-btn" id="select-all-fields">
                  <i class="ph ph-check-square"></i> Select All
                </button>
                <button class="field-action-btn" id="deselect-all-fields">
                  <i class="ph ph-square"></i> Deselect All
                </button>
              </div>

              <div class="field-select-list" id="field-select-list">
                ${this._selectedFields.map((f, i) => this._renderFieldRow(f, i)).join('')}
              </div>
            </div>

            <!-- Filters -->
            <div class="set-creator-filters-section">
              <h3><i class="ph ph-funnel"></i> Initial Filters (Optional)</h3>
              <p class="section-desc">Only include records that match these conditions</p>

              <div class="filter-list" id="filter-list">
                ${this._filters.length === 0 ? `
                  <div class="filter-empty">No filters applied</div>
                ` : this._filters.map((f, i) => this._renderFilter(f, i)).join('')}
              </div>

              <button class="add-filter-btn" id="add-filter-btn">
                <i class="ph ph-plus"></i> Add Filter
              </button>
            </div>

            <!-- Preview -->
            <div class="set-creator-preview-section">
              <button class="preview-btn" id="preview-set-btn">
                <i class="ph ph-eye"></i> Preview
              </button>
              <div class="preview-results" id="set-preview-results"></div>
            </div>
          </div>

          <div class="set-creator-footer">
            <button class="btn btn-secondary" id="set-creator-cancel-btn">Cancel</button>
            <button class="btn btn-primary" id="set-creator-create-btn">
              <i class="ph ph-table"></i> Create Set
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderFieldRow(field, index) {
    const types = ['text', 'number', 'integer', 'date', 'boolean', 'select'];

    return `
      <div class="field-select-row ${field.include ? 'selected' : ''}" data-index="${index}">
        <input type="checkbox" class="field-checkbox"
               ${field.include ? 'checked' : ''}>
        <span class="field-original-name">${this._escapeHtml(field.name)}</span>
        <select class="field-type-select">
          ${types.map(t => `
            <option value="${t}" ${field.type === t ? 'selected' : ''}>${t}</option>
          `).join('')}
        </select>
        <input type="text" class="field-rename-input"
               placeholder="Rename (optional)"
               value="${field.rename || ''}">
      </div>
    `;
  }

  _renderFilter(filter, index) {
    const operators = [
      { value: 'eq', label: 'equals' },
      { value: 'neq', label: 'not equals' },
      { value: 'contains', label: 'contains' },
      { value: 'gt', label: '>' },
      { value: 'gte', label: '>=' },
      { value: 'lt', label: '<' },
      { value: 'lte', label: '<=' },
      { value: 'null', label: 'is empty' },
      { value: 'notnull', label: 'is not empty' }
    ];

    return `
      <div class="filter-row" data-index="${index}">
        <select class="filter-field">
          <option value="">Select field...</option>
          ${this._source.schema.fields.map(f => `
            <option value="${f.name}" ${filter.field === f.name ? 'selected' : ''}>
              ${this._escapeHtml(f.name)}
            </option>
          `).join('')}
        </select>
        <select class="filter-operator">
          ${operators.map(op => `
            <option value="${op.value}" ${filter.operator === op.value ? 'selected' : ''}>
              ${op.label}
            </option>
          `).join('')}
        </select>
        <input type="text" class="filter-value"
               placeholder="Value"
               value="${this._escapeHtml(filter.value || '')}"
               ${['null', 'notnull'].includes(filter.operator) ? 'disabled' : ''}>
        <button class="filter-remove-btn" title="Remove filter">
          <i class="ph ph-x"></i>
        </button>
      </div>
    `;
  }

  _attachEventListeners() {
    // Close/Cancel buttons
    this.container.querySelector('#set-creator-close-btn')?.addEventListener('click', () => {
      this.hide();
      this._onCancel?.();
    });

    this.container.querySelector('#set-creator-cancel-btn')?.addEventListener('click', () => {
      this.hide();
      this._onCancel?.();
    });

    // Select/Deselect all
    this.container.querySelector('#select-all-fields')?.addEventListener('click', () => {
      this._selectedFields.forEach(f => f.include = true);
      this._render();
      this._attachEventListeners();
    });

    this.container.querySelector('#deselect-all-fields')?.addEventListener('click', () => {
      this._selectedFields.forEach(f => f.include = false);
      this._render();
      this._attachEventListeners();
    });

    // Field row changes
    this.container.querySelectorAll('.field-select-row').forEach(row => {
      const index = parseInt(row.dataset.index);

      row.querySelector('.field-checkbox')?.addEventListener('change', (e) => {
        this._selectedFields[index].include = e.target.checked;
        row.classList.toggle('selected', e.target.checked);
      });

      row.querySelector('.field-type-select')?.addEventListener('change', (e) => {
        this._selectedFields[index].type = e.target.value;
      });

      row.querySelector('.field-rename-input')?.addEventListener('input', (e) => {
        this._selectedFields[index].rename = e.target.value || null;
      });
    });

    // Add filter
    this.container.querySelector('#add-filter-btn')?.addEventListener('click', () => {
      this._filters.push({ field: '', operator: 'eq', value: '' });
      this._render();
      this._attachEventListeners();
    });

    // Filter changes
    this.container.querySelectorAll('.filter-row').forEach(row => {
      const index = parseInt(row.dataset.index);

      row.querySelector('.filter-field')?.addEventListener('change', (e) => {
        this._filters[index].field = e.target.value;
      });

      row.querySelector('.filter-operator')?.addEventListener('change', (e) => {
        this._filters[index].operator = e.target.value;
        const valueInput = row.querySelector('.filter-value');
        valueInput.disabled = ['null', 'notnull'].includes(e.target.value);
      });

      row.querySelector('.filter-value')?.addEventListener('input', (e) => {
        this._filters[index].value = e.target.value;
      });

      row.querySelector('.filter-remove-btn')?.addEventListener('click', () => {
        this._filters.splice(index, 1);
        this._render();
        this._attachEventListeners();
      });
    });

    // Preview
    this.container.querySelector('#preview-set-btn')?.addEventListener('click', () => {
      this._showPreview();
    });

    // Create
    this.container.querySelector('#set-creator-create-btn')?.addEventListener('click', () => {
      this._createSet();
    });
  }

  _showPreview() {
    const previewEl = this.container.querySelector('#set-preview-results');
    if (!previewEl) return;

    const selectedFields = this._selectedFields.filter(f => f.include);
    if (selectedFields.length === 0) {
      previewEl.innerHTML = '<div class="preview-error">Select at least one field</div>';
      return;
    }

    try {
      const result = this.setCreator.previewSetFromSource({
        sourceId: this._source.id,
        selectedFields,
        filters: this._filters.filter(f => f.field)
      });

      const headers = result.fields.map(f => f.name);

      previewEl.innerHTML = `
        <div class="preview-stats">
          <span><strong>${result.filteredRecordCount}</strong> of ${result.sourceRecordCount} records</span>
          <span>${result.fields.length} fields</span>
        </div>
        <div class="preview-table-container">
          <table class="preview-table">
            <thead>
              <tr>
                ${headers.map(h => `<th>${this._escapeHtml(h)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${result.sampleRecords.map(row => `
                <tr>
                  ${result.fields.map(f => `<td>${this._escapeHtml(String(row[f.sourceColumn] ?? ''))}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${result.filteredRecordCount > 10 ? `
          <div class="preview-more">Showing first 10 of ${result.filteredRecordCount} records</div>
        ` : ''}
      `;
    } catch (error) {
      previewEl.innerHTML = `<div class="preview-error">${error.message}</div>`;
    }
  }

  _createSet() {
    const nameInput = this.container.querySelector('#set-creator-name');
    const setName = nameInput?.value.trim();

    if (!setName) {
      alert('Please enter a set name');
      return;
    }

    const selectedFields = this._selectedFields.filter(f => f.include);
    if (selectedFields.length === 0) {
      alert('Please select at least one field');
      return;
    }

    try {
      const result = this.setCreator.createSetFromSource({
        sourceId: this._source.id,
        setName,
        selectedFields,
        filters: this._filters.filter(f => f.field)
      });

      this.hide();
      this._onComplete?.(result);
    } catch (error) {
      alert(`Failed to create set: ${error.message}`);
    }
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}


// ============================================================================
// Folder Store - Manages folder hierarchy for sources
// ============================================================================

/**
 * FolderStore - Storage for organizing sources into folders
 *
 * Folders are organizational metadata - they don't affect the source data
 * which remains immutable in the GIVEN layer.
 */
class FolderStore {
  constructor() {
    this.folders = new Map();
    this.tags = new Map(); // Global tag definitions with colors
    this._listeners = [];
    this._loadFromStorage();
  }

  /**
   * Create a new folder
   */
  createFolder(config) {
    const { name, parentId = null, color = null, icon = 'ph-folder' } = config;

    const folderId = this._generateFolderId();
    const timestamp = new Date().toISOString();

    const folder = {
      id: folderId,
      name,
      parentId,
      color,
      icon,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.folders.set(folderId, folder);
    this._save();
    this._notify('folder_created', folder);

    return folder;
  }

  /**
   * Get a folder by ID
   */
  get(folderId) {
    return this.folders.get(folderId);
  }

  /**
   * Get all folders
   */
  getAll() {
    return Array.from(this.folders.values());
  }

  /**
   * Get root folders (no parent)
   */
  getRootFolders() {
    return this.getAll().filter(f => !f.parentId);
  }

  /**
   * Get children of a folder
   */
  getChildren(folderId) {
    return this.getAll().filter(f => f.parentId === folderId);
  }

  /**
   * Get folder path (array of folder names from root to folder)
   */
  getPath(folderId) {
    const path = [];
    let current = this.get(folderId);

    while (current) {
      path.unshift(current);
      current = current.parentId ? this.get(current.parentId) : null;
    }

    return path;
  }

  /**
   * Update a folder
   */
  updateFolder(folderId, updates) {
    const folder = this.folders.get(folderId);
    if (!folder) return null;

    const updated = {
      ...folder,
      ...updates,
      id: folderId, // Prevent ID change
      updatedAt: new Date().toISOString()
    };

    this.folders.set(folderId, updated);
    this._save();
    this._notify('folder_updated', updated);

    return updated;
  }

  /**
   * Delete a folder (moves contents to parent or root)
   */
  deleteFolder(folderId) {
    const folder = this.folders.get(folderId);
    if (!folder) return false;

    // Move children to parent
    const children = this.getChildren(folderId);
    for (const child of children) {
      this.updateFolder(child.id, { parentId: folder.parentId });
    }

    this.folders.delete(folderId);
    this._save();
    this._notify('folder_deleted', { id: folderId, parentId: folder.parentId });

    return true;
  }

  // --------------------------------------------------------------------------
  // Tag Management
  // --------------------------------------------------------------------------

  /**
   * Create or update a tag definition
   */
  createTag(name, color = null) {
    const tagId = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const tag = {
      id: tagId,
      name,
      color: color || this._getNextTagColor(),
      usageCount: 0,
      createdAt: new Date().toISOString()
    };

    this.tags.set(tagId, tag);
    this._save();
    this._notify('tag_created', tag);

    return tag;
  }

  /**
   * Get all tags
   */
  getAllTags() {
    return Array.from(this.tags.values());
  }

  /**
   * Get tag by ID
   */
  getTag(tagId) {
    return this.tags.get(tagId);
  }

  /**
   * Update tag usage count
   */
  updateTagUsage(tagId, delta) {
    const tag = this.tags.get(tagId);
    if (tag) {
      tag.usageCount = Math.max(0, (tag.usageCount || 0) + delta);
      this._save();
    }
  }

  /**
   * Delete a tag
   */
  deleteTag(tagId) {
    const deleted = this.tags.delete(tagId);
    if (deleted) {
      this._save();
      this._notify('tag_deleted', { id: tagId });
    }
    return deleted;
  }

  // --------------------------------------------------------------------------
  // Smart Folders
  // --------------------------------------------------------------------------

  /**
   * Get smart folder definitions
   */
  getSmartFolders() {
    return [
      {
        id: 'smart_all',
        name: 'All Sources',
        icon: 'ph-files',
        type: 'smart',
        filter: () => true
      },
      {
        id: 'smart_recent',
        name: 'Recent',
        icon: 'ph-clock',
        type: 'smart',
        filter: (source) => {
          const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          return new Date(source.importedAt).getTime() > weekAgo;
        }
      },
      {
        id: 'smart_favorites',
        name: 'Favorites',
        icon: 'ph-star',
        type: 'smart',
        filter: (source) => source.isFavorite === true
      },
      {
        id: 'smart_large',
        name: 'Large Files',
        icon: 'ph-file-magnifying-glass',
        type: 'smart',
        filter: (source) => (source.recordCount || 0) > 1000
      },
      {
        id: 'smart_csv',
        name: 'CSV Files',
        icon: 'ph-file-csv',
        type: 'smart',
        filter: (source) => source.name?.toLowerCase().endsWith('.csv')
      },
      {
        id: 'smart_json',
        name: 'JSON Files',
        icon: 'ph-brackets-curly',
        type: 'smart',
        filter: (source) => source.name?.toLowerCase().endsWith('.json')
      },
      {
        id: 'smart_excel',
        name: 'Excel Files',
        icon: 'ph-file-xls',
        type: 'smart',
        filter: (source) => {
          const name = source.name?.toLowerCase() || '';
          return name.endsWith('.xlsx') || name.endsWith('.xls');
        }
      }
    ];
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  _loadFromStorage() {
    try {
      const data = localStorage.getItem('eo_lake_folders');
      if (data) {
        const parsed = JSON.parse(data);

        // Load folders
        if (parsed.folders) {
          for (const folder of parsed.folders) {
            this.folders.set(folder.id, folder);
          }
        }

        // Load tags
        if (parsed.tags) {
          for (const tag of parsed.tags) {
            this.tags.set(tag.id, tag);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load folder data:', e);
    }
  }

  _save() {
    try {
      localStorage.setItem('eo_lake_folders', JSON.stringify({
        folders: Array.from(this.folders.values()),
        tags: Array.from(this.tags.values())
      }));
    } catch (e) {
      console.warn('Failed to save folder data:', e);
    }
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  _generateFolderId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `folder_${timestamp}_${random}`;
  }

  _getNextTagColor() {
    const colors = ['blue', 'green', 'yellow', 'red', 'purple', 'pink', 'orange', 'cyan', 'indigo', 'teal'];
    const usedColors = Array.from(this.tags.values()).map(t => t.color);
    return colors.find(c => !usedColors.includes(c)) || colors[this.tags.size % colors.length];
  }

  subscribe(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  _notify(eventType, data) {
    for (const listener of this._listeners) {
      try {
        listener(eventType, data);
      } catch (e) {
        console.warn('Folder listener error:', e);
      }
    }
  }

  toJSON() {
    return {
      folders: Array.from(this.folders.values()),
      tags: Array.from(this.tags.values())
    };
  }
}


// ============================================================================
// Source Store Extensions for File Explorer
// ============================================================================

/**
 * Extend SourceStore prototype with folder and tag methods
 */
SourceStore.prototype.updateSourceFolder = function(sourceId, folderId) {
  const source = this.sources.get(sourceId);
  if (!source) return null;

  // Create updated source with new folder assignment
  const updated = {
    ...source,
    folderId: folderId,
    updatedAt: new Date().toISOString()
  };

  // Note: We're breaking immutability here for organizational metadata
  // This is acceptable because folder assignment is not part of GIVEN data
  this.sources.set(sourceId, updated);
  this._notify('source_folder_changed', { sourceId, folderId });

  return updated;
};

SourceStore.prototype.updateSourceTags = function(sourceId, tags) {
  const source = this.sources.get(sourceId);
  if (!source) return null;

  const updated = {
    ...source,
    tags: [...new Set(tags)], // Dedupe
    updatedAt: new Date().toISOString()
  };

  this.sources.set(sourceId, updated);
  this._notify('source_tags_changed', { sourceId, tags });

  return updated;
};

SourceStore.prototype.addSourceTag = function(sourceId, tag) {
  const source = this.sources.get(sourceId);
  if (!source) return null;

  const currentTags = source.tags || [];
  if (!currentTags.includes(tag)) {
    return this.updateSourceTags(sourceId, [...currentTags, tag]);
  }
  return source;
};

SourceStore.prototype.removeSourceTag = function(sourceId, tag) {
  const source = this.sources.get(sourceId);
  if (!source) return null;

  const currentTags = source.tags || [];
  return this.updateSourceTags(sourceId, currentTags.filter(t => t !== tag));
};

SourceStore.prototype.toggleFavorite = function(sourceId) {
  const source = this.sources.get(sourceId);
  if (!source) return null;

  const updated = {
    ...source,
    isFavorite: !source.isFavorite,
    updatedAt: new Date().toISOString()
  };

  this.sources.set(sourceId, updated);
  this._notify('source_favorite_changed', { sourceId, isFavorite: updated.isFavorite });

  return updated;
};

SourceStore.prototype.getByFolder = function(folderId) {
  return this.getAll().filter(s => s.folderId === folderId && s.status === 'active');
};

SourceStore.prototype.getByTag = function(tag) {
  return this.getAll().filter(s => (s.tags || []).includes(tag) && s.status === 'active');
};

SourceStore.prototype.getUnorganized = function() {
  return this.getAll().filter(s => !s.folderId && s.status === 'active');
};


// ============================================================================
// Exports
// ============================================================================

if (typeof window !== 'undefined') {
  window.SourceStore = SourceStore;
  window.SetCreator = SetCreator;
  window.JoinBuilder = JoinBuilder;
  window.JoinBuilderUI = JoinBuilderUI;
  window.SetFromSourceUI = SetFromSourceUI;
  window.FolderStore = FolderStore;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SourceStore,
    SetCreator,
    JoinBuilder,
    JoinBuilderUI,
    SetFromSourceUI,
    FolderStore
  };
}
