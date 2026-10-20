# Publishing contract

## States

```
draft ──publish──▶ pending ─▶ building ─▶ deploying ─▶ (verify) ─▶ live
                                                          │
                                                          └─▶ failed (previous live publication keeps serving)
live ──publish again──▶ superseded        live ──unpublish──▶ unpublished
superseded | unpublished ──rollback (re-verified)──▶ live
```

A publication is marked **live only after** the server fetches the public
URL through the public route with the `x-binhi-verify: <publicationId>`
header and finds the page's `<meta name="binhi-publication">` marker. Until
then `binhi_sites.live_publication_id` still points at the previous
publication, so a failed publish never takes a working site down.

## Flow (`PublishService.publish`)

1. Load the owner's site; run `validateForPublish` (errors block, warnings are
   returned to the editor).
2. Refuse if another publication for the site is in flight.
3. Reference the snapshot of the current revision (`binhi_site_revisions`) and
   mark it `publish` so retention keeps it.
4. Insert the publication (`pending`), render every page with
   `renderAllPages(mode: "publish")` (`building`), hand the pages to the
   adapter (`deploying`), verify, activate, mark `live`, supersede the old one.
5. On any failure: `failed` with the error text; audit entries throughout.

## Adapter contract (`src/server/publish/adapter.ts`)

```ts
interface PublishingAdapter {
  name: string;
  siteUrl(slug): string;
  deploy(target, pages): Promise<{ url }>;   // idempotent per publicationId
  activate(target): Promise<void>;           // point the slug at this publication
  retract(target): Promise<void>;            // unpublish
}
```

`LocalPublishingAdapter` (standalone): pages go to `binhi_published_pages`;
activation sets `live_publication_id`; BINHI itself serves `/s/<slug>/…`.
A future `LiyabPublishingAdapter` implements the same four calls against
ORIGIN's approved execution path. `binhi_publications.adapter` records which
adapter owns a publication, so exactly one is authoritative.

## Hosting on the standalone host (Replit)

Replit autoscale deployments give one verified hostname. BINHI therefore
publishes **path-based URLs**: `https://<host>/s/<slug>/`. Wildcard tenant
subdomains and custom domains are not assumed; they need DNS, TLS and routing
work that is documented as future work in `RELEASE.md`.

Public pages are served with:
`Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline' fonts.googleapis.com; img-src 'self' https: data:; script-src 'self'; frame-src youtube-nocookie.com player.vimeo.com google.com; form-action 'self'; frame-ancestors 'self'`,
`Cache-Control: public, max-age=60, stale-while-revalidate=300`,
`X-Content-Type-Options: nosniff`.

## Forms on published sites

`POST /s/<slug>/__form/<formNodeId>`: validates against the *published*
document's field definitions, ignores honeypot hits, rate-limits per
IP/site, stores the submission, and redirects back to the page with
`#<formId>-sent`, which reveals the form's success message via CSS. No
email is sent in v0.1; owners read submissions in the editor.

## Rollback

Earlier publications keep their rendered pages. "Make live" re-verifies the
old publication through the public route before switching the pointer.
Publications made under a different slug cannot be rolled back (links would
break); publish again instead. Changing a slug while live is refused.
