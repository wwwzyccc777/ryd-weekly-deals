import http from 'node:http';
import worker from '../worker/index.js';
const server=http.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const r=await worker.fetch(new Request('http://127.0.0.1:8787'+req.url,{method:req.method,headers:req.headers,...(body.length?{body}:{} )}),{},{});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch(e){res.writeHead(500);res.end(e.message);}});
server.listen(8787,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8787'));
