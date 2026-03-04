'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Clock, Users, Crown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userCommittees, setUserCommittees] = useState<string[]>([]);
  const [ecApprovals, setEcApprovals] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadProposals();
  }, []);

  async function loadProposals() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    // Get user profile with committee memberships
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, committee_members(position, committee_id)')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      toast.error('Failed to load profile');
      return;
    }

    console.log('Profile loaded:', profile);
    console.log('Committee members:', (profile as any)?.committee_members);

    setUserProfile(profile);
    const committeeIds = (profile as any)?.committee_members?.map((m: any) => m.committee_id) || [];
    setUserCommittees(committeeIds);

    console.log('Committee IDs:', committeeIds);

    const isHead = (profile as any)?.committee_members?.some((m: any) => m.position === 'head' || m.position === 'co_head');
    const isEC = (profile as any)?.executive_role !== null;
    const isFaculty = (profile as any)?.is_faculty;
    const isAdmin = (profile as any)?.is_admin;

    console.log('User roles:', { isHead, isEC, isFaculty, isAdmin });

    // ============================================
    // SIMPLIFIED ROLE-BASED VISIBILITY
    // ============================================
    // Query events based on user role with clear logic:
    //
    // 1. Committee Heads/Co-Heads: See their committee's pending events
    // 2. EC Members: See all events at any status
    // 3. Faculty/Admin: See all events
    // 4. Regular Members: See their committee's events

    let query = supabase
      .from('events')
      .select(`
        *,
        committee:committee_id(name),
        proposer:proposed_by(name),
        head_approver:head_approved_by(name),
        faculty_approver:faculty_approved_by(name),
        ec_approvals(user_id, approved, profiles(name, executive_role))
      `)
      .order('created_at', { ascending: false });

    // Apply filters based on role
    if (isFaculty || isAdmin || isEC) {
      // Faculty, Admin, and EC see all events
      console.log('Query: No filters (Faculty/Admin/EC)');
    } else if (isHead && committeeIds.length > 0) {
      // Committee heads see their committee's events
      console.log('Query: Filtering by committee IDs:', committeeIds);
      query = query.in('committee_id', committeeIds);
    } else if (committeeIds.length > 0) {
      // Regular members see their committee's events
      console.log('Query: Filtering by committee IDs (regular member):', committeeIds);
      query = query.in('committee_id', committeeIds);
    } else {
      console.warn('No committee IDs found! User might not see any events.');
    }

    const { data, error: eventsError } = await query;

    if (eventsError) {
      console.error('Events query error:', eventsError);
      toast.error('Failed to load events');
      return;
    }

    console.log('Events loaded:', data?.length, 'events');
    console.log('Events:', data);

    setProposals(data || []);

    // Load EC approvals for pending EC proposals
    if (data) {
      const ecProposalIds = data.filter(p => p.status === 'pending_ec_approval').map(p => p.id);
      if (ecProposalIds.length > 0) {
        const { data: approvals } = await supabase
          .from('ec_approvals')
          .select('*')
          .in('event_id', ecProposalIds);

        const approvalsMap: any = {};
        approvals?.forEach(a => {
          if (!approvalsMap[a.event_id]) approvalsMap[a.event_id] = [];
          approvalsMap[a.event_id].push(a);
        });
        setEcApprovals(approvalsMap);
      }
    }
  }

  async function handleHeadApprove(proposalId: string) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('events')
        .update({
          status: 'pending_ec_approval',
          head_approved_by: user?.id,
          head_approved_at: new Date().toISOString()
        })
        .eq('id', proposalId);

      if (error) throw error;

      toast.success('Proposal approved! Sent to Executive Committee');
      loadProposals();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleECApprove(proposalId: string) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Record EC member's approval
      const { error: approvalError } = await supabase
        .from('ec_approvals')
        .upsert({
          event_id: proposalId,
          user_id: user?.id,
          approved: true,
          approved_at: new Date().toISOString()
        });

      if (approvalError) throw approvalError;

      // ============================================
      // EC APPROVAL THRESHOLD: 2 out of 6
      // ============================================
      // Check how many EC members have approved. Only 2 approvals are required
      // to move the event to faculty approval stage. This threshold balances:
      // - Oversight: Multiple EC members review each event
      // - Efficiency: Events don't require unanimous EC consent
      // - Speed: Events can proceed without waiting for all 6 EC members
      const { data: allApprovals } = await supabase
        .from('ec_approvals')
        .select('*')
        .eq('event_id', proposalId)
        .eq('approved', true);

      // Only 2 EC approvals are required to move forward
      if (allApprovals && allApprovals.length >= 2) {
        // Enough EC members approved, move to faculty approval
        const { error: updateError } = await supabase
          .from('events')
          .update({ status: 'pending_faculty_approval' })
          .eq('id', proposalId);

        if (updateError) throw updateError;
        toast.success('Executive Committee approval complete! Sent to Faculty Advisor');
      } else {
        toast.success(`Your approval recorded (${allApprovals?.length || 0}/2 EC approvals)`);
      }

      loadProposals();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFacultyApprove(proposalId: string) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('events')
        .update({
          status: 'active',
          faculty_approved_by: user?.id,
          faculty_approved_at: new Date().toISOString()
        })
        .eq('id', proposalId);

      if (error) throw error;

      toast.success('Event approved and activated!');
      loadProposals();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!selectedProposal || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({
          status: 'cancelled',
          rejection_reason: rejectionReason
        })
        .eq('id', selectedProposal.id);

      if (error) throw error;

      toast.success('Proposal rejected');
      setShowRejectModal(false);
      setSelectedProposal(null);
      setRejectionReason('');
      loadProposals();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  const canApproveAsHead = (proposal: any) => {
    return userCommittees.includes(proposal.committee_id) &&
      userProfile?.committee_members?.some((m: any) => (m.position === 'head' || m.position === 'co_head') && m.committee_id === proposal.committee_id) &&
      proposal.status === 'pending_head_approval';
  };

  const canApproveAsEC = (proposal: any) => {
    return userProfile?.executive_role !== null && proposal.status === 'pending_ec_approval';
  };

  const canApproveAsFaculty = (proposal: any) => {
    // Faculty, admin, or any EC member can perform the final approval step
    return (userProfile?.is_faculty || userProfile?.is_admin || userProfile?.executive_role !== null) &&
      proposal.status === 'pending_faculty_approval';
  };

  const hasECApproved = (proposal: any) => {
    const approvals = ecApprovals[proposal.id] || [];
    return approvals.some((a: any) => a.user_id === userProfile?.id && a.approved);
  };

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
          {proposals.map((proposal) => {
            const approvals = ecApprovals[proposal.id] || [];
            const ecApprovalCount = approvals.filter((a: any) => a.approved).length;

            return (
              <div key={proposal.id} className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">{proposal.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{proposal.committee?.name}</p>
                    <p className="text-xs text-gray-500 mt-1">Proposed by: {proposal.proposer?.name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ml-4 ${proposal.status === 'active' ? 'bg-green-100 text-green-800' :
                    proposal.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      proposal.status === 'pending_faculty_approval' ? 'bg-purple-100 text-purple-800' :
                        proposal.status === 'pending_ec_approval' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                    }`}>
                    {proposal.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>

                <p className="text-gray-700 mb-4">{proposal.description}</p>

                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                  <div>
                    <span className="font-medium">Date:</span> {new Date(proposal.date).toLocaleString('en-IN')}
                  </div>
                  {proposal.location && (
                    <div>
                      <span className="font-medium">Location:</span> {proposal.location}
                    </div>
                  )}
                  {proposal.budget && (
                    <div>
                      <span className="font-medium">Budget:</span> ₹{proposal.budget.toLocaleString('en-IN')}
                    </div>
                  )}
                </div>

                {/* EC Approval Progress */}
                {/* Display approval progress when event is at EC approval stage.
                    Shows X/2 progress (2 out of 6 EC members required) with visual
                    progress bar and list of members who have approved. */}
                {proposal.status === 'pending_ec_approval' && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-blue-900">EC Approval Progress: {ecApprovalCount}/2</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${(ecApprovalCount / 2) * 100}%` }}
                      />
                    </div>
                    {approvals.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {approvals.filter((a: any) => a.approved).map((a: any) => (
                          <span key={a.user_id} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            ✓ {a.profiles?.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Approval History */}
                {(proposal.head_approved_by || proposal.faculty_approved_by) && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2">Approval History</h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      {proposal.head_approved_by && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Committee Head: {proposal.head_approver?.name}</span>
                        </div>
                      )}
                      {proposal.status === 'pending_faculty_approval' && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Executive Committee: Minimum approvals received</span>
                        </div>
                      )}
                      {proposal.faculty_approved_by && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Faculty Advisor: {proposal.faculty_approver?.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rejection Reason */}
                {proposal.status === 'cancelled' && proposal.rejection_reason && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-semibold text-red-900 mb-1">Rejection Reason</h4>
                    <p className="text-sm text-red-800">{proposal.rejection_reason}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  {canApproveAsHead(proposal) && (
                    <>
                      <button
                        onClick={() => handleHeadApprove(proposal.id)}
                        disabled={loading}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve as Head
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProposal(proposal);
                          setShowRejectModal(true);
                        }}
                        disabled={loading}
                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </>
                  )}

                  {canApproveAsEC(proposal) && !hasECApproved(proposal) && (
                    <>
                      <button
                        onClick={() => handleECApprove(proposal.id)}
                        disabled={loading}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Crown className="w-4 h-4" />
                        Approve as EC Member
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProposal(proposal);
                          setShowRejectModal(true);
                        }}
                        disabled={loading}
                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </>
                  )}

                  {canApproveAsEC(proposal) && hasECApproved(proposal) && (
                    <span className="flex items-center gap-2 text-green-600 font-medium">
                      <CheckCircle className="w-5 h-5" />
                      You have approved this proposal
                    </span>
                  )}

                  {canApproveAsFaculty(proposal) && (
                    <>
                      <button
                        onClick={() => handleFacultyApprove(proposal.id)}
                        disabled={loading}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve as Faculty
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProposal(proposal);
                          setShowRejectModal(true);
                        }}
                        disabled={loading}
                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </>
                  )}

                  {/* EC Read-Only View for pending_head_approval */}
                  {/* EC members can see proposals at pending_head_approval stage but cannot
                      approve yet. This read-only visibility allows EC to prepare for review
                      once the committee head approves. The approval button is hidden and
                      replaced with an informational message. */}
                  {proposal.status === 'pending_head_approval' &&
                    userProfile?.executive_role !== null &&
                    !canApproveAsHead(proposal) && (
                      <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <Clock className="w-5 h-5 text-yellow-600" />
                        <div>
                          <p className="text-sm font-medium text-yellow-900">Waiting for Committee Head approval</p>
                          <p className="text-xs text-yellow-700">You'll be able to approve once the head approves</p>
                        </div>
                      </div>
                    )}

                  {/* Generic waiting message for non-EC users */}
                  {proposal.status === 'pending_head_approval' &&
                    !canApproveAsHead(proposal) &&
                    !userProfile?.executive_role && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">Waiting for Committee Head approval</span>
                      </div>
                    )}
                </div>
              </div>
            );
          })}

          {proposals.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">No proposals to review</p>
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Reject Proposal</h2>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting "{selectedProposal?.title}"
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              placeholder="Explain why this proposal is being rejected..."
            />
            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={loading || !rejectionReason.trim()}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Rejecting...' : 'Reject Proposal'}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedProposal(null);
                  setRejectionReason('');
                }}
                className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
