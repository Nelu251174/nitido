import {expect,it} from 'vitest';
import {existsSync,readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import manifest from '@/data/internationalResearchReview.json';
import scope from '@/data/internationalMarketScope.json';
import {INTERNATIONAL_MARKETS,internationalCountry,internationalCity} from './internationalTariffs';

it('retains the exact operational countries and canonical cities while separating public research',()=>{
 const expected=manifest.countries.map(c=>({countryCode:c.code,name:c.name,currency:'EUR',cities:c.cities.map(x=>x.cityKey)}));
 expect(INTERNATIONAL_MARKETS).toEqual(expected);
 expect(scope).toEqual(expected);
 expect(()=>internationalCountry('RO')).toThrow();
 for(const country of expected)for(const city of country.cities)expect(internationalCity(internationalCountry(country.countryCode),city)).toBe(city);
});

it('does not load the bulk competitor research into database initialization',()=>{
 const root=path.resolve('src'),visited=new Set<string>();
 function walk(file:string){
  if(visited.has(file))return;visited.add(file);
  if(!/\.tsx?$/.test(file))return;
  const ast=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  for(const statement of ast.statements){
   if(!ts.isImportDeclaration(statement)&&!ts.isExportDeclaration(statement))continue;
   const spec=statement.moduleSpecifier;if(!spec||!ts.isStringLiteral(spec))continue;
   const name=spec.text,base=name.startsWith('@/')?path.join(root,name.slice(2)):name.startsWith('.')?path.resolve(path.dirname(file),name):null;
   if(!base)continue;
   const resolved=[base,base+'.ts',base+'.tsx',path.join(base,'index.ts')].find(candidate=>existsSync(candidate)&&statSync(candidate).isFile());
   if(resolved)walk(resolved);
  }
 }
 walk(path.join(root,'lib/db.ts'));
 expect(visited.has(path.join(root,'data/internationalMarketScope.json'))).toBe(true);
 expect(visited.has(path.join(root,'data/internationalResearchReview.json'))).toBe(false);
 expect(readFileSync(path.join(root,'data/internationalMarketScope.json')).length).toBeLessThan(10000);
});
