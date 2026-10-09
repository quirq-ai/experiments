import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Geometry is authored in millimetres. This is an illustrative Drosophila asset,
// never an inferred reconstruction of a particular connectome specimen.
const UP = new THREE.Vector3(0, 1, 0);
let cached;
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; }; }
function texture(size, paint) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function skinTexture() {
  return texture(512, (ctx, s) => {
    const random = rng(771); const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#e0ad50'); g.addColorStop(.4, '#b4772e'); g.addColorStop(1, '#5f391b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 16000; i++) {
      const a = random(); ctx.fillStyle = a > .6 ? 'rgba(255,224,140,.16)' : 'rgba(37,21,8,.2)';
      ctx.beginPath(); ctx.ellipse(random()*s, random()*s, .5 + random()*1.3, .4 + random(), random()*3, 0, Math.PI*2); ctx.fill();
    }
    for (let i = 0; i < 19; i++) {
      ctx.strokeStyle = `rgba(74,42,14,${.05+random()*.08})`; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0, i*s/19); ctx.bezierCurveTo(s*.3, i*s/19+8, s*.7, i*s/19-8,s,i*s/19);ctx.stroke();
    }
  });
}
function wingTexture() {
  return texture(512, (ctx, s) => {
    ctx.fillStyle = '#d2e0df'; ctx.fillRect(0, 0, s, s);
    const random=rng(30);
    for(let i=0;i<12000;i++) { ctx.fillStyle=`rgba(78,120,114,${random()*.2})`;ctx.fillRect(random()*s, random()*s,.7,2); }
    const g=ctx.createLinearGradient(0,0,s,s);g.addColorStop(0,'rgba(245,233,197,.45)');g.addColorStop(.4,'rgba(94,154,163,.15)');g.addColorStop(.72,'rgba(191,153,212,.2)');g.addColorStop(1,'rgba(215,238,226,.18)');ctx.fillStyle=g;ctx.fillRect(0,0,s,s);
  });
}
function tube(points, radius, material, segments=16) {
  const c = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(c, segments, radius, 5, false), material);
}
function capsuleBetween(a, b, r1, r2, material) {
  const av=new THREE.Vector3(...a), bv=new THREE.Vector3(...b), d=bv.clone().sub(av);
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r2,r1,d.length(),7),material);
  m.position.copy(av).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(UP,d.normalize());return m;
}
function ellipsoid(geometry, material, position, scale) {
  const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.scale.set(...scale);return m;
}
function resources() {
  if (cached) return cached;
  const skin=skinTexture();
  const gold = new THREE.MeshPhysicalMaterial({color:0xe3af5f,map:skin,roughness:.52,metalness:.12,clearcoat:.35,clearcoatRoughness:.45});
  const amber = new THREE.MeshPhysicalMaterial({color:0xe0a442,map:skin,roughness:.4,metalness:.13,clearcoat:.45});
  const dark = new THREE.MeshStandardMaterial({color:0x3b2315,roughness:.54,metalness:.13});
  const leg = new THREE.MeshStandardMaterial({color:0xa16b30,map:skin,roughness:.45,metalness:.1});
  const eye = new THREE.MeshPhysicalMaterial({color:0x8e2111,roughness:.33,metalness:.16,clearcoat:.7,clearcoatRoughness:.3});
  const facets = new THREE.MeshStandardMaterial({color:0xffffff,roughness:.45,metalness:.08});
  const wing = new THREE.MeshPhysicalMaterial({color:0xd8e5da,map:wingTexture(),transparent:true,opacity:.28,roughness:.42,metalness:.10,iridescence:.6,iridescenceIOR:1.3,side:THREE.DoubleSide,depthWrite:false});
  const vein = new THREE.LineBasicMaterial({color:0x927648,transparent:true,opacity:.65,depthWrite:false});
  cached={sphere:new THREE.SphereGeometry(1,32,24),gold,amber,dark,leg,eye,facets,wing,vein,bristles:new THREE.LineBasicMaterial({color:0x302016,transparent:true,opacity:.85})};
  return cached;
}

function mergeDirectMeshes(group) {
  const batches=new Map();
  for(const child of [...group.children]) {
    if(!child.isMesh||child.isInstancedMesh)continue;
    child.updateMatrix();const geometry=child.geometry.clone().applyMatrix4(child.matrix);
    if(!batches.has(child.material))batches.set(child.material,[]);
    batches.get(child.material).push(geometry);group.remove(child);
  }
  for(const [material,geometries]of batches){const geometry=mergeGeometries(geometries,false);group.add(new THREE.Mesh(geometry,material));geometries.forEach(g=>g.dispose());}
}
function mergeWingLines(group,material) {
  const segments=[];
  for(const child of [...group.children]) {
    if(!child.isLine)continue;const p=child.geometry.attributes.position;
    for(let i=1;i<p.count;i++)segments.push(p.getX(i-1),p.getY(i-1),p.getZ(i-1),p.getX(i),p.getY(i),p.getZ(i));
    group.remove(child);child.geometry.dispose();
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(segments,3)),material));
}

