'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Plus, FileText, BarChart3, Edit, Eye, Clock, CheckCircle, XCircle, Copy, Trash2, PauseCircle, PlayCircle, Pencil, Share2, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { publicFormUrl } from '@/lib/form-public-access';
import PageHeader from '@/components/PageHeader';
import { canManageForm, canViewFormResponses, isFormTestMode, isFormBeforeStart, isFormPastDeadline } from '@/lib/form-access';
import { withTimeout } from '@/lib/with-timeout';
import GradientMesh from '@/components/react-bits/GradientMesh';
import GsapText from '@/components/react-bits/GsapText';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

export default function FormsPage() {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'closed'>('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [togglingTest, setTogglingTest] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ is_admin?: boolean; is_faculty?: boolean; executive_role?: string | null } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    async function loadForUser(user: { id: string }) {
      if (cancelled) return;
      await fetchFormsForUser(user);
    }

    async function init() {
      setLoading(true);
      let resolved = false;

      const markLoaded = async (user: { id: string }) => {
        if (cancelled || resolved) return;
        resolved = true;
        unsub?.();
        await loadForUser(user);
      };

      // Prefer cookie session (no network). Retry a few times — Auth lock can lag after middleware.
      for (let i = 0; i < 4; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          await markLoaded(session.user);
          return;
        }
        await new Promise((r) => setTimeout(r, 200 + i * 150));
      }

      // Wait for client Auth hydration
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) void markLoaded(session.user);
      });
      unsub = () => subscription.unsubscribe();

      // Network check — do not short-timeout (that falsely looked signed-out)
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) {
        await markLoaded(user);
        return;
      }

      await new Promise((r) => setTimeout(r, 2000));
      if (cancelled || resolved) return;
      unsub?.();
      toast.error('Please sign in to view forms');
      setForms([]);
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchFormsForUser(user: { id: string }) {
    setLoading(true);
    setCurrentUserId(user.id);
    try {
      type FormRow = {
        id: string;
        title?: string | null;
        description?: string | null;
        fields?: unknown;
        settings?: Record<string, unknown> | null;
        is_active?: boolean | null;
        form_type?: string | null;
        event_id?: string | null;
        created_by?: string | null;
        created_at?: string | null;
        creator?: { name?: string | null } | { name?: string | null }[] | null;
      };

      let formsData: FormRow[] | null = null;
      let formsError: { message?: string } | null = null;

      const withCreator = await withTimeout(
        Promise.resolve(
          supabase
            .from('forms')
            .select('id, title, description, fields, settings, is_active, form_type, event_id, created_by, created_at, creator:profiles!forms_created_by_fkey(name)')
            .order('created_at', { ascending: false }),
        ),
        12000,
      );
      if (withCreator && !withCreator.error && withCreator.data) {
        formsData = withCreator.data as FormRow[];
      } else {
        formsError = withCreator?.error ?? null;
        const plain = await withTimeout(
          Promise.resolve(
            supabase
              .from('forms')
              .select('id, title, description, fields, settings, is_active, form_type, event_id, created_by, created_at')
              .order('created_at', { ascending: false }),
          ),
          12000,
        );
        if (plain && !plain.error && plain.data) {
          formsData = plain.data as FormRow[];
          formsError = null;
        } else {
          formsError = plain?.error ?? formsError;
        }
      }

      if (!formsData) {
        if (formsError) toast.error(formsError.message || 'Failed to load forms');
        setForms([]);
        return;
      }

      // Paint list immediately — counts load in the background
      const baseRows = formsData.map((f: any) => ({
        ...f,
        response_count: 0,
        live_count: 0,
        test_count: 0,
        can_view_responses: true,
        computed_status: getFormStatus(f),
      }));
      setForms(baseRows);
      setLoading(false);

      const profileResult = await withTimeout(
        Promise.resolve(
          supabase
            .from('profiles')
            .select('is_admin, is_faculty, executive_role')
            .eq('id', user.id)
            .maybeSingle(),
        ),
        4000,
      );
      const userProfile = profileResult?.data ?? null;
      setProfile(userProfile);

      const viewable = formsData.filter((f: any) => canViewFormResponses(f, user.id, userProfile));
      let countByForm: Record<string, number> = {};
      let testCountByForm: Record<string, number> = {};

      if (viewable.length > 0) {
        type CountRow = { form_id: string; is_test?: boolean };
        let rows: CountRow[] = [];
        const withTest = await withTimeout(
          Promise.resolve(
            supabase
              .from('form_responses')
              .select('form_id, is_test')
              .in(
                'form_id',
                viewable.map((f: { id: string }) => f.id),
              ),
          ),
          8000,
        );
        if (withTest && !withTest.error && withTest.data) {
          rows = withTest.data as CountRow[];
        } else {
          const withoutTest = await withTimeout(
            Promise.resolve(
              supabase
                .from('form_responses')
                .select('form_id')
                .in(
                  'form_id',
                  viewable.map((f: { id: string }) => f.id),
                ),
            ),
            8000,
          );
          rows = (withoutTest?.data || []) as CountRow[];
        }
        for (const row of rows) {
          const id = String(row.form_id);
          if (row.is_test) testCountByForm[id] = (testCountByForm[id] || 0) + 1;
          else countByForm[id] = (countByForm[id] || 0) + 1;
        }
      }

      setForms(
        formsData.map((f: any) => {
          const canView = canViewFormResponses(f, user.id, userProfile);
          return {
            ...f,
            response_count: canView ? (countByForm[f.id] || 0) + (testCountByForm[f.id] || 0) : 0,
            live_count: canView ? countByForm[f.id] || 0 : 0,
            test_count: canView ? testCountByForm[f.id] || 0 : 0,
            can_view_responses: canView,
            computed_status: getFormStatus(f),
          };
        }),
      );
    } catch (err) {
      console.error('fetchForms', err);
      toast.error('Could not load forms');
      setForms([]);
    } finally {
      setLoading(false);
    }
  }

  function getFormStatus(form: any): string {
    const s = form.settings || {};
    // is_active is the live switch (ignore leftover status=draft)
    if (!form.is_active) return 'draft';
    if (isFormPastDeadline(s)) return 'closed';
    if (isFormBeforeStart(s)) return 'scheduled';
    return 'active';
  }

  function copyLink(formId: string) {
    const form = forms.find((f) => f.id === formId);
    navigator.clipboard.writeText(publicFormUrl(window.location.origin, formId));
    if (form && !form.is_active && !isFormTestMode(form)) {
      toast.error('Copied — but form is CLOSED. Click Start Collecting before sharing with students.');
    } else {
      toast.success('Public link copied!');
    }
  }

  async function deleteForm(formId: string) {
    if (!confirm('Delete this form and all its responses?')) return;
    setDeleting(formId);
    const { data: deleted, error: formErr } = await supabase
      .from('forms')
      .delete()
      .eq('id', formId)
      .select('id');
    if (formErr) {
      toast.error('Failed to delete form: ' + formErr.message);
      setDeleting(null);
      return;
    }
    if (!deleted?.length) {
      toast.error('Could not delete this form. Please try again.');
      setDeleting(null);
      return;
    }
    setForms(prev => prev.filter(f => f.id !== formId));
    toast.success('Form deleted');
    setDeleting(null);
  }

  async function toggleAccepting(form: any) {
    if (!canManageForm(form, currentUserId, profile)) {
      toast.error('You must be logged in to change this form.');
      return;
    }
    setToggling(form.id);
    const isCurrentlyActive = !!form.is_active;
    const newActive = !isCurrentlyActive;
    const newSettings = {
      ...(form.settings || {}),
      status: newActive ? 'active' : 'draft',
      test_mode: newActive ? false : !!(form.settings?.test_mode || form.settings?.testMode),
    };
    delete (newSettings as any).testMode;

    if (newActive) {
      const { data: cleared, error: clearErr } = await supabase.rpc('clear_form_test_responses', {
        p_form_id: form.id,
      });
      if (clearErr) {
        console.error('clear_form_test_responses', clearErr);
        toast.error('Could not clear test responses. Apply migration 119 if needed.');
        setToggling(null);
        return;
      }
      if (typeof cleared === 'number' && cleared > 0) {
        toast.success(`Cleared ${cleared} test response${cleared === 1 ? '' : 's'}`);
      }
      newSettings.test_mode = false;
    }

    const { data: updated, error } = await supabase
      .from('forms')
      .update({ is_active: newActive, settings: newSettings, updated_at: new Date().toISOString() })
      .eq('id', form.id)
      .select('id')
      .maybeSingle();

    if (error) {
      toast.error('Failed to update form');
    } else if (!updated) {
      toast.error('Could not update this form. Please try again.');
    } else {
      setForms(prev => prev.map(f => {
        if (f.id !== form.id) return f;
        const next = { ...f, is_active: newActive, settings: newSettings };
        return {
          ...next,
          response_count: newActive ? Math.max(0, (f.response_count || 0) - (f.test_count || 0)) : f.response_count,
          test_count: newActive ? 0 : f.test_count,
          computed_status: getFormStatus(next),
        };
      }));
      toast.success(newActive ? 'Form is now accepting live responses' : 'Stopped collecting');
    }
    setToggling(null);
  }

  async function toggleTestMode(form: any) {
    if (!canManageForm(form, currentUserId, profile)) {
      toast.error('You must be logged in to change this form.');
      return;
    }
    const isCurrentlyActive = !!form.is_active;
    if (isCurrentlyActive) {
      toast.error('Stop collecting first — test mode is only for when the form is not live.');
      return;
    }
    setTogglingTest(form.id);
    const nextOn = !isFormTestMode(form);
    const newSettings = { ...(form.settings || {}), test_mode: nextOn };
    delete (newSettings as any).testMode;

    const { data: updated, error } = await supabase
      .from('forms')
      .update({ settings: newSettings, updated_at: new Date().toISOString() })
      .eq('id', form.id)
      .select('id')
      .maybeSingle();

    if (error) {
      toast.error('Failed to update test mode');
    } else if (!updated) {
      toast.error('Could not update this form. Please try again.');
    } else {
      setForms(prev => prev.map(f => {
        if (f.id !== form.id) return f;
        const next = { ...f, settings: newSettings };
        return { ...next, computed_status: getFormStatus(next) };
      }));
      toast.success(nextOn ? 'Test mode on — share the link to try the form' : 'Test mode off');
    }
    setTogglingTest(null);
  }

  async function duplicateForm(form: any) {
    if (!currentUserId) {
      toast.error('You must be logged in.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const cloneSettings = {
      ...(form.settings || {}),
      status: 'draft',
      banner_url: form.settings?.banner_url || form.banner_url || '',
    };
    const { data: created, error } = await supabase
      .from('forms')
      .insert({
        title: `${form.title || 'Untitled Form'} (copy)`,
        description: form.description || null,
        fields: form.fields || [],
        created_by: user.id,
        is_active: false,
        settings: cloneSettings,
        form_type: form.form_type || 'normal',
        event_id: form.form_type === 'event_registration' ? form.event_id : null,
      })
      .select('*, creator:profiles!forms_created_by_fkey(name)')
      .single();
    if (error || !created) {
      toast.error(error?.message || 'Failed to duplicate form');
      return;
    }
    const row = {
      ...created,
      response_count: 0,
      test_count: 0,
      can_view_responses: true,
      computed_status: getFormStatus(created),
    };
    setForms(prev => [row, ...prev]);
    toast.success('Form duplicated as draft');
  }

  const filtered = filter === 'all' ? forms : forms.filter(f => f.computed_status === filter);

  const statusConfig: Record<string, { color: string; icon: any; bg: string }> = {
    active: { color: 'text-emerald-400', icon: CheckCircle, bg: 'bg-emerald-500/10 border-emerald-500/20' },
    draft: { color: 'text-gray-400', icon: Edit, bg: 'bg-gray-500/10 border-gray-500/20' },
    closed: { color: 'text-red-400', icon: XCircle, bg: 'bg-red-500/10 border-red-500/20' },
    scheduled: { color: 'text-blue-400', icon: Clock, bg: 'bg-blue-500/10 border-blue-500/20' },
  };

  const counts = {
    all: forms.length,
    active: forms.filter(f => f.computed_status === 'active').length,
    draft: forms.filter(f => f.computed_status === 'draft').length,
    closed: forms.filter(f => f.computed_status === 'closed').length,
  };

  if (loading) return <PortalLoadingScreen message="Loading forms…" variant="resources" />;

  return (
    <div className="min-h-screen bg-mesh py-8 px-4 relative overflow-hidden">
      <GradientMesh className="opacity-70" />

      <PageHeader
        title="Forms"
        gradientTitle
        rightContent={
          <Link href="/dashboard/forms/create" className="btn-gradient-purple px-5 py-2.5 rounded-2xl flex items-center gap-2 text-sm font-semibold shadow-lg shadow-purple-500/20">
            <Plus className="w-4 h-4" /> Create Form
          </Link>
        }
      />

      <div className="max-w-7xl mx-auto relative z-10 mt-6">
        <div className="mb-6">
          <GsapText
            text="Create, collect, and review responses."
            as="p"
            className="text-sm text-gray-500"
            split="words"
            delay={0.12}
            stagger={0.04}
          />
        </div>

        {/* Filter Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="premium-card rounded-2xl p-1.5 flex gap-1 mb-8 w-full max-w-full overflow-x-auto mobile-clean-scroll"
        >
          {(['all', 'active', 'draft', 'closed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`relative px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap shrink-0 ${filter === tab ? 'text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'}`}
            >
              {filter === tab && (
                <motion.div layoutId="activeTab" className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl shadow-lg" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <span className="relative z-10">{tab.charAt(0).toUpperCase() + tab.slice(1)} ({counts[tab]})</span>
            </button>
          ))}
        </motion.div>

        {/* Forms Grid */}
        <AnimatePresence mode="wait">
          {filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="premium-panel rounded-2xl p-16 text-center">
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              </motion.div>
              <h3 className="text-xl font-bold text-gray-600 mb-2">{filter === 'all' ? 'No forms yet' : `No ${filter} forms`}</h3>
              <p className="text-gray-400 mb-6">Create your first form to start collecting responses</p>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Link href="/dashboard/forms/create" className="btn-gradient-purple px-6 py-2.5 rounded-2xl inline-flex items-center gap-2 text-sm font-semibold shadow-lg shadow-purple-500/20">
                  <Plus className="w-4 h-4" /> Create Form
                </Link>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="grid" variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(form => {
                const cfg = statusConfig[form.computed_status] || statusConfig.draft;
                const StatusIcon = cfg.icon;
                const isActive = form.computed_status === 'active';
                const testModeOn = isFormTestMode(form);
                const manageable = canManageForm(form, currentUserId, profile);
                return (
                  <motion.div key={form.id} variants={item} whileHover={{ y: -6, transition: { duration: 0.2 } }} className="group relative">
                    <div className="premium-panel rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 relative">
                      <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                      <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-indigo-400/10 to-purple-400/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      <div className="p-6 relative z-10">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-bold text-gray-800 line-clamp-2 flex-1 mr-3">{form.title || 'Untitled Form'}</h3>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 whitespace-nowrap border ${cfg.bg}`}>
                              <StatusIcon className={`w-3 h-3 ${cfg.color}`} />
                              <span className={cfg.color}>{form.computed_status}</span>
                            </span>
                            {testModeOn && !isActive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-200 bg-amber-50 text-amber-700">
                                Test mode
                              </span>
                            )}
                          </div>
                        </div>

                        {form.description && <p className="text-gray-400 text-sm line-clamp-2 mb-4">{form.description}</p>}

                        <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                          {form.can_view_responses ? (
                            <span className="flex items-center gap-1.5">
                              <BarChart3 className="w-4 h-4 text-indigo-400" />
                              <span className="font-medium text-gray-600">{form.live_count ?? form.response_count}</span> live
                              {(form.test_count || 0) > 0 && (
                                <span className="text-amber-600 text-xs font-semibold">· {form.test_count} test</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Responses restricted</span>
                          )}
                          <span className="text-gray-300">·</span>
                          <span>{form.creator?.name || 'Unknown'}</span>
                        </div>

                        {manageable && (
                        <div className="flex flex-col gap-2 mb-4">
                          <button
                            onClick={() => toggleAccepting(form)}
                            disabled={toggling === form.id || togglingTest === form.id}
                            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${isActive
                              ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                              } disabled:opacity-50`}
                          >
                            {toggling === form.id ? '...' : isActive ? (
                              <><PauseCircle className="w-3.5 h-3.5" /> Stop Collecting</>
                            ) : (
                              <><PlayCircle className="w-3.5 h-3.5" /> Start Collecting</>
                            )}
                          </button>
                          {!isActive && (
                            <button
                              onClick={() => toggleTestMode(form)}
                              disabled={togglingTest === form.id || toggling === form.id}
                              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 ${
                                testModeOn
                                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                              }`}
                            >
                              {togglingTest === form.id ? '...' : (
                                <><FlaskConical className="w-3.5 h-3.5" /> {testModeOn ? 'Turn off Test mode' : 'Turn on Test mode'}</>
                              )}
                            </button>
                          )}
                        </div>
                        )}

                        <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                          {form.can_view_responses && (
                          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="flex-1">
                            <Link href={`/dashboard/forms/${form.id}/responses`} className="btn-gradient-blue px-3 py-2 rounded-xl text-xs font-semibold text-center block shadow-md shadow-blue-500/10">
                              <span className="flex items-center justify-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Responses</span>
                            </Link>
                          </motion.div>
                          )}
                          {manageable && (
                          <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                            <Link href={`/dashboard/forms/${form.id}/edit`} className="p-2 rounded-xl hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-all" title="Edit Form">
                              <Pencil className="w-4 h-4" />
                            </Link>
                          </motion.div>
                          )}
                          {manageable && (
                          <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                            <button onClick={() => duplicateForm(form)} className="p-2 rounded-xl hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-all" title="Duplicate form">
                              <Copy className="w-4 h-4" />
                            </button>
                          </motion.div>
                          )}
                          <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                            <Link href={`/forms/${form.id}`} className="p-2 rounded-xl hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-all" title={isActive ? 'Open form' : testModeOn ? 'Open test form' : 'Preview form'}>
                              <Eye className="w-4 h-4" />
                            </Link>
                          </motion.div>
                          <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                            <button onClick={() => copyLink(form.id)} className="p-2 rounded-xl hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-all" title="Copy Link">
                              <Share2 className="w-4 h-4" />
                            </button>
                          </motion.div>
                          {manageable && (
                          <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                            <button onClick={() => deleteForm(form.id)} disabled={deleting === form.id} className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </motion.div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
