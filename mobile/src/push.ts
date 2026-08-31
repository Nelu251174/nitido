import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";
import type { UserRole } from "./types";

const PUSH_TOKEN_KEY="nitido.push-token.v1";
let pendingRoute:string|null=null;
export function notificationRoute(role:UserRole,event:string,jobId:string){
  if(!jobId)return role==="firma"?"/(firma)":"/(client)";
  if(role==="firma"&&event==="JOB_CREATED")return `/(firma)/job-preview/${encodeURIComponent(jobId)}`;
  if(role==="firma")return "/(firma)/active";
  return `/(client)/job/${encodeURIComponent(jobId)}`;
}
export async function registerPush(){
  if(!Device.isDevice)throw new Error("Notificările push necesită un dispozitiv fizic.");
  const permission=await Notifications.requestPermissionsAsync();if(permission.status!=="granted")return false;
  const nativeToken=await Notifications.getDevicePushTokenAsync();const token=String(nativeToken.data);
  await api("/api/push/register",{method:"POST",body:JSON.stringify({platform:Platform.OS==="ios"?"IOS":"ANDROID",deviceToken:token})});
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY,token);return true;
}
export async function unregisterCurrentPush(){const token=await SecureStore.getItemAsync(PUSH_TOKEN_KEY);if(!token)return;try{await api("/api/push/unregister",{method:"POST",body:JSON.stringify({deviceToken:token})})}finally{await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY)}}
export async function refreshRegisteredPushToken(){const previous=await SecureStore.getItemAsync(PUSH_TOKEN_KEY);if(!previous||!Device.isDevice)return false;const permission=await Notifications.getPermissionsAsync();if(permission.status!=="granted")return false;const current=String((await Notifications.getDevicePushTokenAsync()).data);if(current!==previous)await api("/api/push/unregister",{method:"POST",body:JSON.stringify({deviceToken:previous})});await api("/api/push/register",{method:"POST",body:JSON.stringify({platform:Platform.OS==="ios"?"IOS":"ANDROID",deviceToken:current})});await SecureStore.setItemAsync(PUSH_TOKEN_KEY,current);return true}
function responseData(response:Notifications.NotificationResponse){const data=response.notification.request.content.data??{};return {event:typeof data.event_type==="string"?data.event_type:"",jobId:typeof data.job_id==="string"?data.job_id:""};}
export function useNotificationRouting(role:UserRole|null){useEffect(()=>{const routeResponse=(response:Notifications.NotificationResponse)=>{const {event,jobId}=responseData(response);if(!event)return;if(!role){pendingRoute=jobId?`${event}:${jobId}`:null;router.push("/(auth)/login");return;}router.push(notificationRoute(role,event,jobId) as never);};const last=Notifications.getLastNotificationResponse();if(last)routeResponse(last);const subscription=Notifications.addNotificationResponseReceivedListener(routeResponse);if(role){void refreshRegisteredPushToken().catch(()=>undefined);if(pendingRoute){const [event,jobId]=pendingRoute.split(":");pendingRoute=null;router.push(notificationRoute(role,event,jobId) as never);}}return()=>subscription.remove()},[role])}
