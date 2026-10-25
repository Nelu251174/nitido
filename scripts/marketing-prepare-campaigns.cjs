// Owner-authorized draft preparation only. No recipients, delivery jobs or transport are created.
const Database=require('better-sqlite3'),{randomUUID}=require('node:crypto');
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('ORIGIN_DELIVERY_GUARD');
async function main(){
 const response=await fetch('https://raw.githubusercontent.com/Nelu251174/nitido/b3b4a5870c66f05a2c10ae7e33eb1fc893cf2364/docs/marketing/campaign-drafts-20261025.json');if(!response.ok)throw Error('TEMPLATES_UNAVAILABLE');const doc=await response.json();
 if(doc.schema!=='editorial-campaign-drafts-v1'||doc.templates.length!==3)throw Error('TEMPLATES_INVALID');
 const labels={business:'Clienți business',cleaning:'Firme de curățenie',individual:'Persoane fizice'},regions={CT:'Constanța',B:'București',BV:'Brașov',IF:'Ilfov',CJ:'Cluj',IS:'Iași',TM:'Timiș'};
 const db=new Database('/app/data/nitido.db',{fileMustExist:true});db.pragma('busy_timeout=5000');
 try{const result=db.transaction(()=>{
 db.exec("CREATE TABLE IF NOT EXISTS marketing_campaigns(id TEXT PRIMARY KEY,version INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('draft','ready','paused','archived')),payload TEXT NOT NULL,updated_at TEXT NOT NULL,created_by TEXT NOT NULL);CREATE TABLE IF NOT EXISTS marketing_campaign_preparations(preparation_key TEXT PRIMARY KEY,campaign_id TEXT NOT NULL UNIQUE REFERENCES marketing_campaigns(id));");
 const jobs=db.prepare('SELECT county_code,created_by FROM marketing_county_jobs ORDER BY position').all();let created=0,existing=0;
 for(const job of jobs){const code=job.county_code;if(!regions[code])throw Error('COUNTY_NOT_REVIEWED');for(const t of doc.templates){if(!labels[t.category]||typeof t.body!=='string'||t.body.length>10000||!t.ctaUrl.startsWith('https://nitido.ro/'))throw Error('TEMPLATE_INVALID');for(const variant of ['A','B']){
  const key='launch-v1:'+code+':'+t.category+':'+variant;if(db.prepare('SELECT 1 FROM marketing_campaign_preparations WHERE preparation_key=?').get(key)){existing++;continue;}
  const id=randomUUID(),at=new Date().toISOString(),c={id,version:1,state:'draft',name:regions[code]+' · '+labels[t.category]+' · '+variant,subject:variant==='A'?t.subjectA:t.subjectB,body:t.body,category:t.category,county:code,variant,city:'',recipientLimit:50,ctaLabel:t.ctaLabel,ctaUrl:t.ctaUrl,budgetRon:null,updatedAt:at};
  db.prepare('INSERT INTO marketing_campaigns VALUES(?,?,?,?,?,?)').run(id,1,'draft',JSON.stringify(c),at,job.created_by);db.prepare('INSERT INTO marketing_campaign_preparations VALUES(?,?)').run(key,id);db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'marketing.campaign.saved',id,JSON.stringify({actor:'owner-authorized:county-audience-drafts',state:'draft',county:code,category:t.category,variant}));created++;
 }}}
 return {created,existing,state:'draft',delivery:'blocked'};
 }).immediate();console.log('MKT_DRAFT_PREPARATION '+JSON.stringify(result));}finally{db.close();}
}
main().catch(()=>{console.log('MKT_DRAFT_PREPARATION_FAILED');process.exitCode=1;});
