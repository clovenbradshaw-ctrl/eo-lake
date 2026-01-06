/**
 * EO Graph Cytoscape - Shared Utilities for Cytoscape.js Integration
 *
 * Provides conversion utilities and shared styles for Cytoscape.js graphs
 * used in both the Experience Graph (eo_graph.js) and Data Workbench.
 *
 * COMPLIANCE NOTES:
 * - This is a DERIVED visualization utility - it renders from the event log
 * - Read-only: No graph interactions modify the authoritative log
 */

/**
 * Color palette for node types
 */
const CytoscapeColors = Object.freeze({
  GIVEN: '#00ba7c',      // Green - Raw experience data
  MEANT: '#7856ff',      // Purple - Interpreted events
  ENTITY: '#1d9bf0',     // Blue - Data entities
  HORIZON: '#ffad1f',    // Orange - Access boundaries
  DEFAULT: '#8b98a5',    // Gray - Default

  // Edge colors
  PROVENANCE: '#00ba7c',
  SUPERSEDES: '#f4212e',
  PARENT: '#6e7a88',
  ENTITY_SOURCE: '#1d9bf0',
  GRAPH_DATA: '#1d9bf0',

  // UI colors
  SELECTED: '#ffffff',
  BACKGROUND: '#0f1419',
  TEXT: '#e7e9ea',
  TEXT_MUTED: '#8b98a5'
});

/**
 * Node size configuration
 */
const CytoscapeNodeSizes = Object.freeze({
  DEFAULT: 24,
  HORIZON: 48,
  ENTITY: 32,
  SMALL: 16,
  MEDIUM: 24,
  LARGE: 36
});

/**
 * Get node color by type
 */
function getNodeColor(type) {
  const colors = {
    given: CytoscapeColors.GIVEN,
    meant: CytoscapeColors.MEANT,
    entity: CytoscapeColors.ENTITY,
    horizon: CytoscapeColors.HORIZON
  };
  return colors[type] || CytoscapeColors.DEFAULT;
}

/**
 * Get node size by type
 */
function getNodeSize(type) {
  const sizes = {
    horizon: CytoscapeNodeSizes.HORIZON,
    entity: CytoscapeNodeSizes.ENTITY
  };
  return sizes[type] || CytoscapeNodeSizes.DEFAULT;
}

/**
 * Get edge color by type
 */
function getEdgeColor(type) {
  const colors = {
    provenance: CytoscapeColors.PROVENANCE,
    supersedes: CytoscapeColors.SUPERSEDES,
    parent: CytoscapeColors.PARENT,
    entity_source: CytoscapeColors.ENTITY_SOURCE,
    graph_data: CytoscapeColors.GRAPH_DATA
  };
  return colors[type] || CytoscapeColors.DEFAULT;
}

/**
 * Get edge line style by type
 */
function getEdgeLineStyle(type) {
  if (type === 'supersedes') return 'dashed';
  if (type === 'horizon_contains') return 'dotted';
  return 'solid';
}

/**
 * Convert a GraphNode to Cytoscape node format
 */
function nodeToCytoscape(node) {
  return {
    data: {
      id: node.id,
      label: node.label || node.id,
      nodeType: node.type,
      originalData: node.data,
      color: getNodeColor(node.type),
      size: getNodeSize(node.type)
    },
    classes: [
      node.type,
      node.selected ? 'selected' : '',
      node.highlighted ? 'highlighted' : ''
    ].filter(Boolean).join(' '),
    position: {
      x: node.x || Math.random() * 500,
      y: node.y || Math.random() * 500
    }
  };
}

/**
 * Convert a GraphEdge to Cytoscape edge format
 */
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

/**
 * Convert workbench record to Cytoscape node format
 */
function recordToCytoscapeNode(record, primaryFieldId, options = {}) {
  const label = record.values?.[primaryFieldId] || 'Untitled';
  return {
    data: {
      id: record.id,
      label: label,
      record: record,
      color: options.color || CytoscapeColors.ENTITY,
      size: options.size || CytoscapeNodeSizes.MEDIUM
    },
    classes: options.classes || ''
  };
}

/**
 * Create Cytoscape edge from link relationship
 */
function linkToCytoscapeEdge(sourceId, targetId, fieldName) {
  return {
    data: {
      id: `${sourceId}-${targetId}-${fieldName}`,
      source: sourceId,
      target: targetId,
      fieldName: fieldName,
      color: CytoscapeColors.GRAPH_DATA
    },
    classes: 'link-edge'
  };
}

