// Owner delegated configuration: 2026-10-22, PR133; no price/commission changes.
const {createHash,randomUUID}=require('node:crypto');
const RELEASE='supplement-release-133-20261022';
const ACTOR='owner-authorized-release:'+RELEASE;
const REASON='Owner instructed finalization and LIVE publication on 2026-10-22. Operational contribution floor: 0 RON after documented costs; no new percentage threshold. Negative contribution still requires the existing explicit audited exception. Unknown costs remain blocking. Public prices and commission unchanged.';
function protectedState(db){return createHash('sha256').update(JSON.stringify({jobs:db.prepare('SELECT * FROM jobs ORDER BY id').all(),payments:db.prepare('SELECT * FROM payments ORDER BY id').all(),credits:db.prepare('SELECT id,credit_balance FROM users ORDER BY id').all()})).digest('hex')}
function configurePolicy(db,now=new Date()){
 return db.transaction(()=>{
  const current=db.prepare('SELECT * FROM margin_policies ORDER BY revision DESC LIMIT 1').get();
  if(current){if(current.actor_id!==ACTOR||current.min_bani!==0||current.min_basis_points!==null||current.reason!==REASON)throw Error('EXISTING_POLICY_PRESERVED');return {status:'passed',revision:current.revision,minBani:0,minBasisPoints:null,replayed:true};}
  const before=protectedState(db);
  db.prepare('INSERT INTO margin_policies(revision,min_bani,min_basis_points,reason,actor_id,created_at) VALUES(1,0,NULL,?,?,?)').run(REASON,ACTOR,now.toISOString());
  db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run('audit_'+randomUUID(),'margin.policy_saved','1',JSON.stringify({actorId:ACTOR,authorization:'Owner chat instruction: OK, EXECUTA SI FINALIZEAZA , VREAU SA IL VAD LIVE',release:RELEASE,minBani:0,minBasisPoints:null,reason:REASON}));
  if(protectedState(db)!==before)throw Error('PROTECTED_COMMERCIAL_STATE_CHANGED');
  return {status:'passed',revision:1,minBani:0,minBasisPoints:null,protectedCommercialStateUnchanged:true};
 }).immediate();
}
module.exports={configurePolicy};
if(require.main===module||!require.main){
 try{
  const site=process.env.NEXT_PUBLIC_SITE_URL,key=process.env.STRIPE_SECRET_KEY||'';
  const targets={'https://nitido.ro':{path:'live',source:'a72b2598b4b118bc56621a9a97048a9319faa589',key:/^(?:sk|rk)_live_/},'https://sandbox.nitido.ro':{path:'sandbox',source:'59fda7e6a5a0dd3a7f09a7c0e3bc9b84f63ed9e9',key:/^(?:sk|rk)_test_/}};
  const target=targets[site];if(!target||!target.key.test(key))throw Error('WRONG_RELEASE_TARGET');
  const proof=JSON.parse(require('node:fs').readFileSync('/app/data/release-checkpoints/20261022-before-supplement-activation-'+target.path+'/verification.json','utf8'));
  if(proof.status!=='passed'||proof.baseCommit!==target.source)throw Error('VERIFIED_RELEASE_CHECKPOINT_REQUIRED');
  const db=new(require('better-sqlite3'))('/app/data/nitido.db',{fileMustExist:true});db.pragma('foreign_keys=ON');try{console.log(JSON.stringify(configurePolicy(db)))}finally{db.close()}
 }catch(e){console.error(JSON.stringify({status:'failed',code:/^[A-Z_]+$/.test(e.message)?e.message:'POLICY_CONFIGURATION_FAILED'}));process.exitCode=1}
}
