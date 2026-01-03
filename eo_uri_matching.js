/**
 * EO URI Matching Service - Search APIs for URI matches with quality scoring
 *
 * When keys are imported into definitions, this service searches external APIs
 * (Wikidata, eCFR, Federal Register, etc.) and provides:
 *
 * 1. Match quality scoring (how good of a match is each URI result)
 * 2. Field coverage analysis (how many of the 9 definition fields can be populated)
 * 3. Modification tracking (detect when definition differs from original URI source)
 *
 * The 9 definition fields that can be populated from URIs:
 * 1. term - definitionText, asWritten, categories
 * 2. authority - name, shortName, uri, type
 * 3. source - title, citation, section, url, type
 * 4. validity - from, to, supersedes, supersededBy
 * 5. jurisdiction - geographic, programs
 * 6. version - id, published
 * 7. status - (derived)
 * 8. populationMethod - (derived)
 * 9. discoveredFrom - (from import context)
 */

// ============================================================================
// SECTION I: Configuration
// ============================================================================

const URIMatchingConfig = {
  // Minimum confidence threshold to show a match
  MIN_MATCH_CONFIDENCE: 0.25,

  // Weights for calculating match quality score
  QUALITY_WEIGHTS: {
    termSimilarity: 0.35,      // How similar the term is to query
    descriptionMatch: 0.20,    // If description/definition text matches
    authorityType: 0.15,       // Bonus for authoritative sources
    regulatorySource: 0.15,    // Bonus for regulatory (eCFR, FR) vs concept
    fieldCoverage: 0.15        // Bonus for more fields available
  },

  // Field coverage scoring - which fields each source can typically provide
  SOURCE_FIELD_COVERAGE: {
    wikidata: ['authority.name', 'authority.uri', 'authority.type', 'validity.from', 'jurisdiction.geographic'],
    dbpedia: ['authority.name', 'authority.uri', 'term.definitionText'],
    schemaOrg: ['authority.name', 'authority.uri', 'term.definitionText'],
    lov: ['authority.name', 'authority.uri', 'source.url'],
    ecfr: ['authority.name', 'authority.shortName', 'source.citation', 'source.url', 'source.title', 'source.type', 'validity.from', 'jurisdiction.geographic', 'jurisdiction.programs', 'term.definitionText'],
    federalRegister: ['authority.name', 'authority.shortName', 'source.citation', 'source.url', 'source.title', 'source.type', 'validity.from', 'version.published', 'jurisdiction.geographic', 'jurisdiction.programs']
  },

  // Total possible fields (for coverage percentage)
  TOTAL_DEFINITION_FIELDS: 9,

  // Field groups for the 9 parameters
  FIELD_GROUPS: {
    term: ['term.term', 'term.label', 'term.asWritten', 'term.definitionText', 'term.categories'],
    authority: ['authority.name', 'authority.shortName', 'authority.uri', 'authority.type'],
    source: ['source.title', 'source.citation', 'source.section', 'source.url', 'source.type'],
    validity: ['validity.from', 'validity.to', 'validity.supersedes', 'validity.supersededBy'],
    jurisdiction: ['jurisdiction.geographic', 'jurisdiction.programs'],
    version: ['version.id', 'version.published'],
    status: ['status'],
    populationMethod: ['populationMethod'],
    discoveredFrom: ['discoveredFrom']
  }
};

// ============================================================================
// SECTION II: Match Quality Scoring
// ============================================================================

/**
 * Calculate match quality score for a URI result
 */
