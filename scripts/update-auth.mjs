import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {sign} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export function signingHeaders(body){
 const file=process.env.RYD_UPDATE_KEY_FILE||fileURLToPath(new URL('../work/update-key.dpapi',import.meta.url));
 const encrypted=readFileSync(file,'utf8');
 const key=process.platform==='win32'?execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.Security; $value=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($value,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))'],{input:encrypted,encoding:'utf8',windowsHide:true}).trim():encrypted;
 const timestamp=String(Date.now());
 const signature=sign('sha256',Buffer.from(timestamp+'\n'+body),{key,dsaEncoding:'ieee-p1363'}).toString('base64');
 return {'Content-Type':'application/json','X-Ryd-Update-Time':timestamp,'X-Ryd-Update-Signature':signature};
}
