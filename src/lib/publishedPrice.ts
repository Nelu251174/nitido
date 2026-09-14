export interface PublishedPrice {recordedAt:string;grossBani:number;creditBani:number;clientTotalBani:number;lines:{code:string;amountBani:number}[]}
export function readPublishedPrice(raw:string|null|undefined):PublishedPrice|null {
 if(!raw)return null;
 try{
  const p=JSON.parse(raw);
  if(!p||p.currency!=='RON'||typeof p.recordedAt!=='string'||!Number.isFinite(Date.parse(p.recordedAt))||!Array.isArray(p.lines)||p.lines.length!==3)return null;
  if(![p.grossBani,p.creditBani,p.clientTotalBani].every(v=>Number.isSafeInteger(v)&&v>=0)||p.grossBani-p.creditBani!==p.clientTotalBani)return null;
  const codes=['cleaning','express60','platform_credit'];
  for(let i=0;i<3;i++){const l=p.lines[i];if(!l||l.code!==codes[i]||!Number.isSafeInteger(l.amountBani)||(i<2&&l.amountBani<0))return null}
  if(p.lines[0].amountBani+p.lines[1].amountBani!==p.grossBani||p.lines[2].amountBani!==-p.creditBani)return null;
  return p;
 }catch{return null}
}
