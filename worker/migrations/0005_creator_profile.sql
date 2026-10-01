-- The creator's lookbook (shared/domain/creatorProfile.ts): brand, voice, their
-- own limits, and named categories of images. It is never priced, so it lives
-- beside the versioned catalog rather than in it, and the creator edits it
-- directly. Only that creator can read or write it (worker/src/creatorProfile.ts).

-- One row per creator. `revision` guards against two tabs saving over each other.
CREATE TABLE creator_profile (
  creator_id   TEXT PRIMARY KEY REFERENCES creator (id),
  revision     INTEGER NOT NULL CHECK (revision >= 1),
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  updated_at   TEXT NOT NULL
);

-- Images the creator uploaded. The bytes live in R2 (the MEDIA binding) under
-- creators/<creator_id>/<id>; this row is what proves who owns them.
CREATE TABLE creator_media (
  id           TEXT PRIMARY KEY,
  creator_id   TEXT NOT NULL REFERENCES creator (id),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/webp', 'image/jpeg', 'image/png')),
  byte_size    INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 1048576),
  created_at   TEXT NOT NULL
);
CREATE INDEX creator_media_creator_idx ON creator_media (creator_id, created_at);
