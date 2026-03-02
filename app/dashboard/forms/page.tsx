'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, FileText } from 'lucide-react';
import Link from 'next/link';

export default function FormsPage() {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchForms();
  }, []);

  async function fetchForms() {
    const { data } = await supabase
      .from('forms')
      .select('*, creator:profiles(name)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    setForms(data || []);
    setLoading(false);
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-gray-600 dark:text-gray-400">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Forms</h1>
          <a
            href="https://forms.microsoft.com/Pages/CreateForm.aspx"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Create Form (Microsoft Forms)
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {forms.map((form) => (
            <Link
              key={form.id}
              href={`/dashboard/forms/${form.id}`}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition"
            >
              <div className="flex items-start gap-4">
                <FileText className="w-8 h-8 text-blue-600" />
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">{form.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{form.description}</p>
                  <p className="text-xs text-gray-500">Created by {form.creator?.name}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {forms.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No forms yet. Create your first form!</p>
          </div>
        )}
      </div>
    </div>
  );
}
