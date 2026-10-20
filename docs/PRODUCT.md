# BINHI product charter

## Four-question gate

**What chaos does BINHI organise?**
The mess between "I need a website" and "there is a website": scattered
copy, images, half-finished page builders, hosting confusion and the fear of
breaking something. BINHI keeps everything about one website in one place
(pages, design, media, history, publishing) and makes each change reversible.

**What meaningful experience does it create?**
A person with no code skills composes a real, responsive, multi-page website
by direct manipulation, sees exactly what visitors will see, and publishes
to a working address with one button. They can always go back.

**Who specifically benefits?**
Artists, photographers, freelancers, small businesses, personal-portfolio
owners and non-technical founders who know Canva-style tools and expect
Wix-style site structure.

**Why would they choose BINHI?**
It is simpler than a developer tool, more structured than a design tool,
honest about state (saved, published, failed), and it grows into ORIGIN's
operations and intelligence without a rebuild.

## MVP definition (v0.1)

| Feature | Problem | Outcome | Simplest implementation | Data | Success criterion | Privacy |
| --- | --- | --- | --- | --- | --- | --- |
| Accounts | Work must be private and durable | Sign up, return later | Email/password, session cookie | `binhi_users`, `binhi_sessions` | Reopen a site after sign-out/in | Password hashed (scrypt); deletion removes everything |
| Templates | Blank pages intimidate | Start from a credible layout | 5 curated templates + blank, same registry | Document JSON | Every template renders responsively with replaced content | — |
| Canvas editing | Property forms are slow | Direct manipulation | iframe canvas on the shared renderer + overlay | Operations | Select, move, resize, edit text without losing content | — |
| Structured + freeform layout | Freeform breaks on phones; grids feel rigid | Choose per container | `layout.mode` flow/free with bounded placement | Node layout/placement | Mobile never overflows; freeform scales or stacks | — |
| Responsive overrides | Desktop designs collapse on mobile | Per-breakpoint styles | Desktop base + tablet/mobile overrides in CSS media queries | `responsive`, `placement.tablet/mobile` | Preview equals published output | — |
| Media library | Images need a home | Upload once, reuse | Raw upload, sniffed types, object-storage abstraction | `binhi_assets` (+ blobs) | Upload, place, delete; unsafe files rejected | Only images; unguessable URLs |
| Autosave + revisions | Lost work | Nothing lost, undo anything | Debounced op batches, revision per batch, restore = new revision | `binhi_site_revisions` | Reload shows last confirmed state; restore works | — |
| Publishing | A site must be reachable | Real URL, honest status | Local adapter under `/s/<slug>/`, verify before live | `binhi_publications`, `binhi_published_pages` | Anonymous visitor loads the page; failures visible | Published pages contain no editor data |
| Forms | Visitors must be able to reach the owner | Submissions stored | POST handler with validation, honeypot and rate limit | `binhi_form_submissions` | Submission appears in the editor | Minimal fields; owner-only access |

## Primary journey (must work end-to-end)

Create account → new website from template → add/rename pages → edit text
and images on the canvas → adjust typography, colours and layout → position
elements → preview desktop/tablet/mobile → leave and return → restore an
earlier revision → publish → open the live URL anonymously → update →
unpublish.

The browser end-to-end test (`e2e/run.ts`) exercises this journey against
the real server and database.

## Product language

Plain words. "Saved", "Not published", "Publish changes", "Hidden — not shown
on the live site". No "deploy", "node", "DOM" or "revision id" in the UI
except the small revision counter in the status bar.

## Out of scope for v0.1

Custom domains, collaboration, e-commerce, blogs/collections, AI assistance,
app embedding, server-side code, email sending, analytics.
