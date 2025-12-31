/**
 * EO Definition Source - Regulatory & Legal Definition Schema
 *
 * This module defines the DefinitionSource type for capturing regulatory,
 * legal, or policy definitions from authoritative sources.
 *
 * The schema is designed to:
 * - Reference official definitions with full citation
 * - Track authority (who defines the term)
 * - Track source document (where it's defined)
 * - Track validity periods and version history
 * - Support jurisdiction and program scope
 *
 * Based on the Definition Source Builder schema for AI-compatible JSON.
 */

// ============================================================================
// SECTION I: Type Enumerations (Closed Sets)
// ============================================================================

/**
 * AuthorityType - The type of authority that defines a term
 */
const AuthorityType = Object.freeze({
  FEDERAL_AGENCY: 'federal_agency',
  STATE_AGENCY: 'state_agency',
  LOCAL_GOV: 'local_gov',
  STANDARDS_BODY: 'standards_body',
  NGO: 'ngo',
  ACADEMIC: 'academic',
  INTERNATIONAL: 'international',
  OTHER: 'other'
});

/**
 * SourceDocumentType - The type of source document
 */
const SourceDocumentType = Object.freeze({
  REGULATION: 'regulation',
  STATUTE: 'statute',
  GUIDANCE: 'guidance',
  POLICY: 'policy',
  STANDARD: 'standard',
  MANUAL: 'manual',
  OTHER: 'other'
});

/**
 * Validate authority type
 */
function isValidAuthorityType(type) {
  return Object.values(AuthorityType).includes(type);
}

/**
 * Validate source document type
 */
function isValidSourceDocumentType(type) {
  return Object.values(SourceDocumentType).includes(type);
}

// ============================================================================
// SECTION II: JSON Schema (for AI consumption and validation)
// ============================================================================

/**
 * Full JSON Schema for DefinitionSource
 * Can be exported for AI tools and validation
 */
const DefinitionSourceSchema = Object.freeze({
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DefinitionSource",
  "description": "A regulatory, legal, or policy definition from an authoritative source",
  "type": "object",
  "required": ["term", "authority", "source", "validity"],
  "properties": {
    "term": {
      "type": "object",
      "description": "The term being defined",
      "required": ["term"],
      "properties": {
        "term": { "type": "string", "description": "The term/concept name (maps to column key)" },
        "label": { "type": "string", "description": "Human-readable display label" },
        "asWritten": { "type": "string", "description": "How the term appears in the source document" },
        "definitionText": { "type": "string", "description": "The actual definition text or summary" },
        "categories": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Sub-categories if the definition has multiple parts (e.g., HUD's 4 categories)"
        }
      }
    },
    "authority": {
      "type": "object",
      "description": "The governing body that defines this term",
      "required": ["name", "type"],
      "properties": {
        "name": { "type": "string", "description": "Full name of the authority" },
        "shortName": { "type": "string", "description": "Acronym or short name (e.g., HUD, IRS)" },
        "uri": { "type": "string", "format": "uri", "description": "Wikidata or other URI for the authority" },
        "type": {
          "type": "string",
          "enum": ["federal_agency", "state_agency", "local_gov", "standards_body", "ngo", "academic", "international", "other"],
          "description": "Type of authority"
        }
      }
    },
    "source": {
      "type": "object",
      "description": "The document where the definition is published",
      "required": ["citation"],
      "properties": {
        "title": { "type": "string", "description": "Document title" },
        "citation": { "type": "string", "description": "Legal citation (e.g., '24 CFR 578.3', '42 U.S.C. § 11302')" },
        "section": { "type": "string", "description": "Specific section or paragraph" },
        "url": { "type": "string", "format": "uri", "description": "Direct URL to the source" },
        "type": {
          "type": "string",
          "enum": ["regulation", "statute", "guidance", "policy", "standard", "manual", "other"],
          "description": "Type of source document"
        }
      }
    },
    "version": {
      "type": "object",
      "description": "Version information for the definition",
      "properties": {
        "id": { "type": "string", "description": "Version identifier (e.g., '2015 Final Rule')" },
        "published": { "type": "string", "format": "date", "description": "Publication date (YYYY-MM-DD)" }
      }
    },
    "validity": {
      "type": "object",
      "description": "When this definition is/was in force",
      "required": ["from"],
      "properties": {
        "from": { "type": "string", "format": "date", "description": "Effective date (YYYY-MM-DD)" },
        "to": { "type": "string", "format": "date", "description": "End date if no longer in force" },
        "supersedes": { "type": "string", "description": "Previous version this replaces" },
        "supersededBy": { "type": "string", "description": "Newer version that replaced this" }
      }
    },
    "jurisdiction": {
      "type": "object",
      "description": "Where this definition applies",
      "properties": {
        "geographic": { "type": "string", "description": "Geographic scope (e.g., 'United States', 'California')" },
        "programs": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Specific programs this applies to (e.g., ['CoC Program', 'ESG Program'])"
        }
      }
    }
  }
});

