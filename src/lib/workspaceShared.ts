export const CHECKLIST = [
 {key:"surfaces",label:"Suprafețe și mobilier"}, {key:"kitchen",label:"Bucătărie"},
 {key:"bathroom",label:"Băi și obiecte sanitare"}, {key:"floors",label:"Aspirare și pardoseli"},
 {key:"waste",label:"Coșuri și deșeuri"}, {key:"inspection",label:"Verificare finală"},
] as const;
export const JOB_STATUS:Record<string,string>={waiting:"În așteptare",accepted:"Programată",arrived:"În lucru",completed:"Finalizată",cancelled:"Anulată",no_show:"Neprezentare"};
export const money=(lei:number)=>new Intl.NumberFormat("ro-RO",{style:"currency",currency:"RON",maximumFractionDigits:2}).format(lei);
