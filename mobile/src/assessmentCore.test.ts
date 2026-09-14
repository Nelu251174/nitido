import {describe,it,expect,vi} from 'vitest';
import {assessmentInput,emptyAssessment,assessmentSubmitter,actOnAssessment,assessmentIsOpen,ASSESSMENT_CATEGORIES,type Assessment} from './assessmentCore';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const input=()=>assessmentInput({...emptyAssessment('București','1500'),notes:'Geamuri înalte; preferăm luni.'});
const item=(status:Assessment['status']='submitted'):Assessment=>({...input(),id:'request1',version:3,status,createdAt:'2026-09-12T10:00:00Z',messages:[]});
describe('native assessment contract',()=>{
 it('uses the categories declared by the server without importing server dependencies',()=>{const source=readFileSync(join(process.cwd(),'../src/lib/serviceCatalog.ts'),'utf8');const literal=source.match(/CATALOG_CATEGORIES=(\[.*?\]) as const/);expect(literal).not.toBeNull();expect(ASSESSMENT_CATEGORIES).toEqual(JSON.parse(literal![1].replace(/'/g,'\"')));expect(input()).toMatchObject({sqm:1500,category:'general',city:'București'});});
 it.each(['','-1','1.5','1e3','1000001'])('rejects an invalid surface %s before sending',sqm=>{expect(()=>assessmentInput({...emptyAssessment('Iași',sqm),notes:'Detalii'})).toThrow();});
 it('requires meaningful instructions and bounded counts',()=>{expect(()=>assessmentInput(emptyAssessment('Iași'))).toThrow();expect(()=>assessmentInput({...emptyAssessment('Iași'),notes:'A'.repeat(4001)})).toThrow();expect(()=>assessmentInput({...emptyAssessment('Iași'),notes:'Test',rooms:'10001'})).toThrow();});
 it('reuses the request key after an uncertain network failure and changes it only for a different payload',async()=>{
  const request=vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue({id:'saved'});
  const key=vi.fn().mockReturnValueOnce('key1').mockReturnValueOnce('key2');const submit=assessmentSubmitter(request,key);
  await expect(submit(input())).rejects.toThrow('timeout');await expect(submit(input())).resolves.toBe('saved');await submit({...input(),sqm:1600});
  const bodies=request.mock.calls.map(c=>JSON.parse(c[1].body));expect(bodies.map(b=>b.requestKey)).toEqual(['key1','key1','key2']);expect(bodies[0]).toEqual({action:'create',requestKey:'key1',input:input()});
 });
 it('does not claim success without the server identifier',async()=>{const submit=assessmentSubmitter(vi.fn().mockResolvedValue({}),()=> 'key');await expect(submit(input())).rejects.toThrow('Confirmarea');});
 it('sends the server version with replies and cancellation',async()=>{const request=vi.fn().mockResolvedValue({ok:true});await actOnAssessment(request,item(),'reply',' Detaliu nou ');expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({id:'request1',version:3,action:'reply',body:'Detaliu nou'});await actOnAssessment(request,item(),'cancel');expect(JSON.parse(request.mock.calls[1][1].body).action).toBe('cancel');});
 it.each(['reviewed','declined','cancelled'] as const)('cannot mutate a closed %s request',async status=>{const request=vi.fn();expect(assessmentIsOpen(item(status))).toBe(false);await expect(actOnAssessment(request,item(status),'reply','Test')).rejects.toThrow('închisă');expect(request).not.toHaveBeenCalled();});
 it('preserves a conflict instead of claiming the reply was saved',async()=>{await expect(actOnAssessment(vi.fn().mockRejectedValue(new Error('Reîncarcă')),item(),'reply','Test')).rejects.toThrow('Reîncarcă');});
});
