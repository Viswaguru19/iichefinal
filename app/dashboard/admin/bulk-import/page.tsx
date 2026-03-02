import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import BulkImportForm from '@/components/dashboard/BulkImportForm';

export default async function BulkImportPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || (profile as any).role !== 'super_admin') {
    redirect('/dashboard');
  }

  const { data: committees } = await supabase
    .from('committees')
    .select('*')
    .order('name');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Bulk Import Users</h1>
            <Link href="/dashboard/admin" className="text-gray-600 hover:text-blue-600">← Back</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BulkImportForm committees={(committees as any) || []} />
      </div>
    </div>
  );
}
