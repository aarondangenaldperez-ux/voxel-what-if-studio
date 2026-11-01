import * as THREE from "three";
import { buildCityEnvironment } from "./cityEnvironment.js";

const mat = (color, options = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.8, metalness: 0.04, ...options
});
function add(parent, geometry, material, p = [0,0,0], r = [0,0,0]) {
  const o = new THREE.Mesh(geometry, material);
  o.position.set(...p); o.rotation.set(...r);
  o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
}
const box = (p,s,pos,m,rot) => add(p,new THREE.BoxGeometry(...s),m,pos,rot);
const sphere = (p,r,pos,m,n=14) => add(p,new THREE.SphereGeometry(r,n,Math.max(8,n>>1)),m,pos);
const cyl = (p,rt,rb,h,pos,m,n=12,rot=[0,0,0]) => add(p,new THREE.CylinderGeometry(rt,rb,h,n),m,pos,rot);
const cone = (p,r,h,pos,m,n=8) => add(p,new THREE.ConeGeometry(r,h,n),m,pos);
const group = (p,pos=[0,0,0]) => { const g=new THREE.Group(); g.position.set(...pos); p.add(g); return g; };
function ground(scene,color,size=100) {
  return add(scene,new THREE.PlaneGeometry(size,size),mat(color,{roughness:1}),[0,-.12,0],[-Math.PI/2,0,0]);
}
function common() {
  return { cars:[], pedestrians:[], streetlights:[], signalLights:[],
    windowMaterial:mat(0x34434a,{emissive:0x17252a,emissiveIntensity:.1}), update:()=>{} };
}
function person(parent,x,z,color) {
  const root=group(parent,[x,0,z]), shirt=mat(color), skin=mat(0xc58d6d), pants=mat(0x303c50);
  box(root,[.48,.78,.3],[0,1.12,0],shirt); sphere(root,.25,[0,1.78,0],skin,12);
  const arms=[];
  for(const side of [-1,1]) {
    const arm=group(root,[side*.31,1.38,0]); box(arm,[.14,.58,.16],[0,-.27,0],shirt); arms.push(arm);
    box(root,[.17,.64,.2],[side*.13,.42,0],pants);
  }
  return {root,arms};
}

function airport(scene) {
  const s=common(); ground(scene,0x46525a,120);
  box(scene,[25,.15,70],[-6,0,-2],mat(0x303a42));
  const line=mat(0xe9e4d7);
  for(let z=-32;z<29;z+=6) box(scene,[.2,.035,3.1],[-6,.1,z],line);
  for(const x of [-17,5]) for(let z=-29;z<25;z+=5)
    sphere(scene,.12,[x,.25,z],mat(0x9edbff,{emissive:0x3d8cce,emissiveIntensity:1}),8);

  const terminal=group(scene,[18,0,-3]);
  box(terminal,[18,6.8,39],[0,3.4,0],mat(0x8b9da5,{metalness:.2}));
  box(terminal,[18.5,.35,39.5],[0,6.85,0],mat(0x34434b));
  const glass=mat(0x73b5c8,{metalness:.2,roughness:.2,emissive:0x122e3c,emissiveIntensity:.15});
  for(let z=-16;z<=16;z+=4) box(terminal,[.12,3.7,2.7],[-9.08,3.1,z],glass);
  const tower=group(scene,[29,0,-14]);
  box(tower,[2.5,10,2.5],[0,5,0],mat(0x77878b));
  box(tower,[4.5,1.2,4.5],[0,10.2,0],mat(0x334650));
  box(tower,[4.4,1.4,4.4],[0,11.5,0],glass);

  const bridge=group(scene,[7,0,1]);
  box(bridge,[7,2.5,3],[0,2.3,0],mat(0xb0b8b7));
  box(bridge,[.2,3.5,3.2],[3.5,1.7,0],mat(0x394b54));

  const plane=group(scene,[-6,1.5,8]), white=mat(0xe2e8e8,{metalness:.16,roughness:.34});
  cyl(plane,.62,.76,10,[0,0,0],white,16,[Math.PI/2,0,0]);
  cone(plane,.62,1.5,[0,0,-5.55],white,14).rotation.x=-Math.PI/2;
  box(plane,[13,.2,2.1],[0,.05,.5],white);
  box(plane,[5,.16,1.4],[0,.08,4.6],white);
  box(plane,[.28,2,1.5],[0,1,4.6],mat(0x46677a));
  const fans=[];
  for(const side of [-1,1]) {
    const engine=group(plane,[side*3.5,-.45,.1]);
    cyl(engine,.46,.46,2,[0,0,0],mat(0x596975),12,[Math.PI/2,0,0]);
    const fan=group(engine,[0,0,-1.05]);
    cyl(fan,.32,.32,.1,[0,0,0],mat(0x17232b),12,[Math.PI/2,0,0]);
    for(let i=0;i<4;i++) box(fan,[.07,.52,.05],[0,0,0],mat(0xc7d0d2),[0,0,i*Math.PI/2]);
    fans.push(fan);
  }
  for(const z of [-3,2]) for(const x of [-.5,.5])
    cyl(plane,.19,.19,.16,[x,-.92,z],mat(0x20272b),10,[0,0,Math.PI/2]);
  s.update=({elapsed,playing})=>{ if(!playing)return; plane.position.z=8+Math.sin(elapsed*.32)*1.2; fans.forEach((f,i)=>f.rotation.z=elapsed*8*(i?-1:1)); };
  return s;
}

