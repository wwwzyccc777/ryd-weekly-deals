import {STORES,normalize,translateUnknown} from '../worker/index.js';
import {signingHeaders} from './update-auth.mjs';
export async function collectAndSync(url){
async function json(url){const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
const stores=await Promise.all(STORES.map(async store=>{try{
 const identity=await json(store.host+'/axfood/rest/store/'+store.id);if(identity.name!==store.officialName||String(identity.storeId)!==store.id)throw Error('门店身份不匹配');
 let results=[],page=0,pages=1;
 do{const data=await json(store.host+'/search/campaigns/offline?'+new URLSearchParams({q:store.id,page:String(page),size:'300',disableMimerSort:'true'}));if(!Array.isArray(data.results)||!data.pagination)throw Error('官网格式已变化');results.push(...data.results);pages=data.pagination.numberOfPages||1;if(pages>12)throw Error('分页异常');page++;}while(page<pages);
 if(!results.length)throw Error('没有获取到优惠');
 const raw={results};const translated=(await translateUnknown(normalize(raw,store))).map(x=>({id:x.id,zh:x.zh,en:x.en,descriptionZh:x.descriptionZh,descriptionEn:x.descriptionEn}));
 return {id:store.id,identity:{storeId:identity.storeId,name:identity.name},raw,translated,fetchedAt:new Date().toISOString()};
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
