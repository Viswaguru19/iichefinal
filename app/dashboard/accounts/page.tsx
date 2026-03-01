'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Plus, Filter } from 'lucide-react';
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
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    checkPermissions();
    fetchData();
  }, [filterYear, filterEvent]);

  async function checkPermissions() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('executive_role, role')
      .eq('id', user.id)
      .single();

    const canView = 
      profile?.role === 'super_admin' ||
      ['committee_head', 'committee_cohead'].includes(profile?.role || '') ||
      profile?.executive_role !== null;

    if (!canView) {
      window.location.href = '/dashboard';
      return;
    }

    setCanManage(
      profile?.role === 'super_admin' ||
      ['treasurer', 'secretary', 'associate_treasurer'].includes(profile?.executive_role || '')
    );
  }

  async function fetchData() {
    setLoading(true);

    let query = supabase
      .from('statement_of_accounts')
      .select('*')
      .order('date', { ascending: true });

    if (filterYear !== 'all') {
      query = query.eq('year', parseInt(filterYear));
    }
    if (filterEvent !== 'all') {
      query = query.eq('event', filterEvent);
    }

    const { data: txns } = await query;

    const { data: summaryData } = await supabase.rpc('get_finance_summary');

    setTransactions(txns || []);
    if (summaryData && summaryData.length > 0) {
      setSummary(summaryData[0]);
    }
    setLoading(false);
  }

  async function handleAddTransaction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const date = formData.get('date') as string;
    const dateObj = new Date(date);
    const month = dateObj.toLocaleString('default', { month: 'long' });
    const year = dateObj.getFullYear();

    const debit = parseFloat(formData.get('debit') as string) || 0;
    const credit = parseFloat(formData.get('credit') as string) || 0;

    const lastBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;
    const newBalance = lastBalance + credit - debit;

    const { error } = await supabase
      .from('statement_of_accounts')
      .insert({
        sr_no: transactions.length + 1,
        date,
        month,
        year,
        event: formData.get('event'),
        item: formData.get('item'),
        debit,
        credit,
        balance: newBalance
      });

    if (error) {
      toast.error('Failed to add transaction');
    } else {
      toast.success('Transaction added');
      setShowAddModal(false);
      fetchData();
    }
  }

  const years = Array.from(new Set(transactions.map(t => t.year))).sort();
  const events = Array.from(new Set(transactions.map(t => t.event)));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Statement of Accounts</h1>
              <p className="text-gray-600 dark:text-gray-400">IIChE AVVU Student Chapter</p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Transaction
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="text-green-800 dark:text-green-300 text-sm font-medium mb-2">Total Income</h3>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">₹{summary.total_income.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border border-red-200 dark:border-red-800">
            <h3 className="text-red-800 dark:text-red-300 text-sm font-medium mb-2">Total Expense</h3>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">₹{summary.total_expense.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-blue-800 dark:text-blue-300 text-sm font-medium mb-2">Balance Fund</h3>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">₹{summary.balance.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6 flex gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Years</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <select
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Events</option>
            {events.map(event => (
              <option key={event} value={event}>{event}</option>
            ))}
          </select>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Sr No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Month</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Year</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Item</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Credit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{txn.sr_no}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{new Date(txn.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{txn.month}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{txn.year}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{txn.event}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{txn.item}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">
                      {txn.debit > 0 ? `₹${txn.debit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                      {txn.credit > 0 ? `₹${txn.credit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-blue-600 dark:text-blue-400">
                      ₹{txn.balance.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Transaction</h2>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input type="date" name="date" required className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event</label>
                <input type="text" name="event" required className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item</label>
                <input type="text" name="item" required className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Debit (₹)</label>
                  <input type="number" name="debit" step="0.01" min="0" defaultValue="0" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Credit (₹)</label>
                  <input type="number" name="credit" step="0.01" min="0" defaultValue="0" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Add
                </button>
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
