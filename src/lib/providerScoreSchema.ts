// Schema is independent of the runtime report and authentication modules.
export const PROVIDER_SCORE_SCHEMA = `
CREATE TABLE IF NOT EXISTS provider_score_policies (
 revision INTEGER PRIMARY KEY CHECK(revision>0),
 definition_json TEXT NOT NULL,
 reason TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS provider_score_policy_no_update BEFORE UPDATE ON provider_score_policies BEGIN SELECT RAISE(ABORT,'Score policy immutable'); END;
CREATE TRIGGER IF NOT EXISTS provider_score_policy_no_delete BEFORE DELETE ON provider_score_policies BEGIN SELECT RAISE(ABORT,'Score policy retained'); END;
`;
