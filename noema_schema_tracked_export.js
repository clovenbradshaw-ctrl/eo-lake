/**
 * EO Schema-Tracked Export - Exports with Full Semantic Layer
 *
 * This module implements the Schema-Tracked Export format that captures:
 * 1. Data snapshot
 * 2. Field (key) definitions with usage history
 * 3. Value definitions (vocabularies) with usage history
 * 4. Binding provenance for both keys and values
 * 5. Transformation/modification history (provenance-tracked)
 *
 * DESIGN PRINCIPLES:
 * 1. Temporal Navigation - Support time-travel through data history
 * 2. Dual-Layer Semantics - Both keys and values have definitions
 * 3. Provenance on Demand - Every cell exposes its history
 * 4. Definition-First Navigation - Browse data through semantic lens
 * 5. Transformation Replay - Step through modification history
 * 6. Integrity Verification - Verify export wasn't tampered with
 * 7. Layered Disclosure - Progressive complexity disclosure
 * 8. Cross-Export Linking - Show how multiple exports relate
 */

// ============================================================================
// Export Format Version
// ============================================================================

const SCHEMA_TRACKED_VERSION = '1.0.0';
const PROVENANCE_TRACKED_VERSION = '1.0.0';

// ============================================================================
// Transformation Types
// ============================================================================

const TransformationType = Object.freeze({
  // Data entry
  SCHEMA_INFERENCE: 'schema_inference',
  RECORD_CREATED: 'record_created',
  RECORD_UPDATED: 'record_updated',
  RECORD_DELETED: 'record_deleted',

  // Schema changes
  FIELD_ADDED: 'field_added',
  FIELD_REMOVED: 'field_removed',
  FIELD_RENAMED: 'field_renamed',
  FIELD_TYPE_CHANGED: 'field_type_changed',

  // Semantic binding
  FIELD_BOUND: 'field_bound',
  FIELD_UNBOUND: 'field_unbound',
  VALUE_VOCABULARY_BOUND: 'value_vocabulary_bound',

  // Structure
  LENS_CREATED: 'lens_created',
  LENS_UPDATED: 'lens_updated',
  VIEW_CREATED: 'view_created',
  VIEW_UPDATED: 'view_updated',

  // Definition changes
  DEFINITION_CREATED: 'definition_created',
  DEFINITION_UPDATED: 'definition_updated',
  VOCABULARY_VALUE_ADDED: 'vocabulary_value_added',
  VOCABULARY_VALUE_DEPRECATED: 'vocabulary_value_deprecated'
});

// ============================================================================
// SchemaTrackedExport Class
// ============================================================================

/**
 * SchemaTrackedExport - Complete export with semantic layer
 */