function school(scene) {
  const s=common(); ground(scene,0x64815b,95);
  box(scene,[64,.14,10],[0,0,18],mat(0x353f45));
  const brick=mat(0xb98265), trim=mat(0xe5d6bc), glass=mat(0x80b7c5,{metalness:.12,roughness:.25});
  box(scene,[29,8,13],[0,4,-8],brick);
  box(scene,[30,.5,13.4],[0,8.2,-8],mat(0x43515a));
  for(const x of [-11,-7,-3,3,7,11]) for(const y of [2.4,5.3])
    box(scene,[2.15,1.65,.12],[x,y,-1.44],glass);
  box(scene,[7,5,1],[0,4,-1.35],mat(0x839ea4));
  box(scene,[7,.45,.24],[0,7.15,-1.28],trim);
  box(scene,[17,.12,18],[-18,.05,2],mat(0x39758b));
  for(const x of [-24,-12]) {
    box(scene,[.18,3,.18],[x,1.5,2],trim);
    box(scene,[2,.12,.16],[x,3,2],trim);
    cyl(scene,.5,.5,.12,[x,2.75,1.65],mat(0xe49a4c),12,[Math.PI/2,0,0]);
  }
  const bus=group(scene,[3,1,15]), yellow=mat(0xe8ba48);
  box(bus,[7.4,2.1,2.35],[0,0,0],yellow);
  box(bus,[6.2,.85,2.38],[0,.61,-.02],mat(0x426477,{metalness:.12,roughness:.24}));
  for(let x=-2.4;x<=2.4;x+=1.2) box(bus,[.82,.55,.06],[x,.6,1.2],mat(0x283e4a));
  for(const x of [-2.5,2.5]) for(const z of [-1.05,1.05])
    cyl(bus,.5,.5,.3,[x,-.83,z],mat(0x1d252a),12,[0,0,Math.PI/2]);
  for(const [x,z] of [[-23,-5],[23,-7],[-21,22],[22,23]]) {
    cyl(scene,.18,.32,2.3,[x,1.15,z],mat(0x76553b),7);
    sphere(scene,1.55,[x,3.15,z],mat(0x4d805b),10);
    sphere(scene,1.12,[x+.8,3.5,z],mat(0x5d9164),10);
  }
  const people=[person(scene,-6,7,0x4f7998),person(scene,-3,8,0x9a6254),person(scene,10,4,0x746da4)];
  s.update=({elapsed,playing})=>{if(!playing)return;bus.position.x=3+Math.sin(elapsed*.32)*1.5;people.forEach((p,i)=>{const v=Math.sin(elapsed*3+i)*.25;p.arms[0].rotation.x=v;p.arms[1].rotation.x=-v;});};
  return s;
}

