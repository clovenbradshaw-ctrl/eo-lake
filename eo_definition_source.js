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
      "description": "Origin of this definition - the source/field where the key was first discovered, including all source field properties for matching",
      "properties": {
        "sourceId": { "type": "string", "description": "ID of the data source" },
        "sourceName": { "type": "string", "description": "Name of the data source" },
        "fieldId": { "type": "string", "description": "ID of the field in the source" },
        "fieldName": { "type": "string", "description": "Name of the field" },
        "fieldType": { "type": "string", "description": "Data type of the field" },
        "fieldConfidence": { "type": "number", "description": "Type inference confidence (0-1)" },
        "fieldIsPrimary": { "type": "boolean", "description": "Whether this is the primary/key field" },
        "fieldSamples": { "type": "array", "items": { "type": "string" }, "description": "Sample values from the field" },
        "fieldOptions": { "type": "object", "description": "Field options (e.g., choices for SELECT fields)", "properties": {
          "choices": { "type": "array", "items": { "type": "object", "properties": {
            "id": { "type": "string" },
            "name": { "type": "string" },
            "color": { "type": "string" }
          }}}
        }},
        "fieldUniqueValues": { "type": "array", "items": { "type": "string" }, "description": "Unique values found in the field (up to 50)" },
        "fieldSampleCount": { "type": "number", "description": "Total number of non-null values in the field" },
        "fieldUniqueCount": { "type": "number", "description": "Total count of unique values in the field" },
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
          "qualityLabel": { "type": "string", "description": "Match quality label (Excellent, Good, Fair, Partial, Weak)" },
          "qualityColor": { "type": "string", "description": "Color for quality indicator" },
          "fieldCoverage": {
            "type": "object",
            "description": "How many of the 9 definition fields this source can populate",
            "properties": {
              "count": { "type": "number", "description": "Number of field groups covered" },
              "total": { "type": "number", "description": "Total field groups (9)" },
              "percentage": { "type": "number", "description": "Coverage percentage (0-1)" },
              "groups": { "type": "array", "items": { "type": "string" }, "description": "Which field groups are covered" }
            }
          },
          "authority": { "type": "object", "description": "Suggested authority info" },
          "validity": { "type": "object", "description": "Suggested validity info" },
          "jurisdiction": { "type": "object", "description": "Suggested jurisdiction info" },
          "definitionText": { "type": "string", "description": "Definition text from source" },
          "citation": { "type": "string", "description": "Citation if available" }
        }
      }
    },
    "uriSource": {
      "type": "object",
      "description": "Tracks the original URI source used to populate this definition, for modification detection",
      "properties": {
        "uri": { "type": "string", "description": "The URI that was selected" },
        "source": { "type": "string", "description": "Source type (wikidata, ecfr, etc.)" },
        "label": { "type": "string", "description": "Display label from the source" },
        "populatedAt": { "type": "string", "format": "date-time", "description": "When the definition was populated from this URI" },
        "score": { "type": "number", "description": "Match quality score (0-1) at time of selection" },
        "qualityLabel": { "type": "string", "description": "Match quality label at time of selection" },
        "fieldCoverage": { "type": "object", "description": "Field coverage at time of selection" },
        "originalValues": {
          "type": "object",
          "description": "Snapshot of original values from URI for modification detection",
          "additionalProperties": true
        }
      }
    },
    "modifiedFromSource": {
      "type": "boolean",
      "description": "True if definition has been modified from its original URI source values",
      "default": false
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
    // Includes all source field properties for matching and dictionary table display
    this.discoveredFrom = data.discoveredFrom ? {
      sourceId: data.discoveredFrom.sourceId || null,
      sourceName: data.discoveredFrom.sourceName || null,
      fieldId: data.discoveredFrom.fieldId || null,
      fieldName: data.discoveredFrom.fieldName || null,
      fieldType: data.discoveredFrom.fieldType || null,
      fieldConfidence: data.discoveredFrom.fieldConfidence ?? null,
      fieldIsPrimary: data.discoveredFrom.fieldIsPrimary ?? null,
      fieldSamples: Array.isArray(data.discoveredFrom.fieldSamples) ? [...data.discoveredFrom.fieldSamples] : null,
      fieldOptions: data.discoveredFrom.fieldOptions ? { ...data.discoveredFrom.fieldOptions } : null,
      fieldUniqueValues: Array.isArray(data.discoveredFrom.fieldUniqueValues) ? [...data.discoveredFrom.fieldUniqueValues] : null,
      fieldSampleCount: data.discoveredFrom.fieldSampleCount ?? null,
      fieldUniqueCount: data.discoveredFrom.fieldUniqueCount ?? null,
      discoveredAt: data.discoveredFrom.discoveredAt || new Date().toISOString()
    } : null;

    // NEW: API suggestions for user selection
    this.apiSuggestions = Array.isArray(data.apiSuggestions) ? [...data.apiSuggestions] : [];

    // NEW: URI source tracking for modification detection
    // Stores the original URI source that was used to populate this definition
    this.uriSource = data.uriSource ? {
      uri: data.uriSource.uri || null,
      source: data.uriSource.source || null,
      label: data.uriSource.label || null,
      populatedAt: data.uriSource.populatedAt || null,
      score: data.uriSource.score ?? null,
      qualityLabel: data.uriSource.qualityLabel || null,
      fieldCoverage: data.uriSource.fieldCoverage ? { ...data.uriSource.fieldCoverage } : null,
      originalValues: data.uriSource.originalValues ? JSON.parse(JSON.stringify(data.uriSource.originalValues)) : null
    } : null;

    // NEW: Track if definition has been modified from its URI source
    this.modifiedFromSource = data.modifiedFromSource || false;

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
   * Populate this definition from an API suggestion (with URI source tracking)
   * @param {Object} suggestion - The suggestion to use (can be URIMatchResult or plain object)
   * @returns {DefinitionSource} - New definition with populated fields and URI tracking
   */
  populateFromSuggestion(suggestion) {
    const data = this.toJSON();

    // Get populatable fields - handle both URIMatchResult and plain objects
    const populatableFields = suggestion.populatableFields || {};

    // Merge suggestion data with priority to populatableFields
    if (populatableFields.authority || suggestion.authority) {
      data.authority = { ...data.authority, ...(populatableFields.authority || suggestion.authority) };
    }
    if (populatableFields.validity || suggestion.validity) {
      data.validity = { ...data.validity, ...(populatableFields.validity || suggestion.validity) };
    }
    if (populatableFields.jurisdiction || suggestion.jurisdiction) {
      data.jurisdiction = { ...data.jurisdiction, ...(populatableFields.jurisdiction || suggestion.jurisdiction) };
    }
    if (populatableFields.source || suggestion.citation) {
      data.source = data.source || {};
      if (populatableFields.source) {
        data.source = { ...data.source, ...populatableFields.source };
      }
      if (suggestion.citation) {
        data.source.citation = suggestion.citation;
      }
    }
    if (populatableFields.version) {
      data.version = { ...data.version, ...populatableFields.version };
    }
    if (populatableFields.term?.definitionText || suggestion.definitionText) {
      data.term = { ...data.term, definitionText: populatableFields.term?.definitionText || suggestion.definitionText };
    }

    // Track the URI source for modification detection
    data.uriSource = {
      uri: suggestion.uri || null,
      source: suggestion.source || null,
      label: suggestion.label || suggestion.title || null,
      populatedAt: new Date().toISOString(),
      score: suggestion.score ?? suggestion.confidence ?? null,
      qualityLabel: suggestion.qualityLabel || null,
      fieldCoverage: suggestion.fieldCoverage || null,
      originalValues: JSON.parse(JSON.stringify(populatableFields))
    };

    // Mark as not modified (freshly populated from source)
    data.modifiedFromSource = false;

    // Update status and method
    data.status = this._calculateStatus(data);
    data.populationMethod = PopulationMethod.SELECTED;
    data.updatedAt = new Date().toISOString();

    return new DefinitionSource(data, { allowStub: true });
  }

  /**
   * Check if this definition has a linked URI source
   * @returns {boolean}
   */
  hasURISource() {
    return this.uriSource && this.uriSource.uri;
  }

  /**
   * Get the URI source info
   * @returns {Object|null}
   */
  getURISourceInfo() {
    if (!this.hasURISource()) return null;
    return {
      uri: this.uriSource.uri,
      source: this.uriSource.source,
      label: this.uriSource.label,
      populatedAt: this.uriSource.populatedAt,
      score: this.uriSource.score,
      qualityLabel: this.uriSource.qualityLabel,
      fieldCoverage: this.uriSource.fieldCoverage
    };
  }

  /**
   * Check if definition has been modified from its URI source
   * Compares current values against original snapshot
   * @returns {Object} - { modified, modifications[], source }
   */
  checkModifications() {
    if (!this.hasURISource() || !this.uriSource.originalValues) {
      return { modified: false, modifications: [], source: null };
    }

    const modifications = [];
    const original = this.uriSource.originalValues;

    // Check each field group
    for (const [group, originalValue] of Object.entries(original)) {
      const currentValue = this[group];
      if (!currentValue || !originalValue) continue;

      const changes = this._compareFieldGroup(originalValue, currentValue);
      if (changes.length > 0) {
        modifications.push({
          group,
          changes,
          original: originalValue,
          current: currentValue
        });
      }
    }

    return {
      modified: modifications.length > 0,
      modifications,
      source: this.getURISourceInfo()
    };
  }

  /**
   * Compare a field group's values
   * @private
   */
  _compareFieldGroup(original, current) {
    const changes = [];
    for (const [field, origValue] of Object.entries(original)) {
      if (origValue === null || origValue === undefined) continue;
      const currValue = current[field];

      if (Array.isArray(origValue) && Array.isArray(currValue)) {
        if (JSON.stringify(origValue) !== JSON.stringify(currValue)) {
          changes.push({ field, original: origValue, current: currValue, type: 'modified' });
        }
      } else if (currValue !== origValue) {
        changes.push({
          field,
          original: origValue,
          current: currValue,
          type: currValue === null ? 'removed' : 'modified'
        });
      }
    }
    return changes;
  }

  /**
   * Get modification status for display
   * @returns {Object} - { status, message, icon, color, details }
   */
  getModificationStatus() {
    if (!this.hasURISource()) {
      return {
        status: 'no_source',
        message: 'No URI source linked',
        icon: 'ph-question',
        color: '#9ca3af'
      };
    }

    const check = this.checkModifications();
    if (!check.modified) {
      return {
        status: 'unchanged',
        message: `Matches ${this.uriSource.source} source`,
        icon: 'ph-check-circle',
        color: '#059669',
        details: `Populated from ${this.uriSource.uri}`,
        qualityLabel: this.uriSource.qualityLabel
      };
    }

    const modCount = check.modifications.reduce((sum, m) => sum + m.changes.length, 0);
    return {
      status: 'modified',
      message: `Modified from ${this.uriSource.source} source`,
      icon: 'ph-pencil-simple',
      color: '#f59e0b',
      details: `${modCount} field${modCount > 1 ? 's' : ''} changed from original`,
      modifications: check.modifications,
      originalSource: this.getURISourceInfo()
    };
  }

  /**
   * Mark the definition as modified and update the flag
   */
  markAsModified() {
    this.modifiedFromSource = true;
    this.updatedAt = new Date().toISOString();
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

    // URI source tracking for modification detection
    if (this.uriSource) {
      obj.uriSource = {
        ...this.uriSource,
        originalValues: this.uriSource.originalValues
          ? JSON.parse(JSON.stringify(this.uriSource.originalValues))
          : null
      };
    }
    if (this.modifiedFromSource) obj.modifiedFromSource = this.modifiedFromSource;

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
 * @param {number} options.fieldConfidence - Type inference confidence (0-1)
 * @param {boolean} options.fieldIsPrimary - Whether this is the primary/key field
 * @param {string[]} options.fieldSamples - Sample values from the field
 * @param {Object} options.fieldOptions - Field options (e.g., choices for SELECT fields)
 * @param {string[]} options.fieldUniqueValues - Unique values found in the field
 * @param {Object} options.discoveredFrom - Origin source/field info
 * @returns {DefinitionSource}
 */
function createStubDefinition(options = {}) {
  if (!options.term) {
    throw new Error('createStubDefinition requires a term');
  }

  // Build discoveredFrom with all source field properties for matching
  const discoveredFrom = options.discoveredFrom ? {
    ...options.discoveredFrom,
    // Ensure all field properties are included
    fieldType: options.discoveredFrom.fieldType || options.fieldType || null,
    fieldConfidence: options.discoveredFrom.fieldConfidence ?? options.fieldConfidence ?? null,
    fieldIsPrimary: options.discoveredFrom.fieldIsPrimary ?? options.fieldIsPrimary ?? null,
    fieldSamples: options.discoveredFrom.fieldSamples || options.fieldSamples || null,
    fieldOptions: options.discoveredFrom.fieldOptions || options.fieldOptions || null,
    fieldUniqueValues: options.discoveredFrom.fieldUniqueValues || options.fieldUniqueValues || null
  } : null;

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
    discoveredFrom: discoveredFrom,
    apiSuggestions: []
  }, { allowStub: true });
}

