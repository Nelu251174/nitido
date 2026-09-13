import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it,vi} from 'vitest';
vi.mock('next/navigation',()=>({usePathname:()=>'/firma'}));
import {BoardSidebar} from './BoardSidebar';

describe('workspace logo destinations',()=>{
  it.each([['firma','/firma'],['admin','/admin']] as const)('keeps the %s logo in its own dashboard', (role,href)=>{
    const html=renderToStaticMarkup(React.createElement(BoardSidebar,{role}));
    const logo=html.match(/<a\b[^>]*class="design-wordmark"[^>]*>/)?.[0];
    expect(logo).toContain(`href="${href}"`);
  });
  it('opens the public website independently of ADMIN',()=>{
    const html=renderToStaticMarkup(React.createElement(BoardSidebar,{role:'admin'}));
    expect(html).toContain('href="/"');
    expect(html).toContain('target="_blank"');
  });
});
