import Link from 'next/link';
import { listRuns } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const runs = await listRuns();
  return (
    <main className="home">
      <header>
        <h1>Artifact Evolution</h1>
        <p>One idea, five forms, one rail. Click a run to scrub through its history.</p>
      </header>
      {runs.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No runs yet. Seed one in <code>runs/</code>.</p>
      ) : (
        <ul className="runs">
          {runs.map((r) => (
            <li key={r.id}>
              <Link href={`/runs/${r.id}`}>
                <span className="rid">{r.id}</span>
                <span className="title">{r.title}</span>
                <span className="meta">{r.artifacts.length} artifacts</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
