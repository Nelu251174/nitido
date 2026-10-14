import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args=process.argv.slice(2),availableOnly=args.includes('--available');
const root=args.find(arg=>!arg.startsWith('--'))||'messages';
const source=JSON.parse(fs.readFileSync('messages/ro.json','utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const locales=['bg','hr','cs','da','nl','en','et','fi','fr','de','el','hu','ga','it','lv','lt','mt','pl','pt','sk','sl','es','sv'];
const keys=Object.keys(source).sort();
const hash=crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
if((!manifest.complete&&!availableOnly)||manifest.languages!==24||manifest.sourceHash!==hash||manifest.sourceMessages!==keys.length)throw Error('Complete catalogs matching the current UI source are required');
const tokens=(text,original=text)=>(text.match(/\{p\d+\}|https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+|\d+(?:[.,]\d+)*|NITIDO(?:\.RO| Pro)?|\bRON\b|\bEUR\b|\blei\b|\bleu\b|Stripe|Google Play|App Store/g)||[]).filter(token=>!['lei','leu'].includes(token)||new RegExp('\\b'+token+'\\b').test(original)).sort();
const checked=availableOnly?locales.filter(locale=>fs.existsSync(path.join(root,locale+'.json'))):locales;
for(const locale of checked){
  const catalog=JSON.parse(fs.readFileSync(path.join(root,locale+'.json'),'utf8'));
  if(JSON.stringify(Object.keys(catalog).sort())!==JSON.stringify(keys))throw Error(`Missing or extra keys in ${locale}`);
  for(const key of keys){
    const text=catalog[key];
    if(typeof text!=='string'||!text.trim()||/```|<\/?(?:script|iframe|img|style)\b/i.test(text))throw Error(`Invalid copy in ${locale}/${key}`);
    if(JSON.stringify(tokens(text,source[key]))!==JSON.stringify(tokens(source[key])))throw Error(`Number, contact or placeholder changed in ${locale}/${key}`);
  }
}
console.log(JSON.stringify({complete:manifest.complete&&checked.length===23,languages:checked.length+1,messagesPerLanguage:keys.length,...(availableOnly?{remainingLanguages:23-checked.length,publicationAllowed:false}:{})}));
