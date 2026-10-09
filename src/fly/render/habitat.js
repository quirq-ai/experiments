import * as THREE from 'three';

const TAU=Math.PI*2;
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
function canvasTexture(size,paint){const c=document.createElement('canvas');c.width=c.height=size;paint(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function soilTexture(){return canvasTexture(1024,(ctx,s)=>{const r=random(221);ctx.fillStyle='#514132';ctx.fillRect(0,0,s,s);for(let i=0;i<35000;i++){ctx.fillStyle=['#5a4b37','#302e23','#706046','#827359','#3b3b2a'][Math.floor(r()*5)];ctx.beginPath();ctx.ellipse(r()*s,r()*s,r()*3+.25,r()*1.3+.3,r()*3,0,TAU);ctx.fill();}for(let i=0;i<180;i++){ctx.strokeStyle='rgba(99,87,57,.35)';ctx.lineWidth=r()*1.6+.5;const x=r()*s,y=r()*s;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+20,y+20,x+50*r(),y+50*r());ctx.stroke();}});}
function ring(radius,y,color=0x658f83,opacity=.4){const pts=[];for(let i=0;i<=160;i++){const a=i/160*TAU;pts.push(new THREE.Vector3(Math.cos(a)*radius,y,Math.sin(a)*radius));}return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));}
function tube(points,radius,mat,segments=20){return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,7,false),mat);}
const shared={};
function materials(){if(shared.leaf)return shared;shared.leaf=new THREE.MeshPhysicalMaterial({color:0x405928,roughness:.57,metalness:.02,side:THREE.DoubleSide,clearcoat:.25,clearcoatRoughness:.5});shared.leaf2=shared.leaf.clone();shared.leaf2.color.setHex(0x64803a);shared.vein=new THREE.LineBasicMaterial({color:0x99b064,transparent:true,opacity:.38});shared.stem=new THREE.MeshStandardMaterial({color:0x4e602a,roughness:.67});shared.dew=new THREE.MeshPhysicalMaterial({color:0xb1dfdf,metalness:.38,roughness:.05,transparent:true,opacity:.65,clearcoat:1});shared.sphere=new THREE.SphereGeometry(1,16,12);return shared;}

