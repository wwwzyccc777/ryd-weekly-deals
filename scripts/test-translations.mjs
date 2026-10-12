import assert from 'node:assert/strict';
import {createTranslator,translateItems} from '../src/translations.mjs';
const original=globalThis.fetch,objects=new Map();let calls=0,active=0,peak=0;
const env={BUCKET:{get:async key=>objects.has(key)?{json:async()=>JSON.parse(objects.get(key))}:null,put:async(key,value)=>objects.set(key,value)}};
globalThis.fetch=async(url,options)=>{calls++;active++;peak=Math.max(peak,active);try{
 const u=new URL(url),texts=new URLSearchParams(options.body).getAll('q');assert.equal(options.method,'POST');assert.ok(!u.searchParams.has('q'));
 await new Promise(r=>setTimeout(r,1));return Response.json(texts.map(t=>u.searchParams.get('tl')==='en'?'EN '+t:'中文 '+t));
}finally{active--;}};
try{
 const service=createTranslator(env);const product={name:'Ny produkt',description:'Rad ett\nRad två',translation:'待翻译',translationEn:'missing'};
 const [a,b]=await Promise.all([translateItems([product],service),translateItems([product],service)]);
 assert.equal(calls,2);assert.deepEqual(a,b);assert.equal(a[0].descriptionZh,'中文 Rad ett\nRad två');assert.equal(a[0].translation,'机器翻译');assert.equal(a[0].translationEn,'machine');assert.ok(peak<=2);
 await service.save();const nextWeek=createTranslator(env);const reused=await translateItems([{...product,id:'different-store-and-week'}],nextWeek);assert.equal(calls,2);assert.equal(reused[0].zh,a[0].zh);
 const reviewed=await translateItems([{...product,zh:'人工商品名',en:'Reviewed name',translation:'词库',translationEn:'reviewed'}],nextWeek);assert.equal(reviewed[0].zh,'人工商品名');assert.equal(reviewed[0].translation,'词库');
 let attempts=0;globalThis.fetch=async()=>{attempts++;return attempts%2?new Response('busy',{status:503}):Response.json(['恢复翻译']);};const fallback=createTranslator();assert.equal((await fallback.translate('zh-CN',['Återställ'])).get('Återställ'),'恢复翻译');assert.equal(attempts,2);
 globalThis.fetch=async()=>new Response('busy',{status:503});const failed=createTranslator();assert.equal((await failed.translate('en',['Retry next time'])).get('Retry next time'),null);assert.equal(failed.errors[0].code,'HTTP_503');await failed.save();
 let retryCalls=0;globalThis.fetch=async()=>{retryCalls++;return Response.json(['Recovered']);};assert.equal((await failed.translate('en',['Retry next time'])).get('Retry next time'),'Recovered');assert.equal(retryCalls,1);
 globalThis.fetch=async(url,options)=>{const texts=new URLSearchParams(options.body).getAll('q');return Response.json(texts.length>1?[]:texts.map(t=>'Aligned '+t));};const split=createTranslator();const aligned=await split.translate('en',['First','Second','Third']);assert.deepEqual([...aligned.values()],['Aligned First','Aligned Second','Aligned Third']);assert.deepEqual(split.errors,[]);
 console.log('Translation response alignment, multiline text, deduplication, bounded concurrency, cross-week cache, reviewed overrides, fallback and failure retry passed.');
}finally{globalThis.fetch=original;}
