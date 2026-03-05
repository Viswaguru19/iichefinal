'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import NotionProgressBar from '@/components/events/NotionProgressBar';
import { Plus, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const dynamic = 'force-dynamic';

export default function EventProgressPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [updateText, setUpdateText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPendingTasks, setShowPendingTasks] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: profile } = await supabase
      .from('profiles')
      .select('*, committee_members(committee_id)')
      .eq('id', user.id)
      .single();
    setCurrentUser(profile);

    // ============================================
    // EVENT PROGRESS VISIBILITY FILTER
    // ============================================
    // Only show events AFTER EC final approval. Events must be 'active'.
    // EC approval is the final step - no faculty approval needed.
    // Events at earlier stages (pending_head_approval, pending_ec_approval, 
    // rejected_by_head) should NOT appear here.
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select(`
        *,
        committee:committee_id(name),
        proposer:proposed_by(name),
        head_approver:head_approved_by(name),
        faculty_approver:faculty_approved_by(name)
      `)
      .eq('status', 'active')
      .order('event_date', { ascending: false });

    // Debug logging
    console.log('=== EVENT PROGRESS DEBUG ===');
    console.log('Events data:', eventsData);
    console.log('Events count:', eventsData?.length);
    console.log('Events error:', eventsError);
    console.log('Current user:', user);
    console.log('===========================');

    setEvents(eventsData || []);

    const { data: comms } = await supabase
      .from('committees')
      .select('id, name')
      .eq('type', 'regular')
      .order('name');
    setCommittees(comms || []);
  }

  async function loadTasks(eventId: string) {
    const { data } = await supabase
      .from('task_assignments')
      .select(`
        *,
        assigned_committee:assigned_to_committee(name),
        creator:assigned_by_user(name),
        approver:ec_approved_by(name),
        updates:task_updates(*, user:updated_by(name))
      `)
      .eq('event_id', eventId)
      .order('created_at');
    setTasks(data || []);
  }

  async function selectEvent(event: any) {
    setSelectedEvent(event);
    await loadTasks(event.id);
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('task_assignments')
        .insert({
          event_id: selectedEvent.id,
          assigned_to_committee: selectedCommittee,
          assigned_by_committee: currentUser.committee_members?.[0]?.committee_id || null,
          assigned_by_user: currentUser.id,
          title: taskTitle,
          description: taskDescription,
          status: 'pending',
          progress: 0
        });

      if (error) throw error;

      toast.success('Task created! Waiting for EC approval.');
      setShowTaskModal(false);
      setTaskTitle('');
      setTaskDescription('');
      setSelectedCommittee('');
      loadTasks(selectedEvent.id);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function postUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('task_updates')
        .insert({
          task_id: selectedTask.id,
          updated_by: currentUser.id,
          update_text: updateText,
          documents: []
        });

      if (error) throw error;

      toast.success('Update posted successfully!');
      setShowUpdateModal(false);
      setUpdateText('');
      setSelectedTask(null);
      loadTasks(selectedEvent.id);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function markComplete(taskId: string) {
    try {
      const { error } = await supabase
        .from('task_assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          progress: 100,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Task marked complete!');
      loadTasks(selectedEvent.id);
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function approveTask(taskId: string) {
    try {
      const { error } = await supabase
        .from('task_assignments')
        .update({
          status: 'approved',
          ec_approved_by: currentUser.id,
          ec_approved_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Task approved! Committee can now work on it.');
      loadTasks(selectedEvent.id);
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  const isExecutive = currentUser?.executive_role !== null;
  const isAdmin = currentUser?.is_admin === true;
  const isCommitteeMember = currentUser?.committee_members && currentUser.committee_members.length > 0;

  async function deleteEvent() {
    if (!eventToDelete) return;

    setLoading(true);
    try {
      // Delete all tasks associated with the event first
      const { error: tasksError } = await supabase
        .from('tasks')
        .delete()
        .eq('event_id', eventToDelete.id);

      if (tasksError) throw tasksError;

      // Delete the event
      const { error: eventError } = await supabase
        .from('events')
        .delete()
        .eq('id', eventToDelete.id);

      if (eventError) throw eventError;

      toast.success('Event deleted successfully!');
      setShowDeleteModal(false);
      setEventToDelete(null);

      // If the deleted event was selected, clear selection
      if (selectedEvent?.id === eventToDelete.id) {
        setSelectedEvent(null);
        setTasks([]);
      }

      // Refresh events list
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete event');
    } finally {
      setLoading(false);
    }
  }

  // Build committee task summary for progress bar
  // Only include tasks that have been approved by any EC member.
  // Tasks at 'pending_ec_approval' status are excluded because they haven't been officially assigned yet.
  const getCommitteeTaskSummary = () => {
    const committeeMap = new Map();

    tasks.forEach(task => {
      // Only include tasks that have been approved
      if (task.status === 'pending_ec_approval' || task.status === 'rejected') {
        return;
      }

      const committeeName = task.assigned_to?.name || 'Unassigned';
      if (!committeeMap.has(committeeName)) {
        committeeMap.set(committeeName, {
          committee_name: committeeName,
          total_tasks: 0,
          completed_tasks: 0,
          in_progress_tasks: 0,
          not_started_tasks: 0
        });
      }

      const summary = committeeMap.get(committeeName);
      summary.total_tasks++;

      if (task.status === 'completed' || task.completed_at) {
        summary.completed_tasks++;
      } else if (task.status === 'in_progress' || (task.progress > 0 && task.progress < 100)) {
        summary.in_progress_tasks++;
      } else {
        summary.not_started_tasks++;
      }
    });

    return Array.from(committeeMap.values());
  };

  // Count pending tasks for EC approval
  const pendingECApprovalCount = tasks.filter(t => t.status === 'pending_ec_approval').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Event Progress</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Events List */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="font-bold text-gray-900 mb-4 text-lg">Active Events</h2>
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="relative group">
                  <button
                    onClick={() => selectEvent(event)}
                    className={`w-full text-left p-4 rounded-lg transition ${selectedEvent?.id === event.id
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'hover:bg-gray-50 border-2 border-transparent'
                      }`}
                  >
                    <p className="font-semibold text-gray-900">{event.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{event.committee?.name}</p>
                    <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${event.status === 'active' ? 'bg-green-100 text-green-800' :
                      event.status === 'faculty_approved' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                      {event.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEventToDelete(event);
                        setShowDeleteModal(true);
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 text-white p-2 rounded-lg hover:bg-red-700"
                      title="Delete event"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {events.length === 0 && (
                <p className="text-gray-500 text-center py-8">No active events</p>
              )}
            </div>
          </div>

          {/* Event Details */}
          <div className="md:col-span-2">
            {selectedEvent ? (
              <>
                {/* Ultra-Premium Interactive Progress */}
                <div className="mb-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedEvent.title}</h2>
                      <p className="text-gray-600">{selectedEvent.description}</p>
                    </div>
                    {isExecutive && pendingECApprovalCount > 0 && (
                      <button
                        onClick={() => router.push(`/dashboard/event-detail/${selectedEvent.id}`)}
                        className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition animate-pulse"
                      >
                        <AlertCircle className="w-5 h-5" />
                        {pendingECApprovalCount} Task{pendingECApprovalCount > 1 ? 's' : ''} Awaiting Approval
                      </button>
                    )}
                  </div>

                  <NotionProgressBar
                    committeeTasks={getCommitteeTaskSummary()}
                    eventDate={selectedEvent.event_date}
                  />
                </div>

                {/* Tasks Section */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Event Tasks</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {tasks.filter(t => t.status === 'completed' || t.completed_at).length} of {tasks.filter(t => t.status !== 'pending' && t.ec_approved_by).length} completed
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Filter Toggle */}
                      {/* Allow users to show/hide pending EC approval tasks.
                          Default: hidden (shows only approved, actionable tasks)
                          When enabled: shows all tasks including pending and rejected */}
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPendingTasks}
                          onChange={(e) => setShowPendingTasks(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Show pending tasks
                      </label>
                      {(isCommitteeMember || isExecutive) && (
                        <button
                          onClick={() => setShowTaskModal(true)}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                        >
                          <Plus className="w-5 h-5" />
                          Assign Task
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tasks List */}
                  {/* Filter tasks based on showPendingTasks toggle.
                      By default, hide pending tasks to show only actionable work.
                      Users can toggle to see pending tasks if they want to review what's awaiting approval. */}
                  <div className="space-y-4">
                    {tasks
                      .filter(task => showPendingTasks || (task.status !== 'pending_ec_approval' && task.status !== 'rejected' && task.ec_approved_by))
                      .map((task) => (
                        <div key={task.id} className={`border rounded-lg p-4 hover:shadow-md transition ${task.status === 'pending_ec_approval' ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
                          }`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-bold text-gray-900">{task.title}</h4>
                                {task.status === 'pending_ec_approval' && (
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                                    Pending EC Approval
                                  </span>
                                )}
                                {task.ec_approved_by && task.status !== 'pending_ec_approval' && (
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                                    ✓ EC Approved
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{task.assigned_to?.name}</p>
                              {task.description && (
                                <p className="text-sm text-gray-500 mt-2">{task.description}</p>
                              )}
                              {task.ec_approved_by && task.ec_approved_at && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Approved by {task.approver?.name} on {new Date(task.ec_approved_at).toLocaleDateString()}
                                </p>
                              )}
                              {task.progress !== undefined && task.progress !== null && task.status !== 'pending_ec_approval' && (
                                <div className="mt-2">
                                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                    <span>Progress</span>
                                    <span>{task.progress}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-blue-600 h-2 rounded-full transition-all"
                                      style={{ width: `${task.progress}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${task.status === 'completed' || task.completed_at ? 'bg-green-100 text-green-800' :
                                task.status === 'in_progress' || (task.progress > 0 && task.progress < 100) ? 'bg-blue-100 text-blue-800' :
                                  task.status === 'pending_ec_approval' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                {task.status === 'completed' || task.completed_at ? <CheckCircle className="w-3 h-3" /> :
                                  task.status === 'in_progress' || (task.progress > 0 && task.progress < 100) ? <Clock className="w-3 h-3" /> :
                                    <AlertCircle className="w-3 h-3" />}
                                {task.status ? task.status.replace(/_/g, ' ').toUpperCase() : 'PENDING'}
                              </span>
                              {task.status === 'pending_ec_approval' && isExecutive && (
                                <button
                                  onClick={() => router.push(`/dashboard/event-detail/${selectedEvent.id}`)}
                                  className="text-blue-600 hover:text-blue-700 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-xs font-medium"
                                  title="Review and approve task"
                                >
                                  Review
                                </button>
                              )}
                              {task.status !== 'completed' && !task.completed_at && task.status !== 'pending_ec_approval' && task.ec_approved_by && isExecutive && (
                                <button
                                  onClick={() => markComplete(task.id)}
                                  className="text-green-600 hover:text-green-700"
                                  title="Mark as complete"
                                >
                                  <CheckCircle className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {task.updates && task.updates.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <h5 className="text-sm font-semibold text-gray-700 mb-2">Recent Updates</h5>
                              <div className="space-y-2">
                                {task.updates.slice(-3).map((update: any) => (
                                  <div key={update.id} className="bg-gray-50 rounded p-3">
                                    <p className="text-sm text-gray-900">{update.update_text}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {update.user?.name} • {new Date(update.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {task.status !== 'pending_ec_approval' && task.ec_approved_by && (
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                setShowUpdateModal(true);
                              }}
                              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                              + Add Update
                            </button>
                          )}
                        </div>
                      ))}

                    {tasks.filter(task => showPendingTasks || (task.status !== 'pending_ec_approval' && task.status !== 'rejected' && task.ec_approved_by)).length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No tasks {showPendingTasks ? 'assigned' : 'approved'} yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 text-lg">Select an event to view progress</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Assign Task</h2>
            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Committee *</label>
                <select
                  value={selectedCommittee}
                  onChange={(e) => setSelectedCommittee(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value="">Select committee</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Task Title *</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Assigning...' : 'Assign Task'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Post Update</h2>
            <form onSubmit={postUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Update *</label>
                <textarea
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  required
                  rows={4}
                  placeholder="What progress have you made?"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Posting...' : 'Post Update'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUpdateModal(false);
                    setUpdateText('');
                    setSelectedTask(null);
                  }}
                  className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Event Confirmation Modal */}
      {showDeleteModal && eventToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-red-600 mb-4">Delete Event</h2>
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete <span className="font-bold">"{eventToDelete.title}"</span>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              This will permanently delete the event and all associated tasks. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={deleteEvent}
                disabled={loading}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete Event'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setEventToDelete(null);
                }}
                disabled={loading}
                className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50"
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
