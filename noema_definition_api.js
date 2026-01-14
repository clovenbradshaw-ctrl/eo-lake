/**
 * EO Definition API - External API integrations for definition lookups
 *
 * Provides unified interface for searching:
 * - Concept URIs: Wikidata, DBpedia, LOV, Schema.org
 * - Regulatory Sources: eCFR, Federal Register, US Code
 * - Authority lookups via Wikidata
 *
 * All APIs return normalized results for easy consumption.
 */

// ============================================================================
// SECTION I: Configuration
// ============================================================================

const DefinitionAPIConfig = {
  // Request timeouts
  TIMEOUT_MS: 15000,

  // Cache settings (in-memory cache for session)
  CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes

  // Rate limiting
  MIN_REQUEST_INTERVAL_MS: 100,

  // Result limits
  DEFAULT_LIMIT: 10
};

// ============================================================================
// SECTION II: URI Sources Registry
// ============================================================================

/**
 * Authentication types for URI sources
 * @typedef {'none'|'username'|'api_key'|'api_key_optional'|'account'} AuthType
 */

/**
 * URI Source metadata
 * @typedef {Object} URISource
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} category - Category (knowledge, government, geographic, organization, academic, legal)
 * @property {number} tier - Tier level (1=core, 2=extended, 3=specialized)
 * @property {AuthType} auth - Authentication requirement
 * @property {string} authNote - Additional auth info
 * @property {string} rateLimit - Rate limit description
 * @property {Object} endpoints - API endpoints
 * @property {string} docs - Documentation URL
 */

