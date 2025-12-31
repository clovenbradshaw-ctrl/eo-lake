/**
 * EO Nine Operators - The Canonical Vocabulary
 *
 * All actions in the app are encoded as compositions of these 9 operators.
 * Semantics: operator(target, context)
 *
 * THE 9 OPERATORS (these are the verbs - we don't rename them):
 *
 * | Operator | Symbol | What It Does                  | Epistemic Guarantee               |
 * |----------|--------|-------------------------------|-----------------------------------|
 * | INS      | ⊕      | Assert existence              | Once asserted, never erased       |
 * | DES      | ⊙      | Designate identity            | References are explicit           |
 * | SEG      | ⊘      | Scope visibility              | Hidden ≠ deleted                  |
 * | CON      | ⊗      | Connect entities              | Semantics live in the connection  |
 * | SYN      | ≡      | Synthesize identity           | Equivalence is pre-query          |
 * | ALT      | Δ      | Alternate world state         | Time is projection, not filtering |
 * | SUP      | ∥      | Superpose interpretations     | Disagreement preserved            |
 * | REC      | ←      | Record grounding              | Nothing floats; everything traceable |
 * | NUL      | ∅      | Assert meaningful absence     | Non-events are first-class        |
 *
 * DICTIONARY:
 * Technical operations from eo_operators.js map to these 9 canonical operators.
 * See TechnicalOperatorDictionary below.
 */

// ============================================================================
// The 9 Operators
// ============================================================================

const NINE_OPERATORS = Object.freeze({
  INS: 'INS',  // ⊕ Assert existence
  DES: 'DES',  // ⊙ Designate identity
  SEG: 'SEG',  // ⊘ Scope visibility
  CON: 'CON',  // ⊗ Connect entities
  SYN: 'SYN',  // ≡ Synthesize identity
  ALT: 'ALT',  // Δ Alternate (temporal/branching)
  SUP: 'SUP',  // ∥ Superpose interpretations
  REC: 'REC',  // ← Record grounding
  NUL: 'NUL'   // ∅ Assert meaningful absence
});

const OperatorSymbols = Object.freeze({
  INS: '⊕',
  DES: '⊙',
  SEG: '⊘',
  CON: '⊗',
  SYN: '≡',
  ALT: 'Δ',
  SUP: '∥',
  REC: '←',
  NUL: '∅'
});

const OperatorMetadata = Object.freeze({
  INS: {
    symbol: '⊕',
    name: 'Insert',
    verb: 'Assert existence',
    description: 'Something exists. A record, event, or entity is now part of the world.',
    guarantee: 'Once asserted, never erased',
    epistemicType: 'GIVEN',
    examples: [
      'Import CSV file',
      'Create new record',
      'Save a Set definition',
      'Manual data entry'
    ]
  },
  DES: {
    symbol: '⊙',
    name: 'Designate',
    verb: 'Designate identity',
    description: 'This thing has a name. This reference points to that entity.',
    guarantee: 'References are explicit, not accidental',
    epistemicType: 'MEANT',
    examples: [
      'Name a Set',
      'Rename a field',
      'Alias a column',
      'Assign entity ID'
    ]
  },
  SEG: {
    symbol: '⊘',
    name: 'Segment',
    verb: 'Scope visibility',
    description: 'Filter what is visible without claiming it does not exist.',
    guarantee: 'Hidden ≠ deleted; invisibility tracked',
    epistemicType: 'MEANT',
    examples: [
      'Add filter condition',
      'Create Focus',
      'Hide field from view',
      'Define scope boundary'
    ]
  },
  CON: {
    symbol: '⊗',
    name: 'Connect',
    verb: 'Connect entities',
    description: 'These two things are related. The relationship has meaning.',
    guarantee: 'Semantics live in the connection',
    epistemicType: 'MEANT',
    examples: [
      'Join two sources',
      'Link records',
      'Create relationship',
      'Associate entities'
    ]
  },
  SYN: {
    symbol: '≡',
    name: 'Synthesize',
    verb: 'Synthesize identity',
    description: 'These things that looked different are actually the same entity.',
    guarantee: 'Equivalence is pre-query, explicit',
    epistemicType: 'MEANT',
    examples: [
      'Entity resolution',
      'Deduplicate records',
      'Merge entities',
      'Confirm fuzzy match'
    ]
  },
  ALT: {
    symbol: 'Δ',
    name: 'Alternate',
    verb: 'Alternate world state',
    description: 'Reconstruct the world as it was known at a point in time. Not filtering - projection.',
    guarantee: 'Time is projection, not filtering. "What did we believe was true at time T?"',
    epistemicType: 'MEANT',
    semantics: {
      WORLD_STATE: 'Reconstruct knowledge as of time T (corrections after T invisible)',
      EVENT_TIME: 'Filter by when events happened, using current knowledge',
      DATA_VERSION: 'Pin to a specific import for reproducibility'
    },
    examples: [
      'AS_OF May 1 → world as understood then (late data invisible)',
      'Reproduce last month\'s report exactly',
      'See pre-correction values',
      'Pin to specific import version',
      'Dynamic NOW vs static snapshot'
    ],
    notTheSameAs: 'WHERE timestamp <= date (that\'s just filtering, not reconstruction)'
  },
  SUP: {
    symbol: '∥',
    name: 'Superpose',
    verb: 'Superpose interpretations',
    description: 'Multiple interpretations coexist. Disagreement is preserved.',
    guarantee: 'Disagreement preserved, not collapsed',
    epistemicType: 'MEANT',
    examples: [
      'Preserve conflicting values',
      'Mark uncertain match',
      'Frame-dependent truth',
      'Handle source disagreement'
    ]
  },
  REC: {
    symbol: '←',
    name: 'Record',
    verb: 'Record grounding',
    description: 'Every claim has a source. Nothing floats. Provenance is traversable.',
    guarantee: 'Everything traceable to origin',
    epistemicType: 'IMPLICIT', // Invoked by every other operator
    examples: [
      'Track provenance chain',
      'Log operator application',
      'Attribute to source',
      'Record decision context'
    ]
  },
  NUL: {
    symbol: '∅',
    name: 'Nullify',
    verb: 'Assert meaningful absence',
    description: 'Something expected did not happen. Absence is a first-class finding.',
    guarantee: 'Non-events are first-class objects',
    epistemicType: 'DERIVED',
    examples: [
      'Expected record missing',
      'Define expectation rule',
      'Flag violated constraint',
      'Tombstone/soft delete'
    ]
  }
});

