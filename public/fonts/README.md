# Self-hosted fonts

The Design Studio names five web fonts. They are served from here, so a design
looks the same on every device and no visitor is sent to a third party to draw
one. Declared in `src/client/studio/design/fonts.css`.

| Family | Files (latin + latin-ext, variable weight) | Source |
|---|---|---|
| Inter | `inter-*-wght-normal.woff2` | `@fontsource-variable/inter` 5.3.0 |
| Playfair Display | `playfair-display-*-wght-normal.woff2` | `@fontsource-variable/playfair-display` 5.3.0 |
| DM Sans | `dm-sans-*-wght-normal.woff2` | `@fontsource-variable/dm-sans` 5.3.0 |
| Space Grotesk | `space-grotesk-*-wght-normal.woff2` | `@fontsource-variable/space-grotesk` 5.3.0 |
| Lora | `lora-*-wght-normal.woff2` | `@fontsource-variable/lora` 5.3.0 |

All five are licensed under the SIL Open Font License 1.1. Each licence text is
kept next to the files (`LICENSE-*.txt`) and must stay with them. The files are
unmodified copies from the packages above; they are not an npm dependency of this
app.

Coverage: Latin and Latin Extended only. Text in other scripts falls back to the
system font for those characters. `Georgia`, `System Sans`, `System Serif` and
`Monospace` are device fonts by design and are not hosted here.

To update: download the new package version outside the repo, copy the two
`*-latin(-ext)-wght-normal.woff2` files and the `LICENSE`, regenerate
`fonts.css` from the package's `wght.css`, then run `npm run templates:assets`
(it measures every template's text with these exact files and fails on any
overflow) and commit the regenerated previews.
