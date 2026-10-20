import type { LinkTarget } from "../../../core/index.js";
import { useSel } from "../context.js";
import { SelectInput } from "./fields.js";

const KINDS: { value: LinkTarget["kind"]; label: string }[] = [
  { value: "none", label: "No link" },
  { value: "page", label: "A page on this site" },
  { value: "url", label: "Web address" },
  { value: "email", label: "Email address" },
  { value: "phone", label: "Phone number" },
  { value: "anchor", label: "Section on this page" },
];

export function LinkEditor({ value, onChange, compact = false }: { value: LinkTarget | undefined; onChange: (t: LinkTarget) => void; compact?: boolean }) {
  const doc = useSel((s) => s.document);
  const pageId = useSel((s) => s.pageId);
  const v: LinkTarget = value ?? { kind: "none" };
  const anchors = (doc.pages.find((p) => p.id === pageId)?.sections ?? []).flatMap((s) => collectAnchors(s));
  const changeKind = (kind: LinkTarget["kind"]) => {
    switch (kind) {
      case "none": return onChange({ kind });
      case "page": return onChange({ kind, pageId: doc.pages.find((p) => p.isHome)?.id ?? doc.pages[0]!.id });
      case "url": return onChange({ kind, href: "https://", newTab: true });
      case "email": return onChange({ kind, address: "" });
      case "phone": return onChange({ kind, number: "" });
      case "anchor": return onChange({ kind, anchor: anchors[0] ?? "" });
      case "file": return onChange({ kind: "none" });
    }
  };
  return (
    <div className={compact ? "row gap" : "prop-group-body"} style={compact ? { flexWrap: "wrap" } : { padding: 0 }}>
      <SelectInput value={v.kind} options={KINDS} onChange={changeKind} ariaLabel="Link type" />
      {v.kind === "page" && (
        <>
          <SelectInput value={v.pageId} options={doc.pages.map((p) => ({ value: p.id, label: p.name }))} onChange={(pageId) => onChange({ ...v, pageId })} ariaLabel="Page" />
          {!compact && <input placeholder="Optional section anchor" value={v.anchor ?? ""} onChange={(e) => onChange({ ...v, anchor: e.target.value.replace(/[^A-Za-z0-9_-]/g, "") || undefined })} aria-label="Anchor" />}
        </>
      )}
      {v.kind === "url" && (
        <>
          <input type="url" placeholder="https://example.com" value={v.href} onChange={(e) => onChange({ ...v, href: e.target.value })} aria-label="Web address" />
          <label className="toggle"><input type="checkbox" checked={v.newTab} onChange={(e) => onChange({ ...v, newTab: e.target.checked })} /> Open in new tab</label>
        </>
      )}
      {v.kind === "email" && (
        <>
          <input type="email" placeholder="hello@example.com" value={v.address} onChange={(e) => onChange({ ...v, address: e.target.value })} aria-label="Email address" />
          {!compact && <input placeholder="Subject (optional)" value={v.subject ?? ""} onChange={(e) => onChange({ ...v, subject: e.target.value || undefined })} aria-label="Email subject" />}
        </>
      )}
      {v.kind === "phone" && <input type="tel" placeholder="+63 900 000 0000" value={v.number} onChange={(e) => onChange({ ...v, number: e.target.value })} aria-label="Phone number" />}
      {v.kind === "anchor" && (
        anchors.length ? <SelectInput value={v.anchor} options={anchors.map((a) => ({ value: a, label: `#${a}` }))} onChange={(anchor) => onChange({ ...v, anchor })} ariaLabel="Anchor" /> : <p className="help">Give a section an anchor name (Advanced) to link to it.</p>
      )}
    </div>
  );
}

function collectAnchors(n: { anchorId?: string; children?: { anchorId?: string; children?: unknown[] }[] }): string[] {
  const out: string[] = [];
  if (n.anchorId) out.push(n.anchorId);
  (n.children ?? []).forEach((c) => out.push(...collectAnchors(c as never)));
  return out;
}
