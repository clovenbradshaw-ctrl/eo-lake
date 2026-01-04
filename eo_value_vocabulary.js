/**
 * EO Value Vocabulary - Definitions for Values (not just Keys)
 *
 * This module implements the dual-layer semantic system:
 * - Field Definitions (keys): What does this column mean?
 * - Value Definitions (values): What do the values in this column mean?
 *
 * EO PRINCIPLE:
 * "Meaning exists at both the key level and the value level.
 *  A 'status' field has a meaning, but so do its values: 'active', 'pending', 'closed'."
 *
 * Key concepts:
 * - ValueVocabulary: A controlled set of defined values for a field
 * - ValueDefinition: The meaning of a single value within a vocabulary
 * - VocabularyBinding: Links a field to its value vocabulary
 */

// ============================================================================
// Constants
// ============================================================================

const ValueStatus = Object.freeze({
  ACTIVE: 'active',           // Currently in use
  DEPRECATED: 'deprecated',   // No longer recommended, but may exist in data
  PROPOSED: 'proposed',       // Under consideration
  RETIRED: 'retired'          // Removed, should not appear in new data
});

const ValueChangeType = Object.freeze({
  ASSIGNED: 'assigned',       // Value was set on a record
  REMOVED: 'removed',         // Value was changed from this value
  CREATED: 'created',         // Value definition was created
  UPDATED: 'updated',         // Value definition was modified
  DEPRECATED: 'deprecated',   // Value was deprecated
  SUPERSEDED: 'superseded'    // Value was replaced by another
});

// ============================================================================
// ValueDefinition Class
// ============================================================================

/**
 * ValueDefinition - The meaning of a single value within a vocabulary
 *
 * Supports two levels of definition:
 * - Simple: A plain text `definition` string for quick display
 * - Rich: A full `definitionSource` object with authority, citation, jurisdiction, etc.
 *   (Same structure as DefinitionSource used for field/key definitions)
 */
