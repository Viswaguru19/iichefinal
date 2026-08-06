'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Download, BarChart3, Users, FileText, Search, ChevronDown, ExternalLink, Copy, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  getResponderDisplayEmail,
  getResponderDisplayMobile,
  getResponderDisplayName,
  getResponderDedupeKey,
} from '@/lib/form-responder-fields';
import SimplePieChart, { pieColors } from '@/components/forms/SimplePieChart';
import { generateAvailableRollOptions, rollCountFromValidation, excludedRollsFromValidation } from '@/lib/form-field-types';
import { canViewFormResponses } from '@/lib/form-access';
import { withTimeout } from '@/lib/with-timeout';

interface FormField {
  id: string;
  field_type: string;
  label: string;
  options?: string[];
  validation?: { maxValue?: number; minValue?: number; excludedRolls?: string[] };
}

const PAGE_SIZE = 1000;

export default function FormResponsesPage() {
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canView, setCanView] = useState(false);
  const [view, setView] = useState<'summary' | 'individual'>('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const params = useParams();
  const supabase = createClient();

  useEffect(() => { void checkAccess(); }, []);

  async function checkAccess() {
    setLoading(true);
    try {
      const formId = String(params.id);
      let user =
        (await supabase.auth.getSession()).data.session?.user ?? null;
      if (!user) {
        user = (await withTimeout(
          supabase.auth.getUser().then(({ data }) => data.user ?? null),
          8000,
        )) ?? null;
      }
      if (!user) {
        toast.error('Please sign in to view responses');
        setCanView(false);
        setLoading(false);
        return;
      }

      const [profilePack, formPack] = await Promise.all([
        withTimeout(
          Promise.resolve(
            supabase.from('profiles').select('is_admin, is_faculty').eq('id', user.id).maybeSingle(),
          ),
          5000,
        ),
        withTimeout(
          Promise.resolve(supabase.from('forms').select('*').eq('id', formId).single()),
          8000,
        ),
      ]);

      const profile = profilePack?.data ?? null;
      const formData = formPack?.data ?? null;
      if (!formData) {
        toast.error(formPack?.error?.message || 'Form not found');
        setLoading(false);
        return;
      }

      const hasAccess = canViewFormResponses(formData, user.id, profile);
      setCanView(hasAccess);
      if (hasAccess) await fetchData(formData);
      else setLoading(false);
    } catch (err) {
      console.error('checkAccess', err);
      toast.error('Could not load responses');
      setLoading(false);
    }
  }

  async function fetchAllResponses(formId: string) {
    const all: any[] = [];
    let from = 0;
    for (;;) {
      const pack = await withTimeout(
        Promise.resolve(
          supabase
            .from('form_responses')
            .select('*')
            .eq('form_id', formId)
            .order('created_at', { ascending: false })
            .range(from, from + PAGE_SIZE - 1),
        ),
        15000,
      );
      if (!pack) {
        toast.error('Loading responses timed out');
        break;
      }
      if (pack.error) {
        console.error('Responses query error:', pack.error.message, pack.error.code);
        toast.error(pack.error.message || 'Could not load responses');
        break;
      }
      const batch = pack.data || [];
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return all;
  }

  async function fetchData(existingForm?: any) {
    const formId = String(params.id);
    let formData = existingForm;
    if (!formData) {
      const { data, error: formError } = await supabase.from('forms').select('*').eq('id', formId).single();
      if (formError) console.error('Error fetching form:', formError);
      formData = data;
    }

    const responsesData = await fetchAllResponses(formId);

    const userIds = [...new Set(responsesData.map((r) => r.user_id).filter(Boolean))];
    let userMap: Record<string, any> = {};
    if (userIds.length > 0) {
      for (let i = 0; i < userIds.length; i += 200) {
        const chunk = userIds.slice(i, i + 200);
        const { data: users } = await supabase.from('profiles').select('id, name, email').in('id', chunk);
        users?.forEach((u: { id: string }) => { userMap[u.id] = u; });
      }
    }

    const enriched = responsesData.map((r) => ({
      ...r,
      user: r.user_id ? userMap[r.user_id] || { name: 'Unknown', email: '' } : null,
    }));

    setForm(formData);
    setFields(formData?.fields || []);
    setResponses(enriched);
    setLoading(false);
  }

  function getFieldSummary(field: FormField) {
    const vals = responses.map(r => r.responses?.[field.label]).filter(v => v !== null && v !== undefined && v !== '');
    if (field.field_type === 'roll_no') {
      const options = generateAvailableRollOptions(
        rollCountFromValidation(field.validation),
        excludedRollsFromValidation(field.validation),
      );
      const counts: Record<string, number> = {};
      options.forEach(o => { counts[o] = 0; });
      vals.forEach(v => {
        const s = String(v);
        counts[s] = (counts[s] || 0) + 1;
      });
      return { type: 'choice' as const, counts, total: vals.length };
    }
    if (['radio', 'dropdown'].includes(field.field_type) && field.options) {
      const counts: Record<string, number> = {};
      field.options.forEach(o => { counts[o] = 0; });
      vals.forEach(v => {
        if (typeof v === 'string') counts[v] = (counts[v] || 0) + 1;
      });
      return { type: 'choice' as const, counts, total: vals.length };
    }
    if ((field.field_type === 'checkbox' || field.field_type === 'checkbox_exact_2') && field.options) {
      const counts: Record<string, number> = {};
      field.options.forEach(o => { counts[o] = 0; });
      vals.forEach(v => {
        if (Array.isArray(v)) v.forEach(item => { counts[item] = (counts[item] || 0) + 1; });
      });
      return { type: 'multi' as const, counts, total: vals.length };
    }
    if (field.field_type === 'number') {
      const nums = vals.map(Number).filter(n => !isNaN(n));
      if (nums.length === 0) return { type: 'text' as const, values: [] as string[], total: 0 };
      return {
        type: 'number' as const,
        avg: (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1),
        min: Math.min(...nums),
        max: Math.max(...nums),
        total: nums.length,
      };
    }
    return {
      type: 'text' as const,
      values: vals.map((v) => (Array.isArray(v) ? v.join(', ') : String(v))),
      total: vals.length,
    };
  }

  const duplicateMeta = useMemo(() => {
    const keyCounts = new Map<string, number>();
    const responseFlags = new Map<string, { key: string; type: string; count: number }>();
    for (const r of responses) {
      if (r.is_test) continue;
      const dedupe = getResponderDedupeKey(r.responses, fields, r.user);
      if (!dedupe.type || !dedupe.value) continue;
      const k = `${dedupe.type}:${dedupe.value}`;
      keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
    }
    let duplicateResponseCount = 0;
    for (const r of responses) {
      if (r.is_test) continue;
      const dedupe = getResponderDedupeKey(r.responses, fields, r.user);
      if (!dedupe.type || !dedupe.value) continue;
      const k = `${dedupe.type}:${dedupe.value}`;
      const count = keyCounts.get(k) || 0;
      if (count > 1) {
        duplicateResponseCount += 1;
        responseFlags.set(r.id, { key: dedupe.value, type: dedupe.type, count });
      }
    }
    const duplicateGroups = [...keyCounts.entries()].filter(([, c]) => c > 1).length;
    return { responseFlags, duplicateResponseCount, duplicateGroups };
  }, [responses, fields]);

  function exportCSV() {
    if (responses.length === 0) { toast.error('No responses to export'); return; }
    const headers = ['Submitted At', 'Type', 'Name', 'Email', 'Mobile', ...fields.map(f => f.label)];
    const rows = responses.map(r => [
      new Date(r.submitted_at || r.created_at).toLocaleString(),
      r.is_test ? 'TEST' : 'Live',
      getResponderDisplayName(r.responses, fields, r.user),
      getResponderDisplayEmail(r.responses, fields, r.user) || '-',
      getResponderDisplayMobile(r.responses, fields) || '-',
      ...fields.map(f => { const val = r.responses?.[f.label]; return Array.isArray(val) ? val.join('; ') : val ?? ''; }),
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${form?.title || 'form'}-responses.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported all ${responses.length} responses`);
  }

  const filteredResponses = searchTerm
    ? responses.filter(r => {
      const t = searchTerm.toLowerCase();
      const name = getResponderDisplayName(r.responses, fields, r.user).toLowerCase();
      const email = getResponderDisplayEmail(r.responses, fields, r.user).toLowerCase();
      const mobile = getResponderDisplayMobile(r.responses, fields);
      return name.includes(t) || email.includes(t) || mobile.includes(t);
    })
    : responses;

  const allowMultiple = !!(form?.settings?.allow_multiple ?? form?.settings?.allowMultiple);

  if (loading) return <PortalLoadingScreen message="Loading responses…" />;

  if (!canView) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="premium-panel rounded-3xl p-12 text-center max-w-md shadow-2xl">
          <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-400">You don't have permission to view responses.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh py-8 px-4 relative overflow-hidden">
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-pink-400/8 to-violet-400/8 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/dashboard/forms" className="text-indigo-400 hover:text-indigo-600 transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gradient tracking-tight truncate">{form?.title}</h1>
              <p className="text-gray-400 text-sm">
                {responses.filter((r) => !r.is_test).length} live
                {responses.some((r) => r.is_test) && (
                  <> · <span className="text-amber-600 font-medium">{responses.filter((r) => r.is_test).length} test</span> (cleared when Start Collecting)</>
                )}
                {allowMultiple ? ' · multiple submissions allowed' : ' · live duplicates blocked by email, else mobile'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={exportCSV}
            className="btn-gradient-green px-5 py-2.5 rounded-2xl flex items-center gap-2 text-sm font-semibold shadow-lg shadow-emerald-500/20"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users, value: responses.filter((r) => !r.is_test).length, label: 'Live responses', gradient: 'from-indigo-500 to-purple-500' },
            { icon: AlertTriangle, value: responses.filter((r) => r.is_test).length, label: 'Test responses', gradient: 'from-amber-500 to-orange-500' },
            { icon: FileText, value: fields.length, label: 'Questions', gradient: 'from-emerald-500 to-green-500' },
            { icon: Copy, value: duplicateMeta.duplicateGroups, label: 'Duplicate groups', gradient: 'from-rose-500 to-red-500' },
          ].map((stat, i) => (
            <div key={i} className="premium-panel rounded-2xl p-4 flex items-center gap-3 shadow-md">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg shrink-0`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-extrabold text-gray-800 truncate">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {!allowMultiple && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              New submissions are blocked if the same <strong>email</strong> already responded.
              If there is no email on the form, <strong>mobile number</strong> is used instead.
              Turn on “Allow multiple responses” in form settings if you want to permit repeats.
              {duplicateMeta.duplicateResponseCount > 0 && (
                <> Currently {duplicateMeta.duplicateResponseCount} existing row{duplicateMeta.duplicateResponseCount !== 1 ? 's' : ''} share a key (listed under Individual).</>
              )}
            </p>
          </div>
        )}

        <div className="premium-card rounded-2xl p-1.5 flex gap-1 mb-8 w-full max-w-full overflow-x-auto mobile-clean-scroll">
          {(['summary', 'individual'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setView(tab)}
              className={`relative px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap shrink-0 ${view === tab ? 'text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'}`}
            >
              {view === tab && (
                <motion.div
                  layoutId="viewTab"
                  className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl shadow-lg"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {tab === 'summary' ? 'Summary (numbers + charts)' : `Individual (${responses.length})`}
              </span>
            </button>
          ))}
        </div>

        {responses.length === 0 ? (
          <div className="premium-panel rounded-3xl p-16 text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-600 mb-2">No responses yet</h3>
            <p className="text-gray-400">Share the form link to start collecting responses.</p>
          </div>
        ) : view === 'summary' ? (
          <div className="space-y-6">
            {fields.map(field => {
              const summary = getFieldSummary(field);
              const isChoice = summary.type === 'choice' || summary.type === 'multi';
              const entries = isChoice
                ? Object.entries(summary.counts).sort((a, b) => b[1] - a[1])
                : [];
              const colors = pieColors(entries.length);
              const slices = entries.map(([label, value], i) => ({ label, value, color: colors[i] }));

              return (
                <div key={field.id} className="premium-panel rounded-2xl p-5 sm:p-6 shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-gray-800">{field.label}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {field.field_type.replace(/_/g, ' ')} · {summary.total} answer{summary.total !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {isChoice && (
                    <div className="flex flex-col lg:flex-row gap-6 items-start">
                      <div className="shrink-0 mx-auto lg:mx-0">
                        <SimplePieChart slices={slices} size={180} />
                      </div>
                      <div className="flex-1 w-full space-y-3 min-w-0">
                        {entries.map(([option, count], i) => {
                          const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                          return (
                            <div key={option}>
                              <div className="flex items-center justify-between text-sm mb-1.5 gap-2">
                                <span className="text-gray-700 font-medium flex items-center gap-2 min-w-0">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colors[i] }} />
                                  <span className="truncate">{option}</span>
                                </span>
                                <span className="text-gray-600 text-xs font-semibold tabular-nums shrink-0">
                                  {count} · {pct}%
                                </span>
                              </div>
                              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${pct}%`, background: colors[i] }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-xs text-gray-400 pt-1">
                          {summary.type === 'multi'
                            ? 'Counts are selections (one person can add multiple).'
                            : `${summary.total} of ${responses.length} people answered this question.`}
                        </p>
                      </div>
                    </div>
                  )}

                  {summary.type === 'number' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Answers', value: summary.total },
                        { label: 'Average', value: summary.avg },
                        { label: 'Min', value: summary.min },
                        { label: 'Max', value: summary.max },
                      ].map((s) => (
                        <div key={s.label} className="bg-indigo-50 rounded-xl p-4 text-center">
                          <p className="text-xl font-extrabold text-indigo-700">{s.value}</p>
                          <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {summary.type === 'text' && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 mb-2">All {summary.values.length} answers</p>
                      {summary.values.length === 0 ? (
                        <p className="text-gray-400 text-sm">No responses</p>
                      ) : (
                        <ul className="max-h-[28rem] overflow-y-auto space-y-2 pr-1">
                          {summary.values.map((val, i) => (
                            <li
                              key={`${field.id}-${i}`}
                              className="bg-gradient-to-r from-gray-50 to-white rounded-xl px-4 py-2.5 text-sm text-gray-700 border border-gray-100 flex gap-3"
                            >
                              <span className="text-gray-300 text-xs font-semibold tabular-nums w-6 shrink-0 pt-0.5">{i + 1}</span>
                              <span className="break-words min-w-0">{val}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or mobile…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 premium-input rounded-2xl text-sm transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !expandAll;
                  setExpandAll(next);
                  setExpandedResponse(next ? 'all' : null);
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/70 border border-gray-200 text-gray-700 hover:bg-white shrink-0"
              >
                {expandAll || expandedResponse === 'all' ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Showing {filteredResponses.length} of {responses.length} responses
            </p>
            <div className="space-y-3">
              {filteredResponses.map((response, idx) => {
                const isExpanded = expandAll || expandedResponse === 'all' || expandedResponse === response.id;
                const displayName = getResponderDisplayName(response.responses, fields, response.user);
                const displayEmail = getResponderDisplayEmail(response.responses, fields, response.user);
                const displayMobile = getResponderDisplayMobile(response.responses, fields);
                const dupe = duplicateMeta.responseFlags.get(response.id);
                return (
                  <div key={response.id} className="premium-panel rounded-2xl overflow-hidden shadow-md">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandAll(false);
                        setExpandedResponse(isExpanded && expandedResponse === response.id ? null : response.id);
                      }}
                      className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-white/40 transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                          {(displayName || 'A')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate flex items-center gap-2 flex-wrap">
                            <span className="text-gray-300 text-xs font-semibold tabular-nums">#{idx + 1}</span>
                            {displayName}
                            {response.is_test && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                TEST
                              </span>
                            )}
                            {dupe && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                                Duplicate {dupe.type} ({dupe.count}×)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {[displayEmail || null, displayMobile || null, new Date(response.submitted_at || response.created_at).toLocaleString()]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 sm:px-5 pb-5 space-y-3 border-t border-gray-100">
                            {fields.map(field => {
                              const val = response.responses?.[field.label];
                              return (
                                <div key={field.id} className="pt-3">
                                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{field.label}</p>
                                  {field.field_type === 'file' && val ? (
                                    <a href={supabase.storage.from('documents').getPublicUrl(val).data.publicUrl} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-600 font-medium">
                                      <ExternalLink className="w-3.5 h-3.5" /> Download File
                                    </a>
                                  ) : (
                                    <p className="text-sm text-gray-800 break-words">{Array.isArray(val) ? val.join(', ') : val || <span className="text-gray-300">—</span>}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
