'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface EditEventModalProps {
    event: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EditEventModal({ event, onClose, onSuccess }: EditEventModalProps) {
    const [formData, setFormData] = useState({
        title: event.title || '',
        description: event.description || '',
        date: event.date ? new Date(event.date).toISOString().slice(0, 16) : '',
        location: event.location || '',
        budget: event.budget || '',
    });
    const [editNotes, setEditNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    async function handleSave() {
        if (!editNotes.trim()) {
            toast.error('Please provide notes about your changes');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Build edit history entry
            const changes: any = {};
            if (formData.title !== event.title) changes.title = { from: event.title, to: formData.title };
            if (formData.description !== event.description) changes.description = { from: event.description, to: formData.description };
            if (formData.date !== event.date) changes.date = { from: event.date, to: formData.date };
            if (formData.location !== event.location) changes.location = { from: event.location, to: formData.location };
            if (formData.budget !== event.budget) changes.budget = { from: event.budget, to: formData.budget };

            const historyEntry = {
                timestamp: new Date().toISOString(),
                edited_by: user?.id,
                notes: editNotes,
                changes
            };

            // Get existing history
            const { data: currentEvent } = await supabase
                .from('events')
                .select('edit_history')
                .eq('id', event.id)
                .single();

            const existingHistory = currentEvent?.edit_history || [];
            const newHistory = [...existingHistory, historyEntry];

            // Update event
            const { error } = await supabase
                .from('events')
                .update({
                    ...formData,
                    edit_history: newHistory,
                    last_edited_by: user?.id,
                    last_edited_at: new Date().toISOString()
                })
                .eq('id', event.id);

            if (error) throw error;

            toast.success('Event updated successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Review & Edit Event</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                        <input
                            type="datetime-local"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Budget (₹)</label>
                        <input
                            type="number"
                            value={formData.budget}
                            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Edit Notes <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            rows={3}
                            required
                            placeholder="Explain what changes you made and why..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={handleSave}
                        disabled={loading || !editNotes.trim()}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