function leafPoint(u,v,length,width,curl){const taper=Math.sin(u*Math.PI)**.68;return new THREE.Vector3(v*taper*width*.5,Math.sin(u*Math.PI)*length*curl + Math.abs(v)**1.8*width*.10 + u*u*length*.05,u*length);}
export function makeLeaf({length=36,width=16,curl=.18,tint=0}={}){
  const m=materials(),g=new THREE.Group(),vertices=[],uv=[],indices=[],rows=18,cols=8;
  for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){const u=i/rows,v=j/cols*2-1,p=leafPoint(u,v,length,width,curl);vertices.push(p.x,p.y,p.z);uv.push(j/cols,u);if(i<rows&&j<cols){const a=i*(cols+1)+j,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();g.add(new THREE.Mesh(geo,tint?m.leaf2:m.leaf));
  const lines=[];let prev=null;
  for(let i=0;i<=24;i++){const p=leafPoint(i/24,0,length,width,curl);p.y+=.1;if(prev)lines.push(...prev.toArray(),...p.toArray());prev=p;}
  for(let i=2;i<10;i++)for(const sign of [-1,1]){let prev=null;for(let j=0;j<8;j++){const v=j/8*sign,p=leafPoint(Math.min(.97,i/11+j/8*.13),v,length,width,curl);p.y+=.12;if(prev)lines.push(...prev.toArray(),...p.toArray());prev=p;}}
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(lines,3)),m.vein));
  if(length>28){for(const [u,v,s]of[[.44,.35,.76],[.70,-.26,.44],[.24,-.2,.33]]){const p=leafPoint(u,v,length,width,curl);p.y+=s*.64;const drop=new THREE.Mesh(m.sphere,m.dew);drop.position.copy(p);drop.scale.set(s,s*.6,s);g.add(drop);}}
  return g;
}
function plant(x,z,height,seed=1){const r=random(seed),g=new THREE.Group(),m=materials();g.position.set(x,0,z);g.add(tube([[0,0,0],[-2,height*.45,1],[3,height*.82,-1],[1,height,2]],.7,m.stem));
  for(let i=0;i<6;i++){const y=height*(.18+i*.12),a=i*2.4+r()*.3,len=22+r()*20;const leaf=makeLeaf({length:len,width:len*.4,curl:.05+r()*.22,tint:i%3===0});leaf.position.set(Math.sin(y*.03)*2,y,0);leaf.rotation.y=a;leaf.rotation.x=.1+r()*.6;leaf.rotation.z=(r()-.5)*.25;g.add(leaf);}
  return g;
}
function ruler(radius,y,count){const p=[];for(let i=0;i<count;i++){const a=i/count*TAU,outer=radius+(i%10===0?4:1.8);p.push(Math.cos(a)*radius,y,Math.sin(a)*radius,Math.cos(a)*outer,y,Math.sin(a)*outer);}return new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(p,3)),new THREE.LineBasicMaterial({color:0x8aa99b,transparent:true,opacity:.36}));}
function textSprite(text,{color='#acc7b9',width=34,fontSize=28}={}){const tex=canvasTexture(256,(ctx,s)=>{ctx.fillStyle=color;ctx.font=`500 ${fontSize}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,s/2,s/2);});const mat=new THREE.SpriteMaterial({map:tex,transparent:true,opacity:.85,depthWrite:false});const sprite=new THREE.Sprite(mat);sprite.scale.set(width,width,1);return sprite;}

export function createSpecimenStage(){
  const g=new THREE.Group();
  const dark=new THREE.MeshStandardMaterial({color:0x0d1719,metalness:.65,roughness:.47});
  const base=new THREE.Mesh(new THREE.CylinderGeometry(64,66,6,128),dark);base.position.y=-4;g.add(base);
  const top=new THREE.Mesh(new THREE.CircleGeometry(63.5,128),new THREE.MeshStandardMaterial({color:0x152326,roughness:.7,metalness:.4}));top.rotation.x=-Math.PI/2;top.position.y=-.95;g.add(top);
  g.add(ring(64,-.8,0x548475,.54),ring(56,-.72,0x496c60,.27),ring(46,-.70,0x5d8277,.11),ruler(58,-.65,120));
  const shadowMap=canvasTexture(128,(ctx,s)=>{const gr=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);gr.addColorStop(0,'rgba(0,0,0,.68)');gr.addColorStop(.4,'rgba(0,0,0,.4)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,s,s);});const shadow=new THREE.Mesh(new THREE.PlaneGeometry(88,60),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set(-4,-.62,0);g.add(shadow);
  const fine=[];for(let i=-4;i<=4;i++){fine.push(-40,-.67,i*10,40,-.67,i*10,i*10,-.67,-40,i*10,-.67,40);}g.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(fine,3)),new THREE.LineBasicMaterial({color:0x608278,transparent:true,opacity:.07})));
  const measure=new THREE.Group();const p=[-32,.1,39,32,.1,39,-32,.1,37,-32,.1,41,32,.1,37,32,.1,41];measure.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(p,3)),new THREE.LineBasicMaterial({color:0x8dab9d,transparent:true,opacity:.5})));g.add(measure);
  const txt=textSprite('ILLUSTRATIVE • MACRO',{width:45,fontSize:14});txt.position.set(0,.3,48);txt.material.opacity=.45;g.add(txt);g.userData.illustrativeLabel=txt;
  for(const [x,z,a,l]of[[-60,-28,-1.2,29],[57,-38,1.9,36],[-39,52,3.6,25]]){const leaf=makeLeaf({length:l,width:l*.48,curl:.11});leaf.position.set(x,-.8,z);leaf.rotation.y=a;g.add(leaf);}
  return g;
}

export function createHabitat(){
  const g=new THREE.Group(),randoms=random(2719),m=materials();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(174,177,8,128),new THREE.MeshStandardMaterial({color:0x152528,metalness:.65,roughness:.5}));base.position.y=-7;g.add(base);
  const geo=new THREE.CircleGeometry(172,128,1);const pos=geo.attributes.position;
  // CircleGeometry is a single fan: a subdivided disk gives low-relief substrate.
  const radial=new THREE.BufferGeometry(),v=[0,0,0],uv=[.5,.5],ix=[],rings=16,sectors=128;
  for(let r=1;r<=rings;r++)for(let j=0;j<sectors;j++){const a=j/sectors*TAU,rr=r/rings*172,x=Math.cos(a)*rr,z=Math.sin(a)*rr;v.push(x,Math.sin(x*.14)*Math.cos(z*.16)*.6+randoms()*.45-2,z);uv.push(x/344+.5,z/344+.5);if(r===1)ix.push(0,1+j,1+(j+1)%sectors);else{const b=1+(r-2)*sectors+j,c=1+(r-1)*sectors+j,bn=1+(r-2)*sectors+(j+1)%sectors,cn=1+(r-1)*sectors+(j+1)%sectors;ix.push(b,c,cn,b,cn,bn);}}
  radial.setAttribute('position',new THREE.Float32BufferAttribute(v,3));radial.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));radial.setIndex(ix);radial.computeVertexNormals();geo.dispose();
  g.add(new THREE.Mesh(radial,new THREE.MeshStandardMaterial({map:soilTexture(),color:0xa5a58a,roughness:.98,metalness:0,side:THREE.DoubleSide})));
  g.add(ring(174,-2,0x5b9c8a,.58),ring(177,-6,0x263e3c,.4),ruler(166,-.4,180));
  for(const [x,z,h,s]of[[-112,-75,45,12],[-68,-136,38,32],[89,-102,51,74],[134,8,32,22],[-137,36,33,21],[69,127,28,76],[-42,143,18,76]])g.add(plant(x,z,h,s));
  for(let i=0;i<22;i++){const a=randoms()*TAU,r=95+randoms()*64;const leaf=makeLeaf({length:14+randoms()*16,width:8+randoms()*9,curl:.1,tint:i%3===0});leaf.position.set(Math.cos(a)*r,-1,Math.sin(a)*r);leaf.rotation.y=randoms()*TAU;leaf.rotation.z=(randoms()-.5)*.3;g.add(leaf);}
  // Thousands of independently shaded moss tips share one draw call.
  const mossGeo=new THREE.SphereGeometry(1,5,4),mossMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95});const moss=new THREE.InstancedMesh(mossGeo,mossMat,2000),dummy=new THREE.Object3D(),c=new THREE.Color();
  for(let i=0;i<2000;i++){const patch=i%17,pa=patch*2.39996323,pr=65+48*Math.sin(patch*3.7)**2,a=randoms()*TAU,r=Math.sqrt(randoms())*(10+patch%4*5),x=Math.cos(pa)*pr+Math.cos(a)*r,z=Math.sin(pa)*pr+Math.sin(a)*r;dummy.position.set(x,-1.2,z);const s=.9+randoms()*2.3;dummy.scale.set(s,.6+randoms()*1.8,s*.85);dummy.rotation.set(randoms(),randoms(),randoms());dummy.updateMatrix();moss.setMatrixAt(i,dummy.matrix);c.setHSL(.21+randoms()*.07,.22+randoms()*.2,.065+randoms()*.06);moss.setColorAt(i,c);}moss.instanceMatrix.needsUpdate=true;g.add(moss);
  const leafLitter=new THREE.Group();for(let i=0;i<24;i++){const a=randoms()*TAU,r=35+randoms()*120,x=Math.cos(a)*r,z=Math.sin(a)*r;const twig=tube([[x,-.5,z],[x+4,0,z+4],[x+8,.3,z+10]],.18,new THREE.MeshStandardMaterial({color:0x685038,roughness:1}),3);leafLitter.add(twig);}g.add(leafLitter);
  const rimLabels=[['N',0,-164],['E',164,0],['S',0,164],['W',-164,0]];for(const [txt,x,z]of rimLabels){const sprite=textSprite(txt,{width:15,fontSize:32});sprite.position.set(x,3,z);g.add(sprite);}
  return g;
}

export function createSource(channel=0){
  const g=new THREE.Group(),m=materials(),fruit=new THREE.Group();g.add(fruit);
  const color=channel===0?0xe94f30:0x6f6cc4;
  const skin=new THREE.MeshPhysicalMaterial({color,roughness:.52,metalness:.02,clearcoat:.27,clearcoatRoughness:.4});
  if(channel===0){
    const strawberry=new THREE.SphereGeometry(1,32,24),p=strawberry.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=(y+1)/2,rad=.62+.38*t;p.setXYZ(i,x*rad*9,y*11+10,z*rad*9);}strawberry.computeVertexNormals();fruit.add(new THREE.Mesh(strawberry,skin));
    const seedGeo=new THREE.SphereGeometry(1,6,5),seedMat=new THREE.MeshStandardMaterial({color:0xebbe73,roughness:.55});const seeds=new THREE.InstancedMesh(seedGeo,seedMat,120),dummy=new THREE.Object3D();
    for(let i=0;i<120;i++){const y=1-2*(i+.5)/120,theta=i*2.39996323,rad=Math.sqrt(1-y*y)*(.62+.38*(y+1)/2);const n=new THREE.Vector3(Math.cos(theta)*rad,y*.7,Math.sin(theta)*rad).normalize();dummy.position.set(Math.cos(theta)*rad*9.02,y*11+10,Math.sin(theta)*rad*9.02);dummy.scale.set(.28,.52,.18);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);dummy.updateMatrix();seeds.setMatrixAt(i,dummy.matrix);}fruit.add(seeds);
    for(let i=0;i<5;i++){const leaf=makeLeaf({length:8,width:3,curl:.03});leaf.position.y=20;leaf.rotation.y=i*TAU/5;leaf.rotation.x=-.38;fruit.add(leaf);}
    fruit.add(tube([[0,20,0],[1,25,1],[0,28,2]],.4,m.stem));
  }else{
    for(const [x,y,z,s]of[[-5,7,0,7],[5,6,2,6.5],[0,15,2,6.5],[-1,8,-7,6]]){const berry=new THREE.Mesh(m.sphere,skin);berry.position.set(x,y,z);berry.scale.setScalar(s);fruit.add(berry);const crown=ring(s*.32,y+s*.93,0x2e2854,.8);crown.position.set(x,0,z);fruit.add(crown);}
    const leaf=makeLeaf({length:19,width:8,curl:.05,tint:1});leaf.position.set(0,0,-6);leaf.rotation.y=-1.2;fruit.add(leaf);
  }
  const marker=ring(15,.3,channel===0?0xdbb075:0x8d9ade,.72);g.add(marker);
  const leader=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,28,0),new THREE.Vector3(0,39,0)]),new THREE.LineBasicMaterial({color:channel===0?0xd1ab76:0x8a9fce,transparent:true,opacity:.4}));g.add(leader);
  const label=textSprite(channel===0?'A':'B',{width:15,fontSize:34,color:channel===0?'#e5c18e':'#aaaee7'});label.position.y=43;g.add(label);
  g.userData={fruit,marker,label};return g;
}

export function createTrainingChamber(){
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.BoxGeometry(322,8,232),new THREE.MeshStandardMaterial({color:0x162b2c,metalness:.6,roughness:.45}));base.position.y=-6;g.add(base);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(308,218),new THREE.MeshStandardMaterial({color:0x253536,metalness:.4,roughness:.6}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.9;g.add(floor);
  const grid=[];for(let x=-150;x<=150;x+=15)grid.push(x,-1.7,-105,x,-1.7,105);for(let z=-105;z<=105;z+=15)grid.push(-150,-1.7,z,150,-1.7,z);
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(grid,3)),new THREE.LineBasicMaterial({color:0x83a899,transparent:true,opacity:.12})));
  const outline=[];for(const y of[-1.5,75]){outline.push(-150,y,-105,150,y,-105,150,y,-105,150,y,105,150,y,105,-150,y,105,-150,y,105,-150,y,-105);}for(const x of[-150,150])for(const z of[-105,105])outline.push(x,-1.5,z,x,75,z);
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(outline,3)),new THREE.LineBasicMaterial({color:0x92c4b7,transparent:true,opacity:.3})));
  const glass=new THREE.Mesh(new THREE.BoxGeometry(300,76.5,210),new THREE.MeshPhysicalMaterial({color:0x7db5b0,transparent:true,opacity:.025,roughness:.1,metalness:.15,side:THREE.BackSide,depthWrite:false}));glass.position.y=36.75;g.add(glass);
  const marks=[];for(let i=-15;i<=15;i++){const x=i*10;marks.push(x,-1.4,107,x,-1.4,107+(i%5===0?5:2));}
  for(let i=-10;i<=10;i++){const z=i*10;marks.push(-152,-1.4,z,-152-(i%5===0?5:2),-1.4,z);}
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(marks,3)),new THREE.LineBasicMaterial({color:0xa1bba8,transparent:true,opacity:.5})));
  const label=textSprite('CONTROLLED CHAMBER',{width:58,fontSize:17,color:'#a3bfb0'});label.position.set(0,0,115);label.material.opacity=.65;g.add(label);
  return g;
}