const URISources = {
  // =========================================================================
  // TIER 1 - Core Sources
  // =========================================================================

  wikidata: {
    id: 'wikidata',
    name: 'Wikidata',
    category: 'knowledge',
    tier: 1,
    auth: 'none',
    authNote: null,
    rateLimit: 'Generous',
    endpoints: {
      search: 'https://www.wikidata.org/w/api.php?action=wbsearchentities&search={query}&language=en&format=json',
      entity: 'https://www.wikidata.org/w/api.php?action=wbgetentities&ids={QID}&format=json',
      sparql: 'https://query.wikidata.org/sparql?query={SPARQL}'
    },
    docs: 'https://www.wikidata.org/wiki/Wikidata:Data_access'
  },

  dbpedia: {
    id: 'dbpedia',
    name: 'DBpedia',
    category: 'knowledge',
    tier: 1,
    auth: 'none',
    authNote: null,
    rateLimit: 'Moderate',
    endpoints: {
      search: 'https://lookup.dbpedia.org/api/search?query={query}&format=json&maxResults=10',
      sparql: 'https://dbpedia.org/sparql?query={SPARQL}'
    },
    docs: 'https://www.dbpedia.org/resources/lookup'
  },

  ecfr: {
    id: 'ecfr',
    name: 'eCFR (Federal Regulations)',
    category: 'government',
    tier: 1,
    auth: 'none',
    authNote: null,
    rateLimit: 'Unknown',
    endpoints: {
      search: 'https://www.ecfr.gov/api/search/v1/results?query={query}&per_page=20',
      titles: 'https://www.ecfr.gov/api/versioner/v1/titles',
      structure: 'https://www.ecfr.gov/api/versioner/v1/structure/{date}/title-{num}.json',
      fullText: 'https://www.ecfr.gov/api/versioner/v1/full/{date}/title-{num}.xml'
    },
    docs: 'https://www.ecfr.gov/developers/documentation/api/v1'
  },

  federalRegister: {
    id: 'federalRegister',
    name: 'Federal Register',
    category: 'government',
    tier: 1,
    auth: 'none',
    authNote: null,
    rateLimit: 'Generous',
    endpoints: {
      search: 'https://www.federalregister.gov/api/v1/documents.json?conditions[term]={query}',
      document: 'https://www.federalregister.gov/api/v1/documents/{doc_number}',
      agencies: 'https://www.federalregister.gov/api/v1/agencies'
    },
    docs: 'https://www.federalregister.gov/developers/documentation/api/v1'
  },

  geonames: {
    id: 'geonames',
    name: 'GeoNames',
    category: 'geographic',
    tier: 1,
    auth: 'username',
    authNote: 'Free account required, 1000 req/day',
    rateLimit: '1000/day free',
    endpoints: {
      search: 'http://api.geonames.org/searchJSON?q={query}&username={user}',
      get: 'http://api.geonames.org/getJSON?geonameId={id}&username={user}',
      hierarchy: 'http://api.geonames.org/hierarchyJSON?geonameId={id}&username={user}'
    },
    docs: 'https://www.geonames.org/export/web-services.html'
  },

  openCorporates: {
    id: 'openCorporates',
    name: 'OpenCorporates',
    category: 'organization',
    tier: 1,
    auth: 'api_key_optional',
    authNote: 'Free tier limited, API key for more',
    rateLimit: '500/month free',
    endpoints: {
      search: 'https://api.opencorporates.com/v0.4/companies/search?q={query}',
      company: 'https://api.opencorporates.com/v0.4/companies/{jurisdiction}/{number}',
      officers: 'https://api.opencorporates.com/v0.4/companies/{jurisdiction}/{number}/officers'
    },
    docs: 'https://api.opencorporates.com/documentation/API-Reference'
  },

  census: {
    id: 'census',
    name: 'US Census',
    category: 'government',
    tier: 1,
    auth: 'api_key_optional',
    authNote: 'Free, API key recommended',
    rateLimit: 'Generous',
    endpoints: {
      geocoder: 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address={addr}&benchmark=Public_AR_Current&format=json',
      geography: 'https://api.census.gov/data/{year}/acs/acs5?get={vars}&for={geo}',
      tiger: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/'
    },
    docs: 'https://www.census.gov/data/developers/data-sets.html'
  },

  // =========================================================================
  // TIER 2 - Government & Business
  // =========================================================================

  samGov: {
    id: 'samGov',
    name: 'SAM.gov',
    category: 'government',
    tier: 2,
    auth: 'api_key',
    authNote: 'Free API key required from SAM.gov',
    rateLimit: '10,000/day',
    endpoints: {
      entity: 'https://api.sam.gov/entity-information/v3/entities?api_key={key}&ueiSAM={uei}',
      search: 'https://api.sam.gov/entity-information/v3/entities?api_key={key}&legalBusinessName={name}',
      exclusions: 'https://api.sam.gov/entity-information/v3/exclusions?api_key={key}'
    },
    docs: 'https://open.gsa.gov/api/entity-api/'
  },

  usaSpending: {
    id: 'usaSpending',
    name: 'USAspending',
    category: 'government',
    tier: 2,
    auth: 'none',
    authNote: null,
    rateLimit: 'Generous',
    endpoints: {
      search: 'https://api.usaspending.gov/api/v2/search/spending_by_award/',
      recipient: 'https://api.usaspending.gov/api/v2/recipient/duns/{duns}/',
      awards: 'https://api.usaspending.gov/api/v2/awards/{award_id}/'
    },
    docs: 'https://api.usaspending.gov/docs/endpoints'
  },

  congressGov: {
    id: 'congressGov',
    name: 'Congress.gov',
    category: 'government',
    tier: 2,
    auth: 'api_key',
    authNote: 'Free API key required',
    rateLimit: '5000/hour',
    endpoints: {
      bills: 'https://api.congress.gov/v3/bill?api_key={key}',
      bill: 'https://api.congress.gov/v3/bill/{congress}/{type}/{number}?api_key={key}',
      laws: 'https://api.congress.gov/v3/law/{congress}?api_key={key}'
    },
    docs: 'https://api.congress.gov/'
  },

  secEdgar: {
    id: 'secEdgar',
    name: 'SEC EDGAR',
    category: 'government',
    tier: 2,
    auth: 'none',
    authNote: null,
    rateLimit: '10/sec',
    endpoints: {
      search: 'https://efts.sec.gov/LATEST/search-index?q={query}',
      company: 'https://data.sec.gov/submissions/CIK{cik}.json',
      filings: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type={type}&output=atom'
    },
    docs: 'https://www.sec.gov/developer'
  },

  lov: {
    id: 'lov',
    name: 'LOV (Linked Open Vocabularies)',
    category: 'knowledge',
    tier: 2,
    auth: 'none',
    authNote: null,
    rateLimit: 'Unknown',
    endpoints: {
      search: 'https://lov.linkeddata.es/dataset/lov/api/v2/term/search?q={query}',
      vocab: 'https://lov.linkeddata.es/dataset/lov/api/v2/vocabulary/info?vocab={prefix}',
      list: 'https://lov.linkeddata.es/dataset/lov/api/v2/vocabulary/list'
    },
    docs: 'https://lov.linkeddata.es/dataset/lov/api'
  },

  proPublica990: {
    id: 'proPublica990',
    name: 'IRS 990 (ProPublica)',
    category: 'government',
    tier: 2,
    auth: 'none',
    authNote: null,
    rateLimit: 'Generous',
    endpoints: {
      search: 'https://projects.propublica.org/nonprofits/api/v2/search.json?q={query}',
      org: 'https://projects.propublica.org/nonprofits/api/v2/organizations/{ein}.json',
      filing: 'https://projects.propublica.org/nonprofits/api/v2/organizations/{ein}/filings/{year}.json'
    },
    docs: 'https://projects.propublica.org/nonprofits/api'
  },

  // =========================================================================
  // TIER 2 - Geographic
  // =========================================================================

  nominatim: {
    id: 'nominatim',
    name: 'Nominatim (OpenStreetMap)',
    category: 'geographic',
    tier: 2,
    auth: 'none',
    authNote: 'Requires user-agent header',
    rateLimit: '1/sec',
    endpoints: {
      search: 'https://nominatim.openstreetmap.org/search?q={query}&format=json',
      reverse: 'https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json',
      lookup: 'https://nominatim.openstreetmap.org/lookup?osm_ids={ids}&format=json'
    },
    docs: 'https://nominatim.org/release-docs/develop/api/Overview/'
  },

  nashvilleGis: {
    id: 'nashvilleGis',
    name: 'Nashville GIS',
    category: 'geographic',
    tier: 2,
    auth: 'none',
    authNote: 'Local metro data',
    rateLimit: 'Unknown',
    endpoints: {
      rest: 'https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/',
      council: 'https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Council_Districts/'
    },
    docs: null
  },

  // =========================================================================
  // TIER 2 - Organizations
  // =========================================================================

  ror: {
    id: 'ror',
    name: 'ROR (Research Organizations)',
    category: 'organization',
    tier: 2,
    auth: 'none',
    authNote: null,
    rateLimit: 'Generous',
    endpoints: {
      search: 'https://api.ror.org/organizations?query={query}',
      get: 'https://api.ror.org/organizations/{ror_id}'
    },
    docs: 'https://ror.readme.io/docs/rest-api'
  },

  gleif: {
    id: 'gleif',
    name: 'GLEIF (Legal Entity Identifiers)',
    category: 'organization',
    tier: 2,
    auth: 'none',
    authNote: null,
    rateLimit: 'Generous',
    endpoints: {
      search: 'https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]={name}',
      get: 'https://api.gleif.org/api/v1/lei-records/{lei}'
    },
    docs: 'https://www.gleif.org/en/lei-data/gleif-api'
  },

  viaf: {
    id: 'viaf',
    name: 'VIAF (Name Authority)',
    category: 'organization',
    tier: 2,
    auth: 'none',
    authNote: null,
    rateLimit: 'Unknown',
    endpoints: {
      search: 'https://viaf.org/viaf/search?query=cql.any+=+"{query}"&httpAccept=application/json',
      get: 'https://viaf.org/viaf/{id}/viaf.json'
    },
    docs: 'https://www.oclc.org/developer/api/oclc-apis/viaf.en.html'
  },

  isni: {
    id: 'isni',
    name: 'ISNI',
    category: 'organization',
    tier: 2,
    auth: 'none',
    authNote: null,
    rateLimit: 'Unknown',
    endpoints: {
      search: 'https://isni.org/isni/{isni}',
      sru: 'http://isni.oclc.org/sru/?query=pica.na={name}&operation=searchRetrieve'
    },
    docs: 'https://isni.org/page/technical-documentation/'
  },

  orcid: {
    id: 'orcid',
    name: 'ORCID',
    category: 'organization',
    tier: 2,
    auth: 'none',
    authNote: 'Free public API',
    rateLimit: 'Unknown',
    endpoints: {
      search: 'https://pub.orcid.org/v3.0/search/?q={query}',
      get: 'https://pub.orcid.org/v3.0/{orcid}'
    },
    docs: 'https://info.orcid.org/documentation/api-tutorials/'
  },

  // =========================================================================
  // TIER 2 - Domain Specific
  // =========================================================================

  fred: {
    id: 'fred',
    name: 'FRED (Economic Data)',
    category: 'government',
    tier: 2,
    auth: 'api_key',
    authNote: 'Free API key required',
    rateLimit: '120/min',
    endpoints: {
      search: 'https://api.stlouisfed.org/fred/series/search?search_text={query}&api_key={key}',
      series: 'https://api.stlouisfed.org/fred/series?series_id={id}&api_key={key}',
      data: 'https://api.stlouisfed.org/fred/series/observations?series_id={id}&api_key={key}'
    },
    docs: 'https://fred.stlouisfed.org/docs/api/fred/'
  },

  bls: {
    id: 'bls',
    name: 'BLS (Labor Statistics)',
    category: 'government',
    tier: 2,
    auth: 'api_key_optional',
    authNote: 'Free, key for higher limits',
    rateLimit: 'Limited without key',
    endpoints: {
      series: 'https://api.bls.gov/publicAPI/v2/timeseries/data/{series_id}'
    },
    docs: 'https://www.bls.gov/developers/'
  },

  hud: {
    id: 'hud',
    name: 'HUD',
    category: 'government',
    tier: 2,
    auth: 'api_key',
    authNote: 'API key required',
    rateLimit: 'Unknown',
    endpoints: {
      fairMarket: 'https://www.huduser.gov/hudapi/public/fmr/data/{entityid}',
      income: 'https://www.huduser.gov/hudapi/public/il/data/{entityid}'
    },
    docs: 'https://www.huduser.gov/portal/dataset/fmr-api.html'
  },

  pubmed: {
    id: 'pubmed',
    name: 'PubMed',
    category: 'academic',
    tier: 2,
    auth: 'api_key_optional',
    authNote: 'Free, key for higher limits',
    rateLimit: 'Limited without key',
    endpoints: {
      search: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={query}&retmode=json',
      fetch: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={pmid}'
    },
    docs: 'https://www.ncbi.nlm.nih.gov/books/NBK25500/'
  },

  openAlex: {
    id: 'openAlex',
    name: 'OpenAlex (Academic)',
    category: 'academic',
    tier: 2,
    auth: 'none',
    authNote: null,
    rateLimit: '100,000/day',
    endpoints: {
      search: 'https://api.openalex.org/works?search={query}',
      entity: 'https://api.openalex.org/works/{id}',
      authors: 'https://api.openalex.org/authors?search={name}'
    },
    docs: 'https://docs.openalex.org/'
  },

  crossRef: {
    id: 'crossRef',
    name: 'CrossRef (Publications)',
    category: 'academic',
    tier: 2,
    auth: 'none',
    authNote: 'Email for polite pool',
    rateLimit: 'Generous with email',
    endpoints: {
      search: 'https://api.crossref.org/works?query={query}',
      doi: 'https://api.crossref.org/works/{doi}'
    },
    docs: 'https://www.crossref.org/documentation/retrieve-metadata/rest-api/'
  },

  // =========================================================================
  // TIER 3 - Court Records
  // =========================================================================

  courtListener: {
    id: 'courtListener',
    name: 'CourtListener (Free Law Project)',
    category: 'legal',
    tier: 3,
    auth: 'account',
    authNote: 'Free, account for higher limits',
    rateLimit: 'Moderate',
    endpoints: {
      search: 'https://www.courtlistener.com/api/rest/v3/search/?q={query}',
      opinion: 'https://www.courtlistener.com/api/rest/v3/opinions/{id}/',
      docket: 'https://www.courtlistener.com/api/rest/v3/dockets/{id}/'
    },
    docs: 'https://www.courtlistener.com/api/rest-info/'
  },

  // =========================================================================
  // Additional Knowledge Sources
  // =========================================================================

  schemaOrg: {
    id: 'schemaOrg',
    name: 'Schema.org',
    category: 'knowledge',
    tier: 1,
    auth: 'none',
    authNote: 'Static vocabulary, no API',
    rateLimit: 'N/A (static)',
    endpoints: {
      base: 'https://schema.org/'
    },
    docs: 'https://schema.org/docs/documents.html'
  }
};

