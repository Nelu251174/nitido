import fs from 'node:fs';import path from 'node:path';import ts from 'typescript';
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(f.endsWith('.tsx')&&!/\/admin\/|\/Admin|\.test\./.test(f))files.push(f);}}
walk('src/app');walk('src/components');let total=0;
for(const file of files){const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
 function visit(node){
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&['toLocaleString','toLocaleDateString','toLocaleTimeString'].includes(node.expression.name.text)&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])&&node.arguments[0].text==='ro-RO'){
   const direct=ts.isJsxExpression(node.parent)&&node.parent.expression===node;
   const templateSlot=ts.isArrayLiteralExpression(node.parent)&&ts.isJsxExpression(node.parent.parent)&&ts.isJsxAttribute(node.parent.parent.parent)&&node.parent.parent.parent.name.getText(ast)==='values';
   // Only Date receivers. Number formatting has a separate contract.
   if((direct||templateSlot)&&ts.isNewExpression(node.expression.expression)&&node.expression.expression.expression.getText(ast)==='Date'){
    const kind=node.expression.name.text==='toLocaleDateString'?'date':node.expression.name.text==='toLocaleTimeString'?'time':'dateTime';
    edits.push({start:node.getStart(ast),end:node.end,text:`<UiDate value={${node.expression.expression.getText(ast)}} kind="${kind}"${node.arguments[1]?` options={${node.arguments[1].getText(ast)}}`:''}/>`});return;
   }
  }
  ts.forEachChild(node,visit);
 }visit(ast);if(!edits.length)continue;
 let next=source;for(const e of edits.sort((a,b)=>b.start-a.start))next=next.slice(0,e.start)+e.text+next.slice(e.end);
 const offset=next.startsWith("'use client';")?"'use client';".length:next.startsWith('"use client";')?'"use client";'.length:0;
 next=next.slice(0,offset)+"\nimport {UiDate} from '@/components/UiDate';\n"+next.slice(offset);
 fs.writeFileSync(file,next);total+=edits.length;
}
console.log(JSON.stringify({dateDisplays:total}));
