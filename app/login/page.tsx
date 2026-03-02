'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function LoginPage() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let email = emailOrUsername;

      if (!emailOrUsername.includes('@')) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', emailOrUsername)
          .maybeSingle();

        if (!(profileData as any)?.email) throw new Error('User not found');
        email = (profileData as any).email;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;

      alert('Password reset link sent to your email!');
      setResetMode(false);
    } catch (error: any) {
      alert(error?.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let email = emailOrUsername;

      if (!emailOrUsername.includes('@')) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', emailOrUsername)
          .maybeSingle();

        if (!(profileData as any)?.email) throw new Error('User not found');
        email = (profileData as any).email;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: profile } = await supabase
        .from('profiles')
        .select('approved')
        .eq('email', email)
        .single();

      if (!(profile as any)?.approved) {
        await supabase.auth.signOut();
        throw new Error('Account pending approval. Contact admin.');
      }

      window.location.href = '/dashboard';
    } catch (error: any) {
      alert(error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-blue-600">IIChE AVVU</Link>
          <p className="text-gray-600 mt-2">Welcome back</p>
        </div>

        <form onSubmit={resetMode ? handleResetPassword : handleAuth} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email or Username</label>
            <input
              type="text"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="email or username"
            />
          </div>

          {!resetMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? (resetMode ? 'Sending...' : 'Signing in...') : (resetMode ? 'Send Reset Link' : 'Sign In')}
          </button>

          {!resetMode && (
            <button
              type="button"
              onClick={() => setResetMode(true)}
              className="w-full text-blue-600 hover:text-blue-700 text-sm"
            >
              Forgot Password?
            </button>
          )}

          {resetMode && (
            <button
              type="button"
              onClick={() => setResetMode(false)}
              className="w-full text-gray-600 hover:text-gray-700 text-sm"
            >
              ← Back to Sign In
            </button>
          )}
        </form>

        <div className="mt-6 text-center">
          <Link href="/signup" className="text-blue-600 hover:text-blue-700 text-sm mr-4">
            Create Account
          </Link>
          <Link href="/" className="text-gray-600 hover:text-gray-700 text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
