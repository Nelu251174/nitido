import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const files=[];
const checkOnly=process.argv.includes('--check');
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(f.endsWith('.tsx')&&!/\.(test|spec)\./.test(f))files.push(f);}}
walk('src');
const skip=new Set(['UiText.tsx','LanguageSelector.tsx','layout.tsx','opengraph-image.tsx','icon.tsx','apple-icon.tsx']);
let changed=0,fragments=0,attributes=0;
for(const file of files){
  if(skip.has(path.basename(file))||/\/admin\/|\/Admin[^/]*\.tsx$/.test(file))continue;
  const source=fs.readFileSync(file,'utf8');
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const displayComponents=new Set(ast.statements.filter(node=>ts.isImportDeclaration(node)&&['next/image','next/link'].includes(node.moduleSpecifier.text)&&node.importClause?.name).map(node=>node.importClause.name.text));
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
    if(ts.isJsxElement(node)&&['script','style','code','pre'].includes(node.openingElement.tagName.getText(ast)))return;
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
      const ownedComponent=displayComponents.has(tag)&&open.attributes.properties.some(p=>{
        if(!ts.isJsxAttribute(p)||!p.initializer||!['placeholder','title','aria-label','alt'].includes(p.name.getText(ast)))return false;
        const value=ts.isStringLiteral(p.initializer)?p.initializer.text:ts.isJsxExpression(p.initializer)&&p.initializer.expression&&ts.isStringLiteralLike(p.initializer.expression)?p.initializer.expression.text:null;
        return value&&/[A-Za-zĂÂÎȘȚăâîșț]/.test(value)&&!/^NITIDO(?:\.RO)?$/i.test(value);
      });
      if(/^[a-z]/.test(tag)&&hasDisplay||ownedComponent){
        change(open.tagName.getStart(ast),open.tagName.end,ownedComponent?`UiElement as={${tag}}`:`UiElement as="${tag}"`);
        if(ts.isJsxElement(node))change(node.closingElement.tagName.getStart(ast),node.closingElement.tagName.end,'UiElement');
        usedElement=true;attributes++;
      }
    }
    ts.forEachChild(node,visit);
  }visit(ast);
  if(!edits.length)continue;
  if(checkOnly){changed++;continue;}
  // The display pass only changes leaf strings; avoid nested substitutions.
  const needed=[usedText?'UiText':null,usedElement?'UiElement':null].filter(Boolean);
  const existing=ast.statements.filter(node=>ts.isImportDeclaration(node)&&/(?:^|\/)UiText$/.test(node.moduleSpecifier.text));
  if(existing.length){
    const names=[...new Set([...existing.flatMap(node=>node.importClause.namedBindings.elements.map(item=>item.getText(ast))),...needed])];
    change(existing[0].getStart(ast),existing[0].end,`import {${names.join(',')}} from '@/components/UiText';`);
    for(const node of existing.slice(1))change(node.getStart(ast),node.end,'');
  }
  const sorted=edits.sort((a,b)=>b.start-a.start);
  let output=source,last=source.length;
  for(const e of sorted){if(e.end>last)throw Error(`Overlapping edits in ${file}`);output=output.slice(0,e.start)+e.text+output.slice(e.end);last=e.start;}
  const imports=existing.length?'':`import {${needed.join(',')}} from '@/components/UiText';\n`;
  const directive=/^(["']use client["'];?\s*)/.exec(output);
  const position=directive?directive[0].length:0;
  output=output.slice(0,position)+imports+output.slice(position);
  fs.writeFileSync(file,output);changed++;
}
console.log(JSON.stringify({changed,fragments,attributes}));
if(checkOnly&&changed)process.exitCode=1;
