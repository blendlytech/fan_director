# 03 — The creator account (done 2026-09-20)

**This one-time setup is already done.** The account exists, `cr_maya` points at it,
and the creator endpoints answer it. You do not need to run anything here; read §1 to
sign in, and §4 if you want to see it for yourself before starting doc 04.

**The sign-in details are not in this repository.** It is public, and on a Clerk
development instance an address plus its fixed code is a working login for the creator
queue. They are in `docs/testing/local-test-accounts.md` on the owner's machine,
which `.gitignore` keeps out of every commit.

| Thing | Where |
| --- | --- |
| Creator email and sign-in code | `local-test-accounts.md`, next to this file |
| Database row | `cr_maya`, `status: active`, `linked: 1` |

> **No authenticator app is needed** for the first creators (doc 11 §5.6 item 27,
> owner 2026-09-20). Clerk's multi-factor authentication needs the Pro plan, so
> staging runs with `CREATOR_SECOND_FACTOR_REQUIRED="false"` and a creator signs in
> with their email alone. If the site ever asks you for an authenticator code, it is
> running a build older than version `c0d02366-82cd-422e-b250-859133692335`.
>
> The account is then only as safe as its mailbox: whoever can read that inbox can
> open the queue, read fans' private requests and approve commissions.
>
> Do not change any Clerk instance setting. The authenticator stays available and SMS
> stays off; this is our own Worker's rule, not Clerk's.

## 1. Sign in as the creator

1. Open <https://fan-director-studio-staging.blendly.workers.dev> in a browser where
   you are **not** signed in as a fan. A private window is easiest, and you will want
   a second one for the fan side of doc 04 — one Clerk user cannot be both sides.
2. Sign in with the email from `local-test-accounts.md`.
3. When Clerk asks for the emailed code, type the code from that same file. Nothing is
   sent to a real mailbox and nothing arrives; the code is fixed.

### Why that address works, and what it costs

The creator's address is a **test identity** on a Clerk development instance: it skips
real email delivery and always takes one fixed code. The fan account for doc 04 uses
the same trick, and is in the same file.

It is the right tool for proving the round trip today and the wrong one for a real
creator. It only works on a development instance, so it will not survive the move to
production, and anyone who has the address can sign in as Maya — which is why the
address lives outside the repository and why its local part is random rather than
guessable. **Before a real creator uses the site, make them an account on a mailbox
they control and re-point the row (§3).**

## 2. What was done

Recorded so it can be audited or redone, not because you need to repeat it:

1. The Clerk user was created through the Backend API with its email pre-verified and
   no password, using the secret key already in `worker/.dev.vars`. No Clerk instance
   setting was touched.
2. `cr_maya` was pointed at it on the remote staging database, with the user's id in
   place of the placeholder:

   ```powershell
   cd C:\Users\DELL\fan_director_studio\worker
   npx wrangler d1 execute DB --env staging --remote --command "UPDATE creator SET clerk_user_id = 'user_NEW_ID' WHERE id = 'cr_maya';"
   ```

## 3. Re-checking the link, or pointing it at someone else

```powershell
cd C:\Users\DELL\fan_director_studio\worker
npx wrangler d1 execute DB --env staging --remote --json --command "SELECT id, display_name, status, clerk_user_id IS NOT NULL AS linked FROM creator WHERE id = 'cr_maya';"
```

Expected: `"display_name": "Maya"`, `"status": "active"`, `"linked": 1`.

To hand the creator role to a different account, run the `UPDATE` from §2 with that
user's Clerk id, then update `local-test-accounts.md`. Only one Clerk user can be
Maya at a time — the column is a single value, so the previous account loses access
the moment the new one is set, which is also how a leaked address is closed off.

## 4. Proof, and what is still yours to check

**Already verified on 2026-09-20, against the deployed staging site**, by signing in
as this account through Clerk's API and calling the endpoints directly:

| Call | Result |
| --- | --- |
| `GET /api/creator/commissions` | **200** `{"commissions":[],"counts":{}}` |
| `GET /api/commissions` | **200** `{"commissions":[]}` |

The session used carried `fva: [0,-1]` — no second factor ever verified — and was
accepted, so the waiver is confirmed working on staging, not merely configured. Both
sessions created for that check were revoked afterwards.

**Not yet checked: what the screens look like.** The API answering is not the same as
the queue rendering. Open
<https://fan-director-studio-staging.blendly.workers.dev/creator/requests> while
signed in as the creator:

| What you see | What it means |
| --- | --- |
| "Request Queue" with "No requests match this filter." | Correct. Nothing has been sent yet; doc 04 fills it |
| "This account isn't a creator account on this site." | You are signed in as a different user — a fan account, most likely |
| "Sign in as the creator to see your request queue." | You are signed out |
| "Creator pages need an authenticator app on your account…" | Staging is running a build older than the waiver |
| Anything else | Capture it per the README's "When something fails" list |

## When Clerk Pro arrives

Set `CREATOR_SECOND_FACTOR_REQUIRED` back to `"true"` in `worker/wrangler.jsonc`
under `env.staging.vars`, deploy, and have every creator enrol an authenticator app
with backup codes (doc 11 §5.6 item 17). The Worker's check was never removed, and
the test suite still exercises it, so nothing needs rebuilding. Swapping the test
identity for a real mailbox (§1) belongs in the same piece of work.
