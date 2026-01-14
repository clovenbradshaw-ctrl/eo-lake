/**
 * EO Schema Semantic - Versioned Column Meaning Objects
 *
 * Implements the SchemaSemantic entity for storing column meanings
 * independent of any dataset. This is the foundation of the interpretation layer.
 *
 * EO PRINCIPLE:
 * "Datasets never contain meaning. They reference interpretation records,
 *  which reference semantic URIs."
 *
 * Key concepts:
 * - SchemaSemantic defines WHAT a column means
 * - Stored with versioned URIs: eo://schema/column/{slug}/v{n}
 * - Includes jurisdiction, scale, timeframe (9-element provenance alignment)
 * - Aligned to external URIs (Wikidata, QUDT) but authoritative locally
 */

// ============================================================================
// Constants
// ============================================================================

const SemanticStatus = Object.freeze({
  DRAFT: 'draft',           // Being worked on, not for production use
  PROVISIONAL: 'provisional', // Can be used but may change
  STABLE: 'stable',         // Reviewed and approved
  DEPRECATED: 'deprecated',  // No longer recommended
  PROTECTED: 'protected'     // Admin-only modifications (seeded/curated)
});

const SemanticRole = Object.freeze({
  QUANTITY: 'quantity',       // Measurable physical quantity
  PROPERTY: 'property',       // Attribute or characteristic
  IDENTIFIER: 'identifier',   // ID, code, key
  TEMPORAL: 'temporal',       // Date, time, timestamp
  SPATIAL: 'spatial',         // Location, coordinates
  CATEGORICAL: 'categorical', // Enum, category, status
  TEXTUAL: 'textual'          // Free text, description
});

// ============================================================================
// SchemaSemantic Class
// ============================================================================

/**
 * SchemaSemantic - Column meaning object (independent of any dataset)
 *
 * This represents WHAT a column means, not which dataset uses it.
 */
class SchemaSemantic {
  /**
   * @param {Object} options
   * @param {string} options.id - URI format: "eo://schema/column/{slug}/v{version}"
   * @param {string} options.term - Canonical term name
   * @param {string} options.definition - Human-readable definition
   * @param {string} options.jurisdiction - Authority (e.g., "WMO", "ISO", "internal")
   * @param {string} options.scale - Scope (site, region, global, etc.)
   * @param {string} options.timeframe - Temporal scope (instantaneous, period, open-ended)
   * @param {string[]} options.background - Assumed conditions, known confounders
   * @param {string[]} options.aliases - Alternative names for matching
   * @param {string[]} options.aligned_uris - External URIs (Wikidata, QUDT, etc.)
   * @param {number} options.version - Schema version (incremented on changes)
   * @param {string} options.status - SemanticStatus value
   * @param {string} options.role - SemanticRole value
   */
  constructor(options = {}) {
    // Generate ID if not provided
    this.id = options.id || generateSemanticId(options.term || 'unknown', options.version || 1);

    // Core identity
    this.term = options.term || '';
    this.canonical_label = options.canonical_label || options.term || '';
    this.definition = options.definition || '';

    // EO 9-element provenance alignment
    this.jurisdiction = options.jurisdiction || null;
    this.scale = options.scale || null;
    this.timeframe = options.timeframe || null;
    this.background = Array.isArray(options.background) ? [...options.background] : [];

    // Aliases for matching (lowercase normalized)
    this.aliases = Array.isArray(options.aliases) ? [...options.aliases] : [];

    // External alignments
    this.aligned_uris = Array.isArray(options.aligned_uris) ? [...options.aligned_uris] : [];

    // Version and status
    this.version = options.version || 1;
    this.status = options.status || SemanticStatus.DRAFT;
    this.role = options.role || SemanticRole.PROPERTY;

    // Usage tracking (for ranking)
    this.usage_stats = {
      datasets: options.usage_stats?.datasets || 0,
      bindings: options.usage_stats?.bindings || 0,
      last_used: options.usage_stats?.last_used || null,
      created_at: options.usage_stats?.created_at || new Date().toISOString()
    };

    // Audit
    this.created_at = options.created_at || new Date().toISOString();
    this.created_by = options.created_by || 'unknown';
    this.updated_at = options.updated_at || new Date().toISOString();
    this.updated_by = options.updated_by || null;

    // Domain hints for matching
    this.domain_hints = Array.isArray(options.domain_hints) ? [...options.domain_hints] : [];

    // Unit information (for QUDT alignment)
    this.unit_uri = options.unit_uri || null;
    this.quantity_kind_uri = options.quantity_kind_uri || null;
  }