const MatchQualityScorer = {
  /**
   * Calculate overall match quality score (0-1)
   * @param {Object} result - API search result
   * @param {string} searchTerm - Original search term
   * @param {Object} options - Additional context
   * @returns {Object} - { score, breakdown, label, color }
   */
  calculateScore(result, searchTerm, options = {}) {
    const weights = URIMatchingConfig.QUALITY_WEIGHTS;
    const breakdown = {};

    // 1. Term similarity (Levenshtein-based)
    breakdown.termSimilarity = this._calculateTermSimilarity(
      result.label || result.title || '',
      searchTerm
    );

    // 2. Description match
    breakdown.descriptionMatch = this._calculateDescriptionMatch(
      result.description || result.desc || result.snippet || '',
      searchTerm,
      options.domainHints
    );

    // 3. Authority type bonus
    breakdown.authorityType = this._getAuthorityTypeBonus(result, options);

    // 4. Regulatory source bonus
    breakdown.regulatorySource = this._getRegulatoryBonus(result);

    // 5. Field coverage bonus
    const coverage = this.calculateFieldCoverage(result);
    breakdown.fieldCoverage = coverage.percentage;

    // Calculate weighted score
    const score = Object.entries(weights).reduce((sum, [key, weight]) => {
      return sum + (breakdown[key] || 0) * weight;
    }, 0);

    // Determine quality label and color
    const { label, color } = this._getQualityLabel(score);

    return {
      score: Math.min(1, Math.max(0, score)),
      breakdown,
      label,
      color,
      fieldCoverage: coverage
    };
  },

  /**
   * Calculate term similarity using normalized Levenshtein distance
   * @private
   */
  _calculateTermSimilarity(resultLabel, searchTerm) {
    if (!resultLabel || !searchTerm) return 0;

    const a = resultLabel.toLowerCase().trim();
    const b = searchTerm.toLowerCase().trim();

    // Exact match
    if (a === b) return 1.0;

    // Contains match (high score)
    if (a.includes(b) || b.includes(a)) return 0.85;

    // Word overlap
    const aWords = new Set(a.split(/\s+/));
    const bWords = new Set(b.split(/\s+/));
    const overlap = [...aWords].filter(w => bWords.has(w)).length;
    const wordScore = overlap / Math.max(aWords.size, bWords.size);

    if (wordScore > 0.5) return 0.6 + (wordScore * 0.3);

    // Levenshtein distance for partial matches
    const distance = this._levenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    const similarity = 1 - (distance / maxLen);

    return Math.max(0, similarity * 0.7);
  },

  /**
   * Calculate description/context match score
   * @private
   */
  _calculateDescriptionMatch(description, searchTerm, domainHints) {
    if (!description) return 0;

    const desc = description.toLowerCase();
    const term = searchTerm.toLowerCase();
    let score = 0;

    // Term appears in description
    if (desc.includes(term)) {
      score += 0.5;
    }

    // Domain hints match
    if (domainHints?.domain) {
      const domainKeywords = {
        housing: ['housing', 'homeless', 'shelter', 'hud', 'rent', 'dwelling'],
        health: ['health', 'medical', 'medicare', 'medicaid', 'diagnosis', 'treatment'],
        education: ['education', 'school', 'student', 'learning', 'academic'],
        financial: ['income', 'poverty', 'tax', 'wage', 'earnings', 'financial'],
        environment: ['environment', 'epa', 'pollution', 'climate', 'emission']
      };

      const keywords = domainKeywords[domainHints.domain] || [];
      const matches = keywords.filter(kw => desc.includes(kw));
      score += Math.min(0.5, matches.length * 0.1);
    }

    return Math.min(1, score);
  },

  /**
   * Get bonus for authoritative source types
   * @private
   */
  _getAuthorityTypeBonus(result, options) {
    const source = (result.source || '').toLowerCase();
    const desc = (result.description || result.desc || '').toLowerCase();

    // Federal agency indicators
    if (/(federal|u\.s\.|department|agency|bureau|administration)/.test(desc)) {
      return 0.9;
    }

    // Regulatory source
    if (source === 'ecfr' || source === 'federal register') {
      return 0.95;
    }

    // Wikidata with good description
    if (source === 'wikidata' && result.description) {
      return 0.7;
    }

    // Schema.org
    if (source === 'schemaorg' || source === 'schema.org') {
      return 0.6;
    }

    return 0.3;
  },

  /**
   * Get bonus for regulatory vs concept sources
   * @private
   */
  _getRegulatoryBonus(result) {
    const source = (result.source || '').toLowerCase();

    if (source === 'ecfr') return 1.0;
    if (source === 'federal register' || source === 'federalregister') return 0.95;
    if (source === 'wikidata') return 0.5;
    if (source === 'dbpedia') return 0.4;
    if (source === 'schemaorg' || source === 'schema.org') return 0.3;

    return 0.2;
  },

  /**
   * Get quality label and color based on score
   * @private
   */
  _getQualityLabel(score) {
    if (score >= 0.85) return { label: 'Excellent', color: '#059669' };
    if (score >= 0.70) return { label: 'Good', color: '#10b981' };
    if (score >= 0.50) return { label: 'Fair', color: '#f59e0b' };
    if (score >= 0.35) return { label: 'Partial', color: '#f97316' };
    return { label: 'Weak', color: '#ef4444' };
  },

  /**
   * Levenshtein distance calculation
   * @private
   */
  _levenshteinDistance(a, b) {
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
  },

  /**
   * Calculate field coverage for a result
   * @param {Object} result - API search result
   * @returns {Object} - { fields, count, total, percentage, groups }
   */
  calculateFieldCoverage(result) {
    const source = (result.source || '').toLowerCase().replace(/\s+/g, '');
    const sourceKey = source === 'federalregister' ? 'federalRegister' :
                      source === 'schema.org' ? 'schemaOrg' : source;

    // Get fields this source can provide
    const availableFields = URIMatchingConfig.SOURCE_FIELD_COVERAGE[sourceKey] || [];

    // Check which field groups are covered
    const coveredGroups = new Set();
    const fieldGroups = URIMatchingConfig.FIELD_GROUPS;

    for (const field of availableFields) {
      for (const [groupName, groupFields] of Object.entries(fieldGroups)) {
        if (groupFields.some(gf => field.startsWith(groupName))) {
          coveredGroups.add(groupName);
        }
      }
    }

    // Additional fields from result data itself
    const actualFields = this._extractActualFields(result);
    for (const field of actualFields) {
      if (!availableFields.includes(field)) {
        availableFields.push(field);
      }
      for (const [groupName, groupFields] of Object.entries(fieldGroups)) {
        if (groupFields.some(gf => field.startsWith(groupName))) {
          coveredGroups.add(groupName);
        }
      }
    }

    return {
      fields: [...new Set(availableFields)],
      count: coveredGroups.size,
      total: URIMatchingConfig.TOTAL_DEFINITION_FIELDS,
      percentage: coveredGroups.size / URIMatchingConfig.TOTAL_DEFINITION_FIELDS,
      groups: [...coveredGroups]
    };
  },

  /**
   * Extract actual fields available from result data
   * @private
   */
  _extractActualFields(result) {
    const fields = [];

    // Term fields
    if (result.label || result.title) fields.push('term.label');
    if (result.description || result.desc || result.snippet) fields.push('term.definitionText');

    // Authority fields
    if (result.meta?.agencies?.[0]?.name) fields.push('authority.name');
    if (result.meta?.agencies?.[0]?.slug) fields.push('authority.shortName');
    if (result.uri) fields.push('authority.uri');

    // Source fields
    if (result.citation) fields.push('source.citation');
    if (result.url) fields.push('source.url');
    if (result.title) fields.push('source.title');

    // Validity fields
    if (result.meta?.effectiveDate || result.meta?.startDate || result.meta?.effective_on) {
      fields.push('validity.from');
    }

    // Jurisdiction fields
    if (result.meta?.cfrReferences?.length > 0) fields.push('jurisdiction.programs');

    return fields;
  }
};

