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
 * DefinitionStatus - Lifecycle status of a definition
 * Keys appear in definitions by default as stubs, then get populated
 */
const DefinitionStatus = Object.freeze({
  STUB: 'stub',           // Auto-created from key, needs population
  PARTIAL: 'partial',     // Some fields populated, incomplete
  COMPLETE: 'complete',   // All required fields populated
  VERIFIED: 'verified',   // Reviewed and confirmed by user
  LOCAL_ONLY: 'local_only' // No external definition needed
});

/**
 * PopulationMethod - How the definition values were populated
 */
const PopulationMethod = Object.freeze({
  PENDING: 'pending',       // Not yet populated
  API_LOOKUP: 'api_lookup', // Auto-populated from API
  MANUAL: 'manual',         // User entered manually
  IMPORTED: 'imported',     // Came from data import
  SELECTED: 'selected'      // User selected from API suggestions
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
  "description": "A regulatory, legal, or policy definition from an authoritative source. All keys appear as definitions by default (as stubs), then get populated via API or manual entry.",
  "type": "object",
  "required": ["term"],
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
    },
    "status": {
      "type": "string",
      "enum": ["stub", "partial", "complete", "verified", "local_only"],
      "description": "Lifecycle status of the definition. Keys appear as 'stub' by default and get populated over time.",
      "default": "stub"
    },
    "populationMethod": {
      "type": "string",
      "enum": ["pending", "api_lookup", "manual", "imported", "selected"],
      "description": "How the definition values were populated",
      "default": "pending"
    },
    "discoveredFrom": {
      "type": "object",
      "description": "Origin of this definition - the source/field where the key was first discovered",
      "properties": {
        "sourceId": { "type": "string", "description": "ID of the data source" },
        "sourceName": { "type": "string", "description": "Name of the data source" },
        "fieldId": { "type": "string", "description": "ID of the field in the source" },
        "fieldName": { "type": "string", "description": "Name of the field" },
        "fieldType": { "type": "string", "description": "Data type of the field" },
        "discoveredAt": { "type": "string", "format": "date-time", "description": "When the key was discovered" }
      }
    },
    "apiSuggestions": {
      "type": "array",
      "description": "API lookup results available for user selection",
      "items": {
        "type": "object",
        "properties": {
          "source": { "type": "string", "description": "API source (wikidata, ecfr, etc.)" },
          "uri": { "type": "string", "description": "URI of the matched entity" },
          "confidence": { "type": "number", "description": "Match confidence 0-1" },
          "authority": { "type": "object", "description": "Suggested authority info" },
          "validity": { "type": "object", "description": "Suggested validity info" },
          "jurisdiction": { "type": "object", "description": "Suggested jurisdiction info" },
          "definitionText": { "type": "string", "description": "Definition text from source" },
          "citation": { "type": "string", "description": "Citation if available" }
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
 *
 * All keys appear in definitions by default as stubs. The lifecycle is:
 * 1. stub -> created automatically when key is discovered
 * 2. partial -> some fields populated via API or manual entry
 * 3. complete -> all required fields populated
 * 4. verified -> reviewed and confirmed by user
 * 5. local_only -> no external definition needed (local term)
 */
class DefinitionSource {
  /**
   * Create a new DefinitionSource
   * @param {Object} data - The definition source data
   * @param {Object} options - Options for creation
   * @param {boolean} options.allowStub - Allow stub definitions without full validation
   */
  constructor(data, options = {}) {
    const allowStub = options.allowStub || data.status === DefinitionStatus.STUB || data.status === 'stub';

    // Validate required fields (relaxed for stubs)
    const errors = DefinitionSource.validate(data, { allowStub });
    if (errors.length > 0) {
      throw new Error(`Invalid DefinitionSource: ${errors.join(', ')}`);
    }

    // Generate unique ID
    this.id = data.id || `defsrc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // NEW: Status and population tracking
    this.status = data.status || DefinitionStatus.STUB;
    this.populationMethod = data.populationMethod || PopulationMethod.PENDING;

    // NEW: Discovery origin - where this key was first found
    this.discoveredFrom = data.discoveredFrom ? {
      sourceId: data.discoveredFrom.sourceId || null,
      sourceName: data.discoveredFrom.sourceName || null,
      fieldId: data.discoveredFrom.fieldId || null,
      fieldName: data.discoveredFrom.fieldName || null,
      fieldType: data.discoveredFrom.fieldType || null,
      discoveredAt: data.discoveredFrom.discoveredAt || new Date().toISOString()
    } : null;

    // NEW: API suggestions for user selection
    this.apiSuggestions = Array.isArray(data.apiSuggestions) ? [...data.apiSuggestions] : [];

    // Term (required - even for stubs)
    this.term = {
      term: data.term.term,
      label: data.term.label || this._generateLabel(data.term.term),
      asWritten: data.term.asWritten || null,
      definitionText: data.term.definitionText || null,
      categories: Array.isArray(data.term.categories) ? [...data.term.categories] : null
    };

    // Authority (optional for stubs)
    this.authority = data.authority ? {
      name: data.authority.name || null,
      shortName: data.authority.shortName || null,
      uri: data.authority.uri || null,
      type: data.authority.type || null
    } : null;

    // Source document (optional for stubs)
    this.source = data.source ? {
      title: data.source.title || null,
      citation: data.source.citation || null,
      section: data.source.section || null,
      url: data.source.url || null,
      type: data.source.type || null
    } : null;

    // Version (optional)
    this.version = data.version ? {
      id: data.version.id || null,
      published: data.version.published || null
    } : null;

    // Validity (optional for stubs)
    this.validity = data.validity ? {
      from: data.validity.from || null,
      to: data.validity.to || null,
      supersedes: data.validity.supersedes || null,
      supersededBy: data.validity.supersededBy || null
    } : null;

    // Jurisdiction (optional)
    this.jurisdiction = data.jurisdiction ? {
      geographic: data.jurisdiction.geographic || null,
      programs: Array.isArray(data.jurisdiction.programs) ? [...data.jurisdiction.programs] : null
    } : null;

    // Metadata
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Generate a label from a term name (snake_case -> Title Case)
   * @private
   */
  _generateLabel(term) {
    if (!term) return null;
    return term
      .replace(/[_-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Validate a definition source object
   * @param {Object} data - The data to validate
   * @param {Object} options - Validation options
   * @param {boolean} options.allowStub - Allow stub definitions (only require term)
   * @returns {string[]} Array of validation error messages
   */
  static validate(data, options = {}) {
    const errors = [];
    const allowStub = options.allowStub || data.status === 'stub' || data.status === DefinitionStatus.STUB;

    // Term validation (always required)
    if (!data.term) {
      errors.push('missing term object');
    } else if (!data.term.term) {
      errors.push('missing term.term');
    }

    // For stubs, only term is required - other fields are optional
    if (allowStub) {
      // Validate authority type if provided
      if (data.authority?.type && !isValidAuthorityType(data.authority.type)) {
        errors.push(`invalid authority.type: ${data.authority.type}`);
      }
      return errors;
    }

    // Full validation for non-stub definitions
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
   * Check if this definition is a stub (needs population)
   * @returns {boolean}
   */
  isStub() {
    return this.status === DefinitionStatus.STUB || this.status === 'stub';
  }

  /**
   * Check if this definition needs population
   * @returns {boolean}
   */
  needsPopulation() {
    return this.status === DefinitionStatus.STUB ||
           this.status === DefinitionStatus.PARTIAL ||
           this.status === 'stub' ||
           this.status === 'partial';
  }

  /**
   * Check if this definition has API suggestions available
   * @returns {boolean}
   */
  hasApiSuggestions() {
    return this.apiSuggestions && this.apiSuggestions.length > 0;
  }

  /**
   * Get the best API suggestion (highest confidence)
   * @returns {Object|null}
   */
  getBestSuggestion() {
    if (!this.hasApiSuggestions()) return null;
    return this.apiSuggestions.reduce((best, current) =>
      (current.confidence || 0) > (best.confidence || 0) ? current : best
    );
  }

  /**
   * Add an API suggestion
   * @param {Object} suggestion - The suggestion to add
   */
  addApiSuggestion(suggestion) {
    if (!this.apiSuggestions) {
      this.apiSuggestions = [];
    }
    this.apiSuggestions.push(suggestion);
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Populate this definition from an API suggestion
   * @param {Object} suggestion - The suggestion to use
   * @returns {DefinitionSource} - New definition with populated fields
   */
  populateFromSuggestion(suggestion) {
    const data = this.toJSON();

    // Merge suggestion data
    if (suggestion.authority) {
      data.authority = { ...data.authority, ...suggestion.authority };
    }
    if (suggestion.validity) {
      data.validity = { ...data.validity, ...suggestion.validity };
    }
    if (suggestion.jurisdiction) {
      data.jurisdiction = { ...data.jurisdiction, ...suggestion.jurisdiction };
    }
    if (suggestion.definitionText) {
      data.term = { ...data.term, definitionText: suggestion.definitionText };
    }
    if (suggestion.citation) {
      data.source = data.source || {};
      data.source.citation = suggestion.citation;
    }

    // Update status and method
    data.status = this._calculateStatus(data);
    data.populationMethod = PopulationMethod.SELECTED;
    data.updatedAt = new Date().toISOString();

    return new DefinitionSource(data, { allowStub: true });
  }

  /**
   * Calculate status based on populated fields
   * @private
   */
  _calculateStatus(data) {
    const hasAuthority = data.authority?.name && data.authority?.type;
    const hasSource = data.source?.citation || data.source?.title;
    const hasValidity = data.validity?.from;
    const hasDefinitionText = data.term?.definitionText;

    if (hasAuthority && hasSource && hasValidity && hasDefinitionText) {
      return DefinitionStatus.COMPLETE;
    } else if (hasAuthority || hasSource || hasValidity || hasDefinitionText) {
      return DefinitionStatus.PARTIAL;
    }
    return DefinitionStatus.STUB;
  }

  /**
   * Mark this definition as local-only (no external definition needed)
   * @param {string} notes - Optional notes about why it's local-only
   * @returns {DefinitionSource}
   */
  markAsLocalOnly(notes = null) {
    const data = this.toJSON();
    data.status = DefinitionStatus.LOCAL_ONLY;
    data.populationMethod = PopulationMethod.MANUAL;
    if (notes) {
      data.term = { ...data.term, definitionText: notes };
    }
    data.updatedAt = new Date().toISOString();
    return new DefinitionSource(data, { allowStub: true });
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
      status: this.status,
      populationMethod: this.populationMethod,
      term: { ...this.term },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };

    // Include optional objects if they exist
    if (this.authority) obj.authority = { ...this.authority };
    if (this.source) obj.source = { ...this.source };
    if (this.validity) obj.validity = { ...this.validity };
    if (this.version) obj.version = { ...this.version };
    if (this.jurisdiction) obj.jurisdiction = { ...this.jurisdiction };
    if (this.discoveredFrom) obj.discoveredFrom = { ...this.discoveredFrom };
    if (this.apiSuggestions?.length > 0) obj.apiSuggestions = [...this.apiSuggestions];

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

/**
 * Create a stub definition from a field/key
 * This is the primary factory for the "keys in definitions by default" pattern
 *
 * @param {Object} options
 * @param {string} options.term - The key/field name (required)
 * @param {string} options.label - Human readable label (auto-generated if not provided)
 * @param {string} options.fieldType - Data type of the field
 * @param {Object} options.discoveredFrom - Origin source/field info
 * @returns {DefinitionSource}
 */
function createStubDefinition(options = {}) {
  if (!options.term) {
    throw new Error('createStubDefinition requires a term');
  }

  return new DefinitionSource({
    status: DefinitionStatus.STUB,
    populationMethod: PopulationMethod.PENDING,
    term: {
      term: options.term,
      label: options.label || null, // Will be auto-generated in constructor
      definitionText: null,
      asWritten: null,
      categories: null
    },
    discoveredFrom: options.discoveredFrom || null,
    apiSuggestions: []
  }, { allowStub: true });
}

/**
 * Create stub definitions for all fields in a source
 * @param {Object} source - Source object with schema.fields
 * @returns {DefinitionSource[]}
 */
function createStubDefinitionsForSource(source) {
  if (!source?.schema?.fields) {
    return [];
  }

  return source.schema.fields.map(field => {
    return createStubDefinition({
      term: field.name,
      fieldType: field.type,
      discoveredFrom: {
        sourceId: source.id,
        sourceName: source.name,
        fieldId: field.id || field.name,
        fieldName: field.name,
        fieldType: field.type,
        discoveredAt: new Date().toISOString()
      }
    });
  });
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

/**
 * Get definitions that need population (stub or partial status)
 * @param {DefinitionSource[]} definitions
 * @returns {DefinitionSource[]}
 */
function getDefinitionsNeedingPopulation(definitions) {
  return definitions.filter(d => d.needsPopulation());
}

/**
 * Get stub definitions only
 * @param {DefinitionSource[]} definitions
 * @returns {DefinitionSource[]}
 */
function getStubDefinitions(definitions) {
  return definitions.filter(d => d.isStub());
}

/**
 * Get definitions with API suggestions available
 * @param {DefinitionSource[]} definitions
 * @returns {DefinitionSource[]}
 */
function getDefinitionsWithSuggestions(definitions) {
  return definitions.filter(d => d.hasApiSuggestions());
}

/**
 * Get definitions by status
 * @param {DefinitionSource[]} definitions
 * @param {string} status - DefinitionStatus value
 * @returns {DefinitionSource[]}
 */
function getDefinitionsByStatus(definitions, status) {
  return definitions.filter(d => d.status === status);
}

/**
 * Get definitions discovered from a specific source
 * @param {DefinitionSource[]} definitions
 * @param {string} sourceId - Source ID
 * @returns {DefinitionSource[]}
 */
function getDefinitionsFromSource(definitions, sourceId) {
  return definitions.filter(d => d.discoveredFrom?.sourceId === sourceId);
}

/**
 * Count definitions by status
 * @param {DefinitionSource[]} definitions
 * @returns {Object} - { stub: n, partial: n, complete: n, verified: n, local_only: n }
 */
function countDefinitionsByStatus(definitions) {
  const counts = {
    stub: 0,
    partial: 0,
    complete: 0,
    verified: 0,
    local_only: 0
  };

  for (const def of definitions) {
    const status = def.status || 'stub';
    if (counts[status] !== undefined) {
      counts[status]++;
    }
  }

  return counts;
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

  // Enumerations
  window.EO.AuthorityType = AuthorityType;
  window.EO.SourceDocumentType = SourceDocumentType;
  window.EO.DefinitionStatus = DefinitionStatus;
  window.EO.PopulationMethod = PopulationMethod;

  // Factory functions
  window.EO.createHUDHomelessnessDefinition = createHUDHomelessnessDefinition;
  window.EO.createCensusPovertyDefinition = createCensusPovertyDefinition;
  window.EO.createHUDAffordableHousingDefinition = createHUDAffordableHousingDefinition;
  window.EO.createStubDefinition = createStubDefinition;
  window.EO.createStubDefinitionsForSource = createStubDefinitionsForSource;

  // Utilities
  window.EO.sortDefinitionsByAuthority = sortDefinitionsByAuthority;
  window.EO.findDefinitionsByTerm = findDefinitionsByTerm;
  window.EO.findDefinitionsByAuthority = findDefinitionsByAuthority;
  window.EO.getCurrentDefinitions = getCurrentDefinitions;
  window.EO.getDefinitionsNeedingPopulation = getDefinitionsNeedingPopulation;
  window.EO.getStubDefinitions = getStubDefinitions;
  window.EO.getDefinitionsWithSuggestions = getDefinitionsWithSuggestions;
  window.EO.getDefinitionsByStatus = getDefinitionsByStatus;
  window.EO.getDefinitionsFromSource = getDefinitionsFromSource;
  window.EO.countDefinitionsByStatus = countDefinitionsByStatus;
}

// Export for Node.js/ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DefinitionSource,
    DefinitionSourceSchema,
    DefinitionSourceTemplate,
    AuthorityType,
    SourceDocumentType,
    DefinitionStatus,
    PopulationMethod,
    createHUDHomelessnessDefinition,
    createCensusPovertyDefinition,
    createHUDAffordableHousingDefinition,
    createStubDefinition,
    createStubDefinitionsForSource,
    sortDefinitionsByAuthority,
    findDefinitionsByTerm,
    findDefinitionsByAuthority,
    getCurrentDefinitions,
    getDefinitionsNeedingPopulation,
    getStubDefinitions,
    getDefinitionsWithSuggestions,
    getDefinitionsByStatus,
    getDefinitionsFromSource,
    countDefinitionsByStatus
  };
}
