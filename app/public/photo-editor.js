(function(root){
 'use strict';
 const RED='#e02020',colors={'#e02020':'Red','#245c99':'Blue','#226b43':'Green','#f3ce20':'Yellow','#743a91':'Purple','#000000':'Black','#ffffff':'White'},copy=x=>JSON.parse(JSON.stringify(x)),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const icons={left:'<path d="M4 9a8 8 0 1 1 0 7M4 3v6h6"/>',right:'<path d="M20 9a8 8 0 1 0 0 7M20 3v6h-6"/>',arrow:'<path d="M4 20 20 4M10 4h10v10"/>',line:'<path d="M4 20 20 4"/>',rect:'<rect x="4" y="4" width="16" height="16" rx="1"/>',circle:'<circle cx="12" cy="12" r="8"/>',text:'<path d="m4 20 8-16 8 16M7 14h10"/>',save:'<path d="M4 3h13l4 4v14H3V3h1ZM7 3v6h10V3M7 21v-8h10v8"/>',select:'<path d="m5 3 14 10-7 1-3 7-4-18Z"/>',undo:'<path d="M4 9h10a6 6 0 0 1 0 12M4 9l6-6M4 9l6 6"/>'};
 function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;}
 icons['arrow-row']='<path d="M3 20h18M4 20V5m-2 3 2-3 2 3M12 20V5m-2 3 2-3 2 3M20 20V5m-2 3 2-3 2 3"/>';
 icons.remove='<path d="m6 6 12 12M18 6 6 18"/>';
 icons['end-arrows']='<path d="M4 20h16M4 20V8m-3 4 3-4 3 4M20 20V8m-3 4 3-4 3 4"/>';
 // Retain rendering of older end-arrow drafts; the tool is no longer offered in the UI.
 const isArrowGroup=s=>s.type==='arrow-row'||s.type==='end-arrows';
 // Both sketches are one annotation: a baseline with parallel perpendicular arrows.
 // Endpoints control span/direction; a separate height controls arrow length.
 function arrowGroup(s){
  const dx=s.x2-s.x1,dy=s.y2-s.y1,length=Math.hypot(dx,dy),ux=length?dx/length:1,uy=length?dy/length:0,nx=uy,ny=-ux;
  const height=Number.isFinite(s.height)?s.height:length*(s.type==='arrow-row'?.32:.18),count=s.type==='arrow-row'?7:2;
  const head=Math.min(Math.abs(height)*.3,length/(count-1)*.4),direction=Math.sign(height)||1;
  const arrows=Array.from({length:count},(_,i)=>{
   const base={x:s.x1+dx*i/(count-1),y:s.y1+dy*i/(count-1)},tip={x:base.x+nx*height,y:base.y+ny*height};
   return {base,tip,head:[{x:tip.x-nx*direction*head+ux*head*.45,y:tip.y-ny*direction*head+uy*head*.45},{x:tip.x-nx*direction*head-ux*head*.45,y:tip.y-ny*direction*head-uy*head*.45}]};
  });
  const mid={x:(s.x1+s.x2)/2,y:(s.y1+s.y2)/2},tipMid={x:mid.x+nx*height,y:mid.y+ny*height},center={x:mid.x+nx*height/2,y:mid.y+ny*height/2};
  return {length,ux,uy,nx,ny,height,arrows,mid,tipMid,center};
 }
 function groupHandles(s,m,scale=1){
  const g=arrowGroup(s),sign=Math.sign(g.height)||1,pad=8/scale;
  return [{name:'1',x:s.x1,y:s.y1},{name:'2',x:s.x2,y:s.y2},{name:'height',...g.tipMid},{name:'rotate',x:clamp(g.tipMid.x+g.nx*sign*28/scale,pad,m.width-pad),y:clamp(g.tipMid.y+g.ny*sign*28/scale,pad,m.height-pad)}];
 }
 function fitGroup(s,m){
  if(!isArrowGroup(s))return;let b=bounds(s);const factor=Math.min(1,m.width/(b.right-b.left||1),m.height/(b.bottom-b.top||1));
  if(factor<1){const g=arrowGroup(s);for(const k of ['1','2']){s['x'+k]=g.center.x+(s['x'+k]-g.center.x)*factor;s['y'+k]=g.center.y+(s['y'+k]-g.center.y)*factor;}s.height=g.height*factor;b=bounds(s);}
  const dx=b.left<0?-b.left:b.right>m.width?m.width-b.right:0,dy=b.top<0?-b.top:b.bottom>m.height?m.height-b.bottom:0;s.x1+=dx;s.x2+=dx;s.y1+=dy;s.y2+=dy;
 }
 function editGroup(s,before,handle,p,start,m){
  const g=arrowGroup(before);Object.assign(s,copy(before));
  if(handle==='rotate'){
   const a=Math.atan2(p.y-g.center.y,p.x-g.center.x)-Math.atan2(start.y-g.center.y,start.x-g.center.x),c=Math.cos(a),n=Math.sin(a);
   for(const k of ['1','2']){const x=before['x'+k]-g.center.x,y=before['y'+k]-g.center.y;s['x'+k]=g.center.x+x*c-y*n;s['y'+k]=g.center.y+x*n+y*c;}
  }else if(handle==='height'){
   const h=(p.x-g.mid.x)*g.nx+(p.y-g.mid.y)*g.ny;s.height=(Math.sign(h)||1)*Math.max(2,Math.abs(h));
  }else if(handle==='1'||handle==='2'){
   s['x'+handle]=p.x;s['y'+handle]=p.y;s.height=g.height*Math.hypot(s.x2-s.x1,s.y2-s.y1)/(g.length||1);
  }else move(s,p.x-start.x,p.y-start.y,m);
  fitGroup(s,m);
 }
 function model(src,width,height){return {src,width,height,turns:0,shapes:[]};}
 function size(m){return m.turns%2?{width:m.height,height:m.width}:{width:m.width,height:m.height};}
 function toView(p,m){const {width:w,height:h}=m;switch(m.turns){case 1:return {x:h-p.y,y:p.x};case 2:return {x:w-p.x,y:h-p.y};case 3:return {x:p.y,y:w-p.x};default:return {...p};}}
 function toBase(p,m){const {width:w,height:h}=m;switch(m.turns){case 1:return {x:p.y,y:h-p.x};case 2:return {x:w-p.x,y:h-p.y};case 3:return {x:w-p.y,y:p.x};default:return {...p};}}
 function rotate(m,delta){m.turns=(m.turns+delta+4)%4;return m;}
 function add(m,type){
  if(!['arrow','line','arrow-row','end-arrows','rect','circle','text'].includes(type))throw Error('Unknown photo tool.');
  const n=m.shapes.length%5,dx=n*m.width*.035,dy=n*m.height*.035;
  const shape={type,x1:m.width*.24+dx,y1:m.height*.25+dy,x2:m.width*.63+dx,y2:m.height*.63+dy};
  if(type==='text'){shape.text='';shape.fontSize=Math.max(20,Math.min(m.width,m.height)*.055);shape.y2=shape.y1+shape.fontSize*2.6;}
  m.shapes.push(shape);return m.shapes.length-1;
 }
 function bounds(s){const points=isArrowGroup(s)?arrowGroup(s).arrows.flatMap(a=>[a.base,a.tip,...a.head]):[{x:s.x1,y:s.y1},{x:s.x2,y:s.y2}];return {left:Math.min(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))};}
 function move(s,dx,dy,m){const b=bounds(s);dx=clamp(dx,-b.left,m.width-b.right);dy=clamp(dy,-b.top,m.height-b.bottom);s.x1+=dx;s.x2+=dx;s.y1+=dy;s.y2+=dy;}
 function hit(s,p,tolerance){
  if(isArrowGroup(s)){const g=arrowGroup(s),x=(p.x-s.x1)*g.ux+(p.y-s.y1)*g.uy,y=(p.x-s.x1)*g.nx+(p.y-s.y1)*g.ny;return x>=-tolerance&&x<=g.length+tolerance&&y>=Math.min(0,g.height)-tolerance&&y<=Math.max(0,g.height)+tolerance;}
  if(s.type==='line'||s.type==='arrow'){const dx=s.x2-s.x1,dy=s.y2-s.y1,t=clamp(((p.x-s.x1)*dx+(p.y-s.y1)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-s.x1-t*dx,p.y-s.y1-t*dy)<=tolerance;}
  const b=bounds(s);return p.x>=b.left-tolerance&&p.x<=b.right+tolerance&&p.y>=b.top-tolerance&&p.y<=b.bottom+tolerance;
 }
 function textLines(ctx,text,width){
  const lines=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>width){lines.push(line);line=word;}else line=next;}lines.push(line);}return lines;
 }
 function paint(ctx,m,img){
  const d=size(m);ctx.clearRect(0,0,d.width,d.height);ctx.fillStyle='#fff';ctx.fillRect(0,0,d.width,d.height);ctx.save();
  if(m.turns===1){ctx.translate(m.height,0);ctx.rotate(Math.PI/2);}if(m.turns===2){ctx.translate(m.width,m.height);ctx.rotate(Math.PI);}if(m.turns===3){ctx.translate(0,m.width);ctx.rotate(-Math.PI/2);}
  ctx.drawImage(img,0,0,m.width,m.height);const stroke=Math.max(3,Math.min(m.width,m.height)*.005);ctx.strokeStyle=RED;ctx.fillStyle=RED;ctx.lineWidth=stroke;ctx.lineCap='round';ctx.lineJoin='round';
  for(const s of m.shapes){ctx.strokeStyle=Object.hasOwn(colors,s.color)?s.color:RED;ctx.fillStyle=ctx.strokeStyle;const b=bounds(s);ctx.beginPath();
   if(isArrowGroup(s)){const g=arrowGroup(s);ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);for(const a of g.arrows){ctx.moveTo(a.base.x,a.base.y);ctx.lineTo(a.tip.x,a.tip.y);}ctx.stroke();for(const a of g.arrows){ctx.beginPath();ctx.moveTo(a.tip.x,a.tip.y);for(const p of a.head)ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fill();}}
   if(s.type==='arrow'||s.type==='line'){ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();if(s.type==='arrow'){const a=Math.atan2(s.y2-s.y1,s.x2-s.x1),h=stroke*5;ctx.beginPath();ctx.moveTo(s.x2,s.y2);ctx.lineTo(s.x2-h*Math.cos(a-.45),s.y2-h*Math.sin(a-.45));ctx.lineTo(s.x2-h*Math.cos(a+.45),s.y2-h*Math.sin(a+.45));ctx.closePath();ctx.fill();}}
   if(s.type==='rect')ctx.strokeRect(b.left,b.top,b.right-b.left,b.bottom-b.top);
   if(s.type==='circle'){ctx.ellipse((b.left+b.right)/2,(b.top+b.bottom)/2,Math.max(1,(b.right-b.left)/2),Math.max(1,(b.bottom-b.top)/2),0,0,2*Math.PI);ctx.stroke();}
   if(s.type==='text'){ctx.font=`600 ${s.fontSize}px "Segoe UI", Arial, sans-serif`;ctx.textBaseline='top';textLines(ctx,s.text,b.right-b.left).forEach((line,i)=>ctx.fillText(line,b.left,b.top+i*s.fontSize*1.2));}
  }ctx.restore();
 }
 async function load(src){const img=new Image();img.src=src;await img.decode();return img;}
 function canvasFor(m,img){const c=document.createElement('canvas'),d=size(m);c.width=d.width;c.height=d.height;paint(c.getContext('2d'),m,img);return c;}
 function encode(m,img){const src=canvasFor(m,img).toDataURL('image/jpeg',.94);if(src.length>12e6)throw Error('The edited photo is too large to save.');return src;}
 async function turn(src,delta,previous=null,undoHistory=[]){const m=previous?copy(previous):null,img=await load(m?.src||src),next=m||model(src,img.naturalWidth,img.naturalHeight);const history=[...undoHistory,copy(next)].slice(-50);rotate(next,delta);return {model:next,src:encode(next,img),history};}
 async function mount(host,{src,pending=null,undoHistory=[],tool='select',color=RED,maxHeight=300,onChange=()=>{},onState=()=>{}}){
  const img=await load(pending?.src||src);let m=pending?copy(pending):model(src,img.naturalWidth,img.naturalHeight),selected=-1,gesture=null,history=copy(undoHistory),disposed=false,currentTool=tool,currentColor=color,textStart=null,initial=JSON.stringify(m);
  host.innerHTML='<canvas tabindex="0" class="photo-inline-canvas" role="img" aria-label="Photo drawing area. Choose a tool, then click two points or drag. For arrow groups, drag the end handles to resize, the middle handle to change arrow height, and the blue handle to rotate. Press Escape to select and move marks."></canvas><input class="photo-inline-text" aria-label="Text on photo" placeholder="Type on photo" maxlength="200" hidden>';
  const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d'),input=host.querySelector('input');host.draggable=false;host.setAttribute('role','group');host.classList.add('photo-inline-active');
  const changed=()=>JSON.stringify(m)!==initial,checkpoint=()=>{history.push(copy(m));if(history.length>50)history.shift();};
  const state=()=>({tool:currentTool,color:currentColor,selected:selected>=0,canUndo:!!history.length,changed:changed()||!!pending});
  function notify(commit=true){if(disposed)return;if(commit)onChange({model:copy(m),src:encode(m,img),history:copy(history)});onState(state());}
  function fit(){const d=size(m),height=typeof maxHeight==='function'?maxHeight():maxHeight,scale=Math.max(.01,Math.min((host.clientWidth||300)/d.width,height/d.height,1));canvas.width=d.width;canvas.height=d.height;canvas.style.width=d.width*scale+'px';canvas.style.height=d.height*scale+'px';return scale;}
  function redraw(){
   if(disposed)return;const scale=fit();paint(ctx,gesture?.mode==='draw'?{...m,shapes:[...m.shapes,gesture.shape]}:m,img);
   const s=m.shapes[selected];if(s&&!gesture?.shape){
    const a=toView({x:s.x1,y:s.y1},m),b=toView({x:s.x2,y:s.y2},m);ctx.save();ctx.strokeStyle='#246b9e';ctx.lineWidth=1.5/scale;ctx.setLineDash([4/scale,3/scale]);
    let handles=[a,b];
    if(isArrowGroup(s)){
     const g=arrowGroup(s),c=toView(g.arrows.at(-1).tip,m),d=toView(g.arrows[0].tip,m);ctx.beginPath();ctx.moveTo(a.x,a.y);for(const p of [b,c,d,a])ctx.lineTo(p.x,p.y);ctx.stroke();
     handles=groupHandles(s,m,scale).map(p=>({...toView(p,m),name:p.name}));const h=handles.find(p=>p.name==='height'),r=handles.find(p=>p.name==='rotate');ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(r.x,r.y);ctx.stroke();
    }else ctx.strokeRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));
    ctx.setLineDash([]);for(const p of handles){const rotation=p.name==='rotate';ctx.beginPath();ctx.arc(p.x,p.y,(rotation?8:5)/scale,0,Math.PI*2);ctx.fillStyle=rotation?'#246b9e':'#fff';ctx.fill();ctx.stroke();if(rotation){ctx.fillStyle='#fff';ctx.font=`${13/scale}px "Segoe UI", sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('↻',p.x,p.y);}}ctx.restore();
   }
   canvas.style.cursor=currentTool==='text'?'text':currentTool==='select'?'default':'crosshair';
  }
  function finishText(){if(textStart===null)return;const s=m.shapes[selected];input.hidden=true;if(s?.type==='text'&&!s.text.trim()){m.shapes.splice(selected,1);selected=-1;}textStart=null;redraw();notify();}
  function editText(index){finishText();selected=index;const s=m.shapes[index];textStart=s.text;input.value=s.text;const scale=canvas.getBoundingClientRect().width/size(m).width,p=toView({x:s.x1,y:s.y1},m),cr=canvas.getBoundingClientRect(),hr=host.getBoundingClientRect(),left=clamp(cr.left-hr.left+p.x*scale,0,Math.max(0,host.clientWidth-120));input.style.left=left+'px';input.style.top=clamp(cr.top-hr.top+p.y*scale,0,Math.max(0,host.clientHeight-34))+'px';input.style.width=Math.min(220,host.clientWidth-left)+'px';input.style.color=s.color||RED;input.hidden=false;input.focus();input.select();}
  function point(ev){const r=canvas.getBoundingClientRect(),d=size(m);return toBase({x:clamp(ev.clientX-r.left,0,r.width)*d.width/r.width,y:clamp(ev.clientY-r.top,0,r.height)*d.height/r.height},m);}
  const scale=()=>canvas.getBoundingClientRect().width/size(m).width;
  function finishShape(){if(gesture?.mode!=='draw')return;const s=gesture.shape;if(Math.hypot(s.x2-s.x1,s.y2-s.y1)*scale()>=4){checkpoint();fitGroup(s,m);m.shapes.push(s);selected=m.shapes.length-1;currentTool='select';}gesture=null;redraw();notify();}
  function cancelGesture(){if(!gesture)return;if(gesture.mode==='edit')m=history.pop();gesture=null;redraw();onState(state());}
  function setTool(next){finishText();cancelGesture();currentTool=next;selected=-1;redraw();onState(state());}
  function command(name){
   finishText();cancelGesture();if(name==='undo'){if(history.length){m=history.pop();selected=-1;notify();}}
   else if(name==='delete'){if(selected>=0){checkpoint();m.shapes.splice(selected,1);selected=-1;notify();}}
   else if(name==='left'||name==='right'){checkpoint();rotate(m,name==='left'?-1:1);notify();}
   else setTool(name);redraw();onState(state());
  }
  function setColor(value){if(!Object.hasOwn(colors,value))return;finishText();currentColor=value;if(selected>=0){checkpoint();m.shapes[selected].color=value;notify();}redraw();onState(state());}
  canvas.addEventListener('pointerdown',ev=>{
   if(ev.button!==0)return;ev.preventDefault();ev.stopPropagation();finishText();canvas.focus({preventScroll:true});const p=point(ev);
   if(currentTool==='text'){checkpoint();const fontSize=Math.max(20,16/scale()),width=Math.min(m.width*.5,200/scale());m.shapes.push({type:'text',x1:p.x,y1:p.y,x2:Math.min(m.width,p.x+width),y2:Math.min(m.height,p.y+fontSize*2.6),text:'',fontSize,color:currentColor});selected=m.shapes.length-1;currentTool='select';editText(selected);redraw();onState(state());return;}
   if(currentTool!=='select'){
    if(gesture?.mode==='draw'){gesture.shape.x2=p.x;gesture.shape.y2=p.y;finishShape();return;}
    gesture={mode:'draw',id:ev.pointerId,start:p,shape:{type:currentTool,x1:p.x,y1:p.y,x2:p.x,y2:p.y,color:currentColor},held:true};canvas.setPointerCapture(ev.pointerId);redraw();return;
   }
   const s=m.shapes[selected],t=9/scale();let handle=null;
   if(s){if(isArrowGroup(s))handle=groupHandles(s,m,scale()).find(h=>Math.hypot(p.x-h.x,p.y-h.y)<t)?.name||null;else if(Math.hypot(p.x-s.x1,p.y-s.y1)<t)handle='1';else if(Math.hypot(p.x-s.x2,p.y-s.y2)<t)handle='2';}
   if(!handle)selected=m.shapes.findLastIndex(s=>hit(s,p,t));
   if(selected>=0){checkpoint();gesture={mode:'edit',id:ev.pointerId,start:p,shapeBefore:copy(m.shapes[selected]),handle};canvas.setPointerCapture(ev.pointerId);currentColor=m.shapes[selected].color||RED;}
   redraw();onState(state());
  });
  canvas.addEventListener('pointermove',ev=>{if(!gesture)return;const p=point(ev);if(gesture.mode==='draw'){gesture.shape.x2=p.x;gesture.shape.y2=p.y;redraw();return;}if(gesture.id!==ev.pointerId)return;const s=m.shapes[selected];Object.assign(s,copy(gesture.shapeBefore));if(isArrowGroup(s))editGroup(s,gesture.shapeBefore,gesture.handle,p,gesture.start,m);else if(gesture.handle){s['x'+gesture.handle]=p.x;s['y'+gesture.handle]=p.y;if(s.type==='text')s.fontSize=clamp(Math.abs(s.y2-s.y1)/2.6,12,Math.min(m.width,m.height)*.5);}else move(s,p.x-gesture.start.x,p.y-gesture.start.y,m);redraw();});
  canvas.addEventListener('pointerup',ev=>{if(!gesture||gesture.id!==ev.pointerId)return;if(gesture.mode==='draw'){const p=point(ev);gesture.shape.x2=p.x;gesture.shape.y2=p.y;if(Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)*scale()>=4)finishShape();else gesture.held=false;}else{gesture=null;notify();redraw();}if(canvas.hasPointerCapture(ev.pointerId))canvas.releasePointerCapture(ev.pointerId);});
  canvas.addEventListener('pointercancel',()=>cancelGesture());
  canvas.addEventListener('dblclick',ev=>{const p=point(ev),index=m.shapes.findLastIndex(s=>s.type==='text'&&hit(s,p,8/scale()));if(index>=0){checkpoint();editText(index);}});
  canvas.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();cancelGesture();setTool('select');return;}if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='z'){ev.preventDefault();command('undo');return;}if(['Delete','Backspace'].includes(ev.key)){ev.preventDefault();command('delete');return;}const s=m.shapes[selected];if(ev.key==='Enter'&&s?.type==='text'){ev.preventDefault();checkpoint();editText(selected);return;}if(!s||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(ev.key))return;ev.preventDefault();checkpoint();const step=(ev.shiftKey?16:3)/scale(),a=toBase({x:0,y:0},m),b=toBase({x:ev.key==='ArrowLeft'?-step:ev.key==='ArrowRight'?step:0,y:ev.key==='ArrowUp'?-step:ev.key==='ArrowDown'?step:0},m);move(s,b.x-a.x,b.y-a.y,m);redraw();notify();});
  input.addEventListener('pointerdown',ev=>ev.stopPropagation());input.addEventListener('input',()=>{if(textStart!==null){m.shapes[selected].text=input.value;redraw();notify();}});input.addEventListener('blur',finishText);input.addEventListener('keydown',ev=>{ev.stopPropagation();if(ev.key==='Enter'){ev.preventDefault();finishText();canvas.focus();}if(ev.key==='Escape'){ev.preventDefault();m.shapes[selected].text=textStart||'';finishText();canvas.focus();}});
  const observer=new ResizeObserver(redraw);observer.observe(host);redraw();onState(state());
  return {setTool,command,setColor,get dirty(){return changed()||textStart!==null;},flush(){finishText();cancelGesture();if(changed()||pending)notify();},dispose(){disposed=true;observer.disconnect();host.classList.remove('photo-inline-active');},get model(){return copy(m);}};
 }
 const api={RED,colors,icon,model,size,toView,toBase,rotate,add,bounds,move,hit,paint,turn,mount,arrowGroup,groupHandles,editGroup};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.PhotoEditor=api;
})(typeof globalThis!=='undefined'?globalThis:this);