// ============================================================================
// Technical Operator Dictionary
// ============================================================================

/**
 * Maps technical operators (from eo_operators.js) to the 9 canonical operators.
 *
 * The 9 operators are THE vocabulary. Technical terms are just citations.
 * When you see 'filter' in code, it means SEG.
 * When you see 'join' in code, it means CON.
 */
const TechnicalOperatorDictionary = Object.freeze({
  // ─────────────────────────────────────────────────────────────────────────
  // ENTRY class → INS
  // ─────────────────────────────────────────────────────────────────────────
  'source_given': { canonical: 'INS', note: 'Assert existence from external reality' },
  'source_derived': { canonical: 'INS', note: 'Assert existence from EO sets' },

  // ─────────────────────────────────────────────────────────────────────────
  // RESTRICTIVE class → SEG
  // ─────────────────────────────────────────────────────────────────────────
  'filter': { canonical: 'SEG', note: 'Scope visibility by predicate' },
  'select': { canonical: 'SEG', note: 'Scope visibility by fields' },
  'limit': { canonical: 'SEG', note: 'Scope visibility by count' },

  // ─────────────────────────────────────────────────────────────────────────
  // SHAPE class → DES (mostly) or ALT
  // ─────────────────────────────────────────────────────────────────────────
  'map': { canonical: 'ALT', note: 'Transform/alternate values' },
  'rename': { canonical: 'DES', note: 'Re-designate identity' },
  'flatten': { canonical: 'ALT', note: 'Alternate structure' },

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTE class → INS (derived values) + REC
  // Compute creates new values, which is INS with DERIVED epistemic type
  // ─────────────────────────────────────────────────────────────────────────
  'aggregate': { canonical: 'INS', note: 'Assert derived value (SUM, COUNT, etc.)', epistemicType: 'DERIVED' },
  'compute': { canonical: 'INS', note: 'Assert computed value', epistemicType: 'DERIVED' },

  // ─────────────────────────────────────────────────────────────────────────
  // RELATIONAL class → CON
  // ─────────────────────────────────────────────────────────────────────────
  'join': { canonical: 'CON', note: 'Connect sets by condition' },
  'link': { canonical: 'CON', note: 'Connect records by relationship' },

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPORAL class → ALT
  // ─────────────────────────────────────────────────────────────────────────
  'asof': { canonical: 'ALT', note: 'Alternate to world-state at time T' },
  'between': { canonical: 'ALT', note: 'Alternate to event-time range' },

  // ─────────────────────────────────────────────────────────────────────────
  // PROVENANCE class → REC
  // ─────────────────────────────────────────────────────────────────────────
  'trace': { canonical: 'REC', note: 'Record provenance chain' },
  'root': { canonical: 'REC', note: 'Record origin' },
  'supersedes': { canonical: 'NUL', note: 'Assert absence of prior (tombstone)' },

  // ─────────────────────────────────────────────────────────────────────────
  // GHOST class → NUL/INS/CON
  // Ghost data operations - deleted entities that continue to influence
  // ─────────────────────────────────────────────────────────────────────────
  'ghost': { canonical: 'NUL', note: 'Soft delete - entity becomes ghost' },
  'tombstone': { canonical: 'NUL', note: 'Mark entity as deleted (ghost)' },
  'resurrect': { canonical: 'INS', note: 'Restore ghost to active entity' },
  'haunt': { canonical: 'CON', note: 'Ghost influences active entity' },
  'resolve_haunt': { canonical: 'NUL', note: 'Clear ghost influence' },
  'detect_haunt': { canonical: 'REC', note: 'Record ghost reference detection' },

  // ─────────────────────────────────────────────────────────────────────────
  // EPISTEMIC class → SUP
  // ─────────────────────────────────────────────────────────────────────────
  'assess_confidence': { canonical: 'SUP', note: 'Superpose confidence levels' }
});

/**
 * Translate a technical operator to its canonical 9-operator form
 */
function toCanonical(technicalOp) {
  const entry = TechnicalOperatorDictionary[technicalOp];
  return entry ? entry.canonical : null;
}

/**
 * Get all technical operators that map to a canonical operator
 */
function getTechnicalOps(canonicalOp) {
  const results = [];
  for (const [tech, entry] of Object.entries(TechnicalOperatorDictionary)) {
    if (entry.canonical === canonicalOp) {
      results.push({ technical: tech, ...entry });
    }
  }
  return results;
}

/**
 * UI Action Dictionary
 *
 * Maps user-facing action names to canonical operators.
 * These are the verbs users see in the UI.
 */
const UIActionDictionary = Object.freeze({
  // Data entry
  'Import': 'INS',
  'Create': 'INS',
  'Add': 'INS',
  'Insert': 'INS',

  // Identity
  'Name': 'DES',
  'Rename': 'DES',
  'Alias': 'DES',
  'Label': 'DES',

  // Visibility
  'Filter': 'SEG',
  'Focus': 'SEG',
  'Hide': 'SEG',
  'Show': 'SEG',
  'Scope': 'SEG',

  // Connection
  'Join': 'CON',
  'Link': 'CON',
  'Connect': 'CON',
  'Relate': 'CON',

  // Identity synthesis
  'Merge': 'SYN',
  'Deduplicate': 'SYN',
  'Resolve': 'SYN',
  'Match': 'SYN',

  // Alternation
  'Edit': 'ALT',
  'Update': 'ALT',
  'Change': 'ALT',
  'Modify': 'ALT',
  'Switch': 'ALT',
  'Toggle': 'ALT',
  'Version': 'ALT',
  'AsOf': 'ALT',

  // Superposition
  'Compare': 'SUP',
  'Preserve': 'SUP',
  'Uncertain': 'SUP',
  'Maybe': 'SUP',

  // Grounding
  'Trace': 'REC',
  'Provenance': 'REC',
  'Source': 'REC',
  'Attribute': 'REC',

  // Absence
  'Delete': 'NUL',
  'Remove': 'NUL',
  'Toss': 'NUL',
  'Expect': 'NUL',
  'Ghost': 'NUL',         // Soft delete - entity becomes ghost

  // Ghost operations
  'Resurrect': 'INS',     // Restore ghost to active entity
  'Haunt': 'CON',         // Ghost influences active entity
  'Resolve Haunt': 'NUL', // Clear ghost influence
  'Missing': 'NUL'
});

