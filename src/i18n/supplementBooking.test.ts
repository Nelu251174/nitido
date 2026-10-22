import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {it,expect} from 'vitest';
import {textKey} from './text';
import scope from '../../messages/supplement-booking-source.json';
import manifest from '../../messages/manifest.json';

for(const locale of manifest.locales){
 it(`delivers supplement reservation instructions and financial errors in ${locale}`,()=>{
  const catalog=JSON.parse(readFileSync(resolve('messages',locale+'.json'),'utf8')) as Record<string,string>;
  expect(scope).toHaveLength(21);
  for(const source of scope){
   expect(catalog[textKey(source)],source).toBeTruthy();
   if(locale!=='ro')expect(catalog[textKey(source)],source).not.toBe(source);
  }
 });
}
