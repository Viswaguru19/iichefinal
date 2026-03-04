'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { approveEventAsHead, approveEventAsEC, rejectEvent } from '@/lib/approval-workflow';

export default function EventWorkflowPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isHead, setIsHead] = useState(false);
  const [isEC, setIsEC] = useState(false);
  const [userCommitteeId, setUserCommitteeId] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setCurrentUser(profile);
    setIsEC(profile?.executive_role !== null);

    // Check if user is a committee head
    const { data: membership } = await supabase
      .from('committee_members')
      .select('committee_id, position')
      .eq('user_id', user.id)
      .eq('position', 'head')
      .single();

    if (membership) {
      setIsHead(true);
      setUserCommitteeId(membership.committee_id);
    }

    // Fetch events pending approval
    const { data: eventsData } = await supabase
      .from('events')
      .select(`
        *,
        committee:committee_id(name),
        proposer:proposed_by(name),
        head_approver:head_approved_by(name),
        ec_approvals(user_id, approved, approved_at, profile:profiles(name))
      `)
      .in('status', ['pending_head_approval', 'pending_ec_approval'])
      .order('created_at', { ascending: false });

    setEvents(eventsData || []);
    setLoading(false);
  }

  async function handleHeadApproval(eventId: string) {
    try {
      await approveEventAsHead(eventId, currentUser.id, currentUser.role);
      toast.success('Event approved! Moving to EC approval.');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve event');
    }
  }

  async function handleECApproval(eventId: string) {
    try {
      const result = await approveEventAsEC(eventId, currentUser.id, currentUser.role);
      if (result.thresholdReached) {
        toast.success('Event approved! Moving to Event Progress.');
      } else {
        toast.success('Your approval has been recorded.');
      }
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve event');
    }
  }

  async function handleRejection() {
    if (!selectedEvent || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      await rejectEvent(selectedEvent.id, currentUser.id, currentUser.role, rejectionReason);
      toast.success('Event rejected');
      setRejectModalOpen(false);
      setSelectedEvent(null);
      setRejectionReason('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject event');
    }
  }

  function canApproveAsHead(event: any) {
    return isHead &&
      event.status === 'pending_head_approval' &&
      event.committee_id === userCommitteeId &&
      !event.head_approved_by;
  }

  function canApproveAsEC(event: any) {
    return isEC &&
      event.status === 'pending_ec_approval' &&
      !event.ec_approvals?.some((a: any) => a.user_id === currentUser?.id && a.approved);
  }

  function hasUserApprovedAsEC(event: any) {
    return event.ec_approvals?.some((a: any) => a.user_id === currentUser?.id && a.approved);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Event Approval Workflow</h1>
          <p className="text-gray-600 mt-2">
            {isHead && 'Review and approve events from your committee'}
            {isEC && !isHead && 'Review and approve events after head approval'}
            {!isHead && !isEC && 'You do not have approval permissions'}
          </p>
        </div>

        {/* Workflow Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Approval Process</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Committee Head approves the event</li>
            <li>Any 1 EC member approves (out of 6)</li>
            <li>Event moves to Event Progress</li>
          </ol>
        </div>

        <div className="space-y-6">
          {events.map((event) => {
            const ecApprovedCount = event.ec_approvals?.filter((a: any) => a.approved).length || 0;
            const userHasApprovedEC = hasUserApprovedAsEC(event);

            return (
              <div key={event.id} className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                    <p className="text-sm text-gray-600">{event.committee?.name}</p>
                    <p className="text-xs text-gray-500 mt-1">Proposed by {event.proposer?.name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${event.status === 'pending_head_approval'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                    }`}>
                    {event.status === 'pending_head_approval' ? 'Pending Head' : 'Pending EC'}
                  </span>
                </div>

                <p className="text-gray-700 mb-4">{event.description}</p>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <span className="ml-2 text-gray-900">
                      {event.date ? new Date(event.date).toLocaleDateString() : 'Not set'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Location:</span>
                    <span className="ml-2 text-gray-900">{event.location || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Budget:</span>
                    <span className="ml-2 text-gray-900">
                      ₹{event.budget ? event.budget.toLocaleString('en-IN') : '0'}
                    </span>
                  </div>
                </div>

                {/* Head Approval Status */}
                {event.status === 'pending_head_approval' && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-900">
                        Waiting for committee head approval
                      </span>
                    </div>
                  </div>
                )}

                {/* EC Approval Status */}
                {event.status === 'pending_ec_approval' && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        EC Approvals: {ecApprovedCount} / 1 required
                      </span>
                      {event.head_approver?.name && (
                        <span className="text-xs text-green-600">
                          ✓ Approved by {event.head_approver.name}
                        </span>
                      )}
                    </div>

                    {event.ec_approvals && event.ec_approvals.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {event.ec_approvals.map((approval: any) => (
                          <div key={approval.user_id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                            <span className="text-gray-700">{approval.profile?.name}</span>
                            {approval.approved ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <Clock className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {canApproveAsHead(event) && (
                    <>
                      <button
                        onClick={() => handleHeadApproval(event.id)}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Approve as Head
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEvent(event);
                          setRejectModalOpen(true);
                        }}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-5 h-5" />
                        Reject
                      </button>
                    </>
                  )}

                  {canApproveAsEC(event) && (
                    <>
                      <button
                        onClick={() => handleECApproval(event.id)}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Approve as EC
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEvent(event);
                          setRejectModalOpen(true);
                        }}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-5 h-5" />
                        Reject
                      </button>
                    </>
                  )}

                  {userHasApprovedEC && (
                    <div className="flex-1 text-center text-green-600 font-medium py-2 bg-green-50 rounded-lg">
                      ✓ You have approved this event
                    </div>
                  )}

                  {event.status === 'pending_ec_approval' && isEC && !canApproveAsEC(event) && !userHasApprovedEC && (
                    <div className="flex-1 text-center text-gray-600 py-2 bg-gray-50 rounded-lg">
                      <AlertCircle className="w-5 h-5 inline mr-2" />
                      Read-only view
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {events.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No events pending approval</p>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-red-600 mb-4">Reject Event</h2>
            <p className="text-gray-700 mb-4">
              You are about to reject <span className="font-bold">"{selectedEvent.title}"</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for rejection *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                placeholder="Explain why this event is being rejected..."
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRejection}
                disabled={!rejectionReason.trim()}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Rejection
              </button>
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setSelectedEvent(null);
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
