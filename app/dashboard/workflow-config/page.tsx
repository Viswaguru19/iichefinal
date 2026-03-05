'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Settings, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WorkflowConfigPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  // Approval Threshold Settings
  const [headApprovalsRequired, setHeadApprovalsRequired] = useState(1);
  const [ecApprovalMode, setEcApprovalMode] = useState('any_one_secretary');
  const [ecApprovalsRequired, setEcApprovalsRequired] = useState(1);

  // Event Visibility Settings
  const [eventVisibilityToOtherCommittees, setEventVisibilityToOtherCommittees] = useState('after_active');

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

      if (config.workflow_type === 'approval_thresholds') {
        setHeadApprovalsRequired(settings.head_approvals_required ?? 1);
        setEcApprovalMode(settings.ec_approval_mode ?? 'any_one_secretary');
        setEcApprovalsRequired(settings.ec_approvals_required ?? 1);
      }

      if (config.workflow_type === 'event_visibility') {
        setEventVisibilityToOtherCommittees(settings.visibility_to_other_committees ?? 'after_active');
      }

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
          workflow_type: 'approval_thresholds',
          config: {
            head_approvals_required: headApprovalsRequired,
            ec_approval_mode: ecApprovalMode,
            ec_approvals_required: ecApprovalsRequired
          }
        }, { onConflict: 'workflow_type' });

      await (supabase as any)
        .from('workflow_config')
        .upsert({
          workflow_type: 'event_visibility',
          config: {
            visibility_to_other_committees: eventVisibilityToOtherCommittees
          }
        }, { onConflict: 'workflow_type' });

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
          {/* Approval Thresholds */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Approval Thresholds</h2>

            {/* Head Approvals Required */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Head Approvals Required
              </label>
              <select
                value={headApprovalsRequired}
                onChange={(e) => setHeadApprovalsRequired(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value={1}>1 - Single Head Approval</option>
                <option value={2}>2 - Both Head and Co-Head Approval</option>
              </select>
              <p className="text-sm text-gray-600 mt-1">
                Number of committee head approvals needed before moving to EC
              </p>
            </div>

            {/* EC Approval Mode */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                EC Approval Mode
              </label>
              <select
                value={ecApprovalMode}
                onChange={(e) => setEcApprovalMode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="any_one_secretary">
                  Any one of (Secretary, Associate Secretary, Joint Secretary, Associate Joint Secretary)
                </option>
                <option value="one_from_each_tier">
                  1 from (Secretary or Associate Secretary) AND 1 from (Joint Secretary or Associate Joint Secretary)
                </option>
                <option value="all_four">
                  All 4 must approve (Secretary, Associate Secretary, Joint Secretary, Associate Joint Secretary)
                </option>
              </select>
              <p className="text-sm text-gray-600 mt-1">
                How EC members must approve proposals
              </p>
            </div>

            {/* EC Approvals Required (for any_one_secretary mode) */}
            {ecApprovalMode === 'any_one_secretary' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of EC Approvals Required
                </label>
                <select
                  value={ecApprovalsRequired}
                  onChange={(e) => setEcApprovalsRequired(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value={1}>1 EC Member</option>
                  <option value={2}>2 EC Members</option>
                  <option value={3}>3 EC Members</option>
                  <option value={4}>4 EC Members (All)</option>
                </select>
                <p className="text-sm text-gray-600 mt-1">
                  How many EC members must approve in "any one" mode
                </p>
              </div>
            )}

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 font-medium">Current Configuration:</p>
              <ul className="text-sm text-blue-800 mt-2 space-y-1">
                <li>• Head Approvals: {headApprovalsRequired === 1 ? 'Single Head' : 'Head + Co-Head'}</li>
                <li>• EC Mode: {
                  ecApprovalMode === 'any_one_secretary' ? `Any ${ecApprovalsRequired} EC member(s)` :
                    ecApprovalMode === 'one_from_each_tier' ? '1 from each tier' :
                      'All 4 EC members'
                }</li>
              </ul>
            </div>
          </div>

          {/* Event Visibility Settings */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Event Visibility to Other Committees</h2>
            <p className="text-sm text-gray-600 mb-4">
              Control when events become visible to committees other than the proposing committee
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Visibility Setting
              </label>
              <select
                value={eventVisibilityToOtherCommittees}
                onChange={(e) => setEventVisibilityToOtherCommittees(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="once_proposed">
                  Visible immediately after proposal (pending_head_approval)
                </option>
                <option value="after_head_approval">
                  Visible after head approval (pending_ec_approval)
                </option>
                <option value="after_active">
                  Visible only after EC approval (active)
                </option>
              </select>
              <p className="text-sm text-gray-600 mt-2">
                {eventVisibilityToOtherCommittees === 'once_proposed' &&
                  '📢 All committees can see events as soon as they are proposed'}
                {eventVisibilityToOtherCommittees === 'after_head_approval' &&
                  '👀 All committees can see events after committee head approves'}
                {eventVisibilityToOtherCommittees === 'after_active' &&
                  '🔒 Only proposing committee sees events until EC approves and activates'}
              </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 font-medium mb-2">Note:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Proposing committee always sees their own events at all stages</li>
                <li>• EC members always see all events for approval purposes</li>
                <li>• Admins always see all events</li>
                <li>• This setting only affects visibility to OTHER committees</li>
              </ul>
            </div>
          </div>

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
