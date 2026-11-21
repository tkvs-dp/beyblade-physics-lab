// SI units: metres, kilograms, seconds. Reduced-order educational model.
export const STEP = 1 / 480;
export const G = 9.81;
export const ARENA = { radius: 0.19, curvature: 0.65 };
export const PROFILES = {
  attack: { name: '三翼攻擊型', mass: .048, radius: .025, rimFraction: .68, wings: 3, tip: 'flat' },
  defense: { name: '五翼防禦型', mass: .052, radius: .025, rimFraction: .61, wings: 5, tip: 'ball' },
  stamina: { name: '六翼持久型', mass: .046, radius: .025, rimFraction: .79, wings: 6, tip: 'needle' }
};
export const TIPS = {
  flat: { drag: .000080, rolling: .004, drive: 3.0 },
  ball: { drag: .000050, rolling: .002, drive: 2.0 },
  needle: { drag: .000035, rolling: .0015, drive: .35 }
};
export function inertia(profile) {
  // Two annular/cylindrical mass zones. Blade geometry is a visual approximation.
  const p = PROFILES[profile], r = p.radius;
  return .5 * p.mass * (p.rimFraction * (r*r + (.72*r)**2) + (1-p.rimFraction) * (.48*r)**2);
}
export function floorHeight(x,z) { return ARENA.curvature*(x*x+z*z); }
export function makeBody(config, index=0) {
  const p = PROFILES[config.profile];
  return {...p, I: inertia(config.profile), profile: config.profile, tip: config.tip,
    x: index === 0 ? -.105 : .105, z: index === 0 ? -.016 : .016,
    vx: index === 0 ? .42 : -.36, vz: index === 0 ? -.40 : .28,
    omega: config.direction * config.rpm * Math.PI/30,
    tilt: config.tilt * Math.PI/180, precession: index*Math.PI, phase: 0, wobble: 0, wobbleVelocity: 0,
    stopped: false, scrape: false, h: .016, collisions: 0};
}
export function spinEnergy(b) { return .5*b.I*b.omega*b.omega; }
export function kineticEnergy(b) { return spinEnergy(b)+.5*b.mass*(b.vx*b.vx+b.vz*b.vz); }
export function energy(b) { return kineticEnergy(b) + b.mass*G*floorHeight(b.x,b.z); }
export function rpm(b) { return Math.abs(b.omega)*30/Math.PI; }
const clamp = (x,lo,hi)=>Math.max(lo,Math.min(hi,x));

