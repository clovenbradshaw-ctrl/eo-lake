/**
 * EO Interpretation Binding - Column to Semantic URI Bindings
 *
 * Implements the InterpretationBinding entity that links dataset columns
 * to semantic URIs with full interpretive context.
 *
 * EO PRINCIPLE:
 * "Interpretations reference meanings and datasets.
 *  Datasets never define meaning."
 *
 * Key concepts:
 * - InterpretationBinding is a MEANT entity (requires grounding)
 * - Links columns to versioned SchemaSemantic URIs
 * - Captures agent, method, and interpretive context
 * - All bindings are manual with explicit agent
 */

// ============================================================================
// Constants
// ============================================================================

const BindingMethod = Object.freeze({
  MANUAL_BINDING: 'manual_binding',       // User explicitly selected
  SUGGESTED_ACCEPTED: 'suggested_accepted', // User accepted suggestion
  IMPORTED: 'imported',                    // Came from EO-aware import
  INFERRED: 'inferred',                    // System inferred with confirmation
  MIGRATED: 'migrated'                     // Migrated from legacy system
});

const BindingConfidence = Object.freeze({
  HIGH: 'high',           // Strong match, user confirmed
  MEDIUM: 'medium',       // Reasonable match, some uncertainty
  LOW: 'low',             // Weak match, needs review
  PROVISIONAL: 'provisional' // Placeholder, not production ready
});

// ============================================================================
// ColumnBinding Class
// ============================================================================

/**
 * ColumnBinding - Single column to semantic URI mapping
 */
class ColumnBinding {
  /**
   * @param {Object} options
   * @param {string} options.column - Column name in dataset
   * @param {string} options.semantic_uri - Reference to SchemaSemantic ID
   * @param {string} options.confidence - BindingConfidence value
   * @param {string} options.notes - Optional interpretive notes
   */
  constructor(options = {}) {
    this.column = options.column || '';
    this.semantic_uri = options.semantic_uri || '';
    this.confidence = options.confidence || BindingConfidence.MEDIUM;
    this.notes = options.notes || null;

    // Field-level context (can override interpretation-level)
    this.field_jurisdiction = options.field_jurisdiction || null;
    this.field_scale = options.field_scale || null;
    this.field_timeframe = options.field_timeframe || null;
  }