class SchemaTrackedExport {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    // Metadata
    this.meta = {
      id: options.id || `export_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
      format: 'schema-tracked',
      version: SCHEMA_TRACKED_VERSION,
      exportedAt: options.exportedAt || new Date().toISOString(),
      exportedBy: options.exportedBy || null,
      workspaceId: options.workspaceId || null
    };

    // Data snapshot
    this.data = options.data || {
      setId: null,
      setName: null,
      recordCount: 0,
      records: []
    };

    // Schema with field definitions
    this.schema = options.schema || {
      fields: []
    };

    // Field (key) definitions
    this.fieldDefinitions = options.fieldDefinitions || {};

    // Value vocabularies
    this.valueDefinitions = options.valueDefinitions || {};

    // Binding provenance
    this.bindingProvenance = options.bindingProvenance || {
      fields: {},
      valueVocabularies: {}
    };

    // Definition timeline (evolution of definitions)
    this.definitionTimeline = options.definitionTimeline || [];

    // Value change log
    this.valueChangeLog = options.valueChangeLog || [];

    // Verification hashes
    this.verification = options.verification || null;
  }

  /**
   * Add a field definition
   */
  addFieldDefinition(fieldId, definition) {
    this.fieldDefinitions[fieldId] = {
      semanticUri: definition.semanticUri || definition.id,
      term: definition.term,
      definition: definition.definition,
      version: definition.version || 1,
      status: definition.status || 'active',
      jurisdiction: definition.jurisdiction,
      scale: definition.scale,
      timeframe: definition.timeframe,
      background: definition.background || [],
      usageHistory: definition.usageHistory || [],
      valueVocabularyUri: definition.valueVocabularyUri || null
    };
    return this;
  }

  /**
   * Add a value vocabulary
   */
  addValueVocabulary(vocabularyUri, vocabulary) {
    this.valueDefinitions[vocabularyUri] = {
      vocabularyId: vocabulary.id,
      name: vocabulary.name,
      description: vocabulary.description,
      version: vocabulary.version,
      maintainer: vocabulary.maintainer,
      externalSource: vocabulary.externalSource,
      values: vocabulary.values || {},
      vocabularyHistory: vocabulary.vocabularyHistory || [],
      usageHistory: vocabulary.usageHistory || []
    };
    return this;
  }

  /**
   * Record field binding provenance
   */
  recordFieldBinding(fieldId, bindingHistory) {
    this.bindingProvenance.fields[fieldId] = {
      currentUri: bindingHistory.currentUri,
      history: bindingHistory.history || []
    };
    return this;
  }

  /**
   * Record value vocabulary binding provenance
   */
  recordVocabularyBinding(fieldId, bindingHistory) {
    this.bindingProvenance.valueVocabularies[fieldId] = {
      currentVocabularyUri: bindingHistory.currentVocabularyUri,
      history: bindingHistory.history || []
    };
    return this;
  }

  /**
   * Add to definition timeline
   */
  addToDefinitionTimeline(uri, events) {
    this.definitionTimeline.push({
      uri,
      events: events || []
    });
    return this;
  }

  /**
   * Add value change log entry
   */
  addValueChange(change) {
    this.valueChangeLog.push({
      id: change.id || `vcl_${Date.now().toString(36)}`,
      timestamp: change.timestamp || new Date().toISOString(),
      recordId: change.recordId,
      fieldId: change.fieldId,
      previousValue: change.previousValue,
      previousValueUri: change.previousValueUri,
      newValue: change.newValue,
      newValueUri: change.newValueUri,
      agent: change.agent,
      reason: change.reason,
      epistemicType: change.epistemicType || 'MEANT'
    });
    return this;
  }

  /**
   * Compute verification hashes
   */
  computeVerification() {
    // Simple hash function for demonstration
    const simpleHash = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return 'hash_' + Math.abs(hash).toString(16);
    };

    this.verification = {
      dataHash: simpleHash(JSON.stringify(this.data)),
      schemaHash: simpleHash(JSON.stringify(this.schema)),
      definitionsHash: simpleHash(JSON.stringify(this.fieldDefinitions)),
      vocabulariesHash: simpleHash(JSON.stringify(this.valueDefinitions)),
      computedAt: new Date().toISOString()
    };

    return this;
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    return {
      recordCount: this.data.recordCount,
      fieldCount: this.schema.fields.length,
      definedFieldCount: Object.keys(this.fieldDefinitions).length,
      vocabularyCount: Object.keys(this.valueDefinitions).length,
      valueChangeCount: this.valueChangeLog.length,
      hasVerification: this.verification !== null
    };
  }

  toJSON() {
    return {
      meta: { ...this.meta },
      data: { ...this.data },
      schema: { ...this.schema },
      fieldDefinitions: { ...this.fieldDefinitions },
      valueDefinitions: { ...this.valueDefinitions },
      bindingProvenance: { ...this.bindingProvenance },
      definitionTimeline: [...this.definitionTimeline],
      valueChangeLog: [...this.valueChangeLog],
      verification: this.verification ? { ...this.verification } : null
    };
  }

  static fromJSON(json) {
    return new SchemaTrackedExport(json);
  }
}

// ============================================================================
// ProvenanceTrackedExport Class
// ============================================================================

/**
 * ProvenanceTrackedExport - Full modification history export
 */
class ProvenanceTrackedExport extends SchemaTrackedExport {
  constructor(options = {}) {
    super(options);

    // Override format
    this.meta.format = 'provenance-tracked';
    this.meta.version = PROVENANCE_TRACKED_VERSION;

    // Origin (GIVEN data)
    this.origin = options.origin || {
      sourceId: null,
      sourceType: null,
      importedAt: null,
      importedBy: null,
      originalFilename: null,
      originalHash: null,
      rawSchema: [],
      rawRecordCount: 0,
      rawData: null  // Optional: embed raw data
    };

    // Transformation chain
    this.transformations = options.transformations || [];

    // Current state (result of transformations)
    this.currentState = options.currentState || {
      setId: null,
      setName: null,
      fields: [],
      records: [],
      lenses: [],
      views: []
    };

    // Derivation graph
    this.derivationGraph = options.derivationGraph || {
      nodes: [],
      edges: []
    };

    // Supersession log
    this.supersessions = options.supersessions || [];
  }

  /**
   * Set origin data
   */
  setOrigin(origin) {
    this.origin = {
      sourceId: origin.sourceId || origin.id,
      sourceType: origin.sourceType || origin.type,
      importedAt: origin.importedAt || origin.createdAt,
      importedBy: origin.importedBy || origin.actor,
      originalFilename: origin.originalFilename || origin.filename,
      originalHash: origin.originalHash || null,
      rawSchema: origin.rawSchema || [],
      rawRecordCount: origin.rawRecordCount || 0,
      rawData: origin.rawData || null
    };
    return this;
  }

  /**
   * Add a transformation
   */
  addTransformation(transformation) {
    this.transformations.push({
      id: transformation.id || `tx_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: transformation.timestamp || new Date().toISOString(),
      type: transformation.type,
      epistemicType: transformation.epistemicType || 'MEANT',
      agent: transformation.agent,
      input: transformation.input || {},
      output: transformation.output || {},
      details: transformation.details || {}
    });
    return this;
  }

  /**
   * Set current state
   */
  setCurrentState(state) {
    this.currentState = {
      setId: state.setId || state.id,
      setName: state.setName || state.name,
      fields: state.fields || [],
      records: state.records || [],
      lenses: (state.lenses || []).map(l => ({
        id: l.id,
        name: l.name,
        recordCount: l.recordCount || 0
      })),
      views: (state.views || []).map(v => ({
        id: v.id,
        name: v.name,
        type: v.type
      }))
    };
    return this;
  }

  /**
   * Add derivation graph node
   */
  addGraphNode(node) {
    this.derivationGraph.nodes.push({
      id: node.id,
      type: node.type,
      epistemicType: node.epistemicType,
      label: node.label || node.name
    });
    return this;
  }

  /**
   * Add derivation graph edge
   */
  addGraphEdge(edge) {
    this.derivationGraph.edges.push({
      from: edge.from,
      to: edge.to,
      relation: edge.relation,
      transformationId: edge.transformationId
    });
    return this;
  }

  /**
   * Add supersession
   */
  addSupersession(supersession) {
    this.supersessions.push({
      id: supersession.id || `sup_${Date.now().toString(36)}`,
      timestamp: supersession.timestamp || new Date().toISOString(),
      type: supersession.type,
      supersededEvent: supersession.supersededEvent,
      supersedingEvent: supersession.supersedingEvent,
      agent: supersession.agent,
      reason: supersession.reason
    });
    return this;
  }

  /**
   * Build derivation graph from transformations
   */
  buildDerivationGraph() {
    // Clear existing graph
    this.derivationGraph = { nodes: [], edges: [] };

    // Add origin as first node
    if (this.origin.sourceId) {
      this.addGraphNode({
        id: this.origin.sourceId,
        type: 'SOURCE',
        epistemicType: 'GIVEN',
        label: this.origin.originalFilename || 'Source'
      });
    }

    // Track created entities
    const entities = new Map();
    entities.set(this.origin.sourceId, 'SOURCE');

    // Process transformations
    for (const tx of this.transformations) {
      // Add output entity as node if new
      if (tx.output.setId && !entities.has(tx.output.setId)) {
        this.addGraphNode({
          id: tx.output.setId,
          type: 'SET',
          epistemicType: 'MEANT',
          label: tx.output.setName || 'Set'
        });
        entities.set(tx.output.setId, 'SET');
      }

      if (tx.output.lensId && !entities.has(tx.output.lensId)) {
        this.addGraphNode({
          id: tx.output.lensId,
          type: 'LENS',
          epistemicType: 'MEANT',
          label: tx.output.lensName || 'Lens'
        });
        entities.set(tx.output.lensId, 'LENS');
      }

      if (tx.output.viewId && !entities.has(tx.output.viewId)) {
        this.addGraphNode({
          id: tx.output.viewId,
          type: 'VIEW',
          epistemicType: 'MEANT',
          label: tx.output.viewName || 'View'
        });
        entities.set(tx.output.viewId, 'VIEW');
      }

      // Add edges based on transformation type
      if (tx.input.sourceId && tx.output.setId) {
        this.addGraphEdge({
          from: tx.input.sourceId,
          to: tx.output.setId,
          relation: 'derived_from',
          transformationId: tx.id
        });
      }

      if (tx.input.setId && tx.output.lensId) {
        this.addGraphEdge({
          from: tx.input.setId,
          to: tx.output.lensId,
          relation: 'scoped_by',
          transformationId: tx.id
        });
      }

      if (tx.input.lensId && tx.output.viewId) {
        this.addGraphEdge({
          from: tx.input.lensId,
          to: tx.output.viewId,
          relation: 'visualized_as',
          transformationId: tx.id
        });
      }
    }

    return this;
  }

  /**
   * Get transformation at a specific point in time
   */
  getStateAtTime(timestamp) {
    const applicableTransformations = this.transformations.filter(
      tx => tx.timestamp <= timestamp
    );

    return {
      timestamp,
      transformationCount: applicableTransformations.length,
      lastTransformation: applicableTransformations[applicableTransformations.length - 1] || null
    };
  }

  /**
   * Get transformation history for a specific record
   */
  getRecordHistory(recordId) {
    return this.transformations.filter(tx =>
      tx.input.recordId === recordId ||
      tx.output.recordId === recordId ||
      tx.details?.recordId === recordId
    );
  }

  /**
   * Get transformation history for a specific field
   */
  getFieldHistory(fieldId) {
    return this.transformations.filter(tx =>
      tx.input.fieldId === fieldId ||
      tx.output.fieldId === fieldId ||
      tx.details?.fieldId === fieldId
    );
  }

  toJSON() {
    return {
      ...super.toJSON(),
      origin: { ...this.origin },
      transformations: [...this.transformations],
      currentState: { ...this.currentState },
      derivationGraph: {
        nodes: [...this.derivationGraph.nodes],
        edges: [...this.derivationGraph.edges]
      },
      supersessions: [...this.supersessions]
    };
  }

  static fromJSON(json) {
    return new ProvenanceTrackedExport(json);
  }
}

