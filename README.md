# Daiva Swasti

Static website for [daivaswasti.org](https://daivaswasti.org/).

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

## Deploy (GitHub Pages — public repo)

Publishing is driven by `.github/workflows/deploy-pages.yml` from the `main` branch.

In the repo settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

Custom domain: `daivaswasti.org` (via `CNAME`).

If Pages was turned off (for example after changing visibility), re-enable it under **Settings → Pages**, set Source to **GitHub Actions**, then run **Actions → Deploy site to GitHub Pages → Run workflow**.

## Private repo option (Cloudflare Pages)

Free GitHub Pages cannot serve a public site from a private repository. If you need a private repo later, use `.github/workflows/deploy-cloudflare.yml` with Cloudflare secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) and point the domain to Cloudflare Pages. See the workflow file for project name `daivaswasti`.

## Project structure

- `index.html` — page markup
- `styles.css` — layout and styling
- `script.js` — form handling and year stamp
- `assets/` — logo, favicons, and images
