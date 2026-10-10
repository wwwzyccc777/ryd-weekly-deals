import {STORES,normalize,translateUnknown,fetchOfficialRaw} from '../worker/index.js';
import {signingHeaders} from './update-auth.mjs';
export async function collectAndSync(url){
const stores=await Promise.all(STORES.map(async store=>{try{
 const raw=await fetchOfficialRaw(store);if(!raw.results?.length)throw Error("没有获取到优惠");const translated=(await translateUnknown(normalize(raw,store))).map(x=>({id:x.id,zh:x.zh,en:x.en,descriptionZh:x.descriptionZh,descriptionEn:x.descriptionEn}));
 return {id:store.id,identity:{storeId:store.id,name:store.officialName},raw,translated,fetchedAt:new Date().toISOString()};
 }catch(e){return {id:store.id,error:store.name+' 抓取失败：'+e.message};}}));
const origin=new URL(url).origin;
const body=JSON.stringify({stores}),headers=signingHeaders(body);
const r=await fetch(origin+'/api/import?sync='+Date.now(),{method:'POST',headers,body,signal:AbortSignal.timeout(90000)});
if(!r.ok)throw Error('Import failed: HTTP '+r.status);
else{const saved=await r.json();const read=await fetch(origin+'/api/deals?check='+Date.now(),{signal:AbortSignal.timeout(30000)});if(!read.ok)throw Error('读取验证失败');const back=await read.json();
 const success=back.storage==='persistent'&&back.stores.every(s=>s.status!=='failed'&&Date.now()-Date.parse(s.fetchedAt)<10*60*1000);
 return {success,storage:back.storage,stores:back.stores.map(s=>({name:s.store.name,count:s.items.length,active:s.activeCount,fetchedAt:s.fetchedAt,error:s.error,translationMissing:s.translationMissing,translationMissingEn:s.translationMissingEn})),recommended:back.stores.flatMap(s=>s.items).filter(x=>x.recommended).length};
}

}
