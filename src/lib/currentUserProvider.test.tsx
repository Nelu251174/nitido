// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {CurrentUserProvider, useCurrentUser} from './useCurrentUser';

const route = vi.hoisted(() => ({pathname: '/client/plati'}));
vi.mock('next/navigation', () => ({usePathname: () => route.pathname}));
let root: Root, container: HTMLDivElement;
const account = {id: 'client-one', role: 'client'};
function Probe() {
  const {user, loading, error} = useCurrentUser();
  return <span>{loading ? 'loading' : error ? 'error' : user?.id ?? 'signed out'}</span>;
}
function renderPage(key = route.pathname) {
  return act(() => root.render(<CurrentUserProvider><Probe key={key}/><Probe key={`mobile-${key}`}/></CurrentUserProvider>));
}
beforeEach(() => {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  route.pathname = '/client/plati';
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it('shares one auth request and preserves the account while a new page revalidates', async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({user: account}))
    .mockImplementationOnce(() => new Promise<Response>(resolve => {finish = resolve;}));
  vi.stubGlobal('fetch', fetcher);
  await renderPage();
  expect(fetcher).toHaveBeenCalledTimes(1);
  route.pathname = '/client';
  await renderPage();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(container.textContent).toBe('client-oneclient-one');
  await act(() => finish(Response.json({user: account})));
  expect(container.textContent).toBe('client-oneclient-one');
});

it.each(['expired', 'offline'] as const)('clears the previous account when route revalidation is %s', async outcome => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({user: account}));
  if (outcome === 'expired') fetcher.mockResolvedValueOnce(Response.json({error: 'Expired'}, {status: 401}));
  else fetcher.mockRejectedValueOnce(Error('offline'));
  vi.stubGlobal('fetch', fetcher);
  await renderPage();
  route.pathname = '/client';
  await renderPage();
  expect(container.textContent).toBe(outcome === 'expired' ? 'signed outsigned out' : 'errorerror');
  expect(container.textContent).not.toContain('client-one');
});

it('ignores an older route response after another navigation', async () => {
  let finishOld!: (response: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({user: account}))
    .mockImplementationOnce(() => new Promise<Response>(resolve => {finishOld = resolve;}))
    .mockResolvedValueOnce(Response.json({user: {id: 'client-two', role: 'client'}}));
  vi.stubGlobal('fetch', fetcher);
  await renderPage();
  route.pathname = '/client';
  await renderPage();
  const previousSignal = fetcher.mock.calls[1][1].signal as AbortSignal;
  route.pathname = '/client/rezervari';
  await renderPage();
  expect(previousSignal.aborted).toBe(true);
  await act(() => finishOld(Response.json({user: account})));
  expect(container.textContent).toBe('client-twoclient-two');
});

it('does not retain an account when the client layout is unmounted for logout', async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({user: account}))
    .mockImplementationOnce(() => new Promise<Response>(resolve => {finish = resolve;})));
  await renderPage();
  await act(() => root.render(<p>logged out</p>));
  await renderPage();
  expect(container.textContent).toBe('loadingloading');
  await act(() => finish(Response.json({user: null})));
  expect(container.textContent).toBe('signed outsigned out');
});
