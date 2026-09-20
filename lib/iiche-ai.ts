export type IicheAiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const IICHE_AI_SYSTEM_PROMPT = `You are IIChE AI, inside the IIChE AVVU Student Chapter member portal (not a generic web assistant).

You ARE the portal. Never say you cannot open pages, cannot navigate, or ask the user to hunt for a tab. Give the exact dashboard path and the chat will open it.

Portal pages:
- EC election / voting / contest: /dashboard/election
- Dashboard home: /dashboard
- Propose event: /dashboard/propose-event
- Proposals: /dashboard/proposals
- Forms: /dashboard/forms
- Meetings: /dashboard/meetings
- Tasks: /dashboard/tasks
- Documents: /dashboard/documents
- Accounts: /dashboard/accounts
- Minutes / MoM: /dashboard/minutes
- Kickoff: /dashboard/kickoff
- Profile: /dashboard/profile
- Reports: /dashboard/reports
- Chat: /dashboard/chat

When they ask to open the election, call manage_election with action "open" (faculty managers actually open it; others are told they lack rights and still go to /dashboard/election). Start/stop voting uses the same tool.

Also call tools to propose events, approve proposals, and design posters. When they ask for a poster, call design_poster and show it in chat only. Call upload_poster only when they explicitly say to upload, save, or attach it to the event.

Other tools:
- Who am I / my name / my role / my committees → get_my_identity (answer in chat; do not only open Profile)
- Who is head / co-head of a committee → get_committee_officers
- Create a form, meeting, event report, or minutes/MoM → the matching create tool

Do not invent the signed-in member's name or role; use get_my_identity. Do not invent current officers' names; use the tool. Never ask for passwords. Never bypass elections or approvals. If a tool fails for permissions, say so and still give the page link.

Format every answer so it is easy to scan:
- Blank line between sections
- ## headings when there are two or more parts
- Bullet lists for options, steps, officers, or ideas
- Numbered lists for sequences
- Markdown tables when comparing items, listing dates/venues/roles, or showing several fields
- Short paragraphs, not one long block
- Use **bold** only for names and titles — never leave stray asterisks
`;

