'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, CheckCircle, Clock, AlertCircle, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { createTask as createTaskWithApproval, approveTaskAsEC, rejectTaskAsEC } from '@/lib/approval-workflow';
import type { UserRole } from '@/types/database';

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
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [ecRejectTaskState, setEcRejectTaskState] = useState<any>(null);
  const [ecRejectReason, setEcRejectReason] = useState('');
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
      .select('*, committee_members(committee_id)')
      .eq('id', user.id)
      .single();

    let committeeIds: string[] = [];
    let isExec = false;
    let isAdmin = false;

    if (profile) {
      setUserProfile(profile);
      isExec = profile.executive_role !== null;
      isAdmin = profile.is_admin === true;
      setIsExecutive(isExec);
      committeeIds = (profile as any).committee_members?.map((cm: any) => cm.committee_id) || [];
      setUserCommittees(committeeIds);
    }

    // Load tasks from 'tasks' table with visibility rules
    let tasksQuery = supabase
      .from('tasks')
      .select(`
        *,
        event:events(title, date, committee:committee_id(name)),
        proposed_committee:proposed_by_committee_id(name),
        assigned_committee:assigned_to_committee_id(name),
        creator:created_by(name),
        updates:task_updates(*, user:user_id(name))
      `)
      .order('created_at', { ascending: false });

    // Non-admin, non-EC users only see approved tasks assigned to their committees
    // (pending_ec_approval and ec_rejected tasks are hidden from regular members)
    if (!isExec && !isAdmin && committeeIds.length > 0) {
      tasksQuery = tasksQuery
        .in('assigned_to_committee_id', committeeIds)
        .not('status', 'in', '(pending_ec_approval,ec_rejected)');
    }

    const { data: tasksData } = await tasksQuery;
    setTasks(tasksData || []);

    // Load active events
    const { data: eventsData } = await supabase
      .from('events')
      .select('id, title, date, committee:committee_id(name)')
      .in('status', ['active', 'pending_faculty_approval', 'faculty_approved']);
    setEvents(eventsData || []);

    // Load committees
    const { data: committeesData } = await supabase
      .from('committees')
      .select('id, name')
      .eq('type', 'regular');
    setCommittees(committeesData || []);
  }

  async function handleAssignTask(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userProfile) {
        throw new Error('Not authenticated');
      }

      // Create task in pending_ec_approval via approval workflow
      await createTaskWithApproval(
        {
          event_id: selectedEvent,
          assigned_to_committee_id: selectedCommittee,
          title: taskTitle,
          description: taskDescription,
          priority: taskPriority,
          deadline: taskDeadline || null,
        },
        user.id,
        (userProfile.role as UserRole),
      );

      toast.success('Task assigned successfully!');
      setShowAssign(false);
      setTaskTitle('');
      setTaskDescription('');
      setSelectedEvent('');
      setSelectedCommittee('');
      setTaskDeadline('');
      setTaskPriority('medium');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleECApproveTask(taskId: string) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userProfile) {
        throw new Error('Not authenticated');
      }

      await approveTaskAsEC(taskId, user.id, userProfile.role as UserRole);
      toast.success('Task approved by Executive Committee');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleECRejectTask() {
    if (!ecRejectTaskState || !ecRejectReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userProfile) {
        throw new Error('Not authenticated');
      }

      await rejectTaskAsEC(ecRejectTaskState.id, user.id, userProfile.role as UserRole, ecRejectReason.trim());
      toast.success('Task sent back with requested changes');
      setEcRejectTaskState(null);
      setEcRejectReason('');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: string, assignedCommitteeId: string) {
    try {
      // Check if user is part of assigned committee
      if (!userCommittees.includes(assignedCommitteeId) && !userProfile?.is_admin) {
        toast.error('Only assigned committee members can update this task');
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Status updated successfully!');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function handlePostUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask || !updateText) return;

    // Check if user is part of assigned committee
    if (!userCommittees.includes(selectedTask.assigned_to_committee_id) && !userProfile?.is_admin) {
      toast.error('Only assigned committee members can post updates');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let docUrl = null;
      if (updateDoc) {
        const fileName = `${Date.now()}_${updateDoc.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(`task-updates/${fileName}`, updateDoc);
        if (uploadError) throw uploadError;
        docUrl = uploadData.path;
      }

      const documents = docUrl ? [{ url: docUrl, name: updateDoc?.name }] : [];

      const { error } = await supabase
        .from('task_updates')
        .insert({
          task_id: selectedTask.id,
          user_id: user?.id,
          update_text: updateText,
          documents: documents,
        });

      if (error) throw error;

      toast.success('Update posted successfully!');
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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Event Tasks</h1>
            <div className="flex gap-4">
              {isExecutive && (
                <button
                  onClick={() => setShowAssign(!showAssign)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Assign Task
                </button>
              )}
              <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {showAssign && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Assign New Task</h2>
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
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>{e.title}</option>
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Deadline</label>
                  <input
                    type="date"
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Assigning...' : 'Assign Task'}
              </button>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {tasks.map((task) => {
            const canUpdate = userCommittees.includes(task.assigned_to_committee_id) || userProfile?.is_admin;
            const canECReview = isExecutive && task.status === 'pending_ec_approval';
            const priorityColors = {
              low: 'bg-gray-100 text-gray-800',
              medium: 'bg-blue-100 text-blue-800',
              high: 'bg-orange-100 text-orange-800',
              urgent: 'bg-red-100 text-red-800'
            };

            return (
              <div key={task.id} className="bg-white rounded-xl shadow-lg p-6">
                {canECReview && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-50 text-yellow-800 border border-yellow-200">
                      Awaiting EC approval
                    </span>
                    <button
                      onClick={() => handleECApproveTask(task.id)}
                      disabled={loading}
                      className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
                    >
                      Approve Task
                    </button>
                    <button
                      onClick={() => setEcRejectTaskState(task)}
                      disabled={loading}
                      className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200"
                    >
                      Request Changes
                    </button>
                  </div>
                )}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold">{task.title}</h3>
                    <p className="text-sm text-gray-600">
                      Assigned to: {task.assigned_committee?.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Event: {task.event?.title}{' '}
                      {task.event?.committee?.name && (
                        <span className="text-[11px] text-gray-400">
                          • Proposed by {task.event.committee.name}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3" />
                      {task.event?.date
                        ? new Date(task.event.date).toLocaleDateString()
                        : 'Date: TBA'}
                    </p>
                    {task.deadline && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        Deadline: {new Date(task.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${task.status === 'completed' ? 'bg-green-100 text-green-800' :
                      task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                      {task.status === 'completed' ? <CheckCircle className="w-3 h-3" /> :
                        task.status === 'in_progress' ? <Clock className="w-3 h-3" /> :
                          <AlertCircle className="w-3 h-3" />}
                      {task.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[task.priority as keyof typeof priorityColors]}`}>
                      {task.priority.toUpperCase()}
                    </span>
                  </div>
                </div>

                {task.description && (
                  <p className="text-gray-700 mb-4">{task.description}</p>
                )}

                {task.updates && task.updates.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <h4 className="font-bold text-sm text-gray-700">Updates:</h4>
                    {task.updates.map((update: any) => (
                      <div key={update.id} className="bg-gray-50 p-3 rounded border">
                        <p className="text-sm text-gray-700">{update.update_text}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          By {update.user?.name} - {new Date(update.created_at).toLocaleDateString()}
                        </p>
                        {update.documents && update.documents.length > 0 && (
                          <div className="mt-2">
                            {update.documents.map((doc: any, idx: number) => (
                              <a
                                key={idx}
                                href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${doc.url}`}
                                target="_blank"
                                className="text-xs text-blue-600 hover:underline block"
                              >
                                📎 {doc.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {canUpdate && task.status !== 'in_progress' && task.status !== 'completed' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'in_progress', task.assigned_to_committee_id)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Start Task
                    </button>
                  )}
                  {canUpdate && task.status !== 'completed' && task.status !== 'partially_completed' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'partially_completed', task.assigned_to_committee_id)}
                      className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 text-sm"
                    >
                      Mark Half Done
                    </button>
                  )}
                  {canUpdate && task.status !== 'completed' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'completed', task.assigned_to_committee_id)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
                    >
                      Mark Complete
                    </button>
                  )}
                  {canUpdate && (
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm"
                    >
                      Post Update
                    </button>
                  )}
                  {!canUpdate && (
                    <p className="text-sm text-gray-500 italic">Only assigned committee members can update this task</p>
                  )}
                </div>
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <p className="text-gray-600">No tasks assigned yet</p>
            </div>
          )}
        </div>
      </div>

      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
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
                <label className="block text-sm font-medium mb-2">Attach Document (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => setUpdateDoc(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
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
                  onClick={() => setSelectedTask(null)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ecRejectTaskState && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-3">Request Changes for Task</h2>
            <p className="text-sm text-gray-600 mb-3">
              Provide feedback or required changes for &quot;{ecRejectTaskState.title}&quot;.
            </p>
            <textarea
              value={ecRejectReason}
              onChange={(e) => setEcRejectReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border rounded-lg mb-4 text-sm"
              placeholder="Explain what should be changed (e.g., deadline, assigned committee, scope)..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleECRejectTask}
                disabled={loading || !ecRejectReason.trim()}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                Send Feedback
              </button>
              <button
                type="button"
                onClick={() => {
                  setEcRejectTaskState(null);
                  setEcRejectReason('');
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 text-sm"
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

