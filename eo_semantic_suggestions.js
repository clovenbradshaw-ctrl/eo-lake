/**
 * EO Semantic Suggestions - URI Suggestion Engine
 *
 * Implements the suggestion pipeline for finding semantic URIs:
 * 1. Local registry lookup (fast, authoritative) - FIRST
 * 2. External discovery (Wikidata, QUDT) - ONLY IF NEEDED
 * 3. Candidate normalization and ranking
 *
 * CRITICAL RULES:
 * - Local registry first, always
 * - External APIs are discovery only
 * - Never bind automatically
 * - Every chosen URI becomes reusable
 * - Filtering is mandatory for external results
 */

// ============================================================================
// Constants
// ============================================================================

const SuggestionSource = Object.freeze({
  LOCAL_EXACT: 'local_exact',     // Exact match in local registry
  LOCAL_ALIAS: 'local_alias',     // Alias match in local registry
  LOCAL_FUZZY: 'local_fuzzy',     // Fuzzy match in local registry
  WIKIDATA: 'wikidata',           // Wikidata API
  QUDT: 'qudt',                   // QUDT SPARQL
  COMBINED: 'combined'             // Multiple sources merged
});

const SuggestionWarning = Object.freeze({
  JURISDICTION_UNSPECIFIED: 'jurisdiction_unspecified',
  SCALE_UNKNOWN: 'scale_unknown',
  DEFINITION_MISSING: 'definition_missing',
  DEPRECATED_ENTITY: 'deprecated_entity',
  MULTIPLE_DEFINITIONS: 'multiple_definitions',
  ROLE_MISMATCH: 'role_mismatch',
  LOW_CONFIDENCE: 'low_confidence',
  REQUIRES_REVIEW: 'requires_review'
});

// External API endpoints
const WIKIDATA_SEARCH_API = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_ENTITY_API = 'https://www.wikidata.org/wiki/Special:EntityData';
const QUDT_SPARQL_ENDPOINT = 'https://www.qudt.org/fuseki/qudt/sparql';

// Wikidata entity types to KEEP (physical quantities, properties, attributes)
const WIKIDATA_ALLOWED_TYPES = new Set([
  'Q107715', // physical quantity
  'Q181175', // physical property
  'Q4373292', // measurable quantity
  'Q930933',  // attribute
  'Q126818',  // observable
  'Q1292369', // variable
  'Q30337748', // quantity kind
]);

// Wikidata entity types to DISCARD (patents, papers, sensors, methods)
const WIKIDATA_BLOCKED_TYPES = new Set([
  'Q7889',    // video game
  'Q11424',   // film
  'Q7725634', // literary work
  'Q13442814', // scholarly article
  'Q39546',   // tool
  'Q2695280', // technique
  'Q178794',  // patent
  'Q131436',  // sensor
  'Q7087',    // method
  'Q43229',   // organization
  'Q4830453', // business
  'Q5',       // human
]);

// Cache settings
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ============================================================================
// SemanticSuggestion Class
// ============================================================================

/**
 * SemanticSuggestion - Normalized candidate from any source
 */
class SemanticSuggestion {
  constructor(options = {}) {
    // Identity
    this.candidate_uri = options.candidate_uri || '';
    this.label = options.label || '';
    this.description = options.description || '';

    // Source tracking
    this.source = options.source || SuggestionSource.LOCAL_EXACT;
    this.source_uri = options.source_uri || null; // Original URI if wrapped

    // Scoring
    this.confidence = options.confidence || 0.5;
    this.score = options.score || 0;

    // EO alignment
    this.role = options.role || null;
    this.jurisdiction = options.jurisdiction || null;
    this.scale = options.scale || null;
    this.timeframe = options.timeframe || null;

    // Validation
    this.warnings = options.warnings || [];
    this.eo_gaps = options.eo_gaps || [];

    // Raw data for debugging
    this.raw_data = options.raw_data || null;

    // Usage stats (for local suggestions)
    this.usage_count = options.usage_count || 0;
    this.last_used = options.last_used || null;
  }

