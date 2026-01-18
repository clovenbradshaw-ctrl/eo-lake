/**
 * EO Data Flow - n8n-Inspired Visual Data Transformer
 *
 * A clean, accessible visual canvas for building data transformation pipelines.
 * Inspired by n8n's workflow UX: card-style nodes, three simple categories,
 * execution awareness, and AI integration.
 *
 * Key Differences from Temporal Pipeline:
 * - Simpler three-category taxonomy (Source, Transform, Output)
 * - Card-style nodes with external configuration (not inline)
 * - Collapsed timeline by default
 * - AI assistant integration
 * - Command palette for node addition
 *
 * Integrates with:
 * - Existing Nine Operators (CON, SEG, SYN, ALT, DES, NUL)
 * - Horizon for temporal AS_OF queries
 * - EventStore for time-travel
 */

// ============================================================================
// Node Categories - TouchDesigner-Inspired Operator Families
// ============================================================================

/**
 * Six operator families (TouchDesigner-inspired, Noema-specific)
 * Each family has a distinct color and purpose
 */
const DataFlowCategory = Object.freeze({
  // Legacy aliases for backward compatibility
  SOURCE: 'given',
  TRANSFORM: 'shape',
  OUTPUT: 'emit',

  // New families (TouchDesigner-inspired)
  GIVEN: 'given',       // Where data originates (immutable sources) - Indigo
  SHAPE: 'shape',       // How data is sculpted (row/column ops) - Amber
  SYNTH: 'synth',       // How data is synthesized (aggregations) - Violet
  AGENT: 'agent',       // Where AI acts (LLM operations) - Cyan
  FLOW: 'flow',         // How data flows (control structures) - Rose
  EMIT: 'emit'          // Where data goes (outputs/side effects) - Emerald
});

// ============================================================================
// Node Types
// ============================================================================

/**
 * Available node types in the Data Flow canvas
 * Organized by operator family
 */
const DataFlowNodeType = Object.freeze({
  // ═══════════════════════════════════════════════════════════════
  // GIVEN - Where data originates (immutable sources)
  // ═══════════════════════════════════════════════════════════════
  SET: 'set',           // Pull records from a Set
  LENS: 'lens',         // Use a saved Lens
  FOCUS: 'focus',       // Start from specific record
  IMPORT: 'import',     // Load external data (CSV/JSON/API)
  QUERY: 'query',       // SQL-like query interface
  WEBHOOK_IN: 'webhookIn', // Receive external data via webhook

  // ═══════════════════════════════════════════════════════════════
  // SHAPE - How data is sculpted (row/column operations)
  // ═══════════════════════════════════════════════════════════════
  FILTER: 'filter',     // SEG - Keep matching records
  SORT: 'sort',         // Order records by field(s)
  SELECT: 'select',     // DES - Choose/rename fields
  TRANSFORM: 'transform', // ALT - Modify field values
  DEDUPE: 'dedupe',     // Remove duplicate records
  FLATTEN: 'flatten',   // Unnest arrays
  UNWIND: 'unwind',     // One record per array item
  HANDLE_NULLS: 'handleNulls', // NUL - Deal with missing values
  CODE: 'code',         // Custom JavaScript

  // ═══════════════════════════════════════════════════════════════
  // SYNTH - How data is synthesized (aggregations)
  // ═══════════════════════════════════════════════════════════════
  AGGREGATE: 'aggregate', // SYN - Calculate summaries (SUM, AVG, COUNT)
  GROUP: 'group',       // Group records by field(s)
  PIVOT: 'pivot',       // Rows to columns transformation
  ROLLUP: 'rollup',     // Hierarchical aggregation
  WINDOW: 'window',     // Running calculations (moving avg, rank)
  DISTINCT: 'distinct', // Unique values extraction

  // ═══════════════════════════════════════════════════════════════
  // AGENT - Where AI acts (LLM operations)
  // ═══════════════════════════════════════════════════════════════
  AI_CLASSIFY: 'aiClassify', // Categorize records with AI
  AI_EXTRACT: 'aiExtract',   // Extract structured data
  AI_GENERATE: 'aiGenerate', // Create new content
  AI_EMBED: 'aiEmbed',       // Vector embeddings
  AI_SUMMARIZE: 'aiSummarize', // Condense records
  AI_MATCH: 'aiMatch',       // Fuzzy/semantic join

  // ═══════════════════════════════════════════════════════════════
  // FLOW - How data flows (control structures)
  // ═══════════════════════════════════════════════════════════════
  BRANCH: 'branch',     // If/else split (true/false outputs)
  SWITCH: 'switch',     // Multi-way split (case outputs)
  MERGE: 'merge',       // Combine multiple streams
  JOIN: 'join',         // CON - Join on key
  LOOP: 'loop',         // Iterate with sub-flow
  ERROR: 'error',       // Handle failures gracefully

  // ═══════════════════════════════════════════════════════════════
  // EMIT - Where data goes (outputs/side effects)
  // ═══════════════════════════════════════════════════════════════
  PREVIEW: 'preview',   // View current data state
  SAVE: 'save',         // Write to Set
  EXPORT: 'export',     // Download as CSV/JSON/Excel
  WEBHOOK_OUT: 'webhookOut', // Send to external URL
  LOG: 'log',           // Debug output to console

  // Legacy alias for backward compatibility
  AI_ACTION: 'aiClassify'
});

/**
 * Map node types to operator families
 */
