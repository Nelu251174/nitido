// One read-only probe of a blocked profile. Emits structure/counts only, never firm data or URLs.
const Database=require('better-sqlite3');
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('ORIGIN_DELIVERY_GUARD');
const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
(async()=>{
 const page=db.prepare("SELECT p.url,p.next_attempt_at FROM marketing_directory_pages p JOIN marketing_county_jobs j ON j.id=p.job_id WHERE j.county_code='B' AND p.kind='profile' AND p.state='blocked' AND p.reason='Profilul firmei nu poate fi identificat în catalog.' LIMIT 1").get();
 if(!page){console.log('MKT_PROFILE_SHAPE '+JSON.stringify({blockedProfile:false}));return;}
 const host=db.prepare("SELECT * FROM marketing_directory_host WHERE host='https://www.ghidul.ro'").get(),at=new Date().toISOString(),u=new URL(page.url);
 if(u.origin!=='https://www.ghidul.ro'||u.search||!/^\/[^/]+\/$/.test(u.pathname))throw Error('SOURCE_URL_GUARD');
 if(page.next_attempt_at&&page.next_attempt_at>at||host?.next_attempt_at&&host.next_attempt_at>at){console.log('MKT_PROFILE_SHAPE '+JSON.stringify({sourcePauseActive:true,retryAt:page.next_attempt_at>host.next_attempt_at?page.next_attempt_at:host.next_attempt_at}));return;}
 if(!host?.robots_at||Date.parse(host.robots_at)<Date.now()-86400000)throw Error('ROBOTS_REVIEW_REQUIRED');
 if([...host.robots.matchAll(/^\s*Disallow:\s*(\S+)/gim)].some(m=>u.pathname.startsWith(m[1])))throw Error('ROBOTS_DISALLOWED');
 const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'NITIDO-Marketing/1.0 (+https://nitido.ro/contact)'}});
 if(r.status!==200){console.log('MKT_PROFILE_SHAPE '+JSON.stringify({status:r.status,retryAfter:!!r.headers.get('retry-after')}));return;}
 if(!/text\/html/i.test(r.headers.get('content-type')??''))throw Error('SOURCE_TYPE');const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>1500000)throw Error('SOURCE_TOO_LARGE');chunks.push(chunk);}const html=Buffer.concat(chunks).toString('utf8');
 const plain=s=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
 const name=html.match(/<[^>]+id=["']span_left_nume["'][^>]*>([\s\S]*?)<\//i)?.[1]??'',title=plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]??'');
 console.log('MKT_PROFILE_SHAPE '+JSON.stringify({status:r.status,bytes:size,nameElement:/id=["']span_left_nume["']/i.test(html),nameTextLength:plain(name).length,contentElement:/id=["']td_continut["']/i.test(html),headingCount:(html.match(/<h[123]\b/gi)||[]).length,profileTables:(html.match(/rubrica_firma/g)||[]).length,unavailableMessage:/(?:firma|pagina|profilul).{0,60}(?:nu (?:mai )?exist[ăa]|inactiv|indisponibil|[șs]ters)|(?:nu exist[ăa]|nu (?:mai )?este disponibil[ăa]).{0,50}(?:firma|pagina|profil)/i.test(plain(html)),titleIsError:/404|not found|eroare|inexistent/i.test(title),refreshMeta:/http-equiv=["']refresh["']/i.test(html),scriptRedirect:/(?:window\.)?location\.(?:href|replace|assign)/i.test(html)}));
})().catch(e=>{console.log('MKT_PROFILE_SHAPE_ERROR '+(/^[A-Z_]+$/.test(e.message)?e.message:String(e.cause?.code??e.code??e.name)));process.exitCode=1;}).finally(()=>db.close());
