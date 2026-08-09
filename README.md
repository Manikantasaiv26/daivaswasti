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

## Deploy (GitHub Pages)

Publishing is driven by `.github/workflows/deploy-pages.yml` from the `main` branch (Node 24 actions).

In the repo settings, set **Pages → Build and deployment → Source** to **GitHub Actions** (not “Deploy from a branch”). That stops the legacy `pages-build-deployment` workflow, which still pins Node 20 actions and is what surfaces the Node 20 deprecation warning.

Custom domain: `daivaswasti.org` (via `CNAME`).

## Project structure

- `index.html` — page markup
- `styles.css` — layout and styling
- `script.js` — form handling and year stamp
- `assets/shiva-lingam.jpg` — hero image (Shiva Lingam abhishekam)
