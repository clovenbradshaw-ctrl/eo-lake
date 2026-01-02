/**
 * EO Restriction Messages - EO-Grounded "Can't Do That" Messages
 *
 * When the app refuses an action, these messages explain WHY in terms
 * of epistemic principles, without using EO jargon.
 *
 * PRINCIPLE: Teaching the ontology through friction.
 * Every "no" becomes an opportunity to explain the data model.
 */

// ============================================================================
// Restriction Types
// ============================================================================

const RestrictionType = Object.freeze({
  // Data immutability
  CANNOT_EDIT_GIVEN: 'cannot_edit_given',
  CANNOT_DELETE_RECORD: 'cannot_delete_record',
  CANNOT_MODIFY_HISTORY: 'cannot_modify_history',

  // Epistemic boundaries
  CANNOT_EDIT_IN_VIEW: 'cannot_edit_in_view',
  CANNOT_MIX_TYPES: 'cannot_mix_types',
  CANNOT_LOSE_PROVENANCE: 'cannot_lose_provenance',

  // Structural constraints
  CANNOT_BREAK_REFERENCE: 'cannot_break_reference',
  CANNOT_ORPHAN_RECORD: 'cannot_orphan_record',
  CANNOT_CIRCULAR_REFERENCE: 'cannot_circular_reference',

  // Conflict constraints
  CANNOT_RESOLVE_WITHOUT_CHOICE: 'cannot_resolve_without_choice',
  CANNOT_MERGE_INCOMPATIBLE: 'cannot_merge_incompatible',

  // Definition constraints
  CANNOT_AGGREGATE_MIXED_UNITS: 'cannot_aggregate_mixed_units',
  CANNOT_COMPARE_DIFFERENT_FRAMES: 'cannot_compare_different_frames',

  // Permission constraints
  CANNOT_MODIFY_LOCKED: 'cannot_modify_locked',
  CANNOT_ACCESS_ARCHIVED: 'cannot_access_archived'
});

// ============================================================================
// Restriction Messages
// ============================================================================

/**
 * Full restriction message definitions
 */
