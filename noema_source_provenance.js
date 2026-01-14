/**
 * EO Source Provenance - Identity/Space/Time Structure
 *
 * Source-level data has provenance grounded in three fundamental dimensions:
 *
 * I. IDENTITY - What has been made into a thing?
 *    Answers: "What is this, such that it can be referred to again?"
 *    - Identity Carrier: What is being treated as the unit of meaning
 *    - Designation Event: How did this thing become nameable
 *    - Identity Authority: Who had standing to make this thing real
 *
 * II. SPACE - Where are the boundaries of relevance?
 *    Answers: "Inside what boundary does this identity hold?"
 *    - Boundary Type: Is this bounded, unbounded, or fractal
 *    - Containment Surface: Where does this thing live
 *    - Jurisdictional Envelope: Who agrees this boundary counts
 *
 * III. TIME - How does this persist or change?
 *    Answers: "Is this frozen, evolving, or self-revising?"
 *    - Temporal Mode: Static, dynamic, or recursive
 *    - Time of Fixation: When did this identity lock
 *    - Validity Horizon: How long should this be trusted
 *
 * KEY INSIGHT:
 * Provenance is not "who/where/when."
 * Provenance is the minimum structure required to stabilize identity in space and time.
 *
 * If a field does not answer identity, space, or time, it is optional.
 * If it does - and is missing - you don't have a record, you have a ghost.
 */

// ============================================================================
// Identity Dimension
// ============================================================================

/**
 * IdentityKind - What is being treated as the unit of meaning
 */
const IdentityKind = Object.freeze({
  CLAIM: 'claim',               // An assertion about something
  OBSERVATION: 'observation',   // A witnessed phenomenon
  RECORD: 'record',             // A structured data entry
  IMPORT: 'import',             // Data brought in from external source
  INTERPRETATION: 'interpretation' // A meaning assigned to data
});

/**
 * IdentityScope - Is the identity atomic or composed
 */
const IdentityScope = Object.freeze({
  ATOMIC: 'atomic',         // Single, indivisible unit
  COMPOSITE: 'composite',   // Made up of multiple parts
  AGGREGATE: 'aggregate'    // Statistical combination
});

/**
 * DesignationOperator - How identity was stabilized
 */
const DesignationOperator = Object.freeze({
  DES: 'des',   // Designation - named something new
  INS: 'ins',   // Instantiation - created instance of type
  REC: 'rec',   // Reception - received from external source
  GEN: 'gen'    // Generation - computed/derived
});

/**
 * AuthorityClass - Who had standing to make this real
 */
const AuthorityClass = Object.freeze({
  HUMAN: 'human',             // Individual person
  INSTITUTION: 'institution', // Organization with authority
  PIPELINE: 'pipeline',       // Automated data pipeline
  AUTONOMOUS: 'autonomous'    // Autonomous system/AI
});

// ============================================================================
// Space Dimension
// ============================================================================

/**
 * BoundaryType - Is the identity bounded or unbounded
 * Uses phase-space notation: +1 (bounded), -1 (unbounded), sqrt(2) (fractal)
 */
const BoundaryType = Object.freeze({
  BOUNDED: '+1',        // Discrete, finite boundary
  UNBOUNDED: '-1',      // Stream, field, no clear edges
  FRACTAL: 'sqrt2'      // Nested, scale-repeating
});

/**
 * BoundaryBasis - What defines the container
 */
const BoundaryBasis = Object.freeze({
  FILE: 'file',           // File system boundary
  SYSTEM: 'system',       // System/database boundary
  DOMAIN: 'domain',       // Logical domain
  JURISDICTION: 'jurisdiction' // Legal/authority boundary
});

/**
 * ContainerStability - Is the container mutable
 */
const ContainerStability = Object.freeze({
  IMMUTABLE: 'immutable',  // Cannot be changed
  MUTABLE: 'mutable'       // Can be modified
});

/**
 * ContainmentLevel - Where in hierarchy
 */
const ContainmentLevel = Object.freeze({
  LEAF: 'leaf',             // Terminal node (e.g., individual record)
  INTERMEDIATE: 'intermediate', // Mid-level container
  ROOT: 'root'              // Top-level container
});

// ============================================================================
// Time Dimension
// ============================================================================

