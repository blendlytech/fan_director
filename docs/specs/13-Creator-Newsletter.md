# Fan Director Studio: The Creator Newsletter

Date: 2026-10-01
Owner: Clay Mills
Written for: the owner (to approve) and the coding agent who builds it
Status: **Draft for owner approval.** Nothing here is built. This is the "own spec" for sending that doc 11 §5.8 promised, and the "separate, opt-in mailing list" that doc 12 §8.2 points to.

---

## 1. What this is

A private newsletter from each creator to the fans who chose to get it. It keeps fans connected: each issue should leave them feeling they know her a little better than they did after the last one. Most issues don't sell anything. Every issue ends with her schedule and her links.

The platform sends it, on the creator's behalf, only to fans who opted in to **that creator's** list.

## 2. Consent (builds on doc 11 §5.8, which stays in force)

Already decided and built: consent is **per creator, unticked, optional and never bundled**. The exact wording is versioned. History is append-only (`marketing_consent`), and unsubscribe works in one click without signing in.

**Entry points:**

| Where | Source value | Status |
| --- | --- | --- |
| The one-time step after a fan's first sign-up (design 23) | `signup` | Designed, approved 2026-09-17 |
| Account settings | `settings` | Designed (design 16, A3) |
| **Beside the delivered after-shoot letter** (doc 14 §4) | `letter` | **New**: needs a migration and a design state |
| Resubscribing from the unsubscribe page | `unsubscribe_page` | Built |

**Service messages are not marketing and need no checkbox.** These are: the creator has a question about the request, the creator approved or proposed changes, the letter is ready. The fan is told once, at sign-up, that the platform will email them about their own requests.

**Why one combined checkbox isn't allowed.** It was considered on 2026-10-01 and rejected for three reasons:

- **The law.** In the EU, UK and Canada, marketing consent must be separate and freely given. It can't be a condition of service messages.
- **Inbox delivery.** People who didn't knowingly sign up mark mail as spam, and that damages the sending domain for everyone.
- **The product.** A small list of fans who want her letters is worth more than a large list that doesn't open them.

**Suggested label at the letter** (versioned wording, for counsel):

> **Get Maya's private letters.** Behind the scenes, what she's into lately, and first word on new sets. Unsubscribe anytime.

## 3. What an issue contains

- **The mix:** behind-the-scenes moments, what she's into lately, small personal details, first word on new sets or open custom slots. Most issues are pure connection. The owner sets how often an issue may include an offer (§9, question 2).
- **Every issue ends with** her schedule and her links.
- **Discretion** (already promised in doc 11 §5.8, so these are rules):
  - a discreet sender name;
  - **nothing explicit in the subject, the preview text or the body;**
  - explicit content stays behind a link to the signed-in, age-gated site;
  - an easy, one-click unsubscribe.
- **Never:** private contact details, meeting in person, anything on the platform hard list (doc 11 §5.3.2), or the creator's hard-no limits.

## 4. Who writes it

- The creator writes it, or **the AI drafts it in her voice** from her notes, using the same models and checks as the after-shoot letter (doc 12 §8). Text is checked against the hard list, and fan text never goes into the prompt.
- **Nothing is sent without the creator's approval** of that issue.
- **AI disclosure:** the question counsel answers for letters (doc 12 §8.3) applies here too. Until counsel decides, an AI-drafted issue carries the same disclosure line.

## 5. Sending

- **Provider:** many mainstream email services forbid sexual content, even linked. Before choosing one, confirm in writing that the provider allows a newsletter for an adult creator platform (non-explicit email, explicit content behind a link). This is research to do, not an assumption.
- **Sender domain:** send from a subdomain (for example `news.studiolens.me`), never from the apex. The apex carries the owner's IONOS business mail, and its reputation must not be put at risk. Set up SPF, DKIM and DMARC for the subdomain.
- **Unsubscribe:** one-click `List-Unsubscribe` headers (RFC 8058) plus a link in the footer, both using the existing signed, per fan and creator token (doc 11 §5.8). Each email is generated with `issueUnsubscribeToken()`.
- **Legal footer:** a physical postal address (US CAN-SPAM) and why the fan is getting the email.
- **Frequency:** a cap per creator (proposed: at most one issue a week).
- **Bounces and complaints:** a hard bounce or a spam complaint stops sending to that address, recorded like an unsubscribe.

## 6. Privacy

- **Creators don't see fans' email addresses** (proposed; §9, question 4). The platform holds the list and sends. Creators see counts, and opens and clicks only if the owner allows tracking (§9, question 5).
- Unsubscribing never deletes the consent history, which proves what was agreed (doc 11 §5.8).

## 7. Creator platform terms

Some fan platforms restrict moving fans' business off-platform. Issues link back to the creator's own page rather than selling off-platform, and each creator confirms that her platform's terms allow a newsletter before turning it on.

## 8. When to build it

After doc 14's in-app letter delivery, which gives the `letter` entry point and the delivery service email to build on. It gets its own gate and report (doc 11 §9 format). Required before launch: written confirmation from the chosen provider (§5) and counsel's review (§9, questions 6–7).

## 9. Open decisions (owner)

| # | Decision | Needed by |
| --- | --- | --- |
| 1 | Approve the separate opt-in beside the letter and its label (§2) | Before design |
| 2 | How often an issue may include an offer (proposed: no more than one in three) | Before build |
| 3 | Frequency cap per creator (proposed: one a week) | Before build |
| 4 | Whether creators may ever export fans' email addresses (proposed: no) | Before build |
| 5 | Open and click tracking (proposed: clicks only; no tracking pixels) | Before build |
| 6 | Counsel: the opt-in wording, AI-drafted issues, and the footer | Before launch |
| 7 | Written confirmation from the email provider | Before choosing it |