// ============================================================================
// SECTION III: URI Match Result
// ============================================================================

/**
 * Represents a URI match with quality scoring and field coverage
 */
class URIMatchResult {
  constructor(rawResult, searchTerm, options = {}) {
    this.raw = rawResult;
    this.searchTerm = searchTerm;

    // Basic info
    this.uri = rawResult.uri || rawResult.url || null;
    this.source = rawResult.source || 'unknown';
    this.label = rawResult.label || rawResult.title || 'Untitled';
    this.description = rawResult.description || rawResult.desc || rawResult.snippet || '';

    // Calculate quality score
    const quality = MatchQualityScorer.calculateScore(rawResult, searchTerm, options);
    this.score = quality.score;
    this.scoreBreakdown = quality.breakdown;
    this.qualityLabel = quality.label;
    this.qualityColor = quality.color;
    this.fieldCoverage = quality.fieldCoverage;

    // Extract definition fields that can be populated
    this.populatableFields = this._extractPopulatableFields(rawResult);

    // Metadata
    this.searchedAt = new Date().toISOString();
  }

  /**
   * Extract fields that can be populated from this result
   * @private
   */
  _extractPopulatableFields(result) {
    const fields = {};

    // Term
    if (result.label || result.title) {
      fields.term = {
        label: result.label || result.title,
        definitionText: result.description || result.desc || result.snippet || null,
        asWritten: result.asWritten || null
      };
    }

    // Authority
    if (result.uri || result.meta?.agencies?.[0]) {
      fields.authority = {
        name: result.meta?.agencies?.[0]?.name || this._inferAuthorityName(result),
        shortName: result.meta?.agencies?.[0]?.slug?.toUpperCase() || null,
        uri: result.uri || null,
        type: this._inferAuthorityType(result)
      };
    }

    // Source
    if (result.citation || result.url) {
      fields.source = {
        title: result.title || null,
        citation: result.citation || null,
        section: result.meta?.section || null,
        url: result.url || null,
        type: this._inferSourceType(result)
      };
    }

    // Validity
    const effectiveDate = result.meta?.effectiveDate ||
                          result.meta?.effective_on ||
                          result.meta?.startDate ||
                          result.meta?.publicationDate;
    if (effectiveDate) {
      fields.validity = {
        from: effectiveDate,
        to: result.meta?.endDate || null
      };
    }

    // Jurisdiction
    if (result.meta?.cfrReferences || result.meta?.jurisdiction) {
      fields.jurisdiction = {
        geographic: result.meta?.jurisdiction || 'United States',
        programs: result.meta?.cfrReferences?.map(ref =>
          `${ref.title} CFR ${ref.part}`) || null
      };
    }

    // Version
    if (result.meta?.publicationDate || result.meta?.documentNumber) {
      fields.version = {
        id: result.meta?.documentNumber || null,
        published: result.meta?.publicationDate || null
      };
    }

    return fields;
  }

