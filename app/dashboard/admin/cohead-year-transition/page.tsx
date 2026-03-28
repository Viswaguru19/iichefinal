'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { ArrowUpCircle, Undo2 } from 'lucide-react';
import { hasAdminAccess } from '@/lib/permissions';

type RpcResult = { ok?: boolean; promoted?: number; reverted?: number; error?: string; message?: string };

export default function CoheadYearTransitionPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<'promote' | 'reverse' | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_faculty, is_admin, executive_role')
        .eq('id', user.id)
        .single();
      const p = profile as { role?: string; is_faculty?: boolean; is_admin?: boolean; executive_role?: string | null } | null;
      const ok = !!(
        p &&
        (hasAdminAccess(p.role || '') ||
          p.is_faculty ||
          p.is_admin ||
          (p.executive_role != null && p.executive_role !== ''))
      );
      if (!ok) {
        toast.error('Admin access required.');
        router.replace('/dashboard');
        return;
      }
      setAllowed(true);
    })();
  }, [router, supabase]);

  const promote = async () => {
    if (
      !confirm(
        'Promote every co-head on regular committees to head? This is meant for the yearly handover. Old heads are not changed automatically.',
      )
    ) {
      return;
    }
    setBusy('promote');
    try {
      const { data, error } = await supabase.rpc('promote_coheads_to_heads');
      if (error) throw error;
      const r = data as RpcResult;
      if (!r?.ok) {
        toast.error(r?.error === 'forbidden' ? 'Not allowed' : r?.message || 'Failed');
        return;
      }
      toast.success(
        r.promoted === 0 ? (r.message || 'No co-heads to promote') : `Promoted ${r.promoted} co-head(s) to head.`,
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  };

  const reverse = async () => {
    if (
      !confirm(
        'Reverse the last promotion run? Co-heads who were promoted in that batch will become co-head again. Use for testing or undo.',
      )
    ) {
      return;
    }
    setBusy('reverse');
    try {
      const { data, error } = await supabase.rpc('reverse_last_cohead_promotion');
      if (error) throw error;
      const r = data as RpcResult;
      if (!r?.ok) {
        toast.error(r?.message || r?.error || 'Nothing to reverse');
        return;
      }
      toast.success(`Reverted ${r.reverted ?? 0} member row(s) to co-head.`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  };

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center text-gray-600">
        Checking access…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh">
      <nav className="premium-panel shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gradient">Annual co-head → head</h1>
          <Link href="/dashboard/admin" className="text-sm text-indigo-600 hover:underline">
            ← Admin
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div className="premium-panel rounded-2xl p-8 space-y-4">
          <p className="text-gray-700">
            After each academic year, run <strong>Promote co-heads to heads</strong> so every <strong>co-head</strong> on{' '}
            <strong>regular committees</strong> becomes a <strong>head</strong>. Executive Committee memberships are
            not changed.
          </p>
          <p className="text-sm text-gray-500">
            Retiring heads are not removed automatically—handle membership cleanup separately if needed. New co-heads
            are onboarded through hiring.
          </p>
          <button
            type="button"
            onClick={promote}
            disabled={busy !== null}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            <ArrowUpCircle className="w-5 h-5" />
            {busy === 'promote' ? 'Working…' : 'Promote all co-heads to heads'}
          </button>
        </div>

        <div className="premium-panel rounded-2xl p-8 space-y-4 border border-amber-100 bg-amber-50/30">
          <h2 className="font-bold text-gray-900">Test / undo</h2>
          <p className="text-sm text-gray-600">
            <strong>Reverse last promotion</strong> restores the most recent batch only: those members go back to{' '}
            <strong>co-head</strong>. Run promote first; then you can reverse to test.
          </p>
          <button
            type="button"
            onClick={reverse}
            disabled={busy !== null}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white border-2 border-amber-400 text-amber-900 font-semibold hover:bg-amber-50 disabled:opacity-50"
          >
            <Undo2 className="w-5 h-5" />
            {busy === 'reverse' ? 'Working…' : 'Reverse last promotion (test)'}
          </button>
        </div>
      </div>
    </div>
  );
}
