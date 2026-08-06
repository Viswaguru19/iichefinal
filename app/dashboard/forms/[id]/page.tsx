'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Share2, Check, Lock, AlertTriangle, Upload } from 'lucide-react';
import { EXACT_TWO_HINT, isValidRollNo, rollCountFromValidation, excludedRollsFromValidation } from '@/lib/form-field-types';
import SearchableRollSelect from '@/components/forms/SearchableRollSelect';
import { canViewFormResponses, shouldShowPersonalQrAfterSubmit, isFormCollecting, isFormTestMode } from '@/lib/form-access';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { isEventOpenForRegistration } from '@/lib/event-registration';
import { publicFormUrl } from '@/lib/form-public-access';
import { withTimeout } from '@/lib/with-timeout';
import {
  extractResponderEmail,
  extractResponderName,
  pickEmailField,
  pickNameField,
} from '@/lib/form-responder-fields';

async function qrDataUrl(payload: unknown, width = 260): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(JSON.stringify(payload), { width, margin: 1 });
}

interface FormField {
  id: string;
  field_type: string;
  label: string;
  description?: string;
  options?: string[];
  required: boolean;
  validation?: {
    email?: boolean;
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    maxFileSize?: number;
    maxFiles?: number;
    allowedFileTypes?: string[];
  };
}

const fieldAnim = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: i * 0.05, ease: 'easeOut' as const },
  }),
};

