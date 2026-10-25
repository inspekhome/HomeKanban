'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../app/public/photo-editor');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('both sketches have one baseline and the correct number of parallel arrowheads',()=>{
 for(const [type,count] of [['arrow-row',7],['end-arrows',2]]){
  const s={type,x1:200,y1:500,x2:800,y2:500},g=P.arrowGroup(s);assert.equal(g.arrows.length,count);near(g.arrows[0].base.x,200);near(g.arrows.at(-1).base.x,800);
  for(const a of g.arrows){near(a.base.y,500);near(a.tip.x,a.base.x);assert.ok(a.tip.y<500);assert.ok(a.head.every(p=>p.y>a.tip.y));}
  assert.ok(P.hit(s,g.center,8));assert.equal(P.hit(s,{x:1000,y:700},8),false);
  const points=g.arrows.flatMap(a=>[a.base,a.tip,...a.head]),b=P.bounds(s);assert.ok(points.every(p=>p.x>=b.left&&p.x<=b.right&&p.y>=b.top&&p.y<=b.bottom));
 }
});
test('resize scales both dimensions, arrow height is independent, and arbitrary rotation preserves shape geometry',()=>{
 const m=P.model('test',1600,1200),s={type:'arrow-row',x1:400,y1:700,x2:1000,y2:700,height:200};
 P.editGroup(s,{...s},'2',{x:1120,y:700},{x:1000,y:700},m);near(P.arrowGroup(s).length,720);near(s.height,240);
 const before={...s},g=P.arrowGroup(s),a=.7,start={x:g.center.x,y:g.center.y-400},end={x:g.center.x+400*Math.sin(a),y:g.center.y-400*Math.cos(a)};
 P.editGroup(s,before,'rotate',end,start,m);near(P.arrowGroup(s).length,720);near(s.height,240);near(Math.atan2(s.y2-s.y1,s.x2-s.x1),a);
 const rotated=P.arrowGroup(s),p={x:rotated.mid.x-rotated.nx*100,y:rotated.mid.y-rotated.ny*100};P.editGroup(s,{...s},'height',p,rotated.tipMid,m);near(s.height,-100);near(P.arrowGroup(s).length,720);
});
test('moving and resizing near a photo edge keeps the entire arrow group inside the photo',()=>{
 const m=P.model('test',1200,800),s={type:'end-arrows',x1:100,y1:500,x2:1100,y2:500,height:250};
 P.move(s,10000,-10000,m);let b=P.bounds(s);near(b.right,1200);near(b.top,0);
 P.editGroup(s,{...s},'height',{x:0,y:-5000},{x:0,y:0},m);b=P.bounds(s);assert.ok(b.left>=-1e-7&&b.top>=-1e-7&&b.right<=1200+1e-7&&b.bottom<=800+1e-7);
});
test('rendering saves red arrows without blue selection handles, including after photo rotation',()=>{
 const calls=[],ctx={};for(const name of ['clearRect','fillRect','save','restore','translate','rotate','drawImage','beginPath','moveTo','lineTo','stroke','closePath','fill','strokeRect','ellipse','fillText'])ctx[name]=(...args)=>calls.push({name,args,color:ctx.strokeStyle,fill:ctx.fillStyle});
 const m=P.model('test',1200,800);m.shapes=[{type:'arrow-row',x1:200,y1:500,x2:800,y2:500},{type:'end-arrows',x1:200,y1:700,x2:800,y2:700}];P.rotate(m,1);P.paint(ctx,m,{});
 assert.equal(calls.filter(c=>c.name==='fill').length,9);assert.ok(calls.filter(c=>c.name==='stroke'||c.name==='fill').every(c=>c.color===P.RED&&c.fill===P.RED));assert.ok(calls.some(c=>c.name==='rotate'&&c.args[0]===Math.PI/2));
});
