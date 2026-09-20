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

export type PosterThemeId =
  | 'football'
  | 'cricket'
  | 'basketball'
  | 'volleyball'
  | 'chess'
  | 'sports'
  | 'workshop'
  | 'talk'
  | 'orientation'
  | 'cultural'
  | 'industrial'
  | 'chem'
  | 'quiz'
  | 'environment'
  | 'general';

export type PosterTheme = {
  id: PosterThemeId
  keys: RegExp
  urls: string[]
  photoQuery: string
  cta: string
  rules: string
  tagline: string
  venueDefault: string
  registerPath?: string
  organizer: string
  subDefault?: string
}

const CHAPTER = 'IIChE AVVU Student Chapter';
const CAMPUS = 'Amrita Vishwa Vidyapeetham';

const THEMES: PosterTheme[] = [
  {
    id: 'football',
    keys: /kick\s*off|kickoff|football|soccer|futsal/,
    urls: [
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=720&h=900&q=60',
      'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=720&h=900&q=60',
      'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=720&h=900&q=60',
      'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=720&h=900&q=60',
    ],
    photoQuery: 'football soccer match stadium ball',
    cta: 'REGISTER YOUR TEAM',
    rules: 'Teams of 7–11 players  ·  Open to all students',
    tagline: 'PLAY · COMPETE · CELEBRATE',
    venueDefault: `${CAMPUS} Grounds`,
    registerPath: '/kickoff/register',
    organizer: 'Social and Environmental Committee',
    subDefault: 'FOOTBALL TOURNAMENT',
  },
  {
    id: 'cricket',
    keys: /cricket|t20|gully cricket/,
    urls: [
      'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=720&h=900&q=60',
      'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?auto=format&fit=crop&w=720&h=900&q=60',
    ],
    photoQuery: 'cricket match bat ball stadium',
    cta: 'REGISTER YOUR TEAM',
    rules: 'Team event  ·  Open to all students',
    tagline: 'PLAY · COMPETE · CELEBRATE',
    venueDefault: `${CAMPUS} Grounds`,
    organizer: CHAPTER,
    subDefault: 'CRICKET TOURNAMENT',
  },
  {
    id: 'basketball',
    keys: /basketball|hoops/,
    urls: ['https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=720&h=900&q=60'],
    photoQuery: 'basketball court game',
    cta: 'REGISTER YOUR TEAM',
    rules: 'Team event  ·  Open to all students',
    tagline: 'PLAY · COMPETE · CELEBRATE',
    venueDefault: `${CAMPUS} Courts`,
    organizer: CHAPTER,
    subDefault: 'BASKETBALL TOURNAMENT',
  },
  {
    id: 'volleyball',
    keys: /volleyball/,
    urls: ['https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=720&h=900&q=60'],
    photoQuery: 'volleyball match indoor',
    cta: 'REGISTER YOUR TEAM',
    rules: 'Team event  ·  Open to all students',
    tagline: 'PLAY · COMPETE · CELEBRATE',
    venueDefault: `${CAMPUS} Courts`,
    organizer: CHAPTER,
    subDefault: 'VOLLEYBALL TOURNAMENT',
  },
  {
    id: 'chess',
    keys: /chess/,
    urls: ['https://images.unsplash.com/photo-1529699211952-734e80c4d42b?auto=format&fit=crop&w=720&h=900&q=60'],
    photoQuery: 'chess board tournament pieces',
    cta: 'REGISTER TO PLAY',
    rules: 'Individual event  ·  Open to all students',
    tagline: 'THINK · STRIKE · WIN',
    venueDefault: CAMPUS,
    organizer: CHAPTER,
    subDefault: 'CHESS TOURNAMENT',
  },
  {
    id: 'sports',
    keys: /tournament|sports|athletics|badminton|table tennis|\btt\b|marathon|yoga/,
    urls: ['https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=720&h=900&q=60'],
    photoQuery: 'campus sports tournament athletes',
    cta: 'REGISTER TO COMPETE',
    rules: 'Open to all students',
    tagline: 'PLAY · COMPETE · CELEBRATE',
    venueDefault: `${CAMPUS} Grounds`,
    organizer: CHAPTER,
  },
  {
    id: 'workshop',
    keys: /workshop|hack|hackathon|skill|hands.?on|coding|python|matlab/,
    urls: [
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=720&h=900&q=60',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=720&h=900&q=60',
    ],
    photoQuery: 'students coding workshop laptop classroom',
    cta: 'REGISTER NOW',
    rules: 'Hands-on session  ·  Open to all students',
    tagline: 'LEARN · BUILD · GROW',
    venueDefault: CAMPUS,
    organizer: CHAPTER,
  },
  {
    id: 'talk',
    keys: /guest|talk|seminar|lecture|speaker|webinar|symposium/,
    urls: ['https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=720&h=900&q=60'],
    photoQuery: 'conference speaker lecture hall audience',
    cta: 'JOIN US',
    rules: 'Open to students and faculty',
    tagline: 'LISTEN · LEARN · CONNECT',
    venueDefault: `${CAMPUS} Seminar Hall`,
    organizer: CHAPTER,
  },
  {
    id: 'orientation',
    keys: /orient|fresh|welcome|idp|induction/,
    urls: [
      'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=720&h=900&q=60',
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=720&h=900&q=60',
    ],
    photoQuery: 'university students orientation campus welcome',
    cta: 'ALL STUDENTS WELCOME',
    rules: 'Open to all chapter members',
    tagline: 'WELCOME · BELONG · BEGIN',
    venueDefault: CAMPUS,
    organizer: CHAPTER,
  },
  {
    id: 'cultural',
    keys: /fest|night|cultural|concert|celeb|dance|music|dj/,
    urls: ['https://images.unsplash.com/photo-1492684223066-81342eea348d?auto=format&fit=crop&w=720&h=900&q=60'],
    photoQuery: 'college fest concert lights crowd',
    cta: 'JOIN THE CELEBRATION',
    rules: 'Open to all students',
    tagline: 'COME · CELEBRATE · CONNECT',
    venueDefault: CAMPUS,
    organizer: CHAPTER,
  },
  {
    id: 'industrial',
    keys: /industrial|plant|visit|refiner|factory/,
    urls: ['https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=720&h=900&q=60'],
    photoQuery: 'chemical plant industry refinery',
    cta: 'REGISTER TO ATTEND',
    rules: 'Limited seats  ·  Chapter members',
    tagline: 'SEE · LEARN · APPLY',
    venueDefault: 'Industry site TBA',
    organizer: CHAPTER,
  },
  {
    id: 'chem',
    keys: /chem|lab|flask|react|process|molecule|chem-?e/,
    urls: [
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=720&h=900&q=60',
      'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=720&h=900&q=60',
    ],
    photoQuery: 'chemistry laboratory flask experiment',
    cta: 'JOIN US',
    rules: 'Open to all students',
    tagline: 'IGNITE · INNOVATE · INSPIRE',
    venueDefault: CAMPUS,
    organizer: CHAPTER,
  },
  {
    id: 'quiz',
    keys: /quiz|trivia|debate/,
    urls: ['https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?auto=format&fit=crop&w=720&h=900&q=60'],
    photoQuery: 'quiz competition students classroom',
    cta: 'REGISTER TO COMPETE',
    rules: 'Teams welcome  ·  Open to all students',
    tagline: 'THINK · ANSWER · WIN',
    venueDefault: CAMPUS,
    organizer: CHAPTER,
  },
  {
    id: 'environment',
    keys: /tree|plantat|green|environ|clean.?up|sustain|earth/,
    urls: ['https://images.unsplash.com/photo-1466692476866-aef584fdc3ed?auto=format&fit=crop&w=720&h=900&q=60'],
    photoQuery: 'tree planting volunteers campus green',
    cta: 'VOLUNTEER WITH US',
    rules: 'Open to all students',
    tagline: 'PLANT · PROTECT · PROSPER',
    venueDefault: CAMPUS,
    organizer: 'Social and Environmental Committee',
  },
];

