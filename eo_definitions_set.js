/**
 * EO Definitions Set - System Set Infrastructure for Column Definitions
 *
 * This module provides:
 * 1. Definitions Set creation and management (definitions as records, not metadata)
 * 2. Key → Definition linking with reciprocal tracking
 * 3. Disambiguation infrastructure for homonyms, synonyms, and contextual meanings
 *
 * Per COLUMN_DEFINITIONS_DESIGN.md:
 * - Definitions are RECORDS in a special "Definitions" Set
 * - Fields link to definition records via definition_id
 * - Definitions track which fields use them (reciprocal linking)
 */

// ============================================================================
// SECTION I: Constants and Schema
// ============================================================================

/**
 * System Set ID for definitions
 */
const DEFINITIONS_SET_ID = 'set_definitions';

/**
 * Disambiguation types - why disambiguation is needed
 */
const DisambiguationType = Object.freeze({
  HOMONYM: 'homonym',           // Same key, different meanings (e.g., "rate")
  SYNONYM: 'synonym',           // Different keys, same meaning (e.g., "temp" vs "temperature")
  CONTEXTUAL: 'contextual',     // Meaning changes by context (e.g., "value" in accounting vs catalog)
  NONE: 'none'                  // No disambiguation needed
});

/**
 * Disambiguation resolution methods
 */
const DisambiguationMethod = Object.freeze({
  AUTO_HIGH_CONFIDENCE: 'auto_high_confidence',  // System auto-resolved with high confidence
  USER_SELECTION: 'user_selection',              // User explicitly chose
  CONTEXT_INFERENCE: 'context_inference',        // Inferred from sibling fields/domain
  DEFAULT_FIRST: 'default_first'                 // Defaulted to first/best match
});

/**
 * Definition role types (semantic role of the field)
 */
const DefinitionRole = Object.freeze({
  QUANTITY: 'quantity',         // Measurable value (temperature, count, amount)
  PROPERTY: 'property',         // Descriptive attribute (color, status, type)
  IDENTIFIER: 'identifier',     // Unique key (id, code, reference)
  TEMPORAL: 'temporal',         // Time-related (date, timestamp, period)
  SPATIAL: 'spatial',           // Location-related (address, coordinates, region)
  CATEGORICAL: 'categorical',   // Classification (category, tag, group)
  TEXTUAL: 'textual'            // Free-form text (name, description, notes)
});

/**
 * Schema for the Definitions Set
 */
const DEFINITIONS_SET_SCHEMA = {
  fields: [
    { id: 'fld_def_term', name: 'Term', type: 'text', isPrimary: true },
    { id: 'fld_def_label', name: 'Label', type: 'text' },
    { id: 'fld_def_meaning_uri', name: 'Meaning URI', type: 'url' },
    { id: 'fld_def_definition', name: 'Definition', type: 'longText' },
    { id: 'fld_def_role', name: 'Role', type: 'select', options: {
      choices: Object.values(DefinitionRole).map(role => ({
        id: role,
        name: role.charAt(0).toUpperCase() + role.slice(1),
        color: getRoleColor(role)
      }))
    }},
    { id: 'fld_def_status', name: 'Status', type: 'select', options: {
      choices: [
        { id: 'stub', name: 'Stub', color: 'gray' },
        { id: 'partial', name: 'Partial', color: 'yellow' },
        { id: 'complete', name: 'Complete', color: 'green' },
        { id: 'verified', name: 'Verified', color: 'blue' },
        { id: 'local_only', name: 'Local Only', color: 'purple' }
      ]
    }},
    { id: 'fld_def_aliases', name: 'Aliases', type: 'multiSelect' },
    { id: 'fld_def_context_signature', name: 'Context Signature', type: 'json' },
    { id: 'fld_def_disambiguation', name: 'Disambiguation', type: 'json' },
    { id: 'fld_def_authority', name: 'Authority', type: 'text' },
    { id: 'fld_def_source_citation', name: 'Source Citation', type: 'text' },
    { id: 'fld_def_jurisdiction', name: 'Jurisdiction', type: 'text' },
    { id: 'fld_def_linked_fields', name: 'Linked Fields', type: 'json' },  // Reciprocal tracking
    { id: 'fld_def_usage_count', name: 'Usage Count', type: 'number' },
    { id: 'fld_def_discovered_from', name: 'Discovered From', type: 'json' },
    { id: 'fld_def_api_suggestions', name: 'API Suggestions', type: 'json' }
  ]
};