class ValueDefinition {
  /**
   * @param {Object} options
   * @param {string} options.value - The actual value (e.g., "active", "US", "P1")
   * @param {string} options.uri - Semantic URI for this value
   * @param {string} options.term - Human-readable term/label
   * @param {string} options.definition - What this value means (simple text)
   * @param {Object} options.definitionSource - Rich definition with authority, source, etc.
   * @param {string[]} options.implications - What using this value implies
   * @param {string} options.jurisdiction - Authority context for this value
   * @param {string} options.validFrom - When this value became valid
   * @param {string} options.validTo - When this value stops being valid (null = still valid)
   * @param {string} options.supersedes - Value this one replaced
   * @param {string} options.supersededBy - Value that replaced this one
   * @param {string} options.status - ValueStatus
   */
  constructor(options = {}) {
    this.value = options.value || '';
    this.uri = options.uri || null;
    this.term = options.term || options.value || '';
    this.definition = options.definition || '';
    this.implications = Array.isArray(options.implications) ? [...options.implications] : [];

    // Rich definition source (same structure as DefinitionSource for keys)
    // This allows values to have full regulatory/legal definition support
    this.definitionSource = options.definitionSource ? {
      // Status and population tracking
      status: options.definitionSource.status || 'stub',
      populationMethod: options.definitionSource.populationMethod || 'pending',

      // Term info
      term: options.definitionSource.term ? {
        term: options.definitionSource.term.term || this.value,
        label: options.definitionSource.term.label || this.term,
        asWritten: options.definitionSource.term.asWritten || null,
        definitionText: options.definitionSource.term.definitionText || this.definition || null,
        categories: Array.isArray(options.definitionSource.term.categories)
          ? [...options.definitionSource.term.categories] : null
      } : null,

      // Authority (who defines this value's meaning)
      authority: options.definitionSource.authority ? {
        name: options.definitionSource.authority.name || null,
        shortName: options.definitionSource.authority.shortName || null,
        uri: options.definitionSource.authority.uri || null,
        type: options.definitionSource.authority.type || null
      } : null,

      // Source document (where this value is defined)
      source: options.definitionSource.source ? {
        title: options.definitionSource.source.title || null,
        citation: options.definitionSource.source.citation || null,
        section: options.definitionSource.source.section || null,
        url: options.definitionSource.source.url || null,
        type: options.definitionSource.source.type || null
      } : null,

      // Version
      version: options.definitionSource.version ? {
        id: options.definitionSource.version.id || null,
        published: options.definitionSource.version.published || null
      } : null,

      // Validity period
      validity: options.definitionSource.validity ? {
        from: options.definitionSource.validity.from || null,
        to: options.definitionSource.validity.to || null,
        supersedes: options.definitionSource.validity.supersedes || null,
        supersededBy: options.definitionSource.validity.supersededBy || null
      } : null,

      // Jurisdiction scope
      jurisdiction: options.definitionSource.jurisdiction ? {
        geographic: options.definitionSource.jurisdiction.geographic || null,
        programs: Array.isArray(options.definitionSource.jurisdiction.programs)
          ? [...options.definitionSource.jurisdiction.programs] : null
      } : null,

      // Discovery origin (which field/source this value was found in)
      discoveredFrom: options.definitionSource.discoveredFrom ? {
        sourceId: options.definitionSource.discoveredFrom.sourceId || null,
        sourceName: options.definitionSource.discoveredFrom.sourceName || null,
        fieldId: options.definitionSource.discoveredFrom.fieldId || null,
        fieldName: options.definitionSource.discoveredFrom.fieldName || null,
        vocabularyUri: options.definitionSource.discoveredFrom.vocabularyUri || null,
        discoveredAt: options.definitionSource.discoveredFrom.discoveredAt || new Date().toISOString()
      } : null,

      // API suggestions for user selection
      apiSuggestions: Array.isArray(options.definitionSource.apiSuggestions)
        ? [...options.definitionSource.apiSuggestions] : [],

      // URI source tracking for modification detection
      uriSource: options.definitionSource.uriSource ? {
        uri: options.definitionSource.uriSource.uri || null,
        source: options.definitionSource.uriSource.source || null,
        label: options.definitionSource.uriSource.label || null,
        populatedAt: options.definitionSource.uriSource.populatedAt || null,
        originalValues: options.definitionSource.uriSource.originalValues
          ? JSON.parse(JSON.stringify(options.definitionSource.uriSource.originalValues)) : null
      } : null,

      modifiedFromSource: options.definitionSource.modifiedFromSource || false
    } : null;

    // Context (legacy fields, also available in definitionSource)
    this.jurisdiction = options.jurisdiction || null;
    this.validFrom = options.validFrom || null;
    this.validTo = options.validTo || null;

    // Supersession
    this.supersedes = options.supersedes || null;
    this.supersededBy = options.supersededBy || null;

    // Status
    this.status = options.status || ValueStatus.ACTIVE;

    // Metadata
    this.notes = options.notes || null;
    this.externalRefs = Array.isArray(options.externalRefs) ? [...options.externalRefs] : [];

    // Audit
    this.createdAt = options.createdAt || new Date().toISOString();
    this.createdBy = options.createdBy || null;
    this.updatedAt = options.updatedAt || new Date().toISOString();
    this.updatedBy = options.updatedBy || null;
  }

  /**
   * Check if this value has a rich definition source
   */
  get hasDefinitionSource() {
    return this.definitionSource !== null;
  }

  /**
   * Get the definition text (prefers definitionSource.term.definitionText if available)
   */
  get definitionText() {
    if (this.definitionSource?.term?.definitionText) {
      return this.definitionSource.term.definitionText;
    }
    return this.definition;
  }

  /**
   * Get the authority info if available
   */
  get authority() {
    return this.definitionSource?.authority || null;
  }

  /**
   * Get the source citation if available
   */
  get sourceCitation() {
    return this.definitionSource?.source?.citation || null;
  }

  /**
   * Get the definition status
   */
  get definitionStatus() {
    return this.definitionSource?.status || (this.definition ? 'complete' : 'stub');
  }

