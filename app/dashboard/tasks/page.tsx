'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, CheckCircle, Clock, AlertCircle, Calendar, Upload, FileText, Trash2, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userCommittees, setUserCommittees] = useState<string[]>([]);
  const [isExecutive, setIsExecutive] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [updateText, setUpdateText] = useState('');
  const [updateDoc, setUpdateDoc] = useState<File | null>(null);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [progressTask, setProgressTask] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    // Get user profile with committee memberships
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, committee_members(committee_id, position, committees(name))')
      .eq('id', user.id)
      .single();

    let committeeIds: string[] = [];
    let isExec = false;

    if (profile) {
      setUserProfile(profile);
      isExec = profile.executive_role !== null || profile.is_admin === true;
      setIsExecutive(isExec);
      committeeIds = (profile as any).committee_members?.map((cm: any) => cm.committee_id) || [];
      setUserCommittees(committeeIds);
    }

    // Load tasks from task_assignments table
    let tasksQuery = supabase
      .from('task_assignments')
      .select(`
        *,
        event:events(title, event_date, status, committee_id, committees(name)),
        assigned_to:assigned_to_committee(name),
        assigned_by:assigned_by_committee(name),
        assigner:assigned_by_user(name),
        updates:task_updates(*, user:profiles(name)),
        documents:task_documents(*, uploaded_by:profiles(name))
      `)
      .order('created_at', { ascending: false });

    // Filter based on role
    if (!isExec && committeeIds.length > 0) {
      // Regular members see tasks assigned to their committee (approved only)
      tasksQuery = tasksQuery
        .in('assigned_to_committee', committeeIds)
        .in('status', ['approved', 'in_progress', 'completed']);
    }

    const { data: tasksData, error: tasksError } = await tasksQuery;

    if (tasksError) {
      console.error('Tasks query error:', tasksError);
    }

    console.log('Tasks loaded:', tasksData);
    setTasks(tasksData || []);

    // Load active/in_progress events for task assignment
    const { data: eventsData } = await supabase
      .from('events')
      .select('id, title, event_date, status, committee_id, committees(name)')
      .in('status', ['active', 'in_progress']);
    setEvents(eventsData || []);

    // Load committees
    const { data: committeesData } = await supabase
      .from('committees')
      .select('id, name')
      .eq('type', 'regular')
      .neq('id', '00000000-0000-0000-0000-000000000001'); // Exclude EC
    setCommittees(committeesData || []);
  }

  async function handleAssignTask(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userProfile) throw new Error('Not authenticated');

      // Get user's committee
      const userCommittee = (userProfile as any).committee_members?.[0];
      if (!userCommittee) throw new Error('You must be part of a committee to assign tasks');

      const { error } = await supabase
        .from('task_assignments')
        .insert({
          event_id: selectedEvent,
          title: taskTitle,
          description: taskDescription,
          assigned_to_committee: selectedCommittee,
          assigned_by_committee: userCommittee.committee_id,
          assigned_by_user: user.id,
          status: 'pending_ec_approval'
        });

      if (error) throw error;

      toast.success('Task assigned! Waiting for EC approval');
      setShowAssign(false);
      setTaskTitle('');
      setTaskDescription('');
      setSelectedEvent('');
      setSelectedCommittee('');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleECApprove(taskId: string) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('task_assignments')
        .update({
          status: 'approved',
          ec_approved_by: user?.id,
          ec_approved_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Task approved!');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleECReject(taskId: string, reason: string) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('task_assignments')
        .update({
          status: 'rejected',
          ec_rejection_reason: reason
        })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Task rejected');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: string) {
    setLoading(true);
    try {
      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'in_progress' && !tasks.find(t => t.id === taskId)?.started_at) {
        updates.started_at = new Date().toISOString();
      }

      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
        updates.progress = 100;
      }

      const { error } = await supabase
        .from('task_assignments')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Status updated!');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateProgress() {
    if (!progressTask) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Update progress
      const { error: updateError } = await supabase
        .from('task_assignments')
        .update({
          progress: progressValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', progressTask.id);

      if (updateError) throw updateError;

      // Log progress update
      const { error: logError } = await supabase
        .from('task_updates')
        .insert({
          task_id: progressTask.id,
          user_id: user?.id,
          update_text: `Progress updated to ${progressValue}%`,
          progress_before: progressTask.progress || 0,
          progress_after: progressValue
        });

      if (logError) throw logError;

      toast.success('Progress updated!');
      setShowProgressModal(false);
      setProgressTask(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePostUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask || !updateText) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Upload document if provided
      let docUrl = null;
      if (updateDoc) {
        const fileName = `${Date.now()}_${updateDoc.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('event-documents')
          .upload(`${selectedTask.event_id}/${fileName}`, updateDoc);

        if (uploadError) throw uploadError;

        // Save document reference
        const { error: docError } = await supabase
          .from('task_documents')
          .insert({
            task_id: selectedTask.id,
            event_id: selectedTask.event_id,
            file_name: updateDoc.name,
            file_url: uploadData.path,
            file_size: updateDoc.size,
            file_type: updateDoc.type,
            uploaded_by: user?.id
          });

        if (docError) throw docError;
        docUrl = uploadData.path;
      }

      // Post update
      const { error } = await supabase
        .from('task_updates')
        .insert({
          task_id: selectedTask.id,
          user_id: user?.id,
          update_text: updateText,
          progress_before: selectedTask.progress,
          progress_after: selectedTask.progress
        });

      if (error) throw error;

      toast.success('Update posted!');
      setSelectedTask(null);
      setUpdateText('');
      setUpdateDoc(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  function canAssignTasks() {
    // User must be part of a committee with an active/in_progress event
    return userCommittees.length > 0 && events.some(e => userCommittees.includes(e.committee_id));
  }

  function canUpdateTask(task: any) {
    return userCommittees.includes(task.assigned_to_committee) || userProfile?.is_admin;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Task Management</h1>
            <div className="flex gap-4">
              {canAssignTasks() && (
                <button
                  onClick={() => setShowAssign(!showAssign)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Assign Task
                </button>
              )}
              <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">
                ← Back
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Assign Task Form */}
        {showAssign && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Assign Task to Committee</h2>
            <form onSubmit={handleAssignTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Event *</label>
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Select event</option>
                  {events.filter(e => userCommittees.includes(e.committee_id)).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.committees?.name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Assign to Committee *</label>
                <select
                  value={selectedCommittee}
                  onChange={(e) => setSelectedCommittee(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Select committee</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Task Title *</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Design event poster"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Provide details about the task..."
                />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  ℹ️ This task will be sent to EC for approval before being assigned to the committee.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Assigning...' : 'Assign Task (Pending EC Approval)'}
              </button>
            </form>
          </div>
        )}

        {/* Tasks List */}
        <div className="space-y-4">
          {tasks.map((task) => {
            const canUpdate = canUpdateTask(task);
            const canECReview = isExecutive && task.status === 'pending_ec_approval';
            const statusColors = {
              pending_ec_approval: 'bg-yellow-100 text-yellow-800',
              approved: 'bg-blue-100 text-blue-800',
              in_progress: 'bg-purple-100 text-purple-800',
              completed: 'bg-green-100 text-green-800',
              rejected: 'bg-red-100 text-red-800'
            };

            return (
              <div key={task.id} className="bg-white rounded-xl shadow-lg p-6">
                {/* EC Approval Section */}
                {canECReview && (
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-semibold text-yellow-900 mb-2">
                      ⚠️ Pending EC Approval
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleECApprove(task.id)}
                        disabled={loading}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                      >
                        Approve Task
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Reason for rejection:');
                          if (reason) handleECReject(task.id, reason);
                        }}
                        disabled={loading}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {/* Task Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">{task.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Assigned to: <span className="font-semibold">{task.assigned_to?.name}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Assigned by: {task.assigned_by?.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Event: {task.event?.title}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[task.status as keyof typeof statusColors]}`}>
                    {task.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>

                {task.description && (
                  <p className="text-gray-700 mb-4">{task.description}</p>
                )}

                {/* Progress Bar */}
                {task.status !== 'pending_ec_approval' && task.status !== 'rejected' && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Progress</span>
                      <span className="text-sm font-bold text-blue-600">{task.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${task.progress || 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Task Updates */}
                {task.updates && task.updates.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Updates:</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {task.updates.map((update: any) => (
                        <div key={update.id} className="bg-gray-50 p-3 rounded-lg border">
                          <p className="text-sm text-gray-800">{update.update_text}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            By {update.user?.name} • {new Date(update.created_at).toLocaleString('en-IN')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Task Documents */}
                {task.documents && task.documents.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Documents:</h4>
                    <div className="space-y-1">
                      {task.documents.map((doc: any) => (
                        <a
                          key={doc.id}
                          href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-documents/${doc.file_url}`}
                          target="_blank"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                          <FileText className="w-4 h-4" />
                          {doc.file_name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {canUpdate && task.status === 'approved' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => updateTaskStatus(task.id, 'in_progress')}
                      disabled={loading}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                    >
                      Start Task
                    </button>
                  </div>
                )}

                {canUpdate && task.status === 'in_progress' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setProgressTask(task);
                        setProgressValue(task.progress || 0);
                        setShowProgressModal(true);
                      }}
                      disabled={loading}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      Update Progress
                    </button>
                    <button
                      onClick={() => setSelectedTask(task)}
                      disabled={loading}
                      className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4" />
                      Post Update
                    </button>
                    <button
                      onClick={() => updateTaskStatus(task.id, 'completed')}
                      disabled={loading}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Mark Complete
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600">No tasks assigned yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Update Modal */}
      {showProgressModal && progressTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Update Progress</h2>
            <p className="text-sm text-gray-600 mb-4">{progressTask.title}</p>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-2xl font-bold text-blue-600">{progressValue}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={progressValue}
                onChange={(e) => setProgressValue(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #2563eb 0%, #2563eb ${progressValue}%, #e5e7eb ${progressValue}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleUpdateProgress}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Progress'}
              </button>
              <button
                onClick={() => {
                  setShowProgressModal(false);
                  setProgressTask(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Update Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4">Post Update - {selectedTask.title}</h2>
            <form onSubmit={handlePostUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Update *</label>
                <textarea
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  required
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Describe the progress or update..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Upload Document (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => setUpdateDoc(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Documents will be stored in the event's documents section
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Posting...' : 'Post Update'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTask(null);
                    setUpdateText('');
                    setUpdateDoc(null);
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
