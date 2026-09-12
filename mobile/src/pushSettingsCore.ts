export type PushAccountStatus={pushEnabled:boolean;activeDevices:number};
export function readPushAccountStatus(value:unknown):PushAccountStatus{
 if(!value||typeof value!=='object')throw new Error('Statusul notificărilor nu poate fi verificat.');
 const data=value as {pushEnabled?:unknown;devices?:unknown};
 if(typeof data.pushEnabled!=='boolean'||!Array.isArray(data.devices))throw new Error('Statusul notificărilor nu poate fi verificat.');
 const devices=data.devices as {push_enabled?:unknown;revoked_at?:unknown}[];
 if(devices.some(d=>!d||typeof d!=='object'||![0,1].includes(d.push_enabled as number)||(d.revoked_at!==null&&typeof d.revoked_at!=='string')))throw new Error('Lista dispozitivelor nu poate fi verificată.');
 return {pushEnabled:data.pushEnabled,activeDevices:devices.filter(d=>d.push_enabled===1&&d.revoked_at===null).length};
}
export async function revokePushRegistration(token:string|null,request:(path:string,init:RequestInit)=>Promise<unknown>,forget:()=>Promise<void>){
 if(!token)return;
 const result=await request('/api/push/unregister',{method:'POST',body:JSON.stringify({deviceToken:token})});
 if(!result||typeof result!=='object'||(result as {ok?:unknown}).ok!==true)throw new Error('Serverul nu a confirmat dezactivarea. Reîncearcă.');
 await forget();
}