/**
 * Shared Cytoscape stylesheet for EO Graph
 */
const cytoscapeStylesheet = [
  // Base node style
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      'background-opacity': 0.6,
      'border-width': 2,
      'border-color': 'data(color)',
      'width': 'data(size)',
      'height': 'data(size)',
      'label': 'data(label)',
      'font-size': '11px',
      'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'color': CytoscapeColors.TEXT,
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 6,
      'text-max-width': '100px',
      'text-wrap': 'ellipsis',
      'text-background-color': CytoscapeColors.BACKGROUND,
      'text-background-opacity': 0.7,
      'text-background-padding': '2px',
      'text-background-shape': 'roundrectangle',
      'min-zoomed-font-size': 8,
      'z-index': 10
    }
  },

  // Node type: Given
  {
    selector: 'node.given',
    style: {
      'background-color': CytoscapeColors.GIVEN,
      'border-color': CytoscapeColors.GIVEN
    }
  },

  // Node type: Meant
  {
    selector: 'node.meant',
    style: {
      'background-color': CytoscapeColors.MEANT,
      'border-color': CytoscapeColors.MEANT
    }
  },

  // Node type: Entity
  {
    selector: 'node.entity',
    style: {
      'background-color': CytoscapeColors.ENTITY,
      'border-color': CytoscapeColors.ENTITY,
      'width': CytoscapeNodeSizes.ENTITY,
      'height': CytoscapeNodeSizes.ENTITY
    }
  },

  // Node type: Horizon
  {
    selector: 'node.horizon',
    style: {
      'background-color': CytoscapeColors.HORIZON,
      'border-color': CytoscapeColors.HORIZON,
      'width': CytoscapeNodeSizes.HORIZON,
      'height': CytoscapeNodeSizes.HORIZON
    }
  },

  // Selected state
  {
    selector: 'node:selected, node.selected',
    style: {
      'background-color': CytoscapeColors.SELECTED,
      'border-width': 3,
      'border-color': 'data(color)',
      'z-index': 100
    }
  },

  // Highlighted/hover state
  {
    selector: 'node.highlighted, node:active',
    style: {
      'background-opacity': 1,
      'border-width': 3,
      'z-index': 50
    }
  },

  // Base edge style
  {
    selector: 'edge',
    style: {
      'width': 1.5,
      'line-color': 'data(color)',
      'target-arrow-color': 'data(color)',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.8,
      'curve-style': 'bezier',
      'opacity': 0.6
    }
  },

  // Provenance edges
  {
    selector: 'edge.provenance',
    style: {
      'line-color': CytoscapeColors.PROVENANCE,
      'target-arrow-color': CytoscapeColors.PROVENANCE
    }
  },

  // Supersedes edges (dashed, red)
  {
    selector: 'edge.supersedes',
    style: {
      'line-style': 'dashed',
      'line-color': CytoscapeColors.SUPERSEDES,
      'target-arrow-color': CytoscapeColors.SUPERSEDES,
      'line-dash-pattern': [6, 3]
    }
  },

  // Parent edges
  {
    selector: 'edge.parent',
    style: {
      'line-color': CytoscapeColors.PARENT,
      'target-arrow-color': CytoscapeColors.PARENT
    }
  },

  // Graph data edges
  {
    selector: 'edge.graph_data, edge.link-edge',
    style: {
      'line-color': CytoscapeColors.GRAPH_DATA,
      'target-arrow-color': CytoscapeColors.GRAPH_DATA
    }
  },

  // Highlighted edge
  {
    selector: 'edge.highlighted, edge:active',
    style: {
      'width': 2.5,
      'opacity': 1,
      'z-index': 100
    }
  },

  // Edge hover - show connected nodes
  {
    selector: 'edge:selected',
    style: {
      'width': 3,
      'opacity': 1
    }
  }
];

/**
 * Workbench-specific stylesheet additions
 */
