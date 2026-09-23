# jcamd.com

Personal portfolio for JC Davis — builder of AI products in Austin,
Texas. Static HTML/CSS, no build step, served by the Vercel project `jcamd`.

| Path | Role |
|------|------|
| `index.html` | Portfolio: opening card, the work as a sequence of frames, timeline, craft, lab, stack, contact |
| `assets/frame.css` / `frame.js` | Shared design layer for every page: tokens (type scale, spacing, one accent, light + dark), header, footer, theme toggle, reveals, print |
| `assets/portfolio.css` | Home page composition |
| `family/index.html` | Family Neural Architecture — write-up + client-side chart tool (`site.css`, `family.css`) |
| `chips/index.html` | CPU vs GPU vs DPU, exploded in 3D (three.js); the stages stay dark in both themes |
| `graphify/` | Static knowledge-graph viewer |
| `404.html` | Not-found page (Vercel serves it automatically) |
| `assets/fonts/` | Self-hosted Jost (OFL), used only for titles and labels |
| `assets/icons/`, `assets/og/`, `favicon.ico`, `site.webmanifest` | Icon set and 1200×630 social cards |

**Theme:** follows `prefers-color-scheme`; the header toggle stores a choice in
`localStorage` (`jcamd-theme`). The opening title sequence plays once per
session, any input skips it, and it never runs under reduced motion.

**Check:** `python3 scripts/smoke.py` (also runs in CI).

**Deploy:** push to `main` on `jcdavis131/jcamd`.

**Routes** (see `vercel.json`): `/arcade` redirects to hoops.dumbmodel.com;
`/knowledge` and `/journal` redirect to the home page.
