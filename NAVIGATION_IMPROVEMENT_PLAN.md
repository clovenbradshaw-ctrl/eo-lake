# File Navigation Improvement Plan

## Executive Summary

This plan outlines improvements to EO Lake's file navigation system to make hierarchy and provenance more intuitive while maintaining the Experience Ontology's Nine Rules compliance.

---

## Current State Analysis

### 5-Level Hierarchy
```
Level 0: SOURCES (Import Origins) - Files imported from external systems
Level 1: WORKSPACES (Contextual Boundaries) - Organizational contexts
Level 2: SETS (Typed Data Collections) - Schema-bound record groups
Level 3: LENSES (View Types) - Interpretive visualizations
Level 4: FOCUSES (Filtered Views) - Restricted scopes
```

### Key Pain Points Identified

1. **Navigation Disconnect**: Sources tree disconnected from workspace organization
2. **Provenance Opacity**: Import metadata hidden in tooltips, not visually prominent
3. **Breadcrumb Limitations**: Not clickable, no backward navigation
4. **Discovery Gaps**: No search across sources, no filtering by provenance
5. **Visual Hierarchy**: Flat source list doesn't show data lineage
6. **Performance**: Full DOM re-renders on navigation changes

---

## EO-Grounded Navigation Architecture

The Experience Ontology provides a rigorous philosophical foundation for navigation design. Rather than treating navigation as a UI problem, EO reveals it as an **ontological traversal** through perspectives.

### Core Insight: Navigation IS Horizon Traversal

In EO, you never "see data" - you access experience through a **HorizonGate**. Navigation is not moving through files; it's **shifting your horizon**. Each click narrows or broadens what you can perceive.

```
┌─────────────────────────────────────────────────────────────────┐
│  NAVIGATION AS HORIZON MOVEMENT                                 │
│                                                                 │
│  Workspace ──────▶ Set ──────▶ Lens ──────▶ Focus              │
│     ║                ║            ║            ║                │
│  [Horizon A]    [Horizon B]  [Horizon C]  [Horizon D]          │
│  "All Q4 data"  "Only orders" "As kanban"  "My items"          │
│                                                                 │
│  Each step RESTRICTS (Rule 5) - you cannot expand outward      │
│  without explicitly ascending the hierarchy                     │
└─────────────────────────────────────────────────────────────────┘
```

### Structural Principle 1: GIVEN ↔ MEANT Distinction

**The Most Important Navigation Split**

The fundamental EO partition must be visible in navigation:

| GIVEN (Raw Experience) | MEANT (Interpretation) |
|------------------------|------------------------|
| Import sources | Workspaces, Sets, Lenses, Focuses |
| External file origins | User-created views |
| Cannot derive from MEANT | Must trace back to GIVEN |
| Immutable, append-only | Can be superseded |

**UI Implication**: Sources (GIVEN) and Views (MEANT) should be visually distinct navigation regions:

```
┌─────────────────────────────────┐
│ ◉ GIVEN (Sources)              │  ← Immutable origin
│   └── quarterly_data.csv       │
│   └── calendar.ics             │
├─────────────────────────────────┤
│ ◐ MEANT (Interpretations)      │  ← Your perspectives
│   └── Work Projects (Workspace)│
│       └── Orders (Set)         │
│           └── Board (Lens)     │
└─────────────────────────────────┘
```

The icons (◉ full, ◐ partial, ○ none) from `eo_provenance.js` can indicate provenance completeness at each level.

### Structural Principle 2: Hierarchy = Horizon Restriction (Rule 5)

**Foreclosure Principle**: Each level DOWN can only restrict, never expand.

This has profound navigation implications:

1. **Downward = Narrowing**: Clicking into a Focus from a Lens reduces what you see
2. **Upward = Broadening**: Clicking breadcrumb to parent reveals more
3. **Sibling = Orthogonal**: Switching Lenses doesn't add/remove records, changes interpretation

