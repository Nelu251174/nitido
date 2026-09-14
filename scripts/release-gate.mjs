import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export const GATES=['staging_configuration','stripe_sandbox_lifecycle','physical_devices','authenticated_dashboards','financial_reconciliation','infrastructure_restore','production_approval'];
export function evaluateRelease(record,sha){
 const blockers=[];
 if(!/^[a-f0-9]{40}$/.test(sha??''))blockers.push('INVALID_CANDIDATE');
 if(record?.schemaVersion!==1||record?.candidateSha!==sha)blockers.push('CANDIDATE_MISMATCH');
 if(record?.ci?.sha!==sha||record?.ci?.status!=='pass'||!validEvidence(record?.ci?.evidence))blockers.push('CURRENT_CI_NOT_PROVEN');
 const gates=Array.isArray(record?.gates)?record.gates:[];
 for(const id of GATES){
   const matches=gates.filter(gate=>gate?.id===id),gate=matches[0];
   if(matches.length!==1||gate.status!=='pass'||gate.sha!==sha||typeof gate.owner!=='string'||!gate.owner.trim()||!validEvidence(gate.evidence)||typeof gate.checkedAt!=='string'||!Number.isFinite(Date.parse(gate.checkedAt))||Date.parse(gate.checkedAt)>Date.now())blockers.push(id);
 }
 return {candidateSha:sha,decision:blockers.length?'NO_GO':'GO',blockers};
}
function validEvidence(value){return Array.isArray(value)&&value.length>0&&value.every(item=>typeof item==='string'&&item.trim().length>0&&!/^(pending|todo|tbd|n\/a)$/i.test(item.trim()));}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
   const file=process.argv[2];if(!file||process.argv.length!==3)throw Error('Usage: node scripts/release-gate.mjs EVIDENCE.json');
   const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
   const record=JSON.parse(await readFile(file,'utf8'));
   const result=evaluateRelease(record,sha);
   // A dirty checkout cannot use evidence for the committed candidate.
   if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()){result.blockers.push('UNCOMMITTED_CHANGES');result.decision='NO_GO';}
   console.log(JSON.stringify(result,null,2));if(result.decision!=='GO')process.exitCode=1;
 }catch{console.error('Release evidence could not be validated. NO_GO.');process.exitCode=1;}
}
