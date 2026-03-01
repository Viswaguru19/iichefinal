'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

interface EditUserModalProps {
  user: any;
  committees: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditUserModal({ user, committees, onClose, onSuccess }: EditUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedCommittees, setSelectedCommittees] = useState<Array<{committee_id: string, position: string}>>(
    user.committees || []
  );

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const executiveRole = formData.get('executive_role') as string;
    const newEmail = formData.get('email') as string;

    // Update auth.users email if changed
    if (newEmail !== user.email) {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        user.id,
        { email: newEmail }
      );
      
      if (authError) {
        toast.error('Failed to update auth email');
        setLoading(false);
        return;
      }
    }

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        name: formData.get('name'),
        email: newEmail,
        username: formData.get('username'),
        executive_role: executiveRole || null,
        role: executiveRole ? 'committee_member' : 'student'
      })
      .eq('id', user.id);

    if (profileError) {
      toast.error('Failed to update user');
      setLoading(false);
      return;
    }

    // Delete existing committee memberships
    await supabase
      .from('committee_members')
      .delete()
      .eq('user_id', user.id);

    // Insert new committee memberships
    if (selectedCommittees.length > 0) {
      const { error: memberError } = await supabase
        .from('committee_members')
        .insert(
          selectedCommittees.map(c => ({
            user_id: user.id,
            committee_id: c.committee_id,
            position: c.position
          }))
        );

      if (memberError) {
        toast.error('Failed to update committees');
        setLoading(false);
        return;
      }
    }

    toast.success('User updated successfully');
    setLoading(false);
    onSuccess();
  }

  function addCommittee() {
    setSelectedCommittees([...selectedCommittees, { committee_id: '', position: 'member' }]);
  }

  function removeCommittee(index: number) {
    setSelectedCommittees(selectedCommittees.filter((_, i) => i !== index));
  }

  function updateCommittee(index: number, field: string, value: string) {
    const updated = [...selectedCommittees];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedCommittees(updated);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit User</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              type="text"
              name="name"
              defaultValue={user.name}
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              name="email"
              defaultValue={user.email}
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
            <input
              type="text"
              name="username"
              defaultValue={user.username}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Executive Role</label>
            <select
              name="executive_role"
              defaultValue={user.executive_role || ''}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">None</option>
              <option value="secretary">Secretary</option>
              <option value="joint_secretary">Joint Secretary</option>
              <option value="associate_secretary">Associate Secretary</option>
              <option value="associate_joint_secretary">Associate Joint Secretary</option>
              <option value="treasurer">Treasurer</option>
              <option value="associate_treasurer">Associate Treasurer</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Committees</label>
              <button
                type="button"
                onClick={addCommittee}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add Committee
              </button>
            </div>

            <div className="space-y-2">
              {selectedCommittees.map((sc, index) => (
                <div key={index} className="flex gap-2">
                  <select
                    value={sc.committee_id}
                    onChange={(e) => updateCommittee(index, 'committee_id', e.target.value)}
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="">Select Committee</option>
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <select
                    value={sc.position}
                    onChange={(e) => updateCommittee(index, 'position', e.target.value)}
                    className="w-40 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="member">Member</option>
                    <option value="head">Head</option>
                    <option value="co_head">Co-Head</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => removeCommittee(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