/**
 * Get color for definition role
 */
function getRoleColor(role) {
  const colors = {
    quantity: 'blue',
    property: 'purple',
    identifier: 'green',
    temporal: 'orange',
    spatial: 'cyan',
    categorical: 'pink',
    textual: 'gray'
  };
  return colors[role] || 'gray';
}

// ============================================================================
// SECTION II: Definitions Set Manager
// ============================================================================

/**
 * DefinitionsSetManager - Manages the system Definitions Set
 *
 * Responsibilities:
 * - Create/ensure Definitions Set exists
 * - Convert definitions to records
 * - Manage field → definition linking
 * - Track reciprocal links (definition → fields)
 */
class DefinitionsSetManager {
  constructor(workbench) {
    this.workbench = workbench;
    this._definitionsSet = null;
  }

  /**
   * Ensure the Definitions Set exists, creating it if necessary
   * @returns {Object} The Definitions Set
   */
  ensureDefinitionsSet() {
    // Check if already exists
    let defSet = this.workbench.sets?.find(s => s.id === DEFINITIONS_SET_ID);

    if (!defSet) {
      // Create the system Definitions Set
      defSet = {
        id: DEFINITIONS_SET_ID,
        name: 'Column Definitions',
        icon: 'ph-book-open',
        isSystemSet: true,
        displayNameFieldId: null, // Defaults to first column (Term)
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fields: DEFINITIONS_SET_SCHEMA.fields.map(f => ({
          ...f,
          id: f.id || `fld_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
        })),
        records: [],
        views: [
          { id: 'view_def_all', name: 'All Definitions', type: 'table', isDefault: true },
          { id: 'view_def_by_role', name: 'By Role', type: 'kanban', config: { groupBy: 'fld_def_role' }},
          { id: 'view_def_by_status', name: 'By Status', type: 'kanban', config: { groupBy: 'fld_def_status' }},
          { id: 'view_def_stubs', name: 'Needs Population', type: 'table', config: {
            filter: { field: 'fld_def_status', operator: 'is', value: 'stub' }
          }}
        ],
        derivation: {
          strategy: 'system',
          description: 'System set for column/key definitions'
        }
      };

      // Add to workbench sets
      if (!this.workbench.sets) this.workbench.sets = [];
      this.workbench.sets.push(defSet);

      console.log('DefinitionsSetManager: Created system Definitions Set');
    }

    this._definitionsSet = defSet;
    return defSet;
  }

  /**
   * Get the Definitions Set
   */
  getDefinitionsSet() {
    if (!this._definitionsSet) {
      this.ensureDefinitionsSet();
    }
    return this._definitionsSet;
  }

  /**
   * Convert a stub definition to a record in the Definitions Set
   * @param {Object} stubDef - The stub definition from workbench.definitions
   * @param {Object} sourceInfo - Information about the source field
   * @returns {Object} The created record
   */
  createDefinitionRecord(stubDef, sourceInfo = {}) {
    const defSet = this.getDefinitionsSet();

    // Check if record already exists
    const existingRecord = defSet.records?.find(r =>
      r.values?.fld_def_term === stubDef.term?.term ||
      r.id === stubDef.id
    );

    if (existingRecord) {
      console.log('DefinitionsSetManager: Definition record already exists:', stubDef.term?.term);
      return existingRecord;
    }

    // Create the record
    const recordId = stubDef.id || `defrec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const record = {
      id: recordId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      values: {
        fld_def_term: stubDef.term?.term || stubDef.name || '',
        fld_def_label: stubDef.term?.label || stubDef.terms?.[0]?.label || stubDef.name || '',
        fld_def_meaning_uri: stubDef.definitionSource?.uriSource?.uri || null,
        fld_def_definition: stubDef.term?.definitionText || stubDef.description || '',
        fld_def_role: this._inferRole(stubDef),
        fld_def_status: stubDef.status || 'stub',
        fld_def_aliases: [],
        fld_def_context_signature: null,
        fld_def_disambiguation: {
          type: DisambiguationType.NONE,
          alternativeMeanings: [],
          resolutionHistory: []
        },
        fld_def_authority: stubDef.definitionSource?.authority?.name || null,
        fld_def_source_citation: stubDef.definitionSource?.source?.citation || null,
        fld_def_jurisdiction: stubDef.definitionSource?.jurisdiction?.geographic || null,
        fld_def_linked_fields: [],  // Will be populated when fields link to this
        fld_def_usage_count: 0,
        fld_def_discovered_from: stubDef.discoveredFrom || sourceInfo,
        fld_def_api_suggestions: stubDef.definitionSource?.apiSuggestions || []
      }
    };

    // Add to Definitions Set
    if (!defSet.records) defSet.records = [];
    defSet.records.push(record);

    console.log('DefinitionsSetManager: Created definition record:', record.values.fld_def_term);

    return record;
  }

  /**
   * Infer the semantic role of a definition based on its properties
   */
  _inferRole(stubDef) {
    const fieldType = stubDef.discoveredFrom?.fieldType ||
                      stubDef.terms?.[0]?.fieldType ||
                      stubDef.definitionSource?.discoveredFrom?.fieldType;
    const term = (stubDef.term?.term || stubDef.name || '').toLowerCase();

    // Type-based inference
    if (fieldType === 'number') return DefinitionRole.QUANTITY;
    if (fieldType === 'date') return DefinitionRole.TEMPORAL;
    if (fieldType === 'checkbox') return DefinitionRole.PROPERTY;

    // Name-based inference
    if (term.includes('id') || term.includes('code') || term.includes('key')) {
      return DefinitionRole.IDENTIFIER;
    }
    if (term.includes('date') || term.includes('time') || term.includes('period')) {
      return DefinitionRole.TEMPORAL;
    }
    if (term.includes('address') || term.includes('location') || term.includes('lat') || term.includes('lon')) {
      return DefinitionRole.SPATIAL;
    }
    if (term.includes('type') || term.includes('category') || term.includes('status')) {
      return DefinitionRole.CATEGORICAL;
    }
    if (term.includes('name') || term.includes('description') || term.includes('note')) {
      return DefinitionRole.TEXTUAL;
    }

    return DefinitionRole.PROPERTY;  // Default
  }

  /**
   * Link a field to a definition record (with reciprocal tracking)
   * @param {string} setId - The Set containing the field
   * @param {string} fieldId - The field ID
   * @param {string} definitionRecordId - The definition record ID
   * @param {Object} disambiguationInfo - Optional disambiguation details
   */
  linkFieldToDefinition(setId, fieldId, definitionRecordId, disambiguationInfo = null) {
    const defSet = this.getDefinitionsSet();
    const defRecord = defSet.records?.find(r => r.id === definitionRecordId);

    if (!defRecord) {
      console.warn('DefinitionsSetManager: Definition record not found:', definitionRecordId);
      return null;
    }

    // Find the source set and field
    const sourceSet = this.workbench.sets?.find(s => s.id === setId);
    const field = sourceSet?.fields?.find(f => f.id === fieldId || f.name === fieldId);

    if (!field) {
      console.warn('DefinitionsSetManager: Field not found:', fieldId, 'in set:', setId);
      return null;
    }

    // 1. Update field with definition link
    field.definitionId = definitionRecordId;
    field.semanticBinding = {
      definitionId: definitionRecordId,
      definitionTerm: defRecord.values.fld_def_term,
      boundAt: new Date().toISOString(),
      boundBy: 'system',
      disambiguation: disambiguationInfo
    };

    // 2. Update definition record with reciprocal link
    if (!defRecord.values.fld_def_linked_fields) {
      defRecord.values.fld_def_linked_fields = [];
    }

    // Avoid duplicates
    const existingLink = defRecord.values.fld_def_linked_fields.find(
      l => l.setId === setId && l.fieldId === fieldId
    );

    if (!existingLink) {
      defRecord.values.fld_def_linked_fields.push({
        setId,
        setName: sourceSet.name,
        fieldId,
        fieldName: field.name,
        linkedAt: new Date().toISOString()
      });
      defRecord.values.fld_def_usage_count = defRecord.values.fld_def_linked_fields.length;
    }

    defRecord.updatedAt = new Date().toISOString();

    console.log('DefinitionsSetManager: Linked field', field.name, 'to definition', defRecord.values.fld_def_term);

    return {
      field,
      definitionRecord: defRecord,
      linkInfo: {
        setId,
        fieldId,
        definitionRecordId,
        disambiguation: disambiguationInfo
      }
    };
  }

  /**
   * Unlink a field from its definition
   */
  unlinkField(setId, fieldId) {
    const sourceSet = this.workbench.sets?.find(s => s.id === setId);
    const field = sourceSet?.fields?.find(f => f.id === fieldId || f.name === fieldId);

    if (!field || !field.definitionId) return null;

    const defSet = this.getDefinitionsSet();
    const defRecord = defSet.records?.find(r => r.id === field.definitionId);

    // Remove from definition's linked fields
    if (defRecord?.values?.fld_def_linked_fields) {
      defRecord.values.fld_def_linked_fields = defRecord.values.fld_def_linked_fields.filter(
        l => !(l.setId === setId && l.fieldId === fieldId)
      );
      defRecord.values.fld_def_usage_count = defRecord.values.fld_def_linked_fields.length;
    }

    // Clear field's definition link
    const previousDefinitionId = field.definitionId;
    field.definitionId = null;
    field.semanticBinding = null;

    return { previousDefinitionId, field };
  }

  /**
   * Get all fields linked to a definition
   */
  getLinkedFields(definitionRecordId) {
    const defSet = this.getDefinitionsSet();
    const defRecord = defSet.records?.find(r => r.id === definitionRecordId);
    return defRecord?.values?.fld_def_linked_fields || [];
  }

  /**
   * Get definition record for a field
   */
  getDefinitionForField(setId, fieldId) {
    const sourceSet = this.workbench.sets?.find(s => s.id === setId);
    const field = sourceSet?.fields?.find(f => f.id === fieldId || f.name === fieldId);

    if (!field?.definitionId) return null;

    const defSet = this.getDefinitionsSet();
    return defSet.records?.find(r => r.id === field.definitionId);
  }

  /**
   * Sync workbench.definitions array to Definitions Set records
   * (Migration helper for existing data)
   */
  syncDefinitionsArrayToSet() {
    if (!this.workbench.definitions?.length) return { synced: 0, skipped: 0 };

    const defSet = this.getDefinitionsSet();
    let synced = 0;
    let skipped = 0;

    for (const def of this.workbench.definitions) {
      const existingRecord = defSet.records?.find(r =>
        r.values?.fld_def_term === (def.terms?.[0]?.name || def.name)
      );

      if (existingRecord) {
        skipped++;
        continue;
      }

      // Convert to record format
      const record = {
        id: def.id,
        createdAt: def.importedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        values: {
          fld_def_term: def.terms?.[0]?.name || def.name || '',
          fld_def_label: def.terms?.[0]?.label || def.name || '',
          fld_def_meaning_uri: def.sourceUri || def.definitionSource?.uriSource?.uri || null,
          fld_def_definition: def.terms?.[0]?.description || def.description || '',
          fld_def_role: this._inferRole(def),
          fld_def_status: def.status || 'stub',
          fld_def_aliases: [],
          fld_def_context_signature: null,
          fld_def_disambiguation: {
            type: DisambiguationType.NONE,
            alternativeMeanings: [],
            resolutionHistory: []
          },
          fld_def_authority: def.definitionSource?.authority?.name || null,
          fld_def_source_citation: def.definitionSource?.source?.citation || null,
          fld_def_jurisdiction: def.definitionSource?.jurisdiction?.geographic || null,
          fld_def_linked_fields: [],
          fld_def_usage_count: 0,
          fld_def_discovered_from: def.discoveredFrom || null,
          fld_def_api_suggestions: def.definitionSource?.apiSuggestions || []
        }
      };

      if (!defSet.records) defSet.records = [];
      defSet.records.push(record);
      synced++;
    }

    console.log(`DefinitionsSetManager: Synced ${synced} definitions, skipped ${skipped} duplicates`);
    return { synced, skipped };
  }
}

// ============================================================================
// SECTION III: Disambiguation Engine
// ============================================================================

/**
 * DisambiguationEngine - Handles semantic disambiguation for keys/definitions
 *
 * Handles three cases:
 * 1. Homonyms: Same key, different meanings (e.g., "rate")
 * 2. Synonyms: Different keys, same meaning (e.g., "temp" vs "temperature")
 * 3. Contextual: Meaning changes by context (e.g., "value" in different domains)
 */
class DisambiguationEngine {
  constructor(definitionsSetManager) {
    this.manager = definitionsSetManager;
    this.aliasRegistry = new Map();  // term -> canonical definition IDs
    this.contextSignatures = new Map();  // definition ID -> context signature
  }

  /**
   * Initialize the engine with existing definitions
   */
  initialize() {
    const defSet = this.manager.getDefinitionsSet();

    for (const record of defSet.records || []) {
      const term = record.values.fld_def_term?.toLowerCase();
      if (!term) continue;

      // Build alias registry
      this._registerTerm(term, record.id);

      // Register aliases
      const aliases = record.values.fld_def_aliases || [];
      for (const alias of aliases) {
        this._registerTerm(alias.toLowerCase(), record.id);
      }

      // Store context signatures
      if (record.values.fld_def_context_signature) {
        this.contextSignatures.set(record.id, record.values.fld_def_context_signature);
      }
    }

    console.log('DisambiguationEngine: Initialized with', this.aliasRegistry.size, 'terms');
  }

  /**
   * Register a term in the alias registry
   */
  _registerTerm(term, definitionId) {
    if (!this.aliasRegistry.has(term)) {
      this.aliasRegistry.set(term, []);
    }
    const ids = this.aliasRegistry.get(term);
    if (!ids.includes(definitionId)) {
      ids.push(definitionId);
    }
  }

  /**
   * Check if a term needs disambiguation
   * @param {string} term - The term to check
   * @returns {Object} Disambiguation status and candidates
   */
  checkDisambiguation(term) {
    const normalizedTerm = term.toLowerCase().trim();
    const candidateIds = this.aliasRegistry.get(normalizedTerm) || [];

    if (candidateIds.length === 0) {
      return {
        needsDisambiguation: false,
        type: DisambiguationType.NONE,
        candidates: [],
        reason: 'No existing definitions match this term'
      };
    }

    if (candidateIds.length === 1) {
      return {
        needsDisambiguation: false,
        type: DisambiguationType.NONE,
        candidates: this._getCandidateDetails(candidateIds),
        reason: 'Single match found'
      };
    }

    // Multiple candidates - disambiguation needed
    return {
      needsDisambiguation: true,
      type: DisambiguationType.HOMONYM,
      candidates: this._getCandidateDetails(candidateIds),
      reason: `Term "${term}" has ${candidateIds.length} possible meanings`
    };
  }

  /**
   * Get detailed information about candidate definitions
   */
  _getCandidateDetails(definitionIds) {
    const defSet = this.manager.getDefinitionsSet();

    return definitionIds.map(id => {
      const record = defSet.records?.find(r => r.id === id);
      if (!record) return null;

      return {
        id: record.id,
        term: record.values.fld_def_term,
        label: record.values.fld_def_label,
        definition: record.values.fld_def_definition,
        role: record.values.fld_def_role,
        meaningUri: record.values.fld_def_meaning_uri,
        authority: record.values.fld_def_authority,
        usageCount: record.values.fld_def_usage_count || 0,
        contextSignature: record.values.fld_def_context_signature
      };
    }).filter(Boolean);
  }

  /**
   * Resolve disambiguation using context
   * @param {string} term - The term to resolve
   * @param {Object} context - Context for resolution
   * @param {string[]} context.siblingFields - Names of other fields in the same set
   * @param {string} context.domain - Domain hint (e.g., "finance", "weather")
   * @param {string} context.jurisdiction - Jurisdiction context
   * @param {any[]} context.sampleValues - Sample values from the field
   * @returns {Object} Resolution result with scores
   */
  resolveWithContext(term, context = {}) {
    const status = this.checkDisambiguation(term);

    if (!status.needsDisambiguation) {
      return {
        resolved: status.candidates.length === 1,
        bestMatch: status.candidates[0] || null,
        confidence: status.candidates.length === 1 ? 1.0 : 0,
        method: DisambiguationMethod.DEFAULT_FIRST,
        alternatives: [],
        reasoning: status.reason
      };
    }

    // Score each candidate based on context
    const scoredCandidates = status.candidates.map(candidate => {
      const score = this._scoreCandidate(candidate, context);
      return { ...candidate, score };
    });

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score.total - a.score.total);

    const bestMatch = scoredCandidates[0];
    const alternatives = scoredCandidates.slice(1);

    // Determine if we can auto-resolve
    const canAutoResolve = bestMatch.score.total >= 0.8 &&
      (alternatives.length === 0 || bestMatch.score.total - alternatives[0].score.total >= 0.2);

    return {
      resolved: canAutoResolve,
      bestMatch,
      confidence: bestMatch.score.total,
      method: canAutoResolve ? DisambiguationMethod.CONTEXT_INFERENCE : DisambiguationMethod.USER_SELECTION,
      alternatives,
      reasoning: this._generateReasoning(bestMatch, context)
    };
  }

  /**
   * Score a candidate definition against context
   */
  _scoreCandidate(candidate, context) {
    const scores = {
      siblingMatch: 0,
      domainMatch: 0,
      jurisdictionMatch: 0,
      valuePatternMatch: 0,
      usageBoost: 0,
      total: 0
    };

    const signature = candidate.contextSignature || {};

    // Sibling field matching (0-0.4)
    if (context.siblingFields?.length && signature.siblingPatterns?.length) {
      const siblingSet = new Set(context.siblingFields.map(f => f.toLowerCase()));
      const matchCount = signature.siblingPatterns.filter(p =>
        siblingSet.has(p.toLowerCase()) ||
        [...siblingSet].some(s => s.includes(p.toLowerCase()) || p.toLowerCase().includes(s))
      ).length;
      scores.siblingMatch = Math.min(0.4, (matchCount / signature.siblingPatterns.length) * 0.4);
    }

    // Domain matching (0-0.25)
    if (context.domain && signature.domainHints?.length) {
      const domainLower = context.domain.toLowerCase();
      const domainMatch = signature.domainHints.some(d =>
        d.toLowerCase().includes(domainLower) || domainLower.includes(d.toLowerCase())
      );
      scores.domainMatch = domainMatch ? 0.25 : 0;
    }

    // Jurisdiction matching (0-0.15)
    if (context.jurisdiction && candidate.authority) {
      const jurisdictionMatch = candidate.authority.toLowerCase().includes(context.jurisdiction.toLowerCase());
      scores.jurisdictionMatch = jurisdictionMatch ? 0.15 : 0;
    }

    // Value pattern matching (0-0.1)
    if (context.sampleValues?.length && signature.valuePatterns?.length) {
      const valueStrings = context.sampleValues.map(v => String(v));
      const patternMatch = signature.valuePatterns.some(pattern => {
        try {
          const regex = new RegExp(pattern);
          return valueStrings.some(v => regex.test(v));
        } catch {
          return false;
        }
      });
      scores.valuePatternMatch = patternMatch ? 0.1 : 0;
    }

    // Usage boost (0-0.1) - prefer definitions that are already used
    scores.usageBoost = Math.min(0.1, (candidate.usageCount || 0) * 0.02);

    // Calculate total
    scores.total = scores.siblingMatch + scores.domainMatch +
                   scores.jurisdictionMatch + scores.valuePatternMatch +
                   scores.usageBoost;

    return scores;
  }

  /**
   * Generate human-readable reasoning for a match
   */
  _generateReasoning(candidate, context) {
    const reasons = [];

    if (candidate.score.siblingMatch > 0) {
      reasons.push(`Sibling fields suggest ${candidate.label || candidate.term}`);
    }
    if (candidate.score.domainMatch > 0) {
      reasons.push(`Domain "${context.domain}" matches`);
    }
    if (candidate.score.usageBoost > 0) {
      reasons.push(`Used by ${candidate.usageCount} other field(s)`);
    }
    if (candidate.meaningUri) {
      reasons.push(`Linked to ${candidate.meaningUri}`);
    }

    return reasons.length > 0
      ? reasons.join('; ')
      : 'Best available match based on term similarity';
  }

  /**
   * Add an alias to a definition
   * @param {string} definitionId - The definition record ID
   * @param {string} alias - The alias term to add
   * @param {number} confidence - Confidence level (0-1)
   */
  addAlias(definitionId, alias, confidence = 0.9) {
    const defSet = this.manager.getDefinitionsSet();
    const record = defSet.records?.find(r => r.id === definitionId);

    if (!record) return false;

    if (!record.values.fld_def_aliases) {
      record.values.fld_def_aliases = [];
    }

    // Check if alias already exists
    const existingAlias = record.values.fld_def_aliases.find(
      a => (typeof a === 'string' ? a : a.term)?.toLowerCase() === alias.toLowerCase()
    );

    if (!existingAlias) {
      record.values.fld_def_aliases.push({
        term: alias,
        confidence,
        addedAt: new Date().toISOString()
      });

      // Update alias registry
      this._registerTerm(alias.toLowerCase(), definitionId);
    }

    return true;
  }

  /**
   * Set context signature for a definition
   * @param {string} definitionId - The definition record ID
   * @param {Object} signature - The context signature
   */
  setContextSignature(definitionId, signature) {
    const defSet = this.manager.getDefinitionsSet();
    const record = defSet.records?.find(r => r.id === definitionId);

    if (!record) return false;

    record.values.fld_def_context_signature = {
      domainHints: signature.domainHints || [],
      siblingPatterns: signature.siblingPatterns || [],
      valuePatterns: signature.valuePatterns || [],
      unitHints: signature.unitHints || [],
      updatedAt: new Date().toISOString()
    };

    this.contextSignatures.set(definitionId, record.values.fld_def_context_signature);

    return true;
  }

  /**
   * Record a disambiguation decision
   * @param {string} definitionId - The chosen definition
   * @param {Object} decision - The decision details
   */
  recordDisambiguationDecision(definitionId, decision) {
    const defSet = this.manager.getDefinitionsSet();
    const record = defSet.records?.find(r => r.id === definitionId);

    if (!record) return false;

    if (!record.values.fld_def_disambiguation) {
      record.values.fld_def_disambiguation = {
        type: DisambiguationType.NONE,
        alternativeMeanings: [],
        resolutionHistory: []
      };
    }

    record.values.fld_def_disambiguation.resolutionHistory.push({
      ...decision,
      resolvedAt: new Date().toISOString()
    });

    // Learn from decision - update context signature if pattern detected
    if (decision.context?.siblingFields?.length > 2) {
      this._learnFromDecision(record, decision);
    }

    return true;
  }

  /**
   * Learn from user disambiguation decisions to improve future suggestions
   */
  _learnFromDecision(record, decision) {
    const currentSignature = record.values.fld_def_context_signature || {
      domainHints: [],
      siblingPatterns: [],
      valuePatterns: [],
      unitHints: []
    };

    // Add successful sibling patterns
    if (decision.context?.siblingFields) {
      const newPatterns = decision.context.siblingFields
        .filter(f => !currentSignature.siblingPatterns.includes(f.toLowerCase()))
        .slice(0, 5);  // Limit to top 5 new patterns

      currentSignature.siblingPatterns.push(...newPatterns.map(p => p.toLowerCase()));
    }

    // Add domain hint if provided
    if (decision.context?.domain && !currentSignature.domainHints.includes(decision.context.domain)) {
      currentSignature.domainHints.push(decision.context.domain);
    }

    currentSignature.updatedAt = new Date().toISOString();
    record.values.fld_def_context_signature = currentSignature;
    this.contextSignatures.set(record.id, currentSignature);
  }

  /**
   * Find synonyms for a term
   * @param {string} term - The term to find synonyms for
   * @returns {Object[]} Array of synonym definitions
   */
  findSynonyms(term) {
    const normalizedTerm = term.toLowerCase().trim();
    const defSet = this.manager.getDefinitionsSet();
    const synonyms = [];

    // Find definitions where this term is an alias
    for (const record of defSet.records || []) {
      const aliases = record.values.fld_def_aliases || [];
      const hasAlias = aliases.some(a =>
        (typeof a === 'string' ? a : a.term)?.toLowerCase() === normalizedTerm
      );

      if (hasAlias && record.values.fld_def_term?.toLowerCase() !== normalizedTerm) {
        synonyms.push({
          canonicalTerm: record.values.fld_def_term,
          definitionId: record.id,
          label: record.values.fld_def_label,
          relationship: 'alias_of'
        });
      }
    }

    // Find definitions with same meaning URI
    const termRecord = defSet.records?.find(r =>
      r.values.fld_def_term?.toLowerCase() === normalizedTerm
    );

    if (termRecord?.values.fld_def_meaning_uri) {
      const sameUriRecords = defSet.records?.filter(r =>
        r.id !== termRecord.id &&
        r.values.fld_def_meaning_uri === termRecord.values.fld_def_meaning_uri
      );

      for (const record of sameUriRecords || []) {
        synonyms.push({
          canonicalTerm: record.values.fld_def_term,
          definitionId: record.id,
          label: record.values.fld_def_label,
          relationship: 'same_meaning_uri'
        });
      }
    }

    return synonyms;
  }
}

// ============================================================================
// SECTION IV: Integration Helpers
// ============================================================================

/**
 * Create stub definitions AND records in the Definitions Set
 * This is the enhanced version that fixes the linking issue
 *
 * @param {Object} source - The imported source object
 * @param {Object} workbench - The workbench instance
 * @param {Object} options - Options
 * @returns {Object[]} Array of created definition records
 */
function createLinkedStubDefinitions(source, workbench, options = {}) {
  const manager = new DefinitionsSetManager(workbench);
  manager.ensureDefinitionsSet();

  const createdRecords = [];

  for (const field of source.schema?.fields || []) {
    // Create the stub definition data
    const stubDefData = {
      id: `def_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      term: {
        term: field.name,
        label: formatFieldNameAsLabel(field.name)
      },
      status: 'stub',
      populationMethod: 'pending',
      discoveredFrom: {
        sourceId: source.id,
        sourceName: source.name,
        fieldId: field.id || field.name,
        fieldName: field.name,
        fieldType: field.type,
        fieldSamples: field.uniqueValues?.slice(0, 10) || [],
        discoveredAt: new Date().toISOString()
      }
    };

    // Create record in Definitions Set
    const record = manager.createDefinitionRecord(stubDefData, stubDefData.discoveredFrom);

    // Link the field to the definition record
    const sourceSetId = source.setId || source.id;  // Use set ID if available
    if (sourceSetId && workbench.sets?.find(s => s.id === sourceSetId)) {
      manager.linkFieldToDefinition(sourceSetId, field.id || field.name, record.id);
    } else {
      // Store the link info on the field directly for later binding
      field.definitionId = record.id;
      field.pendingDefinitionLink = {
        definitionRecordId: record.id,
        createdAt: new Date().toISOString()
      };
    }

    createdRecords.push(record);
  }

  console.log('createLinkedStubDefinitions: Created', createdRecords.length, 'linked definition records');

  return createdRecords;
}

/**
 * Format a field name as a human-readable label
 */
function formatFieldNameAsLabel(fieldName) {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

/**
 * Complete pending definition links after a set is created
 * Call this after creating a set from a source
 *
 * @param {string} setId - The newly created set ID
 * @param {Object} workbench - The workbench instance
 */
function completePendingDefinitionLinks(setId, workbench) {
  const manager = new DefinitionsSetManager(workbench);
  const set = workbench.sets?.find(s => s.id === setId);

  if (!set) return { linked: 0 };

  let linked = 0;

  for (const field of set.fields || []) {
    if (field.pendingDefinitionLink && !field.semanticBinding) {
      const result = manager.linkFieldToDefinition(
        setId,
        field.id || field.name,
        field.pendingDefinitionLink.definitionRecordId
      );

      if (result) {
        delete field.pendingDefinitionLink;
        linked++;
      }
    }
  }

  console.log('completePendingDefinitionLinks: Completed', linked, 'links for set', set.name);
  return { linked };
}

// ============================================================================
// SECTION V: Exports
// ============================================================================

// Export for browser
if (typeof window !== 'undefined') {
  window.EO = window.EO || {};
  window.EO.DefinitionsSetManager = DefinitionsSetManager;
  window.EO.DisambiguationEngine = DisambiguationEngine;
  window.EO.createLinkedStubDefinitions = createLinkedStubDefinitions;
  window.EO.completePendingDefinitionLinks = completePendingDefinitionLinks;
  window.EO.DEFINITIONS_SET_ID = DEFINITIONS_SET_ID;
  window.EO.DisambiguationType = DisambiguationType;
  window.EO.DisambiguationMethod = DisambiguationMethod;
  window.EO.DefinitionRole = DefinitionRole;
}

// Export for Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DefinitionsSetManager,
    DisambiguationEngine,
    createLinkedStubDefinitions,
    completePendingDefinitionLinks,
    DEFINITIONS_SET_ID,
    DEFINITIONS_SET_SCHEMA,
    DisambiguationType,
    DisambiguationMethod,
    DefinitionRole
  };
}
