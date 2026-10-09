import type {Database} from 'better-sqlite3';
export interface SignupRecords {
 userId:string;role:'client'|'firma';name:string;email:string;phone:string;passwordHash:string;referralCode:string;
 referrer:{id:string;code:string}|null;bonus:number;
 firm?:{id:string;cui:string;city:string;citiesExtra:string|null;verified:boolean};
}
export function persistSignup(db:Database,input:SignupRecords){
 if((input.role==='firma')!==Boolean(input.firm))throw new Error('Date firmă incomplete');
 if(!Number.isSafeInteger(input.bonus)||input.bonus<0)throw new Error('Bonus invalid');
 return db.transaction(()=>{
  db.prepare('INSERT INTO users(id,role,name,email,phone,password_hash,referral_code,referred_by_code,credit_balance) VALUES(?,?,?,?,?,?,?,?,?)').run(input.userId,input.role,input.name,input.email,input.phone,input.passwordHash,input.referralCode,input.referrer?.code??null,input.referrer?input.bonus:0);
  if(input.referrer){const changed=db.prepare('UPDATE users SET credit_balance=credit_balance+? WHERE id=? AND referral_code=?').run(input.bonus,input.referrer.id,input.referrer.code);if(changed.changes!==1)throw new Error('Recomandare indisponibilă');}
  if(input.firm){const f=input.firm;db.prepare('INSERT INTO firms(id,user_id,cui,coverage_city,coverage_cities_extra,verified) VALUES(?,?,?,?,?,?)').run(f.id,input.userId,f.cui,f.city,f.citiesExtra,f.verified?1:0)}
 })();
}
export function signupInputError(body:unknown):string|null{
 if(!body||typeof body!=='object'||Array.isArray(body))return 'Date de înregistrare invalide';
 const b=body as Record<string,unknown>;
 for(const [key,max] of [['name',150],['email',254],['password',1024],['phone',40],['role',10]] as const)if(typeof b[key]!=='string'||!(b[key] as string).trim()||(b[key] as string).length>max)return 'Completează corect numele, emailul, parola, telefonul și rolul';
 for(const [key,max] of [['cui',40],['coverageCity',100],['coverageCitiesExtra',2000],['referralCode',100]] as const)if(b[key]!=null&&(typeof b[key]!=='string'||(b[key] as string).length>max))return 'Date opționale invalide sau prea lungi';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((b.email as string).trim()))return 'Adresa de email este invalidă';
 return null;
}