  /**
   * Infer authority name from result
   * @private
   */
  _inferAuthorityName(result) {
    const source = (result.source || '').toLowerCase();
    if (source === 'wikidata') return result.label;
    if (source === 'ecfr') {
      const title = result.meta?.cfrTitle;
      const titleToAgency = {
        '24': 'U.S. Department of Housing and Urban Development',
        '45': 'U.S. Department of Health and Human Services',
        '34': 'U.S. Department of Education',
        '40': 'U.S. Environmental Protection Agency',
        '26': 'Internal Revenue Service'
      };
      return titleToAgency[title] || null;
    }
    return null;
  }

  /**
   * Infer authority type from result
   * @private
   */
  _inferAuthorityType(result) {
    const source = (result.source || '').toLowerCase();
    if (source === 'ecfr' || source === 'federal register') return 'federal_agency';
    if (source === 'wikidata') {
      const desc = (result.description || '').toLowerCase();
      if (/(federal|u\.s\.|department|agency)/.test(desc)) return 'federal_agency';
      if (/(state|governor)/.test(desc)) return 'state_agency';
      if (/(standard|iso|ansi)/.test(desc)) return 'standards_body';
    }
    return 'other';
  }

  /**
   * Infer source document type
   * @private
   */
  _inferSourceType(result) {
    const source = (result.source || '').toLowerCase();
    if (source === 'ecfr') return 'regulation';
    if (source === 'federal register') {
      const type = result.meta?.type;
      return type === 'Rule' ? 'regulation' : 'guidance';
    }
    return 'other';
  }

  /**
   * Check if this result meets minimum quality threshold
   */
  meetsThreshold(threshold = URIMatchingConfig.MIN_MATCH_CONFIDENCE) {
    return this.score >= threshold;
  }

  /**
   * Get a summary suitable for display
   */
  getSummary() {
    return {
      uri: this.uri,
      source: this.source,
      label: this.label,
      description: this.description?.substring(0, 150) || '',
      score: this.score,
      qualityLabel: this.qualityLabel,
      qualityColor: this.qualityColor,
      fieldCoverage: {
        count: this.fieldCoverage.count,
        total: this.fieldCoverage.total,
        percentage: Math.round(this.fieldCoverage.percentage * 100),
        groups: this.fieldCoverage.groups
      },
      populatableFields: Object.keys(this.populatableFields)
    };
  }

