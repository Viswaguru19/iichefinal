'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function HiringSignUpPage() {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            hiring_signup: 'true',
          },
        },
      });
      if (error) throw error;
      if (data.user && !data.session) {
        toast.success('Check your email to confirm your account, then sign in to apply.');
      } else {
        toast.success('Account created. You can sign in and complete your application.');
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Sign up failed';
      toast.error(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-100 px-4 py-4 flex justify-between items-center">
        <Link href="/hiring" className="text-indigo-600 font-semibold">
          ← Hiring home
        </Link>
        <Link href="/login?next=/hiring/apply" className="text-sm text-gray-600">
          Already registered? Sign in
        </Link>
      </nav>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Hiring account</h1>
          <p className="text-sm text-gray-600 mb-6">
            This login is for co-head applicants only. After you are selected, your account unlocks the full student
            portal.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create hiring account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
