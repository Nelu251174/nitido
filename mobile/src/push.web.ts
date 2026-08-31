import type {UserRole} from "./types";
export async function registerPush(){return false}
export async function unregisterCurrentPush(){}
export async function refreshRegisteredPushToken(){return false}
export function notificationRoute(role:UserRole,event:string,jobId:string){void event;return jobId?(role==="firma"?`/(firma)/job-preview/${encodeURIComponent(jobId)}`:`/(client)/job/${encodeURIComponent(jobId)}`):(role==="firma"?"/(firma)":"/(client)")}
export function useNotificationRouting(role:UserRole|null){void role;/* Native notification routing is intentionally absent on web. */}
