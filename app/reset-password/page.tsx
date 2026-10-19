'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [missingSession, setMissingSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hasUser() {
      const { data } = await supabase.auth.getUser();
      return !!data.user;
    }

    async function hydrateFromHash() {
      const raw = window.location.hash.replace(/^#/, '');
      if (!raw) return false;
      const hash = new URLSearchParams(raw);
      const access_token = hash.get('access_token');
      const refresh_token = hash.get('refresh_token');
      if (!access_token || !refresh_token) return false;
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        console.error('Password reset hash session', error.message);
        return false;
      }
      window.history.replaceState({}, '', window.location.pathname);
      return hasUser();
    }

    async function hydrate() {
      const params = new URLSearchParams(window.location.search);
      if (params.get('error')) {
        if (!cancelled) setMissingSession(true);
        return;
      }

      const tokenHash = params.get('token_hash');
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        });
        if (error) console.error('Password reset token', error.message);
        else window.history.replaceState({}, '', window.location.pathname);
      }

      const code = params.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) console.error('Password reset code exchange', error.message);
      }

      if (await hasUser()) {
        if (!cancelled) {
          setReady(true);
          setMissingSession(false);
        }
        return;
      }

      if (await hydrateFromHash()) {
        if (!cancelled) {
          setReady(true);
          setMissingSession(false);
        }
        return;
      }

      setTimeout(async () => {
        if (cancelled) return;
        if (await hasUser()) {
          setReady(true);
          setMissingSession(false);
        } else {
          setMissingSession(true);
        }
      }, 600);
    }

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (await hasUser()) {
          setReady(true);
          setMissingSession(false);
        }
      }
    });

    void hydrate();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('Reset session expired. Request a new forgot-password email and use that latest link.');
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', userData.user.id);
      toast.success('Password updated');
      window.location.href = '/login';
    } catch (error: any) {
      toast.error(error?.message || 'Could not update password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
      <div className="glass-strong rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Set a new password</h1>
        <p className="text-sm text-gray-500 mb-6">Choose a password you will remember for the portal.</p>

        {missingSession && !ready ? (
          <div className="space-y-4">
            <p className="text-sm text-red-700">
              This reset link is invalid or has expired. Request a new one from the login page and open the latest email.
            </p>
            <Link href="/login" className="text-blue-600 text-sm font-semibold">
              ← Back to Sign In
            </Link>
          </div>
        ) : !ready ? (
          <p className="text-sm text-gray-500">Checking reset link…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gradient-blue py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
