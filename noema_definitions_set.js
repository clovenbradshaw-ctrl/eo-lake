/**
 * EO Definitions Set - System Set Infrastructure for Definitions
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

    if (defSet) {
      // Migrate old "Column Definitions" name to "Definitions"
      if (defSet.name === 'Column Definitions') {
        defSet.name = 'Definitions';
        defSet.updatedAt = new Date().toISOString();
      }
    }

    if (!defSet) {
      // Create the system Definitions Set
      defSet = {
        id: DEFINITIONS_SET_ID,
        name: 'Definitions',
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
// SECTION V: Common Definitions Registry
// ============================================================================

/**
 * CommonDefinitionsRegistry - Manages hardcoded common definitions
 *
 * These are well-known field definitions (firstName, email, price, etc.)
 * that are automatically suggested when matching keys are detected.
 *
 * Common definitions are loaded from common_definitions.json and provide:
 * - Rich metadata (meaning, authority, sensitivity, interop URIs)
 * - Automatic key matching with fuzzy normalization
 * - Pre-linked semantic URIs for interoperability
 */
class CommonDefinitionsRegistry {
  constructor() {
    this._definitions = [];
    this._keyIndex = new Map();  // normalized key -> definition
    this._aliasIndex = new Map(); // alias -> definition IDs
    this._loaded = false;
  }

  /**
   * Load common definitions from JSON data
   * @param {Object} jsonData - The parsed common_definitions.json content
   */
  loadFromJSON(jsonData) {
    if (!jsonData?.definitions?.length) {
      console.warn('CommonDefinitionsRegistry: No definitions found in JSON');
      return;
    }

    this._definitions = jsonData.definitions;
    this._buildIndices();
    this._loaded = true;

    console.log(`CommonDefinitionsRegistry: Loaded ${this._definitions.length} common definitions`);
  }

  /**
   * Load common definitions from URL (browser) or file path (Node.js)
   * @param {string} pathOrUrl - Path to common_definitions.json
   */
  async loadFromFile(pathOrUrl) {
    try {
      let jsonData;

      if (typeof window !== 'undefined') {
        // Browser: fetch from URL
        const response = await fetch(pathOrUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }
        jsonData = await response.json();
      } else if (typeof require !== 'undefined') {
        // Node.js: read from file system
        const fs = require('fs');
        const content = fs.readFileSync(pathOrUrl, 'utf-8');
        jsonData = JSON.parse(content);
      }

      this.loadFromJSON(jsonData);
    } catch (error) {
      console.error('CommonDefinitionsRegistry: Failed to load definitions:', error);
    }
  }

  /**
   * Build lookup indices for fast key matching
   */
  _buildIndices() {
    this._keyIndex.clear();
    this._aliasIndex.clear();

    for (const def of this._definitions) {
      // Extract the key from the id (e.g., "definition.firstName" -> "firstName")
      const key = def.id.replace('definition.', '');
      const normalizedKey = this._normalizeKey(key);

      // Index by primary key
      this._keyIndex.set(normalizedKey, def);

      // Also index common variations
      const variations = this._generateKeyVariations(key);
      for (const variation of variations) {
        if (!this._keyIndex.has(variation)) {
          this._aliasIndex.set(variation, def.id);
        }
      }
    }
  }

