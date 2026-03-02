'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Edit, Save, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EditCommitteeForm({ committees }: { committees: any[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const supabase = createClient();

  function startEdit(committee: any) {
    setEditingId(committee.id);
    setEditData({ name: committee.name, description: committee.description });
  }

  async function saveEdit(id: string) {
    try {
      const { error } = await (supabase as any)
        .from('committees')
        .update({
          name: editData.name,
          description: editData.description
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Committee updated');
      setEditingId(null);
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update committee');
    }
  }

  async function deleteCommittee(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will remove all members from this committee.`)) return;

    try {
      const { error } = await supabase
        .from('committees')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Committee deleted');
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete committee');
    }
  }

  return (
    <div className="space-y-4">
      {committees.map((committee) => (
        <div key={committee.id} className="border border-gray-300 rounded-lg p-4">
          {editingId === committee.id ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Committee Name"
              />
              <textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                rows={3}
                placeholder="Description"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(committee.id)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{committee.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{committee.description}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(committee)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => deleteCommittee(committee.id, committee.name)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