function addEye(group, side, detail, r) {
  const center=new THREE.Vector3(.89,.27,side*.36);
  const eye=ellipsoid(r.sphere,r.eye,center.toArray(),[.405,.455,.258]);eye.rotation.z=.12;group.add(eye);
  if (!detail) return;
  const count=480, facetGeo=new THREE.SphereGeometry(1,5,3);
  const facets=new THREE.InstancedMesh(facetGeo,r.facets,count);
  const d=new THREE.Object3D(), color=new THREE.Color(), random=rng(side+108), n=new THREE.Vector3();
  for(let i=0;i<count;i++) {
    // A Fibonacci sampling of the outward hemisphere gives a dense ommatidial surface.
    const q=(i+.5)/count, theta=i*2.39996323, nr=Math.sqrt(1-q*q);
    n.set(Math.cos(theta)*nr,Math.sin(theta)*nr,side*q);
    d.position.set(center.x+n.x*.409,center.y+n.y*.459,center.z+n.z*.261);
    d.scale.set(.017,.017,.010); d.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);d.updateMatrix();facets.setMatrixAt(i,d.matrix);
    color.setHSL(.012+random()*.012,.77,.13+random()*.12);facets.setColorAt(i,color);
  }
  facets.instanceMatrix.needsUpdate=true; group.add(facets);
}
function makeWing(side,r) {
  const group=new THREE.Group();group.position.set(.10,.44,side*.26);
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(.16,.19,-.14,.66,-.83,1.07);shape.bezierCurveTo(-1.58,1.48,-2.43,1.31,-2.66,.99);shape.bezierCurveTo(-2.88,.66,-2.38,.36,-1.72,.26);shape.bezierCurveTo(-.94,.11,-.46,.035,0,0);
  const geo=new THREE.ShapeGeometry(shape,24),pos=geo.attributes.position,uv=geo.attributes.uv;
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i),z=pos.getY(i);pos.setXYZ(i,x,.07*Math.sin(z*2)+.035*x*x,side*z);uv.setXY(i,(x+2.9)/3.1,z/1.5);
  }
  geo.computeVertexNormals(); const membrane=new THREE.Mesh(geo,r.wing);membrane.renderOrder=3;group.add(membrane);
  const veinPaths=[
    [[0,0],[-.30,.39],[-.83,.84],[-1.45,1.15],[-2.20,1.22],[-2.61,.99]],
    [[0,0],[-.60,.22],[-1.12,.49],[-1.77,.78],[-2.62,.98]],
    [[-.12,.08],[-.8,.18],[-1.57,.41],[-2.75,.73]],
    [[-.22,.04],[-.89,.14],[-1.53,.23],[-2.56,.46]],
    [[-.56,.24],[-.76,.52],[-.87,.91]],
    [[-1.01,.46],[-1.19,.72],[-1.36,1.12]],
    [[-1.58,.41],[-1.72,.78]],
    [[-1.08,.16],[-1.23,.33],[-1.31,.57]],
  ];
  for(const path of veinPaths) {
    const curve=new THREE.CatmullRomCurve3(path.map(([x,z])=>new THREE.Vector3(x,.073*Math.sin(z*2)+.035*x*x+.006,side*z)));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(20)),r.vein));
  }
  const edge=shape.getPoints(48).map(p=>new THREE.Vector3(p.x,.07*Math.sin(p.y*2)+.035*p.x*p.x+.004,side*p.y));
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(edge),r.vein));
  mergeWingLines(group,r.vein);group.userData.side=side;return group;
}

