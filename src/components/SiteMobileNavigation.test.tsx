// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
const state = vi.hoisted(() => ({path: '/', mobile: true, native: false, user: null as null | {role: 'client' | 'firma'}}));
vi.mock('next/navigation', () => ({usePathname: () => state.path}));
vi.mock('@capacitor/core', () => ({Capacitor: {isNativePlatform: () => state.native}}));
vi.mock('@/lib/useCurrentUser', () => ({useCurrentUser: () => ({user: state.user})}));
vi.mock('./UiText', () => ({UiText: ({text}: {text: string}) => <>{text}</>, UiElement: ({as: Tag = 'div', children, ...props}: React.PropsWithChildren<Record<string, unknown>>) => React.createElement(Tag as string, props, children)}));
import {SiteMobileNavigation} from './SiteMobileNavigation';
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  Object.assign(state, {path: '/', mobile: true, native: false, user: null});
  vi.stubGlobal('matchMedia', () => ({matches: state.mobile, addEventListener: vi.fn(), removeEventListener: vi.fn()}));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {await act(() => root.unmount()); container.remove(); vi.unstubAllGlobals();});
async function render() {await act(() => root.render(<SiteMobileNavigation/>));}

it('keeps the same navigation mounted across home, contact, booking and authentication', async () => {
  await render(); const bar = container.querySelector('nav');
  for (const path of ['/contact', '/rezervare', '/login', '/signup', '/preturi', '/']) {
    state.path = path; await render();
    expect(container.querySelector('nav'), path).toBe(bar);
    expect(container.querySelectorAll('nav a'), path).toHaveLength(4);
  }
});
it('takes guests to booking, support and login without protected account links', async () => {
  state.path = '/contact'; await render();
  expect([...container.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual(['/', '/rezervare', '/contact', '/login?role=client']);
  expect(container.querySelector('a[aria-current=page]')?.textContent).toBe('Ajutor');
});
it.each(['/client', '/client/cont', '/firma', '/firma/mesaje', '/admin', '/admin/firme', '/mobile/client-home'])('leaves %s navigation to its workspace', async path => {
  state.path = path; await render(); expect(container.querySelector('nav')).toBeNull();
});
it('does not add a navigation bar to the desktop website', async () => {
  state.mobile = false; await render(); expect(container.querySelector('nav')).toBeNull();
});
it('keeps navigation in a native landscape webview even above the mobile breakpoint', async () => {
  state.mobile = false; state.native = true; await render(); expect(container.querySelectorAll('a')).toHaveLength(4);
});
it.each(['client', 'firma'] as const)('preserves the %s account destinations on public pages', async role => {
  state.user = {role}; await render();
  const hrefs = [...container.querySelectorAll('a')].map(a => a.getAttribute('href'));
  expect(hrefs).toEqual(role === 'firma' ? ['/', '/firma', '/firma/mesaje', '/firma'] : ['/', '/client/rezervari', '/client/mesaje', '/client/cont']);
});
