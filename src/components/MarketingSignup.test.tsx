import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./UiText',()=>({UiText:({text}:{text:string})=>text}));
import {MarketingSignup} from './MarketingSignup';
import {MarketingSignupConfirm} from './MarketingSignupConfirm';
describe('public Marketing signup presentation',()=>{
 it('requires explicit consent, a county and email without prechecking consent',()=>{
  const html=renderToStaticMarkup(<MarketingSignup/>);const checkbox=html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0];expect(checkbox).toBeTruthy();expect(checkbox).not.toContain('checked');expect(html).toContain('Alege județul');expect(html).toContain('Politica de confidențialitate');expect(html).not.toContain('confirmation_hash');
 });
 it('asks for confirmation rather than confirming on page load',()=>{const spy=vi.spyOn(globalThis,'fetch');try{expect(renderToStaticMarkup(<MarketingSignupConfirm/>)).toContain('Confirmă înscrierea');expect(spy).not.toHaveBeenCalled();}finally{spy.mockRestore();}});
});
