import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {hasTrustedMutationOrigin,consumeRateLimit,tokenHash} from '@/lib/security';
import {ownScopePhotos,claimScopeRun,saveScopeDraft,validateScopeSuggestion,PHOTO_SCOPE_FORMAT,PHOTO_SCOPE_INSTRUCTIONS,PhotoScopeError} from '@/lib/photoScope';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const reply=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'private, no-store'}});
const config=()=>({enabled:process.env.NITIDO_AI_ENABLED?.trim().toLowerCase()==='true',key:process.env.OPENAI_API_KEY?.trim()??'',model:process.env.NITIDO_AI_MODEL?.trim()||'gpt-5-mini'});
export async function GET(req:NextRequest){const u=await getCurrentUser(req);if(!u||u.role!=='client')return reply({error:'Autentificare client necesară'},401);const c=config();return reply({aiAvailable:c.enabled&&!!c.key,maxPhotos:5,maxDescription:500});}
export async function POST(req:NextRequest){
 const u=await getCurrentUser(req);if(!u||u.role!=='client')return reply({error:'Autentificare client necesară'},401);if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă'},403);
 const raw=await req.text();if(raw.length>5000)return reply({error:'Cerere prea mare'},413);let b;try{b=JSON.parse(raw);}catch{return reply({error:'Cerere invalidă'},400);}if(!b||typeof b!=='object')return reply({error:'Cerere invalidă'},400);
 try{
  if(b.action==='confirm')return reply({ok:true,draftId:saveScopeDraft(db,u.id,b)},201);
  if(b.action!=='analyze'||b.consent!==true)throw new PhotoScopeError('Confirmă acordul pentru analiza fotografiilor.');
  const photos=ownScopePhotos(db,u.id,b.photoIds),c=config();if(!c.enabled||!c.key)return reply({error:'Analiza AI este momentan indisponibilă. Poți folosi fotografiile și o descriere scrisă de tine.',aiAvailable:false},503);
  const run=claimScopeRun(db,u.id,b.requestKey,photos.map(p=>p.id));if(run.result)return reply({suggestion:run.result,replayed:true});
  if(!consumeRateLimit('photo-analysis:'+u.id,8,3600000)){db.prepare("UPDATE photo_scope_runs SET status='failed' WHERE user_id=? AND request_key=?").run(u.id,b.requestKey);return reply({error:'Ai atins limita de 8 analize într-o oră. Poți continua manual.'},429);}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
   const content:({type:'input_text';text:string}|{type:'input_image';image_url:string;detail:'low'})[]=[{type:'input_text',text:'Propune o descriere prudentă a curățeniei pentru spațiile vizibile. Rezultatul va fi verificat de client.'}];
   for(const p of photos){if(path.basename(p.filename)!==p.filename||p.file_size>8*1024*1024)throw new PhotoScopeError('Fotografie invalidă.');const image=await sharp(await fs.readFile(path.join(process.cwd(),'data','uploads',p.filename)),{limitInputPixels:40_000_000}).rotate().resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).jpeg({quality:75}).toBuffer();content.push({type:'input_image',detail:'low',image_url:'data:image/jpeg;base64,'+image.toString('base64')});}
   const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+c.key,'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({model:c.model,store:false,max_output_tokens:2000,instructions:PHOTO_SCOPE_INSTRUCTIONS,text:{format:PHOTO_SCOPE_FORMAT},input:[{role:'user',content}],safety_identifier:tokenHash(u.id).slice(0,64)})});
   if(!response.ok)throw new PhotoScopeError('Analiza nu a reușit. Fotografiile și descrierea ta sunt păstrate; poți reîncerca sau continua manual.',502);
   const result=await response.json() as {output_text?:string;output?:{content?:{type?:string;text?:string}[]}[]};const text=result.output_text??result.output?.flatMap(o=>o.content??[]).find(c=>c.type==='output_text')?.text;let parsed;try{parsed=JSON.parse(text??'');}catch{throw new PhotoScopeError('Răspunsul AI este incomplet. Poți continua manual.',502);}const suggestion=validateScopeSuggestion(parsed);
   db.prepare("UPDATE photo_scope_runs SET status='done',result_json=? WHERE user_id=? AND request_key=?").run(JSON.stringify(suggestion),u.id,b.requestKey);return reply({suggestion});
  }catch(e){db.prepare("UPDATE photo_scope_runs SET status='failed' WHERE user_id=? AND request_key=?").run(u.id,b.requestKey);throw e;}finally{clearTimeout(timer);}
 }catch(e){return reply({error:e instanceof PhotoScopeError?e.message:'Operația nu a reușit. Datele completate rămân disponibile.'},e instanceof PhotoScopeError?e.status:503);}
}
