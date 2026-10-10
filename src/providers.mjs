import {cityPDFPages,cityPageProducts} from './city-leaflet.mjs';
// Public retailer data only. Never evaluate scripts received from a retailer.
const SOURCE_HEADERS={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36','Accept-Language':'sv-SE,sv;q=0.9,en;q=0.8'};
async function sourceText(url,headers={}){const r=await fetch(url,{headers:{...SOURCE_HEADERS,...headers},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('官方来源返回 HTTP '+r.status);return r.text();}
async function sourceJSON(url,headers={}){return JSON.parse(await sourceText(url,{Accept:'application/json',...headers}));}
export function decodeHTML(s){return String(s||'').replace(/&(#x[\da-f]+|#\d+|quot|apos|amp|lt|gt|nbsp|ouml|auml|aring|Ouml|Auml|Aring);/gi,(all,key)=>{if(key[0]==='#'){const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):all;}return ({quot:'"',apos:"'",amp:'&',lt:'<',gt:'>',nbsp:' ',ouml:'ö',auml:'ä',aring:'å',Ouml:'Ö',Auml:'Ä',Aring:'Å'})[key]||all;});}
const plain=s=>decodeHTML(String(s||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function mapped(name,brand,size,description,p,image=''){return {name,manufacturer:brand,displayVolume:size,image:{url:image},potentialPromotions:[{name,description,weightVolume:size,...p}]};}
export function parseICA(html,store){
 const m=html.match(/window\.__INITIAL_DATA__\s*=\s*([\s\S]*?)<\/script>/);if(!m)throw Error('ICA 官方优惠格式已变化');
 // The SSR state is JSON with two inert placeholders. Parse data, never run JavaScript.
 const state=JSON.parse(m[1].trim().replace(/;$/,'').replace(/"(?:\\.|[^"\\])*"|undefined|new Map\(\[\]\)/g,v=>v==='undefined'||v==='new Map([])'?'null':v));
 const identity=state.generic?.headerData?.store;if(identity?.name!==store.officialName||String(identity.accountNumber)!==store.id)throw Error('ICA 门店身份不匹配');
 const offers=state.offers?.weeklyOffers;if(!Array.isArray(offers)||!offers.length)throw Error('ICA 没有返回门店优惠');
 return {results:offers.filter(x=>x.stores?.some(s=>String(s.BMSStoreId)==='8900'&&s.storeInd===true)).map(x=>{
  const d=x.details||{},m=x.parsedMechanics||{},local=x.stores.find(s=>String(s.BMSStoreId)==='8900'),fixed=m.benefitType==='FIXED'&&m.type==='Standard',price=fixed?num(m.value2):null,quantity=Math.max(1,num(m.quantity)||1),perKg=/\/kg\b/i.test(m.value4||d.mechanicInfo||'');
  const reference=/^\d+[,.]?\d*$/.test(String(local.regularPrice))?num(local.regularPrice):null;
  const saving=fixed&&!perKg&&reference>price/quantity?reference-price/quantity:null;
  const image=x.eans?.[0]?.image||'';
  return mapped(d.name,d.brand,d.packageInformation,[d.customerInformation,d.disclaimer,x.condition,x.restriction].filter(Boolean).join(' · '),{code:String(x.id),price,priceUnknown:price===null,qualifyingCount:quantity,rewardLabel:d.mechanicInfo,comparePrice:x.comparisonPrice,startDate:x.validFrom||null,endDate:x.validTo,currentListing:true,savingsBasis:'regular',savePrice:saving!==null?'Spara '+(saving*quantity).toFixed(2)+' kr':'',campaignType:x.traits?.includes('Stammis')?'LOYALTY':'PUBLIC',redeemLimit:/Max\s+(\d+)/i.test(x.restriction||'')?Number(x.restriction.match(/Max\s+(\d+)/i)[1]):null,redeemLimitLabel:x.restriction,conditionLabel:x.condition,providerCategory:/Hem & fritid/.test(x.category?.articleGroupName)?'其他':/Hälsa & skönhet/.test(x.category?.articleGroupName)?'日用':/Frukt & Grönt/.test(x.category?.articleGroupName)?'蔬果':null},image);
 })};
}
function dayOf(value){if(!value)return null;if(typeof value==='number')value=new Date(value*1000);const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm'}).format(d):null;}
export function parseLidl(html){const products=[];for(const m of html.matchAll(/data-grid-data="([^"]+)"/g)){try{const x=JSON.parse(decodeHTML(m[1]));if(x.productId&&x.keyfacts)products.push(x);}catch{throw Error('Lidl 官方商品格式已变化');}}return products;}
export function adaptLidl(products,store){
 const results=[];
 for(const x of products){
  const regions=Object.values(x.regionsV2||{});if(regions.length<7||regions.some(r=>r.status!=='ONLINE'))continue;
  // Only offers with the same official price in every Lidl Sweden region are used.
  const priceIds=[...new Set(regions.map(r=>String(r.regionPriceId)))];if(priceIds.length!==1)continue;
  const region=x.regionsPrices?.[priceIds[0]];if(!region)continue;
  for(const [key,member] of [['currentPrice',false],['currentLidlPlusPrice',true]]){
   const record=region[key];const p=member?record?.price:record;if(!p||!Number.isFinite(p.price)||p.price<=0)continue;
   const starts=[dayOf(x.storeStartDate),dayOf(p.startDate)].filter(Boolean).sort(),ends=[dayOf(x.storeEndDate),dayOf(p.endDate)].filter(Boolean).sort();
   const start=starts.at(-1)||null,end=ends[0]||null;if(!start||!end||start>end)continue;
   const description=plain(x.keyfacts.description),compare=p.basePrice?.text||'',perKg=/^\s*\/kg\s*$/i.test(compare),perL=/^\s*\/l\s*$/i.test(compare);
   const uncertain=!!p.variantsHaveDifferentPrices||!!p.discount?.showFrom||!!p.discount?.showUpTo;
   const old=p.discount?.deletedPrice||p.oldPrice,saving=Number.isFinite(old)&&old>p.price?old-p.price:null;
   const size=p.packaging?.text||x.price?.packaging?.text||'';
   results.push(mapped(x.keyfacts.title||x.title,x.brand?.name||'',size,description,{code:String(x.productId)+'-'+key+'-'+start+'-'+end,price:uncertain?null:p.price,priceUnknown:uncertain,qualifyingCount:1,rewardLabel:uncertain?'Pris varierar':`${p.price} kr${perKg?'/kg':'/st'}`,comparePrice:perKg?`${p.price} kr/kg`:perL?`${p.price} kr/l`:compare,startDate:start,endDate:end,campaignType:member?'LOYALTY':'PUBLIC',savingsBasis:'regular',savePrice:saving!==null?'Spara '+saving.toFixed(2)+' kr':'',productURL:new URL(x.canonicalUrl||store.url,store.host).href,providerCategory:x.category==='NonFood'?'其他':/Frukt|grönsak/i.test(x.keyfacts.wonCategoryPrimary||'')?'蔬果':null},x.image||''));
  }
 }
 return {results:[...new Map(results.map(x=>[x.potentialPromotions[0].code,x])).values()]};
}
export function parseFlyerDates(text,year){const m=String(text||'').match(/(\d{1,2})\/(\d{1,2})\s*(?:till|[-–])\s*(\d{1,2})\/(\d{1,2})/);if(!m)return {start:null,end:null};const start=`${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`,end=`${Number(year)+(Number(m[4])<Number(m[2])?1:0)}-${m[4].padStart(2,'0')}-${m[3].padStart(2,'0')}`;return {start,end};}
export function adaptCityFlyers(flyers,store){if(!Array.isArray(flyers)||!flyers.length)throw Error('City Gross 尚未返回宣传册');return {results:flyers.filter(x=>String(x.store)==='3231'&&/^https:\/\/online\.flippingbook\.com\/view\/\d+\/?$/.test(x.link)).map(x=>{const {start,end}=parseFlyerDates(x.subTitle,String(x.availableFrom).slice(0,4));return mapped(x.title,'City Gross','','', {code:'flyer-'+x.id+'-'+start,price:null,priceUnknown:true,qualifyingCount:1,startDate:start,endDate:end,kind:'flyer',productURL:x.link,providerCategory:'其他',flyerTitle:x.title,description:'商品价格尚未解析；请查看门店官方宣传册。',descriptionZh:'商品价格尚未解析；请查看门店官方宣传册。',descriptionEn:'Product prices are not parsed. Open the official store leaflet.'});})};}
async function fetchCityBook(flyer,store){
 const {start,end}=parseFlyerDates(flyer.subTitle,String(flyer.availableFrom).slice(0,4));
 const html=await sourceText(flyer.link);
 const root=html.match(/PrivateContentRoot:\s*'([^']+)'/)?.[1];
 const match=html.match(/(?:var|let|const) initialPolicies\s*=\s*([\s\S]*?);/);
 if(!root||!match||!/^https:\/\/d[\w]+\.cloudfront\.net\/[\w/-]+\/$/.test(root))throw Error('宣传册公开下载格式已变化');
 const policies=JSON.parse(match[1]);const url=root+'common/downloads/publication.pdf';
 const policy=policies.find(p=>url.replace(/^https?/,'').startsWith(p.PathPrefix));
 if(!policy)throw Error('宣传册公开下载链接不可用');
 // Read policies supplied to every anonymous visitor by the official publisher.
 // They expire and are never saved in the public dataset or source archive.
 const r=await fetch(url+'?'+new URLSearchParams({Policy:policy.Policy,Signature:policy.Signature,'Key-Pair-Id':policy.KeyId}),{headers:SOURCE_HEADERS,signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('宣传册下载 HTTP '+r.status);const bytes=new Uint8Array(await r.arrayBuffer());
 if(bytes.length>20000000||!new TextDecoder().decode(bytes.slice(0,5)).startsWith('%PDF'))throw Error('宣传册 PDF 格式异常');
 const pages=await cityPDFPages(bytes),offers=cityPageProducts(pages);
 if(offers.length<10)throw Error('宣传册商品解析不足，保留上次结果');
 const results=offers.map(x=>{
  let offerStart=start,offerEnd=end;
  const offset=(n)=>{const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  if(/från tisdag/i.test(x.description))offerStart=offset(1);
  if(/gäller torsdag\s*[-–]\s*fredag/i.test(x.description)){offerStart=offset(3);offerEnd=offset(4);}
  const hg=x.unit==='/hg',price=x.price===null?null:hg?Math.round(x.price*1000)/100:x.price;
  let compare=x.description.match(/Jfr\.\s*pris\s+(.+?)(?:\.\s|$)/i)?.[1]||(/\/(kg|hg)/.test(x.unit)?`${price} kr/kg`:'');
  const size=x.description.match(/(?:Ca\s+)?\d+(?:[,.]\d+)?(?:\s*[-–]\s*\d+(?:[,.]\d+)?)?\s*(?:kg|g|ml|cl|lit|pack)\b/i)?.[0]||'';
  const exactSize=size.match(/^(\d+(?:[,.]\d+)?)\s*(kg|g|ml|cl|lit)$/i);
  if(!compare&&price!==null&&exactSize&&!/\/(kg|hg)/.test(x.unit)){
   const u=exactSize[2].toLowerCase(),volume=Number(exactSize[1].replace(',','.'))/({kg:1,g:1000,lit:1,ml:1000,cl:100}[u]);
   compare=`${(price/x.quantity/volume).toFixed(2)} kr/${/^(kg|g)$/.test(u)?'kg':'l'}`;
  }
  const limit=x.description.match(/Max\s+(\d+)\s*([^.]*)/i);
  const code=[flyer.link.match(/\/view\/(\d+)/)[1],x.name,x.description,x.price,x.quantity,x.member,offerStart,offerEnd].join('|');
  return mapped(x.name,'',size,x.description,{code,price,priceUnknown:price===null,qualifyingCount:x.quantity,rewardLabel:x.percent!==null?`${x.percent}% rabatt`:`${price} kr${/\/(kg|hg)/.test(x.unit)?'/kg':x.quantity>1?' för '+x.quantity:'/st'}`,comparePrice:compare.replace(/\/lit\b/g,'/l'),startDate:offerStart,endDate:offerEnd,campaignType:x.member?'LOYALTY':'PUBLIC',redeemLimit:limit?Number(limit[1]):null,redeemLimitLabel:limit?.[0]||'',productURL:flyer.link+x.page+'/',leafletPage:x.page,originalPriceLabel:hg?`${x.price} kr/hg`:'',providerCategory:/buffé|Bamse|Byggsats|Halloween|ljus|skål|hink|form|jacka|leggings|Cozy/.test(x.name)?'其他':null});
 });
 const unique=[...new Map(results.map(x=>[x.potentialPromotions[0].code,x])).values()];
 return {results:unique,leaflet:{title:flyer.title,url:flyer.link,start,end,pageCount:pages.length,parsedProducts:unique.length}};
}
export async function fetchOfficialRaw(store){
 if(store.provider==='ica')return parseICA(await sourceText(store.url),store);
 if(store.provider==='lidl'){
  const [home,identity]=await Promise.all([sourceText(store.host+'/'),sourceText(store.identityURL)]);
  if(!identity.includes('Järdalavägen 1')||!identity.includes('Linköping'))throw Error('Lidl 门店身份不匹配');
  const paths=[...new Set([...home.matchAll(/<a\b[^>]*href="(\/c\/[^"?#]+\/a\d+)"[^>]*>([\s\S]*?)<\/a>/g)].filter(m=>{const text=plain(m[2]);const dates=parseFlyerDates(text,Number(today().slice(0,4)));if(dates.start&&dates.end)return dates.start<=today()&&today()<=dates.end;const from=text.match(/Från\s*(\d{1,2})\/(\d{1,2})/i);if(!from)return false;const start=`${today().slice(0,4)}-${from[2].padStart(2,'0')}-${from[1].padStart(2,'0')}`;return start<=today()&&new Date(today())-new Date(start)<7*86400000;}).map(m=>m[1]))];
  if(!paths.length||paths.length>16)throw Error('Lidl 活动列表缺失或格式已变化');
  const pages=await Promise.all(paths.map(path=>sourceText(store.host+path)));return {...adaptLidl(pages.flatMap(parseLidl),store),leaflets:[{title:'Lidl reklamblad',url:store.host+'/c/reklamblad/s10018018'}],sourcePages:paths.length};
 }
 if(store.provider==='citygross'){
  const stores=await sourceJSON(store.host+'/api/v1/PageData/stores');const identity=stores.find(x=>x.data?.siteId===168)?.data;
  if(identity?.storeName!=='Linköping Tornby'||identity.id!==9097)throw Error('City Gross 门店身份不匹配');
  const number=await sourceJSON(store.host+'/api/v1/sites/168/storeNumber');if(number.storeNumber!==3231)throw Error('City Gross 店号已变化');
  const flyers=(await sourceJSON(store.host+'/api/v1/leaflets?store=3231')).filter(x=>String(x.store)==='3231'&&/^https:\/\/online\.flippingbook\.com\/view\/\d+\/?$/.test(x.link));
  const leaflets=flyers.map(x=>({...parseFlyerDates(x.subTitle,String(x.availableFrom).slice(0,4)),title:x.title,url:x.link}));
  const current=flyers.filter(x=>{const d=parseFlyerDates(x.subTitle,String(x.availableFrom).slice(0,4));return d.start&&d.start<=today()&&d.end>=today();});
  if(!current.length)throw Error('City Gross 没有当前有效的宣传册');
  const books=await Promise.all(current.map(x=>fetchCityBook(x,store)));
  return {results:books.flatMap(x=>x.results),leaflets:leaflets.map(x=>({...x,...books.find(b=>b.leaflet.url===x.url)?.leaflet}))};
 }
 const identity=await getJSON(store.host+'/axfood/rest/store/'+store.id);if(identity.name!==store.officialName||String(identity.storeId)!==store.id)throw Error('门店身份验证失败');
 let all=[],page=0,totalPages=1;
 do{const raw=await getJSON(store.host+'/search/campaigns/offline?'+new URLSearchParams({q:store.id,page:String(page),size:'300',disableMimerSort:'true'}));if(!Array.isArray(raw.results)||!raw.pagination)throw Error('优惠格式已变化');all.push(...raw.results);totalPages=raw.pagination.numberOfPages||1;if(totalPages>12)throw Error('分页数量异常');page++;}while(page<totalPages);
 return {results:all};
}
