import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function TestPage() {
  const supabase = await createClient();

  let status = {
    auth: 'Not checked',
    profiles: 'Not checked',
    events: 'Not checked',
    committees: 'Not checked',
  };

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    status.auth = user ? `✅ User: ${user.email}` : authError ? `❌ Error: ${authError.message}` : '❌ No user';
  } catch (e: any) {
    status.auth = `❌ Exception: ${e.message}`;
  }

  try {
    const { data, error } = await supabase.from('profiles').select('count');
    status.profiles = error ? `❌ Error: ${error.message}` : `✅ Connected (${data?.length || 0} rows)`;
  } catch (e: any) {
    status.profiles = `❌ Exception: ${e.message}`;
  }

  try {
    const { data, error } = await supabase.from('events').select('count');
    status.events = error ? `❌ Error: ${error.message}` : `✅ Connected (${data?.length || 0} rows)`;
  } catch (e: any) {
    status.events = `❌ Exception: ${e.message}`;
  }

  try {
    const { data, error } = await supabase.from('committees').select('count');
    status.committees = error ? `❌ Error: ${error.message}` : `✅ Connected (${data?.length || 0} rows)`;
  } catch (e: any) {
    status.committees = `❌ Exception: ${e.message}`;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6">Database Connection Test</h1>
        
        <div className="space-y-4">
          <div className="border-b pb-4">
            <h2 className="font-bold text-lg mb-2">Environment Variables</h2>
            <p className="text-sm">URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</p>
            <p className="text-sm">Anon Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</p>
            <p className="text-sm">Service Key: {process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}</p>
          </div>

          <div className="border-b pb-4">
            <h2 className="font-bold text-lg mb-2">Authentication</h2>
            <p className="text-sm">{status.auth}</p>
          </div>

          <div className="border-b pb-4">
            <h2 className="font-bold text-lg mb-2">Database Tables</h2>
            <p className="text-sm">Profiles: {status.profiles}</p>
            <p className="text-sm">Events: {status.events}</p>
            <p className="text-sm">Committees: {status.committees}</p>
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <a href="/login" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Go to Login
          </a>
          <a href="/" className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
            Go to Home
          </a>
        </div>
      </div>
    </div>
  );
}
