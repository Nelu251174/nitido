// Manual sandbox diagnostic: exercise the deployed collector against the owner's public website.
// Creates one temporary discovery preview; never saves contacts, queues campaigns or sends email.
const Database=require('better-sqlite3');
const {randomUUID}=require('node:crypto');
(async()=>{
 if(process.env.NEXT_PUBLIC_SITE_URL!=='https://sandbox.nitido.ro')throw Error('SANDBOX_REQUIRED');
 if(process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('REAL_DELIVERY_MUST_BE_OFF');
 const db=new Database('/app/data/nitido.db',{fileMustExist:true}),id=randomUUID();
 try {
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_discovery'").get())throw Error('MARKETING_WORKER_NOT_READY');
  db.transaction(()=>{
   if(db.prepare("SELECT 1 FROM marketing_discovery WHERE status IN ('pending','running','cancel_requested')").get())throw Error('COLLECTION_ALREADY_RUNNING');
   if((db.prepare('SELECT COUNT(*) n FROM marketing_discovery WHERE created_at>=?').get(new Date().toISOString().slice(0,10))).n>=20)throw Error('SOURCE_DAILY_LIMIT_REACHED');
   const now=new Date().toISOString();db.prepare("INSERT INTO marketing_discovery(id,status,request,created_at,updated_at,created_by) VALUES(?,'pending',?,?,?,?)").run(id,JSON.stringify({category:'business',city:'Constanța',limit:1,websites:'https://nitido.ro/'}),now,now,'marketing-public-check');
  }).immediate();
  const deadline=Date.now()+70000;
  while(Date.now()<deadline){
   const row=db.prepare('SELECT status,result FROM marketing_discovery WHERE id=?').get(id);
   if(['completed','failed','canceled'].includes(row.status)){
    const result=JSON.parse(row.result||'{}'),contacts=result.contacts||[];
    console.log(JSON.stringify({scope:'sandbox',source:'https://nitido.ro/',status:row.status,contactsPreviewed:contacts.length,publicEmailsFound:contacts.filter(c=>c.email).length,warnings:(result.warnings||[]).length,contactsSaved:0,realEmailsSent:0,deliveryEnabled:false}));
    if(row.status!=='completed'||(result.warnings||[]).length||!contacts.some(c=>c.email))throw Error('PUBLIC_SOURCE_CHECK_INCOMPLETE');
    return;
   }
   await new Promise(resolve=>setTimeout(resolve,1500));
  }
  throw Error('PUBLIC_SOURCE_CHECK_TIMEOUT');
 } finally {
  const row=db.prepare('SELECT status FROM marketing_discovery WHERE id=?').get(id);
  if(row&&['completed','failed','canceled','pending'].includes(row.status))db.prepare('DELETE FROM marketing_discovery WHERE id=? AND created_by=?').run(id,'marketing-public-check');
  db.close();
 }
})().catch(error=>{console.error(/^[A-Z_]+$/.test(error.message)?error.message:'MARKETING_PUBLIC_CHECK_FAILED');process.exitCode=1;});
