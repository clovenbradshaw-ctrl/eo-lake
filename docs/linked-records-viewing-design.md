# Intelligent Linked Records Viewing System

## Overview

EO-Lake's Intelligent Linked Records system provides advanced capabilities for viewing, navigating, and understanding relationships between records. Our event-sourced, local-first architecture enables features that would be prohibitively expensive in traditional systems.

---

## Implementation Architecture

### Core Components

```
eo_linked_records.js
├── LinkResolutionService     - Core link resolution and caching
├── LinkedRecordViewer        - UI rendering and interaction handling
└── LinkedRecordsDocViewer    - In-app documentation viewer
```

### Key Files

| File | Purpose |
|------|---------|
| `eo_linked_records.js` | Core linked records functionality |
| `eo_styles.css` | CSS styles for linked record UI components |
| `eo_data_workbench.js` | Integration with workbench rendering |
| `index.html` | Help button and script loading |

---

## Features

### 1. Enhanced Link Chips

Link chips now display:
- **Health indicator** - Color-coded status icon
- **Primary value** - The linked record's name
- **Expand button** - Toggle inline expansion

```javascript
renderLinkChip(linkedId, field, parentRecord)
```

### 2. Link Health Indicators

Visual status for each link:

| Status | Icon | Color | Meaning |
|--------|------|-------|---------|
| Active | `ph-check-circle` | Green | Record exists and accessible |
| Archived | `ph-archive` | Yellow | Record exists but archived |
| Orphaned | `ph-warning-circle` | Red | Reference exists but record deleted |
| Restricted | `ph-lock` | Purple | Outside current horizon |

### 3. Inline Expansion

Click the expand button on any link chip to see:
- Preview fields from the linked record
- Backlinks (records that link to this one)
- Navigation and graph view buttons

```javascript
renderInlineExpansion(linkedId, setId)
```

### 4. Automatic Backlink Discovery

Unlike traditional databases requiring explicit reverse-link fields, EO-Lake automatically discovers all records that link to any given record:

```javascript
findBacklinks(recordId, setId)
// Returns: [{ set, records, count }, ...]
```

Backlinks are grouped by source set with counts and appear in:
- Inline expansion panels
- Record detail panel
- Full backlinks panel view

### 5. Multi-Hop Relationship Traversal

Explore relationship chains with configurable depth:

```
Customer → Orders → Products → Suppliers
```

```javascript
traverseLinks(record, set, depth = 2, visited = new Set())
// Returns: LinkTree { record, set, primaryValue, children, isLeaf, isCycle }
```

Features:
- Cycle detection with visual indicators
- Expandable/collapsible tree nodes
- Depth control (1-5 levels)

### 6. Hover Previews

Hovering over a link chip shows a quick preview popup with:
- Record title
- Source set name
- Top 3 preview fields

### 7. Graph Visualization

View relationships as an interactive network graph:
- Nodes represent records
- Edges represent links
- Color-coded by set
- Radial layout from focused record

### 8. Provenance Tracking

For EO-compliant systems, link provenance is available:

```javascript
getLinkProvenance(recordId, fieldId, linkedId)
// Returns: { eventId, timestamp, actor, type, mode, provenance }
```

### 9. Aggregate Statistics

Compute statistics across linked records:

```javascript
computeAggregates(record, set)
// Returns: { totalLinks, linksBySet, backlinks, backlinksBySet }
```

---

## Schema-First Limitations That DON'T Affect Us

| Traditional Problem | EO-Lake Solution |
|---------------------|------------------|
| **N+1 Query Problem** | All data is local (IndexedDB). O(1) lookups per record. |
| **Schema Migration Pain** | Event-sourced with append-only log. Schema is interpretation. |
| **Circular References** | Graph-based with visited-set tracking. Cycles detected. |
| **Deep Nesting Performance** | O(1) access per entity. 100+ levels without degradation. |
| **Cross-Schema Queries** | All Sets in same namespace. LINK references any Set. |
| **Orphaned Reference Errors** | Graceful degradation shows ID with warning icon. |
| **Permission Complexity** | Horizon Lattice provides natural scope boundaries. |

---

## Usage Guide

### Creating Link Fields

1. Add a new field to your set
2. Select "Link to record" as the field type
3. Choose which set to link to
4. Optionally enable "Allow multiple" for many-to-many

### Viewing Linked Records

- **Hover** over a link chip for quick preview
- **Click expand button** (▼) for inline details
- **Click link text** to navigate to that record
- **Click graph icon** to see relationship visualization

### Finding Backlinks

