import {generateKeyPairSync} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
const file=process.env.RYD_UPDATE_KEY_FILE||'work/update-key.dpapi';
if(existsSync(file))throw Error('Key file already exists; no key was replaced.');
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const pem=privateKey.export({type:'pkcs8',format:'pem'});
mkdirSync('work',{recursive:true});mkdirSync('src',{recursive:true});
if(process.platform==='win32'){
 const protectedValue=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.Security; $value=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($value,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))'],{input:pem,encoding:'utf8',windowsHide:true});
 writeFileSync(file,protectedValue.trim());
}else{writeFileSync(file,pem,{mode:0o600});}
writeFileSync('src/import-key.json',JSON.stringify(publicKey.export({format:'jwk'}),null,2));
console.log('Created local protected update key and public verification key. No private key was displayed.');