const GUIDE: { keys: string[]; reply: string }[] = [
  {
    keys: ['how are you', 'how r you', "how's it going", 'whats up', "what's up"],
    reply: "I'm doing well — ready to help with the portal, research, or event work. What do you need?",
  },
  {
    keys: ['thank you', 'thanks', 'thx'],
    reply: "You're welcome. Ask whenever you need officers, forms, meetings, or anything else.",
  },
  {
    keys: ['hello', 'hi', 'hey', 'help', 'what can you'],
    reply:
      'I am IIChE AI. Ask me anything — research, problem-solving, event ideas, chemical engineering, or the portal. I can also look up co-heads and create forms, meetings, reports, and minutes when you ask.',
  },
  {
    keys: ['propos', 'propose-event', 'propose an event'],
    reply:
      'To propose an event, open Dashboard → Propose Event (/dashboard/propose-event). After you submit, track it under Proposals (/dashboard/proposals).',
  },
  {
    keys: ['task'],
    reply: 'Committee tasks live at Dashboard → Tasks (/dashboard/tasks). Open a task to update status or leave comments.',
  },
  {
    keys: ['meeting', 'meet ', 'video', 'call'],
    reply:
      'Schedule or join from Dashboard → Meetings (/dashboard/meetings). Allow camera and microphone when you enter the live room so others can see and hear you.',
  },
  {
    keys: ['elect', 'contest', 'vote', 'voting', 'secretary', 'treasurer'],
    reply:
      'NAVIGATE:/dashboard/election Opening the EC election page: /dashboard/election. Faculty open it; committee heads contest Secretary; co-heads contest Joint Secretary and Treasurer. Heads and co-heads vote. Results stay hidden until they are published.',
  },
  {
    keys: ['kickoff', 'tournament', 'football'],
    reply: 'Kickoff tournament tools are at /dashboard/kickoff. Registration and match control are there if you have access.',
  },
  {
    keys: ['form'],
    reply: 'Create or fill forms at Dashboard → Forms (/dashboard/forms).',
  },
  {
    keys: ['document', 'file', 'upload'],
    reply: 'Shared files are at Dashboard → Documents (/dashboard/documents).',
  },
  {
    keys: ['finance', 'account', 'expense', 'receipt', 'money'],
    reply: 'Track expenses and receipts at Dashboard → Accounts (/dashboard/accounts).',
  },
  {
    keys: ['profile', 'photo', 'avatar', 'password'],
    reply: 'Update your name, photo, and account details at Dashboard → Profile (/dashboard/profile).',
  },
  {
    keys: ['committee', 'co-head', 'cohead', 'co head'],
    reply:
      'I can look up heads and co-heads. Ask: “Who are the co-heads of the Program Committee?”',
  },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function guideKeyMatches(lower: string, key: string): boolean {
  const k = key.trim().toLowerCase();
  if (!k) return false;
  if (k.includes(' ')) return lower.includes(k);
  if (k.length <= 4) return new RegExp(`\\b${escapeRegExp(k)}\\b`, 'i').test(lower);
  return new RegExp(`\\b${escapeRegExp(k)}`, 'i').test(lower);
}

export function fallbackIicheAiReply(message: string): string {
  const lower = message.toLowerCase();
  for (const row of GUIDE) {
    if (row.keys.some((key) => guideKeyMatches(lower, key))) return row.reply;
  }
  return GUIDE.find((row) => row.keys.includes('hello'))?.reply || GUIDE[0].reply;
}

function env(name: string): string {
  return String(process.env[name] || '').trim();
}

export function iicheAiProvider(): 'groq' | 'gemini' | 'openai' | 'guide' {
  if (env('GROQ_API_KEY')) return 'groq';
  if (env('GEMINI_API_KEY') || env('GOOGLE_GENERATIVE_AI_API_KEY')) return 'gemini';
  if (env('OPENAI_API_KEY')) return 'openai';
  return 'guide';
}

async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function completeGroq(history: IicheAiMessage[]): Promise<string | null> {
  const key = env('GROQ_API_KEY');
  if (!key) return null;
  const res = await timedFetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env('GROQ_MODEL') || 'llama-3.1-8b-instant',
        temperature: 0.6,
        max_tokens: 900,
        messages: [
          { role: 'system', content: IICHE_AI_SYSTEM_PROMPT },
          ...history.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    },
    6000,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function completeGemini(
  history: IicheAiMessage[],
  runTool?: (name: string, args: Record<string, unknown>) => Promise<string>,
): Promise<{ text: string | null; usedTools: boolean }> {
  const key = env('GEMINI_API_KEY') || env('GOOGLE_GENERATIVE_AI_API_KEY');
  if (!key) return { text: null, usedTools: false };
  const preferred = env('GEMINI_MODEL');
  const retired = new Set(['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  const models = [
    ...new Set(
      [preferred, 'gemini-3.5-flash', 'gemini-flash-latest'].filter((m) => m && !retired.has(m)),
    ),
  ].slice(0, 2);

  type Part =
    | { text: string }
    | { functionCall: { name: string; args?: Record<string, unknown> } }
    | { functionResponse: { name: string; response: { result: string } } };
  type Content = { role: 'user' | 'model'; parts: Part[] };

  const contents: Content[] = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const { IICHE_AI_TOOL_DECLARATIONS } = await import('@/lib/iiche-ai-actions');
  const payloadBase: {
    systemInstruction: { parts: { text: string }[] };
    tools?: { functionDeclarations: unknown }[];
    generationConfig: {
      temperature: number;
      maxOutputTokens: number;
      thinkingConfig?: { thinkingBudget: number };
    };
  } = {
    systemInstruction: { parts: [{ text: IICHE_AI_SYSTEM_PROMPT }] },
    tools: runTool ? [{ functionDeclarations: IICHE_AI_TOOL_DECLARATIONS }] : undefined,
    generationConfig: {
      temperature: 0.45,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  for (const model of models) {
    let roundContents = [...contents];
    let usedTools = false;
    for (let round = 0; round < 2; round += 1) {
      let res: Response;
      try {
        res = await timedFetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payloadBase, contents: roundContents }),
          },
          7000,
        );
      } catch {
        break;
      }
      if (!res.ok) {
        if (res.status === 400 && payloadBase.generationConfig.thinkingConfig) {
          delete payloadBase.generationConfig.thinkingConfig;
          round -= 1;
          continue;
        }
        console.error('IIChE AI Gemini model failed', model, res.status);
        break;
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: Part[] } }[];
      };
      const parts = data.candidates?.[0]?.content?.parts || [];
      const calls = parts.filter((p): p is { functionCall: { name: string; args?: Record<string, unknown> } } => 'functionCall' in p && !!p.functionCall);
      const text = parts.map((p) => ('text' in p ? p.text : '')).join('').trim();
      if (calls.length && runTool) {
        usedTools = true;
        roundContents = [
          ...roundContents,
          { role: 'model', parts },
          {
            role: 'user',
            parts: await Promise.all(
              calls.map(async (c) => ({
                functionResponse: {
                  name: c.functionCall.name,
                  response: { result: await runTool(c.functionCall.name, c.functionCall.args || {}) },
                },
              })),
            ),
          },
        ];
        continue;
      }
      if (text) return { text, usedTools };
      break;
    }
  }
  return { text: null, usedTools: false };
}