const NodeTypeCategory = {
  // GIVEN - Sources
  [DataFlowNodeType.SET]: DataFlowCategory.GIVEN,
  [DataFlowNodeType.LENS]: DataFlowCategory.GIVEN,
  [DataFlowNodeType.FOCUS]: DataFlowCategory.GIVEN,
  [DataFlowNodeType.IMPORT]: DataFlowCategory.GIVEN,
  [DataFlowNodeType.QUERY]: DataFlowCategory.GIVEN,
  [DataFlowNodeType.WEBHOOK_IN]: DataFlowCategory.GIVEN,

  // SHAPE - Row/Column Operations
  [DataFlowNodeType.FILTER]: DataFlowCategory.SHAPE,
  [DataFlowNodeType.SORT]: DataFlowCategory.SHAPE,
  [DataFlowNodeType.SELECT]: DataFlowCategory.SHAPE,
  [DataFlowNodeType.TRANSFORM]: DataFlowCategory.SHAPE,
  [DataFlowNodeType.DEDUPE]: DataFlowCategory.SHAPE,
  [DataFlowNodeType.FLATTEN]: DataFlowCategory.SHAPE,
  [DataFlowNodeType.UNWIND]: DataFlowCategory.SHAPE,
  [DataFlowNodeType.HANDLE_NULLS]: DataFlowCategory.SHAPE,
  [DataFlowNodeType.CODE]: DataFlowCategory.SHAPE,

  // SYNTH - Aggregations
  [DataFlowNodeType.AGGREGATE]: DataFlowCategory.SYNTH,
  [DataFlowNodeType.GROUP]: DataFlowCategory.SYNTH,
  [DataFlowNodeType.PIVOT]: DataFlowCategory.SYNTH,
  [DataFlowNodeType.ROLLUP]: DataFlowCategory.SYNTH,
  [DataFlowNodeType.WINDOW]: DataFlowCategory.SYNTH,
  [DataFlowNodeType.DISTINCT]: DataFlowCategory.SYNTH,

  // AGENT - AI Operations
  [DataFlowNodeType.AI_CLASSIFY]: DataFlowCategory.AGENT,
  [DataFlowNodeType.AI_EXTRACT]: DataFlowCategory.AGENT,
  [DataFlowNodeType.AI_GENERATE]: DataFlowCategory.AGENT,
  [DataFlowNodeType.AI_EMBED]: DataFlowCategory.AGENT,
  [DataFlowNodeType.AI_SUMMARIZE]: DataFlowCategory.AGENT,
  [DataFlowNodeType.AI_MATCH]: DataFlowCategory.AGENT,

  // FLOW - Control Structures
  [DataFlowNodeType.BRANCH]: DataFlowCategory.FLOW,
  [DataFlowNodeType.SWITCH]: DataFlowCategory.FLOW,
  [DataFlowNodeType.MERGE]: DataFlowCategory.FLOW,
  [DataFlowNodeType.JOIN]: DataFlowCategory.FLOW,
  [DataFlowNodeType.LOOP]: DataFlowCategory.FLOW,
  [DataFlowNodeType.ERROR]: DataFlowCategory.FLOW,

  // EMIT - Outputs
  [DataFlowNodeType.PREVIEW]: DataFlowCategory.EMIT,
  [DataFlowNodeType.SAVE]: DataFlowCategory.EMIT,
  [DataFlowNodeType.EXPORT]: DataFlowCategory.EMIT,
  [DataFlowNodeType.WEBHOOK_OUT]: DataFlowCategory.EMIT,
  [DataFlowNodeType.LOG]: DataFlowCategory.EMIT
};

/**
 * Human-readable labels for node types
 */
const DataFlowNodeLabels = {
  // GIVEN
  [DataFlowNodeType.SET]: 'Set',
  [DataFlowNodeType.LENS]: 'Lens',
  [DataFlowNodeType.FOCUS]: 'Focus',
  [DataFlowNodeType.IMPORT]: 'Import',
  [DataFlowNodeType.QUERY]: 'Query',
  [DataFlowNodeType.WEBHOOK_IN]: 'Webhook In',

  // SHAPE
  [DataFlowNodeType.FILTER]: 'Filter',
  [DataFlowNodeType.SORT]: 'Sort',
  [DataFlowNodeType.SELECT]: 'Select',
  [DataFlowNodeType.TRANSFORM]: 'Transform',
  [DataFlowNodeType.DEDUPE]: 'Dedupe',
  [DataFlowNodeType.FLATTEN]: 'Flatten',
  [DataFlowNodeType.UNWIND]: 'Unwind',
  [DataFlowNodeType.HANDLE_NULLS]: 'Handle Nulls',
  [DataFlowNodeType.CODE]: 'Code',

  // SYNTH
  [DataFlowNodeType.AGGREGATE]: 'Aggregate',
  [DataFlowNodeType.GROUP]: 'Group',
  [DataFlowNodeType.PIVOT]: 'Pivot',
  [DataFlowNodeType.ROLLUP]: 'Rollup',
  [DataFlowNodeType.WINDOW]: 'Window',
  [DataFlowNodeType.DISTINCT]: 'Distinct',

  // AGENT
  [DataFlowNodeType.AI_CLASSIFY]: 'AI Classify',
  [DataFlowNodeType.AI_EXTRACT]: 'AI Extract',
  [DataFlowNodeType.AI_GENERATE]: 'AI Generate',
  [DataFlowNodeType.AI_EMBED]: 'AI Embed',
  [DataFlowNodeType.AI_SUMMARIZE]: 'AI Summarize',
  [DataFlowNodeType.AI_MATCH]: 'AI Match',

  // FLOW
  [DataFlowNodeType.BRANCH]: 'Branch',
  [DataFlowNodeType.SWITCH]: 'Switch',
  [DataFlowNodeType.MERGE]: 'Merge',
  [DataFlowNodeType.JOIN]: 'Join',
  [DataFlowNodeType.LOOP]: 'Loop',
  [DataFlowNodeType.ERROR]: 'Error Handler',

  // EMIT
  [DataFlowNodeType.PREVIEW]: 'Preview',
  [DataFlowNodeType.SAVE]: 'Save',
  [DataFlowNodeType.EXPORT]: 'Export',
  [DataFlowNodeType.WEBHOOK_OUT]: 'Webhook Out',
  [DataFlowNodeType.LOG]: 'Log'
};

/**
 * Icons for each node type (using Phosphor icons)
 */
const DataFlowNodeIcons = {
  // GIVEN
  [DataFlowNodeType.SET]: 'ph-package',
  [DataFlowNodeType.LENS]: 'ph-magnifying-glass',
  [DataFlowNodeType.FOCUS]: 'ph-crosshair',
  [DataFlowNodeType.IMPORT]: 'ph-download',
  [DataFlowNodeType.QUERY]: 'ph-database',
  [DataFlowNodeType.WEBHOOK_IN]: 'ph-arrow-square-in',

  // SHAPE
  [DataFlowNodeType.FILTER]: 'ph-funnel',
  [DataFlowNodeType.SORT]: 'ph-sort-ascending',
  [DataFlowNodeType.SELECT]: 'ph-list-checks',
  [DataFlowNodeType.TRANSFORM]: 'ph-pencil-simple',
  [DataFlowNodeType.DEDUPE]: 'ph-users-three',
  [DataFlowNodeType.FLATTEN]: 'ph-arrows-out-line-vertical',
  [DataFlowNodeType.UNWIND]: 'ph-list-numbers',
  [DataFlowNodeType.HANDLE_NULLS]: 'ph-prohibit',
  [DataFlowNodeType.CODE]: 'ph-code',

  // SYNTH
  [DataFlowNodeType.AGGREGATE]: 'ph-sigma',
  [DataFlowNodeType.GROUP]: 'ph-folders',
  [DataFlowNodeType.PIVOT]: 'ph-table',
  [DataFlowNodeType.ROLLUP]: 'ph-tree-structure',
  [DataFlowNodeType.WINDOW]: 'ph-chart-line',
  [DataFlowNodeType.DISTINCT]: 'ph-fingerprint',

  // AGENT
  [DataFlowNodeType.AI_CLASSIFY]: 'ph-tag',
  [DataFlowNodeType.AI_EXTRACT]: 'ph-scan',
  [DataFlowNodeType.AI_GENERATE]: 'ph-sparkle',
  [DataFlowNodeType.AI_EMBED]: 'ph-cube',
  [DataFlowNodeType.AI_SUMMARIZE]: 'ph-note',
  [DataFlowNodeType.AI_MATCH]: 'ph-link-simple',

  // FLOW
  [DataFlowNodeType.BRANCH]: 'ph-git-branch',
  [DataFlowNodeType.SWITCH]: 'ph-signpost',
  [DataFlowNodeType.MERGE]: 'ph-git-merge',
  [DataFlowNodeType.JOIN]: 'ph-link',
  [DataFlowNodeType.LOOP]: 'ph-arrows-clockwise',
  [DataFlowNodeType.ERROR]: 'ph-warning',

  // EMIT
  [DataFlowNodeType.PREVIEW]: 'ph-eye',
  [DataFlowNodeType.SAVE]: 'ph-floppy-disk',
  [DataFlowNodeType.EXPORT]: 'ph-export',
  [DataFlowNodeType.WEBHOOK_OUT]: 'ph-arrow-square-out',
  [DataFlowNodeType.LOG]: 'ph-terminal'
};

