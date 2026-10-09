export interface PublishedPrice {recordedAt:string;grossBani:number;creditBani:number;clientTotalBani:number;lines:{code:string;amountBani:number}[]}
export function readPublishedPrice(raw:string|null|undefined):PublishedPrice|null {
 if(!raw)return null;
 try{
  const p=JSON.parse(raw);
  if(!p||p.currency!=='RON'||typeof p.recordedAt!=='string'||!Number.isFinite(Date.parse(p.recordedAt))||!Array.isArray(p.lines)||![3,4].includes(p.lines.length))return null;
  if(![p.grossBani,p.creditBani,p.clientTotalBani].every(v=>Number.isSafeInteger(v)&&v>=0)||p.grossBani-p.creditBani!==p.clientTotalBani)return null;
  const codes=p.lines.length===4?['cleaning','windows','express60','platform_credit']:['cleaning','express60','platform_credit'];
  for(let i=0;i<codes.length;i++){const l=p.lines[i];if(!l||l.code!==codes[i]||!Number.isSafeInteger(l.amountBani)||(i<codes.length-1&&l.amountBani<0))return null}
  if(p.lines.slice(0,-1).reduce((n:number,l:{amountBani:number})=>n+l.amountBani,0)!==p.grossBani||p.lines.at(-1).amountBani!==-p.creditBani)return null;
  return p;
 }catch{return null}
}
