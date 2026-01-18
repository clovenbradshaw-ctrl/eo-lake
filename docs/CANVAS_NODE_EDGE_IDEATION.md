# Canvas View: Node-Edge Ideation

## Overview

This document explores implementing a full-featured visual node-edge canvas for Noema's Data Flow feature, inspired by **n8n** (workflow automation) and **TouchDesigner** (visual programming).

**Current State**: The app has a `PipelineCanvas` class (`noema_pipeline_canvas.js`) - a custom SVG implementation with basic nodes, Bezier connections, pan/zoom, and minimap. However, the "Canvas view not available" error appears because the canvas isn't properly initialized in some contexts.

---

## 1. Library Recommendation: **XYFlow (React Flow)**

### Why XYFlow/React Flow?
- **n8n uses it internally** - The n8n team has validated this approach for workflow builders
- **Highly customizable** - Full control over node appearance, handles, and edges
- **Performance** - Optimized for hundreds of nodes with virtualization
- **Rich ecosystem** - Plugins for minimap, controls, background patterns
- **Active development** - Well-maintained, frequent updates

### Alternative: Keep Custom SVG (Current Approach)
The current `PipelineCanvas` is already functional. We could enhance it instead:
- Add multiple input/output handles per node
- Add data type validation on connections
- Add connection animations showing data flow
- Add node grouping/comments

### Recommended Approach
**Hybrid**: Keep the vanilla JS architecture but enhance `PipelineCanvas` with XYFlow-inspired features. Since Noema is vanilla JS (not React), integrating React Flow directly would require significant architecture changes.

---

## 2. Module Categories (TouchDesigner-Inspired)

TouchDesigner organizes operators into **families** by data type (TOPs for textures, CHOPs for channels, etc.). For Noema's data-centric approach:

### Proposed 6 Operator Families

```
┌─────────────────────────────────────────────────────────────────────┐
│  NOEMA OPERATOR FAMILIES                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┐  Sets, Lenses, Focuses, Imports                       │
│  │  GIVEN  │  Color: Indigo #6366f1                                │
│  │   📦    │  "Where data originates" (immutable sources)          │
│  └─────────┘                                                        │
│                                                                     │
│  ┌─────────┐  Filter, Join, Transform, Select, Dedupe              │
│  │  SHAPE  │  Color: Amber #f59e0b                                 │
│  │   ⚡    │  "How data is sculpted" (row/column operations)       │
│  └─────────┘                                                        │
│                                                                     │
│  ┌─────────┐  Group, Pivot, Aggregate, Window                      │
│  │ SYNTH   │  Color: Violet #8b5cf6                                │
│  │   Σ     │  "How data is synthesized" (aggregations)             │
│  └─────────┘                                                        │
│                                                                     │
│  ┌─────────┐  AI Classify, Extract, Generate, Embed                │
│  │  AGENT  │  Color: Cyan #06b6d4                                  │
│  │   🤖    │  "Where AI acts" (LLM operations)                     │
│  └─────────┘                                                        │
│                                                                     │
│  ┌─────────┐  If/Then, Branch, Loop, Merge, Error                  │
│  │  FLOW   │  Color: Rose #f43f5e                                  │
│  │   ◇     │  "How data flows" (control structures)                │
│  └─────────┘                                                        │
│                                                                     │
│  ┌─────────┐  Save, Export, Webhook, Schedule                      │
│  │  EMIT   │  Color: Emerald #10b981                               │
│  │   📤    │  "Where data goes" (outputs/side effects)             │
│  └─────────┘                                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Detailed Node Types by Family

#### GIVEN (Sources) - Indigo
| Node | Description | Outputs |
|------|-------------|---------|
| **Set** | Pull records from a Set | records[] |
| **Lens** | Use a saved Lens (filtered Set) | records[] |
| **Focus** | Start from specific record | record |
| **Import** | Load CSV/JSON/API data | records[] |
| **Query** | SQL-like query interface | records[] |
| **Webhook** | Receive external data | records[] |

#### SHAPE (Transforms) - Amber
| Node | Description | Inputs | Outputs |
|------|-------------|--------|---------|
| **Filter** | Keep matching records | records[] | records[] |
| **Sort** | Order records | records[] | records[] |
| **Select** | Choose/rename fields | records[] | records[] |
| **Transform** | Modify field values | records[] | records[] |
| **Dedupe** | Remove duplicates | records[] | records[] |
| **Flatten** | Unnest arrays | records[] | records[] |
| **Unwind** | One record per array item | records[] | records[] |

#### SYNTH (Synthesis) - Violet
| Node | Description | Inputs | Outputs |
|------|-------------|--------|---------|
| **Aggregate** | SUM, AVG, COUNT, etc. | records[] | value |
| **Group** | Group by field(s) | records[] | groups{} |
| **Pivot** | Rows to columns | records[] | records[] |
| **Rollup** | Hierarchical aggregation | records[] | tree |
| **Window** | Running calculations | records[] | records[] |
| **Distinct** | Unique values | records[] | values[] |

#### AGENT (AI Operations) - Cyan
| Node | Description | Inputs | Outputs |
|------|-------------|--------|---------|
| **Classify** | Categorize records | records[] | records[] |
| **Extract** | Pull structured data | records[] | records[] |
| **Generate** | Create new content | records[] | records[] |
| **Embed** | Vector embeddings | records[] | vectors[] |
| **Summarize** | Condense records | records[] | summary |
| **Match** | Fuzzy/semantic join | records[], records[] | matches[] |

#### FLOW (Control) - Rose
| Node | Description | Inputs | Outputs |
|------|-------------|--------|---------|
| **Branch** | If/else split | records[] | true[], false[] |
| **Switch** | Multi-way split | records[] | case1[], case2[], ... |
| **Merge** | Combine streams | records[]... | records[] |
| **Join** | Combine on key | records[], records[] | records[] |
| **Loop** | Iterate with sub-flow | records[] | records[] |
| **Error** | Handle failures | error | recovery |

#### EMIT (Outputs) - Emerald
| Node | Description | Inputs | Outputs |
|------|-------------|--------|---------|
| **Preview** | View current state | records[] | (visual) |
| **Save** | Write to Set | records[] | confirmation |
| **Export** | Download file | records[] | file |
| **Webhook** | Send to URL | records[] | response |
| **Email** | Send notification | records[] | confirmation |
| **Log** | Debug output | any | (console) |

---

## 3. Node Design (n8n-Inspired)

### Card Style Nodes
```
┌──────────────────────────────────────┐
│  ●───○                          ●───○│  (multiple handles)
├──────────────────────────────────────┤
│ [📦] Filter                     ⋮   │  (icon, title, menu)
├──────────────────────────────────────┤
│ status = "active"                    │  (config summary)
│ ─────────────────────────────────    │
│ 1,234 → 856 records              ✓  │  (metrics + status)
└──────────────────────────────────────┘
     └─ Colored left border by family
