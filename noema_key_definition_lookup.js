/**
 * EO Key Definition Lookup - API calls triggered by imported keys
 *
 * When keys are imported (from CSV/schema), this module triggers API calls
 * to find definition details from authoritative sources:
 *
 * - Wikidata: authority info, validity dates (P580, P582, P576), jurisdiction (P17, P131)
 * - eCFR: regulatory definitions, effective dates, CFR citations
 * - Federal Register: rule effective dates, agency info, document citations
 *
 * Maps API results to the 9-parameter definition structure:
 * 1. REFERENT - from import context
 * 2. AUTHORITY - from Wikidata/eCFR/FR APIs
 * 3. PREDICATE - requires user confirmation
 * 4. FRAME - from app context
 * 5. VALIDITY - from APIs (dates)
 * 6. JURISDICTION - from Wikidata/eCFR
 * 7. PARAMETERS - requires user input
 * 8. PROVENANCE - from APIs + context
 * 9. EPISTEMIC STANCE - from context + user input
 */

// ============================================================================
// SECTION I: Configuration
// ============================================================================

const KeyLookupConfig = {
  // How many keys to process in parallel
  PARALLEL_LOOKUPS: 3,

  // Timeout per API call
  TIMEOUT_MS: 10000,

  // Cache results for session
  CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutes

  // Minimum confidence to include result
  MIN_CONFIDENCE: 0.3,

  // Default sources to search
  DEFAULT_CONCEPT_SOURCES: ['wikidata', 'schemaOrg'],
  DEFAULT_REGULATORY_SOURCES: ['ecfr', 'federalRegister']
};

// ============================================================================
// SECTION II: Key Term Normalization
// ============================================================================

/**
 * Normalize key names for better API search results
 */
const KeyNormalizer = {
  /**
   * Convert key name to searchable term
   * @param {string} keyName - Original key name (e.g., 'household_income_amt')
   * @returns {string} - Searchable term (e.g., 'household income amount')
   */
  toSearchTerm(keyName) {
    if (!keyName) return '';

    // Replace underscores and hyphens with spaces
    let term = keyName.replace(/[_-]/g, ' ');

    // Split camelCase
    term = term.replace(/([a-z])([A-Z])/g, '$1 $2');

    // Expand common abbreviations
    term = this.expandAbbreviations(term);

    // Clean up multiple spaces
    term = term.replace(/\s+/g, ' ').trim();

    return term.toLowerCase();
  },

  /**
   * Expand common data abbreviations
   */
  expandAbbreviations(term) {
    const abbrevs = {
      'amt': 'amount',
      'qty': 'quantity',
      'num': 'number',
      'cnt': 'count',
      'dt': 'date',
      'tm': 'time',
      'desc': 'description',
      'addr': 'address',
      'tel': 'telephone',
      'fax': 'facsimile',
      'org': 'organization',
      'dept': 'department',
      'id': 'identifier',
      'cat': 'category',
      'subcat': 'subcategory',
      'yr': 'year',
      'mo': 'month',
      'stat': 'status',
      'pct': 'percent',
      'avg': 'average',
      'min': 'minimum',
      'max': 'maximum',
      'tot': 'total',
      'hh': 'household',
      'hud': 'housing and urban development',
      'ami': 'area median income',
      'fpl': 'federal poverty level',
      'coc': 'continuum of care',
      'esg': 'emergency solutions grant',
      'hmis': 'homeless management information system'
    };

    const words = term.split(' ');
    return words.map(word => {
      const lower = word.toLowerCase();
      return abbrevs[lower] || word;
    }).join(' ');
  },

  /**
   * Extract potential domain hints from key name
   * @param {string} keyName
   * @returns {Object} - { domain, hints }
   */
  extractDomainHints(keyName) {
    const term = keyName.toLowerCase();
    const hints = {
      domain: null,
      isRegulatory: false,
      cfrTitle: null,
      agencies: []
    };

    // Housing/HUD indicators
    if (/(homeless|housing|shelter|hud|coc|esg|ami|fmr|fpl|voucher|section\s*8)/i.test(term)) {
      hints.domain = 'housing';
      hints.isRegulatory = true;
      hints.cfrTitle = '24';
      hints.agencies.push('housing-and-urban-development');
    }

    // Health indicators
    if (/(health|medical|hipaa|cms|medicare|medicaid|diagnosis|icd)/i.test(term)) {
      hints.domain = 'health';
      hints.isRegulatory = true;
      hints.cfrTitle = '45';
      hints.agencies.push('health-and-human-services');
    }

    // Education indicators
    if (/(education|school|student|ferpa|doe|title\s*i)/i.test(term)) {
      hints.domain = 'education';
      hints.isRegulatory = true;
      hints.cfrTitle = '34';
      hints.agencies.push('education-department');
    }

    // Financial indicators
    if (/(income|poverty|census|irs|tax|wage|earnings|benefit)/i.test(term)) {
      hints.domain = 'financial';
      hints.agencies.push('treasury-department');
    }

    // Environmental indicators
    if (/(environment|epa|pollution|waste|air|water|toxicity)/i.test(term)) {
      hints.domain = 'environment';
      hints.isRegulatory = true;
      hints.cfrTitle = '40';
      hints.agencies.push('environmental-protection-agency');
    }

    return hints;
  }
};

