'use client';

import PremiumInteractiveProgress from '@/components/events/PremiumInteractiveProgress';

export default function TestUltraPremiumPage() {
    const sampleCommitteeTasks = [
        {
            committee_name: 'Technical Committee',
            total_tasks: 10,
            completed_tasks: 7,
            in_progress_tasks: 2,
            not_started_tasks: 1
        },
        {
            committee_name: 'Marketing & Publicity',
            total_tasks: 6,
            completed_tasks: 3,
            in_progress_tasks: 2,
            not_started_tasks: 1
        },
        {
            committee_name: 'Finance & Sponsorship',
            total_tasks: 5,
            completed_tasks: 1,
            in_progress_tasks: 2,
            not_started_tasks: 2
        },
        {
            committee_name: 'Logistics & Operations',
            total_tasks: 8,
            completed_tasks: 2,
            in_progress_tasks: 4,
            not_started_tasks: 2
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
                        Ultra-Premium Interactive Progress Bar
                    </h1>
                    <p className="text-gray-600 text-lg">
                        With dark mode, animations, hover effects, and interactive elements
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Annual Tech Fest 2024
                    </h2>
                    <p className="text-gray-600 mb-6">
                        A major technical event with 4 committees working together
                    </p>

                    <PremiumInteractiveProgress
                        committeeTasks={sampleCommitteeTasks}
                        eventDate="2024-03-25T10:00:00Z"
                    />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-blue-900 mb-3">
                            ✨ Premium Features
                        </h3>
                        <ul className="space-y-2 text-sm text-blue-800">
                            <li>🌓 Light/Dark mode toggle</li>
                            <li>🎨 Animated gradient backgrounds</li>
                            <li>✨ Particle effects on progress bar</li>
                            <li>🎭 Hover effects with glow</li>
                            <li>🔄 Rotating icons and animations</li>
                            <li>📊 Interactive committee cards</li>
                            <li>💫 Shimmer effects</li>
                            <li>🎯 Click to expand details</li>
                            <li>📈 Real-time progress tracking</li>
                            <li>🌈 Gradient text and elements</li>
                        </ul>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-purple-900 mb-3">
                            🎬 Animations
                        </h3>
                        <ul className="space-y-2 text-sm text-purple-800">
                            <li>• Staggered entrance animations</li>
                            <li>• Smooth progress bar fills</li>
                            <li>• Rotating calendar icon</li>
                            <li>• Pulsing percentage display</li>
                            <li>• Floating particles</li>
                            <li>• Shimmer sweep effect</li>
                            <li>• Scale on hover</li>
                            <li>• Spinning clock for active tasks</li>
                            <li>• Bouncing stat cards</li>
                            <li>• Smooth theme transitions</li>
                        </ul>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <a
                        href="/dashboard/events/progress"
                        className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
                    >
                        Go to Event Progress Page →
                    </a>
                    <p className="text-sm text-gray-500 mt-3">
                        Requires Supabase connection and logged-in user
                    </p>
                </div>
            </div>
        </div>
    );
}
