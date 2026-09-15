import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAudit,runAudit} from './audit-report.mjs';
const report=(patch={})=>JSON.stringify({metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:0,...patch}}});
test('zero findings require a valid completed audit',()=>{assert.equal(parseAudit(report(),0).total,0);for(const output of ['', '{}','not JSON',JSON.stringify({error:{code:'ENOTFOUND'}})])assert.throws(()=>parseAudit(output,0));assert.throws(()=>parseAudit(report(),1));assert.throws(()=>parseAudit(report(),2));});
test('findings remain visible when npm exits one',()=>{assert.deepEqual(parseAudit(report({high:2,critical:1,total:3}),1),{info:0,low:0,moderate:0,high:2,critical:1,total:3});});
test('invalid and inconsistent counts cannot become zeros',()=>{for(const patch of [{high:'0'},{high:-1},{high:2,total:1},{total:null}])assert.throws(()=>parseAudit(report(patch),0));});
test('network failures and killed processes cannot pass',()=>{assert.throws(()=>runAudit('.',()=>({error:new Error('offline'),status:null})));assert.throws(()=>runAudit('.',()=>({signal:'SIGTERM',stdout:report(),status:0})));assert.throws(()=>runAudit('.',()=>({stdout:'{"error":{"code":"ENOAUDIT"}}',status:1})));});
