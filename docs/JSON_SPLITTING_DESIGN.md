# JSON Splitting Design

## Overview

This document outlines the design for intelligently breaking out nested JSON structures into related sets. The feature operates at two levels:

1. **Import Level** - Analyze and split during initial JSON import
2. **Set Level** - Split existing nested JSON fields into separate sets

## Core Concepts

### What Gets Split

Not all nested structures should be split. The system should detect and offer splitting for:

| Structure | Example | Should Split? |
|-----------|---------|---------------|
| Nested entity objects | `{author: {name: "...", email: "..."}}` | Yes - creates related Author set |
| Arrays of entities | `{tags: [{id: 1, name: "..."}, ...]}` | Yes - creates related Tags set with back-reference |
| Nested metadata | `{_meta: {created: "..."}}` | Maybe - user choice |
| Primitive arrays | `{tags: ["a", "b"]}` | No - use MULTI_SELECT field type |
| Complex config | `{settings: {theme: {...}}}` | No - keep as JSON field |
| Homogeneous data | `{coordinates: {x: 1, y: 2}}` | No - semantic unit |

### Splitting Heuristics

The system uses these heuristics to recommend splitting:

1. **Entity Detection**
   - Has 3+ fields
   - Contains identifying fields (id, name, title, etc.)
   - Appears in multiple records with same structure
   - Not a known semantic unit (address, coordinates, etc.)

2. **Relationship Detection**
   - Single nested object → 1:1 relationship
   - Array of objects → 1:N relationship
   - Shared object references (same id) → N:1 relationship

3. **Split Worthiness Score**
   ```
   score = fieldCount * 2 +
           hasIdentifier * 10 +
           occurrenceCount * 1 +
           uniqueValuesRatio * 5 -
           isSemanticUnit * 20
   ```

---

## Import Level Design

### User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User selects JSON file for import                           │
├─────────────────────────────────────────────────────────────────┤
│  2. System parses and analyzes structure                        │
│     - Detects nested entities                                   │
│     - Calculates split recommendations                          │
│     - Identifies relationships                                  │
├─────────────────────────────────────────────────────────────────┤
│  3. Import Preview Dialog shows:                                │
│     ┌──────────────────────────────────────────────┐           │
│     │ 📦 Main: Orders (150 records)                │           │
│     │    ├── customer: {...}  [🔗 Split to Set]    │           │
│     │    ├── items: [...]     [🔗 Split to Set]    │           │
│     │    └── metadata: {...}  [📋 Keep as JSON]    │           │
│     └──────────────────────────────────────────────┘           │
├─────────────────────────────────────────────────────────────────┤
│  4. User toggles which fields to split                          │
├─────────────────────────────────────────────────────────────────┤
│  5. System creates:                                             │
│     - Main set with LINK fields replacing nested objects        │
│     - Child sets for each split entity                          │
│     - Back-reference LINK fields on child sets                  │
└─────────────────────────────────────────────────────────────────┘
```

### Analysis Phase

```javascript
class NestedEntityAnalyzer {
  /**
   * Analyze records for splittable nested structures
   * @param {Object[]} records - Parsed JSON records
   * @returns {SplitRecommendation[]}
   */
  analyze(records) {
    const recommendations = [];

    for (const [fieldPath, samples] of this._collectNestedFields(records)) {
      const analysis = {
        fieldPath,           // e.g., "customer" or "items.0"
        structure: 'object' | 'array',
        nestedFields: [...],  // Fields within the nested object
        sampleValues: [...],  // First 3 examples
        occurrences: number,  // How many records have this
        uniqueValues: number, // Distinct nested objects
        hasIdentifier: boolean,
        recommendedAction: 'split' | 'keep' | 'ask',
        score: number,
        reasoning: string[]   // Human-readable explanation
      };

      recommendations.push(analysis);
    }

    return recommendations.sort((a, b) => b.score - a.score);
  }
}
```

### Split Execution

When user confirms splitting:

```javascript
class ImportSplitter {
  /**
   * Execute the split during import
   */
  async executeSplit(records, splitConfig) {
    const results = {
      mainSet: null,
      childSets: [],
      relationships: []
    };

    // 1. Extract unique child entities
    for (const split of splitConfig.fieldsToSplit) {
      const childRecords = this._extractChildEntities(records, split.fieldPath);
      const deduped = this._deduplicateByIdentity(childRecords);

      results.childSets.push({
        name: split.suggestedName,
        records: deduped,
        sourceField: split.fieldPath
      });
    }

    // 2. Transform main records (replace objects with LINK references)
    results.mainSet = this._transformMainRecords(records, splitConfig);

    // 3. Create relationship metadata
    results.relationships = this._buildRelationships(splitConfig);

    return results;
  }
}
```

### Handling Different Patterns

#### Pattern 1: Embedded 1:1 Entity
```json
// Input
{ "orderId": 1, "customer": { "id": 100, "name": "Alice" } }

