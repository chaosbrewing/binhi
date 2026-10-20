import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type SiteDetail } from "../api.js";
import { EditorStore } from "./store.js";
import { EditorContext } from "./context.js";
import { Editor } from "./Editor.js";

export function EditorRoute() {
  const { siteId = "" } = useParams();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .site(siteId)
      .then((r) => alive && setSite(r.site))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Could not open this website"));
    return () => {
      alive = false;
    };
  }, [siteId]);
  const store = useMemo(() => (site ? new EditorStore(site) : null), [site]);
  useEffect(() => () => store?.destroy(), [store]);
  useEffect(() => {
    if (!store) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (store.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [store]);
  if (error) {
    return (
      <div className="page-loading">
        <p className="form-error" role="alert">{error}</p>
        <Link to="/" className="btn">Back to your websites</Link>
      </div>
    );
  }
  if (!store) return <div className="page-loading" role="status">Opening your website…</div>;
  return (
    <EditorContext.Provider value={store}>
      <Editor />
    </EditorContext.Provider>
  );
}
