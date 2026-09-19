-- Phase 4: submission and creator review (doc 10 §5 and §7, doc 11 §5.6 item 26).
--
-- A fan sends a draft; it becomes a commission with immutable versions of its
-- terms. The creator asks, proposes changes, approves the exact version the
-- fan accepted, or declines. Payment is never a status: the creator may report
-- it after approval, and it is always shown as creator-reported.

-- Sending locks the draft for good. One commission per draft.
ALTER TABLE draft ADD COLUMN submitted_at TEXT;

CREATE TRIGGER draft_submitted_locked
BEFORE UPDATE OF content_json, revision, catalog_version_id, boundary_flags_json ON draft
WHEN OLD.submitted_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'a sent draft cannot change');
END;
CREATE TRIGGER draft_submitted_permanent
BEFORE UPDATE OF submitted_at ON draft
WHEN OLD.submitted_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'a sent draft stays sent');
END;

CREATE TABLE commission (
  id                  TEXT PRIMARY KEY,
  fan_id              TEXT NOT NULL REFERENCES fan (id),
  creator_id          TEXT NOT NULL REFERENCES creator (id),
  draft_id            TEXT NOT NULL UNIQUE REFERENCES draft (id),
  client_request_id   TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN
                        ('in_review', 'question_open', 'proposal_open', 'approved', 'declined', 'withdrawn', 'withheld')),
  -- The version the fan and creator are working from. It changes only when a
  -- proposal is offered or answered, never after a final status.
  current_version_id  TEXT NOT NULL,
  approved_version_id TEXT,
  approved_hash       TEXT,
  approved_at         TEXT,
  decided_at          TEXT,
  -- Creator-reported, after approval only. Never a fan payment confirmation.
  payment_reported_at TEXT,
  payment_reported_by TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  UNIQUE (fan_id, client_request_id),
  CHECK ((status = 'approved') = (approved_version_id IS NOT NULL)),
  CHECK (payment_reported_at IS NULL OR status = 'approved')
);
CREATE INDEX commission_fan_idx ON commission (fan_id, updated_at);
CREATE INDEX commission_creator_idx ON commission (creator_id, status, updated_at);

-- Final statuses never change, and an approval can't be moved to another version.
CREATE TRIGGER commission_final
BEFORE UPDATE OF status, current_version_id, approved_version_id, approved_hash ON commission
WHEN OLD.status IN ('approved', 'declined', 'withdrawn', 'withheld')
BEGIN
  SELECT RAISE(ABORT, 'a decided commission cannot change');
END;
CREATE TRIGGER commission_no_delete BEFORE DELETE ON commission
BEGIN SELECT RAISE(ABORT, 'commissions are kept'); END;

CREATE TABLE commission_version (
  id                         TEXT PRIMARY KEY,
  commission_id              TEXT NOT NULL REFERENCES commission (id),
  seq                        INTEGER NOT NULL CHECK (seq >= 1),
  author                     TEXT NOT NULL CHECK (author IN ('fan', 'creator')),
  catalog_version_id         TEXT NOT NULL REFERENCES catalog_version (id),
  -- CommissionTerms (shared/domain/commission.ts) plus the notes and the quote lines.
  terms_json                 TEXT NOT NULL CHECK (json_valid(terms_json)),
  quote_json                 TEXT NOT NULL CHECK (json_valid(quote_json)),
  boundary_flags_json        TEXT NOT NULL CHECK (json_valid(boundary_flags_json)),
  custom_request_price_cents INTEGER CHECK (custom_request_price_cents IS NULL OR custom_request_price_cents >= 0),
  content_hash               TEXT NOT NULL,
  status                     TEXT NOT NULL CHECK (status IN ('offered', 'accepted', 'rejected', 'superseded')),
  fan_accepted_at            TEXT,
  created_at                 TEXT NOT NULL,
  UNIQUE (commission_id, seq)
);

-- The terms of a version never change; its status only moves forward.
CREATE TRIGGER commission_version_terms_immutable
BEFORE UPDATE OF commission_id, seq, author, catalog_version_id, terms_json, quote_json,
                 boundary_flags_json, custom_request_price_cents, content_hash, created_at ON commission_version
BEGIN
  SELECT RAISE(ABORT, 'commission versions are immutable');
END;
CREATE TRIGGER commission_version_status_forward
BEFORE UPDATE OF status ON commission_version
WHEN NOT (
  (OLD.status = 'offered' AND NEW.status IN ('accepted', 'rejected', 'superseded'))
  OR (OLD.status = 'accepted' AND NEW.status = 'superseded')
)
BEGIN
  SELECT RAISE(ABORT, 'commission version status can only move forward');
END;
CREATE TRIGGER commission_version_no_delete BEFORE DELETE ON commission_version
BEGIN SELECT RAISE(ABORT, 'commission versions are kept'); END;

-- Questions, answers, proposal notes and decline reasons. Append-only.
CREATE TABLE commission_message (
  id            TEXT PRIMARY KEY,
  commission_id TEXT NOT NULL REFERENCES commission (id),
  author_kind   TEXT NOT NULL CHECK (author_kind IN ('fan', 'creator')),
  kind          TEXT NOT NULL CHECK (kind IN ('question', 'answer', 'proposal_note', 'decline_reason')),
  body          TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  version_id    TEXT REFERENCES commission_version (id),
  created_at    TEXT NOT NULL
);
CREATE INDEX commission_message_idx ON commission_message (commission_id, created_at);
CREATE TRIGGER commission_message_no_update BEFORE UPDATE ON commission_message
BEGIN SELECT RAISE(ABORT, 'messages are append-only'); END;
CREATE TRIGGER commission_message_no_delete BEFORE DELETE ON commission_message
BEGIN SELECT RAISE(ABORT, 'messages are append-only'); END;