  /**
   * Check if this value is currently valid
   */
  get isValid() {
    if (this.status !== ValueStatus.ACTIVE) return false;

    const now = new Date().toISOString();
    if (this.validFrom && now < this.validFrom) return false;
    if (this.validTo && now > this.validTo) return false;

    return true;
  }

  /**
   * Check if this value has been superseded
   */
  get isSuperseded() {
    return this.supersededBy !== null;
  }

  toJSON() {
    const json = {
      value: this.value,
      uri: this.uri,
      term: this.term,
      definition: this.definition,
      implications: [...this.implications],
      jurisdiction: this.jurisdiction,
      validFrom: this.validFrom,
      validTo: this.validTo,
      supersedes: this.supersedes,
      supersededBy: this.supersededBy,
      status: this.status,
      notes: this.notes,
      externalRefs: [...this.externalRefs],
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy
    };

    // Include definitionSource if present
    if (this.definitionSource) {
      json.definitionSource = JSON.parse(JSON.stringify(this.definitionSource));
    }

    return json;
  }

  static fromJSON(json) {
    return new ValueDefinition(json);
  }
}

// ============================================================================
// ValueUsageEvent Class
// ============================================================================

/**
 * ValueUsageEvent - Tracks when a value is used (assigned/removed)
 */
class ValueUsageEvent {
  /**
   * @param {Object} options
   * @param {string} options.action - ValueChangeType
   * @param {string} options.value - The value involved
   * @param {string} options.recordId - Which record
   * @param {string} options.fieldId - Which field
   * @param {string} options.previousValue - Previous value (for removals)
   * @param {string} options.agent - Who made the change
   * @param {string} options.reason - Why the change was made
   * @param {string} options.timestamp - When
   */
  constructor(options = {}) {
    this.id = options.id || `vue_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    this.action = options.action || ValueChangeType.ASSIGNED;
    this.value = options.value || null;
    this.recordId = options.recordId || null;
    this.fieldId = options.fieldId || null;
    this.previousValue = options.previousValue || null;
    this.agent = options.agent || null;
    this.reason = options.reason || null;
    this.timestamp = options.timestamp || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      action: this.action,
      value: this.value,
      recordId: this.recordId,
      fieldId: this.fieldId,
      previousValue: this.previousValue,
      agent: this.agent,
      reason: this.reason,
      timestamp: this.timestamp
    };
  }

  static fromJSON(json) {
    return new ValueUsageEvent(json);
  }
}

// ============================================================================
// ValueVocabulary Class
// ============================================================================

/**
 * ValueVocabulary - A controlled set of defined values for a field
 */
class ValueVocabulary {
  /**
   * @param {Object} options
   * @param {string} options.id - Vocabulary ID
   * @param {string} options.uri - Semantic URI for this vocabulary
   * @param {string} options.name - Human-readable name
   * @param {string} options.description - What this vocabulary represents
   * @param {number} options.version - Version number
   * @param {string} options.maintainer - Who maintains this vocabulary
   * @param {string} options.externalSource - URL to external source (e.g., ISO standards)
   * @param {Object.<string, ValueDefinition>} options.values - Value definitions keyed by value
   */
  constructor(options = {}) {
    this.id = options.id || `vocab_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    this.uri = options.uri || `eo://vocabulary/${this.id}`;
    this.name = options.name || '';
    this.description = options.description || '';
    this.version = options.version || 1;
    this.maintainer = options.maintainer || null;
    this.externalSource = options.externalSource || null;

    // Values storage
    this._values = new Map();
    if (options.values) {
      for (const [key, val] of Object.entries(options.values)) {
        const valueDef = val instanceof ValueDefinition ? val : new ValueDefinition(val);
        this._values.set(key, valueDef);
      }
    }

    // Usage tracking
    this._usageHistory = [];
    if (options.usageHistory) {
      this._usageHistory = options.usageHistory.map(e =>
        e instanceof ValueUsageEvent ? e : ValueUsageEvent.fromJSON(e)
      );
    }

    // Vocabulary history (changes to the vocabulary itself)
    this._vocabularyHistory = options.vocabularyHistory || [];

    // Audit
    this.createdAt = options.createdAt || new Date().toISOString();
    this.createdBy = options.createdBy || null;
    this.updatedAt = options.updatedAt || new Date().toISOString();
    this.updatedBy = options.updatedBy || null;
  }

