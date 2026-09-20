export type AiInline =
  | { t: 'text'; v: string }
  | { t: 'b'; v: string }
  | { t: 'i'; v: string }
  | { t: 'a'; v: string; href: string };

export type AiBlock =
  | { t: 'p'; children: AiInline[] }
  | { t: 'h'; children: AiInline[] }
  | { t: 'li'; children: AiInline[]; n?: number }
  | { t: 'table'; headers: string[]; rows: string[][] }
  | { t: 'img'; src: string; alt: string };

function parseInline(raw: string): AiInline[] {
  const out: AiInline[] = [];
  const re =
    /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/dashboard\/[^)\s]+)\)|(https?:\/\/[^\s)]+|\/dashboard\/[^\s)]+))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    if (m.index > last) {
      const chunk = raw.slice(last, m.index);
      if (chunk) out.push({ t: 'text', v: chunk.replace(/\*/g, '') });
    }
    if (m[2] != null) out.push({ t: 'b', v: m[2] });
    else if (m[3] != null) out.push({ t: 'i', v: m[3] });
    else if (m[4] != null) out.push({ t: 'text', v: m[4] });
    else if (m[5] != null && m[6] != null) out.push({ t: 'a', v: m[5], href: m[6] });
    else if (m[7] != null) out.push({ t: 'a', v: m[7], href: m[7] });
    last = m.index + m[0].length;
  }
  if (last < raw.length) {
    const chunk = raw.slice(last).replace(/\*/g, '');
    if (chunk) out.push({ t: 'text', v: chunk });
  }
  return out.length ? out : [{ t: 'text', v: raw.replace(/\*/g, '').trim() || raw }];
}

function splitCells(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function isTableSep(line: string): boolean {
  return /^\|?[\s:|-]+$/.test(line) && /---/.test(line);
}

export function parseIicheAiReply(raw: string): AiBlock[] {
  const lines = String(raw || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: AiBlock[] = [];
  let para: string[] = [];

  const flushPara = () => {
    const text = para.join(' ').trim();
    para = [];
    if (text) blocks.push({ t: 'p', children: parseInline(text) });
  };

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      flushPara();
      continue;
    }
    if (/^[-*]{3,}$/.test(trimmed)) {
      flushPara();
      continue;
    }
    if (trimmed.startsWith('|') && trimmed.includes('|', 1)) {
      flushPara();
      const tableLines = [trimmed];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
        i += 1;
        tableLines.push(lines[i].trim());
      }
      const bodyLines = tableLines.filter((l) => !isTableSep(l));
      if (bodyLines.length) {
        const headers = splitCells(bodyLines[0]);
        const rows = bodyLines.slice(1).map(splitCells);
        blocks.push({ t: 'table', headers, rows });
      }
      continue;
    }
    const image = trimmed.match(
      /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)\)$/,
    );
    if (image) {
      flushPara();
      blocks.push({ t: 'img', src: image[2], alt: image[1] || 'Poster' });
      continue;
    }
    const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flushPara();
      blocks.push({ t: 'h', children: parseInline(heading[1]) });
      continue;
    }
    const numbered = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numbered) {
      flushPara();
      blocks.push({ t: 'li', n: Number(numbered[1]), children: parseInline(numbered[2]) });
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushPara();
      blocks.push({ t: 'li', children: parseInline(bullet[1]) });
      continue;
    }
    para.push(trimmed);
  }
  flushPara();
  return blocks;
}

export function iicheAiReplyPlain(raw: string): string {
  return parseIicheAiReply(raw)
    .map((b) => {
      if (b.t === 'img') return b.alt || b.src;
      if (b.t === 'table') {
        return [b.headers.join(' | '), ...b.rows.map((r) => r.join(' | '))].join('\n');
      }
      return b.children
        .map((c) => c.v)
        .join('')
        .trim();
    })
    .filter(Boolean)
    .join('\n\n');
}
