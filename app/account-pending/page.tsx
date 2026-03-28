'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DynamicLogo from '@/components/DynamicLogo';

export default function AccountPendingPage() {
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('approved, role, hiring_portal_only')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const p = prof as { approved?: boolean; role?: string; hiring_portal_only?: boolean } | null;
      if (p?.hiring_portal_only) {
        router.replace('/hiring/portal');
        return;
      }
      if (p?.role === 'super_admin' || p?.approved === true) {
        router.replace('/dashboard');
        return;
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
      <div className="glass-strong rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-white/80 border border-white/60 flex items-center justify-center">
            <DynamicLogo width={44} height={44} />
          </div>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Waiting for admin approval</h1>
        <p className="text-gray-600 text-sm leading-relaxed mb-6">
          Your account was created successfully. A faculty advisor or administrator still needs to approve it before you can use the dashboard, chats, and committees.
        </p>
        <p className="text-gray-500 text-xs mb-6">
          You will be able to sign in normally once your account is approved.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Sign out
          </button>
          <Link href="/login" className="text-sm text-indigo-600 hover:text-indigo-800">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
