import {mkdirSync,writeFileSync} from 'node:fs';
const get=async(url,headers={})=>{const r=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Official source HTTP '+r.status);return r.json();};
const token=await get('https://www.ica.se/e11/public-access-token');
if(token.isAnonymous!==true||!token.publicAccessToken)throw Error('Anonymous official token unavailable');
const offers=await get('https://apim-pub.gw.ica.se/sverige/digx/offerreader/v1/offers/store/8900',{Authorization:'Bearer '+token.publicAccessToken});
if(!Array.isArray(offers)||offers.length<10||!offers.every(x=>x.stores?.some(s=>String(s.BMSStoreId)==='8900'&&s.storeMarketingName==='Maxi ICA Stormarknad Linköping')))throw Error('Official store identity mismatch');
mkdirSync('published',{recursive:true});
writeFileSync('published/ica.json',JSON.stringify({source:'ica-official',accountNumber:'1003823',bmsId:'8900',fetchedAt:new Date().toISOString(),offers}));
console.log('Collected '+offers.length+' verified public ICA offers. No anonymous access token is saved.');