```

### Handle Types (TouchDesigner-Inspired)
Different data types should have different handle shapes/colors:

| Type | Handle Shape | Color |
|------|--------------|-------|
| records[] | Circle | Blue |
| record | Small circle | Light blue |
| value | Diamond | Green |
| boolean | Triangle | Pink |
| any | Square | Gray |

### Connection Rules
- **Type checking**: Only compatible types can connect
- **Visual feedback**: Invalid connections show red, valid show green during drag
- **Auto-conversion**: Some types auto-convert (record → records[] wraps in array)

---

## 4. Canvas Features

### Core Features (Already Have)
- [x] Pan/zoom infinite canvas
- [x] Node drag & drop
- [x] Bezier curve connections
- [x] Minimap
- [x] Node palette/search

### New Features Needed

#### 4.1 Multiple Handles per Node
```javascript
// Current: Single input/output port
// Proposed: Named ports with types

const nodeDefinition = {
  type: 'join',
  inputs: [
    { id: 'left', label: 'Left', type: 'records' },
    { id: 'right', label: 'Right', type: 'records' }
  ],
  outputs: [
    { id: 'matched', label: 'Matched', type: 'records' },
    { id: 'unmatched', label: 'Unmatched', type: 'records' }
  ]
};
```

#### 4.2 Connection Animations
Show data flowing through connections during execution:
- Dashed line animation (CSS `stroke-dashoffset`)
- Particle effects for high-volume flows
- Color coding: gray (idle), blue (running), green (success), red (error)

#### 4.3 Node Grouping
Allow grouping nodes into collapsible "subgraphs":
```
┌─ My ETL Process ────────────────────┐
│  [Filter] → [Transform] → [Dedupe]  │
│           (collapsed: 3 nodes)      │
└─────────────────────────────────────┘
```

#### 4.4 Comments/Sticky Notes
Add annotation nodes that don't participate in data flow:
```
┌──────────────────────┐
│ 📝 TODO: Add error   │
│    handling here     │
└──────────────────────┘
```

#### 4.5 Version History / Time Travel
Integrate with Noema's event-sourced architecture:
- Slider to see canvas state at any point in time
- Diff view showing what changed
- Branching for experimentation

---

## 5. Integration with Sets

### How Canvas Relates to Sets

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WORKSPACE                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ SET: "Customers"                                             │   │
│  │  ├── Records: 10,000 rows                                    │   │
│  │  ├── Lenses:                                                 │   │
│  │  │   ├── "Active Customers" (filter)                         │   │
│  │  │   └── "By Region" (group)                                 │   │
│  │  └── Pipeline: ← THIS IS THE CANVAS                          │   │
│  │      ┌────────────────────────────────────────┐              │   │
│  │      │ [Import] → [Dedupe] → [Transform] →... │              │   │
│  │      └────────────────────────────────────────┘              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Set-Pipeline Relationship Options

**Option A: Pipeline as Set Attribute** (Current)
- Each Set has an optional `pipeline` property
- Pipeline defines how raw data becomes Set records
- Pipeline runs on import/refresh

**Option B: Standalone Flows** (n8n Style)
- Flows are independent entities like Sets
- Can read from multiple Sets, write to multiple Sets
- Scheduled or triggered execution

**Option C: Hybrid** (Recommended)
- Sets have simple "derivation" (single-source pipeline)
- Standalone "Flows" for complex multi-source operations
- Flows can create/update multiple Sets

---

## 6. Comparison: n8n vs TouchDesigner vs Noema

| Aspect | n8n | TouchDesigner | Noema (Proposed) |
|--------|-----|---------------|------------------|
| **Primary Use** | Workflow automation | Visual media | Data transformation |
| **Node Categories** | Actions, Triggers, Core | TOPs, CHOPs, SOPs, DATs | GIVEN, SHAPE, SYNTH, AGENT, FLOW, EMIT |
| **Data Types** | JSON objects | Textures, signals, 3D | Records, values, arrays |
| **Execution** | Trigger-based | Continuous (cook) | On-demand or auto |
| **Time Dimension** | Event-based | Frame-based | Event-sourced |
| **AI Integration** | Via integrations | Basic | First-class (AGENT nodes) |

---

## 7. Implementation Phases

### Phase 1: Fix Current Canvas (Week 1)
1. Debug why "Canvas view not available" appears
2. Ensure `PipelineCanvas` loads correctly in Data Flow panel
3. Add proper error handling and fallback

### Phase 2: Enhance Node System (Weeks 2-3)
1. Implement multiple handles per node
2. Add type system for connections
3. Add connection validation and visual feedback
4. Implement the 6 operator families

### Phase 3: Advanced Features (Weeks 4-6)
1. Node grouping/subgraphs
2. Connection animations
3. Comments/annotations
4. Execution visualization

### Phase 4: Integration (Weeks 7-8)
1. Standalone Flows (separate from Set pipelines)
2. Time-travel integration
3. AI node implementations
4. Performance optimization for large flows

---

## 8. Technical Implementation Notes

### Enhancing Current `PipelineCanvas`

```javascript
// Add to noema_pipeline_canvas.js

