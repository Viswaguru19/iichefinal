'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Filter, Upload, FileText, ExternalLink, X, Pencil, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Transaction {
  id: string;
  sr_no: number;
  date: string;
  month: string;
  year: number;
  event: string;
  item: string;
  debit: number;
  credit: number;
  balance: number;
  bill_url?: string | null;
}

interface Summary {
  total_income: number;
  total_expense: number;
  balance: number;
}

export default function StatementOfAccountsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_income: 0, total_expense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [tableRefreshing, setTableRefreshing] = useState(false);
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  /** Add / edit / delete / attach bills — treasurer, associate treasurer, or faculty only. */
  const [canManage, setCanManage] = useState(false);
  const [uploadingBill, setUploadingBill] = useState<string | null>(null);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [deletingTxn, setDeletingTxn] = useState<Transaction | null>(null);
  const billInputRef = useRef<HTMLInputElement>(null);
  const billTxnIdRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef(false);

  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const fetchStatements = useCallback(async () => {
    let query = supabase.from('statement_of_accounts').select('*').order('date', { ascending: true });
    if (filterYear !== 'all') query = query.eq('year', parseInt(filterYear, 10));
    if (filterEvent !== 'all') query = query.eq('event', filterEvent);
    const { data: txns } = await query;
    const { data: summaryData }: { data: any } = await supabase.rpc('get_finance_summary');
    setTransactions(txns || []);
    if (summaryData && summaryData.length > 0) setSummary(summaryData[0]);
  }, [supabase, filterYear, filterEvent]);

  const reloadAfterMutation = useCallback(async () => {
    setTableRefreshing(true);
    try {
      await fetchStatements();
    } finally {
      setTableRefreshing(false);
    }
  }, [fetchStatements]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: profile }: { data: any } = await supabase
        .from('profiles')
        .select('executive_role, role, is_faculty, is_admin')
        .eq('id', user.id)
        .single();

      if (cancelled) return;

      if (!profile) {
        router.replace('/dashboard');
        return;
      }

      // Any signed-in user with a profile may view (RLS also allows all authenticated SELECT).
      const exec = String(profile.executive_role || '')
        .trim()
        .toLowerCase();
      setCanManage(
        profile.is_faculty === true ||
          exec === 'treasurer' ||
          exec === 'associate_treasurer',
      );

      const isFirstLoad = !initialLoadDoneRef.current;
      if (isFirstLoad) {
        setLoading(true);
      } else {
        setTableRefreshing(true);
      }

      await fetchStatements();

      if (cancelled) return;

      initialLoadDoneRef.current = true;
      setLoading(false);
      setTableRefreshing(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [fetchStatements, router, supabase]);

  async function handleAddTransaction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) {
      toast.error('Only Treasurer, Associate Treasurer, or Faculty can add transactions');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    const dateObj = new Date(date);
    const month = dateObj.toLocaleString('default', { month: 'long' });
    const year = dateObj.getFullYear();
    const debit = parseFloat(formData.get('debit') as string) || 0;
    const credit = parseFloat(formData.get('credit') as string) || 0;
    const lastBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;
    const newBalance = lastBalance + credit - debit;

    // Upload bill if provided
    let billUrl: string | null = null;
    const billFile = formData.get('bill') as File;
    if (billFile && billFile.size > 0) {
      const ext = billFile.name.split('.').pop();
      const path = `bills/${year}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, billFile);
      if (upErr) { toast.error('Failed to upload bill'); return; }
      const { data } = supabase.storage.from('documents').getPublicUrl(path);
      billUrl = data.publicUrl;
    }

    const { error } = await supabase.from('statement_of_accounts').insert({
      sr_no: transactions.length + 1, date, month, year,
      event: formData.get('event'), item: formData.get('item'),
      debit, credit, balance: newBalance, bill_url: billUrl,
    } as any);

    if (error) toast.error('Failed to add transaction');
    else { toast.success('Transaction added'); setShowAddModal(false); void reloadAfterMutation(); }
  }

  async function handleEditTransaction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) {
      toast.error('Only Treasurer, Associate Treasurer, or Faculty can edit');
      return;
    }
    if (!editingTxn) return;
    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    const dateObj = new Date(date);
    const month = dateObj.toLocaleString('default', { month: 'long' });
    const year = dateObj.getFullYear();
    const debit = parseFloat(formData.get('debit') as string) || 0;
    const credit = parseFloat(formData.get('credit') as string) || 0;

    let billUrl = editingTxn.bill_url || null;
    const billFile = formData.get('bill') as File;
    if (billFile && billFile.size > 0) {
      const ext = billFile.name.split('.').pop();
      const path = `bills/${year}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, billFile);
      if (upErr) { toast.error('Failed to upload bill'); return; }
      const { data } = supabase.storage.from('documents').getPublicUrl(path);
      billUrl = data.publicUrl;
    }

    const { error } = await supabase.from('statement_of_accounts').update({
      date, month, year, event: formData.get('event'), item: formData.get('item'),
      debit, credit, bill_url: billUrl,
    } as any).eq('id', editingTxn.id);

    if (error) toast.error('Failed to update');
    else { toast.success('Transaction updated'); setEditingTxn(null); void reloadAfterMutation(); }
  }

  async function handleDeleteTransaction() {
    if (!canManage) {
      toast.error('Only Treasurer, Associate Treasurer, or Faculty can delete');
      return;
    }
    if (!deletingTxn) return;
    const { error } = await supabase.from('statement_of_accounts').delete().eq('id', deletingTxn.id);
    if (error) toast.error('Failed to delete transaction');
    else { toast.success('Transaction deleted'); setDeletingTxn(null); void reloadAfterMutation(); }
  }

  async function uploadBillForTxn(txnId: string, file: File) {
    if (!canManage) {
      toast.error('Only Treasurer, Associate Treasurer, or Faculty can attach bills');
      return;
    }
    setUploadingBill(txnId);
    const ext = file.name.split('.').pop();
    const path = `bills/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
    if (upErr) { toast.error('Upload failed'); setUploadingBill(null); return; }
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    const { error } = await supabase.from('statement_of_accounts')
      .update({ bill_url: data.publicUrl } as any).eq('id', txnId);
    if (error) toast.error('Failed to save bill');
    else { toast.success('Bill attached'); void reloadAfterMutation(); }
    setUploadingBill(null);
  }

  const years = Array.from(new Set(transactions.map(t => t.year))).sort();
  const events = Array.from(new Set(transactions.map(t => t.event)));

  if (loading) return <PortalLoadingScreen message="Loading accounts…" />;

  return (
    <div className="min-h-screen bg-mesh py-8 px-4 relative overflow-hidden">
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-pink-400/8 to-violet-400/8 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-600 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-gradient tracking-tight">Statement of Accounts</h1>
              <p className="text-gray-400 text-sm">IIChE AVVU SC Student Chapter</p>
              {!canManage && (
                <p className="text-gray-500 text-xs mt-1">View only — edits are limited to Faculty, Treasurer, and Associate Treasurer.</p>
              )}
            </div>
          </div>
          {canManage && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 btn-gradient-blue px-4 py-2 rounded-xl font-semibold shadow-lg shadow-blue-500/20">
              <Plus className="w-5 h-5" /> Add Transaction
            </motion.button>
          )}
        </motion.div>

        {/* Summary Cards */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Total Income', value: summary.total_income, color: 'from-emerald-500 to-green-500', glow: 'glow-green', prefix: '₹' },
            { label: 'Total Expense', value: summary.total_expense, color: 'from-red-500 to-rose-500', glow: 'glow-rose', prefix: '₹' },
            { label: 'Balance Fund', value: summary.balance, color: 'from-indigo-500 to-purple-500', glow: 'glow-purple', prefix: '₹' },
          ].map((card, i) => (
            <motion.div key={i} whileHover={{ y: -4 }} className={`premium-panel rounded-2xl p-6 shadow-md ${card.glow}`}>
              <h3 className="text-gray-400 text-sm font-medium mb-2">{card.label}</h3>
              <p className="text-3xl font-extrabold text-gradient">{card.prefix}{card.value.toLocaleString('en-IN')}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="premium-card rounded-2xl p-4 mb-6 flex gap-4 items-center">
          <Filter className="w-5 h-5 text-gray-400" />
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm">
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm">
            <option value="all">All Events</option>
            {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
          </select>
        </motion.div>

        {/* Table */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="premium-panel rounded-2xl overflow-hidden shadow-md relative">
          {tableRefreshing && (
            <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" aria-hidden />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sr</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Credit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Balance</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Bill</th>
                  {canManage && <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map(txn => (
                  <tr key={txn.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700">{txn.sr_no}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{new Date(txn.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{txn.event}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{txn.item}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-500 font-medium">
                      {txn.debit > 0 ? `₹${txn.debit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-emerald-500 font-medium">
                      {txn.credit > 0 ? `₹${txn.credit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-indigo-600">
                      ₹{txn.balance.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {txn.bill_url ? (
                        <a href={txn.bill_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </a>
                      ) : canManage ? (
                        <button
                          onClick={() => { billTxnIdRef.current = txn.id; billInputRef.current?.click(); }}
                          disabled={uploadingBill === txn.id}
                          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" /> {uploadingBill === txn.id ? '...' : 'Add'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-center flex items-center justify-center gap-2">
                        <button onClick={() => setEditingTxn(txn)} className="text-gray-400 hover:text-indigo-600 transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeletingTxn(txn)} className="text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Hidden file input for attaching bills to existing transactions */}
      <input ref={billInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && billTxnIdRef.current) uploadBillForTxn(billTxnIdRef.current, file);
          e.target.value = '';
        }}
      />

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="premium-panel rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-extrabold text-gradient">Add Transaction</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
                  <input type="date" name="date" required className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Event</label>
                  <input type="text" name="event" required className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Item</label>
                  <input type="text" name="item" required className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Debit (₹)</label>
                    <input type="number" name="debit" step="0.01" min="0" defaultValue="0" className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Credit (₹)</label>
                    <input type="number" name="credit" step="0.01" min="0" defaultValue="0" className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Bill / Receipt (optional)</label>
                  <input type="file" name="bill" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 file:text-xs file:font-medium" />
                  <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DOC accepted</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className="flex-1 btn-gradient-blue px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md">
                    Add Transaction
                  </motion.button>
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-100 text-gray-600 px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {editingTxn && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="premium-panel rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-extrabold text-gradient">Edit Transaction</h2>
                <button onClick={() => setEditingTxn(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleEditTransaction} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
                  <input type="date" name="date" required defaultValue={editingTxn.date?.split('T')[0]} className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Event</label>
                  <input type="text" name="event" required defaultValue={editingTxn.event} className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Item</label>
                  <input type="text" name="item" required defaultValue={editingTxn.item} className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Debit (₹)</label>
                    <input type="number" name="debit" step="0.01" min="0" defaultValue={editingTxn.debit} className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Credit (₹)</label>
                    <input type="number" name="credit" step="0.01" min="0" defaultValue={editingTxn.credit} className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Bill / Receipt {editingTxn.bill_url ? '(replace existing)' : '(optional)'}
                  </label>
                  {editingTxn.bill_url && (
                    <a href={editingTxn.bill_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 mb-2">
                      <FileText className="w-3.5 h-3.5" /> Current bill attached
                    </a>
                  )}
                  <input type="file" name="bill" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 file:text-xs file:font-medium" />
                </div>
                <div className="flex gap-3 pt-2">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className="flex-1 btn-gradient-green px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md">
                    Save Changes
                  </motion.button>
                  <button type="button" onClick={() => setEditingTxn(null)} className="flex-1 bg-gray-100 text-gray-600 px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Delete Transaction Confirmation Modal */}
      <AnimatePresence>
        {deletingTxn && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="premium-panel rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <h2 className="text-xl font-extrabold text-red-600 mb-2">Delete Transaction</h2>
              <p className="text-gray-600 text-sm mb-1">Are you sure you want to delete this transaction?</p>
              <p className="text-gray-800 font-medium text-sm mb-4">Sr #{deletingTxn.sr_no} — {deletingTxn.event} / {deletingTxn.item}</p>
              <div className="flex gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleDeleteTransaction}
                  className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md hover:bg-red-700 transition-colors">
                  Delete
                </motion.button>
                <button type="button" onClick={() => setDeletingTxn(null)} className="flex-1 bg-gray-100 text-gray-600 px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
