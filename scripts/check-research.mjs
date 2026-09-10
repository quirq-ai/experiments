import assert from 'node:assert/strict';
import {coreScales,sectionFromLocation,sectionHref} from '../lib/research.ts';

assert.equal(sectionFromLocation('/gpt-breakthrough/',''),'breakthrough');
assert.equal(sectionFromLocation('/',''),'playground');
for(const hash of ['#gpt-breakthrough','#the-result','#the-model','#the-mechanism','#the-evidence']){
 assert.equal(sectionFromLocation('/downloads/flow-lab.html',hash),'breakthrough','Offline article links must remain in the article');
}
assert.equal(sectionFromLocation('/downloads/flow-lab.html','#playground'),'playground');
assert.equal(sectionHref('breakthrough','file:'),'#gpt-breakthrough');
assert.equal(sectionHref('playground','file:'),'#playground');
assert.equal(sectionHref('breakthrough','http:'),'/gpt-breakthrough');
assert.equal(sectionHref('playground','http:'),'/');
assert.deepEqual(coreScales(0),{tau:1,radius:1,speed:1,energy:1});
const a=coreScales(1),b=coreScales(4);
assert(b.tau<a.tau&&b.radius<a.radius&&b.energy<a.energy&&b.speed>a.speed);
assert(Math.abs(b.radius-.01)<1e-12);
assert(Math.abs(b.speed-10**2.02)<1e-10);
assert(Math.abs(b.energy-10**-1.94)<1e-12);
assert(Object.values(b).every(Number.isFinite));
console.log('Research checks passed: direct/offline navigation, article anchors, and normalized asymptotic scales.');