  /**
   * Check if this is from local registry
   */
  get isLocal() {
    return this.source.startsWith('local');
  }

  /**
   * Check if this is from external API
   */
  get isExternal() {
    return !this.isLocal;
  }

  /**
   * Check if has complete EO provenance
   */
  get hasCompleteProvenance() {
    return !!(this.jurisdiction && this.scale && this.timeframe);
  }

  toJSON() {
    return {
      candidate_uri: this.candidate_uri,
      label: this.label,
      description: this.description,
      source: this.source,
      source_uri: this.source_uri,
      confidence: this.confidence,
      score: this.score,
      role: this.role,
      jurisdiction: this.jurisdiction,
      scale: this.scale,
      timeframe: this.timeframe,
      warnings: [...this.warnings],
      eo_gaps: [...this.eo_gaps],
      usage_count: this.usage_count,
      last_used: this.last_used
    };
  }
}

// ============================================================================
// Suggestion Cache
// ============================================================================

/**
 * SuggestionCache - Self-cleaning cache for API responses
 */
class SuggestionCache {
  constructor(ttlMs = CACHE_TTL_MS) {
    this._cache = new Map();
    this._ttlMs = ttlMs;
  }

  /**
   * Get cached value
   */
  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;

    // Check expiry
    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set cached value
   */
  set(key, value) {
    this._cache.set(key, {
      value,
      expiresAt: Date.now() + this._ttlMs
    });
  }

  /**
   * Clear expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this._cache) {
      if (now > entry.expiresAt) {
        this._cache.delete(key);
      }
    }
  }

  /**
   * Clear all entries
   */
  clear() {
    this._cache.clear();
  }

  get size() {
    return this._cache.size;
  }
}

// ============================================================================
// Wikidata Service
// ============================================================================

/**
 * WikidataService - Search and retrieve Wikidata entities
 */
class WikidataService {
  constructor() {
    this._cache = new SuggestionCache();
  }

