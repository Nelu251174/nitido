export function profileInputError(value:unknown,firm=false):string|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return 'Date de profil invalide';
 const b=value as Record<string,unknown>;
 const fields:Record<string,number>=firm?{name:150,phone:40,coverageCity:100,coverageCitiesExtra:2000,description:1000,workingHours:200,services:400,website:200}:{name:150,email:254,phone:40};
 for(const [key,max] of Object.entries(fields))if(b[key]!=null&&(typeof b[key]!=='string'||(b[key] as string).length>max))return 'Date de profil invalide sau prea lungi';
 return null;
}
