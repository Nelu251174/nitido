import {beforeEach, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
import type {AdminRole} from '@/lib/adminRolesShared';
import {AdminQueryError} from '@/lib/adminWorkbench';

const state = vi.hoisted(() => ({role: 'super_admin' as AdminRole | null, dashboard: vi.fn(), workbench: vi.fn(), firms: vi.fn()}));
vi.mock('@/lib/db', () => ({db: {}}));
vi.mock('@/lib/adminAuth', () => ({getAdminIdentity: async () => state.role ? {id: 'admin', role: state.role} : null}));
vi.mock('@/lib/adminDashboard', () => ({adminDashboard: state.dashboard}));
vi.mock('@/lib/adminWorkbench', async original => {
  const actual = await original<typeof import('@/lib/adminWorkbench')>();
  return {...actual, adminWorkbench: state.workbench, adminFirms: state.firms};
});
import {GET as dashboard} from './route';
import {GET as workbench} from '../workbench/route';
import {GET as firms} from '../firms/route';

const request = () => new NextRequest('https://sandbox.nitido.ro/api/admin/workbench?q=Client');
beforeEach(() => {
  state.role = 'super_admin';
  for (const call of [state.dashboard, state.workbench, state.firms]) {call.mockReset(); call.mockReturnValue({ok: true});}
});

it('requires a verified ADMIN identity before reading any new dashboard or directory data', async () => {
  state.role = null;
  for (const response of [await dashboard(), await workbench(request()), await firms(request())]) {
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  }
  expect(state.dashboard).not.toHaveBeenCalled();
  expect(state.workbench).not.toHaveBeenCalled();
  expect(state.firms).not.toHaveBeenCalled();
});

it.each(['operator', 'manager', 'super_admin'] as const)('permits the operational dashboard for %s', async role => {
  state.role = role;
  const response = await dashboard();
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(state.dashboard).toHaveBeenCalledWith({}, role);
});

it('keeps Finance outside operations and requires management for the firm directory', async () => {
  state.role = 'finance';
  expect((await dashboard()).status).toBe(403);
  expect(state.dashboard).not.toHaveBeenCalled();
  expect((await firms(request())).status).toBe(403);
  expect((await workbench(request())).status).toBe(200);
  state.role = 'operator';
  expect((await firms(request())).status).toBe(403);
  expect(state.firms).not.toHaveBeenCalled();
  state.role = 'manager';
  expect((await firms(request())).status).toBe(200);
});

it('returns the complete bounded attention queue only when explicitly requested', async () => {
  expect((await dashboard(new NextRequest('https://sandbox.nitido.ro/api/admin/dashboard?attention=all'))).status).toBe(200);
  expect(state.dashboard).toHaveBeenCalledWith({}, 'super_admin', expect.any(Date), true);
  state.dashboard.mockClear();
  expect((await dashboard(new NextRequest('https://sandbox.nitido.ro/api/admin/dashboard?attention=invalid'))).status).toBe(400);
  expect(state.dashboard).not.toHaveBeenCalled();
});

it('returns actionable invalid-filter errors and never exposes internal database failures', async () => {
  state.workbench.mockImplementation(() => {throw new AdminQueryError('Pagină invalidă.');});
  expect((await workbench(request())).status).toBe(400);
  for (const call of [state.dashboard, state.workbench, state.firms]) call.mockImplementation(() => {throw Error('secret SQL and credentials');});
  for (const response of [await dashboard(), await workbench(request()), await firms(request())]) {
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('secret');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  }
});
