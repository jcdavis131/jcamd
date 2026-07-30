# jcamd.com

Personal consulting site for J. Cameron Davis (workforce intelligence). Static HTML/CSS/JS, no build step, served by the Vercel project `jcamd`.

| Path | Role |
|------|------|
| `index.html` | Practice, services, track record, lab, contact |
| `family/index.html` | Family Neural Architecture — architecture write-up plus a live, client-side personalized feed |
| `assets/site.css` | Drafting-board UI |
| `assets/family.css` | Components used only by `/family/` (code blocks, callouts, wheel figure, profile form, feed cards) |
| `assets/family-app.js` | `/family/`'s feed engine — client-side ephemeris, 64-gate wheel, 36-channel map, profile storage. No dependencies, no backend; birth data lives only in the browser's `localStorage` |
| `assets/site.js` | Nav scroll-spy, mobile menu |
| `assets/github.js` | GitHub profile, activity, repos |

**Deploy:** push to `master` on `jcdavis131/jcamd`.

**Routes** (see `vercel.json`): `/arcade` redirects to hoops.dumbmodel.com; `/knowledge` and `/journal` redirect to the home page. `/graphify/` serves a static knowledge-graph viewer. `/family/` documents the Family Neural Architecture side project and includes a working "Your feed" tool — enter a birth date and it computes today's chart client-side. No personal or natal data is published on the page itself; profile data entered by visitors stays in their own browser's local storage and is never transmitted anywhere.
