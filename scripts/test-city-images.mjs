import assert from 'node:assert/strict';
import {composeCityPageImage} from '../src/city-images.mjs';
const raster=new TextEncoder().encode('RIFF0000WEBPtest');
const svg=content=>'<svg xmlns="http://www.w3.org/2000/svg" width="822" height="1133">'+content+'</svg>';
assert.ok(composeCityPageImage(raster,svg('<rect fill="red"/>')).includes('data:image/webp;base64,'));
const binarySize=raster.slice();binarySize.set([216,141,2,0],4);assert.ok(composeCityPageImage(binarySize,svg('')).includes('data:image/webp;base64,'));
for(const content of ['<script>alert(1)</script>','<image href="https://evil.example/x"/>','<rect onload="alert(1)"/>','<style>rect{fill:url(https://evil.example/x)}</style>','<foreignObject/>'])assert.throws(()=>composeCityPageImage(raster,svg(content)));
assert.throws(()=>composeCityPageImage(new Uint8Array(12),svg('')));
console.log('City Gross image layers reject scripts and external resources.');
