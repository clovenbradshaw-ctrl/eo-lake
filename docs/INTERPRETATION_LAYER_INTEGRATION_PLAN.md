# Interpretation Layer Integration Plan

## Overview

This plan outlines the integration of a formal **Interpretation Layer** into eo-lake that binds dataset columns to versioned semantic URIs. The layer enforces the EO principle:

> **Datasets never "contain" meaning. They reference interpretation records, which reference semantic URIs.**

This builds on eo-lake's existing architecture:
- `StructuralSchema` / `SemanticSchema` split in `eo_ontology.js`
- 9-element provenance system in `eo_provenance.js`
- Append-only event store in `eo_event_store.js`
- Import system in `eo_import.js`

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        Import JSON                              │
│  { dataset, schema_semantics[], interpretation }                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 1: Raw Ingest                          │
│  - Parse file, detect columns                                   │
│  - Create Given event with structural schema                    │
│  - Dataset stored (immutable)                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                Phase 2: Interpretation Setup                    │
│  - Load/create SchemaSemantic entities                          │
│  - Call suggestion APIs (Wikidata, QUDT)                        │
│  - User selects or creates semantic meaning                     │
│  - Create InterpretationBinding                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Phase 3: Dataset Linking                        │
│  - Update dataset metadata with semantic + interpretation refs  │
│  - Raw data remains unchanged                                   │
│  - Emit INTERPRETATION_BOUND event                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Entities

### 1.1 Create `eo_schema_semantic.js`

**Purpose**: Define and manage versioned semantic definitions for columns.

**Location**: `/home/user/eo-lake/eo_schema_semantic.js`

**Entity Structure**:
```javascript
/**
 * SchemaSemantic - Column meaning object (independent of any dataset)
 *
 * @typedef {Object} SchemaSemantic
 * @property {string} id - URI format: "eo://schema/column/{slug}/v{version}"
 * @property {string} term - Canonical term name
 * @property {string} definition - Human-readable definition
 * @property {string} jurisdiction - Authority (e.g., "WMO", "ISO", "internal")
 * @property {string} scale - Scope (site, region, global, etc.)
 * @property {string} timeframe - Temporal scope (instantaneous, period, open-ended)
 * @property {string[]} background - Assumed conditions, known confounders
 * @property {string[]} aligned_uris - External URIs (Wikidata, QUDT, etc.)
 * @property {number} version - Schema version (incremented on changes)
 * @property {string} status - "draft" | "provisional" | "stable" | "deprecated"
 * @property {string} created_at - ISO timestamp
 * @property {string} created_by - Agent who created this
 */
```

**Required Functions**:
```javascript
// Factory
createSchemaSemantic(options) → SchemaSemantic
generateSemanticId(term, version) → string

// Validation
validateSchemaSemantic(semantic) → { valid: boolean, errors: string[] }
checkVersionConflict(existing, updated) → boolean

// Storage (via event store)
saveSchemaSemantic(semantic) → Event
loadSchemaSemantic(id) → SchemaSemantic | null
loadSchemaSemanticByTerm(term) → SchemaSemantic[]
getAllSchemaSemantics() → SchemaSemantic[]

// Versioning
createNewVersion(existingId, changes) → SchemaSemantic
getVersionHistory(term) → SchemaSemantic[]
getLatestVersion(term) → SchemaSemantic | null

// URI utilities
parseSemanticUri(uri) → { term: string, version: number }
isValidSemanticUri(uri) → boolean
```

**Event Categories** (add to `eo_event_store.js`):
```javascript
EventCategory = {
  // ... existing categories
  SCHEMA_SEMANTIC_CREATED: 'schema_semantic_created',
  SCHEMA_SEMANTIC_VERSIONED: 'schema_semantic_versioned',
  SCHEMA_SEMANTIC_DEPRECATED: 'schema_semantic_deprecated'
}
```

---

### 1.2 Create `eo_interpretation_binding.js`

**Purpose**: Bind dataset columns to semantic meanings with interpretive context.

**Location**: `/home/user/eo-lake/eo_interpretation_binding.js`