const RestrictionMessages = Object.freeze({
  // ─────────────────────────────────────────────────────────────────────────
  // Data Immutability
  // ─────────────────────────────────────────────────────────────────────────

  [RestrictionType.CANNOT_EDIT_GIVEN]: {
    title: 'This is recorded fact',
    message: 'This data represents what was received from an external source. It cannot be modified here.',
    explanation: 'The original record is preserved exactly as it was imported. This ensures you can always trace back to what was actually provided.',
    suggestion: 'To change how this data is interpreted, create a new interpretation in a View.',
    operator: 'INS',
    principle: 'GIVEN data is immutable',
    learnMore: 'Recorded facts (GIVEN) capture exactly what was observed. Changes happen through interpretations (MEANT), not by altering the original.'
  },

  [RestrictionType.CANNOT_DELETE_RECORD]: {
    title: 'Records cannot be deleted',
    message: 'Once a record exists, it cannot be erased from history.',
    explanation: 'Deleting records would break the ability to trace how data evolved over time. Every record that ever existed remains part of the historical record.',
    suggestion: 'To hide this record, use Archive or apply a filter. The record will no longer appear but remains available if needed.',
    operator: 'REC',
    principle: 'Once asserted, never erased',
    learnMore: 'The system maintains complete history. "Deletion" is actually marking something as inactive (NUL), not erasure.'
  },

  [RestrictionType.CANNOT_MODIFY_HISTORY]: {
    title: 'History cannot be changed',
    message: 'Past states are preserved as they were known at the time.',
    explanation: 'Changing historical records would make it impossible to reproduce past analyses or understand what was known when.',
    suggestion: 'To correct an error, add a new record that supersedes the old one. Both will be preserved with their timestamps.',
    operator: 'ALT',
    principle: 'Time is projection, not filtering',
    learnMore: 'Historical states represent "what we believed was true at time T". Corrections are new assertions, not rewrites.'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Epistemic Boundaries
  // ─────────────────────────────────────────────────────────────────────────

  [RestrictionType.CANNOT_EDIT_IN_VIEW]: {
    title: 'This layer shows derived data',
    message: 'This view displays calculated or filtered data that cannot be edited directly.',
    explanation: 'What you see here is the result of transformations applied to source data. Editing must happen at the source.',
    suggestion: 'Navigate to the source Set to make changes, or modify the view\'s transformation rules.',
    operator: 'SEG',
    principle: 'Views are projections, not data',
    learnMore: 'Views apply operators to data without changing it. They are like formulas in a spreadsheet - you edit the inputs, not the result.'
  },

  [RestrictionType.CANNOT_MIX_TYPES]: {
    title: 'Type mismatch',
    message: 'These values have different types and cannot be combined directly.',
    explanation: 'Mixing different types (like dates and numbers) could produce meaningless results.',
    suggestion: 'Convert values to a compatible type first, or use a formula that handles the conversion explicitly.',
    operator: 'DES',
    principle: 'Types carry meaning',
    learnMore: 'Field types define how values are interpreted. Type mismatches often indicate a conceptual mismatch, not just a technical one.'
  },

  [RestrictionType.CANNOT_LOSE_PROVENANCE]: {
    title: 'Source information required',
    message: 'This action would create data with no traceable origin.',
    explanation: 'Every value must be traceable to its source. Creating data without provenance breaks the audit trail.',
    suggestion: 'Ensure the data source is specified, or create a manual entry with your identity as the source.',
    operator: 'REC',
    principle: 'Nothing floats; everything traceable',
    learnMore: 'Provenance ensures accountability. Every value can answer "where did this come from?"'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Structural Constraints
  // ─────────────────────────────────────────────────────────────────────────

  [RestrictionType.CANNOT_BREAK_REFERENCE]: {
    title: 'This is referenced elsewhere',
    message: 'This record is linked to other records and cannot be removed.',
    explanation: 'Other records depend on this one. Removing it would break those connections and potentially corrupt data integrity.',
    suggestion: 'First remove or update the records that reference this one, then try again.',
    operator: 'CON',
    principle: 'Connections are meaningful',
    learnMore: 'Relationships between records carry semantic meaning. Breaking them arbitrarily would lose information.'
  },

  [RestrictionType.CANNOT_ORPHAN_RECORD]: {
    title: 'Record needs a parent',
    message: 'This record must belong to a Set or collection.',
    explanation: 'Records exist within Sets. A record without a parent Set would be inaccessible and unmanageable.',
    suggestion: 'Move the record to another Set before removing it from this one.',
    operator: 'CON',
    principle: 'Records have homes',
    learnMore: 'The Set → Record hierarchy ensures all data is organized and discoverable.'
  },

  [RestrictionType.CANNOT_CIRCULAR_REFERENCE]: {
    title: 'Circular reference detected',
    message: 'This link would create a loop where a record references itself.',
    explanation: 'Circular references can cause infinite loops and make it impossible to determine the true value of a field.',
    suggestion: 'Review the link structure and choose a different target that doesn\'t create a cycle.',
    operator: 'CON',
    principle: 'Dependencies must be acyclic',
    learnMore: 'Data relationships form a directed graph. Cycles in this graph create logical paradoxes.'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Conflict Constraints
  // ─────────────────────────────────────────────────────────────────────────

  [RestrictionType.CANNOT_RESOLVE_WITHOUT_CHOICE]: {
    title: 'Multiple values exist',
    message: 'These sources provide different values. A resolution strategy is required.',
    explanation: 'When sources disagree, the system preserves all values rather than arbitrarily choosing one. You must decide how to resolve the conflict.',
    suggestion: 'Choose a resolution strategy: use the most recent, highest confidence, or keep all values visible.',
    operator: 'SUP',
    principle: 'Disagreement preserved, not hidden',
    learnMore: 'Superposition (∥) keeps conflicting values visible until explicitly resolved. This prevents silent data loss.'
  },

  [RestrictionType.CANNOT_MERGE_INCOMPATIBLE]: {
    title: 'Cannot combine these records',
    message: 'These records have conflicting definitions that prevent merging.',
    explanation: 'The records define the same field differently, or have incompatible types. Merging would create ambiguous data.',
    suggestion: 'Align the definitions first, or use superposition to keep both interpretations.',
    operator: 'SYN',
    principle: 'Identity requires compatibility',
    learnMore: 'Synthesis (≡) asserts that things are the same entity. This requires that their properties are reconcilable.'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Definition Constraints
  // ─────────────────────────────────────────────────────────────────────────

  [RestrictionType.CANNOT_AGGREGATE_MIXED_UNITS]: {
    title: 'Mixed units detected',
    message: 'Cannot calculate totals across different units (e.g., USD and EUR, meters and feet).',
    explanation: 'Aggregating values with different units would produce meaningless results. The units must be aligned first.',
    suggestion: 'Apply a unit conversion, or filter to a single unit before aggregating.',
    operator: 'DES',
    principle: 'Units carry meaning',
    learnMore: 'Semantic bindings include unit information. The system prevents accidental mixing of incompatible units.'
  },

  [RestrictionType.CANNOT_COMPARE_DIFFERENT_FRAMES]: {
    title: 'Definition frames differ',
    message: 'These values use different definitions and cannot be directly compared.',
    explanation: 'A term like "revenue" might mean different things in different contexts (GAAP vs IFRS, gross vs net). Comparing them directly would be misleading.',
    suggestion: 'Switch to a common definition frame, or explicitly note the comparison is across different definitions.',
    operator: 'ALT',
    principle: 'Context matters',
    learnMore: 'Definition frames (jurisdiction, timeframe, accounting standard) affect meaning. The system tracks these to prevent category errors.'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Permission Constraints
  // ─────────────────────────────────────────────────────────────────────────

  [RestrictionType.CANNOT_MODIFY_LOCKED]: {
    title: 'This data is locked',
    message: 'This record or period has been locked and cannot be modified.',
    explanation: 'Locked data is protected from changes, often for compliance or audit purposes.',
    suggestion: 'Contact an administrator to unlock if changes are truly necessary, or create a correction that supersedes this data.',
    operator: 'ALT',
    principle: 'Some states are final',
    learnMore: 'Locking preserves point-in-time states for regulatory compliance or historical accuracy.'
  },

  [RestrictionType.CANNOT_ACCESS_ARCHIVED]: {
    title: 'This data is archived',
    message: 'Archived data is read-only and cannot be modified.',
    explanation: 'Archived records are preserved for historical reference but are no longer active.',
    suggestion: 'To work with this data, restore it from the archive first.',
    operator: 'NUL',
    principle: 'Archives preserve, not erase',
    learnMore: 'Archiving marks data as inactive while preserving complete history. It\'s reversible, unlike deletion.'
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a restriction message by type
 */
function getRestrictionMessage(type) {
  return RestrictionMessages[type] || {
    title: 'Action not allowed',
    message: 'This action cannot be performed.',
    explanation: 'Please try a different approach.',
    suggestion: null
  };
}

/**
 * Show a restriction message as a toast/notification
 */
function showRestrictionToast(type, options = {}) {
  const msg = getRestrictionMessage(type);

  // Use existing toast system if available
  if (window.showToast) {
    window.showToast({
      type: 'warning',
      title: msg.title,
      message: msg.message,
      duration: options.duration || 5000,
      action: msg.suggestion ? {
        label: 'Learn more',
        onClick: () => showRestrictionModal(type)
      } : null
    });
    return;
  }

  // Fallback to console
  console.warn(`[EO Restriction] ${msg.title}: ${msg.message}`);
}

/**
 * Show a restriction message as a modal with full explanation
 */
function showRestrictionModal(type) {
  const msg = getRestrictionMessage(type);

  // Create modal element
  const modal = document.createElement('div');
  modal.className = 'eo-restriction-modal';
  modal.innerHTML = `
    <div class="eo-restriction-overlay"></div>
    <div class="eo-restriction-content">
      <div class="eo-restriction-header">
        <i class="ph ph-warning-circle"></i>
        <h3>${msg.title}</h3>
        <button class="btn-icon eo-close-btn">
          <i class="ph ph-x"></i>
        </button>
      </div>

      <div class="eo-restriction-body">
        <p class="eo-restriction-message">${msg.message}</p>

        <div class="eo-restriction-explanation">
          <h4>Why?</h4>
          <p>${msg.explanation}</p>
        </div>

        ${msg.suggestion ? `
          <div class="eo-restriction-suggestion">
            <h4>What you can do</h4>
            <p>${msg.suggestion}</p>
          </div>
        ` : ''}

        <div class="eo-restriction-principle">
          <span class="principle-label">Principle:</span>
          <span class="principle-text">${msg.principle}</span>
        </div>
      </div>

      <div class="eo-restriction-footer">
        <button class="btn btn-primary eo-ok-btn">Got it</button>
        ${msg.learnMore ? `
          <button class="btn btn-outline eo-learn-more-btn">
            <i class="ph ph-book-open"></i>
            Learn more
          </button>
        ` : ''}
      </div>
    </div>
  `;

  // Event listeners
  const close = () => modal.remove();

  modal.querySelector('.eo-close-btn').addEventListener('click', close);
  modal.querySelector('.eo-ok-btn').addEventListener('click', close);
  modal.querySelector('.eo-restriction-overlay').addEventListener('click', close);

  const learnMoreBtn = modal.querySelector('.eo-learn-more-btn');
  if (learnMoreBtn && msg.learnMore) {
    learnMoreBtn.addEventListener('click', () => {
      // Show extended explanation
      const body = modal.querySelector('.eo-restriction-body');
      const existing = body.querySelector('.eo-restriction-learn-more');
      if (existing) {
        existing.remove();
        learnMoreBtn.innerHTML = '<i class="ph ph-book-open"></i> Learn more';
      } else {
        const learnMoreDiv = document.createElement('div');
        learnMoreDiv.className = 'eo-restriction-learn-more';
        learnMoreDiv.innerHTML = `
          <h4>Deep dive</h4>
          <p>${msg.learnMore}</p>
        `;
        body.appendChild(learnMoreDiv);
        learnMoreBtn.innerHTML = '<i class="ph ph-book-open"></i> Show less';
      }
    });
  }

  document.body.appendChild(modal);
}

/**
 * Create a restriction error with EO context
 */
function createRestrictionError(type, context = {}) {
  const msg = getRestrictionMessage(type);
  const error = new Error(msg.message);
  error.name = 'EORestrictionError';
  error.restrictionType = type;
  error.title = msg.title;
  error.explanation = msg.explanation;
  error.suggestion = msg.suggestion;
  error.operator = msg.operator;
  error.context = context;
  return error;
}

/**
 * Wrap a function to catch and display restriction errors
 */
function withRestrictionHandling(fn) {
  return async function (...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      if (error.name === 'EORestrictionError') {
        showRestrictionToast(error.restrictionType);
        return null;
      }
      throw error;
    }
  };
}

// ============================================================================
// Inline Message Helpers
// ============================================================================

/**
 * Get a short inline message for UI elements
 */
function getInlineRestriction(type) {
  const shortcuts = {
    [RestrictionType.CANNOT_EDIT_GIVEN]: 'Read-only: recorded fact',
    [RestrictionType.CANNOT_DELETE_RECORD]: 'Cannot delete: use Archive instead',
    [RestrictionType.CANNOT_EDIT_IN_VIEW]: 'Edit at source',
    [RestrictionType.CANNOT_RESOLVE_WITHOUT_CHOICE]: 'Choose a value',
    [RestrictionType.CANNOT_AGGREGATE_MIXED_UNITS]: 'Units must match',
    [RestrictionType.CANNOT_MERGE_INCOMPATIBLE]: 'Definitions conflict',
    [RestrictionType.CANNOT_MODIFY_LOCKED]: 'Locked',
    [RestrictionType.CANNOT_ACCESS_ARCHIVED]: 'Archived'
  };

  return shortcuts[type] || 'Not allowed';
}

/**
 * Get restriction type for a given action and context
 */
function getRestrictionForAction(action, context = {}) {
  const { epistemicType, isLocked, isArchived, hasConflicts, hasMixedUnits } = context;

  // Check epistemic type restrictions
  if (action === 'edit') {
    if (epistemicType === 'GIVEN') return RestrictionType.CANNOT_EDIT_GIVEN;
    if (context.isView) return RestrictionType.CANNOT_EDIT_IN_VIEW;
    if (isLocked) return RestrictionType.CANNOT_MODIFY_LOCKED;
    if (isArchived) return RestrictionType.CANNOT_ACCESS_ARCHIVED;
  }

  if (action === 'delete') {
    return RestrictionType.CANNOT_DELETE_RECORD;
  }

  if (action === 'merge' && hasConflicts) {
    return RestrictionType.CANNOT_RESOLVE_WITHOUT_CHOICE;
  }

  if (action === 'aggregate' && hasMixedUnits) {
    return RestrictionType.CANNOT_AGGREGATE_MIXED_UNITS;
  }

  return null;
}

// ============================================================================
// Export
// ============================================================================

window.EORestrictions = {
  // Types
  RestrictionType,

  // Data
  RestrictionMessages,

  // Functions
  getRestrictionMessage,
  showRestrictionToast,
  showRestrictionModal,
  createRestrictionError,
  withRestrictionHandling,
  getInlineRestriction,
  getRestrictionForAction
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.EORestrictions;
}