export default function FormSubmitPage() {
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formClosed, setFormClosed] = useState(false);
  const [closedReason, setClosedReason] = useState('');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [canViewResponses, setCanViewResponses] = useState(false);
  const [participantQrImage, setParticipantQrImage] = useState<string | null>(null);
  const [participantQrPayload, setParticipantQrPayload] = useState<any>(null);
  const [eventDetails, setEventDetails] = useState<any>(null);
  /** Roll nos already used per field id — hidden from searchable dropdown. */
  const [takenRollsByFieldId, setTakenRollsByFieldId] = useState<Record<string, string[]>>({});
  /** Set after successful event registration submit (venue QR uses source=onsite). */
  const [submittedWasOnSite, setSubmittedWasOnSite] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [submittedWasTest, setSubmittedWasTest] = useState(false);
  const params = useParams();
  const pathname = usePathname();
  const isPublicFormRoute = pathname?.startsWith('/forms/');
  const formId = Array.isArray(params.id) ? params.id[0] : String(params.id || '');
  const supabase = createClient();

  useEffect(() => {
    if (!formId) {
      setLoading(false);
      setFormClosed(true);
      setClosedReason('Invalid form link.');
      return;
    }
    void fetchForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per form id
  }, [formId]);

  async function refreshTakenRolls(formFields: FormField[], asTest = isTestMode) {
    const rollFields = formFields.filter((f) => f.field_type === 'roll_no' && f.label?.trim());
    if (rollFields.length === 0) {
      setTakenRollsByFieldId({});
      return;
    }
    const next: Record<string, string[]> = {};
    await Promise.all(
      rollFields.map(async (f) => {
        const result = await withTimeout(
          Promise.resolve(
            supabase.rpc('form_taken_roll_numbers', {
              p_form_id: formId,
              p_field_label: f.label.trim(),
              p_is_test: asTest,
            }),
          ),
          3500,
        );
        if (!result || result.error) {
          if (result?.error) console.error('form_taken_roll_numbers', result.error);
          next[f.id] = [];
          return;
        }
        next[f.id] = Array.isArray(result.data) ? result.data.map(String) : [];
      }),
    );
    setTakenRollsByFieldId(next);
  }

  async function fetchForm() {
    setSubmittedWasOnSite(false);
    setLoading(true);

    try {
      // Critical path ONLY: form definition (never wait on Auth)
      const formResult = await withTimeout(
        Promise.resolve(
          supabase
            .from('forms')
            .select('id, title, description, fields, settings, is_active, form_type, event_id, created_by')
            .eq('id', formId)
            .single(),
        ),
        8000,
      );

      if (!formResult || formResult.error || !formResult.data) {
        console.error('fetchForm', formResult?.error);
        toast.error(
          formResult?.error?.code === 'PGRST116'
            ? 'Form not found'
            : formResult?.error?.message || 'Form not found or timed out',
        );
        setForm(null);
        setFormClosed(true);
        setClosedReason('Form not found. Check the link, or apply migration 120 if this is a draft.');
        setLoading(false);
        return;
      }

      const formData = formResult.data;
      const settings = formData.settings || {};
      const formFields = (formData.fields || []) as FormField[];
      const collecting = isFormCollecting(formData);
      const testMode = isFormTestMode(formData);

      let closed = false;
      let closedReasonLocal = '';
      if (!collecting && !testMode) {
        closed = true;
        closedReasonLocal = 'This form is not accepting responses. Turn on Test mode or Start Collecting.';
      } else if (settings.end_date && collecting && new Date(settings.end_date) < new Date()) {
        closed = true;
        closedReasonLocal = 'This form has passed its deadline.';
      } else if (settings.start_date && collecting && new Date(settings.start_date) > new Date()) {
        closed = true;
        closedReasonLocal = `This form opens on ${new Date(settings.start_date).toLocaleDateString()}.`;
      }

      setForm(formData);
      setFields(formFields);
      setIsTestMode(testMode);
      setPreviewOnly(false);
      setFormClosed(closed);
      setClosedReason(closedReasonLocal);
      setLoading(false); // Paint immediately — enrich below

      // Soft session (cookie-local on public; budgeted getUser on dashboard)
      const authUser = await withTimeout(
        isPublicFormRoute
          ? supabase.auth.getSession().then(({ data }) => data.session?.user ?? null)
          : supabase.auth.getUser().then(({ data }) => data.user ?? null),
        2500,
      );
      setUser(authUser);

      if (!authUser) {
        if (!closed && (settings.require_login ?? settings.requireLogin ?? false)) {
          setFormClosed(true);
          setClosedReason('You must be logged in to fill this form.');
        } else if (!closed && (settings.access_type ?? settings.accessType ?? 'public') === 'internal') {
          setFormClosed(true);
          setClosedReason('This form is only available to portal members.');
        }
        setCanViewResponses(false);
        if (!closed && formFields.some((f) => f.field_type === 'roll_no')) {
          void refreshTakenRolls(formFields, testMode);
        }
        return;
      }

      const profResult = await withTimeout(
        Promise.resolve(
          supabase
            .from('profiles')
            .select('name, email, is_admin, is_faculty')
            .eq('id', authUser.id)
            .maybeSingle(),
        ),
        2500,
      );
      const profileForPrefill = profResult?.data ?? null;
      setProfile(profileForPrefill);
      setCanViewResponses(canViewFormResponses(formData, authUser.id, profileForPrefill));

      const isCreator = formData.created_by === authUser.id;

      if (!closed && collecting && !(settings.allow_multiple ?? settings.allowMultiple)) {
        const existingResult = await withTimeout(
          Promise.resolve(
            supabase
              .from('form_responses')
              .select('id')
              .eq('form_id', formId)
              .eq('user_id', authUser.id)
              .eq('is_test', false)
              .limit(1),
          ),
          2500,
        );
        const existing = existingResult?.data;
        if (existing && existing.length > 0) {
          if (isCreator) setPreviewOnly(true);
          else {
            setFormClosed(true);
            setClosedReason('You have already submitted a response.');
            closed = true;
          }
        }
      }

      if (profileForPrefill && formFields.length > 0) {
        const nameField = pickNameField(formFields);
        const emailField = pickEmailField(formFields);
        const prefill: Record<string, string> = {};
        if (nameField) prefill[nameField.id] = profileForPrefill?.name || '';
        if (emailField) prefill[emailField.id] = profileForPrefill?.email || '';
        if (Object.keys(prefill).length > 0) {
          setAnswers((prev) => ({ ...prev, ...prefill }));
        }
      }

      if (!closed && formData.form_type === 'event_registration' && formData.event_id) {
        const evResult = await withTimeout(
          Promise.resolve(
            supabase
              .from('events')
              .select('id, title, event_date, date, location, poster_url, poster_status, status')
              .eq('id', formData.event_id)
              .maybeSingle(),
          ),
          3000,
        );
        const ev = evResult?.data;
        if (collecting) {
          if (!ev) {
            setFormClosed(true);
            setClosedReason('This registration form is not linked to a valid event.');
          } else if (!isEventOpenForRegistration(ev.status)) {
            setFormClosed(true);
            setClosedReason(
              'Registration is not open for this event. It may be completed, cancelled, or not yet published for sign-ups.',
            );
          } else {
            const posterApproved =
              ev.poster_status === 'approved' ||
              (ev.poster_url && (ev.poster_status == null || ev.poster_status === ''));
            let posterUrl: string | null = null;
            if (posterApproved && ev.poster_url) {
              posterUrl = ev.poster_url;
              if (posterUrl && !posterUrl.startsWith('http')) {
                posterUrl = supabase.storage.from('event-documents').getPublicUrl(posterUrl).data.publicUrl;
              }
            }
            setEventDetails({ ...ev, poster_url: posterUrl });
          }
        } else if (ev) {
          let posterUrl: string | null = ev.poster_url || null;
          if (posterUrl && !posterUrl.startsWith('http')) {
            posterUrl = supabase.storage.from('event-documents').getPublicUrl(posterUrl).data.publicUrl;
          }
          setEventDetails({ ...ev, poster_url: posterUrl });
        } else {
          setEventDetails(null);
        }
      } else {
        setEventDetails(null);
      }

      if (!closed && formFields.some((f) => f.field_type === 'roll_no')) {
        void refreshTakenRolls(formFields, testMode);
      }
    } catch (err) {
      console.error('fetchForm fatal', err);
      toast.error('Could not load form');
      setFormClosed(true);
      setClosedReason('Could not load this form. Please try again.');
      setLoading(false);
    }
  }

  function updateAnswer(fieldId: string, value: any) {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n; });
  }

  function toggleCheckbox(fieldId: string, option: string, exactTwo = false) {
    setAnswers(prev => {
      const current: string[] = prev[fieldId] || [];
      if (current.includes(option)) {
        return { ...prev, [fieldId]: current.filter((o: string) => o !== option) };
      }
      if (exactTwo && current.length >= 2) {
        toast.error(EXACT_TWO_HINT);
        return prev;
      }
      return { ...prev, [fieldId]: [...current, option] };
    });
    setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n; });
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      const val = answers[field.id];
      if (field.field_type === 'checkbox_exact_2') {
        const selected = Array.isArray(val) ? val : [];
        if (selected.length !== 2) {
          newErrors[field.id] = EXACT_TWO_HINT;
        }
        continue;
      }
      if (field.required && (!val || (Array.isArray(val) && val.length === 0))) { newErrors[field.id] = 'This field is required'; continue; }
      if (val && field.validation) {
        const v = field.validation;
        if (v.minLength && typeof val === 'string' && val.length < v.minLength) newErrors[field.id] = `Minimum ${v.minLength} characters`;
        if (v.maxLength && typeof val === 'string' && val.length > v.maxLength) newErrors[field.id] = `Maximum ${v.maxLength} characters`;
        if (v.email && typeof val === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) newErrors[field.id] = 'Enter a valid email';
        if (field.field_type === 'mobile' && typeof val === 'string' && !/^[\d\s+\-()]{7,15}$/.test(val.trim())) {
          newErrors[field.id] = 'Enter a valid mobile number';
        }
      }
      if (field.field_type === 'roll_no' && val != null && String(val).trim() !== '') {
        if (!isValidRollNo(val, rollCountFromValidation(field.validation), excludedRollsFromValidation(field.validation))) {
          newErrors[field.id] = `Select an available roll number between 1 and ${rollCountFromValidation(field.validation)}`;
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (previewOnly) {
      toast('Preview only — you already submitted a live response.');
      return;
    }
    if (!validate()) { toast.error('Please fix the errors'); return; }
    setSubmitting(true);
    const collecting = isFormCollecting(form);
    const submittingAsTest = isFormTestMode(form) && !collecting;

    if (!submittingAsTest && form?.form_type === 'event_registration' && form?.event_id) {
      const { data: evCheck } = await supabase.from('events').select('status').eq('id', form.event_id).maybeSingle();
      if (!evCheck || !isEventOpenForRegistration(evCheck.status)) {
        toast.error('Registration is closed for this event.');
        setSubmitting(false);
        return;
      }
    }

    const responses: Record<string, any> = {};
    for (const field of fields) {
      const val = answers[field.id];
      if (field.field_type === 'file' && val instanceof File) {
        const ext = val.name.split('.').pop();
        const path = `form-uploads/${params.id}/${user?.id || 'anon'}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('documents').upload(path, val);
        if (upErr) { toast.error(`Upload failed for "${field.label}"`); setSubmitting(false); return; }
        responses[field.label] = path;
      } else { responses[field.label] = val ?? null; }
    }

    const emailVal = extractResponderEmail(responses, fields, profile, user);
    const nameVal = extractResponderName(responses, fields, profile);
    const srcParam =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('source') : null;
    const registrationSource =
      srcParam === 'onsite' || srcParam === 'on_site' || srcParam === 'qr' ? 'on_site' : 'advance';

    const onSubmitConflict = async (message: string) => {
      toast.error(message);
      if (fields.some((f) => f.field_type === 'roll_no')) {
        await refreshTakenRolls(fields, submittingAsTest);
      }
      setSubmitting(false);
    };

    /** Live event registration only — tests go through public/test RPC (no participants). */
    if (!submittingAsTest && form?.form_type === 'event_registration' && form?.event_id) {
      const rpcPack = await withTimeout(
        Promise.resolve(
          supabase.rpc('submit_event_registration_response', {
            p_form_id: formId,
            p_responses: responses,
            p_participant_name: String(nameVal || 'Participant'),
            p_participant_email: emailVal ? String(emailVal) : '',
            p_registration_source: registrationSource,
          }),
        ),
        20000,
      );
      if (!rpcPack) {
        toast.error('Registration timed out. Please try again.');
        setSubmitting(false);
        return;
      }
      const { data: rpcData, error: rpcError } = rpcPack;
      if (rpcError) {
        console.error('submit_event_registration_response', rpcError);
        await onSubmitConflict(rpcError.message || 'Failed to submit registration');
        return;
      }
      const row = rpcData as { response_id?: string; participant_id?: string } | null;
      if (!row?.response_id || !row?.participant_id) {
        toast.error('Registration failed. Apply Supabase migrations 083 and 084 (event registration + on-site source) if you have not already.');
        setSubmitting(false);
        return;
      }
      const payload = {
        participant_id: row.participant_id,
        event_id: form.event_id,
        response_id: row.response_id,
        form_id: formId,
        participant_name: nameVal,
        participant_email: emailVal,
        submitted_at: new Date().toISOString(),
      };
      const showPersonalQr = shouldShowPersonalQrAfterSubmit(form?.settings, form?.form_type);
      if (showPersonalQr) {
        setParticipantQrPayload(payload);
        try {
          setParticipantQrImage(await withTimeout(qrDataUrl(payload, 280), 8000));
        } catch {
          setParticipantQrImage(null);
        }
      } else {
        setParticipantQrPayload(null);
        setParticipantQrImage(null);
      }
      setSubmittedWasOnSite(registrationSource === 'on_site');
      setSubmittedWasTest(false);
      setSubmitted(true);
      setSubmitting(false);
      return;
    }

    // All normal (and test) submits go through the public RPC — reliable under concurrent load
    const rpcPack = await withTimeout(
      Promise.resolve(
        supabase.rpc('submit_public_form_response', {
          p_form_id: formId,
          p_responses: responses,
        }),
      ),
      20000,
    );
    if (!rpcPack) {
      toast.error('Submit timed out. Please try again.');
      setSubmitting(false);
      return;
    }
    const { data: rpcData, error: rpcError } = rpcPack;
    if (rpcError) {
      await onSubmitConflict(rpcError.message || 'Failed to submit');
      return;
    }
    const row = rpcData as { response_id?: string; is_test?: boolean } | null;
    setSubmittedWasOnSite(false);
    setSubmittedWasTest(!!row?.is_test || submittingAsTest);
    if (!submittingAsTest && shouldShowPersonalQrAfterSubmit(form?.settings, form?.form_type) && row?.response_id) {
      const participantId = crypto.randomUUID();
      const payload = {
        participant_id: participantId,
        event_id: form?.event_id || null,
        response_id: row.response_id,
        form_id: formId,
        participant_name: nameVal,
        participant_email: emailVal || '',
        submitted_at: new Date().toISOString(),
      };
      setParticipantQrPayload(payload);
      try {
        setParticipantQrImage(await withTimeout(qrDataUrl(payload, 260), 8000));
      } catch {
        setParticipantQrImage(null);
      }
    } else {
      setParticipantQrPayload(null);
      setParticipantQrImage(null);
    }
    setSubmitted(true);
    setSubmitting(false);
  }

  function downloadQr() {
    if (!participantQrImage) return;
    const a = document.createElement('a');
    a.href = participantQrImage;
    a.download = `participant-qr-${(participantQrPayload?.participant_email || 'email').toString().replace(/[^a-z0-9]/gi, '_')}.png`;
    a.click();
  }

  function copyLink() {
    const href = publicFormUrl(typeof window !== 'undefined' ? window.location.origin : '', String(params.id));
    navigator.clipboard.writeText(href);
    setCopied(true);
    toast.success('Form link copied');
    setTimeout(() => setCopied(false), 2000);
  }

  const backHref = user ? '/dashboard/forms' : isPublicFormRoute ? '/' : '/dashboard/forms';

  if (loading) return <PortalLoadingScreen message="Loading forms…" />;

  if (submitted) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-emerald-400/10 to-green-400/10 rounded-full blur-3xl" />
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="premium-panel rounded-3xl p-12 text-center max-w-md w-full shadow-2xl relative z-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 mx-auto mb-6 flex items-center justify-center shadow-lg shadow-emerald-500/30"
          >
            <Check className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Response Submitted</h2>
          <p className="text-gray-400 mb-4">
            {submittedWasTest
              ? 'Test response saved. It will disappear when the form starts collecting real responses — you can still submit a normal response then.'
              : 'Thank you for filling out this form.'}
          </p>
          {submittedWasTest && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 text-left max-w-md mx-auto">
              <p className="font-semibold">TEST submission</p>
              <p className="text-amber-800/90 mt-1">Not counted as a live response. Starting collection clears all test answers.</p>
            </div>
          )}
          {submittedWasOnSite && form?.form_type === 'event_registration' && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 text-left max-w-md mx-auto">
              <p className="font-semibold">On-spot registration complete</p>
              <p className="text-emerald-800/90 mt-1">
                You are on the participant list as <strong>on-site registration</strong> and marked <strong>present</strong> for this event.
              </p>
            </div>
          )}
          {participantQrImage && (
            <div className="mb-8 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
              <p className="text-sm font-semibold text-emerald-900 mb-1">
                {form?.form_type === 'event_registration' ? 'Your check-in QR' : 'Your submission QR'}
              </p>
              <p className="text-xs text-emerald-800/90 mb-3">
                {form?.form_type === 'event_registration'
                  ? 'Show this at the event — organizers will scan it on the attendance page to mark you present.'
                  : 'Save this QR if the form organizer asked you to keep a confirmation code.'}
              </p>
              <img src={participantQrImage} alt="Submission QR" className="w-52 h-52 mx-auto rounded-xl border border-white bg-white p-2 shadow-sm" />
              <button type="button" onClick={downloadQr} className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition">
                Download QR
              </button>
              <p className="text-[11px] text-emerald-800/80 mt-2">Save a screenshot or download — you may need it later.</p>
            </div>
          )}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
            <Link
              href={backHref}
              className="btn-gradient-purple px-6 py-2.5 rounded-2xl text-sm font-semibold shadow-lg shadow-purple-500/20"
            >
              {user ? 'Back to Forms' : 'Home'}
            </Link>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (formClosed) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-gradient-to-br from-amber-400/10 to-orange-400/10 rounded-full blur-3xl" />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="premium-panel rounded-3xl p-12 text-center max-w-md w-full shadow-2xl relative z-10"
        >
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 mx-auto mb-6 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Lock className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          <h2 className="text-2xl font-extrabold text-gray-800 mb-2">{form?.title || 'Form Closed'}</h2>
          <p className="text-gray-400 mb-8">{closedReason}</p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
            <Link
              href={backHref}
              className="btn-gradient-blue px-6 py-2.5 rounded-2xl text-sm font-semibold shadow-lg shadow-blue-500/20"
            >
              {user ? 'Back to Forms' : 'Home'}
            </Link>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh py-8 px-4 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-10 right-20 w-80 h-80 bg-gradient-to-br from-indigo-400/8 to-purple-400/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-10 w-64 h-64 bg-gradient-to-br from-pink-400/8 to-violet-400/8 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header Card */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="premium-panel rounded-t-3xl overflow-hidden mb-1 shadow-xl"
        >
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          {(form?.banner_url || form?.settings?.banner_url) && <img src={form.banner_url || form.settings.banner_url} alt="" className="w-full h-48 object-cover" />}
          <div className="p-8">
            <div className="flex items-center justify-between mb-5">
              <Link href={backHref} className="text-indigo-400 hover:text-indigo-600 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex gap-3">
                {canViewResponses && (
                  <Link href={`/dashboard/forms/${params.id}/responses`} className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-indigo-200 text-indigo-500 hover:bg-indigo-50 transition-all">
                    View Responses
                  </Link>
                )}
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={copyLink} className="text-indigo-400 hover:text-indigo-600 transition-colors">
                  {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Share2 className="w-5 h-5" />}
                </motion.button>
              </div>
            </div>
            <h1 className="text-3xl font-extrabold text-gradient tracking-tight mb-2">{form?.title}</h1>
            {form?.description?.trim() && <p className="text-gray-400">{form.description}</p>}
            {isTestMode && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Test mode</p>
                <p className="text-amber-800/90 mt-0.5">
                  Answers are marked as TEST and will be cleared when Start Collecting is turned on. Live duplicate rules do not apply here.
                </p>
              </div>
            )}
            {previewOnly && (
              <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                <p className="font-semibold">Preview (you already submitted)</p>
                <p className="text-indigo-800/90 mt-0.5">As the form creator you can review the form. Submit is disabled for another live response.</p>
              </div>
            )}
            {form?.form_type === 'event_registration' && eventDetails && (
              <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                <p className="text-xs font-semibold text-indigo-600 mb-2">Event Registration</p>
                <div className="flex gap-4 items-start">
                  {eventDetails.poster_url && (
                    <img src={eventDetails.poster_url} alt={eventDetails.title} className="w-20 h-24 object-cover rounded-lg border border-indigo-100" />
                  )}
                  <div className="text-sm text-indigo-900">
                    <p className="font-bold">{eventDetails.title}</p>
                    <p>
                      {eventDetails.event_date || eventDetails.date
                        ? new Date(eventDetails.event_date || eventDetails.date).toLocaleString('en-IN')
                        : 'Date TBA'}
                    </p>
                    <p>{eventDetails.location || 'Venue TBA'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Fields */}
        {fields.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="premium-panel rounded-3xl p-12 text-center">
            <p className="text-gray-400">This form has no questions yet.</p>
          </motion.div>
        ) : (
          <div className="space-y-1">
            {fields.map((field, i) => (
              <motion.div
                key={field.id}
                custom={i}
                variants={fieldAnim}
                initial="hidden"
                animate="show"
                className={`premium-panel p-6 transition-all duration-300 hover:shadow-lg ${errors[field.id] ? 'ring-2 ring-red-400/60' : ''}`}
              >
                <label className="block text-base font-semibold text-gray-800 mb-1">
                  {field.label || 'Untitled Question'}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {field.description && <p className="text-sm text-gray-400 mb-3">{field.description}</p>}

                {field.field_type === 'text' && (
                  <input type="text" value={answers[field.id] || ''} onChange={e => updateAnswer(field.id, e.target.value)} placeholder="Your answer" maxLength={field.validation?.maxLength}
                    className="w-full border-b-2 border-gray-200 focus:border-indigo-500 outline-none py-2 text-gray-800 bg-transparent transition-colors placeholder-gray-300" />
                )}
                {field.field_type === 'textarea' && (
                  <textarea value={answers[field.id] || ''} onChange={e => updateAnswer(field.id, e.target.value)} placeholder="Your answer" rows={4} maxLength={field.validation?.maxLength}
                    className="w-full border-2 border-gray-200 focus:border-indigo-500 outline-none p-3 rounded-xl text-gray-800 bg-white/40 resize-none transition-colors placeholder-gray-300" />
                )}
                {field.field_type === 'email' && (
                  <input type="email" value={answers[field.id] || ''} onChange={e => updateAnswer(field.id, e.target.value)} placeholder="email@example.com"
                    className="w-full border-b-2 border-gray-200 focus:border-indigo-500 outline-none py-2 text-gray-800 bg-transparent transition-colors placeholder-gray-300" />
                )}
                {field.field_type === 'number' && (
                  <input type="number" value={answers[field.id] || ''} onChange={e => updateAnswer(field.id, e.target.value ? Number(e.target.value) : '')} placeholder="0"
                    min={field.validation?.minValue} max={field.validation?.maxValue}
                    className="w-full border-b-2 border-gray-200 focus:border-indigo-500 outline-none py-2 text-gray-800 bg-transparent transition-colors placeholder-gray-300" />
                )}
                {field.field_type === 'roll_no' && (
                  <SearchableRollSelect
                    count={rollCountFromValidation(field.validation)}
                    value={answers[field.id] ? String(answers[field.id]) : ''}
                    onChange={(v) => updateAnswer(field.id, v)}
                    takenRolls={takenRollsByFieldId[field.id] || []}
                    excludedRolls={excludedRollsFromValidation(field.validation)}
                    error={errors[field.id]}
                  />
                )}
                {field.field_type === 'mobile' && (
                  <input type="tel" value={answers[field.id] || ''} onChange={e => updateAnswer(field.id, e.target.value)} placeholder="9876543210"
                    maxLength={field.validation?.maxLength || 15}
                    className="w-full border-b-2 border-gray-200 focus:border-indigo-500 outline-none py-2 text-gray-800 bg-transparent transition-colors placeholder-gray-300" />
                )}
                {field.field_type === 'date' && (
                  <input type="date" value={answers[field.id] || ''} onChange={e => updateAnswer(field.id, e.target.value)}
                    className="w-full border-b-2 border-gray-200 focus:border-indigo-500 outline-none py-2 text-gray-800 bg-transparent transition-colors" />
                )}
                {field.field_type === 'radio' && (
                  <div className="space-y-2 mt-2">
                    {field.options?.map((opt, j) => (
                      <motion.label key={j} whileHover={{ x: 4 }} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50/50 cursor-pointer transition-colors">
                        <input type="radio" name={field.id} checked={answers[field.id] === opt} onChange={() => updateAnswer(field.id, opt)} className="w-4 h-4 text-indigo-600" />
                        <span className="text-gray-700">{opt}</span>
                      </motion.label>
                    ))}
                  </div>
                )}
                {field.field_type === 'checkbox' && (
                  <div className="space-y-2 mt-2">
                    {field.options?.map((opt, j) => (
                      <motion.label key={j} whileHover={{ x: 4 }} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50/50 cursor-pointer transition-colors">
                        <input type="checkbox" checked={(answers[field.id] || []).includes(opt)} onChange={() => toggleCheckbox(field.id, opt)} className="w-4 h-4 text-indigo-600 rounded" />
                        <span className="text-gray-700">{opt}</span>
                      </motion.label>
                    ))}
                  </div>
                )}
                {field.field_type === 'checkbox_exact_2' && (
                  <div className="space-y-2 mt-2">
                    <p className="text-xs font-medium text-indigo-600">
                      {EXACT_TWO_HINT}
                      {Array.isArray(answers[field.id]) ? ` (${answers[field.id].length}/2 selected)` : ' (0/2 selected)'}
                    </p>
                    {field.options?.map((opt, j) => (
                      <motion.label key={j} whileHover={{ x: 4 }} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50/50 cursor-pointer transition-colors">
                        <input type="checkbox" checked={(answers[field.id] || []).includes(opt)} onChange={() => toggleCheckbox(field.id, opt, true)} className="w-4 h-4 text-indigo-600 rounded" />
                        <span className="text-gray-700">{opt}</span>
                      </motion.label>
                    ))}
                  </div>
                )}
                {field.field_type === 'dropdown' && (
                  <select value={answers[field.id] || ''} onChange={e => updateAnswer(field.id, e.target.value)}
                    className="w-full border-2 border-gray-200 focus:border-indigo-500 outline-none p-2.5 rounded-xl text-gray-800 bg-white/40 transition-colors">
                    <option value="">Choose an option</option>
                    {field.options?.map((opt, j) => <option key={j} value={opt}>{opt}</option>)}
                  </select>
                )}
                {field.field_type === 'file' && (
                  <div>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group">
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
                        <Upload className="w-8 h-8 text-gray-300 group-hover:text-indigo-400 transition-colors mb-2" />
                      </motion.div>
                      <span className="text-sm text-gray-400 group-hover:text-indigo-500 transition-colors">
                        {answers[field.id] ? (answers[field.id] as File).name : 'Click to upload'}
                      </span>
                      <input type="file" className="hidden"
                        accept={field.validation?.allowedFileTypes?.map(t => `.${t}`).join(',') || '.pdf,.doc,.docx,.jpg,.png'}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const maxMB = field.validation?.maxFileSize || 10;
                            if (file.size > maxMB * 1024 * 1024) { toast.error(`File must be under ${maxMB}MB`); return; }
                            updateAnswer(field.id, file);
                          }
                        }}
                      />
                    </label>
                    <p className="text-xs text-gray-400 mt-1.5">Max {field.validation?.maxFileSize || 10}MB{field.validation?.allowedFileTypes && ` · ${field.validation.allowedFileTypes.join(', ').toUpperCase()}`}</p>
                  </div>
                )}

                <AnimatePresence>
                  {errors[field.id] && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-sm mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {errors[field.id]}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}

            {/* Submit */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: fields.length * 0.05 + 0.2 }}
              className="premium-panel rounded-b-3xl p-6 flex items-center gap-4"
            >
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={submitting || previewOnly}
                className="btn-gradient-purple px-8 py-2.5 rounded-2xl text-sm font-semibold shadow-lg shadow-purple-500/20 disabled:opacity-50"
              >
                {submitting
                  ? 'Submitting...'
                  : previewOnly
                    ? 'Already submitted'
                    : isTestMode
                      ? 'Submit test response'
                      : 'Submit'}
              </motion.button>
              <button onClick={() => { setAnswers({}); setErrors({}); }} type="button" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Clear form
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
