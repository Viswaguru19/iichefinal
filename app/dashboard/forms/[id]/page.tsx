'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Share2, Check } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function FormSubmitPage() {
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchForm();
  }, []);

  async function fetchForm() {
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

    setForm(formData);
    setFields(fieldsData || []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const responses: any = {};

    fields.forEach(field => {
      if (field.field_type === 'checkbox') {
        responses[field.id] = formData.getAll(field.id);
      } else {
        responses[field.id] = formData.get(field.id);
      }
    });

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('form_responses')
      .insert({
        form_id: params.id,
        user_id: user?.id,
        responses
      });

    if (error) {
      toast.error('Failed to submit form');
    } else {
      toast.success('Form submitted successfully');
      router.push('/dashboard/forms');
    }
    setSubmitting(false);
  }

  function copyLink() {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-gray-600 dark:text-gray-400">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/forms" className="text-blue-600 hover:text-blue-700">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{form?.title}</h1>
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {copied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
            {copied ? 'Copied!' : 'Share Link'}
          </button>
        </div>

        {form?.description && (
          <p className="text-gray-600 dark:text-gray-400 mb-6">{form.description}</p>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
          {fields.map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {field.label}
                {field.required && <span className="text-red-600 ml-1">*</span>}
              </label>

              {field.field_type === 'text' && (
                <input
                  type="text"
                  name={field.id}
                  required={field.required}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              )}

              {field.field_type === 'email' && (
                <input
                  type="email"
                  name={field.id}
                  required={field.required}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              )}

              {field.field_type === 'number' && (
                <input
                  type="number"
                  name={field.id}
                  required={field.required}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              )}

              {field.field_type === 'date' && (
                <input
                  type="date"
                  name={field.id}
                  required={field.required}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              )}

              {field.field_type === 'textarea' && (
                <textarea
                  name={field.id}
                  required={field.required}
                  rows={4}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              )}

              {field.field_type === 'dropdown' && (
                <select
                  name={field.id}
                  required={field.required}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select an option</option>
                  {field.options?.map((option: string, i: number) => (
                    <option key={i} value={option}>{option}</option>
                  ))}
                </select>
              )}

              {field.field_type === 'radio' && (
                <div className="space-y-2">
                  {field.options?.map((option: string, i: number) => (
                    <label key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={field.id}
                        value={option}
                        required={field.required}
                        className="rounded"
                      />
                      <span className="text-gray-700 dark:text-gray-300">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {field.field_type === 'checkbox' && (
                <div className="space-y-2">
                  {field.options?.map((option: string, i: number) => (
                    <label key={i} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name={field.id}
                        value={option}
                        className="rounded"
                      />
                      <span className="text-gray-700 dark:text-gray-300">{option}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}
