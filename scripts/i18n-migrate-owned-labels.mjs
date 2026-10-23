import fs from 'node:fs';
import ts from 'typescript';
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd());
const program=ts.createProgram(parsed.fileNames,parsed.options),checker=program.getTypeChecker();
let changed=0,labels=0;
function owned(node,depth=0,seen=new Set()){
  if(!node||depth>12||seen.has(node))return false;
  seen=new Set(seen).add(node);
  if(ts.isStringLiteralLike(node)||ts.isNumericLiteral(node)||[ts.SyntaxKind.TrueKeyword,ts.SyntaxKind.FalseKeyword,ts.SyntaxKind.NullKeyword].includes(node.kind))return true;
  if(ts.isAsExpression(node)||ts.isSatisfiesExpression(node)||ts.isParenthesizedExpression(node))return owned(node.expression,depth+1,seen);
  if(ts.isArrayLiteralExpression(node))return node.elements.every(e=>owned(e,depth+1,seen));
  if(ts.isObjectLiteralExpression(node))return node.properties.every(p=>ts.isPropertyAssignment(p)&&owned(p.initializer,depth+1,seen));
  if(ts.isSpreadElement(node))return owned(node.expression,depth+1,seen);
  if(ts.isConditionalExpression(node))return owned(node.whenTrue,depth+1,seen)&&owned(node.whenFalse,depth+1,seen);
  if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node))return owned(node.expression,depth+1,seen);
  if(ts.isIdentifier(node)){
    let symbol=checker.getSymbolAtLocation(node);
    if(symbol?.flags&ts.SymbolFlags.Alias)symbol=checker.getAliasedSymbol(symbol);
    let declaration=symbol?.valueDeclaration;
    if(declaration&&ts.isVariableDeclaration(declaration))return owned(declaration.initializer,depth+1,seen);
    while(declaration&&ts.isBindingElement(declaration))declaration=declaration.parent.parent;
    if(declaration&&ts.isParameter(declaration)){
      const parent=declaration.parent;
      if(ts.isArrowFunction(parent)&&ts.isCallExpression(parent.parent)&&ts.isPropertyAccessExpression(parent.parent.expression)&&parent.parent.expression.name.text==='map')return owned(parent.parent.expression.expression,depth+1,seen);
    }
  }
  return false;
}
for(const ast of program.getSourceFiles()){
  const file=ast.fileName;
  if(!file.includes('/src/')||!file.endsWith('.tsx')||/\.(test|spec)\.|\/admin\/|\/Admin[^/]*\.tsx$/.test(file)||file.endsWith('/UiText.tsx')||file.endsWith('/LanguageSelector.tsx'))continue;
  const source=fs.readFileSync(file,'utf8'),edits=[];
  function visit(node){
    if(ts.isJsxExpression(node)&&node.expression&&(ts.isJsxElement(node.parent)||ts.isJsxFragment(node.parent))){
      const expr=node.expression;
      if((ts.isIdentifier(expr)||ts.isPropertyAccessExpression(expr)||ts.isElementAccessExpression(expr))&&
         (owned(expr)||ts.isIdentifier(expr)&&/^(error|notice|successMessage|validationError|serverError)$/.test(expr.text))){
        // Restrict wrappers to strings/numbers; React nodes and object values are not text.
        const type=checker.getTypeAtLocation(expr),parts=type.isUnion()?type.types:[type];
        if(parts.every(p=>p.flags&(ts.TypeFlags.StringLike|ts.TypeFlags.NumberLike|ts.TypeFlags.Null|ts.TypeFlags.Undefined))){
          edits.push({start:expr.getStart(ast),end:expr.end,text:`<UiText text={${expr.getText(ast)}}/>`});labels++;
        }
      }
    }
    ts.forEachChild(node,visit);
  }visit(ast);
  if(!edits.length)continue;
  let output=source,last=source.length;
  for(const e of edits.sort((a,b)=>b.start-a.start)){if(e.end>last)throw Error('Overlapping labels');output=output.slice(0,e.start)+e.text+output.slice(e.end);last=e.start;}
  const updated=ts.createSourceFile(file,output,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const imports=updated.statements.filter(node=>ts.isImportDeclaration(node)&&/(?:^|\/)UiText$/.test(node.moduleSpecifier.text));
  if(imports.length){
    const names=[...new Set([...imports.flatMap(node=>node.importClause.namedBindings.elements.map(item=>item.getText(updated))),'UiText'])];
    for(const node of imports.slice().reverse()){
      const replacement=node===imports[0]?`import {${names.join(',')}} from '@/components/UiText';`:'';
      output=output.slice(0,node.getStart(updated))+replacement+output.slice(node.end);
    }
  }else{const directive=/^(["']use client["'];?\s*)/.exec(output),pos=directive?.[0].length||0;output=output.slice(0,pos)+"import {UiText} from '@/components/UiText';\n"+output.slice(pos);}
  fs.writeFileSync(file,output);changed++;
}
console.log(JSON.stringify({changed,labels}));
