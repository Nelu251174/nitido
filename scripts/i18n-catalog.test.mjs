import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const validator=fileURLToPath(new URL('./i18n-validate.mjs',import.meta.url));
const locales=['bg','hr','cs','da','nl','en','et','fi','fr','de','el','hu','ga','it','lv','lt','mt','pl','pt','sk','sl','es','sv'];
// Synthetic copy exercises financial/data invariants, not translation quality.
const source={booking:'Curățenie între rezervări',estimator:'ESTIMATOR LIVE',law:'În condițiile legii.',price:'Preț: 100 RON (100 lei).',contact:'Contact support@nitido.ro — NITIDO.RO {p0}'};
const translated={booking:'KORISTUS BRONEERINGUTE VAHEL',estimator:'ESTIMATEUR EN DIRECT',law:'Nos termos da lei.',price:'Price: 100 RON (100 lei).',contact:'Contact support@nitido.ro — NITIDO.RO {p0}'};
function check(change,released=[...locales,'ro'],omit){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nitido-catalog-invariants-'));
 try{
  const messages=path.join(root,'messages');fs.mkdirSync(messages);
  const write=(name,value)=>fs.writeFileSync(path.join(messages,name),JSON.stringify(value));
  write('ro.json',source);
  write('manifest.json',{complete:true,languages:released.length,locales:released,sourceMessages:Object.keys(source).length,sourceHash:crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex')});
  for(const locale of locales)if(locale!==omit)write(locale+'.json',translated);
  if(change)write('fr.json',change({...translated}));
  return spawnSync(process.execPath,[validator],{cwd:root,encoding:'utf8'});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('ordinary EUR/RON letter sequences and Portuguese legal lei do not masquerade as currencies',()=>{
 const result=check();assert.equal(result.status,0,result.stderr);
});
test('a complete nine-language release does not depend on deferred catalogs',()=>{
 const result=check(null,['bg','hr','cs','da','nl','en','fr','de','ro'],'it');assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).languages,9);
});
test('publication rejects an absent catalog declared in the release',()=>{assert.notEqual(check(null,['en','fr','ro'],'fr').status,0);});
test('publication rejects duplicate or unsupported release languages',()=>{
 for(const released of [['en','en','ro'],['../../private','ro']])assert.notEqual(check(null,released).status,0);
});
for(const [name,change] of [
 ['changed payment currency',copy=>({...copy,price:'Price: 100 EUR (100 lei).'})],
 ['changed amount',copy=>({...copy,price:'Price: 200 RON (100 lei).'})],
 ['changed Romanian currency unit',copy=>({...copy,price:'Price: 100 RON (100 euros).'})],
 ['changed contact',copy=>({...copy,contact:'Contact other@example.test — NITIDO.RO {p0}'})],
 ['missing runtime slot',copy=>({...copy,contact:'Contact support@nitido.ro — NITIDO.RO'})],
 ['missing source key',copy=>{delete copy.booking;return copy;}],
])test('catalog publication rejects '+name,()=>{assert.notEqual(check(change).status,0);});
