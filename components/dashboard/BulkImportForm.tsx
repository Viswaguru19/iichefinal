'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function BulkImportForm({ committees }: { committees: any[] }) {
  const [loading, setLoading] = useState(false);
  const [csvData, setCsvData] = useState('');
  const supabase = createClient();

  async function handleImport() {
    setLoading(true);
    const lines = csvData.trim().split('\n');

    try {
      const response = await fetch('/api/admin/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: lines }),
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Imported ${result.success} users. Failed: ${result.failed}`);
        setCsvData('');
      } else {
        toast.error(result.error || 'Import failed');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">Bulk Import Users</h2>
      
      <div className="mb-4 p-4 bg-blue-50 rounded">
        <p className="text-sm text-blue-800 font-semibold mb-2">CSV Format:</p>
        <code className="text-xs text-blue-900">Name,Email,Username,ExecutiveRole,Committees,Position</code>
        <p className="text-xs text-blue-700 mt-2">Example:</p>
        <code className="text-xs text-blue-900">Swarnakamatchi R,swarnakamatchi@example.com,swarna,secretary,,</code>
        <p className="text-xs text-blue-700 mt-2">Multiple committees: separate with semicolon (;)</p>
        <p className="text-xs text-blue-700">Position: member, head, co_head</p>
        <p className="text-xs text-blue-700">Executive roles: secretary, associate_secretary, joint_secretary, associate_joint_secretary, treasurer, associate_treasurer</p>
      </div>

      <textarea
        value={csvData}
        onChange={(e) => setCsvData(e.target.value)}
        className="w-full border rounded p-3 font-mono text-sm h-64"
        placeholder="Paste CSV data here..."
      />

      <button
        onClick={handleImport}
        disabled={loading || !csvData}
        className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Importing...' : 'Import Users'}
      </button>
    </div>
  );
}
