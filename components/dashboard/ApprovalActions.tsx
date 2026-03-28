'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import type { ExecutiveRole } from '@/types/database';
import {
  EXECUTIVE_COMMITTEE_SYNTHETIC_ID,
  EXECUTIVE_OFFICE_OPTIONS,
  committeePositionToUserRole,
  parseExecutiveOffice,
} from '@/lib/user-approval';

export default function ApprovalActions({ user, committees }: any) {
  const [isFaculty, setIsFaculty] = useState(false);
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [position, setPosition] = useState<'head' | 'co_head' | 'member'>('member');
  const [executiveOffice, setExecutiveOffice] = useState<ExecutiveRole | ''>('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const regularCommittees = committees.filter((c: any) => c.type === 'regular');

  const handleApprove = async () => {
    if (isFaculty) {
      setLoading(true);
      try {
        const { error: approveError } = await (supabase as any).from('profiles').update({
          approved: true,
          role: 'faculty_advisor',
          is_faculty: true,
          executive_role: null,
        }).eq('id', user.id);

        if (approveError) throw approveError;
        toast.success('Faculty advisor approved');
        router.refresh();
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedCommittee) {
      toast.error('Select a committee');
      return;
    }

    const committeeRole = committeePositionToUserRole(position);
    const exec = parseExecutiveOffice(executiveOffice);

    setLoading(true);
    try {
      const { error: approveError } = await (supabase as any).from('profiles').update({
        approved: true,
        role: committeeRole,
        is_faculty: false,
        executive_role: exec,
      }).eq('id', user.id);

      if (approveError) throw approveError;

      const { error: memberError } = await (supabase as any).from('committee_members').insert({
        user_id: user.id,
        committee_id: selectedCommittee,
        position,
      });

      if (memberError) throw memberError;

      if (position === 'head' || position === 'co_head') {
        const { error: ecError } = await (supabase as any).from('committee_members').insert({
          user_id: user.id,
          committee_id: EXECUTIVE_COMMITTEE_SYNTHETIC_ID,
          position: 'member',
        });
        if (ecError) throw ecError;
      }

      toast.success('User approved and assigned');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('Delete this user account? This removes their login from Supabase.')) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success('User rejected and removed');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
        <p className="text-sm text-gray-600">{user.email}</p>
        <p className="text-xs text-gray-500 mt-1">
          Registered: {new Date(user.created_at).toLocaleDateString()}
        </p>
      </div>

      <fieldset className="mb-4">
        <legend className="text-sm font-medium text-gray-700 mb-2">Is this user faculty?</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name={`faculty-${user.id}`}
              checked={!isFaculty}
              onChange={() => setIsFaculty(false)}
            />
            No — committee / executive
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name={`faculty-${user.id}`}
              checked={isFaculty}
              onChange={() => setIsFaculty(true)}
            />
            Yes — faculty advisor only
          </label>
        </div>
      </fieldset>

      {isFaculty ? (
        <p className="text-sm text-gray-600 mb-4">
          Approving assigns the <strong>Faculty advisor</strong> role. No committee or executive fields are required.
        </p>
      ) : (
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Committee *</label>
            <select
              value={selectedCommittee}
              onChange={(e) => setSelectedCommittee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select committee</option>
              {regularCommittees.map((c: any) => (
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {EXECUTIVE_OFFICE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Sets EC portal access when selected.</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          Approve & assign
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={loading}
          className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Reject
        </button>
      </div>
    </div>
  );
}
