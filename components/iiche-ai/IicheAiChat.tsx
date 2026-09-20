'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sparkles, Send } from 'lucide-react';
import { parseIicheAiReply, type AiInline } from '@/lib/iiche-ai-format';

type ChatTurn = { role: 'user' | 'assistant'; content: string; posterUrl?: string; animate?: boolean };

const STARTERS = [
  'Give event ideas for Chemical Engineering week',
  'Help me outline a literature review on membrane separation',
  'Who are the co-heads of this committee?',
  'Create a feedback form called Guest Feedback',
];

function InlineBits({ parts, linkClass }: { parts: AiInline[]; linkClass: string }) {
  return (
    <>
      {parts.map((part, i) => {
        if (part.t === 'b') return <strong key={i}>{part.v}</strong>;
        if (part.t === 'i') return <em key={i}>{part.v}</em>;
        if (part.t === 'a') {
          return (
            <a key={i} href={part.href} className={`underline break-all ${linkClass}`}>
              {part.v.replace(/[).,;]+$/, '')}
            </a>
          );
        }
        return <span key={i}>{part.v}</span>;
      })}
    </>
  );
}

function TypewriterBody({
  content,
  posterUrl,
  animate,
}: {
  content: string;
  posterUrl?: string;
  animate?: boolean;
}) {
  const [n, setN] = useState(animate ? 0 : content.length);
  useEffect(() => {
    if (!animate) {
      setN(content.length);
      return;
    }
    setN(0);
    const step = Math.max(2, Math.ceil(content.length / 70));
    const id = window.setInterval(() => {
      setN((prev) => {
        if (prev >= content.length) {
          window.clearInterval(id);
          return content.length;
        }
        return Math.min(content.length, prev + step);
      });
    }, 18);
    return () => window.clearInterval(id);
  }, [animate, content]);

  const done = !animate || n >= content.length;
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {posterUrl ? (
        <img
          src={posterUrl}
          alt="Event poster"
          className="iiche-ai-poster mt-1 block h-auto w-[240px] max-w-full rounded-xl border border-white/10 bg-black/40 object-contain shadow-lg"
        />
      ) : null}
      {done ? (
        <AssistantBody content={content} />
      ) : (
        <p className="whitespace-pre-wrap break-words">
          {content.slice(0, n)}
          <span className="iiche-ai-caret">&nbsp;</span>
        </p>
      )}
    </div>
  );
}

function AssistantBody({ content, posterUrl }: { content: string; posterUrl?: string }) {
  const blocks = parseIicheAiReply(content);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {posterUrl ? (
        <img
          src={posterUrl}
          alt="Event poster"
          className="iiche-ai-poster mt-1 block h-auto w-[240px] max-w-full rounded-xl border border-white/10 bg-black/40 object-contain shadow-lg"
        />
      ) : null}
      {blocks.map((block, i) => {
        if (block.t === 'img') {
          return (
            <img
              key={i}
              src={block.src}
              alt={block.alt}
              className="iiche-ai-poster mt-1 block h-auto w-[240px] max-w-full rounded-xl border border-white/10 bg-black/40 object-contain shadow-lg"
            />
          );
        }
        if (block.t === 'h') {
          return (
            <p key={i} className="font-semibold">
              <InlineBits parts={block.children} linkClass="iiche-ai-link" />
            </p>
          );
        }
        if (block.t === 'li') {
          return (
            <div key={i} className="flex gap-2">
              <span className="iiche-ai-bullet mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
              <p>
                <InlineBits parts={block.children} linkClass="iiche-ai-link" />
              </p>
            </div>
          );
        }
        return (
          <p key={i}>
            <InlineBits parts={block.children} linkClass="iiche-ai-link" />
          </p>
        );
      })}
    </div>
  );
}

export default function IicheAiChat({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      role: 'assistant',
      content:
        'Hi — I am IIChE AI. Ask me anything: general questions, research help, problem-solving, event ideas, or portal work (co-heads, forms, meetings, reports, minutes).',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [posterDraft, setPosterDraft] = useState<{
    path?: string;
    eventId: string;
    title?: string;
    dataUrl?: string;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const nextTurns: ChatTurn[] = [...turns, { role: 'user', content: message }];
    setTurns(nextTurns);
    setDraft('');
    setBusy(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: nextTurns.slice(-8).map((t) => ({ role: t.role, content: t.content.slice(0, 800) })),
          posterDraft: posterDraft
            ? {
                eventId: posterDraft.eventId,
                path: posterDraft.path,
                title: posterDraft.title,
                dataUrl: /\b(upload|attach|publish|save this|save the)\b/i.test(message)
                  ? posterDraft.dataUrl
                  : undefined,
              }
            : null,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        navigate?: string;
        posterDraft?: { path?: string; eventId: string; title?: string; dataUrl?: string };
        posterUrl?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Could not reach IIChE AI');
      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || 'I could not answer that.',
          posterUrl: data.posterUrl || data.posterDraft?.dataUrl,
          animate: true,
        },
      ]);
      if (data.posterDraft?.eventId) setPosterDraft(data.posterDraft);
      const dest = String(data.navigate || '').trim();
      if (dest.startsWith('/dashboard') && dest !== pathname) {
        router.push(dest);
      }
    } catch (e) {
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', content: e instanceof Error ? e.message : 'IIChE AI is unavailable right now.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`iiche-ai-chat flex flex-col ${compact ? 'h-[min(70vh,520px)]' : 'h-[min(72vh,640px)]'}`}>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {turns.map((turn, i) => (
          <div key={`${turn.role}-${i}`} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] overflow-hidden rounded-2xl px-3.5 py-2.5 ${
                turn.role === 'user' ? 'iiche-ai-bubble-user' : 'iiche-ai-bubble-assistant'
              }`}
            >
              {turn.role === 'assistant' && (
                <p className="iiche-ai-label mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
                  <Sparkles className="w-3 h-3" /> IIChE AI
                </p>
              )}
              {turn.role === 'assistant' ? (
                <TypewriterBody content={turn.content} posterUrl={turn.posterUrl} animate={turn.animate} />
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{turn.content}</p>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="iiche-ai-bubble-assistant max-w-[85%] rounded-2xl px-3.5 py-2.5">
              <p className="iiche-ai-label mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
                <Sparkles className="w-3 h-3" /> IIChE AI
              </p>
              <p className="iiche-ai-wait iiche-ai-muted" aria-label="IIChE AI is typing">
                <span />
                <span />
                <span />
              </p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!busy && turns.length < 3 && (
        <div className="flex flex-wrap gap-1.5 py-3">
          {STARTERS.map((q) => (
            <button key={q} type="button" onClick={() => void ask(q)} className="iiche-ai-chip text-xs px-2.5 py-1.5 rounded-full">
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask anything — research, ideas, or the portal…"
          className="iiche-ai-input flex-1 rounded-xl px-3 py-2.5 text-sm"
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="btn-gradient-blue rounded-xl px-3 py-2 disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
