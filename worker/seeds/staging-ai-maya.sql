-- Phase 3: switch the AI Director on for the fictional pilot creator Maya in
-- staging only (doc 11 §8 Phase 3, per-creator kill switch). It also needs
-- AI_ENABLED="true", a ceiling and OPENROUTER_API_KEY on the staging Worker.
-- Apply only with the owner's OK:
--   npx wrangler d1 execute fan-director-staging --env staging --remote --file seeds/staging-ai-maya.sql
-- Undo: UPDATE creator SET ai_enabled = 0 WHERE id = 'cr_maya';
UPDATE creator SET ai_enabled = 1 WHERE id = 'cr_maya';
