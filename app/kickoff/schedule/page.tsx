import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { format } from 'date-fns';

export default async function SchedulePage() {
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from('kickoff_matches')
    .select(`
      *,
      team1:kickoff_teams!kickoff_matches_team1_id_fkey(name),
      team2:kickoff_teams!kickoff_matches_team2_id_fkey(name)
    `)
    .order('match_date', { ascending: true });

  const groupMatches = (matches as any)?.filter((m: any) => m.round === 'group') || [];
  const knockoutMatches = (matches as any)?.filter((m: any) => m.round !== 'group') || [];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4">
        <Link href="/kickoff" className="text-blue-600 hover:text-blue-700 mb-6 inline-block">
          ← Back to Kickoff
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-8">Match Schedule & Live Scores</h1>

        {groupMatches.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Group Stage</h2>
            <div className="space-y-4">
              {groupMatches.map((match: any) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        )}

        {knockoutMatches.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Knockout Stage</h2>
            <div className="space-y-4">
              {knockoutMatches.map((match: any) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        )}

        {(!matches || matches.length === 0) && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg">No matches scheduled yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: any }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">
              {format(new Date(match.match_date), 'PPP p')}
            </span>
            {match.completed && (
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                Completed
              </span>
            )}
            {!match.completed && new Date(match.match_date) < new Date() && (
              <span className="bg-red-100 text-red-800 text-xs font-semibold px-3 py-1 rounded-full animate-pulse">
                Live
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-right">
              <h3 className="text-xl font-bold text-gray-900">{match.team1?.name}</h3>
            </div>
            <div className="text-center">
              <div className="bg-gray-100 rounded-lg py-3 px-6">
                <span className="text-3xl font-bold text-gray-900">
                  {match.team1_score}
                </span>
                <span className="text-2xl text-gray-400 mx-2">-</span>
                <span className="text-3xl font-bold text-gray-900">
                  {match.team2_score}
                </span>
              </div>
            </div>
            <div className="text-left">
              <h3 className="text-xl font-bold text-gray-900">{match.team2?.name}</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
