import {mkdirSync,copyFileSync} from 'node:fs';
await import('./compose.mjs');
mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
copyFileSync('worker/index.js','dist/server/index.js');copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built dist');
