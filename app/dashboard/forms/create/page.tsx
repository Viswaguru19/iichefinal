'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Plus, X, GripVertical, Copy, Eye, Settings, ChevronDown, ChevronUp, Upload, Type, AlignLeft, List, CheckSquare, ChevronRight, Calendar, Hash, Mail, FileUp, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { EVENT_REGISTRATION_ELIGIBLE_STATUSES } from '@/lib/event-registration';
import { publicFormUrl } from '@/lib/form-public-access';
import { hasNameAndEmailFields } from '@/lib/form-responder-fields';

interface FormField {
  id: string;
  field_type: string;
  label: string;
  description: string;
  options: string[];
  required: boolean;
  validation: {
    email?: boolean;
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    maxFileSize?: number; // MB
    maxFiles?: number;
    allowedFileTypes?: string[];
  };
  order_index: number;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Short Answer', icon: Type },
  { value: 'textarea', label: 'Paragraph', icon: AlignLeft },
  { value: 'radio', label: 'Multiple Choice', icon: List },
  { value: 'checkbox', label: 'Checkboxes', icon: CheckSquare },
  { value: 'dropdown', label: 'Dropdown', icon: ChevronRight },
  { value: 'file', label: 'File Upload', icon: FileUp },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'email', label: 'Email', icon: Mail },
];

function generateId() {
  return 'f_' + Math.random().toString(36).substring(2, 9);
}

/** Event row may use `event_date` and/or legacy `date` from different code paths. */
function formatEventListDate(ev: { event_date?: string | null; date?: string | null }) {
  const raw = ev.event_date || ev.date;
  if (!raw) return 'Date TBA';
  try {
    return new Date(raw).toLocaleDateString('en-IN');
  } catch {
    return 'Date TBA';
  }
}

