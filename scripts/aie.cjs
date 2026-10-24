// Explicit owner approval: associate the existing primary ADMIN with support@nitido.ro.
// Runs inside the existing LIVE app. No credential values leave the application.
const fs=require('node:fs/promises');
const {createHash}=require('node:crypto');
const TARGET='support@nitido.ro';
const DIR='/app/data/release-checkpoints/20261024-admin-email-support';
function unchangedCredentials(env){
 const keys=['NITIDO_ADMIN_PASSWORD_HASH','NITIDO_ADMIN_PASSWORD','NITIDO_ADMIN_TOTP_SECRET','NITIDO_ADMIN_RECOVERY_HASHES'];
 if(!(env.NITIDO_ADMIN_PASSWORD_HASH||env.NITIDO_ADMIN_PASSWORD)||!env.NITIDO_ADMIN_TOTP_SECRET)throw Error('ADMIN_SECURITY_NOT_CONFIGURED');
 return createHash('sha256').update(JSON.stringify(keys.map(k=>env[k]||''))).digest('hex');
}
function validate(env,hasOverride){
 if(env.NEXT_PUBLIC_SITE_URL!=='https://nitido.ro')throw Error('WRONG_TARGET');
 if(!env.NITIDO_ADMIN_EMAIL?.trim())throw Error('ADMIN_EMAIL_MISSING');
 if(hasOverride)throw Error('PERSISTED_PASSWORD_REQUIRES_MIGRATION');
 return unchangedCredentials(env);
}
async function run(action){
 if(!['prepare','verify'].includes(action))throw Error('INVALID_ACTION');
 const Database=require('better-sqlite3');
 const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
 try{
  const fingerprint=unchangedCredentials(process.env);
  if(process.env.NEXT_PUBLIC_SITE_URL!=='https://nitido.ro')throw Error('WRONG_TARGET');
  const current=(process.env.NITIDO_ADMIN_EMAIL||'').trim().toLowerCase();
  if(action==='prepare'){
   validate(process.env,!!db.prepare('SELECT 1 FROM admin_password_credentials WHERE account_id=?').get('bootstrap_admin'));
   if(db.prepare('SELECT 1 FROM admin_staff WHERE email=? AND active=1').get(TARGET))throw Error('CONFLICTING_STAFF_IDENTITY');
   let prior;try{prior=JSON.parse(await fs.readFile(DIR+'/state.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
   if(prior){if(prior.oldEmail!==current||prior.credentialFingerprint!==fingerprint)throw Error('CHECKPOINT_CONFIG_CHANGED');return;}
   await fs.mkdir(DIR,{mode:0o700});
   await db.backup(DIR+'/nitido.db');await fs.chmod(DIR+'/nitido.db',0o600);
   await fs.copyFile(DIR+'/nitido.db',DIR+'/restore-check.db',require('node:fs').constants.COPYFILE_EXCL);await fs.chmod(DIR+'/restore-check.db',0o600);
   for(const file of ['nitido.db','restore-check.db']){
    const backup=new Database(DIR+'/'+file,{readonly:true,fileMustExist:true});
    try{if(backup.pragma('integrity_check',{simple:true})!=='ok'||backup.pragma('foreign_key_check').length)throw Error('BACKUP_INTEGRITY_FAILED')}finally{backup.close()}
   }
   const digest=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
   if(await digest(DIR+'/nitido.db')!==await digest(DIR+'/restore-check.db'))throw Error('RESTORE_MISMATCH');
   await fs.writeFile(DIR+'/state.json',JSON.stringify({oldEmail:current,newEmail:TARGET,credentialFingerprint:fingerprint,preparedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
  }else{
   const prior=JSON.parse(await fs.readFile(DIR+'/state.json','utf8'));
   if(current!==TARGET||prior.newEmail!==TARGET)throw Error('EMAIL_CHANGE_NOT_APPLIED');
   if(fingerprint!==prior.credentialFingerprint)throw Error('PASSWORD_OR_MFA_CHANGED');
   if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)throw Error('DATABASE_INTEGRITY_FAILED');
   await fs.writeFile(DIR+'/verified.json',JSON.stringify({verifiedAt:new Date().toISOString(),emailMatched:true,passwordAndMfaUnchanged:true}),{mode:0o600});
  }
 }finally{db.close()}
}
module.exports={unchangedCredentials,validate};
if(['prepare','verify'].includes(process.argv[1]))run(process.argv[1]).then(()=>console.log(JSON.stringify({stage:process.argv[1],status:'passed'}))).catch(e=>{console.error(/^[A-Z_]+$/.test(e.message)?e.message:'IDENTITY_CHANGE_CHECK_FAILED');process.exitCode=1});
