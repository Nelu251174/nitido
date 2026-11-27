import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
await mkdir(path.join(root,'scripts','runtime'),{recursive:true});
await build({
 entryPoints:[path.join(root,'src','background','marketingCollector.ts')],
 outfile:path.join(root,'scripts','runtime','marketing-collector.cjs'),
 // Bundle JavaScript dependencies; only the native SQLite module is supplied by standalone.
 bundle:true,platform:'node',format:'cjs',target:'node22',external:['better-sqlite3'],
 sourcemap:false,logLevel:'warning',
});
