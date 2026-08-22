'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Plus, X, GripVertical, Copy, Eye, Settings, ChevronDown, ChevronUp, Upload, Type, AlignLeft, List, CheckSquare, ChevronRight, Calendar, Hash, Mail, FileUp, Image as ImageIcon, Save, Phone } from 'lucide-react';
import { defaultOptionsForFieldType, defaultValidationForFieldType, isOptionFieldType, EXACT_TWO_HINT, clampRollCount, ROLL_NO_MAX_COUNT, ROLL_NO_MIN_COUNT, rollCountFromValidation, excludedRollsFromValidation } from '@/lib/form-field-types';
import RollExcludeChecklist from '@/components/forms/RollExcludeChecklist';
import ResponseViewerPicker from '@/components/forms/ResponseViewerPicker';
import { canManageForm, getResponseViewerIds, isResponseViewersAll } from '@/lib/form-access';
import { EVENT_REGISTRATION_ELIGIBLE_STATUSES } from '@/lib/event-registration';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
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
        maxFileSize?: number;
        maxFiles?: number;
        allowedFileTypes?: string[];
        excludedRolls?: string[];
    };
    order_index: number;
}

const FIELD_TYPES = [
    { value: 'text', label: 'Short Answer', icon: Type },
    { value: 'textarea', label: 'Paragraph', icon: AlignLeft },
  { value: 'radio', label: 'Multiple Choice', icon: List },
  { value: 'checkbox', label: 'Checkboxes', icon: CheckSquare },
  { value: 'checkbox_exact_2', label: 'Select Exactly 2', icon: CheckSquare },
  { value: 'dropdown', label: 'Dropdown', icon: ChevronRight },
    { value: 'file', label: 'File Upload', icon: FileUp },
    { value: 'date', label: 'Date', icon: Calendar },
    { value: 'number', label: 'Number', icon: Hash },
    { value: 'roll_no', label: 'Roll No (searchable)', icon: Hash },
    { value: 'mobile', label: 'Mobile Number', icon: Phone },
    { value: 'email', label: 'Email', icon: Mail },
];

function generateId() {
    return 'f_' + Math.random().toString(36).substring(2, 9);
}

function formatEventListDate(ev: { event_date?: string | null; date?: string | null }) {
    const raw = ev.event_date || ev.date;
    if (!raw) return 'Date TBA';
    try {
        return new Date(raw).toLocaleDateString('en-IN');
    } catch {
        return 'Date TBA';
    }
}

