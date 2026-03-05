import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Users, Crown, Calendar } from 'lucide-react';
import HeroSlideshow from '@/components/home/HeroSlideshow';
import DynamicLogo from '@/components/DynamicLogo';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get slideshow photos
  const { data: slideshowPhotos } = await supabase
    .from('homepage_slideshow')
    .select('*')
    .eq('is_active', true)
    .eq('approval_status', 'approved')
    .order('display_order');

  // Convert storage paths to public URLs
  const slidesWithUrls = slideshowPhotos?.map((slide: any) => {
    const { data } = supabase.storage
      .from('slideshow-photos')
      .getPublicUrl(slide.photo_url);
    console.log('Slideshow photo:', {
      id: slide.id,
      filename: slide.photo_url,
      publicUrl: data.publicUrl
    });
    return {
      ...slide,
      photo_url: data.publicUrl
    };
  }) || [];

  // Get committees
  const { data: committees } = await supabase
    .from('committees')
    .select('*')
    .eq('type', 'regular')
    .order('name');

  // Get executive committee members (ONLY those with executive_role assigned)
  const { data: executiveMembersRaw } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, executive_role')
    .not('executive_role', 'is', null)
    .order('executive_role');

  // Resolve avatar URLs from storage paths
  const executiveMembers =
    executiveMembersRaw?.map((member: any) => {
      let avatarUrl: string | null = null;
      if (member.avatar_url) {
        const { data } = supabase.storage
          .from('avatars')
          .getPublicUrl(member.avatar_url);
        avatarUrl = data.publicUrl;
      }
      return { ...member, avatar_url: avatarUrl };
    }) || [];

  // Get upcoming events (only approved/active events)
  const { data: upcomingEvents } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'active')
    .gte('date', new Date().toISOString())
    .order('date')
    .limit(5);

  // Get forms to show on homepage
  const { data: homepageForms } = await supabase
    .from('forms')
    .select('*')
    .eq('is_active', true)
    .eq('show_on_homepage', true)
    .order('created_at', { ascending: false })
    .limit(3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <nav className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center gap-3">
              <DynamicLogo width={40} height={40} />
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">IIChE AVVU</span>
            </Link>
            <div className="flex gap-6">
              <Link href="/committees" className="text-gray-700 hover:text-blue-600 transition font-medium">Committees</Link>
              <Link href="/events" className="text-gray-700 hover:text-blue-600 transition font-medium">Events</Link>
              <Link href="/kickoff" className="text-gray-700 hover:text-blue-600 transition font-medium">Kickoff</Link>
              <Link href="/hiring" className="text-gray-700 hover:text-blue-600 transition font-medium">Hiring</Link>
              {user ? (
                <Link href="/dashboard" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-full hover:shadow-lg transition-all hover:scale-105">Dashboard</Link>
              ) : (
                <Link href="/login" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-full hover:shadow-lg transition-all hover:scale-105">Login</Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Slideshow */}
      <div className="max-w-7xl mx-auto">
        <HeroSlideshow slides={slidesWithUrls} />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center hover:shadow-2xl transition-all hover:scale-105">
            <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">8+</div>
            <div className="text-gray-700 font-medium">Active Committees</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center hover:shadow-2xl transition-all hover:scale-105">
            <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">100+</div>
            <div className="text-gray-700 font-medium">Active Members</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center hover:shadow-2xl transition-all hover:scale-105">
            <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">50+</div>
            <div className="text-gray-700 font-medium">Events Organized</div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-10 md:p-14 mb-16">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-8 text-center">About IIChE AVVU</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700 leading-relaxed">
              Welcome to the Indian Institute of Chemical Engineers (IIChE) Student Chapter at Amrita Vishwa Vidyapeetham.
              We're a vibrant community of chemical engineering enthusiasts, fostering innovation and excellence in our field.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Founded in February 2023, our chapter has grown to include 10 executive committees with 22 dedicated members.
              Together, we're shaping the future of chemical engineering through collaboration, learning, and hands-on experience.
            </p>
          </div>
        </div>

        {/* Committees Section */}
        <div className="mt-16">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Users className="w-8 h-8 text-blue-600" />
            <h2 className="text-3xl font-bold text-gray-900">Our Committees</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {committees?.map((committee: any) => (
              <Link key={committee.id} href={`/committees/${committee.id}`} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{committee.name}</h3>
                <p className="text-sm text-gray-600">{committee.description}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Executive Committee Section */}
        <div className="mt-16">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Crown className="w-8 h-8 text-yellow-600" />
            <h2 className="text-3xl font-bold text-gray-900">Executive Committee</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {executiveMembers?.map((member: any) => (
                <Link
                  key={member.id}
                  href={`/profile/${member.id}`}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition block"
                >
                  {member.avatar_url && (
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
                    />
                  )}
                  {!member.avatar_url && (
                    <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-blue-100 flex items-center justify-center">
                      <span className="text-2xl font-bold text-blue-600">
                        {member.name?.charAt(0)}
                      </span>
                    </div>
                  )}
                  <p className="text-lg font-bold text-gray-900 text-center">{member.name}</p>
                  <p className="text-sm text-gray-600 mt-1 text-center">{member.email}</p>
                  <div className="mt-3 flex justify-center">
                    <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                      {member.executive_role?.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Events Section */}
        <div className="mt-16 mb-16">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Calendar className="w-8 h-8 text-green-600" />
            <h2 className="text-3xl font-bold text-gray-900">Upcoming Events</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {upcomingEvents && upcomingEvents.length > 0 ? (
              <div className="space-y-6">
                {upcomingEvents.map((event: any) => (
                  <div key={event.id} className="border-l-4 border-blue-500 pl-6 py-4 hover:bg-gray-50 transition">
                    <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                    <p className="text-gray-600 mt-2">{event.description}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      📅 {new Date(event.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {event.location && (
                      <p className="text-sm text-gray-500">📍 {event.location}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-8 text-lg">No upcoming events at the moment</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