// ============================================================================
// SchemaTrackedExporter - Creates exports from workbench data
// ============================================================================

class SchemaTrackedExporter {
  /**
   * Create a schema-tracked export from a set
   *
   * @param {Object} set - The set to export
   * @param {Object} options - Export options
   * @returns {SchemaTrackedExport}
   */
  static createExport(set, options = {}) {
    const exp = new SchemaTrackedExport({
      exportedBy: options.agent || 'user',
      workspaceId: options.workspaceId
    });

    // Set data
    exp.data = {
      setId: set.id,
      setName: set.name,
      recordCount: set.records?.length || 0,
      records: (set.records || []).map(r => ({
        id: r.id,
        values: { ...r.values },
        _lensIds: r._lensIds || []
      }))
    };

    // Schema
    exp.schema = {
      fields: (set.fields || []).map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        width: f.width,
        isPrimary: f.isPrimary,
        options: f.options || {},
        semanticBinding: f.semanticBinding || null
      }))
    };

    // Get semantic registry and binding store
    const semanticRegistry = window.EOSchemaSemantic?.getSemanticRegistry();
    const bindingStore = window.EOInterpretationBinding?.getBindingStore();
    const vocabRegistry = window.EOValueVocabulary?.getVocabularyRegistry();

    // Get interpretation binding for this set
    const binding = bindingStore?.getActiveForDataset(set.id);

    // Add field definitions from bindings
    if (binding && semanticRegistry) {
      for (const b of binding.bindings) {
        const semantic = semanticRegistry.get(b.semantic_uri);
        if (semantic) {
          exp.addFieldDefinition(b.column, {
            semanticUri: b.semantic_uri,
            term: semantic.term,
            definition: semantic.definition,
            version: semantic.version,
            status: semantic.status,
            jurisdiction: semantic.jurisdiction || binding.jurisdiction,
            scale: semantic.scale || binding.scale,
            timeframe: semantic.timeframe || binding.timeframe,
            background: semantic.background || [],
            usageHistory: [{
              timestamp: binding.created_at,
              action: 'bound',
              fieldId: b.column,
              setId: set.id,
              agent: binding.agent,
              context: { confidence: b.confidence }
            }]
          });

          // Record binding provenance
          exp.recordFieldBinding(b.column, {
            currentUri: b.semantic_uri,
            history: [{
              timestamp: binding.created_at,
              action: 'bound',
              uri: b.semantic_uri,
              confidence: b.confidence,
              method: binding.method,
              agent: binding.agent
            }]
          });
        }
      }
    }

    // Add value vocabularies for SELECT/MULTI_SELECT fields
    if (vocabRegistry) {
      for (const field of set.fields || []) {
        if (field.type === 'SELECT' || field.type === 'MULTI_SELECT') {
          const vocab = vocabRegistry.getVocabularyForField(field.id);
          if (vocab) {
            exp.addValueVocabulary(vocab.uri, vocab.toJSON());
            exp.recordVocabularyBinding(field.id, {
              currentVocabularyUri: vocab.uri,
              history: [{
                timestamp: vocab.createdAt,
                action: 'vocabulary_bound',
                vocabularyUri: vocab.uri,
                method: 'inferred_from_options',
                agent: vocab.createdBy
              }]
            });

            // Link field definition to vocabulary
            if (exp.fieldDefinitions[field.id]) {
              exp.fieldDefinitions[field.id].valueVocabularyUri = vocab.uri;
            }
          } else if (field.options?.length > 0) {
            // Create vocabulary from field options
            const vocabUri = `eo://vocabulary/field/${field.id}`;
            const values = {};

            for (const opt of field.options) {
              const value = typeof opt === 'string' ? opt : opt.value || opt.name;
              values[value] = {
                value,
                term: value,
                definition: typeof opt === 'object' ? opt.description || '' : '',
                status: 'active'
              };
            }

            exp.addValueVocabulary(vocabUri, {
              id: `vocab_${field.id}`,
              name: `${field.name} Values`,
              description: `Controlled vocabulary for ${field.name} field`,
              version: 1,
              values
            });

            exp.recordVocabularyBinding(field.id, {
              currentVocabularyUri: vocabUri,
              history: [{
                timestamp: new Date().toISOString(),
                action: 'vocabulary_bound',
                vocabularyUri: vocabUri,
                method: 'inferred_from_options',
                agent: 'system'
              }]
            });
          }
        }
      }
    }

    // Compute verification
    exp.computeVerification();

    return exp;
  }

  /**
   * Create a provenance-tracked export from a set with full history
   *
   * @param {Object} set - The set to export
   * @param {Object} source - The source the set is derived from
   * @param {Object} options - Export options
   * @returns {ProvenanceTrackedExport}
   */
  static createProvenanceExport(set, source, options = {}) {
    const exp = new ProvenanceTrackedExport({
      exportedBy: options.agent || 'user',
      workspaceId: options.workspaceId
    });

    // Copy all schema-tracked data first
    const schemaExport = SchemaTrackedExporter.createExport(set, options);
    exp.data = schemaExport.data;
    exp.schema = schemaExport.schema;
    exp.fieldDefinitions = schemaExport.fieldDefinitions;
    exp.valueDefinitions = schemaExport.valueDefinitions;
    exp.bindingProvenance = schemaExport.bindingProvenance;

    // Set origin
    if (source) {
      exp.setOrigin({
        sourceId: source.id,
        sourceType: source.type || 'file',
        importedAt: source.createdAt,
        importedBy: source.actor || 'user',
        originalFilename: source.filename || source.name,
        rawSchema: source.rawSchema || [],
        rawRecordCount: source.recordCount || source.records?.length || 0
      });
    }

    // Add transformation for source -> set
    exp.addTransformation({
      type: TransformationType.SCHEMA_INFERENCE,
      epistemicType: 'MEANT',
      agent: 'system',
      input: { sourceId: source?.id },
      output: { setId: set.id, setName: set.name },
      details: {
        fieldsCreated: set.fields?.map(f => ({
          id: f.id,
          name: f.name,
          inferredType: f.type
        })) || [],
        recordsMapped: set.records?.length || 0
      }
    });

    // Add transformations for lenses
    for (const lens of (set.lenses || [])) {
      exp.addTransformation({
        type: TransformationType.LENS_CREATED,
        epistemicType: 'MEANT',
        agent: lens.createdBy || 'user',
        input: { setId: set.id },
        output: { lensId: lens.id, lensName: lens.name },
        details: {
          selector: lens.selector,
          recordsIncluded: lens.recordCount || 0
        }
      });
    }

    // Set current state
    exp.setCurrentState({
      setId: set.id,
      setName: set.name,
      fields: set.fields || [],
      records: set.records || [],
      lenses: set.lenses || [],
      views: set.views || []
    });

    // Build derivation graph
    exp.buildDerivationGraph();

    // Compute verification
    exp.computeVerification();

    return exp;
  }

  /**
   * Export to JSON blob for download
   */
  static toBlob(exportData, pretty = true) {
    const json = pretty
      ? JSON.stringify(exportData.toJSON(), null, 2)
      : JSON.stringify(exportData.toJSON());

    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Download export
   */
  static download(exportData, filename) {
    const blob = SchemaTrackedExporter.toBlob(exportData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${exportData.data.setName || 'export'}_schema-tracked.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// ============================================================================
// SchemaTrackedImporter - Loads exports back into workbench
// ============================================================================

class SchemaTrackedImporter {
  /**
   * Parse a schema-tracked export file
   *
   * @param {string|Object} data - JSON string or parsed object
   * @returns {SchemaTrackedExport|ProvenanceTrackedExport}
   */
  static parse(data) {
    const json = typeof data === 'string' ? JSON.parse(data) : data;

    if (json.meta?.format === 'provenance-tracked') {
      return ProvenanceTrackedExport.fromJSON(json);
    }

    return SchemaTrackedExport.fromJSON(json);
  }

  /**
   * Verify export integrity
   *
   * @param {SchemaTrackedExport} exportData
   * @returns {Object} Verification result
   */
  static verify(exportData) {
    if (!exportData.verification) {
      return { valid: false, error: 'No verification data' };
    }

    // Recompute hashes
    const simpleHash = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return 'hash_' + Math.abs(hash).toString(16);
    };

    const currentDataHash = simpleHash(JSON.stringify(exportData.data));
    const currentSchemaHash = simpleHash(JSON.stringify(exportData.schema));

    const dataMatch = currentDataHash === exportData.verification.dataHash;
    const schemaMatch = currentSchemaHash === exportData.verification.schemaHash;

    return {
      valid: dataMatch && schemaMatch,
      dataMatch,
      schemaMatch,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Import definitions into registries
   *
   * @param {SchemaTrackedExport} exportData
   * @returns {Object} Import results
   */
  static importDefinitions(exportData) {
    const results = {
      semanticsImported: 0,
      vocabulariesImported: 0,
      errors: []
    };

    // Import field definitions into semantic registry
    const semanticRegistry = window.EOSchemaSemantic?.getSemanticRegistry();
    if (semanticRegistry) {
      for (const [fieldId, def] of Object.entries(exportData.fieldDefinitions)) {
        try {
          const semantic = new window.EOSchemaSemantic.SchemaSemantic({
            id: def.semanticUri,
            term: def.term,
            definition: def.definition,
            version: def.version,
            status: def.status,
            jurisdiction: def.jurisdiction,
            scale: def.scale,
            timeframe: def.timeframe,
            background: def.background
          });
          semanticRegistry.add(semantic);
          results.semanticsImported++;
        } catch (e) {
          results.errors.push(`Failed to import semantic for ${fieldId}: ${e.message}`);
        }
      }
    }

    // Import value vocabularies
    const vocabRegistry = window.EOValueVocabulary?.getVocabularyRegistry();
    if (vocabRegistry) {
      for (const [uri, vocab] of Object.entries(exportData.valueDefinitions)) {
        try {
          vocabRegistry.add({
            ...vocab,
            uri
          });
          results.vocabulariesImported++;
        } catch (e) {
          results.errors.push(`Failed to import vocabulary ${uri}: ${e.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Load export data as a new set
   *
   * @param {SchemaTrackedExport} exportData
   * @param {Function} createSet - Function to create a set in the workbench
   * @returns {Object} The created set
   */
  static loadAsSet(exportData, createSet) {
    // First import definitions
    const importResults = SchemaTrackedImporter.importDefinitions(exportData);

    // Create the set
    const set = createSet({
      name: exportData.data.setName + ' (imported)',
      fields: exportData.schema.fields,
      records: exportData.data.records
    });

    return {
      set,
      importResults
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SCHEMA_TRACKED_VERSION,
    PROVENANCE_TRACKED_VERSION,
    TransformationType,
    SchemaTrackedExport,
    ProvenanceTrackedExport,
    SchemaTrackedExporter,
    SchemaTrackedImporter
  };
}

if (typeof window !== 'undefined') {
  window.EOSchemaTrackedExport = {
    SCHEMA_TRACKED_VERSION,
    PROVENANCE_TRACKED_VERSION,
    TransformationType,
    SchemaTrackedExport,
    ProvenanceTrackedExport,
    SchemaTrackedExporter,
    SchemaTrackedImporter
  };

  // Also export directly for convenience
  window.SchemaTrackedExport = SchemaTrackedExport;
  window.ProvenanceTrackedExport = ProvenanceTrackedExport;
  window.SchemaTrackedExporter = SchemaTrackedExporter;
  window.SchemaTrackedImporter = SchemaTrackedImporter;
}
