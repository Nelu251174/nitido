import type {UserRole} from "./types";
export const roleHome=(role:UserRole)=>role==="client"?"/(client)":"/(firma)";
export function canAccessRoleRoute(role:UserRole,path:string){if(path.startsWith("/(client)"))return role==="client";if(path.startsWith("/(firma)"))return role==="firma";return true}
