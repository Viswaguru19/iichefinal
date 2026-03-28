'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type { ExecutiveRole } from '@/types/database';
import {
  EXECUTIVE_COMMITTEE_SYNTHETIC_ID,
  EXECUTIVE_OFFICE_OPTIONS,
  committeePositionToUserRole,
  parseExecutiveOffice,
} from '@/lib/user-approval';

function ApproveUserContent() {
  const [user, setUser] = useState<any>(null);
  const [isFaculty, setIsFaculty] = useState(false);
  const [committees, setCommittees] = useState<any[]>([]);
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [position, setPosition] = useState<'head' | 'co_head' | 'member'>('member');
  const [executiveOffice, setExecutiveOffice] = useState<ExecutiveRole | ''>('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('id');

  useEffect(() => {
    if (userId) fetchData();
  }, [userId]);

  async function fetchData() {
    if (!userId) return;

    const { data: userData } = await supabase.from('profiles').select('*').eq('id', userId).single();

    setUser(userData);

    const { data: committeesData } = await supabase.from('committees').select('*').order('name');

    setCommittees((committeesData as any) || []);
  }

  const regularCommittees = committees.filter((c) => c.type === 'regular');

  async function handleApprove() {
    if (!userId) return;

    setLoading(true);

    try {
      if (isFaculty) {
        const { error: updateError } = await (supabase as any).from('profiles').update({
          role: 'faculty_advisor',
          is_faculty: true,
          executive_role: null,
          approved: true,
        }).eq('id', userId);

        if (updateError) throw updateError;
      } else {
        if (!selectedCommittee) {
          toast.error('Select a committee');
          setLoading(false);
          return;
        }

        const committeeRole = committeePositionToUserRole(position);
        const exec = parseExecutiveOffice(executiveOffice);

        const { error: updateError } = await (supabase as any).from('profiles').update({
          role: committeeRole,
          is_faculty: false,
          executive_role: exec,
          approved: true,
        }).eq('id', userId);

        if (updateError) throw updateError;

        const { error: cmError } = await (supabase as any).from('committee_members').insert({
          user_id: userId,
          committee_id: selectedCommittee,
          position,
        });

        if (cmError) throw cmError;

        if (position === 'head' || position === 'co_head') {
          const { error: ecError } = await (supabase as any).from('committee_members').insert({
            user_id: userId,
            committee_id: EXECUTIVE_COMMITTEE_SYNTHETIC_ID,
            position: 'member',
          });
          if (ecError) throw ecError;
        }
      }

      toast.success('User approved successfully!');
      router.push('/dashboard/admin/users');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!userId) {
      toast.error('Missing user id');
      return;
    }
    if (!confirm('Delete this user account? This removes their login from Supabase.')) return;

    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success('User rejected and deleted');
      router.push('/dashboard/admin/users');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  if (!user) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Approve user</h1>
            <button type="button" onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">
              ← Back
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-bold text-gray-900 text-lg">{user.name}</h3>
            <p className="text-gray-600">{user.email}</p>
            <p className="text-gray-600">@{user.username}</p>
          </div>

          <div className="space-y-4">
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">Is this user faculty?</legend>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="isFaculty"
                    checked={!isFaculty}
                    onChange={() => setIsFaculty(false)}
                  />
                  No — assign committee (and optional executive office)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="isFaculty"
                    checked={isFaculty}
                    onChange={() => setIsFaculty(true)}
                  />
                  Yes — faculty advisor only
                </label>
              </div>
            </fieldset>

            {isFaculty ? (
              <p className="text-sm text-gray-600">
                No committee or executive fields needed. They receive the faculty advisor role.
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Committee *</label>
                  <select
                    value={selectedCommittee}
                    onChange={(e) => setSelectedCommittee(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">Select committee</option>
                    {regularCommittees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role in committee *</label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value as 'head' | 'co_head' | 'member')}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="member">Member</option>
                    <option value="co_head">Co-head</option>
                    <option value="head">Head</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Executive office (optional)
                  </label>
                  <select
                    value={executiveOffice}
                    onChange={(e) => setExecutiveOffice((e.target.value || '') as ExecutiveRole | '')}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">None</option>
                    {EXECUTIVE_OFFICE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">When set, user gets EC portal access (secretary, treasurer, etc.).</p>
                </div>
              </>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Approving...' : 'Approve & activate'}
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700"
              >
                Reject & delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ApproveUserPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <ApproveUserContent />
    </Suspense>
  );
}
