'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CreateAuthButton({ userId, email, name, onSuccess }: { userId: string; email: string; name: string; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);

  const createAuth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/create-single-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email, name }),
      });

      const data = await response.json();
      console.log('Full response:', JSON.stringify(data, null, 2));

      if (data.success) {
        toast.success('Auth account created!');
        onSuccess();
      } else {
        toast.error(data.error || 'Failed to create auth');
        console.error('Error:', data);
      }
    } catch (error: any) {
      console.error('Catch error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={createAuth}
      disabled={loading}
      className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
    >
      <UserPlus className="w-3 h-3" />
      {loading ? 'Creating...' : 'Create Auth'}
    </button>
  );
}
