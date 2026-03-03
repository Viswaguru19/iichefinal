'use client';

import TaskProgressBar from '@/components/events/TaskProgressBar';

export default function TestTaskProgressPage() {
    // Sample data with committees and their tasks
    const sampleCommitteeTasks = [
        {
            committee_name: 'Technical',
            total_tasks: 8,
            completed_tasks: 6,
            in_progress_tasks: 2,
            not_started_tasks: 0
        },
        {
            committee_name: 'Marketing',
            total_tasks: 5,
            completed_tasks: 2,
            in_progress_tasks: 2,
            not_started_tasks: 1
        },
        {
            committee_name: 'Finance',
            total_tasks: 4,
            completed_tasks: 0,
            in_progress_tasks: 1,
            not_started_tasks: 3
        },
        {
            committee_name: 'Logistics',
            total_tasks: 6,
            completed_tasks: 1,
            in_progress_tasks: 3,
            not_started_tasks: 2
        }
    ];

    // Sample with TBD date
    const sampleCommitteeTasksTBD = [
        {
            committee_name: 'Technical',
            total_tasks: 3,
            completed_tasks: 1,
            in_progress_tasks: 1,
            not_started_tasks: 1
        },
        {
            committee_name: 'Marketing',
            total_tasks: 2,
            completed_tasks: 0,
            in_progress_tasks: 1,
            not_started_tasks: 1
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        🎯 Task-Based Progress Bar Test
                    </h1>
                    <p className="text-gray-600">
                        This shows the new animated progress bar based on committee tasks with event date display.
                    </p>
                </div>

                {/* Example 1: With Date */}
                <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Annual Tech Fest 2024
                    </h2>
                    <p className="text-gray-600 mb-8">
                        A major technical event with tasks assigned to 4 committees
                    </p>

                    <TaskProgressBar
                        committeeTasks={sampleCommitteeTasks}
                        eventDate="2024-03-15T10:00:00Z"
                    />
                </div>

                {/* Example 2: TBD Date */}
                <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Workshop on AI & ML
                    </h2>
                    <p className="text-gray-600 mb-8">
                        Date to be decided - early planning stage
                    </p>

                    <TaskProgressBar
                        committeeTasks={sampleCommitteeTasksTBD}
                        eventDate={undefined}
                    />
                </div>

                {/* Example 3: No Tasks */}
                <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        New Event - No Tasks Yet
                    </h2>
                    <p className="text-gray-600 mb-8">
                        Just approved, tasks not assigned yet
                    </p>

                    <TaskProgressBar
                        committeeTasks={[]}
                        eventDate="2024-04-20T14:00:00Z"
                    />
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
                    <h3 className="text-lg font-bold text-blue-900 mb-3">
                        ✅ Features You Should See:
                    </h3>
                    <ul className="space-y-2 text-blue-800">
                        <li>📅 Event date displayed prominently (or "TBD" if no date)</li>
                        <li>📊 Overall progress bar with gradient animation</li>
                        <li>✨ Shimmer effect on progress bar</li>
                        <li>🎯 Committee checkpoints with animated nodes</li>
                        <li>💫 Pulsing glow on committees with tasks in progress</li>
                        <li>📈 Mini progress bars for each committee</li>
                        <li>📋 Task statistics (total, done, in progress)</li>
                        <li>🎨 Color-coded status badges</li>
                        <li>📊 Summary cards at bottom (completed, in progress, not started, committees)</li>
                        <li>🎭 Hover effects on committee nodes</li>
                    </ul>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                        🔧 Technical Details
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="font-semibold text-gray-700">Component:</p>
                            <p className="text-gray-600 font-mono">components/events/TaskProgressBar.tsx</p>
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
                            <p className="font-semibold text-gray-700">Progress Based On:</p>
                            <p className="text-green-600 font-semibold">✅ Committee Tasks</p>
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
