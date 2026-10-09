import {describe,expect,it,vi} from 'vitest';
import {ActiveTrackingSession} from './tracking';
describe('foreground tracking lifecycle',()=>{
 it('removes the watcher and ignores late locations after completion/unmount',async()=>{
  const tracking=new ActiveTrackingSession(),remove=vi.fn(),send=vi.fn();let callback=()=>{};
  await tracking.start('j1',async value=>{callback=value;return {remove}},send);
  callback();expect(send).toHaveBeenCalledTimes(1);expect(tracking.stop()).toBe('j1');callback();expect(send).toHaveBeenCalledTimes(1);expect(remove).toHaveBeenCalledTimes(1);
 });
 it('disposes a native subscription that resolves after the job ended',async()=>{
  const tracking=new ActiveTrackingSession(),remove=vi.fn(),send=vi.fn();let resolve!:(value:{remove:()=>void})=>void,callback=()=>{};
  const starting=tracking.start('j1',value=>{callback=value;return new Promise(done=>{resolve=done})},send);
  tracking.stop();resolve({remove});expect(await starting).toBe(false);callback();expect(send).not.toHaveBeenCalled();expect(remove).toHaveBeenCalledTimes(1);
 });
 it('keeps a newer job active when an earlier permission request fails',async()=>{
  const tracking=new ActiveTrackingSession(),send=vi.fn();let reject!:(error:Error)=>void,oldCallback=()=>{},newCallback=()=>{};
  const previous=tracking.start('old',value=>{oldCallback=value;return new Promise((_,fail)=>{reject=fail})},send);
  await tracking.start('new',async value=>{newCallback=value;return {remove:vi.fn()}},send);
  reject(new Error('Permission refused'));await expect(previous).rejects.toThrow('refused');oldCallback();newCallback();expect(send).toHaveBeenCalledTimes(1);expect(tracking.stop()).toBe('new');
 });
});
