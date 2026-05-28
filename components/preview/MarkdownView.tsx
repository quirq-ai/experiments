'use client';

interface Props {
  text: string;
  streaming?: boolean;
  big?: boolean;
}

export default function MarkdownView({ text, streaming, big }: Props) {
  const html = renderMd(text);
  const style: React.CSSProperties | undefined = big
    ? { fontSize: 16, lineHeight: 1.7 }
    : undefined;
  return (
    <div
      className="md-doc"
      style={style}
      dangerouslySetInnerHTML={{
        __html: streaming ? html + '<span style="display:inline-block;width:8px;height:14px;background:var(--xo);vertical-align:-2px;margin-left:3px;animation:pulse 1s infinite"></span>' : html,
      }}
    />
  );
}

function renderMd(src: string): string {
  const esc = (s: string) =>
    s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as Record<string, string>)[c]!);
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

  const out: string[] = [];
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      const lang = l.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre data-lang="${esc(lang)}"><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    let m;
    if ((m = /^(#{1,3})\s+(.*)/.exec(l))) {
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      i++; continue;
    }
    if (/^>\s?/.test(l)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }
    if (/^(\-|\*)\s+/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^(\-|\*)\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^(\-|\*)\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (l.trim() === '') { i++; continue; }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#|>|```|\-\s|\*\s)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}