/**
 * Category/Family colors (TouchDesigner-inspired, distinct)
 */
const CategoryColors = {
  [DataFlowCategory.GIVEN]: '#6366f1',   // Indigo - Where data originates
  [DataFlowCategory.SHAPE]: '#f59e0b',   // Amber - How data is sculpted
  [DataFlowCategory.SYNTH]: '#8b5cf6',   // Violet - How data is synthesized
  [DataFlowCategory.AGENT]: '#06b6d4',   // Cyan - Where AI acts
  [DataFlowCategory.FLOW]: '#f43f5e',    // Rose - How data flows
  [DataFlowCategory.EMIT]: '#10b981',    // Emerald - Where data goes

  // Legacy aliases
  [DataFlowCategory.SOURCE]: '#6366f1',
  [DataFlowCategory.TRANSFORM]: '#f59e0b',
  [DataFlowCategory.OUTPUT]: '#10b981'
};

/**
 * Category metadata for UI display
 */
const CategoryMeta = {
  [DataFlowCategory.GIVEN]: {
    label: 'GIVEN',
    description: 'Where data originates',
    icon: 'ph-package',
    color: '#6366f1'
  },
  [DataFlowCategory.SHAPE]: {
    label: 'SHAPE',
    description: 'How data is sculpted',
    icon: 'ph-lightning',
    color: '#f59e0b'
  },
  [DataFlowCategory.SYNTH]: {
    label: 'SYNTH',
    description: 'How data is synthesized',
    icon: 'ph-sigma',
    color: '#8b5cf6'
  },
  [DataFlowCategory.AGENT]: {
    label: 'AGENT',
    description: 'Where AI acts',
    icon: 'ph-robot',
    color: '#06b6d4'
  },
  [DataFlowCategory.FLOW]: {
    label: 'FLOW',
    description: 'How data flows',
    icon: 'ph-git-branch',
    color: '#f43f5e'
  },
  [DataFlowCategory.EMIT]: {
    label: 'EMIT',
    description: 'Where data goes',
    icon: 'ph-export',
    color: '#10b981'
  }
};

// ============================================================================
// Execution States
// ============================================================================

/**
 * Node execution states with visual feedback
 */
const ExecutionState = Object.freeze({
  IDLE: 'idle',         // Gray - not yet run
  RUNNING: 'running',   // Blue with animation
  SUCCESS: 'success',   // Green checkmark
  ERROR: 'error',       // Red X
  STALE: 'stale'        // Orange - upstream changed
});

// ============================================================================
// Data Flow Node
// ============================================================================

/**
 * Represents a node in the Data Flow canvas
 * Card-style design with clean separation of concerns
 */
