import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Mail, Phone, User, Award, Calendar, ArrowLeft } from 'lucide-react';

export default async function PublicProfilePage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  // Get profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!profile) {
    notFound();
  }

  // Get committee memberships
  const { data: committeeMemberships } = await supabase
    .from('committee_members')
    .select(`
      *,
      committee:committees(id, name, type)
    `)
    .eq('user_id', params.id);

  // Get avatar URL
  let avatarUrl: string | null = null;
  if (profile.avatar_url) {
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(profile.avatar_url);
    avatarUrl = data.publicUrl;
  }

  // Parse social links
  const socialLinks = profile.social_links || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">IIChE AVVU</Link>
            <div className="flex gap-4">
              <Link href="/committees" className="text-gray-700 hover:text-blue-600">Committees</Link>
              <Link href="/events" className="text-gray-700 hover:text-blue-600">Events</Link>
              {isLoggedIn ? (
                <Link href="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Dashboard</Link>
              ) : (
                <Link href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Login</Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-700 mb-6 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-32"></div>

          {/* Profile Content */}
          <div className="px-8 pb-8">
            {/* Profile Photo - Centered and overlapping header */}
            <div className="flex justify-center -mt-24 mb-6">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={profile.name}
                  className="w-48 h-48 rounded-lg object-cover border-8 border-white shadow-2xl"
                />
              ) : (
                <div className="w-48 h-48 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-7xl font-bold border-8 border-white shadow-2xl">
                  {profile.name?.charAt(0)}
                </div>
              )}
            </div>

            {/* Name and Role */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{profile.name}</h1>

              {profile.executive_role && (
                <div className="flex justify-center mb-3">
                  <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-6 py-2 rounded-full font-semibold text-sm flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    {profile.executive_role.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
              )}

              {profile.role && (
                <p className="text-gray-600 text-lg capitalize">{profile.role}</p>
              )}
            </div>

            {/* Contact Information */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {(profile.show_email || isLoggedIn) && profile.email && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Email</p>
                    <a href={`mailto:${profile.email}`} className="text-gray-900 hover:text-blue-600">
                      {profile.email}
                    </a>
                  </div>
                </div>
              )}

              {(profile.show_phone || isLoggedIn) && profile.phone && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <Phone className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Phone</p>
                    <a href={`tel:${profile.phone}`} className="text-gray-900 hover:text-blue-600">
                      {profile.phone}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {profile.description && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-6 h-6 text-blue-600" />
                  About
                </h2>
                <div className="bg-gray-50 rounded-lg p-6">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {profile.description}
                  </p>
                </div>
              </div>
            )}

            {/* Committee Memberships */}
            {committeeMemberships && committeeMemberships.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Award className="w-6 h-6 text-blue-600" />
                  Committee Roles
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {committeeMemberships.map((membership: any) => (
                    <Link
                      key={membership.id}
                      href={`/committees/${membership.committee.id}`}
                      className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 hover:shadow-lg transition border border-blue-100"
                    >
                      <h3 className="font-bold text-gray-900 mb-1">
                        {membership.committee.name}
                      </h3>
                      <p className="text-sm text-blue-600 font-medium capitalize">
                        {membership.position.replace(/_/g, ' ')}
                      </p>
                      {membership.designation && (
                        <p className="text-sm text-gray-600 mt-1">{membership.designation}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Social Links */}
            {Object.keys(socialLinks).length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect</h2>
                <div className="flex flex-wrap gap-3">
                  {socialLinks.linkedin && (
                    <a
                      href={socialLinks.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                      LinkedIn
                    </a>
                  )}
                  {socialLinks.github && (
                    <a
                      href={socialLinks.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition"
                    >
                      GitHub
                    </a>
                  )}
                  {socialLinks.twitter && (
                    <a
                      href={socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-sky-500 text-white px-6 py-2 rounded-lg hover:bg-sky-600 transition"
                    >
                      Twitter
                    </a>
                  )}
                  {socialLinks.instagram && (
                    <a
                      href={socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-pink-600 text-white px-6 py-2 rounded-lg hover:bg-pink-700 transition"
                    >
                      Instagram
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Member Since */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
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
