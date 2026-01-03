# Noema Bug Report

*Last Updated: January 3, 2026*

This document tracks bugs discovered during application testing.

---

## Bug #1: Schema Inference Issues

**Status:** Fixed
**Severity:** High
**Component:** Data Import / Schema Detection

**Description:**
Schema inference was not working correctly when importing data files. The system failed to properly detect column types or misidentified data types during the import process.

**Root Cause:**
- Regex patterns for type detection were too loose (email, phone, date, number)
- Date pattern missing end anchor, allowing invalid matches
- SELECT type detection overrode specific types like email/date
- Date parsing didn't validate month/day values

**Fix Applied:**
- Improved regex patterns in `eo_import.js`:
  - Email: now requires 2+ char TLD
  - Phone: stricter digit group pattern
  - Date: added end anchor and optional timezone
  - Number: proper decimal handling (no trailing dots)
- Fixed type detection order: specific types now checked before SELECT
- Added month/day validation in date parsing
- Improved year pivot for 2-digit years (00-29 -> 2000s, 30-99 -> 1900s)

---

## Bug #2: View Creation Issues

**Status:** Fixed
**Severity:** High
**Component:** Views

**Description:**
Creating new views would silently fail if no set was selected, with no user feedback.

**Fix Applied:**
- Added validation in `_showCreateViewModal()` and `_createNewView()` to check if set exists
- Added user-friendly warning toast when no set is selected
- Ensured views array is initialized if missing

---

## Bug #3: UI Truncation Issues

**Status:** Fixed
**Severity:** Medium
**Component:** UI / Display

**Description:**
Text content in the UI was being truncated without adequate means to view the complete content.

**Fix Applied:**
- Expand buttons now show dimmed (30% opacity) by default instead of hidden
- On touch devices, expand buttons always visible (70% opacity)
- Added title/tooltip attributes to TEXT fields (for content >50 chars)
- Added title/tooltip attributes to LONG_TEXT fields (shows preview of first 200 chars)

---

## Bug #4: Unresponsive "Add Source" Area

**Status:** Fixed
**Severity:** High
**Component:** Data Sources

**Description:**
The "Add Source" area was unresponsive on smaller screens due to poor mobile/responsive styling.

**Fix Applied:**
- Added error handling and user feedback in `_showImportModal()`
- Added responsive modal styles for screens <768px and <480px
- Modal now properly scales on mobile devices
- Button layout adjusts for narrow screens

---

## Bug #5: Non-Functional "New Field" Command

**Status:** Fixed
**Severity:** High
**Component:** Fields / Schema

**Description:**
The "New Field" command did not work when no set was selected, silently failing without user feedback.

**Root Cause:**
- `_showAddFieldMenu()` didn't validate if a set was selected
- `_addField()` silently returned if no set was found

**Fix Applied:**
- Added validation in `_showAddFieldMenu()` to check for current set
- Added warning toast: "Please select a set first to add a new field"
- `_addField()` now returns `null` and shows warning instead of silent failure

---

## Bug #6: Cannot View Records of Large Dataset

**Status:** Fixed
**Severity:** Critical
**Component:** Data Display / Record Viewing

**Description:**
After importing the `organizations-100000.csv` dataset (100,000 records), users were unable to view records due to performance issues.

**Root Cause:**
- AUTONUMBER field used `findIndex()` on entire record set for each cell
- History count lookup called for every cell, even in large datasets
- No limit on "Load All" causing browser freeze with 100k records

**Fix Applied:**
- AUTONUMBER now uses cached index map instead of `findIndex()`
- History lookup skipped for datasets >1000 records (loaded on-demand)
- Added max displayable record limit (5,000) with user warning
- Smaller batch sizes (100) for large datasets
- User notification: "Use filters or search to narrow results"

---

## Bug #7: Link Field Creation Across Sets

**Status:** Fixed
**Severity:** High
**Component:** Fields / LINK Type

**Description:**
When creating a LINK field to connect records across different sets, the preview dropdown and link editor showed empty results for sets with records stored in IndexedDB. Users could not see or select records from other sets to link to.

