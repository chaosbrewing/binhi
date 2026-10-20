import { useEffect, useState } from "react";
import { Modal } from "../../components/Modal.js";
import { api, ApiError, type PublicationSummary } from "../../api.js";
import { useStore, useSel } from "../context.js";
import { useToast } from "../../components/Toast.js";
import { relative } from "../../dashboard/Dashboard.js";
import { I } from "../../components/Icons.js";
import type { ValidationIssue } from "../../../core/index.js";

const STATE_LABEL: Record<PublicationSummary["state"], string> = { pending: "Queued", building: "Building", deploying: "Deploying", live: "Live", failed: "Failed", unpublished: "Unpublished", superseded: "Replaced" };

export function PublishDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const siteId = useSel((s) => s.siteId);
  const revision = useSel((s) => s.revision);
  const slug = useSel((s) => s.slug);
  const publication = useSel((s) => s.publication);
  const liveUrl = useSel((s) => s.liveUrl);
  const validation = useSel((s) => s.validation);
  const toast = useToast();
  const [history, setHistory] = useState<PublicationSummary[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ValidationIssue[] | null>(null);
  const load = () => api.publications(siteId).then((r) => setHistory(r.publications)).catch(() => undefined);
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const refreshSite = async () => {
    const r = await api.site(siteId);
    store.setPublication(r.site.publication, r.site.liveUrl);
  };
  const publish = async () => {
    setBusy("publish");
    try {
      await store.flush();
      const r = await api.publish(siteId);
      setWarnings(r.warnings);
      await refreshSite();
      await load();
      if (r.publication.state === "live") toast("Your website is live.", "success");
      else toast(`Publishing failed: ${r.publication.error ?? "unknown error"}`, "error");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not publish", "error");
    } finally {
      setBusy(null);
    }
  };
  const unpublish = async () => {
    setBusy("unpublish");
    try {
      await api.unpublish(siteId);
      await refreshSite();
      await load();
      toast("Your website is offline. Visitors see a 'not published' page.", "info");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not unpublish", "error");
    } finally {
      setBusy(null);
    }
  };
  const rollback = async (id: string) => {
    setBusy(id);
    try {
      await api.rollback(siteId, id);
      await refreshSite();
      await load();
      toast("Earlier publication restored.", "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not restore", "error");
    } finally {
      setBusy(null);
    }
  };
  const live = publication?.isLive && publication.state === "live";
  const stale = live && publication.revision < revision;
  const issues = warnings ?? [...validation.errors, ...validation.warnings];
  const focusIssue = (i: ValidationIssue) => {
    if (i.pageId) store.setPage(i.pageId);
    if (i.nodeId) store.select([i.nodeId]);
    onClose();
  };
  return (
    <Modal title="Publish" onClose={onClose} wide>
      <div className="row gap" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 2, minWidth: 260 }}>
          {live ? (
            <>
              <p><span className="badge badge-ok">Live</span> {stale ? "You have changes that aren't published yet." : "The live site matches your latest saved revision."}</p>
              <div className="pub-url"><I.globe /><a href={liveUrl ?? "#"} target="_blank" rel="noopener noreferrer">{liveUrl}</a></div>
              <p className="help" style={{ marginTop: 6 }}>Published {publication ? relative(publication.verifiedAt ?? publication.createdAt) : ""} from revision {publication?.revision}. Current revision: {revision}.</p>
            </>
          ) : (
            <>
              <p>{publication?.state === "failed" ? <span className="badge badge-danger">Last publish failed</span> : <span className="badge">Not published</span>} Your website will be available at:</p>
              <div className="pub-url"><I.globe />{window.location.origin}/s/{slug}/</div>
              {publication?.state === "failed" && publication.error && <p className="form-error" style={{ marginTop: 8 }}>{publication.error}</p>}
              <p className="help" style={{ marginTop: 6 }}>Change the address in Settings before you publish. Publishing takes a snapshot of revision {revision}, builds every page, and only reports “Live” after the public page has been checked.</p>
            </>
          )}
          <div className="row gap" style={{ marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => void publish()} disabled={busy !== null || !validation.ok}><I.rocket /> {busy === "publish" ? "Publishing…" : live ? "Publish changes" : "Publish now"}</button>
            {live && <button className="btn" onClick={() => void unpublish()} disabled={busy !== null}>{busy === "unpublish" ? "Taking offline…" : "Unpublish"}</button>}
          </div>
          {!validation.ok && <p className="form-error" style={{ marginTop: 10 }}>Fix the errors below before publishing.</p>}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3>Checks ({issues.length})</h3>
          {issues.length === 0 ? <p className="muted small">Nothing to review. Nice work.</p> : (
            <ul className="issue-list">
              {issues.slice(0, 30).map((i, idx) => (
                <li key={idx} className={`issue ${i.severity}`}>
                  <I.alert />
                  <span className="grow">{i.message}</span>
                  {(i.nodeId || i.pageId) && <button className="btn btn-sm" onClick={() => focusIssue(i)}>Show</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <h3 style={{ marginTop: 18 }}>Publication history</h3>
      {history.length === 0 ? <p className="muted small">No publications yet.</p> : (
        <ul className="rev-list">
          {history.map((p) => (
            <li key={p.id} className={`rev-item ${p.isLive ? "current" : ""}`}>
              <div className="grow">
                <strong>{STATE_LABEL[p.state]}</strong> · revision {p.revision} · {p.pageCount} page{p.pageCount === 1 ? "" : "s"}
                <div className="muted small">{relative(p.createdAt)}{p.error ? ` · ${p.error}` : ""}</div>
              </div>
              {p.isLive && <span className="badge badge-ok">Live</span>}
              {(p.state === "superseded" || p.state === "unpublished") && <button className="btn btn-sm" disabled={busy !== null} onClick={() => void rollback(p.id)}>{busy === p.id ? "Restoring…" : "Make live"}</button>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
