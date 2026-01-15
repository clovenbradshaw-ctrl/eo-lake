# Design Brief: Temporal Pipeline Cooking

**Feature Name**: Temporal Pipeline
**Status**: Proposed
**Author**: Research synthesis from TouchDesigner patterns
**Date**: January 2026

---

## Executive Summary

Build a visual pipeline editor that lets users construct data transformations using Noema's Nine Operators, with the unique ability to scrub through time and watch the pipeline re-evaluate at any historical timestamp. This combines TouchDesigner's real-time "cooking" model with Noema's immutable event log to create a capability no existing tool offers.

---

## Problem Statement

**Current State**:
- Formulas are text-based pipelines: `{Orders} → CON(Customer) → SEG(Status="Complete") → SYN(SUM Amount)`
- Users cannot see intermediate results between operators
- Time-travel queries (ALT/AS_OF) exist but are invisible and programmatic
- No way to visualize how data evolved over time through a transformation

**User Pain Points**:
1. Hard to debug complex formulas without seeing intermediate steps
2. Cannot answer "what did this show last month?" without manual queries
3. No visual feedback when building multi-step transformations
4. Audit trail exists but isn't experiential

---

## Vision

**One-liner**: Scrub a timeline, watch your data pipeline cook.

**Core Experience**: A user drags operators onto a canvas, wires them together, and sees live previews at each node. A timeline scrubber at the bottom lets them slide through history—the entire pipeline re-evaluates, showing exactly what the data looked like at any point in time.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Temporal Pipeline Editor                                      [×] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐         │
│  │ Orders  │───▶│  CON    │───▶│  SEG    │───▶│  SYN    │         │
│  │  (Set)  │    │Customer │    │Complete │    │SUM Amt  │         │
│  │ ─────── │    │ ─────── │    │ ─────── │    │ ─────── │         │
│  │ 150 rec │    │ 150 rec │    │  42 rec │    │ $12,450 │         │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘         │
│                                                                     │
│  ◀ ════════════════════●══════════════════════════════════════ ▶  │
│    Jan        Feb      Mar ▲      Apr        May        Jun        │
│                            │                                        │
│                      Current: March 15, 2026                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Pipeline Canvas

A visual editor where users build data transformations:

| Element | Description |
|---------|-------------|
| **Source Node** | Starting point—a Set, Lens, or Focus |
| **Operator Node** | One of the Nine Operators (CON, SEG, SYN, ALT, DES, NUL, INS, REC, SUP) |
| **Wire** | Connection showing data flow between nodes |
| **Preview** | Live mini-view of data at each node |

### 2. Cooking

Borrowed from TouchDesigner—when inputs change, downstream nodes re-evaluate:

- **Dirty propagation**: Change at node N marks all downstream nodes dirty
- **Lazy evaluation**: Only cook nodes that are visible or needed for output
- **Cache invalidation**: Timestamp change invalidates all caches

### 3. Temporal Scrubbing

The timeline scrubber sets a global `AS_OF` timestamp:

```
horizon = {
  ...currentHorizon,
  asOf: scrubberTimestamp
}
```

All nodes query the event store with this horizon, seeing only events that existed at that timestamp.

### 4. Keyframes

Significant moments auto-detected or user-marked:

- **Import events**: When new GIVEN data arrived
- **Schema changes**: When fields were added/renamed
- **Interpretation events**: When MEANT events were created
- **User bookmarks**: Manual markers for "interesting" moments

---

## User Stories

### Primary

**US1**: As a data analyst, I want to build formulas visually so I can see intermediate results and debug issues.

**US2**: As an auditor, I want to scrub through time and see exactly what the data showed on any historical date.

**US3**: As a team lead, I want to compare the same pipeline at two different dates to understand how our metrics changed.

### Secondary

**US4**: As a power user, I want to detect loops or drift by running a pipeline across a time range and seeing the trend.

**US5**: As a curious user, I want to watch records appear as I scrub forward through import events (provenance animation).

**US6**: As a hypothesis tester, I want to fork at a timestamp, make a change, and compare the two trajectories.

---

## Functional Requirements

### Pipeline Editor (P0 - Must Have)

| ID | Requirement |
|----|-------------|
| PE-1 | Drag-and-drop operator nodes from a palette onto canvas |
| PE-2 | Wire nodes together by dragging from output port to input port |
| PE-3 | Delete nodes and wires with keyboard or context menu |
| PE-4 | Each node displays a live preview (record count, sample values, or mini-table) |
| PE-5 | Selecting a node shows detailed output in an inspector panel |
| PE-6 | Pipeline auto-saves as user builds (creates MEANT events) |
| PE-7 | Generate text formula from visual pipeline for use in formula fields |

