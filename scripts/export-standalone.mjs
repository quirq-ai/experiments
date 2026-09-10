import { build } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const work=path.join(root,'work','standalone');
await fs.mkdir(work,{recursive:true});
await fs.writeFile(path.join(work,'entry.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import Home from '../../app/page';createRoot(document.getElementById('root')!).render(<Home/>);`);
const result=await build({configFile:false,root,resolve:{alias:{'@':root}},define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:true,lib:{entry:path.join(work,'entry.tsx'),name:'FlowLab',formats:['iife']},rollupOptions:{output:{inlineDynamicImports:true}}},oxc:{jsx:{runtime:'automatic'}}});
const bundle=Array.isArray(result)?result[0]:result;
const code=bundle.output.filter(x=>x.type==='chunk').map(x=>x.code).join('\n');
const assets=path.join(root,'dist','client','_next','static','css');
const css=(await Promise.all((await fs.readdir(assets)).filter(n=>n.endsWith('.css')).map(n=>fs.readFile(path.join(assets,n),'utf8')))).join('\n');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="An interactive Navier–Stokes fluid simulation"><title>Flow Lab — Navier–Stokes</title><style>${css.replaceAll('</style','<\\/style')} :root{--font-geist-sans:Arial,Helvetica,sans-serif;--font-geist-mono:'Courier New',monospace}</style></head><body><div id="root"></div><script>${code.replaceAll('</script','<\\/script')}</script></body></html>`;
const dest=path.resolve(process.argv[2]??path.join(root,'standalone','flow-lab.html'));
await fs.mkdir(path.dirname(dest),{recursive:true});
await fs.writeFile(dest,html);
console.log(`Saved standalone simulation: ${dest} (${Buffer.byteLength(html)} bytes)`);
