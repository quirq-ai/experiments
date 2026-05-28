'use client';

import { useEffect, useState } from 'react';
import type { Form } from '@/lib/types';
import TerminalView from './preview/TerminalView';
import MarkdownView from './preview/MarkdownView';
import DeckView from './preview/DeckView';
import NotebookView from './preview/NotebookView';
import AppView from './preview/AppView';

interface Props {
  form: Form;
  /** when set, fetch from this URL */
  src?: string;
  /** when set, render this text directly (streaming mode) */
  liveText?: string;
  /** true for streaming preview (visual cues like caret blink) */
  streaming?: boolean;
  /** bigger typography for movie mode */
  big?: boolean;
}

export default function PreviewRenderer({ form, src, liveText, streaming, big }: Props) {
  const [text, setText] = useState<string>(liveText ?? '');
  useEffect(() => {
    if (liveText !== undefined) {
      setText(liveText);
      return;
    }
    if (!src) return;
    let alive = true;
    fetch(src, { cache: 'no-store' })
      .then((r) => r.text())
      .then((t) => { if (alive) setText(t); });
    return () => { alive = false; };
  }, [src, liveText]);

  switch (form) {
    case 'terminal': return <TerminalView text={text} streaming={!!streaming} big={!!big} />;
    case 'md':       return <MarkdownView text={text} streaming={!!streaming} big={!!big} />;
    case 'deck':     return <DeckView html={text} streaming={!!streaming} />;
    case 'notebook': return <NotebookView text={text} streaming={!!streaming} />;
    case 'nextjs':   return <AppView html={text} streaming={!!streaming} />;
  }
}
