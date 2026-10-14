import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(f.endsWith('.tsx')&&!/\.(test|spec)\./.test(f))files.push(f);}}
walk('src');let count=0;
for(const file of files){
  if(file.endsWith('/UiText.tsx')||file.endsWith('/LanguageSelector.tsx')||file.endsWith('/layout.tsx'))continue;
  const source=fs.readFileSync(file,'utf8');
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
  function template(node){
    if(ts.isTemplateExpression(node)){
      let text=node.head.text;const values=[];
      for(const span of node.templateSpans){text+=`{p${values.length}}`+span.literal.text;values.push(span.expression.getText(ast));}
      if(!/[ĂÂÎȘȚăâîșț]|[A-Za-z]{2}/.test(text.replace(/\{p\d+\}/g,'')))return;
      edits.push({start:node.getStart(ast),end:node.end,text:`<UiTemplate text={${JSON.stringify(text)}} values={[${values.join(',')}]}/>`});count++;return;
    }
    if(ts.isConditionalExpression(node)){template(node.whenTrue);template(node.whenFalse);}
    else if(ts.isParenthesizedExpression(node))template(node.expression);
    else if(ts.isBinaryExpression(node)&&[ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind))template(node.right);
  }
  function visit(node){
    if(ts.isJsxExpression(node)&&node.expression&&(ts.isJsxElement(node.parent)||ts.isJsxFragment(node.parent)))template(node.expression);
    ts.forEachChild(node,visit);
  }visit(ast);
  if(!edits.length)continue;
  let output=source,last=source.length;
  for(const e of edits.sort((a,b)=>b.start-a.start)){if(e.end>last)throw Error('Overlapping template edits');output=output.slice(0,e.start)+e.text+output.slice(e.end);last=e.start;}
  if(output.includes("from '@/components/UiText'"))output=output.replace(/import \{([^}]+)\} from '@\/components\/UiText';/,(_,names)=>`import {${names},UiTemplate} from '@/components/UiText';`);
  else{const directive=/^(["']use client["'];?\s*)/.exec(output);const pos=directive?.[0].length||0;output=output.slice(0,pos)+"import {UiTemplate} from '@/components/UiText';\n"+output.slice(pos);}
  fs.writeFileSync(file,output);
}
console.log(JSON.stringify({templates:count}));