class DataFlowNode {
  constructor(config = {}) {
    this.id = config.id || `dfn_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    this.type = config.type || DataFlowNodeType.SET;
    this.label = config.label || DataFlowNodeLabels[this.type];
    this.category = NodeTypeCategory[this.type];

    // Position on canvas
    this.x = config.x ?? 100;
    this.y = config.y ?? 100;

    // Configuration (stored externally, shown in inspector)
    this.config = config.config || this._getDefaultConfig();

    // Connections
    this.inputs = [];   // Wire IDs connecting to this node
    this.outputs = [];  // Wire IDs from this node

    // For branch nodes: multiple output ports
    this.outputPorts = config.outputPorts || ['out'];

    // Execution state
    this.state = ExecutionState.IDLE;
    this.cachedValue = null;
    this.cachedAt = null;
    this.error = null;

    // Preview data (shown on node card)
    this.preview = {
      recordCount: null,
      summaryText: '',
      metric: null
    };
  }

  /**
   * Get default configuration for node type
   */
  _getDefaultConfig() {
    switch (this.type) {
      // ═══════════════════════════════════════════════════════════════
      // GIVEN - Source Nodes
      // ═══════════════════════════════════════════════════════════════
      case DataFlowNodeType.SET:
        return { setId: null, setName: '', fields: [] };

      case DataFlowNodeType.LENS:
        return { lensId: null, lensName: '' };

      case DataFlowNodeType.FOCUS:
        return { recordId: null };

      case DataFlowNodeType.IMPORT:
        return { source: 'csv', data: null, fileName: '' };

      case DataFlowNodeType.QUERY:
        return { query: '', language: 'sql' };

      case DataFlowNodeType.WEBHOOK_IN:
        return { endpoint: '', method: 'POST', auth: null };

      // ═══════════════════════════════════════════════════════════════
      // SHAPE - Transform Nodes
      // ═══════════════════════════════════════════════════════════════
      case DataFlowNodeType.FILTER:
        return { field: '', operator: 'eq', value: '', conditions: [], logic: 'AND' };

      case DataFlowNodeType.SORT:
        return { field: '', direction: 'asc', nullsFirst: false };

      case DataFlowNodeType.SELECT:
        return { fields: [], renames: {}, exclude: [] };

      case DataFlowNodeType.TRANSFORM:
        return { field: '', expression: '', operation: 'map', newField: '' };

      case DataFlowNodeType.DEDUPE:
        return { fields: [], keepFirst: true };

      case DataFlowNodeType.FLATTEN:
        return { field: '', separator: '.' };

      case DataFlowNodeType.UNWIND:
        return { field: '', includeIndex: false };

      case DataFlowNodeType.HANDLE_NULLS:
        return { strategy: 'default', defaultValue: '', perField: {} };

      case DataFlowNodeType.CODE:
        return {
          code: '// Input records available as `records`\n// Return transformed records\nreturn records;',
          language: 'javascript'
        };

      // ═══════════════════════════════════════════════════════════════
      // SYNTH - Aggregation Nodes
      // ═══════════════════════════════════════════════════════════════
      case DataFlowNodeType.AGGREGATE:
        return { function: 'SUM', field: '', groupBy: [], alias: '' };

      case DataFlowNodeType.GROUP:
        return { groupBy: [], aggregations: [] };

      case DataFlowNodeType.PIVOT:
        return { rowField: '', columnField: '', valueField: '', aggregation: 'SUM' };

      case DataFlowNodeType.ROLLUP:
        return { groupBy: [], aggregation: 'SUM', field: '' };

      case DataFlowNodeType.WINDOW:
        return { function: 'ROW_NUMBER', partitionBy: [], orderBy: '', alias: '' };

      case DataFlowNodeType.DISTINCT:
        return { fields: [] };

      // ═══════════════════════════════════════════════════════════════
      // AGENT - AI Nodes
      // ═══════════════════════════════════════════════════════════════
      case DataFlowNodeType.AI_CLASSIFY:
        return { prompt: '', categories: [], outputField: 'category', model: 'default' };

      case DataFlowNodeType.AI_EXTRACT:
        return { prompt: '', schema: {}, outputField: 'extracted', model: 'default' };

      case DataFlowNodeType.AI_GENERATE:
        return { prompt: '', outputField: 'generated', model: 'default' };

      case DataFlowNodeType.AI_EMBED:
        return { field: '', outputField: 'embedding', model: 'default' };

      case DataFlowNodeType.AI_SUMMARIZE:
        return { field: '', maxLength: 100, outputField: 'summary', model: 'default' };

      case DataFlowNodeType.AI_MATCH:
        return { targetSetId: null, threshold: 0.8, outputField: 'match_score' };

      // ═══════════════════════════════════════════════════════════════
      // FLOW - Control Nodes
      // ═══════════════════════════════════════════════════════════════
      case DataFlowNodeType.BRANCH:
        return { field: '', operator: 'eq', value: '' };

      case DataFlowNodeType.SWITCH:
        return { field: '', cases: [], defaultCase: 'other' };

      case DataFlowNodeType.MERGE:
        return { strategy: 'concat', dedupeBy: null };

      case DataFlowNodeType.JOIN:
        return { targetSetId: null, joinField: '', joinType: 'inner', targetField: '' };

      case DataFlowNodeType.LOOP:
        return { iterateOver: 'records', maxIterations: 1000 };

      case DataFlowNodeType.ERROR:
        return { strategy: 'skip', fallbackValue: null, logErrors: true };

      // ═══════════════════════════════════════════════════════════════
      // EMIT - Output Nodes
      // ═══════════════════════════════════════════════════════════════
      case DataFlowNodeType.PREVIEW:
        return { maxRecords: 100, columns: [] };

      case DataFlowNodeType.SAVE:
        return { targetSetId: null, createNew: false, setName: '', updateMode: 'replace' };

      case DataFlowNodeType.EXPORT:
        return { format: 'csv', fileName: 'export', includeHeaders: true };

      case DataFlowNodeType.WEBHOOK_OUT:
        return { url: '', method: 'POST', headers: {}, auth: null };

      case DataFlowNodeType.LOG:
        return { label: '', level: 'info', fields: [] };

      default:
        return {};
    }
  }

  /**
   * Mark node as needing re-execution
   */
  markStale() {
    if (this.state === ExecutionState.RUNNING) return false;
    if (this.state !== ExecutionState.STALE) {
      this.state = ExecutionState.STALE;
      return true;
    }
    return false;
  }

  /**
   * Set execution as started
   */
  setRunning() {
    this.state = ExecutionState.RUNNING;
    this.error = null;
  }

  /**
   * Set successful result
   */
  setSuccess(value) {
    this.cachedValue = value;
    this.cachedAt = Date.now();
    this.state = ExecutionState.SUCCESS;
    this.error = null;
    this._updatePreview(value);
  }

  /**
   * Set error state
   */
  setError(err) {
    this.state = ExecutionState.ERROR;
    this.error = typeof err === 'string' ? err : err.message;
    this.preview = {
      recordCount: null,
      summaryText: `Error: ${this.error}`,
      metric: null
    };
  }

  /**
   * Update preview from value
   */
  _updatePreview(value) {
    if (Array.isArray(value)) {
      this.preview = {
        recordCount: value.length,
        summaryText: `${value.length} records`,
        metric: value.length
      };
    } else if (value !== null && value !== undefined) {
      const str = String(value);
      this.preview = {
        recordCount: 1,
        summaryText: str.length > 30 ? str.slice(0, 30) + '...' : str,
        metric: typeof value === 'number' ? value : 1
      };
    } else {
      this.preview = {
        recordCount: 0,
        summaryText: 'No data',
        metric: null
      };
    }
  }

  /**
   * Get a short summary of the config for display on card
   */
  getConfigSummary() {
    const opSymbols = { eq: '=', ne: '!=', gt: '>', lt: '<', gte: '>=', lte: '<=', contains: '~' };

    switch (this.type) {
      // GIVEN
      case DataFlowNodeType.SET:
        return this.config.setName || 'Select a Set';
      case DataFlowNodeType.LENS:
        return this.config.lensName || 'Select a Lens';
      case DataFlowNodeType.FOCUS:
        return this.config.recordId || 'Select record';
      case DataFlowNodeType.IMPORT:
        return this.config.fileName || 'Load file';
      case DataFlowNodeType.QUERY:
        return this.config.query ? `${this.config.language}: ...` : 'Write query';
      case DataFlowNodeType.WEBHOOK_IN:
        return this.config.endpoint || 'Configure endpoint';

      // SHAPE
      case DataFlowNodeType.FILTER:
        if (!this.config.field) return 'Configure filter';
        return `${this.config.field} ${opSymbols[this.config.operator] || this.config.operator} "${this.config.value}"`;
      case DataFlowNodeType.SORT:
        return this.config.field ? `${this.config.field} ${this.config.direction}` : 'Configure sort';
      case DataFlowNodeType.SELECT:
        const selectCount = this.config.fields?.length || 0;
        return selectCount ? `${selectCount} fields` : 'Select fields';
      case DataFlowNodeType.TRANSFORM:
        return this.config.expression || 'Configure transform';
      case DataFlowNodeType.DEDUPE:
        const dedupeCount = this.config.fields?.length || 0;
        return dedupeCount ? `By ${dedupeCount} fields` : 'Configure dedupe';
      case DataFlowNodeType.FLATTEN:
        return this.config.field || 'Select field';
      case DataFlowNodeType.UNWIND:
        return this.config.field || 'Select array field';
      case DataFlowNodeType.HANDLE_NULLS:
        return `${this.config.strategy}: ${this.config.defaultValue || 'null'}`;
      case DataFlowNodeType.CODE:
        const lines = (this.config.code || '').split('\n').length;
        return `${lines} lines of code`;

      // SYNTH
      case DataFlowNodeType.AGGREGATE:
        return this.config.function ? `${this.config.function}(${this.config.field || '*'})` : 'Configure';
      case DataFlowNodeType.GROUP:
        const groupCount = this.config.groupBy?.length || 0;
        return groupCount ? `By ${groupCount} fields` : 'Configure group';
      case DataFlowNodeType.PIVOT:
        return this.config.rowField || 'Configure pivot';
      case DataFlowNodeType.ROLLUP:
        return `${this.config.aggregation || 'SUM'} rollup`;
      case DataFlowNodeType.WINDOW:
        return `${this.config.function || 'ROW_NUMBER'}()`;
      case DataFlowNodeType.DISTINCT:
        const distinctCount = this.config.fields?.length || 0;
        return distinctCount ? `${distinctCount} fields` : 'All fields';

      // AGENT
      case DataFlowNodeType.AI_CLASSIFY:
        return this.config.categories?.length ? `${this.config.categories.length} categories` : 'Configure';
      case DataFlowNodeType.AI_EXTRACT:
        return this.config.prompt ? 'Extraction configured' : 'Configure extraction';
      case DataFlowNodeType.AI_GENERATE:
        return this.config.prompt ? 'Generation configured' : 'Configure generation';
      case DataFlowNodeType.AI_EMBED:
        return this.config.field || 'Select field';
      case DataFlowNodeType.AI_SUMMARIZE:
        return this.config.field || 'Select field';
      case DataFlowNodeType.AI_MATCH:
        return this.config.targetSetId ? 'Match configured' : 'Configure match';

      // FLOW
      case DataFlowNodeType.BRANCH:
        return this.config.field ? `If ${this.config.field} ${opSymbols[this.config.operator] || '='} ${this.config.value}` : 'Configure';
      case DataFlowNodeType.SWITCH:
        const caseCount = this.config.cases?.length || 0;
        return caseCount ? `${caseCount} cases` : 'Configure cases';
      case DataFlowNodeType.MERGE:
        return this.config.strategy || 'concat';
      case DataFlowNodeType.JOIN:
        return this.config.targetSetId ? `${this.config.joinType} join` : 'Configure join';
      case DataFlowNodeType.LOOP:
        return `Over ${this.config.iterateOver}`;
      case DataFlowNodeType.ERROR:
        return this.config.strategy || 'skip';

      // EMIT
      case DataFlowNodeType.PREVIEW:
        return `Max ${this.config.maxRecords} records`;
      case DataFlowNodeType.SAVE:
        return this.config.setName || this.config.targetSetId || 'Configure save';
      case DataFlowNodeType.EXPORT:
        return `${this.config.format.toUpperCase()}: ${this.config.fileName}`;
      case DataFlowNodeType.WEBHOOK_OUT:
        return this.config.url || 'Configure URL';
      case DataFlowNodeType.LOG:
        return this.config.label || this.config.level;

      default:
        return '';
    }
  }

  /**
   * Check if this is a source node (no inputs)
   */
  isSource() {
    return this.category === DataFlowCategory.GIVEN ||
           this.category === DataFlowCategory.SOURCE; // Legacy alias
  }

  /**
   * Check if this is a branch node (multiple outputs)
   */
  isBranch() {
    return this.type === DataFlowNodeType.BRANCH ||
           this.type === DataFlowNodeType.SWITCH;
  }

  /**
   * Check if this is a merge node (multiple inputs)
   */
  isMerge() {
    return this.type === DataFlowNodeType.MERGE ||
           this.type === DataFlowNodeType.JOIN;
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      label: this.label,
      x: this.x,
      y: this.y,
      config: this.config,
      outputPorts: this.outputPorts
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json) {
    const node = new DataFlowNode(json);
    return node;
  }
}

// ============================================================================
// Data Flow Wire
// ============================================================================

/**
 * Connection between nodes
 */
class DataFlowWire {
  constructor(config = {}) {
    this.id = config.id || `dfw_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    this.sourceId = config.sourceId;
    this.targetId = config.targetId;
    this.sourcePort = config.sourcePort || 'out';
    this.targetPort = config.targetPort || 'in';
  }