export default function EditFormPage() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [bannerUrl, setBannerUrl] = useState('');
    const [fields, setFields] = useState<FormField[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeField, setActiveField] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [status, setStatus] = useState<'active' | 'draft'>('active');
    const [allowMultiple, setAllowMultiple] = useState(false);
    const [requireLogin, setRequireLogin] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [accessType, setAccessType] = useState<'public' | 'internal'>('internal');
    const [responseViewerIds, setResponseViewerIds] = useState<string[]>([]);
    const [responseViewersAll, setResponseViewersAll] = useState(false);
    const [formType, setFormType] = useState<'normal' | 'event_registration'>('normal');
    const [initialFormType, setInitialFormType] = useState<'normal' | 'event_registration'>('normal');
    const [selectedEventId, setSelectedEventId] = useState('');
    const [activeEvents, setActiveEvents] = useState<any[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [responseCount, setResponseCount] = useState(0);
    const [convertExistingResponses, setConvertExistingResponses] = useState(true);
    /** Normal forms only: optional QR. Event registration always shows QR. */
    const [showAttendanceQrAfterSubmit, setShowAttendanceQrAfterSubmit] = useState(false);
    const [baseSettings, setBaseSettings] = useState<Record<string, unknown>>({});
    const [canEdit, setCanEdit] = useState(false);
    const prevFormTypeRef = useRef<string | null>(null);

    const params = useParams();
    const formId = String(params.id);
    const router = useRouter();
    const supabase = createClient();
    const bannerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { loadForm(); }, []);

    useEffect(() => {
        if (formType !== 'event_registration') return;
        void loadActiveEvents();
    }, [formType]);

    useEffect(() => {
        const prev = prevFormTypeRef.current;
        if (formType === 'event_registration' && prev !== 'event_registration') {
            setRequireLogin(false);
            setAccessType('public');
            setShowAttendanceQrAfterSubmit(true);
        }
        prevFormTypeRef.current = formType;
    }, [formType]);

    async function loadForm() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error('You must be logged in to edit forms');
            router.push('/login');
            return;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin, is_faculty, executive_role')
            .eq('id', user.id)
            .maybeSingle();

        const { data: form, error } = await supabase.from('forms').select('*').eq('id', formId).single();
        if (error || !form) { toast.error('Form not found'); router.push('/dashboard/forms'); return; }

        const allowed = canManageForm(form, user.id, profile);
        setCanEdit(allowed);
        if (!allowed) {
            toast.error('You must be logged in to edit forms');
            setLoading(false);
            return;
        }

        setTitle(form.title || '');
        setDescription(form.description || '');
        setFields(form.fields || []);
        const s = form.settings || {};
        setBaseSettings(s);
        setBannerUrl(s.banner_url || '');
        setStatus(form.is_active ? 'active' : 'draft');
        setAllowMultiple(s.allow_multiple || false);
        setRequireLogin(s.require_login ?? false);
        setStartDate(s.start_date || '');
        setEndDate(s.end_date || '');
        setAccessType((s.access_type || s.accessType || 'public') as 'public' | 'internal');
        setResponseViewerIds(getResponseViewerIds(s));
        setResponseViewersAll(isResponseViewersAll(s));
        const loadedType = (form.form_type as 'normal' | 'event_registration') || 'normal';
        setFormType(loadedType);
        setInitialFormType(loadedType);
        setSelectedEventId(form.event_id || '');
        setShowAttendanceQrAfterSubmit(
          loadedType === 'event_registration'
            ? true
            : s.show_attendance_qr_after_submit === true || s.showAttendanceQrAfterSubmit === true,
        );

        const { count } = await supabase
            .from('form_responses')
            .select('id', { count: 'exact', head: true })
            .eq('form_id', formId);
        setResponseCount(count || 0);
        if (loadedType === 'event_registration') {
            await loadActiveEvents(form.event_id || '');
        }
        setLoading(false);
    }

    async function loadActiveEvents(linkedEventId = selectedEventId) {
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
            setEventsLoading(false);
            return;
        }

        const list = rows || [];
        if (linkedEventId && !list.some((ev) => ev.id === linkedEventId)) {
            const { data: linked } = await supabase
                .from('events')
                .select('id, title, location, event_date, date, status, created_at')
                .eq('id', linkedEventId)
                .maybeSingle();
            if (linked) {
                list.unshift(linked);
            }
        }
        setActiveEvents(list);
        setEventsLoading(false);
    }

    function addField(type: string) {
        const newField: FormField = {
            id: generateId(), field_type: type, label: '', description: '',
            options: defaultOptionsForFieldType(type),
            required: false,
            validation: defaultValidationForFieldType(type),
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
        const opts = [...field.options]; opts[optIndex] = value;
        updateField(fieldId, { options: opts });
    }

    function removeOption(fieldId: string, optIndex: number) {
        const field = fields.find(f => f.id === fieldId);
        if (!field) return;
        const minOpts = field.field_type === 'checkbox_exact_2' ? 2 : 1;
        if (field.options.length <= minOpts) {
            if (field.field_type === 'checkbox_exact_2') toast.error('Exactly-2 questions need at least 2 options');
            return;
        }
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

    async function duplicateThisForm() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { toast.error('Not authenticated'); return; }
        const { data: created, error } = await supabase
            .from('forms')
            .insert({
                title: `${title.trim() || 'Untitled Form'} (copy)`,
                description: description.trim() || null,
                fields,
                created_by: user.id,
                is_active: false,
                settings: {
                    ...baseSettings,
                    banner_url: bannerUrl,
                    allow_multiple: allowMultiple,
                    require_login: requireLogin,
                    start_date: startDate || null,
                    end_date: endDate || null,
                    access_type: accessType,
                    status: 'draft',
                    response_viewer_ids: responseViewersAll ? [] : responseViewerIds,
                    response_viewers_all: responseViewersAll,
                    show_attendance_qr_after_submit:
                        formType === 'event_registration' ? true : showAttendanceQrAfterSubmit,
                },
                form_type: formType,
                event_id: formType === 'event_registration' ? selectedEventId : null,
            })
            .select('id')
            .single();
        if (error || !created) {
            toast.error(error?.message || 'Failed to duplicate');
            return;
        }
        toast.success('Duplicated as draft');
        router.push(`/dashboard/forms/${created.id}/edit`);
    }

    async function handleSave() {
        if (!canEdit) {
            toast.error('You must be logged in to edit forms');
            return;
        }
        if (!title.trim()) { toast.error('Form title is required'); return; }
        if (fields.length === 0) { toast.error('Add at least one question'); return; }
        const emptyLabels = fields.filter(f => !f.label.trim());
        if (emptyLabels.length > 0) { toast.error('All questions must have labels'); return; }
        const badExactTwo = fields.find(f => f.field_type === 'checkbox_exact_2' && f.options.filter(o => o.trim()).length < 2);
        if (badExactTwo) { toast.error('"Select Exactly 2" questions need at least 2 options'); return; }
        const badRoll = fields.find(f => f.field_type === 'roll_no' && !rollCountFromValidation(f.validation));
        if (badRoll) { toast.error('Set how many roll numbers (1–99) for Roll No questions'); return; }
        if (formType === 'event_registration' && !selectedEventId) {
            toast.error('Select an event for event registration form');
            return;
        }

        const isConvertingToEvent =
            initialFormType === 'normal' && formType === 'event_registration';
        const willBackfill = isConvertingToEvent && convertExistingResponses && responseCount > 0;

        if (willBackfill) {
            const ok = confirm(
                `Convert this form to event registration and add ${responseCount} existing response(s) as event participants?`,
            );
            if (!ok) return;
        } else if (isConvertingToEvent && responseCount > 0 && !convertExistingResponses) {
            const ok = confirm(
                'Save as event registration without converting existing responses to participants?',
            );
            if (!ok) return;
        }

        setSaving(true);
        const trimmedDescription = description.trim();
        const nextSettings = {
            ...baseSettings,
            banner_url: bannerUrl,
            allow_multiple: allowMultiple,
            require_login: requireLogin,
            start_date: startDate || null,
            end_date: endDate || null,
            access_type: accessType,
            status,
            response_viewer_ids: responseViewersAll ? [] : responseViewerIds,
            response_viewers_all: responseViewersAll,
            show_attendance_qr_after_submit:
              formType === 'event_registration' ? true : showAttendanceQrAfterSubmit,
        };

        const { data: updated, error } = await supabase
            .from('forms')
            .update({
                title: title.trim(),
                description: trimmedDescription || null,
                fields,
                is_active: status === 'active',
                settings: nextSettings,
                form_type: formType,
                event_id: formType === 'event_registration' ? selectedEventId : null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', formId)
            .select('id, description')
            .maybeSingle();

        if (error) {
            toast.error('Failed to save: ' + error.message);
        } else if (!updated) {
            toast.error('Failed to save — form could not be updated.');
        } else {
            setBaseSettings(nextSettings);
            setInitialFormType(formType);

            if (willBackfill) {
                const { data: backfill, error: backfillError } = await supabase.rpc(
                    'backfill_event_participants_from_form',
                    { p_form_id: formId },
                );
                if (backfillError) {
                    toast.error('Form saved, but participant conversion failed: ' + backfillError.message);
                } else {
                    const result = backfill as { inserted?: number; skipped?: number };
                    const inserted = result.inserted ?? 0;
                    const skipped = result.skipped ?? 0;
                    toast.success(
                        `Form saved — ${inserted} participant(s) created${skipped ? `, ${skipped} skipped` : ''}`,
                    );
                }
            } else {
                toast.success('Form saved');
            }
            router.push('/dashboard/forms');
        }
        setSaving(false);
    }

    if (loading) return <PortalLoadingScreen message="Loading forms…" variant="resources" />;

    if (!canEdit) {
        return (
            <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="premium-panel rounded-3xl p-12 text-center max-w-md shadow-2xl">
                    <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Cannot Edit Form</h2>
                    <p className="text-gray-400 mb-8">Please log in to edit forms.</p>
                    <Link href="/dashboard/forms" className="btn-gradient-blue px-6 py-2.5 rounded-2xl text-sm font-semibold">
                        Back to Forms
                    </Link>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-mesh py-8 px-4 relative overflow-hidden">
            <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-pink-400/8 to-violet-400/8 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-5xl mx-auto relative z-10">
                {/* Top Bar */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <Link href="/dashboard/forms" className="text-gray-400 hover:text-indigo-600 transition shrink-0">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <h1 className="text-xl sm:text-2xl font-extrabold text-gradient tracking-tight truncate">Edit Form</h1>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <Link
                          href={`/forms/${formId}`}
                          className="glass px-3 sm:px-4 py-2 rounded-xl text-gray-700 hover:shadow-md transition flex items-center gap-2 text-sm font-medium"
                        >
                            <Eye className="w-4 h-4" /> Preview
                        </Link>
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={duplicateThisForm}
                          className="glass px-3 sm:px-4 py-2 rounded-xl text-gray-700 hover:shadow-md transition flex items-center gap-2 text-sm font-medium"
                        >
                            <Copy className="w-4 h-4" /> Duplicate
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => setShowSettings(!showSettings)} className="glass px-3 sm:px-4 py-2 rounded-xl text-gray-700 hover:shadow-md transition flex items-center gap-2 text-sm font-medium">
                            <Settings className="w-4 h-4" /> Settings
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving} className="btn-gradient-green px-4 sm:px-6 py-2 rounded-xl font-semibold disabled:opacity-50 shadow-lg shadow-emerald-500/20 flex items-center gap-2 text-sm">
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
                        </motion.button>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Left: Question Types */}
                    <div className="lg:col-span-1">
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="premium-card rounded-2xl p-4 sticky top-8 shadow-md">
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
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                                    <div className="premium-card rounded-2xl p-6 space-y-4 shadow-md mb-4">
                                        <h3 className="text-lg font-extrabold text-gradient">Form Settings</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                                <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80">
                                                    <option value="active">Active</option>
                                                    <option value="draft">Draft (stop collecting)</option>
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
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowMultiple} onChange={e => setAllowMultiple(e.target.checked)} className="rounded text-indigo-600" /> Allow multiple responses <span className="text-gray-400 text-xs">(same email/mobile can submit again)</span></label>
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requireLogin} onChange={e => setRequireLogin(e.target.checked)} className="rounded text-indigo-600" /> Require login</label>
                                            {formType === 'normal' && (
                                                <label className="flex items-center gap-2 text-sm max-w-md">
                                                    <input type="checkbox" checked={showAttendanceQrAfterSubmit} onChange={e => setShowAttendanceQrAfterSubmit(e.target.checked)} className="rounded text-indigo-600" />
                                                    <span>Show personal QR after submit <span className="text-gray-400 text-xs">(optional)</span></span>
                                                </label>
                                            )}
                                            {formType === 'event_registration' && (
                                                <p className="text-sm text-emerald-700 font-medium">Personal check-in QR is always shown after event registration.</p>
                                            )}
                                        </div>
                                        <div className="pt-2 border-t border-gray-100">
                                            <ResponseViewerPicker
                                              allowAll={responseViewersAll}
                                              selectedIds={responseViewerIds}
                                              onChange={({ allowAll, ids }) => {
                                                setResponseViewersAll(allowAll);
                                                setResponseViewerIds(ids);
                                              }}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Form Header Card */}
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="premium-panel rounded-2xl overflow-hidden shadow-md space-y-4">
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
                                        <select
                                            value={formType}
                                            onChange={e => setFormType(e.target.value as 'normal' | 'event_registration')}
                                            disabled={initialFormType === 'event_registration'}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 disabled:bg-gray-50 disabled:text-gray-500"
                                        >
                                            <option value="normal">Normal Form</option>
                                            <option value="event_registration">Event Registration Form</option>
                                        </select>
                                        {initialFormType === 'event_registration' && (
                                            <p className="text-xs text-gray-500 mt-1">Event registration type cannot be changed back to normal.</p>
                                        )}
                                    </div>
                                    {formType === 'event_registration' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
                                            {eventsLoading ? (
                                                <div className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-gray-500 text-sm">Loading events...</div>
                                            ) : activeEvents.length === 0 ? (
                                                <div className="w-full border border-amber-200 rounded-xl px-3 py-2 bg-amber-50 text-amber-700 text-sm">No eligible events found. Approve the event in Proposals first.</div>
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
                                {initialFormType === 'normal' && formType === 'event_registration' && responseCount > 0 && (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 space-y-2">
                                        <p className="text-sm font-medium text-amber-900">
                                            {responseCount} existing response{responseCount !== 1 ? 's' : ''} can be added as event participants.
                                        </p>
                                        <label className="flex items-center gap-2 text-sm text-amber-900">
                                            <input
                                                type="checkbox"
                                                checked={convertExistingResponses}
                                                onChange={e => setConvertExistingResponses(e.target.checked)}
                                                className="rounded text-amber-600"
                                            />
                                            Convert existing responses to event participants on save
                                        </label>
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        {/* Questions */}
                        {fields.map((field, index) => {
                            const isActive = activeField === field.id;
                            const TypeIcon = FIELD_TYPES.find(ft => ft.value === field.field_type)?.icon || Type;
                            return (
                                <motion.div key={field.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: index * 0.04 }} whileHover={{ y: -2 }} onClick={() => setActiveField(field.id)} className={`premium-card rounded-2xl p-6 transition-all cursor-pointer shadow-md ${isActive ? 'ring-2 ring-indigo-500 shadow-xl' : 'hover:shadow-lg'}`}>
                                    <div className="flex items-start gap-3">
                                        <div className="pt-1 text-gray-300 cursor-grab"><GripVertical className="w-5 h-5" /></div>
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <input type="text" value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} placeholder={`Question ${index + 1}`} className="flex-1 text-lg font-medium bg-transparent border-b-2 border-gray-200 focus:border-indigo-500 outline-none py-1 placeholder-gray-300" />
                                                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium">
                                                    <TypeIcon className="w-3.5 h-3.5" />
                                                    {FIELD_TYPES.find(ft => ft.value === field.field_type)?.label}
                                                </div>
                                            </div>

                                            {isActive && (
                                                <input type="text" value={field.description} onChange={e => updateField(field.id, { description: e.target.value })} placeholder="Description / help text (optional)" className="w-full text-sm text-gray-500 bg-transparent border-b border-gray-100 focus:border-indigo-300 outline-none py-1 placeholder-gray-300" />
                                            )}

                                            {isOptionFieldType(field.field_type) && (
                                                <div className="space-y-2 mt-2">
                                                    {field.field_type === 'checkbox_exact_2' && (
                                                        <p className="text-xs text-indigo-600 font-medium">{EXACT_TWO_HINT} · add at least 2 options</p>
                                                    )}
                                                    {field.options.map((opt, oi) => (
                                                        <div key={oi} className="flex items-center gap-2">
                                                            {field.field_type === 'radio' && <span className="w-4 h-4 rounded-full border-2 border-gray-400 flex-shrink-0" />}
                                                            {(field.field_type === 'checkbox' || field.field_type === 'checkbox_exact_2') && <span className="w-4 h-4 rounded border-2 border-gray-400 flex-shrink-0" />}
                                                            {field.field_type === 'dropdown' && <span className="text-gray-400 text-sm w-5">{oi + 1}.</span>}
                                                            <input type="text" value={opt} onChange={e => updateOption(field.id, oi, e.target.value)} className="flex-1 bg-transparent border-b border-gray-200 focus:border-indigo-400 outline-none py-1 text-sm" />
                                                            {field.options.length > (field.field_type === 'checkbox_exact_2' ? 2 : 1) && <button onClick={() => removeOption(field.id, oi)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>}
                                                        </div>
                                                    ))}
                                                    <button onClick={() => addOption(field.id)} className="text-indigo-600 text-sm hover:text-indigo-700 flex items-center gap-1 mt-1">
                                                        <Plus className="w-3.5 h-3.5" /> Add option
                                                    </button>
                                                </div>
                                            )}

                                            {field.field_type === 'roll_no' && isActive && (
                                                <div className="bg-gray-50 rounded-xl p-4 space-y-3 mt-2">
                                                    <p className="text-xs font-medium text-gray-500">Roll numbers</p>
                                                    <label className="text-xs text-gray-500">How many rolls? (generates 1 … N)</label>
                                                    <input
                                                        type="number"
                                                        min={ROLL_NO_MIN_COUNT}
                                                        max={ROLL_NO_MAX_COUNT}
                                                        value={rollCountFromValidation(field.validation)}
                                                        onChange={e => {
                                                            const n = clampRollCount(parseInt(e.target.value, 10) || ROLL_NO_MIN_COUNT);
                                                            const pruned = excludedRollsFromValidation(field.validation).filter((r) => Number(r) <= n);
                                                            updateField(field.id, { validation: { ...field.validation, minValue: 1, maxValue: n, excludedRolls: pruned } });
                                                        }}
                                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                                    />
                                                    <RollExcludeChecklist
                                                        count={rollCountFromValidation(field.validation)}
                                                        validation={field.validation}
                                                        onChangeExcluded={(excludedRolls) =>
                                                            updateField(field.id, { validation: { ...field.validation, excludedRolls } })
                                                        }
                                                    />
                                                    <p className="text-xs text-gray-400">
                                                        Dropdown shows {rollCountFromValidation(field.validation) - excludedRollsFromValidation(field.validation).length} available rolls (searchable).
                                                    </p>
                                                </div>
                                            )}

                                            {field.field_type === 'file' && isActive && (
                                                <div className="bg-gray-50 rounded-xl p-4 space-y-3 mt-2">
                                                    <p className="text-sm font-medium text-gray-700">File Upload Settings</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><label className="text-xs text-gray-500">Max file size (MB)</label><input type="number" value={field.validation.maxFileSize || 10} onChange={e => updateField(field.id, { validation: { ...field.validation, maxFileSize: parseInt(e.target.value) } })} className="w-full border rounded-lg px-2 py-1 text-sm" min={1} max={50} /></div>
                                                        <div><label className="text-xs text-gray-500">Max files</label><input type="number" value={field.validation.maxFiles || 1} onChange={e => updateField(field.id, { validation: { ...field.validation, maxFiles: parseInt(e.target.value) } })} className="w-full border rounded-lg px-2 py-1 text-sm" min={1} max={10} /></div>
                                                    </div>
                                                </div>
                                            )}

                                            {isActive && (
                                                <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                                                    <select value={field.field_type} onChange={e => {
                                                        const nextType = e.target.value;
                                                        let nextOptions = field.options;
                                                        if (isOptionFieldType(nextType)) {
                                                            if (nextOptions.length === 0 || (nextType === 'checkbox_exact_2' && nextOptions.length < 2)) {
                                                                nextOptions = defaultOptionsForFieldType(nextType);
                                                            }
                                                        }
                                                        const nextValidation = nextType === 'roll_no' && !field.validation?.maxValue
                                                            ? { ...field.validation, ...defaultValidationForFieldType('roll_no') }
                                                            : field.validation;
                                                        updateField(field.id, { field_type: nextType, options: nextOptions, validation: nextValidation });
                                                    }} className="text-sm border rounded-lg px-2 py-1 bg-white/80">
                                                        {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                                                    </select>
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={() => duplicateField(index)} className="text-gray-400 hover:text-indigo-600" title="Duplicate"><Copy className="w-4 h-4" /></button>
                                                        <button onClick={() => removeField(index)} className="text-gray-400 hover:text-red-500" title="Delete"><X className="w-4 h-4" /></button>
                                                        <button onClick={() => moveField(index, 'up')} disabled={index === 0} className="text-gray-400 hover:text-indigo-600 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                                                        <button onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1} className="text-gray-400 hover:text-indigo-600 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                                                        <div className="border-l border-gray-200 pl-3">
                                                            <label className="flex items-center gap-1.5 text-sm text-gray-600">
                                                                <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} className="rounded text-indigo-600" /> Required
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

                        {/* Add question */}
                        {fields.length === 0 ? (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="premium-card rounded-2xl p-12 text-center shadow-md">
                                <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                                    <Plus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                </motion.div>
                                <p className="text-gray-400 mb-4">No questions yet. Add from the panel on the left.</p>
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