// ============================================================================
// SECTION III: API Result Mappers
// ============================================================================

/**
 * Map API results to definition field structure
 */
const DefinitionFieldMapper = {
  /**
   * Map Wikidata result to authority fields
   * @param {Object} wikidataResult - Result from Wikidata API
   * @returns {Object} - Mapped authority object
   */
  mapWikidataToAuthority(wikidataResult) {
    if (!wikidataResult) return null;

    return {
      name: wikidataResult.label || wikidataResult.id,
      shortName: this._extractShortName(wikidataResult),
      uri: wikidataResult.uri || `http://www.wikidata.org/entity/${wikidataResult.id}`,
      type: this._inferAuthorityType(wikidataResult)
    };
  },

  /**
   * Map Wikidata details to validity fields
   * @param {Object} details - Wikidata entity details with claims
   * @returns {Object} - Mapped validity object
   */
  mapWikidataToValidity(details) {
    if (!details) return null;

    const validity = {
      from: null,
      to: null,
      supersedes: null,
      supersededBy: null
    };

    // P580 = start time
    if (details.startTime) {
      validity.from = this._formatDate(details.startTime);
    } else if (details.inception) {
      validity.from = this._formatDate(details.inception);
    }

    // P582 = end time, P576 = dissolved
    if (details.endTime) {
      validity.to = this._formatDate(details.endTime);
    } else if (details.dissolved) {
      validity.to = this._formatDate(details.dissolved);
    }

    return validity;
  },

  /**
   * Map Wikidata details to jurisdiction fields
   * @param {Object} details - Wikidata entity details
   * @returns {Object} - Mapped jurisdiction object
   */
  mapWikidataToJurisdiction(details) {
    if (!details) return null;

    const jurisdiction = {
      geographic: null,
      programs: null
    };

    // P17 = country, P131 = admin territorial entity
    if (details.jurisdiction) {
      // Common Wikidata country IDs
      const countryMap = {
        'Q30': 'United States',
        'Q16': 'Canada',
        'Q145': 'United Kingdom',
        'Q183': 'Germany',
        'Q142': 'France'
      };
      jurisdiction.geographic = countryMap[details.jurisdiction] || details.jurisdiction;
    }

    return jurisdiction;
  },

  /**
   * Map eCFR result to definition fields
   * @param {Object} ecfrResult - Result from eCFR API
   * @returns {Object} - Mapped definition fields
   */
  mapECFRToDefinition(ecfrResult) {
    if (!ecfrResult) return null;

    return {
      authority: {
        name: this._extractAgencyFromECFR(ecfrResult),
        shortName: null,
        uri: null,
        type: 'federal_agency'
      },
      validity: {
        from: ecfrResult.meta?.startDate || null,
        to: null,
        supersedes: null,
        supersededBy: null
      },
      jurisdiction: {
        geographic: 'United States',
        programs: ecfrResult.meta?.hierarchy ? [ecfrResult.meta.hierarchy[0]] : null
      },
      provenance: {
        sourceDocument: {
          title: ecfrResult.title,
          citation: ecfrResult.citation,
          section: ecfrResult.meta?.section || null,
          url: ecfrResult.url,
          type: 'regulation'
        }
      }
    };
  },

  /**
   * Map Federal Register result to definition fields
   * @param {Object} frResult - Result from Federal Register API
   * @returns {Object} - Mapped definition fields
   */
  mapFederalRegisterToDefinition(frResult) {
    if (!frResult) return null;

    const agencies = frResult.meta?.agencies || [];
    const primaryAgency = agencies[0] || {};

    return {
      authority: {
        name: primaryAgency.name || null,
        shortName: primaryAgency.slug?.toUpperCase() || null,
        uri: null,
        type: 'federal_agency'
      },
      validity: {
        from: frResult.meta?.effectiveDate || frResult.meta?.publicationDate || null,
        to: null,
        supersedes: null,
        supersededBy: null
      },
      jurisdiction: {
        geographic: 'United States',
        programs: frResult.meta?.cfrReferences?.map(ref =>
          `${ref.title} CFR ${ref.part}`) || null
      },
      provenance: {
        sourceDocument: {
          title: frResult.title,
          citation: frResult.citation,
          section: null,
          url: frResult.url,
          type: frResult.meta?.type === 'Rule' ? 'regulation' : 'guidance'
        }
      }
    };
  },

  // Helper methods
  _extractShortName(result) {
    // Check aliases for short names
    if (result.details?.aliases?.length > 0) {
      const shortAlias = result.details.aliases.find(a =>
        a.length <= 6 && a === a.toUpperCase()
      );
      if (shortAlias) return shortAlias;
    }
    return null;
  },

  _inferAuthorityType(result) {
    const desc = (result.description || '').toLowerCase();
    const label = (result.label || '').toLowerCase();

    if (/(federal|u\.s\.|united states|department|agency|bureau|administration)/.test(desc + label)) {
      return 'federal_agency';
    }
    if (/(state|governor|legislature)/.test(desc + label)) {
      return 'state_agency';
    }
    if (/(county|city|municipal|local)/.test(desc + label)) {
      return 'local_gov';
    }
    if (/(iso|ansi|nist|ieee|w3c|ietf)/.test(desc + label)) {
      return 'standards_body';
    }
    if (/(university|college|research|academic)/.test(desc + label)) {
      return 'academic';
    }
    if (/(international|united nations|world|global)/.test(desc + label)) {
      return 'international';
    }
    if (/(nonprofit|foundation|charity|ngo)/.test(desc + label)) {
      return 'ngo';
    }
    return 'other';
  },

  _formatDate(dateValue) {
    if (!dateValue) return null;
    // Handle Wikidata time format: +YYYY-MM-DDT00:00:00Z
    if (typeof dateValue === 'string') {
      const match = dateValue.match(/^\+?(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }
    return dateValue;
  },

  _extractAgencyFromECFR(result) {
    // CFR title to agency mapping
    const titleToAgency = {
      '24': 'U.S. Department of Housing and Urban Development',
      '45': 'U.S. Department of Health and Human Services',
      '34': 'U.S. Department of Education',
      '40': 'U.S. Environmental Protection Agency',
      '26': 'Internal Revenue Service',
      '29': 'U.S. Department of Labor',
      '7': 'U.S. Department of Agriculture',
      '42': 'Public Health Service',
      '20': 'Social Security Administration'
    };

    return titleToAgency[result.meta?.cfrTitle] || null;
  }
};

// ============================================================================
// SECTION IV: Key Definition Lookup Class
// ============================================================================

/**
 * Main class for triggering API calls on imported keys
 */
class KeyDefinitionLookup {
  constructor(definitionAPI = null) {
    // Use provided API or get singleton
    this.api = definitionAPI || (typeof window !== 'undefined' && window.EO?.getDefinitionAPI?.()) || null;
    this.cache = new Map();
    this.pendingLookups = new Map();
    this.eventTarget = typeof EventTarget !== 'undefined' ? new EventTarget() : null;

    // URI Matching service for scored matches
    this.uriMatchingService = typeof window !== 'undefined' && window.EO?.getURIMatchingService?.()
      ? window.EO.getURIMatchingService()
      : null;
  }

  /**
   * Set the DefinitionAPI instance
   * @param {DefinitionAPI} api
   */
  setAPI(api) {
    this.api = api;
    // Also update URI matching service's API
    if (this.uriMatchingService) {
      this.uriMatchingService.setAPI(api);
    }
  }

  /**
   * Set the URI Matching service
   * @param {URIMatchingService} service
   */
  setURIMatchingService(service) {
    this.uriMatchingService = service;
  }

  /**
   * Lookup definitions for imported keys
   *
   * @param {Array} keys - Array of key objects from schema { name, type, values }
   * @param {Object} options - Lookup options
   * @param {string} options.sourceId - Source ID for context
   * @param {Object} options.frame - Frame context (dataset/project)
   * @param {Object} options.provenance - Provenance context
   * @returns {Promise<KeyLookupResult>}
   */
  async lookupKeys(keys, options = {}) {
    if (!this.api) {
      console.warn('KeyDefinitionLookup: No DefinitionAPI available');
      return this._createEmptyResult(keys);
    }

    if (!Array.isArray(keys) || keys.length === 0) {
      return this._createEmptyResult([]);
    }

    const startTime = Date.now();
    this._emit('lookup:started', { keyCount: keys.length });

    const results = {
      sourceId: options.sourceId || null,
      lookupTime: null,
      keys: [],
      summary: {
        totalKeys: keys.length,
        keysWithMatches: 0,
        keysWithAuthority: 0,
        keysWithRegulatory: 0,
        autoFillableFields: 0,
        // NEW: URI match statistics
        keysWithURIMatches: 0,
        totalURIMatches: 0,
        excellentMatches: 0,
        goodMatches: 0,
        averageFieldCoverage: 0
      }
    };

    // Process keys in batches for parallel lookups
    const batches = this._batchArray(keys, KeyLookupConfig.PARALLEL_LOOKUPS);
    let processed = 0;

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(key => this._lookupSingleKey(key, options))
      );

      results.keys.push(...batchResults);
      processed += batch.length;

      this._emit('lookup:progress', {
        processed,
        total: keys.length,
        percentage: Math.round((processed / keys.length) * 100)
      });
    }

    // Calculate summary including URI match statistics
    let totalFieldCoverage = 0;
    let keysWithCoverage = 0;

    results.keys.forEach(keyResult => {
      if (keyResult.matches.length > 0) {
        results.summary.keysWithMatches++;
      }
      if (keyResult.suggestedDefinition?.authority) {
        results.summary.keysWithAuthority++;
      }
      if (keyResult.regulatoryMatches?.length > 0) {
        results.summary.keysWithRegulatory++;
      }
      if (keyResult.autoFillable) {
        results.summary.autoFillableFields += Object.keys(keyResult.autoFillable).length;
      }

      // URI match statistics
      if (keyResult.uriMatches?.length > 0) {
        results.summary.keysWithURIMatches++;
        results.summary.totalURIMatches += keyResult.uriMatches.length;

        // Count quality levels
        keyResult.uriMatches.forEach(match => {
          if (match.qualityLabel === 'Excellent') {
            results.summary.excellentMatches++;
          } else if (match.qualityLabel === 'Good') {
            results.summary.goodMatches++;
          }

          // Accumulate field coverage
          if (match.fieldCoverage?.percentage) {
            totalFieldCoverage += match.fieldCoverage.percentage;
            keysWithCoverage++;
          }
        });
      }
    });

    // Calculate average field coverage
    results.summary.averageFieldCoverage = keysWithCoverage > 0
      ? Math.round((totalFieldCoverage / keysWithCoverage) * 100)
      : 0;

    results.lookupTime = Date.now() - startTime;

    this._emit('lookup:completed', {
      keyCount: keys.length,
      matchCount: results.summary.keysWithMatches,
      duration: results.lookupTime
    });

    return results;
  }

  /**
   * Lookup a single key and gather all relevant definition data
   * @private
   */
  async _lookupSingleKey(key, options) {
    const keyName = key.name || key.id || key;
    const cacheKey = `key:${keyName}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < KeyLookupConfig.CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const searchTerm = KeyNormalizer.toSearchTerm(keyName);
    const domainHints = KeyNormalizer.extractDomainHints(keyName);

    const keyResult = {
      key: keyName,
      searchTerm,
      dataType: key.type || 'text',
      level: this._inferLevel(key),
      values: key.values || key.uniqueValues || [],
      domainHints,
      matches: [],
      regulatoryMatches: [],
      // NEW: Scored URI matches with quality and field coverage
      uriMatches: [],
      suggestedDefinition: null,
      autoFillable: {},
      confidence: 0,
      lookupSources: []
    };

    try {
      // Run concept and regulatory searches in parallel
      const [conceptResults, regulatoryResults] = await Promise.all([
        this._searchConcepts(searchTerm, domainHints),
        this._searchRegulatory(searchTerm, domainHints)
      ]);

      keyResult.matches = conceptResults;
      keyResult.regulatoryMatches = regulatoryResults;
      keyResult.lookupSources = this._getUsedSources(conceptResults, regulatoryResults);

      // NEW: Get scored URI matches with quality and field coverage
      keyResult.uriMatches = await this._getScoredURIMatches(searchTerm, domainHints);

      // Build suggested definition from best matches
      keyResult.suggestedDefinition = await this._buildSuggestedDefinition(
        key, conceptResults, regulatoryResults, options
      );

      // Identify auto-fillable fields
      keyResult.autoFillable = this._identifyAutoFillable(keyResult);

      // Calculate overall confidence
      keyResult.confidence = this._calculateConfidence(keyResult);

    } catch (error) {
      console.warn(`KeyDefinitionLookup: Error looking up "${keyName}":`, error);
      keyResult.error = error.message;
    }

    // Cache result
    this.cache.set(cacheKey, { data: keyResult, timestamp: Date.now() });

    return keyResult;
  }

  /**
   * Search concept sources (Wikidata, Schema.org, etc.)
   * @private
   */
  async _searchConcepts(searchTerm, domainHints) {
    if (!this.api || !searchTerm) return [];

    try {
      const results = await this.api.searchConcepts(searchTerm, {
        sources: KeyLookupConfig.DEFAULT_CONCEPT_SOURCES,
        limit: 5
      });
      return results;
    } catch (error) {
      console.warn('Concept search failed:', error);
      return [];
    }
  }

  /**
   * Search regulatory sources (eCFR, Federal Register)
   * @private
   */
  async _searchRegulatory(searchTerm, domainHints) {
    if (!this.api || !searchTerm) return [];

    try {
      const options = {
        sources: KeyLookupConfig.DEFAULT_REGULATORY_SOURCES,
        limit: 5
      };

      // Add domain-specific filters
      if (domainHints.cfrTitle) {
        options.title = domainHints.cfrTitle;
      }
      if (domainHints.agencies?.length > 0) {
        options.agencies = domainHints.agencies;
      }

      const results = await this.api.searchRegulatory(searchTerm, options);
      return results;
    } catch (error) {
      console.warn('Regulatory search failed:', error);
      return [];
    }
  }

  /**
   * Get scored URI matches with quality and field coverage
   * Uses URIMatchingService for comprehensive scoring
   * @private
   * @param {string} searchTerm - The search term
   * @param {Object} domainHints - Domain hints for filtering
   * @returns {Promise<Array>} - Array of scored URI matches
   */
  async _getScoredURIMatches(searchTerm, domainHints) {
    if (!searchTerm) return [];

    // Use URIMatchingService if available
    if (this.uriMatchingService) {
      try {
        const matches = await this.uriMatchingService.searchMatches(searchTerm, {
          limit: 5,
          domainHints
        });

        // Convert to serializable format with quality info
        return matches.map(match => ({
          uri: match.uri,
          source: match.source,
          label: match.label,
          description: match.description,
          // Quality scoring
          score: match.score,
          qualityLabel: match.qualityLabel,
          qualityColor: match.qualityColor,
          scoreBreakdown: match.scoreBreakdown,
          // Field coverage (how many of 9 definition fields can be populated)
          fieldCoverage: {
            count: match.fieldCoverage?.count || 0,
            total: match.fieldCoverage?.total || 9,
            percentage: match.fieldCoverage?.percentage || 0,
            groups: match.fieldCoverage?.groups || []
          },
          // Populatable fields from this source
          populatableFields: match.populatableFields || {},
          // Metadata
          searchedAt: match.searchedAt
        }));
      } catch (error) {
        console.warn('URIMatchingService search failed:', error);
      }
    }

    // Fallback: create basic scored matches from concept/regulatory results
    return this._createFallbackScoredMatches(searchTerm, domainHints);
  }

  /**
   * Create fallback scored matches when URIMatchingService is not available
   * @private
   */
  async _createFallbackScoredMatches(searchTerm, domainHints) {
    try {
      const [conceptResults, regulatoryResults] = await Promise.all([
        this._searchConcepts(searchTerm, domainHints),
        this._searchRegulatory(searchTerm, domainHints)
      ]);

      const allResults = [...regulatoryResults, ...conceptResults];

      return allResults.slice(0, 5).map((result, index) => {
        // Basic scoring based on position and source type
        const isRegulatory = result.source?.toLowerCase() === 'ecfr' ||
                             result.source?.toLowerCase() === 'federal register';
        const baseScore = isRegulatory ? 0.7 : 0.5;
        const positionBonus = (5 - index) * 0.05;
        const score = Math.min(1, baseScore + positionBonus);

        // Estimate field coverage based on source
        const fieldCoverageEstimates = {
          'ecfr': { count: 7, groups: ['term', 'authority', 'source', 'validity', 'jurisdiction', 'version', 'status'] },
          'federal register': { count: 6, groups: ['term', 'authority', 'source', 'validity', 'jurisdiction', 'version'] },
          'wikidata': { count: 4, groups: ['term', 'authority', 'validity', 'jurisdiction'] },
          'schema.org': { count: 2, groups: ['term', 'authority'] }
        };

        const sourceLower = (result.source || '').toLowerCase();
        const coverage = fieldCoverageEstimates[sourceLower] || { count: 2, groups: ['term'] };

        return {
          uri: result.uri || result.url || null,
          source: result.source || 'unknown',
          label: result.label || result.title || 'Untitled',
          description: result.description || result.desc || result.snippet || '',
          score,
          qualityLabel: score >= 0.7 ? 'Good' : score >= 0.5 ? 'Fair' : 'Partial',
          qualityColor: score >= 0.7 ? '#10b981' : score >= 0.5 ? '#f59e0b' : '#f97316',
          scoreBreakdown: null,
          fieldCoverage: {
            count: coverage.count,
            total: 9,
            percentage: coverage.count / 9,
            groups: coverage.groups
          },
          populatableFields: {},
          searchedAt: new Date().toISOString()
        };
      });
    } catch (error) {
      console.warn('Fallback scored matches failed:', error);
      return [];
    }
  }

  /**
   * Build a suggested definition from API results
   * @private
   */
  async _buildSuggestedDefinition(key, conceptResults, regulatoryResults, options) {
    const keyName = key.name || key.id || key;

    const definition = {
      // REFERENT - from import context
      referent: {
        term: keyName,
        label: KeyNormalizer.toSearchTerm(keyName).split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        dataType: key.type || 'text',
        level: this._inferLevel(key),
        values: key.values || key.uniqueValues || []
      },

      // AUTHORITY - from Wikidata or regulatory
      authority: null,

      // PREDICATE - requires user confirmation
      predicate: {
        predicate: 'broadMatch', // Default, user must confirm
        needsConfirmation: true
      },

      // FRAME - from app context
      frame: {
        id: options.frame?.id || options.sourceId || null,
        type: options.frame?.type || 'source',
        name: options.frame?.name || null
      },

      // VALIDITY - from APIs
      validity: null,

      // JURISDICTION - from APIs or federal default
      jurisdiction: null,

      // PARAMETERS - requires user input
      parameters: {
        needsUserInput: true
      },

      // PROVENANCE - from APIs + context
      provenance: {
        assertedBy: options.provenance?.agent || null,
        method: 'import_lookup',
        assertedAt: new Date().toISOString(),
        sourceDocument: null
      },

      // EPISTEMIC STANCE - from context
      epistemicStance: {
        intent: options.provenance?.term || null,
        confidence: 'low', // Will be updated based on matches
        notes: null
      }
    };

    // Fill from concept results (Wikidata)
    if (conceptResults.length > 0) {
      const topConcept = conceptResults[0];

      // Get detailed info if it's from Wikidata
      if (topConcept.source === 'Wikidata' && topConcept.id) {
        try {
          const details = await this.api.getWikidataDetails(topConcept.id);
          if (details) {
            definition.authority = DefinitionFieldMapper.mapWikidataToAuthority({
              ...topConcept,
              details
            });
            definition.validity = DefinitionFieldMapper.mapWikidataToValidity(details);
            definition.jurisdiction = DefinitionFieldMapper.mapWikidataToJurisdiction(details);
          }
        } catch (error) {
          console.warn('Failed to get Wikidata details:', error);
        }
      }

      // Use basic info if no details
      if (!definition.authority) {
        definition.authority = DefinitionFieldMapper.mapWikidataToAuthority(topConcept);
      }
    }

    // Fill from regulatory results (eCFR, FR)
    if (regulatoryResults.length > 0) {
      const topReg = regulatoryResults[0];
      const regDef = topReg.source === 'eCFR'
        ? DefinitionFieldMapper.mapECFRToDefinition(topReg)
        : DefinitionFieldMapper.mapFederalRegisterToDefinition(topReg);

      // Regulatory results take precedence for authority if no Wikidata match
      if (!definition.authority && regDef?.authority) {
        definition.authority = regDef.authority;
      }

      // Regulatory results take precedence for validity
      if (regDef?.validity) {
        definition.validity = { ...definition.validity, ...regDef.validity };
      }

      // Regulatory results for jurisdiction
      if (regDef?.jurisdiction) {
        definition.jurisdiction = { ...definition.jurisdiction, ...regDef.jurisdiction };
      }

      // Add source document provenance
      if (regDef?.provenance?.sourceDocument) {
        definition.provenance.sourceDocument = regDef.provenance.sourceDocument;
      }
    }

    // Update confidence based on matches
    if (definition.authority && definition.validity?.from) {
      definition.epistemicStance.confidence = 'high';
    } else if (definition.authority || regulatoryResults.length > 0) {
      definition.epistemicStance.confidence = 'medium';
    }

    return definition;
  }

  /**
   * Identify which fields can be auto-filled
   * @private
   */
  _identifyAutoFillable(keyResult) {
    const auto = {};
    const def = keyResult.suggestedDefinition;

    if (!def) return auto;

    // Referent - always auto-fillable from import
    auto.referent = {
      fields: ['term', 'label', 'dataType', 'level', 'values'],
      confidence: 'high',
      source: 'import'
    };

    // Authority - auto-fillable if we found matches
    if (def.authority?.name) {
      auto.authority = {
        fields: ['name', 'shortName', 'uri', 'type'].filter(f => def.authority[f]),
        confidence: keyResult.matches.length > 0 ? 'medium' : 'low',
        source: keyResult.lookupSources[0] || 'api'
      };
    }

    // Frame - always auto-fillable from context
    if (def.frame?.id) {
      auto.frame = {
        fields: ['id', 'type', 'name'].filter(f => def.frame[f]),
        confidence: 'high',
        source: 'context'
      };
    }

    // Validity - auto-fillable if we found dates
    if (def.validity?.from) {
      auto.validity = {
        fields: ['from', 'to'].filter(f => def.validity[f]),
        confidence: 'medium',
        source: keyResult.regulatoryMatches.length > 0 ? 'regulatory' : 'api'
      };
    }

    // Jurisdiction - auto-fillable for federal/US context
    if (def.jurisdiction?.geographic) {
      auto.jurisdiction = {
        fields: ['geographic', 'programs'].filter(f => def.jurisdiction[f]),
        confidence: keyResult.regulatoryMatches.length > 0 ? 'high' : 'medium',
        source: keyResult.regulatoryMatches.length > 0 ? 'regulatory' : 'inferred'
      };
    }

    // Provenance - partially auto-fillable
    auto.provenance = {
      fields: ['assertedBy', 'method', 'assertedAt', 'sourceDocument'].filter(f =>
        def.provenance[f] !== null),
      confidence: 'high',
      source: 'context'
    };

    // Epistemic stance - partially auto-fillable
    auto.epistemicStance = {
      fields: ['intent', 'confidence'].filter(f => def.epistemicStance[f]),
      confidence: 'medium',
      source: 'heuristic'
    };

    return auto;
  }

  /**
   * Calculate overall confidence for the lookup result
   * @private
   */
  _calculateConfidence(keyResult) {
    let score = 0;
    let factors = 0;

    // Concept matches
    if (keyResult.matches.length > 0) {
      score += 0.3;
      factors++;
    }

    // Regulatory matches
    if (keyResult.regulatoryMatches.length > 0) {
      score += 0.4;
      factors++;
    }

    // Authority found
    if (keyResult.suggestedDefinition?.authority?.name) {
      score += 0.2;
      factors++;
    }

    // Validity dates found
    if (keyResult.suggestedDefinition?.validity?.from) {
      score += 0.1;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Infer the level of a key (key, value, entity)
   * @private
   */
  _inferLevel(key) {
    const name = (key.name || key.id || '').toLowerCase();

    // Entity level - identifiers for records
    if (/(^id$|_id$|^key$|^pk$|^uid$|^uuid$)/.test(name)) {
      return 'entity';
    }

    // Check if it has enumerated values
    const values = key.values || key.uniqueValues || [];
    if (values.length > 0 && values.length <= 50) {
      // Likely an enum/categorical
      return 'value';
    }

    // Default to key (column level)
    return 'key';
  }

  /**
   * Get list of sources used in results
   * @private
   */
  _getUsedSources(conceptResults, regulatoryResults) {
    const sources = new Set();
    conceptResults.forEach(r => r.source && sources.add(r.source));
    regulatoryResults.forEach(r => r.source && sources.add(r.source));
    return Array.from(sources);
  }

  /**
   * Create empty result structure
   * @private
   */
  _createEmptyResult(keys) {
    return {
      sourceId: null,
      lookupTime: 0,
      keys: keys.map(k => ({
        key: k.name || k.id || k,
        searchTerm: '',
        matches: [],
        regulatoryMatches: [],
        suggestedDefinition: null,
        autoFillable: {},
        confidence: 0
      })),
      summary: {
        totalKeys: keys.length,
        keysWithMatches: 0,
        keysWithAuthority: 0,
        keysWithRegulatory: 0,
        autoFillableFields: 0
      }
    };
  }

  /**
   * Batch array into chunks
   * @private
   */
  _batchArray(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
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

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// ============================================================================
// SECTION V: Import Integration
// ============================================================================

/**
 * Hook into import process to trigger key lookups
 */
class ImportDefinitionEnricher {
  constructor(keyLookup = null) {
    this.keyLookup = keyLookup || new KeyDefinitionLookup();
  }

  /**
   * Enrich imported source with definition lookups
   *
   * @param {Object} source - Imported source object
   * @param {Object} options - Enrichment options
   * @returns {Promise<Object>} - Enriched source with lookup results
   */
  async enrichSource(source, options = {}) {
    if (!source || !source.schema?.fields) {
      return source;
    }

    const keys = source.schema.fields.map(field => ({
      name: field.name,
      type: field.type,
      values: field.uniqueValues || []
    }));

    const lookupOptions = {
      sourceId: source.id,
      frame: {
        id: source.id,
        type: 'source',
        name: source.name
      },
      provenance: source.provenance
    };

    const lookupResults = await this.keyLookup.lookupKeys(keys, lookupOptions);

    // Attach lookup results to source
    source.definitionLookup = {
      results: lookupResults,
      performedAt: new Date().toISOString(),
      status: 'completed'
    };

    // Enrich schema fields with suggestions including URI matches with quality scores
    source.schema.fields = source.schema.fields.map(field => {
      const keyResult = lookupResults.keys.find(k => k.key === field.name);
      if (keyResult) {
        // Get the best URI match (highest score)
        const bestURIMatch = keyResult.uriMatches?.length > 0
          ? keyResult.uriMatches.reduce((best, curr) =>
              (curr.score || 0) > (best.score || 0) ? curr : best
            )
          : null;

        field.definitionSuggestion = {
          suggestedDefinition: keyResult.suggestedDefinition,
          autoFillable: keyResult.autoFillable,
          confidence: keyResult.confidence,
          matchCount: keyResult.matches.length + keyResult.regulatoryMatches.length,
          // NEW: URI matches with quality scoring and field coverage
          uriMatches: keyResult.uriMatches || [],
          uriMatchCount: keyResult.uriMatches?.length || 0,
          bestURIMatch: bestURIMatch ? {
            uri: bestURIMatch.uri,
            source: bestURIMatch.source,
            label: bestURIMatch.label,
            score: bestURIMatch.score,
            qualityLabel: bestURIMatch.qualityLabel,
            fieldCoverage: bestURIMatch.fieldCoverage
          } : null
        };
      }
      return field;
    });

    return source;
  }

  /**
   * Get lookup results for a source
   */
  getSourceLookupResults(source) {
    return source?.definitionLookup?.results || null;
  }

  /**
   * Check if source has been enriched
   */
  isEnriched(source) {
    return source?.definitionLookup?.status === 'completed';
  }
}

// ============================================================================
// SECTION VI: Exports
// ============================================================================

// Singleton instances
let _keyDefinitionLookup = null;
let _importDefinitionEnricher = null;

function getKeyDefinitionLookup() {
  if (!_keyDefinitionLookup) {
    _keyDefinitionLookup = new KeyDefinitionLookup();
  }
  return _keyDefinitionLookup;
}

function getImportDefinitionEnricher() {
  if (!_importDefinitionEnricher) {
    _importDefinitionEnricher = new ImportDefinitionEnricher(getKeyDefinitionLookup());
  }
  return _importDefinitionEnricher;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.EO = window.EO || {};
  window.EO.KeyDefinitionLookup = KeyDefinitionLookup;
  window.EO.ImportDefinitionEnricher = ImportDefinitionEnricher;
  window.EO.KeyNormalizer = KeyNormalizer;
  window.EO.DefinitionFieldMapper = DefinitionFieldMapper;
  window.EO.KeyLookupConfig = KeyLookupConfig;
  window.EO.getKeyDefinitionLookup = getKeyDefinitionLookup;
  window.EO.getImportDefinitionEnricher = getImportDefinitionEnricher;
}

// Export for Node.js/ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    KeyDefinitionLookup,
    ImportDefinitionEnricher,
    KeyNormalizer,
    DefinitionFieldMapper,
    KeyLookupConfig,
    getKeyDefinitionLookup,
    getImportDefinitionEnricher
  };
}