  toJSON() {
    return {
      id: this.id,
      sourceId: this.sourceId,
      targetId: this.targetId,
      sourcePort: this.sourcePort,
      targetPort: this.targetPort
    };
  }

  static fromJSON(json) {
    return new DataFlowWire(json);
  }
}

// ============================================================================
// Data Flow Pipeline
// ============================================================================

/**
 * Main Data Flow pipeline manager
 */
class DataFlowPipeline {
  constructor(options = {}) {
    this.id = options.id || `flow_${Date.now().toString(36)}`;
    this.name = options.name || 'Untitled Flow';

    // Nodes and wires
    this.nodes = new Map();
    this.wires = new Map();

    // Temporal state
    this.currentTimestamp = options.timestamp || Date.now();
    this.timelineStart = options.timelineStart || null;
    this.timelineEnd = options.timelineEnd || Date.now();
    this.keyframes = [];

    // Run mode
    this.runMode = options.runMode || 'auto'; // 'auto', 'manual', 'step'

    // External dependencies
    this.workbench = options.workbench || null;
    this.eventStore = options.eventStore || null;

    // Callbacks
    this.onChange = options.onChange || null;
    this.onExecutionComplete = options.onExecutionComplete || null;

    // Execution state
    this._isExecuting = false;
    this._executionQueue = [];
  }

  // ═══════════════════════════════════════════════════════════════
  // Node Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Add a node to the pipeline
   */
  addNode(type, config = {}) {
    const node = new DataFlowNode({
      type,
      ...config
    });
    this.nodes.set(node.id, node);

    if (this.runMode === 'auto' && node.isSource()) {
      this._queueExecution(node.id);
    }

    this._notifyChange();
    return node;
  }

  /**
   * Remove a node and its connections
   */
  removeNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Remove connected wires
    const wiresToRemove = [...node.inputs, ...node.outputs];
    for (const wireId of wiresToRemove) {
      this.removeWire(wireId);
    }

