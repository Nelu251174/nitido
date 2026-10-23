/** Compare existing behavior with the localization-only rendering migration. */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
const files=process.argv.slice(2);
const printer=ts.createPrinter({removeComments:true});
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function behavior(source,file){
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const calls=[],attributes=[];
  function visit(node){
    if(ts.isCallExpression(node)){
      const callee=node.expression.getText(ast);
      if(/^(?:fetch|navigator\.geolocation\.|(?:stripe|stripeRef)[.\w]*\.|getCurrentUser|getUser)/.test(callee))calls.push(printer.printNode(ts.EmitHint.Unspecified,node,ast));
    }
    if(ts.isJsxAttribute(node)){
      const name=node.name.getText(ast);
      if(/^on[A-Z]/.test(name)||['name','value','defaultValue','type','checked','disabled','required','href','src','action','method','formAction','formMethod'].includes(name))attributes.push(printer.printNode(ts.EmitHint.Unspecified,node,ast));
    }
    ts.forEachChild(node,visit);
  }visit(ast);
  return {calls:calls.sort(),attributes:attributes.sort()};
}
for(const file of files){
  let original;
  if(process.env.NITIDO_I18N_BASELINE)original=fs.readFileSync(path.join(process.env.NITIDO_I18N_BASELINE,file),'utf8');
  else {try {original=execFileSync('git',['show',(process.env.NITIDO_I18N_BASE_REF||'HEAD')+':'+file],{encoding:'utf8'});} catch {throw Error('Baseline Git read unavailable; provide NITIDO_I18N_BASELINE');}}
  const before=behavior(original,file),after=behavior(fs.readFileSync(file,'utf8'),file);
  if(hash(before)!==hash(after))throw Error(`Behavior changed in ${file}; inspect before publication`);
  console.log(JSON.stringify({file,existingExternalCallsUnchanged:before.calls.length,eventAndAccessAttributesUnchanged:before.attributes.length,behaviorHash:hash(before)}));
}
