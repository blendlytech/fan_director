-- Phase 3: the AI Director (doc 11 §8 Phase 3).
-- Backward compatible: every change adds a column, an index or a table.

-- The per-creator AI kill switch. AI runs only when the environment's
-- AI_ENABLED is "true" AND this is 1. Only a seed or the owner sets it.
ALTER TABLE creator ADD COLUMN ai_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (ai_enabled IN (0, 1));

-- One row per Director turn. Holds versions, outcome and counts, never the
-- fan's wording (that lives in ai_turn_content and is purged).
ALTER TABLE ai_request ADD COLUMN client_request_id TEXT;
ALTER TABLE ai_request ADD COLUMN draft_revision INTEGER;
ALTER TABLE ai_request ADD COLUMN prompt_version TEXT;
ALTER TABLE ai_request ADD COLUMN classifier_version TEXT;
ALTER TABLE ai_request ADD COLUMN ruleset_version TEXT;
ALTER TABLE ai_request ADD COLUMN copy_version TEXT;
ALTER TABLE ai_request ADD COLUMN fallback_used INTEGER NOT NULL DEFAULT 0 CHECK (fallback_used IN (0, 1));
ALTER TABLE ai_request ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
-- A short code, e.g. 'suggestions', 'input_blocked', 'classifier_unavailable'.
ALTER TABLE ai_request ADD COLUMN outcome TEXT;
-- 1 when the fan got a reply: only these count toward the 20 per draft
-- (design 17 D: a failed reply doesn't use one up).
ALTER TABLE ai_request ADD COLUMN counts_toward_limit INTEGER NOT NULL DEFAULT 0 CHECK (counts_toward_limit IN (0, 1));
-- Drop reasons and check results. Never fan wording or model text.
ALTER TABLE ai_request ADD COLUMN detail_json TEXT CHECK (detail_json IS NULL OR json_valid(detail_json));
ALTER TABLE ai_request ADD COLUMN finished_at TEXT;

-- A retried send with the same id is the same turn.
CREATE UNIQUE INDEX ai_request_client_idx ON ai_request (fan_id, client_request_id);
-- One request in flight per draft, enforced by the database.
CREATE UNIQUE INDEX ai_request_inflight_idx ON ai_request (draft_id) WHERE status = 'pending';
CREATE INDEX ai_request_draft_idx ON ai_request (draft_id, counts_toward_limit);

-- One row per paid provider call: the cost ledger's detail.
CREATE TABLE ai_call (
  id                TEXT PRIMARY KEY,
  ai_request_id     TEXT REFERENCES ai_request (id),
  creator_id        TEXT NOT NULL REFERENCES creator (id),
  purpose           TEXT NOT NULL CHECK (purpose IN ('classify_input', 'director', 'classify_output')),
  model             TEXT NOT NULL,
  upstream          TEXT,
  attempt           INTEGER NOT NULL DEFAULT 1,
  reserved_microusd INTEGER NOT NULL CHECK (reserved_microusd >= 0),
  actual_microusd   INTEGER CHECK (actual_microusd IS NULL OR actual_microusd >= 0),
  -- reserved: in flight. reconciled: actual cost booked. held: unclear
  -- outcome (e.g. a timeout), so the whole reservation stays spent.
  cost_state        TEXT NOT NULL CHECK (cost_state IN ('reserved', 'reconciled', 'held')),
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  latency_ms        INTEGER,
  error_kind        TEXT,
  created_at        TEXT NOT NULL,
  finished_at       TEXT
);
CREATE INDEX ai_call_request_idx ON ai_call (ai_request_id);
CREATE INDEX ai_call_creator_idx ON ai_call (creator_id, created_at);

-- Running totals per scope ('global', 'creator:<id>'). A call is reserved by
-- one conditional UPDATE across both scopes, so concurrent calls can't spend
-- the same remaining budget. Ceilings are configuration, not stored.
CREATE TABLE ai_budget (
  scope             TEXT PRIMARY KEY,
  reserved_microusd INTEGER NOT NULL DEFAULT 0 CHECK (reserved_microusd >= 0),
  spent_microusd    INTEGER NOT NULL DEFAULT 0 CHECK (spent_microusd >= 0),
  updated_at        TEXT NOT NULL
);

-- The raw conversation: the fan's message, the model's output and what was
-- served. Kept apart so a daily job can delete it after the retention period
-- (30 days, doc 11 §5.6 item 24). Safety-case evidence is copied elsewhere.
CREATE TABLE ai_turn_content (
  ai_request_id     TEXT PRIMARY KEY REFERENCES ai_request (id),
  fan_message       TEXT NOT NULL,
  model_output_json TEXT,
  response_json     TEXT CHECK (response_json IS NULL OR json_valid(response_json)),
  created_at        TEXT NOT NULL,
  expires_at        TEXT NOT NULL
);
CREATE INDEX ai_turn_content_expiry_idx ON ai_turn_content (expires_at);

-- Options the server built and showed. Accepting one re-validates it against
-- the draft's current revision; the fan can't send selections of their own.
CREATE TABLE ai_suggestion (
  id              TEXT PRIMARY KEY,
  ai_request_id   TEXT NOT NULL REFERENCES ai_request (id),
  draft_id        TEXT NOT NULL REFERENCES draft (id),
  fan_id          TEXT NOT NULL REFERENCES fan (id),
  base_revision   INTEGER NOT NULL,
  selections_json TEXT NOT NULL CHECK (json_valid(selections_json)),
  flags_json      TEXT NOT NULL CHECK (json_valid(flags_json)),
  status          TEXT NOT NULL DEFAULT 'offered'
                  CHECK (status IN ('offered', 'accepted', 'declined', 'out_of_date')),
  created_at      TEXT NOT NULL,
  decided_at      TEXT
);
CREATE INDEX ai_suggestion_draft_idx ON ai_suggestion (draft_id, created_at);