/**
 * TemporalMode - How does this persist or change
 * Uses phase-space notation: -1 (static), +1 (dynamic), tau (recursive)
 */
const TemporalMode = Object.freeze({
  STATIC: '-1',      // This just is, frozen at import
  DYNAMIC: '+1',     // This changes over time
  RECURSIVE: 'tau'   // This updates itself
});

// ============================================================================
// Source Provenance Structure
// ============================================================================

/**
 * Source Provenance Elements organized by dimension
 */
const SourceProvenanceElements = Object.freeze({
  // Identity Dimension
  IDENTITY_KIND: 'identity_kind',
  IDENTITY_SCOPE: 'identity_scope',
  DESIGNATION_OPERATOR: 'designation_operator',
  DESIGNATION_MECHANISM: 'designation_mechanism',
  DESIGNATION_TIME: 'designation_time',
  ASSERTING_AGENT: 'asserting_agent',
  AUTHORITY_CLASS: 'authority_class',

  // Space Dimension
  BOUNDARY_TYPE: 'boundary_type',
  BOUNDARY_BASIS: 'boundary_basis',
  CONTAINER_ID: 'container_id',
  CONTAINER_STABILITY: 'container_stability',
  CONTAINMENT_LEVEL: 'containment_level',
  JURISDICTION_PRESENT: 'jurisdiction_present',

  // Time Dimension
  TEMPORAL_MODE: 'temporal_mode',
  TEMPORAL_JUSTIFICATION: 'temporal_justification',
  FIXATION_TIMESTAMP: 'fixation_timestamp',
  FIXATION_EVENT: 'fixation_event',
  VALIDITY_WINDOW: 'validity_window',
  REASSESSMENT_REQUIRED: 'reassessment_required'
});

/**
 * Grouping of elements by dimension
 */
const SourceProvenanceDimensions = Object.freeze({
  IDENTITY: [
    'identity_kind',
    'identity_scope',
    'designation_operator',
    'designation_mechanism',
    'designation_time',
    'asserting_agent',
    'authority_class'
  ],
  SPACE: [
    'boundary_type',
    'boundary_basis',
    'container_id',
    'container_stability',
    'containment_level',
    'jurisdiction_present'
  ],
  TIME: [
    'temporal_mode',
    'temporal_justification',
    'fixation_timestamp',
    'fixation_event',
    'validity_window',
    'reassessment_required'
  ]
});

/**
 * Labels and UI metadata for source provenance elements
 */
