import type { JobStatus } from "./types";
type Requester=<T>(path:string,init?:RequestInit)=>Promise<T>;
export type LiveLocation={latitude:number;longitude:number;accuracy:number|null;updatedAt:string};
export type TrackingState={active:boolean;location:LiveLocation|null;status:JobStatus};
export const canShareTracking=(status:JobStatus)=>status==="arrived";
/** Cancels delayed native subscriptions and ignores callbacks from a previous job. */
export class ActiveTrackingSession {
 private generation=0;
 private subscription:{remove:()=>void}|null=null;
 private jobId:string|null=null;
 stop(){this.generation++;this.subscription?.remove();this.subscription=null;const jobId=this.jobId;this.jobId=null;return jobId;}
 async start(jobId:string,watch:(send:()=>void)=>Promise<{remove:()=>void}>,send:()=>void){
  this.stop();this.jobId=jobId;const generation=this.generation;
  try{
   const subscription=await watch(()=>{if(generation===this.generation&&this.jobId===jobId)send()});
   if(generation!==this.generation){subscription.remove();return false;}
   this.subscription=subscription;return true;
  }catch(error){if(generation===this.generation)this.stop();throw error;}
 }
}
export async function getTracking(jobId:string,request:Requester){return request<TrackingState>(`/api/jobs/${jobId}/tracking`);}
export async function updateTracking(jobId:string,coords:{latitude:number;longitude:number;accuracy?:number|null},request:Requester){return request<{ok:true}>(`/api/jobs/${jobId}/tracking`,{method:"POST",body:JSON.stringify(coords)});}
export async function stopTracking(jobId:string,request:Requester){return request<{ok:true}>(`/api/jobs/${jobId}/tracking`,{method:"DELETE"});}
export function trackingMessage(state:TrackingState|null){if(!state)return "Urmărirea nu a început.";if(state.status!=="arrived")return "Urmărirea este oprită pentru această stare a lucrării.";if(!state.active||!state.location)return "Firma nu transmite momentan locația.";return `Locație actualizată la ${new Date(state.location.updatedAt).toLocaleTimeString("ro-RO",{hour:"2-digit",minute:"2-digit"})}.`;}
