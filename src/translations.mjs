// Retailer text only. Keep each input in its own response slot: descriptions
// may contain line breaks, and translation services may reflow paragraphs.
const CACHE_KEY='translations/v2.json';
const languages=['zh-CN','en'];
export function createTranslator(env={}){
 const cache=new Map(),pending=new Map(),queue=[];let active=0,scheduled=false,dirty=false;
 const errors=[];const stats={requested:0,cacheHits:0,translated:0};
 const ready=(async()=>{try{const o=env.BUCKET&&await env.BUCKET.get(CACHE_KEY);if(o){const d=await o.json();for(const [key,value] of d.entries||[])if(typeof key==='string'&&typeof value==='string'&&value.trim())cache.set(key,value);}}catch{errors.push({code:'cache_read'});}})();
 const key=(lang,text)=>lang+'\0'+text;
 function remember(lang,text,value){if(text&&typeof value==='string'&&value.trim()){const k=key(lang,text);if(cache.get(k)!==value){cache.set(k,value);dirty=true;}}}
 async function request(batch){
  const lang=batch[0].lang,body=new URLSearchParams(batch.map(x=>['q',x.text]));let last='unavailable';
  for(const host of ['translate.googleapis.com','translate.google.com']){
   try{
    const response=await fetch('https://'+host+'/translate_a/t?'+new URLSearchParams({client:'gtx',sl:'sv',tl:lang}),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body,signal:AbortSignal.timeout(15000)});
    if(!response.ok){last='HTTP_'+response.status;continue;}
    const result=await response.json();
    if(!Array.isArray(result)||result.length!==batch.length||result.some(x=>typeof x!=='string'||!x.trim())){last='response_shape';continue;}
    return result.map(x=>x.trim());
   }catch(e){last=e.name==='TimeoutError'?'timeout':'request_failed';}
  }
  // A malformed batch must not discard unrelated products. Retry smaller
  // groups with the same ordering, ending with individual text if necessary.
  if(last==='response_shape'&&batch.length>1){const middle=Math.ceil(batch.length/2);const a=await request(batch.slice(0,middle)),b=await request(batch.slice(middle));return [...(a||Array(middle).fill(null)),...(b||Array(batch.length-middle).fill(null))];}
  errors.push({code:last,language:lang,count:batch.length});return null;
 }
 function pump(){
  scheduled=false;
  while(active<2&&queue.length){
   const first=queue.shift(),batch=[first];let size=first.text.length;
   for(let i=0;i<queue.length&&batch.length<20;){const x=queue[i];if(x.lang===first.lang&&size+x.text.length<4000){batch.push(...queue.splice(i,1));size+=x.text.length;}else i++;}
   active++;
   (async()=>{const result=await request(batch);batch.forEach((x,i)=>{const value=result?.[i]||null;if(value){remember(x.lang,x.text,value);stats.translated++;}pending.delete(x.key);x.resolve(value);});})().finally(()=>{active--;pump();});
  }
 }
 async function translate(lang,texts){
  if(!languages.includes(lang))throw Error('Unsupported translation language');await ready;
  return new Map(await Promise.all([...new Set(texts.filter(Boolean))].map(async text=>{
   const k=key(lang,text);if(cache.has(k)){stats.cacheHits++;return [text,cache.get(k)];}
   if(!pending.has(k)){stats.requested++;pending.set(k,new Promise(resolve=>queue.push({key:k,lang,text,resolve})));}
   if(!scheduled){scheduled=true;queueMicrotask(pump);}return [text,await pending.get(k)];
  })));
 }
 async function save(){await ready;if(!dirty||!env.BUCKET)return;await env.BUCKET.put(CACHE_KEY,JSON.stringify({version:2,updatedAt:new Date().toISOString(),entries:[...cache.entries()].slice(-20000)}),{httpMetadata:{contentType:'application/json'}});dirty=false;}
 return {ready,remember,translate,save,errors,stats};
}
export async function translateItems(items,translator=createTranslator()){
 await translator.ready;
 for(const x of items){translator.remember('zh-CN',x.name,x.zh);translator.remember('en',x.name,x.en);translator.remember('zh-CN',x.description,x.descriptionZh);translator.remember('en',x.description,x.descriptionEn);}
 const missing=(name,description)=>items.flatMap(x=>[...(!x[name]?[x.name]:[]),...(x.description&&!x[description]?[x.description]:[])]);
 const [zh,en]=await Promise.all([translator.translate('zh-CN',missing('zh','descriptionZh')),translator.translate('en',missing('en','descriptionEn'))]);
 return items.map(x=>({...x,zh:x.zh||zh.get(x.name)||null,en:x.en||en.get(x.name)||null,descriptionZh:x.descriptionZh||zh.get(x.description)||null,descriptionEn:x.descriptionEn||en.get(x.description)||null,translation:x.translation==='词库'&&x.zh?'词库':x.zh||zh.get(x.name)?'机器翻译':'翻译暂不可用',translationEn:x.translationEn==='reviewed'&&x.en?'reviewed':x.en||en.get(x.name)?'machine':'missing'}));
}
