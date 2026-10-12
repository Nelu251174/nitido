/** Additive leaf schema. Intake only: no account/data deletion executor. */
export const ACCOUNT_DELETION_SCHEMA = `
CREATE TABLE IF NOT EXISTS account_deletion_requests (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS account_deletion_events (
 request_id TEXT NOT NULL REFERENCES account_deletion_requests(id), revision INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('requested','under_review')),
 actor_id TEXT NOT NULL, actor_type TEXT NOT NULL CHECK(actor_type IN ('user','admin')),
 reason TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(request_id,revision)
);
CREATE TRIGGER IF NOT EXISTS account_deletion_requests_no_update BEFORE UPDATE ON account_deletion_requests BEGIN SELECT RAISE(ABORT,'Deletion intake is immutable'); END;
CREATE TRIGGER IF NOT EXISTS account_deletion_requests_no_delete BEFORE DELETE ON account_deletion_requests BEGIN SELECT RAISE(ABORT,'Deletion intake is immutable'); END;
CREATE TRIGGER IF NOT EXISTS account_deletion_events_no_update BEFORE UPDATE ON account_deletion_events BEGIN SELECT RAISE(ABORT,'Deletion event is immutable'); END;
CREATE TRIGGER IF NOT EXISTS account_deletion_events_no_delete BEFORE DELETE ON account_deletion_events BEGIN SELECT RAISE(ABORT,'Deletion event is immutable'); END;
`;
