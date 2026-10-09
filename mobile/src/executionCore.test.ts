import {describe,expect,it} from 'vitest';
import {checklistProgress,executionItems,LEGACY_EXECUTION_ITEMS} from './executionCore';
describe('frozen server execution checklist',()=>{
 const snapshot=[{key:'specific_surface',label:'Suprafața cerută la rezervare'},{key:'inspection',label:'Control final'}];
 it('uses the frozen snapshot rather than a local six-item template',()=>{expect(executionItems(snapshot)).toEqual(snapshot);expect(executionItems(undefined)).toEqual(LEGACY_EXECUTION_ITEMS)});
 it('ignores obsolete and duplicate entries while requiring each frozen task',()=>{
  const partial=[{item_key:'surfaces',done:1},{item_key:'inspection',done:1},{item_key:'inspection',done:1}];
  expect(checklistProgress(snapshot,partial)).toEqual({count:1,total:2,complete:false});
  expect(checklistProgress(snapshot,[...partial,{item_key:'specific_surface',done:1}])).toEqual({count:2,total:2,complete:true});
 });
 it('rejects invalid/empty/duplicate snapshots instead of showing completed zero-task progress',()=>{for(const items of [[],[{key:'x',label:'X'},{key:'x',label:'Y'}],[{key:'x',label:''}]])expect(()=>executionItems(items)).toThrow('confirmată');expect(checklistProgress([],[]).complete).toBe(false)});
});
