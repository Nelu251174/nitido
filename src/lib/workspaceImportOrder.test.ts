import {describe,expect,it,vi} from 'vitest';
import Database from 'better-sqlite3';

describe('workspace schemas remain usable from each HTTP dependency entry point',()=>{
 const entries=[
  ['collaboration access',()=>import('./collaborationAccess')],
  ['visit care',()=>import('./visitCare')],
  ['workspace',()=>import('./workspace')],
 ] as const;
 for(const [name,load] of entries)it('initializes when importing '+name+' first',async()=>{
  vi.resetModules();
  await load();
  const {WORKSPACE_SCHEMA}=await import('./workspace');
  const db=new Database(':memory:');
  try{
   expect(()=>db.exec(WORKSPACE_SCHEMA)).not.toThrow();
   for(const table of ['workspace_members','workspace_invites','workspace_properties','workspace_teams']){
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)).toEqual({name:table});
   }
  }finally{db.close();}
 });
});
