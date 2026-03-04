import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function PublicProfilePage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, role, executive_role')
    .eq('id', params.id)
    .single();

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Profile not found.</p>
      </div>
    );
  }

  let avatarUrl: string | null = null;
  if (profile.avatar_url) {
    const { data } = supabase.storage.from('avatars').getPublicUrl(profile.avatar_url);
    avatarUrl = data.publicUrl;
  }

  const roleLabel =
    profile.executive_role?.replace(/_/g, ' ').toUpperCase() ||
    profile.role?.replace(/_/g, ' ').toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              IIChE AVVU
            </Link>
            <Link href="/committees" className="text-gray-700 hover:text-blue-600">
              Committees
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col md:flex-row gap-8">
          <div className="flex flex-col items-center md:items-start">
            <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden mb-4">
              {avatarUrl ? (
                <img src={avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-blue-600">
                  {profile.name?.charAt(0)}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 text-center md:text-left">
              {profile.name}
            </h1>
            {roleLabel && (
              <p className="mt-2 text-sm font-semibold text-blue-700">{roleLabel}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">{profile.email}</p>
          </div>

          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              About {profile.name?.split(' ')[0] || 'Member'}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              This member has not added a description yet.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

