import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export function parseAudit(stdout,status){
 if(status!==0&&status!==1)throw new Error('Audit command did not complete');
 let report;try{report=JSON.parse(stdout);}catch{throw new Error('Audit returned invalid JSON');}
 if(!report||report.error||!report.metadata?.vulnerabilities)throw new Error('Audit report is unavailable');
 const counts=report.metadata.vulnerabilities;
 for(const key of ['info','low','moderate','high','critical','total'])if(!Number.isSafeInteger(counts[key])||counts[key]<0)throw new Error('Audit report has invalid counts');
 if(counts.total!==counts.info+counts.low+counts.moderate+counts.high+counts.critical)throw new Error('Audit totals are inconsistent');
 if(status===1&&counts.total===0)throw new Error('Audit failed without a vulnerability report');
 return Object.fromEntries(['info','low','moderate','high','critical','total'].map(key=>[key,counts[key]]));
}
export function runAudit(cwd,run=spawnSync){
 const result=run('npm',['audit','--json'],{cwd,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
 if(result.error||result.signal)throw new Error('Audit could not finish; retry the security check');
 return parseAudit(result.stdout,result.status);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let failed=false;
 for(const [label,cwd] of [['website','.'],['mobile','mobile']]){
  try{const counts=runAudit(cwd);console.log(`${label}: ${JSON.stringify(counts)}`);if(counts.critical||counts.high)console.log(`::warning::${label}: ${counts.critical} critical and ${counts.high} high vulnerabilities. Review required; findings remain advisory.`);}
  catch(error){failed=true;console.error(`::error::${label}: ${error.message}. No clean result can be claimed.`);}
 }
 if(failed)process.exitCode=1;
}
