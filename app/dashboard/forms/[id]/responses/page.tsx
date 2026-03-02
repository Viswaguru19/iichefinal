'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function FormResponsesPage() {
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canView, setCanView] = useState(false);
  const params = useParams();
  const supabase = createClient();

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, executive_role')
      .eq('id', user.id)
      .single();

    const hasAccess = 
      (profile as any)?.role === 'super_admin' ||
      ['committee_head', 'committee_cohead'].includes((profile as any)?.role || '') ||
      (profile as any)?.executive_role !== null;

    setCanView(hasAccess);

    if (hasAccess) {
      fetchData();
    } else {
      setLoading(false);
    }
  }

  async function fetchData() {
    const { data: formData } = await supabase
      .from('forms')
      .select('*')
      .eq('id', params.id)
      .single();

    const { data: fieldsData } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', params.id)
      .order('order_index');

    const { data: responsesData } = await supabase
      .from('form_responses')
      .select('*, user:profiles(name, email)')
      .eq('form_id', params.id)
      .order('submitted_at', { ascending: false });

    setForm(formData);
    setFields(fieldsData || []);
    setResponses(responsesData || []);
    setLoading(false);
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-gray-600 dark:text-gray-400">Loading...</div>
    </div>;
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">Only heads, co-heads, and executive members can view responses.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard/forms" className="text-blue-600 hover:text-blue-700">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{form?.title}</h1>
            <p className="text-gray-600 dark:text-gray-400">{responses.length} responses</p>
          </div>
        </div>

        <div className="space-y-6">
          {responses.map((response) => (
            <div key={response.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{response.user?.name}</p>
                  <p className="text-sm text-gray-500">{response.user?.email}</p>
                </div>
                <p className="text-sm text-gray-500">
                  {new Date(response.submitted_at).toLocaleString()}
                </p>
              </div>

              <div className="space-y-4">
                {fields.map((field) => (
                  <div key={field.id}>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {field.label}
                    </p>
                    <p className="text-gray-900 dark:text-white">
                      {Array.isArray(response.responses[field.id])
                        ? response.responses[field.id].join(', ')
                        : response.responses[field.id] || '-'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {responses.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No responses yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
