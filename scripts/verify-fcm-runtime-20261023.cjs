// Read-only provider verification: validate_only cannot deliver to a device or topic.
const {createSign,createPrivateKey}=require('node:crypto');
const sites={'https://nitido.ro':'live','https://sandbox.nitido.ro':'sandbox'};
const scope=sites[process.env.NEXT_PUBLIC_SITE_URL];
async function verify(){
 if(!scope||process.env.PUSH_ENABLED!=='false'||process.env.FIREBASE_PROJECT_ID!=='nitido-508720')throw Error('UNEXPECTED_FCM_RUNTIME');
 const email=process.env.FIREBASE_CLIENT_EMAIL,key=process.env.FIREBASE_PRIVATE_KEY;
 if(!email||!key||createPrivateKey(key).asymmetricKeyType!=='rsa')throw Error('FCM_RUNTIME_KEY_INVALID');
 const now=Math.floor(Date.now()/1000),b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const input=b64({alg:'RS256',typ:'JWT'})+'.'+b64({iss:email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+600});
 const signer=createSign('RSA-SHA256');signer.update(input);signer.end();
 const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:input+'.'+signer.sign(key).toString('base64url')}),signal:AbortSignal.timeout(15000)});
 if(!auth.ok)throw Error('FCM_RUNTIME_AUTH_'+auth.status);
 const data=await auth.json();if(typeof data.access_token!=='string')throw Error('FCM_RUNTIME_AUTH_INVALID');
 const result=await fetch('https://fcm.googleapis.com/v1/projects/nitido-508720/messages:send',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+data.access_token,'Content-Type':'application/json'},body:JSON.stringify({validate_only:true,message:{topic:'nitido-config-validation',data:{event_type:'CONFIG_VALIDATION'},notification:{title:'NITIDO configuration validation',body:'Validation only; no delivery'}}}),signal:AbortSignal.timeout(15000)});
 if(!result.ok)throw Error('FCM_RUNTIME_VALIDATION_'+result.status);
 console.log(JSON.stringify({scope,providerDryRunAccepted:true,notificationSent:false,pushDeliveryEnabled:false,deviceReceptionTested:false}));
}
verify().catch(error=>{console.error(JSON.stringify({scope,status:'blocked',reason:/^[A-Z0-9_]+$/.test(error.message)?error.message:'FCM_RUNTIME_VERIFICATION_FAILED'}));process.exitCode=1});