function fish(scene,x,y,z,color,scale=1) {
  const g=group(scene,[x,y,z]), body=mat(color);
  const core=sphere(g,.68*scale,[0,0,0],body,12); core.scale.set(1.6,.72,.65);
  cone(g,.38*scale,.85*scale,[-1.12*scale,0,0],body,3).rotation.z=-Math.PI/2;
  sphere(g,.09*scale,[.55*scale,.16*scale,.4*scale],mat(0xffffff),8);
  sphere(g,.04*scale,[.58*scale,.16*scale,.48*scale],mat(0x111820),8);
  return g;
}
function ocean(scene) {
  const s=common(); scene.fog=new THREE.Fog(0x063348,18,78); ground(scene,0x19494a,110);
  box(scene,[110,.12,110],[0,-.2,0],mat(0x1b4b4c));
  add(scene,new THREE.PlaneGeometry(110,110),mat(0x2688a4,{transparent:true,opacity:.22,side:THREE.DoubleSide}),[0,18,0],[-Math.PI/2,0,0]);
  const coralColors=[0xd47565,0xe0a35b,0x897eb0,0xd7bd70];
  for(let i=0;i<20;i++) {
    const x=Math.sin(i*4.4)*21,z=Math.cos(i*3.3)*19,g=group(scene,[x,0,z]);
    for(let b=0;b<3;b++) { const c=mat(coralColors[i%4]); cyl(g,.12,.23,1.5+b*.3,[(b-1)*.38,.75,0],c,7,[0,0,(b-1)*.2]); sphere(g,.18,[(b-1)*.38,1.6+b*.15,0],c,8); }
  }
  for(let i=0;i<25;i++) {
    const x=Math.sin(i*8.1)*29,z=Math.cos(i*5.3)*29;
    cyl(scene,.06,.16,2.6,[x,1.3,z],mat(0x3b967a),7,[0,0,Math.sin(i)*.22]);
  }
  const fishList=[fish(scene,-8,5,-5,0xf2a65c,1),fish(scene,7,8,4,0x5eb8c1,.8),fish(scene,1,3,13,0xd47c76,.72),fish(scene,14,6,-14,0xe8c96c,.9)];
  fishList.forEach((f,i)=>{f.userData.baseX=f.position.x;f.userData.baseY=f.position.y;f.userData.phase=i*1.4;});
  const sub=group(scene,[-15,5,2]), gold=mat(0xd9b34e);
  cyl(sub,.9,.9,4.4,[0,0,0],gold,12,[Math.PI/2,0,0]);
  sphere(sub,.7,[0,0,-2],gold,12); box(sub,[.28,1.4,1],[0,1,.2],gold);
  for(let i=0;i<3;i++) sphere(sub,.13,[0,.2,-.75+i*.65],mat(0x72c5d2,{metalness:.25}),8);
  s.update=({elapsed,playing})=>{if(!playing)return;fishList.forEach(f=>{f.position.x=f.userData.baseX+Math.sin(elapsed*.32+f.userData.phase)*2.5;f.position.y=f.userData.baseY+Math.sin(elapsed*1.3+f.userData.phase)*.18;f.rotation.y=Math.sin(elapsed*.3+f.userData.phase)*.12;});sub.position.y=5+Math.sin(elapsed*.55)*.32;sub.rotation.z=Math.sin(elapsed*.4)*.03;};
  return s;
}

function space(scene) {
  const s=common(); scene.fog=null;
  const positions=[];for(let i=0;i<1000;i++){const a=i*12.9898;positions.push(Math.sin(a)*70,Math.cos(a*.73)*40,Math.sin(a*.31)*70);}
  const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  scene.add(new THREE.Points(geo,new THREE.PointsMaterial({color:0xd8e7ff,size:.2})));
  const planet=group(scene,[-14,1,-5]);sphere(planet,7.4,[0,0,0],mat(0x426d9a,{roughness:.94}),32);
  const land=mat(0x6b9c75);for(let i=0;i<9;i++){const patch=sphere(planet,1.35+(i%3)*.45,[Math.sin(i*4.2)*5,Math.cos(i*2.6)*4,Math.sin(i*1.9)*5],land,9);patch.scale.set(1.3,.45,.8);}
  add(planet,new THREE.TorusGeometry(10,.22,8,80),mat(0xc9b68e),[0,0,0],[Math.PI/2.7,0,0]);
  const moon=group(scene,[20,6,-18]);sphere(moon,3.2,[0,0,0],mat(0xaab3bf,{roughness:1}),24);
  for(let i=0;i<8;i++) sphere(moon,.4,[Math.sin(i*4)*2,Math.cos(i*2.1)*1.8,Math.sin(i*2.8)*1.6],mat(0x858f9a),8);
  const sat=group(scene,[7,0,0]);box(sat,[1.6,.7,1.1],[0,0,0],mat(0xb8a47d,{metalness:.5}));
  for(const side of [-1,1]) {box(sat,[4.5,.12,1.35],[side*3,0,0],mat(0x3e6791,{metalness:.6,roughness:.3}));for(let i=0;i<3;i++)box(sat,[.04,.13,1.35],[side*(1.2+i*1.15),.08,0],mat(0xa5bfd4,{metalness:.55}));}
  const ship=group(scene,[8,-5,13]), hull=mat(0xd8dde1,{metalness:.4,roughness:.3});
  box(ship,[2.3,.55,4.8],[0,0,0],hull);cone(ship,1.1,2.3,[0,0,-3.2],hull,8).rotation.x=-Math.PI/2;
  box(ship,[5.2,.18,1.7],[0,-.12,.8],mat(0x839bad));sphere(ship,.62,[0,.55,.1],mat(0x70b4c5,{roughness:.2}),12);
  s.update=({elapsed,playing})=>{planet.rotation.y=elapsed*.035;moon.rotation.y=elapsed*.06;if(playing){sat.position.set(7+Math.cos(elapsed*.28)*3.2,Math.sin(elapsed*.28)*1.7,Math.sin(elapsed*.28)*3.2);sat.rotation.z=elapsed*.18;ship.position.y=-5+Math.sin(elapsed*.6)*.3;ship.rotation.z=Math.sin(elapsed*.35)*.04;}};
  return s;
}

