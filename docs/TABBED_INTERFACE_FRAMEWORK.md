# Tabbed Interface Framework

## Overview

This document defines the framework for a browser-like tabbed interface in noema. Every view, panel, or content that can be opened should behave as a closeable tab, similar to how browser tabs work.

---

## Core Principles

### 1. Everything is a Tab
Any content that occupies the main workspace area should be openable as a tab:
- Data Sets (grid, cards, kanban, calendar, graph views)
- Sources / Import Data
- Definitions Explorer
- Settings panels
- Schema views
- Activity logs
- Any future content types

### 2. Tabs are Independent
Each tab maintains its own:
- Scroll position
- Selection state
- View configuration
- Undo/redo history (future)

### 3. Browser-Familiar UX
Users should feel at home with familiar browser patterns:
- Click to switch tabs
- Middle-click to close
- Ctrl+Click to open in new tab (when clicking items)
- Drag to reorder
- Right-click for context menu
- Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+Tab)

---

## Tab Types

```typescript
type TabType =
  | 'set'           // Data set with a specific view
  | 'sources'       // Import Data / Sources table
  | 'definitions'   // Definitions Explorer
  | 'schema'        // Schema editor for a set
  | 'settings'      // Settings panel
  | 'activity'      // Activity log
  | 'shortcuts'     // Keyboard shortcuts reference
  | 'welcome'       // Welcome/onboarding tab (pinnable)
```

---

## Tab State Structure

```typescript
interface Tab {
  // Identity
  id: string;                    // Unique tab ID (e.g., "tab-abc123")
  type: TabType;                 // What kind of content this tab shows

  // Display
  title: string;                 // Tab label (e.g., "Projects", "Sources")
  icon: string;                  // Icon identifier
  badge?: number | string;       // Optional count badge
  color?: string;                // Optional accent color

  // Context - varies by type
  context: TabContext;           // Type-specific data

  // State
  isPinned: boolean;             // Pinned tabs can't be closed, stay left
  isDirty: boolean;              // Has unsaved changes (show dot indicator)
  isLoading: boolean;            // Show loading spinner

  // Memory
  scrollPosition?: { x: number; y: number };
  selection?: string[];          // Selected record IDs
  expandedGroups?: string[];     // For grouped views
}

type TabContext =
  | SetTabContext
  | SourcesTabContext
  | DefinitionsTabContext
  | SchemaTabContext
  | SettingsTabContext
  | ActivityTabContext;

interface SetTabContext {
  setId: string;
  viewId?: string;               // Current view within the set
  lensId?: string;               // Optional lens applied
  focusId?: string;              // Optional focus (filter) applied
}

interface SourcesTabContext {
  selectedSourceId?: string;
  viewMode: 'list' | 'detail';
}

interface DefinitionsTabContext {
  selectedDefinitionId?: string;
  filterScope?: string;          // 'all' | 'workspace' | 'set'
}

interface SchemaTabContext {
  setId: string;
}

interface SettingsTabContext {
  section?: string;              // 'general' | 'appearance' | 'sync' | etc.
}

interface ActivityTabContext {
  filterType?: string;           // 'all' | 'changes' | 'imports' | etc.
}
```

---

## Tab Manager State

```typescript
interface TabManagerState {
  // Core state
  tabs: Tab[];                   // Ordered list of all open tabs
  activeTabId: string | null;    // Currently focused tab

  // History
  tabHistory: string[];          // Stack for "back" navigation
  recentlyClosed: Tab[];         // For "reopen closed tab" (max 10)

  // UI State
  isTabBarVisible: boolean;      // Can hide for single-tab mode
  tabBarScrollPosition: number;  // Horizontal scroll offset
}
```

---

## Tab Lifecycle

### Opening a Tab

```
User Action → Check if Tab Exists → If Yes: Activate Existing
                                  → If No: Create New Tab → Add to Tabs → Activate
```

