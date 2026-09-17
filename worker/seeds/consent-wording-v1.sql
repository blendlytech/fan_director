-- News consent wording v1: design 23, approved as drawn by the owner on 2026-09-17
-- (doc 11 §5.6 item 20). The label and helper together are the versioned wording.
-- {creator} is replaced with the creator's display name by the UI; the stored text
-- is global, not per creator (worker/src/consent.ts).
--
-- Apply: npx wrangler d1 execute DB --env staging --remote --file seeds/consent-wording-v1.sql
-- Never edit this row once applied; new wording is a new version.

INSERT INTO consent_wording (version, label, helper, created_at) VALUES (
  'news-v1',
  'Email me {creator}’s news',
  'Live show times, new videos and when custom videos open. Discreet sender name, nothing explicit in your inbox. Unsubscribe anytime.',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