/**
 * AI-friendly export template for bulk definition creation
 */
const DefinitionSourceTemplate = Object.freeze({
  "_instructions": "Fill in the fields below. Required fields are marked. Return as JSON array if creating multiple definitions.",
  "_example_terms": ["homeless", "affordable_housing", "poverty", "disability", "veteran"],
  "term": {
    "term": "REQUIRED: term name (snake_case, maps to column)",
    "label": "Human readable label",
    "asWritten": "How it appears in source document",
    "definitionText": "The actual definition text",
    "categories": ["Optional array of sub-categories"]
  },
  "authority": {
    "name": "REQUIRED: Full authority name",
    "shortName": "Acronym",
    "uri": "Wikidata URI if known",
    "type": "REQUIRED: federal_agency|state_agency|local_gov|standards_body|ngo|academic"
  },
  "source": {
    "title": "Document title",
    "citation": "REQUIRED: Legal citation (e.g., 24 CFR 578.3)",
    "section": "Specific section",
    "url": "Direct URL",
    "type": "regulation|statute|guidance|policy|standard"
  },
  "version": {
    "id": "Version name",
    "published": "YYYY-MM-DD"
  },
  "validity": {
    "from": "REQUIRED: YYYY-MM-DD effective date",
    "to": "YYYY-MM-DD if no longer in force",
    "supersedes": "Previous version"
  },
  "jurisdiction": {
    "geographic": "e.g., United States",
    "programs": ["Program names"]
  }
});

// ============================================================================
// SECTION III: DefinitionSource Class
// ============================================================================

/**
 * DefinitionSource - A regulatory, legal, or policy definition
 */
