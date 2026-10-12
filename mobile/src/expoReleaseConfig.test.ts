import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {ConfigContext} from 'expo/config';
import configureApp from '../app.config';
const temporary:string[]=[];
const context:ConfigContext={projectRoot:process.cwd(),staticConfigPath:null,packageJsonPath:null,config:{name:'NITIDO',slug:'nitido-ro',plugins:[['expo-notifications',{}]]}};
afterEach(()=>{vi.unstubAllEnvs();for(const path of temporary.splice(0))rmSync(path,{recursive:true,force:true})});
describe('Expo production configuration guards',()=>{
 it('rejects sandbox, missing, insecure and credential-bearing release API URLs',()=>{
  vi.stubEnv('EAS_BUILD_PROFILE','production');vi.stubEnv('GOOGLE_SERVICES_JSON','/tmp/nonexistent-nitido-google-services.json');
  for(const url of ['', 'https://sandbox.nitido.ro','http://nitido.ro','https://secret@nitido.ro']){vi.stubEnv('EXPO_PUBLIC_NITIDO_API_BASE_URL',url);expect(()=>configureApp(context)).toThrow('production');}
  vi.stubEnv('EXPO_PUBLIC_NITIDO_API_BASE_URL','https://nitido.ro');expect(configureApp(context).plugins).toEqual([['expo-notifications',{mode:'production'}]]);
 });
 it('blocks Android EAS builds without Firebase and rejects a package mismatch',()=>{
  vi.stubEnv('EAS_BUILD','true');vi.stubEnv('EAS_BUILD_PLATFORM','android');vi.stubEnv('GOOGLE_SERVICES_JSON','/tmp/nonexistent-nitido-google-services.json');
  expect(()=>configureApp(context)).toThrow('requires');
  const directory=mkdtempSync(join(tmpdir(),'nitido-mobile-config-'));temporary.push(directory);const file=join(directory,'google-services.json');
  vi.stubEnv('GOOGLE_SERVICES_JSON',file);writeFileSync(file,JSON.stringify({client:[{client_info:{android_client_info:{package_name:'other.app'}}}]}));expect(()=>configureApp(context)).toThrow('approved Android package');
  writeFileSync(file,JSON.stringify({client:[{client_info:{android_client_info:{package_name:'ro.nitido.app'}}}]}));expect(configureApp(context).android?.googleServicesFile).toBe(file);
 });
 it('uses development APNs for development and production APNs for ad-hoc preview',()=>{vi.stubEnv('GOOGLE_SERVICES_JSON','/tmp/nonexistent-nitido-google-services.json');vi.stubEnv('EAS_BUILD_PROFILE','development');expect(configureApp(context).plugins).toEqual([['expo-notifications',{mode:'development'}]]);vi.stubEnv('EAS_BUILD_PROFILE','preview');expect(configureApp(context).plugins).toEqual([['expo-notifications',{mode:'production'}]])});
});
