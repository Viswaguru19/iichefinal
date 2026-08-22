'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { useEffect, useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import DashboardAtmosphere from '@/components/react-bits/DashboardAtmosphere';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Clock, Users, Crown, Edit, AlertTriangle, Ban, CalendarDays, Send, RotateCcw, Sparkles, ArrowLeft, Filter, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import EditEventModal from '@/components/proposals/EditEventModal';
import RevokeModal from '@/components/proposals/RevokeModal';
import EditHistoryView from '@/components/proposals/EditHistoryView';
import ReminderButton from '@/components/ReminderButton';
import {
  normalizeProposalThresholds,
  executiveRoleCountsForProposalEc,
  proposalEcSatisfied,
  proposalEcProgress,
} from '@/lib/proposal-workflow-rules';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_head_approval: 'Under Head Review',
  pending_second_head_approval: 'Second Head Review',
  review_by_cohead: 'Sent for Review (Co-Head)',
  pending_ec_approval: 'Under EC Review',
  rejected_by_head: 'Head Rejected',
  pending_faculty_approval: 'Under Faculty Review', faculty_approved: 'Faculty Approved (Active)',
  active: 'Active', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
};
const STATUS_GRADIENTS: Record<string, string> = {
  draft: 'from-gray-400 to-gray-500',
  pending_head_approval: 'from-amber-400 to-orange-500',
  pending_second_head_approval: 'from-orange-400 to-rose-500',
  review_by_cohead: 'from-violet-400 to-purple-600',
  pending_ec_approval: 'from-blue-400 to-indigo-600',
  rejected_by_head: 'from-red-400 to-rose-600', pending_faculty_approval: 'from-indigo-400 to-purple-600',
  faculty_approved: 'from-emerald-400 to-green-600', active: 'from-emerald-400 to-teal-600',
  in_progress: 'from-cyan-400 to-blue-600', completed: 'from-green-400 to-emerald-600',
  cancelled: 'from-red-500 to-rose-700',
};

const FILTERABLE_STATUSES = new Set([
  'all',
  'pending_head_approval',
  'pending_second_head_approval',
  'review_by_cohead',
  'pending_ec_approval',
  'pending_faculty_approval',
  'active',
  'cancelled',
]);