**Entity Structure**:
```javascript
/**
 * InterpretationBinding - Links dataset columns to semantic URIs
 *
 * @typedef {Object} InterpretationBinding
 * @property {string} id - Unique binding ID (e.g., "interp_{dataset_id}_{timestamp}")
 * @property {string} agent - Who created this interpretation (e.g., "user:alice")
 * @property {string} method - How binding was created ("manual_binding", "api_suggested", etc.)
 * @property {string} source_dataset - Dataset ID being interpreted
 * @property {ColumnBinding[]} bindings - Array of column-to-semantic bindings
 * @property {string} jurisdiction - Authority context
 * @property {string} scale - Scope context
 * @property {string} timeframe - Temporal context
 * @property {string[]} background - Interpretive assumptions
 * @property {string} created_at - ISO timestamp
 * @property {string} supersedes - Previous binding ID (if revision)
 */

/**
 * ColumnBinding - Single column to semantic URI mapping
 *
 * @typedef {Object} ColumnBinding
 * @property {string} column - Column name in dataset
 * @property {string} semantic_uri - Reference to SchemaSemantic ID
 * @property {string} confidence - "high" | "medium" | "low" | "provisional"
 * @property {string} [notes] - Optional interpretive notes
 */
```

**Required Functions**:
```javascript
// Factory
createInterpretationBinding(options) → InterpretationBinding
generateBindingId(datasetId) → string

// Validation
validateInterpretationBinding(binding) → { valid: boolean, errors: string[] }
validateColumnBinding(columnBinding, availableSemantics) → { valid: boolean, errors: string[] }
checkConflictingBindings(bindings) → string[] // Returns conflicting columns

// Storage (via event store)
saveInterpretationBinding(binding) → Event
loadInterpretationBinding(id) → InterpretationBinding | null
loadBindingsForDataset(datasetId) → InterpretationBinding[]

// Operations
addColumnBinding(bindingId, columnBinding) → InterpretationBinding
removeColumnBinding(bindingId, column) → InterpretationBinding
supersedBinding(oldBindingId, newBinding) → InterpretationBinding

// Query
getBindingsByAgent(agent) → InterpretationBinding[]
getBindingsBySemantic(semanticUri) → InterpretationBinding[]
findUnboundColumns(datasetId) → string[]
```

**Event Categories**:
```javascript
EventCategory = {
  // ... existing categories
  INTERPRETATION_CREATED: 'interpretation_created',
  INTERPRETATION_UPDATED: 'interpretation_updated',
  INTERPRETATION_SUPERSEDED: 'interpretation_superseded',
  COLUMN_BOUND: 'column_bound',
  COLUMN_UNBOUND: 'column_unbound'
}
```

---

### 1.3 Update Dataset Metadata Schema

**Location**: Update `eo_ontology.js` and `eo_import.js`

**Extended Dataset Metadata**:
```javascript
/**
 * DatasetSemanticMetadata - Semantic references for dataset columns
 *
 * @typedef {Object} DatasetSemanticMetadata
 * @property {Object.<string, ColumnSemanticRef>} columns - Map of column name to refs
 */

/**
 * ColumnSemanticRef - References for a single column
 *
 * @typedef {Object} ColumnSemanticRef
 * @property {string} semantic_ref - URI to SchemaSemantic
 * @property {string} interpretation_ref - ID of InterpretationBinding
 */
```

**Update SourceConfig** (in `eo_ontology.js`):
```javascript
class SourceConfig {
  // ... existing fields
  semanticMetadata: DatasetSemanticMetadata | null
}
```

---

## Phase 2: Suggestion Services

### 2.1 Create `eo_semantic_suggestions.js`

**Purpose**: Non-binding lookup services for external semantic URIs.

**Location**: `/home/user/eo-lake/eo_semantic_suggestions.js`

**Suggestion Response Structure**:
```javascript
/**
 * SemanticSuggestion - Candidate from external source
 *
 * @typedef {Object} SemanticSuggestion
 * @property {string} candidate_uri - External URI
 * @property {string} label - Human-readable label
 * @property {string} description - Definition/description
 * @property {string} source - "wikidata" | "qudt" | "internal"
 * @property {string[]} warnings - Validation warnings
 * @property {Object} raw_data - Original API response (for debugging)
 */
```

