'use client';

const URL_SPLIT = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

export function LinkedText({ text, className = '' }: { text: string; className?: string }) {
  if (!text) return null;
  const parts = String(text).split(URL_SPLIT);
  return (
    <span className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((part, i) => {
        if (!/^(https?:\/\/|www\.)/i.test(part)) return <span key={i}>{part}</span>;
        const href = /^www\./i.test(part) ? `https://${part}` : part;
        return (
          <a
            key={i}
            href={href.replace(/[),.;]+$/, '')}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 underline underline-offset-2 break-all hover:text-indigo-800"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      })}
    </span>
  );
}
