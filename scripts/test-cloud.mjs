import assert from 'node:assert/strict';
import worker,{STORES} from '../worker/index.js';
const objects=new Map();let serial=0,sourceFetches=0;const env={BUCKET:{get:async key=>objects.has(key)?{etag:objects.get(key).etag,json:async()=>JSON.parse(objects.get(key).value)}:null,put:async(key,value,options={})=>{const old=objects.get(key);if(options.onlyIf instanceof Headers&&options.onlyIf.get('If-None-Match')==='*'&&old)return null;if(options.onlyIf?.etagMatches&&old?.etag!==options.onlyIf.etagMatches)return null;const next={value,etag:String(++serial)};objects.set(key,next);return next;},delete:async key=>objects.delete(key)}};
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{sourceFetches++;assert.ok(options.headers['User-Agent']);const u=new URL(url);if(u.pathname.includes('/axfood/rest/store/')){const s=STORES.find(x=>x.id===u.pathname.split('/').at(-1));return Response.json({name:s.officialName,storeId:s.id});}const id=u.searchParams.get('q');assert.ok(STORES.some(s=>s.id===id));return Response.json({pagination:{numberOfPages:1},results:[{name:'Jasminris',potentialPromotions:[{code:'cloud-test',name:'Jasminris',price:37.9,qualifyingCount:1,comparePrice:'18:95 kr/kg',startDate:'05/10-2026',endDate:'11/10-2026'}]}]});};
try{
 const req=()=>new Request('https://example.test/api/update',{method:'POST',headers:{Origin:'https://example.test'},body:'{}'});
 const first=await (await worker.fetch(req(),env)).json();assert.equal(first.job.state,'succeeded');assert.equal(first.data.storage,'persistent');assert.ok(first.data.stores.every(s=>s.items.length===1&&s.status==='live'));assert.equal(sourceFetches,6);
 const again=await (await worker.fetch(req(),env)).json();assert.ok(again.reused);assert.ok(again.cooldownSeconds>0);assert.equal(sourceFetches,6);
 assert.equal((await worker.fetch(new Request('https://example.test/api/update',{method:'POST',headers:{Origin:'https://evil.example'}}),env)).status,403);
 assert.equal((await worker.fetch(new Request('https://example.test/api/import',{method:'POST',body:'{}'}),env)).status,401);
 const status=await (await worker.fetch(new Request('https://example.test/api/update'),env)).json();assert.equal(status.job.state,'succeeded');assert.equal(status.mode,'cloud');
 console.log('Cloud fetch, official identity checks, public button sync, persistence, cooldown, cross-origin rejection and signed imports passed.');
}finally{globalThis.fetch=realFetch;}
