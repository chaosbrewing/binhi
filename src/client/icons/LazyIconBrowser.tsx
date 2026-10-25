import { lazy, Suspense } from "react";
import type { IconBrowserProps } from "./IconBrowser.js";

// The browser UI, the search index and the synonym table are only needed once someone opens an icon picker, so they
// load on demand instead of weighing on every editor start.
const Browser = lazy(() => import("./IconBrowser.js").then((m) => ({ default: m.IconBrowser })));

export function LazyIconBrowser(props: IconBrowserProps) {
  return (
    <Suspense fallback={<p className="muted icon-help" role="status">Loading icons…</p>}>
      <Browser {...props} />
    </Suspense>
  );
}
