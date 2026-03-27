'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { Calendar, MapPin, CheckCircle, Clock, Edit, Check, X, Palette, ImageIcon, AlertCircle, Camera, ChevronLeft, ChevronRight, Users, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import ReminderButton from '@/components/ReminderButton';
import ReminderLog from '@/components/ReminderLog';
import StatusIndicator from '@/components/StatusIndicator';
import EventReport from '@/components/EventReport';
import QRCode from 'qrcode';
import EventQrScanner from '@/components/events/EventQrScanner';

export default function EventDetailPage() {
  const [event, setEvent] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isEC, setIsEC] = useState(false);
  const [isFaculty, setIsFaculty] = useState(false);
  const [isGraphics, setIsGraphics] = useState(false);
  const [isEditorial, setIsEditorial] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editedTaskData, setEditedTaskData] = useState<any>({});
  const [eventPhotos, setEventPhotos] = useState<any[]>([]);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [viewingPhotos, setViewingPhotos] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'info' | 'participants' | 'attendance'>('info');
  const [participants, setParticipants] = useState<any[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [eventQrImage, setEventQrImage] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [slideshowUrls, setSlideshowUrls] = useState<Set<string>>(new Set());
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    loadEventDetails();
    loadUserProfile();
  }, []);
  useEffect(() => {
    void loadSlideshowSelections();
  }, []);
  useEffect(() => {
    if (event?.id) void loadParticipants();
  }, [event?.id]);

  async function loadParticipants() {
    if (!event?.id) return;
    setParticipantsLoading(true);
    const { data, error } = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load participants');
    setParticipants(data || []);
    setParticipantsLoading(false);
  }

  async function loadSlideshowSelections() {
    const { data } = await supabase
      .from('homepage_slideshow')
      .select('photo_url')
      .eq('is_active', true)
      .eq('approval_status', 'approved');
    setSlideshowUrls(new Set((data || []).map((d: any) => d.photo_url)));
  }

  async function togglePhotoInSlideshow(photo: any) {
    const photoUrl = photo.photo_url;
    const alreadyIn = slideshowUrls.has(photoUrl);
    try {
      if (alreadyIn) {
        const { error } = await supabase
          .from('homepage_slideshow')
          .delete()
          .eq('photo_url', photoUrl);
        if (error) throw error;
        toast.success('Removed from slideshow');
      } else {
        const { data: maxRows } = await supabase
          .from('homepage_slideshow')
          .select('display_order')
          .order('display_order', { ascending: false })
          .limit(1);
        const nextOrder = (maxRows?.[0]?.display_order || 0) + 1;
        const { error } = await supabase
          .from('homepage_slideshow')
          .insert({
            photo_url: photoUrl,
            title: event?.title ? `${event.title} Photo` : 'Event Photo',
            description: photo.caption || null,
            link_url: null,
            approval_status: 'approved',
            is_active: true,
            display_order: nextOrder,
          });
        if (error) throw error;
        toast.success('Added to slideshow');
      }
      await loadSlideshowSelections();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update slideshow');
    }
  }

  async function createEventQr() {
    if (!event?.id) return;
    const { data: eventForm } = await supabase
      .from('forms')
      .select('id')
      .eq('event_id', event.id)
      .eq('form_type', 'event_registration')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!eventForm?.id) {
      toast.error('No active event registration form found');
      return;
    }
    const formUrl = `${window.location.origin}/dashboard/forms/${eventForm.id}?source=qr`;
    const qr = await QRCode.toDataURL(formUrl, { width: 280, margin: 1 });
    setEventQrImage(qr);
    toast.success('Event QR created');
  }

  async function markAttendance(participantId: string, status: 'present' | 'absent' = 'present') {
    const updateData: any = { attendance_status: status };
    if (status === 'present') updateData.attended_at = new Date().toISOString();
    const { error } = await supabase.from('event_participants').update(updateData).eq('id', participantId);
    if (error) toast.error(error.message);
    await loadParticipants();
  }

  async function processScanPayload(raw: string) {
    if (!raw.trim()) return;
    try {
      const payload = JSON.parse(raw);
      if (!payload?.participant_id || payload?.event_id !== event?.id) {
        toast.error('Invalid participant QR for this event');
        return;
      }
      await markAttendance(payload.participant_id, 'present');
      toast.success('Attendance marked present');
    } catch {
      toast.error('Invalid QR payload');
    }
  }

  async function handleScan() {
    await processScanPayload(scanInput);
    setScanInput('');
  }

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
    setIsFaculty(profile?.is_faculty === true || profile?.is_admin === true);

    // Check if user is in Graphics committee
    const graphicsCommittee = profile?.committee_members?.find(
      (m: any) => m.committees?.name?.toLowerCase().includes('graphics')
    );
    setIsGraphics(!!graphicsCommittee);

    // Check if user is in Editorial committee
    const editorialCommittee = profile?.committee_members?.find(
      (m: any) => m.committees?.name?.toLowerCase().includes('editorial')
    );
    setIsEditorial(!!editorialCommittee);
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

        // Load event photos
        const { data: photos } = await supabase
          .from('event_photos')
          .select('*, uploader:uploaded_by(name)')
          .eq('event_id', params.id)
          .order('created_at', { ascending: false });
        const photosWithUrls = (photos || []).map((p: any) => {
          const { data: urlData } = supabase.storage.from('event-photos').getPublicUrl(p.photo_url);
          return { ...p, photo_url: urlData.publicUrl };
        });
        setEventPhotos(photosWithUrls);
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

      const updateData: any = {
        status: 'approved',
        ec_approved_by: user.id,
        ec_approved_at: new Date().toISOString()
      };

      // Include deadline if set
      if (editedTaskData.deadline) {
        updateData.deadline = new Date(editedTaskData.deadline).toISOString();
      }

      const { error } = await supabase
        .from('task_assignments')
        .update(updateData)
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

  async function uploadEventPhoto() {
    if (!photoFile || !event || !userProfile) return;
    setUploadingPhoto(true);
    try {
      const ext = photoFile.name.split('.').pop();
      const path = `${event.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('event-photos').upload(path, photoFile);
      if (upErr) throw upErr;
      const { error } = await supabase.from('event_photos').insert({
        event_id: event.id, photo_url: path, uploaded_by: userProfile.id, caption: photoCaption || null,
      });
      if (error) throw error;
      toast.success('Photo uploaded!');
      setPhotoFile(null);
      setPhotoCaption('');
      setShowPhotoUpload(false);
      loadEventDetails();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingPhoto(false);
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

    // Set poster as pending faculty approval instead of directly updating
    const { error: updateError } = await supabase
      .from('events')
      .update({
        poster_url: filePath,
        poster_status: 'pending_faculty_approval'
      })
      .eq('id', event.id);

    if (updateError) {
      // Fallback: poster_status column might not exist yet, just update poster_url
      await supabase.from('events').update({ poster_url: filePath }).eq('id', event.id);
    }

    // Notify faculty about pending poster approval
    const { data: facultyMembers } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_faculty', true);

    if (facultyMembers && facultyMembers.length > 0) {
      const notifications = facultyMembers.map((f: any) => ({
        user_id: f.id,
        type: 'poster_approval',
        title: 'Poster Pending Approval 🎨',
        message: `A poster for "${event.title}" has been uploaded by the Graphics team and needs your approval.`,
        link: `/dashboard/event-detail/${event.id}`,
        metadata: { event_id: event.id },
      }));
      await supabase.from('notifications').insert(notifications);
    }

    toast.success('Poster uploaded! Sent to faculty for approval.');
    loadEventDetails();
  }

  if (loading) {
    return <div className="min-h-screen bg-mesh flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 mx-auto mb-4 animate-pulse-glow"></div>
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>;
  }

  if (!event) {
    return <div className="min-h-screen bg-mesh flex items-center justify-center">
      <div className="text-gray-400">Event not found</div>
    </div>;
  }

  // Calculate progress: 30% from approvals + 70% from tasks
  const approvedTasks = tasks.filter(t => t.status !== 'pending_ec_approval' && t.status !== 'rejected');
  const completedTasks = approvedTasks.filter(t => t.status === 'completed').length;
  const totalTasks = approvedTasks.length;

  // Approval progress (30% total)
  const headApproved = !!event.head_approved_by;
  const ecApproved = event.status !== 'pending_head_approval' && event.status !== 'pending_ec_approval' && event.status !== 'review_by_cohead';
  const facultyApproved = event.status === 'active' || event.status === 'in_progress' || event.status === 'completed';
  const approvalProgress = (headApproved ? 10 : 0) + (ecApproved ? 10 : 0) + (facultyApproved ? 10 : 0);

  // Task progress (70% total) — based on individual task progress percentages
  let taskProgress = 0;
  if (totalTasks > 0) {
    const taskProgressSum = approvedTasks.reduce((sum, t) => sum + (t.progress || 0), 0);
    taskProgress = Math.round((taskProgressSum / (totalTasks * 100)) * 70);
  }

  const overallProgress = approvalProgress + taskProgress;

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
    <div className="min-h-screen bg-mesh">
      <PageHeader title="Event Details" />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="premium-card rounded-2xl p-2 mb-6 flex gap-2 w-fit">
          <button onClick={() => setActiveTab('info')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${activeTab === 'info' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-white/70'}`}>Event Info</button>
          <button onClick={() => setActiveTab('participants')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${activeTab === 'participants' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-white/70'}`}>Participant Details</button>
          <button onClick={() => setActiveTab('attendance')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${activeTab === 'attendance' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-white/70'}`}>Participation / Attendance</button>
        </div>
        {activeTab === 'info' && (
          <>
        {/* Event Poster Section */}
        <div className="premium-panel rounded-2xl p-8 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ImageIcon className="w-6 h-6" />
            Event Poster
            {event.poster_status === 'pending_faculty_approval' && (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-semibold">Pending Faculty Approval</span>
            )}
          </h3>

          {posterUrl ? (
            <div className="relative">
              <img
                src={posterUrl}
                alt={event.title}
                className="w-full max-w-2xl mx-auto rounded-xl shadow-lg"
              />
              {/* Faculty approval buttons */}
              {isFaculty && event.poster_status === 'pending_faculty_approval' && (
                <div className="mt-4 flex justify-center gap-3">
                  <button
                    onClick={async () => {
                      await supabase.from('events').update({ poster_status: 'approved' }).eq('id', event.id);
                      toast.success('Poster approved!');
                      loadEventDetails();
                    }}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Approve Poster
                  </button>
                  <button
                    onClick={async () => {
                      await supabase.from('events').update({ poster_status: 'rejected', poster_url: null }).eq('id', event.id);
                      toast.success('Poster rejected');
                      loadEventDetails();
                    }}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}
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

        {/* Event Photos Section */}
        <div className="premium-panel rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Camera className="w-6 h-6" /> Event Photos
            </h3>
            <button onClick={() => setShowPhotoUpload(true)}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-semibold">
              <Camera className="w-4 h-4" /> Upload Photo
            </button>
          </div>
          {eventPhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {eventPhotos.map((photo: any, idx: number) => (
                <div key={photo.id} className="relative group cursor-pointer" onClick={() => { setPhotoIndex(idx); setViewingPhotos(true); }}>
                  <img src={photo.photo_url} alt={photo.caption || 'Event photo'} className="w-full h-32 object-cover rounded-xl hover:opacity-90 transition" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void togglePhotoInSlideshow(photo);
                    }}
                    className={`absolute top-2 right-2 text-[10px] px-2 py-1 rounded-md text-white transition ${slideshowUrls.has(photo.photo_url) ? 'bg-rose-600/85 hover:bg-rose-700' : 'bg-black/60 hover:bg-black/75'}`}
                    title={slideshowUrls.has(photo.photo_url) ? 'Remove from slideshow' : 'Add to slideshow'}
                  >
                    {slideshowUrls.has(photo.photo_url) ? 'Remove from slideshow' : 'Add to slideshow'}
                  </button>
                  {photo.caption && <p className="text-[10px] text-gray-500 mt-1 truncate">{photo.caption}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No photos uploaded yet. Be the first to share event moments!</p>
          )}
        </div>

        {/* Photo Upload Modal */}
        {showPhotoUpload && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Upload Event Photo</h2>
                <button onClick={() => { setShowPhotoUpload(false); setPhotoFile(null); setPhotoCaption(''); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Photo *</label>
                  <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm" />
                </div>
                {photoFile && <img src={URL.createObjectURL(photoFile)} alt="Preview" className="w-full h-40 object-cover rounded-lg" />}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Caption (optional)</label>
                  <input type="text" value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} placeholder="Describe this photo..." className="w-full border border-gray-300 rounded-lg px-4 py-2" />
                </div>
                <div className="flex gap-3">
                  <button onClick={uploadEventPhoto} disabled={!photoFile || uploadingPhoto} className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                    {uploadingPhoto ? 'Uploading...' : 'Upload'}
                  </button>
                  <button onClick={() => { setShowPhotoUpload(false); setPhotoFile(null); setPhotoCaption(''); }} className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Photo Viewer Modal */}
        {viewingPhotos && eventPhotos.length > 0 && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
            <button onClick={() => setViewingPhotos(false)} className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 text-2xl">✕</button>
            {eventPhotos.length > 1 && <>
              <button onClick={() => setPhotoIndex((photoIndex - 1 + eventPhotos.length) % eventPhotos.length)} className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/30 p-2 rounded-full"><ChevronLeft className="w-8 h-8" /></button>
              <button onClick={() => setPhotoIndex((photoIndex + 1) % eventPhotos.length)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/30 p-2 rounded-full"><ChevronRight className="w-8 h-8" /></button>
            </>}
            <div className="max-w-4xl max-h-[80vh] flex flex-col items-center">
              <img src={eventPhotos[photoIndex].photo_url} alt="" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
              <div className="mt-3 text-center text-white">
                {eventPhotos[photoIndex].caption && <p className="text-lg">{eventPhotos[photoIndex].caption}</p>}
                <p className="text-sm text-gray-400 mt-1">By {eventPhotos[photoIndex].uploader?.name || 'Unknown'} · {photoIndex + 1}/{eventPhotos.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* Event Info */}
        <div className="premium-panel rounded-2xl p-8 mb-6">
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

          {/* Approval Reminder & Status */}
          <div className="flex items-center gap-3 mb-4">
            <StatusIndicator entityType="approval" timestamp={event.updated_at} currentStatus={event.status} />
            <ReminderButton entityId={event.id} entityType="approval" />
          </div>

          <p className="text-gray-700 mb-6">{event.description}</p>

          {Array.isArray(event.documents) && event.documents.length > 0 && (
            <div className="mb-6 p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
              <h4 className="text-sm font-semibold text-indigo-700 mb-2">Proposal Attachments</h4>
              <div className="space-y-1">
                {event.documents.map((doc: any, idx: number) => (
                  <a
                    key={`event-doc-${idx}`}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-indigo-600 hover:text-indigo-800 truncate"
                  >
                    {doc.name || `Attachment ${idx + 1}`}
                  </a>
                ))}
              </div>
            </div>
          )}

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
            {event.event_duration && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-5 h-5" />
                <span>Duration: {event.event_duration}</span>
              </div>
            )}
            {event.expected_participants && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-lg">👥</span>
                <span>Expected: {event.expected_participants} participants</span>
              </div>
            )}
            {event.guest_name && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-lg">🎤</span>
                <span>Guest: {event.guest_name}</span>
              </div>
            )}
            {event.registration_fee && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-lg">🎟️</span>
                <span>Fee: {event.registration_fee}</span>
              </div>
            )}
            {event.prize && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-lg">🏆</span>
                <span>Prize: {event.prize}</span>
              </div>
            )}
            {event.budget && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-lg">💰</span>
                <span>Budget: ₹{event.budget.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Approval Pipeline */}
          <div className="mt-6 mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Approval Pipeline</h4>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${headApproved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {headApproved ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                Head
              </div>
              <div className={`w-6 h-0.5 ${headApproved ? 'bg-green-400' : 'bg-gray-300'}`} />
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${ecApproved ? 'bg-green-100 text-green-700' : headApproved ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                {ecApproved ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                EC
              </div>
              <div className={`w-6 h-0.5 ${ecApproved ? 'bg-green-400' : 'bg-gray-300'}`} />
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${facultyApproved ? 'bg-green-100 text-green-700' : ecApproved ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                {facultyApproved ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                Faculty
              </div>
              <div className={`w-6 h-0.5 ${facultyApproved ? 'bg-green-400' : 'bg-gray-300'}`} />
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${facultyApproved ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                Tasks
              </div>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-sm font-bold text-gray-900">{overallProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div className="h-3 rounded-full transition-all duration-500 flex">
                {approvalProgress > 0 && (
                  <div className="bg-green-500 h-full" style={{ width: `${approvalProgress}%` }} />
                )}
                {taskProgress > 0 && (
                  <div className="bg-blue-500 h-full" style={{ width: `${taskProgress}%` }} />
                )}
              </div>
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
                Approvals: {approvalProgress}%
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 ml-3 mr-1" />
                Tasks: {taskProgress}%
              </p>
              <p className="text-xs text-gray-500">
                {completedTasks}/{totalTasks} tasks done
              </p>
            </div>
          </div>

          {/* Reminder Activity Log */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Reminder Activity</h4>
            <ReminderLog entityId={event.id} />
          </div>
        </div>

        {/* Event Report */}
        <EventReport
          event={event}
          tasks={tasks}
          eventPhotos={eventPhotos}
          canEdit={isEC || isFaculty || isEditorial}
        />

        {/* Tasks */}
        <div className="premium-panel rounded-2xl p-8">
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

                      {/* Deadline picker - shown for EC during approval */}
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Set Deadline</label>
                        <input
                          type="datetime-local"
                          value={editedTaskData.deadline || ''}
                          onChange={(e) => setEditedTaskData({ ...editedTaskData, deadline: e.target.value })}
                          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full max-w-xs"
                        />
                      </div>

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
                        {task.deadline && (
                          <p className={`text-xs mt-1 font-medium ${new Date(task.deadline) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                            📅 Deadline: {new Date(task.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {new Date(task.deadline) < new Date() && ' (Overdue)'}
                          </p>
                        )}
                        {!task.deadline && task.ec_approved_at && (
                          <p className={`text-xs mt-1 font-medium ${new Date(new Date(task.ec_approved_at).getTime() + 2 * 24 * 60 * 60 * 1000) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                            📅 Deadline: {new Date(new Date(task.ec_approved_at).getTime() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} (default)
                            {new Date(new Date(task.ec_approved_at).getTime() + 2 * 24 * 60 * 60 * 1000) < new Date() && ' (Overdue)'}
                          </p>
                        )}
                        {!task.deadline && !task.ec_approved_at && task.created_at && (
                          <p className={`text-xs mt-1 font-medium ${new Date(new Date(task.created_at).getTime() + 2 * 24 * 60 * 60 * 1000) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                            📅 Deadline: {new Date(new Date(task.created_at).getTime() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} (default)
                            {new Date(new Date(task.created_at).getTime() + 2 * 24 * 60 * 60 * 1000) < new Date() && ' (Overdue)'}
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
                            className="progress-animated h-2 rounded-full transition-all"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Task Reminder */}
                    {task.status !== 'completed' && (
                      <div className="mt-3 flex items-center gap-2">
                        <StatusIndicator entityType="task" timestamp={task.deadline} currentStatus={task.status} />
                        <ReminderButton entityId={task.id} entityType="task" />
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
          </>
        )}

        {activeTab === 'participants' && (
          <div className="premium-panel rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" /> Participant Details
            </h3>
            {participantsLoading ? (
              <p className="text-gray-500">Loading participants...</p>
            ) : participants.length === 0 ? (
              <p className="text-gray-500">No participants registered yet.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2 max-h-[540px] overflow-y-auto pr-2">
                  {participants.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedParticipant(p)}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition ${selectedParticipant?.id === p.id ? 'border-indigo-300 bg-indigo-50/80' : 'border-gray-200 bg-white/70 hover:bg-gray-50'}`}
                    >
                      <p className="font-semibold text-gray-900">{p.participant_name || 'Participant'}</p>
                      <p className="text-xs text-gray-500">{p.participant_email || 'No email'}</p>
                    </button>
                  ))}
                </div>
                <div className="rounded-xl border border-gray-200 bg-white/70 p-4">
                  {selectedParticipant ? (
                    <>
                      <h4 className="font-semibold text-gray-900 mb-2">Submitted Form Details</h4>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words">
                        {JSON.stringify(selectedParticipant.form_data || {}, null, 2)}
                      </pre>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Select a participant to view complete response details.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="premium-panel rounded-2xl p-8">
            <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <QrCode className="w-6 h-6" /> Participation / Attendance
              </h3>
              <button onClick={createEventQr} className="btn-gradient-purple px-4 py-2 rounded-xl text-sm font-semibold">
                Create Event QR
              </button>
            </div>
            {eventQrImage && (
              <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 max-w-xs">
                <img src={eventQrImage} alt="Event QR" className="w-56 h-56 mx-auto rounded-lg bg-white p-2 border border-indigo-100" />
                <p className="text-xs text-indigo-700 mt-2 text-center">Scan to open event registration form</p>
              </div>
            )}
            <div className="mb-6 rounded-xl border border-gray-200 bg-white/70 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-gray-800">Scan participant QR</p>
                <button onClick={() => setScannerOpen(true)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
                  Scan QR (Camera)
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder='Paste scanned JSON payload here'
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button onClick={handleScan} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
                  Mark Present
                </button>
              </div>
            </div>
            {participants.length === 0 ? (
              <p className="text-gray-500">No participants available for attendance.</p>
            ) : (
              <div className="space-y-2">
                {participants.map((p: any) => (
                  <div key={p.id} className="rounded-xl border border-gray-200 bg-white/70 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{p.participant_name || 'Participant'}</p>
                      <p className="text-xs text-gray-500">{p.participant_email || 'No email'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${p.attendance_status === 'present' ? 'bg-emerald-100 text-emerald-700' : p.attendance_status === 'absent' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {(p.attendance_status || 'registered').toUpperCase()}
                      </span>
                      <button onClick={() => markAttendance(p.id, 'present')} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Present</button>
                      <button onClick={() => markAttendance(p.id, 'absent')} className="text-xs px-3 py-1.5 rounded-lg bg-gray-600 text-white hover:bg-gray-700">Absent</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <EventQrScanner
              open={scannerOpen}
              onClose={() => setScannerOpen(false)}
              onScanned={(decodedText) => {
                void processScanPayload(decodedText);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
