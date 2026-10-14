/** Offline catalog generation. Run only in an operator-authorized environment
 * with its existing provider credential; never expose or export that credential.
 * The only provider input/output is source-owned UI copy from messages/ro.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const targets = ['bg','hr','cs','da','nl','en','et','fi','fr','de','el','hu','ga','it','lv','lt','mt','pl','pt','sk','sl','es','sv'];
const names={bg:'Bulgarian',hr:'Croatian',cs:'Czech',da:'Danish',nl:'Dutch',en:'English',et:'Estonian',fi:'Finnish',fr:'French',de:'German',el:'Greek',hu:'Hungarian',ga:'Irish',it:'Italian',lv:'Latvian',lt:'Lithuanian',mt:'Maltese',pl:'Polish',pt:'Portuguese',sk:'Slovak',sl:'Slovenian',es:'Spanish',sv:'Swedish'};
const sourceFile=process.env.NITIDO_TRANSLATION_SOURCE || 'messages/ro.json';
const output=process.env.NITIDO_TRANSLATION_OUTPUT || '.translation-work';
if(/(?:^|\/)(?:public|uploads)(?:\/|$)/.test(output))throw Error('Translation checkpoints must stay in a private directory');
const source=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
const sourceHash=crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
fs.mkdirSync(output,{recursive:true});
// One resumable generator per checkpoint directory, including budget accounting.
const lockFile=path.join(output,'.translation.lock');
const lock=fs.openSync(lockFile,'wx');
fs.writeFileSync(lock, String(process.pid));fs.closeSync(lock);
process.on('exit',()=>{try{fs.unlinkSync(lockFile);}catch{/* Stopped process may need operator cleanup. */}});
const progressFile=path.join(output,'translation-progress.json');
const model='gpt-5.4-mini';
const state=fs.existsSync(progressFile)?JSON.parse(fs.readFileSync(progressFile,'utf8')):{sourceHash,model,requests:0,inputTokens:0,outputTokens:0,chargedUpperUsd:0,completed:[],failures:[]};
if(state.sourceHash!==sourceHash)throw Error('Source changed: use a new output directory');
if(state.model!==model)throw Error('Model changed: use a new output directory');
if(!Number.isFinite(state.chargedUpperUsd)||state.chargedUpperUsd<0)throw Error('Invalid persisted budget state');
const credential=process.env.OPENAI_API_KEY?.trim();
if(!credential)throw Error('Translation provider is not configured');
// Cap every attempt, including retries. No automatic top-up or new service.
const maxRequests=Number(process.env.NITIDO_TRANSLATION_MAX_REQUESTS || 1800);
const maxTokens=Number(process.env.NITIDO_TRANSLATION_MAX_TOKENS || 6000000);
if(!Number.isSafeInteger(maxRequests)||maxRequests<1||maxRequests>1800||!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>6000000)throw Error('Invalid request/token cap');
const maxUsd=Number(process.env.NITIDO_TRANSLATION_MAX_USD || 20);
if(!Number.isFinite(maxUsd)||maxUsd<=0||maxUsd>20)throw Error('Approved API budget must be between 0 and 20 USD');
// Standard API prices verified 2026-10-14. No tools or regional endpoint.
// https://developers.openai.com/api/docs/models/gpt-5.4-mini
const inputUsdPerToken=0.75/1000000,outputUsdPerToken=4.5/1000000;
const selected=(process.env.NITIDO_TRANSLATION_LOCALES || targets.join(',')).split(',');
if(selected.some(locale=>!targets.includes(locale)))throw Error('Unsupported translation locale');
const atomic=(file,data)=>{fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(file+'.tmp',file);};
const save=()=>atomic(progressFile,state);
const entries=Object.entries(source);
const batches=[];
for(let offset=0;offset<entries.length;){const batch=[];let chars=0;while(offset<entries.length&&batch.length<65&&(chars<7000||!batch.length)){const item=entries[offset++];batch.push(item);chars+=item[1].length;}batches.push(batch);}

