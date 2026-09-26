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

## Offerings (UPI and card)

The **Offer** section on the home page collects a seva contribution.

- **UPI** — after the trust UPI ID is set, the page shows a QR code and opens GPay, PhonePe, Paytm, or any UPI app with the amount and reference filled in.
- **Credit or debit card** — Razorpay’s secure window collects the card. This website never asks for a card number or CVV.
- **Receipt** — after UPI payment, choose **Payment done — receipt**. A successful card payment opens the same receipt. It can be printed or downloaded.

To turn payments on, edit `payment-config.js`:

- `upiId` — the trust VPA. UPI offerings are credited to `manikantasaiv@ybl`
- `razorpayKeyId` — the public Key ID from the Razorpay dashboard (`rzp_test_...` or `rzp_live_...`)

Leave the Razorpay Key Secret off this site. Static hosting cannot safely create server-side orders, so card payments use Razorpay Checkout directly. UPI is confirmed when the transfer reaches the trust account; the optional email only sends the reference to `pranam@daivaswasti.org`.

## Project structure

- `index.html` — page markup
- `styles.css` — layout and styling
- `script.js` — form handling and year stamp
- `payment-config.js` — UPI ID and Razorpay Key ID
- `payment.js` — offerings checkout
- `assets/` — logo, favicons, images, and the QR code generator
