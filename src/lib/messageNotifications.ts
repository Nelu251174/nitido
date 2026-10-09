import type {Database} from "better-sqlite3";
import {sendJobMessage} from "./workspace";
import {queueMessagePush} from "./push";
export function sendNotifiedJobMessage(db:Database,userId:string,jobId:string,body:unknown,requestId:unknown){
 return db.transaction(()=>{const id=sendJobMessage(db,userId,jobId,body,requestId);queueMessagePush(db,id);return id;})();
}
