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
    console.log('Fetching form with ID:', params.id);

    const { data: formData, error: formError } = await supabase
      .from('forms')
      .select('*')
      .eq('id', params.id)
      .single();

    console.log('Form data:', formData);
    console.log('Form error:', formError);

    if (formError) {
      console.error('Error fetching form:', formError);
      toast.error('Failed to load form');
      setLoading(false);
      return;
    }

    // Fields are stored in the JSONB 'fields' column
    const fieldsData = formData?.fields || [];
    console.log('Fields from JSONB:', fieldsData);
    console.log('Number of fields:', fieldsData.length);

    setForm(formData);
    setFields(fieldsData);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const responses: any = {};
    const { data: { user } } = await supabase.auth.getUser();

    // Process each field
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const fieldKey = `field_${i}`; // Use index as key

      if (field.field_type === 'checkbox') {
        responses[field.label] = formData.getAll(fieldKey);
      } else if (field.field_type === 'file') {
        const file = formData.get(fieldKey) as File;
        if (file && file.size > 0) {
          // Upload file to storage
          const fileExt = file.name.split('.').pop();
          const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(fileName, file);

          if (uploadError) {
            toast.error(`Failed to upload ${field.label}`);
            setSubmitting(false);
            return;
          }

          // Store the file path in responses
          responses[field.label] = fileName;
        }
      } else {
        responses[field.label] = formData.get(fieldKey);
      }
    }

    const { error } = await supabase
      .from('form_responses')
      .insert({
        form_id: params.id,
        user_id: user?.id,
        responses
      });

    if (error) {
      console.error('Form submission error:', error);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Microsoft Forms Header */}
        <div className="bg-white rounded-t-xl border-t-4 border-purple-600 shadow-lg p-8 mb-1">
          <div className="flex items-center justify-between mb-4">
            <Link href="/dashboard/forms" className="text-purple-600 hover:text-purple-700">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div className="flex gap-2">
              <Link
                href={`/dashboard/forms/${params.id}/responses`}
                className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium px-4 py-2 border border-purple-600 rounded-lg"
              >
                View Responses
              </Link>
              <button
                onClick={copyLink}
                className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
              >
                {copied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                {copied ? 'Copied!' : 'Share'}
              </button>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{form?.title}</h1>
          {form?.description && (
            <p className="text-gray-600 text-lg">{form.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-1">
          {fields.length === 0 && (
            <div className="bg-white shadow-md p-8 rounded-xl text-center">
              <p className="text-gray-600 text-lg mb-4">
                This form has no fields yet.
              </p>
              <p className="text-gray-500 text-sm">
                The form creator needs to add fields to this form before it can be filled out.
              </p>
            </div>
          )}

          {fields.map((field, index) => (
            <div key={index} className="bg-white shadow-md p-6 hover:shadow-lg transition">
              <label className="block text-lg font-medium text-gray-900 mb-4">
                {field.label}
                {field.required && <span className="text-red-600 ml-1">*</span>}
              </label>

              {field.field_type === 'text' && (
                <input
                  type="text"
                  name={`field_${index}`}
                  required={field.required}
                  placeholder="Your answer"
                  className="w-full border-b-2 border-gray-300 focus:border-purple-600 outline-none px-2 py-2 text-gray-900"
                />
              )}

              {field.field_type === 'email' && (
                <input
                  type="email"
                  name={`field_${index}`}
                  required={field.required}
                  placeholder="Your email"
                  className="w-full border-b-2 border-gray-300 focus:border-purple-600 outline-none px-2 py-2 text-gray-900"
                />
              )}

              {field.field_type === 'number' && (
                <input
                  type="number"
                  name={`field_${index}`}
                  required={field.required}
                  placeholder="Your answer"
                  className="w-full border-b-2 border-gray-300 focus:border-purple-600 outline-none px-2 py-2 text-gray-900"
                />
              )}

              {field.field_type === 'date' && (
                <input
                  type="date"
                  name={`field_${index}`}
                  required={field.required}
                  className="w-full border-b-2 border-gray-300 focus:border-purple-600 outline-none px-2 py-2 text-gray-900"
                />
              )}

              {field.field_type === 'textarea' && (
                <textarea
                  name={`field_${index}`}
                  required={field.required}
                  rows={4}
                  placeholder="Long answer text"
                  className="w-full border-b-2 border-gray-300 focus:border-purple-600 outline-none px-2 py-2 text-gray-900 resize-none"
                />
              )}

              {field.field_type === 'file' && (
                <div>
                  <input
                    type="file"
                    name={`field_${index}`}
                    required={field.required}
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                    className="w-full border-2 border-dashed border-gray-300 focus:border-purple-600 outline-none px-4 py-3 text-gray-900 rounded-lg cursor-pointer hover:bg-gray-50"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Accepted formats: PDF, DOC, DOCX, TXT, JPG, PNG, GIF (Max 10MB)
                  </p>
                </div>
              )}

              {field.field_type === 'dropdown' && (
                <select
                  name={`field_${index}`}
                  required={field.required}
                  className="w-full border-b-2 border-gray-300 focus:border-purple-600 outline-none px-2 py-2 text-gray-900"
                >
                  <option value="">Choose</option>
                  {field.options?.map((option: string, i: number) => (
                    <option key={i} value={option}>{option}</option>
                  ))}
                </select>
              )}

              {field.field_type === 'radio' && (
                <div className="space-y-3">
                  {field.options?.map((option: string, i: number) => (
                    <label key={i} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="radio"
                        name={field.id}
                        value={option}
                        required={field.required}
                        className="w-5 h-5 text-purple-600"
                      />
                      <span className="text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {field.field_type === 'checkbox' && (
                <div className="space-y-3">
                  {field.options?.map((option: string, i: number) => (
                    <label key={i} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        name={field.id}
                        value={option}
                        className="w-5 h-5 text-purple-600 rounded"
                      />
                      <span className="text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {fields.length > 0 && (
            <div className="bg-white shadow-md p-6 rounded-b-xl">
              <button
                type="submit"
                disabled={submitting}
                className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
