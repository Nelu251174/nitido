// Test harness only; never copied to the production runtime image.
const fs=require('node:fs');
if(process.env.NITIDO_ADMIN_EMAIL!=='owner@example.test'||process.env.RESEND_API_KEY!=='synthetic-mail-capture-only')throw Error('SYNTHETIC_CAPTURE_ONLY');
const original=globalThis.fetch;
globalThis.fetch=async function(input,options){
 const url=new URL(typeof input==='string'?input:input.url??String(input));
 if(url.origin==='https://api.resend.com'&&url.pathname==='/emails'){
  const file='/tmp/nitido-admin-reset-mail.json';let rows=[];try{rows=JSON.parse(fs.readFileSync(file,'utf8'))}catch{}
  rows.push(JSON.parse(options.body));fs.writeFileSync(file,JSON.stringify(rows),{mode:0o600});
  return new Response(JSON.stringify({id:'synthetic-mail'}),{status:200,headers:{'Content-Type':'application/json'}});
 }
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('EXTERNAL_NETWORK_FORBIDDEN');
 return original.call(this,input,options);
};