/**
 * Create stub definitions for all fields in a source
 * Passes all source field properties to definitions for matching
 * @param {Object} source - Source object with schema.fields
 * @returns {DefinitionSource[]}
 */
function createStubDefinitionsForSource(source) {
  if (!source?.schema?.fields) {
    return [];
  }

  return source.schema.fields.map(field => {
    // Extract unique values - prioritize field.uniqueValues, then options.choices, then samples
    let fieldUniqueValues = null;
    if (field.uniqueValues && Array.isArray(field.uniqueValues)) {
      // Use directly captured unique values from import
      fieldUniqueValues = field.uniqueValues;
    } else if (field.options?.choices && Array.isArray(field.options.choices)) {
      // Use choice names for SELECT fields
      fieldUniqueValues = field.options.choices.map(c => c.name);
    } else if (field.samples && Array.isArray(field.samples)) {
      // Fall back to samples as unique values
      fieldUniqueValues = [...new Set(field.samples.map(String))];
    }

    // Ensure samples are captured (use at least 10 samples if available)
    const fieldSamples = field.samples && Array.isArray(field.samples)
      ? field.samples.slice(0, 10)
      : null;

    return createStubDefinition({
      term: field.name,
      fieldType: field.type,
      fieldConfidence: field.confidence,
      fieldIsPrimary: field.isPrimary,
      fieldSamples: fieldSamples,
      fieldOptions: field.options,
      fieldUniqueValues: fieldUniqueValues,
      discoveredFrom: {
        sourceId: source.id,
        sourceName: source.name,
        fieldId: field.id || field.name,
        fieldName: field.name,
        fieldType: field.type,
        fieldConfidence: field.confidence,
        fieldIsPrimary: field.isPrimary,
        fieldSamples: fieldSamples,
        fieldOptions: field.options,
        fieldUniqueValues: fieldUniqueValues,
        fieldSampleCount: field.sampleCount ?? null,
        fieldUniqueCount: field.uniqueCount ?? null,
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

/**
 * Sync definitions from a source - creates stub definitions for any new fields
 * Use this when a source is re-imported or updated to ensure all fields have definitions
 *
 * @param {Object} source - Source object with schema.fields
 * @param {DefinitionSource[]} existingDefinitions - Existing definitions to check against
 * @returns {{ newDefinitions: DefinitionSource[], existingCount: number, newCount: number }}
 */
function syncDefinitionsFromSource(source, existingDefinitions = []) {
  if (!source?.schema?.fields) {
    return { newDefinitions: [], existingCount: 0, newCount: 0 };
  }

  // Build set of existing field names for this source
  const existingFieldNames = new Set(
    existingDefinitions
      .filter(d => d.discoveredFrom?.sourceId === source.id)
      .map(d => d.term?.term || d.discoveredFrom?.fieldName)
  );

  const newDefinitions = [];
  let existingCount = 0;

  for (const field of source.schema.fields) {
    if (existingFieldNames.has(field.name)) {
      existingCount++;
    } else {
      // Create stub definition for new field
      const fieldUniqueValues = field.uniqueValues ||
        (field.options?.choices?.map(c => c.name)) ||
        (field.samples ? [...new Set(field.samples.map(String))] : null);

      const fieldSamples = field.samples?.slice(0, 10) || null;

      const stubDef = createStubDefinition({
        term: field.name,
        fieldType: field.type,
        fieldConfidence: field.confidence,
        fieldIsPrimary: field.isPrimary,
        fieldSamples: fieldSamples,
        fieldOptions: field.options,
        fieldUniqueValues: fieldUniqueValues,
        discoveredFrom: {
          sourceId: source.id,
          sourceName: source.name,
          fieldId: field.id || field.name,
          fieldName: field.name,
          fieldType: field.type,
          fieldConfidence: field.confidence,
          fieldIsPrimary: field.isPrimary,
          fieldSamples: fieldSamples,
          fieldOptions: field.options,
          fieldUniqueValues: fieldUniqueValues,
          fieldSampleCount: field.sampleCount ?? null,
          fieldUniqueCount: field.uniqueCount ?? null,
          discoveredAt: new Date().toISOString()
        }
      });
      newDefinitions.push(stubDef);
    }
  }

  return {
    newDefinitions,
    existingCount,
    newCount: newDefinitions.length
  };
}

/**
 * Get a clear source label for a definition (for dictionary table display)
 * @param {DefinitionSource} definition
 * @returns {string} - Human-readable source label
 */
function getDefinitionSourceLabel(definition) {
  if (!definition.discoveredFrom) {
    return 'Unknown source';
  }

  const { sourceName, sourceId, fieldName, discoveredAt } = definition.discoveredFrom;
  const sourcePart = sourceName || sourceId || 'Imported data';
  const datePart = discoveredAt ? new Date(discoveredAt).toLocaleDateString() : '';

  return datePart ? `${sourcePart} (${datePart})` : sourcePart;
}

/**
 * Get definition summary for dictionary table display
 * @param {DefinitionSource} definition
 * @returns {Object} - { term, label, type, source, samples, uniqueValues, status }
 */
function getDefinitionTableSummary(definition) {
  const df = definition.discoveredFrom || {};

  // Get URI source info if available
  let uriSourceInfo = null;
  if (definition.uriSource?.uri) {
    const modStatus = definition.getModificationStatus ? definition.getModificationStatus() : null;
    uriSourceInfo = {
      uri: definition.uriSource.uri,
      source: definition.uriSource.source,
      label: definition.uriSource.label,
      score: definition.uriSource.score,
      qualityLabel: definition.uriSource.qualityLabel,
      fieldCoverage: definition.uriSource.fieldCoverage,
      populatedAt: definition.uriSource.populatedAt,
      modificationStatus: modStatus
    };
  }

  return {
    id: definition.id,
    term: definition.term?.term || df.fieldName || 'Unknown',
    label: definition.term?.label || definition.term?.term || df.fieldName,
    type: df.fieldType || 'text',
    source: getDefinitionSourceLabel(definition),
    sourceId: df.sourceId,
    sourceName: df.sourceName,
    samples: df.fieldSamples || [],
    uniqueValues: df.fieldUniqueValues || [],
    sampleCount: df.fieldSampleCount,
    uniqueCount: df.fieldUniqueCount,
    isPrimary: df.fieldIsPrimary || false,
    confidence: df.fieldConfidence,
    status: definition.status || 'stub',
    populationMethod: definition.populationMethod || 'pending',
    hasApiSuggestions: definition.apiSuggestions?.length > 0,
    // URI source tracking
    hasURISource: !!definition.uriSource?.uri,
    uriSource: uriSourceInfo,
    modifiedFromSource: definition.modifiedFromSource || false
  };
}

/**
 * Get a human-readable URI match quality summary
 * @param {Object} uriSourceInfo - URI source info from getDefinitionTableSummary
 * @returns {Object} - { text, icon, color, details }
 */
function getURIMatchQualitySummary(uriSourceInfo) {
  if (!uriSourceInfo) {
    return {
      text: 'No URI linked',
      icon: 'ph-question',
      color: '#9ca3af',
      details: null
    };
  }

  const coverage = uriSourceInfo.fieldCoverage;
  const coverageText = coverage
    ? `${coverage.count}/${coverage.total} fields (${Math.round(coverage.percentage * 100)}%)`
    : 'Unknown coverage';

  const modStatus = uriSourceInfo.modificationStatus;

  return {
    text: uriSourceInfo.qualityLabel || 'Linked',
    icon: modStatus?.status === 'modified' ? 'ph-pencil-simple' : 'ph-check-circle',
    color: modStatus?.color || '#059669',
    details: {
      source: uriSourceInfo.source,
      label: uriSourceInfo.label,
      uri: uriSourceInfo.uri,
      score: uriSourceInfo.score ? `${Math.round(uriSourceInfo.score * 100)}%` : null,
      coverage: coverageText,
      coveredGroups: coverage?.groups || [],
      modified: modStatus?.status === 'modified',
      modificationDetails: modStatus?.details
    }
  };
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
  window.EO.syncDefinitionsFromSource = syncDefinitionsFromSource;
  window.EO.getDefinitionSourceLabel = getDefinitionSourceLabel;
  window.EO.getDefinitionTableSummary = getDefinitionTableSummary;
  window.EO.getURIMatchQualitySummary = getURIMatchQualitySummary;
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
    countDefinitionsByStatus,
    syncDefinitionsFromSource,
    getDefinitionSourceLabel,
    getDefinitionTableSummary,
    getURIMatchQualitySummary
  };
}