/**
 * Get the canonical operator for a UI action verb
 */
function fromUIAction(actionVerb) {
  // Try exact match first
  if (UIActionDictionary[actionVerb]) {
    return UIActionDictionary[actionVerb];
  }
  // Try case-insensitive
  const normalized = actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1).toLowerCase();
  return UIActionDictionary[normalized] || null;
}

// ============================================================================
// Operator Invocation - Compact Format
// ============================================================================

/**
 * Generate unique activity ID
 */
function generateActivityId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `act_${timestamp}_${random}`;
}

/**
 * Create an operator invocation in COMPACT format
 * Semantics: operator(target, actor, options)
 *
 * Returns a compact activity record compatible with eo_activity.js
 *
 * @param {string} op - One of the 9 operators
 * @param {Object} target - What is being operated on
 * @param {Object} context - Context with agent, method, source, etc.
 * @returns {Object} Compact activity record
 */
function invoke(op, target, context = {}) {
  if (!NINE_OPERATORS[op]) {
    throw new Error(`Invalid operator: ${op}. Must be one of: ${Object.keys(NINE_OPERATORS).join(', ')}`);
  }

  // Extract actor from context (must use epistemic.agent)
  const actor = context.epistemic?.agent || 'unknown';

  // Build compact activity
  const activity = {
    id: generateActivityId(),
    ts: Date.now(),
    op,
    actor,
    target: normalizeTargetId(target)
  };

  // Optional fields - only include if present
  const field = target?.field || target?.fieldId;
  if (field) activity.field = field;

  // Delta for changes
  if (target?.previousValue !== undefined || target?.newValue !== undefined) {
    activity.delta = [target.previousValue, target.newValue];
  }

  // Method and source from context (must use epistemic.*)
  const method = context.epistemic?.method;
  if (method) activity.method = method;

  const source = context.epistemic?.source;
  if (source) activity.source = source;

  // Additional data (for complex targets)
  const dataFields = ['value', 'relatedTo', 'scope', 'conditions', 'joinType',
                      'conflictPolicy', 'confidence', 'interpretations', 'reason'];
  const data = {};
  for (const f of dataFields) {
    if (target?.[f] !== undefined) data[f] = target[f];
  }
  if (Object.keys(data).length > 0) activity.data = data;

  return activity;
}

/**
 * Normalize target to ID string
 */
function normalizeTargetId(target) {
  if (!target) return null;
  if (typeof target === 'string') return target;
  return target.id || target.entityId || null;
}

/**
 * Normalize target to standard form
 */
function normalizeTarget(target) {
  if (!target) return { type: 'unknown' };
  if (typeof target === 'string') return { type: 'entity', id: target };

  return {
    type: target.type || target.positionType || 'entity',
    id: target.id || target.entityId || null,
    fieldId: target.fieldId || target.field || null,
    value: target.value,
    previousValue: target.previousValue,
    newValue: target.newValue,
    relatedTo: target.relatedTo || target.targetId || null,
    scope: target.scope || null,
    ...target // Preserve any additional properties
  };
}

/**
 * Normalize context to 9-element form
 */
function normalizeContext(context) {
  if (!context) return createEmptyContext();

  return {
    epistemic: {
      agent: context.epistemic?.agent || null,
      method: context.epistemic?.method || null,
      source: context.epistemic?.source || null
    },
    semantic: {
      term: context.semantic?.term || null,
      definition: context.semantic?.definition || null,
      jurisdiction: context.semantic?.jurisdiction || null
    },
    situational: {
      scale: context.situational?.scale || null,
      timeframe: context.situational?.timeframe || null,
      background: context.situational?.background || null
    }
  };
}

function createEmptyContext() {
  return {
    epistemic: { agent: null, method: null, source: null },
    semantic: { term: null, definition: null, jurisdiction: null },
    situational: { scale: null, timeframe: null, background: null }
  };
}

// ============================================================================
// Action → Operator Mapping
// ============================================================================

/**
 * Maps all app actions to their 9-operator encoding
 *
 * Every UI action produces one or more operator invocations.
 * This is the canonical mapping.
 */