  /**
   * Get the slug from the semantic URI
   */
  get slug() {
    const match = this.id.match(/eo:\/\/schema\/column\/([^/]+)\/v\d+/);
    return match ? match[1] : this.term?.toLowerCase().replace(/\s+/g, '_') || 'unknown';
  }

  /**
   * Check if this semantic has complete provenance
   */
  get hasCompleteProvenance() {
    return !!(this.jurisdiction && this.scale && this.timeframe);
  }

  /**
   * Get provenance completeness warnings
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
   * Check if a term matches this semantic (for local lookup)
   */
  matchesTerm(searchTerm) {
    const normalized = searchTerm.toLowerCase().trim();

    // Exact term match
    if (this.term.toLowerCase() === normalized) return { match: true, score: 1.0 };

    // Canonical label match
    if (this.canonical_label.toLowerCase() === normalized) return { match: true, score: 0.95 };

    // Alias match
    for (const alias of this.aliases) {
      if (alias.toLowerCase() === normalized) return { match: true, score: 0.9 };
    }

    // Partial match
    if (this.term.toLowerCase().includes(normalized) ||
        normalized.includes(this.term.toLowerCase())) {
      return { match: true, score: 0.7 };
    }

    // Alias partial match
    for (const alias of this.aliases) {
      if (alias.toLowerCase().includes(normalized) ||
          normalized.includes(alias.toLowerCase())) {
        return { match: true, score: 0.6 };
      }
    }

    return { match: false, score: 0 };
  }

  /**
   * Increment usage stats
   */
  recordUsage() {
    this.usage_stats.bindings++;
    this.usage_stats.last_used = new Date().toISOString();
  }

  /**
   * Create grounding for event store
   */
  getGrounding() {
    return {
      references: [],
      derivation: null
    };
  }

  /**
   * Convert to event payload
   */
  toEventPayload() {
    return {
      semantic_uri: this.id,
      term: this.term,
      canonical_label: this.canonical_label,
      definition: this.definition,
      jurisdiction: this.jurisdiction,
      scale: this.scale,
      timeframe: this.timeframe,
      background: [...this.background],
      aliases: [...this.aliases],
      aligned_uris: [...this.aligned_uris],
      version: this.version,
      status: this.status,
      role: this.role
    };
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      term: this.term,
      canonical_label: this.canonical_label,
      definition: this.definition,
      jurisdiction: this.jurisdiction,
      scale: this.scale,
      timeframe: this.timeframe,
      background: [...this.background],
      aliases: [...this.aliases],
      aligned_uris: [...this.aligned_uris],
      version: this.version,
      status: this.status,
      role: this.role,
      usage_stats: { ...this.usage_stats },
      created_at: this.created_at,
      created_by: this.created_by,
      updated_at: this.updated_at,
      updated_by: this.updated_by,
      domain_hints: [...this.domain_hints],
      unit_uri: this.unit_uri,
      quantity_kind_uri: this.quantity_kind_uri
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json) {
    return new SchemaSemantic(json);
  }
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate semantic URI
 * @param {string} term - The term name
 * @param {number} version - Version number
 * @returns {string} URI in format eo://schema/column/{slug}/v{version}
 */
function generateSemanticId(term, version = 1) {
  const slug = term.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `eo://schema/column/${slug}/v${version}`;
}

/**
 * Parse semantic URI
 * @param {string} uri - The semantic URI
 * @returns {{ term: string, version: number } | null}
 */
function parseSemanticUri(uri) {
  const match = uri.match(/^eo:\/\/schema\/column\/([^/]+)\/v(\d+)$/);
  if (!match) return null;
  return {
    term: match[1],
    version: parseInt(match[2], 10)
  };
}

/**
 * Check if URI is valid semantic URI
 */
function isValidSemanticUri(uri) {
  return /^eo:\/\/schema\/column\/[^/]+\/v\d+$/.test(uri);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a SchemaSemantic
 * @param {SchemaSemantic} semantic
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateSchemaSemantic(semantic) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!semantic.id) {
    errors.push('Semantic must have an id');
  } else if (!isValidSemanticUri(semantic.id)) {
    errors.push('Invalid semantic URI format');
  }

