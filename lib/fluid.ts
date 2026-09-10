export type Scene = 'cylinder' | 'nozzle' | 'vortices' | 'sandbox';
export type Field = 'dye' | 'speed' | 'pressure' | 'vorticity';
export type Parameters = { viscosity: number; inflow: number; force: number; advection: boolean; projection: boolean; diffusion: boolean; dye: boolean; iterations: number };
export const defaults: Parameters = { viscosity: .00035, inflow: .6, force: 1, advection: true, projection: true, diffusion: true, dye: true, iterations: 45 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// MAC grid: u and v on cell faces; p and tracer concentration at cell centers.
// Coordinates and all displayed physical values are nondimensional.
export class Fluid {
  nx: number; ny: number; stride: number; size: number; h: number; width: number;
  u: Float32Array; v: Float32Array; p: Float32Array; dye: Float32Array; solid: Uint8Array;
  u0: Float32Array; v0: Float32Array; d0: Float32Array; curl: Float32Array;
  scene: Scene; time = 0; steps = 0; before = 0; after = 0; lastDt = 0; peakSpeed = 1;
  constructor(scene: Scene = 'cylinder', ny = 80) {
    this.ny = ny; this.nx = Math.round(ny * 1.9); this.h = 1 / ny; this.width = this.nx / ny;
    this.stride = this.nx + 2; this.size = this.stride * (ny + 2); this.scene = scene;
    this.u = new Float32Array(this.size); this.v = new Float32Array(this.size); this.p = new Float32Array(this.size);
    this.dye = new Float32Array(this.size); this.solid = new Uint8Array(this.size);
    this.u0 = new Float32Array(this.size); this.v0 = new Float32Array(this.size); this.d0 = new Float32Array(this.size); this.curl = new Float32Array(this.size);
    this.reset(scene);
  }
  id(i: number, j: number) { return i + j * this.stride; }
  get open() { return this.scene === 'cylinder' || this.scene === 'nozzle'; }
  reset(scene = this.scene) {
    this.scene = scene; this.time = 0; this.steps = 0; this.peakSpeed = 1;
    for (const f of [this.u, this.v, this.p, this.dye, this.curl]) f.fill(0);
    this.solid.fill(0);
    for (let j = 1; j <= this.ny; j++) for (let i = 1; i <= this.nx + (this.open ? 1 : 0); i++) this.solid[this.id(i, j)] = 1;
    if (scene === 'cylinder') this.obstacle(.56, .5, .105, false);
    if (scene === 'nozzle') for (let j = 1; j <= this.ny; j++) for (let i = 1; i <= this.nx; i++) {
      const x = (i - .5) * this.h, y = (j - .5) * this.h;
      if (x > .62 && x < .78 && Math.abs(y - .5) > .13) this.solid[this.id(i, j)] = 0;
    }
    if (this.open) for (let j = 1; j <= this.ny; j++) for (let i = 1; i <= this.nx; i++) {
      const k = this.id(i, j);
      this.u[k] = this.solid[k] ? .6 : 0;
      const y = (j - .5) * this.h;
      this.dye[k] = this.solid[k] && i * this.h < .38 ? .75 * Math.pow(.5 + .5 * Math.cos(y * Math.PI * 16), 10) : 0;
    }
    if (scene === 'vortices' || scene === 'sandbox') {
      this.vortex(.7, .5, 1); this.vortex(1.2, .5, scene === 'vortices' ? -1 : 1);
    }
    this.boundaries(.6); this.project(1 / 60, 100); this.measure();
  }
  sample(f: Float32Array, x: number, y: number, ox = .5, oy = .5) {
    const gx = clamp(x / this.h + 1 - ox, 0, this.nx + .999);
    const gy = clamp(y / this.h + 1 - oy, 0, this.ny + .999);
    const i = Math.floor(gx), j = Math.floor(gy), tx = gx - i, ty = gy - j, k = this.id(i, j);
    return (1-tx)*(1-ty)*f[k] + tx*(1-ty)*f[k+1] + (1-tx)*ty*f[k+this.stride] + tx*ty*f[k+this.stride+1];
  }
  velocity(x: number, y: number, u = this.u, v = this.v) { return [this.sample(u,x,y,0,.5), this.sample(v,x,y,.5,0)]; }
  boundaries(inflow: number) {
    const s = this.stride;
    for (let j = 1; j <= this.ny; j++) {
      if (this.open) {
        this.u[this.id(1,j)] = inflow;
        this.u[this.id(this.nx+1,j)] = this.u[this.id(this.nx,j)];
        this.v[this.id(this.nx+1,j)] = this.v[this.id(this.nx,j)];
      }
      for (let i = 1; i <= this.nx+1; i++) {
        const k = this.id(i,j);
        if ((!this.solid[k] || !this.solid[k-1]) && !(this.open && i===1)) this.u[k] = 0;
        if (!this.solid[k] || !this.solid[k-s]) this.v[k] = 0;
      }
    }
    this.refreshTangentialGhosts();
  }
  refreshTangentialGhosts() {
    // Copy only tangential values; preserve the projected outlet normal flux.
    for(let i=1;i<=this.nx+1;i++) { this.u[this.id(i,0)] = this.u[this.id(i,1)]; this.u[this.id(i,this.ny+1)] = this.u[this.id(i,this.ny)]; }
    if (!this.open) for(let j=1;j<=this.ny+1;j++) { this.v[this.id(0,j)] = this.v[this.id(1,j)]; this.v[this.id(this.nx+1,j)] = this.v[this.id(this.nx,j)]; }
  }
  divergenceRms() {
    let sum=0, n=0; const s=this.stride;
    for(let j=1;j<=this.ny;j++) for(let i=1;i<=this.nx;i++) { const k=this.id(i,j); if(!this.solid[k]) continue;
      const d=(this.u[k+1]-this.u[k]+this.v[k+s]-this.v[k])/this.h; sum+=d*d; n++;
    }
    return Math.sqrt(sum/Math.max(1,n));
  }
  project(dt: number, iterations: number) {
    this.before=this.divergenceRms(); this.p.fill(0); const s=this.stride;
    for(let it=0;it<iterations;it++) for(let j=1;j<=this.ny;j++) for(let i=1;i<=this.nx;i++) {
      const k=this.id(i,j); if(!this.solid[k]) continue;
      const l=this.solid[k-1], r=this.solid[k+1], b=this.solid[k-s], t=this.solid[k+s], sum=l+r+b+t;
      if(!sum) continue;
      const correction=-1.75*(this.u[k+1]-this.u[k]+this.v[k+s]-this.v[k])/sum;
      this.u[k]-=l*correction; this.u[k+1]+=r*correction; this.v[k]-=b*correction; this.v[k+s]+=t*correction;
      this.p[k]+=this.h/dt*correction;
    }
    // Gauge for closed domains. Open outlet uses zero-pressure exterior.
    if(!this.open) { let mean=0,n=0; for(let k=0;k<this.size;k++) if(this.solid[k]) {mean+=this.p[k];n++;} mean/=n||1;
      for(let k=0;k<this.size;k++) if(this.solid[k]) this.p[k]-=mean;
    }
    this.after=this.divergenceRms();
  }
  diffuse(dt: number, nu: number) {
    if(nu<=0) return;
    // Explicit diffusion; step() enforces nu*dt/h² <= .22.
    const a=nu*dt/(this.h*this.h), s=this.stride;
    this.u0.set(this.u); this.v0.set(this.v);
    for(let j=1;j<=this.ny;j++) for(let i=1;i<=this.nx;i++) { const k=this.id(i,j); if(!this.solid[k]) continue;
      if(this.solid[k-1]) {
        const c=this.u0[k]; let lap=0;
        for(const d of [-1,1,-s,s]) lap+=(Math.abs(d)===1||this.solid[k+d]&&this.solid[k+d-1]?this.u0[k+d]:c)-c;
        this.u[k]=c+a*lap;
      }
      if(this.solid[k-s]) {
        const c=this.v0[k]; let lap=0;
        for(const d of [-1,1,-s,s]) lap+=(Math.abs(d)===s||this.solid[k+d]&&this.solid[k+d-s]?this.v0[k+d]:c)-c;
        this.v[k]=c+a*lap;
      }
    }
  }
  advectVelocity(dt: number) {
    this.u0.set(this.u); this.v0.set(this.v); const h=this.h,s=this.stride;
    for(let j=1;j<=this.ny;j++) for(let i=1;i<=this.nx;i++) {const k=this.id(i,j); if(!this.solid[k]) continue;
      if(this.solid[k-1]) {const x=(i-1)*h,y=(j-.5)*h;
        // Velocity at this u face: average the four surrounding v faces.
        const vy=.25*(this.v0[k]+this.v0[k+s]+this.v0[k-1]+this.v0[k-1+s]);
        this.u[k]=this.sample(this.u0,x-dt*this.u0[k],y-dt*vy,0,.5);
      }
      if(this.solid[k-s]) {const x=(i-.5)*h,y=(j-1)*h;const ux=.25*(this.u0[k]+this.u0[k+1]+this.u0[k-s]+this.u0[k-s+1]);
        this.v[k]=this.sample(this.v0,x-dt*ux,y-dt*this.v0[k],.5,0);
      }
    }
  }
  step(params: Parameters, requestedDt=1/60) {
    const nu=params.diffusion?params.viscosity:0;
    const dt=Math.min(requestedDt, .8*this.h/Math.max(this.peakSpeed,.1), nu>0?.22*this.h*this.h/nu:1);
    this.lastDt=dt;
    if(params.advection) this.advectVelocity(dt);
    this.boundaries(params.inflow);
    this.diffuse(dt,nu);
    this.boundaries(params.inflow);
    if(params.projection) this.project(dt,params.iterations);
    else {this.p.fill(0);this.before=this.divergenceRms();this.after=this.before;}
    this.refreshTangentialGhosts();
    this.d0.set(this.dye);
    const s=this.stride;
    for(let j=1;j<=this.ny;j++) for(let i=1;i<=this.nx;i++) {const k=this.id(i,j); if(!this.solid[k]) {this.dye[k]=0;continue;}
      const x=(i-.5)*this.h,y=(j-.5)*this.h,u=.5*(this.u[k]+this.u[k+1]),v=.5*(this.v[k]+this.v[k+s]);
      this.dye[k]=this.sample(this.d0,x-dt*u,y-dt*v)*Math.exp(-dt*.025);
      if(this.open&&i<=3&&params.dye) this.dye[k]=Math.pow(.5+.5*Math.cos((y+.006*Math.sin(this.time*2))*Math.PI*16),12)*.95;
    }
    this.time+=dt; this.steps++; this.measure(); return dt;
  }
  measure() {
    let energy=0,max=0,n=0;const s=this.stride;
    for(let j=1;j<=this.ny;j++) for(let i=1;i<=this.nx;i++) {const k=this.id(i,j);if(!this.solid[k])continue;
      const u=.5*(this.u[k]+this.u[k+1]),v=.5*(this.v[k]+this.v[k+s]);const speed=u*u+v*v;energy+=.5*speed;max=Math.max(max,Math.sqrt(speed));n++;
      this.curl[k]=(this.v[k+1]+this.v[k+1+s]-this.v[k-1]-this.v[k-1+s]-this.u[k+s]-this.u[k+s+1]+this.u[k-s]+this.u[k-s+1])/(4*this.h);
    }
    this.peakSpeed=max;return {energy:energy/(n||1),max,divergence:this.after,before:this.before,time:this.time};
  }
  obstacle(x: number,y: number,r=.05,erase=false) {
    for(let j=2;j<this.ny;j++) for(let i=3;i<this.nx-1;i++) { const k=this.id(i,j);
      if(Math.hypot((i-.5)*this.h-x,(j-.5)*this.h-y)<r) {this.solid[k]=erase?1:0;this.u[k]=0;this.v[k]=0;this.dye[k]=0;}
    }
  }
  splat(x:number,y:number,dx:number,dy:number,r=.07,dyeOnly=false) {
    for(let j=1;j<=this.ny;j++) for(let i=1;i<=this.nx;i++) {const k=this.id(i,j);if(!this.solid[k])continue;
      const dist=Math.hypot((i-.5)*this.h-x,(j-.5)*this.h-y);if(dist>r*2)continue;const w=Math.exp(-dist*dist/(r*r*.5));
      if(!dyeOnly) {this.u[k]+=clamp(dx,-1.5,1.5)*w;this.v[k]+=clamp(dy,-1.5,1.5)*w;}
      this.dye[k]=Math.min(1,this.dye[k]+w*.8);
    }
  }
  vortex(x:number,y:number,direction=1) {
    // Compact streamfunction gives a divergence-free seed via a discrete curl.
    const psi=(px:number,py:number)=>direction*.026*Math.exp(-((px-x)**2+(py-y)**2)/.018);
    for(let j=1;j<=this.ny;j++)for(let i=1;i<=this.nx;i++){const k=this.id(i,j),h=this.h;
      if(!this.solid[k])continue;
      this.u[k]+=(psi((i-1)*h,j*h)-psi((i-1)*h,(j-1)*h))/h;
      this.v[k]-=(psi(i*h,(j-1)*h)-psi((i-1)*h,(j-1)*h))/h;
      if(Math.hypot((i-.5)*h-x,(j-.5)*h-y)<.16)this.dye[k]=.85;
    }
  }
  probe(x:number,y:number) {const vel=this.velocity(x,y);return {u:vel[0],v:vel[1],speed:Math.hypot(...vel),p:this.sample(this.p,x,y),curl:this.sample(this.curl,x,y),dye:this.sample(this.dye,x,y)};}
}
