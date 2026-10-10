import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker,{STORES,today} from '../worker/index.js';
import {icaHTML,lidlHTML} from './test-providers.mjs';
const f=JSON.parse(readFileSync(new URL('./fixtures/providers.json',import.meta.url),'utf8'));
const objects=new Map();let serial=0,sourceFetches=0;const env={BUCKET:{get:async key=>objects.has(key)?{etag:objects.get(key).etag,body:objects.get(key).value,json:async()=>JSON.parse(objects.get(key).value)}:null,put:async(key,value,options={})=>{const old=objects.get(key);if(options.onlyIf instanceof Headers&&options.onlyIf.get('If-None-Match')==='*'&&old)return null;if(options.onlyIf?.etagMatches&&old?.etag!==options.onlyIf.etagMatches)return null;const next={value,etag:String(++serial)};objects.set(key,next);return next;},delete:async key=>objects.delete(key)}};
const realFetch=globalThis.fetch;let breakICA=false;
globalThis.fetch=async(url,options)=>{
 sourceFetches++;assert.ok(options.headers['User-Agent']);const u=new URL(url);
 if(u.hostname==='www.ica.se')return new Response(breakICA?'unavailable':icaHTML(f.ica),{status:breakICA?503:200});
 if(u.hostname==='www.lidl.se'){
  if(u.pathname==='/'){const [year,month,day]=today().split('-');return new Response(`<a href="/c/current/a123">${Number(day)}/${Number(month)}-${Number(day)}/${Number(month)}</a>`);}
  if(u.pathname.includes('/butiker/'))return new Response('Lidl Linköping Järdalavägen 1');
  return new Response(lidlHTML(f.lidl));
 }
 if(u.hostname==='www.citygross.se'){
  if(u.pathname.endsWith('/stores'))return Response.json([{data:{id:9097,siteId:168,storeName:'Linköping Tornby'}}]);
  if(u.pathname.endsWith('/storeNumber'))return Response.json({storeNumber:3231});
  const [y,m,d]=today().split('-');return Response.json([{...f.citygross[0],availableFrom:today(),subTitle:`Priser ${Number(d)}/${Number(m)} till ${Number(d)}/${Number(m)}`}]);
 }
 if(u.hostname==='online.flippingbook.com')return new Response("ContentRoot: 'https://d123.cloudfront.net/test/'\nPrivateContentRoot: 'https://d123.cloudfront.net/test-private/'\nvar initialPolicies = "+JSON.stringify([{PathPrefix:'://d123.cloudfront.net/',Policy:'public-test',Signature:'public-test',KeyId:'public-test'}])+';');
 if(u.hostname==='d123.cloudfront.net'){
  if(u.pathname.endsWith('.webp'))return new Response(new TextEncoder().encode('RIFF0000WEBPtest'));
  if(u.pathname.endsWith('.svg'))return new Response('<svg:svg xmlns:svg="http://www.w3.org/2000/svg" width="822" height="1133"><svg:rect width="10" height="10" fill="red"/></svg:svg>');
  return new Response(readFileSync(new URL('./fixtures/city-test.pdf',import.meta.url)),{headers:{'Content-Type':'application/pdf'}});
 }
 if(u.pathname.includes('/axfood/rest/store/')){const s=STORES.find(x=>x.id===u.pathname.split('/').at(-1));return Response.json({name:s.officialName,storeId:s.id});}
 const id=u.searchParams.get('q');assert.ok(STORES.some(s=>s.id===id));return Response.json({pagination:{numberOfPages:1},results:[{name:'Jasminris',potentialPromotions:[{code:'cloud-test',name:'Jasminris',price:37.9,qualifyingCount:1,comparePrice:'18:95 kr/kg',startDate:'05/10-2026',endDate:'11/10-2026'}]}]});
};
try{
 const req=()=>new Request('https://example.test/api/update',{method:'POST',headers:{Origin:'https://example.test'},body:'{}'});
 const first=await (await worker.fetch(req(),env)).json();assert.equal(first.job.state,'succeeded');assert.equal(first.data.storage,'persistent');assert.equal(first.data.stores.length,6);assert.ok(first.data.stores.every(s=>s.items.length>0&&s.status==='live'));assert.equal(first.data.stores.find(s=>s.store.key==='citygross').items.length,12);const initialFetches=sourceFetches;assert.ok(initialFetches>=15);
 const again=await (await worker.fetch(req(),env)).json();assert.ok(again.reused);assert.ok(again.cooldownSeconds>0);assert.equal(sourceFetches,initialFetches);
 const city=first.data.stores.find(s=>s.store.key==='citygross');assert.ok(city.items.every(x=>x.image.startsWith('/api/citygross-image?')&&x.leafletImageRect));
 const imageRequest=new Request('https://example.test'+city.items[0].image);
 const image=await worker.fetch(imageRequest,env);assert.equal(image.status,200);assert.ok(image.headers.get('Content-Type').startsWith('image/svg+xml'));const svg=await image.text();assert.ok(svg.includes('data:image/webp;base64,'));assert.ok(!svg.includes('public-test'));const afterImage=sourceFetches;
 assert.equal((await worker.fetch(imageRequest,env)).status,200);assert.equal(sourceFetches,afterImage);
 assert.equal((await worker.fetch(new Request('https://example.test/api/citygross-image?book=999999&page=1&v=test'),env)).status,404);
 assert.equal((await worker.fetch(new Request(imageRequest.url,{method:'POST'}),env)).status,405);
 assert.equal((await worker.fetch(new Request('https://example.test/api/update',{method:'POST',headers:{Origin:'https://evil.example'}}),env)).status,403);
 assert.equal((await worker.fetch(new Request('https://example.test/api/import',{method:'POST',body:'{}'}),env)).status,401);
 const status=await (await worker.fetch(new Request('https://example.test/api/update'),env)).json();assert.equal(status.job.state,'succeeded');assert.equal(status.mode,'cloud');
 // Expire the previous check and exercise failed-source retention rather than empty replacement.
 const job=JSON.parse(objects.get('updates/current.json').value);job.requestedAt=new Date(Date.now()-11*60*1000).toISOString();objects.set('updates/current.json',{value:JSON.stringify(job),etag:String(++serial)});breakICA=true;
 const failed=await (await worker.fetch(req(),env)).json();assert.equal(failed.job.state,'failed');const ica=failed.data.stores.find(s=>s.store.key==='ica');assert.equal(ica.status,'failed');assert.equal(ica.items.length,3);assert.ok(failed.data.stores.filter(s=>s.store.key!=='ica').every(s=>s.status==='live'));
 console.log('Six-source cloud sync, persistence, cooldown, cross-origin rejection, signed imports and failed-source retention passed.');
}finally{globalThis.fetch=realFetch;}
