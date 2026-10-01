# Creator landing page

The public page for `studiolens.me`, aimed at creators. It's plain
HTML, CSS and JS in `public/` (the October 2026 redesign: parallax hero, interactive request
estimate). There's no build step and no backend: every "Apply" button opens an email to `info@studiolens.me`.

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
CLOUDFLARE_ACCOUNT_ID=ecb1b97c68e18a562472e8808f6e5879 npx --prefix ../worker wrangler deploy
```

Name the account explicitly. Without it, Wrangler can pick up the demo's cached account
(`frontend/node_modules/.cache`, the scmillsc0809 account) and fail with an authentication
error. The page belongs on the Blendly account, next to staging and the studiolens.me zone.

It's live at https://studiolens-landing.blendly.workers.dev (redesign deployed 2026-10-01).

That serves the page on its `workers.dev` address. To put it on the domain:

1. The `studiolens.me` zone was added to the Blendly account on 2026-10-01, with the IONOS
   Mail Basic records (MX `mx00`/`mx01.ionos.com`, SPF) copied in. Switch the nameservers
   at IONOS to `gabe.ns.cloudflare.com` and `haley.ns.cloudflare.com`.
2. Once the zone shows Active, uncomment `routes` in `wrangler.jsonc` and deploy again.

The apex `studiolens.me` is canonical. A Single Redirect rule on the zone already sends
`www.studiolens.me` to it with a 301.

When the production app is ready, it takes over `studiolens.me` and serves this
content at `/`. Remove the routes here before that deploy, or the two Workers
will both claim the domain.
