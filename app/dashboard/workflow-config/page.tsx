'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Settings, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WorkflowConfigPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  // Proposal Approval Settings
  const [requireDualHeadApproval, setRequireDualHeadApproval] = useState(true);
  const [notifyAllCommittees, setNotifyAllCommittees] = useState(true);
  const [requireFinanceApproval, setRequireFinanceApproval] = useState(false);

  // Task Assignment Settings
  const [allowInternalAssignment, setAllowInternalAssignment] = useState(true);
  const [requireDeadline, setRequireDeadline] = useState(true);

  // Hiring Settings
  const [hiringEnabled, setHiringEnabled] = useState(false);
  const [requireCommitteeHeadApproval, setRequireCommitteeHeadApproval] = useState(true);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    checkAccess();
    loadConfig();
  }, []);

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if ((profile as any)?.role !== 'super_admin') {
      toast.error('Access denied: Super Admin only');
      return router.push('/dashboard');
    }

    setIsSuperAdmin(true);
  }

  async function loadConfig() {
    const { data: configs } = await supabase
      .from('workflow_config')
      .select('*');

    configs?.forEach((config: any) => {
      const settings = config.config;

      if (config.workflow_type === 'proposal_approval') {
        setRequireDualHeadApproval(settings.require_dual_head_approval ?? true);
        setNotifyAllCommittees(settings.notify_all_committees ?? true);
        setRequireFinanceApproval(settings.require_finance_approval ?? false);
      }

      if (config.workflow_type === 'task_assignment') {
        setAllowInternalAssignment(settings.allow_internal_assignment ?? true);
        setRequireDeadline(settings.require_deadline ?? true);
      }

      if (config.workflow_type === 'hiring') {
        setHiringEnabled(settings.enabled ?? false);
        setRequireCommitteeHeadApproval(settings.require_committee_head_approval ?? true);
      }
    });
  }

  async function handleSave() {
    setLoading(true);
    try {
      await (supabase as any)
        .from('workflow_config')
        .upsert({
          workflow_type: 'proposal_approval',
          config: {
            require_dual_head_approval: requireDualHeadApproval,
            notify_all_committees: notifyAllCommittees,
            require_finance_approval: requireFinanceApproval
          }
        }, { onConflict: 'workflow_type' });

      await (supabase as any)
        .from('workflow_config')
        .upsert({
          workflow_type: 'task_assignment',
          config: {
            allow_internal_assignment: allowInternalAssignment,
            require_deadline: requireDeadline
          }
        }, { onConflict: 'workflow_type' });

      await (supabase as any)
        .from('workflow_config')
        .upsert({
          workflow_type: 'hiring',
          config: {
            enabled: hiringEnabled,
            require_committee_head_approval: requireCommitteeHeadApproval
          }
        }, { onConflict: 'workflow_type' });

      toast.success('Workflow configuration saved!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Workflow Configuration
            </h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Proposal Approval Workflow */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Event Proposal Approval</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={requireDualHeadApproval}
                  onChange={(e) => setRequireDualHeadApproval(e.target.checked)}
                  className="w-5 h-5"
                />
                <div>
                  <span className="font-medium text-gray-900">Require Dual Head Approval</span>
                  <p className="text-sm text-gray-600">Both committee heads must approve before executive review</p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notifyAllCommittees}
                  onChange={(e) => setNotifyAllCommittees(e.target.checked)}
                  className="w-5 h-5"
                />
                <div>
                  <span className="font-medium text-gray-900">Notify All Committees</span>
                  <p className="text-sm text-gray-600">Send notification to all committees when event is approved</p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={requireFinanceApproval}
                  onChange={(e) => setRequireFinanceApproval(e.target.checked)}
                  className="w-5 h-5"
                />
                <div>
                  <span className="font-medium text-gray-900">Require Finance Committee Approval</span>
                  <p className="text-sm text-gray-600">Finance committee must approve events with budget</p>
                </div>
              </label>
            </div>
          </div>

          {/* Task Assignment Workflow */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Task Assignment</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={allowInternalAssignment}
                  onChange={(e) => setAllowInternalAssignment(e.target.checked)}
                  className="w-5 h-5"
                />
                <div>
                  <span className="font-medium text-gray-900">Allow Internal Committee Assignment</span>
                  <p className="text-sm text-gray-600">Committee heads can assign tasks within their committee</p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={requireDeadline}
                  onChange={(e) => setRequireDeadline(e.target.checked)}
                  className="w-5 h-5"
                />
                <div>
                  <span className="font-medium text-gray-900">Require Task Deadline</span>
                  <p className="text-sm text-gray-600">All tasks must have a deadline</p>
                </div>
              </label>
            </div>
          </div>

          {/* Hiring Workflow */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Hiring & Member Approval</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={hiringEnabled}
                  onChange={(e) => setHiringEnabled(e.target.checked)}
                  className="w-5 h-5"
                />
                <div>
                  <span className="font-medium text-gray-900">Enable Hiring Mode</span>
                  <p className="text-sm text-gray-600">Allow new member applications and approvals</p>
                </div>
              </label>

              {hiringEnabled && (
                <label className="flex items-center gap-3 ml-8">
                  <input
                    type="checkbox"
                    checked={requireCommitteeHeadApproval}
                    onChange={(e) => setRequireCommitteeHeadApproval(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Require Committee Head & Co-Head Approval</span>
                    <p className="text-sm text-gray-600">New members must be approved by both head and co-head</p>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
