# EO Lake Feature Roadmap

## Overview

This roadmap identifies features from the [eo-activibase](https://github.com/clovenbradshaw-ctrl/eo-activibase) reference implementation that are not yet present in EO Lake, organized by priority and complexity.

---

## Current Capabilities (Already Implemented)

EO Lake currently includes:
- Event Sourcing with Given/Meant distinction
- Append-only event log with compliance checking (9 Rules)
- Horizon-based perspectival access control
- Data Workbench with 16 field types
- Multiple view types (Table, Cards, Kanban, Calendar, Graph)
- Local-first persistence (IndexedDB + localStorage fallback)
- Sync protocol infrastructure (Bloom filters, protocol messages)
- Basic graph visualization with force-directed layouts
- Event bus for reactive updates

---

## Phase 1: Memory & Performance Optimization
**Priority: HIGH | Complexity: MEDIUM**

### 1.1 Lean Context System
**Status:** Not Implemented

The lean context system provides memory-efficient context management:

- [ ] **Context Templates**: Store reusable context templates once, reference via IDs
- [ ] **String Interning**: Common strings stored once with ID references
- [ ] **Delta-Only Storage**: Field-specific context overrides store only differences
- [ ] **Lazy Computation**: On-demand stability calculations and scale inference
- [ ] **Compact Event History**: Abbreviated keys and numeric timestamps
- [ ] **Scale Detection**: Infer organizational hierarchy levels from records
- [ ] **Stability Tracking**: Cache stability tags (emerging/forming/stable)
- [ ] **Storage Metrics**: Estimate memory consumption across templates

**New File:** `eo_lean_context.js`

### 1.2 Memory Optimization Module
**Status:** Not Implemented

Advanced memory management applying EO theory operators:

- [ ] **MemoryAwareLRUCache**: LRU cache with size limits and WeakRef for large objects
- [ ] **LazyDataWindow**: Sliding window pagination (SEG operator)
- [ ] **DerivedValueCache**: Memoization with dependency tracking and cascade invalidation
- [ ] **UnifiedEventLog**: Single source of truth for logging (eliminates duplication)
- [ ] **SparseGraphIndex**: Lazy-built graph indexes computed on-demand
- [ ] **MemoryMonitor**: Heap tracking with cleanup callbacks at thresholds
- [ ] **Debounce/Throttle Utilities**: Performance helpers

**New File:** `eo_memory_optimization.js`

---

## Phase 2: Content Management & Deduplication
**Priority: HIGH | Complexity: HIGH**

### 2.1 Content-Addressable Storage
**Status:** Not Implemented

Efficient storage with automatic deduplication:

- [ ] **Content Hashing**: DJB2-based content-addressable storage
- [ ] **Exact Duplicate Detection**: Hash-based duplicate finding
- [ ] **Delta Encoding**: Store only differences for similar records (>70% similarity)
- [ ] **Reference Counting**: Garbage collection for unused content
- [ ] **Field-Level Deduplication**: Analyze deduplication per field across imports
- [ ] **Compression Metrics**: Calculate and display storage savings
- [ ] **Cross-Import Analysis**: Identify duplicates spanning multiple imports
- [ ] **Import/Export State**: Persist and restore storage state

**New File:** `eo_content_store.js`

### 2.2 Deduplication UI
**Status:** Not Implemented

Visual feedback for deduplication effectiveness:

- [ ] **Compression Gauge**: Circular progress showing space saved percentage
- [ ] **Stat Cards**: Grid display of deduplication metrics
- [ ] **Storage Breakdown Chart**: Stacked bar visualization of record types
- [ ] **Field Deduplication Table**: Sortable breakdown by field with visual bars
- [ ] **Import-Level Stats**: Per-import compression and efficiency badges
- [ ] **Global Storage Panel**: Aggregate statistics across all imports

**New File:** `eo_deduplication_ui.js`

---

## Phase 3: Discovery & Search
**Priority: MEDIUM | Complexity: MEDIUM**

### 3.1 Zero-Input Discovery System
**Status:** Not Implemented

Content surfacing without user queries:

- [ ] **Recent Items Tracking**: Surface recently accessed entities from event stream
- [ ] **Frequency Analysis**: Count field usage to identify popular fields
- [ ] **New & Updated Tracking**: Highlight changes within configurable time windows
- [ ] **Multi-Entity Resolution**: Cross-type entity discovery (Sets, Views, Records, Fields)
- [ ] **Structural Analysis**: Identify semantically-defined and connected fields
- [ ] **Data Quality Metrics**: Sparsity rates, unique value ratios, large dataset flags
- [ ] **Comprehensive Search**: Cross-entity search with category filtering
- [ ] **Browsable Categories**: Type-specific browsing with pagination

**New File:** `eo_discovery.js`

---

## Phase 4: Structural Operations
**Priority: MEDIUM | Complexity: HIGH**

### 4.1 Data Transformation Engine
**Status:** Not Implemented

Record and field-level operations with provenance:

**Record Operations:**
- [ ] **Dedupe Records**: Signature-based duplicate detection (exact/fuzzy)
- [ ] **Merge Records**: Combine records with configurable resolution strategies
- [ ] **Split Records**: Divide records into multiple with field inheritance

**Field Operations:**
- [ ] **Merge Fields**: Consolidate fields into canonical field across all records
- [ ] **Field Harmonization**: Ensure new fields appear in all set views

**Infrastructure:**
- [ ] **Operation Tracking**: First-class operation entities with metadata
- [ ] **Full Provenance**: Mark original records as superseded/split
- [ ] **Result Views**: Auto-generate views showing operation inputs/outputs
- [ ] **Resolution Strategies**: First, last, longest, concatenate, numeric ops, date-based
- [ ] **Operation Reversal**: Support for undoing structural operations

**New File:** `eo_structural_operations.js`

---

## Phase 5: Advanced Provenance
**Priority: MEDIUM | Complexity: MEDIUM**

### 5.1 Automatic Provenance Extraction
**Status:** Not Implemented

4-tier metadata extraction from imports:

**Tier 1 - Silent Auto-Extraction:**
- [ ] File metadata (size, modification date, encoding)
- [ ] Filename pattern analysis
- [ ] Embedded comments detection

**Tier 2 - Confident Inferences:**
- [ ] Source system detection (Salesforce, Stripe, QuickBooks, HubSpot, etc.)
- [ ] Compliance framework identification (GAAP, IFRS, SOX, GDPR, HIPAA)
- [ ] Jurisdiction inference

**Tier 3 - High-Value User Input:**
- [ ] Conceptual frame prompts
- [ ] Authority level assessment
- [ ] Trust rating collection

**Tier 4 - Column-Level Analysis:**
- [ ] Field definition extraction
- [ ] Method inference
- [ ] External system linkage detection

**Technical Features:**
- [ ] Header Analysis Caching (100-item limit)
- [ ] Early-Exit Pattern Matching
- [ ] Value Shape Analysis (cardinality, types, patterns)
- [ ] Confidence Scoring (0-1 scale)

**New File:** `eo_provenance_extractor.js`

---

## Phase 6: Advanced Graph Visualization
**Priority: LOW | Complexity: HIGH**

### 6.1 Enhanced Graph Rendering
**Status:** Partially Implemented (basic exists, advanced features missing)

Performance and interaction improvements:

- [ ] **Quadtree/Barnes-Hut**: O(n log n) physics calculations
- [ ] **Multiple Node Shapes**: Circles, ellipses, rectangles, diamonds, stars
- [ ] **Operator-Aware Edges**: Solid, dashed, dotted, double lines per operator
- [ ] **Directional Arrows**: Edge direction indicators
- [ ] **Operator Palette UI**: Edge type selection interface
- [ ] **Double-Click Edge Creation**: Interactive edge creation between nodes
- [ ] **25-Position EO Framework**: Full realm and operator visualization
- [ ] **Enhanced Info Panel**: Detailed node/edge metadata display

**Update File:** `eo_graph.js` + new `eo_graph_visualization.js`

---

## Phase 7: Layout & Window Management
**Priority: LOW | Complexity: MEDIUM**

### 7.1 Multi-Pane Layout System
**Status:** Not Implemented

Sophisticated workspace layouts:

- [ ] **Pane Management**: Tabbed containers for content organization
- [ ] **Split Operations**: Horizontal/vertical splits with adjustable ratios
- [ ] **Tab Movement**: Drag tabs between panes
- [ ] **Portal Windows**: Pop-out tabs to separate browser windows
- [ ] **Layout Presets**: Save and restore layout configurations
- [ ] **Event Stream Integration**: Layout changes recorded for reconstruction
- [ ] **Focus Management**: Track active pane and portal windows
- [ ] **Auto-Collapse**: Remove empty panes automatically

**New File:** `eo_layout_management.js`

---

## Phase 8: Sync Rules & Compliance
**Priority: LOW | Complexity: LOW**

### 8.1 Extended Sync Compliance Rules
**Status:** Partially Implemented (basic compliance exists)

Additional sync-specific rules:

- [ ] **AXIOM_0 Enforcement**: Explicit log primacy validation
- [ ] **Identity Collapse Prevention**: Origin retention validation
- [ ] **Space Collapse Prevention**: Concurrent event preservation
- [ ] **Time Collapse Prevention**: Event transmission (not state reconstruction)
- [ ] **Compliance Levels**: 4-tier (0-3) escalating requirements
- [ ] **Validation Helpers**: Origin completeness and Meant event checks
- [ ] **Rule Query Tools**: Lookup by ID, category, or severity

**New File:** `eo_sync_rules.js`

---

## Implementation Priority Summary

| Phase | Feature Area | Priority | Effort | Dependencies |
|-------|-------------|----------|--------|--------------|
| 1 | Memory Optimization | HIGH | Medium | None |
| 2 | Content Store & Deduplication | HIGH | High | None |
| 3 | Discovery System | MEDIUM | Medium | Phase 2 |
| 4 | Structural Operations | MEDIUM | High | Phase 2 |
| 5 | Provenance Extraction | MEDIUM | Medium | None |
| 6 | Advanced Graph Viz | LOW | High | Phase 1 |
| 7 | Layout Management | LOW | Medium | None |
| 8 | Extended Sync Rules | LOW | Low | None |

---

## Quick Wins (Can be implemented independently)

1. **String Interning** - Immediate memory savings
2. **MemoryAwareLRUCache** - Drop-in performance improvement
3. **Compression Gauge UI** - Visual feedback for users
4. **Recent Items Tracking** - Improved UX with minimal code
5. **Debounce/Throttle Utilities** - Reusable performance helpers

---

## Breaking Changes Considerations

- **Content Store**: May require data migration for existing events
- **Lean Context**: Event format changes for compact storage
- **Structural Operations**: New event types for operation tracking
- **Layout Management**: Additional state to persist

---

## Documentation Needs

Each phase should include:
- [ ] API documentation
- [ ] Integration guide
- [ ] Migration guide (if breaking changes)
- [ ] Performance benchmarks
- [ ] Test coverage

---

## Metrics for Success

| Feature | Key Metric | Target |
|---------|-----------|--------|
| Memory Optimization | Heap usage reduction | 40-60% |
| Content Deduplication | Storage savings | 30-50% for similar data |
| Discovery | Time to first relevant result | < 100ms |
| Structural Operations | Operation reliability | 100% reversible |
| Graph Visualization | Render time for 1000 nodes | < 500ms |

---

*Last Updated: December 2024*
*Reference: eo-activibase repository analysis*
