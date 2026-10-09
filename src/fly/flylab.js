import * as THREE from 'three';
import { createFlyAsset } from './render/flyAsset.js';
import { createHabitat, createSource, createSpecimenStage, createTrainingChamber } from './render/habitat.js';

const SCALE=1000;
const MAX_TRAIL=720;
const COLORS=[0xb2d1b0,0xa2bfe7,0xe5bd86,0xc2a0d4,0x88c4bd,0xd3d494];
const color=new THREE.Color();

function puffsView(){
  const count=300,positions=new Float32Array(count*3),sizes=new Float32Array(count),concentrations=new Float32Array(count),colors=new Float32Array(count*3);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('size',new THREE.BufferAttribute(sizes,1).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('intensity',new THREE.BufferAttribute(concentrations,1).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);
  const material=new THREE.ShaderMaterial({uniforms:{uScreenScale:{value:900}},vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float size; attribute float intensity; varying vec3 vColor; varying float vIntensity; uniform float uScreenScale;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main(){vColor=color;vIntensity=intensity;vec4 mvPosition=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mvPosition;gl_PointSize=clamp(size*uScreenScale/max(.1,-mvPosition.z),1.0,240.0);
    #include <logdepthbuf_vertex>
    }`,
    fragmentShader:`varying vec3 vColor;varying float vIntensity;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    void main(){vec2 p=gl_PointCoord-.5;float d=dot(p,p)*4.;if(d>1.)discard;float a=exp(-d*4.)*(1.-smoothstep(.65,1.,d))*.055*vIntensity;gl_FragColor=vec4(vColor,a);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.renderOrder=2;return points;
}
function trailView(hex=COLORS[0]){
  const positions=new Float32Array(MAX_TRAIL*3),colors=new Float32Array(MAX_TRAIL*3),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));
  const col=new THREE.Color(hex);for(let i=0;i<MAX_TRAIL;i++){const fade=.10+.9*i/(MAX_TRAIL-1);colors[i*3]=col.r*fade;colors[i*3+1]=col.g*fade;colors[i*3+2]=col.b*fade;}
  geometry.setDrawRange(0,0);
  const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.62,depthWrite:false}));line.frustumCulled=false;line.userData={count:0,last:null,baseColor:col};return line;
}
function appendTrail(line,x,y,z){
  const data=line.userData,positions=line.geometry.attributes.position.array,last=data.last;
  if(last&&(last[0]-x)**2+(last[1]-y)**2+(last[2]-z)**2<.65)return;
  if(data.count===MAX_TRAIL){positions.copyWithin(0,3);data.count--;}
  positions.set([x,y,z],data.count*3);data.count++;data.last=[x,y,z];line.geometry.setDrawRange(0,data.count);line.geometry.attributes.position.needsUpdate=true;
  const colors=line.geometry.attributes.color;for(let i=0;i<data.count;i++){const fade=.2+.8*i/Math.max(1,data.count-1);colors.setXYZ(i,data.baseColor.r*fade,data.baseColor.g*fade,data.baseColor.b*fade);}colors.needsUpdate=true;
}
function disposeGroup(g){g.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});g.clear();}

/** View-only adapter. All coordinates come from the authoritative simulation.
 * The specimen and flying body models are illustrative; expedition bodies are
 * enlarged 2.6× for visibility. Position, source and field coordinates use SI.
 */
