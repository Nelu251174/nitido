/** Never show reverse-proxy text, HTML or JSON parser errors in Market. */
export async function readMarketingResponse<T>(response:Response):Promise<T>{
 const unavailable='Serverul este temporar indisponibil. Pagina va reîncerca automat.';
 let data:unknown;try{data=await response.json();}catch{throw new Error(unavailable);}
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error(unavailable);
 if(!response.ok){const message=(data as {error?:unknown}).error;throw new Error(typeof message==='string'?message:unavailable);}
 return data as T;
}
