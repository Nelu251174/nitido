import {describe,expect,it} from 'vitest';
import {clientActiveNavigationHref,clientDashboardTargetHref,isClientDashboardTarget} from './clientNavigation';

describe('client section navigation compatibility',()=>{
  it.each([
    ['','/client'],['sec-lucrari','/client/rezervari'],['sec-plata','/client/plati'],['sec-cont','/client/cont'],['sec-mesaje','/client/mesaje'],['sec-noutati','/client#optiuni'],
  ])('keeps the legacy/native target %s reachable', (target,href)=>{
    expect(isClientDashboardTarget(target)).toBe(true);expect(clientDashboardTargetHref(target)).toBe(href);
  });
  it('leaves booking parameters and form navigation to the booking flow',()=>{
    expect(isClientDashboardTarget('sec-form')).toBe(false);
    expect(clientActiveNavigationHref('/client','#sec-form')).toBe('/client/rezervari');
    expect(clientDashboardTargetHref('__proto__')).toBeNull();
  });
  it.each([
    ['/client/plata/owned-job','/client/plati'],['/client/firme-preferate','/client/proprietati'],['/client/evaluari','/client/rezervari'],['/client/setari','/client/cont'],['/client/organizatii','/client/cont'],['/client/rezervari/details','/client/rezervari'],
  ])('gives %s one contextual parent', (path,parent)=>{
    expect(clientActiveNavigationHref(path)).toBe(parent);
  });
  it('does not select home or payments for unrelated routes with a similar prefix',()=>{
    expect(clientActiveNavigationHref('/client/platicious')).toBeNull();
    expect(clientActiveNavigationHref('/admin')).toBeNull();
  });
});