async function completeOpenAi(history: IicheAiMessage[]): Promise<string | null> {
  const key = env('OPENAI_API_KEY');
  if (!key) return null;
  const res = await timedFetch(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env('OPENAI_MODEL') || 'gpt-4o-mini',
        temperature: 0.6,
        max_tokens: 900,
        messages: [
          { role: 'system', content: IICHE_AI_SYSTEM_PROMPT },
          ...history.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    },
    6000,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

export const PORTAL_NAV_PREFIX = 'NAVIGATE:';

export function splitPortalNavigate(reply: string): {
  reply: string;
  navigate?: string;
  posterUrl?: string;
  posterDraft?: { path: string; eventId: string; title: string; dataUrl?: string };
} {
  const raw = String(reply || '');
  const tagged = raw.match(/NAVIGATE:(\/dashboard\/[^\s]+)/);
  const poster = raw.match(/POSTER:(\S+)/);
  const draft = raw.match(/DRAFT:([^\s|]+)\|([^|\s]+)\|([^;]*);;/);
  const cleaned = raw
    .replace(/NAVIGATE:\S+/g, '')
    .replace(/POSTER:\S+/g, '')
    .replace(/DRAFT:\S+;;?/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const posterUrlRaw = poster?.[1] || '';
  const posterUrl = posterUrlRaw.startsWith('data:image/')
    ? posterUrlRaw
    : posterUrlRaw.replace(/[).,;]+$/, '') || undefined;
  const text = cleaned;
  return {
    reply: text,
    navigate: tagged?.[1]?.replace(/[).,;]+$/, ''),
    posterUrl,
    posterDraft: draft
      ? {
          path: draft[1],
          eventId: draft[2],
          title: decodeURIComponent((draft[3] || '').trim()),
          dataUrl: posterUrl?.startsWith('data:image/') ? posterUrl : undefined,
        }
      : undefined,
  };
}

export type IicheAiAnswer = {
  reply: string;
  provider: string;
  navigate?: string;
  posterUrl?: string;
  posterDraft?: { path: string; eventId: string; title: string; dataUrl?: string };
};

function withNav(reply: string, provider: string): IicheAiAnswer {
  const split = splitPortalNavigate(reply);
  return { reply: split.reply, provider, navigate: split.navigate, posterUrl: split.posterUrl, posterDraft: split.posterDraft };
}

const REFUSED_NAV = /cannot open pages|can'?t open pages|cannot navigate|don'?t have access to (your )?browser|i cannot open/i;

export async function answerIicheAi(
  history: IicheAiMessage[],
  runTool?: (name: string, args: Record<string, unknown>) => Promise<string>,
): Promise<IicheAiAnswer> {
  const last = [...history].reverse().find((m) => m.role === 'user');
  const fallback = fallbackIicheAiReply(last?.content || '');
  try {
    if (runTool && last?.content) {
      const { maybeHeuristicTool } = await import('@/lib/iiche-ai-actions');
      const guessed = maybeHeuristicTool(last.content);
      if (guessed) {
        const result = await runTool(guessed.name, guessed.args);
        return withNav(result, 'portal');
      }
    }
    const gemini = await completeGemini(history);
    if (gemini.text) {
      if (REFUSED_NAV.test(gemini.text) && runTool && last?.content) {
        const { maybeHeuristicTool } = await import('@/lib/iiche-ai-actions');
        const guessed = maybeHeuristicTool(last.content);
        if (guessed) return withNav(await runTool(guessed.name, guessed.args), 'gemini');
      }
      return withNav(gemini.text, 'gemini');
    }
    if (!env('GEMINI_API_KEY') && !env('GOOGLE_GENERATIVE_AI_API_KEY')) {
      const groq = await completeGroq(history);
      if (groq) return withNav(groq, 'groq');
      const openai = await completeOpenAi(history);
      if (openai) return withNav(openai, 'openai');
    }
    if (runTool && last?.content) {
      const { maybeHeuristicTool } = await import('@/lib/iiche-ai-actions');
      const guessed = maybeHeuristicTool(last.content);
      if (guessed) {
        const result = await runTool(guessed.name, guessed.args);
        return withNav(result, 'guide');
      }
    }
  } catch (err) {
    console.error('IIChE AI provider error', err);
    if (runTool && last?.content) {
      try {
        const { maybeHeuristicTool } = await import('@/lib/iiche-ai-actions');
        const guessed = maybeHeuristicTool(last.content);
        if (guessed) return withNav(await runTool(guessed.name, guessed.args), 'guide');
      } catch {
        /* ignore */
      }
    }
  }
  return withNav(fallback, 'guide');
}

