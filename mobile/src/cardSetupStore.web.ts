const key=(userId:string)=>`nitido.card-setup.${userId}`;
export async function readCardSetup(userId:string){return sessionStorage.getItem(key(userId));}
export async function writeCardSetup(userId:string,id:string|null){if(id)sessionStorage.setItem(key(userId),id);else sessionStorage.removeItem(key(userId));}
