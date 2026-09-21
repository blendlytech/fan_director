# 06 — The custom domain, by hand

This checks that staging answers on `https://www.studiolens.me` and that the move
did not break the one thing a domain change is most likely to break: sending.

---

## Do not run this yet

**Nothing has been deployed, and the domain is not live.** As of 2026-09-20:

- `studiolens.me` is registered but is **not a zone on the Cloudflare account**.
  A read-only check of the account returned zero zones.
- `APP_ORIGIN` in `worker/wrangler.jsonc` still points at the workers.dev host,
  deliberately. The custom-domain `routes` block is present but commented out.
- Staging therefore still runs, unchanged, at
  <https://fan-director-studio-staging.blendly.workers.dev>.

Two things must happen before step A1 can pass, and both are the owner's:

1. **Add `studiolens.me` to the Cloudflare account** (`blendly.tech@gmail.com`) and
   point the registrar's nameservers at Cloudflare. Wait until the dashboard shows
   the zone **Active** — not "Pending Nameserver Update".
2. **Do the cutover**, which is written out in the comment block in
   `worker/wrangler.jsonc` under `env.staging`: uncomment `routes`, change
   `APP_ORIGIN` to `https://www.studiolens.me`, run
   `npm run build --prefix frontend`, then deploy env staging.

If you run this script before both are done, every step fails for the same
uninteresting reason.

---

## What this is actually testing

One Worker now answers on three hostnames: the old workers.dev one, the apex, and
the `www` one. The server accepts a *send* only when the browser's `Origin` matches
`APP_ORIGIN` exactly — a single string, not a list. If a page is ever served from
a hostname that is not `APP_ORIGIN`, the page will look completely normal and then
fail the moment the fan presses Send, with `403 cross_origin`.

So the point of Part D is not "sending works". It is "sending works **from the new
domain**". A pass anywhere else proves nothing.

---

## Part A — The domain answers

| # | Do this | Expected |
| --- | --- | --- |
| A1 | Open <https://www.studiolens.me> | The site loads. The header badge says **Staging** |
| A2 | Look at the browser's address bar | It reads `www.studiolens.me`, with a padlock and no certificate warning |
| A3 | Look at the page | It is the Fan Director Studio entrance, not a Cloudflare error page (1000-series) or a parked-domain page |

If A1 shows a Cloudflare error, note the four-digit error number — it says which
half is wrong. A DNS failure means the zone is not active; a 1016 means the custom
domain is not attached to the Worker.

---

## Part B — The old host redirects

**B1.** Open <https://fan-director-studio-staging.blendly.workers.dev> in a new tab.

- **Expected:** you end up on `https://www.studiolens.me/`, with the address bar
  showing the new domain. You should not see the old hostname sitting in the
  address bar with a working site under it.

**B2.** Open a **deep link** on the old host:
`https://fan-director-studio-staging.blendly.workers.dev/creator/requests`

- **Expected:** you land on `https://www.studiolens.me/creator/requests`. The path
  survives the redirect; you are not dumped on the home page.

**B3.** Open a link on the old host **with a query string**:
`https://fan-director-studio-staging.blendly.workers.dev/saved?draft=test`

- **Expected:** you land on `https://www.studiolens.me/saved?draft=test`. The
  `?draft=test` is still there. This matters because unsubscribe links carry their
  token this way — an emailed link that loses its query string is a dead link.

**B4.** In the browser's Network tab, reload B1 and look at the first request.

- **Expected:** status **301**, with a `Location` header pointing at
  `https://www.studiolens.me/`.

**B5.** Open the old host over plain **http**, with no `s`:
`http://fan-director-studio-staging.blendly.workers.dev/`

- **Expected:** you still end up on `https://www.studiolens.me/` — note the
  `https`. The redirect matches on the whole origin, not just the hostname, so it
  upgrades the scheme at the same time.

---

## Part C — Signing in on the new host

**C1.** On `https://www.studiolens.me`, sign in as the fan from
`docs/testing/local-test-accounts.md` (git-ignored; this repository is public).

- **Expected:** the sign-in completes and the header shows you as signed in.

**C2.** Still signed in, open `/saved`.

- **Expected:** the page does **not** say "Sign in to keep your draft on your
  account". It shows the signed-in state.

If C1 fails, the likeliest cause is that the new hostname is not in
`CLERK_AUTHORIZED_PARTIES` — the session token would be rejected. Both hostnames
were added before the cutover, so this should pass; if it does not, report the
exact error and do not change Clerk.

