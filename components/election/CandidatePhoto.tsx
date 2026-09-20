'use client';

import { useMemo, useState } from 'react';
import { resolveElectionAvatarUrl } from '@/lib/ec-election';
import { createClient } from '@/lib/supabase/client';

export default function CandidatePhoto({
  name,
  avatarUrl,
  size = 44,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => {
    const supabase = createClient();
    return resolveElectionAvatarUrl(
      avatarUrl,
      (path) => supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl,
    );
  }, [avatarUrl]);
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';

  if (!src || failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-indigo-500 text-sm font-bold text-white"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover bg-gray-100"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
