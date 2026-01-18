# Design: Field Display Modes (Lens Modes for Nested Data)

## Problem Statement

When a field contains structured data (nested JSON, arrays of objects, schema definitions), displaying it as raw JSON in a table cell creates poor UX:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ fields                                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│ [{"id":"fld_1","name":"Client","type":"text","options":{"required":true} │
│ },{"id":"fld_2","name":"Case Manager","type":"link","linkedTableId":"tbl │
│ _staff","options":{"relationship":"many-to-one"}},{"id":"fld_3","name":" │
│ Field 6","type":"formula","formula":"CONCAT({Client}, ' - ', {Status})"}]│
└──────────────────────────────────────────────────────────────────────────┘
```

**Problems:**
- Unreadable at a glance
- No semantic understanding of structure
- Can't distinguish Given (raw import) from Meant (interpreted structure)
- No progressive disclosure—all or nothing
- Relationships within nested data invisible

## The Field Display Modes Concept

A **Display Mode** is a rendering strategy for complex field values. Users can toggle between modes to see the same data from different perspectives—directly implementing Rule 1 (Distinction between Given and Meant) in the UI.

```
┌─────────────────────────────────────────────────────────────────┐
│ fields                              [Mode: Chips ▼] [Horizon ▼] │
├─────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌─────────────────┐ ┌──────────────────────────┐ │
│ │ 📝 Client  │ │ 🔗 Case Manager │ │ ⚙️ Field 6 (formula)     │ │
│ │ text       │ │ → Staff         │ │ =CONCAT(...)             │ │
│ └────────────┘ └─────────────────┘ └──────────────────────────┘ │
│                                                                 │
│ [Summary] [Chips] [Table] [Graph] [Raw JSON] [→ Linked Set]     │
└─────────────────────────────────────────────────────────────────┘
```

### EO Alignment

| Display Mode | EO Concept | What It Shows |
|--------------|------------|---------------|
| **Raw JSON** | Given | Original imported structure, uninterpreted |
| **Summary** | Meant (minimal) | Interpreted count/types: "6 fields: 3 text, 2 link, 1 formula" |
| **Chips** | Meant (visual) | Interpreted tokens with type semantics |
| **Table** | Meant (structured) | Full schema interpretation as inline table |
| **Graph** | Meant (relational) | Relationships between nested elements |
| **Linked Set** | Meant (normalized) | Elevate to first-class Set (see DESIGN_NESTED_DATA_NORMALIZATION.md) |

### Display Mode vs Horizon

**Display Mode** controls *how* data renders (visual format).
**Horizon** controls *what* data shows (detail level per Rules 4-6).

These are orthogonal:
- Summary mode at Horizon:Full → "6 fields: 3 text, 2 link, 1 formula"
- Summary mode at Horizon:Minimal → "6 fields"
- Chips mode at Horizon:Full → Shows all fields with full type info
- Chips mode at Horizon:Minimal → Shows only field names as chips

## Display Modes Specification

### 1. Summary Mode

Renders a computed summary string based on Horizon level.

```
┌─────────────────────────────────────────────────────┐
│ Horizon: Minimal   │ "6 fields"                     │
│ Horizon: Basic     │ "6 fields: 3 text, 2 link, 1 formula" │
│ Horizon: Detailed  │ "6 fields: Client, Case Manager, Status, ..." │
│ Horizon: Full      │ "6 fields: Client (text, req), Case Manager (→Staff), ..." │
└─────────────────────────────────────────────────────┘
```

**Implementation:**
```javascript
function renderSummary(value, horizon) {
  const items = parseNestedData(value);

  switch (horizon) {
    case 'minimal':
      return `${items.length} fields`;

    case 'basic':
      const typeCounts = countBy(items, 'type');
      const typeStr = Object.entries(typeCounts)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      return `${items.length} fields: ${typeStr}`;

    case 'detailed':
      const names = items.map(i => i.name).join(', ');
      return `${items.length} fields: ${truncate(names, 50)}`;

    case 'full':
      const details = items.map(i => formatFieldBrief(i)).join(', ');
      return `${items.length} fields: ${truncate(details, 80)}`;
  }
}
```

### 2. Chips Mode

Renders each nested item as a semantic chip/token.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ┌────────────┐ ┌─────────────────┐ ┌────────────┐ ┌──────────────────┐ │
│ │ 📝 Client  │ │ 🔗 Case Manager │ │ 📝 Status  │ │ ⚙️ Field 6       │ │
│ └────────────┘ └─────────────────┘ └────────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘

Hover on "Case Manager" chip:
┌─────────────────────────────────────┐
│ 🔗 Case Manager                     │
├─────────────────────────────────────┤
│ Type: Link                          │
│ Links to: Staff                     │
│ Relationship: many-to-one           │
│ Required: No                        │
│                                     │
│ [View in Graph] [Edit] [→ Navigate] │
└─────────────────────────────────────┘
```

**Chip Styling by Type:**
```javascript
const chipStyles = {
  text:     { icon: 'ph-text-t',       color: 'gray',   label: 'Text' },
  number:   { icon: 'ph-hash',         color: 'blue',   label: 'Number' },
  date:     { icon: 'ph-calendar',     color: 'purple', label: 'Date' },
  link:     { icon: 'ph-link',         color: 'green',  label: 'Link' },
  formula:  { icon: 'ph-function',     color: 'orange', label: 'Formula' },
  select:   { icon: 'ph-list',         color: 'teal',   label: 'Select' },
  boolean:  { icon: 'ph-toggle-left',  color: 'pink',   label: 'Boolean' },
  attachment: { icon: 'ph-paperclip',  color: 'amber',  label: 'Attachment' },
  json:     { icon: 'ph-brackets-curly', color: 'slate', label: 'JSON' },
};
```

**Horizon affects chip detail:**
```
Horizon: Minimal  → [Client] [Case Manager] [Status] ...  (names only)
Horizon: Basic    → [📝 Client] [🔗 Case Manager] ...     (icons + names)
Horizon: Detailed → [📝 Client (req)] [🔗 Case Manager → Staff] ...
Horizon: Full     → Full chip with all metadata visible
```

### 3. Table Mode

Renders nested array as an inline mini-table.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Name           │ Type    │ Options                        │ Actions    │
├────────────────┼─────────┼────────────────────────────────┼────────────┤
│ Client         │ 📝 text │ required                       │ [⋮]        │
│ Case Manager   │ 🔗 link │ → Staff (many-to-one)          │ [⋮]        │
│ Status         │ 📝 text │ —                              │ [⋮]        │
│ Filed Date     │ 📅 date │ format: MM/DD/YYYY             │ [⋮]        │
│ Amount         │ 🔢 num  │ currency: USD                  │ [⋮]        │
│ Field 6        │ ⚙️ form │ =CONCAT({Client}, ' - ', ...)  │ [⋮]        │
└─────────────────────────────────────────────────────────────────────────┘
```

**Horizon affects columns visible:**
```
Horizon: Minimal  → Name only
Horizon: Basic    → Name, Type
Horizon: Detailed → Name, Type, Options (summarized)
Horizon: Full     → All columns including raw IDs, timestamps
```

**Features:**
- Sortable columns
- Click row to expand full detail
- Inline editing (creates Meant events with provenance to Given)
- Row actions menu: Edit, Duplicate, Delete (tombstone), View Raw

### 4. Graph Mode

Renders relationships between nested elements as a mini node graph.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│    ┌──────────┐         ┌───────────────┐         ┌──────────┐         │
│    │ Client   │────────▶│   Field 6     │◀────────│ Status   │         │
│    │ (text)   │         │  (formula)    │         │ (text)   │         │
│    └──────────┘         └───────────────┘         └──────────┘         │
│                                │                                        │
│    ┌──────────────────┐        │                                        │
│    │  Case Manager    │        │                                        │
│    │  (link → Staff)  │────────┘                                        │
│    └──────────────────┘                                                 │
│                                                                         │
│    Legend: ──▶ references   ───  linked table                           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Graph shows:**
- Formula dependencies (which fields reference which)
- Link relationships (to other tables)
- Rollup sources
- Lookup chains

**Interactions:**
- Hover node: highlight connected nodes
- Click node: show detail popover
- Double-click: navigate to linked table/field
- Drag to rearrange (layout not persisted by default)

### 5. Raw JSON Mode

Shows the original Given data exactly as imported.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ {                                                          [Copy] [↗]   │
│   "fields": [                                                           │
│     {                                                                   │
│       "id": "fld_1",                                                    │
│       "name": "Client",                                                 │
│       "type": "text",                                                   │
│       "options": { "required": true }                                   │
│     },                                                                  │
│     ...                                                                 │
│   ]                                                                     │
│ }                                                                       │
│                                                        [Expand in Modal]│
└─────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Syntax highlighted
- Collapsible nodes (for large structures)
- Copy button
- "Open in Modal" for full-screen view
- Read-only (this is Given data)
- Shows provenance badge: "Imported from source_xxx at 2024-01-15"

### 6. Linked Set Mode

Not a rendering mode but an **action** that normalizes nested data into a first-class Set.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ⚡ This field contains structured data that can be elevated to a Set.  │
│                                                                         │
│ Detected: 6 field definitions with schema:                              │
│   - id (text, unique)                                                   │
│   - name (text)                                                         │
│   - type (select: text, number, date, link, formula, ...)               │
│   - options (json)                                                      │
│                                                                         │
│ [Preview as Set] [Create Linked Set →]                                  │
│                                                                         │
│ ℹ️ Creating a Set will:                                                  │
│   • Generate a new "Fields" Set with 6 records                          │
│   • Link this field to that Set (becomes a relation)                    │
│   • Preserve provenance to original JSON (Given → Meant chain)          │
│   • Enable queries across all field definitions                         │
└─────────────────────────────────────────────────────────────────────────┘
```

See DESIGN_NESTED_DATA_NORMALIZATION.md for full specification.

## Data Model

### Field Display Configuration

```javascript
// Per-field display settings (stored at Set or Lens level)
{
  fieldId: "fld_schema",
  displayConfig: {
    // Default mode for this field
    defaultMode: "chips",           // summary | chips | table | graph | raw

    // Default horizon (detail level)
    defaultHorizon: "detailed",     // minimal | basic | detailed | full

    // Mode-specific settings
    modes: {
      chips: {
        maxVisible: 5,              // Show "and 3 more..." after 5
        showTypes: true,            // Show type icons
        expandable: true            // Click to expand all
      },
      table: {
        columns: ["name", "type", "options"],
        sortBy: "name",
        sortDirection: "asc"
      },
      graph: {
        layout: "dagre",            // dagre | force | hierarchical
        showLabels: true
      },
      summary: {
        template: "{count} fields: {types}"  // Customizable
      }
    },

    // Nested data detection result
    detectedStructure: {
      isArray: true,
      itemSchema: {
        id: "string",
        name: "string",
        type: "string",
        options: "object"
      },
      canNormalize: true,
      suggestedSetName: "Fields"
    }
  }
}
```

### Horizon Presets

```javascript
// System-defined horizon levels
const HorizonPresets = {
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Just counts and names",
    settings: {
      showCounts: true,
      showNames: false,
      showTypes: false,
      showOptions: false,
      showIds: false
    }
  },
  basic: {
    id: "basic",
    name: "Basic",
    description: "Names and types",
    settings: {
      showCounts: true,
      showNames: true,
      showTypes: true,
      showOptions: false,
      showIds: false
    }
  },
  detailed: {
    id: "detailed",
    name: "Detailed",
    description: "Names, types, and key options",
    settings: {
      showCounts: true,
      showNames: true,
      showTypes: true,
      showOptions: true,      // Summarized
      showIds: false
    }
  },
  full: {
    id: "full",
    name: "Full",
    description: "Everything including IDs",
    settings: {
      showCounts: true,
      showNames: true,
      showTypes: true,
      showOptions: true,      // Full detail
      showIds: true
    }
  }
};

// Users can define custom horizons
{
  id: "horizon_custom_xxx",
  name: "Investigator View",
  description: "Shows provenance and timestamps",
  settings: {
    showCounts: true,
    showNames: true,
    showTypes: true,
    showOptions: false,
    showIds: false,
    showProvenance: true,     // Custom field
    showTimestamps: true      // Custom field
  }
}
```

## UI Components

### 1. Mode Selector (Column Header)

```
┌─────────────────────────────────────────────────────────────┐
│ fields ▼                                      [◐] [⚙️]      │
└─────────────────────────────────────────────────────────────┘
         │                                       │    │
         │                                       │    └─ Column settings
         │                                       └─ Horizon selector
         │
         ▼
┌─────────────────────────┐
│ Display Mode            │
├─────────────────────────┤
│ ○ Summary               │
│ ● Chips (current)       │
│ ○ Table                 │
│ ○ Graph                 │
│ ○ Raw JSON              │
├─────────────────────────┤
│ ─────────────────────── │
│ ⚡ Create Linked Set... │
└─────────────────────────┘
```

### 2. Horizon Selector

```
┌─────────────────────────┐
│ Detail Level            │
├─────────────────────────┤
│ ○ Minimal               │
│ ○ Basic                 │
│ ● Detailed (current)    │
│ ○ Full                  │
├─────────────────────────┤
│ ─────────────────────── │
│ ⚙️ Custom Horizons...   │
└─────────────────────────┘
```

### 3. Cell Renderer Component

```javascript
// Pseudocode for cell renderer
function NestedDataCell({ value, fieldConfig, horizon }) {
  const { defaultMode, modes } = fieldConfig.displayConfig;
  const [currentMode, setCurrentMode] = useState(defaultMode);

  const parsedData = useMemo(() => parseNestedData(value), [value]);

  const renderers = {
    summary: () => <SummaryRenderer data={parsedData} horizon={horizon} config={modes.summary} />,
    chips:   () => <ChipsRenderer data={parsedData} horizon={horizon} config={modes.chips} />,
    table:   () => <TableRenderer data={parsedData} horizon={horizon} config={modes.table} />,
    graph:   () => <GraphRenderer data={parsedData} horizon={horizon} config={modes.graph} />,
    raw:     () => <RawJsonRenderer data={value} />,
  };

  return (
    <div className="nested-data-cell">
      {renderers[currentMode]()}
      <ModeToggle current={currentMode} onChange={setCurrentMode} />
    </div>
  );
}
```

### 4. Inline Mode Toggle (Cell Level)

For quick switching without opening column settings:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ┌────────────┐ ┌─────────────────┐ ┌────────────┐    [≡│▦│◎│{}]        │
│ │ 📝 Client  │ │ 🔗 Case Manager │ │ ⚙️ Field 6 │    ─────────────      │
│ └────────────┘ └─────────────────┘ └────────────┘    current: chips     │
└─────────────────────────────────────────────────────────────────────────┘

Icon legend:
≡  = Summary
▦  = Table
◎  = Graph
{} = Raw JSON
(chips is default, no icon needed as it's the visual state shown)
```

## Interaction Flows

### Flow 1: Quick Mode Toggle

1. User hovers over cell with nested data
2. Mode toggle icons appear in cell corner
3. User clicks Table icon
4. Cell re-renders as inline table
5. Mode preference saved to field config (optional: ask to save as default)

### Flow 2: Column-Wide Mode Change

1. User clicks column header dropdown
2. Selects "Display Mode" → "Graph"
3. All cells in column re-render as mini graphs
4. Saved to Set/Lens field configuration

### Flow 3: Horizon Adjustment

1. User finds chips too detailed
2. Clicks Horizon selector → "Minimal"
3. Chips simplify to just names
4. User switches to Summary mode
5. Summary now shows just "6 fields" (Minimal horizon)

### Flow 4: Explore and Normalize

1. User imports JSON with nested field schemas
2. System detects structure, shows "Chips" mode by default
3. User clicks Graph mode to understand relationships
4. Sees formula dependencies, realizes this is complex
5. Clicks "Create Linked Set" to normalize
6. New "Fields" Set created, field becomes a relation
7. Original JSON preserved as provenance (Given → Meant chain)

## EO Compliance

### Rule 1: Distinction (Given vs Meant)

| Mode | Classification | Rationale |
|------|----------------|-----------|
| Raw JSON | Given | Shows original imported data, unmodified |
| Summary | Meant | Computed interpretation of structure |
| Chips | Meant | Semantic interpretation with type inference |
| Table | Meant | Structured interpretation with schema |
| Graph | Meant | Relational interpretation |

The UI clearly distinguishes these:
- Raw JSON mode shows "GIVEN" badge and provenance
- Other modes show "MEANT" indicator and interpretation metadata

### Rule 3: Ineliminability

Switching modes never deletes data:
- Mode changes are view transformations, not mutations
- Original JSON always accessible via Raw mode
- Normalizing to Linked Set creates new Meant events, preserves Given

### Rule 7: Groundedness

Every interpretation traces back:
- Chips show "Inferred from field at row X, imported from source_xxx"
- Table edits create Meant events with `provenance: [given_event_id]`
- Graph relationships derived from analyzable JSON paths

### Rules 4-6: Horizons

Horizon selector directly implements perspectival access:
- Different detail levels for different contexts
- Refinement only restricts (can't add fields not in data)
- Coherent: minimal horizon info is subset of full horizon info

## Implementation Phases

### Phase 1: Core Mode Switching
- [ ] Add displayConfig to field schema
- [ ] Implement SummaryRenderer
- [ ] Implement RawJsonRenderer
- [ ] Add mode toggle to column header
- [ ] Persist mode preferences

### Phase 2: Chips Mode
- [ ] Implement ChipsRenderer
- [ ] Add type-based styling
- [ ] Implement hover popovers
- [ ] Add Horizon support

### Phase 3: Table Mode
- [ ] Implement TableRenderer (inline mini-table)
- [ ] Add sorting/column visibility
- [ ] Implement inline editing (with provenance)

### Phase 4: Graph Mode
- [ ] Implement GraphRenderer
- [ ] Add relationship detection (formulas, links)
- [ ] Implement interactive layout
- [ ] Add navigation to linked entities

### Phase 5: Horizon System
- [ ] Implement HorizonPresets
- [ ] Add custom horizon creation
- [ ] Apply horizon filtering to all modes
- [ ] Persist user horizon preferences

### Phase 6: Normalization Action
- [ ] "Create Linked Set" UI flow
- [ ] Integration with DESIGN_NESTED_DATA_NORMALIZATION.md
- [ ] Provenance chain creation

## Open Questions

1. **Per-cell vs per-column modes**: Should users be able to set different modes for individual cells, or only at column level?
   - *Recommendation*: Column-level default, with cell-level override on hover/click

2. **Horizon inheritance**: Should Lens horizons override Set horizons?
   - *Recommendation*: Yes, following Rule 5 (Restrictivity)—Lens can only restrict

3. **Mode persistence scope**: Where to store mode preferences?
   - *Recommendation*: Field config at Set level, with Lens overrides

4. **Graph mode performance**: For cells with 50+ nested items, graph may be slow
   - *Recommendation*: Auto-switch to Summary with "Show Graph" button for large data

5. **Mobile/responsive**: How do modes adapt to narrow screens?
   - *Recommendation*: Chips collapse to Summary, Table becomes scrollable card list
