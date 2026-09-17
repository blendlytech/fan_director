-- Phase 1 foundation (doc 11 §8 Phase 1, §5.8, §6).
-- Times are ISO 8601 UTC strings. JSON columns hold doc 11 §6 shapes.
-- Nothing here enables AI, adult content, email sending or real performers.
-- D1 enforces foreign keys by default.

-- Creators exist only by invitation. clerk_user_id is set by the owner when the
-- invited creator's Clerk account exists; until then the row cannot sign in.
CREATE TABLE creator (
  id            TEXT PRIMARY KEY,
  clerk_user_id TEXT UNIQUE,
  display_name  TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  status        TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended')),
  invited_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX creator_status_idx ON creator (status);

-- Our own fan id, mapped from the Clerk user id, so consent history survives a
-- future auth change (doc 11 §5.6 item 17).
CREATE TABLE fan (
  id            TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at    TEXT NOT NULL
);
CREATE INDEX fan_status_idx ON fan (status);

CREATE TABLE catalog (
  id                           TEXT PRIMARY KEY,
  creator_id                   TEXT NOT NULL UNIQUE REFERENCES creator (id),
  current_published_version_id TEXT
);

CREATE TABLE catalog_version (
  id           TEXT PRIMARY KEY,
  catalog_id   TEXT NOT NULL REFERENCES catalog (id),
  version      INTEGER NOT NULL CHECK (version >= 1),
  status       TEXT NOT NULL CHECK (status IN ('draft', 'published', 'retired')),
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  created_at   TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (catalog_id, version)
);
CREATE INDEX catalog_version_status_idx ON catalog_version (catalog_id, status);

-- A published or retired version's content never changes (doc 11 §6).
CREATE TRIGGER catalog_version_content_immutable
BEFORE UPDATE OF content_json, catalog_id, version ON catalog_version
WHEN OLD.status IN ('published', 'retired')
BEGIN
  SELECT RAISE(ABORT, 'published catalog content is immutable');
END;
CREATE TRIGGER catalog_version_no_unpublish
BEFORE UPDATE OF status ON catalog_version
WHEN OLD.status = 'retired' OR (OLD.status = 'published' AND NEW.status = 'draft')
BEGIN
  SELECT RAISE(ABORT, 'catalog version status can only move forward');
END;
CREATE TRIGGER catalog_version_no_delete
BEFORE DELETE ON catalog_version
WHEN OLD.status IN ('published', 'retired')
BEGIN
  SELECT RAISE(ABORT, 'published catalog versions cannot be deleted');
END;

-- Opaque browse session for signed-out visitors. Only a hash of the cookie is
-- stored, and it never authenticates anything.
CREATE TABLE fan_session (
  id         TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX fan_session_expires_idx ON fan_session (expires_at);

-- DraftV2 (doc 11 §6), owned by one fan inside one creator's boutique.
CREATE TABLE draft (
  id                 TEXT PRIMARY KEY,
  fan_id             TEXT NOT NULL REFERENCES fan (id),
  creator_id         TEXT NOT NULL REFERENCES creator (id),
  catalog_version_id TEXT NOT NULL REFERENCES catalog_version (id),
  revision           INTEGER NOT NULL CHECK (revision >= 1),
  content_json       TEXT NOT NULL CHECK (json_valid(content_json)),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX draft_owner_idx ON draft (fan_id, creator_id, updated_at);
CREATE INDEX draft_creator_idx ON draft (creator_id, updated_at);

-- Schema only in Phase 1: no provider adapter exists and AI is switched off.
CREATE TABLE ai_request (
  id         TEXT PRIMARY KEY,
  fan_id     TEXT NOT NULL REFERENCES fan (id),
  creator_id TEXT NOT NULL REFERENCES creator (id),
  draft_id   TEXT REFERENCES draft (id),
  status     TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'rejected')),
  provider   TEXT,
  model      TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX ai_request_owner_idx ON ai_request (fan_id, creator_id, created_at);
CREATE INDEX ai_request_status_idx ON ai_request (status, created_at);

CREATE TABLE audit_event (
  id           TEXT PRIMARY KEY,
  actor_kind   TEXT NOT NULL CHECK (actor_kind IN ('fan', 'creator', 'owner', 'system', 'anonymous')),
  actor_id     TEXT,
  action       TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id   TEXT,
  creator_id   TEXT REFERENCES creator (id),
  detail_json  TEXT CHECK (detail_json IS NULL OR json_valid(detail_json)),
  created_at   TEXT NOT NULL
);
CREATE INDEX audit_event_creator_idx ON audit_event (creator_id, created_at);
CREATE INDEX audit_event_subject_idx ON audit_event (subject_kind, subject_id, created_at);
CREATE TRIGGER audit_event_no_update BEFORE UPDATE ON audit_event
BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
CREATE TRIGGER audit_event_no_delete BEFORE DELETE ON audit_event
BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;

-- Every compliance flag defaults to false; nothing in Phases 0–3 sets them.
CREATE TABLE compliance_status (
  creator_id             TEXT PRIMARY KEY REFERENCES creator (id),
  identity_verified      INTEGER NOT NULL DEFAULT 0 CHECK (identity_verified IN (0, 1)),
  age_verified           INTEGER NOT NULL DEFAULT 0 CHECK (age_verified IN (0, 1)),
  records_complete       INTEGER NOT NULL DEFAULT 0 CHECK (records_complete IN (0, 1)),
  payouts_enabled        INTEGER NOT NULL DEFAULT 0 CHECK (payouts_enabled IN (0, 1)),
  adult_catalog_approved INTEGER NOT NULL DEFAULT 0 CHECK (adult_catalog_approved IN (0, 1)),
  updated_at             TEXT NOT NULL
);

-- Phases 0–3 allow synthetic performers only (doc 11 §5.6 item 9).
CREATE TABLE performer (
  id                TEXT PRIMARY KEY,
  creator_id        TEXT NOT NULL REFERENCES creator (id),
  kind              TEXT NOT NULL CHECK (kind IN ('creator', 'partner')),
  display_name      TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  age_verified      INTEGER NOT NULL DEFAULT 0 CHECK (age_verified IN (0, 1)),
  consent_record_id TEXT,
  is_synthetic      INTEGER NOT NULL DEFAULT 1 CHECK (is_synthetic = 1),
  created_at        TEXT NOT NULL
);
CREATE INDEX performer_creator_idx ON performer (creator_id);

-- Schema only: evidence lives in a restricted store that does not exist yet.
CREATE TABLE safety_case (
  id           TEXT PRIMARY KEY,
  creator_id   TEXT NOT NULL REFERENCES creator (id),
  fan_id       TEXT REFERENCES fan (id),
  category     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'closed')),
  evidence_ref TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX safety_case_status_idx ON safety_case (status, created_at);
CREATE INDEX safety_case_creator_idx ON safety_case (creator_id, created_at);

-- The exact label and helper text a fan saw, by version (doc 11 §5.8).
-- Inserted administratively once the owner approves the wording.
CREATE TABLE consent_wording (
  version    TEXT PRIMARY KEY CHECK (length(version) BETWEEN 1 AND 40),
  label      TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
  helper     TEXT NOT NULL CHECK (length(helper) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL
);
CREATE TRIGGER consent_wording_no_update BEFORE UPDATE ON consent_wording
BEGIN SELECT RAISE(ABORT, 'consent wording is immutable'); END;
CREATE TRIGGER consent_wording_no_delete BEFORE DELETE ON consent_wording
BEGIN SELECT RAISE(ABORT, 'consent wording is immutable'); END;

-- Append-only consent history. The latest row (highest seq) per fan + creator
-- is current. Nothing is ever updated or deleted.
CREATE TABLE marketing_consent (
  seq             INTEGER PRIMARY KEY AUTOINCREMENT,
  id              TEXT NOT NULL UNIQUE,
  fan_id          TEXT NOT NULL REFERENCES fan (id),
  creator_id      TEXT NOT NULL REFERENCES creator (id),
  email           TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 320),
  status          TEXT NOT NULL CHECK (status IN ('subscribed', 'unsubscribed')),
  wording_version TEXT NOT NULL REFERENCES consent_wording (version),
  source          TEXT NOT NULL CHECK (source IN ('signup', 'settings', 'unsubscribe_page')),
  ip              TEXT NOT NULL,
  user_agent      TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
CREATE INDEX marketing_consent_current_idx ON marketing_consent (fan_id, creator_id, seq);
CREATE INDEX marketing_consent_creator_idx ON marketing_consent (creator_id, status, created_at);
CREATE TRIGGER marketing_consent_no_update BEFORE UPDATE ON marketing_consent
BEGIN SELECT RAISE(ABORT, 'consent history is append-only'); END;
CREATE TRIGGER marketing_consent_no_delete BEFORE DELETE ON marketing_consent
BEGIN SELECT RAISE(ABORT, 'consent history is append-only'); END;

-- The one-time step after sign-up happens at most once per fan (design 23 A6).
-- A skip is recorded here only; it writes no consent row (doc 11 §5.8).
CREATE TABLE consent_onboarding (
  fan_id       TEXT PRIMARY KEY REFERENCES fan (id),
  creator_id   TEXT NOT NULL REFERENCES creator (id),
  outcome      TEXT NOT NULL CHECK (outcome IN ('subscribed', 'skipped')),
  completed_at TEXT NOT NULL
);
CREATE TRIGGER consent_onboarding_no_update BEFORE UPDATE ON consent_onboarding
BEGIN SELECT RAISE(ABORT, 'onboarding answers are final'); END;
