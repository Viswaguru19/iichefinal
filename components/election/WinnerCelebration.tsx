'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatExecutiveRole } from '@/lib/ec-election';
import PartyPoppers from '@/components/election/PartyPoppers';

export default function WinnerCelebration() {
  const [roleLabel, setRoleLabel] = useState<string | null>(null);

  const ack = useCallback(async () => {
    const supabase = createClient();
    await supabase.rpc('ec_election_ack_celebration');
    setRoleLabel(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from('profiles')
        .select('election_celebrate, executive_role')
        .eq('id', user.id)
        .maybeSingle();
      const row = data as { election_celebrate?: boolean; executive_role?: string | null } | null;
      if (!cancelled && row?.election_celebrate && row.executive_role) {
        setRoleLabel(formatExecutiveRole(row.executive_role));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!roleLabel) return;
    const t = window.setTimeout(() => {
      void ack();
    }, 5200);
    return () => window.clearTimeout(t);
  }, [roleLabel, ack]);

  if (!roleLabel) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Dismiss" onClick={() => void ack()} />
      <PartyPoppers durationMs={4800} />
      <div className="relative z-[86] max-w-md rounded-3xl bg-white px-8 py-8 text-center shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Congratulations</p>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">You take charge as {roleLabel}</h2>
        <p className="mt-2 text-sm text-gray-500">Welcome to the new Executive Committee</p>
      </div>
    </div>
  );
}
