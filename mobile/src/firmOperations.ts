import { ApiError } from "./apiCore";
import type { Job } from "./types";

type Requester=<T>(path:string,init?:RequestInit)=>Promise<T>;
export async function acceptFirmJob(id:string,request:Requester){return request<{job:Job}>(`/api/jobs/${id}/accept`,{method:"POST"});}
export async function markFirmArrived(id:string,request:Requester){return request<{job:Job}>(`/api/jobs/${id}/arrived`,{method:"POST"});}
export async function completeFirmJob(id:string,request:Requester){return request<{job:Job}>(`/api/jobs/${id}/complete`,{method:"POST"});}
export function hasProof(job:Job|undefined,type:"ARRIVAL"|"COMPLETION"){return job?.proofs?.some(proof=>proof.type===type)??false;}
export function canStartJob(job:Job|undefined){return Boolean(job?.status==="accepted"&&hasProof(job,"ARRIVAL"));}
export function canCompleteJob(job:Job|undefined){return Boolean(job?.status==="arrived"&&hasProof(job,"COMPLETION"));}
export function firmOperationError(error:unknown){if(error instanceof ApiError){if(error.status===401)return "Sesiunea a expirat. Autentifică-te din nou.";if(error.status===409&&error.code==="ALREADY_TAKEN")return "Lucrarea a fost deja preluată de o altă firmă.";if(error.status>=500)return "Operațiunea nu a putut fi confirmată complet. Reîncarcă starea lucrării.";return error.message;}return "Conexiunea a fost întreruptă. Verifică internetul și încearcă din nou.";}
export function paymentState(job:Job){const state=job.financial;if(!state)return "Stare financiară indisponibilă";if(state.refundStatus&&state.refundStatus!=="none")return state.refundStatus==="succeeded"?"Plată rambursată":"Rambursare în procesare";if(state.payoutStatus==="failed"||state.transferStatus==="failed")return "Plată eșuată · necesită intervenție";if(state.paymentStatus==="captured"&&state.transferStatus==="processed")return state.payoutStatus==="paid"?"Plătit":"Transfer către firmă inițiat";if(state.paymentStatus==="captured"&&state.transferStatus==="blocked")return "Plată capturată · transfer blocat";if(state.paymentStatus==="captured")return "Plată capturată";if(state.paymentStatus==="authorized")return "Plată autorizată";if(state.paymentStatus==="cancelled")return "Autorizare anulată";return "Necesită verificare";}
export function navigationUrl(job:Pick<Job,"street"|"city"|"postal_code">){if(!job.street)return null;return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([job.street,job.city,job.postal_code].filter(Boolean).join(", "))}`;}
