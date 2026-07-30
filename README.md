# jcamd.com

Personal consulting site for J. Cameron Davis (workforce intelligence). Static HTML/CSS/JS, no build step, served by the Vercel project `jcamd`.

| Path | Role |
|------|------|
| `index.html` | Practice, services, track record, lab, contact |
| `family/index.html` | Family Neural Architecture — side-project write-up |
| `assets/site.css` | Drafting-board UI |
| `assets/family.css` | Components used only by `/family/` (code blocks, callouts, wheel figure) |
| `assets/site.js` | Nav scroll-spy, mobile menu |
| `assets/github.js` | GitHub profile, activity, repos |

**Deploy:** push to `master` on `jcdavis131/jcamd`.

**Routes** (see `vercel.json`): `/arcade` redirects to hoops.dumbmodel.com; `/knowledge` and `/journal` redirect to the home page. `/graphify/` serves a static knowledge-graph viewer. `/family/` documents the Family Neural Architecture side project — architecture only, no personal or natal data.
