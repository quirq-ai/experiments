'use client';

import { useEffect, useState } from 'react';

interface Props {
  html: string;
  streaming?: boolean;
}

export default function DeckView({ html, streaming }: Props) {
  // For streaming, throttle srcDoc updates so we don't thrash the iframe.
  const [doc, setDoc] = useState(html);
  useEffect(() => {
    if (!streaming) { setDoc(html); return; }
    const t = setTimeout(() => setDoc(html), 120);
    return () => clearTimeout(t);
  }, [html, streaming]);
  return (
    <div className="iframe-host">
      <iframe srcDoc={doc} title="deck preview" sandbox="allow-same-origin" />
    </div>
  );
}
