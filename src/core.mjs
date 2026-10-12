import {createTranslator,translateItems} from './translations.mjs';
const nameKey=value=>String(value||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('sv-SE');
const reviewedNames={zh:new Map(Object.entries(ZH).map(([k,v])=>[nameKey(k),v])),en:new Map(Object.entries(EN).map(([k,v])=>[nameKey(k),v]))};
export const reviewedName=(name,lang)=>reviewedNames[lang]?.get(nameKey(name))||null;
export const STORES = [
 {id:'4193',key:'ryd',name:'Hemköp Ryd',officialName:'Hemköp Linköping Ryd',host:'https://www.hemkop.se',url:'https://www.hemkop.se/erbjudanden/4193',address:'Mårdtorpsgatan 27'},
 {id:'2298',key:'tornby',name:'Willys Tornby',officialName:'Willys Linköping Tornby',host:'https://www.willys.se',url:'https://www.willys.se/erbjudanden/butik?StoreID=2298',address:'Norra Svedengatan 20'},
 {id:'2178',key:'skag',name:'Willys Skäggetorp',officialName:'Willys Linköping Skäggetorp',host:'https://www.willys.se',url:'https://www.willys.se/erbjudanden/butik?StoreID=2178',address:'Skäggetorps Centrum'},
 {id:'1003823',key:'ica',provider:'ica',name:'ICA Maxi Linköping',officialName:'Maxi ICA Stormarknad Linköping',host:'https://www.ica.se',url:'https://www.ica.se/erbjudanden/maxi-ica-stormarknad-linkoping-1003823/',address:'Västra Svedengatan 12',scopeZh:'门店公开优惠；官网只提供截止日期时不推断开始日期',scopeEn:'Public store offers; missing start dates are not inferred'},
 {id:'lidl-linkoping',key:'lidl',provider:'lidl',name:'Lidl Linköping',officialName:'Lidl Linköping · Järdalavägen 1',host:'https://www.lidl.se',url:'https://www.lidl.se/',identityURL:'https://www.lidl.se/s/sv-SE/butiker/linkoeping/jaerdalavaegen-1/',address:'Järdalavägen 1',scopeZh:'官网全国同价活动；不含地区差异报价和个人券',scopeEn:'Official offers with identical prices across Sweden; regional differences and personal coupons excluded'},
 {id:'citygross-3231',key:'citygross',provider:'citygross',name:'City Gross Tornby',officialName:'City Gross Linköping Tornby',host:'https://www.citygross.se',url:'https://www.citygross.se/butiker/linkoping-tornby',address:'Norra Svedengatan 9',scopeZh:'从门店官方宣传册解析商品，保留页码；部分餐饮广告不属于打折促销',scopeEn:'Products parsed from the official store leaflet with page references; catering adverts may not be discounted'}
];
export const num = s => {const m=String(s??'').replace(/(\d):(\d)/g,'$1.$2').replace(/,/g,'.').match(/\d+(?:\.\d+)?/);return m?Number(m[0]):null;};
export function dateISO(s){if(/^\d{4}-\d{2}-\d{2}/.test(String(s||'')))return String(s).slice(0,10);const m=String(s||'').match(/(\d{2})\/(\d{2})-(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;}
export function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm'}).format(new Date());}
function category(name,cat=''){
 const t=(name+' '+cat).toLowerCase();
 if(/hund|katt|djur/.test(t))return '宠物';
 if(/schampo|tvätt|sköljmedel|disk|tand|deo|dusch|handtvål|hygien|rengör|blöj|rak|hår|serum|ansikt|munskölj|make-up|micellar|intim|toalett|hushållspapper|luft|avfall|fryspås|servett|textil|bindor|body lotion/.test(t))return '日用';
 if(/rosor|rosbuk|krysant|socka|ljus/.test(t))return '其他';
 if(/äpp|druv|mango|citron|tomat|rotfrukt|sötpotatis|pumpor|betor|bryssel|champinjon|lök|banan|paprika|brysselkål|gurka|passionsfrukt|sallad/.test(t)&&!/passerade|krossade|torkad|must|munk|gelé|ketchup/.test(t))return '蔬果';
 if(/fisk|sej|räkor|revben|högrev|oxbringa|lever|falukorv|kamben|lax|kyckling|fläsk|nötfär|kött|kalv|fransyska|lamm|lövbiff|bacon|skink|schnitzel|cevap|pork|älg|korv|salame|salami|pancetta|prosciutto|kebab|gyros|stillahavs/.test(t)&&!/sås/.test(t))return '肉鱼';
 if(/yoghurt|kvarg|grädd|burrata|ost|präst|herrgård|grevé|jarlsberg|appenzeller|brie|milkshake|prote in/.test(t))return '乳品';
 if(/bröd|fralla|kusar|lingongrova|jollekaka|ciabatta|pane|gårdsgoda/.test(t))return '面包';
 if(/chips|glass|choklad|lakrits|tuggummi|smash|stycksak|bilar|skumtomt|biscoff|läsk|dryck|juice|frappé/.test(t))return '零食饮料';
 return '粮油速食';
}
export function normalize(raw,store){
 const result=[];
 for(const x of raw.results||[])for(const p of x.potentialPromotions||[]){
  const name=p.name||x.name||'', label=p.cartLabel||p.rewardLabel||'', quantity=num(p.qualifyingCount)||1;
  const perKg=/\/\s*kg/i.test(p.rewardLabel||label), threshold=/handla för|köp andra|vid köp|för minst/i.test(label+' '+(p.conditionLabel||''))||!!p.threshold;
  let price=p.priceUnknown?null:typeof p.price==='number'&&p.price>0?p.price:num(p.rewardLabel);
  const uncertain=price===null||/\d\s*[-–]\s*\d/.test(p.rewardLabel||'')||(/%/.test(p.rewardLabel||'')&&p.price==null);
  const unitPrice=uncertain?null:price/quantity;
  const compare=p.comparePrice||'', range=/\d[.,:]?\d*\s*[-–]\s*\d/.test(compare);
  const unitMatch=compare.match(/\/\s*(kg|l|st|tvätt)/i);const basis=unitMatch?.[1]?.toLowerCase()||null;
  const comparisonValue=range?null:num(compare);
  const description=p.description||''; const descriptionZh=ZH_DESCRIPTION[description]||p.descriptionZh||null; const reference=num(x.priceNoUnit);
  const rawSave=p.savePrice||'', hasSave=/spara/i.test(rawSave)&&!/\d[.,:]?\d*\s*[-–]\s*\d/.test(rawSave);
  const saved=hasSave?num(rawSave):null;
  // Store-supplied savings are the comparison basis; a representative variant's ordinary price may differ.
  const discount=saved!==null&&unitPrice>0&&!threshold?Math.round(saved/(unitPrice+saved)*100):null;
  const member=p.campaignType==='LOYALTY'||/klubbpris|plus|medlem/i.test(p.textLabelGenerated+' '+p.textLabel);
  const start=dateISO(p.startDate),end=dateISO(p.endDate);
  result.push({id:store.key+':'+p.code,kind:p.kind||'product',leafletPage:p.leafletPage||null,leafletImageRect:safeLeafletRect(p.leafletImageRect),originalPriceLabel:p.originalPriceLabel||'',currentListing:!!p.currentListing,productCode:p.mainProductCode||null,store:store.key,name,zh:reviewedName(name,'zh')||null,en:reviewedName(name,'en')||null,descriptionEn:EN_DESCRIPTION[description]||p.descriptionEn||null,translation:reviewedName(name,'zh')?'词库':'待翻译',translationEn:reviewedName(name,'en')?'reviewed':'missing',brand:x.manufacturer||(p.brands||[]).join(', '),size:p.weightVolume||x.displayVolume||'',description,descriptionZh,category:p.providerCategory||category(name,x.googleAnalyticsCategory),price,unitPrice,quantity,perKg,uncertain,threshold,reference,discount,savings:rawSave,discountBasis:p.savingsBasis||'stated',compare,basis,comparisonValue,range,member,limit:p.redeemLimit??p.promotionRedeemLimit??null,limitText:p.redeemLimitLabel||'',condition:p.conditionLabel||'',label,start,end,active:!!end&&end>=today()&&(start?start<=today():!!p.currentListing),image:safeImage(x.image?.url),source:store.url,url:p.productURL|| (p.mainProductCode?store.host+'/produkt/'+p.mainProductCode:store.url),deposit:/pant/i.test(compare+' '+label),frozen:/djupfryst|fryst/i.test(name+" "+description),mix:!!p.realMixAndMatch});
 }
 return [...new Map(result.map(x=>[x.id,x])).values()];
}
const TARGETS=[
 [/rotfrukt|pumpor|sötpotatis|bryssel/i,'kg',25,'适合做家常菜的蔬菜', '蔬菜'],
 [/äpp|citron|mango|passionsfrukt/i,'kg',25,'水果单价较低', '水果'],
 [/kycklingbröst/i,'kg',70,'鸡胸肉单价较低，适合分装', '鸡胸肉'],
 [/färsk fläskfilé|fläskytterfilé|fläskfärs|fläsklägg/i,'kg',75,'猪肉单价较低', '猪肉'],
 [/tofu/i,'kg',55,'日常豆制品', '豆腐'],
 [/jasminris|snabbmakaroner|spaghetti|havregryn/i,'kg',25,'主食适合按需储备', '主食'],
 [/rapsolja/i,'l',25,'常用烹饪油', '菜籽油'],
 [/olivolja/i,'l',100,'橄榄油达到参考单价', '橄榄油'],
 [/bröd|lingongrova/i,'kg',30,'面包单价较低', '面包'],
 [/präst|herrgård|grevé|hushållsost/i,'kg',75,'硬奶酪单价较低', '奶酪'],
 [/yoghurt/i,'kg',22,'日常酸奶', '酸奶'],
 [/dumplings/i,'kg',55,'方便餐单价较低', '饺子'],
 [/tvättmedel/i,'tvätt',1.3,'按每次洗涤计算比较实惠', '洗衣用品']
];
export function assess(x){
 let score=0,reasons=[];
 const target=TARGETS.find(([rx,basis])=>rx.test(x.name)&&basis===x.basis);
 if(target&&x.comparisonValue!==null&&x.comparisonValue<=target[2]){score+=55+Math.min(20,Math.round((1-x.comparisonValue/target[2])*40));reasons.push(`${target[3]}；${x.comparisonValue.toFixed(2)} kr/${x.basis} ≤ 参考阈值 ${target[2]} kr/${x.basis}`);}
 if(x.discount!==null&&x.discount>=25){score+=Math.min(35,Math.round(x.discount*.6));reasons.push(x.discountBasis==='regular'?`按官网普通价估算约 ${x.discount}% 优惠`:`官方标注节省金额对应约 ${x.discount}% 优惠`);}
 if(x.category==='零食饮料'||['其他','宠物'].includes(x.category)){score=Math.min(score,35);reasons.push('按个人需要买，优惠大不代表需要囤货');}
 if(x.threshold){score=0;reasons=['有额外消费条件，先确认是否本来就需要凑单'];}
 if(x.uncertain||x.range){score=0;reasons=['价格或规格存在范围，暂不自动评为值得买'];}
 if(x.frozen)reasons.push('冷冻商品；确认冰箱空间');
 if(x.quantity>1)reasons.push(`需一次买 ${x.quantity} 件才能享受组合价`);
 if(x.member)reasons.push('需要对应超市会员');
 if(!reasons.length)reasons=['可按需要购买；暂无足够单价依据评为高性价比'];
 if(!x.active){score=0;reasons=['优惠尚未开始、已经结束或缺少有效日期'];}
 return {score,reasons,recommended:score>=50};
}
async function getJSON(url){const source=new URL(url);const headers={Accept:'application/json','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36','Accept-Language':'sv-SE,sv;q=0.9,en;q=0.8'};if(/(hemkop|willys)\.se$/.test(source.hostname))headers.Referer=source.origin+'/erbjudanden';const r=await fetch(url,{headers,signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('来源返回 HTTP '+r.status);return r.json();}
export async function translateUnknown(items,translator){return translateItems(items,translator);}
export function safeLeafletRect(r){return r&&['x','y','w','h'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k]))&&r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=823&&r.y+r.h<=1134?{x:r.x,y:r.y,w:r.w,h:r.h}:null;}
export function safeImage(value){if(/^\/api\/citygross-image\?book=\d{1,20}&page=\d{1,2}&v=[\w-]{1,64}$/.test(String(value||'')))return value;try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='assets.axfood.se'||u.hostname==='assets.icanet.se'||u.hostname==='www.lidl.se'&&u.pathname.startsWith('/assets/')||u.hostname==='res.cloudinary.com'&&/^\/(willys-eu|hemkop-eu)\/image\/upload\//.test(u.pathname))?u.href:'';}catch{return '';}}
const memory=new Map();const MAX_AGE=6*60*60*1000;
async function previous(store,env){
 if(env.BUCKET){try{const obj=await env.BUCKET.get('stores/'+store.id+'.json');if(obj)return await obj.json();}catch{}}
 return memory.get(store.id)||SEED.find(x=>x.store.id===store.id);
}
async function fetchStore(store,env,force=false,translator=createTranslator(env)){
 const old=await previous(store,env);
 if(!force&&old&&Date.now()-Date.parse(old.fetchedAt)<MAX_AGE)return {...old,status:'cached',error:null};
 try{
  const raw=await fetchOfficialRaw(store);if(!raw.results?.length)throw Error('来源没有返回优惠，保留上次结果');
  const knownNames=new Map((old?.items||[]).map(x=>[x.name,x])),knownDescriptions=new Map((old?.items||[]).map(x=>[x.description,x]));
  const items=await translateUnknown(normalize(raw,store).map(x=>{const n=knownNames.get(x.name),d=knownDescriptions.get(x.description);return {...x,zh:x.zh||n?.zh,en:x.en||n?.en,descriptionZh:x.descriptionZh||d?.descriptionZh,descriptionEn:x.descriptionEn||d?.descriptionEn};}),translator);
  const data={store,items,leaflets:raw.leaflets||[],sourcePages:raw.sourcePages||null,fetchedAt:new Date().toISOString(),status:'live',error:null,translationDiagnostics:{missingNamesZh:items.filter(x=>!x.zh).length,missingNamesEn:items.filter(x=>!x.en).length,missingDescriptionsZh:items.filter(x=>x.description&&!x.descriptionZh).length,missingDescriptionsEn:items.filter(x=>x.description&&!x.descriptionEn).length,errors:translator.errors.slice(-5)}};
  if(env.BUCKET)await env.BUCKET.put('stores/'+store.id+'.json',JSON.stringify(data),{httpMetadata:{contentType:'application/json'}});
  memory.set(store.id,data);return data;
 }catch(e){return {store,items:old?.items||[],leaflets:old?.leaflets||[],sourcePages:old?.sourcePages||null,fetchedAt:old?.fetchedAt||null,status:'failed',error:String(e.message||e)};}
}
export async function collect(env={},force=false){
 const translator=createTranslator(env);
 const stores=await Promise.all(STORES.map(async s=>env.BUCKET?(await previous(s,env)||{store:s,items:[],fetchedAt:null,status:'failed',error:'尚未同步'}):fetchStore(s,env,force,translator)));
 await translator.save();
 for(const s of stores){s.store=STORES.find(x=>x.id===s.store.id)||s.store;s.items=s.items.map(x=>{const active=!!x.end&&x.end>=today()&&(x.start?x.start<=today():!!x.currentListing);return {...x,zh:reviewedName(x.name,'zh')||x.zh,en:reviewedName(x.name,'en')||x.en,descriptionZh:ZH_DESCRIPTION[x.description]||x.descriptionZh,descriptionEn:EN_DESCRIPTION[x.description]||x.descriptionEn,image:safeImage(x.image),active,...assess({...x,active})};});s.activeCount=s.items.filter(x=>x.active).length;s.stale=!s.fetchedAt||Date.now()-Date.parse(s.fetchedAt)>5*24*60*60*1000;s.translationMissing=s.items.filter(x=>!x.zh).length;s.translationMissingEn=s.items.filter(x=>!x.en).length;}
 return {stores,checkedAt:new Date().toISOString(),today:today(),storage:env.BUCKET?'persistent':'memory',rules:TARGETS.map(x=>({label:x[4],basis:x[1],threshold:x[2]}))};
}
export default {async fetch(request,env={},ctx){
 const path=new URL(request.url).pathname;
 if(path==='/api/citygross-image')return cityImageResponse(request,env);
 if(path==='/api/update')return publicUpdate(request,env);
 if(path==='/source.zip'&&request.method==='GET')return SOURCE_ARCHIVE?new Response(Uint8Array.from(atob(SOURCE_ARCHIVE),c=>c.charCodeAt(0)),{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="ryd-weekly-deals-source.zip"','Cache-Control':'public, max-age=3600'}}):new Response('Source archive not packaged',{status:404});
 if(path==='/api/import'){
  if(request.method!=='POST')return new Response('Method not allowed',{status:405});
  if(!env.BUCKET)return Response.json({error:'没有持久存储'},{status:503});
  const text=await request.text();if(text.length>8*1024*1024)return new Response('Payload too large',{status:413});
  if(!await verifyImport(request,text))return Response.json({error:'Unauthorized update'},{status:401,headers:{'Cache-Control':'no-store'}});
  try{
   const payload=JSON.parse(text);if(!Array.isArray(payload.stores)||payload.stores.length!==STORES.length)throw Error('必须提供所有指定门店的结果');
   const seen=new Set();
   for(const record of payload.stores){
    const store=STORES.find(s=>s.id===record.id);if(!store||seen.has(record.id))throw Error('门店编号无效或重复');seen.add(record.id);
    if(record.error){const old=await previous(store,env);if(old)await env.BUCKET.put('stores/'+store.id+'.json',JSON.stringify({...old,status:'failed',error:String(record.error).slice(0,400)}));continue;}
    if(record.identity?.name!==store.officialName||String(record.identity?.storeId)!==store.id)throw Error('门店身份不匹配');
    if(!Array.isArray(record.raw?.results)||!record.raw.results.length||record.raw.results.length>1500)throw Error('优惠数据缺失');
    const stamp=Date.parse(record.fetchedAt);if(!Number.isFinite(stamp)||Math.abs(Date.now()-stamp)>20*60*1000)throw Error('抓取时间不正确');
    const translated=new Map((record.translated||[]).map(x=>[x.id,x]));
    const items=normalize(record.raw,store).map(x=>{const t=translated.get(x.id);return {...x,zh:x.zh||(typeof t?.zh==='string'?t.zh.slice(0,300):null),en:x.en||(typeof t?.en==='string'?t.en.slice(0,300):null),descriptionZh:x.descriptionZh||(typeof t?.descriptionZh==='string'?t.descriptionZh.slice(0,1000):null),descriptionEn:x.descriptionEn||(typeof t?.descriptionEn==='string'?t.descriptionEn.slice(0,1000):null),translation:x.zh?'词库':t?.zh?'机器翻译':'翻译暂不可用',translationEn:x.en?'reviewed':t?.en?'machine':'missing'};});
    const data={store,items,leaflets:record.raw.leaflets||[],sourcePages:record.raw.sourcePages||null,fetchedAt:record.fetchedAt,status:'live',error:null,translationDiagnostics:{missingNamesZh:items.filter(x=>!x.zh).length,missingNamesEn:items.filter(x=>!x.en).length,missingDescriptionsZh:items.filter(x=>x.description&&!x.descriptionZh).length,missingDescriptionsEn:items.filter(x=>x.description&&!x.descriptionEn).length,errors:[]}};
    await env.BUCKET.put('stores/'+store.id+'.json',JSON.stringify(data),{httpMetadata:{contentType:'application/json'}});memory.set(store.id,data);
   }
   return Response.json(await collect(env),{headers:{'Cache-Control':'no-store'}});
  }catch(e){return Response.json({error:'导入失败：'+e.message},{status:400});}
 }
 if(path==='/api/deals'||path==='/api/refresh'){
  if(path==='/api/deals'&&request.method!=='GET')return new Response('Method not allowed',{status:405});
  if(path==='/api/refresh'&&request.method!=='POST')return new Response('请使用 POST',{status:405});
  if(path==='/api/refresh'&&env.BUCKET)return publicUpdate(request,env);
  if(path==='/api/deals'&&env.BUCKET&&new URL(request.url).searchParams.has('checkSource')){
   const data=await collect(env);if(data.stores.some(s=>!s.fetchedAt||Date.now()-Date.parse(s.fetchedAt)>MAX_AGE)){
    const updated=await publicUpdate(new Request(new URL('/api/update',request.url),{method:'POST'}),env);const result=await updated.json();return Response.json(result.data||await collect(env),{headers:{'Cache-Control':'no-store'}});
   }
  }
  try{const data=await collect(env,path==='/api/refresh');return Response.json(data,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch(e){return Response.json({error:'更新失败：'+e.message},{status:502});}
 }
 if(path!=='/')return new Response('Not found',{status:404});
 return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; img-src 'self' https://assets.axfood.se https://assets.icanet.se https://www.lidl.se https://res.cloudinary.com data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'self' https://chatgpt.com https://*.openai.com"}});
}};
export async function verifyImport(request,body){
 try{
  const stamp=request.headers.get('X-Ryd-Update-Time'),signature=request.headers.get('X-Ryd-Update-Signature');
  if(!stamp||!/^\d{13}$/.test(stamp)||Math.abs(Date.now()-Number(stamp))>300000||!signature)return false;
  const bytes=Uint8Array.from(atob(signature),x=>x.charCodeAt(0));if(bytes.length!==64)return false;
  const key=await crypto.subtle.importKey('jwk',IMPORT_PUBLIC_KEY,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,bytes,new TextEncoder().encode(stamp+'\n'+body));
 }catch{return false;}
}
