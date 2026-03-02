'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Bell, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadProposals();
  }, []);

  async function loadProposals() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: profile } = await supabase.from('profiles').select('*, committee_members(position, committee_id)').eq('id', user.id).single();
    setUserRole(profile);

    const isHead = (profile as any)?.committee_members?.some((m: any) => m.position === 'head');
    const isExecutive = (profile as any)?.executive_role !== null;

    let query = supabase.from('event_proposals').select('*, committees(name), proposer:profiles!event_proposals_proposed_by_user_fkey(name)');

    if (isHead) {
      query = query.eq('status', 'pending_head');
    } else if (isExecutive) {
      query = query.eq('status', 'pending_executive');
    } else {
      query = query.in('status', ['pending_head', 'pending_executive', 'approved', 'rejected']);
    }

    const { data } = await query.order('created_at', { ascending: false });
    setProposals(data || []);
  }

  async function handleApprove(proposalId: string, currentStatus: string) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (currentStatus === 'pending_head') {
        // Check if committee has dual heads
        const { data: proposal } = await supabase
          .from('event_proposals')
          .select('proposed_by_committee, head_approved_by, co_head_approved_by')
          .eq('id', proposalId)
          .single();

        const { data: heads } = await supabase
          .from('committee_members')
          .select('user_id')
          .eq('committee_id', (proposal as any).proposed_by_committee)
          .eq('position', 'head');

        const hasDualHeads = heads && heads.length === 2;

        if (hasDualHeads) {
          // Dual head approval required
          const updateData: any = {};
          if (!(proposal as any).head_approved_by) {
            updateData.head_approved_by = user?.id;
          } else if (!(proposal as any).co_head_approved_by) {
            updateData.co_head_approved_by = user?.id;
            updateData.status = 'pending_executive'; // Both approved, move to executive
          }

          const { error } = await (supabase as any)
            .from('event_proposals')
            .update(updateData)
            .eq('id', proposalId);

          if (error) throw error;
          toast.success(updateData.status ? 'Both heads approved! Sent to Executive Committee' : 'Approved! Waiting for second head approval');
        } else {
          // Single head, approve directly
          const { error } = await (supabase as any)
            .from('event_proposals')
            .update({ status: 'pending_executive', head_approved_by: user?.id })
            .eq('id', proposalId);

          if (error) throw error;
          toast.success('Proposal approved!');
        }
      } else {
        // Executive approval
        const { error } = await (supabase as any)
          .from('event_proposals')
          .update({ status: 'approved' })
          .eq('id', proposalId);

        if (error) throw error;
        toast.success('Proposal approved!');
      }

      loadProposals();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(proposalId: string) {
    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('event_proposals')
        .update({ status: 'rejected' })
        .eq('id', proposalId);

      if (error) throw error;

      toast.success('Proposal rejected');
      loadProposals();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendReminder(proposalId: string, targetUserId: string) {
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId,
          targetUserId,
          reminderType: 'approval',
          message: 'Please review the pending proposal'
        })
      });

      if (!res.ok) throw new Error('Failed to send reminder');
      toast.success('Reminder sent!');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Event Proposals</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <div key={proposal.id} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{proposal.title}</h3>
                  <p className="text-sm text-gray-600">{proposal.committees?.name}</p>
                  <p className="text-xs text-gray-500 mt-1">Proposed by: {proposal.proposer?.name}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  proposal.status === 'approved' ? 'bg-green-100 text-green-800' :
                  proposal.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {proposal.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              <p className="text-gray-700 mb-4">{proposal.description}</p>

              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                <div>
                  <span className="font-medium">Date:</span> {new Date(proposal.event_date).toLocaleDateString('en-IN')}
                </div>
                {proposal.location && (
                  <div>
                    <span className="font-medium">Location:</span> {proposal.location}
                  </div>
                )}
              </div>

              {(proposal.status === 'pending_head' || proposal.status === 'pending_executive') && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleApprove(proposal.id, proposal.status)}
                    disabled={loading}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(proposal.id)}
                    disabled={loading}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => sendReminder(proposal.id, proposal.proposed_by_user)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    <Bell className="w-4 h-4" />
                    Send Reminder
                  </button>
                </div>
              )}

              {proposal.status === 'pending_head' && (
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>Waiting for Committee Head approval</span>
                </div>
              )}
            </div>
          ))}

          {proposals.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <p className="text-gray-600">No proposals to review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
