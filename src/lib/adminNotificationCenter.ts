import {activeAccountSql} from './accountStatus';
import {createHash} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import {ownerAttention} from './ownerAttention';
import {ADMIN_NOTIFICATION_CATEGORIES,type AdminNotificationCategory,type AdminNotificationItem} from './adminNotificationCenterShared';
type Row=Record<string,string|number|null>;
type InternalItem=AdminNotificationItem&{ownerEventId?:string};
const digest=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,32);
const millis=(s:unknown)=>{if(typeof s==='number')return s;const value=String(s??'');return Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(value)?value:value.replace(' ','T')+'Z')||0;};
const stateLabel=(s:unknown)=>({waiting:'În așteptare',accepted:'Preluată',arrived:'Sosire confirmată',completed:'Finalizată',cancelled:'Anulată',no_show:'Absență de verificat',authorized:'Autorizată',captured:'Încasată',refunded:'Rambursată',paid:'Achitat',failed:'Eșuat',unknown:'Rezultat neconfirmat',pending:'În așteptare',published:'Publicată',under_review:'În analiză',hidden:'Ascunsă',submitted:'Trimisă',needs_details:'Necesită detalii',reviewed:'Verificată',declined:'Refuzată',requested:'Solicitată',queued:'Programată',paused:'În pauză',review:'De verificat',collecting:'Colectare în curs',VALID:'Validată',PENDING:'În așteptarea verificării',in_transit:'În curs',succeeded:'Finalizat'} as Record<string,string>)[String(s)]??String(s);
function collect(db:Database,actor:string){
 const items:InternalItem[]=[];
 const has=(name:string)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
 const rows=(table:string,sql:string)=>has(table)?db.prepare(sql).all() as Row[]:[];
 const add=(source:string,key:string,category:AdminNotificationCategory,title:string,description:string,href:string,at:unknown,state:unknown,urgent=false,ownerEventId?:string,alreadyRead=false)=>{
  if(!href.startsWith('/')||href.startsWith('//'))throw Error('INVALID_NOTIFICATION_DESTINATION');
  items.push({id:digest(source+':'+key),revision:digest(JSON.stringify([title,description,state])),category,title,description,href,createdMs:millis(at),urgent,read:alreadyRead,...(ownerEventId?{ownerEventId}:{})});
 };
 for(const r of db.prepare(`SELECT e.id,e.event_type,e.created_ms,e.email_status,u.name,u.email,u.role,u.is_business,EXISTS(SELECT 1 FROM admin_owner_reads x WHERE x.event_id=e.id AND x.admin_id=?) is_read FROM admin_owner_events e LEFT JOIN users u ON u.id=e.user_id ORDER BY e.created_ms DESC LIMIT 1000`).all(actor) as Row[]){
  const type=r.role==='firma'?'Firmă de curățenie':r.role==='client'?(r.is_business?'Client comercial':'Client privat'):'';
  const title=r.event_type==='CLIENT_REGISTERED'||r.event_type==='FIRM_REGISTERED'?'Înregistrare nouă · '+(r.name||'Cont indisponibil'):r.event_type==='DAILY_DOWNLOAD_REPORT'?'Raport nou de descărcări':'Verificare alerte administrator';
  add('owner',String(r.id),'registrations',title,[type,r.email].filter(Boolean).join(' · '),'/admin#inscrieri',r.created_ms,[r.event_type,r.role,r.is_business],false,String(r.id),!!r.is_read);
 }
 if(has('jobs'))for(const r of rows('jobs',"SELECT id,city,status,created_at FROM jobs ORDER BY created_at DESC LIMIT 300"))add('job',String(r.id),'operations','Lucrare · '+r.city,'Stare: '+stateLabel(r.status),'/admin?focusJob='+encodeURIComponent(String(r.id))+'#operatiuni',r.created_at,r.status);
 if(has('jobs'))for(const r of ownerAttention(db).items)add('attention',r.key,r.key.startsWith('case:')?'quality':'operations',r.title,r.city?[r.city,r.nextAction].join(' · '):r.nextAction,r.href,r.key==='notifications'||r.key==='appointment-delivery'?0:r.since,[r.title,r.severity],r.severity==='urgent');
 for(const r of rows('service_assessments',"SELECT id,status,version,created_at FROM service_assessments ORDER BY created_at DESC LIMIT 300"))add('assessment',String(r.id),'operations','Cerere de evaluare',stateLabel(r.status),'/admin#evaluari',r.created_at,[r.status,r.version]);
 for(const r of rows('payments',"SELECT id,status,transfer_status,payout_status,refund_status,dispute_status,created_at FROM payments ORDER BY created_at DESC LIMIT 300")){
  const states=[r.status,r.transfer_status,r.payout_status,r.refund_status,r.dispute_status].filter(s=>s&&!['none','not_started'].includes(String(s)));
  add('payment',String(r.id),'payments','Actualizare plată',states.map(stateLabel).join(' · '),'/admin#plati',r.created_at,states,states.some(s=>['failed','needs_review','open'].includes(String(s))));
 }
 for(const r of rows('stripe_webhook_inbox',"SELECT event_id,event_type,status,received_at FROM stripe_webhook_inbox WHERE status IN ('failed','needs_review') ORDER BY received_at DESC LIMIT 300"))add('webhook',String(r.event_id),'payments','Eveniment de plată de verificat',r.event_type+' · '+r.status,'/admin#plati',r.received_at,r.status,true);
 for(const r of rows('stripe_bank_payouts',"SELECT account_id,payout_id,status,updated_at FROM stripe_bank_payouts ORDER BY updated_at DESC LIMIT 300"))add('payout',String(r.account_id)+':'+r.payout_id,'payments','Actualizare virament bancar',stateLabel(r.status),'/admin#plati',r.updated_at,r.status,r.status==='failed');
 for(const r of rows('service_assessment_messages',"SELECT id,assessment_id,created_at FROM service_assessment_messages WHERE author='client' ORDER BY created_at DESC LIMIT 300"))add('assessment-message',String(r.id),'operations','Mesaj nou la o evaluare','Clientul a trimis un mesaj.','/admin#evaluari',r.created_at,r.id);
 for(const r of rows('authorization_coverage',"SELECT job_id,state,updated_ms FROM authorization_coverage WHERE state<>'verified' ORDER BY updated_ms DESC LIMIT 300"))add('authorization',String(r.job_id),'payments','Autorizare de plată de verificat',stateLabel(r.state),'/admin#plati',r.updated_ms,r.state,true);
 for(const r of rows('payment_cancellation_requests',"SELECT job_id,status,created_at FROM payment_cancellation_requests WHERE status<>'processed' ORDER BY created_at DESC LIMIT 300"))add('cancellation',String(r.job_id),'payments','Anulare de plată în verificare',stateLabel(r.status),'/admin#plati',r.created_at,r.status,true);
 for(const r of rows('ratings',"SELECT id,stars,moderation_status,created_at FROM ratings ORDER BY created_at DESC LIMIT 300"))add('rating',String(r.id),'quality','Recenzie · '+r.stars+'/5',stateLabel(r.moderation_status),'/admin#calitate',r.created_at,[r.stars,r.moderation_status],r.moderation_status==='under_review');
 for(const r of rows('review_reports',"SELECT id,status,created_at FROM review_reports WHERE status='open' ORDER BY created_at DESC LIMIT 300"))add('review-report',String(r.id),'quality','Recenzie raportată','O recenzie necesită verificare.','/admin#calitate',r.created_at,r.status,true);
 for(const r of rows('job_photos',"SELECT id,proof_type,status,created_at FROM job_photos WHERE proof_type IN ('ARRIVAL','COMPLETION') ORDER BY created_at DESC LIMIT 300"))add('proof',String(r.id),'quality',r.proof_type==='ARRIVAL'?'Dovadă de sosire':'Dovadă de finalizare',stateLabel(r.status),'/admin#calitate',r.created_at,r.status);
 for(const r of rows('firms',`SELECT f.id,f.verified,u.name,u.created_at FROM firms f JOIN users u ON u.id=f.user_id WHERE f.verified=0 AND ${activeAccountSql(db,'u.id')} ORDER BY u.created_at DESC LIMIT 300`))add('firm',String(r.id),'accounts','Firmă de verificat · '+r.name,'Contul așteaptă verificarea.','/admin#firme',r.created_at,r.verified);
 for(const r of rows('account_deletion_requests',`SELECT r.id,e.revision,e.status,e.created_at,u.name FROM account_deletion_requests r JOIN users u ON u.id=r.user_id JOIN account_deletion_events e ON e.request_id=r.id AND e.revision=(SELECT MAX(x.revision) FROM account_deletion_events x WHERE x.request_id=r.id) ORDER BY e.created_at DESC LIMIT 300`))add('deletion',String(r.id),'accounts','Cerere de ștergere cont · '+r.name,stateLabel(r.status),'/admin#cereri-stergere',r.created_at,[r.status,r.revision],true);
 for(const r of rows('marketing_county_jobs',"SELECT id,county_code,state,updated_at FROM marketing_county_jobs WHERE state IN ('paused','completed','review') ORDER BY updated_at DESC LIMIT 100"))add('marketing-county',String(r.id),'marketing','Colectare firme · '+r.county_code,'Stare: '+stateLabel(r.state),'/admin/marketing?tab=counties',r.updated_at,r.state,r.state==='paused');
 for(const r of rows('marketing_outbox',"SELECT campaign_id,MAX(updated_at) created_at,COUNT(*) count FROM marketing_outbox WHERE status IN ('failed','unknown') GROUP BY campaign_id LIMIT 100"))add('marketing-delivery',String(r.campaign_id),'marketing','Expedieri Marketing de verificat',r.count+' mesaje necesită verificare.','/admin/marketing?tab=results',r.created_at,r.count,true);
 for(const table of ['notification_outbox','push_notification_outbox'])for(const r of rows(table,`SELECT id,event_type,status,created_at FROM ${table} WHERE status IN ('failed','unknown') ORDER BY created_at DESC LIMIT 300`))add(table,String(r.id),'operations','Notificare nereușită · '+r.event_type,'Stare: '+stateLabel(r.status),'/admin#notificari',r.created_at,r.status,true);
 const read=new Map((db.prepare('SELECT event_key,revision FROM admin_notification_reads WHERE admin_id=?').all(actor) as {event_key:string;revision:string}[]).map(r=>[r.event_key,r.revision]));
 for(const item of items)item.read=item.read||read.get(item.id)===item.revision;
 return items.sort((a,b)=>Number(a.read)-Number(b.read)||Number(b.urgent)-Number(a.urgent)||b.createdMs-a.createdMs||a.id.localeCompare(b.id));
}
export function adminNotificationFeed(db:Database,actor:string,category:AdminNotificationCategory|'all'='all',offset=0){
 if(!Number.isSafeInteger(offset)||offset<0||offset>10000||category!=='all'&&!Object.hasOwn(ADMIN_NOTIFICATION_CATEGORIES,category))throw Error('INVALID_FILTER');
 const all=collect(db,actor),selected=category==='all'?all:all.filter(i=>i.category===category);
 const counts=Object.fromEntries(Object.keys(ADMIN_NOTIFICATION_CATEGORIES).map(c=>[c,all.filter(i=>i.category===c&&!i.read).length])) as Record<AdminNotificationCategory,number>;
 return {items:selected.slice(offset,offset+50).map(({ownerEventId:_,...item})=>{void _;return item;}),unread:all.filter(i=>!i.read).length,total:selected.length,offset,hasMore:offset+50<selected.length,counts};
}
export function markAdminNotificationsRead(db:Database,actor:string,value:unknown,now=Date.now()){
 if(!Array.isArray(value)||value.length>50||value.some(v=>!v||typeof v!=='object'||Object.keys(v).length!==2||!/^\w{32}$/.test(v.id)||!/^\w{32}$/.test(v.revision)))throw Error('INVALID_ITEMS');
 const current=new Map(collect(db,actor).map(i=>[i.id,i]));
 return db.transaction(()=>{let changed=0;for(const v of value){const item=current.get(v.id);if(!item||item.revision!==v.revision)throw Error('STALE_NOTIFICATION');
  changed+=db.prepare('INSERT INTO admin_notification_reads(admin_id,event_key,revision,read_ms) VALUES(?,?,?,?) ON CONFLICT(admin_id,event_key) DO UPDATE SET revision=excluded.revision,read_ms=excluded.read_ms').run(actor,item.id,item.revision,now).changes;
  if(item.ownerEventId)db.prepare('INSERT OR IGNORE INTO admin_owner_reads(event_id,admin_id,read_ms) VALUES(?,?,?)').run(item.ownerEventId,actor,now);
 }return {changed};}).immediate();
}