> **A note on what you will see.** Clerk is still a **development** instance, so
> the sign-in code is the fixed test code, not one emailed to you, and the URL may
> briefly carry a `__clerk_db_jwt` handshake parameter. That is expected and is
> not a fault of the domain change. See
> `docs/reports/clerk-production-instance-tradeoff.md`.

---

## Part D — A send that succeeds (the important one)

This is the step the whole task exists for.

**D1.** Signed in as the fan on `https://www.studiolens.me`, build a Scene Card:
from the entrance press **Begin Your Vision — Vintage Lounge Greeting**, then
choose any paid option so the total changes.

- **Expected:** the running total updates, and the save indicator settles on a
  saved state rather than "Sign in to save".

**D2.** Open the browser's Network tab and leave it open. Go to `/review`.

**D3.** Press **Send**.

- **Expected:** the send succeeds. You reach the confirmation page and it shows a
  request reference ("Request A1D04E21").
- **Expected in the Network tab:** the POST returns **200 or 201**.

**D4.** If instead you see a failure, open the failing POST in the Network tab and
read the JSON body.

- **`{"error":"cross_origin"}` with status 403** means `APP_ORIGIN` does not match
  the hostname the page was served from. This is the exact fault this test is for.
  Report it with the hostname in the address bar and the request's `Origin` header;
  do not retry from the old host to "check whether it works there".
- Any other error is an ordinary failure — capture it per the README.

**D5.** Sign in as the creator in a second browser (or a private window — one Clerk
user cannot be both sides) and open `/creator/requests` on
`https://www.studiolens.me`.

- **Expected:** the request from D3 is in the queue. This confirms the send reached
  the real database and was not merely reported as sent by the page.

---

## Part E — The bare apex

**E1.** Open <https://studiolens.me> — no `www`.

- **Expected:** you end up on `https://www.studiolens.me/`. The address bar shows
  the `www` form.

**E2.** Open `https://studiolens.me/review`.

- **Expected:** you end up on `https://www.studiolens.me/review`, path intact.

**E3.** While on the apex before it redirects, check there is no certificate
warning.

- **Expected:** none. If the apex shows a certificate error, its custom domain is
  attached but the certificate has not finished issuing. Wait and retry before
  reporting it.

---

## Part F — The one known rough edge

You do not need to test this, but you should recognise it if it happens.

A tab left **open on the old hostname from before the cutover** still has the old
page loaded in memory. If someone presses Send in that stale tab, the request goes
to the old host, gets redirected, and fails — a browser turns a redirected POST
into a GET, so the result is `405 method_not_allowed` rather than a clean error.

That failure is the one that was chosen. The alternative was to leave `/api/*` out
of the redirect, which would have let the stale tab reach the API on the old host
and fail with `403 cross_origin` instead — the same dead end, wearing the label of
a security fault and sending whoever reads the log hunting through the CSRF
configuration. `405` says "wrong method at this address", which is closer to true.

**This is expected and it is not a regression.** Reloading the tab fixes it
permanently, because the reload is what follows the redirect to the new domain.
If a tester hits it, the answer is "reload and try again", and it is worth noting
how they got there rather than filing it as a bug.

---

## After a pass

Once this script passes, three follow-ups become safe to do, and none of them are
safe before:

1. Drop the workers.dev entry from `CLERK_AUTHORIZED_PARTIES` in
   `worker/wrangler.jsonc`, leaving only `https://www.studiolens.me`.
2. Change the default URL in `worker/scripts/staging-checklist.mjs` to the new
   domain. It is left on the old host on purpose: that script sends real POSTs,
   and a redirected POST is turned into a GET, so it must be pointed at the
   canonical host rather than relying on the redirect.
3. Update the staging URL in `docs/testing/README.md`, `02-staging-e2e.md`,
   `03-creator-account-setup.md` and `04-round-trip-staging.md`.

The phase reports in `docs/reports/` name the old hostname as a record of where
those runs happened. Leave them alone.

---

## When something fails

Same as the rest of these scripts — see the README. Capture the URL and what you
clicked, the exact words on screen, the request id if shown, and the failing
request from the Network tab with its path, status code and JSON body.

For this script specifically, **always include the hostname in the address bar**.
Nearly every failure here is a mismatch between which hostname served the page and
which one the server was configured to expect, and that is impossible to diagnose
without knowing which one you were on.
