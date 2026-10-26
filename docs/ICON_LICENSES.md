# Icon library — sources and licences

The review branch implements exactly **250 canonical v1.0 icons** (25 categories × 10), plus compatibility
resolution of all 250 prior sources. Only 75 ids overlap; compatibility assets do not constitute a second library.
Canonical source classes: S=75, L=70, C=80, O=25. All artwork awaits founder visual approval.
The 105 C/O vectors are **AI-assisted original geometry**, not commissioned human drawings or Lucide modifications.
They contain no third-party parts. Authorship and release terms require founder/legal review; `LicenseRef-BINHI`
is a tracking designation, **not a representation of completed legal clearance**.

Canonical geometry includes 144 Lucide glyphs (124 ISC, 20 ISC AND MIT) and 106 original-source glyphs
(one preserved original plus 105 newly authored C/O vectors). No remote icon service or icon font is used.
Per-item lineage and hashes: [`ICON_V1_MANIFEST.json`](ICON_V1_MANIFEST.json).

## Preserved compatibility sources (historical inventory, unchanged)

| Source | Count | Licence | Where it lives |
| --- | --- | --- | --- |
| Lucide `lucide-static` 1.61.0 (geometry only) | 245 | ISC (204); 41 of them are Feather-derived glyphs and also fall under the Feather MIT notice | `src/core/icons/generated/shapes/*.ts` |
| BINHI original (Opacity, Color Swatches, Landscape Orientation, Portrait Orientation, Tabs) | 5 | BINHI, same terms as this repository | `scripts/icons/original.mjs` |

Per-icon source and licence: [`docs/ICON_INVENTORY.md`](ICON_INVENTORY.md) (generated).

## How the data gets into the repository

The legacy generator `scripts/icons/generate.mjs` reads `scripts/icons/catalog.mjs` (the preserved old mapping) and an extracted
`lucide-static@1.61.0` package, and writes the committed geometry. Lucide is **not** a dependency of the app: only the
vector node lists (path / circle / rect / line / polyline / polygon / ellipse) are committed. The generator refuses
unknown elements and attributes, duplicate glyphs and duplicate slugs.

```sh
npm pack lucide-static@1.61.0 && mkdir /tmp/lucide && tar -xzf lucide-static-1.61.0.tgz -C /tmp/lucide
node --import tsx scripts/icons/v1-catalog/build.ts /tmp/lucide/package
```

The canonical generator consumes the approved TSVs and the pinned Lucide package, validates all geometry and
canonical duplicates, and emits the collision matrix, manifest, catalog, vocabulary and category chunks.
It never edits `src/core/icons/generated/**` or the old catalog/original/variant source modules.
Its repeated output was hash-identical. The ISC and MIT texts below and in the public notice remain verbatim.

## Attribution notices (reproduced as the licences require)

### Lucide — ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted,
provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.

### Feather — MIT License (for the Lucide icons derived from Feather)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Provenance of the five BINHI originals

Opacity, Color Swatches, Landscape Orientation, Portrait Orientation and Tabs were drawn for BINHI in this repository
(`scripts/icons/original.mjs`) from basic primitives (circles, rounded rectangles, short strokes, chevrons) on the same
24×24 / 2 px grid as the rest of the set. They were written by an AI coding assistant working for CHAOS ORIGINS, not
copied from any pack. A programmatic comparison against all 1,900+ Lucide glyphs found no identical glyph: the most
any original shares with any Lucide icon is two identical primitive nodes (Color Swatches' circle pair appears in
`settings-2`); Tabs shares none. The same check found no Feather glyph among the originals. Because the originals are
simple geometric shapes authored with AI assistance, copyright subsistence/ownership is a legal question for the
founder (see the open items); they are not offered to anyone under a third-party licence.

## Obligations audit (what each licence requires, and where it is met)

| Obligation | Where it is met | Automated check |
| --- | --- | --- |
| ISC: copyright + permission notice in all copies | `public/third-party-notices.txt` is served with the app (`/third-party-notices.txt`); verbatim text in this file; each generated geometry file header names the licence; published pages that inline Lucide artwork carry a notice comment pointing to the notices | `tests/unit/icon-licensing.test.ts` |
| MIT (Feather): copyright + permission notice in copies or substantial portions | same file and this document; Feather-derived glyphs are identified **by geometry** (41), including icons Lucide renamed (e.g. `circle-help` = `help-circle`), so the registry marks them `ISC AND MIT` | same test; `generate.mjs` fails if the Feather list cannot be read |
| No endorsement / name use | the app never uses the Lucide or Feather names as branding; registry `source.name` is attribution metadata only | — |
| Pinned, reproducible source | `lucide-static@1.61.0`, regenerated by `scripts/icons/generate.mjs` | the generator throws on unknown elements/attributes and duplicate glyphs |
| Not a runtime dependency | geometry is committed; no Lucide/Feather package is installed | `package.json` |

## Licensing review status

- ISC and MIT both permit use, modification and redistribution (including commercial) when the notice is kept; this file and `public/third-party-notices.txt` are that notice. The icon browser links to it ("About these icons").
- The Lucide licence was read from the pinned package (`LICENSE` in `lucide-static@1.61.0`), not from memory.
- This is an engineering reading of the licence text, not legal advice. Founder/legal confirmation is listed as an open
  item in the Milestone I report.