**Visual Encoding**:
```
Workspace (1,247 records visible through this horizon)
    │
    └── Set (1,247 records - same, scoped to schema)
         │
         └── Lens (1,247 records - same, viewed differently)
              │
              └── Focus (89 records - RESTRICTED by filter)
                        ↑
                        Shows exactly how restriction applied
```

**Navigation should show the "narrowing ratio"** at each Focus:
```
🔽 My Items (89 of 1,247) ← Immediately shows restriction magnitude
```

### Structural Principle 3: Provenance as Navigation Path (Rule 7)

**Groundedness Principle**: Every MEANT event must trace back to GIVEN events.

This means provenance IS a navigation path. The chain:

```
GIVEN Event ──▶ Set (MEANT) ──▶ Lens (MEANT) ──▶ Focus (MEANT)
    │               │               │               │
    │               │               │               └── derivedFromLens
    │               │               └── derivedFromSet
    │               └── provenance: [given_event_id]
    └── Original CSV Import
```

**UI Implication**: Every view should show "trace to origin" as navigable links:

```
┌─────────────────────────────────────────────┐
│ 📋 My Kanban Board                          │
│ Provenance: quarterly_data.csv → Orders →   │
│             Kanban View → [This Focus]      │
│             ↑ clickable breadcrumb          │
└─────────────────────────────────────────────┘
```

### Structural Principle 4: Epistemic Status as Navigation Affordance (Rule 8)

Views carry epistemic status: `PRELIMINARY`, `REVIEWED`, `CONTESTED`, `SUPERSEDED`

**Navigation should expose this**:

```
Sets
├── 📊 Orders [REVIEWED ✓]      ← Validated, confident
├── 📊 Projections [PRELIMINARY] ← Initial interpretation
├── 📊 Old Categories [SUPERSEDED] ← Replaced, still accessible
└── 📊 Revenue Split [CONTESTED ⚠] ← Under dispute
```

**Superseded views (Rule 9)** should remain navigable but visually differentiated:
- Strikethrough or dimmed
- Link to superseding view
- Full history accessible

### Structural Principle 5: The 9-Element Provenance as Navigation Metadata

The three triads of provenance map to navigation questions:

| Triad | Question | Navigation Relevance |
|-------|----------|---------------------|
| **EPISTEMIC** | "How was this produced?" | Filter by import method, agent, source type |
| **SEMANTIC** | "What does this mean?" | Search by term, definition, jurisdiction |
| **SITUATIONAL** | "When/where does this hold?" | Filter by timeframe, scale, context |

**Search syntax derived from EO provenance**:
```
agent:calendar-app           ← EPISTEMIC: who imported
method:ics-parse             ← EPISTEMIC: how processed
source:google-calendar       ← EPISTEMIC: where from

term:meeting                 ← SEMANTIC: concept type
jurisdiction:engineering    ← SEMANTIC: team scope

timeframe:2024-Q4           ← SITUATIONAL: when valid
scale:team                   ← SITUATIONAL: at what level
```

### Structural Principle 6: Navigation as Activity (Operator × Target × Context)

From `eo_activity.js`, all actions follow: **Operator(Target) ⟨in Context⟩**

Navigation actions map to EO operators:

| Navigation Action | EO Operator | Meaning |
|-------------------|-------------|---------|
| Select Set | SEG (｜) | Segment: Draw boundary around data |
| Apply Focus | SEG (｜) | Segment: Further restrict scope |
| Switch Lens | ALT (∿) | Alternate: Change interpretation mode |
| Expand Source | DES (⊡) | Designate: Reveal children |
| Search | NUL (∅) | Recognition: Find what matches |

**Implication**: Navigation history is itself an activity log:
```
Activity Log (Navigation):
10:30 SEG(Orders) ⟨in Work Projects⟩    - Selected set
10:31 ALT(Kanban) ⟨in Orders⟩           - Switched lens
10:32 SEG(MyItems) ⟨in Kanban⟩          - Applied focus
10:35 ALT(Calendar) ⟨in Orders⟩         - Switched lens
```

This log IS the "recent navigation" feature, but EO-grounded.