/**
 * Get all URI sources
 * @returns {URISource[]}
 */
function getAllURISources() {
  return Object.values(URISources);
}

/**
 * Get URI sources filtered by authentication requirement
 * @param {Object} options - Filter options
 * @param {boolean} options.noAuth - Only sources with no auth required
 * @param {boolean} options.freeAuth - Include sources with free auth (username or free API key)
 * @param {string} options.category - Filter by category
 * @param {number} options.tier - Filter by tier (1, 2, or 3)
 * @returns {URISource[]}
 */
function filterURISources(options = {}) {
  let sources = getAllURISources();

  // Filter by authentication
  if (options.noAuth) {
    sources = sources.filter(s => s.auth === 'none');
  } else if (options.freeAuth) {
    // Include sources that are free to use (no auth, optional key, or free username)
    sources = sources.filter(s =>
      s.auth === 'none' ||
      s.auth === 'api_key_optional' ||
      s.auth === 'username'
    );
  }

  // Filter by category
  if (options.category) {
    sources = sources.filter(s => s.category === options.category);
  }

  // Filter by tier
  if (options.tier) {
    sources = sources.filter(s => s.tier === options.tier);
  }

  return sources;
}

/**
 * Get sources that work without any credentials (truly open APIs)
 * @returns {URISource[]}
 */
function getOpenSources() {
  return filterURISources({ noAuth: true });
}

/**
 * Get sources grouped by category
 * @param {Object} options - Filter options (same as filterURISources)
 * @returns {Object<string, URISource[]>}
 */
function getSourcesByCategory(options = {}) {
  const sources = filterURISources(options);
  const grouped = {};

  for (const source of sources) {
    if (!grouped[source.category]) {
      grouped[source.category] = [];
    }
    grouped[source.category].push(source);
  }

  return grouped;
}

/**
 * Get sources grouped by tier
 * @param {Object} options - Filter options (same as filterURISources)
 * @returns {Object<number, URISource[]>}
 */
function getSourcesByTier(options = {}) {
  const sources = filterURISources(options);
  const grouped = { 1: [], 2: [], 3: [] };

  for (const source of sources) {
    grouped[source.tier].push(source);
  }

  return grouped;
}

/**
 * Get a summary of available sources
 * @returns {Object}
 */
function getSourcesSummary() {
  const all = getAllURISources();
  const open = getOpenSources();

  return {
    total: all.length,
    openNoAuth: open.length,
    byAuth: {
      none: all.filter(s => s.auth === 'none').length,
      username: all.filter(s => s.auth === 'username').length,
      api_key: all.filter(s => s.auth === 'api_key').length,
      api_key_optional: all.filter(s => s.auth === 'api_key_optional').length,
      account: all.filter(s => s.auth === 'account').length
    },
    byCategory: {
      knowledge: all.filter(s => s.category === 'knowledge').length,
      government: all.filter(s => s.category === 'government').length,
      geographic: all.filter(s => s.category === 'geographic').length,
      organization: all.filter(s => s.category === 'organization').length,
      academic: all.filter(s => s.category === 'academic').length,
      legal: all.filter(s => s.category === 'legal').length
    },
    byTier: {
      1: all.filter(s => s.tier === 1).length,
      2: all.filter(s => s.tier === 2).length,
      3: all.filter(s => s.tier === 3).length
    }
  };
}

// ============================================================================
// SECTION III: Fuzzy Matching Utilities
// ============================================================================

/**
 * Calculate fuzzy match score between query and target string
 * Uses a combination of techniques: substring match, word match, and character sequence matching
 * @param {string} query - Search query
 * @param {string} target - Target string to match against
 * @returns {number} Score from 0 to 1, higher is better match
 */
function fuzzyMatchScore(query, target) {
  if (!query || !target) return 0;

  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  // Exact match
  if (t === q) return 1.0;

  // Starts with query (high score)
  if (t.startsWith(q)) return 0.95;

  // Contains exact query
  if (t.includes(q)) return 0.85;

  // Word-based matching
  const queryWords = q.split(/\s+/).filter(w => w.length > 0);
  const targetWords = t.split(/\s+/).filter(w => w.length > 0);

  // Check if all query words are found in target
  const allWordsFound = queryWords.every(qw =>
    targetWords.some(tw => tw.includes(qw) || qw.includes(tw))
  );
  if (allWordsFound && queryWords.length > 0) {
    return 0.75 + (0.1 * (queryWords.length / Math.max(targetWords.length, 1)));
  }

  // Character sequence matching (fuzzy)
  let score = 0;
  let qIdx = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;

  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      qIdx++;
      consecutiveMatches++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
    } else {
      consecutiveMatches = 0;
    }
  }

  // Score based on how many characters matched and consecutive matches
  if (qIdx > 0) {
    const matchRatio = qIdx / q.length;
    const consecutiveBonus = maxConsecutive / q.length * 0.2;
    score = (matchRatio * 0.5) + consecutiveBonus;
  }

  return Math.min(score, 0.7); // Cap fuzzy matches at 0.7
}

