export type VerificationStatus={verified:boolean;configured:boolean};
export function readVerificationStatus(value:unknown):VerificationStatus{
 if(!value||typeof value!=='object')throw new Error('Starea emailului nu a putut fi verificată.');
 const v=value as Record<string,unknown>;
 if(typeof v.verified!=='boolean'||typeof v.configured!=='boolean')throw new Error('Răspuns invalid pentru confirmarea emailului.');
 return {verified:v.verified,configured:v.configured};
}
export function readResendResult(value:unknown):'verified'|'accepted'{
 if(value&&typeof value==='object'){const v=value as Record<string,unknown>;if(v.verified===true)return 'verified';if(v.accepted===true)return 'accepted'}
 throw new Error('Trimiterea emailului nu a fost confirmată de server.');
}
export function verificationDescription(status:VerificationStatus){return status.verified?'Adresa de email este confirmată.':status.configured?'Confirmă adresa folosind linkul din email. Linkul este valabil 24 de ore.':'Serviciul de email nu este activ momentan. Adresa rămâne neconfirmată.'}
