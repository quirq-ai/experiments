const researchAnchors=new Set(['#gpt-breakthrough','#the-result','#the-model','#the-mechanism','#the-evidence']);

export function sectionFromLocation(pathname:string,hash:string){
 return pathname.replace(/\/$/,'')==='/gpt-breakthrough'||researchAnchors.has(hash)?'breakthrough':'playground';
}

export function sectionHref(section:string,protocol:string){
 if(protocol==='file:')return section==='breakthrough'?'#gpt-breakthrough':'#playground';
 return section==='breakthrough'?'/gpt-breakthrough':'/';
}

/** Normalized asymptotic core scales from OpenAI's paper §2.1; not a PDE solution. */
export function coreScales(progress:number){
 const h=.005,tau=10**(-progress);
 return {tau,radius:tau**.5,speed:tau**(-.5-h),energy:tau**(.5-3*h)};
}