**Deduplication Rules:**
- Set tabs: One tab per setId (switching views doesn't create new tabs)
- Sources tab: Singleton (only one can exist)
- Definitions tab: Singleton
- Schema tabs: One per setId
- Settings tab: Singleton
- Activity tab: Singleton

**Open Behaviors:**
| Action | Default Behavior | With Ctrl/Cmd |
|--------|------------------|---------------|
| Click set in sidebar | Switch to existing or open new + activate | Open new without activating |
| Double-click record | Open detail in current tab | Open detail in new tab |
| Click "Sources" | Switch to Sources tab | - |
| Click "Definitions" | Switch to Definitions tab | - |

### Closing a Tab

```
Close Request → Check if Pinned → If Yes: Reject
             → Check if Dirty → If Yes: Prompt to Save/Discard
             → Remove from Tabs → Add to RecentlyClosed
             → Activate Next Tab (right, then left, then null)
```

**Close Triggers:**
- Click X button on tab
- Middle-click on tab
- Ctrl+W keyboard shortcut
- Right-click → Close
- Right-click → Close Others
- Right-click → Close to the Right

### Switching Tabs

```
Activate Tab → Save Current Tab State (scroll, selection)
            → Update activeTabId
            → Push Previous to History
            → Restore New Tab State
            → Render Content
```

### Reordering Tabs

```
Drag Start → Create Ghost Tab
Drag Move → Update Drop Position Indicator
Drag End → Reorder tabs[] Array → Save State
```

**Constraints:**
- Pinned tabs stay at the left, can only reorder among pinned
- Unpinned tabs can't move left of pinned tabs

---

## Tab Bar UI

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [←] │ 📌Tab1 │ 📌Tab2 │ Tab3 │ Tab4 │ Tab5 │ ... │ [+] │ [▼] │ [→]    │
└─────────────────────────────────────────────────────────────────────────┘
      └─────────────────────────────────────────┘
                    Scrollable Area
```

- `[←][→]` - Scroll buttons (appear when tabs overflow)
- `📌` - Pinned indicator
- `[+]` - New tab button (opens tab picker or empty tab)
- `[▼]` - Tab list dropdown (shows all tabs, search)

### Tab Visual States

```
┌────────────────┐
│ 🔵 Icon  Title │ ← Normal tab
└────────────────┘

┌────────────────┐
│ 🔵 Icon  Title │ ← Active tab (elevated, connected to content)
└═══════════════─┘

┌────────────────┐
│ 🔵 Icon  Ti●le │ ← Dirty tab (unsaved indicator)
└────────────────┘

┌────────────────┐
│ 📌 Icon  Title │ ← Pinned tab (no close button, compact)
└────────────────┘

┌────────────────┐
│ ◌  Icon  Title │ ← Loading tab (spinner)
└────────────────┘
```

### Tab Sizing

| State | Width | Shows |
|-------|-------|-------|
| Normal | 150-200px | Icon + Title + Badge + Close |
| Compressed | 100-150px | Icon + Truncated Title + Close |
| Pinned | 40px | Icon only |
| Minimum | 40px | Icon only (many tabs) |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | New tab (open tab picker) |
| `Ctrl+W` | Close current tab |
| `Ctrl+Shift+T` | Reopen last closed tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+1-9` | Switch to tab 1-9 |
| `Ctrl+Shift+W` | Close all tabs |
| `Alt+←` | Back (tab history) |
| `Alt+→` | Forward (tab history) |

---

## Context Menu

Right-click on a tab shows:

```
┌─────────────────────────┐
│ Pin Tab                 │
│ Duplicate Tab           │
├─────────────────────────┤
│ Rename...               │  (for sets only)
│ Change Color...         │  (for sets only)
├─────────────────────────┤
│ Close                   │
│ Close Others            │
│ Close Tabs to the Right │
│ Close All               │
├─────────────────────────┤
│ Reopen Closed Tab       │
└─────────────────────────┘
```

---

## Tab Picker / New Tab Page

When pressing `+` or `Ctrl+T`:

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Search tabs and content...                              │
├─────────────────────────────────────────────────────────────┤
│  RECENTLY CLOSED                                            │
│  ├─ 📊 Projects (closed 2m ago)                            │
│  └─ 📋 Tasks (closed 5m ago)                               │
├─────────────────────────────────────────────────────────────┤
│  OPEN NEW                                                   │
│  ├─ 📥 Sources                                             │
│  ├─ 📖 Definitions                                         │
│  ├─ ⚙️ Settings                                            │
│  └─ 📋 Activity                                            │
├─────────────────────────────────────────────────────────────┤
│  SETS                                                       │
│  ├─ 📊 Projects (9 records)                                │
│  ├─ 📊 Tasks (4 records)                                   │
│  └─ 📊 Bugs (3 records)                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Persistence

### What Gets Saved

```typescript
interface PersistedTabState {
  tabs: Array<{
    id: string;
    type: TabType;
    context: TabContext;
    isPinned: boolean;
  }>;
  activeTabId: string | null;
  recentlyClosed: Array<{
    tab: Tab;
    closedAt: number;
  }>;
}
```

### When to Save
- On tab open/close
- On tab reorder
- On tab pin/unpin
- On app blur (losing focus)
- Debounced (500ms) after any change

### Restoration
On app load:
1. Load persisted state
2. Validate tabs (remove tabs for deleted sets)
3. Restore scroll positions after render
4. Activate last active tab

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Create `TabManager` class with state management
- [ ] Define `Tab` interface and types
- [ ] Implement basic open/close/activate
- [ ] Wire up to existing tab bar rendering

### Phase 2: Full Tab Types
- [ ] Implement all TabType handlers
- [ ] Create tab content routers
- [ ] Add context-specific rendering

### Phase 3: Enhanced UX
- [ ] Add keyboard shortcuts
- [ ] Implement drag-and-drop reorder
- [ ] Add context menus
- [ ] Implement tab pinning

### Phase 4: Advanced Features
- [ ] Tab history (back/forward)
- [ ] Recently closed tabs
- [ ] Tab picker / new tab page
- [ ] Tab search

### Phase 5: Polish
- [ ] Tab overflow handling
- [ ] Animations and transitions
- [ ] Accessibility (ARIA, focus management)
- [ ] Performance optimization (lazy loading)

---

## Design Decisions

### Q: Should views within a set be separate tabs?
**A: No.** A set is a single tab. Switching views (grid, kanban, etc.) happens within the tab. This matches the mental model of "I'm working with Projects" rather than "I'm looking at the Projects grid".

### Q: Should clicking a set in the sidebar always activate that tab?
**A: Yes.** The sidebar is for navigation. Clicking always takes you there. Use Ctrl+Click for "open in background".

### Q: What happens when all tabs are closed?
**A: Show the welcome/empty state.** The tab bar can show a single "New Tab" placeholder, or a welcome page with quick actions.

### Q: Should tab state survive browser refresh?
**A: Yes.** All tab state is persisted to localStorage. Users should return to exactly where they left off.

### Q: Maximum number of tabs?
**A: No hard limit.** The UI should gracefully handle many tabs via scrolling and compression. Consider tab grouping for power users in the future.

---

## Migration Path

To migrate from the current implicit tab system:

1. **Extract current tab logic** from `_renderTabBar()` into `TabManager`
2. **Map existing state** to new Tab structure:
   - `currentSetId` → SetTab with setId
   - `currentSourceId === 'sources-table'` → SourcesTab
   - `isViewingDefinitions` → DefinitionsTab
3. **Replace implicit flags** with explicit `tabs[]` array
4. **Update all callers** to use `TabManager.openTab()` / `TabManager.closeTab()`
5. **Preserve backward compatibility** for saved data (migrate on load)

---

## Future Considerations

### Tab Groups
Group related tabs together (like Chrome tab groups):
```
[Pinned] [Project Work ▼] [Research ▼] [Tab6]
              ├─ Tab2
              ├─ Tab3         ├─ Tab4
              └─ Tab5         └─ Tab7
```

### Split View
Open two tabs side-by-side:
```
┌──────────────────┬──────────────────┐
│      Tab A       │      Tab B       │
│    (Content)     │    (Content)     │
└──────────────────┴──────────────────┘
```

### Tab Sessions
Save and restore entire tab configurations:
- "Project Planning" session → Opens Projects, Tasks, Calendar
- "Bug Triage" session → Opens Bugs, Activity, Definitions

### Floating Tabs
Pop out a tab into a separate window (for multi-monitor setups).
