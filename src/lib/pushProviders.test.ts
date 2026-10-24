import {afterEach,describe,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {generateKeyPairSync} from 'node:crypto';
import {readFileSync} from 'node:fs';
const transport=vi.hoisted(()=>({connect:vi.fn()}));
vi.mock('node:http2',()=>({default:{connect:transport.connect}}));
import {sendApns} from './pushProviders';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();vi.unstubAllGlobals();});
describe('iPhone SMS alert',()=>{
 it('requests the installed SMS sound without critical-alert or volume overrides',async()=>{
  const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  vi.stubEnv('APNS_PRIVATE_KEY',privateKey.export({type:'pkcs8',format:'pem'}).toString());
  vi.stubEnv('APNS_USE_SANDBOX','false');vi.stubEnv('APNS_KEY_ID','test-key');vi.stubEnv('APNS_TEAM_ID','test-team');vi.stubEnv('APNS_BUNDLE_ID','ro.nitido.app');
  const request=new EventEmitter() as EventEmitter&{end:ReturnType<typeof vi.fn>};
  request.end=vi.fn(()=>queueMicrotask(()=>{request.emit('response',{':status':200,'apns-id':'synthetic-id'});request.emit('end');}));
  const client=new EventEmitter() as EventEmitter&{request:ReturnType<typeof vi.fn>;close:ReturnType<typeof vi.fn>;destroy:ReturnType<typeof vi.fn>};
  client.request=vi.fn(()=>request);client.close=vi.fn();client.destroy=vi.fn();transport.connect.mockReturnValue(client);
  await expect(sendApns('synthetic-token',{title:'Message',body:'Test only',data:{event_type:'MESSAGE_RECEIVED',job_id:'test-job'}})).resolves.toEqual({providerMessageId:'synthetic-id'});
  const payload=JSON.parse(request.end.mock.calls[0][0]);
  expect(payload.aps).toEqual({alert:{title:'Message',body:'Test only'},sound:'nitido_sms_v1.wav'});
  expect(payload.job_id).toBe('test-job');expect(client.close).toHaveBeenCalledOnce();
 });
 it('ships the short SMS sound at a strong, unclipped level and retains the separate web alert',()=>{
  const native=readFileSync('ios/App/App/nitido_alert_v2.wav');
  expect(native.equals(readFileSync('public/sounds/nitido_alert_v2.wav'))).toBe(false);
  expect(native.toString('ascii',0,4)).toBe('RIFF');expect(native.toString('ascii',8,12)).toBe('WAVE');
  expect(native.readUInt16LE(20)).toBe(1);expect(native.readUInt16LE(22)).toBe(1);expect(native.readUInt16LE(34)).toBe(16);
  const samples=(native.length-44)/2, rate=native.readUInt32LE(24);
  expect(samples/rate).toBe(.9);
  let peak=0,sum=0;for(let i=44;i<native.length;i+=2){const v=native.readInt16LE(i)/32767;peak=Math.max(peak,Math.abs(v));sum+=v*v;}
  expect(peak).toBeGreaterThan(.88);expect(peak).toBeLessThan(.9);expect(Math.sqrt(sum/samples)).toBeGreaterThan(.17);
  const project=readFileSync('ios/App/App.xcodeproj/project.pbxproj','utf8');
  expect(project).toContain('path = nitido_alert_v2.wav;');
  const resources=project.split('/* Begin PBXResourcesBuildPhase section */')[1].split('/* End PBXResourcesBuildPhase section */')[0];
  expect(resources).toContain('nitido_alert_v2.wav in Resources');
 });
});
describe('APNs connection and token safety',()=>{
 function setup(status=200,reason='',id='test-receipt'){
  const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  vi.stubEnv('APNS_PRIVATE_KEY',privateKey.export({type:'pkcs8',format:'pem'}).toString());vi.stubEnv('APNS_KEY_ID','test-key');vi.stubEnv('APNS_TEAM_ID','test-team');vi.stubEnv('APNS_BUNDLE_ID','ro.nitido.app');vi.stubEnv('APNS_USE_SANDBOX','false');
  const req=Object.assign(new EventEmitter(),{end:vi.fn(),destroy:vi.fn()});
  const client=Object.assign(new EventEmitter(),{request:vi.fn(()=>req),close:vi.fn(),destroy:vi.fn()});
  req.end.mockImplementation(()=>queueMicrotask(()=>{req.emit('response',{':status':status,'apns-id':id});if(reason)req.emit('data',JSON.stringify({reason}));req.emit('end')}));transport.connect.mockReturnValue(client);return {req,client};
 }
 const payload={title:'Test',body:'Synthetic only',data:{event_type:'MESSAGE_RECEIVED',job_id:'synthetic'}};
 it('requires an explicit APNs environment before opening any connection',async()=>{setup();vi.stubEnv('APNS_USE_SANDBOX','');await expect(sendApns('synthetic',payload)).rejects.toMatchObject({message:'APNS_NOT_CONFIGURED'});expect(transport.connect).not.toHaveBeenCalled()});
 it.each(['BadTopic','InvalidProviderToken','ExpiredProviderToken'])('keeps a device registered after configuration rejection %s',async reason=>{setup(400,reason);await expect(sendApns('synthetic',payload)).rejects.toMatchObject({message:'APNS_TEMPORARY_FAILURE',permanent:false})});
 it.each(['BadDeviceToken','Unregistered'])('recognizes an explicit invalid-device reason %s',async reason=>{setup(410,reason);await expect(sendApns('synthetic',payload)).rejects.toMatchObject({message:'PUSH_TOKEN_INVALID',permanent:true})});
 it('does not report delivery without a provider receipt',async()=>{setup(200,'','');await expect(sendApns('synthetic',payload)).rejects.toMatchObject({permanent:false})});
 it('closes failed request streams instead of leaking connections or raising an unhandled error',async()=>{const {req,client}=setup();req.end.mockImplementation(()=>queueMicrotask(()=>req.emit('error',Error('synthetic private error'))));await expect(sendApns('synthetic',payload)).rejects.toMatchObject({message:'APNS_TEMPORARY_FAILURE'});expect(client.destroy).toHaveBeenCalledOnce();expect(req.destroy).toHaveBeenCalledOnce()});
});

