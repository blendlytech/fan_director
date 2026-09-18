-- Phase 2: catalog, boundaries and server-side quotes (doc 11 §8 Phase 2).
-- Backward compatible: every change adds a column or a table.

-- The per-creator adult switch (doc 11 §5.4). It only counts when the platform
-- switch is on and the compliance record is complete. Nothing sets it.
ALTER TABLE creator ADD COLUMN adult_content_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (adult_content_enabled IN (0, 1));

-- Server-computed boundary flags, recomputed on every save (doc 11 §6).
ALTER TABLE draft ADD COLUMN boundary_flags_json TEXT
  CHECK (boundary_flags_json IS NULL OR json_valid(boundary_flags_json));

-- Set when a fan reaches the hard-list block threshold (3 in 24 hours, doc 11
-- §5.6 item 22) or has a minors hit: AI is off for them and they are flagged for
-- platform review. Phase 3's AI Director reads ai_disabled_at.
CREATE TABLE fan_restriction (
  fan_id            TEXT PRIMARY KEY REFERENCES fan (id),
  ai_disabled_at    TEXT,
  review_flagged_at TEXT,
  reason            TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX fan_restriction_review_idx ON fan_restriction (review_flagged_at);

-- The full request behind a suspected child-exploitation case (doc 11 §5.3.3):
-- the one exception to keeping only the blocked subject. No route reads this
-- table. Nothing is deleted while a case is open, so it is append-only.
CREATE TABLE safety_case_evidence (
  id           TEXT PRIMARY KEY,
  case_id      TEXT NOT NULL REFERENCES safety_case (id),
  fan_id       TEXT NOT NULL REFERENCES fan (id),
  request_json TEXT NOT NULL CHECK (json_valid(request_json)),
  ip           TEXT,
  user_agent   TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX safety_case_evidence_case_idx ON safety_case_evidence (case_id);
CREATE TRIGGER safety_case_evidence_no_update BEFORE UPDATE ON safety_case_evidence
BEGIN SELECT RAISE(ABORT, 'safety case evidence is append-only'); END;
CREATE TRIGGER safety_case_evidence_no_delete BEFORE DELETE ON safety_case_evidence
BEGIN SELECT RAISE(ABORT, 'safety case evidence is append-only'); END;

-- Counting a fan's hard-list blocks in the last 24 hours.
CREATE INDEX audit_event_actor_action_idx ON audit_event (actor_kind, actor_id, action, created_at);
