/**
 * EO Source & Join System
 *
 * Key Principles:
 * 1. Imports create SOURCES (raw data), not Sets
 * 2. Users explicitly create Sets from Sources
 * 3. Joins are EO-IR compliant with full provenance
 * 4. No-code join tools with field mapping and conditionals
 *
 * PROVENANCE STRUCTURE:
 * - Sources use IDENTITY/SPACE/TIME provenance (eo_source_provenance.js)
 *   - Identity: What has been made into a thing?
 *   - Space: Where are the boundaries of relevance?
 *   - Time: How does this persist or change?
 *
 * - Sets use 9-ELEMENT INTERPRETATION PARAMETERS (eo_provenance.js)
 *   - Epistemic Triad: agent, method, source_set
 *   - Semantic Triad: term, definition, jurisdiction
 *   - Situational Triad: scale, timeframe, background
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
   *
   * Sources use Identity/Space/Time provenance structure:
   * - Identity: What has been made into a thing?
   * - Space: Where are the boundaries of relevance?
   * - Time: How does this persist or change?
   *
   * @param {Object} config
   * @param {string} config.name - Source name (usually filename)
   * @param {Object[]} config.records - Raw imported records
   * @param {Object[]} config.schema - Inferred schema (field definitions)
   * @param {Object} config.provenance - Identity/Space/Time provenance
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

      // Provenance (Identity/Space/Time structure)
      // See eo_source_provenance.js for full schema
      provenance: this._normalizeSourceProvenance(provenance, {
        name,
        timestamp,
        fileMetadata,
        parseResult
      }),

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
   * Create an empty source for manual/scratch set creation
   *
   * When users create a "Set from scratch" (without importing data),
   * we still create a backing source to maintain the invariant that
   * all sets have a source. This source starts empty but can receive
   * records via dual-write when records are added to the set.
   *
   * @param {Object} config
   * @param {string} config.name - Source name (usually derived from set name)
   * @param {Object[]} config.fields - Initial field definitions (optional)
   * @param {string} config.actor - Who is creating this source
   * @returns {Source}
   */
  createEmptySource(config) {
    const {
      name,
      fields = [],
      actor = 'user'
    } = config;

    const sourceId = this._generateSourceId();
    const timestamp = new Date().toISOString();

    // Build empty source with manual origin
    const source = {
      id: sourceId,
      name,
      type: 'source',

      // Empty records (will be populated via dual-write)
      records: Object.freeze([]),
      recordCount: 0,

      // Schema (can start empty or with provided fields)
      schema: {
        fields: fields.map(f => ({
          name: f.name,
          type: f.type || 'text',
          sourceColumn: f.name
        })),
        inferenceDecisions: null
      },

      // File identity - null for manual sources
      fileIdentity: {
        originalFilename: null,
        contentHash: null,
        rawSize: null,
        encoding: 'utf-8',
        mimeType: null
      },

      // Origin distinguishes imported vs manual sources
      origin: 'manual',

      // Provenance for manual/scratch sources
      provenance: this._normalizeSourceProvenance({
        identity_kind: 'manual',
        identity_scope: 'composite',
        designation_operator: 'rec',
        designation_mechanism: 'scratch_set_creation',
        asserting_agent: actor,
        authority_class: 'human',
        boundary_type: '+1',
        boundary_basis: 'set',
        container_id: name,
        container_stability: 'mutable', // Manual sources can grow
        containment_level: 'root',
        jurisdiction_present: false,
        temporal_mode: '0', // Ongoing (not a snapshot)
        temporal_justification: 'manual data entry',
        fixation_event: 'source created for scratch set',
        validity_window: 'indefinite',
        reassessment_required: false
      }, { name, timestamp }),

      // No parsing decisions for manual sources
      parsingDecisions: null,

      // Timestamps
      importedAt: null, // Not imported
      createdAt: timestamp,

      // Derived sets (will be populated when set is created)
      derivedSetIds: [],

      // Status
      status: 'active'
    };

    // Freeze the source (immutable snapshot, but can be replaced)
    Object.freeze(source);

    // Store it
    this.sources.set(sourceId, source);

    // Create EO event for provenance
    if (this.eventStore) {
      this._createManualSourceEvent(source, actor);
    }

    // Notify listeners
    this._notify('source_created', source);

    return source;
  }

  /**
   * Add a record to a source (for dual-write from set operations)
   *
   * When a record is added to a set that has a backing source,
   * we also add the record to the source to maintain data consistency.
   * The source is immutable, so we create a new source object.
   *
   * @param {string} sourceId - ID of the source to update
   * @param {Object} record - Record values to add (raw values, not field IDs)
   * @returns {Source} Updated source
   */
  addRecordToSource(sourceId, record) {
    const source = this.sources.get(sourceId);
    if (!source) return null;

    // Only allow adding records to manual sources
    if (source.origin !== 'manual') {
      console.warn('Cannot add records to imported sources - they are immutable');
      return source;
    }

    const timestamp = new Date().toISOString();

    // Create updated source with new record
    const updatedRecords = [...source.records, Object.freeze(record)];

    const updatedSource = {
      ...source,
      records: Object.freeze(updatedRecords),
      recordCount: updatedRecords.length,
      updatedAt: timestamp
    };
    Object.freeze(updatedSource);

    this.sources.set(sourceId, updatedSource);
    this._notify('source_record_added', { source: updatedSource, record });

    return updatedSource;
  }

  /**
   * Update source schema when fields are added to a scratch set
   *
   * @param {string} sourceId - ID of the source to update
   * @param {Object} field - Field definition to add
   * @returns {Source} Updated source
   */
  addFieldToSource(sourceId, field) {
    const source = this.sources.get(sourceId);
    if (!source) return null;

    // Only allow adding fields to manual sources
    if (source.origin !== 'manual') {
      console.warn('Cannot modify schema of imported sources');
      return source;
    }

    const timestamp = new Date().toISOString();

    // Add field to schema
    const updatedFields = [...source.schema.fields, {
      name: field.name,
      type: field.type || 'text',
      sourceColumn: field.name
    }];

    const updatedSource = {
      ...source,
      schema: {
        ...source.schema,
        fields: updatedFields
      },
      updatedAt: timestamp
    };
    Object.freeze(updatedSource);

    this.sources.set(sourceId, updatedSource);
    this._notify('source_schema_updated', updatedSource);

    return updatedSource;
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

  /**
   * Normalize source provenance to Identity/Space/Time structure
   *
   * This creates the proper provenance structure for GIVEN events (sources).
   * Sets use the 9-element interpretation parameters instead.
   *
   * @param {Object} prov - User-provided provenance
   * @param {Object} context - Import context for auto-population
   * @returns {Object} Normalized Identity/Space/Time provenance
   */
  _normalizeSourceProvenance(prov, context = {}) {
    const now = context.timestamp || new Date().toISOString();
    const fileType = context.parseResult?.fileType || context.fileMetadata?.mimeType?.split('/')[1] || 'data';

    // Use EOSourceProvenance if available, otherwise create structure inline
    if (typeof window !== 'undefined' && window.EOSourceProvenance) {
      return window.EOSourceProvenance.createSourceProvenance({
        // Identity dimension
        identityKind: prov.identity_kind || 'import',
        identityScope: prov.identity_scope || 'composite',
        designationOperator: prov.designation_operator || 'rec',
        mechanism: prov.designation_mechanism || `${fileType} import`,
        designationTime: prov.designation_time || now,
        assertingAgent: prov.asserting_agent || prov.agent || null,
        authorityClass: prov.authority_class || (prov.agent ? 'human' : 'pipeline'),

        // Space dimension
        boundaryType: prov.boundary_type || '+1',
        boundaryBasis: prov.boundary_basis || 'file',
        containerId: prov.container_id || context.name || context.fileMetadata?.originalFilename || null,
        containerStability: prov.container_stability || 'immutable',
        containmentLevel: prov.containment_level || 'root',
        jurisdictionPresent: prov.jurisdiction_present ?? false,

        // Time dimension
        temporalMode: prov.temporal_mode || '-1',
        temporalJustification: prov.temporal_justification || 'import snapshot',
        fixationTimestamp: prov.fixation_timestamp || now,
        fixationEvent: prov.fixation_event || 'import completed',
        validityWindow: prov.validity_window || 'implicit',
        reassessmentRequired: prov.reassessment_required ?? false
      });
    }

    // Fallback: create structure inline
    return {
      // IDENTITY DIMENSION - What has been made into a thing?
      identity_kind: prov.identity_kind || 'import',
      identity_scope: prov.identity_scope || 'composite',
      designation_operator: prov.designation_operator || 'rec',
      designation_mechanism: prov.designation_mechanism || `${fileType} import`,
      designation_time: prov.designation_time || now,
      asserting_agent: prov.asserting_agent || prov.agent || null,
      authority_class: prov.authority_class || (prov.agent ? 'human' : 'pipeline'),

      // SPACE DIMENSION - Where are the boundaries of relevance?
      boundary_type: prov.boundary_type || '+1', // bounded by default
      boundary_basis: prov.boundary_basis || 'file',
      container_id: prov.container_id || context.name || context.fileMetadata?.originalFilename || null,
      container_stability: prov.container_stability || 'immutable',
      containment_level: prov.containment_level || 'root',
      jurisdiction_present: prov.jurisdiction_present ?? false,

      // TIME DIMENSION - How does this persist or change?
      temporal_mode: prov.temporal_mode || '-1', // static by default (import snapshot)
      temporal_justification: prov.temporal_justification || 'import snapshot',
      fixation_timestamp: prov.fixation_timestamp || now,
      fixation_event: prov.fixation_event || 'import completed',
      validity_window: prov.validity_window || 'implicit',
      reassessment_required: prov.reassessment_required ?? false
    };
  }

  /**
   * Legacy: Normalize 9-element interpretation provenance
   * Used for backwards compatibility when old-style provenance is provided
   * @deprecated Use _normalizeSourceProvenance for sources
   */
  _normalizeProvenance(prov) {
    // Check if this is already Identity/Space/Time format
    if (prov.identity_kind || prov.boundary_type || prov.temporal_mode) {
      return this._normalizeSourceProvenance(prov);
    }

    // Legacy 9-element format - convert to Identity/Space/Time
    return this._normalizeSourceProvenance({
      asserting_agent: prov.agent,
      designation_mechanism: prov.method,
      container_id: prov.source,
      // Other fields use defaults
    });
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

  _createManualSourceEvent(source, actor) {
    if (!this.eventStore?.add) return;

    const event = {
      id: `evt_${source.id}`,
      epistemicType: 'given', // Still GIVEN - it's source data
      category: 'source_created_manual',
      timestamp: source.createdAt,
      actor: actor || 'user',
      payload: {
        sourceId: source.id,
        name: source.name,
        recordCount: source.recordCount,
        schema: source.schema,
        origin: 'manual'
      },
      grounding: {
        references: [],
        kind: 'internal' // Manual sources don't have external grounding
      },
      frame: {
        claim: `Created empty source for scratch set: ${source.name}`,
        epistemicStatus: 'confirmed',
        purpose: 'scratch_set_backing'
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
        filters: filters,
        advancedFilters: options.advancedFilters || null // Store full nested filter structure
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

    // Create record-type views if source has multiple record types
    if (source.multiRecordAnalysis) {
      this._createRecordTypeViews(set, source);
    }

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

  /**
   * Create a Set "from scratch" - creates both an empty backing source and a set
   *
   * This maintains the invariant that all sets have a backing source.
   * The source starts empty but receives records via dual-write when
   * records are added to the set.
   *
   * @param {Object} config
   * @param {string} config.setName - Name for the new Set
   * @param {Object[]} config.fields - Initial field definitions (optional)
   * @param {string} config.icon - Icon for the set (optional)
   * @param {string} config.actor - Who is creating this (optional)
   * @returns {Object} - { source, set, events }
   */
  createSetFromScratch(config) {
    const {
      setName,
      fields = [{ name: 'Name', type: 'text' }],
      icon = 'ph-table',
      actor = 'user'
    } = config;

    const timestamp = new Date().toISOString();

    // Step 1: Create empty backing source
    const source = this.sourceStore.createEmptySource({
      name: `${setName} (source)`,
      fields: fields,
      actor: actor
    });

    // Step 2: Build field definitions for the set
    const setId = this._generateSetId();
    const setFields = fields.map((field, index) => ({
      id: this._generateFieldId(),
      name: field.name,
      type: field.type || 'text',
      width: field.width || 200,
      isPrimary: index === 0,
      sourceColumn: field.name,
      options: field.options || {}
    }));

    // Step 3: Build derivation (DIRECT strategy - created from scratch)
    const derivation = {
      strategy: 'direct',
      parentSourceId: source.id,
      constraint: {
        selectedFields: fields.map(f => f.name),
        filters: []
      },
      derivedBy: actor,
      derivedAt: timestamp
    };

    // Step 4: Build the Set
    const set = {
      id: setId,
      name: setName,
      icon: icon,
      fields: setFields,
      records: [],
      views: [
        this._createDefaultView()
      ],
      derivation,
      datasetProvenance: {
        originalFilename: null,
        importedAt: null,
        provenance: source.provenance,
        sourceId: source.id,
        origin: 'scratch'
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Step 5: Create provenance events
    const events = this._createScratchSetEvents(set, source, derivation, actor);

    // Step 6: Register derived set with source
    this.sourceStore.registerDerivedSet(source.id, setId);

    return { source, set, events };
  }

  /**
   * Create EO events for scratch set creation
   */
  _createScratchSetEvents(set, source, derivation, actor) {
    const events = [];
    const timestamp = new Date().toISOString();

    // Event: Set created from scratch
    events.push({
      id: `evt_${set.id}`,
      epistemicType: 'meant',
      category: 'set_created_scratch',
      timestamp,
      actor: actor,
      payload: {
        setId: set.id,
        name: set.name,
        fieldCount: set.fields.length,
        recordCount: 0,
        backingSourceId: source.id
      },
      grounding: {
        references: [
          { eventId: `evt_${source.id}`, kind: 'structural' }
        ],
        derivation: {
          strategy: 'direct',
          sourceId: source.id,
          origin: 'scratch'
        },
        kind: 'constructive' // User is constructing new data structure
      },
      frame: {
        claim: `Created scratch set "${set.name}" with empty backing source`,
        epistemicStatus: 'confirmed',
        purpose: 'scratch_set_creation'
      }
    });

    return events;
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

  /**
   * Create a Set from an OperatorChain/SetDefinition
   *
   * This method integrates with eo_query_builder.js to allow
   * Sets to be created from parsed EOQL/SQL queries.
   *
   * @param {Object} setDefinition - SetDefinition from OperatorChain.build()
   * @param {Object} options - Additional options
   * @returns {Object} - { set, events, derivation }
   */
  createSetFromChain(setDefinition, options = {}) {
    const timestamp = new Date().toISOString();

    // Extract info from definition
    const { setId, name, operators, frame, grounding, strategy, sourceRefs, temporalContext } = setDefinition;

    // Get source(s) data
    const sources = sourceRefs.map(srcId => this.sourceStore.get(srcId)).filter(Boolean);
    if (sources.length === 0) {
      throw new Error(`No valid sources found for: ${sourceRefs.join(', ')}`);
    }

    // Execute the operator chain to get result data
    // We need ChainExecutor from eo_query_builder.js
    let resultRows = [];
    let resultColumns = [];

    if (typeof window !== 'undefined' && window.EOQueryBuilder) {
      const executor = new window.EOQueryBuilder.ChainExecutor(this.sourceStore, this.eventStore);
      const result = executor.execute(setDefinition);
      resultRows = result.rows;
      resultColumns = result.columns;
    } else {
      // Fallback: simple execution without full ChainExecutor
      resultRows = this._executeChainSimple(operators, sources);
      resultColumns = resultRows.length > 0 ? Object.keys(resultRows[0]).filter(k => !k.startsWith('_')) : [];
    }

    // Build field definitions from result columns
    const fields = this._buildFieldsFromColumns(resultColumns, resultRows);

    // Transform to records
    const records = resultRows.map((row, index) => ({
      id: this._generateRecordId(),
      setId,
      values: this._transformRowToFieldValues(row, fields),
      createdAt: timestamp,
      updatedAt: timestamp,
      _sourceIndex: index
    }));

    // Build derivation from operator chain
    const derivation = {
      strategy: strategy.toLowerCase(),
      operatorChain: operators.map(op => ({
        op: op.op,
        params: op.params
      })),
      parentSourceIds: sourceRefs,
      constraint: {
        operators: operators.length,
        temporalContext
      },
      derivedBy: grounding?.actor || options.actor || 'user',
      derivedAt: timestamp
    };

    // Build the Set
    const set = {
      id: setId,
      name,
      icon: this._getIconForStrategy(strategy),
      fields,
      records,
      views: [this._createDefaultView()],
      derivation,
      datasetProvenance: {
        sources: sources.map(s => ({
          id: s.id,
          name: s.name,
          originalFilename: s.fileIdentity?.originalFilename
        })),
        strategy,
        operatorCount: operators.length,
        createdAt: timestamp
      },
      frame: frame || { id: 'default', version: '1.0' },
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Create provenance events
    const events = this._createChainDerivationEvents(set, sources, derivation, grounding);

    // Register derived sets with sources
    for (const source of sources) {
      this.sourceStore.registerDerivedSet(source.id, setId);
    }

    return { set, events, derivation };
  }

  /**
   * Simple chain execution fallback when ChainExecutor not available
   */
  _executeChainSimple(operators, sources) {
    let data = [];

    for (const op of operators) {
      switch (op.op) {
        case 'INS':
          const source = sources.find(s => s.id === op.params.sourceId);
          if (source) {
            data = [...source.records];
          }
          break;

        case 'SEG':
          if (op.params.predicate) {
            data = this._filterByPredicate(data, op.params.predicate);
          }
          if (op.params.selectFields) {
            data = data.map(row => {
              const newRow = {};
              for (const col of op.params.selectFields) {
                newRow[col] = row[col];
              }
              return newRow;
            });
          }
          break;

        case 'CON':
          const rightSource = sources.find(s => s.id === op.params.rightSourceId);
          if (rightSource) {
            data = this._executeSimpleJoin(data, rightSource.records, op.params);
          }
          break;

        // ALT, DES, and others pass through
        default:
          break;
      }
    }

    return data;
  }

  _filterByPredicate(data, predicate) {
    return data.filter(row => this._evaluatePredicate(row, predicate));
  }

  _evaluatePredicate(row, pred) {
    if (!pred) return true;

    switch (pred.type) {
      case 'AND':
        return pred.conditions.every(c => this._evaluatePredicate(row, c));
      case 'OR':
        return pred.conditions.some(c => this._evaluatePredicate(row, c));
      case 'NOT':
        return !this._evaluatePredicate(row, pred.operand);
      case 'COMPARISON':
        return this._evaluateComparison(row, pred);
      default:
        return true;
    }
  }

  _evaluateComparison(row, pred) {
    const cellValue = row[pred.field];
    const cellStr = String(cellValue ?? '').toLowerCase();
    const compareValue = pred.value;
    const compareStr = String(compareValue ?? '').toLowerCase();

    switch (pred.operator) {
      case 'eq': return cellStr === compareStr;
      case 'neq': return cellStr !== compareStr;
      case 'gt': return parseFloat(cellValue) > parseFloat(compareValue);
      case 'gte': return parseFloat(cellValue) >= parseFloat(compareValue);
      case 'lt': return parseFloat(cellValue) < parseFloat(compareValue);
      case 'lte': return parseFloat(cellValue) <= parseFloat(compareValue);
      case 'contains': return cellStr.includes(compareStr);
      case 'starts': return cellStr.startsWith(compareStr);
      case 'ends': return cellStr.endsWith(compareStr);
      case 'null': return cellValue === null || cellValue === undefined || cellValue === '';
      case 'notnull': return cellValue !== null && cellValue !== undefined && cellValue !== '';
      case 'in':
        return Array.isArray(compareValue) &&
               compareValue.map(v => String(v).toLowerCase()).includes(cellStr);
      default: return true;
    }
  }

  _executeSimpleJoin(leftData, rightData, params) {
    const { on, type, conflict } = params;
    const result = [];

    // Build index on right
    const rightIndex = new Map();
    for (const row of rightData) {
      const key = String(row[on.right] ?? '').toLowerCase();
      if (!rightIndex.has(key)) rightIndex.set(key, []);
      rightIndex.get(key).push(row);
    }

    for (const leftRow of leftData) {
      const key = String(leftRow[on.left] ?? '').toLowerCase();
      const matches = rightIndex.get(key) || [];

      if (matches.length > 0) {
        if (conflict === 'EXPOSE_ALL') {
          for (const rightRow of matches) {
            result.push({ ...leftRow, ...rightRow });
          }
        } else {
          result.push({ ...leftRow, ...matches[0] });
        }
      } else if (type === 'LEFT' || type === 'FULL') {
        result.push({ ...leftRow });
      }
    }

    return result;
  }

  _buildFieldsFromColumns(columns, rows) {
    return columns.map((col, index) => ({
      id: this._generateFieldId(),
      name: col,
      type: this._inferFieldType(rows, col),
      width: 200,
      isPrimary: index === 0,
      sourceColumn: col
    }));
  }

  _inferFieldType(rows, fieldName) {
    const sample = rows.slice(0, 100);
    const values = sample.map(r => r[fieldName]).filter(v => v != null && v !== '');

    if (values.length === 0) return 'text';

    if (values.every(v => !isNaN(parseFloat(v)) && isFinite(v))) {
      return values.every(v => Number.isInteger(parseFloat(v))) ? 'integer' : 'number';
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}/;
    if (values.every(v => datePattern.test(String(v)))) {
      return 'date';
    }

    return 'text';
  }

  _transformRowToFieldValues(row, fields) {
    const values = {};
    for (const field of fields) {
      values[field.id] = row[field.sourceColumn];
    }
    return values;
  }

  _getIconForStrategy(strategy) {
    const icons = {
      'SEG': 'ph-funnel',
      'CON': 'ph-intersect',
      'SYN': 'ph-equals',
      'DES': 'ph-function',
      'AGG': 'ph-chart-bar'
    };
    return icons[strategy.toUpperCase()] || 'ph-table';
  }

  _createChainDerivationEvents(set, sources, derivation, grounding) {
    const events = [];
    const timestamp = new Date().toISOString();

    // Event: Set created from operator chain
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
        strategy: derivation.strategy,
        operatorCount: derivation.operatorChain.length
      },
      grounding: {
        references: sources.map(source => ({
          eventId: `evt_${source.id}`,
          kind: 'structural'
        })),
        derivation: {
          strategy: derivation.strategy,
          operatorChain: derivation.operatorChain,
          inputs: Object.fromEntries(sources.map(s => [s.id, `evt_${s.id}`]))
        },
        kind: 'computational'
      },
      frame: {
        claim: `Created set "${set.name}" via ${derivation.strategy.toUpperCase()} strategy`,
        epistemicStatus: 'confirmed',
        purpose: grounding?.reason || 'set_derivation'
      }
    });

    return events;
  }

  // --------------------------------------------------------------------------
  // Multi-Record Type View Creation
  // --------------------------------------------------------------------------

  /**
   * Create record-type views if source has multiple record types
   * @param {Object} set - The Set to add views to
   * @param {Object} source - The Source with multiRecordAnalysis
   */
  _createRecordTypeViews(set, source) {
    const multiRecordAnalysis = source.multiRecordAnalysis;
    if (!multiRecordAnalysis || !multiRecordAnalysis.types || multiRecordAnalysis.types.length < 2) {
      return;
    }

    // Find the type field in the set (it may have been renamed)
    const typeField = set.fields.find(f =>
      f.name === multiRecordAnalysis.typeField ||
      f.sourceColumn === multiRecordAnalysis.typeField
    );

    if (!typeField) {
      // Type field was not included in the set, skip view creation
      return;
    }

    for (const typeInfo of multiRecordAnalysis.types) {
      const typeValue = typeInfo.value;

      // Calculate hidden fields (fields with no values for this type)
      const hiddenFields = this._getHiddenFieldsForType(set, typeField.id, typeValue);

      // Calculate field order (type-specific fields prominently after primary)
      const fieldOrder = this._getFieldOrderForType(set, typeField.id, typeValue, multiRecordAnalysis);

      // Get icon for this type
      const icon = this._getIconForType(typeValue);

      // Create the record-type view
      const view = {
        id: 'view_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
        name: this._formatTypeName(typeValue),
        type: 'table',
        config: {
          filters: [{
            fieldId: typeField.id,
            operator: 'is',
            filterValue: typeValue,
            enabled: true
          }],
          hiddenFields,
          fieldOrder,
          sorts: [],
          groups: []
        },
        metadata: {
          recordType: typeValue,
          recordCount: typeInfo.count,
          isRecordTypeView: true,
          icon,
          typeSpecificFields: typeInfo.specificFields || [],
          commonFields: multiRecordAnalysis.commonFields || []
        },
        createdAt: new Date().toISOString()
      };

      set.views.push(view);
    }
  }

  /**
   * Get fields that should be hidden for a specific record type.
   * Returns field IDs for fields that have NO values for records of this type.
   */
  _getHiddenFieldsForType(set, typeFieldId, typeValue) {
    // Get all records of this type
    const typeRecords = set.records.filter(r => r.values[typeFieldId] === typeValue);

    const hiddenFields = [];
    for (const field of set.fields) {
      // Don't hide the type field itself
      if (field.id === typeFieldId) continue;

      // Check if ANY record of this type has a non-empty value for this field
      const hasValue = typeRecords.some(r => {
        const val = r.values[field.id];
        return val !== null && val !== undefined && val !== '';
      });

      if (!hasValue) {
        hiddenFields.push(field.id);
      }
    }

    return hiddenFields;
  }

  /**
   * Get field order for a specific record type.
   * Orders fields with type-specific fields prominently after the primary field.
   */
  _getFieldOrderForType(set, typeFieldId, typeValue, multiRecordAnalysis) {
    // Get type-specific field NAMES from multiRecordAnalysis
    const typeInfo = multiRecordAnalysis?.types?.find(t => t.value === typeValue);
    const specificFieldNames = new Set(typeInfo?.specificFields || []);

    // Map field names to IDs for type-specific fields
    const specificFieldIds = new Set();
    for (const field of set.fields) {
      if (specificFieldNames.has(field.name) || specificFieldNames.has(field.sourceColumn)) {
        specificFieldIds.add(field.id);
      }
    }

    // Order: primary field first, then type-specific, then common fields
    return set.fields
      .map(f => f.id)
      .sort((aId, bId) => {
        const fieldA = set.fields.find(f => f.id === aId);
        const fieldB = set.fields.find(f => f.id === bId);

        // Primary field first
        if (fieldA.isPrimary) return -1;
        if (fieldB.isPrimary) return 1;

        // Type-specific fields next
        const aSpecific = specificFieldIds.has(aId);
        const bSpecific = specificFieldIds.has(bId);
        if (aSpecific && !bSpecific) return -1;
        if (!aSpecific && bSpecific) return 1;

        return 0;
      });
  }

  /**
   * Get an appropriate icon for a record type
   */
  _getIconForType(typeValue) {
    const iconMap = {
      'person': 'ph-user',
      'people': 'ph-users',
      'user': 'ph-user',
      'org': 'ph-buildings',
      'organization': 'ph-buildings',
      'company': 'ph-building-office',
      'government': 'ph-bank',
      'nonprofit': 'ph-heart',
      'contract': 'ph-file-text',
      'document': 'ph-file-doc',
      'property': 'ph-house',
      'real_estate': 'ph-house-line',
      'funding': 'ph-money',
      'payment': 'ph-credit-card',
      'transaction': 'ph-arrows-left-right',
      'bank_account': 'ph-bank',
      'event': 'ph-calendar',
      'meeting': 'ph-calendar-check',
      'complaint': 'ph-warning',
      'violation': 'ph-shield-warning'
    };
    return iconMap[String(typeValue).toLowerCase()] || 'ph-stack';
  }

  /**
   * Format a type value into a display name
   */
  _formatTypeName(typeValue) {
    const str = String(typeValue);
    // Capitalize first letter, replace underscores with spaces
    return str
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
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
// Advanced Filter Builder Component
// ============================================================================

/**
 * AdvancedFilterBuilder - Complex nested filter groups with AND/OR logic
 *
 * Features:
 * - Nested filter groups with configurable logic (AND/OR)
 * - Auto-populated select options from actual data values
 * - Filter by data fields AND provenance metadata
 * - Support for joins/merges where provenance tracking is critical
 */
class AdvancedFilterBuilder {
  constructor(options = {}) {
    this.container = null;
    this._source = options.source || null;
    this._provenanceEnabled = options.provenanceEnabled !== false;
    this._onChange = options.onChange || null;

    // Root filter group
    this._filterGroup = {
      id: this._generateId(),
      logic: 'and',
      conditions: [],
      groups: []
    };

    // Cache for unique values per field (for auto-fill)
    this._fieldValuesCache = new Map();
  }

  /**
   * Set the source to filter
   */
  setSource(source) {
    this._source = source;
    this._fieldValuesCache.clear();
    this._cacheFieldValues();
  }

  /**
   * Get all available fields (data + provenance)
   */
  getAvailableFields() {
    const fields = [];

    // Data fields from source schema
    if (this._source?.schema?.fields) {
      this._source.schema.fields.forEach(f => {
        fields.push({
          id: `data.${f.name}`,
          name: f.name,
          type: f.type,
          category: 'data',
          label: f.name,
          icon: this._getFieldIcon(f.type)
        });
      });
    }

    // Provenance fields
    if (this._provenanceEnabled && this._source?.provenance) {
      const provenanceFields = [
        { id: 'prov.agent', name: 'agent', label: 'Agent (Who)', icon: 'ph-user' },
        { id: 'prov.method', name: 'method', label: 'Method (How)', icon: 'ph-gear' },
        { id: 'prov.source', name: 'source', label: 'Source (Where)', icon: 'ph-link' },
        { id: 'prov.term', name: 'term', label: 'Term', icon: 'ph-tag' },
        { id: 'prov.definition', name: 'definition', label: 'Definition', icon: 'ph-book-open' },
        { id: 'prov.jurisdiction', name: 'jurisdiction', label: 'Jurisdiction', icon: 'ph-globe' },
        { id: 'prov.scale', name: 'scale', label: 'Scale', icon: 'ph-chart-bar' },
        { id: 'prov.timeframe', name: 'timeframe', label: 'Timeframe', icon: 'ph-calendar' },
        { id: 'prov.background', name: 'background', label: 'Background', icon: 'ph-info' }
      ];

      provenanceFields.forEach(pf => {
        fields.push({
          ...pf,
          type: 'text',
          category: 'provenance'
        });
      });

      // File identity fields
      if (this._source?.fileIdentity) {
        fields.push(
          { id: 'file.originalFilename', name: 'originalFilename', label: 'Original Filename', type: 'text', category: 'file', icon: 'ph-file' },
          { id: 'file.mimeType', name: 'mimeType', label: 'MIME Type', type: 'text', category: 'file', icon: 'ph-file-code' },
          { id: 'file.encoding', name: 'encoding', label: 'Encoding', type: 'text', category: 'file', icon: 'ph-code' }
        );
      }
    }

    return fields;
  }

  /**
   * Get operators based on field type
   */
  getOperatorsForType(fieldType) {
    const textOps = [
      { value: 'eq', label: 'equals' },
      { value: 'neq', label: 'not equals' },
      { value: 'contains', label: 'contains' },
      { value: 'not_contains', label: 'does not contain' },
      { value: 'starts', label: 'starts with' },
      { value: 'ends', label: 'ends with' },
      { value: 'regex', label: 'matches regex' },
      { value: 'null', label: 'is empty' },
      { value: 'notnull', label: 'is not empty' }
    ];

    const numericOps = [
      { value: 'eq', label: '=' },
      { value: 'neq', label: '≠' },
      { value: 'gt', label: '>' },
      { value: 'gte', label: '≥' },
      { value: 'lt', label: '<' },
      { value: 'lte', label: '≤' },
      { value: 'between', label: 'between' },
      { value: 'null', label: 'is empty' },
      { value: 'notnull', label: 'is not empty' }
    ];

    const dateOps = [
      { value: 'eq', label: 'is' },
      { value: 'neq', label: 'is not' },
      { value: 'gt', label: 'is after' },
      { value: 'gte', label: 'is on or after' },
      { value: 'lt', label: 'is before' },
      { value: 'lte', label: 'is on or before' },
      { value: 'between', label: 'is between' },
      { value: 'null', label: 'is empty' },
      { value: 'notnull', label: 'is not empty' }
    ];

    const booleanOps = [
      { value: 'eq', label: 'is' },
      { value: 'null', label: 'is empty' },
      { value: 'notnull', label: 'is not empty' }
    ];

    const selectOps = [
      { value: 'eq', label: 'is' },
      { value: 'neq', label: 'is not' },
      { value: 'in', label: 'is any of' },
      { value: 'not_in', label: 'is none of' },
      { value: 'null', label: 'is empty' },
      { value: 'notnull', label: 'is not empty' }
    ];

    switch (fieldType) {
      case 'number':
      case 'integer':
        return numericOps;
      case 'date':
        return dateOps;
      case 'boolean':
        return booleanOps;
      case 'select':
        return selectOps;
      default:
        return textOps;
    }
  }

  /**
   * Get unique values for a field (for auto-fill dropdowns)
   */
  getFieldValues(fieldId) {
    if (this._fieldValuesCache.has(fieldId)) {
      return this._fieldValuesCache.get(fieldId);
    }
    return [];
  }

  /**
   * Cache unique values for all fields
   */
  _cacheFieldValues() {
    if (!this._source?.records) return;

    const records = this._source.records;
    const sampleSize = Math.min(records.length, 1000);

    // Cache data field values
    if (this._source.schema?.fields) {
      this._source.schema.fields.forEach(field => {
        const fieldId = `data.${field.name}`;
        const values = new Set();

        for (let i = 0; i < sampleSize; i++) {
          const val = records[i]?.[field.name];
          if (val !== null && val !== undefined && val !== '') {
            values.add(String(val));
          }
        }

        // Sort and limit to reasonable size
        const sorted = Array.from(values).sort((a, b) => a.localeCompare(b)).slice(0, 100);
        this._fieldValuesCache.set(fieldId, sorted);
      });
    }

    // Cache provenance field values
    if (this._source.provenance) {
      Object.entries(this._source.provenance).forEach(([key, value]) => {
        if (value) {
          this._fieldValuesCache.set(`prov.${key}`, [String(value)]);
        }
      });
    }

    // Cache file identity values
    if (this._source.fileIdentity) {
      Object.entries(this._source.fileIdentity).forEach(([key, value]) => {
        if (value) {
          this._fieldValuesCache.set(`file.${key}`, [String(value)]);
        }
      });
    }
  }

  /**
   * Get the current filter configuration
   */
  getFilters() {
    return JSON.parse(JSON.stringify(this._filterGroup));
  }

  /**
   * Set the filter configuration
   */
  setFilters(filterGroup) {
    this._filterGroup = filterGroup || {
      id: this._generateId(),
      logic: 'and',
      conditions: [],
      groups: []
    };
    this._render();
  }

  /**
   * Convert to flat filter array for backward compatibility
   */
  toFlatFilters() {
    return this._flattenFilters(this._filterGroup);
  }

  /**
   * Render the filter builder UI
   */
  render(container) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    if (!this.container) return;

    this._cacheFieldValues();
    this._render();
  }

  _render() {
    if (!this.container) return;

    const fields = this.getAvailableFields();
    const hasFilters = this._filterGroup.conditions.length > 0 || this._filterGroup.groups.length > 0;

    this.container.innerHTML = `
      <div class="advanced-filter-builder">
        <div class="filter-builder-header">
          <span class="filter-builder-title">
            <i class="ph ph-funnel"></i> Filters
          </span>
          <div class="filter-builder-actions">
            <button class="filter-action-btn filter-add-condition" title="Add condition">
              <i class="ph ph-plus"></i> Condition
            </button>
            <button class="filter-action-btn filter-add-group" title="Add group">
              <i class="ph ph-brackets-curly"></i> Group
            </button>
          </div>
        </div>

        ${hasFilters ? this._renderFilterGroup(this._filterGroup, true) : `
          <div class="filter-empty-state">
            <i class="ph ph-funnel-simple"></i>
            <span>No filters applied. Add conditions to filter records.</span>
          </div>
        `}

        ${hasFilters ? `
          <div class="filter-summary">
            <i class="ph ph-info"></i>
            <span class="filter-summary-text"></span>
          </div>
        ` : ''}
      </div>
    `;

    this._attachEventListeners();
    this._updateSummary();
  }

  _renderFilterGroup(group, isRoot = false) {
    const hasContent = group.conditions.length > 0 || group.groups.length > 0;

    return `
      <div class="filter-group ${isRoot ? 'filter-group-root' : ''}" data-group-id="${group.id}">
        <div class="filter-group-header">
          <div class="filter-logic-toggle">
            <button class="logic-btn ${group.logic === 'and' ? 'active' : ''}" data-logic="and">AND</button>
            <button class="logic-btn ${group.logic === 'or' ? 'active' : ''}" data-logic="or">OR</button>
          </div>
          ${!isRoot ? `
            <button class="filter-group-remove" title="Remove group">
              <i class="ph ph-x"></i>
            </button>
          ` : ''}
        </div>

        <div class="filter-group-content">
          ${group.conditions.map(c => this._renderCondition(c)).join('')}
          ${group.groups.map(g => this._renderFilterGroup(g)).join('')}

          ${!hasContent ? `
            <div class="filter-group-empty">
              <span>Empty group</span>
            </div>
          ` : ''}
        </div>

        <div class="filter-group-actions">
          <button class="filter-group-add-condition">
            <i class="ph ph-plus"></i> Add condition
          </button>
          <button class="filter-group-add-subgroup">
            <i class="ph ph-brackets-curly"></i> Add nested group
          </button>
        </div>
      </div>
    `;
  }

  _renderCondition(condition) {
    const fields = this.getAvailableFields();
    const selectedField = fields.find(f => f.id === condition.field);
    const operators = selectedField ? this.getOperatorsForType(selectedField.type) : this.getOperatorsForType('text');
    const fieldValues = condition.field ? this.getFieldValues(condition.field) : [];
    const needsValue = !['null', 'notnull'].includes(condition.operator);
    const needsSecondValue = condition.operator === 'between';

    // Group fields by category
    const dataFields = fields.filter(f => f.category === 'data');
    const provenanceFields = fields.filter(f => f.category === 'provenance');
    const fileFields = fields.filter(f => f.category === 'file');

    return `
      <div class="filter-condition" data-condition-id="${condition.id}">
        <div class="filter-condition-field">
          <select class="condition-field-select">
            <option value="">Select field...</option>
            ${dataFields.length > 0 ? `
              <optgroup label="Data Fields">
                ${dataFields.map(f => `
                  <option value="${f.id}" ${condition.field === f.id ? 'selected' : ''}>
                    ${this._escapeHtml(f.label)}
                  </option>
                `).join('')}
              </optgroup>
            ` : ''}
            ${provenanceFields.length > 0 ? `
              <optgroup label="Provenance">
                ${provenanceFields.map(f => `
                  <option value="${f.id}" ${condition.field === f.id ? 'selected' : ''}>
                    ${this._escapeHtml(f.label)}
                  </option>
                `).join('')}
              </optgroup>
            ` : ''}
            ${fileFields.length > 0 ? `
              <optgroup label="File Info">
                ${fileFields.map(f => `
                  <option value="${f.id}" ${condition.field === f.id ? 'selected' : ''}>
                    ${this._escapeHtml(f.label)}
                  </option>
                `).join('')}
              </optgroup>
            ` : ''}
          </select>
        </div>

        <div class="filter-condition-operator">
          <select class="condition-operator-select">
            ${operators.map(op => `
              <option value="${op.value}" ${condition.operator === op.value ? 'selected' : ''}>
                ${op.label}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="filter-condition-value ${!needsValue ? 'hidden' : ''}">
          ${fieldValues.length > 0 && fieldValues.length <= 50 ? `
            <div class="condition-value-wrapper">
              <input type="text"
                     class="condition-value-input"
                     placeholder="Enter value..."
                     value="${this._escapeHtml(condition.value || '')}"
                     list="values-${condition.id}">
              <datalist id="values-${condition.id}">
                ${fieldValues.map(v => `<option value="${this._escapeHtml(v)}">`).join('')}
              </datalist>
            </div>
          ` : `
            <input type="text"
                   class="condition-value-input"
                   placeholder="Enter value..."
                   value="${this._escapeHtml(condition.value || '')}">
          `}

          ${needsSecondValue ? `
            <span class="between-separator">and</span>
            <input type="text"
                   class="condition-value-input condition-value2-input"
                   placeholder="End value..."
                   value="${this._escapeHtml(condition.value2 || '')}">
          ` : ''}
        </div>

        <button class="filter-condition-remove" title="Remove condition">
          <i class="ph ph-x"></i>
        </button>
      </div>
    `;
  }

  _attachEventListeners() {
    if (!this.container) return;

    // Root add buttons
    this.container.querySelector('.filter-add-condition')?.addEventListener('click', () => {
      this._addCondition(this._filterGroup.id);
    });

    this.container.querySelector('.filter-add-group')?.addEventListener('click', () => {
      this._addGroup(this._filterGroup.id);
    });

    // Group event handlers
    this.container.querySelectorAll('.filter-group').forEach(groupEl => {
      const groupId = groupEl.dataset.groupId;

      // Logic toggle
      groupEl.querySelectorAll(':scope > .filter-group-header .logic-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._setGroupLogic(groupId, btn.dataset.logic);
        });
      });

      // Remove group
      groupEl.querySelector(':scope > .filter-group-header .filter-group-remove')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this._removeGroup(groupId);
      });

      // Add condition to group
      groupEl.querySelector(':scope > .filter-group-actions .filter-group-add-condition')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this._addCondition(groupId);
      });

      // Add subgroup
      groupEl.querySelector(':scope > .filter-group-actions .filter-group-add-subgroup')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this._addGroup(groupId);
      });
    });

    // Condition event handlers
    this.container.querySelectorAll('.filter-condition').forEach(condEl => {
      const condId = condEl.dataset.conditionId;

      // Field change
      condEl.querySelector('.condition-field-select')?.addEventListener('change', (e) => {
        this._updateConditionField(condId, e.target.value);
      });

      // Operator change
      condEl.querySelector('.condition-operator-select')?.addEventListener('change', (e) => {
        this._updateConditionOperator(condId, e.target.value);
      });

      // Value change
      condEl.querySelector('.condition-value-input')?.addEventListener('input', (e) => {
        this._updateConditionValue(condId, e.target.value);
      });

      // Second value change (for between)
      condEl.querySelector('.condition-value2-input')?.addEventListener('input', (e) => {
        this._updateConditionValue2(condId, e.target.value);
      });

      // Remove condition
      condEl.querySelector('.filter-condition-remove')?.addEventListener('click', () => {
        this._removeCondition(condId);
      });
    });
  }

  _addCondition(groupId) {
    const group = this._findGroup(this._filterGroup, groupId);
    if (!group) return;

    group.conditions.push({
      id: this._generateId(),
      field: '',
      operator: 'eq',
      value: '',
      value2: ''
    });

    this._render();
    this._notifyChange();
  }

  _addGroup(parentGroupId) {
    const parent = this._findGroup(this._filterGroup, parentGroupId);
    if (!parent) return;

    parent.groups.push({
      id: this._generateId(),
      logic: 'and',
      conditions: [],
      groups: []
    });

    this._render();
    this._notifyChange();
  }

  _removeCondition(conditionId) {
    this._removeConditionFromGroup(this._filterGroup, conditionId);
    this._render();
    this._notifyChange();
  }

  _removeConditionFromGroup(group, conditionId) {
    const idx = group.conditions.findIndex(c => c.id === conditionId);
    if (idx !== -1) {
      group.conditions.splice(idx, 1);
      return true;
    }

    for (const subgroup of group.groups) {
      if (this._removeConditionFromGroup(subgroup, conditionId)) {
        return true;
      }
    }

    return false;
  }

  _removeGroup(groupId) {
    this._removeGroupFromParent(this._filterGroup, groupId);
    this._render();
    this._notifyChange();
  }

  _removeGroupFromParent(parent, groupId) {
    const idx = parent.groups.findIndex(g => g.id === groupId);
    if (idx !== -1) {
      parent.groups.splice(idx, 1);
      return true;
    }

    for (const subgroup of parent.groups) {
      if (this._removeGroupFromParent(subgroup, groupId)) {
        return true;
      }
    }

    return false;
  }

  _setGroupLogic(groupId, logic) {
    const group = this._findGroup(this._filterGroup, groupId);
    if (group) {
      group.logic = logic;
      this._render();
      this._notifyChange();
    }
  }

  _updateConditionField(conditionId, fieldId) {
    const condition = this._findCondition(this._filterGroup, conditionId);
    if (condition) {
      condition.field = fieldId;
      condition.value = '';
      condition.value2 = '';

      // Reset operator to appropriate default
      const fields = this.getAvailableFields();
      const field = fields.find(f => f.id === fieldId);
      const operators = field ? this.getOperatorsForType(field.type) : [];
      if (operators.length > 0 && !operators.find(op => op.value === condition.operator)) {
        condition.operator = operators[0].value;
      }

      this._render();
      this._notifyChange();
    }
  }

  _updateConditionOperator(conditionId, operator) {
    const condition = this._findCondition(this._filterGroup, conditionId);
    if (condition) {
      condition.operator = operator;
      this._render();
      this._notifyChange();
    }
  }

  _updateConditionValue(conditionId, value) {
    const condition = this._findCondition(this._filterGroup, conditionId);
    if (condition) {
      condition.value = value;
      this._updateSummary();
      this._notifyChange();
    }
  }

  _updateConditionValue2(conditionId, value) {
    const condition = this._findCondition(this._filterGroup, conditionId);
    if (condition) {
      condition.value2 = value;
      this._updateSummary();
      this._notifyChange();
    }
  }

  _findGroup(root, groupId) {
    if (root.id === groupId) return root;

    for (const subgroup of root.groups) {
      const found = this._findGroup(subgroup, groupId);
      if (found) return found;
    }

    return null;
  }

  _findCondition(group, conditionId) {
    const found = group.conditions.find(c => c.id === conditionId);
    if (found) return found;

    for (const subgroup of group.groups) {
      const found = this._findCondition(subgroup, conditionId);
      if (found) return found;
    }

    return null;
  }

  _flattenFilters(group) {
    const filters = [];

    // Add direct conditions (convert field format)
    group.conditions.forEach(c => {
      if (c.field) {
        const fieldParts = c.field.split('.');
        filters.push({
          field: fieldParts.length > 1 ? fieldParts.slice(1).join('.') : c.field,
          fieldCategory: fieldParts[0],
          operator: c.operator,
          value: c.value,
          value2: c.value2
        });
      }
    });

    // Recursively flatten subgroups
    group.groups.forEach(g => {
      filters.push(...this._flattenFilters(g));
    });

    return filters;
  }

  _updateSummary() {
    const summaryEl = this.container?.querySelector('.filter-summary-text');
    if (!summaryEl) return;

    const count = this._countConditions(this._filterGroup);
    const groupCount = this._countGroups(this._filterGroup);

    if (count === 0) {
      summaryEl.textContent = 'No active conditions';
    } else {
      const parts = [];
      parts.push(`${count} condition${count !== 1 ? 's' : ''}`);
      if (groupCount > 0) {
        parts.push(`${groupCount} group${groupCount !== 1 ? 's' : ''}`);
      }
      summaryEl.textContent = parts.join(', ');
    }
  }

  _countConditions(group) {
    let count = group.conditions.filter(c => c.field).length;
    group.groups.forEach(g => {
      count += this._countConditions(g);
    });
    return count;
  }

  _countGroups(group) {
    let count = group.groups.length;
    group.groups.forEach(g => {
      count += this._countGroups(g);
    });
    return count;
  }

  _notifyChange() {
    if (this._onChange) {
      this._onChange(this.getFilters());
    }
  }

  _generateId() {
    return 'flt_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  _getFieldIcon(type) {
    const icons = {
      text: 'ph-text-aa',
      number: 'ph-hash',
      integer: 'ph-hash',
      date: 'ph-calendar',
      boolean: 'ph-check-square',
      select: 'ph-list'
    };
    return icons[type] || 'ph-text-aa';
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Evaluate if a record matches the filter group
   */
  static evaluateRecord(record, filterGroup, source = null) {
    return AdvancedFilterBuilder._evaluateGroup(record, filterGroup, source);
  }

  static _evaluateGroup(record, group, source) {
    const conditionResults = group.conditions.map(c =>
      AdvancedFilterBuilder._evaluateCondition(record, c, source)
    );
    const groupResults = group.groups.map(g =>
      AdvancedFilterBuilder._evaluateGroup(record, g, source)
    );

    const allResults = [...conditionResults, ...groupResults];

    if (allResults.length === 0) return true;

    if (group.logic === 'or') {
      return allResults.some(r => r);
    } else {
      return allResults.every(r => r);
    }
  }

  static _evaluateCondition(record, condition, source) {
    if (!condition.field) return true;

    let value;
    const [category, ...fieldParts] = condition.field.split('.');
    const fieldName = fieldParts.join('.');

    switch (category) {
      case 'data':
        value = record[fieldName];
        break;
      case 'prov':
        value = source?.provenance?.[fieldName];
        break;
      case 'file':
        value = source?.fileIdentity?.[fieldName];
        break;
      default:
        value = record[condition.field];
    }

    return AdvancedFilterBuilder._evaluateValue(value, condition.operator, condition.value, condition.value2);
  }

  static _evaluateValue(cellValue, operator, filterValue, filterValue2 = null) {
    const cellStr = String(cellValue ?? '').toLowerCase();
    const filterStr = String(filterValue ?? '').toLowerCase();
    const filterStr2 = filterValue2 ? String(filterValue2).toLowerCase() : null;

    switch (operator) {
      case 'eq':
        return cellStr === filterStr;
      case 'neq':
        return cellStr !== filterStr;
      case 'contains':
        return cellStr.includes(filterStr);
      case 'not_contains':
        return !cellStr.includes(filterStr);
      case 'starts':
        return cellStr.startsWith(filterStr);
      case 'ends':
        return cellStr.endsWith(filterStr);
      case 'regex':
        try {
          return new RegExp(filterValue, 'i').test(String(cellValue ?? ''));
        } catch {
          return false;
        }
      case 'gt':
        return parseFloat(cellValue) > parseFloat(filterValue);
      case 'lt':
        return parseFloat(cellValue) < parseFloat(filterValue);
      case 'gte':
        return parseFloat(cellValue) >= parseFloat(filterValue);
      case 'lte':
        return parseFloat(cellValue) <= parseFloat(filterValue);
      case 'between':
        const numVal = parseFloat(cellValue);
        return numVal >= parseFloat(filterValue) && numVal <= parseFloat(filterValue2);
      case 'in':
        const inValues = filterValue.split(',').map(v => v.trim().toLowerCase());
        return inValues.includes(cellStr);
      case 'not_in':
        const notInValues = filterValue.split(',').map(v => v.trim().toLowerCase());
        return !notInValues.includes(cellStr);
      case 'null':
        return cellValue === null || cellValue === undefined || cellValue === '';
      case 'notnull':
        return cellValue !== null && cellValue !== undefined && cellValue !== '';
      default:
        return true;
    }
  }
}


// ============================================================================
// Set From Source UI Component
// ============================================================================

/**
 * SetFromSourceUI - Visual interface for creating Sets from Sources
 * Now with advanced nested filter groups and provenance filtering
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
    this._filterBuilder = null;
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

    // Initialize the advanced filter builder
    this._filterBuilder = new AdvancedFilterBuilder({
      source: this._source,
      provenanceEnabled: true,
      onChange: () => this._onFilterChange()
    });

    this._render();
    this._attachEventListeners();
  }

  hide() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
    }
    this._filterBuilder = null;
  }

  _onFilterChange() {
    // Auto-update preview when filters change (debounced)
    if (this._previewDebounce) {
      clearTimeout(this._previewDebounce);
    }
    this._previewDebounce = setTimeout(() => {
      this._updateFilteredCount();
    }, 300);
  }

  _updateFilteredCount() {
    const countEl = this.container?.querySelector('.filter-result-count');
    if (!countEl) return;

    const filterGroup = this._filterBuilder.getFilters();
    let filteredCount = 0;

    for (const record of this._source.records) {
      if (AdvancedFilterBuilder.evaluateRecord(record, filterGroup, this._source)) {
        filteredCount++;
      }
    }

    countEl.textContent = `${filteredCount} of ${this._source.recordCount} records match`;
    countEl.classList.toggle('has-filters', filteredCount < this._source.recordCount);
  }

  _render() {
    this.container.style.display = 'block';
    this.container.innerHTML = `
      <div class="set-creator-overlay">
        <div class="set-creator-modal set-creator-modal-large">
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

            <!-- Advanced Filters -->
            <div class="set-creator-filters-section set-creator-advanced-filters">
              <div class="filters-header">
                <div>
                  <h3><i class="ph ph-funnel"></i> Filters</h3>
                  <p class="section-desc">Build complex filter conditions with AND/OR logic. Filter by data fields or provenance metadata.</p>
                </div>
                <span class="filter-result-count">${this._source.recordCount} of ${this._source.recordCount} records match</span>
              </div>

              <div id="advanced-filter-container"></div>
            </div>

            <!-- Preview -->
            <div class="set-creator-preview-section">
              <button class="preview-btn" id="preview-set-btn">
                <i class="ph ph-eye"></i> Preview Results
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

    // Render the advanced filter builder
    const filterContainer = this.container.querySelector('#advanced-filter-container');
    if (filterContainer && this._filterBuilder) {
      this._filterBuilder.render(filterContainer);
    }
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
      this._renderFieldList();
    });

    this.container.querySelector('#deselect-all-fields')?.addEventListener('click', () => {
      this._selectedFields.forEach(f => f.include = false);
      this._renderFieldList();
    });

    // Field row changes
    this._attachFieldRowListeners();

    // Preview
    this.container.querySelector('#preview-set-btn')?.addEventListener('click', () => {
      this._showPreview();
    });

    // Create
    this.container.querySelector('#set-creator-create-btn')?.addEventListener('click', () => {
      this._createSet();
    });
  }

  _renderFieldList() {
    const listEl = this.container.querySelector('#field-select-list');
    if (listEl) {
      listEl.innerHTML = this._selectedFields.map((f, i) => this._renderFieldRow(f, i)).join('');
      this._attachFieldRowListeners();
    }
  }

  _attachFieldRowListeners() {
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
      // Apply advanced filters
      const filterGroup = this._filterBuilder.getFilters();
      const filteredRecords = this._source.records.filter(record =>
        AdvancedFilterBuilder.evaluateRecord(record, filterGroup, this._source)
      );

      const sampleRecords = filteredRecords.slice(0, 10);
      const headers = selectedFields.map(f => f.rename || f.name);

      previewEl.innerHTML = `
        <div class="preview-stats">
          <span><strong>${filteredRecords.length}</strong> of ${this._source.recordCount} records</span>
          <span>${selectedFields.length} fields</span>
        </div>
        <div class="preview-table-container">
          <table class="preview-table">
            <thead>
              <tr>
                ${headers.map(h => `<th>${this._escapeHtml(h)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${sampleRecords.map(row => `
                <tr>
                  ${selectedFields.map(f => `<td>${this._escapeHtml(String(row[f.name] ?? ''))}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${filteredRecords.length > 10 ? `
          <div class="preview-more">Showing first 10 of ${filteredRecords.length} records</div>
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
      // Get the advanced filter configuration
      const filterGroup = this._filterBuilder.getFilters();

      // Convert to flat filters for backward compatibility with SetCreator
      const flatFilters = this._filterBuilder.toFlatFilters();

      // Also store the full filter group for provenance
      const result = this.setCreator.createSetFromSource({
        sourceId: this._source.id,
        setName,
        selectedFields,
        filters: flatFilters,
        advancedFilters: filterGroup // Store the full nested structure
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
// Query Builder UI - Dual-mode interface for creating Sets
// ============================================================================

/**
 * QueryBuilderUI - Visual query builder with wizard and code modes
 *
 * Two paths to create Sets:
 * - Wizard Mode: Point-and-click filtering (easy)
 * - Query Mode: SQL or EOQL code editor (power)
 *
 * Both modes produce the same output: a SetDefinition with operator chain
 */
class QueryBuilderUI {
  constructor(setCreator, container) {
    this.setCreator = setCreator;
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    this._onComplete = null;
    this._onCancel = null;
    this._source = null;
    this._availableSources = []; // All sources available for joining
    this._mode = 'wizard'; // 'wizard' or 'query'
    this._language = 'sql'; // 'sql' or 'eoql'
    this._queryText = '';
    this._parseResult = null;
    this._operatorChain = null;
    this._previewData = null;
    this._filterBuilder = null;
    this._selectedFields = [];
    this._setName = '';
    // Join support
    this._joins = []; // Array of { sourceId, alias, conditions: [{left, op, right}], type, conflict }
    this._conflictPolicies = ['EXPOSE_ALL', 'PICK_FIRST', 'PICK_LAST', 'AGGREGATE', 'CLUSTER'];
    this._joinTypes = ['LEFT', 'INNER', 'RIGHT', 'FULL'];
  }

  /**
   * Show the query builder for a source
   */
  show(sourceId, options = {}) {
    this._onComplete = options.onComplete;
    this._onCancel = options.onCancel;
    this._source = this.setCreator.sourceStore.get(sourceId);

    if (!this._source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    // Get all available sources for joining (exclude current source)
    this._availableSources = [];
    if (this.setCreator.sourceStore.sources) {
      this.setCreator.sourceStore.sources.forEach((src, id) => {
        if (id !== sourceId) {
          this._availableSources.push(src);
        }
      });
    }

    // Initialize state
    this._mode = options.mode || 'wizard';
    this._language = options.language || 'sql';
    this._setName = `${this._source.name}_query`;
    this._joins = []; // Reset joins
    this._selectedFields = this._source.schema.fields.map(f => ({
      name: f.name,
      type: f.type,
      rename: null,
      include: true,
      source: 'primary'
    }));

    // Initialize filter builder for wizard mode
    this._filterBuilder = new AdvancedFilterBuilder({
      source: this._source,
      provenanceEnabled: true,
      onChange: () => this._onWizardChange()
    });

    // Generate initial query text
    this._generateQueryFromWizard();

    this._render();
    this._attachEventListeners();
  }

  hide() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
    }
    this._filterBuilder = null;
    this._parseResult = null;
    this._operatorChain = null;
  }

  /**
   * Switch between wizard and query modes
   */
  setMode(mode) {
    if (mode === this._mode) return;

    if (mode === 'query') {
      // Generate query from current wizard state
      this._generateQueryFromWizard();
    } else if (mode === 'wizard') {
      // Parse current query back to wizard (if possible)
      this._parseQueryToWizard();
    }

    this._mode = mode;
    this._updateModeUI();
  }

  /**
   * Switch query language
   */
  setLanguage(lang) {
    if (lang === this._language) return;
    this._language = lang;
    this._generateQueryFromWizard();
    this._updateLanguageUI();
  }

  /**
   * Generate SQL/EOQL from wizard state
   */
  _generateQueryFromWizard() {
    const filters = this._filterBuilder ? this._filterBuilder.getFilters() : null;
    const fields = this._selectedFields.filter(f => f.include);
    const fieldNames = fields.map(f => f.rename || f.name);

    if (this._language === 'eoql') {
      this._queryText = this._generateEOQL(fieldNames, filters);
    } else {
      this._queryText = this._generateSQL(fieldNames, filters);
    }

    this._parseQuery();
  }

  _generateEOQL(fields, filters) {
    let query = `FROM "${this._source.name}" AS s`;

    // Add joins
    for (const join of this._joins) {
      if (join.sourceId && join.conditions.length > 0) {
        const source = this._availableSources.find(s => s.id === join.sourceId);
        if (source) {
          const condStr = join.conditions
            .filter(c => c.left && c.right)
            .map(c => `s.${c.left} = ${join.alias}.${c.right}`)
            .join(' AND ');
          if (condStr) {
            query += `\n|> CON "${source.name}" AS ${join.alias} ON ${condStr} CONFLICT ${join.conflict}`;
          }
        }
      }
    }

    // Add filter if present
    if (filters && filters.conditions && filters.conditions.length > 0) {
      const filterExpr = this._filterGroupToEOQL(filters);
      if (filterExpr) {
        query += `\n|> SEG ${filterExpr}`;
      }
    }

    // Temporal context (required)
    query += `\n|> ALT NOW`;

    // Name the result
    query += `\n|> DES '${this._setName}'`;

    return query;
  }

  _generateSQL(fields, filters) {
    const fieldList = fields.length > 0 ? fields.join(', ') : '*';
    let query = `SELECT ${fieldList}\nFROM "${this._source.name}" s`;

    // Add joins
    for (const join of this._joins) {
      if (join.sourceId && join.conditions.length > 0) {
        const source = this._availableSources.find(s => s.id === join.sourceId);
        if (source) {
          const condStr = join.conditions
            .filter(c => c.left && c.right)
            .map(c => `s.${c.left} = ${join.alias}.${c.right}`)
            .join(' AND ');
          if (condStr) {
            query += `\n${join.type} JOIN "${source.name}" ${join.alias} ON ${condStr}`;
          }
        }
      }
    }

    // Add CONFLICT clause if there are joins
    if (this._joins.some(j => j.sourceId)) {
      const conflict = this._joins[0]?.conflict || 'EXPOSE_ALL';
      query += `\nCONFLICT ${conflict}`;
    }

    // Add WHERE if filters present
    if (filters && filters.conditions && filters.conditions.length > 0) {
      const whereClause = this._filterGroupToSQL(filters);
      if (whereClause) {
        query += `\nWHERE ${whereClause}`;
      }
    }

    // EO extensions
    query += `\nAS OF NOW`;
    query += `\nAS SET '${this._setName}'`;

    return query;
  }

  _filterGroupToEOQL(group) {
    if (!group || !group.conditions || group.conditions.length === 0) return '';

    const parts = group.conditions.map(cond => {
      if (cond.type === 'group') {
        return `(${this._filterGroupToEOQL(cond)})`;
      }
      return this._conditionToEOQL(cond);
    }).filter(Boolean);

    const connector = group.logic === 'OR' ? ' OR ' : ' AND ';
    return parts.join(connector);
  }

  _conditionToEOQL(cond) {
    const field = cond.field;
    const value = typeof cond.value === 'string' ? `'${cond.value}'` : cond.value;

    switch (cond.operator) {
      case 'eq': return `${field} = ${value}`;
      case 'neq': return `${field} != ${value}`;
      case 'gt': return `${field} > ${value}`;
      case 'gte': return `${field} >= ${value}`;
      case 'lt': return `${field} < ${value}`;
      case 'lte': return `${field} <= ${value}`;
      case 'contains': return `${field} CONTAINS ${value}`;
      case 'starts': return `${field} STARTS WITH ${value}`;
      case 'ends': return `${field} ENDS WITH ${value}`;
      case 'null': return `${field} IS NULL`;
      case 'notnull': return `${field} IS NOT NULL`;
      default: return `${field} = ${value}`;
    }
  }

  _filterGroupToSQL(group) {
    if (!group || !group.conditions || group.conditions.length === 0) return '';

    const parts = group.conditions.map(cond => {
      if (cond.type === 'group') {
        return `(${this._filterGroupToSQL(cond)})`;
      }
      return this._conditionToSQL(cond);
    }).filter(Boolean);

    const connector = group.logic === 'OR' ? ' OR ' : ' AND ';
    return parts.join(connector);
  }

  _conditionToSQL(cond) {
    const field = cond.field;
    const value = typeof cond.value === 'string' ? `'${cond.value}'` : cond.value;

    switch (cond.operator) {
      case 'eq': return `${field} = ${value}`;
      case 'neq': return `${field} <> ${value}`;
      case 'gt': return `${field} > ${value}`;
      case 'gte': return `${field} >= ${value}`;
      case 'lt': return `${field} < ${value}`;
      case 'lte': return `${field} <= ${value}`;
      case 'contains': return `${field} LIKE '%${cond.value}%'`;
      case 'starts': return `${field} LIKE '${cond.value}%'`;
      case 'ends': return `${field} LIKE '%${cond.value}'`;
      case 'null': return `${field} IS NULL`;
      case 'notnull': return `${field} IS NOT NULL`;
      default: return `${field} = ${value}`;
    }
  }

  /**
   * Parse current query text
   */
  _parseQuery() {
    if (!window.EOQueryLanguage) {
      this._parseResult = { success: false, error: 'Query parser not loaded' };
      return;
    }

    try {
      const result = window.EOQueryLanguage.QueryParser.parse(this._queryText, {
        language: this._language
      });

      this._parseResult = result;

      if (result.success) {
        // Convert to OperatorChain if EOQueryBuilder is available
        if (window.EOQueryBuilder) {
          this._operatorChain = window.EOQueryLanguage.QueryParser.toOperatorChain(result);
        }
        this._updatePreview();
      }
    } catch (e) {
      this._parseResult = { success: false, error: e.message };
    }

    this._updateValidationUI();
  }

  /**
   * Try to parse query back into wizard state
   */
  _parseQueryToWizard() {
    // This is a best-effort reverse parse
    // Complex queries may not fully translate back
    if (!this._parseResult || !this._parseResult.success) return;

    const pipeline = this._parseResult.pipeline;

    // Find SEG operator for filters
    const segOp = pipeline.find(op => op.op === 'SEG');
    if (segOp && segOp.params && segOp.params.predicate) {
      // Convert predicate back to filter builder format
      // This is simplified - full implementation would recursively convert
      this._filterBuilder.clear();
      // TODO: Convert predicate to filter conditions
    }

    // Find DES operator for name
    const desOp = pipeline.find(op => op.op === 'DES');
    if (desOp && desOp.params && desOp.params.designation) {
      this._setName = desOp.params.designation;
    }
  }

  /**
   * Update preview data
   */
  _updatePreview() {
    if (!this._operatorChain) {
      this._previewData = null;
      return;
    }

    try {
      // Build the SetDefinition
      const setDef = this._operatorChain.build();

      // Execute preview using ChainExecutor
      if (window.EOQueryBuilder) {
        const executor = new window.EOQueryBuilder.ChainExecutor(this.setCreator.sourceStore);
        const result = executor.preview(setDef, { limit: 10 });
        this._previewData = {
          totalCount: result.totalCount,
          rows: result.rows,
          operators: setDef.operators
        };
      } else {
        // Fallback: just count matching records using wizard filters
        const filters = this._filterBuilder ? this._filterBuilder.getFilters() : null;
        let count = 0;
        const rows = [];

        for (const record of this._source.records) {
          if (!filters || AdvancedFilterBuilder.evaluateRecord(record, filters, this._source)) {
            if (rows.length < 10) rows.push(record);
            count++;
          }
        }

        this._previewData = { totalCount: count, rows };
      }
    } catch (e) {
      this._previewData = { error: e.message };
    }

    this._updatePreviewUI();
  }

  _onWizardChange() {
    // Debounce
    if (this._wizardDebounce) clearTimeout(this._wizardDebounce);
    this._wizardDebounce = setTimeout(() => {
      this._generateQueryFromWizard();
      this._updatePreview();
    }, 300);
  }

  /**
   * Create the set
   */
  _createSet() {
    if (!this._operatorChain) {
      alert('Please fix query errors before creating set');
      return;
    }

    try {
      const setDef = this._operatorChain.build();

      // Use SetCreator.createSetFromChain
      const result = this.setCreator.createSetFromChain(setDef, {
        actor: 'user',
        grounding: {
          reason: `Created via Query Builder from ${this._source.name}`,
          sourceId: this._source.id
        }
      });

      if (this._onComplete) {
        this._onComplete(result);
      }

      this.hide();
    } catch (e) {
      alert(`Error creating set: ${e.message}`);
    }
  }

  _render() {
    this.container.style.display = 'block';
    this.container.innerHTML = `
      <div class="query-builder-overlay">
        <div class="query-builder-modal">
          <div class="query-builder-header">
            <div class="qb-header-title">
              <h2><i class="ph ph-code"></i> Query Builder</h2>
              <p class="qb-subtitle">
                <span class="source-badge"><i class="ph ph-file"></i> ${this._escapeHtml(this._source.name)}</span>
                <span class="record-count">${this._source.recordCount} records</span>
              </p>
            </div>
            <button class="qb-close-btn" id="qb-close-btn">
              <i class="ph ph-x"></i>
            </button>
          </div>

          <div class="qb-mode-tabs">
            <button class="qb-mode-tab ${this._mode === 'wizard' ? 'active' : ''}" data-mode="wizard">
              <i class="ph ph-magic-wand"></i>
              <span>Wizard</span>
              <span class="mode-badge easy">Easy</span>
            </button>
            <button class="qb-mode-tab ${this._mode === 'query' ? 'active' : ''}" data-mode="query">
              <i class="ph ph-code"></i>
              <span>Query</span>
              <span class="mode-badge power">Power</span>
            </button>
          </div>

          <div class="qb-body">
            ${this._mode === 'wizard' ? this._renderWizardMode() : this._renderQueryMode()}
          </div>

          <div class="qb-operator-chain" id="qb-operator-chain">
            ${this._renderOperatorChain()}
          </div>

          <div class="qb-preview">
            <div class="preview-header">
              <span class="preview-title">
                <i class="ph ph-eye"></i> Preview
              </span>
              <span class="preview-count" id="qb-preview-count">
                ${this._previewData ? `${this._previewData.totalCount} records` : 'Calculating...'}
              </span>
            </div>
            <div class="preview-table-container" id="qb-preview-table">
              ${this._renderPreviewTable()}
            </div>
          </div>

          <div class="qb-footer">
            <button class="btn btn-secondary" id="qb-cancel-btn">Cancel</button>
            <button class="btn btn-success" id="qb-create-btn" ${!this._parseResult?.success ? 'disabled' : ''}>
              <i class="ph ph-plus-circle"></i>
              Create Set
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderWizardMode() {
    return `
      <div class="wizard-mode">
        <div class="wizard-step">
          <div class="step-header">
            <span class="step-num">1</span>
            <span class="step-label">Name your new Set</span>
          </div>
          <input type="text" class="qb-input" id="qb-set-name"
                 value="${this._escapeHtml(this._setName)}"
                 placeholder="e.g., Filtered Records">
        </div>

        <div class="wizard-step">
          <div class="step-header">
            <span class="step-num">2</span>
            <span class="step-label">Join with other sources <span class="step-optional">(optional)</span></span>
          </div>
          <div class="join-builder" id="qb-join-builder">
            ${this._renderJoinsUI()}
          </div>
        </div>

        <div class="wizard-step">
          <div class="step-header">
            <span class="step-num">3</span>
            <span class="step-label">Filter records</span>
          </div>
          <div id="qb-filter-builder"></div>
        </div>

        <div class="wizard-step">
          <div class="step-header">
            <span class="step-num">4</span>
            <span class="step-label">Select columns</span>
          </div>
          <div class="column-chips" id="qb-column-chips">
            ${this._renderColumnChips()}
          </div>
        </div>
      </div>
    `;
  }

  _renderQueryMode() {
    return `
      <div class="query-mode">
        <div class="lang-tabs">
          <button class="lang-tab ${this._language === 'sql' ? 'active' : ''}" data-lang="sql">
            <i class="ph ph-database"></i> SQL
          </button>
          <button class="lang-tab ${this._language === 'eoql' ? 'active' : ''}" data-lang="eoql">
            <i class="ph ph-flow-arrow"></i> EOQL
          </button>
        </div>

        <div class="query-editor-container">
          <div class="query-editor-wrapper">
            <div class="query-editor-highlight" id="qb-highlight"></div>
            <textarea class="query-editor with-highlight" id="qb-query-editor"
                      placeholder="Write your query here..." spellcheck="false">${this._escapeHtml(this._queryText)}</textarea>
          </div>
          <div class="autocomplete-dropdown" id="qb-autocomplete" style="display: none;"></div>
          <div class="query-toolbar">
            <div class="query-hints">
              <span class="hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> Run</span>
              <span class="hint"><kbd>Tab</kbd> Autocomplete</span>
            </div>
            <button class="btn btn-sm btn-primary" id="qb-run-query">
              <i class="ph ph-play"></i> Run
            </button>
          </div>
        </div>

        <div class="query-validation" id="qb-validation">
          ${this._renderValidation()}
        </div>
      </div>
    `;
  }

  /**
   * Apply syntax highlighting to query text
   */
  _highlightQuery(text) {
    if (!text) return '';

    const language = this._language;
    let highlighted = this._escapeHtml(text);

    // SQL/EOQL Keywords
    const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'IS', 'NULL',
      'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'GROUP', 'HAVING',
      'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'ON', 'AS',
      'DISTINCT', 'BETWEEN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION'];

    const eoqlKeywords = ['FROM', 'SEG', 'CON', 'ALT', 'DES', 'SYN', 'SUP', 'NUL', 'AGG', 'INS'];

    const eoExtensions = ['AS OF', 'AS SET', 'CONFLICT', 'EXPOSE_ALL', 'PICK_FIRST', 'PICK_LAST',
      'AGGREGATE', 'CLUSTER', 'NOW', 'STATIC', 'DYNAMIC'];

    const functions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'FIRST', 'LAST', 'ROUND', 'COALESCE'];

    // Apply highlighting in order
    // 1. Comments
    highlighted = highlighted.replace(/(--[^\n]*)/g, '<span class="hl-comment">$1</span>');

    // 2. Strings (single and double quotes)
    highlighted = highlighted.replace(/('[^']*'|"[^"]*")/g, '<span class="hl-string">$1</span>');

    // 3. Numbers
    highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');

    // 4. EO Extensions (must be before keywords)
    for (const ext of eoExtensions) {
      const regex = new RegExp(`\\b(${ext.replace(' ', '\\s+')})\\b`, 'gi');
      highlighted = highlighted.replace(regex, '<span class="hl-eo-extension">$1</span>');
    }

    // 5. Pipe operator for EOQL
    highlighted = highlighted.replace(/(\|&gt;)/g, '<span class="hl-operator">$1</span>');

    // 6. Functions
    for (const fn of functions) {
      const regex = new RegExp(`\\b(${fn})\\b`, 'gi');
      highlighted = highlighted.replace(regex, '<span class="hl-function">$1</span>');
    }

    // 7. Keywords
    const keywords = language === 'eoql' ? [...eoqlKeywords, ...sqlKeywords] : sqlKeywords;
    for (const kw of keywords) {
      const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
      highlighted = highlighted.replace(regex, '<span class="hl-keyword">$1</span>');
    }

    return highlighted;
  }

  /**
   * Update the syntax highlighting display
   */
  _updateHighlight() {
    const highlight = this.container?.querySelector('#qb-highlight');
    const editor = this.container?.querySelector('#qb-query-editor');
    if (highlight && editor) {
      highlight.innerHTML = this._highlightQuery(editor.value) + '\n';
      // Sync scroll
      highlight.scrollTop = editor.scrollTop;
      highlight.scrollLeft = editor.scrollLeft;
    }
  }

  /**
   * Get autocomplete suggestions based on cursor position
   */
  _getAutocompleteSuggestions(text, cursorPos) {
    const suggestions = [];

    // Get word at cursor
    const beforeCursor = text.substring(0, cursorPos);
    const wordMatch = beforeCursor.match(/[\w.]*$/);
    const currentWord = wordMatch ? wordMatch[0].toLowerCase() : '';

    if (currentWord.length < 1) return suggestions;

    // SQL/EOQL Keywords
    const keywords = this._language === 'eoql'
      ? ['FROM', 'SEG', 'CON', 'ALT', 'DES', 'SYN', 'SUP', 'NUL', 'AGG', 'NOW', 'CONFLICT', 'EXPOSE_ALL']
      : ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ON', 'AS', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT'];

    // Add matching keywords
    keywords.forEach(kw => {
      if (kw.toLowerCase().startsWith(currentWord)) {
        suggestions.push({ text: kw, type: 'keyword', icon: 'ph-hash' });
      }
    });

    // Add field names from source
    if (this._source) {
      this._source.schema.fields.forEach(f => {
        if (f.name.toLowerCase().startsWith(currentWord)) {
          suggestions.push({ text: f.name, type: 'field', icon: 'ph-columns' });
        }
      });
    }

    // Add joined source field names
    this._joins.forEach(join => {
      if (join.sourceId) {
        const source = this._availableSources.find(s => s.id === join.sourceId);
        if (source) {
          source.schema.fields.forEach(f => {
            const prefixed = `${join.alias}.${f.name}`;
            if (f.name.toLowerCase().startsWith(currentWord) || prefixed.toLowerCase().startsWith(currentWord)) {
              suggestions.push({ text: prefixed, type: 'field', icon: 'ph-intersect' });
            }
          });
        }
      }
    });

    // EO extensions
    const eoExt = ['AS OF NOW', 'AS SET', 'CONFLICT EXPOSE_ALL', 'CONFLICT PICK_FIRST'];
    eoExt.forEach(ext => {
      if (ext.toLowerCase().startsWith(currentWord)) {
        suggestions.push({ text: ext, type: 'eo', icon: 'ph-lightning' });
      }
    });

    return suggestions.slice(0, 10);
  }

  /**
   * Show autocomplete dropdown
   */
  _showAutocomplete(suggestions) {
    const dropdown = this.container?.querySelector('#qb-autocomplete');
    const editor = this.container?.querySelector('#qb-query-editor');
    if (!dropdown || !editor || suggestions.length === 0) {
      this._hideAutocomplete();
      return;
    }

    dropdown.innerHTML = suggestions.map((s, i) => `
      <div class="autocomplete-item ${i === 0 ? 'selected' : ''}" data-index="${i}">
        <i class="${s.icon} autocomplete-item-icon"></i>
        <span class="autocomplete-item-text">${this._escapeHtml(s.text)}</span>
        <span class="autocomplete-item-type">${s.type}</span>
      </div>
    `).join('');

    dropdown.style.display = 'block';
    this._autocompleteSuggestions = suggestions;
    this._autocompleteIndex = 0;

    // Attach click handlers
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        this._insertAutocomplete(parseInt(item.dataset.index));
      });
    });
  }

  /**
   * Hide autocomplete dropdown
   */
  _hideAutocomplete() {
    const dropdown = this.container?.querySelector('#qb-autocomplete');
    if (dropdown) {
      dropdown.style.display = 'none';
    }
    this._autocompleteSuggestions = null;
    this._autocompleteIndex = -1;
  }

  /**
   * Insert selected autocomplete suggestion
   */
  _insertAutocomplete(index) {
    if (!this._autocompleteSuggestions || index < 0) return;

    const suggestion = this._autocompleteSuggestions[index];
    if (!suggestion) return;

    const editor = this.container?.querySelector('#qb-query-editor');
    if (!editor) return;

    const cursorPos = editor.selectionStart;
    const text = editor.value;
    const beforeCursor = text.substring(0, cursorPos);
    const afterCursor = text.substring(cursorPos);

    // Find the word to replace
    const wordMatch = beforeCursor.match(/[\w.]*$/);
    const wordStart = cursorPos - (wordMatch ? wordMatch[0].length : 0);

    // Insert suggestion
    const newText = text.substring(0, wordStart) + suggestion.text + afterCursor;
    editor.value = newText;
    this._queryText = newText;

    // Set cursor after inserted text
    const newCursorPos = wordStart + suggestion.text.length;
    editor.setSelectionRange(newCursorPos, newCursorPos);
    editor.focus();

    this._hideAutocomplete();
    this._updateHighlight();
    this._parseQuery();
  }

  /**
   * Render the joins UI for wizard mode
   */
  _renderJoinsUI() {
    const hasAvailableSources = this._availableSources.length > 0;

    if (!hasAvailableSources) {
      return `<div class="join-empty">No other sources available to join</div>`;
    }

    return `
      <div class="joins-list">
        ${this._joins.map((join, i) => this._renderJoinRow(join, i)).join('')}
      </div>
      <button class="add-join-btn" id="qb-add-join">
        <i class="ph ph-plus"></i>
        Add Join
      </button>
    `;
  }

  /**
   * Render a single join row
   */
  _renderJoinRow(join, index) {
    const joinSource = this._availableSources.find(s => s.id === join.sourceId);
    const primaryFields = this._source.schema.fields.map(f => f.name);
    const joinFields = joinSource ? joinSource.schema.fields.map(f => f.name) : [];

    return `
      <div class="join-row" data-join-index="${index}">
        <div class="join-row-header">
          <div class="join-type-select">
            <select class="qb-select join-type" data-join-index="${index}">
              ${this._joinTypes.map(t => `
                <option value="${t}" ${join.type === t ? 'selected' : ''}>${t} JOIN</option>
              `).join('')}
            </select>
          </div>
          <div class="join-source-select">
            <select class="qb-select join-source" data-join-index="${index}">
              <option value="">Select source...</option>
              ${this._availableSources.map(s => `
                <option value="${s.id}" ${join.sourceId === s.id ? 'selected' : ''}>
                  ${this._escapeHtml(s.name)}
                </option>
              `).join('')}
            </select>
          </div>
          <button class="join-remove-btn" data-join-index="${index}">
            <i class="ph ph-x"></i>
          </button>
        </div>

        ${join.sourceId ? `
          <div class="join-conditions">
            ${join.conditions.map((cond, ci) => `
              <div class="join-condition" data-join-index="${index}" data-cond-index="${ci}">
                <select class="qb-select join-left-field" data-join-index="${index}" data-cond-index="${ci}">
                  ${primaryFields.map(f => `
                    <option value="${f}" ${cond.left === f ? 'selected' : ''}>${f}</option>
                  `).join('')}
                </select>
                <span class="join-equals">=</span>
                <select class="qb-select join-right-field" data-join-index="${index}" data-cond-index="${ci}">
                  ${joinFields.map(f => `
                    <option value="${f}" ${cond.right === f ? 'selected' : ''}>${f}</option>
                  `).join('')}
                </select>
                ${join.conditions.length > 1 ? `
                  <button class="join-cond-remove" data-join-index="${index}" data-cond-index="${ci}">
                    <i class="ph ph-x"></i>
                  </button>
                ` : ''}
              </div>
            `).join('')}
            <button class="add-condition-btn" data-join-index="${index}">
              <i class="ph ph-plus"></i> Add condition
            </button>
          </div>

          <div class="join-conflict">
            <label>Conflict policy:</label>
            <select class="qb-select join-conflict-policy" data-join-index="${index}">
              ${this._conflictPolicies.map(p => `
                <option value="${p}" ${join.conflict === p ? 'selected' : ''}>${p.replace('_', ' ')}</option>
              `).join('')}
            </select>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render column chips including joined source columns
   */
  _renderColumnChips() {
    // Group fields by source
    const primaryFields = this._selectedFields.filter(f => f.source === 'primary');
    const joinedFields = this._selectedFields.filter(f => f.source !== 'primary');

    let html = `
      <div class="column-group">
        <div class="column-group-label">${this._escapeHtml(this._source.name)}</div>
        <div class="column-group-chips">
          ${primaryFields.map((f, i) => `
            <span class="column-chip ${f.include ? 'selected' : ''}" data-index="${this._selectedFields.indexOf(f)}">
              <i class="ph ${f.include ? 'ph-check' : 'ph-plus'}"></i>
              ${this._escapeHtml(f.name)}
            </span>
          `).join('')}
        </div>
      </div>
    `;

    // Add joined source columns grouped by source
    const joinedSources = new Map();
    joinedFields.forEach(f => {
      if (!joinedSources.has(f.source)) {
        joinedSources.set(f.source, []);
      }
      joinedSources.get(f.source).push(f);
    });

    joinedSources.forEach((fields, sourceId) => {
      const source = this._availableSources.find(s => s.id === sourceId);
      const sourceName = source ? source.name : sourceId;
      html += `
        <div class="column-group joined">
          <div class="column-group-label"><i class="ph ph-intersect"></i> ${this._escapeHtml(sourceName)}</div>
          <div class="column-group-chips">
            ${fields.map(f => `
              <span class="column-chip ${f.include ? 'selected' : ''}" data-index="${this._selectedFields.indexOf(f)}">
                <i class="ph ${f.include ? 'ph-check' : 'ph-plus'}"></i>
                ${this._escapeHtml(f.name)}
              </span>
            `).join('')}
          </div>
        </div>
      `;
    });

    return html;
  }

  /**
   * Add a new join
   */
  _addJoin() {
    this._joins.push({
      sourceId: '',
      alias: `j${this._joins.length + 1}`,
      conditions: [{ left: '', right: '' }],
      type: 'LEFT',
      conflict: 'EXPOSE_ALL'
    });
    this._updateJoinsUI();
  }

  /**
   * Remove a join
   */
  _removeJoin(index) {
    const join = this._joins[index];
    if (join && join.sourceId) {
      // Remove fields from this join
      this._selectedFields = this._selectedFields.filter(f => f.source !== join.sourceId);
    }
    this._joins.splice(index, 1);
    this._updateJoinsUI();
    this._updateColumnChipsUI();
    this._onWizardChange();
  }

  /**
   * Update join source selection
   */
  _updateJoinSource(index, sourceId) {
    const join = this._joins[index];
    const oldSourceId = join.sourceId;

    // Remove old source fields
    if (oldSourceId) {
      this._selectedFields = this._selectedFields.filter(f => f.source !== oldSourceId);
    }

    join.sourceId = sourceId;

    // Add new source fields
    if (sourceId) {
      const source = this._availableSources.find(s => s.id === sourceId);
      if (source) {
        source.schema.fields.forEach(f => {
          this._selectedFields.push({
            name: f.name,
            type: f.type,
            rename: null,
            include: true,
            source: sourceId
          });
        });

        // Auto-populate first condition with first fields
        if (join.conditions.length > 0 && !join.conditions[0].left) {
          join.conditions[0].left = this._source.schema.fields[0]?.name || '';
          join.conditions[0].right = source.schema.fields[0]?.name || '';
        }
      }
    }

    this._updateJoinsUI();
    this._updateColumnChipsUI();
    this._onWizardChange();
  }

  /**
   * Update joins UI
   */
  _updateJoinsUI() {
    const container = this.container.querySelector('#qb-join-builder');
    if (container) {
      container.innerHTML = this._renderJoinsUI();
      this._attachJoinEventListeners();
    }
  }

  /**
   * Update column chips UI
   */
  _updateColumnChipsUI() {
    const container = this.container.querySelector('#qb-column-chips');
    if (container) {
      container.innerHTML = this._renderColumnChips();
      this._attachColumnChipListeners();
    }
  }

  _renderOperatorChain() {
    if (!this._parseResult || !this._parseResult.success || !this._parseResult.pipeline) {
      return '<div class="chain-empty">Build a query to see operator chain</div>';
    }

    const operators = this._parseResult.pipeline;
    const opIcons = {
      'INS': { icon: 'ph-plus-circle', color: 'given', symbol: '⊕' },
      'SEG': { icon: 'ph-funnel', color: 'seg', symbol: '⊘' },
      'CON': { icon: 'ph-intersect', color: 'con', symbol: '⊗' },
      'ALT': { icon: 'ph-clock', color: 'alt', symbol: 'Δ' },
      'DES': { icon: 'ph-tag', color: 'des', symbol: '⊙' },
      'SYN': { icon: 'ph-equals', color: 'syn', symbol: '≡' },
      'SUP': { icon: 'ph-stack', color: 'sup', symbol: '∥' },
      'NUL': { icon: 'ph-prohibit', color: 'nul', symbol: '∅' },
      'AGG': { icon: 'ph-chart-bar', color: 'agg', symbol: 'Σ' }
    };

    return `
      <div class="chain-label"><i class="ph ph-flow-arrow"></i> Operator Chain</div>
      <div class="chain-operators">
        ${operators.map((op, i) => {
          const config = opIcons[op.op] || { icon: 'ph-question', color: 'default', symbol: '?' };
          return `
            <div class="chain-op op-${config.color}" title="${op.op}">
              <span class="op-symbol">${config.symbol}</span>
              <span class="op-name">${op.op}</span>
            </div>
            ${i < operators.length - 1 ? '<span class="chain-arrow">→</span>' : ''}
          `;
        }).join('')}
      </div>
    `;
  }

  _renderValidation() {
    if (!this._parseResult) {
      return '<span class="validation-pending"><i class="ph ph-hourglass"></i> Enter a query</span>';
    }

    if (this._parseResult.success) {
      return `<span class="validation-success"><i class="ph ph-check-circle"></i> Valid ${this._language.toUpperCase()}</span>`;
    }

    return `<span class="validation-error"><i class="ph ph-warning-circle"></i> ${this._escapeHtml(this._parseResult.error)}</span>`;
  }

  _renderPreviewTable() {
    if (!this._previewData) {
      return '<div class="preview-empty">Run query to see preview</div>';
    }

    if (this._previewData.error) {
      return `<div class="preview-error">${this._escapeHtml(this._previewData.error)}</div>`;
    }

    const rows = this._previewData.rows || [];
    if (rows.length === 0) {
      return '<div class="preview-empty">No matching records</div>';
    }

    const fields = this._selectedFields.filter(f => f.include);
    const columns = fields.length > 0 ? fields.map(f => f.name) : Object.keys(rows[0]);

    return `
      <table class="preview-table">
        <thead>
          <tr>${columns.map(c => `<th>${this._escapeHtml(c)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.slice(0, 5).map(row => `
            <tr>${columns.map(c => `<td>${this._escapeHtml(String(row[c] ?? ''))}</td>`).join('')}</tr>
          `).join('')}
          ${this._previewData.totalCount > 5 ? `
            <tr><td colspan="${columns.length}" class="preview-more">... and ${this._previewData.totalCount - 5} more</td></tr>
          ` : ''}
        </tbody>
      </table>
    `;
  }

  _updateModeUI() {
    const body = this.container.querySelector('.qb-body');
    if (body) {
      body.innerHTML = this._mode === 'wizard' ? this._renderWizardMode() : this._renderQueryMode();
      this._attachModeEventListeners();
    }

    // Update tabs
    this.container.querySelectorAll('.qb-mode-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === this._mode);
    });
  }

  _updateLanguageUI() {
    const editor = this.container.querySelector('#qb-query-editor');
    if (editor) {
      editor.value = this._queryText;
    }

    this.container.querySelectorAll('.lang-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.lang === this._language);
    });

    this._updateValidationUI();
  }

  _updateValidationUI() {
    const validation = this.container.querySelector('#qb-validation');
    if (validation) {
      validation.innerHTML = this._renderValidation();
    }

    const chain = this.container.querySelector('#qb-operator-chain');
    if (chain) {
      chain.innerHTML = this._renderOperatorChain();
    }

    const createBtn = this.container.querySelector('#qb-create-btn');
    if (createBtn) {
      createBtn.disabled = !this._parseResult?.success;
    }
  }

  _updatePreviewUI() {
    const count = this.container.querySelector('#qb-preview-count');
    if (count && this._previewData) {
      count.textContent = this._previewData.error
        ? 'Error'
        : `${this._previewData.totalCount} records`;
    }

    const table = this.container.querySelector('#qb-preview-table');
    if (table) {
      table.innerHTML = this._renderPreviewTable();
    }
  }

  _attachEventListeners() {
    // Close button
    this.container.querySelector('#qb-close-btn')?.addEventListener('click', () => {
      if (this._onCancel) this._onCancel();
      this.hide();
    });

    // Cancel button
    this.container.querySelector('#qb-cancel-btn')?.addEventListener('click', () => {
      if (this._onCancel) this._onCancel();
      this.hide();
    });

    // Create button
    this.container.querySelector('#qb-create-btn')?.addEventListener('click', () => {
      this._createSet();
    });

    // Mode tabs
    this.container.querySelectorAll('.qb-mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.setMode(tab.dataset.mode);
      });
    });

    // Overlay click to close
    this.container.querySelector('.query-builder-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('query-builder-overlay')) {
        if (this._onCancel) this._onCancel();
        this.hide();
      }
    });

    this._attachModeEventListeners();
  }

  _attachModeEventListeners() {
    if (this._mode === 'wizard') {
      // Set name input
      const nameInput = this.container.querySelector('#qb-set-name');
      if (nameInput) {
        nameInput.addEventListener('input', (e) => {
          this._setName = e.target.value;
          this._onWizardChange();
        });
      }

      // Join builder
      this._attachJoinEventListeners();

      // Filter builder
      const filterContainer = this.container.querySelector('#qb-filter-builder');
      if (filterContainer && this._filterBuilder) {
        this._filterBuilder.render(filterContainer);
      }

      // Column chips
      this._attachColumnChipListeners();
    } else {
      // Language tabs
      this.container.querySelectorAll('.lang-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          this.setLanguage(tab.dataset.lang);
        });
      });

      // Query editor
      const editor = this.container.querySelector('#qb-query-editor');
      if (editor) {
        // Initial highlight
        this._updateHighlight();

        editor.addEventListener('input', (e) => {
          this._queryText = e.target.value;
          this._updateHighlight();

          // Show autocomplete suggestions
          const suggestions = this._getAutocompleteSuggestions(e.target.value, e.target.selectionStart);
          if (suggestions.length > 0) {
            this._showAutocomplete(suggestions);
          } else {
            this._hideAutocomplete();
          }

          // Debounce parsing
          if (this._parseDebounce) clearTimeout(this._parseDebounce);
          this._parseDebounce = setTimeout(() => {
            this._parseQuery();
          }, 500);
        });

        // Sync scroll between editor and highlight
        editor.addEventListener('scroll', () => {
          this._updateHighlight();
        });

        // Keyboard navigation
        editor.addEventListener('keydown', (e) => {
          // Ctrl+Enter to run
          if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            this._parseQuery();
            return;
          }

          // Tab for autocomplete
          if (e.key === 'Tab' && this._autocompleteSuggestions?.length > 0) {
            e.preventDefault();
            this._insertAutocomplete(this._autocompleteIndex);
            return;
          }

          // Arrow keys for autocomplete navigation
          if (this._autocompleteSuggestions?.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              this._autocompleteIndex = Math.min(this._autocompleteIndex + 1, this._autocompleteSuggestions.length - 1);
              this._updateAutocompleteSelection();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              this._autocompleteIndex = Math.max(this._autocompleteIndex - 1, 0);
              this._updateAutocompleteSelection();
            } else if (e.key === 'Enter' && this._autocompleteIndex >= 0) {
              e.preventDefault();
              this._insertAutocomplete(this._autocompleteIndex);
            } else if (e.key === 'Escape') {
              this._hideAutocomplete();
            }
          }
        });

        // Hide autocomplete on blur
        editor.addEventListener('blur', () => {
          setTimeout(() => this._hideAutocomplete(), 150);
        });
      }

      // Run button
      this.container.querySelector('#qb-run-query')?.addEventListener('click', () => {
        this._parseQuery();
      });
    }
  }

  /**
   * Update autocomplete selection highlight
   */
  _updateAutocompleteSelection() {
    const dropdown = this.container?.querySelector('#qb-autocomplete');
    if (!dropdown) return;

    dropdown.querySelectorAll('.autocomplete-item').forEach((item, i) => {
      item.classList.toggle('selected', i === this._autocompleteIndex);
    });
  }

  /**
   * Attach event listeners for join UI
   */
  _attachJoinEventListeners() {
    // Add join button
    this.container.querySelector('#qb-add-join')?.addEventListener('click', () => {
      this._addJoin();
    });

    // Join source selection
    this.container.querySelectorAll('.join-source').forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.joinIndex);
        this._updateJoinSource(index, e.target.value);
      });
    });

    // Join type selection
    this.container.querySelectorAll('.join-type').forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.joinIndex);
        this._joins[index].type = e.target.value;
        this._onWizardChange();
      });
    });

    // Remove join buttons
    this.container.querySelectorAll('.join-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.closest('.join-remove-btn').dataset.joinIndex);
        this._removeJoin(index);
      });
    });

    // Left field selection
    this.container.querySelectorAll('.join-left-field').forEach(select => {
      select.addEventListener('change', (e) => {
        const joinIndex = parseInt(e.target.dataset.joinIndex);
        const condIndex = parseInt(e.target.dataset.condIndex);
        this._joins[joinIndex].conditions[condIndex].left = e.target.value;
        this._onWizardChange();
      });
    });

    // Right field selection
    this.container.querySelectorAll('.join-right-field').forEach(select => {
      select.addEventListener('change', (e) => {
        const joinIndex = parseInt(e.target.dataset.joinIndex);
        const condIndex = parseInt(e.target.dataset.condIndex);
        this._joins[joinIndex].conditions[condIndex].right = e.target.value;
        this._onWizardChange();
      });
    });

    // Conflict policy selection
    this.container.querySelectorAll('.join-conflict-policy').forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.joinIndex);
        this._joins[index].conflict = e.target.value;
        this._onWizardChange();
      });
    });

    // Add condition buttons
    this.container.querySelectorAll('.add-condition-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.joinIndex);
        this._joins[index].conditions.push({ left: '', right: '' });
        this._updateJoinsUI();
        this._onWizardChange();
      });
    });

    // Remove condition buttons
    this.container.querySelectorAll('.join-cond-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const joinIndex = parseInt(e.target.closest('.join-cond-remove').dataset.joinIndex);
        const condIndex = parseInt(e.target.closest('.join-cond-remove').dataset.condIndex);
        this._joins[joinIndex].conditions.splice(condIndex, 1);
        this._updateJoinsUI();
        this._onWizardChange();
      });
    });
  }

  /**
   * Attach event listeners for column chips
   */
  _attachColumnChipListeners() {
    this.container.querySelectorAll('.column-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const index = parseInt(chip.dataset.index);
        this._selectedFields[index].include = !this._selectedFields[index].include;
        chip.classList.toggle('selected');
        chip.querySelector('i').className = this._selectedFields[index].include ? 'ph ph-check' : 'ph ph-plus';
        this._onWizardChange();
      });
    });
  }

  _escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
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
// SetJoinFilterCreator - Unified no-code interface for creating sets
// ============================================================================

/**
 * SetJoinFilterCreator - Visual wizard for creating sets from multiple sources/sets
 *
 * Features:
 * - Multi-select sources AND existing sets
 * - Visual join configuration (field mapping, join type)
 * - Advanced filter builder integration
 * - Live preview with record counts
 * - No-code, point-and-click experience
 */
class SetJoinFilterCreator {
  constructor(options = {}) {
    this.sourceStore = options.sourceStore;
    this.sets = options.sets || [];
    this.container = null;
    this._onComplete = null;
    this._onCancel = null;

    // State
    this._step = 1; // 1: Select, 2: Join, 3: Filter, 4: Review
    this._setName = '';
    this._selectedItems = []; // Array of { type: 'source'|'set', id, name, fields, records }
    this._joinConfig = {
      type: 'left', // 'inner', 'left', 'right', 'full', 'union'
      conditions: [] // Array of { leftItemIndex, leftField, rightItemIndex, rightField, operator }
    };
    this._filterBuilder = null;
    this._previewData = null;
    this._searchQuery = '';
  }

  /**
   * Show the creator wizard
   */
  show(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    this._onComplete = options.onComplete;
    this._onCancel = options.onCancel;
    this._step = 1;
    this._setName = '';
    this._selectedItems = [];
    this._joinConfig = { type: 'left', conditions: [] };
    this._filterBuilder = null;
    this._previewData = null;
    this._searchQuery = '';

    this._render();
    this._attachEventListeners();
  }

  hide() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
    }
  }

  /**
   * Get all available items (sources + sets)
   */
  _getAvailableItems() {
    const items = [];

    // Add sources
    if (this.sourceStore) {
      const sources = this.sourceStore.getAll();
      for (const source of sources) {
        items.push({
          type: 'source',
          id: source.id,
          name: source.name,
          recordCount: source.recordCount || source.records?.length || 0,
          fields: source.schema?.fields || [],
          icon: this._getSourceIcon(source),
          records: source.records || []
        });
      }
    }

    // Add existing sets
    for (const set of this.sets) {
      items.push({
        type: 'set',
        id: set.id,
        name: set.name,
        recordCount: set.records?.length || 0,
        fields: set.fields || [],
        icon: 'ph-table',
        records: set.records || []
      });
    }

    return items;
  }

  _getSourceIcon(source) {
    const type = source.fileIdentity?.mimeType || '';
    if (type.includes('json')) return 'ph-brackets-curly';
    if (type.includes('csv') || type.includes('excel') || type.includes('spreadsheet')) return 'ph-file-xls';
    return 'ph-file';
  }

  _render() {
    this.container.style.display = 'block';
    this.container.innerHTML = `
      <div class="sjf-overlay">
        <div class="sjf-modal">
          <div class="sjf-header">
            <h2><i class="ph ph-plus-circle"></i> Create New Set</h2>
            <button class="sjf-close-btn" id="sjf-close-btn">
              <i class="ph ph-x"></i>
            </button>
          </div>

          <div class="sjf-steps">
            ${this._renderStepIndicators()}
          </div>

          <div class="sjf-body">
            ${this._renderCurrentStep()}
          </div>

          <div class="sjf-footer">
            ${this._renderFooterButtons()}
          </div>
        </div>
      </div>
    `;
  }

  _renderStepIndicators() {
    const steps = [
      { num: 1, label: 'Select Data', icon: 'ph-list-checks' },
      { num: 2, label: 'Join', icon: 'ph-intersect' },
      { num: 3, label: 'Filter', icon: 'ph-funnel' },
      { num: 4, label: 'Review', icon: 'ph-eye' }
    ];

    return `
      <div class="sjf-step-indicators">
        ${steps.map(step => `
          <div class="sjf-step-indicator ${this._step === step.num ? 'active' : ''} ${this._step > step.num ? 'completed' : ''}" data-step="${step.num}">
            <div class="sjf-step-icon">
              <i class="ph ${step.icon}"></i>
            </div>
            <span class="sjf-step-label">${step.label}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  _renderCurrentStep() {
    switch (this._step) {
      case 1: return this._renderSelectStep();
      case 2: return this._renderJoinStep();
      case 3: return this._renderFilterStep();
      case 4: return this._renderReviewStep();
      default: return '';
    }
  }

  _renderSelectStep() {
    const items = this._getAvailableItems();
    const filteredItems = this._searchQuery
      ? items.filter(item => item.name.toLowerCase().includes(this._searchQuery.toLowerCase()))
      : items;

    const sources = filteredItems.filter(i => i.type === 'source');
    const sets = filteredItems.filter(i => i.type === 'set');

    return `
      <div class="sjf-select-step">
        <div class="sjf-name-input">
          <label>Set Name</label>
          <input type="text" id="sjf-set-name" placeholder="My New Set" value="${this._escapeHtml(this._setName)}">
        </div>

        <div class="sjf-select-header">
          <h3><i class="ph ph-database"></i> Select Data Sources</h3>
          <p class="sjf-hint">Select one or more sources/sets to combine into your new set</p>
        </div>

        <div class="sjf-search-bar">
          <i class="ph ph-magnifying-glass"></i>
          <input type="text" id="sjf-search" placeholder="Search sources and sets..." value="${this._escapeHtml(this._searchQuery)}">
        </div>

        <div class="sjf-select-actions">
          <span class="sjf-selected-count">${this._selectedItems.length} selected</span>
          <button class="sjf-action-btn" id="sjf-clear-selection">Clear All</button>
        </div>

        <div class="sjf-items-list" id="sjf-items-list">
          ${sources.length > 0 ? `
            <div class="sjf-items-group">
              <div class="sjf-group-header">
                <i class="ph ph-file"></i> Sources (${sources.length})
              </div>
              ${sources.map(item => this._renderSelectItem(item)).join('')}
            </div>
          ` : ''}

          ${sets.length > 0 ? `
            <div class="sjf-items-group">
              <div class="sjf-group-header">
                <i class="ph ph-table"></i> Sets (${sets.length})
              </div>
              ${sets.map(item => this._renderSelectItem(item)).join('')}
            </div>
          ` : ''}

          ${filteredItems.length === 0 ? `
            <div class="sjf-empty-state">
              <i class="ph ph-file-dashed"></i>
              <p>No data sources found</p>
              <span>Import data first to create sets</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  _renderSelectItem(item) {
    const isSelected = this._selectedItems.some(s => s.type === item.type && s.id === item.id);
    const selectionOrder = this._selectedItems.findIndex(s => s.type === item.type && s.id === item.id) + 1;

    return `
      <div class="sjf-select-item ${isSelected ? 'selected' : ''}"
           data-type="${item.type}"
           data-id="${item.id}">
        <div class="sjf-item-checkbox">
          ${isSelected ? `<span class="sjf-order-badge">${selectionOrder}</span>` : '<i class="ph ph-square"></i>'}
        </div>
        <div class="sjf-item-icon">
          <i class="ph ${item.icon}"></i>
        </div>
        <div class="sjf-item-info">
          <span class="sjf-item-name">${this._escapeHtml(item.name)}</span>
          <span class="sjf-item-meta">${item.recordCount} records • ${item.fields.length} fields</span>
        </div>
        <div class="sjf-item-badge ${item.type}">${item.type}</div>
      </div>
    `;
  }

  _renderJoinStep() {
    if (this._selectedItems.length < 2) {
      return `
        <div class="sjf-join-single">
          <div class="sjf-info-card">
            <i class="ph ph-info"></i>
            <div>
              <strong>Single source selected</strong>
              <p>Joins require 2 or more sources. With a single source, you can proceed directly to filtering.</p>
            </div>
          </div>
          <div class="sjf-selected-preview">
            <h4>Selected: ${this._selectedItems[0]?.name || 'None'}</h4>
            <p>${this._selectedItems[0]?.recordCount || 0} records</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="sjf-join-step">
        <div class="sjf-join-header">
          <h3><i class="ph ph-intersect"></i> Configure Join</h3>
          <p class="sjf-hint">Define how to combine your selected data sources</p>
        </div>

        <div class="sjf-join-type-section">
          <label>Join Type</label>
          <div class="sjf-join-types">
            ${this._renderJoinTypeOption('left', 'Left Join', 'All from first + matches', 'ph-align-left')}
            ${this._renderJoinTypeOption('inner', 'Inner Join', 'Only matching records', 'ph-intersect')}
            ${this._renderJoinTypeOption('right', 'Right Join', 'All from second + matches', 'ph-align-right')}
            ${this._renderJoinTypeOption('full', 'Full Join', 'All records from both', 'ph-arrows-out-line-horizontal')}
            ${this._renderJoinTypeOption('union', 'Union', 'Stack all records', 'ph-stack')}
          </div>
        </div>

        ${this._joinConfig.type !== 'union' ? `
          <div class="sjf-join-conditions">
            <label>Join Conditions</label>
            <p class="sjf-hint">Map fields between sources to define the join</p>

            <div class="sjf-conditions-list" id="sjf-conditions-list">
              ${this._joinConfig.conditions.length === 0 ? `
                <div class="sjf-empty-conditions">
                  <i class="ph ph-link"></i>
                  <p>No join conditions defined</p>
                  <span>Add a condition to link records between sources</span>
                </div>
              ` : this._joinConfig.conditions.map((cond, i) => this._renderJoinCondition(cond, i)).join('')}
            </div>

            <button class="sjf-add-condition-btn" id="sjf-add-condition">
              <i class="ph ph-plus"></i> Add Join Condition
            </button>
          </div>
        ` : `
          <div class="sjf-union-info">
            <div class="sjf-info-card">
              <i class="ph ph-stack"></i>
              <div>
                <strong>Union Mode</strong>
                <p>Records from all sources will be stacked together. Fields with the same name will be combined.</p>
              </div>
            </div>
          </div>
        `}

        <div class="sjf-join-preview">
          <h4>Selected Sources</h4>
          <div class="sjf-sources-visual">
            ${this._selectedItems.map((item, i) => `
              <div class="sjf-source-card" data-index="${i}">
                <div class="sjf-source-letter">${String.fromCharCode(65 + i)}</div>
                <div class="sjf-source-info">
                  <span class="sjf-source-name">${this._escapeHtml(item.name)}</span>
                  <span class="sjf-source-count">${item.recordCount} records</span>
                </div>
              </div>
            `).join('<i class="ph ph-link-simple sjf-link-icon"></i>')}
          </div>
        </div>
      </div>
    `;
  }

  _renderJoinTypeOption(value, label, desc, icon) {
    const isSelected = this._joinConfig.type === value;
    return `
      <button class="sjf-join-type-btn ${isSelected ? 'active' : ''}" data-type="${value}">
        <i class="ph ${icon}"></i>
        <span class="sjf-jt-label">${label}</span>
        <span class="sjf-jt-desc">${desc}</span>
      </button>
    `;
  }

  _renderJoinCondition(condition, index) {
    const leftItem = this._selectedItems[condition.leftItemIndex || 0];
    const rightItem = this._selectedItems[condition.rightItemIndex || 1];

    return `
      <div class="sjf-join-condition" data-index="${index}">
        <div class="sjf-condition-row">
          <div class="sjf-condition-side left">
            <select class="sjf-source-select" data-side="left">
              ${this._selectedItems.map((item, i) => `
                <option value="${i}" ${condition.leftItemIndex === i ? 'selected' : ''}>
                  ${String.fromCharCode(65 + i)}: ${this._escapeHtml(item.name)}
                </option>
              `).join('')}
            </select>
            <select class="sjf-field-select" data-side="left">
              <option value="">Select field...</option>
              ${(leftItem?.fields || []).map(f => `
                <option value="${f.name}" ${condition.leftField === f.name ? 'selected' : ''}>
                  ${this._escapeHtml(f.name)}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="sjf-condition-operator">
            <select class="sjf-operator-select">
              <option value="eq" ${condition.operator === 'eq' ? 'selected' : ''}>=</option>
              <option value="contains" ${condition.operator === 'contains' ? 'selected' : ''}>contains</option>
              <option value="starts" ${condition.operator === 'starts' ? 'selected' : ''}>starts with</option>
              <option value="ends" ${condition.operator === 'ends' ? 'selected' : ''}>ends with</option>
            </select>
          </div>

          <div class="sjf-condition-side right">
            <select class="sjf-source-select" data-side="right">
              ${this._selectedItems.map((item, i) => `
                <option value="${i}" ${condition.rightItemIndex === i ? 'selected' : ''}>
                  ${String.fromCharCode(65 + i)}: ${this._escapeHtml(item.name)}
                </option>
              `).join('')}
            </select>
            <select class="sjf-field-select" data-side="right">
              <option value="">Select field...</option>
              ${(rightItem?.fields || []).map(f => `
                <option value="${f.name}" ${condition.rightField === f.name ? 'selected' : ''}>
                  ${this._escapeHtml(f.name)}
                </option>
              `).join('')}
            </select>
          </div>

          <button class="sjf-remove-condition" data-index="${index}">
            <i class="ph ph-x"></i>
          </button>
        </div>
      </div>
    `;
  }

  _renderFilterStep() {
    // Initialize filter builder if needed
    if (!this._filterBuilder && this._selectedItems.length > 0) {
      // Create a combined source for filtering
      const combinedSource = this._getCombinedSource();
      this._filterBuilder = new AdvancedFilterBuilder({
        source: combinedSource,
        provenanceEnabled: false,
        onChange: () => this._updatePreview()
      });
    }

    return `
      <div class="sjf-filter-step">
        <div class="sjf-filter-header">
          <h3><i class="ph ph-funnel"></i> Filter Records</h3>
          <p class="sjf-hint">Add conditions to filter the combined data (optional)</p>
          <div class="sjf-filter-count" id="sjf-filter-count">
            ${this._getFilteredCount()} records match
          </div>
        </div>

        <div id="sjf-filter-builder"></div>

        <div class="sjf-filter-preview">
          <button class="sjf-preview-btn" id="sjf-preview-filter">
            <i class="ph ph-eye"></i> Preview Filtered Data
          </button>
          <div class="sjf-preview-results" id="sjf-preview-results"></div>
        </div>
      </div>
    `;
  }

  _renderReviewStep() {
    const combinedCount = this._getFilteredCount();
    const fieldCount = this._getCombinedFields().length;

    return `
      <div class="sjf-review-step">
        <div class="sjf-review-header">
          <h3><i class="ph ph-eye"></i> Review & Create</h3>
          <p class="sjf-hint">Review your configuration before creating the set</p>
        </div>

        <div class="sjf-review-summary">
          <div class="sjf-summary-card">
            <div class="sjf-summary-icon">
              <i class="ph ph-textbox"></i>
            </div>
            <div class="sjf-summary-content">
              <label>Set Name</label>
              <span class="sjf-summary-value">${this._escapeHtml(this._setName || 'Untitled Set')}</span>
            </div>
          </div>

          <div class="sjf-summary-card">
            <div class="sjf-summary-icon">
              <i class="ph ph-database"></i>
            </div>
            <div class="sjf-summary-content">
              <label>Sources</label>
              <span class="sjf-summary-value">${this._selectedItems.length} selected</span>
              <div class="sjf-summary-list">
                ${this._selectedItems.map(item => `
                  <span class="sjf-summary-item">${this._escapeHtml(item.name)}</span>
                `).join('')}
              </div>
            </div>
          </div>

          ${this._selectedItems.length > 1 ? `
            <div class="sjf-summary-card">
              <div class="sjf-summary-icon">
                <i class="ph ph-intersect"></i>
              </div>
              <div class="sjf-summary-content">
                <label>Join Type</label>
                <span class="sjf-summary-value">${this._joinConfig.type.toUpperCase()}</span>
                ${this._joinConfig.conditions.length > 0 ? `
                  <span class="sjf-summary-detail">${this._joinConfig.conditions.length} condition(s)</span>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <div class="sjf-summary-card">
            <div class="sjf-summary-icon">
              <i class="ph ph-funnel"></i>
            </div>
            <div class="sjf-summary-content">
              <label>Filters</label>
              <span class="sjf-summary-value">${this._getFilterConditionCount()} condition(s)</span>
            </div>
          </div>

          <div class="sjf-summary-card highlight">
            <div class="sjf-summary-icon">
              <i class="ph ph-table"></i>
            </div>
            <div class="sjf-summary-content">
              <label>Result</label>
              <span class="sjf-summary-value">${combinedCount} records</span>
              <span class="sjf-summary-detail">${fieldCount} fields</span>
            </div>
          </div>
        </div>

        <div class="sjf-review-preview">
          <h4>Data Preview</h4>
          <div class="sjf-final-preview" id="sjf-final-preview">
            ${this._renderDataPreview()}
          </div>
        </div>
      </div>
    `;
  }

  _renderDataPreview() {
    const records = this._getFilteredRecords();
    const fields = this._getCombinedFields();
    const displayFields = fields.slice(0, 6);
    const displayRecords = records.slice(0, 5);

    if (displayRecords.length === 0) {
      return `
        <div class="sjf-preview-empty">
          <i class="ph ph-empty"></i>
          <p>No records to preview</p>
        </div>
      `;
    }

    return `
      <div class="sjf-preview-table-wrap">
        <table class="sjf-preview-table">
          <thead>
            <tr>
              ${displayFields.map(f => `<th>${this._escapeHtml(f.name)}</th>`).join('')}
              ${fields.length > 6 ? `<th class="more">+${fields.length - 6} more</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${displayRecords.map(record => `
              <tr>
                ${displayFields.map(f => {
                  const val = record[f.id] ?? record[f.name] ?? '';
                  return `<td>${this._escapeHtml(String(val).substring(0, 50))}</td>`;
                }).join('')}
                ${fields.length > 6 ? '<td class="more">...</td>' : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${records.length > 5 ? `
        <div class="sjf-preview-more">Showing 5 of ${records.length} records</div>
      ` : ''}
    `;
  }

  _renderFooterButtons() {
    const canProceed = this._canProceedToNextStep();

    return `
      <div class="sjf-footer-left">
        ${this._step > 1 ? `
          <button class="sjf-btn secondary" id="sjf-back-btn">
            <i class="ph ph-arrow-left"></i> Back
          </button>
        ` : ''}
      </div>
      <div class="sjf-footer-right">
        <button class="sjf-btn secondary" id="sjf-cancel-btn">Cancel</button>
        ${this._step < 4 ? `
          <button class="sjf-btn primary" id="sjf-next-btn" ${!canProceed ? 'disabled' : ''}>
            ${this._step === 1 && this._selectedItems.length === 1 ? 'Skip Join' : 'Next'}
            <i class="ph ph-arrow-right"></i>
          </button>
        ` : `
          <button class="sjf-btn success" id="sjf-create-btn">
            <i class="ph ph-plus-circle"></i> Create Set
          </button>
        `}
      </div>
    `;
  }

  _canProceedToNextStep() {
    switch (this._step) {
      case 1: return this._selectedItems.length > 0;
      case 2: return true; // Join is optional
      case 3: return true; // Filter is optional
      case 4: return true;
      default: return false;
    }
  }

  _attachEventListeners() {
    // Close button
    this.container.querySelector('#sjf-close-btn')?.addEventListener('click', () => {
      this.hide();
      this._onCancel?.();
    });

    // Cancel button
    this.container.querySelector('#sjf-cancel-btn')?.addEventListener('click', () => {
      this.hide();
      this._onCancel?.();
    });

    // Overlay click to close
    this.container.querySelector('.sjf-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('sjf-overlay')) {
        this.hide();
        this._onCancel?.();
      }
    });

    // Navigation buttons
    this.container.querySelector('#sjf-back-btn')?.addEventListener('click', () => {
      this._step = Math.max(1, this._step - 1);
      this._render();
      this._attachEventListeners();
    });

    this.container.querySelector('#sjf-next-btn')?.addEventListener('click', () => {
      // Skip join step if only one source
      if (this._step === 1 && this._selectedItems.length === 1) {
        this._step = 3;
      } else {
        this._step = Math.min(4, this._step + 1);
      }
      this._render();
      this._attachEventListeners();
      this._attachStepSpecificListeners();
    });

    this.container.querySelector('#sjf-create-btn')?.addEventListener('click', () => {
      this._createSet();
    });

    this._attachStepSpecificListeners();
  }

  _attachStepSpecificListeners() {
    switch (this._step) {
      case 1:
        this._attachSelectStepListeners();
        break;
      case 2:
        this._attachJoinStepListeners();
        break;
      case 3:
        this._attachFilterStepListeners();
        break;
    }
  }

  _attachSelectStepListeners() {
    // Set name input
    const nameInput = this.container.querySelector('#sjf-set-name');
    nameInput?.addEventListener('input', (e) => {
      this._setName = e.target.value;
    });

    // Search input
    const searchInput = this.container.querySelector('#sjf-search');
    searchInput?.addEventListener('input', (e) => {
      this._searchQuery = e.target.value;
      this._renderItemsList();
    });

    // Clear selection
    this.container.querySelector('#sjf-clear-selection')?.addEventListener('click', () => {
      this._selectedItems = [];
      this._renderItemsList();
      this._updateSelectedCount();
      this._updateFooterButtons();
    });

    // Item selection
    this._attachItemSelectionListeners();
  }

  _attachItemSelectionListeners() {
    this.container.querySelectorAll('.sjf-select-item').forEach(item => {
      item.addEventListener('click', () => {
        const type = item.dataset.type;
        const id = item.dataset.id;

        const existingIndex = this._selectedItems.findIndex(s => s.type === type && s.id === id);

        if (existingIndex >= 0) {
          // Deselect
          this._selectedItems.splice(existingIndex, 1);
        } else {
          // Select
          const allItems = this._getAvailableItems();
          const selectedItem = allItems.find(i => i.type === type && i.id === id);
          if (selectedItem) {
            this._selectedItems.push(selectedItem);
          }
        }

        this._renderItemsList();
        this._updateSelectedCount();
        this._updateFooterButtons();
      });
    });
  }

  _renderItemsList() {
    const listEl = this.container.querySelector('#sjf-items-list');
    if (!listEl) return;

    const items = this._getAvailableItems();
    const filteredItems = this._searchQuery
      ? items.filter(item => item.name.toLowerCase().includes(this._searchQuery.toLowerCase()))
      : items;

    const sources = filteredItems.filter(i => i.type === 'source');
    const sets = filteredItems.filter(i => i.type === 'set');

    listEl.innerHTML = `
      ${sources.length > 0 ? `
        <div class="sjf-items-group">
          <div class="sjf-group-header">
            <i class="ph ph-file"></i> Sources (${sources.length})
          </div>
          ${sources.map(item => this._renderSelectItem(item)).join('')}
        </div>
      ` : ''}

      ${sets.length > 0 ? `
        <div class="sjf-items-group">
          <div class="sjf-group-header">
            <i class="ph ph-table"></i> Sets (${sets.length})
          </div>
          ${sets.map(item => this._renderSelectItem(item)).join('')}
        </div>
      ` : ''}

      ${filteredItems.length === 0 ? `
        <div class="sjf-empty-state">
          <i class="ph ph-file-dashed"></i>
          <p>No data sources found</p>
        </div>
      ` : ''}
    `;

    this._attachItemSelectionListeners();
  }

  _updateSelectedCount() {
    const countEl = this.container.querySelector('.sjf-selected-count');
    if (countEl) {
      countEl.textContent = `${this._selectedItems.length} selected`;
    }
  }

  _updateFooterButtons() {
    const nextBtn = this.container.querySelector('#sjf-next-btn');
    if (nextBtn) {
      nextBtn.disabled = !this._canProceedToNextStep();
      if (this._step === 1 && this._selectedItems.length === 1) {
        nextBtn.innerHTML = 'Skip Join <i class="ph ph-arrow-right"></i>';
      }
    }
  }

  _attachJoinStepListeners() {
    // Join type buttons
    this.container.querySelectorAll('.sjf-join-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._joinConfig.type = btn.dataset.type;
        this._render();
        this._attachEventListeners();
      });
    });

    // Add condition button
    this.container.querySelector('#sjf-add-condition')?.addEventListener('click', () => {
      this._joinConfig.conditions.push({
        leftItemIndex: 0,
        leftField: '',
        rightItemIndex: 1,
        rightField: '',
        operator: 'eq'
      });
      this._renderConditionsList();
    });

    // Condition changes
    this._attachConditionListeners();
  }

  _attachConditionListeners() {
    this.container.querySelectorAll('.sjf-join-condition').forEach(condEl => {
      const index = parseInt(condEl.dataset.index);
      const condition = this._joinConfig.conditions[index];
      if (!condition) return;

      // Source selects
      condEl.querySelectorAll('.sjf-source-select').forEach(select => {
        select.addEventListener('change', (e) => {
          const side = select.dataset.side;
          const itemIndex = parseInt(e.target.value);

          if (side === 'left') {
            condition.leftItemIndex = itemIndex;
            condition.leftField = '';
          } else {
            condition.rightItemIndex = itemIndex;
            condition.rightField = '';
          }
          this._renderConditionsList();
        });
      });

      // Field selects
      condEl.querySelectorAll('.sjf-field-select').forEach(select => {
        select.addEventListener('change', (e) => {
          const side = select.dataset.side;
          if (side === 'left') {
            condition.leftField = e.target.value;
          } else {
            condition.rightField = e.target.value;
          }
        });
      });

      // Operator select
      condEl.querySelector('.sjf-operator-select')?.addEventListener('change', (e) => {
        condition.operator = e.target.value;
      });

      // Remove button
      condEl.querySelector('.sjf-remove-condition')?.addEventListener('click', () => {
        this._joinConfig.conditions.splice(index, 1);
        this._renderConditionsList();
      });
    });
  }

  _renderConditionsList() {
    const listEl = this.container.querySelector('#sjf-conditions-list');
    if (!listEl) return;

    if (this._joinConfig.conditions.length === 0) {
      listEl.innerHTML = `
        <div class="sjf-empty-conditions">
          <i class="ph ph-link"></i>
          <p>No join conditions defined</p>
          <span>Add a condition to link records between sources</span>
        </div>
      `;
    } else {
      listEl.innerHTML = this._joinConfig.conditions.map((cond, i) =>
        this._renderJoinCondition(cond, i)
      ).join('');
    }

    this._attachConditionListeners();
  }

  _attachFilterStepListeners() {
    // Render filter builder
    const filterContainer = this.container.querySelector('#sjf-filter-builder');
    if (filterContainer && this._filterBuilder) {
      this._filterBuilder.render(filterContainer);
    }

    // Preview button
    this.container.querySelector('#sjf-preview-filter')?.addEventListener('click', () => {
      this._showFilterPreview();
    });
  }

  _showFilterPreview() {
    const resultsEl = this.container.querySelector('#sjf-preview-results');
    if (!resultsEl) return;

    const records = this._getFilteredRecords();
    const fields = this._getCombinedFields().slice(0, 5);

    resultsEl.innerHTML = `
      <div class="sjf-preview-stats">
        <span><strong>${records.length}</strong> records match</span>
      </div>
      <div class="sjf-preview-table-wrap">
        <table class="sjf-preview-table">
          <thead>
            <tr>
              ${fields.map(f => `<th>${this._escapeHtml(f.name)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${records.slice(0, 10).map(record => `
              <tr>
                ${fields.map(f => {
                  const val = record.values?.[f.name] ?? record[f.name] ?? '';
                  return `<td>${this._escapeHtml(String(val).substring(0, 40))}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${records.length > 10 ? `
        <div class="sjf-preview-more">Showing 10 of ${records.length} records</div>
      ` : ''}
    `;
  }

  _getCombinedSource() {
    // Create a virtual source from selected items for filter builder
    const fields = this._getCombinedFields();
    const records = this._getJoinedRecords();

    return {
      id: 'combined',
      name: 'Combined Data',
      recordCount: records.length,
      records: records,
      schema: { fields }
    };
  }

  _getCombinedFields() {
    const fieldMap = new Map();

    for (const item of this._selectedItems) {
      for (const field of item.fields || []) {
        if (!fieldMap.has(field.name)) {
          fieldMap.set(field.name, { ...field });
        }
      }
    }

    return Array.from(fieldMap.values());
  }

  _getJoinedRecords() {
    if (this._selectedItems.length === 0) return [];
    if (this._selectedItems.length === 1) {
      return this._selectedItems[0].records.map(r => r.values || r);
    }

    // Multi-source join
    const joinType = this._joinConfig.type;

    if (joinType === 'union') {
      // Union: stack all records
      return this._selectedItems.flatMap(item =>
        item.records.map(r => r.values || r)
      );
    }

    // For joins, use the JoinBuilder approach
    const leftRecords = this._selectedItems[0].records.map(r => r.values || r);
    let result = [...leftRecords];

    for (let i = 1; i < this._selectedItems.length; i++) {
      const rightRecords = this._selectedItems[i].records.map(r => r.values || r);
      result = this._executeJoin(result, rightRecords, i);
    }

    return result;
  }

  _executeJoin(leftRecords, rightRecords, rightIndex) {
    const joinType = this._joinConfig.type;
    const conditions = this._joinConfig.conditions.filter(c =>
      c.rightItemIndex === rightIndex && c.leftField && c.rightField
    );

    if (conditions.length === 0) {
      // No conditions: cross join (limited)
      if (joinType === 'inner') return [];
      return leftRecords;
    }

    const result = [];
    const matchedRight = new Set();

    for (const leftRec of leftRecords) {
      let hasMatch = false;

      for (let ri = 0; ri < rightRecords.length; ri++) {
        const rightRec = rightRecords[ri];

        // Check all conditions
        const matches = conditions.every(cond => {
          const leftVal = leftRec[cond.leftField];
          const rightVal = rightRec[cond.rightField];

          switch (cond.operator) {
            case 'eq': return leftVal === rightVal;
            case 'contains': return String(leftVal).includes(String(rightVal));
            case 'starts': return String(leftVal).startsWith(String(rightVal));
            case 'ends': return String(leftVal).endsWith(String(rightVal));
            default: return leftVal === rightVal;
          }
        });

        if (matches) {
          hasMatch = true;
          matchedRight.add(ri);
          result.push({ ...leftRec, ...rightRec });
        }
      }

      // Left/Full join: include unmatched left records
      if (!hasMatch && (joinType === 'left' || joinType === 'full')) {
        result.push({ ...leftRec });
      }
    }

    // Right/Full join: include unmatched right records
    if (joinType === 'right' || joinType === 'full') {
      for (let ri = 0; ri < rightRecords.length; ri++) {
        if (!matchedRight.has(ri)) {
          result.push({ ...rightRecords[ri] });
        }
      }
    }

    return result;
  }

  _getFilteredRecords() {
    const records = this._getJoinedRecords();

    if (!this._filterBuilder) return records;

    const filterGroup = this._filterBuilder.getFilters();
    const source = this._getCombinedSource();

    return records.filter(record =>
      AdvancedFilterBuilder.evaluateRecord(record, filterGroup, source)
    );
  }

  _getFilteredCount() {
    return this._getFilteredRecords().length;
  }

  _getFilterConditionCount() {
    if (!this._filterBuilder) return 0;
    const filters = this._filterBuilder.getFilters();
    return this._countConditions(filters);
  }

  _countConditions(group) {
    let count = group.conditions?.length || 0;
    for (const subgroup of group.groups || []) {
      count += this._countConditions(subgroup);
    }
    return count;
  }

  _updatePreview() {
    const countEl = this.container.querySelector('#sjf-filter-count');
    if (countEl) {
      countEl.textContent = `${this._getFilteredCount()} records match`;
    }
  }

  _createSet() {
    const name = this._setName.trim() || 'Untitled Set';
    const fields = this._getCombinedFields();
    const records = this._getFilteredRecords();

    // Build derivation info
    const derivation = {
      strategy: this._selectedItems.length > 1 ? 'con' : 'seg',
      sourceItems: this._selectedItems.map(item => ({
        type: item.type,
        id: item.id,
        name: item.name
      })),
      joinConfig: this._selectedItems.length > 1 ? this._joinConfig : null,
      filters: this._filterBuilder?.getFilters() || null,
      derivedAt: new Date().toISOString()
    };

    const result = {
      name,
      fields,
      records: records.map((rec, i) => ({
        id: `rec_${Date.now().toString(36)}_${i}`,
        values: rec
      })),
      derivation
    };

    this.hide();
    this._onComplete?.(result);
  }

  _escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}


// ============================================================================
// DataPipelineUI - Visual pipeline for creating Sets from Sources
// ============================================================================

/**
 * DataPipelineUI - A 3-panel visual interface for creating Sets from Sources
 *
 * Layout: Sources Panel → Transforms Panel → Output Panel
 *
 * This replaces SetFromSourceUI with a clearer visual flow that:
 * - Shows source integration clearly
 * - Makes multiple source combination easy
 * - Visualizes the transformation pipeline
 * - Shows provenance chain from Source → Set
 */
class DataPipelineUI {
  constructor(options = {}) {
    this.sourceStore = options.sourceStore;
    this.setCreator = options.setCreator;
    this.container = null;
    this._onComplete = null;
    this._onCancel = null;

    // Pipeline state
    this._sources = [];          // Array of { id, source } - selected sources
    this._transforms = [];       // Array of { type, config } - transforms to apply
    this._outputName = '';
    this._selectedFields = [];   // Fields to include in output
    this._filterBuilder = null;
    this._previewData = null;

    // Available sources from sourceStore
    this._availableSources = [];

    // All sources from the workbench (passed via show())
    this._allSources = [];

    // Subtype detection state
    // viewConfig structure: { viewType: 'table'|'cards'|'kanban', visibleFields: string[], fieldOrder: string[] }
    this._detectedSubtypes = null;  // { fieldName, fieldId, values: [{name, count, createView, viewConfig}], createViews: true }
    this._subtypeFieldCandidates = ['type', '_type', 'recordType', 'record_type', 'kind', 'category', 'status', 'class', 'subtype'];

    // Lens creation mode: 'views' | 'lenses' | 'none'
    // 'views' = create filtered views (display-only, original behavior)
    // 'lenses' = create lenses (type-scoped subsets with own schema)
    // 'none' = don't create views or lenses
    this._recordTypeMode = 'lenses';  // Default to lenses for multi-record-type sources

    // Available view types for record type views
    this._viewTypes = [
      { id: 'table', name: 'Table', icon: 'ph-table' },
      { id: 'cards', name: 'Cards', icon: 'ph-cards' },
      { id: 'kanban', name: 'Kanban', icon: 'ph-kanban' }
    ];
  }

  /**
   * Show the pipeline UI
   * @param {Object} options - Configuration options
   * @param {string} options.sourceId - Initial source ID to add
   * @param {Array} options.allSources - All available sources
   * @param {Function} options.onComplete - Called with result when set is created
   * @param {Function} options.onCancel - Called when cancelled
   */
  show(options = {}) {
    this._onComplete = options.onComplete;
    this._onCancel = options.onCancel;
    this._allSources = options.allSources || [];

    // Initialize with provided source
    if (options.sourceId) {
      const source = this._allSources.find(s => s.id === options.sourceId);
      if (source) {
        this._sources = [{ id: source.id, source }];
        this._outputName = source.name.replace(/\.[^/.]+$/, '');
        this._initFieldsFromSources();
      }
    }

    // Create container
    this._createContainer();
    this._render();
    this._attachEventListeners();
  }

  hide() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this._filterBuilder = null;
  }

  _createContainer() {
    // Remove any existing container
    const existing = document.getElementById('data-pipeline-container');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'data-pipeline-container';
    document.body.appendChild(this.container);
  }

  _initFieldsFromSources() {
    this._selectedFields = [];
    for (const { source } of this._sources) {
      if (source.schema?.fields && source.schema.fields.length > 0) {
        // Use schema fields if available
        for (const field of source.schema.fields) {
          this._selectedFields.push({
            sourceId: source.id,
            sourceName: source.name,
            name: field.name,
            type: field.type,
            rename: null,
            include: true
          });
        }
      } else if (source.records && source.records.length > 0) {
        // Fallback: Infer fields from records when schema.fields is missing
        // This matches the logic in _renderSourceDataView for consistency
        // Handles both flat records and {values: {...}} format
        const fieldSet = new Set();
        const fieldOrder = [];

        // Helper to get keys from a record (handles both formats)
        const getRecordKeys = (record) => {
          if (record.values && typeof record.values === 'object') {
            return Object.keys(record.values);
          }
          return Object.keys(record).filter(k => k !== 'id' && k !== 'values');
        };

        // First, add fields from the first record (preserves typical order)
        for (const key of getRecordKeys(source.records[0])) {
          if (!key.startsWith('_')) {  // Skip internal fields
            fieldOrder.push(key);
            fieldSet.add(key);
          }
        }

        // Then scan remaining records for any additional fields
        for (let i = 1; i < source.records.length; i++) {
          for (const key of getRecordKeys(source.records[i])) {
            if (!key.startsWith('_') && !fieldSet.has(key)) {
              fieldOrder.push(key);
              fieldSet.add(key);
            }
          }
        }

        // Add inferred fields to selectedFields
        for (const fieldName of fieldOrder) {
          this._selectedFields.push({
            sourceId: source.id,
            sourceName: source.name,
            name: fieldName,
            type: this._inferFieldType(source.records, fieldName),
            rename: null,
            include: true
          });
        }
      }
    }

    // Detect subtypes after loading fields
    this._detectSubtypes();
  }

  /**
   * Infer field type from record values
   * Simple inference based on sample values
   * Handles both flat records and {values: {...}} format
   */
  _inferFieldType(records, fieldName) {
    const sampleSize = Math.min(records.length, 100);
    let numberCount = 0;
    let dateCount = 0;
    let boolCount = 0;
    let nonEmptyCount = 0;

    for (let i = 0; i < sampleSize; i++) {
      const record = records[i];
      // Handle both flat records and {values: {...}} format
      const value = record.values?.[fieldName] ?? record[fieldName];
      if (value === null || value === undefined || value === '') continue;

      nonEmptyCount++;
      const strValue = String(value);

      // Check for number
      if (!isNaN(parseFloat(strValue)) && isFinite(strValue)) {
        numberCount++;
      }
      // Check for date patterns
      else if (/^\d{4}-\d{2}-\d{2}/.test(strValue) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(strValue)) {
        dateCount++;
      }
      // Check for boolean
      else if (/^(true|false|yes|no)$/i.test(strValue)) {
        boolCount++;
      }
    }

    if (nonEmptyCount === 0) return 'text';

    const threshold = nonEmptyCount * 0.8;
    if (numberCount >= threshold) return 'number';
    if (dateCount >= threshold) return 'date';
    if (boolCount >= threshold) return 'boolean';

    return 'text';
  }

  /**
   * Detect if the source data has a subtype field (type, kind, category, etc.)
   * and identify the distinct values to potentially create views for.
   * Also analyzes which fields have values for each record type.
   */
  _detectSubtypes() {
    this._detectedSubtypes = null;

    if (this._sources.length === 0) return;

    // For now, only detect subtypes from first source
    const source = this._sources[0].source;
    if (!source.records || source.records.length < 2) return;

    // Check if source already has multiRecordAnalysis computed (from main view)
    // This ensures consistency between the main view's type detection and the dialog
    if (source.multiRecordAnalysis && source.multiRecordAnalysis.types?.length >= 1) {
      const analysis = source.multiRecordAnalysis;
      const allFieldNames = this._selectedFields.map(f => f.name);

      this._detectedSubtypes = {
        fieldName: analysis.typeField,
        values: analysis.types.map(typeInfo => {
          // Compute visible fields: type-specific fields + common fields, excluding the type field itself
          const specificFields = typeInfo.specificFields || [];
          const commonFields = analysis.commonFields || [];
          const relevantFields = [...new Set([...specificFields, ...commonFields])]
            .filter(f => f !== analysis.typeField);
          const visibleFields = relevantFields.length > 0 ? relevantFields : allFieldNames.filter(f => f !== analysis.typeField);

          return {
            name: typeInfo.value,
            count: typeInfo.count,
            createView: true,
            viewConfig: {
              viewType: 'table',
              visibleFields: visibleFields,
              fieldOrder: visibleFields
            }
          };
        }),
        createViews: true
      };
      return;
    }

    // Fallback: detect types manually if multiRecordAnalysis not available
    // Look for a type field
    const fieldNames = this._selectedFields.map(f => f.name.toLowerCase());
    let typeFieldName = null;

    for (const candidate of this._subtypeFieldCandidates) {
      const index = fieldNames.indexOf(candidate.toLowerCase());
      if (index !== -1) {
        typeFieldName = this._selectedFields[index].name;
        break;
      }
    }

    if (!typeFieldName) return;

    // Helper to get value from record (handles both flat and {values: {...}} formats)
    const getRecordValue = (record, fieldName) => {
      return record.values?.[fieldName] ?? record[fieldName];
    };

    // Count values and track which fields have data for each type
    const valueCounts = {};
    const fieldsByType = {};  // { typeName: { fieldName: countOfNonEmpty } }

    for (const record of source.records) {
      const typeVal = getRecordValue(record, typeFieldName);
      if (typeVal === null || typeVal === undefined || typeVal === '') continue;

      const strVal = String(typeVal);
      valueCounts[strVal] = (valueCounts[strVal] || 0) + 1;

      // Track which fields have values for this type
      if (!fieldsByType[strVal]) {
        fieldsByType[strVal] = {};
      }

      for (const field of this._selectedFields) {
        const fieldValue = getRecordValue(record, field.name);
        if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
          fieldsByType[strVal][field.name] = (fieldsByType[strVal][field.name] || 0) + 1;
        }
      }
    }

    const distinctValues = Object.keys(valueCounts);

    // Need at least 1 distinct value to show type info (was 2, now showing even single types)
    if (distinctValues.length < 1 || distinctValues.length > 20) return;

    // Determine relevant fields for each type (fields with at least 10% population)
    const allFieldNames = this._selectedFields.map(f => f.name);

    // Store detected subtypes with view configuration
    this._detectedSubtypes = {
      fieldName: typeFieldName,
      values: distinctValues.map(name => {
        const count = valueCounts[name];
        const typeFields = fieldsByType[name] || {};

        // Fields that have data for at least 10% of records of this type
        const relevantFields = allFieldNames.filter(fieldName => {
          if (fieldName === typeFieldName) return false;  // Exclude the type field itself
          const fieldCount = typeFields[fieldName] || 0;
          return fieldCount >= count * 0.1;
        });

        // Default visible fields: all relevant fields, or all if none detected
        const visibleFields = relevantFields.length > 0 ? relevantFields : allFieldNames.filter(f => f !== typeFieldName);

        return {
          name,
          count,
          createView: true,
          viewConfig: {
            viewType: 'table',
            visibleFields: visibleFields,
            fieldOrder: visibleFields
          }
        };
      }).sort((a, b) => b.count - a.count),
      createViews: true  // Master toggle
    };
  }

  /**
   * Render the subtypes detection section in the output panel
   */
  _renderSubtypesSection() {
    if (!this._detectedSubtypes) return '';

    const { fieldName, values } = this._detectedSubtypes;
    const selectedCount = values.filter(v => v.createView).length;
    const mode = this._recordTypeMode;
    const isActive = mode !== 'none';
    const hasMultipleTypes = values.length >= 2;
    const totalRecords = values.reduce((sum, v) => sum + v.count, 0);
    const maxCount = Math.max(...values.map(v => v.count));

    return `
      <div class="subtypes-section">
        <div class="subtypes-header">
          <div class="subtypes-title">
            <i class="ph ph-stack"></i>
            <span>Record Types</span>
          </div>
        </div>
        <div class="subtypes-info">
          Found <strong>${values.length}</strong> type${values.length !== 1 ? 's' : ''} in <code>${this._escapeHtml(fieldName)}</code> field
        </div>

        <!-- Type Distribution Bars (always shown) -->
        <div class="type-distribution">
          ${values.slice(0, 10).map(v => {
            const pct = (v.count / maxCount) * 100;
            return `
            <div class="type-bar-row">
              <span class="type-bar-label" title="${this._escapeHtml(v.name)}">
                <i class="${this._getIconForSubtype(v.name)}"></i>
                ${this._escapeHtml(this._formatSubtypeName(v.name))}
              </span>
              <div class="type-bar-track">
                <div class="type-bar-fill" style="width: ${pct}%"></div>
              </div>
              <span class="type-bar-count">${v.count}</span>
            </div>
          `;}).join('')}
          ${values.length > 10 ? `<div class="type-bar-more">+${values.length - 10} more types</div>` : ''}
        </div>

        ${hasMultipleTypes ? `
        <!-- Lens/View Options (only when 2+ types) -->
        <div class="subtypes-mode-selector">
          <label class="mode-option ${mode === 'lenses' ? 'selected' : ''}" title="Create lenses - type-scoped subsets with independent schemas">
            <input type="radio" name="record-type-mode" value="lenses" ${mode === 'lenses' ? 'checked' : ''}>
            <i class="ph ph-circles-three"></i>
            <span>Create as lenses</span>
          </label>
          <label class="mode-option ${mode === 'views' ? 'selected' : ''}" title="Create views - filtered display perspectives">
            <input type="radio" name="record-type-mode" value="views" ${mode === 'views' ? 'checked' : ''}>
            <i class="ph ph-eye"></i>
            <span>Create as views</span>
          </label>
          <label class="mode-option ${mode === 'none' ? 'selected' : ''}" title="Don't create separate views or lenses">
            <input type="radio" name="record-type-mode" value="none" ${mode === 'none' ? 'checked' : ''}>
            <i class="ph ph-minus-circle"></i>
            <span>Skip</span>
          </label>
        </div>

        <div class="subtypes-list ${!isActive ? 'disabled' : ''}" id="subtypes-list">
          ${values.map((v, i) => {
            const viewType = this._viewTypes.find(vt => vt.id === v.viewConfig?.viewType) || this._viewTypes[0];
            const fieldCount = v.viewConfig?.visibleFields?.length || 0;
            return `
            <div class="subtype-item ${v.createView ? 'enabled' : ''}" data-index="${i}">
              <div class="subtype-main">
                <input type="checkbox" id="subtype-${i}" data-index="${i}"
                       ${v.createView ? 'checked' : ''} ${!isActive ? 'disabled' : ''}>
                <label for="subtype-${i}">
                  <i class="${this._getIconForSubtype(v.name)}"></i>
                  <span class="subtype-name">${this._escapeHtml(this._formatSubtypeName(v.name))}</span>
                  <span class="subtype-count">${v.count}</span>
                </label>
              </div>
              ${v.createView && isActive ? `
                <div class="subtype-config">
                  <span class="subtype-view-type" title="${mode === 'lenses' ? 'Lens type' : 'View type'}">
                    <i class="${viewType.icon}"></i>
                    ${viewType.name}
                  </span>
                  <span class="subtype-field-count" title="Fields visible">${fieldCount} fields</span>
                  <button class="subtype-configure-btn" data-index="${i}" title="Configure ${mode === 'lenses' ? 'lens' : 'view'}">
                    <i class="ph ph-gear"></i>
                  </button>
                </div>
              ` : ''}
            </div>
          `;}).join('')}
        </div>

        <div class="subtypes-summary">
          ${this._getSubtypesSummaryText(mode, selectedCount)}
        </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Get summary text for subtypes section based on mode and count
   */
  _getSubtypesSummaryText(mode, count) {
    switch (mode) {
      case 'lenses':
        return count > 0
          ? `<i class="ph ph-circles-three"></i> Will create ${count} lens${count !== 1 ? 'es' : ''} with type-specific schemas`
          : `<i class="ph ph-info"></i> Select record types to create lenses for`;
      case 'views':
        return count > 0
          ? `<i class="ph ph-eye"></i> Will create ${count} view${count !== 1 ? 's' : ''} with custom field configurations`
          : `<i class="ph ph-info"></i> Select record types to create views for`;
      case 'none':
      default:
        return `<i class="ph ph-info"></i> No lenses or views will be created`;
    }
  }

  _render() {
    const sourcesCount = this._sources.length;
    const transformsCount = this._transforms.length;
    const outputRecords = this._getOutputRecordCount();
    const outputFields = this._selectedFields.filter(f => f.include).length;

    this.container.innerHTML = `
      <div class="data-pipeline-overlay">
        <div class="data-pipeline-modal">
          <div class="data-pipeline-header">
            <h2><i class="ph ph-flow-arrow"></i> Create Set from Data</h2>
            <button class="data-pipeline-close" id="pipeline-close-btn">
              <i class="ph ph-x"></i>
            </button>
          </div>

          <div class="data-pipeline-body">
            <!-- Sources Panel -->
            <div class="data-pipeline-panel data-pipeline-sources">
              <div class="panel-header">
                <h3><i class="ph ph-database"></i> Sources</h3>
                <span class="panel-badge">${sourcesCount}</span>
              </div>
              <div class="panel-content">
                <div class="source-list" id="pipeline-source-list">
                  ${this._renderSourceCards()}
                </div>
                <button class="add-source-btn" id="add-source-btn">
                  <i class="ph ph-plus"></i> Add Source
                </button>
              </div>
            </div>

            <!-- Flow Arrow -->
            <div class="data-pipeline-arrow">
              <i class="ph ph-arrow-right"></i>
            </div>

            <!-- Transforms Panel -->
            <div class="data-pipeline-panel data-pipeline-transforms">
              <div class="panel-header">
                <h3><i class="ph ph-funnel-simple"></i> Pipeline</h3>
                <span class="panel-badge">${transformsCount > 0 ? transformsCount : 'pass-through'}</span>
              </div>
              <div class="panel-content">
                ${this._renderTransforms()}
                <div class="transform-actions">
                  ${sourcesCount > 1 ? `
                    <button class="add-transform-btn" id="add-join-btn">
                      <i class="ph ph-git-merge"></i> Configure Join
                    </button>
                  ` : ''}
                  <button class="add-transform-btn" id="add-filter-btn">
                    <i class="ph ph-funnel"></i> Add Filter
                  </button>
                  <button class="add-transform-btn" id="configure-fields-btn">
                    <i class="ph ph-columns"></i> Select Fields
                  </button>
                </div>
              </div>
            </div>

            <!-- Flow Arrow -->
            <div class="data-pipeline-arrow">
              <i class="ph ph-arrow-right"></i>
            </div>

            <!-- Output Panel -->
            <div class="data-pipeline-panel data-pipeline-output">
              <div class="panel-header">
                <h3><i class="ph ph-table"></i> Output Set</h3>
              </div>
              <div class="panel-content">
                <div class="output-name-section">
                  <label>Set Name</label>
                  <input type="text" id="pipeline-set-name" class="output-name-input"
                         placeholder="Enter set name..."
                         value="${this._escapeHtml(this._outputName)}">
                </div>
                <div class="output-stats">
                  <div class="stat">
                    <span class="stat-value">${outputRecords}</span>
                    <span class="stat-label">records</span>
                  </div>
                  <div class="stat">
                    <span class="stat-value">${outputFields}</span>
                    <span class="stat-label">fields</span>
                  </div>
                </div>

                ${this._renderSubtypesSection()}

                <div class="output-preview">
                  <button class="preview-btn" id="pipeline-preview-btn">
                    <i class="ph ph-eye"></i> Preview
                  </button>
                  <div class="preview-results" id="pipeline-preview-results"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="data-pipeline-footer">
            <div class="footer-info">
              <span class="provenance-info">
                <i class="ph ph-git-branch"></i>
                Derived from ${sourcesCount} source${sourcesCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div class="footer-actions">
              <button class="btn btn-secondary" id="pipeline-cancel-btn">Cancel</button>
              <button class="btn btn-primary" id="pipeline-create-btn" ${sourcesCount === 0 ? 'disabled' : ''}>
                <i class="ph ph-table"></i> Create Set
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderSourceCards() {
    if (this._sources.length === 0) {
      return `
        <div class="source-empty">
          <i class="ph ph-database"></i>
          <p>No sources added</p>
          <p class="hint">Add a source to begin</p>
        </div>
      `;
    }

    return this._sources.map(({ id, source }, index) => `
      <div class="source-card" data-source-id="${id}">
        <div class="source-card-header">
          <i class="ph ph-file"></i>
          <span class="source-name">${this._escapeHtml(source.name)}</span>
          ${this._sources.length > 1 ? `
            <button class="source-remove-btn" data-index="${index}" title="Remove source">
              <i class="ph ph-x"></i>
            </button>
          ` : ''}
        </div>
        <div class="source-card-stats">
          <span>${source.recordCount || source.records?.length || 0} records</span>
          <span>${source.schema?.fields?.length || 0} fields</span>
        </div>
      </div>
    `).join('');
  }

  _renderTransforms() {
    const items = [];

    // Always show base data flow
    if (this._sources.length === 1) {
      items.push(`
        <div class="transform-card transform-passthrough">
          <i class="ph ph-arrow-right"></i>
          <span>All Records</span>
          <span class="transform-detail">${this._getSourceRecordCount()} rows</span>
        </div>
      `);
    } else if (this._sources.length > 1) {
      const joinTransform = this._transforms.find(t => t.type === 'join');
      if (joinTransform) {
        items.push(`
          <div class="transform-card transform-join">
            <i class="ph ph-git-merge"></i>
            <span>${joinTransform.config.joinType.toUpperCase()} JOIN</span>
            <span class="transform-detail">on ${joinTransform.config.leftField} = ${joinTransform.config.rightField}</span>
          </div>
        `);
      } else {
        items.push(`
          <div class="transform-card transform-warning">
            <i class="ph ph-warning"></i>
            <span>Multiple Sources</span>
            <span class="transform-detail">Configure join to combine</span>
          </div>
        `);
      }
    }

    // Show filter if configured
    const filterTransform = this._transforms.find(t => t.type === 'filter');
    if (filterTransform) {
      const conditionCount = this._countFilterConditions(filterTransform.config);
      items.push(`
        <div class="transform-card transform-filter">
          <i class="ph ph-funnel"></i>
          <span>Filter</span>
          <span class="transform-detail">${conditionCount} condition${conditionCount !== 1 ? 's' : ''}</span>
          <button class="transform-remove-btn" data-transform-type="filter" title="Remove filter">
            <i class="ph ph-x"></i>
          </button>
        </div>
      `);
    }

    // Show field selection summary
    const selectedCount = this._selectedFields.filter(f => f.include).length;
    const totalCount = this._selectedFields.length;
    if (selectedCount < totalCount) {
      items.push(`
        <div class="transform-card transform-select">
          <i class="ph ph-columns"></i>
          <span>Select Fields</span>
          <span class="transform-detail">${selectedCount} of ${totalCount}</span>
        </div>
      `);
    }

    if (items.length === 0) {
      return `
        <div class="transforms-empty">
          <i class="ph ph-empty"></i>
          <p>No transforms</p>
        </div>
      `;
    }

    return `<div class="transform-list">${items.join('')}</div>`;
  }

  _countFilterConditions(filterConfig) {
    if (!filterConfig) return 0;
    if (filterConfig.conditions) return filterConfig.conditions.length;
    return 1;
  }

  _getSourceRecordCount() {
    if (this._sources.length === 0) return 0;
    return this._sources.reduce((sum, { source }) => {
      return sum + (source.recordCount || source.records?.length || 0);
    }, 0);
  }

  _getOutputRecordCount() {
    // For now, simple pass-through count
    // TODO: Apply filters and joins to get actual count
    const baseCount = this._getSourceRecordCount();
    const filterTransform = this._transforms.find(t => t.type === 'filter');
    if (filterTransform && this._sources.length > 0) {
      return this._applyFiltersAndCount();
    }
    return baseCount;
  }

  _applyFiltersAndCount() {
    if (this._sources.length === 0) return 0;
    const source = this._sources[0].source;
    const filterTransform = this._transforms.find(t => t.type === 'filter');

    if (!filterTransform || !source.records) {
      return source.records?.length || 0;
    }

    let count = 0;
    for (const record of source.records) {
      if (AdvancedFilterBuilder.evaluateRecord(record, filterTransform.config, source)) {
        count++;
      }
    }
    return count;
  }

  _attachEventListeners() {
    // Close/Cancel
    this.container.querySelector('#pipeline-close-btn')?.addEventListener('click', () => {
      this.hide();
      this._onCancel?.();
    });

    this.container.querySelector('#pipeline-cancel-btn')?.addEventListener('click', () => {
      this.hide();
      this._onCancel?.();
    });

    // Add Source
    this.container.querySelector('#add-source-btn')?.addEventListener('click', () => {
      this._showAddSourcePicker();
    });

    // Remove Source
    this.container.querySelectorAll('.source-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this._sources.splice(index, 1);
        this._initFieldsFromSources();
        this._render();
        this._attachEventListeners();
      });
    });

    // Add Filter
    this.container.querySelector('#add-filter-btn')?.addEventListener('click', () => {
      this._showFilterBuilder();
    });

    // Configure Join
    this.container.querySelector('#add-join-btn')?.addEventListener('click', () => {
      this._showJoinConfig();
    });

    // Configure Fields
    this.container.querySelector('#configure-fields-btn')?.addEventListener('click', () => {
      this._showFieldSelector();
    });

    // Remove transforms
    this.container.querySelectorAll('.transform-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.transformType;
        this._transforms = this._transforms.filter(t => t.type !== type);
        this._render();
        this._attachEventListeners();
      });
    });

    // Set name input
    this.container.querySelector('#pipeline-set-name')?.addEventListener('input', (e) => {
      this._outputName = e.target.value;
    });

    // Preview
    this.container.querySelector('#pipeline-preview-btn')?.addEventListener('click', () => {
      this._showPreview();
    });

    // Create
    this.container.querySelector('#pipeline-create-btn')?.addEventListener('click', () => {
      this._createSet();
    });

    // Record type mode selector (lenses/views/none)
    this.container.querySelectorAll('input[name="record-type-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this._recordTypeMode = e.target.value;
        this._render();
        this._attachEventListeners();
      });
    });

    this.container.querySelectorAll('#subtypes-list input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (this._detectedSubtypes) {
          const index = parseInt(e.target.dataset.index);
          this._detectedSubtypes.values[index].createView = e.target.checked;
          // Re-render to show/hide configure button
          this._render();
          this._attachEventListeners();
        }
      });
    });

    // Configure button for each record type view
    this.container.querySelectorAll('.subtype-configure-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(e.currentTarget.dataset.index);
        this._showRecordTypeViewConfig(index);
      });
    });
  }

  _showAddSourcePicker() {
    // Get sources not already added
    const availableSources = this._allSources.filter(s =>
      !this._sources.some(added => added.id === s.id)
    );

    if (availableSources.length === 0) {
      alert('No additional sources available. Import more files to add sources.');
      return;
    }

    // Create picker modal
    const picker = document.createElement('div');
    picker.className = 'source-picker-overlay';
    picker.innerHTML = `
      <div class="source-picker-modal">
        <div class="source-picker-header">
          <h3><i class="ph ph-database"></i> Add Source</h3>
          <button class="source-picker-close"><i class="ph ph-x"></i></button>
        </div>
        <div class="source-picker-list">
          ${availableSources.map(s => `
            <div class="source-picker-item" data-source-id="${s.id}">
              <i class="ph ph-file"></i>
              <div class="source-picker-info">
                <span class="source-picker-name">${this._escapeHtml(s.name)}</span>
                <span class="source-picker-stats">${s.recordCount || s.records?.length || 0} records · ${s.schema?.fields?.length || 0} fields</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(picker);

    // Event handlers
    picker.querySelector('.source-picker-close').addEventListener('click', () => {
      picker.remove();
    });

    picker.querySelectorAll('.source-picker-item').forEach(item => {
      item.addEventListener('click', () => {
        const sourceId = item.dataset.sourceId;
        const source = availableSources.find(s => s.id === sourceId);
        if (source) {
          this._sources.push({ id: sourceId, source });
          this._initFieldsFromSources();
          this._render();
          this._attachEventListeners();
        }
        picker.remove();
      });
    });

    picker.addEventListener('click', (e) => {
      if (e.target === picker) picker.remove();
    });
  }

  _showFilterBuilder() {
    if (this._sources.length === 0) {
      alert('Add a source first');
      return;
    }

    // Create a combined source for filtering
    const source = this._sources[0].source;

    // Create filter modal
    const modal = document.createElement('div');
    modal.className = 'filter-modal-overlay';
    modal.innerHTML = `
      <div class="filter-modal">
        <div class="filter-modal-header">
          <h3><i class="ph ph-funnel"></i> Configure Filters</h3>
          <button class="filter-modal-close"><i class="ph ph-x"></i></button>
        </div>
        <div class="filter-modal-body" id="filter-builder-target"></div>
        <div class="filter-modal-footer">
          <button class="btn btn-secondary filter-cancel-btn">Cancel</button>
          <button class="btn btn-primary filter-apply-btn">Apply Filters</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Initialize filter builder
    const existingFilter = this._transforms.find(t => t.type === 'filter');
    this._filterBuilder = new AdvancedFilterBuilder({
      source,
      provenanceEnabled: false,
      initialFilters: existingFilter?.config || null
    });

    this._filterBuilder.render(modal.querySelector('#filter-builder-target'));

    // Event handlers
    modal.querySelector('.filter-modal-close').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('.filter-cancel-btn').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('.filter-apply-btn').addEventListener('click', () => {
      const filters = this._filterBuilder.getFilters();

      // Remove existing filter transform
      this._transforms = this._transforms.filter(t => t.type !== 'filter');

      // Add new filter transform if there are conditions
      if (filters.conditions && filters.conditions.length > 0) {
        this._transforms.push({ type: 'filter', config: filters });
      }

      modal.remove();
      this._render();
      this._attachEventListeners();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  _showJoinConfig() {
    if (this._sources.length < 2) {
      alert('Add at least two sources to configure a join');
      return;
    }

    const leftSource = this._sources[0].source;
    const rightSource = this._sources[1].source;
    const existingJoin = this._transforms.find(t => t.type === 'join');

    const modal = document.createElement('div');
    modal.className = 'join-modal-overlay';
    modal.innerHTML = `
      <div class="join-modal">
        <div class="join-modal-header">
          <h3><i class="ph ph-git-merge"></i> Configure Join</h3>
          <button class="join-modal-close"><i class="ph ph-x"></i></button>
        </div>
        <div class="join-modal-body">
          <div class="join-sources">
            <div class="join-source">
              <span class="join-source-label">Left</span>
              <span class="join-source-name">${this._escapeHtml(leftSource.name)}</span>
            </div>
            <div class="join-type-select">
              <select id="join-type">
                <option value="inner" ${existingJoin?.config?.joinType === 'inner' ? 'selected' : ''}>INNER JOIN</option>
                <option value="left" ${existingJoin?.config?.joinType === 'left' || !existingJoin ? 'selected' : ''}>LEFT JOIN</option>
                <option value="right" ${existingJoin?.config?.joinType === 'right' ? 'selected' : ''}>RIGHT JOIN</option>
                <option value="full" ${existingJoin?.config?.joinType === 'full' ? 'selected' : ''}>FULL JOIN</option>
              </select>
            </div>
            <div class="join-source">
              <span class="join-source-label">Right</span>
              <span class="join-source-name">${this._escapeHtml(rightSource.name)}</span>
            </div>
          </div>
          <div class="join-condition">
            <label>Join On:</label>
            <div class="join-fields">
              <select id="join-left-field">
                ${leftSource.schema.fields.map(f => `
                  <option value="${f.name}" ${existingJoin?.config?.leftField === f.name ? 'selected' : ''}>${f.name}</option>
                `).join('')}
              </select>
              <span>=</span>
              <select id="join-right-field">
                ${rightSource.schema.fields.map(f => `
                  <option value="${f.name}" ${existingJoin?.config?.rightField === f.name ? 'selected' : ''}>${f.name}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="join-modal-footer">
          <button class="btn btn-secondary join-cancel-btn">Cancel</button>
          <button class="btn btn-primary join-apply-btn">Apply Join</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    modal.querySelector('.join-modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.join-cancel-btn').addEventListener('click', () => modal.remove());

    modal.querySelector('.join-apply-btn').addEventListener('click', () => {
      const joinType = modal.querySelector('#join-type').value;
      const leftField = modal.querySelector('#join-left-field').value;
      const rightField = modal.querySelector('#join-right-field').value;

      // Remove existing join
      this._transforms = this._transforms.filter(t => t.type !== 'join');

      // Add new join
      this._transforms.unshift({
        type: 'join',
        config: { joinType, leftField, rightField }
      });

      modal.remove();
      this._render();
      this._attachEventListeners();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  _showFieldSelector() {
    if (this._selectedFields.length === 0) {
      alert('Add a source first');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'field-selector-overlay';
    modal.innerHTML = `
      <div class="field-selector-modal">
        <div class="field-selector-header">
          <h3><i class="ph ph-columns"></i> Select Fields</h3>
          <button class="field-selector-close"><i class="ph ph-x"></i></button>
        </div>
        <div class="field-selector-actions">
          <button class="btn btn-sm" id="select-all-fields">Select All</button>
          <button class="btn btn-sm" id="deselect-all-fields">Deselect All</button>
        </div>
        <div class="field-selector-list">
          ${this._selectedFields.map((f, i) => `
            <div class="field-selector-row">
              <input type="checkbox" id="field-${i}" ${f.include ? 'checked' : ''} data-index="${i}">
              <label for="field-${i}">
                <span class="field-name">${this._escapeHtml(f.name)}</span>
                <span class="field-source">${this._escapeHtml(f.sourceName)}</span>
                <span class="field-type">${f.type}</span>
              </label>
              <input type="text" class="field-rename" placeholder="Rename..." value="${f.rename || ''}" data-index="${i}">
            </div>
          `).join('')}
        </div>
        <div class="field-selector-footer">
          <button class="btn btn-secondary field-cancel-btn">Cancel</button>
          <button class="btn btn-primary field-apply-btn">Apply</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    modal.querySelector('.field-selector-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.field-cancel-btn').addEventListener('click', () => modal.remove());

    modal.querySelector('#select-all-fields').addEventListener('click', () => {
      modal.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    });

    modal.querySelector('#deselect-all-fields').addEventListener('click', () => {
      modal.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    });

    modal.querySelector('.field-apply-btn').addEventListener('click', () => {
      // Update field selections
      modal.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        const index = parseInt(cb.dataset.index);
        this._selectedFields[index].include = cb.checked;
      });

      modal.querySelectorAll('.field-rename').forEach(input => {
        const index = parseInt(input.dataset.index);
        this._selectedFields[index].rename = input.value || null;
      });

      modal.remove();
      this._render();
      this._attachEventListeners();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  /**
   * Show configuration modal for a specific record type's view
   * Allows setting view type and selecting which fields to show
   */
  _showRecordTypeViewConfig(subtypeIndex) {
    if (!this._detectedSubtypes || subtypeIndex >= this._detectedSubtypes.values.length) {
      return;
    }

    const subtype = this._detectedSubtypes.values[subtypeIndex];
    const viewConfig = subtype.viewConfig || { viewType: 'table', visibleFields: [], fieldOrder: [] };
    const allFields = this._selectedFields.filter(f => f.include && f.name !== this._detectedSubtypes.fieldName);

    const modal = document.createElement('div');
    modal.className = 'record-type-config-overlay';
    modal.innerHTML = `
      <div class="record-type-config-modal">
        <div class="record-type-config-header">
          <h3>
            <i class="${this._getIconForSubtype(subtype.name)}"></i>
            Configure "${this._formatSubtypeName(subtype.name)}" View
          </h3>
          <button class="record-type-config-close"><i class="ph ph-x"></i></button>
        </div>

        <div class="record-type-config-body">
          <div class="config-section">
            <label class="config-label">View Type</label>
            <div class="view-type-options">
              ${this._viewTypes.map(vt => `
                <label class="view-type-option ${viewConfig.viewType === vt.id ? 'selected' : ''}">
                  <input type="radio" name="view-type" value="${vt.id}"
                         ${viewConfig.viewType === vt.id ? 'checked' : ''}>
                  <i class="${vt.icon}"></i>
                  <span>${vt.name}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="config-section">
            <div class="config-label-row">
              <label class="config-label">Visible Fields</label>
              <div class="field-actions">
                <button class="btn btn-sm" id="select-all-type-fields">All</button>
                <button class="btn btn-sm" id="select-none-type-fields">None</button>
                <button class="btn btn-sm" id="select-relevant-type-fields" title="Select fields that have data for this record type">Relevant</button>
              </div>
            </div>
            <div class="type-fields-list">
              ${allFields.map((f, i) => {
                const isVisible = viewConfig.visibleFields.includes(f.name);
                return `
                <div class="type-field-item" draggable="true" data-field="${this._escapeHtml(f.name)}">
                  <i class="ph ph-dots-six-vertical drag-handle"></i>
                  <input type="checkbox" id="type-field-${i}" data-field="${this._escapeHtml(f.name)}"
                         ${isVisible ? 'checked' : ''}>
                  <label for="type-field-${i}">
                    <span class="field-name">${this._escapeHtml(f.rename || f.name)}</span>
                    <span class="field-type">${f.type}</span>
                  </label>
                </div>
              `;}).join('')}
            </div>
          </div>

          <div class="config-section">
            <div class="config-preview">
              <span class="preview-label">Preview:</span>
              <span class="preview-count">${subtype.count} records</span>
              <span class="preview-fields">${viewConfig.visibleFields.length} fields</span>
            </div>
          </div>
        </div>

        <div class="record-type-config-footer">
          <button class="btn btn-secondary record-type-cancel-btn">Cancel</button>
          <button class="btn btn-primary record-type-apply-btn">Apply</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Get initial relevant fields (fields with data for this type)
    const source = this._sources[0]?.source;
    const typeFieldName = this._detectedSubtypes.fieldName;
    const relevantFields = new Set();

    if (source?.records) {
      const typeRecords = source.records.filter(r => String(r[typeFieldName]) === subtype.name);
      for (const field of allFields) {
        let hasValue = false;
        for (const record of typeRecords) {
          const val = record[field.name];
          if (val !== null && val !== undefined && val !== '') {
            hasValue = true;
            break;
          }
        }
        if (hasValue) relevantFields.add(field.name);
      }
    }

    // Event handlers
    modal.querySelector('.record-type-config-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.record-type-cancel-btn').addEventListener('click', () => modal.remove());

    // View type selection
    modal.querySelectorAll('input[name="view-type"]').forEach(radio => {
      radio.addEventListener('change', () => {
        modal.querySelectorAll('.view-type-option').forEach(opt => {
          opt.classList.toggle('selected', opt.querySelector('input').checked);
        });
      });
    });

    // Field selection helpers
    modal.querySelector('#select-all-type-fields').addEventListener('click', () => {
      modal.querySelectorAll('.type-field-item input[type="checkbox"]').forEach(cb => cb.checked = true);
      this._updateTypeConfigPreview(modal, subtype.count);
    });

    modal.querySelector('#select-none-type-fields').addEventListener('click', () => {
      modal.querySelectorAll('.type-field-item input[type="checkbox"]').forEach(cb => cb.checked = false);
      this._updateTypeConfigPreview(modal, subtype.count);
    });

    modal.querySelector('#select-relevant-type-fields').addEventListener('click', () => {
      modal.querySelectorAll('.type-field-item input[type="checkbox"]').forEach(cb => {
        cb.checked = relevantFields.has(cb.dataset.field);
      });
      this._updateTypeConfigPreview(modal, subtype.count);
    });

    // Update preview on field change
    modal.querySelectorAll('.type-field-item input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => this._updateTypeConfigPreview(modal, subtype.count));
    });

    // Apply configuration
    modal.querySelector('.record-type-apply-btn').addEventListener('click', () => {
      const selectedViewType = modal.querySelector('input[name="view-type"]:checked')?.value || 'table';
      const selectedFields = [];

      modal.querySelectorAll('.type-field-item').forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox.checked) {
          selectedFields.push(checkbox.dataset.field);
        }
      });

      // Update the subtype's view configuration
      this._detectedSubtypes.values[subtypeIndex].viewConfig = {
        viewType: selectedViewType,
        visibleFields: selectedFields,
        fieldOrder: selectedFields
      };

      modal.remove();
      this._render();
      this._attachEventListeners();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  _updateTypeConfigPreview(modal, recordCount) {
    const checkedCount = modal.querySelectorAll('.type-field-item input[type="checkbox"]:checked').length;
    const previewFields = modal.querySelector('.preview-fields');
    if (previewFields) {
      previewFields.textContent = `${checkedCount} fields`;
    }
  }

  _showPreview() {
    const previewEl = this.container.querySelector('#pipeline-preview-results');
    if (!previewEl) return;

    if (this._sources.length === 0) {
      previewEl.innerHTML = '<div class="preview-empty">Add a source to preview</div>';
      return;
    }

    const selectedFields = this._selectedFields.filter(f => f.include);
    if (selectedFields.length === 0) {
      previewEl.innerHTML = '<div class="preview-error">Select at least one field</div>';
      return;
    }

    try {
      // Get records from first source (join handling would go here)
      const source = this._sources[0].source;
      let records = [...(source.records || [])];

      // Apply filter
      const filterTransform = this._transforms.find(t => t.type === 'filter');
      if (filterTransform) {
        records = records.filter(record =>
          AdvancedFilterBuilder.evaluateRecord(record, filterTransform.config, source)
        );
      }

      const sampleRecords = records.slice(0, 10);
      const headers = selectedFields.map(f => f.rename || f.name);

      previewEl.innerHTML = `
        <div class="preview-stats">
          <span><strong>${records.length}</strong> records</span>
          <span>${selectedFields.length} fields</span>
        </div>
        <div class="preview-table-wrapper">
          <table class="preview-table">
            <thead>
              <tr>
                ${headers.map(h => `<th>${this._escapeHtml(h)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${sampleRecords.map(row => `
                <tr>
                  ${selectedFields.map(f => `<td>${this._escapeHtml(String(row[f.name] ?? ''))}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${records.length > 10 ? `
          <div class="preview-more">Showing first 10 of ${records.length} records</div>
        ` : ''}
      `;
    } catch (error) {
      previewEl.innerHTML = `<div class="preview-error">${error.message}</div>`;
    }
  }

  _createSet() {
    const setName = this._outputName.trim();

    if (!setName) {
      alert('Please enter a set name');
      return;
    }

    if (this._sources.length === 0) {
      alert('Add at least one source');
      return;
    }

    const selectedFields = this._selectedFields.filter(f => f.include);
    if (selectedFields.length === 0) {
      alert('Select at least one field');
      return;
    }

    try {
      // Get records from source(s)
      const source = this._sources[0].source;
      let records = [...(source.records || [])];

      // Apply filter
      const filterTransform = this._transforms.find(t => t.type === 'filter');
      if (filterTransform) {
        records = records.filter(record =>
          AdvancedFilterBuilder.evaluateRecord(record, filterTransform.config, source)
        );
      }

      // Build fields for the set
      const fields = selectedFields.map((f, i) => ({
        id: `fld_${Date.now().toString(36)}_${i}`,
        name: f.rename || f.name,
        type: this._mapFieldType(f.type)
      }));

      // Build records with field ID keys
      const setRecords = records.map((row, i) => {
        const values = {};
        selectedFields.forEach((f, fi) => {
          values[fields[fi].id] = row[f.name];
        });
        return {
          id: `rec_${Date.now().toString(36)}_${i}`,
          values
        };
      });

      // Build derivation info
      const derivation = {
        strategy: this._sources.length > 1 ? 'con' : 'seg',
        sources: this._sources.map(s => ({
          id: s.id,
          name: s.source.name
        })),
        transforms: this._transforms,
        derivedAt: new Date().toISOString()
      };

      // Build views - start with default "All Records" view
      const views = [{
        id: `view_${Date.now().toString(36)}_all`,
        name: 'All Records',
        type: 'table',
        config: {}
      }];

      // Build lenses array (only populated when mode is 'lenses')
      const lenses = [];

      // Create a map from field name to field ID for building field configurations
      const fieldNameToId = new Map();
      selectedFields.forEach((sf, i) => {
        fieldNameToId.set(sf.name, fields[i].id);
      });

      // Create subtype views or lenses based on mode
      if (this._detectedSubtypes && this._recordTypeMode !== 'none') {
        const subtypeFieldName = this._detectedSubtypes.fieldName;
        const subtypeField = fields.find(f => f.name === subtypeFieldName || f.name === (selectedFields.find(sf => sf.name === subtypeFieldName)?.rename || subtypeFieldName));
        const subtypeFieldId = subtypeField?.id;

        if (subtypeFieldId) {
          const selectedSubtypes = this._detectedSubtypes.values.filter(v => v.createView);

          for (const subtype of selectedSubtypes) {
            const viewConfig = subtype.viewConfig || { viewType: 'table', visibleFields: [] };

            if (this._recordTypeMode === 'lenses') {
              // Create a lens for this record type
              const lens = this._buildLens(
                subtype,
                subtypeFieldId,
                fields,
                fieldNameToId,
                viewConfig,
                setRecords
              );
              lenses.push(lens);
            } else if (this._recordTypeMode === 'views') {
              // Create a view for this record type (original behavior)
              const view = this._buildRecordTypeView(
                subtype,
                subtypeFieldId,
                fieldNameToId,
                viewConfig
              );
              views.push(view);
            }
          }
        }
      }

      // Build lens configuration (if any lenses were created)
      const lensConfig = lenses.length > 0 ? {
        autoCreateLenses: false,
        defaultLens: lenses[0]?.id || null,
        allowMultiMembership: true,
        orphanHandling: 'unassigned'
      } : null;

      // Create the set
      const setId = `set_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
      const newSet = {
        id: setId,
        name: setName,
        icon: 'table',
        fields,
        records: setRecords,
        views,
        derivation,
        datasetProvenance: {
          sourceIds: this._sources.map(s => s.id)
        },
        createdAt: new Date().toISOString()
      };

      // Add lenses and lensConfig if any lenses were created
      if (lenses.length > 0) {
        // Update each lens with the setId reference
        lenses.forEach(lens => {
          lens.setId = setId;
        });
        newSet.lenses = lenses;
        newSet.lensConfig = lensConfig;
      }

      this.hide();
      this._onComplete?.({ set: newSet });
    } catch (error) {
      alert(`Failed to create set: ${error.message}`);
    }
  }

  /**
   * Build a lens object for a record type
   * Lenses are type-scoped subsets with their own refined schemas
   */
  _buildLens(subtype, subtypeFieldId, fields, fieldNameToId, viewConfig, setRecords) {
    const lensId = `lens_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const formattedName = this._formatSubtypeName(subtype.name);

    // Determine included and excluded fields
    const includedFields = [];
    const excludedFields = [];

    for (const [fieldName, fieldId] of fieldNameToId.entries()) {
      if (fieldId === subtypeFieldId) {
        // Always exclude the type field from lens view (it's redundant)
        excludedFields.push(fieldId);
      } else if (viewConfig.visibleFields && viewConfig.visibleFields.length > 0) {
        if (viewConfig.visibleFields.includes(fieldName)) {
          includedFields.push(fieldId);
        } else {
          excludedFields.push(fieldId);
        }
      } else {
        // If no visible fields specified, include all
        includedFields.push(fieldId);
      }
    }

    // Build field order from viewConfig or use included fields order
    const fieldOrder = [];
    if (viewConfig.fieldOrder && viewConfig.fieldOrder.length > 0) {
      for (const fieldName of viewConfig.fieldOrder) {
        const fieldId = fieldNameToId.get(fieldName);
        if (fieldId && includedFields.includes(fieldId)) {
          fieldOrder.push(fieldId);
        }
      }
    } else {
      fieldOrder.push(...includedFields);
    }

    // Count records that match this lens
    const recordCount = setRecords.filter(rec => {
      const typeValue = rec.values[subtypeFieldId];
      return typeValue === subtype.name;
    }).length;

    // Identify type-specific fields (fields that have values only for this type)
    const typeSpecificFields = [];
    const commonFields = [];
    for (const fieldId of includedFields) {
      const fieldInfo = [...fieldNameToId.entries()].find(([name, id]) => id === fieldId);
      if (fieldInfo) {
        // For now, mark as common (could enhance to detect type-specific later)
        commonFields.push(fieldId);
      }
    }

    // Create the lens object following DESIGN_LENS_SYSTEM.md structure
    return {
      id: lensId,
      name: formattedName,
      setId: null,  // Will be set after set creation

      // Selector for record membership
      selector: {
        type: 'field_match',
        fieldId: subtypeFieldId,
        operator: 'is',
        value: subtype.name
      },

      // Field configuration
      fieldOverrides: {},  // Can be customized later by user
      includedFields,
      excludedFields,
      fieldOrder,

      // Stats
      stats: {
        recordCount,
        lastUpdated: new Date().toISOString()
      },

      // Default view for this lens
      views: [{
        id: `view_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 4)}`,
        name: 'Table',
        type: viewConfig.viewType || 'table',
        config: {}
      }],

      // Metadata
      metadata: {
        icon: this._getIconForSubtype(subtype.name),
        color: this._getColorForSubtype(subtype.name),
        description: `${formattedName} records`,
        isRecordTypeLens: true,
        typeSpecificFields,
        commonFields
      },

      createdAt: new Date().toISOString()
    };
  }

  /**
   * Build a record-type view (filtered view, original behavior)
   */
  _buildRecordTypeView(subtype, subtypeFieldId, fieldNameToId, viewConfig) {
    const viewId = `view_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    // Calculate hidden fields: all fields not in visibleFields + the type field
    const hiddenFields = [subtypeFieldId];  // Always hide the type field in filtered views
    if (viewConfig.visibleFields && viewConfig.visibleFields.length > 0) {
      for (const [fieldName, fieldId] of fieldNameToId.entries()) {
        if (fieldId !== subtypeFieldId && !viewConfig.visibleFields.includes(fieldName)) {
          hiddenFields.push(fieldId);
        }
      }
    }

    // Calculate field order based on viewConfig.fieldOrder
    const fieldOrder = [];
    if (viewConfig.fieldOrder && viewConfig.fieldOrder.length > 0) {
      for (const fieldName of viewConfig.fieldOrder) {
        const fieldId = fieldNameToId.get(fieldName);
        if (fieldId && !hiddenFields.includes(fieldId)) {
          fieldOrder.push(fieldId);
        }
      }
    }

    return {
      id: viewId,
      name: this._formatSubtypeName(subtype.name),
      type: viewConfig.viewType || 'table',
      config: {
        filters: [{
          fieldId: subtypeFieldId,
          operator: 'is',
          filterValue: subtype.name,
          enabled: true
        }],
        hiddenFields,
        fieldOrder: fieldOrder.length > 0 ? fieldOrder : undefined
      },
      metadata: {
        recordType: subtype.name,
        recordCount: subtype.count,
        icon: this._getIconForSubtype(subtype.name),
        isRecordTypeView: true
      }
    };
  }

  /**
   * Get a color for a subtype based on common naming patterns
   */
  _getColorForSubtype(name) {
    const lower = (name || '').toLowerCase();
    const colorMap = {
      'person': '#3B82F6',     // Blue
      'people': '#3B82F6',
      'user': '#3B82F6',
      'company': '#8B5CF6',    // Purple
      'organization': '#8B5CF6',
      'org': '#8B5CF6',
      'event': '#F59E0B',      // Amber
      'meeting': '#F59E0B',
      'task': '#10B981',       // Green
      'todo': '#10B981',
      'document': '#6B7280',   // Gray
      'file': '#6B7280',
      'note': '#FBBF24',       // Yellow
      'email': '#EF4444',      // Red
      'message': '#06B6D4',    // Cyan
      'project': '#EC4899',    // Pink
      'product': '#14B8A6',    // Teal
      'order': '#F97316',      // Orange
      'transaction': '#22C55E', // Green
      'payment': '#22C55E',
      'location': '#0EA5E9',   // Sky
      'address': '#0EA5E9'
    };

    for (const [key, color] of Object.entries(colorMap)) {
      if (lower.includes(key)) return color;
    }
    return '#6366F1';  // Default indigo
  }

  _mapFieldType(type) {
    const mapping = {
      'text': 'TEXT',
      'string': 'TEXT',
      'number': 'NUMBER',
      'integer': 'NUMBER',
      'float': 'NUMBER',
      'date': 'DATE',
      'datetime': 'DATE',
      'boolean': 'CHECKBOX',
      'bool': 'CHECKBOX',
      'select': 'SELECT',
      'email': 'EMAIL',
      'url': 'URL'
    };
    return mapping[type?.toLowerCase()] || 'TEXT';
  }

  /**
   * Format subtype name for view display
   * Converts snake_case/camelCase to Title Case
   */
  _formatSubtypeName(name) {
    if (!name) return 'Unknown';
    return name
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Get an appropriate icon for a subtype based on common naming patterns
   */
  _getIconForSubtype(name) {
    const lower = (name || '').toLowerCase();
    const iconMap = {
      'person': 'ph-user',
      'people': 'ph-users',
      'user': 'ph-user',
      'company': 'ph-buildings',
      'organization': 'ph-buildings',
      'org': 'ph-buildings',
      'event': 'ph-calendar',
      'meeting': 'ph-calendar-check',
      'task': 'ph-check-square',
      'todo': 'ph-check-square',
      'document': 'ph-file-text',
      'file': 'ph-file',
      'note': 'ph-note',
      'email': 'ph-envelope',
      'message': 'ph-chat',
      'project': 'ph-folder',
      'product': 'ph-package',
      'order': 'ph-shopping-cart',
      'transaction': 'ph-currency-dollar',
      'payment': 'ph-credit-card',
      'location': 'ph-map-pin',
      'address': 'ph-map-pin',
      'contact': 'ph-address-book',
      'lead': 'ph-target',
      'opportunity': 'ph-lightning',
      'case': 'ph-briefcase',
      'ticket': 'ph-ticket',
      'issue': 'ph-warning',
      'bug': 'ph-bug'
    };

    for (const [key, icon] of Object.entries(iconMap)) {
      if (lower.includes(key)) return icon;
    }
    return 'ph-tag';
  }

  _escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}


// ============================================================================
// Exports
// ============================================================================

if (typeof window !== 'undefined') {
  window.SourceStore = SourceStore;
  window.SetCreator = SetCreator;
  window.JoinBuilder = JoinBuilder;
  window.JoinBuilderUI = JoinBuilderUI;
  window.SetFromSourceUI = SetFromSourceUI;
  window.DataPipelineUI = DataPipelineUI;
  window.FolderStore = FolderStore;
  window.AdvancedFilterBuilder = AdvancedFilterBuilder;
  window.SetJoinFilterCreator = SetJoinFilterCreator;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SourceStore,
    SetCreator,
    JoinBuilder,
    JoinBuilderUI,
    SetFromSourceUI,
    DataPipelineUI,
    FolderStore,
    AdvancedFilterBuilder,
    SetJoinFilterCreator
  };
}
