import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRun } from '@/lib/storage';
import RunView from '@/components/RunView';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: { id: string } }) {
  const run = await getRun(params.id);
  if (!run) notFound();
  return (
    <main className="run">
      <div className="run-head">
        <Link href="/" className="back">← all runs</Link>
        <h1>{run.title}</h1>
        <span className="rid">{run.id}</span>
      </div>
      <RunView initialRun={run} />
    </main>
  );
}
