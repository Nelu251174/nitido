import {afterEach,describe,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {generateKeyPairSync} from 'node:crypto';
import {readFileSync} from 'node:fs';
const transport=vi.hoisted(()=>({connect:vi.fn()}));
vi.mock('node:http2',()=>({default:{connect:transport.connect}}));
import {sendApns} from './pushProviders';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
describe('custom iPhone alert',()=>{
 it('sends the bundled sound through APNs without critical-alert or volume overrides',async()=>{
  const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  vi.stubEnv('APNS_PRIVATE_KEY',privateKey.export({type:'pkcs8',format:'pem'}).toString());
  vi.stubEnv('APNS_KEY_ID','test-key');vi.stubEnv('APNS_TEAM_ID','test-team');vi.stubEnv('APNS_BUNDLE_ID','ro.nitido.app');
  const request=new EventEmitter() as EventEmitter&{end:ReturnType<typeof vi.fn>};
  request.end=vi.fn(()=>queueMicrotask(()=>{request.emit('response',{':status':200,'apns-id':'synthetic-id'});request.emit('end');}));
  const client=new EventEmitter() as EventEmitter&{request:ReturnType<typeof vi.fn>;close:ReturnType<typeof vi.fn>;destroy:ReturnType<typeof vi.fn>};
  client.request=vi.fn(()=>request);client.close=vi.fn();client.destroy=vi.fn();transport.connect.mockReturnValue(client);
  await expect(sendApns('synthetic-token',{title:'Message',body:'Test only',data:{event_type:'MESSAGE_RECEIVED',job_id:'test-job'}})).resolves.toEqual({providerMessageId:'synthetic-id'});
  const payload=JSON.parse(request.end.mock.calls[0][0]);
  expect(payload.aps).toEqual({alert:{title:'Message',body:'Test only'},sound:'nitido_alert_v2.wav'});
  expect(payload.job_id).toBe('test-job');expect(client.close).toHaveBeenCalledOnce();
 });
 it('ships matching PCM previews and a short, unclipped iPhone bundle resource',()=>{
  const native=readFileSync('ios/App/App/nitido_alert_v2.wav');
  expect(native.equals(readFileSync('public/sounds/nitido_alert_v2.wav'))).toBe(true);
  expect(native.toString('ascii',0,4)).toBe('RIFF');expect(native.toString('ascii',8,12)).toBe('WAVE');
  expect(native.readUInt16LE(20)).toBe(1);expect(native.readUInt16LE(22)).toBe(1);expect(native.readUInt16LE(34)).toBe(16);
  const samples=(native.length-44)/2, rate=native.readUInt32LE(24);
  expect(samples/rate).toBeGreaterThan(1.5);expect(samples/rate).toBeLessThan(30);
  let peak=0,sum=0;for(let i=44;i<native.length;i+=2){const v=native.readInt16LE(i)/32767;peak=Math.max(peak,Math.abs(v));sum+=v*v;}
  expect(peak).toBeGreaterThan(.9);expect(peak).toBeLessThan(1);expect(Math.sqrt(sum/samples)).toBeGreaterThan(.35);
  const project=readFileSync('ios/App/App.xcodeproj/project.pbxproj','utf8');
  expect(project).toContain('path = nitido_alert_v2.wav;');
  const resources=project.split('/* Begin PBXResourcesBuildPhase section */')[1].split('/* End PBXResourcesBuildPhase section */')[0];
  expect(resources).toContain('nitido_alert_v2.wav in Resources');
 });
});