export function createFlyAsset({detail=true}={}) {
  const r=resources(),root=new THREE.Group(),body=new THREE.Group();root.add(body);
  root.name='Illustrative Drosophila melanogaster';
  const thorax=ellipsoid(r.sphere,r.gold,[0,.19,0],[.67,.56,.46]);body.add(thorax);
  const scutellum=ellipsoid(r.sphere,r.amber,[-.53,.42,0],[.28,.23,.29]);body.add(scutellum);
  // Six overlapping tergites produce the characteristic alternating abdominal bands.
  for(let i=0;i<6;i++) {
    const x=-.56-i*.265,rad=.41*Math.sqrt(Math.max(.09,1-(i/6.35)**2));
    const seg=ellipsoid(r.sphere,i===5?r.dark:r.amber,[x,.035-i*.027,0],[.32,rad*.82,rad]);seg.rotation.z=-.14;body.add(seg);
    const stripe=new THREE.Mesh(new THREE.TorusGeometry(rad*.94,.024+ i*.001,6,40),r.dark);
    stripe.rotation.y=Math.PI/2;stripe.scale.y=.85;stripe.position.set(x-.13,.035-i*.027,0);body.add(stripe);
  }
  body.add(ellipsoid(r.sphere,r.gold,[.82,.2,0],[.43,.43,.43]));
  body.add(ellipsoid(r.sphere,r.amber,[1.14,.07,0],[.21,.28,.29]));
  addEye(body,-1,detail,r);addEye(body,1,detail,r);
  for(const side of [-1,1]) {
    body.add(ellipsoid(r.sphere,r.gold,[1.29,.21,side*.15],[.09,.10,.07]));
    body.add(ellipsoid(r.sphere,r.dark,[1.36,.13,side*.17],[.105,.16,.063]));
    const arista=[[1.34,.22,side*.19],[1.57,.50,side*.3],[1.69,.75,side*.36]];
    body.add(tube(arista,.009,r.dark));
    if(detail) {
      const br=[];for(let i=0;i<9;i++){const t=i/10,x=1.39+t*.26,y=.30+t*.40,z=side*(.22+t*.12);br.push(x,y,z,x-.06,y+.07,z+side*.13);}
      body.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(br,3)),r.bristles));
    }
    body.add(ellipsoid(r.sphere,r.dark,[1.11,-.12,side*.07],[.12,.21,.07]));
    // Halteres: the clubbed balance organs behind the wings.
    body.add(tube([[-.44,.2,side*.39],[-.68,.30,side*.64]],.02,r.leg));
    body.add(ellipsoid(r.sphere,r.amber,[-.69,.31,side*.66],[.055,.07,.065]));
  }
  for(const p of [[.83,.62,0],[.65,.60,.12],[.65,.60,-.12]])body.add(ellipsoid(r.sphere,r.eye,p,[.046,.027,.045]));
  const legs=[];
  for(const side of [-1,1]) for(let i=0;i<3;i++) {
    const g=new THREE.Group();g.position.set(.42-i*.38,-.07,side*.31);
    const pts = i===0 ? [[0,0,0],[.42,-.24,side*.32],[.60,-.78,side*.55],[.88,-.93,side*.71],[1.07,-.94,side*.73]] : i===1 ? [[0,0,0],[-.17,-.16,side*.66],[.15,-.82,side*.97],[.44,-.93,side*1.04],[.59,-.94,side*1.04]] : [[0,0,0],[-.49,-.12,side*.40],[-.70,-.60,side*.83],[-1.09,-.92,side*.98],[-1.34,-.94,side*.98]];
    for(let j=0;j<pts.length-1;j++) {g.add(capsuleBetween(pts[j],pts[j+1],.05-j*.01,.04-j*.008,r.leg));if(j<3)g.add(ellipsoid(r.sphere,r.dark,pts[j+1],[.044,.044,.044]));}
    const end=pts[pts.length-1];g.add(tube([end,[end[0]+.10,end[1]+.01,end[2]+side*.05]],.009,r.dark,4));
    if(detail) {
      const hairs=[];
      for(let j=0;j<3;j++)for(let k=1;k<5;k++) {const a=pts[j],b=pts[j+1],t=k/5;const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+(b[2]-a[2])*t;hairs.push(x,y,z,x-.045,y+.018,z+side*.10);}
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(hairs,3)),r.bristles));
    }
    g.userData={side,index:i};body.add(g);legs.push(g);
  }
  if(detail) {
    const hair=[],random=rng(664);for(let i=0;i<280;i++){const a=random()*Math.PI*2,b=random()*Math.PI;const x=Math.cos(a)*Math.sin(b),y=Math.cos(b),z=Math.sin(a)*Math.sin(b);if(y<-.3)continue;const length=.055+random()*.09;hair.push(x*.66,.19+y*.56,z*.46,x*(.66+length),.19+y*(.56+length),z*(.46+length));}
    body.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(hair,3)),r.bristles));
    for(const side of [-1,1])for(let i=0;i<2;i++)body.add(tube([[.35,.66,side*(.12+i*.1)],[-.05,.72,side*(.12+i*.1)],[-.42,.58,side*(.10+i*.1)]],.01,r.dark,12));
  }
  const wings=[makeWing(-1,r),makeWing(1,r)];body.add(...wings);
  // A stable translucent motion envelope avoids aliasing a 200 Hz wing stroke.
  const envelope=new THREE.Group();envelope.visible=false;
  for(const wing of wings) {const e=wing.children[0].clone();e.material=r.wing.clone();e.material.opacity=.105;const g=new THREE.Group();g.position.copy(wing.position);g.add(e);g.rotation.x=wing.userData.side*.52;envelope.add(g);}
  body.add(envelope);
  if(!detail){mergeDirectMeshes(body);for(const leg of legs)mergeDirectMeshes(leg);}
  root.userData={body,wings,legs,envelope};
  root.update=(time,flying=false)=>{
    for(const wing of wings)wing.rotation.x=wing.userData.side*(flying?.20+Math.sin(time*12)*.08:.08+Math.sin(time*.8)*.025);
    envelope.visible=flying;
    for(const leg of legs)leg.rotation.x=flying?leg.userData.side*.37:Math.sin(time*.65+leg.userData.index)*.025;
  };
  return root;
}