/**
 * Filter and rank items using fuzzy matching
 * @param {Array} items - Array of items to filter
 * @param {string} query - Search query
 * @param {Function} getSearchableText - Function to extract searchable text from item
 * @param {number} threshold - Minimum score threshold (default 0.3)
 * @returns {Array} Filtered and sorted items with scores
 */
function fuzzyFilter(items, query, getSearchableText, threshold = 0.3) {
  if (!query || query.trim().length === 0) {
    return items.map(item => ({ item, score: 1 }));
  }

  const scored = items.map(item => {
    const text = getSearchableText(item);
    const score = fuzzyMatchScore(query, text);
    return { item, score };
  });

  return scored
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score);
}

// ============================================================================
// SECTION IV: Concept URI APIs
// ============================================================================

/**
 * Unified concept search result format
 * @typedef {Object} ConceptResult
 * @property {string} uri - Full URI for the concept
 * @property {string} id - Local identifier
 * @property {string} label - Human-readable label
 * @property {string} description - Short description
 * @property {string} source - Source name (Wikidata, DBpedia, etc.)
 * @property {Object} [details] - Additional metadata from source
 * @property {number} [score] - Relevance score (0-1)
 */

const ConceptAPIs = {
  /**
   * Wikidata - Largest open knowledge base
   * https://www.wikidata.org/wiki/Wikidata:Data_access
   */
  wikidata: {
    name: 'Wikidata',
    type: 'api',
    baseUrl: 'https://www.wikidata.org/w/api.php',

    /**
     * Search Wikidata entities
     * @param {string} query - Search term
     * @param {Object} options - { limit, language }
     * @returns {Promise<ConceptResult[]>}
     */
    async search(query, options = {}) {
      const limit = options.limit || DefinitionAPIConfig.DEFAULT_LIMIT;
      const language = options.language || 'en';

      const params = new URLSearchParams({
        action: 'wbsearchentities',
        search: query,
        language: language,
        limit: limit.toString(),
        format: 'json',
        origin: '*'
      });

      const response = await fetchWithTimeout(
        `${this.baseUrl}?${params}`,
        { method: 'GET' },
        DefinitionAPIConfig.TIMEOUT_MS
      );

      const data = await response.json();

      return (data.search || []).map(entity => ({
        uri: `http://www.wikidata.org/entity/${entity.id}`,
        id: entity.id,
        label: entity.label || entity.id,
        description: entity.description || '',
        source: 'Wikidata',
        details: {
          aliases: entity.aliases || [],
          concepturi: entity.concepturi,
          match: entity.match
        }
      }));
    },

    /**
     * Get detailed entity information including claims
     * @param {string} entityId - Wikidata entity ID (e.g., Q5)
     * @returns {Promise<Object>}
     */
    async getDetails(entityId) {
      const params = new URLSearchParams({
        action: 'wbgetentities',
        ids: entityId,
        languages: 'en',
        format: 'json',
        origin: '*'
      });

      const response = await fetchWithTimeout(
        `${this.baseUrl}?${params}`,
        { method: 'GET' },
        DefinitionAPIConfig.TIMEOUT_MS
      );

      const data = await response.json();
      const entity = data.entities?.[entityId];

      if (!entity) return null;

      const details = {
        id: entityId,
        label: entity.labels?.en?.value || entityId,
        description: entity.descriptions?.en?.value || '',
        aliases: (entity.aliases?.en || []).map(a => a.value),
        instanceOf: [],      // P31
        subclassOf: [],      // P279
        jurisdiction: null,  // P17 (country)
        officialWebsite: null, // P856
        inception: null      // P571
      };

      // Extract key claims
      const claims = entity.claims || {};

      // P31 = instance of
      if (claims.P31) {
        details.instanceOf = claims.P31.slice(0, 5).map(c => ({
          id: c.mainsnak?.datavalue?.value?.id,
          label: null // Would need another lookup
        })).filter(c => c.id);
      }

      // P279 = subclass of
      if (claims.P279) {
        details.subclassOf = claims.P279.slice(0, 5).map(c => ({
          id: c.mainsnak?.datavalue?.value?.id,
          label: null
        })).filter(c => c.id);
      }

      // P17 = country
      if (claims.P17?.[0]) {
        details.jurisdiction = claims.P17[0].mainsnak?.datavalue?.value?.id;
      }

      // P856 = official website
      if (claims.P856?.[0]) {
        details.officialWebsite = claims.P856[0].mainsnak?.datavalue?.value;
      }

      // P571 = inception
      if (claims.P571?.[0]) {
        const timeValue = claims.P571[0].mainsnak?.datavalue?.value?.time;
        if (timeValue) {
          details.inception = timeValue.replace(/^\+/, '').split('T')[0];
        }
      }

      return details;
    },

    /**
     * Search for organizations/authorities specifically
     * @param {string} query
     * @returns {Promise<ConceptResult[]>}
     */
    async searchAuthorities(query) {
      // Search with instance-of filter for organizations
      const results = await this.search(query, { limit: 15 });

      // Filter and prioritize organizational entities
      const orgKeywords = ['department', 'agency', 'bureau', 'office', 'administration', 'commission', 'board'];

      return results.sort((a, b) => {
        const aIsOrg = orgKeywords.some(k =>
          a.label.toLowerCase().includes(k) || a.description.toLowerCase().includes(k)
        );
        const bIsOrg = orgKeywords.some(k =>
          b.label.toLowerCase().includes(k) || b.description.toLowerCase().includes(k)
        );
        if (aIsOrg && !bIsOrg) return -1;
        if (!aIsOrg && bIsOrg) return 1;
        return 0;
      }).slice(0, 10);
    }
  },

  /**
   * DBpedia - Wikipedia structured data
   * https://wiki.dbpedia.org/lookup
   */
  dbpedia: {
    name: 'DBpedia',
    type: 'api',
    baseUrl: 'https://lookup.dbpedia.org/api/search',

    async search(query, options = {}) {
      const limit = options.limit || DefinitionAPIConfig.DEFAULT_LIMIT;

      const params = new URLSearchParams({
        query: query,
        format: 'json',
        maxResults: limit.toString()
      });

      try {
        const response = await fetchWithTimeout(
          `${this.baseUrl}?${params}`,
          { method: 'GET' },
          DefinitionAPIConfig.TIMEOUT_MS
        );

        const data = await response.json();

        return (data.docs || []).map(doc => ({
          uri: doc.resource?.[0] || '',
          id: (doc.resource?.[0] || '').split('/').pop(),
          label: stripHtml(doc.label?.[0] || ''),
          description: stripHtml(doc.comment?.[0] || '').substring(0, 200),
          source: 'DBpedia',
          details: {
            categories: doc.category || [],
            types: doc.type || []
          }
        }));
      } catch (error) {
        console.warn('DBpedia search failed:', error);
        return [];
      }
    }
  },

  /**
   * LOV - Linked Open Vocabularies
   * https://lov.linkeddata.es/dataset/lov/api
   */
  lov: {
    name: 'LOV',
    type: 'api',
    baseUrl: 'https://lov.linkeddata.es/dataset/lov/api/v2',

    async search(query, options = {}) {
      const limit = options.limit || DefinitionAPIConfig.DEFAULT_LIMIT;

      try {
        const response = await fetchWithTimeout(
          `${this.baseUrl}/term/search?q=${encodeURIComponent(query)}`,
          { method: 'GET' },
          DefinitionAPIConfig.TIMEOUT_MS
        );

        const data = await response.json();

        return (data.results || []).slice(0, limit).map(r => ({
          uri: r.uri?.[0] || '',
          id: r.localName?.[0] || '',
          label: r.prefixedName?.[0] || r.localName?.[0] || '',
          description: `Vocabulary: ${r['vocabulary.prefix']?.[0] || 'unknown'}`,
          source: 'LOV',
          details: {
            vocabulary: r['vocabulary.prefix']?.[0],
            vocabularyUri: r['vocabulary.uri']?.[0],
            type: r.type?.[0]
          }
        }));
      } catch (error) {
        console.warn('LOV search failed:', error);
        return [];
      }
    },

    /**
     * Search for vocabularies (ontologies)
     */
    async searchVocabularies(query) {
      try {
        const response = await fetchWithTimeout(
          `${this.baseUrl}/vocabulary/search?q=${encodeURIComponent(query)}`,
          { method: 'GET' },
          DefinitionAPIConfig.TIMEOUT_MS
        );

        const data = await response.json();

        return (data.results || []).slice(0, 10).map(v => ({
          uri: v.uri,
          prefix: v.prefix,
          title: v.titles?.[0]?.value || v.prefix,
          description: v.descriptions?.[0]?.value || '',
          source: 'LOV'
        }));
      } catch (error) {
        console.warn('LOV vocabulary search failed:', error);
        return [];
      }
    }
  },

  /**
   * Schema.org - Web vocabulary (static, no API)
   * Uses fuzzy matching for better search results
   */
  schemaOrg: {
    name: 'Schema.org',
    type: 'static',

    // Common Schema.org types and properties (expanded vocabulary)
    vocabulary: [
      // Types
      { id: 'Thing', type: 'Type', desc: 'The most generic type', keywords: ['entity', 'object', 'item'] },
      { id: 'Person', type: 'Type', desc: 'A person (alive, dead, undead, or fictional)', keywords: ['human', 'individual', 'user'] },
      { id: 'Organization', type: 'Type', desc: 'An organization such as a school, NGO, corporation, club, etc.', keywords: ['company', 'business', 'entity'] },
      { id: 'GovernmentOrganization', type: 'Type', desc: 'A governmental organization or agency', keywords: ['government', 'agency', 'federal', 'state'] },
      { id: 'Place', type: 'Type', desc: 'Entities that have a physical location', keywords: ['location', 'address', 'site'] },
      { id: 'Event', type: 'Type', desc: 'An event happening at a certain time and location', keywords: ['occurrence', 'meeting', 'activity'] },
      { id: 'Action', type: 'Type', desc: 'An action performed by an agent', keywords: ['activity', 'operation', 'task'] },
      { id: 'CreativeWork', type: 'Type', desc: 'The most generic kind of creative work', keywords: ['document', 'content', 'work'] },
      { id: 'Product', type: 'Type', desc: 'Any offered product or service', keywords: ['item', 'good', 'merchandise'] },
      { id: 'Intangible', type: 'Type', desc: 'A utility class for things like quantities and structured values', keywords: ['abstract', 'value'] },
      { id: 'MonetaryAmount', type: 'Type', desc: 'A monetary value or range', keywords: ['money', 'currency', 'price', 'cost', 'amount'] },
      { id: 'QuantitativeValue', type: 'Type', desc: 'A point value or interval for quantitative measurements', keywords: ['number', 'quantity', 'measurement', 'numeric'] },
      { id: 'PropertyValue', type: 'Type', desc: 'A property-value pairing', keywords: ['attribute', 'field', 'key-value'] },
      { id: 'PostalAddress', type: 'Type', desc: 'The mailing address', keywords: ['address', 'street', 'location', 'mail'] },
      { id: 'ContactPoint', type: 'Type', desc: 'A contact point', keywords: ['contact', 'phone', 'email', 'communication'] },
      { id: 'GeoCoordinates', type: 'Type', desc: 'Geographic coordinates', keywords: ['latitude', 'longitude', 'location', 'geo', 'coordinates'] },
      { id: 'Duration', type: 'Type', desc: 'Quantity, e.g. 1 hour', keywords: ['time', 'period', 'length', 'span'] },
      { id: 'DateTime', type: 'Type', desc: 'A combination of date and time', keywords: ['timestamp', 'date', 'time', 'when'] },
      { id: 'Date', type: 'Type', desc: 'A date value', keywords: ['day', 'calendar', 'when'] },
      { id: 'Time', type: 'Type', desc: 'A time value', keywords: ['clock', 'hour', 'when'] },
      { id: 'Number', type: 'Type', desc: 'A numerical value', keywords: ['numeric', 'integer', 'float', 'quantity'] },
      { id: 'Text', type: 'Type', desc: 'A text string value', keywords: ['string', 'text', 'characters', 'words'] },
      { id: 'Boolean', type: 'Type', desc: 'Boolean true or false', keywords: ['true', 'false', 'yes', 'no', 'flag'] },
      { id: 'URL', type: 'Type', desc: 'A Uniform Resource Locator', keywords: ['link', 'web', 'address', 'uri'] },
      // Properties
      { id: 'identifier', type: 'Property', desc: 'The identifier property represents any kind of unique identifier', keywords: ['id', 'unique', 'key', 'uuid', 'guid', 'code', 'number'] },
      { id: 'name', type: 'Property', desc: 'The name of the item', keywords: ['title', 'label', 'heading'] },
      { id: 'description', type: 'Property', desc: 'A description of the item', keywords: ['text', 'summary', 'details', 'about'] },
      { id: 'url', type: 'Property', desc: 'URL of the item', keywords: ['link', 'web', 'address', 'uri'] },
      { id: 'sameAs', type: 'Property', desc: 'URL of a reference that unambiguously indicates the identity', keywords: ['equivalent', 'identical', 'link', 'uri'] },
      { id: 'status', type: 'Property', desc: 'The status of something', keywords: ['state', 'condition', 'active', 'inactive'] },
      { id: 'startDate', type: 'Property', desc: 'The start date and time', keywords: ['begin', 'from', 'start', 'effective'] },
      { id: 'endDate', type: 'Property', desc: 'The end date and time', keywords: ['finish', 'to', 'end', 'expiry', 'until'] },
      { id: 'dateCreated', type: 'Property', desc: 'Date of creation', keywords: ['created', 'made', 'new', 'timestamp'] },
      { id: 'dateModified', type: 'Property', desc: 'Date of last modification', keywords: ['updated', 'changed', 'modified', 'edited'] },
      { id: 'datePublished', type: 'Property', desc: 'Date of first publication', keywords: ['published', 'released', 'issued'] },
      { id: 'location', type: 'Property', desc: 'The location of the event/organization', keywords: ['place', 'where', 'address', 'site'] },
      { id: 'address', type: 'Property', desc: 'Physical address of the item', keywords: ['location', 'street', 'postal'] },
      { id: 'email', type: 'Property', desc: 'Email address', keywords: ['mail', 'contact', 'electronic'] },
      { id: 'telephone', type: 'Property', desc: 'Telephone number', keywords: ['phone', 'mobile', 'contact', 'number'] },
      { id: 'memberOf', type: 'Property', desc: 'Organization the person/org is a member of', keywords: ['belongs', 'organization', 'group'] },
      { id: 'category', type: 'Property', desc: 'A category for the item', keywords: ['type', 'classification', 'group', 'class'] },
      { id: 'value', type: 'Property', desc: 'The value of a QuantitativeValue', keywords: ['amount', 'number', 'quantity'] },
      { id: 'unitCode', type: 'Property', desc: 'The unit of measurement using UN/CEFACT code', keywords: ['unit', 'measurement', 'uom'] },
      { id: 'unitText', type: 'Property', desc: 'The unit of measurement as text', keywords: ['unit', 'measurement', 'uom'] },
      { id: 'currency', type: 'Property', desc: 'The currency code (ISO 4217)', keywords: ['money', 'usd', 'eur', 'code'] },
      { id: 'additionalType', type: 'Property', desc: 'Additional type URL for more specific typing', keywords: ['type', 'class', 'category', 'subtype'] },
      { id: 'alternateName', type: 'Property', desc: 'An alias for the item', keywords: ['alias', 'aka', 'alternate', 'other name'] },
      { id: 'serialNumber', type: 'Property', desc: 'Serial number or unique identifier assigned by manufacturer', keywords: ['serial', 'id', 'unique', 'code', 'number'] },
      { id: 'sku', type: 'Property', desc: 'Stock keeping unit identifier', keywords: ['product', 'id', 'code', 'inventory', 'unique'] },
      { id: 'gtin', type: 'Property', desc: 'Global Trade Item Number (GTIN-8, GTIN-12, GTIN-13, GTIN-14)', keywords: ['barcode', 'upc', 'ean', 'product', 'id', 'unique'] },
      { id: 'duns', type: 'Property', desc: 'Dun & Bradstreet unique identifier', keywords: ['business', 'id', 'unique', 'company', 'number'] },
      { id: 'taxID', type: 'Property', desc: 'Tax identification number', keywords: ['tax', 'id', 'ein', 'tin', 'unique', 'number'] },
      { id: 'globalLocationNumber', type: 'Property', desc: 'Global Location Number (GLN)', keywords: ['location', 'id', 'unique', 'gln'] },
      { id: 'leiCode', type: 'Property', desc: 'Legal Entity Identifier code', keywords: ['lei', 'legal', 'entity', 'id', 'unique'] },
      { id: 'naics', type: 'Property', desc: 'North American Industry Classification System code', keywords: ['industry', 'classification', 'code', 'naics'] },
      { id: 'isicV4', type: 'Property', desc: 'International Standard Industrial Classification code', keywords: ['industry', 'classification', 'code', 'isic'] }
    ],

    async search(query, options = {}) {
      const limit = options.limit || DefinitionAPIConfig.DEFAULT_LIMIT;

      // Use fuzzy matching to find relevant terms
      const results = fuzzyFilter(
        this.vocabulary,
        query,
        item => `${item.id} ${item.desc} ${(item.keywords || []).join(' ')}`,
        0.25 // Lower threshold for more results
      );

      return results
        .slice(0, limit)
        .map(({ item, score }) => ({
          uri: `https://schema.org/${item.id}`,
          id: item.id,
          label: item.id,
          description: `[${item.type}] ${item.desc}`,
          source: 'Schema.org',
          score: score,
          details: {
            type: item.type,
            keywords: item.keywords
          }
        }));
    }
  }
};

