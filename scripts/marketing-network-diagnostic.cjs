// Manual, sandbox-only transport diagnostic. No inventory imports or messaging.
if (process.env.NEXT_PUBLIC_SITE_URL !== 'https://sandbox.nitido.ro' ||
    process.env.NITIDO_MARKETING_DELIVERY_ENABLED === 'true') {
  throw Error('MARKETING_SANDBOX_DIAGNOSTIC_GUARD');
}
const dns = require('node:dns/promises');
const https = require('node:https');
const { setTimeout: delay } = require('node:timers/promises');
const report = value => console.log('MKT_NETWORK ' + JSON.stringify(value));
async function probe(url) {
  const start = Date.now();
  let stage = 'dns';
  let agent;
  try {
    const addresses = await Promise.race([
      dns.lookup(new URL(url).hostname, { all: true, verbatim: true }),
      delay(8000, null, { ref: false }).then(() => { throw Error('PUBLIC_DNS_TIMEOUT'); }),
    ]);
    if (!addresses.length) throw Error('PUBLIC_DNS_REQUIRED');
    const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
    // Only the two fixed public URLs below can be tested; no caller-supplied target.
    agent = proxy ? new (require('https-proxy-agent').HttpsProxyAgent)(proxy) : new https.Agent({
      lookup: (_host, options, callback) => options.all
        ? callback(null, addresses)
        : callback(null, addresses[0].address, addresses[0].family),
    });
    const timings = { dns: Date.now() - start };
    await new Promise(resolve => {
      let finished = false;
      const finish = result => {
        if (finished) return;
        finished = true;
        report({ url, stage, ms: Date.now() - start, timings, ...result });
        resolve();
      };
      const req = https.request(url, {
        agent, autoSelectFamily: true, autoSelectFamilyAttemptTimeout: 250,
        signal: AbortSignal.timeout(12000),
        headers: {
          'User-Agent': 'NITIDO-Marketing/1.0 (+https://nitido.ro/contact)',
          Accept: 'text/html,application/json,text/plain;q=0.9',
          'Accept-Encoding': 'identity',
        },
      }, response => {
        stage = 'response';
        let bytes = 0;
        response.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > 700000) response.destroy(Error('PUBLIC_PAGE_TOO_LARGE'));
        });
        response.on('error', () => finish({ code: 'PUBLIC_RESPONSE_INTERRUPTED' }));
        response.on('end', () => finish({ status: response.statusCode, bytes }));
      });
      req.on('socket', socket => {
        stage = 'socket';
        socket.once('connect', () => { stage = 'tcp'; timings.tcp = Date.now() - start; });
        socket.once('secureConnect', () => { stage = 'tls'; timings.tls = Date.now() - start; });
      });
      req.on('error', error => finish({
        code: /^[A-Z_]+$/.test(error.code ?? '') ? error.code : 'PUBLIC_READ_FAILED',
      }));
      req.end();
    });
  } catch (error) {
    const code = error.code ?? error.message;
    report({ url, stage, ms: Date.now() - start, code: /^[A-Z_]+$/.test(code) ? code : 'PUBLIC_READ_FAILED' });
  } finally { agent?.destroy(); }
}
(async () => {
  await probe('https://nitido.ro/');
  await probe('https://overpass.private.coffee/api/status');
})().catch(() => { report({ code: 'DIAGNOSTIC_FAILED' }); process.exitCode = 1; });
