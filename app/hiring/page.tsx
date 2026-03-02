import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Briefcase, Calendar, MapPin } from 'lucide-react';

export default async function HiringPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from('hiring_settings')
    .select('*')
    .single();

  const isActive = (settings as any)?.is_active || false;

  if (!isActive) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <Link href="/" className="text-2xl font-bold text-blue-600">IIChE AVVU</Link>
              <Link href="/" className="text-gray-600 hover:text-blue-600">← Back to Home</Link>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <Briefcase className="w-20 h-20 text-gray-400 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Hiring Not Active</h1>
            <p className="text-xl text-gray-600">Check back later for new opportunities!</p>
          </div>
        </main>
      </div>
    );
  }

  const { data: positions } = await supabase
    .from('hiring_positions')
    .select('*')
    .eq('is_open', true)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">IIChE AVVU</Link>
            <div className="flex gap-4">
              <Link href="/committees" className="text-gray-700 hover:text-blue-600">Committees</Link>
              <Link href="/events" className="text-gray-700 hover:text-blue-600">Events</Link>
              <Link href="/hiring" className="text-blue-600 font-medium">Hiring</Link>
              <Link href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Login</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <Briefcase className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Join Our Team</h1>
          <p className="text-xl text-gray-600">We're hiring! Check out our open positions</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(positions as any)?.map((position: any) => (
            <div key={position.id} className="bg-white rounded-xl shadow-md hover:shadow-xl transition p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{position.title}</h3>
              <p className="text-gray-600 mb-4">{position.description}</p>
              
              <div className="space-y-2 text-sm text-gray-500 mb-4">
                {position.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{position.location}</span>
                  </div>
                )}
                {position.deadline && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Apply by: {new Date(position.deadline).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {position.requirements && (
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Requirements:</h4>
                  <p className="text-sm text-gray-600">{position.requirements}</p>
                </div>
              )}

              <Link
                href={`/hiring/apply/${position.id}`}
                className="block w-full bg-blue-600 text-white text-center px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Apply Now
              </Link>
            </div>
          ))}
        </div>

        {(!positions || (positions as any).length === 0) && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No open positions at the moment</p>
          </div>
        )}
      </main>
    </div>
  );
}
