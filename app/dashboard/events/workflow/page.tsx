'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import ReminderButton from '@/components/ReminderButton';
import StatusIndicator from '@/components/StatusIndicator';
import { CheckCircle, Clock, XCircle, AlertCircle, Crown, Send, ArrowLeft, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_LABELS: Record<string, string> = {
  pending_head_approval: 'Under Head Review', review_by_cohead: 'Co-Head Review',
  pending_ec_approval: 'Under EC Review', rejected_by_head: 'Head Rejected',
  pending_faculty_approval: 'Under Faculty Review',
};
const STATUS_GRADIENTS: Record<string, string> = {
  pending_head_approval: 'from-amber-400 to-orange-500', review_by_cohead: 'from-violet-400 to-purple-600',
  pending_ec_approval: 'from-blue-400 to-indigo-600', rejected_by_head: 'from-red-400 to-rose-600',
  pending_faculty_approval: 'from-indigo-400 to-purple-600',
};

export default function EventWorkflowPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isHead, setIsHead] = useState(false);
  const [isEC, setIsEC] = useState(false);
  const [isFaculty, setIsFaculty] = useState(false);
  const [userCommitteeId, setUserCommitteeId] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setCurrentUser(profile); setIsEC(profile?.executive_role !== null); setIsFaculty(profile?.is_faculty || profile?.is_admin || false);
    const { data: membership } = await supabase.from('committee_members').select('committee_id, position').eq('user_id', user.id).in('position', ['head', 'co_head']).single();
    if (membership) { setIsHead(true); setUserCommitteeId(membership.committee_id); }
    const { data: eventsData } = await supabase.from('events').select(`*, committee:committee_id(name), proposer:proposed_by(name), head_approver:head_approved_by(name), ec_approvals(user_id, approved, approved_at, profile:profiles(name))`).in('status', ['pending_head_approval', 'review_by_cohead', 'pending_ec_approval', 'rejected_by_head', 'pending_faculty_approval']).order('created_at', { ascending: false });
    setEvents(eventsData || []); setLoading(false);
  }

  async function handleHeadApproval(eventId: string) {
    try { const { data: { user } } = await supabase.auth.getUser(); await supabase.from('events').update({ status: 'pending_ec_approval', head_approved_by: user?.id, head_approved_at: new Date().toISOString() }).eq('id', eventId); toast.success('Approved! → EC'); fetchData(); } catch (e: any) { toast.error(e.message); }
  }
  async function handleECApproval(eventId: string) {
    try { const { data: { user } } = await supabase.auth.getUser(); await supabase.from('ec_approvals').upsert({ event_id: eventId, user_id: user?.id, approved: true, approved_at: new Date().toISOString() }); const { data: all } = await supabase.from('ec_approvals').select('*').eq('event_id', eventId).eq('approved', true); if ((all?.length || 0) >= 2) { await supabase.from('events').update({ status: 'pending_faculty_approval' }).eq('id', eventId); toast.success('EC complete! → Faculty'); } else { toast.success(`Recorded (${all?.length}/2)`); } fetchData(); } catch (e: any) { toast.error(e.message); }
  }
  async function handleFacultyApproval(eventId: string) {
    try { const { data: { user } } = await supabase.auth.getUser(); await supabase.from('events').update({ status: 'active', faculty_approved_by: user?.id, faculty_approved_at: new Date().toISOString() }).eq('id', eventId); toast.success('Faculty Approved! Active!'); fetchData(); } catch (e: any) { toast.error(e.message); }
  }
  async function handleRejection() {
    if (!selectedEvent || !rejectionReason.trim()) { toast.error('Provide a reason'); return; }
    try { await supabase.from('events').update({ status: 'cancelled', rejection_reason: rejectionReason }).eq('id', selectedEvent.id); toast.success('Rejected'); setRejectModalOpen(false); setSelectedEvent(null); setRejectionReason(''); fetchData(); } catch (e: any) { toast.error(e.message); }
  }

  const canHead = (e: any) => { if (isFaculty) return e.status === 'pending_head_approval'; return isHead && e.status === 'pending_head_approval' && e.committee_id === userCommitteeId; };
  const canEC = (e: any) => { if (isFaculty) return e.status === 'pending_ec_approval'; return isEC && e.status === 'pending_ec_approval' && !e.ec_approvals?.some((a: any) => a.user_id === currentUser?.id && a.approved); };
  const canFaculty = (e: any) => isFaculty && e.status === 'pending_faculty_approval';
  const ecApproved = (e: any) => e.ec_approvals?.some((a: any) => a.user_id === currentUser?.id && a.approved);

  if (loading) return (
    <div className="min-h-screen bg-mesh flex items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 mx-auto mb-4 animate-pulse-glow" />
        <p className="text-gray-400 font-medium">Loading workflow...</p>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-mesh">
      <PageHeader title="Approval Workflow" />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Info */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="premium-card rounded-2xl p-5 mb-6 border-l-4 border-indigo-400">
          <h3 className="font-bold text-indigo-800 mb-1.5 text-sm">Approval Flow</h3>
          <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium">
            <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700">Head</span> → <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">EC (2)</span> → <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Faculty</span> → <span className="px-2 py-1 rounded-full bg-green-100 text-green-700">Active ✓</span>
          </div>
        </motion.div>

        <div className="space-y-5">
          {events.map((event, idx) => {
            const ecCount = event.ec_approvals?.filter((a: any) => a.approved).length || 0;
            const grad = STATUS_GRADIENTS[event.status] || 'from-gray-400 to-gray-500';
            return (
              <motion.div key={event.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: idx * 0.06 }}
                className="premium-panel rounded-2xl p-6 relative overflow-hidden group hover:shadow-xl transition-all">
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${grad}`} />
                <div className={`absolute -top-12 -right-12 w-36 h-36 rounded-full bg-gradient-to-br ${grad} opacity-[0.06] blur-3xl group-hover:opacity-[0.12] transition-all duration-500`} />

                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                    <p className="text-sm text-gray-500">{event.committee?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">by {event.proposer?.name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold text-white bg-gradient-to-r ${grad} shadow-sm`}>
                    {STATUS_LABELS[event.status] || event.status}
                  </span>
                </div>

                <p className="text-gray-600 text-sm mb-4 relative z-10">{event.description}</p>

                <div className="grid grid-cols-3 gap-3 mb-4 text-sm text-gray-500 relative z-10">
                  <div><span className="font-medium text-gray-600">Date:</span> {event.date ? new Date(event.date).toLocaleDateString() : 'TBA'}</div>
                  <div><span className="font-medium text-gray-600">Location:</span> {event.location || 'TBA'}</div>
                  <div><span className="font-medium text-gray-600">Budget:</span> ₹{event.budget?.toLocaleString('en-IN') || '0'}</div>
                </div>

                {event.review_note && (
                  <div className="mb-4 p-3 rounded-xl bg-violet-50/80 border border-violet-200/50 relative z-10 text-sm">
                    <span className="font-semibold text-violet-700">Note: </span><span className="text-violet-600">{event.review_note}</span>
                  </div>
                )}

                {(event.status === 'pending_ec_approval' || event.status === 'pending_faculty_approval') && (
                  <div className="mb-4 p-3 rounded-xl bg-blue-50/80 relative z-10">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-indigo-700">EC: {ecCount}/2</span>
                      {event.head_approver?.name && <span className="text-[10px] text-emerald-600 font-medium">✓ Head: {event.head_approver.name}</span>}
                    </div>
                    {event.ec_approvals?.filter((a: any) => a.approved).map((a: any) => (
                      <div key={a.user_id} className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center"><CheckCircle className="w-2.5 h-2.5 text-white" /></div>
                        {a.profile?.name}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 relative z-10">
                  {canHead(event) && (<>
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => handleHeadApproval(event.id)} className="btn-gradient-green px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Approve as Head</motion.button>
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setSelectedEvent(event); setRejectModalOpen(true); }} className="btn-gradient-red px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"><XCircle className="w-4 h-4" /> Reject</motion.button>
                  </>)}
                  {canEC(event) && !ecApproved(event) && (<>
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => handleECApproval(event.id)} className="btn-gradient-blue px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"><Crown className="w-4 h-4" /> Approve as EC</motion.button>
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setSelectedEvent(event); setRejectModalOpen(true); }} className="btn-gradient-red px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"><XCircle className="w-4 h-4" /> Reject</motion.button>
                  </>)}
                  {canFaculty(event) && (<>
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => handleFacultyApproval(event.id)} className="btn-gradient-green px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Faculty Approve</motion.button>
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setSelectedEvent(event); setRejectModalOpen(true); }} className="btn-gradient-red px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"><XCircle className="w-4 h-4" /> Faculty Reject</motion.button>
                  </>)}
                  {ecApproved(event) && event.status === 'pending_ec_approval' && <span className="text-emerald-500 font-semibold text-sm flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> You approved</span>}
                  {event.status === 'pending_head_approval' && !canHead(event) && <span className="text-gray-400 text-sm flex items-center gap-1.5"><Clock className="w-4 h-4" /> Waiting for Head</span>}
                  {event.status === 'review_by_cohead' && <span className="text-violet-400 text-sm flex items-center gap-1.5"><Send className="w-4 h-4" /> Co-Head review</span>}
                  {event.status === 'pending_faculty_approval' && !canFaculty(event) && <span className="text-indigo-400 text-sm flex items-center gap-1.5"><Clock className="w-4 h-4" /> Waiting for Faculty</span>}
                  <StatusIndicator entityType="approval" timestamp={event.updated_at} currentStatus={event.status} />
                  <ReminderButton entityId={event.id} entityType="approval" />
                </div>
              </motion.div>
            );
          })}
        </div>

        {events.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="premium-panel rounded-2xl p-16 text-center">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}><AlertCircle className="w-16 h-16 mx-auto mb-4 text-indigo-200" /></motion.div>
            <p className="text-gray-400 font-semibold">No events pending approval</p>
          </motion.div>
        )}
      </div>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectModalOpen && selectedEvent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h2 className="text-xl font-bold text-red-600 mb-2">Reject Event</h2>
              <p className="text-sm text-gray-500 mb-4">Rejecting &quot;{selectedEvent.title}&quot;</p>
              <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={4} className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 focus:ring-2 focus:ring-red-500 focus:border-transparent" placeholder="Reason..." />
              <div className="flex gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleRejection} disabled={!rejectionReason.trim()} className="flex-1 btn-gradient-red px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50">Reject</motion.button>
                <button onClick={() => { setRejectModalOpen(false); setSelectedEvent(null); setRejectionReason(''); }} className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-200 transition-colors">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
