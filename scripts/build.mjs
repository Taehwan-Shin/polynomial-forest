import { build } from 'esbuild';
import { readFile, writeFile, mkdir, cp, lstat, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'public-config.json'), 'utf8'));
if (Object.keys(config).sort().join(',') !== 'key,url' || !/^https:\/\/[a-z]{20}\.supabase\.co$/.test(config.url) || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.key)) throw new Error('Public configuration is invalid');
const allowed = ['app.mjs', 'records.mjs', 'polynomial-view.mjs', 'polynomial-engine.mjs', 'polynomial-data.mjs', 'polynomial.css', 'styles.css', 'cloud.css', 'index.html', 'privacy.html', 'assets'];
for (const name of await readdir(path.join(root, 'src'))) { if (!allowed.includes(name)) throw new Error('Unknown source file'); if ((await lstat(path.join(root, 'src', name))).isSymbolicLink()) throw new Error('Unsafe source link'); }
await mkdir(path.join(root, 'build/releases'), { recursive: true });
const stage = path.join(root, 'build', `.stage-${randomUUID()}`); await mkdir(stage);
await build({ entryPoints: [path.join(root, 'src/app.mjs')], outfile: path.join(stage, 'app.mjs'), bundle: true, platform: 'browser', format: 'esm', target: ['es2022'], minify: true, legalComments: 'linked', sourcemap: false, metafile: true });
for (const name of ['polynomial.css', 'styles.css', 'cloud.css', 'index.html', 'privacy.html']) await cp(path.join(root, 'src', name), path.join(stage, name));
await mkdir(path.join(stage, 'assets')); await cp(path.join(root, 'src/assets/mark.svg'), path.join(stage, 'assets/mark.svg'));
await writeFile(path.join(stage, 'public-config.json'), JSON.stringify(config, null, 2) + '\n');
const csp = `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ${config.url}; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; upgrade-insecure-requests`;
const headers = [{key:'Content-Security-Policy',value:csp},{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Referrer-Policy',value:'no-referrer'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},{key:'Cache-Control',value:'no-store'}];
await writeFile(path.join(stage, 'vercel.json'), JSON.stringify({ framework: null, buildCommand: null, installCommand: null, headers:[{source:'/(.*)',headers},{source:'/(.*).mjs',headers:[{key:'Content-Type',value:'text/javascript; charset=utf-8'}]}] }, null, 2) + '\n');
const files = {};
async function hash(dir, prefix = '') { for (const name of (await readdir(dir)).sort()) { const file = path.join(dir, name), stat = await lstat(file); if (stat.isSymbolicLink()) throw new Error('Unsafe output link'); if (stat.isDirectory()) await hash(file, prefix + name + '/'); else files[prefix + name] = createHash('sha256').update(await readFile(file)).digest('hex'); } }
await hash(stage);
const release = createHash('sha256').update(JSON.stringify(files)).digest('hex');
await writeFile(path.join(stage, 'BUILD-MANIFEST.json'), JSON.stringify({kind:'polynomial-forest-static-v1',release,files},null,2)+'\n');
const target = path.join(root, 'build/releases', release);
try { await lstat(target); throw new Error('Release already exists; preserve existing output'); } catch(error) { if (error.code !== 'ENOENT') throw error; }
await rename(stage, target); await writeFile(path.join(root, 'build/current.json'), JSON.stringify({release},null,2)+'\n');
console.log(`Ready: build/releases/${release}`);