  /**
   * Search Wikidata for a term
   * @param {string} term
   * @param {Object} options
   * @returns {Promise<SemanticSuggestion[]>}
   */
  async search(term, options = {}) {
    const cacheKey = `wikidata_search:${term}`;
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        action: 'wbsearchentities',
        format: 'json',
        language: options.language || 'en',
        search: term,
        limit: options.limit || 10,
        origin: '*'
      });

      const response = await fetch(`${WIKIDATA_SEARCH_API}?${params}`);
      if (!response.ok) {
        throw new Error(`Wikidata API error: ${response.status}`);
      }

      const data = await response.json();
      const results = await this._processSearchResults(data.search || []);

      this._cache.set(cacheKey, results);
      return results;

    } catch (error) {
      console.warn('Wikidata search failed:', error.message);
      return [];
    }
  }

  /**
   * Get entity details by QID
   */
  async getEntity(qid) {
    const cacheKey = `wikidata_entity:${qid}`;
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

    try {
      const url = `${WIKIDATA_ENTITY_API}/${qid}.json`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Wikidata entity fetch error: ${response.status}`);
      }

      const data = await response.json();
      const entity = data.entities?.[qid];

      if (!entity) return null;

      const result = this._entityToSuggestion(entity);
      this._cache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.warn('Wikidata entity fetch failed:', error.message);
      return null;
    }
  }

  /**
   * Process search results with filtering
   */
  async _processSearchResults(searchResults) {
    const suggestions = [];

    for (const result of searchResults) {
      const suggestion = new SemanticSuggestion({
        candidate_uri: `https://www.wikidata.org/entity/${result.id}`,
        label: result.label || result.id,
        description: result.description || '',
        source: SuggestionSource.WIKIDATA,
        source_uri: `https://www.wikidata.org/entity/${result.id}`,
        raw_data: result
      });

      // Apply role filter (we'll do detailed filtering on selection)
      const warnings = this._checkEntityType(result);
      suggestion.warnings = warnings;

      // Add EO gaps
      suggestion.eo_gaps = [
        SuggestionWarning.JURISDICTION_UNSPECIFIED,
        SuggestionWarning.SCALE_UNKNOWN
      ];

      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * Convert full entity to suggestion
   */
  _entityToSuggestion(entity) {
    const labels = entity.labels || {};
    const descriptions = entity.descriptions || {};

    const suggestion = new SemanticSuggestion({
      candidate_uri: `https://www.wikidata.org/entity/${entity.id}`,
      label: labels.en?.value || entity.id,
      description: descriptions.en?.value || '',
      source: SuggestionSource.WIKIDATA,
      source_uri: `https://www.wikidata.org/entity/${entity.id}`,
      raw_data: entity
    });

    // Check instance-of claims for role
    const instanceOf = entity.claims?.P31 || [];
    const role = this._determineRole(instanceOf);
    suggestion.role = role;

    // Check for deprecation
    if (entity.deprecated) {
      suggestion.warnings.push(SuggestionWarning.DEPRECATED_ENTITY);
    }

    return suggestion;
  }

  /**
   * Check entity type for filtering
   */
  _checkEntityType(result) {
    const warnings = [];

    // Check concepturi for known problematic patterns
    const uri = result.concepturi || '';
    if (uri.includes('Q13442814') || // scholarly article
        result.description?.toLowerCase().includes('patent') ||
        result.description?.toLowerCase().includes('paper')) {
      warnings.push(SuggestionWarning.ROLE_MISMATCH);
    }

    return warnings;
  }

  /**
   * Determine semantic role from instance-of claims
   */
  _determineRole(instanceOfClaims) {
    for (const claim of instanceOfClaims) {
      const value = claim.mainsnak?.datavalue?.value?.id;
      if (WIKIDATA_ALLOWED_TYPES.has(value)) {
        return 'quantity';
      }
      if (WIKIDATA_BLOCKED_TYPES.has(value)) {
        return 'blocked';
      }
    }
    return 'property';
  }

  clearCache() {
    this._cache.clear();
  }
}

// ============================================================================
// QUDT Service
// ============================================================================

/**
 * QUDTService - Search QUDT for quantity kinds and units
 */
class QUDTService {
  constructor() {
    this._cache = new SuggestionCache();
  }

  /**
   * Search QUDT for a term
   */
  async search(term, options = {}) {
    const cacheKey = `qudt_search:${term}`;
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

    try {
      // SPARQL query to search for quantity kinds
      const sparql = `
        PREFIX qudt: <http://qudt.org/schema/qudt/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

        SELECT DISTINCT ?uri ?label ?description WHERE {
          ?uri a qudt:QuantityKind .
          ?uri rdfs:label ?label .
          OPTIONAL { ?uri skos:definition ?description }
          FILTER(LANG(?label) = "en" || LANG(?label) = "")
          FILTER(CONTAINS(LCASE(?label), LCASE("${this._escapeSparql(term)}")))
        }
        LIMIT ${options.limit || 10}
      `;

      const params = new URLSearchParams({
        query: sparql,
        format: 'json'
      });

      const response = await fetch(`${QUDT_SPARQL_ENDPOINT}?${params}`);
      if (!response.ok) {
        throw new Error(`QUDT API error: ${response.status}`);
      }

      const data = await response.json();
      const results = this._processSparqlResults(data);

      this._cache.set(cacheKey, results);
      return results;

    } catch (error) {
      console.warn('QUDT search failed:', error.message);
      return [];
    }
  }

