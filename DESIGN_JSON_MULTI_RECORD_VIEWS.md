# Design: JSON Multi-Record Type Views

## Summary

Update JSON imports with multiple record types to create **one unified set with multiple views** that align with each record type, rather than splitting into separate sets.

## Current Behavior

When importing JSON data with multiple record types (detected via a `type` field):

1. **Default**: Creates separate sets per type (`separateSetsByType: true`)
   - Each type gets its own set with only the relevant fields
   - Sets are named `{baseName} - {TypeName}`
   - Best for high schema divergence (>30%)

2. **Alternative**: Creates views by type (`createViewsByType: true`)
   - Single set with all records
   - Filtered views for each type value
   - Views have metadata marking them as `isRecordTypeView: true`

## Proposed Behavior

**Default to creating one set with multiple record-type views:**

### Key Changes

#### 1. Invert Default Option
- Change the default from `separateSetsByType: true` to `createViewsByType: true`
- The radio buttons in the import dialog should default to "Create views by type"

#### 2. Enhanced Record-Type View Creation
When creating views by type, enhance the behavior:

```javascript
// Current view structure
{
  id: "view_xxx",
  name: "Events",
  type: "table",
  config: {
    filters: [{ fieldId: typeFieldId, operator: 'is', filterValue: 'event' }],
    hiddenFields: [],  // All fields visible
  },
  metadata: {
    recordType: "event",
    recordCount: 42,
    isRecordTypeView: true
  }
}
```

**Enhancements:**

```javascript
// Enhanced view structure
{
  id: "view_xxx",
  name: "Events",
  type: "table",
  config: {
    filters: [{ fieldId: typeFieldId, operator: 'is', filterValue: 'event', enabled: true, locked: true }],
    // Auto-hide fields that are empty for this record type
    hiddenFields: [...fieldsNotUsedByThisType],
    // Order fields by relevance to this type
    fieldOrder: [...orderedFieldsForType],
  },
  metadata: {
    recordType: "event",
    recordCount: 42,
    isRecordTypeView: true,
    icon: "ph-calendar-blank",  // Type-specific icon
    typeSpecificFields: ["start_date", "end_date", "venue"],
    commonFields: ["id", "name", "description"]
  }
}
```

#### 3. Smart Field Visibility per View
For each record-type view:
- **Hide fields** that have no values for records of that type
- **Reorder fields** to show type-specific fields prominently
- This gives each view a "clean" schema appearance without losing data

```javascript
_getFieldVisibilityForType(set, typeField, typeValue) {
  const typeRecords = set.records.filter(r => r.values[typeField.id] === typeValue);
  const hiddenFields = [];

  for (const field of set.fields) {
    if (field.id === typeField.id) continue; // Never hide type field

    // Check if any record of this type has a value for this field
    const hasValue = typeRecords.some(r => {
      const val = r.values[field.id];
      return val !== null && val !== undefined && val !== '';
    });

    if (!hasValue) {
      hiddenFields.push(field.id);
    }
  }

  return hiddenFields;
}
```

#### 4. Field Ordering by Type Relevance
Order fields so type-specific fields appear after the primary field:

```javascript
_orderFieldsForType(set, typeField, typeValue, analysisResult) {
  const typeInfo = analysisResult.types.find(t => t.type === typeValue);
  const specificFields = new Set(typeInfo?.specificFields || []);

  return set.fields.map(f => f.id).sort((a, b) => {
    const fieldA = set.fields.find(f => f.id === a);
    const fieldB = set.fields.find(f => f.id === b);

    // Primary field first
    if (fieldA.isPrimary) return -1;
    if (fieldB.isPrimary) return 1;

    // Type-specific fields next
    const aSpecific = specificFields.has(fieldA.name);
    const bSpecific = specificFields.has(fieldB.name);
    if (aSpecific && !bSpecific) return -1;
    if (!aSpecific && bSpecific) return 1;

    return 0;
  });
}
```

#### 5. "All Records" View Enhancement
Keep the default "All Records" view but enhance it:
- Show all fields
- No filter applied
- Serves as the unified view of all data

#### 6. Update Import Dialog UI
- Change default radio selection to "Create views by type"
- Update hint text:
  - **Views by type**: "Recommended - One dataset with filtered views per type. Each view shows only relevant fields."
  - **Separate datasets**: "Each type becomes its own dataset with only its fields."

### Files to Modify

| File | Changes |
|------|---------|
| `eo_import.js:3416-3427` | Swap default radio selection |
| `eo_import.js:2407-2448` | Enhance view creation with hidden fields and field ordering |
| `eo_import.js:2881-2986` | Use analysis results to inform view field visibility |
| `eo_import.js:1019-1025` | Update decision flow comments |

### Implementation Steps

1. **Update default option in UI** (eo_import.js:3416-3427)
   - Change `checked` attribute from "sets" to "views"
   - Update hint text

2. **Enhance `createViewsByType` logic** (eo_import.js:2407-2448)
   - Add `_getFieldVisibilityForType()` method
   - Add `_orderFieldsForType()` method
   - Pass `hiddenFields` and `fieldOrder` to `createView()`
   - Store additional metadata (icon, typeSpecificFields, commonFields)

3. **Connect schema divergence analysis** (eo_import.js:2881-2986)
   - Pass analysis results to view creation
   - Use `typeSpecificFields` for field ordering

4. **Update provenance logging**
   - Log the view creation decisions including hidden/ordered fields

### Data Model Compatibility

This change is **backwards compatible**:
- Existing sets with type-filtered views continue to work
- The view structure is enhanced but not breaking
- `hiddenFields` and `fieldOrder` are existing config properties

### Example

**Input JSON:**
```json
[
  { "type": "person", "name": "Alice", "email": "alice@example.com" },
  { "type": "company", "name": "Acme", "industry": "Tech" },
  { "type": "person", "name": "Bob", "phone": "555-1234" }
]
```

**Current (separate sets):**
```
Set: data - Person (2 records)
  Fields: name, email, phone
  Views: [All Records]

Set: data - Company (1 record)
  Fields: name, industry
  Views: [All Records]
```

**Proposed (one set with views):**
```
Set: data (3 records)
  Fields: type, name, email, phone, industry
  Views:
    - All Records (no filter, shows all fields)
    - Person (filter: type=person, hides: industry, shows: name, email, phone)
    - Company (filter: type=company, hides: email, phone, shows: name, industry)
```

### UI Representation

In the sidebar, record-type views appear nested under the set:

```
📊 data                    ← Set (3 records)
  ├── 📋 All Records       ← Default view
  ├── 👤 Person [type]     ← Record-type view (2 records)
  └── 🏢 Company [type]    ← Record-type view (1 record)
```

The `[type]` badge indicates these are record-type views with locked filters.

### Benefits

1. **Unified data** - All records in one place, easier to query across types
2. **Clean views** - Each type view shows only relevant fields
3. **Simpler mental model** - One set to manage, not multiple
4. **Better for relationships** - Linking between types is easier in one set
5. **Reversible** - Users can still choose separate sets if preferred

### Edge Cases

1. **No type field detected** - No views created, single "All Records" view
2. **Only one type value** - Create one type view plus "All Records"
3. **High divergence (>30%)** - Show recommendation but still allow views approach
4. **Type field is ID-like** - Skip (too many unique values, not suitable for views)
