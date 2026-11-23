import assert from 'node:assert/strict';
import {composeCityPageImage,fetchCityAsset} from '../src/city-images.mjs';
const raster=new TextEncoder().encode('RIFF0000WEBPtest');
const svg=content=>'<svg xmlns="http://www.w3.org/2000/svg" width="822" height="1133">'+content+'</svg>';
assert.ok(composeCityPageImage(raster,svg('<rect fill="red"/>')).includes('data:image/webp;base64,'));
const binarySize=raster.slice();binarySize.set([216,141,2,0],4);assert.ok(composeCityPageImage(binarySize,svg('')).includes('data:image/webp;base64,'));
for(const content of ['<script>alert(1)</script>','<image href="https://evil.example/x"/>','<rect onload="alert(1)"/>','<style>rect{fill:url(https://evil.example/x)}</style>','<foreignObject/>'])assert.throws(()=>composeCityPageImage(raster,svg(content)));
assert.throws(()=>composeCityPageImage(new Uint8Array(12),svg('')));
console.log('City Gross image layers reject scripts and external resources.');
const realFetch=globalThis.fetch,root='https://d123.cloudfront.net/book/';
const publication={root,privateRoot:root,policies:[{PathPrefix:'://d123.cloudfront.net/',Policy:'test',Signature:'test',KeyId:'test'}]};
try{
 globalThis.fetch=async()=>new Response(new Uint8Array(16),{headers:{'Content-Length':'16'}});
 await assert.rejects(()=>fetchCityAsset(publication,root+'test',10));
 globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(6));c.enqueue(new Uint8Array(6));c.close();}}));
 await assert.rejects(()=>fetchCityAsset(publication,root+'test',10));
 globalThis.fetch=async()=>new Response(new Uint8Array(9));assert.equal((await fetchCityAsset(publication,root+'test',10)).length,9);
 console.log('City Gross downloads enforce limits both with and without Content-Length.');
}finally{globalThis.fetch=realFetch;}