export function moveBody(b, dt) {
  if (b.stopped) return;
  const t=TIPS[b.tip], sign=Math.sign(b.omega), before=spinEnergy(b);
  // Gravity projected onto a shallow parabolic bowl; slope metric is approximated.
  const slopeX=2*ARENA.curvature*b.x, slopeZ=2*ARENA.curvature*b.z;
  const denom=1+slopeX*slopeX+slopeZ*slopeZ;
  b.vx -= G*slopeX/denom*dt; b.vz -= G*slopeZ/denom*dt;
  const speed=Math.hypot(b.vx,b.vz);
  if(speed>0) {
    const f=Math.max(0,1-t.rolling*G*dt/speed);
    b.vx*=f; b.vz*=f;
  }
  // A bounded traction approximation; positive translational work is paid from spin.
  const traction=t.drive*Math.sin(b.tilt)*Math.min(1,Math.abs(b.omega)/200);
  // Tilt-driven slip traction is tangent to the leaning axis.
  const ax=-traction*Math.sin(b.precession)*sign, az=traction*Math.cos(b.precession)*sign;
  const oldKE=.5*b.mass*(b.vx*b.vx+b.vz*b.vz);
  let dx=ax*dt, dz=az*dt;
  const work=b.mass*(b.vx*dx+b.vz*dz+.5*(dx*dx+dz*dz));
  if(work>before && work>0) { dx=0; dz=0; }
  b.vx+=dx; b.vz+=dz;
  const spent=Math.max(0,.5*b.mass*(b.vx*b.vx+b.vz*b.vz)-oldKE);
  b.omega=sign*Math.sqrt(Math.max(0,2*(before-spent)/b.I));
  b.scrape=b.tilt>Math.atan(b.h/b.radius);
  // Constant bearing/tip torque + quadratic air drag + rim scraping loss.
  const torque=t.drag+3.0e-10*b.omega*b.omega+(b.scrape?.00065:0);
  b.omega=sign*Math.max(0,Math.abs(b.omega)-torque/b.I*dt);
  // High-spin regular precession, blended to bounded low-spin falling motion.
  const w=Math.abs(b.omega), highSpin=w*w/(w*w+80*80);
  // phi parameterizes (cos(phi), sin(phi)) in XZ, opposite to +Y rotation.
  b.precession=(b.precession - sign*b.mass*G*b.h/(b.I*Math.max(w,80))*highSpin*dt)%(2*Math.PI);
  const target=(b.tip==='flat'?.10:b.tip==='ball'?.045:.018) + .8*(1-highSpin);
  b.tilt=clamp(b.tilt+(target-b.tilt)*(.12+.7*(1-highSpin))*dt,0,1.35);
  b.wobbleVelocity+=(-90*b.wobble-7*b.wobbleVelocity)*dt;
  b.wobble+=b.wobbleVelocity*dt;
  // Compress visual speed smoothly; avoid identical capped speed for every RPM.
  b.phase=(b.phase+sign*18*Math.sqrt(w/628.3185)*dt)%(2*Math.PI);
  b.x+=b.vx*dt; b.z+=b.vz*dt;
  wallContact(b);
  if(w<8) { b.omega=0; b.vx=0; b.vz=0; b.stopped=true; b.tilt=1.12; }
}
export function wallContact(b) {
  const d=Math.hypot(b.x,b.z), limit=ARENA.radius-b.radius;
  if(d<=limit) return false;
  const nx=b.x/d, nz=b.z/d;
  b.x=nx*limit; b.z=nz*limit;
  const v=b.vx*nx+b.vz*nz;
  if(v<=0) return false;
  const jn=(1+.45)*b.mass*v;
  b.vx-=jn*nx/b.mass; b.vz-=jn*nz/b.mass;
  // Contact velocity along n × up, with angular velocity about +Y.
  const tx=-nz,tz=nx;
  const slip=b.vx*tx+b.vz*tz-b.omega*b.radius;
  const jt=clamp(-slip/(1/b.mass+b.radius*b.radius/b.I),-.18*jn,.18*jn);
  b.vx+=jt*tx/b.mass; b.vz+=jt*tz/b.mass;
  b.omega-=b.radius*jt/b.I;
  return true;
}
export function collide(a,b, restitution=.62, friction=.24) {
  const dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz),r=a.radius+b.radius;
  if(dist>=r || a.stopped || b.stopped) return null;
  const nx=dist>1e-10?dx/dist:1,nz=dist>1e-10?dz/dist:0;
  // Always separate overlap, even when already moving apart.
  const inv=1/a.mass+1/b.mass, overlap=r-dist+1e-7;
  a.x-=nx*overlap/(a.mass*inv); a.z-=nz*overlap/(a.mass*inv);
  b.x+=nx*overlap/(b.mass*inv); b.z+=nz*overlap/(b.mass*inv);
  const vn=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;
  if(vn>=0) return null;
  const jn=-(1+restitution)*vn/inv, tx=-nz,tz=nx;
  // vB(contact)-vA(contact); B receives negative relative tangential impulse.
  const slip=(b.vx-a.vx)*tx+(b.vz-a.vz)*tz+b.omega*b.radius+a.omega*a.radius;
  const eff=inv+a.radius*a.radius/a.I+b.radius*b.radius/b.I;
  const jt=clamp(-slip/eff,-friction*jn,friction*jn);
  const jx=jn*nx+jt*tx,jz=jn*nz+jt*tz;
  a.vx-=jx/a.mass; a.vz-=jz/a.mass;
  b.vx+=jx/b.mass; b.vz+=jz/b.mass;
  a.omega+=a.radius*jt/a.I; b.omega+=b.radius*jt/b.I;
  // Collision-induced tilt is a separate visual/empirical state, not reported energy.
  const kick=jn>.002?Math.min(.16,jn*2.0):0;
  a.wobbleVelocity+=Math.min(2.5,jn*65); b.wobbleVelocity-=Math.min(2.5,jn*65);
  a.tilt=clamp(a.tilt+kick,0,1.35); b.tilt=clamp(b.tilt+kick,0,1.35);
  return { impulse:jn, x:(a.x+b.x)/2,z:(a.z+b.z)/2 };
}
// Reduced blade-tooth engagement: a bounded fraction of spin energy funds recoil.
// Applied once per new contact; smooth-disc collision tests remain independent.
export function bladeRecoil(a,b) {
  const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),nx=d?dx/d:1,nz=d?dz/d:0;
  const slip=Math.abs(a.omega*a.radius+b.omega*b.radius);
  const ea=spinEnergy(a),eb=spinEnergy(b),available=ea+eb;
  const budget=Math.min(.004,available*.0015)*Math.min(1,slip/12);
  if(budget<1e-10)return 0;
  const inv=1/a.mass+1/b.mass,vn=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;
  const j=(-vn+Math.sqrt(vn*vn+2*inv*budget))/inv;
  a.vx-=j*nx/a.mass;a.vz-=j*nz/a.mass;b.vx+=j*nx/b.mass;b.vz+=j*nz/b.mass;
  const retained=Math.sqrt(Math.max(0,1-budget/available));a.omega*=retained;b.omega*=retained;
  return j;
}
export class Experiment {
  constructor(configs){this.reset(configs);}
  reset(configs){this.bodies=configs.map(makeBody);this.time=0;this.count=0;this.finished=false;this.winner=null;this.lastCollision=null;this.contactPair=false;}
  step(dt=STEP){
    if(this.finished)return;
    this.bodies.forEach(b=>moveBody(b,dt));
    const [first,second]=this.bodies;
    const touching=Math.hypot(first.x-second.x,first.z-second.z)<=first.radius+second.radius+.0002;
    const hit=collide(...this.bodies);
    // Count contact onset, not every impulse iteration in a sustained contact.
    if(hit&&!this.contactPair){hit.impulse+=bladeRecoil(first,second);this.count++;first.collisions++;second.collisions++;this.lastCollision={...hit,time:this.time};}
    this.contactPair=touching;
    this.time+=dt;
    const [a,b]=this.bodies;
    if(a.stopped||b.stopped){this.finished=true;this.winner=a.stopped&&b.stopped?'draw':a.stopped?'B':'A';}
  }
}
