# 03 — The creator account (one-time)

The creator's screens need a Clerk user that the Worker recognises as Maya. Three
things must be true at once, or every creator endpoint answers 403:

1. `creator.clerk_user_id` in the staging database equals that user's Clerk id;
2. the row's `status` is `active` (it already is for `cr_maya`);
3. the signed-in session has a **verified second factor** — an authenticator code
   entered during that sign-in.

`cr_maya` is seeded with `clerk_user_id = NULL`, so today no one can open the
creator screens. This closes that.

> Do not change any Clerk instance setting. The authenticator is already on and SMS
> is already off; both are confirmed correct. This document only adds a user.

## 1. Create the creator's account on staging

1. Open <https://fan-director-studio-staging.blendly.workers.dev> in a browser
   where you are **not** signed in as a fan (a private window is easiest).
2. Choose **Create account** and sign up with the email you want to be Maya's. Use
   a different email from the fan account you will test with in doc 04 — one Clerk
   user cannot be both sides.
3. Finish the email verification Clerk asks for.

## 2. Enrol the authenticator on that user

1. Still signed in as that user, open the account control in the header (the avatar
   button) and go to **Security**.
2. Add an **authenticator app**. Scan the QR code with your authenticator and enter
   the six-digit code to confirm.
3. If Clerk offers backup codes, save them somewhere you trust. Do not paste them
   into this repo, this chat, or any file here.

## 3. Find the Clerk user id

1. Open the Clerk dashboard for instance `superb-crawdad-9550`.
2. **Users** → the account you just made → copy the **User ID**. It looks like
   `user_2ab...`.

A Clerk user id is an identifier, not a credential, but keep it out of commits all
the same: the command below is run locally, and the optional seed file in step 5 is
git-ignored.

## 4. Point `cr_maya` at that user

```powershell
cd C:\Users\DELL\fan_director_studio\worker
npx wrangler d1 execute DB --env staging --remote --command "UPDATE creator SET clerk_user_id = 'user_PASTE_IT_HERE' WHERE id = 'cr_maya';"
```

Check it landed, without printing the id:

```powershell
npx wrangler d1 execute DB --env staging --remote --command "SELECT id, display_name, status, clerk_user_id IS NOT NULL AS linked FROM creator WHERE id = 'cr_maya';" --json
```

Expected: `"display_name": "Maya"`, `"status": "active"`, `"linked": 1`.

## 5. Optional: keep the link as a local seed

If you would rather not retype the command later, put it in a file that git
ignores:

```powershell
Set-Content -Encoding utf8 C:\Users\DELL\fan_director_studio\worker\seeds\local-creator.sql "UPDATE creator SET clerk_user_id = 'user_PASTE_IT_HERE' WHERE id = 'cr_maya';"
```

`worker/seeds/local-*.sql` is git-ignored. Confirm with `git status` that nothing
new appears before you commit anything.

## 6. Prove it works

1. Sign out of the creator account, then sign in again **and enter your
   authenticator code**. The second factor has to be verified in the current
   session; an old session that never saw a code will still be refused.
2. Open <https://fan-director-studio-staging.blendly.workers.dev/creator/requests>.

| What you see | What it means |
| --- | --- |
| "Request Queue" with "No requests match this filter." | Correct. Nothing has been sent yet; doc 04 fills it |
| "Creator pages need your authenticator app…" | The session has no verified second factor. Sign out and in again, entering the code |
| "Creator pages need an authenticator app on your account…" | Step 2 did not complete. Enrol the authenticator |
| "This account isn't a creator account on this site." | Step 4 did not land, or you are signed in as a different user |
| "Sign in as the creator to see your request queue." | You are signed out |

Stop here if the queue does not open. Doc 04's creator half cannot run until it
does, and the message you see tells me exactly which of the three conditions failed.
