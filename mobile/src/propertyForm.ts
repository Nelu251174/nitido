export interface EditableProperty{id?:string;name:string;city:string;street:string;sqm:number;space_type:string;kind:string;cost_center:string;budget_bani:number;notes?:string}
export type PropertyDraft={id?:string;name:string;city:string;street:string;sqm:string;space_type:string;kind:string;cost_center:string;budget:string;notes:string};
export function propertyDraft(p:EditableProperty):PropertyDraft{return {id:p.id,name:p.name,city:p.city,street:p.street,sqm:String(p.sqm),space_type:p.space_type,kind:p.kind,cost_center:p.cost_center,budget:(p.budget_bani/100).toFixed(2),notes:p.notes??''}}
export function propertyPayload(p:PropertyDraft){
 const name=p.name.trim(),city=p.city.trim(),street=p.street.trim(),budget=p.budget.trim().replace(',','.');
 if(!name||name.length>100||!city||city.length>100||!street||street.length>250)throw Error('Completează denumirea, orașul și adresa.');
 if(!/^\d+$/.test(p.sqm)||Number(p.sqm)<1||Number(p.sqm)>1000)throw Error('Suprafața trebuie să fie între 1 și 1000 m², fără zecimale.');
 if(!/^\d+(\.\d{1,2})?$/.test(budget)||Number(budget)>1000000)throw Error('Bugetul trebuie să fie între 0 și 1.000.000 RON, cu maximum două zecimale.');
 if(!['apartament','casa','birou','altul'].includes(p.space_type)||!['home','business','host'].includes(p.kind))throw Error('Tip de proprietate invalid.');
 if(p.notes.length>2000||p.cost_center.length>100)throw Error('Preferințele sau centrul de cost sunt prea lungi.');
 return {action:'property.save',...(p.id?{id:p.id}:{}),name,city,street,sqm:Number(p.sqm),space_type:p.space_type,kind:p.kind,cost_center:p.cost_center.trim(),budget_bani:Math.round(Number(budget)*100),notes:p.notes.trim()};
}
