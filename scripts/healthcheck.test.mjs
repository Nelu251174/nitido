import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {checkHealth} from './healthcheck.mjs';

test('checks the local database endpoint and rejects failures without following redirects',async()=>{
 let mode='ok',redirectReached=false;
 const server=createServer((req,res)=>{
  if(req.url==='/redirect-target'){redirectReached=true;res.end('{}');return;}
  assert.equal(req.url,'/api/health');
  assert.equal(req.headers.authorization,undefined);
  if(mode==='redirect'){res.writeHead(302,{location:'/redirect-target'});res.end();return;}
  if(mode==='failure'){res.writeHead(500);res.end('private database error');return;}
  res.setHeader('content-type','application/json');
  res.end(mode==='ok'?JSON.stringify({status:'ok'}):mode==='malformed'?'not json':JSON.stringify({status:'unavailable'}));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const env={PORT:String(server.address().port)};
 try{
  await checkHealth({env});
  for(mode of ['failure','redirect','malformed','invalid'])await assert.rejects(checkHealth({env}));
  assert.equal(redirectReached,false);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 await assert.rejects(checkHealth({env}));
});
test('rejects a malformed local destination',async()=>{
 for(const PORT of ['0','65536','3000/remote','-1'])await assert.rejects(checkHealth({env:{PORT}}));
});
