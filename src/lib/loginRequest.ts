type Role = 'client' | 'firma';
type Credentials = {email:string;password:string;role:Role};
const incomplete = 'Conexiunea nu permite verificarea contului. Reîncearcă.';

async function readJson(response:Response):Promise<Record<string,unknown>|null> {
  try {
    const value:unknown = await response.json();
    return value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : null;
  } catch { return null; }
}

/** A lost login response may still have set its HttpOnly session cookie. */
async function confirmedSession(input:Credentials,fetcher:typeof fetch):Promise<{role:Role}|null> {
  try {
    const response = await fetcher('/api/auth/me',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!response.ok)return null;
    const data=await readJson(response),user=data?.user;
    if(!user||typeof user!=='object')return null;
    const current=user as Record<string,unknown>;
    if(typeof current.id==='string'&&typeof current.email==='string'&&current.email.trim().toLowerCase()===input.email.trim().toLowerCase()&&current.role===input.role)return {role:input.role};
  } catch { /* Never infer authentication from a failed session check. */ }
  return null;
}

/** Retry one transient response only; never retry rejected credentials or rate limits. */
export async function requestLogin(input:Credentials,fetcher:typeof fetch=fetch):Promise<{role:Role}> {
  for(let attempt=0;attempt<2;attempt++) {
    let response:Response;
    try {
      response=await fetcher('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),body:JSON.stringify(input)});
    } catch {
      const session=await confirmedSession(input,fetcher);
      if(session)return session;
      if(attempt===0)continue;
      throw new Error(incomplete);
    }
    const data=await readJson(response);
    if(response.ok&&data?.ok===true&&data.role===input.role)return {role:input.role};
    // A 4xx response is authoritative even when an intermediary truncated its body.
    if(response.status>=400&&response.status<500)throw new Error(typeof data?.error==='string'?data.error:'Eroare la autentificare');
    const session=await confirmedSession(input,fetcher);
    if(session)return session;
    if(attempt===1)throw new Error(typeof data?.error==='string'?data.error:incomplete);
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw new Error(incomplete);
}