export class FlyLab {
  constructor(scene,{camera,controls}={}){
    this.scene=scene;this.camera=camera;this.controls=controls;this.group=new THREE.Group();this.group.name='Fly Expedition Lab';this.group.visible=false;scene.add(this.group);
    this.stage='create';this.time=0;this.snapshot=null;this.selectedId=null;this.showField=true;this.anatomyVisible=false;this.initialized=false;this.flies=new Map();this.sources=new Map();this._savedScene=null;this._lastTick=-1;this.onSelect=null;
  }
  init(){
    if(this.initialized)return;this.initialized=true;
    const key=new THREE.DirectionalLight(0xffe0ac,3.3);key.position.set(80,160,90);
    const rim=new THREE.DirectionalLight(0x75b9cc,2.8);rim.position.set(-100,100,-120);
    const fill=new THREE.DirectionalLight(0xc4d8ae,.6);fill.position.set(0,20,140);
    const hemi=new THREE.HemisphereLight(0x98b1b2,0x372312,1.2);this.group.add(key,rim,fill,hemi);
    this.specimenStage=createSpecimenStage();this.group.add(this.specimenStage);
    this.hero=createFlyAsset({detail:true});this.hero.scale.setScalar(18);this.hero.position.set(5,18.2,0);this.hero.rotation.y=.18;this.group.add(this.hero);
    this.habitat=createHabitat();this.habitat.visible=false;this.group.add(this.habitat);
    this.chamber=createTrainingChamber();this.chamber.visible=false;this.group.add(this.chamber);
    this.sourceGroup=new THREE.Group();this.flyGroup=new THREE.Group();this.trailGroup=new THREE.Group();this.replayTrails=new THREE.Group();this.anatomyGroup=new THREE.Group();this.anatomyGroup.visible=false;
    this.group.add(this.sourceGroup,this.flyGroup,this.trailGroup,this.replayTrails,this.anatomyGroup);
    this.field=puffsView();this.group.add(this.field);
    const ringGeo=new THREE.RingGeometry(6,6.5,48),ringMat=new THREE.MeshBasicMaterial({color:0xc6dfbd,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false});this.selection=new THREE.Mesh(ringGeo,ringMat);this.selection.rotation.x=-Math.PI/2;this.selection.visible=false;this.group.add(this.selection);
    this.setStage(this.stage);
    if(this._pendingAnatomy){this.setAnatomy(this._pendingAnatomy);this._pendingAnatomy=null;}
    if(this.snapshot)this.setSnapshot(this.snapshot);
    if(this._pendingTrails){this.setTrails(this._pendingTrails);this._pendingTrails=null;}
  }
  setStage(stage){
    this.stage=stage||'create';if(!this.initialized)return;
    const hero=this.stage==='create'||this.stage==='specimen';this.specimenStage.visible=hero||this.anatomyVisible;this.hero.visible=hero&&!this.anatomyVisible;this.habitat.visible=!hero&&this.stage!=='train'&&!this.anatomyVisible;this.chamber.visible=this.stage==='train'&&!this.anatomyVisible;
    this.sourceGroup.visible=!hero&&!this.anatomyVisible;this.flyGroup.visible=!hero&&!this.anatomyVisible;this.trailGroup.visible=!hero&&!this.anatomyVisible;this.replayTrails.visible=(this.stage==='compare')&&!this.anatomyVisible;this.field.visible=!hero&&this.showField&&!this.anatomyVisible;this.anatomyGroup.visible=this.anatomyVisible;this.selection.visible=false;if(this.specimenStage.userData.illustrativeLabel)this.specimenStage.userData.illustrativeLabel.visible=!this.anatomyVisible;
  }
  setSnapshot(snapshot){
    if(!snapshot)return;this.snapshot=snapshot;if(!this.initialized)return;
    const count=snapshot.flies?.length||0;
    if(Number.isFinite(snapshot.tick)&&snapshot.tick<this._lastTick){for(const {trail}of this.flies.values()){trail.userData.count=0;trail.userData.last=null;trail.geometry.setDrawRange(0,0);}}
    this._lastTick=snapshot.tick??this._lastTick;
    const ids=new Set();
    for(let i=0;i<count;i++){
      const f=snapshot.flies[i],id=f.id??String(i);ids.add(id);let visual=this.flies.get(id);
      if(!visual){const fly=createFlyAsset({detail:false});fly.scale.setScalar(2.6);this.flyGroup.add(fly);const trail=trailView(COLORS[i%COLORS.length]);this.trailGroup.add(trail);visual={fly,trail,target:new THREE.Vector3(),yaw:0,state:f};this.flies.set(id,visual);fly.userData.specimenId=id;}
      const {fly,trail,target}=visual;target.set((f.x??0)*SCALE,(f.y??.025)*SCALE,(f.z??0)*SCALE);
      if(!visual.received)fly.position.copy(target);visual.received=true;visual.state=f;visual.yaw=-(f.yaw??0);fly.visible=true;trail.visible=true;
      appendTrail(trail,target.x,target.y,target.z);
    }
    for(const [id,v]of this.flies){if(!ids.has(id)){v.fly.visible=false;v.trail.visible=false;}}
    const sourceIds=new Set();for(let i=0;i<(snapshot.sources?.length||0);i++){
      const s=snapshot.sources[i],id=s.id??String(i);sourceIds.add(id);let object=this.sources.get(id);
      if(!object){object=createSource(s.channel??i%2);this.sourceGroup.add(object);this.sources.set(id,object);}
      object.position.set((s.x??0)*SCALE,0,(s.z??0)*SCALE);object.visible=s.active!==false;
      // Source markers remain anchored to the sensor field's source height.
      object.userData.label.position.y=Math.max(35,(s.y??.02)*SCALE+15);
    }
    for(const [id,object]of this.sources)if(!sourceIds.has(id))object.visible=false;
    const puffs=snapshot.puffs||[],geometry=this.field.geometry,attrs=geometry.attributes,n=Math.min(300,puffs.length),offset=Math.max(0,puffs.length-n);
    for(let i=0;i<n;i++){
      const p=puffs[offset+i];attrs.position.setXYZ(i,(p.x??0)*SCALE,(p.y??.02)*SCALE,(p.z??0)*SCALE);attrs.size.setX(i,Math.max(1,(p.radius??p.sigma??.005)*SCALE*4));attrs.intensity.setX(i,Math.min(2,Math.max(.03,p.concentration??p.strength??1)));
      color.setHex((p.channel??0)===0?0xdbb980:0xa2b5e7);attrs.color.setXYZ(i,color.r,color.g,color.b);
    }
    geometry.setDrawRange(0,n);for(const attr of Object.values(attrs))attr.needsUpdate=true;
  }
  setTrails(runs=[]){
    if(!this.initialized){this._pendingTrails=runs;return;}disposeGroup(this.replayTrails);
    const list=Array.isArray(runs)?runs:[runs];
    for(let i=0;i<Math.min(18,list.length);i++){
      const run=list[i],samples=Array.isArray(run)?run:(run.trajectory??run.samples??run.frames??run.replay??[]);if(!samples.length)continue;
      const line=trailView(COLORS[i%COLORS.length]),stride=Math.max(1,Math.ceil(samples.length/MAX_TRAIL));
      for(let j=0;j<samples.length;j+=stride){const s=samples[j],p=s.flies?.[0]??s.position??s;const x=Array.isArray(p)?p[0]:p.x,y=Array.isArray(p)?p[1]:p.y,z=Array.isArray(p)?p[2]:p.z;if(Number.isFinite(x)&&Number.isFinite(z))appendTrail(line,x*SCALE,(y??.025)*SCALE,z*SCALE);}
      this.replayTrails.add(line);
    }
  }
  setSelected(id){this.selectedId=id;}
  setOverlay(on){this.showField=!!on;this.setStage(this.stage);}
  setAnatomy(data){
    if(!this.initialized){this._pendingAnatomy=data;return;}disposeGroup(this.anatomyGroup);if(!data?.neurons?.length)return;
    const bounds=new THREE.Box3();for(const neuron of data.neurons)for(const node of neuron.nodes)bounds.expandByPoint(new THREE.Vector3(node[1],node[2],node[3]));
    const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),scale=100/Math.max(size.x,size.y,size.z);
    data.neurons.forEach((neuron,index)=>{
      const lookup=new Map(neuron.nodes.map(node=>[node[0],node])),p=[];
      for(const node of neuron.nodes){const parent=lookup.get(node[5]);if(!parent)continue;for(const n of [node,parent])p.push((n[1]-center.x)*scale,30-(n[2]-center.y)*scale,(n[3]-center.z)*scale);}
      const line=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(p,3)),new THREE.LineBasicMaterial({color:index%2?0xb6d8c0:0xe8b973,transparent:true,opacity:.74}));line.userData={bodyId:neuron.bodyId,type:neuron.type};this.anatomyGroup.add(line);
    });
    this.anatomyData=data;
  }
  showAnatomy(on){this.anatomyVisible=!!on;this.init();this.setStage(this.stage);}
  update(dt=0){
    if(!this.group.visible||!this.initialized)return;this.time+=Math.min(dt,.1);const blend=1-Math.exp(-Math.min(dt,.1)*12);
    this.hero.update(this.time,false);
    for(const [id,v]of this.flies){if(!v.fly.visible)continue;v.fly.position.lerp(v.target,blend);let delta=v.yaw-v.fly.rotation.y;delta=Math.atan2(Math.sin(delta),Math.cos(delta));v.fly.rotation.y+=delta*blend;v.fly.rotation.z=-.04;v.fly.update(this.time,!v.state.success);}
    const selected=this.flies.get(this.selectedId)??this.flies.values().next().value;
    if(selected&&this.flyGroup.visible&&selected.fly.visible){this.selection.visible=true;this.selection.position.set(selected.fly.position.x,.5,selected.fly.position.z);this.selection.material.opacity=.38+Math.sin(this.time*2)*.12;}else this.selection.visible=false;
    if(this.camera)this.field.material.uniforms.uScreenScale.value=(typeof innerHeight==='number'?innerHeight:900)/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov??42)/2));
  }
  frameView(stage=this.stage){
    const hero=stage==='create'||stage==='specimen',anatomy=this.anatomyVisible;
    const baseTarget=new THREE.Vector3(0,anatomy?28:hero||stage==='train'?16:12,0);
    const position=new THREE.Vector3(...(anatomy?[115,72,150]:hero?[118,88,142]:stage==='train'?[255,240,305]:[270,275,345]));
    const offset=position.sub(baseTarget),baseDistance=offset.length(),direction=offset.normalize();
    const width=typeof innerWidth==='number'?innerWidth:1280,height=typeof innerHeight==='number'?innerHeight:720;
    const compact=width<=620,left=compact?15:width<=900?294:330,right=compact?15:width<=900?14:width<=1100?175:205;
    const available=Math.max(120,width-left-right),focal=height/(2*Math.tan(THREE.MathUtils.degToRad(this.camera?.fov??42)/2));
    // Below 620 px the console is a bottom sheet. Fit the complete instrument in
    // the upper viewport, leaving the toolbar and controls clear below it.
    const compactVerticalDistance=compact?(hero||anatomy?94:260)*focal/(height*.30):0;
    const distance=Math.max(baseDistance,(hero||anatomy?132:362)*focal/(available*.94),compactVerticalDistance);
    const cameraRight=new THREE.Vector3(direction.z,0,-direction.x).normalize(),cameraUp=direction.clone().cross(cameraRight).normalize();
    const target=baseTarget.clone().addScaledVector(cameraRight,-((left+(width-right))/2-width/2)*distance/focal)
      .addScaledVector(cameraUp,height*(compact?-.18:hero?.065:.035)*distance/focal);
    return {pos:target.clone().addScaledVector(direction,distance).toArray(),target:target.toArray()};
  }
  onShow(){
    this.init();this.group.visible=true;
    if(!this._savedScene){this._savedScene={background:this.scene.background,fog:this.scene.fog,lights:[]};for(const o of this.scene.children)if(o.isLight){this._savedScene.lights.push([o,o.visible]);o.visible=false;}}
    this.scene.background=new THREE.Color(0x070e12);this.scene.fog=new THREE.FogExp2(0x070e12,.00072);
  }
  onHide(){
    this.group.visible=false;if(this._savedScene){this.scene.background=this._savedScene.background;this.scene.fog=this._savedScene.fog;for(const [light,visible]of this._savedScene.lights)light.visible=visible;this._savedScene=null;}
  }
  traceSnapshot(){const t=this.snapshot?.t??0;return {mode:'fly',name:'Scent Seekers',t,status:`${this.stage} · ${(this.snapshot?.flies??[]).length} flies`,points:(this.snapshot?.flies??[]).map(f=>({id:f.id,name:'Fly',t,actual:{x:f.x,y:f.y,z:f.z},expected:null,err:null})),stage:this.stage,tick:this.snapshot?.tick??0,sources:this.snapshot?.sources??[],wind:this.snapshot?.wind??[0,0,0]};}
  status(){const flies=this.snapshot?.flies??[];return {stage:this.stage,time:this.snapshot?.t??0,flies:flies.length,arrived:flies.filter(f=>f.success).length,selected:this.selectedId,anatomy:this.anatomyVisible};}
}