  if (!semantic.term || semantic.term.trim() === '') {
    errors.push('Semantic must have a term');
  }

  if (!semantic.definition || semantic.definition.trim() === '') {
    errors.push('Semantic must have a definition');
  }

  // Version must be positive integer
  if (!Number.isInteger(semantic.version) || semantic.version < 1) {
    errors.push('Version must be a positive integer');
  }

  // Status must be valid
  if (!Object.values(SemanticStatus).includes(semantic.status)) {
    errors.push(`Invalid status: ${semantic.status}`);
  }

  // Warnings for missing provenance
  if (!semantic.jurisdiction) {
    warnings.push('jurisdiction_unspecified');
  }
  if (!semantic.scale) {
    warnings.push('scale_unspecified');
  }
  if (!semantic.timeframe) {
    warnings.push('timeframe_unspecified');
  }
  if (semantic.background.length === 0) {
    warnings.push('background_empty');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check for version conflict
 * @param {SchemaSemantic} existing - Existing semantic
 * @param {SchemaSemantic} updated - Updated semantic
 * @returns {boolean} True if there's a version conflict
 */
function checkVersionConflict(existing, updated) {
  // Definition changed without version bump
  if (existing.definition !== updated.definition &&
      existing.version >= updated.version) {
    return true;
  }
  return false;
}

// ============================================================================
// Local Semantic Registry
// ============================================================================

/**
 * LocalSemanticRegistry - The app's semantic muscle memory
 *
 * This is the key to scale. 80-90% of columns are repeats.
 * Always try local registry first before external APIs.
 */
class LocalSemanticRegistry {
  constructor() {
    // Primary storage: id -> SchemaSemantic
    this._semantics = new Map();

    // Indexes for fast lookup
    this._byTerm = new Map();        // term -> Set<id>
    this._byAlias = new Map();       // alias -> Set<id>
    this._byStatus = new Map();      // status -> Set<id>
    this._byJurisdiction = new Map(); // jurisdiction -> Set<id>
    this._byExternalUri = new Map();  // external_uri -> id

    // Initialize status indexes
    for (const status of Object.values(SemanticStatus)) {
      this._byStatus.set(status, new Set());
    }

    // Event handlers
    this._listeners = new Set();
  }

  /**
   * Get total count
   */
  get size() {
    return this._semantics.size;
  }

  /**
   * Add or update a semantic
   * @param {SchemaSemantic} semantic
   * @returns {{ success: boolean, id: string, isNew: boolean }}
   */
  add(semantic) {
    const isNew = !this._semantics.has(semantic.id);

    // Remove from indexes if updating
    if (!isNew) {
      this._removeFromIndexes(this._semantics.get(semantic.id));
    }

    // Store
    this._semantics.set(semantic.id, semantic);

    // Index
    this._addToIndexes(semantic);

    // Notify listeners
    this._notify(isNew ? 'added' : 'updated', semantic);

    return { success: true, id: semantic.id, isNew };
  }

  /**
   * Get semantic by ID
   * @param {string} id
   * @returns {SchemaSemantic | null}
   */
  get(id) {
    return this._semantics.get(id) || null;
  }

  /**
   * Get all semantics
   * @returns {SchemaSemantic[]}
   */
  getAll() {
    return Array.from(this._semantics.values());
  }

  /**
   * Get semantics by status
   * @param {string} status
   * @returns {SchemaSemantic[]}
   */
  getByStatus(status) {
    const ids = this._byStatus.get(status);
    if (!ids) return [];
    return Array.from(ids).map(id => this._semantics.get(id)).filter(Boolean);
  }

  /**
   * Get semantics by term (exact match)
   * @param {string} term
   * @returns {SchemaSemantic[]}
   */
  getByTerm(term) {
    const normalized = term.toLowerCase().trim();
    const ids = this._byTerm.get(normalized);
    if (!ids) return [];
    return Array.from(ids).map(id => this._semantics.get(id)).filter(Boolean);
  }

  /**
   * Get latest version of a term
   * @param {string} term
   * @returns {SchemaSemantic | null}
   */
  getLatestVersion(term) {
    const semantics = this.getByTerm(term);
    if (semantics.length === 0) return null;
    return semantics.reduce((latest, current) =>
      current.version > latest.version ? current : latest
    );
  }

  /**
   * Get all versions of a term
   * @param {string} term
   * @returns {SchemaSemantic[]}
   */
  getVersionHistory(term) {
    return this.getByTerm(term).sort((a, b) => b.version - a.version);
  }

  /**
   * Local registry lookup - O(1) for exact matches
   * This is the primary lookup method for suggestions.
   *
   * @param {string} searchTerm - The column name to search for
   * @param {Object} options - Search options
   * @returns {Array<{ semantic: SchemaSemantic, score: number, source: string }>}
   */
  lookup(searchTerm, options = {}) {
    const normalized = searchTerm.toLowerCase().trim();
    const results = [];

    // Step 1: Exact term match
    const exactMatches = this._byTerm.get(normalized);
    if (exactMatches) {
      for (const id of exactMatches) {
        const semantic = this._semantics.get(id);
        if (semantic) {
          results.push({ semantic, score: 1.0, source: 'local_exact' });
        }
      }
    }

    // Step 2: Alias match
    const aliasMatches = this._byAlias.get(normalized);
    if (aliasMatches) {
      for (const id of aliasMatches) {
        if (!results.find(r => r.semantic.id === id)) {
          const semantic = this._semantics.get(id);
          if (semantic) {
            results.push({ semantic, score: 0.9, source: 'local_alias' });
          }
        }
      }
    }

    // Step 3: Fuzzy match (if enabled and no exact matches)
    if (options.fuzzy !== false && results.length === 0) {
      for (const semantic of this._semantics.values()) {
        const matchResult = semantic.matchesTerm(searchTerm);
        if (matchResult.match && matchResult.score >= 0.5) {
          results.push({
            semantic,
            score: matchResult.score,
            source: 'local_fuzzy'
          });
        }
      }
    }

    // Boost by usage
    for (const result of results) {
      const usageBoost = Math.min(result.semantic.usage_stats.bindings * 0.01, 0.1);
      result.score = Math.min(result.score + usageBoost, 1.0);
    }

    // Filter by status if specified
    if (options.status) {
      const allowedStatuses = Array.isArray(options.status) ? options.status : [options.status];
      return results.filter(r => allowedStatuses.includes(r.semantic.status));
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Get semantic by external URI
   * @param {string} externalUri
   * @returns {SchemaSemantic | null}
   */
  getByExternalUri(externalUri) {
    const id = this._byExternalUri.get(externalUri);
    return id ? this._semantics.get(id) : null;
  }

  /**
   * Create a new version of an existing semantic
   * @param {string} existingId
   * @param {Object} changes
   * @returns {SchemaSemantic}
   */
  createNewVersion(existingId, changes) {
    const existing = this._semantics.get(existingId);
    if (!existing) {
      throw new Error(`Semantic not found: ${existingId}`);
    }

    const newVersion = existing.version + 1;
    const newId = generateSemanticId(existing.term, newVersion);

    const newSemantic = new SchemaSemantic({
      ...existing.toJSON(),
      ...changes,
      id: newId,
      version: newVersion,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    this.add(newSemantic);
    return newSemantic;
  }

  /**
   * Record usage of a semantic
   * @param {string} id
   */
  recordUsage(id) {
    const semantic = this._semantics.get(id);
    if (semantic) {
      semantic.recordUsage();
      this._notify('usage_recorded', semantic);
    }
  }

  /**
   * Deprecate a semantic
   * @param {string} id
   * @param {string} reason
   * @param {string} actor
   */
  deprecate(id, reason, actor) {
    const semantic = this._semantics.get(id);
    if (!semantic) return;

    this._removeFromIndexes(semantic);

    semantic.status = SemanticStatus.DEPRECATED;
    semantic.updated_at = new Date().toISOString();
    semantic.updated_by = actor;

    this._addToIndexes(semantic);
    this._notify('deprecated', semantic);
  }

  /**
   * Export registry to JSON
   */
  export() {
    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      count: this._semantics.size,
      semantics: Array.from(this._semantics.values()).map(s => s.toJSON())
    };
  }

  /**
   * Import from JSON
   * @param {Object} data
   * @returns {{ imported: number, errors: string[] }}
   */
  import(data) {
    const errors = [];
    let imported = 0;

    const semantics = data.semantics || data;
    for (const item of (Array.isArray(semantics) ? semantics : [])) {
      try {
        const semantic = SchemaSemantic.fromJSON(item);
        const validation = validateSchemaSemantic(semantic);
        if (validation.valid) {
          this.add(semantic);
          imported++;
        } else {
          errors.push(`${item.id}: ${validation.errors.join(', ')}`);
        }
      } catch (e) {
        errors.push(`Failed to import: ${e.message}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Clear registry
   */
  clear() {
    this._semantics.clear();
    this._byTerm.clear();
    this._byAlias.clear();
    this._byExternalUri.clear();
    for (const status of Object.values(SemanticStatus)) {
      this._byStatus.set(status, new Set());
    }
    this._byJurisdiction.clear();
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

  _addToIndexes(semantic) {
    const id = semantic.id;

    // Term index
    const termKey = semantic.term.toLowerCase().trim();
    if (!this._byTerm.has(termKey)) {
      this._byTerm.set(termKey, new Set());
    }
    this._byTerm.get(termKey).add(id);

    // Alias index
    for (const alias of semantic.aliases) {
      const aliasKey = alias.toLowerCase().trim();
      if (!this._byAlias.has(aliasKey)) {
        this._byAlias.set(aliasKey, new Set());
      }
      this._byAlias.get(aliasKey).add(id);
    }

    // Status index
    if (this._byStatus.has(semantic.status)) {
      this._byStatus.get(semantic.status).add(id);
    }

    // Jurisdiction index
    if (semantic.jurisdiction) {
      if (!this._byJurisdiction.has(semantic.jurisdiction)) {
        this._byJurisdiction.set(semantic.jurisdiction, new Set());
      }
      this._byJurisdiction.get(semantic.jurisdiction).add(id);
    }

    // External URI index
    for (const uri of semantic.aligned_uris) {
      this._byExternalUri.set(uri, id);
    }
  }

  _removeFromIndexes(semantic) {
    const id = semantic.id;

    // Term index
    const termKey = semantic.term.toLowerCase().trim();
    this._byTerm.get(termKey)?.delete(id);

    // Alias index
    for (const alias of semantic.aliases) {
      const aliasKey = alias.toLowerCase().trim();
      this._byAlias.get(aliasKey)?.delete(id);
    }

    // Status index
    this._byStatus.get(semantic.status)?.delete(id);

    // Jurisdiction index
    if (semantic.jurisdiction) {
      this._byJurisdiction.get(semantic.jurisdiction)?.delete(id);
    }

    // External URI index
    for (const uri of semantic.aligned_uris) {
      if (this._byExternalUri.get(uri) === id) {
        this._byExternalUri.delete(uri);
      }
    }
  }

  _notify(event, semantic) {
    for (const listener of this._listeners) {
      try {
        listener(event, semantic);
      } catch (e) {
        console.error('Registry listener error:', e);
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new SchemaSemantic
 * @param {Object} options
 * @returns {SchemaSemantic}
 */
function createSchemaSemantic(options) {
  return new SchemaSemantic(options);
}

/**
 * Create semantic from external URI (Wikidata/QUDT)
 * This wraps an external URI into a local SchemaSemantic
 */
function createSemanticFromExternal(externalData, userAdditions = {}) {
  return new SchemaSemantic({
    term: externalData.label,
    canonical_label: externalData.label,
    definition: externalData.description || externalData.definition || '',
    aligned_uris: [externalData.uri],
    status: SemanticStatus.PROVISIONAL,
    role: externalData.role || SemanticRole.PROPERTY,
    jurisdiction: userAdditions.jurisdiction,
    scale: userAdditions.scale,
    timeframe: userAdditions.timeframe,
    background: userAdditions.background || [],
    created_by: userAdditions.created_by || 'user'
  });
}

// ============================================================================
// Seeded Common Semantics
// ============================================================================

/**
 * Get common seeded semantics for initial registry population
 */
function getSeededSemantics() {
  return [
    // Common quantities
    {
      term: 'surface_air_temperature',
      canonical_label: 'Surface air temperature',
      definition: 'Air temperature measured 2m above ground, shielded from direct radiation.',
      aliases: ['air temperature', 'temp', 'temperature', 't2m', 'air_temp'],
      jurisdiction: 'WMO',
      scale: 'site',
      timeframe: 'instantaneous',
      background: ['sensor_height_2m', 'shielded'],
      aligned_uris: [
        'https://www.wikidata.org/entity/Q11466',
        'http://qudt.org/vocab/quantitykind/AirTemperature'
      ],
      status: SemanticStatus.STABLE,
      role: SemanticRole.QUANTITY
    },
    {
      term: 'relative_humidity',
      canonical_label: 'Relative humidity',
      definition: 'Water vapor pressure as fraction of saturation pressure at current temperature.',
      aliases: ['humidity', 'rh', 'relative_humidity', 'rel_humidity'],
      jurisdiction: 'WMO',
      scale: 'site',
      timeframe: 'instantaneous',
      background: ['sensor_height_2m'],
      aligned_uris: [
        'https://www.wikidata.org/entity/Q170088',
        'http://qudt.org/vocab/quantitykind/RelativeHumidity'
      ],
      status: SemanticStatus.STABLE,
      role: SemanticRole.QUANTITY
    },
    {
      term: 'atmospheric_pressure',
      canonical_label: 'Atmospheric pressure',
      definition: 'Pressure exerted by the weight of the atmosphere.',
      aliases: ['pressure', 'barometric_pressure', 'air_pressure', 'atm_pressure'],
      jurisdiction: 'WMO',
      scale: 'site',
      timeframe: 'instantaneous',
      background: ['station_level'],
      aligned_uris: [
        'https://www.wikidata.org/entity/Q8097',
        'http://qudt.org/vocab/quantitykind/AtmosphericPressure'
      ],
      status: SemanticStatus.STABLE,
      role: SemanticRole.QUANTITY
    },
    {
      term: 'timestamp',
      canonical_label: 'Timestamp',
      definition: 'Point in time when an observation or event occurred.',
      aliases: ['time', 'datetime', 'date_time', 'observed_at', 'recorded_at', 'ts'],
      jurisdiction: 'ISO',
      scale: 'universal',
      timeframe: 'instantaneous',
      background: ['ISO8601'],
      aligned_uris: ['https://www.wikidata.org/entity/Q186885'],
      status: SemanticStatus.STABLE,
      role: SemanticRole.TEMPORAL
    },
    {
      term: 'identifier',
      canonical_label: 'Identifier',
      definition: 'Unique identifier for an entity.',
      aliases: ['id', 'ID', 'uid', 'uuid', 'key', 'code'],
      jurisdiction: 'internal',
      scale: 'system',
      timeframe: 'persistent',
      background: [],
      aligned_uris: ['https://www.wikidata.org/entity/Q6545185'],
      status: SemanticStatus.STABLE,
      role: SemanticRole.IDENTIFIER
    },
    {
      term: 'count',
      canonical_label: 'Count',
      definition: 'Total number of items or occurrences.',
      aliases: ['number', 'quantity', 'total', 'n', 'num'],
      jurisdiction: 'internal',
      scale: 'variable',
      timeframe: 'variable',
      background: [],
      aligned_uris: ['https://www.wikidata.org/entity/Q82799'],
      status: SemanticStatus.STABLE,
      role: SemanticRole.QUANTITY
    },
    {
      term: 'name',
      canonical_label: 'Name',
      definition: 'Human-readable label or title.',
      aliases: ['label', 'title', 'display_name'],
      jurisdiction: 'internal',
      scale: 'variable',
      timeframe: 'persistent',
      background: [],
      aligned_uris: ['https://www.wikidata.org/entity/Q82799'],
      status: SemanticStatus.STABLE,
      role: SemanticRole.TEXTUAL
    },
    {
      term: 'description',
      canonical_label: 'Description',
      definition: 'Free-text explanation or summary.',
      aliases: ['desc', 'summary', 'notes', 'comment', 'comments'],
      jurisdiction: 'internal',
      scale: 'variable',
      timeframe: 'variable',
      background: [],
      aligned_uris: [],
      status: SemanticStatus.STABLE,
      role: SemanticRole.TEXTUAL
    },
    {
      term: 'status',
      canonical_label: 'Status',
      definition: 'Current state or condition.',
      aliases: ['state', 'condition', 'stage', 'phase'],
      jurisdiction: 'internal',
      scale: 'variable',
      timeframe: 'snapshot',
      background: [],
      aligned_uris: [],
      status: SemanticStatus.STABLE,
      role: SemanticRole.CATEGORICAL
    },
    {
      term: 'latitude',
      canonical_label: 'Latitude',
      definition: 'Geographic coordinate specifying north-south position.',
      aliases: ['lat', 'y'],
      jurisdiction: 'ISO',
      scale: 'site',
      timeframe: 'persistent',
      background: ['WGS84'],
      aligned_uris: [
        'https://www.wikidata.org/entity/Q34027',
        'http://qudt.org/vocab/quantitykind/Latitude'
      ],
      status: SemanticStatus.STABLE,
      role: SemanticRole.SPATIAL
    },
    {
      term: 'longitude',
      canonical_label: 'Longitude',
      definition: 'Geographic coordinate specifying east-west position.',
      aliases: ['lon', 'lng', 'long', 'x'],
      jurisdiction: 'ISO',
      scale: 'site',
      timeframe: 'persistent',
      background: ['WGS84'],
      aligned_uris: [
        'https://www.wikidata.org/entity/Q36477',
        'http://qudt.org/vocab/quantitykind/Longitude'
      ],
      status: SemanticStatus.STABLE,
      role: SemanticRole.SPATIAL
    }
  ];
}

/**
 * Initialize registry with seeded semantics
 */
function initializeSeededRegistry(registry) {
  const seeded = getSeededSemantics();
  let count = 0;

  for (const data of seeded) {
    const semantic = new SchemaSemantic({
      ...data,
      status: SemanticStatus.PROTECTED,
      version: 1,
      created_by: 'system_seed'
    });
    registry.add(semantic);
    count++;
  }

  return count;
}

// ============================================================================
// Singleton Registry
// ============================================================================

let _semanticRegistry = null;

function getSemanticRegistry() {
  if (!_semanticRegistry) {
    _semanticRegistry = new LocalSemanticRegistry();
    // Initialize with seeded semantics
    initializeSeededRegistry(_semanticRegistry);
  }
  return _semanticRegistry;
}

function initSemanticRegistry(options = {}) {
  _semanticRegistry = new LocalSemanticRegistry();
  if (options.seed !== false) {
    initializeSeededRegistry(_semanticRegistry);
  }
  return _semanticRegistry;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SemanticStatus,
    SemanticRole,
    SchemaSemantic,
    LocalSemanticRegistry,
    generateSemanticId,
    parseSemanticUri,
    isValidSemanticUri,
    validateSchemaSemantic,
    checkVersionConflict,
    createSchemaSemantic,
    createSemanticFromExternal,
    getSeededSemantics,
    initializeSeededRegistry,
    getSemanticRegistry,
    initSemanticRegistry
  };
}

if (typeof window !== 'undefined') {
  window.EOSchemaSemantic = {
    SemanticStatus,
    SemanticRole,
    SchemaSemantic,
    LocalSemanticRegistry,
    generateSemanticId,
    parseSemanticUri,
    isValidSemanticUri,
    validateSchemaSemantic,
    checkVersionConflict,
    createSchemaSemantic,
    createSemanticFromExternal,
    getSeededSemantics,
    initializeSeededRegistry,
    getSemanticRegistry,
    initSemanticRegistry
  };
}
