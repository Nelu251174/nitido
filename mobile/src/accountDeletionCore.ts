type Requester = <T>(path:string, init?:RequestInit) => Promise<T>;
export interface DeletionRequest { id:string; status:'requested'|'under_review'; createdAt:string; updatedAt:string }
export interface DeletionResult { request:DeletionRequest|null; message:string; replayed?:boolean }
export const deletionStatus = (request:DeletionRequest) => request.status==='under_review'?'În analiză':'Cerere înregistrată';
export const readDeletionRequest = (request:Requester) => request<DeletionResult>('/api/account/deletion');
export async function requestAccountDeletion(request:Requester){
 const result=await request<DeletionResult>('/api/account/deletion',{method:'POST',body:JSON.stringify({confirmation:'DELETE_ACCOUNT'})});
 if(!result.request?.id||!['requested','under_review'].includes(result.request.status))throw new Error('Serverul nu a confirmat înregistrarea cererii. Reîncearcă.');
 return result;
}
