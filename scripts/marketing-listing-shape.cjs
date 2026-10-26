// Read-only diagnosis of one persisted structural failure. Emits no firm identities or emails.
const Database=require('better-sqlite3');
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL)||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('ORIGIN_DELIVERY_GUARD');
const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
(async()=>{
 const page=db.prepare("SELECT p.url,p.next_attempt_at FROM marketing_directory_pages p JOIN marketing_county_jobs j ON j.id=p.job_id WHERE j.county_code='B' AND p.kind='listing' AND p.state='blocked' AND p.reason='Datele unui rând din catalog sunt incomplete. Colectarea necesită verificare.' LIMIT 1").get();
 if(!page){console.log('MKT_LISTING_SHAPE '+JSON.stringify({found:false}));return;}
 const host=db.prepare("SELECT * FROM marketing_directory_host WHERE host='https://www.ghidul.ro'").get(),at=new Date().toISOString(),u=new URL(page.url);
 if(u.origin!=='https://www.ghidul.ro'||u.search||!u.pathname.includes('/bucuresti/'))throw Error('SOURCE_URL_GUARD');
 if(page.next_attempt_at&&page.next_attempt_at>at||host?.next_attempt_at&&host.next_attempt_at>at)throw Error('SOURCE_RETRY_PAUSE_ACTIVE');
 if(!host?.robots_at||Date.parse(host.robots_at)<Date.now()-86400000)throw Error('ROBOTS_REVIEW_REQUIRED');
 if([...host.robots.matchAll(/^\s*Disallow:\s*(\S+)/gim)].some(m=>u.pathname.startsWith(m[1])))throw Error('ROBOTS_DISALLOWED');
 const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'NITIDO-Marketing/1.0 (+https://nitido.ro/contact)'}});
 if(r.status!==200){console.log('MKT_LISTING_SHAPE '+JSON.stringify({status:r.status,retryAfter:!!r.headers.get('retry-after')}));return;}
 if(!/text\/html/i.test(r.headers.get('content-type')??''))throw Error('SOURCE_TYPE');
 const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>1500000)throw Error('SOURCE_TOO_LARGE');chunks.push(chunk);}const html=Buffer.concat(chunks).toString('utf8');
 const plain=t=>t.replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/g,' ').trim();
 const titles=[...html.matchAll(/<a\b[^>]*class=["']inscriere_titlu["'][^>]*>([\s\S]*?)<\/a>/gi)];
 const rows=titles.map((t,i)=>{const segment=html.slice(t.index,titles[i+1]?.index??html.length);return {index:i,nameLength:plain(t[1]).length,imageName:/<img/i.test(t[1]),metadata:/class=["']firma_txt["']/i.test(segment),countyComment:/<!--\s*Judet\s*-->/i.test(segment),structure:[...segment.matchAll(/<\/?(tr|td|table|a|div|span|img)\b([^>]*)>/gi)].slice(0,45).map(m=>m[0].startsWith('</')?'/'+m[1]:m[1]+(m[2].match(/class=["'](firma_txt|inscriere_titlu|rubrica_firma)["']/)?.[1]?'.'+m[2].match(/class=["'](firma_txt|inscriere_titlu|rubrica_firma)["']/)[1]:'')).join(' ')};});
 console.log('MKT_LISTING_SHAPE '+JSON.stringify({status:r.status,titles:titles.length,rows}));
})().catch(e=>{console.log('MKT_LISTING_SHAPE_ERROR '+(/^[A-Z_]+$/.test(e.message)?e.message:String(e.cause?.code??e.code??e.name)));process.exitCode=1;}).finally(()=>db.close());
