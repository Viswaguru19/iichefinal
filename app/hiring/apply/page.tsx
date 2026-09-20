'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import PortalLoadingScreen from '@/components/PortalLoadingScreen';

type Committee = { id: string; name: string };

export default function HiringApplyPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [resume, setResume] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Sign in or create a hiring account first.');
        router.replace('/hiring/sign-up');
        return;
      }

      const { data: settings } = await supabase.from('hiring_settings').select('is_active').single();
      if (!(settings as { is_active?: boolean } | null)?.is_active) {
        toast.error('Hiring is not open.');
        router.replace('/hiring');
        return;
      }

      const { data: pos } = await supabase
        .from('hiring_positions')
        .select('id')
        .eq('is_system_generated', true)
        .eq('is_open', true)
        .maybeSingle();

      if (!pos?.id) {
        toast.error('Campaign not available yet.');
        router.replace('/hiring');
        return;
      }
      setCampaignId(pos.id);

      const { data: prof } = await supabase.from('profiles').select('name, email').eq('id', user.id).single();
      if (prof) {
        setName((prof as { name?: string }).name || '');
        setEmail((prof as { email?: string }).email || '');
      }

      const { data: com } = await supabase.from('committees').select('id, name').eq('type', 'regular').order('name');
      setCommittees((com as Committee[]) || []);

      const { data: existing } = await supabase
        .from('hiring_applications')
        .select('id, status')
        .eq('applicant_user_id', user.id)
        .in('status', ['pending', 'shortlisted', 'interview', 'selected'])
        .maybeSingle();

      if (existing) {
        toast.success(
          (existing as { status?: string }).status === 'selected'
            ? 'You are already onboarded as a co-head.'
            : 'You already have an application on file.',
        );
        router.replace('/hiring/portal');
        return;
      }

      setReady(true);
    })();
  }, [router, supabase]);

  const committeeOptions = useMemo(() => {
    return committees.map((c) => (
      <option key={c.id} value={c.id}>
        {c.name}
      </option>
    ));
  }, [committees]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId) return;
    const prefs = [p1, p2, p3];
    if (prefs.some((p) => !p)) {
      toast.error('Choose three different committees.');
      return;
    }
    if (new Set(prefs).size !== 3) {
      toast.error('Committee preferences must be three distinct committees.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/hiring/sign-up');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('hiring_applications').insert({
        position_id: campaignId,
        applicant_user_id: user.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department: department.trim() || null,
        year_of_study: yearOfStudy.trim() || null,
        resume: resume.trim(),
        cover_letter: coverLetter.trim(),
        status: 'pending',
        preference_1_id: p1,
        preference_2_id: p2,
        preference_3_id: p3,
      });
      if (error) throw error;
      toast.success('Application submitted.');
      router.push('/hiring/portal');
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Submit failed';
      toast.error(m);
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return <PortalLoadingScreen message="Loading application…" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-4 flex justify-between">
        <Link href="/hiring" className="text-indigo-600 font-medium">
          ← Hiring
        </Link>
        <Link href="/hiring/portal" className="text-sm text-gray-600">
          My application
        </Link>
      </nav>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Co-head application</h1>
        <p className="text-gray-600 mb-8">
          Committees you list below can review your application and invite you for an interview. Pick three different
          committees in order of preference.
        </p>
        <form onSubmit={submit} className="bg-white rounded-2xl shadow border border-gray-100 p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input className="w-full border rounded-lg px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input className="w-full border rounded-lg px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department / branch</label>
            <input className="w-full border rounded-lg px-3 py-2" value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year of study</label>
            <input className="w-full border rounded-lg px-3 py-2" value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resume / CV link</label>
            <input
              type="url"
              className="w-full border rounded-lg px-3 py-2"
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              required
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover letter</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 min-h-[140px]"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              required
            />
          </div>
          <div className="border-t border-gray-100 pt-6 space-y-3">
            <h2 className="font-semibold text-gray-900">Committee preferences</h2>
            <div>
              <label className="block text-sm text-gray-700 mb-1">First preference</label>
              <select className="w-full border rounded-lg px-3 py-2" value={p1} onChange={(e) => setP1(e.target.value)} required>
                <option value="">Select committee</option>
                {committeeOptions}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Second preference</label>
              <select className="w-full border rounded-lg px-3 py-2" value={p2} onChange={(e) => setP2(e.target.value)} required>
                <option value="">Select committee</option>
                {committeeOptions}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Third preference</label>
              <select className="w-full border rounded-lg px-3 py-2" value={p3} onChange={(e) => setP3(e.target.value)} required>
                <option value="">Select committee</option>
                {committeeOptions}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Submitting…' : 'Submit application'}
          </button>
        </form>
      </div>
    </div>
  );
}
