'use client';

import NotionProgressBar from '@/components/events/NotionProgressBar';

export default function TestNotionProgressPage() {
    // Sample data with committees and their tasks
    const sampleCommitteeTasks = [
        {
            committee_name: 'Technical Committee',
            total_tasks: 8,
            completed_tasks: 6,
            in_progress_tasks: 2,
            not_started_tasks: 0
        },
        {
            committee_name: 'Marketing & Publicity',
            total_tasks: 5,
            completed_tasks: 2,
            in_progress_tasks: 2,
            not_started_tasks: 1
        },
        {
            committee_name: 'Finance & Sponsorship',
            total_tasks: 4,
            completed_tasks: 0,
            in_progress_tasks: 1,
            not_started_tasks: 3
        },
        {
            committee_name: 'Logistics & Operations',
            total_tasks: 6,
            completed_tasks: 1,
            in_progress_tasks: 3,
            not_started_tasks: 2
        }
    ];

    const sampleCommitteeTasksTBD = [
        {
            committee_name: 'Technical Committee',
            total_tasks: 3,
            completed_tasks: 3,
            in_progress_tasks: 0,
            not_started_tasks: 0
        },
        {
            committee_name: 'Marketing & Publicity',
            total_tasks: 2,
            completed_tasks: 0,
            in_progress_tasks: 1,
            not_started_tasks: 1
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Notion-Style Progress Bar
                    </h1>
                    <p className="text-gray-600">
                        Clean, minimal, and elegant progress tracking inspired by Notion's design system.
                    </p>
                </div>

                {/* Example 1: With Date */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6 hover:shadow-md transition-shadow duration-200">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                        Annual Tech Fest 2024
                    </h2>
                    <p className="text-sm text-gray-600 mb-8">
                        A major technical event with tasks assigned to 4 committees
                    </p>

                    <NotionProgressBar
                        committeeTasks={sampleCommitteeTasks}
                        eventDate="2024-03-15T10:00:00Z"
                    />
                </div>

                {/* Example 2: TBD Date */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6 hover:shadow-md transition-shadow duration-200">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                        Workshop on AI & Machine Learning
                    </h2>
                    <p className="text-sm text-gray-600 mb-8">
                        Date to be decided - early planning stage
                    </p>

                    <NotionProgressBar
                        committeeTasks={sampleCommitteeTasksTBD}
                        eventDate={undefined}
                    />
                </div>

                {/* Example 3: No Tasks */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6 hover:shadow-md transition-shadow duration-200">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                        New Event - Just Approved
                    </h2>
                    <p className="text-sm text-gray-600 mb-8">
                        Tasks not assigned yet
                    </p>

                    <NotionProgressBar
                        committeeTasks={[]}
                        eventDate="2024-04-20T14:00:00Z"
                    />
                </div>

                {/* Features */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3">
                        ✨ Notion-Style Features
                    </h3>
                    <ul className="space-y-2 text-sm text-blue-800">
                        <li>• Clean, minimal design with subtle shadows</li>
                        <li>• Smooth, natural animations (cubic-bezier easing)</li>
                        <li>• Hover effects on committee cards</li>
                        <li>• Color-coded status indicators</li>
                        <li>• Compact progress bars with percentages</li>
                        <li>• Task breakdown with dot indicators</li>
                        <li>• Staggered entrance animations</li>
                        <li>• Event date display (or TBD)</li>
                        <li>• Summary statistics at bottom</li>
                        <li>• Border highlight on hover</li>
                    </ul>
                </div>

                {/* Technical Details */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Technical Details
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="font-medium text-gray-700">Component</p>
                            <p className="text-gray-600 font-mono text-xs">components/events/NotionProgressBar.tsx</p>
                        </div>
                        <div>
                            <p className="font-medium text-gray-700">Animation Library</p>
                            <p className="text-gray-600">framer-motion v12.34.4</p>
                        </div>
                        <div>
                            <p className="font-medium text-gray-700">Design Inspiration</p>
                            <p className="text-gray-600">Notion's progress tracking</p>
                        </div>
                        <div>
                            <p className="font-medium text-gray-700">Easing Function</p>
                            <p className="text-gray-600 font-mono text-xs">[0.25, 0.1, 0.25, 1]</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <div className="mt-8 text-center">
                    <a
                        href="/dashboard/events/progress"
                        className="inline-block bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors duration-200 text-sm font-medium"
                    >
                        Go to Event Progress Page →
                    </a>
                    <p className="text-xs text-gray-500 mt-2">
                        Requires Supabase connection and logged-in user
                    </p>
                </div>
            </div>
        </div>
    );
}
