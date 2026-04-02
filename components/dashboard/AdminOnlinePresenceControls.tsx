'use client';

import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePortalPresence } from '@/components/dashboard/PortalPresenceContext';
import { Users } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { motionTokens } from '@/lib/ui/motion';

type Row = { id: string; name: string };

/**
 * Portal-wide “who is online” for admins — shown in DashboardNav and PageHeader.
 */
export default function AdminOnlinePresenceControls() {
  const { onlineUserIds, viewerIsAdmin, currentUserId, ready } = usePortalPresence();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const othersCount = useMemo(() => {
    let n = 0;
    for (const id of onlineUserIds) {
      if (id !== currentUserId) n += 1;
    }
    return n;
  }, [onlineUserIds, currentUserId]);

  const loadNames = useCallback(async () => {
    const ids = [...onlineUserIds].filter(Boolean);
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    setLoadingNames(true);
    const { data } = await supabase.from('profiles').select('id, name').in('id', ids);
    const list: Row[] = (data || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name || 'Member' }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    setRows(list);
    setLoadingNames(false);
  }, [onlineUserIds, supabase]);

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void loadNames();
  };

  if (!ready || !viewerIsAdmin) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 border border-emerald-200/60 text-[11px] sm:text-xs font-semibold transition-colors portal-header-link"
        title="Members online in the portal (admin)"
      >
        <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
        <span className="whitespace-nowrap tabular-nums">
          <span className="sm:hidden">{othersCount > 0 ? othersCount : '—'}</span>
          <span className="hidden sm:inline">Online{othersCount > 0 ? ` · ${othersCount}` : ''}</span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button type="button" className="fixed inset-0 z-[60]" aria-label="Close" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: motionTokens.modal.duration, ease: motionTokens.easing }}
              className="absolute right-0 top-full mt-1.5 w-[min(100vw-1.5rem,280px)] max-h-72 overflow-hidden rounded-xl border border-emerald-200/80 bg-white shadow-xl z-[70]"
            >
              <div className="px-3 py-2 border-b border-gray-100 bg-emerald-50/50">
                <p className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide">In portal now</p>
                <p className="text-[10px] text-emerald-800/80 mt-0.5">Anyone with a dashboard tab open</p>
              </div>
              <div className="overflow-y-auto max-h-56 p-2">
                {loadingNames ? (
                  <p className="text-xs text-gray-500 px-2 py-3 text-center">Loading names…</p>
                ) : rows.length === 0 ? (
                  <p className="text-xs text-gray-500 px-2 py-3 text-center">No other members online</p>
                ) : (
                  <ul className="space-y-0.5">
                    {rows.map((r) => {
                      const isSelf = r.id === currentUserId;
                      const dot = onlineUserIds.has(r.id);
                      return (
                        <li
                          key={r.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-800 hover:bg-gray-50"
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${dot ? 'bg-emerald-500' : 'bg-gray-300'}`}
                            aria-hidden
                          />
                          <span className="truncate">
                            {r.name}
                            {isSelf ? ' (you)' : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
