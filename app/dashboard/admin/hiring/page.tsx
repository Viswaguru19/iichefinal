'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Briefcase, Plus, Power, Trash2 } from 'lucide-react';

export default function HiringManagementPage() {
  const [positions, setPositions] = useState<any[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    checkAccess();
    loadData();
  }, []);

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const { data: membership } = await supabase
      .from('committee_members')
      .select('committee_id, committees(name)')
      .eq('user_id', user.id)
      .single();

    const isHR = (membership as any)?.committees?.name === 'Social Committee';
    const isSuperAdmin = (profile as any)?.role === 'super_admin';

    if (!isHR && !isSuperAdmin) {
      router.push('/dashboard');
    }
  }

  async function loadData() {
    const { data: settings } = await supabase
      .from('hiring_settings')
      .select('*')
      .single();

    setIsActive((settings as any)?.is_active || false);

    const { data } = await supabase
      .from('hiring_positions')
      .select('*')
      .order('created_at', { ascending: false });

    setPositions((data as any) || []);
    setLoading(false);
  }

  async function toggleHiring() {
    const settingsId = (await supabase.from('hiring_settings').select('id').single()).data as any;
    const { error } = await (supabase as any)
      .from('hiring_settings')
      .update({ is_active: !isActive })
      .eq('id', settingsId?.id);

    if (error) {
      toast.error('Failed to toggle hiring');
    } else {
      setIsActive(!isActive);
      toast.success(isActive ? 'Hiring deactivated' : 'Hiring activated');
    }
  }

  async function deletePosition(id: string) {
    if (!confirm('Delete this position?')) return;

    const { error } = await supabase.from('hiring_positions').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete position');
    } else {
      toast.success('Position deleted');
      loadData();
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
              <Briefcase className="w-6 h-6" />
              Hiring Management
            </h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Hiring Status</h2>
              <p className="text-gray-600">
                {isActive ? 'Hiring page is visible to everyone' : 'Hiring page is hidden'}
              </p>
            </div>
            <button
              onClick={toggleHiring}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
                isActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              <Power className="w-5 h-5" />
              {isActive ? 'Deactivate Hiring' : 'Activate Hiring'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Positions ({positions.length})</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Position
            </button>
          </div>

          <div className="space-y-4">
            {positions.map((position) => (
              <div key={position.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{position.title}</h3>
                    <p className="text-gray-600 mt-1">{position.description}</p>
                    {position.deadline && (
                      <p className="text-sm text-gray-500 mt-2">
                        Deadline: {new Date(position.deadline).toLocaleDateString()}
                      </p>
                    )}
                    <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${
                      position.is_open ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {position.is_open ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  <button
                    onClick={() => deletePosition(position.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {positions.length === 0 && (
            <p className="text-center text-gray-500 py-8">No positions added yet</p>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddPositionModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function AddPositionModal({ onClose, onSuccess }: any) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const { error } = await (supabase as any)
      .from('hiring_positions')
      .insert({
        title: formData.get('title'),
        description: formData.get('description'),
        requirements: formData.get('requirements'),
        location: formData.get('location'),
        deadline: formData.get('deadline'),
        is_open: true,
      });

    if (error) {
      toast.error('Failed to add position');
    } else {
      toast.success('Position added');
      onSuccess();
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Add Position</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              name="title"
              required
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              name="description"
              required
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requirements</label>
            <textarea
              name="requirements"
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              name="location"
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Application Deadline</label>
            <input
              type="date"
              name="deadline"
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Position'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