  /**
   * Get QUDT quantity kind by URI
   */
  async getQuantityKind(uri) {
    const cacheKey = `qudt_qk:${uri}`;
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

    try {
      const sparql = `
        PREFIX qudt: <http://qudt.org/schema/qudt/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

        SELECT ?label ?description ?unit WHERE {
          <${uri}> rdfs:label ?label .
          OPTIONAL { <${uri}> skos:definition ?description }
          OPTIONAL { <${uri}> qudt:applicableUnit ?unit }
          FILTER(LANG(?label) = "en" || LANG(?label) = "")
        }
        LIMIT 1
      `;

      const params = new URLSearchParams({
        query: sparql,
        format: 'json'
      });

      const response = await fetch(`${QUDT_SPARQL_ENDPOINT}?${params}`);
      if (!response.ok) return null;

      const data = await response.json();
      const bindings = data.results?.bindings?.[0];

      if (!bindings) return null;

      const result = new SemanticSuggestion({
        candidate_uri: uri,
        label: bindings.label?.value || '',
        description: bindings.description?.value || '',
        source: SuggestionSource.QUDT,
        source_uri: uri,
        role: 'quantity',
        raw_data: bindings
      });

      this._cache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.warn('QUDT fetch failed:', error.message);
      return null;
    }
  }

  /**
   * Process SPARQL results
   */
  _processSparqlResults(data) {
    const bindings = data.results?.bindings || [];
    const suggestions = [];

    for (const binding of bindings) {
      suggestions.push(new SemanticSuggestion({
        candidate_uri: binding.uri?.value || '',
        label: binding.label?.value || '',
        description: binding.description?.value || '',
        source: SuggestionSource.QUDT,
        source_uri: binding.uri?.value || '',
        role: 'quantity',
        eo_gaps: [
          SuggestionWarning.JURISDICTION_UNSPECIFIED,
          SuggestionWarning.SCALE_UNKNOWN
        ],
        raw_data: binding
      }));
    }

    return suggestions;
  }