function factory(scene) {
  const s=common();ground(scene,0x585f60,100);
  box(scene,[35,12,31],[0,6,-5],mat(0x626c6d));
  box(scene,[36,.8,32],[0,12.2,-5],mat(0x3a464b));
  const glass=mat(0x7696a2,{metalness:.16,roughness:.3});
  for(let x=-14;x<=14;x+=4)box(scene,[2.4,2.2,.16],[x,8.6,10.55],glass);
  for(const x of [-13,-5,5,13]){box(scene,[.5,11,.5],[x,5.5,7],mat(0x929891));box(scene,[.9,.25,18],[x,10.6,0],mat(0xb7b8ac));}
  const belt=group(scene,[-1,.3,2]);box(belt,[7,.48,17],[0,.8,0],mat(0x262e32));
  for(let x=-3.2;x<=3.2;x+=.65)cyl(belt,.16,.16,16.5,[x,.8,0],mat(0x9c9f96),8,[Math.PI/2,0,0]);
  const crates=[];const colors=[0xb96e48,0xc59e59,0x5f8293];
  for(let i=0;i<5;i++){const c=box(scene,[1.4,1.1,1.35],[-1+(i%2)*2,1.65,-6+i*3],mat(colors[i%3]));c.userData.baseZ=-6+i*3;crates.push(c);}
  const base=group(scene,[9,0,1]);cyl(base,1.1,1.1,.5,[0,.25,0],mat(0xd09a43));
  const arm=group(base,[0,.6,0]);box(arm,[.45,4.2,.45],[0,2.1,0],mat(0xd8a63e),[0,0,-.12]);box(arm,[.42,3.3,.42],[.1,4,0],mat(0xe5b84b),[0,0,.65]);box(arm,[1.4,.25,1.3],[.8,5.45,0],mat(0x293136));
  for(const x of [-14,14]){cyl(scene,1.3,1.3,5.5,[x,2.75,-17],mat(0x7c898a));cyl(scene,1.45,1.45,.32,[x,5.4,-17],mat(0x4d595b));}
  const chimney=group(scene,[-12,0,-21]);cyl(chimney,.9,1.4,13,[0,6.5,0],mat(0x7e8580));cyl(chimney,1.15,1.15,.6,[0,12.9,0],mat(0x434d51));
  s.update=({elapsed,playing})=>{if(!playing)return;crates.forEach(c=>c.position.z=-6+((elapsed*1.8+c.userData.baseZ+6)%15));arm.rotation.z=Math.sin(elapsed*.8)*.24;};
  return s;
}

function nature(scene) {
  const s=common();ground(scene,0x4f784c,105);
  const hill=sphere(scene,22,[0,-18,-15],mat(0x426d4c),28);hill.scale.set(1.4,.72,1.1);
  const river=box(scene,[13,.18,95],[2,.05,0],mat(0x3b96b2,{roughness:.25,metalness:.12}));river.rotation.y=-.22;
  for(let i=0;i<36;i++){const x=Math.sin(i*13.1)*39,z=Math.cos(i*8.2)*39;cyl(scene,.27,.46,3.2,[x,1.6,z],mat(0x74533a),7);const crown=sphere(scene,2.2+(i%3)*.3,[x,4,z],mat([0x3e7750,0x4e8758,0x668f5c][i%3]),9);crown.scale.set(1.1,.92,1);}
  for(let i=0;i<22;i++){const x=Math.sin(i*4.1)*36,z=Math.cos(i*7.2)*34;const rock=sphere(scene,.8+(i%3)*.35,[x,.45,z],mat(0x777d74),8);rock.scale.set(1.4,.7,1);}
  const deer=group(scene,[-7,0,9]), fur=mat(0x98714f);sphere(deer,.55,[0,1.25,0],fur,10).scale.set(1.35,.8,.8);sphere(deer,.38,[.8,1.55,0],fur,10);
  for(const x of [-.35,.35])cyl(deer,.08,.12,.8,[x,.5,0],fur,6);
  for(const x of [-1,1])cone(deer,.07,.65,[.85+x*.2,2.1,0],mat(0x8e907e),5);
  s.update=({elapsed,playing})=>{if(playing){deer.position.x=-7+Math.sin(elapsed*.35)*1.5;deer.rotation.y=Math.sin(elapsed*.35)*.12;}};
  return s;
}

export function buildEnvironment(scene, environment="urban") {
  switch(environment) {
    case "airport": return airport(scene);
    case "school": return school(scene);
    case "ocean": return ocean(scene);
    case "space": return space(scene);
    case "factory": return factory(scene);
    case "nature": return nature(scene);
    default: return buildCityEnvironment(scene);
  }
}
