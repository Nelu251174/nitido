/** Supplemental production browser audit. Uses only temporary synthetic data. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const repo = path.resolve(new URL('..', import.meta.url).pathname);
const require = createRequire(path.join(repo, 'package.json'));
const Database = require('better-sqlite3'), bcrypt = require('bcryptjs'), ts = require('typescript');
const toolsPath = process.env.NITIDO_QA_TOOLS ?? '/workspace/nitido-qa-tools/node_modules';
const { chromium } = await import(pathToFileURL(path.join(toolsPath, 'playwright-core/index.mjs')).href);
const output = process.env.NITIDO_QA_OUTPUT ?? '/workspace/nitido-general-web-results';
const buildPath = process.env.NITIDO_QA_BUILD_PATH ?? path.join(repo, '.next');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'nitido-general-web-'));
const port = 3198, base = `http://localhost:${port}`;
const report = { scope: 'Isolated production browser; temporary synthetic SQLite; external requests blocked; no deployment or payment', sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim()), started: new Date().toISOString(), checks: [], pages: [], pageErrors: [], consoleErrors: [], httpErrors: [] };
let server, browser, db;
async function check(name, fn) { try { report.checks.push({ name, passed: true, details: await fn() }); } catch (error) { report.checks.push({ name, passed: false, error: error.message }); } }
async function inspect(page, label) {
  await page.waitForTimeout(300);
  if (process.env.NITIDO_QA_PREVIEW_CSS === 'true') {
    await page.addStyleTag({ path: path.join(repo, 'src/app/workspace-theme.css') });
    report.cssPreview = true;
    await page.waitForTimeout(300);
  }
  await page.addScriptTag({ path: path.join(toolsPath, 'axe-core/axe.min.js') });
  const accessibility = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return result.violations.map(({ id, impact, description, nodes }) => ({ id, impact, description, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
  });
  const layouts = [];
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(100);
    const dimensions = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body;
      const bounded = element => { for (let a = element.parentElement; a && a !== document.body; a = a.parentElement) { const r = a.getBoundingClientRect(); if (['auto', 'scroll'].includes(getComputedStyle(a).overflowX) && r.left >= -1 && r.right <= innerWidth + 1) return true; } return false; };
      const offenders = [main, ...main.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); const clippedForAssistiveTechnology = r.width <= 1 && s.position === 'absolute' && s.overflow === 'hidden' && (r.height <= 1 || s.clip !== 'auto' || s.clipPath === 'inset(50%)'); return r.width > 0 && !clippedForAssistiveTechnology && !e.closest('[aria-hidden="true"]') && (r.left < -1 || r.right > innerWidth + 1) && !bounded(e); }).map(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return { tag: e.tagName, className: e.className, type: e.getAttribute('type'), text: e.textContent?.slice(0, 70), left: r.left, right: r.right, width: r.width, height: r.height, opacity: s.opacity, position: s.position, overflow: s.overflow, clip: s.clip, clipPath: s.clipPath }; });
      return { scrollWidth: document.documentElement.scrollWidth, offenders };
    });
    layouts.push({ width, ...dimensions, passed: dimensions.scrollWidth <= width + 1 && dimensions.offenders.length === 0 });
  }
  await page.screenshot({ path: path.join(output, `${label}.png`), fullPage: true });
  report.pages.push({ label, url: new URL(page.url()).pathname, title: await page.title(), accessibility, layouts });
}
try {
  await fs.mkdir(output, { recursive: true });
  for (const entry of await fs.readdir(repo)) if (['src', 'public'].includes(entry) || /^(package.*\.json|next.*\.(js|mjs|ts)|tsconfig\.json|postcss.*|next-env\.d\.ts)$/.test(entry)) await fs.cp(path.join(repo, entry), path.join(temporary, entry), { recursive: true });
  await fs.symlink(path.join(repo, 'node_modules'), path.join(temporary, 'node_modules'), 'dir');
  await fs.cp(buildPath, path.join(temporary, '.next'), { recursive: true, filter: file => !file.startsWith(path.join(buildPath, 'cache')) && !file.startsWith(path.join(buildPath, 'standalone')) });
  report.buildId = (await fs.readFile(path.join(temporary, '.next/BUILD_ID'), 'utf8')).trim();
  const env = { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', NITIDO_SEED_DEMO: 'false', NITIDO_PRO_ENABLED: 'true', NEXT_PUBLIC_NITIDO_PRO_PUBLIC: 'true', NEXT_PUBLIC_SITE_URL: base, NITIDO_ENABLE_BEARER_AUTH: 'true' };
  for (const key of Object.keys(env)) if (/STRIPE|RESEND|TWILIO|SMS|OPENAI|CRON_SECRET|ACCESS_KEY|NITIDO_ADMIN/.test(key)) delete env[key];
  const log = await fs.open(path.join(output, 'server.log'), 'w');
  server = spawn(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), 'start', '--hostname', 'localhost', '--port', String(port)], { cwd: temporary, env, stdio: ['ignore', log.fd, log.fd] });
  let ready = false;
  for (let attempt = 0; attempt < 45; attempt++) { if (server.exitCode !== null) throw Error(`Server exited ${server.exitCode}`); try { if ((await fetch(base + '/api/jobs')).status === 401) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 500)); }
  assert(ready, 'Server readiness');
  db = new Database(path.join(temporary, 'data/nitido.db')); db.pragma('foreign_keys=ON');
  const schema = ts.transpileModule(await fs.readFile(path.join(temporary, 'src/lib/pro/schema.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  await fs.writeFile(path.join(temporary, 'qa-pro-schema.mjs'), schema);
  const { migratePro } = await import(pathToFileURL(path.join(temporary, 'qa-pro-schema.mjs')).href); migratePro(db);
  const accounts = [['client', 'client'], ['firm', 'firma'], ['worker', 'client'], ['outsider', 'client']].map(([id, role]) => ({ id, role, email: `${id}@example.test`, password: randomBytes(20).toString('hex') }));
  for (const a of accounts) db.prepare('INSERT INTO users(id,role,name,email,password_hash,referral_code) VALUES(?,?,?,?,?,?)').run(a.id, a.role, `QA ${a.id}`, a.email, await bcrypt.hash(a.password, 10), `QA-${a.id}`);
  db.prepare("INSERT INTO firms(id,user_id,coverage_city,verified) VALUES('qa-firm','firm','Constanța',1)").run();
  db.prepare("INSERT INTO workspace_teams(id,firm_id,name) VALUES('qa-team','qa-firm','QA team')").run();
  db.prepare("INSERT INTO workspace_members(id,kind,resource_id,user_id,role,created_at) VALUES('qa-membership','team','qa-team','worker','worker',?)").run(new Date().toISOString());
  db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id,created_at) VALUES('qa-job','client','Adresă sintetică alocată','Constanța',75,'apartament','scheduled',300,120,'accepted','qa-firm',?)").run(new Date().toISOString());
  db.prepare("INSERT INTO workspace_assignments VALUES('qa-job','qa-team','firm',?)").run(new Date().toISOString());
  browser = await chromium.launch({ executablePath: process.env.NITIDO_QA_CHROMIUM ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  async function context() { const c = await browser.newContext({ locale: 'ro-RO', timezoneId: 'Europe/Bucharest' }); await c.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort()); return c; }
  async function pageFor(c, label) { const page = await c.newPage(); page.on('pageerror', e => report.pageErrors.push({ label, error: e.message })); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push({ label, error: m.text() }); }); page.on('response', r => { if (r.status() >= 400) report.httpErrors.push({ label, path: new URL(r.url()).pathname, status: r.status() }); }); return page; }
  const anonymous = await context(), publicPage = await pageFor(anonymous, 'public');
  for (const route of ['/', '/login', '/signup', '/reset-parola', '/rezervare', '/contact', '/nitido-pro', '/nitido-pro/aplica', '/nitido-pro/parteneri', '/stergere-cont', '/confidentialitate', '/termeni']) await check(`public ${route}`, async () => { const response = await publicPage.goto(base + route); assert.equal(response.status(), 200); if (route.startsWith('/nitido-pro')) { const canonical = await publicPage.locator('link[rel="canonical"]').getAttribute('href'); assert.equal(new URL(canonical).pathname, route); for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) assert.equal(new URL(await publicPage.locator(selector).getAttribute('content')).pathname, '/opengraph-image'); } await inspect(publicPage, route.replaceAll('/', '-') || 'home'); return { status: response.status() }; });
  await check('anonymous private APIs are protected', async () => { const statuses = {}; for (const route of ['/api/jobs', '/api/collaboration', '/api/pro/context', '/api/admin/auth/me']) { const r = await anonymous.request.get(base + route); assert([401, 403].includes(r.status()), `${route} returned ${r.status()}`); statuses[route] = r.status(); } return statuses; });
  await check('anonymous client redirect preserves safe next path', async () => { await publicPage.goto(base + '/client'); await publicPage.waitForURL('**/login?**'); assert.equal(new URL(publicPage.url()).searchParams.get('next'), '/client'); return { destination: new URL(publicPage.url()).pathname }; });
  for (const a of accounts) {
    const c = await context(), p = await pageFor(c, a.id);
    await check(`${a.id} password login with web cookie and mobile token`, async () => { const r = await c.request.post(base + '/api/auth/login', { data: { email: a.email, password: a.password, role: a.role } }); assert.equal(r.status(), 200); const data = await r.json(); assert(data.sessionToken); const cookie = (await c.cookies()).find(x => x.name === 'nitido_session'); assert(cookie?.httpOnly && cookie.secure && cookie.sameSite === 'Lax'); const me = await c.request.get(base + '/api/auth/me'); assert.equal((await me.json()).user.id, a.id); const bearer = await anonymous.request.get(base + '/api/auth/me', { headers: { authorization: `Bearer ${data.sessionToken}` } }); assert.equal((await bearer.json()).user.id, a.id); return { cookieHttpOnly: cookie.httpOnly, cookieSecure: cookie.secure, sameSite: cookie.sameSite, bearerParity: true }; });
    await check(`${a.id} job and collaboration scope`, async () => { const r = await c.request.get(base + '/api/collaboration'); assert.equal(r.status(), 200); const data = await r.json(); const allowed = ['firm', 'worker'].includes(a.id); assert.equal(data.jobs.some(j => j.id === 'qa-job'), allowed); if (!allowed) assert(!JSON.stringify(data).includes('Adresă sintetică alocată')); const jobs = await (await c.request.get(base + '/api/jobs')).json(); if (a.id === 'outsider' || a.id === 'worker') assert.equal(jobs.jobs.length, 0); return { collaborationJobs: data.jobs.length, marketplaceJobs: jobs.jobs.length }; });
    if (a.id !== 'outsider') for (const route of a.id === 'client' ? ['/client', '/client/proprietati', '/client/mesaje'] : a.id === 'firm' ? ['/firma', '/firma/echipe', '/firma/calendar'] : ['/echipa']) await check(`${a.id} workspace ${route}`, async () => { await p.goto(base + route); await p.locator('h1').first().waitFor(); await p.waitForTimeout(700); await inspect(p, a.id + route.replaceAll('/', '-')); if (route === '/firma/calendar') { await p.setViewportSize({ width: 360, height: 900 }); const region = p.getByRole('region', { name: 'Calendar săptămânal al echipelor' }); await region.focus(); const before = await region.evaluate(e => ({ focused: document.activeElement === e, left: e.scrollLeft })); assert(before.focused); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250); assert((await region.evaluate(e => e.scrollLeft)) > before.left, 'Calendar scrolls with keyboard'); } return { url: new URL(p.url()).pathname }; });
    if (['client', 'firm'].includes(a.id)) await check(`${a.id} deletion intake confirms a request without deleting data`, async () => {
      const before = db.prepare('SELECT COUNT(*) total FROM users').get().total;
      await p.goto(base + '/stergere-cont');
      const section = p.getByRole('region', { name: 'Solicită ștergerea contului' });
      const submit = section.getByRole('button', { name: 'Trimite cererea de ștergere a contului' });
      await submit.waitFor(); assert(await submit.isDisabled());
      const foreign = await c.request.post(base + '/api/account/deletion', { headers: { origin: 'https://attacker.example.test' }, data: { confirmation: 'DELETE_ACCOUNT' } }); assert.equal(foreign.status(), 403);
      await section.getByRole('checkbox').check(); await submit.click();
      await section.getByRole('status').getByText('Cererea a fost înregistrată.', { exact: true }).waitFor();
      const r = await c.request.get(base + '/api/account/deletion'); assert.equal(r.status(), 200);
      assert.match(r.headers()['cache-control'], /no-store/); const data = await r.json(); assert.equal(data.request.status, 'requested');
      const replay = await c.request.post(base + '/api/account/deletion', { headers: { origin: base }, data: { confirmation: 'DELETE_ACCOUNT' } }); assert.equal(replay.status(), 200); assert.equal((await replay.json()).request.id, data.request.id);
      assert.equal(db.prepare('SELECT COUNT(*) total FROM users').get().total, before); assert(db.prepare('SELECT id FROM users WHERE id=?').get(a.id));
      await inspect(p, `${a.id}-deletion-request`);
      return { status: data.request.status, replayed: true, dataPreserved: true, foreignOrigin: foreign.status() };
    });
    await check(`${a.id} foreign-origin mutation refused`, async () => { const r = await c.request.post(base + '/api/collaboration', { headers: { origin: 'https://attacker.example.test' }, data: { action: 'checklist.set', jobId: 'qa-job', key: 'floors', done: true } }); assert.equal(r.status(), 403); return { status: r.status() }; });
    await check(`${a.id} logout invalidates cookie session`, async () => { const r = await c.request.post(base + '/api/auth/logout'); assert.equal(r.status(), 200); const me = await c.request.get(base + '/api/auth/me'); assert.equal((await me.json()).user, null); return { status: r.status() }; });
    await c.close();
  }
  await anonymous.close();
} catch (error) { report.error = error.stack; } finally {
  if (browser) await browser.close(); if (db) db.close(); if (server && server.exitCode === null) { server.kill('SIGTERM'); await new Promise(r => server.once('exit', r)); }
  report.finished = new Date().toISOString();
  report.functionalPassed = !report.error && report.checks.every(c => c.passed) && report.pageErrors.length === 0;
  report.layoutPassed = report.pages.length > 0 && report.pages.every(p => p.layouts.every(l => l.passed));
  report.accessibilityPassed = report.pages.length > 0 && report.pages.every(p => p.accessibility.length === 0);
  report.passed = report.functionalPassed && report.layoutPassed && report.accessibilityPassed;
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await fs.rm(temporary, { recursive: true, force: true });
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, failedChecks: report.checks.filter(c => !c.passed), pages: report.pages.length, accessibilityViolations: report.pages.reduce((n, p) => n + p.accessibility.length, 0), pageErrors: report.pageErrors.length, error: report.error }));
  process.exitCode = report.passed ? 0 : 1;
}
