// Visitors can ask the server to fetch fixed official sources, never upload data.
const UPDATE_COOLDOWN=10*60*1000;
const json=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
async function readObject(env,key){const o=await env.BUCKET.get(key);return o?o.json():null;}
async function writeObject(env,key,value){await env.BUCKET.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});}
export async function updateStatus(env){
 const job=await readObject(env,'updates/current.json');
 return {job,mode:'cloud',cooldownSeconds:job?.requestedAt?Math.max(0,Math.ceil((Date.parse(job.requestedAt)+UPDATE_COOLDOWN-Date.now())/1000)):0};
}
export async function publicUpdate(request,env){
 if(!env.BUCKET){
  if(request.method==='GET')return json({job:null,mode:'local',cooldownSeconds:0});
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const data=await collect(env,true);
  return json({job:{state:data.stores.every(s=>s.status!=='failed')?'succeeded':'failed',completedAt:new Date().toISOString()},mode:'local',data});
 }
 if(request.method==='GET')return json(await updateStatus(env));
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origin not allowed'},403);
 const status=await updateStatus(env),job=status.job;
 if(job&&job.state==='processing'&&Date.now()-Date.parse(job.startedAt)<5*60*1000)return json({...status,reused:true});
 if(status.cooldownSeconds>0){
  const data=await collect(env);
  const translationRepair=await repairTranslations(env,data);
  return json({...status,reused:true,translationRepair,data:translationRepair?await collect(env):data});
 }
 const lockKey='updates/lock.json',oldLock=await env.BUCKET.get(lockKey);
 if(oldLock){const existing=await oldLock.json();if(Date.now()-existing.time<5*60*1000)return json({...await updateStatus(env),reused:true});}
 const lock=await env.BUCKET.put(lockKey,JSON.stringify({time:Date.now()}),{onlyIf:oldLock?{etagMatches:oldLock.etag}:new Headers({'If-None-Match':'*'})});
 if(!lock)return json({...await updateStatus(env),reused:true});
 const next={id:crypto.randomUUID(),state:'processing',requestedAt:new Date().toISOString(),startedAt:new Date().toISOString(),completedAt:null,error:null,changed:null};
 try{
  // Recheck after acquiring the lock in case another worker has just finished.
  const latest=await updateStatus(env);if(latest.cooldownSeconds>0)return json({...latest,reused:true});
  await writeObject(env,'updates/current.json',next);
  const previousData=await collect(env),previousFingerprint=offerFingerprint(previousData);
  const translator=createTranslator(env);
  const stores=await Promise.all(STORES.map(s=>fetchStore(s,env,true,translator)));
  await translator.save();
  for(const record of stores)if(record.status==='failed')await writeObject(env,'stores/'+record.store.id+'.json',record);
  const data=await collect(env);const successful=stores.every(s=>s.status!=='failed');
  next.state=successful?'succeeded':'failed';next.completedAt=new Date().toISOString();next.changed=successful?previousFingerprint!==offerFingerprint(data):null;
  next.error=successful?null:'Some official sources could not be collected. Previous successful data is retained.';
  await writeObject(env,'updates/current.json',next);return json({...await updateStatus(env),reused:false,data});
 }catch(e){next.state='failed';next.completedAt=new Date().toISOString();next.error='Cloud sync failed; please try again later.';await writeObject(env,'updates/current.json',next);return json({...await updateStatus(env),reused:false},502);
 }finally{await env.BUCKET.delete(lockKey);}
}
function offerFingerprint(data){return JSON.stringify(data.stores.map(s=>[s.store.id,s.items.map(x=>[x.id,x.name,x.price,x.quantity,x.compare,x.size,x.brand,x.member,x.start,x.end,x.description,x.condition,x.limit]).sort((a,b)=>a[0].localeCompare(b[0]))]));}

const missingTranslations=items=>items.reduce((n,x)=>n+(!x.zh?1:0)+(!x.en?1:0)+(x.description&&!x.descriptionZh?1:0)+(x.description&&!x.descriptionEn?1:0),0);
async function repairTranslations(env,data){
 const targets=data.stores.filter(s=>missingTranslations(s.items)>0);if(!targets.length)return null;
 const key='translations/repair.json',last=await readObject(env,key);
 if(last&&Date.now()-Date.parse(last.requestedAt)<60000)return null;
 // Share the retailer-update lock, but leave its ten-minute source cooldown
 // and fetchedAt untouched. Only missing text is retried, once per minute.
 const lockKey='updates/lock.json',old=await env.BUCKET.get(lockKey);
 if(old&&Date.now()-(await old.json()).time<5*60*1000)return null;
 const lock=await env.BUCKET.put(lockKey,JSON.stringify({time:Date.now()}),{onlyIf:old?{etagMatches:old.etag}:new Headers({'If-None-Match':'*'})});if(!lock)return null;
 const result={requestedAt:new Date().toISOString(),completedAt:null,filled:0,remaining:0};
 try{
  const recent=await readObject(env,key);if(recent&&Date.now()-Date.parse(recent.requestedAt)<60000)return null;
  await writeObject(env,key,result);const translator=createTranslator(env);
  for(const record of targets){
   const before=missingTranslations(record.items),items=await translateItems(record.items,translator),remaining=missingTranslations(items);
   result.filled+=before-remaining;result.remaining+=remaining;
   await writeObject(env,'stores/'+record.store.id+'.json',{...record,items,translatedAt:new Date().toISOString(),translationDiagnostics:{missingNamesZh:items.filter(x=>!x.zh).length,missingNamesEn:items.filter(x=>!x.en).length,missingDescriptionsZh:items.filter(x=>x.description&&!x.descriptionZh).length,missingDescriptionsEn:items.filter(x=>x.description&&!x.descriptionEn).length,errors:translator.errors.slice(-5)}});
  }
  await translator.save();result.completedAt=new Date().toISOString();await writeObject(env,key,result);return result;
 }catch{return {...result,error:'Translation retry failed; saved offers are retained.'};}
 finally{await env.BUCKET.delete(lockKey);}
}