  /**
   * Validate column binding
   */
  validate(availableSemantics = null) {
    const errors = [];

    if (!this.column || this.column.trim() === '') {
      errors.push('Column name is required');
    }

    if (!this.semantic_uri || this.semantic_uri.trim() === '') {
      errors.push('Semantic URI is required');
    }

    if (!Object.values(BindingConfidence).includes(this.confidence)) {
      errors.push(`Invalid confidence: ${this.confidence}`);
    }

    // Check if semantic exists in registry
    if (availableSemantics && !availableSemantics.has(this.semantic_uri)) {
      errors.push(`Semantic URI not found: ${this.semantic_uri}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  toJSON() {
    return {
      column: this.column,
      semantic_uri: this.semantic_uri,
      confidence: this.confidence,
      notes: this.notes,
      field_jurisdiction: this.field_jurisdiction,
      field_scale: this.field_scale,
      field_timeframe: this.field_timeframe
    };
  }

  static fromJSON(json) {
    return new ColumnBinding(json);
  }
}

// ============================================================================
// InterpretationBinding Class
// ============================================================================

/**
 * InterpretationBinding - Links dataset columns to semantic URIs
 *
 * This is a MEANT entity that captures:
 * - WHO interpreted (agent)
 * - HOW they interpreted (method)
 * - WHAT columns mean (bindings)
 * - UNDER what conditions (jurisdiction, scale, timeframe, background)
 */
class InterpretationBinding {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique binding ID
   * @param {string} options.agent - Who created this interpretation
   * @param {string} options.method - How binding was created
   * @param {string} options.source_dataset - Dataset ID being interpreted
   * @param {ColumnBinding[]} options.bindings - Array of column bindings
   * @param {string} options.jurisdiction - Authority context
   * @param {string} options.scale - Scope context
   * @param {string} options.timeframe - Temporal context
   * @param {string[]} options.background - Interpretive assumptions
   */
  constructor(options = {}) {
    // Identity
    this.id = options.id || generateBindingId(options.source_dataset);

    // Agent & Method (REQUIRED for EO compliance)
    this.agent = options.agent || null;
    this.method = options.method || BindingMethod.MANUAL_BINDING;

    // Dataset reference
    this.source_dataset = options.source_dataset || null;
    this.source_event_id = options.source_event_id || null;

    // Column bindings
    this.bindings = (options.bindings || []).map(b =>
      b instanceof ColumnBinding ? b : new ColumnBinding(b)
    );

    // Interpretation context (9-element provenance alignment)
    this.jurisdiction = options.jurisdiction || null;
    this.scale = options.scale || null;
    this.timeframe = options.timeframe || null;
    this.background = Array.isArray(options.background) ? [...options.background] : [];

    // Timestamps
    this.created_at = options.created_at || new Date().toISOString();
    this.updated_at = options.updated_at || new Date().toISOString();

    // Supersession (for revisions)
    this.supersedes = options.supersedes || null;
    this.superseded_by = options.superseded_by || null;

    // Status
    this.is_active = options.is_active !== false;
  }

  /**
   * Get bound columns
   */
  get boundColumns() {
    return this.bindings.map(b => b.column);
  }

  /**
   * Get binding for a specific column
   */
  getBindingForColumn(column) {
    return this.bindings.find(b => b.column === column) || null;
  }

  /**
   * Get semantic URI for a column
   */
  getSemanticForColumn(column) {
    const binding = this.getBindingForColumn(column);
    return binding ? binding.semantic_uri : null;
  }

  /**
   * Check if a column is bound
   */
  hasBindingForColumn(column) {
    return this.bindings.some(b => b.column === column);
  }

  /**
   * Add a column binding
   */
  addBinding(binding) {
    const columnBinding = binding instanceof ColumnBinding
      ? binding
      : new ColumnBinding(binding);

    // Check for existing binding
    const existingIdx = this.bindings.findIndex(b => b.column === columnBinding.column);
    if (existingIdx >= 0) {
      this.bindings[existingIdx] = columnBinding;
    } else {
      this.bindings.push(columnBinding);
    }

    this.updated_at = new Date().toISOString();
    return this;
  }

  /**
   * Remove a column binding
   */
  removeBinding(column) {
    this.bindings = this.bindings.filter(b => b.column !== column);
    this.updated_at = new Date().toISOString();
    return this;
  }

  /**
   * Update binding confidence
   */
  updateConfidence(column, confidence) {
    const binding = this.getBindingForColumn(column);
    if (binding) {
      binding.confidence = confidence;
      this.updated_at = new Date().toISOString();
    }
    return this;
  }

  /**
   * Check provenance completeness
   */
  get hasCompleteProvenance() {
    return !!(this.jurisdiction && this.scale && this.timeframe);
  }

  /**
   * Get provenance warnings
   */
  getProvenanceWarnings() {
    const warnings = [];
    if (!this.jurisdiction) warnings.push('jurisdiction_missing');
    if (!this.scale) warnings.push('scale_unspecified');
    if (!this.timeframe) warnings.push('timeframe_unspecified');
    if (this.background.length === 0) warnings.push('background_empty');
    return warnings;
  }

  /**
   * Create EO grounding for this interpretation
   */
  getGrounding() {
    const references = [];

    // Structural grounding from dataset
    if (this.source_event_id) {
      references.push({
        eventId: this.source_event_id,
        kind: 'structural'
      });
    }

    // Semantic grounding from each binding
    for (const binding of this.bindings) {
      references.push({
        eventId: binding.semantic_uri,
        kind: 'semantic'
      });
    }

    return {
      references,
      derivation: {
        operators: ['INTERPRET'],
        inputs: [this.source_dataset, ...this.bindings.map(b => b.semantic_uri)],
        frozenParams: {
          agent: this.agent,
          method: this.method
        }
      }
    };
  }

  /**
   * Convert to event payload
   */
  toEventPayload() {
    return {
      interpretation_id: this.id,
      agent: this.agent,
      method: this.method,
      source_dataset: this.source_dataset,
      bindings: this.bindings.map(b => b.toJSON()),
      jurisdiction: this.jurisdiction,
      scale: this.scale,
      timeframe: this.timeframe,
      background: [...this.background]
    };
  }

  /**
   * Convert to provenance format (for existing provenance system)
   */
  toProvenance(semanticRegistry = null) {
    // Get semantic details for the first binding (primary meaning)
    const primaryBinding = this.bindings[0];
    let term = null;
    let definition = null;

    if (primaryBinding && semanticRegistry) {
      const semantic = semanticRegistry.get(primaryBinding.semantic_uri);
      if (semantic) {
        term = semantic.term;
        definition = semantic.definition;
      }
    }

    return {
      agent: this.agent,
      method: this.method,
      source: this.source_dataset,
      term,
      definition,
      jurisdiction: this.jurisdiction,
      scale: this.scale,
      timeframe: this.timeframe,
      background: [...this.background]
    };
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      agent: this.agent,
      method: this.method,
      source_dataset: this.source_dataset,
      source_event_id: this.source_event_id,
      bindings: this.bindings.map(b => b.toJSON()),
      jurisdiction: this.jurisdiction,
      scale: this.scale,
      timeframe: this.timeframe,
      background: [...this.background],
      created_at: this.created_at,
      updated_at: this.updated_at,
      supersedes: this.supersedes,
      superseded_by: this.superseded_by,
      is_active: this.is_active
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json) {
    return new InterpretationBinding({
      ...json,
      bindings: (json.bindings || []).map(b => ColumnBinding.fromJSON(b))
    });
  }
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate binding ID
 */
function generateBindingId(datasetId = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  const prefix = datasetId ? datasetId.substring(0, 8) : 'interp';
  return `interp_${prefix}_${timestamp}${random}`;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate InterpretationBinding
 * @param {InterpretationBinding} binding
 * @param {Map<string, any>} semanticRegistry - Map of semantic URIs to check
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateInterpretationBinding(binding, semanticRegistry = null) {
  const errors = [];
  const warnings = [];

  // RULE I1: Agent is required
  if (!binding.agent || binding.agent.trim() === '') {
    errors.push('InterpretationBinding requires an agent');
  }

  // RULE I2: Source dataset is required
  if (!binding.source_dataset || binding.source_dataset.trim() === '') {
    errors.push('InterpretationBinding requires a source_dataset');
  }

  // RULE I3: Must have at least one binding
  if (!binding.bindings || binding.bindings.length === 0) {
    warnings.push('InterpretationBinding has no column bindings');
  }

  // RULE I4: Semantic URIs must resolve
  if (semanticRegistry && binding.bindings) {
    for (const b of binding.bindings) {
      if (!semanticRegistry.has(b.semantic_uri) &&
          !semanticRegistry.get?.(b.semantic_uri)) {
        errors.push(`Semantic URI not found: ${b.semantic_uri}`);
      }
    }
  }

  // RULE I5: No conflicting bindings (same column bound twice)
  const columnCounts = new Map();
  for (const b of binding.bindings || []) {
    const count = (columnCounts.get(b.column) || 0) + 1;
    columnCounts.set(b.column, count);
    if (count > 1) {
      errors.push(`Column has multiple conflicting bindings: ${b.column}`);
    }
  }

  // Validate method
  if (!Object.values(BindingMethod).includes(binding.method)) {
    warnings.push(`Unknown binding method: ${binding.method}`);
  }

  // Provenance warnings
  if (!binding.jurisdiction) warnings.push('jurisdiction_missing');
  if (!binding.scale) warnings.push('scale_unspecified');
  if (!binding.timeframe) warnings.push('timeframe_unspecified');
  if (binding.background.length === 0) warnings.push('background_empty');

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check for conflicting bindings in a list
 */
function checkConflictingBindings(bindings) {
  const conflicts = [];
  const seen = new Set();

  for (const binding of bindings) {
    if (seen.has(binding.column)) {
      conflicts.push(binding.column);
    }
    seen.add(binding.column);
  }

  return conflicts;
}

// ============================================================================
// Interpretation Binding Store
// ============================================================================

/**
 * InterpretationBindingStore - Manages all interpretation bindings
 */
class InterpretationBindingStore {
  constructor() {
    // Primary storage: id -> InterpretationBinding
    this._bindings = new Map();

    // Indexes
    this._byDataset = new Map();   // dataset_id -> Set<binding_id>
    this._byAgent = new Map();      // agent -> Set<binding_id>
    this._bySemantic = new Map();   // semantic_uri -> Set<binding_id>

    // Event listeners
    this._listeners = new Set();
  }

  /**
   * Get total count
   */
  get size() {
    return this._bindings.size;
  }

  /**
   * Add or update a binding
   */
  add(binding) {
    const isNew = !this._bindings.has(binding.id);

    // Remove from indexes if updating
    if (!isNew) {
      this._removeFromIndexes(this._bindings.get(binding.id));
    }

    // Store
    this._bindings.set(binding.id, binding);

    // Index
    this._addToIndexes(binding);

    // Notify listeners
    this._notify(isNew ? 'added' : 'updated', binding);

    return { success: true, id: binding.id, isNew };
  }

  /**
   * Get binding by ID
   */
  get(id) {
    return this._bindings.get(id) || null;
  }

  /**
   * Get all bindings
   */
  getAll() {
    return Array.from(this._bindings.values());
  }

  /**
   * Get active bindings only
   */
  getActive() {
    return this.getAll().filter(b => b.is_active);
  }

  /**
   * Get bindings for a dataset
   */
  getForDataset(datasetId) {
    const ids = this._byDataset.get(datasetId);
    if (!ids) return [];
    return Array.from(ids).map(id => this._bindings.get(id)).filter(Boolean);
  }

  /**
   * Get active binding for a dataset
   */
  getActiveForDataset(datasetId) {
    return this.getForDataset(datasetId).find(b => b.is_active) || null;
  }

  /**
   * Get bindings by agent
   */
  getByAgent(agent) {
    const ids = this._byAgent.get(agent);
    if (!ids) return [];
    return Array.from(ids).map(id => this._bindings.get(id)).filter(Boolean);
  }

  /**
   * Get bindings that use a semantic URI
   */
  getBySemantic(semanticUri) {
    const ids = this._bySemantic.get(semanticUri);
    if (!ids) return [];
    return Array.from(ids).map(id => this._bindings.get(id)).filter(Boolean);
  }

  /**
   * Find unbound columns in a dataset
   */
  findUnboundColumns(datasetId, allColumns) {
    const binding = this.getActiveForDataset(datasetId);
    if (!binding) return [...allColumns];

    const boundColumns = new Set(binding.boundColumns);
    return allColumns.filter(col => !boundColumns.has(col));
  }

  /**
   * Create superseding binding
   */
  supersede(oldBindingId, newBinding) {
    const oldBinding = this._bindings.get(oldBindingId);
    if (!oldBinding) {
      throw new Error(`Binding not found: ${oldBindingId}`);
    }

    // Mark old as superseded
    oldBinding.is_active = false;
    oldBinding.superseded_by = newBinding.id;
    oldBinding.updated_at = new Date().toISOString();

    // Mark new as superseding
    newBinding.supersedes = oldBindingId;
    newBinding.is_active = true;

    // Add new binding
    this.add(newBinding);

    // Notify
    this._notify('superseded', { old: oldBinding, new: newBinding });

    return newBinding;
  }

  /**
   * Delete a binding
   */
  delete(id) {
    const binding = this._bindings.get(id);
    if (!binding) return false;

    this._removeFromIndexes(binding);
    this._bindings.delete(id);
    this._notify('deleted', binding);

    return true;
  }

  /**
   * Export store to JSON
   */
  export() {
    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      count: this._bindings.size,
      bindings: Array.from(this._bindings.values()).map(b => b.toJSON())
    };
  }

  /**
   * Import from JSON
   */
  import(data) {
    const errors = [];
    let imported = 0;

    const bindings = data.bindings || data;
    for (const item of (Array.isArray(bindings) ? bindings : [])) {
      try {
        const binding = InterpretationBinding.fromJSON(item);
        this.add(binding);
        imported++;
      } catch (e) {
        errors.push(`Failed to import ${item.id}: ${e.message}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Clear store
   */
  clear() {
    this._bindings.clear();
    this._byDataset.clear();
    this._byAgent.clear();
    this._bySemantic.clear();
  }

  /**
   * Subscribe to changes
   */
  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────

  _addToIndexes(binding) {
    const id = binding.id;

    // By dataset
    if (binding.source_dataset) {
      if (!this._byDataset.has(binding.source_dataset)) {
        this._byDataset.set(binding.source_dataset, new Set());
      }
      this._byDataset.get(binding.source_dataset).add(id);
    }

    // By agent
    if (binding.agent) {
      if (!this._byAgent.has(binding.agent)) {
        this._byAgent.set(binding.agent, new Set());
      }
      this._byAgent.get(binding.agent).add(id);
    }

    // By semantic URI
    for (const b of binding.bindings) {
      if (!this._bySemantic.has(b.semantic_uri)) {
        this._bySemantic.set(b.semantic_uri, new Set());
      }
      this._bySemantic.get(b.semantic_uri).add(id);
    }
  }

  _removeFromIndexes(binding) {
    const id = binding.id;

    // By dataset
    this._byDataset.get(binding.source_dataset)?.delete(id);

    // By agent
    this._byAgent.get(binding.agent)?.delete(id);

    // By semantic URI
    for (const b of binding.bindings) {
      this._bySemantic.get(b.semantic_uri)?.delete(id);
    }
  }

  _notify(event, data) {
    for (const listener of this._listeners) {
      try {
        listener(event, data);
      } catch (e) {
        console.error('Binding store listener error:', e);
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create interpretation binding
 */
function createInterpretationBinding(options) {
  return new InterpretationBinding(options);
}

/**
 * Create column binding
 */
function createColumnBinding(column, semanticUri, options = {}) {
  return new ColumnBinding({
    column,
    semantic_uri: semanticUri,
    ...options
  });
}

/**
 * Create interpretation from EO-aware import
 */
function createInterpretationFromImport(importData, datasetId, eventId) {
  const interpretation = importData.interpretation;
  if (!interpretation) return null;

  return new InterpretationBinding({
    id: interpretation.id || generateBindingId(datasetId),
    agent: interpretation.agent,
    method: interpretation.method || BindingMethod.IMPORTED,
    source_dataset: datasetId,
    source_event_id: eventId,
    bindings: (interpretation.bindings || []).map(b => new ColumnBinding(b)),
    jurisdiction: interpretation.jurisdiction,
    scale: interpretation.scale,
    timeframe: interpretation.timeframe,
    background: interpretation.background || []
  });
}

// ============================================================================
// Dataset Semantic Metadata
// ============================================================================

/**
 * DatasetSemanticMetadata - Links stored on dataset for quick access
 */
class DatasetSemanticMetadata {
  /**
   * @param {Object} options
   * @param {string} options.dataset_id
   * @param {Object.<string, ColumnSemanticRef>} options.columns
   */
  constructor(options = {}) {
    this.dataset_id = options.dataset_id || null;
    this.columns = options.columns || {};
    this.interpretation_id = options.interpretation_id || null;
    this.updated_at = options.updated_at || new Date().toISOString();
  }

  /**
   * Get semantic ref for column
   */
  getColumnRef(column) {
    return this.columns[column] || null;
  }

  /**
   * Set column semantic ref
   */
  setColumnRef(column, semanticUri, interpretationId) {
    this.columns[column] = {
      semantic_ref: semanticUri,
      interpretation_ref: interpretationId
    };
    this.updated_at = new Date().toISOString();
  }

  /**
   * Remove column ref
   */
  removeColumnRef(column) {
    delete this.columns[column];
    this.updated_at = new Date().toISOString();
  }

  /**
   * Build from interpretation binding
   */
  static fromBinding(binding) {
    const metadata = new DatasetSemanticMetadata({
      dataset_id: binding.source_dataset,
      interpretation_id: binding.id
    });

    for (const b of binding.bindings) {
      metadata.columns[b.column] = {
        semantic_ref: b.semantic_uri,
        interpretation_ref: binding.id
      };
    }

    return metadata;
  }

  toJSON() {
    return {
      dataset_id: this.dataset_id,
      columns: { ...this.columns },
      interpretation_id: this.interpretation_id,
      updated_at: this.updated_at
    };
  }
}

// ============================================================================
// Singleton Store
// ============================================================================

let _bindingStore = null;

function getBindingStore() {
  if (!_bindingStore) {
    _bindingStore = new InterpretationBindingStore();
  }
  return _bindingStore;
}

function initBindingStore(options = {}) {
  _bindingStore = new InterpretationBindingStore();
  return _bindingStore;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BindingMethod,
    BindingConfidence,
    ColumnBinding,
    InterpretationBinding,
    InterpretationBindingStore,
    DatasetSemanticMetadata,
    generateBindingId,
    validateInterpretationBinding,
    checkConflictingBindings,
    createInterpretationBinding,
    createColumnBinding,
    createInterpretationFromImport,
    getBindingStore,
    initBindingStore
  };
}

if (typeof window !== 'undefined') {
  window.EOInterpretationBinding = {
    BindingMethod,
    BindingConfidence,
    ColumnBinding,
    InterpretationBinding,
    InterpretationBindingStore,
    DatasetSemanticMetadata,
    generateBindingId,
    validateInterpretationBinding,
    checkConflictingBindings,
    createInterpretationBinding,
    createColumnBinding,
    createInterpretationFromImport,
    getBindingStore,
    initBindingStore
  };
}