const SourceProvenanceLabels = Object.freeze({
  // Identity Dimension
  identity_kind: {
    label: 'Identity Kind',
    question: 'What type of thing is this?',
    hint: 'claim, observation, record, import, interpretation',
    icon: 'ph-fingerprint',
    dimension: 'identity',
    required: true
  },
  identity_scope: {
    label: 'Identity Scope',
    question: 'Is this atomic or composite?',
    hint: 'atomic, composite, aggregate',
    icon: 'ph-atom',
    dimension: 'identity',
    required: true
  },
  designation_operator: {
    label: 'Designation Operator',
    question: 'How was identity stabilized?',
    hint: 'DES (named), INS (instantiated), REC (received), GEN (generated)',
    icon: 'ph-tag',
    dimension: 'identity',
    required: true
  },
  designation_mechanism: {
    label: 'Designation Mechanism',
    question: 'What mechanism created this identity?',
    hint: 'e.g., JSON import, CSV parse, manual entry',
    icon: 'ph-gear',
    dimension: 'identity',
    required: false
  },
  designation_time: {
    label: 'Designation Time',
    question: 'When was identity stabilized?',
    hint: 'Timestamp of identity creation',
    icon: 'ph-clock',
    dimension: 'identity',
    required: true
  },
  asserting_agent: {
    label: 'Asserting Agent',
    question: 'Who made this thing real?',
    hint: 'Person, system, or pipeline',
    icon: 'ph-user',
    dimension: 'identity',
    required: true
  },
  authority_class: {
    label: 'Authority Class',
    question: 'What type of authority asserted this?',
    hint: 'human, institution, pipeline, autonomous',
    icon: 'ph-shield-check',
    dimension: 'identity',
    required: false
  },

  // Space Dimension
  boundary_type: {
    label: 'Boundary Type',
    question: 'Is this bounded or unbounded?',
    hint: '+1 (bounded), -1 (unbounded), sqrt2 (fractal)',
    icon: 'ph-frame-corners',
    dimension: 'space',
    required: true
  },
  boundary_basis: {
    label: 'Boundary Basis',
    question: 'What defines the container?',
    hint: 'file, system, domain, jurisdiction',
    icon: 'ph-bounding-box',
    dimension: 'space',
    required: false
  },
  container_id: {
    label: 'Container ID',
    question: 'Where does this thing live?',
    hint: 'File path, table name, system ID',
    icon: 'ph-folder',
    dimension: 'space',
    required: true
  },
  container_stability: {
    label: 'Container Stability',
    question: 'Can the container change?',
    hint: 'immutable or mutable',
    icon: 'ph-lock',
    dimension: 'space',
    required: false
  },
  containment_level: {
    label: 'Containment Level',
    question: 'Where in hierarchy?',
    hint: 'leaf, intermediate, root',
    icon: 'ph-tree-structure',
    dimension: 'space',
    required: false
  },
  jurisdiction_present: {
    label: 'Jurisdiction Present',
    question: 'Is there authority over this boundary?',
    hint: 'true or false',
    icon: 'ph-gavel',
    dimension: 'space',
    required: false
  },

  // Time Dimension
  temporal_mode: {
    label: 'Temporal Mode',
    question: 'Is this static, dynamic, or recursive?',
    hint: '-1 (static), +1 (dynamic), tau (recursive)',
    icon: 'ph-clock-clockwise',
    dimension: 'time',
    required: true
  },
  temporal_justification: {
    label: 'Temporal Justification',
    question: 'Why this temporal mode?',
    hint: 'e.g., import snapshot, live feed, versioned',
    icon: 'ph-note',
    dimension: 'time',
    required: false
  },
  fixation_timestamp: {
    label: 'Fixation Timestamp',
    question: 'When did this identity lock?',
    hint: 'Timestamp of ontological freezing',
    icon: 'ph-calendar-check',
    dimension: 'time',
    required: true
  },
  fixation_event: {
    label: 'Fixation Event',
    question: 'What event caused fixation?',
    hint: 'e.g., import completed, assertion made',
    icon: 'ph-lightning',
    dimension: 'time',
    required: false
  },
  validity_window: {
    label: 'Validity Window',
    question: 'How long should this be trusted?',
    hint: 'implicit, explicit duration, or unknown',
    icon: 'ph-hourglass',
    dimension: 'time',
    required: false
  },
  reassessment_required: {
    label: 'Reassessment Required',
    question: 'Does this need periodic review?',
    hint: 'true or false',
    icon: 'ph-recycle',
    dimension: 'time',
    required: false
  }
});

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create empty source provenance structure
 */
function createEmptySourceProvenance() {
  return {
    // Identity Dimension
    identity_kind: null,
    identity_scope: null,
    designation_operator: null,
    designation_mechanism: null,
    designation_time: null,
    asserting_agent: null,
    authority_class: null,

    // Space Dimension
    boundary_type: null,
    boundary_basis: null,
    container_id: null,
    container_stability: null,
    containment_level: null,
    jurisdiction_present: null,

    // Time Dimension
    temporal_mode: null,
    temporal_justification: null,
    fixation_timestamp: null,
    fixation_event: null,
    validity_window: null,
    reassessment_required: null
  };
}

/**
 * Create source provenance from import context
 *
 * Automatically populates provenance from import metadata.
 *
 * @param {Object} options Import context
 * @param {string} options.filename Original filename
 * @param {string} options.fileType File type (csv, json, xlsx, etc.)
 * @param {string} options.agent Agent performing import
 * @param {string} options.contentHash Content hash for identity
 * @returns {Object} Source provenance structure
 */
