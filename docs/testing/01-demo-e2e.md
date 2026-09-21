# 01 — The demo e2e suite

The public demo has no backend. This suite proves it still says so, and that the
fan journey works with nothing behind it. It must pass before any merge.

**Expected: 24 passed, 4 skipped, 0 failed.** The 4 skipped are staging-only tests.

## 1. Make sure no dev server is running

A dev server started with a Clerk key puts the app in staging mode, and the suite
reuses whatever is already on port 5173. Then the demo tests fail on copy that is
perfectly correct.

```powershell
netstat -ano | Select-String ":5173" | Select-String "LISTENING"
```

If anything comes back, note the process id in the last column and stop it:

```powershell
taskkill /PID <the id> /F
```

Nothing listed means you are clear.

## 2. Run the suite

```powershell
cd C:\Users\DELL\fan_director_studio\frontend
npm run test:e2e
```

It starts its own dev server with the Clerk key blanked, so the build under test is
the demo.

## 3. Read the result

The last lines should be:

```
  4 skipped
  24 passed (about 2 minutes)
```

The four skipped tests are named `staging: …` or carry a skip reason mentioning
staging. That is correct here.

## 4. If it fails

| Symptom | Almost certainly |
| --- | --- |
| Failures mentioning "Staging" or "your draft is saved" | A staging-mode dev server was reused. Go back to step 1 |
| `Error: browserType.launch` | Playwright's browser is missing: `npx playwright install chromium` |
| A test about "Nothing was sent to Maya" fails | A real regression. Capture the output and report it |
| Several tests time out at 30s | The dev server did not start. Run `npm run dev` in another window and read its error |

## 5. What this does not cover

Everything behind a sign-in: saving, sending, requests, the creator's screens. The
demo has none of it. That is doc 02 and doc 04.