  /**
   * Export to JSON
   */
  toJSON() {
    return {
      uri: this.uri,
      source: this.source,
      label: this.label,
      description: this.description,
      score: this.score,
      scoreBreakdown: this.scoreBreakdown,
      qualityLabel: this.qualityLabel,
      qualityColor: this.qualityColor,
      fieldCoverage: this.fieldCoverage,
      populatableFields: this.populatableFields,
      searchTerm: this.searchTerm,
      searchedAt: this.searchedAt,
      raw: this.raw
    };
  }
}

// ============================================================================
// SECTION IV: URI Matching Service
// ============================================================================

/**
 * Main service for searching and matching URIs
 */
class URIMatchingService {
  constructor(definitionAPI = null) {
    this.api = definitionAPI || (typeof window !== 'undefined' && window.EO?.getDefinitionAPI?.()) || null;
    this.cache = new Map();
    this.eventTarget = typeof EventTarget !== 'undefined' ? new EventTarget() : null;
  }

  /**
   * Set the DefinitionAPI instance
   */
  setAPI(api) {
    this.api = api;
  }

  /**
   * Search for URI matches for a term
   * @param {string} term - The term to search for
   * @param {Object} options - Search options
   * @param {string[]} options.sources - Sources to search (default: all)
   * @param {number} options.limit - Max results per source
   * @param {Object} options.domainHints - Domain hints for scoring
   * @returns {Promise<URIMatchResult[]>} - Sorted by quality score
   */
  async searchMatches(term, options = {}) {
    if (!term) return [];

    const cacheKey = `match:${term}:${JSON.stringify(options)}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
      }
    }

    this._emit('search:started', { term });

    const results = [];
    const limit = options.limit || 5;

    try {
      // Search concept and regulatory sources in parallel
      const [conceptResults, regulatoryResults] = await Promise.all([
        this._searchConcepts(term, { limit }),
        this._searchRegulatory(term, { limit, domainHints: options.domainHints })
      ]);

      // Convert to URIMatchResult with scoring
      for (const result of [...conceptResults, ...regulatoryResults]) {
        const match = new URIMatchResult(result, term, options);
        if (match.meetsThreshold()) {
          results.push(match);
        }
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);

      // Cache results
      this.cache.set(cacheKey, { data: results, timestamp: Date.now() });

      this._emit('search:completed', { term, count: results.length });

    } catch (error) {
      console.warn('URIMatchingService: Search failed:', error);
      this._emit('search:error', { term, error: error.message });
    }

    return results;
  }

  /**
   * Search for URI matches for multiple terms (batch)
   * @param {string[]} terms - Terms to search
   * @param {Object} options - Search options
   * @returns {Promise<Map<string, URIMatchResult[]>>}
   */
  async searchMatchesBatch(terms, options = {}) {
    const results = new Map();
    const batchSize = options.parallel || 3;

    for (let i = 0; i < terms.length; i += batchSize) {
      const batch = terms.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(term => this.searchMatches(term, options))
      );

      batch.forEach((term, idx) => {
        results.set(term, batchResults[idx]);
      });

      this._emit('batch:progress', {
        processed: Math.min(i + batchSize, terms.length),
        total: terms.length
      });
    }

    return results;
  }

  /**
   * Get best match for a term
   * @param {string} term
   * @param {Object} options
   * @returns {Promise<URIMatchResult|null>}
   */
  async getBestMatch(term, options = {}) {
    const matches = await this.searchMatches(term, options);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Justify a URI selection with reasoning
   * @param {URIMatchResult} match - The selected match
   * @param {string} searchTerm - Original search term
   * @returns {Object} - Justification object
   */
  generateJustification(match, searchTerm) {
    const reasons = [];
    const breakdown = match.scoreBreakdown;

    // Term similarity reasoning
    if (breakdown.termSimilarity > 0.8) {
      reasons.push(`Exact or near-exact match for "${searchTerm}"`);
    } else if (breakdown.termSimilarity > 0.5) {
      reasons.push(`Good term similarity (${Math.round(breakdown.termSimilarity * 100)}%)`);
    }

    // Authority reasoning
    if (breakdown.authorityType > 0.8) {
      reasons.push(`Authoritative source (federal agency or official standard)`);
    }

    // Regulatory reasoning
    if (breakdown.regulatorySource > 0.8) {
      reasons.push(`Regulatory source with official definitions`);
    }

    // Field coverage reasoning
    if (match.fieldCoverage.count >= 6) {
      reasons.push(`High field coverage: ${match.fieldCoverage.count} of ${match.fieldCoverage.total} definition fields available`);
    } else if (match.fieldCoverage.count >= 4) {
      reasons.push(`Moderate field coverage: ${match.fieldCoverage.count} of ${match.fieldCoverage.total} fields`);
    }

    // Specific fields available
    const groups = match.fieldCoverage.groups;
    if (groups.includes('authority') && groups.includes('source')) {
      reasons.push(`Provides both authority and source citation`);
    }
    if (groups.includes('validity')) {
      reasons.push(`Includes effective dates`);
    }

    return {
      match: match.getSummary(),
      overallScore: Math.round(match.score * 100),
      qualityLabel: match.qualityLabel,
      reasons,
      recommendation: this._getRecommendation(match)
    };
  }

  /**
   * Get recommendation for a match
   * @private
   */
  _getRecommendation(match) {
    if (match.score >= 0.85) {
      return 'Highly recommended - excellent match with comprehensive data';
    }
    if (match.score >= 0.70) {
      return 'Recommended - good match, may need minor adjustments';
    }
    if (match.score >= 0.50) {
      return 'Consider with caution - partial match, review carefully';
    }
    if (match.score >= 0.35) {
      return 'Marginal match - significant gaps, manual completion likely needed';
    }
    return 'Weak match - use only if no better alternatives';
  }

  /**
   * Search concept sources
   * @private
   */
  async _searchConcepts(term, options) {
    if (!this.api) return [];
    try {
      return await this.api.searchConcepts(term, {
        sources: ['wikidata', 'schemaOrg'],
        limit: options.limit || 5
      });
    } catch (error) {
      console.warn('Concept search failed:', error);
      return [];
    }
  }

  /**
   * Search regulatory sources
   * @private
   */
  async _searchRegulatory(term, options) {
    if (!this.api) return [];
    try {
      const searchOptions = {
        sources: ['ecfr', 'federalRegister'],
        limit: options.limit || 5
      };

      // Add domain-specific filters
      if (options.domainHints?.cfrTitle) {
        searchOptions.title = options.domainHints.cfrTitle;
      }
      if (options.domainHints?.agencies?.length > 0) {
        searchOptions.agencies = options.domainHints.agencies;
      }

      return await this.api.searchRegulatory(term, searchOptions);
    } catch (error) {
      console.warn('Regulatory search failed:', error);
      return [];
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Emit event
   * @private
   */
  _emit(eventName, detail) {
    if (this.eventTarget) {
      try {
        this.eventTarget.dispatchEvent(new CustomEvent(eventName, { detail }));
      } catch (e) {
        // EventTarget not available
      }
    }
  }

  /**
   * Subscribe to events
   */
  on(eventName, handler) {
    if (this.eventTarget) {
      this.eventTarget.addEventListener(eventName, handler);
    }
    return () => {
      if (this.eventTarget) {
        this.eventTarget.removeEventListener(eventName, handler);
      }
    };
  }
}

// ============================================================================
// SECTION V: Modification Tracking
// ============================================================================

/**
 * Track modifications to definitions from their original URI source
 */
const ModificationTracker = {
  /**
   * Create a snapshot of URI-populated fields
   * @param {URIMatchResult} match - The URI match used to populate
   * @returns {Object} - Snapshot of original values
   */
  createSnapshot(match) {
    return {
      uri: match.uri,
      source: match.source,
      populatedAt: new Date().toISOString(),
      originalValues: JSON.parse(JSON.stringify(match.populatableFields)),
      fieldCoverage: match.fieldCoverage
    };
  },

  /**
   * Compare current definition values against original URI snapshot
   * @param {Object} definition - Current definition object
   * @param {Object} snapshot - Original URI snapshot
   * @returns {Object} - { modified, modifications[], unchanged[] }
   */
  detectModifications(definition, snapshot) {
    if (!snapshot || !snapshot.originalValues) {
      return { modified: false, modifications: [], unchanged: [], source: null };
    }

    const modifications = [];
    const unchanged = [];
    const original = snapshot.originalValues;

    // Check each field group
    for (const [group, originalValue] of Object.entries(original)) {
      const currentValue = definition[group];

      if (!currentValue) {
        // Field was removed or not populated
        unchanged.push({ group, status: 'not_populated' });
        continue;
      }

      // Compare field values
      const changes = this._compareFieldGroup(group, originalValue, currentValue);

      if (changes.length > 0) {
        modifications.push({
          group,
          changes,
          original: originalValue,
          current: currentValue
        });
      } else {
        unchanged.push({ group, status: 'unchanged' });
      }
    }

    return {
      modified: modifications.length > 0,
      modifications,
      unchanged,
      source: {
        uri: snapshot.uri,
        source: snapshot.source,
        populatedAt: snapshot.populatedAt
      }
    };
  },

  /**
   * Compare a field group's values
   * @private
   */
  _compareFieldGroup(group, original, current) {
    const changes = [];

    for (const [field, origValue] of Object.entries(original)) {
      const currValue = current[field];

      // Skip null/undefined originals
      if (origValue === null || origValue === undefined) continue;

      // Value changed
      if (currValue !== origValue) {
        // Handle array comparison
        if (Array.isArray(origValue) && Array.isArray(currValue)) {
          if (JSON.stringify(origValue) !== JSON.stringify(currValue)) {
            changes.push({
              field,
              original: origValue,
              current: currValue,
              type: 'array_modified'
            });
          }
        } else {
          changes.push({
            field,
            original: origValue,
            current: currValue,
            type: currValue === null ? 'removed' : 'modified'
          });
        }
      }
    }

    // Check for new fields not in original
    for (const [field, currValue] of Object.entries(current)) {
      if (currValue !== null && currValue !== undefined &&
          (original[field] === null || original[field] === undefined)) {
        changes.push({
          field,
          original: null,
          current: currValue,
          type: 'added'
        });
      }
    }

    return changes;
  },

  /**
   * Generate a modification summary for display
   * @param {Object} comparison - Result from detectModifications
   * @returns {Object} - { status, message, details }
   */
  getModificationSummary(comparison) {
    if (!comparison.source) {
      return {
        status: 'no_source',
        message: 'No URI source linked',
        icon: 'ph-question',
        color: '#9ca3af'
      };
    }

    if (!comparison.modified) {
      return {
        status: 'unchanged',
        message: `Matches ${comparison.source.source} source`,
        icon: 'ph-check-circle',
        color: '#059669',
        details: `Populated from ${comparison.source.uri}`
      };
    }

    const modCount = comparison.modifications.reduce((sum, m) => sum + m.changes.length, 0);

    return {
      status: 'modified',
      message: `Modified from ${comparison.source.source} source`,
      icon: 'ph-pencil-simple',
      color: '#f59e0b',
      details: `${modCount} field${modCount > 1 ? 's' : ''} changed from original`,
      modifications: comparison.modifications
    };
  }
};

// ============================================================================
// SECTION VI: Singleton & Exports
// ============================================================================

let _uriMatchingService = null;

function getURIMatchingService() {
  if (!_uriMatchingService) {
    _uriMatchingService = new URIMatchingService();
  }
  return _uriMatchingService;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.EO = window.EO || {};
  window.EO.URIMatchingService = URIMatchingService;
  window.EO.URIMatchResult = URIMatchResult;
  window.EO.MatchQualityScorer = MatchQualityScorer;
  window.EO.ModificationTracker = ModificationTracker;
  window.EO.URIMatchingConfig = URIMatchingConfig;
  window.EO.getURIMatchingService = getURIMatchingService;
}

// Export for Node.js/ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    URIMatchingService,
    URIMatchResult,
    MatchQualityScorer,
    ModificationTracker,
    URIMatchingConfig,
    getURIMatchingService
  };
}
