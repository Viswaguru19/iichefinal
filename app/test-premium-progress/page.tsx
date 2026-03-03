'use client';

import PremiumProgressBar from '@/components/events/PremiumProgressBar';

export default function TestPremiumProgressPage() {
    // Sample data to test the premium progress bar
    const sampleStages = [
        {
            name: 'Proposed',
            status: 'completed' as const,
            approver: 'John Doe',
            approvedAt: '2024-01-15T10:00:00Z'
        },
        {
            name: 'Committee Head Approval',
            status: 'completed' as const,
            approver: 'Jane Smith',
            approvedAt: '2024-01-16T14:30:00Z'
        },
        {
            name: 'EC Approval (6 votes)',
            status: 'current' as const,
            approver: '4/6 approved',
            approvedAt: undefined
        },
        {
            name: 'Faculty Approval',
            status: 'pending' as const,
            approver: undefined,
            approvedAt: undefined
        },
        {
            name: 'Active',
            status: 'pending' as const,
            approver: undefined,
            approvedAt: undefined
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        🎨 Premium Progress Bar Test
                    </h1>
                    <p className="text-gray-600">
                        This page demonstrates the premium animated progress bar with framer-motion.
                    </p>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Sample Event: Annual Tech Fest 2024
                    </h2>
                    <p className="text-gray-600 mb-8">
                        A major technical event organized by the Technical Committee
                    </p>

                    <PremiumProgressBar stages={sampleStages} currentStage={2} />
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-blue-900 mb-3">
                        ✅ Features You Should See:
                    </h3>
                    <ul className="space-y-2 text-blue-800">
                        <li>✨ Gradient progress line (blue → purple → pink) that animates smoothly</li>
                        <li>💫 Stage nodes that pop in one by one</li>
                        <li>🔵 Current stage (EC Approval) with pulsing blue glow</li>
                        <li>🎯 Hover over any stage node to see it scale up</li>
                        <li>📋 Timeline view below with approval history</li>
                        <li>📊 Progress statistics cards at the bottom</li>
                        <li>⏰ Spinning clock icon on current stage</li>
                        <li>✅ Green checkmarks on completed stages</li>
                    </ul>
                </div>

                <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                        🔧 Technical Details
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="font-semibold text-gray-700">Component:</p>
                            <p className="text-gray-600 font-mono">components/events/PremiumProgressBar.tsx</p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-700">Animation Library:</p>
                            <p className="text-gray-600">framer-motion v12.34.4</p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-700">Used In:</p>
                            <p className="text-gray-600 font-mono">app/dashboard/events/progress/page.tsx</p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-700">Status:</p>
                            <p className="text-green-600 font-semibold">✅ Fully Implemented</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <a
                        href="/dashboard/events/progress"
                        className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
                    >
                        Go to Real Event Progress Page →
                    </a>
                    <p className="text-sm text-gray-500 mt-2">
                        (Requires Supabase connection and logged-in user)
                    </p>
                </div>
            </div>
        </div>
    );
}
