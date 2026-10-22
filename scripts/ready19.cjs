// Read-only verification of the actual running container configuration.
const site=process.env.NEXT_PUBLIC_SITE_URL,key=process.env.STRIPE_SECRET_KEY||'';
if(process.env.NITIDO_SUPPLEMENT_BOOKING_ENABLED!=='true')throw Error('SUPPLEMENT_FLAG_NOT_ACTIVE');
if(!((site==='https://nitido.ro'&&/^(?:sk|rk)_live_/.test(key))||(site==='https://sandbox.nitido.ro'&&/^(?:sk|rk)_test_/.test(key))))throw Error('WRONG_RELEASE_TARGET');
const db=new(require('better-sqlite3'))('/app/data/nitido.db',{readonly:true,fileMustExist:true});try{
 const p=db.prepare('SELECT * FROM margin_policies ORDER BY revision DESC LIMIT 1').get();
 if(!p||p.min_bani!==0||p.min_basis_points!==null||p.actor_id!=='owner-authorized-release:supplement-release-133-20261022')throw Error('RELEASE_POLICY_NOT_CONFIRMED');
 const a=db.prepare("SELECT 1 FROM admin_audit_log WHERE action='margin.policy_saved' AND json_extract(details,'$.release')='supplement-release-133-20261022'").get();if(!a)throw Error('RELEASE_AUDIT_NOT_CONFIRMED');
 console.log(JSON.stringify({status:'passed',supplementEnabled:true,policyRevision:p.revision,minBani:0,minBasisPoints:null,releaseAudit:true,site}));
}finally{db.close()}
