import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
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
      const ownText=ts.isJsxExpression(node.parent)&&ts.isJsxAttribute(node.parent.parent)&&node.parent.parent.name.getText(ast)==='text';
      if(ownText)add(node.text,file,'ui-copy');
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
fs.mkdirSync('messages',{recursive:true});
fs.writeFileSync('messages/ro.json',JSON.stringify(Object.fromEntries(Object.entries(catalog).sort()),null,2)+'\n');
fs.mkdirSync('.translation-work',{recursive:true});
fs.writeFileSync('.translation-work/sources.json',JSON.stringify(uses,null,2)+'\n');
console.log(JSON.stringify({messages:Object.keys(catalog).length,characters:Object.values(catalog).reduce((n,s)=>n+s.length,0),files:all.length}));
