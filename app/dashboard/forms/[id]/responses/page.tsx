'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Download, BarChart3, Users, FileText, Search, ChevronDown, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  getResponderDisplayEmail,
  getResponderDisplayName,
} from '@/lib/form-responder-fields';

interface FormField {
  id: string;
  field_type: string;
  label: string;
  options?: string[];
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export default function FormResponsesPage() {
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canView, setCanView] = useState(false);
  const [view, setView] = useState<'summary' | 'individual'>('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);
  const params = useParams();
  const supabase = createClient();

  useEffect(() => { checkAccess(); }, []);

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin, is_faculty, executive_role, committee_members(committee_id)')
      .eq('id', user.id).single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      // Still try to load data even if profile check fails
      setCanView(true);
      fetchData();
      return;
    }

    const p = profile as any;
    const hasAccess = p?.is_admin || p?.is_faculty || p?.executive_role || (p?.committee_members?.length > 0);
    setCanView(hasAccess);
    if (hasAccess) fetchData(); else setLoading(false);
  }

  async function fetchData() {
    const { data: formData, error: formError } = await supabase.from('forms').select('*').eq('id', params.id).single();

    if (formError) {
      console.error('Error fetching form:', formError);
    }

    // Get all responses
    const { data: responsesData, error: respError } = await supabase
      .from('form_responses')
      .select('*')
      .eq('form_id', params.id)
      .order('created_at', { ascending: false });

    // If RLS blocks the query, responsesData will be null/empty - that's ok
    if (respError) {
      console.error('Responses query error:', respError.message, respError.code);
    }

    // Fetch user profiles for responses that have user_id
    const userIds = [...new Set((responsesData || []).map((r: { user_id: string | null }) => r.user_id).filter(Boolean))];
    let userMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);
      users?.forEach((u: { id: string }) => { userMap[u.id] = u; });
    }

    // Attach user data to responses
    const enriched = (responsesData || []).map((r: { user_id?: string | null }) => ({
      ...r,
      user: r.user_id ? userMap[r.user_id] || { name: 'Unknown', email: '' } : null,
    }));

    setForm(formData);
    setFields(formData?.fields || []);
    setResponses(enriched);
    setLoading(false);
  }

  function getFieldSummary(field: FormField) {
    const vals = responses.map(r => r.responses?.[field.label]).filter(Boolean);
    if (['radio', 'dropdown'].includes(field.field_type) && field.options) {
      const counts: Record<string, number> = {};
      field.options.forEach(o => { counts[o] = 0; });
      vals.forEach(v => { if (typeof v === 'string') counts[v] = (counts[v] || 0) + 1; });
      return { type: 'choice' as const, counts, total: vals.length };
    }
    if (field.field_type === 'checkbox' && field.options) {
      const counts: Record<string, number> = {};
      field.options.forEach(o => { counts[o] = 0; });
      vals.forEach(v => { if (Array.isArray(v)) v.forEach(item => { counts[item] = (counts[item] || 0) + 1; }); });
      return { type: 'multi' as const, counts, total: vals.length };
    }
    if (field.field_type === 'number') {
      const nums = vals.map(Number).filter(n => !isNaN(n));
      if (nums.length === 0) return { type: 'text' as const, values: [] };
      return { type: 'number' as const, avg: (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1), min: Math.min(...nums), max: Math.max(...nums), total: nums.length };
    }
    return { type: 'text' as const, values: vals.slice(0, 10) };
  }

  function exportCSV() {
    if (responses.length === 0) { toast.error('No responses to export'); return; }
    const headers = ['Submitted At', 'Name', 'Email', ...fields.map(f => f.label)];
    const rows = responses.map(r => [
      new Date(r.submitted_at || r.created_at).toLocaleString(),
      getResponderDisplayName(r.responses, fields, r.user),
      getResponderDisplayEmail(r.responses, fields, r.user) || '-',
      ...fields.map(f => { const val = r.responses?.[f.label]; return Array.isArray(val) ? val.join('; ') : val ?? ''; }),
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${form?.title || 'form'}-responses.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  }

  const filteredResponses = searchTerm
    ? responses.filter(r => {
      const t = searchTerm.toLowerCase();
      const name = getResponderDisplayName(r.responses, fields, r.user).toLowerCase();
      const email = getResponderDisplayEmail(r.responses, fields, r.user).toLowerCase();
      return name.includes(t) || email.includes(t);
    })
    : responses;

  if (loading) return <PortalLoadingScreen message="Loading forms…" />;

  if (!canView) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="premium-panel rounded-3xl p-12 text-center max-w-md shadow-2xl">
          <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-400">You don't have permission to view responses.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh py-8 px-4 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-pink-400/8 to-violet-400/8 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <Link href="/dashboard/forms" className="text-indigo-400 hover:text-indigo-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-gradient tracking-tight">{form?.title}</h1>
              <p className="text-gray-400 text-sm">{responses.length} response{responses.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={exportCSV}
            className="btn-gradient-green px-5 py-2.5 rounded-2xl flex items-center gap-2 text-sm font-semibold shadow-lg shadow-emerald-500/20"
          >
            <Download className="w-4 h-4" /> Export CSV
          </motion.button>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
        >
          {[
            { icon: Users, value: responses.length, label: 'Total Responses', gradient: 'from-indigo-500 to-purple-500', glow: 'glow-purple' },
            { icon: FileText, value: fields.length, label: 'Questions', gradient: 'from-emerald-500 to-green-500', glow: 'glow-green' },
            { icon: BarChart3, value: responses.length > 0 ? new Date(responses[0].submitted_at || responses[0].created_at).toLocaleDateString() : '-', label: 'Latest Response', gradient: 'from-amber-500 to-orange-500', glow: 'glow-amber' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              variants={item}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`premium-panel rounded-2xl p-5 flex items-center gap-4 shadow-md ${stat.glow}`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-gray-800">{stat.value}</p>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* View Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="premium-card rounded-2xl p-1.5 flex gap-1 mb-8 w-full max-w-full overflow-x-auto mobile-clean-scroll"
        >
          {(['summary', 'individual'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`relative px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap shrink-0 ${view === tab ? 'text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'
                }`}
            >
              {view === tab && (
                <motion.div
                  layoutId="viewTab"
                  className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl shadow-lg"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {tab === 'summary' ? 'Summary' : `Individual (${responses.length})`}
              </span>
            </button>
          ))}
        </motion.div>

        {responses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="premium-panel rounded-3xl p-16 text-center"
          >
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            </motion.div>
            <h3 className="text-xl font-bold text-gray-600 mb-2">No responses yet</h3>
            <p className="text-gray-400">Share the form link to start collecting responses.</p>
          </motion.div>
        ) : view === 'summary' ? (
          /* ===== SUMMARY VIEW ===== */
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
            {fields.map(field => {
              const summary = getFieldSummary(field);
              return (
                <motion.div key={field.id} variants={item} className="premium-panel rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow">
                  <h3 className="text-base font-bold text-gray-800 mb-4">{field.label}</h3>

                  {(summary.type === 'choice' || summary.type === 'multi') && (
                    <div className="space-y-3">
                      {Object.entries(summary.counts).map(([option, count]) => {
                        const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                        return (
                          <div key={option}>
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <span className="text-gray-600 font-medium">{option}</span>
                              <span className="text-gray-400 text-xs">{count} ({pct}%)</span>
                            </div>
                            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                              />
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-xs text-gray-400 mt-2">{summary.total} response{summary.total !== 1 ? 's' : ''}</p>
                    </div>
                  )}

                  {summary.type === 'number' && (
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Average', value: summary.avg, color: 'from-indigo-500 to-blue-500', bg: 'bg-indigo-50' },
                        { label: 'Min', value: summary.min, color: 'from-emerald-500 to-green-500', bg: 'bg-emerald-50' },
                        { label: 'Max', value: summary.max, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50' },
                      ].map((s, i) => (
                        <motion.div key={i} whileHover={{ y: -2 }} className={`${s.bg} rounded-xl p-4 text-center`}>
                          <p className="text-xl font-extrabold text-gradient">{s.value}</p>
                          <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {summary.type === 'text' && (
                    <div className="space-y-2">
                      {summary.values.length === 0 ? (
                        <p className="text-gray-400 text-sm">No responses</p>
                      ) : (
                        summary.values.map((val, i) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                            className="bg-gradient-to-r from-gray-50 to-white rounded-xl px-4 py-2.5 text-sm text-gray-700 border border-gray-100">
                            {String(val)}
                          </motion.div>
                        ))
                      )}
                      {responses.length > 10 && summary.values.length === 10 && (
                        <p className="text-xs text-gray-400">Showing 10 of {responses.length}</p>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          /* ===== INDIVIDUAL VIEW ===== */
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text" placeholder="Search by name or email..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 premium-input rounded-2xl text-sm transition-all"
                />
              </div>
            </motion.div>
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
              {filteredResponses.map((response) => {
                const isExpanded = expandedResponse === response.id;
                const displayName = getResponderDisplayName(response.responses, fields, response.user);
                const displayEmail = getResponderDisplayEmail(response.responses, fields, response.user);
                return (
                  <motion.div key={response.id} variants={item} className="premium-panel rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                    <button
                      onClick={() => setExpandedResponse(isExpanded ? null : response.id)}
                      className="w-full flex items-center justify-between p-5 text-left hover:bg-white/40 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {(displayName || 'A')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{displayName}</p>
                          <p className="text-xs text-gray-400">{displayEmail || 'No email'} · {new Date(response.submitted_at || response.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
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
                                    <p className="text-sm text-gray-800">{Array.isArray(val) ? val.join(', ') : val || <span className="text-gray-300">—</span>}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
