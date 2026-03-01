'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EventWorkflowPage() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user?.id)
      .single();

    setCurrentUser(profile);

    const { data } = await supabase
      .from('event_proposals')
      .select(`
        *,
        committee:committees(name),
        approvals:event_approvals(approver_id, approved, approved_at, approver:profiles(name))
      `)
      .order('created_at', { ascending: false });

    setProposals(data || []);
    setLoading(false);
  }

  async function handleApproval(proposalId: string, approved: boolean) {
    const { error } = await supabase
      .from('event_approvals')
      .upsert({
        proposal_id: proposalId,
        approver_id: currentUser.id,
        approved,
        approved_at: new Date().toISOString()
      }, { onConflict: 'proposal_id,approver_id' });

    if (error) {
      toast.error('Failed to submit approval');
    } else {
      toast.success(approved ? 'Event approved' : 'Event rejected');
      fetchData();
    }
  }

  const canApprove = currentUser?.executive_role && 
    !['treasurer', 'associate_treasurer'].includes(currentUser.executive_role);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-gray-600 dark:text-gray-400">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Event Approval Workflow</h1>

        <div className="space-y-6">
          {proposals.map((proposal) => {
            const userApproval = proposal.approvals?.find((a: any) => a.approver_id === currentUser?.id);
            const approvedCount = proposal.approvals?.filter((a: any) => a.approved).length || 0;
            const totalExecutive = proposal.approvals?.length || 0;

            return (
              <div key={proposal.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{proposal.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{proposal.committee?.name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    proposal.status === 'approved' ? 'bg-green-100 text-green-800' :
                    proposal.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {proposal.status}
                  </span>
                </div>

                <p className="text-gray-700 dark:text-gray-300 mb-4">{proposal.description}</p>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Date:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {new Date(proposal.event_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Budget:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">₹{proposal.budget?.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Approvals: {approvedCount} / {totalExecutive}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${totalExecutive > 0 ? (approvedCount / totalExecutive) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {proposal.approvals?.map((approval: any) => (
                    <div key={approval.approver_id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{approval.approver?.name}</span>
                      {approval.approved ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : approval.approved === false ? (
                        <XCircle className="w-5 h-5 text-red-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  ))}
                </div>

                {canApprove && proposal.status === 'pending' && !userApproval?.approved && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApproval(proposal.id, true)}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleApproval(proposal.id, false)}
                      className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {userApproval?.approved && (
                  <div className="text-center text-green-600 font-medium">
                    ✓ You have approved this event
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {proposals.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No event proposals yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
