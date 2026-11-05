import {afterEach, describe, expect, it, vi} from 'vitest';
const dependencies = vi.hoisted(() => ({query:vi.fn(), access:vi.fn()}));
vi.mock('@/lib/db', () => ({db:{prepare:() => ({get:dependencies.query, all:dependencies.query})}}));
vi.mock('node:fs/promises', () => ({access:dependencies.access}));
import {GET} from './route';
afterEach(() => vi.resetAllMocks());
describe('read-only health timing', () => {
  it('keeps the public response and emits numeric server timings without identifiers', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({status:'ok'});
    expect(response.headers.get('server-timing')).toMatch(/^db;dur=\d+\.\d, app;dur=\d+\.\d$/);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('retains 503 on a failed check without exposing exception details', async () => {
    dependencies.query.mockImplementationOnce(() => {throw Error('synthetic private detail');});
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({status:'unavailable'});
    expect(response.headers.get('server-timing')).toMatch(/^db;dur=\d+\.\d, app;dur=\d+\.\d$/);
  });
});