**Required Functions**:
```javascript
// Wikidata Integration
searchWikidata(term) → Promise<SemanticSuggestion[]>
getWikidataEntity(qid) → Promise<SemanticSuggestion>

// QUDT Integration
searchQUDT(term) → Promise<SemanticSuggestion[]>
getQUDTQuantity(uri) → Promise<SemanticSuggestion>

// Unified Search
searchAllSources(term) → Promise<SemanticSuggestion[]>
rankSuggestions(suggestions, context) → SemanticSuggestion[]

// Validation
validateSuggestion(suggestion) → string[] // Returns warnings
checkJurisdictionAlignment(suggestion, requiredJurisdiction) → boolean

// Caching
getCachedSuggestion(uri) → SemanticSuggestion | null
cacheSuggestion(uri, suggestion, ttl) → void
clearSuggestionCache() → void
```

**API Endpoints**:
```javascript
// Wikidata Search API
const WIKIDATA_SEARCH = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&search=';
const WIKIDATA_ENTITY = 'https://www.wikidata.org/wiki/Special:EntityData/';

// QUDT SPARQL Endpoint
const QUDT_SPARQL = 'https://qudt.org/sparql';
```

**Warning Types**:
```javascript
const SuggestionWarnings = {
  JURISDICTION_UNSPECIFIED: 'jurisdiction_unspecified',
  SCALE_UNKNOWN: 'scale_unknown',
  DEFINITION_MISSING: 'definition_missing',
  DEPRECATED_ENTITY: 'deprecated_entity',
  MULTIPLE_DEFINITIONS: 'multiple_definitions'
};
```

---

## Phase 3: Import System Updates

### 3.1 Update `eo_import.js`

**New Import Format Support**:
```javascript
/**
 * EO-Aware JSON Import Format
 *
 * @typedef {Object} EOAwareImport
 * @property {Object} dataset - Dataset with id, source, ingested_at, data[]
 * @property {SchemaSemantic[]} schema_semantics - Semantic definitions
 * @property {InterpretationBinding} interpretation - Column bindings
 */
```

**New Functions**:
```javascript
// Import parsing
parseEOAwareJSON(content) → EOAwareImport
detectImportFormat(content) → 'eo_aware' | 'standard' | 'csv' | 'xlsx'

// Validation
validateEOAwareImport(parsed) → { valid: boolean, errors: string[], warnings: string[] }
validateSemanticReferences(interpretation, semantics) → string[]
validateAgentPresence(interpretation) → boolean

// Import execution
importEOAwareJSON(content, options) → Promise<ImportResult>
importSchemaSemantics(semantics) → Promise<SchemaSemantic[]>
importInterpretation(interpretation, datasetId) → Promise<InterpretationBinding>
linkDatasetSemantics(datasetId, interpretationId) → Promise<void>
```

**Validation Rules** (from spec):
```javascript
const ImportValidationRules = {
  // Reject if:
  REJECT_MISSING_AGENT: 'interpretation present but agent is missing',
  REJECT_UNDEFINED_SEMANTIC: 'semantic_uri referenced but not defined',
  REJECT_CONFLICTING_BINDINGS: 'column has multiple conflicting bindings',
  REJECT_VERSION_MISMATCH: 'semantic definition changed without version bump',

  // Warn if:
  WARN_MISSING_JURISDICTION: 'jurisdiction not specified',
  WARN_MISSING_SCALE: 'scale not specified',
  WARN_EMPTY_BACKGROUND: 'background assumptions empty'
};
```

---

### 3.2 Update Import Workflow

**Modified `processImport()` in `eo_import.js`**:

```javascript
async function processImport(file, options) {
  const content = await readFile(file);
  const format = detectImportFormat(content);

  if (format === 'eo_aware') {
    return processEOAwareImport(content, options);
  }

  // ... existing import logic for other formats
}

async function processEOAwareImport(content, options) {
  // Phase 1: Parse and validate
  const parsed = parseEOAwareJSON(content);
  const validation = validateEOAwareImport(parsed);

  if (!validation.valid) {
    throw new ImportValidationError(validation.errors);
  }

  // Phase 2: Import schema semantics (create or reference)
  const semantics = await importSchemaSemantics(parsed.schema_semantics);

  // Phase 3: Import raw dataset
  const datasetEvent = await importDataset(parsed.dataset, options);

  // Phase 4: Create interpretation binding
  const binding = await importInterpretation(
    parsed.interpretation,
    datasetEvent.payload.id
  );

  // Phase 5: Link dataset to interpretation
  await linkDatasetSemantics(datasetEvent.payload.id, binding.id);

  // Phase 6: Emit completion event
  emitEvent(EventCategory.IMPORT_COMPLETED, {
    datasetId: datasetEvent.payload.id,
    interpretationId: binding.id,
    semanticCount: semantics.length,
    warnings: validation.warnings
  });

  return {
    dataset: datasetEvent.payload,
    interpretation: binding,
    semantics: semantics,
    warnings: validation.warnings
  };
}
```

