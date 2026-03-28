'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Briefcase, Power, RefreshCw } from 'lucide-react';
import { canManageHiringToggle, canReviewHiringApplications } from '@/lib/hiring-access';

type CommitteeOpt = { id: string; name: string };
type AppRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  department?: string | null;
  year_of_study?: string | null;
  preference_1_id?: string | null;
  preference_2_id?: string | null;
  preference_3_id?: string | null;
  selected_committee_id?: string | null;
  resume?: string | null;
};

export default function DashboardHiringPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [applications, setApplications] = useState<AppRow[]>([]);
  const [committeeNames, setCommitteeNames] = useState<Record<string, string>>({});
  const [canToggle, setCanToggle] = useState(false);
  const [reviewCommitteeIds, setReviewCommitteeIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!profile || (profile as { hiring_portal_only?: boolean }).hiring_portal_only) {
      router.push('/hiring/portal');
      return;
    }

    const { data: memberships } = await supabase
      .from('committee_members')
      .select('committee_id, position, committees(name)')
      .eq('user_id', user.id);

    const rows = (memberships || []) as unknown as {
      committee_id: string;
      position: string;
      committees: { name: string } | null;
    }[];
    const namesForToggle = rows.map((r) => ({ name: r.committees?.name }));
    const toggle = canManageHiringToggle(profile, namesForToggle);
    const reviewIds = rows
      .filter((r) => canReviewHiringApplications([r.position]))
      .map((r) => r.committee_id);
    const canSee = toggle || reviewIds.length > 0;

    if (!canSee) {
      toast.error('You do not have access to hiring management.');
      router.push('/dashboard');
      return;
    }

    setCanToggle(toggle);
    setReviewCommitteeIds(reviewIds);

    const { data: settings } = await supabase.from('hiring_settings').select('is_active').single();
    setIsActive(!!(settings as { is_active?: boolean } | null)?.is_active);

    const { data: com } = await supabase.from('committees').select('id, name').eq('type', 'regular').order('name');
    const clist = (com as CommitteeOpt[]) || [];
    setCommitteeNames(Object.fromEntries(clist.map((c) => [c.id, c.name])));

    const { data: apps } = await supabase.from('hiring_applications').select('*').order('created_at', { ascending: false });

    let list = (apps as AppRow[]) || [];
    if (!toggle && reviewIds.length) {
      list = list.filter((a) =>
        reviewIds.some(
          (cid) =>
            cid === a.preference_1_id || cid === a.preference_2_id || cid === a.preference_3_id,
        ),
      );
    }
    setApplications(list);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleHiring = async () => {
    if (!canToggle) return;
    const next = !isActive;
    const { data: row } = await supabase.from('hiring_settings').select('id').limit(1).maybeSingle();
    const id = (row as { id?: string } | null)?.id;
    if (!id) {
      toast.error('Hiring settings row missing');
      return;
    }
    const { error: e1 } = await supabase.from('hiring_settings').update({ is_active: next }).eq('id', id);
    if (e1) {
      toast.error(e1.message);
      return;
    }
    if (next) {
      const { error: e2 } = await supabase.rpc('sync_cohead_hiring_positions');
      if (e2) {
        toast.error(e2.message);
        await supabase.from('hiring_settings').update({ is_active: false }).eq('id', id);
        return;
      }
      toast.success('Hiring is on. Share the public /hiring page with candidates.');
    } else {
      const { error: e3 } = await supabase.rpc('close_system_hiring_positions');
      if (e3) toast.error(e3.message);
      toast.success('Hiring deactivated.');
    }
    setIsActive(next);
  };

  const updateStatus = async (appId: string, status: string) => {
    const { error } = await supabase
      .from('hiring_applications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', appId);
    if (error) toast.error(error.message);
    else {
      toast.success('Updated');
      load();
    }
  };

  const accept = async (app: AppRow, committeeId: string) => {
    const { data, error } = await supabase.rpc('accept_hiring_application', {
      p_application_id: app.id,
      p_committee_id: committeeId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const res = data as { ok?: boolean; error?: string };
    if (!res?.ok) {
      toast.error(res?.error || 'Failed');
      return;
    }
    toast.success('Applicant added as co-head and given full portal access.');
    load();
  };

  const prefOptions = useMemo(() => {
    return (app: AppRow) => {
      const opts: { id: string; label: string }[] = [];
      if (app.preference_1_id)
        opts.push({ id: app.preference_1_id, label: `1st: ${committeeNames[app.preference_1_id] || '—'}` });
      if (app.preference_2_id)
        opts.push({ id: app.preference_2_id, label: `2nd: ${committeeNames[app.preference_2_id] || '—'}` });
      if (app.preference_3_id)
        opts.push({ id: app.preference_3_id, label: `3rd: ${committeeNames[app.preference_3_id] || '—'}` });
      return opts;
    };
  }, [committeeNames]);

  const acceptTargets = (app: AppRow) =>
    prefOptions(app).filter((o) => canToggle || reviewCommitteeIds.includes(o.id));

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center text-gray-600">
        Loading hiring…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh">
      <nav className="premium-panel shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gradient flex items-center gap-2">
            <Briefcase className="w-6 h-6" />
            Co-head hiring
          </h1>
          <Link href="/dashboard" className="text-indigo-600 hover:underline text-sm">
            ← Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {canToggle && (
          <div className="premium-panel rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Hiring visibility</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Only admins, faculty, Executive Committee members, or Social & Environmental / HR committee members can
                  toggle this. When on, one co-head campaign is published automatically. Applicants register on the hiring
                  page, then submit the form with three committee preferences.
                </p>
                <p className="text-sm text-indigo-600 mt-2 font-medium">
                  Public URL: {typeof window !== 'undefined' ? `${window.location.origin}/hiring` : '/hiring'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => load()}
                  className="p-3 rounded-xl bg-white/80 border border-white/60 text-gray-700 hover:bg-white"
                  title="Refresh"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={toggleHiring}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white ${
                    isActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <Power className="w-5 h-5" />
                  {isActive ? 'Turn hiring off' : 'Turn hiring on'}
                </button>
              </div>
            </div>
            {!isActive && (
              <p className="text-amber-800 text-sm mt-4 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                While off, visitors see that recruitment is closed.
              </p>
            )}
          </div>
        )}

        <div className="premium-panel rounded-2xl p-6 overflow-x-auto">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Applications ({applications.length})</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-2">Applicant</th>
                <th className="py-2 pr-2">Preferences</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-b border-gray-100 align-top">
                  <td className="py-3 pr-2">
                    <div className="font-medium text-gray-900">{app.name}</div>
                    <div className="text-gray-500">{app.email}</div>
                    <div className="text-gray-400 text-xs">{app.phone}</div>
                    {app.department && <div className="text-xs text-gray-500">{app.department}</div>}
                    {app.year_of_study && <div className="text-xs text-gray-500">Year: {app.year_of_study}</div>}
                    {app.resume && (
                      <a href={app.resume} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs underline">
                        Resume link
                      </a>
                    )}
                  </td>
                  <td className="py-3 pr-2 text-gray-700">
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>{committeeNames[app.preference_1_id || ''] || '—'}</li>
                      <li>{committeeNames[app.preference_2_id || ''] || '—'}</li>
                      <li>{committeeNames[app.preference_3_id || ''] || '—'}</li>
                    </ol>
                  </td>
                  <td className="py-3 pr-2">
                    <select
                      value={app.status}
                      onChange={(e) => updateStatus(app.id, e.target.value)}
                      disabled={app.status === 'selected' || app.status === 'rejected'}
                      className="border rounded-lg px-2 py-1 text-xs bg-white"
                    >
                      {['pending', 'shortlisted', 'interview', 'selected', 'rejected'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-2 space-y-2">
                    {app.status !== 'selected' && app.status !== 'rejected' && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500">Accept as co-head (committee must be in their list)</span>
                        <div className="flex flex-wrap gap-1">
                          {acceptTargets(app).map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => {
                                if (!confirm(`Add ${app.name} as co-head for ${o.label}?`)) return;
                                accept(app, o.id);
                              }}
                              className="text-xs px-2 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                            >
                              Accept → {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {app.status === 'selected' && (
                      <span className="text-xs text-emerald-700">Onboarded (portal access + committee membership)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {applications.length === 0 && (
            <p className="text-center text-gray-500 py-8">No applications in your view.</p>
          )}
        </div>

        <p className="text-xs text-gray-500 text-center max-w-2xl mx-auto">
          Heads and co-heads only see applicants who included their committee among the three preferences. Full hiring
          managers see every application.
        </p>
      </div>
    </div>
  );
}
