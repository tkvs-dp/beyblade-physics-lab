import * as THREE from 'three';
import { PROFILES, ARENA, floorHeight } from './physics.mjs';
const TAU=Math.PI*2;
const physical = (color, extra={})=>new THREE.MeshPhysicalMaterial({color,roughness:.27,metalness:0,clearcoat:.8,clearcoatRoughness:.2,...extra});
function add(parent,geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function cylinder(parent,r1,r2,h,y,mat,n=64){return add(parent,new THREE.CylinderGeometry(r1,r2,h,n),mat,0,y);}
function ring(parent,r,t,y,mat){const m=add(parent,new THREE.TorusGeometry(r,t,10,96),mat,0,y);m.rotation.x=Math.PI/2;return m;}
function extrude(parent, points, depth, y, material, bevel=.055) {
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,z)));
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,steps:1,curveSegments:24});
  g.rotateX(Math.PI/2);g.translate(0,y+depth,0);
  return add(parent,g,material);
}
function polar(r,a){return [r*Math.cos(a),r*Math.sin(a)];}
function radialPiece(parent,points,n,depth,y,material,offset=0,bevel=.055){
  for(let i=0;i<n;i++){
    const a=i*TAU/n+offset,c=Math.cos(a),s=Math.sin(a);
    extrude(parent,points.map(([x,z])=>[c*x-s*z,s*x+c*z]),depth,y,material,bevel);
  }
}
function badgeTexture(color, wings){
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
  ctx.fillStyle='#0f253c';ctx.fillRect(0,0,512,512);
  const grad=ctx.createRadialGradient(256,210,10,256,256,260);grad.addColorStop(0,color);grad.addColorStop(1,'#091a2b');ctx.fillStyle=grad;ctx.fillRect(0,0,512,512);
  ctx.translate(256,256);ctx.strokeStyle='#d9e8ef';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,216,0,TAU);ctx.stroke();
  ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,198,0,TAU);ctx.stroke();
  for(let i=0;i<48;i++){ctx.save();ctx.rotate(i*TAU/48);ctx.fillStyle=i%4===0?'#fff':'#a4c8e0';ctx.fillRect(-2,-190,4,i%4===0?15:7);ctx.restore();}
  // Original abstract rotor crest, not a copied character decal.
  for(let i=0;i<wings;i++){ctx.save();ctx.rotate(i*TAU/wings);ctx.beginPath();ctx.moveTo(0,-142);ctx.lineTo(67,-47);ctx.lineTo(27,22);ctx.lineTo(22,-57);ctx.lineTo(-23,-85);ctx.closePath();ctx.fillStyle='#e3f3ff';ctx.fill();ctx.restore();}
  ctx.fillStyle='#fff';ctx.font='bold 26px sans-serif';ctx.textAlign='center';ctx.fillText('SPIN LAB',0,164);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
}
export function createTop(profile='attack',tip='flat',color='#176fc1') {
  const p=PROFILES[profile],root=new THREE.Group();root.name='top';
  const blade=new THREE.Group(),ratchet=new THREE.Group(),bit=new THREE.Group();
  blade.name='blade';ratchet.name='ratchet';bit.name='bit';root.add(blade,ratchet,bit);
  const metal=physical('#b6c2cc',{metalness:1,roughness:.24,clearcoat:.28});
  const polished=physical('#e1e7ee',{metalness:1,roughness:.15});
  const dark=physical('#293745',{metalness:.72,roughness:.33});
  const plastic=physical(color,{roughness:.19,clearcoat:1});
  const glass=physical(color,{transmission:.12,thickness:.35,ior:1.47,roughness:.19,clearcoat:1});
  const pale=physical('#e8eef2',{roughness:.28});
  // Lower bayonet hub and actual visibly different contact profiles.
  const profiles={flat:[[0,0],[.29,0],[.34,.07],[.34,.22],[.25,.31],[.23,.54],[.46,.62],[.46,.75],[.30,.8],[0,.8]],ball:[[0,0],[.1,.018],[.23,.10],[.29,.23],[.28,.34],[.23,.46],[.23,.54],[.46,.62],[.46,.75],[.30,.8],[0,.8]],needle:[[0,0],[.045,.02],[.12,.17],[.24,.36],[.23,.54],[.46,.62],[.46,.75],[.30,.8],[0,.8]]};
  add(bit,new THREE.LatheGeometry(profiles[tip].map(v=>new THREE.Vector2(...v)),64),plastic);
  cylinder(bit,.29,.29,.56,.95,pale);
  cylinder(bit,.42,.42,.12,.70,plastic);
  for(let i=0;i<12;i++){
    const a=i*TAU/12;
    const tooth=add(bit,new THREE.BoxGeometry(.13,.20,.16),plastic,.43*Math.cos(a),.66,.43*Math.sin(a));tooth.rotation.y=-a;
  }
  // Ratchet locking tabs, molded ribs and segmented transparent housing.
  cylinder(ratchet,.88,.72,.22,1.02,dark);
  cylinder(ratchet,1.08,.92,.30,1.22,glass);
  ring(ratchet,.90,.065,1.05,plastic);ring(ratchet,1.05,.06,1.37,pale);
  radialPiece(ratchet,[[.82,-.26],[1.30,-.25],[1.44,-.05],[1.32,.24],[.84,.28]],p.wings===3?3:5,.26,1.1,glass,0,.06);
  for(let i=0;i<24;i++){
    const a=i*TAU/24;const m=add(ratchet,new THREE.BoxGeometry(.07,.20,.06),plastic,.99*Math.cos(a),1.22,.99*Math.sin(a));m.rotation.y=-a;
  }
  cylinder(ratchet,.59,.64,.2,1.47,dark,12);
  // Annular load-bearing metal ring with a real central hole.
  const shape=new THREE.Shape();shape.absarc(0,0,1.78,0,TAU,false);
  const hole=new THREE.Path();hole.absarc(0,0,.90,0,TAU,true);shape.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.20,bevelEnabled:true,bevelSize:.07,bevelThickness:.07,bevelSegments:3,curveSegments:64});geo.rotateX(Math.PI/2);geo.translate(0,1.83,0);add(blade,geo,metal);
  const wingPoints=profile==='attack'?[[1.15,-.70],[1.72,-.92],[2.23,-.83],[2.44,-.42],[2.35,-.04],[2.00,.13],[1.67,.60],[1.05,.57]]:profile==='defense'?[[1.20,-.46],[1.97,-.62],[2.35,-.39],[2.40,.06],[2.20,.42],[1.66,.59],[1.08,.38]]:[[1.20,-.38],[2.15,-.44],[2.38,-.19],[2.40,.14],[2.21,.38],[1.15,.43]];
  radialPiece(blade,wingPoints,p.wings,.30,1.78,metal,0,.055);
  const inlay=profile==='attack'?[[.72,-.34],[1.55,-.55],[2.10,-.51],[1.82,-.16],[1.47,.36],[.77,.29]]:[[.80,-.25],[1.53,-.38],[1.95,-.22],[1.61,.13],[1.12,.32],[.76,.19]];
  radialPiece(blade,inlay,p.wings,.17,2.10,glass,.035,.04);
  radialPiece(blade,[[1.35,-.32],[1.84,-.39],[1.70,-.24],[1.38,-.08]],p.wings,.025,2.30,polished,.035,.008);
  cylinder(blade,.98,1.16,.20,1.97,plastic);
  cylinder(blade,.98,.98,.22,2.22,dark,12);
  ring(blade,.93,.065,2.35,polished);
  cylinder(blade,.84,.88,.12,2.35,plastic);
  const decal=add(blade,new THREE.CircleGeometry(.79,64),new THREE.MeshStandardMaterial({map:badgeTexture(color,p.wings),roughness:.3,metalness:.25}),0,2.416);decal.rotation.x=-Math.PI/2;
  ring(blade,.80,.025,2.42,pale);
  for(let i=0;i<p.wings;i++){
    const a=i*TAU/p.wings+.35,x=1.68*Math.cos(a),z=1.68*Math.sin(a);
    const screw=add(blade,new THREE.CylinderGeometry(.085,.085,.035,16),polished,x,2.13,z);
    add(blade,new THREE.BoxGeometry(.095,.008,.019),dark,x,2.152,z).rotation.y=-a;
    // Underside recessed fasteners make orbiting underneath useful.
    add(blade,new THREE.CylinderGeometry(.12,.12,.06,6),dark,1.45*Math.cos(a),1.49,1.45*Math.sin(a));
  }
  root.traverse(obj=>{if(obj.isMesh){let part=obj.parent;while(part.parent&&part.parent!==root)part=part.parent;obj.userData.part=part.name;}});
  root.userData={parts:{blade,ratchet,bit},profile,tip};
  return root;
}
export function setExplosion(top,fraction){top.userData.parts.blade.position.y=1.65*fraction;top.userData.parts.ratchet.position.y=.30*fraction;top.userData.parts.bit.position.y=-1.25*fraction;}
export function disposeObject(object){
  const geometries=new Set(),materials=new Set(),textures=new Set();object.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{materials.add(m);if(m.map)textures.add(m.map);});});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());object.removeFromParent();
}
export function createArena(){
  const root=new THREE.Group(),R=ARENA.radius*100,N=144,M=36,positions=[],indices=[];
  for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){const r=R*j/M,a=TAU*i/N,x=r*Math.cos(a),z=r*Math.sin(a);positions.push(x,100*floorHeight(x/100,z/100),z);}
  for(let j=0;j<M;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+N+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  add(root,g,physical('#d7e1e8',{roughness:.36,clearcoat:.5,side:THREE.DoubleSide}));
  const h=100*floorHeight(ARENA.radius,0);
  ring(root,R,.25,h+.13,physical('#253e52',{metalness:.15}));
  const wall=add(root,new THREE.CylinderGeometry(R,R,1.5,144,1,true),physical('#b4cedc',{transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide}),0,h+.75);
  ring(root,R,.15,h+1.5,physical('#627e92',{metalness:.3}));
  for(const radius of [4,8,12,16]){
    const pts=[];for(let i=0;i<=144;i++){const a=TAU*i/144,x=radius*Math.cos(a),z=radius*Math.sin(a);pts.push(new THREE.Vector3(x,100*floorHeight(x/100,z/100)+.025,z));}
    root.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#9fb4c3',transparent:true,opacity:.55})));
  }
  for(let i=0;i<72;i++){const a=TAU*i/72;const m=add(root,new THREE.BoxGeometry(.09,.06,i%6===0?.7:.3),physical('#6d8ea4'),18.35*Math.cos(a),h,18.35*Math.sin(a));m.rotation.y=Math.PI/2-a;}
  const cross=new THREE.Group();for(let i=0;i<2;i++){const m=add(cross,new THREE.BoxGeometry(.07,.02,1.5),physical('#708b9e'));m.rotation.y=i*Math.PI/2;}cross.position.y=.035;root.add(cross);
  return root;
}
