import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Briefcase } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function HiringPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase.from('hiring_settings').select('is_active').single();
  const isActive = !!(settings as { is_active?: boolean } | null)?.is_active;

  if (!isActive) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              IIChE AVVU SC
            </Link>
            <Link href="/" className="text-gray-600 hover:text-blue-600">
              ← Home
            </Link>
          </div>
        </nav>
        <main className="max-w-3xl mx-auto px-4 py-16 text-center">
          <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Co-head hiring is closed</h1>
          <p className="text-gray-600">Check back when the chapter opens the next recruitment cycle.</p>
        </main>
      </div>
    );
  }

  const { data: campaign } = await supabase
    .from('hiring_positions')
    .select('id, title, description, requirements, hiring_year')
    .eq('is_system_generated', true)
    .eq('is_open', true)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <nav className="bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap justify-between gap-3 h-16 items-center">
          <Link href="/" className="text-xl font-bold text-indigo-600">
            IIChE AVVU SC
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/hiring/sign-up" className="text-indigo-600 font-medium">
              Create hiring account
            </Link>
            <Link href="/login?next=/hiring/apply" className="text-gray-600 hover:text-indigo-600">
              Sign in to apply
            </Link>
            <Link href="/" className="text-gray-500">
              Home
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <Briefcase className="w-14 h-14 text-indigo-600 mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Committee co-head recruitment</h1>
          <p className="text-lg text-gray-600">
            Each year we recruit co-heads across student committees. Create a hiring-only account, then submit one
            application with your top three committee choices. Shortlisted candidates are contacted for interviews.
          </p>
        </div>

        {campaign ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-8">
            <p className="text-sm text-indigo-600 font-semibold mb-2">
              {campaign.hiring_year ? `Recruitment ${campaign.hiring_year}` : 'Open campaign'}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{campaign.title}</h2>
            <p className="text-gray-700 whitespace-pre-wrap mb-4">{campaign.description}</p>
            {campaign.requirements && (
              <div className="text-sm text-gray-600 border-t border-gray-100 pt-4">
                <span className="font-semibold text-gray-800">Notes: </span>
                {campaign.requirements}
              </div>
            )}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/hiring/sign-up"
                className="flex-1 text-center bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700"
              >
                New here? Register for hiring
              </Link>
              <Link
                href="/hiring/apply"
                className="flex-1 text-center bg-white border-2 border-indigo-600 text-indigo-700 font-semibold py-3 rounded-xl hover:bg-indigo-50"
              >
                Already have an account — Apply
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-center text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-4">
            Hiring is marked active but the campaign record is not ready yet. Ask a hiring manager to open hiring once from
            the dashboard.
          </p>
        )}

        <p className="text-xs text-gray-500 text-center">
          Hiring accounts only see your application until a committee selects you; then you get full portal access as
          co-head.
        </p>
      </main>
    </div>
  );
}
