# Icon library — sources and licences

The BINHI Universal Icon Library ships exactly **250** icons (25 categories × 10, numbers 001–250).
Every icon is either derived from **Lucide** (ISC) or **authored by BINHI**. Nothing is copied from Canva, Wix,
Adobe or any other commercial pack, and no icon font or remote icon service is used at runtime.

| Source | Count | Licence | Where it lives |
| --- | --- | --- | --- |
| Lucide `lucide-static` 1.61.0 (geometry only) | 245 | ISC; 36 of them also fall under the Feather MIT notice | `src/core/icons/generated/shapes/*.ts` |
| BINHI original (Opacity, Color Swatches, Landscape Orientation, Portrait Orientation, Tabs) | 5 | BINHI, same terms as this repository | `scripts/icons/original.mjs` |

Per-icon source and licence: [`docs/ICON_INVENTORY.md`](ICON_INVENTORY.md) (generated).

## How the data gets into the repository

`scripts/icons/generate.mjs` reads `scripts/icons/catalog.mjs` (the authoritative 250-entry mapping) and an extracted
`lucide-static@1.61.0` package, and writes the committed geometry. Lucide is **not** a dependency of the app: only the
vector node lists (path / circle / rect / line / polyline / polygon / ellipse) are committed. The generator refuses
unknown elements and attributes, duplicate glyphs and duplicate slugs.

```sh
npm pack lucide-static@1.61.0 && mkdir /tmp/lucide && tar -xzf lucide-static-1.61.0.tgz -C /tmp/lucide
node scripts/icons/generate.mjs /tmp/lucide/package
```

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

## Licensing review status

- ISC and MIT both permit use, modification and redistribution (including commercial) when the notice is kept; this file is
  that notice. It is surfaced in the app's icon browser footer ("About these icons") in Milestone III.
- The Lucide licence was read from the pinned package (`LICENSE` in `lucide-static@1.61.0`), not from memory.
- This is an engineering reading of the licence text, not legal advice. Founder/legal confirmation is listed as an open
  item in the Milestone I report.
