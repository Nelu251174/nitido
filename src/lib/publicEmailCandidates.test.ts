import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { describe, expect, it } from 'vitest';
import { publicEmailCandidates } from './publicEmailCandidates';
import { publicEmails } from './adminMarketingWebCollection';

// Functional oracle for small fixtures only: the previous expression can block on long malformed text.
const legacyCandidates = (text: string) => (text.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+/gi) ?? []).filter(value => value.length <= 254);

function boundedCandidates(texts: string[]): Promise<string[][]> {
  const source = transpileModule(readFileSync(new URL('./publicEmailCandidates.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  }).outputText;
  const worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');${source}\nparentPort.postMessage(workerData.map(exports.publicEmailCandidates));`, { eval: true, workerData: texts });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { void worker.terminate(); reject(Error('Public email scan exceeded 2 seconds')); }, 2000);
    worker.once('message', result => { clearTimeout(timer); void worker.terminate(); resolve(result); });
    worker.once('error', error => { clearTimeout(timer); void worker.terminate(); reject(error); });
  });
}

describe('bounded public email extraction', () => {
  it('preserves global match consumption and domain-prefix rules', () => {
    for (const text of [
      'a@b.com/c@d.com', 'a@b.co-@d.com', 'a@b-c.d-e--.f', 'a@b.c..d', 'a@b-.c',
      'a@b.c--', '!#$%&\'*+/=?^_`{|}~-@B.1', 'a@b.cé', 'K@b.co ſ@b.co user@b.ſx',
      'name@host..ro; user@host.-ro; a@b.c.d', 'a@b.com—c@d.com',
      'x'.repeat(248) + '@b.com', 'x'.repeat(249) + '@b.com/path/c@d.com',
    ]) expect(publicEmailCandidates(text)).toEqual(legacyCandidates(text));
  });

  it('keeps existing normalization, priority, deduplication and exclusions', () => {
    expect(publicEmails('Other@firm.ro CONTACT@firm.ro info@firm.ro contact@firm.ro test@firm.ro example@firm.ro noreply@firm.ro photo@firm.png'))
      .toEqual(['contact@firm.ro', 'info@firm.ro', 'other@firm.ro']);
    expect(publicEmails('Contact: office+booking@sub.firm.ro, invalid@host; a@b.c')).toEqual(['a@b.c', 'office+booking@sub.firm.ro']);
  });

  it('matches the previous extractor on deterministic mixed ASCII/Unicode fixtures', () => {
    let seed = 1617;
    const random = (limit: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % limit; };
    const characters = 'abcAB012.-@ @/,+_%!éKſ—';
    for (let i = 0; i < 5000; i++) {
      let text = '';
      for (let n = random(140); n > 0; n--) text += characters[random(characters.length)];
      expect(publicEmailCandidates(text)).toEqual(legacyCandidates(text));
    }
  });

  it('finishes maximum-sized malformed pages without blocking the caller', async () => {
    const long = 'a'.repeat(700000);
    const fixtures = [long, long + '@', long + '@x', long + '@x.', '@'.repeat(700000), 'a@' + long, 'a@' + 'a.'.repeat(200000) + 'a'];
    expect(await boundedCandidates(fixtures)).toEqual(fixtures.map(() => []));
  });
});
