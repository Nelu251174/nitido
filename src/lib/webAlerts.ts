import type {Database} from 'better-sqlite3';
export type WebAlert={id:string;kind:'message'|'completed';jobId:string;at:string};
export function webAlerts(db:Database,userId:string):WebAlert[]{
 const preferences=db.prepare('SELECT job_status_notifications,completion_notifications FROM notification_preferences WHERE user_id=?').get(userId) as {job_status_notifications:number;completion_notifications:number}|undefined;
 const messages=preferences?.job_status_notifications===0?[]:db.prepare(`SELECT 'message:'||m.id AS id,'message' AS kind,m.job_id AS jobId,m.created_at AS at
 FROM workspace_messages m JOIN jobs j ON j.id=m.job_id LEFT JOIN firms f ON f.id=j.accepted_firm_id
 WHERE ((j.client_id=? AND m.sender_id=f.user_id) OR (f.user_id=? AND m.sender_id=j.client_id))
 AND NOT EXISTS(SELECT 1 FROM workspace_message_reads r WHERE r.message_id=m.id AND r.user_id=?)
 AND datetime(m.created_at)>=datetime('now','-7 days') ORDER BY m.created_at DESC,m.id DESC LIMIT 100`).all(userId,userId,userId) as WebAlert[];
 const completed=preferences?.completion_notifications===0?[]:db.prepare(`SELECT 'completed:'||id AS id,'completed' AS kind,id AS jobId,completed_at AS at FROM jobs
 WHERE client_id=? AND status='completed' AND datetime(completed_at)>=datetime('now','-7 days') ORDER BY completed_at DESC,id DESC LIMIT 100`).all(userId) as WebAlert[];
 return [...messages,...completed].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
}
