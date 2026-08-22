'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import NotionProgressBar from '@/components/events/NotionProgressBar';
import { Plus, CheckCircle, Clock, AlertCircle, Camera, FileText, Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardAtmosphere from '@/components/react-bits/DashboardAtmosphere';
import PageHeader from '@/components/PageHeader';

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
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [eventPhotos, setEventPhotos] = useState<any[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [viewingPhotos, setViewingPhotos] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportAdditionalDetails, setReportAdditionalDetails] = useState('');
  const [existingReport, setExistingReport] = useState<any>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [isEditorialMember, setIsEditorialMember] = useState(false);
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

    // Check if user is in Editorial Committee
    const { data: editorialComm } = await supabase
      .from('committees')
      .select('id')
      .ilike('name', '%editorial%')
      .single();
    if (editorialComm && profile?.committee_members?.some((m: any) => m.committee_id === editorialComm.id)) {
      setIsEditorialMember(true);
    }
    // Admins can also create reports
    if (profile?.is_admin || profile?.executive_role) {
      setIsEditorialMember(true);
    }

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
    await loadPhotos(event.id);
    await loadReport(event.id);
  }

  async function loadPhotos(eventId: string) {
    const { data } = await supabase
      .from('event_photos')
      .select('*, uploader:uploaded_by(name)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    const photosWithUrls = (data || []).map((p: any) => {
      const { data: urlData } = supabase.storage.from('event-photos').getPublicUrl(p.photo_url);
      return { ...p, photo_url: urlData.publicUrl };
    });
    setEventPhotos(photosWithUrls);
  }

  async function loadReport(eventId: string) {
    const { data } = await supabase
      .from('event_reports')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    setExistingReport(data || null);
  }

  async function uploadPhoto() {
    if (!photoFile || !selectedEvent) return;
    setUploadingPhoto(true);
    try {
      const ext = photoFile.name.split('.').pop();
      const path = `${selectedEvent.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('event-photos').upload(path, photoFile);
      if (upErr) throw upErr;
      const { error } = await supabase.from('event_photos').insert({
        event_id: selectedEvent.id,
        photo_url: path,
        uploaded_by: currentUser.id,
        caption: photoCaption || null,
      });
      if (error) throw error;
      toast.success('Photo uploaded!');
      setPhotoFile(null);
      setPhotoCaption('');
      setShowPhotoUpload(false);
      await loadPhotos(selectedEvent.id);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function generateReport() {
    if (!selectedEvent) return;
    setGeneratingReport(true);
    try {
      const completedTasks = tasks.filter(t => t.status === 'completed' || t.completed_at);
      const totalTasks = tasks.filter(t => t.ec_approved_by).length;
      const reportContent = `# Event Report: ${selectedEvent.title}

## Event Details
- **Event Name:** ${selectedEvent.title}
- **Description:** ${selectedEvent.description || 'N/A'}
- **Date:** ${selectedEvent.event_date ? new Date(selectedEvent.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
- **Committee:** ${selectedEvent.committee?.name || 'N/A'}
- **Proposed By:** ${selectedEvent.proposer?.name || 'N/A'}
- **Status:** ${selectedEvent.status?.replace(/_/g, ' ').toUpperCase()}

## Task Summary
- **Total Tasks:** ${totalTasks}
- **Completed:** ${completedTasks.length}
- **Completion Rate:** ${totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0}%

## Task Details
${tasks.filter(t => t.ec_approved_by).map(t => `### ${t.title}
- **Assigned To:** ${t.assigned_committee?.name || 'N/A'}
- **Status:** ${t.status?.replace(/_/g, ' ').toUpperCase()}
- **Progress:** ${t.progress || 0}%
${t.description ? `- **Description:** ${t.description}` : ''}
`).join('\n')}

## Photos
- **Total Photos Uploaded:** ${eventPhotos.length}

${reportAdditionalDetails ? `## Additional Details\n${reportAdditionalDetails}` : ''}

---
*Report generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} by IIChE AVVU SC*`;

      const { error } = await supabase.from('event_reports').insert({
        event_id: selectedEvent.id,
        report_content: reportContent,
        additional_details: reportAdditionalDetails || null,
        created_by: currentUser.id,
      });
      if (error) throw error;
      toast.success('Report created!');
      setShowReportModal(false);
      setReportAdditionalDetails('');
      await loadReport(selectedEvent.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create report');
    } finally {
      setGeneratingReport(false);
    }
  }

  function downloadReport(format: 'txt') {
    if (!existingReport) return;
    const blob = new Blob([existingReport.report_content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedEvent?.title || 'event'}_report.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      <DashboardAtmosphere subtitle="Track tasks and progress for active events." />
      <PageHeader title="Event Progress" gradientTitle />

      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Events List */}
          <div className="premium-panel rounded-xl shadow-lg p-6">
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
                    headApproved={true}
                    ecApproved={true}
                    facultyApproved={true}
                  />

                  {/* Event Photos Gallery */}
                  <div className="mt-4 flex items-center gap-3">
                    <button onClick={() => setShowPhotoUpload(true)} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm">
                      <Camera className="w-4 h-4" /> Upload Photos
                    </button>
                    {eventPhotos.length > 0 && (
                      <button onClick={() => { setViewingPhotos(true); setPhotoIndex(0); }} className="flex items-center gap-2 text-purple-600 hover:text-purple-700 text-sm font-medium">
                        📸 View {eventPhotos.length} Photo{eventPhotos.length > 1 ? 's' : ''}
                      </button>
                    )}
                  </div>

                  {/* Photo Thumbnails */}
                  {eventPhotos.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                      {eventPhotos.slice(0, 6).map((photo: any, idx: number) => (
                        <img key={photo.id} src={photo.photo_url} alt={photo.caption || 'Event photo'}
                          className="w-16 h-16 rounded-lg object-cover cursor-pointer hover:opacity-80 transition flex-shrink-0"
                          onClick={() => { setPhotoIndex(idx); setViewingPhotos(true); }} />
                      ))}
                      {eventPhotos.length > 6 && (
                        <button onClick={() => { setViewingPhotos(true); setPhotoIndex(0); }}
                          className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-600 font-medium flex-shrink-0">
                          +{eventPhotos.length - 6}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* View Event Details Button */}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Tasks</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {tasks.filter(t => t.status === 'completed' || t.completed_at).length} of {tasks.filter(t => t.status !== 'pending' && t.ec_approved_by).length} completed
                      </p>
                    </div>
                    <button
                      onClick={() => router.push(`/dashboard/event-detail/${selectedEvent.id}`)}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                    >
                      View Event Details →
                    </button>
                  </div>
                </div>

                {/* Event Report Section - Editorial Committee Only */}
                {isEditorialMember && (
                  <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" /> Event Report
                      </h3>
                      {!existingReport && (
                        <button onClick={() => setShowReportModal(true)}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                          <FileText className="w-4 h-4" /> Create Report
                        </button>
                      )}
                    </div>
                    {existingReport ? (
                      <div>
                        <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-60 overflow-y-auto">
                          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{existingReport.report_content}</pre>
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => downloadReport('txt')}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                            <Download className="w-4 h-4" /> Download as TXT
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Created on {new Date(existingReport.created_at).toLocaleDateString()}</p>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No report created yet. Click "Create Report" to generate an automated event report.</p>
                    )}
                  </div>
                )}
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

      {/* Photo Upload Modal */}
      {showPhotoUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Upload Event Photo</h2>
              <button onClick={() => { setShowPhotoUpload(false); setPhotoFile(null); setPhotoCaption(''); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photo *</label>
                <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm" />
              </div>
              {photoFile && (
                <img src={URL.createObjectURL(photoFile)} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Caption (optional)</label>
                <input type="text" value={photoCaption} onChange={e => setPhotoCaption(e.target.value)}
                  placeholder="Describe this photo..." className="w-full border border-gray-300 rounded-lg px-4 py-2" />
              </div>
              <div className="flex gap-3">
                <button onClick={uploadPhoto} disabled={!photoFile || uploadingPhoto}
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                </button>
                <button onClick={() => { setShowPhotoUpload(false); setPhotoFile(null); setPhotoCaption(''); }}
                  className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {viewingPhotos && eventPhotos.length > 0 && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <button onClick={() => setViewingPhotos(false)} className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"><X className="w-8 h-8" /></button>
          <button onClick={() => setPhotoIndex((photoIndex - 1 + eventPhotos.length) % eventPhotos.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black/30 p-2 rounded-full"><ChevronLeft className="w-8 h-8" /></button>
          <button onClick={() => setPhotoIndex((photoIndex + 1) % eventPhotos.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black/30 p-2 rounded-full"><ChevronRight className="w-8 h-8" /></button>
          <div className="max-w-4xl max-h-[80vh] flex flex-col items-center">
            <img src={eventPhotos[photoIndex].photo_url} alt={eventPhotos[photoIndex].caption || 'Event photo'}
              className="max-w-full max-h-[70vh] object-contain rounded-lg" />
            <div className="mt-3 text-center text-white">
              {eventPhotos[photoIndex].caption && <p className="text-lg">{eventPhotos[photoIndex].caption}</p>}
              <p className="text-sm text-gray-400 mt-1">
                Uploaded by {eventPhotos[photoIndex].uploader?.name || 'Unknown'} • {photoIndex + 1} of {eventPhotos.length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Report Creation Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Create Event Report</h2>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              This will generate an automated report for <span className="font-semibold">{selectedEvent?.title}</span> including event details, task summary, and photo count.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional Details (optional)</label>
              <textarea value={reportAdditionalDetails} onChange={e => setReportAdditionalDetails(e.target.value)}
                rows={4} placeholder="Add any extra notes, observations, or highlights..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2" />
            </div>
            <div className="flex gap-3">
              <button onClick={generateReport} disabled={generatingReport}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {generatingReport ? 'Generating...' : 'Generate Report'}
              </button>
              <button onClick={() => setShowReportModal(false)}
                className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
