# 03 — The creator account (one-time)

The creator's screens need a Clerk user that the Worker recognises as Maya. Two
things must be true, or every creator endpoint answers 403:

1. `creator.clerk_user_id` in the staging database equals that user's Clerk id;
2. the row's `status` is `active` — it already is for `cr_maya`.

`cr_maya` is seeded with `clerk_user_id = NULL`, so today no one can open the
creator screens. This closes that.

> **No authenticator app is needed** for the first creators (doc 11 §5.6 item 27,
> owner 2026-09-20). Clerk's multi-factor authentication needs the Pro plan, so
> staging runs with `CREATOR_SECOND_FACTOR_REQUIRED="false"` and a creator signs in
> with their email alone.
>
> Two consequences worth knowing. The account is then only as safe as its mailbox:
> whoever can read that inbox can open the queue, read fans' private requests and
> approve commissions — so pick the mailbox with that in mind. And **the exemption
> only applies once staging is deployed with it**; if the site still asks you for an
> authenticator code, the deploy carrying this change has not happened yet.
>
> Do not change any Clerk instance setting. The authenticator stays available and
> SMS stays off; this is our own Worker's rule, not Clerk's.

## 1. Create the creator's account on staging

1. Open <https://fan-director-studio-staging.blendly.workers.dev> in a browser where
   you are **not** signed in as a fan (a private window is easiest).
2. Choose **Create account** and sign up with the email you want to be Maya's. Use a
   different email from the fan account you will test with in doc 04 — one Clerk user
   cannot be both sides.
3. Finish the email verification Clerk asks for.

## 2. Find the Clerk user id

1. Open the Clerk dashboard for instance `superb-crawdad-9550`.
2. **Users** → the account you just made → copy the **User ID**. It looks like
   `user_2ab...`.

A Clerk user id is an identifier, not a credential, but keep it out of commits all
the same: the command below runs locally, and the optional seed file in step 4 is
git-ignored.

## 3. Point `cr_maya` at that user

```powershell
cd C:\Users\DELL\fan_director_studio\worker
npx wrangler d1 execute DB --env staging --remote --command "UPDATE creator SET clerk_user_id = 'user_PASTE_IT_HERE' WHERE id = 'cr_maya';"
```

Check it landed, without printing the id:

```powershell
npx wrangler d1 execute DB --env staging --remote --json --command "SELECT id, display_name, status, clerk_user_id IS NOT NULL AS linked FROM creator WHERE id = 'cr_maya';"
```

Expected: `"display_name": "Maya"`, `"status": "active"`, `"linked": 1`.

## 4. Optional: keep the link as a local seed

```powershell
Set-Content -Encoding utf8 C:\Users\DELL\fan_director_studio\worker\seeds\local-creator.sql "UPDATE creator SET clerk_user_id = 'user_PASTE_IT_HERE' WHERE id = 'cr_maya';"
```

`worker/seeds/local-*.sql` is git-ignored. Confirm with `git status` that nothing new
appears before you commit anything.

## 5. Prove it works

Open <https://fan-director-studio-staging.blendly.workers.dev/creator/requests> while
signed in as that account.

| What you see | What it means |
| --- | --- |
| "Request Queue" with "No requests match this filter." | Correct. Nothing has been sent yet; doc 04 fills it |
| "This account isn't a creator account on this site." | Step 3 did not land, or you are signed in as a different user |
| "Sign in as the creator to see your request queue." | You are signed out |
| "Creator pages need an authenticator app on your account…" | Staging is still running a build that requires the second factor. It needs the deploy that carries `CREATOR_SECOND_FACTOR_REQUIRED="false"` |
| "Creator pages need your authenticator app…" | Same as above; or, if the second factor has been switched back on deliberately, sign out and in again entering your code |

Stop here if the queue does not open. Doc 04's creator half cannot run until it does,
and the message you see says exactly which condition failed.

## When Clerk Pro arrives

Set `CREATOR_SECOND_FACTOR_REQUIRED` back to `"true"` in `worker/wrangler.jsonc`
under `env.staging.vars`, deploy, and have every creator enrol an authenticator app
with backup codes (doc 11 §5.6 item 17). The Worker's check was never removed, and
the test suite still exercises it, so nothing needs rebuilding.