describe('FCM token safety and receipts',()=>{
 async function sender(){vi.resetModules();const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});vi.stubEnv('FIREBASE_PROJECT_ID','synthetic-project');vi.stubEnv('FIREBASE_CLIENT_EMAIL','synthetic@example.invalid');vi.stubEnv('FIREBASE_PRIVATE_KEY',privateKey.export({type:'pkcs8',format:'pem'}).toString());return (await import('./pushProviders')).sendFcm}
 const payload={title:'Test',body:'Synthetic only',data:{event_type:'MESSAGE_RECEIVED'}};
 function responses(status:number,body:unknown){vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({access_token:'synthetic-oauth-token',expires_in:3600})).mockResolvedValueOnce(Response.json(body,{status})))}
 it.each([404,400])('does not revoke a token for an HTTP %s project/payload configuration failure',async status=>{const send=await sender();responses(status,{error:{status:'INVALID_ARGUMENT',details:[{errorCode:'INVALID_ARGUMENT'}]}});await expect(send('synthetic-token',payload)).rejects.toMatchObject({permanent:false})});
 it('revokes only an explicit unregistered token',async()=>{const send=await sender();responses(404,{error:{details:[{errorCode:'UNREGISTERED'}]}});await expect(send('synthetic-token',payload)).rejects.toMatchObject({message:'PUSH_TOKEN_INVALID',permanent:true})});
 it('requires a real project-scoped message receipt before reporting provider acceptance',async()=>{const send=await sender();responses(200,{});await expect(send('synthetic-token',payload)).rejects.toMatchObject({permanent:false})});
 it('preserves a confirmed provider message identifier',async()=>{const send=await sender();responses(200,{name:'projects/synthetic-project/messages/one'});await expect(send('synthetic-token',payload)).resolves.toEqual({providerMessageId:'projects/synthetic-project/messages/one'})});
});