### Temporal Controls (P0 - Must Have)

| ID | Requirement |
|----|-------------|
| TC-1 | Timeline scrubber spanning from first event to now |
| TC-2 | Dragging scrubber re-cooks entire pipeline at that timestamp |
| TC-3 | Keyframe markers shown on timeline (imports, schema changes) |
| TC-4 | Click keyframe to jump to that timestamp |
| TC-5 | Play button animates through time at configurable speed |
| TC-6 | Current timestamp displayed prominently |

### Operator Nodes (P0 - Must Have)

| Operator | Node Behavior |
|----------|---------------|
| **Source** | Select Set/Lens/Focus; outputs all records at current timestamp |
| **CON** | Configure join field; shows joined record count |
| **SEG** | Configure filter predicate; shows filtered count |
| **SYN** | Configure aggregation (SUM, COUNT, etc.); shows result |
| **ALT** | Configure transformation; shows before/after sample |
| **DES** | Configure field projection; shows selected fields |
| **NUL** | Configure null handling; shows null count |

### Comparison Mode (P1 - Should Have)

| ID | Requirement |
|----|-------------|
| CM-1 | Split view showing pipeline at two timestamps side-by-side |
| CM-2 | Highlight differences between the two states |
| CM-3 | Lock one side while scrubbing the other |
| CM-4 | Export comparison as report |

### Loop Detection (P2 - Nice to Have)

| ID | Requirement |
|----|-------------|
| LD-1 | Run pipeline across time range, collect output at each step |
| LD-2 | Chart output values over time |
| LD-3 | Detect convergence, divergence, or oscillation patterns |
| LD-4 | Alert if feedback loop detected in linked data |

---

## Technical Architecture

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Timeline   │────▶│   Horizon    │────▶│  Event Store │
│   Scrubber   │     │   Builder    │     │    Query     │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Pipeline   │
                     │    Graph     │
                     └──────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  Node 1  │  │  Node 2  │  │  Node 3  │
        │  cook()  │  │  cook()  │  │  cook()  │
        └──────────┘  └──────────┘  └──────────┘
              │             │             │
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Preview  │  │ Preview  │  │ Preview  │
        │ Renderer │  │ Renderer │  │ Renderer │
        └──────────┘  └──────────┘  └──────────┘
```

### Core Classes

```javascript
class TemporalPipeline {
  nodes: PipelineNode[]
  wires: Wire[]
  horizon: Horizon

  setTimestamp(t: number): void    // Update horizon.asOf, trigger re-cook
  cook(): void                      // Evaluate all dirty nodes
  toFormula(): string               // Generate text formula
  fromFormula(f: string): void      // Parse text formula into nodes
}

class PipelineNode {
  id: string
  operator: Operator               // CON, SEG, SYN, etc.
  config: OperatorConfig           // Parameters for this operator
  inputs: Wire[]
  outputs: Wire[]
  cache: CachedResult | null
  dirty: boolean

  cook(horizon: Horizon): Result   // Evaluate this node
  preview(): PreviewData           // Generate preview for display
  markDirty(): void                // Propagate dirty to downstream
}

class TimelineScrubber {
  min: number                      // First event timestamp
  max: number                      // Now
  current: number                  // Scrubber position
  keyframes: Keyframe[]            // Significant moments

