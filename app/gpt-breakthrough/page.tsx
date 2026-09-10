import type {Metadata} from 'next';
import Home from '../page';

export const metadata:Metadata={
 title:'GPT and the Navier–Stokes breakthrough | Flow Lab',
 description:'A sourced explanation of OpenAI’s September 2026 Navier–Stokes announcement: the internal model, GPT-6 Astra, the proof strategy, and what remains to verify.',
};

export default function ResearchRoute(){return <Home initialSection="breakthrough"/>;}
