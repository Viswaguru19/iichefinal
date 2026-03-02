'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';

export default function ApprovalActions({ user, committees }: any) {
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [position, setPosition] = useState<'head' | 'co_head' | 'member'>('member');
  const [executiveRole, setExecutiveRole] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleApprove = async () => {
    if (!selectedCommittee) {
      toast.error('Please select a committee');
      return;
    }

    setLoading(true);
    try {
      // Approve user
      const { error: approveError } = await (supabase as any)
        .from('profiles')
        .update({ 
          approved: true,
          role: executiveRole || (position === 'head' ? 'committee_head' : position === 'co_head' ? 'committee_cohead' : 'committee_member')
        })
        .eq('id', user.id);

      if (approveError) throw approveError;

      // Add to committee
      const { error: memberError } = await (supabase as any)
        .from('committee_members')
        .insert({
          user_id: user.id,
          committee_id: selectedCommittee,
          position: position,
        });

      if (memberError) throw memberError;

      // If head or co-head, add to executive committee
      if (position === 'head' || position === 'co_head') {
        await (supabase as any)
          .from('committee_members')
          .insert({
            user_id: user.id,
            committee_id: '00000000-0000-0000-0000-000000000001',
            position: 'member',
          });
      }

      toast.success('User approved successfully!');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (error) throw error;

      toast.success('User rejected');
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

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Committee *
          </label>
          <select
            value={selectedCommittee}
            onChange={(e) => setSelectedCommittee(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Committee</option>
            {committees.filter((c: any) => c.type === 'regular').map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Position *
          </label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="member">Member</option>
            <option value="co_head">Co-Head</option>
            <option value="head">Head</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Executive Role (Optional)
          </label>
          <select
            value={executiveRole}
            onChange={(e) => setExecutiveRole(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">None</option>
            <option value="secretary">Secretary</option>
            <option value="associate_secretary">Associate Secretary</option>
            <option value="joint_secretary">Joint Secretary</option>
            <option value="associate_joint_secretary">Associate Joint Secretary</option>
            <option value="treasurer">Treasurer</option>
            <option value="associate_treasurer">Associate Treasurer</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          Approve & Assign
        </button>
        <button
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