// ============================================================================
// SECTION III: Regulatory APIs
// ============================================================================

/**
 * Unified regulatory search result format
 * @typedef {Object} RegulatoryResult
 * @property {string} title - Document/section title
 * @property {string} citation - Legal citation
 * @property {string} snippet - Text excerpt
 * @property {string} url - Source URL
 * @property {string} source - Source name
 * @property {Object} meta - Source-specific metadata
 */

const RegulatoryAPIs = {
  /**
   * eCFR - Electronic Code of Federal Regulations
   * https://www.ecfr.gov/developers/documentation/api/v1
   */
  ecfr: {
    name: 'eCFR',
    type: 'api',
    baseUrl: 'https://www.ecfr.gov/api',

    /**
     * Search eCFR
     * @param {string} query
     * @param {Object} options - { title, limit }
     * @returns {Promise<RegulatoryResult[]>}
     */
    async search(query, options = {}) {
      const limit = options.limit || DefinitionAPIConfig.DEFAULT_LIMIT;

      const params = new URLSearchParams({
        query: query,
        per_page: limit.toString()
      });

      // Filter by CFR title if specified (e.g., title 24 for HUD)
      if (options.title) {
        params.append('title', options.title);
      }

      try {
        const response = await fetchWithTimeout(
          `${this.baseUrl}/search/v1/results?${params}`,
          { method: 'GET' },
          DefinitionAPIConfig.TIMEOUT_MS
        );

        const data = await response.json();

        return (data.results || []).map(r => ({
          title: r.hierarchy_headings?.join(' > ') || r.headings?.title || 'Untitled',
          citation: this._buildCitation(r),
          snippet: r.full_text_excerpt || r.snippet || '',
          url: r.url || this._buildUrl(r),
          source: 'eCFR',
          meta: {
            cfrTitle: r.title,
            part: r.part,
            section: r.section,
            subpart: r.subpart,
            hierarchy: r.hierarchy_headings,
            structureIndex: r.structure_index,
            startDate: r.start_date
          }
        }));
      } catch (error) {
        console.warn('eCFR search failed:', error);
        return [];
      }
    },

    _buildCitation(result) {
      const parts = [];
      if (result.title) parts.push(`${result.title} CFR`);
      if (result.part) parts.push(result.part);
      if (result.section) parts.push(`.${result.section}`);
      return parts.join(' ') || 'CFR';
    },

    _buildUrl(result) {
      if (!result.title || !result.part) return 'https://www.ecfr.gov';
      let url = `https://www.ecfr.gov/current/title-${result.title}/part-${result.part}`;
      if (result.section) {
        url += `/section-${result.part}.${result.section}`;
      }
      return url;
    },

    /**
     * Get structure/table of contents for a CFR title
     */
    async getTitleStructure(titleNumber) {
      try {
        const response = await fetchWithTimeout(
          `${this.baseUrl}/versioner/v1/structure/${new Date().toISOString().split('T')[0]}/title-${titleNumber}.json`,
          { method: 'GET' },
          DefinitionAPIConfig.TIMEOUT_MS
        );
        return await response.json();
      } catch (error) {
        console.warn('eCFR structure fetch failed:', error);
        return null;
      }
    }
  },

  /**
   * Federal Register - Daily journal of the US Government
   * https://www.federalregister.gov/developers/api/v1
   */
  federalRegister: {
    name: 'Federal Register',
    type: 'api',
    baseUrl: 'https://www.federalregister.gov/api/v1',

    async search(query, options = {}) {
      const limit = options.limit || DefinitionAPIConfig.DEFAULT_LIMIT;

      const params = new URLSearchParams({
        'conditions[term]': query,
        per_page: limit.toString(),
        order: 'relevance'
      });

      // Optional filters
      if (options.agencies) {
        options.agencies.forEach(a => params.append('conditions[agencies][]', a));
      }
      if (options.type) {
        params.append('conditions[type][]', options.type);
      }
      if (options.dateFrom) {
        params.append('conditions[publication_date][gte]', options.dateFrom);
      }

      try {
        const response = await fetchWithTimeout(
          `${this.baseUrl}/documents.json?${params}`,
          { method: 'GET' },
          DefinitionAPIConfig.TIMEOUT_MS
        );

        const data = await response.json();

        return (data.results || []).map(r => ({
          title: r.title || 'Untitled',
          citation: r.citation || r.document_number || '',
          snippet: r.abstract || r.excerpt || '',
          url: r.html_url || r.url || '',
          source: 'Federal Register',
          meta: {
            documentNumber: r.document_number,
            type: r.type,
            agencies: r.agencies?.map(a => ({
              name: a.name,
              id: a.id,
              slug: a.slug
            })) || [],
            publicationDate: r.publication_date,
            effectiveDate: r.effective_on,
            cfrReferences: r.cfr_references || [],
            topics: r.topics || [],
            docketIds: r.docket_ids || [],
            pdfUrl: r.pdf_url,
            rawTextUrl: r.raw_text_url
          }
        }));
      } catch (error) {
        console.warn('Federal Register search failed:', error);
        return [];
      }
    },

    /**
     * Get a specific document by document number
     */
    async getDocument(documentNumber) {
      try {
        const response = await fetchWithTimeout(
          `${this.baseUrl}/documents/${documentNumber}.json`,
          { method: 'GET' },
          DefinitionAPIConfig.TIMEOUT_MS
        );
        return await response.json();
      } catch (error) {
        console.warn('Federal Register document fetch failed:', error);
        return null;
      }
    },

    /**
     * Get list of agencies
     */
    async getAgencies() {
      try {
        const response = await fetchWithTimeout(
          `${this.baseUrl}/agencies.json`,
          { method: 'GET' },
          DefinitionAPIConfig.TIMEOUT_MS
        );
        return await response.json();
      } catch (error) {
        console.warn('Federal Register agencies fetch failed:', error);
        return [];
      }
    }
  },

  /**
   * US Code - Federal statutes (via Cornell LII)
   * Note: Cornell LII doesn't have a public API, so we construct search URLs
   */
  usCode: {
    name: 'US Code',
    type: 'link-builder',
    baseUrl: 'https://www.law.cornell.edu/uscode',

    async search(query, options = {}) {
      // Build search URL for Cornell LII
      const searchUrl = `https://www.law.cornell.edu/uscode/text?query=${encodeURIComponent(query)}`;

      // Return a single result that links to the search
      return [{
        title: `Search US Code for "${query}"`,
        citation: 'U.S.C.',
        snippet: 'Click to search Cornell Legal Information Institute',
        url: searchUrl,
        source: 'US Code (Cornell LII)',
        meta: {
          searchQuery: query,
          isExternalSearch: true
        }
      }];
    },

    /**
     * Build direct link to a US Code section
     * @param {string} title - Title number
     * @param {string} section - Section number
     */
    buildSectionUrl(title, section) {
      return `https://www.law.cornell.edu/uscode/text/${title}/${section}`;
    }
  },

  /**
   * GovInfo - Official US Government publications
   * https://api.govinfo.gov/docs/
   */
  govInfo: {
    name: 'GovInfo',
    type: 'api',
    baseUrl: 'https://api.govinfo.gov',

    // Note: GovInfo requires an API key
    // Users should set this via DefinitionAPI.configure({ govInfoApiKey: '...' })
    apiKey: null,

    async search(query, options = {}) {
      if (!this.apiKey) {
        console.warn('GovInfo API key not configured');
        return [];
      }

      const limit = options.limit || DefinitionAPIConfig.DEFAULT_LIMIT;

      const params = new URLSearchParams({
        query: query,
        pageSize: limit.toString(),
        api_key: this.apiKey
      });

      if (options.collection) {
        params.append('collection', options.collection);
      }

      try {
        const response = await fetchWithTimeout(
          `${this.baseUrl}/search?${params}`,
          { method: 'GET' },
          DefinitionAPIConfig.TIMEOUT_MS
        );

        const data = await response.json();

        return (data.results || []).map(r => ({
          title: r.title || 'Untitled',
          citation: r.packageId || '',
          snippet: r.description || '',
          url: r.download?.pdfLink || r.url || '',
          source: 'GovInfo',
          meta: {
            collection: r.collectionCode,
            dateIssued: r.dateIssued,
            government: r.governmentAuthor,
            category: r.category
          }
        }));
      } catch (error) {
        console.warn('GovInfo search failed:', error);
        return [];
      }
    }
  }
};

