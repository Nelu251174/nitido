import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.argv[2]||'messages';
const source=JSON.parse(fs.readFileSync('messages/ro.json','utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const locales=['bg','hr','cs','da','nl','en','et','fi','fr','de','el','hu','ga','it','lv','lt','mt','pl','pt','sk','sl','es','sv'];
const keys=Object.keys(source).sort();
const hash=crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
if(!manifest.complete||manifest.languages!==24||manifest.sourceHash!==hash||manifest.sourceMessages!==keys.length)throw Error('Complete catalogs matching the current UI source are required');
const tokens=text=>(text.match(/\{p\d+\}|https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+|\d+(?:[.,]\d+)*|NITIDO(?:\.RO| Pro)?|RON|Stripe|Google Play|App Store/g)||[]).sort();
for(const locale of locales){
  const catalog=JSON.parse(fs.readFileSync(path.join(root,locale+'.json'),'utf8'));
  if(JSON.stringify(Object.keys(catalog).sort())!==JSON.stringify(keys))throw Error(`Missing or extra keys in ${locale}`);
  for(const key of keys){
    const text=catalog[key];
    if(typeof text!=='string'||!text.trim()||/```|<\/?(?:script|iframe|img|style)\b/i.test(text))throw Error(`Invalid copy in ${locale}/${key}`);
    if(JSON.stringify(tokens(text))!==JSON.stringify(tokens(source[key])))throw Error(`Number, contact or placeholder changed in ${locale}/${key}`);
  }
}
console.log(JSON.stringify({complete:true,languages:24,messagesPerLanguage:keys.length}));
