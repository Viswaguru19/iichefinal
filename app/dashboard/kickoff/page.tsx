'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Trophy, Check, X, Power } from 'lucide-react';

export default function KickoffControlPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [tournamentActive, setTournamentActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single();

    // Check if user is admin
    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'secretary' || profile?.is_admin;

    if (isAdmin) {
      return; // Admin has access
    }

    // Check if user is head or co-head of Social and Environmental Committee
    const { data: membership } = await supabase
      .from('committee_members')
      .select('position, committees(name)')
      .eq('user_id', user.id)
      .single();

    const isSocialEnvHead =
      membership &&
      (membership as any).committees?.name === 'Social and Environmental Committee' &&
      ((membership as any).position === 'head' || (membership as any).position === 'co_head');

    if (!isSocialEnvHead) {
      toast.error('Access denied - Only admins and Social & Environmental Committee heads can access Kickoff Control');
      router.push('/dashboard');
    }
  };

  const loadData = async () => {
    const { data: settings } = await supabase
      .from('tournament_settings')
      .select('*')
      .single();

    setTournamentActive((settings as any)?.is_active || false);

    const { data: teamsData } = await supabase
      .from('kickoff_teams')
      .select('*, kickoff_players(*)')
      .order('created_at');

    const { data: matchesData } = await supabase
      .from('kickoff_matches')
      .select(`
        *,
        team1:kickoff_teams!kickoff_matches_team1_id_fkey(name),
        team2:kickoff_teams!kickoff_matches_team2_id_fkey(name)
      `)
      .order('match_date');

    setTeams(teamsData || []);
    setMatches(matchesData || []);
    setLoading(false);
  };

  const toggleTournament = async () => {
    const settingsId = (await supabase.from('tournament_settings').select('id').single()).data as any;
    const { error } = await (supabase as any)
      .from('tournament_settings')
      .update({ is_active: !tournamentActive })
      .eq('id', settingsId?.id);

    if (error) {
      toast.error('Failed to toggle tournament');
    } else {
      setTournamentActive(!tournamentActive);
      toast.success(tournamentActive ? 'Tournament deactivated' : 'Tournament activated');
    }
  };

  const approveTeam = async (teamId: string) => {
    const { error } = await (supabase as any)
      .from('kickoff_teams')
      .update({ approved: true })
      .eq('id', teamId);

    if (error) {
      toast.error('Failed to approve team');
    } else {
      toast.success('Team approved!');
      loadData();
    }
  };

  const rejectTeam = async (teamId: string) => {
    const { error } = await supabase
      .from('kickoff_teams')
      .delete()
      .eq('id', teamId);

    if (error) {
      toast.error('Failed to reject team');
    } else {
      toast.success('Team rejected');
      loadData();
    }
  };

  const generateSchedule = async () => {
    const approvedTeams = teams.filter(t => t.approved);

    if (approvedTeams.length < 2) {
      toast.error('Need at least 2 approved teams');
      return;
    }

    const matchInserts = [];
    const baseDate = new Date();
    let matchCount = 0;

    for (let i = 0; i < approvedTeams.length; i++) {
      for (let j = i + 1; j < approvedTeams.length; j++) {
        matchInserts.push({
          team1_id: approvedTeams[i].id,
          team2_id: approvedTeams[j].id,
          match_date: new Date(baseDate.getTime() + matchCount * 24 * 60 * 60 * 1000).toISOString(),
          round: 'group',
        });
        matchCount++;
      }
    }

    const { error } = await (supabase as any)
      .from('kickoff_matches')
      .insert(matchInserts);

    if (error) {
      toast.error('Failed to generate schedule');
    } else {
      toast.success(`Generated ${matchInserts.length} matches!`);
      loadData();
    }
  };

  if (loading) {
    return <PortalLoadingScreen message="Loading kickoff…" variant="home" />;
  }

  const pendingTeams = teams.filter(t => !t.approved);
  const approvedTeams = teams.filter(t => t.approved);

  return (
    <div className="min-h-screen bg-mesh">
      <nav className="glass-strong shadow-lg shadow-indigo-500/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gradient-warm flex items-center gap-2">
              <Trophy className="w-6 h-6" />
              Kickoff Control Panel
            </h1>
            <Link href="/dashboard" className="text-gray-500 hover:text-indigo-600 transition">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gradient mb-2">Tournament Control</h2>
              <p className="text-gray-500">
                {tournamentActive ? 'Tournament is currently active and visible to public' : 'Tournament is inactive - showing past results'}
              </p>
            </div>
            <button
              onClick={toggleTournament}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition ${tournamentActive
                ? 'btn-gradient-red'
                : 'btn-gradient-green'
                }`}
            >
              <Power className="w-5 h-5" />
              {tournamentActive ? 'Deactivate Tournament' : 'Activate Tournament'}
            </button>
          </div>
        </div>

        {pendingTeams.length > 0 && (
          <div className="glass rounded-2xl p-6 mb-6 border-l-4 border-amber-500">
            <h2 className="text-xl font-bold text-gradient-warm mb-4">Pending Team Approvals</h2>
            <div className="space-y-4">
              {pendingTeams.map((team) => (
                <div key={team.id} className="glass-strong rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-gray-900">{team.name}</h3>
                    <p className="text-sm text-gray-500">{team.kickoff_players?.length || 0} players</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveTeam(team.id)}
                      className="btn-gradient-green px-4 py-2 rounded-xl flex items-center gap-2 text-sm"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => rejectTeam(team.id)}
                      className="btn-gradient-red px-4 py-2 rounded-xl flex items-center gap-2 text-sm"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gradient">Approved Teams ({approvedTeams.length})</h2>
            <button
              onClick={generateSchedule}
              className="btn-gradient-blue px-6 py-2 rounded-xl font-semibold"
            >
              Generate Schedule
            </button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {approvedTeams.map((team) => (
              <div key={team.id} className="glass-strong rounded-xl p-4">
                <h3 className="font-bold text-gray-900">{team.name}</h3>
                <p className="text-sm text-gray-500">{team.kickoff_players?.length || 0} players</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold text-gradient mb-4">Match Schedule ({matches.length})</h2>
          <div className="space-y-4">
            {matches.map((match) => (
              <div key={match.id} className="glass-strong rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">
                        {new Date(match.match_date).toLocaleDateString()}
                      </span>
                      {match.completed && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          Completed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{match.team1?.name}</span>
                      <span className="text-2xl font-bold mx-4 text-gradient">
                        {match.team1_score} - {match.team2_score}
                      </span>
                      <span className="font-bold">{match.team2?.name}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
