// Fail the Windows release build if Vite omitted the application logic.
// This check runs after vite build, including during `npm run tauri build`.
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'web/index.html'), 'utf8');
if (!/<script\s+type=["']module["']\s+src=["']\.\/app\.js["']/.test(source)) {
  throw new Error('Source HTML must use <script type="module" src="./app.js"> for Vite bundling.');
}
const html = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js(?:\?[^"']*)?)["'][^>]*>/g)];
if (!scripts.length) throw new Error('No JavaScript bundle referenced by dist/index.html');
let foundApp = false;
for (const [, url] of scripts) {
  if (/^(https?:)?\/\//i.test(url)) throw new Error('Release uses a remote script: ' + url);
  const clean = url.split('?')[0].replace(/^\.\//, '').replace(/^\//, '');
  const path = resolve(root, 'dist', clean);
  if (!path.startsWith(resolve(root,'dist') + (process.platform === 'win32' ? '\\' : '/'))) {
    throw new Error('Unexpected output script path: ' + url);
  }
  const size = statSync(path).size;
  const content = readFileSync(path, 'utf8');
  console.log(`Verified packaged script ${clean} (${size} bytes)`);
  if (content.includes('Password generation failed:') && content.includes('Select at least one character type')) foundApp = true;
}
if (!foundApp) throw new Error('Password Generator application logic was not found in the bundled JavaScript.');
if (html.includes('src="./app.js"')) throw new Error('Unbundled app.js reference remains in dist/index.html');
console.log('PASS: release HTML points to a bundled JavaScript file containing password-generation logic.');