---

## Phase 4: UI Components

### 4.1 Create `eo_interpretation_panel.js`

**Purpose**: UI for viewing and editing column interpretations.

**Location**: `/home/user/eo-lake/eo_interpretation_panel.js`

**Panel Structure**:
```
┌────────────────────────────────────────────────────────────┐
│  Column Interpretation                              [×]    │
├────────────────────────────────────────────────────────────┤
│  Dataset: ds_weather_station_042                           │
│  Columns: 3 bound, 1 unbound                               │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Column: temp                                         │  │
│  │ Semantic: surface_air_temperature v1         [Edit] │  │
│  │ Confidence: high                                     │  │
│  │ Definition: Air temperature measured 2m above...    │  │
│  │ Jurisdiction: WMO                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Column: humidity                            [Unbnd] │  │
│  │ [Search suggestions...]                              │  │
│  └──────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────┤
│  Interpretation Context                                    │
│  Agent: user:alice                                         │
│  Method: manual_binding                                    │
│  Created: 2025-01-30T12:04:00Z                             │
│  Jurisdiction: WMO | Scale: site | Timeframe: instant      │
└────────────────────────────────────────────────────────────┘
```

**Required Functions**:
```javascript
// Panel lifecycle
createInterpretationPanel(datasetId) → HTMLElement
destroyInterpretationPanel(panelId) → void
refreshInterpretationPanel(panelId) → void

// Column binding UI
renderColumnBinding(column, binding, semantic) → HTMLElement
renderUnboundColumn(column, suggestions) → HTMLElement
renderSemanticSelector(suggestions, onSelect) → HTMLElement

// Suggestion UI
renderSuggestionSearch(column, onSearch) → HTMLElement
renderSuggestionResults(suggestions) → HTMLElement
renderSuggestionCard(suggestion) → HTMLElement

// Context UI
renderInterpretationContext(binding) → HTMLElement
renderProvenanceTriad(binding) → HTMLElement // Uses existing provenance labels

// Actions
handleBindColumn(column, semanticUri, confidence) → Promise<void>
handleUnbindColumn(column) → Promise<void>
handleCreateSemantic(term, definition, options) → Promise<SchemaSemantic>
```

---

### 4.2 Create `eo_semantic_browser.js`

**Purpose**: Browse and manage schema semantics.

**Location**: `/home/user/eo-lake/eo_semantic_browser.js`

**Browser Structure**:
```
┌────────────────────────────────────────────────────────────┐
│  Schema Semantics                              [+ New]     │
├────────────────────────────────────────────────────────────┤
│  Search: [________________] [All] [Stable] [Draft]         │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │ surface_air_temperature v1                  [stable] │  │
│  │ Air temperature measured 2m above ground...          │  │
│  │ Jurisdiction: WMO | Used by: 5 datasets              │  │
│  │ Aligned: Wikidata Q11466, QUDT AirTemperature        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ relative_humidity v2                        [stable] │  │
│  │ Water vapor pressure as fraction of saturation...    │  │
│  │ Jurisdiction: WMO | Used by: 3 datasets              │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**Required Functions**:
```javascript
// Browser lifecycle
createSemanticBrowser() → HTMLElement
destroySemanticBrowser() → void

// Listing
renderSemanticList(semantics, filter) → HTMLElement
renderSemanticCard(semantic, usageCount) → HTMLElement
filterSemantics(semantics, query, status) → SchemaSemantic[]

// Detail view
renderSemanticDetail(semantic) → HTMLElement
renderVersionHistory(term) → HTMLElement
renderUsageList(semanticUri) → HTMLElement

// Create/Edit
renderSemanticForm(existing?) → HTMLElement
handleSemanticSubmit(formData) → Promise<SchemaSemantic>

