import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createTop, createArena, setExplosion, disposeObject } from './model.mjs';
import { PROFILES, inertia, Experiment, STEP, rpm, spinEnergy, floorHeight } from './physics.mjs';
const $=id=>document.getElementById(id);
const configs=[{profile:'attack',tip:'flat',rpm:6000,tilt:8,direction:-1},{profile:'defense',tip:'ball',rpm:6000,tilt:6,direction:-1}];
const colors=['#176fc1','#c64132'];
const text={blade:['BLADE / 金屬刀刃','質量放在哪裡，很重要。','外圈金屬提供主要轉動慣量；彎曲刀翼形成接觸輪廓。相同轉速下，質量越靠外，儲存的旋轉能量通常越大。'],ratchet:['RATCHET / 棘輪','連接刀刃，決定高度。','棘輪位於刀刃下方，連接軸尖並提供鎖合凸耳。高度會影響重心與刀刃接觸位置；分解視圖可觀察卡榫與樹脂外殼。'],bit:['BIT / 軸尖','小小接地面，改變路徑。','比較平底、球底與尖底的接觸形狀。平底的接觸半徑較大，較容易產生牽引，也消耗更多旋轉能。上方齒部是 X 系列構造特徵。']};
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch(error){$('loading').textContent='無法啟動 WebGL，請在支援硬體加速的瀏覽器開啟此教材。';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;renderer.outputColorSpace=THREE.SRGBColorSpace;
$('viewport').append(renderer.domElement);renderer.domElement.setAttribute('aria-label','可拖曳旋轉的陀螺三維模型');
const scene=new THREE.Scene();
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
const camera=new THREE.PerspectiveCamera(36,1,.1,300);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.09;orbit.enablePan=false;orbit.minPolarAngle=.04;orbit.maxPolarAngle=Math.PI*.78;orbit.autoRotateSpeed=.7;
const hemi=new THREE.HemisphereLight('#e7f3ff','#8393a4',1.2);scene.add(hemi);
const light=new THREE.DirectionalLight('#fff5e8',3.5);light.position.set(-8,14,9);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-23;light.shadow.camera.right=23;light.shadow.camera.top=23;light.shadow.camera.bottom=-23;light.shadow.camera.far=70;light.shadow.normalBias=.025;scene.add(light);
const fill=new THREE.DirectionalLight('#c7e5ff',1.7);fill.position.set(7,4,-8);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(170,170),new THREE.ShadowMaterial({opacity:.17}));floor.rotation.x=-Math.PI/2;floor.position.y=-.10;floor.receiveShadow=true;scene.add(floor);
const arena=createArena();scene.add(arena);arena.visible=false;
const inspection=new THREE.Group();scene.add(inspection);
let inspectionTop=createTop();inspection.add(inspectionTop);
const battleGroup=new THREE.Group();battleGroup.visible=false;scene.add(battleGroup);
let battleTops=[];
const arrows=colors.map(c=>{const a=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),4,c,.6,.25);battleGroup.add(a);a.visible=false;return a;});
const trailLines=colors.map(color=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(60*3),3));g.setDrawRange(0,0);const l=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.35}));battleGroup.add(l);return l;});
// Reused impact geometry; lifetime follows simulation time, including pause/slow motion.
const impact=new THREE.Group();battleGroup.add(impact);impact.visible=false;
const impactMaterial=new THREE.LineBasicMaterial({color:'#df8b24',transparent:true,opacity:1});
const impactPositions=[];
for(let i=0;i<16;i++){const a=i*Math.PI/8;impactPositions.push(.25*Math.cos(a),0,.25*Math.sin(a),1.2*Math.cos(a),.15*Math.sin(i*2),1.2*Math.sin(a));}
const impactGeometry=new THREE.BufferGeometry();impactGeometry.setAttribute('position',new THREE.Float32BufferAttribute(impactPositions,3));impact.add(new THREE.LineSegments(impactGeometry,impactMaterial));
let trails=[[],[]],history=[],nextSample=0;
let mode='inspect',selected=0,experiment=new Experiment(configs),running=false,paused=false,accumulator=0,lastTime=0,lastHUD=0,explodeValue=0,showVectors=false;
function selectPart(name){const t=text[name];if(!t)return;$('part-en').textContent=t[0];$('part-title').textContent=t[1];$('part-description').textContent=t[2];document.querySelectorAll('[data-part]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===name)));}
function rebuildInspection(){disposeObject(inspectionTop);inspectionTop=createTop(configs[selected].profile,configs[selected].tip,colors[selected]);inspection.add(inspectionTop);setExplosion(inspectionTop,explodeValue);}
function rebuildBattle(){battleTops.forEach(disposeObject);battleTops=configs.map((c,i)=>{const m=createTop(c.profile,c.tip,colors[i]);battleGroup.add(m);return m;});}
function syncFields(){const c=configs[selected];$('profile').value=c.profile;$('tip').value=c.tip;$('rpm').value=c.rpm;$('tilt').value=c.tilt;$('direction').value=c.direction;$('rpm-value').textContent=c.rpm.toLocaleString()+' rpm';$('tilt-value').textContent=c.tilt+'°';$('mass').innerHTML=(PROFILES[c.profile].mass*1000).toFixed(0)+' <small>g</small>';$('inertia').innerHTML=(inertia(c.profile)*1e5).toFixed(2)+' <small>×10⁻⁵ kg·m²</small>';document.querySelectorAll('[data-player]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.player)===selected)));$('view-caption').textContent=mode==='inspect'?PROFILES[c.profile].name+' / '+(explodeValue?'分解視圖':'組裝視圖'):'封閉碗形場地 / Ø 380 mm';}
function frame(top=false){
  const inspectionMode=mode==='inspect';
  orbit.target.set(0,inspectionMode?1.65:0.6,0);
  const fit=Math.max(1,1/camera.aspect),distance=(inspectionMode?12.2:55)*fit;
  const direction=top?new THREE.Vector3(0,1,.0001):new THREE.Vector3(inspectionMode?6:18,inspectionMode?6.1:34,inspectionMode?9:37).normalize();
  camera.position.copy(orbit.target).addScaledVector(direction,distance);
  orbit.minDistance=inspectionMode?6:24;orbit.maxDistance=inspectionMode?27:120;
  camera.far=300;camera.updateProjectionMatrix();orbit.update();
}
function setMode(next){
  if(mode===next)return;
  mode=next;const inspect=mode==='inspect';
  if(inspect&&running&&!experiment.finished){paused=true;$('pause').textContent='繼續';}
  inspection.visible=inspect;arena.visible=!inspect;battleGroup.visible=!inspect;
  $('inspect-mode').setAttribute('aria-pressed',String(inspect));$('battle-mode').setAttribute('aria-pressed',String(!inspect));
  for(const id of ['inspection-controls','part-labels','scale-note','auto-rotate'])$(id).hidden=!inspect;
  for(const id of ['battle-controls','player-switch','telemetry','vectors'])$(id).hidden=inspect;
  $('panel-title').textContent=inspect?'認識你的陀螺':'設定發射條件';$('panel-kicker').textContent=inspect?'零件配置':'對戰配置';
  $('view-hint').textContent=inspect?'拖曳旋轉 · 滾輪縮放 · 點選零件查看':'拖曳旋轉 · 滾輪縮放 · 藍方 A / 紅方 B';
  orbit.autoRotate=inspect&&$('auto-rotate').getAttribute('aria-pressed')==='true';
  if(inspect)rebuildInspection();syncFields();frame();updateHUD();
}
function updateModels(){
  experiment.bodies.forEach((b,i)=>{
    const m=battleTops[i];if(!m)return;
    const axis=new THREE.Vector3(Math.sin(b.tilt+b.wobble)*Math.cos(b.precession),Math.cos(b.tilt+b.wobble),Math.sin(b.tilt+b.wobble)*Math.sin(b.precession));
    m.position.set(b.x*100,100*floorHeight(b.x,b.z),b.z*100);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
    m.rotateY(b.phase);
    // Keep the rendered lower blade envelope above the bowl while tilted.
    const rimBottom=1.50*Math.cos(b.tilt)-2.50*Math.sin(b.tilt);
    if(rimBottom<0)m.position.y-=rimBottom;
    arrows[i].position.copy(m.position);arrows[i].setDirection(axis);arrows[i].visible=showVectors;
  });
}
function clearSamples(){impact.visible=false;history=[];trails=[[],[]];nextSample=0;trailLines.forEach(l=>l.geometry.setDrawRange(0,0));}
function launch(){rebuildBattle();experiment.reset(configs);running=true;paused=false;accumulator=0;clearSamples();$('pause').disabled=false;$('pause').textContent='暫停';$('launch').textContent='重新發射';updateModels();updateHUD();}
function reset(){running=false;paused=false;accumulator=0;experiment.reset(configs);rebuildBattle();clearSamples();$('pause').disabled=true;$('pause').textContent='暫停';$('launch').textContent='發射對戰';updateModels();updateHUD();}
function sample(){
  history.push([experiment.time,...experiment.bodies.map(rpm)]);if(history.length>1800)history.shift();
  experiment.bodies.forEach((b,i)=>{trails[i].push([b.x*100,100*floorHeight(b.x,b.z)+.045,b.z*100]);if(trails[i].length>60)trails[i].shift();const attr=trailLines[i].geometry.attributes.position;trails[i].forEach((p,j)=>attr.setXYZ(j,...p));attr.needsUpdate=true;trailLines[i].geometry.setDrawRange(0,trails[i].length);trailLines[i].geometry.computeBoundingSphere();});
}
function drawChart(){const c=$('chart'),w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;const d=Math.min(devicePixelRatio,2);if(c.width!==Math.round(w*d)||c.height!==Math.round(h*d)){c.width=Math.round(w*d);c.height=Math.round(h*d);}const ctx=c.getContext('2d');ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);ctx.strokeStyle='#cbd4dc';ctx.lineWidth=1;for(let i=0;i<3;i++){const y=8+i*(h-24)/2;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}const max=Math.max(9000,...history.flatMap(v=>v.slice(1)));const start=history[0]?.[0]||0,end=Math.max(start+10,experiment.time);for(let i=0;i<2;i++){ctx.strokeStyle=colors[i];ctx.lineWidth=1.8;ctx.beginPath();history.forEach((row,j)=>{const x=(row[0]-start)/(end-start)*w,y=8+(1-row[i+1]/max)*(h-24);if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();}ctx.font='9px Consolas,monospace';ctx.fillStyle='#617181';ctx.fillText(start.toFixed(0)+' s',0,h-1);ctx.fillText(end.toFixed(0)+' s',w-32,h-1);}
function updateHUD(){
  $('elapsed').textContent=(running?experiment.time:0).toFixed(2)+' s';
  experiment.bodies.forEach((b,i)=>{const s=i?'b':'a';$('rpm-'+s).textContent=running?Math.round(rpm(b)).toLocaleString():'0';$('tilt-'+s).textContent=(b.tilt*180/Math.PI).toFixed(1)+'°';$('energy-'+s).textContent=(running?spinEnergy(b):0).toFixed(2)+' J';$('state-'+s).textContent=!running?'待發射':b.stopped?'停止':b.scrape?'外圈觸地':'旋轉中';});
  $('result').textContent=!running?'等待發射':experiment.finished?(experiment.winner==='draw'?'雙方停止 · 平手':experiment.winner+' 方勝出 · 旋轉持久'):paused?'實驗已暫停':'對戰進行中';
  $('event').textContent=experiment.count?`碰撞 ${experiment.count} 次 · 最近衝量 ${experiment.lastCollision.impulse.toFixed(4)} N·s`:'固定相同初始位置，方便比較配置。';drawChart();
}
$('inspect-mode').onclick=()=>setMode('inspect');$('battle-mode').onclick=()=>setMode('battle');
$('camera-home').onclick=()=>frame();$('camera-top').onclick=()=>frame(true);
$('auto-rotate').onclick=()=>{orbit.autoRotate=!orbit.autoRotate;$('auto-rotate').setAttribute('aria-pressed',String(orbit.autoRotate));};
$('vectors').onclick=()=>{showVectors=!showVectors;$('vectors').setAttribute('aria-pressed',String(showVectors));};
$('launch').onclick=launch;$('reset').onclick=reset;$('pause').onclick=()=>{paused=!paused;accumulator=0;$('pause').textContent=paused?'繼續':'暫停';updateHUD();};
$('explode').oninput=()=>{explodeValue=Number($('explode').value)/100;setExplosion(inspectionTop,explodeValue);$('explode-value').textContent=explodeValue?Math.round(explodeValue*100)+'%':'組裝';syncFields();};
for(const id of ['profile','tip','rpm','tilt','direction'])$(id).addEventListener('input',()=>{const c=configs[selected];c[id]=['rpm','tilt','direction'].includes(id)?Number($(id).value):$(id).value;if(id==='profile')c.tip=PROFILES[c.profile].tip;syncFields();if(mode==='inspect'&&(id==='profile'||id==='tip'))rebuildInspection();if(!running&&mode==='battle')reset();});
document.querySelectorAll('[data-player]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.player);syncFields();});
document.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>selectPart(b.dataset.part));
const ray=new THREE.Raycaster();let pointerStart=null;
renderer.domElement.addEventListener('pointerdown',e=>{pointerStart=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointerup',e=>{if(mode!=='inspect'||!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>5)return;const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=ray.intersectObject(inspectionTop,true)[0];if(hit)selectPart(hit.object.userData.part);});
function resize(){const w=$('viewport').clientWidth,h=$('viewport').clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();frame();drawChart();}
new ResizeObserver(resize).observe($('viewport'));
document.addEventListener('visibilitychange',()=>{lastTime=0;accumulator=0;});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;$('loading').hidden=false;$('loading').textContent='三維顯示已中斷，請重新整理頁面恢復模型。';});
function animate(now){
  requestAnimationFrame(animate);
  const dt=lastTime?Math.min((now-lastTime)/1000,.1):0;lastTime=now;
  if(mode==='battle'&&running&&!paused&&!experiment.finished&&!document.hidden){
    accumulator+=dt*Number($('speed').value);
    while(accumulator>=STEP&&!experiment.finished){experiment.step();accumulator-=STEP;if(experiment.time>=nextSample){sample();nextSample+=.04;}}
    if(experiment.finished){$('pause').disabled=true;accumulator=0;updateHUD();}
  }
  const hit=experiment.lastCollision,age=hit?experiment.time-hit.time:Infinity;
  impact.visible=running&&age<.22;
  if(impact.visible){impact.position.set(hit.x*100,100*floorHeight(hit.x,hit.z)+1.9,hit.z*100);impact.scale.setScalar(.55+age*5);impactMaterial.opacity=Math.max(0,1-age/.22);}
  updateModels();orbit.update(dt);renderer.render(scene,camera);
  if(now-lastHUD>100){updateHUD();lastHUD=now;}
}
rebuildBattle();syncFields();selectPart('blade');resize();updateModels();$('loading').hidden=true;requestAnimationFrame(animate);
