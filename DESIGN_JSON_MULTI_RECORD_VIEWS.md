# Design: JSON Multi-Record Type Views

## Summary

JSON imports with multiple record types follow a two-step flow:
1. **Import** → Creates a SOURCE with `multiRecordAnalysis` metadata
2. **Elevate** → Promotes SOURCE to SET with multiple record-type views

## Flow

```
Import JSON file
    ↓
Create SOURCE (immutable GIVEN data)
  - Stores all records
  - Analyzes schema divergence
  - Stores multiRecordAnalysis: { typeField, types[], commonFields, divergenceScore }
    ↓
User clicks "Create Set" on Source
    ↓
Elevate to SET (MEANT interpretation)
  - Creates "All Records" default view
  - If multiRecordAnalysis exists:
    - Creates view for each record type
    - Each view has hiddenFields (fields with no values for that type)
    - Each view has fieldOrder (type-specific fields prominent)
    - Each view has type-specific icon
```

## Implementation

### Source Creation (`noema_import.js`)

When importing JSON with a type field, the Source stores analysis:

```javascript
multiRecordAnalysis: {
  typeField: "type",           // Field name used for type detection
  types: [
    { value: "person", label: "Person", count: 42, specificFields: ["email", "phone"] },
    { value: "company", label: "Company", count: 15, specificFields: ["industry"] }
  ],
  commonFields: ["id", "name", "description"],
  divergenceScore: 0.35        // % of type-specific fields
}
```

### Set Elevation (`noema_source_join.js`)

`SetCreator.createSetFromSource()` checks for `multiRecordAnalysis` and creates views:

```javascript
// After creating the Set...
if (source.multiRecordAnalysis) {
  this._createRecordTypeViews(set, source);
}
```

### View Creation Logic

For each record type, a view is created with:

```javascript
{
  id: "view_xxx",
  name: "Person",              // Formatted type name
  type: "table",
  config: {
    filters: [{
      fieldId: typeFieldId,
      operator: 'is',
      filterValue: 'person',
      enabled: true
    }],
    hiddenFields: [...],       // Fields with no values for this type
    fieldOrder: [...]          // Primary, then type-specific, then common
  },
  metadata: {
    recordType: "person",
    recordCount: 42,
    isRecordTypeView: true,
    icon: "ph-user",
    typeSpecificFields: ["email", "phone"],
    commonFields: ["id", "name"]
  }
}
```

## Helper Methods (SetCreator class)

### `_getHiddenFieldsForType(set, typeFieldId, typeValue)`
Returns field IDs that have NO values for records of the given type.

### `_getFieldOrderForType(set, typeFieldId, typeValue, multiRecordAnalysis)`
Orders fields: primary first, then type-specific, then common.

### `_getIconForType(typeValue)`
Maps type names to Phosphor icons (person → ph-user, company → ph-building-office).

### `_formatTypeName(typeValue)`
Formats "real_estate" → "Real Estate".

## Example

**Input JSON:**
```json
[
  { "type": "person", "name": "Alice", "email": "alice@example.com" },
  { "type": "company", "name": "Acme", "industry": "Tech" }
]
```

**After Import (Source):**
```
Source: data.json
  Records: 2
  multiRecordAnalysis: {
    typeField: "type",
    types: [{ value: "person", count: 1 }, { value: "company", count: 1 }]
  }
```

**After Elevation (Set):**
```
Set: data (2 records)
  Fields: type, name, email, industry
  Views:
    - All Records (no filter, shows all fields)
    - Person (filter: type=person, hides: industry)
    - Company (filter: type=company, hides: email)
```

## Files Modified

| File | Changes |
|------|---------|
| `noema_import.js` | Stores `multiRecordAnalysis` in Source during import |
| `noema_source_join.js` | `SetCreator._createRecordTypeViews()` and helper methods |

## Benefits

1. **Proper GIVEN/MEANT separation** - Source is immutable, Set is interpretation
2. **Unified data** - All records in one Set, easier to query
3. **Clean views** - Each type view shows only relevant fields
4. **Reversible** - Users can still create separate Sets if preferred