  /**
   * Normalize a key for comparison
   * Handles: camelCase, snake_case, kebab-case, spaces, and common abbreviations
   */
  _normalizeKey(key) {
    return key
      .toLowerCase()
      // Convert camelCase to spaces
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Convert separators to spaces
      .replace(/[-_]/g, ' ')
      // Remove extra spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generate common variations of a key for fuzzy matching
   */
  _generateKeyVariations(key) {
    const normalized = this._normalizeKey(key);
    const variations = new Set();

    // Original normalized
    variations.add(normalized);

    // Without spaces (concatenated)
    variations.add(normalized.replace(/\s/g, ''));

    // With underscores
    variations.add(normalized.replace(/\s/g, '_'));

    // With hyphens
    variations.add(normalized.replace(/\s/g, '-'));

    // Common abbreviations
    const abbreviationMap = {
      'first name': ['fname', 'firstname', 'first', 'given name', 'givenname'],
      'last name': ['lname', 'lastname', 'last', 'surname', 'family name', 'familyname'],
      'full name': ['name', 'fullname', 'display name', 'displayname'],
      'middle name': ['mname', 'middlename', 'middle'],
      'email': ['email address', 'emailaddress', 'e-mail', 'e mail', 'mail'],
      'phone': ['telephone', 'phone number', 'phonenumber', 'tel'],
      'mobile phone': ['mobile', 'cell', 'cellphone', 'cell phone'],
      'street address': ['address', 'address1', 'address line 1', 'street'],
      'address line 2': ['address2', 'address line2', 'apt', 'suite', 'unit'],
      'postal code': ['zip', 'zipcode', 'zip code', 'postcode', 'post code'],
      'date of birth': ['dob', 'birthdate', 'birth date', 'birthday'],
      'social security number': ['ssn', 'social security', 'ss number'],
      'drivers license number': ['dl', 'drivers license', 'license number'],
      'created date': ['createdat', 'created at', 'created', 'creation date', 'datecreated'],
      'modified date': ['updatedat', 'updated at', 'updated', 'modifiedat', 'modified at', 'last modified', 'datemodified'],
      'start date': ['startdate', 'begin date', 'begindate', 'from date', 'fromdate'],
      'end date': ['enddate', 'finish date', 'finishdate', 'to date', 'todate', 'expiry date', 'expirydate'],
      'unique identifier': ['id', 'identifier', 'uid', 'guid', 'key', 'pk', 'primary key'],
      'customer id': ['customerid', 'customer', 'cust id', 'custid'],
      'user id': ['userid', 'user', 'uid'],
      'account id': ['accountid', 'account', 'acct id', 'acctid'],
      'order id': ['orderid', 'order', 'order number', 'ordernumber'],
      'product id': ['productid', 'product', 'prod id', 'prodid', 'item id', 'itemid'],
      'transaction id': ['transactionid', 'trans id', 'transid', 'txn id', 'txnid'],
      'invoice number': ['invoicenumber', 'invoice', 'inv number', 'invnumber'],
      'employee id': ['employeeid', 'employee', 'emp id', 'empid'],
      'organization id': ['organizationid', 'orgid', 'org id', 'company id', 'companyid'],
      'company name': ['companyname', 'company', 'org name', 'orgname', 'organization name'],
      'job title': ['jobtitle', 'title', 'position'],
      'hire date': ['hiredate', 'hired date', 'date hired', 'employment date'],
      'termination date': ['terminationdate', 'term date', 'termdate', 'end date', 'separation date'],
      'amount': ['amt', 'value', 'total'],
      'price': ['cost', 'unit price', 'unitprice'],
      'currency': ['curr', 'currency code', 'currencycode'],
      'discount': ['disc', 'discount amount', 'discountamount'],
      'tax amount': ['taxamount', 'tax', 'taxes'],
      'description': ['desc', 'details', 'summary'],
      'notes': ['note', 'comments', 'remarks'],
      'status': ['state', 'condition'],
      'type': ['kind', 'classification'],
      'category': ['cat', 'group', 'class'],
      'priority': ['pri', 'importance', 'urgency'],
      'active': ['isactive', 'is active', 'enabled', 'isenabled'],
      'approved': ['isapproved', 'is approved'],
      'verified': ['isverified', 'is verified', 'confirmed'],
      'url': ['link', 'href', 'web address', 'webaddress', 'uri'],
      'image url': ['imageurl', 'image', 'img', 'photo', 'picture', 'pic'],
      'file path': ['filepath', 'path', 'filename', 'file name'],
      'ip address': ['ipaddress', 'ip', 'ipv4', 'ipv6'],
      'latitude': ['lat'],
      'longitude': ['lng', 'lon', 'long'],
      'timestamp': ['ts', 'datetime', 'date time'],
      'version': ['ver', 'v', 'revision', 'rev'],
      'uuid': ['guid', 'unique id', 'uniqueid'],
      'sku': ['stock keeping unit', 'item number', 'itemnumber'],
      'barcode': ['upc', 'ean', 'gtin'],
      'age': ['years old', 'yearsold'],
      'gender': ['sex']
    };

    // Add abbreviations for this key
    if (abbreviationMap[normalized]) {
      for (const abbrev of abbreviationMap[normalized]) {
        variations.add(abbrev);
        variations.add(abbrev.replace(/\s/g, ''));
        variations.add(abbrev.replace(/\s/g, '_'));
      }
    }

    return variations;
  }

  /**
   * Find a matching common definition for a field key
   * @param {string} fieldKey - The field name/key to match
   * @returns {Object|null} The matching definition or null
   */
  findMatch(fieldKey) {
    if (!this._loaded || !fieldKey) return null;

    const normalizedKey = this._normalizeKey(fieldKey);

    // Direct match
    if (this._keyIndex.has(normalizedKey)) {
      return this._keyIndex.get(normalizedKey);
    }

    // Alias match
    if (this._aliasIndex.has(normalizedKey)) {
      const defId = this._aliasIndex.get(normalizedKey);
      return this._definitions.find(d => d.id === defId);
    }

    // Fuzzy match: try removing common prefixes/suffixes
    const strippedKey = normalizedKey
      .replace(/^(fld_|col_|field_|column_)/, '')
      .replace(/(_id|_key|_code|_num|_no|_number)$/, '');

    if (strippedKey !== normalizedKey) {
      if (this._keyIndex.has(strippedKey)) {
        return this._keyIndex.get(strippedKey);
      }
      if (this._aliasIndex.has(strippedKey)) {
        const defId = this._aliasIndex.get(strippedKey);
        return this._definitions.find(d => d.id === defId);
      }
    }

    return null;
  }

  /**
   * Find all potential matches with confidence scores
   * @param {string} fieldKey - The field name/key to match
   * @param {Object} context - Optional context (sibling fields, sample values)
   * @returns {Object[]} Array of matches with scores
   */
  findMatchesWithScores(fieldKey, context = {}) {
    if (!this._loaded || !fieldKey) return [];

    const normalizedKey = this._normalizeKey(fieldKey);
    const matches = [];

    for (const def of this._definitions) {
      const defKey = def.id.replace('definition.', '');
      const normalizedDefKey = this._normalizeKey(defKey);
      const variations = this._generateKeyVariations(defKey);

      let score = 0;
      let matchType = null;

      // Exact match
      if (normalizedKey === normalizedDefKey) {
        score = 1.0;
        matchType = 'exact';
      }
      // Variation match
      else if (variations.has(normalizedKey)) {
        score = 0.9;
        matchType = 'alias';
      }
      // Partial match (contains)
      else if (normalizedDefKey.includes(normalizedKey) || normalizedKey.includes(normalizedDefKey)) {
        const longer = normalizedKey.length > normalizedDefKey.length ? normalizedKey : normalizedDefKey;
        const shorter = normalizedKey.length > normalizedDefKey.length ? normalizedDefKey : normalizedKey;
        score = (shorter.length / longer.length) * 0.7;
        matchType = 'partial';
      }
      // Levenshtein-like fuzzy match for close spellings
      else {
        const distance = this._levenshteinDistance(normalizedKey, normalizedDefKey);
        const maxLen = Math.max(normalizedKey.length, normalizedDefKey.length);
        if (distance <= 2 && maxLen > 4) {
          score = (1 - distance / maxLen) * 0.6;
          matchType = 'fuzzy';
        }
      }

      if (score > 0.3) {
        // Context boosting
        if (context.fieldType && def.valueShape?.datatype) {
          const typeMatch = this._matchDataType(context.fieldType, def.valueShape.datatype);
          if (typeMatch) score = Math.min(1.0, score + 0.05);
        }

        matches.push({
          definition: def,
          score,
          matchType,
          key: defKey
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    return matches.slice(0, 5);  // Top 5 matches
  }

  /**
   * Simple Levenshtein distance for fuzzy matching
   */
  _levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Check if field type matches definition datatype
   */
  _matchDataType(fieldType, defDatatype) {
    const typeMap = {
      'text': ['string'],
      'longText': ['string'],
      'number': ['number', 'decimal', 'integer'],
      'date': ['xsd:date', 'xsd:dateTime', 'date', 'datetime'],
      'checkbox': ['boolean'],
      'url': ['string', 'url', 'uri'],
      'email': ['string'],
      'phone': ['string']
    };

    const compatibleTypes = typeMap[fieldType] || [];
    return compatibleTypes.some(t => defDatatype?.toLowerCase().includes(t.toLowerCase()));
  }

  /**
   * Convert a common definition to a definition record
   * @param {Object} commonDef - The common definition from JSON
   * @returns {Object} A record suitable for the Definitions Set
   */
  toDefinitionRecord(commonDef) {
    const key = commonDef.id.replace('definition.', '');

    return {
      id: `defrec_common_${key}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isCommonDefinition: true,
      commonDefinitionId: commonDef.id,
      values: {
        fld_def_term: key,
        fld_def_label: commonDef.meaning,
        fld_def_meaning_uri: commonDef.interop?.preferredURI || null,
        fld_def_definition: commonDef.plainLanguage,
        fld_def_role: this._mapCategoryToRole(commonDef.category),
        fld_def_status: 'verified',  // Common definitions are pre-verified
        fld_def_aliases: this._extractAliases(key, commonDef),
        fld_def_context_signature: {
          domainHints: commonDef.refersTo || [],
          siblingPatterns: [],
          valuePatterns: commonDef.valueShape?.format ? [commonDef.valueShape.format] : [],
          unitHints: []
        },
        fld_def_disambiguation: {
          type: DisambiguationType.NONE,
          alternativeMeanings: commonDef.interop?.alternativeURIs || [],
          resolutionHistory: []
        },
        fld_def_authority: commonDef.authority || 'common',
        fld_def_source_citation: 'Common Definitions Library',
        fld_def_jurisdiction: null,
        fld_def_linked_fields: [],
        fld_def_usage_count: 0,
        fld_def_discovered_from: {
          source: 'common_definitions',
          loadedAt: new Date().toISOString()
        },
        fld_def_api_suggestions: [],
        // Additional metadata from common definition
        fld_def_interop: commonDef.interop,
        fld_def_value_shape: commonDef.valueShape,
        fld_def_stability: commonDef.stability,
        fld_def_time: commonDef.time,
        fld_def_sensitivity: commonDef.sensitivity,
        fld_def_risk: commonDef.risk,
        fld_def_notes: commonDef.notes
      }
    };
  }

  /**
   * Map category to definition role
   */
  _mapCategoryToRole(category) {
    const roleMap = {
      'identity': DefinitionRole.IDENTIFIER,
      'contact': DefinitionRole.PROPERTY,
      'temporal': DefinitionRole.TEMPORAL,
      'financial': DefinitionRole.QUANTITY,
      'status': DefinitionRole.CATEGORICAL,
      'relational': DefinitionRole.IDENTIFIER,
      'organizational': DefinitionRole.PROPERTY,
      'descriptive': DefinitionRole.TEXTUAL,
      'technical': DefinitionRole.IDENTIFIER
    };
    return roleMap[category] || DefinitionRole.PROPERTY;
  }

  /**
   * Extract aliases from common definition
   */
  _extractAliases(key, commonDef) {
    const aliases = [];

    // Add the meaning as an alias if different from key
    if (commonDef.meaning && commonDef.meaning.toLowerCase().replace(/\s/g, '') !== key.toLowerCase()) {
      aliases.push({
        term: commonDef.meaning,
        confidence: 1.0,
        source: 'common_definition'
      });
    }

    return aliases;
  }

  /**
   * Get all definitions by category
   */
  getByCategory(category) {
    return this._definitions.filter(d => d.category === category);
  }

  /**
   * Get all loaded definitions
   */
  getAll() {
    return [...this._definitions];
  }

  /**
   * Check if registry is loaded
   */
  isLoaded() {
    return this._loaded;
  }
}

// Singleton instance of the registry
let _commonDefinitionsRegistry = null;

/**
 * Get the singleton CommonDefinitionsRegistry instance
 */
function getCommonDefinitionsRegistry() {
  if (!_commonDefinitionsRegistry) {
    _commonDefinitionsRegistry = new CommonDefinitionsRegistry();
  }
  return _commonDefinitionsRegistry;
}

/**
 * Load common definitions and populate the Definitions Set
 * @param {Object} workbench - The workbench instance
 * @param {Object|string} jsonDataOrPath - JSON data or path to common_definitions.json
 * @returns {Object} Result with count of loaded definitions
 */
async function loadCommonDefinitions(workbench, jsonDataOrPath) {
  const registry = getCommonDefinitionsRegistry();
  const manager = new DefinitionsSetManager(workbench);

  // Load into registry
  if (typeof jsonDataOrPath === 'string') {
    await registry.loadFromFile(jsonDataOrPath);
  } else {
    registry.loadFromJSON(jsonDataOrPath);
  }

  if (!registry.isLoaded()) {
    return { loaded: 0, error: 'Failed to load common definitions' };
  }

  // Ensure Definitions Set exists
  const defSet = manager.ensureDefinitionsSet();

  // Add common definitions to the set
  let loaded = 0;
  let skipped = 0;

  for (const commonDef of registry.getAll()) {
    const key = commonDef.id.replace('definition.', '');
    const recordId = `defrec_common_${key}`;

    // Check if already exists
    const existing = defSet.records?.find(r => r.id === recordId || r.commonDefinitionId === commonDef.id);
    if (existing) {
      skipped++;
      continue;
    }

    const record = registry.toDefinitionRecord(commonDef);
    if (!defSet.records) defSet.records = [];
    defSet.records.push(record);
    loaded++;
  }

  console.log(`loadCommonDefinitions: Loaded ${loaded} common definitions, skipped ${skipped} duplicates`);

  return { loaded, skipped, total: registry.getAll().length };
}

/**
 * Auto-link a field to a matching common definition
 * @param {Object} workbench - The workbench instance
 * @param {string} setId - The set containing the field
 * @param {Object} field - The field to link
 * @param {Object} options - Options including minConfidence threshold
 * @returns {Object|null} Link result or null if no match
 */
function autoLinkToCommonDefinition(workbench, setId, field, options = {}) {
  const { minConfidence = 0.7, autoLink = true } = options;
  const registry = getCommonDefinitionsRegistry();

  if (!registry.isLoaded()) {
    console.warn('autoLinkToCommonDefinition: Common definitions not loaded');
    return null;
  }

  // Find matches
  const matches = registry.findMatchesWithScores(field.name, {
    fieldType: field.type,
    sampleValues: field.uniqueValues?.slice(0, 5)
  });

  if (matches.length === 0) {
    return null;
  }

  const bestMatch = matches[0];

  // Return match info even if below threshold
  const result = {
    field: field.name,
    bestMatch: {
      key: bestMatch.key,
      meaning: bestMatch.definition.meaning,
      score: bestMatch.score,
      matchType: bestMatch.matchType,
      definitionId: bestMatch.definition.id,
      uri: bestMatch.definition.interop?.preferredURI
    },
    alternatives: matches.slice(1).map(m => ({
      key: m.key,
      meaning: m.definition.meaning,
      score: m.score
    })),
    autoLinked: false
  };

  // Auto-link if above threshold
  if (autoLink && bestMatch.score >= minConfidence) {
    const manager = new DefinitionsSetManager(workbench);
    const recordId = `defrec_common_${bestMatch.key}`;

    // Ensure the common definition record exists
    const defSet = manager.getDefinitionsSet();
    let record = defSet.records?.find(r => r.id === recordId);

    if (!record) {
      // Create the record if it doesn't exist
      record = registry.toDefinitionRecord(bestMatch.definition);
      if (!defSet.records) defSet.records = [];
      defSet.records.push(record);
    }

    // Link the field
    const linkResult = manager.linkFieldToDefinition(setId, field.id || field.name, recordId, {
      type: 'auto_common_definition',
      matchScore: bestMatch.score,
      matchType: bestMatch.matchType
    });

    if (linkResult) {
      result.autoLinked = true;
      result.linkedRecordId = recordId;
    }
  }

  return result;
}

/**
 * Auto-link all fields in a set to matching common definitions
 * @param {Object} workbench - The workbench instance
 * @param {string} setId - The set to process
 * @param {Object} options - Options including minConfidence threshold
 * @returns {Object} Summary of linking results
 */
function autoLinkSetToCommonDefinitions(workbench, setId, options = {}) {
  const set = workbench.sets?.find(s => s.id === setId);
  if (!set) {
    return { error: 'Set not found', linked: 0, suggestions: 0 };
  }

  const results = {
    setId,
    setName: set.name,
    linked: 0,
    suggestions: 0,
    noMatch: 0,
    fields: []
  };

  for (const field of set.fields || []) {
    // Skip if already has a definition link
    if (field.definitionId || field.semanticBinding) {
      continue;
    }

    const linkResult = autoLinkToCommonDefinition(workbench, setId, field, options);

    if (linkResult) {
      if (linkResult.autoLinked) {
        results.linked++;
      } else if (linkResult.bestMatch.score >= 0.5) {
        results.suggestions++;
      }
      results.fields.push(linkResult);
    } else {
      results.noMatch++;
    }
  }

  console.log(`autoLinkSetToCommonDefinitions: Set "${set.name}" - linked ${results.linked}, suggestions ${results.suggestions}, no match ${results.noMatch}`);

  return results;
}

// ============================================================================
// SECTION VI: Exports
// ============================================================================

// Export for browser
if (typeof window !== 'undefined') {
  window.EO = window.EO || {};
  window.EO.DefinitionsSetManager = DefinitionsSetManager;
  window.EO.DisambiguationEngine = DisambiguationEngine;
  window.EO.CommonDefinitionsRegistry = CommonDefinitionsRegistry;
  window.EO.createLinkedStubDefinitions = createLinkedStubDefinitions;
  window.EO.completePendingDefinitionLinks = completePendingDefinitionLinks;
  window.EO.getCommonDefinitionsRegistry = getCommonDefinitionsRegistry;
  window.EO.loadCommonDefinitions = loadCommonDefinitions;
  window.EO.autoLinkToCommonDefinition = autoLinkToCommonDefinition;
  window.EO.autoLinkSetToCommonDefinitions = autoLinkSetToCommonDefinitions;
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
    CommonDefinitionsRegistry,
    createLinkedStubDefinitions,
    completePendingDefinitionLinks,
    getCommonDefinitionsRegistry,
    loadCommonDefinitions,
    autoLinkToCommonDefinition,
    autoLinkSetToCommonDefinitions,
    DEFINITIONS_SET_ID,
    DEFINITIONS_SET_SCHEMA,
    DisambiguationType,
    DisambiguationMethod,
    DefinitionRole
  };
}
