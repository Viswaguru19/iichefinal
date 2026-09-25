export type IicheAiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const IICHE_AI_SYSTEM_PROMPT = `You are IIChE AI for the IIChE AVVU Student Chapter member portal.

Answer the user's actual question first. Be correct, complete, and easy to scan. You are a capable assistant — not a page directory.

You handle three kinds of requests:

1. Knowledge, homework, chemical engineering, research, writing, calculations, and event ideas
   - Give a real answer: steps, equations, assumptions, and a short check.
   - Do not reply with only a dashboard link.
   - If data is missing, state the assumption and continue.

2. Live portal facts
   - Who am I / my name / my role / my committees → get_my_identity (answer in chat; do not only open Profile).
   - Who is head / co-head of a committee → get_committee_officers.
   - What events exist / a named event → list_events.
   - Never invent a member's name, role, officers, or events.

3. Portal actions and navigation
   - You ARE allowed to open pages. Never say you cannot navigate or ask them to hunt for a tab.
   - Only navigate when they ask to open, go to, take them to, or find a page.
   - If they only ask how something works, explain it. Do not start voting or create records.
   - Create form / meeting / event report / minutes → the matching create tool.
   - Propose or approve events with the matching tool.
   - Poster: call design_poster and show it in chat. Call upload_poster only when they explicitly say upload, save, attach, or publish.

EC election (do not invent results or winners):
- Page: /dashboard/election
- Start contesting: manage_election action "start"
- Faculty finalize contestants: "finalize" (names stay hidden until then)
- Faculty or Social & Environmental open voting: "open"
- Stop: "stop"
- Heads contest Secretary; co-heads contest Joint Secretary and Treasurer
- Heads and co-heads vote
- Results publish when voting is stopped, time is up, or every eligible member has voted
- If they lack rights, say so and still open /dashboard/election

Portal paths:
- Dashboard /dashboard
- Election /dashboard/election
- Propose event /dashboard/propose-event
- Proposals /dashboard/proposals
- Forms /dashboard/forms
- Meetings /dashboard/meetings
- Tasks /dashboard/tasks
- Documents /dashboard/documents
- Accounts /dashboard/accounts
- Minutes /dashboard/minutes
- Kickoff /dashboard/kickoff
- Profile /dashboard/profile
- Reports /dashboard/reports
- Chat /dashboard/chat
- Hiring /dashboard/hiring
- Posters /dashboard/posters

Never ask for passwords. Never bypass elections or approvals. If a tool fails for permissions, say so and still give the page path.

Format every answer so it is easy to scan:
- Blank line between sections
- ## headings when there are two or more parts
- Bullet lists for options, officers, or ideas
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
    keys: ['propose-event', 'propose an event', 'propose event', 'event proposal'],
    reply:
      'To propose an event, open Dashboard → Propose Event (/dashboard/propose-event). After you submit, track it under Proposals (/dashboard/proposals).',
  },
  {
    keys: ['committee task', 'my tasks', 'tasks page', 'the tasks'],
    reply: 'Committee tasks live at Dashboard → Tasks (/dashboard/tasks). Open a task to update status or leave comments.',
  },
  {
    keys: ['meetings page', 'schedule a meeting', 'join the meeting', 'video call', 'meeting room'],
    reply:
      'Schedule or join from Dashboard → Meetings (/dashboard/meetings). Allow camera and microphone when you enter the live room so others can see and hear you.',
  },
  {
    keys: ['election', 'elections', 'voting', 'contest secretary', 'joint secretary'],
    reply:
      'NAVIGATE:/dashboard/election Opening the EC election page: /dashboard/election.\n\n## How it works\n\n- After start, committee heads contest **Secretary**; co-heads contest **Joint Secretary** and **Treasurer**.\n- Contest names stay hidden until faculty finalizes.\n- Faculty or Social & Environmental then open voting.\n- Heads and co-heads vote.\n- Results publish when voting is stopped, time is up, or every eligible member has voted.',
  },
  {
    keys: ['kickoff', 'tournament', 'football'],
    reply: 'Kickoff tournament tools are at /dashboard/kickoff. Registration and match control are there if you have access.',
  },
  {
    keys: ['forms page', 'create a form', 'fill a form', 'the forms'],
    reply: 'Create or fill forms at Dashboard → Forms (/dashboard/forms).',
  },
  {
    keys: ['documents page', 'shared files', 'upload a file'],
    reply: 'Shared files are at Dashboard → Documents (/dashboard/documents).',
  },
  {
    keys: ['accounts page', 'expense', 'receipt', 'chapter finance'],
    reply: 'Track expenses and receipts at Dashboard → Accounts (/dashboard/accounts).',
  },
  {
    keys: ['my profile', 'profile photo', 'change password'],
    reply: 'Update your name, photo, and account details at Dashboard → Profile (/dashboard/profile).',
  },
  {
    keys: ['co-head', 'cohead', 'co head', 'committee head', 'who is the head', 'heads of', 'this committee'],
    reply:
      'I can look up heads and co-heads. Ask: “Who are the co-heads of the Program Committee?”',
  },
];

const ACADEMIC =
  /\b(explain|calculate|derive|equation|mccabe|thiele|distill|reynolds|fourier|literature review|research|hypothesis|electron|molecule|kinetics|stoich|integral|differential|mass transfer|heat transfer|absorption|extraction|reactor|balance)\b/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function guideKeyMatches(lower: string, key: string): boolean {
  const k = key.trim().toLowerCase();
  if (!k) return false;
  if (k.includes(' ')) return lower.includes(k);
  return new RegExp(`\\b${escapeRegExp(k)}\\b`, 'i').test(lower);
}

export function fallbackIicheAiReply(message: string): string {
  const lower = message.toLowerCase();
  if (ACADEMIC.test(lower)) {
    return 'I could not reach the live model just now. Ask again in a moment and I will walk through the full answer with steps.';
  }
  for (const row of GUIDE) {
    if (row.keys.some((key) => guideKeyMatches(lower, key))) return row.reply;
  }
  return GUIDE.find((row) => row.keys.includes('hello'))?.reply || GUIDE[0].reply;
}

function env(name: string): string {
  return String(process.env[name] || '').trim();
}

export function iicheAiProvider(): 'groq' | 'gemini' | 'openai' | 'guide' {
  if (env('GEMINI_API_KEY') || env('GOOGLE_GENERATIVE_AI_API_KEY')) return 'gemini';
  if (env('GROQ_API_KEY')) return 'groq';
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

type ToolRunner = (name: string, args: Record<string, unknown>) => Promise<string>;

function openaiTools() {
  return import('@/lib/iiche-ai-actions').then(({ IICHE_AI_TOOL_DECLARATIONS }) =>
    IICHE_AI_TOOL_DECLARATIONS.map((d) => ({
      type: 'function' as const,
      function: {
        name: d.name,
        description: d.description,
        parameters: d.parameters,
      },
    })),
  );
}

async function completeOpenAiCompat(
  url: string,
  key: string,
  model: string,
  history: IicheAiMessage[],
  runTool?: ToolRunner,
  timeoutMs = 12000,
): Promise<string | null> {
  type OaiMsg =
    | { role: 'system' | 'user' | 'assistant'; content: string }
    | {
        role: 'assistant';
        content: string | null;
        tool_calls: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
      }
    | { role: 'tool'; tool_call_id: string; content: string };

  const messages: OaiMsg[] = [
    { role: 'system', content: IICHE_AI_SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content }) as OaiMsg),
  ];
  const tools = runTool ? await openaiTools() : undefined;

  for (let round = 0; round < 3; round += 1) {
    const res = await timedFetch(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 1600,
          messages,
          tools,
        }),
      },
      timeoutMs,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
        };
      }[];
    };
    const msg = data.choices?.[0]?.message;
    const calls = msg?.tool_calls || [];
    if (calls.length && runTool) {
      messages.push({
        role: 'assistant',
        content: msg?.content || null,
        tool_calls: calls,
      });
      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
        } catch {
          args = {};
        }
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: await runTool(call.function.name, args),
        });
      }
      continue;
    }
    return msg?.content?.trim() || null;
  }
  return null;
}

async function completeGroq(history: IicheAiMessage[], runTool?: ToolRunner): Promise<string | null> {
  const key = env('GROQ_API_KEY');
  if (!key) return null;
  try {
    return await completeOpenAiCompat(
      'https://api.groq.com/openai/v1/chat/completions',
      key,
      env('GROQ_MODEL') || 'llama-3.1-8b-instant',
      history,
      runTool,
      12000,
    );
  } catch {
    return null;
  }
}

async function completeGemini(
  history: IicheAiMessage[],
  runTool?: ToolRunner,
): Promise<{ text: string | null; usedTools: boolean }> {
  const key = env('GEMINI_API_KEY') || env('GOOGLE_GENERATIVE_AI_API_KEY');
  if (!key) return { text: null, usedTools: false };
  const preferred = env('GEMINI_MODEL');
  const retired = new Set(['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  const models = [
    ...new Set(
      [preferred, 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'].filter((m) => m && !retired.has(m)),
    ),
  ].slice(0, 3);

  type Part =
    | { text: string; thought?: boolean }
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
      thinkingConfig?: { thinkingLevel?: string; thinkingBudget?: number };
    };
  } = {
    systemInstruction: { parts: [{ text: IICHE_AI_SYSTEM_PROMPT }] },
    tools: runTool ? [{ functionDeclarations: IICHE_AI_TOOL_DECLARATIONS }] : undefined,
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingLevel: 'low' },
    },
  };

  for (const model of models) {
    let roundContents = [...contents];
    let usedTools = false;
    for (let round = 0; round < 3; round += 1) {
      let res: Response;
      try {
        res = await timedFetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payloadBase, contents: roundContents }),
          },
          14000,
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
        candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
      };
      const finish = data.candidates?.[0]?.finishReason || '';
      if (finish === 'SAFETY' || finish === 'RECITATION') break;
      const parts = data.candidates?.[0]?.content?.parts || [];
      const calls = parts.filter(
        (p): p is { functionCall: { name: string; args?: Record<string, unknown> } } =>
          'functionCall' in p && !!p.functionCall,
      );
      const text = parts
        .filter((p): p is { text: string; thought?: boolean } => 'text' in p && !p.thought)
        .map((p) => p.text)
        .join('')
        .trim();
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

async function completeOpenAi(history: IicheAiMessage[], runTool?: ToolRunner): Promise<string | null> {
  const key = env('OPENAI_API_KEY');
  if (!key) return null;
  try {
    return await completeOpenAiCompat(
      'https://api.openai.com/v1/chat/completions',
      key,
      env('OPENAI_MODEL') || 'gpt-4o-mini',
      history,
      runTool,
      12000,
    );
  } catch {
    return null;
  }
}

export const PORTAL_NAV_PREFIX = 'NAVIGATE:';

const DASHBOARD_PATH = /\/dashboard\/[a-z0-9/_-]+/i;
const WANTS_NAV = /\b(open|go to|take me|where is|where are|show me|navigate)\b/i;

export function splitPortalNavigate(
  reply: string,
  userMessage?: string,
): {
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
  const inferred =
    !tagged?.[1] && userMessage && WANTS_NAV.test(userMessage)
      ? cleaned.match(DASHBOARD_PATH)?.[0]
      : undefined;
  return {
    reply: cleaned,
    navigate: (tagged?.[1] || inferred)?.replace(/[).,;]+$/, ''),
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

function withNav(reply: string, provider: string, userMessage?: string): IicheAiAnswer {
  const split = splitPortalNavigate(reply, userMessage);
  return {
    reply: split.reply,
    provider,
    navigate: split.navigate,
    posterUrl: split.posterUrl,
    posterDraft: split.posterDraft,
  };
}

const REFUSED_NAV = /cannot open pages|can'?t open pages|cannot navigate|don'?t have access to (your )?browser|i cannot open/i;

const EAGER_TOOLS = new Set([
  'get_my_identity',
  'get_committee_officers',
  'design_poster',
  'upload_poster',
  'create_form',
  'create_meeting',
  'create_event_report',
  'create_minutes',
  'propose_event',
  'approve_proposal',
  'manage_election',
  'open_portal_page',
  'list_events',
]);

export function shouldRunHeuristicBeforeModel(
  message: string,
  guessed: { name: string },
): boolean {
  if (!EAGER_TOOLS.has(guessed.name)) return false;
  if (/\b(and|also)\b.+\b(explain|how|why|what|calculate|ideas?|research)\b/i.test(message)) {
    return false;
  }
  return true;
}

export async function answerIicheAi(
  history: IicheAiMessage[],
  runTool?: ToolRunner,
): Promise<IicheAiAnswer> {
  const last = [...history].reverse().find((m) => m.role === 'user');
  const userMessage = last?.content || '';
  const fallback = fallbackIicheAiReply(userMessage);
  try {
    if (runTool && userMessage) {
      const { maybeHeuristicTool } = await import('@/lib/iiche-ai-actions');
      const guessed = maybeHeuristicTool(userMessage);
      if (guessed && shouldRunHeuristicBeforeModel(userMessage, guessed)) {
        const result = await runTool(guessed.name, guessed.args);
        return withNav(result, 'portal', userMessage);
      }
    }
    const gemini = await completeGemini(history, runTool);
    if (gemini.text) {
      if (REFUSED_NAV.test(gemini.text) && runTool && userMessage) {
        const { maybeHeuristicTool } = await import('@/lib/iiche-ai-actions');
        const guessed = maybeHeuristicTool(userMessage);
        if (guessed) return withNav(await runTool(guessed.name, guessed.args), 'gemini', userMessage);
      }
      return withNav(gemini.text, 'gemini', userMessage);
    }
    const groq = await completeGroq(history, runTool);
    if (groq) return withNav(groq, 'groq', userMessage);
    const openai = await completeOpenAi(history, runTool);
    if (openai) return withNav(openai, 'openai', userMessage);
    if (runTool && userMessage) {
      const { maybeHeuristicTool } = await import('@/lib/iiche-ai-actions');
      const guessed = maybeHeuristicTool(userMessage);
      if (guessed) {
        const result = await runTool(guessed.name, guessed.args);
        return withNav(result, 'guide', userMessage);
      }
    }
  } catch (err) {
    console.error('IIChE AI provider error', err);
    if (runTool && userMessage) {
      try {
        const { maybeHeuristicTool } = await import('@/lib/iiche-ai-actions');
        const guessed = maybeHeuristicTool(userMessage);
        if (guessed) return withNav(await runTool(guessed.name, guessed.args), 'guide', userMessage);
      } catch {
        /* ignore */
      }
    }
  }
  return withNav(fallback, 'guide', userMessage);
}
