import { Modal } from "../../components/Modal.js";

const ROWS: [string, string][] = [
  ["⌘/Ctrl Z · ⇧⌘Z", "Undo · Redo"],
  ["⌘ S", "Save now (autosave is always on)"],
  ["⌘ C · ⌘ X · ⌘ V · ⌘ D", "Copy · Cut · Paste · Duplicate"],
  ["Delete / Backspace", "Delete selection"],
  ["Arrow keys · ⇧ + arrows", "Nudge 1px · 10px (reorder in flowing layouts)"],
  ["⌘ G · ⇧⌘G", "Group · Ungroup (freeform elements)"],
  ["⌘ ] · ⌘ [ · with ⇧", "Bring forward · Send backward · to front/back"],
  ["⌘ L", "Lock / unlock"],
  ["⇧⌘ H", "Hide / show"],
  ["⌘ A", "Select all siblings"],
  ["⌥ A/H/D · ⌥ W/V/S", "Align left/centre/right · top/middle/bottom"],
  ["⌘ + · ⌘ − · ⌘ 0", "Zoom in · out · fit to screen"],
  ["Shift + drag", "Keep aspect ratio while resizing; 15° steps while rotating"],
  ["Alt + drag", "Temporarily disable snapping"],
  ["Double-click text", "Edit text in place (Esc cancels, Enter confirms)"],
  ["Double-click a group", "Select an element inside the group"],
  ["Shift + click", "Add to or remove from the selection"],
  ["Drag on empty canvas", "Marquee select"],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <dl className="kv" style={{ gridTemplateColumns: "200px 1fr", margin: 0 }}>
        {ROWS.map(([k, v]) => (<><dt key={`${k}k`}><span className="kbd">{k}</span></dt><dd key={`${k}v`}>{v}</dd></>))}
      </dl>
    </Modal>
  );
}
