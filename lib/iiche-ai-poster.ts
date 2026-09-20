function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrapLines(text: string, max = 16): string[] {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 5);
}

const HERO_SCENES: { keys: RegExp; urls: string[] }[] = [
  {
    keys: /orient|fresh|welcome|idp|induction|student/,
    urls: [
      'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1080&h=1350&q=80',
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1080&h=1350&q=80',
    ],
  },
  {
    keys: /chem|lab|flask|react|process|molecule/,
    urls: [
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1080&h=1350&q=80',
      'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=1080&h=1350&q=80',
    ],
  },
  {
    keys: /workshop|hack|skill|hands/,
    urls: ['https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1080&h=1350&q=80'],
  },
  {
    keys: /guest|talk|seminar|lecture|speaker/,
    urls: ['https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1080&h=1350&q=80'],
  },
  {
    keys: /fest|night|cultural|concert|celeb/,
    urls: ['https://images.unsplash.com/photo-1492684223066-81342eea348d?auto=format&fit=crop&w=1080&h=1350&q=80'],
  },
  {
    keys: /industrial|plant|visit|refiner/,
    urls: ['https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=1080&h=1350&q=80'],
  },
];

const DEFAULT_HEROES = [
  'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1080&h=1350&q=80',
  'https://images.unsplash.com/photo-1507413245160-04665d2e0d4d?auto=format&fit=crop&w=1080&h=1350&q=80',
];

export function pickPosterHeroUrl(title: string): string {
  const t = String(title || '').toLowerCase();
  const scene = HERO_SCENES.find((s) => s.keys.test(t));
  const urls = scene?.urls?.length ? scene.urls : DEFAULT_HEROES;
  const idx = Math.abs(Array.from(t).reduce((n, ch) => n + ch.charCodeAt(0), 0)) % urls.length;
  return urls[idx];
}

export function buildIichePosterSvg(input: {
  title: string;
  dateLabel: string;
  location: string;
  tagline: string;
  heroDataUrl?: string;
}): string {
  const titleLines = wrapLines(input.title || 'IIChE Event', 14);
  const locLines = wrapLines(input.location || 'Venue TBA', 28);
  const titleSize = titleLines.some((l) => l.length > 12) || titleLines.length > 3 ? 54 : 72;
  const titleStart = 760 - ((titleLines.length - 1) * (titleSize + 8)) / 2;
  const titleTs = titleLines
    .map(
      (line, i) =>
        `<text x="540" y="${titleStart + i * (titleSize + 8)}" text-anchor="middle" fill="#fff7ed" font-family="Georgia, 'Times New Roman', serif" font-size="${titleSize}" font-weight="700">${escapeXml(line)}</text>`,
    )
    .join('');
  const locTs = locLines
    .map(
      (line, i) =>
        `<text x="540" y="${1048 + i * 28}" text-anchor="middle" fill="#e2e8f0" font-family="sans-serif" font-size="22">${escapeXml(line)}</text>`,
    )
    .join('');
  const hero = input.heroDataUrl
    ? `<image href="${escapeXml(input.heroDataUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect width="1080" height="1350" fill="#0b1220"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#b45309"/>
      <stop offset="50%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#fde68a"/>
    </linearGradient>
    <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020617" stop-opacity="0.82"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bottomShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020617" stop-opacity="0"/>
      <stop offset="38%" stop-color="#020617" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0.94"/>
    </linearGradient>
  </defs>
  ${hero}
  <rect width="1080" height="420" fill="url(#topShade)"/>
  <rect y="620" width="1080" height="730" fill="url(#bottomShade)"/>
  <rect x="42" y="42" width="996" height="1266" fill="none" stroke="url(#gold)" stroke-width="5" rx="10"/>
  <rect x="62" y="62" width="956" height="1226" fill="none" stroke="#fde68a" stroke-width="1" opacity="0.45" rx="6"/>
  <text x="540" y="128" text-anchor="middle" fill="#fde68a" font-family="sans-serif" font-size="18" letter-spacing="8">INDIAN INSTITUTE OF CHEMICAL ENGINEERS</text>
  <text x="540" y="176" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="32" letter-spacing="2">IIChE AVVU STUDENT CHAPTER</text>
  <text x="540" y="214" text-anchor="middle" fill="#99f6e4" font-family="sans-serif" font-size="15" letter-spacing="4">AMRITA VISHWA VIDYAPEETHAM</text>
  ${titleTs}
  <line x1="360" y1="920" x2="720" y2="920" stroke="url(#gold)" stroke-width="2"/>
  <rect x="230" y="952" width="620" height="56" rx="28" fill="rgba(2,6,23,0.62)" stroke="#fbbf24" stroke-width="1"/>
  <text x="540" y="988" text-anchor="middle" fill="#fffbeb" font-family="sans-serif" font-size="24">${escapeXml(input.dateLabel)}</text>
  ${locTs}
  <text x="540" y="1248" text-anchor="middle" fill="#fbbf24" font-family="sans-serif" font-size="18" letter-spacing="6">${escapeXml(input.tagline)}</text>
</svg>`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

async function fetchHeroDataUrl(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'image/*',
        'User-Agent': 'IIChE-AVVU-Portal/1.0',
      },
    });
    if (!res.ok) return null;
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!mime.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 800) return null;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function composeIichePoster(input: {
  title: string;
  dateLabel: string;
  location: string;
  tagline: string;
}): Promise<string> {
  const t = String(input.title || '').toLowerCase();
  const scene = HERO_SCENES.find((s) => s.keys.test(t));
  const urls = [...(scene?.urls || []), ...DEFAULT_HEROES];
  let hero: string | null = null;
  for (const url of urls) {
    hero = await fetchHeroDataUrl(url);
    if (hero) break;
  }
  return svgDataUrl(buildIichePosterSvg({ ...input, heroDataUrl: hero || undefined }));
}
