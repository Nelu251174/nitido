/** Indexarea se activează explicit numai la publicarea pe domeniul principal. */
export function siteIndexingEnabled(env:NodeJS.ProcessEnv=process.env){
 if(env.SITE_PUBLIC_INDEXING!=='true')return false;
 try{const url=new URL(env.NEXT_PUBLIC_SITE_URL??'');return url.protocol==='https:'&&['nitido.ro','www.nitido.ro'].includes(url.hostname)&&!url.username&&!url.password}catch{return false}
}