/** DB may store co_head / co-head / Co-Head — normalize for comparisons. */
function normalizeCommitteePosition(pos: string | null | undefined): string {
  if (pos == null || !String(pos).trim()) return '';
  return String(pos).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function ProposalsPageClient() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userCommittees, setUserCommittees] = useState<string[]>([]);
  const [ecApprovals, setEcApprovals] = useState<any>({});
  const [profilesMap, setProfilesMap] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  /** On save, set event status to this value; null = leave status unchanged (Review & Edit only). */
  const [editResubmitTarget, setEditResubmitTarget] = useState<string | null>(null);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showDateModal, setShowDateModal] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [dateReason, setDateReason] = useState('');
  const [showSendReviewModal, setShowSendReviewModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<'cohead' | 'head' | 'ec'>('head');
  const [reviewNote, setReviewNote] = useState('');
  const [workflowConfig, setWorkflowConfig] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const s = searchParams.get('status');
    if (s && FILTERABLE_STATUSES.has(s)) setStatusFilter(s);
  }, [searchParams]);

  useEffect(() => { loadProposals(); }, []);

  async function loadProposals() {
    setPageLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');
    const { data: configData } = await supabase.from('workflow_config').select('*').eq('workflow_type', 'approval_thresholds').maybeSingle();
    setWorkflowConfig(normalizeProposalThresholds((configData as any)?.config));
    const { data: profile } = await supabase.from('profiles').select('*, committee_members(position, committee_id)').eq('id', user.id).single();
    if (!profile) { toast.error('Failed to load profile'); return; }
    setUserProfile(profile);
    setUserCommittees((profile as any)?.committee_members?.map((m: any) => m.committee_id) || []);
    const { data } = await supabase
      .from('events')
      .select(
        `*, committee:committees(name), proposer:profiles!events_proposed_by_fkey(name), head_approver:profiles!events_head_approved_by_fkey(name), second_head_approver:profiles!events_second_head_approved_by_fkey(name), faculty_approver:profiles!events_faculty_approved_by_fkey(name)`,
      )
      .order('created_at', { ascending: false });
    setProposals(data || []);
    if (data && data.length > 0) {
      const eventIds = data.map((e: { id: string }) => e.id);
      const { data: approvals } = await supabase.from('ec_approvals').select('*, profiles(name, executive_role)').in('event_id', eventIds);
      const approvalsMap: any = {};
      approvals?.forEach((a: { event_id: string }) => { if (!approvalsMap[a.event_id]) approvalsMap[a.event_id] = []; approvalsMap[a.event_id].push(a); });
      setEcApprovals(approvalsMap);
      const { data: profiles } = await supabase.from('profiles').select('id, name');
      const pMap: any = {};
      profiles?.forEach((p: { id: string }) => { pMap[p.id] = p; });
      setProfilesMap(pMap);
    }
    setPageLoading(false);
  }

  async function fetchProposalThresholds() {
    const { data } = await supabase.from('workflow_config').select('config').eq('workflow_type', 'approval_thresholds').maybeSingle();
    return normalizeProposalThresholds((data as any)?.config);
  }

  async function handleHeadApprove(proposalId: string) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const t = await fetchProposalThresholds();
      const nextStatus = t.proposal_head_approval === 'two_heads' ? 'pending_second_head_approval' : 'pending_ec_approval';
      const { error } = await supabase
        .from('events')
        .update({
          status: nextStatus,
          head_approved_by: user?.id,
          head_approved_at: new Date().toISOString(),
        })
        .eq('id', proposalId);
      if (error) throw error;
      toast.success(
        nextStatus === 'pending_second_head_approval'
          ? 'First head recorded — waiting for second head'
          : 'Approved! Sent to EC',
      );
      loadProposals();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }

  async function handleSecondHeadApproveToEC(proposalId: string) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ev, error: fetchErr } = await supabase
        .from('events')
        .select('head_approved_by, status')
        .eq('id', proposalId)
        .single();
      if (fetchErr) throw fetchErr;
      if (!ev || ev.status !== 'pending_second_head_approval') {
        toast.error('This proposal is not waiting for a second head.');
        return;
      }
      if (ev.head_approved_by && user?.id === ev.head_approved_by) {
        toast.error('The second approval must be from a different head than the first.');
        return;
      }
      const { error } = await supabase
        .from('events')
        .update({
          status: 'pending_ec_approval',
          second_head_approved_by: user?.id,
          second_head_approved_at: new Date().toISOString(),
        })
        .eq('id', proposalId);
      if (error) throw error;
      toast.success('Second head approved — sent to EC');
      loadProposals();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleECApprove(proposalId: string) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const t = await fetchProposalThresholds();
      const er = userProfile?.executive_role;
      if (!isFaculty && !isAdmin) {
        if (!executiveRoleCountsForProposalEc(er, t.proposal_ec_approval)) {
          toast.error('Only Secretary / Associate Secretary / Joint Secretary / Associate Joint Secretary can approve at this step.');
          setLoading(false);
          return;
        }
      }
      await supabase.from('ec_approvals').upsert({
        event_id: proposalId,
        user_id: user?.id,
        approved: true,
        approved_at: new Date().toISOString(),
      });
      const { data: allApprovals } = await supabase
        .from('ec_approvals')
        .select('*, profiles(executive_role)')
        .eq('event_id', proposalId)
        .eq('approved', true);
      if (proposalEcSatisfied(t.proposal_ec_approval, allApprovals || [])) {
        await supabase.from('events').update({ status: 'pending_faculty_approval' }).eq('id', proposalId);
        toast.success('EC complete! Sent to Faculty.');
      } else {
        const prog = proposalEcProgress(t.proposal_ec_approval, allApprovals || []);
        toast.success(`Recorded (${prog.done}/${prog.total} requirement slots filled)`);
      }
      loadProposals();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }
  async function handleFacultyApprove(proposalId: string) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('events').update({ status: 'active', faculty_approved_by: user?.id, faculty_approved_at: new Date().toISOString() }).eq('id', proposalId);
      if (error) throw error;
      toast.success('Faculty Approved! Event is Active!'); loadProposals();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }
  async function handleReject() {
    if (!selectedProposal || !rejectionReason.trim()) { toast.error('Provide a reason'); return; }
    setLoading(true);
    try {
      const isHead = userProfile?.committee_members?.some(
        (m: any) => m.committee_id === selectedProposal.committee_id && normalizeCommitteePosition(m.position) === 'head',
      );
      const updateData: any = { rejection_reason: rejectionReason };
      if (
        isHead &&
        (selectedProposal.status === 'pending_head_approval' || selectedProposal.status === 'pending_second_head_approval')
      ) {
        updateData.status = 'rejected_by_head';
        updateData.head_rejection_reason = rejectionReason;
        updateData.head_rejected_at = new Date().toISOString();
      } else {
        updateData.status = 'cancelled';
      }
      await supabase.from('events').update(updateData).eq('id', selectedProposal.id);
      toast.success('Rejected'); setShowRejectModal(false); setSelectedProposal(null); setRejectionReason(''); loadProposals();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }
  async function handleAcceptRejection(proposalId: string) {
    setLoading(true);
    try { const { error } = await supabase.from('events').update({ status: 'cancelled' }).eq('id', proposalId); if (error) throw error; toast.success('Cancelled'); loadProposals(); }
    catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }
  async function handleCancelEvent() {
    if (!selectedProposal || !cancelReason.trim()) { toast.error('Provide a reason'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('events').update({ status: 'cancelled', rejection_reason: cancelReason }).eq('id', selectedProposal.id);
      if (error) throw error;
      toast.success('Event cancelled'); setShowCancelModal(false); setSelectedProposal(null); setCancelReason(''); loadProposals();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }
  async function handleChangeDate() {
    if (!selectedProposal || !newDate) { toast.error('Select a date'); return; }
    setLoading(true);
    try {
      await supabase.from('events').update({ date: newDate, event_date: newDate }).eq('id', selectedProposal.id);
      toast.success('Date updated'); setShowDateModal(false); setSelectedProposal(null); setNewDate(''); loadProposals();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }
  async function handleSendForReview() {
    if (!selectedProposal) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const statusMap: Record<string, string> = { cohead: 'review_by_cohead', head: 'pending_head_approval', ec: 'pending_ec_approval' };
      const nextStatus = statusMap[reviewTarget];
      const { error: sendErr } = await supabase
        .from('events')
        .update({
          status: nextStatus,
          review_note: reviewNote || null,
          review_sent_by: user?.id,
          review_sent_at: new Date().toISOString(),
        })
        .eq('id', selectedProposal.id);
      if (sendErr) throw sendErr;
      toast.success(`Sent to ${reviewTarget === 'cohead' ? 'Co-Head' : reviewTarget === 'head' ? 'Head' : 'EC'}`);
      setShowSendReviewModal(false); setSelectedProposal(null); setReviewNote(''); loadProposals();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }

  const isFaculty = userProfile?.is_faculty || false;
  const isAdmin = userProfile?.is_admin || false;
  const isEC = userProfile?.executive_role !== null && userProfile?.executive_role !== undefined;

  const committeeRole = (committeeId: string) =>
    normalizeCommitteePosition(
      userProfile?.committee_members?.find((m: any) => m.committee_id === committeeId)?.position as string | undefined,
    );

  const isCommitteeHead = (committeeId: string) =>
    !!userProfile?.committee_members?.some(
      (m: any) => m.committee_id === committeeId && normalizeCommitteePosition(m.position) === 'head',
    );

  const canApproveAsHead = (p: any) => {
    if (isFaculty || isAdmin) return p.status === 'pending_head_approval';
    if (!userCommittees.includes(p.committee_id)) return false;
    const m = userProfile?.committee_members?.find((m: any) => m.committee_id === p.committee_id);
    return normalizeCommitteePosition(m?.position) === 'head' && p.status === 'pending_head_approval';
  };

  /** Co-head (or faculty/admin) can edit while proposal is in co-head review — same as head’s “Review & Edit” for pending_head. */
  const canReviewEditAsCoHead = (p: any) => {
    if (p.status !== 'review_by_cohead') return false;
    if (isFaculty || isAdmin) return true;
    if (!userCommittees.includes(p.committee_id)) return false;
    return committeeRole(p.committee_id) === 'co_head';
  };

  const proposalThresholds = normalizeProposalThresholds(workflowConfig as any);

  /** Two-heads workflow: waiting for second head — committee heads (or faculty/admin) can review/edit. */
  const canReviewEditWhileSecondHead = (p: any) => {
    if (p.status !== 'pending_second_head_approval') return false;
    if (isFaculty || isAdmin) return true;
    if (!userCommittees.includes(p.committee_id)) return false;
    return isCommitteeHead(p.committee_id);
  };

  /** Second approval must be a different person than the first; must be a committee head or faculty/admin. */
  const canSecondHeadAdvanceToEc = (p: any) => {
    if (p.status !== 'pending_second_head_approval') return false;
    if (proposalThresholds.proposal_head_approval !== 'two_heads') return false;
    if (p.head_approved_by && userProfile?.id === p.head_approved_by) return false;
    if (isFaculty || isAdmin) return true;
    return isCommitteeHead(p.committee_id);
  };

  const canApproveAsEC = (p: any) => {
    if (p.status === 'rejected_by_head') return isFaculty || isAdmin || isEC;
    if (p.status !== 'pending_ec_approval') return false;
    if (isFaculty || isAdmin) return true;
    if (!isEC) return false;
    return executiveRoleCountsForProposalEc(userProfile?.executive_role, proposalThresholds.proposal_ec_approval);
  };
  const canReviewEditAtEcOrFacultyStage = (p: any) => {
    if (!(p.status === 'pending_ec_approval' || p.status === 'pending_faculty_approval')) return false;
    return isFaculty || isAdmin || isEC;
  };
  const canApproveAsFaculty = (p: any) => (isFaculty || isAdmin) && p.status === 'pending_faculty_approval';
  const canResubmitOwn = (p: any) => {
    const mine = p.proposed_by === userProfile?.id || p.created_by === userProfile?.id;
    return mine && ['rejected_by_head', 'review_by_cohead', 'pending_second_head_approval', 'cancelled'].includes(p.status);
  };
  const getResubmitStatus = () => {
    const isFacultyOrAdmin = !!(userProfile?.is_faculty || userProfile?.is_admin);
    const isExecutiveMember = !!(userProfile?.executive_role);
    if (isFacultyOrAdmin) return 'active';
    if (isExecutiveMember) return 'pending_faculty_approval';
    // Same as new proposals: head review first, not EC.
    return 'pending_head_approval';
  };
  const canCancelEvent = (p: any) => p.status !== 'cancelled' && p.status !== 'completed' && (isFaculty || isAdmin || isEC);
  const canChangeDate = (p: any) => p.status !== 'cancelled' && p.status !== 'completed' && (isFaculty || isAdmin || isEC || userCommittees.includes(p.committee_id));
  const canSendForReview = (p: any) => {
    if (p.status === 'cancelled' || p.status === 'completed') return false;
    if (isFaculty || isAdmin) return true;
    if (isEC) return p.status === 'pending_ec_approval' || p.status === 'rejected_by_head';
    return (
      userProfile?.committee_members?.some(
        (m: any) => m.committee_id === p.committee_id && normalizeCommitteePosition(m.position) === 'head',
      ) && p.status === 'pending_head_approval'
    );
  };
  const hasECApproved = (p: any) => (ecApprovals[p.id] || []).some((a: any) => a.user_id === userProfile?.id && a.approved);
  const getReviewTargets = (p: any) => {
    const t: { value: 'cohead' | 'head' | 'ec'; label: string }[] = [];
    if (isFaculty || isAdmin) { t.push({ value: 'cohead', label: 'Co-Head' }, { value: 'head', label: 'Head' }, { value: 'ec', label: 'EC' }); }
    else if (isEC) { t.push({ value: 'head', label: 'Head' }); }
    else { t.push({ value: 'cohead', label: 'Co-Head' }); }
    return t;
  };

  const filtered = statusFilter === 'all' ? proposals : proposals.filter(p => p.status === statusFilter);

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 mx-auto mb-4 animate-pulse-glow" />
          <p className="text-gray-400 font-medium">Loading proposals...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      <DashboardAtmosphere subtitle="Review, approve, and track event proposals." />
      <PageHeader title="Event Proposals" gradientTitle />

      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        {/* Filter bar */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="premium-card rounded-2xl p-4 mb-6 flex items-center gap-4 flex-wrap">
          <Filter className="w-5 h-5 text-indigo-400" />
          {['all', 'pending_head_approval', 'pending_second_head_approval', 'review_by_cohead', 'pending_ec_approval', 'pending_faculty_approval', 'active', 'cancelled'].map(s => (
            <motion.button key={s} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${statusFilter === s
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/20'
                : 'bg-white/60 text-gray-500 hover:bg-white/80'}`}>
              {s === 'all' ? 'All' : STATUS_LABELS[s]?.replace(' (Active)', '') || s}
            </motion.button>
          ))}
          <span className="ml-auto text-xs text-gray-400 font-medium">{filtered.length} events</span>
        </motion.div>

        {/* Cards */}
        <div className="space-y-5">
          <AnimatePresence>
            {filtered.map((proposal, idx) => {
              const approvals = ecApprovals[proposal.id] || [];
              const approvedRows = approvals.filter((a: any) => a.approved);
              const ecProg = proposalEcProgress(proposalThresholds.proposal_ec_approval, approvedRows);
              const ecPct = ecProg.total > 0 ? (ecProg.done / ecProg.total) * 100 : 0;
              const grad = STATUS_GRADIENTS[proposal.status] || 'from-gray-400 to-gray-500';

              return (
                <motion.div key={proposal.id}
                  initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.45, delay: idx * 0.05 }}
                  className="premium-panel rounded-2xl p-6 relative overflow-hidden group hover:shadow-xl transition-all duration-300"
                >
                  {/* Top gradient accent */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${grad}`} />
                  {/* Decorative orb */}
                  <div className={`absolute -top-12 -right-12 w-36 h-36 rounded-full bg-gradient-to-br ${grad} opacity-[0.06] blur-3xl group-hover:opacity-[0.12] transition-all duration-500`} />

                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-4 relative z-10">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 break-words">{proposal.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{proposal.committee?.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">by {proposal.proposer?.name}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold text-white bg-gradient-to-r ${grad} shadow-sm whitespace-nowrap shrink-0`}>
                      {STATUS_LABELS[proposal.status] || proposal.status}
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 relative z-10">{proposal.description}</p>
                  {Array.isArray(proposal.documents) && proposal.documents.length > 0 && (
                    <div className="mb-4 p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 relative z-10">
                      <p className="text-xs font-semibold text-indigo-700 mb-1">Attachments</p>
                      <div className="space-y-1">
                        {proposal.documents.map((doc: any, i: number) => (
                          <a
                            key={`${proposal.id}-doc-${i}`}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-indigo-600 hover:text-indigo-800 truncate"
                          >
                            {doc.name || `Document ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-500 mb-4 relative z-10">
                    <div><span className="font-medium text-gray-600">Date:</span> {proposal.date ? new Date(proposal.date).toLocaleString('en-IN') : 'TBA'}</div>
                    {proposal.location && <div><span className="font-medium text-gray-600">Location:</span> {proposal.location}</div>}
                    {proposal.budget && <div><span className="font-medium text-gray-600">Budget:</span> ₹{proposal.budget.toLocaleString('en-IN')}</div>}
                  </div>

                  {/* Review Note */}
                  {proposal.review_note && (
                    <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/50 relative z-10">
                      <p className="text-xs font-semibold text-violet-700">Review Note</p>
                      <p className="text-sm text-violet-600 mt-0.5">{proposal.review_note}</p>
                    </div>
                  )}

                  {/* EC Progress */}
                  {proposal.status === 'pending_ec_approval' && (
                    <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-indigo-500" />
                        <span className="font-semibold text-indigo-800 text-sm">
                          EC progress: {ecProg.done}/{ecProg.total}
                          {proposalThresholds.proposal_ec_approval === 'tiered_pair'
                            ? ' (need sec. tier + joint tier)'
                            : ' (any one sec./joint sec. role)'}
                        </span>
                      </div>
                      <div className="w-full bg-indigo-100 rounded-full h-2 overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${ecPct}%` }}
                          transition={{ duration: 0.8 }} className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full" />
                      </div>
                      {approvals.filter((a: any) => a.approved).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {approvals.filter((a: any) => a.approved).map((a: any) => (
                            <span key={a.user_id} className="text-[10px] bg-white/80 text-indigo-600 px-2 py-0.5 rounded-full font-medium">✓ {a.profiles?.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Approval History — show EC & faculty approver names for committee heads and everyone */}
                  {(proposal.head_approved_by ||
                    proposal.second_head_approved_by ||
                    approvedRows.length > 0 ||
                    proposal.faculty_approved_by) && (
                    <div className="mb-4 p-3 rounded-xl bg-gray-50/80 relative z-10">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Approval Trail</p>
                      <div className="space-y-1.5">
                        {proposal.head_approved_by && (
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
                              <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-gray-600">
                              Head (1st): {proposal.head_approver?.name || profilesMap[proposal.head_approved_by]?.name || '—'}
                            </span>
                          </div>
                        )}
                        {proposal.second_head_approved_by && (
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shrink-0">
                              <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-gray-600">
                              Head (2nd):{' '}
                              {proposal.second_head_approver?.name ||
                                profilesMap[proposal.second_head_approved_by]?.name ||
                                '—'}
                            </span>
                          </div>
                        )}
                        {approvedRows.length > 0 && (
                          <div className="flex items-start gap-2 text-sm">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                              <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                            <div className="text-gray-600 min-w-0">
                              <span className="font-medium text-gray-700">
                                EC ({ecProg.done}/{ecProg.total} slots
                                {proposalThresholds.proposal_ec_approval === 'tiered_pair' ? ', sec. + joint' : ''})
                              </span>
                              <span className="text-gray-500"> — </span>
                              <span>
                                {approvals
                                  .filter((a: any) => a.approved)
                                  .map((a: any) => a.profiles?.name)
                                  .filter(Boolean)
                                  .join(', ') || '—'}
                              </span>
                            </div>
                          </div>
                        )}
                        {proposal.faculty_approved_by && (
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shrink-0">
                              <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-gray-600">
                              Faculty:{' '}
                              {proposal.faculty_approver?.name ||
                                profilesMap[proposal.faculty_approved_by]?.name ||
                                '—'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rejection */}
                  {proposal.status === 'cancelled' && proposal.rejection_reason && (
                    <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/50 relative z-10">
                      <p className="text-xs font-bold text-red-600">Reason</p>
                      <p className="text-sm text-red-500 mt-0.5">{proposal.rejection_reason}</p>
                    </div>
                  )}

                  {/* Head rejection for EC */}
                  {proposal.status === 'rejected_by_head' && (isEC || isFaculty || isAdmin) && proposal.head_rejection_reason && (
                    <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-200/50 relative z-10">
                      <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-xs font-bold text-red-700">Head Rejected</span></div>
                      <p className="text-sm text-red-500 mt-1">{proposal.head_rejection_reason}</p>
                    </div>
                  )}

                  {proposal.edit_history && Array.isArray(proposal.edit_history) && proposal.edit_history.length > 0 && (
                    <div className="relative z-10"><EditHistoryView history={proposal.edit_history} profiles={profilesMap} /></div>
                  )}

                  {/* ACTION BUTTONS */}
                  <div className="flex flex-wrap gap-2 mt-4 relative z-10">
                    {/* Remind button for pending proposals */}
                    {['pending_head_approval', 'pending_second_head_approval', 'pending_ec_approval', 'pending_faculty_approval', 'review_by_cohead'].includes(proposal.status) && (
                      <ReminderButton entityId={proposal.id} entityType="approval" />
                    )}
                    {canApproveAsHead(proposal) && (<>
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setEditResubmitTarget(null); setSelectedProposal(proposal); setShowEditModal(true); }} disabled={loading} className="btn-gradient-blue px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><Edit className="w-4 h-4" /> Review & Edit</motion.button>
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => handleHeadApprove(proposal.id)} disabled={loading} className="btn-gradient-green px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><CheckCircle className="w-4 h-4" />{proposalThresholds.proposal_head_approval === 'two_heads' ? 'Approve (1 of 2 heads)' : 'Approve → EC'}</motion.button>
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setSelectedProposal(proposal); setShowRejectModal(true); }} disabled={loading} className="btn-gradient-red px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><XCircle className="w-4 h-4" /> Reject</motion.button>
                    </>)}
                    {canReviewEditAsCoHead(proposal) && !canApproveAsHead(proposal) && !canResubmitOwn(proposal) && (<>
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setEditResubmitTarget(null); setSelectedProposal(proposal); setShowEditModal(true); }} disabled={loading} className="btn-gradient-blue px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><Edit className="w-4 h-4" /> Review & Edit</motion.button>
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setEditResubmitTarget('pending_head_approval'); setSelectedProposal(proposal); setShowEditModal(true); }} disabled={loading} className="btn-gradient-purple px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><RotateCcw className="w-4 h-4" /> Edit & Resubmit</motion.button>
                    </>)}
                    {canReviewEditWhileSecondHead(proposal) && !canApproveAsHead(proposal) && !canResubmitOwn(proposal) && (<>
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setEditResubmitTarget(null); setSelectedProposal(proposal); setShowEditModal(true); }} disabled={loading} className="btn-gradient-blue px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><Edit className="w-4 h-4" /> Review & Edit</motion.button>
                      {canSecondHeadAdvanceToEc(proposal) && (
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => handleSecondHeadApproveToEC(proposal.id)} disabled={loading} className="btn-gradient-green px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><CheckCircle className="w-4 h-4" /> Approve (2nd head) → EC</motion.button>
                      )}
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setEditResubmitTarget('pending_head_approval'); setSelectedProposal(proposal); setShowEditModal(true); }} disabled={loading} className="btn-gradient-purple px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><RotateCcw className="w-4 h-4" /> Edit & Resubmit</motion.button>
                    </>)}
                    {proposal.status === 'rejected_by_head' && canApproveAsEC(proposal) && (<>
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => handleAcceptRejection(proposal.id)} disabled={loading} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-all"><CheckCircle className="w-4 h-4" /> Accept Rejection</motion.button>
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setSelectedProposal(proposal); setShowRevokeModal(true); }} disabled={loading} className="btn-gradient-amber px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><RotateCcw className="w-4 h-4" /> Revoke</motion.button>
                    </>)}
                    {proposal.status === 'pending_ec_approval' && canApproveAsEC(proposal) && !hasECApproved(proposal) && (<>
                      {canReviewEditAtEcOrFacultyStage(proposal) && !canResubmitOwn(proposal) && (
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setEditResubmitTarget(null); setSelectedProposal(proposal); setShowEditModal(true); }} disabled={loading} className="btn-gradient-blue px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><Edit className="w-4 h-4" /> Review & Edit</motion.button>
                      )}
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => handleECApprove(proposal.id)} disabled={loading} className="btn-gradient-blue px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><Crown className="w-4 h-4" /> Approve as EC</motion.button>
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setSelectedProposal(proposal); setShowRejectModal(true); }} disabled={loading} className="btn-gradient-red px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><XCircle className="w-4 h-4" /> Reject</motion.button>
                    </>)}
                    {proposal.status === 'pending_ec_approval' && canApproveAsEC(proposal) && hasECApproved(proposal) && (
                      <>
                        {canReviewEditAtEcOrFacultyStage(proposal) && !canResubmitOwn(proposal) && (
                          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setEditResubmitTarget(null); setSelectedProposal(proposal); setShowEditModal(true); }} disabled={loading} className="btn-gradient-blue px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><Edit className="w-4 h-4" /> Review & Edit</motion.button>
                        )}
                        <span className="flex items-center gap-2 text-emerald-500 font-semibold text-sm"><CheckCircle className="w-5 h-5" /> You approved this</span>
                      </>
                    )}
                    {canApproveAsFaculty(proposal) && (<>
                      {canReviewEditAtEcOrFacultyStage(proposal) && !canResubmitOwn(proposal) && (
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setEditResubmitTarget(null); setSelectedProposal(proposal); setShowEditModal(true); }} disabled={loading} className="btn-gradient-blue px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><Edit className="w-4 h-4" /> Review & Edit</motion.button>
                      )}
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => handleFacultyApprove(proposal.id)} disabled={loading} className="btn-gradient-green px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><CheckCircle className="w-4 h-4" /> Faculty Approve</motion.button>
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setSelectedProposal(proposal); setRejectionReason(''); setShowRejectModal(true); }} disabled={loading} className="btn-gradient-red px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><XCircle className="w-4 h-4" /> Faculty Reject</motion.button>
                    </>)}
                    {canSendForReview(proposal) && (
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setSelectedProposal(proposal); const t = getReviewTargets(proposal); if (t.length) setReviewTarget(t[0].value); setShowSendReviewModal(true); }} disabled={loading} className="btn-gradient-purple px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><Send className="w-4 h-4" /> Send for Review</motion.button>
                    )}
                    {canCancelEvent(proposal) && (
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setSelectedProposal(proposal); setShowCancelModal(true); }} disabled={loading} className="bg-gradient-to-r from-red-400 to-rose-500 hover:from-red-500 hover:to-rose-600 text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-all shadow-sm"><Ban className="w-4 h-4" /> Cancel</motion.button>
                    )}
                    {canChangeDate(proposal) && (
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setSelectedProposal(proposal); setNewDate(''); setShowDateModal(true); }} disabled={loading} className="btn-gradient-amber px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><CalendarDays className="w-4 h-4" /> Date</motion.button>
                    )}
                    {proposal.status === 'pending_head_approval' && !canApproveAsHead(proposal) && !canSendForReview(proposal) && (
                      <div className="flex items-center gap-2 text-gray-400 text-sm"><Clock className="w-4 h-4" /> Waiting for Head</div>
                    )}
                    {proposal.status === 'pending_ec_approval' && !canApproveAsEC(proposal) && !canSendForReview(proposal) && (
                      <div className="flex items-center gap-2 text-gray-400 text-sm"><Clock className="w-4 h-4" /> Waiting for EC</div>
                    )}
                    {proposal.status === 'pending_faculty_approval' && !canApproveAsFaculty(proposal) && (
                      <div className="flex items-center gap-2 text-gray-400 text-sm"><Clock className="w-4 h-4" /> Waiting for Faculty</div>
                    )}
                    {proposal.status === 'review_by_cohead' && !canReviewEditAsCoHead(proposal) && (
                      <div className="flex items-center gap-2 text-violet-400 text-sm"><Clock className="w-4 h-4" /> Waiting for Co-Head review</div>
                    )}
                    {proposal.status === 'pending_second_head_approval' && !canReviewEditWhileSecondHead(proposal) && (
                      <div className="flex items-center gap-2 text-orange-500 text-sm"><Clock className="w-4 h-4" /> Waiting for second head</div>
                    )}
                    {canResubmitOwn(proposal) && (
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => { setEditResubmitTarget(getResubmitStatus()); setSelectedProposal(proposal); setShowEditModal(true); }}
                        disabled={loading}
                        className="btn-gradient-purple px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" /> Edit & Resubmit
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="premium-panel rounded-2xl p-16 text-center">
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}><Sparkles className="w-16 h-16 mx-auto mb-4 text-indigo-200" /></motion.div>
              <p className="text-gray-400 font-semibold">No proposals found</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* MODALS */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Reject Proposal</h2>
              <p className="text-sm text-gray-500 mb-4">Reason for rejecting &quot;{selectedProposal?.title}&quot;</p>
              <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={4} className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="Explain why..." />
              <div className="flex gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={selectedProposal?.status === 'pending_faculty_approval' ? handleReject : handleReject} disabled={loading || !rejectionReason.trim()} className="flex-1 btn-gradient-red px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50">{loading ? 'Rejecting...' : 'Reject'}</motion.button>
                <button onClick={() => { setShowRejectModal(false); setSelectedProposal(null); setRejectionReason(''); }} className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-200 transition-colors">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showCancelModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h2 className="text-xl font-bold text-red-600 mb-2">Cancel Event</h2>
              <p className="text-sm text-gray-500 mb-4">This will permanently cancel &quot;{selectedProposal?.title}&quot;</p>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 focus:ring-2 focus:ring-red-500 focus:border-transparent" placeholder="Reason..." />
              <div className="flex gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCancelEvent} disabled={loading || !cancelReason.trim()} className="flex-1 btn-gradient-red px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50">{loading ? 'Cancelling...' : 'Cancel Event'}</motion.button>
                <button onClick={() => { setShowCancelModal(false); setSelectedProposal(null); setCancelReason(''); }} className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-200 transition-colors">Go Back</button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showDateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Change Date</h2>
              <p className="text-sm text-gray-500 mb-4">Update date for &quot;{selectedProposal?.title}&quot;</p>
              <input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-3 focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
              <textarea value={dateReason} onChange={(e) => setDateReason(e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 focus:ring-2 focus:ring-amber-500 focus:border-transparent" placeholder="Reason (optional)" />
              <div className="flex gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleChangeDate} disabled={loading || !newDate} className="flex-1 btn-gradient-amber px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50">{loading ? 'Updating...' : 'Update Date'}</motion.button>
                <button onClick={() => { setShowDateModal(false); setSelectedProposal(null); setNewDate(''); setDateReason(''); }} className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-200 transition-colors">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showSendReviewModal && selectedProposal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Send for Review</h2>
              <p className="text-sm text-gray-500 mb-4">Send &quot;{selectedProposal?.title}&quot; for review</p>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Send to:</label>
              <select value={reviewTarget} onChange={(e) => setReviewTarget(e.target.value as any)} className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                {getReviewTargets(selectedProposal).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent" placeholder="Note (optional)" />
              <div className="flex gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSendForReview} disabled={loading} className="flex-1 btn-gradient-purple px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50">{loading ? 'Sending...' : 'Send'}</motion.button>
                <button onClick={() => { setShowSendReviewModal(false); setSelectedProposal(null); setReviewNote(''); }} className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-200 transition-colors">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showEditModal && selectedProposal && (
        <EditEventModal
          event={selectedProposal}
          resubmitToStatus={editResubmitTarget}
          onClose={() => { setShowEditModal(false); setSelectedProposal(null); setEditResubmitTarget(null); }}
          onSuccess={loadProposals}
        />
      )}
      {showRevokeModal && selectedProposal && <RevokeModal event={selectedProposal} onClose={() => { setShowRevokeModal(false); setSelectedProposal(null); }} onSuccess={loadProposals} />}
    </div>
  );
}

export default function ProposalsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-mesh flex items-center justify-center text-gray-600">Loading proposals…</div>}>
      <ProposalsPageClient />
    </Suspense>
  );
}
