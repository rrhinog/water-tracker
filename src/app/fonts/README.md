# Self-hosted fonts

The Ink Kit faces are committed here so the build never downloads fonts (`next/font/local`, see `../layout.tsx`).
Latin subset only, WOFF2.

| File | Source package | Version |
|---|---|---|
| `inter-tight-latin-wght-normal.woff2` (variable, weights 100-900; the app uses 400-800) | `@fontsource-variable/inter-tight` | 5.3.0 |
| `ibm-plex-mono-latin-400-normal.woff2` | `@fontsource/ibm-plex-mono` | 5.3.0 |
| `ibm-plex-mono-latin-500-normal.woff2` | `@fontsource/ibm-plex-mono` | 5.3.0 |
| `ibm-plex-mono-latin-600-normal.woff2` | `@fontsource/ibm-plex-mono` | 5.3.0 |

Both families are licensed under the SIL Open Font License 1.1. The license text travels with the fonts:
`OFL-Inter-Tight.txt` and `OFL-IBM-Plex-Mono.txt` (each copied from its package's `LICENSE`).

To update: `npm pack` the package (official registry), extract it in a temp folder, copy the same `latin` `.woff2`
files and the `LICENSE` here, and update the versions above. Do not add the Fontsource packages as dependencies.
