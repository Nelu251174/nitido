type Requester = <T>(path:string, init?:RequestInit) => Promise<T>;
export async function requestPasswordRecovery(email:string,request:Requester){
 const normalized=email.trim().toLowerCase();
 if(normalized.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))throw new Error('Introdu o adresă de email validă.');
 const result=await request<{ok:boolean;message:string}>('/api/auth/forgot-password',{method:'POST',body:JSON.stringify({email:normalized})});
 if(result.ok!==true||typeof result.message!=='string'||!result.message.trim())throw new Error('Cererea nu a fost confirmată. Reîncearcă.');
 return result.message;
}
