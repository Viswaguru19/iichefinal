'use client';

import { Clock, Edit, User } from 'lucide-react';

interface EditHistoryViewProps {
    history: any[];
    profiles: { [key: string]: any };
}

export default function EditHistoryView({ history, profiles }: EditHistoryViewProps) {
    if (!history || history.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Edit History
            </h4>
            <div className="space-y-3">
                {history.map((entry: any, index: number) => (
                    <div key={index} className="border-l-2 border-blue-300 pl-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <User className="w-3 h-3" />
                            <span className="font-medium">{profiles[entry.edited_by]?.name || 'Unknown'}</span>
                            <span>•</span>
                            <span>{new Date(entry.timestamp).toLocaleString('en-IN')}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{entry.notes}</p>
                        {entry.changes && Object.keys(entry.changes).length > 0 && (
                            <div className="text-xs text-gray-600 space-y-1">
                                {Object.entries(entry.changes).map(([field, change]: [string, any]) => (
                                    <div key={field} className="bg-white p-2 rounded">
                                        <span className="font-medium capitalize">{field}:</span>
                                        <div className="ml-2">
                                            <div className="text-red-600">- {change.from || '(empty)'}</div>
                                            <div className="text-green-600">+ {change.to || '(empty)'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