// ============================================================================
// SECTION IV: Unified Search Interface
// ============================================================================

/**
 * Main DefinitionAPI class - unified interface for all sources
 */
class DefinitionAPI {
  constructor() {
    this.cache = new Map();
    this.lastRequestTime = 0;
  }

  /**
   * Configure API settings
   */
  configure(options = {}) {
    if (options.govInfoApiKey) {
      RegulatoryAPIs.govInfo.apiKey = options.govInfoApiKey;
    }
    if (options.timeout) {
      DefinitionAPIConfig.TIMEOUT_MS = options.timeout;
    }
  }

  /**
   * Search concepts across multiple sources
   * @param {string} query
   * @param {Object} options - { sources: ['wikidata', 'dbpedia', ...], limit }
   * @returns {Promise<ConceptResult[]>}
   */
  async searchConcepts(query, options = {}) {
    const sources = options.sources || ['wikidata'];
    const results = [];

    const searches = sources.map(async (sourceName) => {
      const api = ConceptAPIs[sourceName];
      if (!api) {
        console.warn(`Unknown concept source: ${sourceName}`);
        return [];
      }

      const cacheKey = `concept:${sourceName}:${query}`;
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < DefinitionAPIConfig.CACHE_TTL_MS) {
          return cached.data;
        }
      }

      try {
        const sourceResults = await api.search(query, options);
        this.cache.set(cacheKey, { data: sourceResults, timestamp: Date.now() });
        return sourceResults;
      } catch (error) {
        console.error(`Error searching ${sourceName}:`, error);
        return [];
      }
    });

    const allResults = await Promise.all(searches);
    return allResults.flat();
  }

  /**
   * Search ALL concept sources simultaneously and return ranked results
   * This is the main method for vocabulary import - searches Schema.org, Wikidata, and LOV together
   * @param {string} query - Search query
   * @param {Object} options - { limit, excludeSources: [] }
   * @returns {Promise<ConceptResult[]>} Ranked, deduplicated results from all sources
   */
  async searchAllConcepts(query, options = {}) {
    const limit = options.limit || 30;
    const excludeSources = options.excludeSources || [];

    // All vocabulary sources to search
    const allSources = ['schemaOrg', 'wikidata', 'lov'].filter(s => !excludeSources.includes(s));

    // Search all sources in parallel
    const searches = allSources.map(async (sourceName) => {
      const api = ConceptAPIs[sourceName];
      if (!api) return [];

      const cacheKey = `concept:${sourceName}:${query}`;
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < DefinitionAPIConfig.CACHE_TTL_MS) {
          return cached.data;
        }
      }

      try {
        const sourceResults = await api.search(query, { limit: 15 });
        this.cache.set(cacheKey, { data: sourceResults, timestamp: Date.now() });
        return sourceResults;
      } catch (error) {
        console.warn(`Error searching ${sourceName}:`, error);
        return [];
      }
    });

    const allResults = await Promise.all(searches);
    const combined = allResults.flat();

    // Add fuzzy scores to results that don't have them (from API sources)
    const scored = combined.map(result => {
      if (result.score !== undefined) {
        return result;
      }
      // Calculate fuzzy score for API results
      const searchText = `${result.label || ''} ${result.description || ''}`;
      const score = fuzzyMatchScore(query, searchText);
      return { ...result, score };
    });

    // Deduplicate by URI (prefer higher scored results)
    const seenUris = new Map();
    for (const result of scored) {
      const uri = result.uri?.toLowerCase();
      if (!uri) continue;

      if (!seenUris.has(uri) || seenUris.get(uri).score < result.score) {
        seenUris.set(uri, result);
      }
    }

    // Sort by score (descending) and return top results
    return Array.from(seenUris.values())
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);
  }

  /**
   * Search regulatory sources
   * @param {string} query
   * @param {Object} options - { sources: ['ecfr', 'federalRegister', ...], limit }
   * @returns {Promise<RegulatoryResult[]>}
   */
  async searchRegulatory(query, options = {}) {
    const sources = options.sources || ['ecfr'];
    const results = [];

    const searches = sources.map(async (sourceName) => {
      const api = RegulatoryAPIs[sourceName];
      if (!api) {
        console.warn(`Unknown regulatory source: ${sourceName}`);
        return [];
      }

      const cacheKey = `regulatory:${sourceName}:${query}`;
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < DefinitionAPIConfig.CACHE_TTL_MS) {
          return cached.data;
        }
      }

      try {
        const sourceResults = await api.search(query, options);
        this.cache.set(cacheKey, { data: sourceResults, timestamp: Date.now() });
        return sourceResults;
      } catch (error) {
        console.error(`Error searching ${sourceName}:`, error);
        return [];
      }
    });

    const allResults = await Promise.all(searches);
    return allResults.flat();
  }

  /**
   * Search for authorities (government agencies, organizations)
   * @param {string} query
   * @returns {Promise<ConceptResult[]>}
   */
  async searchAuthorities(query) {
    return ConceptAPIs.wikidata.searchAuthorities(query);
  }

  /**
   * Get detailed information about a Wikidata entity
   * @param {string} entityId
   * @returns {Promise<Object>}
   */
  async getWikidataDetails(entityId) {
    const cacheKey = `wikidata:details:${entityId}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < DefinitionAPIConfig.CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const details = await ConceptAPIs.wikidata.getDetails(entityId);
    if (details) {
      this.cache.set(cacheKey, { data: details, timestamp: Date.now() });
    }
    return details;
  }

  /**
   * Get a Federal Register document by number
   * @param {string} documentNumber
   * @returns {Promise<Object>}
   */
  async getFederalRegisterDocument(documentNumber) {
    return RegulatoryAPIs.federalRegister.getDocument(documentNumber);
  }

  /**
   * Get eCFR title structure
   * @param {number} titleNumber
   * @returns {Promise<Object>}
   */
  async getECFRStructure(titleNumber) {
    return RegulatoryAPIs.ecfr.getTitleStructure(titleNumber);
  }

  /**
   * Search all sources (concept + regulatory)
   * @param {string} query
   * @param {Object} options
   * @returns {Promise<{concepts: ConceptResult[], regulatory: RegulatoryResult[]}>}
   */
  async searchAll(query, options = {}) {
    const [concepts, regulatory] = await Promise.all([
      this.searchConcepts(query, {
        sources: options.conceptSources || ['wikidata', 'schemaOrg'],
        limit: options.limit
      }),
      this.searchRegulatory(query, {
        sources: options.regulatorySources || ['ecfr', 'federalRegister'],
        limit: options.limit
      })
    ]);

    return { concepts, regulatory };
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get available sources (legacy format)
   */
  getSources() {
    return {
      concept: Object.keys(ConceptAPIs).map(key => ({
        id: key,
        name: ConceptAPIs[key].name,
        type: ConceptAPIs[key].type
      })),
      regulatory: Object.keys(RegulatoryAPIs).map(key => ({
        id: key,
        name: RegulatoryAPIs[key].name,
        type: RegulatoryAPIs[key].type
      }))
    };
  }

  /**
   * Get all URI sources with full metadata including auth requirements
   * @param {Object} options - Filter options
   * @param {boolean} options.noAuth - Only sources with no auth required
   * @param {boolean} options.freeAuth - Include sources with free auth
   * @param {string} options.category - Filter by category
   * @param {number} options.tier - Filter by tier (1, 2, or 3)
   * @returns {URISource[]}
   */
  getURISources(options = {}) {
    return filterURISources(options);
  }

  /**
   * Get sources that work without any credentials
   * @returns {URISource[]}
   */
  getOpenURISources() {
    return getOpenSources();
  }

  /**
   * Get sources grouped by category
   * @param {Object} options - Filter options
   * @returns {Object<string, URISource[]>}
   */
  getURISourcesByCategory(options = {}) {
    return getSourcesByCategory(options);
  }

  /**
   * Get sources grouped by tier
   * @param {Object} options - Filter options
   * @returns {Object<number, URISource[]>}
   */
  getURISourcesByTier(options = {}) {
    return getSourcesByTier(options);
  }

  /**
   * Get a summary of all URI sources
   * @returns {Object}
   */
  getURISourcesSummary() {
    return getSourcesSummary();
  }
}

// ============================================================================
// SECTION V: Utility Functions
// ============================================================================

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Strip HTML tags from text
 */
function stripHtml(text) {
  return (text || '').replace(/<[^>]*>/g, '');
}

// ============================================================================
// SECTION VI: Exports
// ============================================================================

// Singleton instance
let _definitionAPI = null;

function getDefinitionAPI() {
  if (!_definitionAPI) {
    _definitionAPI = new DefinitionAPI();
  }
  return _definitionAPI;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.EO = window.EO || {};
  window.EO.DefinitionAPI = DefinitionAPI;
  window.EO.getDefinitionAPI = getDefinitionAPI;
  window.EO.ConceptAPIs = ConceptAPIs;
  window.EO.RegulatoryAPIs = RegulatoryAPIs;
  window.EO.DefinitionAPIConfig = DefinitionAPIConfig;
  // URI Sources registry and helpers
  window.EO.URISources = URISources;
  window.EO.getAllURISources = getAllURISources;
  window.EO.filterURISources = filterURISources;
  window.EO.getOpenSources = getOpenSources;
  window.EO.getSourcesByCategory = getSourcesByCategory;
  window.EO.getSourcesByTier = getSourcesByTier;
  window.EO.getSourcesSummary = getSourcesSummary;
}

// Export for Node.js/ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DefinitionAPI,
    getDefinitionAPI,
    ConceptAPIs,
    RegulatoryAPIs,
    DefinitionAPIConfig,
    // URI Sources registry and helpers
    URISources,
    getAllURISources,
    filterURISources,
    getOpenSources,
    getSourcesByCategory,
    getSourcesByTier,
    getSourcesSummary
  };
}
