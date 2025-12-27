# Plan: Migrate Graph Visualization to Cytoscape.js

## Executive Summary

This plan outlines the migration of two custom graph implementations to Cytoscape.js, a mature and feature-rich graph visualization library. The migration will improve performance, maintainability, and provide advanced features out of the box.

---

## Current State Analysis

### Existing Implementations

| Component | File | Lines | Renderer | Purpose |
|-----------|------|-------|----------|---------|
| EOGraph | `eo_graph.js` | ~1,100 | HTML5 Canvas | Experience Engine events visualization |
| Record Graph | `eo_data_workbench.js` | ~540 (3790-4330) | SVG | Record relationships visualization |

### Current Data Structures

**Nodes:**
```javascript
// eo_graph.js - GraphNode class (lines 49-99)
{
  id: string,
  type: 'given' | 'meant' | 'entity' | 'horizon',
  data: object,
  x, y: number,           // Position
  vx, vy: number,         // Velocity
  fx, fy: number | null,  // Fixed position (dragging)
  visible: boolean,
  selected: boolean,
  highlighted: boolean
}

// Computed: label, color, radius
```

**Edges:**
```javascript
// eo_graph.js - GraphEdge class (lines 104-132)
{
  id: string,              // '{source}-{target}-{type}'
  source: string,
  target: string,
  type: 'provenance' | 'supersedes' | 'parent' | 'entity_source' | 'graph_data',
  visible: boolean,
  highlighted: boolean
}

// Computed: color, dashArray
```

### Current Layouts
1. **Force-Directed** (`ForceLayout`, lines 137-235) - Custom physics simulation
2. **Hierarchical** (`HierarchicalLayout`, lines 240-323) - BFS-based level assignment
3. **Timeline** (`TimelineLayout`, lines 328-380) - Horizontal time-based arrangement
4. **Grid** (workbench only) - Simple grid positioning
5. **Circular** (workbench only) - Radial arrangement

### Current Features
- Zoom (mouse wheel, 0.1x - 5x)
- Pan (drag empty space)
- Node dragging
- Node selection and highlighting
- Node double-click callbacks
- Visibility filtering (by node/edge type)
- Legend display
- Export to PNG

---

## Migration Strategy

### Phase 1: Setup and Foundation
1. Add Cytoscape.js dependency
2. Create shared utility functions for data conversion
3. Create base Cytoscape configuration

### Phase 2: EOGraph Migration (eo_graph.js)
1. Replace Canvas rendering with Cytoscape
2. Migrate node/edge data structures
3. Implement layouts using Cytoscape extensions
4. Migrate interaction handlers
5. Maintain API compatibility

### Phase 3: Workbench Graph Migration (eo_data_workbench.js)
1. Replace SVG rendering with Cytoscape
2. Reuse shared utilities from Phase 2
3. Migrate toolbar controls

### Phase 4: Enhancement and Optimization
1. Add new Cytoscape-specific features
2. Performance optimization
3. Testing and refinement

---

## Detailed Implementation Plan

### Phase 1: Setup and Foundation

#### Step 1.1: Add Cytoscape.js Dependency

**Option A: CDN (Recommended for this project)**
```html
<!-- Add to index.html before eo_graph.js -->
<script src="https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js"></script>

<!-- Layout extensions -->
<script src="https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js"></script>
<script src="https://unpkg.com/dagre@0.8.5/dist/dagre.min.js"></script>
<script src="https://unpkg.com/cytoscape-cola@2.5.1/cytoscape-cola.js"></script>
```

**Option B: NPM (if build system exists)**
```bash
npm install cytoscape cytoscape-dagre cytoscape-cola
```

#### Step 1.2: Create Cytoscape Utility Module

Create `eo_graph_cytoscape.js`:

