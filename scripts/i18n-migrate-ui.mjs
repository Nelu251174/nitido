import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(f.endsWith('.tsx')&&!/\.(test|spec)\./.test(f))files.push(f);}}
walk('src');
const skip=new Set(['UiText.tsx','LanguageSelector.tsx','layout.tsx','opengraph-image.tsx','icon.tsx','apple-icon.tsx']);
let changed=0,fragments=0,attributes=0;
for(const file of files){
  if(skip.has(path.basename(file)))continue;
  const source=fs.readFileSync(file,'utf8');
  if(source.includes('import {UiText'))continue;
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const edits=[];
  let usedText=false,usedElement=false;
  function change(start,end,text){edits.push({start,end,text});}
  function display(node){
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){
      if(node.text.trim()&&/[A-Za-zĂÂÎȘȚăâîșț]/.test(node.text)){
        change(node.getStart(ast),node.end,`<UiText text={${node.getText(ast)}}/>`);usedText=true;fragments++;
      }return;
    }
    if(ts.isConditionalExpression(node)){display(node.whenTrue);display(node.whenFalse);return;}
    if(ts.isParenthesizedExpression(node)){display(node.expression);return;}
    if(ts.isBinaryExpression(node)&&[ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)){display(node.right);return;}
    // Interpolated values are not guessed or translated: migrate with named placeholders separately.
  }
  function visit(node){
    if(ts.isJsxText(node)&&node.text.trim()&&/[A-Za-zĂÂÎȘȚăâîșț]/.test(node.text)){
      // Match React JSX whitespace folding, preserving explicit fragment spaces.
      const lines=node.text.replace(/\r/g,'').split('\n');
      const text=lines.map((line,i)=>line.replace(/\t/g,' ').replace(i? /^ +/:/$^/,'').replace(i<lines.length-1?/ +$/:/$^/,'')).filter(Boolean).join(' ');
      change(node.pos,node.end,`<UiText text={${JSON.stringify(text)}}/>`);usedText=true;fragments++;return;
    }
    if(ts.isJsxExpression(node)&&node.expression && (ts.isJsxElement(node.parent)||ts.isJsxFragment(node.parent))){display(node.expression);}
    if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)){
      const open=ts.isJsxElement(node)?node.openingElement:node;
      const tag=open.tagName.getText(ast);
      const hasDisplay=open.attributes.properties.some(p=>ts.isJsxAttribute(p)&&['placeholder','title','aria-label','alt'].includes(p.name.getText(ast)));
      if(/^[a-z]/.test(tag)&&hasDisplay){
        change(open.tagName.getStart(ast),open.tagName.end,`UiElement as="${tag}"`);
        if(ts.isJsxElement(node))change(node.closingElement.tagName.getStart(ast),node.closingElement.tagName.end,'UiElement');
        usedElement=true;attributes++;
      }
    }
    ts.forEachChild(node,visit);
  }visit(ast);
  if(!edits.length)continue;
  // The display pass only changes leaf strings; avoid nested substitutions.
  const sorted=edits.sort((a,b)=>b.start-a.start);
  let output=source,last=source.length;
  for(const e of sorted){if(e.end>last)throw Error(`Overlapping edits in ${file}`);output=output.slice(0,e.start)+e.text+output.slice(e.end);last=e.start;}
  const imports=`import {${[usedText?'UiText':null,usedElement?'UiElement':null].filter(Boolean).join(',')}} from '@/components/UiText';\n`;
  const directive=/^(["']use client["'];?\s*)/.exec(output);
  const position=directive?directive[0].length:0;
  output=output.slice(0,position)+imports+output.slice(position);
  fs.writeFileSync(file,output);changed++;
}
console.log(JSON.stringify({changed,fragments,attributes}));
