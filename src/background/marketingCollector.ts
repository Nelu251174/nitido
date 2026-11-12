import Database from 'better-sqlite3';
import {marketingEnabled} from '../lib/adminMarketing';
import {startMarketingCollectionScheduler} from '../lib/adminMarketingCollector';

let db:Database.Database|undefined;
let keepAlive:ReturnType<typeof setInterval>|undefined;
const shutdown=(code=0)=>{
 if(keepAlive)clearInterval(keepAlive);
 try{db?.close();}catch{}
 process.exit(code);
};
process.once('SIGTERM',()=>shutdown());
process.once('SIGINT',()=>shutdown());
process.once('disconnect',()=>shutdown());
process.once('uncaughtException',()=>{console.error('[marketing] collector_uncaught_failure');shutdown(1);});
process.once('unhandledRejection',()=>{console.error('[marketing] collector_unhandled_failure');shutdown(1);});

try{
 if(!marketingEnabled())shutdown();
 const filename=process.argv[2];
 if(!filename||filename===':memory:')throw Error('COLLECTOR_DATABASE_REQUIRED');
 // The web process initializes the existing schema before starting this child.
 db=new Database(filename,{fileMustExist:true});
 db.pragma('journal_mode = WAL');
 db.pragma('foreign_keys = ON');
 keepAlive=setInterval(()=>{},60000);
 startMarketingCollectionScheduler(db);
 process.send?.({type:'marketing-collector-ready'});
}catch{console.error('[marketing] collector_boot_failed');shutdown(1);}