Backlinks appear automatically in:
- Expanded link views
- Record detail panel (right sidebar)
- Show which records reference the current one

### Relationship Traversal

In the record detail panel:
1. Look for "Relationship Tree" section
2. Expand/collapse nodes to explore
3. Adjust depth slider for more levels
4. Click any node to navigate

### Accessing Documentation

Click the floating link button (bottom-right) to open the in-app documentation viewer.

---

## CSS Classes Reference

### Link Chips
- `.link-chip.enhanced` - Enhanced link chip container
- `.link-health-indicator` - Health status icon
- `.link-chip-text` - Link display text
- `.link-expand-btn` - Expand/collapse button

### Expansion Panel
- `.link-expansion` - Expansion container
- `.link-expansion-header` - Header with title and actions
- `.link-expansion-body` - Content area
- `.preview-fields` - Grid of preview fields
- `.link-backlinks` - Backlinks section

### Backlinks
- `.backlinks-panel` - Full backlinks panel
- `.backlink-set-group` - Grouped by source set
- `.backlink-record-item` - Individual backlink entry
- `.backlink-chip` - Inline backlink badge

### Traversal
- `.traversal-view` - Traversal container
- `.traversal-tree` - Tree structure
- `.tree-node` - Individual tree node
- `.tree-branch` - Child branch connector
- `.cycle-indicator` - Circular reference warning

### Graph
- `.relationship-graph` - Graph container
- `.graph-svg` - SVG element
- `.graph-node` - Node group

### Documentation
- `.docs-viewer-overlay` - Modal overlay
- `.docs-viewer` - Documentation panel
- `.docs-toc` - Table of contents
- `.docs-content` - Main content area

---

## API Reference

### LinkResolutionService

```javascript
const service = new LinkResolutionService(workbench);

// Resolve a link
const resolved = service.resolveLink(recordId, setId);

// Find backlinks
const backlinks = service.findBacklinks(recordId, setId);

// Traverse links
const tree = service.traverseLinks(record, set, depth);

// Get provenance
const provenance = service.getLinkProvenance(recordId, fieldId, linkedId);

// Compute aggregates
const stats = service.computeAggregates(record, set);

// Clear caches
service.clearCache();
```

### LinkedRecordViewer

```javascript
const viewer = new LinkedRecordViewer(workbench);

// Render components
const chipHtml = viewer.renderLinkChip(linkedId, field, parentRecord);
const expansionHtml = viewer.renderInlineExpansion(linkedId, setId);
const backlinksHtml = viewer.renderBacklinksPanel(record, set);
const traversalHtml = viewer.renderTraversalView(record, set, maxDepth);
const graphHtml = viewer.renderRelationshipGraph(record, set, container);

// Attach event listeners
viewer.attachEventListeners(container);
```

### Global Functions

```javascript
// Initialize system
const viewer = initLinkedRecords(workbench);

// Get instances
const viewer = getLinkedRecordViewer();
const docs = getLinkDocsViewer();

// Toggle documentation
toggleLinkedRecordsDocs();
```

---

## Integration Points

### Workbench Initialization

```javascript
// In EODataWorkbench.init()
this._initLinkedRecords();
```

### Cell Rendering

```javascript
// In _renderCell() for LINK fields
if (this.linkedRecordViewer) {
  content += this.linkedRecordViewer.renderLinkChip(linkedId, field, record);
}
```

### Event Listeners

```javascript
// After table rendering
if (this.linkedRecordViewer) {
  this.linkedRecordViewer.attachEventListeners(this.container);
}
```

### Detail Panel

```javascript
// In _showRecordDetail()
backlinksHtml = this.linkedRecordViewer.renderBacklinksPanel(record, set);
traversalHtml = this.linkedRecordViewer.renderTraversalView(record, set, 2);
```

---

## Performance Considerations

### Caching

- Link resolution cached for 5 seconds
- Backlink discovery cached separately
- Cache cleared on data changes

### Lazy Loading

- Expansion panels render on demand
- Tree nodes expand incrementally
- Graph builds only visible nodes

### Memory Efficiency

- Visited sets prevent infinite loops
- Depth limits prevent excessive traversal
- Stale cache entries auto-expire

---

## Future Enhancements

1. **Link Analytics** - Relationship density heatmaps
2. **Smart Suggestions** - AI-powered link recommendations
3. **Bulk Link Operations** - Multi-select linking
4. **Link History Timeline** - Visual history of relationship changes
5. **Cross-Workspace Links** - Links spanning horizon boundaries
6. **Link Templates** - Predefined relationship patterns
