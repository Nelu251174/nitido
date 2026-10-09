/** Keep booking/invitation context without accepting external redirects or another account's area. */
export function postAuthDestination(next:string|null,role:'client'|'firma'):string {
 const fallback=role==='client'?'/client':'/firma';
 if(!next||!next.startsWith('/')||next.startsWith('//')||/[\\\r\n]/.test(next))return fallback;
 try{
  const url=new URL(next,'https://nitido.invalid');
  if(url.origin!=='https://nitido.invalid')return fallback;
  const path=url.pathname;
  if(path===fallback||path.startsWith(fallback+'/')||['/invitatie','/echipa','/colaborari'].includes(path))return path+url.search+url.hash;
 }catch{}
 return fallback;
}
export function authSwitchHref(page:'login'|'signup',next:string|null,role:'client'|'firma'):string {
 return `/${page}?${new URLSearchParams({role,next:postAuthDestination(next,role)})}`;
}
