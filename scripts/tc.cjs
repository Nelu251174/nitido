// Owner-authorized catalog refresh. Only repository-owned UI copy is processed.
const fs=require('node:fs/promises');
const sync=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {spawn}=require('node:child_process');
const {gzipSync}=require('node:zlib');
const revision=process.env.NITIDO_I18N_REV;
if(!/^[a-f0-9]{40}$/.test(revision||''))throw Error('INVALID_TRANSLATION_REVISION');
if(process.env.NEXT_PUBLIC_SITE_URL!=='https://sandbox.nitido.ro')throw Error('TRANSLATION_REQUIRES_SANDBOX');
const baseline='e8877140d5b9c969826536e901129cf1e5b63dab';
const locales=['bg','hr','cs','da','nl','en','fr','de'];
const directory='/app/data/translation-work/20261023-released-'+revision.slice(0,12);
const digest=value=>createHash('sha256').update(value).digest('hex');
function report(value){
 const line=JSON.stringify({marker:'NITIDO_I18N_REFRESH_V1',revision,...value});
 console.log(line);sync.appendFileSync('/proc/1/fd/1',line+'\n');
}
async function download(ref,file){
 const response=await fetch(`https://raw.githubusercontent.com/Nelu251174/nitido/${ref}/${file}`,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('TRANSLATION_SOURCE_DOWNLOAD_'+response.status);
 return response.text();
}
async function main(){
 const mode=process.argv[1];
 if(mode==='status'){
   const progress=JSON.parse(await fs.readFile(path.join(directory,'translation-progress.json'),'utf8'));
   report({event:'status',requests:progress.requests,inputTokens:progress.inputTokens,outputTokens:progress.outputTokens,chargedUpperUsd:progress.chargedUpperUsd,completed:progress.completed,last429Code:progress.last429Code,last429Reason:progress.last429Reason,failures:progress.failures?.length||0});return;
 }
 if([...locales,'ro','manifest'].includes(mode)){
   const ready=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
   if(!ready.complete||ready.languages!==9)throw Error('TRANSLATION_EXPORT_NOT_READY');
   const content=await fs.readFile(path.join(directory,mode+'.json'));
   const packed=gzipSync(content).toString('base64');
   const total=Math.ceil(packed.length/7000),sha256=digest(content);
   for(let part=0;part<total;part++)report({event:'export',locale:mode,part,total,sha256,data:packed.slice(part*7000,(part+1)*7000)});
   return;
 }
 if(mode)throw Error('INVALID_TRANSLATION_ACTION');
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 if(sync.existsSync(path.join(directory,'.translation.lock')))throw Error('TRANSLATION_ALREADY_RUNNING');
 const source=JSON.parse(await download(revision,'messages/ro.json'));
 const sourceFile=path.join(directory,'source-ro.json');
 await fs.writeFile(sourceFile,JSON.stringify(source),{mode:0o600});
 const reused={};
 for(const locale of locales){
   const file=path.join(directory,locale+'.json');
   if(!sync.existsSync(file)){
     const released=JSON.parse(await download(baseline,'messages/'+locale+'.json'));
     const selected=Object.fromEntries(Object.keys(source).filter(id=>typeof released[id]==='string'&&released[id].trim()).map(id=>[id,released[id]]));
     await fs.writeFile(file,JSON.stringify(selected,null,2)+'\n',{mode:0o600});
   }
   reused[locale]=Object.keys(JSON.parse(await fs.readFile(file,'utf8'))).length;
 }
 const generator=path.join(directory,'generator.mjs');
 await fs.writeFile(generator,await download(revision,'scripts/i18n-translate.mjs'),{mode:0o600});
 report({event:'started',messages:Object.keys(source).length,reused,locales,maxUsd:5});
 const child=spawn(process.execPath,[generator],{cwd:directory,stdio:'inherit',env:{...process.env,
   NITIDO_TRANSLATION_SOURCE:sourceFile,NITIDO_TRANSLATION_OUTPUT:directory,
   NITIDO_TRANSLATION_LOCALES:locales.join(','),NITIDO_TRANSLATION_MAX_USD:'5',
   NITIDO_TRANSLATION_MAX_REQUESTS:'250',NITIDO_TRANSLATION_MAX_TOKENS:'2000000',
   NITIDO_TRANSLATION_CONCURRENCY:'3'}});
 const status=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve(code??1));});
 const progress=JSON.parse(await fs.readFile(path.join(directory,'translation-progress.json'),'utf8'));
 if(status!==0){report({event:'stopped',exitCode:status,last429Code:progress.last429Code,last429Reason:progress.last429Reason,completed:progress.completed,chargedUpperUsd:progress.chargedUpperUsd});process.exitCode=status;return;}
 const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
 if(!manifest.complete||manifest.languages!==9||manifest.sourceHash!==digest(JSON.stringify(source)))throw Error('TRANSLATION_MANIFEST_MISMATCH');
 await fs.writeFile(path.join(directory,'ro.json'),JSON.stringify(source,null,2)+'\n',{mode:0o600});
 report({event:'completed',messages:Object.keys(source).length,languages:manifest.languages,requests:progress.requests,chargedUpperUsd:progress.chargedUpperUsd});
}
main().catch(error=>{report({event:'failed',error:error instanceof Error?error.message:'TRANSLATION_FAILED'});process.exitCode=1;});