// 1. Multiple handles per node
const NodeHandles = {
  join: {
    inputs: [
      { id: 'left', position: 'top-left', type: 'records' },
      { id: 'right', position: 'bottom-left', type: 'records' }
    ],
    outputs: [
      { id: 'matched', position: 'top-right', type: 'records' },
      { id: 'unmatched', position: 'bottom-right', type: 'records' }
    ]
  },
  // ... other nodes
};

// 2. Type-safe connections
function canConnect(sourceHandle, targetHandle) {
  const compatibleTypes = {
    'records': ['records', 'any'],
    'record': ['record', 'records', 'any'],
    'value': ['value', 'any'],
    'any': ['records', 'record', 'value', 'any']
  };
  return compatibleTypes[sourceHandle.type]?.includes(targetHandle.type);
}

// 3. Connection path with animation
function _createAnimatedPath(fromNode, toNode, isRunning) {
  const path = this._createConnectionPath(fromNode, toNode);
  return `
    <path d="${path}" class="pipeline-connection ${isRunning ? 'flowing' : ''}">
      <animate attributeName="stroke-dashoffset"
               from="20" to="0" dur="0.5s"
               repeatCount="indefinite" />
    </path>
  `;
}
```

### CSS for New Features

```css
/* Connection flow animation */
.pipeline-connection.flowing {
  stroke-dasharray: 10, 5;
  animation: flow 1s linear infinite;
}

@keyframes flow {
  from { stroke-dashoffset: 15; }
  to { stroke-dashoffset: 0; }
}

/* Handle types */
.pipeline-node-port[data-type="records"] { border-radius: 50%; }
.pipeline-node-port[data-type="value"] {
  border-radius: 2px;
  transform: rotate(45deg);
}
.pipeline-node-port[data-type="boolean"] {
  clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
}

/* Family colors */
.pipeline-node.family-given { border-left: 4px solid #6366f1; }
.pipeline-node.family-shape { border-left: 4px solid #f59e0b; }
.pipeline-node.family-synth { border-left: 4px solid #8b5cf6; }
.pipeline-node.family-agent { border-left: 4px solid #06b6d4; }
.pipeline-node.family-flow { border-left: 4px solid #f43f5e; }
.pipeline-node.family-emit { border-left: 4px solid #10b981; }
```

---

## 9. Open Questions

1. **Should we migrate to React?** Would enable React Flow, but major architecture change
2. **How deep is TouchDesigner inspiration?** Full operator cooking model, or just visual style?
3. **AI nodes as first-class?** Dedicated AGENT family, or integrate into existing categories?
4. **Multi-user collaboration?** Real-time canvas editing like Figma?

---

## 10. References

- [React Flow Documentation](https://reactflow.dev)
- [n8n GitHub Repository](https://github.com/n8n-io/n8n)
- [TouchDesigner Operator Documentation](https://docs.derivative.ca/Operator)
- [Workflow Builder SDK (React Summit 2025)](https://gitnation.com/contents/building-ai-workflow-editor-ui-in-react-with-workflow-builder-sdk)