function createSourceProvenance(options = {}) {
  const now = new Date().toISOString();

  return {
    // Identity Dimension
    identity_kind: options.identityKind || IdentityKind.IMPORT,
    identity_scope: options.identityScope || IdentityScope.COMPOSITE,
    designation_operator: options.designationOperator || DesignationOperator.REC,
    designation_mechanism: options.mechanism || `${options.fileType || 'data'} import`,
    designation_time: options.designationTime || now,
    asserting_agent: options.agent || options.assertingAgent || null,
    authority_class: options.authorityClass || (options.agent ? AuthorityClass.HUMAN : AuthorityClass.PIPELINE),

    // Space Dimension
    boundary_type: options.boundaryType || BoundaryType.BOUNDED,
    boundary_basis: options.boundaryBasis || BoundaryBasis.FILE,
    container_id: options.containerId || options.filename || null,
    container_stability: options.containerStability || ContainerStability.IMMUTABLE,
    containment_level: options.containmentLevel || ContainmentLevel.ROOT,
    jurisdiction_present: options.jurisdictionPresent ?? false,

    // Time Dimension
    temporal_mode: options.temporalMode || TemporalMode.STATIC,
    temporal_justification: options.temporalJustification || 'import snapshot',
    fixation_timestamp: options.fixationTimestamp || now,
    fixation_event: options.fixationEvent || 'import completed',
    validity_window: options.validityWindow || 'implicit',
    reassessment_required: options.reassessmentRequired ?? false
  };
}

/**
 * Validate source provenance
 *
 * Checks that required fields are present and valid.
 *
 * @param {Object} provenance Source provenance to validate
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateSourceProvenance(provenance) {
  const errors = [];
  const warnings = [];

  if (!provenance) {
    return { valid: false, errors: ['Provenance object is required'], warnings: [] };
  }

  // Check required Identity fields
  if (!provenance.identity_kind) {
    errors.push('identity_kind is required - what type of thing is this?');
  }
  if (!provenance.identity_scope) {
    errors.push('identity_scope is required - is this atomic or composite?');
  }
  if (!provenance.designation_operator) {
    errors.push('designation_operator is required - how was identity stabilized?');
  }
  if (!provenance.designation_time) {
    errors.push('designation_time is required - when was identity stabilized?');
  }
  if (!provenance.asserting_agent) {
    warnings.push('asserting_agent is missing - identity is orphaned (exists but cannot be trusted)');
  }

  // Check required Space fields
  if (!provenance.boundary_type) {
    errors.push('boundary_type is required - is this bounded or unbounded?');
  }
  if (!provenance.container_id) {
    errors.push('container_id is required - where does this thing live?');
  }

  // Check required Time fields
  if (!provenance.temporal_mode) {
    errors.push('temporal_mode is required - is this static, dynamic, or recursive?');
  }
  if (!provenance.fixation_timestamp) {
    errors.push('fixation_timestamp is required - when did this identity lock?');
  }

  // Additional semantic validations
  if (provenance.temporal_mode === TemporalMode.DYNAMIC && !provenance.validity_window) {
    warnings.push('Dynamic temporal mode without validity_window - decay timeline unknown');
  }

  if (!provenance.jurisdiction_present && provenance.boundary_basis === BoundaryBasis.JURISDICTION) {
    warnings.push('Jurisdiction boundary basis but jurisdiction_present is false - inconsistent');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get provenance completeness status
 *
 * @param {Object} provenance Source provenance
 * @returns {'full' | 'partial' | 'none' | 'invalid'} Completeness status
 */
function getSourceProvenanceStatus(provenance) {
  if (!provenance) return 'none';

  const validation = validateSourceProvenance(provenance);
  if (!validation.valid) return 'invalid';

  // Count filled optional fields
  const optionalFields = [
    'designation_mechanism',
    'authority_class',
    'boundary_basis',
    'container_stability',
    'containment_level',
    'jurisdiction_present',
    'temporal_justification',
    'fixation_event',
    'validity_window',
    'reassessment_required'
  ];

  const filledOptional = optionalFields.filter(f =>
    provenance[f] !== null && provenance[f] !== undefined
  ).length;

  if (filledOptional === optionalFields.length) return 'full';
  return 'partial';
}

/**
 * Get dimension completeness
 *
 * @param {Object} provenance Source provenance
 * @param {string} dimension 'identity', 'space', or 'time'
 * @returns {Object} { filled: number, total: number, complete: boolean }
 */
