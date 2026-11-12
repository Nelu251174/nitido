import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {resolve} from 'node:path';

const mocks=vi.hoisted(()=>({spawn:vi.fn(),exists:vi.fn()}));
vi.mock('node:child_process',()=>({spawn:mocks.spawn}));
vi.mock('node:fs',()=>({existsSync:mocks.exists}));
import {marketingCollectorEnvironment,startMarketingCollectorProcess,stopMarketingCollectorProcess} from './adminMarketingCollectorProcess';

function child(){return Object.assign(new EventEmitter(),{unref:vi.fn(),kill:vi.fn(),channel:{unref:vi.fn()}});}
beforeEach(()=>{vi.useFakeTimers();mocks.exists.mockReset().mockReturnValue(true);mocks.spawn.mockReset().mockImplementation(()=>child());vi.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(()=>{stopMarketingCollectorProcess();vi.restoreAllMocks();vi.useRealTimers();});

describe('isolated production collector supervision',()=>{
 it('starts only one bounded child with the existing database and TLS/proxy settings',()=>{
  startMarketingCollectorProcess('data/synthetic.db');startMarketingCollectorProcess('data/synthetic.db');
  expect(mocks.spawn).toHaveBeenCalledOnce();
  const [file,args,options]=mocks.spawn.mock.calls[0];
  expect(file).toBe(process.execPath);
  expect(args[0]).toBe('--max-old-space-size=256');
  expect(args[1]).toMatch(/scripts\/runtime\/marketing-collector\.cjs$/);
  expect(args[2]).toBe(resolve('data/synthetic.db'));
  expect(options.stdio).toEqual(['ignore','inherit','inherit','ipc']);
 });
 it('passes public collector configuration while withholding application and delivery credentials',()=>{
  const env=marketingCollectorEnvironment({NODE_ENV:'production',PATH:'/synthetic/bin',HTTPS_PROXY:'http://proxy:8080',NODE_EXTRA_CA_CERTS:'/synthetic/ca.crt',NEXT_PUBLIC_SITE_URL:'https://nitido.ro',NITIDO_MARKETING_ADMIN_ENABLED:'true',NITIDO_MARKETING_DELIVERY_ENABLED:'true',STRIPE_SECRET_KEY:'synthetic',RESEND_API_KEY:'synthetic',COOLIFY_TOKEN:'synthetic',GH_TOKEN:'synthetic',NODE_OPTIONS:'--inspect'});
  expect(env.HTTPS_PROXY).toBe('http://proxy:8080');expect(env.NODE_EXTRA_CA_CERTS).toBe('/synthetic/ca.crt');
  expect(env.NITIDO_MARKETING_ADMIN_ENABLED).toBe('true');expect(env.NITIDO_MARKETING_DELIVERY_ENABLED).toBe('true');
  for(const name of ['STRIPE_SECRET_KEY','RESEND_API_KEY','COOLIFY_TOKEN','GH_TOKEN','NODE_OPTIONS'])expect(env).not.toHaveProperty(name);
 });
 it('never executes an in-process fallback or creates an empty database if the build artifact is missing',()=>{
  mocks.exists.mockReturnValue(false);startMarketingCollectorProcess('data/synthetic.db');
  expect(mocks.spawn).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
  expect(console.error).toHaveBeenCalledWith('[marketing] collector_process_unavailable');
 });
 it('rejects process-private in-memory databases in production',()=>{
  startMarketingCollectorProcess(':memory:');expect(mocks.spawn).not.toHaveBeenCalled();
 });
 it('reports isolated startup without logging environment values or database paths',()=>{
  const worker=child();mocks.spawn.mockReturnValue(worker);const log=vi.spyOn(console,'log').mockImplementation(()=>{});
  startMarketingCollectorProcess('data/synthetic.db');worker.emit('message',{type:'marketing-collector-ready'});
  expect(log).toHaveBeenCalledWith('MKT_COLLECTOR_PROCESS '+JSON.stringify({state:'ready',isolated:true}));
 });
 it('allows one delayed recovery after a crash and stops instead of restarting in a loop',async()=>{
  const first=child(),second=child();mocks.spawn.mockReturnValueOnce(first).mockReturnValueOnce(second);
  startMarketingCollectorProcess('data/synthetic.db');first.emit('error',Error('synthetic'));first.emit('exit',1);
  await vi.advanceTimersByTimeAsync(14999);expect(mocks.spawn).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);expect(mocks.spawn).toHaveBeenCalledTimes(2);
  second.emit('exit',1);await vi.advanceTimersByTimeAsync(120000);
  expect(mocks.spawn).toHaveBeenCalledTimes(2);expect(console.error).toHaveBeenCalledWith('[marketing] collector_process_retry_exhausted');
 });
 it('reaps only its own child and cancels pending recovery when stopped',async()=>{
  const first=child();mocks.spawn.mockReturnValue(first);startMarketingCollectorProcess('data/synthetic.db');
  stopMarketingCollectorProcess();expect(first.kill).toHaveBeenCalledWith('SIGTERM');
  first.emit('exit',0);await vi.advanceTimersByTimeAsync(30000);expect(mocks.spawn).toHaveBeenCalledOnce();
  startMarketingCollectorProcess('data/another-synthetic.db');first.emit('exit',1);stopMarketingCollectorProcess();
  await vi.advanceTimersByTimeAsync(30000);expect(mocks.spawn).toHaveBeenCalledTimes(2);
 });
});
