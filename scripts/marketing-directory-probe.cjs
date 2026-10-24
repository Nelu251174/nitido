// Read-only inspection of public business directory structure and robots rules.
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL))throw Error('ORIGIN_GUARD');
(async()=>{
 for(const url of ['https://www.ghidul.ro/robots.txt','https://m.ghidul.ro/robots.txt','https://www.ghidul.ro/','https://www.ghidul.ro/vanzari-produse-servicii/lucrari-si-servicii/constanta/','https://www.ghidul.ro/crisvent/']){
  const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'NITIDO-Marketing/1.0 (+https://nitido.ro/contact)'}});
  const body=r.body.getReader();let n=0,parts=[];while(true){const v=await body.read();if(v.done)break;n+=v.value.length;if(n>1500000){await body.cancel();throw Error('TOO_LARGE');}parts.push(v.value);}const t=Buffer.concat(parts).toString('utf8');
  const links=[...new Set([...t.matchAll(/href=["']([^"']+)["']/g)].map(m=>m[1]))];
  console.log(JSON.stringify({url,status:r.status,final:r.url,title:t.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],robots:url.endsWith('robots.txt')?t.slice(0,1600):undefined,links:links.filter(s=>/constanta|bucuresti|vanzari-produse|pagina|page|mailto|crisvent|m\.ghidul/.test(s)).slice(0,120),text:url.includes('crisvent')?t.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,4500):undefined}));
 }
})().catch(e=>{console.log('DIRECTORY_PROBE_FAILED '+e.name);process.exitCode=1;});