const workbenchStylesheet = [
  ...cytoscapeStylesheet,

  // Workbench node default style
  {
    selector: 'node',
    style: {
      'background-color': CytoscapeColors.ENTITY,
      'border-color': CytoscapeColors.ENTITY,
      'background-opacity': 0.8
    }
  },

  // Size variations
  {
    selector: 'node.size-small',
    style: {
      'width': CytoscapeNodeSizes.SMALL,
      'height': CytoscapeNodeSizes.SMALL,
      'font-size': '9px'
    }
  },
  {
    selector: 'node.size-medium',
    style: {
      'width': CytoscapeNodeSizes.MEDIUM,
      'height': CytoscapeNodeSizes.MEDIUM,
      'font-size': '11px'
    }
  },
  {
    selector: 'node.size-large',
    style: {
      'width': CytoscapeNodeSizes.LARGE,
      'height': CytoscapeNodeSizes.LARGE,
      'font-size': '13px'
    }
  },

  // Label position: inside
  {
    selector: 'node.label-inside',
    style: {
      'text-valign': 'center',
      'text-halign': 'center',
      'text-margin-y': 0,
      'font-size': '9px',
      'text-max-width': '40px',
      'color': '#ffffff'
    }
  },

  // Label position: hover only
  {
    selector: 'node.label-hover',
    style: {
      'label': ''
    }
  },
  {
    selector: 'node.label-hover:active, node.label-hover.highlighted',
    style: {
      'label': 'data(label)'
    }
  },

  // High-connectivity nodes get emphasis
  {
    selector: 'node.high-connectivity',
    style: {
      'border-width': 3
    }
  }
];

/**
 * Layout configurations for different layout types
 */
const layoutConfigs = {
  force: {
    name: 'cose',
    animate: true,
    animationDuration: 500,
    animationEasing: 'ease-out',
    randomize: false,
    componentSpacing: 100,
    nodeRepulsion: function(node) { return 8000; },
    nodeOverlap: 20,
    idealEdgeLength: function(edge) { return 80; },
    edgeElasticity: function(edge) { return 100; },
    nestingFactor: 1.2,
    gravity: 0.25,
    numIter: 1000,
    initialTemp: 200,
    coolingFactor: 0.95,
    minTemp: 1.0,
    fit: true,
    padding: 50
  },

  hierarchical: {
    name: 'dagre',
    rankDir: 'TB',
    nodeSep: 60,
    rankSep: 100,
    animate: true,
    animationDuration: 500,
    fit: true,
    padding: 50
  },

  circular: {
    name: 'circle',
    animate: true,
    animationDuration: 500,
    fit: true,
    padding: 50,
    startAngle: -Math.PI / 2,
    sweep: 2 * Math.PI,
    clockwise: true
  },

  grid: {
    name: 'grid',
    animate: true,
    animationDuration: 500,
    fit: true,
    padding: 50,
    rows: undefined,
    cols: undefined,
    condense: true,
    sort: function(a, b) {
      return a.data('label').localeCompare(b.data('label'));
    }
  },

  concentric: {
    name: 'concentric',
    animate: true,
    animationDuration: 500,
    fit: true,
    padding: 50,
    startAngle: -Math.PI / 2,
    sweep: 2 * Math.PI,
    clockwise: true,
    minNodeSpacing: 50,
    concentric: function(node) {
      // Higher degree = more central
      return node.degree();
    },
    levelWidth: function(nodes) {
      return 2;
    }
  },

  preset: {
    name: 'preset',
    animate: true,
    animationDuration: 300,
    fit: true,
    padding: 50
  }
};

/**
 * Get layout configuration by type
 */
function getLayoutConfig(layoutType, customOptions = {}) {
  const baseConfig = layoutConfigs[layoutType] || layoutConfigs.force;
  return { ...baseConfig, ...customOptions };
}

/**
 * Create a Cytoscape instance with standard EO Graph configuration
 */
function createCytoscapeInstance(container, options = {}) {
  // Register dagre layout if available
  if (typeof cytoscape !== 'undefined' && typeof cytoscapeDagre !== 'undefined') {
    cytoscape.use(cytoscapeDagre);
  }

  const defaultOptions = {
    container: container,
    style: options.useWorkbenchStyle ? workbenchStylesheet : cytoscapeStylesheet,
    layout: { name: 'preset' },

    // Interaction settings
    minZoom: 0.1,
    maxZoom: 5,
    wheelSensitivity: 0.3,
    boxSelectionEnabled: false,
    selectionType: 'single',

    // Performance optimizations
    textureOnViewport: true,
    hideEdgesOnViewport: false,
    motionBlur: false,

    // Initial empty elements
    elements: []
  };

  return cytoscape({ ...defaultOptions, ...options });
}

/**
 * Draw a legend on a canvas overlay
 */
