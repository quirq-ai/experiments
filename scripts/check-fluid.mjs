import assert from 'node:assert/strict';
import {Fluid,defaults} from '../lib/fluid.ts';
const results=[];
const f=new Fluid('sandbox',40);f.splat(.95,.5,1,.6,.12);const before=f.divergenceRms();f.project(.01,100);assert(f.after<before*.03,`Projection residual ${f.after} / ${before}`);results.push({test:'Pressure correction',before,after:f.after});
const energies=[];for(const viscosity of [0,.006]){const v=new Fluid('vortices',40);const initial=v.measure().energy;while(v.time<.8)v.step({...defaults,viscosity},.008);const final=v.measure().energy;assert(final<initial);energies.push({viscosity,initial,final});}assert(energies[1].final<energies[0].final*.65);results.push({test:'Viscosity dissipates energy',energies});
for(const scene of ['cylinder','nozzle','vortices','sandbox']){const v=new Fluid(scene,40);for(let n=0;n<100;n++)v.step({...defaults,viscosity:.006,inflow:1.5});for(const a of [v.u,v.v,v.p,v.dye])assert(a.every(Number.isFinite),scene+' contains nonfinite values');assert(v.after<v.before+.0001);results.push({test:'Stable '+scene,stats:v.measure()});}
const v=new Fluid('cylinder',40);const time=v.time;v.step(defaults);assert(v.time>time);v.reset();assert.equal(v.time,0);assert.equal(v.steps,0);v.obstacle(1,.5,.1);assert.equal(v.solid[v.id(Math.floor(1/v.h)+1,Math.floor(.5/v.h)+1)],0);v.obstacle(1,.5,.1,true);assert.equal(v.solid[v.id(Math.floor(1/v.h)+1,Math.floor(.5/v.h)+1)],1);results.push({test:'Restart and obstacle tools',passed:true});
console.log(JSON.stringify(results,null,2));
