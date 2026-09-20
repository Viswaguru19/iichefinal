'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import PageHeader from '@/components/PageHeader';
import DashboardAtmosphere from '@/components/react-bits/DashboardAtmosphere';
import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import {
  ELECTION_CATEGORIES,
  ballotContestants,
  formatElectionCountdown,
  minutesToDurationParts,
  rankContestants,
  winnersForCategory,
  type ElectionCategoryId,
  type ElectionStatus,
} from '@/lib/ec-election';
import PartyPoppers from '@/components/election/PartyPoppers';
import CandidatePhoto from '@/components/election/CandidatePhoto';

type Contestant = {
  id: string;
  user_id: string;
  name: string;
  avatar_url?: string | null;
  category: ElectionCategoryId;
  created_at: string;
  on_ballot?: boolean;
};

type TallyRow = {
  contestant_id: string;
  user_id: string;
  name: string;
  avatar_url?: string | null;
  category: ElectionCategoryId;
  votes: number;
  created_at: string;
  on_ballot?: boolean;
};

type BallotRow = {
  voter_name: string;
  contestant_name: string;
  contestant_id: string;
  category: ElectionCategoryId;
};

type RemovalRow = {
  id: string;
  name: string;
  category: ElectionCategoryId;
  reason: string;
  removed_at: string;
};

type MyRemoval = {
  category: ElectionCategoryId;
  reason: string;
  removed_at: string;
};

type ElectionState = {
  allowed: boolean;
  tab_visible: boolean;
  status: ElectionStatus;
  results_visible: boolean;
  roles_applied: boolean;
  voting_minutes: number | null;
  voting_ends_at: string | null;
  can_manage: boolean;
  can_remove: boolean;
  can_contest: Partial<Record<ElectionCategoryId, boolean>>;
  can_vote: boolean;
  can_view_live: boolean;
  my_user_id: string;
  contestants: Contestant[];
  my_votes: Record<string, string[]>;
  tally: TallyRow[] | null;
  ballots: BallotRow[] | null;
  removals: RemovalRow[] | null;
  my_removal: MyRemoval | null;
};

function rpcError(err: { message?: string } | null): string {
  const raw = err?.message || 'Something went wrong';
  const m = raw.match(/EXCEPTION:\s*(.+?)$/i) || raw.match(/error:\s*(.+?)$/i);
  return (m?.[1] || raw).replace(/^.*ERROR:\s*/i, '').split('\n')[0];
}

