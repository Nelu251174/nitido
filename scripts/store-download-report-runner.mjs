import {collectStoreReports} from './store-download-reports.mjs';
import {ownerRequest} from './owner-notifications-runner.mjs';
try{
 if(process.env.NITIDO_OWNER_DOWNLOAD_REPORTS_ENABLED!=='true')throw Error('DOWNLOAD_REPORTS_NOT_ENABLED');
 const payload=await collectStoreReports();
 const result=await ownerRequest(payload);
 console.log(JSON.stringify({...result,reportsReady:payload.reports.filter(r=>r.status==='ready').length,reportsPending:payload.reports.filter(r=>r.status==='pending').length,reportsBlocked:payload.reports.filter(r=>r.status==='blocked').length}));
}catch(error){console.error(error.message);process.exitCode=1;}
