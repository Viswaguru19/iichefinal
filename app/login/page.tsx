'use client';

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import DynamicLogo from '@/components/DynamicLogo';

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

      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check if profile exists
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('approved, role, is_faculty, name')
        .eq('email', email)
        .maybeSingle();

      // Auto-create profile if it doesn't exist
      if (!profile && authData.user) {
        try {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              email: email,
              name: authData.user.email?.split('@')[0] || 'User',
              username: authData.user.email?.split('@')[0] || 'user',
              role: 'student',
              approved: false,
              is_faculty: false
            })
            .select('approved, role, is_faculty, name')
            .single();

          if (createError) {
            console.error('Profile creation error:', createError);
            // If profile creation fails, try to fetch again (might already exist)
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('approved, role, is_faculty, name')
              .eq('id', authData.user.id)
              .maybeSingle();

            if (existingProfile) {
              profile = existingProfile;
            } else {
              await supabase.auth.signOut();
              throw new Error(`Database setup incomplete. Please run migrations first. Error: ${createError.message}`);
            }
          } else {
            profile = newProfile;
          }
        } catch (err: any) {
          await supabase.auth.signOut();
          throw new Error(`Profile creation failed: ${err.message}. Please ensure database migrations are run.`);
        }
      }

      if (!profile) {
        await supabase.auth.signOut();
        throw new Error('Profile not found. Please sign up first or contact admin.');
      }

      // Super admin can always login, others need approval
      if ((profile as any)?.role !== 'super_admin' && !(profile as any)?.approved) {
        await supabase.auth.signOut();
        throw new Error('Account pending approval. Contact admin.');
      }

      // Redirect based on is_faculty flag (set by admin)
      if ((profile as any)?.is_faculty) {
        window.location.href = '/dashboard/faculty';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error?.message || 'Login failed';

      // Provide helpful error messages
      if (errorMessage.includes('fetch failed') || errorMessage.includes('ENOTFOUND')) {
        alert('❌ Cannot connect to database.\n\n' +
          'Your Supabase URL is not reachable.\n\n' +
          'Please:\n' +
          '1. Go to https://supabase.com/dashboard\n' +
          '2. Get your correct Project URL from Settings → API\n' +
          '3. Update .env.local with the correct URL\n' +
          '4. Restart the dev server\n\n' +
          'Current URL: ' + process.env.NEXT_PUBLIC_SUPABASE_URL);
      } else {
        alert(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <DynamicLogo width={60} height={60} />
          </div>
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
