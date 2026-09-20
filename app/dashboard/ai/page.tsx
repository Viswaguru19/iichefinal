'use client';

import PageHeader from '@/components/PageHeader';
import DashboardAtmosphere from '@/components/react-bits/DashboardAtmosphere';
import IicheAiChat from '@/components/iiche-ai/IicheAiChat';

export default function IicheAiPage() {
  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      <DashboardAtmosphere />
      <PageHeader title="IIChE AI" gradientTitle />
      <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        <div className="premium-card rounded-2xl p-5 sm:p-6">
          <p className="iiche-ai-muted text-sm mb-4">
            General questions, research help, event ideas, and portal actions (forms, meetings, reports, minutes).
          </p>
          <IicheAiChat />
        </div>
      </div>
    </div>
  );
}
