import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Trophy, Users, Calendar, Award } from 'lucide-react';

export default async function KickoffPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from('tournament_settings')
    .select('*')
    .single();

  const isActive = settings?.is_active || false;

  if (!isActive) {
    // Show past tournament results
    const { data: pastMatches } = await supabase
      .from('kickoff_matches')
      .select(`
        *,
        team1:kickoff_teams!kickoff_matches_team1_id_fkey(name),
        team2:kickoff_teams!kickoff_matches_team2_id_fkey(name),
        winner:kickoff_teams!kickoff_matches_winner_team_id_fkey(name)
      `)
      .eq('completed', true)
      .order('match_date', { ascending: false })
      .limit(10);

    const { data: winner } = await supabase
      .from('kickoff_matches')
      .select(`
        winner:kickoff_teams!kickoff_matches_winner_team_id_fkey(name)
      `)
      .eq('round', 'final')
      .eq('completed', true)
      .order('match_date', { ascending: false })
      .limit(1)
      .single();

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <Link href="/" className="text-2xl font-bold text-blue-600">IIChE AVVU</Link>
              <div className="flex gap-4">
                <Link href="/committees" className="text-gray-700 hover:text-blue-600">Committees</Link>
                <Link href="/events" className="text-gray-700 hover:text-blue-600">Events</Link>
                <Link href="/kickoff" className="text-blue-600 font-medium">Kickoff</Link>
                <Link href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Login</Link>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-5xl font-bold text-gray-900 mb-4">Kickoff Tournament</h1>
            <div className="inline-block bg-red-100 text-red-800 px-6 py-3 rounded-full text-lg font-semibold mb-4">
              Tournament Not Active
            </div>
            <p className="text-xl text-gray-600">
              Check back when the next tournament begins!
            </p>
          </div>

          {winner && (
            <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl shadow-2xl p-12 mb-12 text-center">
              <Award className="w-16 h-16 text-white mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-2">Last Tournament Champion</h2>
              <p className="text-5xl font-bold text-white">{winner.winner?.name}</p>
            </div>
          )}

          {pastMatches && pastMatches.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Matches</h2>
              <div className="space-y-4">
                {pastMatches.map((match) => (
                  <div key={match.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                        <div className="text-right">
                          <span className={`font-bold ${match.winner_team_id === match.team1_id ? 'text-green-600' : 'text-gray-900'}`}>
                            {match.team1?.name}
                          </span>
                        </div>
                        <div className="text-center bg-gray-100 rounded-lg py-2">
                          <span className="text-2xl font-bold">
                            {match.team1_score} - {match.team2_score}
                          </span>
                        </div>
                        <div className="text-left">
                          <span className={`font-bold ${match.winner_team_id === match.team2_id ? 'text-green-600' : 'text-gray-900'}`}>
                            {match.team2?.name}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 text-center mt-2">
                      {new Date(match.match_date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Active tournament - show registration and schedule
  const { data: teams, count } = await supabase
    .from('kickoff_teams')
    .select('*, kickoff_players(count)', { count: 'exact' })
    .eq('approved', true);

  const { data: matches } = await supabase
    .from('kickoff_matches')
    .select('*')
    .limit(5)
    .order('match_date', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">IIChE AVVU</Link>
            <div className="flex gap-4">
              <Link href="/committees" className="text-gray-700 hover:text-blue-600">Committees</Link>
              <Link href="/events" className="text-gray-700 hover:text-blue-600">Events</Link>
              <Link href="/kickoff" className="text-blue-600 font-medium">Kickoff</Link>
              <Link href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Login</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Kickoff Tournament</h1>
          <div className="inline-block bg-green-100 text-green-800 px-6 py-3 rounded-full text-lg font-semibold mb-4 animate-pulse">
            🔴 LIVE - Tournament Active
          </div>
          <p className="text-xl text-gray-600">Annual Football Championship - IIChE AVVU</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <Users className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-3xl font-bold text-gray-900 mb-2">{count || 0}</h3>
            <p className="text-gray-600">Registered Teams</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <Calendar className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-3xl font-bold text-gray-900 mb-2">{matches?.length || 0}</h3>
            <p className="text-gray-600">Matches Played</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <Trophy className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <h3 className="text-3xl font-bold text-gray-900 mb-2">Live</h3>
            <p className="text-gray-600">Tournament Status</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Link
            href="/kickoff/register"
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-lg p-8 hover:shadow-xl transition group"
          >
            <h3 className="text-2xl font-bold mb-2 group-hover:scale-105 transition">Register Your Team</h3>
            <p className="text-blue-100">Join the tournament and compete for glory</p>
          </Link>
          <Link
            href="/kickoff/schedule"
            className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl shadow-lg p-8 hover:shadow-xl transition group"
          >
            <h3 className="text-2xl font-bold mb-2 group-hover:scale-105 transition">View Schedule</h3>
            <p className="text-green-100">Check match fixtures and live scores</p>
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Registered Teams</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams?.map((team) => (
              <div key={team.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition">
                <h3 className="font-bold text-gray-900">{team.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {team.kickoff_players?.[0]?.count || 0} players
                </p>
              </div>
            ))}
          </div>
          {(!teams || teams.length === 0) && (
            <p className="text-gray-500 text-center py-8">No teams registered yet</p>
          )}
        </div>
      </main>
    </div>
  );
}
