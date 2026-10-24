// Fixed read-only assertions for the owner-approved Constanta pilot.
// No contact values, credentials, records or raw logs are emitted.
const assert=require('node:assert/strict');
const fs=require('node:fs');
if(process.env.NEXT_PUBLIC_SITE_URL!=='https://nitido.ro')throw Error('WRONG_APPLICATION');
const db=require('better-sqlite3')('/app/data/nitido.db',{readonly:true,fileMustExist:true});
const ids=['firm_gss3cxi4mv1cy43e','firm_z5w23tk7mv9hrpea'];
try{
 const names=['ALLSTONES BUSINESS SRL','Jami curatenie Cta'];
 for(let n=0;n<ids.length;n++)assert.equal(db.prepare('SELECT u.name FROM firms f JOIN users u ON u.id=f.user_id WHERE f.id=?').get(ids[n])?.name,names[n]);
 const verified=()=>Boolean(db.prepare('SELECT 1 FROM firms f JOIN users u ON u.id=f.user_id JOIN email_verifications v ON v.user_id=u.id AND v.email=u.email WHERE f.id=? AND v.verified_at IS NOT NULL').get(ids[0]));
 switch(process.argv[1]){
  case 'contact-blocked':assert.equal(verified(),false);break;
  case 'contact-ready':assert.equal(verified(),true);break;
  case 'teams-not-ready':assert.equal(db.prepare('SELECT COUNT(*) n FROM workspace_teams WHERE firm_id IN (?,?) AND active=1').get(...ids).n,0);break;
  case 'mail-receipt':{
   const receipt=JSON.parse(fs.readFileSync('/app/data/pilot-20261024/firm-'+ids[1]+'.json','utf8'));
   assert.equal(receipt.status,'provider_accepted');assert.equal(typeof receipt.providerMessageId,'string');assert.ok(receipt.providerMessageId);break;
  }
  case 'pilot-disabled':{
   const pilot=db.prepare("SELECT city FROM feature_pilots WHERE feature_key='weekly'").get();
   assert.notEqual(String(pilot?.city??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),'constanta');break;
  }
  default:throw Error('UNSUPPORTED_ASSERTION');
 }
}finally{db.close();}
