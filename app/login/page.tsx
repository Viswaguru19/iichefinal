'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import Link from 'next/link';
import DynamicLogo from '@/components/DynamicLogo';
import { FlaskConical } from 'lucide-react';
import { setDemoFlagClient } from '@/lib/demo';

export default function LoginPage() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
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

  const finishLogin = async (email: string, authData: { user: { id: string; email?: string | null } | null }) => {
    let { data: profile } = await supabase
      .from('profiles')
      .select('approved, role, is_faculty, name, hiring_portal_only')
      .eq('email', email)
      .maybeSingle();

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
            is_faculty: false,
          })
          .select('approved, role, is_faculty, name, hiring_portal_only')
          .single();

        if (createError) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('approved, role, is_faculty, name, hiring_portal_only')
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

    const p = profile as { role?: string; approved?: boolean; hiring_portal_only?: boolean };
    const isSuper = p?.role === 'super_admin';
    const okLogin = isSuper || p?.approved || p?.hiring_portal_only;
    if (!okLogin) {
      await supabase.auth.signOut();
      throw new Error('Account pending approval. Contact admin.');
    }

    const rawNext = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
    const nextPath =
      rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;
    const defaultDest = p?.hiring_portal_only ? '/hiring/portal' : '/dashboard';
    let dest = nextPath || defaultDest;
    if (p?.hiring_portal_only && (nextPath?.startsWith('/dashboard') || nextPath?.startsWith('/chat'))) {
      dest = '/hiring/portal';
    }
    window.location.href = dest;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDemoFlagClient(false);

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

      await finishLogin(email, authData);
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error?.message || 'Login failed';

      if (errorMessage.includes('fetch failed') || errorMessage.includes('ENOTFOUND')) {
        alert(
          '❌ Cannot connect to database.\n\n' +
            'Your Supabase URL is not reachable.\n\n' +
            'Please:\n' +
            '1. Go to https://supabase.com/dashboard\n' +
            '2. Get your correct Project URL from Settings → API\n' +
            '3. Update .env.local with the correct URL\n' +
            '4. Restart the dev server\n\n' +
            'Current URL: ' +
            process.env.NEXT_PUBLIC_SUPABASE_URL,
        );
      } else {
        alert(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const res = await fetch('/api/demo/login', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not start demo');

      setDemoFlagClient(true);

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });
      if (error) throw error;

      toast.success('Demo mode — explore freely. Real data is hidden.');
      await finishLogin(body.email, authData);
    } catch (error: any) {
      setDemoFlagClient(false);
      console.error('Demo login error:', error);
      alert(error?.message || 'Demo login failed');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
      <div className="glass-strong rounded-2xl shadow-2xl shadow-indigo-500/10 p-8 w-full max-w-md relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br from-indigo-400/20 to-purple-400/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-gradient-to-br from-blue-400/15 to-cyan-400/15 blur-3xl" />
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white/70 border border-white/60 shadow-sm flex items-center justify-center">
              <DynamicLogo width={52} height={52} />
            </div>
          </div>
          <Link href="/" className="text-3xl font-bold text-blue-600">
            IIChE AVVU SC
          </Link>
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
            disabled={loading || demoLoading}
            className="w-full btn-gradient-blue py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (resetMode ? 'Sending...' : 'Signing in...') : resetMode ? 'Send Reset Link' : 'Sign In'}
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

        {!resetMode && (
          <div className="mt-6">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-white/80 px-2 text-gray-500">or</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading || demoLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 border-teal-600/30 text-teal-800 bg-teal-50 hover:bg-teal-100 transition-colors disabled:opacity-50"
            >
              <FlaskConical className="w-4 h-4" aria-hidden />
              {demoLoading ? 'Starting demo…' : 'Try portal (demo)'}
            </button>
            <p className="mt-2 text-center text-xs text-gray-500">
              Browse features with no real member or event data. Changes are disabled.
            </p>
          </div>
        )}

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
