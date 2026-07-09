# jcamd.com

Workforce intelligence consulting site. Static, zero dependencies, Vercel project **`jcamd`**.

| Path | Role |
|------|------|
| `index.html` | Practice, services, track record, lab, contact |
| `assets/site.css` | Drafting-board UI |
| `assets/site.js` | Nav scroll-spy, mobile menu |
| `assets/github.js` | GitHub profile card |
| `assets/contributions.js` | Contribution heatmap (renders `/api/contributions`) |
| `api/contributions.js` | GitHub GraphQL proxy — needs `GITHUB_TOKEN` |

**Deploy:** push to `master` on `jcdavis131/jcamd`.

**Routes:** `/arcade` → dumbmodel.com · `/knowledge`, `/journal` → home.

**Env:** `GITHUB_TOKEN` — a fine-grained token with *no* scopes. The contribution
calendar is GraphQL-only, so it cannot be fetched from the browser like the profile
card. Without the token `/api/contributions` returns 501 and the heatmap hides itself.
