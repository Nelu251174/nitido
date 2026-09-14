import type {ExecutionReport} from './business';
export function executionCsv(report:ExecutionReport){
 const cell=(value:unknown)=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'};
 const rows=[['Lucrare','Finalizată (UTC)','Oraș','Adresă','Suprafață m²','Tip spațiu','Firmă','Valoare lucrare RON'],...report.rows.map(r=>[r.jobId,r.completedAt,r.city,r.street,r.sqm,r.spaceType,r.firmName,r.priceGross])];
 return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n');
}
export const validReportMonth=(value:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