    this.nodes.delete(nodeId);
    this._notifyChange();
    return true;
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  /**
   * Update node position
   */
  moveNode(nodeId, x, y) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.x = x;
      node.y = y;
    }
  }

  /**
   * Update node configuration
   */
  configureNode(nodeId, config) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    Object.assign(node.config, config);
    node.markStale();
    this._propagateStale(nodeId);

    if (this.runMode === 'auto') {
      this._queueExecution(nodeId);
    }

    this._notifyChange();
  }

  // ═══════════════════════════════════════════════════════════════
  // Wire Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Connect two nodes
   */
  connect(sourceId, targetId, ports = {}) {
    const source = this.nodes.get(sourceId);
    const target = this.nodes.get(targetId);

    if (!source || !target) return null;

    // Validate connection
    if (this._wouldCreateCycle(sourceId, targetId)) {
      console.warn('Connection would create cycle');
      return null;
    }

    // Can't connect source node to source node
    if (target.isSource()) {
      console.warn('Cannot connect to a source node');
      return null;
    }

    const wire = new DataFlowWire({
      sourceId,
      targetId,
      sourcePort: ports.sourcePort || 'out',
      targetPort: ports.targetPort || 'in'
    });

    this.wires.set(wire.id, wire);
    source.outputs.push(wire.id);
    target.inputs.push(wire.id);

    target.markStale();
    this._propagateStale(targetId);

    if (this.runMode === 'auto') {
      this._queueExecution(targetId);
    }

    this._notifyChange();
    return wire;
  }

  /**
   * Remove a wire
   */
  removeWire(wireId) {
    const wire = this.wires.get(wireId);
    if (!wire) return false;

    const source = this.nodes.get(wire.sourceId);
    const target = this.nodes.get(wire.targetId);

    if (source) {
      source.outputs = source.outputs.filter(id => id !== wireId);
    }
    if (target) {
      target.inputs = target.inputs.filter(id => id !== wireId);
      target.markStale();
      this._propagateStale(wire.targetId);
    }

    this.wires.delete(wireId);
    this._notifyChange();
    return true;
  }

  /**
   * Check for cycles
   */
  _wouldCreateCycle(sourceId, targetId) {
    const visited = new Set();

    const hasPath = (from, to) => {
      if (from === to) return true;
      if (visited.has(from)) return false;
      visited.add(from);

      const node = this.nodes.get(from);
      if (!node) return false;

      for (const wireId of node.outputs) {
        const wire = this.wires.get(wireId);
        if (wire && hasPath(wire.targetId, to)) {
          return true;
        }
      }
      return false;
    };

    return hasPath(targetId, sourceId);
  }

  // ═══════════════════════════════════════════════════════════════
  // Execution
  // ═══════════════════════════════════════════════════════════════

  /**
   * Execute the entire pipeline
   */
  async executeAll() {
    const order = this._getTopologicalOrder();

    for (const nodeId of order) {
      const node = this.nodes.get(nodeId);
      if (node && node.state !== ExecutionState.SUCCESS) {
        await this._executeNode(node);
      }
    }

    if (this.onExecutionComplete) {
      this.onExecutionComplete(this);
    }
  }

  /**
   * Execute from a specific node downstream
   */
  async executeFrom(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Get downstream nodes in order
    const downstream = this._getDownstreamNodes(nodeId);
    const toExecute = [nodeId, ...downstream];

    for (const id of toExecute) {
      const n = this.nodes.get(id);
      if (n) {
        await this._executeNode(n);
      }
    }

    if (this.onExecutionComplete) {
      this.onExecutionComplete(this);
    }
  }

  /**
   * Execute a single node
   */
  async _executeNode(node) {
    node.setRunning();
    this._notifyChange();

    try {
      // Get input values
      const inputs = this._getInputValues(node);

      // Execute based on type
      let result;
      switch (node.type) {
        case DataFlowNodeType.SET:
          result = await this._execSet(node);
          break;
        case DataFlowNodeType.LENS:
          result = await this._execLens(node);
          break;
        case DataFlowNodeType.FOCUS:
          result = await this._execFocus(node);
          break;
        case DataFlowNodeType.IMPORT:
          result = await this._execImport(node);
          break;
        case DataFlowNodeType.FILTER:
          result = await this._execFilter(node, inputs);
          break;
        case DataFlowNodeType.JOIN:
          result = await this._execJoin(node, inputs);
          break;
        case DataFlowNodeType.TRANSFORM:
          result = await this._execTransform(node, inputs);
          break;
        case DataFlowNodeType.SELECT:
          result = await this._execSelect(node, inputs);
          break;
        case DataFlowNodeType.HANDLE_NULLS:
          result = await this._execHandleNulls(node, inputs);
          break;
        case DataFlowNodeType.BRANCH:
          result = await this._execBranch(node, inputs);
          break;
        case DataFlowNodeType.CODE:
          result = await this._execCode(node, inputs);
          break;
        case DataFlowNodeType.AGGREGATE:
          result = await this._execAggregate(node, inputs);
          break;
        case DataFlowNodeType.PREVIEW:
          result = await this._execPreview(node, inputs);
          break;
        case DataFlowNodeType.SAVE:
          result = await this._execSave(node, inputs);
          break;
        case DataFlowNodeType.EXPORT:
          result = await this._execExport(node, inputs);
          break;
        case DataFlowNodeType.AI_ACTION:
          result = await this._execAIAction(node, inputs);
          break;
        default:
          result = inputs;
      }

      node.setSuccess(result);
    } catch (err) {
      node.setError(err);
    }

    this._notifyChange();
  }

  /**
   * Get input values for a node
   */
  _getInputValues(node) {
    const values = [];

    for (const wireId of node.inputs) {
      const wire = this.wires.get(wireId);
      if (wire) {
        const source = this.nodes.get(wire.sourceId);
        if (source && source.cachedValue !== null) {
          values.push({
            value: source.cachedValue,
            port: wire.sourcePort
          });
        }
      }
    }

    // Single input returns value directly
    if (values.length === 1) return values[0].value;
    // Multiple inputs returns array
    if (values.length > 1) return values.map(v => v.value);
    // No inputs
    return null;
  }

  /**
   * Queue execution (for auto mode)
   */
  _queueExecution(nodeId) {
    if (!this._executionQueue.includes(nodeId)) {
      this._executionQueue.push(nodeId);
    }

    if (!this._isExecuting) {
      this._processQueue();
    }
  }

  /**
   * Process execution queue
   */
  async _processQueue() {
    if (this._isExecuting || this._executionQueue.length === 0) return;

    this._isExecuting = true;

    try {
      while (this._executionQueue.length > 0) {
        const nodeId = this._executionQueue.shift();
        await this.executeFrom(nodeId);
      }
    } finally {
      this._isExecuting = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Node Type Executors
  // ═══════════════════════════════════════════════════════════════

  /**
   * Execute SET node
   */
  async _execSet(node) {
    const { setId } = node.config;
    if (!setId) throw new Error('No Set selected');
    if (!this.workbench) throw new Error('No workbench connected');

    const set = this.workbench.sets?.find(s => s.id === setId);
    if (!set) throw new Error(`Set not found: ${setId}`);

    let records = set.records || [];

    // Apply temporal filtering if available
    if (this.eventStore && this.currentTimestamp) {
      records = this._filterByTimestamp(records, this.currentTimestamp);
    }

    return records;
  }

  /**
   * Execute LENS node
   */
  async _execLens(node) {
    const { lensId } = node.config;
    if (!lensId) throw new Error('No Lens selected');
    if (!this.workbench) throw new Error('No workbench connected');

    // Find lens and its parent set
    for (const set of (this.workbench.sets || [])) {
      const lens = set.lenses?.find(l => l.id === lensId);
      if (lens) {
        let records = set.records || [];

        // Apply lens filters
        if (lens.config?.filters) {
          for (const filter of lens.config.filters) {
            records = this._applyFilter(records, filter);
          }
        }

        return records;
      }
    }

    throw new Error(`Lens not found: ${lensId}`);
  }

  /**
   * Execute FOCUS node
   */
  async _execFocus(node) {
    const { recordId, setId } = node.config;
    if (!recordId) throw new Error('No record ID specified');

    // Find record across sets
    for (const set of (this.workbench?.sets || [])) {
      if (setId && set.id !== setId) continue;

      const record = (set.records || []).find(r => r.id === recordId);
      if (record) return record;
    }

    throw new Error(`Record not found: ${recordId}`);
  }

  /**
   * Execute IMPORT node
   */
  async _execImport(node) {
    const { data } = node.config;
    if (!data) throw new Error('No data imported');
    return Array.isArray(data) ? data : [data];
  }

  /**
   * Execute FILTER node (SEG operator)
   */
  async _execFilter(node, input) {
    if (!Array.isArray(input)) return input;

    const { field, operator, value, conditions, logic } = node.config;

    // Single condition
    if (!conditions || conditions.length === 0) {
      if (!field) return input;
      return input.filter(r => this._evaluateCondition(r, field, operator, value));
    }

    // Multiple conditions
    return input.filter(r => {
      const results = conditions.map(c =>
        this._evaluateCondition(r, c.field, c.operator, c.value)
      );

      return logic === 'OR'
        ? results.some(Boolean)
        : results.every(Boolean);
    });
  }

  /**
   * Evaluate a single filter condition
   */
  _evaluateCondition(record, field, operator, value) {
    const values = record.values || record;
    const fieldValue = values[field];

    switch (operator) {
      case 'eq': return fieldValue == value;
      case 'ne': return fieldValue != value;
      case 'gt': return Number(fieldValue) > Number(value);
      case 'lt': return Number(fieldValue) < Number(value);
      case 'gte': return Number(fieldValue) >= Number(value);
      case 'lte': return Number(fieldValue) <= Number(value);
      case 'contains': return String(fieldValue || '').toLowerCase().includes(String(value).toLowerCase());
      case 'startsWith': return String(fieldValue || '').startsWith(value);
      case 'endsWith': return String(fieldValue || '').endsWith(value);
      case 'isEmpty': return fieldValue == null || fieldValue === '';
      case 'isNotEmpty': return fieldValue != null && fieldValue !== '';
      case 'between':
        const [min, max] = String(value).split(',').map(Number);
        const num = Number(fieldValue);
        return num >= min && num <= max;
      default: return true;
    }
  }

  /**
   * Execute JOIN node (CON operator)
   */
  async _execJoin(node, input) {
    if (!Array.isArray(input)) return input;

    const { targetSetId, joinField, joinType } = node.config;
    if (!targetSetId || !joinField) return input;

    const targetSet = this.workbench?.sets?.find(s => s.id === targetSetId);
    if (!targetSet) throw new Error(`Target set not found: ${targetSetId}`);

    const targetRecords = targetSet.records || [];

    return input.map(record => {
      const values = record.values || record;
      const joinValue = values[joinField];

      const matches = targetRecords.filter(tr => {
        const tv = tr.values || tr;
        return tv[joinField] === joinValue;
      });

      // Left join includes records even without matches
      if (joinType === 'left' || matches.length > 0) {
        return {
          ...record,
          _joined: matches.length > 0 ? matches : null,
          _joinedCount: matches.length
        };
      }

      return null; // Inner join excludes non-matching
    }).filter(Boolean);
  }

  /**
   * Execute TRANSFORM node (ALT operator)
   */
  async _execTransform(node, input) {
    const { field, expression, operation } = node.config;

    if (Array.isArray(input)) {
      return input.map(record => this._transformRecord(record, field, expression, operation));
    }

    return this._transformRecord(input, field, expression, operation);
  }

  /**
   * Transform a single record
   */
  _transformRecord(record, field, expression, operation) {
    if (!record) return record;

    const values = record.values ? { ...record.values } : { ...record };

    if (operation === 'multiply' && field) {
      values[field] = Number(values[field]) * Number(expression);
    } else if (operation === 'add' && field) {
      values[field] = Number(values[field]) + Number(expression);
    } else if (operation === 'map' && expression) {
      // Simple expression: replace $ with field value
      try {
        const val = field ? values[field] : values;
        const expr = expression.replace(/\$/g, JSON.stringify(val));
        values[field || '_result'] = Function('"use strict"; return (' + expr + ')')();
      } catch (e) {
        // Keep original on error
      }
    }

    return record.values ? { ...record, values } : values;
  }

  /**
   * Execute SELECT node (DES operator)
   */
  async _execSelect(node, input) {
    if (!Array.isArray(input)) return input;

    const { fields, renames } = node.config;
    if (!fields || fields.length === 0) return input;

    return input.map(record => {
      const values = record.values || record;
      const selected = {};

      for (const field of fields) {
        const outputName = renames?.[field] || field;
        selected[outputName] = values[field];
      }

      return record.values ? { ...record, values: selected } : selected;
    });
  }

  /**
   * Execute HANDLE_NULLS node (NUL operator)
   */
  async _execHandleNulls(node, input) {
    const { strategy, defaultValue, perField } = node.config;

    const handleValue = (val, field) => {
      const fieldDefault = perField?.[field];
      const def = fieldDefault !== undefined ? fieldDefault : defaultValue;

      if (val === null || val === undefined || val === '') {
        if (strategy === 'remove') return undefined;
        return def;
      }
      return val;
    };

    if (Array.isArray(input)) {
      if (strategy === 'remove') {
        return input.filter(r => {
          const values = r.values || r;
          return Object.values(values).every(v => v != null && v !== '');
        });
      }

      return input.map(record => {
        const values = record.values || record;
        const handled = {};
        for (const [key, val] of Object.entries(values)) {
          const result = handleValue(val, key);
          if (result !== undefined) handled[key] = result;
        }
        return record.values ? { ...record, values: handled } : handled;
      });
    }

    return handleValue(input) ?? defaultValue;
  }

  /**
   * Execute BRANCH node
   */
  async _execBranch(node, input) {
    // Branch returns the input but sets up routing for downstream
    // The actual branching is handled by wire port checking
    const { field, operator, value } = node.config;

    if (Array.isArray(input)) {
      const trueRecords = [];
      const falseRecords = [];

      for (const record of input) {
        if (this._evaluateCondition(record, field, operator, value)) {
          trueRecords.push(record);
        } else {
          falseRecords.push(record);
        }
      }

      // Store branched results for downstream routing
      node._branchResults = { true: trueRecords, false: falseRecords };
      return input; // Return all for preview
    }

    const matches = this._evaluateCondition(input, field, operator, value);
    node._branchResults = { true: matches ? input : null, false: matches ? null : input };
    return input;
  }

  /**
   * Execute CODE node
   */
  async _execCode(node, input) {
    const { code } = node.config;
    if (!code) return input;

    try {
      // Create a sandboxed function
      const fn = new Function('input', 'records', code);
      return fn(input, Array.isArray(input) ? input : [input]);
    } catch (e) {
      throw new Error(`Code error: ${e.message}`);
    }
  }

  /**
   * Execute AGGREGATE node (SYN operator)
   */
  async _execAggregate(node, input) {
    const { function: fn, field, groupBy } = node.config;
    const records = Array.isArray(input) ? input : [input];

    // Extract numeric values
    const getValues = (recs) => {
      if (!field) return recs;
      return recs.map(r => {
        const vals = r.values || r;
        return vals[field];
      });
    };

    const aggregate = (values) => {
      const nums = values.map(Number).filter(n => !isNaN(n));

      switch (fn) {
        case 'SUM': return nums.reduce((a, b) => a + b, 0);
        case 'COUNT': return values.length;
        case 'AVG': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        case 'MIN': return nums.length ? Math.min(...nums) : null;
        case 'MAX': return nums.length ? Math.max(...nums) : null;
        case 'FIRST': return values[0] ?? null;
        case 'LAST': return values[values.length - 1] ?? null;
        default: return values;
      }
    };

    // Group by field
    if (groupBy) {
      const groups = {};
      for (const record of records) {
        const vals = record.values || record;
        const groupKey = vals[groupBy] ?? '__null__';
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(record);
      }

      return Object.entries(groups).map(([key, recs]) => ({
        [groupBy]: key === '__null__' ? null : key,
        [field ? `${fn.toLowerCase()}_${field}` : 'result']: aggregate(getValues(recs))
      }));
    }

    return aggregate(getValues(records));
  }

  /**
   * Execute PREVIEW node
   */
  async _execPreview(node, input) {
    const { maxRecords } = node.config;
    if (Array.isArray(input)) {
      return input.slice(0, maxRecords || 100);
    }
    return input;
  }

  /**
   * Execute SAVE node
   */
  async _execSave(node, input) {
    // Placeholder - actual save would integrate with workbench
    const { targetSetId, createNew, setName } = node.config;

    if (!input) throw new Error('No data to save');

    // In real implementation, would create/update Set
    console.log('Save:', { targetSetId, createNew, setName, recordCount: Array.isArray(input) ? input.length : 1 });

    return input;
  }

  /**
   * Execute EXPORT node
   */
  async _execExport(node, input) {
    const { format, fileName } = node.config;
    const records = Array.isArray(input) ? input : [input];

    if (format === 'csv') {
      const rows = records.map(r => r.values || r);
      if (rows.length === 0) return '';

      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(','),
        ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
      ].join('\n');

      return csv;
    }

    if (format === 'json') {
      return JSON.stringify(records, null, 2);
    }

    return input;
  }

  /**
   * Execute AI_ACTION node
   */
  async _execAIAction(node, input) {
    // Placeholder for AI integration
    const { action, prompt, outputField } = node.config;

    // Would integrate with AI service
    console.log('AI Action:', { action, prompt, recordCount: Array.isArray(input) ? input.length : 1 });

    // Return input with placeholder result
    if (Array.isArray(input)) {
      return input.map(r => ({
        ...r,
        [outputField]: `[AI ${action} pending]`
      }));
    }

    return { ...input, [outputField]: `[AI ${action} pending]` };
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════

  /**
   * Filter records by timestamp
   */
  _filterByTimestamp(records, timestamp) {
    return records.filter(r => {
      const createdAt = r.createdAt || r._pipeline?.createdAt;
      if (createdAt && new Date(createdAt).getTime() > timestamp) {
        return false;
      }
      return true;
    });
  }

  /**
   * Apply a filter config to records
   */
  _applyFilter(records, filter) {
    return records.filter(r =>
      this._evaluateCondition(r, filter.field, filter.operator, filter.value)
    );
  }

  /**
   * Propagate stale state downstream
   */
  _propagateStale(nodeId, visited = new Set()) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = this.nodes.get(nodeId);
    if (!node) return;

    for (const wireId of node.outputs) {
      const wire = this.wires.get(wireId);
      if (wire) {
        const target = this.nodes.get(wire.targetId);
        if (target && target.markStale()) {
          this._propagateStale(wire.targetId, visited);
        }
      }
    }
  }

  /**
   * Get topological order
   */
  _getTopologicalOrder() {
    const visited = new Set();
    const order = [];

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) return;

      // Visit inputs first
      for (const wireId of node.inputs) {
        const wire = this.wires.get(wireId);
        if (wire) visit(wire.sourceId);
      }

      order.push(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    return order;
  }

  /**
   * Get downstream nodes
   */
  _getDownstreamNodes(nodeId) {
    const downstream = [];
    const visited = new Set([nodeId]);

    const collect = (id) => {
      const node = this.nodes.get(id);
      if (!node) return;

      for (const wireId of node.outputs) {
        const wire = this.wires.get(wireId);
        if (wire && !visited.has(wire.targetId)) {
          visited.add(wire.targetId);
          downstream.push(wire.targetId);
          collect(wire.targetId);
        }
      }
    };

    collect(nodeId);
    return downstream;
  }

  /**
   * Notify change
   */
  _notifyChange() {
    if (this.onChange) {
      this.onChange(this);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Temporal Control
  // ═══════════════════════════════════════════════════════════════

  /**
   * Set current timestamp and mark nodes stale
   */
  setTimestamp(timestamp) {
    if (this.currentTimestamp === timestamp) return;

    this.currentTimestamp = timestamp;

    // Mark all source nodes stale
    for (const node of this.nodes.values()) {
      if (node.isSource()) {
        node.markStale();
        this._propagateStale(node.id);
      }
    }

    if (this.runMode === 'auto') {
      this._debounceExecute();
    }
  }

  /**
   * Debounced execution for smooth scrubbing
   */
  _debounceExecute() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      this.executeAll();
    }, 50);
  }

  // ═══════════════════════════════════════════════════════════════
  // Serialization
  // ═══════════════════════════════════════════════════════════════

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      currentTimestamp: this.currentTimestamp,
      timelineStart: this.timelineStart,
      timelineEnd: this.timelineEnd,
      runMode: this.runMode,
      nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
      wires: Array.from(this.wires.values()).map(w => w.toJSON()),
      keyframes: this.keyframes
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json, options = {}) {
    const pipeline = new DataFlowPipeline({
      id: json.id,
      name: json.name,
      timestamp: json.currentTimestamp,
      timelineStart: json.timelineStart,
      timelineEnd: json.timelineEnd,
      runMode: json.runMode,
      ...options
    });

    // Restore nodes
    for (const nodeJson of (json.nodes || [])) {
      const node = DataFlowNode.fromJSON(nodeJson);
      pipeline.nodes.set(node.id, node);
    }

    // Restore wires
    for (const wireJson of (json.wires || [])) {
      const wire = DataFlowWire.fromJSON(wireJson);
      pipeline.wires.set(wire.id, wire);

      const source = pipeline.nodes.get(wire.sourceId);
      const target = pipeline.nodes.get(wire.targetId);
      if (source) source.outputs.push(wire.id);
      if (target) target.inputs.push(wire.id);
    }

    pipeline.keyframes = json.keyframes || [];

    return pipeline;
  }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof window !== 'undefined') {
  window.DataFlowCategory = DataFlowCategory;
  window.DataFlowNodeType = DataFlowNodeType;
  window.NodeTypeCategory = NodeTypeCategory;
  window.DataFlowNodeLabels = DataFlowNodeLabels;
  window.DataFlowNodeIcons = DataFlowNodeIcons;
  window.CategoryColors = CategoryColors;
  window.CategoryMeta = CategoryMeta;
  window.ExecutionState = ExecutionState;
  window.DataFlowNode = DataFlowNode;
  window.DataFlowWire = DataFlowWire;
  window.DataFlowPipeline = DataFlowPipeline;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DataFlowCategory,
    DataFlowNodeType,
    NodeTypeCategory,
    DataFlowNodeLabels,
    DataFlowNodeIcons,
    CategoryColors,
    CategoryMeta,
    ExecutionState,
    DataFlowNode,
    DataFlowWire,
    DataFlowPipeline
  };
}
