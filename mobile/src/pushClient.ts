import {revokePushRegistration} from "./pushSettingsCore";
import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";
import type { UserRole } from "./types";

const PUSH_TOKEN_KEY="nitido.push-token.v1";
let pendingResponse:{event:string;jobId:string}|null=null;
let lastHandledResponse:string|null=null;
export function notificationRoute(role:UserRole,event:string,jobId:string){
  if(!jobId)return role==="firma"?"/(firma)":"/(client)";
  if(role==="firma"&&event==="JOB_CREATED")return `/(firma)/job-preview/${encodeURIComponent(jobId)}`;
  if(role==="firma")return "/(firma)/active";
  return `/(client)/job/${encodeURIComponent(jobId)}`;
}
export async function registerPush(){
  if(!Device.isDevice)throw new Error("Notificările push necesită un dispozitiv fizic.");
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('default',{name:'Lucrări NITIDO',importance:Notifications.AndroidImportance.DEFAULT});
  const permission=await Notifications.requestPermissionsAsync();if(permission.status!=="granted")return false;
  const nativeToken=await Notifications.getDevicePushTokenAsync();const token=String(nativeToken.data);
  const result=await api<{ok:boolean}>("/api/push/register",{method:"POST",body:JSON.stringify({platform:Platform.OS==="ios"?"IOS":"ANDROID",deviceToken:token})});
  if(result.ok!==true)throw new Error("Serverul nu a confirmat înregistrarea telefonului.");
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY,token);return true;
}
export async function currentPushSettings(){const [token,permission]=await Promise.all([SecureStore.getItemAsync(PUSH_TOKEN_KEY),Notifications.getPermissionsAsync()]);return {registeredLocally:Boolean(token),permissionGranted:permission.status==="granted"};}
export async function unregisterCurrentPush(){const token=await SecureStore.getItemAsync(PUSH_TOKEN_KEY);await revokePushRegistration(token,api,()=>SecureStore.deleteItemAsync(PUSH_TOKEN_KEY));}
export async function refreshRegisteredPushToken(){
 const previous=await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
 if(!previous||!Device.isDevice)return false;
 const permission=await Notifications.getPermissionsAsync();if(permission.status!=="granted")return false;
 const current=String((await Notifications.getDevicePushTokenAsync()).data);
 if(current!==previous)await revokePushRegistration(previous,api,async()=>{});
 const result=await api<{ok:boolean}>("/api/push/register",{method:"POST",body:JSON.stringify({platform:Platform.OS==="ios"?"IOS":"ANDROID",deviceToken:current})});
 if(result?.ok!==true)throw new Error("Serverul nu a confirmat înregistrarea telefonului.");
 await SecureStore.setItemAsync(PUSH_TOKEN_KEY,current);return true;
}
function responseData(response:Notifications.NotificationResponse){const data=response.notification.request.content.data??{};return {event:typeof data.event_type==="string"?data.event_type:"",jobId:typeof data.job_id==="string"?data.job_id:""};}
export function useNotificationRouting(role:UserRole|null){useEffect(()=>{
 const allowed=(event:string)=>role==='firma'?event==='JOB_CREATED':['JOB_ACCEPTED','JOB_ARRIVED','JOB_COMPLETED'].includes(event);
 const navigate=(data:{event:string;jobId:string})=>{if(role&&allowed(data.event))router.push(notificationRoute(role,data.event,data.jobId) as never);};
 const routeResponse=(response:Notifications.NotificationResponse)=>{
  const data=responseData(response);
  if(!['JOB_CREATED','JOB_ACCEPTED','JOB_ARRIVED','JOB_COMPLETED'].includes(data.event)||!data.jobId)return;
  const key=JSON.stringify([response.notification.request.identifier,response.actionIdentifier,data.event,data.jobId]);
  if(key===lastHandledResponse)return;
  lastHandledResponse=key;
  Notifications.clearLastNotificationResponse();
  if(!role){pendingResponse=data;router.push('/(auth)/login');return;}
  navigate(data);
 };
 if(role&&pendingResponse){const data=pendingResponse;pendingResponse=null;navigate(data);}
 const last=Notifications.getLastNotificationResponse();if(last)routeResponse(last);
 const subscription=Notifications.addNotificationResponseReceivedListener(routeResponse);
 if(role)void refreshRegisteredPushToken().catch(()=>undefined);
 return()=>subscription.remove();
},[role])}
