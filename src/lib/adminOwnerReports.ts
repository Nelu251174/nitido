import type {Database} from 'better-sqlite3';
import {enqueueOwnerEvent} from './adminOwnerEvents';
export type StoreReport={source:'apple'|'google';reportDate:string;status:'ready'|'pending'|'blocked';metric:'app_units'|'device_installs'|'install_events';countries:{country:string;installs:number;redownloads?:number}[];reason?:string};
export function validReportDate(value:unknown):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function validateStoreReport(value:unknown,now=Date.now()):StoreReport{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_REPORT');
 const r=value as StoreReport;
 if(Object.keys(r).some(k=>!['source','reportDate','status','metric','countries','reason'].includes(k))||!['apple','google'].includes(r.source)||!validReportDate(r.reportDate)||r.reportDate>=new Date(now).toISOString().slice(0,10)||Date.parse(r.reportDate)<now-35*86400000||!['ready','pending','blocked'].includes(r.status)||!(r.source==='apple'?r.metric==='app_units':['device_installs','install_events'].includes(r.metric))||!Array.isArray(r.countries)||r.countries.length>300||r.reason!==undefined&&!/^[A-Z0-9_]{1,80}$/.test(r.reason))throw Error('INVALID_REPORT');
 const seen=new Set<string>();
 for(const c of r.countries){if(!c||Object.keys(c).some(k=>!['country','installs','redownloads'].includes(k))||!/^[A-Z]{2}$/.test(c.country)||seen.has(c.country)||!Number.isSafeInteger(c.installs)||c.installs<0||c.installs>1e9||c.redownloads!==undefined&&(r.source!=='apple'||!Number.isSafeInteger(c.redownloads)||c.redownloads<0||c.redownloads>1e9))throw Error('INVALID_REPORT');seen.add(c.country);}
 if(r.status!=='ready'&&(r.countries.length||!r.reason))throw Error('INVALID_REPORT');
 return r;
}
export function storeReportInbox(db:Database){
 return (db.prepare('SELECT * FROM admin_store_daily_reports ORDER BY report_date DESC,source LIMIT 14').all() as {source:StoreReport['source'];report_date:string;status:StoreReport['status'];metric:StoreReport['metric'];countries_json:string;reason:string|null;fetched_ms:number}[]).map(r=>({source:r.source,reportDate:r.report_date,status:r.status,metric:r.metric,countries:JSON.parse(r.countries_json),reason:r.reason,fetchedMs:r.fetched_ms}));
}
export function saveStoreReports(db:Database,values:unknown[],digestDate:string,now=Date.now()){
 if(!validReportDate(digestDate)||digestDate!==new Date(now).toISOString().slice(0,10)||!Array.isArray(values)||values.length!==14)throw Error('INVALID_DIGEST');
 const reports=values.map(v=>validateStoreReport(v,now));
 const keys=new Set(reports.map(r=>r.source+':'+r.reportDate));
 for(let i=1;i<=7;i++)for(const source of ['apple','google'])if(!keys.has(source+':'+new Date(Date.parse(digestDate)-i*86400000).toISOString().slice(0,10)))throw Error('INCOMPLETE_DIGEST');
 return db.transaction(()=>{
  for(const r of reports)db.prepare(`INSERT INTO admin_store_daily_reports(source,report_date,status,metric,countries_json,reason,fetched_ms) VALUES(?,?,?,?,?,?,?) ON CONFLICT(source,report_date) DO UPDATE SET status=excluded.status,metric=excluded.metric,countries_json=excluded.countries_json,reason=excluded.reason,fetched_ms=excluded.fetched_ms WHERE excluded.status='ready' OR admin_store_daily_reports.status!='ready'`).run(r.source,r.reportDate,r.status,r.metric,JSON.stringify(r.countries),r.reason??null,now);
  const snapshot=storeReportInbox(db).filter(r=>keys.has(r.source+':'+r.reportDate));
  return enqueueOwnerEvent(db,'DAILY_DOWNLOAD_REPORT','downloads:'+digestDate,{digestDate,reports:snapshot},null,now);
 }).immediate();
}
