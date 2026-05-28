// Stale: metadata UI now lives inside WorkStage. This shim keeps the file
// import-clean for any older references.
'use client';

import type { Artifact, Run } from '@/lib/types';

interface Props {
  artifact?: Artifact;
  run: Run;
}

export default function Meta({ artifact, run }: Props) {
  if (!artifact) return null;
  return (
    <div className="meta-block">
      <h3>Metadata</h3>
      <dl>
        <dt>id</dt>     <dd className="mono">{artifact.id}</dd>
        <dt>form</dt>   <dd className="mono">{artifact.form}</dd>
        <dt>parent</dt> <dd className="mono">{artifact.parent_id ?? 'null'}</dd>
        <dt>head?</dt>  <dd className="mono">{run.head === artifact.id ? 'yes' : 'no'}</dd>
      </dl>
    </div>
  );
}