// Output: Two sets
// Orders: { orderId: 1, customer: [LINK to Customer:100] }
// Customers: { id: 100, name: "Alice" }
```

#### Pattern 2: Embedded 1:N Array
```json
// Input
{ "orderId": 1, "items": [{ "sku": "A", "qty": 2 }, { "sku": "B", "qty": 1 }] }

// Output: Two sets
// Orders: { orderId: 1, items: [LINK to OrderItems:1-A, OrderItems:1-B] }
// OrderItems: { _parentOrder: [LINK], sku: "A", qty: 2 }
```

#### Pattern 3: Shared References (N:1)
```json
// Input (multiple orders with same customer)
{ "orderId": 1, "customer": { "id": 100, "name": "Alice" } }
{ "orderId": 2, "customer": { "id": 100, "name": "Alice" } }

// Output: Deduplicated customer
// Orders: { orderId: 1, customer: [LINK to Customer:100] }
// Orders: { orderId: 2, customer: [LINK to Customer:100] }
// Customers: { id: 100, name: "Alice" }  // Only one!
```

---

## Set Level Design

For existing sets with JSON fields, users can split after import.

### User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User views set with JSON field(s)                           │
│     ┌─────────────────────────────────────────────────┐         │
│     │  Order ID  │  Customer (JSON)   │  Items (JSON) │         │
│     │  001       │  {name: "Alice"..} │  [{sku:...}]  │         │
│     └─────────────────────────────────────────────────┘         │
├─────────────────────────────────────────────────────────────────┤
│  2. User right-clicks JSON field header → "Split to Set..."    │
├─────────────────────────────────────────────────────────────────┤
│  3. Split Preview Dialog shows:                                 │
│     ┌──────────────────────────────────────────────────────┐   │
│     │ 🔀 Split "Customer" field                            │   │
│     │                                                       │   │
│     │ Current: JSON field with 45 unique customers          │   │
│     │                                                       │   │
│     │ Will create:                                          │   │
│     │ • New set "Customers" with 45 records                 │   │
│     │ • Link field "Customer" replacing JSON field          │   │
│     │ • Back-link "Orders" on Customers set                 │   │
│     │                                                       │   │
│     │ Preview:                                              │   │
│     │ ┌─────────────────────────────────┐                  │   │
│     │ │ id   │ name    │ email         │                   │   │
│     │ │ 100  │ Alice   │ a@example.com │                   │   │
│     │ │ 101  │ Bob     │ b@example.com │                   │   │
│     │ └─────────────────────────────────┘                  │   │
│     │                                                       │   │
│     │ [Cancel]                   [Split to Set]            │   │
│     └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  4. System executes split                                       │
│     - Creates child set                                         │
│     - Converts JSON field to LINK field                         │
│     - Establishes relationships                                 │
│     - Updates views/filters if needed                           │
└─────────────────────────────────────────────────────────────────┘
```

### Split Operations

