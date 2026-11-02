export const INTERNATIONAL_JOB_SCHEMA=`
CREATE TABLE IF NOT EXISTS international_job_contexts(
 job_id TEXT PRIMARY KEY REFERENCES jobs(id),quote_id TEXT NOT NULL UNIQUE,
 country_code TEXT NOT NULL,currency TEXT NOT NULL CHECK(currency='EUR'),
 time_zone TEXT NOT NULL,workers INTEGER NOT NULL CHECK(workers>0),
 gross_minor INTEGER NOT NULL CHECK(gross_minor>0),created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS international_job_context_immutable BEFORE UPDATE ON international_job_contexts
 BEGIN SELECT RAISE(ABORT,'International job contract is immutable');END;
CREATE TRIGGER IF NOT EXISTS international_job_context_retained BEFORE DELETE ON international_job_contexts
 BEGIN SELECT RAISE(ABORT,'International job contract is retained');END;
`;
