import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { MessageSquare, Crown, Star } from 'lucide-react';
import ChatButton from '@/components/ChatButton';
import ExecutiveMemberCard from '@/components/ExecutiveMemberCard';

export default async function ExecutiveCommitteePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const { data: executiveMembers } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, executive_role')
    .not('executive_role', 'is', null)
    .order('executive_role');

  const { data: committeeHeads, error } = await supabase
    .from('committee_members')
    .select(`
      id,
      position,
      user_id,
      committee_id,
      profiles!committee_members_user_id_fkey(id, name, email),
      committees!committee_members_committee_id_fkey(name)
    `)
    .in('position', ['head', 'co_head'])
    .neq('committee_id', '00000000-0000-0000-0000-000000000001');

  console.log('Committee heads error:', error);
  console.log('Committee heads count:', committeeHeads?.length);
  console.log('First member:', committeeHeads?.[0]);

  const roleOrder: any = {
    'secretary': 1,
    'associate_secretary': 2,
    'joint_secretary': 3,
    'joint_secretary_associate': 4,
    'treasurer': 5,
    'treasurer_associate': 6,
    'secretary_associate': 7,
  };

  const sortedMembers = (executiveMembers as any)?.sort((a: any, b: any) =>
    (roleOrder[a.executive_role] || 99) - (roleOrder[b.executive_role] || 99)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">IIChE AVVU</Link>
            <div className="flex gap-4">
              <Link href="/committees" className="text-gray-700 hover:text-blue-600">Committees</Link>
              <Link href="/events" className="text-gray-700 hover:text-blue-600">Events</Link>
              <Link href="/executive" className="text-blue-600 font-medium">Executive</Link>
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
        <div className="text-center mb-12">
          <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Executive Committee</h1>
          <p className="text-xl text-gray-600">The governing body of IIChE AVVU</p>
        </div>

        {sortedMembers && sortedMembers.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Executive Roles</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedMembers.map((member: any) => (
                <ExecutiveMemberCard key={member.id} member={member} showChat={!!user} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