```javascript
class SetSplitter {
  /**
   * Split a JSON field from an existing set into a new related set
   */
  async splitFieldToSet(sourceSet, fieldId, options = {}) {
    const field = sourceSet.fields.find(f => f.id === fieldId);

    if (field.type !== FieldTypes.JSON) {
      throw new Error('Can only split JSON fields');
    }

    // 1. Analyze the JSON values
    const analysis = this._analyzeFieldValues(sourceSet.records, fieldId);

    // 2. Extract and deduplicate entities
    const childRecords = this._extractEntities(sourceSet.records, fieldId, {
      deduplicateBy: options.identityField || 'id',
      generateIds: !options.identityField
    });

    // 3. Create the child set
    const childSet = await this._createChildSet({
      name: options.name || this._suggestName(field.name),
      records: childRecords,
      sourceSetId: sourceSet.id,
      sourceFieldId: fieldId
    });

    // 4. Convert source field to LINK
    await this._convertToLinkField(sourceSet, fieldId, childSet.id);

    // 5. Create back-reference on child set
    if (options.createBackLink !== false) {
      await this._createBackLinkField(childSet, sourceSet);
    }

    // 6. Track provenance
    await this._recordSplitOperation(sourceSet, childSet, fieldId);

    return { childSet, modifiedSourceSet: sourceSet };
  }
}
```

### Merge Operation (Inverse)

Users should also be able to merge sets back:

```javascript
class SetMerger {
  /**
   * Merge a linked child set back into parent as JSON field
   * (Inverse of split operation)
   */
  async mergeSetToField(parentSet, linkFieldId, childSet) {
    // 1. Fetch all linked child records
    // 2. Convert LINK field back to JSON field
    // 3. Embed child data in parent records
    // 4. Optionally delete child set
    // 5. Track provenance
  }
}
```

---

## Provenance & Nine Rules Compliance

All split operations must maintain provenance under the Nine Rules:

### GIVEN Event (Source)
```javascript
{
  id: "source_json_123",
  type: "source",
  data: originalJsonFile,
  meta: {
    filename: "orders.json",
    importedAt: "...",
    hash: "sha256:..."
  }
}
```

### MEANT Event (Interpretation)
```javascript
{
  id: "split_operation_456",
  type: "split_interpretation",
  data: {
    sourceSetId: "orders_set",
    resultingSets: ["orders_set_modified", "customers_set"],
    splitConfig: {
      fieldPath: "customer",
      deduplicatedBy: "id",
      recordsCreated: 45
    }
  },
  meta: {
    performedAt: "...",
    performedBy: "user",
    reasoning: "Split customer objects into separate set for relational queries"
  },
  derivedFrom: ["source_json_123"]
}
```

---

## UI Components

### Import Split Preview Component

