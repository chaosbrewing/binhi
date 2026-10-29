import { useEffect, useState } from "react";
import { Modal } from "../../components/Modal.js";
import { api, ApiError, type Submission } from "../../api.js";
import { useSel } from "../context.js";
import { useToast } from "../../components/Toast.js";
import { relative } from "../../utils/relativeTime.js";
import { I } from "../../components/Icons.js";

export function SubmissionsDialog({ onClose }: { onClose: () => void }) {
  const siteId = useSel((s) => s.siteId);
  const toast = useToast();
  const [list, setList] = useState<Submission[] | null>(null);
  const load = () => api.submissions(siteId).then((r) => setList(r.submissions)).catch((e) => toast(e instanceof ApiError ? e.message : "Could not load submissions", "error"));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);
  return (
    <Modal title="Form submissions" onClose={onClose} wide>
      <p className="muted">Messages sent through forms on your published site. They are stored with BINHI only; nothing is emailed yet.</p>
      {!list && <p role="status">Loading…</p>}
      {list && list.length === 0 && <p className="muted">No submissions yet.</p>}
      {list && list.length > 0 && (
        <ul className="rev-list">
          {list.map((s) => (
            <li key={s.id} className="rev-item" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <div className="muted small">{relative(s.createdAt)} · from {s.pagePath}</div>
                <dl className="kv" style={{ margin: "6px 0 0", gridTemplateColumns: "140px 1fr" }}>
                  {Object.entries(s.fields).map(([k, v]) => (<><dt key={`${s.id}-${k}-k`}>{k}</dt><dd key={`${s.id}-${k}-v`} style={{ whiteSpace: "pre-wrap" }}>{v || <span className="muted">—</span>}</dd></>))}
                </dl>
              </div>
              <button className="icon-btn" aria-label="Delete submission" onClick={() => api.deleteSubmission(siteId, s.id).then(load).catch(() => toast("Could not delete", "error"))}><I.trash /></button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
