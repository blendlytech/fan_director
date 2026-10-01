# Creator landing page

The public page for `www.studiolens.me`, aimed at creators. It's one static file,
`public/index.html`, styled from `docs/specs/02-design-system.md`. There's no build
step and no backend: every "Apply" button opens an email to `info@studiolens.me`.

## What the page promises

The owner's strategy of 2026-10-01: a Free plan, and Pro free for 3 months for the
first 50 founding creators, with the price announced before that period ends. White-glove setup
costs $99 at the founding price. It's paid only after the creator's boutique is live and
they've approved it, never upfront, and it's refundable within 30 days. Upfront setup fees
are the best-known agency scam, so "nothing upfront" is deliberate. Any change to these
terms is a change to this page.

The page follows the product's no-false-claims rule:
- the AI Director is marked "In final testing";
- shooting scripts are marked "Planned";
- the Scene Card is marked "Example", and its total is added up from its lines;
- the page shows no testimonials and no usage figures.

## Deploy

From this folder:

```bash
npx --prefix ../worker wrangler deploy
```

That serves the page on its `workers.dev` address. To put it on the domain:

1. Add `studiolens.me` to the Cloudflare account and switch its nameservers at IONOS.
2. Uncomment `routes` in `wrangler.jsonc`.
3. Deploy again. The apex and `www` both serve the page.

When the production app is ready, it takes over `www.studiolens.me` and serves this
content at `/`. Remove the routes here before that deploy, or the two Workers
will both claim the domain.
