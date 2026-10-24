// Read-only public business source structure. No database or message transport.
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL))throw Error('ORIGIN_GUARD');
(async()=>{
 for(const path of ['/sumar','/firme-servicii-diverse/curatenie-servicii/','/firme-servicii-diverse/curatenie-servicii/constanta/','/crisvent/contact']){
  const url='https://www.ghidul.ro'+path,r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'NITIDO-Marketing/1.0 (+https://nitido.ro/contact)'}}),body=r.body.getReader();let n=0,parts=[];while(true){const v=await body.read();if(v.done)break;n+=v.value.length;if(n>1500000){await body.cancel();throw Error('TOO_LARGE');}parts.push(v.value);}const t=Buffer.concat(parts).toString('utf8');
  const links=[...new Set([...t.matchAll(/href=["']([^"']+)["']/g)].map(m=>m[1]))];
  const index=t.indexOf('crisvent/'),heading=t.indexOf('Contact / Harta');
  console.log(JSON.stringify({url,status:r.status,final:r.url,title:t.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],categories:links.filter(s=>/\/firme-[^/]+\/[^/]+\/$/.test(s)).length,countyLinks:links.filter(s=>/constanta|bucuresti|pagina|page|[?&]p=|\/\d+\/$/.test(s)).slice(0,16),headings:[...t.matchAll(/<h[123][^>]*>[\s\S]*?<\/h[123]>/gi)].slice(0,7).map(m=>m[0]),snippet:path==='/crisvent/contact'?t.slice(Math.max(0,heading),heading+900):index>=0?t.slice(index-700,index+900):t.match(/Pagina[\s\S]{0,1000}/)?.[0]}));
 }
})().catch(e=>{console.log('DIRECTORY_PROBE_FAILED '+e.name);process.exitCode=1;});
