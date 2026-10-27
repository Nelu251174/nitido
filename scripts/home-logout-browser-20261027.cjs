// Offline production browser checks: synthetic accounts only, no customer sessions.
const fs=require('node:fs');
const {spawn}=require('node:child_process');
const {createRequire}=require('node:module');
const {chromium}=require('/qa-tools/node_modules/playwright-core');
const appRequire=createRequire('/app/runtime/package.json');
const Database=appRequire('better-sqlite3');
const fixture=JSON.parse(fs.readFileSync('/evidence/browser-fixture.json','utf8'));
const base='http://localhost:3199',out='/evidence',password=fixture.password;
const report={startedAt:new Date().toISOString(),scope:'Actual standalone production build; offline; synthetic client and firm',checks:[],pageErrors:[],realUsersChanged:0,realEmailsSent:0};
// Production Docker creates this persistent upload mount before server startup.
fs.mkdirSync('/app/runtime/public/uploads',{recursive:true});
function check(name,passed){report.checks.push({name,passed:!!passed});if(!passed)throw Error(name);}
const log=fs.openSync(out+'/browser-server.log','w');
const server=spawn(process.execPath,['/app/runtime/server.js'],{cwd:'/app/runtime',env:{...process.env,NODE_ENV:'production',PORT:'3199',HOSTNAME:'0.0.0.0',NEXT_PUBLIC_SITE_URL:'https://nitido.ro',NITIDO_SEED_DEMO:'false',NITIDO_ENABLE_BEARER_AUTH:'false',MARKETING_EMAIL_ENABLED:'false',RESEND_API_KEY:'',RESEND_FROM:'',PUSH_ENABLED:'false'},stdio:['ignore',log,log]});
let browser,db,sequence=0;
async function signIn(role,width){
 const context=await browser.newContext({viewport:{width,height:900},locale:'ro-RO',serviceWorkers:'block'});
 await context.route('**/api/**',route=>route.continue({headers:{...route.request().headers(),origin:'https://nitido.ro'}}));
 const r=await context.request.post(base+'/api/auth/login',{headers:{Origin:'https://nitido.ro','x-forwarded-for':'198.51.100.'+(++sequence)},data:{email:role+'@example.test',password,role}});
 check('synthetic '+role+' login '+sequence,r.status()===200);
 const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));
 await page.goto(base+'/'+role);await page.getByRole('button',{name:'Ieși din cont',exact:true}).last().waitFor();
 return {context,page};
}
async function assertLoggedOut(context,role,label){
 const me=await context.request.get(base+'/api/auth/me');check(label+' server session revoked',(await me.json()).user===null);
 check(label+' target sessions removed',db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id=?').get('fixture-'+role).n===0);
 check(label+' other user remains signed in',db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id=?').get('fixture-other').n===1);
}
async function main(){
 for(let n=0;n<100;n++){try{if((await fetch(base+'/api/health')).ok)break}catch{}if(n===99)throw Error('SERVER_NOT_READY');await new Promise(r=>setTimeout(r,300));}
 db=new Database('/app/runtime/data/nitido.db');
 const hash=fixture.hash;
 for(const role of ['client','firma'])db.prepare('INSERT INTO users(id,role,name,email,password_hash) VALUES(?,?,?,?,?)').run('fixture-'+role,role,role==='client'?'Fixture Client':'Fixture Firm',role+'@example.test',hash);
 db.prepare('INSERT INTO firms(id,user_id,coverage_city,verified) VALUES(?,?,?,1)').run('fixture-firm-record','fixture-firma','Constanța');
 db.prepare("INSERT INTO users(id,role,name,email,password_hash) VALUES('fixture-other','client','Other Fixture','other@example.test',?)").run(hash);
 db.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES('fixture-other-session','fixture-other','2099-01-01T00:00:00.000Z')").run();
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server']});
 for(const role of ['client','firma'])for(const width of [390,1366]){
  const {context,page}=await signIn(role,width),label=role+' '+width;
  const logo=page.getByRole('link',{name:/^NITIDO(?:\.RO)?$/}).first();
  check(label+' logo has homepage destination',await logo.getAttribute('href')==='/');
  await logo.click();await page.waitForURL(base+'/');await page.locator('.approved-home').waitFor();
  check(label+' homepage opens after logo click',new URL(page.url()).pathname==='/');
  const me=await context.request.get(base+'/api/auth/me');check(label+' logo preserves signed-in account',(await me.json()).user.role===role);
  await page.goto(base+'/'+role);const button=page.getByRole('button',{name:'Ieși din cont',exact:true}).last();await button.waitFor();await button.click();await page.waitForURL(base+'/login');
  await assertLoggedOut(context,role,label);
  if(role==='client'&&width===390)await page.screenshot({path:out+'/logout-confirmed-mobile.png',fullPage:true});
  await page.goto(base+'/'+role);await page.waitForURL(u=>u.pathname==='/login');check(label+' protected account cannot reopen after logout',!(await page.getByText(role==='client'?'Fixture Client':'Fixture Firm',{exact:true}).count()));
  await context.close();
 }
 // A failed backend response stays visible beside the actual account button.
 {
  const {context,page}=await signIn('client',390);let attempts=0;
  await page.route('**/api/auth/logout',async route=>{attempts++;await new Promise(r=>setTimeout(r,300));await route.fulfill({status:503,contentType:'application/json',body:'{}'});});
  const button=page.getByRole('button',{name:'Ieși din cont',exact:true}).last();await button.click();
  const busy=page.getByRole('button',{name:'Se verifică…',exact:true}).last();check('logout button shows progress',await busy.isDisabled());await busy.evaluate(e=>e.click());
  const error=page.locator('#sec-cont [role="alert"]');await error.waitFor();check('failed logout explains retry beside the account button',(await error.innerText()).includes('Reîncearcă'));
  check('rapid second click does not send another logout',attempts===1);
  check('unconfirmed logout retains the authenticated session',(await (await context.request.get(base+'/api/auth/me')).json()).user?.role==='client');
  const bounds=await error.boundingBox();check('mobile logout error fits the viewport',bounds&&bounds.x>=0&&bounds.x+bounds.width<=391);
  await error.screenshot({path:out+'/logout-error-mobile.png'});
  await page.unroute('**/api/auth/logout');await page.getByRole('button',{name:'Ieși din cont',exact:true}).last().click();await page.waitForURL(base+'/login');await assertLoggedOut(context,'client','successful retry');await context.close();
 }
 // The browser has no OS implementation. Exercise the native branch with its
 // unavailable Capacitor methods; unit tests separately cover rejection and hangs.
 for(const mode of ['native-methods-unavailable']){
  const {context,page}=await signIn('client',390),token='fixture-native-'+mode+'-token';
  db.prepare('INSERT INTO push_devices(id,user_id,platform,device_token) VALUES(?,?,?,?)').run('device-'+mode,'fixture-client','IOS',token);
  await page.evaluate(({token})=>{
   const cap=window.Capacitor;
   if(!cap)throw Error('CAPACITOR_GLOBAL_MISSING');
   cap.getPlatform=()=> 'ios';cap.isNativePlatform=()=>true;cap.isPluginAvailable=()=>true;
   localStorage.setItem('nitido.native-push.v1',token);
  },{token});
  await page.getByRole('button',{name:'Ieși din cont',exact:true}).last().click();await page.waitForURL(base+'/login',{timeout:10000});
  await assertLoggedOut(context,'client',mode);
  const device=db.prepare('SELECT push_enabled,revoked_at FROM push_devices WHERE id=?').get('device-'+mode);
  check(mode+' server push is revoked before logout completes',device.push_enabled===0&&!!device.revoked_at);
  check(mode+' cookie and token cleanup completed',await context.cookies().then(rows=>!rows.some(c=>c.name==='nitido_session')));
  check(mode+' retry token cleared only after confirmed logout',await page.evaluate(()=>localStorage.getItem('nitido.native-push.v1'))===null);
  await context.close();
 }
 check('no browser runtime exceptions',report.pageErrors.length===0);
 check('SQLite integrity and foreign keys preserved',db.pragma('integrity_check',{simple:true})==='ok'&&db.pragma('foreign_key_check').length===0);
 db.prepare("DELETE FROM sessions WHERE id='fixture-other-session'").run();check('all fixture sessions cleaned',db.prepare('SELECT COUNT(*) n FROM sessions').get().n===0);
 report.status='passed';
}
main().catch(e=>{report.status='failed';report.failure=String(e.message).replaceAll(password,'[redacted]').replace(/https?:\/\/\S+/g,'[URL]');process.exitCode=1}).finally(async()=>{await browser?.close();db?.close();server.kill('SIGTERM');await new Promise(r=>{if(server.exitCode!==null)return r();server.once('exit',r);setTimeout(()=>{server.kill('SIGKILL');r()},5000).unref()});fs.closeSync(log);report.finishedAt=new Date().toISOString();report.passed=report.checks.filter(x=>x.passed).length;fs.writeFileSync(out+'/browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,passed:report.passed,failure:report.failure,pageErrors:report.pageErrors}));});
