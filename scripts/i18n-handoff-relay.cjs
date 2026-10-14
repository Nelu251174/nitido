/** Relay only ciphertext through the public logs explicitly approved by the owner. */
const fs=require('node:fs'),path=require('node:path');
module.exports=async function({core}){
 const artifact=require(path.resolve('.translation-tools/node_modules/@actions/artifact/lib/artifact.js')).default;
 let found;
 for(let attempt=0;attempt<20;attempt++){
  try{found=await artifact.getArtifact('nitido-private-job-handoff');if(found.artifact?.id)break;}catch{/* Wait for the parallel producer to finish its handoff upload. */}
  await new Promise(resolve=>setTimeout(resolve,10000));
 }
 if(!found?.artifact?.id)throw Error('Encrypted handoff artifact is not ready');
 const output=path.resolve('.encrypted-handoff-relay');await artifact.downloadArtifact(found.artifact.id,{path:output});
 const ciphertext=fs.readFileSync(output+'/task.enc.json','utf8');if(JSON.parse(ciphertext).algorithm!=='RSA-OAEP-SHA256/AES-256-GCM')throw Error('Handoff encryption is required');
 core.info('NITIDO_ENCRYPTED_HANDOFF:'+ciphertext);
};