```jsx
function ImportSplitPreview({ recommendations, onConfigChange }) {
  return (
    <div className="split-preview">
      <h3>Detected Nested Entities</h3>

      {recommendations.map(rec => (
        <div key={rec.fieldPath} className="split-option">
          <div className="field-info">
            <span className="field-path">{rec.fieldPath}</span>
            <span className="structure-badge">{rec.structure}</span>
            <span className="occurrence-count">{rec.occurrences} records</span>
          </div>

          <div className="action-toggle">
            <button
              className={rec.action === 'split' ? 'active' : ''}
              onClick={() => onConfigChange(rec.fieldPath, 'split')}
            >
              🔗 Split to Set
            </button>
            <button
              className={rec.action === 'keep' ? 'active' : ''}
              onClick={() => onConfigChange(rec.fieldPath, 'keep')}
            >
              📋 Keep as JSON
            </button>
          </div>

          {rec.action === 'split' && (
            <div className="split-config">
              <label>
                Set Name:
                <input value={rec.suggestedName} onChange={...} />
              </label>
              <label>
                Identity Field:
                <select value={rec.identityField}>
                  {rec.nestedFields.map(f => <option>{f}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className="sample-preview">
            <MiniTable records={rec.sampleValues.slice(0, 3)} />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Field Context Menu Extension

```jsx
// Add to existing field header menu
{field.type === FieldTypes.JSON && (
  <MenuItem onClick={() => openSplitDialog(field.id)}>
    <Icon name="split" />
    Split to Set...
  </MenuItem>
)}
```

---

## Implementation Phases

### Phase 1: Analysis & Detection
- [ ] Implement `NestedEntityAnalyzer`
- [ ] Add detection heuristics
- [ ] Create scoring system
- [ ] Add unit tests for pattern detection

### Phase 2: Import Level Splitting
- [ ] Add split UI to import preview dialog
- [ ] Implement `ImportSplitter`
- [ ] Handle 1:1, 1:N, and N:1 patterns
- [ ] Add LINK field generation
- [ ] Update provenance tracking

### Phase 3: Set Level Splitting
- [ ] Add "Split to Set" context menu
- [ ] Create split preview dialog
- [ ] Implement `SetSplitter`
- [ ] Handle field type conversion
- [ ] Add back-link creation

### Phase 4: Advanced Features
- [ ] Merge operation (inverse of split)
- [ ] Deep nesting support (recursive splits)
- [ ] Batch split suggestions
- [ ] Split undo/history

---

## Edge Cases & Considerations

### Handling Inconsistent Structures
```javascript
// Some records have customer, some don't
{ "orderId": 1, "customer": {...} }
{ "orderId": 2 }  // No customer

// Solution: NULL links are allowed, partial extraction works
```

### Handling Polymorphic Nested Objects
```javascript
// Different customer shapes
{ "customer": { "type": "business", "companyName": "..." } }
{ "customer": { "type": "individual", "firstName": "..." } }

// Solution:
// Option 1: Single set with all fields (sparse)
// Option 2: Multiple sets per type (use type-based splitting)
```

### Circular References
```javascript
// Person references other persons
{ "name": "Alice", "manager": { "name": "Bob", "manager": {...} } }

// Solution: Detect cycles, only split top-level
// Link to same set for circular refs
```

### Very Large Arrays
```javascript
// Order with 10,000 items
{ "orderId": 1, "items": [...10000 items...] }

// Solution: Streaming extraction, batch record creation
// Show progress during split operation
```

---

## API Reference

### NestedEntityAnalyzer

```typescript
interface SplitRecommendation {
  fieldPath: string;
  structure: 'object' | 'array';
  nestedFields: string[];
  sampleValues: any[];
  occurrences: number;
  uniqueValues: number;
  hasIdentifier: boolean;
  identityFieldCandidates: string[];
  recommendedAction: 'split' | 'keep' | 'ask';
  score: number;
  reasoning: string[];
}

class NestedEntityAnalyzer {
  analyze(records: Record[]): SplitRecommendation[];
  suggestSetName(fieldPath: string): string;
  detectRelationshipType(rec: SplitRecommendation): '1:1' | '1:N' | 'N:1';
}
```

### ImportSplitter

```typescript
interface SplitConfig {
  fieldsToSplit: Array<{
    fieldPath: string;
    suggestedName: string;
    identityField: string | null;
    createBackLink: boolean;
  }>;
}

interface SplitResult {
  mainSet: Set;
  childSets: Set[];
  relationships: Relationship[];
}

class ImportSplitter {
  executeSplit(records: Record[], config: SplitConfig): Promise<SplitResult>;
}
```

### SetSplitter

```typescript
interface SplitOptions {
  name?: string;
  identityField?: string;
  createBackLink?: boolean;
}

class SetSplitter {
  splitFieldToSet(
    sourceSet: Set,
    fieldId: string,
    options?: SplitOptions
  ): Promise<{childSet: Set, modifiedSourceSet: Set}>;

  analyzeFieldForSplit(
    sourceSet: Set,
    fieldId: string
  ): SplitRecommendation;
}
```