function protectedTokens(text) {
  return (text.match(/\{p\d+\}|https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+|\d+(?:[.,]\d+)*|NITIDO(?:\.RO| Pro)?|RON|Stripe|Google Play|App Store/g)||[]).sort();
}
function validate(result,batch) {
  if(!result||typeof result!=='object'||Array.isArray(result)||Object.keys(result).length!==batch.length)throw Error('Translation count mismatch');
  for(const [id,original] of batch){
    const translated=result[id];
    if(typeof translated!=='string'||!translated.trim()||translated.length>original.length*8+200)throw Error('Invalid translation');
    if(JSON.stringify(protectedTokens(original))!==JSON.stringify(protectedTokens(translated)))throw Error('Protected number, brand or contact changed');
    if(translated.includes('```'))throw Error('Unexpected markup');
  }
}
async function translate(locale) {
  const file=path.join(output,`${locale}.json`);
  const catalog=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
  for(const fullBatch of batches){
    const batch=fullBatch.filter(([id])=>!catalog[id]);
    if(!batch.length)continue;
    let success=false;
    for(let attempt=0;attempt<3&&!success;attempt++){
      if(state.requests>=maxRequests||state.inputTokens+state.outputTokens>=maxTokens)throw Error('Translation budget limit reached');
      try{
        const schema={type:'object',properties:Object.fromEntries(batch.map(([id])=>[id,{type:'string'}])),required:batch.map(([id])=>id),additionalProperties:false};
        const payload={model,store:false,max_output_tokens:12000,reasoning:{effort:'none'},
          instructions:`Translate this Romanian cleaning marketplace's UI copy into ${names[locale]}. Use clear, natural, professional wording. This is a Romanian service with a multilingual interface, not a claim of service coverage abroad. Preserve every numeric token exactly (including decimal separators), currency RON, percentages, URLs, emails, IDs, and the brands NITIDO, NITIDO.RO, NITIDO Pro, Stripe, Google Play, App Store, Standard, Express and Express 60. Preserve placeholder tokens and punctuation structure. Translate all readable words, including short fragments, error messages, accessibility labels and legal copy; do not add explanations, promises or features. Keep fragments short enough for mobile controls. Each input key must occur exactly once in the output.`,
          input:JSON.stringify(Object.fromEntries(batch)),text:{format:{type:'json_schema',name:'ui_translations',strict:true,schema}}};
        const wire=JSON.stringify(payload);
        // Reserve an upper estimate BEFORE dispatch (including concurrent work).
        // Unknown/aborted responses retain their full reservation on disk.
        const reserved=(Buffer.byteLength(wire,'utf8')+8192)*inputUsdPerToken+payload.max_output_tokens*outputUsdPerToken;
        if(state.chargedUpperUsd+reserved>maxUsd)throw Error('Approved API cost limit reached');
        state.requests++;state.chargedUpperUsd+=reserved;save();
        const response=await fetch('https://api.openai.com/v1/responses',{
          method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),
          body:wire});
        if(!response.ok)throw Error(`Translation provider HTTP ${response.status}`);
        const body=await response.json();
        const usage=body.usage;
        if(usage&&Number.isSafeInteger(usage.input_tokens)&&usage.input_tokens>=0&&Number.isSafeInteger(usage.output_tokens)&&usage.output_tokens>=0){
          state.inputTokens+=usage.input_tokens;state.outputTokens+=usage.output_tokens;
          state.chargedUpperUsd+=usage.input_tokens*inputUsdPerToken+usage.output_tokens*outputUsdPerToken-reserved;
        }
        save();
        if(body.status!=='completed')throw Error('Incomplete provider output');
        const raw=body.output_text||body.output?.flatMap(item=>item.content||[]).find(item=>item.type==='output_text')?.text;
        const result=JSON.parse(raw);validate(result,batch);
        Object.assign(catalog,result);atomic(file,catalog);success=true;
      }catch(error){
        // Only our safe error labels are recorded, never provider bodies/keys.
        const message=error instanceof Error?error.message:'Translation failed';
        if(message==='Approved API cost limit reached')throw error;
        state.failures.push({locale,attempt,message:message.slice(0,150)});save();
        if(attempt<2)await new Promise(resolve=>setTimeout(resolve,2000*(attempt+1)));
      }
    }
    if(!success)throw Error(`Translation failed for ${locale}; checkpoints are resumable`);
  }
  validate(catalog,entries);
  if(!state.completed.includes(locale))state.completed.push(locale);
  save();console.log(JSON.stringify({locale,messages:Object.keys(catalog).length}));
}
// Limit provider load. Other app traffic keeps using its normal AI settings.
const queue=[...selected];
await Promise.all(Array.from({length:Math.min(3,queue.length)},async()=>{while(queue.length){await translate(queue.shift());}}));
const complete=targets.every(locale=>state.completed.includes(locale));
atomic(path.join(output,'manifest.json'),{complete,languages:24,sourceLanguage:'ro',sourceMessages:entries.length,sourceHash,provider:'OpenAI',model,review:'machine translation; specialist legal review pending'});
console.log(JSON.stringify({complete,requests:state.requests,tokens:state.inputTokens+state.outputTokens}));