function drawGraphLegend(container, items) {
  // Remove existing legend
  const existingLegend = container.querySelector('.cy-legend');
  if (existingLegend) existingLegend.remove();

  // Create legend container
  const legend = document.createElement('div');
  legend.className = 'cy-legend';
  legend.style.cssText = `
    position: absolute;
    bottom: 12px;
    left: 12px;
    background: rgba(15, 20, 25, 0.9);
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 11px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    z-index: 10;
    pointer-events: none;
  `;

  items.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      margin-bottom: 6px;
    `;
    row.innerHTML = `
      <span style="
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${item.color};
        margin-right: 8px;
        ${item.dashed ? 'background: transparent; border: 2px dashed ' + item.color + ';' : ''}
      "></span>
      <span style="color: ${CytoscapeColors.TEXT_MUTED};">${item.label}</span>
    `;
    legend.appendChild(row);
  });

  // Remove last margin
  if (legend.lastChild) {
    legend.lastChild.style.marginBottom = '0';
  }

  container.style.position = 'relative';
  container.appendChild(legend);
}

/**
 * Standard legend items for EO Graph
 */
const eoGraphLegendItems = [
  { color: CytoscapeColors.GIVEN, label: 'Given (Raw Experience)' },
  { color: CytoscapeColors.MEANT, label: 'Meant (Interpretation)' },
  { color: CytoscapeColors.SUPERSEDES, label: 'Supersedes', dashed: true }
];

/**
 * Export utilities for timeline layout
 */
function calculateTimelinePositions(nodes, width, height, padding = 50) {
  const positions = {};

  // Sort by timestamp
  const sortedNodes = [...nodes].sort((a, b) => {
    const timeA = new Date(a.data?.timestamp || a.data?.originalData?.timestamp || 0).getTime();
    const timeB = new Date(b.data?.timestamp || b.data?.originalData?.timestamp || 0).getTime();
    return timeA - timeB;
  });

  if (sortedNodes.length === 0) return positions;

  // Get time range
  const times = sortedNodes.map(n =>
    new Date(n.data?.timestamp || n.data?.originalData?.timestamp || 0).getTime()
  );
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeRange = maxTime - minTime || 1;

  // Group by type for vertical separation
  const typeRows = { given: 0, meant: 1, entity: 2 };
  const rowHeight = (height - padding * 2) / 3;

  sortedNodes.forEach(node => {
    const time = new Date(node.data?.timestamp || node.data?.originalData?.timestamp || 0).getTime();
    const progress = (time - minTime) / timeRange;
    const type = node.data?.nodeType || 'entity';
    const row = typeRows[type] !== undefined ? typeRows[type] : 2;

    positions[node.data.id] = {
      x: padding + progress * (width - padding * 2),
      y: padding + row * rowHeight + rowHeight / 2 + (Math.random() - 0.5) * 30
    };
  });

  return positions;
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.CytoscapeColors = CytoscapeColors;
  window.CytoscapeNodeSizes = CytoscapeNodeSizes;
  window.getNodeColor = getNodeColor;
  window.getNodeSize = getNodeSize;
  window.getEdgeColor = getEdgeColor;
  window.getEdgeLineStyle = getEdgeLineStyle;
  window.nodeToCytoscape = nodeToCytoscape;
  window.edgeToCytoscape = edgeToCytoscape;
  window.recordToCytoscapeNode = recordToCytoscapeNode;
  window.linkToCytoscapeEdge = linkToCytoscapeEdge;
  window.cytoscapeStylesheet = cytoscapeStylesheet;
  window.workbenchStylesheet = workbenchStylesheet;
  window.layoutConfigs = layoutConfigs;
  window.getLayoutConfig = getLayoutConfig;
  window.createCytoscapeInstance = createCytoscapeInstance;
  window.drawGraphLegend = drawGraphLegend;
  window.eoGraphLegendItems = eoGraphLegendItems;
  window.calculateTimelinePositions = calculateTimelinePositions;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CytoscapeColors,
    CytoscapeNodeSizes,
    getNodeColor,
    getNodeSize,
    getEdgeColor,
    getEdgeLineStyle,
    nodeToCytoscape,
    edgeToCytoscape,
    recordToCytoscapeNode,
    linkToCytoscapeEdge,
    cytoscapeStylesheet,
    workbenchStylesheet,
    layoutConfigs,
    getLayoutConfig,
    createCytoscapeInstance,
    drawGraphLegend,
    eoGraphLegendItems,
    calculateTimelinePositions
  };
}
