// Read-only operational checks for the owner-selected test account. No token values or notifications.
const Database=require('better-sqlite3');
const mode=process.env.NITIDO_PUSH_CHECK;
if(process.env.NEXT_PUBLIC_SITE_URL!=='https://nitido.ro')throw Error('WRONG_TARGET');
const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
try{
 const user=db.prepare('SELECT id FROM users WHERE lower(email)=?').get('support@nitido.ro');let passed=false;
 if(mode==='account')passed=!!user;
 else if(['android','ios'].includes(mode))passed=!!user&&!!db.prepare('SELECT 1 FROM push_devices WHERE user_id=? AND platform=? AND push_enabled=1 AND revoked_at IS NULL LIMIT 1').get(user.id,mode.toUpperCase());
 else if(mode==='fcm')passed=process.env.PUSH_ENABLED==='true'&&['FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY'].every(k=>!!process.env[k]);
 else if(mode==='apns')passed=process.env.PUSH_ENABLED==='true'&&['APNS_KEY_ID','APNS_TEAM_ID','APNS_PRIVATE_KEY'].every(k=>!!process.env[k])&&process.env.APNS_BUNDLE_ID==='ro.nitido.app'&&process.env.APNS_USE_SANDBOX==='false';
 else if(mode==='firms')passed=!!db.prepare("SELECT 1 FROM firms WHERE verified=1 AND (suspended_until IS NULL OR suspended_until<=datetime('now')) LIMIT 1").get();
 else if(mode==='season')passed=!!db.prepare("SELECT 1 FROM provider_open_slots s JOIN firms f ON f.id=s.firm_id JOIN workspace_teams t ON t.id=s.team_id WHERE s.active=1 AND s.approved_at IS NOT NULL AND f.verified=1 AND t.active=1 AND s.starts_at>='2027-03-01' AND s.starts_at<'2027-09-01' LIMIT 1").get();
 else throw Error('INVALID_CHECK');
 console.log(JSON.stringify({check:mode,passed}));if(!passed)process.exitCode=2;
}finally{db.close()}
