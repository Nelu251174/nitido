import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args=process.argv.slice(2),availableOnly=args.includes('--available');
const root=args.find(arg=>!arg.startsWith('--'))||'messages';
const source=JSON.parse(fs.readFileSync('messages/ro.json','utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const allowed=['bg','hr','cs','da','nl','en','et','fi','fr','de','el','hu','ga','it','lv','lt','mt','pl','pt','ro','sk','sl','es','sv'];
if(!Array.isArray(manifest.locales)||!manifest.locales.includes('ro')||new Set(manifest.locales).size!==manifest.locales.length||manifest.locales.some(locale=>!allowed.includes(locale))||manifest.languages!==manifest.locales.length)throw Error('A valid explicit released-language list is required');
const locales=manifest.locales.filter(locale=>locale!=='ro');
const keys=Object.keys(source).sort();
const hash=crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
if((!manifest.complete&&!availableOnly)||manifest.sourceHash!==hash||manifest.sourceMessages!==keys.length)throw Error('Complete released catalogs matching the current UI source are required');
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
console.log(JSON.stringify({complete:manifest.complete&&checked.length===locales.length,languages:checked.length+1,messagesPerLanguage:keys.length,...(availableOnly?{remainingLanguages:locales.length-checked.length,publicationAllowed:false}:{})}));