  /**
   * Escape SPARQL special characters
   */
  _escapeSparql(str) {
    return str.replace(/['"\\]/g, '\\$&');
  }

  clearCache() {
    this._cache.clear();
  }
}

// ============================================================================
// Suggestion Engine
// ============================================================================

/**
 * SuggestionEngine - Main entry point for semantic suggestions
 *
 * Pipeline:
 * 1. Local registry lookup (O(1))
 * 2. External discovery (only if needed)
 * 3. Candidate ranking
 */
class SuggestionEngine {
  constructor(options = {}) {
    this._registry = options.registry || null;
    this._wikidata = new WikidataService();
    this._qudt = new QUDTService();

    // Confidence threshold for using local results only
    this._localConfidenceThreshold = options.localConfidenceThreshold || 0.8;

    // Enable/disable external lookups
    this._enableWikidata = options.enableWikidata !== false;
    this._enableQUDT = options.enableQUDT !== false;
  }

  /**
   * Set the semantic registry
   */
  setRegistry(registry) {
    this._registry = registry;
  }

  /**
   * Get suggestions for a column
   *
   * @param {string} columnName - The column name to find meaning for
   * @param {Object} context - Additional context
   * @param {string} context.dataType - Inferred data type
   * @param {string} context.units - Detected units
   * @param {Array} context.sampleValues - Sample values
   * @param {string} context.domainHint - Domain hint
   * @returns {Promise<SemanticSuggestion[]>}
   */
  async getSuggestions(columnName, context = {}) {
    const suggestions = [];

    // Step 1: Local registry lookup (ALWAYS FIRST)
    const localResults = this._lookupLocal(columnName, context);

    // If we have high-confidence local matches, return immediately
    // This is how we scale - 80-90% of columns are repeats
    if (localResults.length > 0 && localResults[0].confidence >= this._localConfidenceThreshold) {
      return this._rankSuggestions(localResults, context);
    }

    suggestions.push(...localResults);

    // Step 2: External discovery (only if needed)
    if (localResults.length === 0 ||
        localResults[0].confidence < this._localConfidenceThreshold) {

      // Wikidata search
      if (this._enableWikidata) {
        const wikidataResults = await this._searchWikidata(columnName, context);
        suggestions.push(...wikidataResults);
      }

      // QUDT search (for numeric/quantity columns)
      if (this._enableQUDT && this._isNumericType(context.dataType)) {
        const qudtResults = await this._searchQUDT(columnName, context);
        suggestions.push(...qudtResults);
      }
    }

    // Step 3: Rank and return
    return this._rankSuggestions(suggestions, context);
  }

  /**
   * Step 1: Local registry lookup
   */
  _lookupLocal(columnName, context = {}) {
    if (!this._registry) return [];

    const results = this._registry.lookup(columnName, {
      fuzzy: true,
      status: ['stable', 'provisional', 'protected']
    });

    return results.map(r => new SemanticSuggestion({
      candidate_uri: r.semantic.id,
      label: r.semantic.canonical_label || r.semantic.term,
      description: r.semantic.definition,
      source: r.source,
      confidence: r.score,
      role: r.semantic.role,
      jurisdiction: r.semantic.jurisdiction,
      scale: r.semantic.scale,
      timeframe: r.semantic.timeframe,
      warnings: r.semantic.getProvenanceWarnings(),
      usage_count: r.semantic.usage_stats.bindings,
      last_used: r.semantic.usage_stats.last_used
    }));
  }

  /**
   * Step 2a: Wikidata search with filtering
   */
  async _searchWikidata(term, context = {}) {
    const results = await this._wikidata.search(term, { limit: 8 });

    // Filter out blocked roles
    const filtered = results.filter(r => {
      // Check for role mismatch warning
      if (r.warnings.includes(SuggestionWarning.ROLE_MISMATCH)) {
        return false;
      }
      return true;
    });

    // Calculate confidence based on match quality
    for (const suggestion of filtered) {
      suggestion.confidence = this._calculateWikidataConfidence(suggestion, term, context);
    }

    return filtered;
  }

  /**
   * Step 2b: QUDT search
   */
  async _searchQUDT(term, context = {}) {
    const results = await this._qudt.search(term, { limit: 5 });

    // Boost if units match
    for (const suggestion of results) {
      suggestion.confidence = this._calculateQUDTConfidence(suggestion, context);
    }

    return results;
  }

  /**
   * Step 3: Rank all suggestions
   *
   * Scoring (deterministic, explainable):
   * +0.4 exact/alias name match
   * +0.25 unit consistency (QUDT)
   * +0.15 domain match
   * +0.10 prior local usage
   * -0.3 if role != quantity/property
   */
  _rankSuggestions(suggestions, context = {}) {
    for (const suggestion of suggestions) {
      let score = suggestion.confidence || 0.5;

      // Boost for local results (+0.2)
      if (suggestion.isLocal) {
        score += 0.2;
      }

      // Boost for prior usage (+0.1 max)
      if (suggestion.usage_count > 0) {
        const usageBoost = Math.min(suggestion.usage_count * 0.02, 0.1);
        score += usageBoost;
      }

      // Boost for complete provenance (+0.1)
      if (suggestion.hasCompleteProvenance) {
        score += 0.1;
      }

      // Penalty for warnings
      score -= suggestion.warnings.length * 0.05;

      // Penalty for role mismatch
      if (suggestion.role === 'blocked') {
        score -= 0.5;
      }

      // Cap at 1.0
      suggestion.score = Math.max(0, Math.min(1, score));
    }

    // Sort by score descending
    suggestions.sort((a, b) => b.score - a.score);

    // Deduplicate by URI
    const seen = new Set();
    const unique = [];
    for (const s of suggestions) {
      if (!seen.has(s.candidate_uri)) {
        seen.add(s.candidate_uri);
        unique.push(s);
      }
    }

    return unique;
  }

  /**
   * Calculate Wikidata confidence
   */
  _calculateWikidataConfidence(suggestion, term, context) {
    let confidence = 0.4; // Base for external

    // Boost for label match
    const labelMatch = suggestion.label.toLowerCase() === term.toLowerCase();
    if (labelMatch) {
      confidence += 0.3;
    } else if (suggestion.label.toLowerCase().includes(term.toLowerCase())) {
      confidence += 0.15;
    }

    // Penalty for missing description
    if (!suggestion.description) {
      confidence -= 0.1;
      suggestion.warnings.push(SuggestionWarning.DEFINITION_MISSING);
    }

    return confidence;
  }

  /**
   * Calculate QUDT confidence
   */
  _calculateQUDTConfidence(suggestion, context) {
    let confidence = 0.5; // Base for QUDT (better structured)

    // QUDT is authoritative for quantities
    if (context.dataType === 'number' || context.dataType === 'integer') {
      confidence += 0.2;
    }

    // Boost if we detected units
    if (context.units) {
      confidence += 0.15;
    }

    return confidence;
  }

  /**
   * Check if type is numeric
   */
  _isNumericType(dataType) {
    return ['number', 'integer', 'float', 'decimal', 'number_string'].includes(dataType);
  }

  /**
   * Search all sources for a term
   */
  async searchAllSources(term, options = {}) {
    const results = await Promise.all([
      Promise.resolve(this._lookupLocal(term, options)),
      this._enableWikidata ? this._wikidata.search(term) : Promise.resolve([]),
      this._enableQUDT ? this._qudt.search(term) : Promise.resolve([])
    ]);

    const combined = [...results[0], ...results[1], ...results[2]];
    return this._rankSuggestions(combined, options);
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this._wikidata.clearCache();
    this._qudt.clearCache();
  }
}

// ============================================================================
// Batch Suggestion for Multiple Columns
// ============================================================================

/**
 * Get suggestions for multiple columns efficiently
 */
async function getSuggestionsForColumns(engine, columns, options = {}) {
  const results = new Map();
  const unmatched = [];

  // First pass: local lookup only (fast)
  for (const col of columns) {
    const context = options.contexts?.[col.name] || {};
    const local = engine._lookupLocal(col.name, context);

    if (local.length > 0 && local[0].confidence >= 0.8) {
      results.set(col.name, local);
    } else {
      unmatched.push(col);
    }
  }

  // Second pass: external lookup for unmatched (parallel, with limit)
  const batchSize = options.batchSize || 5;

  for (let i = 0; i < unmatched.length; i += batchSize) {
    const batch = unmatched.slice(i, i + batchSize);
    const promises = batch.map(col => {
      const context = options.contexts?.[col.name] || {};
      return engine.getSuggestions(col.name, context)
        .then(suggestions => ({ column: col.name, suggestions }));
    });

    const batchResults = await Promise.all(promises);
    for (const { column, suggestions } of batchResults) {
      results.set(column, suggestions);
    }
  }

  return results;
}

// ============================================================================
// Singleton Engine
// ============================================================================

let _suggestionEngine = null;

function getSuggestionEngine() {
  if (!_suggestionEngine) {
    _suggestionEngine = new SuggestionEngine();

    // Connect to semantic registry if available
    if (typeof window !== 'undefined' && window.EOSchemaSemantic) {
      _suggestionEngine.setRegistry(window.EOSchemaSemantic.getSemanticRegistry());
    }
  }
  return _suggestionEngine;
}

function initSuggestionEngine(options = {}) {
  _suggestionEngine = new SuggestionEngine(options);
  return _suggestionEngine;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SuggestionSource,
    SuggestionWarning,
    SemanticSuggestion,
    SuggestionCache,
    WikidataService,
    QUDTService,
    SuggestionEngine,
    getSuggestionsForColumns,
    getSuggestionEngine,
    initSuggestionEngine
  };
}

if (typeof window !== 'undefined') {
  window.EOSemanticSuggestions = {
    SuggestionSource,
    SuggestionWarning,
    SemanticSuggestion,
    SuggestionCache,
    WikidataService,
    QUDTService,
    SuggestionEngine,
    getSuggestionsForColumns,
    getSuggestionEngine,
    initSuggestionEngine
  };
}
