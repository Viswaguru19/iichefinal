import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Crown, Star, User } from 'lucide-react';
import MemberCardClient from '@/components/MemberCardClient';

export default async function CommitteeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const { data: committee } = await supabase
    .from('committees')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!committee) {
    notFound();
  }

  const { data: members } = await supabase
    .from('committee_members')
    .select(`
      *,
      profile:profiles(id, name, email, avatar_url)
    `)
    .eq('committee_id', params.id)
    .order('position');

  const heads = members?.filter(m => m.position === 'head') || [];
  const coHeads = members?.filter(m => m.position === 'co_head') || [];
  const regularMembers = members?.filter(m => m.position === 'member') || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">IIChE AVVU</Link>
            <div className="flex gap-4">
              <Link href="/committees" className="text-blue-600 font-medium">Committees</Link>
              <Link href="/events" className="text-gray-700 hover:text-blue-600">Events</Link>
              <Link href="/kickoff" className="text-gray-700 hover:text-blue-600">Kickoff</Link>
              {isLoggedIn ? (
                <Link href="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Dashboard</Link>
              ) : (
                <Link href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Login</Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/committees" className="text-blue-600 hover:text-blue-700 mb-6 inline-block">
          ← Back to Committees
        </Link>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{committee.name}</h1>
          {committee.description && (
            <p className="text-xl text-gray-600">{committee.description}</p>
          )}
        </div>

        {heads.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Crown className="w-6 h-6 text-yellow-500" />
              Committee Head{heads.length > 1 ? 's' : ''}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {heads.map((member) => (
                <MemberCardClient key={member.id} member={member} />
              ))}
            </div>
          </div>
        )}

        {coHeads.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Star className="w-6 h-6 text-blue-500" />
              Co-Head{coHeads.length > 1 ? 's' : ''}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coHeads.map((member) => (
                <MemberCardClient key={member.id} member={member} />
              ))}
            </div>
          </div>
        )}

        {regularMembers.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-6 h-6 text-gray-500" />
              Members
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {regularMembers.map((member) => (
                <MemberCardClient key={member.id} member={member} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
