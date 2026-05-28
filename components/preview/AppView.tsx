'use client';

import { useEffect, useState } from 'react';

interface Props {
  html: string;
  streaming?: boolean;
}

export default function AppView({ html, streaming }: Props) {
  const [doc, setDoc] = useState(html);
  useEffect(() => {
    if (!streaming) { setDoc(html); return; }
    const t = setTimeout(() => setDoc(html), 120);
    return () => clearTimeout(t);
  }, [html, streaming]);
  return (
    <div className="iframe-host">
      <iframe srcDoc={doc} title="app preview" sandbox="allow-same-origin" />
    </div>
  );
}
