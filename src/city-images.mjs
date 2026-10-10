const publicHeaders={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'};
const publications=new Map();
export async function loadCityPublication(url){
 if(!/^https:\/\/online\.flippingbook\.com\/view\/\d+\/$/.test(url))throw Error('宣传册地址无效');
 const cached=publications.get(url);if(cached&&Date.now()-cached.at<240000)return cached.promise;
 const promise=(async()=>{
  const r=await fetch(url,{headers:publicHeaders,signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('宣传册 HTTP '+r.status);
  const html=await r.text(),root=html.match(/\bContentRoot:\s*'([^']+)'/)?.[1],privateRoot=html.match(/PrivateContentRoot:\s*'([^']+)'/)?.[1];
  const m=html.match(/(?:var|let|const) initialPolicies\s*=\s*([\s\S]*?);/);
  if(!root||!privateRoot||!m||![root,privateRoot].every(u=>/^https:\/\/d[\w]+\.cloudfront\.net\/[\w/-]+\/$/.test(u)))throw Error('宣传册公开资源格式已变化');
  return {root,privateRoot,version:root.split('/').at(-2),policies:JSON.parse(m[1])};
 })();
 publications.set(url,{at:Date.now(),promise});if(publications.size>8)publications.delete(publications.keys().next().value);
 try{return await promise;}catch(e){publications.delete(url);throw e;}
}
export async function fetchCityAsset(publication,url,maxBytes){
 if(![publication.root,publication.privateRoot].some(root=>url.startsWith(root)))throw Error('宣传册资源地址无效');
 const policy=publication.policies.find(p=>url.replace(/^https?/,'').startsWith(p.PathPrefix));if(!policy)throw Error('宣传册公开资源不可用');
 // The anonymous publisher supplies expiring read policies. Keep them server-side.
 const r=await fetch(url+'?'+new URLSearchParams({Policy:policy.Policy,Signature:policy.Signature,'Key-Pair-Id':policy.KeyId}),{headers:publicHeaders,signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('宣传册资源 HTTP '+r.status);
 const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>maxBytes)throw Error('宣传册资源大小异常');return bytes;
}
export function composeCityPageImage(raster,vector){
 const magic=(start,end)=>String.fromCharCode(...raster.slice(start,end));
 const mime=magic(0,4)==='RIFF'&&magic(8,12)==='WEBP'?'webp':raster[0]===255&&raster[1]===216&&raster[2]===255?'jpeg':raster[0]===137&&magic(1,4)==='PNG'?'png':null;
 if(!mime)throw Error('宣传册图片格式异常');
 const svg=vector.replace(/^\s*<\?xml[^>]*>\s*/,'').replace(/(<\/?)(?:svg:)/g,'$1');
 if(!/^<svg\b/.test(svg)||!/<\/svg>\s*$/.test(svg)||/<!DOCTYPE|<!ENTITY|<(?:[\w-]+:)?(?:script|foreignObject|iframe|object|embed)\b|\son[\w-]+\s*=|(?:href|src)\s*=\s*["'](?!#|data:image\/(?:png|jpeg|webp);base64,)|url\(\s*["']?(?!data:font\/|#)/i.test(svg))throw Error('宣传册图层包含不支持的内容');
 let binary='';for(let i=0;i<raster.length;i+=8192)binary+=String.fromCharCode(...raster.slice(i,i+8192));
 return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="822" height="1133" viewBox="0 0 822 1133"><image width="822" height="1133" href="data:image/'+mime+';base64,'+btoa(binary)+'"/>'+svg.replace(/\bwidth="[^"]*"/,'width="822"').replace(/\bheight="[^"]*"/,'height="1133"')+'</svg>';
}
export const cityImageHeaders={'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; sandbox",'Cross-Origin-Resource-Policy':'same-origin'};
