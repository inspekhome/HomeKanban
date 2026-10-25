'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function environment(){
 const events=new Map(),ctx={measureText:t=>({width:t.length*10})};
 for(const name of ['clearRect','fillRect','save','restore','translate','rotate','drawImage','beginPath','moveTo','lineTo','stroke','closePath','fill','strokeRect','ellipse','fillText','setLineDash','arc'])ctx[name]=()=>{};
 const canvas={style:{},getContext:()=>ctx,toDataURL:()=> 'data:image/jpeg;base64,dGVzdA==',getBoundingClientRect:()=>({left:10,top:20,width:300,height:200}),addEventListener:(n,f)=>events.set('canvas:'+n,f),focus(){},setPointerCapture(){},hasPointerCapture:()=>false,releasePointerCapture(){}};
 const input={style:{},hidden:true,value:'',focus(){},select(){},addEventListener:(n,f)=>events.set('input:'+n,f)};
 const host={clientWidth:300,clientHeight:200,classList:{add(){},remove(){}},setAttribute(){},getBoundingClientRect:()=>({left:10,top:20,width:300,height:200}),querySelector:s=>s==='canvas'?canvas:input};
 const context=vm.createContext({module:{exports:{}},Image:class{naturalWidth=1200;naturalHeight=800;async decode(){}},ResizeObserver:class{observe(){}disconnect(){}},document:{createElement:()=>canvas}});
 vm.runInContext(fs.readFileSync(require.resolve('../app/public/photo-editor'),'utf8'),context);
 const pointer=(type,x,y)=>events.get('canvas:'+type)({button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}});
 return {P:context.module.exports,host,input,events,pointer};
}
test('choosing a tool adds nothing until two endpoints are set, and unfinished marks can be cancelled',async()=>{
 const c=environment(),ed=await c.P.mount(c.host,{src:'test',tool:'arrow'});assert.equal(ed.model.shapes.length,0);
 c.pointer('pointerdown',40,50);c.pointer('pointerup',40,50);assert.equal(ed.model.shapes.length,0);
 c.pointer('pointermove',220,170);c.pointer('pointerdown',220,170);c.pointer('pointerup',220,170);
 const s=ed.model.shapes[0];assert.equal(s.type,'arrow');assert.deepEqual([s.x1,s.y1,s.x2,s.y2],[120,120,840,600]);
 ed.command('line');assert.equal(ed.model.shapes.length,1);c.pointer('pointerdown',60,60);c.pointer('pointerup',60,60);ed.command('select');assert.equal(ed.model.shapes.length,1);ed.dispose();
});
test('dragging draws a shape, handles resize it, colors and Undo affect the selected mark',async()=>{
 const c=environment(),ed=await c.P.mount(c.host,{src:'test',tool:'rect'});
 c.pointer('pointerdown',40,60);c.pointer('pointermove',110,130);c.pointer('pointerup',110,130);assert.equal(ed.model.shapes.length,1);
 c.pointer('pointerdown',110,130);c.pointer('pointermove',150,150);c.pointer('pointerup',150,150);assert.equal(ed.model.shapes[0].x2,560);assert.equal(ed.model.shapes[0].y2,520);
 ed.setColor('#245c99');assert.equal(ed.model.shapes[0].color,'#245c99');ed.command('undo');assert.equal(ed.model.shapes[0].color,'#e02020');
 c.pointer('pointerdown',80,90);c.pointer('pointerup',80,90);ed.command('delete');assert.equal(ed.model.shapes.length,0);ed.dispose();
});
test('text is placed at the clicked point and entered in the photo, without a dialog',async()=>{
 const c=environment(),ed=await c.P.mount(c.host,{src:'test',tool:'text'});c.pointer('pointerdown',80,90);assert.equal(c.input.hidden,false);
 c.input.value='Leak';c.events.get('input:input')();c.events.get('input:keydown')({key:'Enter',preventDefault(){},stopPropagation(){}});
 const s=ed.model.shapes[0];assert.equal(s.text,'Leak');assert.equal(s.x1,280);assert.equal(s.y1,280);assert.equal(c.input.hidden,true);ed.flush();ed.dispose();
});

