import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">IIChE AVVU</Link>
            <div className="flex gap-4">
              <Link href="/committees" className="text-gray-700 hover:text-blue-600">Committees</Link>
              <Link href="/events" className="text-gray-700 hover:text-blue-600">Events</Link>
              <Link href="/kickoff" className="text-gray-700 hover:text-blue-600">Kickoff</Link>
              <Link href="/hiring" className="text-gray-700 hover:text-blue-600">Hiring</Link>
              {user ? (
                <Link href="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Dashboard</Link>
              ) : (
                <Link href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Login</Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">IIChE AVVU Chapter</h1>
          <p className="text-2xl text-gray-600 mb-8">Indian Institute of Chemical Engineers</p>
          <div className="flex gap-4 justify-center">
            <Link href="/committees" className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700">Explore Committees</Link>
            <Link href="/events" className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-50 border-2 border-blue-600">View Events</Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">8+</div>
            <div className="text-gray-600">Active Committees</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">100+</div>
            <div className="text-gray-600">Active Members</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">50+</div>
            <div className="text-gray-600">Events Organized</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">About Us</h2>
          <p className="text-lg text-gray-600 text-center max-w-3xl mx-auto">
            The IIChE AVVU Chapter is dedicated to promoting excellence in chemical engineering education and practice. 
            We organize technical events, workshops, seminars, and cultural activities to enhance the overall development of our members.
          </p>
        </div>
      </main>
    </div>
  );
}