function getDimensionCompleteness(provenance, dimension) {
  if (!provenance) return { filled: 0, total: 0, complete: false };

  const fields = SourceProvenanceDimensions[dimension.toUpperCase()] || [];
  const filled = fields.filter(f =>
    provenance[f] !== null && provenance[f] !== undefined
  ).length;

  return {
    filled,
    total: fields.length,
    complete: filled === fields.length
  };
}

/**
 * Merge source provenance (child overrides parent)
 */
function mergeSourceProvenance(parent, child) {
  const result = createEmptySourceProvenance();

  for (const key of Object.keys(result)) {
    result[key] = child?.[key] ?? parent?.[key] ?? null;
  }

  return result;
}

/**
 * Format provenance value for display
 */
function formatSourceProvenanceValue(key, value) {
  if (value === null || value === undefined) {
    return { display: '', isSet: false };
  }

  // Format booleans
  if (typeof value === 'boolean') {
    return { display: value ? 'Yes' : 'No', isSet: true };
  }

  // Format timestamps
  if (key.includes('timestamp') || key.includes('time')) {
    try {
      const date = new Date(value);
      return {
        display: date.toLocaleString(),
        isSet: true
      };
    } catch {
      return { display: String(value), isSet: true };
    }
  }

  // Format phase-space values
  const phaseSpaceLabels = {
    '+1': 'Bounded (+1)',
    '-1': 'Unbounded (-1)',
    'sqrt2': 'Fractal (sqrt2)',
    'tau': 'Recursive (tau)'
  };

  if (phaseSpaceLabels[value]) {
    return { display: phaseSpaceLabels[value], isSet: true };
  }

  return { display: String(value), isSet: true };
}

/**
 * Get provenance indicator symbol
 */
function getSourceProvenanceIndicator(status) {
  switch (status) {
    case 'full': return '\u25C9';      // ◉
    case 'partial': return '\u25D0';    // ◐
    case 'invalid': return '\u25CE';    // ◎
    default: return '\u25CB';           // ○
  }
}

// ============================================================================
// Phase-Space Position Mapping
// ============================================================================

/**
 * Map source provenance to EO phase-space position
 *
 * Based on the 27-position phase space where each dimension
 * can be +1, -1, or neutral (sqrt2 / tau).
 *
 * @param {Object} provenance Source provenance
 * @returns {Object} Phase-space coordinates and position number
 */
function getPhaseSpacePosition(provenance) {
  if (!provenance) return null;

  // Map provenance values to phase-space coordinates
  const spaceCoord = provenance.boundary_type || '+1';
  const timeCoord = provenance.temporal_mode || '-1';

  // Identity doesn't map directly to a single coordinate
  // but we can derive it from scope
  let identityCoord = '+1'; // default: explicit entity
  if (provenance.identity_scope === IdentityScope.AGGREGATE) {
    identityCoord = '-1'; // aggregated/implicit
  } else if (provenance.identity_scope === IdentityScope.COMPOSITE) {
    identityCoord = 'sqrt2'; // composite/fractal
  }

  return {
    identity: identityCoord,
    space: spaceCoord,
    time: timeCoord,
    // Position number calculation would require the full 27-position mapping
    description: describePhasePosition(identityCoord, spaceCoord, timeCoord)
  };
}

/**
 * Describe phase-space position in human terms
 */
function describePhasePosition(identity, space, time) {
  const descriptions = {
    '+1,+1,-1': 'Explicit Entity (bounded, static)',
    '+1,+1,+1': 'Dynamic Entity (bounded, evolving)',
    '+1,-1,-1': 'Field Point (unbounded, static)',
    '-1,+1,-1': 'Aggregate Snapshot (bounded, static aggregate)',
    '+1,+1,tau': 'Self-Revising Entity (bounded, recursive)'
  };

  const key = `${identity},${space},${time}`;
  return descriptions[key] || `Position [${key}]`;
}

// ============================================================================
// CSS Styles for Source Provenance UI
// ============================================================================