```javascript
/**
 * Cytoscape.js utilities for EO Graph
 * Converts between EO data structures and Cytoscape format
 */

// Convert GraphNode to Cytoscape node format
function nodeToCytoscape(node) {
  return {
    data: {
      id: node.id,
      label: node.label,
      nodeType: node.type,
      originalData: node.data,
      // Colors as data for styling
      color: getNodeColor(node.type),
      radius: getNodeRadius(node.type)
    },
    classes: [node.type, node.selected ? 'selected' : '', node.highlighted ? 'highlighted' : '']
      .filter(Boolean).join(' '),
    position: { x: node.x || 0, y: node.y || 0 }
  };
}

// Convert GraphEdge to Cytoscape edge format
function edgeToCytoscape(edge) {
  return {
    data: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      edgeType: edge.type,
      color: getEdgeColor(edge.type),
      lineStyle: getEdgeLineStyle(edge.type)
    },
    classes: edge.type
  };
}

// Color mappings (from existing code)
function getNodeColor(type) {
  const colors = {
    given: '#00ba7c',
    meant: '#7856ff',
    entity: '#1d9bf0',
    horizon: '#ffad1f'
  };
  return colors[type] || '#8b98a5';
}

function getNodeRadius(type) {
  const radii = { horizon: 24, entity: 16 };
  return radii[type] || 12;
}

function getEdgeColor(type) {
  const colors = {
    provenance: '#00ba7c',
    supersedes: '#f4212e',
    parent: '#6e7a88',
    entity_source: '#1d9bf0',
    graph_data: '#1d9bf0'
  };
  return colors[type] || '#38444d';
}

function getEdgeLineStyle(type) {
  return type === 'supersedes' ? 'dashed' :
         type === 'horizon_contains' ? 'dotted' : 'solid';
}
```

#### Step 1.3: Define Cytoscape Stylesheet

```javascript
const cytoscapeStylesheet = [
  // Base node style
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      'background-opacity': 0.5,
      'border-width': 1,
      'border-color': 'data(color)',
      'width': 'data(radius)',
      'height': 'data(radius)',
      'label': 'data(label)',
      'font-size': '10px',
      'color': '#e7e9ea',
      'text-valign': 'bottom',
      'text-margin-y': 4,
      'text-max-width': '80px',
      'text-wrap': 'ellipsis'
    }
  },

  // Node type-specific styles
  {
    selector: 'node.given',
    style: {
      'background-color': '#00ba7c',
      'border-color': '#00ba7c'
    }
  },
  {
    selector: 'node.meant',
    style: {
      'background-color': '#7856ff',
      'border-color': '#7856ff'
    }
  },
  {
    selector: 'node.entity',
    style: {
      'background-color': '#1d9bf0',
      'border-color': '#1d9bf0'
    }
  },
  {
    selector: 'node.horizon',
    style: {
      'background-color': '#ffad1f',
      'border-color': '#ffad1f',
      'width': 48,
      'height': 48
    }
  },

  // Selected state
  {
    selector: 'node.selected, node:selected',
    style: {
      'background-color': '#ffffff',
      'border-width': 3
    }
  },

  // Highlighted (hover) state
  {
    selector: 'node.highlighted, node:active',
    style: {
      'background-opacity': 1
    }
  },

  // Base edge style
  {
    selector: 'edge',
    style: {
      'width': 1,
      'line-color': 'data(color)',
      'target-arrow-color': 'data(color)',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'opacity': 0.6
    }
  },

  // Dashed edges (supersedes)
  {
    selector: 'edge.supersedes',
    style: {
      'line-style': 'dashed',
      'line-color': '#f4212e'
    }
  },

  // Highlighted edge
  {
    selector: 'edge.highlighted, edge:active',
    style: {
      'width': 2,
      'opacity': 1
    }
  }
];
```

---

### Phase 2: EOGraph Migration

#### Step 2.1: Refactor EOGraph Class

Replace the rendering logic while preserving the public API:

```javascript
class EOGraph {
  constructor(container, app) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    this.app = app;

    // Data storage (keep for compatibility)
    this.nodes = new Map();
    this.edges = [];

    // Cytoscape instance
    this.cy = null;

    // State
    this.selectedNode = null;
    this.layout = LayoutType.FORCE;

    // Visibility filters
    this.showGiven = true;
    this.showMeant = true;
    this.showProvenance = true;
    this.showSupersession = true;
    this.showParents = false;

    // Callbacks
    this.onNodeSelect = null;
    this.onNodeDoubleClick = null;
  }

  init() {
    if (!this.container) {
      console.error('EOGraph: Container not found');
      return;
    }

    // Initialize Cytoscape
    this.cy = cytoscape({
      container: this.container,
      style: cytoscapeStylesheet,
      layout: { name: 'preset' }, // Start with preset, apply layout after data

      // Interaction settings
      minZoom: 0.1,
      maxZoom: 5,
      wheelSensitivity: 0.2,
      boxSelectionEnabled: false,

      // Performance
      textureOnViewport: true,
      hideEdgesOnViewport: true
    });

    // Set up event handlers
    this._setupCytoscapeEvents();

    // Build from app data
    this.buildFromApp();

    return this;
  }

  _setupCytoscapeEvents() {
    // Node selection
    this.cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      this.selectedNode = this._getNodeById(node.id());
      if (this.onNodeSelect) {
        this.onNodeSelect(this.selectedNode);
      }
    });

    // Node double-click
    this.cy.on('dbltap', 'node', (evt) => {
      const node = evt.target;
      const graphNode = this._getNodeById(node.id());
      if (this.onNodeDoubleClick) {
        this.onNodeDoubleClick(graphNode);
      }
    });

    // Hover effects
    this.cy.on('mouseover', 'node', (evt) => {
      evt.target.addClass('highlighted');
    });

    this.cy.on('mouseout', 'node', (evt) => {
      evt.target.removeClass('highlighted');
    });

    // Click on background to deselect
    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy) {
        this.selectedNode = null;
        this.cy.elements().removeClass('selected');
      }
    });
  }

  buildFromApp() {
    // ... existing buildFromApp logic to populate this.nodes and this.edges ...

    // Convert to Cytoscape format
    this._updateCytoscapeGraph();
  }

  _updateCytoscapeGraph() {
    if (!this.cy) return;

    // Clear existing elements
    this.cy.elements().remove();

    // Convert nodes
    const cyNodes = [];
    for (const node of this.nodes.values()) {
      if (!node.visible) continue;
      cyNodes.push(nodeToCytoscape(node));
    }

    // Convert edges
    const cyEdges = [];
    for (const edge of this.edges) {
      if (!edge.visible) continue;
      cyEdges.push(edgeToCytoscape(edge));
    }

    // Add to Cytoscape
    this.cy.add(cyNodes);
    this.cy.add(cyEdges);

    // Apply layout
    this.applyLayout();
  }

  applyLayout() {
    const layoutOptions = this._getLayoutOptions(this.layout);
    this.cy.layout(layoutOptions).run();
  }

  _getLayoutOptions(layoutType) {
    switch (layoutType) {
      case LayoutType.FORCE:
        return {
          name: 'cola',  // or 'cose' for built-in
          animate: true,
          randomize: false,
          nodeSpacing: 40,
          edgeLength: 80,
          maxSimulationTime: 2000
        };

      case LayoutType.HIERARCHICAL:
        return {
          name: 'dagre',
          rankDir: 'TB',
          nodeSep: 60,
          rankSep: 100,
          animate: true
        };

      case LayoutType.TIMELINE:
        // Custom layout based on timestamp
        return {
          name: 'preset',
          positions: this._calculateTimelinePositions()
        };

      default:
        return { name: 'cose' };
    }
  }

  setLayout(type) {
    this.layout = type;
    this.applyLayout();
  }

  centerView() {
    this.cy.fit(undefined, 50);  // 50px padding
  }

  refresh() {
    this.buildFromApp();
  }

  toDataURL() {
    return this.cy.png({ full: true, scale: 2 });
  }
}
```

#### Step 2.2: Layout Mapping

| Current Layout | Cytoscape Extension | Notes |
|----------------|---------------------|-------|
| Force | `cola` or `cose` | cola provides better control |
| Hierarchical | `dagre` | Perfect for DAG visualization |
| Timeline | Custom `preset` | Calculate positions manually |
| Radial | `concentric` | Built-in |

---

### Phase 3: Workbench Graph Migration

#### Step 3.1: Create Shared Cytoscape Container

Modify `_renderGraphView()` in `eo_data_workbench.js`:

```javascript
_renderGraphView() {
  // ... existing toolbar setup ...

  this.elements.contentArea.innerHTML = `
    <div class="graph-container">
      <div class="graph-toolbar">...</div>
      <div class="graph-canvas-wrapper" id="cy-workbench-container"></div>
    </div>
  `;

  // Initialize Cytoscape for workbench
  this._initWorkbenchGraph(records, primaryField, linkFields);
}

_initWorkbenchGraph(records, primaryField, linkFields) {
  const container = document.getElementById('cy-workbench-container');

  // Destroy existing instance
  if (this.workbenchCy) {
    this.workbenchCy.destroy();
  }

  // Create nodes
  const nodes = records.map(record => ({
    data: {
      id: record.id,
      label: record.values[primaryField?.id] || 'Untitled',
      record: record
    }
  }));

  // Create edges from link fields
  const edges = [];
  records.forEach(record => {
    linkFields.forEach(field => {
      const linkedIds = record.values[field.id] || [];
      if (Array.isArray(linkedIds)) {
        linkedIds.forEach(linkedId => {
          edges.push({
            data: {
              source: record.id,
              target: linkedId,
              fieldName: field.name
            }
          });
        });
      }
    });
  });

  // Initialize Cytoscape
  this.workbenchCy = cytoscape({
    container,
    elements: [...nodes, ...edges],
    style: workbenchStylesheet,
    layout: this._getWorkbenchLayout()
  });

  // Event handlers
  this.workbenchCy.on('tap', 'node', (evt) => {
    this._showRecordDetail(evt.target.id());
  });
}
```

---

### Phase 4: Enhancements

#### New Features Enabled by Cytoscape

1. **Compound Nodes** - Group nodes inside parent nodes
2. **Edge Bundling** - Cleaner visualization of many edges
3. **Context Menus** - Right-click menus via `cytoscape-context-menus`
4. **Undo/Redo** - Position changes via `cytoscape-undo-redo`
5. **Node Tooltips** - Via `popper.js` extension
6. **Export** - JSON, PNG, JPG, SVG support
7. **Search/Filter** - Built-in selectors
8. **Animation** - Smooth layout transitions

#### Performance Optimizations

```javascript
// For large graphs (1000+ nodes)
const cy = cytoscape({
  // ... config ...

  // Performance settings
  textureOnViewport: true,
  hideEdgesOnViewport: true,
  motionBlur: true,

  // Reduce re-renders
  styleEnabled: true,
  headless: false
});

// Batch updates for large changes
cy.startBatch();
// ... add/remove many elements ...
cy.endBatch();
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `index.html` | Modify | Add Cytoscape CDN scripts |
| `eo_graph_cytoscape.js` | Create | Shared utilities and styles |
| `eo_graph.js` | Modify | Replace Canvas with Cytoscape |
| `eo_data_workbench.js` | Modify | Replace SVG with Cytoscape |
| `eo_styles.css` | Modify | Update/remove canvas-specific styles |

---

## API Compatibility

The public API of EOGraph will remain unchanged:

```javascript
// Existing API (preserved)
initGraph(container, app)  // Initialize
getGraph()                  // Get instance
graph.refresh()            // Refresh data
graph.setLayout(type)      // Change layout
graph.centerView()         // Fit to viewport
graph.toDataURL()          // Export as image
graph.onNodeSelect = fn    // Selection callback
graph.onNodeDoubleClick = fn // Double-click callback

// New API (additions)
graph.cy                   // Direct Cytoscape access
graph.exportJSON()         // Export as JSON
graph.importJSON(data)     // Import from JSON
graph.search(selector)     // Find nodes/edges
```

---

## Risk Mitigation

1. **Bundle Size**: Cytoscape core is ~300KB minified. Use CDN for caching.
2. **Learning Curve**: Well-documented with many examples.
3. **Breaking Changes**: Keep old classes for one release cycle.
4. **Performance**: Test with 1000+ nodes before deployment.

---

## Success Metrics

- [ ] All existing layouts replicated
- [ ] All interactions preserved (zoom, pan, select, drag)
- [ ] Performance equal or better for typical graph sizes
- [ ] Code reduced by ~40% (custom layouts removed)
- [ ] New features available (export, compound nodes)