class DefinitionSource {
  /**
   * Create a new DefinitionSource
   * @param {Object} data - The definition source data
   */
  constructor(data) {
    // Validate required fields
    const errors = DefinitionSource.validate(data);
    if (errors.length > 0) {
      throw new Error(`Invalid DefinitionSource: ${errors.join(', ')}`);
    }

    // Generate unique ID
    this.id = data.id || `defsrc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Term (required)
    this.term = {
      term: data.term.term,
      label: data.term.label || null,
      asWritten: data.term.asWritten || null,
      definitionText: data.term.definitionText || null,
      categories: Array.isArray(data.term.categories) ? [...data.term.categories] : null
    };

    // Authority (required)
    this.authority = {
      name: data.authority.name,
      shortName: data.authority.shortName || null,
      uri: data.authority.uri || null,
      type: data.authority.type
    };

    // Source document (required)
    this.source = {
      title: data.source?.title || null,
      citation: data.source.citation,
      section: data.source?.section || null,
      url: data.source?.url || null,
      type: data.source?.type || null
    };

    // Version (optional)
    this.version = data.version ? {
      id: data.version.id || null,
      published: data.version.published || null
    } : null;

    // Validity (required)
    this.validity = {
      from: data.validity.from,
      to: data.validity.to || null,
      supersedes: data.validity.supersedes || null,
      supersededBy: data.validity.supersededBy || null
    };

    // Jurisdiction (optional)
    this.jurisdiction = data.jurisdiction ? {
      geographic: data.jurisdiction.geographic || null,
      programs: Array.isArray(data.jurisdiction.programs) ? [...data.jurisdiction.programs] : null
    } : null;

    // Metadata
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();

    Object.freeze(this.term);
    Object.freeze(this.authority);
    Object.freeze(this.source);
    if (this.version) Object.freeze(this.version);
    Object.freeze(this.validity);
    if (this.jurisdiction) Object.freeze(this.jurisdiction);
  }

  /**
   * Validate a definition source object
   * @param {Object} data - The data to validate
   * @returns {string[]} Array of validation error messages
   */
  static validate(data) {
    const errors = [];

    // Term validation
    if (!data.term) {
      errors.push('missing term object');
    } else if (!data.term.term) {
      errors.push('missing term.term');
    }

    // Authority validation
    if (!data.authority) {
      errors.push('missing authority object');
    } else {
      if (!data.authority.name) {
        errors.push('missing authority.name');
      }
      if (!data.authority.type) {
        errors.push('missing authority.type');
      } else if (!isValidAuthorityType(data.authority.type)) {
        errors.push(`invalid authority.type: ${data.authority.type}`);
      }
    }

    // Source validation
    if (!data.source) {
      errors.push('missing source object');
    } else if (!data.source.citation && !data.source.title) {
      errors.push('missing source.citation or source.title');
    }

    // Validity validation
    if (!data.validity) {
      errors.push('missing validity object');
    } else if (!data.validity.from) {
      errors.push('missing validity.from');
    }

    return errors;
  }

  /**
   * Check if this definition is currently in force
   * @returns {boolean}
   */
  isCurrent() {
    const now = new Date().toISOString().split('T')[0];
    if (this.validity.from > now) return false;
    if (this.validity.to && this.validity.to < now) return false;
    if (this.validity.supersededBy) return false;
    return true;
  }

  /**
   * Get a display name for this definition
   * @returns {string}
   */
  getDisplayName() {
    return this.term.label || this.term.term;
  }

  /**
   * Get the authority display name
   * @returns {string}
   */
  getAuthorityDisplayName() {
    return this.authority.shortName || this.authority.name;
  }

  /**
   * Get a short citation string
   * @returns {string}
   */
  getCitation() {
    return this.source.citation || this.source.title || 'Unknown source';
  }

  /**
   * Export to plain JSON object (for serialization)
   * @returns {Object}
   */
  toJSON() {
    const obj = {
      id: this.id,
      term: { ...this.term },
      authority: { ...this.authority },
      source: { ...this.source },
      validity: { ...this.validity },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };

    if (this.version) obj.version = { ...this.version };
    if (this.jurisdiction) obj.jurisdiction = { ...this.jurisdiction };

    // Remove null values for cleaner output
    const clean = (o) => {
      Object.keys(o).forEach(k => {
        if (o[k] === null) delete o[k];
        else if (typeof o[k] === 'object' && !Array.isArray(o[k])) clean(o[k]);
      });
      return o;
    };

    return clean(obj);
  }

  /**
   * Create from JSON (hydration)
   * @param {Object} json - Plain JSON object
   * @returns {DefinitionSource}
   */
  static fromJSON(json) {
    return new DefinitionSource(json);
  }
}

// ============================================================================
// SECTION IV: Factory Functions
// ============================================================================

/**
 * Create a HUD homelessness definition
 */
function createHUDHomelessnessDefinition(options = {}) {
  return new DefinitionSource({
    term: {
      term: options.term || 'homeless',
      label: options.label || 'Homelessness Status',
      asWritten: 'Homeless',
      definitionText: 'An individual or family who lacks a fixed, regular, and adequate nighttime residence.',
      categories: [
        'Category 1: Literally homeless',
        'Category 2: Imminent risk of homelessness',
        'Category 3: Homeless under other federal statutes',
        'Category 4: Fleeing/attempting to flee domestic violence'
      ]
    },
    authority: {
      name: 'U.S. Department of Housing and Urban Development',
      shortName: 'HUD',
      uri: 'http://www.wikidata.org/entity/Q596692',
      type: AuthorityType.FEDERAL_AGENCY
    },
    source: {
      title: 'Continuum of Care Program',
      citation: '24 CFR 578.3',
      section: '§578.3 Definitions',
      url: 'https://www.ecfr.gov/current/title-24/subtitle-B/chapter-V/subchapter-C/part-578/subpart-A/section-578.3',
      type: SourceDocumentType.REGULATION
    },
    version: {
      id: '2015 Final Rule',
      published: '2015-12-04'
    },
    validity: {
      from: '2015-12-04',
      supersedes: '2012 Interim Rule'
    },
    jurisdiction: {
      geographic: 'United States',
      programs: ['CoC Program', 'ESG Program']
    }
  });
}

/**
 * Create a Census Bureau poverty definition
 */
function createCensusPovertyDefinition(options = {}) {
  return new DefinitionSource({
    term: {
      term: options.term || 'poverty',
      label: options.label || 'Poverty Status',
      asWritten: 'Poverty Threshold',
      definitionText: 'The poverty thresholds are updated each year by the Census Bureau based on CPI-U adjustments.',
      categories: null
    },
    authority: {
      name: 'U.S. Census Bureau',
      shortName: 'Census',
      uri: 'http://www.wikidata.org/entity/Q637413',
      type: AuthorityType.FEDERAL_AGENCY
    },
    source: {
      title: 'Poverty Thresholds',
      citation: '',
      url: 'https://www.census.gov/topics/income-poverty/poverty/guidance/poverty-measures.html',
      type: SourceDocumentType.STANDARD
    },
    validity: {
      from: options.effectiveDate || new Date().getFullYear() + '-01-01'
    },
    jurisdiction: {
      geographic: 'United States',
      programs: ['Statistical reporting']
    }
  });
}

/**
 * Create HUD affordable housing definition
 */
function createHUDAffordableHousingDefinition(options = {}) {
  return new DefinitionSource({
    term: {
      term: options.term || 'affordable_housing',
      label: options.label || 'Affordable Housing',
      asWritten: 'Qualification as affordable housing',
      definitionText: 'Housing occupied by low-income families paying no more than 30 percent of adjusted income for rent, including utilities.',
      categories: null
    },
    authority: {
      name: 'U.S. Department of Housing and Urban Development',
      shortName: 'HUD',
      uri: 'http://www.wikidata.org/entity/Q596692',
      type: AuthorityType.FEDERAL_AGENCY
    },
    source: {
      title: 'HOME Investment Partnerships Program',
      citation: '24 CFR 92.252',
      section: '§92.252',
      url: 'https://www.ecfr.gov/current/title-24/subtitle-A/part-92/subpart-F/section-92.252',
      type: SourceDocumentType.REGULATION
    },
    validity: {
      from: options.effectiveDate || '2013-07-24'
    },
    jurisdiction: {
      geographic: 'United States',
      programs: ['HOME Program']
    }
  });
}

// ============================================================================
// SECTION IV-B: EO Lake Internal Term Definitions
// ============================================================================

/**
 * Create an EO Lake "Source" definition
 * Source is the GIVEN layer - immutable raw imported data
 */
function createSourceDefinition(options = {}) {
  return new DefinitionSource({
    term: {
      term: options.term || 'source',
      label: options.label || 'Source',
      asWritten: 'Source',
      definitionText: 'A Source is immutable raw data imported from external files (CSV, JSON, Excel, ICS). Sources represent the GIVEN layer - external reality frozen at import time. Source data cannot be edited; it preserves the original form of imported data with full provenance tracking including file hash, import timestamp, and origin metadata.',
      categories: [
        'GIVEN layer (external reality)',
        'Immutable after import',
        'Contains raw records and inferred schema',
        'Tracks file identity and provenance'
      ]
    },
    authority: {
      name: 'EO Lake',
      shortName: 'EO',
      uri: null,
      type: AuthorityType.STANDARDS_BODY
    },
    source: {
      title: 'EO Lake Data Model',
      citation: 'eo_ontology.js',
      section: 'SourceConfig',
      url: null,
      type: SourceDocumentType.STANDARD
    },
    validity: {
      from: '2024-01-01'
    },
    jurisdiction: {
      geographic: null,
      programs: ['EO Lake']
    }
  });
}

/**
 * Create an EO Lake "Set" definition
 * Set is the MEANT layer - first interpretive container
 */
function createSetDefinition(options = {}) {
  return new DefinitionSource({
    term: {
      term: options.term || 'set',
      label: options.label || 'Set',
      asWritten: 'Set',
      definitionText: 'A Set is a typed data collection representing the MEANT layer - the first interpretive layer over raw Source data. Sets contain a schema with field definitions, records derived from a Source, and can have multiple Lenses for different views. Sets are editable and support field types like text, number, date, select, and more.',
      categories: [
        'MEANT layer (interpretation)',
        'Derived from Source via constraint',
        'Contains schema with typed fields',
        'Holds records and child Lenses'
      ]
    },
    authority: {
      name: 'EO Lake',
      shortName: 'EO',
      uri: null,
      type: AuthorityType.STANDARDS_BODY
    },
    source: {
      title: 'EO Lake Data Model',
      citation: 'eo_view_hierarchy.js',
      section: 'SetConfig',
      url: null,
      type: SourceDocumentType.STANDARD
    },
    validity: {
      from: '2024-01-01'
    },
    jurisdiction: {
      geographic: null,
      programs: ['EO Lake']
    }
  });
}

/**
 * Create an EO Lake "Lens" definition
 * Lens is a record-type subset within a Set
 */
function createLensDefinition(options = {}) {
  return new DefinitionSource({
    term: {
      term: options.term || 'lens',
      label: options.label || 'Lens',
      asWritten: 'Lens',
      definitionText: 'A Lens is a filtered subset of a Set scoped to a specific record type. Lenses use field-based selectors to filter records (e.g., Type = "Task") and can have their own refined schema with field overrides. A record can belong to multiple Lenses. Each Lens can have multiple Views (Grid, Cards, Kanban, etc.) for different display modes.',
      categories: [
        'Scoped to record type within Set',
        'Uses field_match selector for filtering',
        'Supports schema field overrides',
        'Contains multiple View configurations'
      ]
    },
    authority: {
      name: 'EO Lake',
      shortName: 'EO',
      uri: null,
      type: AuthorityType.STANDARDS_BODY
    },
    source: {
      title: 'EO Lake Data Model',
      citation: 'eo_view_hierarchy.js',
      section: 'LensConfig',
      url: null,
      type: SourceDocumentType.STANDARD
    },
    validity: {
      from: '2024-01-01'
    },
    jurisdiction: {
      geographic: null,
      programs: ['EO Lake']
    }
  });
}

/**
 * Create an EO Lake "View" definition
 * View is a display configuration for presenting data
 */
function createViewDefinition(options = {}) {
  return new DefinitionSource({
    term: {
      term: options.term || 'view',
      label: options.label || 'View',
      asWritten: 'View',
      definitionText: 'A View is a display configuration that determines how records are presented. Views belong to a Lens or Set and define the visual layout: Grid (tabular rows), Cards (visual entities), Kanban (status columns), Timeline (chronological), Calendar (date-positioned), or Graph (relationships). Views control field visibility, sorting, grouping, and display options.',
      categories: [
        'Display configuration only',
        'Types: Grid, Cards, Kanban, Timeline, Calendar, Graph',
        'Controls field visibility and ordering',
        'Defines grouping and sorting options'
      ]
    },
    authority: {
      name: 'EO Lake',
      shortName: 'EO',
      uri: null,
      type: AuthorityType.STANDARDS_BODY
    },
    source: {
      title: 'EO Lake Data Model',
      citation: 'eo_view_hierarchy.js',
      section: 'LensConfig.lensType',
      url: null,
      type: SourceDocumentType.STANDARD
    },
    validity: {
      from: '2024-01-01'
    },
    jurisdiction: {
      geographic: null,
      programs: ['EO Lake']
    }
  });
}

/**
 * Create all EO Lake term definitions
 * @returns {DefinitionSource[]} Array of all EO Lake term definitions
 */
function createEOLakeTermDefinitions() {
  return [
    createSourceDefinition(),
    createSetDefinition(),
    createLensDefinition(),
    createViewDefinition()
  ];
}

// ============================================================================
// SECTION V: Utilities
// ============================================================================

/**
 * Merge multiple definition sources for the same term
 * Returns definitions sorted by authority weight and recency
 * @param {DefinitionSource[]} definitions
 * @returns {DefinitionSource[]}
 */
function sortDefinitionsByAuthority(definitions) {
  const authorityWeight = {
    [AuthorityType.FEDERAL_AGENCY]: 1,
    [AuthorityType.STATE_AGENCY]: 2,
    [AuthorityType.LOCAL_GOV]: 3,
    [AuthorityType.STANDARDS_BODY]: 4,
    [AuthorityType.INTERNATIONAL]: 5,
    [AuthorityType.NGO]: 6,
    [AuthorityType.ACADEMIC]: 7,
    [AuthorityType.OTHER]: 8
  };

  return [...definitions].sort((a, b) => {
    // First by authority type
    const weightDiff = authorityWeight[a.authority.type] - authorityWeight[b.authority.type];
    if (weightDiff !== 0) return weightDiff;

    // Then by currency (current definitions first)
    if (a.isCurrent() && !b.isCurrent()) return -1;
    if (!a.isCurrent() && b.isCurrent()) return 1;

    // Then by effective date (most recent first)
    return b.validity.from.localeCompare(a.validity.from);
  });
}

/**
 * Find definitions by term
 * @param {DefinitionSource[]} definitions
 * @param {string} term
 * @returns {DefinitionSource[]}
 */
function findDefinitionsByTerm(definitions, term) {
  const normalized = term.toLowerCase().replace(/[\s_-]+/g, '_');
  return definitions.filter(d =>
    d.term.term.toLowerCase() === normalized ||
    d.term.label?.toLowerCase().includes(term.toLowerCase())
  );
}

/**
 * Find definitions by authority
 * @param {DefinitionSource[]} definitions
 * @param {string} authorityName - Name or short name
 * @returns {DefinitionSource[]}
 */
function findDefinitionsByAuthority(definitions, authorityName) {
  const normalized = authorityName.toLowerCase();
  return definitions.filter(d =>
    d.authority.name.toLowerCase().includes(normalized) ||
    d.authority.shortName?.toLowerCase() === normalized
  );
}

/**
 * Get only current (in-force) definitions
 * @param {DefinitionSource[]} definitions
 * @returns {DefinitionSource[]}
 */
function getCurrentDefinitions(definitions) {
  return definitions.filter(d => d.isCurrent());
}

// ============================================================================
// SECTION VI: Exports
// ============================================================================

// Export for browser (attach to window.EO)
if (typeof window !== 'undefined') {
  window.EO = window.EO || {};
  window.EO.DefinitionSource = DefinitionSource;
  window.EO.DefinitionSourceSchema = DefinitionSourceSchema;
  window.EO.DefinitionSourceTemplate = DefinitionSourceTemplate;
  window.EO.AuthorityType = AuthorityType;
  window.EO.SourceDocumentType = SourceDocumentType;

  // Factory functions - Regulatory definitions
  window.EO.createHUDHomelessnessDefinition = createHUDHomelessnessDefinition;
  window.EO.createCensusPovertyDefinition = createCensusPovertyDefinition;
  window.EO.createHUDAffordableHousingDefinition = createHUDAffordableHousingDefinition;

  // Factory functions - EO Lake internal terms
  window.EO.createSourceDefinition = createSourceDefinition;
  window.EO.createSetDefinition = createSetDefinition;
  window.EO.createLensDefinition = createLensDefinition;
  window.EO.createViewDefinition = createViewDefinition;
  window.EO.createEOLakeTermDefinitions = createEOLakeTermDefinitions;

  // Utilities
  window.EO.sortDefinitionsByAuthority = sortDefinitionsByAuthority;
  window.EO.findDefinitionsByTerm = findDefinitionsByTerm;
  window.EO.findDefinitionsByAuthority = findDefinitionsByAuthority;
  window.EO.getCurrentDefinitions = getCurrentDefinitions;
}

// Export for Node.js/ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DefinitionSource,
    DefinitionSourceSchema,
    DefinitionSourceTemplate,
    AuthorityType,
    SourceDocumentType,
    // Regulatory definitions
    createHUDHomelessnessDefinition,
    createCensusPovertyDefinition,
    createHUDAffordableHousingDefinition,
    // EO Lake internal terms
    createSourceDefinition,
    createSetDefinition,
    createLensDefinition,
    createViewDefinition,
    createEOLakeTermDefinitions,
    // Utilities
    sortDefinitionsByAuthority,
    findDefinitionsByTerm,
    findDefinitionsByAuthority,
    getCurrentDefinitions
  };
}