  onScrub(callback: (t: number) => void): void
  jumpToKeyframe(k: Keyframe): void
  play(speed: number): void
}
```

### Integration Points

| System | Integration |
|--------|-------------|
| **Event Store** | Query with horizon.asOf for temporal filtering |
| **Formula Engine** | Reuse existing operator implementations |
| **Event Bus** | Emit events when pipeline is saved |
| **View System** | Pipeline can be attached to a Set as a view |

### Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Large datasets | Lazy evaluation—only cook visible nodes |
| Scrubbing performance | Debounce scrubber (16ms), cache recent timestamps |
| Memory | LRU cache for cooked results, evict old timestamps |
| Initial load | Progressive loading—cook source first, then downstream |

---

## User Interface Design

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Palette]              [Canvas]                    [Inspector]     │
│  ┌────────┐  ┌─────────────────────────────────────┐ ┌───────────┐ │
│  │ Source │  │                                     │ │ Node: SEG │ │
│  │ CON    │  │   [Visual pipeline graph]           │ │           │ │
│  │ SEG    │  │                                     │ │ Filter:   │ │
│  │ SYN    │  │                                     │ │ Status =  │ │
│  │ ALT    │  │                                     │ │ Complete  │ │
│  │ DES    │  │                                     │ │           │ │
│  │ NUL    │  │                                     │ │ Records:  │ │
│  │        │  │                                     │ │ 42 of 150 │ │
│  └────────┘  └─────────────────────────────────────┘ └───────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┤
│  │ ◀ ═══════════════════●════════════════════════════════════ ▶   │
│  │   Jan     Feb     Mar ▲    Apr     May     Jun                  │
│  │                 [▶ Play]  [⏸ Pause]  Speed: [1x ▾]              │
│  └─────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

### Node Design

```
┌─────────────────┐
│ ● SEG           │  ← Operator type with color indicator
├─────────────────┤
│ Status=Complete │  ← Configuration summary
├─────────────────┤
│ ┌─────────────┐ │
│ │ 42 records  │ │  ← Live preview
│ │ ░░░░░░░░░░  │ │  ← Mini visualization (bar = % of input)
│ └─────────────┘ │
├─────────────────┤
│ ○ in      out ○ │  ← Connection ports
└─────────────────┘
```

### Timeline Design

```
┌─────────────────────────────────────────────────────────────────┐
│  ◀│                                                          │▶ │
│   ├────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┤  │
│   │    │    │▼   │    │▼   │    │    │▼   │    │    │    │    │  │
│   Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec     │
│             ▲import   ▲schema      ▲import                       │
│                                                                  │
│           ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│           ↑ Current position                                     │
│                                                                  │
│  [◀◀] [▶ Play] [▶▶]    Speed: [1x]    March 15, 2026 14:32:01   │
└─────────────────────────────────────────────────────────────────┘
```

### Interaction Patterns

| Action | Behavior |
|--------|----------|
| Drag from palette | Create new node at drop location |
| Drag from port | Create wire, snap to compatible port |
| Click node | Select, show in inspector |
| Double-click node | Open configuration modal |
| Drag on canvas | Pan view |
| Scroll wheel | Zoom in/out |
| Drag scrubber | Smoothly re-cook pipeline |
| Click keyframe | Jump to that timestamp |
| Spacebar | Play/pause timeline animation |

---

## Implementation Phases

### Phase 1: Static Pipeline Editor

**Goal**: Build formulas visually without temporal features.

| Task | Description |
|------|-------------|
| 1.1 | Canvas component with pan/zoom |
| 1.2 | Node component with ports |
| 1.3 | Wire component with bezier curves |
| 1.4 | Operator palette |
| 1.5 | Node configuration inspector |
| 1.6 | Cook engine (evaluate pipeline) |
| 1.7 | Preview renderer for each node |
| 1.8 | Formula ↔ pipeline bidirectional conversion |

**Deliverable**: Users can build formulas visually and see live previews.

### Phase 2: Temporal Scrubbing

**Goal**: Add timeline and AS_OF integration.

| Task | Description |
|------|-------------|
| 2.1 | Timeline scrubber component |
| 2.2 | Keyframe detection from event store |
| 2.3 | Horizon integration (asOf parameter) |
| 2.4 | Cache invalidation on timestamp change |
| 2.5 | Debounced re-cooking during scrub |
| 2.6 | Timestamp display and formatting |
| 2.7 | Playback controls (play, pause, speed) |

**Deliverable**: Users can scrub through time and watch pipeline re-evaluate.

### Phase 3: Comparison & Analysis

**Goal**: Side-by-side views and loop detection.

| Task | Description |
|------|-------------|
| 3.1 | Split view for two timestamps |
| 3.2 | Diff highlighting between states |
| 3.3 | Time range execution (loop detection) |
| 3.4 | Output charting over time |
| 3.5 | Convergence/divergence alerts |
| 3.6 | Export comparison report |

**Deliverable**: Users can compare timepoints and analyze trends.

### Phase 4: Polish & Integration

**Goal**: Production-ready feature.

| Task | Description |
|------|-------------|
| 4.1 | Keyboard shortcuts |
| 4.2 | Undo/redo for pipeline edits |
| 4.3 | Save/load named pipelines |
| 4.4 | Attach pipeline to Set as view type |
| 4.5 | Performance optimization |
| 4.6 | Documentation and help |

**Deliverable**: Feature complete and integrated into Noema.

---

## Success Criteria

### Functional

| Metric | Target |
|--------|--------|
| Pipeline creation | User can build 5-node pipeline in < 2 minutes |
| Temporal scrubbing | Scrubbing 1 year of history feels smooth (< 100ms per frame) |
| Accuracy | Pipeline output matches text formula output exactly |
| Persistence | Pipelines survive page refresh |

### Usability

| Metric | Target |
|--------|--------|
| Discoverability | 80% of users find temporal scrubber without prompting |
| Comprehension | Users correctly interpret pipeline flow on first viewing |
| Error recovery | Clear feedback when pipeline has invalid configuration |

### Performance

| Metric | Target |
|--------|--------|
| Initial load | Pipeline with 10 nodes loads in < 500ms |
| Cook time | 5-node pipeline over 1000 records cooks in < 100ms |
| Scrub latency | Preview updates within 16ms of scrubber movement |
| Memory | < 50MB additional memory for pipeline editor |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance with large datasets | Scrubbing feels laggy | Lazy evaluation, sampling for previews |
| Complexity of visual editor | Long development time | Use existing library (e.g., React Flow) |
| Formula parity | Visual pipeline differs from text | Share operator implementations, round-trip tests |
| User confusion | Too many concepts at once | Progressive disclosure, good defaults |
| Event store load | Many temporal queries | Query caching, batch requests |

---

## Open Questions

1. **Canvas library**: Build custom vs. use React Flow / Rete.js?
2. **Preview fidelity**: Mini-table vs. summary stats vs. sparkline?
3. **Persistence**: Store pipeline as MEANT event or separate structure?
4. **Entry point**: New view type, or separate mode in formula editor?
5. **Mobile**: Should this work on touch devices?

---

## Appendix: Operator Node Specifications

### Source Node

```
┌─────────────────┐
│ ● SOURCE        │
├─────────────────┤
│ Orders (Set)    │
├─────────────────┤
│ 150 records     │
│ 12 fields       │
├─────────────────┤
│           out ○ │
└─────────────────┘
```

Config: Select Set, Lens, or Focus from dropdown.

### CON (Connect/Join)

```
┌─────────────────┐
│ ● CON           │
├─────────────────┤
│ → Customers     │
│ via: customerId │
├─────────────────┤
│ 150 → 150       │
│ 45 unique joins │
├─────────────────┤
│ ○ in      out ○ │
└─────────────────┘
```

Config: Target Set, join field.

### SEG (Segment/Filter)

```
┌─────────────────┐
│ ● SEG           │
├─────────────────┤
│ Status=Complete │
├─────────────────┤
│ 150 → 42        │
│ ████████░░░ 28% │
├─────────────────┤
│ ○ in      out ○ │
└─────────────────┘
```

Config: Filter predicate builder.

### SYN (Synthesize/Aggregate)

```
┌─────────────────┐
│ ● SYN           │
├─────────────────┤
│ SUM(Amount)     │
├─────────────────┤
│ $12,450.00      │
│ from 42 records │
├─────────────────┤
│ ○ in      out ○ │
└─────────────────┘
```

Config: Aggregation function, field.

### ALT (Alter/Transform)

```
┌─────────────────┐
│ ● ALT           │
├─────────────────┤
│ Amount * 1.1    │
├─────────────────┤
│ $100 → $110     │
│ $250 → $275     │
├─────────────────┤
│ ○ in      out ○ │
└─────────────────┘
```

Config: Transformation expression.

### DES (Designate/Project)

```
┌─────────────────┐
│ ● DES           │
├─────────────────┤
│ → Name          │
├─────────────────┤
│ "Acme Corp"     │
│ "Beta Inc"      │
├─────────────────┤
│ ○ in      out ○ │
└─────────────────┘
```

Config: Field to project.

### NUL (Null Handling)

```
┌─────────────────┐
│ ● NUL           │
├─────────────────┤
│ Default: 0      │
├─────────────────┤
│ 3 nulls → 0     │
├─────────────────┤
│ ○ in      out ○ │
└─────────────────┘
```

Config: Default value or filter behavior.

---

## References

- [TouchDesigner Cooking Model](https://docs.derivative.ca/Cook)
- [Noema Formula Engine](../js/noema_formula_engine.js)
- [Noema Nine Operators](../js/noema_nine_operators.js)
- [React Flow](https://reactflow.dev/) - Potential canvas library
