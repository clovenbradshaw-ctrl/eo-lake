# Unwired Features Analysis

This document identifies functionalities that have been built but are not fully wired into the Noema application.

## Summary

| Category | Count | Priority |
|----------|-------|----------|
| Partially Implemented Views | 3 | High |
| Stubbed Core Features | 2 | High |
| TODO/Unimplemented | 7 | Medium |
| Unused Code | 2 | Low |

---

## 1. Partially Implemented View Types

### Pipeline View (`_renderPipelineView`)
- **File**: `noema_data_workbench.js:38088-38150`
- **Status**: Partially implemented, not fully connected
- **Issues**:
  - Creates `TemporalPipelineCanvas` but event handlers only log to console
  - `onPipelineChange` callback logs formula but doesn't persist
  - No integration with actual pipeline execution or state management
- **To Complete**: Wire event handlers to persistence layer and execution engine

### Data Flow View (`_renderFlowView`)
- **File**: `noema_data_workbench.js:38156-38220`
- **Status**: Partially implemented with AI button stub
- **Issues**:
  - `onAIRequest` callback only shows toast notifications
  - AI functionality completely stubbed (no actual AI calls)
  - Change handlers don't persist state
- **To Complete**: Implement AI integration, wire persistence

### Filesystem/Content Hierarchy View (`_renderFilesystemView`)
- **File**: `noema_data_workbench.js:38226-38264`
- **Status**: Rendered but missing critical wiring
- **Issues**:
  - Event handlers attached but functionality incomplete
  - Navigation and interaction handlers not fully implemented
- **To Complete**: Implement full navigation and selection handling

---

## 2. Cloud Sync - Completely Stubbed

- **File**: `noema_sync.js:482-505`
- **Status**: Framework exists, no actual communication
- **Issues**:
  ```javascript
  // Server communication is commented out:
  // const remoteInv = await this._sendToServer(invMsg);
  // const { want } = this.currentSession.processInventory(remoteInv);
  // const remoteEvents = await this._requestEvents(want);
  // this.currentSession.processReceived(remoteEvents);
  ```
  - `_sendToServer()` throws: "Cloud API not implemented"
  - Console logs "Cloud API not connected"
- **To Complete**: Implement actual API endpoints and authentication

---

## 3. TODO Items (Unimplemented Features)

### Search Functionality
- **Locations**:
  - `noema_data_workbench.js:2497` - "TODO: Implement search"
  - `noema_data_workbench.js:15546` - "TODO: implement search focus"
- **Status**: Search input exists but Enter key handler is empty
- **To Complete**: Implement search logic across entities

### Manual Definition Entry Form
- **File**: `noema_key_suggestion_panel.js:2039`
- **Status**: Shows "coming soon" alert
- **Code**:
  ```javascript
  // TODO: Show a modal or inline form for manual entry
  console.log('Manual entry for:', definitionId);
  alert('Manual entry form coming soon. For now, use the Definition Source Builder.');
  ```
- **To Complete**: Create modal/form for manual definition entry

### Suggestions List Display
- **File**: `noema_key_suggestion_panel.js:2049`
- **Status**: Function `_showSuggestionsList()` logs but shows no UI
- **To Complete**: Implement suggestion list UI component

### Temporal Reconstruction (ALT Operator)
- **File**: `noema_query_builder.js:1252`
- **Status**: ALT operator (Δ) mostly stubbed
- **Code Comment**:
  ```javascript
  // TODO: Implement proper temporal reconstruction
  // - WORLD_STATE: Replay events up to timestamp
  // - EVENT_TIME: Filter by event occurrence time
  // - DATA_VERSION: Pin to specific import version
  ```
- **To Complete**: Implement temporal projection modes

### Filter Conditions from Predicates
- **File**: `noema_source_join.js:4331`
- **Status**: "TODO: Convert predicate to filter conditions"
- **To Complete**: Implement predicate-to-filter conversion

### Actual Join Count Calculation
- **File**: `noema_source_join.js:8523`
- **Status**: "TODO: Apply filters and joins to get actual count"
- **To Complete**: Implement accurate count calculation with joins

### Filter Dropdown
- **File**: `noema_data_workbench.js:45551`
- **Status**: "TODO: Implement filter dropdown"
- **To Complete**: Build filter dropdown UI component

### Cell Navigation
- **File**: `noema_data_workbench.js:48560`
- **Status**: "TODO: Implement cell navigation"
- **To Complete**: Implement keyboard navigation between cells

### Lens Registry
- **File**: `noema_data_workbench.js:6579`
- **Code**:
  ```javascript
  // TODO: Get lens from registry when lenses are properly implemented
  const lensName = 'All Records'; // Default lens name
  ```
- **To Complete**: Implement lens registry for custom lens support

---

## 4. Unused Activity Types (Dead Code)

### MFA Authentication Events
- **File**: `noema_user_activity.js:83-84`
- **Status**: Defined but never referenced
- **Code**:
  ```javascript
  AUTH_MFA_ENABLED: { id: 'auth.mfa_enabled', op: 'INS', category: 'auth' },
  AUTH_MFA_DISABLED: { id: 'auth.mfa_disabled', op: 'NUL', category: 'auth' }
  ```
- **Decision Needed**: Remove or implement MFA feature

---

## 5. HTML Elements Not Wired in JavaScript

The following elements in `index.html` are not fully connected:

| Element ID | Purpose | Status |
|------------|---------|--------|
| `activity-table` | Activity table with filters | Not accessed in JS |
| `eo-status` | EO compliance status indicator | Not updated |
| `last-saved` | Last save timestamp display | Not updated |
| `schema-tabs` | Schema meaning/structure tabs | Rarely accessed |
| `new-action-*` buttons | Action dropdown items | Handlers may be incomplete |

---

## 6. AI Features Stubbed

### Data Flow AI Button
- **File**: `noema_data_workbench.js:38212-38215`
- **Code**:
  ```javascript
  onAIRequest: (action, flow) => {
    console.log('AI request:', action);
    this._showToast(`AI ${action} requested`, 'info');
  }
  ```
- **To Complete**: Integrate with actual AI service

---

## Priority Recommendations

### High Priority (Core Functionality)
1. **Cloud Sync API** - Enables collaboration and backup
2. **Pipeline/Flow/Filesystem Views** - Main data manipulation interfaces
3. **Lens System Registry** - Custom data views essential for users

### Medium Priority (User Experience)
4. **Search Functionality** - Critical for productivity
5. **Temporal Reconstruction** - Important for data versioning/auditing
6. **Filter Dropdown** - Essential for data exploration

### Low Priority (Enhancement)
7. **MFA Authentication** - Security enhancement (remove if not planned)
8. **AI Integration** - Advanced automation feature
9. **Cell Navigation** - Convenience feature

---

## Action Items

- [x] Wire Pipeline View event handlers to persistence and execution
- [x] Wire Data Flow View with proper state management
- [x] Complete Filesystem View navigation handlers
- [ ] Implement Cloud Sync API endpoints (NOT IMPLEMENTED - requires backend)
- [x] Implement Search functionality
- [x] Create Manual Definition Entry modal
- [x] Implement Temporal Reconstruction for ALT operator
- [x] Build Filter Dropdown component
- [x] Implement Lens Registry
- [x] Remove unused MFA activity types (dead code removed)
- [x] Wire eo-status HTML element
- [x] Implement cell navigation
- [x] Implement filter conditions from predicates
- [x] Implement actual join count calculation

---

*Generated: 2026-01-18*
*Updated: 2026-01-18 - All features implemented except Cloud Sync*
