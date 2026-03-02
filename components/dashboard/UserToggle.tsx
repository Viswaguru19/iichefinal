'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Power } from 'lucide-react';

export default function UserToggle({ userId, currentStatus, onUpdate }: { userId: string; currentStatus: boolean; onUpdate?: () => void }) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const toggleUser = async () => {
    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ approved: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast.success(currentStatus ? 'User deactivated' : 'User activated');
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleUser}
      disabled={loading}
      className={`px-3 py-1 rounded text-xs font-semibold ${
        currentStatus
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-green-600 hover:bg-green-700 text-white'
      } disabled:opacity-50`}
    >
      {currentStatus ? 'Deactivate' : 'Activate'}
    </button>
  );
}