test('Undo history follows a photo across rotations and remounting',async()=>{
 const c=environment();let saved;
 const rotated=await c.P.turn('test',1);
 assert.equal(rotated.model.turns,1);assert.equal(rotated.history.length,1);
 let ed=await c.P.mount(c.host,{src:'test',pending:rotated.model,undoHistory:rotated.history,tool:'arrow',onChange:value=>saved=value});
 c.pointer('pointerdown',40,50);c.pointer('pointermove',150,150);c.pointer('pointerup',150,150);
 assert.equal(ed.model.shapes[0].color,c.P.RED);assert.equal(saved.history.length,2);ed.flush();ed.dispose();
 ed=await c.P.mount(c.host,{src:'test',pending:saved.model,undoHistory:saved.history,onChange:value=>saved=value});
 ed.command('undo');assert.equal(ed.model.shapes.length,0);assert.equal(ed.model.turns,1);
 ed.command('undo');assert.equal(ed.model.turns,0);assert.equal(saved.history.length,0);ed.dispose();
});

test('arrow row is one red mark with adjustable height, rotation, move and undo',async()=>{
 const c=environment();let saved;const ed=await c.P.mount(c.host,{src:'test',tool:'arrow-row',onChange:value=>saved=value});
 c.pointer('pointerdown',70,160);c.pointer('pointermove',250,160);c.pointer('pointerup',250,160);
 let s=ed.model.shapes[0];assert.equal(s.type,'arrow-row');assert.equal(s.color,c.P.RED);assert.equal(c.P.arrowGroup(s).arrows.length,7);assert.equal(saved.model.shapes.length,1);
 const point=p=>({x:10+p.x*.25,y:20+p.y*.25});
 let h=point(c.P.groupHandles(s,ed.model,.25).find(p=>p.name==='height'));c.pointer('pointerdown',h.x,h.y);c.pointer('pointermove',h.x,h.y-15);c.pointer('pointerup',h.x,h.y-15);
 s=ed.model.shapes[0];const height=c.P.arrowGroup(s).height;assert.ok(height>270);assert.equal(s.x1,240);assert.equal(s.x2,960);
 const g=c.P.arrowGroup(s),rotate=c.P.groupHandles(s,ed.model,.25).find(p=>p.name==='rotate'),start=point(rotate),end=point({x:g.center.x-(rotate.y-g.center.y),y:g.center.y+(rotate.x-g.center.x)});
 c.pointer('pointerdown',start.x,start.y);c.pointer('pointermove',end.x,end.y);c.pointer('pointerup',end.x,end.y);
 s=ed.model.shapes[0];assert.ok(Math.abs(s.x2-s.x1)<.001);assert.ok(Math.abs(c.P.arrowGroup(s).height-height)<.001);assert.equal(saved.model.shapes.length,1);
 const b=c.P.bounds(s);assert.ok(b.left>=0&&b.right<=1200&&b.top>=0&&b.bottom<=800);
 ed.command('undo');assert.ok(Math.abs(ed.model.shapes[0].y2-ed.model.shapes[0].y1)<.001);assert.equal(c.P.arrowGroup(ed.model.shapes[0]).height,height);
 ed.command('undo');assert.equal(c.P.arrowGroup(ed.model.shapes[0]).height,720*.32);ed.command('undo');assert.equal(ed.model.shapes.length,0);ed.dispose();
});

test('end arrows and a line coexist; remount, rotation and cancelled edits preserve marks',async()=>{
 const c=environment();let saved;let ed=await c.P.mount(c.host,{src:'test',tool:'end-arrows',onChange:value=>saved=value});
 c.pointer('pointerdown',70,140);c.pointer('pointermove',230,140);c.pointer('pointerup',230,140);assert.equal(c.P.arrowGroup(ed.model.shapes[0]).arrows.length,2);
 const before=JSON.stringify(ed.model);c.pointer('pointerdown',230,140);c.pointer('pointermove',200,170);c.events.get('canvas:pointercancel')();assert.equal(JSON.stringify(ed.model),before);
 ed.command('line');c.pointer('pointerdown',60,60);c.pointer('pointermove',200,90);c.pointer('pointerup',200,90);assert.equal(ed.model.shapes.length,2);assert.equal(ed.model.shapes[1].type,'line');assert.equal(ed.model.shapes[1].color,c.P.RED);
 ed.flush();ed.dispose();ed=await c.P.mount(c.host,{src:'test',pending:saved.model,undoHistory:saved.history,onChange:value=>saved=value});
 ed.command('right');assert.equal(ed.model.turns,1);assert.equal(ed.model.shapes[0].type,'end-arrows');ed.command('undo');assert.equal(ed.model.turns,0);ed.command('undo');assert.equal(ed.model.shapes.length,1);ed.dispose();
});
