import { useEffect, useState } from "react";
import { Modal } from "../../components/Modal.js";
import { api, ApiError, type RevisionSummary } from "../../api.js";
import { useStore, useSel } from "../context.js";
import { useToast } from "../../components/Toast.js";
import { relative } from "../../utils/relativeTime.js";

const KIND_LABEL: Record<string, string> = { autosave: "Edit", restore: "Restored", publish: "Published", template: "Created", undo: "Undo", redo: "Redo" };

export function RevisionsDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const siteId = useSel((s) => s.siteId);
  const revision = useSel((s) => s.revision);
  const toast = useToast();
  const [list, setList] = useState<RevisionSummary[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => {
    void store.flush().then(() => api.revisions(siteId)).then((r) => setList(r.revisions)).catch((e) => toast(e instanceof ApiError ? e.message : "Could not load history", "error"));
  }, [siteId, store, toast]);
  const restore = async (rev: number) => {
    setBusy(rev);
    try {
      await store.restoreRevision(rev);
      toast(`Restored revision ${rev}. Undo is available if you change your mind.`, "success");
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not restore", "error");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Modal title="Revision history" onClose={onClose}>
      <p className="muted">Every save creates a revision. Restoring makes an earlier version current without deleting anything.</p>
      {!list && <p role="status">Loading…</p>}
      {list && (
        <ul className="rev-list">
          {list.map((r) => (
            <li key={r.id} className={`rev-item ${r.revision === revision ? "current" : ""}`}>
              <div className="grow">
                <strong>#{r.revision}</strong> · {KIND_LABEL[r.kind] ?? r.kind}{r.label ? ` · ${r.label}` : ""}
                <div className="muted small">{relative(r.createdAt)}{r.summary.length ? ` · ${r.summary.slice(0, 3).join(", ")}` : ""}</div>
              </div>
              {r.revision === revision ? <span className="badge badge-ok">Current</span> : <button className="btn btn-sm" disabled={busy !== null} onClick={() => void restore(r.revision)}>{busy === r.revision ? "Restoring…" : "Restore"}</button>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
