'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Plus, X, GripVertical, Copy, Eye, Settings, ChevronDown, ChevronUp, Upload, Type, AlignLeft, List, CheckSquare, ChevronRight, Calendar, Hash, Mail, FileUp, Image as ImageIcon, Save, Phone } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  hasNameAndEmailFields,
} from '@/lib/form-responder-fields';
import { canManageForm } from '@/lib/form-access';

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
    { value: 'mobile', label: 'Mobile Number', icon: Phone },
    { value: 'email', label: 'Email', icon: Mail },
];

function generateId() {
    return 'f_' + Math.random().toString(36).substring(2, 9);
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
    const [formType, setFormType] = useState<'normal' | 'event_registration'>('normal');
    const [showAttendanceQrAfterSubmit, setShowAttendanceQrAfterSubmit] = useState(true);
    const [baseSettings, setBaseSettings] = useState<Record<string, unknown>>({});
    const [canEdit, setCanEdit] = useState(false);

    const params = useParams();
    const formId = String(params.id);
    const router = useRouter();
    const supabase = createClient();
    const bannerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { loadForm(); }, []);

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
            toast.error('Only the form creator can edit this form');
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
        setFormType((form.form_type as 'normal' | 'event_registration') || 'normal');
        const qrOn = s.show_attendance_qr_after_submit !== false && s.showAttendanceQrAfterSubmit !== false;
        setShowAttendanceQrAfterSubmit(form.form_type === 'event_registration' ? qrOn : true);
        setLoading(false);
    }

    function addField(type: string) {
        const newField: FormField = {
            id: generateId(), field_type: type, label: '', description: '',
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
        const opts = [...field.options]; opts[optIndex] = value;
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

    async function handleSave() {
        if (!canEdit) {
            toast.error('Only the form creator can edit this form');
            return;
        }
        if (!title.trim()) { toast.error('Form title is required'); return; }
        if (fields.length === 0) { toast.error('Add at least one question'); return; }
        const emptyLabels = fields.filter(f => !f.label.trim());
        if (emptyLabels.length > 0) { toast.error('All questions must have labels'); return; }
        if (!hasNameAndEmailFields(fields)) {
            toast.error('Add Name (short answer) and Email questions to the form.');
            return;
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
            ...(formType === 'event_registration' ? { show_attendance_qr_after_submit: showAttendanceQrAfterSubmit } : {}),
        };

        const { data: updated, error } = await supabase
            .from('forms')
            .update({
                title: title.trim(),
                description: trimmedDescription || null,
                fields,
                is_active: status === 'active',
                settings: nextSettings,
            })
            .eq('id', formId)
            .select('id, description')
            .maybeSingle();

        if (error) {
            toast.error('Failed to save: ' + error.message);
        } else if (!updated) {
            toast.error('Failed to save — you may not have permission to edit this form.');
        } else {
            setBaseSettings(nextSettings);
            toast.success('Form saved');
            router.push('/dashboard/forms');
        }
        setSaving(false);
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-mesh flex items-center justify-center">
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 mx-auto mb-4 animate-pulse-glow" />
                    <p className="text-gray-400">Loading form...</p>
                </motion.div>
            </div>
        );
    }

    if (!canEdit) {
        return (
            <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="premium-panel rounded-3xl p-12 text-center max-w-md shadow-2xl">
                    <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Cannot Edit Form</h2>
                    <p className="text-gray-400 mb-8">Only the person who created this form can edit it.</p>
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
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/forms" className="text-gray-400 hover:text-indigo-600 transition">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <h1 className="text-2xl font-extrabold text-gradient tracking-tight">Edit Form</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => setShowSettings(!showSettings)} className="glass px-4 py-2 rounded-xl text-gray-700 hover:shadow-md transition flex items-center gap-2 text-sm font-medium">
                            <Settings className="w-4 h-4" /> Settings
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving} className="btn-gradient-green px-6 py-2 rounded-xl font-semibold disabled:opacity-50 shadow-lg shadow-emerald-500/20 flex items-center gap-2">
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
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowMultiple} onChange={e => setAllowMultiple(e.target.checked)} className="rounded text-indigo-600" /> Allow multiple responses</label>
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requireLogin} onChange={e => setRequireLogin(e.target.checked)} className="rounded text-indigo-600" /> Require login</label>
                                            {formType === 'event_registration' && (
                                                <label className="flex items-center gap-2 text-sm max-w-md">
                                                    <input type="checkbox" checked={showAttendanceQrAfterSubmit} onChange={e => setShowAttendanceQrAfterSubmit(e.target.checked)} className="rounded text-indigo-600" />
                                                    <span>Show personal check-in QR after registration (for attendance scanning)</span>
                                                </label>
                                            )}
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
                                                    <select value={field.field_type} onChange={e => updateField(field.id, { field_type: e.target.value, options: ['radio', 'checkbox', 'dropdown'].includes(e.target.value) && field.options.length === 0 ? ['Option 1'] : field.options })} className="text-sm border rounded-lg px-2 py-1 bg-white/80">
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