const GENERAL_THEME: PosterTheme = {
  id: 'general',
  keys: /./,
  urls: [
    'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=720&h=900&q=60',
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=720&h=900&q=60',
  ],
  photoQuery: 'university student event campus',
  cta: 'JOIN US',
  rules: 'Open to all students',
  tagline: 'IGNITE · INNOVATE · INSPIRE',
  venueDefault: CAMPUS,
  organizer: CHAPTER,
};

export function resolvePosterTheme(text: string): PosterTheme {
  const t = String(text || '').toLowerCase();
  return THEMES.find((s) => s.keys.test(t)) || GENERAL_THEME;
}

export function isFootballPosterTheme(text: string): boolean {
  return resolvePosterTheme(text).id === 'football';
}

export function pickPosterHeroUrl(title: string): string {
  const theme = resolvePosterTheme(title);
  const urls = theme.urls.length ? theme.urls : GENERAL_THEME.urls;
  const idx = Math.abs(Array.from(String(title || '')).reduce((n, ch) => n + ch.charCodeAt(0), 0)) % urls.length;
  return urls[idx];
}

export function splitPosterHeadline(title: string, theme: PosterTheme): { hero: string; sub: string } {
  const cleaned = String(title || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (theme.id === 'football') {
    return { hero: /kick/i.test(cleaned) ? 'KICKOFF' : wrapLines(cleaned, 12)[0]?.toUpperCase() || 'KICKOFF', sub: theme.subDefault || 'FOOTBALL TOURNAMENT' };
  }
  const kind = cleaned.match(/\b(workshop|hackathon|seminar|lecture|tournament|fest|orientation|quiz|symposium|competition|championship|webinar|visit|celebration|concert|meetup)\b/i);
  if (kind) {
    const before = cleaned.slice(0, cleaned.toLowerCase().indexOf(kind[1].toLowerCase())).trim();
    const after = cleaned.slice(cleaned.toLowerCase().indexOf(kind[1].toLowerCase()) + kind[1].length).trim();
    const hero = (before || kind[1]).toUpperCase();
    const sub = [kind[1], after].filter(Boolean).join(' ').toUpperCase();
    return { hero: hero.slice(0, 28), sub: sub.slice(0, 42) };
  }
  if (theme.subDefault && cleaned.toLowerCase().includes(theme.id)) {
    return { hero: wrapLines(cleaned.replace(new RegExp(theme.id, 'ig'), '').trim() || cleaned, 14)[0].toUpperCase(), sub: theme.subDefault };
  }
  const lines = wrapLines(cleaned || 'IIChE Event', 14);
  return { hero: lines[0].toUpperCase(), sub: lines.slice(1).join(' ').toUpperCase() };
}

export type IichePosterInput = {
  title: string;
  dateLabel: string;
  location: string;
  tagline: string;
  heroDataUrl?: string;
  variant?: 'football' | 'default' | PosterThemeId;
  registerLine?: string;
  rules?: string;
  cta?: string;
  organizer?: string;
  photoQuery?: string;
  query?: string;
};

function themedFallback(theme: PosterTheme): string {
  if (theme.id === 'football' || theme.id === 'sports' || theme.id === 'cricket') {
    return `
  <rect width="1080" height="1350" fill="#14532d"/>
  <rect y="160" width="1080" height="1030" fill="#166534"/>
  <g fill="none" stroke="#bbf7d0" stroke-width="4" opacity="0.4">
    <rect x="70" y="200" width="940" height="940"/>
    <line x1="540" y1="200" x2="540" y2="1140"/>
    <circle cx="540" cy="670" r="130"/>
  </g>`;
  }
  if (theme.id === 'chem') {
    return `<rect width="1080" height="1350" fill="#0b1220"/><circle cx="780" cy="980" r="160" fill="#155e75" opacity="0.45"/><circle cx="840" cy="920" r="90" fill="#67e8f9" opacity="0.25"/>`;
  }
  if (theme.id === 'cultural') {
    return `<rect width="1080" height="1350" fill="#3b0764"/><circle cx="200" cy="400" r="220" fill="#db2777" opacity="0.35"/><circle cx="900" cy="1100" r="260" fill="#f59e0b" opacity="0.25"/>`;
  }
  if (theme.id === 'workshop') {
    return `<rect width="1080" height="1350" fill="#111827"/><rect x="80" y="320" width="920" height="620" rx="16" fill="#1f2937"/><rect x="140" y="380" width="800" height="40" rx="8" fill="#22d3ee" opacity="0.4"/>`;
  }
  return `<rect width="1080" height="1350" fill="#0b1220"/><rect y="900" width="1080" height="450" fill="#111827"/>`;
}

function frameAndBrand(): string {
  return `
  <rect x="42" y="42" width="996" height="1266" fill="none" stroke="url(#gold)" stroke-width="5" rx="10"/>
  <rect x="62" y="62" width="956" height="1226" fill="none" stroke="#fde68a" stroke-width="1" opacity="0.45" rx="6"/>
  <text x="540" y="118" text-anchor="middle" fill="#fde68a" font-family="sans-serif" font-size="16" letter-spacing="7">INDIAN INSTITUTE OF CHEMICAL ENGINEERS</text>
  <text x="540" y="164" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="30" letter-spacing="2">IIChE AVVU STUDENT CHAPTER</text>
  <text x="540" y="200" text-anchor="middle" fill="#99f6e4" font-family="sans-serif" font-size="15" letter-spacing="4">AMRITA VISHWA VIDYAPEETHAM</text>`;
}

function svgShell(inner: string): string {
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
      <stop offset="35%" stop-color="#020617" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0.96"/>
    </linearGradient>
  </defs>
  ${inner}
</svg>`;
}

function heroSize(text: string): number {
  if (text.length > 18) return 48;
  if (text.length > 12) return 64;
  if (text.length > 8) return 78;
  return 92;
}

function buildEventPosterSvg(input: IichePosterInput, theme: PosterTheme): string {
  const loc = input.location || theme.venueDefault;
  const dateLabel = input.dateLabel || 'Date TBA';
  const register = input.registerLine || '';
  const rules = input.rules || theme.rules;
  const tagline = input.tagline || theme.tagline;
  const cta = input.cta || theme.cta;
  const organizer = input.organizer || theme.organizer;
  const { hero, sub } = splitPosterHeadline(input.title || 'IIChE Event', theme);
  const photo = input.heroDataUrl
    ? `<image href="${escapeXml(input.heroDataUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/>`
    : themedFallback(theme);
  const heroLines = wrapLines(hero, 14);
  const heroFs = heroSize(heroLines.reduce((a, b) => (a.length > b.length ? a : b), ''));
  const heroStart = heroLines.length > 1 ? 390 : 430;
  const heroTs = heroLines
    .map(
      (line, i) =>
        `<text x="540" y="${heroStart + i * (heroFs + 6)}" text-anchor="middle" fill="#fffbeb" font-family="Georgia, 'Times New Roman', serif" font-size="${heroFs}" font-weight="700">${escapeXml(line)}</text>`,
    )
    .join('');
  const subY = heroStart + heroLines.length * (heroFs + 6) + 8;

  return svgShell(`
  ${photo}
  <rect width="1080" height="280" fill="url(#topShade)"/>
  <rect y="560" width="1080" height="790" fill="url(#bottomShade)"/>
  ${frameAndBrand()}
  <text x="540" y="250" text-anchor="middle" fill="#99f6e4" font-family="sans-serif" font-size="18" letter-spacing="10">PRESENTS</text>
  ${heroTs}
  ${sub ? `<text x="540" y="${Math.min(subY, 560)}" text-anchor="middle" fill="#fbbf24" font-family="sans-serif" font-size="28" letter-spacing="5">${escapeXml(sub)}</text>` : ''}
  <line x1="280" y1="580" x2="800" y2="580" stroke="url(#gold)" stroke-width="2"/>
  <rect x="150" y="780" width="780" height="70" rx="35" fill="rgba(2,6,23,0.7)" stroke="#fbbf24" stroke-width="1"/>
  <text x="540" y="825" text-anchor="middle" fill="#fffbeb" font-family="sans-serif" font-size="26">${escapeXml(dateLabel)}</text>
  <text x="540" y="900" text-anchor="middle" fill="#e2e8f0" font-family="sans-serif" font-size="24">${escapeXml(loc)}</text>
  <text x="540" y="960" text-anchor="middle" fill="#99f6e4" font-family="sans-serif" font-size="20">${escapeXml(rules)}</text>
  <rect x="180" y="1000" width="720" height="64" rx="12" fill="#fbbf24"/>
  <text x="540" y="1042" text-anchor="middle" fill="#111827" font-family="sans-serif" font-size="22" font-weight="700">${escapeXml(cta)}</text>
  ${register ? `<text x="540" y="1100" text-anchor="middle" fill="#fde68a" font-family="sans-serif" font-size="18">${escapeXml(register)}</text>` : ''}
  <text x="540" y="1160" text-anchor="middle" fill="#cbd5e1" font-family="sans-serif" font-size="16">Organized by ${escapeXml(organizer)}</text>
  <text x="540" y="1248" text-anchor="middle" fill="#fbbf24" font-family="sans-serif" font-size="18" letter-spacing="6">${escapeXml(tagline)}</text>
  `);
}

export function buildIichePosterSvg(input: IichePosterInput): string {
  const theme = resolvePosterTheme(`${input.query || ''} ${input.title || ''} ${input.variant || ''}`);
  return buildEventPosterSvg(input, theme);
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

async function fetchHeroDataUrl(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'image/*',
        'User-Agent': 'IIChE-AVVU-Portal/1.0 (chapter event posters)',
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

export async function composeIichePoster(input: IichePosterInput): Promise<string> {
  const theme = resolvePosterTheme(`${input.query || ''} ${input.title || ''} ${input.variant || ''}`);
  const generated = await generateGeminiPosterImage(input, theme);
  if (generated) return generated;
  const hero = await Promise.race([
    fetchHeroDataUrl(theme.urls[0] || ''),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1300)),
  ]);
  return svgDataUrl(buildEventPosterSvg({ ...input, heroDataUrl: hero || undefined }, theme));
}

function env(name: string): string {
  return String(process.env[name] || '').trim();
}

function posterImagePrompt(input: IichePosterInput, theme: PosterTheme): string {
  const loc = input.location || theme.venueDefault;
  const dateLabel = input.dateLabel || 'Date TBA';
  const rules = input.rules || theme.rules;
  const cta = input.cta || theme.cta;
  const organizer = input.organizer || theme.organizer;
  const tagline = input.tagline || theme.tagline;
  const register = input.registerLine || '';
  return `Create a unique finished vertical event poster photograph+typography composite, portrait 3:4.

This poster is ONLY for this event. Do not use a generic gold certificate frame or the same layout as other campus posters. Composition, photography, color, and type must match a ${theme.id} event.

Brand (small, top): Indian Institute of Chemical Engineers — IIChE AVVU Student Chapter — Amrita Vishwa Vidyapeetham.

Paint this copy on the poster, large and readable:
Title: ${input.title}
Date: ${dateLabel}
Venue: ${loc}
Details: ${rules}
Button text: ${cta}
${register ? `Register URL: ${register}` : ''}
Organized by ${organizer}
Tagline: ${tagline}

Visual: ${theme.photoQuery}. Cinematic, high-contrast, original scene (not a repeated template). No watermarks, no extra crests.`;
}

function extractGeminiImage(data: unknown): string | null {
  const parts =
    (data as { candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string }; inline_data?: { mimeType?: string; data?: string } }[] } }[] })
      ?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    const mime = String(inline?.mimeType || 'image/png');
    const b64 = String(inline?.data || '');
    if (b64 && mime.startsWith('image/')) return `data:${mime};base64,${b64}`;
  }
  const imagen = (data as { predictions?: { bytesBase64Encoded?: string; mimeType?: string }[] })?.predictions?.[0];
  if (imagen?.bytesBase64Encoded) {
    return `data:${imagen.mimeType || 'image/png'};base64,${imagen.bytesBase64Encoded}`;
  }
  return null;
}

async function generateGeminiPosterImage(input: IichePosterInput, theme: PosterTheme): Promise<string | null> {
  const key = env('GEMINI_API_KEY') || env('GOOGLE_GENERATIVE_AI_API_KEY');
  if (!key) return null;
  const preferred = env('GEMINI_IMAGE_MODEL');
  const models = [...new Set([preferred, 'gemini-2.5-flash-image', 'gemini-2.0-flash-preview-image-generation'].filter(Boolean))].slice(
    0,
    2,
  );
  const prompt = posterImagePrompt(input, theme);
  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
              imageConfig: { aspectRatio: '3:4' },
            },
          }),
        },
      );
      if (!res.ok) {
        if (res.status === 400) {
          const retry = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
            {
              method: 'POST',
              signal: controller.signal,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseModalities: ['IMAGE'] },
              }),
            },
          );
          if (retry.ok) {
            const image = extractGeminiImage(await retry.json());
            if (image) return image;
          }
        }
        continue;
      }
      const image = extractGeminiImage(await res.json());
      if (image) return image;
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') break;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
