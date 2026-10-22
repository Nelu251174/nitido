/** Proposals and evaluation consent only; no payment or booking mutation. */
export const EXTRA_WORK_SCHEMA=`
CREATE TABLE IF NOT EXISTS extra_work_requests(
 id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id),firm_id TEXT NOT NULL REFERENCES firms(id),
 client_id TEXT NOT NULL REFERENCES users(id),created_by TEXT NOT NULL REFERENCES users(id),
 request_key TEXT NOT NULL,terms_json TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','approved','rejected','withdrawn')),
 revision INTEGER NOT NULL DEFAULT 1,assessment_id TEXT UNIQUE REFERENCES service_assessments(id),resolved_at TEXT,
 UNIQUE(created_by,request_key)
);
CREATE INDEX IF NOT EXISTS extra_work_requests_job ON extra_work_requests(job_id,created_at);
CREATE TRIGGER IF NOT EXISTS extra_work_terms_frozen BEFORE UPDATE ON extra_work_requests
 WHEN NEW.id IS NOT OLD.id OR NEW.job_id IS NOT OLD.job_id OR NEW.firm_id IS NOT OLD.firm_id
 OR NEW.client_id IS NOT OLD.client_id OR NEW.created_by IS NOT OLD.created_by OR NEW.request_key IS NOT OLD.request_key
 OR NEW.terms_json IS NOT OLD.terms_json OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at
 OR OLD.status!='proposed' OR NEW.status NOT IN ('approved','rejected','withdrawn') OR NEW.revision!=OLD.revision+1
 OR (NEW.status='approved' AND NEW.assessment_id IS NULL) OR (NEW.status!='approved' AND NEW.assessment_id IS NOT NULL)
 BEGIN SELECT RAISE(ABORT,'Extra work proposal is immutable'); END;
CREATE TRIGGER IF NOT EXISTS extra_work_no_delete BEFORE DELETE ON extra_work_requests
 BEGIN SELECT RAISE(ABORT,'Extra work history retained'); END;
`;
