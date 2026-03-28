'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Settings, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  normalizeProposalThresholds,
  type ProposalEcApprovalMode,
  type ProposalHeadApprovalMode,
  describeProposalThresholds,
} from '@/lib/proposal-workflow-rules';

export default function WorkflowConfigPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [proposalHeadApproval, setProposalHeadApproval] = useState<ProposalHeadApprovalMode>('single_head');
  const [proposalEcApproval, setProposalEcApproval] = useState<ProposalEcApprovalMode>('any_one_secretariat');

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
    const { data: row } = await supabase
      .from('workflow_config')
      .select('config')
      .eq('workflow_type', 'approval_thresholds')
      .maybeSingle();

    const n = normalizeProposalThresholds((row as any)?.config);
    setProposalHeadApproval(n.proposal_head_approval);
    setProposalEcApproval(n.proposal_ec_approval);
  }

  async function handleSave() {
    setLoading(true);
    try {
      await (supabase as any)
        .from('workflow_config')
        .upsert(
          {
            workflow_type: 'approval_thresholds',
            config: {
              proposal_head_approval: proposalHeadApproval,
              proposal_ec_approval: proposalEcApproval,
            },
          },
          { onConflict: 'workflow_type' },
        );

      toast.success('Proposal workflow saved');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isSuperAdmin) return null;

  const summary = describeProposalThresholds({
    proposal_head_approval: proposalHeadApproval,
    proposal_ec_approval: proposalEcApproval,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Workflow configuration
            </h1>
            <button type="button" onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">
              ← Back
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <p className="text-sm text-gray-600">
          These settings apply to <strong>event proposals</strong> (head → executive committee → faculty). They do not change
          task workflows, hiring, or committee visibility.
        </p>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">1. Head approval for proposals</h2>
            <p className="text-sm text-gray-600 mb-3">What must happen before an event is sent to the EC for review?</p>
            <select
              value={proposalHeadApproval}
              onChange={(e) => setProposalHeadApproval(e.target.value as ProposalHeadApprovalMode)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="single_head">
                Any one head approval from the same committee → proposal goes straight to EC
              </option>
              <option value="two_heads">
                Two committee heads must approve (two different people with the head role) before the proposal goes to EC
              </option>
            </select>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">2. EC approval for proposals</h2>
            <p className="text-sm text-gray-600 mb-3">
              Only these executive roles count: Secretary, Associate Secretary, Joint Secretary, Associate Joint Secretary.
              Treasurer and other EC roles do not count toward proposal EC approval.
            </p>
            <select
              value={proposalEcApproval}
              onChange={(e) => setProposalEcApproval(e.target.value as ProposalEcApprovalMode)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="any_one_secretariat">
                Any one approval from the four roles above
              </option>
              <option value="tiered_pair">
                One from Secretary or Associate Secretary, and one from Joint Secretary or Associate Joint Secretary
              </option>
            </select>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 space-y-2">
            <p className="font-semibold text-slate-900">Summary</p>
            <p>• {summary.head}</p>
            <p>• {summary.ec}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
