'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function RegisterTeamPage() {
  const [teamName, setTeamName] = useState('');
  const [players, setPlayers] = useState<string[]>(['', '', '', '', '', '', '', '', '', '', '']);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handlePlayerChange = (index: number, value: string) => {
    const newPlayers = [...players];
    newPlayers[index] = value;
    setPlayers(newPlayers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const filledPlayers = players.filter(p => p.trim() !== '');
      if (filledPlayers.length < 7) {
        toast.error('Minimum 7 players required');
        setLoading(false);
        return;
      }

      let paymentUrl = null;
      if (paymentFile) {
        const fileExt = paymentFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('payments')
          .upload(fileName, paymentFile);

        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('payments')
          .getPublicUrl(fileName);
        
        paymentUrl = publicUrl;
      }

      const { data: team, error: teamError } = await (supabase as any)
        .from('kickoff_teams')
        .insert({
          name: teamName,
          payment_screenshot_url: paymentUrl,
          approved: false,
          created_by: user?.id,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      const playerInserts = filledPlayers.map((name, index) => ({
        team_id: team.id,
        name,
        jersey_number: index + 1,
      }));

      const { error: playersError } = await (supabase as any)
        .from('kickoff_players')
        .insert(playerInserts);

      if (playersError) throw playersError;

      toast.success('Team registered successfully! Awaiting approval.');
      router.push('/kickoff');
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <Link href="/kickoff" className="text-blue-600 hover:text-blue-700 mb-6 inline-block">
          ← Back to Kickoff
        </Link>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Register Your Team</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team Name *
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter team name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Players (Minimum 7, Maximum 11) *
              </label>
              <div className="space-y-2">
                {players.map((player, index) => (
                  <input
                    key={index}
                    type="text"
                    value={player}
                    onChange={(e) => handlePlayerChange(index, e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`Player ${index + 1}${index < 7 ? ' *' : ''}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Screenshot
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                Upload payment confirmation screenshot
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Registering...' : 'Register Team'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
