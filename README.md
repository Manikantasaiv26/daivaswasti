# Daiva Swasti

Static website for [daivaswasti.org](https://daivaswasti.org/).

The GitHub repository can stay **private**. The public site is hosted on **Cloudflare Pages** (free GitHub Pages cannot serve a public site from a private repo).

## Features

- Hero banner using the sacred shrine image
- Contact form with newsletter signup option
- Explore / About / Services / Contact / Connect footer links
- Contact email: `pranam@daivaswasti.org`
- Contact form delivers messages to that inbox via Formsubmit

## Local preview

Open `index.html` in a browser, or serve the folder with any static file server:

```bash
npx --yes serve .
```

## Deploy (Cloudflare Pages + private GitHub repo)

Publishing is driven by `.github/workflows/deploy-cloudflare.yml` on every push to `main`.

### One-time setup

1. Create a free [Cloudflare](https://dash.cloudflare.com/) account.
2. In Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Create a project** → **Direct Upload**. Name the project exactly `daivaswasti` (or change the name in the workflow to match).
3. Create an API token: [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → use the **Edit Cloudflare Workers** template (includes Pages) → create. Copy the token.
4. Copy your **Account ID** from the Cloudflare dashboard overview (right sidebar).
5. In this GitHub repo → **Settings → Secrets and variables → Actions**, add:
   - `CLOUDFLARE_API_TOKEN` — the token from step 3
   - `CLOUDFLARE_ACCOUNT_ID` — the account ID from step 4
6. Push to `main` (or run **Actions → Deploy site to Cloudflare Pages → Run workflow**). Note the `*.pages.dev` URL from the workflow log.
7. Attach the custom domain:
   - Cloudflare Pages project → **Custom domains** → add `daivaswasti.org` and `www.daivaswasti.org` if needed.
   - At your domain registrar (or in Cloudflare DNS if the domain is on Cloudflare), point:
     - `daivaswasti.org` → the Pages target Cloudflare shows (often a CNAME to `daivaswasti.pages.dev`, or Cloudflare’s proxied records)
     - Remove any old GitHub Pages `A` / `CNAME` records that pointed at GitHub.
8. Wait for DNS to update, then open https://daivaswasti.org/.

### Optional: GitHub Pro instead

If you prefer to keep using GitHub Pages only, upgrade the GitHub account to **Pro**, keep the repo private, and re-enable GitHub Pages. Cloudflare Pages is the free path used by this repo.

## Project structure

- `index.html` — page markup
- `styles.css` — layout and styling
- `script.js` — form handling and year stamp
- `assets/` — logo, favicons, and images
