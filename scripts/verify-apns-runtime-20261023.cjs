// No device requests or notifications: local key validation and APNs TLS/HTTP2 only.
const {createPrivateKey,createPublicKey,createHash,sign,verify}=require('node:crypto');
const {connect}=require('node:http2');
const scope={'https://nitido.ro':'live','https://sandbox.nitido.ro':'sandbox'}[process.env.NEXT_PUBLIC_SITE_URL];
async function check(){
  const env=process.env;
  if(!scope||env.PUSH_ENABLED!=='false'||env.APNS_KEY_ID!=='B45XK32J88'||env.APNS_TEAM_ID!=='LQ6L9MJ24T'||env.APNS_BUNDLE_ID!=='ro.nitido.app'||env.APNS_USE_SANDBOX!=='false')throw Error('APNS_RUNTIME_IDENTITY_MISMATCH');
  let key;
  try{key=createPrivateKey(env.APNS_PRIVATE_KEY??'')}catch{throw Error('APNS_RUNTIME_KEY_INVALID')}
  if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('APNS_RUNTIME_KEY_INVALID');
  const publicKey=createPublicKey(key),message=Buffer.from('NITIDO APNs runtime signature self-check');
  const signature=sign('sha256',message,{key,dsaEncoding:'ieee-p1363'});
  if(!verify('sha256',message,{key:publicKey,dsaEncoding:'ieee-p1363'},signature))throw Error('APNS_RUNTIME_SIGNATURE_INVALID');
  await new Promise((resolve,reject)=>{
    const client=connect('https://api.push.apple.com');
    let done=false;
    const finish=error=>{if(done)return;done=true;clearTimeout(timer);client.destroy();error?reject(error):resolve()};
    const timer=setTimeout(()=>finish(Error('APNS_CONNECTION_TIMEOUT')),12000);
    client.once('error',()=>finish(Error('APNS_CONNECTION_FAILED')));
    client.once('connect',()=>finish(client.socket.alpnProtocol==='h2'?undefined:Error('APNS_HTTP2_UNAVAILABLE')));
  });
  console.log(JSON.stringify({scope,keyId:env.APNS_KEY_ID,teamId:env.APNS_TEAM_ID,bundleId:env.APNS_BUNDLE_ID,useSandbox:false,runtimeConfigured:true,signatureSelfCheck:true,publicKeySha256:createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex'),apnsTlsHttp2Connected:true,appleAuthenticationVerified:false,notificationSent:false,deviceReceptionTested:false,pushDeliveryEnabled:false}));
}
check().catch(error=>{console.error(JSON.stringify({scope,status:'blocked',reason:/^APNS_[A-Z0-9_]+$/.test(error.message)?error.message:'APNS_RUNTIME_CHECK_FAILED'}));process.exitCode=1});
