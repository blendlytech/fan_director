# Clerk: development instance on a production domain

**For the owner. A decision to make, not work that has been done.**
Written 2026-09-20, during Phase 5 task 1 (the custom domain).

**Nothing in Clerk has been created, changed or reconfigured.** Clerk settings are
reserved to the owner, and this document exists only so the choice can be made with
the tradeoff in front of you.

---

## The situation

Putting staging on `https://www.studiolens.me` changes who sees it. The workers.dev
hostname announced itself as scaffolding; a real domain does not. But the
authentication behind it is unchanged: Clerk instance `superb-crawdad-9550`, which
is a **development** instance.

That mismatch is the whole of this document. A real creator would be signing in to
what looks like a finished product, through a Clerk instance that is not built to
be one.

---

## What a development instance actually means here

Three of these are visible to anyone using the site.

| | What it means | Who notices |
| --- | --- | --- |
| **Test sign-in codes** | Addresses in Clerk's `+clerk_test` form sign in with a fixed code and no email is sent. This is what makes the owner's test scripts fast, and it is a deliberate convenience. | Anyone who knows the address format |
| **The dev-browser handshake** | Development instances pass a `__clerk_db_jwt` parameter through the URL to establish the session. | Anyone who glances at the address bar |
| **A key that says "development"** | The publishable key baked into the frontend bundle is a `pk_test_…`. The bundle is public by nature, so this is readable by anyone. | Anyone who looks |
| **A 100-user cap** | `worker/README.md` records development instances as capped at 100 users. Fine for a pilot; a hard ceiling on a real one. | Only at scale |

The first one deserves a second look given this repository is **public**. The
project already treats test addresses as credentials — `local-test-accounts.md` is
git-ignored, and `fan_a`/`fan_b`/`fan_c` were deleted on 2026-09-20 precisely
because they had been committed. That discipline holds. But it is a discipline
protecting a door that a production instance would simply not have.

**Not verified:** I did not sign in to the Clerk dashboard and did not re-check
Clerk's current published limits. The 100-user figure is what this repository
records, not something I confirmed today.

---

## What moving to production would cost

This is not a switch. It is, roughly in order:

1. **DNS records on `studiolens.me`.** Clerk requires several CNAME records on the
   domain. The domain is not even a Cloudflare zone yet, so this waits on the same
   prerequisite the custom domain does.
2. **New keys.** A production instance has its own publishable key (`pk_live_…`),
   its own secret key and its own JWKS. That means `CLERK_ISSUER` changes,
   `CLERK_JWT_KEY` and `CLERK_SECRET_KEY` are re-set with `wrangler secret put`,
   and the frontend is rebuilt with the new publishable key.
3. **Every account is recreated.** Users do not move between a development instance
   and a production one. The creator account would be made again and re-linked to
   `cr_maya`, redoing `docs/testing/03-creator-account-setup.md`. Every test fan
   account is made again.
4. **Testing gets slower.** The `+clerk_test` fixed-code convenience goes away.
   Every sign-in in the owner's test scripts becomes a real email with a real code,
   which affects docs 02, 03 and 04 more than it sounds like it would.

### And one thing that may make it worse, not better

`worker/README.md` records that **development instances include every paid Clerk
feature, TOTP included**, while a production instance needs Clerk Pro for the same
things. The second-factor waiver (doc 11 §5.6 item 27, 2026-09-20) was granted on
the basis that MFA is a Pro feature and Pro waits on revenue.

Read together, those two statements say that moving to production **without** Pro
would take away the option of creator MFA rather than restore it — a step down in
available protection, paid for with a week of account migration.

I have not re-checked this against Clerk's current plans, and the repository is
slightly inconsistent about it: the README says development instances have every
paid feature including TOTP, while the waiver's stated reason is that MFA is
out of reach. Both cannot be the whole story.

**This is the single thing to confirm before scheduling the move**, because it is
the difference between "production is an upgrade" and "production is a downgrade
until we pay for Pro". It is a question for the Clerk dashboard's billing page,
and it is the owner's to look at.

---

## The recommendation

**Stay on the development instance for now, and treat it as a deadline rather than
a decision that is finished.**

The reasoning:

- The domain itself is the blocker. Clerk production needs DNS records on
  `studiolens.me`, and `studiolens.me` is not on Cloudflare yet. Sequencing the
  Clerk move before the zone exists is not possible, so nothing is lost by waiting.
- The cost of the move is concentrated in recreating accounts and re-linking the
  creator — work that is cheap now, while there is one creator and a handful of
  test fans, and gets more expensive with every real account added.
- The public-repository exposure is real but currently contained by a practice
  that is working.
- And if the Pro question above resolves the way the README suggests, moving now
  would cost money to stand still.

**The line I would not cross:** the day a creator who is not you, or a fan who is
not a tester, is asked to sign in on `www.studiolens.me`, this should already have
moved. Recreating one creator account is a small job. Recreating a dozen real
people's accounts, and asking them to sign up a second time, is not a small job,
and it is the kind of thing that costs trust rather than time.

So: move before the first outside user, not after. If the pilot is closer than the
Cloudflare zone is, the Clerk move should be scheduled deliberately rather than
discovered.

---

## What I need from you

Nothing blocking — Phase 5 task 1 proceeds either way, because the custom domain
and the Clerk instance are independent until the zone exists.

When you do decide, the two answers that change the work are:

1. **When** the move happens: before the pilot's first outside user, or explicitly
   deferred with that risk accepted.
2. **Who does it.** Clerk changes are reserved to you. If you want it prepared
   from this side — the config changes, the secret-setting steps, the rebuild, and
   an updated `docs/testing/03` — that can be written out for you to execute
   without anyone else touching the Clerk dashboard.
