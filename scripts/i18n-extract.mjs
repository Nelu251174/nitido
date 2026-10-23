import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const checkOnly = process.argv.includes('--check');
const all = [];
function walk(dir) { for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
  const file=path.join(dir,entry.name);
  if (entry.isDirectory()) walk(file);
  else if (/\.tsx?$/.test(file) && !/\.(test|spec)\./.test(file) && !file.includes('/i18n/')) all.push(file);
}}
walk(path.join(root,'src'));
const norm = value => value.replace(/\s+/g,' ').trim();
function key(value) {let a=0x811c9dc5,b=0x9e3779b9;for(const c of norm(value)){a=Math.imul(a^c.codePointAt(0),0x01000193);b=Math.imul(b^c.codePointAt(0),0x85ebca6b);}return `t${(a>>>0).toString(16)}_${(b>>>0).toString(16)}`;}
const catalog={},uses={};
function add(text,file,kind) {
  const source=norm(text);
  if(!source || !/[A-Za-zĂÂÎȘȚăâîșț]/.test(source) || source.includes('\u0000') || /^(?:NITIDO(?:\.RO| Pro)?|Nit|ido|\.RO)$/i.test(source)) return;
  const id=key(source);
  if(catalog[id]&&catalog[id]!==source)throw Error('Catalog key collision');
  catalog[id]=source;
  (uses[id]??=[]).push({file:path.relative(root,file),kind});
}
function human(text) {
  if(text.length>4000 || /(?:https?:|SELECT |INSERT |UPDATE |CREATE |DELETE |ALTER |<\/?\w|\$\{|@|\/api\/)/.test(text))return false;
  return /[ĂÂÎȘȚăâîșț]/.test(text) || /^[A-Z][a-z]+(?: [A-Za-z0-9]+){1,20}[.!?:…]?$/.test(text);
}
for(const file of all){
  // Operator/admin/security instructions are outside the customer-language release.
  if(/\/admin\/|\/Admin[^/]*\.tsx$|\/admin[^/]*\.ts$|\/security\.ts$|\/supportAi\.ts$|\/db\.ts$/.test(file))continue;
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  function visit(node){
    if(ts.isJsxText(node))add(node.text,file,'jsx');
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){
      const attr=ts.isJsxAttribute(node.parent)?node.parent.name.getText(ast):null;
      const ownText=attr==='text'||ts.isJsxExpression(node.parent)&&ts.isJsxAttribute(node.parent.parent)&&node.parent.parent.name.getText(ast)==='text';
      const explicitTranslation=ts.isCallExpression(node.parent)&&node.parent.arguments[0]===node&&ts.isIdentifier(node.parent.expression)&&node.parent.expression.text==='ui';
      if(ownText||explicitTranslation)add(node.text,file,'ui-copy');
      else if(attr && ['placeholder','title','aria-label','alt','label','description','emptyText','eyebrow','intro','hint','helperText'].includes(attr))add(node.text,file,'attribute');
      else if(human(node.text))add(node.text,file,'owned-copy');
    }
    if(ts.isTemplateExpression(node)){
      // Source literals only. Values (names, addresses, job data) are never sent.
      let text=node.head.text;let index=0;
      for(const part of node.templateSpans)text+=`{p${index++}}`+part.literal.text;
      if(human(text.replace(/\{p\d+\}/g,'')))add(text,file,'template-copy');
    }
    ts.forEachChild(node,visit);
  }visit(ast);
}
// Keep a reproducible, sorted source catalog; paths are audit data, never user data.
// Short mapped labels need an explicit source list: syntax cannot distinguish
// an English-looking Romanian label from a technical identifier.
if(fs.existsSync('messages/extra-source.json'))for(const label of JSON.parse(fs.readFileSync('messages/extra-source.json','utf8'))){
  if(typeof label!=='string'||!label.trim())throw Error('Invalid curated UI label');
  add(label,path.join(root,'messages/extra-source.json'),'curated-ui-label');
}
fs.mkdirSync('messages',{recursive:true});
const sourcePath=path.join(root,'messages/ro.json');
const existing=fs.existsSync(sourcePath)?JSON.parse(fs.readFileSync(sourcePath,'utf8')):{};
const missing=Object.keys(catalog).filter(id=>existing[id]!==catalog[id]);
if(checkOnly){
  if(missing.length){
    console.error(JSON.stringify({missingSourceMessages:missing.length,samples:missing.slice(0,12).map(id=>({id,uses:uses[id]}))}));
    process.exitCode=1;
  }else console.log(JSON.stringify({sourceCoverageComplete:true,extractedMessages:Object.keys(catalog).length,catalogMessages:Object.keys(existing).length}));
}else{
  // Keep curated/dynamic copy already released; extraction is additive.
  for(const [id,text] of Object.entries(existing))if(key(text)!==id||catalog[id]&&catalog[id]!==text)throw Error('Invalid existing source catalog entry');
  fs.writeFileSync(sourcePath,JSON.stringify(Object.fromEntries(Object.entries({...existing,...catalog}).sort()),null,2)+'\n');
}
fs.mkdirSync('.translation-work',{recursive:true});
fs.writeFileSync('.translation-work/sources.json',JSON.stringify(uses,null,2)+'\n');
if(!checkOnly)console.log(JSON.stringify({messages:Object.keys({...existing,...catalog}).length,added:missing.length,extractedMessages:Object.keys(catalog).length,characters:Object.values(catalog).reduce((n,s)=>n+s.length,0),files:all.length}));
