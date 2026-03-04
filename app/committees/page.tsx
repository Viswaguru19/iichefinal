import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Users } from 'lucide-react';

export default async function CommitteesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const { data: committees } = await supabase
    .from('committees')
    .select('*')
    .eq('type', 'regular')
    .order('name');

  // Get members separately
  const { data: allMembersRaw } = await supabase
    .from('committee_members')
    .select('committee_id, position, profiles(id, name, avatar_url)')
    .in('position', ['head', 'co_head']);

  // Resolve avatar URLs from storage paths so public site shows latest profile photos
  const allMembers =
    allMembersRaw?.map((m: any) => {
      let avatarUrl: string | null = null;
      if (m.profiles?.avatar_url) {
        const { data } = supabase.storage
          .from('avatars')
          .getPublicUrl(m.profiles.avatar_url);
        avatarUrl = data.publicUrl;
      }
      return {
        ...m,
        profiles: {
          ...m.profiles,
          avatar_url: avatarUrl,
        },
      };
    }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">IIChE AVVU</Link>
            <div className="flex gap-4">
              <Link href="/committees" className="text-blue-600 font-medium">Committees</Link>
              <Link href="/events" className="text-gray-700 hover:text-blue-600">Events</Link>
              <Link href="/hiring" className="text-gray-700 hover:text-blue-600">Hiring</Link>
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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Committees</h1>
          <p className="text-xl text-gray-600">
            Dedicated teams working together to make IIChE AVVU successful
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {committees?.map((committee: any) => {
            const members = allMembers?.filter((m: any) => m.committee_id === committee.id) || [];
            const heads = members.filter((m: any) => m.position === 'head');
            const coHeads = members.filter((m: any) => m.position === 'co_head');
            
            return (
              <Link
                key={committee.id}
                href={`/committees/${committee.id}`}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition p-6 block"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{committee.name}</h3>
                </div>
                {committee.description && (
                  <p className="text-gray-600 mb-4">{committee.description}</p>
                )}
                
                {heads.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2">HEADS</p>
                    <div className="flex flex-wrap gap-2">
                      {heads.map((member: any) => (
                        <div key={member.profiles.id} className="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1">
                          {member.profiles.avatar_url ? (
                            <img src={member.profiles.avatar_url} alt={member.profiles.name} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                              {member.profiles.name.charAt(0)}
                            </div>
                          )}
                          <span className="text-sm text-gray-700">{member.profiles.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {coHeads.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">CO-HEADS</p>
                    <div className="flex flex-wrap gap-2">
                      {coHeads.map((member: any) => (
                        <div key={member.profiles.id} className="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1">
                          {member.profiles.avatar_url ? (
                            <img src={member.profiles.avatar_url} alt={member.profiles.name} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">
                              {member.profiles.name.charAt(0)}
                            </div>
                          )}
                          <span className="text-sm text-gray-700">{member.profiles.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