export default function CreateFormPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Settings
  const [status, setStatus] = useState<'active' | 'draft'>('active');
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [requireLogin, setRequireLogin] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accessType, setAccessType] = useState<'public' | 'internal'>('public');
  const [formType, setFormType] = useState<'normal' | 'event_registration'>('normal');
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  /** Event registration: show each registrant a personal QR after submit (for attendance scan). */
  const [showAttendanceQrAfterSubmit, setShowAttendanceQrAfterSubmit] = useState(true);
  const prevFormTypeRef = useRef<string | null>(null);

  const router = useRouter();
  const supabase = createClient();
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (formType !== 'event_registration') return;
    void loadActiveEvents();
  }, [formType]);

  /** Event registration defaults: public link + attendance QR. */
  useEffect(() => {
    const prev = prevFormTypeRef.current;
    if (formType === 'event_registration' && prev !== 'event_registration') {
      setRequireLogin(false);
      setAccessType('public');
      setShowAttendanceQrAfterSubmit(true);
    }
    prevFormTypeRef.current = formType;
  }, [formType]);

  async function loadActiveEvents() {
    setEventsLoading(true);
    const wide = await supabase
      .from('events')
      .select('id, title, location, event_date, date, status, created_at')
      .in('status', [...EVENT_REGISTRATION_ELIGIBLE_STATUSES])
      .order('created_at', { ascending: false });

    let rows: any[] | null = wide.data;
    let error = wide.error;

    if (
      error &&
      (error.message?.toLowerCase().includes('column') ||
        error.message?.includes('date') ||
        (error as { code?: string }).code === '42703')
    ) {
      const narrow = await supabase
        .from('events')
        .select('id, title, location, event_date, status, created_at')
        .in('status', [...EVENT_REGISTRATION_ELIGIBLE_STATUSES])
        .order('created_at', { ascending: false });
      rows = narrow.data;
      error = narrow.error;
    }

    if (error) {
      console.error('loadActiveEvents', error);
      toast.error(error.message || 'Failed to load events');
      setActiveEvents([]);
    } else {
      setActiveEvents(rows || []);
    }
    setEventsLoading(false);
  }

  function addField(type: string) {
    const newField: FormField = {
      id: generateId(),
      field_type: type,
      label: '',
      description: '',
      options: ['radio', 'checkbox', 'dropdown'].includes(type) ? ['Option 1'] : [],
      required: false,
      validation: type === 'file' ? { maxFileSize: 10, maxFiles: 1, allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'png'] } : {},
      order_index: fields.length,
    };
    setFields([...fields, newField]);
    setActiveField(newField.id);
  }

  function duplicateField(index: number) {
    const original = fields[index];
    const copy: FormField = { ...original, id: generateId(), label: original.label + ' (copy)', order_index: fields.length };
    const updated = [...fields];
    updated.splice(index + 1, 0, copy);
    setFields(updated.map((f, i) => ({ ...f, order_index: i })));
  }

  function removeField(index: number) {
    setFields(fields.filter((_, i) => i !== index).map((f, i) => ({ ...f, order_index: i })));
    setActiveField(null);
  }

  function updateField(id: string, updates: Partial<FormField>) {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  }

  function moveField(index: number, direction: 'up' | 'down') {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === fields.length - 1)) return;
    const newFields = [...fields];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];
    setFields(newFields.map((f, i) => ({ ...f, order_index: i })));
  }

  function addOption(fieldId: string) {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    updateField(fieldId, { options: [...field.options, `Option ${field.options.length + 1}`] });
  }

  function updateOption(fieldId: string, optIndex: number, value: string) {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    const opts = [...field.options];
    opts[optIndex] = value;
    updateField(fieldId, { options: opts });
  }

  function removeOption(fieldId: string, optIndex: number) {
    const field = fields.find(f => f.id === fieldId);
    if (!field || field.options.length <= 1) return;
    updateField(fieldId, { options: field.options.filter((_, i) => i !== optIndex) });
  }

  async function handleBannerUpload(file: File) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ext = file.name.split('.').pop();
    const path = `form-banners/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('documents').upload(path, file);
    if (error) { toast.error('Failed to upload banner'); return; }
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    setBannerUrl(data.publicUrl);
    toast.success('Banner uploaded');
  }

  async function handleSubmit() {
    if (!title.trim()) { toast.error('Form title is required'); return; }
    if (fields.length === 0) { toast.error('Add at least one question'); return; }
    if (formType === 'event_registration' && !selectedEventId) {
      toast.error('Select an active event for event registration form');
      return;
    }
    const emptyLabels = fields.filter(f => !f.label.trim());
    if (emptyLabels.length > 0) { toast.error('All questions must have labels'); return; }
    if (!hasNameAndEmailFields(fields)) {
      toast.error('Add Name (short answer) and Email questions to the form.');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Not authenticated'); setLoading(false); return; }

    const { data: form, error } = await supabase
      .from('forms')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        fields,
        created_by: user.id,
        is_active: status === 'active',
        settings: {
          banner_url: bannerUrl,
          allow_multiple: allowMultiple,
          require_login: requireLogin,
          start_date: startDate || null,
          end_date: endDate || null,
          access_type: accessType,
          status,
          ...(formType === 'event_registration' ? { show_attendance_qr_after_submit: showAttendanceQrAfterSubmit } : {}),
        },
        form_type: formType,
        event_id: formType === 'event_registration' ? selectedEventId : null,
      })
      .select()
      .single();

    if (error) { toast.error('Failed to create form: ' + error.message); setLoading(false); return; }

    const link = publicFormUrl(window.location.origin, form.id);
    navigator.clipboard.writeText(link);
    toast.success('Form created — share link copied to clipboard.');
    router.push(`/dashboard/forms/${form.id}`);
  }

  if (showPreview) {
    return (
      <div className="min-h-screen bg-mesh py-8 px-4 relative overflow-hidden">
        <div className="absolute top-20 right-20 w-80 h-80 bg-gradient-to-br from-indigo-400/8 to-purple-400/8 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setShowPreview(false)}
            className="mb-4 text-indigo-500 hover:text-indigo-700 font-semibold flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Editor
          </motion.button>
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="premium-panel rounded-t-3xl overflow-hidden mb-1 shadow-xl">
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            <div className="p-8">
              {bannerUrl && <img src={bannerUrl} alt="Banner" className="w-full h-40 object-cover rounded-xl mb-4" />}
              <h1 className="text-3xl font-extrabold text-gradient tracking-tight">{title || 'Untitled Form'}</h1>
              {description && <p className="text-gray-400 mt-2">{description}</p>}
            </div>
          </motion.div>
          {fields.map((field, i) => (
            <motion.div key={field.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass p-6 mb-1">
              <p className="text-lg font-semibold text-gray-800 mb-3">
                {field.label || `Question ${i + 1}`}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </p>
              {field.description && <p className="text-sm text-gray-400 mb-3">{field.description}</p>}
              {field.field_type === 'text' && <div className="border-b-2 border-gray-200 py-2 text-gray-300">Short answer text</div>}
              {field.field_type === 'textarea' && <div className="border-b-2 border-gray-200 py-2 text-gray-300 h-20">Long answer text</div>}
              {field.field_type === 'email' && <div className="border-b-2 border-gray-200 py-2 text-gray-300">email@example.com</div>}
              {field.field_type === 'number' && <div className="border-b-2 border-gray-200 py-2 text-gray-300">0</div>}
              {field.field_type === 'date' && <div className="border-b-2 border-gray-200 py-2 text-gray-300">DD/MM/YYYY</div>}
              {field.field_type === 'file' && <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center text-gray-300"><Upload className="w-8 h-8 mx-auto mb-2" />Click to upload</div>}
              {field.field_type === 'radio' && field.options.map((opt, j) => (
                <label key={j} className="flex items-center gap-3 py-2"><span className="w-5 h-5 rounded-full border-2 border-gray-400" /><span className="text-gray-700">{opt}</span></label>
              ))}
              {field.field_type === 'checkbox' && field.options.map((opt, j) => (
                <label key={j} className="flex items-center gap-3 py-2"><span className="w-5 h-5 rounded border-2 border-gray-400" /><span className="text-gray-700">{opt}</span></label>
              ))}
              {field.field_type === 'dropdown' && (
                <select className="w-full border-b-2 border-gray-200 py-2 text-gray-300 bg-transparent" disabled>
                  <option>Choose</option>
                  {field.options.map((opt, j) => <option key={j}>{opt}</option>)}
                </select>
              )}
            </motion.div>
          ))}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="premium-panel rounded-b-3xl p-6 mt-1">
            <button disabled className="btn-gradient-purple px-8 py-3 rounded-2xl font-semibold opacity-60 shadow-lg shadow-purple-500/10">Submit</button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh py-8 px-4 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-pink-400/8 to-violet-400/8 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Top Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-4">
            <Link href="/dashboard/forms" className="text-gray-400 hover:text-indigo-600 transition">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-2xl font-extrabold text-gradient tracking-tight">Create Form</h1>
          </div>
          <div className="flex items-center gap-3">
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => setShowPreview(true)} className="glass px-4 py-2 rounded-xl text-gray-700 hover:shadow-md transition flex items-center gap-2 text-sm font-medium">
              <Eye className="w-4 h-4" /> Preview
            </motion.button>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => setShowSettings(!showSettings)} className="glass px-4 py-2 rounded-xl text-gray-700 hover:shadow-md transition flex items-center gap-2 text-sm font-medium">
              <Settings className="w-4 h-4" /> Settings
            </motion.button>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={loading} className="btn-gradient-blue px-6 py-2 rounded-xl font-semibold disabled:opacity-50 shadow-lg shadow-blue-500/20">
              {loading ? 'Creating...' : 'Publish Form'}
            </motion.button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Question Types */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="premium-card rounded-2xl p-4 sticky top-8 shadow-md"
            >
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Question Types</h3>
              <div className="space-y-1">
                {FIELD_TYPES.map(ft => {
                  const Icon = ft.icon;
                  return (
                    <button key={ft.value} onClick={() => addField(ft.value)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:text-indigo-700 transition-all text-left group">
                      <Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      {ft.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* Right: Form Builder */}
          <div className="lg:col-span-3 space-y-4">
            {/* Settings Panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="premium-card rounded-2xl p-6 space-y-4 shadow-md mb-4">
                    <h3 className="text-lg font-extrabold text-gradient">Form Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80">
                          <option value="active">Active (publish immediately)</option>
                          <option value="draft">Draft (save for later)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Access</label>
                        <select value={accessType} onChange={e => setAccessType(e.target.value as any)} className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80">
                          <option value="internal">Portal users only</option>
                          <option value="public">Public (via link)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date / Deadline</label>
                        <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowMultiple} onChange={e => setAllowMultiple(e.target.checked)} className="rounded text-indigo-600" /> Allow multiple responses</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requireLogin} onChange={e => setRequireLogin(e.target.checked)} className="rounded text-indigo-600" /> Require login</label>
                      {formType === 'event_registration' && (
                        <label className="flex items-center gap-2 text-sm max-w-md">
                          <input type="checkbox" checked={showAttendanceQrAfterSubmit} onChange={e => setShowAttendanceQrAfterSubmit(e.target.checked)} className="rounded text-indigo-600" />
                          <span>Show personal check-in QR after registration (for attendance scanning at the event)</span>
                        </label>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="premium-panel rounded-2xl overflow-hidden shadow-md space-y-4"
            >
              <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              <div className="p-6 space-y-4">
                {bannerUrl ? (
                  <div className="relative">
                    <img src={bannerUrl} alt="Banner" className="w-full h-40 object-cover rounded-xl" />
                    <button onClick={() => setBannerUrl('')} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button onClick={() => bannerInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition flex items-center justify-center gap-2 text-sm">
                    <ImageIcon className="w-5 h-5" /> Add Banner Image (optional)
                  </button>
                )}
                <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleBannerUpload(e.target.files[0])} />
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Form Title *" className="w-full text-2xl font-bold bg-transparent border-b-2 border-gray-200 focus:border-indigo-500 outline-none py-2 placeholder-gray-300" />
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Form description (optional)" className="w-full text-gray-500 bg-transparent border-b border-gray-100 focus:border-indigo-400 outline-none py-1 placeholder-gray-300" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Form Type</label>
                    <select value={formType} onChange={e => setFormType(e.target.value as any)} className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80">
                      <option value="normal">Normal Form</option>
                      <option value="event_registration">Event Registration Form</option>
                    </select>
                  </div>
                  {formType === 'event_registration' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Active Event</label>
                      {eventsLoading ? (
                        <div className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-gray-500 text-sm">Loading active events...</div>
                      ) : activeEvents.length === 0 ? (
                        <div className="w-full border border-amber-200 rounded-xl px-3 py-2 bg-amber-50 text-amber-700 text-sm">No published events found (active, in progress, or faculty-approved). Approve the event in Proposals first.</div>
                      ) : (
                        <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80">
                          <option value="">Select an event</option>
                          {activeEvents.map((ev) => (
                            <option key={ev.id} value={ev.id}>
                              {ev.title} · {formatEventListDate(ev)} · {ev.location || 'Venue TBA'}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Questions */}
            {fields.map((field, index) => {
              const isActive = activeField === field.id;
              const TypeIcon = FIELD_TYPES.find(ft => ft.value === field.field_type)?.icon || Type;
              return (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  whileHover={{ y: -2 }}
                  onClick={() => setActiveField(field.id)}
                  className={`premium-card rounded-2xl p-6 transition-all cursor-pointer shadow-md ${isActive ? 'ring-2 ring-indigo-500 shadow-xl' : 'hover:shadow-lg'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-1 text-gray-300 cursor-grab"><GripVertical className="w-5 h-5" /></div>
                    <div className="flex-1 space-y-3">
                      {/* Question label */}
                      <div className="flex items-center gap-3">
                        <input type="text" value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} placeholder={`Question ${index + 1}`} className="flex-1 text-lg font-medium bg-transparent border-b-2 border-gray-200 focus:border-indigo-500 outline-none py-1 placeholder-gray-300" />
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium">
                          <TypeIcon className="w-3.5 h-3.5" />
                          {FIELD_TYPES.find(ft => ft.value === field.field_type)?.label}
                        </div>
                      </div>

                      {/* Description */}
                      {isActive && (
                        <input type="text" value={field.description} onChange={e => updateField(field.id, { description: e.target.value })} placeholder="Description / help text (optional)" className="w-full text-sm text-gray-500 bg-transparent border-b border-gray-100 focus:border-indigo-300 outline-none py-1 placeholder-gray-300" />
                      )}

                      {/* Options for choice fields */}
                      {['radio', 'checkbox', 'dropdown'].includes(field.field_type) && (
                        <div className="space-y-2 mt-2">
                          {field.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              {field.field_type === 'radio' && <span className="w-4 h-4 rounded-full border-2 border-gray-400 flex-shrink-0" />}
                              {field.field_type === 'checkbox' && <span className="w-4 h-4 rounded border-2 border-gray-400 flex-shrink-0" />}
                              {field.field_type === 'dropdown' && <span className="text-gray-400 text-sm w-5">{oi + 1}.</span>}
                              <input type="text" value={opt} onChange={e => updateOption(field.id, oi, e.target.value)} className="flex-1 bg-transparent border-b border-gray-200 focus:border-indigo-400 outline-none py-1 text-sm" />
                              {field.options.length > 1 && <button onClick={() => removeOption(field.id, oi)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>}
                            </div>
                          ))}
                          <button onClick={() => addOption(field.id)} className="text-indigo-600 text-sm hover:text-indigo-700 flex items-center gap-1 mt-1">
                            <Plus className="w-3.5 h-3.5" /> Add option
                          </button>
                        </div>
                      )}

                      {/* File upload settings */}
                      {field.field_type === 'file' && isActive && (
                        <div className="bg-gray-50 rounded-xl p-4 space-y-3 mt-2">
                          <p className="text-sm font-medium text-gray-700">File Upload Settings</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-500">Max file size (MB)</label>
                              <input type="number" value={field.validation.maxFileSize || 10} onChange={e => updateField(field.id, { validation: { ...field.validation, maxFileSize: parseInt(e.target.value) } })} className="w-full border rounded-lg px-2 py-1 text-sm" min={1} max={50} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Max files</label>
                              <input type="number" value={field.validation.maxFiles || 1} onChange={e => updateField(field.id, { validation: { ...field.validation, maxFiles: parseInt(e.target.value) } })} className="w-full border rounded-lg px-2 py-1 text-sm" min={1} max={10} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Validation for text/number */}
                      {isActive && ['text', 'textarea'].includes(field.field_type) && (
                        <div className="bg-gray-50 rounded-xl p-4 space-y-2 mt-2">
                          <p className="text-xs font-medium text-gray-500">Validation (optional)</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs text-gray-500">Min length</label><input type="number" value={field.validation.minLength || ''} onChange={e => updateField(field.id, { validation: { ...field.validation, minLength: parseInt(e.target.value) || undefined } })} className="w-full border rounded-lg px-2 py-1 text-sm" /></div>
                            <div><label className="text-xs text-gray-500">Max length</label><input type="number" value={field.validation.maxLength || ''} onChange={e => updateField(field.id, { validation: { ...field.validation, maxLength: parseInt(e.target.value) || undefined } })} className="w-full border rounded-lg px-2 py-1 text-sm" /></div>
                          </div>
                        </div>
                      )}
                      {isActive && field.field_type === 'number' && (
                        <div className="bg-gray-50 rounded-xl p-4 space-y-2 mt-2">
                          <p className="text-xs font-medium text-gray-500">Validation (optional)</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs text-gray-500">Min value</label><input type="number" value={field.validation.minValue ?? ''} onChange={e => updateField(field.id, { validation: { ...field.validation, minValue: parseInt(e.target.value) || undefined } })} className="w-full border rounded-lg px-2 py-1 text-sm" /></div>
                            <div><label className="text-xs text-gray-500">Max value</label><input type="number" value={field.validation.maxValue ?? ''} onChange={e => updateField(field.id, { validation: { ...field.validation, maxValue: parseInt(e.target.value) || undefined } })} className="w-full border rounded-lg px-2 py-1 text-sm" /></div>
                          </div>
                        </div>
                      )}

                      {/* Bottom toolbar */}
                      {isActive && (
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                          <div className="flex items-center gap-2">
                            <select value={field.field_type} onChange={e => updateField(field.id, { field_type: e.target.value, options: ['radio', 'checkbox', 'dropdown'].includes(e.target.value) && field.options.length === 0 ? ['Option 1'] : field.options })} className="text-sm border rounded-lg px-2 py-1 bg-white/80">
                              {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                            </select>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => duplicateField(index)} className="text-gray-400 hover:text-indigo-600" title="Duplicate"><Copy className="w-4 h-4" /></button>
                            <button onClick={() => removeField(index)} className="text-gray-400 hover:text-red-500" title="Delete"><X className="w-4 h-4" /></button>
                            <button onClick={() => moveField(index, 'up')} disabled={index === 0} className="text-gray-400 hover:text-indigo-600 disabled:opacity-30" title="Move up"><ChevronUp className="w-4 h-4" /></button>
                            <button onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1} className="text-gray-400 hover:text-indigo-600 disabled:opacity-30" title="Move down"><ChevronDown className="w-4 h-4" /></button>
                            <div className="border-l border-gray-200 pl-3 flex items-center gap-2">
                              <label className="flex items-center gap-1.5 text-sm text-gray-600">
                                <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} className="rounded text-indigo-600" />
                                Required
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Add question button */}
            {fields.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="premium-card rounded-2xl p-12 text-center shadow-md"
              >
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                  <Plus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                </motion.div>
                <p className="text-gray-400 mb-4">No questions yet. Add your first question from the panel on the left.</p>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={() => addField('text')} className="btn-gradient-blue px-6 py-2 rounded-2xl font-semibold shadow-lg shadow-blue-500/20">
                  <Plus className="w-4 h-4 inline mr-2" /> Add Question
                </motion.button>
              </motion.div>
            ) : (
              <motion.button whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => addField('text')} className="w-full premium-card rounded-2xl p-4 text-indigo-500 hover:shadow-lg transition flex items-center justify-center gap-2 font-semibold shadow-md">
                <Plus className="w-5 h-5" /> Add Question
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}