**Root Cause:**
- `_showLinkedSetSelectionModal()` accessed `set.records` directly without checking if records needed to be loaded from IndexedDB
- `_renderLinkEditor()` accessed `linkedSet.records` without ensuring IndexedDB data was loaded first
- For large datasets stored in IndexedDB, records were not loaded until explicitly accessed

**Fix Applied:**
- Made `updatePreview()` function async and added loading indicator
- Added call to `_ensureSetRecords()` before accessing records in preview
- Made `_renderLinkEditor()` async with IndexedDB loading support
- Added loading state UI while records are being fetched from IndexedDB

---

## Bug #8: Clearing Multiple Record Selections

**Status:** Fixed
**Severity:** Medium
**Component:** Table View / Selection

**Description:**
After selecting multiple records in the table view, the "select all" checkbox in the header did not properly reflect the selection state. Clearing the selection via the close button sometimes left the header checkbox in an incorrect state.

**Root Cause:**
- The "select-all" checkbox was rendered without checking current selection state
- No support for indeterminate state when some (but not all) records were selected
- Selection state wasn't properly synchronized during table re-renders

**Fix Applied:**
- Added `allSelected` and `someSelected` state calculations in `_renderTableView()`
- Select-all checkbox now renders with proper `checked` attribute based on selection
- Added indeterminate state support via `data-indeterminate` attribute and JavaScript property
- Selection state properly updates when records are selected/deselected

---

## Bug #9: Tab Navigation Data Loss

**Status:** Fixed
**Severity:** High
**Component:** Browser Tabs / Cell Editing

**Description:**
When editing a cell and switching to another tab before committing the change, the edit would be lost. The data entered in the cell would disappear without being saved.

**Root Cause:**
- `activateTab()` function switched tabs without checking for pending cell edits
- The `_syncStateFromTab()` and `_renderTabContent()` calls would overwrite the editing cell
- No mechanism to commit edits before tab navigation

**Fix Applied:**
- Added check for `this.editingCell` at the start of `activateTab()`
- Now calls `_endCellEdit()` to commit pending changes before tab switch
- Cell data is now saved even when navigating away via tab switching

---

## Bug #10: Missing Persistence After Page Refresh

**Status:** Fixed
**Severity:** Critical
**Component:** Data Persistence / Storage

**Description:**
After editing data and refreshing the page, changes were sometimes lost. This was particularly problematic for users who expected their data to persist reliably.

**Root Cause:**
- `_saveData()` calls async `_saveDataHybrid()` without awaiting completion
- Page could unload before IndexedDB operations completed
- No backup mechanism for interrupted saves
- No recovery mechanism for lost data

**Fix Applied:**
- Added `beforeunload` event handler to commit pending cell edits before page unload
- Created backup save mechanism that stores critical data in `eo_lake_backup` localStorage key
- Added recovery logic in `_loadData()` to restore from backup if main data is missing
- Backup is automatically cleared after successful recovery or when main data is intact

---

## Summary

| Bug # | Title | Severity | Status |
|-------|-------|----------|--------|
| 1 | Schema Inference Issues | High | Fixed |
| 2 | View Creation Issues | High | Fixed |
| 3 | UI Truncation Issues | Medium | Fixed |
| 4 | Unresponsive "Add Source" Area | High | Fixed |
| 5 | Non-Functional "New Field" Command | High | Fixed |
| 6 | Cannot View Records of Large Dataset | Critical | Fixed |
| 7 | Link Field Creation Across Sets | High | Fixed |
| 8 | Clearing Multiple Record Selections | Medium | Fixed |
| 9 | Tab Navigation Data Loss | High | Fixed |
| 10 | Missing Persistence After Page Refresh | Critical | Fixed |

---

## Files Modified

- `eo_import.js` - Schema inference regex patterns and type detection logic
- `eo_data_workbench.js` - View creation, field creation, cell rendering, large dataset handling, link field IndexedDB loading, tab navigation edit commit, selection state management, beforeunload backup, data recovery
- `eo_styles.css` - Modal responsiveness, expand button visibility

---

## Testing Environment

- **Application:** Noema
- **Testing Date:** January 3, 2026
- **Test Data:** `organizations-100000.csv` (100,000 records)
