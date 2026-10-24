// Fixed operational readiness assertions only. Never exports contact or device values.
const fs=require('node:fs'),Database=require('better-sqlite3');
if(process.env.NEXT_PUBLIC_SITE_URL!=='https://nitido.ro')throw Error('WRONG_TARGET');
const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
const root='/app/data/pilot-20261024/';
function record(key,status){try{return JSON.parse(fs.readFileSync(root+key+'.json','utf8')).status===status}catch{return false}}
function contact(id,name){return !!db.prepare('SELECT 1 FROM firms f JOIN users u ON u.id=f.user_id JOIN email_verifications v ON v.user_id=u.id AND v.email=u.email WHERE f.id=? AND u.name=? AND u.role=? AND v.verified_at IS NOT NULL').get(id,name,'firma')}
const checks={
 'android-provider':()=>['FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY'].every(k=>!!process.env[k])&&process.env.FIREBASE_PROJECT_ID==='nitido-508720',
 'android-device':()=>db.prepare("SELECT COUNT(*) n FROM push_devices p JOIN users u ON u.id=p.user_id WHERE lower(u.email)=? AND u.role='client' AND p.platform='ANDROID' AND p.push_enabled=1 AND p.revoked_at IS NULL").get('support@nitido.ro').n===1,
 'android-attempted':()=>fs.existsSync(root+'owner-test-20261024-android.json'),
 'android-accepted':()=>record('owner-test-20261024-android','provider_accepted'),
 'mail-provider':()=>!!process.env.RESEND_API_KEY&&!!process.env.RESEND_FROM,
 'allstones-channel':()=>contact('firm_gss3cxi4mv1cy43e','ALLSTONES BUSINESS SRL'),
 'jami-channel':()=>contact('firm_z5w23tk7mv9hrpea','Jami curatenie Cta'),
 'allstones-accepted':()=>record('firm-firm_gss3cxi4mv1cy43e','provider_accepted'),
 'jami-accepted':()=>record('firm-firm_z5w23tk7mv9hrpea','provider_accepted')
};
try{const fn=checks[process.argv[1]];if(!fn)throw Error('UNKNOWN_CHECK');process.exitCode=fn()?0:2}finally{db.close()}
