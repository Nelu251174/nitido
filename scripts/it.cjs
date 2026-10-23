// One owner-authorized notification to the registered iPhone of the designated test account.
// Does not enable general delivery, process the outbox, or print device tokens/credentials.
const fs=require('node:fs');
const {createPrivateKey,sign,randomUUID}=require('node:crypto');
const {connect}=require('node:http2');
const Database=require('better-sqlite3');
const auditPath='/app/data/release-checkpoints/20261023-support-ios-standard-sound-test.json';
const testId='support-ios-standard-sound-20261023';
const reply=data=>console.log(JSON.stringify({testId,...data}));

async function run(){
  const env=process.env;
  if(env.NEXT_PUBLIC_SITE_URL!=='https://nitido.ro'||env.PUSH_ENABLED!=='false'||env.APNS_KEY_ID!=='B45XK32J88'||env.APNS_TEAM_ID!=='LQ6L9MJ24T'||env.APNS_BUNDLE_ID!=='ro.nitido.app'||env.APNS_USE_SANDBOX!=='false')throw Error('IOS_TEST_WRONG_RUNTIME');
  if(fs.existsSync(auditPath)){
    const previous=JSON.parse(fs.readFileSync(auditPath,'utf8'));
    if(previous.testId===testId&&previous.status==='provider_accepted'){reply({status:'provider_accepted',alreadySent:true,notificationRepeated:false});return}
    throw Error('IOS_TEST_ALREADY_ATTEMPTED_NO_AUTOMATIC_RETRY');
  }
  const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
  try{
    const user=db.prepare('SELECT id,role FROM users WHERE lower(email)=?').get('support@nitido.ro');
    if(!user||user.role!=='client')throw Error('IOS_TEST_ACCOUNT_MISMATCH');
    const devices=db.prepare("SELECT id,device_token,last_seen_at,updated_at FROM push_devices WHERE user_id=? AND platform='IOS' AND push_enabled=1 AND revoked_at IS NULL ORDER BY updated_at DESC LIMIT 2").all(user.id);
    if(devices.length!==1)throw Error('IOS_TEST_REQUIRES_ONE_REGISTERED_IPHONE');
    const device=devices[0];
    if(!/^[a-f0-9]{64}$/i.test(device.device_token))throw Error('IOS_TEST_DEVICE_TOKEN_FORMAT_INVALID');
    const seen=Date.parse(String(device.last_seen_at??device.updated_at).replace(' ','T').replace(/Z?$/,'Z'));
    if(!Number.isFinite(seen)||Date.now()-seen>2*60*60_000||seen>Date.now()+5*60_000)throw Error('IOS_TEST_REGISTRATION_NOT_RECENT');
    const key=createPrivateKey(env.APNS_PRIVATE_KEY??'');
    if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('IOS_TEST_KEY_INVALID');
    if(env.NITIDO_IOS_TEST!=='send'){reply({status:'registered_and_ready',notificationSent:false});return}
    const now=Math.floor(Date.now()/1000),b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
    const input=b64({alg:'ES256',kid:env.APNS_KEY_ID})+'.'+b64({iss:env.APNS_TEAM_ID,iat:now});
    const authorization='bearer '+input+'.'+sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
    const stillRegistered=db.prepare("SELECT 1 FROM push_devices WHERE id=? AND user_id=? AND platform='IOS' AND push_enabled=1 AND revoked_at IS NULL AND device_token=?").get(device.id,user.id,device.device_token);
    if(!stillRegistered)throw Error('IOS_TEST_DEVICE_REVOKED');
    const id=randomUUID(),record={testId,status:'dispatching',platform:'IOS',createdAt:new Date().toISOString(),providerRequestId:id,deviceReceptionConfirmed:false};
    fs.writeFileSync(auditPath,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});
    try{
      const result=await new Promise((resolve,reject)=>{
        const client=connect('https://api.push.apple.com');let req,settled=false,status=0,providerMessageId='',body='';
        const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);req?.destroy();client.destroy();if(error)reject(error);else resolve(value)};
        const timer=setTimeout(()=>finish(Error('IOS_TEST_DELIVERY_UNKNOWN_TIMEOUT')),12000);
        client.once('error',()=>finish(Error('IOS_TEST_DELIVERY_UNKNOWN_CONNECTION')));
        try{
          req=client.request({':method':'POST',':path':'/3/device/'+device.device_token,authorization,'apns-topic':'ro.nitido.app','apns-push-type':'alert','apns-priority':'10','apns-expiration':String(now+600),'apns-id':id});
          req.on('response',headers=>{status=Number(headers[':status']);providerMessageId=String(headers['apns-id']??'')});
          req.on('data',chunk=>{body+=chunk;if(body.length>8192)finish(Error('IOS_TEST_DELIVERY_UNKNOWN_RESPONSE'))});
          req.once('error',()=>finish(Error('IOS_TEST_DELIVERY_UNKNOWN_STREAM')));
          req.once('aborted',()=>finish(Error('IOS_TEST_DELIVERY_UNKNOWN_STREAM')));
          req.once('end',()=>{
            let reason='';try{reason=JSON.parse(body).reason??''}catch{}
            if(status===200&&providerMessageId)return finish(null,{providerMessageId});
            const allowed=['InvalidProviderToken','ExpiredProviderToken','BadDeviceToken','DeviceTokenNotForTopic','TopicDisallowed','Unregistered','BadTopic','MissingTopic','TooManyProviderTokenUpdates'];
            const error=Error('IOS_TEST_APNS_REJECTED_'+status);error.providerReason=allowed.includes(reason)?reason:'OTHER';error.httpStatus=status;finish(error);
          });
          req.end(JSON.stringify({event_type:'NITIDO_CONFIG_TEST',test_id:testId,aps:{alert:{title:'Sunet standard NÍTIDO',body:'Notificare de test cu sunetul standard al iPhone-ului.'},sound:'default'}}));
        }catch{finish(Error('IOS_TEST_DELIVERY_UNKNOWN_REQUEST'))}
      });
      Object.assign(record,{status:'provider_accepted',providerMessageId:result.providerMessageId,acceptedAt:new Date().toISOString()});
      fs.writeFileSync(auditPath,JSON.stringify(record,null,2)+'\n',{mode:0o600});reply({status:record.status,providerMessageId:record.providerMessageId,deviceReceptionConfirmed:false});
    }catch(error){
      Object.assign(record,{status:'rejected_or_unknown',reason:/^IOS_TEST_[A-Z0-9_]+$/.test(error.message)?error.message:'IOS_TEST_UNKNOWN',...(error.providerReason?{providerReason:error.providerReason,httpStatus:error.httpStatus}:{})});
      fs.writeFileSync(auditPath,JSON.stringify(record,null,2)+'\n',{mode:0o600});throw error;
    }
  }finally{db.close()}
}
run().catch(error=>{reply({status:'blocked',reason:/^IOS_TEST_[A-Z0-9_]+$/.test(error.message)?error.message:'IOS_TEST_FAILED',...(error.providerReason?{providerReason:error.providerReason}:{}),deviceReceptionConfirmed:false});process.exitCode=1});
