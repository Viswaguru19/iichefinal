import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Mail, Phone, User, Award, Calendar, ArrowLeft } from 'lucide-react';
import DashboardAtmosphere from '@/components/react-bits/DashboardAtmosphere';
import GradientText from '@/components/react-bits/GradientText';

export default async function PublicProfilePage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!profile) {
    notFound();
  }

  const { data: committeeMemberships } = await supabase
    .from('committee_members')
    .select(`
      *,
      committee:committees(id, name, type)
    `)
    .eq('user_id', params.id);

  let avatarUrl: string | null = null;
  if (profile.avatar_url) {
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(profile.avatar_url);
    avatarUrl = data.publicUrl;
  }

  const socialLinks = (profile as any).social_links || {};

  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      <DashboardAtmosphere meshOpacity="opacity-50" />

      <nav className="premium-panel relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center gap-3">
            <Link href="/" className="text-2xl font-bold shrink-0">
              <GradientText
                className="!mx-0 text-xl sm:text-2xl font-bold"
                colors={['#0f766e', '#2563eb', '#0891b2', '#0f766e']}
                animationSpeed={9}
              >
                IIChE AVVU SC
              </GradientText>
            </Link>
            <div className="flex gap-3 sm:gap-4 items-center">
              <Link href="/committees" className="text-gray-700 hover:text-teal-700 text-sm font-medium hidden sm:inline">Committees</Link>
              <Link href="/events" className="text-gray-700 hover:text-teal-700 text-sm font-medium hidden sm:inline">Events</Link>
              {isLoggedIn ? (
                <Link href="/dashboard" className="btn-gradient-blue text-white px-4 py-2 rounded-xl text-sm font-semibold">Dashboard</Link>
              ) : (
                <Link href="/login" className="btn-gradient-blue text-white px-4 py-2 rounded-xl text-sm font-semibold">Login</Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <Link
          href="/"
          className="text-teal-700 hover:text-teal-800 mb-6 inline-flex items-center gap-2 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="premium-panel rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 h-32" />

          <div className="px-6 sm:px-8 pb-8">
            <div className="flex justify-center -mt-24 mb-6">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={profile.name}
                  className="w-48 h-48 rounded-2xl object-cover border-8 border-white shadow-2xl"
                />
              ) : (
                <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center text-white text-7xl font-bold border-8 border-white shadow-2xl">
                  {profile.name?.charAt(0)}
                </div>
              )}
            </div>

            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{profile.name}</h1>

              {(profile as any).executive_role && (
                <div className="flex justify-center mb-3">
                  <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-6 py-2 rounded-full font-semibold text-sm flex items-center gap-2 shadow-md shadow-amber-500/20">
                    <Award className="w-4 h-4" />
                    {String((profile as any).executive_role).replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
              )}

              {profile.role && (
                <p className="text-gray-600 text-lg capitalize">{profile.role}</p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {(profile.show_email || isLoggedIn) && profile.email && (
                <div className="flex items-center gap-3 p-4 bg-white/60 rounded-xl border border-white/80">
                  <Mail className="w-5 h-5 text-teal-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Email</p>
                    <a href={`mailto:${profile.email}`} className="text-gray-900 hover:text-teal-700 break-all">
                      {profile.email}
                    </a>
                  </div>
                </div>
              )}

              {(profile.show_phone || isLoggedIn) && (profile as any).phone && (
                <div className="flex items-center gap-3 p-4 bg-white/60 rounded-xl border border-white/80">
                  <Phone className="w-5 h-5 text-teal-600 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Phone</p>
                    <a href={`tel:${(profile as any).phone}`} className="text-gray-900 hover:text-teal-700">
                      {(profile as any).phone}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {((profile as any).description || (profile as any).bio) && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-6 h-6 text-teal-600" />
                  About
                </h2>
                <div className="bg-white/60 rounded-xl p-6 border border-white/80">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {(profile as any).description || (profile as any).bio}
                  </p>
                </div>
              </div>
            )}

            {committeeMemberships && committeeMemberships.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Award className="w-6 h-6 text-teal-600" />
                  Committee Roles
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {committeeMemberships.map((membership: any) => (
                    <Link
                      key={membership.id}
                      href={`/committees/${membership.committee?.id}`}
                      className="bg-gradient-to-r from-teal-50 to-sky-50 rounded-xl p-4 hover:shadow-lg transition border border-teal-100"
                    >
                      <h3 className="font-bold text-gray-900 mb-1">
                        {membership.committee?.name}
                      </h3>
                      <p className="text-sm text-teal-700 font-medium capitalize">
                        {String(membership.position || '').replace(/_/g, ' ')}
                      </p>
                      {membership.designation && (
                        <p className="text-sm text-gray-600 mt-1">{membership.designation}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(socialLinks).length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect</h2>
                <div className="flex flex-wrap gap-3">
                  {socialLinks.linkedin && (
                    <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition">
                      LinkedIn
                    </a>
                  )}
                  {socialLinks.github && (
                    <a href={socialLinks.github} target="_blank" rel="noopener noreferrer" className="bg-gray-800 text-white px-6 py-2 rounded-xl hover:bg-gray-900 transition">
                      GitHub
                    </a>
                  )}
                  {socialLinks.twitter && (
                    <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="bg-sky-500 text-white px-6 py-2 rounded-xl hover:bg-sky-600 transition">
                      Twitter
                    </a>
                  )}
                  {socialLinks.instagram && (
                    <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="bg-pink-600 text-white px-6 py-2 rounded-xl hover:bg-pink-700 transition">
                      Instagram
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-200/80 text-center">
              <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4" />
                Member since {new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
