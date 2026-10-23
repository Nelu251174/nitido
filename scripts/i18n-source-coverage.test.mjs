import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const extractor=fileURLToPath(new URL('./i18n-extract.mjs',import.meta.url));
const generator=fileURLToPath(new URL('./i18n-translate.mjs',import.meta.url));
const renderer=fileURLToPath(new URL('./i18n-migrate-ui.mjs',import.meta.url));
test('rendering check finds new bare copy inside an already localized file and stays read-only',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'nitido-i18n-rendering-'));
 try{
  mkdirSync(path.join(root,'src'));
  const file=path.join(root,'src/Page.tsx');
  const source="import {UiText} from './UiText';\nexport default function Page(){return <p>Programare nouă</p>;}";
  writeFileSync(file,source);
  const run=(...args)=>spawnSync(process.execPath,[renderer,...args],{cwd:root,encoding:'utf8'});
  assert.notEqual(run('--check').status,0);
  assert.equal(readFileSync(file,'utf8'),source);
  assert.equal(run().status,0);
  const localized=readFileSync(file,'utf8');
  assert(localized.includes('<UiText text={"Programare nouă"}/>'));
  assert.equal((localized.match(/import \{UiText\}/g)||[]).length,1);
  assert.equal(run('--check').status,0);
  assert.equal(readFileSync(file,'utf8'),localized);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('source coverage rejects new copy without rewriting the released source catalog',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'nitido-i18n-coverage-'));
 try{
  mkdirSync(path.join(root,'src'));mkdirSync(path.join(root,'messages'));
  const page=path.join(root,'src/page.tsx'),source=path.join(root,'messages/ro.json');
  writeFileSync(page,'export default function Page(){return <p>Rezervare sigură</p>;}');
  writeFileSync(source,'{}');
  const run=(...args)=>spawnSync(process.execPath,[extractor,...args],{cwd:root,encoding:'utf8'});
  assert.notEqual(run('--check').status,0);assert.equal(readFileSync(source,'utf8'),'{}');
  assert.equal(run().status,0);assert.equal(run('--check').status,0);
  const before=JSON.parse(readFileSync(source,'utf8'));
  writeFileSync(page,'export default function Page(){return <><p>Programare confirmată</p><UiText text="Recenzii"/></>;}');
  assert.notEqual(run('--check').status,0);assert.deepEqual(JSON.parse(readFileSync(source,'utf8')),before);
  assert.equal(run().status,0);
  const after=JSON.parse(readFileSync(source,'utf8'));
  assert(Object.values(after).includes('Rezervare sigură'));
  assert(Object.values(after).includes('Programare confirmată'));
  assert(Object.values(after).includes('Recenzii'));
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('refresh completes exactly the selected released locales using seeded translations without provider calls',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'nitido-i18n-refresh-'));
 try{
  const source=path.join(root,'source.json'),output=path.join(root,'private'),guard=path.join(root,'no-network.mjs');mkdirSync(output);
  writeFileSync(source,JSON.stringify({greeting:'Bună ziua'}));
  writeFileSync(path.join(output,'en.json'),JSON.stringify({greeting:'Hello'}));
  writeFileSync(path.join(output,'fr.json'),JSON.stringify({greeting:'Bonjour'}));
  writeFileSync(guard,'globalThis.fetch=()=>{throw Error("Unexpected provider request");};');
  const result=spawnSync(process.execPath,['--import',guard,generator],{cwd:root,encoding:'utf8',env:{PATH:process.env.PATH,OPENAI_API_KEY:'synthetic-unused-key',NITIDO_TRANSLATION_SOURCE:source,NITIDO_TRANSLATION_OUTPUT:output,NITIDO_TRANSLATION_LOCALES:'en,fr',NITIDO_TRANSLATION_MAX_REQUESTS:'1',NITIDO_TRANSLATION_MAX_USD:'1'}});
  assert.equal(result.status,0,result.stderr);
  const manifest=JSON.parse(readFileSync(path.join(output,'manifest.json'),'utf8'));
  assert.equal(manifest.complete,true);assert.equal(manifest.languages,3);assert.deepEqual(manifest.locales,['en','fr','ro']);
  assert.equal(manifest.targetLanguages,24);
  const progress=JSON.parse(readFileSync(path.join(output,'translation-progress.json'),'utf8'));
  assert.equal(progress.requests,0);assert.equal(progress.chargedUpperUsd,0);
 }finally{rmSync(root,{recursive:true,force:true});}
});
