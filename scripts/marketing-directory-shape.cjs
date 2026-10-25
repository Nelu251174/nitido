// Sandbox-only, read-only structural probe. Logs counts and county labels, never business identities/emails.
if(process.env.NEXT_PUBLIC_SITE_URL!=='https://sandbox.nitido.ro'||process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('SANDBOX_DELIVERY_GUARD');
const origin='https://www.ghidul.ro',pathname='/firme-afaceri/audit-contabili/constanta/';
async function read(path,max){const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'NITIDO-Marketing/1.0 (+https://nitido.ro/contact)'}});const parts=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>max)throw Error('PAGE_TOO_LARGE');parts.push(chunk);}return {status:r.status,text:Buffer.concat(parts).toString('utf8')};}
function plain(text){return text.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();}
(async()=>{
 const robots=await read('/robots.txt',100000);if(robots.status!==200||/<(?:html|!doctype)/i.test(robots.text))throw Error('ROBOTS_UNAVAILABLE');
 if([...robots.text.matchAll(/^Disallow:\s*(\S+)/gim)].some(m=>pathname.startsWith(m[1])))throw Error('ROBOTS_DISALLOWED');
 const {status,text}=await read(pathname,1500000);if(status!==200){console.log('MKT_DIRECTORY_SHAPE '+JSON.stringify({status}));return;}
 const pages=t=>[...new Set([...t.matchAll(/href=["']([^"']*\/pag-\d+\/)["']/gi)].map(m=>m[1]))].filter(x=>x.startsWith(origin+pathname));
 const counties=[...text.matchAll(/<!--\s*Judet\s*-->([\s\S]*?)<!--\s*Afisari\s*-->/gi)].map(m=>plain(m[1]).replace(/[|]/g,'').trim());
 const grouped=Object.fromEntries([...new Set(counties)].map(c=>[c,counties.filter(v=>v===c).length]));
 console.log('MKT_DIRECTORY_SHAPE '+JSON.stringify({status,declaredCounts:[...plain(text).matchAll(/\b(\d[\d.,]*)\s+firme\b/gi)].map(m=>m[1]),tables:(text.match(/class=["']rubrica_firma["']/gi)||[]).length,titles:(text.match(/class=["']inscriere_titlu["']/gi)||[]).length,counties:grouped,pages:pages(text),paginationPages:pages(text.match(/<ul[^>]*class=["']all_pages["'][^>]*>[\s\S]*?<\/ul>/i)?.[0]||'')}));
})().catch(e=>{console.log('MKT_DIRECTORY_SHAPE_ERROR '+(/^[A-Z_]+$/.test(e.message)?e.message:String(e.cause?.code??e.code??e.name)));process.exitCode=1;});
