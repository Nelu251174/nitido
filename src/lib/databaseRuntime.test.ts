import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import Database from 'better-sqlite3';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

let previous: Database.Database | undefined;
let previousInitialized: Database.Database | undefined;
let directory: string;
beforeEach(() => {
  previous = global.__nitidoDb;
  previousInitialized = global.__nitidoInitializedDb;
  delete global.__nitidoDb;
  delete global.__nitidoInitializedDb;
  directory = mkdtempSync(path.join(tmpdir(), 'nitido-runtime-test-'));
  vi.spyOn(process, 'cwd').mockReturnValue(directory);
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NITIDO_SEED_DEMO', 'false');
  vi.resetModules();
});
afterEach(() => {
  vi.restoreAllMocks();
  if (global.__nitidoDb?.open && global.__nitidoDb !== previous) global.__nitidoDb.close();
  global.__nitidoDb = previous;
  global.__nitidoInitializedDb = previousInitialized;
  vi.unstubAllEnvs();
  rmSync(directory, {recursive:true, force:true});
  vi.resetModules();
});

describe('production database reuse across route modules', () => {
  it('shares a ready connection without repeating schema writes on another module load', async () => {
    const first = await import('./db');
    expect(first.db.pragma('foreign_keys', {simple:true})).toBe(1);
    expect(first.db.prepare('SELECT COUNT(*) n FROM users').get()).toEqual({n:0});
    const exec = vi.spyOn(first.db, 'exec');
    const transaction = vi.spyOn(first.db, 'transaction');
    vi.resetModules();
    const second = await import('./db');
    expect(second.db).toBe(first.db);
    expect(exec).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(second.db.pragma('integrity_check', {simple:true})).toBe('ok');
  });

  it('reopens and initializes a connection if the previous one was closed', async () => {
    const first = await import('./db');
    first.db.close();
    vi.resetModules();
    const second = await import('./db');
    expect(second.db).not.toBe(first.db);
    expect(second.db.open).toBe(true);
    expect(second.db.pragma('foreign_keys', {simple:true})).toBe(1);
    expect(second.db.pragma('integrity_check', {simple:true})).toBe('ok');
  });

  it('does not cache failed schema initialization as ready', async () => {
    const fail = vi.spyOn(Database.prototype, 'exec').mockImplementationOnce(() => {throw Error('synthetic schema initialization failure');});
    await expect(import('./db')).rejects.toThrow('synthetic schema initialization failure');
    expect(global.__nitidoInitializedDb).toBeUndefined();
    fail.mockRestore();
    vi.resetModules();
    const recovered = await import('./db');
    expect(global.__nitidoInitializedDb).toBe(recovered.db);
    expect(recovered.db.prepare('SELECT COUNT(*) n FROM users').get()).toEqual({n:0});
  });
});
