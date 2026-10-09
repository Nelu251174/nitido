import {pathToFileURL} from 'node:url';

// Local application + database read; never forwards credentials or follows redirects.
export async function checkHealth({env=process.env}={}){
 const port=env.PORT??'3000';
 if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw Error('PORT invalid');
 const response=await fetch(`http://127.0.0.1:${port}/api/health`,{
  redirect:'error',signal:AbortSignal.timeout(3000),headers:{'Cache-Control':'no-cache'},
 });
 if(response.status!==200)throw Error('HTTP unavailable');
 const data=await response.json();
 if(!data||data.status!=='ok')throw Error('Invalid health response');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await checkHealth();}catch{console.error('Application healthcheck failed');process.exitCode=1;}
}
