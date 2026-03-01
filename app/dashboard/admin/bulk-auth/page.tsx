'use client';

import { useState } from 'react';

export default function BulkAuthPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const createAuthAccounts = async () => {
    setLoading(true);
    setMessage('Creating auth accounts...');

    try {
      const response = await fetch('/api/admin/create-auth-accounts', {
        method: 'POST',
      });

      const data = await response.json();
      setMessage(data.message || 'Done!');
    } catch (error: any) {
      setMessage('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6">Bulk Create Auth Accounts</h1>
        
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            This will create authentication accounts for all users in the profiles table.
            Default password: <code className="bg-yellow-200 px-2 py-1 rounded">iichelogin</code>
          </p>
        </div>

        <button
          onClick={createAuthAccounts}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Auth Accounts'}
        </button>

        {message && (
          <div className="mt-6 p-4 bg-gray-100 rounded">
            <pre className="text-sm whitespace-pre-wrap">{message}</pre>
          </div>
        )}

        <div className="mt-6">
          <a href="/dashboard/admin/users" className="text-blue-600 hover:underline">
            ← Back to Users
          </a>
        </div>
      </div>
    </div>
  );
}
