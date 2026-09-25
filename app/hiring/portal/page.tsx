'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { formatPortalDateTime } from '@/lib/portal-date';

type AppRow = {
  id: string;
  status: string;
  preference_1_id: string | null;
  preference_2_id: string | null;
  preference_3_id: string | null;
  created_at: string;
};

export default function HiringPortalPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<AppRow | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [hiringOnly, setHiringOnly] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/hiring/sign-up');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('hiring_portal_only')
        .eq('id', user.id)
        .single();
      setHiringOnly(!!(profile as { hiring_portal_only?: boolean } | null)?.hiring_portal_only);

      const { data: rows } = await supabase
        .from('hiring_applications')
        .select('id, status, preference_1_id, preference_2_id, preference_3_id, created_at')
        .eq('applicant_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const row = rows?.[0] as AppRow | undefined;
      setApp(row || null);

      const ids = [row?.preference_1_id, row?.preference_2_id, row?.preference_3_id].filter(Boolean) as string[];
      if (ids.length) {
        const { data: com } = await supabase.from('committees').select('id, name').in('id', ids);
        setNames(Object.fromEntries(((com as { id: string; name: string }[]) || []).map((c) => [c.id, c.name])));
      }
      setLoading(false);
    })();
  }, [router, supabase]);

  if (loading) {
    return <PortalLoadingScreen message="Loading hiring…" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-4 flex flex-wrap justify-between gap-2">
        <Link href="/hiring" className="text-indigo-600 font-medium">
          Hiring home
        </Link>
        <div className="flex gap-4 text-sm">
          {!app && <Link href="/hiring/apply">Apply</Link>}
          {!hiringOnly && (
            <Link href="/dashboard" className="text-indigo-700 font-medium">
              Full portal
            </Link>
          )}
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="text-gray-600">
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your hiring status</h1>
        {hiringOnly && (
          <p className="text-sm text-gray-600 mb-6">
            This is a limited account. After a committee selects you as co-head, you will use the same login for the full
            chapter portal.
          </p>
        )}

        {!app ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-gray-700 mb-4">No application on file yet.</p>
            <Link href="/hiring/apply" className="text-indigo-600 font-semibold">
              Complete the application →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <div>
              <span className="text-gray-500 text-sm">Status</span>
              <p className="text-lg font-semibold capitalize">{app.status.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Preferences</span>
              <ol className="list-decimal list-inside mt-1 text-gray-800">
                <li>{names[app.preference_1_id || ''] || '—'}</li>
                <li>{names[app.preference_2_id || ''] || '—'}</li>
                <li>{names[app.preference_3_id || ''] || '—'}</li>
              </ol>
            </div>
            <p className="text-xs text-gray-500 pt-2">
              Submitted {formatPortalDateTime(app.created_at)}. Committees may reach out for interviews when they
              shortlist candidates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
