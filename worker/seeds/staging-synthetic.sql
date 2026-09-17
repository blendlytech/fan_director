-- Two synthetic test creators for the Gate 1 staging checklist, each with one
-- published catalog version. Not a real catalog: the pilot catalog is seeded
-- in Phase 2 (doc 11 §8). No adult items, no real people.
--
-- Before applying, replace REPLACE_CREATOR_A and REPLACE_CREATOR_B with the
-- Clerk user ids (user_...) of the two test creator accounts, then run:
--   npx wrangler d1 execute DB --env staging --remote --file seeds/staging-synthetic.sql
-- Apply once: the ids are fixed, so a second run fails on the primary keys.

INSERT INTO creator (id, clerk_user_id, display_name, status, invited_at, created_at) VALUES
  ('cr_staging_a', 'REPLACE_CREATOR_A', 'Test Creator A', 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('cr_staging_b', 'REPLACE_CREATOR_B', 'Test Creator B', 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT INTO catalog (id, creator_id) VALUES
  ('cat_staging_a', 'cr_staging_a'),
  ('cat_staging_b', 'cr_staging_b');

-- Item shape as read by src/drafts.ts: hidden and contentRating must be set
-- explicitly; per_unit items carry minQty and maxQty.
INSERT INTO catalog_version (id, catalog_id, version, status, content_json, created_at, published_at) VALUES
  ('cv_staging_a1', 'cat_staging_a', 1, 'published', '{"categories":[
    {"key":"length_format","contentRating":"general","hidden":false,"items":[
      {"id":"a_minutes","label":"Video length","contentRating":"general","hidden":false,"pricing":{"kind":"per_unit","unitLabel":"minute","amountPerUnit":1500,"minQty":3,"maxQty":20}}
    ]},
    {"key":"setting","contentRating":"general","hidden":false,"items":[
      {"id":"a_set_studio","label":"Studio set","contentRating":"general","hidden":false,"pricing":{"kind":"included"}},
      {"id":"a_set_hidden","label":"Hidden set (must be rejected)","contentRating":"general","hidden":true,"pricing":{"kind":"fixed","amount":2500}}
    ]}
  ]}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('cv_staging_b1', 'cat_staging_b', 1, 'published', '{"categories":[
    {"key":"length_format","contentRating":"general","hidden":false,"items":[
      {"id":"b_minutes","label":"Video length","contentRating":"general","hidden":false,"pricing":{"kind":"per_unit","unitLabel":"minute","amountPerUnit":2000,"minQty":3,"maxQty":15}}
    ]},
    {"key":"setting","contentRating":"general","hidden":false,"items":[
      {"id":"b_set_home","label":"Home set","contentRating":"general","hidden":false,"pricing":{"kind":"fixed","amount":3000}}
    ]}
  ]}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

UPDATE catalog SET current_published_version_id = 'cv_staging_a1' WHERE id = 'cat_staging_a';
UPDATE catalog SET current_published_version_id = 'cv_staging_b1' WHERE id = 'cat_staging_b';
