import * as SecureStore from "expo-secure-store";
const key=(userId:string)=>{if(!/^[a-zA-Z0-9_-]{1,100}$/.test(userId))throw Error("Cont invalid.");return `nitido.card-setup.${userId}`;};
export const readCardSetup=(userId:string)=>SecureStore.getItemAsync(key(userId));
export const writeCardSetup=(userId:string,id:string|null)=>id?SecureStore.setItemAsync(key(userId),id,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}):SecureStore.deleteItemAsync(key(userId));
