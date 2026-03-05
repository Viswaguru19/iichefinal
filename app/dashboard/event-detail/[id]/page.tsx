'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { Calendar, MapPin, CheckCircle, Clock, Edit, Check, X, Palette, ImageIcon } from 'lucide-react';
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
    const { data: eventData } = await supabase
      .from('events')
      .select('*, committees(name), created_by_profile:profiles!events_created_by_fkey(name)')
      .eq('id', params.id)
      .single();

    setEvent(eventData);

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*, assigned_committee:committees!tasks_assigned_to_fkey(name)')
      .eq('event_id', params.id)
      .order('created_at', { ascending: true });

    setTasks(tasksData || []);
    setLoading(false);
  }

  async function approveTask(taskId: string) {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'assigned',
        ec_approved: true,
        ec_approved_at: new Date().toISOString()
      })
      .eq('id', taskId);

    if (error) {
      toast.error('Failed to approve task');
      return;
    }

    toast.success('Task approved and assigned!');
    loadEventDetails();
  }

  async function editAndApproveTask(taskId: string) {
    const { error } = await supabase
      .from('tasks')
      .update({
        ...editedTaskData,
        status: 'assigned',
        ec_approved: true,
        ec_approved_at: new Date().toISOString()
      })
      .eq('id', taskId);

    if (error) {
      toast.error('Failed to update and approve task');
      return;
    }

    toast.success('Task updated and approved!');
    setEditingTask(null);
    setEditedTaskData({});
    loadEventDetails();
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

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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
            {event.date && (
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-5 h-5" />
                <span>{new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            )}
            {event.venue && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-5 h-5" />
                <span>{event.venue}</span>
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
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Tasks</h3>
          {tasks.length > 0 ? (
            <div className="space-y-4">
              {tasks.map((task) => {
                const isEditing = editingTask === task.id;
                const needsECApproval = task.status === 'pending_ec_approval';

                return (
                  <div key={task.id} className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedTaskData.title || task.title}
                            onChange={(e) => setEditedTaskData({ ...editedTaskData, title: e.target.value })}
                            className="w-full font-bold text-gray-900 border border-gray-300 rounded px-2 py-1 mb-2"
                          />
                        ) : (
                          <h4 className="font-bold text-gray-900">{task.title}</h4>
                        )}
                        <p className="text-sm text-gray-600">{task.assigned_committee?.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${task.status === 'completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'assigned' || task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              task.status === 'pending_ec_approval' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                          }`}>
                          {task.status === 'completed' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {task.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {isEditing ? (
                      <textarea
                        value={editedTaskData.description || task.description || ''}
                        onChange={(e) => setEditedTaskData({ ...editedTaskData, description: e.target.value })}
                        className="w-full text-gray-700 text-sm mb-3 border border-gray-300 rounded px-2 py-1"
                        rows={3}
                      />
                    ) : (
                      task.description && (
                        <p className="text-gray-700 text-sm mb-3">{task.description}</p>
                      )
                    )}

                    {/* EC Approval Actions */}
                    {isEC && needsECApproval && (
                      <div className="mt-4 flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => editAndApproveTask(task.id)}
                              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                            >
                              <Check className="w-4 h-4" />
                              Save & Approve
                            </button>
                            <button
                              onClick={() => {
                                setEditingTask(null);
                                setEditedTaskData({});
                              }}
                              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => approveTask(task.id)}
                              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                            >
                              <Check className="w-4 h-4" />
                              Approve Task
                            </button>
                            <button
                              onClick={() => {
                                setEditingTask(task.id);
                                setEditedTaskData({ title: task.title, description: task.description });
                              }}
                              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                            >
                              <Edit className="w-4 h-4" />
                              Edit & Approve
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">No tasks assigned yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