  /**
   * Get all value definitions
   */
  get values() {
    const obj = {};
    for (const [key, val] of this._values) {
      obj[key] = val;
    }
    return obj;
  }

  /**
   * Get list of all value strings
   */
  get valueList() {
    return Array.from(this._values.keys());
  }

  /**
   * Get count of values
   */
  get valueCount() {
    return this._values.size;
  }

  /**
   * Get active values only
   */
  get activeValues() {
    const result = {};
    for (const [key, val] of this._values) {
      if (val.isValid) {
        result[key] = val;
      }
    }
    return result;
  }

  /**
   * Check if a value is defined in this vocabulary
   */
  hasValue(value) {
    return this._values.has(value);
  }

  /**
   * Get a value definition
   */
  getValue(value) {
    return this._values.get(value) || null;
  }

  /**
   * Add or update a value definition
   */
  setValue(value, definition) {
    const valueDef = definition instanceof ValueDefinition
      ? definition
      : new ValueDefinition({ ...definition, value });

    const isNew = !this._values.has(value);
    this._values.set(value, valueDef);

    // Record vocabulary change
    this._vocabularyHistory.push({
      version: this.version,
      timestamp: new Date().toISOString(),
      change: isNew ? 'value_added' : 'value_updated',
      value,
      by: valueDef.updatedBy
    });

    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Deprecate a value
   */
  deprecateValue(value, reason, agent) {
    const valueDef = this._values.get(value);
    if (!valueDef) return this;

    valueDef.status = ValueStatus.DEPRECATED;
    valueDef.updatedAt = new Date().toISOString();
    valueDef.updatedBy = agent;
    valueDef.notes = reason;

    this._vocabularyHistory.push({
      version: this.version,
      timestamp: new Date().toISOString(),
      change: 'value_deprecated',
      value,
      reason,
      by: agent
    });

    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Supersede a value with a new one
   */
  supersedeValue(oldValue, newValue, reason, agent) {
    const oldDef = this._values.get(oldValue);
    const newDef = this._values.get(newValue);

    if (!oldDef) return this;

    oldDef.supersededBy = newValue;
    oldDef.status = ValueStatus.DEPRECATED;
    oldDef.updatedAt = new Date().toISOString();
    oldDef.updatedBy = agent;

    if (newDef) {
      newDef.supersedes = oldValue;
      newDef.updatedAt = new Date().toISOString();
    }

    this._vocabularyHistory.push({
      version: this.version,
      timestamp: new Date().toISOString(),
      change: 'value_superseded',
      oldValue,
      newValue,
      reason,
      by: agent
    });

    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Record a usage event
   */
  recordUsage(event) {
    const usageEvent = event instanceof ValueUsageEvent
      ? event
      : new ValueUsageEvent(event);
    this._usageHistory.push(usageEvent);
    return this;
  }

  /**
   * Get usage history for a specific value
   */
  getUsageHistoryForValue(value) {
    return this._usageHistory.filter(e => e.value === value);
  }

  /**
   * Get usage statistics for all values
   */
  getUsageStats() {
    const stats = {};

    for (const value of this._values.keys()) {
      const events = this.getUsageHistoryForValue(value);
      const assignments = events.filter(e => e.action === ValueChangeType.ASSIGNED).length;
      const removals = events.filter(e => e.action === ValueChangeType.REMOVED).length;

      stats[value] = {
        currentCount: assignments - removals,
        allTimeAssignments: assignments,
        allTimeRemovals: removals,
        lastUsed: events.length > 0
          ? events[events.length - 1].timestamp
          : null
      };
    }

    return stats;
  }

  /**
   * Bump version (for significant changes)
   */
  bumpVersion(reason, agent) {
    this.version++;
    this._vocabularyHistory.push({
      version: this.version,
      timestamp: new Date().toISOString(),
      change: 'version_bumped',
      reason,
      by: agent
    });
    this.updatedAt = new Date().toISOString();
    this.updatedBy = agent;
    return this;
  }

  /**
   * Get vocabulary history
   */
  get vocabularyHistory() {
    return [...this._vocabularyHistory];
  }

  /**
   * Get usage history
   */
  get usageHistory() {
    return [...this._usageHistory];
  }

  toJSON() {
    const values = {};
    for (const [key, val] of this._values) {
      values[key] = val.toJSON();
    }

    return {
      id: this.id,
      uri: this.uri,
      name: this.name,
      description: this.description,
      version: this.version,
      maintainer: this.maintainer,
      externalSource: this.externalSource,
      values,
      usageHistory: this._usageHistory.map(e => e.toJSON()),
      vocabularyHistory: [...this._vocabularyHistory],
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy
    };
  }

  static fromJSON(json) {
    return new ValueVocabulary(json);
  }
}

// ============================================================================
// VocabularyBinding Class
// ============================================================================

/**
 * VocabularyBinding - Links a field to its value vocabulary
 */
class VocabularyBinding {
  /**
   * @param {Object} options
   * @param {string} options.fieldId - Field being bound
   * @param {string} options.vocabularyUri - URI of the vocabulary
   * @param {string} options.method - How binding was created
   * @param {string} options.agent - Who created the binding
   */
  constructor(options = {}) {
    this.id = options.id || `vbind_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    this.fieldId = options.fieldId || null;
    this.vocabularyUri = options.vocabularyUri || null;
    this.method = options.method || 'manual_binding';
    this.agent = options.agent || null;
    this.notes = options.notes || null;
    this.createdAt = options.createdAt || new Date().toISOString();

    // History of vocabulary bindings for this field
    this.history = options.history || [];
  }

  /**
   * Record a binding change
   */
  recordChange(newVocabularyUri, method, agent, reason) {
    this.history.push({
      timestamp: new Date().toISOString(),
      action: 'vocabulary_bound',
      previousUri: this.vocabularyUri,
      newUri: newVocabularyUri,
      method,
      agent,
      reason
    });
    this.vocabularyUri = newVocabularyUri;
    this.method = method;
    this.agent = agent;
  }

  toJSON() {
    return {
      id: this.id,
      fieldId: this.fieldId,
      vocabularyUri: this.vocabularyUri,
      method: this.method,
      agent: this.agent,
      notes: this.notes,
      createdAt: this.createdAt,
      history: [...this.history]
    };
  }

  static fromJSON(json) {
    return new VocabularyBinding(json);
  }
}

// ============================================================================
// ValueVocabularyRegistry Class
// ============================================================================

/**
 * ValueVocabularyRegistry - Manages all value vocabularies
 */
class ValueVocabularyRegistry {
  constructor() {
    // Primary storage: uri -> ValueVocabulary
    this._vocabularies = new Map();

    // Indexes
    this._byFieldId = new Map();  // fieldId -> VocabularyBinding

    // Event listeners
    this._listeners = new Set();
  }

  /**
   * Get total count
   */
  get size() {
    return this._vocabularies.size;
  }

  /**
   * Add or update a vocabulary
   */
  add(vocabulary) {
    const vocab = vocabulary instanceof ValueVocabulary
      ? vocabulary
      : new ValueVocabulary(vocabulary);

    const isNew = !this._vocabularies.has(vocab.uri);
    this._vocabularies.set(vocab.uri, vocab);

    this._notify(isNew ? 'added' : 'updated', vocab);
    return { success: true, uri: vocab.uri, isNew };
  }

  /**
   * Get vocabulary by URI
   */
  get(uri) {
    return this._vocabularies.get(uri) || null;
  }

  /**
   * Get all vocabularies
   */
  getAll() {
    return Array.from(this._vocabularies.values());
  }

  /**
   * Bind a field to a vocabulary
   */
  bindField(fieldId, vocabularyUri, method, agent) {
    let binding = this._byFieldId.get(fieldId);

    if (binding) {
      binding.recordChange(vocabularyUri, method, agent);
    } else {
      binding = new VocabularyBinding({
        fieldId,
        vocabularyUri,
        method,
        agent
      });
      this._byFieldId.set(fieldId, binding);
    }

    this._notify('field_bound', { fieldId, vocabularyUri });
    return binding;
  }

  /**
   * Get vocabulary for a field
   */
  getVocabularyForField(fieldId) {
    const binding = this._byFieldId.get(fieldId);
    if (!binding) return null;
    return this._vocabularies.get(binding.vocabularyUri) || null;
  }

  /**
   * Get binding for a field
   */
  getBindingForField(fieldId) {
    return this._byFieldId.get(fieldId) || null;
  }

  /**
   * Get value definition for a field's value
   */
  getValueDefinition(fieldId, value) {
    const vocab = this.getVocabularyForField(fieldId);
    if (!vocab) return null;
    return vocab.getValue(value);
  }

  /**
   * Record value usage
   */
  recordValueUsage(fieldId, event) {
    const vocab = this.getVocabularyForField(fieldId);
    if (vocab) {
      vocab.recordUsage({ ...event, fieldId });
    }
  }

  /**
   * Create vocabulary from field options (e.g., SELECT field)
   */
  createFromFieldOptions(fieldId, fieldName, options, agent) {
    const vocab = new ValueVocabulary({
      name: `${fieldName} Values`,
      description: `Controlled vocabulary for ${fieldName} field`,
      maintainer: agent,
      createdBy: agent
    });

    // Add each option as a value definition
    for (const option of options) {
      const value = typeof option === 'string' ? option : option.value || option.name;
      vocab.setValue(value, {
        value,
        term: value,
        definition: typeof option === 'object' ? option.description || '' : '',
        createdBy: agent
      });
    }

    this.add(vocab);
    this.bindField(fieldId, vocab.uri, 'inferred_from_options', agent);

    return vocab;
  }

  /**
   * Export registry
   */
  export() {
    const bindings = [];
    for (const [fieldId, binding] of this._byFieldId) {
      bindings.push(binding.toJSON());
    }

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      vocabularyCount: this._vocabularies.size,
      vocabularies: this.getAll().map(v => v.toJSON()),
      bindings
    };
  }

  /**
   * Import from export data
   */
  import(data) {
    let imported = 0;
    const errors = [];

    // Import vocabularies
    for (const vocabData of (data.vocabularies || [])) {
      try {
        this.add(vocabData);
        imported++;
      } catch (e) {
        errors.push(`Failed to import vocabulary ${vocabData.uri}: ${e.message}`);
      }
    }

    // Import bindings
    for (const bindingData of (data.bindings || [])) {
      try {
        const binding = VocabularyBinding.fromJSON(bindingData);
        this._byFieldId.set(binding.fieldId, binding);
      } catch (e) {
        errors.push(`Failed to import binding for ${bindingData.fieldId}: ${e.message}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Clear registry
   */
  clear() {
    this._vocabularies.clear();
    this._byFieldId.clear();
  }

  /**
   * Subscribe to changes
   */
  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  _notify(event, data) {
    for (const listener of this._listeners) {
      try {
        listener(event, data);
      } catch (e) {
        console.error('Vocabulary registry listener error:', e);
      }
    }
  }
}

// ============================================================================
// Singleton Registry
// ============================================================================

let _vocabularyRegistry = null;

function getVocabularyRegistry() {
  if (!_vocabularyRegistry) {
    _vocabularyRegistry = new ValueVocabularyRegistry();
  }
  return _vocabularyRegistry;
}

function initVocabularyRegistry() {
  _vocabularyRegistry = new ValueVocabularyRegistry();
  return _vocabularyRegistry;
}

// ============================================================================
// Seeded Common Vocabularies
// ============================================================================

/**
 * Get common seeded vocabularies
 */
function getSeededVocabularies() {
  return [
    {
      name: 'Boolean Values',
      uri: 'eo://vocabulary/boolean',
      description: 'Standard boolean true/false values',
      maintainer: 'system',
      values: {
        'true': {
          value: 'true',
          term: 'True',
          definition: 'Affirmative, yes, enabled, active',
          implications: ['Condition is met', 'Feature is enabled']
        },
        'false': {
          value: 'false',
          term: 'False',
          definition: 'Negative, no, disabled, inactive',
          implications: ['Condition is not met', 'Feature is disabled']
        }
      }
    },
    {
      name: 'ISO 3166-1 Alpha-2 Country Codes',
      uri: 'iso:3166-1:alpha-2',
      description: 'Two-letter country codes per ISO 3166-1',
      maintainer: 'external:iso',
      externalSource: 'https://www.iso.org/iso-3166-country-codes.html',
      values: {
        'US': {
          value: 'US',
          term: 'United States of America',
          definition: 'Federal republic in North America',
          jurisdiction: 'US',
          implications: ['US Federal Law applies', 'USD currency']
        },
        'GB': {
          value: 'GB',
          term: 'United Kingdom',
          definition: 'Sovereign country in Europe',
          jurisdiction: 'UK',
          implications: ['UK Common Law applies', 'GBP currency']
        },
        'DE': {
          value: 'DE',
          term: 'Germany',
          definition: 'Federal republic in Central Europe',
          jurisdiction: 'DE',
          implications: ['German law applies', 'EUR currency', 'GDPR applies']
        },
        'FR': {
          value: 'FR',
          term: 'France',
          definition: 'Republic in Western Europe',
          jurisdiction: 'FR',
          implications: ['French law applies', 'EUR currency', 'GDPR applies']
        }
      }
    },
    {
      name: 'Priority Levels',
      uri: 'eo://vocabulary/priority',
      description: 'Standard priority classification',
      maintainer: 'system',
      values: {
        'P1': {
          value: 'P1',
          term: 'Critical',
          definition: 'Highest priority, immediate attention required',
          implications: ['4-hour SLA', 'Escalate immediately', 'All hands on deck']
        },
        'P2': {
          value: 'P2',
          term: 'High',
          definition: 'Important, address within same day',
          implications: ['24-hour SLA', 'Escalate if no progress']
        },
        'P3': {
          value: 'P3',
          term: 'Medium',
          definition: 'Standard priority, address within normal workflow',
          implications: ['72-hour SLA', 'Normal queue']
        },
        'P4': {
          value: 'P4',
          term: 'Low',
          definition: 'Non-urgent, address when time permits',
          implications: ['Best effort', 'May be deferred']
        }
      }
    },
    {
      name: 'HUD Housing Status',
      uri: 'eo://vocabulary/hud-housing-status',
      description: 'Housing status categories as defined by HUD for homeless assistance programs',
      maintainer: 'external:hud',
      externalSource: 'https://www.ecfr.gov/current/title-24/subtitle-B/chapter-V/subchapter-C/part-578',
      values: {
        'chronically_homeless': {
          value: 'chronically_homeless',
          term: 'Chronically Homeless',
          definition: 'An individual or family that is homeless and lives in a place not meant for human habitation, a safe haven, or in an emergency shelter, and has been homeless continuously for at least 12 months or on at least 4 separate occasions in the last 3 years.',
          implications: [
            'Priority for permanent supportive housing',
            'Eligible for chronic homeless set-aside beds',
            'Requires documentation of disability'
          ],
          definitionSource: {
            status: 'verified',
            populationMethod: 'api_lookup',
            term: {
              term: 'chronically_homeless',
              label: 'Chronically Homeless',
              asWritten: 'Chronically homeless',
              definitionText: 'A homeless individual with a disability who lives either in a place not meant for human habitation, a safe haven, or in an emergency shelter, or in an institutional care facility if the individual has been living in the facility for fewer than 90 days and had been living in a place not meant for human habitation, a safe haven, or in an emergency shelter immediately before entering the institutional care facility. The individual also must have been living as described above continuously for at least 12 months, or on at least four separate occasions in the last 3 years, where the combined occasions total a length of time of at least 12 months.',
              categories: ['Category 1', 'Disability Required']
            },
            authority: {
              name: 'U.S. Department of Housing and Urban Development',
              shortName: 'HUD',
              uri: 'https://www.wikidata.org/wiki/Q827381',
              type: 'federal_agency'
            },
            source: {
              title: 'Continuum of Care Program',
              citation: '24 CFR 578.3',
              section: 'Definitions',
              url: 'https://www.ecfr.gov/current/title-24/subtitle-B/chapter-V/subchapter-C/part-578/subpart-A/section-578.3',
              type: 'regulation'
            },
            validity: {
              from: '2012-12-05',
              to: null
            },
            jurisdiction: {
              geographic: 'United States',
              programs: ['CoC Program', 'ESG Program']
            }
          }
        },
        'literally_homeless': {
          value: 'literally_homeless',
          term: 'Literally Homeless (Category 1)',
          definition: 'Individual or family who lacks a fixed, regular, and adequate nighttime residence.',
          implications: [
            'Eligible for emergency shelter',
            'Eligible for transitional housing',
            'Eligible for rapid rehousing'
          ],
          definitionSource: {
            status: 'complete',
            populationMethod: 'api_lookup',
            term: {
              term: 'literally_homeless',
              label: 'Literally Homeless',
              asWritten: 'Category 1: Literally Homeless',
              definitionText: 'Individual or family who lacks a fixed, regular, and adequate nighttime residence, meaning: has a primary nighttime residence that is a public or private place not designed for or ordinarily used as a regular sleeping accommodation for human beings; or is living in a publicly or privately operated shelter designated to provide temporary living arrangements.',
              categories: ['Category 1']
            },
            authority: {
              name: 'U.S. Department of Housing and Urban Development',
              shortName: 'HUD',
              type: 'federal_agency'
            },
            source: {
              citation: '24 CFR 578.3',
              type: 'regulation'
            },
            jurisdiction: {
              geographic: 'United States',
              programs: ['CoC Program', 'ESG Program']
            }
          }
        },
        'at_risk': {
          value: 'at_risk',
          term: 'At Risk of Homelessness',
          definition: 'Individual or family at imminent risk of losing housing within 14 days.',
          implications: [
            'Eligible for homelessness prevention',
            'May require income documentation',
            'Priority based on severity of risk'
          ]
        },
        'stably_housed': {
          value: 'stably_housed',
          term: 'Stably Housed',
          definition: 'Individual or family in permanent housing with reasonable expectation of continued tenancy.',
          implications: [
            'Not eligible for homeless-dedicated housing',
            'May be eligible for other housing assistance'
          ]
        }
      }
    }
  ];
}

/**
 * Initialize registry with seeded vocabularies
 */
function initializeSeededVocabularies(registry) {
  const seeded = getSeededVocabularies();
  let count = 0;

  for (const data of seeded) {
    const vocab = new ValueVocabulary({
      ...data,
      createdBy: 'system_seed'
    });
    registry.add(vocab);
    count++;
  }

  return count;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ValueStatus,
    ValueChangeType,
    ValueDefinition,
    ValueUsageEvent,
    ValueVocabulary,
    VocabularyBinding,
    ValueVocabularyRegistry,
    getVocabularyRegistry,
    initVocabularyRegistry,
    getSeededVocabularies,
    initializeSeededVocabularies
  };
}

if (typeof window !== 'undefined') {
  window.EOValueVocabulary = {
    ValueStatus,
    ValueChangeType,
    ValueDefinition,
    ValueUsageEvent,
    ValueVocabulary,
    VocabularyBinding,
    ValueVocabularyRegistry,
    getVocabularyRegistry,
    initVocabularyRegistry,
    getSeededVocabularies,
    initializeSeededVocabularies
  };
}
