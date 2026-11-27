// Verify the packaged React logic is present in the release assets.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
const html=readFileSync('dist/index.html','utf8');
const refs=[...html.matchAll(/<script[^>]*src="([^"]+\.js)"/g)].map(m=>m[1]);
if(!refs.length)throw new Error('Missing JS entry in dist/index.html');
let found=false;
for(const ref of refs){
 if(!/^\.\/assets\/[\w-]+\.js$/.test(ref))throw new Error('Unexpected JS ref: '+ref);
 const f=resolve('dist',ref);
 const contents=readFileSync(f,'utf8');
 if(contents.includes('Clipboard Hot') && contents.includes('Generate Password') && contents.includes('Password Generator'))found=true;
 console.log('Packaged JS: '+ref+' ('+statSync(f).size+' bytes)');
}
if(!found)throw new Error('Lovable Password Generator application logic missing from release bundle');
if(html.includes('http://')||html.includes('https://'))throw new Error('Unexpected remote resource in release HTML');
console.log('PASS: Lovable UI and password-generation logic bundled locally.');
