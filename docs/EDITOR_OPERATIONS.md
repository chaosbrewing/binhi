# Editor operations contract

Every change to a website is one of the operations in
`src/core/ops/operations.ts`, validated with Zod and applied by the pure
reducer in `src/core/ops/apply.ts`. The editor applies an operation
optimistically, then sends it; the server re-applies it against the stored
document. Both sides use the same code.

## Transport

`POST /api/sites/:siteId/ops`

```json
{ "baseRevision": 12, "batchId": "9f3c…", "ops": [ { "type": "updateProps", "nodeId": "head_x1", "props": { "text": "Hello" } } ] }
```

| Result | Meaning |
| --- | --- |
| `200 { revision, createdIds }` | Applied atomically; `revision` is the new base. |
| `200 { replayed: true, document }` | This `batchId` was already applied (a retried autosave). |
| `409 { error.details: { serverRevision, document } }` | Stale base revision. The editor shows a conflict banner: *Load latest* or *Keep mine* (writes the local document as a new revision). |
| `422 { error.code }` | An operation is not allowed (locked element, invalid parent, missing node…). Nothing applied. |
| `400` | Malformed payload. |

Batches are limited to 200 operations and 6 MB.

## Operations

| Group | Operations |
| --- | --- |
| Create | `insertComponent` (from the registry), `insertNode` (a prepared node, re-identified), `pasteNodes`, `insertReusableSection`, `duplicateNode` |
| Edit | `updateProps`, `updateStyle` (per breakpoint, with `unset`), `setTextStyle`, `updateInteractions`, `updateA11y`, `setAnchor`, `renameNode` |
| Geometry | `updatePlacement` (per breakpoint), `clearPlacementOverride`, `setLayout` (flow/free, design size, stacking), `alignNodes`, `distributeNodes` |
| Structure | `moveNode`, `reorderLayer` (forward/backward/front/back; z-order in freeform), `groupNodes`, `ungroupNode`, `deleteNode` |
| State | `setLocked`, `setHidden`, `setVisibility` (per breakpoint) |
| Pages | `addPage` (optionally duplicating), `updatePage` (name/slug/menu/SEO), `reorderPages`, `setHomePage`, `deletePage` |
| Site | `updateTheme`, `updateTextStyle`, `updateNavigation`, `updateSettings`, `renameSite`, `setHeader`, `setFooter` |
| Reusable | `saveReusableSection`, `updateReusableSection` (propagates to all copies), `deleteReusableSection`, `detachReusable` |
| Whole document | `replaceDocument` with `reason` undo/redo/restore/template — fully validated |

## Guarantees

- **Validation first**: props are parsed against the component's schema; the
  whole document is re-validated after every operation.
- **Atomic batches**: `applyOperations` fails as a unit; the server wraps the
  batch in a transaction with the site row locked.
- **Locked elements** cannot be edited, moved or deleted (they can be
  selected and unlocked). A locked ancestor locks its subtree.
- **Containment rules** come from the registry (`acceptsChildren`, `rootOnly`,
  `freeformCapable`); sections only live on pages; groups only in freeform.
- **Ids are regenerated** on duplicate/paste/insert so a document never
  contains two nodes with the same id.
- **Deleting the last section** of a page replaces it with an empty section so
  the page stays editable.

## Autosave behaviour

The store debounces edits for 700 ms, compacts consecutive style/placement
updates on the same node, and sends one batch. Save states shown to the
user: Saved · Unsaved changes · Saving… · Not saved — retrying · Offline —
will retry · Conflict. The browser warns before unloading with unsaved
changes. `⌘S` flushes immediately.
