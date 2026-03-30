'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, CheckCircle, Clock, AlertCircle, Calendar, Upload, FileText, Trash2, SlidersHorizontal, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [assignmentMembers, setAssignmentMembers] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userCommittees, setUserCommittees] = useState<string[]>([]);
  const [isExecutive, setIsExecutive] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [updateText, setUpdateText] = useState('');
  const [updateDoc, setUpdateDoc] = useState<File | null>(null);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [taskKind, setTaskKind] = useState<'event' | 'general'>('event');
  const [generalAssignMode, setGeneralAssignMode] = useState<'committee' | 'individual'>('committee');
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
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
    let nonEcCommitteeIds: string[] = [];
    let isExec = false;
    const EC_COMMITTEE_ID = '00000000-0000-0000-0000-000000000001';

    if (profile) {
      setUserProfile(profile);
      committeeIds = (profile as any).committee_members?.map((cm: any) => cm.committee_id) || [];
      const hasEcCommitteeMembership = committeeIds.includes(EC_COMMITTEE_ID);
      isExec = profile.executive_role !== null || profile.is_admin === true || profile.is_faculty === true || hasEcCommitteeMembership;
      setIsExecutive(isExec);
      nonEcCommitteeIds = committeeIds.filter(id => id !== EC_COMMITTEE_ID);
      setUserCommittees(committeeIds);
    }

    // Load tasks from task_assignments table
    let tasksQuery = supabase
      .from('task_assignments')
      .select(`
        *,
        event:event_id(title, event_date, status, committee_id, committees(name)),
        assigned_to:assigned_to_committee(name),
        assignee:assigned_to_user(id, name),
        assigned_by:assigned_by_committee(name),
        assigner:assigned_by_user(name),
        task_documents(id, file_name, file_url, file_type, created_at)
      `)
      .order('created_at', { ascending: false });

    // Everyone sees only tasks assigned to their non-EC committees
    // EC/admin/faculty can also see pending_ec_approval tasks for review
    if (nonEcCommitteeIds.length > 0) {
      if (isExec) {
        // EC members see: tasks for their committees + tasks pending EC approval + tasks assigned directly to them
        tasksQuery = tasksQuery.or(
          `assigned_to_committee.in.(${nonEcCommitteeIds.join(',')}),status.eq.pending_ec_approval,assigned_to_user.eq.${user.id}`
        );
      } else {
        tasksQuery = tasksQuery.or(
          `assigned_to_committee.in.(${nonEcCommitteeIds.join(',')}),assigned_to_user.eq.${user.id}`
        );
      }
    } else if (isExec) {
      // EC-only member (no regular committee) — see pending EC approvals + tasks assigned directly to them
      tasksQuery = tasksQuery.or(`status.eq.pending_ec_approval,assigned_to_user.eq.${user.id}`);
    } else {
      setTasks([]);
      setPageLoading(false);
      return;
    }

    const { data: tasksData, error: tasksError } = await tasksQuery;

    if (tasksError) {
      console.error('Tasks query error:', tasksError);
    }

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

    // Load individual assignee candidates:
    // - EC members (for faculty/admin/executive direct assignment)
    // - Co-heads (for head -> co-head delegation)
    const { data: membersData } = await supabase
      .from('committee_members')
      .select('user_id, committee_id, position, profiles(id, name), committees(name)')
      .or(`committee_id.eq.${EC_COMMITTEE_ID},position.eq.co_head`);
    setAssignmentMembers((membersData || []).filter((m: any) => m?.profiles?.id && m?.profiles?.name));

    // For general tasks assigned to an individual, allow assigning to any user.
    const { data: allUsersData } = await supabase
      .from('profiles')
      .select('id, name, committee_members(committee_id, committees(name))')
      .order('name', { ascending: true });
    setAllUsers((allUsersData || []).filter((u: any) => u?.id && u?.name));
    setPageLoading(false);
  }

  async function handleAssignTask(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userProfile) throw new Error('Not authenticated');
      if (taskKind === 'event' && !selectedEvent) throw new Error('Please select an event before assigning a task');

      // Get user's committee (faculty can assign without being in a committee)
      const userCommittee = (userProfile as any).committee_members?.[0];
      if (!userCommittee && !userProfile?.is_faculty && !userProfile?.is_admin) {
        throw new Error('You must be part of a committee to assign tasks');
      }
      const generalSelectedUser = allUsers.find((u: any) => u.id === selectedAssignee) || null;
      const generalAssigneeCommitteeId = generalSelectedUser?.committee_members?.[0]?.committee_id || null;
      const assigneeCommitteeId = generalAssigneeCommitteeId;

      if (taskKind === 'general') {
        if (generalAssignMode === 'committee' && !selectedCommittee) {
          throw new Error('Please select a committee for general task assignment');
        }
        if (generalAssignMode === 'individual' && !selectedAssignee) {
          throw new Error('Please select an individual for general task assignment');
        }
      } else if (!selectedCommittee) {
        throw new Error('Please select a committee for event task assignment');
      }

      const { error } = await supabase
        .from('task_assignments')
        .insert({
          event_id: taskKind === 'event' ? selectedEvent : null,
          title: taskTitle,
          description: taskDescription,
          assigned_to_committee:
            taskKind === 'general'
              ? (generalAssignMode === 'committee' ? selectedCommittee : (assigneeCommitteeId || null))
              : (selectedCommittee || null),
          assigned_to_user:
            taskKind === 'general'
              ? (generalAssignMode === 'individual' ? selectedAssignee : null)
              : null,
          assigned_by_committee: userCommittee?.committee_id || selectedCommittee || assigneeCommitteeId || null,
          assigned_by_user: user.id,
          status: (userProfile?.is_faculty || userProfile?.is_admin || isExecutive) ? 'approved' : 'pending_ec_approval'
        });

      if (error) throw error;

      toast.success((userProfile?.is_faculty || userProfile?.is_admin || isExecutive) ? 'Task assigned and approved!' : 'Task assigned! Waiting for EC approval');
      setShowAssign(false);
      setTaskTitle('');
      setTaskDescription('');
      setTaskKind('event');
      setGeneralAssignMode('committee');
      setSelectedEvent('');
      setSelectedCommittee('');
      setSelectedAssignee('');
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
        const taskFolder = selectedTask.event_id || 'general';
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('event-documents')
          .upload(`${taskFolder}/${fileName}`, updateDoc);

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
    // Faculty, admins, and EC can assign tasks to any committee
    if (userProfile?.is_faculty || userProfile?.is_admin || isExecutive) return true;
    // Committee members can assign (non-EC roles still go through pending_ec_approval workflow)
    return userCommittees.length > 0;
  }

  function canUpdateTask(task: any) {
    // If a task is assigned to a specific person, only they can update it.
    if (task.assigned_to_user) return task.assigned_to_user === userProfile?.id;
    // Otherwise, members of the assigned committee can start/update/complete the task.
    // EC/admin/faculty can only approve/reject (handled separately), not start/complete
    return userCommittees.includes(task.assigned_to_committee);
  }

  const selectedAssigneeMember =
    (taskKind === 'general'
      ? allUsers.find((u: any) => u.id === selectedAssignee)
      : assignmentMembers.find((m: any) => m.user_id === selectedAssignee)) || null;
  const selectedAssigneeCommitteeName =
    taskKind === 'general'
      ? selectedAssigneeMember?.committee_members?.[0]?.committees?.name || null
      : selectedAssigneeMember?.committees?.name || null;

  return (
    <div className="min-h-screen bg-mesh">
      {pageLoading && (
        <div className="min-h-screen bg-mesh flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 mx-auto mb-4 animate-pulse-glow" />
            <p className="text-gray-400">Loading tasks...</p>
          </div>
        </div>
      )}
      {!pageLoading && (
        <>
          <PageHeader
            title="Task Management"
            rightContent={
              canAssignTasks() ? (
                <button onClick={() => setShowAssign(!showAssign)} className="btn-gradient-blue px-4 py-2 rounded-xl flex items-center gap-2 font-semibold text-sm">
                  <Plus className="w-4 h-4" /> Assign Task
                </button>
              ) : undefined
            }
          />

          <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Assign Task Form */}
            {showAssign && (
              <div className="glass rounded-2xl p-6 mb-6">
                <h2 className="text-xl font-bold text-gradient mb-4">Assign Task to Committee</h2>
                <form onSubmit={handleAssignTask} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Task Type *</label>
                    <select
                      value={taskKind}
                      onChange={(e) => {
                        const v = e.target.value as 'event' | 'general';
                        setTaskKind(v);
                        if (v === 'general') setSelectedEvent('');
                        setSelectedAssignee('');
                        setSelectedCommittee('');
                      }}
                      className="w-full px-4 py-2 border rounded-lg"
                    >
                      <option value="event">Event Task</option>
                      <option value="general">General Task</option>
                    </select>
                  </div>
                  {taskKind === 'event' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Event *</label>
                    <select
                      value={selectedEvent}
                      onChange={(e) => setSelectedEvent(e.target.value)}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    >
                      <option value="">Select event</option>
                      {events.filter((e) => (userProfile?.is_faculty || userProfile?.is_admin || isExecutive) ? true : userCommittees.includes(e.committee_id)).map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title} ({e.committees?.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  )}
                  {taskKind === 'general' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        This task is not linked to an event. The same approval workflow still applies.
                      </p>
                    </div>
                  )}
                  {taskKind === 'general' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">General Task Assignment Mode *</label>
                      <select
                        value={generalAssignMode}
                        onChange={(e) => {
                          setGeneralAssignMode(e.target.value as 'committee' | 'individual');
                          setSelectedCommittee('');
                          setSelectedAssignee('');
                        }}
                        className="w-full px-4 py-2 border rounded-lg"
                      >
                        <option value="committee">To Committee</option>
                        <option value="individual">To Individual</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-2">Assign to Committee *</label>
                    <select
                      value={selectedCommittee}
                      onChange={(e) => setSelectedCommittee(e.target.value)}
                      required={taskKind === 'event' || (taskKind === 'general' && generalAssignMode === 'committee')}
                      disabled={taskKind === 'general' && generalAssignMode === 'individual'}
                      className="w-full px-4 py-2 border rounded-lg"
                    >
                      <option value="">Select committee</option>
                      {committees.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  {taskKind === 'general' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Assign to Individual (Optional)</label>
                      <select
                        value={selectedAssignee}
                        onChange={(e) => setSelectedAssignee(e.target.value)}
                        required={generalAssignMode === 'individual'}
                        className="w-full px-4 py-2 border rounded-lg"
                      >
                        <option value="">Select an individual</option>
                        {allUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        General tasks can be assigned to any individual user.
                      </p>
                      {selectedAssigneeCommitteeName ? (
                        <p className="text-xs text-indigo-700 mt-1 font-medium">
                          Selected member committee: {selectedAssigneeCommitteeName}
                        </p>
                      ) : selectedAssignee ? (
                        <p className="text-xs text-indigo-700 mt-1 font-medium">
                          Selected member committee: No committee assigned
                        </p>
                      ) : null}
                    </div>
                  )}
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
                  {!(userProfile?.is_faculty || userProfile?.is_admin || isExecutive) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        ℹ️ This task will be sent to EC for approval before being assigned to the committee.
                      </p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-gradient-blue py-3 rounded-xl font-semibold disabled:opacity-50"
                  >
                    {loading ? 'Assigning...' : (userProfile?.is_faculty || userProfile?.is_admin || isExecutive) ? 'Assign Task' : 'Assign Task (Pending EC Approval)'}
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
                  <div key={task.id} className="glass rounded-2xl p-6">
                    {/* EC Approval Section */}
                    {canECReview && (
                      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm font-semibold text-yellow-900 mb-2">
                          ⚠️ Pending EC Approval
                        </p>
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-yellow-800 mb-1">Reassign to committee (optional)</label>
                          <select
                            defaultValue={task.assigned_to_committee}
                            onChange={async (e) => {
                              const newCommitteeId = e.target.value;
                              if (newCommitteeId !== task.assigned_to_committee) {
                                await supabase.from('task_assignments').update({ assigned_to_committee: newCommitteeId }).eq('id', task.id);
                                toast.success('Committee updated');
                                loadData();
                              }
                            }}
                            className="w-full px-3 py-1.5 border border-yellow-300 rounded-lg text-sm bg-white"
                          >
                            {committees.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleECApprove(task.id)}
                            disabled={loading}
                            className="btn-gradient-green px-4 py-2 rounded-xl text-sm disabled:opacity-50"
                          >
                            Approve Task
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Reason for rejection:');
                              if (reason) handleECReject(task.id, reason);
                            }}
                            disabled={loading}
                            className="btn-gradient-red px-4 py-2 rounded-xl text-sm disabled:opacity-50"
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
                        <p className="text-sm text-gray-600">
                          Assigned to: <span className="font-semibold">{task.assigned_to?.name}</span>
                          {task.assignee?.name ? (
                            <span className="ml-2 text-xs text-indigo-700 font-semibold">
                              (Individual: {task.assignee.name})
                            </span>
                          ) : null}
                          {isExecutive && task.status !== 'completed' && (
                            <select
                              className="ml-2 text-xs border border-gray-200 rounded-lg px-2 py-0.5 bg-white"
                              defaultValue={task.assigned_to_committee}
                              onChange={async (e) => {
                                await supabase.from('task_assignments').update({ assigned_to_committee: e.target.value }).eq('id', task.id);
                                toast.success('Committee reassigned');
                                loadData();
                              }}
                            >
                              {committees.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {task.event?.title ? `Event: ${task.event.title}` : 'General Task'}
                        </p>
                        {/* Deadline */}
                        {task.deadline ? (
                          <p className={`text-xs mt-1 font-medium ${new Date(task.deadline) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                            📅 Deadline: {new Date(task.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {new Date(task.deadline) < new Date() && ' (Overdue)'}
                          </p>
                        ) : task.ec_approved_at ? (
                          <p className={`text-xs mt-1 font-medium ${new Date(new Date(task.ec_approved_at).getTime() + 2 * 24 * 60 * 60 * 1000) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                            📅 Deadline: {new Date(new Date(task.ec_approved_at).getTime() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} (default)
                            {new Date(new Date(task.ec_approved_at).getTime() + 2 * 24 * 60 * 60 * 1000) < new Date() && ' (Overdue)'}
                          </p>
                        ) : task.created_at ? (
                          <p className={`text-xs mt-1 font-medium ${new Date(new Date(task.created_at).getTime() + 2 * 24 * 60 * 60 * 1000) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                            📅 Deadline: {new Date(new Date(task.created_at).getTime() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} (default)
                          </p>
                        ) : null}
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
                          <span className="text-sm font-bold text-indigo-600">{task.progress || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200/60 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${task.progress || 0}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Task updates (when provided on the task row) */}
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
                    {task.task_documents && task.task_documents.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Documents:</h4>
                        <div className="space-y-1">
                          {task.task_documents.map((doc: any) => (
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
                          className="btn-gradient-blue px-4 py-2 rounded-xl text-sm disabled:opacity-50"
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
                          className="btn-gradient-purple px-4 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-50"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                          Update Progress
                        </button>
                        <button
                          onClick={() => setSelectedTask(task)}
                          disabled={loading}
                          className="glass px-4 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-50 text-gray-700 hover:shadow-md transition"
                        >
                          <FileText className="w-4 h-4" />
                          Post Update
                        </button>
                        <button
                          onClick={() => updateTaskStatus(task.id, 'completed')}
                          disabled={loading}
                          className="btn-gradient-green px-4 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-50"
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
                <div className="glass rounded-2xl p-12 text-center">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No tasks assigned yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Progress Update Modal */}
          {showProgressModal && progressTask && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="glass-strong rounded-2xl p-6 max-w-md w-full">
                <h2 className="text-xl font-bold text-gradient mb-4">Update Progress</h2>
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
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="glass-strong rounded-2xl p-6 max-w-2xl w-full">
                <h2 className="text-xl font-bold text-gradient mb-4">Post Update - {selectedTask.title}</h2>
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
        </>
      )}
    </div>
  );
}
