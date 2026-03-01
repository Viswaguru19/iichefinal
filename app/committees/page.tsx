import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Users } from 'lucide-react';

export default async function CommitteesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const { data: committees } = await supabase
    .from('committees')
    .select('*')
    .eq('type', 'regular')
    .order('name');

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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Committees</h1>
          <p className="text-xl text-gray-600">
            Dedicated teams working together to make IIChE AVVU successful
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {committees?.map((committee) => (
            <Link
              key={committee.id}
              href={`/committees/${committee.id}`}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition p-6 group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">{committee.name}</h3>
              </div>
              {committee.description && (
                <p className="text-gray-600">{committee.description}</p>
              )}
            </Link>
          ))}
        </div>

        <div className="mt-12 bg-blue-50 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Executive Committee</h2>
          <p className="text-gray-600 mb-6">
            The governing body consisting of all committee heads and co-heads
          </p>
          <Link
            href="/committees/00000000-0000-0000-0000-000000000001"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            View Executive Committee
          </Link>
        </div>
      </main>
    </div>
  );
}
