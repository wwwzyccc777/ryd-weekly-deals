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
 if(status.cooldownSeconds>0)return json({...status,reused:true});
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
  const stores=await Promise.all(STORES.map(s=>fetchStore(s,env,true)));
  for(const record of stores)if(record.status==='failed')await writeObject(env,'stores/'+record.store.id+'.json',record);
  const data=await collect(env);const successful=stores.every(s=>s.status!=='failed');
  next.state=successful?'succeeded':'failed';next.completedAt=new Date().toISOString();next.changed=successful?previousFingerprint!==offerFingerprint(data):null;
  next.error=successful?null:'Some official sources could not be collected. Previous successful data is retained.';
  await writeObject(env,'updates/current.json',next);return json({...await updateStatus(env),reused:false,data});
 }catch(e){next.state='failed';next.completedAt=new Date().toISOString();next.error='Cloud sync failed; please try again later.';await writeObject(env,'updates/current.json',next);return json({...await updateStatus(env),reused:false},502);
 }finally{await env.BUCKET.delete(lockKey);}
}
function offerFingerprint(data){return JSON.stringify(data.stores.map(s=>[s.store.id,s.items.map(x=>[x.id,x.name,x.price,x.quantity,x.compare,x.size,x.brand,x.member,x.start,x.end,x.description,x.condition,x.limit]).sort((a,b)=>a[0].localeCompare(b[0]))]));}