const sourceProvenanceStyles = `
  /* Source Provenance Section */
  .source-provenance-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-primary, #e5e7eb);
  }

  .source-provenance-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .source-provenance-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-secondary, #6b7280);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .source-provenance-dimension {
    margin-bottom: 16px;
  }

  .source-provenance-dimension-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted, #9ca3af);
    margin-bottom: 8px;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .source-provenance-dimension-label .dimension-icon {
    font-size: 14px;
  }

  .dimension-identity .dimension-icon { color: var(--primary-500, #6366f1); }
  .dimension-space .dimension-icon { color: var(--success-500, #22c55e); }
  .dimension-time .dimension-icon { color: var(--warning-500, #f59e0b); }

  .source-provenance-element {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border-secondary, #f3f4f6);
  }

  .source-provenance-element:last-child {
    border-bottom: none;
  }

  .source-provenance-element-icon {
    color: var(--text-muted, #9ca3af);
    font-size: 14px;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .source-provenance-element-content {
    flex: 1;
    min-width: 0;
  }

  .source-provenance-element-label {
    font-size: 11px;
    color: var(--text-secondary, #6b7280);
    margin-bottom: 2px;
  }

  .source-provenance-element-value {
    font-size: 13px;
    color: var(--text-primary, #111827);
    word-break: break-word;
  }

  .source-provenance-element-value.empty {
    color: var(--text-muted, #9ca3af);
    font-style: italic;
  }

  .source-provenance-element-value.required-missing {
    color: var(--error-500, #ef4444);
    font-style: italic;
  }

  /* Phase-Space Position Badge */
  .phase-space-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--bg-tertiary, #f3f4f6);
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-secondary, #6b7280);
  }

  .phase-space-coord {
    font-family: monospace;
    font-weight: 600;
  }

  /* Validation Status */
  .source-provenance-validation {
    margin-top: 12px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
  }

  .source-provenance-validation.valid {
    background: var(--success-50, #f0fdf4);
    color: var(--success-700, #15803d);
    border: 1px solid var(--success-200, #bbf7d0);
  }

  .source-provenance-validation.invalid {
    background: var(--error-50, #fef2f2);
    color: var(--error-700, #b91c1c);
    border: 1px solid var(--error-200, #fecaca);
  }

  .source-provenance-validation.partial {
    background: var(--warning-50, #fffbeb);
    color: var(--warning-700, #a16207);
    border: 1px solid var(--warning-200, #fde68a);
  }

  /* Dimension Completeness Indicators */
  .dimension-completeness {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }

  .dimension-completeness-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--border-primary, #e5e7eb);
  }

  .dimension-completeness-dot.filled {
    background: currentColor;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const existingStyle = document.getElementById('eo-source-provenance-styles');
  if (!existingStyle) {
    const styleEl = document.createElement('style');
    styleEl.id = 'eo-source-provenance-styles';
    styleEl.textContent = sourceProvenanceStyles;
    document.head.appendChild(styleEl);
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Enums
    IdentityKind,
    IdentityScope,
    DesignationOperator,
    AuthorityClass,
    BoundaryType,
    BoundaryBasis,
    ContainerStability,
    ContainmentLevel,
    TemporalMode,

    // Schema
    SourceProvenanceElements,
    SourceProvenanceDimensions,
    SourceProvenanceLabels,

    // Factory functions
    createEmptySourceProvenance,
    createSourceProvenance,
    validateSourceProvenance,
    getSourceProvenanceStatus,
    getDimensionCompleteness,
    mergeSourceProvenance,
    formatSourceProvenanceValue,
    getSourceProvenanceIndicator,

    // Phase-space
    getPhaseSpacePosition,
    describePhasePosition
  };
}

if (typeof window !== 'undefined') {
  window.EOSourceProvenance = {
    // Enums
    IdentityKind,
    IdentityScope,
    DesignationOperator,
    AuthorityClass,
    BoundaryType,
    BoundaryBasis,
    ContainerStability,
    ContainmentLevel,
    TemporalMode,

    // Schema
    SourceProvenanceElements,
    SourceProvenanceDimensions,
    SourceProvenanceLabels,

    // Factory functions
    createEmptySourceProvenance,
    createSourceProvenance,
    validateSourceProvenance,
    getSourceProvenanceStatus,
    getDimensionCompleteness,
    mergeSourceProvenance,
    formatSourceProvenanceValue,
    getSourceProvenanceIndicator,

    // Phase-space
    getPhaseSpacePosition,
    describePhasePosition
  };
}
