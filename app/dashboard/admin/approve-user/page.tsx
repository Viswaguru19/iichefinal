'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

function ApproveUserContent() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState('student');
  const [isFaculty, setIsFaculty] = useState(false);
  const [committees, setCommittees] = useState<any[]>([]);
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [position, setPosition] = useState('member');
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
    
    const { data: userData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    setUser(userData);

    const { data: committeesData } = await supabase
      .from('committees')
      .select('*')
      .order('name');

    setCommittees((committeesData as any) || []);
  }

  async function handleApprove() {
    setLoading(true);

    try {
      const finalRole = isFaculty ? 'faculty_advisor' : role;

      const { error: updateError } = await (supabase as any)
        .from('profiles')
        .update({
          role: finalRole,
          is_faculty: isFaculty,
          approved: true,
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      if (!isFaculty && selectedCommittee) {
        await (supabase as any)
          .from('committee_members')
          .insert({
            user_id: userId,
            committee_id: selectedCommittee,
            position,
          });
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
    if (!confirm('Delete this user account?')) return;

    try {
      await (supabase as any).from('profiles').delete().eq('id', userId);
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
            <h1 className="text-2xl font-bold text-blue-600">Approve User</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
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
            {/* Faculty toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Is this user a Faculty Advisor?
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="isFaculty"
                    value="no"
                    checked={!isFaculty}
                    onChange={() => setIsFaculty(false)}
                  />
                  <span>No (Student / Committee)</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="isFaculty"
                    value="yes"
                    checked={isFaculty}
                    onChange={() => setIsFaculty(true)}
                  />
                  <span>Yes (Faculty Advisor)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign Role *</label>
              <select
                value={isFaculty ? 'faculty_advisor' : role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isFaculty}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                {!isFaculty && (
                  <>
                    <option value="student">Student</option>
                    <option value="committee_member">Committee Member</option>
                    <option value="committee_cohead">Committee Co-Head</option>
                    <option value="committee_head">Committee Head</option>
                  </>
                )}
                {isFaculty && <option value="faculty_advisor">Faculty Advisor</option>}
              </select>
            </div>

            {!isFaculty && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Committee (Optional)</label>
                  <select
                    value={selectedCommittee}
                    onChange={(e) => setSelectedCommittee(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">None</option>
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {selectedCommittee && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                    <select
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    >
                      <option value="member">Member</option>
                      <option value="co_head">Co-Head</option>
                      <option value="head">Head</option>
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-4 pt-4">
              <button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Approving...' : 'Approve & Activate'}
              </button>
              <button
                onClick={handleReject}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700"
              >
                Reject & Delete
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
