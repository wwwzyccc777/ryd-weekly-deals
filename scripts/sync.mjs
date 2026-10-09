import {collectAndSync} from './collect.mjs';
console.log('Ready for Site sync JSON on stdin (input is hidden).');
if(process.stdin.isTTY)process.stdin.setRawMode(true);
const input=await new Promise(resolve=>{let s='';process.stdin.on('data',chunk=>{s+=chunk.toString();if(/[\r\n]/.test(s)){process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);resolve(JSON.parse(s.trim()));}});});
const {url}=input;
const result=await collectAndSync(url);console.log(JSON.stringify(result));if(!result.success)process.exitCode=1;
