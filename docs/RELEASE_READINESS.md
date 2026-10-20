# BINHI v0.1 — release readiness report

Date: 2026-10-20 · Branch: `claude/binhi-visual-editor-12arge` · Scope: standalone BINHI (`apps/binhi`)

## Verdict

**Ready for a private beta on the standalone host; not yet a public GA.**
Every primary-journey step works against a real database and a real
browser, publishing is verified before it is called live, and ownership is
enforced on every API. The items under *Not done* are honest gaps, not
hidden ones.

## Evidence (all run in this session, Node 22, PostgreSQL 16)

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck --workspace apps/binhi` | clean (client + server) |
| Unit + integration tests | `npm test --workspace apps/binhi` | **9 files, 69 tests passed** (unit: document, operations, render, store, geometry; integration: auth, sites, assets, publish) |
| Production build | `npm run build --workspace apps/binhi` | client 494 kB JS / 24 kB CSS (gzip 145 / 5 kB), server compiled |
| Browser journey | `npm run test:e2e --workspace apps/binhi` | **11/11 steps passed**: sign up → template → canvas render → properties edit → inline canvas edit → insert element → autosave (server revision advanced) → undo → mobile breakpoint → publish (verified live) → anonymous visit desktop + mobile (no horizontal overflow, second page) → unpublish (410) |
| Freeform interactions (browser probe) | ad-hoc Playwright probes | drag (+300/+99 px), resize via handle, rotation persisted to the document (73°), multi-select + group, undo removes group, mobile view, layers panel |

Screenshots from the journey are produced under `apps/binhi/e2e/screenshots/`
(uploaded as a CI artifact).

## Milestone status

| Milestone | Status | Notes |
| --- | --- | --- |
| 0 Repository & architecture | Done | canonical schema, registry, ops, renderer, templates, CI, docs |
| 1 Functional editor foundation | Done | accounts, sites, pages, registry, canvas, properties, selection, structured containers, autosave |
| 2 Canva-like editing | Done | drag/drop, zoom/pan/fit, resize/rotate handles, alignment guides + snapping + grid, layers/z-order, group/ungroup, lock, copy/paste/duplicate, responsive preview, theme tokens, media library, templates, undo/redo, revision history |
| 3 Wix-like structure | Done | pages (create/duplicate/rename/reorder/home/hide/URL/SEO/delete), menu (auto or custom with nesting), header/footer, saved sections, columns/grids, responsive overrides, brand styles panel |
| 4 Publishing | Done | snapshot → render → deploy → verify → live; unpublish; rollback; failure states; forms with submissions |
| 5 Release hardening | Partially done | security tests, e2e, CI and docs done; see *Not done* |
| 6 ORIGIN adapter readiness | Specified | `docs/ORIGIN_INTEGRATION.md`; no adapters built, nothing connected to ORIGIN |

## Security and privacy summary

- Ownership checked on every site, asset, revision, publication and
  submission call; strangers receive 404 (tests cover cross-account access).
- scrypt password hashes; HMAC-hashed session tokens; HttpOnly, SameSite=Lax,
  Secure-in-production cookie; custom-header CSRF guard; rate limits on auth,
  uploads, publishing and forms.
- All visitor-facing output is generated from the validated document with
  escaping; links and media sources are sanitised (no `javascript:`, `data:`
  or non-https); embeds are sandboxed and limited to known hosts; published
  pages carry a strict CSP.
- Uploads are sniffed by magic bytes; SVG and non-images are rejected; sizes
  and quotas are enforced; file names are sanitised.
- Account deletion unpublishes and soft-deletes everything and revokes
  sessions. Audit log records account, site, media and publishing actions.
- No telemetry, no third-party scripts on the editor; published sites load
  only Google Fonts (when a web font is chosen) and the optional embeds the
  owner adds.

## Not done (honest gaps)

1. **Custom domains / tenant subdomains** — path-based `/s/<slug>/` only.
2. **Rich text inline editing** — rich text is edited through the structured
   block editor in the properties panel, not directly on the canvas (headings,
   paragraphs and button labels are inline-editable).
3. **Image cropping is numeric** — crop values are set in the panel, not by
   dragging a crop frame.
4. **Email notifications for form submissions** — stored only.
5. **Multi-instance scaling** — rate limiters are in-memory; sessions and
   everything else are in Postgres.
6. **Full accessibility audit of the editor UI** — focus traps, labels,
   keyboard shortcuts and reduced-motion are implemented; an axe/manual pass
   is still to be run. The *published* output has heading/alt checks built in.
7. **Collaboration** — single editor per site is assumed; concurrent edits are
   detected (409) and resolved by choice, not merged.
8. **Replit deployment** — documented in `RELEASE.md`; creating the Replit
   project, database and secrets is an owner action and has not been done.

## Owner actions required before a public launch

- Provision the standalone host (Replit) with a dedicated Postgres and
  secrets; set `BINHI_PUBLIC_URL`.
- Decide whether sign-ups are open (`BINHI_ALLOW_SIGNUP`).
- Approve the BINHI brand treatment used in the editor (green seed mark) or
  supply the approved sector icon derivative.
