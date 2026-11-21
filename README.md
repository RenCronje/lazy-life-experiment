# The Lazy Life Experiment — editable site

A responsive adaptation of the existing Pixie build for **The Lazy Life Experiment** source content. It uses a slim black eye band at the top of every page and CSS/inline-SVG artwork, with editable story, business-model, financial-projection, join, Idea Generator, and transparency pages. It includes a live-preview editor, local-folder saving, and an optional secure GitHub → Vercel publishing endpoint.

## Run the project locally

Requirements: Node.js 18 or newer. No `npm install` is needed.

```bash
npm run dev
```

Open:

- Website: <http://localhost:4173>
- Editor: <http://localhost:4173/admin.html>

The editor saves a working draft to this browser as you type. **Save to project** writes the updated `site-content.json` into this folder. If you open the editor without the Node server, it can still preview and export the JSON, but the browser cannot write directly into a folder by itself.

## Cartoon eyes

`eyes.js` renders the eyes in the band that tops every page (`[data-eye-band]`). Two eyes track the pointer, blink on their own, and every few seconds switch to a new expression. The expressions come from a shuffled bag, so all fifteen appear before any repeats. Pose values (lid, tilt, brow, lashes, pupil) are interpolated, so a change tweens instead of cutting.

Expressions live in the `EXPRESSIONS` array in `eyes.js`; each entry is a base pose plus optional `left` / `right` overrides. The band is styled by `.hero-band` / `.eye-stage` / `.cartoon-eye`.

## Page structure and transitions

The home page stacks the chapters (`#about`, `#business`, `#financials`, `#join`, `#download`) as ordinary `.book-page` sections. No pinned scroll-jacking.

The eye box is the transition. A fixed black window (`.hero-notch`) rests at the top of the page showing the eyes. When a chapter's band reaches the middle of the viewport, the window expands to cover the screen, holds, then collapses back to the small window at the top so the chapter is readable. Scrolling up replays it in reverse, and the box does it again for every chapter. Under `prefers-reduced-motion` the box skips the expansion entirely.

## Deploy to Vercel through GitHub

1. Create a GitHub repository and push this project to it.
2. In Vercel, import that GitHub repository as a project. Keep the project root at this folder. It is a static site with Node serverless functions in `api/`; no build command or framework preset is required.
3. In **Vercel → Project → Settings → Environment Variables**, add:

   | Variable | Value |
   | --- | --- |
   | `EDITOR_PASSWORD` | A long, private password for the publishing button |
   | `GITHUB_TOKEN` | A GitHub fine-grained personal access token |
   | `GITHUB_OWNER` | The GitHub user or organization that owns the repository |
   | `GITHUB_REPO` | The repository name |
   | `GITHUB_BRANCH` | The deployment branch, usually `main` |
   | `GITHUB_CONTENT_PATH` | Optional; defaults to `site-content.json` |

   Give the fine-grained token access to **only this repository**, with **Contents: Read and write**. The token is used only by the serverless function and is never sent to the browser. Set the variables for the environments you intend to publish from, then redeploy the Vercel project.

4. Open `https://your-domain.example/admin.html`, enter the `EDITOR_PASSWORD` in **Publishing & password**, and click **Publish to GitHub**. The endpoint updates only `site-content.json` on the configured branch. Vercel starts its normal Git deployment when that branch is connected to the Vercel project.

A GitHub commit is created immediately; the public site changes after Vercel finishes its deployment (usually seconds to a few minutes, depending on the project and Vercel queue). The editor preview itself updates as you type.

### Security notes

- Never place a GitHub token in `site-content.json`, `admin.js`, or any browser-visible file.
- Keep `.env.local` private; it is already excluded by `.gitignore`.
- The Vercel publishing endpoint requires `EDITOR_PASSWORD`, checks same-origin requests, and uses the server-side token. Use HTTPS and a strong password.
- The `/admin.html` UI is intentionally reachable so you can use it; publishing is locked on the server until configured.

## What is editable

The editor covers the brand and SEO fields, navigation, colors and gradient, hero copy and project destination, founder profile, executive summary, market analysis, business model, financial projections, backer benefits, join form copy, closing CTA, footer, Idea Generator page, and transparency page. Edits appear in the embedded preview immediately.

The funding goal, phase lengths, monthly expenses, break-even horizon, equity participation, and possible exit paths are represented as source-site proposals or projections, not guarantees. The interest form is a nonfunctional preview: it does not submit or store personal information. Before launch, connect an approved secure form service and add reviewed investment, privacy, and legal terms. The CTA defaults to the Join chapter until a real project/funding destination is supplied in the Hero fields.

## Project map

- `index.html`, `models.html`, `privacy.html` — public pages
- `admin.html` — linked content editor with live preview
- `site-content.json` — editable Lazy Life Experiment content adapted from the source page
- `site.js`, `styles.css` — page rendering, interactions, and styling
- `admin.js`, `admin.css` — editor UI
- `api/publish.js` — password-protected GitHub content commit endpoint for Vercel
- `api/status.js` — non-secret publishing setup status
- `server.js` — local static server and local file-save endpoint
- `lib/github.js` — server-side GitHub Contents API helper