const ActionOperatorMapping = Object.freeze({

  // ─────────────────────────────────────────────────────────────────────────
  // DATA IMPORT ACTIONS → INS + DES + REC
  // ─────────────────────────────────────────────────────────────────────────

  'import_csv': {
    operators: ['INS', 'DES'],
    encode: (action) => [
      invoke('INS', {
        type: 'source',
        id: action.sourceId,
        value: { rows: action.rowCount, schema: action.schema }
      }, {
        agent: action.userId,
        method: 'file_import',
        source: action.filename
      }),
      invoke('DES', {
        type: 'source',
        id: action.sourceId,
        newValue: action.sourceName
      }, {
        agent: action.userId,
        method: 'user_designation'
      })
    ],
    description: 'Import CSV file as immutable source'
  },

  'import_json': {
    operators: ['INS', 'DES'],
    encode: (action) => [
      invoke('INS', {
        type: 'source',
        id: action.sourceId,
        value: { structure: action.structure, records: action.recordCount }
      }, {
        agent: action.userId,
        method: 'file_import',
        source: action.filename
      }),
      invoke('DES', {
        type: 'source',
        id: action.sourceId,
        newValue: action.sourceName
      }, {
        agent: action.userId,
        method: 'user_designation'
      })
    ],
    description: 'Import JSON file as immutable source'
  },

  'import_excel': {
    operators: ['INS', 'DES'],
    encode: (action) => {
      const ops = [];
      // Each sheet becomes a source
      for (const sheet of action.sheets) {
        ops.push(invoke('INS', {
          type: 'source',
          id: sheet.sourceId,
          value: { sheetName: sheet.name, rows: sheet.rowCount }
        }, {
          agent: action.userId,
          method: 'excel_import',
          source: action.filename
        }));
        ops.push(invoke('DES', {
          type: 'source',
          id: sheet.sourceId,
          newValue: sheet.sourceName
        }, {
          agent: action.userId,
          method: 'user_designation'
        }));
      }
      return ops;
    },
    description: 'Import Excel file (multi-sheet) as immutable sources'
  },

  'import_ics': {
    operators: ['INS', 'DES'],
    encode: (action) => [
      invoke('INS', {
        type: 'source',
        id: action.sourceId,
        value: { events: action.eventCount, calendar: action.calendarName }
      }, {
        agent: action.userId,
        method: 'ics_import',
        source: action.filename
      }),
      invoke('DES', {
        type: 'source',
        id: action.sourceId,
        newValue: action.sourceName
      }, {
        agent: action.userId,
        method: 'user_designation'
      })
    ],
    description: 'Import iCalendar file as immutable source'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SET MANAGEMENT ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  'create_set': {
    operators: ['INS', 'DES'],
    encode: (action) => [
      invoke('INS', {
        type: 'set',
        id: action.setId,
        value: { schema: action.schema }
      }, {
        agent: action.userId,
        method: 'set_creation',
        term: 'set_definition'
      }),
      invoke('DES', {
        type: 'set',
        id: action.setId,
        newValue: action.setName
      }, {
        agent: action.userId,
        method: 'user_designation'
      })
    ],
    description: 'Create a new Set with schema'
  },

  'create_set_from_source': {
    operators: ['INS', 'DES', 'CON'],
    encode: (action) => [
      invoke('INS', {
        type: 'set',
        id: action.setId,
        value: { derivedFrom: action.sourceId }
      }, {
        agent: action.userId,
        method: 'set_derivation',
        source: action.sourceId
      }),
      invoke('CON', {
        type: 'derivation_link',
        id: action.setId,
        relatedTo: action.sourceId,
        value: { relationship: 'DERIVED_FROM' }
      }, {
        agent: action.userId,
        method: 'derivation_connection'
      }),
      invoke('DES', {
        type: 'set',
        id: action.setId,
        newValue: action.setName
      }, {
        agent: action.userId,
        method: 'user_designation'
      })
    ],
    description: 'Create Set derived from a source'
  },

  'rename_set': {
    operators: ['DES'],
    encode: (action) => [
      invoke('DES', {
        type: 'set',
        id: action.setId,
        previousValue: action.oldName,
        newValue: action.newName
      }, {
        agent: action.userId,
        method: 'user_designation',
        term: 'rename'
      })
    ],
    description: 'Rename a Set'
  },

  'delete_set': {
    operators: ['NUL'],
    encode: (action) => [
      invoke('NUL', {
        type: 'set',
        id: action.setId,
        value: { reason: action.reason || 'user_deletion' }
      }, {
        agent: action.userId,
        method: 'tombstone',
        term: 'soft_delete'
      })
    ],
    description: 'Soft-delete a Set (tombstone)'
  },

  'toss_set': {
    operators: ['SEG', 'NUL'],
    encode: (action) => [
      invoke('SEG', {
        type: 'set',
        id: action.setId,
        value: { visibility: 'TOSSED', scope: 'tossed_area' }
      }, {
        agent: action.userId,
        method: 'visibility_change'
      }),
      invoke('NUL', {
        type: 'set_visibility',
        id: action.setId,
        value: { expectedIn: 'active_sets', foundIn: 'tossed_area' }
      }, {
        agent: action.userId,
        method: 'toss_operation'
      })
    ],
    description: 'Toss Set to trash (recoverable)'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // RECORD ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  'create_record': {
    operators: ['INS'],
    encode: (action) => [
      invoke('INS', {
        type: 'record',
        id: action.recordId,
        value: action.values,
        scope: action.setId
      }, {
        agent: action.userId,
        method: action.method || 'manual_entry',
        source: action.source || 'user_input'
      })
    ],
    description: 'Create a new record'
  },

  'update_record': {
    operators: ['ALT'],
    encode: (action) => [
      invoke('ALT', {
        type: 'record',
        id: action.recordId,
        field: action.fieldId,
        previousValue: action.oldValue,
        newValue: action.newValue
      }, {
        agent: action.userId,
        method: 'field_update',
        term: 'value_change'
      })
    ],
    description: 'Update a record field value'
  },

  'update_field': {
    operators: ['ALT'],
    encode: (action) => [
      invoke('ALT', {
        type: 'field',
        id: action.recordId,
        field: action.fieldId,
        previousValue: action.oldValue,
        newValue: action.newValue
      }, {
        agent: action.userId,
        method: 'inline_edit'
      })
    ],
    description: 'Update a field value (inline edit)'
  },

  'delete_record': {
    operators: ['NUL'],
    encode: (action) => [
      invoke('NUL', {
        type: 'record',
        id: action.recordId,
        scope: action.setId,
        value: { reason: action.reason || 'user_deletion' }
      }, {
        agent: action.userId,
        method: 'tombstone'
      })
    ],
    description: 'Delete a record (tombstone)'
  },

  'duplicate_record': {
    operators: ['INS', 'CON'],
    encode: (action) => [
      invoke('INS', {
        type: 'record',
        id: action.newRecordId,
        value: action.values,
        scope: action.setId
      }, {
        agent: action.userId,
        method: 'duplication',
        source: action.sourceRecordId
      }),
      invoke('CON', {
        type: 'duplication_link',
        id: action.newRecordId,
        relatedTo: action.sourceRecordId,
        value: { relationship: 'DUPLICATED_FROM' }
      }, {
        agent: action.userId,
        method: 'duplication_connection'
      })
    ],
    description: 'Duplicate a record'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FIELD/SCHEMA ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  'add_field': {
    operators: ['INS', 'DES'],
    encode: (action) => [
      invoke('INS', {
        type: 'field',
        id: action.fieldId,
        scope: action.setId,
        value: { type: action.fieldType, config: action.config }
      }, {
        agent: action.userId,
        method: 'schema_modification'
      }),
      invoke('DES', {
        type: 'field',
        id: action.fieldId,
        newValue: action.fieldName
      }, {
        agent: action.userId,
        method: 'user_designation'
      })
    ],
    description: 'Add a new field to schema'
  },

  'rename_field': {
    operators: ['DES'],
    encode: (action) => [
      invoke('DES', {
        type: 'field',
        id: action.fieldId,
        scope: action.setId,
        previousValue: action.oldName,
        newValue: action.newName
      }, {
        agent: action.userId,
        method: 'user_designation',
        term: 'field_alias'
      })
    ],
    description: 'Rename a field'
  },

  'delete_field': {
    operators: ['NUL'],
    encode: (action) => [
      invoke('NUL', {
        type: 'field',
        id: action.fieldId,
        scope: action.setId
      }, {
        agent: action.userId,
        method: 'schema_modification'
      })
    ],
    description: 'Delete a field from schema'
  },

  'change_field_type': {
    operators: ['ALT'],
    encode: (action) => [
      invoke('ALT', {
        type: 'field_schema',
        id: action.fieldId,
        scope: action.setId,
        previousValue: { type: action.oldType },
        newValue: { type: action.newType }
      }, {
        agent: action.userId,
        method: 'schema_modification',
        term: 'type_change'
      })
    ],
    description: 'Change field type'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  'create_view': {
    operators: ['INS', 'DES', 'SEG'],
    encode: (action) => [
      invoke('INS', {
        type: 'view',
        id: action.viewId,
        scope: action.setId,
        value: { viewType: action.viewType, config: action.config }
      }, {
        agent: action.userId,
        method: 'view_creation'
      }),
      invoke('DES', {
        type: 'view',
        id: action.viewId,
        newValue: action.viewName
      }, {
        agent: action.userId,
        method: 'user_designation'
      }),
      // Views always have an implicit SEG (visibility scope)
      invoke('SEG', {
        type: 'view_scope',
        id: action.viewId,
        value: {
          hiddenFields: action.config?.hiddenFields || [],
          filters: action.config?.filters || []
        }
      }, {
        agent: action.userId,
        method: 'view_configuration'
      })
    ],
    description: 'Create a new view'
  },

  'switch_view': {
    operators: ['ALT'],
    encode: (action) => [
      invoke('ALT', {
        type: 'active_view',
        scope: action.setId,
        previousValue: action.previousViewId,
        newValue: action.viewId
      }, {
        agent: action.userId,
        method: 'view_navigation'
      })
    ],
    description: 'Switch to a different view'
  },

  'configure_view': {
    operators: ['ALT', 'SEG'],
    encode: (action) => {
      const ops = [];
      if (action.hiddenFields) {
        ops.push(invoke('SEG', {
          type: 'view_visibility',
          id: action.viewId,
          value: { hiddenFields: action.hiddenFields }
        }, {
          agent: action.userId,
          method: 'view_configuration'
        }));
      }
      if (action.config) {
        ops.push(invoke('ALT', {
          type: 'view_config',
          id: action.viewId,
          previousValue: action.previousConfig,
          newValue: action.config
        }, {
          agent: action.userId,
          method: 'view_configuration'
        }));
      }
      return ops;
    },
    description: 'Configure view settings'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FILTER/FOCUS ACTIONS → SEG
  // ─────────────────────────────────────────────────────────────────────────

  'apply_filter': {
    operators: ['SEG'],
    encode: (action) => [
      invoke('SEG', {
        type: 'filter',
        scope: action.viewId || action.setId,
        value: {
          predicate: action.predicate,
          conditions: action.conditions,
          visibilityType: 'VISIBLE' // Hidden records still exist
        }
      }, {
        agent: action.userId,
        method: 'filter_application',
        term: 'restrictive_filter'
      })
    ],
    description: 'Apply filter conditions'
  },

  'create_focus': {
    operators: ['INS', 'DES', 'SEG'],
    encode: (action) => [
      invoke('INS', {
        type: 'focus',
        id: action.focusId,
        scope: action.setId
      }, {
        agent: action.userId,
        method: 'focus_creation'
      }),
      invoke('DES', {
        type: 'focus',
        id: action.focusId,
        newValue: action.focusName
      }, {
        agent: action.userId,
        method: 'user_designation'
      }),
      invoke('SEG', {
        type: 'focus_scope',
        id: action.focusId,
        value: {
          conditions: action.conditions,
          visibilityType: 'VISIBLE'
        }
      }, {
        agent: action.userId,
        method: 'focus_definition',
        term: 'restrictive_only' // Focuses can only restrict, never expand
      })
    ],
    description: 'Create a Focus (restrictive filter)'
  },

  'clear_filters': {
    operators: ['ALT'],
    encode: (action) => [
      invoke('ALT', {
        type: 'filter_state',
        scope: action.viewId || action.setId,
        previousValue: action.previousFilters,
        newValue: null
      }, {
        agent: action.userId,
        method: 'filter_clear'
      })
    ],
    description: 'Clear all filters'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SORT/GROUP ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  'apply_sort': {
    operators: ['ALT'],
    encode: (action) => [
      invoke('ALT', {
        type: 'sort_order',
        scope: action.viewId,
        previousValue: action.previousSort,
        newValue: action.sorts
      }, {
        agent: action.userId,
        method: 'sort_application'
      })
    ],
    description: 'Apply sort order'
  },

  'apply_group': {
    operators: ['ALT'],
    encode: (action) => [
      invoke('ALT', {
        type: 'grouping',
        scope: action.viewId,
        previousValue: action.previousGroup,
        newValue: action.groupBy
      }, {
        agent: action.userId,
        method: 'group_application'
      })
    ],
    description: 'Apply grouping'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // JOIN ACTIONS → CON
  // ─────────────────────────────────────────────────────────────────────────

  'join_sources': {
    operators: ['INS', 'DES', 'CON'],
    encode: (action) => [
      invoke('INS', {
        type: 'joined_set',
        id: action.resultSetId,
        value: {
          leftSource: action.leftSourceId,
          rightSource: action.rightSourceId,
          joinType: action.joinType
        }
      }, {
        agent: action.userId,
        method: 'join_creation'
      }),
      invoke('CON', {
        type: 'join',
        id: action.resultSetId,
        relatedTo: [action.leftSourceId, action.rightSourceId],
        value: {
          joinType: action.joinType,
          conditions: action.conditions,
          conflictPolicy: action.conflictPolicy // REQUIRED
        }
      }, {
        agent: action.userId,
        method: 'join_specification',
        term: 'relational_connection'
      }),
      invoke('DES', {
        type: 'set',
        id: action.resultSetId,
        newValue: action.resultSetName
      }, {
        agent: action.userId,
        method: 'user_designation'
      })
    ],
    description: 'Join two sources/sets'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LINK ACTIONS → CON
  // ─────────────────────────────────────────────────────────────────────────

  'link_records': {
    operators: ['CON'],
    encode: (action) => [
      invoke('CON', {
        type: 'record_link',
        id: action.sourceRecordId,
        relatedTo: action.targetRecordId,
        field: action.linkFieldId,
        value: { linkType: action.linkType }
      }, {
        agent: action.userId,
        method: 'link_creation',
        term: 'relationship'
      })
    ],
    description: 'Link two records'
  },

  'unlink_records': {
    operators: ['NUL'],
    encode: (action) => [
      invoke('NUL', {
        type: 'record_link',
        id: action.sourceRecordId,
        relatedTo: action.targetRecordId,
        value: { reason: 'user_unlink' }
      }, {
        agent: action.userId,
        method: 'link_removal'
      })
    ],
    description: 'Unlink two records'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ENTITY RESOLUTION ACTIONS → SYN
  // ─────────────────────────────────────────────────────────────────────────

  'resolve_entities': {
    operators: ['SYN'],
    encode: (action) => [
      invoke('SYN', {
        type: 'entity_resolution',
        id: action.canonicalId,
        value: {
          left: action.leftEntity,
          right: action.rightEntity,
          confidence: action.confidence,
          method: action.matchMethod
        }
      }, {
        agent: action.userId,
        method: action.matchMethod,
        term: 'same_entity'
      })
    ],
    description: 'Resolve two entities as the same'
  },

  'mark_duplicate': {
    operators: ['SYN', 'NUL'],
    encode: (action) => [
      invoke('SYN', {
        type: 'duplicate',
        id: action.canonicalId,
        value: {
          duplicateId: action.duplicateId,
          reason: action.reason
        }
      }, {
        agent: action.userId,
        method: 'deduplication',
        term: 'duplicate'
      }),
      invoke('NUL', {
        type: 'record',
        id: action.duplicateId,
        value: { reason: 'marked_duplicate', canonicalId: action.canonicalId }
      }, {
        agent: action.userId,
        method: 'deduplication'
      })
    ],
    description: 'Mark record as duplicate'
  },

  'reject_match': {
    operators: ['SUP'],
    encode: (action) => [
      invoke('SUP', {
        type: 'match_rejection',
        value: {
          left: action.leftEntity,
          right: action.rightEntity,
          interpretations: [
            { id: 'same_entity', probability: 0 },
            { id: 'different_entities', probability: 1 }
          ],
          resolution: 'RESOLVED'
        }
      }, {
        agent: action.userId,
        method: 'match_rejection',
        term: 'different_entities'
      })
    ],
    description: 'Reject a proposed entity match'
  },

  'uncertain_match': {
    operators: ['SUP'],
    encode: (action) => [
      invoke('SUP', {
        type: 'match_uncertainty',
        value: {
          left: action.leftEntity,
          right: action.rightEntity,
          interpretations: [
            { id: 'same_entity', probability: action.sameProb || 0.5 },
            { id: 'different_entities', probability: action.diffProb || 0.5 }
          ],
          resolution: 'UNRESOLVED'
        }
      }, {
        agent: action.userId,
        method: 'match_uncertainty',
        term: 'uncertain'
      })
    ],
    description: 'Mark match as uncertain (superposition)'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPORAL ACTIONS → ALT (World Reconstruction, not filtering)
  // ─────────────────────────────────────────────────────────────────────────

  'set_temporal_context': {
    operators: ['ALT'],
    encode: (action) => [
      invoke('ALT', {
        type: 'temporal_context',
        scope: action.setId || action.viewId,
        value: {
          // Semantics matter:
          // WORLD_STATE: "What did we believe was true at time T?"
          //   - Corrections after T invisible
          //   - Imports after T invisible
          //   - SYN decisions after T don't apply
          // EVENT_TIME: "What happened during period P?"
          //   - Uses current knowledge about those events
          //   - Corrections ARE visible
          // DATA_VERSION: "Use exactly this import"
          //   - Pin to specific import for reproducibility
          semantics: action.semantics, // WORLD_STATE | EVENT_TIME | DATA_VERSION
          temporalType: action.temporalType, // AS_OF, BETWEEN, VERSION
          timestamp: action.timestamp,
          startTime: action.startTime,
          endTime: action.endTime,
          versionId: action.versionId,
          evaluation: action.evaluation || 'STATIC' // STATIC | DYNAMIC
        }
      }, {
        agent: action.userId,
        method: 'temporal_projection', // NOT filtering!
        timeframe: action.timestamp || `${action.startTime}/${action.endTime}`,
        term: action.semantics // e.g., 'WORLD_STATE'
      })
    ],
    description: 'Set temporal context - world reconstruction (AS_OF) or event range (BETWEEN) or version pin'
  },

  'create_version': {
    operators: ['INS', 'DES', 'ALT'],
    encode: (action) => [
      invoke('INS', {
        type: 'version',
        id: action.versionId,
        scope: action.setId,
        value: { baseVersion: action.baseVersionId }
      }, {
        agent: action.userId,
        method: 'version_creation'
      }),
      invoke('DES', {
        type: 'version',
        id: action.versionId,
        newValue: action.versionName
      }, {
        agent: action.userId,
        method: 'user_designation'
      }),
      invoke('ALT', {
        type: 'version_branch',
        id: action.versionId,
        previousValue: action.baseVersionId,
        newValue: action.versionId
      }, {
        agent: action.userId,
        method: 'version_branch',
        term: 'alternate_version'
      })
    ],
    description: 'Create a new version branch'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SUPERPOSITION ACTIONS → SUP
  // ─────────────────────────────────────────────────────────────────────────

  'preserve_conflict': {
    operators: ['SUP'],
    encode: (action) => [
      invoke('SUP', {
        type: 'value_conflict',
        id: action.fieldId,
        scope: action.recordId,
        value: {
          interpretations: action.values.map((v, i) => ({
            id: `interp_${i}`,
            source: v.source,
            value: v.value,
            frame: v.frame
          })),
          resolution: 'FRAME_DEPENDENT'
        }
      }, {
        agent: action.userId,
        method: 'conflict_preservation',
        term: 'superposition'
      })
    ],
    description: 'Preserve conflicting values as superposition'
  },

  'resolve_superposition': {
    operators: ['ALT'],
    encode: (action) => [
      invoke('ALT', {
        type: 'superposition_resolution',
        id: action.superpositionId,
        previousValue: action.interpretations,
        newValue: action.resolvedValue
      }, {
        agent: action.userId,
        method: 'superposition_resolution',
        term: 'collapse'
      })
    ],
    description: 'Resolve a superposition to single value'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORT ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  'export_data': {
    operators: ['INS', 'DES', 'ALT'],
    encode: (action) => [
      invoke('INS', {
        type: 'export',
        id: action.exportId,
        scope: action.setId,
        value: {
          format: action.format,
          recordCount: action.recordCount,
          timestamp: action.timestamp
        }
      }, {
        agent: action.userId,
        method: 'data_export'
      }),
      invoke('DES', {
        type: 'export',
        id: action.exportId,
        newValue: action.exportName
      }, {
        agent: action.userId,
        method: 'user_designation'
      }),
      // Export freezes the data at a point in time
      invoke('ALT', {
        type: 'frozen_state',
        id: action.exportId,
        value: {
          frozenAt: action.timestamp,
          sourceSetId: action.setId,
          operatorChain: action.operatorChain
        }
      }, {
        agent: action.userId,
        method: 'state_freeze',
        term: 'immutable_export'
      })
    ],
    description: 'Export data (creates immutable snapshot)'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PROVENANCE ACTIONS → REC (explicit)
  // ─────────────────────────────────────────────────────────────────────────

  'trace_provenance': {
    operators: ['REC'],
    encode: (action) => [
      invoke('REC', {
        type: 'provenance_trace',
        id: action.targetId,
        value: {
          chain: action.provenanceChain,
          depth: action.depth
        }
      }, {
        agent: action.userId,
        method: 'provenance_trace',
        term: 'lineage'
      })
    ],
    description: 'Trace provenance chain'
  },

  'annotate_provenance': {
    operators: ['REC'],
    encode: (action) => [
      invoke('REC', {
        type: 'provenance_annotation',
        id: action.targetId,
        value: {
          annotation: action.annotation,
          annotationType: action.annotationType
        }
      }, {
        agent: action.userId,
        method: 'provenance_annotation',
        term: 'grounding'
      })
    ],
    description: 'Add provenance annotation'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ABSENCE ACTIONS → NUL
  // ─────────────────────────────────────────────────────────────────────────

  'define_expectation': {
    operators: ['INS', 'NUL'],
    encode: (action) => [
      invoke('INS', {
        type: 'expectation_rule',
        id: action.ruleId,
        value: {
          subject: action.subject,
          expected: action.expected,
          timeConstraint: action.timeConstraint
        }
      }, {
        agent: action.userId,
        method: 'expectation_definition'
      }),
      invoke('NUL', {
        type: 'expectation',
        id: action.ruleId,
        value: {
          rule: action.expected,
          basis: action.basis // e.g., "Metro Court Rule 12.4"
        }
      }, {
        agent: action.userId,
        method: 'expectation_rule',
        jurisdiction: action.jurisdiction
      })
    ],
    description: 'Define what should exist (for absence detection)'
  },

  'assert_absence': {
    operators: ['NUL'],
    encode: (action) => [
      invoke('NUL', {
        type: 'absence_assertion',
        id: action.subjectId,
        value: {
          expectationRef: action.expectationRuleId,
          expectedBy: action.expectedBy,
          searchedSource: action.searchedSource,
          searchResult: 'NO_MATCH'
        }
      }, {
        agent: action.userId || 'system',
        method: 'absence_evaluation',
        timeframe: action.evaluatedAt
      })
    ],
    description: 'Assert that expected thing is absent'
  }
});

// ============================================================================
// Operator Encoder
// ============================================================================

/**
 * Encode an action as operator invocations
 *
 * @param {string} actionType - The type of action
 * @param {Object} actionParams - Parameters for the action
 * @returns {Object[]} Array of operator invocations
 */
function encodeAction(actionType, actionParams) {
  const mapping = ActionOperatorMapping[actionType];
  if (!mapping) {
    console.warn(`Unknown action type: ${actionType}`);
    return [];
  }

  try {
    return mapping.encode(actionParams);
  } catch (e) {
    console.error(`Failed to encode action ${actionType}:`, e);
    return [];
  }
}

/**
 * Get the operators used by an action type
 */
function getOperatorsForAction(actionType) {
  const mapping = ActionOperatorMapping[actionType];
  return mapping ? mapping.operators : [];
}

/**
 * Get all action types that use a specific operator
 */
function getActionsForOperator(operator) {
  const actions = [];
  for (const [actionType, mapping] of Object.entries(ActionOperatorMapping)) {
    if (mapping.operators.includes(operator)) {
      actions.push({ actionType, ...mapping });
    }
  }
  return actions;
}

/**
 * Validate an operator chain (Set definition)
 */
function validateOperatorChain(chain) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(chain) || chain.length === 0) {
    errors.push('Operator chain must be non-empty');
    return { valid: false, errors, warnings };
  }

  // Must start with INS (data entry)
  if (chain[0].operator !== 'INS') {
    errors.push('Chain must start with INS (assert existence)');
  }

  // Must end with DES (naming)
  if (chain[chain.length - 1].operator !== 'DES') {
    warnings.push('Chain should end with DES (designate identity)');
  }

  // Must include ALT (temporal context)
  const hasALT = chain.some(op => op.operator === 'ALT');
  if (!hasALT) {
    warnings.push('Chain should include ALT (temporal context)');
  }

  // CON requires conflict policy
  for (const op of chain) {
    if (op.operator === 'CON') {
      if (!op.target?.value?.conflictPolicy) {
        errors.push('CON operator requires explicit conflict_policy');
      }
    }
    if (op.operator === 'NUL') {
      if (!op.target?.value?.expectationRef && op.target?.type !== 'tombstone') {
        warnings.push('NUL operator should have expectation reference');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================================================
// Display Utilities
// ============================================================================

/**
 * Format operator for display
 */
function formatOperator(operator) {
  const meta = OperatorMetadata[operator];
  if (!meta) return operator;
  return `${meta.symbol} ${meta.name}`;
}

/**
 * Format operator chain for display
 */
function formatOperatorChain(chain) {
  return chain.map(op => {
    const operator = typeof op === 'string' ? op : op.operator;
    const meta = OperatorMetadata[operator];
    return meta ? meta.symbol : operator;
  }).join(' → ');
}

/**
 * Render operator badge HTML
 */
function renderOperatorBadge(operator, options = {}) {
  const meta = OperatorMetadata[operator];
  if (!meta) {
    return `<span class="op-badge op-unknown">${operator}</span>`;
  }

  const showName = options.showName !== false;
  const showSymbol = options.showSymbol !== false;

  const parts = [];
  if (showSymbol) parts.push(`<span class="op-symbol">${meta.symbol}</span>`);
  if (showName) parts.push(`<span class="op-name">${meta.name}</span>`);

  return `<span class="op-badge op-${operator.toLowerCase()}" title="${meta.description}">${parts.join('')}</span>`;
}

// ============================================================================
// Styles
// ============================================================================

const nineOperatorStyles = `
  .op-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .op-symbol { font-size: 14px; font-weight: 600; }
  .op-name { font-size: 11px; }

  .op-ins { background: rgba(34, 197, 94, 0.1); color: #16a34a; border: 1px solid rgba(34, 197, 94, 0.3); }
  .op-des { background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.3); }
  .op-seg { background: rgba(168, 85, 247, 0.1); color: #7c3aed; border: 1px solid rgba(168, 85, 247, 0.3); }
  .op-con { background: rgba(236, 72, 153, 0.1); color: #db2777; border: 1px solid rgba(236, 72, 153, 0.3); }
  .op-syn { background: rgba(249, 115, 22, 0.1); color: #ea580c; border: 1px solid rgba(249, 115, 22, 0.3); }
  .op-alt { background: rgba(14, 165, 233, 0.1); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.3); }
  .op-sup { background: rgba(234, 179, 8, 0.1); color: #ca8a04; border: 1px solid rgba(234, 179, 8, 0.3); }
  .op-rec { background: rgba(156, 163, 175, 0.1); color: #6b7280; border: 1px solid rgba(156, 163, 175, 0.3); }
  .op-nul { background: rgba(239, 68, 68, 0.1); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3); }
  .op-unknown { background: rgba(156, 163, 175, 0.05); color: #9ca3af; border: 1px dashed rgba(156, 163, 175, 0.3); }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.id = 'eo-nine-operator-styles';
  styleEl.textContent = nineOperatorStyles;
  if (!document.getElementById('eo-nine-operator-styles')) {
    document.head.appendChild(styleEl);
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // The 9 canonical operators
    NINE_OPERATORS,
    OperatorSymbols,
    OperatorMetadata,

    // Dictionaries (technical terms → canonical operators)
    TechnicalOperatorDictionary,
    UIActionDictionary,
    toCanonical,
    getTechnicalOps,
    fromUIAction,

    // Invocation (compact format)
    invoke,
    normalizeTargetId,

    // Legacy (verbose format)
    normalizeTarget,
    normalizeContext,
    createEmptyContext,

    // Action encoding
    ActionOperatorMapping,
    encodeAction,
    getOperatorsForAction,
    getActionsForOperator,

    // Validation & display
    validateOperatorChain,
    formatOperator,
    formatOperatorChain,
    renderOperatorBadge
  };
}

if (typeof window !== 'undefined') {
  window.NineOperators = {
    // The 9 canonical operators (THE vocabulary)
    operators: NINE_OPERATORS,
    symbols: OperatorSymbols,
    metadata: OperatorMetadata,

    // Dictionaries (citations → canonical)
    dictionary: {
      technical: TechnicalOperatorDictionary,
      ui: UIActionDictionary,
      toCanonical,
      getTechnicalOps,
      fromUIAction
    },

    // Invocation (compact format)
    invoke,
    normalizeTargetId,

    // Legacy (verbose format) - for backward compat
    normalizeTarget,
    normalizeContext,
    emptyContext: createEmptyContext,

    // Action encoding (returns compact activities)
    actions: ActionOperatorMapping,
    encode: encodeAction,
    getOperatorsForAction,
    getActionsForOperator,

    // Validation & display
    validateChain: validateOperatorChain,
    format: formatOperator,
    formatChain: formatOperatorChain,
    renderBadge: renderOperatorBadge
  };
}
