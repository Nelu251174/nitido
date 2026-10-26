// Owner-authorized Marketing release checkpoint. Read-only source DB; no application initializers.
const fs=require('node:fs/promises'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto'),Database=require('better-sqlite3');
(async()=>{
 const origin=process.env.NEXT_PUBLIC_SITE_URL;
 if(origin!=='https://sandbox.nitido.ro'&&!(origin==='https://nitido.ro'&&process.argv.includes('--live')))throw Error('CHECKPOINT_ORIGIN_GUARD');
 if(process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true')throw Error('MARKETING_DELIVERY_MUST_BE_OFF');
 const root=path.join('/app/data/release-checkpoints','20261025-marketing-source-'+randomUUID());await fs.mkdir(root,{recursive:true,mode:0o700});
 const source=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true}),file=path.join(root,'nitido.db');
 try{await source.backup(file);}finally{source.close();}
 await fs.chmod(file,0o600);const restored=new Database(file,{readonly:true,fileMustExist:true});
 try{if(restored.pragma('quick_check',{simple:true})!=='ok')throw Error('CHECKPOINT_INTEGRITY_FAILED');}finally{restored.close();}
 const result={status:'passed',scope:origin.includes('sandbox')?'sandbox':'live',createdAt:new Date().toISOString(),databaseSha256:createHash('sha256').update(await fs.readFile(file)).digest('hex'),restorePolicy:'Isolated verification only. Keep current data volumes; never overwrite a running database.'};
 await fs.writeFile(path.join(root,'verification.json'),JSON.stringify(result),{flag:'wx',mode:0o600});console.log('MKT_CHECKPOINT '+JSON.stringify(result));
})().catch(error=>{console.error(/^[A-Z_]+$/.test(error.message)?error.message:'CHECKPOINT_FAILED');process.exitCode=1;});
