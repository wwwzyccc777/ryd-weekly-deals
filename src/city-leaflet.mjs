import {getDocumentProxy} from 'unpdf';
import {OPS} from 'unpdf/pdfjs';

const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export function pageImageRects(operators,width,height){
 let matrix=[1,0,0,1,0,0],clip=null,pendingClip=false,stack=[],images=[];
 const bounds=(corners)=>[Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1])),Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))];
 const transform=(x,y)=>[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]];
 const intersect=(a,b)=>b?[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])]:a;
 for(let i=0;i<operators.fnArray.length;i++){
  const fn=operators.fnArray[i],a=operators.argsArray[i];
  if(fn===OPS.save)stack.push({matrix:[...matrix],clip:clip&&[...clip]});
  else if(fn===OPS.restore){const state=stack.pop();matrix=state?.matrix||[1,0,0,1,0,0];clip=state?.clip||null;}
  else if(fn===OPS.transform)matrix=multiply(matrix,a);
  else if(fn===OPS.clip||fn===OPS.eoClip)pendingClip=true;
  else if(fn===OPS.constructPath&&pendingClip&&a[2]?.length===4){const b=a[2];clip=intersect(bounds([transform(b[0],b[1]),transform(b[0],b[3]),transform(b[2],b[1]),transform(b[2],b[3])]),clip);pendingClip=false;}
  else if(fn===OPS.paintImageXObject){
   const b=intersect(bounds([[0,0],[1,0],[0,1],[1,1]].map(([x,y])=>transform(x,y))),clip);
   const x=b[0],y=b[1],w=b[2]-x,h=b[3]-y;
   if(w>=width*.98&&h>=height*.98&&x<=2&&y<=2){images=[];continue;}
   if(w>=45&&h>=40&&w<width*.8&&h<height*.7)images.push({x:x/width*822,y:(height-y-h)/height*1133,w:w/width*822,h:h/height*1133});
  }
 }
 return images;
}
function productImageRect(images,title){
 const candidates=images.filter(r=>r.y<title.y-20&&r.y+r.h>title.y-320&&r.y+r.h<title.y+160&&r.x+r.w>title.x&&r.x<title.x+220&&Math.abs(r.x+r.w/2-title.x-80)<135);
 candidates.sort((a,b)=>Math.abs(a.y+a.h-title.y)*.8+Math.abs(a.x+a.w/2-title.x-80)-Math.min(a.w*a.h/1500,30)-(Math.abs(b.y+b.h-title.y)*.8+Math.abs(b.x+b.w/2-title.x-80)-Math.min(b.w*b.h/1500,30)));
 const r=candidates[0];if(!r)return null;
 const x=Math.max(0,r.x-6),y=Math.max(0,r.y-6);
 return {x:Math.round(x),y:Math.round(y),w:Math.round(Math.min(822-x,r.w+12)),h:Math.round(Math.min(1133-y,r.h+12))};
}
// Some publisher PDFs contain an obsolete layout painted over by a full-page
// background image. Text extraction alone includes that obsolete layout.
export function coveredTextIDs(operators,width,height){
 let matrix=[1,0,0,1,0,0],stack=[],marked=[],ids=[],covered=new Set();
 for(let i=0;i<operators.fnArray.length;i++){
  const fn=operators.fnArray[i],a=operators.argsArray[i];
  if(fn===OPS.save)stack.push([...matrix]);
  else if(fn===OPS.restore)matrix=stack.pop()||[1,0,0,1,0,0];
  else if(fn===OPS.transform)matrix=multiply(matrix,a);
  else if(fn===OPS.beginMarkedContentProps){marked.push(a[1]);if(a[0]==='P'&&typeof a[1]==='number')ids.push(a[1]);}
  else if(fn===OPS.beginMarkedContent)marked.push(null);
  else if(fn===OPS.endMarkedContent)marked.pop();
  else if(fn===OPS.paintImageXObject&&Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2])>=width*height*.98&&Math.abs(matrix[1])<1&&Math.abs(matrix[2])<1){
   const left=Math.min(matrix[4],matrix[4]+matrix[0]),bottom=Math.min(matrix[5],matrix[5]+matrix[3]);
   if(left<=2&&bottom<=2&&left+Math.abs(matrix[0])>=width-2&&bottom+Math.abs(matrix[3])>=height-2)ids.forEach(id=>covered.add(id));
  }
 }
 return covered;
}
export async function cityPDFPages(bytes){
 const pdf=await getDocumentProxy(bytes,{isEvalSupported:false,verbosity:0});const pages=[];
 try{
  if(pdf.numPages>40)throw Error('宣传册页数异常');
  for(let page=1;page<=pdf.numPages;page++){
   const p=await pdf.getPage(page),v=p.getViewport({scale:1});
   const [content,operators]=await Promise.all([p.getTextContent({includeMarkedContent:true}),p.getOperatorList()]);
   const covered=coveredTextIDs(operators,v.width,v.height),marks=[],items=[];
   for(const t of content.items){
    if(t.type==='beginMarkedContentProps'||t.type==='beginMarkedContent'){marks.push(t.id?Number(t.id.match(/_mc(\d+)$/)?.[1]):null);continue;}
    if(t.type==='endMarkedContent'){marks.pop();continue;}
    if(!t.str?.trim()||marks.some(id=>covered.has(id)))continue;
    items.push({text:t.str.trim(),x:t.transform[4]/v.width*822,y:(v.height-t.transform[5])/v.height*1133,w:t.width/v.width*822,h:t.height/v.height*1133,font:t.fontName});
   }
   pages.push({page,items,images:pageImageRects(operators,v.width,v.height)});
  }
 }finally{await pdf.loadingTask.destroy();}
 return pages;
}
export function cityPageProducts(pages){
 const products=[];
 for(const {page,items,images=[]} of pages){
  const candidates=items.filter(t=>t.h>15&&t.h<20&&!/^\/|^\+|SPARA|Kampanj|^\d+\s*för$|Begränsat|parti!|pack!|Från vårt|bageri!|Storpack!|Grillade i|butiken!|Priset gäller|från tisdag/.test(t.text));
  const titles=[];
  for(const t of candidates){
   const prev=titles.find(p=>Math.abs(p.x-t.x)<2&&t.y>p.y&&t.y-p.bottom<18);
   if(prev){prev.text+=' '+t.text;prev.bottom=t.y;}else titles.push({...t,bottom:t.y});
  }
  const prices=items.filter(t=>/^\d{1,4}$/.test(t.text)&&t.h>=30);
  for(const title of titles){
   const matches=prices.filter(p=>title.y-p.y>=8&&title.y-p.y<Math.max(130,p.h*1.4)&&Math.abs(p.x-title.x)<Math.max(30,p.h*.3)).sort((a,b)=>Math.abs(a.x-title.x-8)*3+(title.y-a.y)/a.h*10-(Math.abs(b.x-title.x-8)*3+(title.y-b.y)/b.h*10));
   const p=matches[0];if(!p)continue;
   // Accept a price only for the nearest title beneath it in the same column.
   const nearer=titles.some(t=>t!==title&&t.y>p.y+8&&t.y<title.y-2&&Math.abs(t.x-title.x)<5);if(nearer)continue;
   const cents=items.find(t=>/^\d{2}$/.test(t.text)&&t.h>p.h*.42&&t.h<p.h*.58&&Math.abs(t.x-(p.x+p.w))<8&&t.y<p.y&&p.y-t.y<p.h*.6);
   const percent=items.some(t=>t.text==='%'&&Math.abs(t.x-(p.x+p.w))<8&&Math.abs(t.y-p.y)<p.h*.4);
   const amount=percent?null:Number(p.text)+(cents?Number(cents.text)/100:0);
   const unit=items.find(t=>/^\/(?:kg|hg|st|förp|portion)\b/.test(t.text)&&t.x>=p.x+p.w-8&&t.x<p.x+p.w+p.h&&Math.abs(t.y-p.y)<p.h*.25)?.text||'';
   const bundle=items.find(t=>/^\d+\s*för$/.test(t.text)&&Math.abs(t.x-p.x)<12&&t.y<p.y&&p.y-t.y<p.h*1.1)?.text;
   const count=bundle?Number(bundle.match(/\d+/)[0]):1;
   const lines=items.filter(t=>t.h>=8&&t.h<12&&Math.abs(t.x-title.x)<3&&t.y>title.bottom&&t.y<title.bottom+110).sort((a,b)=>a.y-b.y);
   const description=[];let last=title.bottom;
   for(const t of lines){if(t.y-last>22)break;description.push(t.text);last=t.y;}
   const detail=description.join(' ');
   const member=/PRIO-medlem|PRIO-pris/i.test(detail)||items.some(t=>/PRIO-pris/.test(t.text)&&Math.abs(t.x-p.x)<15&&t.y<p.y&&p.y-t.y<p.h*1.2);
   const imageRect=productImageRect(images,title)||{x:Math.max(0,Math.round(title.x-15)),y:Math.max(0,Math.round(p.y-160)),w:Math.min(300,Math.round(822-title.x+15)),h:Math.round(title.bottom-Math.max(0,p.y-160)+15)};
   products.push({name:title.text,page,imageRect,price:amount,percent:percent?Number(p.text):null,unit,quantity:count,description:detail,member});
  }
 }
 return products;
}
