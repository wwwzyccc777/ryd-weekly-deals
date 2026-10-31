import {existsSync} from 'node:fs';
import {collectAndSync} from './collect.mjs';
if(!existsSync('work/update-key.dpapi'))throw Error('This maintainer-only updater needs the existing local signing key. Never share that key.');
console.log('Collecting official offers and updating the public website...');
const result=await collectAndSync('https://ryd-weekly-deals.shadyloom16.chatgpt.site');
console.log(JSON.stringify(result,null,2));if(!result.success)process.exitCode=1;
