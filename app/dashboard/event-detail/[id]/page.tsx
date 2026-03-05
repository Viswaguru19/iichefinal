'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { Calendar, MapPin, CheckCircle, Clock, Edit, Check, X, Palette, ImageIcon, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EventDetailPage() {
  const [event, setEvent] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isEC, setIsEC] = useState(false);
  const [isGraphics, setIsGraphics] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editedTaskData, setEditedTaskData] = useState<any>({});
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    loadEventDetails();
    loadUserProfile();
  }, []);

  async function loadUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*, committee_members(position, committee_id, committees(name))')
      .eq('id', user.id)
      .single();

    setUserProfile(profile);

    // Check if user is EC member
    const isExecutive = profile?.executive_role !== null;
    setIsEC(isExecutive);

    // Check if user is in Graphics committee
    const graphicsCommittee = profile?.committee_members?.find(
      (m: any) => m.committees?.name?.toLowerCase().includes('graphics')
    );
    setIsGraphics(!!graphicsCommittee);
  }

  async function loadEventDetails() {
    try {
      // First, try to load the event with a simpler query
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*, committees(name)')
        .eq('id', params.id)
        .single();

      console.log('Event query result:', { eventData, eventError, eventId: params.id });

      if (eventError) {
        console.error('Event query error:', eventError);
        toast.error('Event not found');
        setLoading(false);
        return;
      }

      // If event found, get the creator's profile separately
      if (eventData && eventData.created_by) {
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', eventData.created_by)
          .single();

        if (creatorProfile) {
          eventData.created_by_profile = creatorProfile;
        }
      }

      setEvent(eventData);

      if (eventData) {
        // Load tasks from task_assignments table
        const { data: tasksData, error: tasksError } = await supabase
          .from('task_assignments')
          .select(`
            *,
            assigned_to:assigned_to_committee(name),
            assigned_by:assigned_by_committee(name),
            assigner:assigned_by_user(name),
            approver:ec_approved_by(name)
          `)
          .eq('event_id', params.id)
          .order('created_at', { ascending: true });

        console.log('Tasks query result:', { tasksData, tasksError });

        setTasks(tasksData || []);
      }
    } catch (err) {
      console.error('Error loading event details:', err);
      toast.error('Failed to load event details');
    } finally {
      setLoading(false);
    }
  }

  async function approveTask(taskId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update task in task_assignments table
      const { error } = await supabase
        .from('task_assignments')
        .update({
          status: 'approved',
          ec_approved_by: user.id,
          ec_approved_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      // Send notification to assigned committee members
      const task = tasks.find(t => t.id === taskId);
      if (task?.assigned_to_committee) {
        await sendTaskApprovalNotification(taskId, task.assigned_to_committee, task.title);
      }

      toast.success('Task approved and assigned!');
      loadEventDetails();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve task');
    }
  }

  async function editAndApproveTask(taskId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update task with modifications in task_assignments table
      const { error } = await supabase
        .from('task_assignments')
        .update({
          ...editedTaskData,
          status: 'approved',
          ec_approved_by: user.id,
          ec_approved_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      // Send notification to assigned committee members
      const task = tasks.find(t => t.id === taskId);
      if (task?.assigned_to_committee) {
        await sendTaskApprovalNotification(taskId, task.assigned_to_committee, editedTaskData.title || task.title);
      }

      toast.success('Task updated and approved!');
      setEditingTask(null);
      setEditedTaskData({});
      loadEventDetails();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update and approve task');
    }
  }

  async function sendTaskApprovalNotification(taskId: string, committeeId: string, taskTitle: string) {
    try {
      // Get all members of the assigned committee
      const { data: members } = await supabase
        .from('committee_members')
        .select('user_id')
        .eq('committee_id', committeeId);

      if (!members || members.length === 0) return;

      // Create notifications for all committee members
      const notifications = members.map(member => ({
        user_id: member.user_id,
        type: 'task_assigned',
        title: 'New Task Approved! 📋',
        message: `A task "${taskTitle}" has been approved by EC and assigned to your committee for event "${event?.title}". Check the Tasks section to start working on it.`,
        link: `/dashboard/tasks`,
        metadata: {
          task_id: taskId,
          event_id: event?.id,
          committee_id: committeeId,
        },
      }));

      await supabase.from('notifications').insert(notifications);
    } catch (error) {
      console.error('Failed to send task approval notifications:', error);
    }
  }

  async function uploadPoster(file: File) {
    if (!event) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${event.id}-${Date.now()}.${fileExt}`;
    const filePath = `event-posters/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('event-documents')
      .upload(filePath, file);

    if (uploadError) {
      toast.error('Failed to upload poster');
      return;
    }

    const { error: updateError } = await supabase
      .from('events')
      .update({ poster_url: filePath })
      .eq('id', event.id);

    if (updateError) {
      toast.error('Failed to update event');
      return;
    }

    toast.success('Poster uploaded successfully!');
    loadEventDetails();
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-600">Loading...</div>
    </div>;
  }

  if (!event) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-600">Event not found</div>
    </div>;
  }

  // Calculate progress based on approved tasks only
  const approvedTasks = tasks.filter(t => t.status !== 'pending_ec_approval' && t.status !== 'rejected');
  const completedTasks = approvedTasks.filter(t => t.status === 'completed').length;
  const totalTasks = approvedTasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Count pending tasks for EC approval
  const pendingECApprovalCount = tasks.filter(t => t.status === 'pending_ec_approval').length;

  let posterUrl = null;
  if (event.poster_url) {
    const { data } = supabase.storage
      .from('event-documents')
      .getPublicUrl(event.poster_url);
    posterUrl = data.publicUrl;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Event Details</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Event Poster Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ImageIcon className="w-6 h-6" />
            Event Poster
          </h3>

          {posterUrl ? (
            <div className="relative">
              <img
                src={posterUrl}
                alt={event.title}
                className="w-full max-w-2xl mx-auto rounded-xl shadow-lg"
              />
              {isGraphics && (
                <div className="mt-4 text-center">
                  <label className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">
                    <Palette className="w-4 h-4" />
                    Update Poster
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadPoster(e.target.files[0])}
                    />
                  </label>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-dashed border-purple-300 rounded-xl p-12 text-center">
              <Palette className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h4 className="text-lg font-bold text-purple-900 mb-2">Design in Process</h4>
              <p className="text-purple-700 mb-4">
                The graphics team is working on creating an amazing poster for this event
              </p>
              {isGraphics && (
                <label className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 cursor-pointer">
                  <ImageIcon className="w-5 h-5" />
                  Upload Poster
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadPoster(e.target.files[0])}
                  />
                </label>
              )}
            </div>
          )}
        </div>

        {/* Event Info */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{event.title}</h2>
              <p className="text-lg text-gray-600 mt-2">{event.committees?.name}</p>
              <p className="text-sm text-gray-500">Created by: {event.created_by_profile?.name}</p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-bold ${event.status === 'approved' || event.status === 'active' ? 'bg-green-100 text-green-800' :
              event.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                event.status === 'rejected' || event.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
              }`}>
              {event.status.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>

          <p className="text-gray-700 mb-6">{event.description}</p>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {event.event_date && (
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-5 h-5" />
                <span>{new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-5 h-5" />
                <span>{event.location}</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-sm font-bold text-gray-900">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {completedTasks} of {totalTasks} tasks completed
            </p>
          </div>
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Tasks</h3>
              <p className="text-sm text-gray-600 mt-1">
                {completedTasks} of {totalTasks} approved tasks completed
                {pendingECApprovalCount > 0 && isEC && (
                  <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">
                    {pendingECApprovalCount} pending your approval
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Pending EC Approval Section */}
          {isEC && tasks.filter(t => t.status === 'pending_ec_approval').length > 0 && (
            <div className="mb-8 p-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
              <h4 className="text-lg font-bold text-yellow-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Tasks Awaiting EC Approval ({tasks.filter(t => t.status === 'pending_ec_approval').length})
              </h4>
              <p className="text-sm text-yellow-800 mb-4">
                These tasks have been proposed by committee members and are waiting for your approval before being assigned.
              </p>
              <div className="space-y-4">
                {tasks.filter(t => t.status === 'pending_ec_approval').map((task) => {
                  const isEditing = editingTask === task.id;

                  return (
                    <div key={task.id} className="bg-white border-2 border-yellow-300 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedTaskData.title || task.title}
                              onChange={(e) => setEditedTaskData({ ...editedTaskData, title: e.target.value })}
                              className="w-full font-bold text-gray-900 border border-gray-300 rounded px-3 py-2 mb-2"
                              placeholder="Task title"
                            />
                          ) : (
                            <h5 className="font-bold text-gray-900 text-lg">{task.title}</h5>
                          )}
                          <p className="text-sm text-gray-600 mt-1">
                            Assigned to: <span className="font-semibold">{task.assigned_to?.name}</span>
                          </p>
                          <p className="text-sm text-gray-600">
                            Proposed by: {task.assigner?.name} ({task.assigned_by?.name})
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
                          PENDING APPROVAL
                        </span>
                      </div>

                      {isEditing ? (
                        <textarea
                          value={editedTaskData.description || task.description || ''}
                          onChange={(e) => setEditedTaskData({ ...editedTaskData, description: e.target.value })}
                          className="w-full text-gray-700 text-sm mb-3 border border-gray-300 rounded px-3 py-2"
                          rows={3}
                          placeholder="Task description"
                        />
                      ) : (
                        task.description && (
                          <p className="text-gray-700 text-sm mb-3 bg-gray-50 p-3 rounded">{task.description}</p>
                        )
                      )}

                      {/* EC Approval Actions */}
                      <div className="mt-4 flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => editAndApproveTask(task.id)}
                              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                            >
                              <Check className="w-4 h-4" />
                              Save & Approve
                            </button>
                            <button
                              onClick={() => {
                                setEditingTask(null);
                                setEditedTaskData({});
                              }}
                              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => approveTask(task.id)}
                              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                            >
                              <Check className="w-4 h-4" />
                              Approve Task
                            </button>
                            <button
                              onClick={() => {
                                setEditingTask(task.id);
                                setEditedTaskData({ title: task.title, description: task.description });
                              }}
                              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                            >
                              <Edit className="w-4 h-4" />
                              Edit & Approve
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Approved/Active Tasks Section */}
          {approvedTasks.length > 0 ? (
            <div className="space-y-4">
              <h4 className="text-lg font-bold text-gray-900 mb-4">Active Tasks</h4>
              {approvedTasks.map((task) => {
                return (
                  <div key={task.id} className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900">{task.title}</h4>
                        <p className="text-sm text-gray-600">{task.assigned_to?.name}</p>
                        {task.ec_approved_by && task.ec_approved_at && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ Approved by {task.approver?.name} on {new Date(task.ec_approved_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${task.status === 'completed' ? 'bg-green-100 text-green-800' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                          {task.status === 'completed' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {task.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-gray-700 text-sm mb-3">{task.description}</p>
                    )}

                    {/* Progress Bar */}
                    {task.progress !== undefined && task.progress !== null && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Progress</span>
                          <span className="font-bold">{task.progress}%</span>
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
                );
              })}
            </div>
          ) : (
            !isEC || tasks.filter(t => t.status === 'pending_ec_approval').length === 0 ? (
              <p className="text-gray-600 text-center py-8">No tasks assigned yet</p>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