// Utilities
getSemanticUsageCount(semanticUri) → number
exportSemanticAsJSON(semantic) → string
```

---

### 4.3 Update Import Modal

**Location**: Update `eo_import.js` modal components

**New Import Workflow UI**:

```
┌────────────────────────────────────────────────────────────┐
│  Import Dataset                                    [×]     │
├────────────────────────────────────────────────────────────┤
│  Step 1: Upload File                              ✓        │
│  Step 2: Structural Schema                        ✓        │
│  Step 3: Column Interpretation                    ← You    │
│  Step 4: Review & Import                                   │
├────────────────────────────────────────────────────────────┤
│  Detected Columns (3)                                      │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │ timestamp                              [Skip]      │    │
│  │ Inferred type: datetime                            │    │
│  │ [ ] Assign semantic meaning                        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │ temp                                               │    │
│  │ Inferred type: number                              │    │
│  │ [×] Assign semantic meaning                        │    │
│  │     Search: [temperature________] [Search]         │    │
│  │     Suggestions:                                   │    │
│  │     ○ surface_air_temperature v1 (internal)        │    │
│  │     ○ Q11466 - temperature (Wikidata)              │    │
│  │     ○ AirTemperature (QUDT)                        │    │
│  │     [+ Create new semantic]                        │    │
│  └────────────────────────────────────────────────────┘    │
├────────────────────────────────────────────────────────────┤
│  Interpretation Context                                    │
│  Agent: user:current_session                               │
│  Jurisdiction: [____________] ⚠ Required                   │
│  Scale: [site ▼]                                           │
│  Timeframe: [instantaneous ▼]                              │
│  Background: [outdoor_sensor, calibrated_2024]             │
├────────────────────────────────────────────────────────────┤
│                            [Back] [Continue to Review]     │
└────────────────────────────────────────────────────────────┘
```

---

## Phase 5: Event Store Updates

### 5.1 Update `eo_event_store.js`

**New Event Categories**:
```javascript
const EventCategory = {
  // ... existing categories

  // Schema Semantic events
  SCHEMA_SEMANTIC_CREATED: 'schema_semantic_created',
  SCHEMA_SEMANTIC_VERSIONED: 'schema_semantic_versioned',
  SCHEMA_SEMANTIC_DEPRECATED: 'schema_semantic_deprecated',

  // Interpretation events
  INTERPRETATION_CREATED: 'interpretation_created',
  INTERPRETATION_UPDATED: 'interpretation_updated',
  INTERPRETATION_SUPERSEDED: 'interpretation_superseded',
  COLUMN_BOUND: 'column_bound',
  COLUMN_UNBOUND: 'column_unbound',

  // Suggestion events (for audit trail)
  SUGGESTION_SEARCHED: 'suggestion_searched',
  SUGGESTION_SELECTED: 'suggestion_selected',
  SUGGESTION_REJECTED: 'suggestion_rejected'
};
```

**New IndexedDB Indexes** (add to persistence layer):
```javascript
// In IndexedDBBackend.init()
const eventStore = db.createObjectStore('events', { keyPath: 'id' });
// ... existing indexes
eventStore.createIndex('semantic_uri', 'payload.semantic_uri', { unique: false });
eventStore.createIndex('interpretation_id', 'payload.interpretation_id', { unique: false });
```

---

### 5.2 Update `eo_grounding.js`

**New Grounding Kind**:
```javascript
const GroundingKind = {
  // ... existing kinds
  SEMANTIC: 'semantic'  // Already exists, but ensure it's used for interpretation bindings
};
```

**Interpretation Grounding Pattern**:
```javascript
// When creating an InterpretationBinding, its grounding should be:
{
  references: [
    { eventId: '<dataset_event_id>', kind: GroundingKind.STRUCTURAL },
    { eventId: '<semantic_event_id>', kind: GroundingKind.SEMANTIC }
  ],
  derivation: {
    operators: ['INTERPRET'],
    inputs: ['<dataset_id>', '<semantic_uri>'],
    frozenParams: {
      agent: '<agent>',
      method: '<method>'
    }
  }
}
```

---

## Phase 6: Integration Points

### 6.1 Update `eo_provenance.js`

**Link 9-Element Provenance to Interpretation**:

The existing provenance system already captures most interpretation context. Map the fields:

| Provenance Element | InterpretationBinding Field |
|-------------------|---------------------------|
| agent | agent |
| method | method |
| source | source_dataset |
| term | semantic_uri (via lookup) |
| definition | semantic_uri (via lookup) |
| jurisdiction | jurisdiction |
| scale | scale |
| timeframe | timeframe |
| background | background |

**New Function**:
```javascript
// Convert InterpretationBinding to provenance format
interpretationToProvenance(binding, semantics) → ProvenanceData {
  return {
    agent: binding.agent,
    method: binding.method,
    source: binding.source_dataset,
    term: semantics.term,
    definition: semantics.definition,
    jurisdiction: binding.jurisdiction || semantics.jurisdiction,
    scale: binding.scale || semantics.scale,
    timeframe: binding.timeframe || semantics.timeframe,
    background: [...binding.background, ...semantics.background]
  };
}
```

---

### 6.2 Update `eo_source_provenance.js`

**Link Source Provenance to Semantics**:

Add semantic reference capability to source-level provenance:

```javascript
// Extend SourceProvenance to include semantic links
class SourceProvenance {
  // ... existing fields

