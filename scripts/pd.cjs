// Read-only registration prerequisite. Selects counts, never device tokens.
const Database=require('better-sqlite3');
if(process.env.NEXT_PUBLIC_SITE_URL!=='https://nitido.ro')throw Error('WRONG_NITIDO_TARGET');
const platform=process.env.NITIDO_TEST_PLATFORM,expectAbsent=process.env.NITIDO_EXPECT_ABSENT==='true';
if(!['IOS','ANDROID'].includes(platform))throw Error('INVALID_PLATFORM');
const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
try{
  const user=db.prepare('SELECT id FROM users WHERE lower(email)=?').get('support@nitido.ro');
  if(!user)throw Error('TEST_ACCOUNT_MISSING');
  const row=db.prepare('SELECT COUNT(*) count FROM push_devices WHERE user_id=? AND platform=? AND push_enabled=1 AND revoked_at IS NULL').get(user.id,platform);
  const hasActiveDevice=row.count>0;
  console.log(JSON.stringify({platform,testAccountExists:true,hasActiveDevice}));
  if(expectAbsent?hasActiveDevice:!hasActiveDevice)process.exitCode=2;
}finally{db.close()}
