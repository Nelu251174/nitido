import type {Database} from 'better-sqlite3';
import {validReportMonth} from './executionCsv';
export const REPORT_ARCHIVE_SCHEMA=`
CREATE TABLE IF NOT EXISTS client_report_archive(
 id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),organization_id TEXT,
 name TEXT NOT NULL,created_at TEXT NOT NULL,report_json TEXT NOT NULL,request_key TEXT NOT NULL,request_fingerprint TEXT NOT NULL,
 UNIQUE(owner_id,request_key)
);
CREATE INDEX IF NOT EXISTS client_reports_owner_date ON client_report_archive(owner_id,created_at DESC,id);
CREATE TRIGGER IF NOT EXISTS client_reports_no_update BEFORE UPDATE ON client_report_archive BEGIN SELECT RAISE(ABORT,'REPORT_IMMUTABLE'); END;
`;
export class ReportError extends Error{constructor(message:string,public status=400){super(message)}}
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function reportFilters(db:Database,userId:string,p:URLSearchParams){
 const month=p.get('month'),from=p.get('from'),to=p.get('to'),scope=p.get('scope')??'all',propertyId=p.get('propertyId'),organizationId=p.get('organizationId');
 if(month!==null&&!validReportMonth(month))throw new ReportError('Luna trebuie să fie YYYY-MM.');
 if((from!==null||to!==null)&&(!from||!to||!validDate(from)||!validDate(to)||from>to||Date.parse(to)-Date.parse(from)>366*86400000||month!==null))throw new ReportError('Alege un interval valid, de maximum 367 de zile, fără filtrul lunar.');
 if(!['all','business','host'].includes(scope))throw new ReportError('Portofoliu invalid.');
 for(const id of [propertyId,organizationId])if(id!==null&&(!id||id.length>100))throw new ReportError('Identificator invalid.');
 if(propertyId&&!db.prepare('SELECT 1 FROM workspace_properties WHERE id=? AND owner_id=?').get(propertyId,userId))throw new ReportError('Locație inexistentă.',404);
 if(organizationId&&!db.prepare('SELECT 1 FROM workspace_organizations WHERE id=? AND owner_id=?').get(organizationId,userId))throw new ReportError('Organizație inexistentă.',404);
 if(propertyId&&organizationId&&!db.prepare('SELECT 1 FROM workspace_organization_properties WHERE property_id=? AND organization_id=?').get(propertyId,organizationId))throw new ReportError('Locația nu aparține organizației.');
 return {month,scope:scope as 'all'|'business'|'host',propertyId,organizationId,from,to};
}