  // New field
  semantic_bindings: {
    column: string,
    semantic_uri: string,
    interpretation_id: string
  }[]
}
```

---

### 6.3 Update `eo_compliance.js`

**New Compliance Rules**:

```javascript
const InterpretationComplianceRules = {
  // Rule I1: Interpretations must have agents
  RULE_I1: {
    name: 'Agent Required',
    check: (binding) => !!binding.agent,
    error: 'InterpretationBinding requires an agent'
  },

  // Rule I2: Semantic URIs must resolve
  RULE_I2: {
    name: 'Semantic Resolution',
    check: (binding, semantics) =>
      binding.bindings.every(b => semantics.has(b.semantic_uri)),
    error: 'All semantic_uri references must resolve to existing SchemaSemantic'
  },

  // Rule I3: No conflicting bindings
  RULE_I3: {
    name: 'No Conflicts',
    check: (binding) => {
      const columns = binding.bindings.map(b => b.column);
      return new Set(columns).size === columns.length;
    },
    error: 'Column has multiple conflicting bindings'
  },

  // Rule I4: Version integrity
  RULE_I4: {
    name: 'Version Integrity',
    check: (newSemantic, existingSemantic) =>
      !existingSemantic || newSemantic.version > existingSemantic.version,
    error: 'Semantic definition changed without version bump'
  }
};
```

---

## Phase 7: Export Updates

### 7.1 Update `eo_export.js`

**New Export Format**:
```javascript
// Add EO-aware export capability
async function exportEOAwareJSON(datasetId, options) {
  const dataset = await loadDataset(datasetId);
  const interpretation = await loadBindingsForDataset(datasetId);
  const semanticUris = interpretation?.bindings.map(b => b.semantic_uri) || [];
  const semantics = await Promise.all(semanticUris.map(loadSchemaSemantic));

  return {
    dataset: {
      id: dataset.id,
      source: dataset.source,
      ingested_at: dataset.ingested_at,
      data: dataset.records
    },
    schema_semantics: semantics.filter(Boolean),
    interpretation: interpretation
  };
}
```

---

## Implementation Order

### Week 1: Core Entities
1. [ ] Create `eo_schema_semantic.js` with full entity and storage
2. [ ] Create `eo_interpretation_binding.js` with full entity and storage
3. [ ] Update `eo_event_store.js` with new event categories
4. [ ] Add IndexedDB indexes for semantic queries
5. [ ] Write unit tests for validation functions

### Week 2: Suggestion Services
1. [ ] Create `eo_semantic_suggestions.js`
2. [ ] Implement Wikidata search integration
3. [ ] Implement QUDT SPARQL integration
4. [ ] Add response caching
5. [ ] Write integration tests for APIs

### Week 3: Import System
1. [ ] Update `eo_import.js` with EO-aware format detection
2. [ ] Implement `parseEOAwareJSON()` and validation
3. [ ] Implement `processEOAwareImport()` workflow
4. [ ] Update import modal UI with interpretation step
5. [ ] Write end-to-end import tests

### Week 4: UI Components
1. [ ] Create `eo_interpretation_panel.js`
2. [ ] Create `eo_semantic_browser.js`
3. [ ] Update import modal with suggestion UI
4. [ ] Add interpretation panel to data workbench
5. [ ] Polish UI and add loading states

### Week 5: Integration & Testing
1. [ ] Update `eo_provenance.js` integration
2. [ ] Update `eo_compliance.js` with new rules
3. [ ] Update `eo_export.js` with EO-aware format
4. [ ] Update `index.html` with new script includes
5. [ ] End-to-end testing and bug fixes

---

## File Changes Summary

### New Files
- `eo_schema_semantic.js` - Schema semantic entity and storage
- `eo_interpretation_binding.js` - Interpretation binding entity and storage
- `eo_semantic_suggestions.js` - External API integrations
- `eo_interpretation_panel.js` - Column interpretation UI
- `eo_semantic_browser.js` - Schema semantics browser UI

### Modified Files
- `eo_event_store.js` - New event categories
- `eo_persistence.js` - New IndexedDB indexes
- `eo_ontology.js` - Dataset semantic metadata
- `eo_import.js` - EO-aware import format
- `eo_export.js` - EO-aware export format
- `eo_provenance.js` - Interpretation to provenance mapping
- `eo_compliance.js` - Interpretation compliance rules
- `eo_grounding.js` - Interpretation grounding pattern
- `eo_styles.css` - New component styles
- `index.html` - Script includes for new modules

---

## Validation Checklist

Before marking complete, verify:

- [ ] `SchemaSemantic` entities can be created, versioned, and deprecated
- [ ] `InterpretationBinding` entities correctly link columns to semantics
- [ ] Datasets store only references, never definitions
- [ ] Suggestion APIs return normalized candidates
- [ ] Import validation rejects invalid formats per rules
- [ ] Import validation warns on missing optional fields
- [ ] No automatic binding occurs (all manual with agent)
- [ ] Interpretation panel shows definition preview
- [ ] Semantic browser lists all semantics with usage counts
- [ ] Export produces valid EO-aware JSON
- [ ] Event log captures all interpretation operations
- [ ] Grounding chains trace back correctly

---

## Test Data

Sample EO-aware import for testing:

```json
{
  "dataset": {
    "id": "ds_weather_station_042",
    "source": "weather_station_alpha",
    "ingested_at": "2025-01-30T11:42:00Z",
    "data": [
      { "timestamp": "2025-01-29T12:00:00Z", "temp": 14.2, "humidity": 0.61 },
      { "timestamp": "2025-01-29T13:00:00Z", "temp": 15.1, "humidity": 0.58 },
      { "timestamp": "2025-01-29T14:00:00Z", "temp": 16.3, "humidity": 0.54 }
    ]
  },
  "schema_semantics": [
    {
      "id": "eo://schema/column/surface_air_temperature/v1",
      "term": "surface_air_temperature",
      "definition": "Air temperature measured 2m above ground, shielded from direct radiation.",
      "jurisdiction": "WMO",
      "scale": "site",
      "timeframe": "instantaneous",
      "background": ["sensor_height_2m", "shielded"],
      "aligned_uris": [
        "https://www.wikidata.org/entity/Q11466",
        "http://qudt.org/vocab/quantitykind/AirTemperature"
      ],
      "version": 1,
      "status": "stable"
    },
    {
      "id": "eo://schema/column/relative_humidity/v1",
      "term": "relative_humidity",
      "definition": "Water vapor pressure as fraction of saturation pressure at current temperature.",
      "jurisdiction": "WMO",
      "scale": "site",
      "timeframe": "instantaneous",
      "background": ["sensor_height_2m"],
      "aligned_uris": ["https://www.wikidata.org/entity/Q170088"],
      "version": 1,
      "status": "stable"
    }
  ],
  "interpretation": {
    "id": "interp_weather_station_042",
    "agent": "user:alice",
    "method": "manual_binding",
    "bindings": [
      {
        "column": "temp",
        "semantic_uri": "eo://schema/column/surface_air_temperature/v1",
        "confidence": "high"
      },
      {
        "column": "humidity",
        "semantic_uri": "eo://schema/column/relative_humidity/v1",
        "confidence": "high"
      }
    ],
    "jurisdiction": "WMO",
    "scale": "site",
    "timeframe": "instantaneous",
    "background": ["outdoor_sensor", "calibrated_2024"]
  }
}
```