### Structural Principle 7: HorizonGate Transparency

Rule 4 (Perspectivality) says: "There is no view from nowhere."

**Every navigation state should declare its horizon**:

```
┌─────────────────────────────────────────────┐
│ Current Horizon                             │
│ ├── Workspace: Work Projects                │
│ ├── Time Range: Oct 1 - Dec 31, 2024       │
│ ├── Actors: [Engineering Team]              │
│ └── Frame: Project Tracking                 │
│                                             │
│ You are seeing 89 of 1,247 records         │
│ [Expand Horizon] [Narrow Further]           │
└─────────────────────────────────────────────┘
```

This transparency panel (from `eo_principles_transparency.js`) should be part of navigation, not hidden.

### Summary: EO-Native Navigation Principles

| Principle | EO Rule | Navigation Implication |
|-----------|---------|------------------------|
| **Partition** | Rule 1 | Visually separate GIVEN (sources) from MEANT (views) |
| **Immutability** | Rule 3 | Sources never change; show import timestamp |
| **Perspectivality** | Rule 4 | Show current horizon explicitly |
| **Restrictivity** | Rule 5 | Hierarchy only narrows; show restriction ratios |
| **Groundedness** | Rule 7 | Provenance chain as navigable breadcrumb |
| **Determinacy** | Rule 8 | Show epistemic status on all views |
| **Defeasibility** | Rule 9 | Superseded views navigable, linked to successors |

---

## Improvement Plan

### Phase 1: Visual Provenance Indicators

**Goal**: Make data origins immediately visible without hiding them in tooltips

#### 1.1 Source Badges on Sets
Add visual badges showing provenance directly on set items:

```
┌─────────────────────────────────────────────┐
│ 📊 Active Tasks                    [CSV] 📅 │
│    1,247 records • imported Dec 27          │
└─────────────────────────────────────────────┘
```

**Implementation** (`eo_data_workbench.js`):
- Modify `_renderSetsNav()` (~line 1066) to include source badges
- Add CSS classes for `.source-badge`, `.provenance-date`
- Color-code by source type (CSV=green, JSON=blue, ICS=purple, Manual=gray)

#### 1.2 Provenance Timeline Indicator
Show time-based import history with a subtle timeline:

```
Sources ────────┬────────┬────────┬────────▶ Now
               Dec 20   Dec 23   Dec 27
                 │        │        │
              data.csv users.json calendar.ics
```

**Implementation**:
- Add `_renderProvenanceTimeline()` method
- SVG-based timeline below Sources header
- Clickable nodes to filter by import date

#### 1.3 Import Source Icons Enhancement
Expand `_getSourceIcon()` to show richer context:

| Current | Proposed |
|---------|----------|
| CSV icon only | CSV + row count + delimiter type |
| JSON icon only | JSON + structure type (array/object) |
| ICS icon only | ICS + calendar name + event count |

---

### Phase 2: Hierarchical Navigation Enhancement

**Goal**: Make parent-child relationships visually intuitive and navigable

#### 2.1 Clickable Breadcrumb Trail
Convert breadcrumb from display-only to interactive navigation:

```
📁 Work Projects > 📊 Active Tasks > 📋 Board View > 🔽 My Items
     [click]           [click]          [click]       [current]
        ↓                 ↓                ↓
   Show workspace     Show set      Show all lens items
```

**Implementation** (`eo_data_workbench.js`):
- Modify `_updateBreadcrumb()` (~line 139) to add click handlers
- Each segment navigates to that hierarchy level
- Add hover states and visual affordances

#### 2.2 Hierarchy Dropdown Menus
Add dropdown menus on breadcrumb items showing siblings:

```
📁 Work Projects ▾
   ├── Work Projects ✓
   ├── Personal
   └── Archive
```

**Implementation**:
- Add `_renderBreadcrumbDropdown()` method
- Show siblings at same level
- Allow quick switching without full navigation

#### 2.3 Parent Preview on Hover
When hovering child items, show parent context:

```
┌─────────────────────────────┐
│ My Tasks This Week          │ ◀── Hovering this focus
│ ▲ Parent: Board View        │     shows parent lens
│ ▲▲ From: Active Tasks (CSV) │     and grandparent source
└─────────────────────────────┘
```

**Implementation**:
- Add `_renderParentPreview()` method
- Populate from hierarchy chain
- Show in tooltip or side panel

---

### Phase 3: Source Tree Restructuring

**Goal**: Reorganize sources to show data lineage and relationships

#### 3.1 Multi-Level Source Expansion
Allow deeper source tree navigation:

```
Sources
├── 📁 quarterly_data.csv
│   ├── 📊 Q4 Orders (Set)
│   │   ├── 📋 Table View (Lens)
│   │   │   └── 🔽 High Priority (Focus)
│   │   └── 📊 Kanban Board (Lens)
│   └── 📊 Customer List (Set)
└── 📁 calendar.ics
    └── 📊 Events (Set)
```

**Implementation**:
- Modify `_renderSourcesNav()` (~line 753) for multi-level
- Add expand/collapse at lens and focus levels
- Store expansion state in localStorage

#### 3.2 Provenance Chain Visualization
Show how data flows from source to current view:

```
  Source                  Set                 Lens             Focus
┌─────────┐         ┌───────────┐        ┌──────────┐      ┌─────────┐
│ CSV     │───────▶│ Orders    │───────▶│ Kanban   │────▶│ My Items│
│ Import  │         │ 1,247 rec │        │ Board    │      │ 89 rec  │
└─────────┘         └───────────┘        └──────────┘      └─────────┘
   Dec 27              Created             View type       Filter: owner=me
                       auto-inferred        interpreted
```

**Implementation**:
- Add `_renderProvenanceFlow()` method
- Display as horizontal flow diagram
- Show record count reduction at each level

#### 3.3 Source Grouping Options
Allow users to group sources by:
- **Chronological**: By import date (current default)
- **Type**: By file format (CSV, JSON, ICS, Manual)
- **Workspace**: By associated workspace
- **Status**: Active vs. Superseded

**Implementation**:
- Add `sourceGroupingMode` state
- Add grouping toggle in Sources header
- Persist preference in localStorage

---

### Phase 4: Search & Discovery

**Goal**: Enable finding data by provenance metadata

#### 4.1 Provenance-Aware Search
Extend global search (Ctrl+/) to search by provenance:

```
Search: [from:calendar.ics type:event after:Dec-20    ]

Results:
• Team Meetings (24 records) - from calendar.ics
• All-Hands Events (8 records) - from calendar.ics
```

**Syntax**:
- `from:<filename>` - Filter by source file
- `type:<set-type>` - Filter by data type
- `after:<date>` - Filter by import date
- `method:<import-method>` - Filter by import method

**Implementation**:
- Modify `_handleGlobalSearch()` method
- Add provenance query parser
- Index provenance metadata for fast lookup

#### 4.2 Quick Filters in Sidebar
Add filter chips below Sources header:

```
Sources [+ Filter]
[CSV ×] [This Week ×] [Clear All]
├── 📁 quarterly_data.csv ✓
└── 📁 manual ✗ (filtered out)
```

**Implementation**:
- Add `_renderSourceFilters()` method
- Track active filters in state
- Apply filters to `_renderSourcesNav()`

#### 4.3 Recent Navigation History
Show recently accessed items for quick return:

```
Recent
├── 📋 Board View (2 min ago)
├── 🔽 My Items (5 min ago)
└── 📊 Q4 Orders (10 min ago)
```

**Implementation**:
- Track navigation history in localStorage
- Add `_renderRecentNav()` method
- Limit to last 10 items

---

### Phase 5: Provenance Detail Panel

**Goal**: Provide comprehensive provenance information on demand

#### 5.1 Provenance Info Panel
Add a slide-out panel showing full provenance:

```
┌──────────────────────────────────────┐
│ PROVENANCE: Active Tasks             │
├──────────────────────────────────────┤
│ ▶ EPISTEMIC                          │
│   Agent: production-system-id        │
│   Method: CSV Import (auto-infer)    │
│   Source: quarterly_data.csv         │
│                                      │
│ ▶ SEMANTIC                           │
│   Term: Order Records                │
│   Definition: Q4 sales transactions  │
│   Jurisdiction: North America        │
│                                      │
│ ▶ SITUATIONAL                        │
│   Scale: Record-level                │
│   Timeframe: Oct-Dec 2024            │
│   Background: Q4 sales cycle         │
│                                      │
│ ▶ HISTORY                            │
│   Created: Dec 27, 2024 10:30 AM     │
│   Last modified: Dec 27, 2024 2:15 PM│
│   Version: 3 (2 superseded)          │
└──────────────────────────────────────┘
```

**Implementation**:
- Add `_renderProvenancePanel()` method
- Implement 9-element provenance display
- Add version history timeline
- Trigger via right-click or info button

#### 5.2 Provenance Editing
Allow users to enrich provenance metadata:

**Implementation**:
- Add `_editProvenance()` method
- Form fields for each provenance element
- Validate against EO schema
- Track edit history

#### 5.3 Provenance Export
Export provenance metadata for audit/compliance:

**Formats**:
- JSON (machine-readable)
- Markdown (documentation)
- CSV (spreadsheet analysis)

**Implementation**:
- Add `_exportProvenance()` method
- Support full lineage export (source→set→lens→focus)

---

### Phase 6: Performance Optimizations

**Goal**: Smooth navigation with large datasets

#### 6.1 Virtual Scrolling
Implement virtual scrolling for source tree:

**Implementation**:
- Add `VirtualScroller` class
- Only render visible items + buffer
- Recycle DOM elements on scroll

#### 6.2 Lazy Loading
Load hierarchy levels on demand:

**Implementation**:
- Don't render collapsed children until expanded
- Defer lens/focus loading until set is selected
- Add loading indicators

#### 6.3 Navigation State Caching
Cache navigation states for instant back/forward:

**Implementation**:
- Store last N navigation states
- Restore state on breadcrumb click
- Invalidate on data changes

---

## Implementation Priority

| Phase | Priority | Effort | Impact |
|-------|----------|--------|--------|
| Phase 1: Visual Provenance | High | Medium | High |
| Phase 2: Breadcrumb Navigation | High | Low | High |
| Phase 3: Source Tree | Medium | High | High |
| Phase 4: Search & Discovery | Medium | Medium | Medium |
| Phase 5: Provenance Panel | Low | Medium | Medium |
| Phase 6: Performance | Low | High | High (at scale) |

---

## Recommended First Steps

1. **Clickable breadcrumbs** (Phase 2.1) - Quick win, high impact
2. **Source badges on sets** (Phase 1.1) - Immediate provenance visibility
3. **Multi-level source expansion** (Phase 3.1) - Complete hierarchy view
4. **Recent navigation** (Phase 4.3) - Quick return to previous context

---

## Compatibility Notes

All changes maintain compliance with Experience Ontology Nine Rules:
- Rule 1: All new views typed as `meant`
- Rule 5: Focuses only restrict, never expand
- Rule 7: Provenance preserved and enriched
- Rule 9: No deletions, only supersession

---

## Files to Modify

| File | Changes |
|------|---------|
| `eo_data_workbench.js` | Navigation methods, breadcrumb, source tree |
| `eo_styles.css` | New component styles |
| `index.html` | Provenance panel container, filter chips |
| `eo_view_hierarchy.js` | Provenance chain queries |
| `eo_provenance.js` | Export methods, edit validation |

---

## Success Metrics

- **Discoverability**: Users find data sources in <3 clicks
- **Provenance Clarity**: Users can answer "where did this data come from?" in <5 seconds
- **Navigation Speed**: Return to previous view in <2 clicks
- **Hierarchy Understanding**: Users correctly describe parent-child relationships

---

*Plan created: December 27, 2024*