export default function ElectionPage() {
  const supabase = createClient();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<ElectionState | null>(null);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [durationHours, setDurationHours] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [removeId, setRemoveId] = useState('');
  const [removeReason, setRemoveReason] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data, error } = await supabase.rpc('ec_election_state');
    if (error) {
      toast.error(rpcError(error));
      setPageLoading(false);
      return;
    }
    const next = data as ElectionState;
    if (!next?.allowed) {
      toast.error('Election is not open');
      router.push('/dashboard');
      return;
    }
    setState(next);
    const parts = minutesToDurationParts(next.voting_minutes);
    setDurationHours(parts.hours || (next.voting_minutes ? 0 : 1));
    setDurationMinutes(parts.minutes);
    const nextPicks: Record<string, string[]> = {};
    for (const cat of ELECTION_CATEGORIES) {
      nextPicks[cat.id] = Array.isArray(next.my_votes?.[cat.id]) ? next.my_votes[cat.id] : [];
    }
    setPicks(nextPicks);
    setPageLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (state?.status !== 'voting' || !state.voting_ends_at) return;
    const tick = window.setInterval(() => {
      const t = Date.now();
      setNowMs(t);
      if (new Date(state.voting_ends_at as string).getTime() <= t) {
        void load();
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [load, state?.status, state?.voting_ends_at]);

  async function callRpc(fn: string, args: Record<string, unknown> = {}, ok?: string) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc(fn, args);
      if (error) throw error;
      if (ok) toast.success(ok);
      await load();
    } catch (e: unknown) {
      toast.error(rpcError(e as { message?: string }));
    } finally {
      setBusy(false);
    }
  }

  const myContest = state?.contestants.find((c) => c.user_id === state.my_user_id) || null;

  const tallyByContestant = useMemo(() => {
    const map = new Map<string, number>();
    (state?.tally || []).forEach((row) => map.set(row.contestant_id, row.votes));
    return map;
  }, [state?.tally]);

  function togglePick(category: ElectionCategoryId, contestantId: string) {
    setPicks((prev) => {
      const current = prev[category] || [];
      if (current.includes(contestantId)) {
        return { ...prev, [category]: current.filter((id) => id !== contestantId) };
      }
      if (current.length >= 2) {
        toast.error('Select up to 2');
        return prev;
      }
      return { ...prev, [category]: [...current, contestantId] };
    });
  }

  if (pageLoading || !state) {
    return <PortalLoadingScreen message="Loading election…" variant="home" />;
  }

  const showLive = !!state.tally && (state.can_view_live || state.results_visible);
  const showResults = state.results_visible && !!state.tally;
  const showCategories =
    state.tab_visible && !showResults && (state.status !== 'closed' || state.can_view_live);
  const countdown = state.status === 'voting' ? formatElectionCountdown(state.voting_ends_at, nowMs) : null;
  const removable = state.contestants;

  return (
    <>
      {state.results_visible ? <PartyPoppers durationMs={4000} /> : null}
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      <DashboardAtmosphere />
      <PageHeader title="Executive Committee Election" gradientTitle />

      <div className="max-w-5xl mx-auto px-4 py-8 relative z-10 space-y-6">
        {state.can_manage && (
          <div className="premium-card rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
            {!state.tab_visible && (
              <button disabled={busy} onClick={() => callRpc('ec_election_open_tab', {}, 'Election opened')} className="btn-gradient-green px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                Open Election
              </button>
            )}
            {state.tab_visible && (
              <button disabled={busy} onClick={() => callRpc('ec_election_hide_tab', {}, 'Hidden')} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/80 text-gray-700 border border-gray-200 disabled:opacity-50">
                Hide
              </button>
            )}
            {state.tab_visible && state.status === 'nominations' && (
              <button disabled={busy} onClick={() => callRpc('ec_election_start', {}, 'Voting started')} className="btn-gradient-blue px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                Start Election
              </button>
            )}
            {state.status === 'voting' && (
              <button disabled={busy} onClick={() => callRpc('ec_election_stop', {}, 'Voting stopped')} className="btn-gradient-red px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                Stop Election
              </button>
            )}
            {state.status === 'closed' && !state.results_visible && (
              <button disabled={busy} onClick={() => callRpc('ec_election_show_results', {}, 'Results published')} className="btn-gradient-purple px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                Show Results
              </button>
            )}
            {state.results_visible && !state.roles_applied && (
              <button disabled={busy} onClick={() => callRpc('ec_election_apply_roles', {}, 'New officers take charge')} className="btn-gradient-green px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                Change Roles
              </button>
            )}
            {state.results_visible && (
              <button disabled={busy} onClick={() => callRpc('ec_election_new', {}, 'New election')} className="btn-gradient-amber px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                New Election
              </button>
            )}
            {state.roles_applied && (
              <span className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-xl">Roles updated</span>
            )}
            </div>
            {state.status !== 'closed' && (
              <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-gray-100">
                <label className="text-xs font-semibold text-gray-600">
                  Hours
                  <input
                    type="number"
                    min={0}
                    max={168}
                    value={durationHours}
                    onChange={(e) => setDurationHours(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-1 block w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-gray-600">
                  Minutes
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                    className="mt-1 block w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  disabled={busy || durationHours * 60 + durationMinutes < 1}
                  onClick={() => callRpc('ec_election_set_duration', { p_minutes: durationHours * 60 + durationMinutes }, 'Duration saved')}
                  className="btn-gradient-amber px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  Set duration
                </button>
                {state.voting_minutes ? (
                  <p className="text-xs text-gray-500 pb-2">{state.voting_minutes} minute voting window</p>
                ) : (
                  <p className="text-xs text-gray-500 pb-2">Set how long voting stays open</p>
                )}
              </div>
            )}
          </div>
        )}

        {countdown && (
          <div className="premium-panel rounded-2xl px-4 py-3 text-sm font-semibold text-indigo-700">
            Time left: {countdown}
          </div>
        )}

        {state.my_removal && (
          <div className="premium-panel rounded-2xl p-5 space-y-1">
            <p className="text-sm font-bold text-rose-800">Your nomination was removed</p>
            <p className="text-sm text-gray-700">
              {ELECTION_CATEGORIES.find((c) => c.id === state.my_removal?.category)?.title || 'This post'}
            </p>
            <p className="text-sm text-gray-600">{state.my_removal.reason}</p>
          </div>
        )}

        {state.can_remove && state.status === 'nominations' && (
          <div className="premium-card rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Remove a nomination</h3>
            <p className="text-xs text-gray-500">Faculty only. Only the first 2 nominations for each post stay on the ballot.</p>
            <label className="block text-xs font-semibold text-gray-600">
              Candidate
              <select
                value={removeId}
                onChange={(e) => setRemoveId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="">Select</option>
                {removable.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} — {ELECTION_CATEGORIES.find((c) => c.id === person.category)?.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-gray-600">
              Reason
              <textarea
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                rows={3}
                placeholder="Why this nomination is being removed"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900"
              />
            </label>
            <button
              disabled={busy || !removeId || removeReason.trim().length < 3}
              onClick={async () => {
                await callRpc('ec_election_remove_nomination', { p_contestant_id: removeId, p_reason: removeReason.trim() }, 'Nomination removed');
                setRemoveId('');
                setRemoveReason('');
              }}
              className="btn-gradient-red px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              Remove nomination
            </button>
          </div>
        )}

        {state.can_view_live && (state.removals || []).length > 0 && (
          <div className="premium-card rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-gray-900">Removed nominations</h3>
            {(state.removals || []).map((row) => (
              <p key={row.id} className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">{row.name}</span>
                {' — '}
                {ELECTION_CATEGORIES.find((c) => c.id === row.category)?.title}
                {': '}
                {row.reason}
              </p>
            ))}
          </div>
        )}

        {!state.tab_visible && (
          <div className="premium-panel rounded-2xl p-8 text-center text-gray-500 text-sm">
            Hidden from members
          </div>
        )}

        {state.tab_visible && state.status === 'closed' && !state.results_visible && !state.can_view_live && (
          <div className="premium-panel rounded-2xl p-8 text-center text-gray-500 text-sm">
            Voting has ended
          </div>
        )}

        {showResults && (
          <div className="space-y-4">
            {ELECTION_CATEGORIES.map((cat) => {
              const ranked = rankContestants(
                ballotContestants(state.tally || [])
                  .filter((row) => row.category === cat.id)
                  .map((row) => ({
                    id: row.contestant_id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    votes: row.votes,
                    createdAt: row.created_at,
                    on_ballot: row.on_ballot,
                  })),
              );
              const winners = winnersForCategory(ranked);
              const catBallots = (state.ballots || []).filter((b) => b.category === cat.id);
              const winnerRow = (id?: string | null) =>
                (state.tally || []).find((row) => row.contestant_id === id);
              return (
                <div key={cat.id} className="premium-panel rounded-2xl p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">{cat.title}</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 flex items-center gap-3">
                      <CandidatePhoto name={winners.first?.name || cat.firstRole} avatarUrl={winnerRow(winners.first?.id)?.avatar_url} size={56} />
                      <div>
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">{cat.firstRole}</p>
                        <p className="text-base font-bold text-gray-900 mt-1">{winners.first?.name || '—'}</p>
                        {winners.first && <p className="text-sm font-semibold text-gray-600 mt-1">{winners.first.votes}</p>}
                      </div>
                    </div>
                    <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 flex items-center gap-3">
                      <CandidatePhoto name={winners.second?.name || cat.secondRole} avatarUrl={winnerRow(winners.second?.id)?.avatar_url} size={56} />
                      <div>
                        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">{cat.secondRole}</p>
                        <p className="text-base font-bold text-gray-900 mt-1">{winners.second?.name || '—'}</p>
                        {winners.second && <p className="text-sm font-semibold text-gray-600 mt-1">{winners.second.votes}</p>}
                      </div>
                    </div>
                  </div>
                  {ranked.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      {ranked.map((row) => (
                        <div key={row.id} className="flex items-center justify-between text-sm px-1 gap-3">
                          <span className="flex items-center gap-2 text-gray-800">
                            <CandidatePhoto name={row.name} avatarUrl={winnerRow(row.id)?.avatar_url} size={28} />
                            {row.name}
                          </span>
                          <span className="font-bold text-gray-900">{row.votes}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {state.can_view_live && catBallots.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
                      {catBallots.map((b, i) => (
                        <p key={`${b.voter_name}-${b.contestant_id}-${i}`} className="text-sm text-gray-600">
                          {b.voter_name} → {b.contestant_name}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showCategories && (
          <div className="space-y-5">
            {ELECTION_CATEGORIES.map((cat) => {
              const people = state.contestants.filter((c) => c.category === cat.id);
              const listPeople = state.status === 'nominations' ? people : ballotContestants(people);
              const selected = picks[cat.id] || [];
              const contestingHere = myContest?.category === cat.id;
              return (
                <div key={cat.id} className="premium-panel rounded-2xl p-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{cat.title}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">2 candidates on the ballot</p>
                    </div>
                    {state.status === 'nominations' && !!state.can_contest?.[cat.id] && (
                      contestingHere ? (
                        <button disabled={busy} onClick={() => callRpc('ec_election_walk_out', {}, 'Withdrawn')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 disabled:opacity-50">
                          Walk out
                        </button>
                      ) : !myContest ? (
                        <button disabled={busy} onClick={() => callRpc('ec_election_contest', { p_category: cat.id }, 'Contesting')} className="btn-gradient-blue px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50">
                          Contest
                        </button>
                      ) : null
                    )}
                  </div>

                  {listPeople.length === 0 ? (
                    <p className="text-sm text-gray-400">No contestants</p>
                  ) : (
                    <div className="space-y-2">
                      {listPeople.map((person) => {
                        const chosen = selected.includes(person.id);
                        const votes = tallyByContestant.get(person.id);
                        const clickable = state.status === 'voting' && state.can_vote && person.on_ballot !== false;
                        const overflow = state.status === 'nominations' && person.on_ballot === false;
                        return (
                          <button
                            key={person.id}
                            type="button"
                            disabled={!clickable || busy}
                            onClick={() => togglePick(cat.id, person.id)}
                            className={`w-full text-left rounded-xl px-4 py-3 border transition ${
                              chosen
                                ? 'border-indigo-400 bg-indigo-50'
                                : 'border-gray-100 bg-white/70'
                            } ${clickable ? 'hover:border-indigo-200' : ''} disabled:cursor-default`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-3 min-w-0">
                                <CandidatePhoto name={person.name} avatarUrl={person.avatar_url} />
                                <span className="min-w-0">
                                  <span className="block font-semibold text-gray-900 truncate">{person.name}</span>
                                  {overflow && (
                                    <span className="block text-xs text-amber-700">Not on ballot — only first 2 count</span>
                                  )}
                                </span>
                              </span>
                              {showLive && typeof votes === 'number' && person.on_ballot !== false && (
                                <span className="text-sm font-bold text-indigo-700">{votes}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {state.status === 'voting' && state.can_vote && listPeople.length > 0 && (
                    <button
                      disabled={busy || selected.length < 1}
                      onClick={() => callRpc('ec_election_cast_votes', { p_category: cat.id, p_contestant_ids: selected }, 'Vote saved')}
                      className="mt-4 btn-gradient-green px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                    >
                      Vote
                    </button>
                  )}
                  {state.can_view_live && (state.ballots || []).filter((b) => b.category === cat.id).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
                      {(state.ballots || []).filter((b) => b.category === cat.id).map((b, i) => (
                        <p key={`${cat.id}-${b.voter_name}-${b.contestant_id}-${i}`} className="text-sm text-gray-600">
                          {b.voter_name} → {b.contestant_name}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
