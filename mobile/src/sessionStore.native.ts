import * as SecureStore from "expo-secure-store";
const SESSION_KEY="nitido.session.v1";
export const nativeSessionRequired=true;
export function getSessionToken(){return SecureStore.getItemAsync(SESSION_KEY)}
export async function setSessionToken(token:string|null){if(token)await SecureStore.setItemAsync(SESSION_KEY,token,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});else await SecureStore.deleteItemAsync(SESSION_KEY)}
