'use client';

interface Props {
  text: string;
  streaming?: boolean;
  big?: boolean;
}

export default function TerminalView({ text, streaming, big }: Props) {
  const lines = text.split('\n');
  return (
    <div className="term" style={big ? { fontSize: 14, lineHeight: 1.75, minHeight: 420 } : undefined}>
      {lines.map((l, i) => {
        const prompt = l.startsWith('$ ');
        const isLast = i === lines.length - 1;
        return (
          <div key={i}>
            {prompt && <span className="p">$</span>}
            {prompt ? l.slice(1) : l}
            {streaming && isLast ? <span style={{ display: 'inline-block', width: 7, height: 12, background: 'var(--xo)', verticalAlign: -1, marginLeft: 2, animation: 'pulse 1s infinite' }} /> : null}
          </div>
        );
      })}
    </div>
  );
}
